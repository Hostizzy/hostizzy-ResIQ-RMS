/**
 * Vercel Serverless Function — signup and approval notifications.
 *
 *   POST { action: "signup",   ownerId }   → tells the Hostizzy team someone signed up
 *   POST { action: "approved", ownerId }   → tells the owner their account is live
 *
 * Sends through the same Gmail path as daily-summary.js, so there's one email
 * transport rather than a second one to configure and keep working.
 *
 * Why the caller can't choose the recipient or the body
 * ----------------------------------------------------
 * "signup" is triggered from the public landing page, before anyone is logged
 * in. If it accepted an address or message it would be an open relay wearing our
 * domain. So the caller passes only an owner id; the recipient and every word of
 * the email come from the database and from env.
 *
 * "approved" is an admin action and does require a Firebase token.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_API_KEY                 (verifying the admin on 'approved')
 *   SIGNUP_NOTIFY_EMAIL              (optional — who hears about signups.
 *                                     Defaults to DAILY_SUMMARY_EMAIL, so with
 *                                     no config it goes to the same inbox as
 *                                     the daily summary.)
 *   DAILY_SUMMARY_FROM_EMAIL         (optional — which connected Gmail sends)
 *   APP_URL                          (optional — links in the emails)
 */

import {
    getFirstGmailToken,
    getGmailTokenByEmail,
    ensureTokenFresh,
    sendEmail,
} from './gmail-helpers.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Defaults to whoever already receives the daily summary, so signup alerts
// land in the inbox the team is reading anyway and nothing extra needs setting.
// STAY_EMAIL_RECIPIENT is only a further fallback — it's the revenue-target
// address, which is a different audience.
const NOTIFY_TO = process.env.SIGNUP_NOTIFY_EMAIL
    || process.env.DAILY_SUMMARY_EMAIL
    || process.env.STAY_EMAIL_RECIPIENT
    || 'support@hostizzy.com';
const FROM_EMAIL = process.env.DAILY_SUMMARY_FROM_EMAIL;
const APP_URL = process.env.APP_URL || 'https://resiq.hostizzy.com';

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

async function verifyFirebaseToken(idToken) {
    const key = process.env.FIREBASE_API_KEY;
    if (!key) throw new Error('Firebase API key not configured');
    const r = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        }
    );
    if (!r.ok) throw new Error('Invalid Firebase token');
    const d = await r.json();
    if (!d.users?.length) throw new Error('No user found');
    return d.users[0].email;
}

const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Shared wrapper so both emails look like they came from the same product. */
function shell(heading, bodyHtml) {
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f9fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe7ee;border-radius:14px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:#0A1826;padding:18px 26px;">
      <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-.02em;">ResIQ</span>
      <span style="color:rgba(233,241,247,.55);font-size:12px;"> &nbsp;by Hostizzy</span>
    </td></tr>
    <tr><td style="padding:28px 26px 8px;">
      <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#0A1826;">${heading}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:18px 26px 26px;border-top:1px solid #eef2f6;">
      <p style="margin:0;font-size:12px;color:#8A9CAD;">
        ResIQ by Hostizzy &middot; Hostsphere India Private Limited<br>
        Questions? Just reply to this email.
      </p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function signupEmail(o) {
    const rows = [
        ['Name', o.name],
        ['Email', o.email],
        ['Phone', o.phone || '—'],
        ['Signed up', new Date(o.created_at || Date.now())
            .toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })],
    ].map(([k, v]) => `
        <tr>
          <td style="padding:7px 0;font-size:13px;color:#5A7186;width:96px;">${k}</td>
          <td style="padding:7px 0;font-size:14px;color:#0A1826;font-weight:600;">${esc(v)}</td>
        </tr>`).join('');

    return {
        subject: `New ResIQ signup — ${o.name || o.email}`,
        html: shell('A new host signed up', `
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#2C4257;">
              They can't sign in until someone approves them.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="border:1px solid #eef2f6;border-radius:10px;padding:6px 14px;margin-bottom:22px;">
              ${rows}
            </table>
            <a href="${APP_URL}/app" style="display:inline-block;background:#F0932B;color:#0A1826;
               font-weight:700;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:9px;">
              Review in ResIQ
            </a>`),
    };
}

function approvedEmail(o) {
    const first = String(o.name || '').trim().split(/\s+/)[0] || 'there';
    return {
        subject: 'Your ResIQ account is ready',
        html: shell(`You're in, ${esc(first)}`, `
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2C4257;">
              Your ResIQ account has been approved. Sign in with
              <strong>${esc(o.email)}</strong> and the password you chose at signup.
            </p>
            <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#2C4257;">
              Start by adding your property. If you rent out individual rooms, you can
              set those up too — and if you list on Airbnb or Booking.com, connect the
              calendar so bookings come in on their own.
            </p>
            <a href="${APP_URL}/app" style="display:inline-block;background:#F0932B;color:#0A1826;
               font-weight:700;font-size:14px;text-decoration:none;padding:12px 20px;border-radius:9px;">
              Sign in to ResIQ
            </a>
            <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#5A7186;">
              On your phone? The Android app is on
              <a href="https://play.google.com/store/apps/details?id=com.hostizzy.resiq"
                 style="color:#B96A12;">Google Play</a>.
            </p>`),
    };
}

async function deliver({ to, toName, subject, html }) {
    let tokenRecord = FROM_EMAIL ? await getGmailTokenByEmail(FROM_EMAIL) : null;
    if (!tokenRecord) tokenRecord = await getFirstGmailToken();
    if (!tokenRecord) {
        // No Gmail connected. Not fatal — signup itself already succeeded, and
        // failing the request here would make it look like signup broke.
        console.warn('[owner-notify] No Gmail token — cannot send');
        return { sent: false, reason: 'no-gmail-connected' };
    }
    const accessToken = await ensureTokenFresh(tokenRecord);
    await sendEmail(accessToken, {
        to,
        toName,
        subject,
        body: html,
        fromEmail: FROM_EMAIL || tokenRecord.gmail_email,
        businessName: 'ResIQ by Hostizzy',
    });
    return { sent: true };
}

export default async function handler(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, ownerId } = req.body || {};
    if (!action || !ownerId) return res.status(400).json({ error: 'action and ownerId required' });

    try {
        const rows = await sb(
            `property_owners?id=eq.${encodeURIComponent(ownerId)}` +
            `&select=id,name,email,phone,status,created_at,signup_notified_at,approved_notified_at&limit=1`
        );
        const owner = rows?.[0];
        if (!owner) return res.status(404).json({ error: 'Owner not found' });

        if (action === 'signup') {
            // Unauthenticated by necessity — the user isn't logged in yet. The
            // notified address and the entire body come from env and the DB, so
            // the only thing a caller can influence is *whether* a mail about a
            // genuinely-pending signup goes out.
            if (owner.status !== 'pending') {
                return res.status(200).json({ sent: false, reason: 'not-pending' });
            }
            // Send once. Without this, replaying the request would let someone
            // flood the inbox with real-looking notifications.
            if (owner.signup_notified_at) {
                return res.status(200).json({ sent: false, reason: 'already-notified' });
            }

            const { subject, html } = signupEmail(owner);
            const result = await deliver({ to: NOTIFY_TO, toName: 'Hostizzy', subject, html });

            if (result.sent) {
                await sb(`property_owners?id=eq.${owner.id}`, {
                    method: 'PATCH',
                    headers: { Prefer: 'return=minimal' },
                    body: JSON.stringify({ signup_notified_at: new Date().toISOString() }),
                });
            }
            return res.status(200).json(result);
        }

        if (action === 'approved') {
            // Admin action, so this one is authenticated.
            const auth = req.headers.authorization || '';
            const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
            if (!idToken) return res.status(401).json({ error: 'Authentication required' });

            let callerEmail;
            try {
                callerEmail = await verifyFirebaseToken(idToken);
            } catch (e) {
                return res.status(401).json({ error: 'Invalid token' });
            }

            const staff = await sb(
                `team_members?email=eq.${encodeURIComponent(callerEmail)}` +
                `&is_active=eq.true&select=role&limit=1`
            );
            const role = staff?.[0]?.role;
            if (!role || !['admin', 'staff', 'manager'].includes(String(role).toLowerCase())) {
                return res.status(403).json({ error: 'Not authorised' });
            }

            if (owner.status !== 'approved') {
                return res.status(409).json({ error: 'Owner is not approved yet' });
            }
            if (owner.approved_notified_at) {
                return res.status(200).json({ sent: false, reason: 'already-notified' });
            }

            const { subject, html } = approvedEmail(owner);
            const result = await deliver({ to: owner.email, toName: owner.name, subject, html });

            if (result.sent) {
                await sb(`property_owners?id=eq.${owner.id}`, {
                    method: 'PATCH',
                    headers: { Prefer: 'return=minimal' },
                    body: JSON.stringify({ approved_notified_at: new Date().toISOString() }),
                });
            }
            return res.status(200).json(result);
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });

    } catch (err) {
        console.error('[owner-notify]', err.message);
        return res.status(500).json({ error: err.message });
    }
}
