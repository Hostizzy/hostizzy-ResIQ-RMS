-- Gmail OAuth Tokens Table
-- Stores Gmail OAuth tokens server-side (never exposed to the client)
-- Used by api/gmail-proxy.js to proxy Gmail API calls securely

CREATE TABLE IF NOT EXISTS gmail_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  gmail_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Only service role can access (tokens never exposed via client queries)
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no client access (only service_role key can read/write)

COMMENT ON TABLE gmail_tokens IS 'Server-side storage for Gmail OAuth tokens. Accessed only by api/gmail-proxy.js via service role key.';
