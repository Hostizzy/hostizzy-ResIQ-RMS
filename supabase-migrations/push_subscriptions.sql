-- ============================================
-- PUSH NOTIFICATIONS SCHEMA
-- ============================================
-- This migration adds support for Web Push Notifications

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User identification
  user_id UUID,  -- Links to team_members(id) or property_owners(id)
  user_type TEXT NOT NULL CHECK (user_type IN ('staff', 'owner', 'guest')),
  user_email TEXT NOT NULL,

  -- Push subscription details (from PushSubscription API)
  endpoint TEXT NOT NULL UNIQUE,
  expiration_time TIMESTAMPTZ,

  -- Keys from subscription.toJSON()
  p256dh_key TEXT NOT NULL,  -- keys.p256dh
  auth_key TEXT NOT NULL,    -- keys.auth

  -- Metadata
  user_agent TEXT,  -- Browser/device info
  ip_address INET,  -- For security auditing

  -- Notification preferences
  enabled BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '[]'::JSONB,  -- Array of enabled notification types

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_type
  ON push_subscriptions(user_type);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_email
  ON push_subscriptions(user_email);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled
  ON push_subscriptions(enabled) WHERE enabled = true;

-- Create notification_logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Notification details
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,  -- 'kyc_submitted', 'payment_received', etc.

  -- Payload
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT,
  badge TEXT,
  data JSONB,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'clicked')),
  error_message TEXT,

  -- Related entity
  booking_id TEXT,
  payment_id UUID,
  document_id UUID,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_subscription
  ON notification_logs(subscription_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_booking
  ON notification_logs(booking_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_status
  ON notification_logs(status);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created
  ON notification_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (
    user_email = auth.jwt() ->> 'email'
    OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert their own subscriptions"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (
    user_email = auth.jwt() ->> 'email'
    OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own subscriptions"
  ON push_subscriptions
  FOR UPDATE
  USING (
    user_email = auth.jwt() ->> 'email'
    OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (
    user_email = auth.jwt() ->> 'email'
    OR
    user_id = auth.uid()
  );

-- Policy: Staff can view all subscriptions (for admin dashboard)
CREATE POLICY "Staff can view all subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.email = auth.jwt() ->> 'email'
      AND team_members.role IN ('admin', 'manager')
    )
  );

-- Policy: Users can view their own notification logs
CREATE POLICY "Users can view their notification logs"
  ON notification_logs
  FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM push_subscriptions
      WHERE user_email = auth.jwt() ->> 'email'
      OR user_id = auth.uid()
    )
  );

-- Policy: Service role can insert notification logs (from Edge Function)
CREATE POLICY "Service can insert notification logs"
  ON notification_logs
  FOR INSERT
  WITH CHECK (true);  -- Edge Function uses service_role key

CREATE POLICY "Service can update notification logs"
  ON notification_logs
  FOR UPDATE
  USING (true);  -- For updating status (sent, clicked, failed)

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to clean up expired subscriptions
CREATE OR REPLACE FUNCTION cleanup_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_subscriptions
  WHERE expiration_time IS NOT NULL
    AND expiration_time < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update last_used timestamp
CREATE OR REPLACE FUNCTION update_subscription_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE push_subscriptions
  SET last_used = NOW()
  WHERE id = NEW.subscription_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_used when notification is sent
CREATE TRIGGER trigger_update_subscription_last_used
  AFTER INSERT ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_last_used();

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SCHEDULED CLEANUP (pg_cron)
-- ============================================
-- Run daily at 3 AM to clean expired subscriptions
-- Note: pg_cron must be enabled in Supabase
-- SELECT cron.schedule(
--   'cleanup-expired-push-subscriptions',
--   '0 3 * * *',  -- Every day at 3 AM
--   $$SELECT cleanup_expired_subscriptions();$$
-- );

-- ============================================
-- NOTIFICATION TYPES REFERENCE
-- ============================================
-- Store as comments for reference

-- Available notification types:
COMMENT ON TABLE push_subscriptions IS 'Stores Web Push API subscriptions for push notifications';
COMMENT ON COLUMN push_subscriptions.notification_types IS
'Array of enabled notification types:
- kyc_submitted: Guest document uploaded
- kyc_verified: Document approved
- kyc_rejected: Document rejected
- payment_received: Payment recorded
- payment_overdue: Payment overdue
- checkin_today: Check-in happening today
- checkout_today: Check-out happening today
- new_booking: New reservation created
- booking_cancelled: Reservation cancelled
- message_received: New chat message
- system_alert: Important system notification';

-- ============================================
-- SAMPLE DATA (for testing only)
-- ============================================
-- Uncomment to insert test data

-- INSERT INTO push_subscriptions (
--   user_type,
--   user_email,
--   endpoint,
--   p256dh_key,
--   auth_key,
--   notification_types
-- ) VALUES (
--   'staff',
--   'test@hostizzy.com',
--   'https://fcm.googleapis.com/fcm/send/test-endpoint',
--   'test-p256dh-key',
--   'test-auth-key',
--   '["kyc_submitted", "payment_received", "new_booking"]'::JSONB
-- );
