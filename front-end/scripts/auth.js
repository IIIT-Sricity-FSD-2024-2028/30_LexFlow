const AuthService = (() => {
  'use strict';

  function getSignInPath() {
    const pathname = (window.location && window.location.pathname) || '';
    if (pathname.includes('/super-admin/') || pathname.includes('/super admin/') || pathname.includes('/super%20admin/')) return 'super-admin-login.html';
    if (pathname.includes('/pages/')) return 'sign-in.html';
    return 'pages/sign-in.html';
  }

  function getDashboardPath() {
    const pathname = (window.location && window.location.pathname) || '';
    if (pathname.includes('/pages/')) return 'firm-consultation-dashboard.html';
    return 'pages/firm-consultation-dashboard.html';
  }

  return {
    getCurrentUser() {
      try {
        const raw = localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    async login(email, password, role) {
      // 1. Try Backend API first
      if (window.LexFlowAPI) {
        try {
          const user = await window.LexFlowAPI.auth.login(email, password, role);
          if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            return { success: true, user };
          }
        } catch (err) {
          console.warn('[AUTH] Backend login failed:', err.message);
          // If it's a 401/403, we should probably stop and show the error
          if (err.status === 401 || err.status === 403) {
            return { success: false, error: err.message };
          }
        }
      }

      // 2. Fallback to Local Storage (Legacy/Mock)
      const users = (window.StorageService ? StorageService.getAll('users') : []);
      const user = users.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (!user) {
        return { success: false, error: 'Invalid email or password.' };
      }

      const { password: _pw, ...safeUser } = user;
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
      return { success: true, user: safeUser };
    },

    logout() {
      localStorage.removeItem('currentUser');
      // Redirect to the correct login page for the current folder.
      window.location.href = getSignInPath();
    },

    requireAuth(allowedRoles) {
      const user = this.getCurrentUser();

      if (!user) {
        window.location.href = getSignInPath();
        return null;
      }

      if (allowedRoles && allowedRoles.length > 0) {
        const userRoleLower = (user.role || '').toLowerCase();
        const allowedLower = allowedRoles.map(r => r.toLowerCase());
        
        if (!allowedLower.includes(userRoleLower)) {
          window.location.href = getSignInPath();
          return null;
        }
      }

      return user;
    },

    /**
     * Like requireAuth but, when the user IS authenticated yet has an
     * insufficient role, redirects to `fallbackUrl` instead of sign-in.
     * This keeps the session alive for roles that simply shouldn't see a page.
     *
     * @param {string[]} allowedRoles  - Roles that may access the page.
     * @param {string}   fallbackUrl  - Where to send ineligible (but logged-in) users.
     */
    requireAuthWithFallback(allowedRoles, fallbackUrl) {
      const user = this.getCurrentUser();

      if (!user) {
        // Not logged in at all → go to sign-in
        window.location.href = getSignInPath();
        return null;
      }

      if (allowedRoles && allowedRoles.length > 0) {
        const userRoleLower = (user.role || '').toLowerCase();
        const allowedLower = allowedRoles.map(r => r.toLowerCase());

        if (!allowedLower.includes(userRoleLower)) {
          // Logged in but wrong role → redirect to fallback (e.g. dashboard)
          window.location.href = fallbackUrl || getDashboardPath();
          return null;
        }
      }

      return user;
    }
  };
})();
