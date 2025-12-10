# Database Schema Updates Required

## Issues

1. **Missing Column**: `reservations.last_reminder_date` - Missing date column for tracking payment reminders
2. **RLS Policies**: `property_owners` table has Row-Level Security enabled but no policies configured

## Solution

### Run SQL in Supabase

Go to your Supabase project → SQL Editor → Run this SQL:

```sql
-- ============================================
-- 1. Add last_reminder_date to reservations table
-- ============================================
-- This tracks when payment reminders were sent to avoid duplicates
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS last_reminder_date DATE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reservations_last_reminder
ON reservations(last_reminder_date);

-- ============================================
-- 2. Create RLS Policies for property_owners table
-- ============================================
-- These policies allow both admin app and owner portal to work

-- Enable RLS on property_owners (if not already enabled)
ALTER TABLE property_owners ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to SELECT (read) property owners
CREATE POLICY "Allow anonymous read access to property_owners"
ON property_owners
FOR SELECT
TO anon
USING (true);

-- Policy: Allow anonymous users to INSERT (create) new property owners
CREATE POLICY "Allow anonymous insert access to property_owners"
ON property_owners
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow anonymous users to UPDATE existing property owners
CREATE POLICY "Allow anonymous update access to property_owners"
ON property_owners
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policy: Allow anonymous users to DELETE property owners
CREATE POLICY "Allow anonymous delete access to property_owners"
ON property_owners
FOR DELETE
TO anon
USING (true);

-- ============================================
-- 3. Create RLS Policies for properties table
-- ============================================
-- Allow reading properties for owner portal and admin app

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to properties"
ON properties
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anonymous write access to properties"
ON properties
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- 4. Create RLS Policies for reservations table
-- ============================================
-- Allow reading reservations for owner portal and admin app

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to reservations"
ON reservations
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anonymous write access to reservations"
ON reservations
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- ============================================
-- 5. Create RLS Policies for payout_requests table
-- ============================================
-- Allow owners to request payouts and view their requests

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to payout_requests"
ON payout_requests
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anonymous insert access to payout_requests"
ON payout_requests
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to payout_requests"
ON payout_requests
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to payout_requests"
ON payout_requests
FOR DELETE
TO anon
USING (true);
```

## After Running SQL

Once the SQL is executed, you'll have:

✅ **Admin App - Owner Management** (Fully functional):
- property_owners table: Create, edit, delete, view owners ✨
- property_ids stored as INTEGER ARRAY
- Assign multiple properties to each owner
- Active/inactive status control

✅ **Owner Portal** (Fully functional):
- property_owners table: Owners can view/edit their profile ✨
- properties table: View assigned properties ✨
- reservations table: View bookings for their properties ✨
- payout_requests table: Request and track payouts ✨
- Dashboard with revenue, bookings, pending payouts
- Request payout functionality

✅ **Smart Automation** (Complete):
- Auto status updates (check-in/check-out)
- Payment reminders with date tracking to prevent duplicates ✨
- Document expiry alerts

## How to Run SQL

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire SQL block above
5. Click **Run** (or press Ctrl+Enter)
6. Refresh your admin app and try creating an owner again

## Notes

- property_ids already exists in property_owners table ✅
- Owner IDs are UUID, Property IDs are INTEGER ✅
- Properties have owner_id FK pointing to property_owners ✅

## Additional Tables (If Needed)

If you encounter RLS errors on other tables, you may need to add similar policies for:
- `payments` - Payment tracking
- `team_members` - Team/staff management
- `communications` - Communication logs
- `guest_documents` - Guest ID uploads
- `guest_meal_preferences` - Guest meal selections
- `guest_portal_sessions` - Guest portal access
- `synced_availability` - Calendar sync data

**Generic RLS Policy Template** (replace `TABLE_NAME`):
```sql
ALTER TABLE TABLE_NAME ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access to TABLE_NAME"
ON TABLE_NAME FOR ALL TO anon
USING (true) WITH CHECK (true);
```
