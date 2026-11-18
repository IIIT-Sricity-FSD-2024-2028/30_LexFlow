// Tiny self-check for lib/validators.js — run with:  npm run check
// No test framework needed; node's built-in assert does the job.
import assert from 'node:assert/strict';
import {
  validateEmail, validateIndianPhone, validatePin, validatePassword,
  validateConfirm, normalizeIndianPhone, passwordScore,
  validateBarNumber, verifyBarNumber, formatBarNumber,
  validateAadhaar, verifyAadhaar, formatAadhaar,
} from './validators.js';

// Email: good passes, garbage fails, empty fails.
assert.equal(validateEmail('john@doe.com'), null);
assert.ok(validateEmail('not-an-email'));
assert.ok(validateEmail(''));

// Indian mobile: accepts +91/0 prefixes, rejects wrong starts.
assert.equal(validateIndianPhone('+91 98765 43210'), null);
assert.equal(validateIndianPhone('08876543210'), null);
assert.ok(validateIndianPhone('1234567890')); // must start 6-9
assert.ok(validateIndianPhone('98765'));      // too short

// PIN: 6 digits, first non-zero.
assert.equal(validatePin('560001'), null);
assert.ok(validatePin('056001'));
assert.ok(validatePin('56001'));

// Password: 4-of-5 rule.
assert.ok(validatePassword('abc'));                 // way too weak
assert.ok(validatePassword('Abcdef1'));             // only 3 rules -> fails
assert.equal(validatePassword('Abcdefg1!'), null);  // all 5 rules
assert.equal(validatePassword('Abcdefg1'), null);   // exactly 4 rules -> passes
assert.equal(passwordScore('Abcdefg1'), 4);

// Confirm + normaliser.
assert.equal(validateConfirm('x', 'x'), null);
assert.ok(validateConfirm('x', 'y'));
assert.equal(normalizeIndianPhone('+91 98765 43210'), '9876543210');
assert.equal(normalizeIndianPhone('09876543210'), '9876543210');

// ── Bar Number Validation & Verification ──
console.log('Testing Bar Number validation & verification...');
// Valid Indian Bar numbers
assert.equal(validateBarNumber('MAH/1234/2018'), null);
assert.equal(validateBarNumber('DL/5678/2015'), null);
assert.equal(validateBarNumber('KAR/9012/2020'), null);
assert.equal(validateBarNumber('D/567/2021'), null);
assert.equal(validateBarNumber('ap/4321/2019'), null); // lower case canonicalized

// Verification helper function
const vMah = verifyBarNumber('MAH/1234/2018');
assert.equal(vMah.isValid, true);
assert.equal(vMah.barNumber, 'MAH/1234/2018');
assert.equal(vMah.stateCode, 'MAH');
assert.equal(vMah.rollNumber, 1234);
assert.equal(vMah.year, 2018);
assert.equal(vMah.council, 'Bar Council of Maharashtra & Goa');

const vDl = verifyBarNumber('DL/999/2022');
assert.equal(vDl.isValid, true);
assert.equal(vDl.council, 'Bar Council of Delhi');

// Invalid Bar numbers
assert.ok(validateBarNumber('')); // required
assert.ok(validateBarNumber('INVALID')); // wrong format
assert.ok(validateBarNumber('MAH-123')); // missing year
assert.ok(validateBarNumber('MAH/1234/1800')); // year out of range
assert.ok(validateBarNumber('MAH/0/2020')); // roll number 0 invalid
assert.equal(verifyBarNumber('INVALID').isValid, false);

// ── Aadhaar Card (12 numbers in 4-4-4 format) Validation & Verification ──
console.log('Testing Aadhaar Card (12 digits, 4-4-4 format) validation...');
// Valid Aadhaar
assert.equal(validateAadhaar('5432-8765-4321'), null);
assert.equal(validateAadhaar('1234-5678-9012'), null);
assert.equal(validateAadhaar('9876-5432-1098'), null);

const vAadhaar = verifyAadhaar('5432-8765-4321');
assert.equal(vAadhaar.isValid, true);
assert.equal(vAadhaar.formatted, '5432-8765-4321');
assert.equal(vAadhaar.raw, '543287654321');

// Formatter test
assert.equal(formatAadhaar('543287654321'), '5432-8765-4321');
assert.equal(formatAadhaar('5432-8765-4321'), '5432-8765-4321');
assert.equal(formatAadhaar('5432876'), '5432-876');

// Invalid Aadhaar
assert.ok(validateAadhaar('')); // required
assert.ok(validateAadhaar('5432-8765-432')); // too short
assert.ok(validateAadhaar('5432-8765-43210')); // too long
assert.ok(validateAadhaar('1111-1111-1111')); // repeating identical digits
assert.ok(validateAadhaar('543287654321')); // needs 4-4-4 format in form validator
assert.equal(verifyAadhaar('000000000000').isValid, false);

console.log('validators.check: all assertions passed ✔');
