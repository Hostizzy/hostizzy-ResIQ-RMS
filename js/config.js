// ResIQ Config — Backend configuration, auth, and global state

        // ==========================================
        // BACKEND CONFIGURATION
        // ==========================================
        // Auth: Firebase Authentication (email/password)
        // Database: Supabase (PostgreSQL via PostgREST)
        //
        // SECURITY NOTES:
        // 1. Enable Row Level Security (RLS) on ALL Supabase tables
        // 2. Set up environment variables in Vercel dashboard (see .env.example)
        // 3. Firebase config keys are safe to expose (security enforced via Firebase Rules)
        // 4. Supabase anon key is safe with RLS enabled

        const SUPABASE_URL = 'https://dxthxsguqrxpurorpokq.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4dGh4c2d1cXJ4cHVyb3Jwb2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjc4MTMsImV4cCI6MjA3NTYwMzgxM30.JhGzqUolA-A_fGha-0DhHVl7p1vRq4CZcp5ttdVxjQg';

        // Initialize Supabase PROXY client — routes DB calls through /api/db-proxy
        // to avoid ISP blocking of direct supabase.co connections
        var supabase = createSupabaseProxy();

        // ==========================================
        // FIREBASE AUTH CONFIGURATION
        // ==========================================
        // Firebase is used for authentication (replaces Supabase Auth)
        // Supabase is retained for database operations (Postgres)
        const firebaseConfig = {
            apiKey: "AIzaSyBZki72Y_X9OaQt4yl5q_f5XgUos4dI1BE",
            authDomain: "resiq-by-hostizzy.firebaseapp.com",
            projectId: "resiq-by-hostizzy",
            storageBucket: "resiq-by-hostizzy.firebasestorage.app",
            messagingSenderId: "755242026549",
            appId: "1:755242026549:web:c688a6b1cc794ec2aad37c"
        };

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        const firebaseAuth = firebase.auth();

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
