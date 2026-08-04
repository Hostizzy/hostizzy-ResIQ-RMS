// ResIQ Properties — Property CRUD, settings, iCal sync, auto-sync

async function loadProperties() {
    try {
        const properties = await db.getProperties();
        const reservations = await db.getReservations();
        const payments = await db.getAllPayments();
        const allRooms = await db.getRooms();   // [] if the migration hasn't run
        const grid = document.getElementById('propertiesGrid');
        
        grid.innerHTML = properties.map(p => {
            const propBookings = reservations.filter(r => r.property_id === p.id);
            const confirmedBookings = propBookings.filter(r => r.status !== 'cancelled');
            const activeBookings = propBookings.filter(r => r.status === 'checked-in').length;
            const totalBookings = confirmedBookings.length;

            // Calculate revenue (excluding cancelled)
            const totalRevenue = confirmedBookings.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);

            // Calculate occupancy
            const totalNights = confirmedBookings.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0);
            const occupancyPercent = totalNights > 0 ? Math.round((totalNights / 365) * 100) : 0;

            // Get next check-in
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingBookings = confirmedBookings
                .filter(r => new Date(r.check_in) >= today)
                .sort((a, b) => new Date(a.check_in) - new Date(b.check_in));
            const nextCheckIn = upcomingBookings[0];

            // Performance badge - based on occupancy only, skip if no data
            let performanceBadge = '';
            let badgeClass = '';
            if (totalBookings === 0) {
                performanceBadge = '🆕 New';
                badgeClass = 'average';
            } else if (occupancyPercent >= 60) {
                performanceBadge = '⭐ Top Performer';
                badgeClass = 'top-performer';
            } else if (occupancyPercent > 0 && occupancyPercent < 25) {
                performanceBadge = '⚠️ Low Occupancy';
                badgeClass = 'needs-attention';
            } else {
                performanceBadge = '📊 Active';
                badgeClass = 'average';
            }

            // Sparkline: last 6 months revenue by check-in month
            const sparklineData = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);
                const monthStr = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                const monthRevenue = confirmedBookings
                    .filter(r => r.month === monthStr)
                    .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
                sparklineData.push({ month: monthStr, revenue: monthRevenue });
            }
            const maxRevenue = Math.max(...sparklineData.map(d => d.revenue), 1);
            const hasAnyRevenue = sparklineData.some(d => d.revenue > 0);
            const sparklineBars = hasAnyRevenue
                ? sparklineData.map(d => {
                    const height = Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 10 : 3);
                    const opacity = d.revenue > 0 ? 1 : 0.2;
                    return `<div class="sparkline-bar" style="height: ${height}%; opacity: ${opacity}" title="${d.month}: ₹${Math.round(d.revenue).toLocaleString('en-IN')}"></div>`;
                  }).join('')
                : '';

            // Revenue trend: compare current month vs previous month (from sparklineData)
            const currentMonthRevenue = sparklineData[5]?.revenue || 0;
            const prevMonthRevenue = sparklineData[4]?.revenue || 0;
            const trendPercent = prevMonthRevenue > 0
                ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
                : 0;
            const trendClass = trendPercent >= 0 ? 'positive' : 'negative';
            const trendIcon = trendPercent >= 0 ? '📈' : '📉';

            // Property icon based on type
            const iconMap = {
                'Villa': '🏡',
                'Apartment': '🏢',
                'Hotel': '🏨',
                'Hostel': '🏠',
                'Resort': '🌴'
            };
            const propertyIcon = iconMap[p.type] || '🏠';

            // Rooms are optional — show the count only when there are some,
            // so whole-place properties stay visually unchanged.
            const roomCount = allRooms.filter(r => String(r.property_id) === String(p.id)).length;

            // Sync status
            const syncStatus = getSyncStatusBadge(p);
            const lastSynced = p.ical_last_synced ?
                formatTimeAgo(new Date(p.ical_last_synced)) : 'Never';

            // Format revenue compactly
            const revenueDisplay = totalRevenue >= 100000
                ? '₹' + (totalRevenue / 100000).toFixed(1) + 'L'
                : totalRevenue >= 1000
                    ? '₹' + (totalRevenue / 1000).toFixed(0) + 'K'
                    : '₹' + Math.round(totalRevenue);

            const occColor = occupancyPercent >= 60 ? '#10b981'
                : occupancyPercent >= 25 ? '#f59e0b'
                : occupancyPercent > 0 ? '#ef4444'
                : '#94a3b8';

            return `
                <div class="property-card">

                    <!-- Left: Icon / Thumbnail -->
                    <div class="prop-icon">
                        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : propertyIcon}
                    </div>

                    <!-- Property Name, Location, Badge -->
                    <div class="prop-info">
                        <div class="prop-name">${p.name}</div>
                        <div class="prop-meta">
                            <span class="prop-location">📍 ${p.location || 'No location'}</span>
                            <span class="prop-badge ${badgeClass}">${performanceBadge}</span>
                        </div>
                        <div class="prop-type-row">${p.type || 'Property'}${roomCount ? ` &middot; ${roomCount} room${roomCount === 1 ? '' : 's'}` : ''}</div>
                    </div>

                    <!-- Stats: 4 fixed-width columns -->
                    <div class="prop-stats">
                        <div class="prop-stat">
                            <div class="prop-stat-value">${totalBookings}</div>
                            <div class="prop-stat-label">Bookings</div>
                        </div>
                        <div class="prop-stat">
                            <div class="prop-stat-value">${revenueDisplay}</div>
                            <div class="prop-stat-label">Revenue</div>
                        </div>
                        <div class="prop-stat">
                            <div class="prop-stat-value" style="color:${occColor}">${occupancyPercent}%</div>
                            <div class="prop-stat-label">Occupancy</div>
                        </div>
                        <div class="prop-stat">
                            <div class="prop-stat-value" style="color:${activeBookings > 0 ? '#3b82f6' : '#94a3b8'}">${activeBookings}</div>
                            <div class="prop-stat-label">Live Now</div>
                        </div>
                    </div>

                    <!-- Next Check-in -->
                    <div class="prop-next">
                        <div class="prop-next-label">Next Check-in</div>
                        ${nextCheckIn ? `
                            <div class="prop-next-date">${formatDate(nextCheckIn.check_in)}</div>
                            <div class="prop-next-guest">${nextCheckIn.guest_name}</div>
                        ` : `
                            <div class="prop-next-empty">None upcoming</div>
                        `}
                    </div>

                    <!-- iCal Sync Status -->
                    <div class="prop-sync">
                        <div class="prop-sync-dot ${p.ical_url ? 'synced' : 'not-synced'}"></div>
                        <div class="prop-sync-status">${p.ical_url ? 'iCal On' : 'No iCal'}</div>
                        ${p.ical_url ? `<div class="prop-sync-time">${lastSynced}</div>` : ''}
                        ${p.is_managed ? `<span style="display:inline-block;margin-top:4px;padding:2px 8px;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:600;border-radius:4px;">Managed</span>` : ''}
                    </div>

                    <!-- Actions -->
                    <div class="prop-actions">
                        <button class="prop-action-btn" onclick="showPropertyCalendar(${p.id})" title="Calendar">Cal</button>
                        ${p.ical_url ? `
                            <button class="prop-action-btn primary" onclick="syncPropertyNow(${p.id}, event)" title="Sync Now">Sync</button>
                        ` : ''}
                        <button class="prop-action-btn" onclick="openRoomsManager(${p.id}, '${(p.name || '').replace(/'/g, "\\'")}')" title="Rooms">Rooms</button>
                        <button class="prop-action-btn" onclick="openPropertySettings(${p.id})" title="Settings">Settings</button>
                        <button class="prop-action-btn danger" onclick="deleteProperty(${p.id})" title="Delete Property" style="color: var(--danger);">Delete</button>
                    </div>

                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Properties error:', error);
        showToast('Error', 'Failed to load properties', '❌');
    }
}

function getSyncStatusBadge(property) {
    if (!property.ical_url) {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #e2e8f0; color: #64748b; border-radius: 12px;">Not Configured</span>';
    }
    
    if (property.ical_sync_status === 'syncing') {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #dbeafe; color: #2563eb; border-radius: 12px;">⏳ Syncing...</span>';
    }
    
    if (property.ical_sync_status === 'error') {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #fee2e2; color: #dc2626; border-radius: 12px;">❌ Error</span>';
    }
    
    if (property.ical_last_synced) {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #dcfce7; color: #16a34a; border-radius: 12px;">✅ Active</span>';
    }
    
    return '<span style="font-size: 11px; padding: 3px 8px; background: #fef3c7; color: #ca8a04; border-radius: 12px;">⏸️ Idle</span>';
}

    function formatTimeAgo(dateLike) {
if (!dateLike) return 'Never';

// Accept Date, ISO string, or timestamp (seconds/milliseconds)
let d = dateLike instanceof Date ? dateLike : new Date(dateLike);
// If it’s a numeric string like "1729012345", treat as seconds epoch
if (!(d instanceof Date) || isNaN(d.getTime())) {
    const n = Number(dateLike);
    if (!Number.isNaN(n)) {
    d = new Date(n > 1e12 ? n : n * 1000);
    }
}
if (isNaN(d.getTime())) return 'Unknown';

const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
if (seconds < 60)    return 'Just now';
if (seconds < 3600)  return Math.floor(seconds / 60) + ' min ago';
if (seconds < 86400) return Math.floor(seconds / 3600) + ' hrs ago';
if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';

return d.toLocaleDateString('en-IN');
}


/** Hosts sign up on their own and have no commercial relationship with
 *  Hostizzy, so the commission-rate and managed-by-Hostizzy fields are
 *  meaningless to them — and the commission field is *required*, which
 *  would otherwise block them from adding a property at all. */
function isSelfServeHost() {
    return currentUser?.userType === 'owner' && isHostAccount(currentUser);
}

function openPropertyModal() {
    const hostizzyOnly = !isSelfServeHost();
    document.querySelectorAll('#propertyModal .hostizzy-only').forEach(el => {
        el.style.display = hostizzyOnly ? '' : 'none';
    });
    document.getElementById('propertyModal').classList.add('active');
}

function closePropertyModal() {
    document.getElementById('propertyModal').classList.remove('active');
    document.getElementById('propertyName').value = '';
    document.getElementById('propertyLocation').value = '';
    document.getElementById('propertyCapacity').value = '4';
    document.getElementById('propertyCommissionRate').value = '';
    const managed = document.getElementById('propertyIsManaged');
    if (managed) managed.checked = false;
    const mode = document.getElementById('propertyRentalMode');
    if (mode) mode.value = 'whole';
}

// Integration Info Modal Functions
function showIntegrationInfo(integrationType) {
    const integrationData = {
        email: {
            title: '📧 Email Integration',
            icon: '📧',
            description: 'Send booking confirmations, payment reminders, and guest communications via your connected Gmail account.',
            features: [
                'Automated booking confirmations',
                'Payment reminder emails',
                'Check-in/check-out notifications',
                'Custom email templates',
                'Daily summary digest'
            ],
            providers: ['Gmail (OAuth)'],
            status: 'Available now — connect Gmail in Settings → Email'
        },
        whatsapp: {
            title: '<i data-lucide="message-circle" style="width: 12px; height: 12px; margin-right: 3px;"></i>WhatsApp Business API',
            icon: '💬',
            description: 'Send WhatsApp messages to guests via wa.me links or the WhatsApp Business API.',
            features: [
                'Instant booking confirmations',
                'Payment reminders via WhatsApp',
                'Approved template messaging (WABA)',
                'Per-property reply numbers',
                'Daily target broadcasts to team'
            ],
            providers: ['wa.me links', 'WhatsApp Business API (Meta Cloud)'],
            status: 'Available now — configure in Settings → WhatsApp'
        },
        payment: {
            title: '💳 Payment Gateway',
            icon: '💳',
            description: 'Accept online payments directly from guests. Currently in development — for now, record payments manually and share UPI/bank details.',
            features: [
                'Online payment collection (planned)',
                'UPI, cards, wallets (planned)',
                'Automatic reconciliation (planned)',
                'Refund management (planned)'
            ],
            providers: ['Razorpay (planned)', 'Stripe (planned)'],
            status: 'Coming soon — manual payment recording works today'
        },
        calendar: {
            title: '📆 Calendar Sync',
            icon: '📆',
            description: 'Import iCal feeds from Airbnb, Booking.com and other OTAs to prevent double bookings. Two-way sync planned.',
            features: [
                'iCal feed import (Airbnb, Booking.com)',
                'Block dates from external bookings',
                'Manual availability calendar',
                'Two-way push sync (planned)'
            ],
            providers: ['iCal feed import (working)', 'Google Calendar push (planned)'],
            status: 'Partial — iCal import works in Availability'
        }
    };

    const data = integrationData[integrationType];

    if (!data) return;

    document.getElementById('integrationModalTitle').textContent = data.title;

    const featuresHTML = data.features.map(feature =>
        `<div style="display: flex; align-items: start; gap: 12px; padding: 8px 0;">
            <span style="color: var(--success); font-size: 20px; flex-shrink: 0;">✓</span>
            <span style="color: var(--text-primary);">${feature}</span>
        </div>`
    ).join('');

    const providersHTML = data.providers.map(provider =>
        `<span style="background: var(--background); padding: 6px 12px; border-radius: 6px; font-size: 13px; color: var(--text-primary);">${provider}</span>`
    ).join('');

    document.getElementById('integrationModalBody').innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="font-size: 64px; margin-bottom: 16px;">${data.icon}</div>
            <p style="color: var(--text-secondary); font-size: 15px; line-height: 1.6;">${data.description}</p>
        </div>

        <div style="background: var(--background); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 16px 0; color: var(--text-primary); font-size: 16px;">Key Features:</h4>
            ${featuresHTML}
        </div>

        <div style="margin-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-primary); font-size: 16px;">Supported Providers:</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${providersHTML}
            </div>
        </div>

        <div style="background: linear-gradient(135deg, rgba(8, 145, 178, 0.1) 0%, rgba(8, 145, 178, 0.1) 100%); padding: 16px; border-radius: 12px; border-left: 4px solid var(--primary);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">⏰</span>
                <div>
                    <strong style="color: var(--text-primary);">${data.status}</strong>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-secondary);">
                        Contact support@hostizzy.com to request early access or get notified when this integration is available.
                    </p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('integrationInfoModal').style.display = 'flex';
    document.getElementById('integrationInfoModal').classList.add('active');

    // Update email subject
    const emailSubject = `Integration Request - ${data.title}`;
    document.querySelector('#integrationInfoModal .btn-primary').href =
        `mailto:support@hostizzy.com?subject=${encodeURIComponent(emailSubject)}`;
}

function closeIntegrationModal() {
    document.getElementById('integrationInfoModal').style.display = 'none';
    document.getElementById('integrationInfoModal').classList.remove('active');
}

async function saveProperty() {
    try {
        const isHost = isSelfServeHost();
        // Hosts keep 100% of their revenue — there is no Hostizzy share to
        // withhold, so the rate is fixed at 0 and the field is never shown.
        const commissionRate = isHost ? 0 : parseFloat(document.getElementById('propertyCommissionRate').value);

        if (!document.getElementById('propertyName').value || !document.getElementById('propertyLocation').value) {
            showToast('Validation Error', 'Please fill in all required fields', '❌');
            return;
        }

        // For managed properties the commission rate is required — no silent
        // default. Without it we cannot compute hostizzy_revenue correctly for
        // any reservation on this property.
        if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
            showToast('Validation Error', 'Commission rate is required and must be between 0 and 100%', '❌');
            return;
        }

        const property = {
            name: document.getElementById('propertyName').value,
            location: document.getElementById('propertyLocation').value,
            type: document.getElementById('propertyType').value,
            capacity: parseInt(document.getElementById('propertyCapacity').value),
            revenue_share_percent: commissionRate,
            is_managed: isHost ? false : (document.getElementById('propertyIsManaged')?.checked || false)
        };

        // Auto-set owner_id for external owners
        if (isHost) {
            property.owner_id = currentUser.id;
        }

        // properties.id defaults to nextval('properties_id_seq'), so let the
        // database assign it — two people adding a property at the same moment
        // can't collide. This used to be computed here as max(id)+1, which
        // raced, and which is also why the sequence fell behind the table:
        // supplying an explicit id doesn't advance it.
        //
        // sql/properties-id-sequence.sql resyncs it. Until that has been run,
        // the sequence hands out numbers that are already taken, so fall back
        // to the old client-side allocation on a key conflict. That makes the
        // deploy order not matter.
        const isIdClash = (e) => !!e && (e.code === '23505' || /duplicate key/i.test(e.message || ''));

        let { data, error } = await supabase.from('properties').insert([property]).select();

        for (let attempt = 0; isIdClash(error) && attempt < 4; attempt++) {
            const { data: highest, error: fetchError } = await supabase
                .from('properties')
                .select('id')
                .order('id', { ascending: false })
                .limit(1);
            if (fetchError) throw fetchError;

            property.id = highest?.length > 0 ? (highest[0].id + 1) : 1;
            ({ data, error } = await supabase.from('properties').insert([property]).select());
        }

        if (error) throw error;

        // Refresh scoped property IDs after adding a new property
        await db.refreshPropertyScope();

        // This function only ever creates — editing goes through
        // savePropertySettings() — so a new property is always the case here.
        const wantsRooms = document.getElementById('propertyRentalMode')?.value === 'rooms';
        const created = data?.[0] || property;

        closePropertyModal();
        await loadProperties(); // Refresh the properties list
        showToast('Success', 'Property saved!', '✅');

        // Nothing else surfaces rooms during setup, so take them straight
        // there rather than relying on them finding the button on the card.
        if (wantsRooms && created?.id) {
            openRoomsManager(created.id, created.name);
        }
    } catch (error) {
        showToast('Error', 'Failed to save property: ' + error.message, '❌');
    }
}
async function deleteProperty(id) {
    if (!confirm('Delete this property?')) return;
    
    try {
        await db.deleteProperty(id);
        await loadProperties();
        showToast('Deleted', 'Property deleted successfully', '✅');
    } catch (error) {
        console.error('Delete property error:', error);
        showToast('Error', 'Failed to delete property', '❌');
    }
}


// ==========================================
// PROPERTY SETTINGS FUNCTIONS
// ==========================================

/**
 * Open property settings modal
 */
async function openPropertySettings(propertyId) {
    try {
        // Fetch property details
        const { data: property, error } = await supabase
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single();

        if (error) throw error;

        // Populate modal
        document.getElementById('settingsPropertyId').value = propertyId;
        document.getElementById('settingsModalTitle').textContent = `${property.name} Settings`;
        document.getElementById('settingsPropertyName').textContent = property.name;
        document.getElementById('settingsPropertyLocation').textContent = property.location || 'No location set';

        // Rooms summary — reflects how this property is actually configured.
        (async () => {
            const el = document.getElementById('settingsRoomsSummary');
            if (!el) return;
            try {
                const rooms = (await db.getRooms(propertyId)).filter(r => r.is_active !== false);
                el.textContent = rooms.length
                    ? `${rooms.length} room${rooms.length === 1 ? '' : 's'}: ${rooms.map(r => r.name).join(', ')}`
                    : 'Sold as one whole place — add rooms if you rent them separately';
            } catch {
                el.textContent = 'Sold as one whole place';
            }
        })();
        
        // Set property icon based on type
        const iconMap = {
            'Villa': '🏡',
            'Apartment': '🏢',
            'Hotel': '🏨',
            'Hostel': '🏠',
            'Resort': '🌴'
        };
        document.getElementById('settingsPropertyIcon').textContent = iconMap[property.type] || '🏠';

        // Populate commission rate. Show empty (not a fake default) when missing so
        // the user must explicitly enter a value before saving.
        document.getElementById('settingsCommissionRate').value =
            property.revenue_share_percent != null ? property.revenue_share_percent : '';

        // Populate managed toggle
        const managedCheckbox = document.getElementById('settingsIsManaged');
        if (managedCheckbox) managedCheckbox.checked = property.is_managed === true;

        // Populate iCal URL if exists
        document.getElementById('icalUrlInput').value = property.ical_url || '';

        // Show current sync status if URL exists
        if (property.ical_url) {
            document.getElementById('currentSyncStatus').style.display = 'block';
            document.getElementById('currentStatusBadge').innerHTML = getSyncStatusBadge(property);
            
            if (property.ical_last_synced) {
                document.getElementById('currentLastSync').textContent = `Last synced: ${formatTimeAgo(property.ical_last_synced)}`;
            } else {
                document.getElementById('currentLastSync').textContent = 'Never synced';
            }

            // Show error if exists
            if (property.ical_sync_error) {
                document.getElementById('currentSyncError').style.display = 'block';
                document.getElementById('currentSyncError').textContent = `⚠️ Error: ${property.ical_sync_error}`;
            } else {
                document.getElementById('currentSyncError').style.display = 'none';
            }
        } else {
            document.getElementById('currentSyncStatus').style.display = 'none';
        }

        // Show modal
        document.getElementById('propertySettingsModal').style.display = 'flex';

        // Initialize Gmail connection status
        initializeGmailConnection();

    } catch (error) {
        console.error('Error opening property settings:', error);
        showToast('Failed to load property settings', 'error');
    }
}

/**
 * Close property settings modal
 */
/**
 * Open App Settings modal
 */
function openAppSettings() {
    document.getElementById('appSettingsModal').style.display = 'flex';
}

/**
 * Close App Settings modal
 */
function closeAppSettings() {
    document.getElementById('appSettingsModal').style.display = 'none';
}

function closePropertySettings() {
    document.getElementById('propertySettingsModal').style.display = 'none';
    document.getElementById('icalUrlInput').value = '';
    document.getElementById('settingsPropertyId').value = '';
}

/**
 * Save property settings (iCal URL)
 */
async function savePropertySettings() {
    const propertyId = document.getElementById('settingsPropertyId').value;
    const icalUrl = document.getElementById('icalUrlInput').value.trim();
    const commissionRate = parseFloat(document.getElementById('settingsCommissionRate').value);

    // Validate commission rate
    if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        showToast('Please enter a valid commission rate (0-100%)', 'error');
        return;
    }

    // Validate URL if provided
    if (icalUrl) {
        try {
            new URL(icalUrl);

            // Check if it's a valid iCal URL pattern
            if (!icalUrl.includes('ical') && !icalUrl.includes('.ics')) {
                showToast('Please enter a valid iCal URL (should contain "ical" or ".ics")', 'error');
                return;
            }
        } catch (e) {
            showToast('Please enter a valid URL', 'error');
            return;
        }
    }

    try {
        // Show loading
        const saveButton = event.target;
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '⏳ Saving...';
        saveButton.disabled = true;

        // Capture the previous commission rate so we can detect changes and
        // resync existing reservations only when the rate actually changed.
        const { data: existing, error: fetchError } = await supabase
            .from('properties')
            .select('revenue_share_percent')
            .eq('id', propertyId)
            .single();
        if (fetchError) throw fetchError;
        const previousRate = existing ? parseFloat(existing.revenue_share_percent) : null;

        // Update property with new settings
        const isManaged = document.getElementById('settingsIsManaged')?.checked || false;
        const updateData = {
            revenue_share_percent: commissionRate,
            is_managed: isManaged,
            ical_url: icalUrl || null,
            ical_sync_status: icalUrl ? 'idle' : null,
            updated_at: new Date().toISOString()
        };

        // Clear error if URL is being updated
        if (icalUrl) {
            updateData.ical_sync_error = null;
        }

        const { error } = await supabase
            .from('properties')
            .update(updateData)
            .eq('id', propertyId);

        if (error) throw error;

        // If the commission rate changed, resync every active reservation on
        // this property so revenue_share_percent and hostizzy_revenue reflect
        // the new rate immediately. The RPC runs server-side in a single
        // transaction (see sql/resync-property-commissions.sql).
        let resyncCount = null;
        let resyncError = null;
        const rateChanged = previousRate == null || previousRate !== commissionRate;
        if (rateChanged) {
            const { data: count, error: rpcError } = await supabase
                .rpc('resync_property_commissions', { p_property_id: parseInt(propertyId) });
            if (rpcError) {
                console.error('resync_property_commissions failed:', rpcError);
                resyncError = rpcError;
            } else {
                resyncCount = count;
            }
        }

        // Success
        if (rateChanged && resyncError) {
            showToast(
                `Property saved, but failed to resync existing reservations: ${resyncError.message}`,
                'warning'
            );
        } else if (rateChanged && resyncCount != null) {
            showToast(
                `✅ Property saved. Resynced ${resyncCount} reservation(s) to the new commission rate.`,
                'success'
            );
        } else {
            showToast('✅ Property settings saved successfully!', 'success');
        }

        // Close modal
        closePropertySettings();

        // Reload properties to reflect changes
        await loadProperties();

    } catch (error) {
        console.error('Error saving property settings:', error);
        showToast('Failed to save settings', 'error');
        
        // Restore button
        event.target.innerHTML = originalText;
        event.target.disabled = false;
    }
}


// ==========================================
// ICAL SYNC FUNCTIONS
// ==========================================

/**
 * Fetch and parse iCal file from URL
 */
async function fetchAndParseIcal(icalUrl) {
    try {
        // ✅ Normalize Airbnb's "webcal://" URLs
        icalUrl = icalUrl.replace(/^webcal:/i, 'https:');

        // Use our own Vercel serverless function as proxy (more reliable than external CORS proxies)
        const proxyUrl = `/api/ical-proxy?url=${encodeURIComponent(icalUrl)}`;

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'text/calendar, text/plain, */*'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch iCal: ${response.status} ${response.statusText}`);
        }

        const icalData = await response.text();

        // Validate it's an iCal file
        if (!icalData.includes('BEGIN:VCALENDAR')) {
            throw new Error('Invalid iCal format: Missing VCALENDAR');
        }

        // Parse iCal data
        const blockedDates = parseIcalData(icalData);

        return {
            success: true,
            dates: blockedDates,
            rawData: icalData
        };

    } catch (error) {
        console.error('Error fetching iCal:', error);
        return {
            success: false,
            error: error.message,
            dates: []
        };
    }
}

/**
 * Parse iCal data and extract blocked dates + reservation events.
 *
 * Round 5: delegates to IcalParser.parseICS() (js/ical-parser.js), which
 * is a proper RFC 5545 line-based parser with line-unfolding and
 * parameter-safe extraction. This function exists as a thin adapter to
 * preserve the return shape the rest of js/properties.js (saveSyncedDates,
 * syncPropertyNow) expects: a unique sorted date list with a
 * `.reservationEvents` side-channel.
 */
function parseIcalData(icalText) {
    if (typeof IcalParser === 'undefined') {
        console.error('[iCal] IcalParser not loaded — check js/ical-parser.js script tag');
        return Object.assign([], { reservationEvents: [] });
    }

    const { events, errors } = IcalParser.parseICS(icalText);
    if (errors.length > 0) {
        console.warn('[iCal] Parser warnings:', errors);
    }
    console.log(`[iCal] Feed contains ${events.length} valid VEVENT blocks`);

    const reservationEvents = [];
    const blockedDates = [];

    for (const ev of events) {
        console.log(`[iCal] Event: "${ev.summary}" | ${ev.dtstart} → ${ev.dtend} | UID=${ev.uid?.substring(0, 30)}... | class=${ev.classification}`);

        reservationEvents.push({
            uid: ev.uid,
            summary: ev.summary || 'Blocked by OTA',
            description: ev.description || '',
            check_in: ev.dtstart,
            check_out: ev.dtend,
            lastModified: ev.lastModified,
            classification: ev.classification,
        });

        // Expand the date range for the synced_availability rows.
        const dateRange = getDateRange(ev.dtstart, ev.dtend);
        for (const date of dateRange) {
            blockedDates.push({
                date: date,
                summary: ev.summary || 'Blocked by OTA',
                uid: ev.uid,
                eventData: {
                    check_in: ev.dtstart,
                    check_out: ev.dtend,
                    description: ev.description,
                },
            });
        }
    }

    const uniqueDates = Array.from(new Map(blockedDates.map(d => [d.date, d])).values());
    uniqueDates.sort((a, b) => new Date(a.date) - new Date(b.date));
    uniqueDates.reservationEvents = reservationEvents;
    return uniqueDates;
}

// UTC-safe date range: inclusive start, exclusive end (iCal spec)
function getDateRange(startDate, endDate) {
// startDate/endDate are "YYYY-MM-DD"
const [sy, sm, sd] = startDate.split('-').map(Number);
const [ey, em, ed] = endDate.split('-').map(Number);

let current = new Date(Date.UTC(sy, sm - 1, sd));
const end = new Date(Date.UTC(ey, em - 1, ed));

const dates = [];
while (current < end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    // advance one UTC day
    current.setUTCDate(current.getUTCDate() + 1);
}
return dates;
}

/**
 * Save synced dates to database
 */
async function saveSyncedDates(propertyId, blockedDates, source = 'ical') {
    try {
        // First, delete existing synced dates for this property from this source
        const { error: deleteError } = await supabase
            .from('synced_availability')
            .delete()
            .eq('property_id', propertyId)
            .eq('source', source);

        if (deleteError) throw deleteError;

        // Prepare batch insert data
        const insertData = blockedDates.map(item => ({
            property_id: propertyId,
            blocked_date: item.date,
            source: source,
            booking_summary: item.summary || 'Blocked by OTA',
            synced_at: new Date().toISOString()
        }));

        // Insert in batches of 100 to avoid payload size limits
        const batchSize = 100;
        for (let i = 0; i < insertData.length; i += batchSize) {
            const batch = insertData.slice(i, i + batchSize);

            const { error: insertError } = await supabase
                .from('synced_availability')
                .insert(batch);

            if (insertError) throw insertError;
        }

        return {
            success: true,
            count: insertData.length
        };

    } catch (error) {
        console.error('Error saving synced dates:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// =====================================================
// ROUND 5 — iCal sync (diff-based)
// =====================================================
// New flow vs. the old per-event INSERT/UPDATE loop:
//
//   1. Query existing reservations for this property that have an
//      ical_uid set and aren't cancelled. That's our "previous sync"
//      snapshot — no separate snapshot table needed.
//
//   2. Walk the parsed feed once and diff against the snapshot:
//        newUIDs       → INSERT a fresh shell
//        modifiedUIDs  → UPDATE if feed.lastModified newer than stored
//        cancelledUIDs → mark status='cancelled' + applyCancellationCleanup
//                        (existing UIDs no longer present in the feed)
//
//   3. Events whose classification is 'blocked' (owner/maintenance
//      holds) never become reservations — they only show up in the
//      synced_availability table via saveSyncedDates.
//
//   4. Full UID is stored in ical_uid (TEXT). booking_id starts out as
//      the UID too, but gets overwritten to the human-readable OTA
//      reference later when processGmailBookingEmail merges the
//      confirmation email into the shell. Email merge preserves
//      ical_uid so future syncs can still diff-match this row.
// =====================================================

// Derive guest_name + booking_source from the event SUMMARY.
// Airbnb uses privacy strings ("Not available", "Reserved") for real
// bookings; booking.com / direct feeds may include an actual name.
function deriveGuestNameAndSource(event) {
    let guestName = 'Guest';
    let bookingSource = 'OTHER';
    if (!event.summary) return { guestName, bookingSource };

    const summaryUpper = event.summary.toUpperCase();
    if (summaryUpper.includes('AIRBNB')) {
        bookingSource = 'AIRBNB';
    } else if (summaryUpper.includes('BOOKING') || summaryUpper.includes('AGODA')) {
        bookingSource = 'AGODA/BOOKING.COM';
    } else if (summaryUpper.includes('MMT') || summaryUpper.includes('GOIBIBO') || summaryUpper.includes('MAKEMYTRIP')) {
        bookingSource = 'MMT/GOIBIBO';
    } else if (summaryUpper.includes('DIRECT')) {
        bookingSource = 'DIRECT';
    } else if (summaryUpper === 'RESERVED' || summaryUpper === 'BOOKED') {
        bookingSource = 'AIRBNB';
    }

    const privacySummaries = ['NOT AVAILABLE', 'UNAVAILABLE', 'RESERVED', 'BOOKED', 'CLOSED'];
    const isPrivacySummary = privacySummaries.some(p => summaryUpper.includes(p));
    if (isPrivacySummary) {
        guestName = `${bookingSource} Guest`;
    } else {
        const nameMatch = event.summary.match(/^([^(]+)/);
        if (nameMatch) guestName = nameMatch[1].trim();
    }
    return { guestName, bookingSource };
}

// Pick a sensible reservation.status from the check-in/check-out dates.
function deriveStatusFromDates(checkIn, checkOut) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    if (co <= today) return 'checked-out';
    if (ci <= today && co > today) return 'checked-in';
    return 'confirmed';
}

async function createReservationsFromIcal(propertyId, reservationEvents, property) {
    if (!reservationEvents || reservationEvents.length === 0) {
        return { created: 0, updated: 0, skipped: 0, cancelled: 0 };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let cancelled = 0;

    try {
        console.log(`[iCal] Processing ${reservationEvents.length} events for property ${propertyId}`);

        // ----------------------------------------------------------
        // 1. Load the "previous sync" snapshot: every active
        //    reservation on this property that has an ical_uid.
        // ----------------------------------------------------------
        const { data: existingRows, error: loadError } = await supabase
            .from('reservations')
            .select('id, ical_uid, ical_last_modified, check_in, check_out, status, guest_name, booking_source, stay_amount, total_amount')
            .eq('property_id', propertyId)
            .not('ical_uid', 'is', null)
            .neq('status', 'cancelled');

        if (loadError) {
            console.error('[iCal] Failed to load existing reservations for diff:', loadError);
            return { created: 0, updated: 0, skipped: 0, cancelled: 0, error: loadError.message };
        }

        const existingByUid = new Map();
        for (const row of (existingRows || [])) {
            if (row.ical_uid) existingByUid.set(row.ical_uid, row);
        }
        console.log(`[iCal] Previous sync snapshot: ${existingByUid.size} reservation(s) with ical_uid`);

        // ----------------------------------------------------------
        // 2. Walk the feed. Track which UIDs we saw so we can compute
        //    the cancelled set after the loop.
        // ----------------------------------------------------------
        const seenUids = new Set();
        const truncatedPropertyName = property.name ? property.name.substring(0, 50) : '';

        for (const event of reservationEvents) {
            if (!event.uid || !event.check_in || !event.check_out) {
                console.log(`[iCal]   ✗ Skipping event missing uid/dates`);
                skipped++;
                continue;
            }
            seenUids.add(event.uid);

            // Blocked events (owner holds / maintenance) do not become
            // reservations. They still drive synced_availability via
            // saveSyncedDates. Skip here.
            if (event.classification === 'blocked') {
                console.log(`[iCal]   · BLOCKED (owner/maintenance) "${event.summary}" — not creating reservation`);
                skipped++;
                continue;
            }

            const { guestName, bookingSource } = deriveGuestNameAndSource(event);
            const truncatedGuestName = guestName.substring(0, 50);
            const nights = Math.ceil((new Date(event.check_out) - new Date(event.check_in)) / (1000 * 60 * 60 * 24));
            const monthDate = new Date(event.check_in);
            const month = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            const reservationStatus = deriveStatusFromDates(event.check_in, event.check_out);

            const existing = existingByUid.get(event.uid);

            if (existing) {
                // ------------------------------------------------------
                // MODIFIED? Only update if something meaningful changed.
                // We compare LAST-MODIFIED first (cheap); fall back to
                // date comparison if the feed didn't provide it.
                // ------------------------------------------------------
                const feedTs = event.lastModified ? new Date(event.lastModified).getTime() : null;
                const storedTs = existing.ical_last_modified ? new Date(existing.ical_last_modified).getTime() : null;

                const lastModifiedChanged = feedTs && storedTs && feedTs > storedTs;
                const datesChanged =
                    existing.check_in !== event.check_in ||
                    existing.check_out !== event.check_out;

                if (!lastModifiedChanged && !datesChanged) {
                    // Nothing meaningful changed — leave the row alone.
                    // (Don't touch financial data; email-merge may have
                    // populated it already.)
                    console.log(`[iCal]   = UNCHANGED uid=${event.uid.substring(0, 30)}`);
                    continue;
                }

                const updateData = {
                    check_in: event.check_in,
                    check_out: event.check_out,
                    nights: nights,
                    month: month,
                    ical_last_modified: event.lastModified || new Date().toISOString(),
                    ical_classification: event.classification || null,
                    updated_at: new Date().toISOString(),
                };

                // Only bump guest_name / booking_source if the shell is
                // still un-enriched. Once an email-merge has filled in
                // real financial data we leave the enriched name alone.
                const enriched = (existing.stay_amount != null || existing.total_amount != null);
                if (!enriched) {
                    updateData.guest_name = truncatedGuestName;
                    updateData.booking_source = bookingSource;
                }

                // Auto-correct past reservations still sitting on 'confirmed'
                if (existing.status === 'confirmed' && reservationStatus !== 'confirmed') {
                    updateData.status = reservationStatus;
                }

                const { error: updateError } = await supabase
                    .from('reservations')
                    .update(updateData)
                    .eq('id', existing.id);

                if (updateError) {
                    console.error('[iCal]   ✗ UPDATE failed:', updateError);
                    skipped++;
                } else {
                    console.log(`[iCal]   ↻ UPDATED uid=${event.uid.substring(0, 30)} ${event.check_in} → ${event.check_out}`);
                    updated++;
                }
            } else {
                // ------------------------------------------------------
                // NEW — insert a shell. Full UID stored in both
                // ical_uid (sync key) and booking_id (display key;
                // later overwritten by email-merge).
                // ------------------------------------------------------
                const reservationData = {
                    booking_id: event.uid,
                    ical_uid: event.uid,
                    ical_last_modified: event.lastModified || new Date().toISOString(),
                    ical_classification: event.classification || 'booked',
                    property_id: propertyId,
                    property_name: truncatedPropertyName,
                    guest_name: truncatedGuestName,
                    guest_phone: '',
                    guest_email: '',
                    guest_city: '',
                    check_in: event.check_in,
                    check_out: event.check_out,
                    booking_date: new Date().toISOString().split('T')[0],
                    month: month,
                    nights: nights,
                    booking_type: 'STAYCATION',
                    booking_source: bookingSource,
                    status: reservationStatus,
                    // Financial fields intentionally null — will be
                    // populated when the OTA confirmation email arrives
                    // and processGmailBookingEmail merges into this shell.
                    number_of_rooms: null,
                    adults: null,
                    kids: null,
                    number_of_guests: null,
                    stay_amount: null,
                    extra_guest_charges: null,
                    meals_chef: null,
                    bonfire_other: null,
                    ota_service_fee: null,
                    taxes: null,
                    total_amount_pre_tax: null,
                    total_amount_inc_tax: null,
                    total_amount: null,
                    damages: null,
                    hostizzy_revenue: null,
                    host_payout: null,
                    payout_eligible: null,
                    revenue_share_percent: null,
                    avg_room_rate: null,
                    avg_nightly_rate: null,
                    paid_amount: null,
                    payment_status: null,
                    gst_status: null,
                };

                const { error: insertError } = await supabase
                    .from('reservations')
                    .insert([reservationData]);

                if (insertError) {
                    console.error('[iCal]   ✗ CREATE failed:', insertError);
                    skipped++;
                } else {
                    console.log(`[iCal]   + CREATED uid=${event.uid.substring(0, 30)} ${event.check_in} → ${event.check_out} (${guestName}) [${reservationStatus}]`);
                    created++;
                }
            }
        }

        // ----------------------------------------------------------
        // 3. CANCELLED = snapshot UIDs that did NOT appear in this
        //    feed sync. Mark each one cancelled and purge financial
        //    fields via the shared cleanup helper.
        // ----------------------------------------------------------
        for (const [uid, row] of existingByUid.entries()) {
            if (seenUids.has(uid)) continue;

            // applyCancellationCleanup lives in js/reservations.js and
            // is loaded globally on the browser side. We pass a fresh
            // object and let it null every non-essential field, then
            // write the subset of columns we're actually touching.
            const scrub = applyCancellationCleanup({});
            scrub.status = 'cancelled';
            scrub.updated_at = new Date().toISOString();

            const { error: cancelError } = await supabase
                .from('reservations')
                .update(scrub)
                .eq('id', row.id);

            if (cancelError) {
                console.error(`[iCal]   ✗ CANCEL failed uid=${uid.substring(0, 30)}:`, cancelError);
                skipped++;
            } else {
                console.log(`[iCal]   × CANCELLED uid=${uid.substring(0, 30)} (vanished from feed)`);
                cancelled++;
            }
        }

        return { created, updated, skipped, cancelled };

    } catch (error) {
        console.error('Error creating reservations from iCal:', error);
        return { created, updated, skipped, cancelled, error: error.message };
    }
}

/**
 * Update property sync status
 */
async function updatePropertySyncStatus(propertyId, status, error = null) {
    try {
        const updateData = {
            ical_sync_status: status,
            ical_last_synced: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (error) {
            updateData.ical_sync_error = error;
        } else {
            updateData.ical_sync_error = null;
        }

        const { error: updateError } = await supabase
            .from('properties')
            .update(updateData)
            .eq('id', propertyId);

        if (updateError) throw updateError;

        return true;

    } catch (err) {
        console.error('Error updating sync status:', err);
        return false;
    }
}

/**
 * Sync property availability now (manual trigger)
 */
async function syncPropertyNow(propertyId, event) {
    let syncButton = null;
    let originalHTML = '';
    
    try {
        // Get property details
        const { data: property, error: propError } = await supabase
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single();

        if (propError) throw propError;

        // Check if iCal URL exists
        if (!property.ical_url) {
            showToast('⚠️ No iCal URL configured for this property', 'error');
            return;
        }

        // Update button state if event is provided
        if (event && event.target) {
            syncButton = event.target;
            originalHTML = syncButton.innerHTML;
            syncButton.innerHTML = '⏳ Syncing...';
            syncButton.disabled = true;
        }

        // Show progress toast
        showToast('🔄 Fetching availability from OTA...', 'info');

        // Update status to syncing
        await updatePropertySyncStatus(propertyId, 'syncing');

        // Fetch and parse iCal
        const result = await fetchAndParseIcal(property.ical_url);

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch iCal data');
        }

        // Check if we got any dates
        if (result.dates.length === 0) {
            await updatePropertySyncStatus(propertyId, 'active');
            showToast('✅ Sync completed - No blocked dates found', 'success');
            await loadProperties();
            return;
        }

        // Save synced dates to database
        showToast(`💾 Saving ${result.dates.length} blocked dates...`, 'info');

        const saveResult = await saveSyncedDates(propertyId, result.dates, 'ical');

        if (!saveResult.success) {
            throw new Error(saveResult.error || 'Failed to save synced dates');
        }

        // AUTO-IMPORT: Create/update reservations from iCal events
        const reservationEvents = result.dates.reservationEvents || [];
        if (reservationEvents.length > 0) {
            showToast(`📝 Creating/updating ${reservationEvents.length} reservations...`, 'info');

            const importResult = await createReservationsFromIcal(propertyId, reservationEvents, property);

            console.log('iCal import result:', importResult);

            // Reload reservations to show new/updated ones
            await loadReservations();
            await loadDashboard();

            // Show detailed success message
            const importMsg = [];
            if (importResult.created > 0) importMsg.push(`${importResult.created} created`);
            if (importResult.updated > 0) importMsg.push(`${importResult.updated} updated`);
            if (importResult.cancelled > 0) importMsg.push(`${importResult.cancelled} cancelled`);
            if (importResult.skipped > 0) importMsg.push(`${importResult.skipped} skipped`);

            if (importMsg.length > 0) {
                showToast(`✅ Reservations: ${importMsg.join(', ')}`, 'success');
            }
        }

        // Update status to active
        await updatePropertySyncStatus(propertyId, 'active');

        // Success!
        showToast(`✅ Sync completed! ${saveResult.count} dates blocked`, 'success');

        // Reload properties to show updated status
        await loadProperties();

    } catch (error) {
        console.error('Error syncing property:', error);
        
        // Update status to error
        await updatePropertySyncStatus(propertyId, 'error', error.message);
        
        showToast(`❌ Sync failed: ${error.message}`, 'error');
        
        // Reload to show error status
        await loadProperties();

        } finally {
            // Restore button if it still exists
            if (syncButton && originalHTML) {
                syncButton.innerHTML = originalHTML;
                syncButton.disabled = false;
            }
        }
}

// ==========================================
// AUTO-SYNC FUNCTIONS
// ==========================================

let autoSyncIntervals = {}; // Store interval IDs by property

/**
 * Toggle auto-sync info display
 */
function toggleAutoSyncInfo() {
    const enabled = document.getElementById('autoSyncEnabled').checked;
    const infoDiv = document.getElementById('autoSyncInfo');
    
    if (enabled) {
        infoDiv.style.display = 'block';
        updateNextSyncTime();
    } else {
        infoDiv.style.display = 'none';
    }
}

/**
 * Update next sync time display
 */
function updateNextSyncTime() {
    const now = new Date();
    const nextSync = new Date(now.getTime() + (6 * 60 * 60 * 1000)); // 6 hours from now
    document.getElementById('nextSyncTime').textContent = nextSync.toLocaleString();
}

/**
 * Start auto-sync for a property
 */
function startAutoSync(propertyId) {
    // Clear existing interval if any
    if (autoSyncIntervals[propertyId]) {
        clearInterval(autoSyncIntervals[propertyId]);
    }
    
    // Set up auto-sync every 6 hours (6 * 60 * 60 * 1000 ms)
    const syncInterval = 6 * 60 * 60 * 1000; // 6 hours
    
    autoSyncIntervals[propertyId] = setInterval(async () => {
        console.log(`🔄 Auto-syncing property ${propertyId}...`);
        try {
            await syncPropertyNow(propertyId);
            console.log(`✅ Auto-sync completed for property ${propertyId}`);
        } catch (error) {
            console.error(`❌ Auto-sync failed for property ${propertyId}:`, error);
        }
    }, syncInterval);
    
    console.log(`✅ Auto-sync enabled for property ${propertyId} (every 6 hours)`);
}

/**
 * Stop auto-sync for a property
 */
function stopAutoSync(propertyId) {
    if (autoSyncIntervals[propertyId]) {
        clearInterval(autoSyncIntervals[propertyId]);
        delete autoSyncIntervals[propertyId];
        console.log(`⏹️ Auto-sync disabled for property ${propertyId}`);
    }
}

/**
 * Initialize auto-sync for all properties with iCal URLs
 */
async function initializeAutoSync() {
    try {
        const { data: properties, error } = await supabase
            .from('properties')
            .select('id, name, ical_url, auto_sync_enabled')
            .eq('is_active', true)
            .not('ical_url', 'is', null);
        
        if (error) throw error;
        
        if (properties && properties.length > 0) {
            properties.forEach(property => {
                // Check if auto_sync_enabled column exists and is true
                // For now, auto-enable for all properties with iCal URLs
                startAutoSync(property.id);
            });
            
            console.log(`🔄 Auto-sync initialized for ${properties.length} properties`);
        }
    } catch (error) {
        console.error('Error initializing auto-sync:', error);
    }
}


// ============================================================
// ROOMS MANAGER
// ============================================================
// Rooms are optional. A property with none is sold whole, which is the
// default and correct for villas and farmstays. Adding rooms switches the
// property to per-room selling, while still allowing the whole place to be
// booked as one unit — the database enforces that a whole-property booking
// and a room booking can't overlap.

// Opens the rooms manager for whichever property Settings is currently showing.
window.openRoomsFromSettings = async function() {
    const id = document.getElementById('settingsPropertyId')?.value;
    if (!id) return;
    const name = document.getElementById('settingsPropertyName')?.textContent || 'Property';
    openRoomsManager(parseInt(id), name);
};

window.openRoomsManager = async function(propertyId, propertyName) {
    let rooms = [];
    try {
        rooms = await db.getRooms(propertyId);
    } catch (e) {
        showToast('Error', 'Could not load rooms: ' + e.message, '❌');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'roomsManagerModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 620px;">
            <div class="modal-header">
                <h3 class="modal-title">Rooms &mdash; ${escapeHtml(propertyName || 'Property')}</h3>
                <button class="close-btn" onclick="closeRoomsManager()">&times;</button>
            </div>
            <div style="padding: 20px;">
                <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
                    Leave this empty if you rent the whole place. Add rooms only if you sell them
                    individually &mdash; you'll still be able to book the entire property as one unit.
                </p>
                <div id="roomsList"></div>

                <!-- Outbound feeds. Separate from the room list because these
                     are shared with third parties, not internal settings. -->
                <details style="margin-top:18px;border:1px solid var(--border);border-radius:8px;padding:12px 14px;">
                    <summary style="cursor:pointer;font-weight:600;font-size:13px;">
                        Channel sync &mdash; share your calendar with Airbnb &amp; Booking.com
                    </summary>
                    <p style="font-size:12px;color:var(--text-secondary);margin:10px 0 12px;">
                        Paste these links into the channel's <em>Import calendar</em> setting. They'll stop
                        selling dates you've filled here. Channels refresh every few hours, so this reduces
                        double bookings rather than eliminating them outright.
                    </p>
                    <div id="feedList"></div>
                </details>

                <div style="margin-top:18px;padding-top:18px;border-top:1px solid var(--border);">
                    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end;">
                        <div class="form-group" style="margin:0;">
                            <label style="font-size:12px;">Room name</label>
                            <input type="text" id="newRoomName" placeholder="Garden Room">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label style="font-size:12px;">Sleeps</label>
                            <input type="number" id="newRoomCapacity" min="1" placeholder="2">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label style="font-size:12px;">Rate/night</label>
                            <input type="number" id="newRoomRate" min="0" step="0.01" placeholder="3500">
                        </div>
                        <button class="btn btn-primary" onclick="addRoom(${propertyId})" style="height:40px;white-space:nowrap;">Add</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeRoomsManager(); });
    renderRoomsList(rooms, propertyId);
    renderFeedList(rooms, propertyId);
};

function renderRoomsList(rooms, propertyId) {
    const el = document.getElementById('roomsList');
    if (!el) return;

    if (!rooms.length) {
        el.innerHTML = `<div style="padding:22px;text-align:center;color:var(--text-secondary);
            border:1px dashed var(--border);border-radius:8px;font-size:13px;">
            No rooms yet &mdash; this property is sold as a whole place.</div>`;
        return;
    }

    el.innerHTML = rooms.map(r => `
        <div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);">
            <div style="flex:1;">
                <div style="font-weight:600;font-size:14px;">${escapeHtml(r.name)}</div>
                <div style="font-size:12px;color:var(--text-secondary);">
                    ${r.capacity ? `Sleeps ${r.capacity}` : 'Capacity not set'}
                    ${r.base_rate ? ` &middot; ₹${Number(r.base_rate).toLocaleString('en-IN')}/night` : ''}
                    ${r.ical_url ? ' &middot; calendar linked' : ''}
                </div>
            </div>
            <button class="btn btn-sm" onclick="deleteRoom(${r.id}, ${propertyId})"
                style="color:var(--danger);border:1px solid var(--danger);background:transparent;">Remove</button>
        </div>`).join('');
}

function renderFeedList(rooms, propertyId) {
    const el = document.getElementById('feedList');
    if (!el) return;

    const active = rooms.filter(r => r.is_active !== false);
    // A property with rooms still publishes a whole-property feed, because the
    // whole place may also be listed. With no rooms, that's the only feed.
    const targets = [{ kind: 'property', id: propertyId, label: 'Whole property' }]
        .concat(active.map(r => ({ kind: 'room', id: r.id, label: r.name })));

    el.innerHTML = targets.map(t => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:600;">${escapeHtml(t.label)}</div>
                <div id="feedUrl-${t.kind}-${t.id}" style="font-size:11px;color:var(--text-secondary);
                    word-break:break-all;font-family:monospace;">Not generated yet</div>
            </div>
            <button class="btn btn-sm" onclick="generateFeedUrl('${t.kind}', ${t.id})"
                style="white-space:nowrap;">Get link</button>
        </div>`).join('');
}

window.generateFeedUrl = async function(kind, id) {
    const target = document.getElementById(`feedUrl-${kind}-${id}`);
    if (!target) return;
    target.textContent = 'Generating…';
    try {
        const token = await db.ensureFeedToken(kind, id);
        const url = `${window.location.origin}/api/ical-feed?t=${token}`;
        target.innerHTML = `<span style="user-select:all;">${escapeHtml(url)}</span>`;
        try {
            await navigator.clipboard.writeText(url);
            showToast('Link copied', 'Paste it into the channel\'s Import calendar setting', '✅');
        } catch {
            showToast('Link ready', 'Select and copy the link shown', 'ℹ️');
        }
    } catch (e) {
        target.textContent = 'Could not generate';
        const msg = /column .*ical_feed_token|does not exist/i.test(e.message || '')
            ? 'Run sql/ical-feed-tokens.sql first.'
            : e.message;
        showToast('Error', msg, '❌');
    }
};

window.addRoom = async function(propertyId) {
    const name = document.getElementById('newRoomName').value.trim();
    if (!name) { showToast('Name needed', 'Give the room a name so you can tell them apart', '⚠️'); return; }

    const capacity = parseInt(document.getElementById('newRoomCapacity').value) || null;
    const rate = parseFloat(document.getElementById('newRoomRate').value) || null;

    try {
        await db.saveRoom({ property_id: propertyId, name, capacity, base_rate: rate });
        document.getElementById('newRoomName').value = '';
        document.getElementById('newRoomCapacity').value = '';
        document.getElementById('newRoomRate').value = '';
        const fresh = await db.getRooms(propertyId);
        renderRoomsList(fresh, propertyId);
        renderFeedList(fresh, propertyId);
        showToast('Room added', `${name} is now bookable separately`, '✅');
    } catch (e) {
        const msg = /duplicate key|idx_rooms_property_name/i.test(e.message || '')
            ? `You already have a room called "${name}" here.`
            : e.message;
        showToast('Could not add room', msg, '❌');
    }
};

window.deleteRoom = async function(roomId, propertyId) {
    if (!confirm('Remove this room? Bookings already on it will revert to the whole property.')) return;
    try {
        await db.deleteRoom(roomId);
        const fresh = await db.getRooms(propertyId);
        renderRoomsList(fresh, propertyId);
        renderFeedList(fresh, propertyId);
        showToast('Room removed', '', '✅');
    } catch (e) {
        showToast('Error', e.message, '❌');
    }
};

window.closeRoomsManager = function() {
    document.getElementById('roomsManagerModal')?.remove();
    // Settings may still be open behind this — refresh its summary so it
    // doesn't show a stale room list.
    const id = document.getElementById('settingsPropertyId')?.value;
    const el = document.getElementById('settingsRoomsSummary');
    if (id && el) {
        db.getRooms(parseInt(id))
          .then(rooms => {
              const active = rooms.filter(r => r.is_active !== false);
              el.textContent = active.length
                  ? `${active.length} room${active.length === 1 ? '' : 's'}: ${active.map(r => r.name).join(', ')}`
                  : 'Sold as one whole place — add rooms if you rent them separately';
          })
          .catch(() => {});
    }
};
