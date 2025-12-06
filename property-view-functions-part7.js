// ============================================================================
// PROPERTY VIEW FUNCTIONS - PART 7: Booking Type Breakdown
// ============================================================================

// Render Booking Type Breakdown Table
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
        <table class="data-table">
            <thead>
                <tr>
                    <th>Booking Type</th>
                    <th>Bookings</th>
                    <th>% of Total</th>
                    <th>Total Revenue</th>
                    <th>% Revenue</th>
                    <th>Total Nights</th>
                    <th>Avg Nights</th>
                    <th>ADR</th>
                    <th>Collection %</th>
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
    `;
}
