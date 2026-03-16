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
 * Webhook: https://hostos.hostizzy.com/api/webhooks/whatsapp (shared with Hostos)
 * ResIQ does NOT have its own inbox — CTA buttons direct guests to reply
 * to a property-specific WhatsApp number instead.
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
    console.log(`[whatsapp-proxy] Calling ${endpoint} → to: ${body?.to}`);
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
        const errCode = data?.error?.code || response.status;
        const errMsg = data?.error?.message || `WhatsApp API error: ${response.status}`;
        console.error(`[whatsapp-proxy] API error ${errCode}: ${errMsg}`);
        throw new Error(`[${errCode}] ${errMsg}`);
    }

    // Validate that WhatsApp actually accepted the message
    if (endpoint === 'messages' && (!data.messages || !data.messages[0]?.id)) {
        console.error('[whatsapp-proxy] No message ID in response:', JSON.stringify(data));
        throw new Error('WhatsApp accepted the request but did not return a message ID');
    }

    const msgId = data.messages?.[0]?.id;
    if (msgId) console.log(`[whatsapp-proxy] Message accepted: ${msgId}`);
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
    let cleaned = (phone || '').replace(/[^0-9+]/g, '');

    // If phone starts with '+', it already has a country code — just strip the +
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.replace(/\+/g, '');
        // International number with explicit country code — trust it as-is
        if (cleaned.length >= 10) {
            console.log(`[whatsapp-proxy] Phone formatted (international): ${cleaned}`);
            return cleaned;
        }
    }

    // Remove all remaining non-digits
    cleaned = cleaned.replace(/[^0-9]/g, '');

    // Remove leading 0 (Indian STD format: 079XXXXXXX → 79XXXXXXX)
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // Already has country code + 10 digits (for default country)
    if (cleaned.startsWith(defaultCountryCode) && cleaned.length === (defaultCountryCode.length + 10)) {
        console.log(`[whatsapp-proxy] Phone formatted (with CC): ${cleaned}`);
        return cleaned;
    }

    // Exactly 10 digits — add default country code
    if (cleaned.length === 10) {
        const result = defaultCountryCode + cleaned;
        console.log(`[whatsapp-proxy] Phone formatted (added CC ${defaultCountryCode}): ${result}`);
        return result;
    }

    // Longer than 10, starts with country code — trust it
    if (cleaned.length > 10 && cleaned.startsWith(defaultCountryCode)) {
        console.log(`[whatsapp-proxy] Phone formatted (long with CC): ${cleaned}`);
        return cleaned;
    }

    // Longer than 12 digits likely already has an international code — trust it
    if (cleaned.length > 12) {
        console.log(`[whatsapp-proxy] Phone formatted (long international): ${cleaned}`);
        return cleaned;
    }

    // Fallback: add default country code for short numbers
    if (cleaned.length <= 10) {
        const result = defaultCountryCode + cleaned;
        console.log(`[whatsapp-proxy] Phone formatted (fallback): ${result}`);
        return result;
    }

    console.log(`[whatsapp-proxy] Phone formatted (as-is): ${cleaned}`);
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

                let result;
                let msgType = 'interactive_cta';

                try {
                    result = await waApiCall('messages', messagePayload);
                } catch (interactiveErr) {
                    // Error 131047 = outside 24-hour window, need template message
                    // Error 131026 = message type not supported / recipient can't receive
                    const errMsg = interactiveErr.message || '';
                    const isSessionError = errMsg.includes('131047') || errMsg.includes('131026')
                        || errMsg.includes('re-engage') || errMsg.includes('24');

                    if (isSessionError) {
                        console.log('[whatsapp-proxy] Interactive msg failed (outside 24h window), falling back to text template');
                        // Fallback: send as plain text (works if within session) or re-throw
                        // For outside 24h window, only approved templates work
                        // Try sending as plain text first (in case it's a different session issue)
                        try {
                            result = await waApiCall('messages', {
                                messaging_product: 'whatsapp',
                                recipient_type: 'individual',
                                to: phone,
                                type: 'text',
                                text: { preview_url: false, body: bodyText }
                            });
                            msgType = 'text_fallback';
                            console.log('[whatsapp-proxy] Text fallback succeeded');
                        } catch (textErr) {
                            // Both interactive and text failed — need a pre-approved template
                            console.error('[whatsapp-proxy] Text fallback also failed:', textErr.message);
                            throw new Error(
                                'Message cannot be delivered: guest has not messaged this number in the last 24 hours. ' +
                                'Use a pre-approved WhatsApp template instead, or ask the guest to message you first.'
                            );
                        }
                    } else {
                        throw interactiveErr;
                    }
                }

                // Log to DB with actual message ID for tracking
                const waMessageId = result?.messages?.[0]?.id || null;
                await logToSupabase({
                    booking_id: bookingId || null,
                    guest_name: guestName || null,
                    guest_phone: phone,
                    message_type: 'whatsapp_api',
                    template_used: templateUsed || msgType,
                    message_content: bodyText,
                    sent_by: sentBy || 'system',
                    status: 'sent',
                    wa_message_id: waMessageId
                });

                return res.status(200).json({
                    data: result,
                    error: null,
                    meta: { formattedPhone: phone, messageId: waMessageId, type: msgType }
                });
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
