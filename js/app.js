// ResIQ App — Main app initialization, splash screen, session restore, push notifications

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Check login on page load
window.addEventListener('load', async () => {
    try {
        await initOfflineDB();
        console.log('Offline database ready');
    } catch (error) {
        console.error('Failed to initialize offline DB:', error);
    }

    isOnline = navigator.onLine;
    updateSyncIndicator();

    // Gmail send is initialized via the existing Gmail OAuth connection
    if (localStorage.getItem('gmail_access_token')) {
        console.log('[Gmail] Send capability ready via connected Gmail account');
    }
    
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

    // Wait for Firebase Auth state to be ready before checking session
    try {
        const firebaseUser = await new Promise((resolve) => {
            const unsubscribe = authService.onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
            // Timeout after 3s to avoid blocking the app if Firebase is unreachable
            setTimeout(() => { resolve(null); }, 3000);
        });
        if (firebaseUser) {
            const allMembers = await db.getTeamMembers();
            const profile = allMembers.find(u => u.email === firebaseUser.email);
            if (profile && profile.is_active) {
                const sessionUser = { ...profile, userType: 'staff' };
                localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                console.log('[Auth] Firebase session restored for:', profile.email);
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
            showMainApp(currentUser);
            
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
            const lastView = localStorage.getItem('lastView') || 'home';
            setTimeout(() => showView(lastView), 300);

            // Load data immediately on all devices — no artificial delays
            loadInitialData();

            if (navigator.onLine) {
                // Non-critical background tasks after initial data is loaded
                const bgDelay = (isMobile || isSlowConnection) ? 5000 : 2000;
                setTimeout(autoSync, bgDelay);
                setTimeout(initializeAutoSync, bgDelay + 1000);
                setTimeout(scheduleAutoStatusUpdates, bgDelay + 1000);
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
            const lastView = localStorage.getItem('lastView') || 'home';
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

        const lastView = localStorage.getItem('lastView') || 'home';
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
            if (data.action) {
                eval(data.action);
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
                action: "showView('payments')"
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
                action: "applyQuickFilter('urgent')"
            }
        );
    }
}    
});

