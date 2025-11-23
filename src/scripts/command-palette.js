/**
 * Command Palette - Quick Navigation & Actions (CMD+K)
 */

let commandPaletteOpen = false

export function initCommandPalette() {
    createCommandPaletteUI()
    registerKeyboardShortcuts()
    console.log('✅ Command Palette initialized (Press CMD+K or CTRL+K)')
}

function createCommandPaletteUI() {
    const html = `
        <div id="commandPalette" class="command-palette hidden">
            <div class="command-palette-backdrop" onclick="closeCommandPalette()"></div>
            <div class="command-palette-content glass-strong">
                <div class="command-palette-search">
                    <span class="command-search-icon">🔍</span>
                    <input
                        type="text"
                        id="commandSearch"
                        placeholder="Type a command or search..."
                        autocomplete="off"
                        spellcheck="false"
                    >
                    <kbd class="command-kbd">ESC</kbd>
                </div>
                <div class="command-palette-results" id="commandResults">
                    <!-- Dynamic results -->
                </div>
            </div>
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', html)

    const searchInput = document.getElementById('commandSearch')
    searchInput.addEventListener('input', handleCommandSearch)
    searchInput.addEventListener('keydown', handleCommandKeydown)
}

function registerKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // CMD+K or CTRL+K to open
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault()
            toggleCommandPalette()
        }

        // ESC to close
        if (e.key === 'Escape' && commandPaletteOpen) {
            closeCommandPalette()
        }
    })
}

export function toggleCommandPalette() {
    if (commandPaletteOpen) {
        closeCommandPalette()
    } else {
        openCommandPalette()
    }
}

export function openCommandPalette() {
    const palette = document.getElementById('commandPalette')
    const searchInput = document.getElementById('commandSearch')

    if (palette && searchInput) {
        palette.classList.remove('hidden')
        commandPaletteOpen = true
        searchInput.value = ''
        searchInput.focus()
        loadDefaultCommands()
    }
}

export function closeCommandPalette() {
    const palette = document.getElementById('commandPalette')

    if (palette) {
        palette.classList.add('hidden')
        commandPaletteOpen = false
    }
}

function loadDefaultCommands() {
    const commands = getAllCommands()
    renderCommands(commands)
}

function handleCommandSearch(e) {
    const query = e.target.value.toLowerCase()
    const commands = getAllCommands()

    if (!query) {
        renderCommands(commands)
        return
    }

    const filtered = commands.filter(cmd =>
        cmd.title.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query) ||
        cmd.keywords.some(k => k.toLowerCase().includes(query))
    )

    renderCommands(filtered)
}

function handleCommandKeydown(e) {
    const results = document.getElementById('commandResults')
    const items = results.querySelectorAll('.command-item')
    const activeItem = results.querySelector('.command-item.active')

    if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (activeItem) {
            activeItem.classList.remove('active')
            const next = activeItem.nextElementSibling
            if (next) {
                next.classList.add('active')
                next.scrollIntoView({ block: 'nearest' })
            } else if (items[0]) {
                items[0].classList.add('active')
                items[0].scrollIntoView({ block: 'nearest' })
            }
        } else if (items[0]) {
            items[0].classList.add('active')
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (activeItem) {
            activeItem.classList.remove('active')
            const prev = activeItem.previousElementSibling
            if (prev) {
                prev.classList.add('active')
                prev.scrollIntoView({ block: 'nearest' })
            } else if (items[items.length - 1]) {
                items[items.length - 1].classList.add('active')
                items[items.length - 1].scrollIntoView({ block: 'nearest' })
            }
        }
    } else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeItem) {
            activeItem.click()
        }
    }
}

function renderCommands(commands) {
    const results = document.getElementById('commandResults')

    if (commands.length === 0) {
        results.innerHTML = `
            <div class="command-empty">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-title">No commands found</div>
                <div class="empty-state-description">Try a different search term</div>
            </div>
        `
        return
    }

    const groupedCommands = groupCommandsByCategory(commands)
    let html = ''

    for (const [category, cmds] of Object.entries(groupedCommands)) {
        html += `<div class="command-category">${category}</div>`
        cmds.forEach((cmd, index) => {
            const activeClass = index === 0 && category === Object.keys(groupedCommands)[0] ? 'active' : ''
            html += `
                <div class="command-item ${activeClass}" onclick="executeCommand('${cmd.action}')">
                    <div class="command-item-icon">${cmd.icon}</div>
                    <div class="command-item-content">
                        <div class="command-item-title">${cmd.title}</div>
                        <div class="command-item-description">${cmd.description}</div>
                    </div>
                    ${cmd.shortcut ? `<kbd class="command-kbd">${cmd.shortcut}</kbd>` : ''}
                </div>
            `
        })
    }

    results.innerHTML = html
}

function groupCommandsByCategory(commands) {
    const grouped = {}

    commands.forEach(cmd => {
        if (!grouped[cmd.category]) {
            grouped[cmd.category] = []
        }
        grouped[cmd.category].push(cmd)
    })

    return grouped
}

function getAllCommands() {
    return [
        // Navigation
        {
            category: '🧭 Navigation',
            title: 'Go to Dashboard',
            description: 'View your dashboard and analytics',
            icon: '📊',
            action: 'navigate:dashboard',
            keywords: ['home', 'dashboard', 'overview']
        },
        {
            category: '🧭 Navigation',
            title: 'Go to Reservations',
            description: 'View and manage all bookings',
            icon: '📅',
            action: 'navigate:reservations',
            keywords: ['bookings', 'reservations', 'calendar']
        },
        {
            category: '🧭 Navigation',
            title: 'Go to Payments',
            description: 'View payment records and history',
            icon: '💰',
            action: 'navigate:payments',
            keywords: ['money', 'transactions']
        },
        {
            category: '🧭 Navigation',
            title: 'Go to Guests',
            description: 'Manage guest information',
            icon: '👥',
            action: 'navigate:guests',
            keywords: ['customers', 'users']
        },
        {
            category: '🧭 Navigation',
            title: 'Go to Properties',
            description: 'Manage your properties',
            icon: '🏠',
            action: 'navigate:properties',
            keywords: ['listings', 'homes']
        },
        {
            category: '🧭 Navigation',
            title: 'Go to Analytics',
            description: 'View performance metrics',
            icon: '📈',
            action: 'navigate:performance',
            keywords: ['stats', 'metrics', 'reports', 'charts']
        },

        // Quick Actions
        {
            category: '⚡ Quick Actions',
            title: 'New Reservation',
            description: 'Create a new booking',
            icon: '➕',
            action: 'create:reservation',
            keywords: ['add booking', 'new reservation']
        },
        {
            category: '⚡ Quick Actions',
            title: 'New Payment',
            description: 'Record a new payment',
            icon: '💳',
            action: 'create:payment',
            keywords: ['add payment', 'new transaction']
        },
        {
            category: '⚡ Quick Actions',
            title: 'New Guest',
            description: 'Add a new guest',
            icon: '👤',
            action: 'create:guest',
            keywords: ['add guest', 'new customer']
        },

        // Settings
        {
            category: '⚙️ Settings',
            title: 'Toggle Dark Mode',
            description: 'Switch between light and dark theme',
            icon: '🌙',
            action: 'toggle:darkMode',
            keywords: ['theme', 'appearance']
        },
        {
            category: '⚙️ Settings',
            title: 'Change Color Theme',
            description: 'Select from multiple color schemes',
            icon: '🎨',
            action: 'open:themeSelector',
            keywords: ['colors', 'appearance', 'customize']
        },
        {
            category: '⚙️ Settings',
            title: 'Notifications',
            description: 'View all notifications',
            icon: '🔔',
            action: 'open:notifications',
            keywords: ['alerts', 'updates']
        },
        {
            category: '⚙️ Settings',
            title: 'Sign Out',
            description: 'Log out of your account',
            icon: '🚪',
            action: 'auth:logout',
            keywords: ['logout', 'exit', 'sign out']
        }
    ]
}

export function executeCommand(action) {
    closeCommandPalette()

    const [type, target] = action.split(':')

    switch (type) {
        case 'navigate':
            if (typeof window.showView === 'function') {
                window.showView(target)
            }
            break

        case 'create':
            handleCreateAction(target)
            break

        case 'toggle':
            if (target === 'darkMode') {
                toggleDarkMode()
            }
            break

        case 'open':
            if (target === 'themeSelector') {
                if (typeof window.openThemeSelector === 'function') {
                    window.openThemeSelector()
                }
            } else if (target === 'notifications') {
                if (typeof window.toggleNotificationCenter === 'function') {
                    window.toggleNotificationCenter()
                }
            }
            break

        case 'auth':
            if (target === 'logout') {
                if (typeof window.logout === 'function') {
                    window.logout()
                }
            }
            break
    }
}

function handleCreateAction(type) {
    switch (type) {
        case 'reservation':
            if (typeof window.openReservationModal === 'function') {
                window.showView('reservations')
                setTimeout(() => window.openReservationModal(), 300)
            }
            break
        case 'payment':
            window.showView('payments')
            break
        case 'guest':
            if (typeof window.openGuestModal === 'function') {
                window.showView('guests')
                setTimeout(() => window.openGuestModal(), 300)
            }
            break
    }
}

function toggleDarkMode() {
    const html = document.documentElement
    const currentTheme = html.getAttribute('data-theme')
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark'

    html.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)

    const icon = newTheme === 'dark' ? '🌙' : '☀️'
    const message = newTheme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled'

    // Update theme icon in navbar
    const themeIcon = document.getElementById('themeIcon')
    if (themeIcon) {
        themeIcon.textContent = icon
    }

    if (typeof window.showToast === 'function') {
        window.showToast('Theme Changed', message, icon)
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.initCommandPalette = initCommandPalette
    window.openCommandPalette = openCommandPalette
    window.closeCommandPalette = closeCommandPalette
    window.executeCommand = executeCommand
    window.toggleDarkMode = toggleDarkMode
}
