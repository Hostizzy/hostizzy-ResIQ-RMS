/**
 * Analytics Module
 * Handles charts, reports, trends, and data visualizations
 */

import { formatCurrency, formatDate } from './utils.js'

// ==========================================
// ANALYTICS STATE
// ==========================================

let currentSortBy = 'revenue'

// Access global state
function getState() {
    return window.state || {}
}

// ==========================================
// CHART RENDERING FUNCTIONS
// ==========================================

/**
 * Render payment method distribution chart
 */
export function renderPaymentMethodChart(payments, targetElementId = 'paymentMethodChart') {
    const methods = {}

    payments.forEach(p => {
        const method = p.payment_method || 'unknown'
        if (!methods[method]) {
            methods[method] = { count: 0, amount: 0 }
        }
        methods[method].count += 1
        methods[method].amount += parseFloat(p.amount) || 0
    })

    const sortedMethods = Object.entries(methods).sort((a, b) => b[1].amount - a[1].amount)
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const colors = { cash: '#10b981', upi: '#3b82f6', gateway: '#8b5cf6', bank_transfer: '#f59e0b' }
    const icons = { cash: '💵', upi: '📱', gateway: '💳', bank_transfer: '🏦' }

    const html = sortedMethods.length > 0 ? sortedMethods.map(([method, data]) => {
        const percentage = totalAmount > 0 ? ((data.amount / totalAmount) * 100).toFixed(1) : 0
        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 14px;">${icons[method] || '💳'} ${method.replace('_', ' ').toUpperCase()}</span>
                    <span style="font-weight: 700;">₹${(data.amount/1000).toFixed(1)}K (${percentage}%)</span>
                </div>
                <div style="background: var(--background); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: ${colors[method] || '#6b7280'}; transition: width 0.3s;"></div>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${data.count} transactions</div>
            </div>
        `
    }).join('') : '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No payment data available</div>'

    const element = document.getElementById(targetElementId)
    if (element) {
        element.innerHTML = html
    }
}

/**
 * Render channel/source distribution
 */
export function renderChannelDistribution(reservations, targetElementId = 'channelDistribution') {
    const channels = {}

    reservations.forEach(r => {
        const source = r.booking_source || 'DIRECT'
        if (!channels[source]) {
            channels[source] = { count: 0, revenue: 0, nights: 0 }
        }
        channels[source].count += 1
        channels[source].revenue += parseFloat(r.total_amount) || 0
        channels[source].nights += r.nights || 0
    })

    const sortedChannels = Object.entries(channels).sort((a, b) => b[1].revenue - a[1].revenue)
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)

    const channelIcons = {
        'DIRECT': '🏠',
        'AIRBNB': '🏡',
        'BOOKING.COM': '🌐',
        'MMT': '✈️',
        'GOIBIBO': '🎫',
        'AGODA': '🗺️'
    }

    const html = sortedChannels.length > 0 ? sortedChannels.map(([channel, data]) => {
        const percentage = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : 0
        const countPercentage = reservations.length > 0 ? ((data.count / reservations.length) * 100).toFixed(1) : 0

        return `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">${channelIcons[channel] || '📊'}</span>
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">${channel}</div>
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                ${data.count} bookings (${countPercentage}%) • ${data.nights} nights
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; font-size: 18px; color: var(--success);">${formatCurrency(data.revenue)}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${percentage}% of revenue</div>
                    </div>
                </div>
                <div style="background: var(--background); height: 12px; border-radius: 6px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.5s;"></div>
                </div>
            </div>
        `
    }).join('') : '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No booking data available</div>'

    const element = document.getElementById(targetElementId)
    if (element) {
        element.innerHTML = html
    }
}

/**
 * Render booking type breakdown
 */
export function renderBookingTypeBreakdown(reservations, targetId) {
    const bookingTypes = {}

    reservations.forEach(r => {
        const type = r.booking_type || 'STAYCATION'
        if (!bookingTypes[type]) bookingTypes[type] = { count: 0, revenue: 0, nights: 0 }
        bookingTypes[type].count++
        bookingTypes[type].revenue += parseFloat(r.total_amount) || 0
        bookingTypes[type].nights += r.nights || 0
    })

    const sortedTypes = Object.entries(bookingTypes).sort((a, b) => b[1].revenue - a[1].revenue)
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
    const totalCount = reservations.length

    const target = document.getElementById(targetId)
    if (!target) return

    if (sortedTypes.length === 0) {
        target.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">No booking data available</div>'
        return
    }

    const BOOKING_TYPES = window.BOOKING_TYPES || {}
    const html = sortedTypes.map(([type, data]) => {
        const percentage = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : 0
        const countPercentage = totalCount > 0 ? ((data.count / totalCount) * 100).toFixed(1) : 0
        const typeInfo = BOOKING_TYPES[type] || { label: type, icon: '📋' }
        const avgBookingValue = data.count > 0 ? data.revenue / data.count : 0

        return `
        <div style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:24px;">${typeInfo.icon}</span>
                <div>
                <div style="font-weight:600;font-size:15px;">${typeInfo.label}</div>
                <div style="font-size:12px;color:var(--text-secondary);">
                    ${data.count} bookings (${countPercentage}%) • ${data.nights} nights • Avg: ₹${Math.round(avgBookingValue).toLocaleString('en-IN')}
                </div>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:700;font-size:18px;color:var(--success);">₹${(data.revenue/100000).toFixed(1)}L</div>
                <div style="font-size:12px;color:var(--text-secondary);">${percentage}% of revenue</div>
            </div>
            </div>
            <div style="background:var(--background);height:12px;border-radius:6px;overflow:hidden;">
            <div style="width:${percentage}%;height:100%;background:linear-gradient(90deg,#10b981,#059669);transition:width .5s;"></div>
            </div>
        </div>`
    }).join('')

    target.innerHTML = html
}

/**
 * Sort and render top properties stats
 */
export function sortPropertiesBy(sortType, filteredReservations = null) {
    currentSortBy = sortType

    // Update button styles
    document.getElementById('sortByRevenue').style.background = sortType === 'revenue' ? 'var(--primary)' : 'var(--secondary)'
    document.getElementById('sortByBookings').style.background = sortType === 'bookings' ? 'var(--primary)' : 'var(--secondary)'
    document.getElementById('sortByNights').style.background = sortType === 'nights' ? 'var(--primary)' : 'var(--secondary)'
    document.getElementById('sortByGuests').style.background = sortType === 'guests' ? 'var(--primary)' : 'var(--secondary)'
    document.getElementById('sortByOccupancy').style.background = sortType === 'occupancy' ? 'var(--primary)' : 'var(--secondary)'

    const state = getState()
    const properties = state.properties || []

    if (properties.length === 0) {
        document.getElementById('topPropertiesStats').innerHTML =
            '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No properties found</div>'
        return
    }

    const reservationsToUse = filteredReservations || state.reservations || []

    // Calculate stats for each property
    const propertyStats = properties.map(property => {
        const propertyReservations = reservationsToUse.filter(r =>
            r.property_id === property.id && r.status !== 'cancelled'
        )

        const totalRevenue = propertyReservations.reduce((sum, r) =>
            sum + (parseFloat(r.total_amount) || 0), 0
        )

        const totalBookings = propertyReservations.length
        const totalNights = propertyReservations.reduce((sum, r) =>
            sum + (parseInt(r.nights) || 0), 0
        )

        const totalGuests = propertyReservations.reduce((sum, r) => {
            const adults = parseInt(r.adults) || 0
            const kids = parseInt(r.kids) || 0
            return sum + adults + kids
        }, 0)

        // Occupancy calculation (last 90 days)
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        const recentReservations = propertyReservations.filter(r =>
            new Date(r.check_in) >= ninetyDaysAgo
        )
        const recentNights = recentReservations.reduce((sum, r) => sum + (r.nights || 0), 0)
        const occupancyRate = (recentNights / 90 * 100).toFixed(1)

        return {
            property,
            totalRevenue,
            totalBookings,
            totalNights,
            totalGuests,
            occupancyRate: parseFloat(occupancyRate)
        }
    })

    // Sort based on selected criteria
    propertyStats.sort((a, b) => {
        switch (sortType) {
            case 'revenue': return b.totalRevenue - a.totalRevenue
            case 'bookings': return b.totalBookings - a.totalBookings
            case 'nights': return b.totalNights - a.totalNights
            case 'guests': return b.totalGuests - a.totalGuests
            case 'occupancy': return b.occupancyRate - a.occupancyRate
            default: return b.totalRevenue - a.totalRevenue
        }
    })

    // Render top 15 properties
    const top15 = propertyStats.slice(0, 15)
    const html = top15.map((stat, index) => {
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`

        return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--background);border-radius:8px;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:12px;flex:1;">
                    <span style="font-size:20px;width:32px;">${rankIcon}</span>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:15px;">${stat.property.name}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">
                            ${stat.totalBookings} bookings • ${stat.totalNights} nights • ${stat.totalGuests} guests
                        </div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700;font-size:16px;color:var(--success);">${formatCurrency(stat.totalRevenue)}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${stat.occupancyRate}% occupancy</div>
                </div>
            </div>
        `
    }).join('')

    document.getElementById('topPropertiesStats').innerHTML = html
}

/**
 * Update top properties stats (wrapper)
 */
export function updateTopPropertiesStats(filteredReservations = null) {
    sortPropertiesBy(currentSortBy, filteredReservations)
}

// ==========================================
// PERFORMANCE VIEW INITIALIZATION
// ==========================================

/**
 * Initialize Performance/Analytics View
 */
export async function initializePerformanceView() {
    try {
        const { db } = await import('./database.js')
        const { showToast } = await import('./ui.js')

        // Get data
        const properties = await db.getProperties()
        const reservations = await db.getReservations()
        const payments = await db.getAllPayments()

        // Store in window.state if needed
        if (!window.state.properties) window.state.properties = properties
        if (!window.state.reservations) window.state.reservations = reservations
        if (!window.state.payments) window.state.payments = payments

        // Populate property dropdown
        const propertyFilter = document.getElementById('performancePropertyFilter')
        if (propertyFilter) {
            propertyFilter.innerHTML = '<option value="">🏠 All Properties</option>' +
                properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
        }

        // Set default date range to current year
        const today = new Date()
        const startDateInput = document.getElementById('performanceStartDate')
        const endDateInput = document.getElementById('performanceEndDate')

        if (startDateInput && endDateInput) {
            startDateInput.value = `${today.getFullYear()}-01-01`
            endDateInput.value = today.toISOString().split('T')[0]
        }

        // Filter active reservations (non-cancelled)
        const activeReservations = reservations.filter(r => r.status !== 'cancelled')

        // Render all analytics
        renderPaymentMethodChart(payments, 'performancePaymentMethods')
        renderChannelDistribution(activeReservations, 'performanceChannels')
        renderBookingTypeBreakdown(activeReservations, 'performanceBookingTypes')
        sortPropertiesBy('revenue', activeReservations)

        console.log('✅ Performance view initialized with', {
            properties: properties.length,
            reservations: activeReservations.length,
            payments: payments.length
        })

    } catch (error) {
        console.error('Performance initialization error:', error)
        const { showToast } = await import('./ui.js')
        showToast('Error', 'Failed to initialize performance view', '❌')
    }
}

/**
 * Load property performance data (called when filters change)
 */
export async function loadPropertyPerformance() {
    try {
        const propertyId = document.getElementById('performancePropertyFilter')?.value
        const { db } = await import('./database.js')

        // Get all reservations
        let reservations = await db.getReservations()
        const payments = await db.getAllPayments()

        // Filter by property if selected
        if (propertyId) {
            reservations = reservations.filter(r => r.property_id == propertyId)
        }

        // Filter out cancelled
        const activeReservations = reservations.filter(r => r.status !== 'cancelled')

        // Re-render all analytics with filtered data
        renderPaymentMethodChart(payments, 'performancePaymentMethods')
        renderChannelDistribution(activeReservations, 'performanceChannels')
        renderBookingTypeBreakdown(activeReservations, 'performanceBookingTypes')
        sortPropertiesBy(currentSortBy, activeReservations)

    } catch (error) {
        console.error('Performance load error:', error)
        const { showToast } = await import('./ui.js')
        showToast('Error', 'Failed to load performance data', '❌')
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.renderPaymentMethodChart = renderPaymentMethodChart
    window.renderChannelDistribution = renderChannelDistribution
    window.renderBookingTypeBreakdown = renderBookingTypeBreakdown
    window.sortPropertiesBy = sortPropertiesBy
    window.updateTopPropertiesStats = updateTopPropertiesStats
    window.initializePerformanceView = initializePerformanceView
    window.loadPropertyPerformance = loadPropertyPerformance
}

console.log('✅ Analytics module loaded')
