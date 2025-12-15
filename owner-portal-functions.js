// =====================================================
// OWNER PORTAL JAVASCRIPT FUNCTIONS
// Enhanced with Analytics, Charts, Payments, and Calendar
// =====================================================

// Global owner data
let ownerData = {
    revenue: null,
    bookings: [],
    payments: [],
    payouts: [],
    properties: [],
    monthlyData: [],
    propertyPerformance: []
};

// Chart instances
let revenueLineChart = null;
let revenuePieChart = null;
let propertyBarChart = null;

// Calendar state
let currentCalendarDate = new Date();
let calendarBookings = [];

// NOTE: showOwnerView is now defined in owner-portal.html
// to support the new home view and sidebar navigation

// =====================================================
// IST TIMEZONE UTILITIES
// =====================================================

// Parse date string as local IST date (prevents timezone shifting)
function parseLocalDate(dateString) {
    if (!dateString) return null;
    const dateOnly = dateString.split('T')[0];
    const parts = dateOnly.split('-');
    if (parts.length !== 3) return null;
    return new Date(
        parseInt(parts[0]),      // year
        parseInt(parts[1]) - 1,  // month (0-indexed)
        parseInt(parts[2])       // day
    );
}

// Format date as IST (Indian Standard Time)
function formatDateIST(date, options = {}) {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
    if (!dateObj) return '';
    const defaultOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...options
    };
    return dateObj.toLocaleDateString('en-IN', defaultOptions);
}

// Get month label from date
function getMonthLabel(year, month) {
    const date = new Date(year, month, 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// =====================================================
// ENHANCED DASHBOARD WITH ANALYTICS
// =====================================================

async function loadOwnerDashboard() {
    try {
        const ownerId = currentUser.id;
        const owner = await db.getOwner(ownerId);
        const propertyIds = owner.property_ids || [];

        if (propertyIds.length === 0) {
            const elements = {
                ownerTotalRevenue: document.getElementById('ownerTotalRevenue'),
                ownerTotalGuests: document.getElementById('ownerTotalGuests'),
                ownerHostizzyShare: document.getElementById('ownerHostizzyShare'),
                ownerNetEarnings: document.getElementById('ownerNetEarnings'),
                ownerPendingPayout: document.getElementById('ownerPendingPayout')
            };

            if (elements.ownerTotalRevenue) elements.ownerTotalRevenue.textContent = '₹0';
            if (elements.ownerTotalGuests) elements.ownerTotalGuests.textContent = '0';
            if (elements.ownerHostizzyShare) elements.ownerHostizzyShare.textContent = '₹0';
            if (elements.ownerNetEarnings) elements.ownerNetEarnings.textContent = '₹0';
            if (elements.ownerPendingPayout) elements.ownerPendingPayout.textContent = '₹0';
            return;
        }

        // Load bookings data
        const { data: bookings, error: bookingsError } = await supabase
            .from('reservations')
            .select('*')
            .in('property_id', propertyIds)
            .order('check_in', { ascending: false });

        if (bookingsError) throw bookingsError;

        ownerData.bookings = bookings || [];

        // Load payments data (needed for Payments view)
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .in('booking_id', (bookings || []).map(b => b.booking_id))
            .order('payment_date', { ascending: false });

        if (paymentsError) console.error('Payments load error:', paymentsError);

        ownerData.payments = payments || [];

        // Get properties
        const { data: properties, error: propertiesError } = await supabase
            .from('properties')
            .select('*')
            .in('id', propertyIds);

        if (propertiesError) throw propertiesError;

        ownerData.properties = properties || [];

        // Calculate metrics from bookings (exclude cancelled)
        const confirmedBookings = ownerData.bookings.filter(b => b.status !== 'cancelled');

        // Calculate total revenue from all bookings
        const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);

        // Calculate total guests
        const totalGuests = confirmedBookings.reduce((sum, b) => {
            const adults = parseInt(b.adults) || 0;
            const children = parseInt(b.children) || 0;
            return sum + adults + children;
        }, 0);

        // Calculate Hostizzy commission
        const totalHostizzyShare = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.hostizzy_revenue) || 0), 0);

        const netEarnings = totalRevenue - totalHostizzyShare;

        // Get pending payout
        const pendingPayout = await db.getOwnerPendingPayout(ownerId);

        // Update cards
        const revenueEl = document.getElementById('ownerTotalRevenue');
        const guestsEl = document.getElementById('ownerTotalGuests');
        const shareEl = document.getElementById('ownerHostizzyShare');
        const earningsEl = document.getElementById('ownerNetEarnings');
        const payoutEl = document.getElementById('ownerPendingPayout');
        const percentEl = document.getElementById('ownerHostizzyPercent');

        if (revenueEl) revenueEl.textContent = '₹' + totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        if (guestsEl) guestsEl.textContent = totalGuests.toLocaleString('en-IN');
        if (shareEl) shareEl.textContent = '₹' + totalHostizzyShare.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        if (earningsEl) earningsEl.textContent = '₹' + netEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        if (payoutEl) payoutEl.textContent = '₹' + pendingPayout.toLocaleString('en-IN', { maximumFractionDigits: 0 });

        // Calculate average commission percentage
        const commissionBase = confirmedBookings.reduce((sum, b) => {
            const stayAmount = parseFloat(b.stay_amount) || 0;
            const extraGuests = parseFloat(b.extra_guest_charges) || 0;
            return sum + stayAmount + extraGuests;
        }, 0);
        const avgCommission = commissionBase > 0 ? ((totalHostizzyShare / commissionBase) * 100).toFixed(1) : 0;
        if (percentEl) percentEl.textContent = `${avgCommission}% average`;

        // Load monthly breakdown (REVENUE-based, not payment-based)
        loadMonthlyBreakdown();

        // Load charts (REVENUE-based)
        loadRevenueCharts();

        // Load recent bookings
        const recentBookings = ownerData.bookings.slice(0, 10);
        renderOwnerRecentBookings(recentBookings);

    } catch (error) {
        showToast('Error', 'Failed to load dashboard data: ' + error.message, '❌');
    }
}

// Load Monthly Breakdown (REVENUE-based from bookings, not payments)
function loadMonthlyBreakdown() {
    const monthlyData = {};

    // Group by check-in month to show REVENUE (not payment collections)
    const confirmedBookings = ownerData.bookings.filter(b => b.status !== 'cancelled');

    confirmedBookings.forEach(booking => {
        const date = new Date(booking.check_in);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                month: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
                stayRevenue: 0,
                mealRevenue: 0,
                revenue: 0,
                hostizzyCommission: 0,
                earnings: 0,
                bookings: []
            };
        }

        const totalRevenue = parseFloat(booking.total_amount) || 0;
        const stayAmount = parseFloat(booking.stay_amount) || 0;
        const mealAmount = parseFloat(booking.meals_chef) || parseFloat(booking.meal_amount) || 0;
        const hostizzyCommission = parseFloat(booking.hostizzy_revenue) || 0;
        const ownerEarnings = totalRevenue - hostizzyCommission;

        monthlyData[monthKey].stayRevenue += stayAmount;
        monthlyData[monthKey].mealRevenue += mealAmount;
        monthlyData[monthKey].revenue += totalRevenue;
        monthlyData[monthKey].hostizzyCommission += hostizzyCommission;
        monthlyData[monthKey].earnings += ownerEarnings;
        monthlyData[monthKey].bookings.push(booking);
    });

    // Convert to array and sort by month (descending)
    ownerData.allMonthlyData = Object.keys(monthlyData)
        .sort((a, b) => b.localeCompare(a))
        .map(key => ({ ...monthlyData[key], monthKey: key }));

    // Populate dropdown with individual months
    populateMonthlyDropdown();

    // Initial render - show ALL months (not just 6)
    filterMonthlyBreakdown();
}

// Render Monthly Breakdown (Stay, Meal, Revenue, Earning, Commission)
function renderMonthlyBreakdown() {
    const container = document.getElementById('monthlyBreakdown');

    if (ownerData.monthlyData.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No booking data available</p>';
        return;
    }

    let html = '';
    ownerData.monthlyData.forEach(month => {
        html += `
            <div style="border-bottom: 1px solid var(--border); padding: 16px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">${month.month}</h4>
                    <span style="color: var(--success); font-weight: 700; font-size: 18px;">₹${month.earnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 8px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Stay Revenue</div>
                        <div style="font-weight: 600; color: var(--primary);">₹${month.stayRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Meal Revenue</div>
                        <div style="font-weight: 600; color: var(--primary);">₹${month.mealRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Total Revenue</div>
                        <div style="font-weight: 600;">₹${month.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Hostizzy Commission</div>
                        <div style="font-weight: 600; color: var(--warning);">₹${month.hostizzyCommission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Your Earnings</div>
                        <div style="font-weight: 600; color: var(--success);">₹${month.earnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Bookings</div>
                        <div style="font-weight: 600;">${month.bookings.length}</div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Populate Monthly Breakdown Dropdown
function populateMonthlyDropdown() {
    const dropdown = document.getElementById('monthlyBreakdownFilter');
    if (!dropdown || !ownerData.allMonthlyData) return;

    // Remove existing month options (keep preset options)
    const options = dropdown.querySelectorAll('option');
    options.forEach(opt => {
        if (opt.value && !['last6', 'last12', 'all'].includes(opt.value)) {
            opt.remove();
        }
    });

    // Add individual month options
    ownerData.allMonthlyData.forEach(monthData => {
        const option = document.createElement('option');
        option.value = monthData.monthKey;
        option.textContent = monthData.month;
        dropdown.appendChild(option);
    });
}

// Filter Monthly Breakdown based on dropdown selection
function filterMonthlyBreakdown() {
    const filterValue = document.getElementById('monthlyBreakdownFilter')?.value || 'all';

    if (!ownerData.allMonthlyData) {
        ownerData.monthlyData = [];
        renderMonthlyBreakdown();
        return;
    }

    let filteredData = [];

    if (filterValue === 'all') {
        // Show all months
        filteredData = ownerData.allMonthlyData;
    } else if (filterValue === 'last6') {
        // Show last 6 months
        filteredData = ownerData.allMonthlyData.slice(0, 6);
    } else if (filterValue === 'last12') {
        // Show last 12 months
        filteredData = ownerData.allMonthlyData.slice(0, 12);
    } else {
        // Show specific month
        filteredData = ownerData.allMonthlyData.filter(m => m.monthKey === filterValue);
    }

    ownerData.monthlyData = filteredData;
    renderMonthlyBreakdown();
}

// Load Revenue Charts (REVENUE-based, not payment-based)
function loadRevenueCharts() {
    // Monthly Revenue Trend - LINE CHART (Revenue + Earnings for ALL months)
    const lineCtx = document.getElementById('revenueLineChart');
    if (lineCtx) {
        if (revenueLineChart) revenueLineChart.destroy();

        // Use ALL monthly data, not filtered
        const months = ownerData.allMonthlyData.slice().reverse().map(m => m.month.split(' ')[0]);
        const revenueData = ownerData.allMonthlyData.slice().reverse().map(m => m.revenue);
        const earningsData = ownerData.allMonthlyData.slice().reverse().map(m => m.earnings);

        revenueLineChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Total Revenue',
                        data: revenueData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Your Earnings',
                        data: earningsData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    }

    // Revenue Split - PIE CHART (Owner vs Hostizzy)
    const pieCtx = document.getElementById('revenuePieChart');
    if (pieCtx) {
        if (revenuePieChart) revenuePieChart.destroy();

        const confirmedBookings = ownerData.bookings.filter(b => b.status !== 'cancelled');
        const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
        const totalHostizzyShare = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.hostizzy_revenue) || 0), 0);
        const ownerEarnings = totalRevenue - totalHostizzyShare;

        revenuePieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Your Earnings', 'Hostizzy Commission'],
                datasets: [{
                    data: [ownerEarnings, totalHostizzyShare],
                    backgroundColor: ['#8b5cf6', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const percentage = ((value / totalRevenue) * 100).toFixed(1);
                                return `${label}: ₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Property Performance Bar Chart (Nights + Revenue per property for ALL months)
    const barCtx = document.getElementById('propertyBarChart');
    if (barCtx) {
        if (propertyBarChart) propertyBarChart.destroy();

        const propertyPerformance = {};
        const confirmedBookings = ownerData.bookings.filter(b => b.status !== 'cancelled');

        confirmedBookings.forEach(booking => {
            const propertyName = booking.property_name;
            if (!propertyPerformance[propertyName]) {
                propertyPerformance[propertyName] = {
                    revenue: 0,
                    nights: 0,
                    bookings: 0
                };
            }
            const revenue = parseFloat(booking.total_amount) || 0;
            const nights = parseInt(booking.nights) || 0;
            propertyPerformance[propertyName].revenue += revenue;
            propertyPerformance[propertyName].nights += nights;
            propertyPerformance[propertyName].bookings += 1;
        });

        const propertyNames = Object.keys(propertyPerformance);
        const revenueData = propertyNames.map(name => propertyPerformance[name].revenue);
        const nightsData = propertyNames.map(name => propertyPerformance[name].nights);

        propertyBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: propertyNames,
                datasets: [
                    {
                        label: 'Total Revenue (₹)',
                        data: revenueData,
                        backgroundColor: '#10b981',
                        yAxisID: 'y'
                    },
                    {
                        label: 'Total Nights',
                        data: nightsData,
                        backgroundColor: '#3b82f6',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        },
                        title: {
                            display: true,
                            text: 'Revenue (₹)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        grid: {
                            drawOnChartArea: false
                        },
                        title: {
                            display: true,
                            text: 'Nights'
                        }
                    }
                }
            }
        });
    }
}

// =====================================================
// PAYMENTS VIEW
// =====================================================

async function loadOwnerPayments() {
    try {
        const ownerId = currentUser.id;
        const owner = await db.getOwner(ownerId);
        const propertyIds = owner.property_ids || [];

        if (propertyIds.length === 0) {
            document.getElementById('ownerPaymentsList').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No properties linked to your account</p>';
            return;
        }

        // Populate property filter
        const propertyFilter = document.getElementById('paymentPropertyFilter');
        if (propertyFilter.options.length === 1) {
            ownerData.properties.forEach(property => {
                const option = document.createElement('option');
                option.value = property.id;
                option.textContent = property.name;
                propertyFilter.appendChild(option);
            });
        }

        // Populate month filter (last 12 months)
        const monthFilter = document.getElementById('paymentMonthFilter');
        if (monthFilter.options.length === 1) {
            for (let i = 0; i < 12; i++) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                const option = document.createElement('option');
                option.value = monthKey;
                option.textContent = monthLabel;
                monthFilter.appendChild(option);
            }
        }

        // Filter payments
        let filteredPayments = ownerData.payments;

        const selectedMonth = monthFilter.value;
        const selectedProperty = propertyFilter.value;
        const selectedPayoutStatus = document.getElementById('paymentPayoutFilter').value;

        if (selectedMonth) {
            filteredPayments = filteredPayments.filter(p => {
                const date = new Date(p.payment_date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === selectedMonth;
            });
        }

        if (selectedProperty) {
            filteredPayments = filteredPayments.filter(p => {
                const booking = ownerData.bookings.find(b => b.booking_id === p.booking_id);
                return booking && booking.property_id == selectedProperty;
            });
        }

        // Calculate summary
        const totalPayments = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const paymentsToOwner = filteredPayments
            .filter(p => p.payment_recipient && p.payment_recipient.toLowerCase().includes('owner'))
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const paymentsToHostizzy = filteredPayments
            .filter(p => p.payment_recipient && p.payment_recipient.toLowerCase().includes('hostizzy'))
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        document.getElementById('paymentsTotal').textContent = '₹' + totalPayments.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        document.getElementById('paymentsToOwner').textContent = '₹' + paymentsToOwner.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        document.getElementById('paymentsToHostizzy').textContent = '₹' + paymentsToHostizzy.toLocaleString('en-IN', { maximumFractionDigits: 0 });

        renderOwnerPaymentsList(filteredPayments);

    } catch (error) {
        showToast('Error', 'Failed to load payments: ' + error.message, '❌');
    }
}

function renderOwnerPaymentsList(payments) {
    const container = document.getElementById('ownerPaymentsList');

    if (payments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No payments found</p>';
        return;
    }

    // Check if mobile
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Mobile card layout
        let html = '<div class="mobile-card-list">';
        payments.forEach(payment => {
            const booking = ownerData.bookings.find(b => b.booking_id === payment.booking_id);
            const propertyName = booking ? booking.property_name : 'Unknown';

            html += `
                <div class="booking-mobile-card">
                    <div class="booking-mobile-card-header">
                        <div>
                            <strong style="font-size: 16px;">${payment.booking_id}</strong>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${propertyName}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: var(--success);">₹${parseFloat(payment.amount).toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                    <div class="booking-mobile-card-body">
                        <div class="booking-mobile-row">
                            <span class="booking-mobile-label">Payment Date</span>
                            <span class="booking-mobile-value">${new Date(payment.payment_date).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div class="booking-mobile-row">
                            <span class="booking-mobile-label">Method</span>
                            <span class="booking-mobile-value">${payment.payment_method || 'N/A'}</span>
                        </div>
                        <div class="booking-mobile-row">
                            <span class="booking-mobile-label">Recipient</span>
                            <span class="booking-mobile-value">${payment.payment_recipient || 'N/A'}</span>
                        </div>
                        ${payment.reference_number ? `
                        <div class="booking-mobile-row">
                            <span class="booking-mobile-label">Reference</span>
                            <span class="booking-mobile-value">${payment.reference_number}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } else {
        // Desktop table layout
        let html = '<div class="table-container"><table class="data-table"><thead><tr>';
        html += '<th>Payment Date</th>';
        html += '<th>Booking ID</th>';
        html += '<th>Property</th>';
        html += '<th>Amount</th>';
        html += '<th>Method</th>';
        html += '<th>Recipient</th>';
        html += '<th>Reference</th>';
        html += '</tr></thead><tbody>';

        payments.forEach(payment => {
            const booking = ownerData.bookings.find(b => b.booking_id === payment.booking_id);
            const propertyName = booking ? booking.property_name : 'Unknown';

            html += '<tr>';
            html += `<td>${new Date(payment.payment_date).toLocaleDateString('en-IN')}</td>`;
            html += `<td><strong>${payment.booking_id}</strong></td>`;
            html += `<td>${propertyName}</td>`;
            html += `<td><strong style="color: var(--success);">₹${parseFloat(payment.amount).toLocaleString('en-IN')}</strong></td>`;
            html += `<td>${payment.payment_method || 'N/A'}</td>`;
            html += `<td>${payment.payment_recipient || 'N/A'}</td>`;
            html += `<td>${payment.reference_number || '-'}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }
}

// =====================================================
// CALENDAR VIEW
// =====================================================

async function loadOwnerCalendar() {
    try {
        const ownerId = currentUser.id;
        const owner = await db.getOwner(ownerId);
        const propertyIds = owner.property_ids || [];

        if (propertyIds.length === 0) {
            document.getElementById('ownerCalendarGrid').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No properties linked to your account</p>';
            return;
        }

        // Populate property filter
        const calendarPropertyFilter = document.getElementById('calendarPropertyFilter');
        if (calendarPropertyFilter.options.length === 1) {
            ownerData.properties.forEach(property => {
                const option = document.createElement('option');
                option.value = property.id;
                option.textContent = property.name;
                calendarPropertyFilter.appendChild(option);
            });
        }

        // Get bookings for current month
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        let query = supabase
            .from('reservations')
            .select('*')
            .in('property_id', propertyIds)
            .or(`check_in.gte.${firstDay.toISOString().split('T')[0]},check_out.gte.${firstDay.toISOString().split('T')[0]}`)
            .lte('check_in', lastDay.toISOString().split('T')[0]);

        const selectedProperty = calendarPropertyFilter.value;
        if (selectedProperty) {
            query = query.eq('property_id', selectedProperty);
        }

        const { data: bookings, error } = await query;
        if (error) throw error;

        calendarBookings = bookings || [];

        // Get blocked dates from synced_availability
        const { data: blockedDates, error: blockedError } = await supabase
            .from('synced_availability')
            .select('*')
            .in('property_id', selectedProperty ? [selectedProperty] : propertyIds)
            .gte('blocked_date', firstDay.toISOString().split('T')[0])
            .lte('blocked_date', lastDay.toISOString().split('T')[0]);

        if (blockedError) throw blockedError;

        renderCalendar(calendarBookings, blockedDates || []);

    } catch (error) {
        showToast('Error', 'Failed to load calendar: ' + error.message, '❌');
    }
}

function renderCalendar(bookings, blockedDates) {
    const container = document.getElementById('ownerCalendarGrid');
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Update month display
    document.getElementById('currentCalendarMonth').textContent =
        currentCalendarDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    let html = '<div class="calendar-grid">';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dateString = currentDate.toISOString().split('T')[0];

        // Check if date is booked
        const booking = bookings.find(b => {
            const checkIn = new Date(b.check_in);
            const checkOut = new Date(b.check_out);
            return currentDate >= checkIn && currentDate < checkOut;
        });

        // Check if date is blocked
        const isBlocked = blockedDates.some(bd => bd.blocked_date === dateString);

        let dayClass = 'calendar-day available';
        let dayLabel = 'Available';

        if (booking) {
            dayClass = 'calendar-day booked';
            dayLabel = booking.guest_name;
        } else if (isBlocked) {
            dayClass = 'calendar-day blocked';
            dayLabel = 'Blocked';
        }

        html += `
            <div class="${dayClass}" onclick="showCalendarDayDetails('${dateString}', ${booking ? `'${booking.booking_id}'` : 'null'})">
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-day-label">${dayLabel}</div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function showCalendarDayDetails(dateString, bookingId) {
    if (!bookingId) {
        document.getElementById('calendarBookingDetails').classList.add('hidden');
        return;
    }

    const booking = calendarBookings.find(b => b.booking_id === bookingId);
    if (!booking) return;

    const detailsContainer = document.getElementById('calendarBookingDetailsContent');
    detailsContainer.innerHTML = `
        <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Booking ID</span>
                <strong>${booking.booking_id}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Guest Name</span>
                <strong>${booking.guest_name}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Property</span>
                <strong>${booking.property_name}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Check-in</span>
                <strong>${new Date(booking.check_in).toLocaleDateString('en-IN')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Check-out</span>
                <strong>${new Date(booking.check_out).toLocaleDateString('en-IN')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Guests</span>
                <strong>${booking.adults} adults${booking.kids ? `, ${booking.kids} kids` : ''}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Total Amount</span>
                <strong style="color: var(--success);">₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-secondary);">Status</span>
                <span class="badge" style="background: ${booking.status === 'confirmed' ? 'blue' : booking.status === 'completed' ? 'green' : 'orange'};">${booking.status}</span>
            </div>
        </div>
    `;

    document.getElementById('calendarBookingDetails').classList.remove('hidden');
}

function changeCalendarMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    loadOwnerCalendar();
}

// =====================================================
// EXISTING FUNCTIONS (UPDATED)
// =====================================================

// Render Recent Bookings (with mobile support)
function renderOwnerRecentBookings(bookings) {
    const container = document.getElementById('ownerRecentBookings');

    if (bookings.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No bookings yet</p>';
        return;
    }

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // Mobile card layout
        let html = '<div class="mobile-card-list">';
        bookings.slice(0, 5).forEach(booking => {
            html += `
                <div class="booking-mobile-card">
                    <div class="booking-mobile-card-header">
                        <div>
                            <strong>${booking.booking_id}</strong>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${booking.property_name}</div>
                        </div>
                        <span class="badge" style="background: ${booking.status === 'confirmed' ? 'blue' : booking.status === 'completed' ? 'green' : 'orange'};">${booking.status}</span>
                    </div>
                    <div class="booking-mobile-card-body">
                        <div class="booking-mobile-row">
                            <span class="booking-mobile-label">Guest</span>
                            <span class="booking-mobile-value">${booking.guest_name}</span>
                        </div>
                        <div class="booking-mobile-row">
                            <span class="booking-mobile-label">Check-in</span>
                            <span class="booking-mobile-value">${new Date(booking.check_in).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div class="booking-mobile-row">
                            <span class="booking-mobile-label">Amount</span>
                            <span class="booking-mobile-value" style="color: var(--success);">₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } else {
        // Desktop table layout
        let html = '<div class="table-container"><table class="data-table"><thead><tr>';
        html += '<th>Booking ID</th>';
        html += '<th>Guest</th>';
        html += '<th>Property</th>';
        html += '<th>Check In</th>';
        html += '<th>Nights</th>';
        html += '<th>Amount</th>';
        html += '<th>Status</th>';
        html += '</tr></thead><tbody>';

        bookings.forEach(booking => {
            const statusColors = {
                'pending': 'orange',
                'confirmed': 'blue',
                'checked_in': 'purple',
                'completed': 'green',
                'cancelled': 'red'
            };

            html += '<tr>';
            html += `<td><strong>${booking.booking_id}</strong></td>`;
            html += `<td>${booking.guest_name}</td>`;
            html += `<td>${booking.property_name}</td>`;
            html += `<td>${new Date(booking.check_in).toLocaleDateString('en-IN')}</td>`;
            html += `<td>${booking.nights}</td>`;
            html += `<td><strong>₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}</strong></td>`;
            html += `<td><span class="badge" style="background: ${statusColors[booking.status]};">${booking.status}</span></td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }
}

// Load Owner Bookings (with mobile support)
// Store filtered bookings for export or other operations
let filteredOwnerBookings = [];

async function loadOwnerBookings() {
    try {
        const ownerId = currentUser.id;
        ownerData.bookings = await db.getOwnerBookings(ownerId);

        const container = document.getElementById('ownerBookingsList');

        if (ownerData.bookings.length === 0) {
            container.innerHTML = '<div class="card"><p style="color: var(--text-secondary); text-align: center; padding: 40px;">No bookings found</p></div>';
            updateBookingsSummary([]);
            return;
        }

        // Populate property filter
        const propertyFilter = document.getElementById('bookingsPropertyFilter');
        if (propertyFilter) {
            const uniqueProperties = [...new Set(ownerData.bookings.map(b => b.property_name))].sort();
            propertyFilter.innerHTML = '<option value="">All Properties</option>' +
                uniqueProperties.map(p => `<option value="${p}">${p}</option>`).join('');
        }

        // Apply filters and render
        filterOwnerBookings();

    } catch (error) {
        console.error('Error loading bookings:', error);
        showToast('Error', 'Failed to load bookings', '❌');
    }
}

// Filter Owner Bookings
function filterOwnerBookings() {
    if (!ownerData.bookings || ownerData.bookings.length === 0) return;

    const searchTerm = document.getElementById('bookingsSearch')?.value.toLowerCase() || '';
    const propertyFilter = document.getElementById('bookingsPropertyFilter')?.value || '';
    const statusFilter = document.getElementById('bookingsStatusFilter')?.value || '';
    const paymentFilter = document.getElementById('bookingsPaymentFilter')?.value || '';

    filteredOwnerBookings = ownerData.bookings.filter(booking => {
        // Search filter
        const matchesSearch = !searchTerm ||
            booking.booking_id?.toLowerCase().includes(searchTerm) ||
            booking.guest_name?.toLowerCase().includes(searchTerm) ||
            booking.guest_phone?.includes(searchTerm);

        // Property filter
        const matchesProperty = !propertyFilter || booking.property_name === propertyFilter;

        // Status filter
        const matchesStatus = !statusFilter || booking.status === statusFilter;

        // Payment filter
        const matchesPayment = !paymentFilter || booking.payment_status === paymentFilter;

        return matchesSearch && matchesProperty && matchesStatus && matchesPayment;
    });

    // Update count
    const countEl = document.getElementById('bookingsCount');
    if (countEl) countEl.textContent = filteredOwnerBookings.length;

    // Update summary cards
    updateBookingsSummary(filteredOwnerBookings);

    // Render bookings
    renderOwnerBookingsList(filteredOwnerBookings);
}

// Clear Bookings Filters
function clearBookingsFilters() {
    document.getElementById('bookingsSearch').value = '';
    document.getElementById('bookingsPropertyFilter').value = '';
    document.getElementById('bookingsStatusFilter').value = '';
    document.getElementById('bookingsPaymentFilter').value = '';
    filterOwnerBookings();
}

// Update Bookings Summary Cards
function updateBookingsSummary(bookings) {
    const completed = bookings.filter(b => b.status === 'completed').length;
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const checkedIn = bookings.filter(b => b.status === 'checked_in').length;
    const pending = bookings.filter(b => b.status === 'pending').length;

    document.getElementById('bookingsCompleted').textContent = completed;
    document.getElementById('bookingsConfirmed').textContent = confirmed;
    document.getElementById('bookingsCheckedIn').textContent = checkedIn;
    document.getElementById('bookingsPending').textContent = pending;
}

// Render Owner Bookings List
function renderOwnerBookingsList(bookings) {
    const container = document.getElementById('ownerBookingsList');
    if (!container) return;

    if (bookings.length === 0) {
        container.innerHTML = '<div class="card"><p style="text-align: center; color: var(--text-secondary); padding: 40px 20px;">No bookings match your filters</p></div>';
        return;
    }

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
            // Mobile card layout
            let html = '<div class="mobile-card-list">';
            bookings.forEach(booking => {
                // Use hostizzy_revenue field from booking (same as main app)
                const hostizzyShare = parseFloat(booking.hostizzy_revenue) || 0;
                const yourEarnings = (parseFloat(booking.total_amount) || 0) - hostizzyShare;
                const stayAmount = parseFloat(booking.stay_amount) || 0;
                const mealsChef = parseFloat(booking.meals_chef) || 0;
                const bonfireOther = parseFloat(booking.bonfire_other) || 0;
                const extraGuests = parseFloat(booking.extra_guest_charges) || 0;

                html += `
                    <div class="booking-mobile-card">
                        <div class="booking-mobile-card-header">
                            <div>
                                <strong style="font-size: 16px;">${booking.booking_id}</strong>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${booking.property_name}</div>
                                <div style="font-size: 12px; color: var(--primary); margin-top: 2px;">📍 ${booking.booking_source || 'DIRECT'}</div>
                            </div>
                            <span class="badge" style="background: ${booking.status === 'confirmed' ? 'blue' : booking.status === 'completed' ? 'green' : 'orange'};">${booking.status}</span>
                        </div>
                        <div class="booking-mobile-card-body">
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Guest</span>
                                <span class="booking-mobile-value">${booking.guest_name} (${booking.guest_phone})</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Dates</span>
                                <span class="booking-mobile-value">${new Date(booking.check_in).toLocaleDateString('en-IN')} → ${new Date(booking.check_out).toLocaleDateString('en-IN')} (${booking.nights}N)</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Stay Amount</span>
                                <span class="booking-mobile-value">₹${stayAmount.toLocaleString('en-IN')}</span>
                            </div>
                            ${extraGuests > 0 ? `<div class="booking-mobile-row">
                                <span class="booking-mobile-label">Extra Guests</span>
                                <span class="booking-mobile-value">₹${extraGuests.toLocaleString('en-IN')}</span>
                            </div>` : ''}
                            ${mealsChef > 0 ? `<div class="booking-mobile-row">
                                <span class="booking-mobile-label">Meals/Chef</span>
                                <span class="booking-mobile-value">₹${mealsChef.toLocaleString('en-IN')}</span>
                            </div>` : ''}
                            ${bonfireOther > 0 ? `<div class="booking-mobile-row">
                                <span class="booking-mobile-label">Bonfire/Other</span>
                                <span class="booking-mobile-value">₹${bonfireOther.toLocaleString('en-IN')}</span>
                            </div>` : ''}
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Total Amount</span>
                                <span class="booking-mobile-value" style="font-weight: 700;">₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Hostizzy Commission</span>
                                <span class="booking-mobile-value" style="color: var(--warning);">₹${hostizzyShare.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Your Earnings</span>
                                <span class="booking-mobile-value" style="color: var(--success); font-weight: 700;">₹${yourEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Payment Status</span>
                                <span class="badge" style="background: ${booking.payment_status === 'paid' ? 'green' : booking.payment_status === 'partial' ? 'blue' : 'orange'}; font-size: 11px;">${booking.payment_status}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            // Desktop table layout with ALL fields
            let html = '<div class="table-container"><table class="data-table"><thead><tr>';
            html += '<th>Booking ID</th>';
            html += '<th>Guest</th>';
            html += '<th>Property</th>';
            html += '<th>Source</th>';
            html += '<th>Check In</th>';
            html += '<th>Nights</th>';
            html += '<th>Stay</th>';
            html += '<th>Meals</th>';
            html += '<th>Other</th>';
            html += '<th>Total</th>';
            html += '<th>Commission</th>';
            html += '<th>Your Earnings</th>';
            html += '<th>Payment</th>';
            html += '<th>Status</th>';
            html += '</tr></thead><tbody>';

            bookings.forEach(booking => {
                // Use hostizzy_revenue field from booking (same as main app)
                const hostizzyShare = parseFloat(booking.hostizzy_revenue) || 0;
                const totalAmount = parseFloat(booking.total_amount) || 0;
                const yourEarnings = totalAmount - hostizzyShare;
                const stayAmount = parseFloat(booking.stay_amount) || 0;
                const mealsChef = parseFloat(booking.meals_chef) || 0;
                const bonfireOther = parseFloat(booking.bonfire_other) || 0;
                const extraGuests = parseFloat(booking.extra_guest_charges) || 0;

                const paymentStatusColors = {
                    'pending': 'orange',
                    'partial': 'blue',
                    'paid': 'green'
                };

                const statusColors = {
                    'pending': 'orange',
                    'confirmed': 'blue',
                    'checked_in': 'purple',
                    'completed': 'green',
                    'cancelled': 'red'
                };

                html += '<tr>';
                html += `<td><strong>${booking.booking_id}</strong></td>`;
                html += `<td>${booking.guest_name}<br><small style="color: var(--text-secondary);">${booking.guest_phone}</small></td>`;
                html += `<td>${booking.property_name}</td>`;
                html += `<td><span style="font-size: 12px;">${booking.booking_source || 'DIRECT'}</span></td>`;
                html += `<td>${new Date(booking.check_in).toLocaleDateString('en-IN')}</td>`;
                html += `<td>${booking.nights}</td>`;
                html += `<td>₹${stayAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>`;
                html += `<td>${mealsChef > 0 ? '₹' + mealsChef.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>`;
                html += `<td>${bonfireOther > 0 ? '₹' + bonfireOther.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>`;
                html += `<td><strong>₹${totalAmount.toLocaleString('en-IN')}</strong></td>`;
                html += `<td style="color: var(--warning);">₹${hostizzyShare.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>`;
                html += `<td style="color: var(--success); font-weight: 700;">₹${yourEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>`;
                html += `<td><span class="badge" style="background: ${paymentStatusColors[booking.payment_status]};">${booking.payment_status}</span></td>`;
                html += `<td><span class="badge" style="background: ${statusColors[booking.status]};">${booking.status}</span></td>`;
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        }
}

// Load Owner Payouts with Simplified Settlement Tracking
async function loadOwnerPayouts() {
    try {
        const ownerId = currentUser.id;
        const owner = await db.getOwner(ownerId);
        const propertyIds = owner.property_ids || [];

        if (propertyIds.length === 0) {
            document.getElementById('ownerPayoutsList').innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No properties linked to your account</p>';
            return;
        }

        const container = document.getElementById('ownerPayoutsList');
        let html = '';

        // Settlement starts from November 2024 onwards
        const startYear = 2024;
        const startMonth = 10; // November (0-indexed)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Generate monthly settlements from November 2024 to current month
        const monthlySettlements = [];

        for (let year = startYear; year <= currentYear; year++) {
            const monthStart = (year === startYear) ? startMonth : 0;
            const monthEnd = (year === currentYear) ? currentMonth : 11;

            for (let month = monthStart; month <= monthEnd; month++) {
                const firstDayOfMonth = new Date(year, month, 1);
                const firstDayOfNextMonth = new Date(year, month + 1, 1);

                const startDate = firstDayOfMonth.toISOString().split('T')[0];
                const endDate = firstDayOfNextMonth.toISOString().split('T')[0];

                // Get bookings for this month to calculate total commission
                const monthBookings = ownerData.bookings.filter(booking => {
                    const checkInDate = new Date(booking.check_in);
                    const checkInMonth = checkInDate.getMonth();
                    const checkInYear = checkInDate.getFullYear();
                    return checkInYear === year && checkInMonth === month && booking.status !== 'cancelled';
                });

                // Calculate total commission from bookings (from reservation table)
                const totalCommission = monthBookings.reduce((sum, booking) => {
                    return sum + (parseFloat(booking.hostizzy_revenue) || 0);
                }, 0);

                // Get ALL payments for these bookings (regardless of payment date)
                // Example: Oct payment for Nov reservation counts in Nov settlement
                const monthBookingIds = monthBookings.map(b => b.booking_id);

                let monthPayments = [];
                if (monthBookingIds.length > 0) {
                    const { data, error: paymentsError } = await supabase
                        .from('payments')
                        .select('*')
                        .in('booking_id', monthBookingIds);

                    if (paymentsError) {
                        console.error('Error loading payments for month:', paymentsError);
                    } else {
                        monthPayments = data || [];
                    }
                }

                // Check if this month's settlement has been marked as completed
                const settlementKey = `${year}-${month}`;
                const { data: settlementStatus } = await supabase
                    .from('settlement_status')
                    .select('*')
                    .eq('owner_id', ownerId)
                    .eq('settlement_month', settlementKey)
                    .single();

                const isSettlementCompleted = settlementStatus?.status === 'completed';

                // Separate payments by recipient and sum amounts
                const totalToOwner = (monthPayments || [])
                    .filter(p => p.payment_recipient && p.payment_recipient.toLowerCase().includes('owner'))
                    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

                const totalToHostizzy = (monthPayments || [])
                    .filter(p => p.payment_recipient && p.payment_recipient.toLowerCase().includes('hostizzy'))
                    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

                // Simple calculation: Net Settlement = Hostizzy Payment - Total Commission
                const netSettlement = totalToHostizzy - totalCommission;

                monthlySettlements.push({
                    year,
                    month,
                    monthLabel: getMonthLabel(year, month),
                    totalCommission,
                    paymentsToOwner: totalToOwner,
                    paymentsToHostizzy: totalToHostizzy,
                    netSettlement,
                    isCurrent: year === currentYear && month === currentMonth,
                    isCompleted: isSettlementCompleted,
                    completedAt: settlementStatus?.completed_at || null
                });
            }
        }

        // Reverse to show most recent first
        monthlySettlements.reverse();

        // Render monthly settlement cards
        html += '<h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Monthly Settlements (Since November 2024)</h3>';

        if (monthlySettlements.length === 0) {
            html += '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No settlements available</p>';
        } else {
            monthlySettlements.forEach(settlement => {
                const isPositive = settlement.netSettlement >= 0;
                const cardColor = settlement.isCurrent
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'var(--card-bg)';
                const textColor = settlement.isCurrent ? 'white' : 'var(--text-primary)';
                const secondaryColor = settlement.isCurrent ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)';

                html += `
                    <div style="background: ${cardColor}; color: ${textColor}; border-radius: 12px; padding: 20px; margin-bottom: 16px; ${!settlement.isCurrent ? 'border: 1px solid var(--border);' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="margin: 0; font-size: 16px; font-weight: 600;">
                                ${settlement.isCurrent ? '🗓️ ' : ''}${settlement.monthLabel}${settlement.isCurrent ? ' (Current)' : ''}
                            </h4>
                            <div style="text-align: right;">
                                <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">Net Settlement</div>
                                <div style="font-size: 28px; font-weight: 700; color: ${settlement.isCurrent ? 'white' : (isPositive ? 'var(--success)' : 'var(--warning)')};">
                                    ${isPositive ? '+' : ''}₹${settlement.netSettlement.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
                            <div style="background: ${settlement.isCurrent ? 'rgba(255,255,255,0.15)' : 'var(--bg)'}; padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: ${secondaryColor}; margin-bottom: 8px;">💳 Total Commission</div>
                                <div style="font-size: 20px; font-weight: 700;">₹${settlement.totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                <div style="font-size: 11px; color: ${secondaryColor}; margin-top: 4px;">From bookings</div>
                            </div>

                            <div style="background: ${settlement.isCurrent ? 'rgba(255,255,255,0.15)' : 'var(--bg)'}; padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: ${secondaryColor}; margin-bottom: 8px;">🏢 Hostizzy Payment</div>
                                <div style="font-size: 20px; font-weight: 700;">₹${settlement.paymentsToHostizzy.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                <div style="font-size: 11px; color: ${secondaryColor}; margin-top: 4px;">Received by Hostizzy</div>
                            </div>

                            <div style="background: ${settlement.isCurrent ? 'rgba(255,255,255,0.15)' : 'var(--bg)'}; padding: 12px; border-radius: 8px;">
                                <div style="font-size: 12px; color: ${secondaryColor}; margin-bottom: 8px;">💰 Owner Payment</div>
                                <div style="font-size: 20px; font-weight: 700;">₹${settlement.paymentsToOwner.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                <div style="font-size: 11px; color: ${secondaryColor}; margin-top: 4px;">Received by you</div>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${settlement.isCurrent ? 'rgba(255,255,255,0.15)' : 'var(--bg)'}; border-radius: 8px;">
                            ${settlement.isCompleted ? `
                                <span style="font-size: 14px; font-weight: 600; color: var(--success);">
                                    ✅ Settlement Completed ${settlement.completedAt ? '• ' + formatDateIST(settlement.completedAt, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                </span>
                                <span style="font-size: 12px; opacity: 0.8;">Amount: ₹${Math.abs(settlement.netSettlement).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            ` : `
                                <span style="font-size: 14px; font-weight: 600;">
                                    ${isPositive
                                        ? `✅ Payout Pending: ₹${settlement.netSettlement.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                        : settlement.netSettlement === 0
                                        ? `✅ Settled: No payment due`
                                        : `⚠️ Payment Pending: ₹${Math.abs(settlement.netSettlement).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                    }
                                </span>
                                ${settlement.netSettlement !== 0 ? `
                                <button
                                    onclick="markSettlement('${settlement.year}', '${settlement.month}', ${isPositive})"
                                    style="padding: 8px 16px; background: ${settlement.isCurrent ? 'white' : 'var(--primary)'}; color: ${settlement.isCurrent ? 'var(--primary)' : 'white'}; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;"
                                >
                                    ${isPositive ? 'Mark Payout Received' : 'Mark Payment Done'}
                                </button>
                                ` : ''}
                            `}
                        </div>
                    </div>
                `;
            });
        }

        // Payout Requests History
        ownerData.payouts = await db.getPayoutRequests(ownerId);

        html += '<h3 style="margin: 32px 0 16px 0; font-size: 16px; font-weight: 600;">Payout Requests History</h3>';

        if (ownerData.payouts.length === 0) {
            html += '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No payout requests yet</p>';
        } else {
            html += '<div class="table-container"><table class="data-table"><thead><tr>';
            html += '<th>Request Date</th>';
            html += '<th>Amount</th>';
            html += '<th>Method</th>';
            html += '<th>Status</th>';
            html += '<th>Processed Date</th>';
            html += '<th>Transaction ID</th>';
            html += '<th>Notes</th>';
            html += '</tr></thead><tbody>';

            ownerData.payouts.forEach(payout => {
                const statusColors = {
                    'pending': 'orange',
                    'approved': 'blue',
                    'processing': 'purple',
                    'completed': 'green',
                    'rejected': 'red'
                };

                html += '<tr>';
                html += `<td>${formatDateIST(payout.requested_at)}</td>`;
                html += `<td><strong>₹${parseFloat(payout.amount).toLocaleString('en-IN')}</strong></td>`;
                html += `<td>${payout.payout_method}</td>`;
                html += `<td><span class="badge" style="background: ${statusColors[payout.status]};">${payout.status}</span></td>`;
                html += `<td>${payout.processed_at ? formatDateIST(payout.processed_at) : '-'}</td>`;
                html += `<td>${payout.transaction_id || '-'}</td>`;
                html += `<td>${payout.admin_notes || payout.owner_notes || '-'}</td>`;
                html += '</tr>';
            });

            html += '</tbody></table></div>';
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('Settlement tracking error:', error);
        showToast('Error', 'Failed to load payouts: ' + error.message, '❌');
    }
}

// Mark settlement as completed
async function markSettlement(year, month, isPayoutReceived) {
    try {
        const settlementKey = `${year}-${month}`;
        const action = isPayoutReceived ? 'Payout Received' : 'Payment Done';

        // Confirm with user
        const confirmed = confirm(`Are you sure you want to mark this settlement as "${action}"?\n\nMonth: ${getMonthLabel(parseInt(year), parseInt(month))}\n\nThis action will record that the settlement has been completed.`);

        if (!confirmed) return;

        // Save settlement status to database
        const { error } = await supabase
            .from('settlement_status')
            .upsert({
                owner_id: currentUser.id,
                settlement_month: settlementKey,
                status: 'completed',
                completed_at: new Date().toISOString(),
                settlement_type: isPayoutReceived ? 'payout_received' : 'payment_done',
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'owner_id,settlement_month'
            });

        if (error) {
            console.error('Error saving settlement status:', error);
            showToast('Error', 'Failed to save settlement status: ' + error.message, '❌');
            return;
        }

        // Success - reload payouts view
        showToast('Success', `Settlement marked as ${action}!`, '✅');
        await loadOwnerPayouts();

    } catch (error) {
        console.error('Error marking settlement:', error);
        showToast('Error', 'Failed to mark settlement: ' + error.message, '❌');
    }
}

// Load Owner Bank Details
async function loadOwnerBankDetails() {
    try {
        const owner = await db.getOwner(currentUser.id);

        document.getElementById('ownerAccountHolderName').value = owner.account_holder_name || '';
        document.getElementById('ownerBankAccountNumber').value = owner.bank_account_number || '';
        document.getElementById('ownerBankIFSC').value = owner.bank_ifsc || '';
        document.getElementById('ownerBankName').value = owner.bank_name || '';
        document.getElementById('ownerBankBranch').value = owner.bank_branch || '';
        document.getElementById('ownerUPIId').value = owner.upi_id || '';

    } catch (error) {
        showToast('Error', 'Failed to load bank details: ' + error.message, '❌');
    }
}

// Save Owner Bank Details
async function saveOwnerBankDetails() {
    try {
        const updates = {
            id: currentUser.id,
            account_holder_name: document.getElementById('ownerAccountHolderName').value.trim(),
            bank_account_number: document.getElementById('ownerBankAccountNumber').value.trim(),
            bank_ifsc: document.getElementById('ownerBankIFSC').value.trim().toUpperCase(),
            bank_name: document.getElementById('ownerBankName').value.trim(),
            bank_branch: document.getElementById('ownerBankBranch').value.trim(),
            upi_id: document.getElementById('ownerUPIId').value.trim()
        };

        if (!updates.bank_account_number) {
            showToast('Validation Error', 'Please enter bank account number', '❌');
            return;
        }

        if (!updates.bank_ifsc) {
            showToast('Validation Error', 'Please enter IFSC code', '❌');
            return;
        }

        await db.saveOwner(updates);

        // Update current user
        currentUser = { ...currentUser, ...updates };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        showToast('Success', 'Bank details saved successfully!', '✅');

    } catch (error) {
        showToast('Error', 'Failed to save bank details: ' + error.message, '❌');
    }
}

// Load Owner Properties
async function loadOwnerProperties() {
    try {
        const properties = await db.getProperties();
        // Filter by property_ids array
        const ownerPropertyIds = currentUser.property_ids || [];
        ownerData.properties = properties.filter(p => ownerPropertyIds.includes(p.id));

        const container = document.getElementById('ownerPropertiesList');

        if (ownerData.properties.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No properties linked to your account</p>';
            return;
        }

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">';

        ownerData.properties.forEach(property => {
            const commissionRate = parseFloat(property.revenue_share_percent) || 15;
            html += `
                <div class="card">
                    <h4 style="margin: 0 0 12px 0;">${property.name}</h4>
                    <p style="color: var(--text-secondary); margin: 0 0 8px 0;">📍 ${property.location || 'No location'}</p>
                    <p style="color: var(--text-secondary); margin: 0 0 12px 0; font-size: 13px;">${property.type || 'Property'} • ${property.capacity || 0} guests</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border);">
                        <span style="font-size: 13px; color: var(--text-secondary);">Hostizzy Commission</span>
                        <strong style="color: var(--warning); font-size: 18px;">${commissionRate}%</strong>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        showToast('Error', 'Failed to load properties: ' + error.message, '❌');
    }
}

// Open Payout Request Modal
async function openPayoutRequestModal() {
    try {
        const pendingPayout = await db.getOwnerPendingPayout(currentUser.id);

        document.getElementById('payoutAvailableBalance').textContent = '₹' + pendingPayout.toLocaleString('en-IN');
        document.getElementById('payoutAmount').value = '';
        document.getElementById('payoutAmount').max = pendingPayout;
        document.getElementById('payoutMethod').value = 'bank_transfer';
        document.getElementById('payoutNotes').value = '';

        document.getElementById('payoutRequestModal').classList.add('active');

    } catch (error) {
        showToast('Error', 'Failed to load payout data: ' + error.message, '❌');
    }
}

// Close Payout Request Modal
function closePayoutRequestModal() {
    document.getElementById('payoutRequestModal').classList.remove('active');
}

// Submit Payout Request
async function submitPayoutRequest() {
    try {
        const amount = parseFloat(document.getElementById('payoutAmount').value);
        const method = document.getElementById('payoutMethod').value;
        const notes = document.getElementById('payoutNotes').value.trim();

        if (!amount || amount < 100) {
            showToast('Validation Error', 'Minimum payout amount is ₹100', '❌');
            return;
        }

        const availableBalance = parseFloat(document.getElementById('payoutAvailableBalance').textContent.replace('₹', '').replace(/,/g, ''));

        if (amount > availableBalance) {
            showToast('Validation Error', 'Amount exceeds available balance', '❌');
            return;
        }

        if (!currentUser.bank_account_number && method === 'bank_transfer') {
            showToast('Error', 'Please add bank details first', '❌');
            closePayoutRequestModal();
            showOwnerView('ownerBankDetails');
            return;
        }

        if (!currentUser.upi_id && method === 'upi') {
            showToast('Error', 'Please add UPI ID first', '❌');
            closePayoutRequestModal();
            showOwnerView('ownerBankDetails');
            return;
        }

        const payoutRequest = {
            owner_id: currentUser.id,
            amount: amount,
            payout_method: method,
            owner_notes: notes,
            status: 'pending'
        };

        await db.savePayoutRequest(payoutRequest);

        closePayoutRequestModal();
        showToast('Success', 'Payout request submitted successfully!', '✅');

        // Reload dashboard
        loadOwnerDashboard();

    } catch (error) {
        showToast('Error', 'Failed to submit payout request: ' + error.message, '❌');
    }
}

// Resize handler for mobile optimization
window.addEventListener('resize', () => {
    // Reload current view to adjust for mobile/desktop
    const activeView = document.querySelector('.owner-view:not(.hidden)');
    if (activeView) {
        const viewName = activeView.id.replace('View', '');
        if (viewName === 'ownerDashboard') {
            renderOwnerRecentBookings(ownerData.bookings.slice(0, 10));
        } else if (viewName === 'ownerBookings') {
            loadOwnerBookings();
        } else if (viewName === 'ownerPayments') {
            renderOwnerPaymentsList(ownerData.payments);
        }
    }
});
