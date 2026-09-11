-- ============================================================
-- Views were the hole left in the tenant boundary
-- ============================================================
--
-- sql/staff-scope-excludes-hosts.sql closed the boundary on TABLES. A view
-- does not inherit it. By default a view runs with the rights of whoever
-- OWNS it — here, postgres — so RLS on the tables underneath is evaluated as
-- postgres, which bypasses it entirely. Grant that view to `authenticated`
-- and every logged-in host reads the whole database through it.
--
-- This was live. verify.sql, run against production:
--
--     payment_summary             1134 rows visible to a logged-in host
--     reservation_document_status 1098 rows
--     daily_collections            547 rows
--     revenue_report                36 rows
--
-- Those are other people's guests, payments and revenue, readable by anyone
-- with a login, through the Flutter app's authenticated JWT.
--
-- security_invoker = on makes a view run with the rights of the CALLER
-- instead, so the base tables' RLS applies and a host sees their own rows and
-- nothing else. It needs PostgreSQL 15+; on anything older there is no way to
-- make these safe short of revoking them, which this script does instead.
--
-- Safe to re-run.

DO $$
DECLARE
    v      text;
    n      int;
    pg15   boolean := current_setting('server_version_num')::int >= 150000;
    views  text[] := ARRAY[
        'daily_collections',
        'payment_summary',
        'reservation_document_status',
        'revenue_report'
    ];
BEGIN
    IF NOT pg15 THEN
        RAISE WARNING 'PostgreSQL % is below 15 — security_invoker is unavailable. '
                      'Revoking these views from anon/authenticated instead; nothing '
                      'in the app reads them, so this should be invisible.',
                      current_setting('server_version');
    END IF;

    FOREACH v IN ARRAY views LOOP
        -- Only touch what is actually there. A view named here but absent is
        -- not an error: these are reporting helpers and installs differ.
        SELECT count(*) INTO n
          FROM pg_class c
          JOIN pg_namespace ns ON ns.oid = c.relnamespace
         WHERE ns.nspname = 'public' AND c.relname = v AND c.relkind = 'v';

        IF n = 0 THEN
            RAISE NOTICE 'view %.% not present, skipping', 'public', v;
            CONTINUE;
        END IF;

        IF pg15 THEN
            EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
            RAISE NOTICE 'view % now runs as the caller — RLS applies', v;
        ELSE
            EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v);
            RAISE NOTICE 'view % revoked from anon and authenticated', v;
        END IF;
    END LOOP;
END $$;

-- A view that reads as the caller needs the caller to hold SELECT on the base
-- tables — otherwise it fails closed with a permission error rather than
-- returning rows. `authenticated` already has those grants (the host JWT
-- checks in verify.sql read properties and reservations directly), so this is
-- a no-op today and a guard against a future tightening that forgets the
-- views depend on it.
DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(t, ', ') INTO missing
      FROM unnest(ARRAY['reservations','payments','guest_documents','properties']) AS t
     WHERE NOT has_table_privilege('authenticated', 'public.' || t, 'SELECT');

    IF missing IS NOT NULL THEN
        RAISE WARNING 'authenticated lacks SELECT on: % — the views above will '
                      'now error for logged-in users rather than leak. Grant '
                      'SELECT back if the app needs them.', missing;
    END IF;
END $$;

-- ============================================================
-- The deprecated property_ids mirror had drifted
-- ============================================================
--
-- properties.owner_id is the source of truth. property_owners.property_ids is
-- a denormalised mirror we are moving off. verify.sql found three owners whose
-- mirror was empty while owner_id linked a property:
--
--     akkarahomestay@gmail.com     owner_id 1, property_ids 0
--     testhost@example.com         owner_id 1, property_ids 0
--     altitudemussoorie@gmail.com  owner_id 6, property_ids 0
--
-- Not cosmetic. Five owner-portal views still gated on the mirror, so those
-- owners logged in and were told "No properties linked to your account" while
-- owning property. The readers are fixed in the same change as this file; this
-- brings the data back into agreement so anything still reading the mirror —
-- and the verify check — is correct.
-- On types: properties.id is integer here but the mirror column is not
-- necessarily integer[], and array comparison in Postgres has no implicit
-- cast between element types — bigint[] = integer[] is a hard error. So
-- compare through an explicit ::bigint[] on both sides, and let the
-- assignment take whatever the column actually is via a bare '{}' rather
-- than naming a type that might not match.
UPDATE property_owners o
   SET property_ids = COALESCE(p.ids, '{}')
  FROM (
        SELECT owner_id, array_agg(id ORDER BY id) AS ids
          FROM properties
         WHERE owner_id IS NOT NULL
         GROUP BY owner_id
       ) p
 WHERE p.owner_id = o.id
   AND COALESCE(o.property_ids::bigint[], '{}'::bigint[])
       IS DISTINCT FROM COALESCE(p.ids::bigint[], '{}'::bigint[]);

-- Report what moved, so a silent zero-row run is distinguishable from a fix.
DO $$
DECLARE drift int;
BEGIN
    SELECT count(*) INTO drift
      FROM property_owners o
      LEFT JOIN (
            SELECT owner_id, array_agg(id ORDER BY id) AS ids
              FROM properties WHERE owner_id IS NOT NULL GROUP BY owner_id
           ) p ON p.owner_id = o.id
     WHERE COALESCE(o.property_ids::bigint[], '{}'::bigint[])
           IS DISTINCT FROM COALESCE(p.ids::bigint[], '{}'::bigint[]);

    IF drift = 0 THEN
        RAISE NOTICE 'owner property links agree';
    ELSE
        RAISE WARNING '% owner(s) still disagree — investigate before trusting the portal', drift;
    END IF;
END $$;
