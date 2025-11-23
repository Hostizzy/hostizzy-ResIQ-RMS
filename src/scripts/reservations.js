/**
 * Reservations Module
 * Handles reservation CRUD operations, modal management, filtering, and status updates
 */

import { supabase } from './config.js'
import { db } from './database.js'
import { setAllReservations, clearSelectedReservations, addSelectedReservation, removeSelectedReservation } from './state.js'
import { showToast, showLoading, hideLoading } from './ui.js'
import { formatDate, formatCurrency, saveFilterState, loadFilterState, clearFilterState } from './utils.js'

// Access global state via window for legacy compatibility
function getAllReservations() {
    return window.allReservations || []
}

function getSelectedReservations() {
    return window.selectedReservations || new Set()
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getBookingSourceBadge(source) {
    if (!source) return '<span style="color: var(--text-secondary); font-size: 12px;">N/A</span>'

    const badges = {
        'DIRECT': { emoji: '🟢', color: '#10b981', label: 'Direct' },
        'AIRBNB': { emoji: '🔵', color: '#2563eb', label: 'Airbnb' },
        'AGODA/BOOKING.COM': { emoji: '🟡', color: '#f59e0b', label: 'Agoda/Booking' },
        'MMT/GOIBIBO': { emoji: '🟠', color: '#f97316', label: 'MMT/Goibibo' },
        'OTHER': { emoji: '⚪', color: '#64748b', label: 'Other' }
    }

    const badge = badges[source] || badges['OTHER']

    return `
        <span style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: ${badge.color}15;
            color: ${badge.color};
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
        ">
            ${badge.emoji} ${badge.label}
        </span>
    `
}

// ============================================
// NAVIGATION
// ============================================

export function navigateToReservation(booking_id) {
    // Switch to reservations view
    if (typeof window.showView === 'function') {
        window.showView('reservations')
    }

    // Wait for view to load, then search for the booking
    setTimeout(() => {
        const searchInput = document.getElementById('searchReservations')
        if (searchInput) {
            searchInput.value = booking_id
            filterReservations()
            showToast('Navigation', `Showing reservation: ${booking_id}`, '🔍')
        }
    }, 300)
}

// ============================================
// SELECTION MANAGEMENT
// ============================================

export function toggleRowSelection(checkbox, bookingId) {
    if (checkbox.checked) {
        addSelectedReservation(bookingId)
    } else {
        removeSelectedReservation(bookingId)
    }
    updateBulkActionsBar()
}

export function toggleAllRows(checkbox) {
    const checkboxes = document.querySelectorAll('.row-select-checkbox')
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked
        const bookingId = cb.getAttribute('data-booking-id')
        if (checkbox.checked) {
            addSelectedReservation(bookingId)
        } else {
            removeSelectedReservation(bookingId)
        }
    })
    updateBulkActionsBar()
}

export function updateBulkActionsBar() {
    const selected = getSelectedReservations()
    const count = selected.size
    const bar = document.getElementById('bulkActionsBar')
    const countEl = document.getElementById('bulkSelectedCount')

    if (countEl) {
        countEl.textContent = count
    }

    if (bar) {
        if (count > 0) {
            bar.classList.add('show')
        } else {
            bar.classList.remove('show')
        }
    }
}

// ============================================
// AUTO STATUS UPDATES
// ============================================

export async function autoUpdateReservationStatuses() {
    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayTime = today.getTime()

        let updatedCount = 0
        const reservationsToUpdate = []

        // Get all reservations
        const allReservations = window.state?.reservations || []

        for (const reservation of allReservations) {
            // Skip cancelled reservations
            if (reservation.status === 'cancelled') continue

            const checkIn = new Date(reservation.check_in)
            checkIn.setHours(0, 0, 0, 0)
            const checkInTime = checkIn.getTime()

            const checkOut = new Date(reservation.check_out)
            checkOut.setHours(0, 0, 0, 0)
            const checkOutTime = checkOut.getTime()

            let newStatus = null

            // Logic for status updates
            if (reservation.status === 'confirmed' && todayTime >= checkInTime && todayTime < checkOutTime) {
                // Check-in date has arrived
                newStatus = 'checked-in'
            } else if ((reservation.status === 'confirmed' || reservation.status === 'checked-in') && todayTime >= checkOutTime) {
                // Check-out date has passed
                newStatus = 'checked-out'
            }

            // Update if status changed
            if (newStatus && newStatus !== reservation.status) {
                reservationsToUpdate.push({
                    bookingId: reservation.booking_id,
                    oldStatus: reservation.status,
                    newStatus: newStatus,
                    propertyName: reservation.property_name,
                    guestName: reservation.guest_name
                })

                // Update in database
                const { error } = await supabase
                    .from('reservations')
                    .update({ status: newStatus })
                    .eq('booking_id', reservation.booking_id)

                if (!error) {
                    // Update in local state
                    reservation.status = newStatus
                    updatedCount++
                }
            }
        }

        // Silent update - only log to console
        if (updatedCount > 0) {
            console.log(`✅ Auto-updated ${updatedCount} reservation status(es):`)
            reservationsToUpdate.forEach(r => {
                console.log(`  - ${r.guestName} at ${r.propertyName}: ${r.oldStatus} → ${r.newStatus}`)
            })

            // Refresh current view silently
            const currentView = localStorage.getItem('lastView') || 'home'
            if (currentView === 'dashboard' && typeof window.loadDashboard === 'function') {
                await window.loadDashboard()
            } else if (currentView === 'reservations') {
                await loadReservations()
            } else if (currentView === 'home' && typeof window.updateHomeScreenStats === 'function') {
                await window.updateHomeScreenStats()
            }
        }

    } catch (error) {
        console.error('Error auto-updating statuses:', error)
        // Silent fail - don't show error to user
    }
}

export function scheduleAutoStatusUpdates() {
    // Run immediately on load (after 2 seconds to let app initialize)
    setTimeout(() => autoUpdateReservationStatuses(), 2000)

    // Run every hour (3600000 ms = 1 hour)
    setInterval(() => autoUpdateReservationStatuses(), 3600000)

    console.log('✅ Auto status update scheduler initialized')
}

// ============================================
// LOAD RESERVATIONS
// ============================================

export async function loadReservations() {
    try {
        const reservations = await db.getReservations()
        setAllReservations(reservations)

        const properties = await db.getProperties()

        const propertySelect = document.getElementById('propertySelect')
        if (propertySelect) {
            propertySelect.innerHTML = '<option value="">Select Property</option>' +
                properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
        }

        // Populate property filter
        const propertyFilter = document.getElementById('propertyFilter')
        if (propertyFilter) {
            propertyFilter.innerHTML = '<option value="">All Properties</option>' +
                properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
        }

        // Populate month filter with unique months from reservations
        const months = [...new Set(reservations.map(r => r.month).filter(Boolean))].sort().reverse()
        const monthFilter = document.getElementById('monthFilter')
        if (monthFilter) {
            monthFilter.innerHTML = '<option value="">All Months</option>' +
                months.map(m => `<option value="${m}">${m}</option>`).join('')
        }

        displayReservations(reservations)

        // Restore saved filters
        setTimeout(() => {
            const savedFilters = loadFilterState('reservations')
            if (savedFilters) {
                console.log('🔄 Restoring reservation filters:', savedFilters)

                // Restore each filter
                if (savedFilters.search) {
                    const searchInput = document.getElementById('searchReservations')
                    if (searchInput) searchInput.value = savedFilters.search
                }
                if (savedFilters.status) {
                    const statusFilter = document.getElementById('statusFilter')
                    if (statusFilter) statusFilter.value = savedFilters.status
                }
                if (savedFilters.property) {
                    const propertyFilter = document.getElementById('propertyFilter')
                    if (propertyFilter) propertyFilter.value = savedFilters.property
                }
                if (savedFilters.bookingSource) {
                    const sourceFilter = document.getElementById('bookingSourceFilter')
                    if (sourceFilter) sourceFilter.value = savedFilters.bookingSource
                }
                if (savedFilters.month) {
                    const monthFilter = document.getElementById('monthFilter')
                    if (monthFilter) monthFilter.value = savedFilters.month
                }

                // Apply the filters
                setTimeout(() => filterReservations(), 200)
            }
        }, 500)
    } catch (error) {
        console.error('Reservations error:', error)
        showToast('Error', 'Failed to load reservations', '❌')
    }
}

// ============================================
// DISPLAY RESERVATIONS
// ============================================

export function displayReservations(reservations) {
    const tbody = document.getElementById('reservationsTableBody')
    if (!tbody) return

    if (reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No reservations found</td></tr>'
        return
    }

    tbody.innerHTML = reservations.map(r => `
        <tr>
            <td>
                <input type="checkbox" class="row-select-checkbox" data-booking-id="${r.booking_id}"
                       onchange="toggleRowSelection(this, '${r.booking_id}')">
            </td>
            <td><strong>${r.booking_id || 'N/A'}</strong></td>
            <td>${r.property_name}</td>
            <td>
                ${getBookingSourceBadge(r.booking_source)}
            </td>
            <td>${r.guest_name}</td>
            <td>${formatDate(r.check_in)}</td>
            <td>${r.nights}</td>
            <td>
                <div style="font-weight: 700; font-size: 15px;">
                    ${formatCurrency(r.total_amount)}
                </div>
                ${r.ota_service_fee > 0 ? `
                    <div style="font-size: 11px; color: var(--danger); margin-top: 2px;">
                        🏢 Fee: ${formatCurrency(r.ota_service_fee)}
                    </div>
                    <div style="font-size: 11px; color: var(--success); margin-top: 2px; font-weight: 600;">
                        Net: ${formatCurrency(r.total_amount - r.ota_service_fee)}
                    </div>
                ` : ''}
            </td>
            <td><span class="badge badge-${r.status}">${r.status}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openPaymentModal('${r.booking_id}')" title="Add Payments">💰</button>
                <button class="btn btn-success btn-sm" onclick="viewPaymentHistory('${r.booking_id}')" title="View Payments">📜</button>
                <button class="btn btn-success btn-sm" onclick="openWhatsAppMenu('${r.booking_id}')" title="Send WhatsApp">📱</button>
                <button class="btn btn-secondary btn-sm" onclick="editReservation('${r.booking_id}')" title="Edit Reservation">📝</button>
                <button class="btn btn-danger btn-sm" onclick="deleteReservation('${r.booking_id}')">×</button>
            </td>
        </tr>
    `).join('')
}

// Store filtered reservations for CSV export
let filteredReservationsForExport = []

// ============================================
// FILTER RESERVATIONS
// ============================================

export function filterReservations() {
    const searchInput = document.getElementById('searchReservations')
    const statusFilter = document.getElementById('statusFilter')
    const propertyFilter = document.getElementById('propertyFilter')
    const bookingSourceFilter = document.getElementById('bookingSourceFilter')
    const monthFilter = document.getElementById('monthFilter')

    const search = searchInput ? searchInput.value.toLowerCase() : ''
    const status = statusFilter ? statusFilter.value : ''
    const property = propertyFilter ? propertyFilter.value : ''
    const bookingSource = bookingSourceFilter ? bookingSourceFilter.value : ''
    const month = monthFilter ? monthFilter.value : ''

    const allReservations = getAllReservations()

    filteredReservationsForExport = allReservations.filter(r => {
        const matchesSearch = !search ||
            (r.guest_name || '').toLowerCase().includes(search) ||
            (r.booking_id || '').toLowerCase().includes(search) ||
            (r.guest_phone || '').toLowerCase().includes(search) ||
            (r.property_name || '').toLowerCase().includes(search)

        const matchesStatus = !status || r.status === status
        const matchesProperty = !property || r.property_id == property
        const matchesBookingSource = !bookingSource || r.booking_source === bookingSource

        let matchesMonth = true
        if (month) {
            matchesMonth = r.month === month
        }

        return matchesSearch && matchesStatus && matchesProperty && matchesBookingSource && matchesMonth
    })

    displayReservations(filteredReservationsForExport)

    // Save filter state
    saveFilterState('reservations', {
        search: searchInput ? searchInput.value : '',
        status: statusFilter ? statusFilter.value : '',
        property: propertyFilter ? propertyFilter.value : '',
        bookingSource: bookingSourceFilter ? bookingSourceFilter.value : '',
        month: monthFilter ? monthFilter.value : ''
    })
}

export function clearFilters() {
    const searchInput = document.getElementById('searchReservations')
    const statusFilter = document.getElementById('statusFilter')
    const propertyFilter = document.getElementById('propertyFilter')
    const bookingSourceFilter = document.getElementById('bookingSourceFilter')
    const monthFilter = document.getElementById('monthFilter')

    if (searchInput) searchInput.value = ''
    if (statusFilter) statusFilter.value = ''
    if (propertyFilter) propertyFilter.value = ''
    if (bookingSourceFilter) bookingSourceFilter.value = ''
    if (monthFilter) monthFilter.value = ''

    filteredReservationsForExport = []
    displayReservations(getAllReservations())

    // Clear saved filter state
    clearFilterState('reservations')
    showToast('Filters Cleared', 'Showing all reservations', 'ℹ️')
}

// ============================================
// MODAL FIELD TOGGLES
// ============================================

export function toggleReservationCodeField() {
    const bookingSource = document.getElementById('bookingSource')
    const reservationCodeRow = document.getElementById('reservationCodeRow')
    const reservationCodeInput = document.getElementById('reservationCode')

    if (!bookingSource || !reservationCodeRow || !reservationCodeInput) return

    // Show field for OTA bookings
    const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO']

    if (otaSources.includes(bookingSource.value)) {
        reservationCodeRow.style.display = 'flex'
        reservationCodeInput.required = true
    } else {
        reservationCodeRow.style.display = 'none'
        reservationCodeInput.required = false
        reservationCodeInput.value = '' // Clear value when hidden
    }
}

export function toggleOtaServiceFeeField() {
    const bookingSource = document.getElementById('bookingSource')
    const otaServiceFeeGroup = document.getElementById('otaServiceFeeGroup')
    const otaServiceFeeInput = document.getElementById('otaServiceFee')

    if (!bookingSource || !otaServiceFeeGroup || !otaServiceFeeInput) return

    const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO']

    if (otaSources.includes(bookingSource.value)) {
        otaServiceFeeGroup.style.display = 'block'
    } else {
        otaServiceFeeGroup.style.display = 'none'
        otaServiceFeeInput.value = '0'
    }
}

// ============================================
// TAX AND REVENUE CALCULATION
// ============================================

export function calculateTaxes() {
    const gstStatus = document.getElementById('gstStatus')
    const taxesInput = document.getElementById('taxes')

    if (!gstStatus || !taxesInput) return

    // If Non-GST, clear taxes and disable field
    if (gstStatus.value === 'non_gst') {
        taxesInput.value = '0'
        taxesInput.style.background = '#e2e8f0'
        return
    }

    // Re-enable and calculate for GST
    taxesInput.style.background = '#f1f5f9'

    const checkInInput = document.getElementById('checkInDate')
    const checkOutInput = document.getElementById('checkOutDate')

    if (!checkInInput || !checkOutInput) return

    const checkIn = checkInInput.value
    const checkOut = checkOutInput.value

    if (!checkIn || !checkOut) return

    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))
    if (nights <= 0) return

    const stayAmountInput = document.getElementById('stayAmount')
    const extraGuestChargesInput = document.getElementById('extraGuestCharges')

    const stayAmount = parseFloat(stayAmountInput?.value) || 0
    const extraGuestCharges = parseFloat(extraGuestChargesInput?.value) || 0

    const totalAmountPreTax = stayAmount + extraGuestCharges
    const perNightRate = totalAmountPreTax / nights

    // Tax calculation: 5% if ≤7500/night, 18% if >7500/night
    let taxRate = 0
    if (perNightRate <= 7500) {
        taxRate = 0.05 // 5%
    } else {
        taxRate = 0.18 // 18%
    }

    const taxes = totalAmountPreTax * taxRate
    taxesInput.value = taxes.toFixed(2)

    // Auto-calculate Hostizzy Revenue
    calculateHostizzyRevenue(stayAmount, extraGuestCharges)
}

export async function calculateHostizzyRevenue(stayAmount, extraGuestCharges) {
    try {
        const propertySelectEl = document.getElementById('propertySelect')
        const hostizzyRevenueEl = document.getElementById('hostizzyRevenue')

        if (!propertySelectEl || !hostizzyRevenueEl) return

        const propertyId = parseInt(propertySelectEl.value)
        if (!propertyId) {
            hostizzyRevenueEl.value = '0'
            return
        }

        const revenueSharePercent = await db.getRevenueSharePercent(propertyId)
        const applicableAmount = stayAmount + extraGuestCharges
        const hostizzyRevenue = (applicableAmount * revenueSharePercent) / 100

        hostizzyRevenueEl.value = hostizzyRevenue.toFixed(2)
    } catch (error) {
        console.error('Error calculating Hostizzy Revenue:', error)
        const hostizzyRevenueEl = document.getElementById('hostizzyRevenue')
        if (hostizzyRevenueEl) hostizzyRevenueEl.value = '0'
    }
}

// ============================================
// RESERVATION MODAL
// ============================================

export function openReservationModal(booking_id = null) {
    const modal = document.getElementById('reservationModal')
    if (!modal) return

    const allReservations = getAllReservations()

    if (booking_id) {
        const r = allReservations.find(res => res.booking_id === booking_id)
        if (!r) {
            showToast('Error', 'Reservation not found', '❌')
            return
        }

        // Populate edit form
        document.getElementById('reservationModalTitle').textContent = 'Edit Reservation'
        document.getElementById('editReservationId').value = r.id
        document.getElementById('propertySelect').value = r.property_id
        document.getElementById('bookingStatus').value = r.status
        document.getElementById('bookingType').value = r.booking_type || 'STAYCATION'
        document.getElementById('checkInDate').value = r.check_in
        document.getElementById('checkOutDate').value = r.check_out
        document.getElementById('guestName').value = r.guest_name
        document.getElementById('guestPhone').value = r.guest_phone
        document.getElementById('guestEmail').value = r.guest_email || ''
        document.getElementById('guestCity').value = r.guest_city || ''
        document.getElementById('bookingSource').value = r.booking_source || 'DIRECT'
        document.getElementById('numberOfRooms').value = r.number_of_rooms || 1
        document.getElementById('adults').value = r.adults || 2
        document.getElementById('kids').value = r.kids || 0
        document.getElementById('stayAmount').value = r.stay_amount || 0
        document.getElementById('extraGuestCharges').value = r.extra_guest_charges || 0
        document.getElementById('mealsChef').value = r.meals_chef || 0
        document.getElementById('bonfireOther').value = r.bonfire_other || 0
        document.getElementById('taxes').value = r.taxes || 0
        document.getElementById('damages').value = r.damages || 0
        document.getElementById('hostizzyRevenue').value = r.hostizzy_revenue || 0
        document.getElementById('otaServiceFee').value = r.ota_service_fee || 0
        toggleOtaServiceFeeField()

        // Recalculate Hostizzy Revenue for edits
        setTimeout(() => {
            calculateHostizzyRevenue(parseFloat(r.stay_amount) || 0, parseFloat(r.extra_guest_charges) || 0)
        }, 100)
        document.getElementById('gstStatus').value = r.gst_status || 'gst'
    } else {
        // New reservation form
        document.getElementById('reservationModalTitle').textContent = 'New Reservation'
        document.getElementById('editReservationId').value = ''
        document.querySelectorAll('#reservationModal input, #reservationModal select').forEach(el => {
            if (el.type === 'number') el.value = el.id === 'adults' ? 2 : (el.id === 'numberOfRooms' ? 1 : 0)
            else if (el.type !== 'hidden') el.value = ''
        })
        document.getElementById('bookingStatus').value = 'pending'
        document.getElementById('bookingSource').value = 'DIRECT'
        document.getElementById('reservationCode').value = ''
        toggleReservationCodeField() // Reset visibility
        toggleOtaServiceFeeField() // Reset OTA fee visibility
    }
    modal.classList.add('active')
}

export function closeReservationModal() {
    const modal = document.getElementById('reservationModal')
    if (modal) {
        modal.classList.remove('active')
    }
}

// ============================================
// SAVE RESERVATION
// ============================================

export async function saveReservation() {
    const propertySelectEl = document.getElementById('propertySelect')
    const propertyId = parseInt(propertySelectEl?.value)

    if (!propertyId) {
        showToast('Validation Error', 'Please select a property', '❌')
        return
    }

    // Check online status
    if (!navigator.onLine) {
        if (!confirm('You are offline. This reservation will be saved locally and synced when you are back online. Continue?')) {
            return
        }
    }

    try {
        const properties = await db.getProperties()
        const property = properties.find(p => p.id === propertyId)

        if (!property) {
            showToast('Error', 'Property not found', '❌')
            return
        }

        const checkIn = document.getElementById('checkInDate').value
        const checkOut = document.getElementById('checkOutDate').value

        if (!checkIn || !checkOut) {
            showToast('Validation Error', 'Please enter check-in and check-out dates', '❌')
            return
        }

        // Validate reservation code for OTA bookings
        const bookingSource = document.getElementById('bookingSource').value
        const reservationCode = document.getElementById('reservationCode').value.trim()
        const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO']

        if (otaSources.includes(bookingSource) && !reservationCode) {
            showToast('Validation Error', 'Please enter the OTA reservation code', '❌')
            return
        }

        // Calculate number of nights
        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))

        if (nights <= 0) {
            showToast('Validation Error', 'Check-out date must be after check-in date', '❌')
            return
        }

        const adults = parseInt(document.getElementById('adults').value) || 0
        const kids = parseInt(document.getElementById('kids').value) || 0
        const numberOfGuests = adults + kids

        const stayAmount = parseFloat(document.getElementById('stayAmount').value) || 0
        const extraGuestCharges = parseFloat(document.getElementById('extraGuestCharges').value) || 0
        const mealsChef = parseFloat(document.getElementById('mealsChef').value) || 0
        const bonfireOther = parseFloat(document.getElementById('bonfireOther').value) || 0
        const taxes = parseFloat(document.getElementById('taxes').value) || 0
        const damages = parseFloat(document.getElementById('damages').value) || 0

        // Meals Revenue includes both meals_chef and bonfire_other (calculated, not stored)
        const mealsRevenue = mealsChef + bonfireOther
        const totalAmountPreTax = stayAmount + extraGuestCharges + mealsRevenue
        const totalAmountIncTax = totalAmountPreTax + taxes
        const totalAmount = totalAmountIncTax + damages

        const avgRoomRate = nights > 0 ? stayAmount / nights : 0
        const avgNightlyRate = nights > 0 ? totalAmount / nights : 0

        const monthDate = new Date(checkIn)
        const month = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })

        const editId = document.getElementById('editReservationId').value

        const reservation = {
            property_id: propertyId,
            property_name: property.name,
            booking_type: document.getElementById('bookingType').value,
            booking_date: new Date().toISOString().split('T')[0],
            check_in: checkIn,
            check_out: checkOut,
            month: month,
            nights: nights,
            gst_status: document.getElementById('gstStatus').value,
            taxes: document.getElementById('gstStatus').value === 'non_gst' ? 0 :
                   parseFloat(document.getElementById('taxes').value) || 0,
            guest_name: document.getElementById('guestName').value,
            guest_phone: document.getElementById('guestPhone').value,
            guest_email: document.getElementById('guestEmail').value || null,
            guest_city: document.getElementById('guestCity').value || null,
            status: document.getElementById('bookingStatus').value,
            booking_source: bookingSource,
            number_of_rooms: parseInt(document.getElementById('numberOfRooms').value) || 1,
            adults: adults,
            kids: kids,
            number_of_guests: numberOfGuests,
            stay_amount: stayAmount,
            extra_guest_charges: extraGuestCharges,
            meals_chef: mealsChef,
            bonfire_other: bonfireOther,
            ota_service_fee: parseFloat(document.getElementById('otaServiceFee').value) || 0,
            taxes: taxes,
            total_amount_pre_tax: totalAmountPreTax,
            total_amount_inc_tax: totalAmountIncTax,
            total_amount: totalAmount,
            damages: damages,
            hostizzy_revenue: parseFloat(document.getElementById('hostizzyRevenue').value) || 0,
            avg_room_rate: avgRoomRate,
            avg_nightly_rate: avgNightlyRate,
            paid_amount: 0,
            payment_status: 'pending'
        }

        // Handle booking_id for both new and edited reservations
        if (!editId) {
            // NEW RESERVATION: Generate booking_id
            if (otaSources.includes(bookingSource) && reservationCode) {
                // Use OTA reservation code as booking ID
                reservation.booking_id = reservationCode
            } else {
                // Generate system booking ID for direct bookings
                const year = new Date().getFullYear().toString().slice(-2)
                const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
                const bytes = crypto.getRandomValues(new Uint8Array(6))
                let rand = ""
                for (const b of bytes) {
                    rand += alphabet[b % alphabet.length]
                }
                reservation.booking_id = `HST${year}${rand}`
            }
        } else {
            // EDITING EXISTING RESERVATION: Update booking_id if source changed to OTA
            if (otaSources.includes(bookingSource) && reservationCode) {
                // If changed to OTA and has OTA code, update booking_id
                reservation.booking_id = reservationCode
            }
            // Note: If source is not OTA, booking_id remains unchanged (keeps existing ID)
        }

        if (navigator.onLine) {
            if (editId) {
                reservation.id = parseInt(editId)
            }

            const result = await db.saveReservation(reservation)
            console.log('Saved reservation:', result)

            // Send push notification for new bookings only (not edits)
            if (!editId && typeof window.notifyNewBooking === 'function') {
                window.notifyNewBooking(reservation)
            }

            closeReservationModal()
            await loadReservations()

            if (typeof window.loadDashboard === 'function') {
                await window.loadDashboard()
            }

            showToast('Success', editId ? 'Reservation updated!' : 'Reservation created successfully!', '✅')
        } else {
            await window.saveToOfflineDB('pendingReservations', reservation)
            closeReservationModal()
            await loadReservations()
            showToast('Saved Offline', 'Will sync when online', '💾')
        }
    } catch (error) {
        console.error('Error saving reservation:', error)
        showToast('Error', 'Failed to save reservation: ' + error.message, '❌')
    }
}

// ============================================
// EDIT & DELETE
// ============================================

export async function editReservation(booking_id) {
    openReservationModal(booking_id)
}

export async function deleteReservation(booking_id) {
    if (!confirm('Delete this reservation?')) return

    try {
        await db.deleteReservation(booking_id)
        await loadReservations()

        if (typeof window.loadDashboard === 'function') {
            await window.loadDashboard()
        }

        showToast('Deleted', 'Reservation deleted successfully', '✅')
    } catch (error) {
        console.error('Delete error:', error)
        showToast('Error', 'Failed to delete reservation', '❌')
    }
}

// ============================================
// VIEW SWITCHING (Calendar vs List)
// ============================================

/**
 * Switch between kanban, calendar and list view for reservations
 */
export function switchReservationView(view) {
    const kanbanContainer = document.getElementById('reservationKanbanContainer')
    const calendarContainer = document.getElementById('reservationCalendarContainer')
    const listContainer = document.getElementById('reservationListContainer')
    const kanbanBtn = document.getElementById('kanbanViewBtn')
    const calendarBtn = document.getElementById('calendarViewBtn')
    const listBtn = document.getElementById('listViewBtn')

    if (!kanbanContainer || !calendarContainer || !listContainer || !kanbanBtn || !calendarBtn || !listBtn) {
        console.warn('View switching elements not found')
        return
    }

    // Reset all buttons to outline style
    kanbanBtn.classList.remove('btn-premium-primary')
    kanbanBtn.classList.add('btn-premium-outline')
    calendarBtn.classList.remove('btn-premium-primary')
    calendarBtn.classList.add('btn-premium-outline')
    listBtn.classList.remove('btn-premium-primary')
    listBtn.classList.add('btn-premium-outline')

    // Hide all containers
    kanbanContainer.style.display = 'none'
    calendarContainer.style.display = 'none'
    listContainer.style.display = 'none'

    if (view === 'kanban') {
        // Show kanban board
        kanbanContainer.style.display = 'block'
        kanbanBtn.classList.remove('btn-premium-outline')
        kanbanBtn.classList.add('btn-premium-primary')

        // Render kanban board
        if (typeof window.renderKanbanBoard === 'function') {
            window.renderKanbanBoard()
        }
    } else if (view === 'calendar') {
        // Show calendar
        calendarContainer.style.display = 'block'
        calendarBtn.classList.remove('btn-premium-outline')
        calendarBtn.classList.add('btn-premium-primary')

        // Render calendar for current month
        if (typeof window.renderCalendar === 'function') {
            const now = new Date()
            window.renderCalendar(now.getFullYear(), now.getMonth())
        }
    } else {
        // Show list (default)
        listContainer.style.display = 'block'
        listBtn.classList.remove('btn-premium-outline')
        listBtn.classList.add('btn-premium-primary')
    }
}

// ============================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ============================================

if (typeof window !== 'undefined') {
    window.getBookingSourceBadge = getBookingSourceBadge
    window.saveFilterState = saveFilterState
    window.loadFilterState = loadFilterState
    window.clearFilterState = clearFilterState
    window.navigateToReservation = navigateToReservation
    window.toggleRowSelection = toggleRowSelection
    window.toggleAllRows = toggleAllRows
    window.updateBulkActionsBar = updateBulkActionsBar
    window.autoUpdateReservationStatuses = autoUpdateReservationStatuses
    window.scheduleAutoStatusUpdates = scheduleAutoStatusUpdates
    window.loadReservations = loadReservations
    window.displayReservations = displayReservations
    window.filterReservations = filterReservations
    window.clearFilters = clearFilters
    window.toggleReservationCodeField = toggleReservationCodeField
    window.toggleOtaServiceFeeField = toggleOtaServiceFeeField
    window.calculateTaxes = calculateTaxes
    window.calculateHostizzyRevenue = calculateHostizzyRevenue
    window.openReservationModal = openReservationModal
    window.closeReservationModal = closeReservationModal
    window.saveReservation = saveReservation
    window.editReservation = editReservation
    window.deleteReservation = deleteReservation
    window.switchReservationView = switchReservationView
}

console.log('✅ Reservations CRUD and filtering module loaded')
