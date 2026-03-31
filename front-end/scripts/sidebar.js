/**
 * sidebar.js
 * Fetches the shared sidebar HTML and injects it into #sidebar-container,
 * then auto-highlights the nav item that matches the current page.
 */

(function () {

  // Maps page filename → nav item ID (for active highlighting)
  const PAGE_TO_NAV = {
    'ScheduleManagement.html':            'nav-scheduling',
    'client-consultation-dashboard.html': 'nav-consultations',
    'firm-consultation-dashboard.html':   'nav-consultations',
    'cases.html':                         'nav-cases',
    'documents.html':                     'nav-documents',
    'billing.html':                       'nav-billing',
    'client-law_firm-search.html':        'nav-search',
  };

  // Maps nav item ID → relative page path (for link resolution)
  // Add entries here as new pages are built
  const NAV_TO_PAGE = {
    'nav-consultations': 'client-consultation-dashboard.html',
    'nav-search':        'client-law_firm-search.html',
    'nav-scheduling':    'ScheduleManagement.html',
  };

  async function loadComponent(selector, url) {
    const container = document.querySelector(selector);
    if (!container) return;

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

      // Signal that sidebar is now in the DOM
      document.dispatchEvent(new CustomEvent('sidebarLoaded'));

      // Auto-set active nav item based on current page filename
      const page = location.pathname.split('/').pop();
      const navId = PAGE_TO_NAV[page];
      if (navId) {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
      }

      // Resolve nav link hrefs for pages that exist
      const base = window.BASE_PATH || '';
      Object.entries(NAV_TO_PAGE).forEach(([id, pagePath]) => {
        const link = document.getElementById(id);
        if (link) link.href = base + pagePath;
      });

      // Update role label from localStorage
      const roleLabels = { client: 'Client', firmAdmin: 'Law Firm' };
      const userRole = localStorage.getItem('userRole');
      const roleEl = container.querySelector('.user-role');
      if (roleEl && userRole) roleEl.textContent = roleLabels[userRole] ?? 'User';

      // Role-based nav visibility
      // firmAdmin: hide "Find a Law Firm", point Consultations to firm dashboard
      // client:    hide "Schedules",        point Consultations to client dashboard
      if (userRole === 'firmAdmin') {
        const searchLink = document.getElementById('nav-search');
        if (searchLink) searchLink.closest('a').style.display = 'none';

        const consultLink = document.getElementById('nav-consultations');
        if (consultLink) consultLink.href = base + 'firm-consultation-dashboard.html';

        const billingLink = document.getElementById('nav-billing');
        if (billingLink) billingLink.closest('a').href = base + 'Billing and CaseManagement/firm_manager/casemanagement_billing.html';

        const casesLink = document.getElementById('nav-cases');
        if (casesLink) casesLink.closest('a').href = base + 'Billing and CaseManagement/firm_manager/casemanagement_cases.html';

      } else {
        // default to client behaviour
        const schedLink = document.getElementById('nav-scheduling');
        if (schedLink) schedLink.closest('a').style.display = 'none';

        const consultLink = document.getElementById('nav-consultations');
        if (consultLink) consultLink.href = base + 'client-consultation-dashboard.html';

        const billingLink = document.getElementById('nav-billing');
        if (billingLink) billingLink.closest('a').href = base + 'Billing and CaseManagement/client/billing.html';

        const casesLink = document.getElementById('nav-cases');
        if (casesLink) casesLink.closest('a').href = base + 'Billing and CaseManagement/client/casemanagement_cases.html';
      }

    } catch (err) {
      console.error(`[sidebar.js] Network error loading "${url}":`, err);
    }
  }

  const sidebarUrl = window.SIDEBAR_PATH || '../pages/sidebar.html';
  loadComponent('#sidebar-container', sidebarUrl);

})();
