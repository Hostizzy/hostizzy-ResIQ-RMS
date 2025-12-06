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
