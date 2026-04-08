// ResIQ Team — Team members and property owners management

// ========================================

// Team
async function loadTeam() {
    try {
        const members = await db.getTeamMembers();
        const tbody = document.getElementById('teamTableBody');
        
        tbody.innerHTML = members.map(m => `
            <tr>
                <td>${m.name}</td>
                <td>${m.email}</td>
                <td><span class="badge badge-confirmed">${m.role.toUpperCase()}</span></td>
                <td><span class="badge ${m.is_active ? 'badge-confirmed' : 'badge-cancelled'}">${m.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteTeamMember(${m.id})">Remove</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Team error:', error);
        showToast('Error', 'Failed to load team', '❌');
    }
}

function openTeamModal() {
    document.getElementById('teamModal').classList.add('active');
}

function closeTeamModal() {
    document.getElementById('teamModal').classList.remove('active');
    document.getElementById('teamMemberName').value = '';
    document.getElementById('teamMemberEmail').value = '';
    document.getElementById('teamMemberPassword').value = '';
}

async function saveTeamMember() {
    try {
        const member = {
            name: document.getElementById('teamMemberName').value,
            email: document.getElementById('teamMemberEmail').value,
            password: document.getElementById('teamMemberPassword').value,
            role: document.getElementById('teamMemberRole').value,
            is_active: true
        };

        if (!member.name || !member.email || !member.password) {
            showToast('Validation Error', 'Please fill in all required fields', '❌');
            return;
        }

        // Set owner_id if current user is an external owner
        if (currentUser?.userType === 'owner' && currentUser?.is_external) {
            member.owner_id = currentUser.id;
        }

        // Create Firebase Auth account for the new team member
        try {
            const authResp = await fetch('/api/auth-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create-user', email: member.email, password: member.password, displayName: member.name })
            });
            const authResult = await authResp.json();
            if (!authResp.ok) throw new Error(authResult.error || 'Failed to create auth account');
        } catch (authErr) {
            // If error is NOT "user already exists", fail
            if (!authErr.message.includes('already exists') && !authErr.message.includes('email-already-exists')) {
                throw authErr;
            }
        }

        await db.saveTeamMember(member);
        closeTeamModal();
        await loadTeam();
        showToast('Success', 'Team member added!', '✅');
    } catch (error) {
        console.error('Save team member error:', error);
        showToast('Error', 'Failed to save team member', '❌');
    }
}

async function deleteTeamMember(id) {
    if (!confirm('Remove this team member?')) return;

    try {
        // Get member email before deleting (for Firebase cleanup)
        const members = await db.getTeamMembers();
        const member = members.find(m => m.id === id);

        await db.deleteTeamMember(id);

        // Also delete Firebase Auth account
        if (member?.email) {
            try {
                await fetch('/api/auth-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete-user', email: member.email })
                });
            } catch (e) { /* best effort */ }
        }

        await loadTeam();
        showToast('Removed', 'Team member removed successfully', '✅');
    } catch (error) {
        console.error('Delete team member error:', error);
        showToast('Error', 'Failed to remove team member', '❌');
    }
}

// ========== PROPERTY OWNERS MANAGEMENT ==========

// ========== PROPERTY OWNERS MANAGEMENT ==========

async function loadOwners() {
    try {
        const owners = await db.getOwners();
        const properties = await db.getProperties();
        const tbody = document.getElementById('ownersTableBody');

        if (!owners || owners.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: var(--text-secondary);">No owners added yet. Click "+ Add Owner" to get started.</td></tr>';
            return;
        }

        tbody.innerHTML = owners.map(owner => {
            // Get assigned property names
            const assignedProps = owner.property_ids || [];
            const propNames = assignedProps.map(id => {
                const prop = properties.find(p => p.id === id);
                return prop ? prop.name : `Property ${id}`;
            }).join(', ') || 'None';

            const statusText = owner.is_active ? 'ACTIVE' : 'INACTIVE';
            const statusBadge = owner.is_active ? 'badge-success' : 'badge-warning';

            return `
                <tr>
                    <td>${owner.name}</td>
                    <td>${owner.email}</td>
                    <td>${owner.phone || '-'}</td>
                    <td><span class="badge badge-info">${assignedProps.length} propert${assignedProps.length === 1 ? 'y' : 'ies'}</span><br><small style="color: var(--text-secondary);">${propNames}</small></td>
                    <td><span class="badge ${statusBadge}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="editOwner('${owner.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteOwner('${owner.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Load owners error:', error);
        showToast('Error', 'Failed to load owners', '❌');
    }
}

async function openOwnerModal(ownerId = null) {
    try {
        const properties = await db.getProperties();
        const modal = document.getElementById('ownerModal');

        // Populate property checkboxes
        const checkboxContainer = document.getElementById('propertyCheckboxes');
        checkboxContainer.innerHTML = properties.map(prop => `
            <label style="display: flex; align-items: center; gap: 8px; padding: 8px; cursor: pointer; border-radius: 4px;" onmouseover="this.style.background='var(--background-alt)'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" value="${prop.id}" class="property-checkbox" style="width: 18px; height: 18px;">
                <span>${prop.name}</span>
            </label>
        `).join('');

        if (ownerId) {
            // Edit mode - load owner data
            const owner = await db.getOwner(ownerId);
            document.getElementById('ownerName').value = owner.name;
            document.getElementById('ownerEmail').value = owner.email;
            document.getElementById('ownerPhone').value = owner.phone || '';
            document.getElementById('ownerStatus').value = owner.is_active ? 'active' : 'inactive';
            document.querySelector('.modal-title').textContent = 'Edit Property Owner';

            // Check assigned properties
            const assignedProps = owner.property_ids || [];
            assignedProps.forEach(propId => {
                const checkbox = document.querySelector(`.property-checkbox[value="${propId}"]`);
                if (checkbox) checkbox.checked = true;
            });

            // Hide password field for edit
            document.getElementById('ownerPassword').parentElement.style.display = 'none';

            // Store owner ID for update
            modal.dataset.ownerId = ownerId;
        } else {
            // Add mode
            document.querySelector('.modal-title').textContent = 'Add Property Owner';
            document.getElementById('ownerPassword').parentElement.style.display = 'block';
            delete modal.dataset.ownerId;
        }

        modal.classList.add('active');
    } catch (error) {
        console.error('Open owner modal error:', error);
        showToast('Error', 'Failed to open owner modal', '❌');
    }
}

function closeOwnerModal() {
    const modal = document.getElementById('ownerModal');
    modal.classList.remove('active');

    // Reset form
    document.getElementById('ownerName').value = '';
    document.getElementById('ownerEmail').value = '';
    document.getElementById('ownerPassword').value = '';
    document.getElementById('ownerPhone').value = '';
    document.getElementById('ownerStatus').value = 'active';
    document.querySelectorAll('.property-checkbox').forEach(cb => cb.checked = false);
    delete modal.dataset.ownerId;
}

async function saveOwner() {
    try {
        const modal = document.getElementById('ownerModal');
        const ownerId = modal.dataset.ownerId;

        const name = document.getElementById('ownerName').value.trim();
        const email = document.getElementById('ownerEmail').value.trim();
        const password = document.getElementById('ownerPassword').value;
        const phone = document.getElementById('ownerPhone').value.trim();
        const status = document.getElementById('ownerStatus').value;

        // Get selected properties
        const selectedProperties = Array.from(document.querySelectorAll('.property-checkbox:checked'))
            .map(cb => parseInt(cb.value));

        // Validation
        if (!name || !email) {
            showToast('Validation Error', 'Please fill in name and email', '❌');
            return;
        }

        if (!ownerId && (!password || password.length < 6)) {
            showToast('Validation Error', 'Password must be at least 6 characters', '❌');
            return;
        }

        if (selectedProperties.length === 0) {
            showToast('Validation Error', 'Please assign at least one property', '❌');
            return;
        }

        const ownerData = {
            name,
            email,
            phone,
            is_active: status === 'active',
            property_ids: selectedProperties
        };

        // Add password only for new owners
        if (!ownerId) {
            ownerData.password = password;
        }

        if (ownerId) {
            // Update existing owner
            await db.updateOwner(ownerId, ownerData);
            showToast('Success', 'Owner updated successfully!', '✅');
        } else {
            // Create new owner
            await db.createOwner(ownerData);
            showToast('Success', 'Owner created successfully!', '✅');
        }

        closeOwnerModal();
        await loadOwners();
    } catch (error) {
        console.error('Save owner error:', error);
        showToast('Error', error.message || 'Failed to save owner', '❌');
    }
}

async function editOwner(ownerId) {
    await openOwnerModal(ownerId);
}

async function deleteOwner(ownerId) {
    if (!confirm('Are you sure you want to delete this owner? They will lose access to the Owner Portal.')) {
        return;
    }

    try {
        await db.deleteOwner(ownerId);
        await loadOwners();
        showToast('Success', 'Owner deleted successfully', '✅');
    } catch (error) {
        console.error('Delete owner error:', error);
        showToast('Error', 'Failed to delete owner', '❌');
    }
}

// ========== PROPERTY EXPENSES MANAGEMENT ==========

let allExpensesData = [];
let filteredExpensesData = [];


async function loadExpenses() {
    try {
        const properties = await db.getProperties();

        // Populate property filter
        const propFilter = document.getElementById('expensePropertyFilter');
        if (propFilter.options.length <= 1) {
            properties.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                propFilter.appendChild(opt);
            });
        }

        // Populate month filter (last 12 months)
        const monthFilter = document.getElementById('expenseMonthFilter');
        if (monthFilter.options.length <= 1) {
            for (let i = 0; i < 12; i++) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
                const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = label;
                monthFilter.appendChild(opt);
            }
        }

        // Fetch all expenses
        allExpensesData = await db.getAllExpenses();

        // Store property lookup
        window._expenseProperties = {};
        properties.forEach(p => { window._expenseProperties[p.id] = p.name; });

        filterExpenses();
    } catch (error) {
        console.error('Error loading expenses:', error);
        showToast('Error', 'Failed to load expenses', '❌');
    }
}

function filterExpenses() {
    const propId = document.getElementById('expensePropertyFilter').value;
    const category = document.getElementById('expenseCategoryFilter').value;
    const month = document.getElementById('expenseMonthFilter').value;

    filteredExpensesData = allExpensesData.filter(e => {
        if (propId && e.property_id != propId) return false;
        if (category && e.category !== category) return false;
        if (month && e.settlement_month !== month) return false;
        return true;
    });

    renderExpensesSummary(filteredExpensesData);
    renderExpensesList(filteredExpensesData);
}

function renderExpensesSummary(expenses) {
    const container = document.getElementById('expenseSummaryStats');
    const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const categories = {};
    expenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + (parseFloat(e.amount) || 0);
    });

    const categoryColors = {
        maintenance: '#ef4444', utilities: '#3b82f6', housekeeping: '#10b981',
        supplies: '#f59e0b', staff: '#8b5cf6', other: '#64748b'
    };
    const categoryIcons = {
        maintenance: '🔧', utilities: '💡', housekeeping: '🧹',
        supplies: '📦', staff: '👷', other: '📋'
    };

    let html = `
        <div style="background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 12px;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 4px;">Total Expenses</div>
            <div style="font-size: 28px; font-weight: 800;">₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${expenses.length} expense${expenses.length !== 1 ? 's' : ''}</div>
        </div>
    `;

    Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
        html += `
            <div style="background: var(--surface); padding: 16px; border-radius: 12px; border: 1px solid var(--border); border-left: 4px solid ${categoryColors[cat] || '#64748b'};">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${categoryIcons[cat] || '📋'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
                <div style="font-size: 20px; font-weight: 700;">₹${amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderExpensesList(expenses) {
    const container = document.getElementById('expensesList');

    if (expenses.length === 0) {
        container.innerHTML = '<div class="card" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);"><div style="font-size: 48px; margin-bottom: 16px;">🔧</div><h3>No expenses found</h3><p>Add property expenses to track them in monthly settlements.</p></div>';
        return;
    }

    const categoryLabels = {
        maintenance: 'Maintenance', utilities: 'Utilities', housekeeping: 'Housekeeping',
        supplies: 'Supplies', staff: 'Staff', other: 'Other'
    };
    const categoryColors = {
        maintenance: '#fee2e2', utilities: '#dbeafe', housekeeping: '#d1fae5',
        supplies: '#fef3c7', staff: '#ede9fe', other: '#f1f5f9'
    };

    let html = '<div class="card"><div class="table-container"><table class="data-table"><thead><tr>';
    html += '<th>Date</th><th>Property</th><th>Category</th><th>Amount</th><th>Description</th><th>Receipt</th><th>Entered By</th><th>Actions</th>';
    html += '</tr></thead><tbody>';

    expenses.forEach(e => {
        const date = new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const propName = window._expenseProperties?.[e.property_id] || 'Unknown';
        const hasReceipt = !!e.receipt_url;

        html += `<tr>`;
        html += `<td>${date}</td>`;
        html += `<td>${propName}</td>`;
        html += `<td><span style="background: ${categoryColors[e.category] || '#f1f5f9'}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">${categoryLabels[e.category] || e.category}</span></td>`;
        html += `<td><strong>₹${parseFloat(e.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></td>`;
        html += `<td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${e.description || '-'}</td>`;
        html += `<td style="text-align:center;">${hasReceipt ? `<button onclick="viewExpenseReceipt('${e.receipt_url}')" style="background:none;border:none;cursor:pointer;font-size:18px;padding:4px;" title="View receipt">📷</button>` : '<span style="color:var(--text-secondary);font-size:12px;">-</span>'}</td>`;
        html += `<td><span style="font-size: 12px; color: var(--text-secondary);">${e.entered_by_type === 'owner' ? '👤 Owner' : '🏢 Staff'}</span></td>`;
        html += `<td>
            <button onclick="openAdminExpenseModal('${e.id}')" style="padding: 6px 10px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; margin-right: 4px;">Edit</button>
            <button onclick="deleteAdminExpense('${e.id}')" style="padding: 6px 10px; background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Delete</button>
        </td>`;
        html += `</tr>`;
    });

    html += '</tbody></table></div></div>';
    container.innerHTML = html;
}

async function openAdminExpenseModal(expenseId = null) {
    // Use a simple prompt-style modal via DOM
    let existingModal = document.getElementById('adminExpenseModal');
    if (existingModal) existingModal.remove();

    const properties = await db.getProperties();
    let expense = null;

    if (expenseId) {
        expense = allExpensesData.find(e => e.id === expenseId);
    }

    const modal = document.createElement('div');
    modal.id = 'adminExpenseModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;padding:32px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                <h3 style="margin:0;font-size:20px;font-weight:700;">${expenseId ? 'Edit Expense' : 'Add Expense'}</h3>
                <button onclick="document.getElementById('adminExpenseModal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text-secondary);">&times;</button>
            </div>
            <div style="display:grid;gap:16px;">
                <div>
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Property *</label>
                    <select id="adminExpPropertySelect" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;">
                        <option value="">Select property</option>
                        ${properties.map(p => `<option value="${p.id}" ${expense && expense.property_id == p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Category *</label>
                    <select id="adminExpCategory" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;">
                        <option value="maintenance" ${expense?.category === 'maintenance' ? 'selected' : ''}>Maintenance / Repairs</option>
                        <option value="utilities" ${expense?.category === 'utilities' ? 'selected' : ''}>Utilities</option>
                        <option value="housekeeping" ${expense?.category === 'housekeeping' ? 'selected' : ''}>Housekeeping</option>
                        <option value="supplies" ${expense?.category === 'supplies' ? 'selected' : ''}>Supplies / Amenities</option>
                        <option value="staff" ${expense?.category === 'staff' ? 'selected' : ''}>Staff Costs</option>
                        <option value="other" ${expense?.category === 'other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Amount (₹) *</label>
                    <input type="number" id="adminExpAmount" value="${expense ? expense.amount : ''}" min="1" step="0.01" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;" placeholder="Enter amount">
                </div>
                <div>
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Date *</label>
                    <input type="date" id="adminExpDate" value="${expense ? expense.expense_date : new Date().toISOString().split('T')[0]}" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;">
                </div>
                <div>
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Description</label>
                    <textarea id="adminExpDescription" rows="3" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;resize:vertical;" placeholder="Optional description">${expense?.description || ''}</textarea>
                </div>
                <div>
                    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;">Receipt / Photo</label>
                    <div id="adminExpReceiptPreview" style="margin-bottom:8px;${expense?.receipt_url ? '' : 'display:none;'}">
                        ${expense?.receipt_url ? `<div style="position:relative;display:inline-block;"><img src="${expense.receipt_url}" style="max-width:100%;max-height:150px;border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="window.open(this.src,'_blank')"><button onclick="clearAdminExpReceipt()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1;">&times;</button></div>` : ''}
                    </div>
                    <label style="display:flex;align-items:center;gap:8px;padding:12px;border:2px dashed var(--border);border-radius:8px;cursor:pointer;transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
                        <input type="file" id="adminExpReceipt" accept="image/*" style="display:none;" onchange="previewAdminExpReceipt(this)">
                        <span style="font-size:20px;">📎</span>
                        <span style="font-size:13px;color:var(--text-secondary);" id="adminExpReceiptLabel">Tap to attach receipt photo</span>
                    </label>
                    <input type="hidden" id="adminExpReceiptUrl" value="${expense?.receipt_url || ''}">
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
                    <button onclick="document.getElementById('adminExpenseModal').remove()" style="padding:10px 20px;border:1px solid var(--border);background:var(--surface);border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                    <button id="adminExpSaveBtn" onclick="saveAdminExpense('${expenseId || ''}')" style="padding:10px 20px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Save Expense</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// Receipt photo preview for admin expense modal
window.previewAdminExpReceipt = function(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Invalid File', 'Please select an image file', '❌');
        input.value = '';
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showToast('Too Large', 'Receipt photo must be under 5MB', '❌');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('adminExpReceiptPreview');
        preview.style.display = 'block';
        preview.innerHTML = `<div style="position:relative;display:inline-block;"><img src="${e.target.result}" style="max-width:100%;max-height:150px;border-radius:8px;border:1px solid var(--border);"><button onclick="clearAdminExpReceipt()" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1;">&times;</button></div>`;
        document.getElementById('adminExpReceiptLabel').textContent = file.name;
    };
    reader.readAsDataURL(file);
};

window.clearAdminExpReceipt = function() {
    const preview = document.getElementById('adminExpReceiptPreview');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    const input = document.getElementById('adminExpReceipt');
    if (input) input.value = '';
    const url = document.getElementById('adminExpReceiptUrl');
    if (url) url.value = '';
    const label = document.getElementById('adminExpReceiptLabel');
    if (label) label.textContent = 'Tap to attach receipt photo';
};

async function uploadExpenseReceipt(file, propertyId) {
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `property-${propertyId}/${Date.now()}.${ext}`;

    const res = await fetch('/api/storage-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'upload',
            bucket: 'expense-receipts',
            path: path,
            fileBase64: base64,
            contentType: file.type,
            upsert: true
        })
    });

    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'Upload failed');

    // Get a signed URL for viewing
    const urlRes = await fetch('/api/storage-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'signed-url',
            bucket: 'expense-receipts',
            path: path,
            expiresIn: 31536000 // 1 year
        })
    });

    const urlJson = await urlRes.json();
    if (urlJson.error) throw new Error(urlJson.error.message || 'Failed to get URL');

    return { path: path, signedUrl: urlJson.data.signedUrl };
}

async function saveAdminExpense(expenseId) {
    try {
        const propertyId = parseInt(document.getElementById('adminExpPropertySelect').value);
        const amount = parseFloat(document.getElementById('adminExpAmount').value);
        const category = document.getElementById('adminExpCategory').value;
        const expenseDate = document.getElementById('adminExpDate').value;
        const description = document.getElementById('adminExpDescription').value.trim();

        if (!propertyId || !amount || amount <= 0 || !expenseDate) {
            showToast('Validation', 'Please fill in all required fields', '❌');
            return;
        }

        const saveBtn = document.getElementById('adminExpSaveBtn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

        // Upload receipt photo if selected
        let receiptUrl = document.getElementById('adminExpReceiptUrl')?.value || null;
        const receiptFile = document.getElementById('adminExpReceipt')?.files[0];
        if (receiptFile) {
            try {
                const upload = await uploadExpenseReceipt(receiptFile, propertyId);
                receiptUrl = upload.path; // Store the path, generate signed URL on view
            } catch (uploadErr) {
                console.error('Receipt upload failed:', uploadErr);
                showToast('Upload Error', 'Failed to upload receipt: ' + uploadErr.message, '❌');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Expense'; }
                return;
            }
        }

        // Calculate settlement month
        const d = new Date(expenseDate);
        const settlementMonth = `${d.getFullYear()}-${d.getMonth() + 1}`;

        const expense = {
            property_id: propertyId,
            amount: amount,
            category: category,
            expense_date: expenseDate,
            description: description || null,
            receipt_url: receiptUrl,
            entered_by: currentUser?.email || 'staff',
            entered_by_type: 'staff',
            settlement_month: settlementMonth
        };

        if (expenseId) {
            expense.id = expenseId;
        }

        await db.saveExpense(expense);

        document.getElementById('adminExpenseModal').remove();
        showToast('Success', expenseId ? 'Expense updated!' : 'Expense added!', '✅');

        // Reload
        viewLoadingState['expenses'] = false;
        await loadExpenses();
    } catch (error) {
        console.error('Error saving expense:', error);
        showToast('Error', 'Failed to save expense: ' + error.message, '❌');
    }
}

async function deleteAdminExpense(expenseId) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
        await db.deleteExpense(expenseId);
        showToast('Deleted', 'Expense deleted', '✅');
        viewLoadingState['expenses'] = false;
        await loadExpenses();
    } catch (error) {
        showToast('Error', 'Failed to delete expense: ' + error.message, '❌');
    }
}

// ========== PROPERTY P&L (PROFIT & LOSS) ==========

async function loadPnL() {
    const properties = await db.getProperties();

    // Populate property filter (once)
    const propFilter = document.getElementById('pnlPropertyFilter');
    if (propFilter && propFilter.options.length <= 1) {
        properties.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            propFilter.appendChild(opt);
        });
    }

    // Get date range from period filter.
    // Both startDate and endDate are bounded (inclusive) so the report does not
    // silently include future-dated bookings or expenses.
    const period = document.getElementById('pnlPeriodFilter')?.value || 'year';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let startDate = null;
    let endDate = todayStr;

    if (period === 'current') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (period === 'last') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (period === 'quarter') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
        endDate = todayStr;
    } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = todayStr;
    }

    const selectedProperty = document.getElementById('pnlPropertyFilter')?.value;
    const propertyIds = selectedProperty ? [parseInt(selectedProperty)] : properties.map(p => p.id);

    // Fetch reservations
    let reservations = allReservations || [];
    if (startDate) {
        reservations = reservations.filter(r => r.check_in >= startDate && r.check_in <= endDate);
    }
    // Filter cancelled reservations using the canonical `status` field.
    // (The previous `r.booking_status` field does not exist on the schema, so the
    //  old filter was a no-op and silently included cancelled bookings in P&L.)
    reservations = reservations.filter(r =>
        propertyIds.includes(r.property_id) &&
        r.status !== 'cancelled'
    );

    // Fetch expenses
    let expenses = await db.getAllExpenses(propertyIds);
    if (startDate) {
        expenses = expenses.filter(e => e.expense_date >= startDate && e.expense_date <= endDate);
    }

    // Build property lookup (including is_managed flag)
    const propMap = {};
    const propManaged = {};
    properties.forEach(p => {
        propMap[p.id] = p.name;
        propManaged[p.id] = p.is_managed === true;
    });

    // Calculate P&L per property
    const pnlByProperty = {};
    propertyIds.forEach(pid => {
        pnlByProperty[pid] = {
            name: propMap[pid] || 'Unknown',
            isManaged: propManaged[pid] || false,
            grossRevenue: 0,
            otaFees: 0,
            netRevenue: 0,
            hostizzyCommission: 0,
            taxes: 0,
            expenses: 0,
            bookings: 0
        };
    });

    reservations.forEach(r => {
        const pid = r.property_id;
        if (!pnlByProperty[pid]) return;
        const p = pnlByProperty[pid];
        p.grossRevenue += parseFloat(r.total_amount) || 0;
        p.otaFees += parseFloat(r.ota_service_fee) || 0;
        p.hostizzyCommission += parseFloat(r.hostizzy_revenue) || 0;
        p.taxes += parseFloat(r.taxes) || 0;
        p.bookings++;
    });

    expenses.forEach(e => {
        const pid = e.property_id;
        if (!pnlByProperty[pid]) return;
        pnlByProperty[pid].expenses += parseFloat(e.amount) || 0;
    });

    // Calculate net revenue and profit (managed vs non-managed)
    Object.values(pnlByProperty).forEach(p => {
        p.netRevenue = p.grossRevenue - p.otaFees;

        if (p.isManaged) {
            // Managed: expenses come from Hostizzy's commission, owner gets full payout
            p.ownerPayout = p.netRevenue - p.hostizzyCommission;
            p.hostizzyNet = p.hostizzyCommission - p.expenses; // Hostizzy keeps commission minus expenses
            p.netProfit = p.ownerPayout; // Owner's net = full payout (no expense deduction)
        } else {
            // Non-managed: expenses come from owner's payout
            p.ownerPayout = p.netRevenue - p.hostizzyCommission;
            p.hostizzyNet = p.hostizzyCommission; // Hostizzy keeps full commission
            p.netProfit = p.ownerPayout - p.expenses; // Owner pays expenses
        }
    });

    // Totals
    const totals = Object.values(pnlByProperty).reduce((t, p) => {
        t.grossRevenue += p.grossRevenue;
        t.otaFees += p.otaFees;
        t.netRevenue += p.netRevenue;
        t.hostizzyCommission += p.hostizzyCommission;
        t.hostizzyNet += p.hostizzyNet;
        t.taxes += p.taxes;
        t.expenses += p.expenses;
        t.ownerPayout += p.ownerPayout;
        t.netProfit += p.netProfit;
        t.bookings += p.bookings;
        return t;
    }, { grossRevenue: 0, otaFees: 0, netRevenue: 0, hostizzyCommission: 0, hostizzyNet: 0, taxes: 0, expenses: 0, ownerPayout: 0, netProfit: 0, bookings: 0 });

    renderPnLSummary(totals);
    renderPnLTable(pnlByProperty, totals);
}

function renderPnLSummary(totals) {
    const fmt = (v) => '₹' + Math.round(v).toLocaleString('en-IN');
    const profitColor = totals.netProfit >= 0 ? '#10b981' : '#ef4444';
    const marginPct = totals.netRevenue > 0 ? ((totals.netProfit / totals.netRevenue) * 100).toFixed(1) : '0.0';

    const hostizzyNetColor = totals.hostizzyNet >= 0 ? '#10b981, #047857' : '#ef4444, #dc2626';
    document.getElementById('pnlSummaryCards').innerHTML = `
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 12px; color: white;">
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Gross Revenue</div>
            <div style="font-size: 24px; font-weight: 800;">${fmt(totals.grossRevenue)}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${totals.bookings} bookings</div>
        </div>
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 20px; border-radius: 12px; color: white;">
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Net Revenue</div>
            <div style="font-size: 24px; font-weight: 800;">${fmt(totals.netRevenue)}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">After OTA fees</div>
        </div>
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 20px; border-radius: 12px; color: white;">
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Hostizzy Net</div>
            <div style="font-size: 24px; font-weight: 800;">${fmt(totals.hostizzyNet)}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Commission - Managed Exp.</div>
        </div>
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 12px; color: white;">
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Total Expenses</div>
            <div style="font-size: 24px; font-weight: 800;">${fmt(totals.expenses)}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Property costs</div>
        </div>
        <div style="background: linear-gradient(135deg, ${totals.netProfit >= 0 ? '#10b981, #047857' : '#ef4444, #dc2626'}); padding: 20px; border-radius: 12px; color: white;">
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">Owner Net Profit</div>
            <div style="font-size: 24px; font-weight: 800;">${fmt(totals.netProfit)}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${marginPct}% margin</div>
        </div>
    `;
}

function renderPnLTable(pnlByProperty, totals) {
    const fmt = (v) => '₹' + Math.round(v).toLocaleString('en-IN');
    const entries = Object.entries(pnlByProperty).filter(([_, p]) => p.bookings > 0 || p.expenses > 0);

    if (entries.length === 0) {
        document.getElementById('pnlContent').innerHTML = '<div class="card" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);"><div style="font-size: 48px; margin-bottom: 16px;">📊</div><h3>No data for selected period</h3><p>Adjust the date range or property filter.</p></div>';
        return;
    }

    let html = '<div class="card"><div class="table-container"><table class="data-table"><thead><tr>';
    html += '<th>Property</th><th style="text-align:right;">Gross Revenue</th><th style="text-align:right;">OTA Fees</th><th style="text-align:right;">Net Revenue</th>';
    html += '<th style="text-align:right;">Commission</th><th style="text-align:right;">Hostizzy Net</th><th style="text-align:right;">Owner Payout</th><th style="text-align:right;">Expenses</th><th style="text-align:right;">Owner Net</th>';
    html += '</tr></thead><tbody>';

    entries.sort((a, b) => b[1].netProfit - a[1].netProfit);

    entries.forEach(([pid, p]) => {
        const profitColor = p.netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
        const hostizzyNetColor = p.hostizzyNet >= 0 ? 'var(--success)' : 'var(--danger)';
        const managedBadge = p.isManaged ? '<span style="display:inline-block;padding:2px 6px;background:#8b5cf615;color:#8b5cf6;border-radius:4px;font-size:10px;font-weight:600;margin-left:4px;">MANAGED</span>' : '';
        const expenseNote = p.isManaged ? '<div style="font-size:10px;color:#8b5cf6;">From Hostizzy share</div>' : '';
        html += `<tr>`;
        html += `<td><strong>${p.name}</strong>${managedBadge}<div style="font-size:11px;color:var(--text-secondary);">${p.bookings} booking${p.bookings !== 1 ? 's' : ''}</div></td>`;
        html += `<td style="text-align:right;">${fmt(p.grossRevenue)}</td>`;
        html += `<td style="text-align:right;color:var(--text-secondary);">${p.otaFees > 0 ? '-' + fmt(p.otaFees) : '-'}</td>`;
        html += `<td style="text-align:right;">${fmt(p.netRevenue)}</td>`;
        html += `<td style="text-align:right;color:var(--text-secondary);">${p.hostizzyCommission > 0 ? '-' + fmt(p.hostizzyCommission) : '-'}</td>`;
        html += `<td style="text-align:right;color:${hostizzyNetColor};">${fmt(p.hostizzyNet)}</td>`;
        html += `<td style="text-align:right;">${fmt(p.ownerPayout)}</td>`;
        html += `<td style="text-align:right;color:var(--text-secondary);">${p.expenses > 0 ? '-' + fmt(p.expenses) : '-'}${expenseNote}</td>`;
        html += `<td style="text-align:right;font-weight:700;color:${profitColor};">${fmt(p.netProfit)}</td>`;
        html += `</tr>`;
    });

    // Totals row
    const totalProfitColor = totals.netProfit >= 0 ? 'var(--success)' : 'var(--danger)';
    const totalHzNetColor = totals.hostizzyNet >= 0 ? 'var(--success)' : 'var(--danger)';
    html += `<tr style="border-top: 2px solid var(--border); font-weight: 700; background: var(--bg-secondary);">`;
    html += `<td>TOTAL</td>`;
    html += `<td style="text-align:right;">${fmt(totals.grossRevenue)}</td>`;
    html += `<td style="text-align:right;">${totals.otaFees > 0 ? '-' + fmt(totals.otaFees) : '-'}</td>`;
    html += `<td style="text-align:right;">${fmt(totals.netRevenue)}</td>`;
    html += `<td style="text-align:right;">${totals.hostizzyCommission > 0 ? '-' + fmt(totals.hostizzyCommission) : '-'}</td>`;
    html += `<td style="text-align:right;color:${totalHzNetColor};">${fmt(totals.hostizzyNet)}</td>`;
    html += `<td style="text-align:right;">${fmt(totals.ownerPayout)}</td>`;
    html += `<td style="text-align:right;">${totals.expenses > 0 ? '-' + fmt(totals.expenses) : '-'}</td>`;
    html += `<td style="text-align:right;color:${totalProfitColor};">${fmt(totals.netProfit)}</td>`;
    html += `</tr>`;

    html += '</tbody></table></div></div>';

    // Calculate managed vs non-managed expense split
    const managedExpenses = entries.filter(([_, p]) => p.isManaged).reduce((s, [_, p]) => s + p.expenses, 0);
    const nonManagedExpenses = entries.filter(([_, p]) => !p.isManaged).reduce((s, [_, p]) => s + p.expenses, 0);

    // P&L statement breakdown
    html += `
        <div class="card" style="margin-top: 20px;">
            <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700;">P&L Statement</h4>
            <div style="display: grid; gap: 8px; font-size: 14px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span>Gross Revenue (Guest Payments)</span>
                    <strong>${fmt(totals.grossRevenue)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: var(--text-secondary);">
                    <span>&nbsp;&nbsp;Less: OTA Service Fees</span>
                    <span>-${fmt(totals.otaFees)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--border); font-weight: 600;">
                    <span>Net Revenue</span>
                    <strong>${fmt(totals.netRevenue)}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: var(--text-secondary);">
                    <span>&nbsp;&nbsp;Less: Hostizzy Commission (Gross)</span>
                    <span>-${fmt(totals.hostizzyCommission)}</span>
                </div>
                ${managedExpenses > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #8b5cf6;">
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;Less: Managed Property Expenses (from commission)</span>
                    <span>-${fmt(managedExpenses)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #8b5cf6; font-weight: 600;">
                    <span>&nbsp;&nbsp;Hostizzy Net (Commission - Managed Exp.)</span>
                    <strong>${fmt(totals.hostizzyNet)}</strong>
                </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--border); font-weight: 600;">
                    <span>Owner Payout (Property Share)</span>
                    <strong>${fmt(totals.ownerPayout)}</strong>
                </div>
                ${nonManagedExpenses > 0 ? `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; color: var(--text-secondary);">
                    <span>&nbsp;&nbsp;Less: Non-Managed Property Expenses (from owner)</span>
                    <span>-${fmt(nonManagedExpenses)}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid var(--border); font-weight: 800; font-size: 16px; color: ${totalProfitColor};">
                    <span>Owner Net Profit / (Loss)</span>
                    <strong>${fmt(totals.netProfit)}</strong>
                </div>
            </div>
        </div>
    `;

    document.getElementById('pnlContent').innerHTML = html;
}

window.viewExpenseReceipt = async function(receiptPath) {
    if (!receiptPath) return;

    // If it's already a full URL, open directly
    if (receiptPath.startsWith('http')) {
        window.open(receiptPath, '_blank');
        return;
    }

    // Get signed URL from storage proxy
    try {
        const res = await fetch('/api/storage-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'signed-url',
                bucket: 'expense-receipts',
                path: receiptPath,
                expiresIn: 3600
            })
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        if (json.data?.signedUrl) {
            window.open(json.data.signedUrl, '_blank');
        }
    } catch (err) {
        console.error('Failed to load receipt:', err);
        showToast('Error', 'Failed to load receipt image', '❌');
    }
};

// ========== PENDING SIGNUPS (Admin Approval) ==========

async function loadPendingSignups() {
    try {
        const { data: pending, error } = await db.getPendingOwners();
        if (error) throw error;

        const tbody = document.getElementById('pendingSignupsTableBody');
        if (!pending || pending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--text-secondary);">No pending signups.</td></tr>';
            updatePendingBadge(0);
            return;
        }

        updatePendingBadge(pending.length);

        tbody.innerHTML = pending.map(owner => {
            const signupDate = owner.created_at ? new Date(owner.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
            return `
                <tr>
                    <td>${owner.name}</td>
                    <td>${owner.email}</td>
                    <td>${owner.phone || '-'}</td>
                    <td>${signupDate}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="approveOwnerSignup('${owner.id}')" style="margin-right: 4px;">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectOwnerSignup('${owner.id}', '${owner.email}')">Reject</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Load pending signups error:', error);
        showToast('Error', 'Failed to load pending signups', '❌');
    }
}

function updatePendingBadge(count) {
    const badge = document.getElementById('pendingSignupsBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }
}

async function approveOwnerSignup(ownerId) {
    if (!confirm('Approve this owner? They will be able to log in and manage properties.')) return;

    try {
        const { error } = await db.approveOwner(ownerId);
        if (error) throw error;
        showToast('Approved', 'Owner account activated successfully', '✅');
        await loadPendingSignups();
    } catch (error) {
        console.error('Approve owner error:', error);
        showToast('Error', 'Failed to approve owner', '❌');
    }
}

async function rejectOwnerSignup(ownerId, email) {
    if (!confirm('Reject this registration? The owner will not be able to log in.')) return;

    try {
        const { error } = await db.rejectOwner(ownerId);
        if (error) throw error;

        // Optionally delete Firebase Auth account
        try {
            await fetch('/api/auth-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete-user', email })
            });
        } catch (e) { /* best effort */ }

        showToast('Rejected', 'Owner registration rejected', '✅');
        await loadPendingSignups();
    } catch (error) {
        console.error('Reject owner error:', error);
        showToast('Error', 'Failed to reject owner', '❌');
    }
}

