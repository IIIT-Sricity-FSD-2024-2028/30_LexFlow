/**
 * firm-consultation-dashboard.js
 * Replaces all localStorage/LexFlowStorage calls with backend API.
 * Firm admin view: stats, pending requests (accept/reject), active table, lawyer availability.
 */
document.addEventListener('DOMContentLoaded', async () => {

  // ── Auth guard ─────────────────────────────────────────────────────────────
  const currentUser = AuthService.requireAuth(['firmAdmin', 'firmadmin', 'lawyer', 'intern']);
  if (!currentUser) return;

  // Normalize role to lowercase so it matches backend UserRole enum values
  // (signin.js maps 'firmadmin' → 'firmAdmin' for localStorage, but the backend expects lowercase)
  const userRole = (currentUser.role || 'firmadmin').toLowerCase();

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const requestsGrid    = document.querySelector('.requests-grid');
  const activeTableBody = document.querySelector('#active-consultations-table tbody');
  const lawyersGrid     = document.querySelector('.lawyers-grid');
  const statPendingEl   = document.querySelector('#stat-pending .stat-card-value');
  const statActiveEl    = document.querySelector('#stat-active .stat-card-value');
  const statCompletedEl = document.querySelector('#stat-completed .stat-card-value');

  // ── Firm context ───────────────────────────────────────────────────────────
  const firmId   = currentUser.firmId   || null;
  const firmName = currentUser.firmName || null;

  // ── Toast notification ─────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.getElementById('lexflow-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'lexflow-toast';
    toast.className = `lexflow-toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ── Loading / error helpers ────────────────────────────────────────────────
  function showLoadingGrid(container, label = 'Loading…') {
    if (!container) return;
    container.innerHTML = `
      <div class="api-loading-block" style="grid-column:1/-1">
        <div class="api-loading-spinner"></div>
        <p>${label}</p>
      </div>`;
  }

  function showLoadingTable(tbody, cols = 8, label = 'Loading…') {
    if (!tbody) return;
    tbody.innerHTML = `
      <tr><td colspan="${cols}" style="text-align:center;padding:40px;">
        <div class="api-loading-spinner"></div>
        <p style="color:#6b7280;margin-top:8px;font-size:13px;">${label}</p>
      </td></tr>`;
  }

  function showErrorGrid(container, msg) {
    if (!container) return;
    container.innerHTML = `
      <div class="api-error-banner" style="grid-column:1/-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ${msg}
      </div>`;
  }

  function showErrorTable(tbody, msg, cols = 8) {
    if (!tbody) return;
    tbody.innerHTML = `
      <tr><td colspan="${cols}">
        <div class="api-error-banner">${msg}</div>
      </td></tr>`;
  }

  // ── Lawyer availability (read from localStorage as before, no backend change) ─
  function renderLawyerAvailability(lawyers) {
    if (!lawyersGrid) return;
    lawyersGrid.innerHTML = '';

    if (!lawyers || lawyers.length === 0) {
      lawyersGrid.innerHTML = `
        <div class="no-data-notice" style="grid-column:1/-1;text-align:center;padding:40px;color:#6b7280;">
          No lawyer data available.
        </div>`;
      return;
    }

    lawyers.forEach(l => {
      const card = document.createElement('div');
      card.className = 'lawyer-card';
      const statusClass = l.capacity > 80 ? 'busy' : 'available';
      card.innerHTML = `
        <div class="lawyer-card-top">
          <div class="lawyer-card-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e3a5f" stroke-width="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="lawyer-card-info">
            <h3>${l.name}</h3>
            <span class="lawyer-card-spec">${(l.specialties || []).join(' · ')}</span>
          </div>
          <span class="badge badge-${statusClass}">${statusClass.toUpperCase()}</span>
        </div>
        <div class="lawyer-workload">
          <div class="workload-row">
            <span class="workload-label">Active Cases</span>
            <span class="workload-value">${l.activeCases}</span>
          </div>
          <div class="workload-row">
            <span class="workload-label">Consultations Today</span>
            <span class="workload-value">${l.consultationsToday}</span>
          </div>
          <div class="workload-bar-wrapper">
            <div class="workload-bar ${l.capacity > 80 ? 'high' : ''}" style="width:${l.capacity}%;"></div>
          </div>
          <span class="workload-capacity">${l.capacity}% Capacity</span>
        </div>`;
      lawyersGrid.appendChild(card);
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  function updateStats(allConsultations) {
    const pending   = allConsultations.filter(c => c.status === 'PENDING').length;
    const active    = allConsultations.filter(c => ['SCHEDULED', 'CONFIRMED', 'IN PROGRESS'].includes(c.status)).length;
    const completed = allConsultations.filter(c => c.status === 'COMPLETED').length;

    if (statPendingEl)   statPendingEl.textContent   = pending;
    if (statActiveEl)    statActiveEl.textContent     = active;
    if (statCompletedEl) statCompletedEl.textContent  = completed;
  }

  // ── Incoming requests ──────────────────────────────────────────────────────
  function renderIncomingRequests(pending, lawyers) {
    if (!requestsGrid) return;
    requestsGrid.innerHTML = '';

    if (pending.length === 0) {
      requestsGrid.innerHTML = `
        <div class="no-data-notice" style="grid-column:1/-1;text-align:center;padding:60px 20px;
             background:#f9fafb;border-radius:12px;border:2px dashed #e5e7eb;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" style="margin-bottom:12px;">
            <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p style="color:#6b7280;font-weight:500;">No pending requests at the moment.</p>
        </div>`;
      return;
    }

    pending.forEach(req => {
      const card = document.createElement('div');
      card.className = 'request-card';
      card.innerHTML = `
        <div class="request-top">
          <div class="request-client-row">
            <div class="request-avatar ${req.avatarClass || 'blue'}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="request-client-info">
              <span class="request-client-name">${req.clientName}</span>
              <span class="request-client-type">Individual Client</span>
            </div>
            <span class="badge badge-pending">PENDING</span>
          </div>
          <div class="request-meta">
            <div class="request-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>${req.date}</span>
            </div>
            <div class="request-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span>${req.type ? req.type.charAt(0).toUpperCase() + req.type.slice(1) : 'N/A'}</span>
            </div>
          </div>
          <p class="request-subject">${req.id}: ${req.caseDescription || 'New consultation request received.'}</p>
        </div>
        <div class="request-actions">
          <div class="assign-dropdown">
            <select id="assign-lawyer-${req.id}" class="assign-select">
              <option value="">Assign Lawyer</option>
              ${(lawyers || []).map(l => `<option value="${l.id}|${l.name}">${l.name}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-accept" data-id="${req.id}" id="btn-accept-${req.id}">Accept</button>
          <button class="btn btn-reject" data-id="${req.id}" id="btn-reject-${req.id}">Reject</button>
        </div>`;
      requestsGrid.appendChild(card);
    });
  }

  // ── Active consultations table ─────────────────────────────────────────────
  function renderActiveConsultations(active) {
    if (!activeTableBody) return;

    if (active.length === 0) {
      activeTableBody.innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:40px;color:#6b7280;">
          No active consultations at the moment.
        </td></tr>`;
      return;
    }

    activeTableBody.innerHTML = '';
    active.forEach(cons => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><a href="#" class="link-id">${cons.id}</a></td>
        <td>
          <div class="table-client">
            <span class="table-client-name">${cons.clientName}</span>
            <span class="table-client-type">Client</span>
          </div>
        </td>
        <td>
          <div class="table-lawyer">
            <div class="table-lawyer-dot ${cons.lawyerId ? 'green' : 'yellow'}"></div>
            <span>${cons.lawyerName || 'Unassigned'}</span>
          </div>
        </td>
        <td>${cons.caseDescription ? cons.caseDescription.substring(0, 25) + '…' : 'Legal Advice'}</td>
        <td>${cons.date} · ${cons.time}</td>
        <td><span class="mode-badge mode-${cons.type || 'chat'}">${cons.type ? cons.type.toUpperCase() : 'CHAT'}</span></td>
        <td><span class="status-badge status-${cons.status.toLowerCase().replace(' ', '-')}">${cons.status}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-primary btn-join" data-id="${cons.id}" id="btn-join-${cons.id}">Join Call</button>
            <button class="btn btn-sm btn-outline btn-cancel" data-id="${cons.id}" id="btn-cancel-${cons.id}">Cancel</button>
          </div>
        </td>`;
      activeTableBody.appendChild(row);
    });
  }

  // ── Accept consultation (assign lawyer + confirm) ──────────────────────────
  async function handleAccept(consId) {
    const select = document.getElementById(`assign-lawyer-${consId}`);
    const value  = select ? select.value : '';

    if (!value) {
      showToast('Please assign a lawyer before accepting.', 'error');
      return;
    }

    const [lawyerId, lawyerName] = value.split('|');
    const btn = document.getElementById(`btn-accept-${consId}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Accepting…'; }

    try {
      await LexFlowAPI.consultations.update(consId, {
        status: 'CONFIRMED',
        lawyerId,
        lawyerName,
      }, userRole);

      showToast(`Consultation ${consId} assigned to ${lawyerName}.`, 'success');
      await refreshAll();
    } catch (err) {
      console.error('[FirmDashboard] Accept failed:', err);
      showToast(`Failed to accept: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Accept'; }
    }
  }

  // ── Reject / cancel ────────────────────────────────────────────────────────
  async function handleReject(consId) {
    const btn = document.getElementById(`btn-reject-${consId}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Rejecting…'; }

    try {
      await LexFlowAPI.consultations.cancel(consId, userRole);
      showToast(`Consultation ${consId} rejected.`, 'success');
      await refreshAll();
    } catch (err) {
      console.error('[FirmDashboard] Reject failed:', err);
      showToast(`Failed to reject: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Reject'; }
    }
  }

  async function handleCancel(consId) {
    const btn = document.querySelector(`.btn-cancel[data-id="${consId}"]`);
    if (btn) { btn.disabled = true; btn.textContent = 'Cancelling…'; }

    try {
      await LexFlowAPI.consultations.cancel(consId, userRole);
      showToast(`Consultation ${consId} cancelled.`, 'success');
      await refreshAll();
    } catch (err) {
      console.error('[FirmDashboard] Cancel failed:', err);
      showToast(`Failed to cancel: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Cancel'; }
    }
  }

  // ── Global click delegation ────────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    const btnJoin   = e.target.closest('.btn-join');
    const btnAccept = e.target.closest('.btn-accept');
    const btnReject = e.target.closest('.btn-reject');
    const btnCancel = e.target.closest('.btn-cancel');

    if (btnJoin) {
      const id = btnJoin.dataset.id;
      sessionStorage.setItem('active_cons_id', id);
      window.location.href = 'lawyer-join-consultation-interface.html';
    }
    if (btnAccept) await handleAccept(btnAccept.dataset.id);
    if (btnReject) {
      if (confirm('Reject this consultation request?')) {
        await handleReject(btnReject.dataset.id);
      }
    }
    if (btnCancel) {
      if (confirm('Cancel this active consultation?')) {
        await handleCancel(btnCancel.dataset.id);
      }
    }
  });

  // ── Main data load ─────────────────────────────────────────────────────────
  async function refreshAll() {
    showLoadingGrid(requestsGrid, 'Loading requests…');
    showLoadingTable(activeTableBody, 8, 'Loading active consultations…');

    try {
      // Build filter: if firmId known, filter by firm
      const filters = {};
      if (firmId) filters.firmId = firmId;

      const allConsultations = await LexFlowAPI.consultations.getAll(filters, userRole);

      // Update stats
      updateStats(allConsultations);

      // Pending requests
      const pending = allConsultations.filter(c => c.status === 'PENDING');
      const active  = allConsultations.filter(c =>
        ['SCHEDULED', 'CONFIRMED', 'IN PROGRESS'].includes(c.status)
      );

      // Lawyers from localStorage (no lawyer API endpoint yet)
      const lawyers = typeof LexFlowStorage !== 'undefined'
        ? LexFlowStorage.getLawyers()
        : [];

      renderIncomingRequests(pending, lawyers);
      renderActiveConsultations(active);
      renderLawyerAvailability(lawyers);

    } catch (err) {
      console.error('[FirmDashboard] Load failed:', err);
      const msg = err.status === 403
        ? 'Access denied. Please log in as a firm admin.'
        : `Could not load dashboard data: ${err.message}`;
      showErrorGrid(requestsGrid, msg);
      showErrorTable(activeTableBody, msg, 8);
    }
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  await refreshAll();
});
