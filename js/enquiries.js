// ResIQ Enquiries — Lead/enquiry pipeline for pre-booking guest management

let enquiriesData = [];
let enquiriesFilter = 'all';
let enquiriesViewMode = 'kanban'; // 'kanban' or 'table'

const ENQUIRY_STATUSES = [
    { key: 'new', label: 'New', color: '#3b82f6', bg: '#eff6ff', icon: 'sparkles' },
    { key: 'contacted', label: 'Contacted', color: '#8b5cf6', bg: '#f5f3ff', icon: 'phone-outgoing' },
    { key: 'follow_up', label: 'Follow Up', color: '#f59e0b', bg: '#fffbeb', icon: 'clock' },
    { key: 'negotiation', label: 'Negotiation', color: '#0891b2', bg: '#ecfeff', icon: 'message-square' },
    { key: 'converted', label: 'Converted', color: '#10b981', bg: '#ecfdf5', icon: 'check-circle' },
    { key: 'lost', label: 'Lost', color: '#ef4444', bg: '#fef2f2', icon: 'x-circle' }
];

const ENQUIRY_SOURCES = [
    { key: 'phone', label: 'Phone', icon: 'phone' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
    { key: 'instagram', label: 'Instagram', icon: 'instagram' },
    { key: 'facebook', label: 'Facebook', icon: 'facebook' },
    { key: 'website', label: 'Website', icon: 'globe' },
    { key: 'walk_in', label: 'Walk-in', icon: 'footprints' },
    { key: 'referral', label: 'Referral', icon: 'users' },
    { key: 'email', label: 'Email', icon: 'mail' },
    { key: 'google', label: 'Google', icon: 'search' },
    { key: 'other', label: 'Other', icon: 'more-horizontal' }
];

async function loadEnquiries() {
    try {
        enquiriesData = await db.getEnquiries();
        renderEnquiriesView();
    } catch (error) {
        console.error('Error loading enquiries:', error);
        showToast('Error', 'Failed to load enquiries', '❌');
    }
}

function renderEnquiriesView() {
    updateEnquiryStats();
    if (enquiriesViewMode === 'kanban') {
        renderEnquiriesKanban();
    } else {
        renderEnquiriesTable();
    }
    requestAnimationFrame(() => {
        if (typeof refreshIcons === 'function') refreshIcons(document.getElementById('enquiriesView'));
    });
}

function updateEnquiryStats() {
    const total = enquiriesData.length;
    const active = enquiriesData.filter(e => !['converted', 'lost'].includes(e.status)).length;
    const converted = enquiriesData.filter(e => e.status === 'converted').length;
    const todayFollowups = enquiriesData.filter(e => {
        if (!e.follow_up_date) return false;
        const today = new Date().toISOString().split('T')[0];
        return e.follow_up_date <= today && !['converted', 'lost'].includes(e.status);
    }).length;

    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    const el = (id) => document.getElementById(id);
    if (el('enqStatTotal')) el('enqStatTotal').textContent = total;
    if (el('enqStatActive')) el('enqStatActive').textContent = active;
    if (el('enqStatConverted')) el('enqStatConverted').textContent = `${conversionRate}%`;
    if (el('enqStatFollowups')) el('enqStatFollowups').textContent = todayFollowups;
}

function switchEnquiriesView(mode) {
    enquiriesViewMode = mode;
    document.querySelectorAll('.enq-view-toggle').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.enq-view-toggle[data-mode="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    renderEnquiriesView();
}

function filterEnquiriesByStatus(status, el) {
    enquiriesFilter = status;
    document.querySelectorAll('#enquiriesView .filter-chip').forEach(chip => chip.classList.remove('active'));
    if (el) el.classList.add('active');
    renderEnquiriesView();
}

function getFilteredEnquiries() {
    if (enquiriesFilter === 'all') return enquiriesData;
    return enquiriesData.filter(e => e.status === enquiriesFilter);
}

// ── Kanban Board ───────────────────────────────────
function renderEnquiriesKanban() {
    const container = document.getElementById('enquiriesContent');
    if (!container) return;

    const filtered = getFilteredEnquiries();
    const pipelineStatuses = ENQUIRY_STATUSES.filter(s => enquiriesFilter === 'all' || s.key === enquiriesFilter);

    container.innerHTML = `
        <div class="enq-kanban-board">
            ${pipelineStatuses.map(status => {
                const cards = filtered.filter(e => e.status === status.key);
                return `
                <div class="enq-kanban-column" data-status="${status.key}">
                    <div class="enq-kanban-header" style="border-top: 3px solid ${status.color};">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="${status.icon}" style="width: 16px; height: 16px; color: ${status.color};"></i>
                            <span style="font-weight: 600; font-size: 14px;">${status.label}</span>
                        </div>
                        <span class="enq-kanban-count" style="background: ${status.bg}; color: ${status.color};">${cards.length}</span>
                    </div>
                    <div class="enq-kanban-cards">
                        ${cards.length === 0 ? `<div class="enq-kanban-empty">No enquiries</div>` :
                            cards.map(enq => renderEnquiryCard(enq, status)).join('')}
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

function renderEnquiryCard(enq, statusConfig) {
    const sourceInfo = ENQUIRY_SOURCES.find(s => s.key === enq.source) || ENQUIRY_SOURCES[ENQUIRY_SOURCES.length - 1];
    const priorityColors = { low: '#94a3b8', medium: '#f59e0b', high: '#f97316', urgent: '#ef4444' };
    const priorityColor = priorityColors[enq.priority] || '#94a3b8';
    const dateStr = enq.check_in ? new Date(enq.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
    const dateEndStr = enq.check_out ? ` - ${new Date(enq.check_out).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '';
    const isOverdueFollowup = enq.follow_up_date && enq.follow_up_date <= new Date().toISOString().split('T')[0] && !['converted', 'lost'].includes(enq.status);
    const createdAgo = getTimeAgo(enq.created_at);

    return `
        <div class="enq-card" onclick="openEnquiryDetail('${enq.id}')">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${escapeHtml(enq.guest_name)}</div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${priorityColor}; flex-shrink: 0; margin-top: 4px;" title="${enq.priority} priority"></div>
            </div>
            ${enq.property_name ? `<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;"><i data-lucide="building" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i>${escapeHtml(enq.property_name)}</div>` : ''}
            ${dateStr ? `<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;"><i data-lucide="calendar" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i>${dateStr}${dateEndStr}${enq.nights ? ` (${enq.nights}N)` : ''}</div>` : ''}
            ${enq.number_of_guests ? `<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;"><i data-lucide="users" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;"></i>${enq.number_of_guests} guests</div>` : ''}
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--background); border-radius: 10px; font-size: 11px; color: var(--text-secondary);">
                        <i data-lucide="${sourceInfo.icon}" style="width: 10px; height: 10px;"></i>${sourceInfo.label}
                    </span>
                    ${isOverdueFollowup ? `<span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; background: #fef2f2; border-radius: 10px; font-size: 11px; color: #ef4444; font-weight: 600;"><i data-lucide="alert-circle" style="width: 10px; height: 10px;"></i>Follow up!</span>` : ''}
                </div>
                <span style="font-size: 11px; color: var(--text-tertiary);">${createdAgo}</span>
            </div>
        </div>`;
}

function getTimeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Table View ─────────────────────────────────────
function renderEnquiriesTable() {
    const container = document.getElementById('enquiriesContent');
    if (!container) return;

    const filtered = getFilteredEnquiries();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <div style="margin-bottom: 16px; opacity: 0.4;"><i data-lucide="inbox" style="width: 56px; height: 56px;"></i></div>
                <h3 style="margin-bottom: 8px; color: var(--text-secondary); font-weight: 600;">No enquiries yet</h3>
                <p style="font-size: 14px;">Add your first enquiry to start tracking leads</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="card" style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Guest</th>
                        <th style="text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Property</th>
                        <th style="text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Dates</th>
                        <th style="text-align: center; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Source</th>
                        <th style="text-align: center; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Status</th>
                        <th style="text-align: center; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Priority</th>
                        <th style="text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Follow-up</th>
                        <th style="text-align: center; padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(enq => {
                        const statusConf = ENQUIRY_STATUSES.find(s => s.key === enq.status) || ENQUIRY_STATUSES[0];
                        const sourceInfo = ENQUIRY_SOURCES.find(s => s.key === enq.source) || ENQUIRY_SOURCES[ENQUIRY_SOURCES.length - 1];
                        const priorityColors = { low: '#94a3b8', medium: '#f59e0b', high: '#f97316', urgent: '#ef4444' };
                        const pColor = priorityColors[enq.priority] || '#94a3b8';
                        const dateStr = enq.check_in ? new Date(enq.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-';
                        const isOverdue = enq.follow_up_date && enq.follow_up_date <= new Date().toISOString().split('T')[0] && !['converted', 'lost'].includes(enq.status);
                        return `
                        <tr style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='var(--background-alt)'" onmouseout="this.style.background=''" onclick="openEnquiryDetail('${enq.id}')">
                            <td style="padding: 12px; border-bottom: 1px solid var(--border);">
                                <div style="font-weight: 600; font-size: 14px;">${escapeHtml(enq.guest_name)}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(enq.guest_phone || enq.guest_email || '')}</div>
                            </td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-secondary);">${escapeHtml(enq.property_name || '-')}</td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-secondary);">${dateStr}${enq.nights ? ` (${enq.nights}N)` : ''}</td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border); text-align: center;">
                                <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary);"><i data-lucide="${sourceInfo.icon}" style="width: 12px; height: 12px;"></i>${sourceInfo.label}</span>
                            </td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border); text-align: center;">
                                <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${statusConf.bg}; color: ${statusConf.color};">${statusConf.label}</span>
                            </td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border); text-align: center;">
                                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${pColor};" title="${enq.priority}"></span>
                            </td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border); font-size: 13px; ${isOverdue ? 'color: #ef4444; font-weight: 600;' : 'color: var(--text-secondary);'}">
                                ${enq.follow_up_date ? new Date(enq.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                                ${isOverdue ? ' ⚠' : ''}
                            </td>
                            <td style="padding: 12px; border-bottom: 1px solid var(--border); text-align: center;" onclick="event.stopPropagation();">
                                <button class="btn btn-sm" onclick="openEnquiryDetail('${enq.id}')" style="padding: 4px 10px; font-size: 12px;">View</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

// ── Add/Edit Enquiry Modal ─────────────────────────
async function openEnquiryModal(enquiryId = null) {
    let enq = null;
    if (enquiryId) {
        enq = enquiriesData.find(e => e.id === enquiryId);
    }

    // Load properties for dropdown
    let properties = [];
    try {
        properties = await db.getProperties();
    } catch (e) {
        console.error('Error loading properties:', e);
    }

    const isEdit = !!enq;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 640px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 class="modal-title"><i data-lucide="${isEdit ? 'edit' : 'user-plus'}" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;"></i>${isEdit ? 'Edit Enquiry' : 'New Enquiry'}</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Guest Name *</label>
                        <input type="text" id="enqGuestName" value="${escapeHtml(enq?.guest_name || '')}" placeholder="Full name" required>
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="tel" id="enqGuestPhone" value="${escapeHtml(enq?.guest_phone || '')}" placeholder="+91 ...">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="enqGuestEmail" value="${escapeHtml(enq?.guest_email || '')}" placeholder="email@example.com">
                    </div>
                    <div class="form-group">
                        <label>Property</label>
                        <select id="enqPropertyId">
                            <option value="">-- Select Property --</option>
                            ${properties.map(p => `<option value="${p.id}" ${enq?.property_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Source *</label>
                        <select id="enqSource">
                            ${ENQUIRY_SOURCES.map(s => `<option value="${s.key}" ${(enq?.source || 'phone') === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Check-in</label>
                        <input type="date" id="enqCheckIn" value="${enq?.check_in || ''}">
                    </div>
                    <div class="form-group">
                        <label>Check-out</label>
                        <input type="date" id="enqCheckOut" value="${enq?.check_out || ''}">
                    </div>
                    <div class="form-group">
                        <label>Guests</label>
                        <input type="number" id="enqGuests" value="${enq?.number_of_guests || ''}" min="1" placeholder="No. of guests">
                    </div>
                    <div class="form-group">
                        <label>Rooms</label>
                        <input type="number" id="enqRooms" value="${enq?.number_of_rooms || ''}" min="1" placeholder="No. of rooms">
                    </div>
                    <div class="form-group">
                        <label>Budget Range</label>
                        <input type="text" id="enqBudget" value="${escapeHtml(enq?.budget_range || '')}" placeholder="e.g. 5000-8000/night">
                    </div>
                    <div class="form-group">
                        <label>Priority</label>
                        <select id="enqPriority">
                            <option value="low" ${enq?.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${(!enq || enq?.priority === 'medium') ? 'selected' : ''}>Medium</option>
                            <option value="high" ${enq?.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="urgent" ${enq?.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Follow-up Date</label>
                        <input type="date" id="enqFollowUp" value="${enq?.follow_up_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>Source Details</label>
                        <input type="text" id="enqSourceDetails" value="${escapeHtml(enq?.source_details || '')}" placeholder="Referral name, IG handle, etc.">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Notes</label>
                        <textarea id="enqNotes" rows="3" placeholder="Any additional details...">${escapeHtml(enq?.notes || '')}</textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="saveEnquiryFromModal('${enquiryId || ''}')" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="save" style="width: 14px; height: 14px;"></i> ${isEdit ? 'Update' : 'Save Enquiry'}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Auto-calculate nights
    document.getElementById('enqCheckIn').addEventListener('change', calcEnqNights);
    document.getElementById('enqCheckOut').addEventListener('change', calcEnqNights);

    requestAnimationFrame(() => {
        if (typeof refreshIcons === 'function') refreshIcons(modal);
    });
}

function calcEnqNights() {
    const cin = document.getElementById('enqCheckIn')?.value;
    const cout = document.getElementById('enqCheckOut')?.value;
    if (cin && cout) {
        const nights = Math.ceil((new Date(cout) - new Date(cin)) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
            // Store nights for save
            document.getElementById('enqCheckOut').dataset.nights = nights;
        }
    }
}

async function saveEnquiryFromModal(existingId) {
    const name = document.getElementById('enqGuestName')?.value?.trim();
    if (!name) {
        showToast('Missing Name', 'Please enter the guest name', '⚠️');
        return;
    }

    const propertySelect = document.getElementById('enqPropertyId');
    const selectedOption = propertySelect?.options[propertySelect.selectedIndex];
    const propertyName = selectedOption && selectedOption.value ? selectedOption.text : null;

    const checkIn = document.getElementById('enqCheckIn')?.value || null;
    const checkOut = document.getElementById('enqCheckOut')?.value || null;
    let nights = null;
    if (checkIn && checkOut) {
        nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        if (nights <= 0) nights = null;
    }

    const enquiry = {
        guest_name: name,
        guest_phone: document.getElementById('enqGuestPhone')?.value?.trim() || null,
        guest_email: document.getElementById('enqGuestEmail')?.value?.trim() || null,
        property_id: document.getElementById('enqPropertyId')?.value || null,
        property_name: propertyName,
        source: document.getElementById('enqSource')?.value || 'phone',
        source_details: document.getElementById('enqSourceDetails')?.value?.trim() || null,
        check_in: checkIn,
        check_out: checkOut,
        nights: nights,
        number_of_guests: parseInt(document.getElementById('enqGuests')?.value) || null,
        number_of_rooms: parseInt(document.getElementById('enqRooms')?.value) || null,
        budget_range: document.getElementById('enqBudget')?.value?.trim() || null,
        priority: document.getElementById('enqPriority')?.value || 'medium',
        follow_up_date: document.getElementById('enqFollowUp')?.value || null,
        notes: document.getElementById('enqNotes')?.value?.trim() || null
    };

    if (existingId) {
        enquiry.id = existingId;
    }

    try {
        await db.saveEnquiry(enquiry);
        document.querySelectorAll('.modal').forEach(m => m.remove());
        showToast(existingId ? 'Updated' : 'Enquiry Added', `${name}'s enquiry ${existingId ? 'updated' : 'saved'}`, '✅');
        await loadEnquiries();
    } catch (error) {
        console.error('Error saving enquiry:', error);
        showToast('Error', 'Failed to save enquiry: ' + error.message, '❌');
    }
}

// ── Detail / Status Management ─────────────────────
function openEnquiryDetail(enquiryId) {
    const enq = enquiriesData.find(e => e.id === enquiryId);
    if (!enq) return;

    const statusConf = ENQUIRY_STATUSES.find(s => s.key === enq.status) || ENQUIRY_STATUSES[0];
    const sourceInfo = ENQUIRY_SOURCES.find(s => s.key === enq.source) || ENQUIRY_SOURCES[ENQUIRY_SOURCES.length - 1];
    const createdDate = new Date(enq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header" style="background: ${statusConf.bg}; border-bottom: 2px solid ${statusConf.color};">
                <h3 class="modal-title" style="display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="${statusConf.icon}" style="width: 20px; height: 20px; color: ${statusConf.color};"></i>
                    ${escapeHtml(enq.guest_name)}
                </h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="padding: 20px;">
                <!-- Status Pipeline -->
                <div style="display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap;">
                    ${ENQUIRY_STATUSES.map(s => `
                        <button onclick="updateEnquiryStatusFromDetail('${enq.id}', '${s.key}')"
                            style="flex: 1; min-width: 70px; padding: 6px 4px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid ${enq.status === s.key ? s.color : 'var(--border)'}; background: ${enq.status === s.key ? s.bg : 'var(--surface)'}; color: ${enq.status === s.key ? s.color : 'var(--text-secondary)'}; transition: all 0.15s;">
                            ${s.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Contact Info -->
                <div class="card" style="padding: 16px; margin-bottom: 16px;">
                    <h4 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Contact</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${enq.guest_phone ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Phone</span><div style="font-size: 14px; font-weight: 500;">${escapeHtml(enq.guest_phone)}</div></div>` : ''}
                        ${enq.guest_email ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Email</span><div style="font-size: 14px; font-weight: 500;">${escapeHtml(enq.guest_email)}</div></div>` : ''}
                    </div>
                    ${enq.guest_phone ? `
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <a href="tel:${enq.guest_phone}" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; background: var(--primary); color: white; text-decoration: none;"><i data-lucide="phone" style="width: 12px; height: 12px;"></i>Call</a>
                        <a href="https://wa.me/${enq.guest_phone.replace(/[^0-9]/g, '')}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; background: #25D366; color: white; text-decoration: none;"><i data-lucide="message-circle" style="width: 12px; height: 12px;"></i>WhatsApp</a>
                    </div>` : ''}
                </div>

                <!-- Booking Details -->
                <div class="card" style="padding: 16px; margin-bottom: 16px;">
                    <h4 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Enquiry Details</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${enq.property_name ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Property</span><div style="font-size: 14px; font-weight: 500;">${escapeHtml(enq.property_name)}</div></div>` : ''}
                        <div><span style="font-size: 12px; color: var(--text-tertiary);">Source</span><div style="font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="${sourceInfo.icon}" style="width: 14px; height: 14px;"></i>${sourceInfo.label}</div></div>
                        ${enq.check_in ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Check-in</span><div style="font-size: 14px; font-weight: 500;">${new Date(enq.check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>` : ''}
                        ${enq.check_out ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Check-out</span><div style="font-size: 14px; font-weight: 500;">${new Date(enq.check_out).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>` : ''}
                        ${enq.nights ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Nights</span><div style="font-size: 14px; font-weight: 500;">${enq.nights}</div></div>` : ''}
                        ${enq.number_of_guests ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Guests</span><div style="font-size: 14px; font-weight: 500;">${enq.number_of_guests}</div></div>` : ''}
                        ${enq.budget_range ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Budget</span><div style="font-size: 14px; font-weight: 500;">${escapeHtml(enq.budget_range)}</div></div>` : ''}
                        <div><span style="font-size: 12px; color: var(--text-tertiary);">Priority</span><div style="font-size: 14px; font-weight: 500; text-transform: capitalize;">${enq.priority || 'medium'}</div></div>
                    </div>
                </div>

                <!-- Follow-up & Notes -->
                ${enq.follow_up_date || enq.notes ? `
                <div class="card" style="padding: 16px; margin-bottom: 16px;">
                    ${enq.follow_up_date ? `<div style="margin-bottom: 8px;"><span style="font-size: 12px; color: var(--text-tertiary);">Follow-up Date</span><div style="font-size: 14px; font-weight: 500;">${new Date(enq.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>` : ''}
                    ${enq.notes ? `<div><span style="font-size: 12px; color: var(--text-tertiary);">Notes</span><div style="font-size: 14px; white-space: pre-wrap; margin-top: 4px;">${escapeHtml(enq.notes)}</div></div>` : ''}
                </div>` : ''}

                <div style="font-size: 12px; color: var(--text-tertiary); text-align: center;">Created ${createdDate}</div>
            </div>
            <div class="modal-footer" style="display: flex; justify-content: space-between;">
                <button class="btn" onclick="deleteEnquiryConfirm('${enq.id}')" style="color: #ef4444; border-color: #ef4444; display: flex; align-items: center; gap: 4px;"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Delete</button>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" onclick="openEnquiryModal('${enq.id}'); this.closest('.modal').remove();">Edit</button>
                    ${enq.status !== 'converted' ? `<button class="btn btn-primary" onclick="convertEnquiryToBooking('${enq.id}')" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="arrow-right-circle" style="width: 14px; height: 14px;"></i> Convert to Booking</button>` : ''}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    requestAnimationFrame(() => {
        if (typeof refreshIcons === 'function') refreshIcons(modal);
    });
}

async function updateEnquiryStatusFromDetail(id, newStatus) {
    try {
        const extra = {};
        if (newStatus === 'lost') {
            const reason = prompt('Reason for lost lead (optional):');
            if (reason !== null) extra.lost_reason = reason;
        }
        await db.updateEnquiryStatus(id, newStatus, extra);
        showToast('Status Updated', `Enquiry moved to ${ENQUIRY_STATUSES.find(s => s.key === newStatus)?.label || newStatus}`, '✅');
        document.querySelectorAll('.modal').forEach(m => m.remove());
        await loadEnquiries();
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Error', 'Failed to update status', '❌');
    }
}

async function deleteEnquiryConfirm(id) {
    if (!confirm('Delete this enquiry? This cannot be undone.')) return;
    try {
        await db.deleteEnquiry(id);
        document.querySelectorAll('.modal').forEach(m => m.remove());
        showToast('Deleted', 'Enquiry removed', '✅');
        await loadEnquiries();
    } catch (error) {
        console.error('Error deleting enquiry:', error);
        showToast('Error', 'Failed to delete enquiry', '❌');
    }
}

// ── Convert to Booking ─────────────────────────────
async function convertEnquiryToBooking(enquiryId) {
    const enq = enquiriesData.find(e => e.id === enquiryId);
    if (!enq) return;

    // Close the detail modal
    document.querySelectorAll('.modal').forEach(m => m.remove());

    // Pre-fill reservation modal with enquiry data
    if (typeof openReservationModal === 'function') {
        openReservationModal();

        // Wait for modal to render, then fill fields
        setTimeout(() => {
            const fields = {
                'guestName': enq.guest_name,
                'guestPhone': enq.guest_phone,
                'guestEmail': enq.guest_email,
                'checkIn': enq.check_in,
                'checkOut': enq.check_out,
                'numberOfGuests': enq.number_of_guests,
                'numberOfRooms': enq.number_of_rooms
            };

            for (const [id, val] of Object.entries(fields)) {
                const el = document.getElementById(id);
                if (el && val) {
                    el.value = val;
                    el.dispatchEvent(new Event('change'));
                }
            }

            // Set property
            if (enq.property_id) {
                const propSelect = document.getElementById('propertyId');
                if (propSelect) {
                    propSelect.value = enq.property_id;
                    propSelect.dispatchEvent(new Event('change'));
                }
            }

            // Mark enquiry as converted after booking is saved
            // Store enquiry ID to link after save
            window._pendingEnquiryConversion = enquiryId;
        }, 300);
    }
}

// Hook: call this after a reservation is saved to mark linked enquiry as converted
async function markEnquiryConverted(enquiryId, bookingId) {
    try {
        await db.updateEnquiryStatus(enquiryId, 'converted', { converted_booking_id: bookingId });
    } catch (error) {
        console.error('Error marking enquiry as converted:', error);
    }
}
