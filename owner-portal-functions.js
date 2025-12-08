// =====================================================
// OWNER PORTAL JAVASCRIPT FUNCTIONS
// Add these functions to index.html <script> section
// =====================================================

// Global owner data
let ownerData = {
    revenue: null,
    bookings: [],
    payouts: [],
    properties: []
};

// Show Owner View
function showOwnerView(viewName) {
    // Hide all owner views
    document.querySelectorAll('.owner-view').forEach(view => {
        view.classList.add('hidden');
    });

    // Show selected view
    document.getElementById(viewName + 'View').classList.remove('hidden');

    // Update nav buttons
    document.querySelectorAll('.owner-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Load data for the view
    if (viewName === 'ownerDashboard') {
        loadOwnerDashboard();
    } else if (viewName === 'ownerBookings') {
        loadOwnerBookings();
    } else if (viewName === 'ownerPayouts') {
        loadOwnerPayouts();
    } else if (viewName === 'ownerBankDetails') {
        loadOwnerBankDetails();
    } else if (viewName === 'ownerProperties') {
        loadOwnerProperties();
    }
}

// Load Owner Dashboard
async function loadOwnerDashboard() {
    try {
        const ownerId = currentUser.id;

        // Get revenue data
        ownerData.revenue = await db.getOwnerRevenue(ownerId);

        // Update revenue cards
        document.getElementById('ownerTotalRevenue').textContent =
            '₹' + ownerData.revenue.totalRevenue.toLocaleString('en-IN');
        document.getElementById('ownerHostizzyCommission').textContent =
            '₹' + ownerData.revenue.hostizzyCommission.toLocaleString('en-IN');
        document.getElementById('ownerNetEarnings').textContent =
            '₹' + ownerData.revenue.netEarnings.toLocaleString('en-IN');

        // Get pending payout amount
        const pendingPayout = await db.getOwnerPendingPayout(ownerId);
        document.getElementById('ownerPendingPayout').textContent =
            '₹' + pendingPayout.toLocaleString('en-IN');

        // Load recent bookings (last 10)
        const recentBookings = ownerData.revenue.bookings.slice(0, 10);
        renderOwnerRecentBookings(recentBookings);

    } catch (error) {
        console.error('Error loading owner dashboard:', error);
        showToast('Error', 'Failed to load dashboard data', '❌');
    }
}

// Render Recent Bookings
function renderOwnerRecentBookings(bookings) {
    const container = document.getElementById('ownerRecentBookings');

    if (bookings.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No bookings yet</p>';
        return;
    }

    let html = '<div class="table-container"><table class="data-table"><thead><tr>';
    html += '<th>Booking ID</th>';
    html += '<th>Guest</th>';
    html += '<th>Property</th>';
    html += '<th>Check In</th>';
    html += '<th>Nights</th>';
    html += '<th>Amount</th>';
    html += '<th>Status</th>';
    html += '</tr></thead><tbody>';

    bookings.forEach(booking => {
        const statusColors = {
            'pending': 'orange',
            'confirmed': 'blue',
            'checked_in': 'purple',
            'completed': 'green',
            'cancelled': 'red'
        };

        html += '<tr>';
        html += `<td><strong>${booking.booking_id}</strong></td>`;
        html += `<td>${booking.guest_name}</td>`;
        html += `<td>${booking.property_name}</td>`;
        html += `<td>${new Date(booking.check_in).toLocaleDateString('en-IN')}</td>`;
        html += `<td>${booking.nights}</td>`;
        html += `<td><strong>₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}</strong></td>`;
        html += `<td><span class="badge" style="background: ${statusColors[booking.status]};">${booking.status}</span></td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Load Owner Bookings
async function loadOwnerBookings() {
    try {
        const ownerId = currentUser.id;
        ownerData.bookings = await db.getOwnerBookings(ownerId);

        const container = document.getElementById('ownerBookingsList');

        if (ownerData.bookings.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No bookings found</p>';
            return;
        }

        let html = '<div class="table-container"><table class="data-table"><thead><tr>';
        html += '<th>Booking ID</th>';
        html += '<th>Guest Name</th>';
        html += '<th>Phone</th>';
        html += '<th>Property</th>';
        html += '<th>Check In</th>';
        html += '<th>Check Out</th>';
        html += '<th>Nights</th>';
        html += '<th>Guests</th>';
        html += '<th>Total Amount</th>';
        html += '<th>Hostizzy Commission</th>';
        html += '<th>Your Earnings</th>';
        html += '<th>Payment Status</th>';
        html += '<th>Status</th>';
        html += '</tr></thead><tbody>';

        ownerData.bookings.forEach(booking => {
            const yourEarnings = (parseFloat(booking.total_amount) || 0) - (parseFloat(booking.hostizzy_revenue) || 0);

            const paymentStatusColors = {
                'pending': 'orange',
                'partial': 'blue',
                'paid': 'green'
            };

            const statusColors = {
                'pending': 'orange',
                'confirmed': 'blue',
                'checked_in': 'purple',
                'completed': 'green',
                'cancelled': 'red'
            };

            html += '<tr>';
            html += `<td><strong>${booking.booking_id}</strong></td>`;
            html += `<td>${booking.guest_name}</td>`;
            html += `<td>${booking.guest_phone}</td>`;
            html += `<td>${booking.property_name}</td>`;
            html += `<td>${new Date(booking.check_in).toLocaleDateString('en-IN')}</td>`;
            html += `<td>${new Date(booking.check_out).toLocaleDateString('en-IN')}</td>`;
            html += `<td>${booking.nights}</td>`;
            html += `<td>${booking.adults}${booking.kids ? ' + ' + booking.kids + ' kids' : ''}</td>`;
            html += `<td><strong>₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}</strong></td>`;
            html += `<td style="color: var(--danger);">-₹${parseFloat(booking.hostizzy_revenue).toLocaleString('en-IN')}</td>`;
            html += `<td style="color: var(--success); font-weight: 700;">₹${yourEarnings.toLocaleString('en-IN')}</td>`;
            html += `<td><span class="badge" style="background: ${paymentStatusColors[booking.payment_status]};">${booking.payment_status}</span></td>`;
            html += `<td><span class="badge" style="background: ${statusColors[booking.status]};">${booking.status}</span></td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading bookings:', error);
        showToast('Error', 'Failed to load bookings', '❌');
    }
}

// Load Owner Payouts
async function loadOwnerPayouts() {
    try {
        const ownerId = currentUser.id;
        ownerData.payouts = await db.getPayoutRequests(ownerId);

        const container = document.getElementById('ownerPayoutsList');

        if (ownerData.payouts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No payout requests yet</p>';
            return;
        }

        let html = '<div class="table-container"><table class="data-table"><thead><tr>';
        html += '<th>Request Date</th>';
        html += '<th>Amount</th>';
        html += '<th>Method</th>';
        html += '<th>Status</th>';
        html += '<th>Processed Date</th>';
        html += '<th>Transaction ID</th>';
        html += '<th>Notes</th>';
        html += '</tr></thead><tbody>';

        ownerData.payouts.forEach(payout => {
            const statusColors = {
                'pending': 'orange',
                'approved': 'blue',
                'processing': 'purple',
                'completed': 'green',
                'rejected': 'red'
            };

            html += '<tr>';
            html += `<td>${new Date(payout.requested_at).toLocaleDateString('en-IN')}</td>`;
            html += `<td><strong>₹${parseFloat(payout.amount).toLocaleString('en-IN')}</strong></td>`;
            html += `<td>${payout.payout_method}</td>`;
            html += `<td><span class="badge" style="background: ${statusColors[payout.status]};">${payout.status}</span></td>`;
            html += `<td>${payout.processed_at ? new Date(payout.processed_at).toLocaleDateString('en-IN') : '-'}</td>`;
            html += `<td>${payout.transaction_id || '-'}</td>`;
            html += `<td>${payout.admin_notes || payout.owner_notes || '-'}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading payouts:', error);
        showToast('Error', 'Failed to load payouts', '❌');
    }
}

// Load Owner Bank Details
async function loadOwnerBankDetails() {
    try {
        const owner = await db.getOwner(currentUser.id);

        document.getElementById('ownerAccountHolderName').value = owner.account_holder_name || '';
        document.getElementById('ownerBankAccountNumber').value = owner.bank_account_number || '';
        document.getElementById('ownerBankIFSC').value = owner.bank_ifsc || '';
        document.getElementById('ownerBankName').value = owner.bank_name || '';
        document.getElementById('ownerBankBranch').value = owner.bank_branch || '';
        document.getElementById('ownerUPIId').value = owner.upi_id || '';

    } catch (error) {
        console.error('Error loading bank details:', error);
        showToast('Error', 'Failed to load bank details', '❌');
    }
}

// Save Owner Bank Details
async function saveOwnerBankDetails() {
    try {
        const updates = {
            id: currentUser.id,
            account_holder_name: document.getElementById('ownerAccountHolderName').value.trim(),
            bank_account_number: document.getElementById('ownerBankAccountNumber').value.trim(),
            bank_ifsc: document.getElementById('ownerBankIFSC').value.trim().toUpperCase(),
            bank_name: document.getElementById('ownerBankName').value.trim(),
            bank_branch: document.getElementById('ownerBankBranch').value.trim(),
            upi_id: document.getElementById('ownerUPIId').value.trim()
        };

        if (!updates.bank_account_number) {
            showToast('Validation Error', 'Please enter bank account number', '❌');
            return;
        }

        if (!updates.bank_ifsc) {
            showToast('Validation Error', 'Please enter IFSC code', '❌');
            return;
        }

        await db.saveOwner(updates);

        // Update current user
        currentUser = { ...currentUser, ...updates };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        showToast('Success', 'Bank details saved successfully!', '✅');

    } catch (error) {
        console.error('Error saving bank details:', error);
        showToast('Error', 'Failed to save bank details', '❌');
    }
}

// Load Owner Properties
async function loadOwnerProperties() {
    try {
        const properties = await db.getProperties();
        ownerData.properties = properties.filter(p => p.owner_id === currentUser.id);

        const container = document.getElementById('ownerPropertiesList');

        if (ownerData.properties.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No properties linked to your account</p>';
            return;
        }

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">';

        ownerData.properties.forEach(property => {
            html += `
                <div class="card">
                    <h4 style="margin: 0 0 12px 0;">${property.name}</h4>
                    <p style="color: var(--text-secondary); margin: 0 0 8px 0;">${property.location || 'No location'}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border);">
                        <span style="font-size: 13px; color: var(--text-secondary);">Commission Rate</span>
                        <strong style="color: var(--primary);">${currentUser.commission_rate || 20}%</strong>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading properties:', error);
        showToast('Error', 'Failed to load properties', '❌');
    }
}

// Open Payout Request Modal
async function openPayoutRequestModal() {
    try {
        const pendingPayout = await db.getOwnerPendingPayout(currentUser.id);

        document.getElementById('payoutAvailableBalance').textContent = '₹' + pendingPayout.toLocaleString('en-IN');
        document.getElementById('payoutAmount').value = '';
        document.getElementById('payoutAmount').max = pendingPayout;
        document.getElementById('payoutMethod').value = 'bank_transfer';
        document.getElementById('payoutNotes').value = '';

        document.getElementById('payoutRequestModal').classList.add('active');

    } catch (error) {
        console.error('Error opening payout modal:', error);
        showToast('Error', 'Failed to load payout data', '❌');
    }
}

// Close Payout Request Modal
function closePayoutRequestModal() {
    document.getElementById('payoutRequestModal').classList.remove('active');
}

// Submit Payout Request
async function submitPayoutRequest() {
    try {
        const amount = parseFloat(document.getElementById('payoutAmount').value);
        const method = document.getElementById('payoutMethod').value;
        const notes = document.getElementById('payoutNotes').value.trim();

        if (!amount || amount < 100) {
            showToast('Validation Error', 'Minimum payout amount is ₹100', '❌');
            return;
        }

        const availableBalance = parseFloat(document.getElementById('payoutAvailableBalance').textContent.replace('₹', '').replace(',', ''));

        if (amount > availableBalance) {
            showToast('Validation Error', 'Amount exceeds available balance', '❌');
            return;
        }

        if (!currentUser.bank_account_number && method === 'bank_transfer') {
            showToast('Error', 'Please add bank details first', '❌');
            closePayoutRequestModal();
            showOwnerView('ownerBankDetails');
            return;
        }

        if (!currentUser.upi_id && method === 'upi') {
            showToast('Error', 'Please add UPI ID first', '❌');
            closePayoutRequestModal();
            showOwnerView('ownerBankDetails');
            return;
        }

        const payoutRequest = {
            owner_id: currentUser.id,
            amount: amount,
            payout_method: method,
            owner_notes: notes,
            status: 'pending'
        };

        await db.savePayoutRequest(payoutRequest);

        closePayoutRequestModal();
        showToast('Success', 'Payout request submitted successfully!', '✅');

        // Reload dashboard
        loadOwnerDashboard();

    } catch (error) {
        console.error('Error submitting payout request:', error);
        showToast('Error', 'Failed to submit payout request', '❌');
    }
}

// Note: logout() function is defined in index.html to support both staff and owner portals
