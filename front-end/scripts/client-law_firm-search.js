/**
 * client-law_firm-search.js
 * Fully integrated with the backend REST API (/law-firms).
 * - Search/filter/sort hit GET /law-firms with query params
 * - View Profile loads GET /law-firms/:id and populates the overlay dynamically
 * - Book Now gets firm data from the API then submits to consultations
 */
document.addEventListener('DOMContentLoaded', async () => {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const currentUser = AuthService.requireAuth(['client']);
  if (!currentUser) return;

  const role = 'client'; // always client on this page

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const firmsGrid       = document.querySelector('.firms-grid');
  const countText       = document.getElementById('results-count');
  const keywordInput    = document.getElementById('keyword-search');
  const locationSelect  = document.getElementById('location-select');
  const practiceSelect  = document.getElementById('practice-area-select');
  const sortSelect      = document.getElementById('sort-select');
  const searchBtn       = document.getElementById('trigger-search');
  const bookingOverlay  = document.getElementById('modal-overlay');
  const profileOverlay  = document.getElementById('profile-overlay');

  // ── sortBy value map from display label → API param ───────────────────────
  const SORT_MAP = {
    'Highest Rated': 'rating',
    'Lowest Price':  'price_asc',
    'Most Reviews':  'reviews',
    'Availability':  'availability',
  };

  // ── Toast helper ───────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    const existing = document.getElementById('lf-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'lf-toast';
    t.style.cssText =
      `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;
       border-radius:10px;font-size:14px;font-weight:500;color:#fff;
       background:${type === 'error' ? '#ef4444' : '#10b981'};
       box-shadow:0 4px 16px rgba(0,0,0,.15);`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ── Loading / error placeholders ───────────────────────────────────────────
  function showGridLoading() {
    if (!firmsGrid) return;
    firmsGrid.innerHTML = `
      <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;
                  justify-content:center;padding:60px 20px;background:#f9fafb;border-radius:12px;">
        <div style="width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#4f46e5;
                    border-radius:50%;animation:spin .7s linear infinite;"></div>
        <p style="color:#6b7280;font-size:13px;margin-top:10px;">Searching firms…</p>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  }

  function showGridError(msg) {
    if (!firmsGrid) return;
    firmsGrid.innerHTML = `
      <div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;
                  background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;
                  border-radius:8px;padding:16px;font-size:13px;font-weight:500;">
        ⚠ ${msg}
      </div>`;
  }

  // ── Avatar SVG ─────────────────────────────────────────────────────────────
  const COLOR_MAP = {
    blue:   { bg: '#e0e7ff', fg: '#3730a3' },
    green:  { bg: '#d1fae5', fg: '#065f46' },
    orange: { bg: '#ffedd5', fg: '#c2410c' },
    purple: { bg: '#ede9fe', fg: '#6d28d9' },
    pink:   { bg: '#fce7f3', fg: '#9d174d' },
    indigo: { bg: '#e0e7ff', fg: '#4338ca' },
    teal:   { bg: '#ccfbf1', fg: '#0f766e' },
  };

  function avatarSvg(color) {
    const c = COLOR_MAP[color] || COLOR_MAP.blue;
    return `
      <div class="firm-avatar" style="background:${c.bg}">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${c.fg}"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>`;
  }

  // ── Render firms grid ──────────────────────────────────────────────────────
  function renderFirms(firms) {
    if (!firmsGrid) return;
    firmsGrid.innerHTML = '';

    if (!firms || firms.length === 0) {
      firmsGrid.innerHTML = `
        <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;
                    justify-content:center;padding:60px 20px;background:#f9fafb;
                    border-radius:12px;border:2px dashed #e5e7eb;text-align:center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
               stroke-width="1.5" style="margin-bottom:12px;">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p style="color:#6b7280;font-weight:500;">No firms match your search. Try adjusting your filters.</p>
        </div>`;
      if (countText) countText.textContent = '0 firms matching your criteria.';
      return;
    }

    if (countText) countText.textContent = `${firms.length} firm${firms.length !== 1 ? 's' : ''} matching your criteria.`;

    const availBadge = {
      AVAILABLE: `<span class="badge badge-available">AVAILABLE</span>`,
      TODAY:     `<span class="badge badge-available-today">TODAY</span>`,
      BUSY:      `<span class="badge badge-busy">BUSY</span>`,
    };

    firms.forEach(firm => {
      const card = document.createElement('div');
      card.className = 'firm-card';
      card.id = `firm-card-${firm.id}`;
      card.innerHTML = `
        <div class="firm-card-header">
          ${avatarSvg(firm.avatarColor)}
          <div class="firm-info">
            <h3>${firm.name}</h3>
            <span class="firm-subtitle">${firm.subtitle}</span>
          </div>
          ${availBadge[firm.availability] || `<span class="badge">${firm.availability}</span>`}
        </div>
        <div class="firm-card-body">
          <p class="firm-description">${firm.description}</p>
        </div>
        <div class="firm-card-stats">
          <div class="stat-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span class="stat-rating">${firm.rating}</span>
            <span class="stat-reviews">(${firm.reviews} reviews)</span>
          </div>
          <div class="stat-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span class="stat-price">$${firm.price}/hr</span>
          </div>
        </div>
        <div class="firm-card-actions">
          <button class="btn btn-outline-sm btn-view-profile" data-id="${firm.id}" id="btn-view-${firm.id}">View Profile</button>
          <button class="btn btn-primary-sm btn-book-now" data-id="${firm.id}" id="btn-book-${firm.id}">Book Now</button>
        </div>`;
      firmsGrid.appendChild(card);
    });
  }

  // ── Fetch & render (main action) ───────────────────────────────────────────
  async function loadFirms() {
    showGridLoading();
    try {
      const filters = {
        keyword:      (keywordInput ? keywordInput.value.trim() : '') || undefined,
        location:     (locationSelect ? locationSelect.value : '') || undefined,
        practiceArea: (practiceSelect ? practiceSelect.value : '') || undefined,
        sortBy:       sortSelect ? (SORT_MAP[sortSelect.value] || 'rating') : 'rating',
      };
      const firms = await LexFlowAPI.lawFirms.getAll(filters, role);
      renderFirms(firms);
    } catch (err) {
      console.error('[LawFirmSearch] Load failed:', err);
      showGridError(`Could not load firms: ${err.message}. Ensure the backend is running at http://localhost:3000`);
    }
  }

  // ── Event listeners: search + sort ────────────────────────────────────────
  if (searchBtn) searchBtn.addEventListener('click', loadFirms);
  if (keywordInput) keywordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadFirms(); });
  if (locationSelect) locationSelect.addEventListener('change', loadFirms);
  if (practiceSelect) practiceSelect.addEventListener('change', loadFirms);
  if (sortSelect) sortSelect.addEventListener('change', loadFirms);

  // ── Pill filter buttons ────────────────────────────────────────────────────
  document.querySelectorAll('.pill-btn').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active-pill'));
      pill.classList.add('active-pill');
      // Map pill text to a practiceArea value
      const PILL_MAP = {
        'Corporate': 'corporate', 'Family': 'family',
        'Criminal': 'criminal', 'Property': 'civil',
        'IP': 'ip', 'Immigration': 'immigration',
      };
      const pillText = pill.textContent.trim().split(' ')[0];
      if (practiceSelect) practiceSelect.value = PILL_MAP[pillText] || '';
      loadFirms();
    });
  });

  // ── Global click delegation (profile + book buttons rendered dynamically) ──
  document.addEventListener('click', async (e) => {
    const btnView = e.target.closest('.btn-view-profile');
    const btnBook = e.target.closest('.btn-book-now');

    if (btnView) {
      const firmId = btnView.dataset.id;
      await openProfile(firmId);
    }
    if (btnBook) {
      const firmId = btnBook.dataset.id;
      await openBooking(firmId);
    }
  });

  // ── Open booking modal ─────────────────────────────────────────────────────
  async function openBooking(firmId) {
    try {
      const firm = await LexFlowAPI.lawFirms.getById(firmId, role);
      sessionStorage.setItem('booking_firm_id', firmId);
      sessionStorage.setItem('booking_firm_data', JSON.stringify(firm));

      const nameEl = document.getElementById('lawfirm-name');
      if (nameEl) nameEl.value = firm.name;

      // Reset calendar to today every time the modal opens
      const now = new Date();
      _calState.year  = now.getFullYear();
      _calState.month = now.getMonth();
      _calState.selectedDay = now.getDate();
      buildCalendar();

      if (bookingOverlay) {
        bookingOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    } catch (err) {
      console.error('[LawFirmSearch] openBooking failed:', err);
      showToast(`Could not load firm: ${err.message}`, 'error');
    }
  }

  // ── Open profile overlay ───────────────────────────────────────────────────
  async function openProfile(firmId) {
    const panel = document.getElementById('profile-panel');
    if (!panel) return;

    // Show loading state
    const nameEl = panel.querySelector('.profile-hero-info h2');
    const titleEl = panel.querySelector('.profile-title');
    if (nameEl) nameEl.textContent = 'Loading…';
    if (titleEl) titleEl.textContent = '';
    if (profileOverlay) {
      profileOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    try {
      const firm = await LexFlowAPI.lawFirms.getById(firmId, role);

      // Hero info
      if (nameEl) nameEl.textContent = `Adv. ${firm.name}`;
      if (titleEl) titleEl.textContent = `Senior Partner at ${firm.name}`;

      // Location
      const locEl = panel.querySelector('.profile-location');
      if (locEl) {
        locEl.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${firm.locationLabel}`;
      }

      // Avatar image (use ui-avatars placeholder)
      const photoEl = panel.querySelector('.profile-photo-lg img');
      if (photoEl) {
        const initials = firm.name.split(' ').map(w => w[0]).join('+').slice(0, 2);
        photoEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1e2a4a&color=fff&size=128`;
        photoEl.alt = firm.name;
      }

      // Stats — experience, price, rating/reviews
      const stats = panel.querySelectorAll('.profile-stat-value');
      if (stats[0]) stats[0].textContent = firm.experience;
      if (stats[1]) stats[1].textContent = `$${firm.price}/hr`;
      if (stats[2]) stats[2].innerHTML = `${firm.rating}/5 <span class="profile-stat-sub">(${firm.reviews} reviews)</span>`;

      // Bio
      const bioEl = panel.querySelector('.profile-bio');
      if (bioEl) bioEl.textContent = firm.bio;

      // Practice areas tags
      const tagsEl = panel.querySelector('.profile-tags');
      if (tagsEl) {
        tagsEl.innerHTML = firm.practiceAreas
          .map(p => `<span class="profile-tag">${p}</span>`)
          .join('');
      }

      // "About" section title
      const aboutTitle = panel.querySelector('.section-title.mt-4');
      if (aboutTitle) aboutTitle.textContent = `About ${firm.name.split(' ')[0]}`;

      // Education
      const eduItems = panel.querySelectorAll('.profile-edu-item');
      firm.education.forEach((edu, i) => {
        if (eduItems[i]) {
          const school = eduItems[i].querySelector('.edu-school');
          const degree = eduItems[i].querySelector('.edu-degree');
          if (school) school.textContent = edu.school;
          if (degree) degree.textContent = edu.degree;
        }
      });

      // Languages
      const langList = panel.querySelector('.profile-lang-list');
      if (langList) {
        langList.innerHTML = firm.languages
          .map(l => `<span class="profile-lang">${l}</span>`)
          .join('');
      }

      // ── Contact info card (real registered firms only) ────────────────────
      // Remove any previous contact card first
      const existingContact = panel.querySelector('.profile-contact-card');
      if (existingContact) existingContact.remove();

      const hasContact = firm.address || firm.email || firm.phone || firm.website;
      if (hasContact) {
        const contactCard = document.createElement('div');
        contactCard.className = 'profile-section card-style profile-contact-card';
        contactCard.style.cssText = 'margin-top:16px;';
        const rows = [];
        if (firm.address) rows.push(`
          <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:2px;flex-shrink:0;">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style="font-size:13px;color:#374151;">${firm.address}</span>
          </div>`);
        if (firm.email) rows.push(`
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <a href="mailto:${firm.email}" style="font-size:13px;color:#4f46e5;text-decoration:none;">${firm.email}</a>
          </div>`);
        if (firm.phone) rows.push(`
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.71 3.35 2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6 6l1.06-1.06a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span style="font-size:13px;color:#374151;">${firm.phone}</span>
          </div>`);
        if (firm.website) rows.push(`
          <div style="display:flex;gap:8px;align-items:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <a href="${firm.website}" target="_blank" style="font-size:13px;color:#4f46e5;text-decoration:none;">${firm.website}</a>
          </div>`);

        contactCard.innerHTML = `
          <h3 class="section-title">Contact Information</h3>
          ${rows.join('')}`;

        // Insert after the languages card (last child of right column)
        const rightCol = panel.querySelector('.profile-body-right');
        if (rightCol) rightCol.appendChild(contactCard);
      }

      // ── Hero name: real firms show firm name, demo firms show "Adv. Name" ─
      // Real firms have IDs like 'firm-1', 'firm-2'; demo firms have 'firm-001' etc.
      const isRealFirm = /^firm-\d+$/.test(firmId) && !firmId.includes('00');
      if (nameEl) nameEl.textContent = isRealFirm ? firm.name : `Adv. ${firm.name}`;
      if (titleEl) titleEl.textContent = isRealFirm
        ? `Registered Law Firm — ${firm.locationLabel}`
        : `Senior Partner at ${firm.name}`;

      // Book button inside profile
      const pBookBtn = document.getElementById('profile-book-btn');
      if (pBookBtn) {
        pBookBtn.onclick = async () => {
          profileOverlay.classList.remove('active');
          await openBooking(firmId);
        };
      }

    } catch (err) {
      console.error('[LawFirmSearch] openProfile failed:', err);
      if (nameEl) nameEl.textContent = 'Could not load profile';
      showToast(`Error loading profile: ${err.message}`, 'error');
    }
  }

  // ── Mini calendar engine ───────────────────────────────────────────────────
  // Tracks which year/month the calendar is showing
  const _calState = {
    year:  new Date().getFullYear(),
    month: new Date().getMonth(),   // 0-indexed
    selectedDay: new Date().getDate(),
  };

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  function buildCalendar() {
    const calGrid   = document.querySelector('.cal-grid');
    const calLabel  = document.getElementById('cal-month-label');
    if (!calGrid || !calLabel) return;

    const { year, month, selectedDay } = _calState;
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    // Update label
    calLabel.textContent = `${MONTH_NAMES[month]} ${year}`;

    // Clear all day cells (keep the 7 day-of-week headers)
    const dows = calGrid.querySelectorAll('.cal-dow');
    calGrid.innerHTML = '';
    dows.forEach(d => calGrid.appendChild(d));

    // First weekday of this month (0=Sun … 6=Sat)
    const firstDow = new Date(year, month, 1).getDay();

    // Total days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Leading blank cells
    for (let i = 0; i < firstDow; i++) {
      const blank = document.createElement('span');
      blank.className = 'cal-day cal-day-empty';
      blank.style.cssText = 'visibility:hidden;cursor:default;';
      calGrid.appendChild(blank);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('span');
      cell.className = 'cal-day';
      cell.textContent = d;

      // Past days in the past are disabled
      const isPast =
        year < todayY ||
        (year === todayY && month < todayM) ||
        (year === todayY && month === todayM && d < todayD);

      if (isPast) {
        cell.classList.add('cal-day-past');
        cell.style.cssText = 'opacity:0.35;cursor:not-allowed;pointer-events:none;';
      } else if (d === selectedDay && year === _calState.year && month === _calState.month) {
        cell.classList.add('selected');
      }

      calGrid.appendChild(cell);
    }
  }

  /** Returns the full date string for the currently selected day in the calendar */
  function getCalendarDate() {
    const { year, month, selectedDay } = _calState;
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${MONTHS_SHORT[month]} ${selectedDay}, ${year}`;
  }

  // Wire nav buttons (use event delegation on the calendar header)
  const miniCalendar = document.getElementById('mini-calendar');
  if (miniCalendar) {
    miniCalendar.addEventListener('click', (e) => {
      const prevBtn = e.target.closest('[aria-label="Previous month"]');
      const nextBtn = e.target.closest('[aria-label="Next month"]');
      const dayCell = e.target.closest('.cal-day:not(.cal-day-empty):not(.cal-day-past)');

      if (prevBtn) {
        _calState.month--;
        if (_calState.month < 0) { _calState.month = 11; _calState.year--; }
        // Reset selection to 1 if we navigated away
        _calState.selectedDay = 1;
        buildCalendar();
      }

      if (nextBtn) {
        _calState.month++;
        if (_calState.month > 11) { _calState.month = 0; _calState.year++; }
        _calState.selectedDay = 1;
        buildCalendar();
      }

      if (dayCell) {
        _calState.selectedDay = parseInt(dayCell.textContent.trim(), 10);
        // Update visual selection
        miniCalendar.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
        dayCell.classList.add('selected');
      }
    });
  }

  // Build calendar on first load so it's ready when the modal opens
  buildCalendar();

  // ── Consultation type toggle ───────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('.type-option');
    if (opt) {
      document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }

    const slot = e.target.closest('.time-slot');
    if (slot) {
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
    }
  });

  // ── Modal close ────────────────────────────────────────────────────────────
  const closeBtns = [
    document.getElementById('modal-close-btn'),
    document.getElementById('modal-cancel-btn'),
    document.getElementById('profile-back-btn'),
  ];
  closeBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      if (bookingOverlay) bookingOverlay.classList.remove('active');
      if (profileOverlay) profileOverlay.classList.remove('active');
      document.body.style.overflow = '';
      sessionStorage.removeItem('booking_firm_id');
      sessionStorage.removeItem('booking_firm_data');
    });
  });

  // ── Booking form submission ────────────────────────────────────────────────
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const activeUser = AuthService.getCurrentUser();
      if (!activeUser || activeUser.role !== 'client') {
        window.location.href = 'SignIn.html';
        return;
      }

      const clientName = activeUser.fullName || activeUser.name;
      const clientId   = activeUser.id || activeUser.userId || activeUser.clientId;
      if (!clientName || !clientId) {
        window.location.href = 'SignIn.html';
        return;
      }

      // Get firm data from sessionStorage (set by openBooking)
      const firmId   = sessionStorage.getItem('booking_firm_id');
      const firmData = JSON.parse(sessionStorage.getItem('booking_firm_data') || 'null');

      const firmName  = document.getElementById('lawfirm-name')?.value || firmData?.name || 'Unknown Firm';
      const typeInput = document.querySelector('.type-option.selected input');
      const consType  = typeInput ? typeInput.value : 'video';

      // Use the live calendar state — getCalendarDate() returns 'May 12, 2026' etc.
      const consDate   = getCalendarDate();
      const timeEl    = document.querySelector('.time-slot.selected');
      const timeStr   = timeEl ? timeEl.textContent.trim() : '10:30 AM';
      const consTime   = `${timeStr} - ${timeStr}`;
      const caseDesc   = document.getElementById('case-description')?.value.trim() || '';

      const COLORS    = ['blue','green','orange','purple','pink','indigo','teal'];
      const avatarClass = COLORS[Math.floor(Math.random() * COLORS.length)];

      const payload = {
        clientId,
        clientName,
        firmId:          firmData ? firmData.id : (firmId || 'unknown'),
        firmName:        firmData ? firmData.name : firmName,
        type:            consType,
        date:            consDate,
        time:            consTime,
        caseDescription: caseDesc || 'General consultation request.',
        consultationFee: firmData ? `$${firmData.price}` : undefined,
        avatarClass,
        bookedViaWorkflow: true,
      };

      const submitBtn = document.getElementById('modal-confirm-btn');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Booking…'; }

      try {
        const saved = await LexFlowAPI.consultations.create(payload, 'client');
        console.log('[LawFirmSearch] Consultation booked:', saved.id);
        sessionStorage.removeItem('booking_firm_id');
        sessionStorage.removeItem('booking_firm_data');
        showToast('Consultation request sent! Redirecting…');
        setTimeout(() => { window.location.href = 'client-consultation-dashboard.html'; }, 1500);
      } catch (err) {
        console.error('[LawFirmSearch] Booking failed:', err);
        showToast(`Booking failed: ${err.message}`, 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Confirm Booking'; }
      }
    });
  }

  // ── Sidebar user name ──────────────────────────────────────────────────────
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarRole = document.getElementById('sidebar-user-role');
  if (sidebarName) sidebarName.textContent = currentUser.fullName || currentUser.name || 'Client';
  if (sidebarRole) sidebarRole.textContent = 'Client';

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => AuthService.logout());

  // ── Initial load ───────────────────────────────────────────────────────────
  await loadFirms();
});
