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

import {
    getStoredTokens,
    saveTokens,
    deleteTokens,
    getValidAccessToken,
    gmailApiCall
} from './gmail-helpers.js';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

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
