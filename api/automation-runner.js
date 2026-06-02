/**
 * Vercel Cron Function — Automation Runner
 *
 * Runs hourly. For each owner that has the relevant template toggles
 * enabled, dispatch the matching template at the right time relative to
 * each reservation. Idempotent via the automation_dispatch_log table.
 *
 * Rules:
 *   - booking_confirmation:   on new reservation (created_at within last 1h)
 *   - check_in_instructions:  ~24h before check_in
 *   - payment_reminder:       if balance > 0 and check_in within next 48h
 *   - thank_you:              ~3h after check_out
 *
 * Each rule is gated by:
 *   1. The owner's emailTemplate*Boolean toggle in business_settings
 *   2. The dispatch log (no duplicate sends)
 *   3. Guest email present (no email -> skip)
 *
 * Auth: Vercel Cron sets Authorization: Bearer <CRON_SECRET>.
 */

import {
    getGmailTokenByEmail,
    getFirstGmailToken,
    ensureTokenFresh,
    sendEmail
} from './gmail-helpers.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DAILY_SUMMARY_FROM_EMAIL = process.env.DAILY_SUMMARY_FROM_EMAIL;

// Rule key -> { toggle setting, scheduling fn }
// A scheduling fn returns true when the reservation is due for the rule.
const RULES = {
    booking_confirmation: {
        toggle: 'emailTemplateBookingConfirm',
        subject: r => `Booking Confirmed — ${r.property_name || 'Your stay'}`,
        body: renderBookingConfirmationBody,
        due: r => {
            // Within 1 hour of being created
            if (!r.created_at) return false;
            const ageMs = Date.now() - new Date(r.created_at).getTime();
            return ageMs >= 0 && ageMs <= 75 * 60 * 1000; // 75 min window
        }
    },
    check_in_instructions: {
        toggle: 'emailTemplateCheckinInstructions',
        subject: r => `Check-in Details — ${r.property_name || 'Your stay'}`,
        body: renderCheckInBody,
        due: r => {
            // Window: 23–25 hours before check_in
            if (!r.check_in) return false;
            const checkInMs = new Date(r.check_in + 'T14:00:00+05:30').getTime();
            const hoursAway = (checkInMs - Date.now()) / (60 * 60 * 1000);
            return hoursAway >= 23 && hoursAway <= 25;
        }
    },
    payment_reminder: {
        toggle: 'emailTemplatePaymentReminder',
        subject: r => `Payment Reminder — ${r.property_name || 'Your stay'}`,
        body: renderPaymentReminderBody,
        due: r => {
            // Balance > 0 AND check_in within next 48h
            const balance = (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0);
            if (balance <= 0) return false;
            if (!r.check_in) return false;
            const checkInMs = new Date(r.check_in + 'T14:00:00+05:30').getTime();
            const hoursAway = (checkInMs - Date.now()) / (60 * 60 * 1000);
            return hoursAway > 0 && hoursAway <= 48;
        }
    },
    thank_you: {
        toggle: 'emailTemplateThankYou',
        subject: r => `Thank you for staying with us!`,
        body: renderThankYouBody,
        due: r => {
            // 2–4 hours after check_out
            if (!r.check_out) return false;
            const checkOutMs = new Date(r.check_out + 'T11:00:00+05:30').getTime();
            const hoursPast = (Date.now() - checkOutMs) / (60 * 60 * 1000);
            return hoursPast >= 2 && hoursPast <= 4;
        }
    }
};

async function sb(path, init = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const r = await fetch(url, {
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
        throw new Error(`Supabase ${path}: ${r.status} ${text}`);
    }
    if (r.status === 204) return null;
    return r.json();
}

function formatINR(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

/**
 * Shared HTML wrapper for every automation email. Each rule supplies
 * just the headline and body fragment; the wrapper handles styling,
 * greeting, and sign-off so a copy change in one place propagates
 * to all four templates.
 */
function renderAutomationEmail({ guestName, businessName, headline, body }) {
    return `
<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;margin:0;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
<h1 style="margin:0 0 16px 0;font-size:22px;color:#0f172a;">${headline}</h1>
<p>Dear ${guestName || 'Guest'},</p>
${body}
<p style="margin-top:24px;color:#64748b;font-size:13px;">— ${businessName}</p>
</div></body></html>`.trim();
}

function renderBookingConfirmationBody(r, businessName) {
    return renderAutomationEmail({
        guestName: r.guest_name, businessName,
        headline: 'Booking confirmed 🎉',
        body: `<p>We're delighted to confirm your booking.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
  <tr><td style="padding:6px 0;color:#64748b;">Property</td><td style="padding:6px 0;font-weight:600;">${r.property_name || '-'}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Check-in</td><td style="padding:6px 0;font-weight:600;">${r.check_in || '-'}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Check-out</td><td style="padding:6px 0;font-weight:600;">${r.check_out || '-'}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Total</td><td style="padding:6px 0;font-weight:700;">${formatINR(r.total_amount)}</td></tr>
</table>
<p>We look forward to hosting you.</p>`
    });
}

function renderCheckInBody(r, businessName) {
    return renderAutomationEmail({
        guestName: r.guest_name, businessName,
        headline: 'See you tomorrow! 👋',
        body: `<p>Your check-in at <strong>${r.property_name || 'our property'}</strong> is tomorrow.</p>
<p>Check-in time: <strong>2:00 PM</strong></p>
<p>We'll share exact directions and access details closer to your arrival. If you need anything before then, just reply to this email.</p>`
    });
}

function renderPaymentReminderBody(r, businessName) {
    const balance = (Number(r.total_amount) || 0) - (Number(r.paid_amount) || 0);
    return renderAutomationEmail({
        guestName: r.guest_name, businessName,
        headline: 'A quick payment reminder',
        body: `<p>Your stay at <strong>${r.property_name || 'our property'}</strong> is coming up on <strong>${r.check_in}</strong>. We noticed a pending balance on your booking.</p>
<div style="background:#fff7ed;border-left:3px solid #d97706;padding:12px 16px;border-radius:6px;margin:16px 0;">
  <div style="color:#92400e;font-size:13px;">Outstanding balance</div>
  <div style="color:#0f172a;font-size:20px;font-weight:700;">${formatINR(balance)}</div>
</div>
<p>If you've already paid, please ignore this. Otherwise, kindly settle before check-in.</p>`
    });
}

function renderThankYouBody(r, businessName) {
    return renderAutomationEmail({
        guestName: r.guest_name, businessName,
        headline: 'Thank you for staying! 🙏',
        body: `<p>We hope you had a wonderful stay at <strong>${r.property_name || 'our property'}</strong>. It was our pleasure hosting you.</p>
<p>We'd love to welcome you back any time. If you have a moment, a quick review would mean a lot to us.</p>`
    });
}

/**
 * Load the full dispatch log into a Set so the cron can check every
 * (booking_id, rule_key) combination in O(1) — instead of firing a
 * separate Supabase query per pair (would be 60+ round-trips per run).
 */
async function loadDispatchSet(bookingIds) {
    if (!bookingIds || bookingIds.length === 0) return new Set();
    // Chunk the IN() filter so a long URL doesn't blow up the PostgREST gateway.
    const chunks = [];
    for (let i = 0; i < bookingIds.length; i += 200) {
        chunks.push(bookingIds.slice(i, i + 200));
    }
    const set = new Set();
    for (const ids of chunks) {
        const inList = ids.map(b => `"${encodeURIComponent(b)}"`).join(',');
        const rows = await sb(
            `automation_dispatch_log?booking_id=in.(${inList})&select=booking_id,rule_key`
        );
        for (const row of (rows || [])) {
            set.add(`${row.booking_id}|${row.rule_key}`);
        }
    }
    return set;
}

async function recordDispatch({ bookingId, ruleKey, channel, recipient, status, error, ownerId }) {
    await sb('automation_dispatch_log', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            booking_id: bookingId,
            rule_key: ruleKey,
            channel,
            recipient,
            status,
            error: error || null,
            owner_id: ownerId || null
        })
    }).catch(e => console.warn('[automation] log insert failed:', e.message));
}

/** Load business settings for a given owner_id (null = global defaults). */
async function loadOwnerSettings(ownerId) {
    const filter = ownerId ? `owner_id=eq.${ownerId}` : 'owner_id=is.null';
    const rows = await sb(`business_settings?${filter}&select=key,value`).catch(() => []);
    const map = {};
    for (const row of (rows || [])) map[row.key] = row.value;
    return map;
}

/** True if the owner has the rule enabled, OR the rule defaults to on
    and there's no explicit "off" setting. */
function ruleEnabled(rule, settings) {
    const v = settings[rule.toggle];
    if (v === undefined || v === null) {
        // Defaults: confirm + check-in + thank_you ON, reminders OFF
        return ['booking_confirmation', 'check_in_instructions', 'thank_you'].includes(rule.key);
    }
    // settings store JSON-stringifies booleans -> 'true' / 'false', and
    // upserts via setMany also pass raw booleans. Accept both forms.
    return v === true || v === 'true' || String(v).toLowerCase() === 'true';
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        // 1. Get Gmail token (same logic as daily-summary)
        let tokenRecord = null;
        if (DAILY_SUMMARY_FROM_EMAIL) {
            tokenRecord = await getGmailTokenByEmail(DAILY_SUMMARY_FROM_EMAIL);
        }
        if (!tokenRecord) tokenRecord = await getFirstGmailToken();
        if (!tokenRecord) {
            return res.status(200).json({ message: 'No Gmail connected, skipping' });
        }
        const accessToken = await ensureTokenFresh(tokenRecord);
        const fromEmail = DAILY_SUMMARY_FROM_EMAIL || tokenRecord.gmail_email;

        // 2. Pull active reservations in a relevant window — anything that
        //    might be due for any rule in the next/previous few hours.
        const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const windowEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const reservations = await sb(
            `reservations?check_in=gte.${windowStart}&check_in=lte.${windowEnd}&status=not.in.(cancelled)&select=booking_id,guest_name,guest_email,property_name,owner_id,total_amount,paid_amount,check_in,check_out,created_at`
        );

        // Also include recently-created reservations (for booking_confirmation)
        // even if their check_in falls outside the window.
        const newReservations = await sb(
            `reservations?created_at=gte.${new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}&status=not.in.(cancelled)&select=booking_id,guest_name,guest_email,property_name,owner_id,total_amount,paid_amount,check_in,check_out,created_at`
        );

        // Dedupe by booking_id (a reservation may match both queries)
        const byId = new Map();
        for (const r of [...(reservations || []), ...(newReservations || [])]) {
            if (!r.booking_id) continue;
            byId.set(r.booking_id, r);
        }
        const all = [...byId.values()];

        // Load the dispatch log in one query — checking O(1) per pair below.
        const dispatchSet = await loadDispatchSet(all.map(r => r.booking_id));

        // 3. Group settings cache by owner_id so we hit the table once per owner
        const settingsCache = new Map();
        async function getSettings(ownerId) {
            const key = ownerId || '__global__';
            if (!settingsCache.has(key)) {
                settingsCache.set(key, await loadOwnerSettings(ownerId));
            }
            return settingsCache.get(key);
        }

        const summary = { dispatched: 0, skipped: 0, failed: 0, details: [] };

        // Attach key to each rule for ruleEnabled defaults check
        for (const [key, rule] of Object.entries(RULES)) rule.key = key;

        for (const r of all) {
            const settings = await getSettings(r.owner_id);
            const businessName = settings.businessName || 'ResIQ';

            for (const [ruleKey, rule] of Object.entries(RULES)) {
                if (!ruleEnabled(rule, settings)) continue;
                if (!rule.due(r)) continue;
                if (!r.guest_email) {
                    summary.skipped++;
                    continue;
                }
                if (dispatchSet.has(`${r.booking_id}|${ruleKey}`)) {
                    summary.skipped++;
                    continue;
                }

                try {
                    await sendEmail(accessToken, {
                        to: r.guest_email,
                        toName: r.guest_name || '',
                        subject: rule.subject(r),
                        body: rule.body(r, businessName),
                        fromEmail,
                        businessName
                    });
                    await recordDispatch({
                        bookingId: r.booking_id,
                        ruleKey,
                        channel: 'email',
                        recipient: r.guest_email,
                        status: 'sent',
                        ownerId: r.owner_id
                    });
                    dispatchSet.add(`${r.booking_id}|${ruleKey}`);
                    summary.dispatched++;
                    summary.details.push({ booking: r.booking_id, rule: ruleKey, to: r.guest_email });
                } catch (err) {
                    await recordDispatch({
                        bookingId: r.booking_id,
                        ruleKey,
                        channel: 'email',
                        recipient: r.guest_email,
                        status: 'failed',
                        error: err.message,
                        ownerId: r.owner_id
                    });
                    summary.failed++;
                    console.error(`[automation] ${ruleKey} failed for ${r.booking_id}:`, err.message);
                }
            }
        }

        console.log(`[automation] dispatched=${summary.dispatched} skipped=${summary.skipped} failed=${summary.failed}`);
        return res.status(200).json(summary);
    } catch (err) {
        console.error('[automation] error:', err);
        return res.status(500).json({ error: err.message });
    }
}
