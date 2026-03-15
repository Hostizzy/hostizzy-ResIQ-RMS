// ResIQ Dashboard — KPIs, charts, metrics, filters, action center

function renderBookingTypeBreakdown(reservations, targetId) {
const bookingTypes = {};

reservations.forEach(r => {
    const type = r.booking_type || 'STAYCATION';
    if (!bookingTypes[type]) bookingTypes[type] = { count: 0, revenue: 0, nights: 0 };
    bookingTypes[type].count++;
    bookingTypes[type].revenue += parseFloat(r.total_amount) || 0;
    bookingTypes[type].nights += r.nights || 0;
});

const sortedTypes = Object.entries(bookingTypes).sort((a, b) => b[1].revenue - a[1].revenue);
const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
const totalCount = reservations.length;

const target = document.getElementById(targetId);
if (!target) return;

if (sortedTypes.length === 0) {
    target.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">No booking data available</div>';
    return;
}

const html = sortedTypes.map(([type, data]) => {
    const percentage = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : 0;
    const countPercentage = totalCount > 0 ? ((data.count / totalCount) * 100).toFixed(1) : 0;
    const typeInfo = (typeof BOOKING_TYPES !== 'undefined' && BOOKING_TYPES[type]) ? BOOKING_TYPES[type] : { label: type, icon: '📋' };
    const avgBookingValue = data.count > 0 ? data.revenue / data.count : 0;

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
    </div>`;
}).join('');

target.innerHTML = html;
}

/**
 * Calculate total guests from reservations
 */
function calculateTotalGuests(reservations) {
    return reservations.reduce((sum, r) => {
        const adults = parseInt(r.adults) || 0;
        const kids = parseInt(r.kids) || 0;
        return sum + adults + kids;
    }, 0);
}

/**
 * Calculate unique guests (by phone/email)
 */
function calculateUniqueGuests(reservations) {
    const uniqueGuests = new Set();
    reservations.forEach(r => {
        const identifier = r.guest_phone || r.guest_email || r.guest_name;
        if (identifier) {
            uniqueGuests.add(identifier.toLowerCase().trim());
        }
    });
    return uniqueGuests.size;
}

/**
 * Calculate average group size
 */
function calculateAvgGroupSize(reservations) {
    if (reservations.length === 0) return '0.0';
    const totalGuests = calculateTotalGuests(reservations);
    return (totalGuests / reservations.length).toFixed(1);
}

/**
 * Auto-update reservation statuses based on dates
 * Runs silently in background
 */

function populateDashboardWidgets(reservations, payments) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Filter for today's check-ins
    const checkInsToday = reservations.filter(r => {
        if (r.status === 'cancelled') return false;
        const checkIn = new Date(r.check_in);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === today.getTime();
    });

    // Filter for today's check-outs
    const checkOutsToday = reservations.filter(r => {
        if (r.status === 'cancelled') return false;
        const checkOut = new Date(r.check_out);
        checkOut.setHours(0, 0, 0, 0);
        return checkOut.getTime() === today.getTime();
    });

    // Filter for tomorrow's arrivals
    const arrivingTomorrow = reservations.filter(r => {
        if (r.status === 'cancelled') return false;
        const checkIn = new Date(r.check_in);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn.getTime() === tomorrow.getTime();
    });

    // Calculate pending payments
    const activeReservations = reservations.filter(r => r.status !== 'cancelled');
    let totalPending = 0;
    const pendingBookings = [];

    activeReservations.forEach(reservation => {
        const bookingPayments = payments.filter(p => p.booking_id === reservation.booking_id);
        const paidAmount = bookingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const balance = getBalance(reservation);

        if (balance > 0) {
            totalPending += balance;
            pendingBookings.push({
                booking_id: reservation.booking_id,
                guest_name: reservation.guest_name,
                balance: balance
            });
        }
    });

    // Update Check-ins Today
    document.getElementById('checkInsToday').textContent = checkInsToday.length;
    const checkInsList = document.getElementById('checkInsList');
    if (checkInsToday.length > 0) {
        checkInsList.innerHTML = checkInsToday.map(r =>
            `<div style="padding: 4px 0; border-bottom: 1px solid rgba(30, 64, 175, 0.1);">
                <div style="font-weight: 600;">${r.guest_name || 'N/A'}</div>
                <div style="font-size: 10px; opacity: 0.8;">${r.property_name || 'N/A'}</div>
            </div>`
        ).join('');
    } else {
        checkInsList.textContent = 'No check-ins today';
    }

    // Update Check-outs Today
    document.getElementById('checkOutsToday').textContent = checkOutsToday.length;
    const checkOutsList = document.getElementById('checkOutsList');
    if (checkOutsToday.length > 0) {
        checkOutsList.innerHTML = checkOutsToday.map(r =>
            `<div style="padding: 4px 0; border-bottom: 1px solid rgba(146, 64, 14, 0.1);">
                <div style="font-weight: 600;">${r.guest_name || 'N/A'}</div>
                <div style="font-size: 10px; opacity: 0.8;">${r.property_name || 'N/A'}</div>
            </div>`
        ).join('');
    } else {
        checkOutsList.textContent = 'No check-outs today';
    }

    // Update Arriving Tomorrow
    document.getElementById('arrivingTomorrow').textContent = arrivingTomorrow.length;
    const arrivingList = document.getElementById('arrivingList');
    if (arrivingTomorrow.length > 0) {
        arrivingList.innerHTML = arrivingTomorrow.map(r =>
            `<div style="padding: 4px 0; border-bottom: 1px solid rgba(6, 95, 70, 0.1);">
                <div style="font-weight: 600;">${r.guest_name || 'N/A'}</div>
                <div style="font-size: 10px; opacity: 0.8;">${r.property_name || 'N/A'}</div>
            </div>`
        ).join('');
    } else {
        arrivingList.textContent = 'No arrivals tomorrow';
    }

    // Update Payment Due
    document.getElementById('paymentDueAmount').textContent = formatCurrency(totalPending);
    const paymentDueCount = document.getElementById('paymentDueCount');
    if (pendingBookings.length > 0) {
        paymentDueCount.innerHTML = `<div style="font-weight: 600;">${pendingBookings.length} booking${pendingBookings.length > 1 ? 's' : ''} pending payment</div>`;
    } else {
        paymentDueCount.textContent = 'All payments collected';
    }

    // Refresh icons after updating content
    setTimeout(() => {
        if (typeof refreshIcons === 'function') refreshIcons();
    }, 100);
}

// Animate a number counting up
function animateValue(el, end, duration = 800, prefix = '', suffix = '') {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const isDecimal = String(end).includes('.') || suffix === '%';
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = start + (end - start) * eased;
        if (isDecimal) {
            el.textContent = prefix + current.toFixed(1) + suffix;
        } else {
            el.textContent = prefix + Math.round(current).toLocaleString('en-IN') + suffix;
        }
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// Update dashboard greeting
function updateDashGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good Evening';
    if (hour < 12) greeting = 'Good Morning';
    else if (hour < 17) greeting = 'Good Afternoon';

    const el = document.getElementById('dashGreeting');
    const dateEl = document.getElementById('dashDate');
    if (el) {
        let name = '';
        if (currentUser && currentUser.email) {
            name = currentUser.email.split('@')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }
        el.textContent = name ? `${greeting}, ${name}` : greeting;
    }
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }
}

// Dashboard
async function loadDashboard() {
    try {
        // Update greeting
        updateDashGreeting();

        // Use cache when available (avoids redundant Supabase calls)
        allReservations = dataCache.get('reservations') || await db.getReservations();
        allPayments = dataCache.get('payments') || await db.getAllPayments();
        const properties = dataCache.get('properties') || await db.getProperties();

        // Ensure cache is populated for next load
        if (!dataCache.get('reservations')) dataCache.set('reservations', allReservations);
        if (!dataCache.get('payments')) dataCache.set('payments', allPayments);
        if (!dataCache.get('properties')) dataCache.set('properties', properties);

        // Update global state for home screen
        state.reservations = allReservations;
        state.properties = properties;
        state.payments = allPayments;

        // Apply default "This Month" filter — this populates Core Metrics,
        // Activity Widgets, Revenue Split, and Action Center
        await applyDashboardDateFilter('this-month');

        // Load AI Insights (uses all reservations for better recommendations)
        const confirmedReservations = allReservations.filter(r => r.status !== 'cancelled');
        loadAIInsights(confirmedReservations, properties);

        // Load Top 15 Properties Stats
        updateTopPropertiesStats();
        
    } catch (error) {
        console.error('Dashboard error:', error);
        showToast('Error', 'Failed to load dashboard', '❌');
    }
}

// Compute start/end dates and the equivalent previous period from a range key
function getDashboardDateRange(range) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    let start, end, prevStart, prevEnd, label;

    switch (range) {
        case 'today':
            start = new Date(todayStart);
            end = new Date(today);
            prevStart = new Date(todayStart); prevStart.setDate(prevStart.getDate() - 1);
            prevEnd = new Date(todayStart); prevEnd.setMilliseconds(-1);
            label = 'Today';
            break;
        case 'this-week': {
            const dow = todayStart.getDay();
            start = new Date(todayStart); start.setDate(start.getDate() - dow);
            end = new Date(today);
            const dur = today - start;
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            prevStart = new Date(prevEnd.getTime() - dur + 1);
            label = 'This Week';
            break;
        }
        case 'this-month':
            start = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
            end = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0, 23, 59, 59);
            prevStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
            break;
        case 'last-month':
            start = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
            end = new Date(todayStart.getFullYear(), todayStart.getMonth(), 0, 23, 59, 59);
            prevStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 2, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            label = start.toLocaleString('default', { month: 'long', year: 'numeric' });
            break;
        case 'this-quarter': {
            const q = Math.floor(todayStart.getMonth() / 3);
            start = new Date(todayStart.getFullYear(), q * 3, 1);
            end = new Date(todayStart.getFullYear(), (q + 1) * 3, 0, 23, 59, 59);
            prevStart = new Date(todayStart.getFullYear(), (q - 1) * 3, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            label = `Q${q + 1} ${todayStart.getFullYear()}`;
            break;
        }
        case 'this-year':
            start = new Date(todayStart.getFullYear(), 0, 1);
            end = new Date(todayStart.getFullYear(), 11, 31, 23, 59, 59);
            prevStart = new Date(todayStart.getFullYear() - 1, 0, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            label = `Year ${todayStart.getFullYear()}`;
            break;
        case 'last-30':
            start = new Date(todayStart); start.setDate(start.getDate() - 30);
            end = new Date(today);
            prevStart = new Date(todayStart); prevStart.setDate(prevStart.getDate() - 60);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            label = 'Last 30 Days';
            break;
        case 'last-90':
            start = new Date(todayStart); start.setDate(start.getDate() - 90);
            end = new Date(today);
            prevStart = new Date(todayStart); prevStart.setDate(prevStart.getDate() - 180);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            label = 'Last 90 Days';
            break;
        default: // all-time
            start = null; end = null; prevStart = null; prevEnd = null;
            label = 'All Time';
    }
    return { start, end, prevStart, prevEnd, label };
}

// Render all 8 Core Metric cards with correct period comparison
function renderCoreMetrics(currentRes, prevRes, allPaymentsData, targetNights, periodLabel) {
    const cur = currentRes.filter(r => r.status !== 'cancelled');
    const prev = prevRes.filter(r => r.status !== 'cancelled');

    // Current period
    const totalRevenue   = cur.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
    const hostizzyRev    = cur.reduce((s, r) => s + (parseFloat(r.hostizzy_revenue) || 0), 0);
    const totalNights    = cur.reduce((s, r) => s + (r.nights || 0), 0);
    const occupancy      = targetNights > 0 ? (totalNights / targetNights * 100) : 0;
    const activeBookings = currentRes.filter(r => r.status === 'checked-in').length;
    const upcoming       = currentRes.filter(r => r.status === 'confirmed').length;
    const avgBooking     = cur.length > 0 ? totalRevenue / cur.length : 0;

    // Collection rate from payments matching current reservations
    const curIds = new Set(cur.map(r => r.booking_id));
    const collected = allPaymentsData
        .filter(p => curIds.has(p.booking_id))
        .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const collectionRate = totalRevenue > 0 ? (collected / totalRevenue * 100) : 0;

    // Previous period
    const prevRevenue    = prev.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0);
    const prevHostizzy   = prev.reduce((s, r) => s + (parseFloat(r.hostizzy_revenue) || 0), 0);
    const prevNights     = prev.reduce((s, r) => s + (r.nights || 0), 0);
    const prevOccupancy  = targetNights > 0 ? (prevNights / targetNights * 100) : 0;

    // MoM helper — returns numeric %
    const pct = (cur, prev) => prev > 0 ? ((cur - prev) / prev * 100) : null;

    const formatTrend = (val) => {
        if (val === null) return '<span style="opacity:0.7">No prev. data</span>';
        const n = parseFloat(val);
        const arrow = n > 0 ? '↑' : n < 0 ? '↓' : '→';
        const color = n > 0 ? '#86efac' : n < 0 ? '#fca5a5' : 'rgba(255,255,255,0.6)';
        return `<span style="color:${color};font-weight:700">${arrow} ${Math.abs(n).toFixed(1)}%</span> <span style="opacity:0.7">vs prev. period</span>`;
    };

    // Update DOM with count-up animations
    animateValue(document.getElementById('coreRevenue'), totalRevenue, 900, '₹');
    animateValue(document.getElementById('coreOccupancy'), occupancy, 700, '', '%');
    document.getElementById('coreActive').textContent           = activeBookings;
    document.getElementById('coreUpcoming').textContent         = upcoming;
    animateValue(document.getElementById('coreCollectionRate'), collectionRate, 700, '', '%');
    document.getElementById('coreCollectionAmount').textContent = formatCurrency(collected) + ' collected';
    animateValue(document.getElementById('coreHostizzyRevenue'), hostizzyRev, 900, '₹');
    animateValue(document.getElementById('coreAvgBooking'), avgBooking, 800, '₹');
    document.getElementById('coreBookingCount').textContent     = `From ${cur.length} bookings`;
    animateValue(document.getElementById('coreTotalNights'), totalNights, 700);

    document.getElementById('coreRevenueTrend').innerHTML    = formatTrend(pct(totalRevenue, prevRevenue));
    document.getElementById('coreOccupancyTrend').innerHTML  = formatTrend(pct(occupancy, prevOccupancy));
    document.getElementById('coreHostizzyTrend').innerHTML   = formatTrend(pct(hostizzyRev, prevHostizzy));
    document.getElementById('coreNightsTrend').innerHTML     = formatTrend(pct(totalNights, prevNights));

    // Update period label
    const periodEl = document.getElementById('dashboardPeriodLabel');
    if (periodEl) periodEl.textContent = 'Showing: ' + periodLabel;
}

// Dashboard Date Filter
async function applyDashboardDateFilter(range) {
    // Update active button state
    document.querySelectorAll('.dash-period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });

    // Compute date ranges
    const { start, end, prevStart, prevEnd, label } = getDashboardDateRange(range);

    // Filter reservations
    const currentRes = start
        ? allReservations.filter(r => { const d = new Date(r.check_in); return d >= start && d <= end; })
        : [...allReservations];

    const prevRes = prevStart
        ? allReservations.filter(r => { const d = new Date(r.check_in); return d >= prevStart && d <= prevEnd; })
        : [];

    // Get properties for occupancy target (cached in state)
    const properties = state.properties || await db.getProperties();
    const targetNights = properties.length * (typeof TARGET_OCCUPANCY_NIGHTS !== 'undefined' ? TARGET_OCCUPANCY_NIGHTS : 30);

    renderCoreMetrics(currentRes, prevRes, allPayments, targetNights, label);

    // Also update activity widgets and action center with filtered scope
    populateDashboardWidgets(allReservations, allPayments); // widgets always show today regardless of period
    renderRevenueSplit(allPayments, currentRes.filter(r => r.status !== 'cancelled'));
    renderActionCenter(currentRes.filter(r => r.status !== 'cancelled'));
}

function resetDashboardFilter() {
    applyDashboardDateFilter('this-month');
}

// Quick Filter State
let currentQuickFilter = 'all';

async function applyQuickFilter(filter) {
    currentQuickFilter = filter;

    // Update UI
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    const filterElement = document.querySelector(`[data-filter="${filter}"]`);
    if (filterElement) {
        filterElement.classList.add('active');
    }
    
    // Get all reservations
    let filteredReservations = [...allReservations];
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    // Apply filter logic
    switch(filter) {
        case 'next-7-days':
            const next7Days = new Date(today);
            next7Days.setDate(today.getDate() + 7);
            filteredReservations = filteredReservations.filter(r => {
                const checkIn = new Date(r.check_in);
                return checkIn >= today && checkIn <= next7Days && r.status !== 'cancelled';
            });
            updateFilterInfo(`Next 7 Days (${filteredReservations.length} bookings)`);
            break;
            
        case 'today':
            filteredReservations = filteredReservations.filter(r => {
                const checkIn = new Date(r.check_in);
                const checkOut = new Date(r.check_out);
                checkIn.setHours(0, 0, 0, 0);
                checkOut.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                return (checkIn.getTime() === today.getTime() || checkOut.getTime() === today.getTime()) 
                    && r.status !== 'cancelled';
            });
            updateFilterInfo(`Today's Activity (${filteredReservations.length} check-ins/outs)`);
            break;
            
        case 'payment-due':
            filteredReservations = filteredReservations.filter(r => {
                if (r.status === 'cancelled') return false;
                const balance = getBalance(r);
                return balance > 0;
            });
            updateFilterInfo(`Payment Due (${filteredReservations.length} with outstanding balance)`);
            break;
            
        case 'this-month':
            filteredReservations = filteredReservations.filter(r => {
                const checkIn = new Date(r.check_in);
                return checkIn >= startOfMonth && checkIn <= endOfMonth;
            });
            updateFilterInfo(`This Month (${filteredReservations.length} bookings)`);
            break;
            
        case 'needs-attention':
            filteredReservations = filteredReservations.filter(r => {
                if (r.status === 'cancelled') return false;
                
                const checkInDate = new Date(r.check_in);
                checkInDate.setHours(0, 0, 0, 0);
                const balance = getBalance(r);

                // Needs attention if:
                // 1. Overdue payment
                // 2. Check-in today/tomorrow with pending payment
                // 3. Missing guest contact info
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                
                const overduePayment = balance > 0 && checkInDate < today;
                const soonCheckinUnpaid = (checkInDate.getTime() === today.getTime() || 
                                          checkInDate.getTime() === tomorrow.getTime()) && balance > 0;
                const missingInfo = !r.guest_phone || !r.guest_email;
                
                return overduePayment || soonCheckinUnpaid || missingInfo;
            });
            updateFilterInfo(`Needs Attention (${filteredReservations.length} items)`);
            break;
            
        case 'all':
        default:
            updateFilterInfo('');
            break;
    }
    
    // Re-render dashboard with filtered data
    const confirmedReservations = filteredReservations.filter(r => r.status !== 'cancelled');
    
    // Calculate all metrics with filtered data
    const totalRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalOtaFees = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0);
    const netRevenue = totalRevenue - totalOtaFees;
    const activeBookings = filteredReservations.filter(r => r.status === 'checked-in').length;
    const upcomingBookings = filteredReservations.filter(r => r.status === 'confirmed').length;
    const completedBookings = filteredReservations.filter(r => r.status === 'checked-out').length;
    const avgBookingValue = confirmedReservations.length > 0 ? totalRevenue / confirmedReservations.length : 0;
    
    // Update primary stats
    document.getElementById('totalReservations').textContent = filteredReservations.length;
    document.getElementById('activeReservations').textContent = activeBookings;
    document.getElementById('upcomingReservations').textContent = upcomingBookings;
    document.getElementById('completedReservations').textContent = completedBookings;
    document.getElementById('avgBookingValue').textContent = Math.round(avgBookingValue).toLocaleString('en-IN');
    
    // Calculate enhanced metrics with filtered data
    const properties = await db.getProperties();
    const hostizzyRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
    const totalNights = confirmedReservations.reduce((sum, r) => sum + (r.nights || 0), 0);
    const targetNights = properties.length * TARGET_OCCUPANCY_NIGHTS;
    const occupancyRate = targetNights > 0 ? ((totalNights / targetNights) * 100).toFixed(1) : 0;
    
    // Update Enhanced Metrics cards
    let enhancedHTML = `
        <div class="metric-card" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);">
            <div class="metric-icon">💰</div>
            <div class="metric-value">${formatCurrency(totalRevenue)}</div>
            <div class="metric-label">Total Revenue</div>
            <div class="metric-trend">From ${confirmedReservations.length} bookings</div>
        </div>`;
    
    // Add OTA fees card if there are any OTA fees
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
        </div>`;
    }
    
    enhancedHTML += `
        <div class="metric-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            <div class="metric-icon">📊</div>
            <div class="metric-value">${occupancyRate}%</div>
            <div class="metric-label">Occupancy Rate</div>
            <div class="metric-trend">${totalNights}/${targetNights} nights booked</div>
        </div>
        <div class="metric-card" style="background: var(--gradient-primary);">
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
    `;
    
    document.getElementById('enhancedMetrics').innerHTML = enhancedHTML;
    
    // Update Payment Analytics - Revenue Split with filtered data
    renderRevenueSplit(allPayments, confirmedReservations);

    // Re-render Action Center with filtered data
    renderActionCenter(filteredReservations);

    // Recalculate monthly metrics with filtered data
    calculateMonthlyMetricsFiltered(filteredReservations);
    
    // Load AI Insights with filtered data
    loadAIInsights(confirmedReservations, properties);
    
    // Update top 15 properties with filtered data
    updateTopPropertiesStats(filteredReservations);
}

/**
 * Update filter info display
 */
function updateFilterInfo(text) {
    const infoDiv = document.getElementById('activeFilterInfo');
    const textSpan = document.getElementById('activeFilterText');
    
    if (text) {
        textSpan.textContent = text;
        infoDiv.style.display = 'block';
    } else {
        infoDiv.style.display = 'none';
    }
}

/**
 * Apply date range filter
 */
async function applyDateRange(range) {
    if (!range) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDate, endDate;
    
    switch(range) {
        case 'today':
            startDate = new Date(today);
            endDate = new Date(today);
            break;
        case 'yesterday':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 1);
            endDate = new Date(startDate);
            break;
        case 'last-7':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = new Date(today);
            break;
        case 'last-30':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            endDate = new Date(today);
            break;
        case 'this-week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay());
            endDate = new Date(today);
            break;
        case 'last-week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay() - 7);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            break;
        case 'this-month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'last-month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'this-quarter':
            const quarter = Math.floor(today.getMonth() / 3);
            startDate = new Date(today.getFullYear(), quarter * 3, 1);
            endDate = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
            break;
        case 'this-year':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            break;
    }
    
    // Filter reservations by date range
    let filteredReservations = allReservations.filter(r => {
        const checkIn = new Date(r.check_in);
        checkIn.setHours(0, 0, 0, 0);
        return checkIn >= startDate && checkIn <= endDate;
    });
    
    // Clear active quick filter
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    currentQuickFilter = 'custom';
    
    // Show filter info
    const rangeLabels = {
        'today': 'Today',
        'yesterday': 'Yesterday',
        'last-7': 'Last 7 Days',
        'last-30': 'Last 30 Days',
        'this-week': 'This Week',
        'last-week': 'Last Week',
        'this-month': 'This Month',
        'last-month': 'Last Month',
        'this-quarter': 'This Quarter',
        'this-year': 'This Year'
    };
    updateFilterInfo(`📅 ${rangeLabels[range]} (${filteredReservations.length} bookings)`);
    
    // Update dashboard with filtered data
    await updateDashboardWithFilteredData(filteredReservations);

    // Save filter state
    saveFilterState('dashboard', {
        quickFilter: currentQuickFilter,
        startDate: document.getElementById('startDate')?.value || '',
        endDate: document.getElementById('endDate')?.value || ''
    });
}

/**
 * Clear all dashboard filters and reload
 */
async function clearDashboardFilters() {
    // Clear filter state
    clearFilterState('dashboard');
    
    // Reset UI
    document.getElementById('quickDateRange').value = '';
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
        if (chip.dataset.filter === 'all') {
            chip.classList.add('active');
        }
    });
    currentQuickFilter = 'all';
    
    // Clear filter info
    const filterInfo = document.getElementById('filterInfo');
    if (filterInfo) filterInfo.style.display = 'none';
    
    // Reload dashboard with all data
    await loadDashboard();
    
    showToast('Filters Cleared', 'Showing all data', '✅');
}

/**
 * Toggle advanced filters panel
 */
async function toggleAdvancedFilters() {
    const panel = document.getElementById('advancedFiltersPanel');
    
    if (panel.style.display === 'none') {
        // Populate property dropdown
        const properties = await db.getProperties();
        const propertySelect = document.getElementById('advFilterProperty');
        propertySelect.innerHTML = properties.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');
        
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

/**
 * Apply advanced filters
 */
async function applyAdvancedFilters() {
    let filteredReservations = [...allReservations];
    const filterLabels = [];
    
    // Date range
    const startDate = document.getElementById('advFilterStartDate').value;
    const endDate = document.getElementById('advFilterEndDate').value;
    if (startDate || endDate) {
        filteredReservations = filteredReservations.filter(r => {
            const checkIn = new Date(r.check_in);
            const start = startDate ? new Date(startDate) : new Date('1900-01-01');
            const end = endDate ? new Date(endDate) : new Date('2100-12-31');
            return checkIn >= start && checkIn <= end;
        });
        if (startDate && endDate) {
            filterLabels.push(`📅 ${startDate} to ${endDate}`);
        } else if (startDate) {
            filterLabels.push(`📅 From ${startDate}`);
        } else {
            filterLabels.push(`📅 Until ${endDate}`);
        }
    }
    
    // Status
    const statusOptions = Array.from(document.getElementById('advFilterStatus').selectedOptions);
    if (statusOptions.length > 0) {
        const statuses = statusOptions.map(o => o.value);
        filteredReservations = filteredReservations.filter(r => statuses.includes(r.status));
        filterLabels.push(`<i data-lucide="list" style="width: 14px; height: 14px; margin-right: 4px;"></i>Status: ${statuses.join(', ')}`);
    }
    
    // Property
    const propertyOptions = Array.from(document.getElementById('advFilterProperty').selectedOptions);
    if (propertyOptions.length > 0) {
        const propertyIds = propertyOptions.map(o => parseInt(o.value));
        filteredReservations = filteredReservations.filter(r => propertyIds.includes(r.property_id));
        filterLabels.push(`🏠 ${propertyOptions.length} properties`);
    }
    
    // Payment status
    const paymentStatus = document.getElementById('advFilterPayment').value;
    if (paymentStatus) {
        filteredReservations = filteredReservations.filter(r => r.payment_status === paymentStatus);
        filterLabels.push(`💰 Payment: ${paymentStatus}`);
    }
    
    // Booking source
    const source = document.getElementById('advFilterSource').value;
    if (source) {
        filteredReservations = filteredReservations.filter(r => r.booking_source === source);
        filterLabels.push(`<i data-lucide="globe" style="width: 14px; height: 14px; margin-right: 4px;"></i>Source: ${source}`);
    }
    
    // Amount range
    const minAmount = document.getElementById('advFilterMinAmount').value;
    const maxAmount = document.getElementById('advFilterMaxAmount').value;
    if (minAmount || maxAmount) {
        filteredReservations = filteredReservations.filter(r => {
            const amount = parseFloat(r.total_amount) || 0;
            const min = minAmount ? parseFloat(minAmount) : 0;
            const max = maxAmount ? parseFloat(maxAmount) : Infinity;
            return amount >= min && amount <= max;
        });
        if (minAmount && maxAmount) {
            filterLabels.push(`💵 ₹${minAmount} - ₹${maxAmount}`);
        } else if (minAmount) {
            filterLabels.push(`💵 Min ₹${minAmount}`);
        } else {
            filterLabels.push(`💵 Max ₹${maxAmount}`);
        }
    }
    
    // Clear active quick filter
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    currentQuickFilter = 'advanced';
    
    // Show filter info
    if (filterLabels.length > 0) {
        updateFilterInfo(`🔍 Advanced: ${filterLabels.join(' • ')}`);
    }
    
    // Close panel
    toggleAdvancedFilters();
    
    // Update dashboard
    await updateDashboardWithFilteredData(filteredReservations);
    
    showToast('Filters Applied', `Showing ${filteredReservations.length} matching bookings`, '✅');
}

/**
 * Clear advanced filters
 */
function clearAdvancedFilters() {
    document.getElementById('advFilterStartDate').value = '';
    document.getElementById('advFilterEndDate').value = '';
    document.getElementById('advFilterStatus').selectedIndex = -1;
    document.getElementById('advFilterProperty').selectedIndex = -1;
    document.getElementById('advFilterPayment').value = '';
    document.getElementById('advFilterSource').value = '';
    document.getElementById('advFilterMinAmount').value = '';
    document.getElementById('advFilterMaxAmount').value = '';
}

/**
 * Clear all filters and reset
 */
async function clearAllFilters() {
    // Clear quick filters
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
    document.querySelector('[data-filter="all"]').classList.add('active');
    currentQuickFilter = 'all';
    
    // Clear date range
    document.getElementById('quickDateRange').value = '';
    
    // Clear advanced filters
    clearAdvancedFilters();
    
    // Hide filter info
    updateFilterInfo('');
    
    // Reload full dashboard
    await loadDashboard();
    
    showToast('Filters Cleared', 'Showing all data', 'ℹ️');
}

/**
 * Update dashboard with filtered data (extracted for reuse)
 */

async function updateDashboardWithFilteredData(filteredReservations) {
    const confirmedReservations = filteredReservations.filter(r => r.status !== 'cancelled');
    
    // Calculate all metrics with filtered data
    const totalRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalOtaFees = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0);
    const netRevenue = totalRevenue - totalOtaFees;
    const activeBookings = filteredReservations.filter(r => r.status === 'checked-in').length;
    const upcomingBookings = filteredReservations.filter(r => r.status === 'confirmed').length;
    const completedBookings = filteredReservations.filter(r => r.status === 'checked-out').length;
    const avgBookingValue = confirmedReservations.length > 0 ? totalRevenue / confirmedReservations.length : 0;
    
    // Update primary stats
    document.getElementById('totalReservations').textContent = filteredReservations.length;
    document.getElementById('activeReservations').textContent = activeBookings;
    document.getElementById('upcomingReservations').textContent = upcomingBookings;
    document.getElementById('completedReservations').textContent = completedBookings;
    document.getElementById('avgBookingValue').textContent = Math.round(avgBookingValue).toLocaleString('en-IN');
    
    // Calculate enhanced metrics with filtered data
    const properties = await db.getProperties();
    const hostizzyRevenue = confirmedReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
    const totalNights = confirmedReservations.reduce((sum, r) => sum + (r.nights || 0), 0);
    const targetNights = properties.length * TARGET_OCCUPANCY_NIGHTS;
    const occupancyRate = targetNights > 0 ? ((totalNights / targetNights) * 100).toFixed(1) : 0;
    
    // Update Enhanced Metrics cards
    let enhancedHTML = `
        <div class="metric-card" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);">
            <div class="metric-icon">💰</div>
            <div class="metric-value">${formatCurrency(totalRevenue)}</div>
            <div class="metric-label">Total Revenue</div>
            <div class="metric-trend">From ${confirmedReservations.length} bookings</div>
        </div>`;
    
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
        </div>`;
    }
    
    enhancedHTML += `
        <div class="metric-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
            <div class="metric-icon">📊</div>
            <div class="metric-value">${occupancyRate}%</div>
            <div class="metric-label">Occupancy Rate</div>
            <div class="metric-trend">${totalNights}/${targetNights} nights booked</div>
        </div>
        <div class="metric-card" style="background: var(--gradient-primary);">
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
    `;
    
    document.getElementById('enhancedMetrics').innerHTML = enhancedHTML;
    
    // Update other sections
    renderRevenueSplit(allPayments, confirmedReservations);
    renderActionCenter(filteredReservations);
    calculateMonthlyMetricsFiltered(filteredReservations);
    loadAIInsights(confirmedReservations, properties);
    updateTopPropertiesStats(filteredReservations);
}

/**
 * Calculate and display monthly performance with filtered data
 */
function calculateMonthlyMetricsFiltered(filteredReservations) {
    try {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Update month label
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('currentMonthLabel').textContent = `${monthNames[currentMonth]} ${currentYear}`;
        
        // Filter current month reservations from the already filtered data
        const currentMonthReservations = filteredReservations.filter(r => {
            const checkIn = new Date(r.check_in);
            return checkIn.getMonth() === currentMonth && checkIn.getFullYear() === currentYear;
        });
        
        // Filter last month reservations from filtered data
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        const lastMonthReservations = filteredReservations.filter(r => {
            const checkIn = new Date(r.check_in);
            return checkIn.getMonth() === lastMonth && checkIn.getFullYear() === lastMonthYear;
        });
        
        // Calculate Nights
        const currentNights = currentMonthReservations.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0);
        const lastNights = lastMonthReservations.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0);
        const nightsChange = lastNights > 0 ? ((currentNights - lastNights) / lastNights * 100) : 0;
        
        // Calculate Revenue
        const currentRevenue = currentMonthReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const lastRevenue = lastMonthReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const revenueChange = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 0;
        
        // Calculate Hostizzy Revenue
        const currentHostizzy = currentMonthReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
        const lastHostizzy = lastMonthReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
        const hostizzyChange = lastHostizzy > 0 ? ((currentHostizzy - lastHostizzy) / lastHostizzy * 100) : 0;
        
        // Update UI - Nights
        document.getElementById('monthNights').textContent = currentNights;
        updateTrendDisplay('monthNightsChange', nightsChange);
        
        // Update UI - Revenue
        document.getElementById('monthRevenue').textContent = '₹' + (currentRevenue / 100000).toFixed(2) + 'L';
        updateTrendDisplay('monthRevenueChange', revenueChange);

        // Update UI - Hostizzy Revenue
        document.getElementById('monthHostizzyRevenue').textContent = '₹' + (currentHostizzy / 100000).toFixed(2) + 'L';
        updateTrendDisplay('monthHostizzyChange', hostizzyChange);
        
    } catch (error) {
        console.error('Error calculating monthly metrics (filtered):', error);
    }
}

/**
 * Calculate and display this month's performance with comparison to last month
 */
function calculateMonthlyMetrics() {
    try {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Update month label
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('currentMonthLabel').textContent = `${monthNames[currentMonth]} ${currentYear}`;
        
        // Filter current month reservations (based on check-in date)
        const currentMonthReservations = allReservations.filter(r => {
            const checkIn = new Date(r.check_in);
            return checkIn.getMonth() === currentMonth && checkIn.getFullYear() === currentYear;
        });
        
        // Filter last month reservations
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        const lastMonthReservations = allReservations.filter(r => {
            const checkIn = new Date(r.check_in);
            return checkIn.getMonth() === lastMonth && checkIn.getFullYear() === lastMonthYear;
        });
        
        // Calculate Nights
        const currentNights = currentMonthReservations.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0);
        const lastNights = lastMonthReservations.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0);
        const nightsChange = lastNights > 0 ? ((currentNights - lastNights) / lastNights * 100) : 0;
        
        // Calculate Revenue
        const currentRevenue = currentMonthReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const lastRevenue = lastMonthReservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const revenueChange = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue * 100) : 0;
        
        // Calculate Hostizzy Revenue
        const currentHostizzy = currentMonthReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
        const lastHostizzy = lastMonthReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
        const hostizzyChange = lastHostizzy > 0 ? ((currentHostizzy - lastHostizzy) / lastHostizzy * 100) : 0;
        
        // Update UI - Nights
        document.getElementById('monthNights').textContent = currentNights;
        updateTrendDisplay('monthNightsChange', nightsChange);
        
        // Update UI - Revenue
        document.getElementById('monthRevenue').textContent = '₹' + (currentRevenue / 100000).toFixed(2) + 'L';
        updateTrendDisplay('monthRevenueChange', revenueChange);

        // Update UI - Hostizzy Revenue
        document.getElementById('monthHostizzyRevenue').textContent = '₹' + (currentHostizzy / 100000).toFixed(2) + 'L';
        updateTrendDisplay('monthHostizzyChange', hostizzyChange);
        
    } catch (error) {
        console.error('Error calculating monthly metrics:', error);
    }
}

/**
 * Update trend display with arrows and colors
 */
function updateTrendDisplay(elementId, changePercent) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const arrow = el.querySelector('.trend-arrow');
    const value = el.querySelector('.trend-value');
    
    if (!arrow || !value) return;
    
    const change = parseFloat(changePercent);
    
    if (change > 0) {
        arrow.textContent = '↑';
        arrow.className = 'trend-arrow trend-up';
        value.textContent = '+' + Math.abs(change).toFixed(1) + '%';
    } else if (change < 0) {
        arrow.textContent = '↓';
        arrow.className = 'trend-arrow trend-down';
        value.textContent = '-' + Math.abs(change).toFixed(1) + '%';
    } else {
        arrow.textContent = '→';
        arrow.className = 'trend-arrow trend-neutral';
        value.textContent = '0%';
    }
}

// Payment Analytics - Revenue Split
function renderRevenueSplit(payments, reservations) {
    // Calculate Hostizzy vs Owner Revenue (from reservations, not payments)
    const hostizzyRevenue = reservations.reduce((sum, r) =>
        sum + (parseFloat(r.hostizzy_revenue) || 0), 0
    );
    const totalHostPayout = reservations.reduce((sum, r) => sum + getHostPayout(r), 0);
    const totalRevenue = reservations.reduce((sum, r) =>
        sum + (parseFloat(r.total_amount) || 0), 0
    );
    const ownerRevenue = totalHostPayout - hostizzyRevenue;

    const hostizzyPercentage = totalHostPayout > 0 ? ((hostizzyRevenue / totalHostPayout) * 100).toFixed(1) : 0;
    const ownerPercentage = totalHostPayout > 0 ? ((ownerRevenue / totalHostPayout) * 100).toFixed(1) : 0;

    // Calculate Collection Status
    const totalPaid = reservations.reduce((sum, r) =>
        sum + (parseFloat(r.paid_amount) || 0), 0
    );
    const pendingCollection = totalRevenue - totalPaid;
    const collectionRate = totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(1) : 0;
    const pendingRate = (100 - collectionRate).toFixed(1);

    // Calculate Property vs Hostizzy Collection (based on paid amounts)
    const hostizzyCollected = reservations.reduce((sum, r) => {
        const paidAmount = parseFloat(r.paid_amount) || 0;
        const totalAmount = parseFloat(r.total_amount) || 0;
        const hostizzyRev = parseFloat(r.hostizzy_revenue) || 0;
        if (totalAmount > 0) {
            return sum + (paidAmount * (hostizzyRev / totalAmount));
        }
        return sum;
    }, 0);
    const propertyCollected = totalPaid - hostizzyCollected;

    // Calculate Payment Source Breakup
    const paymentSources = {};
    payments.forEach(p => {
        const method = p.payment_method || 'Other';
        paymentSources[method] = (paymentSources[method] || 0) + (parseFloat(p.amount) || 0);
    });

    // Sort payment sources by amount
    const sortedSources = Object.entries(paymentSources)
        .sort((a, b) => b[1] - a[1]);

    // Update Revenue Distribution
    document.getElementById('hostizzyTotal').textContent = '₹' + (hostizzyRevenue/100000).toFixed(1) + 'L';
    document.getElementById('ownerTotal').textContent = '₹' + (ownerRevenue/100000).toFixed(1) + 'L';
    document.getElementById('hostizzyPercentage').textContent = hostizzyPercentage + '% of total';
    document.getElementById('ownerPercentage').textContent = ownerPercentage + '% of total';

    // Update Payment Collection Status
    document.getElementById('totalCollected').textContent = '₹' + (totalPaid/100000).toFixed(1) + 'L';
    document.getElementById('pendingCollection').textContent = '₹' + (pendingCollection/100000).toFixed(1) + 'L';
    document.getElementById('collectionRate').textContent = collectionRate + '% collected';
    document.getElementById('pendingRate').textContent = pendingRate + '% remaining';

    // Update Property & Hostizzy Breakdown
    if (document.getElementById('propertyCollected')) {
        document.getElementById('propertyCollected').textContent = '₹' + (propertyCollected/100000).toFixed(1) + 'L';
    }
    if (document.getElementById('hostizzyCollected')) {
        document.getElementById('hostizzyCollected').textContent = '₹' + (hostizzyCollected/100000).toFixed(1) + 'L';
    }

}

function renderPaymentMethodChart(payments, targetElementId = 'paymentMethodChart') {
    const methods = {};
    
    payments.forEach(p => {
        const method = p.payment_method || 'unknown';
        if (!methods[method]) {
            methods[method] = { count: 0, amount: 0 };
        }
        methods[method].count += 1;
        methods[method].amount += parseFloat(p.amount) || 0;
    });
    
    const sortedMethods = Object.entries(methods)
        .sort((a, b) => b[1].amount - a[1].amount);
    
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const colors = { cash: '#10b981', upi: '#3b82f6', gateway: 'var(--primary)', bank_transfer: '#f59e0b' };
    const icons = { cash: '💵', upi: '📱', gateway: '💳', bank_transfer: '🏦' };
    
    const html = sortedMethods.length > 0 ? sortedMethods.map(([method, data]) => {
        const percentage = totalAmount > 0 ? ((data.amount / totalAmount) * 100).toFixed(1) : 0;
        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 14px;">${icons[method] || '💳'} ${method.replace('_', ' ').toUpperCase()}</span>
                    <span style="font-weight: 700;">₹${(data.amount/100000).toFixed(2)}L (${percentage}%)</span>
                </div>
                <div style="background: var(--background); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: ${colors[method] || '#6b7280'}; transition: width 0.3s;"></div>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${data.count} transactions</div>
            </div>
        `;
    }).join('') : '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No payment data available</div>';
    
    const element = document.getElementById(targetElementId);
    if (element) {
        element.innerHTML = html;
    }
}

/**
 * Top Properties Stats Functions (with sorting)
 */
let currentSortBy = 'revenue';

function updateTopPropertiesStats(filteredReservations = null) {
    sortPropertiesBy(currentSortBy, filteredReservations);
}

function sortPropertiesBy(sortType, filteredReservations = null) {
    currentSortBy = sortType;
    
    // Update button styles
    document.getElementById('sortByRevenue').style.background = sortType === 'revenue' ? 'var(--primary)' : 'var(--secondary)';
    document.getElementById('sortByBookings').style.background = sortType === 'bookings' ? 'var(--primary)' : 'var(--secondary)';
    document.getElementById('sortByNights').style.background = sortType === 'nights' ? 'var(--primary)' : 'var(--secondary)';
    document.getElementById('sortByGuests').style.background = sortType === 'guests' ? 'var(--primary)' : 'var(--secondary)';
    document.getElementById('sortByOccupancy').style.background = sortType === 'occupancy' ? 'var(--primary)' : 'var(--secondary)';
    
    try {
        // Get all properties
        const properties = state.properties || [];
        if (properties.length === 0) {
            document.getElementById('topPropertiesStats').innerHTML = 
                '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No properties found</div>';
            return;
        }
        
        // Show filter indicator if filtered
        const reservationsToUse = filteredReservations || state.reservations || [];
        const isFiltered = filteredReservations && filteredReservations.length !== (state.reservations || []).length;
        
        // Calculate stats for each property
        const propertyStats = properties.map(property => {
            // Use filtered reservations if provided, otherwise use all
            const reservationsToUse = filteredReservations || state.reservations || [];
            const propertyReservations = reservationsToUse.filter(r => 
                r.property_id === property.id && r.status !== 'cancelled'
            );
            
            const totalRevenue = propertyReservations.reduce((sum, r) => 
                sum + (parseFloat(r.total_amount) || 0), 0
            );
            
            const totalBookings = propertyReservations.length;
            
            // Calculate total nights (all bookings, not just last 90 days)
            const totalNights = propertyReservations.reduce((sum, r) => 
                sum + (parseInt(r.nights) || 0), 0
            );
            
            // Calculate total guests
            const totalGuests = propertyReservations.reduce((sum, r) => {
                const adults = parseInt(r.adults) || 0;
                const kids = parseInt(r.kids) || 0;
                return sum + adults + kids;
            }, 0);
            
            // Calculate occupancy rate (based on last 90 days)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            
            const recentBookings = propertyReservations.filter(r => 
                new Date(r.check_in) >= ninetyDaysAgo
            );
            
            const recentNights = recentBookings.reduce((sum, r) => 
                sum + (parseInt(r.nights) || 0), 0
            );
            
            const occupancyRate = recentNights > 0 ? ((recentNights / 90) * 100).toFixed(1) : 0;
            
            // Calculate average booking value
            const avgBookingValue = totalBookings > 0 ? (totalRevenue / totalBookings) : 0;
            
            // Get confirmed bookings
            const confirmedBookings = propertyReservations.filter(r => 
                r.status === 'confirmed' || r.status === 'checked-in'
            ).length;
            
            return {
                id: property.id,
                name: property.name,
                location: property.location || 'N/A',
                totalRevenue,
                totalBookings,
                totalNights,
                totalGuests,
                confirmedBookings,
                occupancyRate: parseFloat(occupancyRate),
                avgBookingValue,
                propertyType: property.property_type || 'Villa'
            };
        });
        
        // Sort based on selected criteria
        let sortedProperties = [...propertyStats];
        if (sortType === 'revenue') {
            sortedProperties.sort((a, b) => b.totalRevenue - a.totalRevenue);
        } else if (sortType === 'bookings') {
            sortedProperties.sort((a, b) => b.totalBookings - a.totalBookings);
        } else if (sortType === 'nights') {
            sortedProperties.sort((a, b) => b.totalNights - a.totalNights);
        } else if (sortType === 'guests') {
            sortedProperties.sort((a, b) => b.totalGuests - a.totalGuests);
        } else if (sortType === 'occupancy') {
            sortedProperties.sort((a, b) => b.occupancyRate - a.occupancyRate);
        }
        
        // Take top 15
        const top15 = sortedProperties.slice(0, 15);
        
        // Render property cards
        let html = '';
        
        // Add filter indicator if filtered
        if (isFiltered) {
            html += `
                <div style="margin-bottom: 16px; padding: 12px 16px; background: #e0e7ff; border-radius: 8px; font-size: 13px; color: #4338ca;">
                    📊 Showing stats based on filtered data (${reservationsToUse.length} bookings)
                </div>
            `;
        }
        
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">';
        
        top15.forEach((prop, index) => {
            const rankColor = index < 3 ? 'var(--warning)' : 'var(--text-secondary)';
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            
            html += `
                <div class="stat-card" style="position: relative; overflow: visible;">
                    <div style="position: absolute; top: -10px; right: -10px; background: ${rankColor}; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        ${rankEmoji}
                    </div>
                    
                    <div style="margin-bottom: 12px;">
                        <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                            ${prop.name}
                        </h3>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            📍 ${prop.location} • ${prop.propertyType}
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                Total Revenue
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--success);">
                                ${formatCurrency(prop.totalRevenue)}
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                Bookings
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--primary);">
                                ${prop.totalBookings}
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                Total Nights
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--primary);">
                                ${prop.totalNights}
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                Total Guests
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: #06b6d4;">
                                ${prop.totalGuests}
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                Occupancy
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: ${prop.occupancyRate >= 70 ? 'var(--success)' : prop.occupancyRate >= 40 ? 'var(--warning)' : 'var(--danger)'};">
                                ${prop.occupancyRate}%
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                Avg Value
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--text-primary);">
                                ${formatCurrency(prop.avgBookingValue)}
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                ${prop.confirmedBookings} confirmed
                            </div>
                            <button class="btn btn-sm" onclick="viewPropertyDetails(${prop.id})" style="padding: 6px 12px; font-size: 12px;">
                                View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        if (top15.length === 0) {
            html = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No bookings data available for properties</div>';
        }
        
        document.getElementById('topPropertiesStats').innerHTML = html;
        
    } catch (error) {
        console.error('Error calculating property stats:', error);
        document.getElementById('topPropertiesStats').innerHTML = 
            '<div style="text-align: center; padding: 40px; color: var(--danger);">Error loading property statistics</div>';
    }
}

function viewPropertyDetails(propertyId) {
    // Navigate to properties view and show details for this property
    showView('properties');
    // You could add code here to automatically open the property details modal
    showToast('Navigation', 'Opening property details...', '🏡');
}

/**
 * Load AI-powered insights based on current data
 */
function loadAIInsights(reservations, properties) {
    const insights = [];
    
    // Calculate various metrics for insights
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0;
    
    // Analyze booking sources
    const sources = {};
    reservations.forEach(r => {
        const source = r.booking_source || 'DIRECT';
        sources[source] = (sources[source] || 0) + 1;
    });
    
    // Calculate property performance
    const propertyPerformance = {};
    reservations.forEach(r => {
        if (!propertyPerformance[r.property_id]) {
            propertyPerformance[r.property_id] = {
                name: r.property_name,
                revenue: 0,
                bookings: 0
            };
        }
        propertyPerformance[r.property_id].revenue += parseFloat(r.total_amount) || 0;
        propertyPerformance[r.property_id].bookings += 1;
    });
    
    const sortedProps = Object.values(propertyPerformance).sort((a, b) => b.revenue - a.revenue);
    
    // Insight 1: Top performer analysis
    if (sortedProps.length > 0 && sortedProps[0].bookings > 5) {
        const topProp = sortedProps[0];
        const avgRevenue = topProp.revenue / topProp.bookings;
        insights.push({
            icon: '🏆',
            type: 'Top Performer',
            title: 'Revenue Champion',
            message: `${topProp.name} is your star property with ${formatCurrency(topProp.revenue)} revenue from ${topProp.bookings} bookings. Average booking value: ${formatCurrency(avgRevenue)}.`,
            action: 'View Details',
            color: 'rgba(16, 185, 129, 0.15)'
        });
    }
    
    // Insight 2: Channel optimization
    const maxSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0];
    if (maxSource && maxSource[1] > 3) {
        const percentage = ((maxSource[1] / reservations.length) * 100).toFixed(0);
        insights.push({
            icon: '📊',
            type: 'Channel Insight',
            title: 'Booking Channel Leader',
            message: `${maxSource[0]} brings ${percentage}% of your bookings. Consider optimizing your presence on this platform for even better results.`,
            action: 'Optimize Channel',
            color: 'rgba(37, 99, 235, 0.15)'
        });
    }
    
    // Insight 3: Revenue opportunity (underperforming properties)
    if (sortedProps.length > 2) {
        const lowPerformer = sortedProps[sortedProps.length - 1];
        if (lowPerformer.bookings < 3) {
            insights.push({
                icon: '💡',
                type: 'Growth Opportunity',
                title: 'Boost Underutilized Property',
                message: `${lowPerformer.name} has potential for growth. Consider improving photos, adjusting pricing, or running targeted promotions.`,
                action: 'Create Campaign',
                color: 'rgba(245, 158, 11, 0.15)'
            });
        }
    }
    
    // Insight 4: Pricing optimization
    if (avgBookingValue > 0) {
        const highValueProps = sortedProps.filter(p => (p.revenue / p.bookings) > avgBookingValue * 1.2);
        if (highValueProps.length > 0) {
            insights.push({
                icon: '💰',
                type: 'Pricing Strategy',
                title: 'Premium Pricing Success',
                message: `${highValueProps.length} ${highValueProps.length === 1 ? 'property is' : 'properties are'} achieving 20%+ higher booking values. Apply similar strategies to other properties.`,
                action: 'View Pricing',
                color: 'rgba(8, 145, 178, 0.15)'
            });
        }
    }
    
    // Insight 5: Occupancy alert
    const currentMonth = new Date().getMonth();
    const currentMonthBookings = reservations.filter(r => {
        const checkIn = new Date(r.check_in);
        return checkIn.getMonth() === currentMonth;
    });
    
    if (currentMonthBookings.length < properties.length * 2) {
        insights.push({
            icon: '📅',
            type: 'Occupancy Alert',
            title: 'Increase Monthly Bookings',
            message: `Current month has ${currentMonthBookings.length} bookings. Running flash sales or weekend deals could fill more nights.`,
            action: 'Run Promotion',
            color: 'rgba(239, 68, 68, 0.15)'
        });
    }
    
    // Insight 6: Guest satisfaction (based on confirmed vs cancelled)
    const cancelledCount = reservations.filter(r => r.status === 'cancelled').length;
    const cancelRate = reservations.length > 0 ? (cancelledCount / reservations.length) * 100 : 0;
    if (cancelRate < 5 && reservations.length > 10) {
        insights.push({
            icon: '⭐',
            type: 'Performance Metric',
            title: 'Excellent Retention',
            message: `Only ${cancelRate.toFixed(1)}% cancellation rate! Your properties are delivering great guest experiences.`,
            action: 'Share Testimonials',
            color: 'rgba(16, 185, 129, 0.15)'
        });
    }
    
    // Render insights
    const html = insights.map(insight => `
        <div style="background: ${insight.color}; backdrop-filter: blur(10px); border-radius: 12px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.2);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="font-size: 28px;">${insight.icon}</div>
                <div style="flex: 1;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; font-weight: 600;">${insight.type}</div>
                    <div style="font-size: 15px; font-weight: 700; margin-top: 2px;">${insight.title}</div>
                </div>
            </div>
            <div style="font-size: 14px; line-height: 1.5; opacity: 0.95; margin-bottom: 12px;">
                ${insight.message}
            </div>
            <button class="btn btn-sm" onclick="showToast('Feature Coming Soon', 'This AI feature will be available soon!', '🚀')" 
                    style="width: 100%; background: rgba(255, 255, 255, 0.9); color: var(--primary); border: none; font-weight: 600;">
                ${insight.action}
            </button>
        </div>
    `).join('');
    
    document.getElementById('aiInsightsContainer').innerHTML = insights.length > 0 ? html : 
        '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7); grid-column: 1 / -1;">AI insights will appear here as you collect more data.</div>';
}

function renderTopProperties(reservations, properties, targetElementId = 'topPropertiesChart') {
    const propertyRevenue = {};
    
    reservations.forEach(r => {
        const propId = r.property_id;
        if (!propertyRevenue[propId]) {
            propertyRevenue[propId] = {
                name: r.property_name,
                revenue: 0,
                bookings: 0,
                nights: 0
            };
        }
        propertyRevenue[propId].revenue += parseFloat(r.total_amount) || 0;
        propertyRevenue[propId].bookings += 1;
        propertyRevenue[propId].nights += parseInt(r.nights) || 0;
    });
    
    const sortedProperties = Object.values(propertyRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10); // Show top 10 instead of 5 in Performance page
    
    const maxRevenue = sortedProperties[0]?.revenue || 1;
    
    const html = sortedProperties.length > 0 ? sortedProperties.map((prop, index) => {
        const percentage = (prop.revenue / maxRevenue) * 100;
        const avgPerNight = prop.nights > 0 ? (prop.revenue / prop.nights) : 0;
        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${index + 1}</span>
                        <span style="font-weight: 600; font-size: 14px;">${prop.name}</span>
                    </div>
                    <span style="color: var(--success); font-weight: 700;">₹${(prop.revenue/100000).toFixed(2)}L</span>
                </div>
                <div style="background: var(--background); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, var(--success), var(--primary)); transition: width 0.3s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                    <span>${prop.bookings} bookings • ${prop.nights} nights</span>
                    <span>₹${Math.round(avgPerNight).toLocaleString('en-IN')}/night</span>
                </div>
            </div>
        `;
    }).join('') : '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No property data available</div>';
    
    const element = document.getElementById(targetElementId);
    if (element) {
        element.innerHTML = html;
    }
}

function renderChannelDistribution(reservations, targetElementId = 'channelDistribution') {
    const channels = {};
    
    reservations.forEach(r => {
        const source = r.booking_source || 'DIRECT';
        if (!channels[source]) {
            channels[source] = { count: 0, revenue: 0 };
        }
        channels[source].count += 1;
        channels[source].revenue += parseFloat(r.total_amount) || 0;
    });
    
    const sortedChannels = Object.entries(channels)
        .sort((a, b) => b[1].revenue - a[1].revenue); // Sort by revenue instead of count
    
    const totalBookings = reservations.length;
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', 'var(--primary)', '#ec4899'];
    const icons = {
        'AIRBNB': '🏠',
        'BOOKING.COM': '🌐',
        'DIRECT': '📞',
        'INSTAGRAM': '📸',
        'WEBSITE': '💻',
        'REFERRAL': '👥'
    };
    
    const html = sortedChannels.length > 0 ? sortedChannels.map(([channel, data], index) => {
        const bookingPercentage = (data.count / totalBookings) * 100;
        const revenuePercentage = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
        const avgBookingValue = data.count > 0 ? data.revenue / data.count : 0;
        
        return `
            <div style="margin-bottom: 16px; padding: 12px; background: var(--background); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">${icons[channel] || '📊'}</span>
                        <span style="font-weight: 600; font-size: 14px;">${channel}</span>
                    </div>
                    <span style="color: var(--success); font-weight: 700;">₹${(data.revenue/100000).toFixed(2)}L</span>
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Bookings</div>
                        <div style="background: rgba(37, 99, 235, 0.1); height: 6px; border-radius: 3px; overflow: hidden;">
                            <div style="width: ${bookingPercentage}%; height: 100%; background: ${colors[index % colors.length]}; transition: width 0.3s;"></div>
                        </div>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">Revenue</div>
                        <div style="background: rgba(16, 185, 129, 0.1); height: 6px; border-radius: 3px; overflow: hidden;">
                            <div style="width: ${revenuePercentage}%; height: 100%; background: ${colors[index % colors.length]}; transition: width 0.3s;"></div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);">
                    <span>${data.count} bookings (${bookingPercentage.toFixed(1)}%)</span>
                    <span>Avg: ₹${(avgBookingValue/100000).toFixed(2)}L</span>
                </div>
            </div>
        `;
    }).join('') : '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No channel data available</div>';
    
    const element = document.getElementById(targetElementId);
    if (element) {
        element.innerHTML = html;
    }
}

async function renderMonthlyTrends(reservations) {
    const monthlyData = {};
    
    reservations.forEach(r => {
        const month = r.month || new Date(r.check_in).toLocaleString('en-US', { month: 'short', year: 'numeric' });
        if (!monthlyData[month]) {
            monthlyData[month] = { bookings: 0, revenue: 0, nights: 0 };
        }
        monthlyData[month].bookings += 1;
        monthlyData[month].revenue += parseFloat(r.total_amount) || 0;
        monthlyData[month].nights += r.nights || 0;
    });
    
    const sortedMonths = Object.entries(monthlyData)
        .sort((a, b) => {
            const dateA = new Date(a[0]);
            const dateB = new Date(b[0]);
            return dateB - dateA;
        })
        .slice(0, 6)
        .reverse();
    
    // Get properties ONCE before the loop
    const properties = await db.getProperties();
    const monthlyTargetNights = properties.length * TARGET_OCCUPANCY_NIGHTS / 12;
    
    const rows = sortedMonths.map(([month, data]) => {
        const occRate = monthlyTargetNights > 0 ? ((data.nights / monthlyTargetNights) * 100).toFixed(1) : 0;

        // Calculate Hostizzy revenue for this month
        const monthReservations = reservations.filter(r => r.month === month);
        const hostizzyRev = monthReservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
        const collected = monthReservations.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
        const pending = data.revenue - collected;

        return `
            <tr>
                <td><strong>${month}</strong></td>
                <td style="text-align: center;">${data.bookings}</td>
                <td style="text-align: center;">${data.nights}</td>
                <td style="text-align: center; font-weight: 600; color: ${occRate >= 50 ? 'var(--success)' : 'var(--warning)'};">${occRate}%</td>
                <td style="text-align: right; font-weight: 700; color: var(--success);">₹${(data.revenue/100000).toFixed(1)}L</td>
                <td style="text-align: right; color: var(--primary);">₹${(hostizzyRev/100000).toFixed(1)}L</td>
                <td style="text-align: right; color: var(--success);">₹${(collected/100000).toFixed(1)}L</td>
                <td style="text-align: right; color: var(--danger);">₹${(pending/100000).toFixed(1)}L</td>
            </tr>
        `;
    }).join('');

    const html = `
        <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Bookings</th>
                    <th>Nights</th>
                    <th>Occ %</th>
                    <th>Revenue</th>
                    <th>Hostizzy</th>
                    <th>Collected</th>
                    <th>Pending</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        </div>
    `;
    
    document.getElementById('monthlyTrends').innerHTML = html || '<div style="text-align: center; color: var(--text-secondary);">No data available</div>';
}

// Payment Reminders - Simplified Version with Collapse
function renderPaymentReminders(reservations) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all reservations with pending/partial payments
    const pendingPayments = reservations.filter(r => {
        const checkInDate = new Date(r.check_in);
        checkInDate.setHours(0, 0, 0, 0);
        const balance = getBalance(r);

        return balance > 1 && // More than ₹1 balance (tolerance)
            r.status !== 'cancelled' &&
            checkInDate >= today; // Only upcoming or today
    }).sort((a, b) => new Date(a.check_in) - new Date(b.check_in));

    const reminderCard = document.getElementById('paymentRemindersCard');
    const remindersList = document.getElementById('paymentRemindersList');
    const remindersCount = document.getElementById('paymentRemindersCount');
    
    if (pendingPayments.length === 0) {
        reminderCard.style.display = 'none';
        return;
    }

    reminderCard.style.display = 'block';
    
    // Keep expanded by default
    remindersList.style.display = 'block';
    document.getElementById('paymentRemindersIcon').textContent = '🔽';
    
    const totalPending = pendingPayments.reduce((sum, r) => 
        sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)), 0
    );
    
    // Update count in header
    remindersCount.textContent = `${pendingPayments.length} pending • ₹${Math.round(totalPending).toLocaleString('en-IN')} due`;

    const html = `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #f59e0b;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div>
                    <div style="font-size: 18px; font-weight: 700; color: #92400e; margin-bottom: 4px;">
                        ⚠️ ${pendingPayments.length} Pending Payment${pendingPayments.length > 1 ? 's' : ''}
                    </div>
                    <div style="font-size: 14px; color: #78350f;">
                        Total Due: ₹${Math.round(totalPending).toLocaleString('en-IN')}
                    </div>
                </div>
            </div>
        </div>
        
        <div style="display: grid; gap: 12px; padding: 0 16px 16px 16px;">
            ${pendingPayments.map(r => {
                const checkInDate = new Date(r.check_in);
                const daysUntilCheckIn = Math.ceil((checkInDate - today) / (1000 * 60 * 60 * 24));
                const balance = getBalance(r);
                const isUrgent = daysUntilCheckIn <= 3;
                
                return `
                    <div style="background: ${isUrgent ? '#fee2e2' : 'white'}; border: 1px solid ${isUrgent ? '#fca5a5' : 'var(--border)'}; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div style="flex: 1; min-width: 200px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                ${isUrgent ? '<span style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">URGENT</span>' : ''}
                                <strong style="font-size: 15px;">${r.booking_id}</strong>
                            </div>
                            <div style="font-size: 14px; color: var(--text); margin-bottom: 4px;">
                                👤 ${r.guest_name}
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                🏠 ${r.property_name} • 📅 ${formatDate(r.check_in)} ${daysUntilCheckIn === 0 ? '(Today)' : `(${daysUntilCheckIn} ${daysUntilCheckIn === 1 ? 'day' : 'days'})`}
                            </div>
                        </div>
                        
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: var(--danger); margin-bottom: 8px;">
                                ₹${Math.round(balance).toLocaleString('en-IN')}
                            </div>
                            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                <button class="btn btn-success btn-sm" onclick="openPaymentModal('${r.booking_id}')" title="Collect Payment">
                                    💰 Collect
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="sendWhatsAppReminder('${r.booking_id}')" title="Send WhatsApp Reminder">
                                    📱 Remind
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    remindersList.innerHTML = html;
}

// Toggle Payment Reminders Collapse
function togglePaymentReminders() {
    const content = document.getElementById('paymentRemindersList');
    const icon = document.getElementById('paymentRemindersIcon');
    const card = document.getElementById('paymentRemindersCard');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '🔽';
        card.classList.remove('collapsed');
    } else {
        content.style.display = 'none';
        icon.textContent = '▶️';
        card.classList.add('collapsed');
    }
}

function toggleAllPaymentReminders(checkbox) {
    document.querySelectorAll('.reminder-checkbox').forEach(cb => {
        cb.checked = checkbox.checked;
    });
    
    // Sync both checkboxes
    const headerCheckbox = document.getElementById('selectAllRemindersHeader');
    const summaryCheckbox = document.getElementById('selectAllPaymentReminders');
    if (headerCheckbox && summaryCheckbox) {
        headerCheckbox.checked = checkbox.checked;
        summaryCheckbox.checked = checkbox.checked;
    }
}

// Action Center Functions
let currentActionTab = 'urgent';

function switchActionTab(tab) {
    currentActionTab = tab;
    
    // Update tab buttons
    document.getElementById('urgentTab').style.background = tab === 'urgent' ? 'var(--danger)' : 'var(--secondary)';
    document.getElementById('todayTab').style.background = tab === 'today' ? 'var(--warning)' : 'var(--secondary)';
    document.getElementById('upcomingTab').style.background = tab === 'upcoming' ? 'var(--success)' : 'var(--secondary)';
    
    // Show/hide content
    document.getElementById('urgentActions').style.display = tab === 'urgent' ? 'block' : 'none';
    document.getElementById('todayActions').style.display = tab === 'today' ? 'block' : 'none';
    document.getElementById('upcomingActions').style.display = tab === 'upcoming' ? 'block' : 'none';
}


function renderActionCenter(reservations) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    // Categorize actions
    const urgentActions = [];
    const todayActions = [];
    const upcomingActions = [];
    
    // Calculate date range for Action Center (future + current month + past month only)
    const showAllCheckbox = document.getElementById('actionCenterShowAll');
    const showAll = showAllCheckbox ? showAllCheckbox.checked : false;
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);

    reservations.forEach(r => {
        if (r.status === 'cancelled') return;
        
        const checkInDate = new Date(r.check_in);
        checkInDate.setHours(0, 0, 0, 0);
        
        const checkOutDate = new Date(r.check_out);
        checkOutDate.setHours(0, 0, 0, 0);
        
        const balance = getBalance(r);
        const isOTA = r.booking_source && r.booking_source !== 'DIRECT';

        // Skip reservations older than 1 month ONLY if "Show all" is NOT enabled
        if (!showAll && checkInDate < oneMonthAgo) return;
        
        // URGENT: Overdue payments (only from past month onwards)
        if (balance > 0 && checkInDate < today) {
            urgentActions.push({
                type: 'overdue_payment',
                priority: 1,
                reservation: r,
                title: `💸 Overdue Payment - ${r.guest_name}`,
                details: `₹${Math.round(balance).toLocaleString('en-IN')} ${isOTA ? 'net payout' : 'pending'} • Check-in was ${formatDate(r.check_in)}`,
                badge: 'overdue',
                bookingId: r.booking_id
            });
        }
        
        // URGENT: Check-ins today with pending payment
        if (checkInDate.getTime() === today.getTime() && balance > 0) {
            urgentActions.push({
                type: 'checkin_payment',
                priority: 2,
                reservation: r,
                title: `Payment Due - Check-in Today`,
                details: `${r.guest_name} • ${r.property_name} • ₹${Math.round(balance).toLocaleString('en-IN')} pending`,
                badge: 'urgent',
                bookingId: r.booking_id,
                icon: 'alert-circle'
            });
        }

        // URGENT: Missing guest information (no phone or email)
        if (!r.guest_phone || !r.guest_email) {
            if (checkInDate >= today) {
                urgentActions.push({
                    type: 'missing_info',
                    priority: 3,
                    reservation: r,
                    title: `Incomplete Guest Profile - ${r.guest_name}`,
                    details: `Missing ${!r.guest_phone ? 'phone' : ''} ${!r.guest_phone && !r.guest_email ? 'and' : ''} ${!r.guest_email ? 'email' : ''} • Check-in: ${formatDate(r.check_in)}`,
                    badge: 'warning',
                    bookingId: r.booking_id,
                    icon: 'user-x'
                });
            }
        }

        // TODAY: Pending confirmations (pending status bookings)
        if (r.status === 'pending') {
            todayActions.push({
                type: 'pending_confirmation',
                reservation: r,
                title: `Pending Confirmation - ${r.guest_name}`,
                details: `${r.property_name} • Check-in: ${formatDate(r.check_in)} • Needs approval`,
                badge: 'pending',
                bookingId: r.booking_id,
                icon: 'clock'
            });
        }
        
        // UPCOMING: Check-ins in next 7 days
        if (checkInDate > today && checkInDate <= nextWeek) {
            const daysUntil = Math.ceil((checkInDate - today) / (1000 * 60 * 60 * 24));
            upcomingActions.push({
                type: 'upcoming_checkin',
                reservation: r,
                title: `📅 Check-in in ${daysUntil} day${daysUntil > 1 ? 's' : ''}: ${r.guest_name}`,
                details: `${r.property_name} • ${formatDate(r.check_in)} • ${r.payment_status === 'paid' ? '✅ Paid' : '⏳ Payment pending'}`,
                badge: 'due-soon',
                bookingId: r.booking_id,
                daysUntil: daysUntil
            });
        }
    });
    
    // Sort by priority
    urgentActions.sort((a, b) => a.priority - b.priority);
    upcomingActions.sort((a, b) => a.daysUntil - b.daysUntil);
    
    // Update counts
    document.getElementById('urgentCount').textContent = urgentActions.length;
    document.getElementById('todayCount').textContent = todayActions.length;
    document.getElementById('upcomingCount').textContent = upcomingActions.length;
    
    // Update badges
    const urgentBadge = document.getElementById('urgentBadge');
    if (urgentBadge) urgentBadge.textContent = urgentActions.length;
    
    const totalBadge = document.getElementById('actionCenterTotalBadge');
    if (totalBadge) totalBadge.textContent = urgentActions.length + todayActions.length + upcomingActions.length;
    
    // Show/hide Action Center
    const totalActions = urgentActions.length + todayActions.length + upcomingActions.length;
    const actionCenterCard = document.getElementById('actionCenterCard');
    if (totalActions > 0) {
        actionCenterCard.style.display = 'block';
    } else {
        actionCenterCard.style.display = 'none';
    }
    
    // Auto-collapse overdue section if more than 5 items
    const urgentList = document.getElementById('urgentActionsList');
    const overdueIcon = document.getElementById('overdueToggleIcon');
    if (urgentActions.length > 5 && urgentList && overdueIcon) {
        urgentList.style.display = 'none';
        overdueIcon.textContent = '▶️';
    }
    
    // Render each tab
        renderActionList('urgentActionsList', urgentActions, 'urgent');
        renderActionList('todayActionsList', todayActions, 'today');
        renderActionList('upcomingActionsList', upcomingActions, 'upcoming');
    }

    function renderActionList(elementId, actions, type) {
        const element = document.getElementById(elementId);
        
        if (actions.length === 0) {
            element.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    ${type === 'urgent' ? '✅ No urgent actions!' : 
                    type === 'today' ? '📅 No activities today' : 
                    '🎯 Nothing scheduled for next 7 days'}
                </div>
            `;
            return;
        }
        
        element.innerHTML = actions.map(action => `
            <div class="action-item ${type}">
                <div class="action-info">
                    <div class="action-title">
                        ${action.title}
                        <span style="background: var(--background); padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; font-weight: 500;">${action.bookingId}</span>
                    </div>
                    <div class="action-details">
                        ${action.details}
                        ${action.badge ? `<span class="action-badge ${action.badge}" style="margin-left: 8px;">${action.badge.replace('_', ' ')}</span>` : ''}
                    </div>
                </div>
                <div class="action-buttons">
                    ${action.type.includes('payment') || action.type === 'checkin_payment' || action.type === 'overdue_payment' ? 
                        `<button class="btn btn-success btn-sm" onclick="openPaymentModal('${action.bookingId}')" title="Collect Payment">
                            💰 Collect
                        </button>` : ''}
                    <button class="btn btn-primary btn-sm" onclick="sendWhatsAppReminder('${action.bookingId}')" title="Send WhatsApp">
                        📱 WhatsApp
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="viewBookingDetails('${action.bookingId}')" title="View Details">
                        👁️ View
                    </button>
                </div>
            </div>
        `).join('');
    }

    function sendWhatsAppReminder(bookingId) {
        const reservation = allReservations.find(r => r.booking_id === bookingId);
        if (!reservation) {
            showToast('Error', 'Reservation not found', '❌');
            return;
        }
        
        const balance = getBalance(reservation);
        const phone = reservation.guest_phone.replace(/[^0-9]/g, '');
        
        let message = `Hello ${reservation.guest_name}!\n\n`;
        message += `This is a reminder for your booking at ${reservation.property_name}\n`;
        message += `Booking ID: ${reservation.booking_id}\n`;
        message += `Check-in: ${formatDate(reservation.check_in)}\n`;
        message += `Check-out: ${formatDate(reservation.check_out)}\n\n`;
        
        if (balance > 0) {
            message += `Pending Payment: ₹${Math.round(balance).toLocaleString('en-IN')}\n\n`;
        }
        
        message += `Looking forward to hosting you!\n- Hostizzy Team`;
        
        const whatsappUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        showToast('WhatsApp Opened', 'Message template ready to send', '✅');
    }

    function viewBookingDetails(bookingId) {
        showView('reservations');
        
        // Filter to show only this booking
        const searchInput = document.getElementById('searchReservations');
        searchInput.value = bookingId;
        filterReservations();
        
        showToast('Booking Found', `Showing details for ${bookingId}`, '👁️');
    }
    function toggleOverdueActions(event) {
        const list = document.getElementById('urgentActionsList');
        const icon = document.getElementById('overdueToggleIcon');
        
        if (list.style.display === 'none') {
            list.style.display = 'block';
            icon.textContent = '🔽';
        } else {
            list.style.display = 'none';
            icon.textContent = '▶️';
        }
    }
    function toggleActionCenterRange() {
        const showAll = document.getElementById('actionCenterShowAll').checked;
        
        if (showAll) {
            showToast('Action Center', 'Showing all historical data', 'ℹ️');
        } else {
            showToast('Action Center', 'Showing last 30 days only', 'ℹ️');
        }
        
        // Re-render Action Center with all reservations (not just confirmed)
        // This will now show all historical data when checkbox is enabled
        renderActionCenter(allReservations);
    }

// Bulk Payment Collection
function openBulkPaymentModal() {
    const selectedCheckboxes = document.querySelectorAll('.reminder-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showToast('No Selection', 'Please select bookings to collect payment', '⚠️');
        return;
    }

    const bookingIds = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-booking-id'));
    const selectedBookings = allReservations.filter(r => bookingIds.includes(r.booking_id));
    
    let totalDue = 0;
    const listHTML = selectedBookings.map(r => {
        const balance = getBalance(r);
        totalDue += balance;
        return `
            <div style="padding: 12px; background: var(--background); border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 600;">${r.booking_id} - ${r.guest_name}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${r.property_name} • ${formatDate(r.check_in)}</div>
                </div>
                <div style="font-weight: 700; color: var(--danger);">₹${Math.round(balance).toLocaleString('en-IN')}</div>
            </div>
        `;
    }).join('');

    document.getElementById('bulkPaymentCount').textContent = selectedBookings.length;
    document.getElementById('bulkTotalDue').textContent = '₹' + Math.round(totalDue).toLocaleString('en-IN');
    document.getElementById('bulkPaymentList').innerHTML = listHTML;
    document.getElementById('bulkPaymentDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('bulkPaymentMethod').value = '';
    document.getElementById('bulkPaymentRecipient').value = '';
    document.getElementById('bulkPaymentRecipientGroup').style.display = 'none';
    document.getElementById('bulkPaymentNotes').value = '';

    // Store selected booking IDs
    window.bulkPaymentBookings = selectedBookings;

    document.getElementById('bulkPaymentModal').classList.add('active');
}

function closeBulkPaymentModal() {
    document.getElementById('bulkPaymentModal').classList.remove('active');
    window.bulkPaymentBookings = null;
}

function toggleBulkRecipientField() {
    const method = document.getElementById('bulkPaymentMethod').value;
    const recipientGroup = document.getElementById('bulkPaymentRecipientGroup');
    const recipientSelect = document.getElementById('bulkPaymentRecipient');
    
    if (method === 'cash' || method === 'upi' || method === 'bank_transfer') {
        recipientGroup.style.display = 'block';
        recipientSelect.required = true;
    } else {
        recipientGroup.style.display = 'none';
        recipientSelect.required = false;
        recipientSelect.value = '';
    }
}

async function saveBulkPayments() {
    if (!window.bulkPaymentBookings || window.bulkPaymentBookings.length === 0) {
        showToast('Error', 'No bookings selected', '❌');
        return;
    }

    const method = document.getElementById('bulkPaymentMethod').value;
    const date = document.getElementById('bulkPaymentDate').value;
    const notes = document.getElementById('bulkPaymentNotes').value;

    if (!method || !date) {
        showToast('Validation Error', 'Please fill all required fields', '❌');
        return;
    }

    const recipientGroup = document.getElementById('bulkPaymentRecipientGroup');
    if (recipientGroup.style.display !== 'none') {
        const recipient = document.getElementById('bulkPaymentRecipient').value;
        if (!recipient) {
            showToast('Validation Error', 'Please select payment recipient', '❌');
            return;
        }
    }

    const recipient = document.getElementById('bulkPaymentRecipient').value || null;

    try {
        let successCount = 0;
        for (const booking of window.bulkPaymentBookings) {
            const balance = getBalance(booking);

            if (balance <= 0) continue;

            const payment = {
                booking_id: booking.booking_id,
                payment_date: date,
                amount: balance,
                payment_method: method,
                payment_recipient: recipient,
                reference_number: null,
                notes: notes || `Bulk payment collection`,
                created_by: currentUser?.id || null
            };

            if (navigator.onLine) {
                await db.savePayment(payment);
                await recalculatePaymentStatus(booking.booking_id);
            } else {
                await saveToOfflineDB('pendingPayments', payment);
            }
            
            successCount++;
        }

        closeBulkPaymentModal();
        await loadDashboard();
        await loadPayments();
        await loadReservations();
        
        showToast('Success', `Collected payments for ${successCount} bookings`, '✅');
        
        // Clear checkboxes
        document.querySelectorAll('.reminder-checkbox').forEach(cb => cb.checked = false);
        if (document.getElementById('selectAllReminders')) {
            document.getElementById('selectAllReminders').checked = false;
        }

    } catch (error) {
        console.error('Bulk payment error:', error);
        showToast('Error', 'Failed to save payments: ' + error.message, '❌');
    }
}

 // Helper function to populate filters and display reservations
