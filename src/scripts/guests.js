/**
 * Guest Management Module
 * Handles guest profiles, KYC documents, and verification workflow
 */

import { supabase } from './config.js'
import { db } from './database.js'
import { setAllReservations } from './state.js'
import { showToast, showLoading, hideLoading } from './ui.js'
import { formatDate, formatCurrency } from './utils.js'
import { loadFilterState, saveFilterState, clearFilterState } from './utils.js'

// ==========================================
// STATE VARIABLES
// ==========================================

let allGuests = []
let filteredGuests = []
let displayedGuests = []
let currentGuestData = null
let currentGuestView = 'table' // 'table' or 'cards'
let currentGuestPage = 1
let guestsPerPage = 50
let currentSortColumn = 'name'
let currentSortDirection = 'asc'

// Guest documents state
let currentGuestDocuments = []
let currentFilterStatus = 'all'
let currentDocumentForReview = null

// Access state via window for reactivity
function getAllReservations() {
    return window.allReservations || []
}

function getCurrentUser() {
    return window.currentUser
}

// ==========================================
// GUEST MANAGEMENT FUNCTIONS
// ==========================================

/**
 * Load and display all guests
 */
export async function loadGuests() {
    try {
        console.log('Loading guests...')

        // Get all reservations
        const reservations = await db.getReservations()
        console.log('Reservations loaded:', reservations.length)

        // Create guest map (group by phone or email)
        const guestMap = new Map()

        reservations.forEach(r => {
            // Use phone as primary identifier, fallback to email
            const guestKey = (r.guest_phone || r.guest_email || r.guest_name || '').toLowerCase().trim()

            if (!guestKey) return

            if (!guestMap.has(guestKey)) {
                guestMap.set(guestKey, {
                    name: r.guest_name,
                    phone: r.guest_phone || '',
                    email: r.guest_email || '',
                    bookings: [],
                    key: guestKey
                })
            }

            guestMap.get(guestKey).bookings.push(r)

            // Update name/phone/email to latest non-empty values
            const guest = guestMap.get(guestKey)
            if (r.guest_name && r.guest_name !== guest.name) guest.name = r.guest_name
            if (r.guest_phone && r.guest_phone !== guest.phone) guest.phone = r.guest_phone
            if (r.guest_email && r.guest_email !== guest.email) guest.email = r.guest_email
        })

        // Convert to array and calculate stats
        allGuests = Array.from(guestMap.values()).map(guest => {
            const confirmedBookings = guest.bookings.filter(b => b.status !== 'cancelled')
            const totalSpent = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0)
            const totalNights = confirmedBookings.reduce((sum, b) => sum + (parseInt(b.nights) || 0), 0)
            const lastBooking = confirmedBookings.length > 0
                ? new Date(Math.max(...confirmedBookings.map(b => new Date(b.check_in))))
                : null

            return {
                ...guest,
                totalBookings: confirmedBookings.length,
                totalSpent,
                totalNights,
                lastVisit: lastBooking,
                avgBookingValue: confirmedBookings.length > 0 ? totalSpent / confirmedBookings.length : 0,
                isRepeat: confirmedBookings.length > 1,
                isVIP: confirmedBookings.length >= 5,
                isHighValue: totalSpent >= 50000
            }
        })

        // Update summary statistics
        document.getElementById('guestStatTotal').textContent = allGuests.length
        document.getElementById('guestStatRepeat').textContent = allGuests.filter(g => g.isRepeat).length
        document.getElementById('guestStatVIP').textContent = allGuests.filter(g => g.isVIP).length
        document.getElementById('guestStatHighValue').textContent = allGuests.filter(g => g.isHighValue).length

        const avgStays = allGuests.length > 0
            ? (allGuests.reduce((sum, g) => sum + g.totalBookings, 0) / allGuests.length).toFixed(1)
            : '0.0'
        document.getElementById('guestStatAvgStays').textContent = avgStays

        // Load saved view preference
        const savedView = localStorage.getItem('guestViewPreference') || 'table'
        currentGuestView = savedView

        // Initial display
        filteredGuests = [...allGuests]
        currentGuestPage = 1

        // Restore saved filters
        setTimeout(() => {
            const savedFilters = loadFilterState('guests')
            if (savedFilters) {
                console.log('🔄 Restoring guest filters:', savedFilters)

                // Restore search
                if (savedFilters.search) {
                    const searchInput = document.getElementById('searchGuests')
                    if (searchInput) searchInput.value = savedFilters.search
                }

                // Restore type filter
                if (savedFilters.typeFilter) {
                    const typeFilter = document.getElementById('guestTypeFilter')
                    if (typeFilter) typeFilter.value = savedFilters.typeFilter
                }

                // Restore sort
                if (savedFilters.sortBy) {
                    currentSortColumn = savedFilters.sortBy
                }

                // Restore per page
                if (savedFilters.perPage) {
                    const perPageSelect = document.getElementById('guestsPerPage')
                    if (perPageSelect) perPageSelect.value = savedFilters.perPage
                    guestsPerPage = savedFilters.perPage === 'all' ? displayedGuests.length : parseInt(savedFilters.perPage)
                }

                // Restore view (table/cards)
                if (savedFilters.currentView) {
                    currentGuestView = savedFilters.currentView
                    switchGuestView(savedFilters.currentView)
                }

                // Restore page number
                if (savedFilters.currentPage) {
                    currentGuestPage = savedFilters.currentPage
                }

                // Apply search if exists
                if (savedFilters.search) {
                    searchGuests()
                } else {
                    filterGuests()
                }
            } else {
                filterGuests()
            }
        }, 300)

    } catch (error) {
        console.error('Error loading guests:', error)
        showToast('Error', 'Failed to load guests: ' + error.message, '❌')

        // Show error in UI
        const tableBody = document.getElementById('guestTableBody')
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 60px 20px; color: var(--danger);">
                        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Error Loading Guests</div>
                        <div style="font-size: 14px; color: var(--text-secondary);">${error.message}</div>
                    </td>
                </tr>
            `
        }
    }
}

/**
 * Search guests by name, phone, or email (instant search)
 */
export function searchGuests() {
    const searchTerm = document.getElementById('searchGuests').value.toLowerCase().trim()

    if (!searchTerm) {
        filteredGuests = [...allGuests]
    } else {
        filteredGuests = allGuests.filter(g =>
            (g.name || '').toLowerCase().includes(searchTerm) ||
            (g.phone || '').toLowerCase().includes(searchTerm) ||
            (g.email || '').toLowerCase().includes(searchTerm)
        )
    }

    currentGuestPage = 1 // Reset to first page
    filterGuests()
}

/**
 * Filter and sort guests
 */
export function filterGuests() {
    let guests = [...filteredGuests]

    // Apply type filter
    const typeFilter = document.getElementById('guestTypeFilter').value
    if (typeFilter === 'repeat') {
        guests = guests.filter(g => g.isRepeat)
    } else if (typeFilter === 'new') {
        guests = guests.filter(g => !g.isRepeat)
    } else if (typeFilter === 'vip') {
        guests = guests.filter(g => g.isVIP)
    } else if (typeFilter === 'highvalue') {
        guests = guests.filter(g => g.isHighValue)
    }

    // Apply sorting
    sortGuestArray(guests)

    // Store for pagination
    displayedGuests = guests

    // Auto-switch to cards if < 20 results, otherwise table
    if (guests.length > 0 && guests.length <= 20 && currentGuestView === 'table') {
        // Don't auto-switch, respect user preference
    }

    // Render based on current view
    if (currentGuestView === 'table') {
        renderGuestTable()
    } else {
        renderGuestCards()
    }
    // Save filter state
    const searchValue = document.getElementById('searchGuests')?.value || ''
    const sortBy = document.getElementById('guestSortBy')?.value || 'name'
    const perPage = document.getElementById('guestsPerPage')?.value || '50'

    saveFilterState('guests', {
        search: searchValue,
        typeFilter: typeFilter,
        sortBy: sortBy,
        perPage: perPage,
        currentView: currentGuestView,
        currentPage: currentGuestPage
    })
}

/**
 * Sort guest array by current sort column
 */
function sortGuestArray(guests) {
    guests.sort((a, b) => {
        let aVal, bVal

        switch(currentSortColumn) {
            case 'name':
                aVal = (a.name || '').toLowerCase()
                bVal = (b.name || '').toLowerCase()
                break
            case 'phone':
                aVal = a.phone || ''
                bVal = b.phone || ''
                break
            case 'lastVisit':
                aVal = a.lastVisit ? a.lastVisit.getTime() : 0
                bVal = b.lastVisit ? b.lastVisit.getTime() : 0
                break
            case 'stays':
                aVal = a.totalBookings
                bVal = b.totalBookings
                break
            case 'spent':
                aVal = a.totalSpent
                bVal = b.totalSpent
                break
            default:
                aVal = a.name
                bVal = b.name
        }

        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1
        return 0
    })
}

/**
 * Sort guests table by column
 */
export function sortGuestsTable(column) {
    if (currentSortColumn === column) {
        // Toggle direction
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc'
    } else {
        currentSortColumn = column
        currentSortDirection = 'asc'
    }

    // Update sort icons
    document.querySelectorAll('[id^="sortIcon"]').forEach(el => el.textContent = '↕️')
    const icon = currentSortDirection === 'asc' ? '↑' : '↓'
    const iconId = 'sortIcon' + column.charAt(0).toUpperCase() + column.slice(1)
    const iconEl = document.getElementById(iconId)
    if (iconEl) iconEl.textContent = icon

    filterGuests()
}

/**
 * Switch between table and card view
 */
export function switchGuestView(view) {
    currentGuestView = view

    // Save preference
    localStorage.setItem('guestViewPreference', view)

    // Update button styles
    document.getElementById('tableViewBtn').style.background = view === 'table' ? 'var(--primary)' : 'var(--secondary)'
    document.getElementById('cardViewBtn').style.background = view === 'cards' ? 'var(--primary)' : 'var(--secondary)'

    // Show/hide views
    document.getElementById('guestTableView').style.display = view === 'table' ? 'block' : 'none'
    document.getElementById('guestCardView').style.display = view === 'cards' ? 'block' : 'none'

    // Re-render
    filterGuests()
}

/**
 * Change guests per page
 */
export function changeGuestsPerPage() {
    const value = document.getElementById('guestsPerPage').value
    guestsPerPage = value === 'all' ? displayedGuests.length : parseInt(value)
    currentGuestPage = 1
    filterGuests()
}

/**
 * Render guest table with pagination
 */
function renderGuestTable() {
    const tbody = document.getElementById('guestTableBody')

    if (displayedGuests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No guests found</div>
                    <div style="font-size: 14px;">Try adjusting your search or filters</div>
                </td>
            </tr>
        `
        document.getElementById('guestPagination').style.display = 'none'
        return
    }

    // Pagination logic
    const totalGuests = displayedGuests.length
    const totalPages = Math.ceil(totalGuests / guestsPerPage)
    const startIdx = (currentGuestPage - 1) * guestsPerPage
    const endIdx = Math.min(startIdx + guestsPerPage, totalGuests)
    const pageGuests = displayedGuests.slice(startIdx, endIdx)

    // Update pagination info
    document.getElementById('guestShowingStart').textContent = totalGuests > 0 ? startIdx + 1 : 0
    document.getElementById('guestShowingEnd').textContent = endIdx
    document.getElementById('guestShowingTotal').textContent = totalGuests
    document.getElementById('guestPagination').style.display = 'flex'

    // Render table rows
    let html = ''
    pageGuests.forEach(guest => {
        const guestBadge = guest.isVIP ? '<span style="background: var(--warning); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 6px;">👑 VIP</span>' :
                           guest.isRepeat ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 6px;">🌟</span>' :
                           '<span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 6px;">✨</span>'

        const lastVisitText = guest.lastVisit ? formatDate(guest.lastVisit) : 'Never'
        const contactInfo = guest.phone ? `📱 ${guest.phone}` : (guest.email ? `📧 ${guest.email}` : 'No contact')

        html += `
            <tr style="cursor: pointer;" onclick="showGuestDetail('${guest.key.replace(/'/g, "\\'")}')">
                <td data-label="Guest Name">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 36px; height: 36px; background: var(--gradient-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; flex-shrink: 0;">
                            ${(guest.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                            <strong>${guest.name || 'Unknown Guest'}</strong>
                            ${guestBadge}
                        </div>
                    </div>
                </td>
                <td data-label="Contact">
                    <div style="font-size: 13px;">
                        ${guest.phone ? `<div>📱 ${guest.phone}</div>` : ''}
                        ${guest.email ? `<div style="color: var(--text-secondary);">📧 ${guest.email}</div>` : ''}
                        ${!guest.phone && !guest.email ? '<span style="color: var(--text-secondary);">No contact</span>' : ''}
                    </div>
                </td>
                <td data-label="Last Visit">${lastVisitText}</td>
                <td data-label="Stays"><strong>${guest.totalBookings}</strong></td>
                <td data-label="Total Spent"><strong style="color: var(--success);">${formatCurrency(guest.totalSpent)}</strong></td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); showGuestDetail('${guest.key.replace(/'/g, "\\'")}')">
                        👁️ View
                    </button>
                </td>
            </tr>
        `
    })

    tbody.innerHTML = html

    // Render pagination buttons
    renderPaginationButtons(totalPages)
}

/**
 * Render pagination buttons
 */
function renderPaginationButtons(totalPages) {
    const container = document.getElementById('guestPaginationButtons')

    if (totalPages <= 1) {
        container.innerHTML = ''
        return
    }

    let html = ''

    // Previous button
    html += `
        <button class="btn btn-sm btn-secondary"
                onclick="changeGuestPage(${currentGuestPage - 1})"
                ${currentGuestPage === 1 ? 'disabled' : ''}>
            ◀ Prev
        </button>
    `

    // Page numbers
    const maxButtons = 7
    let startPage = Math.max(1, currentGuestPage - Math.floor(maxButtons / 2))
    let endPage = Math.min(totalPages, startPage + maxButtons - 1)

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1)
    }

    if (startPage > 1) {
        html += `<button class="btn btn-sm btn-secondary" onclick="changeGuestPage(1)">1</button>`
        if (startPage > 2) html += `<span style="padding: 0 8px;">...</span>`
    }

    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentGuestPage
        html += `
            <button class="btn btn-sm"
                    onclick="changeGuestPage(${i})"
                    style="background: ${isActive ? 'var(--primary)' : 'var(--secondary)'}; color: white;">
                ${i}
            </button>
        `
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 8px;">...</span>`
        html += `<button class="btn btn-sm btn-secondary" onclick="changeGuestPage(${totalPages})">${totalPages}</button>`
    }

    // Next button
    html += `
        <button class="btn btn-sm btn-secondary"
                onclick="changeGuestPage(${currentGuestPage + 1})"
                ${currentGuestPage === totalPages ? 'disabled' : ''}>
            Next ▶
        </button>
    `

    container.innerHTML = html
}

/**
 * Change page
 */
export function changeGuestPage(page) {
    const totalPages = Math.ceil(displayedGuests.length / guestsPerPage)
    if (page < 1 || page > totalPages) return

    currentGuestPage = page
    renderGuestTable()

    // Scroll to top of table
    document.getElementById('guestTableView').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Render guest cards (compact grid version)
 */
function renderGuestCards() {
    const container = document.getElementById('guestListContainer')

    if (displayedGuests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No guests found</div>
                <div style="font-size: 14px;">Try adjusting your search or filters</div>
            </div>
        `
        return
    }

    // Pagination for cards
    const totalGuests = displayedGuests.length
    const startIdx = (currentGuestPage - 1) * guestsPerPage
    const endIdx = Math.min(startIdx + guestsPerPage, totalGuests)
    const pageGuests = displayedGuests.slice(startIdx, endIdx)

    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">'

    pageGuests.forEach(guest => {
        const guestBadge = guest.isVIP ? '👑 VIP' : guest.isRepeat ? '🌟 Repeat' : '✨ New'
        const badgeColor = guest.isVIP ? 'var(--warning)' : guest.isRepeat ? 'var(--success)' : 'var(--primary)'
        const lastVisitText = guest.lastVisit ? formatDate(guest.lastVisit) : 'Never'

        html += `
            <div class="stat-card" style="cursor: pointer; transition: all 0.3s ease;" onclick="showGuestDetail('${guest.key.replace(/'/g, "\\'")}')">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <div style="width: 40px; height: 40px; background: var(--gradient-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: white;">
                                ${(guest.name || '?')[0].toUpperCase()}
                            </div>
                            <div style="flex: 1;">
                                <h4 style="font-size: 16px; font-weight: 700; margin: 0 0 4px 0;">${guest.name || 'Unknown'}</h4>
                                <div style="display: inline-block; padding: 2px 8px; background: ${badgeColor}; color: white; border-radius: 10px; font-size: 10px; font-weight: 600;">
                                    ${guestBadge}
                                </div>
                            </div>
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            ${guest.phone ? `<div>📱 ${guest.phone}</div>` : ''}
                            ${guest.email ? `<div>📧 ${guest.email}</div>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: 700; color: var(--success);">${formatCurrency(guest.totalSpent)}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">Total</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 12px; border-top: 1px solid var(--border);">
                    <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: var(--primary);">${guest.totalBookings}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Stays</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${guest.totalNights}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Nights</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: var(--text-secondary);">${lastVisitText}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Last</div>
                    </div>
                </div>
            </div>
        `
    })

    html += '</div>'

    // Add pagination for cards if needed
    const totalPages = Math.ceil(totalGuests / guestsPerPage)
    if (totalPages > 1) {
        html += `
            <div style="display: flex; justify-content: center; align-items: center; padding: 20px; gap: 8px;">
                ${renderCardPaginationHTML(totalPages)}
            </div>
        `
    }

    container.innerHTML = html
}

/**
 * Render pagination HTML for cards
 */
function renderCardPaginationHTML(totalPages) {
    let html = `
        <button class="btn btn-sm btn-secondary"
                onclick="changeGuestPage(${currentGuestPage - 1})"
                ${currentGuestPage === 1 ? 'disabled' : ''}>
            ◀ Prev
        </button>
    `

    for (let i = 1; i <= Math.min(5, totalPages); i++) {
        const isActive = i === currentGuestPage
        html += `
            <button class="btn btn-sm"
                    onclick="changeGuestPage(${i})"
                    style="background: ${isActive ? 'var(--primary)' : 'var(--secondary)'}; color: white;">
                ${i}
            </button>
        `
    }

    if (totalPages > 5) {
        html += `<span>...</span>`
    }

    html += `
        <button class="btn btn-sm btn-secondary"
                onclick="changeGuestPage(${currentGuestPage + 1})"
                ${currentGuestPage === totalPages ? 'disabled' : ''}>
            Next ▶
        </button>
    `

    return html
}

/**
 * Show guest detail modal
 */
export function showGuestDetail(guestKey) {
    const guest = allGuests.find(g => g.key === guestKey)
    if (!guest) return

    currentGuestData = guest

    // Update profile section
    document.getElementById('guestDetailName').textContent = guest.name || 'Unknown Guest'
    document.getElementById('guestDetailNameHeader').textContent = guest.name || 'Unknown Guest'
    document.getElementById('guestDetailPhone').textContent = guest.phone || 'No phone'
    document.getElementById('guestDetailEmail').textContent = guest.email || 'No email'

    // Update badge
    const badge = guest.isVIP ? '👑 VIP Guest' : guest.isRepeat ? '🌟 Repeat Guest' : '✨ New Guest'
    document.getElementById('guestDetailBadge').textContent = badge

    // Update statistics
    document.getElementById('guestDetailTotalBookings').textContent = guest.totalBookings
    document.getElementById('guestDetailTotalNights').textContent = guest.totalNights
    document.getElementById('guestDetailTotalSpent').textContent = formatCurrency(guest.totalSpent)
    document.getElementById('guestDetailAvgValue').textContent = formatCurrency(guest.avgBookingValue)
    document.getElementById('guestDetailLastVisit').textContent = guest.lastVisit
        ? formatDate(guest.lastVisit)
        : 'Never'

    // Update booking count
    document.getElementById('guestDetailBookingCount').textContent = guest.totalBookings

    // Render booking history
    const historyHtml = guest.bookings
        .sort((a, b) => new Date(b.check_in) - new Date(a.check_in))
        .map(booking => {
            const statusColors = {
                'confirmed': 'var(--success)',
                'pending': 'var(--warning)',
                'checked-in': 'var(--primary)',
                'checked-out': 'var(--text-secondary)',
                'cancelled': 'var(--danger)'
            }

            return `
                <div style="padding: 16px; background: var(--background-alt); border-radius: 8px; border-left: 4px solid ${statusColors[booking.status] || 'var(--border)'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: 600; margin-bottom: 4px;">${booking.property_name || 'Property'}</div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                📅 ${formatDate(booking.check_in)} → ${formatDate(booking.check_out)}
                                <span style="color: var(--text-primary); font-weight: 600;">(${booking.nights} nights)</span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                                Booking ID: ${booking.booking_id || 'N/A'}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 18px; font-weight: 700; color: var(--success);">
                                ${formatCurrency(booking.total_amount)}
                            </div>
                            <div style="font-size: 11px; padding: 3px 8px; background: ${statusColors[booking.status] || 'var(--border)'}; color: white; border-radius: 12px; margin-top: 4px; display: inline-block;">
                                ${booking.status}
                            </div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                        👥 ${booking.adults || 0} adults${booking.kids ? `, ${booking.kids} kids` : ''}
                    </div>
                </div>
            `
        }).join('')

    document.getElementById('guestDetailBookingHistory').innerHTML = historyHtml

    // Show modal
    document.getElementById('guestDetailModal').classList.add('active')
}

/**
 * Close guest detail modal
 */
export function closeGuestDetailModal() {
    document.getElementById('guestDetailModal').classList.remove('active')
    currentGuestData = null
}

/**
 * Edit guest information
 */
export function editGuestInfo() {
    if (!currentGuestData) return

    document.getElementById('editGuestName').value = currentGuestData.name || ''
    document.getElementById('editGuestPhone').value = currentGuestData.phone || ''
    document.getElementById('editGuestEmail').value = currentGuestData.email || ''
    document.getElementById('editGuestOriginalPhone').value = currentGuestData.phone || ''
    document.getElementById('editGuestOriginalEmail').value = currentGuestData.email || ''

    document.getElementById('editGuestModal').classList.add('active')
}

/**
 * Close edit guest modal
 */
export function closeEditGuestModal() {
    document.getElementById('editGuestModal').classList.remove('active')
}

/**
 * Save guest information
 */
export async function saveGuestInfo() {
    if (!currentGuestData) return

    const newName = document.getElementById('editGuestName').value.trim()
    const newPhone = document.getElementById('editGuestPhone').value.trim()
    const newEmail = document.getElementById('editGuestEmail').value.trim()

    if (!newName) {
        showToast('Validation Error', 'Guest name is required', '❌')
        return
    }

    try {
        // Update all bookings for this guest
        const updates = {
            guest_name: newName,
            guest_phone: newPhone,
            guest_email: newEmail
        }

        // Find all booking IDs for this guest
        const bookingIds = currentGuestData.bookings.map(b => b.booking_id)

        // Update in database
        for (const bookingId of bookingIds) {
            await supabase
                .from('reservations')
                .update(updates)
                .eq('booking_id', bookingId)
        }

        closeEditGuestModal()
        closeGuestDetailModal()

        // Reload guests
        await loadGuests()

        showToast('Success', `Updated information for ${newName}`, '✅')

    } catch (error) {
        console.error('Error updating guest:', error)
        showToast('Error', 'Failed to update guest information', '❌')
    }
}

/**
 * Call guest
 */
export function callGuest() {
    if (!currentGuestData || !currentGuestData.phone) {
        showToast('No Phone', 'Guest phone number not available', '⚠️')
        return
    }
    window.location.href = `tel:${currentGuestData.phone}`
}

/**
 * WhatsApp guest
 */
export function whatsappGuest() {
    if (!currentGuestData || !currentGuestData.phone) {
        showToast('No Phone', 'Guest phone number not available', '⚠️')
        return
    }

    let phone = currentGuestData.phone.replace(/[^0-9]/g, '')
    if (!phone.startsWith('91') && phone.length === 10) {
        phone = '91' + phone
    }

    const message = encodeURIComponent(`Hello ${currentGuestData.name}, this is ResIQ by Hostizzy.`)
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
}

/**
 * Email guest
 */
export function emailGuest() {
    if (!currentGuestData || !currentGuestData.email) {
        showToast('No Email', 'Guest email not available', '⚠️')
        return
    }
    window.location.href = `mailto:${currentGuestData.email}`
}

/**
 * Clear guest filters
 */
export function clearGuestFilters() {
    document.getElementById('searchGuests').value = ''
    document.getElementById('guestTypeFilter').value = ''
    document.getElementById('guestSortBy').value = 'name'
    document.getElementById('guestsPerPage').value = '50'
    guestsPerPage = 50
    currentGuestPage = 1
    currentSortColumn = 'name'
    currentSortDirection = 'asc'
    filteredGuests = [...allGuests]

    // Clear saved filter state
    clearFilterState('guests')

    filterGuests()
}

/**
 * Export guests to CSV
 */
export function exportGuestsCSV() {
    const guestsToExport = displayedGuests.length > 0 ? displayedGuests : allGuests

    if (guestsToExport.length === 0) {
        showToast('No Data', 'No guests to export', '⚠️')
        return
    }

    // Prepare CSV data
    const headers = ['Name', 'Phone', 'Email', 'Total Bookings', 'Total Nights', 'Total Spent', 'Avg Booking Value', 'Last Visit', 'Guest Type']

    const rows = guestsToExport.map(g => [
        g.name || '',
        g.phone || '',
        g.email || '',
        g.totalBookings,
        g.totalNights,
        g.totalSpent,
        g.avgBookingValue.toFixed(2),
        g.lastVisit ? formatDate(g.lastVisit) : 'Never',
        g.isVIP ? 'VIP' : g.isRepeat ? 'Repeat' : 'New'
    ])

    // Create CSV
    let csv = headers.join(',') + '\n'
    rows.forEach(row => {
        csv += row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma
            const cellStr = String(cell)
            if (cellStr.includes(',') || cellStr.includes('"')) {
                return '"' + cellStr.replace(/"/g, '""') + '"'
            }
            return cellStr
        }).join(',') + '\n'
    })

    // Download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `guests_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast('Exported', `${guestsToExport.length} guests exported to CSV`, '✅')
}

// ==========================================
// GUEST DOCUMENTS (KYC) FUNCTIONS
// ==========================================

/**
 * Load and display guest documents
 */
export async function loadGuestDocuments() {
    try {
        showLoading('Loading guest documents...')

        // Fetch all guest documents with reservation info
        const { data: documents, error } = await supabase
            .from('guest_documents')
            .select(`
                *,
                reservations:booking_id (
                    booking_id,
                    property_name,
                    guest_name,
                    guest_phone,
                    guest_email,
                    check_in,
                    check_out
                )
            `)
            .order('submitted_at', { ascending: false })

        if (error) {
            console.error('Error loading guest documents:', error)
            // Don't throw - show empty state if no table exists yet
            currentGuestDocuments = []
        } else {
            currentGuestDocuments = documents || []
        }

        renderGuestDocuments()
        updateDocumentStats()
        updateHomeStatDocuments()

        hideLoading()
    } catch (error) {
        hideLoading()
        console.error('Error loading guest documents:', error)
        // Show user-friendly message
        const container = document.getElementById('guestDocumentsList')
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.3;">⚠️</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Unable to load documents</div>
                    <div style="font-size: 14px;">Please ensure the database schema has been set up.</div>
                    <div style="font-size: 14px; margin-top: 8px;">
                        <a href="#" onclick="loadGuestDocuments(); return false;" style="color: var(--primary);">Retry</a>
                    </div>
                </div>
            `
        }
    }
}

/**
 * Render guest documents list
 */
function renderGuestDocuments() {
    const container = document.getElementById('guestDocumentsList')
    if (!container) return

    // Filter documents
    let filtered = currentGuestDocuments
    if (currentFilterStatus !== 'all') {
        filtered = currentGuestDocuments.filter(doc => doc.status === currentFilterStatus)
    }

    // Search filter
    const searchTerm = document.getElementById('guestDocSearch')?.value?.toLowerCase() || ''
    if (searchTerm) {
        filtered = filtered.filter(doc => {
            return (
                (doc.booking_id || '').toLowerCase().includes(searchTerm) ||
                (doc.guest_name || '').toLowerCase().includes(searchTerm) ||
                (doc.reservations?.guest_phone || '').includes(searchTerm)
            )
        })
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.3;">📋</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No documents found</div>
                <div style="font-size: 14px;">Guest ID submissions will appear here</div>
            </div>
        `
        return
    }

    // Group by booking ID
    const groupedByBooking = {}
    filtered.forEach(doc => {
        if (!groupedByBooking[doc.booking_id]) {
            groupedByBooking[doc.booking_id] = []
        }
        groupedByBooking[doc.booking_id].push(doc)
    })

    let html = ''

    Object.entries(groupedByBooking).forEach(([bookingId, docs]) => {
        const reservation = docs[0].reservations
        const pendingCount = docs.filter(d => d.status === 'pending').length
        const verifiedCount = docs.filter(d => d.status === 'verified').length
        const rejectedCount = docs.filter(d => d.status === 'rejected').length

        html += `
            <div style="border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; background: white;">
                <!-- Booking Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">
                            ${bookingId}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 14px;">
                            ${reservation?.property_name || 'Unknown Property'}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">
                            📅 ${reservation ? formatDateHelper(reservation.check_in) : '-'} - ${reservation ? formatDateHelper(reservation.check_out) : '-'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        ${pendingCount > 0 ? `<span style="background: var(--warning-light); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">⏳ ${pendingCount} Pending</span>` : ''}
                        ${verifiedCount > 0 ? `<span style="background: var(--success); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">✅ ${verifiedCount} Verified</span>` : ''}
                        ${rejectedCount > 0 ? `<span style="background: var(--danger); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">❌ ${rejectedCount} Rejected</span>` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="sendGuestReminder('${bookingId}', '${reservation?.guest_phone || ''}', '${reservation?.guest_name || ''}')">
                            📱 Send Reminder
                        </button>
                    </div>
                </div>

                <!-- Guest Documents List -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                    ${docs.map(doc => createDocumentCard(doc)).join('')}
                </div>
            </div>
        `
    })

    container.innerHTML = html
}

/**
 * Create document card
 */
function createDocumentCard(doc) {
    const statusColors = {
        pending: { bg: '#fef3c7', color: '#92400e', icon: '⏳' },
        verified: { bg: '#d1fae5', color: '#065f46', icon: '✅' },
        rejected: { bg: '#fee2e2', color: '#991b1b', icon: '❌' },
        incomplete: { bg: '#e5e7eb', color: '#374151', icon: '⚠️' }
    }

    const status = statusColors[doc.status] || statusColors.pending
    const docTypeLabel = (doc.document_type || 'Unknown').replace(/_/g, ' ')

    return `
        <div style="border: 1px solid var(--border); border-radius: 8px; padding: 16px; background: var(--background); cursor: pointer; transition: all 0.2s;"
             onclick="openDocumentReview('${doc.id}')"
             onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'"
             onmouseout="this.style.boxShadow='none'; this.style.transform='translateY(0)'">

            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div style="font-weight: 600; font-size: 14px;">
                    ${doc.guest_type === 'primary' ? '👤 ' : ''}${doc.guest_name}
                </div>
                <span style="background: ${status.bg}; color: ${status.color}; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">
                    ${status.icon} ${doc.status.toUpperCase()}
                </span>
            </div>

            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
                📄 ${docTypeLabel}
            </div>

            <div style="font-size: 12px; color: var(--text-tertiary);">
                Submitted: ${formatDateTimeHelper(doc.submitted_at)}
            </div>

            ${doc.verified_at ? `
                <div style="font-size: 12px; color: var(--success); margin-top: 4px;">
                    ✓ Verified by ${doc.verified_by || 'Staff'}
                </div>
            ` : ''}

            ${doc.rejection_reason ? `
                <div style="font-size: 12px; color: var(--danger); margin-top: 4px;">
                    Reason: ${doc.rejection_reason}
                </div>
            ` : ''}
        </div>
    `
}

/**
 * Filter guest documents
 */
export function filterGuestDocuments(status) {
    currentFilterStatus = status

    // Update UI
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active')
    })
    document.querySelector(`.filter-chip[data-status="${status}"]`)?.classList.add('active')

    renderGuestDocuments()
}

/**
 * Search guest documents
 */
export function searchGuestDocuments(term) {
    renderGuestDocuments()
}

/**
 * Update document stats
 */
function updateDocumentStats() {
    const pending = currentGuestDocuments.filter(d => d.status === 'pending').length
    const verified = currentGuestDocuments.filter(d => d.status === 'verified').length
    const rejected = currentGuestDocuments.filter(d => d.status === 'rejected').length
    const incomplete = currentGuestDocuments.filter(d => d.status === 'incomplete').length

    const pendingEl = document.getElementById('docStatPending')
    const verifiedEl = document.getElementById('docStatVerified')
    const rejectedEl = document.getElementById('docStatRejected')
    const incompleteEl = document.getElementById('docStatIncomplete')

    if (pendingEl) pendingEl.textContent = pending
    if (verifiedEl) verifiedEl.textContent = verified
    if (rejectedEl) rejectedEl.textContent = rejected
    if (incompleteEl) incompleteEl.textContent = incomplete
}

/**
 * Update home stat (Pending Documents)
 */
function updateHomeStatDocuments() {
    const pending = currentGuestDocuments.filter(d => d.status === 'pending').length
    const element = document.getElementById('homeStatDocuments')
    if (element) {
        element.textContent = pending
    }
}

/**
 * Refresh guest documents
 */
export async function refreshGuestDocuments() {
    await loadGuestDocuments()
    showToast('Documents refreshed successfully!', 'success')
}

/**
 * Open document review modal
 */
export async function openDocumentReview(documentId) {
    try {
        showLoading('Loading document...')

        const { data: doc, error } = await supabase
            .from('guest_documents')
            .select('*')
            .eq('id', documentId)
            .single()

        if (error) throw error

        currentDocumentForReview = doc

        // Populate modal
        document.getElementById('modalGuestName').textContent = doc.guest_name
        document.getElementById('modalBookingId').textContent = doc.booking_id
        document.getElementById('modalDocType').textContent = (doc.document_type || 'Unknown').replace(/_/g, ' ')
        document.getElementById('modalDocNumber').textContent = doc.document_number || 'N/A'
        document.getElementById('modalSubmittedAt').textContent = formatDateTimeHelper(doc.submitted_at)
        document.getElementById('modalStatus').textContent = doc.status.toUpperCase()
        document.getElementById('modalStaffNotes').value = doc.staff_notes || ''

        // Load images
        await loadDocumentImages(doc)

        // Show/hide elements based on status
        if (doc.status === 'verified') {
            document.getElementById('modalActions').style.display = 'none'
            document.getElementById('rejectFormSection').style.display = 'none'
            document.getElementById('verifiedMessage').style.display = 'block'
            document.getElementById('verifiedBy').textContent = doc.verified_by || 'Staff'
            document.getElementById('verifiedAt').textContent = formatDateTimeHelper(doc.verified_at)
        } else {
            document.getElementById('modalActions').style.display = 'flex'
            document.getElementById('rejectFormSection').style.display = 'none'
            document.getElementById('verifiedMessage').style.display = 'none'
        }

        // Show delete button only for admins
        const deleteContainer = document.getElementById('deleteButtonContainer')
        const currentUser = getCurrentUser()
        if (currentUser && currentUser.role === 'admin') {
            deleteContainer.style.display = 'block'
        } else {
            deleteContainer.style.display = 'none'
        }

        // Show rejection reason if rejected
        if (doc.status === 'rejected' && doc.rejection_reason) {
            document.getElementById('rejectionReasonSection').style.display = 'block'
            document.getElementById('rejectionReasonText').textContent = doc.rejection_reason
        } else {
            document.getElementById('rejectionReasonSection').style.display = 'none'
        }

        document.getElementById('guestDocumentModal').style.display = 'flex'
        hideLoading()

    } catch (error) {
        hideLoading()
        console.error('Error opening document review:', error)
        showToast('Failed to load document', 'error')
    }
}

/**
 * Load document images
 */
async function loadDocumentImages(doc) {
    const frontImg = document.getElementById('modalFrontImage')
    const backImg = document.getElementById('modalBackImage')
    const selfieImg = document.getElementById('modalSelfieImage')

    const frontContainer = document.getElementById('modalFrontImageContainer')
    const backContainer = document.getElementById('modalBackImageContainer')
    const selfieContainer = document.getElementById('modalSelfieContainer')

    // Load front image
    if (doc.document_front_url) {
        const { data } = await supabase.storage
            .from('guest-id-documents')
            .createSignedUrl(doc.document_front_url, 3600)

        if (data?.signedUrl) {
            frontImg.src = data.signedUrl
            frontContainer.style.display = 'block'
        }
    } else {
        frontContainer.style.display = 'none'
    }

    // Load back image
    if (doc.document_back_url) {
        const { data } = await supabase.storage
            .from('guest-id-documents')
            .createSignedUrl(doc.document_back_url, 3600)

        if (data?.signedUrl) {
            backImg.src = data.signedUrl
            backContainer.style.display = 'block'
        }
    } else {
        backContainer.style.display = 'none'
    }

    // Load selfie
    if (doc.selfie_url) {
        const { data } = await supabase.storage
            .from('guest-id-documents')
            .createSignedUrl(doc.selfie_url, 3600)

        if (data?.signedUrl) {
            selfieImg.src = data.signedUrl
            selfieContainer.style.display = 'block'
        }
    } else {
        selfieContainer.style.display = 'none'
    }
}

/**
 * Close document review modal
 */
export function closeGuestDocumentModal() {
    document.getElementById('guestDocumentModal').style.display = 'none'
    currentDocumentForReview = null
}

/**
 * Approve document
 */
export async function approveDocument() {
    if (!currentDocumentForReview) return

    try {
        showLoading('Approving document...')

        const notes = document.getElementById('modalStaffNotes').value
        const currentUser = getCurrentUser()

        const { error } = await supabase
            .from('guest_documents')
            .update({
                status: 'verified',
                verified_by: currentUser.email,
                verified_at: new Date().toISOString(),
                staff_notes: notes,
                rejection_reason: null,
                resubmission_deadline: null
            })
            .eq('id', currentDocumentForReview.id)

        if (error) throw error

        hideLoading()
        showToast('Document approved successfully!', 'success')

        // Send push notification
        if (typeof window.notifyKYCVerified === 'function') {
            window.notifyKYCVerified(
                currentDocumentForReview.booking_id,
                currentDocumentForReview.guest_name
            )
        }

        closeGuestDocumentModal()
        await loadGuestDocuments()

    } catch (error) {
        hideLoading()
        console.error('Error approving document:', error)
        showToast('Failed to approve document', 'error')
    }
}

/**
 * Delete document (admin only)
 */
export async function deleteDocument() {
    if (!currentDocumentForReview) return

    // Confirm deletion
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
        return
    }

    try {
        showLoading('Deleting document...')

        // Delete from database
        const { error } = await supabase
            .from('guest_documents')
            .delete()
            .eq('id', currentDocumentForReview.id)

        if (error) throw error

        hideLoading()
        showToast('Document deleted successfully', 'success')
        closeGuestDocumentModal()
        await loadGuestDocuments()

    } catch (error) {
        hideLoading()
        console.error('Error deleting document:', error)
        showToast('Failed to delete document', 'error')
    }
}

/**
 * Show reject form
 */
export function showRejectForm() {
    document.getElementById('modalActions').style.display = 'none'
    document.getElementById('rejectFormSection').style.display = 'block'
}

/**
 * Hide reject form
 */
export function hideRejectForm() {
    document.getElementById('modalActions').style.display = 'flex'
    document.getElementById('rejectFormSection').style.display = 'none'
}

/**
 * Reject document
 */
export async function rejectDocument() {
    if (!currentDocumentForReview) return

    const reason = document.getElementById('modalRejectionReason').value
    const notes = document.getElementById('modalStaffNotes').value

    if (!reason) {
        showToast('Please select a rejection reason', 'error')
        return
    }

    try {
        showLoading('Rejecting document...')

        const currentUser = getCurrentUser()

        const { error } = await supabase
            .from('guest_documents')
            .update({
                status: 'rejected',
                rejection_reason: reason,
                verified_by: currentUser.email,
                verified_at: new Date().toISOString(),
                staff_notes: notes
            })
            .eq('id', currentDocumentForReview.id)

        if (error) throw error

        hideLoading()
        showToast('Document rejected', 'success')

        // Send WhatsApp notification to guest about resubmission
        if (currentDocumentForReview.reservations) {
            const reservation = currentDocumentForReview.reservations[0]
            const checkInDate = new Date(reservation.check_in)
            const deadline = new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000) // 24 hours before
            const deadlineStr = deadline.toLocaleDateString('en-IN')

            const message = `Hi ${reservation.guest_name}, your ID document was not approved. Please resubmit before ${deadlineStr}. Reason: ${reason}`
            const formattedPhone = reservation.guest_phone.replace(/\D/g, '')
            const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`

            // Open WhatsApp (user can send manually or auto-send if integrated)
            console.log('WhatsApp message ready:', message)
            // Uncomment line below if you want to auto-open WhatsApp
            // window.open(whatsappUrl, '_blank')
        }

        closeGuestDocumentModal()
        await loadGuestDocuments()

    } catch (error) {
        hideLoading()
        console.error('Error rejecting document:', error)
        showToast('Failed to reject document', 'error')
    }
}

/**
 * Reverse approval to reject
 */
export async function reverseApprovalToReject() {
    if (!currentDocumentForReview) return

    // Confirm the action
    if (!confirm('Are you sure you want to revert this approval? The document will be marked as rejected.')) {
        return
    }

    try {
        showLoading('Reverting approval...')

        const { error } = await supabase
            .from('guest_documents')
            .update({
                status: 'rejected',
                verified_by: null,
                verified_at: null,
                rejection_reason: 'Reverted from approved (manual correction)',
                staff_notes: 'Auto-reverted by admin'
            })
            .eq('id', currentDocumentForReview.id)

        if (error) throw error

        hideLoading()
        showToast('Approval reverted - Document marked as rejected', 'success')
        closeGuestDocumentModal()
        await loadGuestDocuments()

    } catch (error) {
        hideLoading()
        console.error('Error reverting approval:', error)
        showToast('Failed to revert approval', 'error')
    }
}

/**
 * Fullscreen image viewer
 */
export function openImageFullscreen(src) {
    document.getElementById('fullscreenImage').src = src
    document.getElementById('fullscreenImageModal').style.display = 'flex'
}

export function closeFullscreenImage() {
    document.getElementById('fullscreenImageModal').style.display = 'none'
}

/**
 * Copy guest portal link
 */
export function copyGuestPortalLink() {
    const portalUrl = window.location.origin + '/guest-portal.html'

    navigator.clipboard.writeText(portalUrl).then(() => {
        showToast('Guest portal link copied to clipboard!', 'success')
    }).catch(() => {
        showToast('Failed to copy link', 'error')
    })
}

/**
 * Send guest reminder (WhatsApp)
 */
export function sendGuestReminder(bookingId, phone, guestName) {
    const portalUrl = window.location.origin + '/guest-portal.html?booking=' + bookingId
    const message = `Hello ${guestName}! Please submit your ID documents for booking ${bookingId} using this link: ${portalUrl}`

    // Format phone number for WhatsApp
    const formattedPhone = phone.replace(/\D/g, '')
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`

    window.open(whatsappUrl, '_blank')
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatDateHelper(dateString) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
}

function formatDateTimeHelper(dateString) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

/**
 * Calculate unique guests
 */
export function calculateUniqueGuests(reservations) {
    const uniqueGuests = new Set()
    reservations.forEach(r => {
        const identifier = r.guest_phone || r.guest_email || r.guest_name
        if (identifier) {
            uniqueGuests.add(identifier.toLowerCase().trim())
        }
    })
    return uniqueGuests.size
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.loadGuests = loadGuests
    window.searchGuests = searchGuests
    window.filterGuests = filterGuests
    window.sortGuestsTable = sortGuestsTable
    window.switchGuestView = switchGuestView
    window.changeGuestsPerPage = changeGuestsPerPage
    window.changeGuestPage = changeGuestPage
    window.showGuestDetail = showGuestDetail
    window.closeGuestDetailModal = closeGuestDetailModal
    window.editGuestInfo = editGuestInfo
    window.closeEditGuestModal = closeEditGuestModal
    window.saveGuestInfo = saveGuestInfo
    window.callGuest = callGuest
    window.whatsappGuest = whatsappGuest
    window.emailGuest = emailGuest
    window.clearGuestFilters = clearGuestFilters
    window.exportGuestsCSV = exportGuestsCSV
    window.calculateUniqueGuests = calculateUniqueGuests

    // Guest documents
    window.loadGuestDocuments = loadGuestDocuments
    window.filterGuestDocuments = filterGuestDocuments
    window.searchGuestDocuments = searchGuestDocuments
    window.refreshGuestDocuments = refreshGuestDocuments
    window.openDocumentReview = openDocumentReview
    window.closeGuestDocumentModal = closeGuestDocumentModal
    window.approveDocument = approveDocument
    window.deleteDocument = deleteDocument
    window.showRejectForm = showRejectForm
    window.hideRejectForm = hideRejectForm
    window.rejectDocument = rejectDocument
    window.reverseApprovalToReject = reverseApprovalToReject
    window.openImageFullscreen = openImageFullscreen
    window.closeFullscreenImage = closeFullscreenImage
    window.copyGuestPortalLink = copyGuestPortalLink
    window.sendGuestReminder = sendGuestReminder
}

console.log('✅ Guest management and KYC documents module loaded')
