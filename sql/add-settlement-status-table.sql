-- =====================================================
-- MIGRATION: Add Settlement Status Tracking
-- Date: 2025-12-15
-- Purpose: Add settlement_status table for monthly settlement completion tracking
-- =====================================================

-- =====================================================
-- TABLE: settlement_status
-- =====================================================

CREATE TABLE IF NOT EXISTS settlement_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Owner Reference
    owner_id UUID NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,

    -- Settlement Period (format: "YYYY-M", e.g., "2024-11")
    settlement_month TEXT NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),

    -- Settlement Type
    settlement_type TEXT CHECK (settlement_type IN ('payout_received', 'payment_done')),

    -- Timestamps
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one status per owner per month
    UNIQUE(owner_id, settlement_month)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settlement_status_owner ON settlement_status(owner_id);
CREATE INDEX IF NOT EXISTS idx_settlement_status_month ON settlement_status(settlement_month);
CREATE INDEX IF NOT EXISTS idx_settlement_status_owner_month ON settlement_status(owner_id, settlement_month);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE settlement_status ENABLE ROW LEVEL SECURITY;

-- Policy 1: Owners can view their own settlement status
CREATE POLICY "Owners can view own settlements"
    ON settlement_status
    FOR SELECT
    USING (
        owner_id IN (
            SELECT id FROM property_owners
            WHERE email = current_setting('app.user_email', true)
        )
    );

-- Policy 2: Owners can create/update their own settlement status
CREATE POLICY "Owners can manage own settlements"
    ON settlement_status
    FOR ALL
    USING (
        owner_id IN (
            SELECT id FROM property_owners
            WHERE email = current_setting('app.user_email', true)
        )
    )
    WITH CHECK (
        owner_id IN (
            SELECT id FROM property_owners
            WHERE email = current_setting('app.user_email', true)
        )
    );

-- Policy 3: Staff can view all settlement statuses
CREATE POLICY "Staff can view all settlements"
    ON settlement_status
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp (reuse existing function)
CREATE TRIGGER update_settlement_status_updated_at
    BEFORE UPDATE ON settlement_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify table was created
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'settlement_status'
ORDER BY ordinal_position;

-- Verify indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'settlement_status';

-- Verify RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'settlement_status';

-- =====================================================
-- DEPLOYMENT INSTRUCTIONS
-- =====================================================

/*
1. Run this SQL script in Supabase SQL Editor
2. Verify table was created successfully
3. Test settlement status tracking in Owner Portal
4. Owners can now mark settlements as completed on the Payout page

USAGE EXAMPLE:
When an owner clicks "Mark Payout Received" or "Mark Payment Done",
a record is inserted/updated in this table:

INSERT INTO settlement_status (
    owner_id,
    settlement_month,
    status,
    completed_at,
    settlement_type
) VALUES (
    'owner-uuid',
    '2024-11',
    'completed',
    NOW(),
    'payout_received'
)
ON CONFLICT (owner_id, settlement_month)
DO UPDATE SET
    status = 'completed',
    completed_at = NOW(),
    settlement_type = 'payout_received',
    updated_at = NOW();
*/
