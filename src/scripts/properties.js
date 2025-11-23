/**
 * Property Management Module
 * Handles property CRUD, iCal sync, and availability management
 */

import { supabase } from './config.js'
import { db } from './database.js'
import { showToast } from './ui.js'
import { formatDate } from './utils.js'

// ==========================================
// STATE VARIABLES
// ==========================================

let autoSyncIntervals = {} // Store interval IDs by property

// ==========================================
// PROPERTY MANAGEMENT FUNCTIONS
// ==========================================

/**
 * Load and display all properties
 */
export async function loadProperties() {
    try {
        const properties = await db.getProperties()
        const reservations = await db.getReservations()
        const payments = await db.getAllPayments()
        const grid = document.getElementById('propertiesGrid')

        grid.innerHTML = properties.map(p => {
            const propBookings = reservations.filter(r => r.property_id === p.id)
            const activeBookings = propBookings.filter(r => r.status === 'checked-in').length
            const totalBookings = propBookings.length

            // Calculate revenue
            const totalRevenue = propBookings.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0)

            // Calculate occupancy
            const totalNights = propBookings.reduce((sum, r) => sum + (parseInt(r.nights) || 0), 0)
            const occupancyPercent = totalNights > 0 ? Math.round((totalNights / 365) * 100) : 0

            // Sync status
            const syncStatus = getSyncStatusBadge(p)
            const lastSynced = p.ical_last_synced
                ? formatTimeAgo(new Date(p.ical_last_synced)) : 'Never'

            return `
                <div class="property-card">
                    <div class="property-card-header">
                        <div>
                            <h3 style="margin-bottom: 4px; font-size: 18px;">${p.name}</h3>
                            <p style="color: rgba(255, 255, 255, 0.9); font-size: 13px; margin: 0;">📍 ${p.location || 'No location'}</p>
                        </div>
                        <button onclick="openPropertySettings(${p.id})" class="btn-icon" title="Settings">
                            ⚙️
                        </button>
                    </div>

                    <div class="property-stats">
                        <div class="property-stat">
                            <div class="property-stat-value">${totalBookings}</div>
                            <div class="property-stat-label">Bookings</div>
                        </div>
                        <div class="property-stat">
                            <div class="property-stat-value">₹${(totalRevenue / 100000).toFixed(1)}L</div>
                            <div class="property-stat-label">Revenue</div>
                        </div>
                        <div class="property-stat">
                            <div class="property-stat-value">${occupancyPercent}%</div>
                            <div class="property-stat-label">Occupancy</div>
                        </div>
                    </div>

                    <div class="property-sync">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-size: 13px; font-weight: 600;">🔗 iCal Sync</span>
                            ${syncStatus}
                        </div>
                        ${p.ical_url ? `
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                Last synced: ${lastSynced}
                            </div>
                        ` : `
                            <div style="font-size: 12px; color: var(--text-secondary);">
                                No iCal URL configured
                            </div>
                        `}
                    </div>

                    <div class="property-actions">
                        <button class="btn btn-sm btn-secondary" onclick="showPropertyCalendar(${p.id})" style="flex: 1;">
                            📅 Calendar
                        </button>
                        ${p.ical_url ? `
                            <button class="btn btn-sm btn-primary" onclick="syncPropertyNow(${p.id}, event)" style="flex: 1;">
                                🔄 Sync Now
                            </button>
                        ` : ''}
                    </div>
                </div>
            `
        }).join('')
    } catch (error) {
        console.error('Properties error:', error)
        showToast('Error', 'Failed to load properties', '❌')
    }
}

/**
 * Get sync status badge HTML
 */
function getSyncStatusBadge(property) {
    if (!property.ical_url) {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #e2e8f0; color: #64748b; border-radius: 12px;">Not Configured</span>'
    }

    if (property.ical_sync_status === 'syncing') {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #dbeafe; color: #2563eb; border-radius: 12px;">⏳ Syncing...</span>'
    }

    if (property.ical_sync_status === 'error') {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #fee2e2; color: #dc2626; border-radius: 12px;">❌ Error</span>'
    }

    if (property.ical_last_synced) {
        return '<span style="font-size: 11px; padding: 3px 8px; background: #dcfce7; color: #16a34a; border-radius: 12px;">✅ Active</span>'
    }

    return '<span style="font-size: 11px; padding: 3px 8px; background: #fef3c7; color: #ca8a04; border-radius: 12px;">⏸️ Idle</span>'
}

/**
 * Format time ago helper
 */
function formatTimeAgo(dateLike) {
    if (!dateLike) return 'Never'

    // Accept Date, ISO string, or timestamp (seconds/milliseconds)
    let d = dateLike instanceof Date ? dateLike : new Date(dateLike)
    // If it's a numeric string like "1729012345", treat as seconds epoch
    if (!(d instanceof Date) || isNaN(d.getTime())) {
        const n = Number(dateLike)
        if (!Number.isNaN(n)) {
            d = new Date(n > 1e12 ? n : n * 1000)
        }
    }
    if (isNaN(d.getTime())) return 'Unknown'

    const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago'
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hrs ago'
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago'

    return d.toLocaleDateString('en-IN')
}

/**
 * Open property modal
 */
export function openPropertyModal() {
    document.getElementById('propertyModal').classList.add('active')
}

/**
 * Close property modal
 */
export function closePropertyModal() {
    document.getElementById('propertyModal').classList.remove('active')
    document.getElementById('propertyName').value = ''
    document.getElementById('propertyLocation').value = ''
}

/**
 * Save property
 */
export async function saveProperty() {
    try {
        const property = {
            name: document.getElementById('propertyName').value,
            location: document.getElementById('propertyLocation').value,
            type: document.getElementById('propertyType').value,
            capacity: parseInt(document.getElementById('propertyCapacity').value)
        }

        if (!property.name || !property.location) {
            showToast('Validation Error', 'Please fill in all required fields', '❌')
            return
        }

        // Get all existing properties to determine next ID
        const { data: existingProperties, error: fetchError } = await supabase
            .from('properties')
            .select('id')
            .order('id', { ascending: false })
            .limit(1)

        if (fetchError) throw fetchError

        // Calculate next available ID
        const nextId = existingProperties?.length > 0
            ? (existingProperties[0].id + 1) : 1

        // Add the ID to property object
        property.id = nextId

        // Insert the new property
        const { data, error } = await supabase
            .from('properties')
            .insert([property])
            .select()

        if (error) throw error

        closePropertyModal()
        await loadProperties() // Refresh the properties list
        showToast('Success', 'Property saved!', '✅')
    } catch (error) {
        console.error('Save property error:', error)
        showToast('Error', 'Failed to save property: ' + error.message, '❌')
    }
}

/**
 * Delete property
 */
export async function deleteProperty(id) {
    if (!confirm('Delete this property?')) return

    try {
        await db.deleteProperty(id)
        await loadProperties()
        showToast('Deleted', 'Property deleted successfully', '✅')
    } catch (error) {
        console.error('Delete property error:', error)
        showToast('Error', 'Failed to delete property', '❌')
    }
}

// ==========================================
// PROPERTY SETTINGS FUNCTIONS
// ==========================================

/**
 * Open property settings modal
 */
export async function openPropertySettings(propertyId) {
    try {
        // Fetch property details
        const { data: property, error } = await supabase
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single()

        if (error) throw error

        // Populate modal
        document.getElementById('settingsPropertyId').value = propertyId
        document.getElementById('settingsModalTitle').textContent = `${property.name} Settings`
        document.getElementById('settingsPropertyName').textContent = property.name
        document.getElementById('settingsPropertyLocation').textContent = property.location || 'No location set'

        // Set property icon based on type
        const iconMap = {
            'Villa': '🏡',
            'Apartment': '🏢',
            'Hotel': '🏨',
            'Hostel': '🏠',
            'Resort': '🌴'
        }
        document.getElementById('settingsPropertyIcon').textContent = iconMap[property.type] || '🏠'

        // Populate iCal URL if exists
        document.getElementById('icalUrlInput').value = property.ical_url || ''

        // Show current sync status if URL exists
        if (property.ical_url) {
            document.getElementById('currentSyncStatus').style.display = 'block'
            document.getElementById('currentStatusBadge').innerHTML = getSyncStatusBadge(property)

            if (property.ical_last_synced) {
                document.getElementById('currentLastSync').textContent = `Last synced: ${formatTimeAgo(property.ical_last_synced)}`
            } else {
                document.getElementById('currentLastSync').textContent = 'Never synced'
            }

            // Show error if exists
            if (property.ical_sync_error) {
                document.getElementById('currentSyncError').style.display = 'block'
                document.getElementById('currentSyncError').textContent = `⚠️ Error: ${property.ical_sync_error}`
            } else {
                document.getElementById('currentSyncError').style.display = 'none'
            }
        } else {
            document.getElementById('currentSyncStatus').style.display = 'none'
        }

        // Show modal
        document.getElementById('propertySettingsModal').style.display = 'flex'

    } catch (error) {
        console.error('Error opening property settings:', error)
        showToast('Failed to load property settings', 'error')
    }
}

/**
 * Close property settings modal
 */
export function closePropertySettings() {
    document.getElementById('propertySettingsModal').style.display = 'none'
    document.getElementById('icalUrlInput').value = ''
    document.getElementById('settingsPropertyId').value = ''
}

/**
 * Save property settings (iCal URL)
 */
export async function savePropertySettings() {
    const propertyId = document.getElementById('settingsPropertyId').value
    const icalUrl = document.getElementById('icalUrlInput').value.trim()

    // Validate URL if provided
    if (icalUrl) {
        try {
            new URL(icalUrl)

            // Check if it's a valid iCal URL pattern
            if (!icalUrl.includes('ical') && !icalUrl.includes('.ics')) {
                showToast('Please enter a valid iCal URL (should contain "ical" or ".ics")', 'error')
                return
            }
        } catch (e) {
            showToast('Please enter a valid URL', 'error')
            return
        }
    }

    try {
        // Show loading
        const saveButton = event.target
        const originalText = saveButton.innerHTML
        saveButton.innerHTML = '⏳ Saving...'
        saveButton.disabled = true

        // Update property with new iCal URL
        const updateData = {
            ical_url: icalUrl || null,
            ical_sync_status: icalUrl ? 'idle' : null,
            updated_at: new Date().toISOString()
        }

        // Clear error if URL is being updated
        if (icalUrl) {
            updateData.ical_sync_error = null
        }

        const { error } = await supabase
            .from('properties')
            .update(updateData)
            .eq('id', propertyId)

        if (error) throw error

        // Success
        showToast(icalUrl ? '✅ iCal URL saved successfully!' : '✅ iCal URL removed', 'success')

        // Close modal
        closePropertySettings()

        // Reload properties to reflect changes
        await loadProperties()

    } catch (error) {
        console.error('Error saving property settings:', error)
        showToast('Failed to save settings', 'error')

        // Restore button
        event.target.innerHTML = originalText
        event.target.disabled = false
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
        icalUrl = icalUrl.replace(/^webcal:/i, 'https:')
        // Use CORS proxy to fetch iCal file
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(icalUrl)}`

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'text/calendar, text/plain, */*'
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch iCal: ${response.status} ${response.statusText}`)
        }

        const icalData = await response.text()

        // Validate it's an iCal file
        if (!icalData.includes('BEGIN:VCALENDAR')) {
            throw new Error('Invalid iCal format: Missing VCALENDAR')
        }

        // Parse iCal data
        const blockedDates = parseIcalData(icalData)

        return {
            success: true,
            dates: blockedDates,
            rawData: icalData
        }

    } catch (error) {
        console.error('Error fetching iCal:', error)
        return {
            success: false,
            error: error.message,
            dates: []
        }
    }
}

/**
 * Parse iCal data and extract blocked dates
 */
function parseIcalData(icalText) {
    const blockedDates = []
    const unfolded = icalText.replace(/\r?\n[ \t]/g, '')
    const events = unfolded.split('BEGIN:VEVENT')

    try {
        // Split by VEVENT blocks
        const events = icalText.split('BEGIN:VEVENT')

        for (let i = 1; i < events.length; i++) {
            const eventBlock = events[i].split('END:VEVENT')[0]

            // Extract DTSTART and DTEND
            const dtstart = extractIcalField(eventBlock, 'DTSTART')
            const dtend = extractIcalField(eventBlock, 'DTEND')
            const summary = extractIcalField(eventBlock, 'SUMMARY') || 'Blocked by OTA'
            const uid = extractIcalField(eventBlock, 'UID') || `event_${i}`

            if (dtstart && dtend) {
                // Parse dates
                const startDate = parseIcalDate(dtstart)
                const endDate = parseIcalDate(dtend)

                if (startDate && endDate) {
                    // Get all dates in the range (inclusive start, exclusive end as per iCal spec)
                    const dateRange = getDateRange(startDate, endDate)

                    dateRange.forEach(date => {
                        blockedDates.push({
                            date: date,
                            summary: summary,
                            uid: uid
                        })
                    })
                }
            }
        }

        // Remove duplicates and sort
        const uniqueDates = Array.from(new Map(blockedDates.map(d => [d.date, d])).values())
        uniqueDates.sort((a, b) => new Date(a.date) - new Date(b.date))

        return uniqueDates

    } catch (error) {
        console.error('Error parsing iCal data:', error)
        return []
    }
}

/**
 * Extract field value from iCal event block
 */
function extractIcalField(eventBlock, fieldName) {
    // Match field with possible parameters (e.g., DTSTART;VALUE=DATE:20250101)
    const regex = new RegExp(`${fieldName}[^:]*:(.+)`, 'i')
    const match = eventBlock.match(regex)

    if (match && match[1]) {
        return match[1].trim()
    }

    return null
}

/**
 * Parse iCal date format to YYYY-MM-DD
 */
function parseIcalDate(icalDate) {
    try {
        // Remove any timezone info and clean the string
        let dateStr = icalDate.replace(/[TZ]/g, '').trim()

        // Handle different iCal date formats
        // Format: YYYYMMDD or YYYYMMDDTHHMMSS
        if (dateStr.length >= 8) {
            const year = dateStr.substring(0, 4)
            const month = dateStr.substring(4, 6)
            const day = dateStr.substring(6, 8)

            return `${year}-${month}-${day}`
        }

        return null
    } catch (error) {
        console.error('Error parsing iCal date:', icalDate, error)
        return null
    }
}

/**
 * UTC-safe date range: inclusive start, exclusive end (iCal spec)
 */
function getDateRange(startDate, endDate) {
    // startDate/endDate are "YYYY-MM-DD"
    const [sy, sm, sd] = startDate.split('-').map(Number)
    const [ey, em, ed] = endDate.split('-').map(Number)

    let current = new Date(Date.UTC(sy, sm - 1, sd))
    const end = new Date(Date.UTC(ey, em - 1, ed))

    const dates = []
    while (current < end) {
        const y = current.getUTCFullYear()
        const m = String(current.getUTCMonth() + 1).padStart(2, '0')
        const d = String(current.getUTCDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${d}`)
        // advance one UTC day
        current.setUTCDate(current.getUTCDate() + 1)
    }
    return dates
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
            .eq('source', source)

        if (deleteError) throw deleteError

        // Prepare batch insert data
        const insertData = blockedDates.map(item => ({
            property_id: propertyId,
            blocked_date: item.date,
            source: source,
            booking_summary: item.summary || 'Blocked by OTA',
            synced_at: new Date().toISOString()
        }))

        // Insert in batches of 100 to avoid payload size limits
        const batchSize = 100
        for (let i = 0; i < insertData.length; i += batchSize) {
            const batch = insertData.slice(i, i + batchSize)

            const { error: insertError } = await supabase
                .from('synced_availability')
                .insert(batch)

            if (insertError) throw insertError
        }

        return {
            success: true,
            count: insertData.length
        }

    } catch (error) {
        console.error('Error saving synced dates:', error)
        return {
            success: false,
            error: error.message
        }
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
        }

        if (error) {
            updateData.ical_sync_error = error
        } else {
            updateData.ical_sync_error = null
        }

        const { error: updateError } = await supabase
            .from('properties')
            .update(updateData)
            .eq('id', propertyId)

        if (updateError) throw updateError

        return true

    } catch (err) {
        console.error('Error updating sync status:', err)
        return false
    }
}

/**
 * Sync property availability now (manual trigger)
 */
export async function syncPropertyNow(propertyId, event) {
    let syncButton = null
    let originalHTML = ''

    try {
        // Get property details
        const { data: property, error: propError } = await supabase
            .from('properties')
            .select('*')
            .eq('id', propertyId)
            .single()

        if (propError) throw propError

        // Check if iCal URL exists
        if (!property.ical_url) {
            showToast('⚠️ No iCal URL configured for this property', 'error')
            return
        }

        // Update button state if event is provided
        if (event && event.target) {
            syncButton = event.target
            originalHTML = syncButton.innerHTML
            syncButton.innerHTML = '⏳ Syncing...'
            syncButton.disabled = true
        }

        // Show progress toast
        showToast('🔄 Fetching availability from OTA...', 'info')

        // Update status to syncing
        await updatePropertySyncStatus(propertyId, 'syncing')

        // Fetch and parse iCal
        const result = await fetchAndParseIcal(property.ical_url)

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch iCal data')
        }

        // Check if we got any dates
        if (result.dates.length === 0) {
            await updatePropertySyncStatus(propertyId, 'active')
            showToast('✅ Sync completed - No blocked dates found', 'success')
            await loadProperties()
            return
        }

        // Save synced dates to database
        showToast(`💾 Saving ${result.dates.length} blocked dates...`, 'info')

        const saveResult = await saveSyncedDates(propertyId, result.dates, 'ical')

        if (!saveResult.success) {
            throw new Error(saveResult.error || 'Failed to save synced dates')
        }

        // Update status to active
        await updatePropertySyncStatus(propertyId, 'active')

        // Success!
        showToast(`✅ Sync completed! ${saveResult.count} dates blocked`, 'success')

        // Reload properties to show updated status
        await loadProperties()

    } catch (error) {
        console.error('Error syncing property:', error)

        // Update status to error
        await updatePropertySyncStatus(propertyId, 'error', error.message)

        showToast(`❌ Sync failed: ${error.message}`, 'error')

        // Reload to show error status
        await loadProperties()

    } finally {
        // Restore button if it still exists
        if (syncButton && originalHTML) {
            syncButton.innerHTML = originalHTML
            syncButton.disabled = false
        }
    }
}

// ==========================================
// AUTO-SYNC FUNCTIONS
// ==========================================

/**
 * Toggle auto-sync info display
 */
export function toggleAutoSyncInfo() {
    const enabled = document.getElementById('autoSyncEnabled').checked
    const infoDiv = document.getElementById('autoSyncInfo')

    if (enabled) {
        infoDiv.style.display = 'block'
        updateNextSyncTime()
    } else {
        infoDiv.style.display = 'none'
    }
}

/**
 * Update next sync time display
 */
function updateNextSyncTime() {
    const now = new Date()
    const nextSync = new Date(now.getTime() + (6 * 60 * 60 * 1000)) // 6 hours from now
    document.getElementById('nextSyncTime').textContent = nextSync.toLocaleString()
}

/**
 * Start auto-sync for a property
 */
export function startAutoSync(propertyId) {
    // Clear existing interval if any
    if (autoSyncIntervals[propertyId]) {
        clearInterval(autoSyncIntervals[propertyId])
    }

    // Set up auto-sync every 6 hours (6 * 60 * 60 * 1000 ms)
    const syncInterval = 6 * 60 * 60 * 1000 // 6 hours

    autoSyncIntervals[propertyId] = setInterval(async () => {
        console.log(`🔄 Auto-syncing property ${propertyId}...`)
        try {
            await syncPropertyNow(propertyId)
            console.log(`✅ Auto-sync completed for property ${propertyId}`)
        } catch (error) {
            console.error(`❌ Auto-sync failed for property ${propertyId}:`, error)
        }
    }, syncInterval)

    console.log(`✅ Auto-sync enabled for property ${propertyId} (every 6 hours)`)
}

/**
 * Stop auto-sync for a property
 */
export function stopAutoSync(propertyId) {
    if (autoSyncIntervals[propertyId]) {
        clearInterval(autoSyncIntervals[propertyId])
        delete autoSyncIntervals[propertyId]
        console.log(`⏹️ Auto-sync disabled for property ${propertyId}`)
    }
}

/**
 * Initialize auto-sync for all properties with iCal URLs
 */
export async function initializeAutoSync() {
    try {
        const { data: properties, error } = await supabase
            .from('properties')
            .select('id, name, ical_url, auto_sync_enabled')
            .eq('is_active', true)
            .not('ical_url', 'is', null)

        if (error) throw error

        if (properties && properties.length > 0) {
            properties.forEach(property => {
                // Check if auto_sync_enabled column exists and is true
                // For now, auto-enable for all properties with iCal URLs
                startAutoSync(property.id)
            })

            console.log(`🔄 Auto-sync initialized for ${properties.length} properties`)
        }
    } catch (error) {
        console.error('Error initializing auto-sync:', error)
    }
}

// ==========================================
// PERFORMANCE VIEW FUNCTIONS
// ==========================================

/**
 * Initialize performance view
 */
export async function initializePerformanceView() {
    try {
        // Populate property dropdown
        const properties = await db.getProperties()
        const propertyFilter = document.getElementById('performancePropertyFilter')
        propertyFilter.innerHTML = '<option value="">🏠 All Properties</option>' +
            properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')

        // Populate month dropdown with unique months from reservations
        const reservations = await db.getReservations()
        const months = [...new Set(reservations.map(r => r.month).filter(Boolean))].sort().reverse()
        const monthFilter = document.getElementById('performanceMonthFilter')
        monthFilter.innerHTML = '<option value="">All Months</option>' +
            months.map(m => `<option value="${m}">${m}</option>`).join('')

        // Set default date range to current year
        const today = new Date()
        document.getElementById('performanceStartDate').value = `${today.getFullYear()}-01-01`
        document.getElementById('performanceEndDate').value = today.toISOString().split('T')[0]

        // Load initial data
        await loadPropertyPerformance()
    } catch (error) {
        console.error('Performance initialization error:', error)
        showToast('Error', 'Failed to initialize performance view', '❌')
    }
}

/**
 * Handle date range change
 */
export function handleDateRangeChange() {
    const dateRange = document.getElementById('performanceDateRange').value
    const customFields = document.getElementById('customDateRangeFields')
    const customFieldsTo = document.getElementById('customDateRangeFieldsTo')

    if (dateRange === 'custom') {
        customFields.style.display = 'block'
        customFieldsTo.style.display = 'block'

        // Set default dates if empty
        const startInput = document.getElementById('performanceStartDate')
        const endInput = document.getElementById('performanceEndDate')

        if (!startInput.value) {
            const today = new Date()
            const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000))
            startInput.value = thirtyDaysAgo.toISOString().split('T')[0]
            endInput.value = today.toISOString().split('T')[0]
        }
    } else {
        customFields.style.display = 'none'
        customFieldsTo.style.display = 'none'
    }

    loadPropertyPerformance()
}

/**
 * Load property performance data
 */
export async function loadPropertyPerformance() {
    try {
        // Get filter values
        const propertyId = document.getElementById('performancePropertyFilter').value
        const dateRange = document.getElementById('performanceDateRange').value
        const monthFilter = document.getElementById('performanceMonthFilter').value

        // Get all reservations
        let reservations = await db.getReservations()

        // Filter by property if selected
        if (propertyId) {
            reservations = reservations.filter(r => r.property_id == propertyId)
        }

        // Date filtering
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        let startDate, endDate
        let dateRangeLabel = ''

        switch (dateRange) {
            case 'last30':
                startDate = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000))
                endDate = today
                dateRangeLabel = 'Last 30 Days'
                reservations = reservations.filter(r => {
                    const checkIn = new Date(r.check_in)
                    return checkIn >= startDate && checkIn <= endDate
                })
                break

            case 'last90':
                startDate = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000))
                endDate = today
                dateRangeLabel = 'Last 90 Days'
                reservations = reservations.filter(r => {
                    const checkIn = new Date(r.check_in)
                    return checkIn >= startDate && checkIn <= endDate
                })
                break

            case 'custom':
                const customStart = document.getElementById('performanceStartDate').value
                const customEnd = document.getElementById('performanceEndDate').value
                if (customStart && customEnd) {
                    startDate = new Date(customStart)
                    endDate = new Date(customEnd)
                    endDate.setHours(23, 59, 59, 999)
                    dateRangeLabel = `${formatDate(customStart)} - ${formatDate(customEnd)}`
                    reservations = reservations.filter(r => {
                        const checkIn = new Date(r.check_in)
                        return checkIn >= startDate && checkIn <= endDate
                    })
                } else {
                    dateRangeLabel = 'Custom Range (select dates)'
                }
                break

            case 'all_time':
            default:
                dateRangeLabel = 'All Time'
                break
        }

        // Filter by month if selected
        if (monthFilter) {
            reservations = reservations.filter(r => {
                const checkInDate = new Date(r.check_in)
                const month = checkInDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })
                return month === monthFilter
            })
        }

        // Calculate and display metrics
        // (This would include revenue, occupancy, bookings, etc.)

        console.log('Performance data loaded:', reservations.length, 'reservations')

    } catch (error) {
        console.error('Performance loading error:', error)
        showToast('Error', 'Failed to load performance data', '❌')
    }
}

// ==========================================
// GLOBAL EXPORTS FOR LEGACY COMPATIBILITY
// ==========================================

if (typeof window !== 'undefined') {
    window.loadProperties = loadProperties
    window.openPropertyModal = openPropertyModal
    window.closePropertyModal = closePropertyModal
    window.saveProperty = saveProperty
    window.deleteProperty = deleteProperty
    window.openPropertySettings = openPropertySettings
    window.closePropertySettings = closePropertySettings
    window.savePropertySettings = savePropertySettings
    window.syncPropertyNow = syncPropertyNow
    window.toggleAutoSyncInfo = toggleAutoSyncInfo
    window.startAutoSync = startAutoSync
    window.stopAutoSync = stopAutoSync
    window.initializeAutoSync = initializeAutoSync
    window.initializePerformanceView = initializePerformanceView
    window.handleDateRangeChange = handleDateRangeChange
    window.loadPropertyPerformance = loadPropertyPerformance
}

console.log('✅ Property management and iCal sync module loaded')
