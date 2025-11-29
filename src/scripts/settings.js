/**
 * Settings Module
 * Handles user/company settings, preferences, and configuration
 */

import { supabase } from './config.js'
import { showToast, showLoading, hideLoading } from './ui.js'
import { getCurrentUser } from './auth.js'

// ============================================
// LOAD SETTINGS VIEW
// ============================================

export async function loadSettings() {
    try {
        showLoading('Loading settings...')

        const user = getCurrentUser()
        if (!user) {
            hideLoading()
            showToast('Error', 'User not authenticated', '❌')
            return
        }

        // Fetch user settings
        const { data: settings, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', user.id)
            .single()

        if (error && error.code !== 'PGRST116') {  // PGRST116 = no rows returned
            throw error
        }

        // Populate form with settings or defaults
        populateSettingsForm(settings || getDefaultSettings())

        hideLoading()

    } catch (error) {
        console.error('Load settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to load settings', '❌')
    }
}

function getDefaultSettings() {
    return {
        company_name: '',
        trade_name: '',
        company_address: '',
        company_phone: '',
        company_email: '',
        company_website: '',
        gstin: '',
        pan: '',
        tax_rate: 18.00,
        cgst_rate: 9.00,
        sgst_rate: 9.00,
        whatsapp_enabled: false,
        email_enabled: false,
        sms_enabled: false,
        notification_email: true,
        notification_sms: false,
        notification_whatsapp: true,
        notification_push: true,
        default_checkin_time: '14:00',
        default_checkout_time: '11:00',
        advance_payment_percentage: 30.00,
        theme: 'light',
        language: 'en',
        timezone: 'Asia/Kolkata',
        date_format: 'DD/MM/YYYY',
        currency: 'INR',
        currency_symbol: '₹',
        two_factor_enabled: false,
        session_timeout_minutes: 1440,
        feature_kanban_board: true,
        feature_calendar_view: true,
        feature_revenue_forecasting: true,
        feature_command_palette: true
    }
}

function populateSettingsForm(settings) {
    // General Settings
    setFieldValue('settingCompanyName', settings.company_name)
    setFieldValue('settingTradeName', settings.trade_name)
    setFieldValue('settingCompanyAddress', settings.company_address)
    setFieldValue('settingCompanyPhone', settings.company_phone)
    setFieldValue('settingCompanyEmail', settings.company_email)
    setFieldValue('settingCompanyWebsite', settings.company_website)

    // Tax Settings
    setFieldValue('settingGSTIN', settings.gstin)
    setFieldValue('settingPAN', settings.pan)
    setFieldValue('settingTaxRate', settings.tax_rate)
    setFieldValue('settingCGSTRate', settings.cgst_rate)
    setFieldValue('settingSGSTRate', settings.sgst_rate)

    // WhatsApp Settings
    setFieldValue('settingWhatsAppAPIURL', settings.whatsapp_api_url)
    setFieldValue('settingWhatsAppAPIKey', settings.whatsapp_api_key)
    setFieldValue('settingWhatsAppPhone', settings.whatsapp_phone_number)
    setCheckboxValue('settingWhatsAppEnabled', settings.whatsapp_enabled)

    // Email Settings
    setFieldValue('settingSMTPHost', settings.smtp_host)
    setFieldValue('settingSMTPPort', settings.smtp_port)
    setFieldValue('settingSMTPUsername', settings.smtp_username)
    setFieldValue('settingSMTPPassword', settings.smtp_password)
    setFieldValue('settingSMTPFromEmail', settings.smtp_from_email)
    setFieldValue('settingSMTPFromName', settings.smtp_from_name)
    setCheckboxValue('settingEmailEnabled', settings.email_enabled)

    // SMS Settings
    setFieldValue('settingSMSProvider', settings.sms_provider)
    setFieldValue('settingSMSAPIKey', settings.sms_api_key)
    setFieldValue('settingSMSSenderID', settings.sms_sender_id)
    setCheckboxValue('settingSMSEnabled', settings.sms_enabled)

    // Notification Preferences
    setCheckboxValue('settingNotificationEmail', settings.notification_email)
    setCheckboxValue('settingNotificationSMS', settings.notification_sms)
    setCheckboxValue('settingNotificationWhatsApp', settings.notification_whatsapp)
    setCheckboxValue('settingNotificationPush', settings.notification_push)

    // Business Rules
    setFieldValue('settingDefaultCheckin', settings.default_checkin_time)
    setFieldValue('settingDefaultCheckout', settings.default_checkout_time)
    setFieldValue('settingAdvancePayment', settings.advance_payment_percentage)
    setFieldValue('settingCancellationPolicy', settings.cancellation_policy)

    // UI Preferences
    setFieldValue('settingTheme', settings.theme)
    setFieldValue('settingLanguage', settings.language)
    setFieldValue('settingTimezone', settings.timezone)
    setFieldValue('settingDateFormat', settings.date_format)
    setFieldValue('settingCurrency', settings.currency)
    setFieldValue('settingCurrencySymbol', settings.currency_symbol)

    // Security
    setCheckboxValue('setting2FAEnabled', settings.two_factor_enabled)
    setFieldValue('settingSessionTimeout', settings.session_timeout_minutes)

    // Feature Flags
    setCheckboxValue('settingFeatureKanban', settings.feature_kanban_board)
    setCheckboxValue('settingFeatureCalendar', settings.feature_calendar_view)
    setCheckboxValue('settingFeatureForecasting', settings.feature_revenue_forecasting)
    setCheckboxValue('settingFeatureCommandPalette', settings.feature_command_palette)
}

function setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId)
    if (field) {
        field.value = value || ''
    }
}

function setCheckboxValue(fieldId, value) {
    const field = document.getElementById(fieldId)
    if (field) {
        field.checked = !!value
    }
}

// ============================================
// SAVE SETTINGS
// ============================================

export async function saveGeneralSettings() {
    try {
        showLoading('Saving settings...')

        const user = getCurrentUser()
        if (!user) {
            throw new Error('User not authenticated')
        }

        const settings = {
            user_id: user.id,
            company_name: document.getElementById('settingCompanyName')?.value,
            trade_name: document.getElementById('settingTradeName')?.value,
            company_address: document.getElementById('settingCompanyAddress')?.value,
            company_phone: document.getElementById('settingCompanyPhone')?.value,
            company_email: document.getElementById('settingCompanyEmail')?.value,
            company_website: document.getElementById('settingCompanyWebsite')?.value
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'General settings saved successfully', '✅')

    } catch (error) {
        console.error('Save general settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save settings: ' + error.message, '❌')
    }
}

export async function saveBillingSettings() {
    try {
        showLoading('Saving billing settings...')

        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const settings = {
            user_id: user.id,
            gstin: document.getElementById('settingGSTIN')?.value,
            pan: document.getElementById('settingPAN')?.value,
            tax_rate: parseFloat(document.getElementById('settingTaxRate')?.value) || 18.00,
            cgst_rate: parseFloat(document.getElementById('settingCGSTRate')?.value) || 9.00,
            sgst_rate: parseFloat(document.getElementById('settingSGSTRate')?.value) || 9.00
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'Billing settings saved successfully', '✅')

    } catch (error) {
        console.error('Save billing settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save billing settings: ' + error.message, '❌')
    }
}

export async function saveWhatsAppSettings() {
    try {
        showLoading('Saving WhatsApp settings...')

        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const settings = {
            user_id: user.id,
            whatsapp_api_url: document.getElementById('settingWhatsAppAPIURL')?.value,
            whatsapp_api_key: document.getElementById('settingWhatsAppAPIKey')?.value,
            whatsapp_phone_number: document.getElementById('settingWhatsAppPhone')?.value,
            whatsapp_enabled: document.getElementById('settingWhatsAppEnabled')?.checked || false
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'WhatsApp settings saved successfully', '✅')

    } catch (error) {
        console.error('Save WhatsApp settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save WhatsApp settings: ' + error.message, '❌')
    }
}

export async function saveEmailSettings() {
    try {
        showLoading('Saving email settings...')

        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const settings = {
            user_id: user.id,
            smtp_host: document.getElementById('settingSMTPHost')?.value,
            smtp_port: parseInt(document.getElementById('settingSMTPPort')?.value) || 587,
            smtp_username: document.getElementById('settingSMTPUsername')?.value,
            smtp_password: document.getElementById('settingSMTPPassword')?.value,
            smtp_from_email: document.getElementById('settingSMTPFromEmail')?.value,
            smtp_from_name: document.getElementById('settingSMTPFromName')?.value,
            email_enabled: document.getElementById('settingEmailEnabled')?.checked || false
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'Email settings saved successfully', '✅')

    } catch (error) {
        console.error('Save email settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save email settings: ' + error.message, '❌')
    }
}

export async function saveSMSSettings() {
    try {
        showLoading('Saving SMS settings...')

        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const settings = {
            user_id: user.id,
            sms_provider: document.getElementById('settingSMSProvider')?.value,
            sms_api_key: document.getElementById('settingSMSAPIKey')?.value,
            sms_sender_id: document.getElementById('settingSMSSenderID')?.value,
            sms_enabled: document.getElementById('settingSMSEnabled')?.checked || false
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'SMS settings saved successfully', '✅')

    } catch (error) {
        console.error('Save SMS settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save SMS settings: ' + error.message, '❌')
    }
}

export async function saveNotificationSettings() {
    try {
        showLoading('Saving notification settings...')

        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const settings = {
            user_id: user.id,
            notification_email: document.getElementById('settingNotificationEmail')?.checked || false,
            notification_sms: document.getElementById('settingNotificationSMS')?.checked || false,
            notification_whatsapp: document.getElementById('settingNotificationWhatsApp')?.checked || false,
            notification_push: document.getElementById('settingNotificationPush')?.checked || false
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'Notification settings saved successfully', '✅')

    } catch (error) {
        console.error('Save notification settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save notification settings: ' + error.message, '❌')
    }
}

export async function saveSecuritySettings() {
    try {
        showLoading('Saving security settings...')

        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const settings = {
            user_id: user.id,
            two_factor_enabled: document.getElementById('setting2FAEnabled')?.checked || false,
            session_timeout_minutes: parseInt(document.getElementById('settingSessionTimeout')?.value) || 1440
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'Security settings saved successfully', '✅')

    } catch (error) {
        console.error('Save security settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save security settings: ' + error.message, '❌')
    }
}

export async function savePreferenceSettings() {
    try {
        showLoading('Saving preference settings...')

        const user = getCurrentUser()
        if (!user) throw new Error('User not authenticated')

        const settings = {
            user_id: user.id,
            default_checkin_time: document.getElementById('settingDefaultCheckin')?.value || '14:00',
            default_checkout_time: document.getElementById('settingDefaultCheckout')?.value || '11:00',
            advance_payment_percentage: parseFloat(document.getElementById('settingAdvancePayment')?.value) || 30.00,
            cancellation_policy: document.getElementById('settingCancellationPolicy')?.value,
            theme: document.getElementById('settingTheme')?.value || 'light',
            language: document.getElementById('settingLanguage')?.value || 'en',
            timezone: document.getElementById('settingTimezone')?.value || 'Asia/Kolkata',
            date_format: document.getElementById('settingDateFormat')?.value || 'DD/MM/YYYY',
            currency: document.getElementById('settingCurrency')?.value || 'INR',
            currency_symbol: document.getElementById('settingCurrencySymbol')?.value || '₹',
            feature_kanban_board: document.getElementById('settingFeatureKanban')?.checked !== false,
            feature_calendar_view: document.getElementById('settingFeatureCalendar')?.checked !== false,
            feature_revenue_forecasting: document.getElementById('settingFeatureForecasting')?.checked !== false,
            feature_command_palette: document.getElementById('settingFeatureCommandPalette')?.checked !== false
        }

        const { error } = await supabase
            .from('settings')
            .upsert(settings, { onConflict: 'user_id' })

        if (error) throw error

        hideLoading()
        showToast('Success', 'Preferences saved successfully', '✅')

    } catch (error) {
        console.error('Save preference settings error:', error)
        hideLoading()
        showToast('Error', 'Failed to save preferences: ' + error.message, '❌')
    }
}

// ============================================
// TEST CONNECTIONS
// ============================================

export async function testWhatsAppConnection() {
    try {
        showLoading('Testing WhatsApp connection...')

        const apiURL = document.getElementById('settingWhatsAppAPIURL')?.value
        const apiKey = document.getElementById('settingWhatsAppAPIKey')?.value

        if (!apiURL || !apiKey) {
            throw new Error('Please fill in WhatsApp API URL and Key')
        }

        // Make test request to WhatsApp API
        // This is a placeholder - implement actual test based on your WhatsApp provider
        showToast('Info', 'WhatsApp test not implemented yet', 'ℹ️')
        hideLoading()

    } catch (error) {
        console.error('Test WhatsApp connection error:', error)
        hideLoading()
        showToast('Error', error.message, '❌')
    }
}

export async function testEmailConnection() {
    try {
        showLoading('Testing email connection...')

        const host = document.getElementById('settingSMTPHost')?.value
        const port = document.getElementById('settingSMTPPort')?.value
        const username = document.getElementById('settingSMTPUsername')?.value

        if (!host || !port || !username) {
            throw new Error('Please fill in SMTP settings')
        }

        // Make test email request
        // This is a placeholder - implement actual SMTP test
        showToast('Info', 'Email test not implemented yet', 'ℹ️')
        hideLoading()

    } catch (error) {
        console.error('Test email connection error:', error)
        hideLoading()
        showToast('Error', error.message, '❌')
    }
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.loadSettings = loadSettings
    window.saveGeneralSettings = saveGeneralSettings
    window.saveBillingSettings = saveBillingSettings
    window.saveWhatsAppSettings = saveWhatsAppSettings
    window.saveEmailSettings = saveEmailSettings
    window.saveSMSSettings = saveSMSSettings
    window.saveNotificationSettings = saveNotificationSettings
    window.saveSecuritySettings = saveSecuritySettings
    window.savePreferenceSettings = savePreferenceSettings
    window.testWhatsAppConnection = testWhatsAppConnection
    window.testEmailConnection = testEmailConnection
}

console.log('✅ Settings module loaded')
