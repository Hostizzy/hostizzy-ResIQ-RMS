// ResIQ Payments — Payment CRUD, multi-payment entry, payment history

async function loadPayments() {
    try {
        // Use cache when available to avoid redundant Supabase calls on view switch
        allReservations = dataCache.get('reservations') || await db.getReservations();
        if (!dataCache.get('reservations')) dataCache.set('reservations', allReservations);
        
        // Populate property filter dropdown
        const propertyFilter = document.getElementById('paymentPropertyFilter');
        if (propertyFilter) {
            const uniqueProperties = [...new Set(allReservations.map(r => r.property_name))].sort();
            propertyFilter.innerHTML = '<option value="">All Properties</option>' +
                uniqueProperties.map(p => `<option value="${p}">${p}</option>`).join('');
            // Restore previous filter state
            propertyFilter.value = paymentFilterState.property;
        }

        // Restore other filter values
        const searchInput = document.getElementById('searchPayments');
        const statusFilter = document.getElementById('paymentStatusFilter');
        if (searchInput) searchInput.value = paymentFilterState.search;
        if (statusFilter) statusFilter.value = paymentFilterState.status;

        // Filter confirmed reservations (reuse later for reminders)
        const confirmedReservations = allReservations.filter(r => r.status !== 'cancelled');
        
        // Calculate metrics — based on payment receivable (host payout), not gross guest payments
        const totalReceivable = confirmedReservations
            .reduce((sum, r) => sum + getHostPayout(r), 0);

        const totalCollected = confirmedReservations
            .reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);

        const totalOutstanding = confirmedReservations
            .reduce((sum, r) => sum + getBalance(r), 0);

        const totalOtaFees = confirmedReservations
            .reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0);

        // Render payment stats cards
        let statsHTML = `
            <div class="stat-card" style="border-left-color: var(--primary);">
                <div class="stat-label">Total Receivable</div>
                <div class="stat-value">${formatCurrency(totalReceivable)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Expected host payout
                </div>
            </div>
        `;

        // Conditionally add OTA fees card for visibility
        if (totalOtaFees > 0) {
            const totalGross = confirmedReservations
                .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
            statsHTML += `
            <div class="stat-card" style="border-left-color: #f59e0b;">
                <div class="stat-label">Gross Booking Value</div>
                <div class="stat-value">${formatCurrency(totalGross)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Before OTA fees (${formatCurrency(totalOtaFees)} deducted)
                </div>
            </div>
            `;
        }

        statsHTML += `
            <div class="stat-card" style="border-left-color: #10b981;">
                <div class="stat-label">Total Collected</div>
                <div class="stat-value">${formatCurrency(totalCollected)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Payments received
                </div>
            </div>
            <div class="stat-card" style="border-left-color: #ef4444;">
                <div class="stat-label">Outstanding</div>
                <div class="stat-value">${formatCurrency(totalOutstanding)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Yet to be collected
                </div>
            </div>
        `;
        
        document.getElementById('paymentStatsGrid').innerHTML = statsHTML;

        // Render payment reminders
        renderPaymentReminders(confirmedReservations);

        // Apply filters if any are active, otherwise show all
        const hasActiveFilters = paymentFilterState.search || paymentFilterState.status || paymentFilterState.property;
        if (hasActiveFilters) {
            filterPayments(); // Reapply saved filters
        } else {
            displayPayments(allReservations);
        }
    } catch (error) {
        console.error('Payments error:', error);
        showToast('Error', 'Failed to load payments', '❌');
    }
}

function displayPayments(reservations) {
    const tbody = document.getElementById('paymentsTableBody');
    if (reservations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding: 60px 20px; text-align: center; color: var(--text-secondary);">
            <div style="max-width: 320px; margin: 0 auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 16px;"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">No payment records found</div>
                <div style="font-size: 13px; line-height: 1.5;">Try adjusting filters or add payments from the Reservations view.</div>
            </div>
        </td></tr>`;
        return;
    }
    
    tbody.innerHTML = reservations.map(r => {
        const total = parseFloat(r.total_amount) || 0;
        const otaFee = parseFloat(r.ota_service_fee) || 0;
        const receivable = getHostPayout(r);
        const paid = parseFloat(r.paid_amount) || 0;
        const isOTA = r.booking_source && r.booking_source !== 'DIRECT';
        const balance = getBalance(r);
        const status = r.payment_status || 'pending';

        // Calculate payment progress % based on receivable amount
        const progressPercent = receivable > 0 ? Math.min((paid / receivable) * 100, 100) : 0;
        const progressClass = status === 'paid' ? 'full' : status === 'partial' ? 'partial' : 'pending';

        // Status icon
        const statusIcon = status === 'paid'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : status === 'partial'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/></svg>';

        // Balance class
        const balanceClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero';

        return `
            <tr>
                <td>
                    <strong style="color: var(--primary); cursor: pointer; text-decoration: underline;"
                            data-action="navigate" data-bid="${r.booking_id}">
                        ${r.booking_id || 'N/A'}
                    </strong>
                </td>
                <td>
                    <div style="font-weight: 600;">${r.guest_name}</div>
                    ${r.guest_phone ? `<div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">${r.guest_phone}</div>` : ''}
                </td>
                <td>${r.property_name}</td>
                <td>${formatDate(r.check_in)}</td>
                <td>
                    <div style="font-weight: 600; font-size: 14px;">
                        ${formatCurrency(receivable, {compact: false})}
                    </div>
                    ${otaFee > 0 ? `
                        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">
                            Gross: ${formatCurrency(total, {compact: false})}
                        </div>
                        <div style="font-size: 11px; color: var(--danger); margin-top: 1px;">
                            <i data-lucide="building" style="width: 10px; height: 10px; margin-right: 2px;"></i>OTA Fee: -${formatCurrency(otaFee, {compact: false})}
                        </div>
                    ` : ''}
                </td>
                <td>
                    <div style="color: var(--success); font-weight: 700; font-size: 14px;">${formatCurrency(paid, {compact: false})}</div>
                    <div class="payment-progress"><div class="payment-progress-fill ${progressClass}" style="width: ${progressPercent}%;"></div></div>
                    <div style="font-size: 10px; color: var(--text-tertiary); margin-top: 2px;">${progressPercent.toFixed(0)}% collected</div>
                </td>
                <td>
                    <span class="balance-amount ${balanceClass}">${formatCurrency(Math.abs(balance), {compact: false})}</span>
                </td>
                <td>
                    <span class="payment-status ${status}">${statusIcon}${status.toUpperCase()}</span>
                    ${isOTA ?
                        '<div style="font-size: 10px; color: var(--text-secondary); margin-top: 6px; display: flex; align-items: center; gap: 3px;"><i data-lucide="credit-card" style="width: 10px; height: 10px;"></i>Via OTA</div>'
                        : ''}
                </td>
                <td>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${balance > 0 ? `<button class="btn btn-primary btn-sm" data-action="add-payment" data-bid="${r.booking_id}" style="display: flex; align-items: center; gap: 4px;"><i data-lucide="plus" style="width: 12px; height: 12px;"></i>Add</button>` : ''}
                        <button class="btn btn-secondary btn-sm" data-action="payment-history" data-bid="${r.booking_id}" style="display: flex; align-items: center; gap: 4px;"><i data-lucide="history" style="width: 12px; height: 12px;"></i>History</button>
                        ${balance > 0 ? `<button class="btn btn-secondary btn-sm" data-action="remind" data-bid="${r.booking_id}" title="Send Payment Reminder" style="display: flex; align-items: center; gap: 4px;"><i data-lucide="message-circle" style="width: 12px; height: 12px;"></i>Remind</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    // Refresh Lucide icons — scoped to table
    requestAnimationFrame(() => {
        if (typeof refreshIcons === 'function') refreshIcons(tbody);
    });
}

// ── Event Delegation for Payments Table ──
(function initPaymentTableDelegation() {
    function handlePaymentClick(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;
        const bid = actionEl.dataset.bid;
        if (!bid) return;

        switch (action) {
            case 'navigate':
                navigateToReservation(bid);
                break;
            case 'add-payment':
                openPaymentModal(bid);
                break;
            case 'payment-history':
                viewPaymentHistory(bid);
                break;
            case 'remind':
                openWhatsAppMenu(bid);
                break;
        }
    }

    const tbody = document.getElementById('paymentsTableBody');
    if (tbody) {
        tbody.addEventListener('click', handlePaymentClick);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            const tb = document.getElementById('paymentsTableBody');
            if (tb) tb.addEventListener('click', handlePaymentClick);
        });
    }
})();

// Store filtered payments for CSV export
let filteredPayments = [];
const _debouncedPaymentFilter = debounce(filterPayments, 300);

function filterPayments() {
    const search = document.getElementById('searchPayments').value.toLowerCase();
    const status = document.getElementById('paymentStatusFilter').value;
    const property = document.getElementById('paymentPropertyFilter').value;

    // Save filter state for persistence
    paymentFilterState = { search, status, property };

    filteredPayments = allReservations.filter(r => {
        const matchesSearch = !search || 
            (r.guest_name || '').toLowerCase().includes(search) ||
            (r.booking_id || '').toLowerCase().includes(search);
        const matchesStatus = !status || r.payment_status === status;
        const matchesProperty = !property || r.property_name === property;
        return matchesSearch && matchesStatus && matchesProperty;
    });
    
    displayPayments(filteredPayments);
}

function clearPaymentFilters() {
    document.getElementById('searchPayments').value = '';
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentPropertyFilter').value = '';
    // Reset saved filter state
    paymentFilterState = { search: '', status: '', property: '' };
    filteredPayments = [];
    displayPayments(allReservations);
    showToast('Filters Cleared', 'All filters have been reset', 'ℹ️');
}


// Payment Modal Functions
async function openPaymentModal(bookingId) {
    const modal = document.getElementById('paymentModal');
    const reservation = allReservations.find(r => r.booking_id === bookingId);
    
    if (!reservation) {
        showToast('Error', 'Reservation not found', '❌');
        return;
    }
    
    const total = parseFloat(reservation.total_amount) || 0;
    const otaFee = parseFloat(reservation.ota_service_fee) || 0;
    const hostPayout = getHostPayout(reservation);
    const paid = parseFloat(reservation.paid_amount) || 0;
    const balance = getBalance(reservation);

    let amountDisplay = formatCurrency(total, {compact: false});
    if (otaFee > 0) {
        amountDisplay += `<div style="font-size: 12px; color: var(--danger); margin-top: 4px;">OTA Fee: ${formatCurrency(otaFee, {compact: false})}</div>`;
        amountDisplay += `<div style="font-size: 12px; color: var(--success); margin-top: 4px; font-weight: 600;">Host Payout: ${formatCurrency(hostPayout, {compact: false})}</div>`;
    }
    
    document.getElementById('paymentTotalAmount').innerHTML = amountDisplay;
    document.getElementById('paymentPaidAmount').textContent = formatCurrency(paid, {compact: false});
    document.getElementById('paymentBalance').textContent = formatCurrency(balance, {compact: false});
    
    document.getElementById('paymentBookingId').value = bookingId;
    document.getElementById('editPaymentId').value = '';
    document.getElementById('paymentAmount').value = balance > 0 ? Math.round(balance) : '';
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('paymentMethod').value = '';
    document.getElementById('paymentRecipient').value = '';
    document.getElementById('paymentRecipientGroup').style.display = 'none';
    document.getElementById('paymentReference').value = '';
    document.getElementById('paymentNotes').value = '';
    
    modal.classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function toggleRecipientField() {
    const method = document.getElementById('paymentMethod').value;
    const recipientGroup = document.getElementById('paymentRecipientGroup');
    const recipientSelect = document.getElementById('paymentRecipient');
    
    if (method === 'cash' || method === 'upi' || method === 'bank_transfer') {
        recipientGroup.style.display = 'block';
        recipientSelect.required = true;
    } else {
        recipientGroup.style.display = 'none';
        recipientSelect.required = false;
        recipientSelect.value = '';
    }
}

/**
 * Switch from single payment modal to multi-payment modal
 */
function switchToMultiPayment() {
    // Get data from single payment modal
    const bookingId = document.getElementById('paymentBookingId').value;
    const amount = document.getElementById('paymentAmount').value;
    const method = document.getElementById('paymentMethod').value;
    const recipient = document.getElementById('paymentRecipient').value;
    const date = document.getElementById('paymentDate').value;
    const notes = document.getElementById('paymentNotes').value;
    
    // Close single payment modal
    closePaymentModal();
    
    // Find reservation details
    const reservation = allReservations.find(r => r.booking_id === bookingId);
    
    if (!reservation) {
        showToast('Error', 'Reservation not found', '❌');
        return;
    }
    
    // Open multi-payment modal
    const modal = document.getElementById('multiPaymentModal');
    const title = modal.querySelector('.modal-title');
    
    title.innerHTML = `<i data-lucide="plus-circle" style="width: 14px; height: 14px; margin-right: 4px;"></i>Add Multiple Payments - ${reservation.guest_name}`;
    
    // Initialize with 2 rows
    multiPaymentRows = [];
    addPaymentRow();
    addPaymentRow();
    
    modal.classList.add('active');
    
    // Pre-fill first row with data from single payment modal
    setTimeout(() => {
        if (multiPaymentRows.length > 0) {
            const firstRow = multiPaymentRows[0];
            
            document.getElementById(`bookingId_${firstRow.id}`).value = bookingId;
            document.getElementById(`guestName_${firstRow.id}`).value = reservation.guest_name;
            document.getElementById(`date_${firstRow.id}`).value = date || new Date().toISOString().split('T')[0];
            
            if (amount) {
                document.getElementById(`amount_${firstRow.id}`).value = amount;
            }
            
            if (method) {
                document.getElementById(`method_${firstRow.id}`).value = method;
                handleMethodChange(firstRow.id);
                
                if (recipient) {
                    document.getElementById(`recipient_${firstRow.id}`).value = recipient;
                }
            }
        }
        
        // Pre-fill booking ID for other rows
        multiPaymentRows.slice(1).forEach(row => {
            document.getElementById(`bookingId_${row.id}`).value = bookingId;
            document.getElementById(`guestName_${row.id}`).value = reservation.guest_name;
            document.getElementById(`date_${row.id}`).value = date || new Date().toISOString().split('T')[0];
        });
        
        showToast('Switched to Multi-Payment', 'You can now add multiple payment entries', '✅');
    }, 100);
}

async function savePayment() {
    try {
        const bookingId = document.getElementById('paymentBookingId').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const method = document.getElementById('paymentMethod').value;
        const editPaymentId = document.getElementById('editPaymentId').value;
        
        if (!amount || amount <= 0) {
            showToast('Validation Error', 'Please enter a valid amount', '❌');
            return;
        }
        
        if (!method) {
            showToast('Validation Error', 'Please select payment method', '❌');
            return;
        }
        
        const recipientGroup = document.getElementById('paymentRecipientGroup');
        if (recipientGroup.style.display !== 'none') {
            const recipient = document.getElementById('paymentRecipient').value;
            if (!recipient) {
                showToast('Validation Error', 'Please select payment recipient', '❌');
                return;
            }
        }
        
        const paymentData = {
            booking_id: bookingId,
            payment_date: document.getElementById('paymentDate').value,
            amount: amount,
            payment_method: method,
            payment_recipient: document.getElementById('paymentRecipient').value || null,
            reference_number: document.getElementById('paymentReference').value || null,
            notes: document.getElementById('paymentNotes').value || null,
            created_by: currentUser?.id || null
        };
        
        if (navigator.onLine) {
            if (editPaymentId) {
                // Update existing payment
                const { error } = await supabase
                    .from('payments')
                    .update(paymentData)
                    .eq('id', editPaymentId);
                
                if (error) throw error;
                showToast('Success', 'Payment updated successfully!', '✅');
            } else {
                // Create new payment
                await db.savePayment(paymentData);
                showToast('Success', 'Payment saved successfully!', '✅');
            }
            
            await recalculatePaymentStatus(bookingId);
            closePaymentModal();
            await loadPayments();
            await loadReservations();
            await loadDashboard();
        } else {
            if (!confirm('You are offline. This payment will be saved locally and synced when you are back online. Continue?')) {
                return;
            }
            await saveToOfflineDB('pendingPayments', paymentData);
            closePaymentModal();
            showToast('Saved Offline', 'Payment will sync when online', '💾');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Error', 'Failed to save payment: ' + error.message, '❌');
    }
}

async function recalculatePaymentStatus(bookingId) {
    const payments = await db.getPayments(bookingId);
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const reservation = await db.getReservation(bookingId);
    const totalAmount = parseFloat(reservation.total_amount) || 0;
    const otaFee = parseFloat(reservation.ota_service_fee) || 0;
    const isOTA = reservation.booking_source && reservation.booking_source !== 'DIRECT';

    // For OTA bookings, the receivable is total minus OTA's cut (they keep their fee)
    const receivable = isOTA ? (totalAmount - otaFee) : totalAmount;

    // Round to nearest rupee to avoid floating-point precision issues
    const paidRounded = Math.round(totalPaid);
    const receivableRounded = Math.round(receivable);

    let paymentStatus = 'pending';
    if (paidRounded >= receivableRounded) {
        paymentStatus = 'paid';
    } else if (paidRounded > 0) {
        paymentStatus = 'partial';
    }

    await supabase
        .from('reservations')
        .update({
            paid_amount: totalPaid,
            payment_status: paymentStatus
        })
        .eq('booking_id', bookingId);
}

// ==========================================
// MULTI-PAYMENT ENTRY FUNCTIONS
// ==========================================

let multiPaymentRows = [];

/**
 * Open multi-payment modal
 */
function openMultiPaymentModal() {
    const modal = document.getElementById('multiPaymentModal');
    const title = modal.querySelector('.modal-title');
    
    // Reset title for general multi-payment entry
    title.innerHTML = '<i data-lucide="plus-circle" style="width: 14px; height: 14px; margin-right: 4px;"></i>Add Multiple Payments';
    
    modal.classList.add('active');
    document.getElementById('multiPaymentDate').value = new Date().toISOString().split('T')[0];
    
    // Initialize with 3 empty rows
    multiPaymentRows = [];
    addPaymentRow();
    addPaymentRow();
    addPaymentRow();
}

/**
 * Close multi-payment modal
 */
function closeMultiPaymentModal() {
    document.getElementById('multiPaymentModal').classList.remove('active');
    multiPaymentRows = [];
}

/**
 * Add a payment entry row
 */
function addPaymentRow() {
    const rowId = Date.now() + Math.random();
    multiPaymentRows.push({ id: rowId });
    renderPaymentRows();
}

/**
 * Remove a payment entry row
 */
function removePaymentRow(rowId) {
    multiPaymentRows = multiPaymentRows.filter(row => row.id !== rowId);
    renderPaymentRows();
    
    if (multiPaymentRows.length === 0) {
        addPaymentRow(); // Always keep at least one row
    }
}

/**
 * Render payment entry rows - HYBRID (Table for desktop, Cards for mobile)
 */
function renderPaymentRows() {
    const tableBody = document.getElementById('multiPaymentTableBody');
    const cardsContainer = document.getElementById('multiPaymentCardsContainer');
    const countEl = document.getElementById('paymentEntryCount');
    
    // Update entry count
    if (countEl) {
        countEl.textContent = `(${multiPaymentRows.length} ${multiPaymentRows.length === 1 ? 'entry' : 'entries'})`;
    }
    
    if (multiPaymentRows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 40px; color: var(--text-secondary);">Click "Add Row" to start</td></tr>';
        cardsContainer.innerHTML = '<div class="text-center" style="padding: 40px; color: var(--text-secondary);">Click "Add Payment Entry" to start</div>';
        return;
    }
    
    // ========================================
    // RENDER DESKTOP TABLE VIEW
    // ========================================
    tableBody.innerHTML = multiPaymentRows.map(row => `
        <tr>
            <td style="padding: 8px;">
                <input type="text" 
                    id="bookingId_${row.id}" 
                    list="bookingIdList"
                    placeholder="Enter booking ID" 
                    onchange="autofillGuestName(${row.id})"
                    style="width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px;">
            </td>
            <td style="padding: 8px;">
                <input type="text" 
                    id="guestName_${row.id}" 
                    placeholder="Auto-filled" 
                    readonly
                    style="width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px; background: #f8fafc;">
            </td>
            <td style="padding: 8px;">
                <input type="number" 
                    id="amount_${row.id}" 
                    placeholder="0" 
                    min="0" 
                    step="0.01"
                    style="width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px;">
            </td>
            <td style="padding: 8px;">
                <input type="date" 
                    id="date_${row.id}"
                    style="width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px;">
            </td>
            <td style="padding: 8px;">
                <select id="method_${row.id}" onchange="handleMethodChange(${row.id})" style="width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px;">
                    <option value="">Select</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="gateway">Gateway</option>
                    <option value="bank_transfer">Bank</option>
                </select>
            </td>
            <td style="padding: 8px;">
                <select id="recipient_${row.id}" style="width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px; display: none;">
                    <option value="">Select</option>
                    <option value="Hostizzy">Hostizzy</option>
                    <option value="Property Owner">Owner</option>
                </select>
                <span id="recipient_na_${row.id}" style="color: #94a3b8; font-size: 13px;">N/A</span>
            </td>
            <td style="padding: 8px; text-align: center;">
                <button class="btn btn-danger btn-sm" onclick="removePaymentRow(${row.id})" style="padding: 4px 8px;">
                    ✕
                </button>
            </td>
        </tr>
    `).join('');
    
    // ========================================
    // RENDER MOBILE CARD VIEW
    // ========================================
    cardsContainer.innerHTML = multiPaymentRows.map((row, index) => `
        <div class="payment-entry-card">
            <div class="payment-entry-header">
                <span class="payment-entry-number">Payment #${index + 1}</span>
                ${multiPaymentRows.length > 1 ? `
                    <button class="payment-entry-remove" onclick="removePaymentRow(${row.id})" title="Remove">
                        ✕
                    </button>
                ` : ''}
            </div>
            
            <div class="payment-entry-fields">
                <div class="payment-field payment-field-full">
                    <label>Booking ID *</label>
                    <input type="text" 
                        id="bookingId_mobile_${row.id}" 
                        list="bookingIdList"
                        placeholder="Enter or select booking ID" 
                        onchange="autofillGuestNameMobile(${row.id})"
                        required>
                </div>
                
                <div class="payment-field payment-field-full">
                    <label>Guest Name</label>
                    <input type="text" 
                        id="guestName_mobile_${row.id}" 
                        placeholder="Auto-filled from booking" 
                        readonly>
                </div>
                
                <div class="payment-field">
                    <label>Amount (₹) *</label>
                    <input type="number" 
                        id="amount_mobile_${row.id}" 
                        placeholder="0" 
                        min="0" 
                        step="0.01"
                        required>
                </div>
                
                <div class="payment-field">
                    <label>Payment Date *</label>
                    <input type="date" 
                        id="date_mobile_${row.id}"
                        required>
                </div>
                
                <div class="payment-field">
                    <label>Payment Method *</label>
                    <select id="method_mobile_${row.id}" onchange="handleMethodChangeMobile(${row.id})" required>
                        <option value="">Select Method</option>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="gateway">Gateway</option>
                        <option value="bank_transfer">Bank Transfer</option>
                    </select>
                </div>
                
                <div class="payment-field" id="recipientField_mobile_${row.id}" style="display: none;">
                    <label>Received By *</label>
                    <select id="recipient_mobile_${row.id}">
                        <option value="">Select Recipient</option>
                        <option value="Hostizzy">Hostizzy</option>
                        <option value="Property Owner"><i data-lucide="home" style="width: 14px; height: 14px; margin-right: 4px;"></i>Property Owner</option>
                    </select>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add datalist for booking IDs (shared by both views)
    if (!document.getElementById('bookingIdList')) {
        const datalistHTML = `
            <datalist id="bookingIdList">
                ${allReservations.map(r => 
                    `<option value="${r.booking_id}">${r.guest_name} - ${r.property_name}</option>`
                ).join('')}
            </datalist>
        `;
        tableBody.insertAdjacentHTML('afterend', datalistHTML);
    }
}

/**
 * Auto-fill guest name when booking ID is selected
 */
function autofillGuestName(rowId) {
    const bookingId = document.getElementById(`bookingId_${rowId}`).value;
    const reservation = allReservations.find(r => r.booking_id === bookingId);
    
    if (reservation) {
        document.getElementById(`guestName_${rowId}`).value = reservation.guest_name;
        
        // Auto-fill amount with balance if available
        const balance = getBalance(reservation);

        if (balance > 0 && !document.getElementById(`amount_${rowId}`).value) {
            document.getElementById(`amount_${rowId}`).value = Math.round(balance);
        }
    } else {
        document.getElementById(`guestName_${rowId}`).value = '';
    }
}

/**
 * Handle payment method change to show/hide recipient field
 */
function handleMethodChange(rowId) {
    const method = document.getElementById(`method_${rowId}`).value;
    const recipientSelect = document.getElementById(`recipient_${rowId}`);
    const recipientNA = document.getElementById(`recipient_na_${rowId}`);
    
    if (method === 'cash' || method === 'upi' || method === 'bank_transfer') {
        recipientSelect.style.display = 'block';
        recipientNA.style.display = 'none';
        recipientSelect.required = true;
    } else if (method === '') {
        recipientSelect.style.display = 'none';
        recipientNA.style.display = 'none';
        recipientSelect.required = false;
    } else {
        recipientSelect.style.display = 'none';
        recipientNA.style.display = 'block';
        recipientSelect.required = false;
        recipientSelect.value = '';
    }
}

/**
 * Auto-fill guest name for mobile cards
 */
function autofillGuestNameMobile(rowId) {
    const bookingId = document.getElementById(`bookingId_mobile_${rowId}`).value;
    const reservation = allReservations.find(r => r.booking_id === bookingId);
    
    if (reservation) {
        document.getElementById(`guestName_mobile_${rowId}`).value = reservation.guest_name;
        
        // Auto-fill amount with balance if available
        const balance = getBalance(reservation);

        if (balance > 0 && !document.getElementById(`amount_mobile_${rowId}`).value) {
            document.getElementById(`amount_mobile_${rowId}`).value = Math.round(balance);
        }
        
        // Sync with desktop view
        const desktopBookingId = document.getElementById(`bookingId_${rowId}`);
        const desktopGuestName = document.getElementById(`guestName_${rowId}`);
        const desktopAmount = document.getElementById(`amount_${rowId}`);
        
        if (desktopBookingId) desktopBookingId.value = bookingId;
        if (desktopGuestName) desktopGuestName.value = reservation.guest_name;
        if (desktopAmount && balance > 0 && !desktopAmount.value) {
            desktopAmount.value = Math.round(balance);
        }
    } else {
        document.getElementById(`guestName_mobile_${rowId}`).value = '';
    }
}

/**
 * Handle payment method change for mobile cards
 */
function handleMethodChangeMobile(rowId) {
    const method = document.getElementById(`method_mobile_${rowId}`).value;
    const recipientField = document.getElementById(`recipientField_mobile_${rowId}`);
    const recipientSelect = document.getElementById(`recipient_mobile_${rowId}`);
    
    if (method === 'cash' || method === 'upi' || method === 'bank_transfer') {
        recipientField.style.display = 'block';
        recipientSelect.required = true;
    } else {
        recipientField.style.display = 'none';
        recipientSelect.required = false;
        recipientSelect.value = '';
    }
    
    // Sync with desktop view
    const desktopMethod = document.getElementById(`method_${rowId}`);
    if (desktopMethod) {
        desktopMethod.value = method;
        handleMethodChange(rowId);
    }
}

/**
 * Apply common settings to all rows
 */
function applyCommonSettings() {
    const method = document.getElementById('multiPaymentMethod').value;
    const date = document.getElementById('multiPaymentDate').value;
    
    multiPaymentRows.forEach(row => {
        if (method) {
            document.getElementById(`method_${row.id}`).value = method;
        }
        if (date) {
            document.getElementById(`date_${row.id}`).value = date;
        }
    });
    
    showToast('Common settings applied to all rows', 'success');
}

/**
 * Save multiple payments
 */
async function saveMultiplePayments() {
    try {
        const payments = [];
        
        // Determine if we're on mobile or desktop
        const isMobile = window.innerWidth <= 768;
        const prefix = isMobile ? 'mobile_' : '';
        
        for (const row of multiPaymentRows) {
            const bookingId = document.getElementById(`bookingId_${prefix}${row.id}`).value.trim();
            const amount = parseFloat(document.getElementById(`amount_${prefix}${row.id}`).value);
            const date = document.getElementById(`date_${prefix}${row.id}`).value;
            const method = document.getElementById(`method_${prefix}${row.id}`).value;
            
            // Validate required fields
            if (!bookingId || !amount || !date || !method) {
                showToast('Error', 'Please fill all required fields for all entries', '❌');
                return;
            }
            
            // Get recipient if needed
            let recipient = '';
            const recipientEl = document.getElementById(`recipient_${prefix}${row.id}`);
            if (recipientEl && recipientEl.style.display !== 'none') {
                recipient = recipientEl.value;
                if (!recipient) {
                    showToast('Error', 'Please select payment recipient for all entries', '❌');
                    return;
                }
            }
            
            // Verify booking exists
            const reservation = allReservations.find(r => r.booking_id === bookingId);
            if (!reservation) {
                showToast('Error', `Booking ID "${bookingId}" not found`, '❌');
                return;
            }
            
            payments.push({
                booking_id: bookingId,
                amount: amount,
                payment_date: date,
                payment_method: method,
                payment_recipient: recipient || null,
                notes: `Multi-payment entry`,
                created_at: new Date().toISOString()
            });
        }
        
        if (payments.length === 0) {
            showToast('Error', 'No valid payments to save', '❌');
            return;
        }
        
        // Save all payments
        const { error: paymentError } = await supabase
            .from('payments')
            .insert(payments);
            
        if (paymentError) throw paymentError;
        
        // Update paid amounts for each reservation
        for (const payment of payments) {
            const reservation = allReservations.find(r => r.booking_id === payment.booking_id);
            if (reservation) {
                const newPaidAmount = (parseFloat(reservation.paid_amount) || 0) + payment.amount;
                const total = parseFloat(reservation.total_amount) || 0;
                const tolerance = 1;
                const newStatus = newPaidAmount >= (total - tolerance) ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending');
                
                await supabase
                    .from('reservations')
                    .update({
                        paid_amount: newPaidAmount,
                        payment_status: newStatus
                    })
                    .eq('booking_id', payment.booking_id);
            }
        }
        
        showToast('Success', `✅ ${payments.length} payment(s) saved successfully!`, '✅');
        closeMultiPaymentModal();
        loadPayments();
        
    } catch (error) {
        console.error('Save error:', error);
        showToast('Error', error.message, '❌');
    }
}

/**
 * Open multi-payment modal for a specific reservation
 */
function openMultiPaymentModalForReservation(bookingId) {
    const reservation = allReservations.find(r => r.booking_id === bookingId);
    
    if (!reservation) {
        showToast('Error', 'Reservation not found', '❌');
        return;
    }
    
    const modal = document.getElementById('multiPaymentModal');
    const title = modal.querySelector('.modal-title');
    
    // Update title to show it's for a specific reservation
    title.innerHTML = `<i data-lucide="plus-circle" style="width: 14px; height: 14px; margin-right: 4px;"></i>Add Multiple Payments - ${reservation.guest_name}`;
    
    // Pre-fill booking ID in all rows
    document.getElementById('multiPaymentDate').value = new Date().toISOString().split('T')[0];
    
    // Initialize with 2 empty rows
    multiPaymentRows = [];
    addPaymentRow();
    addPaymentRow();
    
    // Pre-fill booking ID and guest name in all rows
    setTimeout(() => {
        multiPaymentRows.forEach(row => {
            document.getElementById(`bookingId_${row.id}`).value = bookingId;
            document.getElementById(`guestName_${row.id}`).value = reservation.guest_name;
            
            // Set default date
            document.getElementById(`date_${row.id}`).value = new Date().toISOString().split('T')[0];
        });
    }, 100);
    
    modal.classList.add('active');
}

// Payment History Modal

async function viewPaymentHistory(bookingId) {
    try {
        const modal = document.getElementById('paymentHistoryModal');
        const reservation = allReservations.find(r => r.booking_id === bookingId);
        
        if (!reservation) {
            showToast('Error', 'Reservation not found', '❌');
            return;
        }
        
        const payments = await db.getPayments(bookingId);
        
        const total = parseFloat(reservation.total_amount) || 0;
        const paid = parseFloat(reservation.paid_amount) || 0;
        const balance = getBalance(reservation);

        document.getElementById('historyTotalAmount').textContent = '₹' + Math.round(total).toLocaleString('en-IN');
        document.getElementById('historyPaidAmount').textContent = '₹' + Math.round(paid).toLocaleString('en-IN');
        document.getElementById('historyBalance').textContent = '₹' + Math.round(balance).toLocaleString('en-IN');
        
        const statusEl = document.getElementById('historyStatus');
        const status = reservation.payment_status || 'pending';
        statusEl.textContent = status.toUpperCase();
        statusEl.style.color = status === 'paid' ? 'var(--success)' : 
                              status === 'partial' ? 'var(--warning)' : 'var(--danger)';
        
        const listEl = document.getElementById('paymentHistoryList');
        
        if (payments.length === 0) {
            listEl.innerHTML = '<div class="text-center" style="padding: 24px; color: var(--text-secondary);">No payments recorded yet</div>';
        } else {
            listEl.innerHTML = `
                <table style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Method</th>
                            <th>Recipient</th>
                            <th>Reference</th>
                            <th style="text-align: right;">Amount</th>
                            <th style="text-align: center;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(p => `
                            <tr>
                                <td>
                                    <div style="font-weight: 600;">${formatDate(p.payment_date)}</div>
                                    ${p.notes ? `<div style="font-size: 12px; color: var(--text-secondary);">${p.notes}</div>` : ''}
                                </td>
                                <td>
                                    <div style="text-transform: capitalize;">${p.payment_method.replace('_', ' ')}</div>
                                </td>
                                <td>
                                    ${p.payment_recipient ? 
                                        `<span class="badge badge-${p.payment_recipient === 'hostizzy' ? 'confirmed' : 'pending'}" style="text-transform: capitalize;">
                                            ${p.payment_recipient === 'hostizzy' ? '🏢 Hostizzy' : '🏠 Owner'}
                                        </span>` 
                                        : '<span style="color: var(--text-secondary);">-</span>'}
                                </td>
                                <td>
                                    <div style="font-size: 12px; font-family: monospace;">${p.reference_number || '-'}</div>
                                </td>
                                <td style="text-align: right;">
                                    <div style="font-size: 16px; font-weight: 700; color: var(--success);">
                                        ₹${Math.round(p.amount).toLocaleString('en-IN')}
                                    </div>
                                </td>
                                <td style="text-align: center;">
                                    <div style="display: flex; gap: 4px; justify-content: center;">
                                        <button onclick="editPayment(${p.id})" class="btn btn-secondary btn-sm" title="Edit">✏️</button>
                                        <button onclick="deletePayment(${p.id}, '${bookingId}')" class="btn btn-danger btn-sm" title="Delete">🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
        
        modal.classList.add('active');
    } catch (error) {
        console.error('Payment history error:', error);
        showToast('Error', 'Failed to load payment history', '❌');
    }
}

function closePaymentHistoryModal() {
    document.getElementById('paymentHistoryModal').classList.remove('active');
}

async function deletePayment(paymentId, bookingId) {
    if (!confirm('Delete this payment?')) return;
    
    try {
        await db.deletePayment(paymentId);
        await recalculatePaymentStatus(bookingId);
        await viewPaymentHistory(bookingId);
        await loadPayments();
        await loadReservations();
        await loadDashboard();
        showToast('Deleted', 'Payment deleted successfully', '✅');
    } catch (error) {
        console.error('Delete payment error:', error);
        showToast('Error', 'Failed to delete payment', '❌');
    }
}

/**
 * Edit existing payment
 */
async function editPayment(paymentId) {
    try {
        // Fetch payment details
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();
        
        if (error) throw error;
        
        if (!payment) {
            showToast('Payment not found', 'error');
            return;
        }
        
        // Open payment modal with existing data
        await openPaymentModal(payment.booking_id);
        
        // Populate fields with existing payment data
        document.getElementById('editPaymentId').value = paymentId;
        document.getElementById('paymentAmount').value = payment.amount;
        document.getElementById('paymentDate').value = payment.payment_date;
        document.getElementById('paymentMethod').value = payment.payment_method;
        document.getElementById('paymentRecipient').value = payment.payment_recipient || '';
        document.getElementById('paymentReference').value = payment.reference_number || '';
        document.getElementById('paymentNotes').value = payment.notes || '';
        
        // Show recipient field if needed
        toggleRecipientField();
        
        // Change button text
        const saveButton = document.querySelector('#paymentModal .btn-primary');
        saveButton.textContent = '💾 Update Payment';
        
        // Close payment history modal
        document.getElementById('paymentHistoryModal').classList.remove('active');
        
    } catch (error) {
        console.error('Error loading payment for edit:', error);
        showToast('Failed to load payment details', 'error');
    }
}
// Properties
