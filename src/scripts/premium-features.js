/**
 * Premium Features - Theme Selector, Notifications, Calendar, Forecasting
 */

// ============================================
// COLOR THEME SELECTOR
// ============================================

const colorThemes = {
    indigo: {
        name: 'Indigo (Default)',
        primary: '#6366F1',
        secondary: '#EC4899',
        accent: '#14B8A6',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    ocean: {
        name: 'Ocean Blue',
        primary: '#0EA5E9',
        secondary: '#06B6D4',
        accent: '#8B5CF6',
        gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)'
    },
    forest: {
        name: 'Forest Green',
        primary: '#10B981',
        secondary: '#059669',
        accent: '#34D399',
        gradient: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)'
    },
    sunset: {
        name: 'Sunset Orange',
        primary: '#F59E0B',
        secondary: '#EF4444',
        accent: '#F97316',
        gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    },
    purple: {
        name: 'Royal Purple',
        primary: '#8B5CF6',
        secondary: '#A855F7',
        accent: '#C084FC',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    rose: {
        name: 'Rose Pink',
        primary: '#F43F5E',
        secondary: '#EC4899',
        accent: '#F472B6',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    }
}

export function initThemeSelector() {
    createThemeSelectorUI()
    loadSavedColorTheme()
    console.log('✅ Theme Selector initialized')
}

function createThemeSelectorUI() {
    const html = `
        <div id="themeSelector" class="theme-selector hidden">
            <div class="theme-selector-backdrop" onclick="closeThemeSelector()"></div>
            <div class="theme-selector-panel glass-strong animate-slideInUp">
                <div class="theme-selector-header">
                    <h3 class="theme-selector-title">Choose Your Color Theme</h3>
                    <button class="modal-close" onclick="closeThemeSelector()">✕</button>
                </div>
                <div class="theme-selector-body" id="themeSelectorBody">
                    <!-- Themes will be rendered here -->
                </div>
            </div>
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', html)
}

export function openThemeSelector() {
    const selector = document.getElementById('themeSelector')
    if (selector) {
        selector.classList.remove('hidden')
        renderThemeOptions()
    }
}

export function closeThemeSelector() {
    const selector = document.getElementById('themeSelector')
    if (selector) {
        selector.classList.add('hidden')
    }
}

function renderThemeOptions() {
    const body = document.getElementById('themeSelectorBody')
    const currentTheme = localStorage.getItem('colorTheme') || 'indigo'

    let html = '<div class="theme-grid">'

    for (const [key, theme] of Object.entries(colorThemes)) {
        const activeClass = key === currentTheme ? 'active' : ''
        html += `
            <div class="theme-option ${activeClass}" onclick="applyColorTheme('${key}')">
                <div class="theme-preview" style="background: ${theme.gradient}"></div>
                <div class="theme-name">${theme.name}</div>
                <div class="theme-colors">
                    <div class="theme-color-dot" style="background: ${theme.primary}"></div>
                    <div class="theme-color-dot" style="background: ${theme.secondary}"></div>
                    <div class="theme-color-dot" style="background: ${theme.accent}"></div>
                </div>
                ${key === currentTheme ? '<div class="theme-check">✓</div>' : ''}
            </div>
        `
    }

    html += '</div>'
    body.innerHTML = html
}

export function applyColorTheme(themeName) {
    const theme = colorThemes[themeName]
    if (!theme) return

    const root = document.documentElement

    // Apply CSS custom properties
    root.style.setProperty('--brand-primary', theme.primary)
    root.style.setProperty('--brand-secondary', theme.secondary)
    root.style.setProperty('--brand-accent', theme.accent)
    root.style.setProperty('--gradient-primary', theme.gradient)

    // Save to localStorage
    localStorage.setItem('colorTheme', themeName)

    // Show toast
    if (typeof window.showToast === 'function') {
        window.showToast('Theme Applied', `${theme.name} theme activated!`, '🎨')
    }

    // Re-render to show active state
    renderThemeOptions()
}

function loadSavedColorTheme() {
    const savedTheme = localStorage.getItem('colorTheme') || 'indigo'
    const theme = colorThemes[savedTheme]

    if (theme) {
        const root = document.documentElement
        root.style.setProperty('--brand-primary', theme.primary)
        root.style.setProperty('--brand-secondary', theme.secondary)
        root.style.setProperty('--brand-accent', theme.accent)
        root.style.setProperty('--gradient-primary', theme.gradient)
    }
}

// ============================================
// NOTIFICATION CENTER
// ============================================

let notifications = []

export function initNotificationCenter() {
    createNotificationCenterUI()
    loadNotifications()
    console.log('✅ Notification Center initialized')
}

function createNotificationCenterUI() {
    const html = `
        <div id="notificationCenter" class="notification-center">
            <div class="notification-center-header">
                <h3 class="notification-center-title">Notifications</h3>
                <div class="notification-center-actions">
                    <button class="btn-icon" onclick="markAllAsRead()" title="Mark all as read">
                        <span>✓</span>
                    </button>
                    <button class="modal-close" onclick="toggleNotificationCenter()">✕</button>
                </div>
            </div>
            <div class="notification-center-body" id="notificationCenterBody">
                <!-- Notifications will be rendered here -->
            </div>
        </div>

        <!-- Notification Bell Button -->
        <button class="notification-bell" onclick="toggleNotificationCenter()" id="notificationBell">
            🔔
            <span class="notification-badge hidden" id="notificationBadge">0</span>
        </button>
    `

    document.body.insertAdjacentHTML('beforeend', html)
}

export function toggleNotificationCenter() {
    const center = document.getElementById('notificationCenter')
    if (center) {
        center.classList.toggle('active')
        if (center.classList.contains('active')) {
            renderNotifications()
        }
    }
}

function renderNotifications() {
    const body = document.getElementById('notificationCenterBody')

    if (notifications.length === 0) {
        body.innerHTML = `
            <div class="empty-state" style="padding: var(--space-12) var(--space-6);">
                <div class="empty-state-icon">🔔</div>
                <div class="empty-state-title">No notifications</div>
                <div class="empty-state-description">You're all caught up!</div>
            </div>
        `
        return
    }

    let html = ''
    notifications.forEach(notif => {
        const unreadClass = notif.read ? '' : 'unread'
        html += `
            <div class="notification-item ${unreadClass}" onclick="handleNotificationClick('${notif.id}')">
                <div class="notification-icon" style="background: ${notif.color || 'var(--bg-secondary)'}">
                    ${notif.icon}
                </div>
                <div style="flex: 1;">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-description">${notif.description}</div>
                    <div class="notification-time">${notif.time}</div>
                </div>
            </div>
        `
    })

    body.innerHTML = html
    updateNotificationBadge()
}

function loadNotifications() {
    // Sample notifications - in production, fetch from backend
    notifications = [
        {
            id: '1',
            icon: '💰',
            title: 'Payment Received',
            description: 'New payment of ₹15,000 for Booking #1234',
            time: '2 hours ago',
            read: false,
            color: 'rgba(16, 185, 129, 0.2)'
        },
        {
            id: '2',
            icon: '📅',
            title: 'New Reservation',
            description: 'Ramesh Kumar booked Villa Sunset for 3 nights',
            time: '5 hours ago',
            read: false,
            color: 'rgba(99, 102, 241, 0.2)'
        },
        {
            id: '3',
            icon: '🏠',
            title: 'Check-out Reminder',
            description: 'Guest checking out from Beach House today',
            time: '1 day ago',
            read: true,
            color: 'rgba(245, 158, 11, 0.2)'
        }
    ]

    updateNotificationBadge()
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge')
    const unreadCount = notifications.filter(n => !n.read).length

    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount
            badge.classList.remove('hidden')
        } else {
            badge.classList.add('hidden')
        }
    }
}

export function handleNotificationClick(id) {
    const notif = notifications.find(n => n.id === id)
    if (notif && !notif.read) {
        notif.read = true
        renderNotifications()
    }
}

export function markAllAsRead() {
    notifications.forEach(n => n.read = true)
    renderNotifications()
    if (typeof window.showToast === 'function') {
        window.showToast('All Clear', 'All notifications marked as read', '✓')
    }
}

export function addNotification(icon, title, description) {
    const newNotif = {
        id: Date.now().toString(),
        icon,
        title,
        description,
        time: 'Just now',
        read: false,
        color: 'rgba(99, 102, 241, 0.2)'
    }

    notifications.unshift(newNotif)
    updateNotificationBadge()

    // Show toast
    if (typeof window.showToast === 'function') {
        window.showToast(title, description, icon)
    }
}

// ============================================
// CALENDAR VIEW FOR BOOKINGS
// ============================================

export function initCalendarView() {
    console.log('✅ Calendar View initialized')
}

export function renderCalendar(year, month) {
    const calendarEl = document.getElementById('bookingCalendar')
    if (!calendarEl) return

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December']

    let html = `
        <div class="calendar-header">
            <button class="btn-icon" onclick="changeCalendarMonth(-1)">‹</button>
            <h3 class="calendar-title">${monthNames[month]} ${year}</h3>
            <button class="btn-icon" onclick="changeCalendarMonth(1)">›</button>
        </div>
        <div class="calendar-grid">
            <div class="calendar-day-header">Sun</div>
            <div class="calendar-day-header">Mon</div>
            <div class="calendar-day-header">Tue</div>
            <div class="calendar-day-header">Wed</div>
            <div class="calendar-day-header">Thu</div>
            <div class="calendar-day-header">Fri</div>
            <div class="calendar-day-header">Sat</div>
    `

    // Empty cells before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-day empty"></div>'
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const bookings = getBookingsForDate(dateStr)
        const isToday = isDateToday(year, month, day)
        const todayClass = isToday ? 'today' : ''

        html += `
            <div class="calendar-day ${todayClass}" onclick="showDateBookings('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${bookings.length > 0 ? `<div class="calendar-day-dots">${renderBookingDots(bookings)}</div>` : ''}
            </div>
        `
    }

    html += '</div>'
    calendarEl.innerHTML = html
}

function getBookingsForDate(dateStr) {
    const reservations = window.state?.reservations || []
    return reservations.filter(r => {
        const checkIn = r.check_in
        const checkOut = r.check_out
        return dateStr >= checkIn && dateStr <= checkOut
    })
}

function isDateToday(year, month, day) {
    const today = new Date()
    return today.getFullYear() === year &&
           today.getMonth() === month &&
           today.getDate() === day
}

function renderBookingDots(bookings) {
    const maxDots = 3
    let html = ''
    const statusColors = {
        'confirmed': '#10B981',
        'pending': '#F59E0B',
        'checked-in': '#6366F1',
        'checked-out': '#6B7280',
        'cancelled': '#EF4444'
    }

    for (let i = 0; i < Math.min(bookings.length, maxDots); i++) {
        const color = statusColors[bookings[i].status] || '#6B7280'
        html += `<div class="booking-dot" style="background: ${color}"></div>`
    }

    if (bookings.length > maxDots) {
        html += `<div class="booking-dot more">+${bookings.length - maxDots}</div>`
    }

    return html
}

export function showDateBookings(dateStr) {
    const bookings = getBookingsForDate(dateStr)

    if (bookings.length === 0) {
        if (typeof window.showToast === 'function') {
            window.showToast('No Bookings', `No bookings on ${dateStr}`, 'ℹ️')
        }
        return
    }

    // Show modal with bookings for this date
    let html = `
        <div class="modal active" onclick="if(event.target === this) this.classList.remove('active')">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title">Bookings on ${dateStr}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').classList.remove('active')">✕</button>
                </div>
                <div class="modal-body">
    `

    bookings.forEach(booking => {
        html += `
            <div class="booking-card" style="margin-bottom: 16px; padding: 16px; background: var(--bg-secondary); border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: 600; font-size: 16px; color: var(--text-primary);">${booking.guest_name}</div>
                        <div style="font-size: 14px; color: var(--text-secondary);">${booking.property_name}</div>
                    </div>
                    <span class="badge badge-${booking.status}">${booking.status}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px; color: var(--text-secondary);">
                    <div>📅 Check-in: ${booking.check_in}</div>
                    <div>📅 Check-out: ${booking.check_out}</div>
                    <div>🌙 ${booking.nights} nights</div>
                    <div>💰 ₹${Math.round(booking.total_amount).toLocaleString('en-IN')}</div>
                </div>
            </div>
        `
    })

    html += `
                </div>
                <div class="modal-footer">
                    <button class="btn-premium-primary" onclick="this.closest('.modal').classList.remove('active')">Close</button>
                </div>
            </div>
        </div>
    `

    const existingModal = document.querySelector('.modal.active')
    if (existingModal) existingModal.remove()

    document.body.insertAdjacentHTML('beforeend', html)
}

let currentCalendarMonth = new Date().getMonth()
let currentCalendarYear = new Date().getFullYear()

export function changeCalendarMonth(direction) {
    currentCalendarMonth += direction

    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0
        currentCalendarYear++
    } else if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11
        currentCalendarYear--
    }

    renderCalendar(currentCalendarYear, currentCalendarMonth)
}

// ============================================
// REVENUE FORECASTING
// ============================================

export function initRevenueForecasting() {
    console.log('✅ Revenue Forecasting initialized')
}

export function calculateRevenueForecast() {
    const reservations = window.state?.reservations || []

    if (reservations.length === 0) {
        return {
            nextMonth: 0,
            confidence: 0,
            trend: 'stable'
        }
    }

    // Get last 3 months of revenue
    const now = new Date()
    const monthlyRevenue = []

    for (let i = 2; i >= 0; i--) {
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStr = targetMonth.toISOString().slice(0, 7) // YYYY-MM

        const revenue = reservations
            .filter(r => r.check_in && r.check_in.startsWith(monthStr))
            .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)

        monthlyRevenue.push(revenue)
    }

    // Simple linear regression forecast
    const avgRevenue = monthlyRevenue.reduce((a, b) => a + b, 0) / monthlyRevenue.length

    // Calculate trend
    const lastMonth = monthlyRevenue[monthlyRevenue.length - 1]
    const secondLastMonth = monthlyRevenue[monthlyRevenue.length - 2]

    let trend = 'stable'
    let nextMonthForecast = lastMonth

    if (lastMonth > secondLastMonth * 1.1) {
        trend = 'up'
        nextMonthForecast = lastMonth * 1.15
    } else if (lastMonth < secondLastMonth * 0.9) {
        trend = 'down'
        nextMonthForecast = lastMonth * 0.85
    } else {
        nextMonthForecast = avgRevenue
    }

    // Calculate confidence based on data consistency
    const variance = monthlyRevenue.reduce((sum, val) => sum + Math.pow(val - avgRevenue, 2), 0) / monthlyRevenue.length
    const stdDev = Math.sqrt(variance)
    const confidence = Math.max(60, Math.min(95, 100 - (stdDev / avgRevenue * 100)))

    return {
        nextMonth: Math.round(nextMonthForecast),
        currentMonth: Math.round(lastMonth),
        avgRevenue: Math.round(avgRevenue),
        confidence: Math.round(confidence),
        trend
    }
}

export function renderRevenueForecast() {
    const forecast = calculateRevenueForecast()
    const forecastEl = document.getElementById('revenueForecast')

    if (!forecastEl) return

    const trendIcon = {
        up: '📈',
        down: '📉',
        stable: '➡️'
    }

    const trendText = {
        up: '+15% Growth Expected',
        down: '-15% Decline Expected',
        stable: 'Stable Revenue Expected'
    }

    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const monthName = nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' })

    forecastEl.innerHTML = `
        <div class="forecast-widget">
            <div class="forecast-header">
                <div class="forecast-icon">${trendIcon[forecast.trend]}</div>
                <div class="forecast-period">${monthName}</div>
            </div>
            <div class="forecast-value">₹${(forecast.nextMonth / 100000).toFixed(2)}L</div>
            <div class="forecast-label">Predicted Revenue</div>
            <div class="forecast-metrics">
                <div class="forecast-metric">
                    <div class="forecast-metric-value">${forecast.confidence}%</div>
                    <div class="forecast-metric-label">Confidence</div>
                </div>
                <div class="forecast-metric">
                    <div class="forecast-metric-value">${trendIcon[forecast.trend]}</div>
                    <div class="forecast-metric-label">${trendText[forecast.trend]}</div>
                </div>
                <div class="forecast-metric">
                    <div class="forecast-metric-value">₹${(forecast.avgRevenue / 100000).toFixed(2)}L</div>
                    <div class="forecast-metric-label">3-Mo Avg</div>
                </div>
            </div>
        </div>
    `
}

// Export to window
if (typeof window !== 'undefined') {
    window.initThemeSelector = initThemeSelector
    window.openThemeSelector = openThemeSelector
    window.closeThemeSelector = closeThemeSelector
    window.applyColorTheme = applyColorTheme

    window.initNotificationCenter = initNotificationCenter
    window.toggleNotificationCenter = toggleNotificationCenter
    window.handleNotificationClick = handleNotificationClick
    window.markAllAsRead = markAllAsRead
    window.addNotification = addNotification

    window.initCalendarView = initCalendarView
    window.renderCalendar = renderCalendar
    window.changeCalendarMonth = changeCalendarMonth
    window.showDateBookings = showDateBookings

    window.initRevenueForecasting = initRevenueForecasting
    window.calculateRevenueForecast = calculateRevenueForecast
    window.renderRevenueForecast = renderRevenueForecast
}
