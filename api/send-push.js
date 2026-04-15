/**
 * Vercel Serverless Function — Web Push subscribe/unsubscribe + send.
 *
 * Three modes, keyed by `action`:
 *
 *   POST { action: "vapid-public-key" }
 *     → Returns { publicKey } (no auth required — it's public).
 *
 *   POST { action: "subscribe", subscription, userAgent }
 *     Headers: Authorization: Bearer <firebase-id-token>
 *     → Upserts a row in push_subscriptions keyed to the caller's email.
 *
 *   POST { action: "unsubscribe", endpoint }
 *     Headers: Authorization: Bearer <firebase-id-token>
 *     → Deletes the row matching endpoint IF it belongs to the caller.
 *
 *   POST { action: "broadcast", title, body, url?, tag? }
 *     Headers: Authorization: Bearer <CRON_SECRET>
 *     → Sends the payload to every active subscription. Prunes invalid
 *       subscriptions (410 Gone / 404 Not Found) as it goes.
 *     → Returns { sent, pruned, failed, details }.
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:stay@hostizzy.com)
 *   FIREBASE_API_KEY
 *   CRON_SECRET
 */

import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:stay@hostizzy.com';
const CRON_SECRET = process.env.CRON_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const ALLOWED_ORIGINS = [
    'https://resiq.hostizzy.com',
    'http://localhost:3000',
    'http://localhost:8000'
];

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
            case 'vapid-public-key': {
                if (!VAPID_PUBLIC_KEY) {
                    return res.status(500).json({ error: 'VAPID keys not configured on server' });
                }
                return res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
            }

            case 'subscribe': {
                const authHeader = req.headers.authorization || '';
                const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
                if (!idToken) return res.status(401).json({ error: 'Missing Authorization' });
                const caller = await verifyFirebaseToken(idToken);
                if (!caller.email) return res.status(403).json({ error: 'No email claim' });

                const { subscription, userAgent } = req.body;
                if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
                    return res.status(400).json({ error: 'Invalid subscription payload' });
                }

                // Upsert by endpoint (unique). If same endpoint already
                // exists (re-subscription from the same browser), update
                // the keys and refresh last_used_at.
                const row = {
                    user_email: caller.email,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                    user_agent: userAgent || null,
                    last_used_at: new Date().toISOString()
                };
                await supabaseFetch('push_subscriptions?on_conflict=endpoint', {
                    method: 'POST',
                    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
                    body: JSON.stringify(row)
                });
                console.log(`[send-push] Subscribed: ${caller.email}`);
                return res.status(200).json({ ok: true });
            }

            case 'unsubscribe': {
                const authHeader = req.headers.authorization || '';
                const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
                if (!idToken) return res.status(401).json({ error: 'Missing Authorization' });
                const caller = await verifyFirebaseToken(idToken);
                if (!caller.email) return res.status(403).json({ error: 'No email claim' });

                const { endpoint } = req.body;
                if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
                await supabaseFetch(
                    `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_email=eq.${encodeURIComponent(caller.email)}`,
                    { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
                );
                return res.status(200).json({ ok: true });
            }

            case 'broadcast': {
                const authHeader = req.headers.authorization || '';
                if (authHeader !== `Bearer ${CRON_SECRET}`) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
                    return res.status(500).json({ error: 'VAPID keys not configured' });
                }

                const { title, body, url = '/app', tag = 'resiq-target', icon, badge, data = {} } = req.body;
                if (!title || !body) {
                    return res.status(400).json({ error: 'title + body required' });
                }

                const result = await broadcastToAllSubscribers({ title, body, url, tag, icon, badge, data });
                return res.status(200).json(result);
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error('[send-push] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Broadcast a payload to every active subscription.
 * Prunes rows that return 410 Gone / 404 Not Found.
 */
export async function broadcastToAllSubscribers({ title, body, url = '/app', tag = 'resiq', icon, badge, data = {} }) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return { error: 'VAPID not configured', sent: 0, pruned: 0, failed: 0 };
    }

    const subs = await supabaseFetch('push_subscriptions?select=id,endpoint,p256dh,auth,user_email');
    const payload = JSON.stringify({
        title, body, url, tag,
        icon: icon || '/assets/logo-192.png',
        badge: badge || '/assets/logo-96.png',
        data: { url, ...data }
    });

    const result = { sent: 0, pruned: 0, failed: 0, details: [] };
    const toPrune = [];

    for (const s of subs || []) {
        try {
            await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload
            );
            result.sent++;
        } catch (err) {
            const code = err.statusCode || 0;
            if (code === 404 || code === 410) {
                toPrune.push(s.id);
                result.pruned++;
                result.details.push({ email: s.user_email, status: 'pruned', code });
            } else {
                result.failed++;
                result.details.push({ email: s.user_email, status: 'failed', code, error: err.body || err.message });
            }
        }
    }

    // Prune expired subscriptions in a single DELETE
    if (toPrune.length > 0) {
        try {
            await supabaseFetch(
                `push_subscriptions?id=in.(${toPrune.join(',')})`,
                { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
            );
        } catch (err) {
            console.error('[send-push] Prune failed:', err.message);
        }
    }

    return result;
}
