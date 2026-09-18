// Tiny self-check for lib/validators.js — run with:  npm run check
// No test framework needed; node's built-in assert does the job.
import assert from 'node:assert/strict';
import {
  validateEmail, validateIndianPhone, validatePin, validatePassword,
  validateConfirm, normalizeIndianPhone, passwordScore,
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

console.log('validators.check: all assertions passed ✔');
