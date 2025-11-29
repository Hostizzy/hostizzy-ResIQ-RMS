-- Communications Table for unified messaging hub (WhatsApp, Email, SMS)
CREATE TABLE IF NOT EXISTS communications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Message Details
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('whatsapp', 'email', 'sms', 'push')),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_contact VARCHAR(255) NOT NULL,  -- Phone number or email
    subject VARCHAR(500),  -- For email
    message_body TEXT NOT NULL,

    -- Related Booking (Optional)
    booking_id VARCHAR(50) REFERENCES reservations(booking_id) ON DELETE SET NULL,
    guest_id UUID,  -- Can link to guests table if exists

    -- Status & Delivery
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Error Tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Template Info
    template_name VARCHAR(100),  -- For WhatsApp templates
    template_variables JSONB,  -- Dynamic variables used in template

    -- Cost Tracking
    cost_amount DECIMAL(10, 2),  -- Cost per message (for SMS/WhatsApp)

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),

    -- Attachments
    attachments JSONB  -- Array of file URLs
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_communications_message_type ON communications(message_type);
CREATE INDEX IF NOT EXISTS idx_communications_booking_id ON communications(booking_id);
CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(status);
CREATE INDEX IF NOT EXISTS idx_communications_sent_at ON communications(sent_at);
CREATE INDEX IF NOT EXISTS idx_communications_created_at ON communications(created_at);
CREATE INDEX IF NOT EXISTS idx_communications_recipient ON communications(recipient_contact);

-- RLS Policies for communications
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all communications
CREATE POLICY "Allow authenticated users to view communications"
ON communications FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert communications
CREATE POLICY "Allow authenticated users to insert communications"
ON communications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update communications
CREATE POLICY "Allow authenticated users to update communications"
ON communications FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete communications
CREATE POLICY "Allow authenticated users to delete communications"
ON communications FOR DELETE
TO authenticated
USING (true);

-- Comments for documentation
COMMENT ON TABLE communications IS 'Unified communications hub for WhatsApp, Email, SMS, and Push notifications';
COMMENT ON COLUMN communications.message_type IS 'Type of communication: whatsapp, email, sms, or push';
COMMENT ON COLUMN communications.status IS 'Delivery status: pending, sent, delivered, failed, or read';
COMMENT ON COLUMN communications.template_variables IS 'JSON object containing template variable values';
COMMENT ON COLUMN communications.attachments IS 'JSON array of attachment URLs';
