// ResIQ Reservations — View routing, home screen, search, reservation CRUD, wizard, bulk ops, automation

// =====================================================
// CANCELLATION CLEANUP
// =====================================================
// When a reservation is cancelled, purge every non-essential field.
// Kept fields: booking_id, guest_name, guest_email, guest_phone,
//              check_in, check_out, status, property_id, property_name,
//              ical_uid, ical_last_modified (needed so future iCal syncs
//              can still diff-match the cancelled row).
//
// Called by:
//   - saveReservation (form save with status=cancelled)
//   - saveQuickEdit   (inline quick-edit with status=cancelled)
//   - createReservationsFromIcal (when a UID vanishes from an OTA feed)
//
// Mutates and returns the reservation object.
function applyCancellationCleanup(reservation) {
    const fieldsToNull = [
        'booking_type', 'booking_date', 'month', 'nights',
        'gst_status', 'gst_rate_mode', 'guest_city', 'booking_source',
        'number_of_rooms', 'adults', 'kids', 'number_of_guests',
        'stay_amount', 'extra_guest_charges', 'meals_chef', 'bonfire_other',
        'ota_service_fee', 'taxes', 'total_amount_pre_tax',
        'total_amount_inc_tax', 'total_amount', 'damages',
        'hostizzy_revenue', 'revenue_share_percent',
        'host_payout', 'payout_eligible',
        'avg_room_rate', 'avg_nightly_rate',
        'paid_amount', 'payment_status', 'last_reminder_date',
    ];
    for (const f of fieldsToNull) {
        reservation[f] = null;
    }
    return reservation;
}

// Smart Automation Engine
let automationIntervalId = null;

async function runSmartAutomation() {
    try {
        const reservations = await db.getReservations();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let updatesMade = 0;

        // 1. Auto-status Updates: Change status based on check-in/check-out dates
        for (const reservation of reservations) {
            const checkIn = new Date(reservation.check_in);
            const checkOut = new Date(reservation.check_out);
            checkIn.setHours(0, 0, 0, 0);
            checkOut.setHours(0, 0, 0, 0);

            let newStatus = null;

            // Auto check-in on check-in date
            if (reservation.status === 'confirmed' && checkIn <= today && checkOut > today) {
                newStatus = 'checked-in';
            }
            // Auto check-out on check-out date
            else if (reservation.status === 'checked-in' && checkOut <= today) {
                newStatus = 'checked-out';
            }

            if (newStatus) {
                await db.updateReservation(reservation.id, { status: newStatus });
                updatesMade++;
                console.log(`🤖 Auto-updated ${reservation.booking_id} to ${newStatus}`);

                // Add notification
                if (newStatus === 'checked-in') {
                    addNotification(
                        'Guest Checked In',
                        `${reservation.guest_name} has been automatically checked in for ${reservation.booking_id}`,
                        'checkIns',
                        'viewReservation'
                    );
                } else if (newStatus === 'checked-out') {
                    addNotification(
                        'Guest Checked Out',
                        `${reservation.guest_name} has been automatically checked out from ${reservation.booking_id}`,
                        'checkIns',
                        'viewReservation'
                    );
                }
            }
        }

        if (updatesMade > 0) {
            console.log(`✅ Smart Automation: Made ${updatesMade} updates`);
        }

        return updatesMade;
    } catch (error) {
        console.error('❌ Smart Automation Error:', error);
        return 0;
    }
}

function startSmartAutomation() {
    // Check if automation is enabled
    if (localStorage.getItem('smartAutomationEnabled') === 'false') {
        console.log('🛑 Smart Automation is disabled in settings');
        return;
    }

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Mobile: Don't run immediately, run every 60 minutes to save battery/data
        automationIntervalId = setInterval(runSmartAutomation, 60 * 60 * 1000);
        console.log('🤖 Smart Automation Engine started for mobile (runs every 60 min)');
    } else {
        // Desktop: Run immediately and use configured interval
        runSmartAutomation();

        // Get interval from settings (default 30 minutes)
        const intervalMinutes = parseInt(localStorage.getItem('automationInterval') || '30');
        const intervalMs = intervalMinutes * 60 * 1000;

        automationIntervalId = setInterval(runSmartAutomation, intervalMs);
        console.log(`🤖 Smart Automation Engine started (runs every ${intervalMinutes} min)`);
    }
}

function stopSmartAutomation() {
    if (automationIntervalId) {
        clearInterval(automationIntervalId);
        automationIntervalId = null;
        console.log('🛑 Smart Automation Engine stopped');
    }
}

// Smart Automation will be started after db initialization (see loadInitialData)

function showViewMobile(viewName) {
    showView(viewName);
    toggleSidebar();
}

function navigateToReservation(booking_id) {
    // Switch to reservations view
    showView('reservations');
    
    // Wait for view to load, then search for the booking
    setTimeout(() => {
        const searchInput = document.getElementById('searchReservations');
        searchInput.value = booking_id;
        filterReservations();
        
        // Show toast notification
        showToast('Navigation', `Showing reservation: ${booking_id}`, '🔍');
    }, 300);
}

/**
 * Load initial data in background without blocking UI
 * On mobile: Load only recent data to improve performance
 */
async function loadInitialData() {
    try {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            console.log('📱 Loading optimized data for mobile...');
            // Mobile: Load only recent reservations (last 60 days) and properties
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

            let query = supabase
                .from('reservations')
                .select('*')
                .gte('check_in', sixtyDaysAgo.toISOString().split('T')[0])
                .order('check_in', { ascending: false });

            // Apply owner scope for hosts/managed owners
            if (db._ownerPropertyIds) {
                query = query.in('property_id', db._ownerPropertyIds.length > 0 ? db._ownerPropertyIds : [-1]);
            }

            const { data: recentReservations, error: resError } = await query;

            if (resError) throw resError;

            const properties = await db.getProperties();

            // Update global state with limited data
            state.reservations = recentReservations || [];
            state.properties = properties;
            state.payments = []; // Load payments on-demand on mobile
            allReservations = recentReservations || [];
            allPayments = [];

            // Populate cache so subsequent view loads are instant
            dataCache.set('reservations', allReservations);
            dataCache.set('properties', properties);

            console.log('Mobile-optimized data loaded:', {
                reservations: (recentReservations || []).length,
                properties: properties.length,
                note: 'Payments will load on-demand'
            });
        } else {
            // Desktop: Load all data
            const [reservations, properties, payments] = await Promise.all([
                db.getReservations(),
                db.getProperties(),
                db.getAllPayments()
            ]);

            // Update global state
            state.reservations = reservations;
            state.properties = properties;
            state.payments = payments;
            allReservations = reservations;
            allPayments = payments;

            // Populate cache so subsequent view loads are instant
            dataCache.set('reservations', reservations);
            dataCache.set('properties', properties);
            dataCache.set('payments', payments);

            console.log('Full data loaded:', {
                reservations: reservations.length,
                properties: properties.length,
                payments: payments.length
            });
        }

        // Hide splash screen now that data is loaded
        const splash = document.getElementById('splashScreen');
        if (splash && splash.style.display !== 'none') {
            splash.style.opacity = '0';
            setTimeout(() => { if (splash) splash.style.display = 'none'; }, 400);
        }

        // Start Smart Automation Engine after data is loaded
        startSmartAutomation();
    } catch (error) {
        console.error('Error loading initial data:', error);
    }
}

/**
 * Update greeting based on time of day
 */
function updateGreeting() {
    const hour = new Date().getHours();
    const greetingTimeEl = document.getElementById('greetingTime');
    const greetingUserEl = document.getElementById('greetingUser');
    const todayDateLabel = document.getElementById('todayDateLabel');

    let greeting = 'Good Evening';
    let emoji = '🌙';

    if (hour < 12) {
        greeting = 'Good Morning';
        emoji = '☀️';
    } else if (hour < 17) {
        greeting = 'Good Afternoon';
        emoji = '🌤️';
    }

    greetingTimeEl.textContent = `${emoji} ${greeting}`;

    if (todayDateLabel) {
        todayDateLabel.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
    }
    
    if (currentUser && currentUser.email) {
        const userName = currentUser.email.split('@')[0];
        greetingUserEl.textContent = `Welcome, ${userName}!`;
    }
}

/**
 * Update home screen statistics
 */
async function updateHomeScreenStats() {
    try {
        // Update greeting
        updateGreeting();

        // Ensure we have data — load in parallel so a slow query doesn't
        // serialize the others.
        if (!state.reservations || state.reservations.length === 0) {
            const [reservations, properties, payments] = await Promise.all([
                db.getReservations(),
                db.getProperties(),
                db.getAllPayments()
            ]);
            state.reservations = reservations;
            state.properties = properties;
            state.payments = payments;
        }

        // ── Single-pass aggregate ──
        // One traversal computes every count we need, instead of running
        // 5 independent .filter() passes over the same array.
        const todayKey = getTodayKeyIST();
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

        const stats = state.reservations.reduce((acc, r) => {
            if (r.status === 'confirmed' || r.status === 'checked_in') acc.active++;
            if (r.payment_status === 'pending' || r.payment_status === 'partial') acc.pending++;
            if (r.status !== 'cancelled') {
                if (r.check_in === todayKey) acc.arrivals++;
                if (r.check_out === todayKey) acc.departures++;
            }
            if (r.created_at && new Date(r.created_at).getTime() >= monthStart) {
                acc.monthPaise += Money.parseRupeesToPaise(r.paid_amount);
            }
            return acc;
        }, { active: 0, pending: 0, arrivals: 0, departures: 0, monthPaise: 0 });

        const totalProperties = state.properties ? state.properties.length : 0;

        // Update UI - with safe checks
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        set('homeStatReservations', state.reservations.length);
        set('homeStatActive', stats.active);
        set('homeStatPending', stats.pending);
        set('homeStatProperties', totalProperties);
        set('homeStatGuests', calculateUniqueGuests(allReservations));
        set('homeStatRevenue', Money.paiseToShortDisplay(stats.monthPaise));
        set('homeStatArrivals', stats.arrivals);
        set('homeStatDepartures', stats.departures);

        // Update recent activity
        updateRecentActivity();

        // Update mobile launcher + bottom-nav badges
        updateAppLauncherBadges(stats.pending);
        updateBottomNavBadges({ pendingPayments: stats.pending });

        // Round 6 — Monthly Revenue Target card on Home
        if (typeof renderRevenueTargets === 'function') {
            renderRevenueTargets();
        }

    } catch (error) {
        console.error('Error updating home screen:', error);
        // Default every stat to a zero placeholder so the user doesn't see
        // a stuck "--" forever if the data load failed.
        const zeroIds = [
            'homeStatReservations', 'homeStatActive', 'homeStatPending',
            'homeStatProperties', 'homeStatGuests',
            'homeStatArrivals', 'homeStatDepartures'
        ];
        for (const id of zeroIds) {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        }
        const rev = document.getElementById('homeStatRevenue');
        if (rev) rev.textContent = '₹0';
    }
}

/**
 * Update bottom-nav badges (mobile/tablet only) — surfaces overdue
 * counts at the tab level so operators don't have to drill into a view
 * to know there's something waiting.
 */
function updateBottomNavBadges({ pendingPayments }) {
    if (!window.ResIQBottomTabs || typeof ResIQBottomTabs.setBadge !== 'function') return;
    try {
        ResIQBottomTabs.setBadge('payments', pendingPayments || 0);
    } catch (_) { /* badge target may not be mounted yet */ }
}

/**
 * Update app launcher icon badges with live counts
 */
function updateAppLauncherBadges(pendingCount) {
    const docsBadge = document.getElementById('launcherDocsBadge');
    if (docsBadge) {
        if (pendingCount > 0) {
            docsBadge.textContent = pendingCount > 99 ? '99+' : pendingCount;
            docsBadge.style.display = 'flex';
        } else {
            docsBadge.style.display = 'none';
        }
    }
}

/**
 * Update recent activity feed
 */
function updateRecentActivity() {
    const activityList = document.getElementById('recentActivityList');
    
    // Get recent reservations (last 5)
    const recentReservations = (state.reservations || [])
        .slice() // copy before sort
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
    
    if (recentReservations.length === 0) {
        activityList.innerHTML = '<div style="color: #94a3b8; font-style: italic;">No recent activity</div>';
        return;
    }
    
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    recentReservations.forEach(r => {
        const timeAgo = getTimeAgo(new Date(r.created_at));
        const statusColor = r.payment_status === 'paid' ? '#10b981' : '#f59e0b';
        const statusIcon = r.payment_status === 'paid' ? '✅' : '⏳';
        
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
        `;
    });
    
    html += '</div>';
    activityList.innerHTML = html;
}

/**
 * Get time ago string
 */
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    
    return 'Just now';
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Loading...') {
    const existing = document.getElementById('loadingOverlay');
    if (existing) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <div style="color: var(--text-primary); font-weight: 500;">${message}</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Save/load collapse state functions
 */
function saveCollapseState(elementId, isExpanded) {
    try {
        localStorage.setItem(`collapse_${elementId}`, isExpanded ? 'expanded' : 'collapsed');
    } catch (error) {
        console.error('Error saving collapse state:', error);
    }
}

function loadCollapseState(elementId, iconId) {
    try {
        const state = localStorage.getItem(`collapse_${elementId}`);
        const element = document.getElementById(elementId);
        const icon = document.getElementById(iconId);
        
        if (element && icon && state === 'collapsed') {
            element.style.display = 'none';
            icon.textContent = '▶️';
        }
    } catch (error) {
        console.error('Error loading collapse state:', error);
    }
}

// Sidebar Category Toggle
function toggleSidebarCategory(categoryId) {
    const categoryElement = document.getElementById(`sidebar-${categoryId}`).parentElement;
    const itemsElement = document.getElementById(`sidebar-${categoryId}`);
    const isCollapsed = itemsElement.style.display === 'none';

    if (isCollapsed) {
        itemsElement.style.display = 'block';
        categoryElement.classList.remove('collapsed');
    } else {
        itemsElement.style.display = 'none';
        categoryElement.classList.add('collapsed');
    }
}

// Global Search
let globalSearchResults = [];

// Debounced global search — prevents blocking the main thread on every keystroke
const _debouncedGlobalSearch = debounce(_executeGlobalSearch, 250);

function handleGlobalSearch(event) {
    const searchInput = document.getElementById('globalSearch');
    const searchClear = document.getElementById('searchClear');
    const query = searchInput.value.trim();

    // Show/hide clear button immediately (cheap DOM op)
    searchClear.style.display = query ? 'block' : 'none';

    if (query.length < 2) {
        document.getElementById('searchResults').style.display = 'none';
        return;
    }

    _debouncedGlobalSearch();
}

function _executeGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');
    const query = searchInput.value.toLowerCase().trim();

    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }

    // Search across reservations, guests, and properties using actual data sources
    const results = [];
    const seenGuests = new Set();

    // Search reservations (use allReservations local var or state)
    const reservationsData = allReservations.length > 0 ? allReservations : (state.reservations || []);
    reservationsData.forEach(reservation => {
        if (reservation.guest_name?.toLowerCase().includes(query) ||
            reservation.property_name?.toLowerCase().includes(query) ||
            reservation.booking_id?.toLowerCase().includes(query) ||
            reservation.guest_phone?.toLowerCase().includes(query)) {
            results.push({
                type: 'reservation',
                title: `${reservation.guest_name} - ${reservation.property_name}`,
                meta: `Booking #${reservation.booking_id} | ${reservation.status}`,
                view: 'reservations',
                bookingId: reservation.booking_id
            });
        }

        // Build guest results from reservations (deduplicated)
        const guestKey = (reservation.guest_phone || reservation.guest_email || reservation.guest_name || '').toLowerCase().trim();
        if (guestKey && !seenGuests.has(guestKey)) {
            if (reservation.guest_name?.toLowerCase().includes(query) ||
                reservation.guest_email?.toLowerCase().includes(query) ||
                reservation.guest_phone?.toLowerCase().includes(query)) {
                seenGuests.add(guestKey);
                results.push({
                    type: 'guest',
                    title: reservation.guest_name,
                    meta: `${reservation.guest_email || ''} ${reservation.guest_phone || ''}`.trim(),
                    view: 'guests',
                    guestKey: guestKey
                });
            }
        }
    });

    // Search properties
    const propertiesData = state.properties || [];
    propertiesData.forEach(property => {
        if (property.name?.toLowerCase().includes(query) ||
            property.location?.toLowerCase().includes(query)) {
            results.push({
                type: 'property',
                title: property.name,
                meta: `${property.location || ''} | ${property.property_type || ''}`,
                view: 'properties'
            });
        }
    });

    // Store results globally
    globalSearchResults = results;

    // Display results
    if (results.length > 0) {
        // Deduplicate: show guests first, then reservations, then properties (limit 8 total)
        const grouped = { guest: [], reservation: [], property: [] };
        results.forEach(r => grouped[r.type]?.push(r));
        const ordered = [...grouped.guest.slice(0, 3), ...grouped.reservation.slice(0, 4), ...grouped.property.slice(0, 3)].slice(0, 8);
        // Update globalSearchResults to match displayed order
        globalSearchResults = ordered;

        searchResults.innerHTML = ordered.map((result, index) => `
            <div class="search-result-item" onclick="handleSearchResultClick(${index})">
                <div class="search-result-type" style="font-size: 10px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 2px;">${result.type}</div>
                <div class="search-result-title">${result.title}</div>
                <div class="search-result-meta">${result.meta}</div>
            </div>
        `).join('');
        searchResults.style.display = 'block';
    } else {
        searchResults.innerHTML = '<div class="search-result-item"><div class="search-result-title">No results found</div></div>';
        searchResults.style.display = 'block';
    }
}

function handleSearchResultClick(index) {
    const result = globalSearchResults[index];
    if (!result || !result.view) return;

    showView(result.view);

    // Navigate to the specific item after view loads
    if (result.type === 'reservation' && result.bookingId) {
        setTimeout(() => {
            const searchInput = document.getElementById('searchReservations');
            if (searchInput) {
                searchInput.value = result.bookingId;
                if (typeof filterReservations === 'function') filterReservations();
            }
        }, 300);
    } else if (result.type === 'guest' && result.guestKey) {
        setTimeout(() => {
            if (typeof showGuestDetail === 'function') showGuestDetail(result.guestKey);
        }, 300);
    }

    clearGlobalSearch();
}

function clearGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');
    const searchClear = document.getElementById('searchClear');

    searchInput.value = '';
    searchResults.style.display = 'none';
    searchClear.style.display = 'none';
}

// Close search results when clicking outside
document.addEventListener('click', function(e) {
    const searchContainer = document.querySelector('.navbar-search');
    const searchResults = document.getElementById('searchResults');
    if (searchContainer && searchResults && !searchContainer.contains(e.target)) {
        searchResults.style.display = 'none';
    }
});

// View Management
async function showView(viewName) {
    document.querySelectorAll('.container').forEach(el => el.classList.add('hidden'));
    const viewEl = document.getElementById(`${viewName}View`);
    viewEl.classList.remove('hidden');

    // Update browser URL to /app/viewName (skip if router already handled it)
    const expectedPath = `/app/${viewName}`;
    if (window.location.pathname !== expectedPath) {
        window.history.pushState({ view: viewName }, '', expectedPath);
    }
    document.title = (viewName.charAt(0).toUpperCase() + viewName.slice(1)) + ' - ResIQ';

    // Remove active state from all navigation items
    document.querySelectorAll('.nav-link, .sidebar-item').forEach(link => {
        link.classList.remove('active');
    });

    // Add active state to matching navigation items
    document.querySelectorAll(`[onclick*="showView('${viewName}')"]`).forEach(link => {
        if (link.classList.contains('sidebar-item')) {
            link.classList.add('active');
        }
    });

    // Save current view to localStorage for persistence on refresh
    try {
        localStorage.setItem('lastView', viewName);
    } catch (error) {
        console.error('Error saving view state:', error);
    }

    // Lazy Loading: Only load view data if not already loaded
    const alreadyLoaded = isViewLoaded(viewName);

    if (!alreadyLoaded) {
        showViewLoadingSpinner(viewName);
        viewLoadingState[viewName] = true;
    } else {
        // Show lightweight transition overlay on revisits (auto-hidden after load)
        showViewTransitionLoader(viewEl);
    }

    try {
        // ── Always call load functions (they use dataCache so revisits are fast).
        if (viewName === 'home') {
            if (!alreadyLoaded) await loadInitialData();
            await updateHomeScreenStats();
        }
        else if (viewName === 'dashboard') await loadDashboard();
        else if (viewName === 'reservations') await loadReservations();
        else if (viewName === 'guests') await loadGuests();
        else if (viewName === 'guestDocuments') await loadGuestDocuments();
        else if (viewName === 'payments') await loadPayments();
        else if (viewName === 'meals') await loadMeals();
        else if (viewName === 'availability') await loadAvailabilityCalendar();
        else if (viewName === 'properties') await loadProperties();
        else if (viewName === 'property') await loadPropertyView();
        else if (viewName === 'business') await loadBusinessView();
        else if (viewName === 'financials') await loadBusinessIntelligence();
        else if (viewName === 'team') await loadTeam();
        else if (viewName === 'owners') await loadOwners();
        else if (viewName === 'pendingSignups') await loadPendingSignups();
        else if (viewName === 'expenses') await loadExpenses();
        else if (viewName === 'pnl') await loadPnL();
        else if (viewName === 'importReview') loadImportReview();
        else if (viewName === 'settings') loadSettings();
        else if (viewName === 'enquiries') await loadEnquiries();
        else if (viewName === 'communication') loadCommunication();

        if (!alreadyLoaded) {
            markViewAsLoaded(viewName);
            hideViewLoadingSpinner(viewName);
            console.log(`✅ Lazy loaded: ${viewName}`);
        }
    } catch (error) {
        console.error(`❌ Error loading view ${viewName}:`, error);
        hideViewLoadingSpinner(viewName);
    }

    // Remove transition overlay
    hideViewTransitionLoader(viewEl);

    // Re-initialize Lucide icons after view renders — scoped to view only
    requestAnimationFrame(() => {
        if (typeof refreshIcons === 'function') refreshIcons(viewEl || undefined);
    });
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
    if (e.state?.view) {
        showView(e.state.view);
    } else {
        // Parse view from URL path
        const match = window.location.pathname.match(/^\/app\/([^/]+)$/);
        if (match) showView(match[1]);
    }
});

// On initial page load, set the URL if we're restoring from localStorage
(function setInitialURL() {
    const path = window.location.pathname;
    // Only act if we're on /app with no sub-path
    if (path === '/app' || path === '/app/' || path === '/app.html') {
        const savedView = localStorage.getItem('lastView') || 'home';
        window.history.replaceState({ view: savedView }, '', `/app/${savedView}`);
    } else {
        // If URL has a view path like /app/dashboard, navigate to it
        const match = path.match(/^\/app\/([^/]+)$/);
        if (match && match[1]) {
            const viewEl = document.getElementById(`${match[1]}View`);
            if (viewEl) {
                window.history.replaceState({ view: match[1] }, '', path);
            }
        }
    }
})();

// Lightweight transition loader for revisited views
function showViewTransitionLoader(viewEl) {
    if (!viewEl || viewEl.querySelector('.view-transition-loader')) return;
    viewEl.style.position = 'relative';
    const loader = document.createElement('div');
    loader.className = 'view-transition-loader';
    loader.innerHTML = '<div class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></div>';
    viewEl.appendChild(loader);
}

function hideViewTransitionLoader(viewEl) {
    if (!viewEl) return;
    const loader = viewEl.querySelector('.view-transition-loader');
    if (loader) loader.remove();
}

// Settings Functions

async function autoUpdateReservationStatuses() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();
        
        let updatedCount = 0;
        const reservationsToUpdate = [];
        
        // Get all reservations
        const allReservations = state.reservations || [];
        
        for (const reservation of allReservations) {
            // Skip cancelled reservations
            if (reservation.status === 'cancelled') continue;
            
            const checkIn = new Date(reservation.check_in);
            checkIn.setHours(0, 0, 0, 0);
            const checkInTime = checkIn.getTime();
            
            const checkOut = new Date(reservation.check_out);
            checkOut.setHours(0, 0, 0, 0);
            const checkOutTime = checkOut.getTime();
            
            let newStatus = null;
            
            // Logic for status updates
            if (reservation.status === 'confirmed' && todayTime >= checkInTime && todayTime < checkOutTime) {
                // Check-in date has arrived
                newStatus = 'checked-in';
            } else if ((reservation.status === 'confirmed' || reservation.status === 'checked-in') && todayTime >= checkOutTime) {
                // Check-out date has passed
                newStatus = 'checked-out';
            }
            
            // Update if status changed
            if (newStatus && newStatus !== reservation.status) {
                reservationsToUpdate.push({
                    bookingId: reservation.booking_id,
                    oldStatus: reservation.status,
                    newStatus: newStatus,
                    propertyName: reservation.property_name,
                    guestName: reservation.guest_name
                });
                
                // Update in database
                const { error } = await supabase
                    .from('reservations')
                    .update({ status: newStatus })
                    .eq('booking_id', reservation.booking_id);
                
                if (!error) {
                    // Update in local state
                    reservation.status = newStatus;
                    updatedCount++;
                }
            }
        }
        
        // Silent update - only log to console
        if (updatedCount > 0) {
            console.log(`✅ Auto-updated ${updatedCount} reservation status(es):`);
            reservationsToUpdate.forEach(r => {
                console.log(`  - ${r.guestName} at ${r.propertyName}: ${r.oldStatus} → ${r.newStatus}`);
            });
            
            // Refresh current view silently
            const currentView = localStorage.getItem('lastView') || 'home';
            if (currentView === 'dashboard') {
                await loadDashboard();
            } else if (currentView === 'reservations') {
                await loadReservations();
            } else if (currentView === 'home') {
                await updateHomeScreenStats();
            }
        }
        
    } catch (error) {
        console.error('Error auto-updating statuses:', error);
        // Silent fail - don't show error to user
    }
}

/**
 * Schedule auto-status updates
 * NOTE: This now delegates to the Smart Automation Engine (startSmartAutomation)
 * to avoid running two duplicate auto-status-update loops.
 */
function scheduleAutoStatusUpdates() {
    // Smart Automation is already started from loadInitialData().
    // This function is kept as a no-op for backward compatibility with callers in app.js.
    console.log('✅ Auto status updates: handled by Smart Automation Engine');
}

/**
 * Save filter state to localStorage
 */
function saveFilterState(viewName, filters) {
    try {
        const filterState = JSON.parse(localStorage.getItem('filterState') || '{}');
        filterState[viewName] = {
            ...filters,
            timestamp: Date.now()
        };
        localStorage.setItem('filterState', JSON.stringify(filterState));
        console.log(`✅ Saved ${viewName} filters:`, filters);
    } catch (error) {
        console.error('Error saving filter state:', error);
    }
}

/**
 * Load filter state from localStorage
 */
function loadFilterState(viewName) {
    try {
        const filterState = JSON.parse(localStorage.getItem('filterState') || '{}');
        const viewFilters = filterState[viewName];
        
        // Return filters if they exist and are less than 24 hours old
        if (viewFilters && (Date.now() - viewFilters.timestamp) < 86400000) {
            console.log(`✅ Loaded ${viewName} filters:`, viewFilters);
            return viewFilters;
        }
        return null;
    } catch (error) {
        console.error('Error loading filter state:', error);
        return null;
    }
}

/**
 * Clear filter state for a view
 */
function clearFilterState(viewName) {
    try {
        const filterState = JSON.parse(localStorage.getItem('filterState') || '{}');
        delete filterState[viewName];
        localStorage.setItem('filterState', JSON.stringify(filterState));
        console.log(`✅ Cleared ${viewName} filters`);
    } catch (error) {
        console.error('Error clearing filter state:', error);
    }
}

// Dashboard Quick Activity Widgets

function populateFiltersAndDisplay(properties, reservations) {
    const propertySelect = document.getElementById('propertySelect');
    propertySelect.innerHTML = '<option value="">Select Property</option>' +
        properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Populate property filter
    const propertyFilter = document.getElementById('propertyFilter');
    propertyFilter.innerHTML = '<option value="">All Properties</option>' +
        properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Populate month filter grouped by year (newest first)
    populateMonthFilter(reservations);

    // Restore saved filters BEFORE display to avoid double-render
    const savedFilters = loadFilterState('reservations');
    let hasActiveFilters = false;
    if (savedFilters) {
        if (savedFilters.search) {
            const si = document.getElementById('searchReservations');
            if (si) si.value = savedFilters.search;
            hasActiveFilters = true;
        }
        if (savedFilters.status) {
            const sf = document.getElementById('statusFilter');
            if (sf) sf.value = savedFilters.status;
            hasActiveFilters = true;
        }
        if (savedFilters.property) {
            const pf = document.getElementById('propertyFilter');
            if (pf) pf.value = savedFilters.property;
            hasActiveFilters = true;
        }
        if (savedFilters.bookingSource) {
            const bf = document.getElementById('bookingSourceFilter');
            if (bf) bf.value = savedFilters.bookingSource;
            hasActiveFilters = true;
        }
        if (savedFilters.month) {
            const mf = document.getElementById('monthFilter');
            if (mf) mf.value = savedFilters.month;
            // A specific month overrides chip presets — clear chip active state
            _activeMonthPreset = '';
            document.querySelectorAll('.month-chip').forEach(c => c.classList.remove('active'));
            hasActiveFilters = true;
        }
    }

    // Single render: apply filters if saved, otherwise show all
    if (hasActiveFilters) {
        filterReservations();
    } else {
        displayReservations(reservations);
    }

    // Attach filter event listeners ONCE using stable references
    _attachFilterListeners();
}

// Reservations
/**
 * Build a { booking_id -> 'verified' | 'pending' | 'rejected' | 'none' } map
 * so each reservation card can show a KYC badge without an extra query per
 * row. Worst status wins ("rejected" > "pending" > "verified").
 */
async function _buildKycStatusMap() {
    try {
        if (typeof supabase === 'undefined') return {};
        const { data, error } = await supabase
            .from('guest_documents')
            .select('booking_id, status');
        if (error || !data) return {};

        const rank = { rejected: 3, pending: 2, submitted: 2, verified: 1 };
        const map = {};
        for (const d of data) {
            if (!d.booking_id) continue;
            const current = map[d.booking_id];
            if (!current || (rank[d.status] || 0) > (rank[current] || 0)) {
                map[d.booking_id] = d.status;
            }
        }
        return map;
    } catch (_) {
        return {};
    }
}

function _attachKycStatus(reservations, kycMap) {
    for (const r of reservations) {
        r.kyc_status = kycMap[r.booking_id] || 'none';
    }
}

async function loadReservations(forceRefresh = false) {
    try {
        // Try to get from cache first
        const cachedReservations = dataCache.get('reservations', forceRefresh);
        const cachedProperties = dataCache.get('properties', forceRefresh);

        if (cachedReservations && cachedProperties) {
            allReservations = cachedReservations;
            const properties = cachedProperties;

            // Populate state for Kanban
            state.reservations = allReservations;
            state.properties = properties;

            // KYC statuses were attached on the previous fresh load (or the
            // last forceRefresh) and stored on the cached reservation rows.
            // No need to re-query — only the fresh path below rebuilds the
            // map. This avoids a network call on every navigation hit.

            // Quick render from cache
            populateFiltersAndDisplay(properties, allReservations);
            return;
        }

        // Fetch from database — load reservations, properties, and KYC map
        // in parallel so a slow KYC query doesn't delay the rest.
        const [resData, propsData, kycMap] = await Promise.all([
            db.getReservations(),
            db.getProperties(),
            _buildKycStatusMap()
        ]);
        allReservations = resData;
        const properties = propsData;
        _attachKycStatus(allReservations, kycMap);

        // Cache the results
        dataCache.set('reservations', allReservations);
        dataCache.set('properties', properties);

        // Also populate state object for Kanban board
        state.reservations = allReservations;
        state.properties = properties;
        
        const propertySelect = document.getElementById('propertySelect');
        propertySelect.innerHTML = '<option value="">Select Property</option>' + 
            properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        
        // Populate property filter
        const propertyFilter = document.getElementById('propertyFilter');
        propertyFilter.innerHTML = '<option value="">All Properties</option>' + 
            properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        
        // Populate month filter grouped by year (newest first)
        populateMonthFilter(allReservations);


        // Restore saved filters BEFORE display to avoid double-render
        const savedFilters = loadFilterState('reservations');
        let hasActiveFilters = false;
        if (savedFilters) {
            if (savedFilters.search) {
                const si = document.getElementById('searchReservations');
                if (si) si.value = savedFilters.search;
                hasActiveFilters = true;
            }
            if (savedFilters.status) {
                const sf = document.getElementById('statusFilter');
                if (sf) sf.value = savedFilters.status;
                hasActiveFilters = true;
            }
            if (savedFilters.property) {
                const pf = document.getElementById('propertyFilter');
                if (pf) pf.value = savedFilters.property;
                hasActiveFilters = true;
            }
            if (savedFilters.bookingSource) {
                const bf = document.getElementById('bookingSourceFilter');
                if (bf) bf.value = savedFilters.bookingSource;
                hasActiveFilters = true;
            }
            if (savedFilters.month) {
                const mf = document.getElementById('monthFilter');
                if (mf) mf.value = savedFilters.month;
                // A specific month overrides chip presets — clear chip active state
                _activeMonthPreset = '';
                document.querySelectorAll('.month-chip').forEach(c => c.classList.remove('active'));
                hasActiveFilters = true;
            }
        }

        // Single render: apply filters if saved, otherwise show all
        if (hasActiveFilters) {
            filterReservations();
        } else {
            displayReservations(allReservations);
        }

        // Attach filter event listeners ONCE using stable references
        _attachFilterListeners();
    } catch (error) {
        console.error('Reservations error:', error);
        showToast('Error', 'Failed to load reservations', '❌');
    }
}

/**
 * Render a tiny KYC status pill next to the guest name on the reservation
 * card. Empty for 'none' so reservations without a guest portal session
 * aren't visually cluttered.
 */
function _renderKycBadge(status) {
    const styles = {
        verified: { bg: '#dcfce7', fg: '#166534', icon: '✓', label: 'KYC' },
        pending:  { bg: '#fef3c7', fg: '#92400e', icon: '⏳', label: 'KYC' },
        submitted:{ bg: '#fef3c7', fg: '#92400e', icon: '⏳', label: 'KYC' },
        rejected: { bg: '#fee2e2', fg: '#991b1b', icon: '✕', label: 'KYC' }
    };
    const s = styles[status];
    if (!s) return '';
    return `<span title="KYC ${status}" style="background:${s.bg};color:${s.fg};padding:1px 6px;border-radius:8px;font-size:10px;font-weight:700;letter-spacing:0.02em;white-space:nowrap;">${s.icon} ${s.label}</span>`;
}

function displayReservations(reservations) {
    const tbody = document.getElementById('reservationsTableBody');
    if (reservations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="padding: 60px 20px; text-align: center; color: var(--text-secondary);">
            <div style="max-width: 320px; margin: 0 auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; margin-bottom: 16px;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                <div style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">No reservations found</div>
                <div style="font-size: 13px; line-height: 1.5;">Try adjusting your search or filters, or create a new reservation.</div>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = reservations.map(r => {
        const statusIcons = {
            'confirmed': '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
            'pending': '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            'checked-in': '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>',
            'checked-out': '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
            'cancelled': '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>'
        };

        const statusIcon = statusIcons[r.status] || statusIcons.pending;
        const isCancelled = r.status === 'cancelled';

        return `
            <tr ${isCancelled ? 'style="opacity: 0.6;"' : ''} data-booking-id="${r.booking_id}">
                <td style="width: 40px;">
                    <input type="checkbox" class="row-select-checkbox" data-booking-id="${r.booking_id}"
                           onchange="toggleRowSelection(this, '${r.booking_id}')" ${isCancelled ? 'disabled' : ''}>
                </td>
                <td>
                    <div class="res-booking-id-link" data-action="edit" data-bid="${r.booking_id}" style="font-weight: 700; color: var(--primary); cursor: pointer; ${isCancelled ? 'text-decoration: line-through;' : ''}" title="Click to edit">
                        ${r.booking_id || 'N/A'}
                    </div>
                    ${r.check_out ? `<div style="font-size: 10px; color: var(--text-tertiary); margin-top: 2px;">→ ${formatDate(r.check_out)}</div>` : ''}
                </td>
                <td>
                    <div style="font-weight: 600;">${r.property_name || '-'}</div>
                </td>
                <td>
                    ${r.booking_source ? getBookingSourceBadge(r.booking_source) : '<span style="font-size: 11px; color: var(--text-tertiary);">Direct</span>'}
                </td>
                <td>
                    <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                        <span>${r.guest_name || '-'}</span>
                        ${_renderKycBadge(r.kyc_status)}
                    </div>
                    ${r.guest_phone ? `<div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;"><i data-lucide="phone" style="width: 10px; height: 10px; margin-right: 2px;"></i>${r.guest_phone}</div>` : ''}
                </td>
                <td>
                    <div style="font-weight: 600; font-size: 13px;">${r.check_in ? formatDate(r.check_in) : '-'}</div>
                    ${r.check_in && r.check_out ? `<div style="font-size: 10px; color: var(--text-tertiary); margin-top: 2px;">to ${formatDate(r.check_out)}</div>` : ''}
                </td>
                <td style="text-align: center;">
                    <div style="font-weight: 700; font-size: 15px; color: var(--primary);">${r.nights || 0}</div>
                    <div style="font-size: 10px; color: var(--text-tertiary);">nights</div>
                </td>
                <td>
                    ${r.total_amount ? `
                        <div style="font-weight: 700; font-size: 14px; ${isCancelled ? 'text-decoration: line-through;' : ''}">
                            ${formatCurrency(r.total_amount)}
                        </div>
                        ${r.ota_service_fee > 0 ? `
                            <div style="font-size: 10px; color: var(--danger); margin-top: 2px;">
                                <i data-lucide="building" style="width: 9px; height: 9px; margin-right: 2px;"></i>Fee: ${formatCurrency(r.ota_service_fee)}
                            </div>
                            <div style="font-size: 10px; color: var(--success); margin-top: 2px; font-weight: 600;">
                                <i data-lucide="coins" style="width: 9px; height: 9px; margin-right: 2px;"></i>Net: ${formatCurrency(r.total_amount - r.ota_service_fee)}
                            </div>
                        ` : ''}
                    ` : '<span style="color: var(--text-tertiary); font-size: 12px;">—</span>'}
                </td>
                <td>
                    <div style="position: relative;">
                        <span class="res-status-badge ${r.status}" data-action="status-toggle" data-bid="${r.booking_id}">
                            ${statusIcon}${r.status.replace('-', ' ')}
                        </span>
                        <div class="status-dropdown" id="status-dropdown-${r.booking_id}">
                            ${['confirmed', 'pending', 'checked-in', 'checked-out', 'cancelled'].map(status => `
                                <div class="status-dropdown-item" data-action="change-status" data-bid="${r.booking_id}" data-status="${status}">
                                    ${statusIcons[status]}${status.replace('-', ' ')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="row-hover-actions">
                        <button class="quick-action-btn" data-action="payment" data-bid="${r.booking_id}" title="Add Payment">
                            <i data-lucide="credit-card" style="width: 11px; height: 11px;"></i>Pay
                        </button>
                        <button class="quick-action-btn" data-action="payment-history" data-bid="${r.booking_id}" title="Payment History">
                            <i data-lucide="history" style="width: 11px; height: 11px;"></i>
                        </button>
                        <button class="quick-action-btn" data-action="message" data-bid="${r.booking_id}" title="Send Message">
                            <i data-lucide="send" style="width: 11px; height: 11px;"></i>
                        </button>
                        <button class="quick-action-btn" data-action="edit" data-bid="${r.booking_id}" title="Edit">
                            <i data-lucide="edit" style="width: 11px; height: 11px;"></i>
                        </button>
                        ${!isCancelled ? `<button class="quick-action-btn" data-action="delete" data-bid="${r.booking_id}" title="Delete" style="color: var(--danger);">
                            <i data-lucide="trash-2" style="width: 11px; height: 11px;"></i>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Refresh Lucide icons — scoped to table only to avoid full-DOM scan
    requestAnimationFrame(() => {
        try {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons({ nodes: [tbody] });
            } else if (typeof refreshIcons === 'function') {
                refreshIcons();
            }
        } catch (e) {
            // Fallback to full refresh if scoped fails
            if (typeof refreshIcons === 'function') refreshIcons();
        }
    });
}
// Toggle status dropdown
function toggleStatusDropdown(event, bookingId) {
    event.stopPropagation();
    const dropdown = document.getElementById(`status-dropdown-${bookingId}`);
    const allDropdowns = document.querySelectorAll('.status-dropdown');
    
    // Close all other dropdowns
    allDropdowns.forEach(d => {
        if (d.id !== `status-dropdown-${bookingId}`) {
            d.classList.remove('active');
        }
    });
    
    dropdown.classList.toggle('active');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function() {
    document.querySelectorAll('.status-dropdown.active').forEach(d => d.classList.remove('active'));
});

// ── Event Delegation for Reservation Table ──
// Uses data-action attributes so clicks survive DOM re-renders (innerHTML)
(function initReservationTableDelegation() {
    function handleTableClick(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        const bid = actionEl.dataset.bid;
        if (!bid) return;

        switch (action) {
            case 'edit':
                openQuickEditModal(bid);
                break;
            case 'payment':
                openPaymentModal(bid);
                break;
            case 'payment-history':
                viewPaymentHistory(bid);
                break;
            case 'message':
                openMessagingModal(bid, 'whatsapp');
                break;
            case 'delete':
                deleteReservation(bid);
                break;
            case 'status-toggle':
                e.stopPropagation();
                toggleStatusDropdown(e, bid);
                break;
            case 'change-status':
                e.stopPropagation();
                changeReservationStatus(bid, actionEl.dataset.status);
                break;
        }
    }

    // Attach once — delegate handles all current and future rows
    const tbody = document.getElementById('reservationsTableBody');
    if (tbody) {
        tbody.addEventListener('click', handleTableClick);
    } else {
        // Table may not exist yet; wait for DOM
        document.addEventListener('DOMContentLoaded', function() {
            const tb = document.getElementById('reservationsTableBody');
            if (tb) tb.addEventListener('click', handleTableClick);
        });
    }
})();

// Change reservation status inline — optimistic update without full reload
async function changeReservationStatus(bookingId, newStatus) {
    try {
        // Optimistic UI update: patch local data + re-render affected row
        const reservation = allReservations.find(r => r.booking_id === bookingId);
        if (reservation) {
            reservation.status = newStatus;
        }

        // Close the dropdown immediately
        document.querySelectorAll('.status-dropdown.active').forEach(d => d.classList.remove('active'));

        // Re-display current filtered list (cheap — just innerHTML, no DB call)
        if (filteredReservationsForExport.length > 0) {
            displayReservations(filteredReservationsForExport);
        } else {
            displayReservations(allReservations);
        }

        // Persist to database in background
        const { error } = await supabase
            .from('reservations')
            .update({ status: newStatus })
            .eq('booking_id', bookingId);

        if (error) throw error;

        // Invalidate cache so next full load fetches fresh data
        dataCache.invalidate('reservations');

        showToast('Status Updated', `Reservation ${bookingId} is now ${newStatus}`, '✅');
    } catch (error) {
        console.error('Status update error:', error);
        showToast('Error', 'Failed to update status', '❌');
        // On failure, reload to get server truth
        dataCache.invalidate('reservations');
        await loadReservations();
    }
}

// Store filtered reservations for CSV export
let filteredReservationsForExport = [];

// Current active month chip preset ('all' | 'this-month' | 'last-month' | 'next-month' | 'this-year' | 'custom' | '' if user picked a specific month)
let _activeMonthPreset = 'all';
// Custom range state (set when preset === 'custom')
let _customRangeFrom = null; // 'YYYY-MM-DD' or null
let _customRangeTo = null;   // 'YYYY-MM-DD' or null

// ── Stable debounced filter reference (so removeEventListener actually works) ──
const _stableDebouncedFilter = debounce(filterReservations, 300);
let _filterListenersAttached = false;

/**
 * Populate the month dropdown (desktop + mobile) with unique months
 * grouped by year for easier navigation as history grows.
 */
function populateMonthFilter(reservations) {
    const months = [...new Set((reservations || []).map(r => r.month).filter(Boolean))];
    // Sort by actual date (newest first) — string sort would put "Apr 2026" before "Mar 2026" alphabetically
    months.sort((a, b) => new Date('01 ' + b) - new Date('01 ' + a));

    // Group by year
    const byYear = {};
    for (const m of months) {
        const year = m.split(' ')[1];
        (byYear[year] = byYear[year] || []).push(m);
    }
    const years = Object.keys(byYear).sort().reverse();

    const html = '<option value="">All Months</option>' + years.map(year =>
        `<optgroup label="${year}">` +
        byYear[year].map(m => `<option value="${m}">${m}</option>`).join('') +
        `</optgroup>`
    ).join('');

    const desktop = document.getElementById('monthFilter');
    const mobile = document.getElementById('monthFilterMobile');
    if (desktop) desktop.innerHTML = html;
    if (mobile) mobile.innerHTML = html;
}

/**
 * Get "Mon YYYY" strings covered by a preset. Empty array = no month filter.
 */
function getMonthsForPreset(preset) {
    const fmt = d => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    switch (preset) {
        case 'this-month': return [fmt(thisMonth)];
        case 'last-month': return [fmt(lastMonth)];
        case 'next-month': return [fmt(nextMonth)];
        case 'this-year': {
            const y = now.getFullYear();
            return Array.from({ length: 12 }, (_, i) => fmt(new Date(y, i, 1)));
        }
        default: return [];
    }
}

/**
 * Handle a chip click. Updates the active chip, clears the month dropdown,
 * and re-filters.
 */
function applyMonthChip(preset, chipEl, fromMobile) {
    _activeMonthPreset = preset;

    // Update active state on all chips (desktop + mobile in sync)
    document.querySelectorAll('.month-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll(`.month-chip[data-preset="${preset}"], .month-chip[data-preset-mobile="${preset}"]`)
        .forEach(c => c.classList.add('active'));

    // Clear the specific-month dropdown so it doesn't compete with the chip
    const monthEl = document.getElementById('monthFilter');
    const monthMobileEl = document.getElementById('monthFilterMobile');
    if (monthEl) monthEl.value = '';
    if (monthMobileEl) monthMobileEl.value = '';

    // Show/hide the custom date range inputs
    const customRow = document.getElementById('customRangeRow');
    const customRowMobile = document.getElementById('customRangeRowMobile');
    if (preset === 'custom') {
        if (customRow) customRow.style.display = 'flex';
        if (customRowMobile) customRowMobile.style.display = 'block';
        // Don't filter yet — wait for user to pick dates
        if (!_customRangeFrom && !_customRangeTo) {
            if (typeof updateActiveFilterCount === 'function') updateActiveFilterCount();
            return;
        }
    } else {
        if (customRow) customRow.style.display = 'none';
        if (customRowMobile) customRowMobile.style.display = 'none';
        _customRangeFrom = null;
        _customRangeTo = null;
    }

    filterReservations();
    if (typeof updateActiveFilterCount === 'function') updateActiveFilterCount();
}

function applyCustomRange() {
    const fromEl = document.getElementById('customRangeFrom');
    const toEl = document.getElementById('customRangeTo');
    const fromMobileEl = document.getElementById('customRangeFromMobile');
    const toMobileEl = document.getElementById('customRangeToMobile');

    _customRangeFrom = (fromEl && fromEl.value) || null;
    _customRangeTo = (toEl && toEl.value) || null;

    // Keep mobile inputs in sync with desktop
    if (fromMobileEl && _customRangeFrom) fromMobileEl.value = _customRangeFrom;
    if (toMobileEl && _customRangeTo) toMobileEl.value = _customRangeTo;

    _activeMonthPreset = 'custom';
    document.querySelectorAll('.month-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.month-chip[data-preset="custom"], .month-chip[data-preset-mobile="custom"]')
        .forEach(c => c.classList.add('active'));

    filterReservations();
    if (typeof updateActiveFilterCount === 'function') updateActiveFilterCount();
}

function clearCustomRange() {
    _customRangeFrom = null;
    _customRangeTo = null;
    ['customRangeFrom', 'customRangeTo', 'customRangeFromMobile', 'customRangeToMobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    filterReservations();
    if (typeof updateActiveFilterCount === 'function') updateActiveFilterCount();
}

/**
 * Called when the user picks a specific month from the dropdown.
 * Deactivates the chips (a specific month overrides any preset).
 */
function onMonthDropdownChange() {
    const monthEl = document.getElementById('monthFilter');
    const monthMobileEl = document.getElementById('monthFilterMobile');
    if (monthEl && monthMobileEl) monthMobileEl.value = monthEl.value;

    if (monthEl && monthEl.value) {
        // User picked a specific month — clear chip active states
        _activeMonthPreset = '';
        document.querySelectorAll('.month-chip').forEach(c => c.classList.remove('active'));
    } else {
        // Dropdown cleared — fall back to "All"
        _activeMonthPreset = 'all';
        document.querySelectorAll('.month-chip').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.month-chip[data-preset="all"], .month-chip[data-preset-mobile="all"]')
            .forEach(c => c.classList.add('active'));
    }
    filterReservations();
}

function filterReservations() {
    const search = document.getElementById('searchReservations').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const property = document.getElementById('propertyFilter').value;
    const bookingSource = document.getElementById('bookingSourceFilter').value;
    const month = document.getElementById('monthFilter').value;

    // Chip-based month set (empty = no chip restriction). A specific month
    // dropdown value takes precedence over the chip. Custom range uses
    // check_in dates directly, not the month string.
    const isCustom = !month && _activeMonthPreset === 'custom';
    const chipMonths = (!month && !isCustom && _activeMonthPreset && _activeMonthPreset !== 'all')
        ? new Set(getMonthsForPreset(_activeMonthPreset))
        : null;

    filteredReservationsForExport = allReservations.filter(r => {
        const matchesSearch = !search ||
            (r.guest_name || '').toLowerCase().includes(search) ||
            (r.booking_id || '').toLowerCase().includes(search) ||
            (r.guest_phone || '').toLowerCase().includes(search) ||
            (r.property_name || '').toLowerCase().includes(search);

        const matchesStatus = !status || r.status === status;
        const matchesProperty = !property || r.property_id == property;
        const matchesBookingSource = !bookingSource || r.booking_source === bookingSource;

        let matchesMonth = true;
        if (month) {
            matchesMonth = r.month === month;
        } else if (isCustom) {
            // Filter on check_in date within the custom range (inclusive on both ends).
            // Empty from/to means unbounded on that side.
            if (!r.check_in) {
                matchesMonth = false;
            } else {
                const ci = r.check_in;
                if (_customRangeFrom && ci < _customRangeFrom) matchesMonth = false;
                if (matchesMonth && _customRangeTo && ci > _customRangeTo) matchesMonth = false;
            }
        } else if (chipMonths) {
            matchesMonth = chipMonths.has(r.month);
        }
        
        return matchesSearch && matchesStatus && matchesProperty && matchesBookingSource && matchesMonth;
    });
    
    displayReservations(filteredReservationsForExport);
    // Save filter state
    saveFilterState('reservations', {
        search: document.getElementById('searchReservations').value,
        status: document.getElementById('statusFilter').value,
        property: document.getElementById('propertyFilter').value,
        bookingSource: document.getElementById('bookingSourceFilter').value,
        month: document.getElementById('monthFilter').value
    });
}

/**
 * Attach filter event listeners exactly ONCE using stable function references.
 * Uses a flag to prevent duplicate listeners accumulating on repeated loadReservations() calls.
 */
function _attachFilterListeners() {
    if (_filterListenersAttached) return;

    const searchInput = document.getElementById('searchReservations');
    const statusFilter = document.getElementById('statusFilter');
    const propertyFilterEl = document.getElementById('propertyFilter');
    const bookingSourceFilter = document.getElementById('bookingSourceFilter');
    const monthFilterEl = document.getElementById('monthFilter');

    if (searchInput) {
        searchInput.addEventListener('input', _stableDebouncedFilter);
        searchInput.addEventListener('keypress', _filterOnEnter);
    }
    if (statusFilter) statusFilter.addEventListener('change', filterReservations);
    if (propertyFilterEl) propertyFilterEl.addEventListener('change', filterReservations);
    if (bookingSourceFilter) bookingSourceFilter.addEventListener('change', filterReservations);
    if (monthFilterEl) monthFilterEl.addEventListener('change', filterReservations);

    _filterListenersAttached = true;
}

function _filterOnEnter(e) {
    if (e.key === 'Enter') filterReservations();
}

function clearFilters() {
    document.getElementById('searchReservations').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('propertyFilter').value = '';
    document.getElementById('bookingSourceFilter').value = '';
    document.getElementById('monthFilter').value = '';
    const monthMobile = document.getElementById('monthFilterMobile');
    if (monthMobile) monthMobile.value = '';

    // Reset chips to "All"
    _activeMonthPreset = 'all';
    document.querySelectorAll('.month-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.month-chip[data-preset="all"], .month-chip[data-preset-mobile="all"]')
        .forEach(c => c.classList.add('active'));

    // Reset custom range
    _customRangeFrom = null;
    _customRangeTo = null;
    ['customRangeFrom', 'customRangeTo', 'customRangeFromMobile', 'customRangeToMobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const customRow = document.getElementById('customRangeRow');
    const customRowMobile = document.getElementById('customRangeRowMobile');
    if (customRow) customRow.style.display = 'none';
    if (customRowMobile) customRowMobile.style.display = 'none';

    filteredReservationsForExport = [];
    displayReservations(allReservations);

    // Clear saved filter state
    clearFilterState('reservations');
    showToast('Filters Cleared', 'Showing all reservations', 'ℹ️');
}

function toggleReservationCodeField() {
    const bookingSource = document.getElementById('bookingSource').value;
    const reservationCodeRow = document.getElementById('reservationCodeRow');
    const reservationCodeInput = document.getElementById('reservationCode');
    
    // Show field for OTA bookings
    const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO'];
    
    if (otaSources.includes(bookingSource)) {
        reservationCodeRow.style.display = 'flex';
        reservationCodeInput.required = true;
    } else {
        reservationCodeRow.style.display = 'none';
        reservationCodeInput.required = false;
        reservationCodeInput.value = ''; // Clear value when hidden
    }
}

// Show/hide OTA service fee field based on booking source
function toggleOtaServiceFeeField() {
    const bookingSource = document.getElementById('bookingSource').value;
    const otaServiceFeeGroup = document.getElementById('otaServiceFeeGroup');
    const otaServiceFeeInput = document.getElementById('otaServiceFee');
    const stayAmountHint = document.getElementById('stayAmountHint');

    const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO'];

    if (otaSources.includes(bookingSource)) {
        otaServiceFeeGroup.style.display = 'block';
        if (stayAmountHint) stayAmountHint.textContent = '(Enter gross/full amount)';
    } else {
        otaServiceFeeGroup.style.display = 'none';
        otaServiceFeeInput.value = '0';
        if (stayAmountHint) stayAmountHint.textContent = '';
    }
}
    // ============================================

// ============================================
// BOOKING WIZARD NAVIGATION
// ============================================
var _wizardStep = 1;

function goToWizardStep(step) {
    var totalSteps = 4;
    // Deactivate all panels and steps
    for (var i = 1; i <= totalSteps; i++) {
        var panel = document.getElementById('wp-' + i);
        var stepEl = document.getElementById('ws-' + i);
        if (panel) panel.classList.remove('wp-active');
        if (stepEl) {
            stepEl.classList.remove('ws-active', 'ws-done');
            if (i < step) stepEl.classList.add('ws-done');
            else if (i === step) stepEl.classList.add('ws-active');
        }
    }
    // Activate current panel
    var currentPanel = document.getElementById('wp-' + step);
    if (currentPanel) currentPanel.classList.add('wp-active');

    // Update connector colours
    for (var c = 1; c <= totalSteps - 1; c++) {
        var conn = document.getElementById('wc-' + c);
        if (conn) {
            conn.style.background = c < step ? 'var(--success)' : 'var(--border)';
        }
    }

    // Update step numbers – show checkmark SVG for done steps
    for (var n = 1; n <= totalSteps; n++) {
        var numEl = document.getElementById('wsn-' + n);
        if (!numEl) continue;
        if (n < step) {
            numEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        } else {
            numEl.textContent = n;
        }
    }

    // Show/hide nav buttons
    var backBtn = document.getElementById('wizardBackBtn');
    var nextBtn = document.getElementById('wizardNextBtn');
    var saveBtn = document.getElementById('wizardSaveBtn');
    if (backBtn) backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.style.display = step < totalSteps ? 'inline-flex' : 'none';
    if (saveBtn) saveBtn.style.display = step === totalSteps ? 'inline-flex' : 'none';

    // Render review on last step
    if (step === totalSteps) renderWizardReview();

    _wizardStep = step;
    if (typeof refreshIcons === 'function') refreshIcons();
}

function validateWizardStep(step) {
    if (step === 1) {
        var name = (document.getElementById('guestName').value || '').trim();
        var phone = (document.getElementById('guestPhone').value || '').trim();
        if (!name) { showToast('Required', 'Please enter the guest name', '⚠️'); return false; }
        if (!phone) { showToast('Required', 'Please enter the phone number', '⚠️'); return false; }
    } else if (step === 2) {
        var prop = document.getElementById('propertySelect').value;
        var checkIn = document.getElementById('checkInDate').value;
        var checkOut = document.getElementById('checkOutDate').value;
        if (!prop) { showToast('Required', 'Please select a property', '⚠️'); return false; }
        if (!checkIn) { showToast('Required', 'Please select a check-in date', '⚠️'); return false; }
        if (!checkOut) { showToast('Required', 'Please select a check-out date', '⚠️'); return false; }
        if (new Date(checkOut) <= new Date(checkIn)) { showToast('Invalid Dates', 'Check-out must be after check-in', '⚠️'); return false; }
    }
    return true;
}

function nextWizardStep() {
    if (!validateWizardStep(_wizardStep)) return;
    if (_wizardStep < 4) goToWizardStep(_wizardStep + 1);
}

function prevWizardStep() {
    if (_wizardStep > 1) goToWizardStep(_wizardStep - 1);
}

/**
 * Fetch the last 3 communications for a given booking and render them
 * inline on Step 4 of the reservation wizard. Lets the operator see
 * what's been said to the guest without leaving the modal.
 */
async function renderReservationMessages(bookingId) {
    const wrap = document.getElementById('wizardRecentMessages');
    const list = document.getElementById('wizardRecentMessagesList');
    if (!wrap || !list) return;
    if (!bookingId) { wrap.style.display = 'none'; return; }

    try {
        const { data, error } = await supabase
            .from('communications')
            .select('message_type, subject, message_content, status, sent_at')
            .eq('booking_id', bookingId)
            .order('sent_at', { ascending: false })
            .limit(3);

        if (error || !data || data.length === 0) {
            wrap.style.display = 'none';
            return;
        }

        const channelIcon = { email: '✉️', whatsapp: '💬', sms: '📱' };
        list.innerHTML = data.map(m => {
            const when = m.sent_at ? new Date(m.sent_at).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            }) : '';
            const icon = channelIcon[m.message_type] || '💬';
            const preview = (m.message_content || '').replace(/<[^>]+>/g, '').slice(0, 80);
            const subject = m.subject ? `<strong>${escapeHtml(m.subject)}</strong> · ` : '';
            return `
                <div style="font-size: 12px; line-height: 1.5; color: var(--text-secondary); padding: 6px 0; border-bottom: 1px solid var(--border);">
                    <div style="color: var(--text-primary); margin-bottom: 2px;">
                        ${icon} ${subject}<span style="color: var(--text-tertiary); font-size: 11px;">${escapeHtml(when)}</span>
                    </div>
                    ${escapeHtml(preview)}${preview.length >= 80 ? '…' : ''}
                </div>
            `;
        }).join('');
        wrap.style.display = 'block';
    } catch (_) {
        wrap.style.display = 'none';
    }
}

// Light HTML escape so user-provided subject/message can't break the
// review card layout or inject markup.
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderWizardReview() {
    var prop = document.getElementById('propertySelect');
    var propName = prop.options[prop.selectedIndex] ? prop.options[prop.selectedIndex].text : '-';
    var status = document.getElementById('bookingStatus').value || '-';
    var type = document.getElementById('bookingType').value || '-';
    var source = document.getElementById('bookingSource').value || '-';
    var checkIn = document.getElementById('checkInDate').value || '-';
    var checkOut = document.getElementById('checkOutDate').value || '-';
    var nights = document.getElementById('nights').value || '0';
    var rooms = document.getElementById('numberOfRooms').value || '1';
    var adults = document.getElementById('adults').value || '-';
    var kids = document.getElementById('kids').value || '0';
    var guestName = document.getElementById('guestName').value || '-';
    var guestPhone = document.getElementById('guestPhone').value || '-';
    var guestEmail = document.getElementById('guestEmail').value || '-';
    var guestCity = document.getElementById('guestCity').value || '-';
    // Parse every amount via Money so the displayed totals never show
    // float drift like 99.99999. sumPaise gives an exact integer total.
    var stayPaise = Money.parseRupeesToPaise(document.getElementById('stayAmount').value);
    var extraPaise = Money.parseRupeesToPaise(document.getElementById('extraGuestCharges').value);
    var mealsPaise = Money.parseRupeesToPaise(document.getElementById('mealsChef').value);
    var bonfirePaise = Money.parseRupeesToPaise(document.getElementById('bonfireOther').value);
    var taxesPaise = Money.parseRupeesToPaise(document.getElementById('taxes').value);
    var damagesPaise = Money.parseRupeesToPaise(document.getElementById('damages').value);
    var hostizzyPaise = Money.parseRupeesToPaise(document.getElementById('hostizzyRevenue').value);
    var totalPaise = stayPaise + extraPaise + mealsPaise + bonfirePaise + taxesPaise + damagesPaise;
    var fmt = function(paise) { return Money.paiseToDisplay(paise); };
    var stayAmt = fmt(stayPaise);
    var extraGuest = fmt(extraPaise);
    var meals = fmt(mealsPaise);
    var bonfire = fmt(bonfirePaise);
    var taxes = fmt(taxesPaise);
    var damages = fmt(damagesPaise);
    var hostizzy = fmt(hostizzyPaise);
    var total = fmt(totalPaise);

    var html = '<div class="wizard-review-section">' +
        '<div class="wizard-review-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Guest</div>' +
        row('Name', guestName) + row('Phone', guestPhone) + row('Email', guestEmail) + row('From', guestCity) +
        '</div>' +
        '<div class="wizard-review-section">' +
        '<div class="wizard-review-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> Booking</div>' +
        row('Property', propName) + row('Status', status) + row('Type', type) + row('Source', source) +
        row('Check-in', checkIn) + row('Check-out', checkOut) + row('Nights', nights) +
        row('Rooms', rooms) + row('Adults', adults) + row('Kids', kids) +
        '</div>' +
        '<div class="wizard-review-section">' +
        '<div class="wizard-review-section-title"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="1" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Pricing</div>' +
        row('Stay Amount', stayAmt) + row('Extra Guest Charges', extraGuest) +
        row('Meals/Chef', meals) + row('Bonfire/Other', bonfire) +
        row('Taxes', taxes) + row('Damages', damages) +
        row('Hostizzy Revenue', hostizzy) +
        '<div class="wizard-review-row" style="margin-top: 8px; padding-top: 10px; border-top: 2px solid var(--primary); border-bottom: none;">' +
        '<span class="wizard-review-label" style="font-weight: 700; color: var(--text-primary);">Total Amount</span>' +
        '<span class="wizard-review-value" style="font-size: 16px; color: var(--primary);">' + total + '</span></div>' +
        '</div>';

    function row(label, value) {
        return '<div class="wizard-review-row"><span class="wizard-review-label">' + label + '</span><span class="wizard-review-value">' + value + '</span></div>';
    }

    document.getElementById('wizardReviewContent').innerHTML = html;
}

/**
 * Apply the saved Quick mode preference to the reservation modal.
 * Quick mode hides every form element flagged [data-advanced] so a
 * small operator only sees the ~8 fields they actually need.
 */
function applyReservationQuickMode() {
    const modal = document.getElementById('reservationModal');
    const toggle = document.getElementById('reservationQuickMode');
    if (!modal || !toggle) return;
    // Default ON for new operators (no preference saved yet) so the
    // first-run reservation form isn't overwhelming. Returning users
    // who explicitly turned it off keep it off.
    const saved = localStorage.getItem('reservation_quick_mode');
    const enabled = saved === null ? true : saved === 'true';
    toggle.checked = enabled;
    modal.classList.toggle('quick-mode', enabled);
}

function toggleReservationQuickMode() {
    const modal = document.getElementById('reservationModal');
    const toggle = document.getElementById('reservationQuickMode');
    if (!modal || !toggle) return;
    modal.classList.toggle('quick-mode', toggle.checked);
    localStorage.setItem('reservation_quick_mode', String(toggle.checked));
    if (window.SettingsStore) {
        SettingsStore.set('reservation_quick_mode', String(toggle.checked));
    }
}


/**
 * Show the room picker only when the selected property actually has rooms.
 * A property with none is sold whole, which is the existing behaviour and
 * the common case for villas and farmstays.
 */
async function onReservationPropertyChange(preselectRoomId) {
    const propEl  = document.getElementById('propertySelect');
    const group   = document.getElementById('reservationRoomGroup');
    const roomEl  = document.getElementById('reservationRoom');
    if (!propEl || !group || !roomEl) return;

    const propertyId = propEl.value;
    if (!propertyId) { group.style.display = 'none'; roomEl.innerHTML = '<option value="">Whole property</option>'; return; }

    let rooms = [];
    try {
        rooms = await db.getRooms(parseInt(propertyId));
    } catch (e) {
        console.warn('[rooms] could not load:', e.message);
    }

    if (!rooms.length) {
        group.style.display = 'none';
        roomEl.innerHTML = '<option value="">Whole property</option>';
        roomEl.value = '';
        return;
    }

    group.style.display = '';
    roomEl.innerHTML = '<option value="">Whole property</option>' +
        rooms.filter(r => r.is_active !== false)
             .map(r => `<option value="${r.id}">${escapeHtml(r.name)}${r.capacity ? ` &middot; sleeps ${r.capacity}` : ''}</option>`)
             .join('');
    roomEl.value = preselectRoomId != null ? String(preselectRoomId) : '';
}

function openReservationModal(booking_id = null) {
    const modal = document.getElementById('reservationModal');
    applyReservationQuickMode();

    // Load recent messages inline on the Review step — only meaningful
    // when editing an existing booking. Fire-and-forget so we don't
    // block the modal opening on a network call.
    renderReservationMessages(booking_id);

    if (booking_id) {
        const r = allReservations.find(res => res.booking_id === booking_id);
        if (!r) {
            showToast('Error', 'Reservation not found', '❌');
            return;
        }
        document.getElementById('reservationModalTitle').textContent = 'Edit Reservation';
        document.getElementById('editReservationId').value = r.id;
        document.getElementById('propertySelect').value = r.property_id;
        onReservationPropertyChange(r.room_id);
        document.getElementById('bookingStatus').value = r.status;
        document.getElementById('bookingType').value = r.booking_type || 'STAYCATION';
        document.getElementById('checkInDate').value = r.check_in;
        document.getElementById('checkOutDate').value = r.check_out;
        document.getElementById('guestName').value = r.guest_name;
        document.getElementById('guestPhone').value = r.guest_phone;
        document.getElementById('guestEmail').value = r.guest_email || '';
        document.getElementById('guestCity').value = r.guest_city || '';
        document.getElementById('bookingSource').value = r.booking_source || 'DIRECT';
        document.getElementById('reservationCode').value = r.booking_id || '';
        toggleReservationCodeField();
        document.getElementById('numberOfRooms').value = r.number_of_rooms || 1;
        document.getElementById('adults').value = r.adults || 2;
        document.getElementById('kids').value = r.kids || 0;
        document.getElementById('stayAmount').value = r.stay_amount || 0;
        document.getElementById('extraGuestCharges').value = r.extra_guest_charges || 0;
        document.getElementById('mealsChef').value = r.meals_chef || 0;
        document.getElementById('bonfireOther').value = r.bonfire_other || 0;
        document.getElementById('taxes').value = r.taxes || 0;
        document.getElementById('damages').value = r.damages || 0;
        document.getElementById('hostizzyRevenue').value = r.hostizzy_revenue || 0;
        document.getElementById('otaServiceFee').value = r.ota_service_fee || 0;
        toggleOtaServiceFeeField();
        //Recalculate Hostizzy Revenue for edits
        setTimeout(() => {
            calculateHostizzyRevenue(parseFloat(r.stay_amount) || 0, parseFloat(r.extra_guest_charges) || 0);
        }, 100);
        document.getElementById('gstStatus').value = r.gst_status || 'gst';
        document.getElementById('gstRateMode').value = r.gst_rate_mode || 'auto';
        handleGstRateChange();
    } else {
        document.getElementById('reservationModalTitle').textContent = 'New Reservation';
        document.getElementById('editReservationId').value = '';
        document.querySelectorAll('#reservationModal input, #reservationModal select').forEach(el => {
            if (el.type === 'number') el.value = el.id === 'adults' ? 2 : (el.id === 'numberOfRooms' ? 1 : 0);
            else if (el.type !== 'hidden') el.value = '';
        });
        document.getElementById('bookingStatus').value = 'pending';
        document.getElementById('bookingSource').value = 'DIRECT';
        document.getElementById('reservationCode').value = '';
        toggleReservationCodeField(); // Reset visibility
        toggleOtaServiceFeeField(); // Reset OTA fee visibility
        onReservationPropertyChange();
    }
    modal.classList.add('active');
    // Reset wizard to step 1 every time the modal opens
    goToWizardStep(1);
}

function closeReservationModal() {
    document.getElementById('reservationModal').classList.remove('active');
    _wizardStep = 1;
}

// Handle GST rate mode change
function handleGstRateChange() {
    const mode = document.getElementById('gstRateMode').value;
    const taxesInput = document.getElementById('taxes');
    const hintEl = document.getElementById('gstRateHint');

    if (mode === 'custom') {
        // Allow manual input
        taxesInput.readOnly = false;
        taxesInput.style.background = '#ffffff';
        hintEl.textContent = 'Enter tax amount manually';
    } else {
        taxesInput.readOnly = true;
        taxesInput.style.background = '#f1f5f9';
        if (mode === 'auto') {
            hintEl.textContent = 'Auto: 5% for \u2264\u20B97500/night, 18% for >\u20B97500/night';
        } else {
            hintEl.textContent = mode + '% GST applied on stay + extra guest charges';
        }
        calculateTaxes();
    }
}

// Called when user types in tax field (custom mode)
function onManualTaxInput() {
    const stayAmount = parseFloat(document.getElementById('stayAmount').value) || 0;
    const extraGuestCharges = parseFloat(document.getElementById('extraGuestCharges').value) || 0;
    calculateHostizzyRevenue(stayAmount, extraGuestCharges);
}

// Auto-calculate taxes based on per night rate or manual GST rate
function calculateTaxes() {
    const gstStatus = document.getElementById('gstStatus').value;
    const taxesInput = document.getElementById('taxes');
    const gstRateMode = document.getElementById('gstRateMode').value;

    // If Non-GST, clear taxes and disable field
    if (gstStatus === 'non_gst') {
        taxesInput.value = '0';
        taxesInput.readOnly = true;
        taxesInput.style.background = '#e2e8f0';
        return;
    }

    // If custom mode, don't overwrite manual input
    if (gstRateMode === 'custom') {
        taxesInput.readOnly = false;
        taxesInput.style.background = '#ffffff';
        // Still calculate Hostizzy Revenue
        const stayAmount = parseFloat(document.getElementById('stayAmount').value) || 0;
        const extraGuestCharges = parseFloat(document.getElementById('extraGuestCharges').value) || 0;
        calculateHostizzyRevenue(stayAmount, extraGuestCharges);
        return;
    }

    // Re-enable and calculate for GST
    taxesInput.readOnly = true;
    taxesInput.style.background = '#f1f5f9';

    const checkIn = document.getElementById('checkInDate').value;
    const checkOut = document.getElementById('checkOutDate').value;

    if (!checkIn || !checkOut) return;

    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return;

    // Parse user input through Money helpers so the math is done on
    // integer paise. This prevents float-drift artifacts like
    // ₹100.00999... showing up after a few add/multiply ops.
    const stayPaise = Money.parseRupeesToPaise(document.getElementById('stayAmount').value);
    const extraPaise = Money.parseRupeesToPaise(document.getElementById('extraGuestCharges').value);

    const preTaxPaise = stayPaise + extraPaise;
    const preTaxRupees = Money.paiseToRupees(preTaxPaise);

    let taxRate = 0;
    if (gstRateMode === 'auto') {
        // Auto: 5% if ≤7500/night, 18% if >7500/night
        const perNightRate = preTaxRupees / nights;
        taxRate = perNightRate <= 7500 ? 0.05 : 0.18;
    } else {
        // Manual rate: 5, 12, or 18
        taxRate = parseFloat(gstRateMode) / 100;
    }

    // Round taxes through paise so the displayed value matches what we save.
    const taxesPaise = Math.round(preTaxPaise * taxRate);
    taxesInput.value = (taxesPaise / 100).toFixed(2);

    // Auto-calculate Hostizzy Revenue
    calculateHostizzyRevenue(Money.paiseToRupees(stayPaise), Money.paiseToRupees(extraPaise));
}

async function calculateHostizzyRevenue(stayAmount, extraGuestCharges) {
    try {
        const propertyId = parseInt(document.getElementById('propertySelect').value);
        if (!propertyId) {
            document.getElementById('hostizzyRevenue').value = '0';
            return;
        }

        const revenueSharePercent = await db.getRevenueSharePercent(propertyId);
        // No silent default — if the property has no rate set, leave the field blank
        // and surface a warning. The user must fix the property before saving.
        if (revenueSharePercent == null) {
            document.getElementById('hostizzyRevenue').value = '';
            return;
        }
        const otaServiceFee = parseFloat(document.getElementById('otaServiceFee').value) || 0;
        // Revenue base: (stay - OTA fee + extra guest charges) * rev%
        // Don't earn commission on OTA's cut
        const hostizzyRevenue = calculateHostizzyRevenueAmount(stayAmount, extraGuestCharges, otaServiceFee, revenueSharePercent);

        document.getElementById('hostizzyRevenue').value = hostizzyRevenue.toFixed(2);
    } catch (error) {
        console.error('Error calculating Hostizzy Revenue:', error);
        document.getElementById('hostizzyRevenue').value = '0';
    }
}

async function saveReservation() {
    const propertyId = parseInt(document.getElementById('propertySelect').value);
    
    if (!propertyId) {
        showToast('Validation Error', 'Please select a property', '❌');
        return;
    }
    
// Check online status
    if (!navigator.onLine) {
        if (!confirm('You are offline. This reservation will be saved locally and synced when you are back online. Continue?')) {
            return;
        }
    }
    
    try {
        const properties = await db.getProperties();
        const property = properties.find(p => p.id === propertyId);
        
        if (!property) {
            showToast('Error', 'Property not found', '❌');
            return;
        }

        // Snapshot the canonical commission rate from the property record so it
        // can be persisted on the reservation row. Required — no silent default.
        // (Cancelled reservations skip this check; their commission fields are
        // nulled out by the cleanup block below.)
        const propertyRate = property.revenue_share_percent;
        const cancelledNow = document.getElementById('bookingStatus').value === 'cancelled';
        if (!cancelledNow && (propertyRate == null || propertyRate === '')) {
            showToast(
                'Validation Error',
                `Property "${property.name}" has no commission rate set. Please configure revenue_share_percent in Property Settings before saving.`,
                '❌'
            );
            return;
        }

        const checkIn = document.getElementById('checkInDate').value;
        const checkOut = document.getElementById('checkOutDate').value;
        
        if (!checkIn || !checkOut) {
            showToast('Validation Error', 'Check-out date must be after check-in date', '❌');
            return;
        }
        
        // Validate reservation code for OTA bookings
        const bookingSource = document.getElementById('bookingSource').value;
        const reservationCode = document.getElementById('reservationCode').value.trim();
        const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO'];
        
        if (otaSources.includes(bookingSource) && !reservationCode) {
            showToast('Validation Error', 'Please enter the OTA reservation code', '❌');
            return;
        }

        // Calculate number of nights
        const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        
        if (nights <= 0) {
            showToast('Validation Error', 'Check-out date must be after check-in date', '❌');
            return;
}
        const adults = parseInt(document.getElementById('adults').value) || 0;
        const kids = parseInt(document.getElementById('kids').value) || 0;
        const numberOfGuests = adults + kids;

        // ── Money math in paise ──
        // Parse every amount input to integer paise, do additions in paise,
        // then convert back to rupees for the (still-float) DB columns. This
        // drops accumulated float-drift so the saved value matches what the
        // operator typed and what the review screen showed.
        const stayPaise = Money.parseRupeesToPaise(document.getElementById('stayAmount').value);
        const extraGuestPaise = Money.parseRupeesToPaise(document.getElementById('extraGuestCharges').value);
        const mealsChefPaise = Money.parseRupeesToPaise(document.getElementById('mealsChef').value);
        const bonfireOtherPaise = Money.parseRupeesToPaise(document.getElementById('bonfireOther').value);
        const taxesPaise = Money.parseRupeesToPaise(document.getElementById('taxes').value);
        const damagesPaise = Money.parseRupeesToPaise(document.getElementById('damages').value);
        const otaFeePaise = Money.parseRupeesToPaise(document.getElementById('otaServiceFee').value);
        const hostizzyPaise = Money.parseRupeesToPaise(document.getElementById('hostizzyRevenue').value);

        const mealsRevenuePaise = mealsChefPaise + bonfireOtherPaise;
        const totalPreTaxPaise = stayPaise + extraGuestPaise + mealsRevenuePaise;
        const totalIncTaxPaise = totalPreTaxPaise + taxesPaise;
        const totalAmountPaise = totalIncTaxPaise + damagesPaise;

        const p2r = Money.paiseToRupees;
        const stayAmount = p2r(stayPaise);
        const extraGuestCharges = p2r(extraGuestPaise);
        const mealsChef = p2r(mealsChefPaise);
        const bonfireOther = p2r(bonfireOtherPaise);
        const taxes = p2r(taxesPaise);
        const damages = p2r(damagesPaise);
        const totalAmountPreTax = p2r(totalPreTaxPaise);
        const totalAmountIncTax = p2r(totalIncTaxPaise);
        const totalAmount = p2r(totalAmountPaise);

        const avgRoomRate = nights > 0 ? p2r(Math.round(stayPaise / nights)) : 0;
        const avgNightlyRate = nights > 0 ? p2r(Math.round(totalAmountPaise / nights)) : 0;
        
        const monthDate = new Date(checkIn);
        const month = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        
        const editId = document.getElementById('editReservationId').value;
        
        const bookingStatus = document.getElementById('bookingStatus').value;

        const reservation = {
            property_id: propertyId,
            property_name: property.name,
            booking_type: document.getElementById('bookingType').value,
            booking_date: new Date().toISOString().split('T')[0],
            check_in: checkIn,
            check_out: checkOut,
            month: month,
            nights: nights,
            gst_status: document.getElementById('gstStatus').value,
            gst_rate_mode: document.getElementById('gstRateMode').value,
            guest_name: document.getElementById('guestName').value,
            guest_phone: document.getElementById('guestPhone').value,
            guest_email: document.getElementById('guestEmail').value || null,
            guest_city: document.getElementById('guestCity').value || null,
            status: bookingStatus,
            booking_source: bookingSource,
            number_of_rooms: parseInt(document.getElementById('numberOfRooms').value) || 1,
            room_id: document.getElementById('reservationRoom')?.value
                ? parseInt(document.getElementById('reservationRoom').value) : null,
            adults: adults,
            kids: kids,
            number_of_guests: numberOfGuests,
            stay_amount: stayAmount,
            extra_guest_charges: extraGuestCharges,
            meals_chef: mealsChef,
            bonfire_other: bonfireOther,
            ota_service_fee: p2r(otaFeePaise),
            // Taxes already drift-corrected; non-GST forces zero regardless of stale input.
            taxes: document.getElementById('gstStatus').value === 'non_gst' ? 0 : taxes,
            total_amount_pre_tax: totalAmountPreTax,
            total_amount_inc_tax: totalAmountIncTax,
            total_amount: totalAmount,
            damages: damages,
            hostizzy_revenue: p2r(hostizzyPaise),
            // Snapshot the property's commission rate at save time so the row stays
            // in sync with properties.revenue_share_percent. The orphaned column had
            // been silently drifting; this and the SQL backfill keep it accurate.
            revenue_share_percent: propertyRate,
            // payout_eligible = gross owner-eligible (before commission). Excludes taxes
            // (GST is collected for the government, never paid out) and OTA service fee.
            // Damages and meals/bonfire flow through to the owner. Compute in paise.
            payout_eligible: p2r(totalAmountPaise - taxesPaise - otaFeePaise),
            // host_payout = NET rupees Hostizzy pays the owner after taking commission.
            //             = payout_eligible - hostizzy_revenue (computed in paise)
            host_payout: p2r(totalAmountPaise - taxesPaise - otaFeePaise - hostizzyPaise),
            is_legacy: false,
            avg_room_rate: avgRoomRate,
            avg_nightly_rate: avgNightlyRate,
            paid_amount: 0,
            payment_status: 'pending'
        };

        // CANCELLED RESERVATION CLEANUP: purge all non-essential fields.
        // Keeps booking_id, guest contact, dates, status, property, and
        // (post-Round-5) ical_uid so future iCal syncs can still match.
        if (bookingStatus === 'cancelled') {
            applyCancellationCleanup(reservation);
        }
        
        // Handle booking_id for both new and edited reservations
        if (!editId) {
            // NEW RESERVATION: Generate booking_id
            if (otaSources.includes(bookingSource) && reservationCode) {
                // Use OTA reservation code as booking ID
                reservation.booking_id = reservationCode;
            } else {
                // Generate system booking ID for direct bookings
                const year = new Date().getFullYear().toString().slice(-2);
                const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                const bytes = crypto.getRandomValues(new Uint8Array(6));
                let rand = "";
                for (const b of bytes) {
                    rand += alphabet[b % alphabet.length];
                }
                reservation.booking_id = `HST${year}${rand}`;
            }
        } else {
            // EDITING EXISTING RESERVATION: Update booking_id if source changed to OTA
            if (otaSources.includes(bookingSource) && reservationCode) {
                // If changed to OTA and has OTA code, update booking_id
                reservation.booking_id = reservationCode;
            }
            // Note: If source is not OTA, booking_id remains unchanged (keeps existing ID)
        }
        
        if (navigator.onLine) {
            if (editId) {
                reservation.id = parseInt(editId);
            }

            const result = await db.saveReservation(reservation);
            console.log('Saved reservation:', result);

            // If status changed to cancelled, cleanup related records
            if (bookingStatus === 'cancelled' && reservation.booking_id) {
                await cleanupCancelledReservationData(reservation.booking_id);
            }

            closeReservationModal();
            // Invalidate caches + force-reload views with fresh data
            dataCache.invalidate('reservations');
            loadedViews.delete('reservations');
            loadedViews.delete('dashboard');
            loadedViews.delete('home');
            _filterListenersAttached = false;
            await loadReservations();
            await loadDashboard();
            showToast('Success', editId ? 'Reservation updated!' : 'Reservation created successfully!', '✅');
        } else {
            await saveToOfflineDB('pendingReservations', reservation);
            closeReservationModal();
            dataCache.invalidate('reservations');
            loadedViews.delete('reservations');
            _filterListenersAttached = false;
            await loadReservations();
            showToast('Saved Offline', 'Will sync when online', '💾');
        }
    } catch (error) {
        console.error('Error saving reservation:', error);
        // The double-booking trigger raises a message already written for a
        // human ("Those dates are already taken. Ravi has the Garden Room
        // from 12 Jul to 15 Jul."), so show it as-is rather than prefixing it.
        const msg = error.message || '';
        if (msg.includes('already taken')) {
            showToast('Dates clash', msg, '⚠️');
        } else {
            showToast('Error', 'Failed to save reservation: ' + msg, '❌');
        }
    }
}

async function editReservation(booking_id) {
    openQuickEditModal(booking_id);
}

async function deleteReservation(booking_id) {
    if (!confirm('Delete this reservation?')) return;

    try {
        await db.deleteReservation(booking_id);
        dataCache.invalidate('reservations');
        loadedViews.delete('reservations');
        loadedViews.delete('dashboard');
        loadedViews.delete('home');
        _filterListenersAttached = false;
        await loadReservations();
        await loadDashboard();
        showToast('Deleted', 'Reservation deleted successfully', '✅');
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Error', 'Failed to delete reservation', '❌');
    }
}

async function cleanupCancelledReservationData(booking_id) {
    try {
        console.log('Cleaning up cancelled reservation data for:', booking_id);

        // Delete payment records for this booking
        const { error: paymentError } = await supabase
            .from('payments')
            .delete()
            .eq('booking_id', booking_id);

        if (paymentError && paymentError.code !== 'PGRST116') { // PGRST116 = no rows found (not an error)
            console.warn('Payment cleanup warning:', paymentError);
        }

        // Delete guest documents (explicit, though CASCADE should handle this)
        const { error: docsError } = await supabase
            .from('guest_documents')
            .delete()
            .eq('booking_id', booking_id);

        if (docsError && docsError.code !== 'PGRST116') {
            console.warn('Document cleanup warning:', docsError);
        }

        // Delete guest meal preferences if that table exists
        const { error: mealsError } = await supabase
            .from('guest_meal_preferences')
            .delete()
            .eq('booking_id', booking_id);

        if (mealsError && mealsError.code !== 'PGRST116') {
            console.warn('Meal preferences cleanup warning:', mealsError);
        }

        console.log('Cancelled reservation cleanup completed for:', booking_id);
    } catch (error) {
        console.error('Error during cancelled reservation cleanup:', error);
        // Don't throw - cleanup is best-effort
    }
}

// Payment Functions

function toggleRowSelection(checkbox, bookingId) {
    if (checkbox.checked) {
        selectedReservations.add(bookingId);
    } else {
        selectedReservations.delete(bookingId);
    }
    updateBulkActionsBar();
}

function toggleAllRows(checkbox) {
    const checkboxes = document.querySelectorAll('.row-select-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        const bookingId = cb.getAttribute('data-booking-id');
        if (checkbox.checked) {
            selectedReservations.add(bookingId);
        } else {
            selectedReservations.delete(bookingId);
        }
    });
    updateBulkActionsBar();
}

function updateBulkActionsBar() {
    const count = selectedReservations.size;
    const bar = document.getElementById('bulkActionsBar');
    document.getElementById('bulkSelectedCount').textContent = count;
    
    if (count > 0) {
        bar.classList.add('show');
    } else {
        bar.classList.remove('show');
    }
}

function clearBulkSelection() {
    selectedReservations.clear();
    document.querySelectorAll('.row-select-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('selectAllCheckbox').checked = false;
    updateBulkActionsBar();
}

function openBulkEditModal() {
    if (selectedReservations.size === 0) {
        showToast('No Selection', 'Please select at least one item', '⚠️');
        return;
    }
    
    document.getElementById('bulkEditCount').textContent = selectedReservations.size;
    document.getElementById('bulkEditField').value = '';
    document.getElementById('bulkEditValueGroup').style.display = 'none';
    document.getElementById('bulkEditModal').classList.add('active');
}

function closeBulkEditModal() {
    document.getElementById('bulkEditModal').classList.remove('active');
}

function updateBulkEditOptions() {
    const field = document.getElementById('bulkEditField').value;
    const valueGroup = document.getElementById('bulkEditValueGroup');
    const valueSelect = document.getElementById('bulkEditValue');
    const valueLabel = document.getElementById('bulkEditValueLabel');
    
    if (!field) {
        valueGroup.style.display = 'none';
        return;
    }
    
    valueGroup.style.display = 'block';
    
    if (field === 'status') {
        valueLabel.textContent = 'New Booking Status';
        valueSelect.innerHTML = `
            <option value="">Select Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked-in">Checked In</option>
            <option value="checked-out">Checked Out</option>
            <option value="cancelled">Cancelled</option>
        `;
    } else if (field === 'payment_status') {
        valueLabel.textContent = 'New Payment Status';
        valueSelect.innerHTML = `
            <option value="">Select Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
        `;
    }
}

async function applyBulkEdit() {
    const field = document.getElementById('bulkEditField').value;
    const value = document.getElementById('bulkEditValue').value;
    
    if (!field || !value) {
        showToast('Validation Error', 'Please select both field and value', '❌');
        return;
    }
    
    if (selectedReservations.size === 0) {
        showToast('No Selection', 'No items selected', '⚠️');
        return;
    }
    
    const count = selectedReservations.size;
    if (!confirm(`Update ${field} to "${value}" for ${count} reservation(s)?`)) {
        return;
    }
    
    try {
        const bookingIds = Array.from(selectedReservations);
        
        if (navigator.onLine) {
            await db.bulkUpdateReservations(bookingIds, { [field]: value });
            closeBulkEditModal();
            clearBulkSelection();
            await loadReservations();
            await loadDashboard();
            showToast('Success', `Successfully updated ${count} reservation(s)!`, '✅');
        } else {
            for (const bookingId of bookingIds) {
                await saveToOfflineDB('pendingEdits', {
                    booking_id: bookingId,
                    table: 'reservations',
                    updates: { [field]: value }
                });
            }
            closeBulkEditModal();
            clearBulkSelection();
            showToast('Saved Offline', `${count} edits will sync when online`, '💾');
        }
    } catch (error) {
        console.error('Bulk edit error:', error);
        showToast('Error', 'Failed to update reservations: ' + error.message, '❌');
    }
}

async function bulkDeleteReservations() {
    if (selectedReservations.size === 0) {
        showToast('No Selection', 'Please select at least one reservation', '⚠️');
        return;
    }
    const count = selectedReservations.size;
    if (!confirm(`Permanently delete ${count} reservation(s)? This cannot be undone.`)) return;

    try {
        const bookingIds = Array.from(selectedReservations);
        let deleted = 0;
        for (const bid of bookingIds) {
            const { error } = await supabase.from('reservations').delete().eq('booking_id', bid);
            if (error) {
                console.error(`[Bulk Delete] Failed to delete ${bid}:`, error);
            } else {
                deleted++;
            }
        }
        clearBulkSelection();
        dataCache.invalidate('reservations');
        loadedViews.delete('reservations');
        loadedViews.delete('dashboard');
        loadedViews.delete('home');
        _filterListenersAttached = false;
        await loadReservations();
        await loadDashboard();
        showToast('Deleted', `${deleted} reservation(s) deleted`, '✅');
    } catch (error) {
        console.error('Bulk delete error:', error);
        showToast('Error', 'Failed to delete: ' + error.message, '❌');
    }
}

// Export Functions with Payment Recipient
async function exportCSV() {
    // Use filtered data if filters are active, otherwise use all reservations
    const reservations = filteredReservationsForExport.length > 0 ? filteredReservationsForExport : allReservations;
    
    if (reservations.length === 0) {
        showToast('No Data', 'No reservations to export', '⚠️');
        return;
    }
    
    let csv = 'Booking ID,Property,Status,Booking Type,Booking Date,Check-in,Check-out,Nights,Guest,Phone,Email,City,Source,Rooms,Adults,Kids,Stay Amount,Extra Guest Charges,Meals/Chef Charges,Bonfire/Other Charges,Taxes,Damages,Total Amount,Hostizzy Revenue,GST Status,Payment Status,Paid Amount,Balance,Created Date\n';
    
    reservations.forEach(r => {
        const balance = getBalance(r);

        // Format GST status
        const gstStatus = r.gst_status === 'gst' ? 'GST' : 'Non-GST';
        
        csv += [
            r.booking_id || '',
            r.property_name,
            r.status,
            r.booking_type || 'STAYCATION',
            r.booking_date,
            r.check_in,
            r.check_out,
            r.nights || 0,
            r.guest_name,
            r.guest_phone,
            r.guest_email || '',
            r.guest_city || '',
            r.booking_source || '',
            r.number_of_rooms || 0,
            r.adults || 0,
            r.kids || 0,
            r.stay_amount || 0,
            r.extra_guest_charges || 0,
            r.meals_chef || 0,
            r.bonfire_other || 0,
            r.taxes || 0,
            r.damages || 0,
            r.total_amount || 0,
            r.hostizzy_revenue || 0,
            gstStatus,
            r.payment_status || 'pending',
            r.paid_amount || 0,
            balance
        ].map(v => `"${v}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = filteredReservationsForExport.length > 0 ? 
        `hostizzy-reservations-filtered-${new Date().toISOString().split('T')[0]}.csv` :
        `hostizzy-reservations-${new Date().toISOString().split('T')[0]}.csv`;
    a.download = filename;
    a.click();
    showToast('Exported', `${reservations.length} reservations exported successfully`, '📥');
}

async function exportPaymentsCSV() {
    // Use filtered payments if filters are active
    const reservationsToExport = filteredPayments.length > 0 ? filteredPayments : allReservations;
    
    if (reservationsToExport.length === 0) {
        showToast('No Data', 'No payments to export', '⚠️');
        return;
    }
    
    let csv = 'Booking ID,Guest,Property,Check-in,Gross Amount,OTA Fee,Receivable,Collected,Outstanding,Payment Status,Source\n';

    for (const r of reservationsToExport) {
        const total = parseFloat(r.total_amount) || 0;
        const otaFee = parseFloat(r.ota_service_fee) || 0;
        const hostPayout = getHostPayout(r);
        const paid = parseFloat(r.paid_amount) || 0;
        const balance = getBalance(r);

        csv += [
            r.booking_id || '',
            r.guest_name || '',
            r.property_name || '',
            r.check_in || '',
            total.toFixed(2),
            otaFee.toFixed(2),
            hostPayout.toFixed(2),
            paid.toFixed(2),
            balance.toFixed(2),
            r.payment_status || 'pending',
            r.booking_source || 'DIRECT'
        ].map(v => `"${v}"`).join(',') + '\n';
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = filteredPayments.length > 0 ? 
        `hostizzy-payments-filtered-${new Date().toISOString().split('T')[0]}.csv` :
        `hostizzy-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.download = filename;
    a.click();
    showToast('Exported', `${reservationsToExport.length} payment records exported successfully`, '📥');
}

// ==========================================
// QUICK EDIT MODAL — Flat single-page edit form
// ==========================================

function toggleQeSection(headerEl) {
    headerEl.parentElement.classList.toggle('collapsed');
}

function openQuickEditModal(booking_id) {
    const r = allReservations.find(res => res.booking_id === booking_id);
    if (!r) {
        showToast('Error', 'Reservation not found', '❌');
        return;
    }

    const modal = document.getElementById('quickEditModal');

    // Populate banner
    document.getElementById('qeBannerBookingId').textContent = r.booking_id;
    document.getElementById('qeBannerProperty').textContent = r.property_name || '';
    document.getElementById('qeReservationId').value = r.id;
    document.getElementById('qeBookingId').value = r.booking_id;

    // Populate property dropdown
    const qeProp = document.getElementById('qeProperty');
    const properties = state.properties || [];
    qeProp.innerHTML = '<option value="">Select Property</option>' +
        properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Populate fields
    document.getElementById('qeStatus').value = r.status || 'confirmed';
    document.getElementById('qeGuestName').value = r.guest_name || '';
    document.getElementById('qeGuestPhone').value = r.guest_phone || '';
    document.getElementById('qeGuestEmail').value = r.guest_email || '';
    document.getElementById('qeGuestCity').value = r.guest_city || '';
    document.getElementById('qeProperty').value = r.property_id || '';
    document.getElementById('qeBookingType').value = r.booking_type || 'STAYCATION';
    document.getElementById('qeBookingSource').value = r.booking_source || 'DIRECT';
    document.getElementById('qeCheckIn').value = r.check_in || '';
    document.getElementById('qeCheckOut').value = r.check_out || '';
    document.getElementById('qeRooms').value = r.number_of_rooms || 1;
    document.getElementById('qeAdults').value = r.adults || 2;
    document.getElementById('qeKids').value = r.kids || 0;
    document.getElementById('qeStayAmount').value = r.stay_amount || 0;
    document.getElementById('qeExtraGuest').value = r.extra_guest_charges || 0;
    document.getElementById('qeMeals').value = r.meals_chef || 0;
    document.getElementById('qeBonfire').value = r.bonfire_other || 0;
    document.getElementById('qeOtaFee').value = r.ota_service_fee || 0;
    document.getElementById('qeGstStatus').value = r.gst_status || 'gst';
    document.getElementById('qeGstRate').value = r.gst_rate_mode || 'auto';
    document.getElementById('qeTaxes').value = r.taxes || 0;
    document.getElementById('qeDamages').value = r.damages || 0;
    document.getElementById('qeHostizzyRevenue').value = r.hostizzy_revenue || 0;

    // OTA fields visibility
    qeToggleOtaFields();
    if (r.booking_id && !r.booking_id.startsWith('HST')) {
        document.getElementById('qeReservationCode').value = r.booking_id;
    }

    // GST rate mode
    qeHandleGstRate();

    // Calculate totals display
    qeUpdateTotalDisplay();

    // Expand all sections by default
    modal.querySelectorAll('.qe-section').forEach(s => s.classList.remove('collapsed'));

    modal.classList.add('active');
    requestAnimationFrame(() => {
        if (typeof refreshIcons === 'function') refreshIcons(modal);
    });
}

function closeQuickEditModal() {
    document.getElementById('quickEditModal').classList.remove('active');
}

function qeToggleOtaFields() {
    const source = document.getElementById('qeBookingSource').value;
    const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO'];
    const isOta = otaSources.includes(source);
    document.getElementById('qeReservationCodeGroup').style.display = isOta ? '' : 'none';
    document.getElementById('qeOtaFeeGroup').style.display = isOta ? '' : 'none';
}

function qeHandleGstRate() {
    const mode = document.getElementById('qeGstRate').value;
    const taxesInput = document.getElementById('qeTaxes');
    if (mode === 'custom') {
        taxesInput.readOnly = false;
        taxesInput.style.background = '#ffffff';
    } else {
        taxesInput.readOnly = true;
        taxesInput.style.background = '#f1f5f9';
        qeCalculateTaxes();
    }
}

function qeCalculateTaxes() {
    const gstStatus = document.getElementById('qeGstStatus').value;
    const taxesInput = document.getElementById('qeTaxes');
    const gstRateMode = document.getElementById('qeGstRate').value;

    if (gstStatus === 'non_gst') {
        taxesInput.value = '0';
        taxesInput.readOnly = true;
        qeUpdateTotalDisplay();
        return;
    }

    if (gstRateMode === 'custom') {
        qeUpdateTotalDisplay();
        return;
    }

    const stayAmount = parseFloat(document.getElementById('qeStayAmount').value) || 0;
    const extraGuest = parseFloat(document.getElementById('qeExtraGuest').value) || 0;
    const checkIn = document.getElementById('qeCheckIn').value;
    const checkOut = document.getElementById('qeCheckOut').value;

    let nights = 0;
    if (checkIn && checkOut) {
        nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        if (nights < 0) nights = 0;
    }

    const baseAmount = stayAmount + extraGuest;
    let gstRate = 0;

    if (gstRateMode === 'auto') {
        const perNight = nights > 0 ? stayAmount / nights : stayAmount;
        gstRate = perNight <= 7500 ? 5 : 18;
    } else {
        gstRate = parseFloat(gstRateMode) || 0;
    }

    const taxes = Math.round(baseAmount * gstRate / 100 * 100) / 100;
    taxesInput.value = taxes;

    // Calculate Hostizzy revenue
    qeCalculateHostizzyRevenue(stayAmount, extraGuest);
    qeUpdateTotalDisplay();
}

function qeCalculateHostizzyRevenue(stayAmount, extraGuestCharges) {
    const propertyId = parseInt(document.getElementById('qeProperty').value);
    const properties = state.properties || [];
    const property = properties.find(p => p.id === propertyId);

    if (!property) return;

    const revenueSharePct = property.hostizzy_revenue_share || 10;
    const otaFee = parseFloat(document.getElementById('qeOtaFee').value) || 0;
    const baseForRevenue = (stayAmount + extraGuestCharges) - otaFee;
    const revenue = Math.round(baseForRevenue * revenueSharePct / 100 * 100) / 100;
    document.getElementById('qeHostizzyRevenue').value = Math.max(0, revenue);
}

function qeUpdateTotalDisplay() {
    const stay = parseFloat(document.getElementById('qeStayAmount').value) || 0;
    const extra = parseFloat(document.getElementById('qeExtraGuest').value) || 0;
    const meals = parseFloat(document.getElementById('qeMeals').value) || 0;
    const bonfire = parseFloat(document.getElementById('qeBonfire').value) || 0;
    const taxes = parseFloat(document.getElementById('qeTaxes').value) || 0;
    const damages = parseFloat(document.getElementById('qeDamages').value) || 0;
    const total = stay + extra + meals + bonfire + taxes + damages;

    const checkIn = document.getElementById('qeCheckIn').value;
    const checkOut = document.getElementById('qeCheckOut').value;
    let nights = 0;
    if (checkIn && checkOut) {
        nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        if (nights < 0) nights = 0;
    }

    const totalEl = document.getElementById('qeTotalDisplay');
    const nightsEl = document.getElementById('qeNightsDisplay');
    if (totalEl) totalEl.textContent = total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (nightsEl) nightsEl.textContent = nights + ' night' + (nights !== 1 ? 's' : '');
}

async function saveQuickEdit() {
    const propertyId = parseInt(document.getElementById('qeProperty').value);
    if (!propertyId) {
        showToast('Validation Error', 'Please select a property', '❌');
        return;
    }

    const checkIn = document.getElementById('qeCheckIn').value;
    const checkOut = document.getElementById('qeCheckOut').value;
    if (!checkIn || !checkOut) {
        showToast('Validation Error', 'Please enter check-in and check-out dates', '❌');
        return;
    }

    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    if (nights <= 0) {
        showToast('Validation Error', 'Check-out must be after check-in', '❌');
        return;
    }

    const guestName = document.getElementById('qeGuestName').value.trim();
    const guestPhone = document.getElementById('qeGuestPhone').value.trim();
    if (!guestName || !guestPhone) {
        showToast('Validation Error', 'Guest name and phone are required', '❌');
        return;
    }

    const bookingSource = document.getElementById('qeBookingSource').value;
    const reservationCode = (document.getElementById('qeReservationCode').value || '').trim();
    const otaSources = ['AIRBNB', 'AGODA/BOOKING.COM', 'MMT/GOIBIBO'];
    if (otaSources.includes(bookingSource) && !reservationCode) {
        showToast('Validation Error', 'Please enter the OTA reservation code', '❌');
        return;
    }

    const saveBtn = document.getElementById('qeSaveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span>Saving...';

    try {
        const properties = state.properties || [];
        const property = properties.find(p => p.id === propertyId);

        // Snapshot the canonical commission rate from the property record so it
        // can be persisted on the reservation row. Required — no silent default.
        // (Cancelled reservations skip this check; their commission fields are
        // nulled out by the cleanup block below.)
        const propertyRate = property ? property.revenue_share_percent : null;
        const cancelledNow = document.getElementById('qeStatus').value === 'cancelled';
        if (!cancelledNow && (propertyRate == null || propertyRate === '')) {
            showToast(
                'Validation Error',
                `Property "${property ? property.name : propertyId}" has no commission rate set. Please configure revenue_share_percent in Property Settings before saving.`,
                '❌'
            );
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px; margin-right: 6px;"></i>Save Changes';
            return;
        }

        const stayAmount = parseFloat(document.getElementById('qeStayAmount').value) || 0;
        const extraGuestCharges = parseFloat(document.getElementById('qeExtraGuest').value) || 0;
        const mealsChef = parseFloat(document.getElementById('qeMeals').value) || 0;
        const bonfireOther = parseFloat(document.getElementById('qeBonfire').value) || 0;
        const taxes = parseFloat(document.getElementById('qeTaxes').value) || 0;
        const damages = parseFloat(document.getElementById('qeDamages').value) || 0;
        const adults = parseInt(document.getElementById('qeAdults').value) || 0;
        const kids = parseInt(document.getElementById('qeKids').value) || 0;

        const mealsRevenue = mealsChef + bonfireOther;
        const totalPreTax = stayAmount + extraGuestCharges + mealsRevenue;
        const totalIncTax = totalPreTax + taxes;
        const totalAmount = totalIncTax + damages;

        const monthDate = new Date(checkIn);
        const month = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        const bookingStatus = document.getElementById('qeStatus').value;

        const reservation = {
            id: parseInt(document.getElementById('qeReservationId').value),
            property_id: propertyId,
            property_name: property ? property.name : '',
            booking_type: document.getElementById('qeBookingType').value,
            booking_date: new Date().toISOString().split('T')[0],
            check_in: checkIn,
            check_out: checkOut,
            month: month,
            nights: nights,
            gst_status: document.getElementById('qeGstStatus').value,
            gst_rate_mode: document.getElementById('qeGstRate').value,
            taxes: document.getElementById('qeGstStatus').value === 'non_gst' ? 0 : taxes,
            guest_name: guestName,
            guest_phone: guestPhone,
            guest_email: document.getElementById('qeGuestEmail').value || null,
            guest_city: document.getElementById('qeGuestCity').value || null,
            status: bookingStatus,
            booking_source: bookingSource,
            number_of_rooms: parseInt(document.getElementById('qeRooms').value) || 1,
            adults: adults,
            kids: kids,
            number_of_guests: adults + kids,
            stay_amount: stayAmount,
            extra_guest_charges: extraGuestCharges,
            meals_chef: mealsChef,
            bonfire_other: bonfireOther,
            ota_service_fee: parseFloat(document.getElementById('qeOtaFee').value) || 0,
            total_amount_pre_tax: totalPreTax,
            total_amount_inc_tax: totalIncTax,
            total_amount: totalAmount,
            damages: damages,
            hostizzy_revenue: parseFloat(document.getElementById('qeHostizzyRevenue').value) || 0,
            // Snapshot the property's commission rate at save time so the row stays
            // in sync with properties.revenue_share_percent.
            revenue_share_percent: propertyRate,
            // payout_eligible = gross owner-eligible (before commission). Excludes taxes
            // (GST is collected for the government, never paid out) and OTA service fee.
            // Damages and meals/bonfire flow through to the owner.
            payout_eligible: totalAmount - taxes - (parseFloat(document.getElementById('qeOtaFee').value) || 0),
            // host_payout = NET rupees Hostizzy pays the owner after taking commission.
            //             = payout_eligible - hostizzy_revenue
            host_payout: totalAmount - taxes
                - (parseFloat(document.getElementById('qeOtaFee').value) || 0)
                - (parseFloat(document.getElementById('qeHostizzyRevenue').value) || 0),
            is_legacy: false,
            avg_room_rate: nights > 0 ? stayAmount / nights : 0,
            avg_nightly_rate: nights > 0 ? totalAmount / nights : 0
        };

        // Handle booking_id for OTA changes
        if (otaSources.includes(bookingSource) && reservationCode) {
            reservation.booking_id = reservationCode;
        }

        // Cancelled reservation cleanup — shared with saveReservation and
        // the iCal diff-based cancellation detection.
        if (bookingStatus === 'cancelled') {
            applyCancellationCleanup(reservation);
        }

        if (navigator.onLine) {
            const result = await db.saveReservation(reservation);
            console.log('Quick edit saved:', result);

            if (bookingStatus === 'cancelled' && reservation.booking_id) {
                await cleanupCancelledReservationData(reservation.booking_id);
            }

            closeQuickEditModal();
            dataCache.invalidate('reservations');
            loadedViews.delete('reservations');
            loadedViews.delete('dashboard');
            loadedViews.delete('home');
            _filterListenersAttached = false;
            await loadReservations();
            await loadDashboard();
            showToast('Success', 'Reservation updated!', '✅');
        } else {
            await saveToOfflineDB('pendingReservations', reservation);
            closeQuickEditModal();
            dataCache.invalidate('reservations');
            loadedViews.delete('reservations');
            _filterListenersAttached = false;
            await loadReservations();
            showToast('Saved Offline', 'Will sync when online', '💾');
        }
    } catch (error) {
        console.error('Quick edit save error:', error);
        showToast('Error', 'Failed to save: ' + error.message, '❌');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px; margin-right: 6px;"></i>Save Changes';
        requestAnimationFrame(() => { if (typeof refreshIcons === 'function') refreshIcons(saveBtn.parentElement); });
    }
}

// Utilities
