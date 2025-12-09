# Database Schema Updates Required

## Issue
The application is trying to use columns that don't exist in the Supabase database:
1. `property_owners.property_ids` - Missing array column for storing assigned properties
2. `reservations.last_reminder_date` - Missing date column for tracking payment reminders

## Solution

### Option 1: Run SQL in Supabase (Recommended)

Go to your Supabase project → SQL Editor → Run this SQL:

```sql
-- Add property_ids column to property_owners table
-- This stores an array of property IDs that the owner has access to
ALTER TABLE property_owners 
ADD COLUMN IF NOT EXISTS property_ids INTEGER[] DEFAULT '{}';

-- Add last_reminder_date to reservations table  
-- This tracks when payment reminders were sent to avoid duplicates
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS last_reminder_date DATE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_property_owners_property_ids 
ON property_owners USING GIN (property_ids);

CREATE INDEX IF NOT EXISTS idx_reservations_last_reminder 
ON reservations(last_reminder_date);
```

### Option 2: Temporary Workaround (Already Implemented)

The code now works WITHOUT these columns by:
- **Owner properties**: Stored as JSON string in `properties` text column (fallback)
- **Reminder tracking**: Skipped `last_reminder_date`, only sets `payment_reminder_sent` flag

## What's Working Now

✅ **Owner Management**:
- Can create owners with name, email, password, phone
- Can assign properties (stored as JSON string temporarily)
- Can edit/delete owners
- Owners can login to owner portal

✅ **Smart Automation**:
- Auto status updates (check-in/check-out)
- Payment reminders (without date tracking)
- Document expiry alerts

## Recommendation

**Run the SQL above** to enable full functionality with proper data types and indexing. The temporary workaround is functional but using native PostgreSQL arrays is better for:
- Query performance
- Data integrity
- Proper indexing
- Easier querying from owner portal

## After Running SQL

Once the columns are added, the code will automatically use them instead of the JSON fallback.
