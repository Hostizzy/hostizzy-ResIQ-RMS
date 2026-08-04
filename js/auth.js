// ResIQ Auth — Login, logout, password reset, session management

        function toggleLoginPassword() {
            const passwordInput = document.getElementById('loginPassword');
            const toggleIcon = document.getElementById('loginPasswordToggleIcon');

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.innerHTML = '<i data-lucide="eye-off" style="width: 16px; height: 16px;"></i>';
            } else {
                passwordInput.type = 'password';
                toggleIcon.innerHTML = '<i data-lucide="eye" style="width: 16px; height: 16px;"></i>';
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // Authentication (Hybrid: Staff + Owner)
        // ==========================================
        // AUTH HELPERS
        // ==========================================

        function showMainApp(user) {
            document.getElementById('loginScreen')?.classList.add('hidden');
            document.getElementById('mainApp')?.classList.remove('hidden');
            updateUserEmailDisplay(user.email);
            const mobileHeader = document.getElementById('mobileHeader');
            if (mobileHeader) mobileHeader.classList.remove('hidden');
            const mobileUserEmail = document.getElementById('mobileUserEmail');
            if (mobileUserEmail) mobileUserEmail.textContent = user.email;
            if (user.role === 'staff') hidePerformanceForStaff();
        }

        function showLoginPanel() {
            document.getElementById('forgotPasswordPanel').classList.add('hidden');
            document.getElementById('resetPasswordPanel').classList.add('hidden');
            document.getElementById('signupPanel')?.classList.add('hidden');
            document.getElementById('pendingApprovalPanel')?.classList.add('hidden');
            document.getElementById('rejectedPanel')?.classList.add('hidden');
            document.querySelector('.login-form-side > .login-card')?.classList.remove('hidden');
        }

        function showPendingApprovalScreen() {
            document.querySelector('.login-form-side > .login-card')?.classList.add('hidden');
            document.getElementById('forgotPasswordPanel').classList.add('hidden');
            document.getElementById('resetPasswordPanel').classList.add('hidden');
            document.getElementById('signupPanel')?.classList.add('hidden');
            document.getElementById('rejectedPanel')?.classList.add('hidden');
            document.getElementById('pendingApprovalPanel')?.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function showRejectedScreen() {
            document.querySelector('.login-form-side > .login-card')?.classList.add('hidden');
            document.getElementById('forgotPasswordPanel').classList.add('hidden');
            document.getElementById('resetPasswordPanel').classList.add('hidden');
            document.getElementById('signupPanel')?.classList.add('hidden');
            document.getElementById('pendingApprovalPanel')?.classList.add('hidden');
            document.getElementById('rejectedPanel')?.classList.remove('hidden');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        function showForgotPassword() {
            document.querySelector('.login-form-side > .login-card')?.classList.add('hidden');
            document.getElementById('resetPasswordPanel').classList.add('hidden');
            document.getElementById('signupPanel')?.classList.add('hidden');
            document.getElementById('forgotPasswordPanel').classList.remove('hidden');
            const stored = localStorage.getItem('rememberedEmail') || document.getElementById('loginEmail').value.trim();
            if (stored) document.getElementById('forgotPasswordEmail').value = stored;
        }

        // Host self-signup lives on the landing page (index.html#signup) and
        // posts to /api/owner-signup. There is deliberately no signup form in
        // the app itself — the login card links to the landing page instead.

        /**
         * Wipe everything in localStorage that belongs to a specific user.
         *
         * Logging out only removed `currentUser`, so the next person to sign in
         * on the same browser inherited the previous one's state: their
         * notification list, their business name, currency and email signature.
         * A host logging in after a Hostizzy session saw Hostizzy's
         * notifications, and would have sent guest emails under Hostizzy's
         * signature.
         *
         * Deliberately keeps `rememberedEmail` (that is the login form's own
         * convenience) and the pwa_* dismissal flags (device preferences, not
         * user data).
         */
        function clearUserScopedLocalState() {
            [
                'notifications', 'notificationPreferences', 'lastView',
                'businessName', 'whatsappUpiId',
                // Message log, custom templates and the Gmail connection all
                // belong to whoever was signed in.
                'communicationMessages', 'resiq_message_templates',
                'gmail_connection_status', 'gmail_user_email',
                'gmail_auto_scan', 'gmail_last_scan',
            ].forEach(k => localStorage.removeItem(k));

            // SettingsStore namespaces business settings under "bs:".
            Object.keys(localStorage)
                .filter(k => k.startsWith('bs:'))
                .forEach(k => localStorage.removeItem(k));
        }

        async function login() {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            if (!email || !password) {
                showToast('Login Error', 'Please enter email and password', '❌');
                return;
            }

            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            const loginBtn = document.querySelector('#loginScreen .btn-primary');
            if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Logging in...'; }

            try {
                // ── Step 1: Authenticate with Firebase ──────────────────────
                const { user: firebaseAuthUser } = await authService.signIn(email, password);
                if (!firebaseAuthUser) {
                    showToast('Login Failed', 'Invalid email or password', '❌');
                    return;
                }
                console.log('[Auth] Firebase Auth login successful');

                // A different person than last time on this browser — drop the
                // previous user's cached state before anything reads it. Covers
                // the case where the last session ended by closing the tab
                // rather than logging out, so logout() never ran.
                try {
                    const previous = JSON.parse(localStorage.getItem('currentUser') || 'null');
                    if (previous?.email && previous.email !== email) {
                        clearUserScopedLocalState();
                    }
                } catch (_) { clearUserScopedLocalState(); }

                // ── Step 2: Find user profile in database ─────────────────
                // Pre-auth lookup — scope hasn't been set yet, so use the
                // dedicated findUserByEmail() helper that searches across
                // team_members and property_owners.
                {
                    const profile = await db.findUserByEmail(email);

                    if (profile && profile._kind === 'staff') {
                        if (!profile.is_active) {
                            await authService.signOut();
                            showToast('Account Inactive', 'Your account has been deactivated', '❌');
                            return;
                        }
                        currentUser = { ...profile, userType: 'staff' };
                        delete currentUser._kind;
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        await db.initScope(currentUser);
                        showMainApp(currentUser);
                        // A team member with an owner_id is a host's caretaker,
                        // not Hostizzy staff — they get the tenant sidebar even
                        // though their role may say "admin" within that tenant.
                        if (currentUser.owner_id) hideSidebarForOwners();
                        else showAdminOnlyNav();
                        await loadDashboard();
                        showToast('Welcome!', `Logged in as ${profile.name}`, '👋');
                        const lastView = (typeof getInitialView === 'function') ? getInitialView() : (localStorage.getItem('lastView') || 'home');
                        showView(lastView);
                        if (lastView === 'home') setTimeout(() => updateHomeScreenStats(), 500);
                        return;
                    }

                    // Firebase Auth user exists but no team_members record — check owners.
                    // findUserByEmail() above already looked, so reuse its
                    // result when it returned an owner instead of re-querying.
                    const ownerProfile = (profile && profile._kind === 'owner') ? profile : null;
                    if (ownerProfile) {
                        delete ownerProfile._kind;
                        // External owner: check approval status
                        const isHost = (ownerProfile.account_type || (ownerProfile.is_external ? 'host' : 'managed')) === 'host';
                        if (isHost) {
                            if (ownerProfile.status === 'pending') {
                                await authService.signOut();
                                showPendingApprovalScreen();
                                return;
                            }
                            if (ownerProfile.status === 'rejected') {
                                await authService.signOut();
                                showRejectedScreen();
                                return;
                            }
                            // Approved external owner → log into main app
                            currentUser = { ...ownerProfile, userType: 'owner' };
                            localStorage.setItem('currentUser', JSON.stringify(currentUser));
                            await db.initScope(currentUser);
                            showMainApp(currentUser);
                            await loadDashboard();
                            showToast('Welcome!', `Logged in as ${ownerProfile.name}`, '👋');
                            const lastView = (typeof getInitialView === 'function') ? getInitialView() : (localStorage.getItem('lastView') || 'home');
                            showView(lastView);
                            if (lastView === 'home') setTimeout(() => updateHomeScreenStats(), 500);
                            // Show/hide admin-only nav items
                            hideSidebarForOwners();
                            return;
                        }

                        // Internal (Hostizzy-managed) owner → redirect to owner-portal
                        if (!ownerProfile.is_active) {
                            await authService.signOut();
                            showToast('Account Inactive', 'Your account has been deactivated', '❌');
                            return;
                        }
                        currentUser = { ...ownerProfile, userType: 'owner' };
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        window.location.href = '/owner-portal';
                        return;
                    }
                }

                // Firebase Auth succeeded but no staff/owner profile found
                await authService.signOut();
                showToast('Login Failed', 'No account profile found for this email', '❌');

            } catch (error) {
                console.error('Login error:', error);
                showToast('Login Error', getAuthErrorMessage(error), '❌');
            } finally {
                if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Login'; }
            }
        }

        function hidePerformanceForStaff() {
            // Hide from desktop navigation
            document.querySelectorAll('.nav-link').forEach(link => {
                if (link.textContent.includes('Performance') || link.onclick?.toString().includes('performance')) {
                    link.style.display = 'none';
                }
            });
        }

        function hideSidebarForOwners() {
            // Hosts (independent) and managed owners don't see admin-only views.
            // Team stays visible for hosts — that is how they give a caretaker
            // access to their own properties, and the list is scoped to them.
            const hiddenLabels = ['Managed Owners', 'Hosts', 'OTA Import', 'Performance'];
            if (!isHostAccount(currentUser)) hiddenLabels.push('Team');
            document.querySelectorAll('.sidebar-item').forEach(item => {
                const label = item.querySelector('.sidebar-item-label')?.textContent?.trim();
                if (hiddenLabels.includes(label)) {
                    item.style.display = 'none';
                }
            });
            const hostsNav = document.getElementById('sidebarHosts');
            if (hostsNav) hostsNav.style.display = 'none';

            // Hide admin-only items from home screen grids
            document.querySelectorAll('.admin-only-item').forEach(el => {
                el.style.display = 'none';
            });

            // Also hide Performance from mobile navigation
            hidePerformanceForStaff();

            // Show "Powered by Hostizzy" in sidebar for hosts
            const poweredBy = document.getElementById('sidebarPoweredBy');
            if (poweredBy) poweredBy.style.display = 'block';
        }

        function showAdminOnlyNav() {
            // Hosts is visible to all staff; the badge tells admins there's
            // something waiting. Loading it here means the count is right
            // before anyone opens the view.
            if (currentUser?.userType !== 'staff') return;
            db.getOwners().then(owners => {
                const waiting = (owners || []).filter(o =>
                    (o.account_type || (o.is_external ? 'host' : 'managed')) === 'host'
                    && o.status === 'pending').length;
                if (typeof updatePendingBadge === 'function') updatePendingBadge(waiting);
            }).catch(() => {});
        }

        async function logout() {
            try { await authService.signOut(); } catch (e) { /* ignore */ }
            localStorage.removeItem('currentUser');
            clearUserScopedLocalState();
            currentUser = null;
            db.clearScope();

            // In-memory notification list too — clearing localStorage alone
            // leaves the array populated until the page reloads, and the PWA
            // branch below does not reload.
            if (typeof notifications !== 'undefined') {
                notifications = [];
                if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
            }

            // Detect if running as PWA / installed app
            const isPWA = window.matchMedia('(display-mode: standalone)').matches
                       || window.matchMedia('(display-mode: window-controls-overlay)').matches
                       || window.navigator.standalone === true;

            if (isPWA) {
                // PWA / Mobile App: stay on login screen
                document.getElementById('mainApp').classList.add('hidden');
                document.getElementById('loginScreen').classList.remove('hidden');
                document.getElementById('mobileHeader')?.classList.add('hidden');
                if (window.ResIQBottomTabs) window.ResIQBottomTabs.destroy();
                document.body.classList.remove('has-bottom-tabs');
                document.querySelector('.sidebar')?.classList.remove('active', 'mobile-open');
                document.querySelector('.mobile-overlay')?.classList.remove('active');
                showToast('Logged Out', 'See you soon!', '👋');
            } else {
                // Web App: redirect to landing page
                window.location.replace('/');
            }
        }

        // ── Forgot Password ──────────────────────────────────────────────────
        async function submitForgotPassword() {
            const email = document.getElementById('forgotPasswordEmail').value.trim();
            const msgEl = document.getElementById('forgotPasswordMessage');
            const btn = document.querySelector('#forgotPasswordPanel .btn-primary');

            if (!email) {
                msgEl.style.display = 'block';
                msgEl.style.background = '#fee2e2';
                msgEl.style.color = '#dc2626';
                msgEl.textContent = 'Please enter your email address.';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Sending...';
            msgEl.style.display = 'none';

            try {
                await authService.sendPasswordReset(email, window.location.origin + window.location.pathname);
                msgEl.style.display = 'block';
                msgEl.style.background = '#dcfce7';
                msgEl.style.color = '#16a34a';
                msgEl.textContent = 'Reset link sent! Check your email inbox (and spam folder).';
                btn.textContent = 'Sent';
            } catch (err) {
                msgEl.style.display = 'block';
                msgEl.style.background = '#fee2e2';
                msgEl.style.color = '#dc2626';
                msgEl.textContent = getAuthErrorMessage(err);
                btn.disabled = false;
                btn.textContent = 'Send Reset Link';
            }
        }

        async function submitResetPassword() {
            const newPassword = document.getElementById('resetNewPassword').value;
            const confirmPassword = document.getElementById('resetConfirmPassword').value;
            const msgEl = document.getElementById('resetPasswordMessage');
            const btn = document.querySelector('#resetPasswordPanel .btn-primary');

            msgEl.style.display = 'none';

            if (!newPassword || newPassword.length < 8) {
                msgEl.style.display = 'block';
                msgEl.style.background = '#fee2e2';
                msgEl.style.color = '#dc2626';
                msgEl.textContent = 'Password must be at least 8 characters.';
                return;
            }
            if (newPassword !== confirmPassword) {
                msgEl.style.display = 'block';
                msgEl.style.background = '#fee2e2';
                msgEl.style.color = '#dc2626';
                msgEl.textContent = 'Passwords do not match.';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Updating...';

            try {
                // Check for oobCode from password reset email link
                const urlParams = new URLSearchParams(window.location.search);
                const oobCode = urlParams.get('oobCode');
                if (oobCode) {
                    await firebaseAuth.confirmPasswordReset(oobCode, newPassword);
                } else {
                    // User is already signed in (e.g., changing password from profile)
                    await authService.updatePassword(newPassword);
                }
                msgEl.style.display = 'block';
                msgEl.style.background = '#dcfce7';
                msgEl.style.color = '#16a34a';
                msgEl.textContent = 'Password updated successfully! Redirecting to login...';
                setTimeout(() => {
                    window.location.hash = '';
                    window.location.search = '';
                    window.location.reload();
                }, 2000);
            } catch (err) {
                msgEl.style.display = 'block';
                msgEl.style.background = '#fee2e2';
                msgEl.style.color = '#dc2626';
                if (err.code === 'auth/expired-action-code') {
                    msgEl.textContent = 'This reset link has expired. Please request a new one.';
                } else if (err.code === 'auth/invalid-action-code') {
                    msgEl.textContent = 'This reset link is invalid or has already been used.';
                } else if (err.code === 'auth/weak-password') {
                    msgEl.textContent = 'Password is too weak. Please use a stronger password.';
                } else {
                    msgEl.textContent = err.message || 'Failed to update password. Please try again.';
                }
                btn.disabled = false;
                btn.textContent = 'Update Password';
            }
        }
