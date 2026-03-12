-- =====================================================
-- MIGRATION: Redesigned Financial System
-- Date: 2026-03-12
-- Purpose: Implement new financial model with:
--   - Gross stay_amount (no manual OTA deduction)
--   - host_payout (auto-derived: total_amount - ota_service_fee)
--   - is_legacy flag for backward-compatible balance logic
--   - property_expenses table for expense tracking
--   - payout_eligible field for settlement tracking
-- =====================================================

-- =====================================================
-- STEP 1: Add new columns to reservations
-- =====================================================

-- is_legacy: true for old reservations (preserves old balance logic)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT false;

-- host_payout: total_amount - ota_service_fee (what property actually receives)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS host_payout NUMERIC DEFAULT 0;

-- payout_eligible: same as host_payout, stored for convenience
-- For direct bookings: = total_amount
-- For OTA bookings: = total_amount - ota_service_fee
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS payout_eligible NUMERIC DEFAULT 0;

-- =====================================================
-- STEP 2: Mark existing reservations as legacy
-- =====================================================

-- Run this ONCE after deploying. Uses check_in date (not created_at).
-- UPDATE reservations SET is_legacy = true WHERE check_in < '2026-03-01';

-- =====================================================
-- STEP 3: Backfill host_payout and payout_eligible for existing data
-- =====================================================

-- For existing reservations, calculate host_payout from current data
UPDATE reservations
SET host_payout = COALESCE(total_amount, 0) - COALESCE(ota_service_fee, 0),
    payout_eligible = COALESCE(total_amount, 0) - COALESCE(ota_service_fee, 0)
WHERE host_payout IS NULL OR host_payout = 0;

-- =====================================================
-- STEP 4: Create property_expenses table
-- =====================================================

CREATE TABLE IF NOT EXISTS property_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Property Reference
    property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Expense Details
    amount NUMERIC NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL CHECK (category IN (
        'maintenance',
        'utilities',
        'housekeeping',
        'supplies',
        'staff',
        'other'
    )),
    description TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Receipt/proof
    receipt_url TEXT,

    -- Who entered it
    entered_by TEXT, -- email of person who entered
    entered_by_type TEXT CHECK (entered_by_type IN ('staff', 'owner')),

    -- Settlement period (format: "YYYY-M", e.g., "2026-3")
    settlement_month TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 5: Indexes for property_expenses
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_property_expenses_property ON property_expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_property_expenses_date ON property_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_property_expenses_category ON property_expenses(category);
CREATE INDEX IF NOT EXISTS idx_property_expenses_month ON property_expenses(settlement_month);

-- =====================================================
-- STEP 6: RLS for property_expenses
-- =====================================================

ALTER TABLE property_expenses ENABLE ROW LEVEL SECURITY;

-- Staff can view all expenses
CREATE POLICY "Staff can view all expenses"
    ON property_expenses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- Staff can manage all expenses
CREATE POLICY "Staff can manage expenses"
    ON property_expenses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- Owners can view expenses for their properties
CREATE POLICY "Owners can view own property expenses"
    ON property_expenses
    FOR SELECT
    USING (
        property_id IN (
            SELECT p.id FROM properties p
            JOIN property_owners po ON p.owner_id = po.id
            WHERE po.email = current_setting('app.user_email', true)
        )
    );

-- Owners can create expenses for their properties
CREATE POLICY "Owners can create expenses"
    ON property_expenses
    FOR INSERT
    WITH CHECK (
        property_id IN (
            SELECT p.id FROM properties p
            JOIN property_owners po ON p.owner_id = po.id
            WHERE po.email = current_setting('app.user_email', true)
        )
    );

-- Owners can update their own expenses
CREATE POLICY "Owners can update own expenses"
    ON property_expenses
    FOR UPDATE
    USING (
        entered_by_type = 'owner'
        AND property_id IN (
            SELECT p.id FROM properties p
            JOIN property_owners po ON p.owner_id = po.id
            WHERE po.email = current_setting('app.user_email', true)
        )
    );

-- =====================================================
-- STEP 7: Trigger for updated_at
-- =====================================================

CREATE TRIGGER update_property_expenses_updated_at
    BEFORE UPDATE ON property_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 8: Update get_owner_revenue function
-- =====================================================

CREATE OR REPLACE FUNCTION get_owner_revenue(
    p_owner_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_revenue NUMERIC,
    hostizzy_commission NUMERIC,
    net_earnings NUMERIC,
    total_bookings BIGINT,
    total_host_payout NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(r.total_amount), 0) as total_revenue,
        COALESCE(SUM(r.hostizzy_revenue), 0) as hostizzy_commission,
        COALESCE(SUM(r.payout_eligible - r.hostizzy_revenue), 0) as net_earnings,
        COUNT(*)::BIGINT as total_bookings,
        COALESCE(SUM(r.payout_eligible), 0) as total_host_payout
    FROM reservations r
    WHERE r.owner_id = p_owner_id
        AND r.status IN ('confirmed', 'checked_in', 'completed')
        AND (p_start_date IS NULL OR r.check_in >= p_start_date)
        AND (p_end_date IS NULL OR r.check_in <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 9: Update get_owner_pending_payout function
-- =====================================================

CREATE OR REPLACE FUNCTION get_owner_pending_payout(p_owner_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_earned NUMERIC;
    total_paid_out NUMERIC;
    pending_amount NUMERIC;
BEGIN
    -- Calculate total earnings using payout_eligible (host_payout) minus commission
    SELECT COALESCE(SUM(r.payout_eligible - r.hostizzy_revenue), 0)
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
-- VERIFICATION
-- =====================================================

-- Check new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name IN ('is_legacy', 'host_payout', 'payout_eligible')
ORDER BY column_name;

-- Check property_expenses table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'property_expenses'
ORDER BY ordinal_position;

-- =====================================================
-- DEPLOYMENT CHECKLIST
-- =====================================================

/*
1. Run this SQL in Supabase SQL Editor
2. Mark legacy reservations:
   UPDATE reservations SET is_legacy = true WHERE check_in < '2026-03-01';
3. Verify backfill of host_payout and payout_eligible
4. Test new reservation creation (is_legacy = false)
5. Test balance calculation for both legacy and new
6. Test property expenses CRUD
7. Test owner portal settlement with expenses
*/
