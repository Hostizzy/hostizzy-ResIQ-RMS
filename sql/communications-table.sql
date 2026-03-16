-- =====================================================
-- RESIQ - COMMUNICATIONS TABLE ENHANCEMENTS
-- Adds new columns to the existing communications table
-- (table already exists with: booking_id, guest_name,
--  guest_phone, message_type, template_used,
--  message_content, sent_by, sent_at)
-- =====================================================

-- Add recipient email (for email messages)
ALTER TABLE communications ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- Add subject line
ALTER TABLE communications ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add status tracking
ALTER TABLE communications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';

-- Add scheduling support
ALTER TABLE communications ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Add created_at if missing
ALTER TABLE communications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_communications_message_type ON communications(message_type);
CREATE INDEX IF NOT EXISTS idx_communications_created ON communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_scheduled ON communications(scheduled_for) WHERE status = 'scheduled';

-- RLS (safe to run even if already enabled)
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy (idempotent)
DROP POLICY IF EXISTS "Authenticated users can manage communications" ON communications;
CREATE POLICY "Authenticated users can manage communications"
    ON communications FOR ALL
    USING (true)
    WITH CHECK (true);
