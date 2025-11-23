/**
 * Availability (Calendar) Module
 * Handles calendar view, blocked dates, reservations visualization, and iCal sync
 */

import { db } from './database.js'
import { showToast } from './ui.js'
import { formatDate } from './utils.js'

// State
let currentMonth = new Date().getMonth()
let currentYear = new Date().getFullYear()
let allReservations = []
let allProperties = []
let selectedProperty = 'all'
let blockedDates = []

// ============================================
// LOAD AVAILABILITY VIEW
// ============================================

export async function loadAvailability() {
    try {
        // Load data
        allReservations = await db.getReservations()
        allProperties = await db.getProperties()

        // Load blocked dates (from localStorage for now, can be DB later)
        const storedBlocked = localStorage.getItem('blockedDates')
        blockedDates = storedBlocked ? JSON.parse(storedBlocked) : []

        // Render property filter
        renderPropertyFilter()

        // Render calendar
        renderCalendar()

        // Render legend
        renderLegend()

    } catch (error) {
        console.error('Load availability error:', error)
        showToast('Load Error', error.message, '❌')
    }
}

// ============================================
// PROPERTY FILTER
// ============================================

function renderPropertyFilter() {
    const filterContainer = document.getElementById('calendarPropertyFilter')
    if (!filterContainer) return

    let html = '<option value="all">All Properties</option>'
    allProperties.forEach(prop => {
        html += `<option value="${prop.id}">${prop.name}</option>`
    })

    filterContainer.innerHTML = html
    filterContainer.value = selectedProperty
}

export function filterCalendarByProperty(propertyId) {
    selectedProperty = propertyId
    renderCalendar()
}

// ============================================
// CALENDAR RENDERING
// ============================================

export function renderCalendar() {
    const calendarContainer = document.getElementById('calendarGrid')
    if (!calendarContainer) return

    // Update month/year header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December']
    const headerEl = document.getElementById('currentMonthYear')
    if (headerEl) {
        headerEl.textContent = `${monthNames[currentMonth]} ${currentYear}`
    }

    // Get first day of month and total days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    // Build calendar HTML
    let html = ''

    // Day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    dayHeaders.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`
    })

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>'
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dateInfo = getDateInfo(dateStr)

        const isToday = new Date().toDateString() === new Date(dateStr).toDateString()
        const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0))

        let statusClass = ''
        let statusLabel = ''
        let statusColor = ''

        if (dateInfo.isBlocked) {
            statusClass = 'blocked'
            statusLabel = 'Blocked'
            statusColor = '#64748b'
        } else if (dateInfo.reservations.length > 0) {
            const reservation = dateInfo.reservations[0]
            if (reservation.status === 'checked-in') {
                statusClass = 'occupied'
                statusLabel = 'Occupied'
                statusColor = '#10b981'
            } else if (reservation.status === 'confirmed') {
                statusClass = 'reserved'
                statusLabel = 'Reserved'
                statusColor = '#3b82f6'
            } else if (reservation.status === 'checked-out') {
                statusClass = 'checkout'
                statusLabel = 'Check-out'
                statusColor = '#f59e0b'
            }
        }

        html += `
            <div class="calendar-day ${statusClass} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}"
                 data-date="${dateStr}"
                 onclick="window.handleDateClick('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${statusLabel ? `
                    <div class="calendar-day-status" style="background: ${statusColor};">
                        ${statusLabel}
                    </div>
                ` : ''}
                ${dateInfo.reservations.length > 1 ? `
                    <div class="calendar-day-multi">+${dateInfo.reservations.length - 1} more</div>
                ` : ''}
            </div>
        `
    }

    calendarContainer.innerHTML = html
}

// ============================================
// DATE INFO
// ============================================

function getDateInfo(dateStr) {
    // Filter reservations for this date
    let dateReservations = allReservations.filter(res => {
        if (res.status === 'cancelled') return false
        if (selectedProperty !== 'all' && res.property_id !== selectedProperty) return false

        const checkIn = new Date(res.checkin_date)
        const checkOut = new Date(res.checkout_date)
        const currentDate = new Date(dateStr)

        return currentDate >= checkIn && currentDate < checkOut
    })

    // Check if date is blocked
    const isBlocked = blockedDates.some(blocked => {
        if (selectedProperty !== 'all' && blocked.propertyId !== selectedProperty) return false
        return blocked.date === dateStr
    })

    return {
        reservations: dateReservations,
        isBlocked: isBlocked
    }
}

// ============================================
// DATE CLICK HANDLER
// ============================================

export function handleDateClick(dateStr) {
    const dateInfo = getDateInfo(dateStr)

    // Show modal with date details
    const modal = document.getElementById('dateDetailsModal')
    if (!modal) return

    const modalDate = document.getElementById('modalDate')
    const modalContent = document.getElementById('modalDateContent')

    if (modalDate) {
        const date = new Date(dateStr)
        modalDate.textContent = date.toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    let html = ''

    // Show blocked status
    if (dateInfo.isBlocked) {
        html += `
            <div class="alert alert-info">
                <strong>🚫 Blocked Date</strong>
                <p>This date is blocked for bookings.</p>
                <button class="btn-modern btn-modern-sm btn-modern-danger"
                        onclick="window.unblockDate('${dateStr}')">
                    Unblock Date
                </button>
            </div>
        `
    } else {
        html += `
            <button class="btn-modern btn-modern-sm btn-modern-secondary"
                    onclick="window.blockDate('${dateStr}')"
                    style="margin-bottom: 16px;">
                🚫 Block This Date
            </button>
        `
    }

    // Show reservations
    if (dateInfo.reservations.length > 0) {
        html += `<h4 style="margin: 16px 0 8px;">Reservations:</h4>`
        dateInfo.reservations.forEach(res => {
            const statusBadge = getStatusBadge(res.status)
            html += `
                <div class="reservation-item" style="
                    padding: 12px;
                    background: var(--surface);
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius-md);
                    margin-bottom: 8px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <div style="font-weight: 600; margin-bottom: 4px;">
                                ${res.booking_id}
                            </div>
                            <div style="font-size: 14px; color: var(--text-secondary);">
                                ${res.guest_name} • ${res.property_name}
                            </div>
                            <div style="font-size: 13px; color: var(--text-tertiary); margin-top: 4px;">
                                ${formatDate(res.checkin_date)} → ${formatDate(res.checkout_date)}
                            </div>
                        </div>
                        <div>${statusBadge}</div>
                    </div>
                </div>
            `
        })
    } else {
        html += `
            <div class="empty-state-modern" style="margin-top: 16px;">
                <div class="empty-state-modern-icon">📅</div>
                <h3>No Reservations</h3>
                <p>This date is available for booking</p>
            </div>
        `
    }

    if (modalContent) {
        modalContent.innerHTML = html
    }

    modal.style.display = 'flex'
}

// ============================================
// BLOCK/UNBLOCK DATES
// ============================================

export function blockDate(dateStr) {
    const propertyId = selectedProperty === 'all' ? null : selectedProperty

    if (!propertyId) {
        showToast('Select Property', 'Please select a specific property to block dates', '⚠️')
        return
    }

    blockedDates.push({
        date: dateStr,
        propertyId: propertyId,
        blockedAt: new Date().toISOString()
    })

    localStorage.setItem('blockedDates', JSON.stringify(blockedDates))

    showToast('Date Blocked', `${dateStr} has been blocked`, '🚫')

    renderCalendar()
    closeModal('dateDetailsModal')
}

export function unblockDate(dateStr) {
    blockedDates = blockedDates.filter(b => b.date !== dateStr)
    localStorage.setItem('blockedDates', JSON.stringify(blockedDates))

    showToast('Date Unblocked', `${dateStr} is now available`, '✅')

    renderCalendar()
    closeModal('dateDetailsModal')
}

// ============================================
// NAVIGATION
// ============================================

export function previousMonth() {
    currentMonth--
    if (currentMonth < 0) {
        currentMonth = 11
        currentYear--
    }
    renderCalendar()
}

export function nextMonth() {
    currentMonth++
    if (currentMonth > 11) {
        currentMonth = 0
        currentYear++
    }
    renderCalendar()
}

export function goToToday() {
    currentMonth = new Date().getMonth()
    currentYear = new Date().getFullYear()
    renderCalendar()
}

// ============================================
// LEGEND
// ============================================

function renderLegend() {
    const legendContainer = document.getElementById('calendarLegend')
    if (!legendContainer) return

    legendContainer.innerHTML = `
        <div class="legend-item">
            <div class="legend-color" style="background: #10b981;"></div>
            <span>Occupied</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #3b82f6;"></div>
            <span>Reserved</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #f59e0b;"></div>
            <span>Check-out</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background: #64748b;"></div>
            <span>Blocked</span>
        </div>
    `
}

// ============================================
// HELPERS
// ============================================

function getStatusBadge(status) {
    const badges = {
        'confirmed': { label: 'Confirmed', color: '#3b82f6' },
        'checked-in': { label: 'Checked In', color: '#10b981' },
        'checked-out': { label: 'Checked Out', color: '#64748b' },
        'cancelled': { label: 'Cancelled', color: '#ef4444' }
    }

    const badge = badges[status] || { label: status, color: '#6b7280' }

    return `
        <span class="badge-modern" style="background: ${badge.color};">
            ${badge.label}
        </span>
    `
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId)
    if (modal) {
        modal.style.display = 'none'
    }
}

// ============================================
// EXPORT TO WINDOW FOR COMPATIBILITY
// ============================================

if (typeof window !== 'undefined') {
    window.loadAvailability = loadAvailability
    window.filterCalendarByProperty = filterCalendarByProperty
    window.renderCalendar = renderCalendar
    window.handleDateClick = handleDateClick
    window.blockDate = blockDate
    window.unblockDate = unblockDate
    window.previousMonth = previousMonth
    window.nextMonth = nextMonth
    window.goToToday = goToToday
}
