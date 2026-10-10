'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const progress = require(path.join(root, 'server/services/lesson-progress-service.js'));
const { makeCourseDraft } = require(path.join(root, 'server/services/local-course-composer.js'));
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const lesson = { _id: 'lesson-1', theory: 'Lý thuyết', lessonTestId: 'assessment-1' };
const assessment = { _id: 'assessment-1', lessonId: 'lesson-1', assessmentType: 'LESSON_TEST', publicationStatus: 'PUBLISHED', passingScore: 70 };
test('Only submitted, sufficiently scored, non-review assessment can satisfy completion evidence', () => {
  assert.equal(progress.isPassedAssessmentAttempt({ status: 'SUBMITTED', score: 82, result: {} }, assessment), true);
  assert.equal(progress.isPassedAssessmentAttempt({ status: 'REVIEW_REQUIRED', score: 100, result: {} }, assessment), false);
  assert.equal(progress.isPassedAssessmentAttempt({ status: 'SUBMITTED', score: 100, result: { requiresReview: true } }, assessment), false);
  assert.equal(progress.isPassedAssessmentAttempt({ status: 'SUBMITTED', score: 69, result: {} }, assessment), false);
});
test('Reading content and client-sent completion percentages never complete a lesson', () => {
  const ui = fs.readFileSync(path.join(root, 'assets/js/learning/lesson-progress.js'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
  assert.match(ui, /Tiến độ chỉ được công nhận từ bài kiểm tra và bài thực hành đã chấm/);
  assert.doesNotMatch(ui, /localStorage\.setItem|type="checkbox"|data-progress-step/);
  assert.match(route, /completedSteps\/progressPercent từ client bị bỏ qua/);
  const snapshot = progress.deriveLessonProgress({ lesson, assessments: [assessment], assessmentAttempts: [] });
  assert.equal(snapshot.completed, false);
  assert.equal(snapshot.progressPercent, 0);
});
test('Coding lesson without a published test-backed PracticeTask stays incomplete', () => {
  const codingLesson = { _id: 'code-lesson', programming: true, lessonTestId: 'assessment-1' };
  const snapshot = progress.deriveLessonProgress({ lesson: codingLesson, assessments: [{ ...assessment, lessonId: 'code-lesson' }], assessmentAttempts: [{ assessmentId: 'assessment-1', status: 'SUBMITTED', score: 100, result: {} }], assignmentSubmissions: [{ status: 'GRADED', score: 100 }] });
  assert.equal(snapshot.completed, false);
  assert.ok(snapshot.configurationIssues.some(issue => issue.code === 'CODE_PRACTICE_NOT_CONFIGURED'));
});
test('Course composer no longer forces every non-K12 track to 12 lessons', () => {
  const k12 = makeCourseDraft({ prompt: 'Tạo khóa học Toán lớp 5 về phân số', courseTitle: 'Phân số lớp 5', grade: 5, subjectId: 'toan', domain: 'Toán' });
  const it = makeCourseDraft({ prompt: 'C++ về vòng lặp', domain: 'C++', subjectId: 'computer_science' });
  const toeic = makeCourseDraft({ prompt: 'TOEIC Reading Part 5 ngữ pháp', targetExam: 'TOEIC' });
  const mos = makeCourseDraft({ prompt: 'MOS Excel hàm IF', targetExam: 'MOS', domain: 'Excel' });
  const count = draft => draft.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  assert.equal(count(k12), 10);
  assert.equal(new Set(k12.chapters.flatMap(chapter => chapter.lessons.map(item => item.title.toLowerCase()))).size, count(k12));
  assert.equal(count(it), 8);
  assert.equal(count(toeic), 10);
  assert.equal(count(mos), 6);
  assert.match(it.description, /8 bài học/);
});
test('Incomplete personal courses are preserved instead of deleting user progress during regeneration', () => {
  const source = fs.readFileSync(path.join(root, 'server/services/ai-learning-service.js'), 'utf8');
  assert.match(source, /Resume the same record instead of permanently blocking retries/);
  assert.match(source, /materializationRecoveryMissing/);
  assert.doesNotMatch(source, /if \(mode === 'PERSONAL'\) await removeIncompleteGeneratedCourse/);
});
test('Quota-failed image/audio jobs are not silently requeued by page visits', async () => {
  const { queueGenerationJob } = require(path.join(root, 'server/services/generation-job-queue.js'));
  let created = 0;
  const models = { AIGenerationJob: { findOne() { return { select() { return { lean: async () => ({ _id: 'job-1', status: 'FAILED', attempts: 5 }) }; } }; }, async create() { created += 1; throw new Error('should not create'); } } };
  const queued = await queueGenerationJob(models, { idempotencyKey: 'IMAGE:course:lesson', type: 'IMAGE' });
  assert.equal(queued.status, 'FAILED');
  assert.equal(queued.reused, true);
  assert.equal(created, 0);
  const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
  assert.match(routes, /admin\/platform\/ai-generation-jobs\/:id\/retry/);
  assert.match(routes, /attempts: 0, error: \{\}, nextRunAt/);
});
test('Timed assessments auto-save answers, restore active attempts and ignore client answers after expiry', () => {
  const route = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'assessment.html'), 'utf8');
  assert.match(route, /router\.put\('\/assessment\/attempts\/:id\/answers'/);
  assert.match(route, /status: 'IN_PROGRESS'.*sort\(\{ startedAt: -1 \}\)/s);
  assert.match(route, /const answerSource = expired \? \(attempt\.answers && typeof attempt\.answers === 'object' \? attempt\.answers : \{\}\) : suppliedAnswers/);
  assert.match(page, /saveAnswerSnapshot/);
  assert.match(page, /restoreAnswers\(attempt\.answers\|\|\{\}\)/);
  assert.match(page, /Date\.parse|new Date\(attempt\.expiresAt\)/);
});
(async () => {
  let passed = 0;
  for (const [name, fn] of tests) { await fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
  console.log(`V37 regression (learning integrity): ${passed} tests passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
