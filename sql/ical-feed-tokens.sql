-- ============================================================
-- Outbound iCal feed tokens
-- ============================================================
--
-- The rooms migration gave rooms an ical_feed_token. Whole-place properties
-- need one too, because a property with no rooms publishes a single feed for
-- the entire place.
--
-- The token IS the authentication. The feed URL gets pasted into Airbnb and
-- Booking.com settings, so it must be unguessable, must not be derivable from
-- the property id, and must be revocable without touching anything else.
--
-- Nothing is generated here. Tokens are minted on demand when an owner first
-- asks for their feed URL, so properties that never use channel sync never
-- carry a live secret.
-- ============================================================

BEGIN;

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS ical_feed_token TEXT UNIQUE;

COMMENT ON COLUMN properties.ical_feed_token IS
    'Secret for this property''s outbound iCal feed. Minted on demand, revocable by setting a new value.';

-- The feed endpoint looks a token up on every request, so both lookups need
-- to be indexed. UNIQUE already covers properties; rooms.ical_feed_token got
-- its UNIQUE in the rooms migration.
CREATE INDEX IF NOT EXISTS idx_properties_feed_token
    ON properties (ical_feed_token) WHERE ical_feed_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_feed_token
    ON rooms (ical_feed_token) WHERE ical_feed_token IS NOT NULL;

COMMIT;
