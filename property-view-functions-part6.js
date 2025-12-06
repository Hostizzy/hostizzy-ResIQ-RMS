// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 6: Chart Rendering
// ============================================================================

// Global chart instances for cleanup
let propertyCharts = {
    revenue: null,
    sources: null,
    paymentStatus: null,
    bookingTypes: null
};

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
