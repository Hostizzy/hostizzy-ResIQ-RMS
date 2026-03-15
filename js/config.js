// ResIQ Config — Backend configuration, auth, and global state

        // ==========================================
        // BACKEND CONFIGURATION
        // ==========================================
        // Auth: Firebase Authentication (email/password)
        // Database: Supabase (PostgreSQL via PostgREST)
        //
        // Keys are loaded from /api/config endpoint at runtime.
        // The proxy client doesn't need the raw Supabase URL/key
        // (it routes through /api/db-proxy), so no hardcoded secrets needed.

        var SUPABASE_URL = '';
        var SUPABASE_ANON_KEY = '';

        // Initialize Supabase PROXY client — routes DB calls through /api/db-proxy
        // to avoid ISP blocking of direct supabase.co connections
        var supabase = createSupabaseProxy();

        // ==========================================
        // FIREBASE AUTH CONFIGURATION
        // ==========================================
        // Firebase is used for authentication (replaces Supabase Auth)
        // Supabase is retained for database operations (Postgres)
        // Config loaded from /api/config — initialized in _initConfig() below.
        var firebaseAuth = null;

        // Fetch configuration from server and initialize Firebase
        var _configReady = (async function _initConfig() {
            try {
                var resp = await fetch('/api/config');
                if (resp.ok) {
                    var cfg = await resp.json();
                    SUPABASE_URL = cfg.supabaseUrl || '';
                    SUPABASE_ANON_KEY = cfg.supabaseAnonKey || '';
                    var firebaseConfig = {
                        apiKey: cfg.firebaseApiKey,
                        authDomain: cfg.firebaseAuthDomain,
                        projectId: cfg.firebaseProjectId,
                        storageBucket: cfg.firebaseStorageBucket,
                        messagingSenderId: cfg.firebaseMessagingSenderId,
                        appId: cfg.firebaseAppId
                    };
                    if (!firebase.apps.length) {
                        firebase.initializeApp(firebaseConfig);
                    }
                    firebaseAuth = firebase.auth();
                    return;
                }
            } catch (e) {
                console.warn('[Config] API fetch failed, using fallback:', e.message);
            }
            // Fallback: initialize with minimal config so the app doesn't break offline
            if (!firebase.apps.length) {
                firebase.initializeApp({
                    apiKey: "AIzaSyBZki72Y_X9OaQt4yl5q_f5XgUos4dI1BE",
                    authDomain: "resiq-by-hostizzy.firebaseapp.com",
                    projectId: "resiq-by-hostizzy"
                });
            }
            firebaseAuth = firebase.auth();
        })();

        // Firebase Auth Helper - unified auth interface
        const authService = {
            async signIn(email, password) {
                const credential = await firebaseAuth.signInWithEmailAndPassword(email, password);
                return { user: credential.user, error: null };
            },
            async signOut() {
                await firebaseAuth.signOut();
            },
            async sendPasswordReset(email, redirectUrl) {
                await firebaseAuth.sendPasswordResetEmail(email, {
                    url: redirectUrl || window.location.origin + window.location.pathname
                });
            },
            async updatePassword(newPassword) {
                const user = firebaseAuth.currentUser;
                if (!user) throw new Error('No authenticated user');
                await user.updatePassword(newPassword);
            },
            async getCurrentUser() {
                return firebaseAuth.currentUser;
            },
            onAuthStateChanged(callback) {
                return firebaseAuth.onAuthStateChanged(callback);
            }
        };

        // Map Firebase error codes to user-friendly messages
        function getAuthErrorMessage(err) {
            const messages = {
                'auth/user-not-found': 'No account found with this email.',
                'auth/wrong-password': 'Incorrect password. Please try again.',
                'auth/invalid-email': 'Please enter a valid email address.',
                'auth/user-disabled': 'This account has been disabled. Contact support.',
                'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
                'auth/network-request-failed': 'Network error. Please check your internet connection.',
                'auth/invalid-credential': 'Invalid email or password.',
                'auth/expired-action-code': 'This link has expired. Please request a new one.',
                'auth/invalid-action-code': 'This link is invalid or has already been used.',
                'auth/weak-password': 'Password is too weak. Use at least 8 characters.'
            };
            return messages[err.code] || err.message || 'An unexpected error occurred.';
        }

        // Booking Type Constants
        const BOOKING_TYPES = {
            'STAYCATION': { label: 'Staycation', icon: '🏖️' },
            'WEDDING': { label: 'Wedding', icon: '💒' },
            'BIRTHDAY': { label: 'Birthday Party', icon: '🎂' },
            'CORPORATE_EVENT': { label: 'Corporate Event', icon: '🏢' },
            'CORPORATE_STAY': { label: 'Corporate Stay', icon: '💼' },
            'SHOOT': { label: 'Shoot', icon: '📸' }
        };

        // Target occupancy nights per property per year
        const TARGET_OCCUPANCY_NIGHTS = 200;

        // Global State
        let allReservations = [];
        let allPayments = [];
        let selectedReservations = new Set();
        let currentUser = null;
        let currentWhatsAppBooking = null;

        // Payment filter state (persists across data refreshes)
        let paymentFilterState = {
            search: '',
            status: '',
            property: ''
        };
