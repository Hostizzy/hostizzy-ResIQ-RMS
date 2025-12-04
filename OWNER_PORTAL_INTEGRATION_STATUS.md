# Owner Portal Integration - Final Step

## What's Been Done ✅

1. Database functions added to `db` object
2. Login function modified to support hybrid authentication
3. Logout function updated to support owner portal

## What You Need To Add

Insert the following code at **line 7491** (after the bulk actions bar, before the `<script>` tag):

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

## JavaScript Functions to Add

Copy the entire content of `owner-portal-functions.js` and paste it in the `<script>` section (around line 21400, before the closing `</script>` tag).

The file contains all the owner portal JavaScript functions - it's too long to paste here (547 lines) but it's already in the repository.

## Quick Integration Commands

Since manual editing is tedious, you can also use this automated approach:

1. Run the database migration first:
   ```bash
   # In Supabase SQL Editor
   # Run owner-portal-schema.sql
   ```

2. I can create a Git commit with the HTML added programmatically if you prefer.

Would you like me to:
A) Add the HTML directly to index.html now (I'll do it programmatically)
B) Give you the exact line numbers to insert manually
C) Create a complete modified index.html file

Let me know and I'll complete the integration!
