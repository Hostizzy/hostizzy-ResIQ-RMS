/**
 * Dashboard Module
 * Handles dashboard rendering, metrics, filters, and visualizations
 */

import { db } from './database.js'
import { setAllReservations, setAllPayments } from './state.js'
import { formatCurrency, formatDate } from './utils.js'
import { showToast } from './ui.js'
import { saveFilterState, loadFilterState, clearFilterState } from './utils.js'
import { calculateUniqueGuests } from './guests.js'
import { TARGET_OCCUPANCY_NIGHTS } from './config.js'

// ==========================================
// STATE VARIABLES
// ==========================================

let currentQuickFilter = 'all'

// Access global state
function getAllReservations() {
    return window.allReservations || []
}

function getAllPayments() {
    return window.allPayments || []
}

function getState() {
    return window.state || {}
}

// ==========================================
// CALCULATION HELPERS
// ==========================================

function calculateTotalGuests(reservations) {
    return reservations.reduce((sum, r) => {
        const adults = parseInt(r.adults) || 0
        const kids = parseInt(r.kids) || 0
        return sum + adults + kids
    }, 0)
}

function calculateAvgGroupSize(reservations) {
    if (reservations.length === 0) return '0.0'
    const totalGuests = calculateTotalGuests(reservations)
    return (totalGuests / reservations.length).toFixed(1)
}

// ==========================================
// MAIN DASHBOARD FUNCTIONS
// ==========================================

/**
 * Load and render dashboard
 */
export async function loadDashboard() {
    try {
        const allReservations = await db.getReservations()
        const allPayments = await db.getAllPayments()
        const properties = await db.getProperties()

        // Update global state
        setAllReservations(allReservations)
        setAllPayments(allPayments)
        window.state.properties = properties

        const confirmedReservations = allReservations.filter(r => r.status !== 'cancelled')
        const totalRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        const totalOtaFees = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0)
        const netRevenue = totalRevenue - totalOtaFees
        const activeBookings = allReservations.filter(r => r.status === 'checked-in').length
        const upcomingBookings = allReservations.filter(r => r.status === 'confirmed').length
        const avgBookingValue = confirmedReservations.length > 0 ? totalRevenue / confirmedReservations.length : 0
        const completedBookings = allReservations.filter(r => r.status === 'checked-out').length

        // Update primary stats
        document.getElementById('totalReservations').textContent = allReservations.length
        document.getElementById('activeReservations').textContent = activeBookings
        document.getElementById('upcomingReservations').textContent = upcomingBookings
        document.getElementById('completedReservations').textContent = completedBookings
        document.getElementById('avgBookingValue').textContent = Math.round(avgBookingValue).toLocaleString('en-IN')

        // Calculate enhanced metrics
        const hostizzyRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0)
        const totalNights = confirmedReservations.reduce((sum, r) => sum + (r.nights || 0), 0)
        const targetNights = properties.length * TARGET_OCCUPANCY_NIGHTS
        const occupancyRate = targetNights > 0 ? ((totalNights / targetNights) * 100).toFixed(1) : 0

        // Enhanced metrics cards
        let enhancedHTML = `
            <div class="metric-card" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);">
                <div class="metric-icon">💰</div>
                <div class="metric-value">${formatCurrency(totalRevenue)}</div>
                <div class="metric-label">Total Revenue</div>
                <div class="metric-trend">From ${confirmedReservations.length} bookings</div>
            </div>`

        if (totalOtaFees > 0) {
            enhancedHTML += `
            <div class="metric-card" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
                <div class="metric-icon">🏢</div>
                <div class="metric-value">${formatCurrency(totalOtaFees)}</div>
                <div class="metric-label">OTA Fees</div>
                <div class="metric-trend">Commission deductions</div>
            </div>
            <div class="metric-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <div class="metric-icon">💵</div>
                <div class="metric-value">${formatCurrency(netRevenue)}</div>
                <div class="metric-label">Net Revenue</div>
                <div class="metric-trend">After OTA fees</div>
            </div>`
        }

        enhancedHTML += `
            <div class="metric-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <div class="metric-icon">📊</div>
                <div class="metric-value">${occupancyRate}%</div>
                <div class="metric-label">Occupancy Rate</div>
                <div class="metric-trend">${totalNights}/${targetNights} nights booked</div>
            </div>
            <div class="metric-card" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
                <div class="metric-icon">🏆</div>
                <div class="metric-value">${formatCurrency(hostizzyRevenue)}</div>
                <div class="metric-label">Hostizzy Revenue</div>
                <div class="metric-trend">${totalRevenue > 0 ? ((hostizzyRevenue/totalRevenue)*100).toFixed(1) : 0}% of total</div>
            </div>
            <div class="metric-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
                <div class="metric-icon">📅</div>
                <div class="metric-value">${activeBookings}</div>
                <div class="metric-label">Active Now</div>
                <div class="metric-trend">${upcomingBookings} upcoming</div>
            </div>
            <div class="metric-card" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);">
                <div class="metric-icon">👥</div>
                <div class="metric-value">${calculateTotalGuests(confirmedReservations)}</div>
                <div class="metric-label">Total Guests</div>
                <div class="metric-trend">${calculateUniqueGuests(confirmedReservations)} unique</div>
            </div>
            <div class="metric-card" style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);">
                <div class="metric-icon">👨‍👩‍👧‍👦</div>
                <div class="metric-value">${calculateAvgGroupSize(confirmedReservations)}</div>
                <div class="metric-label">Avg Group Size</div>
                <div class="metric-trend">Per booking</div>
            </div>
        `

        document.getElementById('enhancedMetrics').innerHTML = enhancedHTML

        // Render additional components if functions exist
        if (typeof window.renderRevenueSplit === 'function') {
            window.renderRevenueSplit(allPayments, confirmedReservations)
        }
        if (typeof window.renderActionCenter === 'function') {
            window.renderActionCenter(confirmedReservations)
        }
        if (typeof window.calculateMonthlyMetrics === 'function') {
            window.calculateMonthlyMetrics()
        }
        if (typeof window.loadAIInsights === 'function') {
            window.loadAIInsights(confirmedReservations, properties)
        }
        if (typeof window.updateTopPropertiesStats === 'function') {
            window.updateTopPropertiesStats()
        }

        // ✨ Render Revenue Forecast Widget (Premium Feature)
        if (typeof window.renderRevenueForecast === 'function') {
            window.renderRevenueForecast()
        }

        // Restore saved filters
        setTimeout(() => {
            const savedFilters = loadFilterState('dashboard')
            if (savedFilters) {
                console.log('🔄 Restoring dashboard filters:', savedFilters)

                if (savedFilters.startDate && savedFilters.endDate) {
                    const startDateInput = document.getElementById('startDate')
                    const endDateInput = document.getElementById('endDate')

                    if (startDateInput) startDateInput.value = savedFilters.startDate
                    if (endDateInput) endDateInput.value = savedFilters.endDate

                    setTimeout(() => {
                        if (typeof window.applyDateRange === 'function') window.applyDateRange()
                    }, 200)
                }

                if (savedFilters.quickFilter && savedFilters.quickFilter !== 'all') {
                    setTimeout(() => applyQuickFilter(savedFilters.quickFilter), 300)
                }
            }
        }, 500)

    } catch (error) {
        console.error('Dashboard error:', error)
        showToast('Error', 'Failed to load dashboard', '❌')
    }
}

/**
 * Apply quick filter to dashboard
 */
export async function applyQuickFilter(filter) {
    currentQuickFilter = filter

    // Update UI
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active')
    })
    const chipElement = document.querySelector(`[data-filter="${filter}"]`)
    if (chipElement) chipElement.classList.add('active')

    // Get all reservations
    let filteredReservations = [...getAllReservations()]

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    // Apply filter logic
    switch(filter) {
        case 'next-7-days':
            const next7Days = new Date(today)
            next7Days.setDate(today.getDate() + 7)
            filteredReservations = filteredReservations.filter(r => {
                const checkIn = new Date(r.check_in)
                return checkIn >= today && checkIn <= next7Days && r.status !== 'cancelled'
            })
            updateFilterInfo(`📅 Next 7 Days (${filteredReservations.length} bookings)`)
            break

        case 'today':
            filteredReservations = filteredReservations.filter(r => {
                const checkIn = new Date(r.check_in)
                const checkOut = new Date(r.check_out)
                checkIn.setHours(0, 0, 0, 0)
                checkOut.setHours(0, 0, 0, 0)
                const todayCopy = new Date(today)
                todayCopy.setHours(0, 0, 0, 0)
                return (checkIn.getTime() === todayCopy.getTime() || checkOut.getTime() === todayCopy.getTime())
                    && r.status !== 'cancelled'
            })
            updateFilterInfo(`🏠 Today's Activity (${filteredReservations.length} check-ins/outs)`)
            break

        case 'payment-due':
            filteredReservations = filteredReservations.filter(r => {
                if (r.status === 'cancelled') return false
                const total = parseFloat(r.total_amount) || 0
                const paid = parseFloat(r.paid_amount) || 0
                const otaFee = parseFloat(r.ota_service_fee) || 0
                const isOTA = r.booking_source && r.booking_source !== 'DIRECT'
                const balance = isOTA ? ((total - otaFee) - paid) : (total - paid)
                return balance > 0
            })
            updateFilterInfo(`💰 Payment Due (${filteredReservations.length} with outstanding balance)`)
            break

        case 'this-month':
            filteredReservations = filteredReservations.filter(r => {
                const checkIn = new Date(r.check_in)
                return checkIn >= startOfMonth && checkIn <= endOfMonth
            })
            updateFilterInfo(`📆 This Month (${filteredReservations.length} bookings)`)
            break

        case 'needs-attention':
            filteredReservations = filteredReservations.filter(r => {
                if (r.status === 'cancelled') return false

                const checkInDate = new Date(r.check_in)
                checkInDate.setHours(0, 0, 0, 0)
                const total = parseFloat(r.total_amount) || 0
                const paid = parseFloat(r.paid_amount) || 0
                const otaFee = parseFloat(r.ota_service_fee) || 0
                const isOTA = r.booking_source && r.booking_source !== 'DIRECT'
                const balance = isOTA ? ((total - otaFee) - paid) : (total - paid)

                const tomorrow = new Date(today)
                tomorrow.setDate(today.getDate() + 1)

                const overduePayment = balance > 0 && checkInDate < today
                const soonCheckinUnpaid = (checkInDate.getTime() === today.getTime() ||
                                          checkInDate.getTime() === tomorrow.getTime()) && balance > 0
                const missingInfo = !r.guest_phone || !r.guest_email

                return overduePayment || soonCheckinUnpaid || missingInfo
            })
            updateFilterInfo(`⚠️ Needs Attention (${filteredReservations.length} items)`)
            break

        case 'all':
        default:
            updateFilterInfo('')
            break
    }

    // Update dashboard with filtered data
    await updateDashboardWithFilteredData(filteredReservations)

    // Save filter state
    saveFilterState('dashboard', {
        quickFilter: currentQuickFilter,
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || ''
    })
}

/**
 * Update dashboard with filtered data
 */
async function updateDashboardWithFilteredData(filteredReservations) {
    const confirmedReservations = filteredReservations.filter(r => r.status !== 'cancelled')

    // Calculate metrics
    const totalRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
    const totalOtaFees = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0)
    const netRevenue = totalRevenue - totalOtaFees
    const activeBookings = filteredReservations.filter(r => r.status === 'checked-in').length
    const upcomingBookings = filteredReservations.filter(r => r.status === 'confirmed').length
    const completedBookings = filteredReservations.filter(r => r.status === 'checked-out').length
    const avgBookingValue = confirmedReservations.length > 0 ? totalRevenue / confirmedReservations.length : 0

    // Update primary stats
    document.getElementById('totalReservations').textContent = filteredReservations.length
    document.getElementById('activeReservations').textContent = activeBookings
    document.getElementById('upcomingReservations').textContent = upcomingBookings
    document.getElementById('completedReservations').textContent = completedBookings
    document.getElementById('avgBookingValue').textContent = Math.round(avgBookingValue).toLocaleString('en-IN')

    // Calculate enhanced metrics
    const properties = await db.getProperties()
    const hostizzyRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0)
    const totalNights = confirmedReservations.reduce((sum, r) => sum + (r.nights || 0), 0)
    const targetNights = properties.length * TARGET_OCCUPANCY_NIGHTS
    const occupancyRate = targetNights > 0 ? ((totalNights / targetNights) * 100).toFixed(1) : 0

    // Update metrics cards (same HTML as loadDashboard)
    let enhancedHTML = `
        <div class="metric-card" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);">
            <div class="metric-icon">💰</div>
            <div class="metric-value">${formatCurrency(totalRevenue)}</div>
            <div class="metric-label">Total Revenue</div>
            <div class="metric-trend">From ${confirmedReservations.length} bookings</div>
        </div>`

    if (totalOtaFees > 0) {
        enhancedHTML += `
        <div class="metric-card" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
            <div class="metric-icon">🏢</div>
            <div class="metric-value">${formatCurrency(totalOtaFees)}</div>
            <div class="metric-label">OTA Fees</div>
            <div class="metric-trend">Commission deductions</div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            <div class="metric-icon">💵</div>
            <div class="metric-value">${formatCurrency(netRevenue)}</div>
            <div class="metric-label">Net Revenue</div>
            <div class="metric-trend">After OTA fees</div>
        </div>`
    }

    enhancedHTML += `
        <div class="metric-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            <div class="metric-icon">📊</div>
            <div class="metric-value">${occupancyRate}%</div>
            <div class="metric-label">Occupancy Rate</div>
            <div class="metric-trend">${totalNights}/${targetNights} nights booked</div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
            <div class="metric-icon">🏆</div>
            <div class="metric-value">${formatCurrency(hostizzyRevenue)}</div>
            <div class="metric-label">Hostizzy Revenue</div>
            <div class="metric-trend">${totalRevenue > 0 ? ((hostizzyRevenue/totalRevenue)*100).toFixed(1) : 0}% of total</div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
            <div class="metric-icon">📅</div>
            <div class="metric-value">${activeBookings}</div>
            <div class="metric-label">Active Now</div>
            <div class="metric-trend">${upcomingBookings} upcoming</div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);">
            <div class="metric-icon">👥</div>
            <div class="metric-value">${calculateTotalGuests(confirmedReservations)}</div>
            <div class="metric-label">Total Guests</div>
            <div class="metric-trend">${calculateUniqueGuests(confirmedReservations)} unique</div>
        </div>
        <div class="metric-card" style="background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);">
            <div class="metric-icon">👨‍👩‍👧‍👦</div>
            <div class="metric-value">${calculateAvgGroupSize(confirmedReservations)}</div>
            <div class="metric-label">Avg Group Size</div>
            <div class="metric-trend">Per booking</div>
        </div>
    `

    document.getElementById('enhancedMetrics').innerHTML = enhancedHTML

    // Re-render other components with filtered data
    if (typeof window.renderRevenueSplit === 'function') {
        window.renderRevenueSplit(getAllPayments(), confirmedReservations)
    }
    if (typeof window.renderActionCenter === 'function') {
        window.renderActionCenter(filteredReservations)
    }
    if (typeof window.calculateMonthlyMetricsFiltered === 'function') {
        window.calculateMonthlyMetricsFiltered(filteredReservations)
    }
    if (typeof window.loadAIInsights === 'function') {
        window.loadAIInsights(confirmedReservations, properties)
    }
}

/**
 * Update filter info banner
 */
export function updateFilterInfo(text) {
    const infoDiv = document.getElementById('activeFilterInfo')
    const textSpan = document.getElementById('activeFilterText')

    if (text) {
        if (textSpan) textSpan.textContent = text
        if (infoDiv) infoDiv.style.display = 'block'
    } else {
        if (infoDiv) infoDiv.style.display = 'none'
    }
}

/**
 * Clear dashboard filters
 */
export async function clearDashboardFilters() {
    clearFilterState('dashboard')

    document.getElementById('quickDateRange').value = ''
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active')
    })

    const allChip = document.querySelector('[data-filter="all"]')
    if (allChip) allChip.classList.add('active')

    updateFilterInfo('')
    currentQuickFilter = 'all'

    await loadDashboard()
}

// ==========================================
// MONTHLY COMPARISON
// ==========================================

/**
 * Calculate and display this month's performance with comparison to last month
 */
export function calculateMonthlyMetrics() {
    try {
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        // Update month label
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December']
        const monthLabel = document.getElementById('currentMonthLabel')
        if (monthLabel) monthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`

        const allReservations = getAllReservations()

        // Filter current month reservations (based on check-in date)
        const currentMonthReservations = allReservations.filter(r => {
            const checkIn = new Date(r.check_in)
            return checkIn.getMonth() === currentMonth && checkIn.getFullYear() === currentYear
        })

        // Filter last month reservations
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

        const lastMonthReservations = allReservations.filter(r => {
            const checkIn = new Date(r.check_in)
            return checkIn.getMonth() === lastMonth && checkIn.getFullYear() === lastMonthYear
        })

        // Calculate Nights
        const currentNights = currentMonthReservations.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0)
        const lastNights = lastMonthReservations.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0)
        const nightsChange = lastNights > 0 ? ((currentNights - lastNights) / lastNights * 100) : 0

        // Calculate Revenue
        const currentRevenue = currentMonthReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        const lastRevenue = lastMonthReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        const revenueChange = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 0

        // Calculate Hostizzy Revenue
        const currentHostizzy = currentMonthReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0)
        const lastHostizzy = lastMonthReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0)
        const hostizzyChange = lastHostizzy > 0 ? ((currentHostizzy - lastHostizzy) / lastHostizzy * 100) : 0

        // Update UI - Nights
        const monthNights = document.getElementById('monthNights')
        if (monthNights) monthNights.textContent = currentNights
        updateTrendDisplay('monthNightsChange', nightsChange)

        // Update UI - Revenue
        const monthRevenue = document.getElementById('monthRevenue')
        if (monthRevenue) {
            if (currentRevenue >= 100000) {
                monthRevenue.textContent = '₹' + (currentRevenue / 100000).toFixed(2) + 'L'
            } else {
                monthRevenue.textContent = '₹' + (currentRevenue / 1000).toFixed(1) + 'K'
            }
        }
        updateTrendDisplay('monthRevenueChange', revenueChange)

        // Update UI - Hostizzy Revenue
        const monthHostizzyRevenue = document.getElementById('monthHostizzyRevenue')
        if (monthHostizzyRevenue) {
            if (currentHostizzy >= 100000) {
                monthHostizzyRevenue.textContent = '₹' + (currentHostizzy / 100000).toFixed(2) + 'L'
            } else {
                monthHostizzyRevenue.textContent = '₹' + (currentHostizzy / 1000).toFixed(1) + 'K'
            }
        }
        updateTrendDisplay('monthHostizzyChange', hostizzyChange)

    } catch (error) {
        console.error('Error calculating monthly metrics:', error)
    }
}

/**
 * Update trend display with arrows and colors
 */
export function updateTrendDisplay(elementId, changePercent) {
    const el = document.getElementById(elementId)
    if (!el) return

    const arrow = el.querySelector('.trend-arrow')
    const value = el.querySelector('.trend-value')

    if (!arrow || !value) return

    const change = parseFloat(changePercent)

    if (change > 0) {
        arrow.textContent = '↑'
        arrow.className = 'trend-arrow trend-up'
        value.textContent = '+' + Math.abs(change).toFixed(1) + '%'
    } else if (change < 0) {
        arrow.textContent = '↓'
        arrow.className = 'trend-arrow trend-down'
        value.textContent = '-' + Math.abs(change).toFixed(1) + '%'
    } else {
        arrow.textContent = '→'
        arrow.className = 'trend-arrow trend-neutral'
        value.textContent = '0%'
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.loadDashboard = loadDashboard
    window.applyQuickFilter = applyQuickFilter
    window.updateFilterInfo = updateFilterInfo
    window.clearDashboardFilters = clearDashboardFilters
    window.calculateMonthlyMetrics = calculateMonthlyMetrics
    window.updateTrendDisplay = updateTrendDisplay
}

console.log('✅ Dashboard module loaded')
