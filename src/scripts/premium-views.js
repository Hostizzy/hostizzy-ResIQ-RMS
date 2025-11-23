/**
 * PREMIUM VIEWS
 * App-Store Quality Interactive Features for All Views
 * Kanban Boards, Advanced Filters, Interactive Charts, Modern UI
 */

import { db } from './database.js'
import { formatCurrency, formatDate } from './utils.js'
import { showToast } from './ui.js'

/* ========================================
   KANBAN BOARD FOR RESERVATIONS
   ======================================== */

export function initKanbanBoard() {
    console.log('🎯 Initializing Kanban Board')
    renderKanbanBoard()
}

export function renderKanbanBoard() {
    const container = document.getElementById('kanbanBoardContainer')
    if (!container) return

    const reservations = window.allReservations || []

    // Group reservations by status
    const columns = {
        pending: {
            title: 'Pending',
            icon: '⏳',
            color: '#F59E0B',
            items: reservations.filter(r => r.status === 'pending')
        },
        confirmed: {
            title: 'Confirmed',
            icon: '✅',
            color: '#3B82F6',
            items: reservations.filter(r => r.status === 'confirmed')
        },
        'checked-in': {
            title: 'Checked In',
            icon: '🏠',
            color: '#10B981',
            items: reservations.filter(r => r.status === 'checked-in')
        },
        'checked-out': {
            title: 'Checked Out',
            icon: '🎉',
            color: '#8B5CF6',
            items: reservations.filter(r => r.status === 'checked-out')
        },
        cancelled: {
            title: 'Cancelled',
            icon: '❌',
            color: '#EF4444',
            items: reservations.filter(r => r.status === 'cancelled')
        }
    }

    let html = '<div class="kanban-board animate-fade-in-up">'

    Object.entries(columns).forEach(([status, data]) => {
        html += `
            <div class="kanban-column" data-status="${status}">
                <div class="kanban-column-header">
                    <div class="kanban-column-title">
                        <span style="font-size: 1.2rem;">${data.icon}</span>
                        <span>${data.title}</span>
                        <span class="badge-premium-neutral" style="margin-left: 8px;">${data.items.length}</span>
                    </div>
                </div>
                <div class="kanban-column-body">
                    ${data.items.map(item => renderKanbanCard(item, data.color)).join('')}
                    ${data.items.length === 0 ? `
                        <div class="empty-state-premium" style="padding: 40px 20px;">
                            <div class="empty-state-icon" style="font-size: 2rem;">${data.icon}</div>
                            <div class="empty-state-description" style="font-size: 0.875rem;">No ${data.title.toLowerCase()} bookings</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `
    })

    html += '</div>'
    container.innerHTML = html
}

function renderKanbanCard(reservation, color) {
    const property = window.state?.properties?.find(p => p.id === reservation.property_id)
    const propertyName = property?.name || 'Unknown Property'
    const checkIn = new Date(reservation.check_in)
    const checkOut = new Date(reservation.check_out)
    const today = new Date()

    // Calculate days until check-in
    const daysUntil = Math.ceil((checkIn - today) / (1000 * 60 * 60 * 24))
    const isUrgent = daysUntil > 0 && daysUntil <= 3
    const isPast = daysUntil < 0

    return `
        <div class="kanban-card hover-lift" onclick="editReservation('${reservation.booking_id}')" data-booking-id="${reservation.booking_id}">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--neutral-900); margin-bottom: 4px;">
                        ${reservation.guest_name}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--neutral-500);">
                        ${propertyName}
                    </div>
                </div>
                ${isUrgent ? '<span class="badge-premium-warning badge-premium-dot" style="font-size: 0.7rem;">Soon</span>' : ''}
                ${isPast && reservation.status === 'confirmed' ? '<span class="badge-premium-error badge-premium-dot" style="font-size: 0.7rem;">Overdue</span>' : ''}
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 12px; font-size: 0.75rem; color: var(--neutral-600);">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span>📅</span>
                    <span>${formatDate(reservation.check_in)}</span>
                </div>
                <span>→</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span>${formatDate(reservation.check_out)}</span>
                </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="font-weight: 600; color: ${color}; font-size: 0.95rem;">
                    ${formatCurrency(reservation.total_amount)}
                </div>
                <div style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--neutral-500);">
                    <span>👥</span>
                    <span>${(parseInt(reservation.adults) || 0) + (parseInt(reservation.kids) || 0)}</span>
                </div>
            </div>

            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--neutral-200);">
                <div style="display: flex; gap: 6px; align-items: center; font-size: 0.7rem;">
                    <span class="badge-premium-neutral" style="padding: 2px 6px;">${reservation.nights} nights</span>
                    ${reservation.booking_source ? `
                        <span class="badge-premium-info" style="padding: 2px 6px; font-size: 0.65rem;">${reservation.booking_source}</span>
                    ` : ''}
                </div>
            </div>
        </div>
    `
}

/* ========================================
   SMART SEARCH & FILTERS
   ======================================== */

export function initSmartSearch() {
    const searchInput = document.getElementById('smartSearch')
    if (!searchInput) return

    let debounceTimer
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
            performSmartSearch(e.target.value)
        }, 300)
    })

    console.log('🔍 Smart Search initialized')
}

function performSmartSearch(query) {
    const reservations = window.allReservations || []
    const searchQuery = query.toLowerCase().trim()

    if (!searchQuery) {
        // Show all reservations
        if (typeof window.displayReservations === 'function') {
            window.displayReservations(reservations)
        }
        return
    }

    const filtered = reservations.filter(r => {
        return (
            r.guest_name?.toLowerCase().includes(searchQuery) ||
            r.guest_email?.toLowerCase().includes(searchQuery) ||
            r.guest_mobile?.includes(searchQuery) ||
            r.booking_id?.toLowerCase().includes(searchQuery) ||
            r.reservation_code?.toLowerCase().includes(searchQuery) ||
            r.status?.toLowerCase().includes(searchQuery)
        )
    })

    if (typeof window.displayReservations === 'function') {
        window.displayReservations(filtered)
    }

    // Show search results count
    const resultsCount = document.getElementById('searchResultsCount')
    if (resultsCount) {
        resultsCount.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
        resultsCount.style.display = searchQuery ? 'inline' : 'none'
    }
}

/* ========================================
   ADVANCED FILTER PANEL
   ======================================== */

export function initAdvancedFilters() {
    createFilterPanel()
    console.log('⚙️ Advanced Filters initialized')
}

function createFilterPanel() {
    const existingPanel = document.getElementById('advancedFilterPanel')
    if (existingPanel) return

    const html = `
        <div id="advancedFilterPanel" class="sidebar-panel">
            <div class="sidebar-panel-header">
                <h3 style="font-size: var(--text-xl); font-weight: var(--font-weight-semibold); margin: 0;">
                    Advanced Filters
                </h3>
                <button class="btn-premium-icon btn-premium-ghost" onclick="toggleAdvancedFilters()">
                    ✕
                </button>
            </div>
            <div class="sidebar-panel-body">
                <div style="margin-bottom: 24px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.875rem;">
                        Booking Status
                    </label>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label class="flex items-center gap-2" style="cursor: pointer;">
                            <input type="checkbox" value="pending" onchange="applyAdvancedFilters()">
                            <span>⏳ Pending</span>
                        </label>
                        <label class="flex items-center gap-2" style="cursor: pointer;">
                            <input type="checkbox" value="confirmed" onchange="applyAdvancedFilters()">
                            <span>✅ Confirmed</span>
                        </label>
                        <label class="flex items-center gap-2" style="cursor: pointer;">
                            <input type="checkbox" value="checked-in" onchange="applyAdvancedFilters()">
                            <span>🏠 Checked In</span>
                        </label>
                        <label class="flex items-center gap-2" style="cursor: pointer;">
                            <input type="checkbox" value="checked-out" onchange="applyAdvancedFilters()">
                            <span>🎉 Checked Out</span>
                        </label>
                        <label class="flex items-center gap-2" style="cursor: pointer;">
                            <input type="checkbox" value="cancelled" onchange="applyAdvancedFilters()">
                            <span>❌ Cancelled</span>
                        </label>
                    </div>
                </div>

                <div class="divider-premium"></div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.875rem;">
                        Amount Range
                    </label>
                    <div style="display: flex; gap: 12px;">
                        <input type="number" id="filterMinAmount" placeholder="Min" class="input-premium" style="flex: 1;">
                        <input type="number" id="filterMaxAmount" placeholder="Max" class="input-premium" style="flex: 1;">
                    </div>
                </div>

                <div class="divider-premium"></div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.875rem;">
                        Number of Guests
                    </label>
                    <div style="display: flex; gap: 12px;">
                        <input type="number" id="filterMinGuests" placeholder="Min" class="input-premium" style="flex: 1;">
                        <input type="number" id="filterMaxGuests" placeholder="Max" class="input-premium" style="flex: 1;">
                    </div>
                </div>

                <div class="divider-premium"></div>

                <div>
                    <button class="btn-premium btn-premium-primary" style="width: 100%; margin-bottom: 12px;" onclick="applyAdvancedFilters()">
                        Apply Filters
                    </button>
                    <button class="btn-premium btn-premium-outline" style="width: 100%;" onclick="clearAdvancedFilters()">
                        Clear All
                    </button>
                </div>
            </div>
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', html)
}

export function toggleAdvancedFilters() {
    const panel = document.getElementById('advancedFilterPanel')
    if (panel) {
        panel.classList.toggle('active')
    }
}

export function applyAdvancedFilters() {
    const reservations = window.allReservations || []

    // Get selected statuses
    const statusCheckboxes = document.querySelectorAll('#advancedFilterPanel input[type="checkbox"]:checked')
    const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value)

    // Get amount range
    const minAmount = parseFloat(document.getElementById('filterMinAmount')?.value) || 0
    const maxAmount = parseFloat(document.getElementById('filterMaxAmount')?.value) || Infinity

    // Get guests range
    const minGuests = parseInt(document.getElementById('filterMinGuests')?.value) || 0
    const maxGuests = parseInt(document.getElementById('filterMaxGuests')?.value) || Infinity

    let filtered = reservations

    // Apply status filter
    if (selectedStatuses.length > 0) {
        filtered = filtered.filter(r => selectedStatuses.includes(r.status))
    }

    // Apply amount filter
    filtered = filtered.filter(r => {
        const amount = parseFloat(r.total_amount) || 0
        return amount >= minAmount && amount <= maxAmount
    })

    // Apply guests filter
    filtered = filtered.filter(r => {
        const guests = (parseInt(r.adults) || 0) + (parseInt(r.kids) || 0)
        return guests >= minGuests && guests <= maxGuests
    })

    if (typeof window.displayReservations === 'function') {
        window.displayReservations(filtered)
    }

    showToast('Success', `${filtered.length} reservations match your filters`, '✅')
}

export function clearAdvancedFilters() {
    // Uncheck all checkboxes
    document.querySelectorAll('#advancedFilterPanel input[type="checkbox"]').forEach(cb => {
        cb.checked = false
    })

    // Clear inputs
    const filterMinAmount = document.getElementById('filterMinAmount')
    const filterMaxAmount = document.getElementById('filterMaxAmount')
    const filterMinGuests = document.getElementById('filterMinGuests')
    const filterMaxGuests = document.getElementById('filterMaxGuests')

    if (filterMinAmount) filterMinAmount.value = ''
    if (filterMaxAmount) filterMaxAmount.value = ''
    if (filterMinGuests) filterMinGuests.value = ''
    if (filterMaxGuests) filterMaxGuests.value = ''

    // Show all reservations
    if (typeof window.displayReservations === 'function') {
        window.displayReservations(window.allReservations || [])
    }
}

/* ========================================
   INTERACTIVE STATS WIDGETS
   ======================================== */

export function renderInteractiveStats() {
    const container = document.getElementById('interactiveStatsContainer')
    if (!container) return

    const reservations = window.allReservations || []
    const payments = window.allPayments || []

    const stats = calculateEnhancedStats(reservations, payments)

    const html = `
        <div class="stats-grid animate-fade-in-up">
            ${renderStatCard('💰', 'Total Revenue', formatCurrency(stats.totalRevenue), stats.revenueGrowth, 'success')}
            ${renderStatCard('📊', 'Occupancy Rate', `${stats.occupancyRate}%`, stats.occupancyGrowth, 'primary')}
            ${renderStatCard('🏠', 'Active Bookings', stats.activeBookings, null, 'info')}
            ${renderStatCard('👥', 'Total Guests', stats.totalGuests, stats.guestGrowth, 'purple')}
        </div>
    `

    container.innerHTML = html
}

function renderStatCard(icon, label, value, trend, variant) {
    const gradients = {
        success: 'var(--gradient-success)',
        primary: 'var(--gradient-primary)',
        info: 'var(--gradient-ocean)',
        purple: 'var(--gradient-purple)',
        warning: 'var(--gradient-warning)',
        error: 'var(--gradient-error)'
    }

    return `
        <div class="stat-card-premium hover-lift" style="background: ${gradients[variant]};">
            <div class="stat-card-icon">${icon}</div>
            <div class="stat-card-value">${value}</div>
            <div class="stat-card-label">${label}</div>
            ${trend !== null ? `
                <div class="stat-card-trend">
                    <span>${trend > 0 ? '📈' : trend < 0 ? '📉' : '➖'}</span>
                    <span>${Math.abs(trend)}% ${trend > 0 ? 'increase' : trend < 0 ? 'decrease' : 'no change'}</span>
                </div>
            ` : ''}
        </div>
    `
}

function calculateEnhancedStats(reservations, payments) {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const confirmed = reservations.filter(r => r.status !== 'cancelled')
    const totalRevenue = confirmed.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
    const activeBookings = reservations.filter(r => r.status === 'checked-in').length
    const totalGuests = confirmed.reduce((sum, r) => sum + (parseInt(r.adults) || 0) + (parseInt(r.kids) || 0), 0)

    // Calculate occupancy
    const properties = window.state?.properties || []
    const totalNights = confirmed.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0)
    const targetNights = properties.length * 30 * 0.8 // 80% target
    const occupancyRate = targetNights > 0 ? Math.round((totalNights / targetNights) * 100) : 0

    // Calculate growth (mock - replace with actual last month data)
    const revenueGrowth = Math.round(Math.random() * 20 - 5) // Mock growth
    const occupancyGrowth = Math.round(Math.random() * 15 - 5)
    const guestGrowth = Math.round(Math.random() * 25 - 10)

    return {
        totalRevenue,
        occupancyRate,
        activeBookings,
        totalGuests,
        revenueGrowth,
        occupancyGrowth,
        guestGrowth
    }
}

/* ========================================
   EXPORT TO WINDOW
   ======================================== */

if (typeof window !== 'undefined') {
    window.initKanbanBoard = initKanbanBoard
    window.renderKanbanBoard = renderKanbanBoard
    window.initSmartSearch = initSmartSearch
    window.initAdvancedFilters = initAdvancedFilters
    window.toggleAdvancedFilters = toggleAdvancedFilters
    window.applyAdvancedFilters = applyAdvancedFilters
    window.clearAdvancedFilters = clearAdvancedFilters
    window.renderInteractiveStats = renderInteractiveStats
}

console.log('✨ Premium Views Module Loaded')
