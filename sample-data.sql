-- =====================================================
-- RESIQ - SAMPLE TEST DATA
-- Run this in Supabase SQL Editor to populate your database
-- =====================================================

-- Clean existing data (optional - uncomment if you want fresh start)
-- DELETE FROM payments;
-- DELETE FROM guest_documents;
-- DELETE FROM reservations;
-- DELETE FROM properties;
-- DELETE FROM team_members;

-- =====================================================
-- 1. TEAM MEMBERS (Staff Accounts)
-- =====================================================

INSERT INTO team_members (id, name, email, password, role, is_active, created_at)
VALUES
    (gen_random_uuid(), 'Admin User', 'admin@hostizzy.com', 'admin123', 'admin', true, NOW()),
    (gen_random_uuid(), 'Manager User', 'manager@hostizzy.com', 'manager123', 'manager', true, NOW()),
    (gen_random_uuid(), 'Staff User', 'staff@hostizzy.com', 'staff123', 'staff', true, NOW())
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- =====================================================
-- 2. PROPERTIES
-- =====================================================

INSERT INTO properties (id, name, location, type, capacity, revenue_share_percent, auto_sync_enabled, created_at)
VALUES
    (gen_random_uuid(), 'Sunset Villa', 'Lonavala, Maharashtra', 'villa', 12, 10.0, false, NOW()),
    (gen_random_uuid(), 'Mountain Retreat Farmhouse', 'Karjat, Maharashtra', 'farmhouse', 20, 8.0, false, NOW()),
    (gen_random_uuid(), 'Lakeside Cottage', 'Pawna Lake, Maharashtra', 'cottage', 8, 12.0, false, NOW()),
    (gen_random_uuid(), 'Urban Penthouse', 'Mumbai, Maharashtra', 'apartment', 6, 13.0, false, NOW())
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. RESERVATIONS (Mix of statuses and dates)
-- =====================================================

-- Get property IDs for reservations
DO $$
DECLARE
    property1_id UUID;
    property2_id UUID;
    property3_id UUID;
    property4_id UUID;
BEGIN
    SELECT id INTO property1_id FROM properties WHERE name = 'Sunset Villa' LIMIT 1;
    SELECT id INTO property2_id FROM properties WHERE name = 'Mountain Retreat Farmhouse' LIMIT 1;
    SELECT id INTO property3_id FROM properties WHERE name = 'Lakeside Cottage' LIMIT 1;
    SELECT id INTO property4_id FROM properties WHERE name = 'Urban Penthouse' LIMIT 1;

    -- Current bookings (checked-in)
    INSERT INTO reservations (
        id, booking_id, property_id, property_name, check_in, check_out, nights,
        status, booking_source, booking_type, guest_name, guest_email, guest_phone,
        adults, kids, total_amount, total_amount_inc_tax, hostizzy_revenue,
        revenue_share_percent, ota_service_fee, payment_status, paid_amount, created_at
    ) VALUES
    (
        gen_random_uuid(), 'BK-2025-001', property1_id, 'Sunset Villa',
        CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '2 days', 4,
        'checked-in', 'direct', 'STAYCATION', 'Rajesh Kumar', 'rajesh@example.com', '+91-9876543210',
        4, 2, 50000, 59000, 5000, 10.0, 0, 'paid', 59000, NOW() - INTERVAL '10 days'
    ),
    (
        gen_random_uuid(), 'BK-2025-002', property2_id, 'Mountain Retreat Farmhouse',
        CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '1 day', 2,
        'checked-in', 'airbnb', 'BIRTHDAY', 'Priya Sharma', 'priya@example.com', '+91-9988776655',
        8, 4, 35000, 41300, 2800, 8.0, 3500, 'paid', 41300, NOW() - INTERVAL '15 days'
    ),

    -- Upcoming bookings (confirmed)
    (
        gen_random_uuid(), 'BK-2025-003', property3_id, 'Lakeside Cottage',
        CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '8 days', 3,
        'confirmed', 'booking.com', 'WEDDING', 'Amit Patel', 'amit@example.com', '+91-9123456789',
        6, 0, 45000, 53100, 5400, 12.0, 4500, 'partial', 25000, NOW() - INTERVAL '5 days'
    ),
    (
        gen_random_uuid(), 'BK-2025-004', property1_id, 'Sunset Villa',
        CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '13 days', 3,
        'confirmed', 'direct', 'CORPORATE_EVENT', 'Tech Solutions Pvt Ltd', 'contact@techsol.com', '+91-9876501234',
        10, 0, 75000, 88500, 7500, 10.0, 0, 'pending', 0, NOW() - INTERVAL '3 days'
    ),
    (
        gen_random_uuid(), 'BK-2025-005', property4_id, 'Urban Penthouse',
        CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '9 days', 2,
        'confirmed', 'direct', 'CORPORATE_STAY', 'Neha Desai', 'neha@example.com', '+91-9988001122',
        4, 0, 30000, 35400, 3900, 13.0, 0, 'partial', 15000, NOW() - INTERVAL '2 days'
    ),

    -- Past bookings (checked-out)
    (
        gen_random_uuid(), 'BK-2024-101', property2_id, 'Mountain Retreat Farmhouse',
        CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '17 days', 3,
        'checked-out', 'direct', 'STAYCATION', 'Vikram Singh', 'vikram@example.com', '+91-9123445566',
        6, 3, 40000, 47200, 3200, 8.0, 0, 'paid', 47200, NOW() - INTERVAL '30 days'
    ),
    (
        gen_random_uuid(), 'BK-2024-102', property3_id, 'Lakeside Cottage',
        CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '13 days', 2,
        'checked-out', 'airbnb', 'SHOOT', 'FilmCo Productions', 'shoot@filmco.com', '+91-9876123456',
        10, 0, 60000, 70800, 7200, 12.0, 6000, 'paid', 70800, NOW() - INTERVAL '25 days'
    ),
    (
        gen_random_uuid(), 'BK-2024-103', property1_id, 'Sunset Villa',
        CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '8 days', 2,
        'checked-out', 'booking.com', 'BIRTHDAY', 'Meera Reddy', 'meera@example.com', '+91-9988112233',
        5, 2, 32000, 37760, 3200, 10.0, 3200, 'paid', 37760, NOW() - INTERVAL '20 days'
    ),

    -- Cancelled booking
    (
        gen_random_uuid(), 'BK-2024-999', property4_id, 'Urban Penthouse',
        CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '5 days', 2,
        'cancelled', 'direct', 'STAYCATION', 'Cancelled Guest', 'cancelled@example.com', '+91-9999999999',
        2, 0, 25000, 29500, 3250, 13.0, 0, 'refunded', 0, NOW() - INTERVAL '7 days'
    )
    ON CONFLICT DO NOTHING;

END $$;

-- =====================================================
-- 4. PAYMENTS (Linked to reservations)
-- =====================================================

DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM team_members WHERE email = 'admin@hostizzy.com' LIMIT 1;

    INSERT INTO payments (id, booking_id, payment_date, amount, payment_method, payment_source, reference_number, created_by, created_at)
    VALUES
        -- Payments for BK-2025-001 (fully paid)
        (gen_random_uuid(), 'BK-2025-001', CURRENT_DATE - INTERVAL '10 days', 30000, 'upi', 'guest', 'UPI-001', admin_id, NOW() - INTERVAL '10 days'),
        (gen_random_uuid(), 'BK-2025-001', CURRENT_DATE - INTERVAL '3 days', 29000, 'bank_transfer', 'guest', 'NEFT-123', admin_id, NOW() - INTERVAL '3 days'),

        -- Payments for BK-2025-002 (fully paid)
        (gen_random_uuid(), 'BK-2025-002', CURRENT_DATE - INTERVAL '15 days', 41300, 'ota', 'ota', 'AIRBNB-789', admin_id, NOW() - INTERVAL '15 days'),

        -- Payments for BK-2025-003 (partial)
        (gen_random_uuid(), 'BK-2025-003', CURRENT_DATE - INTERVAL '5 days', 25000, 'upi', 'guest', 'UPI-456', admin_id, NOW() - INTERVAL '5 days'),

        -- Payments for BK-2025-005 (partial)
        (gen_random_uuid(), 'BK-2025-005', CURRENT_DATE - INTERVAL '2 days', 15000, 'card', 'guest', 'CARD-789', admin_id, NOW() - INTERVAL '2 days'),

        -- Payments for past bookings (fully paid)
        (gen_random_uuid(), 'BK-2024-101', CURRENT_DATE - INTERVAL '30 days', 47200, 'cash', 'guest', 'CASH-001', admin_id, NOW() - INTERVAL '30 days'),
        (gen_random_uuid(), 'BK-2024-102', CURRENT_DATE - INTERVAL '25 days', 70800, 'ota', 'ota', 'AIRBNB-123', admin_id, NOW() - INTERVAL '25 days'),
        (gen_random_uuid(), 'BK-2024-103', CURRENT_DATE - INTERVAL '20 days', 37760, 'ota', 'ota', 'BOOKING-456', admin_id, NOW() - INTERVAL '20 days')
    ON CONFLICT DO NOTHING;

END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check inserted data
SELECT 'Team Members' as table_name, COUNT(*) as count FROM team_members
UNION ALL
SELECT 'Properties', COUNT(*) FROM properties
UNION ALL
SELECT 'Reservations', COUNT(*) FROM reservations
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments;

-- Summary by status
SELECT
    status,
    COUNT(*) as count,
    SUM(total_amount) as total_revenue,
    SUM(hostizzy_revenue) as hostizzy_revenue
FROM reservations
GROUP BY status
ORDER BY status;

COMMIT;
