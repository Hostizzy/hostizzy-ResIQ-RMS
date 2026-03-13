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
        await db.deleteTeamMember(id);
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
                const key = `${d.getFullYear()}-${d.getMonth()}`;
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
    html += '<th>Date</th><th>Property</th><th>Category</th><th>Amount</th><th>Description</th><th>Entered By</th><th>Actions</th>';
    html += '</tr></thead><tbody>';

    expenses.forEach(e => {
        const date = new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const propName = window._expenseProperties?.[e.property_id] || 'Unknown';

        html += `<tr>`;
        html += `<td>${date}</td>`;
        html += `<td>${propName}</td>`;
        html += `<td><span style="background: ${categoryColors[e.category] || '#f1f5f9'}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;">${categoryLabels[e.category] || e.category}</span></td>`;
        html += `<td><strong>₹${parseFloat(e.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></td>`;
        html += `<td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${e.description || '-'}</td>`;
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
                <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
                    <button onclick="document.getElementById('adminExpenseModal').remove()" style="padding:10px 20px;border:1px solid var(--border);background:var(--surface);border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                    <button onclick="saveAdminExpense('${expenseId || ''}')" style="padding:10px 20px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Save Expense</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
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

        // Calculate settlement month
        const d = new Date(expenseDate);
        const settlementMonth = `${d.getFullYear()}-${d.getMonth()}`;

        const expense = {
            property_id: propertyId,
            amount: amount,
            category: category,
            expense_date: expenseDate,
            description: description || null,
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

