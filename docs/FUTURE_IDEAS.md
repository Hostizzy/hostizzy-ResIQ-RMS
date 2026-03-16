# Future Feature Ideas

## Auto-log incoming phone calls as enquiries
**Status:** On hold
**Priority:** TBD

**Concept:** When a call is received on a phone with the PWA installed, automatically create an enquiry in the app.

**Possible approaches:**
1. **Cloud telephony (Twilio/Vonage)** — Route business calls through a VoIP provider that fires webhooks on incoming calls → API creates an enquiry automatically. Cleanest approach, no native app needed.
2. **Android companion app** — Small native app that listens for incoming calls and posts caller info to the Supabase backend.
3. **Android TWA wrapper** — Wrap PWA in a Trusted Web Activity with a native layer for call log access.

**Notes:**
- PWAs cannot access the native call log directly (browser sandboxing).
- Cloud telephony route is recommended — also enables call recording/tracking.

---

## WhatsApp API Integration
**Status:** On hold
**Priority:** TBD

**Concept:** Integrate WhatsApp Business API to enable direct guest communication from within ResIQ.

**Possible approaches:**
1. **WhatsApp Business API (official)** — Apply for Meta Business verification, use the Cloud API to send/receive messages via webhooks. Supports templates, media, and interactive messages.
2. **Third-party providers (Twilio, MessageBird, 360dialog)** — Simplified access to WhatsApp API without direct Meta integration. Faster setup, handles compliance.

**Potential use cases:**
- Send booking confirmations and check-in reminders to guests
- Receive guest enquiries directly into the enquiries module
- Automated responses for common questions (directions, check-in time, WiFi)
- Share guest documents (invoices, receipts) via WhatsApp

**Notes:**
- WhatsApp Business API requires Meta Business verification (can take a few days).
- Template messages must be pre-approved by Meta for outbound messaging.
- Could pair with the auto-log phone calls feature for a unified communications hub.
