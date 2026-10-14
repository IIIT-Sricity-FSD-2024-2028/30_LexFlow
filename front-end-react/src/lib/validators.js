/**
 * lib/validators.js - Form validation helpers shared by the onboarding pages.
 *
 * Each validator returns an ERROR STRING when the value is bad,
 * or null when the value is fine. That makes them easy to use:
 *   const err = validateEmail(value); if (err) show it under the input.
 */

/* Full name: letters, spaces, and a few punctuation marks; at least 2 words for clients. */
export function validateName(v, { twoWords = true } = {}) {
  const value = (v || '').trim();
  if (!value) return 'Full name is required.';
  if (!/^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F .'-]{1,79}$/.test(value)) return 'Enter a valid full name.';
  if (twoWords && value.split(/\s+/).length < 2) return 'Please enter first and last name.';
  return null;
}

/* Firm name: a bit looser - digits allowed ("Firm 4U"). */
export function validateFirmName(v) {
  const value = (v || '').trim();
  if (!value) return 'Firm name is required.';
  if (value.length < 3 || value.length > 100) return 'Firm name must be between 3 and 100 characters.';
  if (!/^[A-Za-z0-9][A-Za-z0-9 &.,'\-]+$/.test(value)) return 'Firm name contains invalid characters.';
  return null;
}

/* Email address. */
export function validateEmail(v) {
  const value = (v || '').trim();
  if (!value) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Enter a valid email address.';
  return null;
}

/* Indian mobile: accepts +91 / 91 / 0 prefixes, needs a 6-9 start. */
export function validateIndianPhone(v, { required = true } = {}) {
  const value = (v || '').trim();
  if (!value) return required ? 'Phone number is required.' : null;
  const digits = value.replace(/[^0-9]/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
  return null;
}

/* 6-digit Indian PIN code. */
export function validatePin(v) {
  const value = (v || '').trim();
  if (!value) return 'PIN code is required.';
  if (/\D/.test(value)) return 'PIN code must contain numbers only.';
  if (value.length !== 6) return 'PIN code must be exactly 6 digits.';
  if (!/^[1-9]\d{5}$/.test(value)) return 'Enter a valid 6-digit Indian PIN code.';
  return null;
}

/* Street address: at least 5 characters. */
export function validateStreet(v) {
  const value = (v || '').trim();
  if (!value) return 'Street address is required.';
  if (value.length < 5) return 'Enter at least 5 characters.';
  return null;
}

/* City / state names. */
export function validateCity(v) {
  const value = (v || '').trim();
  if (!value) return 'City is required.';
  if (!/^[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F .'-]{1,49}$/.test(value)) return 'Enter a valid city name.';
  return null;
}
export function validateState(v) {
  return (v || '').trim() ? null : 'State is required.';
}

/* Password must satisfy at least 4 of the 5 classic rules. */
export function passwordScore(v) {
  const value = v || '';
  return [
    value.length >= 8,                       // long enough
    /[A-Z]/.test(value),                     // has uppercase
    /[a-z]/.test(value),                     // has lowercase
    /\d/.test(value),                        // has a number
    /[^A-Za-z0-9]/.test(value),              // has a special character
  ].filter(Boolean).length;                  // how many rules passed (0-5)
}

export function validatePassword(v) {
  if (!v) return 'Password is required.';
  return passwordScore(v) >= 4
    ? null
    : 'Password must satisfy at least 4 of the 5 rules below.';
}

export function validateConfirm(v, password) {
  if (!v) return 'Please confirm your password.';
  return v === password ? null : 'Passwords do not match.';
}

/* Optional website URL - must parse and start with http(s) when present. */
export function validateWebsite(v) {
  const value = (v || '').trim();
  if (!value) return null; // optional field
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol)
      ? null
      : 'Enter a valid website URL starting with http:// or https://';
  } catch {
    return 'Enter a valid website URL starting with http:// or https://';
  }
}

/* Strip +91/91/0 so we store a clean 10-digit number. */
export function normalizeIndianPhone(v) {
  return (v || '').replace(/[^0-9]/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0/, '');
}
