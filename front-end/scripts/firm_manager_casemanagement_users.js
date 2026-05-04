(function() {
    'use strict';

    const API_BASE = 'http://127.0.0.1:3000';
    const ITEMS_PER_PAGE = 8;
    
    let allUsers = [];
    let filteredUsers = [];
    let currentPage = 1;
    let editingUserId = null;
    let formAccountStatus = 'active';
    let formAvailability = 'available';

    const ROLE_LABELS = {
        firmadmin: 'Firm Admin',
        lawyer: 'Lawyer',
        client: 'Client',
        intern: 'Intern',
        superadmin: 'Super Admin'
    };

    const ROLE_CLASSES = {
        firmadmin: 'users-badge users-badge--manager',
        lawyer: 'users-badge users-badge--lawyer',
        client: 'users-badge users-badge--client',
        intern: 'users-badge users-badge--lawyer',
        superadmin: 'users-badge users-badge--manager'
    };

    async function init() {
        const currentUser = AuthService.getCurrentUser();
        if (!currentUser || !currentUser.firmId) {
            console.error('No firm ID found for current user');
            return;
        }

        await fetchUsers();
        setupEventListeners();
    }

    async function fetchUsers() {
        const currentUser = AuthService.getCurrentUser();
        const role = localStorage.getItem('userRole') || 'firmadmin';
        
        try {
            const response = await fetch(`${API_BASE}/users/firm/${currentUser.firmId}`, {
                headers: { 'role': role }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Fetch failed with status ${response.status}:`, errorText);
                throw new Error('Failed to fetch users');
            }
            
            allUsers = await response.json();
            applyFilters();
        } catch (error) {
            console.error('Error fetching users:', error);
            _showToast('Failed to load users from server', 'error');
        }
    }

    function applyFilters() {
        const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
        const roleFilter = document.getElementById('roleFilterSelect').value;

        filteredUsers = allUsers.filter(user => {
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const matchesSearch = !searchTerm || 
                user.fullName.toLowerCase().includes(searchTerm) || 
                user.email.toLowerCase().includes(searchTerm);
            
            return matchesRole && matchesSearch;
        });

        currentPage = 1;
        renderPage();
        updateStats();
    }

    function updateStats() {
        const total = allUsers.length;
        const lawyers = allUsers.filter(u => u.role === 'lawyer' && u.accountStatus === 'active').length;
        const clients = allUsers.filter(u => u.role === 'client' && u.accountStatus === 'active').length;

        document.getElementById('statTotal').textContent = total.toString().padStart(3, '0');
        document.getElementById('statLawyers').textContent = lawyers.toString().padStart(3, '0');
        document.getElementById('statClients').textContent = clients.toString().padStart(3, '0');
    }

    function renderPage() {
        const tbody = document.getElementById('usersTableBody');
        const noResults = document.getElementById('usersNoResults');
        const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;

        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageUsers = filteredUsers.slice(start, start + ITEMS_PER_PAGE);

        if (pageUsers.length === 0) {
            tbody.innerHTML = '';
            noResults.style.display = 'block';
        } else {
            noResults.style.display = 'none';
            tbody.innerHTML = pageUsers.map(renderUserRow).join('');
            setupRowActions();
        }

        renderPagination(totalPages);
    }

    function renderUserRow(user) {
        const initials = user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const statusDot = user.availability === 'available' ? 'users-dot--ok' : 'users-dot--muted';
        const statusLabel = user.availability === 'available' ? 'Available' : 'Not available';
        const accountPill = user.accountStatus === 'active' ? 'users-status-pill--active' : 'users-status-pill--inactive';
        const accountLabel = user.accountStatus === 'active' ? 'Active' : 'Inactive';

        return `
            <tr data-id="${user.id}">
                <td>
                    <div class="users-cell-name">
                        <div class="users-avatar">${initials}</div>
                        <div>
                            <div class="users-name">${_escapeHtml(user.fullName)}</div>
                            <div class="users-id-sub">ID: ${user.id}</div>
                        </div>
                    </div>
                </td>
                <td>${_escapeHtml(user.email)}</td>
                <td><span class="${ROLE_CLASSES[user.role] || 'users-badge'}">${ROLE_LABELS[user.role] || user.role}</span></td>
                <td>
                    <div class="users-status-cell">
                        <span class="users-dot ${statusDot}"></span>
                        <span>${statusLabel}</span>
                    </div>
                    <div class="users-account-line">
                        <span class="users-status-pill ${accountPill}">${accountLabel}</span>
                    </div>
                </td>
                <td class="users-td-actions">
                    <button type="button" class="users-action-btn" data-action="edit" data-id="${user.id}">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                    <button type="button" class="users-action-btn users-action-btn--danger" data-action="delete" data-id="${user.id}">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }

    function renderPagination(totalPages) {
        const info = document.getElementById('usersPaginationInfo');
        const pagesContainer = document.getElementById('usersPaginationPages');
        
        const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
        const end = Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length);
        
        info.innerHTML = filteredUsers.length > 0 
            ? `Showing <strong>${start}</strong> to <strong>${end}</strong> of <strong>${filteredUsers.length}</strong> users`
            : 'Showing <strong>0</strong> users';

        let html = `<button class="pg-arrow" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">Previous</button>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        html += `<button class="pg-arrow" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next</button>`;
        
        pagesContainer.innerHTML = html;
        pagesContainer.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderPage();
            });
        });
    }

    function setupRowActions() {
        document.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                if (action === 'edit') openEditModal(id);
                if (action === 'delete') handleDeleteUser(id);
            });
        });
    }

    function openEditModal(id) {
        const user = allUsers.find(u => u.id === id);
        if (!user) return;

        editingUserId = id;
        document.getElementById('userFormId').value = user.id;
        document.getElementById('userFormName').value = user.fullName;
        document.getElementById('userFormEmail').value = user.email;
        document.getElementById('userFormPhone').value = user.phone || '';
        document.getElementById('userFormBadgeRole').value = user.role;
        
        // Only show "Firm Admin" in dropdown if editing an actual Firm Admin
        const adminOption = document.getElementById('roleOptionAdmin');
        if (adminOption) {
            adminOption.hidden = (user.role !== 'firmadmin');
        }
        
        formAccountStatus = user.accountStatus || 'active';
        formAvailability = user.availability || 'available';
        
        _updateToggles();
        
        document.getElementById('userModalTitle').textContent = 'Edit User';
        document.getElementById('userFormSubmit').textContent = 'Save Changes';
        document.getElementById('userModal').classList.add('active');
    }

    function openCreateModal() {
        editingUserId = null;
        document.getElementById('userForm').reset();
        document.getElementById('userFormId').value = '';
        
        // Never allow creating new "Firm Admin" accounts from here
        const adminOption = document.getElementById('roleOptionAdmin');
        if (adminOption) {
            adminOption.hidden = true;
        }
        
        formAccountStatus = 'active';
        formAvailability = 'available';
        _updateToggles();
        
        document.getElementById('userModalTitle').textContent = 'Add New User';
        document.getElementById('userFormSubmit').textContent = 'Create User';
        document.getElementById('userModal').classList.add('active');
    }

    async function handleFormSubmit() {
        const submitBtn = document.getElementById('userFormSubmit');
        const originalText = submitBtn.textContent;
        
        const fullName = document.getElementById('userFormName').value.trim();
        const email = document.getElementById('userFormEmail').value.trim();
        const phone = document.getElementById('userFormPhone').value.trim();
        const role = document.getElementById('userFormBadgeRole').value;
        const currentUser = AuthService.getCurrentUser();

        if (!fullName || !email || !role) {
            _showToast('Name, Email, and Role are required', 'error');
            return;
        }

        const payload = {
            fullName,
            email,
            phone,
            role,
            accountStatus: formAccountStatus,
            availability: formAvailability,
            firmId: currentUser.firmId
        };

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = editingUserId ? 'Saving...' : 'Creating...';

            let response;
            const authRole = localStorage.getItem('userRole') || 'firmadmin';

            if (editingUserId) {
                response = await fetch(`${API_BASE}/users/${editingUserId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'role': authRole
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                payload.password = 'changeme123';
                response = await fetch(`${API_BASE}/users`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'role': authRole
                    },
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to save user');
            }

            _showToast(editingUserId ? 'User updated successfully' : 'User created successfully');
            closeModal();
            await fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            const msg = error.message || 'Something went wrong';
            _showToast(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async function handleDeleteUser(id) {
        const user = allUsers.find(u => u.id === id);
        if (!confirm(`Are you sure you want to remove ${user.fullName}?`)) return;

        const authRole = localStorage.getItem('userRole') || 'firmadmin';

        try {
            const response = await fetch(`${API_BASE}/users/${id}`, {
                method: 'DELETE',
                headers: { 'role': authRole }
            });

            if (!response.ok) throw new Error('Failed to delete user');

            _showToast('User removed successfully');
            await fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            _showToast('Failed to delete user', 'error');
        }
    }

    function closeModal() {
        document.getElementById('userModal').classList.remove('active');
        editingUserId = null;
    }

    function _updateToggles() {
        document.querySelectorAll('[data-field="accountStatus"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === formAccountStatus);
        });
        document.querySelectorAll('[data-field="availability"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === formAvailability);
        });
    }

    function setupEventListeners() {
        document.getElementById('userSearchInput').addEventListener('input', applyFilters);
        document.getElementById('roleFilterSelect').addEventListener('change', applyFilters);
        document.getElementById('addUserBtn').addEventListener('click', openCreateModal);
        document.getElementById('userModalClose').addEventListener('click', closeModal);
        document.getElementById('userFormCancel').addEventListener('click', closeModal);
        document.getElementById('userFormSubmit').addEventListener('click', handleFormSubmit);

        document.querySelectorAll('.users-toggle-btn[data-field]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.field === 'accountStatus') formAccountStatus = btn.dataset.value;
                if (btn.dataset.field === 'availability') formAvailability = btn.dataset.value;
                _updateToggles();
            });
        });

        // Close modal on backdrop click
        document.getElementById('userModal').addEventListener('click', (e) => {
            if (e.target.id === 'userModal') closeModal();
        });
    }

    function _showToast(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `lexflow-toast ${type === 'error' ? 'toast-error' : ''}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[m];
        });
    }

    // Export to JSON (frontend only)
    window.exportUsersJson = function() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allUsers, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "firm_users.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    document.getElementById('exportUsersBtn').onclick = window.exportUsersJson;

    init();
})();
