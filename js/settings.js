// ResIQ Settings — App settings, email settings, WhatsApp config, data import/export

function switchSettingsTab(tabName, btnEl) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        // Fallback: find the button by data-tab attribute
        const btn = document.querySelector(`.settings-tab[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');
    }

    // Update panels
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    const panel = document.getElementById(`settings-${tabName}`);
    if (panel) {
        panel.classList.add('active');
    }

    // Re-render icons in the newly visible panel
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function loadSettings() {
    try {
        // General / Preferences
        const businessName = localStorage.getItem('businessName');
        const currency = localStorage.getItem('currency') || 'INR';
        const timezone = localStorage.getItem('timezone') || 'Asia/Kolkata';
        const dateFormat = localStorage.getItem('dateFormat') || 'DD/MM/YYYY';

        if (businessName) document.getElementById('businessName').value = businessName;
        if (currency) document.getElementById('currencySelect').value = currency;
        if (timezone) document.getElementById('timezoneSelect').value = timezone;
        if (dateFormat) document.getElementById('dateFormatSelect').value = dateFormat;

        // Business info
        const fields = ['businessEmail', 'businessPhone', 'businessAddress', 'businessGST', 'businessWebsite'];
        fields.forEach(field => {
            const val = localStorage.getItem(field);
            const el = document.getElementById(field);
            if (val && el) el.value = val;
        });

        // Notification toggles
        document.getElementById('emailNotifications').checked = localStorage.getItem('emailNotifications') !== 'false';
        document.getElementById('whatsappNotifications').checked = localStorage.getItem('whatsappNotifications') !== 'false';
        document.getElementById('paymentReminders').checked = localStorage.getItem('paymentReminders') !== 'false';
        document.getElementById('bookingConfirmations').checked = localStorage.getItem('bookingConfirmations') !== 'false';
        document.getElementById('dailySummary').checked = localStorage.getItem('dailySummary') === 'true';

        // Dark mode
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.getElementById('darkModeToggle').checked = currentTheme === 'dark';

        // Automation
        document.getElementById('smartAutomationEnabled').checked = localStorage.getItem('smartAutomationEnabled') !== 'false';
        document.getElementById('automationInterval').value = localStorage.getItem('automationInterval') || '30';

        // Email settings
        if (typeof loadEmailSettings === 'function') loadEmailSettings();

        // WhatsApp settings
        loadWhatsAppSettings();

        // Update Gmail send integration status
        updateGmailSendStatus();

        // Update Gmail integration badge (uses cached status from server)
        const gmailBadge = document.getElementById('gmailIntegrationBadge');
        if (gmailBadge) {
            const gmailConnected = gmailConnectionStatus && gmailConnectionStatus.connected;
            gmailBadge.style.background = gmailConnected ? 'var(--success)' : 'var(--warning)';
            gmailBadge.textContent = gmailConnected ? 'Connected' : 'Not Connected';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function toggleThemeFromSettings() {
    const isDark = document.getElementById('darkModeToggle').checked;
    const newTheme = isDark ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

function toggleSmartAutomation() {
    const isEnabled = document.getElementById('smartAutomationEnabled').checked;
    if (isEnabled) {
        startSmartAutomation();
        showToast('Automation Enabled', 'Smart Automation is now running', '');
    } else {
        stopSmartAutomation();
        showToast('Automation Disabled', 'Smart Automation has been stopped', '');
    }
    localStorage.setItem('smartAutomationEnabled', isEnabled);
}

function saveAutomationSettings() {
    try {
        const automationInterval = document.getElementById('automationInterval').value;
        localStorage.setItem('automationInterval', automationInterval);

        if (document.getElementById('smartAutomationEnabled').checked) {
            stopSmartAutomation();
            startSmartAutomation();
        }

        showToast('Settings Saved', 'Automation settings updated', '');
    } catch (error) {
        showToast('Error', 'Failed to save automation settings', '');
    }
}

function saveGeneralSettings() {
    try {
        localStorage.setItem('businessName', document.getElementById('businessName').value);
        localStorage.setItem('currency', document.getElementById('currencySelect').value);
        localStorage.setItem('timezone', document.getElementById('timezoneSelect').value);
        localStorage.setItem('dateFormat', document.getElementById('dateFormatSelect').value);

        showToast('Settings Saved', 'Preferences saved successfully', '');
    } catch (error) {
        showToast('Error', 'Failed to save settings', '');
    }
}

function saveBusinessProfile() {
    try {
        localStorage.setItem('businessName', document.getElementById('businessName').value);
        localStorage.setItem('businessEmail', document.getElementById('businessEmail').value);
        localStorage.setItem('businessPhone', document.getElementById('businessPhone').value);
        localStorage.setItem('businessAddress', document.getElementById('businessAddress').value);
        localStorage.setItem('businessGST', document.getElementById('businessGST').value);
        localStorage.setItem('businessWebsite', document.getElementById('businessWebsite').value);

        showToast('Settings Saved', 'Business profile saved successfully', '');
    } catch (error) {
        showToast('Error', 'Failed to save business profile', '');
    }
}

// Keep legacy function for backward compatibility
function saveBusinessSettings() {
    saveBusinessProfile();
}

function saveNotificationSettings() {
    try {
        localStorage.setItem('emailNotifications', document.getElementById('emailNotifications').checked);
        localStorage.setItem('whatsappNotifications', document.getElementById('whatsappNotifications').checked);
        localStorage.setItem('paymentReminders', document.getElementById('paymentReminders').checked);
        localStorage.setItem('bookingConfirmations', document.getElementById('bookingConfirmations').checked);
        localStorage.setItem('dailySummary', document.getElementById('dailySummary').checked);
    } catch (error) {
        console.error('Failed to save notification settings:', error);
    }
}

// Auto-save when any toggle is flipped
function autoSaveNotificationToggle() {
    try {
        // Save notification toggles
        saveNotificationSettings();

        // Save email template toggles
        const templates = {
            bookingConfirm: document.getElementById('emailTemplateBookingConfirm')?.checked ?? true,
            paymentReceipt: document.getElementById('emailTemplatePaymentReceipt')?.checked ?? true,
            checkinInstructions: document.getElementById('emailTemplateCheckinInstructions')?.checked ?? true,
            paymentReminder: document.getElementById('emailTemplatePaymentReminder')?.checked ?? false,
            thankYou: document.getElementById('emailTemplateThankYou')?.checked ?? false
        };
        localStorage.setItem('emailTemplateSettings', JSON.stringify(templates));

        showToast('Saved', 'Preference updated', '');
    } catch (error) {
        console.error('Failed to auto-save toggle:', error);
    }
}

function saveEmailSettings() {
    try {
        const settings = {
            senderAddress: document.getElementById('emailSenderAddress')?.value || '',
            senderName: document.getElementById('emailSenderName')?.value || '',
            replyTo: document.getElementById('emailReplyTo')?.value || '',
            cc: document.getElementById('emailCC')?.value || ''
        };
        localStorage.setItem('emailSettings', JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save email settings:', error);
    }
}

function saveEmailTemplateSettings() {
    try {
        const templates = {
            bookingConfirm: document.getElementById('emailTemplateBookingConfirm')?.checked ?? true,
            paymentReceipt: document.getElementById('emailTemplatePaymentReceipt')?.checked ?? true,
            checkinInstructions: document.getElementById('emailTemplateCheckinInstructions')?.checked ?? true,
            paymentReminder: document.getElementById('emailTemplatePaymentReminder')?.checked ?? false,
            thankYou: document.getElementById('emailTemplateThankYou')?.checked ?? false
        };
        localStorage.setItem('emailTemplateSettings', JSON.stringify(templates));
    } catch (error) {
        console.error('Failed to save template settings:', error);
    }
}

function saveEmailSignature() {
    try {
        const signature = document.getElementById('emailSignature')?.value || '';
        localStorage.setItem('emailSignature', signature);
    } catch (error) {
        console.error('Failed to save signature:', error);
    }
}

// Unified save: email config + signature + templates
function saveAllEmailSettings() {
    try {
        saveEmailSettings();
        saveEmailSignature();
        saveEmailTemplateSettings();
        showToast('Settings Saved', 'Email settings saved successfully', '');
    } catch (error) {
        showToast('Error', 'Failed to save email settings', '');
    }
}

function loadEmailSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem('emailSettings') || '{}');
        if (settings.senderAddress) document.getElementById('emailSenderAddress').value = settings.senderAddress;
        if (settings.senderName) document.getElementById('emailSenderName').value = settings.senderName;
        if (settings.replyTo) document.getElementById('emailReplyTo').value = settings.replyTo;
        if (settings.cc) document.getElementById('emailCC').value = settings.cc;

        const templates = JSON.parse(localStorage.getItem('emailTemplateSettings') || '{}');
        if (templates.bookingConfirm !== undefined) document.getElementById('emailTemplateBookingConfirm').checked = templates.bookingConfirm;
        if (templates.paymentReceipt !== undefined) document.getElementById('emailTemplatePaymentReceipt').checked = templates.paymentReceipt;
        if (templates.checkinInstructions !== undefined) document.getElementById('emailTemplateCheckinInstructions').checked = templates.checkinInstructions;
        if (templates.paymentReminder !== undefined) document.getElementById('emailTemplatePaymentReminder').checked = templates.paymentReminder;
        if (templates.thankYou !== undefined) document.getElementById('emailTemplateThankYou').checked = templates.thankYou;

        const signature = localStorage.getItem('emailSignature');
        if (signature) document.getElementById('emailSignature').value = signature;
    } catch (e) { /* ignore */ }
}

// WhatsApp Settings
function loadWhatsAppSettings() {
    try {
        const countryCode = localStorage.getItem('whatsappCountryCode') || '91';
        const businessName = localStorage.getItem('whatsappBusinessName') || '';
        const upiId = localStorage.getItem('whatsappUpiId') || '';

        const ccEl = document.getElementById('whatsappCountryCode');
        const bnEl = document.getElementById('whatsappBusinessName');
        const upiEl = document.getElementById('whatsappUpiId');

        if (ccEl) ccEl.value = countryCode;
        if (bnEl) bnEl.value = businessName;
        if (upiEl) upiEl.value = upiId;

        // Load WABA mode
        const waMode = localStorage.getItem('whatsappMode') || 'links';
        toggleWhatsAppMode(waMode);

        // Load WABA settings
        const replyNum = localStorage.getItem('wabaReplyNumber') || '+919560494001';
        const ctaLabel = localStorage.getItem('wabaCtaLabel') || 'Chat with Property';
        const footerText = localStorage.getItem('wabaFooterText') || 'Hostizzy — Holiday Homes';

        const replyEl = document.getElementById('wabaReplyNumber');
        const ctaEl = document.getElementById('wabaCtaLabel');
        const footerEl = document.getElementById('wabaFooterText');

        if (replyEl) replyEl.value = replyNum;
        if (ctaEl) ctaEl.value = ctaLabel;
        if (footerEl) footerEl.value = footerText;

        // Load property reply numbers
        loadWABAPropertyNumbers();

        // Check WABA connection status
        if (waMode === 'api') checkWABAStatus();
    } catch (e) { /* ignore */ }
}

function saveWhatsAppSettings() {
    try {
        const countryCode = document.getElementById('whatsappCountryCode')?.value || '91';
        const businessName = document.getElementById('whatsappBusinessName')?.value || '';
        const upiId = document.getElementById('whatsappUpiId')?.value || '';

        localStorage.setItem('whatsappCountryCode', countryCode);
        localStorage.setItem('whatsappBusinessName', businessName);
        localStorage.setItem('whatsappUpiId', upiId);

        // Save WABA settings
        const replyNum = document.getElementById('wabaReplyNumber')?.value || '+919560494001';
        const ctaLabel = document.getElementById('wabaCtaLabel')?.value || 'Chat with Property';
        const footerText = document.getElementById('wabaFooterText')?.value || 'Hostizzy — Holiday Homes';

        localStorage.setItem('wabaReplyNumber', replyNum);
        localStorage.setItem('wabaCtaLabel', ctaLabel);
        localStorage.setItem('wabaFooterText', footerText);

        // Save property-specific reply numbers
        saveWABAPropertyNumbers();

        showToast('Settings Saved', 'WhatsApp settings saved successfully', '');
    } catch (error) {
        showToast('Error', 'Failed to save WhatsApp settings', '');
    }
}

// Toggle between wa.me links and Business API mode
window.toggleWhatsAppMode = function(mode) {
    localStorage.setItem('whatsappMode', mode);

    const linksBtn = document.getElementById('waModeLinks');
    const apiBtn = document.getElementById('waModeApi');
    const linksInfo = document.getElementById('waLinksInfo');
    const apiConfig = document.getElementById('waApiConfig');
    const badge = document.getElementById('whatsappStatusBadge');

    if (mode === 'api') {
        if (linksBtn) { linksBtn.style.background = 'transparent'; linksBtn.style.color = 'var(--text-secondary)'; linksBtn.style.borderColor = 'var(--border)'; }
        if (apiBtn) { apiBtn.style.background = '#0ea5e9'; apiBtn.style.color = 'white'; apiBtn.style.borderColor = '#0ea5e9'; }
        if (linksInfo) linksInfo.style.display = 'none';
        if (apiConfig) apiConfig.style.display = 'block';
        if (badge) { badge.textContent = 'Business API'; badge.style.background = '#0ea5e9'; }
        checkWABAStatus();
    } else {
        if (linksBtn) { linksBtn.style.background = '#25D366'; linksBtn.style.color = 'white'; linksBtn.style.borderColor = '#25D366'; }
        if (apiBtn) { apiBtn.style.background = 'transparent'; apiBtn.style.color = 'var(--text-secondary)'; apiBtn.style.borderColor = 'var(--border)'; }
        if (linksInfo) linksInfo.style.display = 'block';
        if (apiConfig) apiConfig.style.display = 'none';
        if (badge) { badge.textContent = 'Ready'; badge.style.background = 'var(--success)'; }
    }
};

// Check WABA connection status from server
async function checkWABAStatus() {
    const statusEl = document.getElementById('waApiStatus');
    if (!statusEl) return;

    try {
        const firebaseUser = firebase.auth().currentUser;
        const token = firebaseUser ? await firebaseUser.getIdToken() : null;
        if (!token) {
            statusEl.innerHTML = '⚠️ Please sign in to check WABA status';
            statusEl.style.background = 'rgba(255,200,100,0.15)';
            return;
        }

        const res = await fetch('/api/whatsapp-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'status' })
        });

        const json = await res.json();
        if (json.data?.connected) {
            statusEl.innerHTML = '✅ WhatsApp Business API connected — Phone ID: ' + (json.data.phoneId || 'configured');
            statusEl.style.background = 'rgba(37, 211, 102, 0.1)';
            statusEl.style.borderColor = 'rgba(37, 211, 102, 0.3)';
        } else {
            statusEl.innerHTML = '⚠️ WABA not configured — Set <code>WHATSAPP_ACCESS_TOKEN</code> and <code>WHATSAPP_PHONE_ID</code> in Vercel environment variables';
            statusEl.style.background = 'rgba(255,200,100,0.15)';
            statusEl.style.borderColor = 'rgba(255,200,100,0.3)';
        }
    } catch (e) {
        statusEl.innerHTML = '❌ Could not check WABA status: ' + e.message;
        statusEl.style.background = 'rgba(239,68,68,0.1)';
    }
}

// Load properties and render per-property reply number fields
async function loadWABAPropertyNumbers() {
    const container = document.getElementById('wabaPropertyNumbers');
    if (!container) return;

    try {
        const properties = (typeof db !== 'undefined' && db.getProperties)
            ? await db.getProperties()
            : (state?.properties || []);

        if (!properties || properties.length === 0) {
            container.innerHTML = '<div style="color: var(--text-tertiary); font-size: 12px; font-style: italic;">No properties found. Add properties first.</div>';
            return;
        }

        const savedNumbers = JSON.parse(localStorage.getItem('wabaPropertyReplyNumbers') || '{}');

        container.innerHTML = properties.map(p => `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 13px; font-weight: 500; min-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${p.name}</span>
                <input type="text" class="waba-property-phone" data-property-id="${p.id}"
                    value="${savedNumbers[p.id] || ''}"
                    placeholder="+919560494001 (central)"
                    style="flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 13px;">
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<div style="color: var(--danger); font-size: 12px;">Error loading properties</div>';
    }
}

// Save property-specific reply numbers
function saveWABAPropertyNumbers() {
    const inputs = document.querySelectorAll('.waba-property-phone');
    const numbers = {};
    inputs.forEach(input => {
        const propId = input.dataset.propertyId;
        const value = input.value.trim();
        if (propId && value) {
            numbers[propId] = value;
        }
    });
    localStorage.setItem('wabaPropertyReplyNumbers', JSON.stringify(numbers));
}

// Get the reply number for a specific property (used by messaging functions)
window.getWABAReplyNumber = function(propertyId) {
    const propertyNumbers = JSON.parse(localStorage.getItem('wabaPropertyReplyNumbers') || '{}');
    return propertyNumbers[propertyId] || localStorage.getItem('wabaReplyNumber') || '+919560494001';
};

// Check if WABA mode is active
window.isWABAMode = function() {
    return localStorage.getItem('whatsappMode') === 'api';
};


function exportAllData() {
    try {
        const data = {
            reservations: allReservations.length > 0 ? allReservations : (state.reservations || []),
            guests: allGuests || [],
            properties: state.properties || [],
            payments: allPayments || [],
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `resiq-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
        showToast('Export Complete', 'Data exported successfully', '');
    } catch (error) {
        showToast('Error', 'Failed to export data', '');
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            const text = await file.text();
            const data = JSON.parse(text);

            if (confirm('This will replace all existing data. Continue?')) {
                if (data.reservations) localStorage.setItem('reservations', JSON.stringify(data.reservations));
                if (data.guests) localStorage.setItem('guests', JSON.stringify(data.guests));
                if (data.properties) localStorage.setItem('properties', JSON.stringify(data.properties));
                if (data.payments) localStorage.setItem('payments', JSON.stringify(data.payments));
                if (data.meals) localStorage.setItem('meals', JSON.stringify(data.meals));

                showToast('Import Complete', 'Data imported successfully. Refreshing...', '');
                setTimeout(() => location.reload(), 2000);
            }
        } catch (error) {
            showToast('Error', 'Failed to import data', '');
        }
    };
    input.click();
}

function clearAllData() {
    if (confirm('Are you ABSOLUTELY sure? This will delete ALL your data permanently!')) {
        if (confirm('Final confirmation: Delete everything?')) {
            localStorage.clear();
            showToast('Data Cleared', 'All data has been cleared. Refreshing...', '');
            setTimeout(() => location.reload(), 2000);
        }
    }
}

// Communication Functions
let communicationMessages = [];
let currentCommunicationFilter = 'all';
