'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../../content/career-paths/catalog');
const { MIN_FINAL_ASSESSMENT_QUESTIONS, getCourseFinalAssessmentEligibility, hasEnoughFinalAssessmentQuestions } = require('../src/services/career-assessment-policy');

test('a final assessment requires enrollment and completion of every lesson', () => {
  const course = catalog.getAllCourses()[0];
  const notEnrolled = getCourseFinalAssessmentEligibility(course, null);
  assert.equal(notEnrolled.allowed, false);
  assert.equal(notEnrolled.reason, 'not_enrolled');
  const partial = getCourseFinalAssessmentEligibility(course, { completedLessonIds: [course.lessons[0].id] });
  assert.equal(partial.allowed, false);
  assert.equal(partial.reason, 'lessons_incomplete');
  assert.equal(partial.completedLessons, 1);
  assert.equal(partial.incompleteLessons.length, course.lessons.length - 1);
  const completed = getCourseFinalAssessmentEligibility(course, { completedLessonIds: course.lessons.map((lesson) => lesson.id) });
  assert.equal(completed.allowed, true);
  assert.equal(completed.completedLessons, course.lessons.length);
  assert.equal(completed.incompleteLessons.length, 0);
});

test('the course final exam needs at least ten approved, unique questions', () => {
  assert.equal(MIN_FINAL_ASSESSMENT_QUESTIONS, 10);
  assert.equal(hasEnoughFinalAssessmentQuestions(9), false);
  assert.equal(hasEnoughFinalAssessmentQuestions(10), true);
  assert.equal(hasEnoughFinalAssessmentQuestions(30), true);
});

test('all 34 IT courses can use the same completion policy', () => {
  for (const course of catalog.getAllCourses()) {
    const result = getCourseFinalAssessmentEligibility(course, { completedLessonIds: course.lessons.map((lesson) => lesson.id) });
    assert.equal(result.allowed, true, course.id);
    assert.equal(result.lessonCount, course.lessons.length, course.id);
  }
});
