-- Round 6c: Web Push subscription storage
--
-- Stores PushSubscription objects from browsers that opted in to receive
-- push notifications. One row per device/browser per user (a user on
-- phone + laptop gets two rows).
--
-- The daily-summary cron iterates this table, stripping expired/invalid
-- subscriptions (410 Gone) on failure.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,          -- matches team_members.email (the identity bridge)
    endpoint TEXT NOT NULL UNIQUE,      -- PushSubscription.endpoint (unique per browser)
    p256dh TEXT NOT NULL,               -- PushSubscription.keys.p256dh
    auth TEXT NOT NULL,                 -- PushSubscription.keys.auth
    user_agent TEXT,                    -- Navigator.userAgent, for debugging
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_email ON push_subscriptions(user_email);

-- RLS: user can manage their own subscriptions only.
-- Service role (cron + /api/send-push) bypasses RLS.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their own push subs" ON push_subscriptions;
CREATE POLICY "Owners manage their own push subs"
    ON push_subscriptions
    FOR ALL
    USING (lower(user_email) = lower(coalesce(current_setting('app.user_email', true), '')))
    WITH CHECK (lower(user_email) = lower(coalesce(current_setting('app.user_email', true), '')));

SELECT 'push_subscriptions table created' AS status;
