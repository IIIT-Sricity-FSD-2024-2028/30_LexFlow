let allTasks = [],
  filteredTasks = [],
  allCases = [];

const casesStorage = window.LexFlowCasesStorage;

const currentUser = (() => {
  try {
    const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return {
      name: u.fullName || u.name || 'Firm Admin',
      avatar: (u.fullName || u.name || 'FA').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
      role: u.role || 'firmAdmin',
    };
  } catch { return { name: 'Firm Admin', avatar: 'FA', role: 'firmAdmin' }; }
})();
const MOCK_STORAGE_KEY = "lexflow_mock_data",
  TASKS_STORAGE_KEY = "lexflow_tasks",
  USERS_STORAGE_KEY = "lexflow_users",
  MOCK_PATH = "../scripts/client_casemanagement_mock-data.json";

function loadJsonFromStorage(t) {
  try {
    const e = localStorage.getItem(t);
    return e ? JSON.parse(e) : null;
  } catch (e) {
    return (console.warn(`Failed to parse ${t}:`, e), null);
  }
}

function saveJsonToStorage(t, e) {
  // Only allow essential auth keys
  const allowed = ['currentUser', 'userRole', 'loginRole'];
  if (allowed.includes(t)) {
    localStorage.setItem(t, JSON.stringify(e));
  } else {
    // console.log(`Skipping localStorage write for: ${t}`);
  }
}

async function ensureTaskStorage() {
  let t = loadJsonFromStorage(MOCK_STORAGE_KEY),
    e = loadJsonFromStorage(TASKS_STORAGE_KEY),
    n = loadJsonFromStorage(USERS_STORAGE_KEY);

  if (!(t && Array.isArray(t.tasks))) {
    if (!Array.isArray(e)) {
      const a = await fetch(MOCK_PATH),
        s = await a.json();
      ((t = s),
        saveJsonToStorage(MOCK_STORAGE_KEY, s),
        saveJsonToStorage(TASKS_STORAGE_KEY, s.tasks || []),
        saveJsonToStorage(USERS_STORAGE_KEY, s.users || []));
    } else {
      t = { ...(t || {}), tasks: e || [], users: n || [] };
      saveJsonToStorage(MOCK_STORAGE_KEY, t);
    }
  } else {
    (Array.isArray(e) || saveJsonToStorage(TASKS_STORAGE_KEY, t.tasks || []),
      Array.isArray(n) || saveJsonToStorage(USERS_STORAGE_KEY, t.users || []));
  }

  return {
    tasks: loadJsonFromStorage(TASKS_STORAGE_KEY) || (t && t.tasks) || [],
    users: loadJsonFromStorage(USERS_STORAGE_KEY) || (t && t.users) || [],
  };
}

function saveTasksToAllStores() {
  const t = loadJsonFromStorage(MOCK_STORAGE_KEY) || {};
  ((t.tasks = allTasks),
    Array.isArray(t.users) || (t.users = loadJsonFromStorage(USERS_STORAGE_KEY) || []),
    saveJsonToStorage(TASKS_STORAGE_KEY, allTasks),
    saveJsonToStorage(MOCK_STORAGE_KEY, t));
}
async function initTasks() {
  try {
    const t = await ensureTaskStorage();
    allCases = ((casesStorage && (await casesStorage.getCases())) || []);
    const users = ((casesStorage && (await casesStorage.getUsers())) || []);
    ((allTasks = t.tasks || []),
      (window.allUsers = users),
      (filteredTasks = [...allTasks]),
      renderPage(1));
  } catch (t) {
    console.error("Error loading tasks:", t);
  }
}
function saveTasks() {
  saveTasksToAllStores();
}
const TASKS_PER_PAGE = 5;
let currentPage = 1;
const tasksTbody = document.getElementById("tasksTbody"),
  paginationInfo = document.getElementById("taskPaginationInfo"),
  paginationPages = document.getElementById("taskPaginationPages"),
  searchInput = document.getElementById("taskSearchInput"),
  prioFilter = document.getElementById("taskPriorityFilter"),
  statusFilter = document.getElementById("taskStatusFilter");
function getInitials(t) {
  return t
    ? t
        .split(" ")
        .map((t) => t[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "U";
}
function getStatusIcon(t) {
  return "Completed" === t
    ? '\n            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">\n                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="#D1FAE5" stroke="#10B981" stroke-width="2" stroke-linejoin="round"/>\n                <path d="M14 2V8H20" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n                <circle cx="17" cy="17" r="5" fill="#10B981"/>\n                <path d="M15 17L16.5 18.5L19 15.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>'
    : '\n            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">\n                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/>\n                <path d="M14 2V8H20" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n                <circle cx="17" cy="17" r="5" fill="#F59E0B"/>\n                <path d="M15.5 15.5L18.5 18.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>\n                <path d="M18.5 15.5L15.5 18.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>\n            </svg>';
}
function renderTaskRow(t) {
  const e = t.priority ? t.priority.toLowerCase() : "low",
    n = "Completed" === t.status ? "completed" : "";
  return `\n    <tr class="page-item">\n        <td style="padding-left: 20px; max-width: 250px;">\n            <div class="task-name-col">\n                <span class="task-title" style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.name}</span>\n                <span class="task-subtitle" style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.caseTitle || "General Task"}</span>\n            </div>\n        </td>\n        <td>\n            <span class="task-id">${t.id}</span>\n        </td>\n        <td>\n            <div class="task-user" style="white-space: nowrap;">\n                <div class="task-avatar" style="background: ${"Completed" === t.status ? "#f3f4f6" : "#dbeafe"}">${getInitials(t.assignedUser)}</div>\n                <span>${t.assignedUser}</span>\n            </div>\n        </td>\n        <td>\n            <span class="task-priority ${e}">${t.priority}</span>\n        </td>\n        <td>\n            <span class="task-date" style="white-space: nowrap;">${t.dueDate}</span>\n        </td>\n        <td>\n            <div class="task-status ${n}" style="white-space: nowrap;">\n                <div class="task-status-icon">\n                    ${getStatusIcon(t.status)}\n                </div>\n                ${t.status}\n            </div>\n        </td>\n        <td style="padding-right: 20px; text-align: right;">\n            <div class="task-actions" style="justify-content: flex-end; white-space: nowrap;">\n                <button title="View" onclick="openViewTaskModal('${t.id}')">\n                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>\n                </button>\n                <button title="Edit" onclick="openEditTaskModal('${t.id}')">\n                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>\n                </button>\n                <button title="Delete" onclick="deleteTask('${t.id}')">\n                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>\n                </button>\n            </div>\n        </td>\n    </tr>\n  `;
}
function renderPage(t) {
  const e = Math.ceil(filteredTasks.length / TASKS_PER_PAGE) || 1;
  ((t = Math.max(1, Math.min(t, e))), (currentPage = t));
  const n = (t - 1) * TASKS_PER_PAGE,
    a = filteredTasks.slice(n, n + TASKS_PER_PAGE);
  ((tasksTbody.style.opacity = "0"),
    setTimeout(() => {
      (0 === a.length
        ? (tasksTbody.innerHTML =
            '<tr><td colspan="7" style="text-align: center; color: #6b7280; padding: 40px;">No tasks found matching your criteria.</td></tr>')
        : (tasksTbody.innerHTML = a.map(renderTaskRow).join("")),
        (tasksTbody.style.opacity = "1"),
        (tasksTbody.style.transition = "opacity 0.2s"));
    }, 100));
  const s = Math.min(n + TASKS_PER_PAGE, filteredTasks.length);
  paginationInfo.innerHTML = `Showing <strong>${0 === filteredTasks.length ? 0 : n + 1}</strong> to <strong>${s}</strong> of <strong>${filteredTasks.length}</strong> tasks`;
  let o = "";
  o += `<button class="pg-arrow" ${t <= 1 ? "disabled" : ""} data-page="${t - 1}">&#8249;</button>`;
  for (let n = 1; n <= e; n++)
    o += `<button data-page="${n}" class="${n === t ? "active" : ""}">${n}</button>`;
  ((o += `<button class="pg-arrow" ${t >= e ? "disabled" : ""} data-page="${t + 1}">&#8250;</button>`),
    (paginationPages.innerHTML = o),
    paginationPages.querySelectorAll("button[data-page]").forEach((t) => {
      t.addEventListener("click", function () {
        const t = parseInt(this.dataset.page, 10);
        isNaN(t) || renderPage(t);
      });
    }));
}
function applyFilters() {
  const t = searchInput.value.toLowerCase().trim(),
    e = prioFilter.value,
    n = statusFilter.value;
  ((filteredTasks = allTasks.filter((a) => {
    const s =
        a.name.toLowerCase().includes(t) ||
        (a.caseTitle && a.caseTitle.toLowerCase().includes(t)) ||
        a.id.toLowerCase().includes(t),
      o = "All" === e || a.priority === e,
      i = "All" === n || a.status === n;
    return s && o && i;
  })),
    renderPage(1));
}
function getPrioColor(t) {
  return "HIGH" === t
    ? { bg: "#fee2e2", text: "#ef4444" }
    : "MEDIUM" === t
      ? { bg: "#fef3c7", text: "#d97706" }
      : { bg: "#dcfce3", text: "#166534" };
}

function resolveCaseFromInput(inputValue) {
  const v = String(inputValue || "").trim().toLowerCase();
  if (!v) return null;
  return allCases.find((c) =>
    String(c.id || "").toLowerCase() === v ||
    String(c.cnr || "").toLowerCase() === v ||
    String(c.title || "").toLowerCase() === v
  ) || null;
}

(searchInput.addEventListener("input", applyFilters),
  prioFilter.addEventListener("change", applyFilters),
  statusFilter.addEventListener("change", applyFilters),
  (window.openModal = function (t) {
    document.getElementById(t).classList.add("active");
  }),
  (window.closeModal = function (t) {
    const e = document.getElementById(t);
    (LexValidation.clearAllErrors(e), e.classList.remove("active"));
  }),
  (window.openCreateTaskModal = function () {
    ((document.getElementById("taskModalTitle").textContent =
      "Create New Task"),
      (document.getElementById("saveTaskBtn").textContent = "Create Task"),
      (document.getElementById("taskEditId").value = ""),
      (document.getElementById("taskNameInput").value = ""),
      (document.getElementById("taskCaseInput").value = ""),
      (document.getElementById("taskDateInput").value = ""),
      (document.getElementById("taskDescInput").value = ""));
    ((document.getElementById("taskAssigneeInput").innerHTML = window.allUsers
      .map((t) => `<option value="${t.name}">${t.name}</option>`)
      .join("")),
      setActivePriority("LOW"),
      openModal("taskModal"));
  }),
  (window.openEditTaskModal = function (t) {
    const e = allTasks.find((e) => e.id === t);
    if (!e) return;
    ((document.getElementById("taskModalTitle").textContent = "Edit Task"),
      (document.getElementById("saveTaskBtn").textContent = "Update Task"),
      (document.getElementById("taskEditId").value = e.id),
      (document.getElementById("taskNameInput").value = e.name),
      (document.getElementById("taskCaseInput").value = e.caseTitle || ""));
    if (
      ((document.getElementById("taskAssigneeInput").innerHTML = window.allUsers
        .map(
          (t) =>
            `<option value="${t.name}" ${t.name === e.assignedUser ? "selected" : ""}>${t.name}</option>`,
        )
        .join("")),
      e.dueDate && e.dueDate.includes(","))
    ) {
      const t = new Date(e.dueDate);
      isNaN(t.getTime()) ||
        (document.getElementById("taskDateInput").value = t
          .toISOString()
          .split("T")[0]);
    } else document.getElementById("taskDateInput").value = "";
    ((document.getElementById("taskDescInput").value = e.description || ""),
      setActivePriority(e.priority || "LOW"),
      openModal("taskModal"));
  }),
  (window.openViewTaskModal = function (t) {
    const e = allTasks.find((e) => e.id === t);
    if (!e) return;
    ((document.getElementById("viewTaskId").textContent = e.id),
      (document.getElementById("viewTaskTitle").textContent = e.name),
      (document.getElementById("viewTaskStatus").innerHTML =
        `<div class="task-status-icon" style="width:16px; height:16px;">${getStatusIcon(e.status)}</div> ${e.status}`),
      (document.getElementById("viewTaskDate").textContent = e.dueDate),
      (document.getElementById("viewTaskPriority").textContent = e.priority),
      (document.getElementById("viewTaskPriority").style.background =
        getPrioColor(e.priority).bg),
      (document.getElementById("viewTaskPriority").style.color = getPrioColor(
        e.priority,
      ).text),
      (document.getElementById("viewTaskDesc").textContent =
        e.description || "No additional description provided."),
      (document.getElementById("viewTaskAssignee").textContent =
        e.assignedUser),
      (document.getElementById("viewTaskAvatar").textContent = getInitials(
        e.assignedUser,
      )));
    const n = document.getElementById("completeTaskBtn");
    ("Completed" === e.status
      ? ((n.textContent = "Completed"),
        (n.disabled = !0),
        (n.style.opacity = "0.5"))
      : ((n.textContent = "Mark as Completed"),
        (n.disabled = !1),
        (n.style.opacity = "1"),
        (n.onclick = () => markTaskAsCompleted(e.id))),
      openModal("viewTaskModal"));
  }),
  (window.openEditTaskFromView = function () {
    const t = document.getElementById("viewTaskId").textContent;
    (closeModal("viewTaskModal"), openEditTaskModal(t));
  }),
  (window.saveTaskModal = function () {
    const t = document.getElementById("taskNameInput"),
      e = document.getElementById("taskDateInput"),
      n = document.getElementById("taskModal");
    LexValidation.clearAllErrors(n);
    const a = [
      {
        input: t,
        validator: (t) => LexValidation.validateRequired(t, "Task name"),
      },
      { input: e, validator: (t) => LexValidation.validateDate(t, "Due date") },
    ];
    if (!LexValidation.validateForm(a))
      return (
        n.querySelector(".modal-content").classList.add("form-shake"),
        void setTimeout(
          () =>
            n.querySelector(".modal-content").classList.remove("form-shake"),
          450,
        )
      );
    const s = document.getElementById("taskEditId").value,
      o = document.getElementById("taskCaseInput").value,
      i = document.getElementById("taskAssigneeInput").value,
      l = document.getElementById("taskDescInput").value,
      d = (['LOW','MEDIUM','HIGH'].includes(document.getElementById("taskPriorityInput").value)
        ? document.getElementById("taskPriorityInput").value : 'LOW'),
      r = new Date(e.value).toLocaleDateString(void 0, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    if (s) {
      const e = allTasks.find((t) => t.id === s);
      const caseRef = resolveCaseFromInput(o);
      e &&
        ((e.name = t.value.trim()),
        (e.caseTitle = o),
        (e.assignedUser = i),
        (e.dueDate = r),
        (e.description = l),
        (e.priority = d),
        (e.caseId = caseRef ? caseRef.id : (e.caseId || "")),
        (e.caseCnr = caseRef ? caseRef.cnr : (e.caseCnr || "")));
    } else {
      const e = "T-" + (1e3 + Math.floor(9e3 * Math.random()));
      const caseRef = resolveCaseFromInput(o);
      allTasks.unshift({
        id: e,
        name: t.value.trim(),
        caseTitle: o,
        assignedUser: i,
        priority: d,
        dueDate: r,
        status: "Pending",
        description: l,
        caseId: caseRef ? caseRef.id : "",
        caseCnr: caseRef ? caseRef.cnr : "",
      });
    }
    (saveTasks(), applyFilters(), closeModal("taskModal"));
  }),
  (window.markTaskAsCompleted = function (t) {
    const e = t || document.getElementById("viewTaskId").textContent,
      n = allTasks.find((t) => t.id === e);
    n &&
      ((n.status = "Completed"),
      saveTasks(),
      applyFilters(),
      t ? openViewTaskModal(e) : closeModal("viewTaskModal"));
  }),
  (window.deleteTask = function (t) {
    confirm("Are you sure you want to delete task " + t + "?") &&
      ((allTasks = allTasks.filter((e) => e.id !== t)),
      saveTasks(),
      applyFilters());
  }));
const prioToggles = document.querySelectorAll(".prio-toggle");
function setActivePriority(t) {
  prioToggles.forEach((t) => t.classList.remove("active"));
  const e = Array.from(prioToggles).find((e) => e.dataset.prio === t);
  (e && e.classList.add("active"),
    (document.getElementById("taskPriorityInput").value = t));
}
prioToggles.forEach((t) => {
  t.addEventListener("click", function () {
    setActivePriority(this.dataset.prio);
  });
});
const filterBtn = document.getElementById("taskFilterBtn"),
  filterDropdown = document.getElementById("taskFilterDropdown");
(filterBtn &&
  filterBtn.addEventListener("click", (t) => {
    (t.stopPropagation(),
      (filterDropdown.style.display =
        "none" === filterDropdown.style.display ? "block" : "none"));
  }),
  document.addEventListener("click", () => {
    filterDropdown && (filterDropdown.style.display = "none");
  }),
  filterDropdown &&
    filterDropdown.addEventListener("click", (t) => t.stopPropagation()),
  initTasks());
