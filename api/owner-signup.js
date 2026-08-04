/**
 * Vercel Serverless Function — host self-signup.
 *
 *   POST { name, email, phone?, password }  →  { ownerId }
 *
 * Why this exists rather than the landing page writing through /api/db-proxy
 * ------------------------------------------------------------------------
 * Signup happens before anyone is logged in, so the write is unauthenticated
 * by necessity. db-proxy correctly refuses unauthenticated writes to
 * property_owners — if it didn't, anyone could POST a row with
 * `status: 'active'` and `is_active: true` and approve themselves, or set
 * `account_type: 'managed'` to appear as a Hostizzy-operated owner.
 *
 * So the account fields a signup may set are decided here, on the server. The
 * caller supplies identity only; status, activation and account type are not
 * theirs to choose.
 *
 * Creating the Firebase user and inserting the row also belong together. Doing
 * them as two calls from the browser meant a failure between them left an
 * orphaned Firebase account whose cleanup depended on the browser still being
 * around to ask for it.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_SERVICE_ACCOUNT   (JSON string of the service account key)
 */

let admin;
try {
    admin = require('firebase-admin');
} catch (e) {
    admin = null;
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
    'https://resiq.hostizzy.com',
    'http://localhost:3000',
    'http://localhost:8000',
];

function setCors(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function initFirebaseAdmin() {
    if (!admin) throw new Error('firebase-admin package not available');
    if (admin.apps.length > 0) return admin.apps[0];
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
    return admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
}

async function sb(path, init = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    if (r.status === 204) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
}

// Deliberately permissive — the approval step is the real check on whether an
// address is usable, and over-strict client-side patterns reject valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Validate before touching config so a malformed request gets a 400 rather
    // than a 500 that blames the server for the caller's input.
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim() || null;
    const password = String(body.password || '');

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'That email address does not look right.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (name.length > 120 || email.length > 200) {
        return res.status(400).json({ error: 'Name or email is too long.' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase not configured' });
    }
    try {
        initFirebaseAdmin();
    } catch (e) {
        console.error('[owner-signup] Firebase Admin init failed:', e.message);
        return res.status(500).json({ error: 'Signup is temporarily unavailable.' });
    }

    const q = `email=eq.${encodeURIComponent(email)}&select=id&limit=1`;

    try {
        // Check both tables before touching Firebase. A staff member or an
        // existing owner signing up here would end up with a second identity
        // and split data, so it's a clearer error than a Firebase collision.
        const [existingOwner, existingStaff] = await Promise.all([
            sb(`property_owners?${q}`),
            sb(`team_members?${q}`),
        ]);
        if (existingOwner?.length || existingStaff?.length) {
            return res.status(409).json({
                error: 'An account already exists for this email. Try signing in instead.',
            });
        }
    } catch (e) {
        console.error('[owner-signup] Lookup failed:', e.message);
        return res.status(500).json({ error: 'Could not check for an existing account.' });
    }

    // ── Create the Firebase identity ──
    let uid = null;
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            emailVerified: false,
        });
        uid = userRecord.uid;
    } catch (e) {
        if (e.code === 'auth/email-already-exists') {
            return res.status(409).json({
                error: 'An account already exists for this email. Try signing in instead.',
            });
        }
        if (e.code === 'auth/invalid-password') {
            return res.status(400).json({ error: 'Password must be at least 8 characters.' });
        }
        console.error('[owner-signup] Firebase createUser failed:', e.message);
        return res.status(500).json({ error: 'Could not create the account. Please try again.' });
    }

    // ── Insert the pending host row ──
    // Everything except name/email/phone is set here, not by the caller.
    try {
        const rows = await sb('property_owners', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify([{
                name,
                email,
                phone,
                password: 'firebase-managed',
                is_active: false,
                status: 'pending',
                // Only is_external is written. account_type is derived from it
                // by trg_sync_account_type, so this insert works both before
                // and after sql/account-type-and-host-profiles.sql is applied —
                // writing account_type directly would fail with "column does
                // not exist" until then.
                is_external: true,
            }]),
        });
        const ownerId = Array.isArray(rows) ? rows[0]?.id : rows?.id;
        if (!ownerId) throw new Error('Insert returned no id');
        return res.status(200).json({ ownerId });
    } catch (e) {
        // The row is what makes the account real. Without it the Firebase user
        // is an orphan that would block a retry with the same address, so undo it.
        console.error('[owner-signup] Insert failed, rolling back Firebase user:', e.message);
        try {
            await admin.auth().deleteUser(uid);
        } catch (delErr) {
            console.error('[owner-signup] Rollback failed — orphaned uid:', uid, delErr.message);
        }
        return res.status(500).json({ error: 'Could not complete signup. Please try again.' });
    }
};
