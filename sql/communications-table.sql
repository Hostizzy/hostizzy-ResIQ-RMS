-- =====================================================
-- RESIQ - COMMUNICATIONS TABLE ENHANCEMENTS
-- Adds new columns to the existing communications table
--
-- Existing schema:
--   id UUID PK, booking_id TEXT NOT NULL, guest_name TEXT,
--   guest_phone TEXT, message_type TEXT DEFAULT 'whatsapp',
--   template_used TEXT, message_content TEXT,
--   sent_at TIMESTAMP DEFAULT now(), sent_by TEXT,
--   status TEXT DEFAULT 'sent'
-- =====================================================

-- Allow communications not tied to a booking (e.g. from Communication view)
ALTER TABLE communications ALTER COLUMN booking_id DROP NOT NULL;

-- Add recipient email (for email messages)
ALTER TABLE communications ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- Add subject line
ALTER TABLE communications ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add scheduling support
ALTER TABLE communications ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Add created_at for sorting consistency
ALTER TABLE communications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_communications_message_type ON communications(message_type);
CREATE INDEX IF NOT EXISTS idx_communications_scheduled ON communications(scheduled_for) WHERE status = 'scheduled';

-- RLS (safe to run even if already enabled)
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy (idempotent)
DROP POLICY IF EXISTS "Authenticated users can manage communications" ON communications;
CREATE POLICY "Authenticated users can manage communications"
    ON communications FOR ALL
    USING (true)
    WITH CHECK (true);
