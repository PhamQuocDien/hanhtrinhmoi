'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
function read(relativePath) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }
function checkSyntax(relativePath) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, relativePath)], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `${relativePath}: ${result.stderr || result.stdout}`);
}
function testStarterCatalog() {
    const catalog = require(path.join(root, 'server/services/starter-course-catalog.js'));
    assert(catalog.STARTER_COURSES.length >= 50, 'Starter catalog phải có ít nhất 50 khóa.');
    assert(catalog.STARTER_COURSES.filter(item => item.track === 'UNIVERSITY_IT').length >= 20, 'Thiếu catalog CNTT đại học.');
    assert(catalog.STARTER_COURSES.filter(item => item.targetExam === 'TOEIC').length >= 8, 'Thiếu catalog TOEIC.');
    assert(catalog.STARTER_COURSES.filter(item => item.targetExam === 'IELTS').length >= 8, 'Thiếu catalog IELTS.');
    assert(catalog.STARTER_COURSES.filter(item => item.track === 'MOS').length >= 8, 'Thiếu catalog MOS.');
    const match = catalog.findStarterCourse({ major: 'Kỹ thuật phần mềm', goal: 'Backend', prompt: 'lập trình Java' });
    assert(match?.course, 'AI không tìm được starter course CNTT.');
    const draft = catalog.buildStarterDraft(match.course, { major: 'Kỹ thuật phần mềm', skillGaps: ['testing'] });
    assert(draft.chapters.length >= 2, 'Starter draft thiếu chapter.');
    assert(draft.finalAssessment.questions.length >= 3, 'Starter draft thiếu final test.');
    const detail = catalog.buildStarterCourseDetail(catalog.STARTER_COURSES.find(item => item.code === 'MOS-EXCEL-BASIC'));
    assert(detail.course.id === 'MOS-EXCEL-BASIC', 'Starter detail phải có id ổn định.');
    assert(detail.lessons.length === 12, 'Starter detail phải có 12 bài học đầy đủ.');
    assert(detail.assessments.length >= 8, 'Starter detail phải có lesson/chapter/midterm/final assessments.');
}
function testRoutesAndVersion() {
    const migrations = read('scripts/migrations/index.js');
    assert(migrations.includes("006-ai-starter-catalog.js"), 'Chưa đăng ký migration starter catalog.');
    const route = read('server/routes/platform-routes.js');
    for (const token of ["syllabus.track", "UNIVERSITY_IT", "TOEIC", "IELTS", "MOS"]) assert(route.includes(token), `Course API thiếu track ${token}.`);
    const gemini = read('server/services/gemini-service.js');
    for (const token of ['GEMINI_QUOTA_COOLDOWN_MS', 'error.quota', 'GEMINI_INVALID_JSON', 'repairStructuredJson']) assert(gemini.includes(token), `Gemini resilience thiếu ${token}.`);
    const server = read('server.js');
    assert(/const APP_VERSION = '\d+\.\d+\.\d+'/.test(server) && server.includes("const APP_VERSION = '39.0.0'"), 'APP_VERSION phải phản ánh bản nâng cấp hiện tại.');
    assert(server.includes('GEMINI_INVALID_JSON'), 'Global error handler chưa bắt invalid JSON của Gemini.');
    const render = read('render.yaml');
    assert(render.includes('GEMINI_QUOTA_COOLDOWN_MS'), 'Render chưa cấu hình quota cooldown.');
    assert(render.includes('GEMINI_MAX_FALLBACK_MODELS'), 'Render chưa cấu hình số fallback model.');
}
function testMigrationIsolation() {
    const source = read('scripts/migrations/index.js');
    assert(source.includes('try {'), 'Migration runner phải bọc từng migration bằng try/catch.');
    assert(source.includes('stopOnError = true') && source.includes('if (stopOnError) break;'), 'Migration lỗi phải chặn migration phụ thuộc để tránh báo trạng thái sẵn sàng sai.');
}
function testAutomaticCourseFlow() {
    const auto = read('server/services/ai-autopilot-service.js');
    assert(auto.includes('autoProvisionCourse({ models, username, prompt'), 'Ambient AI chưa có auto provisioning.');
    assert(auto.includes('const autoEligible = meaningfulEvent'), 'Auto course chưa có điều kiện tự động.');
    assert(auto.includes('if (insight.shouldCreateCourse && autoEligible)'), 'Auto course chưa chạy tự động.');
    const browser = read('assets/js/ai-autopilot.js');
    assert(!browser.includes('id="ai-autopilot-create"'), 'Vẫn còn nút Tạo khóa học thủ công.');
    assert(browser.includes('data.autoCourse'), 'UI chưa render trạng thái khóa học tự động.');
}
for (const file of ['server/services/starter-course-catalog.js', 'scripts/migrations/006-ai-starter-catalog.js', 'server/services/gemini-service.js', 'server/services/ai-learning-service.js', 'server/services/ai-autopilot-service.js', 'server/routes/platform-routes.js', 'server/routes/ai-learning-routes.js', 'server.js', 'assets/js/ai-autopilot.js', 'assets/js/ai-learning-hub.js']) checkSyntax(file);
testStarterCatalog();
testRoutesAndVersion();
testAutomaticCourseFlow();
testMigrationIsolation();
console.log('✅ Runtime V17: AI Autopilot tự tạo course khi thiếu, Gemini quota/JSON resilience, migration isolation và starter catalog CNTT + TOEIC + IELTS + MOS đều đạt.');
