-- WhatsApp message history
-- Stores both outbound (sent by operator) and inbound (received from guest)
-- messages. Outbound logged by the app on send, inbound received via
-- the Meta Cloud API webhook (/api/whatsapp-webhook).

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT DEFAULT 'text',
  body TEXT,
  template_name TEXT,
  media_url TEXT,
  wamid TEXT UNIQUE,
  status TEXT DEFAULT 'sent',
  property_id INT,
  owner_id UUID REFERENCES property_owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON whatsapp_messages (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_booking ON whatsapp_messages (booking_id, created_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_wa_messages_select" ON whatsapp_messages;
CREATE POLICY "jwt_wa_messages_select" ON whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    current_setting('request.jwt.claims',true)::jsonb->>'user_type' IN ('admin','staff')
    OR owner_id::text = current_setting('request.jwt.claims',true)::jsonb->>'owner_id'
  );

DROP POLICY IF EXISTS "jwt_wa_messages_insert" ON whatsapp_messages;
CREATE POLICY "jwt_wa_messages_insert" ON whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE whatsapp_messages IS
  'WhatsApp message log — outbound (operator sent) and inbound (guest reply via webhook).';
