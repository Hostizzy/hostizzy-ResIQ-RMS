/**
 * Vercel Serverless Function — Firebase → Supabase JWT Exchange
 *
 * The Flutter app authenticates with Firebase, then calls this endpoint
 * once to exchange the Firebase ID token for a short-lived Supabase JWT.
 * The Supabase JWT carries the user's owner_id and role in its claims,
 * so the native supabase_flutter client gets real Postgres RLS without
 * ever touching db-proxy.
 *
 * Flow:
 *   1. Flutter app sends POST { firebaseToken }
 *   2. This endpoint verifies the Firebase token via Admin SDK
 *   3. Looks up the user in team_members / property_owners
 *   4. Mints a Supabase-compatible JWT with claims:
 *        { sub, email, role: 'authenticated', owner_id?, user_type, property_ids? }
 *   5. Returns { token, expiresIn, profile }
 *   6. Flutter app calls supabase.auth.setSession(token) and queries directly
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_JWT_SECRET           ← from Supabase Dashboard → Settings → API → JWT Secret
 *   FIREBASE_SERVICE_ACCOUNT      ← JSON string of the Firebase service account
 */

import admin from 'firebase-admin';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

const ALLOWED_ORIGINS = [
    'https://resiq.hostizzy.com',
    'http://localhost:3000',
    'http://localhost:8000'
];

// Initialize Firebase Admin (idempotent)
let _adminInitError = null;
if (!admin.apps.length) {
    try {
        // Accept both env var names (align with auth-proxy.js and push-fcm.js)
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT
            || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            || '';

        if (!raw) throw new Error('Neither FIREBASE_SERVICE_ACCOUNT nor FIREBASE_SERVICE_ACCOUNT_JSON is set');

        // Handle base64-encoded values and escaped newlines in private_key
        let json = raw;
        if (!raw.startsWith('{')) {
            json = Buffer.from(raw, 'base64').toString('utf-8');
        }
        const serviceAccount = JSON.parse(json);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        _adminInitError = e.message;
        console.error('[auth-exchange] Firebase Admin init failed:', e.message);
    }
}

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function querySupabase(table, params = '') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    if (!r.ok) throw new Error(`Supabase query failed: ${r.status}`);
    return r.json();
}

/**
 * Sign a Supabase-compatible JWT. Uses the HS256 algorithm and the
 * project's JWT secret (same key Supabase uses to verify tokens from
 * its own GoTrue auth).
 *
 * We use the Web Crypto API (available in Vercel Edge + Node 18+)
 * so we don't need a JWT library dependency.
 */
async function mintSupabaseJWT(claims, expiresInSeconds = 3600) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const payload = {
        ...claims,
        iat: now,
        exp: now + expiresInSeconds,
        iss: 'supabase',
        aud: 'authenticated'
    };

    const enc = new TextEncoder();

    function b64url(data) {
        const b64 = typeof data === 'string'
            ? Buffer.from(data).toString('base64')
            : Buffer.from(data).toString('base64');
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const headerB64 = b64url(JSON.stringify(header));
    const payloadB64 = b64url(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    // HMAC-SHA256 sign
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(SUPABASE_JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
    const sigB64 = b64url(new Uint8Array(sig));

    return `${signingInput}.${sigB64}`;
}

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SUPABASE_JWT_SECRET) {
        return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured' });
    }

    // Surface init error clearly so it's obvious what went wrong
    if (_adminInitError || !admin.apps.length) {
        return res.status(500).json({
            error: 'Firebase Admin SDK not initialized',
            detail: _adminInitError || 'No Firebase app found — check FIREBASE_SERVICE_ACCOUNT env var'
        });
    }

    const { firebaseToken } = req.body;
    if (!firebaseToken) {
        return res.status(400).json({ error: 'firebaseToken is required' });
    }

    try {
        // 1. Verify Firebase token via Admin SDK (local key validation, no network call)
        const decoded = await admin.auth().verifyIdToken(firebaseToken);
        const email = decoded.email;
        if (!email) {
            return res.status(400).json({ error: 'Firebase token has no email' });
        }

        // 2. Look up user profile
        let profile = null;
        let userType = null;
        let ownerId = null;
        let propertyIds = [];

        // Check team_members
        const teamRows = await querySupabase('team_members',
            `email=eq.${encodeURIComponent(email)}&is_active=eq.true&limit=1`);
        if (teamRows.length > 0) {
            profile = teamRows[0];
            userType = profile.role === 'admin' ? 'admin' : 'staff';
            ownerId = profile.owner_id || null;
        }

        // Check property_owners if no team member found
        if (!profile) {
            const ownerRows = await querySupabase('property_owners',
                `email=eq.${encodeURIComponent(email)}&is_active=eq.true&limit=1`);
            if (ownerRows.length > 0) {
                profile = ownerRows[0];
                userType = 'owner';
                ownerId = profile.id;
            }
        }

        if (!profile) {
            return res.status(403).json({ error: 'No active profile found for this email' });
        }

        // 3. Load property IDs for scoping (owners see only their own)
        if (ownerId) {
            const props = await querySupabase('properties',
                `owner_id=eq.${ownerId}&select=id`);
            propertyIds = props.map(p => p.id);
        }

        // 4. Mint Supabase JWT with claims that RLS policies can read
        const claims = {
            sub: profile.id?.toString() || decoded.uid,
            email,
            role: 'authenticated',
            user_type: userType,
            owner_id: ownerId?.toString() || null,
            property_ids: propertyIds,
            // app_metadata for Supabase RLS compatibility
            app_metadata: {
                provider: 'firebase',
                owner_id: ownerId?.toString() || null,
                user_type: userType
            },
            user_metadata: {
                name: profile.name || '',
                email
            }
        };

        const expiresIn = 3600; // 1 hour
        const token = await mintSupabaseJWT(claims, expiresIn);

        // 5. Return token + profile
        return res.status(200).json({
            token,
            expiresIn,
            profile: {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                userType,
                ownerId,
                propertyIds,
                role: profile.role,
                isExternal: profile.is_external || false,
                status: profile.status || 'active'
            }
        });

    } catch (err) {
        console.error('[auth-exchange] Error:', err.message);

        if (err.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Firebase token expired' });
        }
        if (err.code === 'auth/argument-error') {
            return res.status(400).json({ error: 'Invalid Firebase token format' });
        }

        return res.status(500).json({ error: err.message });
    }
}
