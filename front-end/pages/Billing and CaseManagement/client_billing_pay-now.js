document.addEventListener("DOMContentLoaded", () => {
  const t = new URLSearchParams(window.location.search).get("id");
  if (!t)
    return (
      alert("No invoice ID provided. Redirecting to billing dashboard."),
      void (window.location.href = "../../pages/client/billing.html")
    );
  fetch("../../scripts/client_casemanagement_mock-data.json")
    .then((e) => e.json())
    .then((e) => {
      if (e.invoices) {
        const n = e.invoices.find((e) => e.id === t);
        n
          ? (function (e) {
              ((document.getElementById("summaryId").textContent = e.id),
                (document.getElementById("summaryCaseName").textContent =
                  e.caseName),
                (document.getElementById("summaryLawFirm").textContent =
                  e.lawFirm));
              const t = new Date(e.dueDate) - new Date(),
                n = Math.ceil(t / 864e5);
              let a = "#1a1a2e";
              n < 0 ? (a = "#ef4444") : n <= 14 && (a = "#f59e0b");
              const o = document.getElementById("summaryDueDate");
              ((o.textContent =
                ((i = e.dueDate),
                new Date(i).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }))),
                (o.style.color = a));
              var i;
              const d =
                "$" +
                e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
              ((document.getElementById("summaryAmount").textContent = d),
                (document.getElementById("btnPayAmount").textContent = d));
            })(n)
          : (alert("Invoice not found."),
            (window.location.href = "../../pages/client/billing.html"));
      }
    })
    .catch((e) => console.error(e));
  const n = document.getElementById("cardName"),
    a = document.getElementById("cardNumber"),
    o = document.getElementById("cardExpiry"),
    i = document.getElementById("cardCVC"),
    d = document.getElementById("paymentForm"),
    m = document.getElementById("paymentSuccess");
  (LexValidation.formatNameInput(n),
    LexValidation.attachBlurValidation(n, (e) =>
      LexValidation.validateName(e, "Cardholder name"),
    ),
    LexValidation.formatCardNumberInput(a),
    LexValidation.formatExpiryInput(o),
    LexValidation.formatCVCInput(i),
    d.addEventListener("submit", (e) => {
      (e.preventDefault(), LexValidation.clearAllErrors(d));
      const t = [
        {
          input: n,
          validator: (e) => LexValidation.validateName(e, "Cardholder name"),
        },
        { input: a, validator: LexValidation.validateCardNumber },
        { input: o, validator: LexValidation.validateExpiry },
        { input: i, validator: LexValidation.validateCVC },
      ];
      if (!LexValidation.validateForm(t)) {
        const e = d.closest(".checkout-form");
        return void (
          e &&
          (e.classList.add("form-shake"),
          setTimeout(() => e.classList.remove("form-shake"), 450))
        );
      }
      const l = d.querySelector('button[type="submit"]');
      ((l.textContent = "Processing..."),
        (l.disabled = !0),
        setTimeout(() => {
          ((d.style.display = "none"),
            (m.style.display = "block"),
            setTimeout(() => {
              window.location.href = "../../pages/client/billing.html";
            }, 3e3));
        }, 1500));
    }));
});
