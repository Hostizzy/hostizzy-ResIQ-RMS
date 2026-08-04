-- ============================================================
-- Which policies actually grant write access, and to whom?
-- ============================================================
--
-- Postgres OR's permissive policies together. A row is writable if ANY
-- applicable policy passes — so one blanket `USING (true)` policy makes every
-- carefully-scoped policy on the same table irrelevant.
--
-- `properties` currently carries six policies, two of them named
-- "Allow all properties access" and "Allow anonymous write access to
-- properties". If either is unconditional, jwt_properties_write is decorative
-- and any caller reaching Postgres directly can write any property row.
--
-- This dumps the full definitions so that can be confirmed rather than assumed.
-- Read-only.

SELECT tablename,
       policyname,
       permissive,          -- PERMISSIVE policies OR together; RESTRICTIVE AND together
       roles,               -- {public} or {anon} is far broader than {authenticated}
       cmd,
       COALESCE(qual, '(none)')       AS using_expression,
       COALESCE(with_check, '(none)') AS with_check_expression
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('properties','rooms','reservations','payments',
                     'team_members','property_owners')
 ORDER BY tablename,
          -- unconditional policies first, they're the ones that matter
          CASE WHEN qual = 'true' OR with_check = 'true' THEN 0 ELSE 1 END,
          policyname;


-- ------------------------------------------------------------
-- Anything unconditional, across every table
-- ------------------------------------------------------------
-- Each row here is a table where RLS is effectively off for the listed roles.

SELECT tablename, policyname, roles, cmd,
       CASE WHEN qual = 'true' AND with_check = 'true' THEN 'read + write unrestricted'
            WHEN qual = 'true'                          THEN 'read unrestricted'
            ELSE 'write unrestricted'
       END AS effect
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (qual = 'true' OR with_check = 'true')
 ORDER BY tablename, policyname;


-- ============================================================
-- BEFORE DROPPING ANYTHING — check what db-proxy is running as
-- ============================================================
--
-- api/db-proxy.js falls back through:
--     SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || VITE_SUPABASE_ANON_KEY
--
-- On the service-role key it bypasses RLS entirely and dropping these policies
-- changes nothing for the web app. On an anon-key fallback, RLS DOES apply to
-- it — and these blanket policies are the only reason the web app works. In
-- that case dropping them breaks the whole site.
--
-- So confirm SUPABASE_SERVICE_ROLE_KEY is set in Vercel (Project → Settings →
-- Environment Variables) before running any DROP below.
--
-- The Flutter app is unaffected either way: it authenticates as `authenticated`
-- with the auth-exchange JWT, which jwt_*_write already covers.

-- Once confirmed, drop the blanket policies. Kept commented — this is
-- destructive and the check above has to happen first.
--
-- DROP POLICY IF EXISTS "Allow anonymous write access to properties" ON properties;
-- DROP POLICY IF EXISTS "Allow all properties access" ON properties;
--
-- Then re-run the second query above and confirm it returns no rows for
-- properties. Leave the jwt_* and "Admin/Owner can ..." policies in place.
