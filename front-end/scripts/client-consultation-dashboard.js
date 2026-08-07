/**
 * client-consultation-dashboard.js
 * Replaces all localStorage/LexFlowStorage consultation calls with backend API.
 */
document.addEventListener('DOMContentLoaded', async () => {

  // ── Auth guard ─────────────────────────────────────────────────────────────
  const currentUser = AuthService.requireAuth(['client']);
  if (!currentUser) return;


  // ── DOM refs ───────────────────────────────────────────────────────────────
  const scheduledGrid   = document.querySelector('.scheduled-grid');
  const pastTableBody   = document.querySelector('#past-consultations-table tbody');
  const btnBookCons     = document.getElementById('btn-book-consultation');
  const modalOverlay    = document.getElementById('modal-overlay');
  const modalCloseBtn   = document.getElementById('modal-close-btn');
  const modalCancelBtn  = document.getElementById('modal-cancel-btn');

  // ── Navigate to search page ────────────────────────────────────────────────
  if (btnBookCons) {
    btnBookCons.addEventListener('click', () => {
      window.location.href = 'client-lawfirm-search.html';
    });
  }

  // ── Modal close helpers ────────────────────────────────────────────────────
  function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  [modalCloseBtn, modalCancelBtn].forEach(btn => btn && btn.addEventListener('click', closeModal));
  if (modalOverlay) {
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  }

  // ── Loading / error UI helpers ─────────────────────────────────────────────
  function showLoading(container, colSpan = 7) {
    if (!container) return;
    if (container.tagName === 'TBODY') {
      container.innerHTML = `
        <tr><td colspan="${colSpan}" style="text-align:center;padding:40px;">
          <div class="api-loading-spinner" aria-label="Loading…"></div>
          <p style="color:#6b7280;margin-top:10px;font-size:13px;">Loading consultations…</p>
        </td></tr>`;
    } else {
      container.innerHTML = `
        <div class="api-loading-block">
          <div class="api-loading-spinner" aria-label="Loading…"></div>
          <p>Loading consultations…</p>
        </div>`;
    }
  }

  function showError(container, message, colSpan = 7) {
    if (!container) return;
    if (container.tagName === 'TBODY') {
      container.innerHTML = `
        <tr><td colspan="${colSpan}">
          <div class="api-error-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ${message}
          </div>
        </td></tr>`;
    } else {
      container.innerHTML = `
        <div class="api-error-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${message}
        </div>`;
    }
  }

  function showToast(message, type = 'success') {
    const existing = document.getElementById('lexflow-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'lexflow-toast';
    toast.className = `lexflow-toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  function renderScheduled(consultations) {
    if (!scheduledGrid) return;

    const active = consultations.filter(c =>
      ['PENDING', 'SCHEDULED', 'CONFIRMED', 'IN PROGRESS'].includes(c.status)
    );

    if (active.length === 0) {
      scheduledGrid.innerHTML = `
        <div class="no-data-notice">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No upcoming consultations. <a href="client-lawfirm-search.html">Book one now →</a></p>
        </div>`;
      return;
    }

    scheduledGrid.innerHTML = '';
    active.forEach(cons => {
      const card = document.createElement('div');
      card.className = 'consultation-card';
      card.id = `consultation-card-${cons.id}`;
      const typeLabel = cons.type
        ? cons.type.charAt(0).toUpperCase() + cons.type.slice(1)
        : 'N/A';
      card.innerHTML = `
        <div class="card-top-row">
          <div class="card-avatar ${cons.avatarClass || 'blue'}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="card-info">
            <div class="card-badges">
              <span class="badge badge-id">${cons.id}</span>
              <span class="badge badge-${cons.status.toLowerCase().replace(' ', '-')}">${cons.status}</span>
            </div>
            <h3 class="card-lawyer-name">${cons.lawyerName || 'Awaiting Assignment'}</h3>
            <span class="card-firm-detail">${cons.firmName} • ${typeLabel}</span>
          </div>
          <div class="card-date-block">
            <span class="card-date">${cons.date}</span>
            <span class="card-time">${cons.time}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-join" data-id="${cons.id}" id="btn-join-${cons.id}">Consultation</button>
          <button class="btn btn-outline btn-view-details" data-id="${cons.id}" id="btn-details-${cons.id}">View Details</button>
          <button class="btn btn-cancel-text btn-cancel" data-id="${cons.id}" id="btn-cancel-${cons.id}">Cancel</button>
        </div>`;
      scheduledGrid.appendChild(card);
    });
  }

  function renderPast(consultations) {
    if (!pastTableBody) return;

    const past = consultations.filter(c =>
      c.status === 'COMPLETED' || c.status === 'CANCELLED'
    );

    if (past.length === 0) {
      pastTableBody.innerHTML = `
        <tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af;">
          No past consultation history.
        </td></tr>`;
      return;
    }

    pastTableBody.innerHTML = '';
    past.forEach(cons => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><a href="#" class="link-id">${cons.id}</a></td>
        <td>${cons.lawyerName || '—'}</td>
        <td>${cons.caseDescription ? cons.caseDescription.substring(0, 30) + '…' : 'Legal Advice'}</td>
        <td>${cons.date}</td>
        <td>30 min</td>
        <td><span class="status-badge status-${cons.status.toLowerCase()}">${cons.status}</span></td>
        <td><a href="#" class="link-action">View Summary</a></td>`;
      pastTableBody.appendChild(row);
    });
  }

  // ── Main data load ─────────────────────────────────────────────────────────
  async function loadConsultations() {
    showLoading(scheduledGrid);
    showLoading(pastTableBody, 7);

    try {
      const clientId = currentUser.id || currentUser.userId || currentUser.clientId;
      if (!clientId) throw new Error('Could not determine client ID from session.');

      const consultations = await LexFlowAPI.consultations.getMy(clientId, 'client');
      renderScheduled(consultations);
      renderPast(consultations);
    } catch (err) {
      console.error('[ClientDashboard] Failed to load consultations:', err);
      const msg = err.status === 403
        ? 'Access denied. Please log in as a client.'
        : `Could not load consultations: ${err.message}`;
      showError(scheduledGrid, msg);
      showError(pastTableBody, msg, 7);
    }
  }

  // ── Cancel consultation via API ────────────────────────────────────────────
  async function cancelConsultation(id) {
    const btn = document.querySelector(`.btn-cancel[data-id="${id}"]`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Cancelling…';
    }

    try {
      await LexFlowAPI.consultations.cancel(id, 'client');
      showToast('Consultation cancelled successfully.', 'success');
      await loadConsultations(); // refresh
    } catch (err) {
      console.error('[ClientDashboard] Cancel failed:', err);
      showToast(`Failed to cancel: ${err.message}`, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Cancel';
      }
    }
  }

  // ── Details overlay helpers ────────────────────────────────────────────────
  const detailsOverlay = document.getElementById('details-overlay');
  function closeDetailsModal() {
    if (detailsOverlay) detailsOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  ['details-close-btn', 'det-close-footer-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', closeDetailsModal);
  });
  if (detailsOverlay) {
    detailsOverlay.addEventListener('click', e => { if (e.target === detailsOverlay) closeDetailsModal(); });
  }

  async function openDetailsModal(id) {
    if (!detailsOverlay) return;
    // Reset to loading state
    document.getElementById('det-id').textContent = id;
    document.getElementById('det-lawyer').textContent = 'Loading…';
    ['det-firm','det-type','det-fee','det-date','det-time'].forEach(el => {
      document.getElementById(el).textContent = '—';
    });
    document.getElementById('det-status').innerHTML = '—';
    document.getElementById('det-desc').textContent = '—';
    document.getElementById('det-notes-row').style.display = 'none';
    document.getElementById('det-join-btn').style.display = 'none';
    detailsOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
      const cons = await LexFlowAPI.consultations.getById(id, 'client');
      const typeLabel = cons.type ? cons.type.charAt(0).toUpperCase() + cons.type.slice(1) : '—';
      const isJoinable = ['SCHEDULED', 'CONFIRMED', 'IN PROGRESS'].includes(cons.status) && cons.lawyerName;

      document.getElementById('det-id').textContent = cons.id;
      document.getElementById('det-lawyer').textContent = cons.lawyerName || 'Awaiting Assignment';
      document.getElementById('det-firm').textContent = cons.firmName || '—';
      document.getElementById('det-type').textContent = typeLabel;
      document.getElementById('det-fee').textContent = cons.consultationFee || 'Not specified';
      document.getElementById('det-date').textContent = cons.date || '—';
      document.getElementById('det-time').textContent = cons.time || '—';
      document.getElementById('det-status').innerHTML =
        `<span class="badge badge-${cons.status.toLowerCase().replace(' ','-')}">${cons.status}</span>`;
      document.getElementById('det-desc').textContent = cons.caseDescription || '—';

      if (cons.notes) {
        document.getElementById('det-notes').textContent = cons.notes;
        document.getElementById('det-notes-row').style.display = 'flex';
      }
      if (isJoinable) {
        const joinBtn = document.getElementById('det-join-btn');
        joinBtn.style.display = 'inline-flex';
        joinBtn.onclick = () => {
          sessionStorage.setItem('active_cons_id', cons.id);
          window.location.href = 'client-join-consultation-interface.html';
        };
      }
    } catch (err) {
      document.getElementById('det-lawyer').textContent = `Error: ${err.message}`;
    }
  }

  // ── Global click delegation ────────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    const btnJoin    = e.target.closest('.btn-join');
    const btnDetails = e.target.closest('.btn-view-details');
    const btnCancel  = e.target.closest('.btn-cancel');
    const linkAction = e.target.closest('.link-action, .link-id');

    if (btnJoin) {
      const id = btnJoin.dataset.id;
      sessionStorage.setItem('active_cons_id', id);
      window.location.href = 'client-join-consultation-interface.html';
    }

    if (btnDetails) {
      e.preventDefault();
      await openDetailsModal(btnDetails.dataset.id);
    }

    if (btnCancel) {
      const id = btnCancel.dataset.id;
      if (confirm('Are you sure you want to cancel this consultation?')) {
        await cancelConsultation(id);
      }
    }

    if (linkAction) {
      e.preventDefault();
      const row = linkAction.closest('tr');
      if (row) {
        const idCell = row.querySelector('.link-id');
        if (idCell) await openDetailsModal(idCell.textContent.trim());
      }
    }
  });

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  await loadConsultations();
});
