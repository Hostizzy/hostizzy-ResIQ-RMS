-- ============================================================
-- Hostizzy staff no longer see self-signup hosts' data
-- ============================================================
--
-- Every jwt_* policy currently reads:
--
--     user_type IN ('admin','staff')   OR   <the owner's own rows>
--
-- so anyone on the Hostizzy team sees everything, including the bookings,
-- guests, payments and KYC of people who signed up to run their own property.
-- A host's guests never agreed to appear in Hostizzy's operational views.
--
-- This narrows 'staff' to Hostizzy's own book — properties with no owner, plus
-- managed owners' properties — and leaves 'admin' unrestricted for support.
--
-- The web app enforces the same boundary in js/db.js. It has to be done in both
-- places: the browser talks to Postgres as the SERVICE ROLE through
-- /api/db-proxy, where RLS is bypassed entirely, while the Flutter app
-- authenticates as `authenticated` and only RLS applies. Fixing one leaves the
-- other wide open.
--
-- Requires sql/account-type-and-host-profiles.sql (uses account_type).

BEGIN;

-- ------------------------------------------------------------
-- A property that is Hostizzy's own business
-- ------------------------------------------------------------
-- STABLE so the planner can cache it within a statement. A NULL owner_id is
-- deliberately included: unassigned stock is Hostizzy's, and `NOT IN` against
-- a NULL would silently drop it.
--
-- SECURITY DEFINER is required, not incidental. This function reads properties
-- and property_owners, and the policy ON properties calls this function — so
-- without it Postgres recurses until "stack depth limit exceeded". Running as
-- the definer means the lookup bypasses RLS.
--
-- Safe because of what it returns: one boolean about one property id, and no
-- row contents. search_path is pinned so a schema planted ahead of public
-- cannot substitute a different `properties`.
CREATE OR REPLACE FUNCTION resiq_is_hostizzy_property(p_property_id INT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
          FROM properties p
     LEFT JOIN property_owners o ON o.id = p.owner_id
         WHERE p.id = p_property_id
           AND (
                 p.owner_id IS NULL
              OR COALESCE(o.account_type,
                          CASE WHEN o.is_external THEN 'host' ELSE 'managed' END) <> 'host'
           )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION resiq_is_hostizzy_property(INT) IS
    'True when a property is unowned or belongs to a managed owner — i.e. it is Hostizzy''s own book, not a self-signup host''s.';

-- ------------------------------------------------------------
-- The staff predicate, in one place
-- ------------------------------------------------------------
-- Reads the JWT rather than taking a parameter, so a policy can call it bare.
CREATE OR REPLACE FUNCTION resiq_is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT current_setting('request.jwt.claims', true)::jsonb->>'user_type' = 'admin';
$$ LANGUAGE sql STABLE;   -- reads the claims only; no table, so no recursion

CREATE OR REPLACE FUNCTION resiq_is_hostizzy_staff()
RETURNS BOOLEAN AS $$
    SELECT current_setting('request.jwt.claims', true)::jsonb->>'user_type' IN ('admin','staff');
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------
-- RESERVATIONS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "jwt_reservations_select" ON reservations;
CREATE POLICY "jwt_reservations_select" ON reservations
  FOR SELECT TO authenticated
  USING (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(property_id))
    OR property_id IN (
      SELECT id FROM properties
       WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

DROP POLICY IF EXISTS "jwt_reservations_write" ON reservations;
CREATE POLICY "jwt_reservations_write" ON reservations
  FOR ALL TO authenticated
  USING (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(property_id))
    OR property_id IN (
      SELECT id FROM properties
       WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  )
  WITH CHECK (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(property_id))
    OR property_id IN (
      SELECT id FROM properties
       WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

-- ------------------------------------------------------------
-- PROPERTIES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "jwt_properties_select" ON properties;
CREATE POLICY "jwt_properties_select" ON properties
  FOR SELECT TO authenticated
  USING (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(id))
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS "jwt_properties_write" ON properties;
CREATE POLICY "jwt_properties_write" ON properties
  FOR ALL TO authenticated
  USING (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(id))
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  )
  WITH CHECK (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(id))
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

-- ------------------------------------------------------------
-- PAYMENTS — hang off a reservation by booking_id
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "jwt_payments_select" ON payments;
CREATE POLICY "jwt_payments_select" ON payments
  FOR SELECT TO authenticated
  USING (
    resiq_is_super_admin()
    OR booking_id IN (
      SELECT r.booking_id FROM reservations r
       WHERE (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(r.property_id))
          OR r.property_id IN (
               SELECT id FROM properties
                WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
             )
    )
  );

-- ------------------------------------------------------------
-- PROPERTY OWNERS — the directory
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "jwt_owners_select" ON property_owners;
CREATE POLICY "jwt_owners_select" ON property_owners
  FOR SELECT TO authenticated
  USING (
    resiq_is_super_admin()
    OR (
      resiq_is_hostizzy_staff()
      AND COALESCE(account_type, CASE WHEN is_external THEN 'host' ELSE 'managed' END) <> 'host'
    )
    OR id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

COMMIT;


-- ------------------------------------------------------------
-- Verify — simulate each role and count what it can reach
-- ------------------------------------------------------------
-- Rolls back. Expect: staff see fewer reservations than admin, by exactly the
-- number belonging to hosts.

BEGIN;

SELECT set_config('request.jwt.claims',
    '{"role":"authenticated","user_type":"staff","owner_id":null}', true);
SET LOCAL ROLE authenticated;
SELECT 'staff' AS acting_as, count(*) AS reservations_visible FROM reservations;
RESET ROLE;

SELECT set_config('request.jwt.claims',
    '{"role":"authenticated","user_type":"admin","owner_id":null}', true);
SET LOCAL ROLE authenticated;
SELECT 'super admin' AS acting_as, count(*) AS reservations_visible FROM reservations;
RESET ROLE;

-- Ground truth, as the session user.
SELECT 'total' AS acting_as, count(*) AS reservations_visible FROM reservations;

SELECT 'belongs to a host' AS acting_as, count(*) AS reservations_visible
  FROM reservations r
  JOIN properties p ON p.id = r.property_id
  JOIN property_owners o ON o.id = p.owner_id
 WHERE COALESCE(o.account_type, CASE WHEN o.is_external THEN 'host' ELSE 'managed' END) = 'host';

ROLLBACK;

-- staff + belongs-to-a-host should equal total. If it does not, a property has
-- no owner row (fine — counts as Hostizzy's) or an owner's account_type is
-- wrong; sql/verify.sql flags the latter.


-- ============================================================
-- NOTE FOR THE APP TEAM
-- ============================================================
-- 'staff' is now a narrower scope than it was. A Flutter build that assumed
-- staff see every property will now get fewer rows — that is the fix, not a
-- regression. Only user_type 'admin' is unrestricted.
--
-- auth-exchange already mints user_type 'admin' for team_members.role = 'admin'
-- and 'staff' for everyone else, so nothing needs to change there.
