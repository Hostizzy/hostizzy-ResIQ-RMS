-- Settings Table for user/company configuration
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Company/General Settings
    company_name VARCHAR(255),
    trade_name VARCHAR(255),
    company_address TEXT,
    company_phone VARCHAR(20),
    company_email VARCHAR(255),
    company_website VARCHAR(255),

    -- GST/Tax Settings
    gstin VARCHAR(15),  -- GST Identification Number
    pan VARCHAR(10),  -- PAN number
    tax_rate DECIMAL(5, 2) DEFAULT 18.00,  -- Default GST rate
    cgst_rate DECIMAL(5, 2) DEFAULT 9.00,
    sgst_rate DECIMAL(5, 2) DEFAULT 9.00,

    -- WhatsApp Integration
    whatsapp_api_url VARCHAR(500),
    whatsapp_api_key VARCHAR(500),
    whatsapp_phone_number VARCHAR(20),
    whatsapp_enabled BOOLEAN DEFAULT false,

    -- Email Integration
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_username VARCHAR(255),
    smtp_password VARCHAR(500),  -- Should be encrypted
    smtp_from_email VARCHAR(255),
    smtp_from_name VARCHAR(255),
    email_enabled BOOLEAN DEFAULT false,

    -- SMS Integration
    sms_provider VARCHAR(50),  -- 'twilio', 'msg91', etc.
    sms_api_key VARCHAR(500),
    sms_sender_id VARCHAR(20),
    sms_enabled BOOLEAN DEFAULT false,

    -- Notification Preferences
    notification_email BOOLEAN DEFAULT true,
    notification_sms BOOLEAN DEFAULT false,
    notification_whatsapp BOOLEAN DEFAULT true,
    notification_push BOOLEAN DEFAULT true,

    -- Business Rules
    default_checkin_time TIME DEFAULT '14:00:00',
    default_checkout_time TIME DEFAULT '11:00:00',
    advance_payment_percentage DECIMAL(5, 2) DEFAULT 30.00,
    cancellation_policy TEXT,

    -- UI Preferences
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    currency VARCHAR(10) DEFAULT 'INR',
    currency_symbol VARCHAR(5) DEFAULT '₹',

    -- Security Settings
    two_factor_enabled BOOLEAN DEFAULT false,
    session_timeout_minutes INTEGER DEFAULT 1440,  -- 24 hours

    -- Feature Flags
    feature_kanban_board BOOLEAN DEFAULT true,
    feature_calendar_view BOOLEAN DEFAULT true,
    feature_revenue_forecasting BOOLEAN DEFAULT true,
    feature_command_palette BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one settings row per user
    CONSTRAINT unique_user_settings UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW
EXECUTE FUNCTION update_settings_updated_at();

-- RLS Policies for settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Users can only view their own settings
CREATE POLICY "Users can view own settings"
ON settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
ON settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
ON settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own settings
CREATE POLICY "Users can delete own settings"
ON settings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE settings IS 'User and company configuration settings';
COMMENT ON COLUMN settings.gstin IS 'GST Identification Number (15 characters)';
COMMENT ON COLUMN settings.theme IS 'UI theme preference: light, dark, or auto';
COMMENT ON COLUMN settings.two_factor_enabled IS 'Whether 2FA is enabled for this user';
