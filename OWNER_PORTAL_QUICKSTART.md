# 🚀 Owner Portal - Quick Implementation Guide

## What You're Getting

A complete Owner Portal integrated into your existing ResIQ app where property owners can:
- ✅ View revenue dashboard (total revenue, commission, net earnings)
- ✅ See all their bookings with earning breakdown
- ✅ Request payouts (minimum ₹100)
- ✅ Manage bank account details
- ✅ View their properties
- ✅ Login through the same main app

---

## 📋 Implementation Steps (30 minutes)

### Step 1: Run Database Migration (5 mins)

1. Open Supabase Dashboard → SQL Editor
2. Copy & paste the entire `owner-portal-schema.sql` file
3. Click **Run**
4. Verify:
   ```sql
   SELECT * FROM property_owners LIMIT 1;
   SELECT * FROM payout_requests LIMIT 1;
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

### Step 3: Add Owner Portal Files (3 mins)

I've created 3 files for you:
- ✅ `owner-portal-schema.sql` - Database structure (run in Step 1)
- ✅ `owner-portal-functions.js` - All JavaScript functions
- ✅ `OWNER_PORTAL_IMPLEMENTATION.md` - Detailed HTML & code

### Step 4: Modify index.html (20 mins)

#### A. Add Database Functions (line ~8000)

Find the `db` object and add these functions:

```javascript
// Inside const db = { ... }

// Add at the end of db object, before the closing }:
getOwners: async () => {
    const { data, error } = await supabase
        .from('property_owners')
        .select('*')
        .order('name');
    if (error) throw error;
    return data || [];
},

getOwner: async (ownerId) => {
    const { data, error } = await supabase
        .from('property_owners')
        .select('*')
        .eq('id', ownerId)
        .single();
    if (error) throw error;
    return data;
},

saveOwner: async (owner) => {
    if (owner.id) {
        const { data, error } = await supabase
            .from('property_owners')
            .update(owner)
            .eq('id', owner.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await supabase
            .from('property_owners')
            .insert([owner])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
},

getPayoutRequests: async (ownerId = null) => {
    let query = supabase
        .from('payout_requests')
        .select('*')
        .order('requested_at', { ascending: false });
    if (ownerId) {
        query = query.eq('owner_id', ownerId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
},

savePayoutRequest: async (payout) => {
    const { data, error} = await supabase
        .from('payout_requests')
        .insert([payout])
        .select()
        .single();
    if (error) throw error;
    return data;
},

getOwnerRevenue: async (ownerId, startDate = null, endDate = null) => {
    let query = supabase
        .from('reservations')
        .select('*')
        .eq('owner_id', ownerId)
        .in('status', ['confirmed', 'checked_in', 'completed']);
    if (startDate) query = query.gte('check_in', startDate);
    if (endDate) query = query.lte('check_in', endDate);
    const { data, error } = await query;
    if (error) throw error;
    const totalRevenue = data.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const hostizzyCommission = data.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
    return {
        totalRevenue,
        hostizzyCommission,
        netEarnings: totalRevenue - hostizzyCommission,
        totalBookings: data.length,
        bookings: data
    };
},

getOwnerPendingPayout: async (ownerId) => {
    const { data: reservations } = await supabase
        .from('reservations')
        .select('total_amount, hostizzy_revenue')
        .eq('owner_id', ownerId)
        .eq('payment_status', 'paid')
        .in('status', ['confirmed', 'checked_in', 'completed']);
    const totalEarned = reservations.reduce((sum, r) =>
        sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.hostizzy_revenue) || 0)), 0
    );
    const { data: payouts } = await supabase
        .from('payout_requests')
        .select('amount')
        .eq('owner_id', ownerId)
        .eq('status', 'completed');
    const totalPaidOut = payouts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    return Math.max(totalEarned - totalPaidOut, 0);
},

getOwnerBookings: async (ownerId) => {
    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('owner_id', ownerId)
        .order('check_in', { ascending: false });
    if (error) throw error;
    return data || [];
}
```

#### B. Modify Login Function (line ~8148)

Replace the `login()` function with the version from `OWNER_PORTAL_IMPLEMENTATION.md` (it's in Step 3 of that file).

#### C. Add Owner Portal HTML (after line ~21000)

1. Find the closing `</div>` of `mainApp` (around line 21000)
2. After it, paste the entire Owner Portal HTML from `OWNER_PORTAL_IMPLEMENTATION.md`

#### D. Add Owner Portal JavaScript

Copy all functions from `owner-portal-functions.js` and paste them in the `<script>` section (before the closing `</script>` tag at the end of index.html)

---

## 🧪 Testing (5 mins)

### Test 1: Owner Login
1. Open app
2. Login with owner email/password
3. Should see Owner Portal (not staff dashboard)
4. Should show: Dashboard, Bookings, Payouts, Bank Details, Properties

### Test 2: Revenue Dashboard
1. Should see:
   - Total Revenue
   - Hostizzy Commission
   - Net Earnings
   - Pending Payout
2. Recent bookings table at bottom

### Test 3: Request Payout
1. Click "Request Payout" button
2. Enter amount (min ₹100)
3. Select payout method
4. Submit
5. Should appear in Payouts tab

### Test 4: Bank Details
1. Go to Bank Details tab
2. Enter account details
3. Save
4. Should save successfully

### Test 5: View Bookings
1. Go to "My Bookings"
2. Should see all bookings for owner's properties
3. Should show: Total Amount, Commission, Your Earnings

---

## 🎯 What Each Role Sees

### Staff/Admin Login
- Shows main app dashboard
- Full access to all features
- Can manage all properties
- Can approve payout requests

### Owner Login
- Shows owner portal only
- Can't edit bookings (read-only)
- Can request payouts
- Can view their revenue
- Can update bank details

---

## 🔐 Security Features

✅ Row Level Security (RLS) enabled
✅ Owners can only see their own data
✅ Staff can see all owner data
✅ Passwords stored same as team_members (plain text - consider upgrading to Supabase Auth)
✅ Owner can only create payouts for themselves
✅ Staff must approve payout requests

---

## 💡 Next Steps After Implementation

1. **Create more owner accounts** (one per property owner)
2. **Link all properties** to respective owners
3. **Test payout workflow** (create request as owner, approve as admin)
4. **Add email notifications** for payout status changes
5. **Consider password hashing** (upgrade to Supabase Auth)

---

## 📞 Need Help?

If you get stuck:
1. Check console for errors
2. Verify database migration ran successfully
3. Ensure owner_id is set for properties
4. Ensure owner_id is set for reservations

---

## 🚀 Ready to Implement?

Files you need:
- ✅ `owner-portal-schema.sql` - Run first
- ✅ `owner-portal-functions.js` - Copy to index.html
- ✅ `OWNER_PORTAL_IMPLEMENTATION.md` - HTML & detailed steps

Start with Step 1 above and work through each step carefully. Total time: 30 minutes.

Let me know when you're ready and I can guide you through any step!
