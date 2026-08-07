const LexValidation = (() => {
  const e = {
    email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
    phone: /^[\+]?[\d\s\-\(\)]{7,15}$/,
    phoneDigitsOnly: /\d/g,
    nameOnly: /^[a-zA-Z\s'.,-]{2,80}$/,
    cardNumber: /^\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/,
    expiryDate: /^(0[1-9]|1[0-2])\/\d{2}$/,
    cvc: /^\d{3,4}$/,
    cnr: /^[A-Za-z0-9\-\/]+$/,
  };
  function t(e, t) {
    (n(e), e.classList.add("input-error"));
    const r = document.createElement("span");
    ((r.className = "validation-error-msg"), (r.textContent = t));
    const a = e.parentElement;
    if (a) {
      const t = e.nextElementSibling;
      if (t && t.classList.contains("validation-error-msg")) return;
      a.insertBefore(r, e.nextSibling);
    }
  }
  function n(e) {
    e.classList.remove("input-error");
    const t = e.nextElementSibling;
    t && t.classList.contains("validation-error-msg") && t.remove();
  }
  function r(t) {
    return t && t.trim()
      ? e.email.test(t.trim())
        ? null
        : "Please enter a valid email (e.g. user@domain.com)"
      : "Email address is required";
  }
  function a(t) {
    if (!t || !t.trim()) return null;
    const n = t.replace(/\D/g, "");
    return n.length < 7 || n.length > 15
      ? "Phone number must be 7-15 digits"
      : e.phone.test(t.trim())
        ? null
        : "Invalid phone format (digits, +, -, spaces, parentheses only)";
  }
  function c(t) {
    if (!t || !t.trim()) return null;

    let n = t.trim().replace(/[\s\-()]/g, "");

    if (n.startsWith("+91")) n = n.slice(3);
    else if (n.startsWith("91") && n.length === 12) n = n.slice(2);
    else if (n.startsWith("0") && n.length === 11) n = n.slice(1);

    return /^[6-9]\d{9}$/.test(n)
      ? null
      : "Enter a valid Indian mobile number (e.g. +91 98765 43210)";
  }
  function i(e) {
    if (!e || !e.trim()) return "Card number is required";
    const t = e.replace(/\s/g, "");
    return /^\d+$/.test(t)
      ? 16 !== t.length
        ? "Card number must be 16 digits"
        : null
      : "Card number must contain only digits";
  }
  function l(t) {
    if (!t || !t.trim()) return "Expiry date is required";
    if (!e.expiryDate.test(t.trim())) return "Use MM/YY format";
    const [n, r] = t.trim().split("/").map(Number),
      a = new Date();
    return new Date(2e3 + r, n) < a ? "Card has expired" : null;
  }
  function u(t) {
    return t && t.trim()
      ? e.cvc.test(t.trim())
        ? null
        : "CVC must be 3-4 digits"
      : "CVC is required";
  }
  function s(e) {
    (e.addEventListener("input", (e) => {
      let t = e.target.value;
      ((t = t.replace(/[^\d\+\-\(\)\s]/g, "")), (e.target.value = t));
    }),
      e.addEventListener("blur", () => n(e)));
  }
  function o(e, r) {
    (e.addEventListener("blur", () => {
      const a = r(e.value);
      a ? t(e, a) : n(e);
    }),
      e.addEventListener("focus", () => n(e)));
  }
  function d() {
    (document.querySelectorAll('input[type="tel"]').forEach(s),
      document.querySelectorAll('input[type="email"]').forEach((e) => {
        o(e, r);
      }),
      document
        .querySelectorAll('input[type="number"][min][max]')
        .forEach((e) => {
          e.addEventListener("input", () => {
            const t = parseInt(e.min, 10),
              n = parseInt(e.max, 10);
            let r = parseInt(e.value, 10);
            isNaN(r) || (r < t && (e.value = t), r > n && (e.value = n));
          });
        }));
  }
  return (
    "loading" === document.readyState
      ? document.addEventListener("DOMContentLoaded", d)
      : d(),
    {
      showError: t,
      clearError: n,
      clearAllErrors: function (e) {
        e &&
          (e
            .querySelectorAll(".input-error")
            .forEach((e) => e.classList.remove("input-error")),
          e
            .querySelectorAll(".validation-error-msg")
            .forEach((e) => e.remove()));
      },
      validateRequired: function (e, t) {
        return e && e.trim() ? null : `${t} is required`;
      },
      validateEmail: r,
      validatePhone: a,
      validateIndianPhone: c,
      validatePhoneRequired: function (e) {
        return e && e.trim() ? a(e) : "Phone number is required";
      },
      validateName: function (t, n = "Name") {
        return t && t.trim()
          ? t.trim().length < 2
            ? `${n} must be at least 2 characters`
            : e.nameOnly.test(t.trim())
              ? null
              : `${n} should contain only letters, spaces, and common punctuation`
          : `${n} is required`;
      },
      validateCardNumber: i,
      validateExpiry: l,
      validateCVC: u,
      validateSelect: function (e, t) {
        return e && "" !== e ? null : `Please select a ${t}`;
      },
      validateDate: function (e, t = "Date") {
        if (!e || !e.trim()) return `${t} is required`;
        const n = new Date(e);
        return isNaN(n.getTime())
          ? `Please enter a valid ${t.toLowerCase()}`
          : null;
      },
      validateProgress: function (e) {
        const t = parseInt(e, 10);
        return isNaN(t)
          ? "Progress must be a number"
          : t < 0 || t > 100
            ? "Progress must be between 0 and 100"
            : null;
      },
      validateForm: function (e) {
        let r = !0;
        for (const a of e) {
          const e = a.validator(a.input.value);
          e ? (t(a.input, e), r && a.input.focus(), (r = !1)) : n(a.input);
        }
        return r;
      },
      formatPhoneInput: s,
      formatCardNumberInput: function (e) {
        (e.addEventListener("input", (e) => {
          let t = e.target.value.replace(/\D/g, "");
          (t.length > 16 && (t = t.slice(0, 16)),
            t.length > 0 && (t = t.match(/.{1,4}/g).join(" ")),
            (e.target.value = t));
        }),
          e.addEventListener("blur", () => {
            const r = i(e.value);
            r ? t(e, r) : n(e);
          }));
      },
      formatExpiryInput: function (e) {
        (e.addEventListener("input", (e) => {
          let t = e.target.value.replace(/[^\d\/]/g, "");
          (2 !== t.length || t.includes("/") || (t += "/"),
            t.length > 5 && (t = t.slice(0, 5)),
            (e.target.value = t));
        }),
          e.addEventListener("blur", () => {
            const r = l(e.value);
            r ? t(e, r) : n(e);
          }));
      },
      formatCVCInput: function (e) {
        (e.addEventListener("input", (e) => {
          e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
        }),
          e.addEventListener("blur", () => {
            const r = u(e.value);
            r ? t(e, r) : n(e);
          }));
      },
      formatNameInput: function (e) {
        e.addEventListener("input", (e) => {
          e.target.value = e.target.value.replace(/[^a-zA-Z\s'.,\-]/g, "");
        });
      },
      attachBlurValidation: o,
      PATTERNS: e,
    }
  );
})();
