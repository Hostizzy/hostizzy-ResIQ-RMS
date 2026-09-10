-- ============================================================
-- Make properties.owner_id the single source of truth
-- ============================================================
--
-- There were two records of which properties an owner has:
--
--   properties.owner_id                 read by db.initScope(), by
--                                       auth-exchange when it mints the JWT,
--                                       and by all 37 jwt_* RLS policies
--   property_owners.property_ids        read by the owner portal, the Managed
--                                       Owners table and api/ai-chat
--
-- Only the SECOND was ever written. Team → Add Owner set the array and never
-- touched properties.owner_id. So a managed owner appeared to have properties
-- in the staff table, and saw nothing in the portal and nothing in the Android
-- app, because those read the column that was still NULL.
--
-- The code now writes and reads properties.owner_id everywhere. This backfills
-- the existing rows from the arrays.
--
-- Run section 1 and READ IT before running section 2.

-- ------------------------------------------------------------
-- 1. Conflicts — must be resolved by hand first
-- ------------------------------------------------------------
-- A property listed in two owners' arrays cannot be backfilled: owner_id holds
-- one value and picking a winner silently would hand someone else's property,
-- bookings and revenue to the wrong person. Expect zero rows.

SELECT p.id AS property_id,
       p.name AS property,
       string_agg(o.name || ' <' || o.email || '>', '  |  ') AS claimed_by,
       count(*) AS claim_count
  FROM properties p
  JOIN property_owners o ON p.id = ANY (o.property_ids)
 GROUP BY p.id, p.name
HAVING count(*) > 1
 ORDER BY p.name;

-- Also worth reading: properties whose array claim disagrees with an owner_id
-- that is ALREADY set. The array loses, but you should know before it does.

SELECT p.id AS property_id,
       p.name AS property,
       cur.name  AS current_owner_id_says,
       arr.name  AS array_says
  FROM properties p
  JOIN property_owners arr ON p.id = ANY (arr.property_ids)
  JOIN property_owners cur ON cur.id = p.owner_id
 WHERE p.owner_id IS DISTINCT FROM arr.id
 ORDER BY p.name;


-- ------------------------------------------------------------
-- 2. Backfill
-- ------------------------------------------------------------
-- Only fills properties whose owner_id is NULL, and only from an unambiguous
-- single claim. Never overwrites an owner_id that is already set — if the two
-- disagree, the column wins and the query above told you where.

BEGIN;

WITH single_claim AS (
    SELECT p.id AS property_id, min(o.id::text)::uuid AS owner_id
      FROM properties p
      JOIN property_owners o ON p.id = ANY (o.property_ids)
     WHERE p.owner_id IS NULL
     GROUP BY p.id
    HAVING count(*) = 1
)
UPDATE properties p
   SET owner_id = sc.owner_id
  FROM single_claim sc
 WHERE p.id = sc.property_id;

COMMIT;


-- ------------------------------------------------------------
-- 3. Verify
-- ------------------------------------------------------------
-- Every managed owner and their property count from BOTH sources. Once the
-- backfill is right these two columns agree on every row; any line where they
-- differ is either a conflict from section 1 or a property that no owner
-- claimed.

SELECT o.name,
       o.email,
       COALESCE(o.account_type, CASE WHEN o.is_external THEN 'host' ELSE 'managed' END) AS type,
       (SELECT count(*) FROM properties p WHERE p.owner_id = o.id) AS by_owner_id,
       COALESCE(array_length(o.property_ids, 1), 0)                AS by_array
  FROM property_owners o
 ORDER BY type, o.name;

-- Properties nobody owns. Fine for Hostizzy's own stock, a problem for
-- anything that should be showing up in someone's portal.
SELECT id, name FROM properties WHERE owner_id IS NULL ORDER BY name;


-- ============================================================
-- AFTERWARDS
-- ============================================================
-- property_ids is still written by Team → Add Owner as a mirror, so nothing
-- unmigrated breaks, and sql/verify.sql now fails if the two ever disagree.
-- Once that check has stayed green for a release:
--
--   ALTER TABLE property_owners DROP COLUMN property_ids;
--
-- Note the JWT also carries a property_ids claim (api/auth-exchange.js). That
-- one is derived from properties.owner_id and is unrelated to this column —
-- leave it alone.
