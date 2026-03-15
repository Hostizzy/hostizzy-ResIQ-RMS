// ResIQ Property View — Property analytics, KPIs, charts, heatmap, export

async function initializePerformanceView() {
    try {
        // Populate property dropdown
        const properties = await db.getProperties();
        const propertyFilter = document.getElementById('performancePropertyFilter');
        propertyFilter.innerHTML = '<option value="">🏠 All Properties</option>' +
            properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        // Populate month dropdown with last 24 months
        const monthFilter = document.getElementById('performanceMonthFilter');
        const months = [];
        const today = new Date();

        for (let i = 0; i < 24; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            months.push(`<option value="${year}-${String(month + 1).padStart(2, '0')}">${monthName}</option>`);
        }

        monthFilter.innerHTML = '<option value="all_time">All Time</option>' + months.join('');

        // Set current month as default
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        monthFilter.value = currentMonth;

        // Load initial data
        await loadPropertyPerformance();
    } catch (error) {
        console.error('Performance initialization error:', error);
        showToast('Error', 'Failed to initialize performance view', '❌');
    }
}

// ============================================================================
// PROPERTY VIEW FUNCTIONS
// ============================================================================

// Global state for Property View
let propertyViewData = {
    selectedProperty: null,
    reservations: [],
    filteredReservations: [],
    currentSort: { field: 'check_in', direction: 'desc' },
    currentPage: 1,
    itemsPerPage: 50
};

// Global chart instances for cleanup
let propertyCharts = {
    revenue: null,
    sources: null,
    paymentStatus: null,
    bookingTypes: null
};

// Main loader function for Property View
async function loadPropertyView() {
    try {
        // First, populate property dropdown if empty
        const propertySelect = document.getElementById('propertySelectFilter');
        if (propertySelect.options.length <= 1) {
            const properties = await db.getProperties();
            const currentValue = propertySelect.value;

            propertySelect.innerHTML = '<option value="">-- Select a Property --</option>' +
                properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

            if (currentValue) propertySelect.value = currentValue;
        }

        const propertyId = document.getElementById('propertySelectFilter').value;
        const dateRange = document.getElementById('propertyDateRange').value;

        // Show/hide custom date range inputs
        const customRange = document.getElementById('propertyCustomDateRange');
        const customRangeTo = document.getElementById('propertyCustomDateRangeTo');
        if (dateRange === 'custom') {
            customRange.style.display = 'block';
            customRangeTo.style.display = 'block';
        } else {
            customRange.style.display = 'none';
            customRangeTo.style.display = 'none';
        }

        // Require property selection
        if (!propertyId) {
            showToast('Select Property', 'Please select a property to view analytics', '🏠');
            return;
        }

        // Get date range
        const dateFilter = getPropertyDateFilter(dateRange);

        // Fetch all data
        const [allReservations, properties, payments] = await Promise.all([
            db.getReservations(),
            db.getProperties(),
            db.getAllPayments()
        ]);

        // Find selected property
        propertyViewData.selectedProperty = properties.find(p => p.id == propertyId);
        if (!propertyViewData.selectedProperty) {
            showToast('Error', 'Property not found', '❌');
            return;
        }

        // Filter reservations for this property
        let reservations = allReservations.filter(r => r.property_id == propertyId);

        // Apply date filter
        if (dateFilter.start && dateFilter.end) {
            reservations = reservations.filter(r => {
                const checkIn = new Date(r.check_in);
                return checkIn >= dateFilter.start && checkIn <= dateFilter.end;
            });
        }

        // Store in global state
        propertyViewData.reservations = reservations;
        propertyViewData.filteredReservations = reservations;

        // Calculate nights for each reservation
        reservations.forEach(r => {
            const checkIn = new Date(r.check_in);
            const checkOut = new Date(r.check_out);
            r.nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        });

        // Filter payments for these reservations
        const reservationIds = reservations.map(r => r.id);
        const filteredPayments = payments.filter(p => reservationIds.includes(p.reservation_id));

        // All reservations for this property (no date filter) — needed for prev period MoM
        const allPropertyReservations = allReservations.filter(r => r.property_id == propertyId);

        // Render all sections
        renderPropertyKPIs(reservations, allPropertyReservations, filteredPayments, dateFilter);
        renderAllReservationsTable(reservations);
        renderMoMComparison(reservations, propertyId);
        renderPaymentBreakdown(reservations, filteredPayments);
        renderPropertyPerformanceMetrics(reservations);
        renderPropertyCharts(reservations, filteredPayments);
        renderBookingTypeBreakdown(reservations);
        renderPropertyOccupancyHeatmap(reservations, dateFilter);

    } catch (error) {
        console.error('Property View load error:', error);
        showToast('Error', 'Failed to load property analytics', '❌');
    }
}

// Get date filter based on selection
function getPropertyDateFilter(dateRange) {
    const now = new Date();
    let start, end, prevStart, prevEnd;

    switch(dateRange) {
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            break;
        case 'last_month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            break;
        case 'last_3_months':
            start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            prevStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            break;
        case 'last_6_months':
            start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            prevStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            break;
        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            prevStart = new Date(now.getFullYear() - 1, 0, 1);
            prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
            break;
        case 'custom': {
            const fromInput = document.getElementById('propertyDateFrom').value;
            const toInput = document.getElementById('propertyDateTo').value;
            if (fromInput && toInput) {
                start = new Date(fromInput);
                end = new Date(toInput); end.setHours(23, 59, 59);
                const dur = end - start;
                prevEnd = new Date(start); prevEnd.setMilliseconds(-1);
                prevStart = new Date(prevEnd.getTime() - dur + 1);
            }
            break;
        }
        case 'all':
        default:
            start = null; end = null; prevStart = null; prevEnd = null;
    }

    return { start, end, prevStart, prevEnd };
}

// Calculate previous month's data for MoM comparison
function getPreviousMonthData(reservations, currentStart, currentEnd) {
    const monthDiff = Math.round((currentEnd - currentStart) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(currentStart);
    prevStart.setDate(prevStart.getDate() - monthDiff);
    const prevEnd = new Date(currentStart);
    prevEnd.setSeconds(prevEnd.getSeconds() - 1);

    return reservations.filter(r => {
        const checkIn = new Date(r.check_in);
        return checkIn >= prevStart && checkIn <= prevEnd;
    });
}

// Calculate MoM percentage change
function calculateMoMChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 2: KPI Cards & Reservations Table
// ============================================================================


// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 2: KPI Cards & Reservations Table
// ============================================================================

// Render KPI Cards with MoM comparison
function renderPropertyKPIs(reservations, allPropertyReservations, payments, dateFilter) {
    const container = document.getElementById('propertyKPICards');

    // Filter active reservations (current period)
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Calculate current metrics
    const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalBookings = activeRes.length;
    const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);

    // Calculate ADR (Average Daily Rate)
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

    // Occupancy: nights booked vs days in period
    const daysInPeriod = dateFilter.start && dateFilter.end
        ? Math.ceil((dateFilter.end - dateFilter.start) / (1000 * 60 * 60 * 24))
        : 365;
    const occupancy = daysInPeriod > 0 ? (totalNights / daysInPeriod) * 100 : 0;

    // Collection rate from payments
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

    // Previous period — use allPropertyReservations (full property history, not date-filtered)
    const hasPrevPeriod = !!(dateFilter.prevStart && dateFilter.prevEnd);
    let prevRevenue = 0, prevBookings = 0, prevOccupancy = 0, prevADR = 0, prevCollection = 0;

    if (hasPrevPeriod) {
        const prevData = (allPropertyReservations || []).filter(r => {
            const checkIn = new Date(r.check_in);
            return checkIn >= dateFilter.prevStart && checkIn <= dateFilter.prevEnd;
        });

        const prevActiveRes = prevData.filter(r => r.status !== 'cancelled');
        prevRevenue  = prevActiveRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        prevBookings = prevActiveRes.length;
        const prevNights = prevActiveRes.reduce((sum, r) => sum + (r.nights || 0), 0);
        prevADR      = prevNights > 0 ? prevRevenue / prevNights : 0;
        prevOccupancy = daysInPeriod > 0 ? (prevNights / daysInPeriod) * 100 : 0;

        const prevBookingIds = new Set(prevActiveRes.map(r => r.booking_id));
        const prevPaid = payments
            .filter(p => prevBookingIds.has(p.booking_id))
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        prevCollection = prevRevenue > 0 ? (prevPaid / prevRevenue) * 100 : 0;
    }

    // MoM helper — returns null when no prev period to avoid misleading 100%
    const mom = (cur, prev) => hasPrevPeriod ? calculateMoMChange(cur, prev) : null;

    const revenueMoM    = mom(totalRevenue, prevRevenue);
    const bookingsMoM   = mom(totalBookings, prevBookings);
    const occupancyMoM  = mom(occupancy, prevOccupancy);
    const adrMoM        = mom(adr, prevADR);
    const collectionMoM = mom(collectionRate, prevCollection);

    // Render KPI cards
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${formatCurrency(totalRevenue)}</div>
            <div class="stat-label">Total Revenue</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(revenueMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatPercentage(occupancy)}</div>
            <div class="stat-label">Occupancy Rate</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(occupancyMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatCurrency(adr)}</div>
            <div class="stat-label">Avg Daily Rate (ADR)</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(adrMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalBookings}</div>
            <div class="stat-label">Total Bookings</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(bookingsMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatPercentage(collectionRate)}</div>
            <div class="stat-label">Collection Rate</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(collectionMoM)}</div>` : ''}
        </div>
    `;
}

// Render All Reservations Table
function renderAllReservationsTable(reservations) {
    const tbody = document.getElementById('propertyReservationsTableBody');

    if (reservations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    No reservations found for selected filters
                </td>
            </tr>
        `;
        return;
    }

    // Sort reservations
    const sorted = [...reservations].sort((a, b) => {
        const field = propertyViewData.currentSort.field;
        const direction = propertyViewData.currentSort.direction === 'asc' ? 1 : -1;

        if (field === 'check_in' || field === 'check_out') {
            return (new Date(a[field]) - new Date(b[field])) * direction;
        }
        if (field === 'total_amount' || field === 'paid_amount') {
            return ((parseFloat(a[field]) || 0) - (parseFloat(b[field]) || 0)) * direction;
        }
        return (String(a[field]).localeCompare(String(b[field]))) * direction;
    });

    // Pagination
    const start = (propertyViewData.currentPage - 1) * propertyViewData.itemsPerPage;
    const end = start + propertyViewData.itemsPerPage;
    const paginatedRes = sorted.slice(start, end);

    // Render rows
    tbody.innerHTML = paginatedRes.map(r => {
        const pending = (parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0);
        const paymentStatusBadge = getPaymentStatusBadge(r.payment_status);
        const bookingStatusBadge = getBookingStatusBadge(r.status);
        const bookingTypeIcon = BOOKING_TYPES[r.booking_type]?.icon || '📋';

        return `
            <tr>
                <td><strong>${r.booking_id || 'N/A'}</strong></td>
                <td>${r.guest_name || 'N/A'}</td>
                <td>${formatDate(r.check_in)}</td>
                <td>${formatDate(r.check_out)}</td>
                <td>${r.nights || 0}</td>
                <td>${bookingTypeIcon} ${BOOKING_TYPES[r.booking_type]?.label || r.booking_type || 'N/A'}</td>
                <td><strong>${formatCurrency(r.total_amount)}</strong></td>
                <td style="color: var(--success);">${formatCurrency(r.paid_amount)}</td>
                <td style="color: ${pending > 0 ? 'var(--danger)' : 'var(--text-secondary)'};">${formatCurrency(pending)}</td>
                <td>${paymentStatusBadge}</td>
                <td>${bookingStatusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewReservationDetails('${r.booking_id}')" title="View Details">
                        👁️
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Render pagination
    renderPropertyReservationsPagination(sorted.length);
}

// Render pagination controls
function renderPropertyReservationsPagination(totalItems) {
    const container = document.getElementById('propertyReservationsPagination');
    const totalPages = Math.ceil(totalItems / propertyViewData.itemsPerPage);

    if (totalPages <= 1) {
        container.innerHTML = `<div style="color: var(--text-secondary);">Showing ${totalItems} reservations</div>`;
        return;
    }

    const currentPage = propertyViewData.currentPage;

    container.innerHTML = `
        <div style="color: var(--text-secondary);">
            Showing ${((currentPage - 1) * propertyViewData.itemsPerPage) + 1} - ${Math.min(currentPage * propertyViewData.itemsPerPage, totalItems)} of ${totalItems}
        </div>
        <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm" onclick="changePropertyPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i> Previous
            </button>
            <span style="padding: 8px 12px; color: var(--text-secondary);">
                Page ${currentPage} of ${totalPages}
            </span>
            <button class="btn btn-sm" onclick="changePropertyPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                Next <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
            </button>
        </div>
    `;
}

// Change page
function changePropertyPage(page) {
    const totalPages = Math.ceil(propertyViewData.filteredReservations.length / propertyViewData.itemsPerPage);
    if (page < 1 || page > totalPages) return;

    propertyViewData.currentPage = page;
    renderAllReservationsTable(propertyViewData.filteredReservations);
}

// Sort table
function sortPropertyReservations(field) {
    if (propertyViewData.currentSort.field === field) {
        propertyViewData.currentSort.direction = propertyViewData.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        propertyViewData.currentSort.field = field;
        propertyViewData.currentSort.direction = 'desc';
    }

    renderAllReservationsTable(propertyViewData.filteredReservations);
}

// Filter table
function filterPropertyReservations() {
    const searchTerm = document.getElementById('propertyReservationsSearch').value.toLowerCase();

    if (!searchTerm) {
        propertyViewData.filteredReservations = propertyViewData.reservations;
    } else {
        propertyViewData.filteredReservations = propertyViewData.reservations.filter(r =>
            (r.booking_id || '').toLowerCase().includes(searchTerm) ||
            (r.guest_name || '').toLowerCase().includes(searchTerm) ||
            (r.guest_email || '').toLowerCase().includes(searchTerm) ||
            (r.guest_phone || '').toLowerCase().includes(searchTerm)
        );
    }

    propertyViewData.currentPage = 1;
    renderAllReservationsTable(propertyViewData.filteredReservations);
}

// Helper: Get payment status badge
function getPaymentStatusBadge(status) {
    const badges = {
        'paid': '<span class="badge" style="background: var(--success);">Paid</span>',
        'pending': '<span class="badge" style="background: var(--warning);">Pending</span>',
        'partial': '<span class="badge" style="background: var(--warning);">Partial</span>',
        'unpaid': '<span class="badge" style="background: var(--danger);">Unpaid</span>'
    };
    return badges[status] || '<span class="badge" style="background: var(--secondary);">Unknown</span>';
}

// Helper: Get booking status badge
function getBookingStatusBadge(status) {
    const badges = {
        'confirmed': '<span class="badge" style="background: var(--success);">Confirmed</span>',
        'checked_in': '<span class="badge" style="background: var(--primary);">Checked In</span>',
        'completed': '<span class="badge" style="background: var(--secondary);">Completed</span>',
        'cancelled': '<span class="badge" style="background: var(--danger);">Cancelled</span>',
        'pending': '<span class="badge" style="background: var(--warning);">Pending</span>'
    };
    return badges[status] || '<span class="badge" style="background: var(--secondary);">Unknown</span>';
}

// Helper: Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// View reservation details (placeholder - can integrate with existing modal)
function viewReservationDetails(bookingId) {
    showToast('View Reservation', `Opening details for ${bookingId}`, '👁️');
    // TODO: Open existing reservation modal or navigate to reservations view
}

// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 3: Month-over-Month Comparison
// ============================================================================

// Render Month-over-Month Comparison Table
function renderMoMComparison(reservations, propertyId) {
    const container = document.getElementById('propertyMoMComparison');

    // Group reservations by month
    const monthlyData = groupReservationsByMonth(reservations);

    // Get last 6 months of data
    const months = Object.keys(monthlyData).sort().reverse().slice(0, 6);

    if (months.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No data available for month-over-month comparison
            </div>
        `;
        return;
    }

    // Calculate metrics for each month
    const monthlyMetrics = months.map(month => {
        const data = monthlyData[month];
        const activeRes = data.filter(r => r.status !== 'cancelled');

        const revenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const paid = activeRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
        const bookings = activeRes.length;
        const nights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);

        // Calculate occupancy (assuming 30 days per month)
        const daysInMonth = 30;
        const occupancy = (nights / daysInMonth) * 100;

        // Calculate ADR
        const adr = nights > 0 ? revenue / nights : 0;

        // Calculate collection rate
        const collectionRate = revenue > 0 ? (paid / revenue) * 100 : 0;

        return {
            month,
            revenue,
            paid,
            bookings,
            nights,
            occupancy,
            adr,
            collectionRate
        };
    });

    // Render comparison table
    container.innerHTML = `
        <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Revenue</th>
                    <th>Change</th>
                    <th>Bookings</th>
                    <th>Change</th>
                    <th>Nights</th>
                    <th>Occupancy</th>
                    <th>ADR</th>
                    <th>Collection %</th>
                </tr>
            </thead>
            <tbody>
                ${monthlyMetrics.map((m, idx) => {
                    const prevMonth = monthlyMetrics[idx + 1];

                    // Calculate changes from previous month
                    const revenueChange = prevMonth ? calculateMoMChange(m.revenue, prevMonth.revenue) : 0;
                    const bookingsChange = prevMonth ? calculateMoMChange(m.bookings, prevMonth.bookings) : 0;

                    return `
                        <tr>
                            <td><strong>${formatMonthName(m.month)}</strong></td>
                            <td><strong>${formatCurrency(m.revenue)}</strong></td>
                            <td>${prevMonth ? formatMoMChangeCompact(revenueChange) : '-'}</td>
                            <td>${m.bookings}</td>
                            <td>${prevMonth ? formatMoMChangeCompact(bookingsChange) : '-'}</td>
                            <td>${m.nights}</td>
                            <td>${formatPercentage(m.occupancy)}</td>
                            <td>${formatCurrency(m.adr)}</td>
                            <td>${formatPercentage(m.collectionRate)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    `;
}

// Group reservations by month (YYYY-MM format)
function groupReservationsByMonth(reservations) {
    const grouped = {};

    reservations.forEach(r => {
        const checkIn = new Date(r.check_in);
        const monthKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, '0')}`;

        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }
        grouped[monthKey].push(r);
    });

    return grouped;
}

// Format month name from YYYY-MM
function formatMonthName(monthKey) {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
}

// Compact MoM change format (for table cells)
function formatMoMChange(change) {
    if (change === null || change === undefined || isNaN(change)) return '';
    const n = parseFloat(change);
    const arrow = n > 0 ? '↑' : n < 0 ? '↓' : '→';
    const color = n > 0 ? 'var(--success)' : n < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    const label = n === 0 ? 'no change' : 'vs prev. period';
    return `<span style="color: ${color};">${arrow} ${Math.abs(n).toFixed(1)}% ${label}</span>`;
}

function formatMoMChangeCompact(change) {
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    return `<span style="color: ${color}; font-size: 12px;">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
}
// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 4: Payment Breakdown
// ============================================================================

// Render Payment Collection Breakdown

function renderPaymentBreakdown(reservations, payments) {
    const container = document.getElementById('propertyPaymentBreakdown');

    // Filter active reservations
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    if (activeRes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No payment data available
            </div>
        `;
        return;
    }

    // Calculate totals
    const totalAmount = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const paidAmount = activeRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
    const pendingAmount = totalAmount - paidAmount;

    // Calculate percentages
    const paidPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
    const pendingPercent = totalAmount > 0 ? (pendingAmount / totalAmount) * 100 : 0;

    // Group by payment status
    const paymentStatusGroups = {
        paid: activeRes.filter(r => r.payment_status === 'paid'),
        partial: activeRes.filter(r => r.payment_status === 'partial'),
        pending: activeRes.filter(r => r.payment_status === 'pending'),
        unpaid: activeRes.filter(r => r.payment_status === 'unpaid')
    };

    // Calculate amounts for each status
    const statusBreakdown = {
        paid: {
            count: paymentStatusGroups.paid.length,
            amount: paymentStatusGroups.paid.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        },
        partial: {
            count: paymentStatusGroups.partial.length,
            amount: paymentStatusGroups.partial.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        },
        pending: {
            count: paymentStatusGroups.pending.length,
            amount: paymentStatusGroups.pending.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        },
        unpaid: {
            count: paymentStatusGroups.unpaid.length,
            amount: paymentStatusGroups.unpaid.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
        }
    };

    // Render breakdown
    container.innerHTML = `
        <!-- Overall Collection Summary -->
        <div style="background: var(--card-bg); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">Overall Collection</h4>

            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: var(--text-secondary);">Total Amount:</span>
                <strong style="color: var(--text-primary);">${formatCurrency(totalAmount)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span style="color: var(--text-secondary);">Paid Amount:</span>
                <strong style="color: var(--success);">${formatCurrency(paidAmount)} (${paidPercent.toFixed(1)}%)</strong>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <span style="color: var(--text-secondary);">Pending Amount:</span>
                <strong style="color: var(--danger);">${formatCurrency(pendingAmount)} (${pendingPercent.toFixed(1)}%)</strong>
            </div>

            <!-- Visual Progress Bar -->
            <div style="width: 100%; height: 30px; background: var(--bg-secondary); border-radius: 8px; overflow: hidden; display: flex;">
                <div style="width: ${paidPercent}%; background: var(--success); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                    ${paidPercent > 10 ? `${paidPercent.toFixed(0)}%` : ''}
                </div>
                <div style="width: ${pendingPercent}%; background: var(--danger); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">
                    ${pendingPercent > 10 ? `${pendingPercent.toFixed(0)}%` : ''}
                </div>
            </div>
        </div>

        <!-- Payment Status Breakdown -->
        <div style="background: var(--card-bg); border-radius: 8px; padding: 20px;">
            <h4 style="margin: 0 0 15px 0; color: var(--text-primary);">Payment Status Breakdown</h4>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Bookings</th>
                        <th>Total Amount</th>
                        <th>% of Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><span class="badge" style="background: var(--success);">Paid</span></td>
                        <td>${statusBreakdown.paid.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.paid.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.paid.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                    <tr>
                        <td><span class="badge" style="background: var(--warning);">Partial</span></td>
                        <td>${statusBreakdown.partial.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.partial.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.partial.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                    <tr>
                        <td><span class="badge" style="background: var(--warning);">Pending</span></td>
                        <td>${statusBreakdown.pending.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.pending.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.pending.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                    <tr>
                        <td><span class="badge" style="background: var(--danger);">Unpaid</span></td>
                        <td>${statusBreakdown.unpaid.count}</td>
                        <td><strong>${formatCurrency(statusBreakdown.unpaid.amount)}</strong></td>
                        <td>${totalAmount > 0 ? ((statusBreakdown.unpaid.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}
// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 5: Performance Metrics Grid
// ============================================================================

// Render Property Performance Metrics

function renderPropertyPerformanceMetrics(reservations) {
    const container = document.getElementById('propertyPerformanceMetrics');

    // Filter active reservations
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    if (activeRes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No performance data available
            </div>
        `;
        return;
    }

    // Calculate metrics
    const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalBookings = activeRes.length;
    const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);

    // Average Booking Value (ABV)
    const abv = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Average Daily Rate (ADR)
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

    // Revenue Per Available Night (RevPAN) - assuming 365 nights available per year
    const availableNights = 365;
    const revPAN = totalRevenue / availableNights;

    // Average Length of Stay (ALOS)
    const alos = totalBookings > 0 ? totalNights / totalBookings : 0;

    // Average Lead Time (days between booking creation and check-in)
    let totalLeadTime = 0;
    let leadTimeCount = 0;
    activeRes.forEach(r => {
        if (r.created_at && r.check_in) {
            const created = new Date(r.created_at);
            const checkIn = new Date(r.check_in);
            const leadDays = Math.ceil((checkIn - created) / (1000 * 60 * 60 * 24));
            if (leadDays >= 0) {
                totalLeadTime += leadDays;
                leadTimeCount++;
            }
        }
    });
    const avgLeadTime = leadTimeCount > 0 ? totalLeadTime / leadTimeCount : 0;

    // Cancellation Rate
    const totalReservations = reservations.length;
    const cancelledCount = reservations.filter(r => r.status === 'cancelled').length;
    const cancellationRate = totalReservations > 0 ? (cancelledCount / totalReservations) * 100 : 0;

    // Repeat Guest Rate (guests who booked more than once)
    const guestBookings = {};
    activeRes.forEach(r => {
        const email = r.guest_email || r.guest_name;
        if (email) {
            guestBookings[email] = (guestBookings[email] || 0) + 1;
        }
    });
    const repeatGuests = Object.values(guestBookings).filter(count => count > 1).length;
    const totalGuests = Object.keys(guestBookings).length;
    const repeatGuestRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0;

    // Render metrics grid
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <!-- ABV Card -->
            <div class="stat-card">
                <div class="stat-value">${formatCurrency(abv)}</div>
                <div class="stat-label">Avg Booking Value</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    Total revenue ÷ bookings
                </div>
            </div>

            <!-- ADR Card -->
            <div class="stat-card">
                <div class="stat-value">${formatCurrency(adr)}</div>
                <div class="stat-label">Avg Daily Rate (ADR)</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    Revenue per night booked
                </div>
            </div>

            <!-- RevPAN Card -->
            <div class="stat-card">
                <div class="stat-value">${formatCurrency(revPAN)}</div>
                <div class="stat-label">RevPAN</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    Revenue per available night
                </div>
            </div>

            <!-- ALOS Card -->
            <div class="stat-card">
                <div class="stat-value">${alos.toFixed(1)} nights</div>
                <div class="stat-label">Avg Length of Stay</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    Average nights per booking
                </div>
            </div>

            <!-- Lead Time Card -->
            <div class="stat-card">
                <div class="stat-value">${avgLeadTime.toFixed(0)} days</div>
                <div class="stat-label">Avg Lead Time</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    Booking to check-in period
                </div>
            </div>

            <!-- Cancellation Rate Card -->
            <div class="stat-card">
                <div class="stat-value" style="color: ${cancellationRate > 15 ? 'var(--danger)' : 'var(--success)'};">
                    ${formatPercentage(cancellationRate)}
                </div>
                <div class="stat-label">Cancellation Rate</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    ${cancelledCount} of ${totalReservations} cancelled
                </div>
            </div>

            <!-- Repeat Guest Rate Card -->
            <div class="stat-card">
                <div class="stat-value" style="color: ${repeatGuestRate > 20 ? 'var(--success)' : 'var(--warning)'};">
                    ${formatPercentage(repeatGuestRate)}
                </div>
                <div class="stat-label">Repeat Guest Rate</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    ${repeatGuests} of ${totalGuests} guests
                </div>
            </div>

            <!-- Total Nights Card -->
            <div class="stat-card">
                <div class="stat-value">${totalNights}</div>
                <div class="stat-label">Total Nights Booked</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    Across all reservations
                </div>
            </div>
        </div>
    `;
}
// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 6: Chart Rendering
// ============================================================================

// Render all Property Charts

function renderPropertyCharts(reservations, payments) {
    renderRevenueChart(reservations);
    renderBookingSourcesChart(reservations);
    renderPaymentStatusChart(reservations);
    renderBookingTypesChart(reservations);
}

// 1. Revenue Trend Chart (Line Chart)
function renderRevenueChart(reservations) {
    const ctx = document.getElementById('propertyRevenueChart');
    if (!ctx) return;

    // Destroy existing chart
    if (propertyCharts.revenue) {
        propertyCharts.revenue.destroy();
    }

    // Group by month and calculate revenue
    const monthlyData = groupReservationsByMonth(reservations.filter(r => r.status !== 'cancelled'));
    const months = Object.keys(monthlyData).sort().slice(-12); // Last 12 months

    const revenueData = months.map(month => {
        const monthRes = monthlyData[month];
        return monthRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    });

    const paidData = months.map(month => {
        const monthRes = monthlyData[month];
        return monthRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
    });

    propertyCharts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => formatMonthName(m)),
            datasets: [
                {
                    label: 'Total Revenue',
                    data: revenueData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Paid Amount',
                    data: paidData,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Revenue Trend (Last 12 Months)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ₹' + context.parsed.y.toLocaleString('en-IN');
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                }
            }
        }
    });
}

// 2. Booking Sources Chart (Pie Chart)
function renderBookingSourcesChart(reservations) {
    const ctx = document.getElementById('propertySourcesChart');
    if (!ctx) return;

    // Destroy existing chart
    if (propertyCharts.sources) {
        propertyCharts.sources.destroy();
    }

    // Group by booking source
    const activeRes = reservations.filter(r => r.status !== 'cancelled');
    const sourceGroups = {};

    activeRes.forEach(r => {
        const source = r.booking_type || 'Unknown';
        if (!sourceGroups[source]) {
            sourceGroups[source] = { count: 0, revenue: 0 };
        }
        sourceGroups[source].count++;
        sourceGroups[source].revenue += parseFloat(r.total_amount) || 0;
    });

    const sources = Object.keys(sourceGroups);
    const revenues = sources.map(s => sourceGroups[s].revenue);
    const counts = sources.map(s => sourceGroups[s].count);

    // Colors for different sources
    const colors = [
        'rgb(59, 130, 246)',   // Blue
        'rgb(34, 197, 94)',    // Green
        'rgb(234, 179, 8)',    // Yellow
        'rgb(239, 68, 68)',    // Red
        'rgb(168, 85, 247)',   // Purple
        'rgb(236, 72, 153)',   // Pink
        'rgb(14, 165, 233)',   // Sky
        'rgb(249, 115, 22)'    // Orange
    ];

    propertyCharts.sources = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sources.map(s => BOOKING_TYPES[s]?.label || s),
            datasets: [{
                data: revenues,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'Revenue by Booking Source'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const count = counts[context.dataIndex];
                            const total = revenues.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return [
                                label + ': ₹' + value.toLocaleString('en-IN'),
                                count + ' bookings (' + percentage + '%)'
                            ];
                        }
                    }
                }
            }
        }
    });
}

// 3. Payment Status Chart (Bar Chart)
function renderPaymentStatusChart(reservations) {
    const ctx = document.getElementById('propertyPaymentStatusChart');
    if (!ctx) return;

    // Destroy existing chart
    if (propertyCharts.paymentStatus) {
        propertyCharts.paymentStatus.destroy();
    }

    // Group by payment status
    const activeRes = reservations.filter(r => r.status !== 'cancelled');
    const statusGroups = {
        paid: [],
        partial: [],
        pending: [],
        unpaid: []
    };

    activeRes.forEach(r => {
        const status = r.payment_status || 'unpaid';
        if (statusGroups[status]) {
            statusGroups[status].push(r);
        }
    });

    const statuses = Object.keys(statusGroups);
    const counts = statuses.map(s => statusGroups[s].length);
    const amounts = statuses.map(s =>
        statusGroups[s].reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)
    );

    propertyCharts.paymentStatus = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Paid', 'Partial', 'Pending', 'Unpaid'],
            datasets: [{
                label: 'Total Amount (₹)',
                data: amounts,
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',   // Green for Paid
                    'rgba(234, 179, 8, 0.8)',   // Yellow for Partial
                    'rgba(249, 115, 22, 0.8)',  // Orange for Pending
                    'rgba(239, 68, 68, 0.8)'    // Red for Unpaid
                ],
                borderColor: [
                    'rgb(34, 197, 94)',
                    'rgb(234, 179, 8)',
                    'rgb(249, 115, 22)',
                    'rgb(239, 68, 68)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Payment Status Distribution'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const amount = context.parsed.y;
                            const count = counts[idx];
                            return [
                                'Amount: ₹' + amount.toLocaleString('en-IN'),
                                'Bookings: ' + count
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                }
            }
        }
    });
}

// 4. Booking Types Chart (Horizontal Bar Chart)
function renderBookingTypesChart(reservations) {
    const ctx = document.getElementById('propertyBookingTypesChart');
    if (!ctx) return;

    // Destroy existing chart
    if (propertyCharts.bookingTypes) {
        propertyCharts.bookingTypes.destroy();
    }

    // Group by booking type
    const activeRes = reservations.filter(r => r.status !== 'cancelled');
    const typeGroups = {};

    activeRes.forEach(r => {
        const type = r.booking_type || 'Unknown';
        if (!typeGroups[type]) {
            typeGroups[type] = { count: 0, revenue: 0 };
        }
        typeGroups[type].count++;
        typeGroups[type].revenue += parseFloat(r.total_amount) || 0;
    });

    const types = Object.keys(typeGroups);
    const counts = types.map(t => typeGroups[t].count);

    propertyCharts.bookingTypes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: types.map(t => BOOKING_TYPES[t]?.label || t),
            datasets: [{
                label: 'Number of Bookings',
                data: counts,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Bookings by Type'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const type = types[idx];
                            const count = context.parsed.x;
                            const revenue = typeGroups[type].revenue;
                            return [
                                'Bookings: ' + count,
                                'Revenue: ₹' + revenue.toLocaleString('en-IN')
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}
// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 7: Booking Type Breakdown
// ============================================================================


function renderBookingTypeBreakdown(reservations) {
    const container = document.getElementById('propertyBookingTypeBreakdown');

    // Filter active reservations
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    if (activeRes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                No booking type data available
            </div>
        `;
        return;
    }

    // Group by booking type
    const typeGroups = {};
    activeRes.forEach(r => {
        const type = r.booking_type || 'unknown';
        if (!typeGroups[type]) {
            typeGroups[type] = {
                bookings: [],
                totalRevenue: 0,
                totalNights: 0,
                paidAmount: 0
            };
        }
        typeGroups[type].bookings.push(r);
        typeGroups[type].totalRevenue += parseFloat(r.total_amount) || 0;
        typeGroups[type].totalNights += r.nights || 0;
        typeGroups[type].paidAmount += parseFloat(r.paid_amount) || 0;
    });

    // Calculate totals
    const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalBookings = activeRes.length;
    const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);

    // Sort by revenue (descending)
    const sortedTypes = Object.keys(typeGroups).sort((a, b) =>
        typeGroups[b].totalRevenue - typeGroups[a].totalRevenue
    );

    // Render table
    container.innerHTML = `
        <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Bookings</th>
                    <th>% Total</th>
                    <th>Revenue</th>
                    <th>% Rev</th>
                    <th>Nights</th>
                    <th>Avg</th>
                    <th>ADR</th>
                    <th>Collect %</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTypes.map(type => {
                    const group = typeGroups[type];
                    const bookingPercent = (group.bookings.length / totalBookings) * 100;
                    const revenuePercent = (group.totalRevenue / totalRevenue) * 100;
                    const avgNights = group.bookings.length > 0 ? group.totalNights / group.bookings.length : 0;
                    const adr = group.totalNights > 0 ? group.totalRevenue / group.totalNights : 0;
                    const collectionRate = group.totalRevenue > 0 ? (group.paidAmount / group.totalRevenue) * 100 : 0;
                    const typeInfo = BOOKING_TYPES[type] || { label: type, icon: '📋' };

                    return `
                        <tr>
                            <td>
                                <span style="margin-right: 8px;">${typeInfo.icon}</span>
                                <strong>${typeInfo.label}</strong>
                            </td>
                            <td>${group.bookings.length}</td>
                            <td>${bookingPercent.toFixed(1)}%</td>
                            <td><strong>${formatCurrency(group.totalRevenue)}</strong></td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="flex: 1; height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${revenuePercent}%; height: 100%; background: var(--primary);"></div>
                                    </div>
                                    <span style="min-width: 45px; text-align: right;">${revenuePercent.toFixed(1)}%</span>
                                </div>
                            </td>
                            <td>${group.totalNights}</td>
                            <td>${avgNights.toFixed(1)}</td>
                            <td>${formatCurrency(adr)}</td>
                            <td style="color: ${collectionRate >= 80 ? 'var(--success)' : collectionRate >= 50 ? 'var(--warning)' : 'var(--danger)'};">
                                ${formatPercentage(collectionRate)}
                            </td>
                        </tr>
                    `;
                }).join('')}
                <!-- Total Row -->
                <tr style="font-weight: bold; background: var(--bg-secondary);">
                    <td>TOTAL</td>
                    <td>${totalBookings}</td>
                    <td>100%</td>
                    <td>${formatCurrency(totalRevenue)}</td>
                    <td>100%</td>
                    <td>${totalNights}</td>
                    <td>${(totalNights / totalBookings).toFixed(1)}</td>
                    <td>${formatCurrency(totalRevenue / totalNights)}</td>
                    <td>${formatPercentage((activeRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0) / totalRevenue) * 100)}</td>
                </tr>
            </tbody>
        </table>
        </div>
    `;
}
// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 8: Occupancy Heatmap
// ============================================================================

// Render Property Occupancy Heatmap

function renderPropertyOccupancyHeatmap(reservations, dateFilter) {
    const container = document.getElementById('propertyOccupancyHeatmap');

    // Determine date range
    let startDate, endDate;
    if (dateFilter.start && dateFilter.end) {
        startDate = new Date(dateFilter.start);
        endDate = new Date(dateFilter.end);
    } else {
        // Default to last 6 months
        endDate = new Date();
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
    }

    // Build occupancy map (date -> number of nights occupied)
    const occupancyMap = {};
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    activeRes.forEach(r => {
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);

        // Mark each night as occupied
        const currentDate = new Date(checkIn);
        while (currentDate < checkOut) {
            // Format date as YYYY-MM-DD without timezone conversion
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;

            occupancyMap[dateKey] = (occupancyMap[dateKey] || 0) + 1;
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });

    // Generate months to display
    const months = [];
    const currentMonth = new Date(startDate);
    while (currentMonth <= endDate) {
        months.push(new Date(currentMonth));
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Render heatmap
    container.innerHTML = `
        <div style="overflow-x: auto;">
            <div style="display: flex; gap: 20px; min-width: max-content; padding: 10px;">
                ${months.map(month => renderMonthHeatmap(month, occupancyMap)).join('')}
            </div>
        </div>

        <!-- Legend -->
        <div style="display: flex; align-items: center; gap: 15px; margin-top: 20px; padding: 15px; background: var(--card-bg); border-radius: 8px;">
            <span style="color: var(--text-secondary); font-weight: 500;">Occupancy:</span>
            <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 20px; height: 20px; background: #eee; border: 1px solid #ccc; border-radius: 3px;"></div>
                <span style="font-size: 12px; color: var(--text-secondary);">Available</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 20px; height: 20px; background: rgba(34, 197, 94, 0.3); border: 1px solid rgba(34, 197, 94, 0.6); border-radius: 3px;"></div>
                <span style="font-size: 12px; color: var(--text-secondary);">Booked</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 20px; height: 20px; background: rgba(239, 68, 68, 0.3); border: 1px solid rgba(239, 68, 68, 0.6); border-radius: 3px;"></div>
                <span style="font-size: 12px; color: var(--text-secondary);">Double-booked</span>
            </div>
        </div>
    `;
}

// Render single month heatmap
function renderMonthHeatmap(month, occupancyMap) {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const monthName = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Get first and last day of month
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get starting day of week (0 = Sunday, 1 = Monday, etc.)
    const startingDayOfWeek = firstDay.getDay();

    // Build calendar grid
    let calendarHTML = '';

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        calendarHTML += '<div style="width: 30px; height: 30px;"></div>';
    }

    // Add cells for each day of month
    for (let day = 1; day <= daysInMonth; day++) {
        // Format date as YYYY-MM-DD without timezone conversion
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const occupancy = occupancyMap[dateKey] || 0;

        // Determine color based on occupancy
        let bgColor, borderColor;
        if (occupancy === 0) {
            bgColor = '#eee';
            borderColor = '#ccc';
        } else if (occupancy === 1) {
            bgColor = 'rgba(34, 197, 94, 0.3)';
            borderColor = 'rgba(34, 197, 94, 0.6)';
        } else {
            // Double-booked or more
            bgColor = 'rgba(239, 68, 68, 0.3)';
            borderColor = 'rgba(239, 68, 68, 0.6)';
        }

        // Check if today
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const isToday = dateKey === todayKey;

        calendarHTML += `
            <div
                style="
                    width: 30px;
                    height: 30px;
                    background: ${bgColor};
                    border: ${isToday ? '2px solid var(--primary)' : `1px solid ${borderColor}`};
                    border-radius: 3px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: ${isToday ? 'bold' : 'normal'};
                    color: ${occupancy > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'};
                    cursor: pointer;
                "
                title="${dateKey}: ${occupancy > 0 ? occupancy + ' booking(s)' : 'Available'}"
            >
                ${day}
            </div>
        `;
    }

    return `
        <div style="min-width: 240px;">
            <h4 style="margin: 0 0 10px 0; text-align: center; color: var(--text-primary);">${monthName}</h4>

            <!-- Day names -->
            <div style="display: grid; grid-template-columns: repeat(7, 30px); gap: 3px; margin-bottom: 5px;">
                <div style="width: 30px; text-align: center; font-size: 10px; color: var(--text-secondary); font-weight: 600;">S</div>
                <div style="width: 30px; text-align: center; font-size: 10px; color: var(--text-secondary); font-weight: 600;">M</div>
                <div style="width: 30px; text-align: center; font-size: 10px; color: var(--text-secondary); font-weight: 600;">T</div>
                <div style="width: 30px; text-align: center; font-size: 10px; color: var(--text-secondary); font-weight: 600;">W</div>
                <div style="width: 30px; text-align: center; font-size: 10px; color: var(--text-secondary); font-weight: 600;">T</div>
                <div style="width: 30px; text-align: center; font-size: 10px; color: var(--text-secondary); font-weight: 600;">F</div>
                <div style="width: 30px; text-align: center; font-size: 10px; color: var(--text-secondary); font-weight: 600;">S</div>
            </div>

            <!-- Calendar grid -->
            <div style="display: grid; grid-template-columns: repeat(7, 30px); gap: 3px;">
                ${calendarHTML}
            </div>
        </div>
    `;
}
// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 9: Export to Excel
// ============================================================================


function exportPropertyViewToExcel() {
    try {
        const property = propertyViewData.selectedProperty;
        if (!property) {
            showToast('Export Error', 'No property selected', '❌');
            return;
        }

        const reservations = propertyViewData.reservations;
        const activeRes = reservations.filter(r => r.status !== 'cancelled');

        // Calculate summary metrics
        const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const totalPaid = activeRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
        const totalPending = totalRevenue - totalPaid;
        const totalBookings = activeRes.length;
        const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);
        const occupancyRate = (totalNights / 365) * 100;
        const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
        const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

        // Prepare CSV content
        let csv = '';

        // Header
        csv += `Property Performance Report\n`;
        csv += `Property: ${property.name}\n`;
        csv += `Generated: ${new Date().toLocaleString('en-IN')}\n`;
        csv += `\n`;

        // Summary Section
        csv += `SUMMARY METRICS\n`;
        csv += `Metric,Value\n`;
        csv += `Total Revenue,₹${totalRevenue.toLocaleString('en-IN')}\n`;
        csv += `Paid Amount,₹${totalPaid.toLocaleString('en-IN')}\n`;
        csv += `Pending Amount,₹${totalPending.toLocaleString('en-IN')}\n`;
        csv += `Total Bookings,${totalBookings}\n`;
        csv += `Total Nights,${totalNights}\n`;
        csv += `Occupancy Rate,${occupancyRate.toFixed(1)}%\n`;
        csv += `Average Daily Rate,₹${adr.toLocaleString('en-IN')}\n`;
        csv += `Collection Rate,${collectionRate.toFixed(1)}%\n`;
        csv += `\n\n`;

        // Reservations Section
        csv += `ALL RESERVATIONS\n`;
        csv += `Booking ID,Guest Name,Guest Email,Guest Phone,Check-In,Check-Out,Nights,Booking Type,Total Amount,Paid Amount,Pending Amount,Payment Status,Booking Status\n`;

        reservations.forEach(r => {
            const pending = (parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0);
            csv += `${r.booking_id || 'N/A'},`;
            csv += `"${r.guest_name || 'N/A'}",`;
            csv += `${r.guest_email || 'N/A'},`;
            csv += `${r.guest_phone || 'N/A'},`;
            csv += `${r.check_in || 'N/A'},`;
            csv += `${r.check_out || 'N/A'},`;
            csv += `${r.nights || 0},`;
            csv += `${BOOKING_TYPES[r.booking_type]?.label || r.booking_type || 'N/A'},`;
            csv += `₹${(parseFloat(r.total_amount) || 0).toLocaleString('en-IN')},`;
            csv += `₹${(parseFloat(r.paid_amount) || 0).toLocaleString('en-IN')},`;
            csv += `₹${pending.toLocaleString('en-IN')},`;
            csv += `${r.payment_status || 'N/A'},`;
            csv += `${r.status || 'N/A'}\n`;
        });

        csv += `\n\n`;

        // Booking Type Breakdown Section
        csv += `BOOKING TYPE BREAKDOWN\n`;
        csv += `Type,Bookings,% of Total,Total Revenue,% Revenue,Total Nights,Avg Nights,ADR\n`;

        const typeGroups = {};
        activeRes.forEach(r => {
            const type = r.booking_type || 'unknown';
            if (!typeGroups[type]) {
                typeGroups[type] = { bookings: [], totalRevenue: 0, totalNights: 0 };
            }
            typeGroups[type].bookings.push(r);
            typeGroups[type].totalRevenue += parseFloat(r.total_amount) || 0;
            typeGroups[type].totalNights += r.nights || 0;
        });

        Object.keys(typeGroups).forEach(type => {
            const group = typeGroups[type];
            const bookingPercent = (group.bookings.length / totalBookings) * 100;
            const revenuePercent = (group.totalRevenue / totalRevenue) * 100;
            const avgNights = group.bookings.length > 0 ? group.totalNights / group.bookings.length : 0;
            const typeAdr = group.totalNights > 0 ? group.totalRevenue / group.totalNights : 0;
            const typeInfo = BOOKING_TYPES[type] || { label: type };

            csv += `${typeInfo.label},`;
            csv += `${group.bookings.length},`;
            csv += `${bookingPercent.toFixed(1)}%,`;
            csv += `₹${group.totalRevenue.toLocaleString('en-IN')},`;
            csv += `${revenuePercent.toFixed(1)}%,`;
            csv += `${group.totalNights},`;
            csv += `${avgNights.toFixed(1)},`;
            csv += `₹${typeAdr.toLocaleString('en-IN')}\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const fileName = `Property_Report_${property.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Export Successful', `Downloaded ${fileName}`, '📥');

    } catch (error) {
        console.error('Export error:', error);
        showToast('Export Error', 'Failed to export data', '❌');
    }
}

// Print Property View
function printPropertyView() {
    const property = propertyViewData.selectedProperty;
    if (!property) {
        showToast('Print Error', 'No property selected', '❌');
        return;
    }

    // Open print dialog
    window.print();
    showToast('Print', 'Opening print dialog...', '🖨️');
}

        // ========================================
