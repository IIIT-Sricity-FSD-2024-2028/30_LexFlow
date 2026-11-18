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

/* ──────────────────────────────── BAR NUMBER VALIDATION & VERIFICATION ──────────────────────────────── */

export const STATE_BAR_COUNCILS = {
  DL: 'Bar Council of Delhi',
  D: 'Bar Council of Delhi',
  MAH: 'Bar Council of Maharashtra & Goa',
  MH: 'Bar Council of Maharashtra & Goa',
  KAR: 'Bar Council of Karnataka',
  KA: 'Bar Council of Karnataka',
  UP: 'Bar Council of Uttar Pradesh',
  AP: 'Bar Council of Andhra Pradesh',
  TS: 'Bar Council of Telangana',
  TN: 'Bar Council of Tamil Nadu & Puducherry',
  WB: 'Bar Council of West Bengal',
  GUJ: 'Bar Council of Gujarat',
  GJ: 'Bar Council of Gujarat',
  MP: 'Bar Council of Madhya Pradesh',
  KER: 'Bar Council of Kerala',
  KL: 'Bar Council of Kerala',
  BIH: 'Bar Council of Bihar',
  BR: 'Bar Council of Bihar',
  ORI: 'Bar Council of Odisha',
  OR: 'Bar Council of Odisha',
  RAJ: 'Bar Council of Rajasthan',
  RJ: 'Bar Council of Rajasthan',
  JH: 'Bar Council of Jharkhand',
  UK: 'Bar Council of Uttarakhand',
  UTT: 'Bar Council of Uttarakhand',
  PH: 'Bar Council of Punjab & Haryana',
  CH: 'Bar Council of Chandigarh',
  AS: 'Bar Council of Assam, Nagaland, Mizoram, Arunachal Pradesh & Sikkim',
  BCI: 'Bar Council of India',
};

/** Normalizes bar number into uppercase canonical format */
export function formatBarNumber(v) {
  return (v || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Programmatically verify a lawyer's Bar enrollment number.
 * Supports authentic Indian Bar formats: [STATE_CODE]/[ROLL_NO]/[YEAR] (e.g. MAH/1234/2018 or D/567/2020).
 * Returns { isValid: boolean, barNumber?: string, stateCode?: string, council?: string, rollNumber?: number, year?: number, error?: string }
 */
export function verifyBarNumber(v) {
  const value = formatBarNumber(v);
  if (!value) {
    return { isValid: false, error: 'Bar enrollment number cannot be empty.' };
  }

  const match = value.match(/^([A-Z]{1,4}(?:&[A-Z]+)?)[/-](\d{1,6})[/-](\d{2}|\d{4})$/);
  if (!match) {
    return {
      isValid: false,
      error: 'Invalid format. Bar number must follow [STATE_CODE]/[ROLL_NO]/[YEAR] (e.g., MAH/1234/2018 or D/567/2020).',
    };
  }

  const [, stateCode, rollStr, yearStr] = match;
  const rollNumber = parseInt(rollStr, 10);
  let year = parseInt(yearStr, 10);
  if (yearStr.length === 2) {
    year = year <= 30 ? 2000 + year : 1900 + year;
  }

  if (rollNumber <= 0 || rollNumber > 999999) {
    return { isValid: false, error: 'Enrollment sequence number must be between 1 and 999999.' };
  }

  const currentYear = new Date().getFullYear();
  if (year < 1950 || year > currentYear) {
    return { isValid: false, error: `Enrollment year must be between 1950 and ${currentYear}.` };
  }

  const council = STATE_BAR_COUNCILS[stateCode] || `${stateCode} State Bar Council`;
  const canonical = `${stateCode}/${rollNumber}/${year}`;

  return {
    isValid: true,
    barNumber: canonical,
    stateCode,
    council,
    rollNumber,
    year,
  };
}

/** Form validator: returns null if valid, error message string if invalid */
export function validateBarNumber(v, { required = true } = {}) {
  const value = formatBarNumber(v);
  if (!value) return required ? 'Bar Council enrollment number is required.' : null;
  const verification = verifyBarNumber(value);
  return verification.isValid ? null : verification.error;
}

/* ──────────────────────────────── AADHAAR CARD VALIDATION & VERIFICATION ──────────────────────────────── */

/** Formats 12 digits into 4-4-4 format: XXXX-XXXX-XXXX */
export function formatAadhaar(v) {
  const digits = (v || '').replace(/\D/g, '').slice(0, 12);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  if (digits.length > 8) parts.push(digits.slice(8, 12));
  return parts.join('-');
}

/**
 * Programmatically verify a 12-digit Indian Aadhaar card number.
 * Enforces 12 numeric digits in 4-4-4 format.
 * Returns { isValid: boolean, aadhaar?: string, raw?: string, formatted?: string, error?: string }
 */
export function verifyAadhaar(v) {
  const value = (v || '').trim();
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return { isValid: false, error: 'Aadhaar number cannot be empty.' };
  }
  if (digits.length !== 12) {
    return {
      isValid: false,
      error: `Aadhaar must contain exactly 12 numeric digits (found ${digits.length}).`,
    };
  }
  if (/^(\d)\1{11}$/.test(digits)) {
    return {
      isValid: false,
      error: 'Invalid Aadhaar: sequence cannot consist of identical repeated digits.',
    };
  }
  const formatted = `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
  return {
    isValid: true,
    aadhaar: formatted,
    raw: digits,
    formatted,
  };
}

/** Form validator: returns null if valid, error message string if invalid */
export function validateAadhaar(v, { required = true } = {}) {
  const value = (v || '').trim();
  if (!value) return required ? 'Aadhaar card number is required.' : null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 12) {
    return 'Aadhaar must be exactly 12 digits (in 4-4-4 format, e.g. 5432-8765-4321).';
  }
  const verification = verifyAadhaar(value);
  if (!verification.isValid) return verification.error;
  if (!/^\d{4}-\d{4}-\d{4}$/.test(value)) {
    return 'Enter Aadhaar in 4-4-4 format (e.g. 5432-8765-4321).';
  }
  return null;
}
