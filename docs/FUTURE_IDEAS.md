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
