-- ============================================================
-- Fix: every signup lands as a managed owner instead of a host
-- ============================================================
--
-- What went wrong
-- ---------------
-- account-type-and-host-profiles.sql did two things that fight each other:
--
--     ALTER COLUMN account_type SET DEFAULT 'managed';
--
--     ... and a BEFORE INSERT trigger whose second branch reads
--         ELSIF NEW.is_external IS NOT NULL THEN
--             NEW.account_type := CASE WHEN NEW.is_external THEN 'host' ... END;
--
-- Postgres applies column DEFAULTs BEFORE a BEFORE-INSERT trigger sees NEW. So
-- on an insert that supplies only is_external, NEW.account_type is already
-- 'managed' — never NULL — and the trigger takes its FIRST branch instead:
--
--     NEW.is_external := (NEW.account_type = 'host');   -- 'managed' → false
--
-- The default silently overwrites the caller's is_external. The is_external →
-- account_type direction is unreachable on INSERT, which is exactly the
-- direction api/owner-signup.js and js/team.js rely on.
--
-- Reproduced and fixed against a scratch Postgres before writing this.
--
-- The fix is to drop the default. The trigger's final ELSE branch already sets
-- 'managed'/false when neither column is supplied, so the default was both
-- redundant and harmful.

BEGIN;

ALTER TABLE property_owners ALTER COLUMN account_type DROP DEFAULT;

-- ------------------------------------------------------------
-- Repair rows the default already mislabelled
-- ------------------------------------------------------------
-- Only rows that look like a self-signup: pending or rejected status is
-- something only the host flow produces. A managed owner is created by staff
-- and never carries those.
UPDATE property_owners
   SET account_type = 'host',
       is_external  = true
 WHERE COALESCE(account_type, 'managed') = 'managed'
   AND status IN ('pending', 'rejected');

COMMIT;


-- ------------------------------------------------------------
-- Check the result
-- ------------------------------------------------------------
-- Any signup that has already been APPROVED before this fix will still read as
-- managed, because an approved host and a managed owner are indistinguishable
-- once status is 'approved'. Look at this list and fix those by hand.

SELECT name, email, account_type, is_external, status, is_active, created_at
  FROM property_owners
 ORDER BY created_at DESC;

-- To correct one by hand:
--   UPDATE property_owners SET account_type = 'host'
--    WHERE email = 'testhost@example.com';
-- The trigger sets is_external to match, so only one column needs writing.


-- ------------------------------------------------------------
-- Confirm the default is gone
-- ------------------------------------------------------------
SELECT column_name,
       COALESCE(column_default, 'no default') AS column_default,
       CASE WHEN column_default IS NULL
            THEN 'OK — the trigger can now derive from is_external'
            ELSE 'STILL SET — signups will keep landing as managed' END AS verdict
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'property_owners'
   AND column_name = 'account_type';
