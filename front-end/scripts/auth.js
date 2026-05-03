const AuthService = (() => {
  'use strict';

  function getSignInPath() {
    const pathname = (window.location && window.location.pathname) || '';
    if (pathname.includes('/super admin/') || pathname.includes('/super%20admin/')) return 'super-admin-login.html';
    if (pathname.includes('/pages/')) return 'SignIn.html';
    return 'pages/SignIn.html';
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

    login(email, password) {
      const users = StorageService.getAll('users');
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
    }
  };
})();
