## 🏠 Owner Portal Implementation Guide

### Overview
This guide provides the complete implementation for adding the Owner Portal to the existing ResIQ PWA. The owner portal will be integrated into the main app with role-based access.

---

## 📋 Step 1: Run Database Migration

1. Open Supabase SQL Editor
2. Run the complete `owner-portal-schema.sql` file
3. Verify tables created:
   ```sql
   SELECT * FROM property_owners LIMIT 1;
   SELECT * FROM payout_requests LIMIT 1;
   ```

---

## 📋 Step 2: Create Your First Owner Account

```sql
-- Create owner account
INSERT INTO property_owners (name, email, phone, password, bank_account_number, bank_ifsc, upi_id, commission_rate)
VALUES (
    'Property Owner Name',
    'owner@yourdomain.com',
    '+91-9876543210',
    'password123',  -- CHANGE THIS!
    '1234567890123456',
    'SBIN0001234',
    'owner@upi',
    20.00  -- 20% Hostizzy commission
);

-- Get the owner ID
SELECT id, name, email FROM property_owners WHERE email = 'owner@yourdomain.com';

-- Link your properties to this owner (replace OWNER_ID with actual UUID)
UPDATE properties
SET owner_id = 'PASTE_OWNER_ID_HERE'
WHERE id IN (1, 2, 3);  -- Replace with your property IDs

-- Link existing reservations to owner
UPDATE reservations r
SET owner_id = p.owner_id
FROM properties p
WHERE r.property_id = p.id
    AND p.owner_id IS NOT NULL
    AND r.owner_id IS NULL;
```

---

## 📋 Step 3: Modify Login Function

Find the `login()` function in `index.html` (around line 8148) and replace it with:

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

            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            updateUserEmailDisplay(currentUser.email);
            document.querySelector('.mobile-nav').classList.remove('hidden');
            document.getElementById('mobileHeader').classList.remove('hidden');
            document.getElementById('mobileUserEmail').textContent = staffUser.email;

            if (staffUser.role === 'staff') {
                hidePerformanceForStaff();
            }

            await loadDashboard();
            showToast('Welcome!', `Logged in as ${staffUser.name}`, '👋');

            const lastView = localStorage.getItem('lastView') || 'home';
            showView(lastView);

            if (lastView === 'home') {
                setTimeout(() => updateHomeScreenStats(), 500);
            }
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

            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('ownerApp').classList.remove('hidden');
            document.getElementById('ownerUserEmail').textContent = ownerUser.email;
            document.getElementById('ownerUserName').textContent = ownerUser.name;

            await loadOwnerDashboard();
            showToast('Welcome!', `Logged in as ${ownerUser.name}`, '👋');
            showOwnerView('ownerDashboard');
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

---

## 📋 Step 4: Add Owner Database Functions

Add these functions to the `db` object (around line 8000):

```javascript
// Add to db object
const db = {
    // ... existing functions ...

    // Owner Functions
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

    // Payout Request Functions
    getPayoutRequests: async (ownerId = null) => {
        let query = supabase
            .from('payout_requests')
            .select(`
                *,
                property_owners!inner(name, email),
                properties(name)
            `)
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

    updatePayoutStatus: async (payoutId, status, notes) => {
        const updates = {
            status: status,
            processed_at: new Date().toISOString(),
            processed_by: currentUser?.id,
            admin_notes: notes
        };

        const { data, error } = await supabase
            .from('payout_requests')
            .update(updates)
            .eq('id', payoutId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Owner Revenue Functions
    getOwnerRevenue: async (ownerId, startDate = null, endDate = null) => {
        let query = supabase
            .from('reservations')
            .select('*')
            .eq('owner_id', ownerId)
            .in('status', ['confirmed', 'checked_in', 'completed']);

        if (startDate) {
            query = query.gte('check_in', startDate);
        }
        if (endDate) {
            query = query.lte('check_in', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;

        const totalRevenue = data.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const hostizzyCommission = data.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
        const netEarnings = totalRevenue - hostizzyCommission;

        return {
            totalRevenue,
            hostizzyCommission,
            netEarnings,
            totalBookings: data.length,
            bookings: data
        };
    },

    getOwnerPendingPayout: async (ownerId) => {
        // Get total earned from paid bookings
        const { data: reservations, error: resError } = await supabase
            .from('reservations')
            .select('total_amount, hostizzy_revenue')
            .eq('owner_id', ownerId)
            .eq('payment_status', 'paid')
            .in('status', ['confirmed', 'checked_in', 'completed']);

        if (resError) throw resError;

        const totalEarned = reservations.reduce((sum, r) =>
            sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.hostizzy_revenue) || 0)), 0
        );

        // Get total already paid out
        const { data: payouts, error: payError } = await supabase
            .from('payout_requests')
            .select('amount')
            .eq('owner_id', ownerId)
            .eq('status', 'completed');

        if (payError) throw payError;

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
};
```

---

## 📋 Step 5: Add Owner Portal HTML

Add this HTML section after the main app section (after `</div><!-- mainApp -->`):

```html
<!-- Owner Portal App -->
<div id="ownerApp" class="hidden" style="display: flex; flex-direction: column; height: 100vh;">
    <!-- Owner Header -->
    <header style="background: var(--primary); color: white; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="margin: 0; font-size: 20px;">🏠 Owner Portal</h2>
                <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;" id="ownerUserName">Owner Name</p>
            </div>
            <div style="display: flex; align-items: center; gap: 16px;">
                <span style="font-size: 13px;" id="ownerUserEmail">owner@email.com</span>
                <button onclick="logout()" style="background: white; color: var(--primary); border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Logout
                </button>
            </div>
        </div>
    </header>

    <!-- Owner Navigation -->
    <nav style="background: white; border-bottom: 1px solid var(--border); padding: 0 16px; display: flex; gap: 8px; overflow-x: auto;">
        <button class="owner-nav-btn active" onclick="showOwnerView('ownerDashboard')">
            📊 Dashboard
        </button>
        <button class="owner-nav-btn" onclick="showOwnerView('ownerBookings')">
            📅 My Bookings
        </button>
        <button class="owner-nav-btn" onclick="showOwnerView('ownerPayouts')">
            💰 Payouts
        </button>
        <button class="owner-nav-btn" onclick="showOwnerView('ownerBankDetails')">
            🏦 Bank Details
        </button>
        <button class="owner-nav-btn" onclick="showOwnerView('ownerProperties')">
            🏠 My Properties
        </button>
    </nav>

    <!-- Owner Content Area -->
    <main style="flex: 1; overflow-y: auto; padding: 24px; background: var(--background);">

        <!-- Dashboard View -->
        <div id="ownerDashboardView" class="owner-view">
            <h3 style="margin: 0 0 24px 0;">Revenue Dashboard</h3>

            <!-- Revenue Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-value" id="ownerTotalRevenue">₹0</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="ownerHostizzyCommission">₹0</div>
                    <div class="stat-label">Hostizzy Commission</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="ownerNetEarnings">₹0</div>
                    <div class="stat-label">Net Earnings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="ownerPendingPayout">₹0</div>
                    <div class="stat-label">Pending Payout</div>
                </div>
            </div>

            <!-- Request Payout Button -->
            <button onclick="openPayoutRequestModal()" class="btn btn-primary" style="margin-bottom: 24px;">
                💰 Request Payout
            </button>

            <!-- Recent Bookings -->
            <h4>Recent Bookings</h4>
            <div id="ownerRecentBookings"></div>
        </div>

        <!-- Bookings View -->
        <div id="ownerBookingsView" class="owner-view hidden">
            <h3 style="margin: 0 0 24px 0;">My Bookings</h3>
            <div id="ownerBookingsList"></div>
        </div>

        <!-- Payouts View -->
        <div id="ownerPayoutsView" class="owner-view hidden">
            <h3 style="margin: 0 0 24px 0;">Payout History</h3>
            <div id="ownerPayoutsList"></div>
        </div>

        <!-- Bank Details View -->
        <div id="ownerBankDetailsView" class="owner-view hidden">
            <h3 style="margin: 0 0 24px 0;">Bank Account Details</h3>
            <div class="form-container" style="max-width: 600px;">
                <div class="form-group">
                    <label>Account Holder Name</label>
                    <input type="text" id="ownerAccountHolderName" placeholder="Enter account holder name">
                </div>
                <div class="form-group">
                    <label>Bank Account Number</label>
                    <input type="text" id="ownerBankAccountNumber" placeholder="Enter account number">
                </div>
                <div class="form-group">
                    <label>IFSC Code</label>
                    <input type="text" id="ownerBankIFSC" placeholder="Enter IFSC code">
                </div>
                <div class="form-group">
                    <label>Bank Name</label>
                    <input type="text" id="ownerBankName" placeholder="Enter bank name">
                </div>
                <div class="form-group">
                    <label>Branch</label>
                    <input type="text" id="ownerBankBranch" placeholder="Enter branch name">
                </div>
                <div class="form-group">
                    <label>UPI ID (Optional)</label>
                    <input type="text" id="ownerUPIId" placeholder="yourname@upi">
                </div>
                <button onclick="saveOwnerBankDetails()" class="btn btn-primary">Save Bank Details</button>
            </div>
        </div>

        <!-- Properties View -->
        <div id="ownerPropertiesView" class="owner-view hidden">
            <h3 style="margin: 0 0 24px 0;">My Properties</h3>
            <div id="ownerPropertiesList"></div>
        </div>

    </main>
</div>

<!-- Payout Request Modal -->
<div id="payoutRequestModal" class="modal">
    <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
            <h3 class="modal-title">Request Payout</h3>
            <span class="modal-close" onclick="closePayoutRequestModal()">&times;</span>
        </div>

        <div style="background: var(--background); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Available Balance:</span>
                <strong id="payoutAvailableBalance">₹0</strong>
            </div>
        </div>

        <div class="form-group">
            <label>Payout Amount (₹) *</label>
            <input type="number" id="payoutAmount" min="100" step="0.01" placeholder="Minimum ₹100">
            <small>Minimum payout amount is ₹100</small>
        </div>

        <div class="form-group">
            <label>Payout Method *</label>
            <select id="payoutMethod">
                <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="upi">UPI</option>
            </select>
        </div>

        <div class="form-group">
            <label>Notes (Optional)</label>
            <textarea id="payoutNotes" rows="3" placeholder="Any special instructions..."></textarea>
        </div>

        <div style="display: flex; gap: 12px;">
            <button onclick="submitPayoutRequest()" class="btn btn-primary" style="flex: 1;">Submit Request</button>
            <button onclick="closePayoutRequestModal()" class="btn" style="flex: 1;">Cancel</button>
        </div>
    </div>
</div>

<style>
.owner-nav-btn {
    background: none;
    border: none;
    padding: 16px 20px;
    cursor: pointer;
    font-weight: 600;
    color: var(--text-secondary);
    border-bottom: 3px solid transparent;
    white-space: nowrap;
    transition: all 0.2s;
}

.owner-nav-btn:hover {
    color: var(--primary);
    background: var(--background);
}

.owner-nav-btn.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
}

.owner-view {
    animation: fadeIn 0.3s;
}
</style>
```

Continued in next message...
