-- ============================================================
-- What can a host actually reach? And what can a stranger reach?
-- ============================================================
--
-- Why testing through the app doesn't answer this
-- -----------------------------------------------
-- Signing out and finding you can't see anything, and logging in as a managed
-- owner and seeing only your own data, are both true — and neither tells you
-- anything about the database.
--
-- Every one of those guarantees lives in JavaScript we wrote:
--
--   js/db.js       adds .eq('owner_id', ...) to every query
--   js/auth.js     decides which views to render
--   api/db-proxy   demands a Firebase token, then talks to Postgres as the
--                  SERVICE ROLE — which bypasses RLS entirely
--
-- So the app is scoped because our code scopes it. Someone who doesn't run our
-- code isn't scoped by anything except RLS. That is what this file tests, and
-- the app cannot show it to you no matter how you click.
--
-- Everything below runs in a transaction that ROLLS BACK. Nothing is kept.

-- ============================================================
-- TEST 1 — what a stranger with the public anon key can read
-- ============================================================
-- The anon key is served to anyone by https://resiq.hostizzy.com/api/config.
-- That's correct and normal: it's public by design, because RLS is meant to be
-- the thing protecting the data. SET ROLE anon puts this session in exactly the
-- position of someone holding that key and talking to PostgREST directly.
--
-- Expected if RLS were doing its job: 0 everywhere, or a permission error.

BEGIN;
SET LOCAL ROLE anon;

SELECT 'anon' AS acting_as, 'property_owners' AS table_name, count(*) AS rows_visible FROM property_owners
UNION ALL SELECT 'anon', 'reservations',    count(*) FROM reservations
UNION ALL SELECT 'anon', 'payments',        count(*) FROM payments
UNION ALL SELECT 'anon', 'properties',      count(*) FROM properties
UNION ALL SELECT 'anon', 'team_members',    count(*) FROM team_members
UNION ALL SELECT 'anon', 'guest_documents', count(*) FROM guest_documents;

RESET ROLE;
ROLLBACK;

-- If any number above is greater than zero, an unauthenticated stranger can
-- read that table today. Nothing in the app is in the way — they are not using
-- the app.


-- ============================================================
-- TEST 2 — a real test host, and what its JWT can reach
-- ============================================================
-- This is the "create a test host and see what they can access" test. It does
-- NOT need a Firebase account, because RLS never sees Firebase — it only sees
-- the claims in the JWT that /api/auth-exchange mints. Setting those claims by
-- hand reproduces the Flutter app's access exactly.

BEGIN;

-- A host who owns exactly one property and should therefore see exactly the
-- data attached to that property, and nothing else.
INSERT INTO property_owners (name, email, phone, password, is_active, status, is_external)
VALUES ('RLS Test Host', 'rls-test-host@example.invalid', NULL,
        'firebase-managed', true, 'approved', true);

INSERT INTO properties (name, location, type, capacity, revenue_share_percent, is_managed, owner_id)
VALUES ('RLS Test Cottage', 'Nowhere', 'villa', 2, 0, false,
        (SELECT id FROM property_owners WHERE email = 'rls-test-host@example.invalid'));

-- Now become that host. These are the exact claims auth-exchange produces:
-- role authenticated, user_type owner, owner_id = the host's id.
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'role',      'authenticated',
        'user_type', 'owner',
        'owner_id',  (SELECT id::text FROM property_owners WHERE email = 'rls-test-host@example.invalid'),
        'email',     'rls-test-host@example.invalid'
    )::text,
    true
);
SET LOCAL ROLE authenticated;

-- What the test host can see, next to what actually belongs to them.
SELECT 'test host' AS acting_as,
       'reservations' AS table_name,
       count(*) AS rows_visible,
       (SELECT count(*) FROM reservations r
          JOIN properties p ON p.id = r.property_id
         WHERE p.name = 'RLS Test Cottage') AS rows_they_own
  FROM reservations
UNION ALL
SELECT 'test host', 'properties', count(*),
       (SELECT count(*) FROM properties WHERE name = 'RLS Test Cottage')
  FROM properties
UNION ALL
SELECT 'test host', 'property_owners', count(*), 1 FROM property_owners
UNION ALL
SELECT 'test host', 'payments', count(*), 0 FROM payments
UNION ALL
SELECT 'test host', 'team_members', count(*), 0 FROM team_members
UNION ALL
SELECT 'test host', 'guest_documents', count(*), 0 FROM guest_documents;

-- Can they WRITE to a property that isn't theirs? This should fail.
-- Uncomment to check — it aborts the transaction, which then rolls back anyway.
--
-- UPDATE properties
--    SET name = 'HIJACKED'
--  WHERE owner_id IS DISTINCT FROM
--        (SELECT id FROM property_owners WHERE email = 'rls-test-host@example.invalid');

RESET ROLE;
ROLLBACK;   -- the test host and its property are discarded

-- rows_visible should equal rows_they_own on every line. Anywhere it doesn't,
-- a host can read another tenant's data through the app's own API.


-- ============================================================
-- TEST 3 — re-run both after sql/URGENT-close-anon-rls.sql
-- ============================================================
-- Test 1 should return 0 across the board, or fail with "permission denied".
-- Test 2 should show rows_visible = rows_they_own on every line.
--
-- Three rows in test 2 are expected to stay loose even after the fix, because
-- their policies are USING (true) for authenticated and the app depends on
-- them: communications, enquiries and revenue_targets. Those need rewriting to
-- scope by property, tracked separately.
