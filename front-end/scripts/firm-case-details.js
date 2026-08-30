let allData = {},
  currentCase = null,
  currentTasks = [];

// Use shared cases storage utility
const casesStorage = window.LexFlowCasesStorage;




function saveAllData() {
  // No-op: backend is the source of truth
}
const caseTopTitle = document.getElementById("caseTopTitle"),
  caseTopSub = document.getElementById("caseTopSub"),
  caseProgPct = document.getElementById("caseProgPct"),
  caseProgFill = document.getElementById("caseProgFill"),
  caseTopStatus = document.getElementById("caseTopStatus"),
  teamContainer = document.getElementById("teamContainer"),
  clientContact = document.getElementById("clientContact"),
  opposingParty = document.getElementById("opposingParty"),
  pendingCountBadge = document.getElementById("pendingCountBadge"),
  pendingTasksContainer = document.getElementById("pendingTasksContainer"),
  documentsTbody = document.getElementById("documentsTbody");
async function initCaseDetails() {
  try {
    const cnrFromUrl = new URLSearchParams(window.location.search).get("cnr");
    const idFromUrl = new URLSearchParams(window.location.search).get("id");
    
    if (idFromUrl) {
      currentCase = await casesStorage.getCaseById(idFromUrl);
      // Fallback: if id field is missing, search from full list
      if (currentCase && currentCase.id === undefined) {
        const allCases = await casesStorage.getCases();
        currentCase = allCases.find(c => String(c.id) === String(idFromUrl)) || currentCase;
      }
    } else if (cnrFromUrl) {
      currentCase = await casesStorage.getCaseByCnr(cnrFromUrl);
    }

    if (!currentCase) { 
      window.location.href = 'firm-cases.html'; 
      return; 
    }

    // Fetch tasks specifically for this case
    const resolvedCaseId = currentCase.id !== undefined ? String(currentCase.id) : null;
    console.log("[DEBUG] currentCase object:", JSON.stringify(currentCase));
    console.log("[DEBUG] Resolved caseId for task fetch:", resolvedCaseId);
    currentTasks = resolvedCaseId
      ? (await casesStorage.getTasks({ caseId: resolvedCaseId })) || []
      : [];
    console.log("[DEBUG] Tasks received count:", currentTasks.length);
    const user = casesStorage.getCurrentUser();
    const firmId = user?.firmId || null;
    const role = (user?.role || 'firmadmin').toLowerCase();

    // Fetch users (lawyers) specifically for this firm
    let users = [];
    if (firmId && window.LexFlowAPI) {
      users = await window.LexFlowAPI.users.getLawyers(firmId, role);
    } else {
      users = (await casesStorage.getUsers()) || [];
    }
    
    // Maintain legacy allData.users for modals
    allData.users = users;

    if (!currentCase.timeline) currentCase.timeline = [];
    // Load this case's documents from the backend
    try {
      const resp = await fetch(`http://localhost:3000/documents?caseId=${currentCase.id}`, {
        headers: { role },
      });
      if (resp.ok) currentCase.documents = await resp.json();
    } catch (e) { console.warn("Could not load case documents:", e); }
    if (!currentCase.documents) currentCase.documents = [];
    if (!currentCase.client || !currentCase.client.contact || currentCase.client.contact === "Data Pending") {
      if (currentCase.client_id && window.LexFlowAPI) {
        try {
          const clientUser = await window.LexFlowAPI.users.getById(currentCase.client_id, role);
          if (clientUser) {
            currentCase.client = {
              contact: clientUser.fullName || clientUser.name || "N/A",
              type: clientUser.role ? clientUser.role.charAt(0).toUpperCase() + clientUser.role.slice(1) : "Client",
              opposingParty: currentCase.client?.opposingParty || "Pending",
              email: clientUser.email || "N/A",
              phone: clientUser.phoneNumber || "N/A"
            };
          }
        } catch (err) {
          console.error("Failed to fetch client details:", err);
        }
      }
      
      if (!currentCase.client) {
        currentCase.client = {
          contact: "Data Pending",
          type: "Individual",
          opposingParty: "None/Unknown",
          email: "N/A",
          phone: "N/A"
        };
      }
    }
    
    if (!currentCase.team || currentCase.team.length === 0) {
      const lawyer = users.find(u => String(u.id) === String(currentCase.lawyer_id)) || { fullName: "Assigned Lawyer" };
      currentCase.team = [
        {
          id: currentCase.lawyer_id || "ADM001",
          name: lawyer.fullName || lawyer.name,
          role: "Lead Counsel",
        },
      ];
    }

    (renderHeader(),
      renderOverview(),
      renderTeam(),
      renderClientInfo(),
      renderPendingTasks(),
      renderDocuments());
  } catch (e) {
    console.error("Error loading case details:", e);
  }
}
function formatDate(e) {
  if (!e) return "";
  return new Date(e).toLocaleDateString(void 0, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function getStatusIcon(e) {
  return "Completed" === e
    ? '\n            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">\n                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="#D1FAE5" stroke="#10B981" stroke-width="2" stroke-linejoin="round"/>\n                <path d="M14 2V8H20" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n                <circle cx="17" cy="17" r="5" fill="#10B981"/>\n                <path d="M15 17L16.5 18.5L19 15.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>\n            </svg>'
    : '\n            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">\n                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/>\n                <path d="M14 2V8H20" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n                <circle cx="17" cy="17" r="5" fill="#F59E0B"/>\n                <path d="M15.5 15.5L18.5 18.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>\n                <path d="M18.5 15.5L15.5 18.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>\n            </svg>';
}
function renderHeader() {
  ((document.querySelector(".breadcrumb .current").textContent =
    `Case #${currentCase.cnr}`),
    (caseTopTitle.textContent = currentCase.case_type || 'N/A'),
    (caseTopSub.textContent = `${currentCase.case_type} | Opened: ${formatDate(currentCase.filed_date)}`),
    (caseTopStatus.textContent = currentCase.status),
    "Ongoing" === currentCase.status || "Active" === currentCase.status
      ? ((caseTopStatus.style.background = "#d1fae5"),
        (caseTopStatus.style.color = "#065f46"))
      : ((caseTopStatus.style.background = "#fef3c7"),
        (caseTopStatus.style.color = "#92400e")));
}
function renderOverview() {
  ((caseProgPct.textContent = `${currentCase.progress}% Completed`),
    setTimeout(() => {
      caseProgFill.style.width = `${currentCase.progress}%`;
    }, 100),
    renderPhases());
}
function renderPhases() {
  const e = currentCase.progress || 0,
    t = document.getElementById("phaseTitle"),
    n = [
      { id: "phase-1", name: "Filing", min: 0, max: 20 },
      { id: "phase-2", name: "Preparation", min: 21, max: 40 },
      { id: "phase-3", name: "Discovery", min: 41, max: 60 },
      { id: "phase-4", name: "Mediation", min: 61, max: 80 },
      { id: "phase-5", name: "Trial", min: 81, max: 100 },
    ];
  let a = n[0];
  if (
    (n.forEach((t, n) => {
      const o = document.getElementById(t.id);
      o &&
        (e >= t.min
          ? ((o.style.color = "#3b5bdb"),
            (o.style.fontWeight = "800"),
            (a = { ...t, index: n + 1 }))
          : ((o.style.color = "#9ca3af"), (o.style.fontWeight = "700")));
    }),
    t)
  ) {
    let e = "";
    ("Discovery" === a.name && (e = " & Evidence Collection"),
      "Filing" === a.name && (e = " & Documentation"),
      (t.textContent = `Phase ${a.index}: ${a.name}${e}`));
  }
}
function renderTeam() {
  if (!currentCase.team || currentCase.team.length === 0) {
    teamContainer.innerHTML = '<p style="color:#6b7280; font-size:12px; padding:8px;">No team members assigned.</p>';
    return;
  }
  
  teamContainer.innerHTML = currentCase.team
    .map((e) => {
      const initials = (e.name || "AL").split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const isLead = e.role.toLowerCase().includes('lead');
      const bg = isLead ? '#eef2ff' : '#f3f4f6';
      const color = isLead ? '#3b5bdb' : '#4b5563';
      
      return `
        <div style="display: flex; gap: 14px; align-items: center; padding: 4px 0;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: ${bg}; color: ${color}; display: flex; align-items:center; justify-content:center; font-size: 13px; font-weight:700; border: 1px solid rgba(0,0,0,0.05);">${initials}</div>
            <div style="display:flex; flex-direction:column; gap: 2px;">
                <span style="font-size:14px; font-weight:700; color:#1a1a2e;">${e.name}</span>
                <span style="font-size:11px; font-weight:600; color:#6b7280; text-transform: uppercase; letter-spacing: 0.3px;">${e.role}</span>
            </div>
        </div>
      `;
    })
    .join("");
}
function renderClientInfo() {
  clientContact.textContent = currentCase.client.contact;
  const typeEl = document.getElementById("clientType");
  if (typeEl) typeEl.textContent = currentCase.client.type;
  
  const emailEl = document.getElementById("clientEmail");
  if (emailEl) emailEl.textContent = currentCase.client.email || "N/A";
  
  const phoneEl = document.getElementById("clientPhone");
  if (phoneEl) phoneEl.textContent = currentCase.client.phone || "N/A";
  
  opposingParty.textContent = currentCase.client.opposingParty;
}
function renderPendingBanner() {
  const e = currentTasks.filter((e) => "Pending" === e.status),
    t = document.querySelector(".content"),
    n = document.getElementById("pendingTasksBanner");
  if ((n && n.remove(), e.length > 0)) {
    const n = document.createElement("div");
    ((n.id = "pendingTasksBanner"),
      (n.className = "hearing-banner"),
      (n.style.background = "#fffbeb"),
      (n.style.border = "1px solid #fde68a"),
      (n.style.marginBottom = "24px"),
      (n.style.padding = "12px 20px"),
      (n.style.cursor = "pointer"),
      (n.onclick = () =>
        document
          .getElementById("pendingTasksContainer")
          .scrollIntoView({ behavior: "smooth" })),
      (n.innerHTML = `\n            <div class="task-status-icon" style="width:32px; height:32px;">\n                ${getStatusIcon("Pending")}\n            </div>\n            <div class="hearing-info">\n                <div class="title" style="color: #92400e;">You have ${e.length} pending tasks for this case</div>\n                <div class="sub" style="color: #b45309;">Please review and update the status of these responsibilities.</div>\n            </div>\n            <div style="margin-left:auto; color:#d97706;">\n                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>\n            </div>\n        `),
      t.prepend(n));
  }
}
function renderPendingTasks() {
  const e = currentTasks.filter((e) => "Pending" === e.status);
  ((pendingCountBadge.textContent = e.length),
    0 !== e.length
      ? ((pendingTasksContainer.innerHTML = e
          .map(
            (e) =>
              `\n            <div style="display:flex; gap:12px; align-items:center; border: 1px solid #f3f4f6; padding: 12px; border-radius: 8px; background: #fffaf0; border-left: 4px solid #f59e0b;">\n                <div class="task-status-icon" style="width:24px; height:24px; flex-shrink:0;">\n                    ${getStatusIcon("Pending")}\n                </div>\n                <div style="display:flex; flex-direction:column; gap:2px; flex:1;">\n                    <div style="display:flex; justify-content:space-between; align-items:center;">\n                        <span style="font-size:13px; font-weight:700; color:#1a1a2e;">${e.name}</span>\n                        <span style="font-size:10px; font-weight:700; color:#3b5bdb; background:#eef2ff; padding:2px 6px; border-radius:4px;">${e.assignedUser}</span>\n                    </div>\n                    <span style="font-size:11px; font-weight:600; color:#92400e; display:flex; align-items:center; gap:4px;">\n                        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>\n                        Due: ${e.dueDate}\n                    </span>\n                </div>\n                <input type="checkbox" style="width:16px; height:16px; cursor:pointer;" onclick="event.stopPropagation(); markTaskAsDone('${e.id}')" />\n            </div>\n        `,
          )
          .join("")),
        window.markTaskAsDone ||
          (window.markTaskAsDone = async (id) => {
            try {
              const role = (currentUserData.role || 'firmAdmin').toLowerCase();
              await LexFlowAPI.tasks.update(id, { status: "Completed" }, role);
              await initCaseDetails(); // Refresh UI
            } catch (err) {
              console.error("Failed to complete task:", err);
            }
          }))
      : (pendingTasksContainer.innerHTML =
          '<div style="font-size:12px; color:#9ca3af; padding:12px; text-align:center;">No pending tasks.</div>'));
}

function renderDocuments() {
  (currentCase.documents || (currentCase.documents = []),
    0 !== currentCase.documents.length
      ? (documentsTbody.innerHTML = currentCase.documents
          .map((e, t) => {
            let n = e.type ? e.type.toUpperCase() : "DOC",
              a = e.type ? e.type.toLowerCase() : "pdf";
            return (
              "pdf" !== a && "zip" !== a && (a = "pdf"),
              `\n        <tr>\n            <td>\n                <div class="doc-name">\n                    <div class="doc-icon ${a}">${n}</div>\n                    <span>${e.name}</span>\n                </div>\n            </td>\n            <td>${e.date || "Today"}</td>\n            <td>\n                <span class="badge-${"Reviewing" === e.status ? "reviewing" : "verified"}">\n                    ${e.status || "Verified"}\n                </span>\n            </td>\n            <td>\n                <div style="display:flex; gap: 8px;">\n                    <a href="../Client/case_management_client/legalheir.pdf" download="legalheir.pdf" class="download-btn" title="Download"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/></svg></a>\n                    <button class="download-btn" title="Delete Document" onclick="deleteDocument(${t})" style="color:#ef4444;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>\n                </div>\n            </td>\n        </tr>\n        `
            );
          })
          .join(""))
      : (documentsTbody.innerHTML =
          '<tr><td colspan="4" style="text-align:center; padding: 24px; color:#9ca3af;">No documents available.</td></tr>'));
}
async function saveData() {
  if (!currentCase || !currentCase.id) return;
  try {
    // Strip read-only properties that the backend DTO rejects
    const { id, created_at, ...updateDto } = currentCase;

    await casesStorage.updateCase(id, updateDto);
    console.log("[DEBUG] Case updated successfully");
    await initCaseDetails(); // Refresh UI
  } catch (err) {
    console.error("Failed to save case data:", err);
    alert("Failed to save changes to backend: " + err.message);
  }
}
function renderEditTeamList() {
  const listEl = document.getElementById("editTeamList");
  if (!listEl) return;
  
  listEl.innerHTML = (currentCase.team || [])
    .map(
      (e, t) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f9fafb; padding:10px 14px; border-radius:8px; border: 1px solid #f3f4f6;">
            <div style="display:flex; flex-direction:column;">
                <div style="font-size:13px; font-weight:700; color: #111827;">${e.name}</div>
                <div style="font-size:11px; color:#6b7280; font-weight: 500;">${e.role}</div>
            </div>
            <button onclick="removeTeamMember(${t})" style="color:#9ca3af; border:none; background:none; cursor:pointer; font-size: 18px; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#9ca3af'">&times;</button>
        </div>
    `,
    )
    .join("");
}
((window.openModal = function (e) {
  document.getElementById(e).classList.add("active");
}),
  (window.closeModal = function (e) {
    const t = document.getElementById(e);
    (LexValidation.clearAllErrors(t), t.classList.remove("active"));
  }),
  (window.exportCSV = function () {
    let e = "data:text/csv;charset=utf-8,";
    ((e += "Case ID,Title,Court,Status,Opened\n"),
      (e += `"${currentCase.cnr}","${currentCase.case_type}","${currentCase.brief_description}","${currentCase.status}","${currentCase.filed_date}"`));
    var t = encodeURI(e),
      n = document.createElement("a");
    (n.setAttribute("href", t),
      n.setAttribute("download", `case_export_${currentCase.cnr}.csv`),
      document.body.appendChild(n),
      n.click(),
      document.body.removeChild(n));
  }),
  (window.openEditCaseModal = function () {
    ((document.getElementById("editCaseTitle").value = currentCase.case_type || ''),
      (document.getElementById("editCaseStatus").value = currentCase.status || 'Active'),
      (document.getElementById("editCaseProgress").value =
        currentCase.progress || 0),
      openModal("editCaseModal"));
  }),
  (window.saveCaseDetailsModal = async function () {
    const e = document.getElementById("editCaseTitle"),
      t = document.getElementById("editCaseProgress"),
      n = document.getElementById("editCaseModal");
    LexValidation.clearAllErrors(n);
    const a = [
      {
        input: e,
        validator: (e) => LexValidation.validateRequired(e, "Case title"),
      },
      { input: t, validator: LexValidation.validateProgress },
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
    ((currentCase.case_type = e.value.trim()),
      (currentCase.status = document.getElementById("editCaseStatus").value),
      (currentCase.progress = parseInt(t.value, 10)),
      await saveData(),
      closeModal("editCaseModal"));
  }),
  (window.addDocumentPrompt = function () {
    ((document.getElementById("docClientName").value = (currentCase.case_type || "")
      .split("vs.")[0]
      .trim()),
      (document.getElementById("docCaseCnr").value = currentCase.cnr),
      (document.getElementById("docDescription").value = ""),
      (document.getElementById("selectedFileName").innerHTML =
        'Drag & Drop Files Here or <span style="color:#3b5bdb; text-decoration:underline;">Click to Upload</span>'),
      openModal("documentModal"));
  }),
  (window.saveDocumentModal = async function () {
    const typeSelect = document.getElementById("docTypeSelect");
    const e = typeSelect ? typeSelect.value : "PDF";
    const fileInput = document.getElementById("hiddenFileInput");
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("name", file.name);
    formData.append("caseId", String(currentCase.id));

    let docType = "CLIENT PROOF";
    if (e === "DOC") docType = "CONTRACT";
    else if (e === "ZIP") docType = "CASE EVIDENCE";

    formData.append("type", docType);
    
    const ext = file.name.split('.').pop() || "PDF";
    formData.append("fileType", ext.toUpperCase().slice(0, 3));
    
    let access = "SHARED";
    const accessSelect = document.querySelector("#documentModal .form-row:nth-child(2) select:nth-child(2)");
    if (accessSelect && accessSelect.value && accessSelect.value.includes("Firm")) {
      access = "PRIVATE";
    }
    formData.append("access", access);
    formData.append("file", file);

    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const role = (currentUserData.role || 'firmAdmin').toLowerCase();
    const email = currentUserData.email || 'firmadmin@lexflow.in';

    try {
      const resp = await fetch("http://localhost:3000/documents", {
        method: "POST",
        headers: {
          "role": role,
          "x-user-email": email
        },
        body: formData
      });
      if (!resp.ok) throw new Error("Upload failed");
      
      const newDoc = await resp.json();
      currentCase.documents = currentCase.documents || [];
      currentCase.documents.push(newDoc);
      renderDocuments();
      closeModal("documentModal");
    } catch(err) {
      console.error(err);
      alert("Upload failed. Is the server running?");
    }
  }),
  (window.deleteDocument = async function (e) {
    if (!currentCase || !Array.isArray(currentCase.documents) || e < 0 || e >= currentCase.documents.length) return;
    if (confirm("Are you sure you want to delete this document?")) {
      const doc = currentCase.documents[e];
      const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const role = (currentUserData.role || 'firmAdmin').toLowerCase();
      const email = currentUserData.email || 'firmadmin@lexflow.in';
      try {
        if (doc.id && String(doc.id).startsWith("DOC-")) {
          await fetch(`http://localhost:3000/documents/${doc.id}`, {
            method: "DELETE",
            headers: { "role": role, "x-user-email": email }
          });
        }
      } catch(err) { console.error(err); }
      currentCase.documents.splice(e, 1);
      renderDocuments();
    }
  }),

  (window.openEditClientModal = function () {
    ((document.getElementById("editClientContact").value =
      currentCase.client.contact),
      (document.getElementById("editClientEmail").value =
        currentCase.client.email || ""),
      (document.getElementById("editClientPhone").value =
        currentCase.client.phone || ""),
      (document.getElementById("editClientType").value =
        currentCase.client.type),
      (document.getElementById("editOpposingParty").value =
        currentCase.client.opposingParty),
      openModal("editClientModal"));
  }),
  (window.saveClientDetails = async function () {
    const e = document.getElementById("editClientContact"),
      t = document.getElementById("editClientModal");
    LexValidation.clearAllErrors(t);
    const n = [
      {
        input: e,
        validator: (e) => LexValidation.validateRequired(e, "Primary contact"),
      },
    ];
    if (!LexValidation.validateForm(n))
      return (
        t.querySelector(".modal-content").classList.add("form-shake"),
        void setTimeout(
          () =>
            t.querySelector(".modal-content").classList.remove("form-shake"),
          450,
        )
      );
    ((currentCase.client = {
      contact: e.value.trim(),
      email: document.getElementById("editClientEmail").value.trim(),
      phone: document.getElementById("editClientPhone").value.trim(),
      type: document.getElementById("editClientType").value,
      opposingParty: document.getElementById("editOpposingParty").value.trim(),
    }),
      await saveData(),
      closeModal("editClientModal"));
  }),
  (window.openEditTeamModal = function () {
    renderEditTeamList();
    ((document.getElementById("addTeamMemberSelect").innerHTML = allData.users
      .filter((e) => {
        const r = (e.role || '').toLowerCase();
        return r === "lawyer" || r === "intern";
      })
      .map((e) => `<option value="${e.id}">${e.fullName || e.name}</option>`)
      .join("")),
      openModal("editTeamModal"));
  }),
  (window.addTeamMember = async function () {
    const e = document.getElementById("addTeamMemberSelect"),
      roleInput = document.getElementById("addTeamMemberRole"),
      t = roleInput.value.trim() || "Legal Counsel",
      n = allData.users.find((t) => t.id === e.value);
    
    if (n) {
      if (!currentCase.team) currentCase.team = [];
      currentCase.team.push({ 
        id: n.id, 
        name: n.fullName || n.name, 
        role: t 
      });
      roleInput.value = ""; // Clear input
      await saveData();
      renderEditTeamList();
    }
  }),
  (window.removeTeamMember = async function (e) {
    (currentCase.team.splice(e, 1), await saveData(), renderEditTeamList());
  }),
  (window.openAddTaskModal = function () {
    ((document.getElementById("newTaskAssignee").innerHTML = allData.users
      .filter(u => {
        const r = (u.role || '').toLowerCase();
        return r === 'lawyer' || r === 'intern';
      })
      .map((e) => `<option value="${e.fullName || e.name}">${e.fullName || e.name}</option>`)
      .join("")),
      openModal("addTaskModal"));
  }),
  (window.saveNewTask = async function () {
    const e = document.getElementById("newTaskName"),
      t = document.getElementById("newTaskDueDate"),
      n = document.getElementById("addTaskModal");
    LexValidation.clearAllErrors(n);
    const a = [
      {
        input: e,
        validator: (e) => LexValidation.validateRequired(e, "Task name"),
      },
      { input: t, validator: (e) => LexValidation.validateDate(e, "Due date") },
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
    const o = document.getElementById("newTaskAssignee").value;
    const i = document.getElementById("newTaskPriority").value;
    let currentUserData = {};
    try { currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch (e) {}

    const payload = {
        name: e.value.trim(),
        caseTitle: currentCase.case_type || 'N/A',
        assignedUser: o,
        priority: i,
        dueDate: t.value,
        status: "Pending",
        caseId: String(currentCase.id),
        caseCnr: currentCase.cnr,
        firmId: currentUserData.firmId || 'firm-1',
        description: ""
    };

    try {
        const role = (currentUserData.role || 'firmAdmin').toLowerCase();
        await LexFlowAPI.tasks.create(payload, role);
        closeModal("addTaskModal");
        await initCaseDetails(); // Refresh everything
    } catch (err) {
        console.error("Failed to create task:", err);
        alert("Failed to create task. Is the server running?");
    }
  }),
  window.addEventListener("DOMContentLoaded", initCaseDetails));
