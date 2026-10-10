'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { evaluateMaterializedCourse } = require(path.join(root, 'server/services/ai-learning-service.js'));
let passed = 0;
function test(name, condition) { assert.ok(condition, name); passed++; process.stdout.write(`PASS ${name}\n`); }

const lessons = Array.from({ length: 12 }, (_, index) => ({
  _id: `lesson-${index + 1}`,
  title: `Bài học ${index + 1}`,
  theorySections: [1, 2, 3].map(n => ({ title: `Phần ${n}`, content: `Nội dung lý thuyết phần ${n} của bài ${index + 1}. `.repeat(8) })),
  examples: [1, 2].map(n => ({ title: `Ví dụ ${n}`, problem: `Tình huống cụ thể ${n} của bài ${index + 1}`, solution: `Giải thích từng bước và kiểm tra kết quả ${n}.` })),
  payload: { lectureScript: `Bài giảng cho bài ${index + 1}. `.repeat(20), practiceTasks: [1, 2].map(n => ({ title: `Luyện tập ${n}`, instruction: `Thực hiện nhiệm vụ ${n} và giải thích kết quả bài ${index + 1}.` })) },
  lessonTestId: `lesson-test-${index + 1}`
}));
const assessments = [
  ...lessons.map((lesson, index) => ({ _id: `lesson-test-${index + 1}`, lessonId: lesson._id, assessmentType: 'LESSON_TEST', publicationStatus: 'PUBLISHED', questionIds: Array.from({ length: 6 }, (_, i) => `l${index}-q${i}`) })),
  ...Array.from({ length: 6 }, (_, index) => ({ _id: `chapter-test-${index + 1}`, assessmentType: 'CHAPTER_TEST', publicationStatus: 'PUBLISHED', questionIds: Array.from({ length: 6 }, (_, i) => `c${index}-q${i}`) })),
  { _id: 'midterm', assessmentType: 'MIDTERM', questionIds: Array.from({ length: 10 }, (_, i) => `m${i}`) },
  { _id: 'final', assessmentType: 'FINAL', questionIds: Array.from({ length: 15 }, (_, i) => `f${i}`) },
  { _id: 'mock', assessmentType: 'MOCK', questionIds: Array.from({ length: 20 }, (_, i) => `x${i}`) }
];

test('Only a fully materialized 12-lesson course with lesson/chapter/midterm/final/mock tests is ready', evaluateMaterializedCourse(lessons, assessments, 12).ready);
const damaged = lessons.map(item => ({ ...item, payload: { ...item.payload } }));
damaged[4].payload.practiceTasks = [];
test('Course integrity check rejects a lesson missing real practice tasks', !evaluateMaterializedCourse(damaged, assessments, 12).ready && evaluateMaterializedCourse(damaged, assessments, 12).missing.includes('lessonContent'));

test('Catalog links require persisted content verification before clearing COURSE_GAP', /inspectMaterializedCourse\(models, course/.test(fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8')) && /if \(!persisted\.ready\) course = null/.test(fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8')));
test('Adaptive roadmap persists a personal course only after lesson/test verification', /inspectMaterializedCourse\(models, created\.course, 12\)/.test(fs.readFileSync(path.join(root, 'server/routes/learning-system-v27-routes.js'), 'utf8')) && /COURSE_GAP vẫn được giữ/.test(fs.readFileSync(path.join(root, 'server/routes/learning-system-v27-routes.js'), 'utf8')));

test('Assessment aliases cover sorting/matching/code and unanswered submission can be explicitly confirmed', /sequence:'ordering'/.test(fs.readFileSync(path.join(root, 'assessment.html'), 'utf8')) && /data-up/.test(fs.readFileSync(path.join(root, 'assessment.html'), 'utf8')) && /data-run-code/.test(fs.readFileSync(path.join(root, 'assessment.html'), 'utf8')) && /window\.confirm\(`Bạn còn câu chưa trả lời/.test(fs.readFileSync(path.join(root, 'assessment.html'), 'utf8')));
test('Code Runner status verifies the isolated executor health endpoint', /new URL\('\/health'/.test(fs.readFileSync(path.join(root, 'server/routes/ai-learning-routes.js'), 'utf8')) && /health\.isolated === true/.test(fs.readFileSync(path.join(root, 'server/routes/ai-learning-routes.js'), 'utf8')) && /dockerReady/.test(fs.readFileSync(path.join(root, 'executor-service/server.js'), 'utf8')));
test('Executor Docker binds the same explicitly configured host work-root visible to the service', /EXECUTOR_HOST_WORK_ROOT/.test(fs.readFileSync(path.join(root, 'executor-service/docker-compose.yml'), 'utf8')) && /path\.join\(HOST_WORK_ROOT, path\.basename\(directory\)\)/.test(fs.readFileSync(path.join(root, 'executor-service/server.js'), 'utf8')));

test('Course gaps keep a visible retry action instead of a dead-end recommendation', /data-retry-gap/.test(fs.readFileSync(path.join(root, 'assets/js/learning/adaptive-evidence-plan.js'), 'utf8')) && /Thử tạo khóa học \+ bài học/.test(fs.readFileSync(path.join(root, 'assets/js/learning/adaptive-evidence-plan.js'), 'utf8')));
test('K12 legacy long paragraphs are rendered as short content cards and step lists', /function renderReadableContent\(value, chunkCards = false\)/.test(fs.readFileSync(path.join(root, 'assets/js/learning/learning-catalog.js'), 'utf8')) && /learning-content-piece/.test(fs.readFileSync(path.join(root, 'assets/css/learning/learning-catalog.css'), 'utf8')));
test('AI-created course page splits theory, lecture, examples and practice into readable pieces', /function readable\(value\)/.test(fs.readFileSync(path.join(root, 'ai-course.html'), 'utf8')) && /learning-content-piece/.test(fs.readFileSync(path.join(root, 'ai-course.html'), 'utf8')));
test('Static assets are cache-busted to V37 and application version is synchronized', fs.readFileSync(path.join(root, 'server.js'), 'utf8').includes("APP_VERSION = '39.0.0'") && fs.readFileSync(path.join(root, 'package.json'), 'utf8').includes('"version": "39.0.0"') && fs.readFileSync(path.join(root, 'lo-trinh-hoc-tap.html'), 'utf8').includes('v=39.0.0'));
test('Executor setup instructions and env examples document host mount and off-by-default safety', fs.existsSync(path.join(root, 'executor-service/.env.example')) && /CODE_RUNNER_ENABLED=false/.test(fs.readFileSync(path.join(root, '.env.example'), 'utf8')) && /EXECUTOR_HOST_WORK_ROOT/.test(fs.readFileSync(path.join(root, 'executor-service/README.md'), 'utf8')));
test('V32 integrity suite remains wired into both npm test and npm run check', require(path.join(root, 'package.json')).scripts.test.includes('test-v32-course-integrity.js') && require(path.join(root, 'package.json')).scripts.check.includes('test-v32-course-integrity.js'));

process.stdout.write(`V32 Course Integrity: ${passed} tests passed.\n`);
