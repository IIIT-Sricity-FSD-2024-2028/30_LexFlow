/* =========================================================
   LexFlow — Landing Page Script
   ========================================================= */

(function () {
  'use strict';

  function getSignInPath() {
    return window.location.pathname.includes('/pages/') ? './sign-in.html' : './pages/sign-in.html';
  }

  /* ---- Helper: generic dropdown toggle ---- */
  function makeDropdown(btnId, dropdownId, anchorId) {
    const btn      = document.getElementById(btnId);
    const dropdown = document.getElementById(dropdownId);
    const anchor   = document.getElementById(anchorId);
    if (!btn || !dropdown || !anchor) return { btn, dropdown, anchor };

    function open() {
      dropdown.classList.add('is-open');
      btn.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      dropdown.classList.remove('is-open');
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      dropdown.classList.contains('is-open') ? close() : open();
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });

    return { btn, dropdown, anchor, open, close };
  }

  /* ---- Close all dropdowns when clicking outside ---- */
  const allAnchors = [];

  document.addEventListener('click', function (e) {
    allAnchors.forEach(function (a) {
      if (!a.anchor.contains(e.target)) a.close();
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') allAnchors.forEach(function (a) { a.close(); });
  });

  /* ================================================================
     1. LOGIN DROPDOWN
     ================================================================ */
  const login = makeDropdown('login-btn', 'login-dropdown', 'login-anchor');
  if (login.close) allAnchors.push(login);

  const loginClientBtn  = document.getElementById('login-client-btn');
  const loginLawfirmBtn = document.getElementById('login-lawfirm-btn');
  const loginInternBtn = document.getElementById('login-intern-btn');

  if (loginClientBtn) {
    loginClientBtn.addEventListener('click', function () {
      localStorage.setItem('loginRole', 'client');
      login.close();
      window.location.href = getSignInPath();
    });
  }

  if (loginLawfirmBtn) {
    loginLawfirmBtn.addEventListener('click', function () {
      localStorage.setItem('loginRole', 'firmadmin');
      login.close();
      window.location.href = getSignInPath();
    });
  }

  if (loginInternBtn) {
    loginInternBtn.addEventListener('click', function () {
      localStorage.setItem('loginRole', 'intern');
      login.close();
      window.location.href = getSignInPath();
    });
  }

  /* ================================================================
     3. REQUEST CONSULTATION CTA (LOGIN REQUIRED)
     ================================================================ */
  const requestConsultationBtn = document.getElementById('request-consultation-btn');
  if (requestConsultationBtn) {
    requestConsultationBtn.addEventListener('click', function () {
      const currentUserStr = localStorage.getItem('currentUser');
      let currentUser = null;
      if (currentUserStr) {
        try { currentUser = JSON.parse(currentUserStr); } catch (e) {}
      }

      if (currentUser && currentUser.role && currentUser.role.toLowerCase() === 'client') {
        window.location.href = './pages/client-consultation-dashboard.html';
        return;
      }

      localStorage.setItem('loginRole', 'client');
      window.location.href = getSignInPath();
    });
  }

  /* ================================================================
     2. LANGUAGE DROPDOWN
     ================================================================ */
  const lang = makeDropdown('lang-btn', 'lang-dropdown', 'lang-anchor');
  if (lang.close) allAnchors.push(lang);

  const langLabel   = document.getElementById('lang-label');
  const langOptions = document.querySelectorAll('#lang-dropdown .nav-dropdown__item');

  langOptions.forEach(function (optBtn) {
    optBtn.addEventListener('click', function () {
      // Update active state
      langOptions.forEach(function (b) { b.classList.remove('is-active'); });
      optBtn.classList.add('is-active');

      // Update button label (EN / HI)
      if (langLabel) langLabel.textContent = optBtn.dataset.label;

      lang.close();
    });
  });

})();
