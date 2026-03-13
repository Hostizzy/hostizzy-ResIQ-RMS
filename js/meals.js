// ResIQ Meals — Meal preferences management, approval/rejection

// ========== MEALS MANAGEMENT ==========

async function loadMeals() {
    try {
        // Fetch all meal preferences (now combined format)
        const { data: mealData, error: mealError } = await supabase
            .from('guest_meal_preferences')
            .select(`
                id,
                booking_id,
                meals,
                dietary_preferences,
                special_requests,
                status,
                submitted_at,
                approved_by,
                approved_at,
                rejected_reason
            `)
            .order('submitted_at', { ascending: false });

        if (mealError) throw mealError;

        // Fetch all reservations for mapping booking_id to guest info
        const { data: reservations, error: resError } = await supabase
            .from('reservations')
            .select('booking_id, property_id, guest_name, guest_phone, check_in, check_out, adults, kids');

        if (resError) throw resError;

        // Create lookup map for reservation data
        const reservationMap = {};
        reservations.forEach(r => {
            reservationMap[r.booking_id] = r;
        });

        // Update stats - count unique bookings
        const pending = mealData.filter(m => m.status === 'pending').length;
        const approved = mealData.filter(m => m.status === 'approved').length;
        const rejected = mealData.filter(m => m.status === 'rejected').length;

        document.getElementById('mealStatPending').textContent = pending;
        document.getElementById('mealStatApproved').textContent = approved;
        document.getElementById('mealStatRejected').textContent = rejected;

        // Render meals list
        renderMealsList(mealData, reservationMap);

    } catch (error) {
        console.error('Meals error:', error);
        showToast('Error', 'Failed to load meals', '❌');
    }
}

 function renderMealsList(mealData, reservationMap) {
    const container = document.getElementById('mealsList');

    if (mealData.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No meal preferences found</div>';
        return;
    }

    const html = mealData.map(mealPref => {
        const bookingId = mealPref.booking_id;
        const reservation = reservationMap[bookingId] || {};
        const status = mealPref.status || 'pending';
        const meals = mealPref.meals || {};
        
        const statusBadge = {
            'pending': '<span class="badge badge-pending">⏳ Pending</span>',
            'approved': '<span class="badge badge-confirmed">✅ Approved</span>',
            'rejected': '<span class="badge badge-cancelled">❌ Rejected</span>'
        }[status] || '<span class="badge">Unknown</span>';

        // Format dates
        const checkIn = reservation.check_in ? new Date(reservation.check_in).toLocaleDateString('en-IN') : 'N/A';
        const checkOut = reservation.check_out ? new Date(reservation.check_out).toLocaleDateString('en-IN') : 'N/A';
        const adults = reservation.adults || 0;
        const kids = reservation.kids || 0;

        // Build meals summary with proper formatting
        const mealsSummary = Object.entries(meals)
            .map(([mealType, items]) => {
                if (!Array.isArray(items)) return '';
                const mealEmoji = {
                    'breakfast': '🌅',
                    'lunch': '🍲',
                    'dinner': '🍜',
                    'barbeque': '🔥'
                }[mealType] || '🍽️';
                const itemsList = items.join(', ');
                return `<div style="margin-bottom: 8px;"><strong>${mealEmoji} ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}:</strong> ${itemsList}</div>`;
            })
            .join('');

        // Build info section
        const infoSection = `
            <div style="background: var(--background); padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; line-height: 1.8;">
                <div><strong>📅 Check-in:</strong> ${checkIn}</div>
                <div><strong>📅 Check-out:</strong> ${checkOut}</div>
                <div><strong>👥 Guests:</strong> ${adults} Adults, ${kids} kids</div>
            </div>
        `;

        // Build dietary and special requests
        const dietaryInfo = mealPref.dietary_preferences 
            ? `<div style="background: #e6f4ea; padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid var(--success); font-size: 13px;">🥗 <strong>Dietary:</strong> ${mealPref.dietary_preferences}</div>`
            : '';

        const specialInfo = mealPref.special_requests
            ? `<div style="background: #fef7e0; padding: 12px; border-radius: 8px; border-left: 4px solid var(--warning); font-size: 13px;">⭐ <strong>Special Requests:</strong> ${mealPref.special_requests}</div>`
            : '';

        return `
            <div style="
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            ">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <div style="font-weight: 700; font-size: 16px;">Booking: ${bookingId}</div>
                        <div style="color: var(--text-secondary); font-size: 13px; margin-top: 2px;">Guest: ${reservation.guest_name || 'N/A'} | Phone: ${reservation.guest_phone || 'N/A'}</div>
                    </div>
                    ${statusBadge}
                </div>

                <!-- Info Section -->
                ${infoSection}

                <!-- Meals -->
                <div style="background: var(--surface); padding: 12px; border-radius: 8px; border-left: 4px solid var(--primary); margin-bottom: 12px; font-size: 13px;">
                    🍽️ <strong>Meal Selections:</strong>
                    <div style="margin-top: 8px;">
                        ${mealsSummary}
                    </div>
                </div>

                <!-- Dietary & Special -->
                ${dietaryInfo}
                ${specialInfo}

                <!-- Action Buttons -->
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
                    ${status === 'pending' ? `
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-success btn-sm" onclick="approveMeal('${mealPref.id}', '${bookingId}')" style="flex: 1;">
                                ✅ Approve
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="showRejectMealModal('${mealPref.id}', '${bookingId}')" style="flex: 1;">
                                ❌ Reject
                            </button>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="sendMealWhatsApp('${bookingId}', '${reservation.guest_phone || ''}', 'approval')" style="width: 100%;">
                            <i data-lucide="message-circle" style="width: 12px; height: 12px; margin-right: 3px;"></i>WhatsApp Approval
                        </button>
                    ` : status === 'rejected' ? `
                        <button class="btn btn-warning btn-sm" onclick="unrejectMeal('${mealPref.id}')" style="width: 100%;">
                            Unreject
                        </button>
                    ` : `
                        <div style="text-align: center; color: var(--text-secondary); font-size: 13px; padding: 12px; background: var(--background); border-radius: 8px;">
                            Approved by staff
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function searchMeals(query) {
    const items = document.querySelectorAll('#mealsList > div');
    const lowerQuery = query.toLowerCase();
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(lowerQuery) ? 'flex' : 'none';
    });
}

function filterMealsByStatus(status) {
    loadMeals(); // For now, reload - can be optimized with client-side filtering
}

function refreshMeals() {
    loadMeals();
    showToast('Refreshed', 'Meals list updated', '✅');
}

 async function approveMeal(mealId, bookingId) {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const staffId = currentUser?.email || 'unknown';

        const { error } = await supabase
            .from('guest_meal_preferences')
            .update({
                status: 'approved',
                approved_by: staffId,
                approved_at: new Date().toISOString()
            })
            .eq('id', mealId);

        if (error) throw error;

        // Get guest phone and details for WhatsApp
        const { data: reservation } = await supabase
            .from('reservations')
            .select('guest_name, guest_phone, check_in, check_out, adults, kids')
            .eq('booking_id', bookingId)
            .maybeSingle();

        loadMeals();
        showToast('Approved', `Meal preference approved for ${bookingId}`, '✅');

        // Auto-open WhatsApp with approval message
        if (reservation?.guest_phone) {
            setTimeout(() => {
                sendApprovalWhatsApp(bookingId, reservation.guest_phone, reservation.guest_name, reservation.check_in, reservation.check_out, reservation.adults, reservation.kids);
            }, 500);
        }
    } catch (error) {
        console.error('Approve meal error:', error);
        showToast('Error', 'Failed to approve meal', '❌');
    }
}

function showRejectMealModal(mealId, bookingId) {
    // Show custom modal instead of prompt
    const modal = document.createElement('div');
    modal.id = 'rejectReasonModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        ">
            <h3 style="margin-bottom: 16px; color: var(--text-primary);">Reject Meal Preference</h3>
            <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 14px;">
                Enter rejection reason (optional):
            </p>
            <textarea id="rejectReasonInput" placeholder="e.g., Unable to source required ingredients" style="
                width: 100%;
                padding: 12px;
                border: 1px solid var(--border);
                border-radius: 8px;
                font-size: 14px;
                font-family: inherit;
                resize: vertical;
                min-height: 80px;
                margin-bottom: 16px;
            "></textarea>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="document.getElementById('rejectReasonModal').remove()" class="btn btn-secondary" style="flex: 1;">
                    Cancel
                </button>
                <button onclick="proceedWithReject('${mealId}', '${bookingId}')" class="btn btn-danger" style="flex: 1;">
                    Reject
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('rejectReasonInput').focus();
}

function proceedWithReject(mealId, bookingId) {
    const reason = document.getElementById('rejectReasonInput')?.value || '';
    document.getElementById('rejectReasonModal').remove();
    rejectMeal(mealId, bookingId, reason);
}

async function rejectMeal(mealId, bookingId, reason = '') {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const staffId = currentUser?.email || 'unknown';

        const { error } = await supabase
            .from('guest_meal_preferences')
            .update({
                status: 'rejected',
                approved_by: staffId,
                approved_at: new Date().toISOString(),
                rejected_reason: reason
            })
            .eq('id', mealId);

        if (error) throw error;

        // Get guest phone and details for WhatsApp
        const { data: reservation } = await supabase
            .from('reservations')
            .select('guest_name, guest_phone, check_in, check_out, adults, kids')
            .eq('booking_id', bookingId)
            .maybeSingle();

        loadMeals();
        showToast('Rejected', `Meal preference rejected for ${bookingId}`, '✅');

        // Auto-open WhatsApp with rejection message
        if (reservation?.guest_phone) {
            setTimeout(() => {
                sendRejectionWhatsApp(bookingId, reservation.guest_phone, reason, reservation.guest_name, reservation.check_in, reservation.check_out, reservation.adults, reservation.kids);
            }, 500);
        }
    } catch (error) {
        console.error('Reject meal error:', error);
        showToast('Error', 'Failed to reject meal', '❌');
    }
}

function sendApprovalWhatsApp(bookingId, guestPhone, guestName, checkIn, checkOut, adults, kids) {
    try {
        if (!guestPhone) {
            showToast('Error', 'Guest phone number not available', '❌');
            return;
        }

        const checkInDate = checkIn ? new Date(checkIn).toLocaleDateString('en-IN') : 'TBD';
        const checkOutDate = checkOut ? new Date(checkOut).toLocaleDateString('en-IN') : 'TBD';

        const message = `🎉 *Meal Preferences Confirmed* 🎉\n\n` +
            `Hi ${guestName}!\n\n` +
            `✅ Your meal preferences for booking *${bookingId}* have been *APPROVED*!\n\n` +
            `📅 *Booking Details:*\n` +
            `• Check-in: ${checkInDate}\n` +
            `• Check-out: ${checkOutDate}\n` +
            `• Guests: ${adults} Adults, ${kids} kids\n\n` +
            `🍽️ Our team will prepare everything exactly as per your requirements.\n\n` +
            `If you have any last-minute changes, please let us know ASAP.\n\n` +
            `Looking forward to hosting you! 🏡\n\n` +
            `*Hostizzy Team*`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${guestPhone}?text=${encodedMessage}`;

        // Create button container for WhatsApp and Copy options
        showWhatsAppOptions(message, whatsappUrl);

    } catch (error) {
        console.error('WhatsApp approval error:', error);
        showToast('Error', 'Failed to prepare message', '❌');
    }
}

function sendRejectionWhatsApp(bookingId, guestPhone, reason, guestName, checkIn, checkOut, adults, kids) {
    try {
        if (!guestPhone) {
            showToast('Error', 'Guest phone number not available', '❌');
            return;
        }

        const checkInDate = checkIn ? new Date(checkIn).toLocaleDateString('en-IN') : 'TBD';
        const checkOutDate = checkOut ? new Date(checkOut).toLocaleDateString('en-IN') : 'TBD';
        const guestPortalLink = `${window.location.origin}/guest-portal`;

        let message = `⚠️ *Meal Preferences - Action Needed* ⚠️\n\n` +
            `Hi ${guestName}!\n\n` +
            `We need to discuss your meal preferences for booking *${bookingId}*.\n\n` +
            `📅 *Booking Details:*\n` +
            `• Check-in: ${checkInDate}\n` +
            `• Check-out: ${checkOutDate}\n` +
            `• Guests: ${adults} Adults, ${kids} kids\n\n`;

        if (reason) {
            message += `*Reason:* ${reason}\n\n`;
        }

        message += `Please update your meal preferences via the guest portal and resubmit:\n` +
            `${guestPortalLink}\n\n` +
            `📞 We're here to help!\n\n` +
            `*Hostizzy Team*`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${guestPhone}?text=${encodedMessage}`;

        // Create button container for WhatsApp and Copy options
        showWhatsAppOptions(message, whatsappUrl);

    } catch (error) {
        console.error('WhatsApp rejection error:', error);
        showToast('Error', 'Failed to prepare message', '❌');
    }
}

function showWhatsAppOptions(message, whatsappUrl) {
    // Create modal with WhatsApp and Copy buttons
    const modal = document.createElement('div');
    modal.id = 'whatsappOptionsModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        ">
            <h3 style="margin-bottom: 16px; color: var(--text-primary); display: flex; gap: 8px; align-items: center;">
                <i data-lucide="message-circle" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i>Message Preview
            </h3>
            <div style="
                background: var(--background);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
                max-height: 300px;
                overflow-y: auto;
                font-size: 13px;
                line-height: 1.6;
                color: var(--text-primary);
                white-space: pre-wrap;
                word-break: break-word;
            " id="messagePreview">
                ${message}
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button onclick="openWhatsAppDirect('${whatsappUrl.replace(/'/g, "\\'")}'); document.getElementById('whatsappOptionsModal').remove()" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: 600;">
                    💚 Open WhatsApp
                </button>
                <button onclick="copyMessageToClipboard(\`${message.replace(/`/g, '\\`').replace(/'/g, "\\'")}\`); document.getElementById('whatsappOptionsModal').remove()" class="btn btn-secondary" style="width: 100%; padding: 12px; font-weight: 600;">
                    <i data-lucide="clipboard" style="width: 14px; height: 14px; margin-right: 4px;"></i>Copy to Clipboard
                </button>
                <button onclick="document.getElementById('whatsappOptionsModal').remove()" class="btn btn-secondary" style="width: 100%; padding: 12px; font-weight: 600;">
                    ✕ Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function openWhatsAppDirect(whatsappUrl) {
    window.open(whatsappUrl, '_blank', 'width=800,height=600');
    showToast('WhatsApp Opened', 'Message ready to send', '✅');
}

async function copyMessageToClipboard(message) {
    try {
        await navigator.clipboard.writeText(message);
        showToast('Copied', 'Message copied to clipboard! Paste it in WhatsApp.', '✅');
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Error', 'Failed to copy message', '❌');
    }
}

async function sendMealWhatsApp(bookingId, guestPhone, actionType) {
    try {
        if (!guestPhone) {
            showToast('Error', 'Guest phone number not available', '❌');
            return;
        }

        if (actionType === 'approval') {
            sendApprovalWhatsApp(bookingId, guestPhone);
        } else if (actionType === 'rejection') {
            sendRejectionWhatsApp(bookingId, guestPhone, '');
        }
    } catch (error) {
        console.error('WhatsApp send error:', error);
        showToast('Error', 'Failed to open WhatsApp', '❌');
    }
}

// Availability Calendar
let currentCalendarDate = new Date();

/**
 * Show property calendar - switches to availability view and filters by property
 */
async function showPropertyCalendar(propertyId) {
