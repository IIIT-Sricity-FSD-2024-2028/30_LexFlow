let allCases = [],
  filteredCases = [],
  allTasks = [],
  filteredTasks = [],
  currentTab = "all";
async function initCases() {
  try {
    let e;
    const t = localStorage.getItem("lexflow_mock_data");
    if (t) e = JSON.parse(t);
    else {
      const t = await fetch(
        "../../scripts/client_casemanagement_mock-data.json",
      );
      ((e = await t.json()),
        localStorage.setItem("lexflow_mock_data", JSON.stringify(e)));
    }
    ((allCases = e.cases.filter((e) => "ADM001" === e.assignedAdvocateId)),
      (allTasks = e.tasks || []),
      (filteredCases = [...allCases]));
    const n = allTasks.filter(
      (e) => "Pending" === e.status && "Sarah Mitchell" === e.assignedUser,
    );
    ((document.getElementById("pendingTasksCount").textContent = n.length),
      renderPage(1));
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
          t.title.toLowerCase().includes(e) || t.cnr.toLowerCase().includes(e),
      ));
    const n = statusFilter ? statusFilter.value : "All";
    ("All" !== n && (t = t.filter((e) => e.status === n)), (filteredCases = t));
  } else {
    const t = taskPriorityFilter ? taskPriorityFilter.value : "All",
      n = taskStatusFilter ? taskStatusFilter.value : "All";
    let a = [...allTasks].filter((e) => "Sarah Mitchell" === e.assignedUser);
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
  const t = e.nextHearing ? e.nextHearing.date : "TBD";
  return `\n    <div class="case-card page-item" data-title="${e.title.toLowerCase()}" data-cnr="${e.cnr.toLowerCase()}" onclick="window.location.href='casemanagement_case-details.html?cnr=${e.cnr}'" style="display:flex; justify-content:space-between; align-items:center; gap: 24px;">\n      \n      <div class="case-info-left" style="display:flex; align-items:center; gap: 20px; flex: 1; min-width: 0;">\n          \x3c!-- Using the original case-icon from client side for animation consistency --\x3e\n          <div class="case-icon">\n            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 8H3a2 2 0 00-2 2v9a2 2 0 002 2h18a2 2 0 002-2V10a2 2 0 00-2-2zM16 8V6a3 3 0 00-6 0v2M7 13v3m10-3v3"/></svg>\n          </div>\n          <div style="display:flex; flex-direction:column; gap: 6px; min-width: 0; flex: 1;">\n            <div class="meta-row" style="display:flex; align-items:center; gap: 8px;">\n                <span class="badge-active">${e.status}</span>\n                <span style="font-size:11px; color:#6b7280; font-family:monospace; letter-spacing:0.5px;">CNR: ${e.cnr}</span>\n            </div>\n            <div class="case-title" style="margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.title}</div>\n            <div class="case-meta" style="margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\n                <span><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5"/></svg> ${e.type} · ${e.court}</span>\n            </div>\n          </div>\n      </div>\n\n      <div class="case-info-right" style="display:flex; gap: 32px; align-items:center; flex-shrink: 0;">\n          <div style="text-align: right;">\n              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 4px;">ASSIGNED LAWYER</div>\n              <div style="font-size:14px; font-weight:600; color:#1a1a2e; white-space: nowrap;">Adv. Sarah Mitchell</div>\n          </div>\n          <div style="text-align: right; white-space: nowrap;">\n              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 4px;">NEXT HEARING</div>\n              <div style="font-size:14px; font-weight:600; color:#3b5bdb; display:flex; align-items:center; gap: 4px; justify-content:flex-end;">\n                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>\n                  ${t}\n              </div>\n          </div>\n          <a class="view-details" href="casemanagement_case-details.html?cnr=${e.cnr}">View Details →</a>\n      </div>\n    </div>`;
}
function renderTaskCard(e) {
  e.priority && e.priority.toLowerCase();
  return `\n    <div class="case-card page-item" style="display:flex; justify-content:space-between; align-items:center; cursor:default;">\n      \n      <div class="case-info-left" style="display:flex; align-items:center; gap: 20px;">\n          <div class="case-icon" style="background: #fef3c7; color: #d97706;">\n            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>\n          </div>\n          <div style="display:flex; flex-direction:column; gap: 6px;">\n            <div class="meta-row" style="display:flex; align-items:center; gap: 8px;">\n                <span style="background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;">${e.status}</span>\n                <span style="background: ${"HIGH" === e.priority ? "#fee2e2" : "#dcfce3"}; color: ${"HIGH" === e.priority ? "#dc2626" : "#166534"}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${e.priority}</span>\n            </div>\n            <div class="case-title" style="margin:0;">${e.name}</div>\n            <div class="case-meta" style="margin:0;">\n                <span>${e.caseTitle}</span>\n            </div>\n          </div>\n      </div>\n\n      <div class="case-info-right" style="display:flex; gap: 32px; align-items:center;">\n          <div style="text-align: right;">\n              <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom: 4px;">DUE DATE</div>\n              <div style="font-size:14px; font-weight:600; color:#1a1a2e; ${"Today" === e.dueDate ? "color:#ef4444;" : ""}">${e.dueDate}</div>\n          </div>\n          <button style="border: 1px solid #e5e7eb; background: #fff; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; color: #1a1a2e; cursor:pointer;" onclick="window.location.href='casemanagement_case-details.html?cnr=${e.caseCnr}'">View Case</button>\n      </div>\n    </div>`;
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
  searchInput.addEventListener("input", applyFilters),
  initCases());
