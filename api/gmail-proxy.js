/**
 * Vercel Serverless Function — Gmail OAuth Proxy
 *
 * Handles Gmail OAuth authorization code flow and proxies all Gmail API
 * calls server-side. Tokens are stored in Supabase, never exposed to the client.
 *
 * Actions:
 *   POST { action: "callback", code }        — Exchange auth code for tokens
 *   POST { action: "status" }                — Check if Gmail is connected
 *   POST { action: "profile" }               — Get Gmail user profile
 *   POST { action: "send", to, toName, subject, body } — Send email
 *   POST { action: "search", query }         — Search Gmail messages
 *   POST { action: "getMessage", messageId } — Get a specific message
 *   POST { action: "disconnect" }            — Remove stored tokens
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'https://resiq.hostizzy.com/api/gmail-proxy';

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
 * Verify Firebase ID token by calling Firebase Auth REST API
 */
async function verifyFirebaseToken(idToken) {
    const firebaseApiKey = process.env.FIREBASE_API_KEY;
    if (!firebaseApiKey) {
        throw new Error('Firebase API key not configured');
    }

    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        }
    );

    if (!response.ok) {
        throw new Error('Invalid Firebase token');
    }

    const data = await response.json();
    if (!data.users || data.users.length === 0) {
        throw new Error('No user found for token');
    }

    return data.users[0].localId; // Firebase UID
}

/**
 * Get stored Gmail tokens from Supabase
 */
async function getStoredTokens(userId) {
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
 * Save or update Gmail tokens in Supabase
 */
async function saveTokens(userId, tokens) {
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
async function deleteTokens(userId) {
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
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code) {
    // When using initCodeClient with ux_mode: 'popup', Google delivers the auth
    // code via postMessage. The token exchange must use 'postmessage' as the
    // redirect_uri (not an actual URL) to match Google's expectations.
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: GMAIL_CLIENT_ID,
            client_secret: GMAIL_CLIENT_SECRET,
            redirect_uri: 'postmessage',
            grant_type: 'authorization_code'
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('[gmail-proxy] Token exchange failed:', JSON.stringify(data));
        throw new Error(data.error_description || data.error || 'Failed to exchange code');
    }

    return data;
}

/**
 * Refresh an expired access token
 */
async function refreshAccessToken(refreshToken) {
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
async function getValidAccessToken(userId) {
    const stored = await getStoredTokens(userId);
    if (!stored) {
        throw new Error('Gmail not connected');
    }

    const expiresAt = new Date(stored.expires_at);
    const now = new Date();

    // Refresh if token expires within 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        const refreshed = await refreshAccessToken(stored.refresh_token);

        await saveTokens(userId, {
            access_token: refreshed.access_token,
            refresh_token: stored.refresh_token, // Refresh token stays the same
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
async function gmailApiCall(accessToken, endpoint, options = {}) {
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

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, ...params } = req.body;

    // All actions require Firebase authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    let userId;
    try {
        userId = await verifyFirebaseToken(authHeader.split('Bearer ')[1]);
    } catch (err) {
        console.error('[gmail-proxy] Auth failed:', err.message);
        return res.status(401).json({ error: 'Invalid authentication token: ' + err.message });
    }

    try {
        switch (action) {
            case 'callback': {
                // Exchange auth code for tokens
                const tokens = await exchangeCodeForTokens(params.code);

                if (!tokens.refresh_token) {
                    return res.status(200).json({
                        error: 'No refresh token received. Please revoke app access in Google Account settings and try again.'
                    });
                }

                // Get user email
                const profile = await gmailApiCall(tokens.access_token, '/users/me/profile');

                await saveTokens(userId, {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_in: tokens.expires_in,
                    gmail_email: profile.emailAddress
                });

                return res.status(200).json({
                    data: { connected: true, email: profile.emailAddress },
                    error: null
                });
            }

            case 'status': {
                const stored = await getStoredTokens(userId);
                return res.status(200).json({
                    data: {
                        connected: !!stored,
                        email: stored?.gmail_email || null
                    },
                    error: null
                });
            }

            case 'profile': {
                const accessToken = await getValidAccessToken(userId);
                const profile = await gmailApiCall(accessToken, '/users/me/profile');
                return res.status(200).json({ data: profile, error: null });
            }

            case 'send': {
                const accessToken = await getValidAccessToken(userId);
                const stored = await getStoredTokens(userId);
                const fromEmail = stored?.gmail_email || '';
                const businessName = params.businessName || 'ResIQ';

                // Build RFC 2822 email
                const emailLines = [
                    `From: ${businessName} <${fromEmail}>`,
                    `To: ${params.toName || ''} <${params.to}>`,
                    `Subject: ${params.subject}`,
                    'MIME-Version: 1.0',
                    'Content-Type: text/html; charset=UTF-8',
                    '',
                    params.body.replace(/\n/g, '<br>')
                ];
                const rawMessage = emailLines.join('\r\n');

                // Base64url encode
                const encoded = Buffer.from(rawMessage)
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                const result = await gmailApiCall(accessToken, '/users/me/messages/send', {
                    method: 'POST',
                    body: JSON.stringify({ raw: encoded })
                });

                return res.status(200).json({ data: result, error: null });
            }

            case 'search': {
                const accessToken = await getValidAccessToken(userId);
                const result = await gmailApiCall(
                    accessToken,
                    `/users/me/messages?q=${encodeURIComponent(params.query)}&maxResults=${params.maxResults || 20}`
                );
                return res.status(200).json({ data: result.messages || [], error: null });
            }

            case 'getMessage': {
                const accessToken = await getValidAccessToken(userId);
                const result = await gmailApiCall(
                    accessToken,
                    `/users/me/messages/${params.messageId}?format=full`
                );
                return res.status(200).json({ data: result, error: null });
            }

            case 'disconnect': {
                await deleteTokens(userId);
                return res.status(200).json({ data: { disconnected: true }, error: null });
            }

            default:
                return res.status(200).json({ data: null, error: { message: 'Unknown action' } });
        }
    } catch (err) {
        const isTokenExpired = err.message === 'GMAIL_TOKEN_EXPIRED' || err.message === 'Gmail not connected';
        return res.status(200).json({
            data: null,
            error: {
                message: err.message,
                reconnect: isTokenExpired
            }
        });
    }
}
