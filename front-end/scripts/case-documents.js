/* ===================================================
   LexFlow — Case Documents
   case-documents.js — Case-centric, Multi-user, Multi-firm, Role-based
   =================================================== */

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

// Persist errors across Live Server reloads so we can always read them
function persistError(msg) {
  try { sessionStorage.setItem('lexflow_last_error', msg); } catch (_) { }
}
function clearPersistedError() {
  try { sessionStorage.removeItem('lexflow_last_error'); } catch (_) { }
}
// Show any error that survived a page refresh
(function showPersistedError() {
  try {
    const msg = sessionStorage.getItem('lexflow_last_error');
    if (msg) {
      clearPersistedError();
      setTimeout(() => {
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#be123c;color:#fff;padding:12px 24px;border-radius:8px;font-size:0.9rem;font-weight:600;z-index:999999;box-shadow:0 4px 16px rgba(0,0,0,0.3);max-width:90vw;word-break:break-word;';
        el.textContent = '⚠ Previous error: ' + msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 8000);
      }, 800);
    }
  } catch (_) { }
})();

const currentUser = safeParse(localStorage.getItem('currentUser'), null);
const userRole =
  (currentUser && currentUser.role) ||
  localStorage.getItem('userRole') ||
  'client';

const CURRENT_USER_EMAIL = (currentUser && currentUser.email) || '';

const urlParams = new URLSearchParams(window.location.search);
const urlCaseId = urlParams.get('caseId');
const CURRENT_CASE_ID = urlCaseId || '1';

(function () {
  "use strict";

  // In-memory activity log — for side panel only (source of truth is backend)
  let activityLog = [];

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .view-toggle svg { cursor: pointer; transition: fill 0.15s; }

    .documents-list {
      width: 100%; display: flex; flex-direction: column;
      background: #fff; border-radius: 12px;
      border: 1px solid var(--border-light);
      box-shadow: 0 2px 6px rgba(0,0,0,0.04); overflow: hidden;
    }
    .doc-list-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1.2fr 1fr 0.8fr 0.8fr 1.5fr;
      padding: 10px 18px; gap: 8px;
      background: var(--bg-table-header);
      border-bottom: 1px solid var(--border-light);
      font-size: 0.68rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--text-secondary);
    }
    .doc-list-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1.2fr 1fr 0.8fr 0.8fr 1.5fr;
      align-items: center; padding: 11px 18px; gap: 8px;
      border-bottom: 1px solid var(--border-light);
      transition: background 0.13s;
    }
    .doc-list-row:last-child { border-bottom: none; }
    .doc-list-row:hover { background: #f8f9fb; }
    .dlc { font-size: 0.82rem; color: var(--text-primary); }
    .dlc-name { display: flex; align-items: center; gap: 10px; }
    .dlc-name span { font-weight: 600; font-size: 0.83rem; word-break: break-all; }
    .dlc-sub { font-size: 0.7rem; color: var(--text-secondary); margin-top: 1px; }
    .doc-icon-sm {
      width: 30px; height: 30px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.6rem; font-weight: 700; flex-shrink: 0; color: #555;
    }
    .doc-icon-sm.green  { background: #e6f9f0; }
    .doc-icon-sm.orange { background: #fff4e6; }
    .doc-icon-sm.blue   { background: #eff6ff; }
    .dlc-secondary { color: var(--text-secondary); }
    .doc-list-actions { display: flex; gap: 4px; flex-wrap: wrap; }
    .doc-list-actions button {
      padding: 5px 9px; font-size: 0.72rem; font-weight: 500;
      border-radius: 5px; border: 1px solid var(--border-light);
      background: #fff; cursor: pointer; color: var(--text-primary);
      transition: background 0.12s;
    }
    .doc-list-actions button:hover { background: var(--bg-table-header); }
    .doc-list-actions button.danger { color: #be123c; border-color: #fecdd3; }
    .doc-list-actions button.danger:hover { background: #fff1f2; }

    .tag { font-size: 0.7rem; padding: 3px 8px; border-radius: 999px; font-weight: 600; }
    .tag.contract   { background: var(--blue-bg);   color: var(--blue-text); }
    .tag.evidence   { background: var(--red-bg);    color: var(--red-text); }
    .tag.order      { background: var(--green-bg);  color: var(--green-text); }
    .tag.proof      { background: var(--orange-bg); color: var(--orange-text); }
    .tag.affidavit  { background: #faf5ff;          color: #7c3aed; }
    .tag.report     { background: #f0fdf4;          color: #166534; }
    .tag.default    { background: #f1f5f9;          color: #475569; }
    .access-badge { font-size: 0.68rem; padding: 3px 8px; border-radius: 999px; font-weight: 600; }
    .access-badge.private { background: #f1f5f9; color: #64748b; }
    .access-badge.shared  { background: var(--green-bg); color: var(--green-text); }

    .lex-dd {
      position: absolute; min-width: 190px; background: #fff;
      border: 1px solid var(--border-light); border-radius: var(--radius-md);
      box-shadow: 0 8px 28px rgba(0,0,0,0.11); z-index: 9999;
      display: none; flex-direction: column; overflow: hidden;
    }
    .lex-dd.open { display: flex; }
    .dd-head {
      padding: 10px 14px 8px; font-size: 0.68rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--text-secondary); border-bottom: 1px solid var(--border-light);
    }
    .dd-row {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 14px; font-size: 0.84rem;
      cursor: pointer; color: var(--text-primary);
      transition: background 0.12s; user-select: none;
    }
    .dd-row:hover { background: var(--bg-table-header); }
    .dd-row.on { font-weight: 600; color: var(--brand-accent); }
    .dd-row input[type="checkbox"] { accent-color: var(--sidebar-bg); width: 14px; height: 14px; }
    .dd-arrow { margin-left: auto; font-size: 0.78rem; color: var(--brand-accent); }
    .dd-foot { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border-light); }
    .dd-foot button { flex: 1; padding: 7px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: none; }
    .dd-clear { background: var(--bg-table-header); color: var(--text-secondary); }
    .dd-apply { background: var(--sidebar-bg); color: #fff; }

    .no-docs { padding: 48px; text-align: center; color: var(--text-secondary); font-size: 0.9rem; }

    .upload-modal.active { display: flex; }
    .upload-modal__drop-icon svg { display: block; margin: 0 auto; }
    .upload-modal__dropzone.drag-over { border-color: var(--brand-accent); background: #eff6ff; }
    .upload-modal__dropzone { cursor: pointer; }
    .file-preview {
      display: flex; align-items: center; gap: 10px;
      margin-top: 12px; padding: 10px 14px;
      background: #f1f5f9; border-radius: 8px;
      font-size: 0.8rem; color: var(--text-primary);
    }
    .file-preview span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-preview button { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 1rem; padding: 0 4px; }
    .file-preview button:hover { color: #be123c; }

    .upload-modal__input[readonly],
    .upload-modal__input:disabled {
      background: #f8f9fb !important;
      color: var(--text-secondary) !important;
      cursor: not-allowed !important;
      border-color: #e2e8f0 !important;
    }

    .view-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      z-index: 10000; display: none; align-items: center; justify-content: center;
    }
    .view-modal-overlay.active { display: flex; }
    .view-modal-box {
      background: #fff; border-radius: 14px;
      width: min(92vw, 900px); max-height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .view-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-bottom: 1px solid var(--border-light); gap: 12px;
    }
    .view-modal-header h3 { font-size: 0.95rem; font-weight: 600; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .view-modal-close {
      background: none; border: none; cursor: pointer;
      font-size: 1.2rem; color: var(--text-secondary);
      padding: 4px 8px; border-radius: 6px; line-height: 1;
    }
    .view-modal-close:hover { background: #f1f5f9; }
    .view-modal-body {
      flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center;
      padding: 20px; background: #f8f9fb;
    }
    .view-modal-body iframe { width: 100%; height: 65vh; border: none; border-radius: 8px; background: #fff; }
    .view-modal-body img { max-width: 100%; max-height: 65vh; border-radius: 8px; object-fit: contain; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .view-modal-footer {
      padding: 12px 20px; border-top: 1px solid var(--border-light);
      display: flex; justify-content: flex-end; gap: 8px;
    }
    .view-modal-footer button {
      padding: 8px 16px; border-radius: 7px; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border-light); background: #fff;
      color: var(--text-primary); transition: background 0.12s;
    }
    .view-modal-footer button:hover { background: var(--bg-table-header); }
    .view-modal-footer button.primary { background: var(--sidebar-bg); color: #fff; border-color: transparent; }
    .view-modal-footer button.primary:hover { opacity: 0.9; }

    .update-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.55);
      z-index: 10000; display: none; align-items: center; justify-content: center;
    }
    .update-modal-overlay.active { display: flex; }
    .update-modal-box {
      background: #fff; border-radius: 14px; width: min(92vw, 520px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;
    }
    .update-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border-light);
    }
    .update-modal-header h3 { margin: 0; font-size: 0.95rem; font-weight: 700; }
    .update-modal-close { background: none; border: none; cursor: pointer; font-size: 1.2rem; color: var(--text-secondary); padding: 4px 8px; border-radius: 6px; }
    .update-modal-close:hover { background: #f1f5f9; }
    .update-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .update-modal-body label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); display: block; margin-bottom: 5px; }
    .update-modal-body input, .update-modal-body select {
      width: 100%; padding: 9px 12px; border: 1px solid var(--border-light); border-radius: 7px;
      font-size: 0.85rem; color: var(--text-primary); background: #fff; box-sizing: border-box;
    }
    .update-modal-body input:focus, .update-modal-body select:focus { outline: none; border-color: var(--brand-accent); }
    .update-meta-note { font-size: 0.75rem; color: var(--text-secondary); background: #f8f9fb; border-radius: 7px; padding: 10px 14px; border-left: 3px solid var(--brand-accent); }
    .update-dropzone { border: 2px dashed var(--border-light); border-radius: 9px; padding: 24px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .update-dropzone:hover, .update-dropzone.drag-over { border-color: var(--brand-accent); background: #eff6ff; }
    .update-dropzone p { margin: 6px 0 0; font-size: 0.8rem; color: var(--text-secondary); }
    .update-dropzone strong { font-size: 0.85rem; color: var(--text-primary); }
    .update-modal-footer { padding: 14px 20px; border-top: 1px solid var(--border-light); display: flex; justify-content: flex-end; gap: 8px; }
    .update-modal-footer button { padding: 9px 18px; border-radius: 7px; font-size: 0.83rem; font-weight: 600; cursor: pointer; border: 1px solid var(--border-light); background: #fff; color: var(--text-primary); }
    .update-modal-footer button:hover { background: var(--bg-table-header); }
    .update-modal-footer button.primary { background: var(--sidebar-bg); color: #fff; border-color: transparent; }
    .update-modal-footer button.primary:hover { opacity: 0.88; }

    .del-confirm-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 10001; display: none; align-items: center; justify-content: center;
    }
    .del-confirm-overlay.active { display: flex; }
    .del-confirm-box {
      background: #fff; border-radius: 12px; width: min(92vw, 400px);
      padding: 28px 28px 22px; box-shadow: 0 16px 48px rgba(0,0,0,0.18); text-align: center;
    }
    .del-confirm-box .del-icon { width: 52px; height: 52px; border-radius: 50%; background: #fff1f2; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
    .del-confirm-box h3 { margin: 0 0 6px; font-size: 1rem; font-weight: 700; }
    .del-confirm-box p { margin: 0 0 22px; font-size: 0.84rem; color: var(--text-secondary); line-height: 1.5; }
    .del-confirm-box .del-name { font-weight: 600; color: var(--text-primary); }
    .del-confirm-actions { display: flex; gap: 10px; justify-content: center; }
    .del-confirm-actions button { flex: 1; padding: 10px; border-radius: 7px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: 1px solid var(--border-light); background: #fff; }
    .del-confirm-actions button.cancel-btn:hover { background: #f1f5f9; }
    .del-confirm-actions button.delete-btn { background: #be123c; color: #fff; border-color: #be123c; }
    .del-confirm-actions button.delete-btn:hover { background: #9f1239; }

    .lex-toast {
      position: fixed; bottom: 24px; right: 24px; padding: 12px 20px;
      border-radius: 8px; font-size: 0.85rem; font-weight: 600; z-index: 99999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15); animation: toast-in 0.25s ease;
    }
    .lex-toast.success { background: #1e2a4a; color: #fff; }
    .lex-toast.error   { background: #be123c; color: #fff; }
    .lex-toast.warn    { background: #92400e; color: #fff; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .no-case-access {
      padding: 60px 24px; text-align: center; background: #fff;
      border-radius: 12px; border: 1px solid #fecdd3; margin: 24px 0;
    }
    .no-case-access h2 { color: #be123c; margin-bottom: 8px; }
    .no-case-access p  { color: #64748b; font-size: 0.9rem; }
    .no-case-access .deny-reason { font-size: 0.78rem; margin-top: 6px; background: #fff1f2; display: inline-block; padding: 4px 12px; border-radius: 999px; color: #9f1239; font-weight: 600; }
  `;
  document.head.appendChild(styleEl);

  const MEMORY_DB = {
    users: [
      { id: 'user-0', name: 'Super Admin', email: 'superadmin@lexflow.test', role: 'superAdmin' },
      { id: 'user-1', name: 'Firm Admin', email: 'firmadmin@lexflow.test', role: 'firmAdmin', firmId: 'firm-1' },
      { id: 'user-2', name: 'Client Alice', email: 'alice@client.test', role: 'client', phone: '+91-9000000001' },
      { id: 'user-3', name: 'Lawyer Bob', email: 'bob@lawyer.test', role: 'lawyer', firmId: 'firm-1' },
      { id: 'user-4', name: 'Intern Charlie', email: 'charlie@intern.test', role: 'intern', firmId: 'firm-1' },
    ],
    firms: [
      { id: 'firm-1', name: 'Sharma & Associates', email: 'contact@sharma.law' },
    ],
    cases: [
      { id: '1', title: 'State vs John Doe', cnr: 'PH010012342024', status: 'Active', clientId: 'user-2', lawyerId: 'user-3', firmId: 'firm-1', court: 'District Court' },
      { id: '2', title: 'Sharma vs Gupta', cnr: 'DL020056782024', status: 'Active', clientId: 'user-2', lawyerId: 'user-3', firmId: 'firm-1', court: 'High Court' },
      { id: '3', title: 'TechCorp vs SoftSystems', cnr: 'MH030099992024', status: 'Pending', clientId: 'user-2', lawyerId: 'user-3', firmId: 'firm-1', court: 'Supreme Court' },
    ]
  };

  async function bootApp() {
    try {
      const users = [...MEMORY_DB.users];
      const localUser = safeParse(localStorage.getItem('currentUser'), null);
      if (localUser && localUser.email) {
        const exists = users.find(u => u.email === localUser.email);
        if (!exists) {
          users.push({
            id: localUser.id || `local-${Date.now()}`,
            name: localUser.fullName || localUser.name || 'Current User',
            email: localUser.email,
            role: localUser.role || userRole,
            firmId: localUser.firmId || null
          });
        }
      }

      const db = {
        users,
        cases: MEMORY_DB.cases,
        documents: [],
        firms: MEMORY_DB.firms,
      };

      await init(db);
    } catch (err) {
      console.error("bootApp() FAILED:", err);
      toast(`Failed to boot: ${err.message}`, "error");
    }
  }

  bootApp();

  async function init(db) {
    let CURRENT_USER = null;
    const localUser = safeParse(localStorage.getItem('currentUser'), null);
    if (localUser && localUser.email) {
      CURRENT_USER = db.users.find(u => u.email === localUser.email);
    }
    if (!CURRENT_USER) {
      CURRENT_USER = db.users.find(u => u.email === CURRENT_USER_EMAIL);
    }
    if (!CURRENT_USER && localUser && localUser.email && localUser.role) {
      CURRENT_USER = {
        id: localUser.id || 'USR-UNKNOWN',
        name: localUser.fullName || localUser.name || localUser.email,
        email: localUser.email,
        role: localUser.role,
        firmId: localUser.firmId || null,
        caseAccess: localUser.caseAccess || {},
      };
    }
    if (!CURRENT_USER) {
      toast(`User "${CURRENT_USER_EMAIL}" not found.`, "error");
      return;
    }
    if (!CURRENT_USER.role) {
      toast(`User profile incomplete: missing role.`, "error");
      return;
    }
    const ROLE = (CURRENT_USER.role || '').toLowerCase();

    const CURRENT_FIRM = CURRENT_USER.firmId
      ? (db.firms.find(f => f.id === CURRENT_USER.firmId) || { id: CURRENT_USER.firmId, name: CURRENT_USER.firmName || CURRENT_USER.firmId })
      : null;
    const FIRM_NAME = CURRENT_FIRM ? CURRENT_FIRM.name : "Independent";

    const breadcrumb = document.querySelector(".breadcrumb");
    if (breadcrumb) {
      breadcrumb.innerHTML = `<a href="documents-main.html" style="color: inherit; text-decoration: none;">Documents</a> > <span>Loading... (${CURRENT_CASE_ID})</span>`;
    }

    const CURRENT_CASE = db.cases.find(c => c.id === CURRENT_CASE_ID);
    if (!CURRENT_CASE) {
      renderAccessDenied(`Case "${CURRENT_CASE_ID}" does not exist.`, "CASE_NOT_FOUND");
      renderRoleBadge(CURRENT_USER, ROLE, FIRM_NAME);
      return;
    }

    if (breadcrumb) {
      breadcrumb.innerHTML = `<a href="documents-main.html" style="color: inherit; text-decoration: none;">Documents</a> > <span>${CURRENT_CASE.title} (${CURRENT_CASE_ID})</span>`;
    }
    const caseTitle = document.querySelector(".case-header h1");
    if (caseTitle) {
      caseTitle.innerHTML = `${CURRENT_CASE.title} <span class="status">${CURRENT_CASE.status}</span>`;
    }
    const caseIdParagraph = document.querySelector(".case-header p");
    if (caseIdParagraph) {
      caseIdParagraph.innerHTML = `Case ID: <strong>${CURRENT_CASE_ID}</strong>`;
    }

    const userHasExplicitCaseAccess = !!(
      CURRENT_USER.caseAccess && CURRENT_USER.caseAccess[CURRENT_CASE_ID]
    );

    if (ROLE !== "client") {
      const caseFromOtherFirm = CURRENT_FIRM && CURRENT_CASE.firmId !== CURRENT_FIRM.id;
      if (caseFromOtherFirm && !userHasExplicitCaseAccess) {
        renderAccessDenied(
          `${CURRENT_CASE_ID} belongs to a different firm and you have not been granted access.`,
          "CROSS_FIRM_VIOLATION"
        );
        renderRoleBadge(CURRENT_USER, ROLE, FIRM_NAME);
        return;
      }
    }

    const caseAccess = CURRENT_USER.caseAccess || [];
    const hasExplicitAccess = Array.isArray(caseAccess)
      ? caseAccess.includes(CURRENT_CASE_ID)
      : !!(caseAccess[CURRENT_CASE_ID]);

    const isFullAccess =
      ROLE === "superadmin" ||
      (ROLE === "firmadmin" && CURRENT_FIRM && CURRENT_CASE.firmId === CURRENT_FIRM.id);

    const isPartyToCase =
      (ROLE === "client" && CURRENT_CASE.clientId === CURRENT_USER.id) ||
      (ROLE === "lawyer" && CURRENT_CASE.lawyerId === CURRENT_USER.id) ||
      (ROLE === "intern" && CURRENT_CASE.firmId === CURRENT_USER.firmId);

    if (!isFullAccess && !isPartyToCase && !hasExplicitAccess) {
      renderAccessDenied(
        `You do not have access to Case ${CURRENT_CASE_ID}. Contact your firm administrator to request access.`,
        "NO_DOC_ACCESS"
      );
      renderRoleBadge(CURRENT_USER, ROLE, FIRM_NAME);
      return;
    }

    const allowedIds = (isFullAccess || isPartyToCase)
      ? null
      : new Set(Array.isArray(caseAccess) ? [] : (caseAccess[CURRENT_CASE_ID] || []));

    let docsData = [];
    try {
      const resp = await fetch(`http://localhost:3000/documents?caseId=${CURRENT_CASE_ID}`, {
        headers: {
          'role': ROLE,
          'x-user-email': CURRENT_USER_EMAIL,
        }
      });
      if (resp.ok) {
        const allDocs = await resp.json();
        docsData = allowedIds === null
          ? allDocs
          : allDocs.filter(d => allowedIds.has(d.id) || d.uploaderEmail === CURRENT_USER_EMAIL);
      } else {
        console.error("Failed to fetch documents from backend", resp.status, await resp.text());
        toast(`Failed to load documents (HTTP ${resp.status})`, "error");
      }
    } catch (e) {
      console.error("Backend fetch error", e);
      toast("Cannot reach backend — is the server running?", "error");
    }

    // ── Load recent activity for side panel from backend ──────────────────
    try {
      const actResp = await fetch(`http://localhost:3000/documents/activity?caseId=${CURRENT_CASE_ID}`, {
        headers: { 'role': ROLE, 'x-user-email': CURRENT_USER.email }
      });
      if (actResp.ok) {
        activityLog = await actResp.json();
      }
    } catch (e) {
      console.warn("[ActivityLog] Could not load activity from backend:", e);
    }

    const PERMS = {
      canView: true,
      canDownload: true,
      canUpload: ["client", "lawyer", "firmadmin", "lawfirm_admin"].includes(ROLE),
      canUpdate: ["lawyer", "firmadmin", "lawfirm_admin", "intern"].includes(ROLE),
      canDelete: ["lawyer", "firmadmin", "lawfirm_admin"].includes(ROLE),
    };

    // ── logActivity: posts to backend, keeps local copy for side panel ────
    async function logActivity(action, doc) {
      const entry = {
        user: CURRENT_USER.name,
        email: CURRENT_USER.email,
        role: ROLE,
        firmId: CURRENT_USER.firmId || null,
        caseId: CURRENT_CASE_ID,
        action,
        docId: doc.id,
        docName: doc.name,
        docType: doc.type,
        access: doc.access,
      };

      // Optimistically update local array so side panel reflects immediately
      activityLog.unshift({ ...entry, id: "ACT-" + Date.now(), date: new Date().toISOString() });
      if (activityLog.length > 100) activityLog = activityLog.slice(0, 100);
      refreshSidePanelActivity();

      // Persist to backend — no localStorage involved
      try {
        await fetch("http://localhost:3000/documents/activity", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "role": ROLE,
            "x-user-email": CURRENT_USER.email,
          },
          body: JSON.stringify(entry),
        });
      } catch (e) {
        console.warn("[ActivityLog] Failed to persist activity to backend:", e);
      }
    }

    renderRoleBadge(CURRENT_USER, ROLE, FIRM_NAME);

    const grid = document.querySelector(".documents-grid");
    const searchInput = document.querySelector(".search-box input");
    const typeSelect = document.querySelector(".toolbar select");
    const totalEl = document.querySelector(".total");
    const viewIcons = document.querySelectorAll(".view-toggle svg");
    const filterIcon = viewIcons[0];
    const sortIcon = viewIcons[1];
    const gridIcon = viewIcons[2];
    const listIcon = viewIcons[3];
    const uploadBtn = document.querySelector(".btn-primary");
    const modal = document.querySelector(".upload-modal");

    if (!grid || !searchInput || !typeSelect || !totalEl || !uploadBtn || !modal) {
      toast("Page structure error — required elements not found.", "error");
      return;
    }

    const metaDivs = document.querySelectorAll(".case-meta > div");
    if (metaDivs.length >= 4) {
      const caseLayer = db.users.find(u => u.id === CURRENT_CASE.lawyerId);
      const caseClient = db.users.find(u => u.id === CURRENT_CASE.clientId);
      metaDivs[0].innerHTML = `<span>CLIENT ID</span>${CURRENT_CASE.clientId || "—"}`;
      metaDivs[1].innerHTML = `<span>CLIENT NAME</span>${caseClient ? caseClient.name : "—"}`;
      metaDivs[2].innerHTML = `<span>LAWYER</span>${caseLayer ? caseLayer.name : "—"}`;
      metaDivs[3].innerHTML = `<span>COURT</span>${CURRENT_CASE.court}`;
    }

    const uiState = {
      view: "grid",
      search: "",
      sortKey: "date",
      sortDir: "desc",
      typeFilter: "All Types",
    };
    let activeAccess = [];

    function tagClass(type) {
      const map = {
        "CONTRACT": "contract",
        "CASE EVIDENCE": "evidence",
        "COURT ORDER": "order",
        "CLIENT PROOF": "proof",
        "AFFIDAVIT": "affidavit",
        "REPORT": "report"
      };
      return map[(type || "").toUpperCase()] || "default";
    }
    function tagClassLegacy(type) {
      const map = { "CONTRACT": "", "CASE EVIDENCE": "red", "COURT ORDER": "green", "CLIENT PROOF": "red" };
      return map[(type || "").toUpperCase()] ?? "";
    }
    function fmtDate(iso) {
      if (!iso) return "—";
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    function isImage(name) {
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name || "");
    }
    function sanitize(str) {
      const d = document.createElement("div");
      d.textContent = str || "";
      return d.innerHTML;
    }
    function refreshTypeSelect() {
      const allTypes = [...new Set(docsData.map(d => d.type).filter(Boolean))].sort();
      typeSelect.innerHTML = `<option>All Types</option>` +
        allTypes.map(t => `<option>${sanitize(t)}</option>`).join("");
    }

    function buildCard(d) {
      const el = document.createElement("div");
      el.className = "doc-card";
      el.innerHTML = `
        <div class="doc-header">
          <div class="doc-icon ${sanitize(d.iconColor || "green")}">${sanitize(d.fileType || "FILE")}</div>
          <div>
            <h3>${sanitize(d.name)}</h3>
            <div class="tags">
              <span>${sanitize(d.id)}</span>
              <span class="${tagClassLegacy(d.type)}">${sanitize(d.type)}</span>
            </div>
          </div>
          <span class="badge ${d.access === 'SHARED' ? 'green' : ''}">${sanitize(d.access)}</span>
        </div>
        <div class="doc-meta">
          <div><span>UPLOADER</span>${sanitize(d.uploader)}</div>
          <div><span>DATE</span>${fmtDate(d.date)}</div>
          <div><span>VERSION</span>v${sanitize(String(d.version ?? 1))}</div>
        </div>
        <div class="doc-actions">
          <button data-action="view">View</button>
          <button data-action="download">Download</button>
          ${PERMS.canUpdate ? `<button data-action="update">Update</button>` : ""}
          ${PERMS.canDelete ? `<button data-action="delete">Delete</button>` : ""}
        </div>`;
      bindCardActions(el, d);
      return el;
    }

    function buildRow(d) {
      const el = document.createElement("div");
      el.className = "doc-list-row";
      el.innerHTML = `
        <div class="dlc dlc-name">
          <div class="doc-icon-sm ${sanitize(d.iconColor || "green")}">${sanitize(d.fileType || "FILE")}</div>
          <div>
            <div>${sanitize(d.name)}</div>
            <div class="dlc-sub">${sanitize(d.id)}</div>
          </div>
        </div>
        <div class="dlc"><span class="tag ${tagClass(d.type)}">${sanitize(d.type)}</span></div>
        <div class="dlc dlc-secondary">${sanitize(d.uploader)}</div>
        <div class="dlc dlc-secondary">${fmtDate(d.date)}</div>
        <div class="dlc dlc-secondary">v${sanitize(String(d.version ?? 1))}</div>
        <div class="dlc"><span class="access-badge ${(d.access || "").toLowerCase()}">${sanitize(d.access)}</span></div>
        <div class="dlc doc-list-actions">
          <button data-action="view">View</button>
          <button data-action="download">Download</button>
          ${PERMS.canUpdate ? `<button data-action="update">Update</button>` : ""}
          ${PERMS.canDelete ? `<button data-action="delete" class="danger">Delete</button>` : ""}
        </div>`;
      bindCardActions(el, d);
      return el;
    }

    function bindCardActions(el, d) {
      el.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
          switch (btn.dataset.action) {
            case "view": openViewModal(d); break;
            case "download": downloadDoc(d); break;
            case "update":
              if (!PERMS.canUpdate) { toast("You do not have permission to update documents.", "error"); return; }
              openUpdateModal(d);
              break;
            case "delete":
              if (!PERMS.canDelete) { toast("You do not have permission to delete documents.", "error"); return; }
              openDeleteConfirm(d);
              break;
          }
        });
      });
    }

    // View Modal
    const viewOverlay = document.createElement("div");
    viewOverlay.className = "view-modal-overlay";
    viewOverlay.innerHTML = `
      <div class="view-modal-box">
        <div class="view-modal-header">
          <h3 class="vm-title"></h3>
          <button class="view-modal-close">✕</button>
        </div>
        <div class="view-modal-body vm-body"></div>
        <div class="view-modal-footer">
          <button class="vm-dl-btn primary">⬇ Download</button>
          <button class="vm-close-btn">Close</button>
        </div>
      </div>`;
    document.body.appendChild(viewOverlay);
    viewOverlay.querySelector(".view-modal-close").addEventListener("click", closeViewModal);
    viewOverlay.querySelector(".vm-close-btn").addEventListener("click", closeViewModal);
    viewOverlay.addEventListener("click", e => { if (e.target === viewOverlay) closeViewModal(); });

    let _currentViewDoc = null;
    viewOverlay.querySelector(".vm-dl-btn").addEventListener("click", () => {
      if (_currentViewDoc) downloadDoc(_currentViewDoc);
    });

    function openViewModal(d) {
      _currentViewDoc = d;
      viewOverlay.querySelector(".vm-title").textContent = `${d.name}  ·  ${d.id}  ·  v${d.version ?? 1}`;
      const body = viewOverlay.querySelector(".vm-body");
      body.innerHTML = "";
      const src = d.blobUrl || d.filePath;
      if (!src) {
        body.innerHTML = `<p style="color:#64748b;font-size:0.9rem">No file available to preview.</p>`;
      } else if (isImage(d.name)) {
        const img = document.createElement("img");
        img.src = src; img.alt = d.name;
        body.appendChild(img);
      } else {
        const iframe = document.createElement("iframe");
        iframe.src = src;
        body.appendChild(iframe);
      }
      viewOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
      logActivity("viewed", d);
    }

    function closeViewModal() {
      viewOverlay.classList.remove("active");
      document.body.style.overflow = "";
      _currentViewDoc = null;
    }

    function downloadDoc(d) {
      const src = d.blobUrl || d.filePath;
      if (!src) { toast("No file available for download.", "warn"); return; }
      const a = document.createElement("a");
      a.href = src;
      a.download = d.name || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast(`⬇ Downloading ${d.name}`);
      logActivity("downloaded", d);
    }

    // Delete Modal
    const delOverlay = document.createElement("div");
    delOverlay.className = "del-confirm-overlay";
    delOverlay.innerHTML = `
      <div class="del-confirm-box">
        <div class="del-icon">🗑️</div>
        <h3>Delete Document?</h3>
        <p>You are about to delete <span class="del-name"></span>.<br>This action cannot be undone.</p>
        <div class="del-confirm-actions">
          <button class="cancel-btn">Cancel</button>
          <button class="delete-btn">Yes, Delete</button>
        </div>
      </div>`;
    document.body.appendChild(delOverlay);
    delOverlay.querySelector(".cancel-btn").addEventListener("click", () => {
      delOverlay.classList.remove("active");
      _pendingDeleteId = null;
    });

    let _pendingDeleteId = null;
    delOverlay.querySelector(".delete-btn").addEventListener("click", async () => {
      const idx = docsData.findIndex(d => d.id === _pendingDeleteId);
      if (idx !== -1) {
        const doc = docsData[idx];
        if (!PERMS.canDelete) {
          toast("You do not have permission to delete documents.", "error");
          delOverlay.classList.remove("active"); _pendingDeleteId = null; return;
        }

        try {
          const resp = await fetch(`http://localhost:3000/documents/${doc.id}`, {
            method: "DELETE",
            headers: {
              "role": ROLE,
              "x-user-email": CURRENT_USER_EMAIL
            }
          });

          if (!resp.ok) {
            toast("Delete failed", "error");
            delOverlay.classList.remove("active"); _pendingDeleteId = null; return;
          }

          if (doc.blobUrl) { try { URL.revokeObjectURL(doc.blobUrl); } catch (_) { } }
          await logActivity("deleted", doc);
          docsData.splice(idx, 1);
          render();
          toast(`🗑 ${doc.name} deleted`);
        } catch (e) {
          console.error(e);
          toast("Delete request failed", "error");
        }
      }
      delOverlay.classList.remove("active");
      _pendingDeleteId = null;
    });

    function openDeleteConfirm(d) {
      _pendingDeleteId = d.id;
      delOverlay.querySelector(".del-name").textContent = `"${d.name}"`;
      delOverlay.classList.add("active");
    }

    // Update Modal
    const updateOverlay = document.createElement("div");
    updateOverlay.className = "update-modal-overlay";
    updateOverlay.innerHTML = `
      <div class="update-modal-box">
        <div class="update-modal-header">
          <h3>Update Document</h3>
          <button class="update-modal-close">✕</button>
        </div>
        <div class="update-modal-body">
          <div>
            <label>Document Name</label>
            <input class="upd-name" type="text" maxlength="255">
          </div>
          <div>
            <label>Access Level</label>
            <select class="upd-access">
              <option value="PRIVATE">PRIVATE</option>
              <option value="SHARED">SHARED</option>
            </select>
          </div>
          <div class="update-meta-note">
            Current version: <strong class="upd-version-label"></strong> — uploading a new file will bump the version automatically.
          </div>
          <div class="update-dropzone" id="update-dz">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <strong>Drop a new file here or click to browse</strong>
            <p>Leave empty to keep the existing file</p>
          </div>
          <div class="upd-file-preview" style="display:none"></div>
        </div>
        <div class="update-modal-footer">
          <button class="upd-cancel">Cancel</button>
          <button class="upd-save primary">Save Changes</button>
        </div>
      </div>`;
    document.body.appendChild(updateOverlay);

    const updDZ = updateOverlay.querySelector("#update-dz");
    const updPreview = updateOverlay.querySelector(".upd-file-preview");
    let _updDoc = null, _updFile = null;

    [updateOverlay.querySelector(".update-modal-close"), updateOverlay.querySelector(".upd-cancel")]
      .forEach(btn => btn.addEventListener("click", closeUpdateModal));
    updateOverlay.addEventListener("click", e => { if (e.target === updateOverlay) closeUpdateModal(); });

    updDZ.addEventListener("dragover", e => { e.preventDefault(); updDZ.classList.add("drag-over"); });
    updDZ.addEventListener("dragleave", () => updDZ.classList.remove("drag-over"));
    updDZ.addEventListener("drop", e => {
      e.preventDefault(); updDZ.classList.remove("drag-over");
      if (e.dataTransfer.files[0]) setUpdFile(e.dataTransfer.files[0]);
    });
    updDZ.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".pdf,.docx,.jpg,.jpeg,.png";
      inp.onchange = e => { if (e.target.files[0]) setUpdFile(e.target.files[0]); };
      inp.click();
    });

    function setUpdFile(file) {
      if (file.size > 10 * 1024 * 1024) { toast("File exceeds 10 MB limit.", "error"); return; }
      _updFile = file;
      updDZ.style.borderColor = "";
      updDZ.style.background = "";
      updPreview.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f1f5f9;border-radius:8px;font-size:0.8rem;";
      updPreview.innerHTML = `
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ${sanitize(file.name)}</span>
        <small style="color:#64748b">${(file.size / 1024).toFixed(1)} KB</small>
        <button id="upd-rm" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#64748b">✕</button>`;
      updPreview.querySelector("#upd-rm").addEventListener("click", e => {
        e.stopPropagation(); _updFile = null;
        updPreview.style.display = "none"; updPreview.innerHTML = "";
      });
    }

    function openUpdateModal(d) {
      _updDoc = d; _updFile = null;
      updPreview.style.display = "none"; updPreview.innerHTML = "";
      updateOverlay.querySelector(".upd-name").value = d.name;
      updateOverlay.querySelector(".upd-access").value = d.access || "PRIVATE";
      updateOverlay.querySelector(".upd-version-label").textContent = `v${d.version ?? 1}`;
      updDZ.style.borderColor = "";
      updateOverlay.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    function closeUpdateModal() {
      updateOverlay.classList.remove("active");
      document.body.style.overflow = "";
      _updDoc = _updFile = null;
    }

    const updSaveBtn = updateOverlay.querySelector(".upd-save");
    updSaveBtn.setAttribute('type', 'button');
    updSaveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!_updDoc) return;
      if (!PERMS.canUpdate) { toast("You do not have permission to update documents.", "error"); return; }
      const newName = updateOverlay.querySelector(".upd-name").value.trim();
      const newAccess = updateOverlay.querySelector(".upd-access").value;
      if (!newName) { toast("Document name cannot be empty.", "error"); return; }

      if (!_updFile) {
        updDZ.style.borderColor = "#be123c";
        updDZ.style.background = "#fff1f2";
        toast("Please upload a new file to proceed.", "error");
        return;
      }

      if (_updDoc.blobUrl) { try { URL.revokeObjectURL(_updDoc.blobUrl); } catch (_) { } }
      const patchFormData = new FormData();
      patchFormData.append('name', newName);
      patchFormData.append('access', newAccess);
      patchFormData.append('version', (_updDoc.version || 1) + 1);
      patchFormData.append('file', _updFile);

      updSaveBtn.disabled = true;
      const origText = updSaveBtn.textContent;
      updSaveBtn.textContent = 'Saving...';

      try {
        const resp = await fetch(`http://localhost:3000/documents/${_updDoc.id}`, {
          method: "PATCH",
          headers: {
            "role": ROLE,
            "x-user-email": CURRENT_USER_EMAIL
          },
          body: patchFormData
        });

        if (!resp.ok) {
          let errMsg = `Update failed (HTTP ${resp.status})`;
          try { const errBody = await resp.json(); errMsg += `: ${errBody.message || JSON.stringify(errBody)}`; } catch (_) { }
          toast(errMsg, "error");
          updSaveBtn.disabled = false;
          updSaveBtn.textContent = origText;
          return;
        }
        const updatedDoc = await resp.json();
        updatedDoc.blobUrl = URL.createObjectURL(_updFile);
        updatedDoc.fileType = (_updFile.name.split(".").pop() || "BIN").toUpperCase().slice(0, 3);

        Object.assign(_updDoc, updatedDoc);
        await logActivity("updated", _updDoc);
        closeUpdateModal();
        render();
        toast(`✓ ${_updDoc.name} updated to v${_updDoc.version ?? 1}`);
      } catch (e) {
        console.error('Update error:', e);
        toast(`Update failed: ${e.message}`, "error");
        updSaveBtn.disabled = false;
        updSaveBtn.textContent = origText;
      }
    });

    // Sort Dropdown
    const sortOpts = [
      { key: "name", label: "File Name" },
      { key: "uploader", label: "Uploader" },
    ];
    const sortDD = document.createElement("div");
    sortDD.className = "lex-dd";
    sortDD.innerHTML = `
      <div class="dd-head">Sort by</div>
      ${sortOpts.map(o =>
        `<div class="dd-row sort-opt ${uiState.sortKey === o.key ? "on" : ""}" data-key="${o.key}">
          ${o.label}<span class="dd-arrow">${uiState.sortKey === o.key ? (uiState.sortDir === "asc" ? "↑" : "↓") : ""}</span>
         </div>`).join("")}`;
    document.body.appendChild(sortDD);

    sortDD.querySelectorAll(".sort-opt").forEach(item => {
      item.addEventListener("click", () => {
        const key = item.dataset.key;
        uiState.sortDir = uiState.sortKey === key ? (uiState.sortDir === "asc" ? "desc" : "asc") : "asc";
        uiState.sortKey = key;
        sortDD.querySelectorAll(".sort-opt").forEach(el => {
          el.classList.toggle("on", el.dataset.key === uiState.sortKey);
          el.querySelector(".dd-arrow").textContent =
            el.dataset.key === uiState.sortKey ? (uiState.sortDir === "asc" ? "↑" : "↓") : "";
        });
        sortIcon.style.fill = "var(--brand-accent)";
        render();
      });
    });

    // Filter Dropdown
    const filterDD = document.createElement("div");
    filterDD.className = "lex-dd";
    filterDD.innerHTML = `
      <div class="dd-head">Filter by Access</div>
      ${["PRIVATE", "SHARED"].map(s =>
        `<label class="dd-row"><input type="checkbox" class="fcb" value="${s}"> ${s}</label>`
      ).join("")}
      <div class="dd-foot">
        <button class="dd-clear">Clear</button>
        <button class="dd-apply">Apply</button>
      </div>`;
    document.body.appendChild(filterDD);

    filterDD.querySelector(".dd-clear").addEventListener("click", () => {
      filterDD.querySelectorAll(".fcb").forEach(cb => cb.checked = false);
      activeAccess = [];
      filterIcon.style.fill = "var(--text-secondary)";
      render();
    });
    filterDD.querySelector(".dd-apply").addEventListener("click", () => {
      activeAccess = [...filterDD.querySelectorAll(".fcb:checked")].map(cb => cb.value);
      filterIcon.style.fill = activeAccess.length ? "var(--brand-accent)" : "var(--text-secondary)";
      render();
      closeAll();
    });

    function render() {
      let data = [...docsData];
      if (ROLE === "intern") data = data.filter(d => d.access === "SHARED");
      const q = uiState.search.toLowerCase().trim();
      if (q) data = data.filter(d =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.id || "").toLowerCase().includes(q) ||
        (d.type || "").toLowerCase().includes(q)
      );
      if (uiState.typeFilter !== "All Types") data = data.filter(d => d.type === uiState.typeFilter);
      if (activeAccess.length) data = data.filter(d => activeAccess.includes(d.access));

      data.sort((a, b) => {
        let va, vb;
        if (uiState.sortKey === "date") {
          va = new Date(a.date || 0).getTime();
          vb = new Date(b.date || 0).getTime();
        } else {
          va = (a[uiState.sortKey] || "").toLowerCase();
          vb = (b[uiState.sortKey] || "").toLowerCase();
        }
        if (va < vb) return uiState.sortDir === "asc" ? -1 : 1;
        if (va > vb) return uiState.sortDir === "asc" ? 1 : -1;
        return 0;
      });

      totalEl.textContent = `Total Documents: ${data.length}`;
      grid.innerHTML = "";
      grid.className = uiState.view === "grid" ? "documents-grid" : "documents-list";

      if (!data.length) {
        const msg = ROLE === "intern" && docsData.length > 0
          ? "No shared documents are available for you in this case yet."
          : "No documents match your criteria.";
        grid.innerHTML = `<p class="no-docs">${msg}</p>`;
        return;
      }

      if (uiState.view === "list") {
        const hdr = document.createElement("div");
        hdr.className = "doc-list-header";
        hdr.innerHTML = `<span>Document</span><span>Type</span><span>Uploader</span>
                         <span>Date</span><span>Version</span><span>Access</span><span>Actions</span>`;
        grid.appendChild(hdr);
      }

      data.forEach(d => grid.appendChild(uiState.view === "grid" ? buildCard(d) : buildRow(d)));
    }

    function openDD(dd, anchor) {
      const isOpen = dd.classList.contains("open");
      closeAll();
      if (isOpen) return;
      dd.classList.add("open");
      requestAnimationFrame(() => {
        const rect = anchor.getBoundingClientRect();
        dd.style.top = (rect.bottom + window.scrollY + 8) + "px";
        dd.style.left = Math.max(4, rect.right + window.scrollX - dd.offsetWidth) + "px";
      });
    }
    function closeAll() {
      sortDD.classList.remove("open");
      filterDD.classList.remove("open");
    }

    function syncViewIcons() {
      gridIcon.style.fill = uiState.view === "grid" ? "var(--brand-accent)" : "var(--text-secondary)";
      listIcon.style.fill = uiState.view === "list" ? "var(--brand-accent)" : "var(--text-secondary)";
    }

    searchInput.addEventListener("input", e => { uiState.search = e.target.value; render(); });
    typeSelect.addEventListener("change", e => { uiState.typeFilter = e.target.value; render(); });
    if (filterIcon) filterIcon.addEventListener("click", e => { e.stopPropagation(); openDD(filterDD, filterIcon); });
    if (sortIcon) sortIcon.addEventListener("click", e => { e.stopPropagation(); openDD(sortDD, sortIcon); });
    if (gridIcon) gridIcon.addEventListener("click", () => { uiState.view = "grid"; render(); syncViewIcons(); });
    if (listIcon) listIcon.addEventListener("click", () => { uiState.view = "list"; render(); syncViewIcons(); });
    sortDD.addEventListener("click", e => e.stopPropagation());
    filterDD.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", closeAll);

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      closeViewModal();
      closeUpdateModal();
      if (delOverlay.classList.contains("active")) {
        delOverlay.classList.remove("active"); _pendingDeleteId = null;
      }
      closeAll();
    });

    // ─── UPLOAD MODAL ───────────────────────────────────────────
    let selectedFile = null;

    if (!PERMS.canUpload) {
      uploadBtn.disabled = true;
      uploadBtn.title = "Your role cannot upload documents";
      uploadBtn.style.opacity = "0.5";
      uploadBtn.style.cursor = "not-allowed";
    } else {
      uploadBtn.addEventListener("click", openModal);
    }

    const closeBtn = modal.querySelector(".upload-modal__close");
    const cancelBtn = modal.querySelector(".upload-modal__btn--ghost");
    const submitBtn = modal.querySelector(".upload-modal__btn--primary");
    const dropzone = modal.querySelector(".upload-modal__dropzone");
    const dropText = modal.querySelector(".upload-modal__drop-text");

    const caseClientEl = db.users.find(u => u.id === CURRENT_CASE.clientId);
    const clientNameInModal = modal.querySelectorAll('input[type="text"]')[0];
    const caseIdInModal = modal.querySelectorAll('input[type="text"]')[1];

    if (clientNameInModal) {
      clientNameInModal.value = caseClientEl ? caseClientEl.name : (CURRENT_USER.role === 'client' ? CURRENT_USER.name : '');
      clientNameInModal.readOnly = true;
    }
    if (caseIdInModal) {
      caseIdInModal.value = CURRENT_CASE_ID;
      caseIdInModal.readOnly = true;
    }

    const allSelects = modal.querySelectorAll("select");
    if (allSelects[1]) {
      allSelects[1].disabled = true;
    }

    const descField = modal.querySelector(".upload-modal__textarea");
    if (descField && descField.parentElement) {
      const uploaderInfo = document.createElement("div");
      uploaderInfo.className = "upload-modal__field upload-modal__field--full";
      uploaderInfo.innerHTML = `
        <label class="upload-modal__label">Uploaded By</label>
        <div class="upload-modal__input-wrapper">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
            <path fill="none" d="M0 0h24v24H0V0z"></path>
            <path d="M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c2.7 0 5.8 1.29 6 2H6c.23-.72 3.31-2 6-2m0-12C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
          </svg>
          <input class="upload-modal__input" type="text" value="${sanitize(CURRENT_USER.name)} (${sanitize(ROLE)})" readonly>
        </div>`;
      const bodyEl = modal.querySelector(".upload-modal__body");
      const descParent = descField.closest(".upload-modal__field");
      if (bodyEl && descParent) {
        bodyEl.insertBefore(uploaderInfo, descParent);
      }
    }

    function openModal() { modal.classList.add("active"); document.body.style.overflow = "hidden"; }
    function closeModal() { modal.classList.remove("active"); document.body.style.overflow = ""; resetFile(); }

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

    if (dropzone) {
      dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
      dropzone.addEventListener("drop", e => {
        e.preventDefault(); dropzone.classList.remove("drag-over");
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });
      dropzone.addEventListener("click", () => {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = ".pdf,.docx,.jpg,.jpeg,.png";
        inp.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
        inp.click();
      });
    }

    function handleFile(file) {
      if (file.size > 10 * 1024 * 1024) { toast("File exceeds 10 MB limit.", "error"); return; }
      selectedFile = file;
      const existing = dropzone ? dropzone.querySelector(".file-preview") : null;
      if (existing) existing.remove();
      if (dropzone) {
        const preview = document.createElement("div");
        preview.className = "file-preview";
        preview.innerHTML = `
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span title="${sanitize(file.name)}">${sanitize(file.name)}</span>
          <small>${(file.size / 1024).toFixed(1)} KB</small>
          <button title="Remove">✕</button>`;
        preview.querySelector("button").addEventListener("click", e => { e.stopPropagation(); resetFile(); });
        dropzone.appendChild(preview);
      }
      if (dropText) dropText.textContent = "File selected";
    }

    function resetFile() {
      selectedFile = null;
      if (dropzone) { const p = dropzone.querySelector(".file-preview"); if (p) p.remove(); }
      if (dropText) dropText.textContent = "Drag & Drop Files Here or Click to Upload";
    }

    if (submitBtn) {
      submitBtn.setAttribute('type', 'button');
      submitBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!selectedFile) { toast("Please select a file to upload.", "error"); return; }

        const typeVal = allSelects[0] ? allSelects[0].value : "CONTRACT";
        const fileExt = (selectedFile.name.split(".").pop() || "BIN").toUpperCase().slice(0, 3);

        const formData = new FormData();
        formData.append('name', selectedFile.name);
        formData.append('caseId', CURRENT_CASE_ID);
        formData.append('type', typeVal.toUpperCase());
        formData.append('fileType', fileExt);
        formData.append('access', "PRIVATE");
        formData.append('version', 1);
        formData.append('file', selectedFile);

        submitBtn.disabled = true;
        const origText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading...';

        try {
          const resp = await fetch("http://localhost:3000/documents", {
            method: "POST",
            headers: {
              "role": ROLE,
              "x-user-email": CURRENT_USER_EMAIL
            },
            body: formData
          });

          if (!resp.ok) {
            let errMsg = `Upload failed (HTTP ${resp.status})`;
            try { const errBody = await resp.json(); errMsg += `: ${errBody.message || JSON.stringify(errBody)}`; } catch (_) { }
            toast(errMsg, "error");
            persistError(errMsg);
            submitBtn.disabled = false;
            submitBtn.textContent = origText;
            return;
          }
          const createdDoc = await resp.json();
          const uploadedFileName = selectedFile.name;
          createdDoc.blobUrl = URL.createObjectURL(selectedFile);

          docsData.unshift(createdDoc);
          await logActivity("uploaded", createdDoc);

          closeModal();
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
          refreshTypeSelect();
          render();
          toast(`✓ ${uploadedFileName} uploaded successfully`);
        } catch (e) {
          const errMsg = `Upload failed: ${e.message}`;
          console.error('Upload error:', e);
          persistError(errMsg);
          toast(errMsg, "error");
          submitBtn.disabled = false;
          submitBtn.textContent = origText;
        }
      });
    }

    // ── Activity side panel — reads from local activityLog (populated from backend on load) ──
    function refreshSidePanelActivity() {
      const cardEl = document.querySelector(".card");
      if (!cardEl) return;

      cardEl.querySelectorAll(".activity").forEach(el => el.remove());

      const insertBefore = cardEl.querySelector(".btn-outline");

      const latest = activityLog.filter(e =>
        e.caseId === CURRENT_CASE_ID &&
        (!e.firmId || !CURRENT_USER.firmId || e.firmId === CURRENT_USER.firmId)
      ).slice(0, 2);

      if (latest.length === 0) {
        const div = document.createElement("div");
        div.className = "activity";
        div.innerHTML = `<p style="color:var(--text-secondary);font-size:0.8rem;">No activity yet for this case.</p><span></span>`;
        if (insertBefore) cardEl.insertBefore(div, insertBefore);
        else cardEl.appendChild(div);
      } else {
        latest.forEach(entry => {
          const div = document.createElement("div");
          div.className = "activity";
          div.innerHTML = `
            <p><strong>${sanitize(entry.user)}</strong> ${sanitize(entry.action)} <em>${sanitize(entry.docName)}</em></p>
            <span>${fmtDate(entry.date)}</span>`;
          if (insertBefore) cardEl.insertBefore(div, insertBefore);
          else cardEl.appendChild(div);
        });
      }

      if (ROLE === "client") {
        const viewAllBtn = cardEl.querySelector(".btn-outline");
        if (viewAllBtn) viewAllBtn.style.display = "none";
      }
    }

    // Boot
    refreshTypeSelect();
    syncViewIcons();
    render();
    refreshSidePanelActivity();

  } // end init()

  function renderAccessDenied(reason, code) {
    const grid = document.querySelector(".documents-grid");
    if (grid) {
      grid.innerHTML = `
        <div class="no-case-access">
          <h2>🔒 Access Denied</h2>
          <p>${reason}</p>
          <span class="deny-reason">Code: ${code}</span>
        </div>`;
    }
  }

  function renderRoleBadge(user, role, firmName) {
    const existing = document.getElementById("lex-role-badge");
    if (existing) existing.remove();
    const roleColors = {
      lawyer: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
      intern: { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
      client: { bg: "#fefce8", color: "#854d0e", border: "#fde68a" },
      lawfirm_admin: { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
    };
    const rc = roleColors[role] || roleColors.lawyer;
    const badge = document.createElement("div");
    badge.id = "lex-role-badge";
    badge.style.cssText = `
      position:fixed; top:16px; right:16px;
      background:${rc.bg}; color:${rc.color}; border:1px solid ${rc.border};
      padding:6px 14px; border-radius:999px;
      font-size:0.78rem; font-weight:700; letter-spacing:0.04em;
      z-index:9998; text-transform:uppercase;
      box-shadow:0 2px 8px rgba(0,0,0,0.08); max-width: 420px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;
    const firm = firmName ? ` · ${firmName}` : "";
    badge.textContent = `👤 ${user.name} · ${role.replace("_", " ").toUpperCase()}${firm} · ${CURRENT_CASE_ID}`;
    badge.title = badge.textContent;
    document.body.appendChild(badge);
  }

  function toast(msg, type = "success") {
    const t = document.createElement("div");
    t.className = `lex-toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3200);
  }

})();
