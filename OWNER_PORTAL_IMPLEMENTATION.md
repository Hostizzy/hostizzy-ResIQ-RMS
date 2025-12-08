# 🏠 Owner Portal - Technical Implementation Guide

## Overview

This guide explains the technical implementation of the Owner Portal for ResIQ PWA. The owner portal is implemented as a **separate standalone HTML file** that owners are redirected to after login.

---

## 📁 File Structure

```
ResIQ-PWA/
├── index.html                      # Main app (staff/admin)
├── owner-portal.html               # Owner portal (standalone)
├── owner-portal-functions.js       # Owner portal JavaScript
├── owner-portal-schema.sql         # Database migration
├── guest-portal.html               # Guest document submission
└── ... other files
```

---

## 🏗️ Architecture Overview

### Hybrid Authentication System

```
┌─────────────────┐
│  index.html     │
│  (Login Page)   │
└────────┬────────┘
         │
    Check team_members
         │
    ┌────┴────┐
    │ Found?  │
    └────┬────┘
         │
    ┌────┴────────────────┐
    │                     │
   YES                   NO
    │                     │
    ▼                     ▼
┌───────────┐    Check property_owners
│ Main App  │             │
│ (Staff)   │        ┌────┴────┐
└───────────┘        │ Found?  │
                     └────┬────┘
                          │
                     ┌────┴────┐
                     │        │
                    YES      NO
                     │        │
                     ▼        ▼
              ┌──────────────┐  ┌──────────┐
              │ Redirect to  │  │  Error   │
              │owner-portal  │  │          │
              │   .html      │  └──────────┘
              └──────────────┘
```

---

## 📋 Step 1: Database Setup

### Run the Complete Migration

Open Supabase SQL Editor and run `owner-portal-schema.sql`. This creates:

**Tables:**
- `property_owners` - Owner accounts
- `payout_requests` - Payout request tracking

**Columns Added:**
- `properties.owner_id` - Link properties to owners
- `reservations.owner_id` - Link bookings to owners
- `reservations.hostizzy_revenue` - Commission tracking

**Functions:**
- `get_owner_revenue()` - Calculate total revenue
- `get_owner_pending_payout()` - Calculate available balance

**Security:**
- Row Level Security (RLS) policies
- Owners can only see their own data
- Staff can see all data

### Create First Owner

```sql
-- Create owner account
INSERT INTO property_owners (name, email, phone, password, commission_rate)
VALUES (
    'John Doe',
    'owner@example.com',
    '+91-9876543210',
    'password123',  -- CHANGE THIS!
    20.00  -- 20% Hostizzy commission
);

-- Get owner ID
SELECT id, name, email FROM property_owners WHERE email = 'owner@example.com';
-- Copy the UUID

-- Link properties to owner
UPDATE properties
SET owner_id = 'UUID-FROM-ABOVE'
WHERE id IN (1, 2, 3);

-- Link existing reservations
UPDATE reservations r
SET owner_id = p.owner_id
FROM properties p
WHERE r.property_id = p.id AND p.owner_id IS NOT NULL;

-- Calculate Hostizzy revenue for existing bookings
UPDATE reservations r
SET hostizzy_revenue = r.total_amount * (po.commission_rate / 100)
FROM property_owners po
WHERE r.owner_id = po.id AND r.hostizzy_revenue = 0;
```

---

## 📋 Step 2: Modified Login (index.html)

The login function in `index.html` has been modified to support hybrid authentication:

**Location:** index.html, line ~8267

```javascript
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Login Error', 'Please enter email and password', '❌');
        return;
    }

    try {
        // Try staff/admin login first
        const users = await db.getTeamMembers();
        const staffUser = users.find(u => u.email === email && u.password === password);

        if (staffUser) {
            if (!staffUser.is_active) {
                showToast('Account Inactive', 'Your account has been deactivated', '❌');
                return;
            }

            currentUser = staffUser;
            currentUser.userType = 'staff';
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Show main app
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            // ... rest of staff login
            return;
        }

        // Try owner login
        const owners = await db.getOwners();
        const ownerUser = owners.find(o => o.email === email && o.password === password);

        if (ownerUser) {
            if (!ownerUser.is_active) {
                showToast('Account Inactive', 'Your account has been deactivated', '❌');
                return;
            }

            currentUser = ownerUser;
            currentUser.userType = 'owner';
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            // Redirect to owner portal
            window.location.href = 'owner-portal.html';
            return;
        }

        // No match found
        showToast('Login Failed', 'Invalid credentials', '❌');

    } catch (error) {
        console.error('Login error:', error);
        showToast('Login Error', error.message, '❌');
    }
}
```

### Owner Database Functions (index.html)

**Location:** index.html, line ~8146

These functions are available in `index.html` for admin to manage owners:

```javascript
// Inside the db object
getOwners: async () => { /* ... */ },
getOwner: async (ownerId) => { /* ... */ },
saveOwner: async (owner) => { /* ... */ },
getPayoutRequests: async (ownerId = null) => { /* ... */ },
savePayoutRequest: async (payout) => { /* ... */ },
updatePayoutStatus: async (payoutId, status, notes) => { /* ... */ },
getOwnerRevenue: async (ownerId, startDate, endDate) => { /* ... */ },
getOwnerPendingPayout: async (ownerId) => { /* ... */ },
getOwnerBookings: async (ownerId) => { /* ... */ }
```

---

## 📋 Step 3: Owner Portal (owner-portal.html)

### File Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Meta tags, styles, Supabase CDN -->
</head>
<body>
    <!-- Owner Portal UI -->
    <div id="ownerApp">
        <header><!-- Owner header with name, logout --></header>
        <nav><!-- Dashboard, Bookings, Payouts, Bank Details, Properties --></nav>
        <main>
            <!-- 5 views: Dashboard, Bookings, Payouts, Bank Details, Properties -->
        </main>
    </div>

    <!-- Payout Request Modal -->

    <script>
        // Supabase config
        // Database functions
        // Authentication check
    </script>

    <!-- Load owner portal functions -->
    <script src="owner-portal-functions.js"></script>
</body>
</html>
```

### Authentication Check (DOMContentLoaded)

```javascript
window.addEventListener('DOMContentLoaded', async () => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = JSON.parse(storedUser);

    // Verify user type
    if (currentUser.userType !== 'owner') {
        window.location.href = 'index.html';
        return;
    }

    // Update UI with user info
    document.getElementById('ownerUserEmail').textContent = currentUser.email;
    document.getElementById('ownerUserName').textContent = currentUser.name;

    // Load dashboard
    await loadOwnerDashboard();
});
```

### Logout Function

```javascript
function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    window.location.href = 'index.html';
}
```

---

## 📋 Step 4: Owner Portal Functions (owner-portal-functions.js)

This file contains all the JavaScript logic for the owner portal:

### Navigation
```javascript
function showOwnerView(viewName) {
    // Hide all views
    document.querySelectorAll('.owner-view').forEach(v => v.classList.add('hidden'));
    // Show selected view
    document.getElementById(viewName + 'View').classList.remove('hidden');
    // Update active nav button
    document.querySelectorAll('.owner-nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}
```

### Dashboard
```javascript
async function loadOwnerDashboard() {
    // Fetch revenue data
    const revenue = await db.getOwnerRevenue(currentUser.id);
    const pendingPayout = await db.getOwnerPendingPayout(currentUser.id);

    // Update cards
    document.getElementById('ownerTotalRevenue').textContent =
        `₹${revenue.totalRevenue.toLocaleString('en-IN')}`;
    document.getElementById('ownerHostizzyCommission').textContent =
        `₹${revenue.hostizzyCommission.toLocaleString('en-IN')}`;
    document.getElementById('ownerNetEarnings').textContent =
        `₹${revenue.netEarnings.toLocaleString('en-IN')}`;
    document.getElementById('ownerPendingPayout').textContent =
        `₹${pendingPayout.toLocaleString('en-IN')}`;

    // Load recent bookings
    const bookings = await db.getOwnerBookings(currentUser.id);
    renderOwnerRecentBookings(bookings.slice(0, 5));
}
```

### Payout Request
```javascript
async function submitPayoutRequest() {
    const amount = parseFloat(document.getElementById('payoutAmount').value);
    const method = document.getElementById('payoutMethod').value;
    const notes = document.getElementById('payoutNotes').value;

    if (!amount || amount < 100) {
        showToast('Error', 'Minimum payout amount is ₹100', '❌');
        return;
    }

    const payout = {
        owner_id: currentUser.id,
        amount: amount,
        payout_method: method,
        owner_notes: notes,
        status: 'pending'
    };

    await db.savePayoutRequest(payout);
    showToast('Success', 'Payout request submitted!', '✅');
    closePayoutRequestModal();
    await loadOwnerPayouts();
}
```

### Bank Details
```javascript
async function saveOwnerBankDetails() {
    const updatedOwner = {
        id: currentUser.id,
        account_holder_name: document.getElementById('ownerAccountHolderName').value,
        bank_account_number: document.getElementById('ownerBankAccountNumber').value,
        bank_ifsc: document.getElementById('ownerBankIFSC').value,
        bank_name: document.getElementById('ownerBankName').value,
        bank_branch: document.getElementById('ownerBankBranch').value,
        upi_id: document.getElementById('ownerUPIId').value
    };

    await db.saveOwner(updatedOwner);
    showToast('Success', 'Bank details saved successfully!', '✅');
}
```

---

## 🔐 Security Considerations

### Authentication
- Login credentials checked against database
- User session stored in localStorage
- Authentication verified on every page load
- Automatic redirect if not authenticated

### Data Access
- Row Level Security (RLS) enforces data isolation
- Owners can only query their own data
- Staff can query all data
- Supabase handles SQL injection prevention

### Recommended Improvements
1. **Use Supabase Auth** instead of plain text passwords
2. **Add JWT tokens** for API authentication
3. **Implement session expiry** (currently indefinite)
4. **Add 2FA** for owner accounts
5. **Hash passwords** before storing

---

## 📊 Data Flow

### Revenue Calculation
```sql
1. Query reservations WHERE owner_id = {current_owner}
2. Filter by status IN ('confirmed', 'checked_in', 'completed')
3. Sum total_amount → Total Revenue
4. Sum hostizzy_revenue → Hostizzy Commission
5. Calculate: Net Earnings = Total Revenue - Commission
```

### Pending Payout Calculation
```sql
1. Get total earned from paid bookings
2. Subtract completed payout requests
3. Return available balance
```

---

## 🧪 Testing Checklist

- [ ] Owner can login from index.html
- [ ] Redirect to owner-portal.html works
- [ ] Dashboard shows correct revenue
- [ ] Recent bookings display correctly
- [ ] All bookings page loads
- [ ] Payout request creation works
- [ ] Payout history displays
- [ ] Bank details save and persist
- [ ] Properties list shows correct data
- [ ] Logout redirects to index.html
- [ ] Staff can still login to main app
- [ ] Unauthorized access blocked

---

## 🚀 Deployment

1. **Upload Files:**
   ```bash
   owner-portal.html
   owner-portal-functions.js
   ```

2. **Run Database Migration:**
   - Copy `owner-portal-schema.sql`
   - Run in Supabase SQL Editor

3. **Create Owner Accounts:**
   - Use SQL INSERT statements
   - Link properties and reservations

4. **Test:**
   - Login as owner
   - Verify all features work

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify database migration ran successfully
3. Ensure owner_id is set for properties and reservations
4. Verify Supabase connection is working

---

## 🔄 Future Enhancements

- Email notifications for payout status
- PDF export of payout history
- Revenue analytics charts
- Property performance metrics
- Multi-currency support
- Automated payout scheduling
