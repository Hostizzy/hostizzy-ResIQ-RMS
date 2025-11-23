/**
 * Quick Actions Menu - Floating Action Button with Menu
 */

let quickActionsOpen = false

export function initQuickActions() {
    createQuickActionsUI()
    console.log('✅ Quick Actions menu initialized')
}

function createQuickActionsUI() {
    const html = `
        <!-- Quick Actions Menu -->
        <div class="quick-actions-menu" id="quickActionsMenu">
            <div class="quick-action-item" onclick="createNewReservation()">
                <div class="quick-action-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">📅</div>
                <div class="quick-action-label">New Reservation</div>
            </div>
            <div class="quick-action-item" onclick="createNewPayment()">
                <div class="quick-action-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">💰</div>
                <div class="quick-action-label">New Payment</div>
            </div>
            <div class="quick-action-item" onclick="createNewGuest()">
                <div class="quick-action-icon" style="background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: white;">👤</div>
                <div class="quick-action-label">New Guest</div>
            </div>
            <div class="quick-action-item" onclick="window.openCommandPalette()">
                <div class="quick-action-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white;">⚡</div>
                <div class="quick-action-label">Quick Search</div>
            </div>
        </div>

        <!-- Floating Action Button -->
        <button class="fab" onclick="toggleQuickActions()" title="Quick Actions (Q)">
            ➕
        </button>
    `

    document.body.insertAdjacentHTML('beforeend', html)

    // Keyboard shortcut: Q key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey) {
            // Only if not focused on input
            if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                e.preventDefault()
                toggleQuickActions()
            }
        }
    })
}

export function toggleQuickActions() {
    const menu = document.getElementById('quickActionsMenu')
    const fab = document.querySelector('.fab')

    if (!menu || !fab) return

    quickActionsOpen = !quickActionsOpen

    if (quickActionsOpen) {
        menu.classList.add('active')
        fab.style.transform = 'rotate(45deg)'
    } else {
        menu.classList.remove('active')
        fab.style.transform = ''
    }
}

export function createNewReservation() {
    toggleQuickActions()
    if (typeof window.showView === 'function') {
        window.showView('reservations')
    }
    setTimeout(() => {
        if (typeof window.openReservationModal === 'function') {
            window.openReservationModal()
        }
    }, 300)
}

export function createNewPayment() {
    toggleQuickActions()
    if (typeof window.showView === 'function') {
        window.showView('payments')
    }
    setTimeout(() => {
        if (typeof window.openMultiPaymentModal === 'function') {
            window.openMultiPaymentModal()
        }
    }, 300)
}

export function createNewGuest() {
    toggleQuickActions()
    if (typeof window.showView === 'function') {
        window.showView('guests')
    }
    setTimeout(() => {
        if (typeof window.openGuestModal === 'function') {
            window.openGuestModal()
        }
    }, 300)
}

// Initialize dark mode from localStorage
export function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light'
    document.documentElement.setAttribute('data-theme', savedTheme)

    // Update theme icon
    const themeIcon = document.getElementById('themeIcon')
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️'
    }

    console.log(`✅ Theme initialized: ${savedTheme}`)
}

// Export to window
if (typeof window !== 'undefined') {
    window.initQuickActions = initQuickActions
    window.toggleQuickActions = toggleQuickActions
    window.createNewReservation = createNewReservation
    window.createNewPayment = createNewPayment
    window.createNewGuest = createNewGuest
    window.initTheme = initTheme
}
