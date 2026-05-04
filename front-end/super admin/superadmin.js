// LexFlow Super Admin - Unified Interactions
// Refactored to handle Async Backend Data (LexFlowAPI)

const SA_Storage = window.LexFlowSuperAdminStorage;

async function initDB() {
    if (!SA_Storage) {
        return {
            firms: [], lawyers: [], users: [], consults: [], invoices: [],
            settings: { commission_rate: 10, support_email: 'support@lexflow.legal', maintenance: false, disable_signup: false }
        };
    }

    // Fetch all data in parallel from the backend
    const [firms, lawyers, users, consults] = await Promise.all([
        SA_Storage.getFirms(),
        SA_Storage.getLawyers(),
        SA_Storage.getUsers(),
        SA_Storage.getConsultations()
    ]);

    return {
        firms,
        lawyers,
        users,
        consults,
        settings: SA_Storage.getSettings()
    };
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ── Billing API helpers (superadmin role) ────────────────────────────────────
function getSuperAdminBillingHeaders() {
    return { role: 'superadmin', 'x-user-id': '' };
}

async function fetchAllInvoices() {
    const res = await fetch('http://localhost:3000/billing/invoices', {
        headers: getSuperAdminBillingHeaders()
    });
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
}

async function patchInvoiceStatus(id, status) {
    const res = await fetch(`http://localhost:3000/billing/invoices/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...getSuperAdminBillingHeaders()
        },
        body: JSON.stringify({ status })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Update failed');
    return json.data;
}

// ── Currency formatter ───────────────────────────────────────────────────────
function fmtINR(val) {
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!SA_Storage) {
        console.error('SuperAdminStorage not available');
        return;
    }

    await SA_Storage.ensureStorage();

    const path = window.location.pathname;

    const masterToggle = document.getElementById('action-toggle');
    if (masterToggle) {
        masterToggle.addEventListener('change', (e) => {
            document.querySelectorAll('.action-select').forEach(check => check.checked = e.target.checked);
            updateSelectionCount();
        });
    }

    // Route to appropriate initializer
    if (path.includes('index.html')) {
        const db = await initDB();
        initDashboard(db);
    }
    else if (path.includes('invoice-list.html')) await initInvoiceList();
    else if (path.includes('invoice-edit.html')) initInvoiceEdit();
    else {
        const db = await initDB();
        if (path.includes('firm-list.html')) initFirmList(db);
        else if (path.includes('firm-edit.html')) await initFirmEdit(db);
        else if (path.includes('lawyer-verification.html')) initLawyerList(db);
        else if (path.includes('lawyer-edit.html')) await initLawyerEdit(db);
        else if (path.includes('lawyer-list.html')) initLawyerList(db);
        else if (path.includes('user-list.html')) initUserList(db);
        else if (path.includes('user-edit.html')) await initUserEdit(db);
        else if (path.includes('platform-settings.html')) initSettings(db);
        else if (path.includes('consultation-list.html')) initConsultationList(db);
        else if (path.includes('consultation-edit.html')) await initConsultationEdit(db);
    }
});

// ── Selection counter ────────────────────────────────────────────────────────
function updateSelectionCount() {
    const count = document.querySelectorAll('.action-select:checked').length;
    const el = document.getElementById('selectionCount');
    if (el) el.textContent = `${count} selected`;
}

function initDashboard(db) {
    const kpiValues = document.querySelectorAll('.kpi-value');
    if (kpiValues.length >= 4) {
        kpiValues[0].textContent = db.firms.length;
        kpiValues[1].textContent = db.lawyers.length;
        kpiValues[2].textContent = db.users.length;
        kpiValues[3].textContent = db.lawyers.filter(l => (l.status || 'approved') === 'pending').length;
    }

    const pendingLawyers = db.lawyers.filter(l => (l.status || 'approved') === 'pending').length;
    const pendingChip = document.getElementById('pending-chip');
    if (pendingChip) {
        pendingChip.textContent = `${pendingLawyers} Pending`;
        if (pendingLawyers === 0) pendingChip.style.display = 'none';
    }
}

function initFirmList(db) {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    db.firms.forEach(firm => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="action-checkbox"><input type="checkbox" name="_selected_action" value="${firm.id}" class="action-select"></td>
            <th class="field-title"><a href="firm-edit.html?id=${firm.id}">${firm.name}</a></th>
        `;
        tbody.appendChild(tr);
    });

    const paginator = document.querySelector('.paginator');
    if (paginator) paginator.textContent = `${db.firms.length} law firms`;

    document.getElementById('run-action-btn')?.addEventListener('click', async () => {
        const action = document.getElementById('action-select-dropdown')?.value;
        if (action === 'delete_selected') {
            const selectedIds = Array.from(document.querySelectorAll('.action-select:checked')).map(cb => cb.value);
            if (!selectedIds.length) return alert('Select items first.');
            if (confirm(`Delete ${selectedIds.length} firms?`)) {
                for (const id of selectedIds) await SA_Storage.deleteFirm(id);
                window.location.reload();
            }
        }
    });
}

async function initFirmEdit(db) {
    const firmId = getQueryParam('id');
    const form = document.getElementById('firm_form');
    const isNew = !firmId;
    if (!form) return;

    if (!isNew) {
        const firm = await SA_Storage.getFirmById(firmId);
        if (firm) {
            document.getElementById('id_name').value = firm.name || '';
            document.getElementById('id_admin_user').value = firm.admin || '';
            document.getElementById('id_description').value = firm.description || '';
            document.getElementById('id_reg_no').value = firm.reg_no || '';
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const action = e.submitter ? e.submitter.name : '_save';
        const firmData = {
            name: document.getElementById('id_name')?.value || '',
            email: document.getElementById('id_admin_user')?.value || '',
            description: document.getElementById('id_description')?.value || '',
            reg_no: document.getElementById('id_reg_no')?.value || ''
        };
        if (isNew) await SA_Storage.addFirm(firmData);
        else await SA_Storage.updateFirm(firmId, firmData);
        alert('Firm saved successfully.');
        if (action === '_save') window.location.href = 'firm-list.html';
        else window.location.reload();
    });

    document.querySelector('.deletelink')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Delete this firm?')) {
            await SA_Storage.deleteFirm(firmId);
            window.location.href = 'firm-list.html';
        }
    });
}

function initUserList(db) {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    db.users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="action-checkbox"><input type="checkbox" name="_selected_action" value="${u.id}" class="action-select"></td>
            <th class="field-title"><a href="user-edit.html?id=${u.id}">${u.name || u.email || u.id}</a></th>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('run-action-btn')?.addEventListener('click', async () => {
        const action = document.getElementById('action-select-dropdown')?.value;
        if (action === 'delete_selected') {
            const selectedIds = Array.from(document.querySelectorAll('.action-select:checked')).map(cb => cb.value);
            if (!selectedIds.length) return alert('Select users first.');
            if (confirm(`Delete ${selectedIds.length} users?`)) {
                for (const id of selectedIds) await SA_Storage.deleteUser(id);
                window.location.reload();
            }
        }
    });
}

async function initUserEdit(db) {
    const userId = getQueryParam('id');
    const form = document.getElementById('firm_form');
    if (!form) return;

    const user = await SA_Storage.getUserById(userId);
    if (user) {
        document.getElementById('id_name').value = user.name || '';
        document.getElementById('id_description').value = user.role || '';
        document.getElementById('id_reg_no').value = user.firmId || '';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
            fullName: document.getElementById('id_name').value,
            role: document.getElementById('id_description').value,
            firmId: document.getElementById('id_reg_no').value
        };
        await window.LexFlowAPI.users.update(userId, updates, 'superadmin');
        alert('User updated successfully.');
        window.location.href = 'user-list.html';
    });
}

function initLawyerList(db) {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;

    tbody.innerHTML = db.lawyers.map(l => `
        <tr>
            <td class="action-checkbox"><input type="checkbox" value="${l.id}" class="action-select"></td>
            <th class="field-title"><a href="lawyer-edit.html?id=${l.id}">${l.name}</a></th>
            <td>${l.status}</td>
        </tr>
    `).join('');
}

async function initLawyerEdit(db) {
    const lawyerId = getQueryParam('id');
    const form = document.getElementById('firm_form');
    if (!form || !lawyerId) return;

    const lawyer = await SA_Storage.getLawyerById(lawyerId);
    if (lawyer) {
        document.getElementById('id_name').value = lawyer.name || '';
        document.getElementById('id_description').value = lawyer.status || '';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await window.LexFlowAPI.users.update(lawyerId, {
            accountStatus: document.getElementById('id_description').value
        }, 'superadmin');
        alert('Lawyer status updated.');
        window.location.href = 'lawyer-list.html';
    });
}

// ── INVOICE LIST — real API data ─────────────────────────────────────────────
async function initInvoiceList() {
    const tbody = document.getElementById('invoiceTableBody');
    const countEl = document.getElementById('invoiceCount');
    const commRate = (SA_Storage.getSettings().commission_rate || 10) / 100;

    if (!tbody) return;

    let invoices = [];

    try {
        invoices = await fetchAllInvoices();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;">Failed to load invoices: ${err.message}</td></tr>`;
        return;
    }

    function statusColor(s) {
        if (s === 'Paid') return '#10b981';
        if (s === 'Overdue') return '#ef4444';
        return '#f59e0b';
    }

    function renderRows() {
        tbody.innerHTML = '';

        if (!invoices.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">No invoices found.</td></tr>';
            if (countEl) countEl.textContent = '0 invoices';
            return;
        }

        invoices.forEach((inv, idx) => {
            const fee = inv.amount * commRate;
            const payout = inv.amount - fee;
            const tr = document.createElement('tr');
            tr.className = idx % 2 === 0 ? 'row1' : 'row2';
            tr.innerHTML = `
                <td class="action-checkbox">
                  <input type="checkbox" name="_selected_action" value="${inv.id}" class="action-select">
                </td>
                <th class="field-title">
                  <a href="invoice-edit.html?id=${inv.id}">${inv.id}</a>
                </th>
                <td>${inv.clientName || '-'}</td>
                <td>${inv.caseName || '-'}</td>
                <td style="font-weight:600;">${fmtINR(inv.amount)}</td>
                <td style="color:#10b981; font-weight:600;">${fmtINR(fee)}</td>
                <td>${fmtINR(payout)}</td>
                <td><span style="color:${statusColor(inv.status)}; font-weight:600;">${inv.status}</span></td>
            `;
            tbody.appendChild(tr);
        });

        if (countEl) countEl.textContent = `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`;

        // Re-attach checkbox listeners after re-render
        document.querySelectorAll('.action-select').forEach(cb => {
            cb.addEventListener('change', updateSelectionCount);
        });
    }

    renderRows();

    // Master toggle
    document.getElementById('action-toggle')?.addEventListener('change', (e) => {
        document.querySelectorAll('.action-select').forEach(cb => cb.checked = e.target.checked);
        updateSelectionCount();
    });

    // Action button — Process selected invoices
    document.getElementById('run-action-btn')?.addEventListener('click', async () => {
        const action = document.getElementById('action-select-dropdown')?.value;
        const selectedIds = Array.from(document.querySelectorAll('.action-select:checked')).map(cb => cb.value);

        if (!action) return alert('Select an action first.');
        if (!selectedIds.length) return alert('Select at least one invoice.');

        const newStatus = action === 'payout_selected' ? 'Paid' : 'Overdue';
        const label = action === 'payout_selected' ? 'mark as Paid' : 'mark as Overdue';

        if (!confirm(`${label} for ${selectedIds.length} invoice(s)?`)) return;

        const btn = document.getElementById('run-action-btn');
        btn.disabled = true;
        btn.textContent = 'Processing…';

        const errors = [];
        for (const id of selectedIds) {
            try {
                const updated = await patchInvoiceStatus(id, newStatus);
                // Update local array so re-render reflects changes immediately
                const idx = invoices.findIndex(i => i.id === id);
                if (idx !== -1 && updated) invoices[idx] = updated;
            } catch (err) {
                errors.push(`${id}: ${err.message}`);
            }
        }

        btn.disabled = false;
        btn.textContent = 'Go';

        if (errors.length) {
            alert('Some updates failed:\n' + errors.join('\n'));
        } else {
            alert(`Done — ${selectedIds.length} invoice(s) updated to ${newStatus}.`);
        }

        renderRows();
    });
}

// ── INVOICE EDIT ─────────────────────────────────────────────────────────────
async function initInvoiceEdit() {
    const invId = getQueryParam('id');
    const form = document.getElementById('firm_form');
    const loadingEl = document.getElementById('inv-loading');
    const errorEl = document.getElementById('inv-error');
    const commRate = (SA_Storage.getSettings().commission_rate || 10) / 100;

    if (!invId) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'No invoice ID provided.'; }
        return;
    }

    function fmtINR(val) {
        return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }

    try {
        const res = await fetch(`http://localhost:3000/billing/invoices/${invId}`, {
            headers: getSuperAdminBillingHeaders()
        });
        const json = await res.json();
        const inv = json.data;

        if (!inv) throw new Error('Invoice not found');

        // Update page title and breadcrumb
        document.getElementById('page-title').textContent = `Change invoice: ${inv.id}`;
        document.getElementById('breadcrumb-id').textContent = inv.id;

        // Populate read-only fields
        document.getElementById('id_invoice_no').value = inv.id;
        document.getElementById('id_client').value = `${inv.clientName || '-'} (${inv.clientEmail || '-'})`;
        document.getElementById('id_case').value = inv.caseName || '-';
        document.getElementById('id_advocate').value = inv.advocateName || 'Awaiting Assignment';
        document.getElementById('id_due_date').value = inv.dueDate || '-';
        document.getElementById('id_amount').value = fmtINR(inv.amount);
        document.getElementById('id_fee').value = fmtINR(inv.amount * commRate);
        document.getElementById('id_payout').value = fmtINR(inv.amount - inv.amount * commRate);

        // Set status dropdown to current value
        const statusSelect = document.getElementById('id_status');
        if (statusSelect) statusSelect.value = inv.status || 'Pending';

        // Show form, hide loader
        if (loadingEl) loadingEl.style.display = 'none';
        if (form) form.style.display = 'block';

        // ── Save status change ──────────────────────────────────────────────
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newStatus = document.getElementById('id_status').value;
            try {
                await patchInvoiceStatus(invId, newStatus);
                alert(`Invoice ${invId} updated to "${newStatus}".`);
                window.location.href = 'invoice-list.html';
            } catch (err) {
                alert('Save failed: ' + err.message);
            }
        });

        // ── Mark as Overdue button ──────────────────────────────────────────
        document.getElementById('btn-issue-refund')?.addEventListener('click', async () => {
            if (!confirm(`Mark invoice ${invId} as Overdue?`)) return;
            try {
                await patchInvoiceStatus(invId, 'Overdue');
                alert('Invoice marked as Overdue.');
                window.location.href = 'invoice-list.html';
            } catch (err) {
                alert('Failed: ' + err.message);
            }
        });

    } catch (err) {
        console.error('Could not load invoice:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = `Failed to load invoice: ${err.message}`;
        }
    }
}

function initSettings(db) {
    const form = document.getElementById('firm_form');
    if (!form) return;
    document.getElementById('id_comm_rate').value = db.settings.commission_rate;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        db.settings.commission_rate = document.getElementById('id_comm_rate').value;
        SA_Storage.saveSettings(db.settings);
        alert('Settings saved.');
    });
}

function initConsultationList(db) {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;
    tbody.innerHTML = db.consults.map(c => `
        <tr>
            <td class="action-checkbox"><input type="checkbox" value="${c.id}" class="action-select"></td>
            <th class="field-title"><a href="consultation-edit.html?id=${c.id}">${c.id}</a></th>
            <td>${c.client}</td>
            <td>${c.firmId}</td>
            <td>${c.status}</td>
        </tr>
    `).join('');
}

async function initConsultationEdit(db) {
    const consultId = getQueryParam('id');
    const form = document.getElementById('firm_form');
    if (!form || !consultId) return;

    const consult = db.consults.find(c => String(c.id) === String(consultId));
    if (consult) {
        document.getElementById('id_name').value = consult.client || '';
        document.getElementById('id_description').value = consult.status || '';
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Consultation updates are currently read-only in this version.');
        window.location.href = 'consultation-list.html';
    });
}