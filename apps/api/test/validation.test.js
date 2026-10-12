'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistration, validateSurvey, ALLOWED_ROLES } = require('../src/utils/validation');
const { safeEqual, createCsrfToken } = require('../src/middleware/security');

test('registration accepts valid student account and normalizes email', () => {
  const result = validateRegistration({ fullName: ' Nguyễn An ', email: 'AN@EXAMPLE.COM', password: 'a-long-passphrase', role: 'student', school: 'THPT A' });
  assert.equal(result.valid, true);
  assert.equal(result.value.email, 'an@example.com');
  assert.equal(result.value.fullName, 'Nguyễn An');
});

test('registration rejects short password and unknown roles', () => {
  const result = validateRegistration({ fullName: 'Nguyễn An', email: 'an@example.com', password: 'short', role: 'admin' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.password);
  assert.ok(result.errors.role);
  assert.ok(!ALLOWED_ROLES.has('admin'));
});

test('registration rejects malformed email and empty name', () => {
  const result = validateRegistration({ fullName: ' ', email: 'not-an-email', password: 'long-enough-pass', role: 'teacher' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.fullName);
  assert.ok(result.errors.email);
});

test('survey accepts a complete learner response', () => {
  const result = validateSurvey({ educationLevel: 'university', goal: 'career', topics: ['cpp', 'javascript', 'cpp'], currentLevel: 'basic', weeklyHours: '3-5', learningStyle: 'project', birthDate: '2005-06-15', gender: 'prefer_not_to_say', currentSchoolGrade: '', programCode: 'ctst', challenges: 'Thiếu dự án', target: 'Làm website' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value.topics, ['cpp', 'javascript']);
});

test('survey rejects absent topics and invalid choices', () => {
  const result = validateSurvey({ educationLevel: 'planet', goal: 'maybe', topics: [], currentLevel: 'unknown', weeklyHours: '99', learningStyle: 'magic', birthDate: '', gender: 'unknown', currentSchoolGrade: '', programCode: 'unknown' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.educationLevel);
  assert.ok(result.errors.goal);
  assert.ok(result.errors.topics);
});

test('CSRF token is random, stable comparison is safe, and unequal input fails', () => {
  const a = createCsrfToken();
  const b = createCsrfToken();
  assert.equal(a.length, 64);
  assert.notEqual(a, b);
  assert.equal(safeEqual(a, a), true);
  assert.equal(safeEqual(a, b), false);
  assert.equal(safeEqual(a, undefined), false);
});

test('school survey validates date and grade, and flags age-grade mismatch without silently changing the grade', () => {
  const result = validateSurvey({ educationLevel: 'high_school', goal: 'school_support', topics: ['math', 'school_subjects'], currentLevel: 'basic', weeklyHours: '3-5', learningStyle: 'mixed', birthDate: '2010-01-10', gender: 'female', currentSchoolGrade: 11, programCode: 'kntt' });
  assert.equal(result.valid, true);
  assert.equal(result.value.currentSchoolGrade, 11);
  assert.equal(result.value.expectedGrade, 11);
  assert.equal(result.value.gradeAgeMismatch, false);
});

test('survey rejects impossible/future birth dates and a grade outside its education level', () => {
  const invalidDate = validateSurvey({ educationLevel: 'primary', goal: 'school_support', topics: ['math'], currentLevel: 'basic', weeklyHours: '3-5', learningStyle: 'mixed', birthDate: '2030-02-31', gender: 'female', currentSchoolGrade: 1, programCode: 'ctst' });
  assert.equal(invalidDate.valid, false);
  assert.ok(invalidDate.errors.birthDate);
  const invalidGrade = validateSurvey({ educationLevel: 'primary', goal: 'school_support', topics: ['math'], currentLevel: 'basic', weeklyHours: '3-5', learningStyle: 'mixed', birthDate: '2015-02-10', gender: 'male', currentSchoolGrade: 9, programCode: 'ctst' });
  assert.equal(invalidGrade.valid, false);
  assert.ok(invalidGrade.errors.currentSchoolGrade);
});
