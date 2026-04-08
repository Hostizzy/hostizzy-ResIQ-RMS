-- =====================================================
-- RPC: resync_property_commissions(p_property_id INT)
-- =====================================================
-- Purpose:
--   Atomically refresh stored commission state for every
--   active reservation belonging to a single property.
--
--   Called from js/properties.js saveSettings() whenever
--   a property's revenue_share_percent is edited, so that
--   existing reservations don't drift away from the new rate.
--
-- What it does (single transaction, server-side):
--   1. Reads the property's current revenue_share_percent.
--   2. Errors if the rate is NULL (matches the JS "no silent
--      default" rule from db.js getRevenueSharePercent).
--   3. UPDATEs every non-cancelled reservation on this property:
--        - revenue_share_percent  ← property rate
--        - hostizzy_revenue       ← (stay - ota_fee + extras) * rate / 100
--   4. Returns the number of rows touched, so the caller can
--      surface "Resynced N reservation(s)…" in a toast.
--
-- Formula matches js/utils.js + js/reservations.js:
--   commission_base = stay_amount - ota_service_fee + extra_guest_charges
--   meals_chef and bonfire_other are intentionally excluded.
--
-- Safety:
--   * Skips r.status = 'cancelled' (those rows have NULL money fields
--     by design — see js/reservations.js cancellation cleanup).
--   * Single UPDATE statement → atomic; all rows for the property
--     change together or none do.
--   * RAISE EXCEPTION on missing rate so the JS layer can show an
--     error toast and refuse to claim a successful resync.
--
-- Deploy: run this file once in the Supabase SQL editor (service-role).
--         Re-running is safe — CREATE OR REPLACE.
-- =====================================================

CREATE OR REPLACE FUNCTION resync_property_commissions(p_property_id INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_rate NUMERIC;
    v_count INT;
BEGIN
    SELECT revenue_share_percent
      INTO v_rate
      FROM properties
     WHERE id = p_property_id;

    IF v_rate IS NULL THEN
        RAISE EXCEPTION
            'Property % has no revenue_share_percent set; cannot resync',
            p_property_id;
    END IF;

    UPDATE reservations
       SET revenue_share_percent = v_rate,
           hostizzy_revenue = ROUND(
               ( COALESCE(stay_amount, 0)
               - COALESCE(ota_service_fee, 0)
               + COALESCE(extra_guest_charges, 0)
               ) * (v_rate / 100.0)
           , 2)
     WHERE property_id = p_property_id
       AND status <> 'cancelled';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =====================================================
-- Verification (optional — run after deploy)
-- =====================================================
-- 1. Confirm the function was created:
-- SELECT proname, pronargs
--   FROM pg_proc
--  WHERE proname = 'resync_property_commissions';
-- -- Expected: 1 row, pronargs = 1

-- 2. Smoke-test against a known property:
-- SELECT resync_property_commissions(<your_property_id>);
-- -- Returns the number of reservations updated.

-- 3. Confirm none of that property's active reservations
--    are still out of sync:
-- SELECT COUNT(*) AS rows_out_of_sync
--   FROM reservations r
--   JOIN properties p ON p.id = r.property_id
--  WHERE r.property_id = <your_property_id>
--    AND r.status <> 'cancelled'
--    AND r.revenue_share_percent IS DISTINCT FROM p.revenue_share_percent;
-- -- Expected: 0
