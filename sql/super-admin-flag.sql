-- ============================================================
-- An explicit super-admin flag
-- ============================================================
--
-- Seeing self-signup hosts' data was previously tied to team_members.role =
-- 'admin'. Those are two different questions:
--
--   role             what someone may DO inside Hostizzy's own book —
--                    edit bookings, manage the team, see Performance
--   is_super_admin   whether they may see OTHER PEOPLE'S businesses
--
-- Conflating them means every new Hostizzy admin silently gains access to
-- every host's guests, payments and KYC. Promoting someone to admin should
-- not be the thing that grants that.
--
-- Deliberately NOT a role value ('superadmin'): role already drives nav and
-- permissions in several places, and adding a fourth value would mean auditing
-- every `role === 'admin'` check. A separate boolean is additive and cannot
-- change what anyone can already do.

BEGIN;

ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN team_members.is_super_admin IS
    'Sees self-signup hosts data (bookings, guests, payments, the Hosts view). Separate from role, which governs what the person may do inside Hostizzy''s own book.';

CREATE INDEX IF NOT EXISTS idx_team_members_super_admin
    ON team_members (is_super_admin) WHERE is_super_admin;

-- ------------------------------------------------------------
-- Seed: exactly one, to start
-- ------------------------------------------------------------
UPDATE team_members
   SET is_super_admin = true
 WHERE lower(email) = 'admin@hostsphereindia.com';

-- ------------------------------------------------------------
-- There must always be at least one
-- ------------------------------------------------------------
-- Without this it is possible to remove the last super admin and lock the
-- Hosts view — and host approvals — out of the product entirely, with no way
-- back through the UI. Cheaper to refuse than to recover from.
CREATE OR REPLACE FUNCTION resiq_guard_last_super_admin()
RETURNS TRIGGER AS $$
DECLARE
    remaining INT;
BEGIN
    -- Only care about transitions that REMOVE a super admin.
    IF TG_OP = 'UPDATE'
       AND NOT (OLD.is_super_admin AND (NOT NEW.is_super_admin OR NOT NEW.is_active))
    THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' AND NOT OLD.is_super_admin THEN
        RETURN OLD;
    END IF;

    SELECT count(*) INTO remaining
      FROM team_members
     WHERE is_super_admin
       AND is_active
       AND id <> OLD.id;

    IF remaining = 0 THEN
        RAISE EXCEPTION
            'Cannot remove the last super admin. Grant it to someone else first.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_last_super_admin ON team_members;
CREATE TRIGGER trg_guard_last_super_admin
    BEFORE UPDATE OR DELETE ON team_members
    FOR EACH ROW EXECUTE FUNCTION resiq_guard_last_super_admin();

-- ------------------------------------------------------------
-- RLS reads the flag, not the role
-- ------------------------------------------------------------
-- api/auth-exchange.js now mints an is_super_admin claim. Falls back to the
-- old user_type = 'admin' test so a token issued before that deploy keeps
-- working for its remaining hour rather than losing access mid-session.
CREATE OR REPLACE FUNCTION resiq_is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb->>'is_super_admin')::boolean,
        current_setting('request.jwt.claims', true)::jsonb->>'user_type' = 'admin',
        false
    );
$$ LANGUAGE sql STABLE;

COMMIT;


-- ------------------------------------------------------------
-- Verify
-- ------------------------------------------------------------
SELECT name, email, role, is_active, is_super_admin
  FROM team_members
 ORDER BY is_super_admin DESC, name;

-- Exactly one row should have is_super_admin = true. To grant it to someone
-- else, use the Team view in the app, or:
--
--   UPDATE team_members SET is_super_admin = true WHERE email = '...';
--
-- Removing the last one is refused by the trigger above.
