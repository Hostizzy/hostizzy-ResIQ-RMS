/**
 * Notifications Module
 * Handles push notifications, browser notifications, and notification permissions
 */

import { supabase } from './config.js'
import { db } from './database.js'
import { showToast } from './ui.js'

// VAPID public key - Generate at: https://web-push-codelab.glitch.me/
// IMPORTANT: Replace this with your actual VAPID public key
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE'

// ==========================================
// BROWSER NOTIFICATIONS
// ==========================================

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported')
        return false
    }

    if (Notification.permission === 'granted') {
        return true
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        return permission === 'granted'
    }

    return false
}

/**
 * Send browser notification
 */
export function sendNotification(title, body, data = {}) {
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: body,
            icon: 'assets/logo.png',
            badge: 'assets/logo.png',
            tag: data.tag || 'resiq-notification',
            requireInteraction: data.requireInteraction || false,
            data: data
        })

        notification.onclick = () => {
            window.focus()
            if (data.action) {
                try {
                    // Safely execute action
                    if (typeof data.action === 'string' && window[data.action]) {
                        window[data.action]()
                    } else if (typeof data.action === 'function') {
                        data.action()
                    }
                } catch (error) {
                    console.error('Notification action error:', error)
                }
            }
            notification.close()
        }
    }
}

// ==========================================
// PUSH NOTIFICATION SUBSCRIPTION (PWA)
// ==========================================

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush() {
    if (!isPushSupported()) {
        console.log('[Push] Push notifications not supported')
        return null
    }

    try {
        const registration = await navigator.serviceWorker.ready

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription()

        if (subscription) {
            console.log('[Push] Already subscribed')
            return subscription
        }

        // Request notification permission first
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
            console.log('[Push] Notification permission denied')
            return null
        }

        // Subscribe with VAPID key
        if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
            console.log('[Push] VAPID key not configured - using local notifications only')
            return null
        }

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        })

        console.log('[Push] Successfully subscribed:', subscription.endpoint)

        // Store subscription
        await savePushSubscription(subscription)

        return subscription
    } catch (error) {
        console.error('[Push] Subscription failed:', error)
        return null
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
    try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
            await subscription.unsubscribe()
            console.log('[Push] Successfully unsubscribed')
            await removePushSubscription(subscription)
        }
    } catch (error) {
        console.error('[Push] Unsubscribe failed:', error)
    }
}

/**
 * Save subscription to Supabase
 */
async function savePushSubscription(subscription) {
    try {
        const subJSON = subscription.toJSON()
        const userData = JSON.parse(localStorage.getItem('userData') || '{}')

        // Prepare subscription data
        const subscriptionData = {
            user_id: userData?.id || null,
            user_type: 'staff',
            user_email: userData?.email || '',
            endpoint: subscription.endpoint,
            expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
            p256dh_key: subJSON.keys.p256dh,
            auth_key: subJSON.keys.auth,
            user_agent: navigator.userAgent,
            notification_types: ['kyc_submitted', 'payment_received', 'new_booking', 'checkin_today'],
            enabled: true
        }

        // Upsert to database
        const { data, error } = await supabase
            .from('push_subscriptions')
            .upsert(subscriptionData, {
                onConflict: 'endpoint',
                returning: 'representation'
            })

        if (error) throw error

        console.log('[Push] Subscription saved to database:', data)

        // Also save to localStorage as backup
        localStorage.setItem('pushSubscription', JSON.stringify(subJSON))

        showToast('✅ Push notifications enabled', 'You will receive important updates')
        return data
    } catch (error) {
        console.error('[Push] Failed to save subscription:', error)
        showToast('⚠️ Push notifications error', 'Could not enable push notifications')
        throw error
    }
}

/**
 * Remove subscription from Supabase
 */
async function removePushSubscription(subscription) {
    try {
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint)

        if (error) throw error

        console.log('[Push] Subscription removed from database')
        localStorage.removeItem('pushSubscription')

        showToast('🔕 Push notifications disabled', 'You will no longer receive push notifications')
    } catch (error) {
        console.error('[Push] Failed to remove subscription:', error)
        localStorage.removeItem('pushSubscription')
    }
}

/**
 * Get current push subscription status
 */
export async function getPushSubscriptionStatus() {
    if (!isPushSupported()) return { supported: false, subscribed: false }

    try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        return {
            supported: true,
            subscribed: !!subscription,
            subscription: subscription
        }
    } catch (error) {
        return { supported: true, subscribed: false, error: error.message }
    }
}

// ==========================================
// NOTIFICATION TRIGGERS
// ==========================================

/**
 * Helper function to call Edge Function for sending push
 */
async function sendPushNotification(notificationType, payload, options = {}) {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            console.log('[Push] No session, skipping push notification')
            return
        }

        const response = await fetch(`${supabase.supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                notificationType,
                payload,
                ...options
            })
        })

        const result = await response.json()
        console.log('[Push] Notification sent:', result)
        return result
    } catch (error) {
        console.error('[Push] Failed to send notification:', error)
    }
}

/**
 * Notify: KYC Document Submitted
 */
export async function notifyKYCSubmitted(bookingId, guestName) {
    await sendPushNotification('kyc_submitted', {
        title: '📄 New KYC Document',
        body: `${guestName} submitted documents for booking #${bookingId}`,
        icon: '/assets/logo-192.png',
        badge: '/assets/logo-96.png',
        url: `/?view=guest-documents&booking=${bookingId}`,
        requireInteraction: true
    }, {
        userTypes: ['staff'],
        bookingId: bookingId
    })
}

/**
 * Notify: KYC Document Verified
 */
export async function notifyKYCVerified(bookingId, guestName) {
    await sendPushNotification('kyc_verified', {
        title: '✅ Documents Verified',
        body: `Documents for ${guestName} (booking #${bookingId}) have been approved`,
        icon: '/assets/logo-192.png',
        badge: '/assets/logo-96.png',
        url: `/?view=guest-documents&booking=${bookingId}`
    }, {
        bookingId: bookingId
    })
}

/**
 * Notify: Payment Received
 */
export async function notifyPaymentReceived(bookingId, amount, guestName) {
    await sendPushNotification('payment_received', {
        title: '💰 Payment Received',
        body: `${guestName} paid ₹${amount.toLocaleString('en-IN')} for booking #${bookingId}`,
        icon: '/assets/logo-192.png',
        badge: '/assets/logo-96.png',
        url: `/?view=payments&booking=${bookingId}`
    }, {
        userTypes: ['staff', 'admin'],
        bookingId: bookingId
    })
}

/**
 * Notify: New Booking Created
 */
export async function notifyNewBooking(booking) {
    await sendPushNotification('new_booking', {
        title: '🏨 New Booking',
        body: `${booking.guest_name} booked ${booking.property_name} for ${booking.nights} nights`,
        icon: '/assets/logo-192.png',
        badge: '/assets/logo-96.png',
        url: `/?view=reservations&booking=${booking.booking_id}`,
        requireInteraction: false
    }, {
        userTypes: ['staff', 'admin', 'manager'],
        bookingId: booking.booking_id
    })
}

/**
 * Notify: Check-in Today Reminder
 */
export async function notifyCheckinToday(reservations) {
    if (!reservations || reservations.length === 0) return

    const guestList = reservations.map(r => r.guest_name).join(', ')

    await sendPushNotification('checkin_today', {
        title: '🔔 Check-ins Today',
        body: `${reservations.length} guest(s) checking in: ${guestList}`,
        icon: '/assets/logo-192.png',
        badge: '/assets/logo-96.png',
        url: '/?view=reservations&filter=urgent',
        requireInteraction: false
    }, {
        userTypes: ['staff', 'admin', 'manager']
    })
}

/**
 * Notify: Payment Overdue
 */
export async function notifyPaymentOverdue(booking) {
    await sendPushNotification('payment_overdue', {
        title: '⚠️ Payment Overdue',
        body: `Booking #${booking.booking_id} has overdue payment of ₹${booking.balance.toLocaleString('en-IN')}`,
        icon: '/assets/logo-192.png',
        badge: '/assets/logo-96.png',
        url: `/?view=payments&booking=${booking.booking_id}`,
        requireInteraction: true
    }, {
        userTypes: ['admin', 'manager'],
        bookingId: booking.booking_id
    })
}

// ==========================================
// URGENT NOTIFICATIONS CHECKER
// ==========================================

/**
 * Check for urgent notifications (overdue payments, today's check-ins)
 */
export async function checkUrgentNotifications() {
    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) return

    const reservations = await db.getReservations()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Overdue payments
    const overdue = reservations.filter(r => {
        if (r.status === 'cancelled') return false
        const checkIn = new Date(r.check_in)
        checkIn.setHours(0, 0, 0, 0)
        const balance = (parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)
        return balance > 0 && checkIn < today
    })

    if (overdue.length > 0) {
        sendNotification(
            '🔴 Overdue Payments',
            `${overdue.length} booking(s) have overdue payments`,
            {
                tag: 'overdue-payments',
                requireInteraction: true,
                action: "showView('payments')"
            }
        )
    }

    // Today's check-ins
    const todayCheckIns = reservations.filter(r => {
        const checkIn = new Date(r.check_in)
        checkIn.setHours(0, 0, 0, 0)
        return checkIn.getTime() === today.getTime() && r.status !== 'cancelled'
    })

    if (todayCheckIns.length > 0) {
        sendNotification(
            '🏨 Check-ins Today',
            `${todayCheckIns.length} guest(s) checking in today`,
            {
                tag: 'today-checkins',
                action: "applyQuickFilter('urgent')"
            }
        )
    }
}

// ==========================================
// SERVICE WORKER MESSAGE LISTENER
// ==========================================

/**
 * Initialize service worker message listener
 */
export function initializeServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('[SW Message]', event.data)

            if (event.data.type === 'SYNC_RESERVATIONS' ||
                event.data.type === 'SYNC_PAYMENTS' ||
                event.data.type === 'SYNC_ALL') {
                if (typeof window.syncAllPendingData === 'function') {
                    window.syncAllPendingData()
                }
            } else if (event.data.type === 'NOTIFICATION_CLICK') {
                // Handle notification click navigation
                if (event.data.url) {
                    window.location.href = event.data.url
                }
            }
        })

        console.log('✅ Service worker message listener initialized')
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.requestNotificationPermission = requestNotificationPermission
    window.sendNotification = sendNotification
    window.isPushSupported = isPushSupported
    window.subscribeToPush = subscribeToPush
    window.unsubscribeFromPush = unsubscribeFromPush
    window.getPushSubscriptionStatus = getPushSubscriptionStatus
    window.notifyKYCSubmitted = notifyKYCSubmitted
    window.notifyKYCVerified = notifyKYCVerified
    window.notifyPaymentReceived = notifyPaymentReceived
    window.notifyNewBooking = notifyNewBooking
    window.notifyCheckinToday = notifyCheckinToday
    window.notifyPaymentOverdue = notifyPaymentOverdue
    window.checkUrgentNotifications = checkUrgentNotifications
    window.initializeServiceWorkerListener = initializeServiceWorkerListener
}

console.log('✅ Notifications module loaded')
