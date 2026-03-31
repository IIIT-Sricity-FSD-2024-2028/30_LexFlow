document.addEventListener("DOMContentLoaded", async () => {
  let invoices = [];
  let payments = [];
  let currentFilter = "All";

  const invoicesList = document.getElementById("invoicesList");
  const paymentHistoryList = document.getElementById("paymentHistoryList");
  const searchInput = document.getElementById("searchInvoiceInput");
  const filterBtns = document.querySelectorAll(".filter-btn");

  // Fetch data from JSON
  async function fetchData() {
    try {
      const response = await fetch("../../scripts/client_casemanagement_mock-data.json");
      const data = await response.json();
      invoices = data.invoices || [];
      payments = data.payments || [];
      
      updateSummaries();
      renderInvoices();
      renderPaymentHistory();
    } catch (error) {
      console.error("Error fetching mock data:", error);
    }
  }

  function updateSummaries() {
    let totalRevenue = 0;
    let pendingAmount = 0;
    let paidCount = 0;
    let overdueCount = 0;

    invoices.forEach(inv => {
      if (inv.status === "Paid") {
        totalRevenue += inv.amount;
        paidCount++;
      } else if (inv.status === "Pending") {
        pendingAmount += inv.amount;
      } else if (inv.status === "Overdue") {
        pendingAmount += inv.amount;
        overdueCount++;
      }
    });

    const formatCurrency = (val) => "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2 });

    const valTotalRevenue = document.getElementById("valTotalRevenue");
    const valPending = document.getElementById("valPending");
    const valPaidInvoices = document.getElementById("valPaidInvoices");
    const valOverdueInvoices = document.getElementById("valOverdueInvoices");

    if (valTotalRevenue) valTotalRevenue.textContent = formatCurrency(totalRevenue);
    if (valPending) valPending.textContent = formatCurrency(pendingAmount);
    if (valPaidInvoices) valPaidInvoices.textContent = paidCount.toString();
    if (valOverdueInvoices) valOverdueInvoices.textContent = overdueCount.toString();
  }

  // View Modal Functions
  window.openInvoiceModal = function(invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    const modal = document.getElementById("invoiceModal");
    const content = document.getElementById("modalContent");
    
    content.innerHTML = `
        <div class="invoice-detail-grid">
            <div class="detail-item">
                <label>Invoice ID</label>
                <div>${inv.id}</div>
            </div>
            <div class="detail-item">
                <label>Status</label>
                <div style="margin-top:4px;"><span class="badge-status badge-${inv.status.toLowerCase()}">${inv.status}</span></div>
            </div>
            <div class="detail-item">
                <label>Client Name</label>
                <div>${inv.client || 'N/A'}</div>
            </div>
            <div class="detail-item">
                <label>Case Name</label>
                <div>${inv.caseName}</div>
            </div>
            <div class="detail-item">
                <label>Amount Due</label>
                <div style="font-size:18px; color:var(--clr-primary-dark); font-weight:800;">₹${inv.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="detail-item">
                <label>Due Date</label>
                <div>${inv.dueDate}</div>
            </div>
        </div>
        <div style="margin-top:24px; padding:16px; background:rgba(59, 91, 219, 0.05); border-radius:12px; border:1px dashed rgba(59, 91, 219, 0.2);">
            <div style="font-size:10px; color:var(--clr-primary); font-weight:700; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em;">Notes</div>
            <p style="font-size:12px; color:var(--clr-text-secondary); margin:0; line-height:1.5;">This is a system generated invoice. For any discrepancies, please contact the billing department.</p>
        </div>
    `;

    // Hook up the print button in the view modal
    const printBtn = document.getElementById("printBtnView");
    if (printBtn) {
        printBtn.onclick = () => window.downloadInvoice(inv.id);
    }

    modal.classList.add("active");
  };

  window.closeInvoiceModal = function() {
    document.getElementById("invoiceModal").classList.remove("active");
  };

  // Create Modal Functions
  window.openCreateModal = function() {
    document.getElementById("createInvoiceForm").reset();
    document.getElementById("createInvoiceModal").classList.add("active");
  };

  window.closeCreateModal = function() {
    document.getElementById("createInvoiceModal").classList.remove("active");
  };

  window.createNewInvoice = function() {
    const client = document.getElementById("createInvClient").value;
    const caseName = document.getElementById("createInvCase").value;
    const amount = parseFloat(document.getElementById("createInvAmount").value);
    const status = document.getElementById("createInvStatus").value;
    const dueDate = document.getElementById("createInvDueDate").value;

    if (!client || !caseName || isNaN(amount) || !dueDate) {
        alert("Please fill in all required fields.");
        return;
    }

    const newId = "INV-" + Math.floor(1000 + Math.random() * 9000);
    
    invoices.unshift({
        id: newId,
        client: client,
        caseName: caseName,
        amount: amount,
        status: status,
        dueDate: dueDate
    });

    updateSummaries();
    renderInvoices();
    closeCreateModal();
  };

  // Edit Modal Functions
  window.editInvoice = function(invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    document.getElementById("editInvId").value = inv.id;
    document.getElementById("editInvClient").value = inv.client || '';
    document.getElementById("editInvCase").value = inv.caseName;
    document.getElementById("editInvAmount").value = inv.amount;
    document.getElementById("editInvStatus").value = inv.status;
    document.getElementById("editInvDueDate").value = inv.dueDate;

    document.getElementById("editInvoiceModal").classList.add("active");
  };

  window.closeEditModal = function() {
    document.getElementById("editInvoiceModal").classList.remove("active");
  };

  window.saveInvoiceChanges = function() {
    const id = document.getElementById("editInvId").value;
    const invIndex = invoices.findIndex(i => i.id === id);
    
    if (invIndex !== -1) {
        invoices[invIndex].client = document.getElementById("editInvClient").value;
        invoices[invIndex].caseName = document.getElementById("editInvCase").value;
        invoices[invIndex].amount = parseFloat(document.getElementById("editInvAmount").value);
        invoices[invIndex].status = document.getElementById("editInvStatus").value;
        invoices[invIndex].dueDate = document.getElementById("editInvDueDate").value;

        updateSummaries();
        renderInvoices();
        closeEditModal();
    }
  };

  // Download/Print Function
  window.downloadInvoice = function(invoiceId) {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    // Populate printable template
    document.getElementById("printClient").textContent = inv.client || 'N/A';
    document.getElementById("printInvId").textContent = inv.id;
    document.getElementById("printDate").textContent = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById("printCase").textContent = inv.caseName;
    document.getElementById("printAmount").textContent = "₹" + inv.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    document.getElementById("printTotal").textContent = "₹" + inv.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    document.getElementById("printDue").textContent = inv.dueDate;

    window.print();
  };

  window.onclick = function(event) {
    const viewModal = document.getElementById("invoiceModal");
    const editModal = document.getElementById("editInvoiceModal");
    const createModal = document.getElementById("createInvoiceModal");
    if (event.target === viewModal) closeInvoiceModal();
    if (event.target === editModal) closeEditModal();
    if (event.target === createModal) closeCreateModal();
  };

  function renderInvoices() {
    if (!invoicesList) return;
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    invoicesList.innerHTML = "";

    const filtered = invoices.filter((inv) => {
      const matchFilter = currentFilter === "All" || inv.status === currentFilter;
      const matchSearch =
        inv.id.toLowerCase().includes(query) ||
        (inv.client && inv.client.toLowerCase().includes(query)) ||
        inv.caseName.toLowerCase().includes(query);
      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      invoicesList.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:var(--clr-text-tertiary); padding:40px;">No invoices found matching your criteria.</td></tr>';
      return;
    }

    const eyeIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
    const pencilIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`;
    const downloadIcon = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`;

    filtered.forEach((inv) => {
      const tr = document.createElement("tr");

      let badgeClass = "badge-paid";
      if (inv.status === "Pending") badgeClass = "badge-pending";
      if (inv.status === "Overdue") badgeClass = "badge-overdue";

      tr.innerHTML = `
        <td><a href="#" class="dt-id" onclick="openInvoiceModal('${inv.id}'); return false;">${inv.id}</a></td>
        <td style="color:var(--clr-text); font-weight:600;">${inv.client || 'N/A'}</td>
        <td style="color:var(--clr-text-secondary);">${inv.caseName}</td>
        <td style="font-weight:700; color:var(--clr-text);">₹${inv.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        <td><span class="badge-status ${badgeClass}">${inv.status}</span></td>
        <td style="color:var(--clr-text-secondary);">${inv.dueDate}</td>
        <td class="action-cell">
            <button class="icon-btn" title="View" onclick="openInvoiceModal('${inv.id}')">${eyeIcon}</button>
            <button class="icon-btn icon-btn-edit" title="Edit" onclick="editInvoice('${inv.id}')">${pencilIcon}</button>
            <button class="icon-btn" title="Download" onclick="downloadInvoice('${inv.id}')">${downloadIcon}</button>
        </td>
      `;
      invoicesList.appendChild(tr);
    });
  }

  function renderPaymentHistory() {
    if (!paymentHistoryList) return;
    paymentHistoryList.innerHTML = "";

    if (payments.length === 0) {
      paymentHistoryList.innerHTML =
        '<tr><td colspan="7" style="text-align:center; color:var(--clr-text-tertiary); padding:20px;">No payment history found.</td></tr>';
      return;
    }

    payments.forEach((pay) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:600; color:var(--clr-text);">${pay.id}</td>
        <td><a href="#" class="dt-id" onclick="openInvoiceModal('${pay.invoiceId}'); return false;">${pay.invoiceId}</a></td>
        <td style="color:var(--clr-text); font-weight:600;">${pay.client || 'N/A'}</td>
        <td style="font-weight:700; color:var(--clr-text);">₹${pay.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        <td style="color:var(--clr-text-secondary);">${pay.date}</td>
        <td style="color:var(--clr-text-secondary); font-weight:500;">${pay.method}</td>
        <td><span class="badge-status badge-completed">COMPLETED</span></td>
      `;
      paymentHistoryList.appendChild(tr);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderInvoices);
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.getAttribute("data-filter");
      renderInvoices();
    });
  });

  fetchData();
});
