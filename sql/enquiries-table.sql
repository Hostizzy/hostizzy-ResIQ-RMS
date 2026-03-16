-- =====================================================
-- RESIQ - ENQUIRIES / LEADS TABLE
-- Pre-booking pipeline for tracking guest enquiries
-- =====================================================

CREATE TABLE IF NOT EXISTS enquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Contact Info
    guest_name TEXT NOT NULL,
    guest_phone TEXT,
    guest_email TEXT,

    -- Enquiry Details
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    property_name TEXT,
    check_in DATE,
    check_out DATE,
    nights INTEGER,
    number_of_guests INTEGER,
    number_of_rooms INTEGER,
    budget_range TEXT,

    -- Source & Attribution
    source TEXT NOT NULL DEFAULT 'phone' CHECK (source IN (
        'phone', 'whatsapp', 'instagram', 'facebook', 'website', 'walk_in', 'referral', 'email', 'google', 'other'
    )),
    source_details TEXT, -- e.g. referral name, instagram handle, ad campaign

    -- Pipeline Status
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'contacted', 'follow_up', 'negotiation', 'converted', 'lost'
    )),
    lost_reason TEXT, -- why they didn't book

    -- Assignment & Follow-up
    assigned_to TEXT, -- team member name or id
    follow_up_date DATE,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Notes
    notes TEXT,

    -- Conversion
    converted_booking_id TEXT, -- links to reservations.booking_id when converted

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast pipeline queries
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_follow_up ON enquiries(follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enquiries_property ON enquiries(property_id);

-- RLS Policies (optional, adjust based on your auth setup)
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage enquiries"
    ON enquiries FOR ALL
    USING (true)
    WITH CHECK (true);
