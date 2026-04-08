-- =====================================================
-- Backfill: hostizzy_revenue
-- =====================================================
-- Purpose:
--   Recompute Hostizzy commission for every active reservation
--   from the property's CURRENT revenue_share_percent. Run this
--   any time the in-app commission formula changes, a property's
--   rate is corrected, or stored values are suspected to drift.
--
-- Formula (matches js/utils.js + js/reservations.js):
--   commission_base = stay_amount - ota_service_fee + extra_guest_charges
--   hostizzy_revenue = ROUND(commission_base * revenue_share_percent / 100, 2)
--
--   meals_chef and bonfire_other are intentionally EXCLUDED from
--   the commission base (per product decision — see plan §Money Model).
--
-- Safety:
--   * Only updates non-cancelled reservations.
--   * Skips reservations whose property has NULL revenue_share_percent
--     (these surface in the audit query at the top — fix the property
--     first, then re-run).
--   * Wrapped in BEGIN; ... COMMIT; for review/rollback.
--   * UPDATE is commented out by default; uncomment after spot-checking
--     the PREVIEW query.
--
-- Run via the Supabase SQL editor (service-role).
-- =====================================================

BEGIN;

-- ----------------------------------------------------
-- 1. AUDIT: properties missing a revenue_share_percent
-- ----------------------------------------------------
-- Surface these to the user. They will be skipped by the UPDATE.
SELECT
    p.id AS property_id,
    p.name AS property_name,
    COUNT(r.id) AS affected_reservations
FROM properties p
LEFT JOIN reservations r
    ON r.property_id = p.id
   AND r.status <> 'cancelled'
WHERE p.revenue_share_percent IS NULL
GROUP BY p.id, p.name
ORDER BY affected_reservations DESC;

-- ----------------------------------------------------
-- 2. PREVIEW: rows where stored hostizzy_revenue drifts
--             from the canonical formula (delta > ₹0.01).
--             Spot-check 5–10 of these before running UPDATE.
-- ----------------------------------------------------
SELECT
    r.booking_id,
    r.property_name,
    r.check_in,
    r.status,
    p.revenue_share_percent AS rate,
    r.stay_amount,
    r.ota_service_fee,
    r.extra_guest_charges,
    r.hostizzy_revenue AS old_hostizzy_revenue,
    ROUND(
        ( COALESCE(r.stay_amount, 0)
        - COALESCE(r.ota_service_fee, 0)
        + COALESCE(r.extra_guest_charges, 0)
        ) * (p.revenue_share_percent / 100.0)
    , 2) AS new_hostizzy_revenue,
    ROUND(
        ROUND(
            ( COALESCE(r.stay_amount, 0)
            - COALESCE(r.ota_service_fee, 0)
            + COALESCE(r.extra_guest_charges, 0)
            ) * (p.revenue_share_percent / 100.0)
        , 2)
        - COALESCE(r.hostizzy_revenue, 0)
    , 2) AS delta
FROM reservations r
JOIN properties p ON p.id = r.property_id
WHERE r.status <> 'cancelled'
  AND p.revenue_share_percent IS NOT NULL
  AND ABS(
        COALESCE(r.hostizzy_revenue, 0)
      - ROUND(
            ( COALESCE(r.stay_amount, 0)
            - COALESCE(r.ota_service_fee, 0)
            + COALESCE(r.extra_guest_charges, 0)
            ) * (p.revenue_share_percent / 100.0)
        , 2)
    ) > 0.01
ORDER BY r.check_in DESC
LIMIT 50;

-- ----------------------------------------------------
-- 3. UPDATE: recompute hostizzy_revenue for every
--            active reservation. Uncomment to apply.
-- ----------------------------------------------------
-- UPDATE reservations r
-- SET hostizzy_revenue = ROUND(
--         ( COALESCE(r.stay_amount, 0)
--         - COALESCE(r.ota_service_fee, 0)
--         + COALESCE(r.extra_guest_charges, 0)
--         ) * (p.revenue_share_percent / 100.0)
--     , 2)
-- FROM properties p
-- WHERE r.property_id = p.id
--   AND p.revenue_share_percent IS NOT NULL
--   AND r.status <> 'cancelled';

-- ----------------------------------------------------
-- 4. POST-UPDATE VERIFICATION:
--    per-property commission totals after the rewrite.
-- ----------------------------------------------------
-- SELECT
--     property_name,
--     COUNT(*) AS bookings,
--     ROUND(SUM(hostizzy_revenue), 2) AS total_commission
-- FROM reservations
-- WHERE status <> 'cancelled'
-- GROUP BY property_name
-- ORDER BY total_commission DESC;

COMMIT;
-- ROLLBACK;  -- use this instead of COMMIT if anything looks wrong
