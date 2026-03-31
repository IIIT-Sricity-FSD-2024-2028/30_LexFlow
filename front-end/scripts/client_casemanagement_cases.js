let allCases = [],
  filteredCases = [];
async function initCases() {
  try {
    const e = await fetch("../../scripts/client_casemanagement_mock-data.json"),
      t = await e.json();
    ((allCases = t.cases), (filteredCases = [...allCases]), renderPage(1));
  } catch (e) {
    console.error("Error loading cases:", e);
  }
}
const CASES_PER_PAGE = 3;
let currentPage = 1;
const caseListEl = document.getElementById("caseList"),
  noResultsEl = document.getElementById("noResults"),
  paginationInfo = document.getElementById("paginationInfo"),
  paginationPages = document.getElementById("paginationPages"),
  searchInput = document.getElementById("searchInput");
function renderCaseCard(e) {
  const t = (e.avatars || [])
      .map(
        (e, t) =>
          `<div class="${e.startsWith("+") ? "av av-more" : "av"}">${e}</div>`,
      )
      .join(""),
    a = e.nextHearing ? e.nextHearing.date : "TBD";
  return `\n    <div class="case-card page-item" data-title="${e.title.toLowerCase()}" data-cnr="${e.cnr.toLowerCase()}">\n      <div class="case-icon">\n        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 8H3a2 2 0 00-2 2v9a2 2 0 002 2h18a2 2 0 002-2V10a2 2 0 00-2-2zM16 8V6a3 3 0 00-6 0v2M7 13v3m10-3v3"/></svg>\n      </div>\n      <div class="case-info">\n        <div class="case-badges">\n          <span class="badge-active">${e.status}</span>\n          <span class="badge-type">${e.type}</span>\n        </div>\n        <div class="case-title">${e.title}</div>\n        <div class="case-meta">\n          <span><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"/></svg> CNR: ${e.cnr}</span>\n          <span><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5"/></svg> ${e.court}</span>\n        </div>\n        <div class="avatars">${t}</div>\n      </div>\n      <div class="case-right">\n        <div class="hearing-box">\n          <div class="label">NEXT HEARING</div>\n          <div class="date">${a}</div>\n        </div>\n        <a class="view-details" href="casemanagement_case-details.html?cnr=${e.cnr}">View Details →</a>\n      </div>\n    </div>`;
}
function renderPage(e) {
  const t = Math.ceil(filteredCases.length / CASES_PER_PAGE);
  ((e = Math.max(1, Math.min(e, t || 1))), (currentPage = e));
  const a = (e - 1) * CASES_PER_PAGE,
    s = filteredCases.slice(a, a + CASES_PER_PAGE);
  (caseListEl.classList.add("fade-out"),
    setTimeout(() => {
      (0 === s.length
        ? ((caseListEl.innerHTML = ""), (noResultsEl.style.display = "flex"))
        : ((noResultsEl.style.display = "none"),
          (caseListEl.innerHTML = s.map(renderCaseCard).join(""))),
        caseListEl.classList.remove("fade-out"),
        caseListEl.classList.add("fade-in"),
        setTimeout(() => caseListEl.classList.remove("fade-in"), 300));
    }, 200));
  const n = Math.min(a + CASES_PER_PAGE, filteredCases.length);
  paginationInfo.innerHTML = `Showing <strong>${0 === filteredCases.length ? 0 : a + 1}–${n}</strong> of <strong>${filteredCases.length}</strong> cases`;
  let i = "";
  i += `<button class="pg-arrow" ${e <= 1 ? "disabled" : ""} data-page="${e - 1}">&#8249;</button>`;
  for (let a = 1; a <= t; a++)
    i += `<button data-page="${a}" class="${a === e ? "active" : ""}">${a}</button>`;
  ((i += `<button class="pg-arrow" ${e >= t ? "disabled" : ""} data-page="${e + 1}">&#8250;</button>`),
    (paginationPages.innerHTML = i),
    paginationPages.querySelectorAll("button[data-page]").forEach((e) => {
      e.addEventListener("click", function () {
        const e = parseInt(this.dataset.page, 10);
        isNaN(e) || renderPage(e);
      });
    }));
}
(searchInput.addEventListener("input", function () {
  const e = this.value.toLowerCase().trim();
  ((filteredCases =
    "" === e
      ? [...allCases]
      : allCases.filter(
          (t) =>
            t.title.toLowerCase().includes(e) ||
            t.cnr.toLowerCase().includes(e),
        )),
    renderPage(1));
}),
  document
    .getElementById("btnNewConsultation")
    .addEventListener("click", function () {
      alert("New Consultation flow coming soon!");
    }),
  initCases());
