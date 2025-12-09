# Database Schema Updates Required

## Issue
The application is trying to use a column that doesn't exist in the Supabase database:
- `reservations.last_reminder_date` - Missing date column for tracking payment reminders

## Solution

### Run SQL in Supabase

Go to your Supabase project → SQL Editor → Run this SQL:

```sql
-- Add last_reminder_date to reservations table  
-- This tracks when payment reminders were sent to avoid duplicates
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS last_reminder_date DATE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reservations_last_reminder 
ON reservations(last_reminder_date);
```

## What's Working Now

✅ **Owner Management** (Fully functional):
- property_owners.property_ids column EXISTS (INTEGER ARRAY)
- Uses is_active (boolean) for status
- All CRUD operations work properly
- Properties assigned as array

✅ **Smart Automation** (Functional with workaround):
- Auto status updates (check-in/check-out)
- Payment reminders (without date tracking temporarily)
- Document expiry alerts

## After Running SQL

Once last_reminder_date is added, you can uncomment the date tracking in the Smart Automation engine to prevent duplicate reminder notifications.

## Notes

- property_ids already exists in property_owners table ✅
- Owner IDs are UUID, Property IDs are INTEGER ✅
- Properties have owner_id FK pointing to property_owners ✅
