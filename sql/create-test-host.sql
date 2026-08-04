-- ============================================================
-- Create a real, loginable test host
-- ============================================================
--
-- Gives you an account you can actually sign into on the web app and the
-- Android app, with one property and two rooms to poke at.
--
-- SQL alone is not enough. ResIQ splits identity from data:
--   Firebase Auth   holds the email + password and does the signing in
--   property_owners holds the profile, and is matched to Firebase BY EMAIL
--
-- So step 1 happens in the Firebase console, step 2 here. The emails must match
-- exactly or login succeeds against Firebase and then fails to find a profile.
--
-- ------------------------------------------------------------
-- STEP 1 — create the Firebase account (console, not SQL)
-- ------------------------------------------------------------
-- Firebase console → project resiq-by-hostizzy → Authentication → Users →
-- Add user:
--
--     Email:    testhost@hostizzy.com        <- change here AND below if you like
--     Password: (pick one, at least 8 characters)
--
-- Nothing else. Do not set a display name; the app reads the name from the row
-- created below.
--
-- ------------------------------------------------------------
-- STEP 2 — create the profile and some data (this file)
-- ------------------------------------------------------------
-- Change the email on the next line if you used a different one. It appears in
-- several places below, so change it here and use find-and-replace.

BEGIN;

-- ── The host ──
-- status 'approved' + is_active true is what an approved signup looks like.
-- Setting them here skips the pending screen so you can log straight in.
-- is_external true marks it a self-signup host rather than a managed owner;
-- account_type is derived from it by trigger once that migration is applied.
INSERT INTO property_owners (name, email, phone, password, is_active, status, is_external)
VALUES ('Test Host', 'testhost@hostizzy.com', '+91 90000 00000',
        'firebase-managed',   -- never read; Firebase holds the real credential
        true, 'approved', true)
ON CONFLICT (email) DO UPDATE
   SET is_active = true, status = 'approved', is_external = true;

-- ── One property, sold by the room ──
-- id is assigned as max+1 rather than left to the sequence, because the
-- sequence is behind the table until sql/properties-id-sequence.sql is run.
-- Harmless either way.
INSERT INTO properties (id, name, location, type, capacity,
                        revenue_share_percent, is_managed, owner_id)
SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM properties),
       'Test Host Homestay', 'Kasauli, HP', 'homestay', 6,
       0,        -- a host keeps 100%; there is no Hostizzy share
       false,
       (SELECT id FROM property_owners WHERE email = 'testhost@hostizzy.com')
WHERE NOT EXISTS (
    SELECT 1 FROM properties WHERE name = 'Test Host Homestay'
);

-- ── Two rooms, so the room picker and the conflict guard have something to do ──
INSERT INTO rooms (property_id, name, capacity, base_rate, sort_order)
SELECT p.id, r.name, r.capacity, r.rate, r.sort_order
  FROM properties p
  CROSS JOIN (VALUES
      ('Garden Room', 2, 3500.00, 1),
      ('Attic Room',  4, 5200.00, 2)
  ) AS r(name, capacity, rate, sort_order)
 WHERE p.name = 'Test Host Homestay'
   AND NOT EXISTS (
       SELECT 1 FROM rooms x WHERE x.property_id = p.id AND x.name = r.name
   );

COMMIT;


-- ------------------------------------------------------------
-- STEP 3 — confirm it looks right
-- ------------------------------------------------------------

SELECT o.id AS owner_id, o.name, o.email, o.is_active, o.status, o.is_external,
       p.id AS property_id, p.name AS property,
       (SELECT count(*) FROM rooms WHERE property_id = p.id) AS rooms
  FROM property_owners o
  LEFT JOIN properties p ON p.owner_id = o.id
 WHERE o.email = 'testhost@hostizzy.com';


-- ============================================================
-- WHAT TO CHECK ONCE YOU'RE IN
-- ============================================================
--
-- Web app — https://resiq.hostizzy.com/app
--   □ Login lands in the main app, NOT redirected to /owner-portal
--     (that redirect is for managed owners; a host belongs in the app)
--   □ Sidebar shows Properties and Team, and does NOT show
--     Managed Owners, Hosts, OTA Import or Performance
--   □ Properties lists only "Test Host Homestay" — no Hostizzy properties
--   □ Add Property: the Save button is inside the white card, and there is
--     no "Hostizzy Commission Rate" or "Managed by Hostizzy" field
--   □ Rooms on the property shows Garden Room and Attic Room
--   □ Reservations, Payments, Guests are all empty — not full of Hostizzy data
--   □ Team → Add Team Member offers "Caretaker", not "Admin"
--
-- Android app
--   □ Same login works
--   □ Only the test property appears
--   □ Creating a booking that clashes with an existing one is rejected with a
--     readable message, not a crash
--
-- The important one is "Reservations is empty". If the test host can see
-- Hostizzy's bookings, the tenant boundary is not holding.
--
-- Note the web app and the Android app prove DIFFERENT things:
--   web app  → js/db.js scoping (client-side, service-role connection)
--   Android  → RLS policies    (server-side, the host's own JWT)
-- A pass on one says nothing about the other. Check both.


-- ============================================================
-- TEARDOWN
-- ============================================================
-- Deletes cascade to rooms, reservations, payments and documents attached to
-- the test property. Also delete the Firebase user in the console afterwards.
--
-- DELETE FROM properties      WHERE name  = 'Test Host Homestay';
-- DELETE FROM property_owners WHERE email = 'testhost@hostizzy.com';
