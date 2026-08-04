-- ============================================================
-- account_type, and a home for host-only fields
-- ============================================================
--
-- What this is NOT
-- ----------------
-- Not a split of property_owners into two tables. That was considered and
-- rejected: property_owners.id is the anchor for 9 foreign keys across
-- properties, reservations, payout_requests, settlement_status, team_members,
-- business_settings, automation_dispatch_log, whatsapp_messages and
-- property_expenses. Splitting it means every one of those either gains a
-- second nullable FK, or goes polymorphic and loses referential integrity
-- entirely — Postgres cannot enforce a key that points at two tables. It would
-- also make the owner_id claim in the auth-exchange JWT ambiguous, which all 37
-- RLS policies read.
--
-- The actual complaints were about naming and about dead columns, and both are
-- fixable without touching identity.
--
-- 1. account_type
--    is_external is a boolean that requires you to know that "external" means
--    "signed up themselves". account_type says it outright: 'managed' | 'host'.
--    Both columns are kept in sync by a trigger so existing code that reads or
--    writes is_external keeps working, and the two can never disagree. Once
--    nothing writes is_external any more it can be dropped.
--
-- 2. host_profiles
--    A 1:1 table for things that only apply to a host — plan, limits,
--    onboarding state, billing later. Keeps host concerns together and lets
--    them grow without adding columns to a table managed owners also use.
--
-- Managed-owner-only fields (commission_rate, bank_account_number, pan_number,
-- gst_number) are deliberately left where they are. Moving them means touching
-- working payout and settlement code for a tidiness gain; if they become a real
-- problem, a managed_owner_profiles table is the same pattern applied again.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. ACCOUNT TYPE
-- ------------------------------------------------------------
-- A CHECK rather than a Postgres ENUM: enums need ALTER TYPE to extend and
-- can't be changed inside a transaction in older versions, which makes future
-- additions (say 'agency') needlessly awkward.
ALTER TABLE property_owners
    ADD COLUMN IF NOT EXISTS account_type TEXT;

UPDATE property_owners
   SET account_type = CASE WHEN is_external THEN 'host' ELSE 'managed' END
 WHERE account_type IS NULL;

ALTER TABLE property_owners
    ALTER COLUMN account_type SET DEFAULT 'managed';

DO $$ BEGIN
    ALTER TABLE property_owners
        ADD CONSTRAINT property_owners_account_type_check
        CHECK (account_type IN ('managed', 'host'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN property_owners.account_type IS
    'managed = Hostizzy runs the property (commission, settlements, payouts). host = signed up themselves, runs their own.';
COMMENT ON COLUMN property_owners.is_external IS
    'DEPRECATED — mirrors account_type = ''host''. Kept in sync by a trigger for older code. Drop once nothing writes it.';

-- ------------------------------------------------------------
-- 2. KEEP THE TWO IN STEP
-- ------------------------------------------------------------
-- Writers exist for both spellings right now (the landing page and js/auth.js
-- set is_external; newer code sets account_type). Rather than change every
-- caller in one go and hope, sync them at the row level so whichever is written
-- the other follows. This is what makes the migration incremental instead of a
-- flag day.
CREATE OR REPLACE FUNCTION resiq_sync_account_type()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.account_type IS NOT NULL THEN
            NEW.is_external := (NEW.account_type = 'host');
        ELSIF NEW.is_external IS NOT NULL THEN
            NEW.account_type := CASE WHEN NEW.is_external THEN 'host' ELSE 'managed' END;
        ELSE
            NEW.account_type := 'managed';
            NEW.is_external  := false;
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE: whichever column actually changed wins.
    IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
        NEW.is_external := (NEW.account_type = 'host');
    ELSIF NEW.is_external IS DISTINCT FROM OLD.is_external THEN
        NEW.account_type := CASE WHEN NEW.is_external THEN 'host' ELSE 'managed' END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_account_type ON property_owners;
CREATE TRIGGER trg_sync_account_type
    BEFORE INSERT OR UPDATE ON property_owners
    FOR EACH ROW EXECUTE FUNCTION resiq_sync_account_type();

CREATE INDEX IF NOT EXISTS idx_property_owners_account_type
    ON property_owners (account_type);

-- ------------------------------------------------------------
-- 3. HOST PROFILES
-- ------------------------------------------------------------
-- Everything that only means something for a self-signup host. Rows are created
-- on demand, so a managed owner never carries an empty one.
CREATE TABLE IF NOT EXISTS host_profiles (
    owner_id                UUID PRIMARY KEY
                            REFERENCES property_owners(id) ON DELETE CASCADE,

    -- Billing counts PROPERTIES, not rooms. A four-room homestay is one
    -- property; counting rooms would push a single-homestay owner past the
    -- free tier for one house.
    plan                    TEXT NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro')),
    max_properties          INT  NOT NULL DEFAULT 1,

    -- Onboarding state, so we can tell "approved and running" from "approved
    -- and never came back" — which is the churn signal worth watching.
    onboarding_completed_at TIMESTAMPTZ,
    first_property_at       TIMESTAMPTZ,
    first_booking_at        TIMESTAMPTZ,

    notes                   TEXT,          -- internal, not shown to the host
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE host_profiles IS
    'Host-only settings. 1:1 with property_owners where account_type = ''host''. Managed owners have no row.';

-- Backfill a free-plan row for every existing host so the app never has to
-- handle "host with no profile".
INSERT INTO host_profiles (owner_id)
SELECT id FROM property_owners
 WHERE account_type = 'host'
   AND id NOT IN (SELECT owner_id FROM host_profiles)
ON CONFLICT (owner_id) DO NOTHING;

-- ------------------------------------------------------------
-- 4. RLS — a host sees only their own profile
-- ------------------------------------------------------------
ALTER TABLE host_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_host_profiles_select" ON host_profiles;
CREATE POLICY "jwt_host_profiles_select" ON host_profiles
    FOR SELECT TO authenticated
    USING (
        current_setting('request.jwt.claims', true)::jsonb->>'user_type' IN ('admin','staff')
        OR owner_id::text = current_setting('request.jwt.claims', true)::jsonb->>'owner_id'
    );

-- Plan and limits are ours to set, not the host's. Read-only for them.
DROP POLICY IF EXISTS "jwt_host_profiles_write" ON host_profiles;
CREATE POLICY "jwt_host_profiles_write" ON host_profiles
    FOR ALL TO authenticated
    USING (current_setting('request.jwt.claims', true)::jsonb->>'user_type' IN ('admin','staff'));

COMMIT;

-- ============================================================
-- Checks
-- ============================================================
--   SELECT account_type, is_external, count(*)
--     FROM property_owners GROUP BY 1,2 ORDER BY 1;
--   -- expect exactly: managed/false and host/true. Any other pairing is a bug.
--
--   SELECT count(*) FROM property_owners WHERE account_type = 'host';
--   SELECT count(*) FROM host_profiles;
--   -- these two should match.
-- ============================================================
