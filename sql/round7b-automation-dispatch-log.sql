-- Round 7b — Automation dispatch log
-- Tracks which template fired for which reservation, so the hourly
-- automation cron never sends the same trigger twice for the same
-- booking. Idempotency key = (booking_id, rule_key).
--
-- Rule keys map to existing email template settings:
--   booking_confirmation   -> emailTemplateBookingConfirm
--   payment_reminder       -> emailTemplatePaymentReminder
--   check_in_instructions  -> emailTemplateCheckinInstructions
--   thank_you              -> emailTemplateThankYou
--   payment_receipt        -> emailTemplatePaymentReceipt

CREATE TABLE IF NOT EXISTS automation_dispatch_log (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  channel TEXT NOT NULL,                       -- 'email' | 'whatsapp'
  recipient TEXT,
  status TEXT NOT NULL,                        -- 'sent' | 'failed' | 'skipped'
  error TEXT,
  owner_id UUID REFERENCES property_owners(id) ON DELETE CASCADE,
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_dispatch_owner_time
  ON automation_dispatch_log (owner_id, dispatched_at DESC);

ALTER TABLE automation_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adl_owner_read ON automation_dispatch_log;
CREATE POLICY adl_owner_read ON automation_dispatch_log
  FOR SELECT
  USING (
    owner_id IS NULL
    OR owner_id::text = current_setting('request.jwt.claims', true)::jsonb->>'owner_id'
  );

-- No client INSERT / UPDATE / DELETE policy — only the service-role
-- automation cron writes here.

COMMENT ON TABLE automation_dispatch_log IS
  'Idempotency log for the hourly automation cron. One row per '
  '(booking_id, rule_key) combination so a template never re-fires.';
