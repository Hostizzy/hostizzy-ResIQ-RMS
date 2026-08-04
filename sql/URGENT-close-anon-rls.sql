-- ============================================================
-- URGENT — the database is currently readable and writable by anyone
-- ============================================================
--
-- What was found
-- --------------
-- https://resiq.hostizzy.com/api/config is a public, unauthenticated GET that
-- returns supabaseUrl and supabaseAnonKey. That is by design — the anon key is
-- meant to be public, because RLS is supposed to be what protects the data.
--
-- RLS is not protecting the data. Every core table carries a legacy policy
-- granting unrestricted access to {anon} or {public}:
--
--   property_owners   anon SELECT/INSERT/UPDATE/DELETE, unrestricted
--   reservations      anon + public, read and write, unrestricted
--   properties        anon + public, read and write, unrestricted
--   payments          public ALL, unrestricted
--   team_members      public ALL, unrestricted
--   payout_requests   anon INSERT/UPDATE/DELETE, unrestricted
--   guest_documents   public INSERT/SELECT/UPDATE  (KYC — Aadhaar, passports)
--   guest_meal_preferences, guest_portal_sessions, synced_availability,
--   communications, enquiries — same shape
--
-- Note that `{public}` in pg_policies means EVERY role, including anon. Several
-- of these are named "Authenticated users can ..." and are not restricted to
-- authenticated users at all.
--
-- Confirmed exploitable: fetching the anon key from /api/config and querying
-- PostgREST directly returned HTTP 206 with row counts for property_owners,
-- reservations, team_members, guest_documents and payments. No rows were
-- retrieved — the check requested counts only.
--
-- The anon key does NOT need rotating. It is public by design and harmless
-- once RLS is correct. The fix is entirely below.
--
-- ------------------------------------------------------------
-- BEFORE RUNNING: one thing to check
-- ------------------------------------------------------------
-- api/db-proxy.js falls back:
--     SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || VITE_SUPABASE_ANON_KEY
--
-- On the service-role key it bypasses RLS and none of this affects the web app
-- or the guest portal. On an anon-key fallback these blanket policies are the
-- only reason the site works, and dropping them takes it down.
--
-- Confirm SUPABASE_SERVICE_ROLE_KEY is set in Vercel → Project → Settings →
-- Environment Variables (Production) before running section 1.
--
-- The Flutter app is unaffected: it authenticates as `authenticated` with the
-- auth-exchange JWT, and round8-jwt-rls-policies.sql already provides a
-- scoped jwt_* policy for every table touched here.

BEGIN;

-- ------------------------------------------------------------
-- 1. Drop the unrestricted policies
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can manage communications" ON communications;
DROP POLICY IF EXISTS "Authenticated users can manage enquiries"      ON enquiries;

DROP POLICY IF EXISTS "Admin can delete documents"                ON guest_documents;
DROP POLICY IF EXISTS "Allow anyone to insert guest_documents"    ON guest_documents;
DROP POLICY IF EXISTS "Allow anyone to read guest_documents"      ON guest_documents;
DROP POLICY IF EXISTS "Allow anyone to update guest_documents"    ON guest_documents;
DROP POLICY IF EXISTS "Anyone authenticated can update"           ON guest_documents;
DROP POLICY IF EXISTS "Anyone can select documents"               ON guest_documents;
DROP POLICY IF EXISTS "Guests can insert documents"               ON guest_documents;
DROP POLICY IF EXISTS "Guests can insert their documents"         ON guest_documents;

DROP POLICY IF EXISTS "Allow public delete on guest_meal_preferences" ON guest_meal_preferences;
DROP POLICY IF EXISTS "Allow public insert on guest_meal_preferences" ON guest_meal_preferences;
DROP POLICY IF EXISTS "Allow public read on guest_meal_preferences"   ON guest_meal_preferences;
DROP POLICY IF EXISTS "Allow public update on guest_meal_preferences" ON guest_meal_preferences;

DROP POLICY IF EXISTS "Anyone can insert sessions" ON guest_portal_sessions;
DROP POLICY IF EXISTS "Anyone can view sessions"   ON guest_portal_sessions;

DROP POLICY IF EXISTS "Allow all payments access" ON payments;

DROP POLICY IF EXISTS "Allow anonymous delete access to payout_requests" ON payout_requests;
DROP POLICY IF EXISTS "Allow anonymous insert access to payout_requests" ON payout_requests;
DROP POLICY IF EXISTS "Allow anonymous update access to payout_requests" ON payout_requests;

DROP POLICY IF EXISTS "Allow all properties access"                ON properties;
DROP POLICY IF EXISTS "Allow anonymous write access to properties"  ON properties;

DROP POLICY IF EXISTS "Allow anonymous delete access to property_owners" ON property_owners;
DROP POLICY IF EXISTS "Allow anonymous insert access to property_owners" ON property_owners;
DROP POLICY IF EXISTS "Allow anonymous read access to property_owners"   ON property_owners;
DROP POLICY IF EXISTS "Allow anonymous update access to property_owners" ON property_owners;

DROP POLICY IF EXISTS "Allow all reservations access"               ON reservations;
DROP POLICY IF EXISTS "Allow anonymous read access to reservations"  ON reservations;
DROP POLICY IF EXISTS "Allow anonymous write access to reservations" ON reservations;
DROP POLICY IF EXISTS "Allow anyone to read reservations"            ON reservations;
DROP POLICY IF EXISTS "Allow guest portal to verify bookings"        ON reservations;

DROP POLICY IF EXISTS "Authenticated can read targets" ON revenue_targets;

DROP POLICY IF EXISTS "Allow all operations" ON synced_availability;

DROP POLICY IF EXISTS "Allow all team members access" ON team_members;

-- ------------------------------------------------------------
-- 2. Take the grants away from anon as well
-- ------------------------------------------------------------
-- Defence in depth. RLS alone would now be enough, but a future policy added
-- carelessly in the dashboard can reopen this; a missing GRANT cannot. Nothing
-- legitimate talks to PostgREST as `anon` — the browser goes through
-- /api/db-proxy and the app authenticates first.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

COMMIT;


-- ------------------------------------------------------------
-- 3. Verify — both queries must return ZERO rows
-- ------------------------------------------------------------

-- Any policy still granting unrestricted access to anon or public:
SELECT tablename, policyname, roles, cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (qual = 'true' OR with_check = 'true')
   AND roles::text[] && ARRAY['anon','public']
 ORDER BY tablename, policyname;

-- Any table anon can still reach at the grant level:
SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee = 'anon'
 ORDER BY table_name, privilege_type;


-- ------------------------------------------------------------
-- 4. Then confirm from outside
-- ------------------------------------------------------------
-- Run this from any terminal. It should return 401 or an empty result, not a
-- row count. Substitute the anon key from https://resiq.hostizzy.com/api/config.
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--     -H "Prefer: count=exact" \
--     'https://<project>.supabase.co/rest/v1/property_owners?select=id&limit=0'
--
-- Before the fix this returned 206 with a count. After, it must not.


-- ============================================================
-- STILL LOOSE AFTER THIS — tighten, but not today
-- ============================================================
-- These are scoped to {authenticated} so they are not a public exposure, but
-- they are USING (true), meaning any logged-in user — including a host —
-- can read every tenant's rows through the Flutter path:
--
--   jwt_communications_all   ON communications
--   jwt_enquiries_all        ON enquiries
--   jwt_targets_select       ON revenue_targets   (Hostizzy's own revenue targets)
--
-- Do NOT drop these — the app depends on them and would break. They need
-- rewriting to scope by property/owner the way jwt_reservations_* does. Track
-- separately; the public exposure above is the urgent part.


-- ============================================================
-- PLAINTEXT PASSWORDS
-- ============================================================
-- team_members.password and property_owners.password were being written with
-- the user's real password in plaintext, in tables anon could read. Nothing
-- ever reads the column — Firebase holds the credential — so the app change
-- that stops writing it is safe, and the stored values should be destroyed.
--
-- Run this after deploying, and have everyone who has ever been added as a
-- team member or owner reset their password.

-- UPDATE team_members    SET password = 'firebase-managed' WHERE password <> 'firebase-managed';
-- UPDATE property_owners SET password = 'firebase-managed' WHERE password <> 'firebase-managed';
