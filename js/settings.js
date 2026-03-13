// ResIQ Settings — App settings, email settings, data import/export

function switchSettingsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update panels
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`settings-${tabName}`).classList.add('active');
}

function loadSettings() {
    // Load saved settings from localStorage
    try {
        const businessName = localStorage.getItem('businessName');
        const currency = localStorage.getItem('currency') || 'INR';
        const timezone = localStorage.getItem('timezone') || 'Asia/Kolkata';
        const dateFormat = localStorage.getItem('dateFormat') || 'DD/MM/YYYY';

        if (businessName) document.getElementById('businessName').value = businessName;
        if (currency) document.getElementById('currencySelect').value = currency;
        if (timezone) document.getElementById('timezoneSelect').value = timezone;
        if (dateFormat) document.getElementById('dateFormatSelect').value = dateFormat;

        // Load business info
        const businessEmail = localStorage.getItem('businessEmail');
        const businessPhone = localStorage.getItem('businessPhone');
        const businessAddress = localStorage.getItem('businessAddress');
        const businessGST = localStorage.getItem('businessGST');
        const businessWebsite = localStorage.getItem('businessWebsite');

        if (businessEmail) document.getElementById('businessEmail').value = businessEmail;
        if (businessPhone) document.getElementById('businessPhone').value = businessPhone;
        if (businessAddress) document.getElementById('businessAddress').value = businessAddress;
        if (businessGST) document.getElementById('businessGST').value = businessGST;
        if (businessWebsite) document.getElementById('businessWebsite').value = businessWebsite;

        // Load notification settings
        const emailNotif = localStorage.getItem('emailNotifications') !== 'false';
        const whatsappNotif = localStorage.getItem('whatsappNotifications') !== 'false';
        const paymentRem = localStorage.getItem('paymentReminders') !== 'false';
        const bookingConf = localStorage.getItem('bookingConfirmations') !== 'false';
        const dailySum = localStorage.getItem('dailySummary') === 'true';

        document.getElementById('emailNotifications').checked = emailNotif;
        document.getElementById('whatsappNotifications').checked = whatsappNotif;
        document.getElementById('paymentReminders').checked = paymentRem;
        document.getElementById('bookingConfirmations').checked = bookingConf;
        document.getElementById('dailySummary').checked = dailySum;

        // Load dark mode toggle state
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.getElementById('darkModeToggle').checked = currentTheme === 'dark';

        // Load automation settings
        document.getElementById('smartAutomationEnabled').checked = localStorage.getItem('smartAutomationEnabled') !== 'false';
        document.getElementById('automationInterval').value = localStorage.getItem('automationInterval') || '30';

        // Load email settings
        if (typeof loadEmailSettings === 'function') loadEmailSettings();

        // Update Gmail send integration status
        updateGmailSendStatus();

        // Update Gmail integration badge
        const gmailBadge = document.getElementById('gmailIntegrationBadge');
        if (gmailBadge) {
            const gmailConnected = !!localStorage.getItem('gmail_access_token');
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
        showToast('Automation Enabled', 'Smart Automation is now running', '✅');
    } else {
        stopSmartAutomation();
        showToast('Automation Disabled', 'Smart Automation has been stopped', '⚠️');
    }
    localStorage.setItem('smartAutomationEnabled', isEnabled);
}

function saveAutomationSettings() {
    try {
        const automationInterval = document.getElementById('automationInterval').value;

        localStorage.setItem('automationInterval', automationInterval);

        // Restart automation with new interval
        if (document.getElementById('smartAutomationEnabled').checked) {
            stopSmartAutomation();
            startSmartAutomation();
        }

        showToast('✅ Settings Saved', 'Automation settings updated successfully', '🤖');
    } catch (error) {
        showToast('❌ Error', 'Failed to save automation settings', '⚠️');
    }
}

function saveGeneralSettings() {
    try {
        localStorage.setItem('businessName', document.getElementById('businessName').value);
        localStorage.setItem('currency', document.getElementById('currencySelect').value);
        localStorage.setItem('timezone', document.getElementById('timezoneSelect').value);
        localStorage.setItem('dateFormat', document.getElementById('dateFormatSelect').value);

        showToast('✅ Settings Saved', 'General settings saved successfully', '⚙️');
    } catch (error) {
        showToast('❌ Error', 'Failed to save settings', '⚠️');
    }
}

function saveBusinessSettings() {
    try {
        localStorage.setItem('businessEmail', document.getElementById('businessEmail').value);
        localStorage.setItem('businessPhone', document.getElementById('businessPhone').value);
        localStorage.setItem('businessAddress', document.getElementById('businessAddress').value);
        localStorage.setItem('businessGST', document.getElementById('businessGST').value);
        localStorage.setItem('businessWebsite', document.getElementById('businessWebsite').value);

        showToast('✅ Settings Saved', 'Business info saved successfully', '📇');
    } catch (error) {
        showToast('❌ Error', 'Failed to save business info', '⚠️');
    }
}

function saveNotificationSettings() {
    try {
        localStorage.setItem('emailNotifications', document.getElementById('emailNotifications').checked);
        localStorage.setItem('whatsappNotifications', document.getElementById('whatsappNotifications').checked);
        localStorage.setItem('paymentReminders', document.getElementById('paymentReminders').checked);
        localStorage.setItem('bookingConfirmations', document.getElementById('bookingConfirmations').checked);
        localStorage.setItem('dailySummary', document.getElementById('dailySummary').checked);

        showToast('✅ Settings Saved', 'Notification preferences saved', '🔔');
    } catch (error) {
        showToast('❌ Error', 'Failed to save notification settings', '⚠️');
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
        showToast('✅ Saved', 'Email settings saved successfully', '📧');
    } catch (error) {
        showToast('❌ Error', 'Failed to save email settings', '⚠️');
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
        showToast('✅ Saved', 'Email template preferences saved', '📧');
    } catch (error) {
        showToast('❌ Error', 'Failed to save template settings', '⚠️');
    }
}

function saveEmailSignature() {
    try {
        const signature = document.getElementById('emailSignature')?.value || '';
        localStorage.setItem('emailSignature', signature);
        showToast('✅ Saved', 'Email signature saved', '✍️');
    } catch (error) {
        showToast('❌ Error', 'Failed to save signature', '⚠️');
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
        showToast('✅ Export Complete', 'Data exported successfully', '📥');
    } catch (error) {
        showToast('❌ Error', 'Failed to export data', '⚠️');
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

            if (confirm('⚠️ This will replace all existing data. Continue?')) {
                if (data.reservations) localStorage.setItem('reservations', JSON.stringify(data.reservations));
                if (data.guests) localStorage.setItem('guests', JSON.stringify(data.guests));
                if (data.properties) localStorage.setItem('properties', JSON.stringify(data.properties));
                if (data.payments) localStorage.setItem('payments', JSON.stringify(data.payments));
                if (data.meals) localStorage.setItem('meals', JSON.stringify(data.meals));

                showToast('✅ Import Complete', 'Data imported successfully. Refreshing...', '📤');
                setTimeout(() => location.reload(), 2000);
            }
        } catch (error) {
            showToast('❌ Error', 'Failed to import data', '⚠️');
        }
    };
    input.click();
}

function clearAllData() {
    if (confirm('⚠️ Are you ABSOLUTELY sure? This will delete ALL your data permanently!')) {
        if (confirm('⚠️ Final confirmation: Delete everything?')) {
            localStorage.clear();
            showToast('✅ Data Cleared', 'All data has been cleared. Refreshing...', '🗑️');
            setTimeout(() => location.reload(), 2000);
        }
    }
}

// Communication Functions
let communicationMessages = [];
let currentCommunicationFilter = 'all';

