document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    // Seed data if not already done
    await StorageService.seed('../data/initialData.json');

    const signInForm = document.querySelector('form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.querySelector('button[type="submit"]');


    const signUpLink = document.querySelector('.signup-note a');
    const userRole = localStorage.getItem('loginRole') || localStorage.getItem('userRole');

    if (signUpLink) {
        if (userRole === 'client') {
            signUpLink.href = 'Client%20Onboarding%20step1.html';
        } else {
            signUpLink.href = 'LawFirmOnboardingStep1.html';
        }
    }
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const selectedRole = localStorage.getItem('loginRole') || localStorage.getItem('userRole');
            const roleMap = {
                firmAdmin: 'firmadmin',
                firmadmin: 'firmadmin',
                superAdmin: 'superadmin',
                superadmin: 'superadmin',
            };
            const expectedRole = roleMap[selectedRole] || selectedRole || undefined;

            if (!email || !password) {
                _showToast('Please enter both email and password.', 'error');
                return;
            }

            // Show loading state
            loginBtn.classList.add('btn-loading');

            try {
                const res = await fetch('http://localhost:3000/users/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password, role: expectedRole })
                });

                if (!res.ok) {
                    const err = await res.text();
                    loginBtn.classList.remove('btn-loading');
                    if (err && err.toLowerCase().includes('role')) {
                        _showToast('Please sign in with an account for the selected role.', 'error');
                    } else {
                        _showToast(err || 'Invalid email or password.', 'error');
                    }
                    return;
                }

                const user = await res.json();
                const frontendRoleMap = {
                    firmadmin: 'firmAdmin',
                    superadmin: 'superAdmin',
                };
                const roleKey = (frontendRoleMap[user.role] || user.role || '').toString().toLowerCase();
                const normalizedUser = {
                    ...user,
                    role: frontendRoleMap[user.role] || user.role,
                };

                localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
                localStorage.setItem('userRole', normalizedUser.role);
                localStorage.removeItem('loginRole');

                _showToast('Welcome back, ' + (user.fullName || user.name || 'User') + '!');

                setTimeout(() => {
                    const roleRedirects = {
                        client: 'client-consultation-dashboard.html',
                        firmadmin: 'firm-consultation-dashboard.html',
                        lawyer: 'firm-consultation-dashboard.html',
                        intern: 'firm-consultation-dashboard.html',
                        superadmin: '../super admin/index.html',
                    };

                    const redirectPath = roleRedirects[roleKey] || 'SignIn.html';
                    window.location.href = redirectPath;
                }, 800);
            } catch (error) {
                loginBtn.classList.remove('btn-loading');
                _showToast('Unable to sign in right now. Please check backend server.', 'error');
                console.error(error);
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
});
