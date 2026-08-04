/**
 * Vercel Serverless Function — Firebase Admin Auth Proxy
 *
 * Creates and deletes Firebase Auth accounts server-side.
 * Required because client-side Firebase SDK can only create accounts
 * by signing in as them (which disrupts the current session).
 *
 * Actions:
 *   POST { action: 'create-user', email, password, displayName }
 *   POST { action: 'delete-user', email }
 *
 * Both actions require a valid Firebase ID token. They are only ever called
 * from an admin adding or removing a team member, or approving/rejecting a
 * host — all logged-in operations. Host self-signup does NOT come through
 * here; it has its own endpoint (api/owner-signup.js) precisely because it
 * is unauthenticated and therefore must not be able to name an arbitrary
 * account to create or delete.
 *
 * Env:
 *   FIREBASE_SERVICE_ACCOUNT (JSON string of service account key)
 *   FIREBASE_API_KEY         (verifying the caller's ID token)
 */

let admin;
try {
    admin = require('firebase-admin');
} catch (e) {
    admin = null;
}

function initFirebaseAdmin() {
    if (!admin) throw new Error('firebase-admin package not available');
    if (admin.apps.length > 0) return admin.apps[0];

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
    }

    return admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount))
    });
}

const ALLOWED_ORIGINS = [
    'https://resiq.hostizzy.com',
    'http://localhost:3000',
    'http://localhost:8000'
];

async function verifyFirebaseToken(idToken) {
    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    if (!firebaseApiKey) throw new Error('Firebase API key not configured');
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        }
    );
    if (!response.ok) throw new Error('Invalid Firebase token');
    const data = await response.json();
    if (!data.users || data.users.length === 0) throw new Error('No user found');
    return data.users[0].email;
}

module.exports = async function handler(req, res) {
    // CORS — the app is the only caller, so don't advertise this to every origin.
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Without this, delete-user is an unauthenticated "remove any account by
    // email address" endpoint.
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    try {
        await verifyFirebaseToken(authHeader.split('Bearer ')[1]);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token: ' + err.message });
    }

    if (!admin) {
        return res.status(500).json({ error: 'firebase-admin not installed on server' });
    }

    try {
        initFirebaseAdmin();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }

    const { action, email, password, displayName } = req.body || {};

    if (!action) return res.status(400).json({ error: 'Missing action' });

    try {
        if (action === 'create-user') {
            if (!email || !password) {
                return res.status(400).json({ error: 'Missing email or password' });
            }
            const userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: displayName || email.split('@')[0],
                emailVerified: false
            });
            return res.status(200).json({ uid: userRecord.uid, email: userRecord.email });
        }

        if (action === 'delete-user') {
            if (!email) return res.status(400).json({ error: 'Missing email' });
            try {
                const userRecord = await admin.auth().getUserByEmail(email);
                await admin.auth().deleteUser(userRecord.uid);
            } catch (e) {
                if (e.code !== 'auth/user-not-found') throw e;
                // User already gone — not an error
            }
            return res.status(200).json({ deleted: true });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (error) {
        console.error('[auth-proxy] Error:', error);
        return res.status(500).json({ error: error.message });
    }
};
