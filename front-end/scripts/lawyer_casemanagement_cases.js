let allCases = [],
  filteredCases = [],
  allTasks = [],
  filteredTasks = [],
  currentTab = "all";

const casesAPI = window.LexFlowAPI ? window.LexFlowAPI.cases : null;
const tasksAPI = window.LexFlowAPI ? window.LexFlowAPI.tasks : null;

const currentUserData = (() => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch { return {}; }
})();

const currentUser = {
  role: (currentUserData.role || 'lawyer').toLowerCase(),
  firmId: currentUserData.firmId || null,
  name: currentUserData.fullName || currentUserData.name || 'Lawyer'
};

// ─── Init ──────────────────────────────────────────────────────────────────────
async function initCases() {
  try {
    const filters = {};
    if (currentUser.firmId) filters.firmId = currentUser.firmId;

    // 1. Fetch Cases from API
    if (casesAPI) {
      allCases = await casesAPI.getAll(filters, currentUser.role);
    } else {
      console.warn('Cases API not found');
      allCases = [];
    }

    // 2. Fetch Tasks from API
    if (tasksAPI) {
      // For the lawyer view, we can either show all firm tasks or just theirs. 
      // The "Pending Tasks" tab usually shows their workload.
      const taskFilters = { assignedUser: currentUser.name };
      if (currentUser.firmId) taskFilters.firmId = currentUser.firmId;
      allTasks = await tasksAPI.getAll(taskFilters, currentUser.role);
    } else {
      allTasks = [];
    }

    filteredCases = [...allCases];
    filteredTasks = [...allTasks];
    
    const pendingTasks = allTasks.filter(t => t.status === "Pending");
    const countEl = document.getElementById("pendingTasksCount");
    if (countEl) countEl.textContent = pendingTasks.length;

    renderPage(1);
  } catch (e) {
    console.error("Error loading cases:", e);
  }
}

// ─── Constants & DOM refs ─────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 4;
let currentPage = 1;
const caseListEl = document.getElementById("caseList"),
  noResultsEl = document.getElementById("noResults"),
  paginationInfo = document.getElementById("paginationInfo"),
  paginationPages = document.getElementById("paginationPages"),
  searchInput = document.getElementById("searchInput"),
  tabBtns = document.querySelectorAll(".tab-btn");

// ─── Tab switching ────────────────────────────────────────────────────────────
tabBtns.forEach((btn) => {
  btn.addEventListener("click", function () {
    tabBtns.forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    currentTab = this.dataset.tab;
    if (currentTab === "pending") {
      searchInput.placeholder = "Enter Task Name to search";
      const cf = document.getElementById("caseFilterGroup");
      const tf = document.getElementById("taskFilterGroup");
      if (cf) cf.style.display = "none";
      if (tf) tf.style.display = "block";
    } else {
      searchInput.placeholder = "Enter CNR to search cases";
      const cf = document.getElementById("caseFilterGroup");
      const tf = document.getElementById("taskFilterGroup");
      if (cf) cf.style.display = "block";
      if (tf) tf.style.display = "none";
    }
    searchInput.value = "";
    applyFilters();
  });
});

// ─── Filter refs ──────────────────────────────────────────────────────────────
const filterBtn = document.getElementById("filterBtn"),
  filterDropdown = document.getElementById("filterDropdown"),
  statusFilter = document.getElementById("statusFilter"),
  taskPriorityFilter = document.getElementById("taskPriorityFilter"),
  taskStatusFilter = document.getElementById("taskStatusFilter");

// ─── Apply Filters ────────────────────────────────────────────────────────────
function applyFilters() {
  const q = searchInput.value.toLowerCase().trim();
  if (currentTab === "all") {
    let result = [...allCases];
    if (q) {
      result = result.filter(c =>
        (c.case_type || "").toLowerCase().includes(q) ||
        (c.cnr || "").toLowerCase().includes(q)
      );
    }
    const status = statusFilter ? statusFilter.value : "All";
    if (status !== "All") result = result.filter(c => c.status === status);
    filteredCases = result;
  } else {
    const priority = taskPriorityFilter ? taskPriorityFilter.value : "All";
    const status = taskStatusFilter ? taskStatusFilter.value : "All";
    let tasks = [...allTasks];
    if (q) tasks = tasks.filter(t =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.caseTitle || "").toLowerCase().includes(q)
    );
    if (priority !== "All") tasks = tasks.filter(t => t.priority === priority);
    if (status !== "All") tasks = tasks.filter(t => t.status === status);
    filteredTasks = tasks;
  }
  renderPage(1);
}

function fmtTaskDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Render Case Card ─────────────────────────────────────────────────────────
function renderCaseCard(c) {
  const title = c.case_type || "Legal Case";
  const cnr = c.cnr || "N/A";
  const status = c.status || "Ongoing";
  const desc = c.brief_description || "No description provided.";
  const filed = c.filed_date ? new Date(c.filed_date).toLocaleDateString() : "TBD";
  return `
    <div class="case-card page-item" data-title="${title.toLowerCase()}" data-cnr="${cnr.toLowerCase()}" onclick="window.location.href='lawyer_casemanagement_case-details.html?id=${c.id}'" style="display:flex; justify-content:space-between; align-items:center; gap: 24px;">
      <div class="case-info-left" style="display:flex; align-items:center; gap: 20px; flex: 1; min-width: 0;">
          <div class="case-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 8H3a2 2 0 00-2 2v9a2 2 0 002 2h18a2 2 0 002-2V10a2 2 0 00-2-2zM16 8V6a3 3 0 00-6 0v2M7 13v3m10-3v3"/></svg>
          </div>
          <div style="display:flex; flex-direction:column; gap: 6px; min-width: 0; flex: 1;">
            <div class="meta-row" style="display:flex; align-items:center; gap: 8px;">
                <span class="badge-active">${status}</span>
                <span style="font-size:11px; color:#6b7280; font-family:monospace;">CNR: ${cnr}</span>
            </div>
            <div class="case-title" style="margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${title}</div>
            <div class="case-meta" style="margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <span>${desc}</span>
            </div>
          </div>
      </div>
      <div class="case-info-right" style="display:flex; gap: 24px; align-items:center; flex-shrink: 0;">
          <div style="text-align:right; white-space:nowrap;">
              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; margin-bottom:4px;">FILED DATE</div>
              <div style="font-size:14px; font-weight:600; color:#3b5bdb;">${filed}</div>
          </div>
          <a class="view-details" href="lawyer_casemanagement_case-details.html?id=${c.id}">View Details &rarr;</a>
      </div>
    </div>`;
}

// ─── Render Task Card ─────────────────────────────────────────────────────────
function renderTaskCard(t) {
  const priority = (t.priority || "").toUpperCase();
  return `
    <div class="case-card page-item" style="display:flex; justify-content:space-between; align-items:center; cursor:default;">
      <div class="case-info-left" style="display:flex; align-items:center; gap: 20px;">
          <div class="case-icon" style="background: #fef3c7; color: #d97706;">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div style="display:flex; flex-direction:column; gap: 6px;">
            <div class="meta-row" style="display:flex; align-items:center; gap: 8px;">
                <span style="background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;">${t.status || "Pending"}</span>
                <span style="background: ${priority === "HIGH" ? "#fee2e2" : "#dcfce3"}; color: ${priority === "HIGH" ? "#dc2626" : "#166534"}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${t.priority || "Normal"}</span>
            </div>
            <div class="case-title" style="margin:0;">${t.name || "Unnamed Task"}</div>
            <div class="case-meta" style="margin:0;"><span>${t.caseTitle || "General"}</span></div>
          </div>
      </div>
      <div class="case-info-right" style="display:flex; gap: 32px; align-items:center;">
          <div style="text-align: right;">
              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 4px;">DUE DATE</div>
              <div style="font-size:14px; font-weight:600; color:#1a1a2e;">${fmtTaskDate(t.dueDate)}</div>
          </div>
      </div>
    </div>`;
}

// ─── Render Page ──────────────────────────────────────────────────────────────
function renderPage(page) {
  const source = currentTab === "all" ? filteredCases : filteredTasks;
  const totalPages = Math.ceil(source.length / ITEMS_PER_PAGE);
  page = Math.max(1, Math.min(page, totalPages || 1));
  currentPage = page;

  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const slice = source.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const label = currentTab === "all" ? "cases" : "tasks";

  caseListEl.classList.add("fade-out");
  setTimeout(() => {
    if (slice.length === 0) {
      caseListEl.innerHTML = "";
      noResultsEl.style.display = "flex";
      noResultsEl.style.flexDirection = "column";
      noResultsEl.style.alignItems = "center";
    } else {
      noResultsEl.style.display = "none";
      caseListEl.innerHTML = currentTab === "all"
        ? slice.map(renderCaseCard).join("")
        : slice.map(renderTaskCard).join("");
    }
    caseListEl.classList.remove("fade-out");
    caseListEl.classList.add("fade-in");
    setTimeout(() => caseListEl.classList.remove("fade-in"), 300);
  }, 200);

  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, source.length);
  paginationInfo.innerHTML = `Showing <strong>${source.length === 0 ? 0 : startIndex + 1}</strong> to <strong>${endIndex}</strong> of <strong>${source.length}</strong> ${label}`;

  let pgHTML = `<button class="pg-arrow" ${page <= 1 ? "disabled" : ""} data-page="${page - 1}">&#8249;</button>`;
  for (let i = 1; i <= totalPages; i++) {
    pgHTML += `<button data-page="${i}" class="${i === page ? "active" : ""}">${i}</button>`;
  }
  pgHTML += `<button class="pg-arrow" ${page >= totalPages ? "disabled" : ""} data-page="${page + 1}">&#8250;</button>`;
  paginationPages.innerHTML = pgHTML;
  paginationPages.querySelectorAll("button[data-page]").forEach(btn => {
    btn.addEventListener("click", function () {
      const p = parseInt(this.dataset.page, 10);
      if (!isNaN(p)) renderPage(p);
    });
  });
}

// ─── Event wiring ─────────────────────────────────────────────────────────────
(filterBtn && filterBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  filterDropdown.style.display = filterDropdown.style.display === "none" ? "block" : "none";
}),
  document.addEventListener("click", () => {
    if (filterDropdown) filterDropdown.style.display = "none";
  }),
  filterDropdown && filterDropdown.addEventListener("click", e => e.stopPropagation()),
  statusFilter && statusFilter.addEventListener("change", applyFilters),
  taskPriorityFilter && taskPriorityFilter.addEventListener("change", applyFilters),
  taskStatusFilter && taskStatusFilter.addEventListener("change", applyFilters),
  searchInput.addEventListener("input", applyFilters),
  initCases());
