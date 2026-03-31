document.addEventListener("DOMContentLoaded", () => {
  fetch("../../scripts/client_casemanagement_mock-data.json")
    .then((res) => res.json())
    .then((data) => {
      if (!data.payments && !data.invoices) return;

      const transactionsList = document.getElementById("allTransactionsList");
      transactionsList.innerHTML = "";

      // Combine existing payments with "Paid" invoices that don't have a payment record yet
      let allTransactions = [...(data.payments || [])];
      
      if (data.invoices) {
        data.invoices.forEach(inv => {
          if (inv.status === "Paid") {
            const alreadyTagged = allTransactions.some(p => p.invoiceId === inv.id);
            if (!alreadyTagged) {
              allTransactions.push({
                id: "PAY-" + inv.id.replace("#INV-", ""),
                invoiceId: inv.id,
                amount: inv.amount,
                date: inv.dueDate,
                method: "Bank Transfer", // Default for synthesized transactions
                status: "Completed"
              });
            }
          }
        });
      }

      if (allTransactions.length === 0) {
        transactionsList.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#6b7280; padding: 40px;">No transactions found.</td></tr>';
        return;
      }

      // Sort by date descending
      allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      allTransactions.forEach((tx) => {
        const tr = document.createElement("tr");
        const isBank = (tx.method || "").toLowerCase().includes("bank");
        const methodIcon = isBank
          ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px; height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>'
          : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px; height:16px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>';
        
        const formattedDate = new Date(tx.date).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        });

        tr.innerHTML = `
          <td style="font-weight:600; color:#1a1a2e;">${tx.id}</td>
          <td><a href="#" class="dt-id" onclick="window.open('image.png', '_blank'); return false;">${tx.invoiceId}</a></td>
          <td style="font-weight:700; color:#1a1a2e;">$${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
          <td style="color:#6b7280;">${formattedDate}</td>
          <td>
              <div class="pay-method" style="display:flex; align-items:center; gap:8px;">
                  ${methodIcon} ${tx.method}
              </div>
          </td>
          <td><span class="badge-status badge-completed">${tx.status || "Completed"}</span></td>
        `;
        transactionsList.appendChild(tr);
      });
    })
    .catch((err) => console.error("Error loading transactions:", err));
});
