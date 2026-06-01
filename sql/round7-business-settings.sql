-- Round 7 — Business settings key-value table
-- Cross-device persistence for per-business settings that used to live
-- only in localStorage (business name, currency, timezone, email config,
-- WhatsApp config, notification toggles, email signature, etc.).
--
-- A null owner_id means "global" (Hostizzy staff defaults). A non-null
-- owner_id scopes the value to a single tenant.

CREATE TABLE IF NOT EXISTS business_settings (
  id BIGSERIAL PRIMARY KEY,
  owner_id BIGINT REFERENCES property_owners(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (owner_id, key)
);

CREATE INDEX IF NOT EXISTS idx_business_settings_owner_key
  ON business_settings (owner_id, key);

-- RLS — owners can only read/write their own rows; staff (no owner_id
-- claim) can read all. Service role is used by server APIs.
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bs_owner_select ON business_settings;
CREATE POLICY bs_owner_select ON business_settings
  FOR SELECT
  USING (
    owner_id IS NULL
    OR owner_id::text = current_setting('request.jwt.claims', true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS bs_owner_upsert ON business_settings;
CREATE POLICY bs_owner_upsert ON business_settings
  FOR ALL
  USING (
    owner_id::text = current_setting('request.jwt.claims', true)::jsonb->>'owner_id'
  )
  WITH CHECK (
    owner_id::text = current_setting('request.jwt.claims', true)::jsonb->>'owner_id'
  );

COMMENT ON TABLE business_settings IS
  'Per-owner key-value settings. Replaces localStorage-only persistence so '
  'operators do not lose configuration on cache clear or new device.';
