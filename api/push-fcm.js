/**
 * Vercel Serverless Function — Mobile push (Firebase Cloud Messaging).
 *
 * The native Flutter app uses FCM device tokens (NOT Web Push / VAPID), so it
 * needs its own register + send path. This is the mobile twin of send-push.js.
 *
 * Modes, keyed by `action`:
 *
 *   POST { action: "register", token, platform?, deviceInfo? }
 *     Headers: Authorization: Bearer <firebase-id-token>
 *     → Upserts a row in fcm_tokens keyed to the caller's email (+ role).
 *
 *   POST { action: "unregister", token }
 *     Headers: Authorization: Bearer <firebase-id-token>
 *     → Deletes the row matching token IF it belongs to the caller.
 *
 *   POST { action: "broadcast", title, body, route?, data?, role? }
 *     Headers: Authorization: Bearer <CRON_SECRET>
 *     → Sends to every token (optionally filtered by role). Prunes
 *       unregistered/invalid tokens. Returns { sent, pruned, failed }.
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_API_KEY                 (for verifying caller ID tokens)
 *   FIREBASE_SERVICE_ACCOUNT_JSON    (service-account JSON, raw or base64) — for admin SDK
 *   CRON_SECRET
 */

import admin from 'firebase-admin';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const ALLOWED_ORIGINS = [
    'https://resiq.hostizzy.com',
    'http://localhost:3000',
    'http://localhost:8000'
];

// ---- Firebase Admin init (once per cold start) --------------------------

function getServiceAccount() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    // Accept either raw JSON or base64-encoded JSON.
    let txt = raw.trim();
    if (!txt.startsWith('{')) {
        try { txt = Buffer.from(txt, 'base64').toString('utf8'); } catch (_) { /* keep raw */ }
    }
    try {
        const obj = JSON.parse(txt);
        // Vercel env vars often escape newlines in the private key.
        if (obj.private_key) obj.private_key = obj.private_key.replace(/\\n/g, '\n');
        return obj;
    } catch (e) {
        console.error('[push-fcm] Bad FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
        return null;
    }
}

function ensureAdmin() {
    if (admin.apps.length) return admin.app();
    const sa = getServiceAccount();
    if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not configured');
    return admin.initializeApp({ credential: admin.credential.cert(sa) });
}

// ---- helpers ------------------------------------------------------------

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function verifyFirebaseToken(idToken) {
    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    if (!firebaseApiKey) throw new Error('Firebase API key not configured');
    const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        }
    );
    if (!resp.ok) throw new Error('Invalid Firebase token');
    const data = await resp.json();
    if (!data.users?.length) throw new Error('No user found');
    return { uid: data.users[0].localId, email: data.users[0].email };
}

async function supabaseFetch(path, options = {}) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!resp.ok && resp.status !== 204) {
        const err = await resp.text();
        throw new Error(`Supabase ${path}: ${err}`);
    }
    if (resp.status === 204) return null;
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
}

/**
 * Resolve the caller's role from team_members / property_owners (best-effort).
 */
async function resolveRole(email) {
    try {
        const staff = await supabaseFetch(
            `team_members?email=eq.${encodeURIComponent(email)}&select=email&limit=1`
        );
        if (staff?.length) return 'staff';
        const owner = await supabaseFetch(
            `property_owners?email=eq.${encodeURIComponent(email)}&select=email&limit=1`
        );
        if (owner?.length) return 'owner';
    } catch (_) { /* ignore */ }
    return null;
}

// ---- handler ------------------------------------------------------------

export default async function handler(req, res) {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body || {};
    if (!action) return res.status(400).json({ error: 'Missing action' });

    try {
        switch (action) {
            case 'register': {
                const authHeader = req.headers.authorization || '';
                const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
                if (!idToken) return res.status(401).json({ error: 'Missing Authorization' });
                const caller = await verifyFirebaseToken(idToken);
                if (!caller.email) return res.status(403).json({ error: 'No email claim' });

                const { token, platform, deviceInfo } = req.body;
                if (!token) return res.status(400).json({ error: 'Missing token' });

                const role = await resolveRole(caller.email);
                const row = {
                    token,
                    user_email: caller.email,
                    role,
                    platform: platform || 'android',
                    device_info: deviceInfo || null,
                    last_used_at: new Date().toISOString()
                };
                await supabaseFetch('fcm_tokens?on_conflict=token', {
                    method: 'POST',
                    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
                    body: JSON.stringify(row)
                });
                console.log(`[push-fcm] Registered: ${caller.email} (${role || 'unknown'})`);
                return res.status(200).json({ ok: true, role });
            }

            case 'unregister': {
                const authHeader = req.headers.authorization || '';
                const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
                if (!idToken) return res.status(401).json({ error: 'Missing Authorization' });
                const caller = await verifyFirebaseToken(idToken);
                if (!caller.email) return res.status(403).json({ error: 'No email claim' });

                const { token } = req.body;
                if (!token) return res.status(400).json({ error: 'Missing token' });
                await supabaseFetch(
                    `fcm_tokens?token=eq.${encodeURIComponent(token)}&user_email=eq.${encodeURIComponent(caller.email)}`,
                    { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
                );
                return res.status(200).json({ ok: true });
            }

            case 'broadcast': {
                const authHeader = req.headers.authorization || '';
                if (authHeader !== `Bearer ${CRON_SECRET}`) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                const { title, body, route = '/', data = {}, role = null } = req.body;
                if (!title || !body) {
                    return res.status(400).json({ error: 'title + body required' });
                }
                const result = await broadcastFcm({ title, body, route, data, role });
                return res.status(200).json(result);
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error('[push-fcm] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Send a notification to every FCM token (optionally filtered by role).
 * Prunes tokens FCM reports as unregistered/invalid. Safe to call from the
 * daily-summary cron. Returns { sent, pruned, failed }.
 */
export async function broadcastFcm({ title, body, route = '/', data = {}, role = null }) {
    let app;
    try {
        app = ensureAdmin();
    } catch (e) {
        return { error: e.message, sent: 0, pruned: 0, failed: 0 };
    }

    const filter = role ? `&role=eq.${encodeURIComponent(role)}` : '';
    const rows = await supabaseFetch(`fcm_tokens?select=id,token${filter}`);
    const tokens = (rows || []).map(r => r.token);
    if (!tokens.length) return { sent: 0, pruned: 0, failed: 0, note: 'no tokens' };

    // Data payload must be all-strings for FCM. Route lets the app deep-link.
    const stringData = { route, ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
    ) };

    const messaging = admin.messaging(app);
    const result = { sent: 0, pruned: 0, failed: 0 };
    const prune = [];

    // sendEachForMulticast caps at 500 tokens per call.
    for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const idsInBatch = (rows || []).slice(i, i + 500);
        const resp = await messaging.sendEachForMulticast({
            tokens: batch,
            notification: { title, body },
            data: stringData,
            android: {
                priority: 'high',
                notification: { channelId: 'resiq_default', sound: 'default' }
            },
            apns: { payload: { aps: { sound: 'default' } } }
        });
        resp.responses.forEach((r, idx) => {
            if (r.success) {
                result.sent++;
            } else {
                const code = r.error?.code || '';
                if (code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token' ||
                    code === 'messaging/invalid-argument') {
                    prune.push(idsInBatch[idx].id);
                    result.pruned++;
                } else {
                    result.failed++;
                }
            }
        });
    }

    if (prune.length) {
        try {
            await supabaseFetch(
                `fcm_tokens?id=in.(${prune.join(',')})`,
                { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
            );
        } catch (e) {
            console.error('[push-fcm] Prune failed:', e.message);
        }
    }

    return result;
}
