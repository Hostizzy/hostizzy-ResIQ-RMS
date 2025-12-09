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
-- These policies allow the admin app to manage property owners

-- Enable RLS on property_owners (if not already enabled)
ALTER TABLE property_owners ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to SELECT (read) property owners
-- This allows the admin app to list and view owners
CREATE POLICY "Allow anonymous read access to property_owners"
ON property_owners
FOR SELECT
TO anon
USING (true);

-- Policy: Allow anonymous users to INSERT (create) new property owners
-- This allows the admin app to add new owners
CREATE POLICY "Allow anonymous insert access to property_owners"
ON property_owners
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow anonymous users to UPDATE existing property owners
-- This allows the admin app to edit owner details
CREATE POLICY "Allow anonymous update access to property_owners"
ON property_owners
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Policy: Allow anonymous users to DELETE property owners
-- This allows the admin app to remove owners
CREATE POLICY "Allow anonymous delete access to property_owners"
ON property_owners
FOR DELETE
TO anon
USING (true);
```

## After Running SQL

Once the SQL is executed, you'll have:

✅ **Owner Management** (Fully functional):
- property_owners.property_ids column EXISTS (INTEGER ARRAY)
- Uses is_active (boolean) for status
- RLS policies allow all CRUD operations ✨
- Properties assigned as array
- Create, edit, and delete owners from admin app

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
