'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requireTeacher } = require('../src/middleware/security');
const { isTeacherRegistrationAuthorized } = require('../src/services/teacher-registration-policy');
function responseMock() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
test('teacher guard rejects anonymous and learner sessions', () => {
  for (const session of [undefined, { user: { role: 'student' } }, { user: { role: 'admin' } }]) {
    const req = { session }; const res = responseMock(); let passed = false;
    requireTeacher(req, res, () => { passed = true; });
    assert.equal(passed, false);
    assert.ok([401, 403].includes(res.statusCode));
  }
});
test('teacher guard allows authenticated teacher sessions only', () => {
  const req = { session: { user: { id: 'teacher-id', role: 'teacher' } } }; const res = responseMock(); let passed = false;
  requireTeacher(req, res, () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(res.statusCode, 200);
});

test('teacher registration requires a configured long invitation code', () => {
  assert.equal(isTeacherRegistrationAuthorized('student', '', ''), true);
  assert.equal(isTeacherRegistrationAuthorized('teacher', 'anything', undefined), false);
  assert.equal(isTeacherRegistrationAuthorized('teacher', 'replace-with-a-random-invite-code-at-least-24-chars', 'replace-with-a-random-invite-code-at-least-24-chars'), false);
  assert.equal(isTeacherRegistrationAuthorized('teacher', 'wrong-code-is-long-enough-123', 'teacher-registration-invite-code-2026'), false);
  assert.equal(isTeacherRegistrationAuthorized('teacher', 'teacher-registration-invite-code-2026', 'teacher-registration-invite-code-2026'), true);
});
