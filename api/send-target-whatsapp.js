/**
 * Vercel Serverless Function — Manual Target WhatsApp Broadcast
 *
 * Invoked by the "Send WA Update Now" button on the staff Dashboard
 * target card. Only admins can call it successfully.
 *
 * Flow:
 *   1. Verify caller's Firebase ID token.
 *   2. Look up caller in team_members → must be role='admin' AND is_active.
 *   3. Load revenue_targets + current-month reservations + active team members.
 *   4. Compute MTD + tier progress.
 *   5. Dispatch approved WA template to every active team member with a phone.
 *   6. Return { sent, skipped, failed, details, progress }.
 *
 * Env vars (all required):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_API_KEY
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_PHONE_ID
 *   WA_DAILY_TARGET_TEMPLATE   — name of the approved Meta template
 * Optional:
 *   WA_DAILY_TARGET_LANGUAGE   — defaults to 'en'
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API_VERSION = 'v21.0';
const WA_DAILY_TARGET_TEMPLATE = process.env.WA_DAILY_TARGET_TEMPLATE || null;
const WA_DAILY_TARGET_LANGUAGE = process.env.WA_DAILY_TARGET_LANGUAGE || 'en';

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

/**
 * Verify Firebase ID token → returns { uid, email } or throws.
 */
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
    const u = data.users[0];
    return { uid: u.localId, email: u.email };
}

async function querySupabase(table, params = '') {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Supabase query failed (${table}): ${err}`);
    }
    return resp.json();
}

// ---- shared with api/daily-summary.js (kept in sync manually; see plan) ----

function computeTargetProgress(reservations, targets, now = new Date()) {
    const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
    const ist = new Date(istMs);
    const year = ist.getUTCFullYear();
    const month = ist.getUTCMonth();
    const dayOfMonth = ist.getUTCDate();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const daysRemaining = Math.max(daysInMonth - dayOfMonth, 0);

    const monthRevenue = (reservations || [])
        .filter(r => r.status !== 'cancelled')
        .filter(r => {
            if (!r.check_in) return false;
            const d = new Date(r.check_in);
            const dIst = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
            return dIst.getUTCFullYear() === year && dIst.getUTCMonth() === month;
        })
        .reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

    const tierAmounts = [targets.tier_1, targets.tier_2, targets.tier_3].map(Number);
    const tiers = tierAmounts.map((target, i) => {
        const expectedByToday = (target * dayOfMonth) / daysInMonth;
        const gap = Math.max(target - monthRevenue, 0);
        const dailyPaceNeeded = daysRemaining > 0 ? gap / daysRemaining : gap;
        const percentAchieved = target > 0 ? (monthRevenue / target) * 100 : 0;
        return {
            label: `Tier ${i + 1}`,
            target, achieved: monthRevenue, percentAchieved,
            expectedByToday, onPace: monthRevenue >= expectedByToday,
            gap, dailyPaceNeeded
        };
    });

    return { dayOfMonth, daysInMonth, daysRemaining, monthRevenue, tiers };
}

function formatShortInr(amount) {
    const n = Number(amount) || 0;
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    return '₹' + Math.round(n).toLocaleString('en-IN');
}

function normalisePhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/[^\d]/g, '');
    if (digits.length === 10) digits = '91' + digits;
    if (digits.length < 11 || digits.length > 15) return null;
    return digits;
}

function buildTargetWaComponents(progress) {
    const { dayOfMonth, daysInMonth, monthRevenue, tiers } = progress;
    return [{
        type: 'body',
        parameters: [
            { type: 'text', text: String(dayOfMonth) },
            { type: 'text', text: String(daysInMonth) },
            { type: 'text', text: formatShortInr(monthRevenue) },
            { type: 'text', text: tiers[0].percentAchieved.toFixed(1) },
            { type: 'text', text: tiers[1].percentAchieved.toFixed(1) },
            { type: 'text', text: tiers[2].percentAchieved.toFixed(1) },
            { type: 'text', text: formatShortInr(tiers[0].dailyPaceNeeded) }
        ]
    }];
}

async function sendWaTemplate(toPhone, templateName, languageCode, components) {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_ID}/messages`;
    const body = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            components
        }
    };
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok) {
        const msg = data?.error?.message || `HTTP ${resp.status}`;
        return { ok: false, error: msg };
    }
    return { ok: true, msgId: data?.messages?.[0]?.id || null };
}

// ---------------------------------------------------------------------------

export default async function handler(req, res) {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Auth: Firebase ID token
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Missing Authorization header' });

    let caller;
    try {
        caller = await verifyFirebaseToken(idToken);
    } catch (err) {
        return res.status(401).json({ error: err.message });
    }

    // 2. Admin gate — match caller's email against team_members
    if (!caller.email) {
        return res.status(403).json({ error: 'Caller has no email claim' });
    }
    try {
        const members = await querySupabase(
            'team_members',
            `email=eq.${encodeURIComponent(caller.email)}&select=id,role,is_active`
        );
        const me = members?.[0];
        if (!me || !me.is_active || me.role !== 'admin') {
            return res.status(403).json({ error: 'Admin role required' });
        }
    } catch (err) {
        return res.status(500).json({ error: `Admin check failed: ${err.message}` });
    }

    // 3. Pre-flight env checks
    if (!WA_DAILY_TARGET_TEMPLATE) {
        return res.status(500).json({ error: 'WA_DAILY_TARGET_TEMPLATE env var not set. Configure an approved WhatsApp template first.' });
    }
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_ID) {
        return res.status(500).json({ error: 'WhatsApp credentials not configured on the server.' });
    }

    try {
        // 4. Load data
        const now = new Date();
        const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
        const year = ist.getUTCFullYear();
        const month = ist.getUTCMonth();
        const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const nextMonthStart = month === 11
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 2).padStart(2, '0')}-01`;

        const [targetRows, monthReservations, teamMembers] = await Promise.all([
            querySupabase('revenue_targets', 'id=eq.1&select=tier_1,tier_2,tier_3'),
            querySupabase('reservations',
                `check_in=gte.${monthStart}&check_in=lt.${nextMonthStart}&status=not.in.(cancelled)&select=total_amount,status,check_in`
            ),
            querySupabase('team_members', 'is_active=eq.true&select=id,name,phone,role')
        ]);

        const targets = targetRows?.[0] || { tier_1: 4000000, tier_2: 5000000, tier_3: 6000000 };
        const progress = computeTargetProgress(monthReservations, targets, now);
        const components = buildTargetWaComponents(progress);

        // 5. Broadcast
        const result = { sent: 0, skipped: 0, failed: 0, details: [] };
        for (const m of teamMembers) {
            const phone = normalisePhone(m.phone);
            if (!phone) {
                result.skipped++;
                result.details.push({ name: m.name, status: 'skipped', reason: 'no-phone' });
                continue;
            }
            try {
                const r = await sendWaTemplate(phone, WA_DAILY_TARGET_TEMPLATE, WA_DAILY_TARGET_LANGUAGE, components);
                if (r.ok) {
                    result.sent++;
                    result.details.push({ name: m.name, status: 'sent', msgId: r.msgId });
                } else {
                    result.failed++;
                    result.details.push({ name: m.name, status: 'failed', error: r.error });
                }
            } catch (err) {
                result.failed++;
                result.details.push({ name: m.name, status: 'failed', error: err.message });
            }
        }

        console.log(`[send-target-wa] by ${caller.email} — sent: ${result.sent}, skipped: ${result.skipped}, failed: ${result.failed}`);
        return res.status(200).json({
            ...result,
            progress: {
                dayOfMonth: progress.dayOfMonth,
                daysInMonth: progress.daysInMonth,
                monthRevenue: progress.monthRevenue,
                tierPercents: progress.tiers.map(t => t.percentAchieved)
            }
        });
    } catch (err) {
        console.error('[send-target-wa] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
