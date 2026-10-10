'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateRegistration, validateProfileUpdate } = require('../server/validators/auth-validators');
const { scoreObjectiveQuestions, normalizeSurveyResult } = require('../server/services/platform-services');
const { validatePlacementSubmission } = require('../server/services/diagnostic-validation');
const { placementDefinitions } = require('./migrations/011-v21-survey-placement');
const { choosePreferredPlacement } = require('../assets/platform/placement-matcher');
const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

const fixedNow = new Date('2026-10-09T12:00:00Z');
test('Registration validates a real date of birth and derives age on the server', () => {
    const result = validateRegistration({ fullName: 'Nguyen Van An', email: 'an@example.com', phone: '0912345678', gameId: 'an_2026', dobDay: '29', dobMonth: '2', dobYear: '2000' }, { now: fixedNow });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.values.dob, { day: 29, month: 2, year: 2000 });
    assert.equal(result.values.age, 26);
});
test('Registration rejects an impossible or future date of birth', () => {
    const base = { fullName: 'Nguyen Van An', email: 'an@example.com', phone: '0912345678', gameId: 'an_2026' };
    assert.equal(validateRegistration({ ...base, dobDay: '29', dobMonth: '2', dobYear: '2001' }, { now: fixedNow }).ok, false);
    assert.equal(validateRegistration({ ...base, dobDay: '10', dobMonth: '10', dobYear: '2026' }, { now: fixedNow }).ok, false);
});
test('Profile supports optional date of birth while retaining age-based personalization when supplied', () => {
    const updated = validateProfileUpdate({ dobDay: '9', dobMonth: '10', dobYear: '2000' }, { now: fixedNow });
    assert.equal(updated.ok, true);
    assert.equal(updated.values.age, 26);
    const cleared = validateProfileUpdate({ clearDob: true }, { now: fixedNow });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.values.dob, null);
    const routeSource = fs.readFileSync(require('node:path').join(__dirname, '../server/routes/platform-routes.js'), 'utf8');
    assert(routeSource.includes('DOB_REQUIRED_FOR_PERSONALIZATION'), 'API phải từ chối xóa ngày sinh đang cần cho cá nhân hóa');
    const flowSource = fs.readFileSync(require('node:path').join(__dirname, '../assets/platform/flow-pages.js'), 'utf8');
    assert(flowSource.includes('if(values.birthDate)') && !flowSource.includes('Ngày sinh cần có để cá nhân hóa khảo sát'), 'UI hồ sơ không được chặn lưu khi thiếu ngày sinh');
});
test('Registration and profile API keep the new profile and legacy account synchronized', () => {
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    assert(server.includes('platformModels.Profile.findOneAndUpdate'));
    assert(routes.includes('legacyUserModel.findOne({ username }).select(\'fullName dob age\').lean()'));
    assert(routes.includes('legacyValues.age = checked.values.age'));
});
test('Profile visibly calculates age from the editable date of birth without accepting manual age input', () => {
    const html = fs.readFileSync(path.join(root, 'profile.html'), 'utf8');
    const flow = fs.readFileSync(path.join(root, 'assets/platform/flow-pages.js'), 'utf8');
    assert(html.includes('id=\"calculatedAge\" type=\"number\" readonly'));
    assert(html.includes('flow-pages.js?v=39.0.0'));
    assert(flow.includes('function refreshAgeDisplay()'));
    assert(flow.includes('addEventListener(\'input\',refreshAgeDisplay)'));
});

test('V29 fixes content relevance, sequential unlock and admin learner management', () => {
    const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    const admin = fs.readFileSync(path.join(root, 'assets/js/admin/admin-users.js'), 'utf8');
    const cms = fs.readFileSync(path.join(root, 'assets/js/admin/admin-cms.js'), 'utf8');
    const rich = require('../server/modules/rich-learning-content-v20');
    assert(routes.includes('async function unlockedLessons'), 'Thiếu logic mở khóa tuần tự');
    assert(routes.includes('async function k12UnlockIndex'), 'K12 fallback cũng phải mở khóa tuần tự');
    assert(routes.includes('async function k12CourseForRequest'), 'K12 catalog phải trả danh sách tóm tắt, tải chi tiết riêng');
    assert(routes.includes('const fallback = k12AssessmentLookup(code)'), 'K12 bài khóa cần tự materialize bài test để mở khóa sau khi đạt điểm');
    assert(routes.includes("'LESSON_LOCKED'"), 'API chưa chặn truy cập bài khóa');
    assert(admin.includes('/api/admin/user/${encodeURIComponent(username)}'), 'Admin chưa xem chi tiết học sinh');
    assert(admin.includes('/api/admin/delete-user'), 'Admin chưa có xóa tài khoản học sinh');
    assert(!cms.includes('JSON.parse(editor.value)'), 'CMS không được yêu cầu sửa nguyên khối JSON');
    const mathQuestions = rich.buildK12Questions({ grade: 12, subjectId: 'TOAN', subjectName: 'Toán', topic: 'Tính đơn điệu và cực trị', count: 12 });
    assert.equal(mathQuestions.length, 12);
    assert(mathQuestions.some(question => question.prompt.includes('đạo hàm')), 'Câu hỏi Toán 12 phải bám chủ đề đạo hàm/cực trị');
    assert(!mathQuestions.some(question => question.prompt.includes('tăng từ 24 lên 30')), 'Không dùng phép cộng trừ chung cho Toán THPT');
});

test('K12 calculus lesson has topic-aligned solved examples and no stale arithmetic quiz', () => {
    const catalog = require('../server/services/learning-catalog-service');
    const course = catalog.buildK12CourseDetail('k12-g12-toan');
    const lesson = course.lessons.find(item => /tính đơn điệu và cực trị/i.test(item.title));
    assert(lesson, 'Thiếu bài Tính đơn điệu và cực trị trong Toán 12');
    assert.equal(lesson.questions.length, 12);
    assert(lesson.questions.some(question => /đạo hàm|đồng biến|cực trị/i.test(question.prompt)), 'Câu hỏi phải đánh giá đúng chủ đề');
    assert(!lesson.questions.some(question => /187\s*\+\s*74|252\s*-\s*152|3 hàng, mỗi hàng/i.test(question.prompt)), 'Không được dùng câu hỏi số học lệch chủ đề');
    assert(lesson.examples.some(example => example.text.includes("f'(x)=3x²−3")), 'Phải có ví dụ giải từng bước');
    assert(lesson.practiceTasks.length >= 4, 'Thiếu luyện tập hướng dẫn, độc lập, thực tế và bài kiểm tra');
    assert(lesson.practical?.rubric?.criteria?.length >= 3, 'Bài thực hành phải có rubric chấm điểm');
});

test('Survey answers lead to the matching K12 placement rather than the first catalog item', () => {
    const questions = [
        { code: 'educationLevel', prompt: 'Bạn đang học cấp nào?' },
        { code: 'currentGrade', prompt: 'Bạn đang học lớp mấy?' },
        { code: 'goals', prompt: 'Mục tiêu học?' }
    ];
    const result = normalizeSurveyResult(questions, { educationLevel: 'PRIMARY', currentGrade: '8', goals: ['Củng cố kiến thức Toán'] });
    const selected = choosePreferredPlacement(placementDefinitions(), { educationLevel: result.educationLevel, grade: result.currentGrade }, { survey: result, goals: result.goals });
    assert.equal(selected?.target, 'K12_GRADE_8');
});
test('Explicit TOEIC/IELTS/MOS goals select matching diagnostics, not a generic test', () => {
    const tests = placementDefinitions();
    for (const [exam, expected] of [['TOEIC', 'TOEIC'], ['IELTS', 'IELTS'], ['MOS', 'MOS']]) {
        const selected = choosePreferredPlacement(tests, {}, { survey: { targetExams: [exam], englishGoals: { exams: [exam] } }, goals: [exam] });
        assert.equal(selected?.target, expected, `${exam} should map to its own diagnostic`);
    }
});
test('Age-derived placement selects a school grade when survey does not provide an explicit grade', () => {
    const selected = choosePreferredPlacement(placementDefinitions(), {}, { profile: { dob: { day: 1, month: 1, year: new Date().getFullYear() - 10 } }, survey: { educationLevel: 'PRIMARY', educationStatus: 'school' } });
    assert.equal(selected?.target, 'K12_GRADE_5');
});
test('University placement does not silently choose an unrelated first placement when major context is missing', () => {
    assert.equal(choosePreferredPlacement(placementDefinitions(), { educationLevel: 'HIGHER_EDUCATION' }, {}), null);
});
test('University IT placement uses the declared major context', () => {
    const selected = choosePreferredPlacement(placementDefinitions(), { educationLevel: 'HIGHER_EDUCATION', majorName: 'Công nghệ thông tin' }, {});
    assert.equal(selected?.target, 'UNIVERSITY_IT');
});

const placement = {
    skillSections: [
        { code: 'ALGEBRA', skill: 'Algebra', questions: [{ id: 'a1', required: true }, { id: 'a2', required: true }] },
        { code: 'READING', skill: 'Reading', questions: [{ id: 'r1', required: true }, { id: 'r2', required: true }] }
    ]
};
test('Placement submission requires all selected answers and two-question coverage per available skill', () => {
    const insufficient = validatePlacementSubmission(placement, ['a1', 'r1'], { a1: 'A', r1: 'B' });
    assert.equal(insufficient.valid, false);
    assert(insufficient.errors.some(error => error.includes('Algebra')));
    const missing = validatePlacementSubmission(placement, ['a1', 'a2', 'r1', 'r2'], { a1: 'A', a2: 'B', r1: 'A' });
    assert.equal(missing.valid, false);
    assert(missing.errors.some(error => error.includes('r2')));
    const complete = validatePlacementSubmission(placement, ['a1', 'a2', 'r1', 'r2'], { a1: 'A', a2: 'B', r1: 'A', r2: 'B' });
    assert.equal(complete.valid, true, complete.errors.join('; '));
});
test('Placement submission rejects duplicate and unknown question identifiers', () => {
    const result = validatePlacementSubmission(placement, ['a1', 'a1', 'a2', 'r1', 'r2', 'foreign'], { a1: 'A', a2: 'B', r1: 'A', r2: 'B' });
    assert.equal(result.valid, false);
    assert(result.errors.some(error => error.includes('trùng')));
    assert(result.errors.some(error => error.includes('không thuộc')));
});

test('Scoring supports object options without order-sensitive JSON-string comparison', () => {
    const result = scoreObjectiveQuestions([
        { _id: 'single', type: 'single_choice', code: 'SINGLE', answer: { label: 'A', value: 'A' }, points: 1 },
        { _id: 'multiple', type: 'multiple_choice', code: 'MULTI', answer: [{ value: 'A' }, { value: 'B' }], points: 2 },
        { _id: 'matching', type: 'matching', code: 'MATCH', answer: { one: 'A', two: 'B' }, points: 2 }
    ], { single: 'a', multiple: ['B', 'A'], matching: { two: 'B', one: 'A' } });
    assert.equal(result.correct, 3);
    assert.equal(result.earnedPoints, 5);
    assert.equal(result.percentage, 100);
});
test('Legacy HTML number values remain compatible with numeric answer keys', () => {
    const result = scoreObjectiveQuestions([{ _id: 'n1', code: 'NUMBER-INDEX', type: 'single_choice', answer: 1, points: 1 }], { n1: '1' });
    assert.equal(result.correct, 1);
    assert.equal(result.details[0].gradingStatus, 'AUTO_SCORED');
});
test('Placement API validates submissions even when a legacy client omits questionIds', () => {
    const route = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    assert(route.includes('const requestedQuestionIds = Array.isArray(req.body?.questionIds)'));
    assert(route.includes('Object.keys(suppliedAnswers).filter(questionId => allQuestionIds.has(String(questionId)))'));
    assert(route.includes('const submission = validatePlacementSubmission(test, requestedQuestionIds, suppliedAnswers)'));
});

test('Missing answer key stays unscored, coding requires the isolated runner, and essays use local rubric auto-scoring', () => {
    const result = scoreObjectiveQuestions([
        { _id: 'missing', type: 'single_choice', code: 'MISSING', options: ['A', 'B'], points: 1 },
        { _id: 'code', type: 'coding', code: 'CODE', answer: 'solution', points: 3 },
        { _id: 'essay', type: 'essay', code: 'ESSAY', answer: 'model response', points: 2 }
    ], { missing: 'A', code: 'solution', essay: 'response' });
    assert.equal(result.details[0].gradingStatus, 'NEEDS_ANSWER_KEY');
    assert.equal(result.details[1].gradingStatus, 'EXECUTOR_REQUIRED');
    assert.equal(result.details[2].gradingStatus, 'LOCAL_RUBRIC_AUTO');
    assert.equal(result.requiresReview, true);
    assert.equal(result.correct, 0);
});
test('Frontend uses explicit profile-aware matcher and avoids an unrelated first-test fallback', () => {
    const flow = fs.readFileSync(path.join(root, 'assets/platform/flow-pages.js'), 'utf8');
    assert(flow.includes('HtmPlacementMatcher?.choosePreferredPlacement'));
    assert(!/new RegExp\(`lớp\\s\*/i.test(flow));
    assert(flow.includes('Chưa đủ thông tin để tự chọn đúng bài đầu vào'));
});
test('DOCX upload uses a raw binary request instead of base64 inflation in the browser', () => {
    const api = fs.readFileSync(path.join(root, 'assets/js/api.js'), 'utf8');
    const admin = fs.readFileSync(path.join(root, 'assets/js/admin/admin-quick-create.js'), 'utf8');
    const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    assert(api.includes('uploadDocx'));
    assert(api.includes('application/octet-stream'));
    assert(admin.includes("/api/admin/platform/word-imports/preview-docx"));
    assert(!admin.includes('readAsDataURL'));
    assert(routes.includes("/admin/platform/word-imports/preview-docx"));
    assert(routes.includes("express.raw({ type: 'application/octet-stream', limit: '3mb' })"));
});

test('Admin content is form-driven; JSON is not required as an authoring format', () => {
    const admin = fs.readFileSync(path.join(root, 'assets/js/admin/admin-learning-engine.js'), 'utf8');
    assert(admin.includes('Bài lập trình thực hành'));
    assert(admin.includes('Lưu bản nháp'));
    assert(!/textarea[^>]*name=["']json["']/i.test(admin));
    assert(!admin.includes('Nhập JSON khóa học'));
});

test('Practice assignments persist learner submissions and expose a guarded grading queue', () => {
    const models = fs.readFileSync(path.join(root, 'server/models/platform-models.js'), 'utf8');
    const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    const lesson = fs.readFileSync(path.join(root, 'khoa-hoc-chi-tiet.html'), 'utf8');
    const admin = fs.readFileSync(path.join(root, 'assets/js/admin/admin-assignment-review.js'), 'utf8');
    assert(models.includes("model('AssignmentSubmission', assignmentSubmissionSchema)"));
    assert(routes.includes("router.post('/learning/assignments/submit'"));
    assert(routes.includes("router.get('/learning/assignments/my-submissions'"));
    assert(routes.includes("router.get('/admin/assignments/submissions'"));
    assert(routes.includes("router.post('/admin/assignments/submissions/:id/grade'"));
    assert(routes.includes("'LESSON_LOCKED'"));
    assert(lesson.includes('data-assignment-submission'));
    assert(lesson.includes('HanhTrinhApi.lesson(id)'), 'Nội dung bài chỉ tải sau thao tác mở bài');
    assert(lesson.includes('lesson.locked?'), 'Bài đang khóa phải bị vô hiệu hóa trên giao diện');
    assert(lesson.includes('/api/learning/assignments/submit'));
    assert(admin.includes('Lưu điểm và nhận xét'));
});
test('Lesson media polling stops when media is not pending and has a retry limit', () => {
    const lesson = fs.readFileSync(path.join(root, 'khoa-hoc-chi-tiet.html'), 'utf8');
    assert(lesson.includes('mediaPollAttempts'));
    assert(lesson.includes("['QUEUED','PENDING','PROCESSING','GENERATING']"));
    assert(lesson.includes('attempts>=4'));
});

process.stdout.write(`\nV29 foundations and V28 Phase 1 regression suite: ${passed} tests PASS.\n`);
