import { test, expect } from '@playwright/test';
import {
  validateBarNumber,
  verifyBarNumber,
  formatBarNumber,
  STATE_BAR_COUNCILS,
  validateAadhaar,
  verifyAadhaar,
  formatAadhaar,
} from '../src/lib/validators.js';

test.describe('Bar Number Implementation & Verification Function', () => {
  test('verifyBarNumber verifies valid Indian Bar Council enrollment numbers', () => {
    // Standard Maharashtra & Goa Bar
    const res1 = verifyBarNumber('MAH/1234/2018');
    expect(res1.isValid).toBe(true);
    expect(res1.barNumber).toBe('MAH/1234/2018');
    expect(res1.stateCode).toBe('MAH');
    expect(res1.rollNumber).toBe(1234);
    expect(res1.year).toBe(2018);
    expect(res1.council).toBe('Bar Council of Maharashtra & Goa');

    // Delhi Bar Council
    const res2 = verifyBarNumber('DL/5678/2015');
    expect(res2.isValid).toBe(true);
    expect(res2.council).toBe('Bar Council of Delhi');

    // Karnataka Bar Council with hyphen
    const res3 = verifyBarNumber('KAR-9012-2020');
    expect(res3.isValid).toBe(true);
    expect(res3.council).toBe('Bar Council of Karnataka');

    // Lowercase input is canonicalized
    const res4 = verifyBarNumber('up/4321/2019');
    expect(res4.isValid).toBe(true);
    expect(res4.barNumber).toBe('UP/4321/2019');
    expect(res4.council).toBe('Bar Council of Uttar Pradesh');
  });

  test('verifyBarNumber rejects invalid or corrupted formats', () => {
    expect(verifyBarNumber('').isValid).toBe(false);
    expect(verifyBarNumber('INVALID').isValid).toBe(false);
    expect(verifyBarNumber('MAH/123').isValid).toBe(false); // missing year
    expect(verifyBarNumber('MAH/0/2020').isValid).toBe(false); // zero roll number
    expect(verifyBarNumber('MAH/1234/1850').isValid).toBe(false); // year too old (<1950)
    expect(verifyBarNumber('MAH/1234/2099').isValid).toBe(false); // future year (> current year)
  });

  test('validateBarNumber integrates cleanly with form validation', () => {
    expect(validateBarNumber('MAH/1234/2018')).toBeNull();
    expect(validateBarNumber('')).toBe('Bar Council enrollment number is required.');
    expect(validateBarNumber('NOT_A_BAR')).toBeTruthy();
  });
});

test.describe('Aadhaar Card as Primary Key (12 Numbers in 4-4-4 Format)', () => {
  test('formatAadhaar formats raw digits into 4-4-4 pattern', () => {
    expect(formatAadhaar('543287654321')).toBe('5432-8765-4321');
    expect(formatAadhaar('123456789012')).toBe('1234-5678-9012');
    expect(formatAadhaar('5432')).toBe('5432');
    expect(formatAadhaar('54328')).toBe('5432-8');
    expect(formatAadhaar('543287654')).toBe('5432-8765-4');
  });

  test('verifyAadhaar verifies 12-digit Indian Aadhaar card', () => {
    const res = verifyAadhaar('5432-8765-4321');
    expect(res.isValid).toBe(true);
    expect(res.formatted).toBe('5432-8765-4321');
    expect(res.raw).toBe('543287654321');

    // Rejects non-12 digits
    expect(verifyAadhaar('5432-8765').isValid).toBe(false);
    // Rejects repeated digits
    expect(verifyAadhaar('1111-1111-1111').isValid).toBe(false);
  });

  test('validateAadhaar returns null for valid 4-4-4 format and errors otherwise', () => {
    expect(validateAadhaar('5432-8765-4321')).toBeNull();
    expect(validateAadhaar('')).toBe('Aadhaar card number is required.');
    expect(validateAadhaar('1234')).toBeTruthy();
    expect(validateAadhaar('543287654321')).toBe('Enter Aadhaar in 4-4-4 format (e.g. 5432-8765-4321).');
  });
});
