/**
 * sidebar.js
 * Fetches the shared sidebar HTML and injects it into #sidebar-container,
 * then auto-highlights the nav item that matches the current page.
 */

(function () {

  function ensureSidebarStyles() {
    const href = '../styles/sidebar.css';
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some((link) => (link.getAttribute('href') || '').includes('sidebar.css'));

    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function applySidebarLayout(container) {
    const sidebar = container.querySelector('.sidebar');
    if (!sidebar) return;

    const isFixed = getComputedStyle(sidebar).position === 'fixed';
    if (!isFixed) return;

    const content = document.querySelector('main, .main-content, .cases-main, .details-main, .content');
    if (!content) return;

    // Avoid applying the offset twice when a wrapper already has this class.
    const hasOffsetAncestor = content.parentElement && content.parentElement.closest('.content-with-sidebar');
    if (hasOffsetAncestor || content.classList.contains('content-with-sidebar')) return;

    // Reuse shared utility class from sidebar.css to prevent sidebar overlap.
    content.classList.add('content-with-sidebar');
  }

  // Maps page filename → nav item ID (for active highlighting)
  const PAGE_TO_NAV = {
    'client-consultation-dashboard.html': 'nav-consultations',
    'firm-consultation-dashboard.html':   'nav-consultations',
    'documents-main.html':                'nav-documents',
    'case-documents.html':                'nav-documents',
    'client-cases.html':   'nav-cases',
    'client-case-details.html': 'nav-cases',
    'client-case-details-expanded.html': 'nav-cases',
    'client-case-advocate-profile.html': 'nav-cases',
    'firm-cases.html': 'nav-cases',
    'firm-case-details.html': 'nav-cases',
    'firm-tasks.html': 'nav-cases',
    'lawyer-cases.html':   'nav-cases',
    'lawyer-case-details.html': 'nav-cases',
    'lawyer-tasks.html':   'nav-cases',
    'client-billing.html':                'nav-billing',
    'client-billing-pay-now.html':        'nav-billing',
    'client-billing-transactions.html': 'nav-billing',
    'lawyer-billing.html': 'nav-billing',
    'firm-billing.html': 'nav-billing',
    'client-lawfirm-search.html':        'nav-search',
    'firm-user-management.html': 'nav-usermanagement',
    'schedule-management.html':            'nav-consultations',
  };

  // Maps nav item ID → relative page path (for link resolution)
  // Add entries here as new pages are built
  const NAV_TO_PAGE = {
    'nav-consultations': 'client-consultation-dashboard.html',
    'nav-cases':         'client-cases.html',
    'nav-billing':       'client-billing.html',
    'nav-search':        'client-lawfirm-search.html',
    'nav-documents':     'documents-main.html',
    'nav-usermanagement': 'firm-user-management.html',
  };

  async function loadComponent(selector, url) {
    const container = document.querySelector(selector);
    if (!container) return;

    ensureSidebarStyles();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[sidebar.js] Failed to load "${url}": ${response.status} ${response.statusText}`);
        return;
      }

      const html = await response.text();

      // Extract only what's inside <body>…</body> if this is a full HTML doc
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      container.innerHTML = bodyMatch ? bodyMatch[1].trim() : html.trim();

      applySidebarLayout(container);

      // Auto-set active nav item based on current page filename
      const page = location.pathname.split('/').pop();
      const navId = PAGE_TO_NAV[page];
      if (navId) {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
      }

      // Resolve nav link hrefs for pages that exist
      Object.entries(NAV_TO_PAGE).forEach(([id, pagePath]) => {
        const link = document.getElementById(id);
        if (link) link.href = pagePath;
      });

      // Update sidebar user identity from signed-in user data
      const roleLabels = { client: 'Client', firmAdmin: 'Firm Admin', lawyer: 'Lawyer' };
      const currentUserRaw = localStorage.getItem('currentUser');
      let currentUser = null;
      try {
        currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
      } catch {
        currentUser = null;
      }
      const userName = currentUser && (currentUser.fullName || currentUser.name)
        ? (currentUser.fullName || currentUser.name)
        : 'User';
      const userRole = localStorage.getItem('userRole') || (currentUser && currentUser.role) || 'client';

      const nameEl = container.querySelector('.user-name');
      if (nameEl) nameEl.textContent = userName;

      const roleEl = container.querySelector('.user-role');
      if (roleEl && userRole) roleEl.textContent = roleLabels[userRole] ?? 'User';

      // Role-based nav visibility
      // firmAdmin: hide "Find a Law Firm", point Consultations to firm dashboard
      // client:    hide "Schedules",        point Consultations to client dashboard
      const isFirmStaff = ['firmAdmin', 'lawyer', 'intern'].includes(userRole);

      if (isFirmStaff) {
        const searchLink = document.getElementById('nav-search');
        if (searchLink) searchLink.closest('a').style.display = 'none';

        const consultLink = document.getElementById('nav-consultations');
        if (consultLink) consultLink.href = 'firm-consultation-dashboard.html';

        const casesLink = document.getElementById('nav-cases');
        if (casesLink) {
          // If role is lawyer, we could optionally point to a different cases list, 
          // but for now firm-cases.html seems intended for staff.
          casesLink.href = 'firm-cases.html';
        }

        const billingLink = document.getElementById('nav-billing');
        if (billingLink) {
          if (userRole === 'intern') {
            billingLink.closest('a').style.display = 'none';
          } else {
            billingLink.href = 'firm-billing.html';
          }
        }

        // Show and link User Management for firmAdmin only (or decide if lawyers can see it)
        const userMgmtLink = document.getElementById('nav-usermanagement');
        if (userMgmtLink) {
          if (userRole === 'firmAdmin') {
            userMgmtLink.closest('a').style.display = 'flex';
            userMgmtLink.href = 'firm-user-management.html';
          } else {
            userMgmtLink.closest('a').style.display = 'none';
          }
        }

      } else {
        // default to client behaviour
        const consultLink = document.getElementById('nav-consultations');
        if (consultLink) consultLink.href = 'client-consultation-dashboard.html';

        const casesLink = document.getElementById('nav-cases');
        if (casesLink) casesLink.href = 'client-cases.html';

        const billingLink = document.getElementById('nav-billing');
        if (billingLink) billingLink.href = 'client-billing.html';

        // Hide User Management for client
        const userMgmtLink = document.getElementById('nav-usermanagement');
        if (userMgmtLink) userMgmtLink.closest('a').style.display = 'none';
      }

      // Shared logout behavior for all pages using the common sidebar
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('userRole');
          sessionStorage.removeItem('clientDraft');
          window.location.href = '../index.html';
        });
      }

    } catch (err) {
      console.error(`[sidebar.js] Network error loading "${url}":`, err);
    }
  }

  loadComponent('#sidebar-container', '../pages/sidebar.html');

})();
