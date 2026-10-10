'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const { STARTER_COURSES, buildStarterDraft } = require(path.join(root, 'server/services/starter-course-catalog.js'));
const rich = require(path.join(root, 'server/services/catalog-v19-rich.js'));
assert(STARTER_COURSES.length >= 250, `Catalog phải có ít nhất 250 khóa duy nhất, thực tế ${STARTER_COURSES.length}.`);
assert(new Set(STARTER_COURSES.map(x => x.code)).size === STARTER_COURSES.length, 'Catalog không được có mã khóa học trùng.');
assert(rich.RICH_IT_COURSES.length >= 40, 'Thiếu catalog CNTT mở rộng.');
assert(rich.RICH_TOEIC_COURSES.length >= 10, 'Thiếu catalog TOEIC mở rộng.');
assert(rich.RICH_IELTS_COURSES.length >= 8, 'Thiếu catalog IELTS mở rộng.');
assert(rich.RICH_MOS_COURSES.length >= 8, 'Thiếu catalog MOS mở rộng.');
assert(STARTER_COURSES.filter(x => x.subjectId === 'CNTT').length >= 40, 'Thiếu khóa CNTT trong catalog hợp nhất.');
assert(STARTER_COURSES.filter(x => x.targetExam === 'TOEIC').length >= 20, 'Thiếu khóa TOEIC trong catalog hợp nhất.');
assert(STARTER_COURSES.filter(x => x.targetExam === 'IELTS').length >= 18, 'Thiếu khóa IELTS trong catalog hợp nhất.');
assert(STARTER_COURSES.filter(x => x.track === 'MOS').length >= 15, 'Thiếu khóa MOS trong catalog hợp nhất.');
for (const course of STARTER_COURSES) assert.strictEqual(course.lessonTitles.length, 12, `${course.code} phải có 12 bài.`);
for (const sample of [STARTER_COURSES.find(x => x.track === 'UNIVERSITY_IT'), STARTER_COURSES.find(x => x.targetExam === 'TOEIC'), STARTER_COURSES.find(x => x.targetExam === 'IELTS'), STARTER_COURSES.find(x => x.track === 'MOS')]) {
    const draft = buildStarterDraft(sample);
    assert.strictEqual(draft.chapters.length, 6);
    assert.strictEqual(draft.chapters.reduce((n, c) => n + c.lessons.length, 0), 12);
    assert(draft.chapters.every(c => c.test.questions.length >= 8));
    assert(draft.chapters.every(c => c.lessons.every(l => l.theorySections.length >= 4 && l.theorySections.every(s => s.content.length >= 120))));
    assert(draft.chapters.every(c => c.lessons.every(l => l.lecture?.script?.length >= 180)));
    assert(draft.chapters.every(c => c.lessons.every(l => l.test.questions.length >= 8)));
    assert(draft.midtermAssessment.questions.length >= 20);
    assert(draft.finalAssessment.questions.length >= 40);
    assert(draft.mockAssessment.questions.length >= 20);
    assert(draft.chapters.every(c => c.lessons.every(l => l.activities.length >= 2 && l.practiceTasks.length >= 3)));
    assert(draft.chapters.every(c => c.lessons.every(l => l.audioScript.length >= 120 && l.visualPrompt.length >= 80)));
    if (sample.track === 'UNIVERSITY_IT') assert(draft.chapters.every(c => c.lessons.every(l => l.programming && l.codeExample && l.codingTasks.length >= 2 && l.testCases.length >= 2)), `${sample.code} phải có lab lập trình.`);
    if (sample.targetExam === 'TOEIC' || sample.targetExam === 'IELTS') assert(draft.chapters.every(c => c.lessons.every(l => l.audioScript.length >= 180 && l.visualPrompt.length >= 100)), `${sample.code} phải có audio/image prompts.`);
    if (sample.track === 'MOS') assert(draft.chapters.every(c => c.lessons.every(l => l.activities.some(a => /Office|MOS/i.test(JSON.stringify(a))))), `${sample.code} phải có hoạt động thực hành Office.`);

}
for (const file of ['server/services/gemini-service.js','server/services/starter-course-catalog.js','server/services/catalog-v19-rich.js','server/services/ai-learning-service.js','server/services/ai-autopilot-service.js','server/routes/ai-learning-routes.js','scripts/migrations/009-v19-rich-course-engine.js','code-lab.html']) {
    assert(fs.existsSync(path.join(root,file)), `Thiếu ${file}.`);
}
console.log('✅ V19 runtime: rich catalog + 12 bài/course + lý thuyết/bài giảng/practice + lesson/chapter/midterm/final/mock structure.');
