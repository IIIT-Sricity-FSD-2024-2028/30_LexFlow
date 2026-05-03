const MOCK_PATH = "../scripts/client_casemanagement_mock-data.json",
  LEGACY_STORAGE_KEY = "lexflow_mock_data",
  USERS_STORAGE_KEY = "lexflow_users",
  LAWYERS_STORAGE_KEY = "lexflow_lawyers",
  ITEMS_PER_PAGE = 8;
let appData = null,
  allUsers = [],
  filteredUsers = [],
  currentPage = 1,
  editingUserId = null,
  formAccountStatus = "active",
  formAvailability = "available";
const LAWYER_AVATAR_COLORS = [
  "blue",
  "indigo",
  "teal",
  "green",
  "orange",
  "purple",
];
function normalizeUser(e) {
  const t = { ...e };
  const displayName = (t.fullName || t.name || "").trim();
  if (displayName) {
    t.fullName = t.fullName || displayName;
    t.name = t.name || displayName;
  }
  if (
    (t.accountStatus || (t.accountStatus = "active"),
    t.availability || (t.availability = "available"),
    t.badgeRole || (t.badgeRole = "firmAdmin" === t.role ? "manager" : "client"),
    t.phone || (t.phone = ""),
    !t.avatar && t.name)
  ) {
    const e = t.name.trim().split(/\s+/);
    t.avatar =
      e.length >= 2
        ? (e[0][0] + e[e.length - 1][0]).toUpperCase()
        : t.name.slice(0, 2).toUpperCase();
  }
  return t;
}
function assignMissingFirmUserIds(e) {
  let t = 0;
  (e.forEach((e) => {
    const a = e.firmUserId && String(e.firmUserId).match(/^LF-(\d+)$/i);
    a && (t = Math.max(t, parseInt(a[1], 10)));
  }),
    e.forEach((e) => {
      e.firmUserId ||
        ((t += 1), (e.firmUserId = `LF-${String(t).padStart(3, "0")}`));
    }));
}
function syncRoleFromBadge(e) {
  if (e.role === "superAdmin" || e.systemRole === "super-user") return;
  const t = e.badgeRole;
  e.role = "client" === t ? "client" : ("lawyer" === t ? "lawyer" : "firmAdmin");
}
function nextInternalId(e, t) {
  const a = "client" === t ? "USR" : "ADM";
  let n = 0;
  return (
    e.forEach((e) => {
      if (String(e.id).startsWith(a)) {
        const t = parseInt(String(e.id).replace(a, ""), 10);
        isNaN(t) || (n = Math.max(n, t));
      }
    }),
    `${a}${String(n + 1).padStart(3, "0")}`
  );
}
function nextFirmUserId(e) {
  let t = 0;
  return (
    e.forEach((e) => {
      const a = e.firmUserId && String(e.firmUserId).match(/^LF-(\d+)$/i);
      a && (t = Math.max(t, parseInt(a[1], 10)));
    }),
    `LF-${String(t + 1).padStart(3, "0")}`
  );
}
function getLawyerAvatarColor(e = "") {
  const t = String(e)
    .split("")
    .reduce((e, t) => e + t.charCodeAt(0), 0);
  return LAWYER_AVATAR_COLORS[t % LAWYER_AVATAR_COLORS.length];
}
function syncLawyersWithUsers(e) {
  // No-op: lawyers are now derived from users
}

function saveLawyersToStorage(e) {
  // No-op
}

async function ensureLawyersStorageInitialized() {
  // No-op
}
function importApprovedLawyersIntoUsers(e) {
  // No-op
}
function loadFromStorage() {
  const e = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (e) {
    try {
      const t = JSON.parse(e);
      if (t && Array.isArray(t.users)) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(t.users));
        return t;
      }
    } catch (t) {
      console.warn("Failed to parse legacy user storage:", t);
    }
  }

  const t = localStorage.getItem(USERS_STORAGE_KEY);
  if (t) {
    try {
      const e = JSON.parse(t);
      if (Array.isArray(e)) return { users: e };
    } catch (e) {
      console.warn("Failed to parse users storage:", e);
    }
  }

  return null;
}
function saveData() {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(appData.users || []));

  const e = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (e) {
    try {
      const t = JSON.parse(e);
      if (t && typeof t === "object") {
        t.users = appData.users || [];
        localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(t));
      }
    } catch (t) {
      console.warn("Failed syncing users to legacy storage:", t);
    }
  }
}
async function initUsers() {
  try {
    const users = (await LexFlowCasesStorage.getUsers()) || [];
    
    appData = { users: users.map((e) => normalizeUser(e)) };
    
    assignMissingFirmUserIds(appData.users);
    appData.users.forEach(syncRoleFromBadge);
    
    allUsers = appData.users;
    applyFilters();
  } catch (e) {
    console.error("User management init failed:", e);
  }
}
function computeStats(e) {
  return {
    total: e.length,
    activeLawyers: e.filter(
      (e) =>
        "active" === e.accountStatus &&
        ("lawyer" === e.badgeRole || "manager" === e.badgeRole),
    ).length,
    activeClients: e.filter(
      (e) => "active" === e.accountStatus && "client" === e.badgeRole,
    ).length,
  };
}
function updateStatsDisplay() {
  const {
    total: e,
    activeLawyers: t,
    activeClients: a,
  } = computeStats(allUsers);
  ((document.getElementById("statTotal").textContent = String(e).padStart(
    3,
    "0",
  )),
    (document.getElementById("statLawyers").textContent = String(t).padStart(
      3,
      "0",
    )),
    (document.getElementById("statClients").textContent = String(a).padStart(
      3,
      "0",
    )));
}
const BADGE_LABELS = { manager: "Manager", lawyer: "Lawyer", client: "Client" };
function badgeClass(e) {
  return "manager" === e
    ? "users-badge users-badge--manager"
    : "lawyer" === e
      ? "users-badge users-badge--lawyer"
      : "users-badge users-badge--client";
}
function renderUserRow(e) {
  const t =
      "available" === e.availability
        ? '<span class="users-dot users-dot--ok"></span>'
        : '<span class="users-dot users-dot--muted"></span>',
    a = "available" === e.availability ? "Available" : "Not available",
    n =
      "active" === e.accountStatus
        ? '<span class="users-status-pill users-status-pill--active">Active</span>'
        : '<span class="users-status-pill users-status-pill--inactive">Inactive</span>',
    s = escapeHtml(e.name || ""),
    r = escapeHtml(e.email || ""),
    l = escapeHtml(e.firmUserId || ""),
    o = escapeAttr(e.id),
    i = null,
    d = `<button type="button" class="users-action-btn" data-action="edit" data-id="${o}" title="Edit">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>`,
    c = `<button type="button" class="users-action-btn users-action-btn--danger" data-action="delete" data-id="${o}" title="Delete">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>`;
  return `
    <tr data-id="${o}">
      <td>
        <div class="users-cell-name">
          <div class="users-avatar">${escapeHtml(e.avatar || "?")}</div>
          <div>
            <div class="users-name">${s}</div>
            <div class="users-id-sub">ID: ${l}</div>
          </div>
        </div>
      </td>
      <td>${r}</td>
      <td><span class="${badgeClass(e.badgeRole)}">${BADGE_LABELS[e.badgeRole] || e.badgeRole}</span></td>
      <td>
        <div class="users-status-cell">${t}<span>${a}</span></div>
        <div class="users-account-line">${n}</div>
      </td>
      <td class="users-td-actions" style="display: flex; gap: 8px;">
        ${d}
        ${c}
      </td>
    </tr>`;
}
function escapeHtml(e) {
  return String(e)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(e) {
  return escapeHtml(e).replace(/'/g, "&#39;");
}
function applyFilters() {
  const e = (document.getElementById("userSearchInput").value || "")
      .trim()
      .toLowerCase(),
    t = document.getElementById("roleFilterSelect").value;
  ((filteredUsers = allUsers.filter((a) => {
    if ("all" !== t && a.badgeRole !== t) return !1;
    if (!e) return !0;
    return `${a.name} ${a.email} ${a.firmUserId} ${a.badgeRole} ${a.accountStatus} ${a.availability}`
      .toLowerCase()
      .includes(e);
  })),
    (currentPage = 1),
    renderUserPage(currentPage),
    updateStatsDisplay());
}
function renderUserPage(e) {
  const t = document.getElementById("usersTableBody"),
    a = document.getElementById("usersNoResults"),
    n = Math.ceil(filteredUsers.length / 8) || 1;
  ((e = Math.max(1, Math.min(e, n))), (currentPage = e));
  const s = 8 * (e - 1),
    r = filteredUsers.slice(s, s + 8);
  0 === r.length
    ? ((t.innerHTML = ""), (a.style.display = "block"))
    : ((a.style.display = "none"),
      (t.innerHTML = r.map(renderUserRow).join("")),
      t.querySelectorAll("button[data-action]").forEach((e) => {
        e.addEventListener("click", () => {
          const t = e.getAttribute("data-id"),
            a = e.getAttribute("data-action");
          ("edit" === a && openEditModal(t), "delete" === a && deleteUser(t));
        });
      }));
  const l = Math.min(s + 8, filteredUsers.length);
  document.getElementById("usersPaginationInfo").innerHTML =
    0 === filteredUsers.length
      ? "Showing <strong>0</strong> users"
      : `Showing <strong>${s + 1}</strong> to <strong>${l}</strong> of <strong>${filteredUsers.length}</strong> users`;
  const o = document.getElementById("usersPaginationPages");
  let i = `<button class="pg-arrow users-pg-text" ${e <= 1 ? "disabled" : ""} data-page="${e - 1}">Previous</button>`;
  for (let t = 1; t <= n; t++)
    i += `<button type="button" data-page="${t}" class="${t === e ? "active" : ""}">${t}</button>`;
  ((i += `<button class="pg-arrow users-pg-text" ${e >= n ? "disabled" : ""} data-page="${e + 1}">Next</button>`),
    (o.innerHTML = i),
    o.querySelectorAll("button[data-page]").forEach((e) => {
      e.addEventListener("click", function () {
        const e = parseInt(this.dataset.page, 10);
        isNaN(e) || renderUserPage(e);
      });
    }));
}
function openModal() {
  document.getElementById("userModal").classList.add("active");
}
function closeModal() {
  (document.getElementById("userModal").classList.remove("active"),
    (editingUserId = null));
}
function setToggleGroup(e, t) {
  ("accountStatus" === e && (formAccountStatus = t),
    "availability" === e && (formAvailability = t),
    document.querySelectorAll(`[data-field="${e}"]`).forEach((e) => {
      const a = e.getAttribute("data-value");
      e.classList.toggle("active", a === t);
    }));
}
function resetFormForCreate() {
  ((editingUserId = null),
    LexValidation.clearAllErrors(
      document.querySelector("#userModal .modal-body"),
    ),
    (document.getElementById("userFormId").value = ""),
    (document.getElementById("userFormName").value = ""),
    (document.getElementById("userFormEmail").value = ""),
    (document.getElementById("userFormPhone").value = ""),
    (document.getElementById("userFormBadgeRole").value = ""),
    (formAccountStatus = "active"),
    (formAvailability = "available"),
    setToggleGroup("accountStatus", "active"),
    setToggleGroup("availability", "available"),
    (document.getElementById("userModalTitle").textContent = "Add New User"),
    (document.getElementById("userFormSubmit").textContent = "Create User"));
}
function openCreateModal() {
  (resetFormForCreate(), openModal());
}
function openEditModal(e) {
  const t = allUsers.find((t) => t.id === e);
  t &&
    ((editingUserId = e),
    (document.getElementById("userFormId").value = t.id),
    (document.getElementById("userFormName").value = t.name || ""),
    (document.getElementById("userFormEmail").value = t.email || ""),
    (document.getElementById("userFormPhone").value = t.phone || ""),
    (document.getElementById("userFormBadgeRole").value = t.badgeRole || ""),
    (formAccountStatus = t.accountStatus || "active"),
    (formAvailability = t.availability || "available"),
    setToggleGroup("accountStatus", formAccountStatus),
    setToggleGroup("availability", formAvailability),
    (document.getElementById("userModalTitle").textContent = "Edit User"),
    (document.getElementById("userFormSubmit").textContent = "Save Changes"),
    openModal());
}
function validateEmailUnique(e, t) {
  const a = e.trim().toLowerCase();
  return !allUsers.some(
    (e) => e.email.trim().toLowerCase() === a && e.id !== t,
  );
}
function submitUserForm() {
  const e = document.getElementById("userFormName"),
    t = document.getElementById("userFormEmail"),
    a = document.getElementById("userFormPhone"),
    n = document.getElementById("userFormBadgeRole"),
    s = document.querySelector("#userModal .modal-body");
  LexValidation.clearAllErrors(s);
  const r = [
    { input: e, validator: (e) => LexValidation.validateName(e, "Full name") },
    {
      input: t,
      validator: (e) => {
        const t = LexValidation.validateEmail(e);
        return (
          t ||
          (validateEmailUnique(e, editingUserId)
            ? null
            : "Another user already uses this email address")
        );
      },
    },
    { input: a, validator: LexValidation.validateIndianPhone },
    { input: n, validator: (e) => LexValidation.validateSelect(e, "role") },
  ];
  if (!LexValidation.validateForm(r)) {
    const e = document.querySelector("#userModal .modal-content");
    return (
      e.classList.add("form-shake"),
      void setTimeout(() => e.classList.remove("form-shake"), 450)
    );
  }
  const l = e.value.trim(),
    o = t.value.trim(),
    i = a.value.trim(),
    d = n.value;
  if (editingUserId) {
    const e = appData.users.findIndex((e) => e.id === editingUserId);
    if (-1 === e) return;
    const t = appData.users[e];
    ((appData.users[e] = {
      ...t,
      name: l,
      fullName: l,
      email: o,
      phone: i,
      badgeRole: d,
      accountStatus: formAccountStatus,
      availability: formAvailability,
    }),
      syncRoleFromBadge(appData.users[e]));
    const a = l.split(/\s+/);
    appData.users[e].avatar =
      a.length >= 2
        ? (a[0][0] + a[a.length - 1][0]).toUpperCase()
        : l.slice(0, 2).toUpperCase();
  } else {
    const e = {
      id: nextInternalId(appData.users, d),
      name: l,
      fullName: l,
      email: o,
      password: "changeme123",
      phone: i,
      firmUserId: nextFirmUserId(appData.users),
      badgeRole: d,
      accountStatus: formAccountStatus,
      availability: formAvailability,
    };
    syncRoleFromBadge(e);
    const t = l.split(/\s+/);
    ((e.avatar =
      t.length >= 2
        ? (t[0][0] + t[t.length - 1][0]).toUpperCase()
        : l.slice(0, 2).toUpperCase()),
      "firmAdmin" === e.role &&
        ((e.barCouncilId = ""),
        (e.specialisation = ""),
        (e.winRate = 0),
        (e.totalCases = 0),
        (e.won = 0),
        (e.lost = 0),
        (e.ongoing = 0)),
      appData.users.push(e));
  }
  (syncLawyersWithUsers(appData.users),
    saveData(),
    (allUsers = appData.users),
    closeModal(),
    applyFilters());
}
function deleteUser(e) {
  const t = allUsers.find((t) => t.id === e);
  t &&
    confirm(`Remove ${t.name} from the firm? This cannot be undone.`) &&
    ((appData.users = appData.users.filter((t) => t.id !== e)),
    syncLawyersWithUsers(appData.users),
    saveData(),
    (allUsers = appData.users),
    applyFilters());
}
function exportUsersJson() {
  const e = new Blob([JSON.stringify(allUsers, null, 2)], {
      type: "application/json",
    }),
    t = document.createElement("a");
  ((t.href = URL.createObjectURL(e)),
    (t.download = "lexflow-users-export.json"),
    t.click(),
    URL.revokeObjectURL(t.href));
}
(document
  .getElementById("userSearchInput")
  .addEventListener("input", applyFilters),
  document
    .getElementById("roleFilterSelect")
    .addEventListener("change", applyFilters),
  document
    .getElementById("addUserBtn")
    .addEventListener("click", openCreateModal),
  document
    .getElementById("exportUsersBtn")
    .addEventListener("click", exportUsersJson),
  document
    .getElementById("userModalClose")
    .addEventListener("click", closeModal),
  document
    .getElementById("userFormCancel")
    .addEventListener("click", closeModal),
  document
    .getElementById("userFormSubmit")
    .addEventListener("click", submitUserForm),
  document.getElementById("userModal").addEventListener("click", (e) => {
    "userModal" === e.target.id && closeModal();
  }),
  document.addEventListener("keydown", (e) => {
    "Escape" === e.key &&
      document.getElementById("userModal").classList.contains("active") &&
      closeModal();
  }),
  document.querySelectorAll(".users-toggle-btn[data-field]").forEach((e) => {
    e.addEventListener("click", () => {
      setToggleGroup(
        e.getAttribute("data-field"),
        e.getAttribute("data-value"),
      );
    });
  }),
  initUsers());
