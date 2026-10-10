'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/learning/lesson-progress.js'), 'utf8');
const coursePage = fs.readFileSync(path.join(root, 'khoa-hoc-chi-tiet.html'), 'utf8');
const calls = [];
const windowMock = { HanhTrinhApi: { get: async path => { calls.push(['get', path]); return []; }, put: async (path, body) => { calls.push(['put', path, body]); return { completedSteps: body.completedSteps, progressPercent: 100, completed: true }; } }, localStorage: { map: new Map(), getItem(key) { return this.map.get(key) || null; }, setItem(key, value) { this.map.set(key, value); } } };
vm.runInNewContext(source, { window: windowMock, Set, String, Array, Math, JSON });
const experience = windowMock.HtmLessonProgress;
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
const lesson = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Vòng lặp', theorySections: [{ title: 'Khái niệm', content: 'Vòng lặp cho phép lặp lại thao tác.' }, { title: 'Điều kiện dừng', content: 'Mỗi vòng cần điều kiện dừng.' }], examples: [{ title: 'Ví dụ', content: 'Đếm từ 1 đến 5.' }], payload: { practiceTasks: ['Viết chương trình đếm'], practical: { task: 'Viết và chạy code' }, quickChecks: ['Vì sao cần điều kiện dừng?'] }, lessonTestId: 'bbbbbbbbbbbbbbbbbbbbbbbb' };
test('Lesson progress extracts bite-size theory, examples, practice, lab, check and assessment steps', () => {
    const steps = experience.stepsFor(lesson);
    assert.deepEqual(Array.from(steps, item => item.id), ['theory-0', 'theory-1', 'examples', 'practice', 'practical', 'quick-check', 'assessment']);
});
test('Lesson progress uses a compatibility-safe key and html-escapes visible labels', () => {
    const html = experience.render({ ...lesson, theorySections: [{ title: '<script>', content: 'visible' }] });
    assert(html.includes('&lt;script&gt;'));
    assert(html.includes('data-content-steps'));
    assert(!html.includes('type="checkbox"'));
    assert(html.includes('Tiến độ chỉ được công nhận từ bài kiểm tra'));
});
test('Course detail page wires persisted lesson progress and local tutor into actual lesson view', () => {
    assert(coursePage.includes('assets/js/learning/lesson-progress.js'));
    assert(coursePage.includes('assets/js/learning/local-ai-tutor.js'));
    assert(coursePage.includes('HtmLessonProgress?.mount(panel,lesson,data.course)'));
    assert(coursePage.includes('HtmLocalAITutor?.mount(tutor,{course:data.course,lesson})'));
    assert(coursePage.includes('Tiến độ bài học'));
});
test('Legacy lessons with one long theory field still expose a single actionable theory progress step', () => {
    const steps = experience.stepsFor({ title: 'Legacy', theory: 'Phần lý thuyết cũ vẫn cần được học.' });
    assert.equal(steps.length, 1);
    assert.equal(steps[0].id, 'theory');
});
test('Progress UI requires a persisted lesson/course ID and never writes learner-completion claims into localStorage', () => {
    assert(source.includes('!objectId(lessonId) || !objectId(courseId)'));
    assert(!source.includes('localStorage.setItem'));
    assert(source.includes('Cần đăng nhập và tải bài học đã lưu trên máy chủ để xác minh tiến độ.'));
    assert(source.includes('api.get(`/api/learning/lesson-progress?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`)'));
    assert(!source.includes('completedSteps =') && !source.includes('progressPercent =')); 
});
console.log(`\nPhase 5 learning experience: ${passed} tests PASS.`);
