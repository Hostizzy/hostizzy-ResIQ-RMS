-- ============================================================
-- ResIQ — run this after any change. One result set, PASS/FAIL per line.
-- ============================================================
--
-- Read-only. Every role switch is undone, every simulated identity is cleared,
-- nothing is written except a temporary scratch table.
--
-- Results accumulate into a temp table and are selected at the end, because the
-- Supabase SQL editor only shows the LAST statement's output — running a file
-- of separate queries silently throws away all but one.
--
-- What this covers, and what it doesn't
-- -------------------------------------
-- This checks the DATABASE: what an anonymous stranger can reach, what a host's
-- JWT can reach, and a few data-integrity invariants. It cannot check the web
-- app's client-side scoping, because that lives in JavaScript on a service-role
-- connection where RLS is bypassed.
--
-- Three layers, all three needed:
--   npm test                     — client-side scoping (js/db.js)
--   sql/verify.sql               — this file: RLS and the tenant boundary
--   sql/create-test-host.sql     — the manual checklist, both clients
--
-- See docs/VERIFICATION.md.

-- ------------------------------------------------------------
-- About the two warnings the Supabase editor shows for this file
-- ------------------------------------------------------------
-- 1. "includes destructive operations" — the DROP below. It is explicitly
--    qualified with pg_temp, so it can only ever target this session's own
--    scratch table and cannot reach anything in public. With no temp schema
--    yet it is a no-op with a notice.
--
-- 2. "creates a table without enabling Row Level Security" — resiq_checks is
--    a TEMP table. It lives in this session's private pg_temp schema, is gone
--    when the session ends, and PostgREST connects in different sessions, so
--    anon and authenticated cannot see it under any policy. RLS on it would
--    have nothing to do. The editor's linter does not distinguish TEMP tables.
--
-- "Run without RLS" is the correct choice.

DROP TABLE IF EXISTS pg_temp.resiq_checks;
CREATE TEMP TABLE resiq_checks (
    ord        int,
    area       text,
    check_name text,
    status     text,
    detail     text
);


-- ------------------------------------------------------------
-- 1. Is RLS switched on at all?
-- ------------------------------------------------------------
-- A policy on a table without RLS enabled does nothing whatsoever.

INSERT INTO resiq_checks
SELECT 10,
       'RLS',
       'enabled on ' || c.relname,
       CASE WHEN c.relrowsecurity THEN 'PASS' ELSE 'FAIL' END,
       CASE WHEN c.relrowsecurity THEN 'on' ELSE 'OFF — every policy on this table is inert' END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('properties','rooms','reservations','payments',
                     'team_members','property_owners','payout_requests',
                     'guest_documents','property_expenses');


-- ------------------------------------------------------------
-- 2. Any policy handing out unrestricted access?
-- ------------------------------------------------------------
-- `{public}` means EVERY role including anon — a policy named
-- "Authenticated users can ..." with roles {public} is not authenticated-only.

INSERT INTO resiq_checks
SELECT 20, 'RLS', 'no unrestricted anon/public policies', 'FAIL',
       tablename || '.' || policyname || '  roles=' || roles::text || ' cmd=' || cmd
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (qual = 'true' OR with_check = 'true')
   AND roles::text[] && ARRAY['anon','public'];

INSERT INTO resiq_checks
SELECT 20, 'RLS', 'no unrestricted anon/public policies', 'PASS', 'none found'
 WHERE NOT EXISTS (
     SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND (qual = 'true' OR with_check = 'true')
        AND roles::text[] && ARRAY['anon','public']
 );

-- Same again for `authenticated`. Not a public exposure, but a USING (true)
-- policy here means any logged-in user reads every tenant's rows.
INSERT INTO resiq_checks
SELECT 25, 'RLS', 'no unscoped authenticated policies', 'WARN',
       tablename || '.' || policyname || ' is USING (true) — every tenant visible'
  FROM pg_policies
 WHERE schemaname = 'public'
   AND qual = 'true'
   AND roles::text[] && ARRAY['authenticated'];


-- ------------------------------------------------------------
-- 3. Grants — RLS sits on top of these
-- ------------------------------------------------------------

INSERT INTO resiq_checks
SELECT 30, 'GRANTS', 'anon holds no table privileges', 'FAIL',
       table_name || ': ' || string_agg(privilege_type, ', ' ORDER BY privilege_type)
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee = 'anon'
 GROUP BY table_name;

INSERT INTO resiq_checks
SELECT 30, 'GRANTS', 'anon holds no table privileges', 'PASS', 'none'
 WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'anon'
 );


-- ------------------------------------------------------------
-- 4. What can a stranger with the public anon key actually read?
-- ------------------------------------------------------------
-- The decisive check. SET LOCAL ROLE anon puts this session in exactly the
-- position of someone who fetched the key from /api/config and is talking to
-- PostgREST directly — no app, no login, no db-proxy.
--
-- A permission error counts as a pass: it means the grant was revoked.

-- Sweeps EVERY table, view and materialised view in public rather than a
-- hand-written list. A fixed list only finds what you already suspected — it
-- was missing gmail_tokens, which holds OAuth refresh tokens.
--
-- Only exposed objects are reported, so a clean run is one PASS line.

DO $$
DECLARE
    r        record;
    n        bigint;
    exposed  int := 0;
BEGIN
    FOR r IN
        SELECT c.relname, c.relkind
          FROM pg_class c
          JOIN pg_namespace ns ON ns.oid = c.relnamespace
         WHERE ns.nspname = 'public'
           AND c.relkind IN ('r','p','v','m')     -- table, partitioned, view, matview
         ORDER BY c.relname
    LOOP
        BEGIN
            SET LOCAL ROLE anon;
            EXECUTE format('SELECT count(*) FROM public.%I', r.relname) INTO n;
            RESET ROLE;
            IF n > 0 THEN
                exposed := exposed + 1;
                INSERT INTO resiq_checks VALUES (40, 'ANON',
                    'cannot read ' || r.relname,
                    'FAIL',
                    n::text || ' rows readable by anyone on the internet'
                      || CASE WHEN r.relkind IN ('v','m') THEN '  (VIEW)' ELSE '' END);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RESET ROLE;   -- permission denied, or a view over a missing relation
        END;
    END LOOP;
    RESET ROLE;

    IF exposed = 0 THEN
        INSERT INTO resiq_checks VALUES (40, 'ANON', 'nothing in public is readable by anon',
            'PASS', 'swept every table and view');
    END IF;
END $$;


-- ------------------------------------------------------------
-- 4b. Views that sidestep RLS
-- ------------------------------------------------------------
-- A view runs with its OWNER's privileges unless it was created with
-- security_invoker. So a view over reservations, owned by postgres, returns
-- every row regardless of the policies on reservations — fixing RLS on the
-- base table does not close it. Revoking the grant does.

INSERT INTO resiq_checks
SELECT 45, 'VIEWS',
       'view ' || c.relname || ' does not bypass RLS',
       'FAIL',
       'owned by ' || pg_get_userbyid(c.relowner)
         || ', no security_invoker, granted to ' || g.grantee
         || ' — reads base tables with the owner''s rights'
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  JOIN information_schema.role_table_grants g
    ON g.table_schema = 'public' AND g.table_name = c.relname
   AND g.privilege_type = 'SELECT'
   -- PUBLIC covers anon and authenticated without naming either, so a grant to
   -- PUBLIC is the quiet way this reopens.
   AND g.grantee IN ('anon','authenticated','PUBLIC')
 WHERE ns.nspname = 'public'
   AND c.relkind = 'v'
   AND NOT COALESCE(c.reloptions::text LIKE '%security_invoker=true%', false)
 GROUP BY c.relname, c.relowner, g.grantee;


-- ------------------------------------------------------------
-- 5. Does a host's JWT stay inside its own tenant?
-- ------------------------------------------------------------
-- Reproduces what /api/auth-exchange mints for a host. This is the path the
-- Android app takes, and the only path where RLS actually applies.
--
-- Uses the first self-signup host in the table — create one with
-- sql/create-test-host.sql if there isn't one yet.

DO $$
DECLARE
    host_id   uuid;
    visible   bigint;
    owned     bigint;
BEGIN
    SELECT id INTO host_id FROM property_owners
     WHERE COALESCE(is_external, false) IS TRUE AND is_active
     ORDER BY created_at LIMIT 1;

    IF host_id IS NULL THEN
        INSERT INTO resiq_checks VALUES (50, 'HOST JWT', 'tenant boundary holds', 'SKIP',
            'no active host exists — run sql/create-test-host.sql');
        RETURN;
    END IF;

    -- Ground truth FIRST, as the privileged session user. Counting `owned`
    -- while acting as the host would put it through the same RLS filter as
    -- `visible`, so a policy that hides everything would make both zero and
    -- the check would pass while the host could see nothing at all.
    SELECT count(*) INTO owned FROM properties WHERE owner_id = host_id;

    PERFORM set_config('request.jwt.claims',
        json_build_object('role','authenticated','user_type','owner',
                          'owner_id', host_id::text)::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO visible FROM properties;
    RESET ROLE;
    INSERT INTO resiq_checks VALUES (50, 'HOST JWT', 'sees exactly their own properties',
        CASE WHEN visible = owned THEN 'PASS'
             WHEN visible < owned THEN 'WARN' ELSE 'FAIL' END,
        visible::text || ' visible / ' || owned::text || ' owned' ||
        CASE WHEN visible > owned THEN ' — other tenants exposed'
             WHEN visible < owned THEN ' — host cannot see their own data' ELSE '' END);

    SELECT count(*) INTO owned FROM reservations r
      JOIN properties p ON p.id = r.property_id WHERE p.owner_id = host_id;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO visible FROM reservations;
    RESET ROLE;
    INSERT INTO resiq_checks VALUES (51, 'HOST JWT', 'sees exactly their own reservations',
        CASE WHEN visible = owned THEN 'PASS'
             WHEN visible < owned THEN 'WARN' ELSE 'FAIL' END,
        visible::text || ' visible / ' || owned::text || ' owned' ||
        CASE WHEN visible > owned THEN ' — other tenants exposed'
             WHEN visible < owned THEN ' — host cannot see their own data' ELSE '' END);

    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO visible FROM property_owners;
    RESET ROLE;
    -- Exactly one: more is a leak of the tenant directory, none means the host
    -- cannot read their own profile and the app will show them as unconfigured.
    INSERT INTO resiq_checks VALUES (52, 'HOST JWT', 'sees own owner record and no other',
        CASE WHEN visible = 1 THEN 'PASS' WHEN visible = 0 THEN 'WARN' ELSE 'FAIL' END,
        visible::text || ' owner rows visible — should be exactly 1' ||
        CASE WHEN visible = 0 THEN ' (host cannot read their own profile)'
             WHEN visible > 1 THEN ' (other tenants exposed)' ELSE '' END);

    -- Views are the blind spot the four checks above cannot see: they run with
    -- their owner's rights, so no policy on the base table constrains them.
    -- Anything a host can read here, they can read across every tenant.
    DECLARE
        v record;
        vn bigint;
    BEGIN
        FOR v IN
            SELECT c.relname FROM pg_class c
              JOIN pg_namespace ns2 ON ns2.oid = c.relnamespace
             WHERE ns2.nspname = 'public' AND c.relkind IN ('v','m')
             ORDER BY c.relname
        LOOP
            BEGIN
                SET LOCAL ROLE authenticated;
                EXECUTE format('SELECT count(*) FROM public.%I', v.relname) INTO vn;
                RESET ROLE;
                IF vn > 0 THEN
                    INSERT INTO resiq_checks VALUES (54, 'HOST JWT',
                        'view ' || v.relname || ' is not readable by a host', 'FAIL',
                        vn::text || ' rows visible to a logged-in host — views ignore RLS');
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RESET ROLE;
            END;
        END LOOP;
        RESET ROLE;
    END;

    SELECT count(*) INTO owned FROM team_members WHERE owner_id = host_id;
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO visible FROM team_members;
    RESET ROLE;
    INSERT INTO resiq_checks VALUES (53, 'HOST JWT', 'sees exactly their own team members',
        CASE WHEN visible = owned THEN 'PASS'
             WHEN visible < owned THEN 'WARN' ELSE 'FAIL' END,
        visible::text || ' visible / ' || owned::text || ' owned' ||
        CASE WHEN visible > owned THEN ' — other tenants exposed'
             WHEN visible < owned THEN ' — host cannot see their own data' ELSE '' END);

    PERFORM set_config('request.jwt.claims', '', true);
    RESET ROLE;
END $$;


-- ------------------------------------------------------------
-- 6. Credentials
-- ------------------------------------------------------------
-- Firebase holds every credential. A real password in these columns is
-- plaintext at rest and nothing ever reads it.

DO $$
DECLARE n bigint;
BEGIN
    SELECT count(*) INTO n FROM team_members
     WHERE password IS NOT NULL AND password <> 'firebase-managed';
    INSERT INTO resiq_checks VALUES (60, 'SECRETS', 'no plaintext passwords in team_members',
        CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n::text || ' rows');

    SELECT count(*) INTO n FROM property_owners
     WHERE password IS NOT NULL AND password <> 'firebase-managed';
    INSERT INTO resiq_checks VALUES (61, 'SECRETS', 'no plaintext passwords in property_owners',
        CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n::text || ' rows');
END $$;


-- ------------------------------------------------------------
-- 7. Data integrity
-- ------------------------------------------------------------

-- The id sequence must be ahead of the data, or an insert that omits id fails.
DO $$
DECLARE mx bigint; sq bigint;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO mx FROM properties;
    EXECUTE 'SELECT last_value FROM ' || pg_get_serial_sequence('public.properties','id') INTO sq;
    INSERT INTO resiq_checks VALUES (70, 'DATA', 'properties id sequence is ahead of the data',
        CASE WHEN sq >= mx THEN 'PASS' ELSE 'FAIL' END,
        'sequence ' || sq::text || ' vs max id ' || mx::text ||
        CASE WHEN sq < mx THEN ' — run sql/properties-id-sequence.sql' ELSE '' END);
EXCEPTION WHEN OTHERS THEN
    INSERT INTO resiq_checks VALUES (70, 'DATA', 'properties id sequence is ahead of the data', 'SKIP', SQLERRM);
END $$;

-- Overlapping bookings the conflict trigger would now reject. These predate the
-- guard, sit there silently, and surface as a confusing error on the next edit.
DO $$
DECLARE n bigint;
BEGIN
    SELECT count(*) INTO n
      FROM reservations a
      JOIN reservations b
        ON a.property_id = b.property_id
       AND a.id < b.id
       AND COALESCE(a.status,'') <> 'cancelled'
       AND COALESCE(b.status,'') <> 'cancelled'
       AND a.check_in IS NOT NULL AND a.check_out IS NOT NULL
       AND b.check_in IS NOT NULL AND b.check_out IS NOT NULL
       AND daterange(a.check_in::date, a.check_out::date, '[)')
        && daterange(b.check_in::date, b.check_out::date, '[)')
       AND (a.room_id IS NULL OR b.room_id IS NULL OR a.room_id = b.room_id);
    INSERT INTO resiq_checks VALUES (71, 'DATA', 'no pre-existing double bookings',
        CASE WHEN n = 0 THEN 'PASS' ELSE 'WARN' END,
        n::text || ' overlapping pairs — these will be rejected on next edit');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO resiq_checks VALUES (71, 'DATA', 'no pre-existing double bookings', 'SKIP', SQLERRM);
END $$;

-- Migrations that are supposed to be applied.
INSERT INTO resiq_checks
SELECT 80, 'MIGRATIONS', 'property_owners.account_type exists',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_schema='public' AND table_name='property_owners'
                            AND column_name='account_type') THEN 'PASS' ELSE 'FAIL' END,
       'sql/account-type-and-host-profiles.sql';

INSERT INTO resiq_checks
SELECT 81, 'MIGRATIONS', 'host_profiles table exists',
       CASE WHEN to_regclass('public.host_profiles') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
       'sql/account-type-and-host-profiles.sql';

INSERT INTO resiq_checks
SELECT 82, 'MIGRATIONS', 'rooms table exists',
       CASE WHEN to_regclass('public.rooms') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
       'sql/rooms-and-conflict-guard.sql';

INSERT INTO resiq_checks
SELECT 83, 'MIGRATIONS', 'double-booking trigger is live',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger
                          WHERE tgname = 'trg_reservation_conflict'
                            AND NOT tgisinternal) THEN 'PASS' ELSE 'FAIL' END,
       'sql/rooms-and-conflict-guard.sql';

INSERT INTO resiq_checks
SELECT 84, 'MIGRATIONS', 'owner notification flags exist',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_schema='public' AND table_name='property_owners'
                            AND column_name='signup_notified_at') THEN 'PASS' ELSE 'FAIL' END,
       'sql/owner-notification-flags.sql';


-- ============================================================
-- RESULTS — failures first
-- ============================================================

SELECT status, area, check_name, detail
  FROM resiq_checks
 ORDER BY CASE status WHEN 'FAIL' THEN 0 WHEN 'WARN' THEN 1 WHEN 'SKIP' THEN 2 ELSE 3 END,
          ord, check_name;

-- Summary line — run on its own if you just want the headline:
--   SELECT status, count(*) FROM resiq_checks GROUP BY status ORDER BY 1;
