-- =====================================================
-- Backfill: payout_eligible / host_payout
-- =====================================================
-- Purpose:
--   Recompute owner-payout fields so taxes are excluded.
--
--   Prior to the JS fix at js/reservations.js:1852-1853, both
--   payout_eligible and host_payout were stored as
--       total_amount - ota_service_fee
--   which incorrectly included GST taxes in the owner's share.
--
--   The corrected formula (matches the in-app save path) is:
--       payout_eligible = stay + extras + meals + bonfire + damages - ota_fee
--                       = total_amount - taxes - ota_service_fee
--
--   This script rewrites the stored values for every existing
--   reservation so historical settlement and dashboards reflect
--   the corrected formula.
--
-- Safety:
--   * Only updates non-cancelled reservations.
--   * Wrapped in BEGIN; ... COMMIT; for review/rollback.
--   * UPDATE is commented out by default; uncomment after spot-checking
--     the PREVIEW query.
--
-- Run AFTER deploying the JS fix, otherwise newly-saved reservations
-- will continue to write the buggy value and re-introduce drift.
-- =====================================================

BEGIN;

-- ----------------------------------------------------
-- 1. PREVIEW: rows where stored payout_eligible drifts
--             from the corrected formula (delta > ₹0.01).
--             Spot-check 5–10 of these before running UPDATE.
-- ----------------------------------------------------
SELECT
    booking_id,
    property_name,
    check_in,
    status,
    total_amount,
    taxes,
    ota_service_fee,
    payout_eligible AS old_payout_eligible,
    ROUND(
        COALESCE(total_amount, 0)
      - COALESCE(taxes, 0)
      - COALESCE(ota_service_fee, 0)
    , 2) AS new_payout_eligible,
    ROUND(
        ROUND(
            COALESCE(total_amount, 0)
          - COALESCE(taxes, 0)
          - COALESCE(ota_service_fee, 0)
        , 2)
        - COALESCE(payout_eligible, 0)
    , 2) AS delta
FROM reservations
WHERE status <> 'cancelled'
  AND ABS(
        COALESCE(payout_eligible, 0)
      - ROUND(
            COALESCE(total_amount, 0)
          - COALESCE(taxes, 0)
          - COALESCE(ota_service_fee, 0)
        , 2)
    ) > 0.01
ORDER BY check_in DESC
LIMIT 50;

-- ----------------------------------------------------
-- 2. UPDATE: rewrite payout_eligible and host_payout.
--            Uncomment to apply.
-- ----------------------------------------------------
-- UPDATE reservations
-- SET payout_eligible = ROUND(
--         COALESCE(total_amount, 0)
--       - COALESCE(taxes, 0)
--       - COALESCE(ota_service_fee, 0)
--     , 2),
--     host_payout = ROUND(
--         COALESCE(total_amount, 0)
--       - COALESCE(taxes, 0)
--       - COALESCE(ota_service_fee, 0)
--     , 2)
-- WHERE status <> 'cancelled';

-- ----------------------------------------------------
-- 3. POST-UPDATE VERIFICATION:
--    payout totals per property after the rewrite.
-- ----------------------------------------------------
-- SELECT
--     property_name,
--     COUNT(*) AS bookings,
--     ROUND(SUM(payout_eligible), 2) AS total_payout_eligible,
--     ROUND(SUM(taxes), 2) AS total_taxes_excluded
-- FROM reservations
-- WHERE status <> 'cancelled'
-- GROUP BY property_name
-- ORDER BY total_payout_eligible DESC;

COMMIT;
-- ROLLBACK;  -- use this instead of COMMIT if anything looks wrong
