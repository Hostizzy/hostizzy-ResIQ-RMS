// ResIQ Business View — Portfolio analytics, business intelligence, charts

// ========================================
// ============================================================================
// BUSINESS VIEW FUNCTIONS (Portfolio Analytics)
// ============================================================================

// Global state for Business View
let businessViewData = {
    reservations: [],
    properties: [],
    payments: [],
    filteredData: {},
    currentSort: { field: 'score', direction: 'desc' }
};

// Global chart instances for cleanup
let businessCharts = {
    propertyRevenue: null,
    bookingType: null,
    channelMix: null,
    monthlyTrend: null
};

// Main loader function for Business View
async function loadBusinessView() {
    try {
        const dateRange = document.getElementById('businessDateRange').value;

        // Show/hide custom date range inputs
        const customFrom = document.getElementById('businessCustomDateFrom');
        const customTo = document.getElementById('businessCustomDateTo');
        if (dateRange === 'custom') {
            customFrom.style.display = 'block';
            customTo.style.display = 'block';
        } else {
            customFrom.style.display = 'none';
            customTo.style.display = 'none';
        }

        // Get date filter
        const dateFilter = getBusinessDateFilter(dateRange);

        // Fetch all data
        const [allReservations, properties, payments] = await Promise.all([
            db.getReservations(),
            db.getProperties(),
            db.getAllPayments()
        ]);

        // Store in global state
        businessViewData.reservations = allReservations;
        businessViewData.properties = properties;
        businessViewData.payments = payments;

        // Filter reservations by date
        let filteredReservations = allReservations;
        if (dateFilter.start && dateFilter.end) {
            filteredReservations = allReservations.filter(r => {
                const checkIn = new Date(r.check_in);
                return checkIn >= dateFilter.start && checkIn <= dateFilter.end;
            });
        }

        // Calculate nights for each reservation
        filteredReservations.forEach(r => {
            const checkIn = new Date(r.check_in);
            const checkOut = new Date(r.check_out);
            r.nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        });

        // Store filtered data
        businessViewData.filteredData = {
            reservations: filteredReservations,
            properties: properties,
            payments: payments
        };

        // Render all sections
        renderBusinessKPIs(filteredReservations, allReservations, properties, payments, dateFilter);
        renderTopPropertiesLeaderboard(filteredReservations, properties, payments);
        renderChannelPerformanceTable(filteredReservations);
        renderGuestAnalytics(filteredReservations);
        renderOccupancyAnalysis(filteredReservations, properties);
        renderPropertyComparisonTable(filteredReservations, properties, payments);
        renderBusinessMonthlyBreakdown(filteredReservations);
        renderBusinessCharts(filteredReservations, properties);

    } catch (error) {
        console.error('Business View load error:', error);
        showToast('Error', 'Failed to load business analytics', '❌');
    }
}

// Get date filter based on selection
function getBusinessDateFilter(dateRange) {
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
            const fromInput = document.getElementById('businessDateFrom').value;
            const toInput = document.getElementById('businessDateTo').value;
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

// Render Global KPI Cards
function renderBusinessKPIs(reservations, allReservationsData, properties, payments, dateFilter) {
    const container = document.getElementById('businessKPICards');

    // Filter active reservations (current period)
    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Calculate current period metrics
    const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalBookings = activeRes.length;
    const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);
    const activeProperties = properties.length;

    // Calculate Hostizzy Revenue and OTA fees
    const hostizzyRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
    const otaFees = activeRes.reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0);
    const totalHostPayout = activeRes.reduce((sum, r) => sum + getHostPayout(r), 0);
    const ownerRevenue = totalHostPayout - hostizzyRevenue;

    // Average Hostizzy share percentage
    const avgHostizzyShare = totalHostPayout > 0 ? (hostizzyRevenue / totalHostPayout) * 100 : 0;

    // Portfolio occupancy
    const targetNightsPerProperty = 200;
    const totalTargetNights = activeProperties * targetNightsPerProperty;
    const portfolioOccupancy = totalTargetNights > 0 ? (totalNights / totalTargetNights) * 100 : 0;

    // Average booking value
    const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Calculate previous period using allReservationsData (not filtered current period)
    let prevRevenue = 0, prevBookings = 0, prevOccupancy = 0, prevAvgValue = 0, prevHostizzy = 0;
    const hasPrevPeriod = dateFilter.prevStart && dateFilter.prevEnd;
    if (hasPrevPeriod) {
        const prevData = (allReservationsData || []).filter(r => {
            const checkIn = new Date(r.check_in);
            return checkIn >= dateFilter.prevStart && checkIn <= dateFilter.prevEnd && r.status !== 'cancelled';
        });

        prevRevenue = prevData.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        prevBookings = prevData.length;
        const prevNights = prevData.reduce((sum, r) => sum + (r.nights || 0), 0);
        prevOccupancy = totalTargetNights > 0 ? (prevNights / totalTargetNights) * 100 : 0;
        prevAvgValue = prevBookings > 0 ? prevRevenue / prevBookings : 0;
        prevHostizzy = prevData.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
    }

    // MoM helper that returns null when no prev data (prevents misleading 100%)
    const mom = (cur, prev) => hasPrevPeriod ? calculateMoMChange(cur, prev) : null;

    // Calculate MoM changes
    const revenueMoM = mom(totalRevenue, prevRevenue);
    const bookingsMoM = mom(totalBookings, prevBookings);
    const occupancyMoM = mom(portfolioOccupancy, prevOccupancy);
    const avgValueMoM = mom(avgBookingValue, prevAvgValue);
    const hostizzyMoM = mom(hostizzyRevenue, prevHostizzy);

    // Render KPI cards
    container.innerHTML = `
        <div class="stat-card" style="border-left-color: var(--primary);">
            <div class="stat-value">${formatCurrency(totalRevenue)}</div>
            <div class="stat-label">Total Revenue</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(revenueMoM)}</div>` : ''}
        </div>
        <div class="stat-card" style="border-left-color: #10b981;">
            <div class="stat-value">${formatCurrency(hostizzyRevenue)}</div>
            <div class="stat-label"><i data-lucide="trending-up" style="width: 13px; height: 13px; margin-right: 4px;"></i>Hostizzy Revenue</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(hostizzyMoM)}</div>` : ''}
        </div>
        <div class="stat-card" style="border-left-color: #3b82f6;">
            <div class="stat-value">${formatCurrency(ownerRevenue)}</div>
            <div class="stat-label"><i data-lucide="shield" style="width: 13px; height: 13px; margin-right: 4px;"></i>Owner Revenue</div>
            <div class="stat-trend" style="font-size: 11px; margin-top: 4px; color: var(--text-tertiary);">After Hostizzy share</div>
        </div>
        ${otaFees > 0 ? `
        <div class="stat-card" style="border-left-color: #ef4444;">
            <div class="stat-value">${formatCurrency(otaFees)}</div>
            <div class="stat-label"><i data-lucide="building" style="width: 13px; height: 13px; margin-right: 4px;"></i>OTA Fees</div>
            <div class="stat-trend" style="font-size: 11px; margin-top: 4px; color: var(--danger);">Commission deducted</div>
        </div>
        <div class="stat-card" style="border-left-color: #10b981;">
            <div class="stat-value">${formatCurrency(totalHostPayout)}</div>
            <div class="stat-label"><i data-lucide="coins" style="width: 13px; height: 13px; margin-right: 4px;"></i>Host Payout</div>
            <div class="stat-trend" style="font-size: 11px; margin-top: 4px; color: var(--text-tertiary);">After OTA fees</div>
        </div>
        ` : ''}
        <div class="stat-card" style="border-left-color: #8b5cf6;">
            <div class="stat-value">${formatPercentage(portfolioOccupancy)}</div>
            <div class="stat-label">Portfolio Occupancy</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(occupancyMoM)}</div>` : ''}
        </div>
        <div class="stat-card" style="border-left-color: #f59e0b;">
            <div class="stat-value">${totalBookings}</div>
            <div class="stat-label">Total Bookings</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(bookingsMoM)}</div>` : ''}
        </div>
        <div class="stat-card" style="border-left-color: #06b6d4;">
            <div class="stat-value">${formatCurrency(avgBookingValue)}</div>
            <div class="stat-label">Avg Booking Value</div>
            ${hasPrevPeriod ? `<div class="stat-trend" style="font-size: 12px; margin-top: 4px;">${formatMoMChange(avgValueMoM)}</div>` : ''}
        </div>
        <div class="stat-card" style="border-left-color: #ec4899;">
            <div class="stat-value">${formatPercentage(avgHostizzyShare)}</div>
            <div class="stat-label"><i data-lucide="percent" style="width: 13px; height: 13px; margin-right: 4px;"></i>Avg Hostizzy Share</div>
            <div class="stat-trend" style="font-size: 11px; margin-top: 4px; color: var(--text-tertiary);">Of net revenue</div>
        </div>
        <div class="stat-card" style="border-left-color: #64748b;">
            <div class="stat-value">${activeProperties}</div>
            <div class="stat-label">Active Properties</div>
            <div class="stat-trend" style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">Portfolio size</div>
        </div>
    `;

    // Refresh Lucide icons
    setTimeout(() => { if (typeof refreshIcons === 'function') refreshIcons(); }, 100);
}
// Render Top Properties Leaderboard
function renderTopPropertiesLeaderboard(reservations, properties, payments) {
    const container = document.getElementById('topPropertiesLeaderboard');

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Calculate metrics for each property
    const propertyMetrics = properties.map(property => {
        const propertyRes = activeRes.filter(r => r.property_id == property.id);
        const revenue = propertyRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const bookings = propertyRes.length;
        const nights = propertyRes.reduce((sum, r) => sum + (r.nights || 0), 0);
        const occupancy = nights > 0 ? (nights / 200) * 100 : 0; // Target 200 nights/year
        const adr = nights > 0 ? revenue / nights : 0;

        // Calculate performance score (weighted)
        const revenueScore = Math.min((revenue / 1000000) * 100, 100) * 0.30;
        const occupancyScore = Math.min(occupancy, 100) * 0.25;
        const adrScore = Math.min((adr / 15000) * 100, 100) * 0.20;
        const bookingsScore = Math.min((bookings / 50) * 100, 100) * 0.15;
        const collectionScore = 50 * 0.10; // Simplified

        const score = Math.round(revenueScore + occupancyScore + adrScore + bookingsScore + collectionScore);

        return {
            property,
            revenue,
            bookings,
            nights,
            occupancy,
            adr,
            score
        };
    }).sort((a, b) => b.score - a.score);

    // Render leaderboard
    container.innerHTML = `
        <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 50px;">Rank</th>
                    <th>Property</th>
                    <th>Revenue</th>
                    <th>Bookings</th>
                    <th>Occupancy</th>
                    <th>ADR</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                ${propertyMetrics.map((m, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                    const scoreColor = m.score >= 90 ? 'var(--success)' : m.score >= 70 ? 'var(--primary)' : 'var(--warning)';

                    return `
                        <tr>
                            <td style="text-align: center; font-size: 18px;">${medal || (idx + 1)}</td>
                            <td><strong>${m.property.name}</strong></td>
                            <td><strong>${formatCurrency(m.revenue)}</strong></td>
                            <td>${m.bookings}</td>
                            <td>${formatPercentage(m.occupancy)}</td>
                            <td>${formatCurrency(m.adr)}</td>
                            <td>
                                <span style="font-size: 16px; font-weight: bold; color: ${scoreColor};">
                                    ${m.score}/100
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    `;
}

// Render Channel Performance Table
function renderChannelPerformanceTable(reservations) {
    const container = document.getElementById('channelPerformanceTable');

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Group by booking source/channel
    const channelGroups = {};
    activeRes.forEach(r => {
        const channel = r.booking_source || r.booking_type || 'Direct';
        if (!channelGroups[channel]) {
            channelGroups[channel] = {
                bookings: 0,
                revenue: 0,
                commission: 0
            };
        }
        channelGroups[channel].bookings++;
        channelGroups[channel].revenue += parseFloat(r.total_amount) || 0;
        channelGroups[channel].commission += parseFloat(r.ota_service_fee) || 0;
    });

    const channels = Object.keys(channelGroups);
    const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalCommission = activeRes.reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0);

    container.innerHTML = `
        <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Channel</th>
                    <th>Bookings</th>
                    <th>Revenue</th>
                    <th>Avg Value</th>
                    <th>Commission</th>
                    <th>Net Revenue</th>
                    <th>% Total</th>
                </tr>
            </thead>
            <tbody>
                ${channels.map(channel => {
                    const data = channelGroups[channel];
                    const avgValue = data.bookings > 0 ? data.revenue / data.bookings : 0;
                    const netRevenue = data.revenue - data.commission;
                    const percentage = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;

                    return `
                        <tr>
                            <td><strong>${channel}</strong></td>
                            <td>${data.bookings}</td>
                            <td><strong>${formatCurrency(data.revenue)}</strong></td>
                            <td>${formatCurrency(avgValue)}</td>
                            <td style="color: var(--danger);">${formatCurrency(data.commission)}</td>
                            <td style="color: var(--success);"><strong>${formatCurrency(netRevenue)}</strong></td>
                            <td>${formatPercentage(percentage)}</td>
                        </tr>
                    `;
                }).join('')}
                <tr style="font-weight: bold; background: var(--bg-secondary);">
                    <td>TOTAL</td>
                    <td>${activeRes.length}</td>
                    <td>${formatCurrency(totalRevenue)}</td>
                    <td>-</td>
                    <td>${formatCurrency(totalCommission)}</td>
                    <td>${formatCurrency(totalRevenue - totalCommission)}</td>
                    <td>100%</td>
                </tr>
            </tbody>
        </table>
        </div>
    `;
}

// Continue in next message due to length...
// Render Guest Analytics
function renderGuestAnalytics(reservations) {
    const container = document.getElementById('guestAnalytics');

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Calculate guest metrics
    const uniqueGuests = new Set();
    const guestBookings = {};

    activeRes.forEach(r => {
        const guestKey = r.guest_email || r.guest_phone || r.guest_name;
        if (guestKey) {
            uniqueGuests.add(guestKey);
            guestBookings[guestKey] = (guestBookings[guestKey] || 0) + 1;
        }
    });

    const totalUniqueGuests = uniqueGuests.size;
    const repeatGuests = Object.values(guestBookings).filter(count => count > 1).length;
    const repeatRate = totalUniqueGuests > 0 ? (repeatGuests / totalUniqueGuests) * 100 : 0;

    // Average party size (simplified - would need guest_count field)
    const avgPartySize = 4.2; // Placeholder

    // Guest lifetime value
    const totalRevenue = activeRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const guestLTV = totalUniqueGuests > 0 ? totalRevenue / totalUniqueGuests : 0;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                <span style="color: var(--text-secondary);">Total Unique Guests:</span>
                <strong>${totalUniqueGuests.toLocaleString()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                <span style="color: var(--text-secondary);">New Guests:</span>
                <strong>${(totalUniqueGuests - repeatGuests).toLocaleString()} (${(100 - repeatRate).toFixed(1)}%)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                <span style="color: var(--text-secondary);">Returning Guests:</span>
                <strong>${repeatGuests.toLocaleString()} (${repeatRate.toFixed(1)}%)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                <span style="color: var(--text-secondary);">Avg Party Size:</span>
                <strong>${avgPartySize.toFixed(1)} guests</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--bg-secondary); border-radius: 6px;">
                <span style="color: var(--text-secondary);">Guest Lifetime Value:</span>
                <strong>${formatCurrency(guestLTV)}</strong>
            </div>
        </div>
    `;
}

// Render Occupancy Analysis
function renderOccupancyAnalysis(reservations, properties) {
    const container = document.getElementById('occupancyAnalysis');

    const activeRes = reservations.filter(r => r.status !== 'cancelled');
    const totalNights = activeRes.reduce((sum, r) => sum + (r.nights || 0), 0);
    const targetNights = properties.length * 200; // 200 nights/year per property
    const currentOccupancy = targetNights > 0 ? (totalNights / targetNights) * 100 : 0;
    const targetOccupancy = 66; // Target based on 200 nights/year

    // Property occupancy breakdown
    const propertyOccupancy = properties.map(p => {
        const propRes = activeRes.filter(r => r.property_id == p.id);
        const nights = propRes.reduce((sum, r) => sum + (r.nights || 0), 0);
        const occ = (nights / 200) * 100;
        return { name: p.name, occupancy: occ };
    }).sort((a, b) => b.occupancy - a.occupancy);

    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Portfolio Occupancy</div>
            <div style="font-size: 32px; font-weight: bold; margin-bottom: 4px;">${currentOccupancy.toFixed(1)}%</div>
            <div style="font-size: 12px; color: var(--text-secondary);">
                Target: ${targetOccupancy}% ${currentOccupancy >= targetOccupancy ? '✅ On Target' : '⚠️ Below Target'}
            </div>
        </div>

        <div style="margin-top: 20px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Occupancy by Property:</div>
            ${propertyOccupancy.slice(0, 5).map(p => `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 12px;">${p.name}</span>
                        <span style="font-size: 12px; font-weight: 600;">${p.occupancy.toFixed(0)}%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${Math.min(p.occupancy, 100)}%; height: 100%; background: var(--primary);"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Render Property Comparison Table
function renderPropertyComparisonTable(reservations, properties, payments) {
    const tbody = document.getElementById('propertyComparisonTableBody');

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Calculate metrics for each property
    const propertyData = properties.map((property, idx) => {
        const propertyRes = activeRes.filter(r => r.property_id == property.id);
        const revenue = propertyRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const paid = propertyRes.reduce((sum, r) => sum + (parseFloat(r.paid_amount) || 0), 0);
        const bookings = propertyRes.length;
        const nights = propertyRes.reduce((sum, r) => sum + (r.nights || 0), 0);
        const occupancy = nights > 0 ? (nights / 200) * 100 : 0;
        const adr = nights > 0 ? revenue / nights : 0;
        const revPAN = revenue / 200;
        const collectionRate = revenue > 0 ? (paid / revenue) * 100 : 0;

        // Calculate score
        const revenueScore = Math.min((revenue / 1000000) * 100, 100) * 0.30;
        const occupancyScore = Math.min(occupancy, 100) * 0.25;
        const adrScore = Math.min((adr / 15000) * 100, 100) * 0.20;
        const bookingsScore = Math.min((bookings / 50) * 100, 100) * 0.15;
        const collectionScore = Math.min(collectionRate, 100) * 0.10;
        const score = Math.round(revenueScore + occupancyScore + adrScore + bookingsScore + collectionScore);

        return {
            rank: idx + 1,
            name: property.name,
            revenue,
            bookings,
            occupancy,
            adr,
            revPAN,
            collection: collectionRate,
            score
        };
    });

    // Sort by current sort field
    const sorted = [...propertyData].sort((a, b) => {
        const field = businessViewData.currentSort.field;
        const direction = businessViewData.currentSort.direction === 'asc' ? 1 : -1;
        return (a[field] - b[field]) * direction;
    });

    // Update ranks after sorting
    sorted.forEach((item, idx) => item.rank = idx + 1);

    tbody.innerHTML = sorted.map(p => {
        const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : '';
        const scoreColor = p.score >= 90 ? 'var(--success)' : p.score >= 70 ? 'var(--primary)' : 'var(--warning)';

        return `
            <tr>
                <td style="text-align: center;">${medal || p.rank}</td>
                <td><strong>${p.name}</strong></td>
                <td><strong>${formatCurrency(p.revenue)}</strong></td>
                <td>${p.bookings}</td>
                <td>${formatPercentage(p.occupancy)}</td>
                <td>${formatCurrency(p.adr)}</td>
                <td>${formatCurrency(p.revPAN)}</td>
                <td>${formatPercentage(p.collection)}</td>
                <td style="color: ${scoreColor}; font-weight: bold;">${p.score}/100</td>
            </tr>
        `;
    }).join('');
}

// Sort property comparison table
function sortPropertyComparison(field) {
    if (businessViewData.currentSort.field === field) {
        businessViewData.currentSort.direction = businessViewData.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        businessViewData.currentSort.field = field;
        businessViewData.currentSort.direction = 'desc';
    }

    renderPropertyComparisonTable(
        businessViewData.filteredData.reservations,
        businessViewData.filteredData.properties,
        businessViewData.filteredData.payments
    );
}

// Render Business Monthly Breakdown
function renderBusinessMonthlyBreakdown(reservations) {
    const container = document.getElementById('businessMonthlyBreakdown');

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Group by month
    const monthlyData = {};
    activeRes.forEach(r => {
        const checkIn = new Date(r.check_in);
        const monthKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { bookings: 0, revenue: 0, nights: 0 };
        }
        monthlyData[monthKey].bookings++;
        monthlyData[monthKey].revenue += parseFloat(r.total_amount) || 0;
        monthlyData[monthKey].nights += r.nights || 0;
    });

    const months = Object.keys(monthlyData).sort().reverse().slice(0, 12);

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Bookings</th>
                    <th>Nights</th>
                    <th>Revenue</th>
                    <th>Avg/Booking</th>
                </tr>
            </thead>
            <tbody>
                ${months.map(month => {
                    const data = monthlyData[month];
                    const avgBooking = data.bookings > 0 ? data.revenue / data.bookings : 0;

                    return `
                        <tr>
                            <td><strong>${formatMonthName(month)}</strong></td>
                            <td>${data.bookings}</td>
                            <td>${data.nights}</td>
                            <td><strong>${formatCurrency(data.revenue)}</strong></td>
                            <td>${formatCurrency(avgBooking)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// Continue in part 3...
// Render all Business Charts
function renderBusinessCharts(reservations, properties) {
    renderBusinessPropertyRevenueChart(reservations, properties);
    renderBusinessBookingTypeChart(reservations);
    renderBusinessChannelMixChart(reservations);
    renderBusinessMonthlyTrendChart(reservations);
}

// 1. Revenue by Property Chart (Horizontal Bar)

function renderBusinessPropertyRevenueChart(reservations, properties) {
    const canvas = document.getElementById('businessPropertyRevenueChart');
    if (!canvas) return;

    // Destroy existing chart
    if (businessCharts.propertyRevenue) {
        businessCharts.propertyRevenue.destroy();
    }

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Calculate revenue per property
    const propertyRevenue = properties.map(p => {
        const propRes = activeRes.filter(r => r.property_id == p.id);
        const revenue = propRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        return { name: p.name, revenue };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10); // Top 10

    businessCharts.propertyRevenue = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: propertyRevenue.map(p => p.name),
            datasets: [{
                label: 'Revenue',
                data: propertyRevenue.map(p => p.revenue),
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
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Revenue: ${formatCurrency(context.parsed.x)}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value)
                    }
                }
            }
        }
    });
}

// 2. Revenue by Booking Type Chart (Doughnut)
function renderBusinessBookingTypeChart(reservations) {
    const canvas = document.getElementById('businessBookingTypeChart');
    if (!canvas) return;

    // Destroy existing chart
    if (businessCharts.bookingType) {
        businessCharts.bookingType.destroy();
    }

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Group by booking type
    const typeRevenue = {};
    activeRes.forEach(r => {
        const type = r.booking_type || 'Unknown';
        typeRevenue[type] = (typeRevenue[type] || 0) + (parseFloat(r.total_amount) || 0);
    });

    const types = Object.keys(typeRevenue);
    const revenues = types.map(t => typeRevenue[t]);

    businessCharts.bookingType = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: types.map(t => BOOKING_TYPES[t]?.label || t),
            datasets: [{
                data: revenues,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(234, 179, 8, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(168, 85, 247, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed;
                            const total = revenues.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 3. Channel Mix Chart (Pie)
function renderBusinessChannelMixChart(reservations) {
    const canvas = document.getElementById('businessChannelMixChart');
    if (!canvas) return;

    // Destroy existing chart
    if (businessCharts.channelMix) {
        businessCharts.channelMix.destroy();
    }

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Group by channel
    const channelRevenue = {};
    activeRes.forEach(r => {
        const channel = r.booking_source || r.booking_type || 'Direct';
        channelRevenue[channel] = (channelRevenue[channel] || 0) + (parseFloat(r.total_amount) || 0);
    });

    const channels = Object.keys(channelRevenue);
    const revenues = channels.map(c => channelRevenue[c]);

    businessCharts.channelMix = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: channels,
            datasets: [{
                data: revenues,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(234, 179, 8, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(236, 72, 153, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed;
                            const total = revenues.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 4. Monthly Revenue Trend Chart (Line)
function renderBusinessMonthlyTrendChart(reservations) {
    const canvas = document.getElementById('businessMonthlyTrendChart');
    if (!canvas) return;

    // Destroy existing chart
    if (businessCharts.monthlyTrend) {
        businessCharts.monthlyTrend.destroy();
    }

    const activeRes = reservations.filter(r => r.status !== 'cancelled');

    // Group by month
    const monthlyData = {};
    activeRes.forEach(r => {
        const checkIn = new Date(r.check_in);
        const monthKey = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (parseFloat(r.total_amount) || 0);
    });

    const months = Object.keys(monthlyData).sort().slice(-12); // Last 12 months
    const revenues = months.map(m => monthlyData[m]);

    businessCharts.monthlyTrend = new Chart(canvas, {
        type: 'line',
        data: {
            labels: months.map(m => formatMonthName(m)),
            datasets: [{
                label: 'Revenue',
                data: revenues,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Revenue: ${formatCurrency(context.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value)
                    }
                }
            }
        }
    });
}

// Export Business View to Excel
function exportBusinessViewToExcel() {
    try {
        const data = businessViewData.filteredData;
        if (!data.reservations || data.reservations.length === 0) {
            showToast('Export Error', 'No data available to export', '❌');
            return;
        }

        const activeRes = data.reservations.filter(r => r.status !== 'cancelled');

        // Prepare CSV content
        let csv = '';

        // Header
        csv += `Business Analytics Report\n`;
        csv += `Generated: ${new Date().toLocaleString('en-IN')}\n`;
        csv += `Total Properties: ${data.properties.length}\n`;
        csv += `Total Bookings: ${activeRes.length}\n`;
        csv += `\n`;

        // Property Performance
        csv += `PROPERTY PERFORMANCE\n`;
        csv += `Property,Revenue,Bookings,Nights,Occupancy %,ADR,Score\n`;

        const propertyMetrics = data.properties.map(property => {
            const propertyRes = activeRes.filter(r => r.property_id == property.id);
            const revenue = propertyRes.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
            const bookings = propertyRes.length;
            const nights = propertyRes.reduce((sum, r) => sum + (r.nights || 0), 0);
            const occupancy = nights > 0 ? (nights / 200) * 100 : 0;
            const adr = nights > 0 ? revenue / nights : 0;
            const score = Math.round((revenue / 1000000) * 30 + occupancy * 0.25 + (adr / 15000) * 20);

            return { property, revenue, bookings, nights, occupancy, adr, score };
        }).sort((a, b) => b.score - a.score);

        propertyMetrics.forEach(m => {
            csv += `"${m.property.name}",`;
            csv += `₹${m.revenue.toLocaleString('en-IN')},`;
            csv += `${m.bookings},`;
            csv += `${m.nights},`;
            csv += `${m.occupancy.toFixed(1)}%,`;
            csv += `₹${m.adr.toLocaleString('en-IN')},`;
            csv += `${m.score}/100\n`;
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const fileName = `Business_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`;

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

// BUSINESS INTELLIGENCE FUNCTIONS
// ========================================

let biCharts = {}; // Store chart instances
let biData = {}; // Store current filtered data for sorting


async function loadBusinessIntelligence() {
    try {
        // Show loading state
        showLoadingState();

        // Handle custom date range visibility
        const dateRange = document.getElementById('biDateRange').value;
        const customFrom = document.getElementById('biCustomDateFrom');
        const customTo = document.getElementById('biCustomDateTo');

        if (dateRange === 'custom') {
            customFrom.style.display = 'block';
            customTo.style.display = 'block';
        } else {
            customFrom.style.display = 'none';
            customTo.style.display = 'none';
        }

        // Load data
        const reservations = await db.getReservations();
        const payments = await db.getAllPayments();
        const properties = await db.getProperties();

        // Filter by date range and payment method
        const filteredData = filterData(reservations, payments);

        // Store filtered data globally for sorting
        biData = {
            reservations: filteredData.reservations,
            payments: filteredData.payments,
            properties: properties
        };

        // Render all sections
        await renderBIKPICards(filteredData.reservations, filteredData.payments, properties);
        await renderBIPaymentHealth(filteredData.reservations, filteredData.payments);
        await renderBIAgingAnalysis(filteredData.reservations, filteredData.payments);
        await renderBIPaymentMethodPerformance(filteredData.payments);
        await renderBISmartInsights(filteredData.reservations, filteredData.payments, properties);
        await renderPropertyPayments(filteredData.reservations, filteredData.payments, properties);
        await renderPaymentMethodsChart(filteredData.payments);
        await renderPaymentTimelineChart(filteredData.payments);
        await renderChannelPayments(filteredData.reservations, filteredData.payments);
        await renderCollectionVelocity(filteredData.reservations, filteredData.payments);
        await renderFinancialSummary(filteredData.reservations, filteredData.payments);
        await renderRevenueCollectionChart(filteredData.reservations, filteredData.payments);

    } catch (error) {
        console.error('Error loading Business Intelligence:', error);
        showToast('Error', 'Failed to load Business Intelligence', '❌');
    }
}

function showLoadingState() {
    document.getElementById('biKPICards').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">Loading...</div>';
}

function filterData(reservations, payments) {
    const dateRange = document.getElementById('biDateRange').value;
    const paymentMethodFilter = document.getElementById('biPaymentMethodFilter').value;

    let filteredReservations = [...reservations];
    let filteredPayments = [...payments];

    // Date range filtering
    let startDate, endDate;
    const now = new Date();

    switch(dateRange) {
        case 'last30':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
            endDate = now;
            break;
        case 'last90':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
            endDate = now;
            break;
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'this_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = now;
            break;
        case 'custom':
            startDate = new Date(document.getElementById('biStartDate').value || '2020-01-01');
            endDate = new Date(document.getElementById('biEndDate').value || now);
            break;
        default: // all_time
            startDate = null;
            endDate = null;
    }

    if (startDate && endDate) {
        filteredReservations = filteredReservations.filter(r => {
            const checkIn = new Date(r.check_in);
            return checkIn >= startDate && checkIn <= endDate;
        });

        filteredPayments = filteredPayments.filter(p => {
            const paymentDate = new Date(p.payment_date);
            return paymentDate >= startDate && paymentDate <= endDate;
        });
    }

    // Payment method filtering
    if (paymentMethodFilter && paymentMethodFilter !== 'all') {
        filteredPayments = filteredPayments.filter(p =>
            (p.payment_method || 'cash') === paymentMethodFilter
        );
    }

    return { reservations: filteredReservations, payments: filteredPayments };
}

async function renderBIKPICards(reservations, payments, properties) {
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalCollected = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalPending = totalRevenue - totalCollected;
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue * 100) : 0;

    const avgCollectionDays = calculateAvgCollectionDays(reservations, payments);
    const activeProperties = properties.length;

    const kpis = [
        {
            icon: '💰',
            label: 'Total Revenue',
            value: `₹${(totalRevenue / 100000).toFixed(2)}L`,
            subtext: `${reservations.length} bookings`,
            color: '#0891b2',
            trend: 'up'
        },
        {
            icon: '✅',
            label: 'Collected',
            value: `₹${(totalCollected / 100000).toFixed(2)}L`,
            subtext: `${collectionRate.toFixed(1)}% collection rate`,
            color: '#10b981',
            trend: collectionRate >= 80 ? 'up' : 'down'
        },
        {
            icon: '⏳',
            label: 'Pending Collection',
            value: `₹${(totalPending / 100000).toFixed(2)}L`,
            subtext: `${(100 - collectionRate).toFixed(1)}% remaining`,
            color: totalPending > totalCollected ? '#ef4444' : '#f59e0b',
            trend: 'neutral'
        },
        {
            icon: '⚡',
            label: 'Avg Collection Time',
            value: `${avgCollectionDays} days`,
            subtext: avgCollectionDays <= 7 ? 'Excellent' : avgCollectionDays <= 15 ? 'Good' : 'Needs improvement',
            color: avgCollectionDays <= 7 ? '#10b981' : avgCollectionDays <= 15 ? '#f59e0b' : '#ef4444',
            trend: avgCollectionDays <= 7 ? 'up' : 'neutral'
        },
        {
            icon: '🏠',
            label: 'Active Properties',
            value: activeProperties,
            subtext: `${payments.length} transactions`,
            color: 'var(--primary)',
            trend: 'up'
        }
    ];

    const html = kpis.map(kpi => `
        <div class="card" style="background: linear-gradient(135deg, ${kpi.color}15 0%, ${kpi.color}05 100%); border-left: 4px solid ${kpi.color};">
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <span style="font-size: 32px;">${kpi.icon}</span>
                    <span style="font-size: 20px; color: ${kpi.color};">
                        ${kpi.trend === 'up' ? '↗' : kpi.trend === 'down' ? '↘' : '→'}
                    </span>
                </div>
                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                    ${kpi.value}
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
                    ${kpi.label}
                </div>
                <div style="font-size: 12px; color: ${kpi.color}; font-weight: 600;">
                    ${kpi.subtext}
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('biKPICards').innerHTML = html;
}

function calculateAvgCollectionDays(reservations, payments) {
    if (payments.length === 0) return 0;

    const daysArray = [];
    payments.forEach(payment => {
        const reservation = reservations.find(r => r.booking_id === payment.booking_id);
        if (reservation) {
            const checkIn = new Date(reservation.check_in);
            const paymentDate = new Date(payment.payment_date);
            const daysDiff = Math.floor((paymentDate - checkIn) / (1000 * 60 * 60 * 24));
            if (daysDiff >= 0) {
                daysArray.push(daysDiff);
            }
        }
    });

    if (daysArray.length === 0) return 0;
    const sum = daysArray.reduce((a, b) => a + b, 0);
    return Math.round(sum / daysArray.length);
}

async function renderBIPaymentHealth(reservations, payments) {
    // Calculate Payment Health Score (0-100) based on multiple factors
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalCollected = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue * 100) : 0;

    // Calculate aging score
    const now = new Date();
    let agingScore = 100;
    const pendingReservations = reservations.filter(r => {
        const paid = parseFloat(r.paid_amount) || 0;
        const total = parseFloat(r.total_amount) || 0;
        return paid < total;
    });

    if (pendingReservations.length > 0) {
        const avgAge = pendingReservations.reduce((sum, r) => {
            const checkIn = new Date(r.check_in);
            const days = Math.floor((now - checkIn) / (1000 * 60 * 60 * 24));
            return sum + days;
        }, 0) / pendingReservations.length;

        agingScore = Math.max(0, 100 - (avgAge * 2)); // Penalty: 2 points per day
    }

    // Calculate velocity score
    const avgCollectionDays = calculateAvgCollectionDays(reservations, payments);
    const velocityScore = Math.max(0, 100 - (avgCollectionDays * 3)); // Penalty: 3 points per day

    // Composite score (weighted average)
    const healthScore = Math.round(
        (collectionRate * 0.5) + (agingScore * 0.3) + (velocityScore * 0.2)
    );

    // Determine health status
    let status, statusColor, emoji, recommendation;
    if (healthScore >= 85) {
        status = 'Excellent';
        statusColor = '#10b981';
        emoji = '💚';
        recommendation = 'Your payment collection is performing exceptionally well!';
    } else if (healthScore >= 70) {
        status = 'Good';
        statusColor = '#3b82f6';
        emoji = '💙';
        recommendation = 'Solid performance. Focus on reducing collection time.';
    } else if (healthScore >= 55) {
        status = 'Fair';
        statusColor = '#f59e0b';
        emoji = '💛';
        recommendation = 'Room for improvement. Follow up on pending payments.';
    } else if (healthScore >= 40) {
        status = 'Poor';
        statusColor = '#ef4444';
        emoji = '🧡';
        recommendation = 'Immediate action needed. Review collection strategy.';
    } else {
        status = 'Critical';
        statusColor = '#dc2626';
        emoji = '❤️';
        recommendation = 'Urgent: Significant collection issues need attention.';
    }

    const html = `
        <div style="display: flex; align-items: center; gap: 32px; flex-wrap: wrap;">
            <!-- Health Score Circle -->
            <div style="position: relative; width: 160px; height: 160px;">
                <svg width="160" height="160" style="transform: rotate(-90deg);">
                    <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="12"/>
                    <circle cx="80" cy="80" r="70" fill="none" stroke="white" stroke-width="12"
                            stroke-dasharray="${(healthScore / 100) * 440} 440"
                            stroke-linecap="round"
                            style="transition: stroke-dasharray 1s ease;"/>
                </svg>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                    <div style="font-size: 48px; font-weight: 700; color: white;">${healthScore}</div>
                    <div style="font-size: 14px; color: rgba(255,255,255,0.9);">/ 100</div>
                </div>
            </div>

            <!-- Health Details -->
            <div style="flex: 1; min-width: 300px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 36px;">${emoji}</span>
                    <div>
                        <div style="font-size: 24px; font-weight: 700; color: white;">${status} Health</div>
                        <div style="font-size: 14px; color: rgba(255,255,255,0.8);">${recommendation}</div>
                    </div>
                </div>

                <!-- Score Breakdown -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 20px;">
                    <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">Collection Rate</div>
                        <div style="font-size: 20px; font-weight: 700; color: white;">${collectionRate.toFixed(1)}%</div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.6);">Weight: 50%</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">Aging Score</div>
                        <div style="font-size: 20px; font-weight: 700; color: white;">${Math.round(agingScore)}</div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.6);">Weight: 30%</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 4px;">Velocity Score</div>
                        <div style="font-size: 20px; font-weight: 700; color: white;">${Math.round(velocityScore)}</div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.6);">Weight: 20%</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('biPaymentHealth').innerHTML = html;
}

async function renderBIAgingAnalysis(reservations, payments) {
    // Calculate pending amount per reservation
    const now = new Date();
    const pendingItems = reservations.map(r => {
        const total = parseFloat(r.total_amount) || 0;
        const paid = parseFloat(r.paid_amount) || 0;
        const pending = total - paid;

        if (pending <= 0) return null;

        const checkIn = new Date(r.check_in);
        const daysOld = Math.floor((now - checkIn) / (1000 * 60 * 60 * 24));

        return {
            booking_id: r.booking_id,
            guest_name: r.guest_name || 'Unknown',
            total,
            paid,
            pending,
            daysOld,
            checkIn: r.check_in
        };
    }).filter(item => item !== null);

    // Categorize into 5 aging buckets
    const buckets = {
        current: { label: 'Current (0-7 days)', items: [], color: '#10b981', icon: '✅', action: 'Monitor' },
        week2: { label: 'Week 2 (8-15 days)', items: [], color: '#3b82f6', icon: '📧', action: 'Send reminder' },
        week3plus: { label: 'Weeks 3-4 (16-30 days)', items: [], color: '#f59e0b', icon: '📞', action: 'Call guest' },
        month2: { label: 'Month 2 (31-60 days)', items: [], color: '#ef4444', icon: '⚠️', action: 'Escalate' },
        overdue: { label: '60+ days overdue', items: [], color: '#dc2626', icon: '🚨', action: 'Legal action' }
    };

    pendingItems.forEach(item => {
        if (item.daysOld <= 7) buckets.current.items.push(item);
        else if (item.daysOld <= 15) buckets.week2.items.push(item);
        else if (item.daysOld <= 30) buckets.week3plus.items.push(item);
        else if (item.daysOld <= 60) buckets.month2.items.push(item);
        else buckets.overdue.items.push(item);
    });

    const html = Object.values(buckets).map(bucket => {
        const count = bucket.items.length;
        const amount = bucket.items.reduce((sum, item) => sum + item.pending, 0);

        if (count === 0) return '';

        return `
            <div style="margin-bottom: 20px; border-left: 4px solid ${bucket.color}; background: ${bucket.color}10; padding: 16px; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 24px;">${bucket.icon}</span>
                        <div>
                            <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${bucket.label}</div>
                            <div style="font-size: 13px; color: var(--text-secondary);">${count} booking${count > 1 ? 's' : ''} • ₹${(amount / 100000).toFixed(2)}L pending</div>
                        </div>
                    </div>
                    <div style="padding: 6px 16px; background: ${bucket.color}; color: white; border-radius: 20px; font-size: 13px; font-weight: 600;">
                        ${bucket.action}
                    </div>
                </div>

                ${bucket.items.length <= 3 ? `
                    <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                        ${bucket.items.map(item => `
                            <div style="padding: 10px; background: white; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                                <div>
                                    <span style="font-weight: 600;">${item.guest_name}</span>
                                    <span style="color: var(--text-secondary);">• ${item.booking_id}</span>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 600; color: ${bucket.color};">₹${(item.pending / 1000).toFixed(1)}k</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${item.daysOld} days old</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                        Click to view ${bucket.items.length} pending bookings
                    </div>
                `}
            </div>
        `;
    }).join('');

    document.getElementById('biAgingAnalysis').innerHTML = html || '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">No pending payments</div>';
}

async function renderBIPaymentMethodPerformance(payments) {
    if (payments.length === 0) {
        document.getElementById('biPaymentMethodPerformance').innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">No payment data available</div>';
        return;
    }

    // Aggregate payment method statistics
    const methodStats = {};
    const methodNames = {
        'cash': 'Cash',
        'upi': 'UPI',
        'gateway': 'Payment Gateway',
        'bank_transfer': 'Bank Transfer',
        'wallet': 'E-Wallet'
    };

    payments.forEach(p => {
        const method = p.payment_method || 'cash';
        if (!methodStats[method]) {
            methodStats[method] = {
                count: 0,
                totalAmount: 0,
                dates: []
            };
        }
        methodStats[method].count++;
        methodStats[method].totalAmount += parseFloat(p.amount) || 0;
        methodStats[method].dates.push(new Date(p.payment_date));
    });

    // Calculate metrics for each method
    const methodPerformance = Object.entries(methodStats).map(([method, stats]) => {
        // Calculate average transaction size
        const avgTransaction = stats.totalAmount / stats.count;

        // Calculate average processing time (simulated - in real app, track actual time)
        const avgProcessingTime = method === 'upi' ? '< 1 min' :
                                method === 'gateway' ? '2-3 mins' :
                                method === 'cash' ? 'Instant' :
                                method === 'bank_transfer' ? '1-2 days' :
                                '5-10 mins';

        // Calculate success rate (simulated - in real app, track failed payments)
        const successRate = method === 'upi' ? 98.5 :
                          method === 'gateway' ? 97.2 :
                          method === 'cash' ? 100 :
                          method === 'bank_transfer' ? 99.1 :
                          95.8;

        // Processing cost estimate
        const costPercentage = method === 'upi' ? 0 :
                             method === 'gateway' ? 2.5 :
                             method === 'cash' ? 0 :
                             method === 'bank_transfer' ? 0 :
                             1.5;

        return {
            method,
            name: methodNames[method] || method,
            count: stats.count,
            totalAmount: stats.totalAmount,
            avgTransaction,
            avgProcessingTime,
            successRate,
            costPercentage,
            share: (stats.count / payments.length * 100)
        };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    const html = `
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: var(--bg-secondary); border-bottom: 2px solid var(--border);">
                        <th style="padding: 12px; text-align: left; font-weight: 600;">Payment Method</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600;">Transactions</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600;">Total Amount</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600;">Avg. Transaction</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Processing Time</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Success Rate</th>
                        <th style="padding: 12px; text-align: center; font-weight: 600;">Cost</th>
                        <th style="padding: 12px; text-align: right; font-weight: 600;">Share</th>
                    </tr>
                </thead>
                <tbody>
                    ${methodPerformance.map((m, idx) => `
                        <tr style="border-bottom: 1px solid var(--border); ${idx % 2 === 0 ? 'background: var(--bg-secondary);' : ''}">
                            <td style="padding: 12px;">
                                <div style="font-weight: 600;">${m.name}</div>
                            </td>
                            <td style="padding: 12px; text-align: right;">${m.count}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600;">₹${(m.totalAmount / 100000).toFixed(2)}L</td>
                            <td style="padding: 12px; text-align: right;">₹${(m.avgTransaction / 1000).toFixed(1)}k</td>
                            <td style="padding: 12px; text-align: center;">
                                <span style="padding: 4px 8px; background: ${m.avgProcessingTime.includes('day') ? '#fef3c7' : m.avgProcessingTime.includes('min') && !m.avgProcessingTime.includes('<') ? '#dbeafe' : '#d1fae5'}; border-radius: 4px; font-size: 12px;">
                                    ${m.avgProcessingTime}
                                </span>
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <span style="color: ${m.successRate >= 99 ? '#10b981' : m.successRate >= 97 ? '#3b82f6' : '#f59e0b'}; font-weight: 600;">
                                    ${m.successRate.toFixed(1)}%
                                </span>
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <span style="color: ${m.costPercentage === 0 ? '#10b981' : m.costPercentage < 2 ? '#f59e0b' : '#ef4444'}; font-weight: 600;">
                                    ${m.costPercentage === 0 ? 'Free' : m.costPercentage + '%'}
                                </span>
                            </td>
                            <td style="padding: 12px; text-align: right;">
                                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                                    <div style="flex: 0 0 60px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: var(--gradient-primary); width: ${m.share}%;"></div>
                                    </div>
                                    <span style="font-weight: 600; min-width: 45px;">${m.share.toFixed(1)}%</span>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Key Recommendations -->
        <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #0891b215, #06b6d415); border-radius: 8px; border-left: 4px solid #0891b2;">
            <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <span><i data-lucide="lightbulb" style="width: 16px; height: 16px;"></i></span> Recommendations
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                ${methodPerformance[0].method === 'cash' ?
                    '• Consider promoting digital payment methods to reduce cash handling costs and risks.' :
                    '• ' + methodPerformance[0].name + ' is your top payment method. Ensure it\'s prominently displayed at checkout.'}
                <br>
                ${methodPerformance.some(m => m.method === 'gateway' && m.costPercentage > 2) ?
                    '• Payment gateway fees are 2.5%. Consider negotiating better rates or exploring alternatives for high-value transactions.' :
                    '• Monitor transaction success rates and address any payment failures promptly.'}
            </div>
        </div>
    `;

    document.getElementById('biPaymentMethodPerformance').innerHTML = html;
}

async function renderBISmartInsights(reservations, payments, properties) {
    const insights = [];

    // Pending payments over 30 days
    const now = new Date();
    const oldPendingReservations = reservations.filter(r => {
        const checkIn = new Date(r.check_in);
        const daysSince = Math.floor((now - checkIn) / (1000 * 60 * 60 * 24));
        const paid = parseFloat(r.paid_amount) || 0;
        const total = parseFloat(r.total_amount) || 0;
        return daysSince > 30 && paid < total;
    });

    if (oldPendingReservations.length > 0) {
        const totalOldPending = oldPendingReservations.reduce((sum, r) =>
            sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)), 0
        );
        insights.push({
            type: 'alert',
            icon: '🔴',
            text: `${oldPendingReservations.length} bookings have pending payments over 30 days old (₹${(totalOldPending/100000).toFixed(2)}L)`
        });
    }

    // Collection rate analysis
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalCollected = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const collectionRate = totalRevenue > 0 ? (totalCollected / totalRevenue * 100) : 0;

    if (collectionRate >= 90) {
        insights.push({
            type: 'success',
            icon: '🟢',
            text: `Excellent collection rate of ${collectionRate.toFixed(1)}%! Keep it up.`
        });
    } else if (collectionRate < 70) {
        insights.push({
            type: 'warning',
            icon: '🟡',
            text: `Collection rate is ${collectionRate.toFixed(1)}%. Consider follow-ups to improve collections.`
        });
    }

    // Payment method preference
    const paymentMethods = {};
    payments.forEach(p => {
        const method = p.payment_method || 'cash';
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });
    const topMethod = Object.entries(paymentMethods).sort((a, b) => b[1] - a[1])[0];
    if (topMethod) {
        const methodNames = { cash: 'Cash', upi: 'UPI', gateway: 'Payment Gateway', bank_transfer: 'Bank Transfer' };
        insights.push({
            type: 'info',
            icon: '💳',
            text: `${methodNames[topMethod[0]] || topMethod[0]} is the most used payment method (${topMethod[1]} transactions)`
        });
    }

    // Best performing property
    const propertyRevenue = {};
    reservations.forEach(r => {
        const propId = r.property_id;
        propertyRevenue[propId] = (propertyRevenue[propId] || 0) + (parseFloat(r.total_amount) || 0);
    });
    const topProperty = Object.entries(propertyRevenue).sort((a, b) => b[1] - a[1])[0];
    if (topProperty) {
        const prop = properties.find(p => p.id == topProperty[0]);
        if (prop) {
            insights.push({
                type: 'success',
                icon: '🏆',
                text: `${prop.name} is your top performer with ₹${(topProperty[1]/100000).toFixed(2)}L in revenue`
            });
        }
    }

    // ML-Based Insights: Payment velocity trend
    const avgCollectionDays = calculateAvgCollectionDays(reservations, payments);
    if (avgCollectionDays > 15) {
        insights.push({
            type: 'warning',
            icon: '⏱️',
            text: `Average collection time is ${avgCollectionDays} days. Consider implementing advance payment requirements to improve cash flow.`
        });
    } else if (avgCollectionDays <= 5) {
        insights.push({
            type: 'success',
            icon: '⚡',
            text: `Outstanding! Payments are collected in ${avgCollectionDays} days on average. Your collection process is highly efficient.`
        });
    }

    // Pattern Detection: Weekend vs Weekday payment behavior
    const weekendPayments = payments.filter(p => {
        const day = new Date(p.payment_date).getDay();
        return day === 0 || day === 6;
    });
    const weekendShare = payments.length > 0 ? (weekendPayments.length / payments.length * 100) : 0;
    if (weekendShare > 40) {
        insights.push({
            type: 'info',
            icon: '📅',
            text: `${weekendShare.toFixed(0)}% of payments occur on weekends. Consider offering weekend-specific payment incentives.`
        });
    }

    // Cash Flow Prediction: Pending payments expected timeline
    const pendingReservations = reservations.filter(r => {
        const paid = parseFloat(r.paid_amount) || 0;
        const total = parseFloat(r.total_amount) || 0;
        return paid < total;
    });
    if (pendingReservations.length > 0) {
        const totalPending = pendingReservations.reduce((sum, r) =>
            sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)), 0
        );
        const recentBookings = pendingReservations.filter(r => {
            const checkIn = new Date(r.check_in);
            const days = Math.floor((now - checkIn) / (1000 * 60 * 60 * 24));
            return days <= 7;
        });

        if (recentBookings.length > 0) {
            const recentPending = recentBookings.reduce((sum, r) =>
                sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)), 0
            );
            insights.push({
                type: 'info',
                icon: '💰',
                text: `Expected inflow: ₹${(recentPending/100000).toFixed(2)}L from ${recentBookings.length} recent bookings likely to be collected soon.`
            });
        }
    }

    // Anomaly Detection: Large pending amounts
    const largePendingBookings = reservations.filter(r => {
        const pending = (parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0);
        return pending > 50000; // More than 50k pending
    });
    if (largePendingBookings.length > 0) {
        const totalLargePending = largePendingBookings.reduce((sum, r) =>
            sum + ((parseFloat(r.total_amount) || 0) - (parseFloat(r.paid_amount) || 0)), 0
        );
        insights.push({
            type: 'alert',
            icon: '💸',
            text: `${largePendingBookings.length} booking${largePendingBookings.length > 1 ? 's have' : ' has'} large pending amounts (₹${(totalLargePending/100000).toFixed(2)}L). Priority follow-up recommended.`
        });
    }

    // Trend Analysis: Month-over-month collection improvement
    if (payments.length >= 10) {
        const sortedPayments = [...payments].sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));
        const midPoint = Math.floor(sortedPayments.length / 2);
        const firstHalf = sortedPayments.slice(0, midPoint);
        const secondHalf = sortedPayments.slice(midPoint);

        const firstHalfTotal = firstHalf.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const secondHalfTotal = secondHalf.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        if (secondHalfTotal > firstHalfTotal * 1.2) {
            const improvement = ((secondHalfTotal - firstHalfTotal) / firstHalfTotal * 100);
            insights.push({
                type: 'success',
                icon: '📈',
                text: `Collection trend is positive! Recent period shows ${improvement.toFixed(0)}% increase in payment collection.`
            });
        } else if (secondHalfTotal < firstHalfTotal * 0.8) {
            const decline = ((firstHalfTotal - secondHalfTotal) / firstHalfTotal * 100);
            insights.push({
                type: 'warning',
                icon: '📉',
                text: `Collection trend declining by ${decline.toFixed(0)}%. Review and optimize your payment collection strategy.`
            });
        }
    }

    // Smart Recommendation: Payment method optimization
    if (payments.length > 5) {
        const cashPayments = payments.filter(p => (p.payment_method || 'cash') === 'cash');
        const cashShare = (cashPayments.length / payments.length * 100);

        if (cashShare > 60) {
            insights.push({
                type: 'info',
                icon: '🔄',
                text: `${cashShare.toFixed(0)}% of payments are in cash. Promoting digital payments could reduce handling costs and improve tracking.`
            });
        } else if (cashShare < 20) {
            insights.push({
                type: 'success',
                icon: '📱',
                text: `Excellent digital payment adoption at ${(100-cashShare).toFixed(0)}%! This reduces cash handling and improves transaction tracking.`
            });
        }
    }

    // If no insights, show a default message
    if (insights.length === 0) {
        insights.push({
            type: 'info',
            icon: '📊',
            text: 'Keep monitoring your metrics for data-driven insights. More data will enable predictive recommendations.'
        });
    }

    const html = insights.map(insight => {
        const bgColor = insight.type === 'alert' ? 'rgba(239, 68, 68, 0.2)' :
                       insight.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' :
                       insight.type === 'success' ? 'rgba(16, 185, 129, 0.2)' :
                       'rgba(255, 255, 255, 0.2)';
        return `
            <div style="padding: 16px; background: ${bgColor}; border-radius: 12px; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">${insight.icon}</span>
                <span style="font-size: 14px; line-height: 1.5;">${insight.text}</span>
            </div>
        `;
    }).join('');

    document.getElementById('biSmartInsights').innerHTML = html;
}

async function renderPropertyPayments(reservations, payments, properties, sortBy = 'collected_desc') {
    const propertyData = {};

    // Aggregate by property
    properties.forEach(prop => {
        propertyData[prop.id] = {
            name: prop.name,
            totalRevenue: 0,
            totalCollected: 0,
            transactionCount: 0
        };
    });

    reservations.forEach(r => {
        if (propertyData[r.property_id]) {
            propertyData[r.property_id].totalRevenue += parseFloat(r.total_amount) || 0;
        }
    });

    payments.forEach(p => {
        const reservation = reservations.find(r => r.booking_id === p.booking_id);
        if (reservation && propertyData[reservation.property_id]) {
            propertyData[reservation.property_id].totalCollected += parseFloat(p.amount) || 0;
            propertyData[reservation.property_id].transactionCount++;
        }
    });

    // Apply sorting
    let sortedProperties = Object.entries(propertyData)
        .map(([id, data]) => ({
            id,
            ...data,
            collectionRate: data.totalRevenue > 0 ? (data.totalCollected / data.totalRevenue * 100) : 0
        }));

    switch(sortBy) {
        case 'collected_asc':
            sortedProperties.sort((a, b) => a.totalCollected - b.totalCollected);
            break;
        case 'collected_desc':
            sortedProperties.sort((a, b) => b.totalCollected - a.totalCollected);
            break;
        case 'revenue_asc':
            sortedProperties.sort((a, b) => a.totalRevenue - b.totalRevenue);
            break;
        case 'revenue_desc':
            sortedProperties.sort((a, b) => b.totalRevenue - a.totalRevenue);
            break;
        case 'rate_asc':
            sortedProperties.sort((a, b) => a.collectionRate - b.collectionRate);
            break;
        case 'rate_desc':
            sortedProperties.sort((a, b) => b.collectionRate - a.collectionRate);
            break;
        case 'name_asc':
            sortedProperties.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name_desc':
            sortedProperties.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    const html = sortedProperties.map((prop, index) => {
        const collectionRate = prop.totalRevenue > 0 ? (prop.totalCollected / prop.totalRevenue * 100) : 0;
        const pending = prop.totalRevenue - prop.totalCollected;
        const barColor = collectionRate >= 80 ? '#10b981' : collectionRate >= 60 ? '#f59e0b' : '#ef4444';

        return `
            <div style="padding: 16px; border-bottom: 1px solid var(--border); ${index === sortedProperties.length - 1 ? 'border-bottom: none;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: 600; font-size: 15px;">${index + 1}. ${prop.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${prop.transactionCount} transactions</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; font-size: 16px; color: #10b981;">₹${(prop.totalCollected/100000).toFixed(2)}L</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">of ₹${(prop.totalRevenue/100000).toFixed(2)}L</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="flex: 1; background: var(--background); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${collectionRate}%; height: 100%; background: ${barColor}; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: ${barColor}; min-width: 45px; text-align: right;">
                        ${collectionRate.toFixed(0)}%
                    </div>
                </div>
                ${pending > 0 ? `
                    <div style="margin-top: 6px; font-size: 11px; color: #ef4444;">
                        Pending: ₹${(pending/100000).toFixed(2)}L
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    document.getElementById('biPropertyPayments').innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--text-secondary);">No data available</div>';
}

// Wrapper function for sorting
async function renderPropertyPaymentsWithSort() {
    if (!biData.reservations || !biData.payments || !biData.properties) return;

    const sortBy = document.getElementById('biPropertySort').value;
    await renderPropertyPayments(biData.reservations, biData.payments, biData.properties, sortBy);
}

async function renderPaymentMethodsChart(payments) {
    const methodData = {
        cash: { count: 0, amount: 0, label: 'Cash', color: '#10b981' },
        upi: { count: 0, amount: 0, label: 'UPI', color: '#3b82f6' },
        gateway: { count: 0, amount: 0, label: 'Gateway', color: 'var(--primary)' },
        bank_transfer: { count: 0, amount: 0, label: 'Bank Transfer', color: '#f59e0b' }
    };

    payments.forEach(p => {
        const method = p.payment_method || 'cash';
        if (methodData[method]) {
            methodData[method].count++;
            methodData[method].amount += parseFloat(p.amount) || 0;
        }
    });

    const ctx = document.getElementById('biPaymentMethodsChart');
    if (!ctx) return;

    // Destroy previous chart if exists
    if (biCharts.paymentMethods) {
        biCharts.paymentMethods.destroy();
    }

    const labels = Object.values(methodData).map(m => m.label);
    const data = Object.values(methodData).map(m => m.amount);
    const colors = Object.values(methodData).map(m => m.color);

    biCharts.paymentMethods = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12 },
                        generateLabels: function(chart) {
                            const data = chart.data;
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                const count = Object.values(methodData)[i].count;
                                return {
                                    text: `${label}: ₹${(value/100000).toFixed(2)}L (${count})`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ₹${value.toLocaleString('en-IN')}`;
                        }
                    }
                }
            }
        }
    });
}

async function renderPaymentTimelineChart(payments) {
    // Group payments by date
    const dateData = {};
    payments.forEach(p => {
        const date = new Date(p.payment_date).toISOString().split('T')[0];
        dateData[date] = (dateData[date] || 0) + (parseFloat(p.amount) || 0);
    });

    // Sort by date
    const sortedDates = Object.keys(dateData).sort();
    const amounts = sortedDates.map(date => dateData[date]);

    const ctx = document.getElementById('biPaymentTimelineChart');
    if (!ctx) return;

    // Destroy previous chart if exists
    if (biCharts.paymentTimeline) {
        biCharts.paymentTimeline.destroy();
    }

    biCharts.paymentTimeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates.map(d => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'Payment Collection',
                data: amounts,
                borderColor: '#0891b2',
                backgroundColor: 'rgba(8, 145, 178, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `₹${context.parsed.y.toLocaleString('en-IN')}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + (value/100000).toFixed(1) + 'L';
                        }
                    }
                }
            }
        }
    });
}

async function renderChannelPayments(reservations, payments) {
    const channelData = {};

    reservations.forEach(r => {
        const channel = r.booking_source || 'DIRECT';
        if (!channelData[channel]) {
            channelData[channel] = { revenue: 0, collected: 0, bookings: 0 };
        }
        channelData[channel].revenue += parseFloat(r.total_amount) || 0;
        channelData[channel].bookings++;
    });

    payments.forEach(p => {
        const reservation = reservations.find(r => r.booking_id === p.booking_id);
        if (reservation) {
            const channel = reservation.booking_source || 'DIRECT';
            if (channelData[channel]) {
                channelData[channel].collected += parseFloat(p.amount) || 0;
            }
        }
    });

    const channelColors = {
        'DIRECT': '#3b82f6',
        'AIRBNB': '#ef4444',
        'AGODA/BOOKING.COM': '#1e3a8a',
        'MMT/GOIBIBO': '#f59e0b',
        'OTHER': '#6b7280'
    };

    const sortedChannels = Object.entries(channelData)
        .sort((a, b) => b[1].collected - a[1].collected);

    const html = sortedChannels.map(([channel, data]) => {
        const collectionRate = data.revenue > 0 ? (data.collected / data.revenue * 100) : 0;
        const color = channelColors[channel] || '#6b7280';

        return `
            <div style="padding: 16px; border-bottom: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: 600; font-size: 14px;">${channel}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${data.bookings} bookings</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; font-size: 15px; color: ${color};">₹${(data.collected/100000).toFixed(2)}L</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${collectionRate.toFixed(0)}% collected</div>
                    </div>
                </div>
                <div style="background: var(--background); height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${collectionRate}%; height: 100%; background: ${color};"></div>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('biChannelPayments').innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--text-secondary);">No data available</div>';
}

async function renderCollectionVelocity(reservations, payments) {
    // Calculate velocity metrics
    let totalDays = 0;
    let count = 0;
    const velocityByProperty = {};

    payments.forEach(p => {
        const reservation = reservations.find(r => r.booking_id === p.booking_id);
        if (reservation) {
            const checkIn = new Date(reservation.check_in);
            const paymentDate = new Date(p.payment_date);
            const days = Math.floor((paymentDate - checkIn) / (1000 * 60 * 60 * 24));

            if (days >= 0) {
                totalDays += days;
                count++;

                const propId = reservation.property_id;
                if (!velocityByProperty[propId]) {
                    velocityByProperty[propId] = { totalDays: 0, count: 0, name: reservation.property_name };
                }
                velocityByProperty[propId].totalDays += days;
                velocityByProperty[propId].count++;
            }
        }
    });

    const avgDays = count > 0 ? Math.round(totalDays / count) : 0;

    const html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px;">
            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #0891b215 0%, #06b6d405 100%); border-radius: 12px;">
                <div style="font-size: 48px; font-weight: 700; color: #0891b2; margin-bottom: 8px;">${avgDays}</div>
                <div style="font-size: 14px; color: var(--text-secondary);">Avg Days to Collect</div>
                <div style="font-size: 12px; color: ${avgDays <= 7 ? '#10b981' : avgDays <= 15 ? '#f59e0b' : '#ef4444'}; font-weight: 600; margin-top: 4px;">
                    ${avgDays <= 7 ? '🟢 Excellent' : avgDays <= 15 ? '🟡 Good' : '🔴 Needs Improvement'}
                </div>
            </div>
            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #10b98115 0%, #05966905 100%); border-radius: 12px;">
                <div style="font-size: 48px; font-weight: 700; color: #10b981; margin-bottom: 8px;">${count}</div>
                <div style="font-size: 14px; color: var(--text-secondary);">Total Transactions</div>
                <div style="font-size: 12px; color: #10b981; font-weight: 600; margin-top: 4px;">Analyzed</div>
            </div>
        </div>

        <div style="margin-top: 24px;">
            <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 16px; color: var(--text-secondary);">Collection Velocity by Property</h4>
            <div style="display: grid; gap: 12px;">
                ${Object.values(velocityByProperty).map(prop => {
                    const avg = Math.round(prop.totalDays / prop.count);
                    const score = avg <= 7 ? 100 : avg <= 15 ? 75 : avg <= 30 ? 50 : 25;
                    const color = avg <= 7 ? '#10b981' : avg <= 15 ? '#f59e0b' : '#ef4444';
                    return `
                        <div style="padding: 12px; background: var(--background); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 13px; font-weight: 500;">${prop.name}</span>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 12px; color: var(--text-secondary);">${prop.count} payments</span>
                                <span style="font-size: 14px; font-weight: 700; color: ${color};">${avg} days</span>
                                <div style="width: 60px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${score}%; height: 100%; background: ${color};"></div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.getElementById('biCollectionVelocity').innerHTML = html;
}

async function renderFinancialSummary(reservations, payments) {
    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
    const totalCollected = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalPending = totalRevenue - totalCollected;
    const otaFees = reservations.reduce((sum, r) => sum + (parseFloat(r.ota_service_fee) || 0), 0);
    const totalHostPayout = reservations.reduce((sum, r) => sum + getHostPayout(r), 0);
    const hostizzyRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.hostizzy_revenue) || 0), 0);
    const ownerRevenue = totalHostPayout - hostizzyRevenue;

    const metrics = [
        { label: 'Gross Revenue', value: totalRevenue, color: '#0891b2', icon: '💰' },
        { label: 'OTA Fees', value: otaFees, color: '#ef4444', icon: '💸' },
        { label: 'Host Payout', value: totalHostPayout, color: '#10b981', icon: '💵' },
        { label: 'Collected', value: totalCollected, color: '#10b981', icon: '✅' },
        { label: 'Pending', value: totalPending, color: '#f59e0b', icon: '⏳' },
        { label: 'Hostizzy Share', value: hostizzyRevenue, color: 'var(--primary)', icon: '🏢' },
        { label: 'Owner Share', value: ownerRevenue, color: '#3b82f6', icon: '🏠' }
    ];

    const html = metrics.map(metric => `
        <div style="padding: 20px; background: linear-gradient(135deg, ${metric.color}15 0%, ${metric.color}05 100%); border-radius: 12px; border-left: 4px solid ${metric.color};">
            <div style="font-size: 24px; margin-bottom: 8px;">${metric.icon}</div>
            <div style="font-size: 22px; font-weight: 700; color: ${metric.color}; margin-bottom: 4px;">
                ₹${(metric.value / 100000).toFixed(2)}L
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">
                ${metric.label}
            </div>
        </div>
    `).join('');

    document.getElementById('biFinancialSummary').innerHTML = html;
}

async function renderRevenueCollectionChart(reservations, payments) {
    // Group by month
    const monthlyData = {};

    reservations.forEach(r => {
        const month = r.month || new Date(r.check_in).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, collected: 0 };
        }
        monthlyData[month].revenue += parseFloat(r.total_amount) || 0;
    });

    payments.forEach(p => {
        const reservation = reservations.find(r => r.booking_id === p.booking_id);
        if (reservation) {
            const month = reservation.month || new Date(reservation.check_in).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
            if (monthlyData[month]) {
                monthlyData[month].collected += parseFloat(p.amount) || 0;
            }
        }
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const revenueData = sortedMonths.map(m => monthlyData[m].revenue);
    const collectedData = sortedMonths.map(m => monthlyData[m].collected);

    const ctx = document.getElementById('biRevenueCollectionChart');
    if (!ctx) return;

    // Destroy previous chart if exists
    if (biCharts.revenueCollection) {
        biCharts.revenueCollection.destroy();
    }

    biCharts.revenueCollection = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMonths,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenueData,
                    backgroundColor: 'rgba(8, 145, 178, 0.7)',
                    borderColor: '#0891b2',
                    borderWidth: 1
                },
                {
                    label: 'Collected',
                    data: collectedData,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15, font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString('en-IN')}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + (value/100000).toFixed(1) + 'L';
                        }
                    }
                }
            }
        }
    });
}

function refreshBusinessIntelligence() {
    loadBusinessIntelligence();
    showToast('Refreshed', 'Business Intelligence data reloaded', '🔄');
}

// ========================================
// END BUSINESS INTELLIGENCE FUNCTIONS
// ========================================
