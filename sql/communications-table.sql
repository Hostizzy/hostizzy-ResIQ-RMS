-- =====================================================
-- RESIQ - COMMUNICATIONS TABLE
-- Persistent message history (replaces localStorage)
-- =====================================================

CREATE TABLE IF NOT EXISTS communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Message Details
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
    recipient TEXT NOT NULL,
    recipient_email TEXT,
    recipient_phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'logged' CHECK (status IN ('sent', 'logged', 'scheduled', 'failed')),

    -- Template Used
    template_key TEXT,

    -- Linked Booking (optional)
    booking_id TEXT,

    -- Scheduling
    scheduled_for TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_communications_channel ON communications(channel);
CREATE INDEX IF NOT EXISTS idx_communications_created ON communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_scheduled ON communications(scheduled_for) WHERE status = 'scheduled';

-- RLS
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage communications"
    ON communications FOR ALL
    USING (true)
    WITH CHECK (true);
