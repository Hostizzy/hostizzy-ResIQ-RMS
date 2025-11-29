/**
 * Unified Communications Hub
 * Handles WhatsApp, Email, SMS, and communication history
 */

import { supabase } from './config.js'
import { showToast, showLoading, hideLoading } from './ui.js'
import { getCurrentUser } from './auth.js'
import { whatsappTemplates } from './templates.js'

// ============================================
// COMMUNICATION CHANNELS
// ============================================

const CHANNELS = {
    WHATSAPP: 'whatsapp',
    EMAIL: 'email',
    SMS: 'sms',
    PHONE: 'phone',
    INTERNAL: 'internal'
}

// ============================================
// SEND COMMUNICATION
// ============================================

export async function sendCommunication(params) {
    const { channel, booking_id, recipient, message, template, subject } = params

    try {
        showLoading(`Sending ${channel}...`)

        // Get booking details if booking_id provided
        let booking = null
        if (booking_id) {
            const { data, error } = await supabase
                .from('reservations')
                .select('*')
                .eq('booking_id', booking_id)
                .single()

            if (error) throw error
            booking = data
        }

        let result = null

        switch (channel) {
            case CHANNELS.WHATSAPP:
                result = await sendWhatsApp({ booking, recipient, message, template })
                break

            case CHANNELS.EMAIL:
                result = await sendEmail({ booking, recipient, message, subject, template })
                break

            case CHANNELS.SMS:
                result = await sendSMS({ booking, recipient, message, template })
                break

            default:
                throw new Error(`Unsupported channel: ${channel}`)
        }

        // Log communication
        await logCommunication({
            booking_id,
            channel,
            recipient,
            message,
            template,
            subject,
            status: result.status || 'sent'
        })

        hideLoading()
        showToast('Success', `${channel.toUpperCase()} sent successfully`, '✅')

        return result

    } catch (error) {
        console.error(`Send ${channel} error:`, error)
        hideLoading()
        showToast('Error', `Failed to send ${channel}: ` + error.message, '❌')
        throw error
    }
}

// ============================================
// WHATSAPP INTEGRATION
// ============================================

async function sendWhatsApp({ booking, recipient, message, template }) {
    try {
        // Clean phone number
        let phone = recipient || booking?.guest_phone || ''
        phone = phone.replace(/[^0-9]/g, '')

        if (!phone) {
            throw new Error('Phone number is required')
        }

        // Add country code if not present (India default)
        if (!phone.startsWith('91') && phone.length === 10) {
            phone = '91' + phone
        }

        // Generate message from template if provided
        let finalMessage = message
        if (template && whatsappTemplates[template]) {
            finalMessage = whatsappTemplates[template](booking)
        }

        if (!finalMessage) {
            throw new Error('Message content is required')
        }

        // Encode for URL
        const encodedMessage = encodeURIComponent(finalMessage)

        // Generate WhatsApp Web/App link
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`

        // Open WhatsApp in new tab
        window.open(whatsappUrl, '_blank')

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([10, 50, 10])
        }

        return {
            status: 'opened',
            phone,
            message: finalMessage,
            url: whatsappUrl
        }

    } catch (error) {
        console.error('WhatsApp error:', error)
        throw error
    }
}

// ============================================
// EMAIL INTEGRATION
// ============================================

async function sendEmail({ booking, recipient, message, subject, template }) {
    try {
        const email = recipient || booking?.guest_email || ''

        if (!email) {
            throw new Error('Email address is required')
        }

        // Email templates
        const emailTemplates = {
            booking_confirmation: {
                subject: `Booking Confirmation - ${booking?.booking_id || ''}`,
                body: generateBookingConfirmationEmail(booking)
            },
            payment_reminder: {
                subject: `Payment Reminder - ${booking?.booking_id || ''}`,
                body: generatePaymentReminderEmail(booking)
            },
            check_in_instructions: {
                subject: `Check-in Instructions - ${booking?.property_name || ''}`,
                body: generateCheckInInstructionsEmail(booking)
            },
            thank_you: {
                subject: `Thank You for Staying with Us!`,
                body: generateThankYouEmail(booking)
            },
            invoice: {
                subject: `Invoice - ${booking?.booking_id || ''}`,
                body: generateInvoiceEmail(booking)
            }
        }

        let emailSubject = subject
        let emailBody = message

        if (template && emailTemplates[template]) {
            emailSubject = emailSubject || emailTemplates[template].subject
            emailBody = emailBody || emailTemplates[template].body
        }

        if (!emailSubject || !emailBody) {
            throw new Error('Email subject and body are required')
        }

        // For now, open mailto link (can be replaced with actual email service)
        const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
        window.open(mailtoLink)

        // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
        // const emailResult = await sendViaEmailService({ email, subject: emailSubject, body: emailBody })

        return {
            status: 'opened',
            email,
            subject: emailSubject,
            body: emailBody
        }

    } catch (error) {
        console.error('Email error:', error)
        throw error
    }
}

// Email template generators
function generateBookingConfirmationEmail(booking) {
    return `Dear ${booking.guest_name},

Thank you for your booking! We're excited to host you.

Booking Details:
- Booking ID: ${booking.booking_id}
- Property: ${booking.property_name}
- Check-in: ${formatDate(booking.check_in)}
- Check-out: ${formatDate(booking.check_out)}
- Guests: ${booking.guests || 'N/A'}
- Total Amount: ₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}

We'll send you check-in instructions closer to your arrival date.

Looking forward to hosting you!

Best regards,
Team Hostizzy`
}

function generatePaymentReminderEmail(booking) {
    return `Dear ${booking.guest_name},

This is a friendly reminder about the pending payment for your booking.

Booking Details:
- Booking ID: ${booking.booking_id}
- Property: ${booking.property_name}
- Check-in: ${formatDate(booking.check_in)}

Please complete your payment at your earliest convenience.

For any questions, please don't hesitate to reach out.

Best regards,
Team Hostizzy`
}

function generateCheckInInstructionsEmail(booking) {
    return `Dear ${booking.guest_name},

We're looking forward to welcoming you tomorrow! Here are your check-in instructions:

Property: ${booking.property_name}
Check-in Time: 2:00 PM onwards
Check-out Time: 11:00 AM

[Add specific check-in instructions here]

Have a wonderful stay!

Best regards,
Team Hostizzy`
}

function generateThankYouEmail(booking) {
    return `Dear ${booking.guest_name},

Thank you for staying with us at ${booking.property_name}!

We hope you had a wonderful experience. Your feedback is valuable to us, and we'd love to hear about your stay.

We look forward to hosting you again in the future!

Warm regards,
Team Hostizzy`
}

function generateInvoiceEmail(booking) {
    return `Dear ${booking.guest_name},

Please find attached your invoice for the recent stay at ${booking.property_name}.

Booking ID: ${booking.booking_id}
Check-in: ${formatDate(booking.check_in)}
Check-out: ${formatDate(booking.check_out)}

Thank you for your business!

Best regards,
Team Hostizzy`
}

// ============================================
// SMS INTEGRATION
// ============================================

async function sendSMS({ booking, recipient, message, template }) {
    try {
        let phone = recipient || booking?.guest_phone || ''
        phone = phone.replace(/[^0-9]/g, '')

        if (!phone) {
            throw new Error('Phone number is required')
        }

        // SMS templates
        const smsTemplates = {
            booking_confirmation: `Hi ${booking?.guest_name}, your booking ${booking?.booking_id} at ${booking?.property_name} is confirmed. Check-in: ${formatDate(booking?.check_in)}. Team Hostizzy`,
            payment_reminder: `Hi ${booking?.guest_name}, reminder: Payment pending for booking ${booking?.booking_id}. Please complete at your earliest. Team Hostizzy`,
            check_in_instructions: `Hi ${booking?.guest_name}, welcome! Your check-in at ${booking?.property_name} is from 2 PM. Contact us for any assistance. Team Hostizzy`,
            thank_you: `Thank you for staying with us, ${booking?.guest_name}! We hope to host you again soon. Team Hostizzy`
        }

        let finalMessage = message
        if (template && smsTemplates[template]) {
            finalMessage = smsTemplates[template]
        }

        if (!finalMessage) {
            throw new Error('Message content is required')
        }

        // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
        // For now, show in console
        console.log(`SMS to ${phone}: ${finalMessage}`)

        showToast('Info', 'SMS service integration pending. Message logged to console.', 'ℹ️')

        return {
            status: 'pending',
            phone,
            message: finalMessage
        }

    } catch (error) {
        console.error('SMS error:', error)
        throw error
    }
}

// ============================================
// COMMUNICATION LOGGING
// ============================================

async function logCommunication(data) {
    try {
        const currentUser = getCurrentUser()

        const logEntry = {
            booking_id: data.booking_id,
            channel: data.channel,
            recipient: data.recipient,
            message_content: data.message,
            template_used: data.template,
            subject: data.subject,
            status: data.status || 'sent',
            sent_by: currentUser?.email || 'system',
            sent_at: new Date().toISOString()
        }

        const { error } = await supabase
            .from('communications')
            .insert([logEntry])

        if (error) {
            console.error('Communication logging error:', error)
            // Don't throw - logging failure shouldn't stop communication
        }

    } catch (error) {
        console.error('Log communication error:', error)
        // Silent fail
    }
}

// ============================================
// COMMUNICATION HISTORY
// ============================================

export async function getCommunicationHistory(booking_id, filters = {}) {
    try {
        let query = supabase
            .from('communications')
            .select('*')
            .eq('booking_id', booking_id)
            .order('sent_at', { ascending: false })

        if (filters.channel) {
            query = query.eq('channel', filters.channel)
        }

        if (filters.limit) {
            query = query.limit(filters.limit)
        }

        const { data, error } = await query

        if (error) throw error

        return data || []

    } catch (error) {
        console.error('Get communication history error:', error)
        throw error
    }
}

export async function getAllCommunications(filters = {}) {
    try {
        let query = supabase
            .from('communications')
            .select('*')
            .order('sent_at', { ascending: false })

        if (filters.channel) {
            query = query.eq('channel', filters.channel)
        }

        if (filters.from_date) {
            query = query.gte('sent_at', filters.from_date)
        }

        if (filters.to_date) {
            query = query.lte('sent_at', filters.to_date)
        }

        if (filters.limit) {
            query = query.limit(filters.limit)
        }

        const { data, error } = await query

        if (error) throw error

        return data || []

    } catch (error) {
        console.error('Get all communications error:', error)
        throw error
    }
}

// ============================================
// BULK COMMUNICATIONS
// ============================================

export async function sendBulkCommunication(params) {
    const { channel, booking_ids, template, message, subject } = params

    try {
        showLoading(`Sending bulk ${channel}...`)

        const results = []

        for (const booking_id of booking_ids) {
            try {
                const result = await sendCommunication({
                    channel,
                    booking_id,
                    template,
                    message,
                    subject
                })
                results.push({ booking_id, status: 'success', result })
            } catch (error) {
                results.push({ booking_id, status: 'failed', error: error.message })
            }
        }

        hideLoading()

        const successCount = results.filter(r => r.status === 'success').length
        const failCount = results.filter(r => r.status === 'failed').length

        showToast(
            'Bulk Send Complete',
            `Sent: ${successCount}, Failed: ${failCount}`,
            successCount > 0 ? '✅' : '❌'
        )

        return results

    } catch (error) {
        hideLoading()
        showToast('Error', 'Bulk send failed: ' + error.message, '❌')
        throw error
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

export function getChannelIcon(channel) {
    const icons = {
        whatsapp: '📱',
        email: '📧',
        sms: '💬',
        phone: '📞',
        internal: '📝'
    }
    return icons[channel] || '📬'
}

export function getChannelLabel(channel) {
    const labels = {
        whatsapp: 'WhatsApp',
        email: 'Email',
        sms: 'SMS',
        phone: 'Phone Call',
        internal: 'Internal Note'
    }
    return labels[channel] || channel
}

// ============================================
// LOAD COMMUNICATIONS VIEW
// ============================================

export async function loadCommunications() {
    try {
        showLoading('Loading communications...')

        const communications = await getAllCommunications({ limit: 100 })

        // Render communications list
        renderCommunicationsList(communications)

        hideLoading()

    } catch (error) {
        console.error('Load communications error:', error)
        hideLoading()
        showToast('Error', 'Failed to load communications', '❌')
    }
}

function renderCommunicationsList(communications) {
    const tableBody = document.getElementById('communicationsTableBody')
    if (!tableBody) {
        console.warn('Communications table body not found')
        return
    }

    if (!communications || communications.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Communications Yet</div>
                    <div style="font-size: 14px;">Start sending messages to your guests</div>
                </td>
            </tr>
        `
        return
    }

    tableBody.innerHTML = communications.map(comm => {
        const statusColors = {
            pending: 'var(--warning)',
            sent: 'var(--info)',
            delivered: 'var(--success)',
            failed: 'var(--danger)',
            read: 'var(--primary)'
        }

        const statusColor = statusColors[comm.status] || 'var(--text-secondary)'
        const channelIcon = getChannelIcon(comm.message_type)
        const channelLabel = getChannelLabel(comm.message_type)

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">${channelIcon}</span>
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">${channelLabel}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">${formatDate(comm.sent_at || comm.created_at)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 500;">${comm.recipient_name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${comm.recipient_contact}</div>
                </td>
                <td>
                    <div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${comm.subject || comm.message_body.substring(0, 50)}${comm.message_body.length > 50 ? '...' : ''}
                    </div>
                </td>
                <td style="text-align: center;">
                    <span class="badge" style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                        ${comm.status}
                    </span>
                </td>
                <td style="text-align: center; font-size: 13px; color: var(--text-secondary);">
                    ${comm.booking_id || '-'}
                </td>
                <td style="text-align: center;">
                    <button class="btn btn-sm btn-secondary" onclick="window.viewCommunication('${comm.id}')" title="View Details">
                        👁️
                    </button>
                    ${comm.status === 'failed' ? `
                        <button class="btn btn-sm btn-warning" onclick="window.retryCommunication('${comm.id}')" title="Retry">
                            🔄
                        </button>
                    ` : ''}
                </td>
            </tr>
        `
    }).join('')
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.sendCommunication = sendCommunication
    window.getCommunicationHistory = getCommunicationHistory
    window.getAllCommunications = getAllCommunications
    window.sendBulkCommunication = sendBulkCommunication
    window.getChannelIcon = getChannelIcon
    window.getChannelLabel = getChannelLabel
    window.loadCommunications = loadCommunications
}

export { CHANNELS }
