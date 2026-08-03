-- ============================================================
-- Rooms, mixed selling, and a double-booking guard
-- ============================================================
--
-- Context
-- -------
-- Until now a property was a single bookable unit: one reservation blocked
-- the whole place. That's right for a villa or farmstay, but wrong for the
-- common Indian homestay with 3-5 rooms sold individually — and wrong again
-- for owners who sell BOTH ways (whole place for a wedding, single rooms
-- otherwise).
--
-- Model
-- -----
-- Rooms are OPTIONAL children of a property.
--
--   property with no rooms   → sold whole, exactly as today. Nothing changes.
--   property with rooms      → each room is separately bookable, AND the
--                              whole property can still be sold as a unit.
--
-- On reservations we need exactly one new column, because the whole-property
-- case is expressible as the absence of a room:
--
--   room_id IS NULL      → this booking takes the WHOLE property
--   room_id = <id>       → this booking takes that room only
--
-- Every existing row has room_id NULL, which already means "whole property".
-- So there is no data migration and no backfill — old rows are correct by
-- construction.
--
-- Billing note: plans should count PROPERTIES, not rooms. A four-room
-- homestay is one property. Counting rooms would push a single-homestay
-- owner past the free tier for one house, which is the opposite of the
-- intent.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. PRE-FLIGHT
-- ------------------------------------------------------------
-- Fail here, loudly, rather than installing cleanly and then breaking every
-- booking save with a confusing runtime error.
-- ------------------------------------------------------------
DO $preflight$
DECLARE
    ci_type TEXT;
BEGIN
    IF to_regclass('public.reservations') IS NULL THEN
        RAISE EXCEPTION 'reservations table not found — wrong database?';
    END IF;
    IF to_regclass('public.properties') IS NULL THEN
        RAISE EXCEPTION 'properties table not found — wrong database?';
    END IF;

    -- The conflict trigger reads ical_uid to exempt OTA-sourced rows.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'reservations' AND column_name = 'ical_uid'
    ) THEN
        RAISE EXCEPTION
            'reservations.ical_uid missing — run sql/round5-ical-schema.sql first.';
    END IF;

    SELECT data_type INTO ci_type
      FROM information_schema.columns
     WHERE table_name = 'reservations' AND column_name = 'check_in';

    RAISE NOTICE 'reservations.check_in is %. Date logic casts explicitly, so either date or text is fine.', ci_type;

    IF ci_type NOT IN ('date', 'text', 'character varying', 'timestamp without time zone', 'timestamp with time zone') THEN
        RAISE EXCEPTION 'Unexpected type % for reservations.check_in — stopping rather than guessing.', ci_type;
    END IF;
END
$preflight$;

-- ------------------------------------------------------------
-- 1. ROOMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id              BIGSERIAL PRIMARY KEY,
    property_id     INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,                    -- "Garden Room"
    capacity        INT,                              -- sleeps how many
    base_rate       NUMERIC(12,2),                    -- optional per-night rate
    sort_order      INT DEFAULT 0,

    -- Channel sync is per ROOM, not per property. OTAs model a multi-room
    -- property as several listings, each with its own calendar feed, because
    -- iCal cannot express "2 of 4 rooms taken" — a VEVENT is a binary block.
    ical_url        TEXT,                             -- inbound: this room's OTA feed
    ical_feed_token TEXT UNIQUE,                      -- outbound: our feed for this room

    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms (property_id, sort_order);

-- A room name should be unique within its property so the picker isn't
-- ambiguous, but the same name may repeat across properties.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_property_name
    ON rooms (property_id, lower(name));

COMMENT ON TABLE rooms IS
    'Optional bookable units within a property. A property with no rooms is sold whole.';
COMMENT ON COLUMN rooms.ical_feed_token IS
    'Secret for this room''s outbound iCal feed. The URL is pasted into OTA settings, so it must be unguessable and revocable.';

-- ------------------------------------------------------------
-- 2. RESERVATIONS → optional room
-- ------------------------------------------------------------
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL;

COMMENT ON COLUMN reservations.room_id IS
    'NULL = books the whole property. Set = books that room only.';

-- Supports the overlap lookup in the conflict trigger below.
CREATE INDEX IF NOT EXISTS idx_reservations_property_dates
    ON reservations (property_id, check_in, check_out);

CREATE INDEX IF NOT EXISTS idx_reservations_room
    ON reservations (room_id) WHERE room_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. DOUBLE-BOOKING GUARD
-- ------------------------------------------------------------
-- There is currently no overlap check anywhere in the app, so nothing stops
-- two reservations sitting on the same property and dates. Rooms multiply the
-- ways that can happen, so the rule belongs in the database where every path
-- (web app, Flutter app, iCal import, CSV import) has to obey it.
--
-- The mixed-selling rule:
--
--   whole-property booking  conflicts with  every room and every whole booking
--   room booking            conflicts with  the same room, and any whole booking
--   room A                  does NOT conflict with  room B
--
-- Dates are half-open [check_in, check_out) so one guest's checkout day is the
-- next guest's check-in day, which is how hospitality actually works.
--
-- Deliberate exemption: rows sourced from an OTA feed (ical_uid IS NOT NULL)
-- are NOT blocked. A channel's calendar is a statement of fact — if Airbnb says
-- a date is sold, refusing the import would leave ResIQ out of step with
-- reality and silently break sync. We record it and surface the clash in the
-- UI instead. The guard exists to stop a HUMAN double-booking.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION resiq_check_booking_conflict()
RETURNS TRIGGER AS $$
DECLARE
    clash RECORD;
    clash_where TEXT;
BEGIN
    -- Nothing to check for cancellations or incomplete date ranges.
    IF COALESCE(NEW.status, '') = 'cancelled'
       OR NEW.check_in IS NULL
       OR NEW.check_out IS NULL
       OR NEW.property_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- OTA-sourced rows are accepted as fact (see note above).
    IF NEW.ical_uid IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT r.booking_id, r.guest_name, r.check_in, r.check_out, r.room_id
      INTO clash
      FROM reservations r
     WHERE r.property_id = NEW.property_id
       AND r.id IS DISTINCT FROM NEW.id
       AND COALESCE(r.status, '') <> 'cancelled'
       AND r.check_in IS NOT NULL
       AND r.check_out IS NOT NULL
       AND daterange(r.check_in::date, r.check_out::date, '[)')
        && daterange(NEW.check_in::date, NEW.check_out::date, '[)')
       AND (
              r.room_id IS NULL            -- existing takes the whole property
           OR NEW.room_id IS NULL          -- incoming takes the whole property
           OR r.room_id = NEW.room_id      -- same room
           )
     LIMIT 1;

    IF FOUND THEN
        clash_where := CASE
            WHEN clash.room_id IS NULL THEN 'the whole property'
            ELSE (SELECT name FROM rooms WHERE id = clash.room_id)
        END;

        RAISE EXCEPTION
            'Those dates are already taken. % has % from % to %.',
            COALESCE(NULLIF(clash.guest_name, ''), 'Booking ' || COALESCE(clash.booking_id, '?')),
            clash_where,
            to_char(clash.check_in::date,  'DD Mon'),
            to_char(clash.check_out::date, 'DD Mon')
            USING ERRCODE = '23P01';   -- exclusion_violation
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservation_conflict ON reservations;
CREATE TRIGGER trg_reservation_conflict
    BEFORE INSERT OR UPDATE OF check_in, check_out, room_id, property_id, status
    ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION resiq_check_booking_conflict();

-- ------------------------------------------------------------
-- 4. AVAILABILITY HELPER
-- ------------------------------------------------------------
-- Returns what can still be sold on a property for a date range. Used by the
-- booking form to populate the room picker, and by the calendar.
--
--   whole_available = the entire property can be sold as one unit
--   rooms           = individual rooms still free
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION resiq_availability(
    p_property_id INT,
    p_check_in    DATE,
    p_check_out   DATE
)
RETURNS TABLE (room_id BIGINT, room_name TEXT, is_available BOOLEAN)
AS $$
    WITH overlapping AS (
        SELECT r.room_id AS booked_room
          FROM reservations r
         WHERE r.property_id = p_property_id
           AND COALESCE(r.status, '') <> 'cancelled'
           AND r.check_in IS NOT NULL AND r.check_out IS NOT NULL
           AND daterange(r.check_in::date, r.check_out::date, '[)')
            && daterange(p_check_in, p_check_out, '[)')
    ),
    whole_taken AS (
        SELECT EXISTS (SELECT 1 FROM overlapping WHERE booked_room IS NULL) AS taken
    )
    -- The whole-property option, reported as room_id NULL.
    SELECT NULL::BIGINT,
           'Whole property'::TEXT,
           NOT (SELECT taken FROM whole_taken)
           AND NOT EXISTS (SELECT 1 FROM overlapping WHERE booked_room IS NOT NULL)
    UNION ALL
    -- Each individual room.
    SELECT rm.id,
           rm.name,
           NOT (SELECT taken FROM whole_taken)
           AND NOT EXISTS (SELECT 1 FROM overlapping o WHERE o.booked_room = rm.id)
      FROM rooms rm
     WHERE rm.property_id = p_property_id
       AND rm.is_active
     ORDER BY 1 NULLS FIRST;
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------
-- 5. RLS — rooms inherit their property's owner
-- ------------------------------------------------------------
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_rooms_select" ON rooms;
CREATE POLICY "jwt_rooms_select" ON rooms
    FOR SELECT TO authenticated
    USING (
        current_setting('request.jwt.claims', true)::jsonb->>'user_type' IN ('admin','staff')
        OR EXISTS (
            SELECT 1 FROM properties p
             WHERE p.id = rooms.property_id
               AND p.owner_id::text = current_setting('request.jwt.claims', true)::jsonb->>'owner_id'
        )
    );

DROP POLICY IF EXISTS "jwt_rooms_write" ON rooms;
CREATE POLICY "jwt_rooms_write" ON rooms
    FOR ALL TO authenticated
    USING (
        current_setting('request.jwt.claims', true)::jsonb->>'user_type' IN ('admin','staff')
        OR EXISTS (
            SELECT 1 FROM properties p
             WHERE p.id = rooms.property_id
               AND p.owner_id::text = current_setting('request.jwt.claims', true)::jsonb->>'owner_id'
        )
    );

COMMIT;

-- ============================================================
-- BEFORE YOU RELY ON THE GUARD: find overlaps already in the data
-- ============================================================
-- The trigger only fires on new writes, so any double bookings already
-- present will sit there silently. Run this to see them, and clean up
-- before telling anyone the app prevents double bookings.
--
--   SELECT a.property_id,
--          a.booking_id AS booking_a, a.guest_name AS guest_a,
--          b.booking_id AS booking_b, b.guest_name AS guest_b,
--          a.check_in, a.check_out, b.check_in, b.check_out
--     FROM reservations a
--     JOIN reservations b
--       ON a.property_id = b.property_id
--      AND a.id < b.id
--      AND daterange(a.check_in::date, a.check_out::date, '[)')
--       && daterange(b.check_in::date, b.check_out::date, '[)')
--    WHERE COALESCE(a.status,'') <> 'cancelled'
--      AND COALESCE(b.status,'') <> 'cancelled'
--      AND (a.room_id IS NULL OR b.room_id IS NULL OR a.room_id = b.room_id)
--    ORDER BY a.property_id, a.check_in;
-- ============================================================
