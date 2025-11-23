# Push Notifications Setup Guide

This guide walks you through setting up Web Push notifications for ResIQ.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUSH NOTIFICATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User enables push in browser                               │
│     ↓                                                           │
│  2. Browser creates subscription (endpoint + keys)             │
│     ↓                                                           │
│  3. Frontend saves subscription to push_subscriptions table    │
│     ↓                                                           │
│  4. App event triggers (KYC approved, payment received, etc)   │
│     ↓                                                           │
│  5. Frontend calls Supabase Edge Function                      │
│     ↓                                                           │
│  6. Edge Function sends push to subscribed browsers            │
│     ↓                                                           │
│  7. Browser displays notification                              │
│     ↓                                                           │
│  8. User clicks notification → opens app                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Generate VAPID Keys

VAPID keys authenticate your push messages to browsers.

### Option A: Online Generator (Easiest)

1. Go to: https://web-push-codelab.glitch.me/
2. Click "Generate"
3. Copy both keys (you'll need them in next steps)

### Option B: GitHub Codespaces

1. Open your repo in GitHub Codespaces
2. Run: `npx web-push generate-vapid-keys`
3. Copy the output

**IMPORTANT:** Keep the private key secret! Never commit it to code.

---

## Step 2: Store VAPID Keys

### In Supabase (Required)

1. Go to your Supabase Dashboard
2. Navigate to: **Settings → Vault → Secrets**
3. Add three secrets:

| Name | Value | Example |
|------|-------|---------|
| `VAPID_PUBLIC_KEY` | Your public key | `BEl62iUYgUivxIkv69...` |
| `VAPID_PRIVATE_KEY` | Your private key | `dJ2J1WuLSoZVUhMY...` |
| `VAPID_SUBJECT` | Contact email | `mailto:support@hostizzy.com` |

### In Frontend Code (Required)

1. Open `index.html`
2. Find line ~14111: `const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';`
3. Replace with your actual public key:
   ```javascript
   const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69YjL...';
   ```

---

## Step 3: Run Database Migration

Execute the SQL migration to create required tables.

### Via Supabase Dashboard

1. Go to **SQL Editor**
2. Open `/supabase-migrations/push_subscriptions.sql`
3. Copy and paste the entire file
4. Click "Run"

### Via Supabase CLI (if using)

```bash
supabase db push
```

This creates:
- `push_subscriptions` - Stores browser subscriptions
- `notification_logs` - Tracks sent notifications
- RLS policies for security
- Helper functions for cleanup

---

## Step 4: Deploy Edge Function

The Edge Function handles sending push notifications.

### Via Supabase Dashboard

1. Go to **Edge Functions**
2. Click "Deploy New Function"
3. Name: `send-push`
4. Copy contents from `/supabase/functions/send-push/index.ts`
5. Deploy

### Via Supabase CLI (if using)

```bash
# Deploy single function
supabase functions deploy send-push

# Or deploy all functions
supabase functions deploy
```

---

## Step 5: Enable Push Notifications in App

### For Users (Manual)

Users can enable push in browser when prompted, or by:
1. Clicking notification permission prompt
2. Browser will ask: "Allow resiq.hostizzy.com to send notifications?"
3. Click "Allow"

### Auto-Prompt (Optional)

Uncomment lines 14439-14441 in `index.html`:
```javascript
window.addEventListener('load', () => {
    setTimeout(() => subscribeToPush(), 5000);
});
```

This auto-prompts 5 seconds after page load.

---

## Step 6: Testing

### Test Subscription

1. Open browser console
2. Run: `await subscribeToPush()`
3. Allow notifications
4. Check console for: `[Push] Successfully subscribed`
5. Verify in Supabase:
   ```sql
   SELECT * FROM push_subscriptions WHERE user_email = 'your@email.com';
   ```

### Test Sending Notification

#### Method 1: Via App Events

Trigger any of these actions:
- Approve a KYC document → Sends "Documents Verified"
- Record a payment → Sends "Payment Received"
- Create new booking → Sends "New Booking"

#### Method 2: Direct Edge Function Call

Use Supabase SQL Editor or REST client:

```javascript
// In browser console (after login)
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-push', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    notificationType: 'test',
    payload: {
      title: 'Test Notification',
      body: 'This is a test push notification',
      icon: '/assets/logo-192.png',
      url: '/'
    },
    userTypes: ['staff'],
    test: true  // Set to false to actually send
  })
});

console.log(await response.json());
```

---

## Notification Types Implemented

| Event | Trigger | Recipients | Priority |
|-------|---------|------------|----------|
| **KYC Submitted** | Guest uploads documents | Staff | High |
| **KYC Verified** | Staff approves documents | Guest | Medium |
| **Payment Received** | New payment recorded | Staff, Admin | Medium |
| **New Booking** | Reservation created | Staff, Admin, Manager | Medium |
| **Check-in Today** | Daily cron (planned) | Staff, Admin, Manager | Medium |
| **Payment Overdue** | Daily cron (planned) | Admin, Manager | High |

---

## User Settings (Future Enhancement)

Allow users to customize notification preferences:

```javascript
// In user profile settings
const notificationPreferences = {
  kyc_submitted: true,
  payment_received: true,
  new_booking: false,
  checkin_today: true
};

await supabase
  .from('push_subscriptions')
  .update({ notification_types: Object.keys(notificationPreferences).filter(k => notificationPreferences[k]) })
  .eq('user_email', currentUser.email);
```

---

## Troubleshooting

### "Push notifications not supported"

**Cause:** Browser doesn't support Push API

**Solution:**
- Use Chrome, Firefox, Edge, or Safari (iOS 16.4+)
- Check: `'PushManager' in window` in console
- Ensure site is served over HTTPS

### "Failed to save subscription"

**Cause:** RLS policy blocking insert

**Solution:**
```sql
-- Verify RLS policies allow user to insert
SELECT * FROM push_subscriptions WHERE user_email = 'test@example.com';

-- Check if authenticated
SELECT auth.jwt() ->> 'email';
```

### "VAPID key not configured"

**Cause:** Public key not set in frontend

**Solution:**
- Replace `YOUR_VAPID_PUBLIC_KEY_HERE` with actual key
- Redeploy app

### "No subscriptions found"

**Cause:** User hasn't enabled push yet

**Solution:**
- Call `subscribeToPush()` in console
- Check `push_subscriptions` table has records
- Verify `enabled = true`

### Notifications not showing

**Causes:**
- Browser notifications blocked
- Service worker not registered
- Subscription expired

**Solutions:**
```javascript
// Check notification permission
console.log('Permission:', Notification.permission);

// Check service worker
console.log('SW:', await navigator.serviceWorker.getRegistration());

// Check subscription
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();
console.log('Subscription:', sub);
```

---

## Production Considerations

### 1. Use a Push Service (Recommended)

The current Edge Function is simplified. For production at scale, consider:

| Service | Pros | Cons | Pricing |
|---------|------|------|---------|
| **OneSignal** | Easy setup, free tier | Limited customization | Free up to 10K users |
| **Firebase FCM** | Google-backed, reliable | Requires Firebase | Free |
| **Amazon SNS** | AWS integration | Complex setup | Pay per message |
| **Web-push library** | Full control | Self-hosted | Infrastructure cost |

#### OneSignal Integration Example

```javascript
// 1. Add OneSignal SDK to index.html
<script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" async=""></script>

// 2. Initialize
window.OneSignal = window.OneSignal || [];
OneSignal.push(function() {
  OneSignal.init({
    appId: "YOUR_ONESIGNAL_APP_ID",
  });
});

// 3. Replace sendPushNotification function
async function sendPushNotification(notificationType, payload, options) {
  await OneSignal.sendNotification({
    headings: { en: payload.title },
    contents: { en: payload.body },
    include_segments: [options.userTypes],
    data: payload.data
  });
}
```

### 2. Rate Limiting

Add to Edge Function:
```typescript
// Check if user exceeded rate limit
const { count } = await supabase
  .from('notification_logs')
  .select('*', { count: 'exact' })
  .eq('created_by', userId)
  .gte('created_at', new Date(Date.now() - 60000).toISOString());

if (count > 100) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 3. Scheduled Notifications

Use Supabase pg_cron or external cron:

```sql
-- Daily check-in reminders at 8 AM
SELECT cron.schedule(
  'send-checkin-reminders',
  '0 8 * * *',
  $$
  SELECT send_checkin_reminders();
  $$
);
```

### 4. Monitoring

```sql
-- Delivery success rate
SELECT
  notification_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM notification_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY notification_type;
```

---

## Security Best Practices

1. **Never expose private VAPID key**
   - Keep in Supabase Vault only
   - Don't commit to Git
   - Don't log in console

2. **Validate user permissions**
   - RLS policies enforce who can send
   - Check user role before triggering notifications

3. **Sanitize notification content**
   - Escape HTML in titles/bodies
   - Validate URLs

4. **Implement unsubscribe**
   ```javascript
   async function unsubscribe() {
     await unsubscribeFromPush();
     // User can re-enable anytime
   }
   ```

---

## Next Steps

1. ✅ Complete setup above
2. Test with real users
3. Monitor notification_logs table
4. Consider OneSignal for scale
5. Add user preference UI
6. Implement scheduled notifications
7. Set up monitoring/alerts

---

## Support

- **Supabase Docs**: https://supabase.com/docs/guides/functions
- **Web Push Protocol**: https://web.dev/push-notifications-overview/
- **OneSignal**: https://documentation.onesignal.com/

For questions, check:
- Supabase Dashboard → Logs → Edge Functions
- Browser console for [Push] logs
- `notification_logs` table for delivery status
