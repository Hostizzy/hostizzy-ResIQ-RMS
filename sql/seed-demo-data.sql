-- ============================================================
-- Demo data for marketing screenshots
-- ============================================================
--
-- Why not just screenshot the real app
-- ------------------------------------
-- The obvious screenshots show Hostizzy's live account, which means a public
-- marketing page would publish:
--
--   • real guests by name, next to how much they owe
--     (₹3,30,000 overdue against a named individual)
--   • real property names and their owners
--   • Hostizzy's own commercial position — ₹2.12 Cr outstanding, monthly
--     revenue, commission earned, OTA fees
--
-- Guest names alongside outstanding balances is personal data being published
-- without consent, which in India is a DPDP Act problem rather than only a
-- matter of taste.
--
-- There is a second, independent reason. Those screens are the Hostizzy STAFF
-- view: 38 properties, a Hostizzy Revenue tile, an OTA Fees tile. The page
-- sells to someone with one homestay. A 38-property operator dashboard tells
-- that visitor the product is not for them — the opposite of what the page
-- spent 800 words establishing.
--
-- So: same app, same rendering, representative data. This seeds the test host
-- from sql/create-test-host.sql with a plausible month, then you screenshot
-- that account on a real device.
--
-- Requires sql/create-test-host.sql to have been run first.
-- Every row is tagged DEMO- so the teardown at the bottom is exact.

BEGIN;

-- Bookings across the next few weeks: two OTA, two direct, one checked out
-- still owing, one arriving today. Amounts are what a real homestay charges,
-- not lakhs — the visitor has to see themselves in this.
INSERT INTO reservations (
    booking_id, property_id, property_name, room_id,
    guest_name, guest_phone, guest_city,
    check_in, check_out, nights, month,
    adults, kids, number_of_guests, number_of_rooms,
    booking_source, booking_type, status, gst_status,
    stay_amount, extra_guest_charges, meals_chef, bonfire_other,
    ota_service_fee, taxes, damages,
    total_amount_pre_tax, total_amount_inc_tax, total_amount,
    paid_amount, revenue_share_percent, hostizzy_revenue,
    payout_eligible, host_payout, is_legacy, booking_date
)
SELECT
    v.booking_id, p.id, p.name,
    (SELECT id FROM rooms r WHERE r.property_id = p.id AND r.name = v.room_name),
    v.guest_name, v.phone, v.city,
    CURRENT_DATE + v.in_offset, CURRENT_DATE + v.out_offset,
    v.out_offset - v.in_offset,
    to_char(CURRENT_DATE + v.in_offset, 'Mon YYYY'),
    v.adults, v.kids, v.adults + v.kids, 1,
    v.source, 'standard', v.status, 'non_gst',
    v.stay, 0, v.meals, 0,
    0, 0, 0,
    v.stay + v.meals, v.stay + v.meals, v.stay + v.meals,
    v.paid, 0, 0,
    v.stay + v.meals, v.stay + v.meals, false,
    CURRENT_DATE - 9
FROM properties p
CROSS JOIN (VALUES
    -- booking_id     guest              phone            city        room          in  out  ad kd source        status        stay    meals  paid
    ('DEMO-A7K2M4', 'Ananya Deshpande', '+91 98200 41122', 'Mumbai',   'Garden Room', 0,  3, 2, 0, 'AIRBNB',      'checked-in',  10500,  1800, 12300),
    ('DEMO-B3P9X1', 'Rohit Menon',      '+91 99400 77310', 'Chennai',  'Attic Room',  0,  2, 4, 1, 'DIRECT',      'checked-in',  10400,  2400,  6000),
    ('DEMO-C8T5R6', 'Farida Contractor','+91 98330 20984', 'Pune',     'Garden Room', 4,  8, 2, 0, 'MAKEMYTRIP',  'confirmed',   14000,  2400, 16400),
    ('DEMO-D2W7L9', 'Karan Sethi',      '+91 97110 55402', 'Delhi',    'Attic Room',  6,  9, 3, 2, 'BOOKING',     'confirmed',   15600,  3600,  9600),
    ('DEMO-E5N1J8', 'Meghna Iyer',      '+91 96320 18877', 'Bengaluru','Garden Room',-4, -1, 2, 0, 'DIRECT',      'checked-out', 10500,  1800,  8300),
    ('DEMO-F9H4Q3', 'Vikram Rao',       '+91 90040 63251', 'Hyderabad','Attic Room', 11, 14, 4, 0, 'AIRBNB',      'confirmed',   15600,  2400, 18000)
) AS v(booking_id, guest_name, phone, city, room_name, in_offset, out_offset,
       adults, kids, source, status, stay, meals, paid)
WHERE p.name = 'Test Host Homestay'
  AND NOT EXISTS (SELECT 1 FROM reservations x WHERE x.booking_id = v.booking_id);

-- Payments behind the paid_amounts above, so the Payments screen is not empty
-- and the two part-paid bookings show a real balance.
INSERT INTO payments (booking_id, amount, payment_date, payment_method, notes)
SELECT v.booking_id, v.amount, CURRENT_DATE - v.days_ago, v.method, 'Demo data'
  FROM (VALUES
    ('DEMO-A7K2M4', 12300.00,  8, 'upi'),
    ('DEMO-B3P9X1',  6000.00,  6, 'upi'),
    ('DEMO-C8T5R6', 16400.00,  3, 'bank_transfer'),
    ('DEMO-D2W7L9',  9600.00,  2, 'upi'),
    ('DEMO-E5N1J8',  8300.00, 12, 'cash'),
    ('DEMO-F9H4Q3', 18000.00,  1, 'bank_transfer')
  ) AS v(booking_id, amount, days_ago, method)
 WHERE EXISTS (SELECT 1 FROM reservations r WHERE r.booking_id = v.booking_id)
   AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = v.booking_id);

COMMIT;


-- ------------------------------------------------------------
-- What you should see
-- ------------------------------------------------------------
SELECT r.booking_id, r.guest_name, rm.name AS room, r.check_in, r.check_out,
       r.status, r.total_amount, r.paid_amount,
       r.total_amount - r.paid_amount AS balance
  FROM reservations r
  LEFT JOIN rooms rm ON rm.id = r.room_id
 WHERE r.booking_id LIKE 'DEMO-%'
 ORDER BY r.check_in;

-- Two arriving today, one checked out still owing ₹4,000, two part-paid,
-- one fully paid. Enough for the dashboard, the reservations list, the
-- payments screen and a calendar month that is neither empty nor solid.


-- ------------------------------------------------------------
-- TEARDOWN — run this once the screenshots are taken
-- ------------------------------------------------------------
-- DELETE FROM payments     WHERE booking_id LIKE 'DEMO-%';
-- DELETE FROM reservations WHERE booking_id LIKE 'DEMO-%';
