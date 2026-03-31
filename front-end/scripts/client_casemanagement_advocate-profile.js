async function initProfile() {
  try {
    const e = await fetch("../../scripts/client_casemanagement_mock-data.json"),
      t = await e.json(),
      n = new URLSearchParams(window.location.search).get("id") || "ADM001",
      a = t.users.find((e) => e.id === n);
    if (a) {
      ((document.querySelector(".advocate-hero-info h1").textContent =
        `Adv. ${a.name}`),
        (document.querySelector(".advocate-tagline").textContent =
          `Senior Advocate – ${a.specialisation}`),
        (document.querySelector(".advocate-avatar-lg").textContent = a.avatar));
      const e = document.querySelectorAll(".left-col .card:first-child .value");
      (e.length >= 6 &&
        ((e[0].textContent = a.name),
        (e[1].textContent = a.barCouncilId || "N/A"),
        (e[2].textContent = a.specialisation),
        (e[5].textContent = a.email)),
        (document.querySelector(".stat-pill-donut-label").textContent =
          a.winRate + "%"),
        (document.querySelector(".stat-pill-sub").textContent =
          `${a.won} won · ${a.lost} lost · ${a.ongoing} ongoing`),
        (document.querySelector(
          ".perf-grid .perf-item:nth-child(1) .perf-value",
        ).textContent = a.totalCases),
        (document.querySelector(
          ".perf-grid .perf-item:nth-child(2) .perf-value",
        ).textContent = a.won),
        (document.querySelector(
          ".perf-grid .perf-item:nth-child(3) .perf-value",
        ).textContent = a.lost),
        (document.querySelector(
          ".perf-grid .perf-item:nth-child(4) .perf-value",
        ).textContent = a.ongoing));
    }
    const o = t.cases.filter((e) => e.assignedAdvocateId === n),
      r = document.querySelector(".advocate-cases-list");
    (r &&
      (0 === o.length
        ? (r.innerHTML =
            '<p style="color:#6b7280; font-size:14px; padding:10px;">No active cases found for this advocate.</p>')
        : (r.innerHTML = o
            .map(
              (e) =>
                `\n          <a href="casemanagement_case-details.html?cnr=${e.cnr}" class="advocate-case-row">\n            <div class="ac-dot ongoing"></div>\n            <div class="ac-info">\n              <div class="ac-title">${e.title}</div>\n              <div class="ac-meta"><span class="ac-cnr">${e.cnr}</span><span class="ac-sep">·</span>${e.court}</div>\n            </div>\n            <span class="badge-status ongoing-badge">Active</span>\n            <svg class="ac-arrow-svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 18l6-6-6-6"/></svg>\n          </a>\n        `,
            )
            .join(""))),
      animateNumbers());
  } catch (e) {
    console.error("Error loading advocate profile:", e);
  }
}
function animateNumbers() {
  document.querySelectorAll(".perf-value").forEach((e) => {
    const t = parseInt(e.textContent, 10);
    if (isNaN(t)) return;
    e.textContent = "0";
    let n = 0;
    const a = Math.max(1, Math.floor(t / 20)),
      o = setInterval(() => {
        ((n += a), n >= t && ((n = t), clearInterval(o)), (e.textContent = n));
      }, 40);
  });
}
document.addEventListener("DOMContentLoaded", initProfile);
