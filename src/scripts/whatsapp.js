/**
 * WhatsApp Integration Module
 * Handles WhatsApp message sending, communication logging, and modal management
 */

import { supabase } from './config.js'
import { whatsappTemplates } from './templates.js'
import { setCurrentWhatsAppBooking } from './state.js'
import { showToast } from './ui.js'
import { getCurrentUser } from './auth.js'

// Access state via window for proper reactivity (legacy compatibility)
function getAllReservations() {
    return window.allReservations || []
}

function getCurrentWhatsAppBooking() {
    return window.currentWhatsAppBooking
}

// ============================================
// WHATSAPP MESSAGE GENERATION
// ============================================

export function generateWhatsAppLink(booking, template = 'booking_confirmation', customMessage = null) {
    // Clean phone number (remove spaces, dashes, etc.)
    let phone = (booking.guest_phone || '').replace(/[^0-9]/g, '')

    // Add country code if not present
    if (!phone.startsWith('91') && phone.length === 10) {
        phone = '91' + phone
    }

    // Generate message from template
    const message = customMessage || whatsappTemplates[template](booking)

    // Encode for URL
    const encodedMessage = encodeURIComponent(message)

    // Return WhatsApp Web/App link
    return `https://wa.me/${phone}?text=${encodedMessage}`
}

// ============================================
// SEND WHATSAPP MESSAGE
// ============================================

export async function sendWhatsAppMessage(booking_id, template = 'booking_confirmation', customMessage = null) {
    try {
        console.log('sendWhatsAppMessage called:', booking_id, template)

        // Get booking data
        const booking = getAllReservations().find(r => r.booking_id === booking_id)

        if (!booking) {
            showToast('Error', 'Booking not found', '❌')
            return
        }

        if (!booking.guest_phone) {
            showToast('Error', 'Guest phone number not available', '❌')
            return
        }

        // Generate WhatsApp link
        const whatsappUrl = generateWhatsAppLink(booking, template, customMessage)
        console.log('WhatsApp URL:', whatsappUrl)

        // Open WhatsApp in new tab
        window.open(whatsappUrl, '_blank')

        // Log communication
        const message = customMessage || whatsappTemplates[template](booking)
        const currentUser = getCurrentUser()

        await logCommunication({
            booking_id: booking_id,
            guest_name: booking.guest_name,
            guest_phone: booking.guest_phone,
            message_type: 'whatsapp',
            template_used: template,
            message_content: message,
            sent_by: currentUser?.email || 'system'
        })

        // Show success notification
        showToast('WhatsApp Opened', `Message ready for ${booking.guest_name}`, '📱')

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([10, 50, 10])
        }

    } catch (error) {
        console.error('WhatsApp error:', error)
        showToast('Error', 'Failed to open WhatsApp: ' + error.message, '❌')
    }
}

// ============================================
// COMMUNICATION LOGGING
// ============================================

export async function logCommunication(data) {
    try {
        const { data: result, error } = await supabase
            .from('communications')
            .insert([data])

        if (error) throw error

        console.log('Communication logged:', result)
    } catch (error) {
        console.error('Error logging communication:', error)
        // Don't show error to user, just log it
    }
}

// ============================================
// WHATSAPP MODAL MANAGEMENT
// ============================================

export function openWhatsAppMenu(booking_id) {
    const booking = getAllReservations().find(r => r.booking_id === booking_id)

    if (!booking) {
        showToast('Error', 'Booking not found', '❌')
        return
    }

    if (!booking.guest_phone) {
        showToast('Error', 'Guest phone number not available', '❌')
        return
    }

    setCurrentWhatsAppBooking(booking)

    // Populate guest info
    document.getElementById('whatsappGuestName').textContent = booking.guest_name
    document.getElementById('whatsappGuestPhone').textContent = booking.guest_phone
    document.getElementById('whatsappBookingId').textContent = booking.booking_id

    // Reset form
    const templateSelect = document.getElementById('whatsappTemplate')
    const customGroup = document.getElementById('customMessageGroup')
    const customText = document.getElementById('customMessageText')

    if (templateSelect) templateSelect.value = 'booking_confirmation'
    if (customGroup) customGroup.style.display = 'none'
    if (customText) customText.value = ''

    // Preview message
    previewWhatsAppMessage()

    // Load communication history
    loadCommunicationHistory(booking_id)

    // Show modal
    const modal = document.getElementById('whatsappModal')
    console.log('Modal element:', modal)

    if (modal) {
        modal.classList.add('show')
        console.log('Modal classes:', modal.className)
    } else {
        console.error('Modal element not found!')
    }

    console.log('=== openWhatsAppMenu END ===')
}

export function closeWhatsAppModal() {
    const modal = document.getElementById('whatsappModal')
    if (modal) {
        modal.classList.remove('show')
    }
    setCurrentWhatsAppBooking(null)
}

export function previewWhatsAppMessage() {
    const booking = getCurrentWhatsAppBooking()

    if (!booking) {
        console.log('No current booking')
        return
    }

    const template = document.getElementById('whatsappTemplate')?.value
    const customMessageGroup = document.getElementById('customMessageGroup')
    const preview = document.getElementById('whatsappPreview')

    if (!template || !preview) return

    if (template === 'custom') {
        if (customMessageGroup) customMessageGroup.style.display = 'block'
        const customText = document.getElementById('customMessageText')?.value
        preview.textContent = customText || whatsappTemplates.custom(booking)
    } else {
        if (customMessageGroup) customMessageGroup.style.display = 'none'
        preview.textContent = whatsappTemplates[template](booking)
    }
}

export function confirmSendWhatsApp() {
    const booking = getCurrentWhatsAppBooking()

    if (!booking) {
        showToast('Error', 'No booking selected', '❌')
        return
    }

    const template = document.getElementById('whatsappTemplate')?.value || 'booking_confirmation'
    let customMessage = null

    if (template === 'custom') {
        customMessage = document.getElementById('customMessageText')?.value.trim()
        if (!customMessage) {
            showToast('Error', 'Please enter a custom message', '❌')
            return
        }
    }

    sendWhatsAppMessage(booking.booking_id, template, customMessage)
    closeWhatsAppModal()
}

// ============================================
// COMMUNICATION HISTORY
// ============================================

export async function loadCommunicationHistory(booking_id) {
    try {
        const { data, error } = await supabase
            .from('communications')
            .select('*')
            .eq('booking_id', booking_id)
            .order('sent_at', { ascending: false })
            .limit(10)

        if (error) throw error

        const historyDiv = document.getElementById('communicationHistory')
        if (!historyDiv) return

        if (!data || data.length === 0) {
            historyDiv.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; font-size: 13px;">No messages sent yet</div>'
            return
        }

        historyDiv.innerHTML = data.map(comm => `
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 13px;">📱 ${getTemplateLabel(comm.template_used)}</span>
                    <span style="font-size: 11px; color: var(--text-secondary);">${formatDateTime(comm.sent_at)}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Sent by: ${comm.sent_by || 'Unknown'}
                </div>
            </div>
        `).join('')

    } catch (error) {
        console.error('Error loading history:', error)
        const historyDiv = document.getElementById('communicationHistory')
        if (historyDiv) {
            historyDiv.innerHTML = '<div style="color: var(--danger); font-size: 13px;">Failed to load history</div>'
        }
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTemplateLabel(template) {
    const labels = {
        'booking_confirmation': 'Booking Confirmation',
        'payment_reminder': 'Payment Reminder',
        'check_in_instructions': 'Check-in Instructions',
        'thank_you': 'Thank You Message',
        'custom': 'Custom Message'
    }
    return labels[template] || 'Message'
}

export function formatDateTime(dateString) {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    })
}

// Make available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.generateWhatsAppLink = generateWhatsAppLink
    window.sendWhatsAppMessage = sendWhatsAppMessage
    window.logCommunication = logCommunication
    window.openWhatsAppMenu = openWhatsAppMenu
    window.closeWhatsAppModal = closeWhatsAppModal
    window.previewWhatsAppMessage = previewWhatsAppMessage
    window.confirmSendWhatsApp = confirmSendWhatsApp
    window.loadCommunicationHistory = loadCommunicationHistory
    window.getTemplateLabel = getTemplateLabel
    window.formatDateTime = formatDateTime
}
