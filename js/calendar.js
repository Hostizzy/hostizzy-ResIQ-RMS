// ResIQ Calendar — Availability calendar, property calendar view

async function showPropertyCalendar(propertyId) {
    try {
        // Switch to availability view using the correct function
        showView('availability');
        
        // Small delay to let the view switch complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Set property filter
        const propertyFilter = document.getElementById('calendarPropertyFilter');
        if (propertyFilter) {
            propertyFilter.value = propertyId;
        }
        
        // Load calendar with filter
        await loadAvailabilityCalendar();
        
        // Scroll to calendar
        const availabilityView = document.getElementById('availabilityView');
        if (availabilityView) {
            availabilityView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
    } catch (error) {
        console.error('Error showing property calendar:', error);
        showToast('Failed to open calendar', 'error');
    }
}

/**
 * Set calendar view mode (single property or multi-property)
 */
async function loadAvailabilityCalendar() {
    const reservations = await db.getReservations();
    const properties = await db.getProperties();

    // Populate property filter dropdown
    const propertyFilter = document.getElementById('calendarPropertyFilter');
    if (propertyFilter && propertyFilter.children.length === 1) {
        propertyFilter.innerHTML = '<option value="">All Properties</option>' +
            properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // Single property view only
    currentPropertyFilter = propertyFilter.value;

    let filteredReservations = reservations.filter(r => r.status !== 'cancelled');
    if (currentPropertyFilter) {
        filteredReservations = filteredReservations.filter(r => r.property_id == currentPropertyFilter);
    }

    // Fetch synced availability dates (OTA blocked dates)
    let syncedDates = [];
    try {
        if (currentPropertyFilter) {
            const { data: syncedData, error: syncError } = await supabase
                .from('synced_availability')
                .select('*')
                .eq('property_id', currentPropertyFilter);

            if (!syncError && syncedData) {
                syncedDates = syncedData;
            }
        }
    } catch (error) {
        console.error('Error fetching synced dates:', error);
    }

    renderCalendar(filteredReservations, syncedDates);
}

function renderCalendar(reservations, syncedDates = []) {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendarMonthYear').textContent = `${monthNames[month]} ${year}`;
    
    // Build bookings map (direct bookings)
    // NOTE: Check-out date is NOT blocked (industry standard - available for new bookings)
    const bookingsMap = {};
    const checkoutMap = {}; // Track checkout dates separately for visual indicators

    reservations.forEach(r => {
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);
        let currentDate = new Date(checkIn);

        // Loop from check-in to (check-out - 1) - checkout date remains available
        while (currentDate < checkOut) {
            if (currentDate.getMonth() === month && currentDate.getFullYear() === year) {
                const day = currentDate.getDate();
                if (!bookingsMap[day]) bookingsMap[day] = [];
                bookingsMap[day].push(r);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Track checkout date separately (for visual indicator only)
        if (checkOut.getMonth() === month && checkOut.getFullYear() === year) {
            const checkoutDay = checkOut.getDate();
            if (!checkoutMap[checkoutDay]) checkoutMap[checkoutDay] = [];
            checkoutMap[checkoutDay].push(r);
        }
    });
    
    // Build synced dates map (OTA blocked dates)
    const syncedMap = {};
    console.log('🔍 Debug: Total synced dates:', syncedDates.length);
    syncedDates.forEach(sd => {
        try {
            console.log('📅 Processing date:', sd.blocked_date);
            
            // Handle date string - remove time component if present
            let dateStr = sd.blocked_date;
            if (dateStr.includes('T')) {
                dateStr = dateStr.split('T')[0];
            }
            
            // Parse date string directly without timezone conversion
            const dateParts = dateStr.split('-');
            const blockedYear = parseInt(dateParts[0]);
            const blockedMonth = parseInt(dateParts[1]) - 1; // Month is 0-indexed
            const blockedDay = parseInt(dateParts[2]);
            
            console.log(`   Year: ${blockedYear}, Month: ${blockedMonth} (viewing: ${month}), Day: ${blockedDay}`);
            
            if (blockedMonth === month && blockedYear === year) {
                console.log(`   ✅ Added to calendar day ${blockedDay}`);
                if (!syncedMap[blockedDay]) syncedMap[blockedDay] = [];
                syncedMap[blockedDay].push(sd);
            }
        } catch (error) {
            console.warn('Error parsing synced date:', sd.blocked_date, error);
        }
    });
    console.log('🗺️ Final syncedMap:', syncedMap);
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    let calendarHTML = '';
    
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        calendarHTML += `<div class="calendar-day-header">${day}</div>`;
    });
    
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        const hasBooking = bookingsMap[day] && bookingsMap[day].length > 0;
        const hasCheckout = checkoutMap[day] && checkoutMap[day].length > 0;
        const hasSynced = syncedMap[day] && syncedMap[day].length > 0;
        const bookingCount = hasBooking ? bookingsMap[day].length : 0;
        const checkoutCount = hasCheckout ? checkoutMap[day].length : 0;
        const syncedCount = hasSynced ? syncedMap[day].length : 0;

        // Determine day styling based on booking status
        let statusClass = '';
        let indicator = '';
        let checkoutIndicator = '';
        let statusEmoji = '';
        let statusColor = '';
        let tooltip = '';

        if (hasBooking) {
            // Determine primary status for the day
            const statuses = bookingsMap[day].map(b => b.status || 'confirmed');
            const statusPriority = {
                'checked-in': 3,
                'confirmed': 2,
                'cancelled': 1
            };

            // Use highest priority status
            const primaryStatus = statuses.reduce((prev, curr) => {
                return (statusPriority[curr] || 0) > (statusPriority[prev] || 0) ? curr : prev;
            });

            statusClass = `status-${primaryStatus}`;

            // Status-specific emoji and color
            const statusConfig = {
                'confirmed': { emoji: '✅', color: '#10b981' },
                'checked-in': { emoji: '🔵', color: '#3b82f6' },
                'cancelled': { emoji: '❌', color: '#9ca3af' }
            };

            const config = statusConfig[primaryStatus] || statusConfig['confirmed'];
            statusEmoji = config.emoji;
            statusColor = config.color;

            indicator = `<div style="font-size: 10px; color: ${statusColor}; font-weight: 600; margin-top: 2px;">${statusEmoji} ${bookingCount}</div>`;
            tooltip = `${bookingCount} booking(s) staying`;
        } else if (hasSynced) {
            statusClass = 'status-blocked';
            indicator = `<div style="font-size: 10px; color: #ef4444; font-weight: 600; margin-top: 2px;">🔴 ${syncedCount}</div>`;
            tooltip = `${syncedCount} OTA block(s)`;
        } else {
            tooltip = 'Available';
        }

        // Add checkout indicator if guests are checking out (date remains available)
        if (hasCheckout && !hasBooking) {
            checkoutIndicator = `<div style="font-size: 14px; color: var(--primary); font-weight: 700; margin-top: 2px;">↓</div>`;
            tooltip = `${checkoutCount} guest(s) checking out • Available for new booking`;
        }

        calendarHTML += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${statusClass}"
                onclick="showDayBookings(${day}, ${month}, ${year})"
                title="${tooltip}">
                <div style="font-weight: 600;">${day}</div>
                ${indicator}
                ${checkoutIndicator}
            </div>
        `;
    }

    document.getElementById('calendarGrid').innerHTML = calendarHTML;
}

async function showDayBookings(day, month, year) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const todayBookingsEl = document.getElementById('todayBookings');
    
    try {
        // Get all reservations for this date
        const reservations = await db.getReservations();
        const propertyFilter = document.getElementById('calendarPropertyFilter').value;
        
        // Filter reservations for the selected date
        const dayBookings = reservations.filter(r => {
            if (r.status === 'cancelled') return false;
            if (propertyFilter && r.property_id != propertyFilter) return false;
            
            const checkIn = new Date(r.check_in);
            const checkOut = new Date(r.check_out);
            const selectedDate = new Date(dateStr);
            
            return selectedDate >= checkIn && selectedDate <= checkOut;
        });
        
        // Get synced availability for this date
        let syncedBlocks = [];
        if (propertyFilter) {
            const { data: syncedData } = await supabase
                .from('synced_availability')
                .select('*')
                .eq('property_id', propertyFilter)
                .eq('blocked_date', dateStr);
            
            if (syncedData) syncedBlocks = syncedData;
        }
        
        // Build HTML
        let html = `<div style="font-weight: 600; margin-bottom: 12px; font-size: 16px;">📅 ${dateStr}</div>`;
        
        // Show direct bookings
        if (dayBookings.length > 0) {
            html += `<div style="margin-bottom: 16px;">
                <div style="font-weight: 600; color: #dc2626; margin-bottom: 8px;">🔴 Direct Bookings (${dayBookings.length})</div>`;
            
            dayBookings.forEach(booking => {
                html += `
                    <div style="padding: 12px; background: #fee2e2; border-left: 4px solid #dc2626; border-radius: 6px; margin-bottom: 8px; cursor: pointer;" onclick="viewReservation('${booking.booking_id}')">
                        <div style="font-weight: 600; color: #1e293b;">${booking.guest_name}</div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                            ${booking.check_in} → ${booking.check_out} (${booking.nights} nights)
                        </div>
                        <div style="font-size: 13px; color: #64748b;">
                            Property: ${booking.property_name || 'Unknown'}
                        </div>
                        <div style="font-size: 13px; color: #16a34a; font-weight: 600; margin-top: 4px;">
                            ₹${parseFloat(booking.total_amount || 0).toLocaleString()}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // Show OTA blocks
        if (syncedBlocks.length > 0) {
            html += `<div style="margin-bottom: 16px;">
                <div style="font-weight: 600; color: #f59e0b; margin-bottom: 8px;">🟡 OTA Blocked (${syncedBlocks.length})</div>`;
            
            syncedBlocks.forEach(block => {
                html += `
                    <div style="padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; margin-bottom: 8px;">
                        <div style="font-weight: 600; color: #1e293b;">${block.booking_summary || 'Blocked by OTA'}</div>
                        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                            Source: ${block.source || 'iCal Sync'}
                        </div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                            Synced: ${block.synced_at ? new Date(block.synced_at).toLocaleString() : 'Unknown'}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // No bookings
        if (dayBookings.length === 0 && syncedBlocks.length === 0) {
            html += `<div style="padding: 24px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px;">
                <div style="font-size: 32px; margin-bottom: 8px;">🟢</div>
                <div style="font-weight: 600;">Available</div>
                <div style="font-size: 13px; margin-top: 4px;">No bookings or blocks for this date</div>
            </div>`;
        }
        
        todayBookingsEl.innerHTML = html;
        
    } catch (error) {
        console.error('Error showing day bookings:', error);
        todayBookingsEl.innerHTML = `<div style="color: #dc2626;">Error loading bookings for ${dateStr}</div>`;
    }
}


function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    loadAvailabilityCalendar();
}

// Collapsible Sections

function toggleCollapse(elementId, iconId) {
    const element = document.getElementById(elementId);
    const icon = document.getElementById(iconId);
    
    if (!element || !icon) return;
    
    const isCollapsed = element.style.display === 'none';
    
    if (isCollapsed) {
        element.style.display = 'block';
        icon.textContent = '🔽';
    } else {
        element.style.display = 'none';
        icon.textContent = '▶️';
    }
    
    // Save state
    saveCollapseState(elementId, !isCollapsed);
}

// Bulk Edit Functions
