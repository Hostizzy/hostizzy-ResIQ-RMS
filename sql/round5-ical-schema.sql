-- =====================================================
-- Round 5 — iCal import rewrite: schema additions
-- =====================================================
-- Adds the columns the new parser + diff-based sync need:
--
--   ical_uid            : FULL iCal UID (no truncation). Used as the
--                         diff key for cancellation detection. Separate
--                         from booking_id so the OTA email can later
--                         overwrite booking_id with the human-readable
--                         confirmation code while keeping the sync key.
--
--   ical_last_modified  : LAST-MODIFIED from the feed. Lets future syncs
--                         detect "OTA changed the dates" without
--                         comparing every field.
--
--   ical_classification : 'booked' | 'blocked' | null.
--                         'blocked' marks owner/maintenance blocks so
--                         they don't trigger guest workflows.
--
-- All three columns are nullable so existing rows are unaffected.
-- Index is partial (WHERE ical_uid IS NOT NULL) so it stays small.
--
-- Run via the Supabase SQL editor (service-role). Idempotent.
-- =====================================================

BEGIN;

-- --------------------------------------------------
-- 1. ADD COLUMNS
-- --------------------------------------------------
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS ical_uid TEXT,
    ADD COLUMN IF NOT EXISTS ical_last_modified TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ical_classification TEXT;

-- --------------------------------------------------
-- 2. INDEX on ical_uid for fast diff lookups.
--    Partial index so only iCal-sourced rows take space.
-- --------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reservations_ical_uid
    ON reservations (property_id, ical_uid)
    WHERE ical_uid IS NOT NULL;

-- --------------------------------------------------
-- 3. BACKFILL: existing iCal-imported rows set booking_id
--    to the UID. Copy booking_id → ical_uid for any row
--    that looks like it came from an iCal import (has a
--    UID-shaped booking_id) so the first post-deploy sync
--    can match them by ical_uid instead of creating
--    duplicates and marking the originals cancelled.
--
--    Heuristic: if booking_id contains '@' (like
--    airbnb-xxx@airbnb.com) OR starts with 'synthetic-',
--    treat it as an iCal UID.
-- --------------------------------------------------
UPDATE reservations
SET ical_uid = booking_id
WHERE ical_uid IS NULL
  AND status <> 'cancelled'
  AND (
        booking_id LIKE '%@%'
        OR booking_id LIKE 'synthetic-%'
  );

-- --------------------------------------------------
-- 4. VERIFICATION
-- --------------------------------------------------
SELECT COUNT(*) AS rows_with_ical_uid FROM reservations WHERE ical_uid IS NOT NULL;

-- Should return 0 — every ical_uid must be unique per property
-- (per-property because two properties could theoretically share a UID
-- string in pathological cases, though we've never seen it).
SELECT property_id, ical_uid, COUNT(*) AS dupes
FROM reservations
WHERE ical_uid IS NOT NULL
GROUP BY property_id, ical_uid
HAVING COUNT(*) > 1;

COMMIT;
-- ROLLBACK;  -- replace COMMIT above if the dupes query returns rows
