# Send Push Notification - Edge Function

This Supabase Edge Function sends Web Push notifications to users.

## Setup

### 1. Generate VAPID Keys

Visit: https://web-push-codelab.glitch.me/

Click "Generate" and save both keys.

### 2. Store Keys in Supabase Vault

```bash
# Using Supabase CLI
supabase secrets set VAPID_PUBLIC_KEY="your_public_key_here"
supabase secrets set VAPID_PRIVATE_KEY="your_private_key_here"
supabase secrets set VAPID_SUBJECT="mailto:support@hostizzy.com"
```

Or via Supabase Dashboard:
- Go to Settings → Vault → Secrets
- Add each secret

### 3. Deploy Function

```bash
# Deploy the function
supabase functions deploy send-push

# Or deploy all functions
supabase functions deploy
```

## Usage

### API Endpoint

```
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-push
```

### Authentication

Include Supabase service_role key in header:
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

### Request Body

```json
{
  "notificationType": "kyc_submitted",
  "payload": {
    "title": "New KYC Document",
    "body": "Guest has submitted documents for booking #12345",
    "icon": "/assets/logo-192.png",
    "badge": "/assets/logo-96.png",
    "url": "/?view=guest-documents&booking=12345",
    "requireInteraction": false
  },
  "userTypes": ["staff"],
  "bookingId": "12345",
  "test": false
}
```

### Target Recipients

Specify one or more:
- `userEmails`: Array of email addresses
- `userIds`: Array of user UUIDs
- `userTypes`: Array of user types (`staff`, `owner`, `guest`)
- `bookingId`: Send to users related to this booking

### Response

```json
{
  "message": "Push notifications sent",
  "sent": 5,
  "failed": 0,
  "results": [
    {
      "subscriptionId": "uuid",
      "userEmail": "user@example.com",
      "success": true
    }
  ]
}
```

## Notification Types

Supported notification types:
- `kyc_submitted` - Guest uploaded documents
- `kyc_verified` - Documents approved
- `kyc_rejected` - Documents rejected
- `payment_received` - Payment recorded
- `payment_overdue` - Payment is overdue
- `checkin_today` - Check-in happening today
- `checkout_today` - Check-out happening today
- `new_booking` - New reservation created
- `booking_cancelled` - Reservation cancelled
- `message_received` - New chat message
- `system_alert` - Important system notification

Users can opt-in/out of specific notification types in their profile.

## Testing

Test without sending actual push notifications:

```json
{
  "notificationType": "test",
  "payload": {
    "title": "Test Notification",
    "body": "This is a test"
  },
  "userTypes": ["staff"],
  "test": true
}
```

This will log the notifications without actually sending them.

## Production Considerations

### 1. Use a Push Service (Recommended)

The current implementation is simplified. For production, use:
- **OneSignal** (easiest, has free tier)
- **Firebase Cloud Messaging (FCM)**
- **Amazon SNS**
- **web-push npm package** (if self-hosting)

### 2. Rate Limiting

Add rate limiting to prevent abuse:
```typescript
// Check request count from user in last minute
const { count } = await supabase
  .from('notification_logs')
  .select('*', { count: 'exact' })
  .gte('created_at', new Date(Date.now() - 60000).toISOString())

if (count > 100) {
  return new Response('Rate limit exceeded', { status: 429 })
}
```

### 3. Retry Logic

Add exponential backoff for failed sends:
```typescript
async function sendWithRetry(subscription, payload, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await sendWebPush(subscription, payload)
    if (result.success) return result

    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
  }
  return { success: false, error: 'Max retries exceeded' }
}
```

### 4. Batch Processing

For large numbers of recipients, process in batches:
```typescript
const BATCH_SIZE = 100

for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
  const batch = subscriptions.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(sub => sendWebPush(sub, payload)))
}
```

## Monitoring

Check notification logs:
```sql
SELECT
  notification_type,
  status,
  COUNT(*) as count
FROM notification_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY notification_type, status;
```

Find failed notifications:
```sql
SELECT * FROM notification_logs
WHERE status = 'failed'
AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## Troubleshooting

### "Missing VAPID keys"
- Ensure keys are set in Supabase Vault
- Redeploy function after adding secrets

### "Failed to send notification"
- Check subscription endpoint is valid
- Verify browser still has permission
- Check notification_logs for error messages

### "No subscriptions found"
- User needs to enable push notifications in app
- Check push_subscriptions table has records
- Verify enabled=true in database
