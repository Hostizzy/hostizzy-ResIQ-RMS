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

// Round 6 — monthly revenue target notifications
const STAY_EMAIL_RECIPIENT = process.env.STAY_EMAIL_RECIPIENT || 'stay@hostizzy.com';
const WA_DAILY_TARGET_TEMPLATE = process.env.WA_DAILY_TARGET_TEMPLATE || null;
const WA_DAILY_TARGET_LANGUAGE = process.env.WA_DAILY_TARGET_LANGUAGE || 'en';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API_VERSION = 'v21.0';

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
    return getDateIST(0);
}

/**
 * Get a date in IST offset by `daysOffset` days from today (YYYY-MM-DD)
 */
function getDateIST(daysOffset = 0) {
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset + daysOffset * 24 * 60 * 60 * 1000);
    return istDate.toISOString().split('T')[0];
}

/**
 * Format a YYYY-MM-DD date as a short display string (e.g., "12 Apr")
 */
function formatShortDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
function buildEmailHTML(date, checkIns, checkOuts, upcomingCheckIns, upcomingCheckOuts, pendingPayments, ownerName, targetSectionHTML = '') {
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

    // Check-outs table (with balance — outstanding amounts should be collected before departure)
    let checkOutsHTML = '';
    if (checkOuts.length > 0) {
        const rows = checkOuts.map(r => {
            const balance = (r.total_amount || 0) - (r.paid_amount || 0);
            return `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.property_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_phone || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.total_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.paid_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: ${balance > 0 ? '#dc2626' : '#059669'};">${formatAmount(balance)}</td>
            </tr>
            `;
        }).join('');

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
        checkOutsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">🚪 Today's Check-outs</h2>
                <p style="color: #64748b; font-size: 14px;">No check-outs scheduled for today.</p>
            </div>
        `;
    }

    // Upcoming check-ins table (next few days)
    let upcomingCheckInsHTML = '';
    if (upcomingCheckIns.length > 0) {
        const rows = upcomingCheckIns.map(r => {
            const balance = (r.total_amount || 0) - (r.paid_amount || 0);
            return `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${formatShortDate(r.check_in)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.property_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_phone || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.total_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.paid_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: ${balance > 0 ? '#dc2626' : '#059669'};">${formatAmount(balance)}</td>
            </tr>
            `;
        }).join('');

        upcomingCheckInsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #6366f1;">
                    📅 Upcoming Check-ins — Next 3 Days (${upcomingCheckIns.length})
                </h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Date</th>
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
    }

    // Upcoming check-outs table (next few days)
    let upcomingCheckOutsHTML = '';
    if (upcomingCheckOuts.length > 0) {
        const rows = upcomingCheckOuts.map(r => {
            const balance = (r.total_amount || 0) - (r.paid_amount || 0);
            return `
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${formatShortDate(r.check_out)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.property_name || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.guest_phone || '-'}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.total_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatAmount(r.paid_amount)}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: ${balance > 0 ? '#dc2626' : '#059669'};">${formatAmount(balance)}</td>
            </tr>
            `;
        }).join('');

        upcomingCheckOutsHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #f59e0b;">
                    🧳 Upcoming Check-outs — Next 3 Days (${upcomingCheckOuts.length})
                </h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Date</th>
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

            ${targetSectionHTML}
            ${checkInsHTML}
            ${checkOutsHTML}
            ${upcomingCheckInsHTML}
            ${upcomingCheckOutsHTML}
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

// ============================================================
// Round 6 — Monthly Revenue Target helpers
// ============================================================

/**
 * Compute month-to-date revenue + tier progress.
 *
 * Revenue metric: SUM(total_amount) over reservations whose check_in falls
 * in the current IST calendar month and whose status is not 'cancelled'.
 *
 * @param {Array} reservations — current-month reservations (pre-filtered is fine)
 * @param {{tier_1:number,tier_2:number,tier_3:number}} targets
 * @param {Date} now — defaults to "right now"
 */
function computeTargetProgress(reservations, targets, now = new Date()) {
    // Work in IST for day-of-month math
    const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
    const ist = new Date(istMs);
    const year = ist.getUTCFullYear();
    const month = ist.getUTCMonth(); // 0-based
    const dayOfMonth = ist.getUTCDate();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const daysRemaining = Math.max(daysInMonth - dayOfMonth, 0);

    const monthRevenue = (reservations || [])
        .filter(r => r.status !== 'cancelled')
        .filter(r => {
            if (!r.check_in) return false;
            const d = new Date(r.check_in);
            // r.check_in is typically a date string like '2026-04-12' which
            // parses as midnight UTC. Shift into IST to match dayOfMonth logic.
            const dIst = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
            return dIst.getUTCFullYear() === year && dIst.getUTCMonth() === month;
        })
        .reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

    const dailyAverage = dayOfMonth > 0 ? (monthRevenue / dayOfMonth) : 0;
    const projectedMonthEnd = dailyAverage * daysInMonth;

    const tierAmounts = [targets.tier_1, targets.tier_2, targets.tier_3].map(Number);
    const tiers = tierAmounts.map((target, i) => {
        const expectedByToday = (target * dayOfMonth) / daysInMonth;
        const gap = Math.max(target - monthRevenue, 0);
        const dailyPaceNeeded = daysRemaining > 0 ? gap / daysRemaining : gap;
        const percentAchieved = target > 0 ? (monthRevenue / target) * 100 : 0;

        let projectedHitDay = null;
        if (monthRevenue >= target) {
            projectedHitDay = null; // already crossed
        } else if (dailyAverage > 0) {
            const day = Math.ceil(target / dailyAverage);
            projectedHitDay = day <= daysInMonth ? day : Infinity;
        }

        return {
            label: `Tier ${i + 1}`,
            target,
            achieved: monthRevenue,
            percentAchieved,
            expectedByToday,
            onPace: monthRevenue >= expectedByToday,
            gap,
            dailyPaceNeeded,
            projectedHitDay
        };
    });

    const monthLabel = ist.toLocaleDateString('en-IN', {
        month: 'long', year: 'numeric', timeZone: 'UTC'
    });

    return { dayOfMonth, daysInMonth, daysRemaining, monthRevenue, dailyAverage, projectedMonthEnd, tiers, monthLabel };
}

/**
 * Format a number as ₹xx,xx,xxx (Indian grouping).
 */
function formatInr(amount) {
    return '₹' + Math.round(Number(amount) || 0).toLocaleString('en-IN');
}

/**
 * Format a number as a short lakh/crore string (e.g. "₹42.3L", "₹1.05Cr").
 */
function formatShortInr(amount) {
    const n = Number(amount) || 0;
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    return '₹' + Math.round(n).toLocaleString('en-IN');
}

/**
 * Normalise a phone number to E.164 digits (no +, no spaces, no dashes).
 * If the number has no country code and is 10 digits, assume India (91).
 */
function normalisePhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/[^\d]/g, '');
    if (digits.length === 10) digits = '91' + digits;
    if (digits.length < 11 || digits.length > 15) return null;
    return digits;
}

/**
 * Build a compact target-progress HTML block for embedding INSIDE the
 * existing daily-summary email (so the admin sees target progress inline
 * alongside today's check-ins, check-outs, and pending payments).
 */
function projectedHitLabel(t) {
    if (t.projectedHitDay === null) return '<span style="color:#059669;">✅ Achieved</span>';
    if (t.projectedHitDay === Infinity) return '<span style="color:#dc2626;">⚠️ Will miss</span>';
    return `Day ${t.projectedHitDay}`;
}

function buildTargetInlineSection(progress) {
    const { dayOfMonth, daysInMonth, daysRemaining, monthRevenue, dailyAverage, projectedMonthEnd, tiers, monthLabel } = progress;
    const tierColors = ['#0891b2', '#f59e0b', '#dc2626'];

    const tierRows = tiers.map((t, i) => {
        const color = tierColors[i];
        const paceIcon = t.onPace ? '🟢' : '🟡';
        return `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${t.label} — ${formatShortInr(t.target)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: ${color}; font-weight: 700;">${t.percentAchieved.toFixed(1)}%</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatInr(t.gap)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatInr(t.dailyPaceNeeded)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${paceIcon}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 12px;">${projectedHitLabel(t)}</td>
        </tr>
        `;
    }).join('');

    const projectionBanner = monthRevenue > 0 ? `
        <div style="background: #eff6ff; border-left: 3px solid #3b82f6; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; color: #1e40af;">
            <strong>At current pace:</strong> ${formatShortInr(projectedMonthEnd)} projected month-end · daily avg ${formatInr(dailyAverage)}
        </div>
    ` : '';

    return `
        <div style="margin-bottom: 32px;">
            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #1B3A5C;">
                🎯 Monthly Revenue Target — ${monthLabel} (Day ${dayOfMonth}/${daysInMonth} · ${daysRemaining}d left)
            </h2>
            <div style="background: #f8fafc; padding: 14px 16px; border-radius: 8px; margin-bottom: 12px;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">MTD Gross Revenue:</span>
                <span style="font-size: 20px; font-weight: 800; color: #0f172a; margin-left: 8px;">${formatInr(monthRevenue)}</span>
            </div>
            ${projectionBanner}
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Tier</th>
                        <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Achieved</th>
                        <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Gap</th>
                        <th style="padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Needed/day</th>
                        <th style="padding: 8px 12px; text-align: center; font-weight: 600; color: #475569;">Pace</th>
                        <th style="padding: 8px 12px; text-align: center; font-weight: 600; color: #475569;">Projected</th>
                    </tr>
                </thead>
                <tbody>${tierRows}</tbody>
            </table>
        </div>
    `;
}

/**
 * Build the HTML body for the target-progress email sent to stay@hostizzy.com.
 */
function buildTargetEmailHTML(progress) {
    const { dayOfMonth, daysInMonth, daysRemaining, monthRevenue, tiers, monthLabel } = progress;
    const tierColors = ['#0891b2', '#f59e0b', '#dc2626'];

    const tierRows = tiers.map((t, i) => {
        const pct = Math.min(t.percentAchieved, 100);
        const color = tierColors[i];
        const paceIcon = t.onPace ? '🟢' : '🟡';
        const paceText = t.onPace ? 'On pace' : 'Behind pace';
        return `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                <strong style="font-size: 14px; color: #0f172a;">${t.label} — ${formatShortInr(t.target)}</strong>
                <span style="font-size: 13px; color: ${color}; font-weight: 700;">${t.percentAchieved.toFixed(1)}%</span>
            </div>
            <div style="background: #f1f5f9; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 6px;">
                <div style="width: ${pct}%; height: 100%; background: ${color};"></div>
            </div>
            <div style="font-size: 12px; color: #475569; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span>${paceIcon} ${paceText} · Expected by today: ${formatShortInr(t.expectedByToday)}</span>
                <span>Gap: ${formatInr(t.gap)} · Needed/day: ${formatInr(t.dailyPaceNeeded)}</span>
            </div>
        </div>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">
        <div style="background: linear-gradient(135deg, #1B3A5C 0%, #0891b2 100%); border-radius: 12px 12px 0 0; padding: 24px 28px; text-align: center;">
            <h1 style="color: white; font-size: 22px; font-weight: 800; margin: 0 0 4px 0;">Monthly Revenue Target</h1>
            <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${monthLabel} · Day ${dayOfMonth} of ${daysInMonth} · ${daysRemaining} day(s) remaining</p>
        </div>
        <div style="background: white; padding: 28px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <div style="text-align: center; margin-bottom: 28px; padding: 20px; background: #f8fafc; border-radius: 10px;">
                <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Month-to-Date Gross Revenue</div>
                <div style="font-size: 34px; font-weight: 800; color: #0f172a;">${formatInr(monthRevenue)}</div>
            </div>
            ${tierRows}
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                <a href="https://resiq.hostizzy.com/app" style="display: inline-block; padding: 10px 24px; background: #0891b2; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Open ResIQ Dashboard →</a>
            </div>
        </div>
        <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
            <p>Automated daily target update from ResIQ by Hostizzy.</p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Send one approved WhatsApp template message.
 * Resolves `{ ok: true, msgId }` or `{ ok: false, error }`.
 */
async function sendWaTemplate(toPhone, templateName, languageCode, components) {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_ID) {
        return { ok: false, error: 'WhatsApp credentials not configured' };
    }
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
    try {
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
        const msgId = data?.messages?.[0]?.id || null;
        return { ok: true, msgId };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * Build the 7-variable component list for the `daily_sales_target_update`
 * WhatsApp template. Keep this in sync with the approved template body
 * (see plan file for the exact text).
 *
 * Variables:
 *   {{1}} day of month
 *   {{2}} days in month
 *   {{3}} MTD revenue (short, e.g. "₹42.3L")
 *   {{4}} Tier 1 % achieved (e.g. "95.5")
 *   {{5}} Tier 2 % achieved
 *   {{6}} Tier 3 % achieved
 *   {{7}} Daily pace needed for Tier 1 (short, e.g. "₹50K")
 */
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

/**
 * Load targets + current-month reservations + active team members and compute
 * progress. Returns { progress, teamMembers }. Safe to call on its own so the
 * daily-summary email can embed the target section without also dispatching
 * the separate stay@ email or WhatsApp broadcast.
 */
async function loadTargetProgress() {
    const [targetRows, monthReservations, teamMembers] = await Promise.all([
        querySupabase('revenue_targets', 'id=eq.1&select=tier_1,tier_2,tier_3'),
        (async () => {
            const now = new Date();
            const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
            const year = ist.getUTCFullYear();
            const month = ist.getUTCMonth();
            const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const nextMonthStart = month === 11
                ? `${year + 1}-01-01`
                : `${year}-${String(month + 2).padStart(2, '0')}-01`;
            return querySupabase('reservations',
                `check_in=gte.${monthStart}&check_in=lt.${nextMonthStart}&status=not.in.(cancelled)&select=total_amount,status,check_in`
            );
        })(),
        querySupabase('team_members', 'is_active=eq.true&select=id,name,phone,role')
    ]);

    const targets = targetRows?.[0] || { tier_1: 4000000, tier_2: 5000000, tier_3: 6000000 };
    const progress = computeTargetProgress(monthReservations, targets);
    console.log(`[daily-summary][target] MTD: ${formatInr(progress.monthRevenue)} | Day ${progress.dayOfMonth}/${progress.daysInMonth} | T1: ${progress.tiers[0].percentAchieved.toFixed(1)}%`);
    return { progress, teamMembers };
}

/**
 * Run the target-update dispatch: separate email to STAY_EMAIL_RECIPIENT +
 * WhatsApp template to each active team member with a phone. Safe to call
 * even if WA env vars are missing (logs + skips WA). Accepts pre-loaded
 * `progress` + `teamMembers` to avoid duplicate queries — the main handler
 * uses the same progress to embed an inline section in the admin summary.
 */
async function dispatchTargetUpdate(accessToken, fromEmail, progress, teamMembers) {
    // 2. Email to stay@hostizzy.com
    let emailStatus = 'skipped';
    try {
        const html = buildTargetEmailHTML(progress);
        await sendEmail(accessToken, {
            to: STAY_EMAIL_RECIPIENT,
            subject: `Monthly Target Update — Day ${progress.dayOfMonth}/${progress.daysInMonth} — ${formatShortInr(progress.monthRevenue)} MTD`,
            body: html,
            fromEmail,
            businessName: 'ResIQ'
        });
        emailStatus = 'sent';
        console.log(`[daily-summary][target] Email sent to ${STAY_EMAIL_RECIPIENT}`);
    } catch (err) {
        emailStatus = `failed: ${err.message}`;
        console.error(`[daily-summary][target] Email failed:`, err.message);
    }

    // 3. WhatsApp to active team members
    const waResult = { sent: 0, skipped: 0, failed: 0, details: [] };
    if (!WA_DAILY_TARGET_TEMPLATE) {
        console.warn('[daily-summary][target] WA_DAILY_TARGET_TEMPLATE not set — skipping WhatsApp dispatch');
        return { email: emailStatus, wa: { ...waResult, skippedReason: 'template-not-configured' }, progress };
    }
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_ID) {
        console.warn('[daily-summary][target] WhatsApp credentials missing — skipping WhatsApp dispatch');
        return { email: emailStatus, wa: { ...waResult, skippedReason: 'no-wa-credentials' }, progress };
    }

    const components = buildTargetWaComponents(progress);
    for (const m of teamMembers) {
        const phone = normalisePhone(m.phone);
        if (!phone) {
            waResult.skipped++;
            waResult.details.push({ name: m.name, status: 'skipped', reason: 'no-phone' });
            continue;
        }
        const result = await sendWaTemplate(phone, WA_DAILY_TARGET_TEMPLATE, WA_DAILY_TARGET_LANGUAGE, components);
        if (result.ok) {
            waResult.sent++;
            waResult.details.push({ name: m.name, status: 'sent', msgId: result.msgId });
        } else {
            waResult.failed++;
            waResult.details.push({ name: m.name, status: 'failed', error: result.error });
        }
    }

    console.log(`[daily-summary][target] WA sent: ${waResult.sent}, skipped: ${waResult.skipped}, failed: ${waResult.failed}`);
    return { email: emailStatus, wa: waResult, progress };
}

// ============================================================

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

        // 2. Get today's date in IST and the upcoming window end (next 3 days)
        const today = getTodayIST();
        const upcomingWindowEnd = getDateIST(3);
        console.log(`[daily-summary] Running for date: ${today}, upcoming window: ${today} → ${upcomingWindowEnd}`);

        // 3. Query data from Supabase
        //    Note: we deliberately filter by date only (not workflow status).
        //    iCal-imported reservations get their status derived from the dates
        //    (see js/properties.js deriveStatusFromDates), so on the arrival day
        //    they are already 'checked-in' and on the departure day they are
        //    already 'checked-out'. Manual reservations, on the other hand,
        //    usually stay at 'confirmed' the entire stay because nobody clicks
        //    a workflow button. Filtering by a specific status therefore misses
        //    most real bookings. Excluding 'cancelled' is all we need.
        const [checkIns, checkOuts, upcomingCheckIns, upcomingCheckOuts, pendingPayments, externalOwners] = await Promise.all([
            // Today's check-ins
            querySupabase('reservations',
                `check_in=eq.${today}&status=not.in.(cancelled)&select=guest_name,guest_phone,property_name,total_amount,paid_amount,owner_id&order=property_name`
            ),
            // Today's check-outs
            querySupabase('reservations',
                `check_out=eq.${today}&status=not.in.(cancelled)&select=guest_name,guest_phone,property_name,total_amount,paid_amount,owner_id&order=property_name`
            ),
            // Upcoming check-ins (tomorrow through the next 3 days)
            querySupabase('reservations',
                `check_in=gt.${today}&check_in=lte.${upcomingWindowEnd}&status=not.in.(cancelled)&select=guest_name,guest_phone,property_name,check_in,total_amount,paid_amount,owner_id&order=check_in`
            ),
            // Upcoming check-outs (tomorrow through the next 3 days)
            querySupabase('reservations',
                `check_out=gt.${today}&check_out=lte.${upcomingWindowEnd}&status=not.in.(cancelled)&select=guest_name,guest_phone,property_name,check_out,total_amount,paid_amount,owner_id&order=check_out`
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

        console.log(`[daily-summary] Today — Check-ins: ${checkIns.length}, Check-outs: ${checkOuts.length} | Upcoming — Check-ins: ${upcomingCheckIns.length}, Check-outs: ${upcomingCheckOuts.length} | Pending: ${pendingPayments.length}, Owners: ${externalOwners.length}`);

        // Round 6 — load target progress once so we can both (a) embed it
        // inline in the admin summary email and (b) dispatch the separate
        // stay@ email + WA broadcast using the same numbers.
        let targetProgress = null;
        let targetTeamMembers = [];
        let targetInlineHTML = '';
        try {
            const loaded = await loadTargetProgress();
            targetProgress = loaded.progress;
            targetTeamMembers = loaded.teamMembers;
            targetInlineHTML = buildTargetInlineSection(targetProgress);
        } catch (err) {
            console.error('[daily-summary][target] Preload failed (continuing without inline section):', err.message);
        }

        const sentTo = [];

        // 4. Send admin summary (all properties) — with inline target section
        if (DAILY_SUMMARY_EMAIL) {
            const adminHTML = buildEmailHTML(today, checkIns, checkOuts, upcomingCheckIns, upcomingCheckOuts, pendingPayments, null, targetInlineHTML);
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
            const ownerUpcomingCheckIns = upcomingCheckIns.filter(r => r.owner_id === owner.id);
            const ownerUpcomingCheckOuts = upcomingCheckOuts.filter(r => r.owner_id === owner.id);
            const ownerPayments = pendingPayments.filter(r => r.owner_id === owner.id);

            // Skip if owner has no activity at all
            if (
                ownerCheckIns.length === 0 &&
                ownerCheckOuts.length === 0 &&
                ownerUpcomingCheckIns.length === 0 &&
                ownerUpcomingCheckOuts.length === 0 &&
                ownerPayments.length === 0
            ) {
                continue;
            }

            const ownerHTML = buildEmailHTML(today, ownerCheckIns, ownerCheckOuts, ownerUpcomingCheckIns, ownerUpcomingCheckOuts, ownerPayments, owner.name);
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

        // Round 6 — monthly revenue target dispatch (separate stay@ email + WA).
        // Runs after the summary emails so any failure here doesn't block the
        // existing summary. Uses the already-loaded progress + team_members.
        let targetUpdate = null;
        if (targetProgress) {
            try {
                targetUpdate = await dispatchTargetUpdate(accessToken, fromEmail, targetProgress, targetTeamMembers);
            } catch (err) {
                console.error('[daily-summary][target] Dispatch crashed:', err.message);
                targetUpdate = { error: err.message };
            }
        } else {
            targetUpdate = { error: 'Target progress unavailable — see earlier log' };
        }

        return res.status(200).json({
            message: 'Daily summary sent',
            date: today,
            sentTo,
            stats: {
                checkIns: checkIns.length,
                checkOuts: checkOuts.length,
                upcomingCheckIns: upcomingCheckIns.length,
                upcomingCheckOuts: upcomingCheckOuts.length,
                pendingPayments: pendingPayments.length
            },
            targetUpdate
        });

    } catch (err) {
        console.error('[daily-summary] Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
