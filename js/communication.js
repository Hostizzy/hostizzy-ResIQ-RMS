// ResIQ Communication — Email compose, Gmail integration, message templates
// Enhanced: Supabase persistence, custom templates, scheduled messages

// Pending import review items (populated by scan, cleared after import)
let pendingImportItems = [];

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
 * Build OTA search queries with date filtering
 */
function buildOtaSearchQueries(monthsBack = 6) {
    let after = '';
    if (monthsBack) {
        const afterDate = new Date();
        afterDate.setMonth(afterDate.getMonth() - monthsBack);
        after = ` after:${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
    }
    return [
        `in:anywhere${after} from:airbnb.com subject:(reservation OR booking OR confirmed)`,
        `in:anywhere${after} from:booking.com subject:(confirmed OR reservation OR booking)`,
        `in:anywhere${after} from:agoda.com subject:(booking OR confirmed OR confirmation)`,
        `in:anywhere${after} from:go-mmt.com subject:(booking OR confirmed)`,
        `in:anywhere${after} from:makemytrip.com subject:(booking OR confirmed)`,
        `in:anywhere${after} from:goibibo.com subject:(booking OR confirmed)`,
        `in:anywhere${after} from:vrbo.com subject:(reservation OR confirmed)`,
        `in:anywhere${after} from:expedia.com subject:(confirmed OR itinerary)`,
        `in:anywhere${after} from:hotels.com subject:(confirmed OR reservation)`,
        `in:anywhere${after} from:cleartrip.com subject:(booking OR confirmed)`,
        `in:anywhere${after} from:oyorooms.com subject:(booking OR confirmed)`,
        `in:anywhere${after} subject:"booking confirmed" OR subject:"reservation confirmed"`,
    ];
}

// Module-level variable for property list used in import review
let importProperties = [];

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

        const searchQueries = buildOtaSearchQueries(6);

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
                for (const message of messages.slice(0, 100)) {
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
        const result = await callGmailProxy('search', { query, maxResults: 100 });
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
            'in:anywhere from:go-mmt.com subject:(booking OR confirmed)',
            'in:anywhere from:makemytrip.com subject:(booking OR confirmed)',
            'in:anywhere from:goibibo.com subject:(booking OR confirmed)',
            // Broader fallback queries for diagnosis (any email from OTA)
            'in:anywhere from:airbnb.com',
            'in:anywhere from:booking.com',
            'in:anywhere from:agoda.com',
            'in:anywhere from:go-mmt.com',
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

        // Get date header for year inference
        const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
        const emailDate = dateHeader ? dateHeader.value : '';

        // Fetch all properties for auto-detection
        const { data: properties } = await supabase
            .from('properties')
            .select('id, name, location')
            .eq('is_active', true);

        // Parse booking data from email (with property auto-detection)
        const bookingData = parseBookingEmail(emailBody, sender, subject, properties || [], emailDate);

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
            // Update existing — ONLY update non-financial fields to avoid wiping out manually entered data
            const safeUpdate = {};
            if (bookingData.guest_name && bookingData.guest_name !== 'Guest') safeUpdate.guest_name = bookingData.guest_name;
            if (bookingData.check_in) safeUpdate.check_in = bookingData.check_in;
            if (bookingData.check_out) safeUpdate.check_out = bookingData.check_out;
            if (bookingData.nights) safeUpdate.nights = bookingData.nights;
            if (bookingData.month) safeUpdate.month = bookingData.month;
            if (bookingData.guest_phone) safeUpdate.guest_phone = bookingData.guest_phone;
            if (bookingData.guest_email) safeUpdate.guest_email = bookingData.guest_email;
            if (bookingData.booking_source && bookingData.booking_source !== 'OTHER') safeUpdate.booking_source = bookingData.booking_source;
            safeUpdate.updated_at = new Date().toISOString();

            if (Object.keys(safeUpdate).length > 1) { // More than just updated_at
                await supabase
                    .from('reservations')
                    .update(safeUpdate)
                    .eq('id', existingById.id);
            }
            return { created: false, updated: true, skipped: false };
        }

        // Check 2: Duplicate by (check_in OR check_out), scoped to property if matched
        if (bookingData.check_in || bookingData.check_out) {
            let query = supabase
                .from('reservations')
                .select('id, booking_id, guest_name, property_name, check_in, check_out');

            // Scope to property if we matched one
            if (bookingData.property_id) {
                query = query.eq('property_id', bookingData.property_id);
            }

            // Build OR filter: check_in matches OR check_out matches
            const orParts = [];
            if (bookingData.check_in) orParts.push(`check_in.eq.${bookingData.check_in}`);
            if (bookingData.check_out) orParts.push(`check_out.eq.${bookingData.check_out}`);
            if (orParts.length > 0) {
                query = query.or(orParts.join(','));
            }

            const { data: dupes } = await query;
            if (dupes && dupes.length > 0) {
                console.log(`[Gmail] Duplicate skipped: dates match existing reservation(s):`, dupes.map(r => `${r.booking_id} (${r.check_in}→${r.check_out})`));
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
            .replace(/<\/tr>/gi, '\n')
            .replace(/<\/td>/gi, ' ')
            .replace(/<\/th>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#8377;|&#x20B9;/g, '₹')
            .replace(/&rsquo;|&#8217;/g, "'")
            .replace(/&lsquo;|&#8216;/g, "'")
            .replace(/&rdquo;|&#8221;|&ldquo;|&#8220;/g, '"')
            .replace(/&mdash;|&#8212;/g, '—')
            .replace(/&ndash;|&#8211;/g, '–')
            .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
            .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/[^\S\n]{2,}/g, ' ')
            .replace(/ *\n */g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    return '';
}

/**
 * Extract year from email Date header
 */
function getEmailYear(dateHeader) {
    if (!dateHeader) return new Date().getFullYear();
    try {
        const d = new Date(dateHeader);
        return !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
    } catch { return new Date().getFullYear(); }
}

/**
 * Parse Airbnb confirmation email
 */
function parseAirbnbEmail(body, subject, emailYear) {
    const extracted = {};

    // Booking ID: "Confirmation code\nHMKSK453Q8" or inline
    let m = body.match(/Confirmation code\s+([A-Z0-9]{6,12})/i)
         || body.match(/confirmation code[:\s]+([A-Z0-9]{6,12})/i)
         || body.match(/(HM[A-Z0-9]{6,})/);
    extracted.bookingId = m ? m[1] : null;

    // Guest name: from subject "confirmed - Yash Jain arrives" or body "Yash Jain\nIdentity verified"
    m = subject.match(/confirmed\s*[-–—]\s*(.+?)\s+arrives?/i)
     || body.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n\s*Identity/m)
     || body.match(/(?:guest|booked by)[:\s]+([A-Za-z][\w\s]{2,40}?)(?:\n|,|$)/i);
    extracted.guestName = m ? m[1].trim() : null;

    // Dates: "Check-in\nSun, 26 Apr" or "Checkout\nSunday, 26 Apr" — no year, infer from email
    // Support ASCII hyphen, en-dash, em-dash, or no separator between Check and in/out
    m = body.match(/Check[-–—]?in\s+(?:\w{3,9},?\s*)?(\d{1,2}\s+\w{3,9}(?:\s+'?\d{2,4})?)/i);
    extracted.checkIn = m ? m[1].trim() : null;

    m = body.match(/Check[-–—]?out\s+(?:\w{3,9},?\s*)?(\d{1,2}\s+\w{3,9}(?:\s+'?\d{2,4})?)/i);
    extracted.checkOut = m ? m[1].trim() : null;

    // Guests: "6 adults" or "2 guests"
    m = body.match(/(\d+)\s+(?:adults?|guests?)/i);
    extracted.guests = m ? m[1] : null;

    // Nights: "₹14,400 x 1 night"
    m = body.match(/x\s*(\d+)\s*nights?/i) || body.match(/(\d+)\s*nights?/i);
    extracted.nights = m ? m[1] : null;

    // Total: "Total (INR)\n₹16,992" or "Total\n₹16,992"
    m = body.match(/Total\s*(?:\(INR\))?\s*₹\s*([0-9,.]+)/i)
     || body.match(/Total\s*(?:amount|price|cost)?[:\s]*[₹$€£]\s*([0-9,.]+)/i);
    extracted.total = m ? m[1] : null;

    // Host payout: "You earn\n₹14,760"
    m = body.match(/You earn\s*₹\s*([0-9,.]+)/i);
    extracted.hostPayout = m ? m[1] : null;

    // Guest phone/email
    m = body.match(/(?:phone|mobile|contact)[:\s]+(\+?[\d\s\-()]{8,15})/i);
    extracted.guestPhone = m ? m[1] : null;
    m = body.match(/([\w.+-]+@[\w-]+\.\w+)/);
    extracted.guestEmail = m ? m[1] : null;

    if (!extracted.checkIn) return null;
    return { ...extracted, bookingSource: 'AIRBNB', emailYear };
}

/**
 * Parse Goibibo / MakeMyTrip confirmation email (shared format)
 */
function parseGoibiboMmtEmail(body, subject, sender) {
    const extracted = {};
    const senderLower = sender.toLowerCase();

    // Determine specific source
    const isGoibibo = senderLower.includes('goibibo') || subject.toLowerCase().includes('goibibo');
    extracted.bookingSource = isGoibibo ? 'GOIBIBO' : 'MAKEMYTRIP';

    // Booking ID: from subject "- GH74052265691640" or body "BOOKING ID\nGH740..."
    let m = subject.match(/[-–]\s*([A-Z]{2}\d{10,16})/)
         || body.match(/BOOKING ID\s+([A-Z]{2}\d{10,16})/i)
         || body.match(/Booking ID[:\s]+([A-Z0-9]{8,20})/i);
    extracted.bookingId = m ? m[1] : null;

    // Guest name: "PRIMARY GUEST DETAILS\nManoj Mishra"
    m = body.match(/PRIMARY GUEST DETAILS\s+([A-Za-z][\w\s]+?)(?:\n|CHECK|BOOKING)/i)
     || body.match(/Guest Name[:\s]+([A-Za-z][\w\s]{2,40}?)(?:\n|,|$)/i);
    extracted.guestName = m ? m[1].trim() : null;

    // Dates: "CHECK-IN\nCHECK-OUT\n29 Mar '26\n2:00 PM\n30 Mar '26"
    // or "CHECK-IN\n29 Mar '26" ... "CHECK-OUT\n30 Mar '26"
    const datePattern = /(\d{1,2}\s+\w{3,9}\s+'?\d{2,4})/g;
    const allDates = [];
    let dm;
    while ((dm = datePattern.exec(body)) !== null) {
        allDates.push(dm[1]);
    }

    // Try structured extraction first
    m = body.match(/CHECK[-–—]?IN[\s\S]*?(\d{1,2}\s+\w{3,9}\s+'?\d{2,4})/i);
    extracted.checkIn = m ? m[1].trim() : (allDates[0] || null);

    // Check-out: second date, or date before "(X Night)"
    m = body.match(/(\d{1,2}\s+\w{3,9}\s+'?\d{2,4})\s*\(?(\d+)\s*Night/i);
    if (m) {
        extracted.checkOut = m[1].trim();
        extracted.nights = m[2];
    } else {
        extracted.checkOut = allDates.length >= 2 ? allDates[1] : null;
    }

    // Nights: "(1 Night)" or "1 Night(s)"
    if (!extracted.nights) {
        m = body.match(/\((\d+)\s*Night/i) || body.match(/(\d+)\s*Night\(s\)/i);
        extracted.nights = m ? m[1] : null;
    }

    // Guests: "TOTAL NO. OF GUEST(S)\n8 Adults"
    m = body.match(/TOTAL NO\.\s*OF GUEST\(?S?\)?\s+(\d+)\s*Adults?/i)
     || body.match(/(\d+)\s+(?:adults?|guests?)/i);
    extracted.guests = m ? m[1] : null;

    // Rooms: "3 Room(s)"
    m = body.match(/(\d+)\s*Room\(?s?\)?/i);
    extracted.rooms = m ? m[1] : null;

    // Financial: "Property Gross Charges\n₹ 11,025.0"
    m = body.match(/Property Gross Charges[^₹]*₹\s*([0-9,.]+)/i)
     || body.match(/Total (?:Amount|Charges?)[^₹]*₹\s*([0-9,.]+)/i);
    extracted.total = m ? m[1] : null;

    // Host payout: "Payable to Property\n₹ 9,475.2"
    m = body.match(/Payable to Property[^₹]*₹\s*([0-9,.]+)/i);
    extracted.hostPayout = m ? m[1] : null;

    // Commission: "Go-MMT Commission (including GST)\n(5+6)\n₹ 1,486.8"
    m = body.match(/Go-?MMT Commission[^₹]*₹\s*([0-9,.]+)/i)
     || body.match(/Commission[^₹]*₹\s*([0-9,.]+)/i);
    extracted.commission = m ? m[1] : null;

    // Property name hint from subject: "Received for The Bageecha on GoIbibo"
    m = subject.match(/Received for\s+(.+?)\s+on\s+(?:GoIbibo|MakeMyTrip)/i);
    extracted.propertyNameHint = m ? m[1].trim() : null;

    // Guest phone/email
    m = body.match(/(?:phone|mobile|contact)[:\s]+(\+?[\d\s\-()]{8,15})/i);
    extracted.guestPhone = m ? m[1] : null;
    m = body.match(/Guest Email[:\s]+([\w.+-]+@[\w-]+\.\w+)/i) || body.match(/([\w.+-]+@[\w-]+\.\w+)/);
    extracted.guestEmail = m ? m[1] : null;

    if (!extracted.checkIn) return null;
    return extracted;
}

/**
 * Parse Agoda confirmation email
 */
function parseAgodaEmail(body, subject) {
    const extracted = { bookingSource: 'AGODA' };

    // Booking ID: from subject "Agoda Booking ID 1986184436" or body "Booking ID\n1986184436"
    let m = subject.match(/Agoda Booking ID\s+(\d{8,15})/i)
         || body.match(/Booking ID\s+(\d{8,15})/i)
         || body.match(/Booking ID[:\s]+(\d{6,15})/i);
    extracted.bookingId = m ? m[1] : null;

    // Guest name: combine "Customer First Name\nGAURAV" + "Customer Last Name\nMISHRA"
    const firstName = body.match(/Customer First Name\s+([A-Z]+)/i);
    const lastName = body.match(/Customer Last Name\s+([A-Z]+)/i);
    if (firstName && lastName) {
        const fn = firstName[1].charAt(0) + firstName[1].slice(1).toLowerCase();
        const ln = lastName[1].charAt(0) + lastName[1].slice(1).toLowerCase();
        extracted.guestName = `${fn} ${ln}`;
    } else {
        m = body.match(/Guest Name[:\s]+([A-Za-z][\w\s]{2,40}?)(?:\n|,|$)/i)
         || body.match(/Name:\s*([A-Za-z][\w\s]{2,40}?)(?:,|\n|$)/i);
        extracted.guestName = m ? m[1].trim() : null;
    }

    // Dates: "Check-in\nFebruary 28, 2026" or from subject "Check-in February 28, 2026"
    m = body.match(/Check[-–—]?in\s+(\w+\s+\d{1,2},?\s+\d{4})/i)
     || subject.match(/Check[-–—]?in\s+(\w+\s+\d{1,2},?\s+\d{4})/i);
    extracted.checkIn = m ? m[1].trim() : null;

    m = body.match(/Check[-–—]?out\s+(\w+\s+\d{1,2},?\s+\d{4})/i);
    extracted.checkOut = m ? m[1].trim() : null;

    // Guests: "12 Adults"
    m = body.match(/(\d+)\s+Adults?/i);
    extracted.guests = m ? m[1] : null;

    // Rooms: "No. of Rooms\n1" or just a number after rooms label
    m = body.match(/No\.\s*of Rooms?\s+(\d+)/i) || body.match(/(\d+)\s*Room\(?s?\)?/i);
    extracted.rooms = m ? m[1] : null;

    // Financial: "INR\n31,468.50" or "INR 32,642.50"
    // First INR amount is usually room rate, second is net rate
    const inrAmounts = [];
    const inrPattern = /INR\s*([0-9,.]+)/gi;
    let im;
    while ((im = inrPattern.exec(body)) !== null) {
        inrAmounts.push(im[1]);
    }

    // Look for specific labeled amounts
    m = body.match(/Reference sell rate[^I]*INR\s*([0-9,.]+)/i)
     || body.match(/Total (?:Amount|Rate|Price)[^I]*INR\s*([0-9,.]+)/i);
    extracted.total = m ? m[1] : (inrAmounts[0] || null);

    m = body.match(/Net rate[^I]*INR\s*([0-9,.]+)/i);
    extracted.hostPayout = m ? m[1] : (inrAmounts.length >= 2 ? inrAmounts[inrAmounts.length - 1] : null);

    // Guest phone: "Phone: 91 9871403362" in Customer Info
    m = body.match(/Phone:\s*(\+?[\d\s]{8,15})/i)
     || body.match(/(?:phone|mobile|contact)[:\s]+(\+?[\d\s\-()]{8,15})/i);
    extracted.guestPhone = m ? m[1] : null;

    // Guest email
    m = body.match(/(?:guest\s*)?email[:\s]+([\w.+-]+@[\w-]+\.\w+)/i);
    extracted.guestEmail = m ? m[1] : null;

    // Nights
    m = body.match(/(\d+)\s*nights?/i);
    extracted.nights = m ? m[1] : null;

    if (!extracted.checkIn) return null;
    return extracted;
}

/**
 * Parse generic booking email (improved fallback for unknown OTAs)
 */
function parseGenericBookingEmail(body, subject) {
    // Preprocess: collapse common multi-line "Label\nValue" patterns into "Label: Value"
    const preprocessed = body
        .replace(/(Check[-–—]?in|Check[-–—]?out|Confirmation code|Booking ID|Guest name|Booking Reference)\s*\n\s*/gi, '$1: ')
        .replace(/(Total|Amount|Price)\s*\n\s*([₹$€£INR])/gi, '$1: $2');

    const patternGroups = {
        bookingId: [
            /(?:confirmation|booking|reservation)\s*(?:code|number|id|#|ref)[:\s#]+([A-Z0-9]{4,20})/i,
            /(?:conf\.?\s*(?:code|no|#)|booking\s*ref)[:\s]+([A-Z0-9]{4,20})/i,
            /HM[A-Z0-9]{6,}/i,
            /\b([A-Z]{2}\d{10,16})\b/,
        ],
        guestName: [
            /(?:guest(?:'s)?\s+name|booked by|name)[:\s]+([A-Za-z][\w\s]{2,40}?)(?:\n|,|$)/i,
            /(?:hi|hello|dear)\s+([A-Za-z][\w\s]{2,30}?)(?:,|!|\n)/i,
            /^([A-Za-z][\w\s]{2,30}?) has reserved/im,
        ],
        checkIn: [
            /check[- –—]?in[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /check[- –—]?in[:\s]+(\d{1,2}\s+\w+\s+'?\d{2,4})/i,
            /check[- –—]?in[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
            /check[- –—]?in[:\s]+(\d{4}-\d{2}-\d{2})/i,
            /arrives?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /arrives?[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i,
            /from[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /(?:start|begin)s?\s*(?:date)?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        ],
        checkOut: [
            /check[- –—]?out[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /check[- –—]?out[:\s]+(\d{1,2}\s+\w+\s+'?\d{2,4})/i,
            /check[- –—]?out[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
            /check[- –—]?out[:\s]+(\d{4}-\d{2}-\d{2})/i,
            /departs?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /departs?[:\s]+(\d{1,2}\s+\w+\s+\d{4})/i,
            /(?:end|until)\s*(?:date)?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        ],
        guests: [/(\d+)\s+(?:guests?|adults?|people|persons?)/i],
        nights: [/(\d+)\s+nights?/i],
        total: [
            /total\s*(?:amount|price|cost|payable)?[:\s]+(?:INR|Rs\.?|₹|\$|€|£)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
            /(?:INR|Rs\.?|₹|\$|€|£)\s*([0-9,]+(?:\.\d{1,2})?)\s*(?:total|charge|payable)/i,
            /(?:INR|Rs\.?)\s+([0-9,]+(?:\.\d{1,2})?)/i,
        ],
        guestPhone: [/(?:phone|mobile|contact)[:\s]+(\+?[\d\s\-()]{8,15})/i],
        guestEmail: [/(?:guest\s*)?email[:\s]+([\w.+-]+@[\w-]+\.\w+)/i],
    };

    const extracted = { bookingSource: 'OTHER' };
    for (const [key, patterns] of Object.entries(patternGroups)) {
        for (const pattern of patterns) {
            const match = preprocessed.match(pattern);
            if (match) {
                extracted[key] = (match[1] || match[0]).trim();
                break;
            }
        }
    }

    // Try date range: "15 Apr - 18 Apr 2026"
    if (!extracted.checkIn || !extracted.checkOut) {
        const rangeMatch = preprocessed.match(/(\d{1,2}\s+\w{3,9})\s*[-–—to]+\s*(\d{1,2}\s+\w{3,9}),?\s+(\d{4})/i);
        if (rangeMatch) {
            if (!extracted.checkIn) extracted.checkIn = rangeMatch[1] + ' ' + rangeMatch[3];
            if (!extracted.checkOut) extracted.checkOut = rangeMatch[2] + ' ' + rangeMatch[3];
        }
    }

    if (!extracted.checkIn) return null;
    return extracted;
}

/**
 * Parse booking details from email body — OTA dispatcher
 */
function parseBookingEmail(emailBody, sender, subject = '', properties = [], dateHeader = '') {
    // Skip cancellation/refund emails
    const subjectLower = subject.toLowerCase();
    const bodyStart = emailBody.substring(0, 500).toLowerCase();
    if (subjectLower.match(/\b(cancell?ed|cancellation|refunded?)\b/) ||
        bodyStart.match(/\b(your (?:booking|reservation) (?:has been |was )?cancell?ed)\b/)) {
        console.log('[Gmail] Skipping cancellation email:', subject);
        return null;
    }

    const senderLower = sender.toLowerCase();
    const emailYear = getEmailYear(dateHeader);

    // Detect OTA source and call specific parser
    let extracted = null;

    if (senderLower.includes('airbnb')) {
        extracted = parseAirbnbEmail(emailBody, subject, emailYear);
    } else if (senderLower.includes('go-mmt') || senderLower.includes('makemytrip') || senderLower.includes('goibibo')) {
        extracted = parseGoibiboMmtEmail(emailBody, subject, sender);
    } else if (senderLower.includes('agoda')) {
        extracted = parseAgodaEmail(emailBody, subject);
    } else if (senderLower.includes('booking.com')) {
        extracted = parseGenericBookingEmail(emailBody, subject);
        if (extracted) extracted.bookingSource = 'BOOKING.COM';
    } else if (senderLower.includes('vrbo') || senderLower.includes('homeaway')) {
        extracted = parseGenericBookingEmail(emailBody, subject);
        if (extracted) extracted.bookingSource = 'VRBO';
    } else if (senderLower.includes('expedia')) {
        extracted = parseGenericBookingEmail(emailBody, subject);
        if (extracted) extracted.bookingSource = 'EXPEDIA';
    } else {
        extracted = parseGenericBookingEmail(emailBody, subject);
    }

    if (!extracted || !extracted.checkIn) {
        console.log('[Gmail] Could not extract check-in date from email.');
        console.log('[Gmail] Subject:', subject);
        console.log('[Gmail] Sender:', sender);
        console.log('[Gmail] Full body:', emailBody);
        return null;
    }

    const bookingSource = extracted.bookingSource || 'OTHER';

    // Auto-generate booking_id if not extracted
    const bookingId = extracted.bookingId
        ? extracted.bookingId.substring(0, 50)
        : `GMAIL-${bookingSource}-${extracted.checkIn.replace(/\D/g, '')}`.substring(0, 50);
    const guestName = (extracted.guestName || 'Guest').substring(0, 50);

    // Parse dates
    const checkIn = parseFlexibleDate(extracted.checkIn, emailYear);
    const checkOut = extracted.checkOut ? parseFlexibleDate(extracted.checkOut, emailYear) : null;

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

    // Property Auto-Detection: partial/fuzzy match property name from email content
    // Use property hint from subject (Goibibo/MMT) if available
    const hintText = extracted.propertyNameHint ? extracted.propertyNameHint + ' ' : '';
    const searchText = (hintText + subject + ' ' + emailBody).toLowerCase();

    let matchedProperty = null;
    let bestScore = 0;
    for (const property of properties) {
        const propNameLower = property.name.toLowerCase();
        const locationLower = (property.location || '').toLowerCase();
        let score = 0;

        if (searchText.includes(propNameLower)) {
            score = 100;
        } else {
            const words = propNameLower.split(/[\s\-_,|]+/).filter(w => w.length >= 3);
            for (const word of words) {
                if (searchText.includes(word)) {
                    score += word.length;
                }
            }
        }

        if (locationLower && locationLower.length >= 3 && searchText.includes(locationLower)) {
            score += 20;
        } else if (locationLower) {
            const locWords = locationLower.split(/[\s,]+/).filter(w => w.length >= 3);
            for (const word of locWords) {
                if (searchText.includes(word)) {
                    score += 5;
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            matchedProperty = property;
        }
    }

    if (bestScore < 3) {
        matchedProperty = null;
        console.log('[Gmail] No property match found in email content.');
    }

    const propertyId = matchedProperty ? matchedProperty.id : null;
    const propertyName = matchedProperty ? matchedProperty.name.substring(0, 50) : null;

    // Parse financial amounts
    const parseAmount = (val) => val ? parseFloat(String(val).replace(/,/g, '')) : null;

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
        total_amount: parseAmount(extracted.total),
        property_id: propertyId,
        property_name: propertyName,
        guest_phone: extracted.guestPhone ? extracted.guestPhone.replace(/\s/g, '') : '',
        guest_email: extracted.guestEmail || '',
        guest_city: '',
        adults: parseInt(extracted.guests) || null,
        kids: null,
        number_of_rooms: parseInt(extracted.rooms) || null,
        stay_amount: null,
        extra_guest_charges: null,
        meals_chef: null,
        bonfire_other: null,
        ota_service_fee: parseAmount(extracted.commission),
        taxes: null,
        total_amount_pre_tax: null,
        total_amount_inc_tax: null,
        damages: null,
        hostizzy_revenue: null,
        host_payout: parseAmount(extracted.hostPayout),
        payout_eligible: parseAmount(extracted.hostPayout),
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
function parseFlexibleDate(dateStr, emailYear) {
    if (!dateStr) return null;
    try {
        dateStr = dateStr.trim();
        const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
            january:0, february:1, march:2, april:3, june:5, july:6, august:7, september:8, october:9, november:10, december:11 };
        const pad = n => String(n).padStart(2, '0');
        let m;

        // ISO format: 2026-04-15
        if ((m = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) {
            return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
        }

        // DD/MM/YYYY or DD-MM-YYYY (Indian/European format — day first)
        if ((m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/))) {
            const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3]);
            return `${year}-${pad(month)}-${pad(day)}`;
        }

        // DD/MM/YY (2-digit year)
        if ((m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/))) {
            const day = parseInt(m[1]), month = parseInt(m[2]), year = 2000 + parseInt(m[3]);
            return `${year}-${pad(month)}-${pad(day)}`;
        }

        // "29 Mar '26" or "29 Mar 26" — abbreviated year (Goibibo/MMT format)
        if ((m = dateStr.match(/(\d{1,2})\s+(\w{3,9})\s+'?(\d{2})$/))) {
            const mon = months[m[2].toLowerCase()];
            if (mon !== undefined) return `20${m[3]}-${pad(mon + 1)}-${pad(m[1])}`;
        }

        // "15 Apr 2026" or "15 April 2026"
        if ((m = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/))) {
            const mon = months[m[2].toLowerCase()];
            if (mon !== undefined) return `${m[3]}-${pad(mon + 1)}-${pad(m[1])}`;
        }

        // "Apr 15, 2026" or "April 15 2026"
        if ((m = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/))) {
            const mon = months[m[1].toLowerCase()];
            if (mon !== undefined) return `${m[3]}-${pad(mon + 1)}-${pad(m[2])}`;
        }

        // "26 Apr" or "26 April" — no year (Airbnb format), infer from email date or current year
        if ((m = dateStr.match(/^(\d{1,2})\s+(\w{3,9})$/))) {
            const mon = months[m[2].toLowerCase()];
            if (mon !== undefined) {
                const year = emailYear || new Date().getFullYear();
                return `${year}-${pad(mon + 1)}-${pad(m[1])}`;
            }
        }

        // "February 28, 2026" or "March 1, 2026" (Agoda full month name)
        if ((m = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/))) {
            const mon = months[m[1].toLowerCase()];
            if (mon !== undefined) return `${m[3]}-${pad(mon + 1)}-${pad(m[2])}`;
        }

        // Fallback: let JS parse it
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
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

// ================================================================
// OTA IMPORT REVIEW — Scan, review, and selectively import bookings
// ================================================================

async function loadImportReview() {
    // Populate property filter dropdown
    try {
        const { data: properties } = await supabase
            .from('properties')
            .select('id, name')
            .eq('is_active', true)
            .order('name');
        const select = document.getElementById('importPropertyFilter');
        if (select && properties) {
            select.innerHTML = '<option value="">All Properties</option>' +
                properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
    } catch (e) {
        console.error('[OTA Import] Failed to load properties:', e);
    }
    renderImportReview();
}

/**
 * Scan Gmail and populate the review table (no auto-import)
 */
window.scanGmailForReview = async function() {
    if (!gmailConnectionStatus.connected) {
        showToast('Connect Gmail first in Settings → Communication', 'error');
        return;
    }

    const scanBtn = document.getElementById('importScanBtn');
    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<i data-lucide="loader" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Scanning...';
    }

    try {
        // Get selected property filter
        const filterPropertyId = document.getElementById('importPropertyFilter')?.value || '';
        showToast(filterPropertyId ? 'Scanning Gmail for selected property...' : 'Scanning Gmail for OTA booking emails...', 'info');

        // Read scan period from dropdown (defaults to 6 months)
        const scanPeriodEl = document.getElementById('importScanPeriod');
        const monthsBack = scanPeriodEl ? (scanPeriodEl.value === '' ? 0 : parseInt(scanPeriodEl.value) || 6) : 6;
        const searchQueries = buildOtaSearchQueries(monthsBack);

        const processedIds = new Set();
        pendingImportItems = [];

        // Fetch properties for auto-detection
        const { data: properties } = await supabase
            .from('properties')
            .select('id, name, location')
            .eq('is_active', true);
        importProperties = properties || [];

        // Fetch existing reservations for duplicate detection
        const { data: existingRes } = await supabase
            .from('reservations')
            .select('booking_id, property_id, check_in, check_out');

        const existingBookingIds = new Set((existingRes || []).map(r => r.booking_id));
        // Property-scoped date keys: "propertyId_checkIn" and "propertyId_checkOut"
        const existingPropCheckIns = new Set((existingRes || []).map(r => `${r.property_id}_${r.check_in}`));
        const existingPropCheckOuts = new Set((existingRes || []).map(r => `${r.property_id}_${r.check_out}`));
        // Global date sets as fallback when property not matched
        const existingCheckIns = new Set((existingRes || []).map(r => r.check_in));
        const existingCheckOuts = new Set((existingRes || []).map(r => r.check_out));

        for (const query of searchQueries) {
            const messages = await searchGmailMessages(query);
            if (!messages || messages.length === 0) continue;

            for (const message of messages.slice(0, 100)) {
                if (processedIds.has(message.id)) continue;
                processedIds.add(message.id);

                try {
                    const fullMsg = await callGmailProxy('getMessage', { messageId: message.id });
                    const emailBody = extractEmailBody(fullMsg);
                    const headers = fullMsg.payload.headers;
                    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
                    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
                    const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

                    const bookingData = parseBookingEmail(emailBody, from, subject, properties || [], dateHeader);
                    if (!bookingData) continue;

                    // If property filter is set, skip emails that don't match
                    if (filterPropertyId) {
                        if (bookingData.property_id && bookingData.property_id !== filterPropertyId) continue;
                        // If no property detected, assign the filtered property
                        if (!bookingData.property_id) {
                            const filteredProp = (properties || []).find(p => p.id === filterPropertyId);
                            if (filteredProp) {
                                bookingData.property_id = filteredProp.id;
                                bookingData.property_name = filteredProp.name;
                            }
                        }
                    }

                    // Check duplicates: booking_id OR (property-scoped check_in AND check_out)
                    const isDuplicateById = existingBookingIds.has(bookingData.booking_id);

                    let isDuplicateByCheckIn = false;
                    let isDuplicateByCheckOut = false;

                    if (bookingData.property_id) {
                        // Property-scoped check
                        isDuplicateByCheckIn = bookingData.check_in && existingPropCheckIns.has(`${bookingData.property_id}_${bookingData.check_in}`);
                        isDuplicateByCheckOut = bookingData.check_out && existingPropCheckOuts.has(`${bookingData.property_id}_${bookingData.check_out}`);
                    } else {
                        // No property matched — fall back to global date check
                        isDuplicateByCheckIn = bookingData.check_in && existingCheckIns.has(bookingData.check_in);
                        isDuplicateByCheckOut = bookingData.check_out && existingCheckOuts.has(bookingData.check_out);
                    }
                    // Both check-in AND check-out must match to be a date duplicate
                    // Using AND prevents back-to-back reservations from being falsely flagged
                    const isDuplicateByDate = isDuplicateByCheckIn && isDuplicateByCheckOut;

                    let duplicateReason = '';
                    if (isDuplicateById) duplicateReason = 'Booking ID exists';
                    else if (isDuplicateByDate) duplicateReason = 'Check-in & check-out match';

                    const isDuplicate = isDuplicateById || isDuplicateByDate;

                    pendingImportItems.push({
                        messageId: message.id,
                        emailDate: dateHeader,
                        emailFrom: from,
                        emailSubject: subject,
                        bookingData: bookingData,
                        isDuplicate: isDuplicate,
                        duplicateReason: duplicateReason,
                        selected: !isDuplicate, // Pre-select non-duplicates
                    });
                } catch (e) {
                    console.error('[OTA Import] Error processing message:', e);
                }
            }
        }

        showToast(`Found ${pendingImportItems.length} booking emails. Review and import below.`, 'success');
        renderImportReview();

    } catch (error) {
        console.error('Error scanning for review:', error);
        showToast('Scan failed: ' + error.message, 'error');
    } finally {
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '<i data-lucide="search" style="width: 14px; height: 14px;"></i> Scan Gmail';
            lucide.createIcons();
        }
    }
};

/**
 * Render the import review table
 */
function renderImportReview() {
    const container = document.getElementById('importReviewContent');
    if (!container) return;

    if (pendingImportItems.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px;"><i data-lucide="inbox" style="width: 48px; height: 48px; opacity: 0.3;"></i></div>
                <h3 style="margin: 0 0 8px 0;">No pending imports</h3>
                <p style="margin: 0 0 16px 0;">Click "Scan Gmail" to search for OTA booking confirmation emails.</p>
            </div>`;
        updateImportSelectedBtn();
        lucide.createIcons();
        return;
    }

    const newCount = pendingImportItems.filter(i => !i.isDuplicate).length;
    const dupCount = pendingImportItems.filter(i => i.isDuplicate).length;

    let html = `
        <div class="card" style="margin-bottom: 16px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
                <strong>${pendingImportItems.length}</strong> emails found
                ${newCount > 0 ? `&nbsp;·&nbsp; <span style="color: var(--success);"><strong>${newCount}</strong> new</span>` : ''}
                ${dupCount > 0 ? `&nbsp;·&nbsp; <span style="color: var(--text-secondary);"><strong>${dupCount}</strong> duplicates</span>` : ''}
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm" onclick="toggleAllImportItems(true)" style="font-size: 12px;">Select All New</button>
                <button class="btn btn-sm" onclick="toggleAllImportItems(false)" style="font-size: 12px;">Deselect All</button>
                <button class="btn btn-sm" onclick="pendingImportItems = []; renderImportReview();" style="font-size: 12px; color: var(--danger);">Clear</button>
            </div>
        </div>
    `;

    html += '<div class="card"><div class="table-container"><table class="data-table"><thead><tr>';
    html += '<th style="width:40px;"><input type="checkbox" onchange="toggleAllImportItems(this.checked)" id="importSelectAll"></th>';
    html += '<th>Source</th><th>Guest</th><th>Property</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Amount</th><th>Status</th>';
    html += '</tr></thead><tbody>';

    pendingImportItems.forEach((item, idx) => {
        const d = item.bookingData;
        const rowBg = item.isDuplicate ? 'background: rgba(239, 68, 68, 0.05);' : '';
        const sourceColor = getSourceColor(d.booking_source);

        html += `<tr style="${rowBg}">`;
        html += `<td><input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleImportItem(${idx}, this.checked)"></td>`;
        html += `<td><span style="display:inline-block;padding:2px 8px;background:${sourceColor}15;color:${sourceColor};border-radius:4px;font-size:11px;font-weight:600;">${d.booking_source}</span></td>`;
        html += `<td><strong>${d.guest_name}</strong><div style="font-size:11px;color:var(--text-secondary);">${item.emailSubject.substring(0, 40)}${item.emailSubject.length > 40 ? '...' : ''}</div></td>`;
        if (d.property_id) {
            html += `<td>${d.property_name}</td>`;
        } else {
            html += `<td><select onchange="assignImportProperty(${idx}, this.value)" style="font-size:12px; padding:3px 6px; border:1px solid var(--border); border-radius:4px; background:var(--background); color:var(--text-primary);">`;
            html += `<option value="">-- Assign --</option>`;
            for (const p of importProperties) {
                html += `<option value="${p.id}">${p.name}</option>`;
            }
            html += `</select></td>`;
        }
        html += `<td>${d.check_in || '-'}</td>`;
        html += `<td>${d.check_out || '-'}</td>`;
        html += `<td>${d.nights || '-'}</td>`;
        html += `<td>${d.total_amount ? '₹' + Math.round(d.total_amount).toLocaleString('en-IN') : '-'}</td>`;
        html += `<td>`;
        if (item.isDuplicate) {
            html += `<span style="color:var(--text-secondary);font-size:12px;">${item.duplicateReason}</span>`;
        } else {
            html += `<span style="color:var(--success);font-size:12px;font-weight:600;">New</span>`;
        }
        html += `</td>`;
        html += `</tr>`;
    });

    html += '</tbody></table></div></div>';

    container.innerHTML = html;
    updateImportSelectedBtn();
    lucide.createIcons();
}

function getSourceColor(source) {
    const colors = {
        'AIRBNB': '#FF5A5F',
        'BOOKING.COM': '#003580',
        'AGODA': '#5c2d91',
        'MAKEMYTRIP': '#eb2026',
        'GOIBIBO': '#ec5b24',
        'VRBO': '#3b5cad',
        'EXPEDIA': '#00355f',
        'CLEARTRIP': '#e74c3c',
        'OYO': '#ee2e24',
        // Legacy combined source names (backwards compat)
        'AGODA/BOOKING.COM': '#003580',
        'MMT/GOIBIBO': '#eb2026',
    };
    return colors[source] || '#6b7280';
}

window.toggleImportItem = function(idx, checked) {
    if (pendingImportItems[idx]) {
        pendingImportItems[idx].selected = checked;
    }
    updateImportSelectedBtn();
};

window.toggleAllImportItems = function(selectNew) {
    pendingImportItems.forEach(item => {
        item.selected = selectNew ? !item.isDuplicate : false;
    });
    renderImportReview();
};

window.assignImportProperty = function(idx, propertyId) {
    if (!pendingImportItems[idx]) return;
    if (propertyId) {
        const prop = importProperties.find(p => p.id === propertyId);
        pendingImportItems[idx].bookingData.property_id = propertyId;
        pendingImportItems[idx].bookingData.property_name = prop ? prop.name : '';
    } else {
        pendingImportItems[idx].bookingData.property_id = null;
        pendingImportItems[idx].bookingData.property_name = null;
    }
};

function updateImportSelectedBtn() {
    const count = pendingImportItems.filter(i => i.selected).length;
    const btn = document.getElementById('importSelectedBtn');
    const countSpan = document.getElementById('importSelectedCount');
    if (btn) {
        btn.style.display = count > 0 ? 'flex' : 'none';
    }
    if (countSpan) countSpan.textContent = count;
}

/**
 * Import selected bookings as reservations
 */
window.importSelectedBookings = async function() {
    const selected = pendingImportItems.filter(i => i.selected);
    if (selected.length === 0) {
        showToast('No bookings selected for import.', 'info');
        return;
    }

    if (!confirm(`Import ${selected.length} booking(s) as reservations?`)) return;

    const btn = document.getElementById('importSelectedBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Importing...';
    }

    let created = 0;
    let failed = 0;

    for (const item of selected) {
        try {
            const { error } = await supabase
                .from('reservations')
                .insert([item.bookingData]);

            if (error) {
                console.error('[OTA Import] Insert error:', error);
                failed++;
            } else {
                created++;
                // Remove from pending list
                const idx = pendingImportItems.indexOf(item);
                if (idx > -1) pendingImportItems.splice(idx, 1);
            }
        } catch (e) {
            console.error('[OTA Import] Error:', e);
            failed++;
        }
    }

    showToast(`Imported ${created} reservation(s)${failed > 0 ? `, ${failed} failed` : ''}`, created > 0 ? 'success' : 'error');

    if (created > 0) {
        await loadReservations();
        await loadDashboard();
    }

    renderImportReview();

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Import Selected (<span id="importSelectedCount">0</span>)';
        lucide.createIcons();
    }
};

// Initialize Performance View
