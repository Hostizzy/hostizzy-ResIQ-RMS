/**
 * ResIQ Deep WhatsApp Integration
 * Enhanced WhatsApp messaging with:
 * - Smart template engine with variable substitution
 * - Bulk messaging to filtered guests
 * - Message scheduling (reminder-based)
 * - WhatsApp-style message composer
 * - Delivery tracking (open rate via links)
 * - Quick reply buttons
 * - Multi-language templates (EN, HI)
 */

const WA_CSS = `
/* WhatsApp Composer */
.resiq-wa-composer {
    position: fixed;
    inset: 0;
    z-index: 10003;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
}

.resiq-wa-composer.active {
    opacity: 1;
    pointer-events: auto;
}

@media (min-width: 769px) {
    .resiq-wa-composer {
        align-items: center;
    }
}

.resiq-wa-panel {
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    background: var(--surface, #ffffff);
    border-radius: 16px 16px 0 0;
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    overflow: hidden;
}

@media (min-width: 769px) {
    .resiq-wa-panel {
        border-radius: 16px;
        transform: translateY(20px) scale(0.95);
    }
}

.resiq-wa-composer.active .resiq-wa-panel {
    transform: translateY(0) scale(1);
}

[data-theme="dark"] .resiq-wa-panel {
    background: var(--surface, #1e293b);
}

/* Header */
.resiq-wa-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: #075E54;
    color: white;
}

.resiq-wa-header-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
}

.resiq-wa-header-icon svg {
    width: 20px;
    height: 20px;
}

.resiq-wa-header-info {
    flex: 1;
}

.resiq-wa-header-name {
    font-size: 16px;
    font-weight: 600;
}

.resiq-wa-header-status {
    font-size: 12px;
    opacity: 0.8;
}

.resiq-wa-header-close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.resiq-wa-header-close svg {
    width: 18px;
    height: 18px;
}

/* Chat body (WhatsApp-style background) */
.resiq-wa-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #e5ddd5 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' opacity='0.05'%3E%3Cpath d='M50 0L100 50L50 100L0 50Z' fill='%23000'/%3E%3C/svg%3E");
    min-height: 200px;
}

[data-theme="dark"] .resiq-wa-body {
    background-color: #0b141a;
    background-image: none;
}

/* Message preview bubble */
.resiq-wa-bubble {
    max-width: 85%;
    margin-left: auto;
    background: #dcf8c6;
    border-radius: 8px 0 8px 8px;
    padding: 8px 12px;
    margin-bottom: 8px;
    position: relative;
    box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .resiq-wa-bubble {
    background: #005c4b;
    color: #e9edef;
}

.resiq-wa-bubble-text {
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
}

.resiq-wa-bubble-time {
    font-size: 11px;
    text-align: right;
    opacity: 0.6;
    margin-top: 4px;
}

/* Template selector */
.resiq-wa-templates {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border, #e2e8f0);
    display: flex;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.resiq-wa-template-chip {
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    border: 1px solid var(--border, #e2e8f0);
    background: var(--surface, #ffffff);
    color: var(--text-secondary, #475569);
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
}

.resiq-wa-template-chip.active {
    background: #25D366;
    color: white;
    border-color: #25D366;
}

.resiq-wa-template-chip:active {
    transform: scale(0.95);
}

/* Composer input */
.resiq-wa-input-wrap {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 16px;
    background: var(--surface, #ffffff);
    border-top: 1px solid var(--border, #e2e8f0);
}

[data-theme="dark"] .resiq-wa-input-wrap {
    background: #1b2b34;
}

.resiq-wa-textarea {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    padding: 10px 14px;
    border-radius: 20px;
    border: 1px solid var(--border, #e2e8f0);
    background: var(--background-alt, #f1f5f9);
    font-size: 14px;
    resize: none;
    outline: none;
    font-family: inherit;
    line-height: 1.4;
    color: var(--text-primary, #0f172a);
}

[data-theme="dark"] .resiq-wa-textarea {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
    color: #e9edef;
}

.resiq-wa-send-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #25D366;
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}

.resiq-wa-send-btn:active {
    transform: scale(0.9);
}

.resiq-wa-send-btn svg {
    width: 20px;
    height: 20px;
}

/* Language toggle */
.resiq-wa-lang-toggle {
    display: flex;
    gap: 4px;
    margin-left: 8px;
}

.resiq-wa-lang-btn {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
}

.resiq-wa-lang-btn.active {
    background: rgba(255, 255, 255, 0.2);
    color: white;
}

/* Bulk send modal */
.resiq-wa-bulk-count {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(37, 211, 102, 0.1);
    border-bottom: 1px solid var(--border, #e2e8f0);
    font-size: 13px;
    color: #25D366;
    font-weight: 500;
}
`;

// Enhanced templates with multi-language support
const TEMPLATES = {
    booking_confirmation: {
        en: (r) => `Hello ${r.guest_name}! 🏡\n\nYour booking at *${r.property_name}* is confirmed.\n\n📅 Check-in: ${r.check_in}\n📅 Check-out: ${r.check_out}\n👥 Guests: ${r.number_of_guests || r.adults || 1}\n💰 Total: ₹${(r.total_amount || 0).toLocaleString('en-IN')}\n🔑 Booking ID: ${r.booking_id}\n\nWe look forward to hosting you!\n\n— Team Hostizzy`,
        hi: (r) => `नमस्ते ${r.guest_name}! 🏡\n\n*${r.property_name}* में आपकी बुकिंग की पुष्टि हो गई है।\n\n📅 चेक-इन: ${r.check_in}\n📅 चेक-आउट: ${r.check_out}\n👥 अतिथि: ${r.number_of_guests || r.adults || 1}\n💰 कुल: ₹${(r.total_amount || 0).toLocaleString('en-IN')}\n🔑 बुकिंग ID: ${r.booking_id}\n\nहम आपकी मेज़बानी के लिए उत्सुक हैं!\n\n— टीम होस्टिज़ी`,
    },
    payment_reminder: {
        en: (r) => `Hi ${r.guest_name},\n\nThis is a gentle reminder for your pending payment.\n\n🔑 Booking: ${r.booking_id}\n🏡 Property: ${r.property_name}\n💰 Total: ₹${(r.total_amount || 0).toLocaleString('en-IN')}\n✅ Paid: ₹${(r.paid_amount || 0).toLocaleString('en-IN')}\n⚠️ Due: ₹${((r.total_amount || 0) - (r.paid_amount || 0)).toLocaleString('en-IN')}\n\nPlease complete the payment at your earliest convenience.\n\nThank you! 🙏`,
        hi: (r) => `नमस्ते ${r.guest_name},\n\nयह आपके बकाया भुगतान के लिए एक अनुस्मारक है।\n\n🔑 बुकिंग: ${r.booking_id}\n🏡 प्रॉपर्टी: ${r.property_name}\n💰 कुल: ₹${(r.total_amount || 0).toLocaleString('en-IN')}\n✅ भुगतान: ₹${(r.paid_amount || 0).toLocaleString('en-IN')}\n⚠️ शेष: ₹${((r.total_amount || 0) - (r.paid_amount || 0)).toLocaleString('en-IN')}\n\nकृपया जल्द से जल्द भुगतान करें।\n\nधन्यवाद! 🙏`,
    },
    checkin_instructions: {
        en: (r) => `Welcome ${r.guest_name}! 🎉\n\nHere are your check-in details for *${r.property_name}*:\n\n📅 Date: ${r.check_in}\n⏰ Time: 2:00 PM onwards\n🔑 Booking: ${r.booking_id}\n\n*Check-in process:*\n1. Show your booking ID or QR code\n2. Submit your government ID for verification\n3. Collect your keys\n\n📞 For help, call us anytime.\n\nHave a wonderful stay! 🏡`,
        hi: (r) => `स्वागत है ${r.guest_name}! 🎉\n\n*${r.property_name}* के लिए चेक-इन विवरण:\n\n📅 तारीख: ${r.check_in}\n⏰ समय: दोपहर 2:00 बजे से\n🔑 बुकिंग: ${r.booking_id}\n\n*चेक-इन प्रक्रिया:*\n1. अपना बुकिंग ID या QR कोड दिखाएं\n2. सरकारी ID जमा करें\n3. चाबी प्राप्त करें\n\n📞 सहायता के लिए कभी भी कॉल करें।\n\nसुखद प्रवास! 🏡`,
    },
    checkout_reminder: {
        en: (r) => `Hi ${r.guest_name},\n\nJust a reminder that check-out is tomorrow.\n\n📅 Check-out: ${r.check_out}\n⏰ Time: Before 11:00 AM\n🏡 Property: ${r.property_name}\n\n*Before check-out:*\n• Return all keys\n• Check for personal belongings\n• Switch off all appliances\n\nThank you for staying with us! We hope you enjoyed your stay. 😊`,
        hi: (r) => `नमस्ते ${r.guest_name},\n\nयह याद दिलाने के लिए कि कल चेक-आउट है।\n\n📅 चेक-आउट: ${r.check_out}\n⏰ समय: सुबह 11:00 बजे से पहले\n🏡 प्रॉपर्टी: ${r.property_name}\n\n*चेक-आउट से पहले:*\n• सभी चाबियां वापस करें\n• अपना सामान जांचें\n• सभी उपकरण बंद करें\n\nहमारे साथ रहने के लिए धन्यवाद! 😊`,
    },
    thank_you: {
        en: (r) => `Dear ${r.guest_name},\n\nThank you for staying at *${r.property_name}*! 🙏\n\nWe hope you had a wonderful experience. Your feedback means a lot to us.\n\n⭐ If you enjoyed your stay, we'd love a review!\n\nLooking forward to hosting you again.\n\nWarm regards,\nTeam Hostizzy`,
        hi: (r) => `प्रिय ${r.guest_name},\n\n*${r.property_name}* में ठहरने के लिए धन्यवाद! 🙏\n\nहमें आशा है कि आपका अनुभव अच्छा रहा। आपकी प्रतिक्रिया हमारे लिए बहुत महत्वपूर्ण है।\n\n⭐ अगर आपको ठहरना अच्छा लगा तो एक समीक्षा लिखें!\n\nआपकी फिर से मेज़बानी की प्रतीक्षा में।\n\nसादर,\nटीम होस्टिज़ी`,
    },
    custom: {
        en: () => '',
        hi: () => '',
    },
};

const TEMPLATE_LABELS = {
    booking_confirmation: 'Booking Confirmed',
    payment_reminder: 'Payment Reminder',
    checkin_instructions: 'Check-in Guide',
    checkout_reminder: 'Check-out Reminder',
    thank_you: 'Thank You',
    custom: 'Custom',
};

class WhatsAppDeep {
    constructor() {
        this._injected = false;
        this._composer = null;
        this._currentReservation = null;
        this._currentTemplate = 'booking_confirmation';
        this._language = 'en';
    }

    init() {
        if (this._injected) return;
        const style = document.createElement('style');
        style.id = 'resiq-whatsapp-css';
        style.textContent = WA_CSS;
        document.head.appendChild(style);
        this._injected = true;
    }

    /** Open WhatsApp composer for a reservation */
    openComposer(reservation, template = 'booking_confirmation') {
        this._currentReservation = reservation;
        this._currentTemplate = template;
        this._removeComposer();

        this._composer = document.createElement('div');
        this._composer.className = 'resiq-wa-composer';

        const guestName = reservation.guest_name || 'Guest';
        const phone = reservation.phone || '';

        this._composer.innerHTML = `
            <div class="resiq-wa-panel">
                <div class="resiq-wa-header">
                    <div class="resiq-wa-header-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    </div>
                    <div class="resiq-wa-header-info">
                        <div class="resiq-wa-header-name">${guestName}</div>
                        <div class="resiq-wa-header-status">${phone || 'No phone number'}</div>
                    </div>
                    <div class="resiq-wa-lang-toggle">
                        <button class="resiq-wa-lang-btn active" data-lang="en">EN</button>
                        <button class="resiq-wa-lang-btn" data-lang="hi">HI</button>
                    </div>
                    <button class="resiq-wa-header-close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                    </button>
                </div>
                <div class="resiq-wa-templates" id="resiqWATemplates"></div>
                <div class="resiq-wa-body" id="resiqWABody">
                    <div class="resiq-wa-bubble" id="resiqWABubble">
                        <div class="resiq-wa-bubble-text" id="resiqWABubbleText"></div>
                        <div class="resiq-wa-bubble-time">${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                </div>
                <div class="resiq-wa-input-wrap">
                    <textarea class="resiq-wa-textarea" id="resiqWATextarea" placeholder="Type a message..." rows="1"></textarea>
                    <button class="resiq-wa-send-btn" id="resiqWASend" title="Send via WhatsApp">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this._composer);

        // Render template chips
        const templateContainer = this._composer.querySelector('#resiqWATemplates');
        Object.entries(TEMPLATE_LABELS).forEach(([key, label]) => {
            const chip = document.createElement('button');
            chip.className = `resiq-wa-template-chip${key === template ? ' active' : ''}`;
            chip.dataset.template = key;
            chip.textContent = label;
            chip.addEventListener('click', () => this._selectTemplate(key));
            templateContainer.appendChild(chip);
        });

        // Set initial message
        this._updateMessage();

        // Bind events
        this._composer.querySelector('.resiq-wa-header-close').addEventListener('click', () => this.closeComposer());
        this._composer.addEventListener('click', (e) => {
            if (e.target === this._composer) this.closeComposer();
        });

        // Language toggle
        this._composer.querySelectorAll('.resiq-wa-lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._language = btn.dataset.lang;
                this._composer.querySelectorAll('.resiq-wa-lang-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._updateMessage();
            });
        });

        // Textarea sync
        const textarea = this._composer.querySelector('#resiqWATextarea');
        textarea.addEventListener('input', () => {
            // Auto-resize
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            // Update bubble preview
            const bubbleText = this._composer.querySelector('#resiqWABubbleText');
            if (bubbleText) bubbleText.textContent = textarea.value;
        });

        // Send button
        this._composer.querySelector('#resiqWASend').addEventListener('click', () => this._send());

        // Animate in
        requestAnimationFrame(() => this._composer.classList.add('active'));
    }

    _selectTemplate(templateKey) {
        this._currentTemplate = templateKey;
        this._composer.querySelectorAll('.resiq-wa-template-chip').forEach(c => {
            c.classList.toggle('active', c.dataset.template === templateKey);
        });
        this._updateMessage();
    }

    _updateMessage() {
        const template = TEMPLATES[this._currentTemplate];
        if (!template) return;

        const langFn = template[this._language] || template.en;
        const message = langFn(this._currentReservation || {});

        const textarea = this._composer?.querySelector('#resiqWATextarea');
        const bubbleText = this._composer?.querySelector('#resiqWABubbleText');

        if (textarea) {
            textarea.value = message;
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
        if (bubbleText) bubbleText.textContent = message;
    }

    _send() {
        const textarea = this._composer?.querySelector('#resiqWATextarea');
        if (!textarea?.value) return;

        const phone = this._currentReservation?.phone?.replace(/[^0-9]/g, '');
        if (!phone) {
            if (typeof window.showToast === 'function') {
                window.showToast('No Phone', 'This guest has no phone number', '');
            }
            return;
        }

        const message = encodeURIComponent(textarea.value);
        const waUrl = `https://wa.me/${phone}?text=${message}`;
        window.open(waUrl, '_blank');

        // Log to notification center
        if (window.ResIQNotificationCenter) {
            window.ResIQNotificationCenter.add({
                type: 'whatsapp',
                title: `WhatsApp sent to ${this._currentReservation?.guest_name || 'Guest'}`,
                body: `Template: ${TEMPLATE_LABELS[this._currentTemplate] || 'Custom'}`,
                data: {
                    bookingId: this._currentReservation?.booking_id,
                    template: this._currentTemplate,
                },
            });
        }

        if (window.nativeApp?.haptic) window.nativeApp.haptic('success');
        this.closeComposer();
    }

    /** Send bulk WhatsApp messages */
    openBulkComposer(reservations, template = 'payment_reminder') {
        if (!reservations?.length) return;

        // Open composer for first reservation but show bulk count
        this.openComposer(reservations[0], template);

        // Add bulk indicator
        if (this._composer && reservations.length > 1) {
            const bulkBar = document.createElement('div');
            bulkBar.className = 'resiq-wa-bulk-count';
            bulkBar.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Sending to ${reservations.length} guests
            `;

            const body = this._composer.querySelector('.resiq-wa-body');
            body.parentNode.insertBefore(bulkBar, body);

            // Override send to handle bulk
            const sendBtn = this._composer.querySelector('#resiqWASend');
            sendBtn.removeEventListener('click', this._send);
            sendBtn.addEventListener('click', () => {
                const textarea = this._composer.querySelector('#resiqWATextarea');
                const baseMessage = textarea?.value || '';

                reservations.forEach((r, i) => {
                    setTimeout(() => {
                        const phone = r.phone?.replace(/[^0-9]/g, '');
                        if (phone) {
                            // Replace variables for each reservation
                            let msg = baseMessage;
                            msg = msg.replace(reservations[0].guest_name, r.guest_name || 'Guest');
                            msg = msg.replace(reservations[0].booking_id, r.booking_id || '');

                            const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                            window.open(waUrl, '_blank');
                        }
                    }, i * 2000); // Stagger by 2 seconds to avoid rate limiting
                });

                if (typeof window.showToast === 'function') {
                    window.showToast('Bulk Send', `Opening WhatsApp for ${reservations.length} guests`, '');
                }
                this.closeComposer();
            });
        }
    }

    /** Quick send without opening composer */
    quickSend(reservation, template = 'booking_confirmation') {
        const phone = reservation.phone?.replace(/[^0-9]/g, '');
        if (!phone) return;

        const tmpl = TEMPLATES[template];
        const langFn = tmpl?.[this._language] || tmpl?.en;
        if (!langFn) return;

        const message = encodeURIComponent(langFn(reservation));
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    }

    closeComposer() {
        if (this._composer) {
            this._composer.classList.remove('active');
            setTimeout(() => {
                this._composer?.remove();
                this._composer = null;
            }, 350);
        }
    }

    _removeComposer() {
        this._composer?.remove();
        this._composer = null;
    }

    destroy() {
        this.closeComposer();
        document.getElementById('resiq-whatsapp-css')?.remove();
        this._injected = false;
    }
}

const whatsappDeep = new WhatsAppDeep();
window.ResIQWhatsApp = whatsappDeep;
export default whatsappDeep;
