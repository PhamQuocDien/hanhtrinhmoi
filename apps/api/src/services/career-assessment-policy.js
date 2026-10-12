'use strict';

const MIN_FINAL_ASSESSMENT_QUESTIONS = 10;

function getCourseFinalAssessmentEligibility(course, enrollment) {
  const lessons = Array.isArray(course?.lessons) ? course.lessons : [];
  const completed = new Set(enrollment?.completedLessonIds || []);
  const incompleteLessons = lessons.filter((lesson) => !completed.has(lesson.id));
  if (!enrollment) {
    return { allowed: false, reason: 'not_enrolled', completedLessons: 0, lessonCount: lessons.length, incompleteLessons };
  }
  if (!lessons.length) {
    return { allowed: false, reason: 'no_lessons', completedLessons: 0, lessonCount: 0, incompleteLessons: [] };
  }
  return {
    allowed: incompleteLessons.length === 0,
    reason: incompleteLessons.length ? 'lessons_incomplete' : '',
    completedLessons: lessons.length - incompleteLessons.length,
    lessonCount: lessons.length,
    incompleteLessons
  };
}

function hasEnoughFinalAssessmentQuestions(questionCount) {
  return Number(questionCount) >= MIN_FINAL_ASSESSMENT_QUESTIONS;
}

module.exports = { MIN_FINAL_ASSESSMENT_QUESTIONS, getCourseFinalAssessmentEligibility, hasEnoughFinalAssessmentQuestions };
