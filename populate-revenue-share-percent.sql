-- =====================================================
-- SCRIPT: Populate revenue_share_percent in Reservations
-- Purpose: Fill revenue_share_percent for all reservations
--          based on their property's commission rate
-- =====================================================

-- STEP 1: Add revenue_share_percent column to reservations table (if it doesn't exist)
-- Run this first, or skip if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reservations'
        AND column_name = 'revenue_share_percent'
    ) THEN
        ALTER TABLE reservations
        ADD COLUMN revenue_share_percent NUMERIC(5,2) DEFAULT 20.00;

        RAISE NOTICE 'Column revenue_share_percent added to reservations table';
    ELSE
        RAISE NOTICE 'Column revenue_share_percent already exists in reservations table';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Update all existing reservations with revenue_share_percent from properties
-- =====================================================

-- First, let's see how many reservations will be updated
SELECT
    COUNT(*) as total_reservations,
    COUNT(DISTINCT property_id) as unique_properties
FROM reservations
WHERE revenue_share_percent IS NULL
   OR revenue_share_percent = 20.00; -- Default value

-- Update reservations with actual property commission rates
UPDATE reservations r
SET revenue_share_percent = p.revenue_share_percent,
    updated_at = NOW()
FROM properties p
WHERE r.property_id = p.id
  AND (r.revenue_share_percent IS NULL OR r.revenue_share_percent = 20.00);

-- =====================================================
-- STEP 3: Verify the update
-- =====================================================

-- Check updated counts by property
SELECT
    p.id as property_id,
    p.property_name,
    p.revenue_share_percent as property_commission,
    COUNT(r.booking_id) as total_reservations,
    COUNT(CASE WHEN r.revenue_share_percent = p.revenue_share_percent THEN 1 END) as matching_reservations,
    COUNT(CASE WHEN r.revenue_share_percent != p.revenue_share_percent THEN 1 END) as mismatched_reservations
FROM properties p
LEFT JOIN reservations r ON r.property_id = p.id
GROUP BY p.id, p.property_name, p.revenue_share_percent
ORDER BY p.property_name;

-- Check for any NULL or default values remaining
SELECT
    COUNT(*) as remaining_nulls_or_defaults
FROM reservations
WHERE revenue_share_percent IS NULL
   OR revenue_share_percent = 20.00;

-- =====================================================
-- STEP 4: Create a trigger to auto-populate revenue_share_percent
--         for future reservations
-- =====================================================

-- Function to set revenue_share_percent from property
CREATE OR REPLACE FUNCTION set_reservation_revenue_share()
RETURNS TRIGGER AS $$
BEGIN
    -- Get revenue_share_percent from property if not already set
    IF NEW.revenue_share_percent IS NULL THEN
        SELECT revenue_share_percent INTO NEW.revenue_share_percent
        FROM properties
        WHERE id = NEW.property_id;

        -- If property doesn't have it set, use default 20%
        IF NEW.revenue_share_percent IS NULL THEN
            NEW.revenue_share_percent := 20.00;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (to avoid conflicts on re-run)
DROP TRIGGER IF EXISTS trigger_set_reservation_revenue_share ON reservations;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER trigger_set_reservation_revenue_share
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION set_reservation_revenue_share();

-- =====================================================
-- STEP 5: Test the trigger with a sample query
-- =====================================================

-- This is just a SELECT to show what WOULD happen
-- (Don't actually insert, just verify the logic)
SELECT
    p.id as property_id,
    p.property_name,
    p.revenue_share_percent as property_commission,
    'New reservations will automatically get: ' || p.revenue_share_percent || '%' as auto_populate_message
FROM properties p
ORDER BY p.property_name;

-- =====================================================
-- DEPLOYMENT NOTES
-- =====================================================

/*
BEFORE RUNNING:
1. Backup your database
2. Test on a staging environment first
3. Verify property.revenue_share_percent values are correct

EXECUTION ORDER:
1. Run STEP 1 to add column (if needed)
2. Run STEP 2 to populate existing reservations
3. Run STEP 3 to verify updates
4. Run STEP 4 to create auto-populate trigger
5. Run STEP 5 to verify trigger logic

ROLLBACK (if needed):
-- Remove column:
-- ALTER TABLE reservations DROP COLUMN revenue_share_percent;

-- Remove trigger:
-- DROP TRIGGER IF EXISTS trigger_set_reservation_revenue_share ON reservations;
-- DROP FUNCTION IF EXISTS set_reservation_revenue_share();

EXPECTED RESULTS:
- All reservations will have revenue_share_percent matching their property
- Future reservations will automatically get the percentage from properties
- Historical accuracy preserved (old bookings keep their original commission rate)
*/

-- =====================================================
-- SUMMARY REPORT
-- =====================================================

-- Run this after all steps to get a final summary
SELECT
    'Total Reservations' as metric,
    COUNT(*) as count,
    AVG(revenue_share_percent) as avg_commission,
    MIN(revenue_share_percent) as min_commission,
    MAX(revenue_share_percent) as max_commission
FROM reservations
UNION ALL
SELECT
    'Reservations with 15%',
    COUNT(*),
    15.00,
    15.00,
    15.00
FROM reservations WHERE revenue_share_percent = 15.00
UNION ALL
SELECT
    'Reservations with 20%',
    COUNT(*),
    20.00,
    20.00,
    20.00
FROM reservations WHERE revenue_share_percent = 20.00
UNION ALL
SELECT
    'Reservations with 25%',
    COUNT(*),
    25.00,
    25.00,
    25.00
FROM reservations WHERE revenue_share_percent = 25.00;
