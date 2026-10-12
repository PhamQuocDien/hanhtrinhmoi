'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const curriculum = require('../../../content/curriculum/primary/primary-curriculum');
const { publicQuestion, publicLesson } = curriculum;
const { isLessonUnlocked, allPartsPassed, scoreMeetsThreshold } = require('../src/services/learning-policy');
const { gradeWrittenAnswer, tutorReply, preferredModel, buildStudyPlanFallback } = require('../src/services/learning-ai.service');

const OLD_ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  AI_MODE: process.env.AI_MODE,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_SMART_MODEL: process.env.GEMINI_SMART_MODEL
};
test.after(() => {
  for (const [key, value] of Object.entries(OLD_ENV)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('all 3 textbook programmes expose a curriculum for grades 1 to 5', () => {
  for (let grade = 1; grade <= 5; grade += 1) {
    for (const program of curriculum.PROGRAMS) {
      const catalog = curriculum.buildCatalog(grade, program.code);
      assert.ok(catalog, `grade ${grade}, ${program.code}`);
      assert.ok(catalog.courses.length >= 9);
      assert.ok(catalog.totals.units > 30);
      assert.ok(catalog.totals.lessons >= 70);
      assert.ok(catalog.courses.every((course) => course.units.length === 4));
      assert.equal(catalog.program.code, program.code);
    }
  }
});

test('grade-specific subject bands are kept distinct', () => {
  const g1 = curriculum.subjectsForGrade(1).map((subject) => subject.code);
  const g3 = curriculum.subjectsForGrade(3).map((subject) => subject.code);
  const g5 = curriculum.subjectsForGrade(5).map((subject) => subject.code);
  assert.ok(g1.includes('nature'));
  assert.ok(!g1.includes('science'));
  assert.ok(!g1.includes('ict'));
  assert.ok(g3.includes('nature') && g3.includes('ict'));
  assert.ok(!g3.includes('science') && !g3.includes('history_geo'));
  assert.ok(g5.includes('science') && g5.includes('history_geo') && g5.includes('ict'));
  assert.equal(curriculum.subjectsForGrade(1).find((subject) => subject.code === 'english').optional, true);
  assert.equal(curriculum.subjectsForGrade(3).find((subject) => subject.code === 'english').optional, false);
});

test('each lesson has 4 ordered learning parts with 2 checkpoint questions each', () => {
  const course = curriculum.buildCourse(1, 'ctst', 'math');
  const firstLesson = course.units[0].lessons[0];
  assert.equal(firstLesson.parts.length, 4);
  assert.deepEqual(firstLesson.parts.map((part) => part.id), ['theory', 'lecture', 'guided-practice', 'independent-practice']);
  assert.ok(firstLesson.parts.every((part) => part.checkpoint.length >= 1 && part.checkpoint.length <= 2));
  assert.ok(firstLesson.parts.every((part) => part.content && part.durationMinutes > 0));
  const checkpointPrompts = firstLesson.parts.map((part) => part.checkpoint.map((question) => question.prompt).join('|'));
  assert.equal(new Set(checkpointPrompts).size, 4);
});

test('lesson assessment supports multiple choice, fill-in, short answer and essay', () => {
  const found = curriculum.findLesson({ grade: 4, programCode: 'kntt', subjectCode: 'vietnamese', lessonId: 'kntt-g4-vietnamese-u1-l1' });
  assert.ok(found);
  const types = new Set(found.lesson.assessmentQuestions.map((question) => question.type));
  for (const type of ['multiple_choice', 'fill_blank', 'short_answer', 'essay']) assert.ok(types.has(type));
  assert.equal(found.lesson.assessmentQuestions.reduce((sum, question) => sum + question.points, 0), 100);
});

test('learner-facing lesson and question omit answer keys and rubrics', () => {
  const lesson = curriculum.buildCourse(1, 'ctst', 'math').units[0].lessons[0];
  const safe = publicLesson(lesson);
  for (const part of safe.parts) for (const question of part.checkpoint) {
    assert.equal(Object.hasOwn(question, 'correctAnswer'), false);
    assert.equal(Object.hasOwn(question, 'acceptedAnswers'), false);
  }
  for (const question of safe.assessmentQuestions) {
    assert.equal(Object.hasOwn(question, 'correctAnswer'), false);
    assert.equal(Object.hasOwn(question, 'acceptedAnswers'), false);
    assert.equal(Object.hasOwn(question, 'rubric'), false);
  }
  const single = publicQuestion(lesson.assessmentQuestions[0]);
  assert.equal(Object.hasOwn(single, 'explanation'), false);
});

test('progress policy keeps sequential lessons locked until the prior lesson passes', () => {
  const course = curriculum.buildCourse(1, 'ctst', 'math');
  const lessons = course.units.flatMap((unit) => unit.lessons);
  const empty = { completedParts: [], lessons: [] };
  assert.equal(isLessonUnlocked(course, lessons[0], empty, 70), true);
  assert.equal(isLessonUnlocked(course, lessons[1], empty, 70), false);
  const priorFailed = { completedParts: [], lessons: [{ lessonId: lessons[0].id, bestScore: 65, passed: false }] };
  assert.equal(isLessonUnlocked(course, lessons[1], priorFailed, 70), false);
  const priorPassed = { completedParts: [], lessons: [{ lessonId: lessons[0].id, bestScore: 85, passed: true }] };
  assert.equal(isLessonUnlocked(course, lessons[1], priorPassed, 70), true);
  assert.equal(scoreMeetsThreshold(70, 70), true);
  assert.equal(scoreMeetsThreshold(69, 70), false);
});

test('lesson test needs every section checkpoint to pass', () => {
  const lesson = curriculum.buildCourse(1, 'ctst', 'math').units[0].lessons[0];
  const progress = { completedParts: lesson.parts.map((part, index) => ({ lessonId: lesson.id, partId: part.id, passed: index < 3 })) };
  assert.equal(allPartsPassed(lesson, progress), false);
  progress.completedParts[3].passed = true;
  assert.equal(allPartsPassed(lesson, progress), true);
});

test('SMART mode chooses the configured reasoning model for written grading', () => {
  process.env.AI_MODE = 'SMART';
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  process.env.GEMINI_SMART_MODEL = 'gemini-3.1-pro-preview';
  assert.equal(preferredModel('smart'), 'gemini-3.1-pro-preview');
  assert.equal(preferredModel('normal'), 'gemini-3.8-flash');
});

test('AI written grading has an explicit local fallback when no valid API key is set', async () => {
  process.env.AI_MODE = 'SMART';
  process.env.GEMINI_API_KEY = 'replace-test-api-key';
  const lesson = curriculum.buildCourse(2, 'ctst', 'vietnamese').units[0].lessons[0];
  const question = lesson.assessmentQuestions.find((item) => item.type === 'essay');
  const result = await gradeWrittenAnswer({ answer: 'Em đọc kỹ đề, giải thích bằng ví dụ và kiểm tra lại kết quả.', question, lesson, grade: 2 });
  assert.equal(result.gradingMode, 'heuristic-fallback');
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.uncertain, true);
});

test('tutor fallback responds with age-appropriate lesson-specific guidance', async () => {
  process.env.AI_MODE = 'SMART';
  process.env.GEMINI_API_KEY = 'replace-test-api-key';
  const lesson = curriculum.buildCourse(1, 'ctst', 'math').units[0].lessons[0];
  const result = await tutorReply({ message: 'Em chưa hiểu bài', lesson, grade: 1, progressSummary: 'Chưa có điểm' });
  assert.equal(result.mode, 'rule-based');
  assert.match(result.answer, /bài/i);
  assert.ok(result.answer.length > 40);
});




test('multiple-choice correct options are not always placed first and stay deterministic', () => {
  const course = curriculum.buildCourse(4, 'ctst', 'math');
  const questions = course.units.flatMap((unit) => unit.lessons.flatMap((lesson) => lesson.assessmentQuestions)).filter((question) => question.type === 'multiple_choice');
  const firstPositions = new Set(questions.map((question) => question.options[0]?.value === question.correctAnswer));
  assert.ok(firstPositions.size > 1);
  const sameQuestion = curriculum.buildCourse(4, 'ctst', 'math').units[0].lessons[0].assessmentQuestions[0];
  assert.deepEqual(sameQuestion.options, course.units[0].lessons[0].assessmentQuestions[0].options);
  assert.equal(sameQuestion.correctAnswer, course.units[0].lessons[0].assessmentQuestions[0].correctAnswer);
});

test('each textbook programme has a separate course and lesson ID namespace', () => {
  const ids = curriculum.PROGRAMS.map((program) => curriculum.buildCourse(2, program.code, 'math'));
  assert.equal(new Set(ids.map((course) => course.id)).size, 3);
  assert.equal(new Set(ids.map((course) => course.units[0].lessons[0].id)).size, 3);
  assert.ok(ids.every((course) => course.contentStatus === 'draft-ai-assisted-review-required'));
});

test('personalized study plan uses only currently available lessons and responds to survey preferences', () => {
  const catalog = curriculum.buildCatalog(3, 'kntt');
  const survey = { goal: 'school_support', topics: ['math', 'school_subjects'], weeklyHours: '3-5', learningStyle: 'practice', currentLevel: 'beginner' };
  const plan = buildStudyPlanFallback({ survey, grade: 3, programCode: 'kntt', programName: 'Kết nối tri thức với cuộc sống', courseCatalog: catalog.courses, progressDocs: [] });
  assert.equal(plan.mode, 'rule-based');
  assert.ok(plan.sessions.length >= 2 && plan.sessions.length <= 3);
  assert.equal(plan.sessions[0].subjectCode, 'math');
  assert.ok(plan.sessions.every((item) => item.lessonId.startsWith('kntt-g3-')));
  assert.ok(plan.sessions.every((item) => item.minutes === 25));
  assert.match(plan.sessions[0].activity, /luyện tập/i);
});
