// ResIQ Properties — Property CRUD, settings, iCal sync, auto-sync

async function loadProperties() {
    try {
        const properties = await db.getProperties();
        const reservations = await db.getReservations();
        const payments = await db.getAllPayments();
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
                        <div class="prop-type-row">${p.type || 'Property'}</div>
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
                        <button class="prop-action-btn" onclick="openPropertySettings(${p.id})" title="Settings">Settings</button>
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


function openPropertyModal() {
    document.getElementById('propertyModal').classList.add('active');
}

function closePropertyModal() {
    document.getElementById('propertyModal').classList.remove('active');
    document.getElementById('propertyName').value = '';
    document.getElementById('propertyLocation').value = '';
}

// Integration Info Modal Functions
function showIntegrationInfo(integrationType) {
    const integrationData = {
        email: {
            title: '📧 Email Integration',
            icon: '📧',
            description: 'Connect your email service to send automated booking confirmations, payment reminders, and guest communications.',
            features: [
                'Automated booking confirmations',
                'Payment reminder emails',
                'Check-in/check-out notifications',
                'Custom email templates',
                'Bulk email campaigns'
            ],
            providers: ['Gmail', 'Outlook', 'SendGrid', 'Mailgun'],
            status: 'Available in Version 2.0'
        },
        whatsapp: {
            title: '<i data-lucide="message-circle" style="width: 12px; height: 12px; margin-right: 3px;"></i>WhatsApp Business API',
            icon: '💬',
            description: 'Send automated WhatsApp messages to guests for instant communication and better engagement.',
            features: [
                'Instant booking confirmations',
                'Payment reminders via WhatsApp',
                'Real-time guest support',
                'Automated check-in instructions',
                'Review request messages'
            ],
            providers: ['WhatsApp Business API', 'Twilio', 'MessageBird'],
            status: 'Available in Version 2.0'
        },
        payment: {
            title: '💳 Payment Gateway',
            icon: '💳',
            description: 'Accept online payments directly from guests using secure payment gateways.',
            features: [
                'Online payment collection',
                'Multiple payment methods (UPI, Cards, Wallets)',
                'Automatic payment reconciliation',
                'Refund management',
                'Payment analytics'
            ],
            providers: ['Razorpay', 'Stripe', 'PayU', 'Paytm'],
            status: 'Available in Version 2.0'
        },
        calendar: {
            title: '📆 Calendar Sync',
            icon: '📆',
            description: 'Sync your bookings with Google Calendar, Airbnb, Booking.com and other platforms to prevent double bookings.',
            features: [
                'Two-way calendar synchronization',
                'Prevent double bookings',
                'Import bookings from OTAs',
                'Real-time availability updates',
                'Multi-platform integration'
            ],
            providers: ['Google Calendar', 'Airbnb', 'Booking.com', 'iCal'],
            status: 'Available in Version 2.0'
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
        const commissionRate = parseFloat(document.getElementById('propertyCommissionRate').value);

        const property = {
            name: document.getElementById('propertyName').value,
            location: document.getElementById('propertyLocation').value,
            type: document.getElementById('propertyType').value,
            capacity: parseInt(document.getElementById('propertyCapacity').value),
            revenue_share_percent: commissionRate || 15,
            is_managed: document.getElementById('propertyIsManaged')?.checked || false
        };

        if (!property.name || !property.location) {
            showToast('Validation Error', 'Please fill in all required fields', '❌');
            return;
        }

        if (commissionRate < 0 || commissionRate > 100) {
            showToast('Validation Error', 'Commission rate must be between 0 and 100%', '❌');
            return;
        }

        // Get all existing properties to determine next ID
        const { data: existingProperties, error: fetchError } = await supabase
            .from('properties')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);

        if (fetchError) throw fetchError;

        // Calculate next available ID
        const nextId = existingProperties?.length > 0 ?
            (existingProperties[0].id + 1) : 1;

        // Add the ID to property object
        property.id = nextId;

        // Insert the new property
        const { data, error } = await supabase
            .from('properties')
            .insert([property])
            .select();

        if (error) throw error;

        closePropertyModal();
        await loadProperties(); // Refresh the properties list
        showToast('Success', 'Property saved!', '✅');
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
        
        // Set property icon based on type
        const iconMap = {
            'Villa': '🏡',
            'Apartment': '🏢',
            'Hotel': '🏨',
            'Hostel': '🏠',
            'Resort': '🌴'
        };
        document.getElementById('settingsPropertyIcon').textContent = iconMap[property.type] || '🏠';

        // Populate commission rate
        document.getElementById('settingsCommissionRate').value = property.revenue_share_percent || 15;

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

/**
 * Populate the header property dropdown with all properties
 */
async function populateHeaderPropertyDropdown() {
    const select = document.getElementById('headerPropertySelect');
    if (!select) return;

    try {
        const properties = state.properties || await db.getProperties();
        const options = properties
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(p => `<option value="${p.id}">${p.name}</option>`)
            .join('');
        select.innerHTML = '<option value="">All Properties</option>' + options;
    } catch (e) {
        console.error('[Header] Failed to populate property dropdown:', e);
    }
}

/**
 * Handle property selection from header dropdown
 */
function headerPropertyChanged(propertyId) {
    const select = document.getElementById('headerPropertySelect');
    if (!propertyId) {
        showView('properties');
    } else {
        // Set the property view's dropdown to this property, then load view
        const propertySelect = document.getElementById('propertySelectFilter');
        if (propertySelect) propertySelect.value = propertyId;
        showView('property');
        loadPropertyView();
    }
    // Reset to "All Properties" so it always acts as a launcher
    if (select) select.value = '';
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

        // Success
        showToast('✅ Property settings saved successfully!', 'success');
        
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
 * Parse iCal data and extract blocked dates + reservation events
 */
function parseIcalData(icalText) {
    const blockedDates = [];
    const reservationEvents = []; // NEW: Store full event data for reservation creation

    try {
        // Split by VEVENT blocks
        const events = icalText.split('BEGIN:VEVENT');

        for (let i = 1; i < events.length; i++) {
            const eventBlock = events[i].split('END:VEVENT')[0];

            // Extract DTSTART and DTEND
            const dtstart = extractIcalField(eventBlock, 'DTSTART');
            const dtend = extractIcalField(eventBlock, 'DTEND');
            const summary = extractIcalField(eventBlock, 'SUMMARY') || 'Blocked by OTA';
            const uid = extractIcalField(eventBlock, 'UID') || `event_${i}`;
            const description = extractIcalField(eventBlock, 'DESCRIPTION') || '';

            if (dtstart && dtend) {
                // Parse dates
                const startDate = parseIcalDate(dtstart);
                const endDate = parseIcalDate(dtend);

                if (startDate && endDate) {
                    // Store full event data for reservation creation
                    reservationEvents.push({
                        uid: uid,
                        summary: summary,
                        description: description,
                        check_in: startDate,
                        check_out: endDate
                    });

                    // Get all dates in the range (inclusive start, exclusive end as per iCal spec)
                    const dateRange = getDateRange(startDate, endDate);

                    dateRange.forEach(date => {
                        blockedDates.push({
                            date: date,
                            summary: summary,
                            uid: uid,
                            eventData: { check_in: startDate, check_out: endDate, description }
                        });
                    });
                }
            }
        }

        // Remove duplicates and sort
        const uniqueDates = Array.from(new Map(blockedDates.map(d => [d.date, d])).values());
        uniqueDates.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Attach reservation events to return object
        uniqueDates.reservationEvents = reservationEvents;

        return uniqueDates;

    } catch (error) {
        console.error('Error parsing iCal data:', error);
        return [];
    }
}

/**
 * Extract field value from iCal event block
 */
function extractIcalField(eventBlock, fieldName) {
    // Match field with possible parameters (e.g., DTSTART;VALUE=DATE:20250101)
    const regex = new RegExp(`${fieldName}[^:]*:(.+)`, 'i');
    const match = eventBlock.match(regex);
    
    if (match && match[1]) {
        return match[1].trim();
    }
    
    return null;
}

/**
 * Parse iCal date format to YYYY-MM-DD
 */
function parseIcalDate(icalDate) {
    try {
        // Remove any timezone info and clean the string
        let dateStr = icalDate.replace(/[TZ]/g, '').trim();
        
        // Handle different iCal date formats
        // Format: YYYYMMDD or YYYYMMDDTHHMMSS
        if (dateStr.length >= 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            
            return `${year}-${month}-${day}`;
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing iCal date:', icalDate, error);
        return null;
    }
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

/**
 * Create or update reservations from iCal events (AUTO-IMPORT)
 */
/**
 * Detect iCal events that are blocked/unavailable dates — NOT real reservations.
 * OTAs use these to mark owner blocks, maintenance holds, or platform-managed unavailability.
 * These should be saved to synced_availability (blocked dates) but NOT to reservations.
 */
function isBlockedEvent(event) {
    if (!event.summary) return false;
    const s = event.summary.toUpperCase().trim();

    // Explicit blocking terms used by Airbnb, Booking.com, Agoda, VRBO, MakeMyTrip, etc.
    const blockedPatterns = [
        'NOT AVAILABLE',
        'UNAVAILABLE',
        'BLOCKED',
        'CLOSED',
        'MAINTENANCE',
        'OWNER BLOCK',
        'OWNER STAY',
        'HOLD',
        'AIRBNB (NOT AVAILABLE)',
        'BOOKING.COM (NOT AVAILABLE)',
        'UNAVAILABLE DATES',
        'PROPERTY UNAVAILABLE',
    ];

    return blockedPatterns.some(pattern => s.includes(pattern));
}

async function createReservationsFromIcal(propertyId, reservationEvents, property) {
    if (!reservationEvents || reservationEvents.length === 0) {
        return { created: 0, updated: 0, skipped: 0 };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    try {
        for (const event of reservationEvents) {
            // Skip blocked/unavailable dates — not real guest reservations
            if (isBlockedEvent(event)) {
                console.log(`[iCal] Skipping blocked event: "${event.summary}"`);
                skipped++;
                continue;
            }

            // Parse guest name and booking source from SUMMARY
            // Format examples: "Rahul Sharma (AIRBNB)", "John Doe (Booking.com)", "HMXXXXXXXXXX"
            let guestName = 'Guest';
            let bookingSource = 'OTHER';

            if (event.summary) {
                const summaryUpper = event.summary.toUpperCase();

                // Extract guest name (text before parentheses or entire summary)
                const nameMatch = event.summary.match(/^([^(]+)/);
                if (nameMatch) {
                    guestName = nameMatch[1].trim();
                }

                // Detect booking source
                if (summaryUpper.includes('AIRBNB')) {
                    bookingSource = 'AIRBNB';
                } else if (summaryUpper.includes('BOOKING') || summaryUpper.includes('AGODA')) {
                    bookingSource = 'AGODA/BOOKING.COM';
                } else if (summaryUpper.includes('MMT') || summaryUpper.includes('GOIBIBO') || summaryUpper.includes('MAKEMYTRIP')) {
                    bookingSource = 'MMT/GOIBIBO';
                } else if (summaryUpper.includes('DIRECT')) {
                    bookingSource = 'DIRECT';
                }
            }

            // Use UID as booking_id (truncate to 50 chars to fit DB constraint)
            const bookingId = event.uid.substring(0, 50);

            // Calculate nights
            const nights = Math.ceil((new Date(event.check_out) - new Date(event.check_in)) / (1000 * 60 * 60 * 24));

            // Check 1: Duplicate by booking_id (iCal UID)
            const { data: existing, error: checkError } = await supabase
                .from('reservations')
                .select('*')
                .eq('booking_id', bookingId)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('Error checking existing reservation:', checkError);
                skipped++;
                continue;
            }

            // Check 2: Duplicate by property + (check_in OR check_out) dates
            if (!existing) {
                const orParts = [];
                if (event.check_in) orParts.push(`check_in.eq.${event.check_in}`);
                if (event.check_out) orParts.push(`check_out.eq.${event.check_out}`);

                if (orParts.length > 0) {
                    const { data: dupes } = await supabase
                        .from('reservations')
                        .select('id, booking_id')
                        .eq('property_id', propertyId)
                        .or(orParts.join(','));

                    if (dupes && dupes.length > 0) {
                        console.log(`[iCal] Duplicate skipped: property ${propertyId}, dates match existing:`, dupes.map(r => r.booking_id));
                        skipped++;
                        continue;
                    }
                }
            }

            const monthDate = new Date(event.check_in);
            const month = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

            // Truncate long fields to fit database VARCHAR(50) constraints
            const truncatedGuestName = guestName.substring(0, 50);
            const truncatedPropertyName = property.name.substring(0, 50);

            // Prepare reservation data (partial - financial fields are null as per user request)
            const reservationData = {
                booking_id: bookingId,
                property_id: propertyId,
                property_name: truncatedPropertyName,
                guest_name: truncatedGuestName,
                guest_phone: '', // Not available in iCal - use empty string for NOT NULL constraint
                guest_email: '', // Not available in iCal - use empty string for NOT NULL constraint
                guest_city: '', // Not available in iCal - use empty string
                check_in: event.check_in,
                check_out: event.check_out,
                booking_date: new Date().toISOString().split('T')[0],
                month: month,
                nights: nights,
                booking_type: 'STAYCATION', // Default
                booking_source: bookingSource,
                status: 'confirmed',
                // Financial fields - all null as requested
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
                avg_room_rate: null,
                avg_nightly_rate: null,
                paid_amount: null,
                payment_status: null,
                gst_status: null
            };

            if (existing) {
                // UPDATE existing reservation (only dates and guest name, preserve financial data if entered)
                const { error: updateError } = await supabase
                    .from('reservations')
                    .update({
                        check_in: event.check_in,
                        check_out: event.check_out,
                        nights: nights,
                        month: month,
                        guest_name: truncatedGuestName, // Update name if changed (truncated)
                        booking_source: bookingSource,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (updateError) {
                    console.error('Error updating reservation:', updateError);
                    skipped++;
                } else {
                    updated++;
                }
            } else {
                // CREATE new reservation
                const { error: insertError } = await supabase
                    .from('reservations')
                    .insert([reservationData]);

                if (insertError) {
                    console.error('Error creating reservation:', insertError);
                    skipped++;
                } else {
                    created++;
                }
            }
        }

        return { created, updated, skipped };

    } catch (error) {
        console.error('Error creating reservations from iCal:', error);
        return { created, updated, skipped, error: error.message };
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

