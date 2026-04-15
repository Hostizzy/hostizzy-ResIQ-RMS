-- Round 6b: Tier milestone tracking
--
-- Adds two columns to revenue_targets that the daily cron uses to fire a
-- celebratory email + WhatsApp broadcast exactly once per tier-crossing
-- per month. Columns are keyed by month so the state auto-resets when
-- the calendar flips.
--
-- Run AFTER sql/round6-revenue-targets.sql.

ALTER TABLE revenue_targets
    ADD COLUMN IF NOT EXISTS last_tier_crossed_level INT NOT NULL DEFAULT 0
        CHECK (last_tier_crossed_level BETWEEN 0 AND 3),
    ADD COLUMN IF NOT EXISTS last_tier_crossed_month TEXT;  -- 'YYYY-MM' in IST

-- Verification
SELECT id, tier_1, tier_2, tier_3, last_tier_crossed_level, last_tier_crossed_month, updated_at
FROM revenue_targets;
