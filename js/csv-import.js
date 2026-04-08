// ResIQ CSV Import — CSV parsing, validation, import wizard

// ============================================
// CSV IMPORT FUNCTIONS
// ============================================

let csvData = [];
let validRows = [];
let skippedRows = [];

/**
 * Download a sample CSV template with all supported reservation fields
 */
function downloadSampleCSV() {
    const headers = [
        'booking_id', 'property_name', 'booking_type', 'booking_source',
        'check_in', 'check_out', 'guest_name', 'guest_phone', 'guest_email',
        'guest_city', 'adults', 'kids', 'number_of_rooms', 'stay_amount',
        'extra_guest_charges', 'meals_chef', 'bonfire_other', 'taxes',
        'damages', 'ota_service_fee', 'hostizzy_revenue', 'gst_status',
        'status', 'payment_status', 'paid_amount'
    ];

    const sampleRows = [
        [
            'HST25ABC123', 'Mountain View Villa', 'STAYCATION', 'DIRECT',
            '2025-04-15', '2025-04-18', 'Rahul Sharma', '9876543210', 'rahul@email.com',
            'Mumbai', '2', '1', '1', '15000',
            '2000', '3000', '500', '1025',
            '0', '0', '2500', 'gst',
            'confirmed', 'pending', '0'
        ],
        [
            'HMAPQ123456', 'Lakeside Cottage', 'STAYCATION', 'AIRBNB',
            '2025-04-20', '2025-04-22', 'Priya Patel', '9123456789', 'priya@email.com',
            'Delhi', '2', '0', '1', '12000',
            '0', '0', '0', '600',
            '0', '1800', '1500', 'gst',
            'confirmed', 'paid', '12600'
        ],
        [
            '', 'Garden Estate', 'WEDDING', 'DIRECT',
            '2025-05-10', '2025-05-12', 'Amit Kumar', '9988776655', '',
            'Bangalore', '10', '5', '3', '75000',
            '5000', '15000', '2000', '0',
            '0', '0', '12000', 'non_gst',
            'confirmed', 'partial', '50000'
        ]
    ];

    let csv = headers.join(',') + '\n';
    sampleRows.forEach(row => {
        csv += row.map(v => `"${v}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hostizzy-reservation-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Sample CSV downloaded. Fill in your data and upload.', 'success');
}

function openImportModal() {
    document.getElementById('importModal').classList.add('active');
    resetImport();
    initializeDragAndDrop();
}

/**
 * Initialize drag and drop functionality for file uploads
 */
function initializeDragAndDrop() {
    const dropZone = document.getElementById('csvDropZone');
    if (!dropZone) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        const file = files[0];

        // Validate file type
        if (!file.name.endsWith('.csv')) {
            showToast('Please upload a CSV file', 'error');
            return;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
            showToast('File size exceeds 10MB limit', 'error');
            return;
        }

        // Trigger the file input change event
        const fileInput = document.getElementById('csvFileInput');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // Manually trigger the change event
        handleCSVUpload({ target: fileInput });
    }
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
    resetImport();
}

function resetImport() {
    // Reset to step 1
    document.getElementById('importStep1').style.display = 'block';
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep3').style.display = 'none';
    document.getElementById('importStep4').style.display = 'none';

    // Clear data
    csvData = [];
    validRows = [];
    skippedRows = [];

    // Reset file input
    document.getElementById('csvFileInput').value = '';

    // Reset error display
    const errEl = document.getElementById('importErrors');
    if (errEl) errEl.style.display = 'none';
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSV(text);
    };
    
    reader.onerror = function() {
        showToast('Error', 'Failed to read CSV file', '❌');
    };
    
    reader.readAsText(file);
}

function parseCSV(text) {
    try {
        // Simple CSV parser (handles quoted fields)
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        csvData = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = parseCSVLine(lines[i]);
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
            });
            
            csvData.push(row);
        }
        
        validateAndPreview();
        
    } catch (error) {
        console.error('CSV Parse Error:', error);
        showToast('Parse Error', 'Invalid CSV format. Please check your file.', '❌');
    }
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current);
    return values;
}

function validateAndPreview() {
    const excludeFY2526 = document.getElementById('excludeFY2526').checked;
    const skipDuplicates = document.getElementById('skipDuplicates').checked;

    validRows = [];
    skippedRows = [];

    // Get existing booking IDs for duplicate check
    const existingBookingIds = new Set(allReservations.map(r => r.booking_id));

    // Date format validation helper (YYYY-MM-DD)
    const isValidDate = (dateStr) => {
        if (!dateStr) return false;
        const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
        if (!match) return false;
        const d = new Date(dateStr);
        return d instanceof Date && !isNaN(d);
    };

    csvData.forEach((row, index) => {
        const rowNum = index + 2; // +2 because index starts at 0 and row 1 is header
        let skipReason = null;

        // Check FY filter
        if (excludeFY2526 && row.FY === 'FY 2025-26') {
            skipReason = 'FY 2025-26 excluded';
        }

        // Check duplicates (only for rows that have a booking_id)
        if (!skipReason && skipDuplicates && row.booking_id && existingBookingIds.has(row.booking_id)) {
            skipReason = 'Duplicate booking ID';
        }

        // Check required fields (booking_id is now optional - auto-generated)
        if (!skipReason && (!row.property_name || !row.guest_name || !row.guest_phone)) {
            const missing = [];
            if (!row.property_name) missing.push('property_name');
            if (!row.guest_name) missing.push('guest_name');
            if (!row.guest_phone) missing.push('guest_phone');
            skipReason = `Missing: ${missing.join(', ')}`;
        }

        // Validate dates
        if (!skipReason && !isValidDate(row.check_in)) {
            skipReason = 'Invalid check_in date (use YYYY-MM-DD)';
        }

        if (!skipReason && !isValidDate(row.check_out)) {
            skipReason = 'Invalid check_out date (use YYYY-MM-DD)';
        }

        if (!skipReason && new Date(row.check_out) <= new Date(row.check_in)) {
            skipReason = 'check_out must be after check_in';
        }

        // Validate status if provided
        if (!skipReason && row.status) {
            const validStatuses = ['confirmed', 'checked-in', 'checked-out', 'cancelled'];
            if (!validStatuses.includes(row.status.toLowerCase())) {
                skipReason = `Invalid status "${row.status}"`;
            }
        }

        if (skipReason) {
            skippedRows.push({ row, reason: skipReason, rowNum });
        } else {
            validRows.push(row);
        }
    });

    // Update stats
    document.getElementById('totalRows').textContent = csvData.length;
    document.getElementById('validRows').textContent = validRows.length;
    document.getElementById('skippedRows').textContent = skippedRows.length;
    document.getElementById('importCount').textContent = validRows.length;

    // Render preview
    renderPreview();

    // Show step 2
    document.getElementById('importStep1').style.display = 'none';
    document.getElementById('importStep2').style.display = 'block';
}

function renderPreview() {
    const tbody = document.getElementById('previewTableBody');
    const previewLimit = 50; // Show first 50 rows

    let html = '';

    // Helper to format amount
    const fmtAmt = (val) => {
        const n = parseFloat(val);
        return isNaN(n) || n === 0 ? '-' : n.toLocaleString('en-IN');
    };

    validRows.slice(0, previewLimit).forEach(row => {
        html += `
            <tr style="background: #f0fdf4;">
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${row.property_name || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${row.guest_name || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${row.check_in || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${row.check_out || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: right;">${fmtAmt(row.total_amount || row.stay_amount)}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;"><span style="color: var(--success); font-size: 11px;">✓ Valid</span></td>
            </tr>
        `;
    });

    skippedRows.slice(0, 10).forEach(item => {
        html += `
            <tr style="background: #fef2f2;">
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${item.row.property_name || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${item.row.guest_name || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${item.row.check_in || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;">${item.row.check_out || '-'}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: right;">-</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border); text-align: left;"><span style="color: var(--danger); font-size: 11px;">✗ ${item.reason}</span></td>
            </tr>
        `;
    });

    if (validRows.length > previewLimit) {
        html += `
            <tr style="background: #f8fafc;">
                <td colspan="6" style="padding: 10px; border-bottom: 1px solid var(--border); text-align: center; color: var(--text-secondary); font-style: italic;">
                    ...and ${validRows.length - previewLimit} more valid rows
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;
}

/**
 * Transform a raw CSV row into a proper reservation object for the database.
 *
 * propertyByName (optional): { [lowercased trimmed name]: propertyRecord }
 *   Used to snapshot revenue_share_percent into the new reservation row,
 *   matching the saveReservation / saveQuickEdit behavior. If a non-cancelled
 *   row references a property whose rate is null/missing, this throws so the
 *   caller can surface the row as a failure (no silent default).
 */
function transformCSVRow(row, propertyByName = {}) {
    const stayAmount = parseFloat(row.stay_amount) || 0;
    const extraGuestCharges = parseFloat(row.extra_guest_charges) || 0;
    const mealsChef = parseFloat(row.meals_chef) || 0;
    const bonfireOther = parseFloat(row.bonfire_other) || 0;
    const taxes = parseFloat(row.taxes) || 0;
    const damages = parseFloat(row.damages) || 0;
    const otaServiceFee = parseFloat(row.ota_service_fee) || 0;

    const mealsRevenue = mealsChef + bonfireOther;
    const totalAmountPreTax = stayAmount + extraGuestCharges + mealsRevenue;
    const totalAmountIncTax = totalAmountPreTax + taxes;
    // Use explicitly provided total_amount if present, otherwise calculate
    const totalAmount = row.total_amount ? parseFloat(row.total_amount) : (totalAmountIncTax + damages);

    const checkIn = row.check_in;
    const checkOut = row.check_out;
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    const adults = parseInt(row.adults) || 1;
    const kids = parseInt(row.kids) || 0;

    const monthDate = new Date(checkIn);
    const month = monthDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    const avgRoomRate = nights > 0 ? stayAmount / nights : 0;
    const avgNightlyRate = nights > 0 ? totalAmount / nights : 0;

    // Resolve the property record so we can snapshot its commission rate.
    // No silent default — if a non-cancelled row references a property without
    // a configured rate, fail loud (caught upstream and reported per row).
    const status = (row.status || 'confirmed').toLowerCase();
    const propertyKey = (row.property_name || '').toLowerCase().trim();
    const propertyRecord = propertyByName[propertyKey] || null;
    const propertyRate = propertyRecord ? propertyRecord.revenue_share_percent : null;
    if (status !== 'cancelled' && (propertyRate == null || propertyRate === '')) {
        throw new Error(
            `Property "${row.property_name || '(missing)'}" has no commission rate set; configure revenue_share_percent before importing`
        );
    }

    // Generate booking_id if not provided
    let bookingId = row.booking_id;
    if (!bookingId) {
        const year = new Date().getFullYear().toString().slice(-2);
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        let rand = "";
        for (const b of bytes) {
            rand += alphabet[b % alphabet.length];
        }
        bookingId = `HST${year}${rand}`;
    }

    return {
        booking_id: bookingId,
        property_name: row.property_name,
        booking_type: row.booking_type || 'STAYCATION',
        booking_date: new Date().toISOString().split('T')[0],
        booking_source: row.booking_source || 'DIRECT',
        check_in: checkIn,
        check_out: checkOut,
        month: month,
        nights: nights,
        guest_name: row.guest_name,
        guest_phone: row.guest_phone,
        guest_email: row.guest_email || null,
        guest_city: row.guest_city || null,
        status: (row.status || 'confirmed').toLowerCase(),
        gst_status: row.gst_status || 'non_gst',
        number_of_rooms: parseInt(row.number_of_rooms) || 1,
        adults: adults,
        kids: kids,
        number_of_guests: adults + kids,
        stay_amount: stayAmount,
        extra_guest_charges: extraGuestCharges,
        meals_chef: mealsChef,
        bonfire_other: bonfireOther,
        taxes: taxes,
        damages: damages,
        ota_service_fee: otaServiceFee,
        total_amount_pre_tax: totalAmountPreTax,
        total_amount_inc_tax: totalAmountIncTax,
        total_amount: totalAmount,
        hostizzy_revenue: parseFloat(row.hostizzy_revenue) || 0,
        // Snapshot the property's commission rate at import time so the row stays
        // in sync with properties.revenue_share_percent.
        revenue_share_percent: propertyRate,
        // Owner share excludes taxes (GST is collected for the government, never paid out)
        // and OTA service fee. Damages and meals/bonfire flow through to the owner.
        host_payout: totalAmount - taxes - otaServiceFee,
        payout_eligible: totalAmount - taxes - otaServiceFee,
        is_legacy: false,
        avg_room_rate: avgRoomRate,
        avg_nightly_rate: avgNightlyRate,
        paid_amount: parseFloat(row.paid_amount) || 0,
        payment_status: row.payment_status || 'pending'
    };
}

async function startImport() {
    if (validRows.length === 0) {
        showToast('No valid rows to import', 'warning');
        return;
    }

    // Show step 3 (progress)
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep3').style.display = 'block';
    document.getElementById('importTotal').textContent = validRows.length;

    let imported = 0;
    let errors = [];

    // Build property name → id lookup map AND name → full record lookup
    // (the second is used by transformCSVRow to snapshot revenue_share_percent
    // onto each new reservation row).
    const properties = state.properties || await db.getProperties();
    const propertyMap = {};
    const propertyByName = {};
    properties.forEach(p => {
        const key = p.name.toLowerCase().trim();
        propertyMap[key] = p.id;
        propertyByName[key] = p;
    });

    // Transform all rows before import
    const transformedRows = validRows.map((row, idx) => {
        try {
            const transformed = transformCSVRow(row, propertyByName);
            // Look up property_id from property_name
            if (transformed.property_name) {
                const pid = propertyMap[transformed.property_name.toLowerCase().trim()];
                if (pid) {
                    transformed.property_id = pid;
                }
            }
            return transformed;
        } catch (err) {
            errors.push(`Row ${idx + 2}: Transform error - ${err.message}`);
            return null;
        }
    }).filter(Boolean);

    // Import in batches of 50
    const batchSize = 50;

    for (let i = 0; i < transformedRows.length; i += batchSize) {
        const batch = transformedRows.slice(i, i + batchSize);

        try {
            const { data, error } = await supabase
                .from('reservations')
                .insert(batch)
                .select();

            if (error) throw error;

            imported += batch.length;

        } catch (error) {
            console.error('Import batch error:', error);
            errors.push(`Rows ${i + 1}-${i + batch.length}: ${error.message}`);
        }

        // Update progress
        document.getElementById('importProgress').textContent = Math.min(imported, transformedRows.length);
        const progress = (Math.min(imported, transformedRows.length) / transformedRows.length) * 100;
        document.getElementById('importProgressBar').style.width = progress + '%';

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Show step 4 (complete)
    document.getElementById('importStep3').style.display = 'none';
    document.getElementById('importStep4').style.display = 'block';
    document.getElementById('importedCount').textContent = imported;

    // Show errors if any
    if (errors.length > 0) {
        document.getElementById('importErrors').style.display = 'block';
        document.getElementById('errorList').innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    }

    // Reload reservations
    await loadReservations();

    showToast(`Successfully imported ${imported} reservations!`, 'success');
}
    function toggleFormatGuide() {
    const guide = document.getElementById('formatGuide');
    const icon = document.getElementById('formatGuideIcon');
    
    if (guide.style.display === 'none') {
        guide.style.display = 'block';
        icon.textContent = '▲';
    } else {
        guide.style.display = 'none';
        icon.textContent = '▼';
    }
}
