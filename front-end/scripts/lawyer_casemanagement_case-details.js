let allData = {},
  currentCase = null,
  currentTasks = [];
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
    let e = localStorage.getItem("lexflow_mock_data");
    if (e) allData = JSON.parse(e);
    else {
      const e = await fetch(
        "../../scripts/client_casemanagement_mock-data.json",
      );
      ((allData = await e.json()),
        localStorage.setItem("lexflow_mock_data", JSON.stringify(allData)));
    }
    let t = new URLSearchParams(window.location.search).get("cnr");
    if (
      (!t && allData.cases.length > 0 && (t = allData.cases[0].cnr),
      (currentCase = allData.cases.find((e) => e.cnr === t)),
      !currentCase)
    )
      return;
    (allData.tasks &&
      (currentTasks = allData.tasks.filter(
        (e) => e.caseCnr === currentCase.cnr,
      )),
      renderHeader(),
      renderOverview(),
      renderTeam(),
      renderClientInfo(),
      renderPendingTasks(),
      renderTimeline(),
      renderDocuments(),
      renderPendingBanner());
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
    (caseTopTitle.textContent = currentCase.title),
    (caseTopSub.textContent = `${currentCase.type} | Opened: ${formatDate(currentCase.filedDate)}`),
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
  let i = n[0];
  if (
    (n.forEach((t, n) => {
      const a = document.getElementById(t.id);
      a &&
        (e >= t.min
          ? ((a.style.color = "#3b5bdb"),
            (a.style.fontWeight = "800"),
            (i = { ...t, index: n + 1 }))
          : ((a.style.color = "#9ca3af"), (a.style.fontWeight = "700")));
    }),
    t)
  ) {
    let e = "";
    ("Discovery" === i.name && (e = " & Evidence Collection"),
      "Filing" === i.name && (e = " & Documentation"),
      (t.textContent = `Phase ${i.index}: ${i.name}${e}`));
  }
}
function renderTeam() {
  let e = "Sarah Mitchell";
  ("ADM002" === currentCase.assignedAdvocateId && (e = "Vikram Nair"),
    "ADM003" === currentCase.assignedAdvocateId && (e = "Ananya Iyer"),
    (teamContainer.innerHTML = `\n        <div style="display: flex; gap: 12px; align-items: center;">\n            <div style="width: 32px; height: 32px; border-radius: 50%; background: #eef2ff; color: #3b5bdb; display: flex; align-items:center; justify-content:center; font-size: 11px; font-weight:700;">${e.substring(0, 2).toUpperCase()}</div>\n            <div style="display:flex; flex-direction:column;">\n                <span style="font-size:13px; font-weight:700; color:#1a1a2e;">${e}</span>\n                <span style="font-size:11px; color:#6b7280;">Lead Attorney</span>\n            </div>\n        </div>\n        <div style="display: flex; gap: 12px; align-items: center;">\n            <div style="width: 32px; height: 32px; border-radius: 50%; background: #f3f4f6; color: #6b7280; display: flex; align-items:center; justify-content:center; font-size: 11px; font-weight:700;">DC</div>\n            <div style="display:flex; flex-direction:column;">\n                <span style="font-size:13px; font-weight:700; color:#1a1a2e;">David Chen</span>\n                <span style="font-size:11px; color:#6b7280;">Paralegal</span>\n            </div>\n        </div>\n    `));
}
function renderClientInfo() {
  const e = currentCase.title.split("vs.");
  let t = e[0] ? e[0].trim() : "Unknown",
    n = e[1] ? e[1].trim() : "Unknown";
  ("Property Dispute" !== t && (clientContact.textContent = t),
    (opposingParty.textContent = n.replace("Ltd.", "").trim()));
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
          .slice(0, 3)
          .map(
            (e) =>
              `\n            <div style="display:flex; gap:12px; align-items:center; border: 1px solid #f3f4f6; padding: 12px; border-radius: 8px; background: #fffaf0; border-left: 4px solid #f59e0b;">\n                <div class="task-status-icon" style="width:24px; height:24px; flex-shrink:0;">\n                    ${getStatusIcon("Pending")}\n                </div>\n                <div style="display:flex; flex-direction:column; gap:2px; flex:1;">\n                    <span style="font-size:13px; font-weight:700; color:#1a1a2e;">${e.name}</span>\n                    <span style="font-size:11px; font-weight:600; color:#92400e; display:flex; align-items:center; gap:4px;">\n                        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>\n                        Due: ${e.dueDate}\n                    </span>\n                </div>\n                <input type="checkbox" style="width:16px; height:16px; cursor:pointer;" onclick="event.stopPropagation(); markTaskAsDone('${e.id}')" />\n            </div>\n        `,
          )
          .join("")),
        window.markTaskAsDone ||
          (window.markTaskAsDone = (e) => {
            const t = allData.tasks.find((t) => t.id === e);
            t &&
              ((t.status = "Completed"),
              localStorage.setItem(
                "lexflow_mock_data",
                JSON.stringify(allData),
              ),
              initCaseDetails());
          }))
      : (pendingTasksContainer.innerHTML =
          '<div style="font-size:12px; color:#9ca3af; padding:12px; text-align:center;">No pending tasks.</div>'));
}
function renderTimeline() {
  currentCase.timeline && 0 !== currentCase.timeline.length
    ? (timelineContainer.innerHTML = currentCase.timeline
        .map(
          (e, t) =>
            `\n        <div class="timeline-item ${e.grey ? "grey" : ""}" style="margin-bottom: 32px;">\n            <div style="display:flex; justify-content:space-between; align-items:flex-start;">\n                <div>\n                   <div class="t-title" style="font-size:14px; font-weight:700; color:#1a1a2e; display:flex; align-items:center; gap:8px;">\n                      ${e.title}\n                      <button onclick="editTimelineEvent(${t})" style="background:none;border:none;color:#9ca3af;cursor:pointer;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>\n                      <button onclick="deleteTimelineEvent(${t})" style="background:none;border:none;color:#ef4444;cursor:pointer;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>\n                   </div>\n                   <div style="font-size:12px; color:#6b7280; margin-top:4px; max-width:80%; line-height:1.5;">${e.note || "Status updated automatically."}</div>\n                </div>\n                <div style="text-align:right;">\n                    <span style="font-size:10px; font-weight:700; color:#cbd5e1; text-transform:uppercase;">${e.date}</span>\n                    ${e.upcoming ? '<div style="margin-top:6px;"><span class="badge-upcoming">UPCOMING</span></div>' : ""}\n                </div>\n            </div>\n        </div>\n    `,
        )
        .join(""))
    : (timelineContainer.innerHTML =
        '<p style="color:#6b7280; font-size:13px; margin:24px;">No timeline events recorded.</p>');
}
function renderDocuments() {
  (currentCase.documents || (currentCase.documents = []),
    0 !== currentCase.documents.length
      ? (documentsTbody.innerHTML = currentCase.documents
          .map((e, t) => {
            let n = e.type ? e.type.toUpperCase() : "DOC",
              i = e.type ? e.type.toLowerCase() : "pdf";
            return (
              "pdf" !== i && "zip" !== i && (i = "pdf"),
              `\n        <tr>\n            <td>\n                <div class="doc-name">\n                    <div class="doc-icon ${i}">${n}</div>\n                    <span>${e.name}</span>\n                </div>\n            </td>\n            <td>${e.date || "Today"}</td>\n            <td>\n                <span class="badge-${"Reviewing" === e.status ? "reviewing" : "verified"}">\n                    ${e.status || "Verified"}\n                </span>\n            </td>\n            <td>\n                <div style="display:flex; gap: 8px;">\n                    <a href="../../shared/documents/legalheir.pdf" download="legalheir.pdf" class="download-btn" title="Download"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/></svg></a>\n                    <button class="download-btn" title="Delete Document" onclick="deleteDocument(${t})" style="color:#ef4444;"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>\n                </div>\n            </td>\n        </tr>\n        `
            );
          })
          .join(""))
      : (documentsTbody.innerHTML =
          '<tr><td colspan="4" style="text-align:center; padding: 24px; color:#9ca3af;">No documents available.</td></tr>'));
}
function saveData() {
  const e = allData.cases.findIndex((e) => e.cnr === currentCase.cnr);
  (-1 !== e && (allData.cases[e] = currentCase),
    localStorage.setItem("lexflow_mock_data", JSON.stringify(allData)),
    initCaseDetails());
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
      (e += `"${currentCase.cnr}","${currentCase.title}","${currentCase.court}","${currentCase.status}","${currentCase.filedDate}"`));
    var t = encodeURI(e),
      n = document.createElement("a");
    (n.setAttribute("href", t),
      n.setAttribute("download", `case_export_${currentCase.cnr}.csv`),
      document.body.appendChild(n),
      n.click(),
      document.body.removeChild(n));
  }),
  (window.openEditCaseModal = function () {
    ((document.getElementById("editCaseTitle").value = currentCase.title),
      (document.getElementById("editCaseStatus").value = currentCase.status),
      (document.getElementById("editCaseProgress").value =
        currentCase.progress),
      openModal("editCaseModal"));
  }),
  (window.saveCaseDetailsModal = function () {
    const e = document.getElementById("editCaseTitle"),
      t = document.getElementById("editCaseProgress"),
      n = document.getElementById("editCaseModal");
    LexValidation.clearAllErrors(n);
    const i = [
      {
        input: e,
        validator: (e) => LexValidation.validateRequired(e, "Case title"),
      },
      { input: t, validator: LexValidation.validateProgress },
    ];
    if (!LexValidation.validateForm(i))
      return (
        n.querySelector(".modal-content").classList.add("form-shake"),
        void setTimeout(
          () =>
            n.querySelector(".modal-content").classList.remove("form-shake"),
          450,
        )
      );
    ((currentCase.title = e.value.trim()),
      (currentCase.status = document.getElementById("editCaseStatus").value),
      (currentCase.progress = parseInt(t.value, 10)),
      saveData(),
      closeModal("editCaseModal"));
  }),
  (window.addDocumentPrompt = function () {
    ((document.getElementById("docClientName").value = currentCase.title
      .split("vs.")[0]
      .trim()),
      (document.getElementById("docCaseCnr").value = currentCase.cnr),
      (document.getElementById("docDescription").value = ""),
      (document.getElementById("selectedFileName").innerHTML =
        'Drag & Drop Files Here or <span style="color:#3b5bdb; text-decoration:underline;">Click to Upload</span>'),
      openModal("documentModal"));
  }),
  (window.saveDocumentModal = function () {
    const e = document.getElementById("docTypeSelect").value;
    let t = "New_Document_" + e + "." + e.toLowerCase();
    const n = document.getElementById("selectedFileName").innerText;
    (n.includes("Selected:") && (t = n.replace("Selected:", "").trim()),
      currentCase.documents || (currentCase.documents = []),
      currentCase.documents.push({
        name: t,
        type: e,
        date: new Date().toLocaleDateString(void 0, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        status: "Reviewing",
      }),
      saveData(),
      closeModal("documentModal"));
  }),
  (window.deleteDocument = function (e) {
    confirm("Are you sure you want to delete this document?") &&
      (currentCase.documents.splice(e, 1), saveData(), renderDocuments());
  }),
  (window.addTimelineEvent = function () {
    ((document.getElementById("timelineModalTitle").textContent =
      "Add Timeline Event"),
      (document.getElementById("timelineEditIndex").value = "-1"),
      (document.getElementById("timelineTitle").value = ""),
      (document.getElementById("timelineDate").value = ""),
      (document.getElementById("timelineNotes").value = ""),
      (document.getElementById("timelineUpcoming").checked = !1),
      openModal("timelineModal"));
  }),
  (window.editTimelineEvent = function (e) {
    const t = currentCase.timeline[e];
    ((document.getElementById("timelineModalTitle").textContent =
      "Edit Timeline Event"),
      (document.getElementById("timelineEditIndex").value = e),
      (document.getElementById("timelineTitle").value = t.title));
    let n = new Date(t.date);
    (isNaN(n.getTime())
      ? (document.getElementById("timelineDate").value = "")
      : (document.getElementById("timelineDate").value = n
          .toISOString()
          .split("T")[0]),
      (document.getElementById("timelineNotes").value = t.note || ""),
      (document.getElementById("timelineUpcoming").checked = !!t.upcoming),
      openModal("timelineModal"));
  }),
  (window.deleteTimelineEvent = function (e) {
    confirm("Delete this event?") &&
      (currentCase.timeline.splice(e, 1), saveData(), renderTimeline());
  }),
  (window.saveTimelineModal = function () {
    const e = document.getElementById("timelineTitle"),
      t = document.getElementById("timelineDate"),
      n = document.getElementById("timelineModal");
    LexValidation.clearAllErrors(n);
    const i = [
      {
        input: e,
        validator: (e) => LexValidation.validateRequired(e, "Event title"),
      },
      { input: t, validator: (e) => LexValidation.validateDate(e, "Date") },
    ];
    if (!LexValidation.validateForm(i))
      return (
        n.querySelector(".modal-content").classList.add("form-shake"),
        void setTimeout(
          () =>
            n.querySelector(".modal-content").classList.remove("form-shake"),
          450,
        )
      );
    const a = parseInt(document.getElementById("timelineEditIndex").value),
      o = document.getElementById("timelineNotes").value,
      s = document.getElementById("timelineUpcoming").checked;
    let r = new Date(t.value).toLocaleDateString(void 0, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const l = { title: e.value.trim(), date: r, note: o, upcoming: s };
    (currentCase.timeline || (currentCase.timeline = []),
      a >= 0 ? (currentCase.timeline[a] = l) : currentCase.timeline.unshift(l),
      saveData(),
      closeModal("timelineModal"));
  }),
  setTimeout(() => {
    const e = document.querySelector(
      ".topbar ~ .content .card .filter-btn:nth-child(1)",
    );
    e && e.addEventListener("click", openEditCaseModal);
    const t = document.querySelector(
      ".topbar ~ .content .card .filter-btn:nth-child(2)",
    );
    t && t.addEventListener("click", exportCSV);
  }, 500),
  window.addEventListener("DOMContentLoaded", initCaseDetails));
