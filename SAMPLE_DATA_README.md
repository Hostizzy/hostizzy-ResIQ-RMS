# Sample Data Setup Guide

## Problem
Your Supabase database tables exist but are empty, causing:
- ✅ Homepage shows all zeros (no reservations/payments)
- ❌ Analytics has no data to display
- ❌ Most modals fail because they need existing data

## Solution
Run the `sample-data.sql` file in your Supabase SQL Editor to populate test data.

## Steps to Add Sample Data

### 1. Open Supabase SQL Editor
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: **dxthxsguqrxpurorpokq**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Run the Sample Data Script
1. Open the file `/sample-data.sql` in this repository
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** (or press `Ctrl+Enter`)

### 3. Verify Data Loaded
The script will output a summary showing:
```
table_name      | count
----------------|------
Team Members    | 3
Properties      | 4
Reservations    | 9
Payments        | 8
```

### 4. Refresh Your App
- Go back to http://localhost:3000/
- Login with: `admin@hostizzy.com` / `admin123`
- You should now see:
  - **Homepage**: Stats showing 9 reservations, revenue, etc.
  - **Analytics**: Charts and graphs with data
  - **Modals**: All modals working with sample data

## Sample Data Overview

### Team Members (3 accounts)
| Email | Password | Role |
|-------|----------|------|
| admin@hostizzy.com | admin123 | admin |
| manager@hostizzy.com | manager123 | manager |
| staff@hostizzy.com | staff123 | staff |

### Properties (4 properties)
- **Sunset Villa** - Lonavala (12 guests, 10% commission)
- **Mountain Retreat Farmhouse** - Karjat (20 guests, 8% commission)
- **Lakeside Cottage** - Pawna Lake (8 guests, 12% commission)
- **Urban Penthouse** - Mumbai (6 guests, 13% commission)

### Reservations (9 bookings)
- **2 Active** (checked-in today)
- **3 Upcoming** (confirmed future bookings)
- **3 Past** (checked-out completed stays)
- **1 Cancelled** (for testing cancellation flow)

Total revenue in sample data: **₹392,000** ($4,700 USD)

### Payments (8 transactions)
- Mix of payment methods: UPI, Bank Transfer, Card, Cash, OTA
- Some bookings fully paid, some partial
- Realistic transaction references

## Test Scenarios

After loading data, you can test:

1. **Dashboard View**
   - Total Reservations: 9
   - Active Bookings: 2
   - Upcoming Bookings: 3
   - Revenue Metrics displayed

2. **Reservations Page**
   - Filter by status (Confirmed, Checked-in, Checked-out, Cancelled)
   - Search by guest name
   - View reservation details modal
   - Edit reservation
   - Add payment to partial-paid bookings

3. **Payments Page**
   - View all 8 payment transactions
   - Filter by payment method
   - Search by booking ID

4. **Analytics Page**
   - Revenue charts showing trends
   - Booking source breakdown (Direct, Airbnb, Booking.com)
   - Occupancy metrics
   - Property performance comparison

5. **Properties Page**
   - View all 4 properties
   - Edit property details
   - See booking history per property

## Clean Slate (Optional)

If you want to start fresh later, uncomment these lines in `sample-data.sql`:
```sql
DELETE FROM payments;
DELETE FROM guest_documents;
DELETE FROM reservations;
DELETE FROM properties;
DELETE FROM team_members;
```

## Production Deployment

**⚠️ IMPORTANT**: This sample data is for development/testing only.

Before going to production:
1. Delete all sample data
2. Create real team member accounts
3. Add real properties
4. Start with clean slate

## Need Help?

If you encounter errors:
1. Check that all tables exist (run `database-schema.sql` first if needed)
2. Verify RLS policies are configured correctly
3. Check Supabase logs for specific error messages
4. Ensure you're using the correct Supabase project

## What's Next?

After sample data is loaded:
1. Explore all features of the app
2. Test creating new reservations
3. Test adding payments
4. Test modals and workflows
5. Verify analytics and reports
6. Then replace with real production data!
