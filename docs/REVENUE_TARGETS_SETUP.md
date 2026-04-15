# Monthly Revenue Targets — Setup Guide

This feature adds:

1. **A 3-tier monthly revenue target** (default ₹40L / ₹50L / ₹60L, admin-editable)
2. **Target-progress card** on the Home and Dashboard views with linear projection, per-tier "projected hit day", and gap analysis
3. **Daily 7 AM IST email** to `stay@hostizzy.com` + **inline section** in the existing daily-summary email
4. **Daily 7 AM IST WhatsApp broadcast** (approved template) to every active team member
5. **Manual "Send WA Now"** button for admins (template broadcast)
6. **Manual "Share"** button for everyone (captures the card as a PNG image and shares via native share sheet → WhatsApp/Telegram/anywhere)
7. **Milestone auto-celebration** — first time MTD crosses Tier 1/2/3 in a month, a celebratory email + optional WA template fire automatically
8. **Web Push notifications** (opt-in, PWA) for daily updates and milestones

This guide walks through everything you need to turn it all on.

---

## Order of operations

1. Apply SQL migrations (Supabase)
2. Add phone numbers to existing team members
3. Submit the WhatsApp templates for Meta approval
4. Generate VAPID keys
5. Set Vercel environment variables
6. Deploy & verify

---

## 1. SQL migrations (Supabase)

Apply these files in order via the Supabase SQL editor:

| File | Adds |
|---|---|
| `sql/round6-revenue-targets.sql` | `revenue_targets` table (singleton row id=1) + `team_members.phone` column + RLS |
| `sql/round6b-milestone-tracking.sql` | `last_tier_crossed_level` + `last_tier_crossed_month` columns on `revenue_targets` |
| `sql/round6c-push-subscriptions.sql` | `push_subscriptions` table + RLS |

Verify after each:

```sql
SELECT * FROM revenue_targets;                 -- one row, default tiers
\d team_members                                 -- should now include phone
SELECT count(*) FROM push_subscriptions;        -- 0 (populates as users opt in)
```

> **Note on RLS vs service-role**: The app's `/api/db-proxy` uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. The RLS policies in these migrations protect *direct* Supabase access (e.g. from a different client using the anon key). Admin-only writes in the app are additionally enforced client-side by hiding the Edit/Send-WA-Now buttons unless `currentUser.role === 'admin'`.

---

## 2. Populate team-member phone numbers

Without phone numbers, the daily WhatsApp broadcast has nobody to send to.

Either edit existing rows in Supabase Studio:

```sql
UPDATE team_members SET phone = '+91 98765 43210' WHERE email = 'someone@example.com';
```

…or re-add the member from the Team page — the modal now has a Phone field.

Accepted formats (normalized server-side to E.164):
- `9876543210` → auto-prefixed to `919876543210`
- `+91 98765 43210` / `91-98765-43210` / any variation → non-digits stripped

Members without a phone are **skipped silently** (no error) and listed in the `skipped` count of the response.

---

## 3. WhatsApp templates (Meta Business Manager)

Create these templates under **WhatsApp Manager → Message Templates → Create Template**.

### 3.1 Daily target update (required)

- **Name**: `daily_sales_target_update`
- **Category**: Utility
- **Language**: English (US) — `en`
- **Body (7 variables — keep order exactly):**

```
*Hostizzy Daily Sales Update*

Day {{1}} of {{2}}
MTD Revenue: {{3}}

Tier 1 (₹40L): {{4}}% achieved
Tier 2 (₹50L): {{5}}% achieved
Tier 3 (₹60L): {{6}}% achieved

Daily run-rate needed for Tier 1: {{7}}/day
```

**Sample variable values** (required by Meta at submission time):

| # | Sample |
|---|---|
| 1 | 15 |
| 2 | 30 |
| 3 | ₹20L |
| 4 | 50.0 |
| 5 | 40.0 |
| 6 | 33.3 |
| 7 | ₹1,33,333 |

Approval turnaround: a few hours to a day. Once approved, set `WA_DAILY_TARGET_TEMPLATE=daily_sales_target_update` on Vercel.

Until this template is approved, the cron sends email + push, and logs a warning for the WA portion. Nothing breaks.

### 3.2 Milestone celebration (optional)

Only needed if you want WhatsApp in addition to the celebration email when a tier is crossed.

- **Name**: `tier_milestone_celebration`
- **Category**: Utility
- **Body (5 variables):**

```
🎉 *Tier {{1}} smashed!*

We crossed {{2}} — MTD is now {{3}}.
Day {{4}} of {{5}}. Keep the momentum going!
```

Once approved, set `WA_MILESTONE_TEMPLATE=tier_milestone_celebration`.

---

## 4. Generate VAPID keys (for Web Push)

VAPID (Voluntary Application Server Identification) is how the browser's push service verifies push messages came from your server. You generate **one keypair per environment** — same keypair is reused forever; regenerating invalidates every existing subscription.

### Option A — one-off CLI (recommended)

```bash
npx web-push generate-vapid-keys
```

Output looks like:

```
=======================================

Public Key:
BNrs... (87 base64url characters)

Private Key:
xYz1... (43 base64url characters)

=======================================
```

> The command runs `web-push`'s CLI without installing it globally. No project setup needed. Works in any directory.

### Option B — Node one-liner (if `npx` is unavailable)

```bash
node -e "const k = require('web-push').generateVAPIDKeys(); console.log(JSON.stringify(k, null, 2));"
```

(Requires `web-push` to already be in a nearby `node_modules` — from this repo's root it works after `npm install`.)

### Option C — online generator (fallback)

For one-off convenience, Mozilla hosts a generator at [`https://vapidkeys.com/`](https://vapidkeys.com/). Only use this for dev/testing; never paste production private keys into third-party sites.

### Paste the keys into Vercel

```
VAPID_PUBLIC_KEY   = BNrs…(the long one starting with B)
VAPID_PRIVATE_KEY  = xYz1…(the shorter one)
VAPID_SUBJECT      = mailto:stay@hostizzy.com
```

`VAPID_SUBJECT` must be a valid `mailto:` or `https:` URL — the push service uses it to contact you if your pushes misbehave.

### Rotating keys

If you ever regenerate the keys, every existing subscription becomes invalid and returns `410 Gone` on the first send. The cron auto-prunes these. Users will need to re-click "Notifications" on the dashboard card.

---

## 5. Vercel environment variables

| Name | Required? | Value / note |
|---|---|---|
| `SUPABASE_URL` | ✅ | already set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | already set |
| `FIREBASE_API_KEY` | ✅ | already set |
| `CRON_SECRET` | ✅ | already set |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | ✅ | already set (daily summary email) |
| `DAILY_SUMMARY_EMAIL` | ✅ | already set (admin recipient) |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_ID` | ✅ | already set |
| `STAY_EMAIL_RECIPIENT` | optional | defaults to `stay@hostizzy.com` |
| `WA_DAILY_TARGET_TEMPLATE` | **new** | exact Meta template name, e.g. `daily_sales_target_update` |
| `WA_DAILY_TARGET_LANGUAGE` | optional | defaults to `en` |
| `WA_MILESTONE_TEMPLATE` | optional | enables WA for milestone crossings |
| `VAPID_PUBLIC_KEY` | **new** | from step 4 |
| `VAPID_PRIVATE_KEY` | **new** | from step 4 — keep secret |
| `VAPID_SUBJECT` | **new** | `mailto:stay@hostizzy.com` |

After changing env vars, redeploy (Vercel does not pick up changes until the next deploy).

---

## 6. Verification checklist

### 6.1 Dashboard card

1. Open `/app` → **Home** tab → scroll down to "Monthly Revenue Target". The card should show MTD, 3 tier progress bars with percentages, projection banner, and the "Projected hit: day N" / ✅ / ⚠️ indicator per tier.
2. Switch to **Dashboard** tab → same card, plus four buttons in the header: Share, Notifications, and (if admin) Edit + Send WA Now.
3. Click **Edit** (admin only) → change Tier 1 to `4500000` → Save → card re-renders with updated percentages. Reload — value persists.
4. Click **Share** → on mobile, native share sheet opens with a PNG of the card. On desktop, PNG downloads + WhatsApp Web opens.
5. Click **Notifications** → browser permission prompt → on grant, button updates to "Notifications On — Disable". Click again to unsubscribe.

### 6.2 Manual WA broadcast (admin)

1. Click **Send WA Now** → confirm → toast shows "Sent to N of M · Skipped S (no phone) · Failed F".
2. Each active team member with a phone should receive the daily-sales-target-update WhatsApp template message.

### 6.3 Cron dry run

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://resiq.hostizzy.com/api/daily-summary
```

Expected 200 response body includes:

```json
{
  "message": "Daily summary sent",
  "sentTo": ["admin@hostizzy.com", "..."],
  "stats": { ... },
  "targetUpdate": {
    "email": "sent",
    "wa": { "sent": 3, "skipped": 0, "failed": 0, "details": [...] },
    "push": { "sent": 2, "pruned": 0, "failed": 0 }
  },
  "milestone": { "crossed": false, "previous": 0, "current": 0 }
}
```

The admin email should include the new 🎯 *Monthly Revenue Target* section with the projection banner and per-tier projected-hit column.

### 6.4 Milestone fire (force a test crossing)

1. In Supabase SQL editor: `UPDATE revenue_targets SET tier_1 = 10000 WHERE id = 1;` (lower tier so MTD already crosses it)
2. Also: `UPDATE revenue_targets SET last_tier_crossed_level = 0, last_tier_crossed_month = NULL WHERE id = 1;` (reset state)
3. Run the cron curl above.
4. The response's `milestone` object should show `{ crossed: true, previous: 0, current: 1, fires: [{ level: 1, email: "sent", ... }] }`.
5. Check `stay@hostizzy.com` inbox for the celebration email.
6. Check `revenue_targets` — `last_tier_crossed_level` should now be 1. Run the cron again → milestone should NOT re-fire.
7. Restore real tier values afterward.

### 6.5 Push notification sanity check

With VAPID keys set and at least one subscribed device:

```bash
curl -X POST https://resiq.hostizzy.com/api/send-push \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"broadcast","title":"Test push","body":"Hello from ResIQ"}'
```

Expected: a notification pops on every subscribed device. Response body includes `{ sent, pruned, failed }`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Card says "Could not load revenue targets" | `sql/round6-revenue-targets.sql` not applied, OR `revenue_targets` missing from `api/db-proxy.js` ALLOWED_TABLES (already fixed in commit `fd75a0f`) |
| Cron response: `wa.skippedReason: "template-not-configured"` | `WA_DAILY_TARGET_TEMPLATE` env var not set on Vercel |
| Cron response: `wa.details[].error: "(#132) Template ... does not exist"` | Template name misspelled, or not yet approved by Meta |
| Cron response: `wa.details[].error: "(#131051) ... unsupported message type"` | Sending as type `template` requires the template to be approved and in an active state — check Meta Business Manager |
| Notification button says "Notifications Blocked" | User previously denied — they must unblock in the browser's site settings |
| Push broadcast returns `{ error: "VAPID keys not configured" }` | `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` missing or stale env vars — redeploy after setting |
| Push send returns 403 / invalid JWT | VAPID keypair doesn't match — regenerate both and re-subscribe (every device must re-click Notifications) |
| Milestone fires every day | `last_tier_crossed_level` / `last_tier_crossed_month` not persisted — check cron logs for `[milestone] Failed to persist crossed state` |

---

## Files reference

| Path | Purpose |
|---|---|
| `sql/round6-revenue-targets.sql` | Targets table + team phone |
| `sql/round6b-milestone-tracking.sql` | Milestone state columns |
| `sql/round6c-push-subscriptions.sql` | Push-subscription storage |
| `api/daily-summary.js` | Extended cron — target dispatch + milestone + push |
| `api/send-target-whatsapp.js` | Admin manual broadcast endpoint |
| `api/send-push.js` | Web Push send/subscribe endpoint |
| `api/db-proxy.js` | Allowlist gate (includes `revenue_targets`) |
| `js/dashboard.js` | `renderRevenueTargets`, share, edit, send-WA, push toggle |
| `js/push-notifications.js` | Client push subscribe/unsubscribe helper |
| `js/reservations.js` | Home-view hook into `renderRevenueTargets` |
| `js/db.js` | `getRevenueTargets` + `updateRevenueTargets` |
| `js/team.js` | Phone field persistence |
| `sw.js` | Existing push / notificationclick handlers (unchanged) |

---

## Related commits on this branch

- `16eacf3` — initial Round 6 (targets, daily email, WA broadcast, manual buttons, phone field)
- `fd75a0f` — allow `revenue_targets` through db-proxy
- `cda26a7` — manual Share button + inline target section in daily email
- `dd5d9ab` — Share captures actual card image via `html2canvas`
- `4557585` — projection + per-tier projected-hit day
- `b810335` — milestone auto-celebration (email + optional WA)
- `3df20b3` — Web Push stack end-to-end
