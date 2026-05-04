document.addEventListener('DOMContentLoaded', async () => {
    'use strict';


    const signInForm = document.querySelector('form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.querySelector('button[type="submit"]');

    const API_BASE = window.__API_BASE__ || 'http://localhost:3000';

    const signUpLink = document.querySelector('.signup-note a');
    const rawRole = localStorage.getItem('loginRole') || localStorage.getItem('userRole');
    const userRole = _normalizeRole(rawRole);

    if (signUpLink) {
        signUpLink.href = (userRole === 'client') ? 'Client%20Onboarding%20step1.html' : 'LawFirmOnboardingStep1.html';
    }

    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const selectedRole = _normalizeRole(localStorage.getItem('loginRole') || localStorage.getItem('userRole'));
            const expectedRole = selectedRole || undefined;

            if (!email || !password) {
                _showToast('Please enter both email and password.', 'error');
                return;
            }

            loginBtn.classList.add('btn-loading');
            try {
                const user = await _postJSON(`${API_BASE}/users/login`, { email, password });

                const isFirmPortal = ['firmadmin', 'intern'].includes(expectedRole);
                const isFirmStaff = ['firmadmin', 'lawyer', 'intern'].includes(user.role.toLowerCase());

                if (isFirmPortal) {
                    if (!isFirmStaff) {
                        throw new Error('This login portal is only for law firm staff (Admin/Lawyer/Intern).');
                    }
                } else if (expectedRole === 'client' && user.role.toLowerCase() !== 'client') {
                    throw new Error('This login portal is only for clients.');
                }

                const frontendRoleMap = {
                    firmadmin: 'firmAdmin',
                    superadmin: 'superAdmin',
                };
                const normalizedRole = frontendRoleMap[user.role] || user.role || '';
                const normalizedUser = { ...user, role: normalizedRole };

                localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
                localStorage.setItem('userRole', normalizedUser.role);
                localStorage.removeItem('loginRole');

                _showToast('Welcome back, ' + (user.fullName || user.name || 'User') + '!');

                setTimeout(() => {
                    const redirect = _redirectForRole((normalizedUser.role || '').toLowerCase());
                    window.location.href = redirect;
                }, 800);
            } catch (error) {
                const msg = (error && error.message) ? error.message : 'Unable to sign in right now. Please check backend server.';
                _showToast(msg, 'error');
                console.error(error);
            } finally {
                loginBtn.classList.remove('btn-loading');
            }
        });
    }

    // Handle cancel button
    const cancelBtn = document.querySelector('.btn-ghost');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }

    function _showToast(msg, type = 'success') {
        const existing = document.querySelector('.lexflow-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'lexflow-toast' + (type === 'error' ? ' toast-error' : '');
        toast.textContent = msg;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* Helpers */
    function _normalizeRole(raw) {
        if (!raw) return undefined;
        const r = String(raw).toLowerCase();
        if (r === 'firmadmin') return 'firmadmin';
        if (r === 'superadmin') return 'superadmin';
        return r;
    }

    function _redirectForRole(roleLower) {
        const roleRedirects = {
            client: 'client-consultation-dashboard.html',
            firmadmin: 'firm-consultation-dashboard.html',
            lawyer: 'firm-consultation-dashboard.html',
            intern: 'firm-consultation-dashboard.html',
            superadmin: '../super admin/index.html',
        };
        return roleRedirects[roleLower] || 'SignIn.html';
    }

    async function _postJSON(url, body, opts = {}) {
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (res.ok) {
            try { return await res.json(); } catch (e) { return undefined; }
        }
        // try parse json error, fallback to text
        let errMsg = 'Request failed';
        try {
            const json = await res.json();
            if (json && json.message) errMsg = json.message;
            else errMsg = JSON.stringify(json);
        } catch (e) {
            try { errMsg = await res.text(); } catch (e2) { /* ignore */ }
        }
        throw new Error(errMsg || `HTTP ${res.status}`);
    }
});
