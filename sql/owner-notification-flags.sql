-- ============================================================
-- Owner signup / approval notification flags
-- ============================================================
--
-- Two timestamps so each notification goes out exactly once.
--
-- The signup notification is triggered from the public landing page, before
-- anyone is logged in — it cannot be authenticated. Without a "already sent"
-- marker, replaying that request would let someone flood the Hostizzy inbox
-- with real-looking signup alerts. The flag is what makes an unauthenticated
-- trigger safe.
--
-- The approval notification is an admin action and is authenticated, but the
-- same flag stops a double-click sending the owner two welcome emails.
--
-- Both are nullable and default NULL, so existing rows are simply "not yet
-- notified" — which is accurate.
-- ============================================================

BEGIN;

ALTER TABLE property_owners
    ADD COLUMN IF NOT EXISTS signup_notified_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN property_owners.signup_notified_at IS
    'When the Hostizzy team was told about this signup. Set once by /api/owner-notify.';
COMMENT ON COLUMN property_owners.approved_notified_at IS
    'When this owner was emailed that their account is live. Set once by /api/owner-notify.';

COMMIT;

-- ============================================================
-- Backfill note
-- ============================================================
-- Owners who signed up before this existed have both columns NULL, so they
-- read as "never notified". That's true, but it also means approving one of
-- them now will correctly send a welcome email — which is what you want.
--
-- If you'd rather suppress notifications for the existing backlog, mark them
-- as already handled:
--
--   UPDATE property_owners
--      SET signup_notified_at = COALESCE(signup_notified_at, NOW()),
--          approved_notified_at = COALESCE(approved_notified_at, NOW())
--    WHERE created_at < NOW() - INTERVAL '1 day';
-- ============================================================
