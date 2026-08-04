-- ============================================================
-- Verify: can a HOST insert a property through the Flutter path?
-- ============================================================
--
-- The web app writes through /api/db-proxy with the service-role key, which
-- BYPASSES RLS entirely. The Flutter app writes through supabase_flutter with
-- the JWT from /api/auth-exchange, which does NOT. So "it works on the web"
-- says nothing about whether the app can insert a property.
--
-- Three independent things have to be true, and they fail differently:
--   1. RLS is ENABLED on the table    — if not, policies are inert (all allowed)
--   2. The policy EXISTS with a WITH CHECK that permits the row
--   3. The `authenticated` role holds the INSERT grant — RLS sits on top of
--      GRANTs, so a missing grant denies before any policy is consulted
--
-- Read-only except for section D, which inserts inside a transaction it
-- rolls back. Safe to run against production.


-- ------------------------------------------------------------
-- A. Is RLS actually enabled?
-- ------------------------------------------------------------
-- `sql/` never runs ALTER TABLE properties ENABLE ROW LEVEL SECURITY, so if
-- it is on it was switched on in the Supabase dashboard. Confirm, don't assume.
--
-- rls_enabled = false means jwt_properties_write is doing NOTHING and any
-- authenticated user can write any row.

SELECT c.relname                AS table_name,
       c.relrowsecurity         AS rls_enabled,
       c.relforcerowsecurity    AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('properties','rooms','reservations','payments',
                     'team_members','property_owners','guests')
 ORDER BY c.relname;


-- ------------------------------------------------------------
-- B. Do the policies exist, and do they cover INSERT?
-- ------------------------------------------------------------
-- Expect jwt_properties_write with cmd = 'ALL' and a non-null with_check.
--
-- Postgres detail worth knowing: for a FOR ALL policy with USING but no
-- WITH CHECK, the USING expression is reused as the check on INSERT. That is
-- why jwt_rooms_write is still correct despite having no explicit WITH CHECK.

SELECT tablename,
       policyname,
       cmd,
       roles,
       (with_check IS NOT NULL) AS has_explicit_with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('properties','rooms')
 ORDER BY tablename, policyname;


-- ------------------------------------------------------------
-- C. Does `authenticated` hold the grants?
-- ------------------------------------------------------------
-- Expect SELECT, INSERT, UPDATE, DELETE on both tables. A missing INSERT here
-- produces "permission denied for table properties" — a different error from
-- an RLS rejection ("new row violates row-level security policy"), and worth
-- telling apart when debugging.

SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND grantee = 'authenticated'
   AND table_name IN ('properties','rooms')
 ORDER BY table_name, privilege_type;


-- ------------------------------------------------------------
-- D. The real test — insert as a host, then roll back
-- ------------------------------------------------------------
-- Nothing above proves the insert succeeds. This does: it impersonates the
-- exact JWT claims /api/auth-exchange mints for a host and attempts the write.
--
-- Substitute a real host id below. To find one:
--   SELECT id, name, email FROM property_owners
--    WHERE COALESCE(account_type, CASE WHEN is_external THEN 'host' ELSE 'managed' END) = 'host'
--      AND is_active LIMIT 5;

BEGIN;

SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'role',      'authenticated',
        'user_type', 'owner',
        'owner_id',  'PASTE-HOST-ID-HERE',
        'email',     'host@example.com'
    )::text,
    true    -- local to this transaction
);
SET LOCAL ROLE authenticated;

-- Should SUCCEED: owner_id matches the claim.
INSERT INTO properties (id, name, location, type, capacity,
                        revenue_share_percent, is_managed, owner_id)
VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM properties),
        'RLS smoke test', 'Nowhere', 'villa', 2, 0, false,
        'PASTE-HOST-ID-HERE');

-- Should FAIL with "new row violates row-level security policy".
-- Uncomment to confirm the policy actually denies rather than just permits:
-- INSERT INTO properties (id, name, location, type, capacity,
--                         revenue_share_percent, is_managed, owner_id)
-- VALUES ((SELECT COALESCE(MAX(id), 0) + 2 FROM properties),
--         'Should be denied', 'Nowhere', 'villa', 2, 0, false,
--         'SOME-OTHER-OWNER-ID');

RESET ROLE;
ROLLBACK;   -- nothing above is kept


-- ------------------------------------------------------------
-- E. Does properties.id auto-assign?
-- ------------------------------------------------------------
-- Both clients currently compute id as max(id)+1 client-side, which races.
-- column_default non-null (nextval) or is_identity = 'YES' means both could
-- stop sending id at all.

SELECT column_name, data_type, column_default, is_identity, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'properties'
   AND column_name IN ('id','owner_id')
 ORDER BY column_name;
