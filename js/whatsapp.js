// ResIQ Messaging — Unified WhatsApp + Email messaging, templates, communication history

    // ============================================
    // PHONE NUMBER FORMATTING (shared utility)
    // ============================================

    /**
     * Robust phone number formatter for WhatsApp.
     * Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
     * Returns: country code + 10-digit number (e.g. "919560494001")
     */
    window.formatPhoneForWhatsApp = function(phone, defaultCountryCode) {
        const cc = defaultCountryCode || localStorage.getItem('whatsappCountryCode') || '91';
        let cleaned = (phone || '').replace(/[^0-9]/g, '');

        // Remove leading 0 (Indian STD format: 079XXXXXXX → 79XXXXXXX)
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }

        // If starts with country code and remaining is 10 digits, it's already formatted
        if (cleaned.startsWith(cc) && cleaned.length === (cc.length + 10)) {
            return cleaned;
        }

        // If exactly 10 digits, prepend country code
        if (cleaned.length === 10) {
            return cc + cleaned;
        }

        // If longer than CC+10 and starts with CC, trust it
        if (cleaned.length > 10 && cleaned.startsWith(cc)) {
            return cleaned;
        }

        // Fallback: if <= 10 digits, add country code
        if (cleaned.length <= 10) {
            return cc + cleaned;
        }

        // Return as-is for international numbers
        return cleaned;
    };

    // ============================================
    // MESSAGING STATE
    // ============================================

    let currentMessagingChannel = 'whatsapp'; // 'whatsapp' or 'email'
    let currentMessagingBooking = null;

    // ============================================
    // EMAIL TEMPLATES (subject + body)
    // ============================================

    const emailTemplates = {
        booking_confirmation: (booking) => {
            const biz = getWABusinessName();
            return {
                subject: `Booking Confirmation — ${booking.booking_id} | ${biz}`,
                body: `Dear ${booking.guest_name},

Your booking is confirmed!

Booking Details:
  Booking ID: ${booking.booking_id}
  Property: ${booking.property_name}
  Check-in: ${formatDate(booking.check_in)}
  Check-out: ${formatDate(booking.check_out)}
  Nights: ${booking.nights}
  Guests: ${booking.number_of_guests}

Payment Summary:
  Total Amount: ₹${Math.round(booking.total_amount).toLocaleString('en-IN')}
  Paid: ₹${Math.round(booking.paid_amount || 0).toLocaleString('en-IN')}
  ${(booking.paid_amount || 0) < booking.total_amount
    ? `Balance Due: ₹${Math.round(booking.total_amount - (booking.paid_amount || 0)).toLocaleString('en-IN')}`
    : 'Fully Paid'}

Property address & directions will be shared 24 hours before check-in.

For any queries, reply to this email or call us.

Thank you for choosing ${biz}!

Best regards,
${biz}`
            };
        },

        payment_reminder: (booking) => {
            const biz = getWABusinessName();
            const upi = getWAUpiId();
            return {
                subject: `Payment Reminder — Booking ${booking.booking_id}`,
                body: `Dear ${booking.guest_name},

This is a friendly reminder for your upcoming booking.

Booking ID: ${booking.booking_id}
Property: ${booking.property_name}
Check-in: ${formatDate(booking.check_in)}

Payment Details:
  Total Amount: ₹${Math.round(booking.total_amount).toLocaleString('en-IN')}
  Already Paid: ₹${Math.round(booking.paid_amount || 0).toLocaleString('en-IN')}
  Pending Balance: ₹${Math.round(booking.total_amount - (booking.paid_amount || 0)).toLocaleString('en-IN')}

Please complete the payment at your earliest convenience.

Payment Options:${upi ? `
  UPI: ${upi}` : ''}
  Bank Transfer
  Cash on arrival

Thank you!
${biz}`
            };
        },

        check_in_instructions: (booking) => {
            const biz = getWABusinessName();
            return {
                subject: `Check-in Instructions — ${formatDate(booking.check_in)}`,
                body: `Dear ${booking.guest_name},

Your check-in is scheduled for ${formatDate(booking.check_in)}.

Property: ${booking.property_name}

Check-in Process:
  Check-in time: 2:00 PM
  Please call our property manager 30 minutes before arrival.
  Parking: Available on premises.

Property manager contact details will be shared closer to check-in.

Have a wonderful stay!

Best regards,
${biz}`
            };
        },

        thank_you: (booking) => {
            const biz = getWABusinessName();
            return {
                subject: `Thank You for Staying with Us! — ${biz}`,
                body: `Dear ${booking.guest_name},

Thank you for choosing ${booking.property_name} for your stay!

We hope you had a wonderful experience.

We would love your feedback — your review helps us improve and helps other guests make informed decisions.

Special Offer: Book your next stay with us and get 10% OFF!
Use code: RETURNGUEST10

Looking forward to hosting you again!

Warm regards,
${biz}`
            };
        },

        review_request: (booking) => {
            const biz = getWABusinessName();
            return {
                subject: `Please Share Your Experience — ${biz}`,
                body: `Dear ${booking.guest_name},

We hope you enjoyed your stay at ${booking.property_name}!

We would truly appreciate it if you could take a moment to share your experience. Your feedback helps us improve and assists future guests in their decision.

If there is anything we could have done better, we would love to hear from you.

Thank you for choosing ${biz}!

Best regards,
${biz}`
            };
        },

        custom: (booking) => {
            const biz = getWABusinessName();
            return {
                subject: `Message from ${biz}`,
                body: `Dear ${booking.guest_name},

[Type your message here]

Booking ID: ${booking.booking_id}
Property: ${booking.property_name}

Best regards,
${biz}`
            };
        }
    };

    // ============================================
    // WHATSAPP CORE FUNCTIONS
    // ============================================

window.generateWhatsAppLink = function(booking, template = 'booking_confirmation', customMessage = null) {
    const phone = formatPhoneForWhatsApp(booking.guest_phone);
    const message = customMessage || whatsappTemplates[template](booking);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

window.sendWhatsAppMessage = async function(booking_id, template = 'booking_confirmation', customMessage = null) {
    try {
        const booking = allReservations.find(r => r.booking_id === booking_id);
        if (!booking) { showToast('Error', 'Booking not found', '❌'); return; }
        if (!booking.guest_phone) { showToast('Error', 'Guest phone number not available', '❌'); return; }

        // Check if WABA mode is active — send via Business API instead of wa.me link
        if (typeof isWABAMode === 'function' && isWABAMode()) {
            await sendWhatsAppViaAPI(booking, template, customMessage);
            return;
        }

        const whatsappUrl = generateWhatsAppLink(booking, template, customMessage);
        window.open(whatsappUrl, '_blank');

        const message = customMessage || whatsappTemplates[template](booking);
        await logCommunication({
            booking_id, guest_name: booking.guest_name, guest_phone: booking.guest_phone,
            message_type: 'whatsapp', template_used: template,
            message_content: message, sent_by: currentUser?.email || 'system'
        });

        showToast('WhatsApp Opened', `Message ready for ${booking.guest_name}`, '📱');
        if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
    } catch (error) {
        console.error('WhatsApp error:', error);
        showToast('Error', 'Failed to open WhatsApp: ' + error.message, '❌');
    }
};

/**
 * Send WhatsApp via normal wa.me link (opens WhatsApp web/app).
 * Used when user explicitly picks "WhatsApp" channel in messaging modal.
 */
window.sendWhatsAppNormal = async function(booking, template = 'booking_confirmation', customMessage = null) {
    try {
        if (!booking.guest_phone) { showToast('Error', 'Guest phone number not available', '❌'); return; }

        const whatsappUrl = generateWhatsAppLink(booking, template, customMessage);
        window.open(whatsappUrl, '_blank');

        const message = customMessage || whatsappTemplates[template](booking);
        await logCommunication({
            booking_id: booking.booking_id, guest_name: booking.guest_name, guest_phone: booking.guest_phone,
            message_type: 'whatsapp', template_used: template,
            message_content: message, sent_by: currentUser?.email || 'system'
        });

        showToast('WhatsApp Opened', `Message ready for ${booking.guest_name}`, '📱');
        if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
    } catch (error) {
        console.error('WhatsApp error:', error);
        showToast('Error', 'Failed to open WhatsApp: ' + error.message, '❌');
    }
};

// ============================================
// WHATSAPP BUSINESS API — SEND WITH CTA BUTTON
// ============================================

/**
 * Send message via WhatsApp Business API with CTA reply button.
 * Central number sends the message, CTA button opens chat with property's reply number.
 */
window.sendWhatsAppViaAPI = async function(booking, template = 'booking_confirmation', customMessage = null) {
    try {
        const firebaseUser = firebase.auth().currentUser;
        const token = firebaseUser ? await firebaseUser.getIdToken() : null;
        if (!token) {
            showToast('Auth Error', 'Please sign in to send WhatsApp messages', '❌');
            return;
        }

        const message = customMessage || whatsappTemplates[template](booking);
        const countryCode = localStorage.getItem('whatsappCountryCode') || '91';
        const ctaLabel = localStorage.getItem('wabaCtaLabel') || 'Chat with Property';
        const footerText = localStorage.getItem('wabaFooterText') || 'Hostizzy — Holiday Homes';
        const biz = typeof getWABusinessName === 'function' ? getWABusinessName() : 'Hostizzy';

        // Get the reply number for this property (falls back to central +919560494001)
        const replyNumber = typeof getWABAReplyNumber === 'function'
            ? getWABAReplyNumber(booking.property_id)
            : localStorage.getItem('wabaReplyNumber') || '+919560494001';

        const res = await fetch('/api/whatsapp-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'sendInteractive',
                to: booking.guest_phone,
                bodyText: message,
                ctaLabel: ctaLabel,
                ctaPhone: replyNumber,
                headerText: biz,
                footerText: footerText,
                bookingId: booking.booking_id,
                guestName: booking.guest_name,
                templateUsed: template,
                sentBy: currentUser?.email || 'system',
                countryCode: countryCode
            })
        });

        const json = await res.json();

        if (json.error) {
            throw new Error(json.error.message || json.error);
        }

        // Validate that a message ID was actually returned
        const msgId = json.meta?.messageId || json.data?.messages?.[0]?.id;
        const sentPhone = json.meta?.formattedPhone || booking.guest_phone;
        if (!msgId) {
            console.warn('WhatsApp API returned success but no message ID:', json);
            throw new Error(`Message may not have been delivered to ${sentPhone}. No message ID returned.`);
        }

        console.log(`WhatsApp message sent: ID=${msgId}, to=${sentPhone}, type=${json.meta?.type || 'interactive'}`);
        showToast('Message Sent', `WhatsApp sent to ${booking.guest_name} (${sentPhone})`, '✅');
        if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);

    } catch (error) {
        console.error('WhatsApp API error:', error);
        showToast('API Error', error.message || 'Failed to send via WhatsApp API', '❌');
    }
};

    // ============================================
    // UNIFIED MESSAGING MODAL
    // ============================================

window.openMessagingModal = function(booking_id, channel = 'whatsapp', templateKey = null) {
    const booking = allReservations.find(r => r.booking_id === booking_id);
    if (!booking) { showToast('Error', 'Booking not found', '❌'); return; }

    // For WhatsApp, require phone
    if (channel === 'whatsapp' && !booking.guest_phone) {
        showToast('No Phone', 'Guest phone number not available. Try email instead.', '⚠️');
        channel = 'email';
    }

    currentMessagingBooking = booking;
    currentMessagingChannel = channel;

    // Hide guest selector (it's for communication tab usage)
    const guestSelector = document.getElementById('messagingGuestSelector');
    if (guestSelector) guestSelector.style.display = 'none';

    // Populate guest info
    document.getElementById('messagingGuestName').textContent = booking.guest_name;
    document.getElementById('messagingBookingId').textContent = booking.booking_id;

    // Reset form
    const templateSelect = document.getElementById('messagingTemplate');
    const customGroup = document.getElementById('messagingCustomGroup');
    const customText = document.getElementById('messagingCustomText');
    if (templateSelect) templateSelect.value = templateKey || 'booking_confirmation';
    if (customGroup) customGroup.style.display = 'none';
    if (customText) customText.value = '';

    // Apply channel styling
    switchMessagingChannel(channel);

    // Preview
    previewMessagingMessage();

    // Load history
    loadCommunicationHistory(booking_id);

    // Show modal
    const modal = document.getElementById('messagingModal');
    if (modal) modal.classList.add('show');
};

// Open from communication tab (no booking pre-selected)
window.openMessagingModalFromComm = function(channel = 'email', templateKey = null) {
    currentMessagingBooking = null;
    currentMessagingChannel = channel;

    // Show guest selector
    const guestSelector = document.getElementById('messagingGuestSelector');
    if (guestSelector) guestSelector.style.display = 'block';

    // Clear guest info
    document.getElementById('messagingGuestName').textContent = 'Select a booking below';
    document.getElementById('messagingBookingId').textContent = '-';
    document.getElementById('messagingContactValue').textContent = '-';

    // Reset form
    const templateSelect = document.getElementById('messagingTemplate');
    const customGroup = document.getElementById('messagingCustomGroup');
    const customText = document.getElementById('messagingCustomText');
    if (templateSelect) templateSelect.value = templateKey || 'booking_confirmation';
    if (customGroup) customGroup.style.display = 'none';
    if (customText) customText.value = '';

    // Load bookings into selector
    loadBookingsForMessaging();

    // Apply channel styling
    switchMessagingChannel(channel);

    // Clear preview
    const preview = document.getElementById('messagingPreview');
    if (preview) preview.textContent = 'Select a booking to see the message preview.';

    // Clear history
    const historyDiv = document.getElementById('communicationHistory');
    if (historyDiv) historyDiv.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; font-size: 13px;">Select a booking to view history</div>';

    // Show modal
    const modal = document.getElementById('messagingModal');
    if (modal) modal.classList.add('show');
};

window.loadBookingsForMessaging = async function() {
    const select = document.getElementById('messagingBookingSelect');
    if (!select) return;

    try {
        select.innerHTML = '<option value="">Loading bookings...</option>';
        select.disabled = true;

        const reservations = typeof db !== 'undefined' && db.getReservations
            ? await db.getReservations()
            : allReservations || [];

        if (!reservations || reservations.length === 0) {
            select.innerHTML = '<option value="">No bookings found</option>';
            select.disabled = false;
            return;
        }

        // Sort by check_in descending (most recent first)
        const sorted = [...reservations].sort((a, b) => new Date(b.check_in) - new Date(a.check_in));

        select.innerHTML = '<option value="">Select a booking...</option>' +
            sorted.map(r => {
                const checkin = r.check_in ? formatDate(r.check_in) : '';
                const emailInfo = r.guest_email && r.guest_email !== 'placeholder@ical.import' ? ` — ${r.guest_email}` : '';
                return `<option value="${r.booking_id}">${r.guest_name} | ${r.property_name} | ${checkin}${emailInfo}</option>`;
            }).join('');

        select.disabled = false;
    } catch (error) {
        console.error('Error loading bookings:', error);
        select.innerHTML = '<option value="">Error loading bookings</option>';
        select.disabled = false;
    }
};

window.onMessagingBookingSelected = function() {
    const select = document.getElementById('messagingBookingSelect');
    const bookingId = select?.value;
    if (!bookingId) {
        currentMessagingBooking = null;
        document.getElementById('messagingGuestName').textContent = 'Select a booking above';
        document.getElementById('messagingBookingId').textContent = '-';
        document.getElementById('messagingContactValue').textContent = '-';
        const preview = document.getElementById('messagingPreview');
        if (preview) preview.textContent = 'Select a booking to see the message preview.';
        return;
    }

    const reservations = allReservations || [];
    const booking = reservations.find(r => r.booking_id === bookingId);
    if (!booking) return;

    currentMessagingBooking = booking;

    // Update guest card
    document.getElementById('messagingGuestName').textContent = booking.guest_name;
    document.getElementById('messagingBookingId').textContent = booking.booking_id;
    updateMessagingContactInfo();
    previewMessagingMessage();
    loadCommunicationHistory(bookingId);
};

window.switchMessagingChannel = function(channel) {
    currentMessagingChannel = channel;

    const waBtn = document.getElementById('channelToggleWhatsapp');
    const waApiBtn = document.getElementById('channelToggleWhatsappApi');
    const emailBtn = document.getElementById('channelToggleEmail');
    const guestCard = document.getElementById('messagingGuestCard');
    const subjectGroup = document.getElementById('messagingSubjectGroup');
    const previewBox = document.getElementById('messagingPreviewBox');
    const previewLabel = document.getElementById('messagingPreviewLabel');
    const previewIcon = document.getElementById('messagingPreviewIcon');
    const sendBtn = document.getElementById('messagingSendBtn');
    const sendLabel = document.getElementById('messagingSendLabel');
    const emailStatus = document.getElementById('messagingEmailStatus');

    // Toggle active states
    if (waBtn) waBtn.classList.toggle('active', channel === 'whatsapp');
    if (waApiBtn) waApiBtn.classList.toggle('active', channel === 'whatsapp_api');
    if (emailBtn) emailBtn.classList.toggle('active', channel === 'email');

    if (channel === 'email') {
        // Email styling
        if (guestCard) guestCard.style.background = 'linear-gradient(135deg, #0e7490 0%, #0891b2 100%)';
        if (subjectGroup) subjectGroup.style.display = 'block';
        if (previewBox) previewBox.style.background = '#e0f2f7';
        if (previewLabel) previewLabel.innerHTML = '<i data-lucide="mail" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i>Email Preview';
        if (previewLabel) previewLabel.style.color = '#0e7490';
        if (previewIcon) previewIcon.innerHTML = '<i data-lucide="mail" style="width: 20px; height: 20px; color: #0e7490;"></i>';
        if (sendBtn) { sendBtn.className = 'btn'; sendBtn.style.cssText = 'flex: 2; display: flex; align-items: center; justify-content: center; gap: 8px; background: #0e7490; color: white; border: none; border-radius: 8px; padding: 12px; font-weight: 600; cursor: pointer;'; }
        if (sendLabel) sendLabel.textContent = 'Send Email';

        // Show Gmail connection status
        if (emailStatus) {
            const connected = typeof gmailConnectionStatus !== 'undefined' && gmailConnectionStatus.connected;
            emailStatus.style.display = 'block';
            emailStatus.innerHTML = connected
                ? `✅ Gmail connected — ${gmailConnectionStatus.email || ''}`
                : '⚠️ Gmail not connected — go to <strong>Settings → Integrations</strong> to connect';
            emailStatus.style.background = connected ? 'rgba(255,255,255,0.2)' : 'rgba(255,200,100,0.3)';
        }
    } else if (channel === 'whatsapp_api') {
        // WhatsApp Business API styling
        if (guestCard) guestCard.style.background = 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (previewBox) previewBox.style.background = '#e0f2fe';
        if (previewLabel) previewLabel.innerHTML = '<i data-lucide="zap" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i>API Message Preview';
        if (previewLabel) previewLabel.style.color = '#0284c7';
        if (previewIcon) previewIcon.innerHTML = '<i data-lucide="zap" style="width: 20px; height: 20px; color: #0ea5e9;"></i>';
        if (sendBtn) { sendBtn.className = 'btn'; sendBtn.style.cssText = 'flex: 2; display: flex; align-items: center; justify-content: center; gap: 8px; background: #0ea5e9; color: white; border: none; border-radius: 8px; padding: 12px; font-weight: 600; cursor: pointer;'; }
        if (sendLabel) sendLabel.textContent = 'Send via API';

        // Show WABA CTA info
        if (emailStatus && currentMessagingBooking) {
            const replyNum = typeof getWABAReplyNumber === 'function'
                ? getWABAReplyNumber(currentMessagingBooking.property_id) : '+919560494001';
            const ctaLabel = localStorage.getItem('wabaCtaLabel') || 'Chat with Property';
            emailStatus.style.display = 'block';
            emailStatus.innerHTML = `📲 Business API — CTA: "${ctaLabel}" → ${replyNum}`;
            emailStatus.style.background = 'rgba(14, 165, 233, 0.15)';
        } else if (emailStatus) {
            emailStatus.style.display = 'none';
        }
    } else {
        // WhatsApp Normal (wa.me link) styling
        if (guestCard) guestCard.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        if (subjectGroup) subjectGroup.style.display = 'none';
        if (previewBox) previewBox.style.background = '#dcf8c6';
        if (previewLabel) previewLabel.innerHTML = '<i data-lucide="smartphone" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i>Message Preview';
        if (previewLabel) previewLabel.style.color = '#128c7e';
        if (previewIcon) previewIcon.innerHTML = '<i data-lucide="message-circle" style="width: 20px; height: 20px; color: #25d366;"></i>';
        if (sendBtn) { sendBtn.className = 'btn btn-success'; sendBtn.style.cssText = 'flex: 2; display: flex; align-items: center; justify-content: center; gap: 8px;'; }
        if (sendLabel) sendLabel.textContent = 'Open WhatsApp';
        if (emailStatus) emailStatus.style.display = 'none';
    }

    updateMessagingContactInfo();
    previewMessagingMessage();

    // Refresh icons
    requestAnimationFrame(() => {
        try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
    });
};

window.updateMessagingContactInfo = function() {
    const icon = document.getElementById('messagingContactIcon');
    const value = document.getElementById('messagingContactValue');
    if (!currentMessagingBooking || !icon || !value) return;

    if (currentMessagingChannel === 'email') {
        const email = currentMessagingBooking.guest_email && currentMessagingBooking.guest_email !== 'placeholder@ical.import'
            ? currentMessagingBooking.guest_email : '';
        icon.textContent = '📧';
        value.textContent = email || 'No email on file';
    } else {
        icon.textContent = '📞';
        value.textContent = currentMessagingBooking.guest_phone || 'No phone';
    }
};

window.previewMessagingMessage = function() {
    if (!currentMessagingBooking) return;

    const template = document.getElementById('messagingTemplate')?.value;
    const customGroup = document.getElementById('messagingCustomGroup');
    const preview = document.getElementById('messagingPreview');
    const subjectInput = document.getElementById('messagingSubject');

    if (!template || !preview) return;

    if (template === 'custom') {
        if (customGroup) customGroup.style.display = 'block';
        const customText = document.getElementById('messagingCustomText')?.value;

        if (currentMessagingChannel === 'email') {
            const et = emailTemplates.custom(currentMessagingBooking);
            if (subjectInput) subjectInput.value = subjectInput.value || et.subject;
            preview.textContent = customText || et.body;
        } else {
            preview.textContent = customText || whatsappTemplates.custom(currentMessagingBooking);
        }
    } else {
        if (customGroup) customGroup.style.display = 'none';

        if (currentMessagingChannel === 'email') {
            const et = emailTemplates[template] ? emailTemplates[template](currentMessagingBooking) : { subject: '', body: '' };
            if (subjectInput) subjectInput.value = et.subject;
            preview.textContent = et.body;
        } else {
            if (whatsappTemplates[template]) {
                preview.textContent = whatsappTemplates[template](currentMessagingBooking);
            }
        }
    }
};

window.closeMessagingModal = function() {
    const modal = document.getElementById('messagingModal');
    if (modal) modal.classList.remove('show');
    currentMessagingBooking = null;
};

window.confirmSendMessage = async function() {
    if (!currentMessagingBooking) {
        showToast('Error', 'No booking selected', '❌');
        return;
    }

    const template = document.getElementById('messagingTemplate')?.value || 'booking_confirmation';
    let customMessage = null;

    if (template === 'custom') {
        customMessage = document.getElementById('messagingCustomText')?.value.trim();
        if (!customMessage) {
            showToast('Error', 'Please enter a custom message', '❌');
            return;
        }
    }

    if (currentMessagingChannel === 'whatsapp') {
        // Normal WhatsApp — opens wa.me link
        sendWhatsAppNormal(currentMessagingBooking, template, customMessage);
        closeMessagingModal();
    } else if (currentMessagingChannel === 'whatsapp_api') {
        // WhatsApp Business API — sends via server
        sendWhatsAppViaAPI(currentMessagingBooking, template, customMessage);
        closeMessagingModal();
    } else {
        // Email send
        await sendEmailFromModal(template, customMessage);
    }
};

window.sendEmailFromModal = async function(template, customMessage) {
    const booking = currentMessagingBooking;
    if (!booking) return;

    const email = booking.guest_email && booking.guest_email !== 'placeholder@ical.import'
        ? booking.guest_email : '';
    if (!email) {
        showToast('No Email', 'This guest has no email address on file. Please update their booking.', '⚠️');
        return;
    }

    const connected = typeof gmailConnectionStatus !== 'undefined' && gmailConnectionStatus.connected;
    if (!connected) {
        showToast('Gmail Not Connected', 'Go to Settings → Integrations to connect Gmail first.', '⚠️');
        return;
    }

    // Get subject and body
    let subject, body;
    if (customMessage) {
        subject = document.getElementById('messagingSubject')?.value || `Message from ${getWABusinessName()}`;
        body = customMessage;
    } else {
        const et = emailTemplates[template] ? emailTemplates[template](booking) : null;
        subject = document.getElementById('messagingSubject')?.value || (et ? et.subject : 'Message');
        body = et ? et.body : '';
    }

    // Disable send button
    const sendBtn = document.getElementById('messagingSendBtn');
    const sendLabel = document.getElementById('messagingSendLabel');
    if (sendBtn) sendBtn.disabled = true;
    if (sendLabel) sendLabel.textContent = 'Sending...';

    try {
        await sendEmailViaGmail(email, booking.guest_name, subject, body);

        // Log communication
        await logCommunication({
            booking_id: booking.booking_id,
            guest_name: booking.guest_name,
            guest_phone: booking.guest_phone,
            message_type: 'email',
            template_used: template,
            message_content: `Subject: ${subject}\n\n${body}`,
            sent_by: currentUser?.email || 'system'
        });

        // Also log to local communication messages for the comm tab
        if (typeof communicationMessages !== 'undefined') {
            communicationMessages.unshift({
                id: Date.now(),
                channel: 'email',
                recipient: `${booking.guest_name} (${email})`,
                recipientEmail: email,
                subject: subject,
                message: body,
                timestamp: new Date().toISOString(),
                status: 'sent'
            });
            localStorage.setItem('communicationMessages', JSON.stringify(communicationMessages));
            if (typeof renderCommunicationMessages === 'function') renderCommunicationMessages();
        }

        showToast('Email Sent', `Email sent to ${booking.guest_name} (${email})`, '✅');
        closeMessagingModal();
    } catch (error) {
        console.error('Email send error:', error);
        showToast('Email Failed', error.message || 'Failed to send email', '❌');
        if (sendBtn) sendBtn.disabled = false;
        if (sendLabel) sendLabel.textContent = 'Send Email';
    }
};

    // ============================================
    // BACKWARD COMPATIBILITY (old function names)
    // ============================================

window.openWhatsAppMenu = function(booking_id) {
    openMessagingModal(booking_id, 'whatsapp');
};

window.closeWhatsAppModal = function() {
    closeMessagingModal();
};

window.previewWhatsAppMessage = function() {
    previewMessagingMessage();
};

window.confirmSendWhatsApp = function() {
    confirmSendMessage();
};

    // ============================================
    // SHARED UTILITIES
    // ============================================

window.logCommunication = async function(data) {
    try {
        const { data: result, error } = await supabase
            .from('communications')
            .insert([data]);
        if (error) throw error;
        console.log('Communication logged:', result);
    } catch (error) {
        console.error('Error logging communication:', error);
    }
};

window.loadCommunicationHistory = async function(booking_id) {
    try {
        const { data, error } = await supabase
            .from('communications')
            .select('*')
            .eq('booking_id', booking_id)
            .order('sent_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        const historyDiv = document.getElementById('communicationHistory');
        if (!historyDiv) return;

        if (!data || data.length === 0) {
            historyDiv.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; font-size: 13px;">No messages sent yet</div>';
            return;
        }

        historyDiv.innerHTML = data.map(comm => {
            const isEmail = comm.message_type === 'email';
            const icon = isEmail ? '📧' : '📱';
            return `
            <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 13px;">${icon} ${getTemplateLabel(comm.template_used)}</span>
                    <span style="font-size: 11px; color: var(--text-secondary);">${formatDateTime(comm.sent_at)}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${isEmail ? 'Email' : 'WhatsApp'} · Sent by: ${comm.sent_by || 'Unknown'}
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        console.error('Error loading history:', error);
        const historyDiv = document.getElementById('communicationHistory');
        if (historyDiv) {
            historyDiv.innerHTML = '<div style="color: var(--danger); font-size: 13px;">Failed to load history</div>';
        }
    }
};

window.getTemplateLabel = function(template) {
    const labels = {
        'booking_confirmation': 'Booking Confirmation',
        'payment_reminder': 'Payment Reminder',
        'check_in_instructions': 'Check-in Instructions',
        'thank_you': 'Thank You Message',
        'review_request': 'Review Request',
        'custom': 'Custom Message'
    };
    return labels[template] || 'Message';
};

window.formatDateTime = function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};


// Reservation Modal Functions
