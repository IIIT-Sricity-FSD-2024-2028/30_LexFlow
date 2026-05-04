/* ===================================================
   LexFlow — Document Management
   documents-main.js — Search, Filter, Sort, View Toggle
   =================================================== */

(function () {
  "use strict";

  console.log('LexFlow: documents-main.js v2.0 (In-Memory) initialized');


  let casesData = [];

  const state = {
    view: "grid",
    search: "",
    sortKey: "client",
    sortDir: "asc",
    activeFilters: [],
  };

  const grid        = document.querySelector(".cases-grid");
  const searchInput = document.querySelector(".search-wrapper input");
  const icons       = document.querySelectorAll(".section-actions svg");
  const iconFilter  = icons[0];
  const iconSort    = icons[1];
  const iconGrid    = icons[2];
  const iconList    = icons[3];

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .cases-list {
      display: flex; flex-direction: column;
      background: #fff;
      border-radius: 12px;
      border: 1px solid var(--border-light);
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      overflow: hidden;
    }
    .list-header-row {
      display: grid;
      grid-template-columns: 2.2fr 1fr 1.4fr 1.2fr 1.6fr 1fr 0.9fr;
      padding: 10px 20px;
      gap: 8px;
      background: var(--bg-table-header);
      border-bottom: 1px solid var(--border-light);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }
    .case-list-row {
      display: grid;
      grid-template-columns: 2.2fr 1fr 1.4fr 1.2fr 1.6fr 1fr 0.9fr;
      align-items: center;
      padding: 13px 20px;
      gap: 8px;
      border-bottom: 1px solid var(--border-light);
      transition: background 0.13s ease;
    }
    .case-list-row:last-child { border-bottom: none; }
    .case-list-row:hover { background: #f8f9fb; }
    .list-col { font-size: 0.82rem; color: var(--text-primary); }
    .list-col-case, .list-col-court, .list-col-lawyer { color: var(--text-secondary); }
    .list-col-client { display: flex; align-items: center; gap: 11px; }
    .list-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--sidebar-bg); color: #fff;
      font-weight: 700; font-size: 0.85rem;
      display: grid; place-items: center; flex-shrink: 0;
    }
    .list-name { font-weight: 600; font-size: 0.85rem; }
    .list-sub  { font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px; }
    .badge.red    { background: #fef2f2; color: #be123c; }
    .badge.orange { background: #fff7ed; color: #c2410c; }
    .badge.grey   { background: #f1f5f9; color: #64748b; }
    .list-btn {
      display: inline-block; padding: 6px 12px;
      border-radius: 6px; background: var(--sidebar-bg);
      color: #fff; font-size: 0.75rem; font-weight: 600;
      text-decoration: none; white-space: nowrap;
      transition: background 0.15s;
    }
    .list-btn:hover { background: #162040; }
    .lex-dropdown {
      position: absolute;
      min-width: 190px;
      background: #fff;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      box-shadow: 0 8px 28px rgba(0,0,0,0.11);
      z-index: 9999;
      display: none; flex-direction: column;
      overflow: hidden;
    }
    .lex-dropdown.open { display: flex; }
    .dd-section-header {
      padding: 10px 14px 8px;
      font-size: 0.68rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-light);
    }
    .dd-item {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 14px; font-size: 0.84rem;
      cursor: pointer; color: var(--text-primary);
      transition: background 0.12s; user-select: none;
    }
    .dd-item:hover { background: var(--bg-table-header); }
    .dd-item.is-active { font-weight: 600; color: var(--brand-accent); }
    .dd-item input[type="checkbox"] { accent-color: var(--sidebar-bg); width: 14px; height: 14px; }
    .dd-arrow { margin-left: auto; font-size: 0.78rem; color: var(--brand-accent); }
    .dd-footer {
      display: flex; gap: 8px; padding: 10px 14px;
      border-top: 1px solid var(--border-light);
    }
    .dd-footer button {
      flex: 1; padding: 7px; border-radius: 6px;
      font-size: 0.8rem; font-weight: 600; cursor: pointer; border: none;
    }
    .btn-dd-clear { background: var(--bg-table-header); color: var(--text-secondary); }
    .btn-dd-apply { background: var(--sidebar-bg); color: #fff; }
    .btn-dd-apply:hover { background: #162040; }
    .no-results {
      padding: 48px; text-align: center;
      color: var(--text-secondary); font-size: 0.9rem;
      grid-column: 1 / -1;
    }
    .section-actions svg { cursor: pointer; transition: fill 0.15s; }
  `;
  document.head.appendChild(styleEl);

  function statusBadgeClass(s) {
    if (s === "Active")  return "green";
    if (s === "Closed")  return "red";
    if (s === "Pending") return "orange";
    return "grey";
  }

  function buildCard(c) {
    const el = document.createElement("div");
    el.className = "case-card";
    el.innerHTML = `
      <div class="card-top">
        <span class="badge light">${c.type}</span>
        <span class="badge ${statusBadgeClass(c.status)}">● ${c.status}</span>
      </div>
      <h3>${c.client}</h3>
      <div class="case-meta"><p>${c.id}</p><p>${c.caseType}</p></div>
      <div class="divider"></div>
      <div class="case-footer">
        <p><strong>Lawyer:</strong> ${c.lawyer}</p>
        <p><strong>Court:</strong> ${c.court}</p>
      </div>
      <button class="btn-primary full">
        <a href="case-documents.html?caseId=${c.id}" style="color: inherit; text-decoration: none;">Manage Documents →</a>
      </button>`;
    return el;
  }

  function buildRow(c) {
    const el = document.createElement("div");
    el.className = "case-list-row";
    el.innerHTML = `
      <div class="list-col list-col-client">
        <div class="list-avatar">${c.client.charAt(0)}</div>
        <div>
          <div class="list-name">${c.client}</div>
          <div class="list-sub">${c.id}</div>
        </div>
      </div>
      <div class="list-col"><span class="badge light">${c.type}</span></div>
      <div class="list-col list-col-case">${c.caseType}</div>
      <div class="list-col list-col-lawyer">${c.lawyer}</div>
      <div class="list-col list-col-court">${c.court}</div>
      <div class="list-col"><span class="badge ${statusBadgeClass(c.status)}">● ${c.status}</span></div>
      <div class="list-col"><a href="case-documents.html?caseId=${c.id}" class="list-btn">Manage →</a></div>`;
    return el;
  }

  function go() {
    let data = [...casesData];

    const q = state.search.toLowerCase().trim();
    if (q) {
      data = data.filter(c =>
        c.client.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.cnr && c.cnr.toLowerCase().includes(q)) ||
        c.caseType.toLowerCase().includes(q) ||
        c.lawyer.toLowerCase().includes(q) ||
        c.court.toLowerCase().includes(q)
      );
    }

    if (state.activeFilters.length) {
      data = data.filter(c => state.activeFilters.includes(c.status));
    }

    // FIX: Sort only by client name or case ID (no date sorting)
    data.sort((a, b) => {
      const va = (a[state.sortKey] || "").toLowerCase();
      const vb = (b[state.sortKey] || "").toLowerCase();
      if (va < vb) return state.sortDir === "asc" ? -1 : 1;
      if (va > vb) return state.sortDir === "asc" ?  1 : -1;
      return 0;
    });

    grid.innerHTML = "";
    grid.className = state.view === "grid" ? "cases-grid" : "cases-list";

    if (!data.length) {
      grid.innerHTML = `<p class="no-results">No cases match your criteria.</p>`;
      return;
    }

    if (state.view === "list") {
      const hdr = document.createElement("div");
      hdr.className = "list-header-row";
      hdr.innerHTML = `<span>Client</span><span>Type</span><span>Case Type</span>
                       <span>Lawyer</span><span>Court</span><span>Status</span><span>Action</span>`;
      grid.appendChild(hdr);
    }

    data.forEach(c => grid.appendChild(state.view === "grid" ? buildCard(c) : buildRow(c)));
  }

  // Filter Dropdown
  const filterDD = document.createElement("div");
  filterDD.className = "lex-dropdown";
  filterDD.innerHTML = `
    <div class="dd-section-header">Filter by Status</div>
    ${["Active", "Pending", "Closed"].map(s =>
      `<label class="dd-item"><input type="checkbox" class="filter-cb" value="${s}"> ${s}</label>`
    ).join("")}
    <div class="dd-footer">
      <button class="btn-dd-clear">Clear</button>
      <button class="btn-dd-apply">Apply</button>
    </div>`;
  document.body.appendChild(filterDD);

  filterDD.querySelector(".btn-dd-clear").addEventListener("click", () => {
    filterDD.querySelectorAll(".filter-cb").forEach(cb => (cb.checked = false));
    state.activeFilters = [];
    go();
    syncFilterIcon();
  });
  filterDD.querySelector(".btn-dd-apply").addEventListener("click", () => {
    state.activeFilters = [...filterDD.querySelectorAll(".filter-cb:checked")].map(cb => cb.value);
    go();
    syncFilterIcon();
    closeAll();
  });
  function syncFilterIcon() {
    iconFilter.style.fill = state.activeFilters.length ? "var(--brand-accent)" : "var(--text-secondary)";
  }

  // FIX: Sort dropdown — removed "Date", only Client Name and Case ID
  const sortOpts = [
    { key: "client", label: "Client Name" },
    { key: "id",     label: "Case ID" },
  ];

  const sortDD = document.createElement("div");
  sortDD.className = "lex-dropdown";
  sortDD.innerHTML = `
    <div class="dd-section-header">Sort by</div>
    ${sortOpts.map(o =>
      `<div class="dd-item sort-opt ${state.sortKey === o.key ? "is-active" : ""}" data-key="${o.key}">
        ${o.label}<span class="dd-arrow">${state.sortKey === o.key ? (state.sortDir === "asc" ? "↑" : "↓") : ""}</span>
       </div>`
    ).join("")}`;
  document.body.appendChild(sortDD);

  sortDD.querySelectorAll(".sort-opt").forEach(item => {
    item.addEventListener("click", () => {
      const key = item.dataset.key;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = "asc";
      }
      sortDD.querySelectorAll(".sort-opt").forEach(el => {
        const active = el.dataset.key === state.sortKey;
        el.classList.toggle("is-active", active);
        el.querySelector(".dd-arrow").textContent = active ? (state.sortDir === "asc" ? "↑" : "↓") : "";
      });
      iconSort.style.fill = "var(--brand-accent)";
      go();
    });
  });

  function openDD(dd, anchor) {
    const isOpen = dd.classList.contains("open");
    closeAll();
    if (isOpen) return;
    dd.classList.add("open");
    requestAnimationFrame(() => {
      const rect   = anchor.getBoundingClientRect();
      const ddRect = dd.getBoundingClientRect();
      dd.style.top  = (rect.bottom + window.scrollY + 8) + "px";
      dd.style.left = Math.max(4, rect.right + window.scrollX - ddRect.width) + "px";
    });
  }

  function closeAll() {
    filterDD.classList.remove("open");
    sortDD.classList.remove("open");
  }

  searchInput.addEventListener("input", e => { state.search = e.target.value; go(); });
  iconFilter.addEventListener("click", e => { e.stopPropagation(); openDD(filterDD, iconFilter); });
  iconSort.addEventListener("click",   e => { e.stopPropagation(); openDD(sortDD,   iconSort);   });
  iconGrid.addEventListener("click", () => { state.view = "grid"; go(); syncViewIcons(); });
  iconList.addEventListener("click", () => { state.view = "list"; go(); syncViewIcons(); });
  filterDD.addEventListener("click", e => e.stopPropagation());
  sortDD.addEventListener("click",   e => e.stopPropagation());
  document.addEventListener("click", closeAll);

  function syncViewIcons() {
    iconGrid.style.fill = state.view === "grid" ? "var(--brand-accent)" : "var(--text-secondary)";
    iconList.style.fill = state.view === "list" ? "var(--brand-accent)" : "var(--text-secondary)";
  }

  syncViewIcons();

  // FIX: Map status correctly including PENDING and CLOSED
  function mapStatus(raw) {
    if (!raw) return "Active";
    const s = raw.toUpperCase();
    if (s === "ACTIVE")  return "Active";
    if (s === "PENDING") return "Pending";
    if (s === "CLOSED")  return "Closed";
    return "Active";
  }

  async function loadCases() {
    console.log('[DocumentsMain] Loading cases from backend via casesStorage...');
    try {
      const casesStorage = window.LexFlowCasesStorage;

      // Fetch cases — role-scoped automatically.
      const allCases = await casesStorage.getCases();
      if (!allCases || !allCases.length) {
        casesData = [];
        go();
        return;
      }

      // Collect the unique user IDs we need to resolve (client + lawyer).
      // GET /users/:id is open to all roles, so this works for everyone.
      const userIds = [...new Set(
        allCases.flatMap(c => [c.client_id, c.lawyer_id].filter(Boolean))
      )];

      const uMap = {};
      await Promise.allSettled(
        userIds.map(uid =>
          fetch(`http://localhost:3000/users/${uid}`, {
            headers: { 'role': casesStorage.getRoleHeader() }
          })
          .then(r => r.ok ? r.json() : null)
          .then(u => { if (u) uMap[u.id] = u.fullName || u.name || uid; })
        )
      );

      casesData = allCases.map(c => ({
        id: String(c.id),
        client: uMap[c.client_id] || c.client_name || 'Unknown Client',
        type: 'INDIVIDUAL',
        status: mapStatus(c.status),
        caseType: c.case_type || c.title,
        lawyer: uMap[c.lawyer_id] || c.lawyer_name || 'Unknown Lawyer',
        court: c.court || 'District Court',
      }));

      console.log(`[DocumentsMain] Loaded ${casesData.length} cases.`);
      go();
    } catch (err) {
      console.error('[DocumentsMain] Failed to load cases:', err);
      grid.innerHTML = `<p class="no-results">Error loading cases. Please try again.</p>`;
    }
  }



  loadCases();


})();
