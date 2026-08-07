// In-memory data storage (Replaces removed JSON)
const MEMORY_DB = {
  users: [
    { id: 'user-0', name: 'Super Admin', email: 'superadmin@lexflow.test', role: 'superAdmin' },
    { id: 'user-1', name: 'Firm Admin', email: 'firmadmin@lexflow.test', role: 'firmAdmin', firmId: 'firm-1' },
    { id: 'user-2', name: 'Client Alice', email: 'alice@client.test', role: 'client', phone: '+91-9000000001' },
    { id: 'user-3', name: 'Lawyer Bob', email: 'bob@lawyer.test', role: 'lawyer', firmId: 'firm-1', specialisation: 'Criminal Law', barCouncilId: 'BCI/2024/101', winRate: 85, won: 45, lost: 5, ongoing: 10, totalCases: 60, avatar: 'LB' },
    { id: 'user-4', name: 'Intern Charlie', email: 'charlie@intern.test', role: 'intern', firmId: 'firm-1' },
    { id: 'ADM001', name: 'Sanjeev Mehta', email: 'mehta@lexflow.in', role: 'lawyer', specialisation: 'Civil Litigation', barCouncilId: 'D/1234/2005', winRate: 92, won: 120, lost: 10, ongoing: 15, totalCases: 145, avatar: 'SM' },
  ],
  cases: [
    { id: '1', title: 'State vs John Doe', cnr: 'PH010012342024', status: 'Active', clientId: 'user-2', lawyerId: 'user-3', firmId: 'firm-1', court: 'District Court' },
    { id: '2', title: 'Sharma vs Gupta', cnr: 'DL020056782024', status: 'Active', clientId: 'user-2', lawyerId: 'user-3', firmId: 'firm-1', court: 'High Court' },
    { id: '3', title: 'TechCorp vs SoftSystems', cnr: 'MH030099992024', status: 'Pending', clientId: 'user-2', lawyerId: 'user-3', firmId: 'firm-1', court: 'Supreme Court' },
  ]
};

async function initProfile() {
  try {
    const n = new URLSearchParams(window.location.search).get("id") || "user-3",
      a = MEMORY_DB.users.find((e) => e.id === n);
    
    if (a) {
      document.querySelector(".advocate-hero-info h1").textContent = `Adv. ${a.name}`;
      document.querySelector(".advocate-tagline").textContent = `Senior Advocate – ${a.specialisation || 'Legal Specialist'}`;
      document.querySelector(".advocate-avatar-lg").textContent = a.avatar || a.name.charAt(0);
      
      const valEls = document.querySelectorAll(".left-col .card:first-child .value");
      if (valEls.length >= 6) {
        valEls[0].textContent = a.name;
        valEls[1].textContent = a.barCouncilId || "N/A";
        valEls[2].textContent = a.specialisation || "General Practice";
        valEls[5].textContent = a.email;
      }
      
      document.querySelector(".stat-pill-donut-label").textContent = (a.winRate || 0) + "%";
      document.querySelector(".stat-pill-sub").textContent = `${a.won || 0} won · ${a.lost || 0} lost · ${a.ongoing || 0} ongoing`;
      
      const perfVals = document.querySelectorAll(".perf-grid .perf-item .perf-value");
      if (perfVals.length >= 4) {
        perfVals[0].textContent = a.totalCases || 0;
        perfVals[1].textContent = a.won || 0;
        perfVals[2].textContent = a.lost || 0;
        perfVals[3].textContent = a.ongoing || 0;
      }
    }
    
    const o = MEMORY_DB.cases.filter((e) => e.lawyerId === n),
      r = document.querySelector(".advocate-cases-list");
    
    if (r) {
      if (o.length === 0) {
        r.innerHTML = '<p style="color:#6b7280; font-size:14px; padding:10px;">No active cases found for this advocate.</p>';
      } else {
        r.innerHTML = o.map((e) => `
          <a href="case-documents.html?caseId=${e.id}" class="advocate-case-row">
            <div class="ac-dot ongoing"></div>
            <div class="ac-info">
              <div class="ac-title">${e.title}</div>
              <div class="ac-meta"><span class="ac-cnr">${e.cnr}</span><span class="ac-sep">·</span>${e.court}</div>
            </div>
            <span class="badge-status ongoing-badge">Active</span>
            <svg class="ac-arrow-svg" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 18l6-6-6-6"/></svg>
          </a>
        `).join("");
      }
    }
    animateNumbers();
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
