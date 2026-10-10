'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { makeCourseDraft } = require(path.join(root, 'server/services/local-course-composer.js'));
const { createApiRateLimiter } = require(path.join(root, 'server/middleware/api-rate-limiter.js'));
const { createRequestLogger } = require(path.join(root, 'server/middleware/request-logger.js'));
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function mockResponse() {
    const headers = {};
    return {
        headers, statusCode: 200, body: null,
        setHeader(name, value) { headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        once(event, callback) { if (event === 'finish') this.finish = callback; return this; }
    };
}
test('Root static route does not expose arbitrary server files or package metadata', () => {
    const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    assert.doesNotMatch(source, /app\.use\(express\.static\(__dirname/);
    assert.match(source, /const privateRootPaths = new Set/);
    assert.match(source, /if \(privateRootPaths\.has\(pathname\) \|\| disabledLegacyGamePages\.has\(pathname\)\) return res\.status\(404\)\.end\(\)/);
    assert.match(source, /app\.use\('\/admin', adminStatic\)/);
    assert.match(source, /const publicRootBinaryAssets = new Set\(\['\/stockfish\.wasm'\]\)/);
    assert.match(source, /publicRootBinaryAssets\.has\(pathname\)/);
    for (const retired of ['/caro.html', '/co-ty-phu.html', '/co-vay.html', '/othello.html', '/choi-co.html', '/dau-truong-thu-thach.html']) assert.ok(source.includes(`'${retired}'`), `disabled page ${retired}`);
});
test('Sensitive API rate limits reject repeated requests, return Retry-After, and reset after window expiry', () => {
    let now = 1000;
    const limit = createApiRateLimiter({ policies: [{ name: 'auth', match: /login/i, windowMs: 10000, max: 2 }], general: { name: 'api', windowMs: 10000, max: 20 }, now: () => now });
    const run = () => {
        const req = { method: 'POST', path: '/login', ip: '127.0.0.1', body: { username: 'student' }, session: null };
        const res = mockResponse(); let nextCalled = false;
        limit(req, res, () => { nextCalled = true; });
        return { res, nextCalled };
    };
    assert.equal(run().nextCalled, true);
    assert.equal(run().nextCalled, true);
    const blocked = run();
    assert.equal(blocked.res.statusCode, 429);
    assert.equal(blocked.res.body.code, 'RATE_LIMITED');
    assert.ok(Number(blocked.res.headers['Retry-After']) > 0);
    now += 10001;
    assert.equal(run().nextCalled, true);
});
test('Structured request logging never serializes request bodies or auth headers', () => {
    let logged = '';
    const logger = createRequestLogger({ write: value => { logged = value; }, now: () => 1000 });
    const req = { path: '/login', method: 'POST', requestId: 'test-request', ip: '127.0.0.1', body: { password: 'must-not-appear' }, headers: { authorization: 'must-not-appear' } };
    const res = mockResponse(); res.statusCode = 200;
    logger(req, res, () => {}); res.finish();
    assert.match(logged, /"event":"http_request"/);
    assert.match(logged, /"requestId":"test-request"/);
    assert.doesNotMatch(logged, /must-not-appear|password|authorization/i);
});
test('Explicit Debug/testing need generates a focused 8-lesson course with lesson-specific content and unique questions', () => {
    const draft = makeCourseDraft({ prompt: 'Debug và kiểm thử phần mềm', domain: 'Debug và kiểm thử phần mềm', subjectId: 'computer_science', courseTitle: 'Debug và kiểm thử phần mềm' });
    const lessons = draft.chapters.flatMap(chapter => chapter.lessons);
    const questions = lessons.flatMap(lesson => lesson.test.questions.map(question => question.prompt));
    assert.equal(lessons.length, 8);
    assert.deepEqual(lessons.map(lesson => lesson.title), [
        'Phân biệt lỗi cú pháp, lỗi lúc chạy và lỗi logic',
        'Tái hiện lỗi bằng đầu vào tối thiểu',
        'Đọc stack trace và xác định vị trí cần kiểm tra',
        'Thiết kế test case theo phân vùng và giá trị biên',
        'Viết unit test với Arrange–Act–Assert',
        'Dùng breakpoint và quan sát trạng thái chương trình',
        'Viết regression test sau khi sửa lỗi',
        'Báo cáo lỗi, tìm nguyên nhân gốc và xác minh bản sửa'
    ]);
    assert.equal(new Set(questions).size, questions.length);
    for (const lesson of lessons) {
        assert.ok(lesson.theorySections.length >= 3 && lesson.theorySections.every(section => section.content.length >= 120), `${lesson.title}: theory`);
        assert.ok(lesson.lecture.script.length >= 180, `${lesson.title}: lecture`);
        assert.ok(lesson.examples.length >= 2, `${lesson.title}: examples`);
        assert.ok(lesson.practiceTasks.length >= 2, `${lesson.title}: practice`);
        assert.ok(lesson.test.questions.length >= 6, `${lesson.title}: lesson test`);
    }
    assert.ok(draft.midtermAssessment.questions.length >= 10);
    assert.ok(draft.finalAssessment.questions.length >= 15);
    assert.ok(draft.mockAssessment.questions.length >= 20);
});
test('Focused TOEIC and MOS requests build topic-specific lessons with non-duplicate lesson tests', () => {
    const cases = [
        { request: { prompt: 'TOEIC Listening Part 1 mô tả tranh', courseTitle: 'TOEIC Listening Part 1', targetExam: 'TOEIC' }, expected: /Part 1/ },
        { request: { prompt: 'MOS Excel thực hành', courseTitle: 'MOS Excel thực hành', targetExam: 'MOS', domain: 'Excel' }, expected: /Excel/ },
        { request: { prompt: 'MOS PowerPoint trình chiếu', courseTitle: 'MOS PowerPoint', targetExam: 'MOS', domain: 'PowerPoint' }, expected: /PowerPoint/ }
    ];
    for (const item of cases) {
        const draft = makeCourseDraft(item.request);
        const lessons = draft.chapters.flatMap(chapter => chapter.lessons);
        assert.ok(lessons.length >= 6, `${draft.title}: lessons`);
        assert.ok(lessons.every(lesson => item.expected.test(lesson.title)), `${draft.title}: focused lesson titles`);
        const prompts = lessons.flatMap(lesson => lesson.test.questions.map(question => question.prompt.trim().toLowerCase()));
        assert.equal(new Set(prompts).size, prompts.length, `${draft.title}: duplicate prompts`);
    }
    const word = makeCourseDraft({ prompt: 'MOS Word định dạng văn bản', courseTitle: 'MOS Word', targetExam: 'MOS', domain: 'Word' });
    assert.ok(word.chapters.flatMap(chapter => chapter.lessons).every(lesson => /Word/.test(lesson.title)));
});
test('Personal-course worker imports the service it invokes and materialization is idempotent by course identity', () => {
    const worker = fs.readFileSync(path.join(root, 'server/services/ai-generation-worker.js'), 'utf8');
    const ai = fs.readFileSync(path.join(root, 'server/services/ai-learning-service.js'), 'utf8');
    assert.match(worker, /const \{ ensurePersonalCourse \} = require\('\.\/ai-learning-service'\)/);
    assert.match(ai, /findOneAndUpdate\(\{ \.\.\.lessonIdentity, code: lessonCode \}/);
    assert.match(ai, /const codeCollision = await models\.CurriculumContent\.findOne/);
    assert.match(ai, /error\?\.code !== 11000/);
    assert.match(ai, /const materializedCode = .*fingerprintKey/);
    assert.match(ai, /let resumableExisting = null/);
    assert.match(ai, /AI_COURSE_MATERIALIZATION_INCOMPLETE/);
});
test('Practice catalogue does not silently switch to tasks from another course or skill', () => {
    const source = fs.readFileSync(path.join(root, 'assets/js/learning/algorithm-practice.js'), 'utf8');
    assert.match(source, /Chưa có bài thực hành đã công bố khớp với khóa học và kỹ năng/);
    assert.doesNotMatch(source, /if\s*\(!matchingTasks\.length\)[\s\S]{0,250}matchingTasks\s*=\s*trackTasks/);
    assert.match(source, /taskSkill && skill\.includes\(taskSkill\)/);
});
test('Only chess is shown in the entertainment hub and the README is synchronized to V37', () => {
    const hub = fs.readFileSync(path.join(root, 'game-hub.html'), 'utf8');
    assert.match(hub, /href="co-vua\.html"/);
    assert.doesNotMatch(hub, /href="(?:caro|co-ty-phu|co-vay|othello)\.html"/);
    assert.match(hub, /Trò chơi chiến thuật duy nhất/);
    const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    assert.match(readme, /V37\.0\.0/);
    assert.doesNotMatch(readme, /Phiên bản source hiện tại:\s*\*\*V30\.0\.0/);
    const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
    assert.match(server, /return type === 'chess' \? 'chess' : null/);
    assert.match(server, /Tournament\.find\(\{ gameType: 'chess', status: 'open'/);
    assert.match(server, /socket\.removeAllListeners\(eventName\)/);
    assert.match(server, /app\.post\('\/api\/game\/caro-win', retiredBoardGameRoute\)/);
    const math = fs.readFileSync(path.join(root, 'toan-hoc.html'), 'utf8');
    assert.match(math, /href="game-hub\.html" class="back-button"/);
});
(async () => {
    for (const [name, fn] of tests) { await fn(); process.stdout.write(`PASS ${name}\n`); }
    console.log(`V37 regression (remediation): ${tests.length} tests passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
