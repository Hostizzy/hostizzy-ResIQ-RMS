-- Invoices Table for GST-compliant invoicing
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    booking_id VARCHAR(50) REFERENCES reservations(booking_id) ON DELETE CASCADE,
    guest_name VARCHAR(255) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,

    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cgst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    sgst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(10, 2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(10, 2) NOT NULL DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue')),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),

    -- Indexes
    CONSTRAINT valid_amounts CHECK (grand_total >= 0 AND subtotal >= 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_invoice_updated_at();

-- RLS Policies for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all invoices
CREATE POLICY "Allow authenticated users to view invoices"
ON invoices FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert invoices
CREATE POLICY "Allow authenticated users to insert invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update invoices
CREATE POLICY "Allow authenticated users to update invoices"
ON invoices FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete invoices
CREATE POLICY "Allow authenticated users to delete invoices"
ON invoices FOR DELETE
TO authenticated
USING (true);

-- Comments for documentation
COMMENT ON TABLE invoices IS 'GST-compliant invoices for bookings';
COMMENT ON COLUMN invoices.invoice_number IS 'Unique invoice number in format INV-YYYY-XXXX';
COMMENT ON COLUMN invoices.cgst_amount IS 'Central GST amount';
COMMENT ON COLUMN invoices.sgst_amount IS 'State GST amount';
COMMENT ON COLUMN invoices.total_gst IS 'Total GST (CGST + SGST)';
