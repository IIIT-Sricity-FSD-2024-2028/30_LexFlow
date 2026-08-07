const casesAPI = window.LexFlowAPI ? window.LexFlowAPI.cases : null;

const currentUserData = (() => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch { return {}; }
})();

const currentUser = {
  role: (currentUserData.role || 'client').toLowerCase(),
  id: currentUserData.id || null,
  name: currentUserData.fullName || currentUserData.name || 'Client'
};

function formatDate(value) {
  if (!value) return "TBD";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderTimeline(timeline) {
  const timelineEl = document.querySelector(".timeline");
  if (!timelineEl) return;
  
  if (!Array.isArray(timeline) || timeline.length === 0) {
    timelineEl.innerHTML = '<div style="color:#6b7280; font-size:13px; padding:10px;">No timeline events recorded.</div>';
    return;
  }

  timelineEl.innerHTML = timeline
    .map(
      (event) => `
        <div class="timeline-item ${event.grey ? "grey" : ""}">
          <div class="t-title">${event.title}</div>
          <div class="t-date">${event.date}</div>
          ${event.upcoming ? '<span class="badge-upcoming">UPCOMING</span>' : ""}
          ${event.note ? `<div class="t-note">${event.note}</div>` : ""}
        </div>
      `,
    )
    .join("");
}

function renderDocuments(documents) {
  const docsBody = document.querySelector(".docs-table tbody");
  if (!docsBody) return;

  if (!Array.isArray(documents) || documents.length === 0) {
    docsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#6b7280; padding: 20px;">No documents available.</td></tr>';
    return;
  }

  docsBody.innerHTML = documents
    .map(
      (doc) => `
        <tr>
          <td><div class="doc-name"><div class="doc-icon ${String(doc.type || "DOC").toLowerCase()}">${(doc.type || "DOC").toUpperCase()}</div>${doc.name}</div></td>
          <td>${doc.date || "-"}</td>
          <td><span class="badge-verified">${doc.status || "Verified"}</span></td>
          <td><button class="download-btn" data-file="${doc.name}"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/></svg></button></td>
        </tr>
      `,
    )
    .join("");

  attachDownloadHandlers();
}

function attachDownloadHandlers() {
  document.querySelectorAll(".download-btn").forEach((button) => {
    button.onclick = function () {
      const fileName = this.dataset.file || "document.txt";
      const safeName = String(fileName).trim() || "document.txt";
      const fileContent = `LexFlow document download\nFile: ${safeName}\nDownloaded on: ${new Date().toISOString()}`;
      const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(objectUrl);
    };
  });
}

async function initCaseDetails() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get("id");
    const cnrFromUrl = urlParams.get("cnr");
    
    let currentCase = null;
    if (casesAPI) {
      if (idFromUrl) {
        currentCase = await casesAPI.getById(idFromUrl, currentUser.role);
      } else if (cnrFromUrl) {
        const all = await casesAPI.getAll({}, currentUser.role);
        currentCase = all.find(c => c.cnr === cnrFromUrl);
      }
    }

    if (!currentCase) {
      console.error("Case not found");
      return;
    }

    const titleEl = document.querySelector(".page-header p");
    if (titleEl) titleEl.textContent = currentCase.case_type || currentCase.title || 'Case Details';
    
    const breadcrumb = document.querySelector(".breadcrumb .current");
    if (breadcrumb) breadcrumb.textContent = `CNR: ${currentCase.cnr || 'N/A'}`;

    const infoGrid = document.querySelector(".info-grid");
    if (infoGrid) {
      infoGrid.innerHTML = `
        <div class="info-item"><label>CNR Number</label><div class="value">${currentCase.cnr || 'N/A'}</div></div>
        <div class="info-item"><label>Case Type</label><div class="value">${currentCase.case_type || 'N/A'}</div></div>
        <div class="info-item"><label>Description</label><div class="value">${currentCase.brief_description || currentCase.description || 'N/A'}</div></div>
        <div class="info-item"><label>Assigned Lawyer</label><div class="value link" onclick="window.location.href='client-case-advocate-profile.html?id=${currentCase.lawyer_id}'">${currentCase.lawyer_name || "Advocate Details"}</div></div>
        <div class="info-item"><label>Filed Date</label><div class="value">${formatDate(currentCase.filed_date || currentCase.filedDate)}</div></div>
        <div class="info-item"><label>Status</label><div class="value"><span class="badge-status">${currentCase.status || "Ongoing"}</span></div></div>
      `;
    }

    const nextHearing = currentCase.nextHearing || null;
    if (nextHearing) {
      const hearingDate = new Date(nextHearing.date);
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

      const monthEl = document.querySelector(".hearing-date .month");
      const dayEl = document.querySelector(".hearing-date .day");
      const subEl = document.querySelector(".hearing-info .sub");
      
      if (monthEl) monthEl.textContent = months[hearingDate.getMonth()];
      if (dayEl) dayEl.textContent = hearingDate.getDate();
      if (subEl) subEl.textContent = `${nextHearing.time || ""} • ${nextHearing.description || "Scheduled Hearing"}`;
    }

    const pctEl = document.querySelector(".prog-label .pct");
    if (pctEl) pctEl.textContent = `${currentCase.progress || 0}% Complete`;
    
    const progressFill = document.querySelector(".progress-bar .fill");
    if (progressFill) {
      progressFill.style.width = "0%";
      setTimeout(() => {
        progressFill.style.width = `${currentCase.progress || 0}%`;
      }, 100);
    }

    renderTimeline(currentCase.timeline || []);
    renderDocuments(currentCase.documents || []);
  } catch (error) {
    console.error("Error loading case details:", error);
  }
}

window.addEventListener("DOMContentLoaded", initCaseDetails);
