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
    'index.html':                         'nav-documents', // for DocumentManagement/index.html
    'billing.html':                       'nav-billing',
    'client-law_firm-search.html':        'nav-search',
  };

  // Maps nav item ID → path relative to front-end/pages/
  const NAV_TO_PAGE = {
    'nav-consultations': 'client-consultation-dashboard.html',
    'nav-search':        'client-law_firm-search.html',
    'nav-scheduling':    'ScheduleManagement.html',
    'nav-documents':     'DocumentManagement/index.html',
    'nav-billing':       'billing.html',
    'nav-cases':         'cases.html'
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

      // Auto-set active nav item based on current page filename
      const pathParts = location.pathname.split('/');
      const page = pathParts.pop() || 'index.html';
      const folder = pathParts.pop();
      const isSubDir = folder && folder !== 'pages'; // Simple check if inside a feature folder

      const navId = PAGE_TO_NAV[page];
      if (navId) {
        const el = document.getElementById(navId);
        if (el) el.classList.add('active');
      }

      // Resolve nav link hrefs for pages relative to current location
      Object.entries(NAV_TO_PAGE).forEach(([id, relPath]) => {
        const link = document.getElementById(id);
        if (link) {
          // If we're in a subfolder like DocumentManagement/, we need to go up one level
          link.href = isSubDir ? `../${relPath}` : relPath;
        }
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
        if (consultLink) consultLink.href = 'firm-consultation-dashboard.html';

      } else {
        // default to client behaviour
        const schedLink = document.getElementById('nav-scheduling');
        if (schedLink) schedLink.closest('a').style.display = 'none';

        const consultLink = document.getElementById('nav-consultations');
        if (consultLink) consultLink.href = 'client-consultation-dashboard.html';
      }

    } catch (err) {
      console.error(`[sidebar.js] Network error loading "${url}":`, err);
    }
  }

  // Auto-detect the correct path to sidebar.html based on current page depth
  const pathParts = location.pathname.split('/');
  const folder = pathParts[pathParts.length - 2];
  const sidebarUrl = (folder === 'pages') ? 'sidebar.html' : '../sidebar.html';

  loadComponent('#sidebar-container', sidebarUrl);

})();
