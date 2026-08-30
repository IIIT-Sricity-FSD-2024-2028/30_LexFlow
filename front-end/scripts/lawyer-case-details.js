let currentCase = null,
  currentTasks = [];

const casesAPI = window.LexFlowAPI ? window.LexFlowAPI.cases : null;
const tasksAPI = window.LexFlowAPI ? window.LexFlowAPI.tasks : null;

const currentUserData = (() => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch { return {}; }
})();

const currentUser = {
  role: (currentUserData.role || 'lawyer').toLowerCase(),
  name: currentUserData.fullName || currentUserData.name || 'Lawyer'
};

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
  timelineContainer = document.getElementById("timelineContainer"),
  documentsTbody = document.getElementById("documentsTbody");

async function initCaseDetails() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const caseId = urlParams.get("id");
    const caseCnr = urlParams.get("cnr");

    if (!caseId && !caseCnr) {
      console.error("No case ID or CNR provided in URL");
      return;
    }

    // 1. Fetch Case from API
    if (casesAPI) {
      if (caseId) {
        currentCase = await casesAPI.getById(caseId, currentUser.role);
      } else {
        // Fallback to searching by CNR if ID is missing
        const allCases = await casesAPI.getAll({}, currentUser.role);
        currentCase = allCases.find(c => c.cnr === caseCnr);
      }
    }

    if (!currentCase) {
      console.error("Case not found");
      return;
    }

    // 2. Fetch Tasks for this case
    if (tasksAPI) {
      currentTasks = await tasksAPI.getAll({ caseId: currentCase.id }, currentUser.role);
    }

    renderHeader();
    renderOverview();
    renderTeam();
    renderClientInfo();
    renderPendingTasks();
    renderTimeline();
    // Load this case's documents from the backend
    try {
      const resp = await fetch(`http://localhost:3000/documents?caseId=${currentCase.id}`, {
        headers: { role: currentUser.role },
      });
      if (resp.ok) currentCase.documents = await resp.json();
    } catch (e) { console.warn("Could not load case documents:", e); }
    renderDocuments();
    renderPendingBanner();
  } catch (e) {
    console.error("Error loading case details:", e);
  }
}

function formatDate(e) {
  if (!e) return "TBD";
  const d = new Date(e);
  if (isNaN(d.getTime())) return e;
  return d.toLocaleDateString(void 0, {
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
  const breadcrumb = document.querySelector(".breadcrumb .current");
  if (breadcrumb) breadcrumb.textContent = `Case #${currentCase.cnr || currentCase.id}`;
  
  caseTopTitle.textContent = currentCase.case_type || currentCase.title || "Legal Case";
  caseTopSub.textContent = `${currentCase.case_type || "General"} | Filed: ${formatDate(currentCase.filed_date || currentCase.filedDate)}`;
  caseTopStatus.textContent = currentCase.status || "Ongoing";
  
  const status = (currentCase.status || "Ongoing").toLowerCase();
  if (status === "ongoing" || status === "active" || status === "open") {
    caseTopStatus.style.background = "#d1fae5";
    caseTopStatus.style.color = "#065f46";
  } else {
    caseTopStatus.style.background = "#fef3c7";
    caseTopStatus.style.color = "#92400e";
  }
}

function renderOverview() {
  const progress = currentCase.progress || 0;
  caseProgPct.textContent = `${progress}% Completed`;
  setTimeout(() => {
    caseProgFill.style.width = `${progress}%`;
  }, 100);
  renderPhases();
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
  let i = n[0];
  n.forEach((t, n) => {
    const a = document.getElementById(t.id);
    if (a) {
      if (e >= t.min) {
        a.style.color = "#3b5bdb";
        a.style.fontWeight = "800";
        i = { ...t, index: n + 1 };
      } else {
        a.style.color = "#9ca3af";
        a.style.fontWeight = "700";
      }
    }
  });
  if (t) {
    let suffix = "";
    if (i.name === "Discovery") suffix = " & Evidence Collection";
    if (i.name === "Filing") suffix = " & Documentation";
    t.textContent = `Phase ${i.index}: ${i.name}${suffix}`;
  }
}

function renderTeam() {
  const lead = currentCase.assigned_lawyer || currentCase.lawyer_name || "Lead Attorney";
  teamContainer.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #eef2ff; color: #3b5bdb; display: flex; align-items:center; justify-content:center; font-size: 11px; font-weight:700;">${lead.substring(0, 2).toUpperCase()}</div>
            <div style="display:flex; flex-direction:column;">
                <span style="font-size:13px; font-weight:700; color:#1a1a2e;">${lead}</span>
                <span style="font-size:11px; color:#6b7280;">Lead Attorney</span>
            </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: center;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #f3f4f6; color: #6b7280; display: flex; align-items:center; justify-content:center; font-size: 11px; font-weight:700;">DC</div>
            <div style="display:flex; flex-direction:column;">
                <span style="font-size:13px; font-weight:700; color:#1a1a2e;">David Chen</span>
                <span style="font-size:11px; color:#6b7280;">Paralegal</span>
            </div>
        </div>
    `;
}

function renderClientInfo() {
  clientContact.textContent = currentCase.client_name || "Private Client";
  opposingParty.textContent = currentCase.opposing_party || "Respondent";
}

function renderPendingBanner() {
  const pending = currentTasks.filter((e) => "Pending" === e.status);
  const banner = document.getElementById("pendingTasksBanner");
  if (banner) banner.remove();
  
  if (pending.length > 0) {
    const n = document.createElement("div");
    n.id = "pendingTasksBanner";
    n.className = "hearing-banner";
    n.style.background = "#fffbeb";
    n.style.border = "1px solid #fde68a";
    n.style.marginBottom = "24px";
    n.style.padding = "12px 20px";
    n.style.cursor = "pointer";
    n.onclick = () => document.getElementById("pendingTasksContainer").scrollIntoView({ behavior: "smooth" });
    n.innerHTML = `
            <div class="task-status-icon" style="width:32px; height:32px;">
                ${getStatusIcon("Pending")}
            </div>
            <div class="hearing-info">
                <div class="title" style="color: #92400e;">You have ${pending.length} pending tasks for this case</div>
                <div class="sub" style="color: #b45309;">Please review and update the status of these responsibilities.</div>
            </div>
            <div style="margin-left:auto; color:#d97706;">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
        `;
    document.querySelector(".content").prepend(n);
  }
}

function renderPendingTasks() {
  const pending = currentTasks.filter((e) => "Pending" === e.status);
  pendingCountBadge.textContent = pending.length;
  if (pending.length !== 0) {
    pendingTasksContainer.innerHTML = pending
      .slice(0, 3)
      .map(e => `
            <div style="display:flex; gap:12px; align-items:center; border: 1px solid #f3f4f6; padding: 12px; border-radius: 8px; background: #fffaf0; border-left: 4px solid #f59e0b;">
                <div class="task-status-icon" style="width:24px; height:24px; flex-shrink:0;">
                    ${getStatusIcon("Pending")}
                </div>
                <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
                    <span style="font-size:13px; font-weight:700; color:#1a1a2e;">${e.name}</span>
                    <span style="font-size:11px; font-weight:600; color:#92400e; display:flex; align-items:center; gap:4px;">
                        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Due: ${new Date(e.dueDate).toLocaleDateString()}
                    </span>
                </div>
                <input type="checkbox" style="width:16px; height:16px; cursor:pointer;" onclick="event.stopPropagation(); markTaskAsDone('${e.id}')" />
            </div>
        `).join("");
    
    window.markTaskAsDone = async (id) => {
      if (tasksAPI) {
        await tasksAPI.update(id, { status: "Completed" }, currentUser.role);
        await initCaseDetails();
      }
    };
  } else {
    pendingTasksContainer.innerHTML = '<div style="font-size:12px; color:#9ca3af; padding:12px; text-align:center;">No pending tasks.</div>';
  }
}

function renderTimeline() {
  const timeline = currentCase.timeline || [];
  if (timeline.length !== 0) {
    timelineContainer.innerHTML = timeline
      .map((e, t) => `
        <div class="timeline-item ${e.grey ? "grey" : ""}" style="margin-bottom: 32px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                   <div class="t-title" style="font-size:14px; font-weight:700; color:#1a1a2e; display:flex; align-items:center; gap:8px;">
                      ${e.title}
                      <button onclick="editTimelineEvent(${t})" style="background:none;border:none;color:#9ca3af;cursor:pointer;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                      <button onclick="deleteTimelineEvent(${t})" style="background:none;border:none;color:#ef4444;cursor:pointer;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                   </div>
                   <div style="font-size:12px; color:#6b7280; margin-top:4px; max-width:80%; line-height:1.5;">${e.note || "Status updated automatically."}</div>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:10px; font-weight:700; color:#cbd5e1; text-transform:uppercase;">${e.date}</span>
                    ${e.upcoming ? '<div style="margin-top:6px;"><span class="badge-upcoming">UPCOMING</span></div>' : ""}
                </div>
            </div>
        </div>
    `).join("");
  } else {
    timelineContainer.innerHTML = '<p style="color:#6b7280; font-size:13px; margin:24px;">No timeline events recorded.</p>';
  }
}

function renderDocuments() {
  const documents = currentCase.documents || [];
  if (documents.length !== 0) {
    documentsTbody.innerHTML = documents
      .map((e, t) => {
        const n = (e.type || "DOC").toUpperCase();
        let i = (e.type || "pdf").toLowerCase();
        if (i !== "pdf" && i !== "zip") i = "pdf";
        return `
        <tr>
            <td>
                <div class="doc-name">
                    <div class="doc-icon ${i}">${n}</div>
                    <span>${e.name}</span>
                </div>
            </td>
            <td>${e.date || "Today"}</td>
            <td>
                <span class="badge-${(e.status || "Verified").toLowerCase() === "reviewing" ? "reviewing" : "verified"}">
                    ${e.status || "Verified"}
                </span>
            </td>
            <td>
                <div style="display:flex; gap: 8px;">
                    <a href="#" class="download-btn" title="Download"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/></svg></a>
                    <button class="download-btn" title="Delete Document" onclick="deleteDocument(${t})" style="color:#ef4444;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                </div>
            </td>
        </tr>
        `;
      }).join("");
  } else {
    documentsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color:#9ca3af;">No documents available.</td></tr>';
  }
}

async function saveCaseData() {
  if (casesAPI && currentCase) {
    try {
      await casesAPI.update(currentCase.id, currentCase, currentUser.role);
      await initCaseDetails();
    } catch (err) {
      console.error("Failed to update case:", err);
    }
  }
}

window.openModal = (id) => document.getElementById(id).classList.add("active");
window.closeModal = (id) => {
  const el = document.getElementById(id);
  LexValidation.clearAllErrors(el);
  el.classList.remove("active");
};

window.openEditCaseModal = () => {
  document.getElementById("editCaseTitle").value = currentCase.case_type || currentCase.title;
  document.getElementById("editCaseStatus").value = currentCase.status || "Ongoing";
  document.getElementById("editCaseProgress").value = currentCase.progress || 0;
  window.openModal("editCaseModal");
};

window.saveCaseDetailsModal = async () => {
  const title = document.getElementById("editCaseTitle").value;
  const progress = document.getElementById("editCaseProgress").value;
  const status = document.getElementById("editCaseStatus").value;
  
  currentCase.case_type = title;
  currentCase.progress = parseInt(progress, 10);
  currentCase.status = status;
  
  await saveCaseData();
  window.closeModal("editCaseModal");
};

window.addTimelineEvent = () => {
  document.getElementById("timelineModalTitle").textContent = "Add Timeline Event";
  document.getElementById("timelineEditIndex").value = "-1";
  document.getElementById("timelineTitle").value = "";
  document.getElementById("timelineDate").value = "";
  document.getElementById("timelineNotes").value = "";
  document.getElementById("timelineUpcoming").checked = false;
  window.openModal("timelineModal");
};

window.editTimelineEvent = (index) => {
  const event = currentCase.timeline[index];
  document.getElementById("timelineModalTitle").textContent = "Edit Timeline Event";
  document.getElementById("timelineEditIndex").value = index;
  document.getElementById("timelineTitle").value = event.title;
  
  const d = new Date(event.date);
  document.getElementById("timelineDate").value = isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  document.getElementById("timelineNotes").value = event.note || "";
  document.getElementById("timelineUpcoming").checked = !!event.upcoming;
  window.openModal("timelineModal");
};

window.saveTimelineModal = async () => {
  const title = document.getElementById("timelineTitle").value;
  const date = document.getElementById("timelineDate").value;
  const notes = document.getElementById("timelineNotes").value;
  const upcoming = document.getElementById("timelineUpcoming").checked;
  const index = parseInt(document.getElementById("timelineEditIndex").value, 10);
  
  const newEvent = {
    title,
    date: new Date(date).toLocaleDateString(),
    note: notes,
    upcoming
  };
  
  if (!currentCase.timeline) currentCase.timeline = [];
  if (index >= 0) currentCase.timeline[index] = newEvent;
  else currentCase.timeline.unshift(newEvent);
  
  await saveCaseData();
  window.closeModal("timelineModal");
};

window.deleteTimelineEvent = async (index) => {
  if (confirm("Delete this event?")) {
    currentCase.timeline.splice(index, 1);
    await saveCaseData();
  }
};

window.deleteDocument = async (index) => {
  if (confirm("Delete this document?")) {
    currentCase.documents.splice(index, 1);
    await saveCaseData();
  }
};

window.addEventListener("DOMContentLoaded", initCaseDetails);
