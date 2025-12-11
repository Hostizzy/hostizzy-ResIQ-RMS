# Revenue Share Percent Population Guide

## Overview
This guide helps you populate the `revenue_share_percent` field in the `reservations` table based on the commission rates stored in the `properties` table.

## Why This is Important
Currently, the Owner Portal joins with the `properties` table to get commission percentages. However, storing the percentage directly in `reservations` provides:

1. **Historical Accuracy**: If you change a property's commission rate in the future, old bookings will still show the rate they were actually charged
2. **Better Performance**: No need to join with properties table
3. **Data Integrity**: Each reservation preserves its original commission rate

## Available Scripts

### 1. SQL Script (Recommended)
**File**: `populate-revenue-share-percent.sql`

**Pros**:
- Fastest execution (single UPDATE query)
- No browser required
- Can be run in Supabase SQL Editor

**Steps**:
1. Login to Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the script
4. Run each section sequentially
5. Review the verification results

### 2. JavaScript Script (Alternative)
**File**: `populate-revenue-share-percent.js`

**Pros**:
- Can run from browser console
- More visual feedback
- Includes dry-run mode
- Better for testing

**Steps**:
1. Open your main app (`index.html`) in browser
2. Login as admin
3. Open browser console (F12)
4. Copy and paste the entire script
5. Run dry run first: `await dryRunRevenueSharePercent()`
6. If looks good, run: `await populateRevenueSharePercent()`

## What the Scripts Do

### Step 1: Add Column (if needed)
```sql
ALTER TABLE reservations
ADD COLUMN revenue_share_percent NUMERIC(5,2) DEFAULT 20.00;
```

### Step 2: Populate from Properties
```sql
UPDATE reservations r
SET revenue_share_percent = p.revenue_share_percent
FROM properties p
WHERE r.property_id = p.id;
```

### Step 3: Create Auto-Populate Trigger
Creates a trigger so future reservations automatically get the commission rate from their property.

### Step 4: Verification
Checks that all reservations have the correct commission rate.

## Before You Run

### Check if Column Exists
Run this in Supabase SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name = 'revenue_share_percent';
```

If returns **no rows** → Column doesn't exist, script will add it
If returns **1 row** → Column exists, script will just populate it

### Check Current State
```sql
-- See properties and their commission rates
SELECT id, property_name, revenue_share_percent
FROM properties
ORDER BY property_name;

-- See how many reservations exist per property
SELECT
    p.property_name,
    p.revenue_share_percent as property_commission,
    COUNT(r.booking_id) as total_reservations
FROM properties p
LEFT JOIN reservations r ON r.property_id = p.id
GROUP BY p.id, p.property_name, p.revenue_share_percent
ORDER BY p.property_name;
```

## Expected Results

### Before Running Script
```
Property A (15% commission) → 50 reservations (revenue_share_percent = NULL)
Property B (20% commission) → 75 reservations (revenue_share_percent = NULL)
Property C (25% commission) → 30 reservations (revenue_share_percent = NULL)
```

### After Running Script
```
Property A (15% commission) → 50 reservations (revenue_share_percent = 15%)
Property B (20% commission) → 75 reservations (revenue_share_percent = 20%)
Property C (25% commission) → 30 reservations (revenue_share_percent = 25%)
```

## Verification Queries

After running the script, verify with:

```sql
-- Check all reservations have a percentage
SELECT
    COUNT(*) FILTER (WHERE revenue_share_percent IS NULL) as null_count,
    COUNT(*) FILTER (WHERE revenue_share_percent = 15) as percent_15,
    COUNT(*) FILTER (WHERE revenue_share_percent = 20) as percent_20,
    COUNT(*) FILTER (WHERE revenue_share_percent = 25) as percent_25,
    COUNT(*) as total
FROM reservations;

-- Verify reservations match their property's commission
SELECT
    COUNT(*) as total_reservations,
    COUNT(*) FILTER (WHERE r.revenue_share_percent = p.revenue_share_percent) as matching,
    COUNT(*) FILTER (WHERE r.revenue_share_percent != p.revenue_share_percent) as mismatched
FROM reservations r
JOIN properties p ON r.property_id = p.id;
```

Expected: `matching = total_reservations` and `mismatched = 0`

## After Running the Script

### Update Owner Portal Code
You can now **remove the join** and use the field directly:

**Before**:
```javascript
const { data, error } = await supabase
    .from('reservations')
    .select(`
        *,
        properties!inner(revenue_share_percent)
    `)
    .eq('owner_id', ownerId);

// Usage
const commissionPercent = booking.properties?.revenue_share_percent || 0;
```

**After**:
```javascript
const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('owner_id', ownerId);

// Usage
const commissionPercent = booking.revenue_share_percent || 0;
```

**Note**: I can update the Owner Portal code for you after you run this script!

## Rollback (if needed)

If something goes wrong:

```sql
-- Remove column
ALTER TABLE reservations DROP COLUMN revenue_share_percent;

-- Remove trigger
DROP TRIGGER IF EXISTS trigger_set_reservation_revenue_share ON reservations;
DROP FUNCTION IF EXISTS set_reservation_revenue_share();
```

## Table Schemas Needed

To ensure the script works correctly, please confirm:

### Properties Table
```sql
-- Required columns:
id (primary key)
property_name
revenue_share_percent (NUMERIC)
```

### Reservations Table
```sql
-- Required columns:
booking_id (primary key)
property_id (foreign key → properties.id)
revenue_share_percent (NUMERIC) -- Will be added if doesn't exist
updated_at (TIMESTAMP) -- Optional, for tracking changes
```

## Questions Before Running?

Please let me know:

1. **Does `reservations` table already have `revenue_share_percent` column?**
   - If yes, we'll skip adding it
   - If no, script will add it

2. **What are your property commission rates?**
   - 15%? 20%? 25%? Mix?
   - Just want to verify expected results

3. **How many reservations do you have?**
   - To estimate execution time

4. **Preferred method?**
   - SQL (faster, run in Supabase)
   - JavaScript (more feedback, run in browser)

## Next Steps

After running the script successfully:

1. ✅ All reservations will have `revenue_share_percent` populated
2. ✅ Future reservations will auto-populate via trigger
3. ✅ I'll update Owner Portal code to use direct field (no join needed)
4. ✅ Commission percentages will be historically accurate
5. ✅ Better performance (no join required)

---

**Ready to proceed?** Let me know if you have any questions or if you'd like me to check the table schemas first!
