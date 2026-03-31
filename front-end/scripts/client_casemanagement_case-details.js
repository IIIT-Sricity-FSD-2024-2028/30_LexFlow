async function initCaseDetails() {
  try {
    const e = await fetch("../../scripts/client_casemanagement_mock-data.json"),
      t = await e.json();
    let n = new URLSearchParams(window.location.search).get("cnr");
    if (!n) {
      const e = document.querySelector(".breadcrumb .current").textContent;
      n = e.includes("CNR:") ? e.replace("CNR:", "").trim() : "";
    }
    const a = t.cases.find((e) => e.cnr === n);
    if (a) {
      ((document.querySelector(".page-header p").textContent = a.title),
        (document.querySelector(".breadcrumb .current").textContent =
          `CNR: ${a.cnr}`));
      if (
        ((document.querySelector(".info-grid").innerHTML =
          `\n        <div class="info-item"><label>CNR Number</label><div class="value">${a.cnr}</div></div>\n        <div class="info-item"><label>Case Type</label><div class="value">${a.type}</div></div>\n        <div class="info-item"><label>Court</label><div class="value">${a.court}</div></div>\n        <div class="info-item"><label>Assigned Lawyer</label><div class="value link" onclick="window.location.href='casemanagement_advocate-profile.html?id=${a.assignedAdvocateId}'">Advocate Details</div></div>\n        <div class="info-item"><label>Filed Date</label><div class="value">${formatDate(a.filedDate)}</div></div>\n        <div class="info-item"><label>Status</label><div class="value"><span class="badge-status">${a.status}</span></div></div>\n      `),
        a.nextHearing)
      ) {
        const e = new Date(a.nextHearing.date),
          t = [
            "JAN",
            "FEB",
            "MAR",
            "APR",
            "MAY",
            "JUN",
            "JUL",
            "AUG",
            "SEP",
            "OCT",
            "NOV",
            "DEC",
          ];
        ((document.querySelector(".hearing-date .month").textContent =
          t[e.getMonth()]),
          (document.querySelector(".hearing-date .day").textContent =
            e.getDate()),
          (document.querySelector(".hearing-info .sub").textContent =
            `${a.nextHearing.time} • ${a.nextHearing.description}`));
      }
      document.querySelector(".prog-label .pct").textContent =
        a.progress + "% Complete";
      const e = document.querySelector(".progress-bar .fill");
      e &&
        ((e.style.width = "0%"),
        setTimeout(() => {
          e.style.width = a.progress + "%";
        }, 100));
      const t = document.querySelector(".timeline");
      t &&
        a.timeline &&
        (t.innerHTML = a.timeline
          .map(
            (e) =>
              `\n          <div class="timeline-item ${e.grey ? "grey" : ""}">\n            <div class="t-title">${e.title}</div>\n            <div class="t-date">${e.date}</div>\n            ${e.upcoming ? '<span class="badge-upcoming">UPCOMING</span>' : ""}\n            ${e.note ? `<div class="t-note">${e.note}</div>` : ""}\n          </div>\n        `,
          )
          .join(""));
      const n = document.querySelector(".docs-table tbody");
      n &&
        a.documents &&
        ((n.innerHTML = a.documents
          .map(
            (e) =>
              `\n          <tr>\n            <td><div class="doc-name"><div class="doc-icon ${e.type.toLowerCase()}">${e.type}</div>${e.name}</div></td>\n            <td>${e.date}</td>\n            <td><span class="badge-verified">${e.status}</span></td>\n            <td><button class="download-btn" data-file="${e.name}"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11"/></svg></button></td>\n          </tr>\n        `,
          )
          .join("")),
        attachDownloadHandlers());
    }
  } catch (e) {
    console.error("Error loading case details:", e);
  }
}
function formatDate(e) {
  return new Date(e).toLocaleDateString(void 0, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function attachDownloadHandlers() {
  document.querySelectorAll(".download-btn").forEach((e) => {
    e.onclick = function () {
      const e = this.parentElement.parentElement
          .querySelector(".doc-name")
          .textContent.replace(this.dataset.file ? "" : ".doc-icon", "")
          .trim(),
        t = document.createElement("a");
      ((t.href = "legalheir.pdf"),
        (t.download = e),
        document.body.appendChild(t),
        t.click(),
        document.body.removeChild(t));
    };
  });
}
window.addEventListener("DOMContentLoaded", initCaseDetails);
