-- =====================================================
-- OWNER PORTAL - DATABASE SCHEMA
-- Property Owner Management System
-- Date: 2025-12-04
-- =====================================================

-- =====================================================
-- TABLE: property_owners
-- Purpose: Store property owner information and credentials
-- =====================================================

CREATE TABLE IF NOT EXISTS property_owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Personal Information
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,

    -- Authentication (using same pattern as team_members)
    password TEXT NOT NULL,

    -- Business Information
    pan_number TEXT,
    gst_number TEXT,
    company_name TEXT,

    -- Bank Details
    bank_account_number TEXT,
    bank_ifsc TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    account_holder_name TEXT,
    upi_id TEXT,

    -- Commission Settings
    commission_rate NUMERIC DEFAULT 20.00, -- Hostizzy commission %

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: payout_requests
-- Purpose: Track owner payout requests
-- =====================================================

CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Owner Reference
    owner_id UUID NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,

    -- Property Reference (NULL for all properties)
    property_id INT REFERENCES properties(id) ON DELETE SET NULL,

    -- Payout Details
    amount NUMERIC NOT NULL CHECK (amount >= 100),
    payout_method TEXT CHECK (payout_method IN ('bank_transfer', 'upi', 'cheque')),

    -- Status Tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),

    -- Processing Details
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by INT REFERENCES team_members(id),

    -- Transaction Details
    transaction_id TEXT,
    transaction_reference TEXT,

    -- Notes
    owner_notes TEXT,
    admin_notes TEXT,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MODIFY EXISTING TABLES
-- =====================================================

-- Link properties to owners
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES property_owners(id) ON DELETE SET NULL;

-- Link reservations to owners (for easy revenue tracking)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES property_owners(id) ON DELETE SET NULL;

-- Add Hostizzy revenue/commission column
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS hostizzy_revenue NUMERIC DEFAULT 0;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_property_owners_email ON property_owners(email);
CREATE INDEX IF NOT EXISTS idx_property_owners_active ON property_owners(is_active);
CREATE INDEX IF NOT EXISTS idx_payout_requests_owner ON payout_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_date ON payout_requests(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_reservations_owner ON reservations(owner_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on property_owners
ALTER TABLE property_owners ENABLE ROW LEVEL SECURITY;

-- Policy 1: Owners can view their own profile
CREATE POLICY "Owners can view own profile"
    ON property_owners
    FOR SELECT
    USING (email = current_setting('app.user_email', true));

-- Policy 2: Owners can update their own profile
CREATE POLICY "Owners can update own profile"
    ON property_owners
    FOR UPDATE
    USING (email = current_setting('app.user_email', true));

-- Policy 3: Staff can view all owners
CREATE POLICY "Staff can view all owners"
    ON property_owners
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- Policy 4: Admin can insert/update owners
CREATE POLICY "Admin can manage owners"
    ON property_owners
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND role = 'admin'
            AND is_active = true
        )
    );

-- Enable RLS on payout_requests
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Policy 5: Owners can view their own payout requests
CREATE POLICY "Owners can view own payouts"
    ON payout_requests
    FOR SELECT
    USING (
        owner_id IN (
            SELECT id FROM property_owners
            WHERE email = current_setting('app.user_email', true)
        )
    );

-- Policy 6: Owners can create payout requests
CREATE POLICY "Owners can create payouts"
    ON payout_requests
    FOR INSERT
    WITH CHECK (
        owner_id IN (
            SELECT id FROM property_owners
            WHERE email = current_setting('app.user_email', true)
        )
    );

-- Policy 7: Staff can view all payout requests
CREATE POLICY "Staff can view all payouts"
    ON payout_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- Policy 8: Admin can manage payout requests
CREATE POLICY "Admin can manage payouts"
    ON payout_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND role IN ('admin', 'manager')
            AND is_active = true
        )
    );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_property_owners_updated_at
    BEFORE UPDATE ON property_owners
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at
    BEFORE UPDATE ON payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate owner's total revenue
CREATE OR REPLACE FUNCTION get_owner_revenue(
    p_owner_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_revenue NUMERIC,
    hostizzy_commission NUMERIC,
    net_earnings NUMERIC,
    total_bookings BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(r.total_amount), 0) as total_revenue,
        COALESCE(SUM(r.hostizzy_revenue), 0) as hostizzy_commission,
        COALESCE(SUM(r.total_amount - r.hostizzy_revenue), 0) as net_earnings,
        COUNT(*)::BIGINT as total_bookings
    FROM reservations r
    WHERE r.owner_id = p_owner_id
        AND r.status IN ('confirmed', 'checked_in', 'completed')
        AND (p_start_date IS NULL OR r.check_in >= p_start_date)
        AND (p_end_date IS NULL OR r.check_in <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate owner's pending payout amount
CREATE OR REPLACE FUNCTION get_owner_pending_payout(p_owner_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_earned NUMERIC;
    total_paid_out NUMERIC;
    pending_amount NUMERIC;
BEGIN
    -- Calculate total earnings (paid bookings)
    SELECT COALESCE(SUM(r.total_amount - r.hostizzy_revenue), 0)
    INTO total_earned
    FROM reservations r
    WHERE r.owner_id = p_owner_id
        AND r.payment_status = 'paid'
        AND r.status IN ('confirmed', 'checked_in', 'completed');

    -- Calculate total already paid out
    SELECT COALESCE(SUM(pr.amount), 0)
    INTO total_paid_out
    FROM payout_requests pr
    WHERE pr.owner_id = p_owner_id
        AND pr.status = 'completed';

    pending_amount := total_earned - total_paid_out;

    RETURN GREATEST(pending_amount, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

/*
-- Create a sample owner
INSERT INTO property_owners (name, email, phone, password, pan_number, bank_account_number, bank_ifsc, upi_id)
VALUES (
    'Rajesh Kumar',
    'owner@example.com',
    '+91-9876543210',
    'owner123', -- Change this password!
    'ABCDE1234F',
    '1234567890',
    'SBIN0001234',
    'owner@upi'
);

-- Link a property to this owner
UPDATE properties
SET owner_id = (SELECT id FROM property_owners WHERE email = 'owner@example.com')
WHERE name = 'Test Property';

-- Update existing reservations to link with owner
UPDATE reservations r
SET owner_id = p.owner_id
FROM properties p
WHERE r.property_id = p.id
    AND p.owner_id IS NOT NULL;
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('property_owners', 'payout_requests')
    AND table_schema = 'public';

-- Check if columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('properties', 'reservations')
    AND column_name = 'owner_id';

-- =====================================================
-- DEPLOYMENT CHECKLIST
-- =====================================================

/*
□ Run this SQL in Supabase SQL Editor
□ Create at least one owner account
□ Link properties to owners
□ Update existing reservations with owner_id
□ Test owner login
□ Test payout request creation
□ Configure email notifications for payouts
*/
