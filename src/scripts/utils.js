/**
 * Utility Functions - Formatters and Helpers
 */

// Smart Currency Formatting
export function formatCurrency(amount, options = {}) {
    const {
        showSymbol = true,
        showDecimals = false,
        compact = true
    } = options

    const value = parseFloat(amount) || 0
    const absValue = Math.abs(value)

    let formatted = ''

    if (compact) {
        if (absValue >= 10000000) {
            // Crores (10M+)
            formatted = `${(value / 10000000).toFixed(showDecimals ? 2 : 1)}Cr`
        } else if (absValue >= 100000) {
            // Lakhs (100K+)
            formatted = `${(value / 100000).toFixed(showDecimals ? 2 : 1)}L`
        } else if (absValue >= 1000) {
            // Thousands (1K+)
            formatted = `${(value / 1000).toFixed(showDecimals ? 2 : 1)}K`
        } else {
            // Less than 1000
            formatted = Math.round(value).toLocaleString('en-IN')
        }
    } else {
        formatted = Math.round(value).toLocaleString('en-IN')
    }

    return showSymbol ? `₹${formatted}` : formatted
}

// Date Formatting
export function formatDate(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    const options = { day: '2-digit', month: 'short', year: 'numeric' }
    return date.toLocaleDateString('en-IN', options)
}

// Short Date Format
export function formatDateShort(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    const options = { day: '2-digit', month: 'short' }
    return date.toLocaleDateString('en-IN', options)
}

// Format Date for Input Fields
export function formatDateForInput(dateString) {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
}

// Calculate Nights Between Dates
export function calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0
    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
}

// Booking Source Badge Helper
export function getSourceBadgeClass(source) {
    const sourceMap = {
        'direct': 'b-success',
        'airbnb': 'b-warning',
        'booking.com': 'b-info',
        'mmt': 'b-danger',
        'goibibo': 'b-secondary'
    }
    return sourceMap[source?.toLowerCase()] || 'b-secondary'
}

// Booking Status Badge Helper
export function getStatusBadgeClass(status) {
    const statusMap = {
        'pending': 'b-warning',
        'confirmed': 'b-info',
        'checked_in': 'b-success',
        'checked_out': 'b-secondary',
        'cancelled': 'b-danger'
    }
    return statusMap[status] || 'b-secondary'
}

// Payment Status Badge Helper
export function getPaymentStatusBadgeClass(status) {
    const paymentMap = {
        'pending': 'b-danger',
        'partial': 'b-warning',
        'paid': 'b-success',
        'refunded': 'b-secondary'
    }
    return paymentMap[status] || 'b-secondary'
}

// Generate Booking ID
export function generateBookingId() {
    const year = new Date().getFullYear().toString().slice(-2)
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const bytes = crypto.getRandomValues(new Uint8Array(6))
    let rand = ""
    for (const b of bytes) {
        rand += alphabet[b % alphabet.length]
    }
    return `HST${year}${rand}`
}

// Calculate Months Between Dates
export function getMonthsBetween(startDate, endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months = []

    let current = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

    while (current <= endMonth) {
        const monthName = current.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        months.push(monthName)
        current.setMonth(current.getMonth() + 1)
    }

    return months
}

// Debounce Function
export function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func(...args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

// Validate Email
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
}

// Validate Phone Number (Indian)
export function isValidPhone(phone) {
    const re = /^[6-9]\d{9}$/
    return re.test(phone?.replace(/\D/g, ''))
}

// Format Phone Number
export function formatPhone(phone) {
    if (!phone) return ''
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
    }
    return phone
}

// Parse CSV
export function parseCSV(csv) {
    const lines = csv.split('\n')
    const headers = lines[0].split(',')
    return lines.slice(1).map(line => {
        const values = line.split(',')
        return headers.reduce((obj, header, i) => {
            obj[header.trim()] = values[i]?.trim()
            return obj
        }, {})
    })
}

// Export to CSV
export function exportToCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0])
    const csv = [
        headers.join(','),
        ...data.map(row => headers.map(header => row[header] || '').join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// Filter State Management (localStorage)
export function saveFilterState(viewName, filters) {
    try {
        const filterState = JSON.parse(localStorage.getItem('filterState') || '{}')
        filterState[viewName] = {
            ...filters,
            timestamp: Date.now()
        }
        localStorage.setItem('filterState', JSON.stringify(filterState))
        console.log(`✅ Saved ${viewName} filters:`, filters)
    } catch (error) {
        console.error('Error saving filter state:', error)
    }
}

export function loadFilterState(viewName) {
    try {
        const filterState = JSON.parse(localStorage.getItem('filterState') || '{}')
        const viewFilters = filterState[viewName]

        // Return filters if they exist and are less than 24 hours old
        if (viewFilters && (Date.now() - viewFilters.timestamp) < 86400000) {
            console.log(`✅ Loaded ${viewName} filters:`, viewFilters)
            return viewFilters
        }
        return null
    } catch (error) {
        console.error('Error loading filter state:', error)
        return null
    }
}

export function clearFilterState(viewName) {
    try {
        const filterState = JSON.parse(localStorage.getItem('filterState') || '{}')
        delete filterState[viewName]
        localStorage.setItem('filterState', JSON.stringify(filterState))
        console.log(`✅ Cleared ${viewName} filters`)
    } catch (error) {
        console.error('Error clearing filter state:', error)
    }
}

// Make utilities available globally for legacy code
if (typeof window !== 'undefined') {
    window.formatCurrency = formatCurrency
    window.formatDate = formatDate
    window.formatDateShort = formatDateShort
    window.formatDateForInput = formatDateForInput
    window.calculateNights = calculateNights
    window.generateBookingId = generateBookingId
    window.getSourceBadgeClass = getSourceBadgeClass
    window.getStatusBadgeClass = getStatusBadgeClass
    window.getPaymentStatusBadgeClass = getPaymentStatusBadgeClass
}
