-- Round 5b: Gmail message ID dedup + payment status for OTA imports
-- Run AFTER round5-ical-schema.sql

-- 1. Store the Gmail message ID on imported reservations so re-scanning
--    the same inbox doesn't re-process the same emails.
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- Partial unique index: at most one reservation per Gmail message.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_gmail_message_id
    ON reservations (gmail_message_id)
    WHERE gmail_message_id IS NOT NULL;

-- Verification
SELECT
    COUNT(*) FILTER (WHERE gmail_message_id IS NOT NULL) AS with_gmail_id,
    COUNT(*) AS total
FROM reservations;
