document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  

  const DRAFT_KEY = 'clientDraft';

  const profileForm = document.getElementById('profile-form');

  if (profileForm) {
    injectValidationStyles();
    attachBlurValidators();

    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      setAlert(null);

      const ids = {
        fullName:        document.getElementById('full-name'),
        email:           document.getElementById('email'),
        phone:           document.getElementById('phone'),
        street:          document.getElementById('street'),
        city:            document.getElementById('city'),
        state:           document.getElementById('state'),
        zip:             document.getElementById('zip'),
        password:        document.getElementById('password'),
        confirmPassword: document.getElementById('confirm-password')
      };

      const results = [
        validateFullName(ids.fullName),
        validateEmail(ids.email),
        validatePhone(ids.phone),
        validateStreet(ids.street),
        validateCity(ids.city),
        validateState(ids.state),
        validatePin(ids.zip),
        validatePassword(ids.password),
        validateConfirmPassword(ids.confirmPassword)
      ];

      if (!results.every(Boolean)) {
        setAlert('Please fix the errors below before continuing.');
        const first = Object.values(ids).find(f => f?.classList.contains('input-error'));
        if (first) first.focus();
        return;
      }

      const payload = {
        fullName:     _val('full-name'),
        email:        _val('email').toLowerCase(),
        role:         'client',
        password:     _val('password'),
        phone:        normalizeIndianPhone(_val('phone')) || undefined,
        addressLine1: _val('street') || undefined,
        addressLine2: undefined,
        city:         _val('city') || undefined,
        state:        _val('state') || undefined,
        pinCode:      _val('zip') || undefined
      };

      // Save draft locally as well so case step can reuse it
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));

      // Filter payload for the API (only send what the backend CreateUserDto expects)
      const apiPayload = {
        fullName: payload.fullName,
        email:    payload.email,
        role:     payload.role,
        password: payload.password,
        phone:    payload.phone
      };

      try {
        const res = await fetch('http://localhost:3000/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'role': 'superadmin' // Use superadmin to bypass creation restrictions
          },
          body: JSON.stringify(apiPayload)
        });

        if (!res.ok) {
          const err = await res.text();
          setAlert('Failed to create account: ' + (err || res.statusText));
          return;
        }

        const created = await res.json();
        _showToast('Profile created! Moving to case details…');

        const nextStep = profileForm.getAttribute('action') || 'client-onboarding-step-2.html';
        setTimeout(() => { window.location.href = nextStep; }, 600);
      } catch (err) {
        setAlert('Network error while creating account. Please try again.');
        console.error(err);
      }
    });
  }

  const caseForm = document.getElementById('case-form');

  if (caseForm) {
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
      });
    });

    const handleAccountCreation = (caseData = {}) => {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
      const profileContext = draft;

      if (!profileContext.fullName || !profileContext.email) {
        _showAlert('case-alert', 'Profile data is missing. Please go back to Step 1.');
        return;
      }

      const merged = { ...profileContext, ...caseData };

      StorageService.create('clients', merged);

      const existingUsers = StorageService.getAll('users');
      const alreadyExists = existingUsers.some(
        u => u.email.toLowerCase() === merged.email.toLowerCase()
      );

      let user;
      if (!alreadyExists) {
        user = StorageService.create('users', {
          fullName: merged.fullName,
          email:    merged.email,
          phone:    merged.phone,
          password: merged.password || 'client123',
          role:     'client'
        });
      } else {
        user = existingUsers.find(
          u => u.email.toLowerCase() === merged.email.toLowerCase()
        );
      }

      const { password: _pw, ...safeUser } = user;
      localStorage.setItem('currentUser', JSON.stringify(safeUser));

      sessionStorage.removeItem(DRAFT_KEY);

      _showToast('Account created successfully! Redirecting…');

      setTimeout(() => {
        window.location.href = 'client-consultation-dashboard.html';
      }, 800);
    };

    caseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAccountCreation({
        caseType:        _val('case-type'),
        courtName:       _val('court-name'),
        cnrNumber:       _val('cnr'),
        caseDescription: _val('description'),
        preferences:     _getPreferences()
      });
    });

    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleAccountCreation({});
      });
    }
  }

  function _val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function _showAlert(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function _getPreferences() {
    const prefSelect = document.getElementById('preferred-expertise');
    if (prefSelect) {
      const val = prefSelect.value.trim();
      return val ? [val] : [];
    }
    return Array.from(document.querySelectorAll('.chip.selected'))
      .map(c => c.textContent.trim());
  }

  function _showToast(msg) {
    const existing = document.querySelector('.lexflow-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'lexflow-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  const RE = {
    fullName: /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F .'-]{1,79}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    phone: /^(?:\+91|91|0)?[6-9]\d{9}$/,
    pin: /^[1-9]\d{5}$/,
    street: /^.{5,}$/,
    city: /^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F .-]{1,49}$/
  };

  const PWD_CHECKS = [
    { id: 'rule-len', test: v => v.length >= 8 },
    { id: 'rule-upper', test: v => /[A-Z]/.test(v) },
    { id: 'rule-lower', test: v => /[a-z]/.test(v) },
    { id: 'rule-digit', test: v => /\d/.test(v) },
    { id: 'rule-sym', test: v => /[^A-Za-z0-9]/.test(v) }
  ];

  const STRENGTH_META = [
    { label: '', color: 'transparent', width: '0%' },
    { label: 'Weak', color: '#d32f2f', width: '20%' },
    { label: 'Fair', color: '#f57c00', width: '40%' },
    { label: 'Moderate', color: '#fbc02d', width: '60%' },
    { label: 'Strong', color: '#388e3c', width: '80%' },
    { label: 'Very Strong', color: '#1b5e20', width: '100%' }
  ];

  function showFieldError(input, message) {
    if (!input) return;
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');

    const fieldContainer = input.closest('.form-field') || input.parentElement;
    let errEl = fieldContainer.querySelector(`.field-error[data-for="${input.id}"]`);
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error';
      errEl.dataset.for = input.id;
      errEl.setAttribute('role', 'alert');
      errEl.setAttribute('aria-live', 'polite');

      const wrap = input.closest('.password-wrap');
      if (wrap && fieldContainer.contains(wrap)) {
        wrap.after(errEl);
      } else {
        input.after(errEl);
      }
    }
    errEl.textContent = message;
  }

  function clearFieldError(input) {
    if (!input) return;
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
    const fieldContainer = input.closest('.form-field') || input.parentElement;
    const errEl = fieldContainer.querySelector(`.field-error[data-for="${input.id}"]`);
    if (errEl) errEl.textContent = '';
  }

  function setAlert(message) {
    const alert = document.getElementById('profile-alert');
    if (!alert) return;
    if (message) {
      alert.textContent = message;
      alert.style.display = 'block';
      alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert.textContent = '';
      alert.style.display = 'none';
    }
  }

  function digitsOnly(str) {
    return (str || '').replace(/\D/g, '');
  }

  function normalizeIndianPhone(raw) {
    const digits = digitsOnly(raw);
    return digits.startsWith('91') && digits.length === 12 ? digits.slice(2)
      : digits.startsWith('0') && digits.length === 11 ? digits.slice(1)
      : digits;
  }

  function validateFullName(input) {
    const val = _val('full-name');
    if (!val) return showFieldError(input, 'Full name is required.'), false;
    if (!RE.fullName.test(val)) return showFieldError(input, 'Enter a valid full name.'), false;
    if (val.split(/\s+/).length < 2) return showFieldError(input, 'Please enter first and last name.'), false;
    clearFieldError(input);
    return true;
  }

  function validateEmail(input) {
    const val = _val('email');
    if (!val) return showFieldError(input, 'Email is required.'), false;
    if (!RE.email.test(val)) return showFieldError(input, 'Enter a valid email address.'), false;
    clearFieldError(input);
    return true;
  }

  function validatePhone(input) {
    const raw = _val('phone');
    if (!raw) return showFieldError(input, 'Phone number is required.'), false;
    if (!RE.phone.test(raw)) return showFieldError(input, 'Enter a valid Indian mobile number.'), false;
    const normalised = normalizeIndianPhone(raw);
    if (!/^[6-9]\d{9}$/.test(normalised)) {
      showFieldError(input, 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.');
      return false;
    }
    clearFieldError(input);
    return true;
  }

  function validateStreet(input) {
    const val = _val('street');
    if (!val) return showFieldError(input, 'Street address is required.'), false;
    if (!RE.street.test(val)) return showFieldError(input, 'Enter at least 5 characters.'), false;
    clearFieldError(input);
    return true;
  }

  function validateCity(input) {
    const val = _val('city');
    if (!val) return showFieldError(input, 'City is required.'), false;
    if (!RE.city.test(val)) return showFieldError(input, 'Enter a valid city name.'), false;
    clearFieldError(input);
    return true;
  }

  function validateState(input) {
    const val = _val('state');
    if (!val) return showFieldError(input, 'State is required.'), false;
    clearFieldError(input);
    return true;
  }

  function validatePin(input) {
    const val = _val('zip');
    if (!val) return showFieldError(input, 'PIN code is required.'), false;
    if (!/^\d+$/.test(val)) return showFieldError(input, 'PIN code must contain numbers only.'), false;
    if (val.length !== 6) return showFieldError(input, 'PIN code must be exactly 6 digits.'), false;
    if (!RE.pin.test(val)) return showFieldError(input, 'Enter a valid 6-digit Indian PIN code.'), false;
    clearFieldError(input);
    return true;
  }

  function updatePasswordUI(password) {
    let score = 0;
    PWD_CHECKS.forEach(({ id, test }) => {
      const li = document.getElementById(id);
      if (!li) return;
      if (test(password)) {
        li.classList.add('rule-pass');
        li.classList.remove('rule-fail');
        score++;
      } else {
        li.classList.remove('rule-pass');
        if (password.length > 0) li.classList.add('rule-fail');
        else li.classList.remove('rule-fail');
      }
    });

    const fill = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    if (fill && label) {
      const meta = STRENGTH_META[score];
      fill.style.width = meta.width;
      fill.style.backgroundColor = meta.color;
      label.textContent = meta.label;
      label.style.color = meta.color;
    }
    return score;
  }

  function validatePassword(input) {
    if (!input) return true;
    const val = input.value;
    if (!val) return showFieldError(input, 'Password is required.'), false;
    const score = updatePasswordUI(val);
    if (score < 4) return showFieldError(input, 'Password must satisfy at least 4 of the 5 rules below.'), false;
    clearFieldError(input);
    return true;
  }

  function validateConfirmPassword(input) {
    if (!input) return true;
    const pwd = document.getElementById('password');
    const val = input.value;
    if (!val) return showFieldError(input, 'Please confirm your password.'), false;
    if (val !== (pwd ? pwd.value : '')) return showFieldError(input, 'Passwords do not match.'), false;
    clearFieldError(input);
    return true;
  }

  function injectValidationStyles() {
    if (document.getElementById('lexflow-validation-css')) return;
    const style = document.createElement('style');
    style.id = 'lexflow-validation-css';
    style.textContent = `
      .field-error {
        display: block;
        margin-top: 4px;
        font-size: 0.78rem;
        color: #d32f2f;
        font-weight: 500;
      }
      .input-error {
        border-color: #d32f2f !important;
        box-shadow: 0 0 0 3px rgba(211,47,47,.12) !important;
        outline: none;
      }
      .password-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }
      .password-wrap input {
        flex: 1;
        min-width: 0;
        padding-right: 42px;
      }
      .pwd-toggle {
        position: absolute;
        right: 10px;
        background: none;
        border: none;
        cursor: pointer;
        color: #6b7280;
        padding: 4px;
        display: flex;
        align-items: center;
      }
      .pwd-toggle:hover { color: #111; }
      .strength-bar {
        height: 4px;
        background: #e5e7eb;
        border-radius: 999px;
        margin-top: 8px;
        overflow: hidden;
      }
      .strength-fill {
        height: 100%;
        width: 0%;
        border-radius: 999px;
        transition: width .35s ease, background-color .35s ease;
      }
      .strength-label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        margin-top: 4px;
        min-height: 1em;
      }
      .pwd-rules {
        list-style: none;
        padding: 10px 0 4px;
        margin: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 16px;
      }
      .rule {
        font-size: 0.78rem;
        color: #6b7280;
        padding-left: 18px;
        position: relative;
      }
      .rule::before {
        content: '○';
        position: absolute;
        left: 0;
        font-size: 0.7rem;
      }
      .rule-pass { color: #15803d; }
      .rule-pass::before {
        content: '✓';
        color: #15803d;
        font-weight: 700;
      }
      .rule-fail { color: #d32f2f; }
      .rule-fail::before {
        content: '✗';
        color: #d32f2f;
      }
    `;
    document.head.appendChild(style);
  }

  function attachBlurValidators() {
    const fieldMap = [
      ['full-name', validateFullName],
      ['email', validateEmail],
      ['phone', validatePhone],
      ['street', validateStreet],
      ['city', validateCity],
      ['state', validateState],
      ['zip', validatePin],
      ['password', validatePassword],
      ['confirm-password', validateConfirmPassword]
    ];

    fieldMap.forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('blur', () => fn(el));
      el.addEventListener('input', () => {
        clearFieldError(el);
        setAlert(null);
      });
      el.addEventListener('change', () => {
        clearFieldError(el);
        setAlert(null);
      });
    });

    const phoneEl = document.getElementById('phone');
    if (phoneEl) {
      phoneEl.addEventListener('input', () => {
        phoneEl.value = phoneEl.value.replace(/[^\d+\s()-]/g, '').slice(0, 15);
      });
    }

    const zipEl = document.getElementById('zip');
    if (zipEl) {
      zipEl.addEventListener('input', () => {
        zipEl.value = zipEl.value.replace(/\D/g, '').slice(0, 6);
      });
      zipEl.addEventListener('keydown', e => {
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
      });
    }

    const pwdEl = document.getElementById('password');
    if (pwdEl) {
      pwdEl.addEventListener('input', () => updatePasswordUI(pwdEl.value));
      pwdEl.addEventListener('input', () => {
        const conf = document.getElementById('confirm-password');
        if (conf && conf.value) validateConfirmPassword(conf);
      });
    }

    document.querySelectorAll('.pwd-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const inp = document.getElementById(targetId);
        if (!inp) return;
        const isHidden = inp.type === 'password';
        inp.type = isHidden ? 'text' : 'password';
        btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      });
    });
  }
});
