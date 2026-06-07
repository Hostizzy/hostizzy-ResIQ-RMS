-- Round 8 — JWT-based RLS policies for the Flutter app
--
-- The auth-exchange endpoint mints Supabase JWTs with these claims:
--   role         = 'authenticated'
--   user_type    = 'admin' | 'staff' | 'owner'
--   owner_id     = property_owners.id (UUID, null for staff)
--   app_metadata = { owner_id, user_type }
--
-- Supabase free plan does not allow creating functions in the auth
-- schema, so we inline the JWT claim extraction in each policy.
--
-- Shorthand used throughout:
--   Staff check:    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
--   Owner ID:       current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
--
-- These policies coexist with the older current_setting('app.user_email')
-- policies used by the web proxy. Both paths work simultaneously.

-- ============================================================
-- RESERVATIONS
-- ============================================================

DROP POLICY IF EXISTS "jwt_reservations_select" ON reservations;
CREATE POLICY "jwt_reservations_select" ON reservations
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

DROP POLICY IF EXISTS "jwt_reservations_write" ON reservations;
CREATE POLICY "jwt_reservations_write" ON reservations
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

-- ============================================================
-- PROPERTIES
-- ============================================================

DROP POLICY IF EXISTS "jwt_properties_select" ON properties;
CREATE POLICY "jwt_properties_select" ON properties
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS "jwt_properties_write" ON properties;
CREATE POLICY "jwt_properties_write" ON properties
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

-- ============================================================
-- PAYMENTS
-- ============================================================

DROP POLICY IF EXISTS "jwt_payments_select" ON payments;
CREATE POLICY "jwt_payments_select" ON payments
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  );

DROP POLICY IF EXISTS "jwt_payments_write" ON payments;
CREATE POLICY "jwt_payments_write" ON payments
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  );

-- ============================================================
-- PROPERTY_OWNERS
-- ============================================================

DROP POLICY IF EXISTS "jwt_owners_select" ON property_owners;
CREATE POLICY "jwt_owners_select" ON property_owners
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS "jwt_owners_update" ON property_owners;
CREATE POLICY "jwt_owners_update" ON property_owners
  FOR UPDATE TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

-- ============================================================
-- TEAM_MEMBERS
-- ============================================================

DROP POLICY IF EXISTS "jwt_team_select" ON team_members;
CREATE POLICY "jwt_team_select" ON team_members
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

-- ============================================================
-- PROPERTY_EXPENSES
-- ============================================================

DROP POLICY IF EXISTS "jwt_expenses_select" ON property_expenses;
CREATE POLICY "jwt_expenses_select" ON property_expenses
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

DROP POLICY IF EXISTS "jwt_expenses_write" ON property_expenses;
CREATE POLICY "jwt_expenses_write" ON property_expenses
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

-- ============================================================
-- SETTLEMENT_STATUS
-- ============================================================

DROP POLICY IF EXISTS "jwt_settlements_select" ON settlement_status;
CREATE POLICY "jwt_settlements_select" ON settlement_status
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS "jwt_settlements_write" ON settlement_status;
CREATE POLICY "jwt_settlements_write" ON settlement_status
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

-- ============================================================
-- PAYOUT_REQUESTS
-- ============================================================

DROP POLICY IF EXISTS "jwt_payouts_select" ON payout_requests;
CREATE POLICY "jwt_payouts_select" ON payout_requests
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS "jwt_payouts_write" ON payout_requests;
CREATE POLICY "jwt_payouts_write" ON payout_requests
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

-- ============================================================
-- GUEST_DOCUMENTS
-- ============================================================

DROP POLICY IF EXISTS "jwt_guest_docs_select" ON guest_documents;
CREATE POLICY "jwt_guest_docs_select" ON guest_documents
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  );

DROP POLICY IF EXISTS "jwt_guest_docs_write" ON guest_documents;
CREATE POLICY "jwt_guest_docs_write" ON guest_documents
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  );

-- ============================================================
-- GUEST_MEAL_PREFERENCES
-- ============================================================

DROP POLICY IF EXISTS "jwt_meals_select" ON guest_meal_preferences;
CREATE POLICY "jwt_meals_select" ON guest_meal_preferences
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  );

DROP POLICY IF EXISTS "jwt_meals_write" ON guest_meal_preferences;
CREATE POLICY "jwt_meals_write" ON guest_meal_preferences
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR booking_id IN (
      SELECT booking_id FROM reservations
      WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
      )
    )
  );

-- ============================================================
-- COMMUNICATIONS
-- ============================================================

DROP POLICY IF EXISTS "jwt_communications_all" ON communications;
CREATE POLICY "jwt_communications_all" ON communications
  FOR ALL TO authenticated
  USING (true);

-- ============================================================
-- ENQUIRIES
-- ============================================================

DROP POLICY IF EXISTS "jwt_enquiries_all" ON enquiries;
CREATE POLICY "jwt_enquiries_all" ON enquiries
  FOR ALL TO authenticated
  USING (true);

-- ============================================================
-- REVENUE_TARGETS
-- ============================================================

DROP POLICY IF EXISTS "jwt_targets_select" ON revenue_targets;
CREATE POLICY "jwt_targets_select" ON revenue_targets
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "jwt_targets_write" ON revenue_targets;
CREATE POLICY "jwt_targets_write" ON revenue_targets
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' = 'admin'
  );

-- ============================================================
-- BUSINESS_SETTINGS
-- ============================================================

DROP POLICY IF EXISTS "jwt_settings_select" ON business_settings;
CREATE POLICY "jwt_settings_select" ON business_settings
  FOR SELECT TO authenticated
  USING (
    owner_id IS NULL
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS "jwt_settings_write" ON business_settings;
CREATE POLICY "jwt_settings_write" ON business_settings
  FOR ALL TO authenticated
  USING (
    owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  )
  WITH CHECK (
    owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

-- ============================================================
-- SYNCED_AVAILABILITY
-- ============================================================

DROP POLICY IF EXISTS "jwt_availability_select" ON synced_availability;
CREATE POLICY "jwt_availability_select" ON synced_availability
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );

DROP POLICY IF EXISTS "jwt_availability_write" ON synced_availability;
CREATE POLICY "jwt_availability_write" ON synced_availability
  FOR ALL TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  )
  WITH CHECK (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR property_id IN (
      SELECT id FROM properties WHERE owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
    )
  );
