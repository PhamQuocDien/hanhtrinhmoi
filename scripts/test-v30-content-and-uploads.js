'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const content = require(path.join(root, 'server/modules/rich-learning-content-v20.js'));
let passed = 0;
function test(name, run) { run(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

const cppLoop = content.buildMixedQuestions({ course: { code: 'CPP-FOUNDATIONS', name: 'C++ Foundations', track: 'programming' }, topic: 'Vòng lặp for while', count: 12 });
test('C++ loop task has input/output examples that match summing 1..n', () => {
    const task = cppLoop.find(item => item.type === 'coding');
    assert.ok(task, 'coding task missing');
    assert.equal(task.media.publicTestCases[0].input, '5');
    assert.equal(task.media.publicTestCases[0].expectedOutput, '15');
    assert.equal(task.media.publicTestCases[1].expectedOutput, '55');
    assert.match(task.prompt, /input|output/i);
});

test('array task checks negative values rather than defaulting max to zero', () => {
    const questions = content.buildMixedQuestions({ course: { name: 'C++ DSA', track: 'programming' }, topic: 'Mảng một chiều', count: 12 });
    const task = questions.find(item => item.type === 'coding');
    assert.ok(task);
    assert.equal(task.media.publicTestCases[1].expectedOutput, '-2');
});

test('condition task covers positive, negative and zero branches', () => {
    const questions = content.buildMixedQuestions({ course: { name: 'C++ Basic', track: 'programming' }, topic: 'Điều kiện if else', count: 12 });
    const task = questions.find(item => item.type === 'coding');
    assert.ok(task);
    assert.deepEqual(task.media.publicTestCases.map(testCase => testCase.expectedOutput), ['NEGATIVE', 'POSITIVE']);
    assert.match(task.media.starterCode, /TODO/);
});

test('TOEIC Reading Part 5 uses a grammar item with a defined answer', () => {
    const questions = content.buildMixedQuestions({ course: { code: 'TOEIC-R', name: 'TOEIC Reading', track: 'toeic', targetExam: 'TOEIC', targetVariant: 'READING_P5_P6' }, topic: 'Grammar Part 5', count: 12 });
    const item = questions.find(question => /Each applicant/.test(question.prompt));
    assert.ok(item);
    assert.equal(item.answer, 'is');
    assert.match(item.explanation, /subject|applicant|singular/i);
});

test('TOEIC listening has listening-specific question formats and distractor feedback', () => {
    const questions = content.buildMixedQuestions({ course: { name: 'TOEIC Listening', track: 'toeic', targetExam: 'TOEIC', targetVariant: 'LISTENING_P1_P2' }, topic: 'Listening Part 1 and Part 2', count: 12 });
    assert.ok(questions.some(question => /photograph|picture|woman|man/i.test(question.prompt)));
    assert.ok(questions.some(question => /response|question|distractor|listen/i.test(`${question.prompt} ${question.explanation}`)));
});

test('MOS Excel practice includes real formulas and workbook output', () => {
    const questions = content.buildMixedQuestions({ course: { name: 'MOS Excel', track: 'mos', targetExam: 'MOS' }, topic: 'Excel formulas', count: 12 });
    assert.ok(questions.some(question => /AVERAGE\(B2:B5\)/i.test(question.prompt)));
    assert.ok(questions.some(question => /\.xlsx/.test(JSON.stringify(question))));
});

test('MOS Word and PowerPoint produce actual document deliverables', () => {
    const word = content.buildMixedQuestions({ course: { name: 'MOS Word', track: 'mos', targetExam: 'MOS' }, topic: 'Word heading styles and table of contents', count: 12 });
    const ppt = content.buildMixedQuestions({ course: { name: 'MOS PowerPoint', track: 'mos', targetExam: 'MOS' }, topic: 'PowerPoint Slide Master', count: 12 });
    assert.ok(word.some(question => /\.docx|Heading 1|Table of Contents/i.test(JSON.stringify(question))));
    assert.ok(ppt.some(question => /\.pptx|Slide Master/i.test(JSON.stringify(question))));
});

test('grade 1 addition questions are relevant to the lesson topic', () => {
    const questions = content.buildK12Questions({ grade: 1, subjectId: 'toan', subjectName: 'Toán', topic: 'Phép cộng trong phạm vi 10', count: 12 });
    assert.equal(questions.length, 12);
    assert.ok(questions.some(question => /4 \+ 3/.test(question.prompt)));
    assert.ok(questions.every(question => question.tags.includes('TOPIC_ALIGNED')));
    assert.ok(!questions.some(question => /đại lượng tăng từ 24 lên 30/.test(question.prompt)));
});

test('grade 12 calculus has a topic-specific derivative assessment', () => {
    const questions = content.buildK12Questions({ grade: 12, subjectId: 'toan', subjectName: 'Toán', topic: 'Tính đơn điệu và cực trị', count: 12 });
    assert.ok(questions.some(question => /f\(x\)=x³−3x|đạo hàm|cực tiểu/i.test(question.prompt)));
    assert.ok(questions.every(question => question.tags.includes('CONTENT_ALIGNED')));
});

test('professional lesson has segmented content, topic-specific examples and teacher-review flag', () => {
    const lesson = content.professionalRichLesson({ course: { code: 'CPP', name: 'C++ Foundations', track: 'programming' }, topic: 'Vòng lặp for while', index: 0, existing: { theorySections: [] } });
    assert.ok(Array.isArray(lesson.theorySections) && lesson.theorySections.length >= 10);
    assert.match(lesson.theorySections[1].content, /Vòng lặp lặp lại/i);
    assert.ok(lesson.examples.some(example => /sum bắt đầu 0|tổng từ 1 đến 5/i.test(example.text)));
    assert.ok(lesson.examples.some(example => /Bài độc lập/.test(example.text)));
    assert.ok(lesson.activities.some(activity => /Guided lab/.test(activity.title)));
    assert.equal(lesson.contentQualityStatus, 'AUTO_GENERATED_REQUIRES_TEACHER_REVIEW');
});

test('assignment files are saved as binary Buffer with size limits and TTL cleanup', () => {
    const schema = fs.readFileSync(path.join(root, 'server/models/platform-models.js'), 'utf8');
    assert.match(schema, /assignmentAttachmentSchema/);
    assert.match(schema, /data: \{ type: Buffer, required: true \}/);
    assert.match(schema, /max: 3145728/);
    assert.match(schema, /expireAfterSeconds: 0/);
    assert.match(schema, /AssignmentAttachment: model\('AssignmentAttachment'/);
});

test('attachment upload is raw binary and does not Base64 encode the payload', () => {
    const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    const upload = routes.slice(routes.indexOf("router.post('/learning/assignments/attachment'"), routes.indexOf("router.post('/learning/assignments/submit'"));
    assert.match(upload, /express\.raw\(\{ type: 'application\/octet-stream', limit: '3mb' \}\)/);
    assert.match(upload, /data: req\.body/);
    assert.doesNotMatch(upload, /toString\(['"]base64['"]\)/);
    assert.match(upload, /ATTACHMENT_TYPE_UNSUPPORTED/);
});

test('student submits can include text, link or attached file and remain tied to a lesson', () => {
    const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    const submit = routes.slice(routes.indexOf("router.post('/learning/assignments/submit'"), routes.indexOf("router.get('/admin/assignments/submissions/:id/attachment'"));
    assert.match(submit, /attachmentId/);
    assert.match(submit, /submissionText/);
    assert.match(submit, /submissionUrl/);
    assert.match(submit, /Bạn cần hoàn thành bài học trước/);
    assert.match(submit, /status: 'SUBMITTED'/);
});

test('student submission UI uses binary upload and supports common school/work file types', () => {
    const html = fs.readFileSync(path.join(root, 'khoa-hoc-chi-tiet.html'), 'utf8');
    const api = fs.readFileSync(path.join(root, 'assets/js/api.js'), 'utf8');
    assert.match(html, /name="submissionFile" type="file"/);
    assert.match(html, /HanhTrinhApi\.uploadBinary/);
    assert.match(api, /Content-Type': 'application\/octet-stream/);
    assert.match(api, /body: file/);
});

test('admin can download uploaded work from an authenticated review route', () => {
    const routes = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
    const admin = fs.readFileSync(path.join(root, 'assets/js/admin/admin-assignment-review.js'), 'utf8');
    assert.match(routes, /router\.get\('\/admin\/assignments\/submissions\/:id\/attachment', guarded\('learning\.lesson\.read'\)/);
    assert.match(routes, /Content-Disposition/);
    assert.match(admin, /\/api\/admin\/assignments\/submissions\//);
    assert.match(admin, /Tải tệp:/);
});


test('registration captures date of birth and sends a verified learner directly to onboarding survey', () => {
    const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
    const profile = fs.readFileSync(path.join(root, 'profile.html'), 'utf8');
    assert.match(login, /name="dobDay"[\s\S]*name="dobMonth"[\s\S]*name="dobYear"/);
    assert.match(login, /window\.location\.replace\('\/survey\.html\?onboarding=1'\)/);
    assert.match(profile, /id="birthDate" name="birthDate" type="date"/);
    assert.match(profile, /id="calculatedAge" type="number" readonly/);
});

test('student admin tools expose account details and guarded delete confirmation', () => {
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    const admin = fs.readFileSync(path.join(root, 'assets/js/admin/admin-users.js'), 'utf8');
    assert.match(server, /app\.get\('\/api\/admin\/user\/:username'/);
    assert.match(server, /app\.post\('\/api\/admin\/delete-user'/);
    assert.match(admin, /XÓA VĨNH VIỄN tài khoản học sinh/);
    assert.match(admin, /Nhập chính xác username/);
});


const { createEnvironmentOtpTransport } = require(path.join(root, 'server/services/otp-transport.js'));
async function testOtpProviders() {
    const calls = [];
    const mockFetch = async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 200 };
    };
    const emailTransport = createEnvironmentOtpTransport({ RESEND_API_KEY: 'test-key', OTP_EMAIL_FROM: 'noreply@example.com' }, mockFetch);
    await emailTransport({ channel: 'email', identifier: 'student@example.com', code: '123456' });
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    assert.match(calls[0].init.body, /123456/);
    const smsTransport = createEnvironmentOtpTransport({ TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'test-token', TWILIO_FROM_NUMBER: '+10000000000' }, mockFetch);
    await smsTransport({ channel: 'phone', identifier: '+84900000000', code: '654321' });
    assert.match(calls[1].url, /Accounts\/AC123/);
    assert.match(calls[1].init.body, /To=%2B84900000000/);
    await assert.rejects(createEnvironmentOtpTransport({}, mockFetch)({ channel: 'email', identifier: 'student@example.com', code: '123456' }), /not configured/);
}

test('release version is consistent in package and server', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    assert.equal(pkg.version, '39.0.0');
    assert.match(server, /const APP_VERSION = '39\.0\.0'/);
});

testOtpProviders().then(() => { passed += 1; process.stdout.write('PASS OTP email/SMS environment adapters'); process.stdout.write(`\nV30 content/upload checks: ${passed} PASS\n`); }).catch(error => { console.error('FAIL OTP email/SMS environment adapters', error); process.exitCode = 1; });
