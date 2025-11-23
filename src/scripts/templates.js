/**
 * WhatsApp Message Templates
 */

import { formatDate } from './utils.js'

// WhatsApp Message Templates
export const whatsappTemplates = {
    booking_confirmation: (booking) => `🏠 *Booking Confirmation - ResIQ by Hostizzy*

Hi ${booking.guest_name}! 👋

Your booking is *CONFIRMED* ✅

📋 *Booking Details:*
🆔 Booking ID: *${booking.booking_id}*
🏡 Property: *${booking.property_name}*
📅 Check-in: *${formatDate(booking.check_in)}*
📅 Check-out: *${formatDate(booking.check_out)}*
🛏️ Nights: *${booking.nights}*
👥 Guests: *${booking.number_of_guests}*

💰 *Payment Summary:*
Total Amount: ₹${Math.round(booking.total_amount).toLocaleString('en-IN')}
Paid: ₹${Math.round(booking.paid_amount || 0).toLocaleString('en-IN')}
${(booking.paid_amount || 0) < booking.total_amount ?
`Balance Due: ₹${Math.round(booking.total_amount - (booking.paid_amount || 0)).toLocaleString('en-IN')}` :
'Fully Paid ✅'}

📍 Property address & directions will be shared 24 hours before check-in.

For any queries, reply here or call us! 📞

Thank you for choosing Hostizzy! 🙏
_Powered by ResIQ_`,

    payment_reminder: (booking) => `💰 *Payment Reminder*

Hi ${booking.guest_name},

This is a friendly reminder for your upcoming booking:

🆔 Booking ID: *${booking.booking_id}*
🏡 Property: *${booking.property_name}*
📅 Check-in: *${formatDate(booking.check_in)}*

💳 *Payment Details:*
Total Amount: ₹${Math.round(booking.total_amount).toLocaleString('en-IN')}
Already Paid: ₹${Math.round(booking.paid_amount || 0).toLocaleString('en-IN')}
*Pending Balance: ₹${Math.round(booking.total_amount - (booking.paid_amount || 0)).toLocaleString('en-IN')}*

Please complete the payment at your earliest convenience.

🏦 *Payment Options:*
- UPI: hostizzy@paytm
- Bank Transfer
- Cash on arrival

Reply with payment confirmation! ✅

Thank you! 🙏`,

    check_in_instructions: (booking) => `🏠 *Check-in Instructions*

Hi ${booking.guest_name}! 👋

Your check-in is scheduled for *${formatDate(booking.check_in)}*

📍 *Property:*
${booking.property_name}

🔑 *Check-in Process:*
⏰ Check-in time: 2:00 PM
📞 Call our property manager 30 mins before arrival
🚗 Parking: Available on premises

🏠 *Property Manager Contact:*
We'll share contact details closer to check-in date.

Have a wonderful stay! 🌟

Need any help? Just reply to this message! 📱`,

    thank_you: (booking) => `🙏 *Thank You for Staying with Us!*

Hi ${booking.guest_name},

Thank you for choosing *${booking.property_name}* for your stay!

We hope you had a wonderful experience! ⭐

📝 *We'd love your feedback:*
Your review helps us improve and helps other guests make informed decisions.

🎁 *Special Offer:*
Book your next stay with us and get 10% OFF!
Use code: *RETURNGUEST10*

Looking forward to hosting you again! 🏠

Warm regards,
Team Hostizzy 💚`,

    custom: (booking) => `Hi ${booking.guest_name},

[Type your message here]

Booking ID: ${booking.booking_id}
Property: ${booking.property_name}

Team Hostizzy 🏠`
}

// Helper function to get template by name
export function getWhatsAppTemplate(templateName, booking) {
    if (!whatsappTemplates[templateName]) {
        console.error(`Template "${templateName}" not found`)
        return whatsappTemplates.custom(booking)
    }
    return whatsappTemplates[templateName](booking)
}

// Make available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.whatsappTemplates = whatsappTemplates
    window.getWhatsAppTemplate = getWhatsAppTemplate
}
