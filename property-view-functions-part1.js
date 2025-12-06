// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 1: Core Loader & Data Processing
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

// Format currency
function formatCurrency(amount) {
    return '₹' + (amount || 0).toLocaleString('en-IN');
}

// Format percentage
function formatPercentage(value) {
    return value.toFixed(1) + '%';
}

// Format MoM change with arrow
function formatMoMChange(change) {
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    return `<span style="color: ${color}">${arrow} ${Math.abs(change).toFixed(1)}% MoM</span>`;
}
