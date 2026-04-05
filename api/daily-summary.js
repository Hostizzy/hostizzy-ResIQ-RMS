/**
 * Vercel Cron Function — Daily Summary Email
 *
 * Triggered daily at 7:00 AM IST (1:30 AM UTC) via Vercel Cron.
 * Queries Supabase for today's check-ins, check-outs, and pending payments,
 * then sends an HTML summary email via Gmail.
 *
 * Recipients:
 *   - Admin email (DAILY_SUMMARY_EMAIL env var)
 *   - External property owners (approved, active) get their own properties' summary
 *
 * Auth: Vercel Cron sets Authorization: Bearer <CRON_SECRET>
 */

import {
    getFirstGmailToken,
    ensureTokenFresh,
    sendEmail
} from './gmail-helpers.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DAILY_SUMMARY_EMAIL = process.env.DAILY_SUMMARY_EMAIL;

/**
 * Query Supabase REST API
 */
async function querySupabase(table, params = '') {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${params}`,
        {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Supabase query failed (${table}): ${err}`);
    }

    return response.json();
}

/**
 * Get today's date in YYYY-MM-DD format (IST)
 */
function getTodayIST() {
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
}

/**
 * Format date for email subject/display
 */
function formatDateDisplay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format currency
 */
function formatAmount(amount) {
    if (!amount && amount !== 0) return '-';
    return '₹' + Number(amount).toLocaleString('en-IN');
}

/**
 * Calculate days overdue (days since check-in for pending payments)
 */
function daysOverdue(checkInDate) {
    const today = new Date(getTodayIST());
    const checkIn = new Date(checkInDate);
    const diff = Math.floor((today - checkIn) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

/**
 * Build HTML email body
 */
function buildEmailHTML(date, checkIns, checkOuts, pendingPayments, ownerName) {
    const displayDate = formatDateDisplay(date);
    const greeting = ownerName ? `Hi ${ownerName},` : 'Good morning,';
    const scopeLabel = ownerName ? 'your properties' : 'all properties';

    // Check-ins table
    let checkInsHTML = '';
    if (checkIns.length > 0) {
        const rows = checkIns.map(r => `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.property_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_phone || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.total_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.paid_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: ${(r.total_amount - (r.paid_amount || 0)) > 0 ? '#dc2626' : '#059669'};">${formatAmount((r.total_amount || 0) - (r.paid_amount || 0))}</td>
            </tr>
        `).join('');

        checkInsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #0891b2;">
                    ✅ Today's Check-ins (${checkIns.length})
                </h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Guest</th>
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Property</th>
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Phone</th>
                            <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Total</th>
                            <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Paid</th>
                            <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Balance</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    } else {
        checkInsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">✅ Today's Check-ins</h2>
                <p style="color: #64748b; font-size: 14px;">No check-ins scheduled for today.</p>
            </div>
        `;
    }

    // Check-outs table
    let checkOutsHTML = '';
    if (checkOuts.length > 0) {
        const rows = checkOuts.map(r => `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.property_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_phone || '-'}</td>
            </tr>
        `).join('');

        checkOutsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #E8943A;">
                    🚪 Today's Check-outs (${checkOuts.length})
                </h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Guest</th>
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Property</th>
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Phone</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    } else {
        checkOutsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">🚪 Today's Check-outs</h2>
                <p style="color: #64748b; font-size: 14px;">No check-outs scheduled for today.</p>
            </div>
        `;
    }

    // Pending payments table
    let paymentsHTML = '';
    if (pendingPayments.length > 0) {
        const rows = pendingPayments.map(r => {
            const balance = (r.total_amount || 0) - (r.paid_amount || 0);
            const overdue = daysOverdue(r.check_in);
            return `
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_name || '-'}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.property_name || '-'}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.total_amount)}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.paid_amount)}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #dc2626;">${formatAmount(balance)}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: ${overdue > 3 ? '#dc2626' : '#475569'};">${overdue > 0 ? overdue + 'd' : '-'}</td>
                </tr>
            `;
        }).join('');

        const totalPending = pendingPayments.reduce((sum, r) => sum + ((r.total_amount || 0) - (r.paid_amount || 0)), 0);

        paymentsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #dc2626;">
                    💰 Pending Payments (${pendingPayments.length}) — Total: ${formatAmount(totalPending)}
                </h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Guest</th>
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Property</th>
                            <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Total</th>
                            <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Paid</th>
                            <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Balance</th>
                            <th style="padding: 8px 12px; text-align: center; font-weight: 600; color: #475569;">Overdue</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    } else {
        paymentsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">💰 Pending Payments</h2>
                <p style="color: #059669; font-size: 14px; font-weight: 600;">All payments are up to date! 🎉</p>
            </div>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1B3A5C 0%, #0891b2 100%); border-radius: 12px 12px 0 0; padding: 24px 28px; text-align: center;">
            <h1 style="color: white; font-size: 22px; font-weight: 800; margin: 0 0 4px 0;">ResIQ Daily Summary</h1>
            <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0;">${displayDate} — ${scopeLabel}</p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 28px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">${greeting} Here's your daily operations summary.</p>

            ${checkInsHTML}
            ${checkOutsHTML}
            ${paymentsHTML}

            <!-- Quick Link -->
            <div style="text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <a href="https://resiq.hostizzy.com/app" style="display: inline-block; padding: 10px 24px; background: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Open ResIQ Dashboard →</a>
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
            <p>This is an automated daily summary from ResIQ by Hostizzy.</p>
            <p>Manage your properties at <a href="https://resiq.hostizzy.com" style="color: #0891b2;">resiq.hostizzy.com</a></p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

export default async function handler(req, res) {
    // Only allow GET (Vercel Cron sends GET requests)
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        // 1. Get Gmail token
        const tokenRecord = await getFirstGmailToken();
        if (!tokenRecord) {
            console.warn('[daily-summary] No Gmail token found — skipping email send');
            return res.status(200).json({ message: 'No Gmail connected, skipping' });
        }

        const accessToken = await ensureTokenFresh(tokenRecord);
        const fromEmail = tokenRecord.gmail_email;

        // 2. Get today's date in IST
        const today = getTodayIST();
        console.log(`[daily-summary] Running for date: ${today}`);

        // 3. Query data from Supabase
        const [checkIns, checkOuts, pendingPayments, externalOwners] = await Promise.all([
            // Today's check-ins
            querySupabase('reservations',
                `check_in=eq.${today}&status=in.(confirmed)&select=guest_name,guest_phone,property_name,total_amount,paid_amount,owner_id&order=property_name`
            ),
            // Today's check-outs
            querySupabase('reservations',
                `check_out=eq.${today}&status=in.(checked-in)&select=guest_name,guest_phone,property_name,owner_id&order=property_name`
            ),
            // Pending payments (active reservations only)
            querySupabase('reservations',
                `payment_status=in.(pending,partial)&status=not.in.(cancelled,checked-out)&select=guest_name,guest_phone,property_name,total_amount,paid_amount,check_in,owner_id&order=property_name`
            ),
            // External owners (for per-owner emails)
            querySupabase('property_owners',
                `is_external=eq.true&is_active=eq.true&status=eq.approved&select=id,name,email`
            )
        ]);

        console.log(`[daily-summary] Check-ins: ${checkIns.length}, Check-outs: ${checkOuts.length}, Pending: ${pendingPayments.length}, Owners: ${externalOwners.length}`);

        const sentTo = [];

        // 4. Send admin summary (all properties)
        if (DAILY_SUMMARY_EMAIL) {
            const adminHTML = buildEmailHTML(today, checkIns, checkOuts, pendingPayments, null);
            await sendEmail(accessToken, {
                to: DAILY_SUMMARY_EMAIL,
                subject: `ResIQ Daily Summary - ${formatDateDisplay(today)}`,
                body: adminHTML,
                fromEmail,
                businessName: 'ResIQ'
            });
            sentTo.push(DAILY_SUMMARY_EMAIL);
        }

        // 5. Send per-owner summaries for external owners
        for (const owner of externalOwners) {
            if (!owner.email) continue;

            // Filter data for this owner's properties
            const ownerCheckIns = checkIns.filter(r => r.owner_id === owner.id);
            const ownerCheckOuts = checkOuts.filter(r => r.owner_id === owner.id);
            const ownerPayments = pendingPayments.filter(r => r.owner_id === owner.id);

            // Skip if owner has no activity at all
            if (ownerCheckIns.length === 0 && ownerCheckOuts.length === 0 && ownerPayments.length === 0) {
                continue;
            }

            const ownerHTML = buildEmailHTML(today, ownerCheckIns, ownerCheckOuts, ownerPayments, owner.name);
            await sendEmail(accessToken, {
                to: owner.email,
                toName: owner.name,
                subject: `ResIQ Daily Summary - ${formatDateDisplay(today)}`,
                body: ownerHTML,
                fromEmail,
                businessName: 'ResIQ'
            });
            sentTo.push(owner.email);
        }

        console.log(`[daily-summary] Sent to: ${sentTo.join(', ') || 'nobody'}`);
        return res.status(200).json({
            message: 'Daily summary sent',
            date: today,
            sentTo,
            stats: {
                checkIns: checkIns.length,
                checkOuts: checkOuts.length,
                pendingPayments: pendingPayments.length
            }
        });

    } catch (err) {
        console.error('[daily-summary] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
