/**
 * Vercel Serverless Function — WhatsApp Webhook
 *
 * Handles incoming WhatsApp messages and status updates from Meta Cloud API.
 * This endpoint is registered in Meta Developer Console as the webhook URL:
 *
 *   Webhook URL: https://resiq.hostizzy.com/api/whatsapp-webhook
 *   Verify Token: Set via WHATSAPP_WEBHOOK_VERIFY_TOKEN env var
 *
 * GET  — Webhook verification (Meta sends a challenge)
 * POST — Incoming messages and delivery status updates
 *
 * Environment variables:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN  — Token you set in Meta Developer Console
 *   SUPABASE_URL                    — For logging incoming messages
 *   SUPABASE_SERVICE_ROLE_KEY       — Supabase service key
 */

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Log incoming message to Supabase
 */
async function logIncomingMessage(record) {
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
        console.error('[whatsapp-webhook] Failed to log:', e.message);
    }
}

export default async function handler(req, res) {
    // ─── GET: Webhook Verification ───
    // Meta sends this when you register the webhook URL
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[whatsapp-webhook] Verification successful');
            return res.status(200).send(challenge);
        }

        console.warn('[whatsapp-webhook] Verification failed — token mismatch');
        return res.status(403).send('Forbidden');
    }

    // ─── POST: Incoming Messages & Status Updates ───
    if (req.method === 'POST') {
        const body = req.body;

        // Meta always wraps in { object: 'whatsapp_business_account', entry: [...] }
        if (body?.object !== 'whatsapp_business_account') {
            return res.status(200).send('OK');
        }

        try {
            for (const entry of (body.entry || [])) {
                for (const change of (entry.changes || [])) {
                    const value = change.value;
                    if (!value) continue;

                    // Handle incoming messages
                    if (value.messages) {
                        for (const msg of value.messages) {
                            const from = msg.from; // sender phone (without +)
                            const contact = value.contacts?.[0];
                            const senderName = contact?.profile?.name || 'Unknown';
                            const msgType = msg.type; // text, image, document, etc.
                            const text = msg.text?.body || msg.caption || `[${msgType}]`;
                            const timestamp = msg.timestamp;

                            console.log(`[whatsapp-webhook] Message from ${senderName} (${from}): ${text}`);

                            // Log to communications table
                            await logIncomingMessage({
                                guest_name: senderName,
                                guest_phone: from,
                                message_type: 'whatsapp_incoming',
                                template_used: 'incoming_' + msgType,
                                message_content: text,
                                sent_by: from,
                                status: 'received',
                                sent_at: timestamp ? new Date(parseInt(timestamp) * 1000).toISOString() : new Date().toISOString()
                            });
                        }
                    }

                    // Handle status updates (sent, delivered, read, failed)
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            console.log(`[whatsapp-webhook] Status: ${status.id} → ${status.status} (to: ${status.recipient_id})`);

                            // Optionally update the communications table status
                            // This could be enhanced to match by message ID
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[whatsapp-webhook] Processing error:', err.message);
        }

        // Always return 200 to Meta (otherwise they'll retry)
        return res.status(200).send('OK');
    }

    return res.status(405).send('Method not allowed');
}
