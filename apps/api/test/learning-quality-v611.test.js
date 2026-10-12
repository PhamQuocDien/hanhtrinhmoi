'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FRAMEWORKS, ASSESSMENT_TYPES, COURSE_QUALITY_GATES, createLessonQualityProfile } = require('../../../content/quality/learning-quality');
const curriculum = require('../../../content/curriculum');
const questionBanks = require('../../../content/question-banks');
const careerCatalog = require('../../../content/career-paths/catalog');
const { buildCareerQuestionBank } = require('../../../content/career-paths/software-development/question-bank');

const SCHOOL_TYPES = { multiple_choice: 32, true_false: 16, fill_blank: 16, multiple_select: 8, matching: 8, ordering: 8, short_answer: 16, essay: 16 };

test('V6.1.1 quality frameworks distinguish reference alignment from actual accreditation', () => {
  const ids = new Set(FRAMEWORKS.map((item) => item.id));
  assert.ok(ids.has('MOET-GDPT-2018'));
  assert.ok(ids.has('ACM-IEEE-CS2023'));
  assert.ok(ids.has('ABET-CAC-2025-2026'));
  assert.ok(ids.has('DIGCOMP-3.0'));
  assert.ok(COURSE_QUALITY_GATES.length >= 8);
  assert.ok(ASSESSMENT_TYPES.some((item) => item.type === 'matching'));
  assert.ok(ASSESSMENT_TYPES.some((item) => item.type === 'ordering'));
  assert.ok(ASSESSMENT_TYPES.some((item) => item.type === 'code_challenge'));
  assert.ok(FRAMEWORKS.every((item) => item.url.startsWith('https://')));
});

test('quality profile supplies outcomes, learning sequence, evidence and draft status', () => {
  const profile = createLessonQualityProfile({ level: 'school', grade: 5, subjectCode: 'math', lesson: { title: 'Phân số', objective: 'So sánh phân số', alignment: { intendedOutcomes: ['So sánh đúng', 'Giải thích được', 'Vận dụng được'] }, parts: [{ type: 'theory' }, { type: 'practice' }] } });
  assert.equal(profile.profileVersion, 'V8.0.0');
  assert.equal(profile.status, 'draft-teacher-validation-required');
  assert.equal(profile.standardsAlignment.claim, 'framework-referenced-not-accredited');
  assert.ok(profile.learningOutcomes.length >= 3);
  assert.ok(profile.learningSequence.includes('guided-practice'));
  assert.ok(profile.evidenceOfLearning.length >= 2);
  assert.ok(profile.assessmentPolicy.generatedContent.includes('inactive'));
});

test('primary, THCS and THPT lesson banks generate eight objectively/written graded formats', () => {
  const samples = [[2, 'ctst', 'math'], [8, 'kntt', 'science'], [11, 'canhdieu', 'physics']];
  for (const [grade, programCode, subjectCode] of samples) {
    const course = curriculum.buildCourse(grade, programCode, subjectCode);
    assert.ok(course);
    const lesson = course.units[0].lessons[0];
    assert.ok(lesson.qualityProfile);
    const pool = questionBanks.buildQuestionPool({ grade, programCode, subjectCode, lesson });
    const bank = pool.filter((item) => item.purpose === 'assessment');
    assert.equal(bank.length, 120);
    assert.deepEqual(bank.reduce((counts, item) => { counts[item.type] = (counts[item.type] || 0) + 1; return counts; }, {}), SCHOOL_TYPES);
    assert.equal(new Set(bank.map((item) => item.questionId)).size, bank.length);
    assert.equal(new Set(bank.map((item) => item.prompt.trim().toLocaleLowerCase('vi-VN'))).size, bank.length);
    assert.ok(bank.every((item) => item.contentStatus === 'draft-teacher-review-required'));
    assert.ok(bank.filter((item) => item.type === 'matching').every((item) => item.matchingItems.length >= 2 && item.options.length >= 2));
    assert.ok(bank.filter((item) => item.type === 'ordering').every((item) => item.orderingItems.length >= 2 && item.options.length >= 2));
    assert.ok(bank.filter((item) => item.type === 'multiple_select').every((item) => item.options.length >= 2 && item.correctAnswer.includes('|')));
  }
});

test('university IT lesson API includes CS, assessment and accessibility quality profile without accreditation claims', () => {
  const course = careerCatalog.getAllCourses().find((item) => item.lessons.some((lesson) => lesson.codeExercise?.enabled));
  assert.ok(course);
  const publicCourse = careerCatalog.publicCourseDetail(course);
  const lesson = publicCourse.lessons.find((item) => item.codeExercise?.enabled);
  assert.ok(lesson.qualityProfile.computingOutcomes.length >= 4);
  assert.ok(lesson.qualityProfile.standardsAlignment.references.includes('ACM-IEEE-CS2023'));
  assert.equal(lesson.qualityProfile.standardsAlignment.claim, 'framework-referenced-not-accredited');
  assert.equal(Object.hasOwn(lesson.codeExercise, 'testCases'), false);
});

test('university bank creates 64 varied draft questions per lesson, all linked to the lesson and course', () => {
  const courses = careerCatalog.getAllCourses();
  const bank = buildCareerQuestionBank();
  assert.equal(courses.length, 34);
  assert.equal(bank.length, 414 * 64);
  assert.equal(new Set(bank.map((item) => item.questionId)).size, bank.length);
  const byLesson = new Map();
  for (const item of bank) {
    const key = `${item.courseId}|${item.lessonId}`;
    const rows = byLesson.get(key) || [];
    rows.push(item);
    byLesson.set(key, rows);
    assert.equal(item.active, false);
    assert.equal(item.contentStatus, 'draft-teacher-review-required');
    assert.ok(courses.some((course) => course.id === item.courseId && course.modules.some((unit) => unit.id === item.moduleId && unit.lessons.some((lesson) => lesson.id === item.lessonId))));
  }
  assert.equal(byLesson.size, 414);
  for (const [key, rows] of byLesson) {
    assert.equal(rows.length, 64, key);
    assert.equal(new Set(rows.map((item) => item.prompt)).size, rows.length, key);
  }
});
