-- FCM Push Notification Tokens
-- Stores Firebase Cloud Messaging tokens for the Flutter app.
-- Used by api/push-fcm.js to send push notifications.

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_email TEXT,
  role TEXT,
  platform TEXT DEFAULT 'android',
  device_info TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: add columns if table already exists
DO $$ BEGIN
  ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS role TEXT;
  ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS device_info TEXT;
  ALTER TABLE fcm_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_email ON fcm_tokens (user_email);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_role ON fcm_tokens (role);

-- RLS: authenticated users can manage their own tokens
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_fcm_select" ON fcm_tokens;
CREATE POLICY "jwt_fcm_select" ON fcm_tokens
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "jwt_fcm_insert" ON fcm_tokens;
CREATE POLICY "jwt_fcm_insert" ON fcm_tokens
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "jwt_fcm_update" ON fcm_tokens;
CREATE POLICY "jwt_fcm_update" ON fcm_tokens
  FOR UPDATE TO authenticated
  USING (true);

DROP POLICY IF EXISTS "jwt_fcm_delete" ON fcm_tokens;
CREATE POLICY "jwt_fcm_delete" ON fcm_tokens
  FOR DELETE TO authenticated
  USING (
    user_email = current_setting('request.jwt.claims',true)::jsonb->>'email'
  );

COMMENT ON TABLE fcm_tokens IS
  'FCM tokens for mobile push notifications. Managed by /api/push-fcm.';
