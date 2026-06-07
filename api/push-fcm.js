/**
 * Vercel Serverless Function — FCM Push Notifications
 *
 * Actions:
 *   POST { action: "register", token, platform }  — save FCM token
 *   POST { action: "send", title, body, tokens?, topic?, data }  — send push
 *
 * Auth: Firebase ID token required for register. Cron secret for send.
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_API_KEY (for token verification)
 *   FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON (Admin SDK)
 */

import admin from 'firebase-admin';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
    'https://resiq.hostizzy.com',
    'http://localhost:3000',
    'http://localhost:8000'
];

// Initialize Firebase Admin (idempotent — shared with auth-exchange)
if (!admin.apps.length) {
    try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT
            || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            || '';
        if (raw) {
            let json = raw;
            if (!raw.startsWith('{')) {
                json = Buffer.from(raw, 'base64').toString('utf-8');
            }
            const sa = JSON.parse(json);
            if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
            admin.initializeApp({ credential: admin.credential.cert(sa) });
        }
    } catch (e) {
        console.error('[push-fcm] Firebase Admin init failed:', e.message);
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

async function verifyFirebaseToken(idToken) {
    const key = process.env.FIREBASE_API_KEY;
    if (!key) throw new Error('Firebase API key not configured');
    const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    if (!r.ok) throw new Error('Invalid Firebase token');
    const d = await r.json();
    if (!d.users || !d.users.length) throw new Error('No user found');
    return { uid: d.users[0].localId, email: d.users[0].email };
}

async function sb(path, init = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            ...(init.headers || {})
        }
    });
    if (!r.ok) {
        const text = await r.text();
        throw new Error(`Supabase error: ${r.status} ${text}`);
    }
    if (r.status === 204) return null;
    return r.json();
}

export default async function handler(req, res) {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body || {};

    try {
        if (action === 'register') {
            // ── Register FCM token ──
            const auth = req.headers.authorization || '';
            const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
            if (!idToken) return res.status(401).json({ error: 'Missing auth token' });

            const caller = await verifyFirebaseToken(idToken);
            const { token, platform = 'android' } = req.body;
            if (!token) return res.status(400).json({ error: 'Missing FCM token' });

            await sb('fcm_tokens', {
                method: 'POST',
                headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
                body: JSON.stringify({
                    token,
                    user_email: caller.email,
                    platform,
                    updated_at: new Date().toISOString()
                })
            });

            return res.status(200).json({ registered: true });

        } else if (action === 'send') {
            // ── Send push notification ──
            // Only cron or admin can send
            const cronSecret = process.env.CRON_SECRET;
            const auth = req.headers.authorization || '';

            let authorized = false;
            if (cronSecret && auth === `Bearer ${cronSecret}`) {
                authorized = true;
            } else {
                // Check if caller is admin
                const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
                if (idToken) {
                    try {
                        const caller = await verifyFirebaseToken(idToken);
                        const staff = await sb(
                            `team_members?email=eq.${encodeURIComponent(caller.email)}&role=eq.admin&is_active=eq.true&select=id&limit=1`
                        );
                        if (staff && staff.length > 0) authorized = true;
                    } catch (_) {}
                }
            }

            if (!authorized) {
                return res.status(403).json({ error: 'Not authorized to send push' });
            }

            if (!admin.apps.length) {
                return res.status(500).json({ error: 'Firebase Admin not initialized — set FIREBASE_SERVICE_ACCOUNT' });
            }

            const { title, body, tokens, topic, data = {} } = req.body;
            if (!title) return res.status(400).json({ error: 'Missing title' });

            const message = {
                notification: { title, body: body || '' },
                data: Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k, String(v)])
                ),
            };

            let result;

            if (topic) {
                // Send to topic
                result = await admin.messaging().send({ ...message, topic });
            } else if (tokens && tokens.length > 0) {
                // Send to specific tokens
                result = await admin.messaging().sendEachForMulticast({
                    ...message,
                    tokens
                });
            } else {
                // Send to all registered tokens
                const allTokens = await sb('fcm_tokens?select=token');
                if (!allTokens || allTokens.length === 0) {
                    return res.status(200).json({ sent: 0, message: 'No registered tokens' });
                }
                const tokenList = allTokens.map(t => t.token);
                result = await admin.messaging().sendEachForMulticast({
                    ...message,
                    tokens: tokenList
                });
            }

            // Clean up stale tokens
            if (result && result.responses) {
                const stale = [];
                result.responses.forEach((r, i) => {
                    if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
                        const t = (tokens || [])[i];
                        if (t) stale.push(t);
                    }
                });
                if (stale.length > 0) {
                    for (const t of stale) {
                        await sb(`fcm_tokens?token=eq.${encodeURIComponent(t)}`, { method: 'DELETE' })
                            .catch(() => {});
                    }
                }
            }

            return res.status(200).json({
                sent: result?.successCount || (result ? 1 : 0),
                failed: result?.failureCount || 0
            });

        } else {
            return res.status(400).json({ error: 'Unknown action' });
        }
    } catch (err) {
        console.error('[push-fcm] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
