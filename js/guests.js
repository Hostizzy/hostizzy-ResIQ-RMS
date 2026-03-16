// ResIQ Guests — Guest portal QR, guest list, search, filters, detail view, CSV export

// ============================================
// GUEST PORTAL QR CODE
// ============================================
function showGuestPortalQR(bookingId, guestName, phone) {
    const portalUrl = window.location.origin + '/guest-portal' + (bookingId ? '?booking=' + bookingId : '');

    // Build modal
    const modal = document.createElement('div');
    modal.id = 'guestPortalQRModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10005;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);animation:fadeIn 0.3s ease;';

    const isBookingSpecific = !!bookingId;
    const title = isBookingSpecific ? `Portal for ${guestName || bookingId}` : 'Guest Self-Service Portal';
    const subtitle = isBookingSpecific
        ? 'Guest scans this to submit ID documents & preferences'
        : 'Guests scan to access check-in, KYC & meal preferences';

    modal.innerHTML = `
        <div style="background:var(--surface);border-radius:20px;padding:32px 24px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.15);animation:fadeIn 0.3s ease;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <h3 style="margin:0;font-size:18px;font-weight:700;color:var(--text-primary);">${title}</h3>
                <button onclick="document.getElementById('guestPortalQRModal').remove()" style="width:30px;height:30px;border-radius:50%;background:var(--background-alt);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);">
                    <i data-lucide="x" style="width:16px;height:16px;"></i>
                </button>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin:0 0 20px;">${subtitle}</p>
            <div id="guestPortalQRCanvas" style="display:inline-block;padding:16px;background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:16px;"></div>
            ${isBookingSpecific ? `
                <div style="font-family:monospace;font-size:14px;font-weight:600;color:var(--primary);margin-bottom:4px;">${bookingId}</div>
                <div style="font-size:14px;color:var(--text-primary);margin-bottom:4px;">${guestName || ''}</div>
            ` : ''}
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:20px;word-break:break-all;">${portalUrl}</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                <button onclick="copyGuestPortalLink('${portalUrl}')" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);">
                    <i data-lucide="copy" style="width:14px;height:14px;"></i> Copy Link
                </button>
                ${isBookingSpecific && phone ? `
                    <button onclick="sendPortalQRWhatsApp('${bookingId}','${(guestName||'').replace(/'/g,"\\'")}','${phone}')" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:#25D366;color:white;">
                        <i data-lucide="message-circle" style="width:14px;height:14px;"></i> WhatsApp
                    </button>
                ` : ''}
                <button onclick="downloadPortalQR()" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid var(--primary);background:var(--primary);color:white;">
                    <i data-lucide="download" style="width:14px;height:14px;"></i> Save QR
                </button>
            </div>
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
                <p style="font-size:12px;color:var(--text-tertiary);margin:0;">No login required — guests access directly via QR scan</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Generate QR code
    generatePortalQR(portalUrl);
    setTimeout(() => refreshIcons(), 100);
}

function generatePortalQR(url) {
    const wrap = document.getElementById('guestPortalQRCanvas');
    if (!wrap) return;

    // Use qrcode-generator library for real, scannable QR codes
    if (typeof qrcode !== 'undefined') {
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const cellSize = 8;
        const margin = 16;
        const size = moduleCount * cellSize + margin * 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.id = 'portalQRCanvasEl';
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        // Draw QR modules
        ctx.fillStyle = '#0f172a';
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(margin + col * cellSize, margin + row * cellSize, cellSize, cellSize);
                }
            }
        }

        wrap.appendChild(canvas);
    } else {
        // Fallback: show the URL as a clickable link if library didn't load
        wrap.innerHTML = `<div style="padding:20px;text-align:center;"><p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">QR library loading...</p><a href="${url}" target="_blank" style="color:var(--primary);word-break:break-all;">${url}</a></div>`;
    }
}

function copyGuestPortalLink(url) {
    const portalUrl = url || (window.location.origin + '/guest-portal');
    navigator.clipboard.writeText(portalUrl).then(() => {
        showToast('Link Copied', 'Guest portal link copied to clipboard!', '');
    }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = portalUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('Link Copied', 'Guest portal link copied!', '');
    });
}

function sendPortalQRWhatsApp(bookingId, guestName, phone) {
    const portalUrl = window.location.origin + '/guest-portal?booking=' + bookingId;
    const message = `Hello ${guestName}!\n\nPlease complete your check-in for booking *${bookingId}* using this link:\n${portalUrl}\n\nYou can:\n✅ Submit your ID documents\n✅ Set meal preferences\n✅ View booking details\n\nNo login needed — just tap the link!\n\n— Team Hostizzy`;
    const formattedPhone = typeof formatPhoneForWhatsApp === 'function'
        ? formatPhoneForWhatsApp(phone)
        : phone.replace(/\D/g, '');
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

function downloadPortalQR() {
    const canvas = document.getElementById('portalQRCanvasEl');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'guest-portal-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ============================================
// SEND GUEST REMINDER (WhatsApp)
// ============================================
function sendGuestReminder(bookingId, phone, guestName) {
    // Use QR modal for per-booking reminders
    showGuestPortalQR(bookingId, guestName, phone);
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function formatDateHelper(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatDateTimeHelper(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

console.log('✅ Guest Documents functions loaded successfully');

// ==========================================
// GUEST MANAGEMENT FUNCTIONS
// ==========================================

let allGuests = [];
let allAdditionalGuests = [];
let filteredGuests = [];
let displayedGuests = [];
let currentGuestData = null;
let currentGuestView = 'table'; // 'table' or 'cards'
let currentGuestPage = 1;
let guestsPerPage = 50;
let currentSortColumn = 'nextCheckIn';
let currentSortDirection = 'asc';

// One-time migration: clear old guest sort that used 'name' default
(function migrateGuestSort() {
    try {
        const state = JSON.parse(localStorage.getItem('filterState') || '{}');
        if (state.guests && state.guests.sortBy && state.guests.sortBy !== 'nextCheckIn') {
            state.guests.sortBy = 'nextCheckIn';
            state.guests.sortDir = 'asc';
            localStorage.setItem('filterState', JSON.stringify(state));
        }
    } catch(e) {}
})();

/**
 * Load and display all guests
 */
async function loadGuests() {
    try {
        console.log('Loading guests...');

        // Use cache when available to avoid redundant Supabase calls on view switch
        const reservations = dataCache.get('reservations') || await db.getReservations();
        if (!dataCache.get('reservations')) dataCache.set('reservations', reservations);
        console.log('Reservations loaded:', reservations.length);
        
        // Create guest map (group by phone or email)
        const guestMap = new Map();
        
        reservations.forEach(r => {
            // Use phone as primary identifier, fallback to email
            const guestKey = (r.guest_phone || r.guest_email || r.guest_name || '').toLowerCase().trim();
            
            if (!guestKey) return;
            
            if (!guestMap.has(guestKey)) {
                guestMap.set(guestKey, {
                    name: r.guest_name,
                    phone: r.guest_phone || '',
                    email: r.guest_email || '',
                    city: r.guest_city || '',
                    bookingSources: new Set(),
                    bookings: [],
                    key: guestKey
                });
            }

            guestMap.get(guestKey).bookings.push(r);

            // Update name/phone/email/city to latest non-empty values
            const guest = guestMap.get(guestKey);
            if (r.guest_name && r.guest_name !== guest.name) guest.name = r.guest_name;
            if (r.guest_phone && r.guest_phone !== guest.phone) guest.phone = r.guest_phone;
            if (r.guest_email && r.guest_email !== guest.email) guest.email = r.guest_email;
            if (r.guest_city && !guest.city) guest.city = r.guest_city;
            if (r.booking_source) guest.bookingSources.add(r.booking_source);
        });
        
        // Convert to array and calculate stats
        allGuests = Array.from(guestMap.values()).map(guest => {
            const confirmedBookings = guest.bookings.filter(b => b.status !== 'cancelled');
            const totalSpent = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
            const totalNights = confirmedBookings.reduce((sum, b) => sum + (parseInt(b.nights) || 0), 0);

            // Sort bookings by check-in date descending
            const sortedBookings = [...confirmedBookings].sort((a, b) => new Date(b.check_in) - new Date(a.check_in));
            const lastBooking = sortedBookings.length > 0 ? new Date(sortedBookings[0].check_in) : null;

            // Find upcoming or most recent check-in
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingBooking = confirmedBookings
                .filter(b => new Date(b.check_in) >= today)
                .sort((a, b) => new Date(a.check_in) - new Date(b.check_in))[0];
            const latestBooking = sortedBookings[0];

            return {
                ...guest,
                bookingSources: Array.from(guest.bookingSources),
                totalBookings: confirmedBookings.length,
                totalSpent,
                totalNights,
                lastVisit: lastBooking,
                nextCheckIn: upcomingBooking ? new Date(upcomingBooking.check_in) : null,
                nextCheckInBooking: upcomingBooking || null,
                latestBooking: latestBooking || null,
                avgBookingValue: confirmedBookings.length > 0 ? totalSpent / confirmedBookings.length : 0,
                isRepeat: confirmedBookings.length > 1,
                isVIP: confirmedBookings.length >= 5,
                isHighValue: totalSpent >= 50000
            };
        });
        
        // Load additional guests from guest_documents for remarketing
        try {
            const { data: guestDocs, error: gdError } = await supabase
                .from('guest_documents')
                .select('booking_id, guest_name, guest_type, guest_sequence, guest_address, status, submitted_at')
                .eq('guest_type', 'additional')
                .order('submitted_at', { ascending: false });

            allAdditionalGuests = [];
            if (!gdError && guestDocs) {
                // Build a booking lookup from reservations
                const reservationMap = {};
                reservations.forEach(r => {
                    reservationMap[r.booking_id] = r;
                });

                guestDocs.forEach(doc => {
                    const booking = reservationMap[doc.booking_id];
                    if (booking) {
                        allAdditionalGuests.push({
                            name: doc.guest_name || 'Unknown',
                            phone: '',
                            email: '',
                            city: doc.guest_address || '',
                            bookingId: doc.booking_id,
                            propertyName: booking.property_name || '',
                            checkIn: booking.check_in,
                            checkOut: booking.check_out,
                            primaryGuestName: booking.guest_name || '',
                            primaryGuestPhone: booking.guest_phone || '',
                            status: doc.status || 'pending',
                            guestSequence: doc.guest_sequence,
                            submittedAt: doc.submitted_at
                        });
                    }
                });
            }
        } catch (err) {
            console.warn('Could not load additional guests for directory:', err);
            allAdditionalGuests = [];
        }

        // Update summary statistics
        const additionalGuestCount = allAdditionalGuests ? allAdditionalGuests.length : 0;
        document.getElementById('guestStatTotal').textContent = allGuests.length;
        document.getElementById('guestStatRepeat').textContent = allGuests.filter(g => g.isRepeat).length;
        document.getElementById('guestStatVIP').textContent = allGuests.filter(g => g.isVIP).length;
        document.getElementById('guestStatHighValue').textContent = allGuests.filter(g => g.isHighValue).length;
        
        const avgStays = allGuests.length > 0 
            ? (allGuests.reduce((sum, g) => sum + g.totalBookings, 0) / allGuests.length).toFixed(1)
            : '0.0';
        document.getElementById('guestStatAvgStays').textContent = avgStays;
        document.getElementById('guestStatAdditional').textContent = additionalGuestCount;

        // Load saved view preference
        const savedView = localStorage.getItem('guestViewPreference') || 'table';
        currentGuestView = savedView;
        
        // Initial display
        filteredGuests = [...allGuests];
        currentGuestPage = 1;
        
        // Restore saved filters (no delay — DOM elements already exist)
        const savedFilters = loadFilterState('guests');
        if (savedFilters) {
            console.log('🔄 Restoring guest filters:', savedFilters);

            // Restore search
            if (savedFilters.search) {
                const searchInput = document.getElementById('searchGuests');
                if (searchInput) searchInput.value = savedFilters.search;
            }

            // Restore type filter
            if (savedFilters.typeFilter) {
                const typeFilter = document.getElementById('guestTypeFilter');
                if (typeFilter) typeFilter.value = savedFilters.typeFilter;
            }

            // Restore sort (only if a valid column)
            if (savedFilters.sortBy && ['name','phone','email','city','lastVisit','nextCheckIn','stays','spent'].includes(savedFilters.sortBy)) {
                currentSortColumn = savedFilters.sortBy;
            }
            if (savedFilters.sortDir && (savedFilters.sortDir === 'asc' || savedFilters.sortDir === 'desc')) {
                currentSortDirection = savedFilters.sortDir;
            }

            // Restore per page
            if (savedFilters.perPage) {
                const perPageSelect = document.getElementById('guestsPerPage');
                if (perPageSelect) perPageSelect.value = savedFilters.perPage;
                guestsPerPage = savedFilters.perPage === 'all' ? displayedGuests.length : parseInt(savedFilters.perPage);
            }

            // Restore view (table/cards)
            if (savedFilters.currentView) {
                currentGuestView = savedFilters.currentView;
                switchGuestView(savedFilters.currentView);
            }

            // Restore page number
            if (savedFilters.currentPage) {
                currentGuestPage = savedFilters.currentPage;
            }

            // Apply search if exists — call _executeGuestSearch directly (skip debounce for restore)
            if (savedFilters.search) {
                _executeGuestSearch();
            } else {
                filterGuests();
            }
        } else {
            filterGuests();
        }
        
    } catch (error) {
        console.error('Error loading guests:', error);
        showToast('Error', 'Failed to load guests: ' + error.message, '❌');
        
        // Show error in UI
        const tableBody = document.getElementById('guestTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 60px 20px; color: var(--danger);">
                        <div style="margin-bottom: 16px;"><i data-lucide="alert-triangle" style="width: 52px; height: 52px; color: var(--warning); opacity: 0.7;"></i></div>
                        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Error Loading Guests</div>
                        <div style="font-size: 14px; color: var(--text-secondary);">${error.message}</div>
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Search guests by name, phone, or email (debounced to prevent lag on large datasets)
 */
const _debouncedGuestSearch = debounce(_executeGuestSearch, 250);

function searchGuests() {
    _debouncedGuestSearch();
}

function _executeGuestSearch() {
    const searchTerm = document.getElementById('searchGuests').value.toLowerCase().trim();
    
    if (!searchTerm) {
        filteredGuests = [...allGuests];
    } else {
        filteredGuests = allGuests.filter(g =>
            (g.name || '').toLowerCase().includes(searchTerm) ||
            (g.phone || '').toLowerCase().includes(searchTerm) ||
            (g.email || '').toLowerCase().includes(searchTerm) ||
            (g.city || '').toLowerCase().includes(searchTerm)
        );
    }
    
    currentGuestPage = 1; // Reset to first page
    filterGuests();
}

/**
 * Filter and sort guests
 */
function filterGuests() {
    let guests = [...filteredGuests];
    
    // Apply type filter
    const typeFilter = document.getElementById('guestTypeFilter').value;
    if (typeFilter === 'repeat') {
        guests = guests.filter(g => g.isRepeat);
    } else if (typeFilter === 'new') {
        guests = guests.filter(g => !g.isRepeat);
    } else if (typeFilter === 'vip') {
        guests = guests.filter(g => g.isVIP);
    } else if (typeFilter === 'highvalue') {
        guests = guests.filter(g => g.isHighValue);
    }
    
    // Apply sorting
    sortGuestArray(guests);
    
    // Store for pagination
    displayedGuests = guests;
    
    // Auto-switch to cards if < 20 results, otherwise table
    if (guests.length > 0 && guests.length <= 20 && currentGuestView === 'table') {
        // Don't auto-switch, respect user preference
    }
    
    // Render based on current view
    if (currentGuestView === 'table') {
        renderGuestTable();
    } else {
        renderGuestCards();
    }
    // Save filter state
    const searchValue = document.getElementById('searchGuests')?.value || '';
    const perPage = document.getElementById('guestsPerPage')?.value || '50';

    saveFilterState('guests', {
        search: searchValue,
        typeFilter: typeFilter,
        sortBy: currentSortColumn,
        sortDir: currentSortDirection,
        perPage: perPage,
        currentView: currentGuestView,
        currentPage: currentGuestPage
    });
}

/**
 * Sort guest array by current sort column
 */
function sortGuestArray(guests) {
    guests.sort((a, b) => {
        let aVal, bVal;

        switch(currentSortColumn) {
            case 'name':
                aVal = (a.name || '').toLowerCase();
                bVal = (b.name || '').toLowerCase();
                break;
            case 'phone':
                aVal = a.phone || '';
                bVal = b.phone || '';
                break;
            case 'email':
                aVal = (a.email || '').toLowerCase();
                bVal = (b.email || '').toLowerCase();
                break;
            case 'city':
                aVal = (a.city || '').toLowerCase();
                bVal = (b.city || '').toLowerCase();
                break;
            case 'nextCheckIn':
                // Upcoming check-ins first, then by last visit
                aVal = a.nextCheckIn ? a.nextCheckIn.getTime() : (a.lastVisit ? a.lastVisit.getTime() + 1e15 : 2e15);
                bVal = b.nextCheckIn ? b.nextCheckIn.getTime() : (b.lastVisit ? b.lastVisit.getTime() + 1e15 : 2e15);
                break;
            case 'lastVisit':
                aVal = a.lastVisit ? a.lastVisit.getTime() : 0;
                bVal = b.lastVisit ? b.lastVisit.getTime() : 0;
                break;
            case 'stays':
                aVal = a.totalBookings;
                bVal = b.totalBookings;
                break;
            case 'spent':
                aVal = a.totalSpent;
                bVal = b.totalSpent;
                break;
            default:
                aVal = a.name;
                bVal = b.name;
        }

        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Sort guests table by column
 */
function sortGuestsTable(column) {
    if (currentSortColumn === column) {
        // Toggle direction
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // Update sort icons
    document.querySelectorAll('[id^="sortIcon"]').forEach(el => el.textContent = '↕️');
    const icon = currentSortDirection === 'asc' ? '↑' : '↓';
    const iconId = 'sortIcon' + column.charAt(0).toUpperCase() + column.slice(1);
    const iconEl = document.getElementById(iconId);
    if (iconEl) iconEl.textContent = icon;
    
    filterGuests();
}

/**
 * Switch between table and card view
 */
function switchGuestView(view) {
    currentGuestView = view;
    
    // Save preference
    localStorage.setItem('guestViewPreference', view);
    
    // Update button styles
    document.getElementById('tableViewBtn').style.background = view === 'table' ? 'var(--primary)' : 'var(--secondary)';
    document.getElementById('cardViewBtn').style.background = view === 'cards' ? 'var(--primary)' : 'var(--secondary)';
    
    // Show/hide views
    document.getElementById('guestTableView').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('guestCardView').style.display = view === 'cards' ? 'block' : 'none';
    
    // Re-render
    filterGuests();
}

/**
 * Change guests per page
 */
function changeGuestsPerPage() {
    const value = document.getElementById('guestsPerPage').value;
    guestsPerPage = value === 'all' ? displayedGuests.length : parseInt(value);
    currentGuestPage = 1;
    filterGuests();
}

/**
 * Render guest table with pagination
 */
function renderGuestTable() {
    const tbody = document.getElementById('guestTableBody');
    
    if (displayedGuests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <div style="margin-bottom: 16px;"><i data-lucide="users" style="width: 52px; height: 52px; opacity: 0.3;"></i></div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No guests found</div>
                    <div style="font-size: 14px;">Try adjusting your search or filters</div>
                </td>
            </tr>
        `;
        document.getElementById('guestPagination').style.display = 'none';
        return;
    }
    
    // Pagination logic
    const totalGuests = displayedGuests.length;
    const totalPages = Math.ceil(totalGuests / guestsPerPage);
    const startIdx = (currentGuestPage - 1) * guestsPerPage;
    const endIdx = Math.min(startIdx + guestsPerPage, totalGuests);
    const pageGuests = displayedGuests.slice(startIdx, endIdx);
    
    // Update pagination info
    document.getElementById('guestShowingStart').textContent = totalGuests > 0 ? startIdx + 1 : 0;
    document.getElementById('guestShowingEnd').textContent = endIdx;
    document.getElementById('guestShowingTotal').textContent = totalGuests;
    document.getElementById('guestPagination').style.display = 'flex';
    
    // Render table rows
    let html = '';
    pageGuests.forEach(guest => {
        const guestBadge = guest.isVIP ? '<span style="background: var(--warning); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 6px;">👑 VIP</span>' :
                           guest.isRepeat ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 6px;">🌟</span>' :
                           '<span style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 6px;">✨</span>';
        
        const lastVisitText = guest.lastVisit ? formatDate(guest.lastVisit) : 'Never';

        html += `
            <tr style="cursor: pointer;" data-action="view-guest" data-guest-key="${guest.key.replace(/"/g, '&quot;')}">
                <td data-label="Guest Name">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; background: var(--gradient-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; flex-shrink: 0;">
                            ${(guest.name || '?')[0].toUpperCase()}
                        </div>
                        <div style="min-width: 0;">
                            <strong style="display: block; overflow: hidden; text-overflow: ellipsis;">${guest.name || 'Unknown Guest'}</strong>
                            ${guestBadge}
                        </div>
                    </div>
                </td>
                <td data-label="Phone">
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        ${guest.phone ? `<span>📱 ${guest.phone}</span>` : '<span style="opacity:0.5;">—</span>'}
                    </div>
                </td>
                <td data-label="Email">
                    <div style="font-size: 13px; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${guest.email || ''}">
                        ${guest.email ? `<span>📧 ${guest.email}</span>` : '<span style="opacity:0.5;">—</span>'}
                    </div>
                </td>
                <td data-label="City">
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        ${guest.city ? `<span>📍 ${guest.city}</span>` : '<span style="opacity:0.5;">—</span>'}
                    </div>
                </td>
                <td data-label="Last Visit">
                    <span class="td-mobile-label">Last Visit: </span>${lastVisitText}
                </td>
                <td data-label="Stays">
                    <span class="td-mobile-label">Stays: </span><strong>${guest.totalBookings}</strong>
                </td>
                <td data-label="Total Spent">
                    <strong style="color: var(--success); font-size: inherit;">${formatCurrency(guest.totalSpent)}</strong>
                </td>
                <td data-label="Actions">
                    <button class="btn btn-sm btn-primary" data-action="view-guest" data-guest-key="${guest.key.replace(/"/g, '&quot;')}">
                        👁️ View
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Render pagination buttons
    renderPaginationButtons(totalPages);
}

/**
 * Render pagination buttons
 */
function renderPaginationButtons(totalPages) {
    const container = document.getElementById('guestPaginationButtons');
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `
        <button class="btn btn-sm btn-secondary" 
                onclick="changeGuestPage(${currentGuestPage - 1})" 
                ${currentGuestPage === 1 ? 'disabled' : ''}>
            ◀ Prev
        </button>
    `;
    
    // Page numbers
    const maxButtons = 7;
    let startPage = Math.max(1, currentGuestPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="btn btn-sm btn-secondary" onclick="changeGuestPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding: 0 8px;">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentGuestPage;
        html += `
            <button class="btn btn-sm" 
                    onclick="changeGuestPage(${i})"
                    style="background: ${isActive ? 'var(--primary)' : 'var(--secondary)'}; color: white;">
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 8px;">...</span>`;
        html += `<button class="btn btn-sm btn-secondary" onclick="changeGuestPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    html += `
        <button class="btn btn-sm btn-secondary" 
                onclick="changeGuestPage(${currentGuestPage + 1})" 
                ${currentGuestPage === totalPages ? 'disabled' : ''}>
            Next ▶
        </button>
    `;
    
    container.innerHTML = html;
}

/**
 * Change page
 */
function changeGuestPage(page) {
    const totalPages = Math.ceil(displayedGuests.length / guestsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentGuestPage = page;
    renderGuestTable();
    
    // Scroll to top of table
    document.getElementById('guestTableView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Render guest cards (compact grid version)
 */
function renderGuestCards() {
    const container = document.getElementById('guestListContainer');
    
    if (displayedGuests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="margin-bottom: 16px;"><i data-lucide="users" style="width: 52px; height: 52px; opacity: 0.3;"></i></div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No guests found</div>
                <div style="font-size: 14px;">Try adjusting your search or filters</div>
            </div>
        `;
        return;
    }
    
    // Pagination for cards
    const totalGuests = displayedGuests.length;
    const startIdx = (currentGuestPage - 1) * guestsPerPage;
    const endIdx = Math.min(startIdx + guestsPerPage, totalGuests);
    const pageGuests = displayedGuests.slice(startIdx, endIdx);
    
    let html = '<div class="guest-card-grid">';

    pageGuests.forEach(guest => {
        const guestBadge = guest.isVIP ? 'VIP' : guest.isRepeat ? 'Repeat' : 'New';
        const badgeBg = guest.isVIP ? '#f59e0b' : guest.isRepeat ? '#10b981' : '#0891b2';
        const lastVisitText = guest.lastVisit ? formatDate(guest.lastVisit) : 'Never';

        // Check-in date display
        const nextCheckinText = guest.nextCheckIn ? formatDate(guest.nextCheckIn) : null;
        const latestStatus = guest.latestBooking?.status || '';
        const statusLabel = latestStatus === 'checked-in' ? 'Checked In' : latestStatus === 'confirmed' ? 'Upcoming' : latestStatus === 'checked-out' ? 'Checked Out' : '';
        const statusColor = latestStatus === 'checked-in' ? '#0891b2' : latestStatus === 'confirmed' ? '#10b981' : '#64748b';
        const bookingId = guest.latestBooking?.booking_id || '';

        html += `
            <div class="guest-card" onclick="showGuestDetail('${guest.key.replace(/'/g, "\\'")}')">
                <div class="guest-card-header">
                    <div class="guest-card-avatar" style="background:${badgeBg}20;color:${badgeBg};">
                        ${(guest.name || '?')[0].toUpperCase()}
                    </div>
                    <div class="guest-card-info">
                        <div class="guest-card-name">${guest.name || 'Unknown'}</div>
                        <div class="guest-card-tags">
                            <span class="guest-badge" style="background:${badgeBg};color:#fff;">${guestBadge}</span>
                            ${statusLabel ? `<span class="guest-badge" style="background:${statusColor}18;color:${statusColor};">${statusLabel}</span>` : ''}
                        </div>
                    </div>
                    <div class="guest-card-spent">
                        <div class="guest-card-amount">${formatCurrency(guest.totalSpent)}</div>
                        <div class="guest-card-spent-label">Total</div>
                    </div>
                </div>

                <div class="guest-card-meta">
                    ${guest.phone ? `<span><i data-lucide="phone" style="width:13px;height:13px;"></i>${guest.phone}</span>` : ''}
                    ${guest.email ? `<span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${guest.email}"><i data-lucide="mail" style="width:13px;height:13px;"></i>${guest.email}</span>` : ''}
                    ${guest.city ? `<span><i data-lucide="map-pin" style="width:13px;height:13px;"></i>${guest.city}</span>` : ''}
                    ${nextCheckinText
                        ? `<span class="guest-checkin-highlight"><i data-lucide="calendar-check" style="width:13px;height:13px;"></i>Check-in: ${nextCheckinText}</span>`
                        : `<span><i data-lucide="calendar" style="width:13px;height:13px;"></i>Last: ${lastVisitText}</span>`}
                </div>

                <div class="guest-card-stats">
                    <div class="guest-stat">
                        <span class="guest-stat-value" style="color:var(--primary);">${guest.totalBookings}</span>
                        <span class="guest-stat-label">Stays</span>
                    </div>
                    <div class="guest-stat">
                        <span class="guest-stat-value">${guest.totalNights}</span>
                        <span class="guest-stat-label">Nights</span>
                    </div>
                    <div class="guest-stat">
                        <span class="guest-stat-value">${lastVisitText}</span>
                        <span class="guest-stat-label">Last Visit</span>
                    </div>
                    ${guest.phone && bookingId ? `
                    <div class="guest-stat">
                        <button class="guest-qr-btn" onclick="event.stopPropagation(); showGuestPortalQR('${bookingId}', '${(guest.name||'').replace(/'/g,"\\'")}', '${guest.phone}')" title="Guest Portal QR">
                            <i data-lucide="qr-code" style="width:16px;height:16px;"></i>
                        </button>
                        <span class="guest-stat-label">Portal</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Add pagination for cards if needed
    const totalPages = Math.ceil(totalGuests / guestsPerPage);
    if (totalPages > 1) {
        html += `
            <div style="display: flex; justify-content: center; align-items: center; padding: 20px; gap: 8px;">
                ${renderCardPaginationHTML(totalPages)}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

/**
 * Render pagination HTML for cards
 */
function renderCardPaginationHTML(totalPages) {
    let html = `
        <button class="btn btn-sm btn-secondary" 
                onclick="changeGuestPage(${currentGuestPage - 1})" 
                ${currentGuestPage === 1 ? 'disabled' : ''}>
            ◀ Prev
        </button>
    `;
    
    for (let i = 1; i <= Math.min(5, totalPages); i++) {
        const isActive = i === currentGuestPage;
        html += `
            <button class="btn btn-sm" 
                    onclick="changeGuestPage(${i})"
                    style="background: ${isActive ? 'var(--primary)' : 'var(--secondary)'}; color: white;">
                ${i}
            </button>
        `;
    }
    
    if (totalPages > 5) {
        html += `<span>...</span>`;
    }
    
    html += `
        <button class="btn btn-sm btn-secondary" 
                onclick="changeGuestPage(${currentGuestPage + 1})" 
                ${currentGuestPage === totalPages ? 'disabled' : ''}>
            Next ▶
        </button>
    `;
    
    return html;
}

/**
 * Show guest detail modal
 */
async function showGuestDetail(guestKey) {
    const guest = allGuests.find(g => g.key === guestKey);
    if (!guest) return;

    currentGuestData = guest;

    // Update profile section
    document.getElementById('guestDetailName').textContent = guest.name || 'Unknown Guest';
    document.getElementById('guestDetailNameHeader').textContent = guest.name || 'Unknown Guest';
    document.getElementById('guestDetailPhone').textContent = guest.phone || 'No phone';
    document.getElementById('guestDetailEmail').textContent = guest.email || 'No email';
    document.getElementById('guestDetailCity').textContent = guest.city || 'No city info';

    // Update badge
    const badge = guest.isVIP ? '👑 VIP Guest' : guest.isRepeat ? '🌟 Repeat Guest' : '✨ New Guest';
    document.getElementById('guestDetailBadge').textContent = badge;

    // Update statistics
    document.getElementById('guestDetailTotalBookings').textContent = guest.totalBookings;
    document.getElementById('guestDetailTotalNights').textContent = guest.totalNights;
    document.getElementById('guestDetailTotalSpent').textContent = formatCurrency(guest.totalSpent);
    document.getElementById('guestDetailAvgValue').textContent = formatCurrency(guest.avgBookingValue);
    document.getElementById('guestDetailLastVisit').textContent = guest.lastVisit
        ? formatDate(guest.lastVisit)
        : 'Never';

    // Update booking count
    document.getElementById('guestDetailBookingCount').textContent = guest.totalBookings;

    // Show modal immediately with booking history (additional guests load async)
    document.getElementById('guestDetailModal').classList.add('active');

    // Fetch additional guest names from guest_documents for all bookings
    const bookingIds = guest.bookings.map(b => b.booking_id).filter(Boolean);
    let guestDocsByBooking = {};

    if (bookingIds.length > 0) {
        try {
            const { data: guestDocs, error } = await supabase
                .from('guest_documents')
                .select('booking_id, guest_name, guest_type, guest_sequence, status')
                .in('booking_id', bookingIds)
                .order('guest_sequence', { ascending: true });

            if (!error && guestDocs) {
                guestDocs.forEach(doc => {
                    if (!guestDocsByBooking[doc.booking_id]) {
                        guestDocsByBooking[doc.booking_id] = [];
                    }
                    guestDocsByBooking[doc.booking_id].push(doc);
                });
            }
        } catch (err) {
            console.warn('Could not load additional guest info:', err);
        }
    }

    // Render booking history with additional guests
    const historyHtml = guest.bookings
        .sort((a, b) => new Date(b.check_in) - new Date(a.check_in))
        .map(booking => {
            const statusColors = {
                'confirmed': 'var(--success)',
                'pending': 'var(--warning)',
                'checked-in': 'var(--primary)',
                'checked-out': 'var(--text-secondary)',
                'cancelled': 'var(--danger)'
            };

            // Build additional guests section (only show additional guests who completed ID verification)
            const bookingGuests = (guestDocsByBooking[booking.booking_id] || [])
                .filter(g => g.guest_type === 'primary' || g.status === 'verified');
            let additionalGuestsHtml = '';

            if (bookingGuests.length > 0) {
                const guestTags = bookingGuests.map(g => {
                    const isPrimary = g.guest_type === 'primary';
                    const docIcon = g.status === 'verified' ? '✓' : g.status === 'pending' ? '⏳' : '';
                    return `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: ${isPrimary ? 'var(--primary)' : '#e2e8f0'}; color: ${isPrimary ? 'white' : 'var(--text-primary)'}; border-radius: 12px; font-size: 11px; font-weight: 500;">${isPrimary ? '👤 ' : ''}${g.guest_name}${docIcon ? ` ${docIcon}` : ''}</span>`;
                }).join(' ');
                additionalGuestsHtml = `
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Guests:</span>
                        ${guestTags}
                    </div>
                `;
            }

            return `
                <div class="booking-history-card" style="padding: 14px; background: var(--background-alt); border-radius: 10px; border-left: 4px solid ${statusColors[booking.status] || 'var(--border)'};">
                    <div class="booking-top" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; gap: 12px; flex-wrap: wrap;">
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 4px;">${booking.property_name || 'Property'}</div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                📅 ${formatDate(booking.check_in)} → ${formatDate(booking.check_out)}
                                <span style="color: var(--text-primary); font-weight: 600;">(${booking.nights} nights)</span>
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                ID: ${booking.booking_id || 'N/A'}
                            </div>
                        </div>
                        <div class="booking-amount" style="text-align: right; flex-shrink: 0;">
                            <div style="font-size: 17px; font-weight: 700; color: var(--success);">
                                ${formatCurrency(booking.total_amount)}
                            </div>
                            <span class="booking-status" style="font-size: 11px; padding: 3px 8px; background: ${statusColors[booking.status] || 'var(--border)'}; color: white; border-radius: 12px; margin-top: 4px; display: inline-block;">
                                ${booking.status}
                            </span>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        👥 ${booking.adults || 0} adults${booking.kids ? `, ${booking.kids} kids` : ''}
                    </div>
                    ${additionalGuestsHtml}
                </div>
            `;
        }).join('');

    document.getElementById('guestDetailBookingHistory').innerHTML = historyHtml;
}

/**
 * Close guest detail modal
 */
function closeGuestDetailModal() {
    document.getElementById('guestDetailModal').classList.remove('active');
    currentGuestData = null;
}

/**
 * Edit guest information
 */
function editGuestInfo() {
    if (!currentGuestData) return;
    
    document.getElementById('editGuestName').value = currentGuestData.name || '';
    document.getElementById('editGuestPhone').value = currentGuestData.phone || '';
    document.getElementById('editGuestEmail').value = currentGuestData.email || '';
    document.getElementById('editGuestCity').value = currentGuestData.city || '';
    document.getElementById('editGuestOriginalPhone').value = currentGuestData.phone || '';
    document.getElementById('editGuestOriginalEmail').value = currentGuestData.email || '';
    
    document.getElementById('editGuestModal').classList.add('active');
}

/**
 * Close edit guest modal
 */
function closeEditGuestModal() {
    document.getElementById('editGuestModal').classList.remove('active');
}

/**
 * Save guest information
 */
async function saveGuestInfo() {
    if (!currentGuestData) return;
    
    const newName = document.getElementById('editGuestName').value.trim();
    const newPhone = document.getElementById('editGuestPhone').value.trim();
    const newEmail = document.getElementById('editGuestEmail').value.trim();
    const newCity = document.getElementById('editGuestCity').value.trim();

    if (!newName) {
        showToast('Validation Error', 'Guest name is required', '❌');
        return;
    }

    try {
        // Update all bookings for this guest
        const updates = {
            guest_name: newName,
            guest_phone: newPhone,
            guest_email: newEmail,
            guest_city: newCity || null
        };
        
        // Find all booking IDs for this guest
        const bookingIds = currentGuestData.bookings.map(b => b.booking_id);
        
        // Update in database
        for (const bookingId of bookingIds) {
            await supabase
                .from('reservations')
                .update(updates)
                .eq('booking_id', bookingId);
        }
        
        closeEditGuestModal();
        closeGuestDetailModal();
        
        // Reload guests
        await loadGuests();
        
        showToast('Success', `Updated information for ${newName}`, '✅');
        
    } catch (error) {
        console.error('Error updating guest:', error);
        showToast('Error', 'Failed to update guest information', '❌');
    }
}

/**
 * Call guest
 */
function callGuest() {
    if (!currentGuestData || !currentGuestData.phone) {
        showToast('No Phone', 'Guest phone number not available', '⚠️');
        return;
    }
    window.location.href = `tel:${currentGuestData.phone}`;
}

/**
 * WhatsApp guest
 */
function whatsappGuest() {
    if (!currentGuestData || !currentGuestData.phone) {
        showToast('No Phone', 'Guest phone number not available', '⚠️');
        return;
    }
    
    const phone = typeof formatPhoneForWhatsApp === 'function'
        ? formatPhoneForWhatsApp(currentGuestData.phone)
        : currentGuestData.phone.replace(/[^0-9]/g, '');

    const message = encodeURIComponent(`Hello ${currentGuestData.name}, this is ResIQ by Hostizzy.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}

/**
 * Email guest
 */
function emailGuest() {
    if (!currentGuestData || !currentGuestData.email) {
        showToast('No Email', 'Guest email not available', '⚠️');
        return;
    }
    window.location.href = `mailto:${currentGuestData.email}`;
}

/**
 * Clear guest filters
 */
function clearGuestFilters() {
    document.getElementById('searchGuests').value = '';
    document.getElementById('guestTypeFilter').value = '';
    const sortByEl = document.getElementById('guestSortBy');
    if (sortByEl) sortByEl.value = 'nextCheckIn';
    document.getElementById('guestsPerPage').value = '50';
    guestsPerPage = 50;
    currentGuestPage = 1;
    currentSortColumn = 'nextCheckIn';
    currentSortDirection = 'asc';
    filteredGuests = [...allGuests];
    
    // Clear saved filter state
    clearFilterState('guests');
    
    filterGuests();
}

/**
 * Export guests to CSV
 */
function exportGuestsCSV() {
    const guestsToExport = displayedGuests.length > 0 ? displayedGuests : allGuests;

    if (guestsToExport.length === 0) {
        showToast('No Data', 'No guests to export', '⚠️');
        return;
    }

    // Prepare CSV data with full details
    const headers = ['Name', 'Phone', 'Email', 'City', 'Total Bookings', 'Total Nights', 'Total Spent', 'Avg Booking Value', 'Last Visit', 'Guest Type', 'Booking Sources'];

    const rows = guestsToExport.map(g => [
        g.name || '',
        g.phone || '',
        g.email || '',
        g.city || '',
        g.totalBookings,
        g.totalNights,
        g.totalSpent,
        g.avgBookingValue.toFixed(2),
        g.lastVisit ? formatDate(g.lastVisit) : 'Never',
        g.isVIP ? 'VIP' : g.isRepeat ? 'Repeat' : 'New',
        (g.bookingSources || []).join('; ')
    ]);

    downloadCSV(headers, rows, `guests_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Exported', `${guestsToExport.length} guests exported to CSV`, '✅');
}

/**
 * Export ALL guests including additional guests for remarketing
 */
function exportAllGuestsCSV() {
    const primaryGuests = allGuests;
    const additionalGuests = allAdditionalGuests || [];

    if (primaryGuests.length === 0 && additionalGuests.length === 0) {
        showToast('No Data', 'No guests to export', '⚠️');
        return;
    }

    const headers = ['Name', 'Phone', 'Email', 'City', 'Guest Role', 'Primary Guest Name', 'Primary Guest Phone', 'Property', 'Check-In', 'Total Bookings', 'Total Spent', 'Guest Type', 'Booking Sources'];

    const rows = [];

    // Add primary guests
    primaryGuests.forEach(g => {
        rows.push([
            g.name || '',
            g.phone || '',
            g.email || '',
            g.city || '',
            'Primary',
            '',
            '',
            (g.bookings || []).map(b => b.property_name).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('; '),
            g.lastVisit ? formatDate(g.lastVisit) : '',
            g.totalBookings,
            g.totalSpent,
            g.isVIP ? 'VIP' : g.isRepeat ? 'Repeat' : 'New',
            (g.bookingSources || []).join('; ')
        ]);
    });

    // Add additional guests
    additionalGuests.forEach(ag => {
        rows.push([
            ag.name || '',
            ag.phone || '',
            ag.email || '',
            ag.city || '',
            'Additional Guest',
            ag.primaryGuestName || '',
            ag.primaryGuestPhone || '',
            ag.propertyName || '',
            ag.checkIn ? formatDate(new Date(ag.checkIn)) : '',
            1,
            '',
            'Additional',
            ''
        ]);
    });

    downloadCSV(headers, rows, `all_guests_remarketing_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Exported', `${primaryGuests.length} primary + ${additionalGuests.length} additional guests exported`, '✅');
}

/**
 * Helper: download CSV from headers and rows
 */
function downloadCSV(headers, rows, filename) {
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return '"' + cellStr.replace(/"/g, '""') + '"';
            }
            return cellStr;
        }).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Event Delegation for Guests Table ──
(function initGuestTableDelegation() {
    function handleGuestClick(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;
        const guestKey = actionEl.dataset.guestKey;
        if (!guestKey) return;

        if (action === 'view-guest') {
            showGuestDetail(guestKey);
        }
    }

    const tbody = document.getElementById('guestTableBody');
    if (tbody) {
        tbody.addEventListener('click', handleGuestClick);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            const tb = document.getElementById('guestTableBody');
            if (tb) tb.addEventListener('click', handleGuestClick);
        });
    }
})();

// ==========================================
