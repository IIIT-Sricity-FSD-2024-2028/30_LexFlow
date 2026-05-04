// ==========================================
// LexFlow Super Admin - Centralized Storage
// ==========================================
// Pattern: Unified data access for super admin
// Now strictly using NestJS Backend (LexFlowAPI)

window.LexFlowSuperAdminStorage = (() => {
    
    // Internal helper to get current role for API headers
    function _getRole() {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return (user.role || 'superAdmin').toLowerCase();
    }

    async function ensureStorage() {
        // No-op for localStorage sync, we pull fresh every time now
        console.log('✓ Super admin storage connected to NestJS backend');
        return true;
    }

    // --- Firms ---
    const getFirms = async () => {
        try {
            const firms = await window.LexFlowAPI.users.getAllFirms(_getRole());
            return (firms || []).map((f, idx) => ({
                ...f,
                id: String(f.id),
                name: f.name || f.fullName || `Law Firm ${idx + 1}`,
                admin: f.admin || f.email || '',
                reg_no: f.reg_no || ''
            }));
        } catch (err) {
            console.error('Failed to fetch firms:', err);
            return [];
        }
    };

    const getFirmById = async (firmId) => {
        try {
            // Note: Currently backend doesn't have a direct getFirmById for superadmin 
            // that returns the firm entity, but we can find it in the list or use users.getById
            const firms = await getFirms();
            return firms.find(f => String(f.id) === String(firmId));
        } catch (err) {
            return null;
        }
    };

    const saveFirms = async (firms) => {
        // This is a bulk save, usually not supported by backend APIs
        console.warn('saveFirms (bulk) is deprecated. Use updateFirm for individual updates.');
    };

    const addFirm = async (firm) => {
        // Map to user creation with role 'firm'
        try {
            return await window.LexFlowAPI.users.create({
                fullName: firm.name,
                email: firm.email || `firm-${Date.now()}@lexflow.test`,
                role: 'firm',
                password: 'password123'
            }, _getRole());
        } catch (err) {
            alert('Failed to add firm: ' + err.message);
        }
    };

    const updateFirm = async (firmId, updates) => {
        try {
            return await window.LexFlowAPI.users.update(firmId, {
                fullName: updates.name,
                email: updates.email
            }, _getRole());
        } catch (err) {
            alert('Failed to update firm: ' + err.message);
        }
    };

    const deleteFirm = async (firmId) => {
        try {
            await window.LexFlowAPI.users.remove(firmId, _getRole());
            return true;
        } catch (err) {
            alert('Failed to delete firm: ' + err.message);
        }
    };

    // --- Lawyers ---
    const getLawyers = async () => {
        try {
            const lawyers = await window.LexFlowAPI.users.getLawyers(null, _getRole());
            return (lawyers || []).map((l, idx) => ({
                ...l,
                id: String(l.id),
                name: l.fullName || l.name || `Lawyer ${idx + 1}`,
                status: l.accountStatus || 'approved'
            }));
        } catch (err) {
            console.error('Failed to fetch lawyers:', err);
            return [];
        }
    };

    const getLawyerById = async (lawyerId) => {
        try {
            const user = await window.LexFlowAPI.users.getById(lawyerId, _getRole());
            return {
                ...user,
                id: String(user.id),
                name: user.fullName || user.name,
                status: user.accountStatus || 'approved'
            };
        } catch (err) {
            return null;
        }
    };

    const saveLawyers = async (lawyers) => {
        console.warn('saveLawyers (bulk) is deprecated.');
    };

    // --- Users ---
    const getUsers = async () => {
        try {
            const users = await window.LexFlowAPI.users.getAll({}, _getRole());
            return (users || []).map((u, idx) => ({
                ...u,
                id: String(u.id),
                name: u.fullName || u.name || u.email || `User ${idx + 1}`
            }));
        } catch (err) {
            console.error('Failed to fetch users:', err);
            return [];
        }
    };

    const getUserById = async (userId) => {
        try {
            const user = await window.LexFlowAPI.users.getById(userId, _getRole());
            return {
                ...user,
                id: String(user.id),
                name: user.fullName || user.name
            };
        } catch (err) {
            return null;
        }
    };

    const saveUsers = async (users) => {
        console.warn('saveUsers (bulk) is deprecated.');
    };

    // --- Consultations ---
    const getConsultations = async () => {
        try {
            const consults = await window.LexFlowAPI.consultations.getWorkflowBookings(_getRole());
            return (consults || []).map((c, idx) => ({
                ...c,
                id: String(c.id),
                client: c.clientName || 'Unknown Client',
                firmId: c.firmName || 'N/A',
                date: c.date || c.createdAt || 'N/A',
                status: c.status || 'pending'
            }));
        } catch (err) {
            return [];
        }
    };

    // --- Settings ---
    const getSettings = () => {
        // Settings remain local for now as backend doesn't have a settings table
        const defaults = {
            commission_rate: 10,
            support_email: 'support@lexflow.legal',
            maintenance: false,
            disable_signup: false
        };
        return JSON.parse(localStorage.getItem('lexflow_sa_settings') || JSON.stringify(defaults));
    };

    const saveSettings = (settings) => {
        localStorage.setItem('lexflow_sa_settings', JSON.stringify(settings));
    };

    // --- Public API ---
    return {
        ensureStorage,
        getFirms, getFirmById, addFirm, updateFirm, deleteFirm, saveFirms,
        getLawyers, getLawyerById, saveLawyers,
        getUsers, getUserById, saveUsers,
        getConsultations,
        getSettings, saveSettings
    };
})();
