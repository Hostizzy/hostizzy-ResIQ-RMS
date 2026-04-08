-- =====================================================
-- One-shot fix: backfill reservation rate, commission, and payouts
-- =====================================================
-- Purpose:
--   Single SQL that corrects everything in one transaction:
--     (1) Sync reservations.revenue_share_percent from properties
--     (2) Recompute hostizzy_revenue from the canonical formula
--     (3) Recompute payout_eligible (gross owner-eligible) and
--         host_payout (net to owner after commission)
--   Then surface verification counts and per-property totals.
--
-- Replaces the previous preview-gated scripts:
--   * sql/backfill-hostizzy-revenue.sql  (deleted)
--   * sql/backfill-payout-eligible.sql   (deleted)
--
-- Formulas (match js/utils.js + js/reservations.js):
--   commission_base  = stay_amount - ota_service_fee + extra_guest_charges
--   hostizzy_revenue = ROUND(commission_base * rate / 100, 2)
--   payout_eligible  = ROUND(total_amount - taxes - ota_service_fee, 2)
--                      (gross owner-eligible — before commission)
--   host_payout      = ROUND(payout_eligible - hostizzy_revenue, 2)
--                    = ROUND(total_amount - taxes - ota_service_fee
--                             - hostizzy_revenue, 2)
--                      (NET rupees Hostizzy pays the owner after commission)
--
-- Active reservations only — cancelled rows are skipped (their financial
-- fields are nulled by the JS cleanup at js/reservations.js:1869+).
--
-- Properties without a revenue_share_percent are skipped by steps 1 and 2
-- (cannot compute commission). Step 0 lists them so the operator knows
-- which property settings to fix; step 4b counts the residual rows so the
-- operator can confirm the skip count matches expectation. Step 3 (payouts)
-- does NOT depend on the rate, so it still runs for those rows.
--
-- Wrapped in BEGIN; ... COMMIT; for atomicity. If the post-update
-- verification surprises you, replace COMMIT; with ROLLBACK; at the bottom
-- and re-run.
--
-- Run via the Supabase SQL editor (service-role).
-- =====================================================

BEGIN;

-- ----------------------------------------------------
-- 0. AUDIT: properties missing a revenue_share_percent.
--    Active reservations on these properties CANNOT have
--    their commission corrected until the property's rate
--    is set. They are skipped by steps 1 and 2 below.
-- ----------------------------------------------------
SELECT
    p.id AS property_id,
    p.name AS property_name,
    COUNT(r.id) FILTER (WHERE r.status <> 'cancelled') AS active_reservations
FROM properties p
LEFT JOIN reservations r ON r.property_id = p.id
WHERE p.revenue_share_percent IS NULL
GROUP BY p.id, p.name
ORDER BY active_reservations DESC;

-- ----------------------------------------------------
-- 1. SYNC reservations.revenue_share_percent
--    from the canonical properties.revenue_share_percent.
--    Idempotent via IS DISTINCT FROM — only rows actually
--    out of sync are touched.
-- ----------------------------------------------------
UPDATE reservations r
SET revenue_share_percent = p.revenue_share_percent
FROM properties p
WHERE r.property_id = p.id
  AND p.revenue_share_percent IS NOT NULL
  AND r.status <> 'cancelled'
  AND (r.revenue_share_percent IS DISTINCT FROM p.revenue_share_percent);

-- ----------------------------------------------------
-- 2. RECOMPUTE hostizzy_revenue using the canonical
--    formula: (stay - ota_fee + extras) * rate / 100.
--    Joins to properties so we always read the canonical
--    rate, regardless of whether step 1 touched the row.
-- ----------------------------------------------------
UPDATE reservations r
SET hostizzy_revenue = ROUND(
        ( COALESCE(r.stay_amount, 0)
        - COALESCE(r.ota_service_fee, 0)
        + COALESCE(r.extra_guest_charges, 0)
        ) * (p.revenue_share_percent / 100.0)
    , 2)
FROM properties p
WHERE r.property_id = p.id
  AND p.revenue_share_percent IS NOT NULL
  AND r.status <> 'cancelled';

-- ----------------------------------------------------
-- 3. RECOMPUTE payout_eligible and host_payout.
--    payout_eligible = gross owner-eligible (before commission)
--                    = total_amount - taxes - ota_service_fee
--    host_payout     = NET rupees paid to owner (after commission)
--                    = payout_eligible - hostizzy_revenue
--
--    Must run AFTER step 2 so hostizzy_revenue on the row is
--    already canonical. Cancelled rows are skipped.
-- ----------------------------------------------------
UPDATE reservations
SET payout_eligible = ROUND(
        COALESCE(total_amount, 0)
      - COALESCE(taxes, 0)
      - COALESCE(ota_service_fee, 0)
    , 2),
    host_payout = ROUND(
        COALESCE(total_amount, 0)
      - COALESCE(taxes, 0)
      - COALESCE(ota_service_fee, 0)
      - COALESCE(hostizzy_revenue, 0)
    , 2)
WHERE status <> 'cancelled';

-- ----------------------------------------------------
-- 4. POST-UPDATE VERIFICATION
-- ----------------------------------------------------

-- 4a. Reservations whose stored rate is still drifted from
--     their property. Expected: 0 (any non-zero result is a bug).
SELECT COUNT(*) AS rows_with_drifted_rate
FROM reservations r
JOIN properties p ON p.id = r.property_id
WHERE r.status <> 'cancelled'
  AND p.revenue_share_percent IS NOT NULL
  AND r.revenue_share_percent IS DISTINCT FROM p.revenue_share_percent;

-- 4b. Reservations skipped because their property has no rate.
--     Should equal the SUM(active_reservations) from step 0.
SELECT COUNT(*) AS rows_skipped_missing_rate
FROM reservations r
JOIN properties p ON p.id = r.property_id
WHERE r.status <> 'cancelled'
  AND p.revenue_share_percent IS NULL;

-- 4c. Identity check: host_payout must equal
--     payout_eligible - hostizzy_revenue for every active row.
--     Expected: 0 (any non-zero result is a round-4 bug).
SELECT COUNT(*) AS rows_with_drifted_host_payout
FROM reservations
WHERE status <> 'cancelled'
  AND ROUND(
          COALESCE(payout_eligible, 0)
        - COALESCE(hostizzy_revenue, 0)
      , 2)
      IS DISTINCT FROM ROUND(COALESCE(host_payout, 0), 2);

-- 4d. Per-property totals after the rewrite. Sanity-check
--     these against the owner dashboard / settlement view.
--     total_host_payout is the new "net to owner" figure.
SELECT
    property_name,
    COUNT(*) AS bookings,
    ROUND(SUM(hostizzy_revenue), 2) AS total_commission,
    ROUND(SUM(payout_eligible), 2) AS total_payout_eligible,
    ROUND(SUM(host_payout), 2) AS total_host_payout,
    ROUND(SUM(taxes), 2) AS total_taxes_excluded
FROM reservations
WHERE status <> 'cancelled'
GROUP BY property_name
ORDER BY total_commission DESC;

COMMIT;
-- ROLLBACK;  -- replace COMMIT above if anything looks wrong
