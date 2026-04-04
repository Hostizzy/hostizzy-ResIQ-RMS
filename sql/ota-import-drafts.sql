-- OTA Import Drafts Table
-- Persists Gmail scan results so they survive page refreshes.
-- Users review and import selected drafts into the reservations table.
--
-- Run this SQL in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS ota_import_drafts (
    id SERIAL PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    email_date TEXT,
    email_from TEXT,
    email_subject TEXT,
    booking_data JSONB NOT NULL,
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ota_drafts_status ON ota_import_drafts(status);
CREATE INDEX IF NOT EXISTS idx_ota_drafts_message_id ON ota_import_drafts(message_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_ota_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ota_drafts_updated_at ON ota_import_drafts;
CREATE TRIGGER update_ota_drafts_updated_at
    BEFORE UPDATE ON ota_import_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_ota_drafts_updated_at();

-- Enable RLS
ALTER TABLE ota_import_drafts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated staff to manage drafts
DROP POLICY IF EXISTS "Staff can manage OTA drafts" ON ota_import_drafts;
CREATE POLICY "Staff can manage OTA drafts"
    ON ota_import_drafts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );
