document.addEventListener("DOMContentLoaded", () => {
  let e = [],
    n = [],
    o = "All";
  fetch("../client_casemanagement_mock-data.json")
    .then((t) => t.json())
    .then((t) => {
      (t.invoices && (e = t.invoices),
        t.payments && (n = t.payments),
        (function () {
          let t = 0,
            o = 0,
            a = 0,
            i = 0;
          (e.forEach((e) => {
            ((t += e.amount),
              "Paid" === e.status
                ? (o += e.amount)
                : "Pending" === e.status
                  ? (a += e.amount)
                  : "Overdue" === e.status && (i += e.amount));
          }),
            0 === o && n.length > 0 && n.forEach((t) => (o += t.amount)));
          const d = (t) =>
            "$" +
            t.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          ((document.getElementById("valTotalBilled").textContent = d(t)),
            (document.getElementById("valTotalPaid").textContent = d(o)),
            (document.getElementById("valPending").textContent = d(a)),
            (document.getElementById("valOverdue").textContent = d(i)));
        })(),
        s(),
        (function () {
          const t = document.getElementById("paymentHistoryList");
          if (((t.innerHTML = ""), 0 === n.length))
            return void (t.innerHTML =
              '<tr><td colspan="6" style="text-align:center; color:#6b7280;">No payment history.</td></tr>');
          n.slice(0, 3).forEach((e) => {
            const n = document.createElement("tr"),
              o = (e.method || "").toLowerCase().includes("bank")
                ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>'
                : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>';
            ((n.innerHTML = `\n                <td style="font-weight:600; color:#1a1a2e;">${e.id}</td>\n                <td><a href="#" class="dt-id" onclick="window.open('image.png', '_blank')">${e.invoiceId}</a></td>\n                <td style="font-weight:700; color:#1a1a2e;">$${(e.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>\n                <td style="color:#6b7280;">${d(e.date)}</td>\n                <td>\n                    <div class="pay-method">\n                        ${o} ${e.method}\n                    </div>\n                </td>\n                <td><span class="badge-status badge-completed">${e.status}</span></td>\n            `),
              t.appendChild(n));
          });
        })());
    })
    .catch((t) => console.error("Error loading billing data:", t));
  const a = document.getElementById("searchInvoiceInput"),
    i = document.querySelectorAll(".filter-btn");
  function d(t) {
    return new Date(t).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }
  function s() {
    const t = a.value.toLowerCase().trim(),
      n = document.getElementById("invoicesList");
    n.innerHTML = "";
    const i = e.filter((e) => {
      const n = "All" === o || e.status === o,
        a =
          e.id.toLowerCase().includes(t) ||
          e.caseName.toLowerCase().includes(t);
      return n && a;
    });
    0 !== i.length
      ? i.forEach((t) => {
          const e = document.createElement("tr"),
            o =
              "Paid" === t.status
                ? "badge-paid"
                : "Pending" === t.status
                  ? "badge-pending"
                  : "badge-overdue",
            a = (function (t, e) {
              if ("Paid" === e) return "due-green";
              const n = new Date(t) - new Date(),
                o = Math.ceil(n / 864e5);
              return o < 0 ? "due-red" : o <= 14 ? "due-yellow" : "due-green";
            })(t.dueDate, t.status);
          let i = "";
          ("Paid" !== t.status &&
            (i += `<button class="btn-pay-now" onclick="window.location.href='billing_pay-now.html?id=${encodeURIComponent(t.id)}'">Pay Now</button>`),
            (i +=
              '\n                <button class="icon-btn" title="View details" onclick="window.open(\'image.png\', \'_blank\')">\n                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>\n                </button>\n            '),
            (i += `\n                <a href="image.png" download="Invoice_${t.id}.png" class="icon-btn" title="Download invoice">\n                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>\n                </a>\n            `),
            (e.innerHTML = `\n                <td><a href="#" class="dt-id" onclick="window.open('image.png', '_blank')">${t.id}</a></td>\n                <td>\n                    <div style="font-weight:600;">${t.caseName}</div>\n                </td>\n                <td style="color:#6b7280;">${t.lawFirm}</td>\n                <td style="font-weight:700; color:#1a1a2e;">$${t.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>\n                <td><span class="badge-status ${o}">${t.status}</span></td>\n                <td class="${a}" style="font-weight:600;">\n                    ${d(t.dueDate)}\n                </td>\n                <td class="action-cell">\n                    ${i}\n                </td>\n            `),
            n.appendChild(e));
        })
      : (n.innerHTML =
          '<tr><td colspan="7" style="text-align:center; color:#6b7280;">No invoices found.</td></tr>');
  }
  (a.addEventListener("input", () => s()),
    i.forEach((t) => {
      t.addEventListener("click", (t) => {
        (i.forEach((t) => t.classList.remove("active")),
          t.target.classList.add("active"),
          (o = t.target.getAttribute("data-filter")),
          s());
      });
    }));
});
