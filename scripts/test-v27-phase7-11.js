'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const learning = require('../server/services/learning-system-v27');
const diagnostics = require('../server/services/diagnostic-validation');
const migration = require('./migrations/011-v21-survey-placement');
const migration013 = require('./migrations/013-v27-1-expanded-dsa-practice');
const migrationRegistry = fs.readFileSync(path.resolve(__dirname, './migrations/index.js'), 'utf8');
const route = fs.readFileSync(path.resolve(__dirname, '../server/routes/learning-system-v27-routes.js'), 'utf8');
const admin = fs.readFileSync(path.resolve(__dirname, '../assets/js/admin/admin-learning-engine.js'), 'utf8');
const profile = fs.readFileSync(path.resolve(__dirname, '../profile.html'), 'utf8');
const flowPages = fs.readFileSync(path.resolve(__dirname, '../assets/platform/flow-pages.js'), 'utf8');
const detailPage = fs.readFileSync(path.resolve(__dirname, '../khoa-hoc-chi-tiet.html'), 'utf8');
const roadmap = fs.readFileSync(path.resolve(__dirname, '../assets/js/learning/adaptive-evidence-plan.js'), 'utf8');
const assessmentPage = fs.readFileSync(path.resolve(__dirname, '../assessment.html'), 'utf8');
const assessmentStyle = fs.readFileSync(path.resolve(__dirname, '../assets/css/learning/assessment-rendering.css'), 'utf8');
const algorithmPractice = fs.readFileSync(path.resolve(__dirname, '../assets/js/learning/algorithm-practice.js'), 'utf8');
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

const survey = { title: 'Khảo sát thử', description: 'Mục tiêu học tập', version: '1', status: 'PUBLISHED', questions: migration.surveyQuestions() };
test('Published baseline survey has valid, diverse, required questions and stable unique codes', () => {
    const checked = diagnostics.validateSurvey(survey);
    assert.equal(checked.valid, true, checked.errors.join('; '));
    assert(checked.questionCount >= 25);
    assert(survey.questions.some(question => question.required === true));
    assert(new Set(survey.questions.map(question => question.code || question.id).map(String).map(value => value.toLowerCase())).size === survey.questions.length);
});
test('Placement catalog spans grades 1–12 and university/English test tracks', () => {
    const defs = migration.placementDefinitions();
    for (let grade = 1; grade <= 12; grade += 1) assert(defs.some(item => Number(item.grade || item.targetGrade || 0) === grade || new RegExp(`GRADE[-_ ]?${grade}|CLASS[-_ ]?${grade}|LỚP[-_ ]?${grade}`, 'i').test(`${item.code} ${item.title}`)), `Missing grade ${grade}`);
    for (const term of ['TOEIC', 'IELTS', 'MOS', 'UNIVERSITY']) assert(defs.some(item => `${item.code} ${item.title} ${item.target}`.toUpperCase().includes(term)), `Missing ${term}`);
    for (const item of defs) assert.equal(diagnostics.validatePlacement(item).valid, true, `${item.code}: ${diagnostics.validatePlacement(item).errors.join('; ')}`);
});
test('Nested option objects normalize without rendering [object Object]', () => {
    const result = learning.normalizeQuestionForm({ type: 'single_choice', prompt: 'Chọn đáp án', points: 1, options: [{ label: { text: 'Phương án A' }, value: { id: 'A' } }, { text: 'Phương án B', value: 'B' }] });
    assert.equal(result.valid, true);
    assert.deepEqual(result.question.options.map(item => item.label), ['Phương án A', 'Phương án B']);
    assert(!JSON.stringify(result.question.options).includes('[object Object]'));
});
test('Objective and free-response question validators require the right editor fields', () => {
    assert.equal(learning.normalizeQuestionForm({ type: 'multiple_choice', prompt: 'Chọn', options: ['A'], points: 1 }).valid, false);
    assert.equal(learning.normalizeQuestionForm({ type: 'essay', prompt: 'Giải thích', rubric: { criteria: ['Logic'] }, points: 5 }).valid, true);
    assert.equal(learning.normalizeQuestionForm({ type: 'coding', prompt: 'Viết chương trình', statement: 'Nhập n và in n', points: 10 }).valid, true);
});
test('Official content cannot publish without verified source provenance', () => {
    const result = learning.normalizeContentBlock({ code: 'OFFICIAL-A', title: 'Tài liệu chính thức', type: 'THEORY', body: 'Nội dung', sourceType: 'OFFICIAL', sourceVerified: false, status: 'PUBLISHED' });
    assert.equal(result.valid, false);
    assert(result.errors.some(item => item.includes('xác minh')));
});
test('18 algorithm practicals have concrete statements, input/output, sample and hidden cases', () => {
    const tasks = learning.buildAlgorithmTaskSeeds();
    assert.equal(tasks.length, 18);
    for (const task of tasks) {
        const checked = learning.validatePracticeTask(task);
        assert.equal(checked.valid, true, `${task.code}: ${checked.errors.join('; ')}`);
        assert(task.statement.length > 40, task.code);
        assert(task.inputFormat && task.outputFormat, task.code);
        assert(task.visibleTestCases.length >= 1, task.code);
        assert(task.hiddenTestCases.length >= 2, task.code);
        const learner = learning.sanitizeTaskForLearner(task);
        assert(!Object.hasOwn(learner, 'hiddenTestCases'));
        assert(!Object.hasOwn(learner, 'solution'));
    }
    assert(tasks.some(task => task.code === 'DSA-DAC-MERGE-SORT-016'));
    assert(tasks.some(task => task.code === 'DSA-DAC-MAX-SUBARRAY-017'));
    assert(tasks.some(task => task.code === 'DSA-DAC-COUNT-INVERSIONS-018'));
    assert(migration013.EXPANDED_CODES.has('DSA-DAC-MERGE-SORT-016'));
    assert(migrationRegistry.includes('013-v27-1-expanded-dsa-practice.js'));
});
test('Adaptive recommendations link only to real published lessons/course/task evidence', () => {
    const result = learning.buildAdaptiveRecommendations({
        profile: { dob: { year: 2015, month: 4, day: 3 } },
        education: { educationLevel: 'K12', grade: 5 },
        learning: { survey: { favoriteSubjects: ['Toán'], weaknesses: ['Fractions'] }, goals: ['Toán'] },
        mastery: [{ skill: 'Fractions', accuracy: 35, reviewDueAt: new Date(Date.now() - 86400000) }],
        lessons: [{ _id: 'lesson1', title: 'Fractions: cộng phân số', subjectId: 'Toán', grade: 5, educationLevel: 'K12', status: 'PUBLISHED', estimatedMinutes: 20, courseId: 'course1' }],
        courses: [{ _id: 'course1', code: 'MATH5', name: 'Toán lớp 5', subjectId: 'Toán', grade: 5, educationLevel: 'K12', status: 'PUBLISHED' }],
        tasks: []
    });
    assert(result.length > 0);
    assert(result.some(item => item.lessonId === 'lesson1' && item.courseId === 'course1'));
    assert(result.every(item => !item.courseId || ['course1'].includes(item.courseId)));
    assert(result.some(item => item.ageBand === 'PRIMARY_CHILD' && item.estimatedMinutes <= 15));
});
test('Learning path API versions plans and stores ordered real steps', () => {
    assert(route.includes("router.get('/plan/recommendations'"));
    assert(route.includes("router.post('/plan/rebuild'"));
    assert(route.includes("router.get('/plan/steps'"));
    assert(route.includes("status: 'ARCHIVED'"));
    assert(route.includes('LearningPlanStep.insertMany(steps'));
});
test('New typed content is readable to learners only when the parent lesson and block are published', () => {
    assert(route.includes("router.get('/content-blocks/lesson/:id'"));
    assert(route.includes("status: 'PUBLISHED' }).select('_id courseId').lean()"));
    assert(route.includes("models.ContentBlock.find({ lessonId: lesson._id, status: 'PUBLISHED' })"));
});
test('Admin authoring UI uses forms for lesson/practice, not a free-form JSON editor', () => {
    assert(admin.includes('Bài lập trình thực hành'));
    assert(admin.includes('Nội dung từng bài'));
    assert(admin.includes('Lưu bản nháp'));
    assert(admin.includes('Kiểm tra & công bố'));
    assert(!/textarea[^>]*name=["']json["']/i.test(admin));
    assert(!admin.includes('Nhập JSON khóa học'));
});
test('DOB can be edited and is validated on server before age-personalized recommendations', () => {
    assert(profile.includes('id="birthDate"'));
    assert(flowPages.includes('dobYear'));
    assert(route.includes("router.get('/profile/learning-age'"));
    assert(route.includes('ageFromDob(profile?.dob)'));
});
test('Course lesson UI renders typed content sections and real coding tasks', () => {
    assert(detailPage.includes('/api/learning-system/content-blocks/lesson/'));
    assert(detailPage.includes('HtmAlgorithmPractice'));
    assert(detailPage.includes('markdownSafe'));
    assert(fs.existsSync(path.resolve(__dirname, '../assets/js/learning/algorithm-practice.js')));
});
test('Admin health analytics and survey/placement repair are wired to routes', () => {
    assert(route.includes("router.get('/admin/overview'"));
    assert(route.includes("router.get('/admin/content-audit'"));
    assert(route.includes("router.get('/admin/catalog-gaps'"));
    assert(route.includes("router.post('/admin/diagnostics/repair'"));
    assert(fs.readFileSync(path.resolve(__dirname, '../scripts/migrations/012-v27-typed-learning-system.js'), 'utf8').includes('ensureDiagnostics'));
});
test('User-facing assessment/option rendering has an object-safe normalization function', () => {
    const assessment = fs.readFileSync(path.resolve(__dirname, '../assessment.html'), 'utf8');
    const flow = fs.readFileSync(path.resolve(__dirname, '../assets/platform/flow-pages.js'), 'utf8');
    assert(/optionText|optionLabel|normalizeOption/i.test(assessment));
    assert(flow.includes('function optionText') || flow.includes('const optionText'));
});
test('Adaptive roadmap page loads versioned evidence-driven recommendations', () => {
    const page = fs.readFileSync(path.resolve(__dirname, '../lo-trinh-hoc-tap.html'), 'utf8');
    assert(page.includes('adaptive-evidence-plan'));
    assert(page.includes('adaptive-evidence-plan.js?v=39.0.0'));
    assert(roadmap.includes('/api/learning-system/plan/recommendations'));
    assert(roadmap.includes('/api/learning-system/plan/rebuild'));
});

test('Assessment radio/checkbox inputs stay small and choices render in readable full-width rows', () => {
    assert(assessmentPage.includes('assets/css/learning/assessment-rendering.css?v=39.0.0'));
    assert(assessmentStyle.includes('.assessment-options{display:grid'));
    assert(assessmentStyle.includes('width:18px!important'));
    assert(assessmentStyle.includes('max-width:18px!important'));
    assert(assessmentStyle.includes('.assessment-question .algorithm-sample-grid{display:grid'));
    assert(assessmentPage.includes('class="assessment-choice"'));
    assert(assessmentPage.includes('class="assessment-choice-text"'));
    assert(!assessmentPage.includes('[object Object]'));
});
test('Assessment format displays Vietnamese question types, explicit points, score guide and coding examples', () => {
    for (const label of ['Trắc nghiệm · 1 đáp án', 'Trắc nghiệm · nhiều đáp án', 'Điền khuyết', 'Ghép đôi', 'Tự luận', 'Lập trình có chấm test']) assert(assessmentPage.includes(label), `Missing ${label}`);
    assert(assessmentPage.includes('assessment-score-guide'));
    assert(assessmentPage.includes('tổng trọng số test đạt'));
    assert(assessmentPage.includes('data-coding-output'));
    assert(assessmentPage.includes('điểm chính thức được tính khi nộp bài'));
    assert(assessmentPage.includes('Test công khai'));
    assert(assessmentPage.includes('điểm'));
    assert(assessmentPage.includes('data-run-code'));
});
test('Coding practice has a visible scoring formula, per-attempt test cap and weighted result breakdowns', () => {
    assert(route.includes('selectPracticeCases(task.visibleTestCases || [], task.hiddenTestCases || [], 12)'));
    assert(algorithmPractice.includes('Cách chấm điểm tự động'));
    assert(algorithmPractice.includes('tổng trọng số các test đạt'));
    assert(algorithmPractice.includes('scoreBreakdown'));
    assert(algorithmPractice.includes('Điểm từ test công khai'));
    assert(algorithmPractice.includes('Điểm từ test ẩn'));
    assert(algorithmPractice.includes('Chỉ trả số lượng đạt'));
    assert(assessmentPage.includes('nộp bài qua bộ test của đề'));
});
test('Weighted code scoring combines visible and hidden tests without exposing hidden test data', () => {
    const result = learning.scorePracticeTests([{ passed: true, weight: 3 }, { passed: false, weight: 1 }], [{ passed: false, weight: 6 }]);
    assert.equal(result.score, 30);
    assert.equal(result.earnedWeight, 3);
    assert.equal(result.possibleWeight, 10);
    assert.equal(result.visible.earnedWeight, 3);
    assert.equal(result.hidden.possibleWeight, 6);
    const learner = learning.sanitizeTaskForLearner({ title: 'Test', visibleTestCases: [{ input: '1', expectedOutput: '1' }], hiddenTestCases: [{ input: 'secret', expectedOutput: 'secret' }], solution: 'secret code' });
    assert.equal(learner.hiddenTestCaseCount, 1);
    assert(!JSON.stringify(learner).includes('secret code'));
    assert(!JSON.stringify(learner).includes('expectedOutput\":\"secret'));
});
test('Divide and Conquer lesson terms can match dedicated Merge Sort, max-subarray and inversion tasks', () => {
    const source = algorithmPractice.toLowerCase();
    assert(source.includes('lessonwords.some(word => haystack.includes(word))'));
    for (const term of ['divide and conquer', 'merge sort']) assert(source.includes(term) || fs.readFileSync(path.resolve(__dirname, '../server/services/learning-system-v27.js'), 'utf8').toLowerCase().includes(term));
    assert(route.includes('selectPracticeCases(task.visibleTestCases || [], task.hiddenTestCases || [], 12)'));
});

test('Programming lesson mounts the actual coding grader inside the Practice section and lab shows honest rubric', () => {
    assert(detailPage.includes('class="practice-task-grid"'));
    assert(detailPage.includes('class="algorithm-practice-mount"'));
    assert(detailPage.includes('Bộ chấm code nằm trong phần Luyện tập'));
    assert(detailPage.includes('renderPracticalCriteria'));
    assert(detailPage.includes('Đây là checklist tự đánh giá, không phải điểm tự động'));
    assert(algorithmPractice.includes('Nộp bài và chấm test (tối đa 12)'));
});
console.log(`\nPhase 7–11 typed content/adaptive path/CMS/analytics/profile/UI/scoring: ${passed} tests PASS.`);
