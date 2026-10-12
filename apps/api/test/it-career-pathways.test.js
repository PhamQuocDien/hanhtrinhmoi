'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../../content/career-paths/catalog');
const questionBank = require('../../../content/career-paths/software-development/question-bank');
const { getVideoLink } = require('../../../content/video-links');

test('catalog has all nine IT groups and each group has courses and its own pathways', () => {
  const groups = catalog.listGroups();
  assert.equal(groups.length, 9);
  assert.deepEqual(groups.map((item) => item.number), [1,2,3,4,5,6,7,8,9]);
  for (const group of groups) {
    const courses = catalog.listCourses(group.id);
    assert.ok(courses.length >= 3, `${group.id} needs at least 3 courses`);
    assert.ok(group.pathways.length >= 3, `${group.id} needs pathways`);
    const ids = new Set(courses.map((item) => item.id));
    for (const pathway of group.pathways) for (const id of pathway.courseIds) assert.ok(ids.has(id), `${pathway.id} contains unknown course ${id}`);
  }
});

test('all career courses have unique course, module and lesson ids and actionable lesson sections', () => {
  const courses = catalog.getAllCourses();
  assert.equal(courses.length, 34);
  const courseIds = new Set();
  const lessonIds = new Set();
  for (const course of courses) {
    assert.ok(!courseIds.has(course.id), `duplicate course id ${course.id}`);
    courseIds.add(course.id);
    const isOriginalGroup = course.groupId === 'it-group-1';
    assert.equal(course.modules.length, isOriginalGroup ? 6 : 3, `${course.id} module count`);
    assert.equal(course.lessons.length, isOriginalGroup ? 21 : 9, `${course.id} lesson count`);
    for (const lesson of course.lessons) {
      assert.ok(!lessonIds.has(lesson.id), `duplicate lesson id ${lesson.id}`);
      lessonIds.add(lesson.id);
      assert.ok(lesson.objective && lesson.material && lesson.example && lesson.practice && lesson.deliverable, `lesson fields missing: ${lesson.id}`);
      assert.ok(Array.isArray(lesson.sections) && lesson.sections.some((part) => part.type === 'theory') && lesson.sections.some((part) => part.type === 'practice'), `missing theory/practice: ${lesson.id}`);
    }
  }
  assert.equal(lessonIds.size, 414);
});

test('coding lessons expose only supported executable languages and starter code', () => {
  const allowed = new Set(['cpp','java','csharp','javascript','python','sql']);
  let coded = 0;
  for (const course of catalog.getAllCourses()) for (const lesson of course.lessons) {
    const exercise = lesson.codeExercise;
    if (!exercise?.enabled) continue;
    coded += 1;
    assert.ok(Array.isArray(exercise.runnableLanguages));
    for (const language of exercise.runnableLanguages) {
      assert.ok(allowed.has(language), `${lesson.id} contains unsupported runner language ${language}`);
      assert.ok(String(exercise.starterCodeByLanguage?.[language] || '').trim(), `${lesson.id} missing ${language} starter code`);
    }
    for (const language of exercise.languages) assert.ok(String(exercise.starterCodeByLanguage?.[language] || '').trim(), `${lesson.id} missing ${language} starter code`);
  }
  assert.ok(coded > 250, `expected broad practice coverage, got ${coded}`);
});

test('public course detail contains code lab but does not expose answer keys or hidden tests', () => {
  const course = catalog.getAllCourses().find((item) => item.lessons.some((lesson) => lesson.codeExercise?.enabled));
  const publicCourse = catalog.publicCourseDetail(course);
  const lesson = publicCourse.lessons.find((item) => item.codeExercise?.enabled);
  assert.ok(lesson.codeExercise.starterCodeByLanguage);
  assert.equal(Object.hasOwn(lesson.codeExercise, 'testCases'), false);
  assert.equal(Object.hasOwn(lesson.codeExercise, 'correctAnswer'), false);
  assert.equal(Object.hasOwn(lesson, 'correctAnswer'), false);
});

test('career question bank is generated for every group without duplicate question ids', () => {
  const rows = questionBank.buildCareerQuestionBank();
  assert.equal(rows.length, 414 * 64);
  const ids = new Set();
  const byLesson = new Map();
  for (const row of rows) {
    assert.ok(!ids.has(row.questionId), `duplicate question id ${row.questionId}`);
    ids.add(row.questionId);
    assert.equal(row.active, false, 'generated questions must remain unapproved/inactive');
    assert.equal(row.contentStatus, 'draft-teacher-review-required');
    const list = byLesson.get(row.lessonId) || [];
    list.push(row);
    byLesson.set(row.lessonId, list);
  }
  assert.equal(byLesson.size, 414);
  for (const [lessonId, items] of byLesson) {
    assert.equal(items.length, 64, `${lessonId} question count`);
    assert.equal(new Set(items.map((item) => item.prompt)).size, items.length, `${lessonId} repeated prompt`);
    assert.ok(items.every((item) => item.courseId && item.moduleId && item.lessonId && item.taxonomy && item.difficulty && item.type));
  }
});


test('every university career lesson has a separate editable video-link row', () => {
  let rows = 0;
  for (const course of catalog.getAllCourses()) for (const lesson of course.lessons) {
    const entry = getVideoLink({ programCode: 'career', grade: 'university', subjectCode: course.groupCode || course.groupId, lessonId: lesson.id });
    assert.ok(entry && entry.videoTitle, `missing video link row for ${lesson.id}`);
    assert.ok(entry.videoUrl.includes(lesson.id), `video placeholder should map to ${lesson.id}`);
    assert.equal(entry.status, 'placeholder', `video must remain a draft until uploaded for ${lesson.id}`);
    rows += 1;
  }
  assert.equal(rows, 414);
});
