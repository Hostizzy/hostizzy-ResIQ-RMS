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
 * Env: FIREBASE_SERVICE_ACCOUNT (JSON string of service account key)
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

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
