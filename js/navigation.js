// ResIQ Navigation — Quick actions, keyboard shortcuts, sidebar, mobile nav, user menu

function openQuickActions() {
    const overlay = document.getElementById('quickActionsOverlay');
    overlay.classList.add('active');
    
    // Reset and render
    selectedActionIndex = 0;
    filteredActions = [...quickActions];
    renderQuickActions();
    
    // Focus search input
    setTimeout(() => {
        document.getElementById('quickActionsSearch').focus();
    }, 100);
}

function closeQuickActions(event) {
    if (event && event.target !== document.getElementById('quickActionsOverlay')) return;
    
    const overlay = document.getElementById('quickActionsOverlay');
    overlay.classList.remove('active');
    document.getElementById('quickActionsSearch').value = '';
}

function renderQuickActions() {
    const list = document.getElementById('quickActionsList');
    
    if (filteredActions.length === 0) {
        list.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">No actions found</div>';
        return;
    }
    
    list.innerHTML = filteredActions.map((action, index) => `
        <div class="quick-action-item ${index === selectedActionIndex ? 'selected' : ''}" onclick="executeQuickAction(${index})" data-index="${index}">
            <div class="quick-action-icon">${action.icon}</div>
            <div class="quick-action-content">
                <div class="quick-action-title">${action.title}</div>
                <div class="quick-action-desc">${action.desc}</div>
            </div>
        </div>
    `).join('');
}

function filterQuickActions(event) {
    const query = event.target.value.toLowerCase().trim();
    
    // Handle keyboard navigation
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedActionIndex = Math.min(selectedActionIndex + 1, filteredActions.length - 1);
        renderQuickActions();
        scrollToSelected();
        return;
    }
    
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedActionIndex = Math.max(selectedActionIndex - 1, 0);
        renderQuickActions();
        scrollToSelected();
        return;
    }
    
    if (event.key === 'Enter') {
        event.preventDefault();
        executeQuickAction(selectedActionIndex);
        return;
    }
    
    if (event.key === 'Escape') {
        closeQuickActions();
        return;
    }
    
    // Filter actions
    if (query === '') {
        filteredActions = [...quickActions];
    } else {
        filteredActions = quickActions.filter(action => {
            const searchText = `${action.title} ${action.desc} ${action.keywords.join(' ')}`.toLowerCase();
            return searchText.includes(query);
        });
    }
    
    selectedActionIndex = 0;
    renderQuickActions();
}

function executeQuickAction(index) {
    if (filteredActions[index]) {
        filteredActions[index].action();
    }
}

function scrollToSelected() {
    const list = document.getElementById('quickActionsList');
    const selected = list.querySelector('.quick-action-item.selected');
    if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// Keyboard shortcut: Ctrl+K or Cmd+K
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const overlay = document.getElementById('quickActionsOverlay');
        if (overlay.classList.contains('active')) {
            closeQuickActions();
        } else {
            openQuickActions();
        }
    }
});

// Close modals on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close any open modal
        document.querySelectorAll('.modal.active, .modal.show').forEach(modal => {
            modal.classList.remove('active', 'show');
        });
    }
});

// Enhanced keyboard shortcuts for navigation
document.addEventListener('keydown', (e) => {
    // Only trigger if not typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }
    
    // Alt + Number shortcuts for quick navigation
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        switch(e.key) {
            case '1':
                showView('home');
                showToast('Navigation', 'Home View', '🏠');
                break;
            case '2':
                showView('dashboard');
                showToast('Navigation', 'Dashboard View', '📊');
                break;
            case '3':
                showView('reservations');
                showToast('Navigation', 'Reservations View', '📋');
                break;
            case '4':
                showView('payments');
                showToast('Navigation', 'Payments View', '💰');
                break;
            case '5':
                showView('availability');
                showToast('Navigation', 'Availability View', '📅');
                break;
            case '6':
                showView('properties');
                showToast('Navigation', 'Properties View', '🏡');
                break;
            case '7':
                showView('performance');
                showToast('Navigation', 'Performance View', '📈');
                break;
            case '8':
                showView('team');
                showToast('Navigation', 'Team View', '👥');
                break;
        }
    }
    
    // Ctrl/Cmd + S to save (when in forms)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        const activeModal = document.querySelector('.modal.active, .modal.show');
        if (activeModal) {
            e.preventDefault();
            // Find and click the save/submit button in the modal
            const saveButton = activeModal.querySelector('button[type="submit"], button.btn-primary');
            if (saveButton) {
                saveButton.click();
                showToast('Saved', 'Form submitted', '✅');
            }
        }
    }
    
    // ? key to show keyboard shortcuts
    if (e.key === '?' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        showKeyboardShortcuts();
    }
});

// Keyboard shortcuts modal functions
function showKeyboardShortcuts() {
    document.getElementById('keyboardShortcutsModal').classList.add('show');
}

function closeKeyboardShortcuts() {
    document.getElementById('keyboardShortcutsModal').classList.remove('show');
}

// ============================================
// PULL TO REFRESH
// ============================================

let touchStartY = 0;
let touchEndY = 0;
let isPulling = false;
let isRefreshing = false;
const pullThreshold = 80; // pixels to pull before refresh

const pullIndicator = document.getElementById('pullToRefreshIndicator');
const pullArrow = document.getElementById('pullToRefreshArrow');

document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0 && !isRefreshing) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
    }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!isPulling || isRefreshing) return;
    
    touchEndY = e.touches[0].clientY;
    const pullDistance = touchEndY - touchStartY;
    
    if (pullDistance > 0 && window.scrollY === 0) {
        // Prevent default scrolling while pulling
        if (pullDistance > 10) {
            e.preventDefault();
        }
        
        // Show indicator with better positioning
        const progress = Math.min(pullDistance / pullThreshold, 1.2);
        const topPosition = -80 + (170 * progress); // Increased range
        
        pullIndicator.style.top = `${topPosition}px`;
        pullIndicator.style.opacity = Math.min(progress, 1);
        pullIndicator.style.transform = `translateX(-50%) scale(${0.8 + (progress * 0.2)})`;
        
        // Flip arrow when threshold reached
        if (pullDistance >= pullThreshold) {
            pullArrow.classList.add('flip');
            pullArrow.textContent = '🔄';
            pullIndicator.style.borderColor = 'var(--success)';
        } else {
            pullArrow.classList.remove('flip');
            pullArrow.textContent = '⬇️';
            pullIndicator.style.borderColor = 'var(--primary)';
        }
    }
}, { passive: false }); // Changed to false to allow preventDefault

document.addEventListener('touchend', async (e) => {
    if (!isPulling || isRefreshing) return;
    
    const pullDistance = touchEndY - touchStartY;
    
    if (pullDistance >= pullThreshold && window.scrollY === 0) {
        // Trigger refresh
        isRefreshing = true;
        pullIndicator.classList.add('active', 'loading');
        pullIndicator.style.borderColor = 'var(--success)';
        pullArrow.textContent = '⏳';
        
        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([10, 50, 10]);
        }
        
        // Refresh current view
        await refreshCurrentView();
        
        // Show success state
        pullArrow.textContent = '✅';
        
        // Hide indicator after delay
        setTimeout(() => {
            pullIndicator.classList.remove('active', 'loading');
            pullIndicator.style.top = '-80px';
            pullIndicator.style.opacity = '0';
            pullIndicator.style.transform = 'translateX(-50%) scale(1)';
            pullIndicator.style.borderColor = 'var(--primary)';
            pullArrow.textContent = '⬇️';
            pullArrow.classList.remove('flip');
            isRefreshing = false;
            isPulling = false;
        }, 1500); // Increased from 1000ms
    } else {
        // Reset indicator smoothly
        pullIndicator.style.top = '-80px';
        pullIndicator.style.opacity = '0';
        pullIndicator.style.transform = 'translateX(-50%) scale(1)';
        pullIndicator.style.borderColor = 'var(--primary)';
        pullArrow.classList.remove('flip');
        pullArrow.textContent = '⬇️';
        isPulling = false;
    }
    
    touchStartY = 0;
    touchEndY = 0;
});


async function refreshCurrentView() {
    // Determine which view is active
    const views = ['home', 'dashboard', 'reservations', 'payments', 'availability', 'properties', 'performance'];
    
    for (const view of views) {
        const viewElement = document.getElementById(`${view}View`);
        if (viewElement && !viewElement.classList.contains('hidden')) {
            // Refresh the active view
            switch(view) {
                case 'home':
                    await loadInitialData();
                    await updateHomeScreenStats();
                    break;
                case 'dashboard':
                    await loadDashboard();
                    break;
                case 'reservations':
                    await loadReservations();
                    break;
                case 'payments':
                    await loadPayments();
                    break;
                case 'availability':
                    await loadAvailabilityCalendar();
                    break;
                case 'properties':
                    loadProperties();
                    break;
                case 'guests':
                    loadGuests();
                    break;
                case 'performance':
                    await initializePerformanceView();
                    break;
            }
            showToast('Refreshed', 'Data updated successfully', '✅');
            break;
        }
    }
} 

// ============================================

// ============================================
// HAPTIC FEEDBACK
// ============================================

function haptic(pattern = 'light') {
    if (!('vibrate' in navigator)) return;
    
    const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 50, 10],
        error: [20, 100, 20],
        warning: [15, 75, 15],
        double: [10, 50, 10],
        triple: [10, 30, 10, 30, 10]
    };
    
    navigator.vibrate(patterns[pattern] || patterns.light);
}

// Apply haptic to all buttons
document.addEventListener('click', (e) => {
    const button = e.target.closest('button, .btn, a[onclick]');
    if (button && !button.disabled) {
        haptic('light');
    }
});

// Apply haptic to form submissions
document.addEventListener('submit', (e) => {
    haptic('medium');
});

// Apply haptic to checkbox/radio changes
document.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' || e.target.type === 'radio') {
        haptic('light');
    }
});

// ============================================
// VOICE COMMANDS FOR QUICK ACTIONS
// ============================================

let voiceCommandRecognition = null;

function initVoiceCommand() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 3;

    return recognition;
}

function startVoiceCommand() {
    if (!voiceCommandRecognition) {
        voiceCommandRecognition = initVoiceCommand();
    }
    
    if (!voiceCommandRecognition) {
        showToast('Voice Error', 'Speech recognition not supported', '❌');
        return;
    }

    const btn = document.getElementById('voiceCommandBtn');
    const searchInput = document.getElementById('quickActionsSearch');
    
    btn.classList.add('listening');
    searchInput.value = '';
    searchInput.placeholder = 'Listening...';

    let finalTranscript = '';

    voiceCommandRecognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript = transcript;
            } else {
                interimTranscript = transcript;
            }
        }

        // Show what's being heard
        const displayText = interimTranscript || finalTranscript;
        if (displayText) {
            searchInput.value = displayText;
        }
    };

    voiceCommandRecognition.onend = () => {
        btn.classList.remove('listening');
        searchInput.placeholder = 'Type a command or search...';

        if (finalTranscript.trim()) {
            processVoiceCommand(finalTranscript.trim());
        }
    };

    voiceCommandRecognition.onerror = (event) => {
        console.error('Voice error:', event.error);
        btn.classList.remove('listening');
        searchInput.placeholder = 'Type a command or search...';
        
        if (event.error !== 'no-speech') {
            showToast('Voice Error', 'Could not recognize speech', '❌');
        }
    };

    voiceCommandRecognition.start();

    // Auto-stop after 5 seconds
    setTimeout(() => {
        if (btn.classList.contains('listening')) {
            voiceCommandRecognition.stop();
        }
    }, 5000);
}

function processVoiceCommand(command) {
    const cmd = command.toLowerCase();
    
    console.log('Voice command:', command);

    // Match command to actions
    let matchedAction = null;

    // Direct navigation commands
    if (cmd.includes('dashboard') || cmd.includes('home')) {
        matchedAction = quickActions.find(a => a.id === 'dashboard');
    }
    else if (cmd.includes('payment') && cmd.includes('pending')) {
        matchedAction = quickActions.find(a => a.id === 'pending-payments');
    }
    else if (cmd.includes('check') && cmd.includes('in') && (cmd.includes('today') || cmd.includes('todays'))) {
        matchedAction = quickActions.find(a => a.id === 'checkins-today');
    }
    else if (cmd.includes('check') && cmd.includes('out') && (cmd.includes('today') || cmd.includes('todays'))) {
        matchedAction = quickActions.find(a => a.id === 'checkouts-today');
    }
    else if (cmd.includes('calendar') || cmd.includes('availability')) {
        matchedAction = quickActions.find(a => a.id === 'calendar');
    }
    else if (cmd.includes('export') && cmd.includes('payment')) {
        matchedAction = quickActions.find(a => a.id === 'export-payments');
    }
    else if (cmd.includes('export')) {
        matchedAction = quickActions.find(a => a.id === 'export-csv');
    }
    else if (cmd.includes('add') && cmd.includes('property')) {
        matchedAction = quickActions.find(a => a.id === 'add-property');
    }
    else if (cmd.includes('sync')) {
        matchedAction = quickActions.find(a => a.id === 'sync-data');
    }
    // Search commands
    else if (cmd.includes('show') || cmd.includes('find') || cmd.includes('search')) {
        // Extract search term (everything after "show"/"find"/"search")
        let searchTerm = cmd;
        searchTerm = searchTerm.replace(/^(show|find|search)\s+/i, '');
        searchTerm = searchTerm.replace(/\s+(reservation|booking|property|guest)s?$/i, '');
        
        if (searchTerm) {
            closeQuickActions();
            showView('reservations');
            document.getElementById('searchReservations').value = searchTerm;
            searchReservations();
            showToast('Search', `Showing results for "${searchTerm}"`, '🔍');
            return;
        }
    }

    // Execute matched action
    if (matchedAction) {
        showToast('Voice Command', `Executing: ${matchedAction.title}`, '✅');
        setTimeout(() => {
            matchedAction.action();
        }, 500);
    } else {
        // Fallback: Use as search query
        document.getElementById('quickActionsSearch').value = command;
        filterQuickActions({ target: document.getElementById('quickActionsSearch') });
        showToast('Search', `Searching for: "${command}"`, '🔍');
    }
}
// ============================================

// ==========================================
// MORE DROPDOWN & USER MENU
// ==========================================

/**
 * Toggle More dropdown menu
 */
function toggleMoreDropdown() {
    const menu = document.getElementById('moreDropdownMenu');
    const btn = document.querySelector('.more-dropdown-btn');
    
    // Close user menu if open
    closeUserMenu();
    
    if (menu.classList.contains('active')) {
        menu.classList.remove('active');
    } else {
        menu.classList.add('active');
    }
}

/**
 * Close More dropdown
 */
function closeMoreDropdown() {
    const menu = document.getElementById('moreDropdownMenu');
    if (menu) {
        menu.classList.remove('active');
    }
}

/**
 * Toggle User menu dropdown
 */
function toggleUserMenu() {
    const dropdown = document.getElementById('userMenuDropdown');
    const btn = document.querySelector('.user-menu-btn');
    
    // Close more dropdown if open
    closeMoreDropdown();
    
    if (dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
        btn.classList.remove('active');
    } else {
        dropdown.classList.add('active');
        btn.classList.add('active');
    }
}

/**
 * Close User menu
 */
function closeUserMenu() {
    const dropdown = document.getElementById('userMenuDropdown');
    const btn = document.querySelector('.user-menu-btn');
    
    if (dropdown) {
        dropdown.classList.remove('active');
    }
    if (btn) {
        btn.classList.remove('active');
    }
}

/**
 * Close dropdowns when clicking outside
 */
document.addEventListener('click', (e) => {
    // Close More dropdown
    if (!e.target.closest('.more-dropdown-container')) {
        closeMoreDropdown();
    }
    
    // Close User menu
    if (!e.target.closest('.user-menu-container')) {
        closeUserMenu();
    }
});

/**
 * Update user email in both locations
 */
function updateUserEmailDisplay(email) {
    const emailSpan = document.getElementById('userEmail');
    const emailDropdown = document.getElementById('userEmailDropdown');
    
    if (emailSpan) emailSpan.textContent = email;
    if (emailDropdown) emailDropdown.textContent = email;
}

</script>

// ==========================================
// NEW NAVIGATION FUNCTIONS
// ==========================================

// Mobile Sidebar Toggle (needed here for resize event listener below)
function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.remove('mobile-open');
    }
}

// Toggle Sidebar (works for both mobile and tablet)
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');

    if (sidebar) {
        sidebar.classList.toggle('active');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// Close Sidebar
function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobileOverlay');

    if (sidebar) {
        sidebar.classList.remove('active');
    }
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// ==========================================
// MOBILE HEADER HELPERS
// ==========================================

// Toggle mobile search bar
function toggleMobileSearch() {
    const bar = document.getElementById('mobileSearchBar');
    const input = document.getElementById('mobileSearchInput');
    if (!bar) return;
    if (bar.style.display === 'none' || !bar.style.display) {
        bar.style.display = 'block';
        if (input) input.focus();
    } else {
        bar.style.display = 'none';
        if (input) input.value = '';
    }
}

// Update mobile header title based on current view
function updateMobileViewTitle(viewName) {
    const titleEl = document.getElementById('mobileViewTitle');
    if (!titleEl) return;
    const titles = {
        home: 'Home',
        dashboard: 'Dashboard',
        property: 'Property',
        business: 'Business',
        financials: 'Financials',
        reservations: 'Reservations',
        payments: 'Payments',
        guests: 'Guests',
        guestDocuments: 'Documents',
        meals: 'Meals',
        expenses: 'Expenses',
        properties: 'Properties',
        team: 'Team',
        owners: 'Owners',
        availability: 'Availability',
        communication: 'Communication',
        settings: 'Settings'
    };
    titleEl.textContent = titles[viewName] || viewName.charAt(0).toUpperCase() + viewName.slice(1);
}

// Sync notification badge to mobile header
function syncMobileNotifBadge() {
    const desktopBadge = document.getElementById('notificationBadge');
    const mobileBadge = document.getElementById('mobileNotifBadge');
    if (desktopBadge && mobileBadge) {
        mobileBadge.textContent = desktopBadge.textContent;
        mobileBadge.style.display = desktopBadge.style.display;
    }
}

// Observe desktop notification badge changes
const notifBadgeObserver = new MutationObserver(syncMobileNotifBadge);
document.addEventListener('DOMContentLoaded', function() {
    const desktopBadge = document.getElementById('notificationBadge');
    if (desktopBadge) {
        notifBadgeObserver.observe(desktopBadge, { childList: true, attributes: true, attributeFilter: ['style'] });
    }
});

// Filter Bottom Sheet
function toggleFilterSheet() {
    const sheet = document.getElementById('filterSheet');
    const overlay = document.getElementById('filterSheetOverlay');
    if (sheet && overlay) {
        const isActive = sheet.classList.contains('active');
        if (isActive) {
            closeFilterSheet();
        } else {
            // Sync desktop filter values to mobile before opening
            syncFiltersToMobile();
            overlay.classList.add('active');
            sheet.style.display = 'block';
            requestAnimationFrame(() => {
                sheet.classList.add('active');
            });
        }
    }
}

function closeFilterSheet() {
    const sheet = document.getElementById('filterSheet');
    const overlay = document.getElementById('filterSheetOverlay');
    if (sheet) {
        sheet.classList.remove('active');
        setTimeout(() => { sheet.style.display = 'none'; }, 350);
    }
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
}

function syncFiltersToMobile() {
    const pairs = [
        ['statusFilter', 'statusFilterMobile'],
        ['propertyFilter', 'propertyFilterMobile'],
        ['bookingSourceFilter', 'bookingSourceFilterMobile'],
        ['monthFilter', 'monthFilterMobile']
    ];
    pairs.forEach(([desktopId, mobileId]) => {
        const desktop = document.getElementById(desktopId);
        const mobile = document.getElementById(mobileId);
        if (desktop && mobile) {
            // Copy options for dynamically populated selects
            if (mobile.options.length <= 1 && desktop.options.length > 1) {
                mobile.innerHTML = desktop.innerHTML;
            }
            mobile.value = desktop.value;
        }
    });
}

function updateActiveFilterCount() {
    let count = 0;
    ['statusFilterMobile', 'propertyFilterMobile', 'bookingSourceFilterMobile', 'monthFilterMobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) count++;
    });
    const badge = document.getElementById('activeFilterCount');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Toggle User Menu (Mobile)
function toggleUserMenuMobile() {
    const userMenu = document.getElementById('userMenuDropdown');
    userMenu.classList.toggle('active');
}

// Update Active Navigation Item
function setActiveNavItem(viewName) {
    // Clear all active sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });


    // Set active based on view name
    const sidebarSelector = `.sidebar-item[onclick*="'${viewName}'"]`;
    const sidebarItem = document.querySelector(sidebarSelector);
    if (sidebarItem) sidebarItem.classList.add('active');
}

// Toggle Sidebar Compact Mode (Tablet)
function toggleSidebarCompact() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('compact');
    }
}

// Close all dropdowns on view change
function closeAllMenus() {
    closeMobileSidebar();
    const userMenu = document.getElementById('userMenuDropdown');
    if (userMenu) userMenu.classList.remove('active');
    const moreMenu = document.getElementById('moreDropdownMenu');
    if (moreMenu) moreMenu.classList.remove('active');
}

// Handle responsive sidebar on window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    
    if (width >= 1025) {
        // Desktop - show sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('compact');
        closeMobileSidebar();
    } else if (width >= 769 && width <= 1024) {
        // Tablet - show compact sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.add('compact');
        closeMobileSidebar();
    } else {
        // Mobile - hide sidebar
        closeMobileSidebar();
    }
});

// Update existing showView function to call setActiveNavItem
const originalShowView = window.showView;
if (originalShowView) {
    window.showView = function(viewName) {
        originalShowView(viewName);
        setActiveNavItem(viewName);
        if (typeof updateMobileViewTitle === 'function') {
            updateMobileViewTitle(viewName);
        }
        closeAllMenus();
        window.scrollTo(0, 0);
    };
}
// ==========================================
// PWA SERVICE WORKER & INSTALL PROMPT

// PWA SERVICE WORKER & INSTALL PROMPT
// ==========================================

var deferredPrompt = null;
var isInstalled = false;

// Check if already installed
function checkIfInstalled() {
    // Check display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        isInstalled = true;
        return true;
    }
    
    // Check if running as PWA on iOS
    if (window.navigator.standalone === true) {
        isInstalled = true;
        return true;
    }
    
    return false;
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registered:', registration.scope);
                
                // Check for updates every hour
                setInterval(() => {
                    registration.update();
                }, 3600000);
            })
            .catch(error => {
                console.error('❌ Service Worker registration failed:', error);
            });
    });
}

// Capture the install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('💾 PWA install prompt available');
    
    // Prevent the default mini-infobar
    e.preventDefault();
    
    // Store the event for later use
    deferredPrompt = e;
    deferredPWAPrompt = e;
    window.deferredPrompt = e;

    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    const dismissedTime = localStorage.getItem('pwa_install_dismissed_time');
    
    // Show banner if not dismissed or if 7 days have passed
    if (!dismissed || (Date.now() - parseInt(dismissedTime)) > 7 * 24 * 60 * 60 * 1000) {
        showInstallBanner();
    }
});

// Show install banner (delegates to showPWABanner which handles localStorage checks)
function showInstallBanner() {
    showPWABanner();
}

// Dismiss install banner (delegates to dismissPWABanner)
function dismissInstallBanner() {
    dismissPWABanner();
    localStorage.setItem('pwa_install_dismissed', 'true');
    localStorage.setItem('pwa_install_dismissed_time', Date.now().toString());
    console.log('ℹ️ Install banner dismissed');
}

// Detect when PWA is installed
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA was installed');
    isInstalled = true;
    dismissPWABanner();
    localStorage.removeItem('pwa_install_dismissed');
});

// Check installation status on load
window.addEventListener('load', () => {
    checkIfInstalled();
    console.log('PWA Installation Status:', isInstalled ? 'Installed' : 'Not Installed');
});

// OPTIONAL: Add install button to UI (e.g., in settings)
// Call this function from your settings or profile page
function addInstallButtonToUI() {
    // You can add a permanent install button in your header or settings
    // that calls installPWA() when clicked
}

// =================================================================
// ENHANCED UX FEATURES: Kanban, Charts, PDF Export, PWA Banner
// =================================================================

// Global variables for charts and Sortable instances
let revenueChartInstance = null;
let paymentChartInstance = null;
let kanbanSortables = [];
var deferredPWAPrompt = null;

// =================================================================
// 1. KANBAN BOARD WITH SORTABLEJS
// =================================================================

function switchReservationView(view) {
    const tableView = document.getElementById('tableView');
    const kanbanView = document.getElementById('kanbanView');
    const tableBtn = document.getElementById('tableViewBtn');
    const kanbanBtn = document.getElementById('kanbanViewBtn');

    if (view === 'table') {
        tableView.style.display = 'block';
        kanbanView.classList.remove('active');
        tableBtn.style.background = 'var(--primary)';
        tableBtn.style.color = 'white';
        kanbanBtn.style.background = 'var(--secondary)';
        kanbanBtn.style.color = 'white';
    } else {
        tableView.style.display = 'none';
        kanbanView.classList.add('active');
        tableBtn.style.background = 'var(--secondary)';
        tableBtn.style.color = 'white';
        kanbanBtn.style.background = 'var(--primary)';
        kanbanBtn.style.color = 'white';
        renderKanbanBoard();
    }
}

function renderKanbanBoard() {
    // Use global allReservations instead of state
    if (!allReservations || allReservations.length === 0) {
        const statuses = ['confirmed', 'checked-in', 'checked-out', 'cancelled'];
        statuses.forEach(status => {
            const column = document.getElementById(`kanban-${status}`);
            if (column) column.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 12px;">No reservations</div>';
        });
        return;
    }

    const statuses = ['confirmed', 'checked-in', 'checked-out', 'cancelled'];

    // Clear all columns
    statuses.forEach(status => {
        const column = document.getElementById(`kanban-${status}`);
        if (column) column.innerHTML = '';
    });

    // Group reservations by status
    const grouped = {};
    statuses.forEach(status => grouped[status] = []);

    allReservations.forEach(reservation => {
        const status = reservation.status || 'pending';
        // Map "pending" to "confirmed" column for now (or create a pending column)
        const targetStatus = status === 'pending' ? 'confirmed' : status;
        if (grouped[targetStatus]) {
            grouped[targetStatus].push(reservation);
        }
    });

    // Render cards for each status
    statuses.forEach(status => {
        const column = document.getElementById(`kanban-${status}`);
        const countEl = document.getElementById(`kanban${status.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}Count`);

        if (countEl) countEl.textContent = grouped[status].length;

        grouped[status].forEach(reservation => {
            const card = createKanbanCard(reservation);
            if (column) column.appendChild(card);
        });
    });

    // Initialize SortableJS on all columns
    initKanbanSortable();
    
    // Refresh icons
    setTimeout(() => { if (typeof refreshIcons === 'function') refreshIcons(); }, 100);
}
function createKanbanCard(reservation) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('data-booking-id', reservation.booking_id);

    const borderColors = {
        'pending': 'var(--warning)',
        'confirmed': 'var(--primary)',
        'checked-in': 'var(--success)',
        'checked-out': '#0891b2',
        'cancelled': 'var(--danger)'
    };
    card.style.borderLeftColor = borderColors[reservation.status] || 'var(--primary)';

    // Use reservation.property_name directly (already fetched from DB with JOIN)
    const propertyName = reservation.property_name || 'N/A';
    const checkIn = reservation.check_in ? new Date(reservation.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A';
    const nights = reservation.nights || 1;
    const amount = `₹${parseInt(reservation.total_amount || 0).toLocaleString('en-IN')}`;

    card.innerHTML = `
        <div class="kanban-card-booking-id" style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="hash" style="width: 12px; height: 12px; opacity: 0.6;"></i>
            ${reservation.booking_id}
        </div>
        <div class="kanban-card-guest" style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="user" style="width: 12px; height: 12px; opacity: 0.6;"></i>
            ${reservation.guest_name}
        </div>
        <div class="kanban-card-property" style="display: flex; align-items: center; gap: 6px;">
            <i data-lucide="building-2" style="width: 12px; height: 12px; opacity: 0.6;"></i>
            ${propertyName}
        </div>
        <div class="kanban-card-meta">
            <span class="kanban-card-badge" style="background: var(--primary-light); color: var(--primary-dark); display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="calendar" style="width: 10px; height: 10px;"></i>${checkIn}
            </span>
            <span class="kanban-card-badge" style="background: var(--success-light); color: #155724; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="moon" style="width: 10px; height: 10px;"></i>${nights}N
            </span>
            <span class="kanban-card-badge" style="background: var(--warning-light); color: #7f5f01; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="coins" style="width: 10px; height: 10px;"></i>${amount}
            </span>
        </div>
    `;

    card.onclick = () => openReservationModal(reservation.booking_id);
    return card;
}
function initKanbanSortable() {
    // Destroy existing instances
    kanbanSortables.forEach(sortable => sortable.destroy());
    kanbanSortables = [];

    const statuses = ['confirmed', 'checked-in', 'checked-out', 'cancelled'];

    statuses.forEach(status => {
        const column = document.getElementById(`kanban-${status}`);
        if (!column) return;

        const sortable = Sortable.create(column, {
            group: 'kanban',
            animation: 200,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: async function(evt) {
                const bookingId = evt.item.getAttribute('data-booking-id');
                const newStatus = evt.to.getAttribute('data-status');
                await updateReservationStatus(bookingId, newStatus);
            }
        });

        kanbanSortables.push(sortable);
    });
}

async function updateReservationStatus(bookingId, newStatus) {
    try {
        const { error } = await supabase
            .from('reservations')
            .update({ status: newStatus })
            .eq('booking_id', bookingId);

        if (error) throw error;

        // Update local state
        const reservation = state.reservations.find(r => r.booking_id === bookingId);
        if (reservation) reservation.status = newStatus;

        // Update allReservations too
        const globalRes = allReservations.find(r => r.booking_id === bookingId);
        if (globalRes) globalRes.status = newStatus;

        showToast('Status Updated', `${bookingId} → ${newStatus.replace('-', ' ')}`, '✅');
        await loadReservations();
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Error', 'Failed to update reservation status', '❌');
        renderKanbanBoard(); // Revert UI
    }
}

// =================================================================
// 2. CHART.JS INTERACTIVE CHARTS
// =================================================================

function initializeCharts() {
    createRevenueChart();
    createPaymentChart();
}

function createRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    const hostizzyRevenue = parseFloat(document.getElementById('hostizzyTotal')?.textContent.replace(/[₹,]/g, '') || 0);
    const ownerRevenue = parseFloat(document.getElementById('ownerTotal')?.textContent.replace(/[₹,]/g, '') || 0);

    revenueChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Hostizzy Revenue', 'Owner Revenue'],
            datasets: [{
                data: [hostizzyRevenue, ownerRevenue],
                backgroundColor: [
                    'rgba(8, 145, 178, 0.8)',
                    'rgba(16, 185, 129, 0.8)'
                ],
                borderColor: [
                    'rgba(8, 145, 178, 1)',
                    'rgba(16, 185, 129, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ₹' + context.parsed.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

function createPaymentChart() {
    const canvas = document.getElementById('paymentChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (paymentChartInstance) {
        paymentChartInstance.destroy();
    }

    // Calculate payment sources distribution
    const paymentSources = {};
    const payments = (typeof state !== 'undefined' && state.payments) ? state.payments : [];

    payments.forEach(payment => {
        const source = payment.payment_method || 'Unknown';
        if (!paymentSources[source]) {
            paymentSources[source] = 0;
        }
        paymentSources[source] += parseFloat(payment.amount || 0);
    });

    // Sort by amount descending
    const sortedSources = Object.entries(paymentSources)
        .sort((a, b) => b[1] - a[1]);

    const labels = sortedSources.map(([source]) => source);
    const data = sortedSources.map(([, amount]) => amount);

    // Color scheme for payment methods
    const colors = {
        'UPI': 'rgba(8, 145, 178, 0.8)',
        'CASH': 'rgba(16, 185, 129, 0.8)',
        'CARD': 'rgba(59, 130, 246, 0.8)',
        'BANK TRANSFER': 'rgba(245, 158, 11, 0.8)',
        'CHEQUE': 'rgba(239, 68, 68, 0.8)',
        'Unknown': 'rgba(148, 163, 184, 0.8)'
    };

    const borderColors = {
        'UPI': 'rgba(8, 145, 178, 1)',
        'CASH': 'rgba(16, 185, 129, 1)',
        'CARD': 'rgba(59, 130, 246, 1)',
        'BANK TRANSFER': 'rgba(245, 158, 11, 1)',
        'CHEQUE': 'rgba(239, 68, 68, 1)',
        'Unknown': 'rgba(148, 163, 184, 1)'
    };

    const backgroundColors = labels.map(label => colors[label] || 'rgba(8, 145, 178, 0.8)');
    const borderColorsArray = labels.map(label => borderColors[label] || 'rgba(8, 145, 178, 1)');

    paymentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Amount (₹)',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColorsArray,
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                            return `₹${context.parsed.y.toLocaleString('en-IN')} (${percentage}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000) {
                                return '₹' + (value / 1000) + 'K';
                            }
                            return '₹' + value;
                        }
                    }
                }
            }
        }
    });
}

function updateCharts() {
    // Update charts when data changes
    if (revenueChartInstance || paymentChartInstance) {
        setTimeout(() => {
            createRevenueChart();
            createPaymentChart();
        }, 100);
    }
}

// =================================================================
// 3. PDF EXPORT WITH JSPDF
// =================================================================

function exportDashboardPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(99, 102, 241);
        doc.text('ResIQ Dashboard Report', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, 28);

        // Summary Stats
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Summary Statistics', 14, 40);

        const hostizzyTotal = document.getElementById('hostizzyTotal')?.textContent || '₹0';
        const ownerTotal = document.getElementById('ownerTotal')?.textContent || '₹0';
        const totalCollected = document.getElementById('totalCollected')?.textContent || '₹0';
        const pendingCollection = document.getElementById('pendingCollection')?.textContent || '₹0';

        doc.setFontSize(11);
        let yPos = 50;
        doc.text(`Hostizzy Revenue: ${hostizzyTotal}`, 20, yPos);
        yPos += 8;
        doc.text(`Owner Revenue: ${ownerTotal}`, 20, yPos);
        yPos += 8;
        doc.text(`Payment Collected: ${totalCollected}`, 20, yPos);
        yPos += 8;
        doc.text(`Payment Pending: ${pendingCollection}`, 20, yPos);

        // Reservations Table
        if (state.reservations && state.reservations.length > 0) {
            yPos += 15;
            doc.setFontSize(14);
            doc.text('Recent Reservations', 14, yPos);

            const tableData = state.reservations.slice(0, 20).map(r => {
                const property = state.properties.find(p => p.id === r.property_id);
                return [
                    r.booking_id || '',
                    r.guest_name || '',
                    property?.name || 'N/A',
                    new Date(r.check_in).toLocaleDateString('en-IN'),
                    r.nights || 0,
                    `₹${parseInt(r.total_amount || 0).toLocaleString('en-IN')}`,
                    r.status || ''
                ];
            });

            doc.autoTable({
                startY: yPos + 5,
                head: [['Booking ID', 'Guest', 'Property', 'Check-in', 'Nights', 'Amount', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241], textColor: 255 },
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 22 },
                    4: { cellWidth: 15 },
                    5: { cellWidth: 25 },
                    6: { cellWidth: 20 }
                }
            });
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10);
        }

        // Save
        doc.save(`ResIQ_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('✅ PDF exported successfully!', 'success');
    } catch (error) {
        console.error('PDF Export Error:', error);
        showToast('❌ Failed to export PDF', 'error');
    }
}

// Add export button handler to existing CSV export
const originalExportCSV = window.exportCSV;
window.exportCSV = function() {
    // Show option dialog
    const choice = confirm('Export as PDF? (Cancel for CSV)');
    if (choice) {
        exportReservationsPDF();
    } else {
        originalExportCSV();
    }
};

function exportReservationsPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        doc.setFontSize(18);
        doc.setTextColor(99, 102, 241);
        doc.text('Reservations Report', 14, 15);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 22);

        const tableData = (state.reservations || []).map(r => {
            const property = state.properties.find(p => p.id === r.property_id);
            return [
                r.booking_id || '',
                r.guest_name || '',
                property?.name || 'N/A',
                r.booking_source || 'DIRECT',
                new Date(r.check_in).toLocaleDateString('en-IN'),
                new Date(r.check_out).toLocaleDateString('en-IN'),
                r.nights || 0,
                `₹${parseInt(r.total_amount || 0).toLocaleString('en-IN')}`,
                r.status || ''
            ];
        });

        doc.autoTable({
            startY: 28,
            head: [['Booking ID', 'Guest', 'Property', 'Source', 'Check-in', 'Check-out', 'Nights', 'Amount', 'Status']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [99, 102, 241] },
            styles: { fontSize: 8 }
        });

        doc.save(`Reservations_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('✅ PDF exported successfully!', 'success');
    } catch (error) {
        console.error('PDF Export Error:', error);
        showToast('❌ Failed to export PDF', 'error');
    }
}

// =================================================================
// 4. ENHANCED PWA INSTALL BANNER
// =================================================================

function showPWABanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (!banner) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    if (dismissed) {
        const dismissedTime = parseInt(dismissed);
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) return; // Don't show for 7 days
    }

    // Show after 3 seconds
    setTimeout(() => {
        banner.classList.add('show');
    }, 3000);
}

function dismissPWABanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
        banner.classList.add('hiding');
        setTimeout(() => {
            banner.classList.remove('show');
            banner.classList.remove('hiding');
        }, 300);
        localStorage.setItem('pwa_banner_dismissed', Date.now().toString());
    }
}

async function installPWA() {
    if (!deferredPWAPrompt && window.deferredPrompt) {
        deferredPWAPrompt = window.deferredPrompt;
    }

    if (!deferredPWAPrompt) {
        showToast('❌ Installation not available on this device', 'error');
        return;
    }

    try {
        deferredPWAPrompt.prompt();
        const { outcome } = await deferredPWAPrompt.userChoice;

        if (outcome === 'accepted') {
            showToast('✅ App installed successfully!', 'success');
            dismissPWABanner();
        } else {
            showToast('Installation cancelled', 'info');
        }

        deferredPWAPrompt = null;
    } catch (error) {
        console.error('Installation error:', error);
        showToast('❌ Installation failed', 'error');
    }
}

// Initialize on load
window.addEventListener('load', () => {
    showPWABanner();

    // Initialize charts when dashboard loads
    setTimeout(() => {
        if (document.getElementById('dashboardView') && !document.getElementById('dashboardView').classList.contains('hidden')) {
            initializeCharts();
        }
    }, 1000);
});

// Hook into loadDashboard to update charts
const originalLoadDashboard = window.loadDashboard;
if (originalLoadDashboard) {
    window.loadDashboard = async function() {
        await originalLoadDashboard();
        updateCharts();
    };
}

// =================================================================
// LOGIN PAGE INITIALIZATION
// =================================================================

// Populate remembered email on page load
(function initLoginPage() {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        const emailInput = document.getElementById('loginEmail');
        const rememberCheckbox = document.getElementById('rememberMe');

        if (emailInput) {
            emailInput.value = rememberedEmail;
        }
        if (rememberCheckbox) {
            rememberCheckbox.checked = true;
        }
    }

    // Add Enter key support for login
    const passwordInput = document.getElementById('loginPassword');
    const emailInput = document.getElementById('loginEmail');

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }

    if (emailInput) {
        emailInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
})();

// =================================================================
// END OF ENHANCED UX FEATURES
// =================================================================
    </script>

    <!-- Native App Utilities -->
    <script src="native-app-utils.js"></script>

    <!-- Onboarding Flow -->
    <script src="onboarding.js"></script>

    <!-- Initialize Lucide Icons -->
    <script>
// Initialize Lucide icons after DOM load
