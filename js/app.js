// ResIQ App — Main app initialization, splash screen, session restore, push notifications

/** Get initial view from URL path, falling back to localStorage, then 'home' */
function getInitialView() {
    const match = window.location.pathname.match(/^\/app\/([^/]+)$/);
    if (match && match[1]) return match[1];
    return localStorage.getItem('lastView') || 'home';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Check login on page load
window.addEventListener('load', async () => {
    // Wait for config (Firebase init) to be ready before anything auth-related
    if (typeof _configReady !== 'undefined') {
        await _configReady;
    }

    try {
        await initOfflineDB();
        console.log('Offline database ready');
    } catch (error) {
        console.error('Failed to initialize offline DB:', error);
    }

    isOnline = navigator.onLine;
    updateSyncIndicator();
    
    // ── Detect password-recovery email link ──
    // Firebase sends reset links with query params: ?mode=resetPassword&oobCode=...
    const urlSearch = window.location.search;
    const urlHash = window.location.hash;
    if (urlSearch.includes('mode=resetPassword') || urlHash.includes('mode=resetPassword') || urlHash.includes('type=recovery')) {
        // User clicked a password reset email link — show the set-new-password form
        document.querySelector('.login-card').classList.add('hidden');
        document.getElementById('forgotPasswordPanel').classList.add('hidden');
        document.getElementById('resetPasswordPanel').classList.remove('hidden');
        setTimeout(() => {
            const splash = document.getElementById('splashScreen');
            if (splash) { splash.style.opacity = '0'; setTimeout(() => { splash.style.display = 'none'; }, 500); }
        }, 1000);
        return; // Don't try to restore a regular session
    }

    // Wait for Firebase Auth state to be ready before checking session.
    // Firebase is now the SOURCE OF TRUTH — if it doesn't return a user,
    // any stale localStorage session is cleared so we don't render the
    // app for a signed-out user (or one whose token has been revoked).
    let firebaseUser = null;
    try {
        firebaseUser = await new Promise((resolve) => {
            const unsubscribe = authService.onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
            // Timeout after 3s to avoid blocking the app if Firebase is unreachable
            setTimeout(() => { resolve(null); }, 3000);
        });
        if (firebaseUser) {
            // Pre-auth lookup — db scope hasn't been initialized yet, so
            // use the dedicated findUserByEmail() helper that bypasses scope.
            const profile = await db.findUserByEmail(firebaseUser.email);
            if (profile && profile.is_active) {
                const userType = profile._kind === 'owner' ? 'owner' : (profile.userType || profile.user_type || 'staff');
                const sessionUser = { ...profile, userType };
                delete sessionUser._kind;
                localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                console.log('[Auth] Firebase session restored for:', profile.email);
            } else {
                // Authenticated with Firebase but the profile is missing or
                // disabled — treat as signed out and force a fresh login.
                console.warn('[Auth] Firebase user has no active profile, clearing session');
                localStorage.removeItem('currentUser');
                authService.signOut?.().catch(() => {});
            }
        } else if (navigator.onLine) {
            // No Firebase user AND we're online — invalidate any stale
            // localStorage session. (Offline: keep cached session so the
            // operator can still work and we'll re-validate on reconnect.)
            const stale = localStorage.getItem('currentUser');
            if (stale) {
                console.warn('[Auth] No Firebase session while online — clearing stale localStorage session');
                localStorage.removeItem('currentUser');
            }
        }
    } catch (e) {
        console.warn('[Auth] Firebase session check failed, using localStorage fallback:', e.message);
    }

    // Check localStorage for persistent session
    const storedUser = localStorage.getItem('currentUser');

    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);

            // The cached object was written at login and never refreshed, so a
            // session that predates a column knows nothing about it. That is
            // not academic: a session cached before is_super_admin existed has
            // no such key, and db.initScope() then falls back to
            // role === 'admin' — handing every Hostizzy admin the whole host
            // book, which is precisely what that flag exists to prevent. Same
            // staleness would keep a deactivated or demoted colleague working
            // until they happened to log out.
            //
            // So re-read the record before anything is scoped from it. Offline
            // (or a failed read) keeps the cached session, because an operator
            // in a valley with no signal still has a day to run.
            try {
                const fresh = await db.findUserByEmail(currentUser.email);
                if (fresh) {
                    const kind = fresh._kind;
                    delete fresh._kind;
                    if (fresh.is_active === false) {
                        localStorage.removeItem('currentUser');
                        await authService.signOut?.().catch(() => {});
                        window.location.reload();
                        return;
                    }
                    // userType is ours, not the table's — carry it across.
                    currentUser = { ...fresh, userType: kind === 'staff' ? 'staff' : 'owner' };
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
            } catch (e) {
                console.warn('[Auth] Could not refresh profile on restore, using cached session:', e.message);
            }

            // Managed owners (not is_external) should use the owner portal
            if (currentUser.userType === 'owner' && !isHostAccount(currentUser)) {
                window.location.href = '/owner-portal';
                return;
            }

            // Initialize database scope from restored session
            await db.initScope(currentUser);

            showMainApp(currentUser);

            // Apply role-based UI visibility on session restore
            // owner_id on a staff record means a host's caretaker — scoped to
            // that host, so they get the tenant sidebar, not the Hostizzy one.
            if (currentUser.userType === 'owner' || currentUser.owner_id) {
                hideSidebarForOwners();
            } else if (currentUser.userType === 'staff') {
                // Every staff member, as on the login path — not just
                // role === 'admin', which this used to check. Two reasons it
                // was wrong: super admin is a flag now, so a super admin whose
                // role is plain 'staff' never got the book switcher after a
                // refresh; and showAdminOnlyNav() is also what HIDES the Hosts
                // door from ordinary staff, so skipping it left that door
                // standing open on every restored session.
                showAdminOnlyNav();
            }

            // Pull persisted settings from Supabase into localStorage so the
            // operator gets their business name, currency, signature, etc.
            // even on a fresh device or after a cache clear. Fires AFTER
            // showMainApp so it never blocks the critical render path.
            if (window.SettingsStore) {
                SettingsStore.hydrate().catch(() => {});
            }
            
            // ✅ MOBILE PERFORMANCE: Detect mobile and optimize loading
            const isMobile = window.innerWidth <= 768;
            const isSlowConnection = navigator.connection &&
                (navigator.connection.effectiveType === 'slow-2g' ||
                 navigator.connection.effectiveType === '2g' ||
                 navigator.connection.effectiveType === '3g');

            // Show UI first, then load data
            initializeSplashScreen();
            // Hide splash after 3s max (data may load sooner)
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if (splash && splash.style.display !== 'none') {
                    splash.style.opacity = '0';
                    setTimeout(() => {
                        const splash2 = document.getElementById('splashScreen');
                        if (splash2) splash2.style.display = 'none';
                    }, 500);
                }
            }, 3000);
            const lastView = getInitialView();
            setTimeout(() => showView(lastView), 300);

            // Load data immediately on all devices — no artificial delays
            loadInitialData();

            if (navigator.onLine) {
                // Non-critical background tasks after initial data is loaded
                const bgDelay = (isMobile || isSlowConnection) ? 5000 : 2000;
                setTimeout(autoSync, bgDelay);
                setTimeout(initializeAutoSync, bgDelay + 1000);
                setTimeout(scheduleAutoStatusUpdates, bgDelay + 1000);

                // Render Gmail UI immediately from cached localStorage state
                // (gmailConnectionStatus is restored from cache on module load)
                renderEmailStatusBanner();
                updateGmailSendStatus();

                // Then validate with server in background and re-render if changed
                checkGmailStatus().then(() => {
                    renderEmailStatusBanner();
                    updateGmailSendStatus();
                }).catch(() => {});
            }
        } catch (error) {
            console.error('Session restore error:', error);
            localStorage.removeItem('currentUser');
            // Hide splash screen after 2 seconds even if session restore fails
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if (splash) {
                    splash.style.opacity = '0';
                    setTimeout(() => {
                        splash.style.display = 'none';
                    }, 500);
                }
            }, 2000);
        }
    } else {
        // No stored session - show splash for 2 seconds then show login
        setTimeout(() => {
            const splash = document.getElementById('splashScreen');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.style.display = 'none';
                }, 500);
            }
        }, 2000);
    }

// ==========================================
// SPLASH SCREEN & HOME SCREEN
// ==========================================

/**
 * Initialize splash screen and show home screen
 */
function initializeSplashScreen() {
    // Show splash for 2.5 seconds (2 sec display + 0.5 sec fade)
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (!splash) return;
        splash.style.opacity = '0';
        
        setTimeout(() => {
            if (!splash) return;
            splash.style.display = 'none';
            // Restore last view or default to home
            const lastView = getInitialView();
            showView(lastView);
            // Update home stats if on home view
            if (lastView === 'home') {
                updateHomeScreenStats();
            }
        }, 500);
    }, 2500);
}

function handleAppResume() {
    try {
        const storedUser = localStorage.getItem('currentUser');
        if (!storedUser) return;

        // Ensure app is visible if user is logged in
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainApp) mainApp.classList.remove('hidden');

        const splash = document.getElementById('splashScreen');
        if (splash && splash.style.display !== 'none') {
            splash.style.opacity = '0';
            setTimeout(() => {
                const splash2 = document.getElementById('splashScreen');
                if (splash2) splash2.style.display = 'none';
            }, 250);
        }

        const lastView = getInitialView();
        if (typeof showView === 'function') {
            setTimeout(() => showView(lastView), 0);
        }
    } catch (e) {
        console.error('Resume handler error:', e);
    }
}

window.addEventListener('pageshow', handleAppResume);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) handleAppResume();
});

// Push Notifications
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
}

// Safe action router — maps notification action strings to functions (no eval)
const notificationActions = {
    'showPayments': () => showView('payments'),
    'showReservations': () => showView('reservations'),
    'showGuests': () => showView('guests'),
    'showDocuments': () => showView('documents'),
    'showHome': () => showView('home'),
    'filterUrgent': () => applyQuickFilter('urgent')
};

function sendNotification(title, body, data = {}) {
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: body,
            icon: 'assets/logo-192.png',
            badge: 'assets/logo-96.png',
            tag: data.tag || 'resiq-notification',
            requireInteraction: data.requireInteraction || false,
            data: data
        });

        notification.onclick = () => {
            window.focus();
            if (data.action && notificationActions[data.action]) {
                notificationActions[data.action]();
            }
            notification.close();
        };
    }
}

// Check for urgent notifications
async function checkUrgentNotifications() {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;
    
    const reservations = await db.getReservations();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Overdue payments
    const overdue = reservations.filter(r => {
        if (r.status === 'cancelled') return false;
        const checkIn = new Date(r.check_in);
        checkIn.setHours(0, 0, 0, 0);
        const balance = getBalance(r);
        return balance > 0 && checkIn < today;
    });
    
    if (overdue.length > 0) {
        sendNotification(
            '🔴 Overdue Payments',
            `${overdue.length} booking(s) have overdue payments`,
            { 
                tag: 'overdue-payments',
                requireInteraction: true,
                action: 'showPayments'
            }
        );
    }
    
    // Today's check-ins
    const todayCheckIns = reservations.filter(r => {
        const checkIn = new Date(r.check_in);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime() && r.status !== 'cancelled';
    });
    
    if (todayCheckIns.length > 0) {
        sendNotification(
            '🏨 Check-ins Today',
            `${todayCheckIns.length} guest(s) checking in today`,
            { 
                tag: 'today-checkins',
                action: 'filterUrgent'
            }
        );
    }
}    
});

