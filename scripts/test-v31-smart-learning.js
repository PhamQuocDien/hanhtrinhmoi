'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const rich = require(path.join(root, 'server/modules/rich-learning-content-v20.js'));
const { makeCourseDraft } = require(path.join(root, 'server/services/local-course-composer.js'));
const { validateCourseDraft, generateCourseDraft } = require(path.join(root, 'server/services/ai-learning-service.js'));
const { scoreAssessmentQuestions } = require(path.join(root, 'server/services/platform-services.js'));
let passed = 0;
function test(name, condition) { assert.ok(condition, name); passed++; process.stdout.write(`PASS ${name}\n`); }

(async () => {
  const k12Math = makeCourseDraft({ prompt: 'Tạo khóa học Toán lớp 5 về phân số', courseTitle: 'Phân số lớp 5', grade: 5, subjectId: 'toan', domain: 'Toán' });
  const mathValidation = validateCourseDraft(k12Math);
  test('K12 course draft deduplicates curriculum topics and includes rich sections, lecture, examples, practice, lesson and chapter tests', mathValidation.valid && mathValidation.lessonCount >= 8 && new Set(k12Math.chapters.flatMap(ch => ch.lessons.map(l => l.title.toLowerCase()))).size === mathValidation.lessonCount && k12Math.chapters.every(ch => ch.lessons.every(l => l.theorySections.length >= 3 && l.lecture.script.length > 180 && l.examples.length >= 2 && l.practiceTasks.length >= 2 && l.test.questions.length >= 6) && ch.test.questions.length >= 6));
  test('Grade 5 fraction lesson test is topic-specific', /3\/4 \+ 1\/4/.test(k12Math.chapters[0].lessons[0].test.questions[0].prompt));

  const english = rich.buildK12Questions({ grade: 5, subjectId: 'tieng_anh', subjectName: 'Tiếng Anh', topic: 'Hiện tại đơn', count: 12 });
  test('Vietnamese diacritic normalization selects topic-specific English Present Simple questions', english.length === 12 && /Lan ___ to school every day/.test(english[0].prompt) && english.some(q => /studies|does|every day/.test(`${q.prompt} ${q.answer}`)));
  const k12English = makeCourseDraft({ prompt: 'Tạo khóa học Tiếng Anh lớp 5 về hiện tại đơn', grade: 5, subjectId: 'tieng_anh', domain: 'Tiếng Anh' });
  test('English K12 course passes full-course validation and includes specific question bank', validateCourseDraft(k12English).valid && /Lan ___ to school every day/.test(k12English.chapters[0].lessons[0].test.questions[0].prompt));

  const calculus = rich.buildK12Questions({ grade: 12, subjectId: 'toan', subjectName: 'Toán', topic: 'Tính đơn điệu và cực trị', count: 12 });
  test('Grade 12 calculus assessment is aligned to derivatives and extrema', calculus.length === 12 && calculus.some(q => /đạo hàm|f\(x\)=x³−3x|cực tiểu/i.test(q.prompt)));

  const it = makeCourseDraft({ prompt: 'Tạo khóa học C++ về vòng lặp', domain: 'C++', subjectId: 'computer_science' });
  const coding = it.chapters.flatMap(ch => ch.lessons).flatMap(l => l.test.questions).find(q => q.type === 'coding');
  test('IT course contains runnable coding task with concrete input/output tests', Boolean(coding && (coding.media?.coding?.publicTestCases || coding.media?.publicTestCases)?.length));
  const toeic = makeCourseDraft({ prompt: 'TOEIC Reading Part 5 ngữ pháp', targetExam: 'TOEIC', targetVariant: 'READING_P5_P6' });
  test('TOEIC Part 5 course contains a real grammar item with answer and explanation', toeic.chapters.flatMap(ch => ch.lessons).some(l => l.test.questions.some(q => /Each applicant/.test(q.prompt) && q.answer === 'is' && q.explanation)));
  const mos = makeCourseDraft({ prompt: 'MOS Excel hàm IF', targetExam: 'MOS', domain: 'Excel' });
  test('MOS course contains hands-on application task and expected file deliverable', mos.chapters.flatMap(ch => ch.lessons).some(l => l.test.questions.some(q => q.type === 'practical' && /\.xlsx|Excel/i.test(JSON.stringify(q.media || q)))));

  const built = await generateCourseDraft({ request: { prompt: 'Tạo khóa học Toán lớp 5 về phân số', courseTitle: 'Phân số lớp 5', subjectId: 'toan', domain: 'Toán', grade: 5, forceCreate: true, generateAudio: false, allowRuleBasedFallback: true }, context: { education: { grade: 5, educationLevel: 'PRIMARY' }, mastery: [], learning: { goals: [] } }, mode: 'PERSONAL' });
  test('Explicit rule-based fallback remains opt-in when no AI key is configured', built.model === 'LOCAL-EDUCATION-COMPOSER-V32' && built.validation.valid && built.validation.lessonCount >= 8 && built.draft.title === 'Phân số lớp 5');

  const essay = await scoreAssessmentQuestions([{ code: 'ESSAY1', type: 'essay', points: 10, prompt: 'Phân tích giải pháp, nêu ví dụ, bằng chứng và cách kiểm tra kết quả.', rubric: { criteria: [{ name: 'Phân tích giải pháp', points: 3 }, { name: 'Ví dụ cụ thể', points: 3 }, { name: 'Bằng chứng', points: 2 }, { name: 'Kiểm tra kết quả', points: 2 }] } }], { ESSAY1: 'Giải pháp là chia vấn đề thành từng bước. Ví dụ, dùng dữ liệu kiểm thử với kết quả cụ thể và bằng chứng. Sau đó kiểm tra kết quả bằng test case, so sánh output để giải thích vì sao giải pháp phù hợp.' });
  test('Essay/practical rubric scores automatically without waiting for admin review', essay.details[0].gradingStatus === 'LOCAL_RUBRIC_AUTO' && essay.details[0].requiresReview === false && essay.earnedPoints > 0);
  const structured = await scoreAssessmentQuestions([
    { code: 'ORDER1', type: 'ordering', points: 1, answer: ['read', 'solve', 'check'] },
    { code: 'MATCH1', type: 'matching', points: 1, answer: { A: 'compiler', B: 'debugger' } }
  ], { ORDER1: ['read', 'solve', 'check'], MATCH1: { A: 'compiler', B: 'debugger' } });
  test('Ordering and matching answer structures are scored correctly', structured.details.every(item => item.isCorrect && item.gradingStatus === 'AUTO_SCORED'));

  const richLesson = rich.k12RichLesson({ grade: 5, subjectId: 'toan', subjectName: 'Toán', topic: 'Phân số', baseTheory: { theory: ['Phân số biểu diễn một hay nhiều phần bằng nhau của một đơn vị.', 'Tử số cho biết số phần được lấy.', 'Mẫu số cho biết đơn vị được chia thành bao nhiêu phần bằng nhau.', 'Khi cộng hai phân số cùng mẫu, giữ nguyên mẫu và cộng tử số.', 'Kiểm tra kết quả bằng hình vẽ hoặc phép tính ngược.'], theorySections: [] }, lessonNo: 1 });
  test('K12 rich theory is split into readable paragraphs and retains named sections', richLesson.theorySections.length >= 6 && richLesson.theorySections.some(section => section.content.includes('\n\n')));
  const catalogUi = fs.readFileSync(path.join(root, 'assets/js/learning/learning-catalog.js'), 'utf8');
  test('K12 lesson detail displays theory as expandable sections with expand/collapse controls', /learning-theory-section/.test(catalogUi) && /data-expand-lesson-sections/.test(catalogUi) && /data-collapse-lesson-sections/.test(catalogUi));

  const ui = fs.readFileSync(path.join(root, 'assessment.html'), 'utf8');
  test('Assessment page binds ordering, matching, code-run and final submit interactions', /function bindInteractions\(\)/.test(ui) && /data-up/.test(ui) && /match:\$\{esc\(id\)\}/.test(ui) && /data-run-code/.test(ui) && /submit-test/.test(ui));
  const route = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
  test('Adaptive course gaps request force-create and store actual course/lesson IDs', /forceCreate: true/.test(route) && /courseId: result\.courseId/.test(route) && /lessonId: lesson\?\._id/.test(route));
  const runner = fs.readFileSync(path.join(root, 'server/services/code-runner.js'), 'utf8');
  test('Code runner requires isolated Docker/remote executor and never evals learner code in Express', /CODE_RUNNER_EXECUTOR/.test(runner) && /--network', 'none'/.test(runner) && !/eval\s*\(/.test(runner));

  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => {
      const payload = JSON.parse(body || '{}');
      const answer = { status: 'SUCCESS', stdout: '15\n', stderr: '', exitCode: 0, runtimeMs: 12 };
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(answer));
      server.lastPayload = payload;
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = { enabled: process.env.CODE_RUNNER_ENABLED, executor: process.env.CODE_RUNNER_EXECUTOR, url: process.env.CODE_EXECUTOR_URL, token: process.env.CODE_EXECUTOR_TOKEN };
  try {
    process.env.CODE_RUNNER_ENABLED = 'true'; process.env.CODE_RUNNER_EXECUTOR = 'remote'; process.env.CODE_EXECUTOR_URL = `http://127.0.0.1:${server.address().port}/execute`; process.env.CODE_EXECUTOR_TOKEN = 'test-executor-token-for-mock-only';
    const { executeCode } = require(path.join(root, 'server/services/code-runner.js'));
    const execution = await executeCode({ language: 'cpp', code: '#include <iostream>\nint main(){std::cout << 15;}', stdin: '5' });
    test('Code run client posts to isolated executor with network disabled and receives stdout', execution.status === 'SUCCESS' && execution.stdout.trim() === '15' && server.lastPayload?.limits?.network === false && server.lastPayload?.limits?.memoryMb === 128);
  } finally {
    server.close();
    for (const [key, value] of Object.entries({ CODE_RUNNER_ENABLED: previous.enabled, CODE_RUNNER_EXECUTOR: previous.executor, CODE_EXECUTOR_URL: previous.url, CODE_EXECUTOR_TOKEN: previous.token })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }

  const pkg = require(path.join(root, 'package.json'));
  test('V31 regression suite is wired into npm test and npm run check', pkg.scripts.test.includes('test-v31-smart-learning.js') && pkg.scripts.check.includes('test-v31-smart-learning.js'));
  process.stdout.write(`V31 Smart Learning: ${passed} tests passed.\n`);
})().catch(error => { console.error(error); process.exitCode = 1; });
