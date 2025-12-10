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

        // Get all payments for owner's properties
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*, reservations!inner(property_id, property_name, total_amount, hostizzy_revenue)')
            .in('reservations.property_id', propertyIds)
            .order('payment_date', { ascending: false });

        if (paymentsError) throw paymentsError;

        ownerData.payments = payments || [];

        // Get all bookings
        const { data: bookings, error: bookingsError } = await supabase
            .from('reservations')
            .select('*')
            .in('property_id', propertyIds)
            .order('check_in', { ascending: false });

        if (bookingsError) throw bookingsError;

        ownerData.bookings = bookings || [];

        // Debug: Log bookings data
        console.log('[Owner Portal] Property IDs:', propertyIds);
        console.log('[Owner Portal] Total bookings fetched:', bookings.length);
        console.log('[Owner Portal] Bookings by status:', {
            all: bookings.length,
            confirmed: bookings.filter(b => b.status === 'confirmed').length,
            checked_in: bookings.filter(b => b.status === 'checked_in').length,
            completed: bookings.filter(b => b.status === 'completed').length,
            pending: bookings.filter(b => b.status === 'pending').length,
            cancelled: bookings.filter(b => b.status === 'cancelled').length
        });

        // Get properties
        const { data: properties, error: propertiesError } = await supabase
            .from('properties')
            .select('*')
            .in('id', propertyIds);

        if (propertiesError) throw propertiesError;

        ownerData.properties = properties || [];

        // Calculate metrics from bookings (exclude only cancelled - same as main app)
        const confirmedBookings = ownerData.bookings.filter(b => b.status !== 'cancelled');

        // Calculate total revenue from all bookings
        const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);

        // Debug: Log revenue calculation
        console.log('[Owner Portal] Confirmed bookings:', confirmedBookings.length);
        console.log('[Owner Portal] Total Revenue calculated:', totalRevenue);
        console.log('[Owner Portal] Sample bookings:', confirmedBookings.slice(0, 3).map(b => ({
            id: b.booking_id,
            status: b.status,
            payment_status: b.payment_status,
            total_amount: b.total_amount,
            hostizzy_revenue: b.hostizzy_revenue
        })));

        // Calculate total guests (adults + children)
        const totalGuests = confirmedBookings.reduce((sum, b) => {
            const adults = parseInt(b.adults) || 0;
            const children = parseInt(b.children) || 0;
            return sum + adults + children;
        }, 0);

        // Calculate Hostizzy revenue using the hostizzy_revenue field from database (same as main app)
        const totalHostizzyShare = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.hostizzy_revenue) || 0), 0);

        const netEarnings = totalRevenue - totalHostizzyShare;

        // Get pending payout
        const pendingPayout = await db.getOwnerPendingPayout(ownerId);

        // Update cards with null checks
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
        const avgCommission = totalRevenue > 0 ? ((totalHostizzyShare / totalRevenue) * 100).toFixed(1) : 0;
        if (percentEl) percentEl.textContent = `${avgCommission}% average`;

        // Load monthly breakdown
        loadMonthlyBreakdown();

        // Load charts
        loadRevenueCharts();

        // Load recent bookings
        const recentBookings = ownerData.bookings.slice(0, 10);
        renderOwnerRecentBookings(recentBookings);

    } catch (error) {
        showToast('Error', 'Failed to load dashboard data: ' + error.message, '❌');
    }
}

// Load Monthly Breakdown
function loadMonthlyBreakdown() {
    const monthlyData = {};

    ownerData.payments.forEach(payment => {
        const date = new Date(payment.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                month: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
                collected: 0,
                hostizzyShare: 0,
                ownerEarnings: 0,
                payments: []
            };
        }

        const booking = ownerData.bookings.find(b => b.booking_id === payment.booking_id);
        const amount = parseFloat(payment.amount) || 0;
        // Use hostizzy_revenue field from booking (same as main app)
        const hostizzyShare = booking ? (parseFloat(booking.hostizzy_revenue) || 0) : 0;

        monthlyData[monthKey].collected += amount;
        monthlyData[monthKey].hostizzyShare += hostizzyShare;
        monthlyData[monthKey].ownerEarnings += (amount - hostizzyShare);
        monthlyData[monthKey].payments.push(payment);
    });

    // Convert to array and sort by month (descending) - store ALL data
    ownerData.allMonthlyData = Object.keys(monthlyData)
        .sort((a, b) => b.localeCompare(a))
        .map(key => ({ ...monthlyData[key], monthKey: key }));

    // Populate dropdown with individual months
    populateMonthlyDropdown();

    // Initial render - show last 6 months
    filterMonthlyBreakdown();
}

// Render Monthly Breakdown
function renderMonthlyBreakdown() {
    const container = document.getElementById('monthlyBreakdown');

    if (ownerData.monthlyData.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No payment data available</p>';
        return;
    }

    let html = '';
    ownerData.monthlyData.forEach(month => {
        html += `
            <div style="border-bottom: 1px solid var(--border); padding: 16px 0; last-child:border-bottom: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 16px;">${month.month}</h4>
                    <span style="color: var(--success); font-weight: 700;">₹${month.collected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 8px;">
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Hostizzy Share</div>
                        <div style="font-weight: 600; color: var(--warning);">₹${month.hostizzyShare.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Your Earnings</div>
                        <div style="font-weight: 600; color: var(--success);">₹${month.ownerEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--text-secondary);">Payments Count</div>
                        <div style="font-weight: 600;">${month.payments.length}</div>
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
    const filterValue = document.getElementById('monthlyBreakdownFilter')?.value || 'last6';

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

// Load Revenue Charts
function loadRevenueCharts() {
    // Revenue Line Chart (Monthly Trend)
    const lineCtx = document.getElementById('revenueLineChart');
    if (lineCtx) {
        if (revenueLineChart) revenueLineChart.destroy();

        const months = ownerData.monthlyData.slice().reverse().map(m => m.month.split(' ')[0]);
        const collectedData = ownerData.monthlyData.slice().reverse().map(m => m.collected);
        const earningsData = ownerData.monthlyData.slice().reverse().map(m => m.ownerEarnings);

        revenueLineChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Total Collected',
                        data: collectedData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Your Earnings',
                        data: earningsData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        fill: true
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

    // Revenue Pie Chart (Split)
    const pieCtx = document.getElementById('revenuePieChart');
    if (pieCtx) {
        if (revenuePieChart) revenuePieChart.destroy();

        const totalCollected = ownerData.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        // Use hostizzy_revenue field from bookings (same as main app)
        let totalHostizzyShare = 0;
        ownerData.payments.forEach(payment => {
            const booking = ownerData.bookings.find(b => b.booking_id === payment.booking_id);
            if (booking) {
                totalHostizzyShare += parseFloat(booking.hostizzy_revenue) || 0;
            }
        });
        const ownerEarnings = totalCollected - totalHostizzyShare;

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
                                const percentage = ((value / totalCollected) * 100).toFixed(1);
                                return `${label}: ₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Property Performance Bar Chart
    const barCtx = document.getElementById('propertyBarChart');
    if (barCtx) {
        if (propertyBarChart) propertyBarChart.destroy();

        const propertyPerformance = {};
        ownerData.payments.forEach(payment => {
            const booking = ownerData.bookings.find(b => b.booking_id === payment.booking_id);
            if (booking) {
                const propertyName = booking.property_name;
                if (!propertyPerformance[propertyName]) {
                    propertyPerformance[propertyName] = {
                        collected: 0,
                        ownerEarnings: 0
                    };
                }
                const amount = parseFloat(payment.amount) || 0;
                // Use hostizzy_revenue field from booking (same as main app)
                const hostizzyShare = parseFloat(booking.hostizzy_revenue) || 0;
                propertyPerformance[propertyName].collected += amount;
                propertyPerformance[propertyName].ownerEarnings += (amount - hostizzyShare);
            }
        });

        const propertyNames = Object.keys(propertyPerformance);
        const collectedData = propertyNames.map(name => propertyPerformance[name].collected);
        const earningsData = propertyNames.map(name => propertyPerformance[name].ownerEarnings);

        propertyBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: propertyNames,
                datasets: [
                    {
                        label: 'Total Collected',
                        data: collectedData,
                        backgroundColor: '#10b981'
                    },
                    {
                        label: 'Your Earnings',
                        data: earningsData,
                        backgroundColor: '#8b5cf6'
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
async function loadOwnerBookings() {
    try {
        const ownerId = currentUser.id;
        ownerData.bookings = await db.getOwnerBookings(ownerId);

        const container = document.getElementById('ownerBookingsList');

        if (ownerData.bookings.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No bookings found</p>';
            return;
        }

        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Mobile card layout
            let html = '<div class="mobile-card-list">';
            ownerData.bookings.forEach(booking => {
                // Use hostizzy_revenue field from booking (same as main app)
                const hostizzyShare = parseFloat(booking.hostizzy_revenue) || 0;
                const yourEarnings = (parseFloat(booking.total_amount) || 0) - hostizzyShare;

                html += `
                    <div class="booking-mobile-card">
                        <div class="booking-mobile-card-header">
                            <div>
                                <strong style="font-size: 16px;">${booking.booking_id}</strong>
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
                                <span class="booking-mobile-value">${new Date(booking.check_in).toLocaleDateString('en-IN')} - ${new Date(booking.check_out).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Total Amount</span>
                                <span class="booking-mobile-value">₹${parseFloat(booking.total_amount).toLocaleString('en-IN')}</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Your Earnings</span>
                                <span class="booking-mobile-value" style="color: var(--success); font-weight: 700;">₹${yourEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div class="booking-mobile-row">
                                <span class="booking-mobile-label">Hostizzy Commission</span>
                                <span class="booking-mobile-value" style="color: var(--warning);">₹${hostizzyShare.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
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
            html += '<th>Guest Name</th>';
            html += '<th>Phone</th>';
            html += '<th>Property</th>';
            html += '<th>Check In</th>';
            html += '<th>Check Out</th>';
            html += '<th>Nights</th>';
            html += '<th>Guests</th>';
            html += '<th>Total Amount</th>';
            html += '<th>Commission</th>';
            html += '<th>Your Earnings</th>';
            html += '<th>Payment Status</th>';
            html += '<th>Status</th>';
            html += '</tr></thead><tbody>';

            ownerData.bookings.forEach(booking => {
                // Use hostizzy_revenue field from booking (same as main app)
                const hostizzyShare = parseFloat(booking.hostizzy_revenue) || 0;
                const totalAmount = parseFloat(booking.total_amount) || 0;
                const yourEarnings = totalAmount - hostizzyShare;

                // Calculate commission percentage for display
                const commissionPercent = totalAmount > 0 ? ((hostizzyShare / totalAmount) * 100).toFixed(1) : 0;

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
                html += `<td>${booking.guest_name}</td>`;
                html += `<td>${booking.guest_phone}</td>`;
                html += `<td>${booking.property_name}</td>`;
                html += `<td>${new Date(booking.check_in).toLocaleDateString('en-IN')}</td>`;
                html += `<td>${new Date(booking.check_out).toLocaleDateString('en-IN')}</td>`;
                html += `<td>${booking.nights}</td>`;
                html += `<td>${booking.adults}${booking.kids ? ' + ' + booking.kids + ' kids' : ''}</td>`;
                html += `<td><strong>₹${totalAmount.toLocaleString('en-IN')}</strong></td>`;
                html += `<td style="color: var(--warning);">${commissionPercent}% (₹${hostizzyShare.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</td>`;
                html += `<td style="color: var(--success); font-weight: 700;">₹${yourEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>`;
                html += `<td><span class="badge" style="background: ${paymentStatusColors[booking.payment_status]};">${booking.payment_status}</span></td>`;
                html += `<td><span class="badge" style="background: ${statusColors[booking.status]};">${booking.status}</span></td>`;
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

    } catch (error) {
        showToast('Error', 'Failed to load bookings: ' + error.message, '❌');
    }
}

// Load Owner Payouts
async function loadOwnerPayouts() {
    try {
        const ownerId = currentUser.id;
        ownerData.payouts = await db.getPayoutRequests(ownerId);

        const container = document.getElementById('ownerPayoutsList');

        if (ownerData.payouts.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No payout requests yet</p>';
            return;
        }

        let html = '<div class="table-container"><table class="data-table"><thead><tr>';
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
            html += `<td>${new Date(payout.requested_at).toLocaleDateString('en-IN')}</td>`;
            html += `<td><strong>₹${parseFloat(payout.amount).toLocaleString('en-IN')}</strong></td>`;
            html += `<td>${payout.payout_method}</td>`;
            html += `<td><span class="badge" style="background: ${statusColors[payout.status]};">${payout.status}</span></td>`;
            html += `<td>${payout.processed_at ? new Date(payout.processed_at).toLocaleDateString('en-IN') : '-'}</td>`;
            html += `<td>${payout.transaction_id || '-'}</td>`;
            html += `<td>${payout.admin_notes || payout.owner_notes || '-'}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        showToast('Error', 'Failed to load payouts: ' + error.message, '❌');
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
