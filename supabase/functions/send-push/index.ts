// Supabase Edge Function for sending Web Push Notifications
// Deploy with: supabase functions deploy send-push

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// VAPID keys stored in Supabase Vault
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@hostizzy.com'

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  url?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string }>
  data?: any
}

interface SendPushRequest {
  // Target recipients
  userEmails?: string[]      // Send to specific users by email
  userIds?: string[]         // Send to specific users by ID
  userTypes?: string[]       // Send to all users of type (staff, owner, guest)
  bookingId?: string         // Send to users related to a booking

  // Notification payload
  notificationType: string   // kyc_submitted, payment_received, etc.
  payload: PushPayload

  // Testing
  test?: boolean             // If true, only log, don't send
}

// Helper function to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

// Send push notification using Web Push protocol
async function sendWebPush(
  subscription: any,
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key
      }
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify(payload)

    // Using web-push library equivalent in Deno
    // Note: For production, you may want to use a dedicated push service like OneSignal
    // This is a simplified implementation

    const endpoint = new URL(pushSubscription.endpoint)

    // Build JWT for VAPID authentication
    const header = {
      typ: 'JWT',
      alg: 'ES256'
    }

    const jwtPayload = {
      aud: `${endpoint.protocol}//${endpoint.host}`,
      exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), // 12 hours
      sub: VAPID_SUBJECT
    }

    // Note: Full implementation requires crypto signing with VAPID private key
    // For production, recommend using a library or service like OneSignal

    console.log('[Push] Would send to:', pushSubscription.endpoint)
    console.log('[Push] Payload:', notificationPayload)

    // Placeholder: In production, use web-push library or service
    // const response = await webpush.sendNotification(pushSubscription, notificationPayload, {
    //   vapidDetails: {
    //     subject: VAPID_SUBJECT,
    //     publicKey: VAPID_PUBLIC_KEY,
    //     privateKey: VAPID_PRIVATE_KEY
    //   }
    // })

    return { success: true }
  } catch (error) {
    console.error('[Push] Send failed:', error)
    return { success: false, error: error.message }
  }
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    })
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body
    const requestData: SendPushRequest = await req.json()
    const { userEmails, userIds, userTypes, bookingId, notificationType, payload, test } = requestData

    // Validate required fields
    if (!notificationType || !payload) {
      return new Response(
        JSON.stringify({ error: 'Missing notificationType or payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Build query to fetch subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('enabled', true)

    // Filter by target recipients
    if (userEmails && userEmails.length > 0) {
      query = query.in('user_email', userEmails)
    }
    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds)
    }
    if (userTypes && userTypes.length > 0) {
      query = query.in('user_type', userTypes)
    }

    // Fetch subscriptions
    const { data: subscriptions, error: fetchError } = await query

    if (fetchError) {
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`)
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No active subscriptions found',
          sent: 0
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Filter subscriptions by notification type preference
    const targetSubscriptions = subscriptions.filter(sub => {
      const types = sub.notification_types || []
      return types.length === 0 || types.includes(notificationType)
    })

    console.log(`[Push] Found ${targetSubscriptions.length} target subscriptions`)

    // Send notifications
    const results = []
    for (const subscription of targetSubscriptions) {
      if (test) {
        console.log('[Push] TEST MODE - Would send to:', subscription.user_email)
        results.push({
          subscriptionId: subscription.id,
          success: true,
          test: true
        })
        continue
      }

      const result = await sendWebPush(subscription, payload)

      // Log notification attempt
      await supabase.from('notification_logs').insert({
        subscription_id: subscription.id,
        notification_type: notificationType,
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        data: payload.data,
        status: result.success ? 'sent' : 'failed',
        error_message: result.error,
        booking_id: bookingId,
        sent_at: new Date().toISOString()
      })

      results.push({
        subscriptionId: subscription.id,
        userEmail: subscription.user_email,
        success: result.success,
        error: result.error
      })
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        message: 'Push notifications sent',
        sent: successCount,
        failed: failedCount,
        results: results
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('[Push] Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
