/**
 * Vercel Serverless Function — WhatsApp Business API Proxy
 *
 * Proxies WhatsApp Cloud API calls server-side so the access token
 * is never exposed to the client. Supports:
 *
 *   POST { action: "send", to, template, components }  — Send a template message
 *   POST { action: "sendInteractive", to, body, cta }  — Send interactive CTA message
 *   POST { action: "sendText", to, text }               — Send a plain text message
 *   POST { action: "status" }                            — Check WABA connection
 *
 * Environment variables required:
 *   WHATSAPP_ACCESS_TOKEN   — Permanent token from Meta Business
 *   WHATSAPP_PHONE_ID       — Phone Number ID (central sending number)
 *   FIREBASE_API_KEY         — For auth verification
 *   SUPABASE_URL            — For logging
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API_VERSION = 'v21.0';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
 * Verify Firebase ID token
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
    return data.users[0].localId;
}

/**
 * Call WhatsApp Cloud API
 */
async function waApiCall(endpoint, body) {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_ID}/${endpoint}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        const errMsg = data?.error?.message || `WhatsApp API error: ${response.status}`;
        throw new Error(errMsg);
    }
    return data;
}

/**
 * Log sent message to Supabase communications table
 */
async function logToSupabase(record) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/communications`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(record)
        });
    } catch (e) {
        console.error('[whatsapp-proxy] Failed to log communication:', e.message);
    }
}

/**
 * Format phone number for WhatsApp API (must include country code, no + prefix)
 * Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 */
function formatPhone(phone, defaultCountryCode = '91') {
    let cleaned = (phone || '').replace(/[^0-9]/g, '');

    // Remove leading 0 (Indian STD format: 079XXXXXXX → 79XXXXXXX)
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // Already has country code + 10 digits
    if (cleaned.startsWith(defaultCountryCode) && cleaned.length === (defaultCountryCode.length + 10)) {
        return cleaned;
    }

    // Exactly 10 digits — add country code
    if (cleaned.length === 10) {
        return defaultCountryCode + cleaned;
    }

    // Longer than 10, starts with country code — trust it
    if (cleaned.length > 10 && cleaned.startsWith(defaultCountryCode)) {
        return cleaned;
    }

    // Fallback
    if (cleaned.length <= 10) {
        return defaultCountryCode + cleaned;
    }

    return cleaned;
}

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Authenticate
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    let userId;
    try {
        userId = await verifyFirebaseToken(authHeader.split('Bearer ')[1]);
    } catch (err) {
        return res.status(401).json({ error: 'Invalid authentication: ' + err.message });
    }

    const { action, ...params } = req.body;

    try {
        switch (action) {

            // ─── Check WABA connection status ───
            case 'status': {
                const configured = !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_ID);
                return res.status(200).json({
                    data: { connected: configured, phoneId: configured ? WHATSAPP_PHONE_ID : null },
                    error: null
                });
            }

            // ─── Send Interactive Message with CTA button ───
            // This is the key feature: sends automated message from central number
            // with a "Chat with Property" button that opens the property's direct WhatsApp
            case 'sendInteractive': {
                const { to, bodyText, ctaLabel, ctaPhone, headerText, footerText,
                        bookingId, guestName, templateUsed, sentBy, countryCode } = params;

                if (!to || !bodyText) {
                    return res.status(400).json({ error: 'Missing required fields: to, bodyText' });
                }

                const phone = formatPhone(to, countryCode || '91');

                // Build the interactive message payload
                const messagePayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: phone,
                    type: 'interactive',
                    interactive: {
                        type: 'cta_url',
                        header: headerText ? { type: 'text', text: headerText } : undefined,
                        body: { text: bodyText },
                        footer: footerText ? { text: footerText } : undefined,
                        action: {
                            name: 'cta_url',
                            parameters: {
                                display_text: ctaLabel || 'Chat with Property',
                                url: `https://wa.me/${formatPhone(ctaPhone || to, countryCode || '91')}`
                            }
                        }
                    }
                };

                // Clean undefined fields
                if (!messagePayload.interactive.header) delete messagePayload.interactive.header;
                if (!messagePayload.interactive.footer) delete messagePayload.interactive.footer;

                const result = await waApiCall('messages', messagePayload);

                // Log to DB
                await logToSupabase({
                    booking_id: bookingId || null,
                    guest_name: guestName || null,
                    guest_phone: phone,
                    message_type: 'whatsapp_api',
                    template_used: templateUsed || 'interactive_cta',
                    message_content: bodyText,
                    sent_by: sentBy || 'system',
                    status: 'sent'
                });

                return res.status(200).json({ data: result, error: null });
            }

            // ─── Send plain text message ───
            case 'sendText': {
                const { to, text, bookingId, guestName, templateUsed, sentBy, countryCode } = params;

                if (!to || !text) {
                    return res.status(400).json({ error: 'Missing required fields: to, text' });
                }

                const phone = formatPhone(to, countryCode || '91');

                const result = await waApiCall('messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: phone,
                    type: 'text',
                    text: { preview_url: false, body: text }
                });

                await logToSupabase({
                    booking_id: bookingId || null,
                    guest_name: guestName || null,
                    guest_phone: phone,
                    message_type: 'whatsapp_api',
                    template_used: templateUsed || 'text',
                    message_content: text,
                    sent_by: sentBy || 'system',
                    status: 'sent'
                });

                return res.status(200).json({ data: result, error: null });
            }

            // ─── Send pre-approved template message ───
            case 'send': {
                const { to, templateName, languageCode, components, countryCode } = params;

                if (!to || !templateName) {
                    return res.status(400).json({ error: 'Missing required fields: to, templateName' });
                }

                const phone = formatPhone(to, countryCode || '91');

                const result = await waApiCall('messages', {
                    messaging_product: 'whatsapp',
                    to: phone,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: { code: languageCode || 'en' },
                        components: components || []
                    }
                });

                return res.status(200).json({ data: result, error: null });
            }

            default:
                return res.status(200).json({ data: null, error: { message: 'Unknown action' } });
        }
    } catch (err) {
        console.error('[whatsapp-proxy] Error:', err.message);
        return res.status(200).json({
            data: null,
            error: { message: err.message }
        });
    }
}
