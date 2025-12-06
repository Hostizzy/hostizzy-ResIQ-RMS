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
function formatMoMChangeCompact(change) {
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    const color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-secondary)';
    return `<span style="color: ${color}; font-size: 12px;">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
}
