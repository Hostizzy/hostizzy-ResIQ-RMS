/**
 * Navigation Module
 * Handles view management, routing, and navigation
 */

// ==========================================
// VIEW MANAGEMENT
// ==========================================

/**
 * Show a specific view and hide all others
 */
export async function showView(viewName) {
    document.querySelectorAll('.container').forEach(el => el.classList.add('hidden'))

    const viewElement = document.getElementById(`${viewName}View`)
    if (!viewElement) {
        console.error(`View not found: ${viewName}View`)
        // Fallback to home if view doesn't exist
        const homeElement = document.getElementById('homeView')
        if (homeElement) homeElement.classList.remove('hidden')
        return
    }

    viewElement.classList.remove('hidden')

    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
        link.classList.remove('active')
    })

    if (event && event.target) event.target.classList.add('active')

    // Save current view to localStorage for persistence on refresh
    try {
        localStorage.setItem('lastView', viewName)
    } catch (error) {
        console.error('Error saving view state:', error)
    }

    // Load view-specific data
    if (viewName === 'home') {
        if (typeof window.loadInitialData === 'function') await window.loadInitialData()
        if (typeof window.updateHomeScreenStats === 'function') await window.updateHomeScreenStats()
    }
    if (viewName === 'dashboard' && typeof window.loadDashboard === 'function') window.loadDashboard()
    if (viewName === 'reservations' && typeof window.loadReservations === 'function') window.loadReservations()
    if (viewName === 'guests' && typeof window.loadGuests === 'function') window.loadGuests()
    if (viewName === 'guestDocuments' && typeof window.loadGuestDocuments === 'function') window.loadGuestDocuments()
    if (viewName === 'payments' && typeof window.loadPayments === 'function') window.loadPayments()
    if (viewName === 'meals' && typeof window.loadMeals === 'function') window.loadMeals()
    if (viewName === 'availability' && typeof window.loadAvailability === 'function') window.loadAvailability()
    if (viewName === 'properties' && typeof window.loadProperties === 'function') window.loadProperties()
    if (viewName === 'performance' && typeof window.initializePerformanceView === 'function') window.initializePerformanceView()
    if (viewName === 'team' && typeof window.loadTeam === 'function') window.loadTeam()
    if (viewName === 'invoices' && typeof window.loadInvoices === 'function') window.loadInvoices()
    if (viewName === 'communications' && typeof window.loadCommunications === 'function') window.loadCommunications()
    if (viewName === 'settings' && typeof window.loadSettings === 'function') window.loadSettings()
}

/**
 * Show view on mobile and close sidebar
 */
export function showViewMobile(viewName) {
    showView(viewName)
    toggleMobileSidebar()

    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
        link.classList.remove('active')
    })

    if (event && event.target) event.target.classList.add('active')
}

/**
 * Navigate to specific reservation
 */
export function navigateToReservation(booking_id) {
    // Switch to reservations view
    showView('reservations')

    // Wait for view to load, then search for the booking
    setTimeout(() => {
        const searchInput = document.getElementById('searchBookings')
        if (searchInput) {
            searchInput.value = booking_id
            if (typeof window.searchBookings === 'function') {
                window.searchBookings()
            }
        }
    }, 300)
}

/**
 * Toggle mobile sidebar
 */
export function toggleMobileSidebar() {
    const sidebar = document.getElementById('mobileSidebar')
    const overlay = document.getElementById('sidebarOverlay')

    if (!sidebar || !overlay) return

    sidebar.classList.toggle('active')
    overlay.classList.toggle('active')
}

/**
 * Restore last viewed page on app load
 */
export function restoreLastView() {
    try {
        const lastView = localStorage.getItem('lastView')
        if (lastView) {
            console.log('🔄 Restoring last view:', lastView)
            showView(lastView)
        } else {
            // Default to home view
            showView('home')
        }
    } catch (error) {
        console.error('Error restoring view:', error)
        showView('home')
    }
}

/**
 * Save/load collapse state for collapsible sections
 */
export function saveCollapseState(elementId, isExpanded) {
    try {
        localStorage.setItem(`collapse_${elementId}`, isExpanded ? 'expanded' : 'collapsed')
    } catch (error) {
        console.error('Error saving collapse state:', error)
    }
}

export function loadCollapseState(elementId, iconId) {
    try {
        const state = localStorage.getItem(`collapse_${elementId}`)
        const element = document.getElementById(elementId)
        const icon = document.getElementById(iconId)

        if (element && icon && state === 'collapsed') {
            element.style.display = 'none'
            icon.textContent = '▶️'
        }
    } catch (error) {
        console.error('Error loading collapse state:', error)
    }
}

/**
 * Toggle collapsible section
 */
export function toggleCollapse(elementId, iconId) {
    const element = document.getElementById(elementId)
    const icon = document.getElementById(iconId)

    if (!element || !icon) return

    const isExpanded = element.style.display !== 'none'

    if (isExpanded) {
        element.style.display = 'none'
        icon.textContent = '▶️'
        saveCollapseState(elementId, false)
    } else {
        element.style.display = 'block'
        icon.textContent = '🔽'
        saveCollapseState(elementId, true)
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.showView = showView
    window.showViewMobile = showViewMobile
    window.navigateToReservation = navigateToReservation
    window.toggleMobileSidebar = toggleMobileSidebar
    window.restoreLastView = restoreLastView
    window.saveCollapseState = saveCollapseState
    window.loadCollapseState = loadCollapseState
    window.toggleCollapse = toggleCollapse
}

console.log('✅ Navigation module loaded')
