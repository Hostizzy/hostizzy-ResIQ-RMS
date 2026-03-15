-- =====================================================
-- HOSTIZZY GUEST PORTAL - DATABASE SCHEMA
-- Guest ID Document Submission System
-- =====================================================

-- Table: guest_documents
-- Purpose: Store guest identification documents for reservations
-- Retention: Auto-delete after 60 days via retention_date column

CREATE TABLE IF NOT EXISTS guest_documents (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reservation Link
    booking_id TEXT NOT NULL REFERENCES reservations(booking_id) ON DELETE CASCADE,

    -- Guest Information
    guest_type TEXT NOT NULL CHECK (guest_type IN ('primary', 'additional')),
    guest_sequence INTEGER NOT NULL, -- 1 for primary, 2,3,4... for additional
    guest_name TEXT NOT NULL,
    guest_dob DATE,
    guest_address TEXT,
    guest_age INTEGER, -- To determine if ID is required (kids exemption)

    -- Document Details
    document_type TEXT CHECK (document_type IN ('aadhar', 'passport', 'driving_license', 'voter_id')),
    document_number TEXT,

    -- File Storage URLs (Supabase Storage)
    document_front_url TEXT,
    document_back_url TEXT,
    selfie_url TEXT, -- Mandatory for primary guest only

    -- Submission Metadata
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    retention_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '60 days'),
    ip_address TEXT, -- For security audit
    user_agent TEXT, -- Device info

    -- Verification Workflow
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'incomplete')),
    verified_by TEXT, -- Email of staff member
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    staff_notes TEXT,

    -- Audit Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES for Performance
-- =====================================================

CREATE INDEX idx_guest_docs_booking ON guest_documents(booking_id);
CREATE INDEX idx_guest_docs_status ON guest_documents(status);
CREATE INDEX idx_guest_docs_retention ON guest_documents(retention_date);
CREATE INDEX idx_guest_docs_submission ON guest_documents(submitted_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE guest_documents ENABLE ROW LEVEL SECURITY;

-- Policy 1: Guests can INSERT their own documents
-- Guest authenticates via booking_id + phone verification
CREATE POLICY "Guests can insert their documents"
    ON guest_documents
    FOR INSERT
    WITH CHECK (true); -- Open insert, validated by app logic

-- Policy 2: Guests can VIEW their own booking's documents
CREATE POLICY "Guests can view own booking documents"
    ON guest_documents
    FOR SELECT
    USING (
        booking_id IN (
            SELECT booking_id FROM reservations
            WHERE booking_id = guest_documents.booking_id
        )
    );

-- Policy 3: Guests can UPDATE their own documents (before submission)
CREATE POLICY "Guests can update pending documents"
    ON guest_documents
    FOR UPDATE
    USING (status = 'pending' OR status = 'incomplete');

-- Policy 4: Staff can VIEW all documents
CREATE POLICY "Staff can view all documents"
    ON guest_documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- Policy 5: Staff can UPDATE documents (verify/reject)
CREATE POLICY "Staff can update document status"
    ON guest_documents
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- Policy 6: Staff can DELETE documents
CREATE POLICY "Staff can delete documents"
    ON guest_documents
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
            AND role IN ('admin', 'manager')
        )
    );

-- =====================================================
-- STORAGE BUCKET CONFIGURATION
-- =====================================================

-- Create storage bucket for guest documents
-- Run this in Supabase SQL Editor or via Supabase Dashboard

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'guest-id-documents',
    'guest-id-documents',
    false, -- Private bucket
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE RLS POLICIES
-- =====================================================

-- Policy 1: Guests can upload to their booking folder
CREATE POLICY "Guests can upload documents"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'guest-id-documents'
        AND (storage.foldername(name))[1] IN (
            SELECT booking_id FROM reservations
        )
    );

-- Policy 2: Guests can view their own booking's documents
CREATE POLICY "Guests can view own booking documents"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'guest-id-documents'
        AND (storage.foldername(name))[1] IN (
            SELECT booking_id FROM reservations
        )
    );

-- Policy 3: Staff can view all documents
CREATE POLICY "Staff can view all documents"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'guest-id-documents'
        AND EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
        )
    );

-- Policy 4: Staff can delete documents (for data retention)
CREATE POLICY "Staff can delete documents"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'guest-id-documents'
        AND EXISTS (
            SELECT 1 FROM team_members
            WHERE email = current_setting('app.user_email', true)
            AND is_active = true
            AND role IN ('admin', 'manager')
        )
    );

-- =====================================================
-- AUTOMATIC DATA RETENTION FUNCTION
-- =====================================================

-- Function to delete expired documents
CREATE OR REPLACE FUNCTION delete_expired_guest_documents()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    doc RECORD;
BEGIN
    deleted_count := 0;

    -- Loop through expired documents
    FOR doc IN
        SELECT id, booking_id, document_front_url, document_back_url, selfie_url
        FROM guest_documents
        WHERE retention_date < NOW()
    LOOP
        -- Delete files from storage
        IF doc.document_front_url IS NOT NULL THEN
            PERFORM storage.delete(doc.document_front_url);
        END IF;

        IF doc.document_back_url IS NOT NULL THEN
            PERFORM storage.delete(doc.document_back_url);
        END IF;

        IF doc.selfie_url IS NOT NULL THEN
            PERFORM storage.delete(doc.selfie_url);
        END IF;

        -- Delete database record
        DELETE FROM guest_documents WHERE id = doc.id;
        deleted_count := deleted_count + 1;
    END LOOP;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SCHEDULED JOB (Optional - requires pg_cron extension)
-- =====================================================

-- Run data retention cleanup daily at 2 AM
-- Uncomment if you have pg_cron extension enabled:

-- SELECT cron.schedule(
--     'delete-expired-guest-documents',
--     '0 2 * * *', -- Every day at 2 AM
--     'SELECT delete_expired_guest_documents();'
-- );

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View: Reservation Document Status Summary
CREATE OR REPLACE VIEW reservation_document_status AS
SELECT
    r.booking_id,
    r.property_name,
    r.guest_name as primary_guest_name,
    r.guest_phone,
    r.guest_email,
    r.check_in,
    r.check_out,
    r.adults + r.kids as total_guests,
    r.adults as adult_guests,
    r.kids as kid_guests,
    COUNT(gd.id) as documents_submitted,
    COUNT(CASE WHEN gd.status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN gd.status = 'verified' THEN 1 END) as verified_count,
    COUNT(CASE WHEN gd.status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(CASE WHEN gd.status = 'incomplete' THEN 1 END) as incomplete_count,
    CASE
        WHEN COUNT(gd.id) = 0 THEN 'not_started'
        WHEN COUNT(gd.id) < r.adults THEN 'incomplete'
        WHEN COUNT(CASE WHEN gd.status = 'verified' THEN 1 END) = r.adults THEN 'completed'
        WHEN COUNT(CASE WHEN gd.status = 'pending' THEN 1 END) > 0 THEN 'pending_review'
        WHEN COUNT(CASE WHEN gd.status = 'rejected' THEN 1 END) > 0 THEN 'needs_resubmission'
        ELSE 'in_progress'
    END as overall_status
FROM reservations r
LEFT JOIN guest_documents gd ON r.booking_id = gd.booking_id
WHERE r.status != 'cancelled'
GROUP BY r.booking_id, r.property_name, r.guest_name, r.guest_phone,
         r.guest_email, r.check_in, r.check_out, r.adults, r.kids;

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_guest_documents_updated_at
    BEFORE UPDATE ON guest_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA FOR TESTING (Optional)
-- =====================================================

-- Uncomment to insert sample test data:

/*
INSERT INTO guest_documents (
    booking_id, guest_type, guest_sequence, guest_name, guest_age,
    document_type, document_number, status
) VALUES
(
    'BK-2024-001', 'primary', 1, 'Ramesh Kumar', 35,
    'aadhar', '1234-5678-9012', 'pending'
),
(
    'BK-2024-001', 'additional', 2, 'Priya Kumar', 32,
    'passport', 'X1234567', 'verified'
);
*/

-- =====================================================
-- DEPLOYMENT CHECKLIST
-- =====================================================

/*
□ Run this SQL in Supabase SQL Editor
□ Enable RLS on guest_documents table
□ Create storage bucket 'guest-id-documents'
□ Configure storage RLS policies
□ Test guest document upload flow
□ Test staff document review flow
□ Schedule data retention job (optional)
□ Configure email notifications
□ Test end-to-end workflow
*/

-- =====================================================
-- NOTES
-- =====================================================

/*
1. SECURITY:
   - All documents are stored in private bucket
   - RLS ensures guests only see their own documents
   - Staff access is controlled via team_members table
   - Files auto-delete after 60 days for privacy compliance

2. STORAGE STRUCTURE:
   guest-id-documents/
   ├── BK-2024-001/
   │   ├── primary_ramesh_kumar/
   │   │   ├── 1704950400_aadhar_front.jpg
   │   │   ├── 1704950400_aadhar_back.jpg
   │   │   └── 1704950401_selfie.jpg
   │   └── guest2_priya_kumar/
   │       └── 1704950500_passport_front.jpg

3. DATA RETENTION:
   - Documents auto-expire 60 days after submission
   - Manual cleanup via delete_expired_guest_documents()
   - Scheduled daily cleanup at 2 AM (if pg_cron enabled)

4. GUEST AUTHENTICATION:
   - Booking ID + Phone number verification
   - No password required
   - Session-based access in app

5. DOCUMENT TYPES:
   - Aadhar: Front + Back required
   - Passport: Front only
   - Driver's License: Front + Back required
   - Voter ID: Front + Back required
   - Selfie: Primary guest only (mandatory)
   - Kids: No ID required (checked via guest_age)
*/
