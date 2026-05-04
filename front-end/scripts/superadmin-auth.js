/**
 * SuperAdmin Authentication Service
 * Provides role-based access control for superAdmin pages
 * Extends AuthService for superAdmin-specific functionality
 */

const SuperAdminAuth = (() => {
  'use strict';

  return {
    /**
     * Check if user is superAdmin and redirect if not
     * @returns {Object} Current user if authorized, null otherwise
     */
    requireSuperAdmin() {
      const user = AuthService.getCurrentUser();

      if (!user) {
        // Redirect to superAdmin login page if not logged in
        window.location.href = 'super-admin-login.html';
        return null;
      }

      const userRole = (user.role || '').toLowerCase();
      if (userRole !== 'superadmin') {
        // Redirect non-superAdmin users based on their role
        if (userRole === 'client') {
          window.location.href = '../pages/client-consultation-dashboard.html';
        } else if (userRole === 'firmadmin') {
          window.location.href = '../pages/firm-consultation-dashboard.html';
        } else {
          window.location.href = '../index.html';
        }
        return null;
      }

      return user;
    },

    /**
     * Logout superAdmin and redirect to login
     */
    logout() {
      AuthService.logout();
    },

    /**
     * Check if current user is superAdmin (without redirect)
     * @returns {boolean}
     */
    isSuperAdmin() {
      const user = AuthService.getCurrentUser();
      return user && (user.role || '').toLowerCase() === 'superadmin';
    },

    /**
     * Get current superAdmin user if logged in
     * @returns {Object|null}
     */
    getCurrentSuperAdmin() {
      const user = AuthService.getCurrentUser();
      if (user && (user.role || '').toLowerCase() === 'superadmin') {
        return user;
      }
      return null;
    }
  };
})();
