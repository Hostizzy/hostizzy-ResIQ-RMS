-- ============================================================
-- The last three USING (true) policies, and a helper that lied
-- ============================================================
--
-- Two separate problems, both on the Flutter app's path (authenticated JWT,
-- RLS enforced). The web app reaches Postgres as the service role and does
-- its own scoping in js/db.js, so neither shows up there.
--
-- Safe to re-run.


-- ------------------------------------------------------------
-- 1. resiq_is_super_admin() was checking the role, not the flag
-- ------------------------------------------------------------
-- We split those deliberately: `role` says what someone may DO inside
-- Hostizzy's book, `is_super_admin` says whether they may see OTHER people's
-- businesses. js/db.js honours the split. This function did not — it read
--
--     user_type = 'admin'
--
-- and api/auth-exchange.js derives user_type from the ROLE:
--
--     userType = profile.role === 'admin' ? 'admin' : 'staff'
--
-- So on the app, every role='admin' team member was a super admin: every
-- host's reservations, properties, payments and owner records. Precisely the
-- thing the flag exists to prevent, still open on the path where RLS is the
-- only defence.
--
-- verify.sql passed this because it asserted the policy CALLS the helper, not
-- what the helper means. That check is tightened in the same change.
--
-- auth-exchange already mints is_super_admin as a top-level claim, so this is
-- a one-function fix. A JWT minted before that deploy has no such claim and
-- now resolves to false — fail closed, which for a support-only capability is
-- the right way to fail. Signing in again restores it.
CREATE OR REPLACE FUNCTION resiq_is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb->>'is_super_admin')::boolean,
        false
    );
$$ LANGUAGE sql STABLE;   -- claims only; no table, so no recursion

COMMENT ON FUNCTION resiq_is_super_admin() IS
    'True only for team_members.is_super_admin, carried in the JWT. Deliberately NOT role = admin: role governs what someone may do in Hostizzy''s book, this governs whether they may see other tenants.';


-- ------------------------------------------------------------
-- 2. ENQUIRIES — was USING (true)
-- ------------------------------------------------------------
-- An enquiry with no property_id yet is an unassigned lead off the marketing
-- site. It belongs to Hostizzy, not to a host, so staff keep seeing it —
-- without the NULL branch it would vanish from the inbox entirely, because
-- both resiq_is_hostizzy_property(NULL) and `NULL IN (...)` are false.
DROP POLICY IF EXISTS "jwt_enquiries_all" ON enquiries;

DROP POLICY IF EXISTS "jwt_enquiries_select" ON enquiries;
CREATE POLICY "jwt_enquiries_select" ON enquiries
  FOR SELECT TO authenticated
  USING (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff()
        AND (property_id IS NULL OR resiq_is_hostizzy_property(property_id)))
    OR property_id IN (
      SELECT id FROM properties
       WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

DROP POLICY IF EXISTS "jwt_enquiries_write" ON enquiries;
CREATE POLICY "jwt_enquiries_write" ON enquiries
  FOR ALL TO authenticated
  USING (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff()
        AND (property_id IS NULL OR resiq_is_hostizzy_property(property_id)))
    OR property_id IN (
      SELECT id FROM properties
       WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  )
  WITH CHECK (
    resiq_is_super_admin()
    OR (resiq_is_hostizzy_staff()
        AND (property_id IS NULL OR resiq_is_hostizzy_property(property_id)))
    OR property_id IN (
      SELECT id FROM properties
       WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );


-- ------------------------------------------------------------
-- 3. COMMUNICATIONS — was USING (true)
-- ------------------------------------------------------------
-- "Does this booking exist?" has to be asked WITHOUT RLS, or the answer is
-- really "does it exist as far as you can see" — and a host's booking is
-- invisible to staff, so every host message would read as an unassigned
-- orphan and be handed over. That is the bug this helper exists to avoid; it
-- cost a failing fixture run to find. SECURITY DEFINER with a pinned
-- search_path, returning one boolean and no row contents, same as
-- resiq_is_hostizzy_property().
CREATE OR REPLACE FUNCTION resiq_booking_exists(p_booking_id TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM reservations WHERE booking_id = p_booking_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION resiq_booking_exists(TEXT) IS
    'True when a booking_id exists at all, ignoring RLS. Used to tell a genuinely unassigned record from one whose booking the caller simply may not see.';

-- No property_id on this table; it hangs off booking_id, so the boundary is a
-- two-hop through reservations. That mirrors db._scopedBookingIds() on the
-- web side. A message whose booking_id matches no reservation is
-- Hostizzy's — same reasoning as an unassigned enquiry.
DROP POLICY IF EXISTS "jwt_communications_all" ON communications;

DROP POLICY IF EXISTS "jwt_communications_select" ON communications;
CREATE POLICY "jwt_communications_select" ON communications
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
    OR (resiq_is_hostizzy_staff()
        AND (booking_id IS NULL OR NOT resiq_booking_exists(booking_id)))
  );

DROP POLICY IF EXISTS "jwt_communications_write" ON communications;
CREATE POLICY "jwt_communications_write" ON communications
  FOR ALL TO authenticated
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
    OR (resiq_is_hostizzy_staff()
        AND (booking_id IS NULL OR NOT resiq_booking_exists(booking_id)))
  )
  WITH CHECK (
    resiq_is_super_admin()
    OR booking_id IN (
      SELECT r.booking_id FROM reservations r
       WHERE (resiq_is_hostizzy_staff() AND resiq_is_hostizzy_property(r.property_id))
          OR r.property_id IN (
               SELECT id FROM properties
                WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
             )
    )
    OR (resiq_is_hostizzy_staff() AND booking_id IS NULL)
  );


-- ------------------------------------------------------------
-- 4. REVENUE_TARGETS — was USING (true) for SELECT
-- ------------------------------------------------------------
-- These are Hostizzy's own internal revenue tiers. js/db.js already returns
-- null for any scoped caller and throws on write; a host or an owner has no
-- business reading them at all, and USING (true) handed them over on the app.
DROP POLICY IF EXISTS "jwt_targets_select" ON revenue_targets;
CREATE POLICY "jwt_targets_select" ON revenue_targets
  FOR SELECT TO authenticated
  USING (resiq_is_hostizzy_staff());

-- Write stays with the flag holders rather than anyone whose role reads
-- 'admin', for the same reason as section 1.
DROP POLICY IF EXISTS "jwt_targets_write" ON revenue_targets;
CREATE POLICY "jwt_targets_write" ON revenue_targets
  FOR ALL TO authenticated
  USING (resiq_is_super_admin())
  WITH CHECK (resiq_is_super_admin());


-- ------------------------------------------------------------
-- Report
-- ------------------------------------------------------------
DO $$
DECLARE leftover text;
BEGIN
    SELECT string_agg(tablename || '.' || policyname, ', ') INTO leftover
      FROM pg_policies
     WHERE schemaname = 'public'
       AND 'authenticated' = ANY(roles)
       AND COALESCE(qual, 'true') = 'true';

    IF leftover IS NULL THEN
        RAISE NOTICE 'no unscoped authenticated policies remain';
    ELSE
        RAISE WARNING 'still unscoped: %', leftover;
    END IF;
END $$;
