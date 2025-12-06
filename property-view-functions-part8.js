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
            const dateKey = currentDate.toISOString().split('T')[0];
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
        const date = new Date(year, monthIndex, day);
        const dateKey = date.toISOString().split('T')[0];
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
        const isToday = date.toDateString() === today.toDateString();

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
