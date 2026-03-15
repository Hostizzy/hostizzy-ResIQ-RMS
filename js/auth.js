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
            document.querySelector('.login-card').classList.remove('hidden');
        }

        function showForgotPassword() {
            document.querySelector('.login-card').classList.add('hidden');
            document.getElementById('resetPasswordPanel').classList.add('hidden');
            document.getElementById('forgotPasswordPanel').classList.remove('hidden');
            const stored = localStorage.getItem('rememberedEmail') || document.getElementById('loginEmail').value.trim();
            if (stored) document.getElementById('forgotPasswordEmail').value = stored;
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

                // ── Step 2: Find user profile in database ─────────────────
                {
                    const users = await db.getTeamMembers();
                    const profile = users.find(u => u.email === email);

                    if (profile) {
                        if (!profile.is_active) {
                            await authService.signOut();
                            showToast('Account Inactive', 'Your account has been deactivated', '❌');
                            return;
                        }
                        currentUser = { ...profile, userType: 'staff' };
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                        showMainApp(currentUser);
                        await loadDashboard();
                        showToast('Welcome!', `Logged in as ${profile.name}`, '👋');
                        const lastView = localStorage.getItem('lastView') || 'home';
                        showView(lastView);
                        if (lastView === 'home') setTimeout(() => updateHomeScreenStats(), 500);
                        return;
                    }

                    // Firebase Auth user exists but no team_members record — check owners
                    const owners = await db.getOwners();
                    const ownerProfile = owners.find(o => o.email === email);
                    if (ownerProfile) {
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

        async function logout() {
            try { await authService.signOut(); } catch (e) { /* ignore */ }
            localStorage.removeItem('currentUser');
            currentUser = null;
            document.getElementById('mainApp').classList.add('hidden');
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('mobileHeader')?.classList.add('hidden');
            // Clean up bottom tabs module (re-inits when mainApp becomes visible again)
            if (window.ResIQBottomTabs) window.ResIQBottomTabs.destroy();
            document.body.classList.remove('has-bottom-tabs');
            // Ensure sidebar is closed
            document.querySelector('.sidebar')?.classList.remove('active', 'mobile-open');
            document.querySelector('.mobile-overlay')?.classList.remove('active');
            showToast('Logged Out', 'See you soon!', '👋');
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
