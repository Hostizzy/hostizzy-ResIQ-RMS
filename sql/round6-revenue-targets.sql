-- Round 6: Monthly Revenue Targets + Daily Notifications
--
-- Adds:
--   1. A singleton revenue_targets table holding the 3-tier monthly target
--      (default ₹40L / ₹50L / ₹60L, editable by admins).
--   2. A phone column on team_members so the daily WhatsApp target-update
--      cron can broadcast to each active team member.

-- ============================================================
-- 1. revenue_targets (singleton row, id = 1)
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue_targets (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    tier_1 NUMERIC(12, 2) NOT NULL DEFAULT 4000000,  -- ₹40L
    tier_2 NUMERIC(12, 2) NOT NULL DEFAULT 5000000,  -- ₹50L
    tier_3 NUMERIC(12, 2) NOT NULL DEFAULT 6000000,  -- ₹60L
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_email TEXT
);

-- Seed the singleton row if it doesn't exist yet
INSERT INTO revenue_targets (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Keep updated_at fresh on every update
CREATE OR REPLACE FUNCTION revenue_targets_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revenue_targets_updated_at ON revenue_targets;
CREATE TRIGGER trg_revenue_targets_updated_at
    BEFORE UPDATE ON revenue_targets
    FOR EACH ROW
    EXECUTE FUNCTION revenue_targets_touch_updated_at();

-- RLS: readable by anyone authenticated, updatable by admins only.
-- The app uses current_setting('app.user_email', true) as the identity
-- bridge (see sql/database-schema.sql:102-103), so we match the same.
ALTER TABLE revenue_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read targets" ON revenue_targets;
CREATE POLICY "Authenticated can read targets"
    ON revenue_targets FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can update targets" ON revenue_targets;
CREATE POLICY "Admins can update targets"
    ON revenue_targets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE lower(tm.email) = lower(coalesce(current_setting('app.user_email', true), ''))
              AND tm.role = 'admin'
              AND tm.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE lower(tm.email) = lower(coalesce(current_setting('app.user_email', true), ''))
              AND tm.role = 'admin'
              AND tm.is_active = true
        )
    );

-- Service-role calls (cron + /api/send-target-whatsapp) bypass RLS by
-- design — they use SUPABASE_SERVICE_ROLE_KEY, not the anon/auth key.

-- ============================================================
-- 2. team_members.phone (for WhatsApp broadcast)
-- ============================================================
-- Free-text so people can store "+91 98765 43210", "9876543210", etc.
-- The API layer normalises to E.164 before calling the Meta Cloud API.
ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================
-- Verification
-- ============================================================
SELECT id, tier_1, tier_2, tier_3, updated_at FROM revenue_targets;
SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'phone';
