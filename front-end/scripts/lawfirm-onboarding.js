document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  

  const DRAFT_KEY = 'firmDraft';
  injectValidationStyles();

  const title = document.title.toLowerCase();
  const isStep1 = title.includes('step 1') || title.includes('registration step 1');
  const isStep2 = title.includes('step 2') || title.includes('contact info step 2');
  const isStep3 = title.includes('step 3') || title.includes('admin setup');

  if (isStep1) initStep1();
  else if (isStep2) initStep2();
  else if (isStep3) initStep3();

  function initStep1() {
    const form = document.querySelector('form');
    if (!form) return;

    attachStep1Validators();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setAlert(null);

      const fullNameEl = document.getElementById('full-name');
      const emailEl = document.getElementById('email');
      const phoneEl = document.getElementById('phone');
      const streetEl = document.getElementById('street');
      const cityEl = document.getElementById('city');
      const stateEl = document.getElementById('state');
      const zipEl = document.getElementById('zip');

      const valid = [
        validateFirmName(fullNameEl),
        validateEmail(emailEl),
        validateIndianPhone(phoneEl),
        validateStreet(streetEl),
        validateCity(cityEl),
        validateState(stateEl),
        validatePin(zipEl)
      ].every(Boolean);

      if (!valid) {
        setAlert('Please fix the errors below before continuing.');
        const first = [fullNameEl, emailEl, phoneEl, streetEl, cityEl, stateEl, zipEl].find(
          el => el && el.classList.contains('input-error')
        );
        if (first) first.focus();
        return;
      }

      const data = {
        fullName: _val('full-name'),
        email: _val('email').toLowerCase(),
        phone: normalizeIndianPhone(_val('phone')),
        street: _val('street'),
        city: _val('city'),
        state: _val('state'),
        zip: _val('zip')
      };

      _saveDraft(data);

      try {
        let sessionId = sessionStorage.getItem('firmOnboardingSessionId') || localStorage.getItem('firmOnboardingSessionId');
        
        if (!sessionId) {
          const startRes = await window.LexFlowAPI.secureFetch(`http://localhost:3000/users/firm-onboarding/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', role: 'firmadmin' },
          });
          if (!startRes.ok) throw new Error(await startRes.text());
          const startData = await startRes.json();
          sessionId = startData.sessionId;
          sessionStorage.setItem('firmOnboardingSessionId', sessionId);
          localStorage.setItem('firmOnboardingSessionId', sessionId);
        }

        // send step1 data to server
        const { zip, ...restData } = data;
        const step1Res = await window.LexFlowAPI.secureFetch(`http://localhost:3000/users/firm-onboarding/step1/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', role: 'firmadmin' },
          body: JSON.stringify({
            ...restData,
            pinCode: zip,
          }),
        });
        if (!step1Res.ok) throw new Error(await step1Res.text());
      } catch (err) {
        console.error(err);
        setAlert(typeof err === 'string' ? err : (err.message || 'Unable to start onboarding on server'));
        return;
      }

      _showToast('Firm info saved!');

      setTimeout(() => {
        window.location.href = 'lawfirm-onboarding-step-2.html';
      }, 600);
    });
  }

  function initStep2() {
    const form = document.querySelector('form');
    if (!form) return;

    attachStep2Validators();

    const draft = _getDraft();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setAlert(null);

      const primaryEmailEl = document.getElementById('primary-email');
      const phoneEl = document.getElementById('phone');
      const websiteEl = document.getElementById('website');
      const secondaryEmailEl = document.getElementById('secondary-email');
      const altPhoneEl = document.getElementById('alt-phone');

      const valid = [
        validateEmail(primaryEmailEl),
        validateIndianPhone(phoneEl),
        validateWebsite(websiteEl),
        validateOptionalEmail(secondaryEmailEl),
        validateOptionalIndianPhone(altPhoneEl)
      ].every(Boolean);

      if (!valid) {
        setAlert('Please fix the errors below before continuing.');
        const first = [primaryEmailEl, phoneEl, websiteEl, secondaryEmailEl, altPhoneEl].find(
          el => el && el.classList.contains('input-error')
        );
        if (first) first.focus();
        return;
      }

      const contactData = {
        primaryEmail: _val('primary-email').toLowerCase(),
        contactPhone: normalizeIndianPhone(_val('phone')),
        website: _val('website'),
        secondaryEmail: _val('secondary-email').toLowerCase(),
        altPhone: normalizeIndianPhone(_val('alt-phone'))
      };

      _saveDraft({ ...draft, ...contactData });

      // If a server-side onboarding session exists, submit step2
      const sessionId = sessionStorage.getItem('firmOnboardingSessionId') || localStorage.getItem('firmOnboardingSessionId');
      if (sessionId) {
        try {
          // Only send properties defined in FirmOnboardingDto
          const step2Payload = {
            primaryEmail: contactData.primaryEmail,
            website: contactData.website,
            phone: contactData.contactPhone // Map contactPhone back to phone
          };

          const step2Res = await window.LexFlowAPI.secureFetch(`http://localhost:3000/users/firm-onboarding/step2/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', role: 'firmadmin' },
            body: JSON.stringify(step2Payload),
          });
          if (!step2Res.ok) throw new Error(await step2Res.text());
        } catch (err) {
          console.error(err);
          setAlert(typeof err === 'string' ? err : (err.message || 'Unable to submit contact info to server'));
          return;
        }
      }

      _showToast('Contact info saved!');

      setTimeout(() => {
        window.location.href = 'lawfirm-onboarding-step-3.html';
      }, 600);
    });
  }

  function initStep3() {
    const form = document.querySelector('form');
    if (!form) return;

    attachStep3Validators();

    const draft = _getDraft();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setAlert(null);

      const adminNameEl = document.getElementById('admin-name');
      const adminEmailEl = document.getElementById('admin-email');
      const passwordEl = document.getElementById('password');
      const confirmPwEl = document.getElementById('confirm-password');
      const termsEl = document.getElementById('terms');

      const valid = [
        validateFullName(adminNameEl),
        validateEmail(adminEmailEl),
        validatePassword(passwordEl),
        validateConfirmPassword(confirmPwEl),
        validateTerms(termsEl)
      ].every(Boolean);

      if (!valid) {
        setAlert('Please fix the errors below before continuing.');
        const first = [adminNameEl, adminEmailEl, passwordEl, confirmPwEl, termsEl].find(
          el => el && (el.classList.contains('input-error') || (el.type === 'checkbox' && !el.checked))
        );
        if (first && first.focus) first.focus();
        return;
      }

      const adminEmail = _val('admin-email').toLowerCase();
      const existingUsers = StorageService.getAll('users');
      if (existingUsers.some(u => u.email.toLowerCase() === adminEmail)) {
        showFieldError(adminEmailEl, 'This email is already registered.');
        return;
      }

      const firmName = draft.fullName || draft.firmName || 'Unnamed Firm';
      const firmData = {
        ...draft,
        name: firmName,
        firmName,
        subtitle: `${draft.city || ''}, ${draft.state || ''}`.trim().replace(/^,|,$/g, '') || 'General Practice',
        location: (draft.city || '').toLowerCase(),
        practiceArea: 'general',
        description: draft.description || `${firmName} — a registered law firm on LexFlow.`,
        rating: 4.0,
        reviews: 0,
        price: 150,
        availability: 'AVAILABLE',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(firmName)}&background=1e3a5f&color=fff`,
        adminName: _val('admin-name'),
        adminEmail: adminEmail
      };

      const sessionId = sessionStorage.getItem('firmOnboardingSessionId') || localStorage.getItem('firmOnboardingSessionId');

      // If there's an active server-side onboarding session, complete it via step3
      if (sessionId) {
        try {
          const step3Payload = {
            adminName: _val('admin-name'),
            adminEmail: adminEmail,
            password: _val('password'),
            confirmPassword: _val('confirm-password'),
          };

          const step3Res = await window.LexFlowAPI.secureFetch(`http://localhost:3000/users/firm-onboarding/step3/${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', role: 'firmadmin' },
            body: JSON.stringify(step3Payload),
          });

          if (!step3Res.ok) {
            const err = await step3Res.text();
            throw new Error(err || 'Unable to complete onboarding');
          }

          const result = await step3Res.json();

          // Mirror previous frontend behavior: persist firm and set current user
          StorageService.create('lawFirms', {
            ...firmData,
            adminId: result.adminUserId,
          });

          const frontendUser = {
            id: result.adminUserId,
            fullName: _val('admin-name'),
            email: adminEmail,
            role: 'firmAdmin',
            firmId: result.firmId,
          };

          localStorage.setItem('currentUser', JSON.stringify(frontendUser));
          localStorage.setItem('userRole', frontendUser.role);
          sessionStorage.removeItem(DRAFT_KEY);
          sessionStorage.removeItem('firmOnboardingSessionId');
          localStorage.removeItem('firmOnboardingSessionId');

          _showToast('Firm account created!');
          setTimeout(() => {
            window.location.href = 'firm-consultation-dashboard.html';
          }, 800);
          return;
        } catch (error) {
          console.error(error);
          setAlert(error.message || 'Unable to complete onboarding on server');
          return;
        }
      }

      // Fallback: previous behavior (create user directly via /users)
      const payload = {
        fullName: _val('admin-name'),
        email: adminEmail,
        role: 'firmadmin',
        password: _val('password'),
        phone: draft.phone || undefined,
        addressLine1: draft.street || undefined,
        city: draft.city || undefined,
        state: draft.state || undefined,
        pinCode: draft.zip || undefined,
      };

      window.LexFlowAPI.secureFetch('http://localhost:3000/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          role: 'superadmin',
        },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.text();
            throw new Error(err || 'Unable to create law firm account.');
          }
          return res.json();
        })
        .then((user) => {
          StorageService.create('lawFirms', { ...firmData, adminId: user.id });

          const { password: _pw, ...safeUser } = user;
          const frontendUser = {
            ...safeUser,
            role: 'firmAdmin',
          };

          localStorage.setItem('currentUser', JSON.stringify(frontendUser));
          localStorage.setItem('userRole', frontendUser.role);

          sessionStorage.removeItem(DRAFT_KEY);

          _showToast('Firm account created!');

          setTimeout(() => {
            window.location.href = 'firm-consultation-dashboard.html';
          }, 800);
        })
        .catch((error) => {
          console.error(error);
          setAlert(error.message || 'Unable to create firm account right now.');
        });
    });
  }

  function injectValidationStyles() {
    if (document.getElementById('lawfirm-validation-css')) return;
    const style = document.createElement('style');
    style.id = 'lawfirm-validation-css';
    style.textContent = `
      .form-alert {
        display: none;
        background: #fdecea;
        border: 1px solid #f5c6cb;
        color: #842029;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 20px;
        font-size: 0.875rem;
        font-weight: 500;
      }
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
      .checkbox-error {
        outline: 2px solid #d32f2f;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function setAlert(message) {
    let alert = document.getElementById('firm-validation-alert');
    if (!alert) {
      alert = document.createElement('div');
      alert.id = 'firm-validation-alert';
      alert.className = 'form-alert';
      const form = document.querySelector('form');
      if (form) form.before(alert);
    }

    if (message) {
      alert.textContent = message;
      alert.style.display = 'block';
    } else {
      alert.textContent = '';
      alert.style.display = 'none';
    }
  }

  function showFieldError(input, message) {
    if (!input) return false;
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');

    let errEl = input.parentElement?.querySelector?.(`.field-error[data-for="${input.id}"]`);
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error';
      errEl.dataset.for = input.id;
      errEl.setAttribute('role', 'alert');
      errEl.setAttribute('aria-live', 'polite');
      input.after(errEl);
    }
    errEl.textContent = message;
    return false;
  }

  function clearFieldError(input) {
    if (!input) return;
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
    const errEl = input.parentElement?.querySelector?.(`.field-error[data-for="${input.id}"]`);
    if (errEl) errEl.textContent = '';
  }

  function digitsOnly(value) {
    return (value || '').replace(/\D/g, '');
  }

  function normalizeIndianPhone(raw) {
    const digits = digitsOnly(raw);
    if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) return digits.slice(1);
    return digits;
  }

  function validateFirmName(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'Firm name is required.');
    if (value.length < 3 || value.length > 100) return showFieldError(input, 'Firm name must be between 3 and 100 characters.');
    if (!/^[A-Za-z0-9][A-Za-z0-9 &.,'\-]+$/.test(value)) return showFieldError(input, 'Firm name contains invalid characters.');
    clearFieldError(input);
    return true;
  }

  function validateFullName(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'Name is required.');
    if (value.length < 3 || value.length > 100) return showFieldError(input, 'Name must be between 3 and 100 characters.');
    if (!/^[A-Za-z][A-Za-z .'-]+$/.test(value)) return showFieldError(input, 'Enter a valid name.');
    if (value.split(/\s+/).length < 2) return showFieldError(input, 'Please enter first and last name.');
    clearFieldError(input);
    return true;
  }

  function validateEmail(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'Email address is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return showFieldError(input, 'Enter a valid email address.');
    clearFieldError(input);
    return true;
  }

  function validateOptionalEmail(input) {
    const value = input?.value.trim() || '';
    if (!value) {
      clearFieldError(input);
      return true;
    }
    return validateEmail(input);
  }

  function validateIndianPhone(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'Phone number is required.');
    const normalised = digitsOnly(value);
    if (normalised.length !== 10) return showFieldError(input, 'Phone number must be exactly 10 digits.');
    if (!/^[6-9]\d{9}$/.test(normalised)) return showFieldError(input, 'Enter a valid Indian mobile number starting with 6, 7, 8 or 9.');
    clearFieldError(input);
    return true;
  }

  function validateOptionalIndianPhone(input) {
    const value = input?.value.trim() || '';
    if (!value) {
      clearFieldError(input);
      return true;
    }
    return validateIndianPhone(input);
  }

  function validateWebsite(input) {
    const value = input?.value.trim() || '';
    if (!value) {
      clearFieldError(input);
      return true;
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    } catch {
      return showFieldError(input, 'Enter a valid website URL starting with http:// or https://.');
    }
    clearFieldError(input);
    return true;
  }

  function validateStreet(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'Street address is required.');
    if (value.length < 5) return showFieldError(input, 'Street address must be at least 5 characters.');
    clearFieldError(input);
    return true;
  }

  function validateCity(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'City is required.');
    if (!/^[A-Za-z][A-Za-z .'-]+$/.test(value)) return showFieldError(input, 'Enter a valid city name.');
    clearFieldError(input);
    return true;
  }

  function validateState(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'State is required.');
    clearFieldError(input);
    return true;
  }

  function validatePin(input) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, 'PIN code is required.');
    if (!/^\d+$/.test(value)) return showFieldError(input, 'PIN code must contain numbers only.');
    if (value.length !== 6) return showFieldError(input, 'PIN code must be exactly 6 digits.');
    if (!/^[1-9]\d{5}$/.test(value)) return showFieldError(input, 'Enter a valid Indian PIN code.');
    clearFieldError(input);
    return true;
  }

  function validateRequiredSelect(input, message) {
    const value = input?.value.trim() || '';
    if (!value) return showFieldError(input, message || 'This field is required.');
    clearFieldError(input);
    return true;
  }

  function validatePassword(input) {
    const value = input?.value || '';
    if (!value) return showFieldError(input, 'Password is required.');
    const checks = [
      value.length >= 8,
      /[A-Z]/.test(value),
      /[a-z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value)
    ].filter(Boolean).length;
    if (checks < 4) return showFieldError(input, 'Password must satisfy at least 4 of 5 rules: length, upper, lower, number, special character.');
    clearFieldError(input);
    return true;
  }

  function validateConfirmPassword(input) {
    const pwd = document.getElementById('password');
    const value = input?.value || '';
    if (!value) return showFieldError(input, 'Please confirm your password.');
    if (pwd && value !== pwd.value) return showFieldError(input, 'Passwords do not match.');
    clearFieldError(input);
    return true;
  }

  function validateTerms(input) {
    if (!input?.checked) return showFieldError(input, 'Please accept the Terms of Service.');
    clearFieldError(input);
    return true;
  }

  function attachStep1Validators() {
    attachBlurValidators([
      ['full-name', validateFirmName],
      ['email', validateEmail],
      ['phone', validateIndianPhone],
      ['street', validateStreet],
      ['city', validateCity],
      ['state', validateState],
      ['zip', validatePin]
    ]);

    const phone = document.getElementById('phone');
    if (phone) {
      phone.addEventListener('input', () => {
        phone.value = digitsOnly(phone.value).slice(0, 10);
      });
    }

    const zip = document.getElementById('zip');
    if (zip) {
      zip.addEventListener('input', () => {
        zip.value = zip.value.replace(/\D/g, '').slice(0, 6);
      });
      zip.addEventListener('keydown', (e) => {
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
      });
    }
  }

  function attachStep2Validators() {
    attachBlurValidators([
      ['primary-email', validateEmail],
      ['phone', validateIndianPhone],
      ['website', validateWebsite],
      ['secondary-email', validateOptionalEmail],
      ['alt-phone', validateOptionalIndianPhone]
    ]);

    [document.getElementById('phone'), document.getElementById('alt-phone')].forEach(field => {
      if (!field) return;
      field.addEventListener('input', () => {
        field.value = digitsOnly(field.value).slice(0, 10);
      });
    });
  }

  function attachStep3Validators() {
    attachBlurValidators([
      ['admin-name', validateFullName],
      ['admin-email', validateEmail],
      ['password', validatePassword],
      ['confirm-password', validateConfirmPassword],
      ['terms', validateTerms]
    ], true);

    const password = document.getElementById('password');
    if (password) {
      password.addEventListener('input', () => {
        const confirm = document.getElementById('confirm-password');
        if (confirm && confirm.value) validateConfirmPassword(confirm);
      });
    }

    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.getAttribute('data-target');
        const input = document.getElementById(inputId);
        const icon = btn.querySelector('svg');

        if (!input) return;

        if (input.type === 'password') {
          input.type = 'text';
          icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
          input.type = 'password';
          icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
      });
    });
  }

  function attachBlurValidators(entries, includeInputForCheckbox = false) {
    entries.forEach(([id, validator]) => {
      const el = document.getElementById(id);
      if (!el) return;

      const eventName = includeInputForCheckbox && el.type === 'checkbox' ? 'change' : 'blur';
      el.addEventListener(eventName, () => validator(el));

      el.addEventListener('input', () => {
        clearFieldError(el);
        setAlert(null);
      });

      if (el.type === 'checkbox') {
        el.addEventListener('change', () => {
          clearFieldError(el);
          setAlert(null);
        });
      }
    });
  }

  function _val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function _setVal(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.value = value;
  }

  function _getDraft() {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}');
  }

  function _saveDraft(data) {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }

  function _showToast(msg, type = 'success') {
    const existing = document.querySelector('.lexflow-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'lexflow-toast' + (type === 'error' ? ' toast-error' : '');
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
});
