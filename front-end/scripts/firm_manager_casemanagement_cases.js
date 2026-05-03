let allCases = [],
  filteredCases = [],
  allTasks = [],
  filteredTasks = [],
  currentTab = "all",
  allLawyers = [];

// Use shared cases storage utility
const casesStorage = window.LexFlowCasesStorage;

async function initCases() {
  try {
    allCases = (await casesStorage.getCases()) || [];
    allTasks = (await casesStorage.getTasks()) || [];
    allLawyers = ((await casesStorage.getUsers()) || []).filter(
      (u) => {
        const r = (u.role || '').toLowerCase();
        return r === "firmadmin" || r === "lawyer" || u.systemRole === "lawyer";
      }
    );
    filteredCases = [...allCases];
    const pendingTasks = allTasks.filter((t) => t.status === "Pending");
    document.getElementById("pendingTasksCount").textContent = pendingTasks.length;
    renderPage(1);
  } catch (e) {
    console.error("Error loading cases:", e);
  }
}
const ITEMS_PER_PAGE = 4;
let currentPage = 1;
const caseListEl = document.getElementById("caseList"),
  noResultsEl = document.getElementById("noResults"),
  paginationInfo = document.getElementById("paginationInfo"),
  paginationPages = document.getElementById("paginationPages"),
  searchInput = document.getElementById("searchInput"),
  tabBtns = document.querySelectorAll(".tab-btn");
tabBtns.forEach((e) => {
  e.addEventListener("click", function () {
    (tabBtns.forEach((e) => e.classList.remove("active")),
      this.classList.add("active"),
      (currentTab = this.dataset.tab),
      "pending" === currentTab
        ? ((searchInput.placeholder = "Enter Task Name to search"),
          (document.getElementById("caseFilterGroup").style.display = "none"),
          (document.getElementById("taskFilterGroup").style.display = "block"))
        : ((searchInput.placeholder = "Enter CNR to search cases"),
          (document.getElementById("caseFilterGroup").style.display = "block"),
          (document.getElementById("taskFilterGroup").style.display = "none")),
      (searchInput.value = ""),
      applyFilters());
  });
});
const filterBtn = document.getElementById("filterBtn"),
  filterDropdown = document.getElementById("filterDropdown"),
  statusFilter = document.getElementById("statusFilter"),
  taskPriorityFilter = document.getElementById("taskPriorityFilter"),
  taskStatusFilter = document.getElementById("taskStatusFilter");
function applyFilters() {
  const e = searchInput.value.toLowerCase().trim();
  if ("all" === currentTab) {
    let t = [...allCases];
    "" !== e &&
      (t = t.filter(
        (t) =>
          (t.case_type || '').toLowerCase().includes(e) || (t.cnr || '').toLowerCase().includes(e),
      ));
    const n = statusFilter ? statusFilter.value : "All";
    ("All" !== n && (t = t.filter((e) => e.status === n)), (filteredCases = t));
  } else {
    const t = taskPriorityFilter ? taskPriorityFilter.value : "All",
      n = taskStatusFilter ? taskStatusFilter.value : "All";
    let a = [...allTasks];
    ("" !== e &&
      (a = a.filter(
        (t) =>
          t.name.toLowerCase().includes(e) ||
          t.caseTitle.toLowerCase().includes(e),
      )),
      "All" !== t && (a = a.filter((e) => e.priority === t)),
      "All" !== n && (a = a.filter((e) => e.status === n)),
      (filteredTasks = a));
  }
  renderPage(1);
}
function renderCaseCard(e) {
  const caseType = e.case_type || 'N/A';
  const briefDesc = e.brief_description || '';
  const cnr = e.cnr || 'N/A';
  const nextHearing = e.nextHearing ? e.nextHearing.date : "TBD";
  const lawyerList = (allLawyers || [])
      .map(
        (t) =>
          `<option value="${t.id}" ${t.id === e.lawyer_id ? "selected" : ""}>Adv. ${t.fullName || t.name}</option>`,
      )
      .join("");

  return `
    <div class="case-card page-item" data-title="${caseType.toLowerCase()}" data-cnr="${cnr.toLowerCase()}" onclick="window.location.href='firm_manager_casemanagement_case-details.html?id=${e.id}'" style="display:flex; justify-content:space-between; align-items:center; gap: 24px;">
      
      <div class="case-info-left" style="display:flex; align-items:center; gap: 20px; flex: 1; min-width: 0;">
          <div class="case-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 8H3a2 2 0 00-2 2v9a2 2 0 002 2h18a2 2 0 002-2V10a2 2 0 00-2-2zM16 8V6a3 3 0 00-6 0v2M7 13v3m10-3v3"/></svg>
          </div>
          <div style="display:flex; flex-direction:column; gap: 6px; min-width: 0; flex: 1;">
            <div class="meta-row" style="display:flex; align-items:center; gap: 8px;">
                <span class="badge-active">${e.status}</span>
                <span style="font-size:11px; color:#6b7280; font-family:monospace; letter-spacing:0.5px;">CNR: ${cnr}</span>
            </div>
            <div class="case-title" style="margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${caseType} Case</div>
            <div class="case-meta" style="margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span>${briefDesc}</span>
            </div>
          </div>
      </div>

      <div class="case-info-right" style="display:flex; gap: 32px; align-items:center; flex-shrink: 0;">
          <div style="text-align: right;" onclick="event.stopPropagation()">
              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 4px;">ASSIGNED LAWYER</div>
              <select class="form-input" style="padding: 4px 8px; font-size: 13px; font-weight: 600; min-width: 160px; border-color: #e5e7eb;" onchange="changeLawyer('${e.id}', this.value)">
                ${lawyerList}
              </select>
          </div>
          <div style="text-align: right; white-space: nowrap;">
              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 4px;">NEXT HEARING</div>
              <div style="font-size:14px; font-weight:600; color:#3b5bdb; display:flex; align-items:center; gap: 4px; justify-content:flex-end;">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  ${nextHearing}
              </div>
          </div>
          <a class="view-details" href="firm_manager_casemanagement_case-details.html?id=${e.id}">View Details →</a>
      </div>
    </div>`;
}
async function changeLawyer(caseId, lawyerId) {
  const caseItem = allCases.find((c) => String(c.id) === String(caseId));
  if (!caseItem) return;

  // Guard: only assign if lawyer exists in the loaded list
  if (lawyerId && !allLawyers.some((l) => l.id === lawyerId)) return;

  try {
    await casesStorage.updateCase(caseId, { lawyer_id: lawyerId });
    caseItem.lawyer_id = lawyerId;
    applyFilters();
  } catch (err) {
    console.error("Failed to update lawyer:", err);
    alert("Failed to update lawyer. Please check backend.");
  }
}
function renderTaskCard(e) {
  e.priority && e.priority.toLowerCase();
  return `\n    <div class="case-card page-item" style="display:flex; justify-content:space-between; align-items:center; cursor:default;">\n      \n      <div class="case-info-left" style="display:flex; align-items:center; gap: 20px;">\n          <div class="case-icon" style="background: #fef3c7; color: #d97706;">\n            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>\n          </div>\n          <div style="display:flex; flex-direction:column; gap: 6px;">\n            <div class="meta-row" style="display:flex; align-items:center; gap: 8px;">\n                <span style="background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;">${e.status}</span>\n                <span style="background: ${"HIGH" === e.priority ? "#fee2e2" : "#dcfce3"}; color: ${"HIGH" === e.priority ? "#dc2626" : "#166534"}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${e.priority}</span>\n            </div>\n            <div class="case-title" style="margin:0;">${e.name}</div>\n            <div class="case-meta" style="margin:0;">\n                <span>${e.caseTitle}</span>\n            </div>\n          </div>\n      </div>\n\n      <div class="case-info-right" style="display:flex; gap: 32px; align-items:center;">\n          <div style="text-align: right;">\n              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 4px;">DUE DATE</div>\n              <div style="font-size:14px; font-weight:600; color:#1a1a2e; ${"Today" === e.dueDate ? "color:#ef4444;" : ""}">${e.dueDate}</div>\n          </div>\n          ${e.caseCnr ? `<button style="border: 1px solid #e5e7eb; background: #fff; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; color: #1a1a2e; cursor:pointer;" onclick="window.location.href='firm_manager_casemanagement_case-details.html?cnr=${e.caseCnr}'">View Case</button>` : `<button style="border: 1px solid #e5e7eb; background: #f3f4f6; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; color: #9ca3af; cursor:not-allowed;" disabled>No Case</button>`}\n      </div>\n    </div>`;
}
function renderPage(e) {
  const t = "all" === currentTab ? filteredCases : filteredTasks,
    n = Math.ceil(t.length / ITEMS_PER_PAGE);
  ((e = Math.max(1, Math.min(e, n || 1))), (currentPage = e));
  const a = (e - 1) * ITEMS_PER_PAGE,
    s = t.slice(a, a + ITEMS_PER_PAGE);
  (caseListEl.classList.add("fade-out"),
    setTimeout(() => {
      (0 === s.length
        ? ((caseListEl.innerHTML = ""),
          (noResultsEl.style.display = "flex"),
          (noResultsEl.style.flexDirection = "column"),
          (noResultsEl.style.alignItems = "center"))
        : ((noResultsEl.style.display = "none"),
          (caseListEl.innerHTML =
            "all" === currentTab
              ? s.map(renderCaseCard).join("")
              : s.map(renderTaskCard).join(""))),
        caseListEl.classList.remove("fade-out"),
        caseListEl.classList.add("fade-in"),
        setTimeout(() => caseListEl.classList.remove("fade-in"), 300));
    }, 200));
  const i = Math.min(a + ITEMS_PER_PAGE, t.length),
    l = "all" === currentTab ? "cases" : "tasks";
  paginationInfo.innerHTML = `Showing <strong>${0 === t.length ? 0 : a + 1}</strong> to <strong>${i}</strong> of <strong>${t.length}</strong> ${l}`;
  let r = "";
  r += `<button class="pg-arrow" ${e <= 1 ? "disabled" : ""} data-page="${e - 1}">&#8249;</button>`;
  for (let t = 1; t <= n; t++)
    r += `<button data-page="${t}" class="${t === e ? "active" : ""}">${t}</button>`;
  ((r += `<button class="pg-arrow" ${e >= n ? "disabled" : ""} data-page="${e + 1}">&#8250;</button>`),
    (paginationPages.innerHTML = r),
    paginationPages.querySelectorAll("button[data-page]").forEach((e) => {
      e.addEventListener("click", function () {
        const e = parseInt(this.dataset.page, 10);
        isNaN(e) || renderPage(e);
      });
    }));
}
(filterBtn &&
  filterBtn.addEventListener("click", (e) => {
    (e.stopPropagation(),
      (filterDropdown.style.display =
        "none" === filterDropdown.style.display ? "block" : "none"));
  }),
  document.addEventListener("click", () => {
    filterDropdown && (filterDropdown.style.display = "none");
  }),
  filterDropdown &&
    filterDropdown.addEventListener("click", (e) => e.stopPropagation()),
  statusFilter && statusFilter.addEventListener("change", applyFilters),
  taskPriorityFilter &&
    taskPriorityFilter.addEventListener("change", applyFilters),
  taskStatusFilter && taskStatusFilter.addEventListener("change", applyFilters),
  (window.changeLawyer = changeLawyer),
  searchInput.addEventListener("input", applyFilters),
  initCases());
