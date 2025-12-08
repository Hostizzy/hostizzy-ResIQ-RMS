# 🚀 Owner Portal - Quick Setup Guide

## What You're Getting

A complete Owner Portal as a standalone web app where property owners can:
- ✅ View revenue dashboard (total revenue, commission, net earnings)
- ✅ See all their bookings with earning breakdown
- ✅ Request payouts (minimum ₹100)
- ✅ Manage bank account details
- ✅ View their properties
- ✅ Login through the main app with automatic redirect

## 🏗️ Architecture

- **Main App (index.html)**: Staff/Admin login stays here
- **Owner Portal (owner-portal.html)**: Separate standalone page for owners
- **Hybrid Login**: Single login page routes to correct portal based on user type
- **Shared Functions**: owner-portal-functions.js contains all owner portal logic

---

## 📋 Implementation Steps (15 minutes)

### Step 1: Run Database Migration (5 mins)

1. Open Supabase Dashboard → SQL Editor
2. Copy & paste the entire `owner-portal-schema.sql` file
3. Click **Run**
4. Verify:
   ```sql
   SELECT * FROM property_owners LIMIT 1;
   SELECT * FROM payout_requests LIMIT 1;
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'reservations' AND column_name IN ('owner_id', 'hostizzy_revenue');
   ```

### Step 2: Create First Owner Account (2 mins)

```sql
-- Create owner
INSERT INTO property_owners (name, email, phone, password, commission_rate)
VALUES (
    'Your Name',
    'owner@yourdomain.com',
    '+91-9876543210',
    'password123',  -- CHANGE THIS!
    20.00  -- 20% commission to Hostizzy
);

-- Get owner ID
SELECT id, name, email FROM property_owners WHERE email = 'owner@yourdomain.com';

-- Link properties (replace UUID with actual owner ID from above)
UPDATE properties
SET owner_id = 'PASTE-OWNER-ID-HERE'
WHERE id IN (1, 2, 3);  -- Your property IDs

-- Link existing reservations
UPDATE reservations r
SET owner_id = p.owner_id
FROM properties p
WHERE r.property_id = p.id AND p.owner_id IS NOT NULL;
```

### Step 3: Upload Owner Portal Files (2 mins)

All files are already in your repository:
- ✅ `owner-portal.html` - Standalone owner portal page
- ✅ `owner-portal-functions.js` - All JavaScript functions
- ✅ `owner-portal-schema.sql` - Database structure (run in Step 1)
- ✅ `index.html` - Already modified with hybrid login

**Upload to your web server:**
```bash
# Upload these files to your web hosting/server
owner-portal.html
owner-portal-functions.js
```

Make sure they're in the **same directory** as index.html!

### Step 4: Test the Integration (5 mins)

#### Test 1: Owner Login Flow
1. Open `index.html` in browser
2. Login with owner email/password
3. Should automatically redirect to `owner-portal.html`
4. Should see owner name and email in header

#### Test 2: Revenue Dashboard
1. Should see 4 cards:
   - Total Revenue
   - Hostizzy Commission
   - Net Earnings
   - Pending Payout
2. Recent bookings table at bottom

#### Test 3: Request Payout
1. Click "Request Payout" button
2. Enter amount (min ₹100)
3. Select payout method (Bank Transfer / UPI)
4. Submit
5. Should appear in Payouts tab with "pending" status

#### Test 4: Bank Details
1. Go to Bank Details tab
2. Enter account details
3. Save
4. Refresh page - details should persist

#### Test 5: View Bookings
1. Go to "My Bookings"
2. Should see all bookings for owner's properties
3. Should show: Total Amount, Commission, Your Earnings

---

## 🎯 How It Works

### Login Flow:
```
1. User enters email/password in index.html
2. System checks team_members table first
   ├─ If match found → Show main app (staff/admin dashboard)
   └─ If no match → Check property_owners table
       ├─ If match found → Redirect to owner-portal.html
       └─ If no match → Show error
```

### Owner Portal Authentication:
```
1. owner-portal.html loads
2. Checks localStorage for currentUser
3. If no user or userType !== 'owner' → Redirect to index.html
4. If valid owner → Load dashboard
```

### File Structure:
```
your-server/
├── index.html                    (Main app - staff/admin)
├── owner-portal.html             (Owner portal - separate)
├── owner-portal-functions.js     (Owner portal logic)
├── guest-portal.html             (Guest document submission)
└── ... other files
```

---

## 🔐 Security Features

✅ Row Level Security (RLS) enabled
✅ Owners can only see their own data
✅ Staff can see all owner data
✅ Passwords stored same as team_members (consider upgrading to Supabase Auth)
✅ Owner can only create payouts for themselves
✅ Staff must approve payout requests
✅ Authentication check on every owner portal page load

---

## 💡 What Each Role Sees

### Staff/Admin Login
- Stays on index.html
- Full access to all features
- Can manage all properties
- Can approve payout requests
- Can view all owner data

### Owner Login
- Redirects to owner-portal.html
- Can't edit bookings (read-only)
- Can request payouts
- Can view their revenue only
- Can update bank details
- Can view their properties only

---

## 🐛 Troubleshooting

### Issue: Owner login doesn't redirect
**Fix**: Check browser console for errors. Verify owner exists in property_owners table.

### Issue: Revenue shows ₹0
**Fix**:
1. Ensure properties have `owner_id` set
2. Ensure reservations have `owner_id` set
3. Ensure reservations have `hostizzy_revenue` calculated

```sql
-- Update Hostizzy revenue (20% commission example)
UPDATE reservations
SET hostizzy_revenue = total_amount * 0.20
WHERE owner_id IS NOT NULL AND hostizzy_revenue IS NULL;
```

### Issue: "Cannot read property 'classList' of null"
**Fix**: Clear browser cache and reload. Ensure owner-portal.html has all required HTML elements.

### Issue: Payout request fails
**Fix**: Check console. Verify bank details are saved first. Minimum payout is ₹100.

---

## 📊 Next Steps After Implementation

1. **Create more owner accounts** (one per property owner)
   ```sql
   INSERT INTO property_owners (name, email, password, commission_rate)
   VALUES ('Owner Name', 'owner2@domain.com', 'pass123', 20.00);
   ```

2. **Link all properties** to respective owners
   ```sql
   UPDATE properties SET owner_id = 'OWNER-UUID' WHERE id = 5;
   ```

3. **Calculate Hostizzy revenue** for existing bookings
   ```sql
   UPDATE reservations r
   SET hostizzy_revenue = r.total_amount * (po.commission_rate / 100)
   FROM property_owners po
   WHERE r.owner_id = po.id AND r.hostizzy_revenue = 0;
   ```

4. **Test payout workflow**:
   - Create request as owner
   - Approve as admin in main app
   - Mark as completed

5. **Add email notifications** for payout status changes

6. **Consider password hashing** (upgrade to Supabase Auth)

---

## 🚀 Ready?

Everything is already set up! Just:
1. Run the SQL migration
2. Create an owner account
3. Test the login

Total time: **15 minutes**

If you encounter any issues, check the browser console for errors and verify all database tables were created successfully.
