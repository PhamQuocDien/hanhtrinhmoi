'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, canonicalEmailFilter, groupEmailCollisions } = require('../src/utils/email-identity');

test('email identity trims whitespace, applies unicode normalization and case folding', () => {
  assert.equal(normalizeEmail('  User.Name+tag@GMAIL.COM  '), 'user.name+tag@gmail.com');
  assert.equal(normalizeEmail('ＡＢＣ@example.com'), 'abc@example.com');
  assert.equal(normalizeEmail(null), '');
});

test('canonical email filter matches legacy case and edge whitespace variants in MongoDB', () => {
  const filter = canonicalEmailFilter('  Student@Example.com ');
  assert.deepEqual(filter.$expr.$eq[1], 'student@example.com');
  assert.deepEqual(filter.$expr.$eq[0].$toLower.$trim.input.$ifNull, ['$email', '']);
});

test('migration collision scan detects accounts that normalize to the same email', () => {
  const collisions = groupEmailCollisions([
    { _id: '1', email: 'student@gmail.com' },
    { _id: '2', email: ' Student@Gmail.com ' },
    { _id: '3', email: 'other@gmail.com' }
  ]);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0].normalizedEmail, 'student@gmail.com');
  assert.equal(collisions[0].rows.length, 2);
});

test('email migration does not report normalized unique accounts as collisions', () => {
  assert.deepEqual(groupEmailCollisions([{ email: 'a@example.com' }, { email: 'b@example.com' }]), []);
});
