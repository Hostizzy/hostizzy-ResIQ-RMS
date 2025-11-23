/**
 * Home Module
 * Handles home screen statistics, recent activity, and greeting
 */

import { db } from './database.js'
import { calculateUniqueGuests } from './guests.js'

// ==========================================
// HOME SCREEN STATS
// ==========================================

/**
 * Update greeting based on time of day
 */
export function updateGreeting() {
    const hour = new Date().getHours()
    const greetingTextEl = document.getElementById('greetingText')
    const greetingUserEl = document.getElementById('greetingUser')

    if (!greetingTextEl) return

    let greeting = ''
    if (hour < 12) {
        greeting = 'Good Morning'
    } else if (hour < 17) {
        greeting = 'Good Afternoon'
    } else {
        greeting = 'Good Evening'
    }

    greetingTextEl.textContent = greeting

    // Update user name if logged in
    const currentUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || 'null')
    if (currentUser && currentUser.email && greetingUserEl) {
        const userName = currentUser.email.split('@')[0]
        greetingUserEl.textContent = `Welcome, ${userName}!`
    }
}

/**
 * Update home screen statistics
 */
export async function updateHomeScreenStats() {
    try {
        // Update greeting
        updateGreeting()

        // Ensure we have data
        if (!window.state.reservations || window.state.reservations.length === 0) {
            // Load data if not available
            window.state.reservations = await db.getReservations()
            window.state.properties = await db.getProperties()
            window.state.payments = await db.getAllPayments()
        }

        const allReservations = window.state.reservations || []
        const allProperties = window.state.properties || []

        // Calculate stats
        const totalReservations = allReservations.length
        const activeReservations = allReservations.filter(r =>
            r.status === 'confirmed' || r.status === 'checked-in'
        ).length

        const upcomingReservations = allReservations.filter(r => {
            const checkIn = new Date(r.check_in)
            const today = new Date()
            return checkIn > today && r.status === 'confirmed'
        }).length

        const pendingPayments = allReservations.filter(r =>
            r.payment_status === 'pending' || r.payment_status === 'partial'
        ).length

        const totalProperties = allProperties.length

        // Calculate this month's revenue
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const thisMonthRevenue = allReservations
            .filter(r => new Date(r.created_at) >= firstDay)
            .reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0)

        // Update UI - with safe checks
        const homeStatReservations = document.getElementById('homeStatReservations')
        const homeStatActive = document.getElementById('homeStatActive')
        const homeStatPending = document.getElementById('homeStatPending')
        const homeStatUpcoming = document.getElementById('homeStatUpcoming')
        const homeStatProperties = document.getElementById('homeStatProperties')
        const homeStatGuests = document.getElementById('homeStatGuests')
        const homeStatRevenue = document.getElementById('homeStatRevenue')

        if (homeStatReservations) homeStatReservations.textContent = totalReservations
        if (homeStatActive) homeStatActive.textContent = activeReservations
        if (homeStatPending) homeStatPending.textContent = pendingPayments
        if (homeStatUpcoming) homeStatUpcoming.textContent = upcomingReservations
        if (homeStatProperties) homeStatProperties.textContent = totalProperties
        if (homeStatGuests) homeStatGuests.textContent = calculateUniqueGuests(allReservations)
        if (homeStatRevenue) homeStatRevenue.textContent = '₹' + Math.round(thisMonthRevenue / 1000) + 'K'

        // Update recent activity
        updateRecentActivity()

    } catch (error) {
        console.error('Error updating home screen:', error)
        // Set default values on error
        const homeStatReservations = document.getElementById('homeStatReservations')
        const homeStatActive = document.getElementById('homeStatActive')
        const homeStatPending = document.getElementById('homeStatPending')
        const homeStatUpcoming = document.getElementById('homeStatUpcoming')
        const homeStatProperties = document.getElementById('homeStatProperties')
        const homeStatGuests = document.getElementById('homeStatGuests')
        const homeStatRevenue = document.getElementById('homeStatRevenue')

        if (homeStatReservations) homeStatReservations.textContent = '0'
        if (homeStatActive) homeStatActive.textContent = '0'
        if (homeStatPending) homeStatPending.textContent = '0'
        if (homeStatUpcoming) homeStatUpcoming.textContent = '0'
        if (homeStatProperties) homeStatProperties.textContent = '0'
        if (homeStatGuests) homeStatGuests.textContent = '0'
        if (homeStatRevenue) homeStatRevenue.textContent = '₹0'
    }
}

/**
 * Update recent activity feed
 */
export function updateRecentActivity() {
    const activityList = document.getElementById('recentActivityList')

    if (!activityList) return

    const allReservations = window.state.reservations || []

    // Get recent reservations (last 5)
    const recentReservations = allReservations
        .slice() // copy before sort
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)

    if (recentReservations.length === 0) {
        activityList.innerHTML = '<div style="color: #94a3b8; font-style: italic;">No recent activity</div>'
        return
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">'

    recentReservations.forEach(r => {
        const timeAgo = getTimeAgo(new Date(r.created_at))
        const statusColor = r.payment_status === 'paid' ? '#10b981' : '#f59e0b'
        const statusIcon = r.payment_status === 'paid' ? '✅' : '⏳'

        html += `
            <div style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: #f8fafc;
                border-radius: 8px;
                cursor: pointer;
            " onclick="showView('reservations')">
                <div style="font-size: 24px;">${statusIcon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px;">
                        ${r.guest_name}
                    </div>
                    <div style="font-size: 12px; color: #64748b;">
                        ${r.property_name} • ${timeAgo}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; color: ${statusColor};">
                        ₹${Math.round(r.total_amount).toLocaleString('en-IN')}
                    </div>
                    <div style="font-size: 11px; color: #64748b; text-transform: capitalize;">
                        ${r.payment_status}
                    </div>
                </div>
            </div>
        `
    })

    html += '</div>'
    activityList.innerHTML = html
}

/**
 * Get time ago string
 */
export function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000)

    let interval = seconds / 31536000
    if (interval > 1) return Math.floor(interval) + ' years ago'

    interval = seconds / 2592000
    if (interval > 1) return Math.floor(interval) + ' months ago'

    interval = seconds / 86400
    if (interval > 1) return Math.floor(interval) + ' days ago'

    interval = seconds / 3600
    if (interval > 1) return Math.floor(interval) + ' hours ago'

    interval = seconds / 60
    if (interval > 1) return Math.floor(interval) + ' minutes ago'

    return 'just now'
}

/**
 * Load initial data for the app
 */
export async function loadInitialData() {
    try {
        if (!window.state.reservations || window.state.reservations.length === 0) {
            console.log('📥 Loading initial data...')
            window.state.reservations = await db.getReservations()
            window.state.properties = await db.getProperties()
            window.state.payments = await db.getAllPayments()
            console.log('✅ Initial data loaded')
        }
    } catch (error) {
        console.error('Error loading initial data:', error)
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.updateHomeScreenStats = updateHomeScreenStats
    window.updateRecentActivity = updateRecentActivity
    window.updateGreeting = updateGreeting
    window.getTimeAgo = getTimeAgo
    window.loadInitialData = loadInitialData
}

console.log('✅ Home module loaded')
