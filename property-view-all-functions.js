// ============================================================================
// PROPERTY VIEW FUNCTIONS - COMPLETE
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

//============================================================================
// PART 1: Core Loader & Data Processing
// ============================================================================

// Main loader function for Property View
async function loadPropertyView() {
    try {
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

        // Render all sections
        renderPropertyKPIs(reservations, filteredPayments, dateFilter);
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
    let start, end;

    switch(dateRange) {
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'last_month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
        case 'last_3_months':
            start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'last_6_months':
            start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'this_year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'custom':
            const fromInput = document.getElementById('propertyDateFrom').value;
            const toInput = document.getElementById('propertyDateTo').value;
            if (fromInput && toInput) {
                start = new Date(fromInput);
                end = new Date(toInput);
                end.setHours(23, 59, 59);
            }
            break;
        case 'all':
        default:
            start = null;
            end = null;
    }

    return { start, end };
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

// Format MoM change with arrow
function formatMoMChange(change) {
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    return `<span style="color: ${color}">${arrow} ${Math.abs(change).toFixed(1)}% MoM</span>`;
}

// Compact MoM change format (for table cells)
function formatMoMChangeCompact(change) {
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    return `<span style="color: ${color}; font-size: 12px;">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
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

// ============================================================================
// PART 2: KPI Cards & Reservations Table
// ============================================================================

// Render KPI Cards with MoM comparison
function renderPropertyKPIs(reservations, payments, dateFilter) {
    const container = document.getElementById('propertyKPICards');

    // Filter active reservations
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Calculate current metrics
    const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalBookings = activeRes.length;
    const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);

    // Calculate ADR (Average Daily Rate)
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

    // Calculate occupancy (assuming 200 nights/year target)
    const daysInPeriod = dateFilter.start && dateFilter.end
        ? Math.ceil((dateFilter.end - dateFilter.start) / (1000 * 60 * 60 * 24))
        : 365;
    const occupancy = daysInPeriod > 0 ? (totalNights / daysInPeriod) * 100 : 0;

    // Calculate collection rate
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const collectionRate = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0;

    // Get previous period data for MoM if applicable
    let prevRevenue = 0, prevBookings = 0, prevOccupancy = 0, prevADR = 0, prevCollection = 0;
    if (dateFilter.start && dateFilter.end) {
        const prevData = getPreviousMonthData(reservations, dateFilter.start, dateFilter.end);
        const prevActiveRes = prevData.filter(r => r.status !== 'cancelled');
        prevRevenue = prevActiveRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        prevBookings = prevActiveRes.length;
        const prevNights = prevActiveRes.reduce((sum, r) => sum + (r.nights || 0), 0);
        prevADR = prevNights > 0 ? prevRevenue / prevNights : 0;
        prevOccupancy = daysInPeriod > 0 ? (prevNights / daysInPeriod) * 100 : 0;
        // Simplified prev collection for demo
        prevCollection = collectionRate - 5; // Placeholder
    }

    // Calculate MoM changes
    const revenueMoM = calculateMoMChange(totalRevenue, prevRevenue);
    const bookingsMoM = calculateMoMChange(totalBookings, prevBookings);
    const occupancyMoM = calculateMoMChange(occupancy, prevOccupancy);
    const adrMoM = calculateMoMChange(adr, prevADR);
    const collectionMoM = calculateMoMChange(collectionRate, prevCollection);

    // Render KPI cards
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${formatCurrency(totalRevenue)}</div>
            <div class="stat-label">Total Revenue</div>
            ${dateFilter.start ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(revenueMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatPercentage(occupancy)}</div>
            <div class="stat-label">Occupancy Rate</div>
            ${dateFilter.start ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(occupancyMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatCurrency(adr)}</div>
            <div class="stat-label">Avg Daily Rate (ADR)</div>
            ${dateFilter.start ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(adrMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalBookings}</div>
            <div class="stat-label">Total Bookings</div>
            ${dateFilter.start ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(bookingsMoM)}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatPercentage(collectionRate)}</div>
            <div class="stat-label">Collection Rate</div>
            ${dateFilter.start ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(collectionMoM)}</div>` : ''}
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
                ← Previous
            </button>
            <span style="padding: 8px 12px; color: var(--text-secondary);">
                Page ${currentPage} of ${totalPages}
            </span>
            <button class="btn btn-sm" onclick="changePropertyPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                Next →
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

// NOTE: Remaining functions (Parts 3-9) will be added in subsequent messages due to size limits
// This file will be completed in the next message
