-- ============================================
-- OWNER PORTAL DATABASE SCHEMA
-- ResIQ by Hostizzy
-- ============================================

-- Table: property_owners
-- Stores owner information
CREATE TABLE IF NOT EXISTS property_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash TEXT, -- For authentication
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: payout_requests
-- Tracks payout requests from owners
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES property_owners(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    request_date TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending',
        -- Status values: 'pending', 'approved', 'processing', 'completed', 'rejected'
    approved_by UUID, -- Admin user who approved
    approval_date TIMESTAMP,
    payment_method VARCHAR(50) DEFAULT 'bank',
        -- Values: 'bank', 'upi', 'check'
    transaction_id VARCHAR(100),
    notes TEXT,
    rejection_reason TEXT,
    completed_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: owner_bank_accounts
-- Stores owner bank account details for payouts
CREATE TABLE IF NOT EXISTS owner_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES property_owners(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    account_holder_name VARCHAR(200) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20),
    bank_name VARCHAR(100),
    branch VARCHAR(100),
    upi_id VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(owner_id, is_primary) -- Only one primary account per owner
);

-- Add owner_id column to properties table if not exists
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES property_owners(id) ON DELETE SET NULL;

-- Add owner_id column to reservations table if not exists
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES property_owners(id) ON DELETE SET NULL;

-- Add commission columns to reservations if not exists
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS hostizzy_commission DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS owner_earnings DECIMAL(10,2);

-- Add commission tracking to properties
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20) DEFAULT 'percentage';
    -- Values: 'percentage', 'fixed'

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_owner ON payout_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_date ON payout_requests(request_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_owner ON owner_bank_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_reservations_owner ON reservations(owner_id);

-- Create view for owner revenue summary
CREATE OR REPLACE VIEW owner_revenue_summary AS
SELECT
    r.owner_id,
    po.name AS owner_name,
    COUNT(r.id) AS total_bookings,
    SUM(r.total_amount) AS total_revenue,
    SUM(r.hostizzy_commission) AS total_commission,
    SUM(r.owner_earnings) AS total_earnings,
    SUM(CASE WHEN r.payment_status = 'paid' THEN r.owner_earnings ELSE 0 END) AS paid_earnings,
    SUM(CASE WHEN r.payment_status IN ('pending', 'partial') THEN r.owner_earnings ELSE 0 END) AS pending_earnings
FROM reservations r
JOIN property_owners po ON r.owner_id = po.id
WHERE r.status IN ('confirmed', 'checked-in', 'checked-out')
GROUP BY r.owner_id, po.name;

-- Create view for pending payouts
CREATE OR REPLACE VIEW owner_available_payouts AS
SELECT
    ors.owner_id,
    ors.owner_name,
    ors.paid_earnings,
    COALESCE(SUM(pr.amount), 0) AS requested_amount,
    (ors.paid_earnings - COALESCE(SUM(pr.amount), 0)) AS available_for_payout
FROM owner_revenue_summary ors
LEFT JOIN payout_requests pr ON ors.owner_id = pr.owner_id
    AND pr.status IN ('pending', 'approved', 'processing')
GROUP BY ors.owner_id, ors.owner_name, ors.paid_earnings;

-- Function to calculate commission and earnings
CREATE OR REPLACE FUNCTION calculate_owner_earnings()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate commission (default 20%)
    NEW.hostizzy_commission := NEW.total_amount * 0.20;
    NEW.owner_earnings := NEW.total_amount - NEW.hostizzy_commission;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate earnings on insert/update
DROP TRIGGER IF EXISTS trg_calculate_earnings ON reservations;
CREATE TRIGGER trg_calculate_earnings
    BEFORE INSERT OR UPDATE OF total_amount
    ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_owner_earnings();

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_property_owners_updated_at
    BEFORE UPDATE ON property_owners
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at
    BEFORE UPDATE ON payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_owner_bank_accounts_updated_at
    BEFORE UPDATE ON owner_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional)
-- INSERT INTO property_owners (name, email, phone) VALUES
-- ('John Doe', 'john@example.com', '+91-9876543210'),
-- ('Jane Smith', 'jane@example.com', '+91-9876543211');

-- Comments for documentation
COMMENT ON TABLE property_owners IS 'Stores property owner information and authentication details';
COMMENT ON TABLE payout_requests IS 'Tracks payout requests from owners to Hostizzy';
COMMENT ON TABLE owner_bank_accounts IS 'Stores bank account details for owner payouts';
COMMENT ON VIEW owner_revenue_summary IS 'Aggregated view of owner revenue, commission, and earnings';
COMMENT ON VIEW owner_available_payouts IS 'Calculates available balance for payout requests';

-- ============================================
-- END OF SCHEMA
-- ============================================
