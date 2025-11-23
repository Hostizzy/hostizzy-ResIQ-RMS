/**
 * Payments Module
 * Handles payment CRUD, multi-payment entry, history, reminders, and analytics
 */

import { supabase } from './config.js'
import { db } from './database.js'
import { setAllReservations } from './state.js'
import { showToast } from './ui.js'
import { formatDate, formatCurrency } from './utils.js'
import { navigateToReservation } from './reservations.js'

// Access global state via window for legacy compatibility
function getAllReservations() {
    return window.allReservations || []
}

function getCurrentUser() {
    return window.currentUser
}

// Multi-payment tracking
let multiPaymentRows = []
let filteredPayments = []

// ============================================
// LOAD PAYMENTS VIEW
// ============================================

export async function loadPayments() {
    try {
        const reservations = await db.getReservations()
        setAllReservations(reservations)

        // Populate property filter dropdown
        const propertyFilter = document.getElementById('paymentPropertyFilter')
        if (propertyFilter) {
            const uniqueProperties = [...new Set(reservations.map(r => r.property_name))].sort()
            propertyFilter.innerHTML = '<option value="">All Properties</option>' +
                uniqueProperties.map(p => `<option value="${p}">${p}</option>`).join('')
        }

        // Filter confirmed reservations
        const confirmedReservations = reservations.filter(r => r.status !== 'cancelled')

        // Calculate metrics
        const totalRevenue = confirmedReservations
            .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)

        const totalOtaFees = confirmedReservations
            .reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0)

        const netRevenue = totalRevenue - totalOtaFees

        const totalPaid = confirmedReservations
            .reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0)

        const totalPending = confirmedReservations
            .reduce((sum, r) => sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)), 0)

        // Render payment stats cards
        let statsHTML = `
            <div class="stat-card" style="border-left-color: #8b5cf6;">
                <div class="stat-label">Total Revenue</div>
                <div class="stat-value">${formatCurrency(totalRevenue)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Gross booking amount
                </div>
            </div>
        `

        // Conditionally add OTA fees card
        if (totalOtaFees > 0) {
            statsHTML += `
            <div class="stat-card" style="border-left-color: #ef4444;">
                <div class="stat-label">🏢 OTA Fees</div>
                <div class="stat-value">${formatCurrency(totalOtaFees)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Commission deductions
                </div>
            </div>
            <div class="stat-card" style="border-left-color: #10b981;">
                <div class="stat-label">💰 Net Revenue</div>
                <div class="stat-value">${formatCurrency(netRevenue)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    After OTA fees
                </div>
            </div>
            `
        }

        statsHTML += `
            <div class="stat-card" style="border-left-color: #10b981;">
                <div class="stat-label">Total Collected</div>
                <div class="stat-value">${formatCurrency(totalPaid)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Received payments
                </div>
            </div>
            <div class="stat-card" style="border-left-color: #ef4444;">
                <div class="stat-label">Total Pending</div>
                <div class="stat-value">${formatCurrency(totalPending)}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    Outstanding balance
                </div>
            </div>
        `

        const statsGrid = document.getElementById('paymentStatsGrid')
        if (statsGrid) {
            statsGrid.innerHTML = statsHTML
        }

        // Render payment reminders
        renderPaymentReminders(confirmedReservations)

        displayPayments(reservations)
    } catch (error) {
        console.error('Payments error:', error)
        showToast('Error', 'Failed to load payments', '❌')
    }
}

// ============================================
// DISPLAY PAYMENTS
// ============================================

export function displayPayments(reservations) {
    const tbody = document.getElementById('paymentsTableBody')
    if (!tbody) return

    if (reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No payment records found</td></tr>'
        return
    }

    tbody.innerHTML = reservations.map(r => {
        const total = parseFloat(r.total_amount) || 0
        const otaFee = parseFloat(r.ota_service_fee) || 0
        const netAmount = total - otaFee
        const paid = parseFloat(r.paid_amount) || 0
        const isOTA = r.booking_source && r.booking_source !== 'DIRECT'
        const balance = isOTA ? (netAmount - paid) : (total - paid)
        const status = r.payment_status || 'pending'

        return `
            <tr>
                <td>
                    <strong style="color: var(--primary); cursor: pointer; text-decoration: underline;"
                            onclick="navigateToReservation('${r.booking_id}')">
                        ${r.booking_id || 'N/A'}
                    </strong>
                </td>
                <td>${r.guest_name}</td>
                <td>${r.property_name}</td>
                <td>${formatDate(r.check_in)}</td>
                <td>
                    <div style="font-weight: 600; font-size: 14px;">
                        ${formatCurrency(total, { compact: false })}
                    </div>
                    ${otaFee > 0 ? `
                        <div style="font-size: 11px; color: var(--danger); margin-top: 2px;">
                            OTA Fee: ${formatCurrency(otaFee, { compact: false })}
                        </div>
                        <div style="font-size: 11px; color: var(--success); margin-top: 2px; font-weight: 600;">
                            Net: ${formatCurrency(netAmount, { compact: false })}
                        </div>
                    ` : ''}
                </td>
                <td style="color: var(--success); font-weight: 600;">${formatCurrency(paid, { compact: false })}</td>
                <td style="color: ${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 600;">
                    ${formatCurrency(balance, { compact: false })}
                </td>
                <td>
                    <span class="payment-status ${status}">${status.toUpperCase()}</span>
                    ${r.booking_source && r.booking_source !== 'DIRECT' ?
                '<div style="font-size: 10px; color: var(--warning); margin-top: 4px;">💳 Guest Prepaid via OTA</div>'
                : ''}
                </td>
                <td>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${balance > 0 ? `<button class="btn btn-primary btn-sm" onclick="openPaymentModal('${r.booking_id}')">💰 Add</button>` : ''}
                        <button class="btn btn-success btn-sm" onclick="viewPaymentHistory('${r.booking_id}')">📜 History</button>
                        ${balance > 0 ? `<button class="btn btn-success btn-sm" onclick="openWhatsAppMenu('${r.booking_id}')" title="Send Payment Reminder">📱 Remind</button>` : ''}
                    </div>
                </td>
            </tr>
        `
    }).join('')
}

// ============================================
// FILTER PAYMENTS
// ============================================

export function filterPayments() {
    const searchInput = document.getElementById('searchPayments')
    const statusFilter = document.getElementById('paymentStatusFilter')
    const propertyFilter = document.getElementById('paymentPropertyFilter')

    const search = searchInput ? searchInput.value.toLowerCase() : ''
    const status = statusFilter ? statusFilter.value : ''
    const property = propertyFilter ? propertyFilter.value : ''

    const allReservations = getAllReservations()

    filteredPayments = allReservations.filter(r => {
        const matchesSearch = !search ||
            (r.guest_name || '').toLowerCase().includes(search) ||
            (r.booking_id || '').toLowerCase().includes(search)
        const matchesStatus = !status || r.payment_status === status
        const matchesProperty = !property || r.property_name === property
        return matchesSearch && matchesStatus && matchesProperty
    })

    displayPayments(filteredPayments)
}

export function clearPaymentFilters() {
    const searchInput = document.getElementById('searchPayments')
    const statusFilter = document.getElementById('paymentStatusFilter')
    const propertyFilter = document.getElementById('paymentPropertyFilter')

    if (searchInput) searchInput.value = ''
    if (statusFilter) statusFilter.value = ''
    if (propertyFilter) propertyFilter.value = ''

    filteredPayments = []
    displayPayments(getAllReservations())
    showToast('Filters Cleared', 'All filters have been reset', 'ℹ️')
}

// ============================================
// PAYMENT REMINDERS
// ============================================

export function renderPaymentReminders(reservations) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all reservations with pending/partial payments
    const pendingPayments = reservations.filter(r => {
        const checkInDate = new Date(r.check_in)
        checkInDate.setHours(0, 0, 0, 0)
        const total = parseFloat(r.total_amount) || 0
        const paid = parseFloat(r.paid_amount) || 0
        const otaFee = parseFloat(r.ota_service_fee) || 0
        const isOTA = r.booking_source && r.booking_source !== 'DIRECT'
        const balance = isOTA ? ((total - otaFee) - paid) : (total - paid)

        return balance > 1 && // More than ₹1 balance
            r.status !== 'cancelled' &&
            checkInDate >= today // Only upcoming or today
    }).sort((a, b) => new Date(a.check_in) - new Date(b.check_in))

    const reminderCard = document.getElementById('paymentRemindersCard')
    const remindersList = document.getElementById('paymentRemindersList')
    const remindersCount = document.getElementById('paymentRemindersCount')

    if (!reminderCard || !remindersList) return

    if (pendingPayments.length === 0) {
        reminderCard.style.display = 'none'
        return
    }

    reminderCard.style.display = 'block'
    remindersList.style.display = 'block'

    const reminderIcon = document.getElementById('paymentRemindersIcon')
    if (reminderIcon) reminderIcon.textContent = '🔽'

    const totalPending = pendingPayments.reduce((sum, r) =>
        sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)), 0
    )

    if (remindersCount) {
        remindersCount.textContent = `${pendingPayments.length} pending • ₹${Math.round(totalPending).toLocaleString('en-IN')} due`
    }

    const html = `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div>
                    <div style="font-size: 18px; font-weight: 700; color: #92400e; margin-bottom: 4px;">
                        ⚠️ ${pendingPayments.length} Pending Payment${pendingPayments.length > 1 ? 's' : ''}
                    </div>
                    <div style="font-size: 14px; color: #78350f;">
                        Total Due: ₹${Math.round(totalPending).toLocaleString('en-IN')}
                    </div>
                </div>
            </div>
        </div>

        <div style="display: grid; gap: 12px; padding: 0 16px 16px 16px;">
            ${pendingPayments.map(r => {
        const checkInDate = new Date(r.check_in)
        const daysUntilCheckIn = Math.ceil((checkInDate - today) / (1000 * 60 * 60 * 24))
        const total = parseFloat(r.total_amount) || 0
        const paid = parseFloat(r.paid_amount) || 0
        const otaFee = parseFloat(r.ota_service_fee) || 0
        const isOTA = r.booking_source && r.booking_source !== 'DIRECT'
        const balance = isOTA ? ((total - otaFee) - paid) : (total - paid)
        const isUrgent = daysUntilCheckIn <= 3

        return `
                    <div style="background: ${isUrgent ? '#fee2e2' : 'white'}; border: 1px solid ${isUrgent ? '#fca5a5' : 'var(--border)'}; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div style="flex: 1; min-width: 200px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                ${isUrgent ? '<span style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">URGENT</span>' : ''}
                                <strong style="font-size: 15px;">${r.booking_id}</strong>
                            </div>
                            <div style="font-size: 14px; color: var(--text); margin-bottom: 4px;">
                                👤 ${r.guest_name}
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                🏠 ${r.property_name} • 📅 ${formatDate(r.check_in)} ${daysUntilCheckIn === 0 ? '(Today)' : `(${daysUntilCheckIn} ${daysUntilCheckIn === 1 ? 'day' : 'days'})`}
                            </div>
                        </div>

                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: var(--danger); margin-bottom: 8px;">
                                ₹${Math.round(balance).toLocaleString('en-IN')}
                            </div>
                            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                <button class="btn btn-success btn-sm" onclick="openPaymentModal('${r.booking_id}')" title="Collect Payment">
                                    💰 Collect
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="sendWhatsAppReminder('${r.booking_id}')" title="Send WhatsApp Reminder">
                                    📱 Remind
                                </button>
                            </div>
                        </div>
                    </div>
                `
    }).join('')}
        </div>
    `

    remindersList.innerHTML = html
}

export function togglePaymentReminders() {
    const content = document.getElementById('paymentRemindersList')
    const icon = document.getElementById('paymentRemindersIcon')
    const card = document.getElementById('paymentRemindersCard')

    if (!content || !icon) return

    if (content.style.display === 'none') {
        content.style.display = 'block'
        icon.textContent = '🔽'
        if (card) card.classList.remove('collapsed')
    } else {
        content.style.display = 'none'
        icon.textContent = '▶️'
        if (card) card.classList.add('collapsed')
    }
}

// ============================================
// PAYMENT MODAL
// ============================================

export async function openPaymentModal(bookingId) {
    const modal = document.getElementById('paymentModal')
    if (!modal) return

    const allReservations = getAllReservations()
    const reservation = allReservations.find(r => r.booking_id === bookingId)

    if (!reservation) {
        showToast('Error', 'Reservation not found', '❌')
        return
    }

    const total = parseFloat(reservation.total_amount) || 0
    const otaFee = parseFloat(reservation.ota_service_fee) || 0
    const netAmount = total - otaFee
    const paid = parseFloat(reservation.paid_amount) || 0
    const isOTA = reservation.booking_source && reservation.booking_source !== 'DIRECT'
    const balance = isOTA ? ((total - otaFee) - paid) : (total - paid)

    let amountDisplay = formatCurrency(total, { compact: false })
    if (otaFee > 0) {
        amountDisplay += `<div style="font-size: 12px; color: var(--danger); margin-top: 4px;">OTA Fee: ${formatCurrency(otaFee, { compact: false })}</div>`
        amountDisplay += `<div style="font-size: 12px; color: var(--success); margin-top: 4px; font-weight: 600;">Net: ${formatCurrency(netAmount, { compact: false })}</div>`
    }

    const totalAmountEl = document.getElementById('paymentTotalAmount')
    const paidAmountEl = document.getElementById('paymentPaidAmount')
    const balanceEl = document.getElementById('paymentBalance')
    const bookingIdEl = document.getElementById('paymentBookingId')
    const editPaymentIdEl = document.getElementById('editPaymentId')
    const amountEl = document.getElementById('paymentAmount')
    const dateEl = document.getElementById('paymentDate')
    const methodEl = document.getElementById('paymentMethod')
    const recipientEl = document.getElementById('paymentRecipient')
    const recipientGroupEl = document.getElementById('paymentRecipientGroup')
    const referenceEl = document.getElementById('paymentReference')
    const notesEl = document.getElementById('paymentNotes')

    if (totalAmountEl) totalAmountEl.innerHTML = amountDisplay
    if (paidAmountEl) paidAmountEl.textContent = formatCurrency(paid, { compact: false })
    if (balanceEl) balanceEl.textContent = formatCurrency(balance, { compact: false })
    if (bookingIdEl) bookingIdEl.value = bookingId
    if (editPaymentIdEl) editPaymentIdEl.value = ''
    if (amountEl) amountEl.value = balance > 0 ? Math.round(balance) : ''
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0]
    if (methodEl) methodEl.value = ''
    if (recipientEl) recipientEl.value = ''
    if (recipientGroupEl) recipientGroupEl.style.display = 'none'
    if (referenceEl) referenceEl.value = ''
    if (notesEl) notesEl.value = ''

    modal.classList.add('active')
}

export function closePaymentModal() {
    const modal = document.getElementById('paymentModal')
    if (modal) {
        modal.classList.remove('active')
    }
}

export function toggleRecipientField() {
    const methodEl = document.getElementById('paymentMethod')
    const recipientGroupEl = document.getElementById('paymentRecipientGroup')
    const recipientSelectEl = document.getElementById('paymentRecipient')

    if (!methodEl || !recipientGroupEl || !recipientSelectEl) return

    const method = methodEl.value

    if (method === 'cash' || method === 'upi' || method === 'bank_transfer') {
        recipientGroupEl.style.display = 'block'
        recipientSelectEl.required = true
    } else {
        recipientGroupEl.style.display = 'none'
        recipientSelectEl.required = false
        recipientSelectEl.value = ''
    }
}

export function switchToMultiPayment() {
    const bookingId = document.getElementById('paymentBookingId')?.value
    const amount = document.getElementById('paymentAmount')?.value
    const method = document.getElementById('paymentMethod')?.value
    const recipient = document.getElementById('paymentRecipient')?.value
    const date = document.getElementById('paymentDate')?.value
    const notes = document.getElementById('paymentNotes')?.value

    closePaymentModal()

    const allReservations = getAllReservations()
    const reservation = allReservations.find(r => r.booking_id === bookingId)

    if (!reservation) {
        showToast('Error', 'Reservation not found', '❌')
        return
    }

    const modal = document.getElementById('multiPaymentModal')
    const title = modal?.querySelector('.modal-title')

    if (title) {
        title.innerHTML = `💰 Add Multiple Payments - ${reservation.guest_name}`
    }

    multiPaymentRows = []
    addPaymentRow()
    addPaymentRow()

    if (modal) modal.classList.add('active')

    setTimeout(() => {
        if (multiPaymentRows.length > 0) {
            const firstRow = multiPaymentRows[0]
            const bookingIdEl = document.getElementById(`bookingId_${firstRow.id}`)
            const guestNameEl = document.getElementById(`guestName_${firstRow.id}`)
            const dateEl = document.getElementById(`date_${firstRow.id}`)
            const amountEl = document.getElementById(`amount_${firstRow.id}`)
            const methodEl = document.getElementById(`method_${firstRow.id}`)
            const recipientEl = document.getElementById(`recipient_${firstRow.id}`)

            if (bookingIdEl) bookingIdEl.value = bookingId
            if (guestNameEl) guestNameEl.value = reservation.guest_name
            if (dateEl) dateEl.value = date || new Date().toISOString().split('T')[0]
            if (amount && amountEl) amountEl.value = amount
            if (method && methodEl) {
                methodEl.value = method
                handleMethodChange(firstRow.id)
                if (recipient && recipientEl) recipientEl.value = recipient
            }
        }

        multiPaymentRows.slice(1).forEach(row => {
            const bookingIdEl = document.getElementById(`bookingId_${row.id}`)
            const guestNameEl = document.getElementById(`guestName_${row.id}`)
            const dateEl = document.getElementById(`date_${row.id}`)

            if (bookingIdEl) bookingIdEl.value = bookingId
            if (guestNameEl) guestNameEl.value = reservation.guest_name
            if (dateEl) dateEl.value = date || new Date().toISOString().split('T')[0]
        })

        showToast('Switched to Multi-Payment', 'You can now add multiple payment entries', '✅')
    }, 100)
}

// ============================================
// SAVE PAYMENT
// ============================================

export async function savePayment() {
    try {
        const bookingId = document.getElementById('paymentBookingId')?.value
        const amount = parseFloat(document.getElementById('paymentAmount')?.value)
        const method = document.getElementById('paymentMethod')?.value
        const editPaymentId = document.getElementById('editPaymentId')?.value

        if (!amount || amount <= 0) {
            showToast('Validation Error', 'Please enter a valid amount', '❌')
            return
        }

        if (!method) {
            showToast('Validation Error', 'Please select payment method', '❌')
            return
        }

        const recipientGroupEl = document.getElementById('paymentRecipientGroup')
        if (recipientGroupEl && recipientGroupEl.style.display !== 'none') {
            const recipient = document.getElementById('paymentRecipient')?.value
            if (!recipient) {
                showToast('Validation Error', 'Please select payment recipient', '❌')
                return
            }
        }

        const currentUser = getCurrentUser()
        const paymentData = {
            booking_id: bookingId,
            payment_date: document.getElementById('paymentDate')?.value,
            amount: amount,
            payment_method: method,
            payment_recipient: document.getElementById('paymentRecipient')?.value || null,
            reference_number: document.getElementById('paymentReference')?.value || null,
            notes: document.getElementById('paymentNotes')?.value || null,
            created_by: currentUser?.id || null
        }

        if (navigator.onLine) {
            if (editPaymentId) {
                // Update existing payment
                const { error } = await supabase
                    .from('payments')
                    .update(paymentData)
                    .eq('id', editPaymentId)

                if (error) throw error
                showToast('Success', 'Payment updated successfully!', '✅')
            } else {
                // Create new payment
                await db.savePayment(paymentData)
                showToast('Success', 'Payment saved successfully!', '✅')

                // Send push notification
                const reservation = await db.getReservation(bookingId)
                if (reservation && typeof window.notifyPaymentReceived === 'function') {
                    window.notifyPaymentReceived(bookingId, amount, reservation.guest_name)
                }
            }

            await recalculatePaymentStatus(bookingId)
            closePaymentModal()
            await loadPayments()

            if (typeof window.loadReservations === 'function') {
                await window.loadReservations()
            }
            if (typeof window.loadDashboard === 'function') {
                await window.loadDashboard()
            }
        } else {
            if (!confirm('You are offline. This payment will be saved locally and synced when you are back online. Continue?')) {
                return
            }
            await window.saveToOfflineDB('pendingPayments', paymentData)
            closePaymentModal()
            showToast('Saved Offline', 'Payment will sync when online', '💾')
        }
    } catch (error) {
        console.error('Payment error:', error)
        showToast('Error', 'Failed to save payment: ' + error.message, '❌')
    }
}

export async function recalculatePaymentStatus(bookingId) {
    const payments = await db.getPayments(bookingId)
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

    const reservation = await db.getReservation(bookingId)
    const totalAmount = parseFloat(reservation.total_amount) || 0

    const paidRounded = Math.round(totalPaid)
    const totalRounded = Math.round(totalAmount)

    let paymentStatus = 'pending'
    if (paidRounded >= totalRounded) {
        paymentStatus = 'paid'
    } else if (paidRounded > 0) {
        paymentStatus = 'partial'
    }

    await supabase
        .from('reservations')
        .update({
            paid_amount: totalPaid,
            payment_status: paymentStatus
        })
        .eq('booking_id', bookingId)
}

// ============================================
// MULTI-PAYMENT ENTRY
// ============================================

export function openMultiPaymentModal() {
    const modal = document.getElementById('multiPaymentModal')
    const title = modal?.querySelector('.modal-title')

    if (title) {
        title.innerHTML = '💰 Add Multiple Payments'
    }

    if (modal) modal.classList.add('active')

    const dateEl = document.getElementById('multiPaymentDate')
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0]

    multiPaymentRows = []
    addPaymentRow()
    addPaymentRow()
    addPaymentRow()
}

export function closeMultiPaymentModal() {
    const modal = document.getElementById('multiPaymentModal')
    if (modal) {
        modal.classList.remove('active')
    }
    multiPaymentRows = []
}

export function addPaymentRow() {
    const rowId = Date.now() + Math.random()
    multiPaymentRows.push({ id: rowId })
    renderPaymentRows()
}

export function removePaymentRow(rowId) {
    multiPaymentRows = multiPaymentRows.filter(row => row.id !== rowId)
    renderPaymentRows()

    if (multiPaymentRows.length === 0) {
        addPaymentRow()
    }
}

export function renderPaymentRows() {
    const tableBody = document.getElementById('multiPaymentTableBody')
    const cardsContainer = document.getElementById('multiPaymentCardsContainer')
    const countEl = document.getElementById('paymentEntryCount')

    if (countEl) {
        countEl.textContent = `(${multiPaymentRows.length} ${multiPaymentRows.length === 1 ? 'entry' : 'entries'})`
    }

    if (multiPaymentRows.length === 0) {
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 40px; color: var(--text-secondary);">Click "Add Row" to start</td></tr>'
        }
        if (cardsContainer) {
            cardsContainer.innerHTML = '<div class="text-center" style="padding: 40px; color: var(--text-secondary);">Click "Add Payment Entry" to start</div>'
        }
        return
    }

    // Desktop table view
    if (tableBody) {
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
                        <option value="cash">💵 Cash</option>
                        <option value="upi">📱 UPI</option>
                        <option value="gateway">💳 Gateway</option>
                        <option value="bank_transfer">🏦 Bank</option>
                    </select>
                </td>
                <td style="padding: 8px;">
                    <select id="recipient_${row.id}" style="width: 100%; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px; display: none;">
                        <option value="">Select</option>
                        <option value="Hostizzy">🏢 Hostizzy</option>
                        <option value="Property Owner">🏠 Owner</option>
                    </select>
                    <span id="recipient_na_${row.id}" style="color: #94a3b8; font-size: 13px;">N/A</span>
                </td>
                <td style="padding: 8px; text-align: center;">
                    <button class="btn btn-danger btn-sm" onclick="removePaymentRow(${row.id})" style="padding: 4px 8px;">
                        ✕
                    </button>
                </td>
            </tr>
        `).join('')
    }

    // Mobile card view - similar structure
    if (cardsContainer) {
        cardsContainer.innerHTML = multiPaymentRows.map((row, index) => `
            <div class="payment-entry-card">
                <div class="payment-entry-header">
                    <span class="payment-entry-number">Payment #${index + 1}</span>
                    ${multiPaymentRows.length > 1 ? `
                        <button class="payment-entry-remove" onclick="removePaymentRow(${row.id})">✕</button>
                    ` : ''}
                </div>
                <div class="payment-entry-fields">
                    <div class="payment-field payment-field-full">
                        <label>Booking ID *</label>
                        <input type="text" id="bookingId_mobile_${row.id}" list="bookingIdList"
                            placeholder="Enter booking ID" onchange="autofillGuestNameMobile(${row.id})" required>
                    </div>
                    <div class="payment-field payment-field-full">
                        <label>Guest Name</label>
                        <input type="text" id="guestName_mobile_${row.id}" placeholder="Auto-filled" readonly>
                    </div>
                    <div class="payment-field">
                        <label>Amount (₹) *</label>
                        <input type="number" id="amount_mobile_${row.id}" placeholder="0" min="0" step="0.01" required>
                    </div>
                    <div class="payment-field">
                        <label>Date *</label>
                        <input type="date" id="date_mobile_${row.id}" required>
                    </div>
                    <div class="payment-field payment-field-full">
                        <label>Payment Method *</label>
                        <select id="method_mobile_${row.id}" onchange="handleMethodChangeMobile(${row.id})" required>
                            <option value="">Select method</option>
                            <option value="cash">💵 Cash</option>
                            <option value="upi">📱 UPI</option>
                            <option value="gateway">💳 Gateway</option>
                            <option value="bank_transfer">🏦 Bank Transfer</option>
                        </select>
                    </div>
                    <div class="payment-field payment-field-full" id="recipientField_mobile_${row.id}" style="display: none;">
                        <label>Recipient *</label>
                        <select id="recipient_mobile_${row.id}">
                            <option value="">Select recipient</option>
                            <option value="Hostizzy">🏢 Hostizzy</option>
                            <option value="Property Owner">🏠 Property Owner</option>
                        </select>
                    </div>
                </div>
            </div>
        `).join('')
    }
}

export async function saveMultiplePayments() {
    try {
        const payments = []
        const isMobile = window.innerWidth <= 768
        const prefix = isMobile ? 'mobile_' : ''

        for (const row of multiPaymentRows) {
            const bookingId = document.getElementById(`bookingId_${prefix}${row.id}`)?.value.trim()
            const amount = parseFloat(document.getElementById(`amount_${prefix}${row.id}`)?.value)
            const date = document.getElementById(`date_${prefix}${row.id}`)?.value
            const method = document.getElementById(`method_${prefix}${row.id}`)?.value

            if (!bookingId || !amount || !date || !method) {
                showToast('Error', 'Please fill all required fields for all entries', '❌')
                return
            }

            let recipient = ''
            const recipientEl = document.getElementById(`recipient_${prefix}${row.id}`)
            if (recipientEl && recipientEl.style.display !== 'none') {
                recipient = recipientEl.value
                if (!recipient) {
                    showToast('Error', 'Please select payment recipient for all entries', '❌')
                    return
                }
            }

            const allReservations = getAllReservations()
            const reservation = allReservations.find(r => r.booking_id === bookingId)
            if (!reservation) {
                showToast('Error', `Booking ID "${bookingId}" not found`, '❌')
                return
            }

            payments.push({
                booking_id: bookingId,
                amount: amount,
                payment_date: date,
                payment_method: method,
                payment_recipient: recipient || null,
                notes: `Multi-payment entry`,
                created_at: new Date().toISOString()
            })
        }

        if (payments.length === 0) {
            showToast('Error', 'No valid payments to save', '❌')
            return
        }

        const { error: paymentError } = await supabase
            .from('payments')
            .insert(payments)

        if (paymentError) throw paymentError

        // Update paid amounts
        const allReservations = getAllReservations()
        for (const payment of payments) {
            const reservation = allReservations.find(r => r.booking_id === payment.booking_id)
            if (reservation) {
                const newPaidAmount = (parseFloat(reservation.paid_amount) || 0) + payment.amount
                const total = parseFloat(reservation.total_amount) || 0
                const tolerance = 1
                const newStatus = newPaidAmount >= (total - tolerance) ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending')

                await supabase
                    .from('reservations')
                    .update({
                        paid_amount: newPaidAmount,
                        payment_status: newStatus
                    })
                    .eq('booking_id', payment.booking_id)
            }
        }

        showToast('Success', `✅ ${payments.length} payment(s) saved successfully!`, '✅')
        closeMultiPaymentModal()
        loadPayments()

    } catch (error) {
        console.error('Save error:', error)
        showToast('Error', error.message, '❌')
    }
}

export function openMultiPaymentModalForReservation(bookingId) {
    const allReservations = getAllReservations()
    const reservation = allReservations.find(r => r.booking_id === bookingId)

    if (!reservation) {
        showToast('Error', 'Reservation not found', '❌')
        return
    }

    const modal = document.getElementById('multiPaymentModal')
    const title = modal?.querySelector('.modal-title')

    if (title) {
        title.innerHTML = `💰 Add Multiple Payments - ${reservation.guest_name}`
    }

    const dateEl = document.getElementById('multiPaymentDate')
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0]

    multiPaymentRows = []
    addPaymentRow()
    addPaymentRow()

    setTimeout(() => {
        multiPaymentRows.forEach(row => {
            const bookingIdEl = document.getElementById(`bookingId_${row.id}`)
            const guestNameEl = document.getElementById(`guestName_${row.id}`)
            const dateEl = document.getElementById(`date_${row.id}`)

            if (bookingIdEl) bookingIdEl.value = bookingId
            if (guestNameEl) guestNameEl.value = reservation.guest_name
            if (dateEl) dateEl.value = new Date().toISOString().split('T')[0]
        })
    }, 100)

    if (modal) modal.classList.add('active')
}

// ============================================
// AUTOFILL HELPERS
// ============================================

export function autofillGuestName(rowId) {
    const bookingId = document.getElementById(`bookingId_${rowId}`)?.value
    const allReservations = getAllReservations()
    const reservation = allReservations.find(r => r.booking_id === bookingId)

    const guestNameEl = document.getElementById(`guestName_${rowId}`)
    const amountEl = document.getElementById(`amount_${rowId}`)

    if (reservation && guestNameEl) {
        guestNameEl.value = reservation.guest_name

        const total = parseFloat(reservation.total_amount) || 0
        const paid = parseFloat(reservation.paid_amount) || 0
        const otaFee = parseFloat(reservation.ota_service_fee) || 0
        const isOTA = reservation.booking_source && reservation.booking_source !== 'DIRECT'
        const balance = isOTA ? ((total - otaFee) - paid) : (total - paid)

        if (balance > 0 && amountEl && !amountEl.value) {
            amountEl.value = Math.round(balance)
        }
    } else if (guestNameEl) {
        guestNameEl.value = ''
    }
}

export function autofillGuestNameMobile(rowId) {
    const bookingId = document.getElementById(`bookingId_mobile_${rowId}`)?.value
    const allReservations = getAllReservations()
    const reservation = allReservations.find(r => r.booking_id === bookingId)

    const guestNameEl = document.getElementById(`guestName_mobile_${rowId}`)
    const amountEl = document.getElementById(`amount_mobile_${rowId}`)

    if (reservation && guestNameEl) {
        guestNameEl.value = reservation.guest_name

        const total = parseFloat(reservation.total_amount) || 0
        const paid = parseFloat(reservation.paid_amount) || 0
        const balance = total - paid

        if (balance > 0 && amountEl && !amountEl.value) {
            amountEl.value = Math.round(balance)
        }

        // Sync with desktop
        const desktopBookingIdEl = document.getElementById(`bookingId_${rowId}`)
        const desktopGuestNameEl = document.getElementById(`guestName_${rowId}`)
        const desktopAmountEl = document.getElementById(`amount_${rowId}`)

        if (desktopBookingIdEl) desktopBookingIdEl.value = bookingId
        if (desktopGuestNameEl) desktopGuestNameEl.value = reservation.guest_name
        if (desktopAmountEl && balance > 0 && !desktopAmountEl.value) {
            desktopAmountEl.value = Math.round(balance)
        }
    } else if (guestNameEl) {
        guestNameEl.value = ''
    }
}

export function handleMethodChange(rowId) {
    const methodEl = document.getElementById(`method_${rowId}`)
    const recipientSelectEl = document.getElementById(`recipient_${rowId}`)
    const recipientNAEl = document.getElementById(`recipient_na_${rowId}`)

    if (!methodEl || !recipientSelectEl || !recipientNAEl) return

    const method = methodEl.value

    if (method === 'cash' || method === 'upi' || method === 'bank_transfer') {
        recipientSelectEl.style.display = 'block'
        recipientNAEl.style.display = 'none'
        recipientSelectEl.required = true
    } else if (method === '') {
        recipientSelectEl.style.display = 'none'
        recipientNAEl.style.display = 'none'
        recipientSelectEl.required = false
    } else {
        recipientSelectEl.style.display = 'none'
        recipientNAEl.style.display = 'block'
        recipientSelectEl.required = false
        recipientSelectEl.value = ''
    }
}

export function handleMethodChangeMobile(rowId) {
    const methodEl = document.getElementById(`method_mobile_${rowId}`)
    const recipientFieldEl = document.getElementById(`recipientField_mobile_${rowId}`)
    const recipientSelectEl = document.getElementById(`recipient_mobile_${rowId}`)

    if (!methodEl || !recipientFieldEl || !recipientSelectEl) return

    const method = methodEl.value

    if (method === 'cash' || method === 'upi' || method === 'bank_transfer') {
        recipientFieldEl.style.display = 'block'
        recipientSelectEl.required = true
    } else {
        recipientFieldEl.style.display = 'none'
        recipientSelectEl.required = false
        recipientSelectEl.value = ''
    }

    // Sync with desktop
    const desktopMethodEl = document.getElementById(`method_${rowId}`)
    if (desktopMethodEl) {
        desktopMethodEl.value = method
        handleMethodChange(rowId)
    }
}

// ============================================
// PAYMENT HISTORY
// ============================================

export async function viewPaymentHistory(bookingId) {
    try {
        const modal = document.getElementById('paymentHistoryModal')
        const allReservations = getAllReservations()
        const reservation = allReservations.find(r => r.booking_id === bookingId)

        if (!reservation) {
            showToast('Error', 'Reservation not found', '❌')
            return
        }

        const payments = await db.getPayments(bookingId)

        const total = parseFloat(reservation.total_amount) || 0
        const paid = parseFloat(reservation.paid_amount) || 0
        const otaFee = parseFloat(reservation.ota_service_fee) || 0
        const isOTA = reservation.booking_source && reservation.booking_source !== 'DIRECT'
        const balance = isOTA ? ((total - otaFee) - paid) : (total - paid)

        const totalAmountEl = document.getElementById('historyTotalAmount')
        const paidAmountEl = document.getElementById('historyPaidAmount')
        const balanceEl = document.getElementById('historyBalance')
        const statusEl = document.getElementById('historyStatus')

        if (totalAmountEl) totalAmountEl.textContent = '₹' + Math.round(total).toLocaleString('en-IN')
        if (paidAmountEl) paidAmountEl.textContent = '₹' + Math.round(paid).toLocaleString('en-IN')
        if (balanceEl) balanceEl.textContent = '₹' + Math.round(balance).toLocaleString('en-IN')

        const status = reservation.payment_status || 'pending'
        if (statusEl) {
            statusEl.textContent = status.toUpperCase()
            statusEl.style.color = status === 'paid' ? 'var(--success)' :
                status === 'partial' ? 'var(--warning)' : 'var(--danger)'
        }

        const listEl = document.getElementById('paymentHistoryList')

        if (!listEl) return

        if (payments.length === 0) {
            listEl.innerHTML = '<div class="text-center" style="padding: 24px; color: var(--text-secondary);">No payments recorded yet</div>'
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
            `
        }

        if (modal) modal.classList.add('active')
    } catch (error) {
        console.error('Payment history error:', error)
        showToast('Error', 'Failed to load payment history', '❌')
    }
}

export function closePaymentHistoryModal() {
    const modal = document.getElementById('paymentHistoryModal')
    if (modal) {
        modal.classList.remove('active')
    }
}

export async function deletePayment(paymentId, bookingId) {
    if (!confirm('Delete this payment?')) return

    try {
        await db.deletePayment(paymentId)
        await recalculatePaymentStatus(bookingId)
        await viewPaymentHistory(bookingId)
        await loadPayments()

        if (typeof window.loadReservations === 'function') {
            await window.loadReservations()
        }
        if (typeof window.loadDashboard === 'function') {
            await window.loadDashboard()
        }

        showToast('Deleted', 'Payment deleted successfully', '✅')
    } catch (error) {
        console.error('Delete payment error:', error)
        showToast('Error', 'Failed to delete payment', '❌')
    }
}

export async function editPayment(paymentId) {
    try {
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single()

        if (error) throw error

        if (!payment) {
            showToast('Payment not found', 'error')
            return
        }

        await openPaymentModal(payment.booking_id)

        document.getElementById('editPaymentId').value = paymentId
        document.getElementById('paymentAmount').value = payment.amount
        document.getElementById('paymentDate').value = payment.payment_date
        document.getElementById('paymentMethod').value = payment.payment_method
        document.getElementById('paymentRecipient').value = payment.payment_recipient || ''
        document.getElementById('paymentReference').value = payment.reference_number || ''
        document.getElementById('paymentNotes').value = payment.notes || ''

        toggleRecipientField()

        const saveButton = document.querySelector('#paymentModal .btn-primary')
        if (saveButton) saveButton.textContent = '💾 Update Payment'

        document.getElementById('paymentHistoryModal').classList.remove('active')

    } catch (error) {
        console.error('Error loading payment for edit:', error)
        showToast('Failed to load payment details', 'error')
    }
}

// ============================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ============================================

if (typeof window !== 'undefined') {
    window.loadPayments = loadPayments
    window.displayPayments = displayPayments
    window.filterPayments = filterPayments
    window.clearPaymentFilters = clearPaymentFilters
    window.renderPaymentReminders = renderPaymentReminders
    window.togglePaymentReminders = togglePaymentReminders
    window.openPaymentModal = openPaymentModal
    window.closePaymentModal = closePaymentModal
    window.toggleRecipientField = toggleRecipientField
    window.switchToMultiPayment = switchToMultiPayment
    window.savePayment = savePayment
    window.recalculatePaymentStatus = recalculatePaymentStatus
    window.openMultiPaymentModal = openMultiPaymentModal
    window.closeMultiPaymentModal = closeMultiPaymentModal
    window.addPaymentRow = addPaymentRow
    window.removePaymentRow = removePaymentRow
    window.renderPaymentRows = renderPaymentRows
    window.saveMultiplePayments = saveMultiplePayments
    window.openMultiPaymentModalForReservation = openMultiPaymentModalForReservation
    window.autofillGuestName = autofillGuestName
    window.autofillGuestNameMobile = autofillGuestNameMobile
    window.handleMethodChange = handleMethodChange
    window.handleMethodChangeMobile = handleMethodChangeMobile
    window.viewPaymentHistory = viewPaymentHistory
    window.closePaymentHistoryModal = closePaymentHistoryModal
    window.deletePayment = deletePayment
    window.editPayment = editPayment
}
