// LexFlow Super Admin - Unified Interactions
// Refactored to handle Async Backend Data (LexFlowAPI)

const SA_Storage = window.LexFlowSuperAdminStorage;
const SA_INVOICE_KEY = 'lexflow_invoices'; // shared with billing pages

async function initDB() {
    if (!SA_Storage) {
        return {
            firms: [], lawyers: [], users: [], consults: [], invoices: [],
            settings: { commission_rate: 10, support_email: 'support@lexflow.legal', maintenance: false, disable_signup: false }
        };
    }

    const invoices = JSON.parse(localStorage.getItem(SA_INVOICE_KEY) || '[]');
    
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
        invoices,
        settings: SA_Storage.getSettings()
    };
}

async function saveDB(db) {
    // Note: SA_Storage methods are now async for writes as well
    // We don't do bulk saves anymore, but we still update settings locally
    SA_Storage.saveSettings(db.settings);
    localStorage.setItem(SA_INVOICE_KEY, JSON.stringify(db.invoices));
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!SA_Storage) {
        console.error('SuperAdminStorage not available');
        return;
    }

    await SA_Storage.ensureStorage();

    const db = await initDB();
    const path = window.location.pathname;

    const masterToggle = document.getElementById('action-toggle');
    if (masterToggle) {
        masterToggle.addEventListener('change', (e) => {
            document.querySelectorAll('.action-select').forEach(check => check.checked = e.target.checked);
        });
    }

    // Route to appropriate initializer
    if (path.includes('index.html')) initDashboard(db);
    else if (path.includes('firm-list.html')) initFirmList(db);
    else if (path.includes('firm-edit.html')) await initFirmEdit(db);
    else if (path.includes('invoice-list.html')) initInvoiceList(db);
    else if (path.includes('invoice-edit.html')) initInvoiceEdit(db);
    else if (path.includes('lawyer-verification.html')) initLawyerList(db);
    else if (path.includes('lawyer-edit.html')) await initLawyerEdit(db);
    else if (path.includes('lawyer-list.html')) initLawyerList(db);
    else if (path.includes('user-list.html')) initUserList(db);
    else if (path.includes('user-edit.html')) await initUserEdit(db);
    else if (path.includes('platform-settings.html')) initSettings(db);
    else if (path.includes('consultation-list.html')) initConsultationList(db);
    else if (path.includes('consultation-edit.html')) await initConsultationEdit(db);
});

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

    function render() {
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
    }

    render();

    document.getElementById('run-action-btn')?.addEventListener('click', async () => {
        const action = document.getElementById('action-select-dropdown')?.value;
        if (action === 'delete_selected') {
            const selectedIds = Array.from(document.querySelectorAll('.action-select:checked')).map(cb => cb.value);
            if (selectedIds.length === 0) return alert('Select items first.');
            if (confirm(`Are you sure you want to delete ${selectedIds.length} firms?`)) {
                for (const id of selectedIds) {
                    await SA_Storage.deleteFirm(id);
                }
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

        alert('Firm saved to backend successfully.');
        if (action === '_save') window.location.href = 'firm-list.html';
        else window.location.reload();
    });

    document.querySelector('.deletelink')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to delete this firm?')) {
            await SA_Storage.deleteFirm(firmId);
            window.location.href = 'firm-list.html';
        }
    });
}

function initUserList(db) {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;

    function render() {
        tbody.innerHTML = '';
        db.users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="action-checkbox"><input type="checkbox" name="_selected_action" value="${u.id}" class="action-select"></td>
                <th class="field-title"><a href="user-edit.html?id=${u.id}">${u.name || u.email || u.id}</a></th>
            `;
            tbody.appendChild(tr);
        });
    }

    render();

    document.getElementById('run-action-btn')?.addEventListener('click', async () => {
        const action = document.getElementById('action-select-dropdown')?.value;
        if (action === 'delete_selected') {
            const selectedIds = Array.from(document.querySelectorAll('.action-select:checked')).map(cb => cb.value);
            if (selectedIds.length === 0) return alert('Select users first.');
            if (confirm(`Are you sure you want to delete ${selectedIds.length} users?`)) {
                for (const id of selectedIds) {
                    await SA_Storage.deleteUser(id);
                }
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

function initInvoiceList(db) {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;
    tbody.innerHTML = db.invoices.map(inv => `
        <tr>
            <td class="action-checkbox"><input type="checkbox" value="${inv.id}" class="action-select"></td>
            <th class="field-title"><a href="invoice-edit.html?id=${inv.id}">${inv.id}</a></th>
            <td>${inv.firmName}</td>
            <td>$${inv.amount.toFixed(2)}</td>
            <td>${inv.status}</td>
        </tr>
    `).join('');
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

    // Backend doesn't have a specific GET /consultations/:id for superadmin yet, 
    // but we can find it in the list
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

function initInvoiceEdit(db) {
    const invId = getQueryParam('id');
    const form = document.getElementById('firm_form');
    if (!form || !invId) return;

    const inv = db.invoices.find(i => String(i.id) === String(invId));
    if (inv) {
        document.getElementById('id_name').value = inv.firmName || '';
        document.getElementById('id_description').value = inv.status || '';
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Invoice data is currently local-only.');
        window.location.href = 'invoice-list.html';
    });
}
