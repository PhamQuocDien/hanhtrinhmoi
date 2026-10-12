'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../../content/career-paths/software-development');
const { buildCareerQuestionBank } = require('../../../content/career-paths/software-development/question-bank');
const fullCatalog = require('../../../content/career-paths/catalog');

test('Group 1 preserves six modules and twenty-one distinct lessons in V6.1.1', () => {
  assert.equal(catalog.COURSES.length, 9);
  const allIds = new Set();
  for (const course of catalog.COURSES) {
    assert.equal(course.modules.length, 6, `${course.id} should have six modules`);
    assert.equal(course.lessonCount, 21, `${course.id} should have 21 lessons`);
    assert.equal(course.lessons.length, 21);
    for (const lesson of course.lessons) {
      assert.ok(!allIds.has(lesson.id), `duplicate lesson id: ${lesson.id}`);
      allIds.add(lesson.id);
      assert.ok(lesson.title && lesson.objective && lesson.material && lesson.practice && lesson.deliverable);
    }
  }
  assert.equal(allIds.size, 189);
});

test('V6.1.1 career bank generates 64 unique draft questions per lesson across all nine IT groups', () => {
  const questions = buildCareerQuestionBank();
  assert.equal(fullCatalog.listCourses().length, 34);
  assert.equal(fullCatalog.getAllCourses().reduce((total, item) => total + item.lessonCount, 0), 414);
  assert.equal(questions.length, 414 * 64);
  assert.equal(new Set(questions.map((item) => item.questionId)).size, questions.length);
  const promptsByLesson = new Map();
  for (const item of questions) {
    const course = fullCatalog.getCourse(item.courseId);
    assert.ok(course, `course missing: ${item.courseId}`);
    assert.ok(course.lessons.some((lesson) => lesson.id === item.lessonId), `lesson link mismatch: ${item.questionId}`);
    assert.ok(course.modules.some((module) => module.id === item.moduleId && module.lessons.some((lesson) => lesson.id === item.lessonId)), `module link mismatch: ${item.questionId}`);
    assert.equal(item.active, false, 'template-generated questions must wait for review');
    assert.equal(item.contentStatus, 'draft-teacher-review-required');
    assert.ok(item.prompt.length >= 8);
    const key = `${item.courseId}|${item.lessonId}`;
    if (!promptsByLesson.has(key)) promptsByLesson.set(key, new Set());
    assert.ok(!promptsByLesson.get(key).has(item.prompt), `duplicate prompt for ${key}: ${item.prompt}`);
    promptsByLesson.get(key).add(item.prompt);
    if (item.type === 'multiple_choice') {
      assert.ok(item.options.length >= 2);
      assert.ok(item.options.some((option) => option.value === item.correctAnswer), `answer not found in choices: ${item.questionId}`);
    }
    if (item.type === 'true_false') assert.ok(['true', 'false'].includes(item.correctAnswer));
  }
  assert.equal(promptsByLesson.size, 414);
});

test('every lesson bank contains varied question types and difficulty levels', () => {
  const questions = buildCareerQuestionBank();
  const groups = new Map();
  for (const item of questions) {
    const key = `${item.courseId}|${item.lessonId}`;
    if (!groups.has(key)) groups.set(key, { types: new Set(), levels: new Set() });
    groups.get(key).types.add(item.type);
    groups.get(key).levels.add(item.difficulty);
  }
  for (const [key, value] of groups) {
    assert.ok(value.types.size >= 7, `${key} lacks question type diversity`);
    assert.ok(value.levels.size >= 2, `${key} lacks difficulty diversity`);
  }
});
