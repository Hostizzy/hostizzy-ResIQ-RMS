// ResIQ Communication — Email compose, Gmail integration, message templates
// Enhanced: Supabase persistence, custom templates, scheduled messages

// Gmail connection state (restored from localStorage cache, validated from server)
let gmailConnectionStatus = (function() {
    try {
        const cached = localStorage.getItem('gmail_connection_status');
        if (cached) return JSON.parse(cached);
    } catch (e) {}
    return { connected: false, email: null };
})();

// Custom message templates (persisted to localStorage, editable by user)
const DEFAULT_TEMPLATES = {
    booking_confirmation: {
        name: 'Booking Confirmation',
        subject: 'Booking Confirmed — {{property_name}}',
        body: 'Dear {{guest_name}},\n\nYour booking has been confirmed!\n\nProperty: {{property_name}}\nCheck-in: {{check_in}}\nCheck-out: {{check_out}}\nGuests: {{guests}}\n\nWe look forward to hosting you.\n\nBest regards,\n{{business_name}}'
    },
    payment_reminder: {
        name: 'Payment Reminder',
        subject: 'Payment Reminder — {{property_name}}',
        body: 'Dear {{guest_name}},\n\nThis is a friendly reminder that payment is pending for your upcoming stay.\n\nProperty: {{property_name}}\nCheck-in: {{check_in}}\nAmount: {{total_amount}}\n\nPlease complete the payment at your earliest convenience.\n\nThank you,\n{{business_name}}'
    },
    check_in_instructions: {
        name: 'Check-in Instructions',
        subject: 'Check-in Details — {{property_name}}',
        body: 'Dear {{guest_name}},\n\nWelcome! Here are your check-in details:\n\nProperty: {{property_name}}\nCheck-in Date: {{check_in}}\nCheck-in Time: 2:00 PM\n\nDirections and access details will be shared closer to your arrival.\n\nSee you soon!\n{{business_name}}'
    },
    thank_you: {
        name: 'Check-out Thanks',
        subject: 'Thank You for Staying with Us!',
        body: 'Dear {{guest_name}},\n\nThank you for staying at {{property_name}}! We hope you had a wonderful experience.\n\nWe would love to host you again. Please do not hesitate to reach out for future bookings.\n\nWarm regards,\n{{business_name}}'
    },
    review_request: {
        name: 'Review Request',
        subject: 'How was your stay at {{property_name}}?',
        body: 'Dear {{guest_name}},\n\nWe hope you enjoyed your stay at {{property_name}}.\n\nWould you kindly take a moment to leave us a review? Your feedback helps us improve and helps future guests.\n\nThank you for choosing us!\n\nBest,\n{{business_name}}'
    }
};

function getCustomTemplates() {
    try {
        const stored = localStorage.getItem('resiq_message_templates');
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { ...DEFAULT_TEMPLATES };
}

function saveCustomTemplates(templates) {
    localStorage.setItem('resiq_message_templates', JSON.stringify(templates));
}

function openTemplateEditor() {
    const templates = getCustomTemplates();
    const keys = Object.keys(templates);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 class="modal-title"><i data-lucide="file-edit" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;"></i>Customize Message Templates</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="padding: 20px;">
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
                    Edit your message templates. Use placeholders: <code>{{guest_name}}</code>, <code>{{property_name}}</code>, <code>{{check_in}}</code>, <code>{{check_out}}</code>, <code>{{guests}}</code>, <code>{{total_amount}}</code>, <code>{{business_name}}</code>
                </p>
                <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                    ${keys.map((key, i) => `<button class="filter-chip ${i === 0 ? 'active' : ''}" onclick="switchTemplateTab('${key}', this)" style="font-size: 12px; padding: 4px 12px;">${templates[key].name}</button>`).join('')}
                </div>
                ${keys.map((key, i) => `
                <div class="template-tab-content" id="tmplTab_${key}" style="${i > 0 ? 'display:none;' : ''}">
                    <div class="form-group">
                        <label>Subject</label>
                        <input type="text" id="tmplSubject_${key}" value="${escapeHtml(templates[key].subject)}">
                    </div>
                    <div class="form-group">
                        <label>Message Body</label>
                        <textarea id="tmplBody_${key}" rows="8" style="font-family: monospace; font-size: 13px;">${escapeHtml(templates[key].body)}</textarea>
                    </div>
                </div>`).join('')}
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between;">
                <button class="btn" onclick="resetTemplatesToDefault()" style="color: var(--text-secondary);">Reset to Defaults</button>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="saveTemplatesFromEditor()">Save Templates</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    requestAnimationFrame(() => { if (typeof refreshIcons === 'function') refreshIcons(modal); });
}

function switchTemplateTab(key, el) {
    document.querySelectorAll('.template-tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    const tab = document.getElementById(`tmplTab_${key}`);
    if (tab) tab.style.display = 'block';
    if (el) el.classList.add('active');
}

function saveTemplatesFromEditor() {
    const templates = getCustomTemplates();
    for (const key of Object.keys(templates)) {
        const subjectEl = document.getElementById(`tmplSubject_${key}`);
        const bodyEl = document.getElementById(`tmplBody_${key}`);
        if (subjectEl) templates[key].subject = subjectEl.value;
        if (bodyEl) templates[key].body = bodyEl.value;
    }
    saveCustomTemplates(templates);
    document.querySelectorAll('.modal').forEach(m => m.remove());
    showToast('Templates Saved', 'Your custom message templates have been saved', '✅');
}

function resetTemplatesToDefault() {
    if (!confirm('Reset all templates to default? Your customizations will be lost.')) return;
    saveCustomTemplates({ ...DEFAULT_TEMPLATES });
    document.querySelectorAll('.modal').forEach(m => m.remove());
    openTemplateEditor();
    showToast('Templates Reset', 'Templates restored to defaults', '✅');
}

function escapeHtmlComm(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Helper: Get Firebase ID token for authenticated proxy calls
 */
async function getFirebaseIdToken() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
}

/**
 * Helper: Call the Gmail proxy API
 */
async function callGmailProxy(action, params = {}) {
    const idToken = await getFirebaseIdToken();
    const response = await fetch('/api/gmail-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ action, ...params })
    });

    const result = await response.json();

    if (result.error) {
        if (result.error.reconnect) {
            gmailConnectionStatus = { connected: false, email: null };
            updateGmailConnectionUI(false);
            updateGmailSendStatus();
            renderEmailStatusBanner();
        }
        throw new Error(result.error.message || result.error);
    }

    return result.data;
}

/**
 * Check Gmail connection status from server
 */
async function checkGmailStatus() {
    try {
        const status = await callGmailProxy('status');
        gmailConnectionStatus = { connected: status.connected, email: status.email || null };
        if (status.email) {
            localStorage.setItem('gmail_user_email', status.email);
        }
        // Cache connection status so next page load starts with correct state
        localStorage.setItem('gmail_connection_status', JSON.stringify(gmailConnectionStatus));
        return gmailConnectionStatus;
    } catch {
        gmailConnectionStatus = { connected: false, email: null };
        localStorage.setItem('gmail_connection_status', JSON.stringify(gmailConnectionStatus));
        return gmailConnectionStatus;
    }
}

async function loadCommunication() {
    try {
        // Try Supabase first, fall back to localStorage
        let supabaseMessages = [];
        try {
            supabaseMessages = await db.getCommunications();
        } catch (e) {
            console.warn('Supabase communications table not available, using localStorage:', e.message);
        }

        if (supabaseMessages.length > 0) {
            communicationMessages = supabaseMessages.map(m => ({
                id: m.id,
                channel: m.message_type || 'email',
                recipient: m.guest_name || m.recipient || '',
                recipientEmail: m.recipient_email || '',
                subject: m.subject || '',
                message: m.message_content || '',
                timestamp: m.sent_at || m.created_at,
                status: m.status || 'sent',
                templateKey: m.template_used,
                bookingId: m.booking_id,
                scheduledFor: m.scheduled_for
            }));
        } else {
            const stored = localStorage.getItem('communicationMessages');
            communicationMessages = stored ? JSON.parse(stored) : [];
        }

        renderCommunicationMessages();
        renderEmailStatusBanner();
    } catch (error) {
        console.error('Error loading communications:', error);
        communicationMessages = [];
    }
}

// Persist a message to Supabase (with localStorage fallback)
async function persistCommunication(msg) {
    // Always save to localStorage as backup
    const localMessages = JSON.parse(localStorage.getItem('communicationMessages') || '[]');
    localMessages.unshift(msg);
    localStorage.setItem('communicationMessages', JSON.stringify(localMessages));

    // Try to persist to Supabase (uses existing table column names)
    try {
        await db.saveCommunication({
            message_type: msg.channel,
            guest_name: msg.recipient,
            recipient_email: msg.recipientEmail || null,
            guest_phone: msg.recipientPhone || null,
            subject: msg.subject,
            message_content: msg.message,
            status: msg.status,
            template_used: msg.templateKey || null,
            booking_id: msg.bookingId || null,
            scheduled_for: msg.scheduledFor || null,
            sent_by: firebase.auth().currentUser?.email || 'system',
            sent_at: msg.status === 'sent' ? new Date().toISOString() : new Date().toISOString()
        });
    } catch (e) {
        console.warn('Could not persist communication to Supabase:', e.message);
    }
}

function renderEmailStatusBanner() {
    const banner = document.getElementById('emailStatusBanner');
    if (!banner) return;
    const connected = gmailConnectionStatus.connected;
    if (connected) {
        const email = gmailConnectionStatus.email || localStorage.getItem('gmail_user_email') || 'your Gmail';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #dcfce7; border-radius: 8px; border-left: 3px solid var(--success); font-size: 13px; color: #166534;">
                <span>✅</span>
                <span><strong>Email sending active</strong> via Gmail (${email}) — emails go directly to guest inboxes</span>
            </div>`;
    } else {
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #fff7ed; border-radius: 8px; border-left: 3px solid var(--warning); font-size: 13px; color: #92400e;">
                <span>⚠️</span>
                <span>Gmail not connected for sending.
                    <button onclick="showView('settings'); setTimeout(() => switchSettingsTab('integrations'), 200)" style="background: none; border: none; color: var(--primary); cursor: pointer; font-weight: 600; text-decoration: underline; font-size: 13px; padding: 0; margin-left: 4px;">
                        Connect Gmail →
                    </button>
                </span>
            </div>`;
    }
}

function renderCommunicationMessages() {
    const messageHistory = document.getElementById('messageHistory');
    if (!messageHistory) return;

    // Update stats counters
    const totalEl = document.getElementById('commStatTotal');
    const emailEl = document.getElementById('commStatEmail');
    const waEl = document.getElementById('commStatWhatsapp');
    const smsEl = document.getElementById('commStatSms');
    if (totalEl) totalEl.textContent = communicationMessages.length;
    if (emailEl) emailEl.textContent = communicationMessages.filter(m => m.channel === 'email').length;
    if (waEl) waEl.textContent = communicationMessages.filter(m => m.channel === 'whatsapp').length;
    if (smsEl) smsEl.textContent = communicationMessages.filter(m => m.channel === 'sms').length;

    let filteredMessages = communicationMessages;
    if (currentCommunicationFilter !== 'all') {
        filteredMessages = communicationMessages.filter(m => m.channel === currentCommunicationFilter);
    }

    if (filteredMessages.length === 0) {
        messageHistory.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="margin-bottom: 16px; opacity: 0.4;"><i data-lucide="mail" style="width: 56px; height: 56px;"></i></div>
                <h3 style="margin-bottom: 8px; color: var(--text-secondary); font-weight: 600;">No messages yet</h3>
                <p style="font-size: 14px;">Use the quick templates above or compose a message to get started</p>
            </div>
        `;
        return;
    }

    const channelColors = {
        email: { bg: '#e0f2f7', color: '#0e7490', icon: '📧' },
        whatsapp: { bg: '#dcfce7', color: '#166534', icon: '💬' },
        sms: { bg: '#f3f4f6', color: '#374151', icon: '📱' }
    };

    messageHistory.innerHTML = filteredMessages.map(msg => {
        const ch = channelColors[msg.channel] || { bg: '#f3f4f6', color: '#374151', icon: '💬' };
        const statusColor = msg.status === 'sent' ? 'var(--success)' : '#92400e';
        const statusBg = msg.status === 'sent' ? '#dcfce7' : '#fef3c7';
        const date = new Date(msg.timestamp);
        const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return `
        <div class="comm-msg-item">
            <div class="comm-msg-avatar" style="background: ${ch.bg}; color: ${ch.color}; font-size: 18px;">
                ${ch.icon}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <div>
                        <span style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${msg.recipient.split('(')[0].trim()}</span>
                        ${msg.recipientEmail ? `<span style="font-size: 12px; color: var(--text-secondary); margin-left: 6px;">${msg.recipientEmail}</span>` : ''}
                    </div>
                    <span style="font-size: 11px; color: var(--text-tertiary); white-space: nowrap; margin-left: 12px;">${dateStr} ${timeStr}</span>
                </div>
                <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">${msg.subject}</div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap;">${msg.message.substring(0, 200)}${msg.message.length > 200 ? '…' : ''}</div>
                <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; padding: 2px 10px; background: ${ch.bg}; color: ${ch.color}; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${msg.channel}</span>
                    ${msg.status ? `<span style="display: inline-block; padding: 2px 10px; background: ${statusBg}; color: ${statusColor}; border-radius: 10px; font-size: 11px; font-weight: 600;">${msg.status}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function getChannelIcon(channel) {
    const icons = {
        'whatsapp': '💬',
        'email': '📧',
        'sms': '📱'
    };
    return icons[channel] || '💬';
}

function openComposeModal() {
    const gmailConnected = gmailConnectionStatus.connected;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title"><i data-lucide="mail" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;"></i>Compose Message</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label>Channel *</label>
                    <select id="composeChannel" onchange="updateComposeChannelHint(this.value)">
                        <option value="email">Email</option>
                        <option value="whatsapp"><i data-lucide="message-circle" style="width: 12px; height: 12px; margin-right: 3px;"></i>WhatsApp (logged only)</option>
                        <option value="sms"><i data-lucide="smartphone" style="width: 12px; height: 12px; margin-right: 3px;"></i>SMS (logged only)</option>
                    </select>
                </div>
                <div id="composeChannelHint" style="margin: -8px 0 12px 0; font-size: 12px; color: var(--text-secondary); padding: 8px 12px; background: ${gmailConnected ? '#e0f2f7' : '#fff7ed'}; border-radius: 6px;">
                    ${gmailConnected
                        ? '✅ Gmail connected — email will be sent from your Gmail account'
                        : '⚠️ Gmail not connected — go to <strong>Settings → Integrations</strong> to connect Gmail'}
                </div>
                <div class="form-group">
                    <label>Recipient *</label>
                    <select id="composeRecipient">
                        <option value="">Loading guests...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Subject</label>
                    <input type="text" id="composeSubject" placeholder="e.g., Booking Confirmation">
                </div>
                <div class="form-group">
                    <label>Message *</label>
                    <textarea id="composeMessage" rows="6" placeholder="Type your message here..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="sendComposedMessage()" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="send" style="width: 14px; height: 14px;"></i> Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });

    loadGuestsForCompose();
}

async function loadGuestsForCompose() {
    const select = document.getElementById('composeRecipient');
    if (!select) return;

    try {
        select.innerHTML = '<option value="">Loading guests...</option>';
        select.disabled = true;

        const reservations = await db.getReservations();
        const uniqueGuests = {};

        reservations.forEach(r => {
            if (r.guest_name && r.guest_phone) {
                const key = r.guest_phone;
                if (!uniqueGuests[key]) {
                    uniqueGuests[key] = {
                        name: r.guest_name,
                        phone: r.guest_phone,
                        email: r.guest_email && r.guest_email !== 'placeholder@ical.import' ? r.guest_email : ''
                    };
                }
            }
        });

        const guestEntries = Object.values(uniqueGuests);

        if (guestEntries.length === 0) {
            select.innerHTML = '<option value="">No guests found</option>';
        } else {
            select.innerHTML = '<option value="">Select Guest...</option>' +
                guestEntries.map(g => {
                    const label = g.email
                        ? `${g.name} — ${g.email}`
                        : `${g.name} (${g.phone}) — no email`;
                    return `<option value="${g.phone}" data-email="${g.email || ''}" data-name="${g.name}">${label}</option>`;
                }).join('');
        }

        select.disabled = false;
    } catch (error) {
        console.error('Error loading guests:', error);
        select.innerHTML = '<option value="">Error loading guests</option>';
        select.disabled = false;
        showToast('Error', 'Failed to load guests. Please try again.', '❌');
    }
}

function updateComposeChannelHint(channel) {
    const hint = document.getElementById('composeChannelHint');
    if (!hint) return;
    const gmailConnected = gmailConnectionStatus.connected;
    if (channel === 'email') {
        hint.style.background = gmailConnected ? '#e0f2f7' : '#fff7ed';
        hint.innerHTML = gmailConnected
            ? '✅ Gmail connected — email will be sent from your Gmail account'
            : '⚠️ Gmail not connected — go to <strong>Settings → Integrations</strong> to connect Gmail';
    } else {
        hint.style.background = '#f8fafc';
        hint.innerHTML = `ℹ️ ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} messages are logged in history only. Direct sending coming soon.`;
    }
}


// ============================================================
// Gmail API Integration - send emails via connected Gmail
// ============================================================

function updateGmailSendStatus() {
    const badge = document.getElementById('gmailSendBadge');
    const notConnectedDiv = document.getElementById('gmailSendNotConnected');
    const connectedDiv = document.getElementById('gmailSendConnected');
    const emailSpan = document.getElementById('gmailSendEmail');

    const connected = gmailConnectionStatus.connected;
    const email = gmailConnectionStatus.email || localStorage.getItem('gmail_user_email') || '';

    if (badge) {
        badge.style.background = connected ? 'var(--success)' : 'var(--warning)';
        badge.textContent = connected ? 'Connected' : 'Not Connected';
    }
    if (notConnectedDiv) notConnectedDiv.style.display = connected ? 'none' : 'block';
    if (connectedDiv) connectedDiv.style.display = connected ? 'block' : 'none';
    if (emailSpan) emailSpan.textContent = email;
}

async function connectGmailForSending() {
    // Reuse the existing Gmail OAuth flow which now includes gmail.send scope
    await connectGmail();
    updateGmailSendStatus();
}

async function disconnectGmailSending() {
    if (!confirm('Disconnect Gmail for sending? You will need to re-authorize.')) return;
    try {
        await callGmailProxy('disconnect');
    } catch (e) {
        console.error('Error disconnecting Gmail:', e);
    }
    localStorage.removeItem('gmail_user_email');
    localStorage.removeItem('gmail_connection_status');
    gmailConnectionStatus = { connected: false, email: null };
    updateGmailSendStatus();
    updateGmailConnectionUI(false);
    renderEmailStatusBanner();
    showToast('Gmail Disconnected', 'Gmail sending has been disconnected.', 'ℹ️');
}

async function sendEmailViaGmail(toEmail, toName, subject, messageBody) {
    if (!gmailConnectionStatus.connected) {
        throw new Error('Gmail not connected. Go to Settings → Integrations to connect Gmail.');
    }

    const businessName = localStorage.getItem('businessName') || 'ResIQ';

    return callGmailProxy('send', {
        to: toEmail,
        toName: toName,
        subject: subject,
        body: messageBody,
        businessName: businessName
    });
}

async function sendComposedMessage() {
    try {
        const channel = document.getElementById('composeChannel');
        const recipient = document.getElementById('composeRecipient');
        const subject = document.getElementById('composeSubject');
        const messageInput = document.getElementById('composeMessage');

        if (!channel || !recipient || !subject || !messageInput) {
            showToast('Error', 'Form elements not found. Please try again.', '❌');
            return;
        }

        const recipientValue = recipient.value;
        const message = messageInput.value.trim();

        if (!recipientValue || recipientValue === '') {
            showToast('Missing Recipient', 'Please select a recipient', '⚠️');
            return;
        }

        if (!message) {
            showToast('Missing Message', 'Please enter a message', '⚠️');
            return;
        }

        const selectedOption = recipient.options[recipient.selectedIndex];
        const recipientText = selectedOption.text;
        const recipientEmail = selectedOption.dataset.email || '';
        const recipientName = selectedOption.dataset.name || recipientText.split('(')[0].trim();

        // For email channel, send via Gmail API
        if (channel.value === 'email') {
            if (!recipientEmail) {
                showToast('No Email', 'This guest has no email address on file. Please update their profile.', '⚠️');
                return;
            }

            const sendBtn = document.querySelector('#composeModal .btn-primary') ||
                            document.querySelector('.modal .btn-primary');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.textContent = '⏳ Sending...';
            }

            try {
                await sendEmailViaGmail(recipientEmail, recipientName, subject.value || 'Message from ResIQ', message);
                showToast('Email Sent', `Email sent to ${recipientName} (${recipientEmail}) via Gmail`, '✅');
            } catch (emailError) {
                showToast('Email Failed', emailError.message || 'Failed to send email. Check Gmail connection in Settings.', '❌');
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = '<i data-lucide="send" style="width: 14px; height: 14px;"></i> Send';
                }
                return;
            }
        }

        const newMessage = {
            id: Date.now(),
            channel: channel.value,
            recipient: recipientText,
            recipientEmail,
            subject: subject.value || 'Message',
            message,
            timestamp: new Date().toISOString(),
            status: channel.value === 'email' ? 'sent' : 'logged'
        };

        communicationMessages.unshift(newMessage);
        await persistCommunication(newMessage);
        renderCommunicationMessages();

        // Close modal
        document.querySelectorAll('.modal').forEach(m => {
            if (m.querySelector('#composeChannel')) m.remove();
        });

        if (channel.value !== 'email') {
            showToast('Logged', `${channel.value.toUpperCase()} message logged for ${recipientName}`, '✅');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error', 'Failed to send message. Please try again.', '❌');
    }
}

function filterCommunications(type, element) {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    if (element) {
        element.classList.add('active');
    }

    currentCommunicationFilter = type;
    renderCommunicationMessages();
}

function sendTemplate(templateType) {
    // Map communication tab template keys to unified modal template keys
    const templateKeyMap = {
        'booking-confirmation': 'booking_confirmation',
        'payment-reminder': 'payment_reminder',
        'check-in': 'check_in_instructions',
        'check-out': 'thank_you',
        'review-request': 'review_request',
        'custom': 'custom'
    };

    const templateKey = templateKeyMap[templateType] || 'custom';

    // Open the unified messaging modal with guest/booking selector
    if (typeof openMessagingModalFromComm === 'function') {
        openMessagingModalFromComm('email', templateKey);
    } else {
        // Fallback to old compose modal
        openComposeModal();
    }
}

// ==========================================
// GMAIL INTEGRATION FUNCTIONS
// ==========================================

let gmailAutoScanInterval = null;

const GMAIL_AUTO_SCAN_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Load Google Identity Services library
 */
function loadGoogleIdentityServices() {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.accounts) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Connect Gmail via OAuth 2.0 (Authorization Code Flow)
 * Tokens are exchanged and stored server-side via /api/gmail-proxy
 */
async function connectGmail() {
    try {
        // Load Google Identity Services
        await loadGoogleIdentityServices();

        // Fetch client ID from server config
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        const clientId = config.gmailClientId;

        if (!clientId) {
            showToast('Gmail OAuth not configured on server. Contact administrator.', 'error');
            return;
        }

        // Initialize code client (authorization code flow — tokens stay server-side)
        const codeClient = google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
            ux_mode: 'popup',
            callback: async (response) => {
                if (response.error) {
                    console.error('OAuth error:', response);
                    showToast('Failed to connect Gmail: ' + response.error, 'error');
                    return;
                }

                try {
                    // Send auth code to server for token exchange
                    const result = await callGmailProxy('callback', { code: response.code });

                    if (result && result.connected) {
                        gmailConnectionStatus = { connected: true, email: result.email };
                        localStorage.setItem('gmail_user_email', result.email);
                        localStorage.setItem('gmail_connection_status', JSON.stringify(gmailConnectionStatus));

                        // Update UI
                        updateGmailConnectionUI(true, result.email);
                        updateGmailSendStatus();
                        renderEmailStatusBanner();

                        showToast('✅ Gmail connected successfully!', 'success');
                    }
                } catch (err) {
                    console.error('Error exchanging Gmail auth code:', err);
                    showToast('Failed to connect Gmail: ' + err.message, 'error');
                }
            }
        });

        // Request authorization code
        codeClient.requestCode();

    } catch (error) {
        console.error('Error connecting Gmail:', error);
        showToast('Failed to connect Gmail: ' + error.message, 'error');
    }
}

/**
 * Update Gmail connection UI
 */
function updateGmailConnectionUI(connected, email = '') {
    const notConnected = document.getElementById('gmailNotConnected');
    const connectedDiv = document.getElementById('gmailConnected');
    const emailSpan = document.getElementById('connectedGmailEmail');
    const autoScanCheckbox = document.getElementById('gmailAutoScanEnabled');

    if (connected) {
        notConnected.style.display = 'none';
        connectedDiv.style.display = 'block';
        emailSpan.textContent = email;
        autoScanCheckbox.disabled = false;
    } else {
        notConnected.style.display = 'flex';
        connectedDiv.style.display = 'none';
        autoScanCheckbox.disabled = true;
        autoScanCheckbox.checked = false;
    }
}

/**
 * Disconnect Gmail
 */
async function disconnectGmail() {
    if (!confirm('Disconnect Gmail? You will need to re-authorize to scan emails.')) return;

    try {
        await callGmailProxy('disconnect');
    } catch (e) {
        console.error('Error disconnecting Gmail:', e);
    }

    localStorage.removeItem('gmail_user_email');
    localStorage.removeItem('gmail_last_scan');
    localStorage.removeItem('gmail_connection_status');
    gmailConnectionStatus = { connected: false, email: null };

    updateGmailConnectionUI(false);
    showToast('Gmail disconnected', 'info');
}

/**
 * Scan Gmail for booking confirmation emails
 */
async function scanGmailNow() {
    if (!gmailConnectionStatus.connected) {
        showToast('Please connect Gmail first', 'error');
        return;
    }

    // Show loading state
    const scanBtn = document.getElementById('gmailScanBtn');
    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.textContent = '⏳ Scanning...';
    }

    try {
        showToast('🔍 Scanning Gmail for booking confirmations...', 'info');

        // Search queries for different OTA confirmation emails
        // "in:anywhere" ensures emails in filtered labels (not just inbox) are found
        const searchQueries = [
            'in:anywhere from:airbnb.com subject:(reservation OR booking OR confirmed)',
            'in:anywhere from:booking.com subject:(confirmed OR reservation OR booking)',
            'in:anywhere from:agoda.com subject:(booking OR confirmed OR confirmation)',
            'in:anywhere from:makemytrip.com subject:(booking OR confirmed)',
            'in:anywhere from:goibibo.com subject:(booking OR confirmed)',
            'in:anywhere from:vrbo.com subject:(reservation OR confirmed)',
            'in:anywhere subject:"booking confirmed" OR subject:"reservation confirmed" OR subject:"booking confirmation"'
        ];

        let totalFound = 0;
        let totalCreated = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalFailed = 0;
        const processedMessageIds = new Set(); // Avoid processing same message from multiple queries

        for (const query of searchQueries) {
            const messages = await searchGmailMessages(query);

            if (messages && messages.length > 0) {
                console.log(`Found ${messages.length} messages for query: ${query}`);

                // Process each message (skip already-processed from earlier queries)
                for (const message of messages.slice(0, 20)) {
                    if (processedMessageIds.has(message.id)) continue;
                    processedMessageIds.add(message.id);
                    totalFound++;

                    const result = await processGmailBookingEmail(message.id);
                    if (result.created) totalCreated++;
                    else if (result.updated) totalUpdated++;
                    else if (result.skipped) totalSkipped++;
                    else totalFailed++;
                }
            }
        }

        // Update last scan time
        const now = new Date().toLocaleString();
        localStorage.setItem('gmail_last_scan', now);
        document.getElementById('gmailLastScan').textContent = now;

        // Show results
        if (totalFound === 0) {
            showToast('No booking emails found. Check if your Gmail account receives OTA confirmation emails.', 'info');
        } else {
            const parts = [`Scanned ${totalFound} emails`];
            if (totalCreated > 0) parts.push(`${totalCreated} created`);
            if (totalUpdated > 0) parts.push(`${totalUpdated} updated`);
            if (totalSkipped > 0) parts.push(`${totalSkipped} duplicates skipped`);
            if (totalFailed > 0) parts.push(`${totalFailed} could not be parsed`);
            showToast(`✅ ${parts.join(', ')}`, totalCreated > 0 ? 'success' : 'info');
            if (totalCreated > 0 || totalUpdated > 0) {
                await loadReservations();
                await loadDashboard();
            }
        }

    } catch (error) {
        console.error('Error scanning Gmail:', error);
        showToast('Failed to scan Gmail: ' + error.message, 'error');
    } finally {
        // Restore button
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.textContent = '<i data-lucide="search" style="width: 14px; height: 14px; margin-right: 4px;"></i>Scan for Bookings Now';
        }
    }
}

/**
 * Search Gmail messages
 */
async function searchGmailMessages(query) {
    try {
        const result = await callGmailProxy('search', { query, maxResults: 20 });
        console.log(`[Gmail Search] query="${query}" → ${result ? result.length : 0} results`);
        return result;
    } catch (error) {
        console.error(`[Gmail Search] query="${query}" → ERROR:`, error.message);
        return [];
    }
}

/**
 * Diagnose Gmail scan — shows detailed results in a modal for troubleshooting
 */
window.diagnoseGmailScan = async function() {
    if (!gmailConnectionStatus.connected) {
        alert('Gmail not connected. Connect Gmail first.');
        return;
    }

    let report = '=== Gmail Scan Diagnostic ===\n\n';

    try {
        // Test connection
        report += '1. CONNECTION: ';
        try {
            const profile = await callGmailProxy('profile');
            report += `✅ Connected as ${profile.emailAddress}\n\n`;
        } catch (e) {
            report += `❌ ${e.message}\n\n`;
            alert(report);
            return;
        }

        // Test each search query (with and without in:anywhere)
        const searchQueries = [
            'in:anywhere from:airbnb.com subject:(reservation OR booking OR confirmed)',
            'in:anywhere from:booking.com subject:(confirmed OR reservation OR booking)',
            'in:anywhere from:agoda.com subject:(booking OR confirmed OR confirmation)',
            'in:anywhere from:makemytrip.com subject:(booking OR confirmed)',
            // Broader fallback queries for diagnosis (any email from OTA)
            'in:anywhere from:airbnb.com',
            'in:anywhere from:booking.com',
            'in:anywhere from:agoda.com',
            // Without in:anywhere to compare (inbox only)
            'from:airbnb.com',
            'from:booking.com',
        ];

        report += '2. SEARCH QUERIES:\n';
        let firstMessageId = null;

        for (const query of searchQueries) {
            try {
                const messages = await callGmailProxy('search', { query, maxResults: 5 });
                const count = messages ? messages.length : 0;
                report += `   ${count > 0 ? '✅' : '⚠️'} "${query}" → ${count} result(s)\n`;
                if (count > 0 && !firstMessageId) {
                    firstMessageId = messages[0].id;
                }
            } catch (e) {
                report += `   ❌ "${query}" → ERROR: ${e.message}\n`;
            }
        }

        // Try parsing a sample email
        report += '\n3. SAMPLE EMAIL PARSING:\n';
        if (firstMessageId) {
            try {
                const message = await callGmailProxy('getMessage', { messageId: firstMessageId });
                const headers = message.payload.headers;
                const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '?';
                const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '?';
                report += `   From: ${from}\n`;
                report += `   Subject: ${subject}\n`;

                const body = extractEmailBody(message);
                report += `   Body length: ${body.length} chars\n`;
                report += `   Body preview: ${body.substring(0, 200)}...\n\n`;

                // Try parsing
                const { data: properties } = await supabase
                    .from('properties')
                    .select('id, name, location')
                    .eq('is_active', true);

                const parsed = parseBookingEmail(body, from, subject, properties || []);
                if (parsed) {
                    report += '   Parsed: ✅\n';
                    report += `   Booking ID: ${parsed.booking_id}\n`;
                    report += `   Guest: ${parsed.guest_name}\n`;
                    report += `   Check-in: ${parsed.check_in}\n`;
                    report += `   Check-out: ${parsed.check_out}\n`;
                    report += `   Property: ${parsed.property_name}\n`;
                    report += `   Source: ${parsed.booking_source}\n`;
                } else {
                    report += '   Parsed: ❌ Could not extract booking data\n';
                    report += '   (Need at least a check-in date in the email)\n';
                }
            } catch (e) {
                report += `   ❌ Error: ${e.message}\n`;
            }
        } else {
            report += '   No emails found to test parsing.\n';
            report += '   Check: Does this Gmail account receive OTA booking confirmation emails?\n';
        }

    } catch (e) {
        report += `\nFATAL ERROR: ${e.message}\n`;
    }

    console.log(report);

    // Show in a modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.dataset.enquiryModal = 'true';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>Gmail Scan Diagnostic</h2>
                <button class="close-modal" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <pre style="white-space: pre-wrap; font-size: 13px; background: #f8fafc; padding: 16px; border-radius: 8px; max-height: 60vh; overflow-y: auto;">${report.replace(/</g, '&lt;')}</pre>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

/**
 * Process a booking confirmation email
 */
async function processGmailBookingEmail(messageId) {
    try {
        // Fetch full message via server proxy
        const message = await callGmailProxy('getMessage', { messageId });

        // Extract email body
        const emailBody = extractEmailBody(message);
        const headers = message.payload.headers;

        // Get sender
        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
        const sender = fromHeader ? fromHeader.value : '';

        // Get subject for better property matching
        const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
        const subject = subjectHeader ? subjectHeader.value : '';

        // Fetch all properties for auto-detection
        const { data: properties } = await supabase
            .from('properties')
            .select('id, name, location')
            .eq('is_active', true);

        // Parse booking data from email (with property auto-detection)
        const bookingData = parseBookingEmail(emailBody, sender, subject, properties || []);

        if (!bookingData) {
            console.log('[Gmail] Could not parse booking data from email');
            return { created: false, updated: false, skipped: false };
        }

        // Check 1: Duplicate by booking_id
        const { data: existingById } = await supabase
            .from('reservations')
            .select('*')
            .eq('booking_id', bookingData.booking_id)
            .maybeSingle();

        if (existingById) {
            // Update existing
            await supabase
                .from('reservations')
                .update(bookingData)
                .eq('id', existingById.id);
            return { created: false, updated: true, skipped: false };
        }

        // Check 2: Duplicate by property + check_in + check_out dates
        if (bookingData.property_id && bookingData.check_in && bookingData.check_out) {
            const { data: existingByDates } = await supabase
                .from('reservations')
                .select('id, booking_id, guest_name')
                .eq('property_id', bookingData.property_id)
                .eq('check_in', bookingData.check_in)
                .eq('check_out', bookingData.check_out)
                .maybeSingle();

            if (existingByDates) {
                console.log(`[Gmail] Duplicate skipped: property ${bookingData.property_id}, ${bookingData.check_in} to ${bookingData.check_out} (existing: ${existingByDates.booking_id})`);
                return { created: false, updated: false, skipped: true };
            }
        }

        // Create new reservation
        const { error: insertError } = await supabase
            .from('reservations')
            .insert([bookingData]);

        if (insertError) {
            console.error('[Gmail] Error inserting reservation:', insertError);
            return { created: false, updated: false, skipped: false };
        }
        return { created: true, updated: false, skipped: false };

    } catch (error) {
        console.error('Error processing email:', error);
        return { created: false, updated: false };
    }
}

/**
 * Decode a base64url-encoded Gmail body part
 */
function decodeGmailBody(data) {
    try {
        return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (e) {
        return '';
    }
}

/**
 * Recursively extract text from Gmail MIME parts
 * Prefers text/plain; falls back to text/html (stripped of tags)
 */
function extractEmailBody(message) {
    let plainText = '';
    let htmlText = '';

    function walkParts(parts) {
        if (!parts) return;
        for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                plainText += decodeGmailBody(part.body.data);
            } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
                htmlText += decodeGmailBody(part.body.data);
            } else if (part.parts) {
                walkParts(part.parts); // recurse into multipart
            }
        }
    }

    if (message.payload.parts) {
        walkParts(message.payload.parts);
    } else if (message.payload.body && message.payload.body.data) {
        const rawBody = decodeGmailBody(message.payload.body.data);
        if (message.payload.mimeType === 'text/html') {
            htmlText = rawBody;
        } else {
            plainText = rawBody;
        }
    }

    if (plainText.trim()) return plainText;

    // Strip HTML tags as fallback
    if (htmlText) {
        return htmlText
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    return '';
}

/**
 * Parse booking details from email body
 */
function parseBookingEmail(emailBody, sender, subject = '', properties = []) {
    let bookingSource = 'OTHER';
    const senderLower = sender.toLowerCase();

    // Detect source from sender email address
    if (senderLower.includes('airbnb')) bookingSource = 'AIRBNB';
    else if (senderLower.includes('booking.com') || senderLower.includes('agoda')) bookingSource = 'AGODA/BOOKING.COM';
    else if (senderLower.includes('makemytrip') || senderLower.includes('goibibo')) bookingSource = 'MMT/GOIBIBO';
    else if (senderLower.includes('vrbo') || senderLower.includes('homeaway')) bookingSource = 'VRBO';

    // Multiple pattern variants per field for better OTA coverage
    const patternGroups = {
        bookingId: [
            /(?:confirmation|booking|reservation)\s*(?:code|number|id|#)[:\s#]+([A-Z0-9]{4,20})/i,
            /(?:conf\.?\s*(?:code|no|#)|booking\s*ref)[:\s]+([A-Z0-9]{4,20})/i,
            /HM[A-Z0-9]{6,}/i, // Airbnb HMXXXXXX format
            /\b([A-Z0-9]{10,20})\b/ // Generic long alphanumeric code
        ],
        guestName: [
            /(?:guest(?:'s)?\s+name|booked by|name)[:\s]+([A-Za-z][\w\s]{2,40}?)(?:\n|,|$)/i,
            /(?:hi|hello|dear)\s+([A-Za-z][\w\s]{2,30}?)(?:,|!|\n)/i,
            /^([A-Za-z][\w\s]{2,30}?) has reserved/im
        ],
        checkIn: [
            /check[- ]?in[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /check[- ]?in[:\s]+(\w+ \d{1,2},? \d{4})/i,
            /arrives?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /from[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
        ],
        checkOut: [
            /check[- ]?out[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /check[- ]?out[:\s]+(\w+ \d{1,2},? \d{4})/i,
            /departs?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /to[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
        ],
        guests: [/(\d+)\s+(?:guests?|people|persons?)/i],
        nights: [/(\d+)\s+nights?/i],
        total: [
            /total\s*(?:amount|price|cost)?[:\s]+[₹$€£]?\s*([0-9,]+(?:\.\d{1,2})?)/i,
            /[₹$€£]\s*([0-9,]+(?:\.\d{1,2})?)\s*(?:total|charge)/i
        ],
        guestPhone: [/(?:phone|mobile|contact)[:\s]+(\+?[\d\s\-()]{8,15})/i],
        guestEmail: [/(?:guest\s*)?email[:\s]+([\w.+-]+@[\w-]+\.\w+)/i]
    };

    const extracted = {};
    for (const [key, patterns] of Object.entries(patternGroups)) {
        for (const pattern of patterns) {
            const match = emailBody.match(pattern);
            if (match) {
                extracted[key] = (match[1] || match[0]).trim();
                break;
            }
        }
    }

    // Must have at least a check-in date
    if (!extracted.checkIn) {
        console.log('[Gmail] Could not extract check-in date from email');
        return null;
    }

    // Auto-generate booking_id if not extracted (use source + date combo)
    const bookingId = extracted.bookingId
        ? extracted.bookingId.substring(0, 50)
        : `GMAIL-${bookingSource}-${extracted.checkIn.replace(/\D/g, '')}`.substring(0, 50);
    const guestName = (extracted.guestName || 'Guest').substring(0, 50);

    // Parse dates
    const checkIn = parseFlexibleDate(extracted.checkIn);
    const checkOut = extracted.checkOut ? parseFlexibleDate(extracted.checkOut) : null;

    if (!checkIn) return null;

    // Calculate nights
    let nights = parseInt(extracted.nights) || 1;
    if (checkOut && checkIn) {
        const computed = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        if (computed > 0) nights = computed;
    }

    // Auto-calculate check-out if not provided
    const finalCheckOut = checkOut || new Date(new Date(checkIn).getTime() + nights * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const monthDate = new Date(checkIn);
    const month = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    // Property Auto-Detection: match property from email content
    let matchedProperty = null;
    const searchText = (subject + ' ' + emailBody).toLowerCase();

    for (const property of properties) {
        const propNameLower = property.name.toLowerCase();
        const locationLower = (property.location || '').toLowerCase();

        // Check if property name appears in subject or email body
        if (searchText.includes(propNameLower)) {
            matchedProperty = property;
            break;
        }

        // Also check location (e.g., "Goa Villa" → matches properties in Goa)
        if (locationLower && searchText.includes(locationLower)) {
            matchedProperty = property;
            break;
        }
    }

    // Fall back to first property if no match found
    if (!matchedProperty && properties.length > 0) {
        matchedProperty = properties[0];
        console.log('[Gmail] No property match found, using first property:', matchedProperty.name);
    }

    const propertyId = matchedProperty ? matchedProperty.id : null;
    const propertyName = matchedProperty ? matchedProperty.name.substring(0, 50) : null;

    return {
        booking_id: bookingId,
        guest_name: guestName,
        check_in: checkIn,
        check_out: finalCheckOut,
        nights: nights,
        booking_source: bookingSource,
        status: 'confirmed',
        booking_type: 'STAYCATION',
        booking_date: new Date().toISOString().split('T')[0],
        month: month,
        number_of_guests: parseInt(extracted.guests) || null,
        total_amount: extracted.total ? parseFloat(extracted.total.replace(/,/g, '')) : null,
        property_id: propertyId,
        property_name: propertyName,
        // Empty strings for NOT NULL varchar fields
        guest_phone: extracted.guestPhone ? extracted.guestPhone.replace(/\s/g, '') : '',
        guest_email: extracted.guestEmail || '',
        guest_city: '',
        // Nullable fields
        adults: parseInt(extracted.guests) || null,
        kids: null,
        number_of_rooms: null,
        stay_amount: null,
        extra_guest_charges: null,
        meals_chef: null,
        bonfire_other: null,
        ota_service_fee: null,
        taxes: null,
        total_amount_pre_tax: null,
        total_amount_inc_tax: null,
        damages: null,
        hostizzy_revenue: null,
        host_payout: null,
        payout_eligible: null,
        avg_room_rate: null,
        avg_nightly_rate: null,
        paid_amount: null,
        payment_status: null,
        gst_status: null
    };
}

/**
 * Parse flexible date formats
 */
function parseFlexibleDate(dateStr) {
    try {
        // Try different formats
        const formats = [
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/, // MM/DD/YYYY or DD-MM-YYYY
            /(\w+)\s+(\d{1,2}),?\s+(\d{4})/ // Month DD, YYYY
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Toggle Gmail auto-scan on/off
 */
function toggleGmailAutoScan() {
    const checkbox = document.getElementById('gmailAutoScanEnabled');
    if (!checkbox) return;

    if (checkbox.checked) {
        localStorage.setItem('gmail_auto_scan', 'true');
        // Run immediately, then every 2 hours
        scanGmailNow();
        gmailAutoScanInterval = setInterval(() => {
            console.log('[Gmail] Auto-scanning for new booking emails...');
            scanGmailNow();
        }, GMAIL_AUTO_SCAN_INTERVAL_MS);
        showToast('Auto-scan enabled: checking every 2 hours', 'success');
    } else {
        localStorage.setItem('gmail_auto_scan', 'false');
        if (gmailAutoScanInterval) {
            clearInterval(gmailAutoScanInterval);
            gmailAutoScanInterval = null;
        }
        showToast('Auto-scan disabled', 'info');
    }
}

/**
 * Initialize Gmail connection on page load
 */
async function initializeGmailConnection() {
    const lastScan = localStorage.getItem('gmail_last_scan');
    const autoScanEnabled = localStorage.getItem('gmail_auto_scan') === 'true';

    // Check Gmail connection status from server
    await checkGmailStatus();

    if (gmailConnectionStatus.connected) {
        updateGmailConnectionUI(true, gmailConnectionStatus.email);
        updateGmailSendStatus();
        renderEmailStatusBanner();

        if (lastScan) {
            const lastScanEl = document.getElementById('gmailLastScan');
            if (lastScanEl) lastScanEl.textContent = lastScan;
        }

        // Restore auto-scan state
        const checkbox = document.getElementById('gmailAutoScanEnabled');
        if (checkbox && autoScanEnabled) {
            checkbox.checked = true;
            gmailAutoScanInterval = setInterval(() => {
                console.log('[Gmail] Auto-scanning for new booking emails...');
                scanGmailNow();
            }, GMAIL_AUTO_SCAN_INTERVAL_MS);
        }
    }
}

// Initialize Performance View
