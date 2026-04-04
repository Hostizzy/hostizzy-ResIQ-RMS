/**
 * Shared Gmail OAuth Helper Functions
 *
 * Extracted from gmail-proxy.js for reuse by daily-summary.js and other
 * server-side functions that need to send emails via Gmail.
 *
 * All functions use environment variables:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

/**
 * Get stored Gmail tokens from Supabase
 */
export async function getStoredTokens(userId) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.${userId}&select=*`,
        {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Accept': 'application/vnd.pgrst.object+json'
            }
        }
    );

    if (response.status === 406) return null; // No rows
    if (!response.ok) return null;

    return response.json();
}

/**
 * Get the first available Gmail token (for cron jobs where there's no user context)
 */
export async function getFirstGmailToken() {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/gmail_tokens?select=*&limit=1`,
        {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        }
    );

    if (!response.ok) return null;

    const rows = await response.json();
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Save or update Gmail tokens in Supabase
 */
export async function saveTokens(userId, tokens) {
    const row = {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        gmail_email: tokens.gmail_email || null,
        updated_at: new Date().toISOString()
    };

    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/gmail_tokens`,
        {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(row)
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error('Failed to save tokens: ' + err);
    }

    return response.json();
}

/**
 * Delete stored tokens from Supabase
 */
export async function deleteTokens(userId) {
    await fetch(
        `${SUPABASE_URL}/rest/v1/gmail_tokens?user_id=eq.${userId}`,
        {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        }
    );
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: GMAIL_CLIENT_ID,
            client_secret: GMAIL_CLIENT_SECRET,
            grant_type: 'refresh_token'
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error_description || 'Failed to refresh token');
    }

    return response.json();
}

/**
 * Get a valid access token, refreshing if needed
 */
export async function getValidAccessToken(userId) {
    const stored = await getStoredTokens(userId);
    if (!stored) {
        throw new Error('Gmail not connected');
    }

    return ensureTokenFresh(stored);
}

/**
 * Ensure a token record is fresh, refreshing if needed. Returns access_token string.
 */
export async function ensureTokenFresh(stored) {
    const expiresAt = new Date(stored.expires_at);
    const now = new Date();

    // Refresh if token expires within 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        const refreshed = await refreshAccessToken(stored.refresh_token);

        await saveTokens(stored.user_id, {
            access_token: refreshed.access_token,
            refresh_token: stored.refresh_token,
            expires_in: refreshed.expires_in,
            gmail_email: stored.gmail_email
        });

        return refreshed.access_token;
    }

    return stored.access_token;
}

/**
 * Make an authenticated Gmail API call
 */
export async function gmailApiCall(accessToken, endpoint, options = {}) {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        throw new Error('GMAIL_TOKEN_EXPIRED');
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gmail API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Send an email via Gmail API
 */
export async function sendEmail(accessToken, { to, toName, subject, body, fromEmail, businessName }) {
    const from = businessName || 'ResIQ';

    const emailLines = [
        `From: ${from} <${fromEmail}>`,
        `To: ${toName || ''} <${to}>`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        body
    ];
    const rawMessage = emailLines.join('\r\n');

    // Base64url encode
    const encoded = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return gmailApiCall(accessToken, '/users/me/messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw: encoded })
    });
}
