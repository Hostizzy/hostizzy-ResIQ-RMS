-- Multi-Tenant SaaS Migration
-- Adds support for external property owner signups with admin approval

-- ─── Owner signup status ────────────────────────────────────────────
-- is_external: true for self-service signups, false for Hostizzy-managed owners
-- status: pending → approved/rejected (pending owners cannot access the app)
ALTER TABLE property_owners ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;
ALTER TABLE property_owners ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- ─── Team member ownership ──────────────────────────────────────────
-- owner_id: links team members to their owner (null = Hostizzy super-admin)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES property_owners(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(owner_id);
