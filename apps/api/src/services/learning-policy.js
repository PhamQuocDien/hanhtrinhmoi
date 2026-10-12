'use strict';

function getPartProgress(progress, lessonId, partId) {
  return (progress?.completedParts || []).find((item) => item.lessonId === lessonId && item.partId === partId);
}
function getLessonProgress(progress, lessonId) {
  return (progress?.lessons || []).find((item) => item.lessonId === lessonId);
}
function lessonPassed(progress, lessonId, passScore = 70) {
  const record = getLessonProgress(progress, lessonId);
  return Boolean(record?.passed && Number(record.bestScore) >= passScore);
}
function courseLessonList(course) {
  return (course?.units || []).flatMap((unit) => unit.lessons || []);
}
function findPreviousLesson(course, lesson) {
  return courseLessonList(course).find((candidate) => candidate.sequence === lesson.sequence - 1);
}
function isLessonUnlocked(course, lesson, progress, passScore = 70) {
  if (!course || !lesson) return false;
  if (lesson.sequence === 1) return true;
  const previous = findPreviousLesson(course, lesson);
  return Boolean(previous && lessonPassed(progress, previous.id, passScore));
}
function allPartsPassed(lesson, progress) {
  return Boolean(lesson?.parts?.length) && lesson.parts.every((part) => getPartProgress(progress, lesson.id, part.id)?.passed);
}
function scoreMeetsThreshold(score, threshold = 70) {
  const number = Number(score);
  return Number.isFinite(number) && number >= threshold;
}

module.exports = { getPartProgress, getLessonProgress, lessonPassed, courseLessonList, findPreviousLesson, isLessonUnlocked, allPartsPassed, scoreMeetsThreshold };
