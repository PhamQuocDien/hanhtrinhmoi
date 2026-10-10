'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const curriculum = require('../curriculum-data.js');
const { scoreObjectiveQuestions } = require('../server/services/platform-services.js');

const root = path.resolve(__dirname, '..');

function checkSyntax(relativePath) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, relativePath)], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `${relativePath}: ${result.stderr || result.stdout}`);
}

function testFilesAndNavigation() {
    for (const file of ['trung-tam-hoc-tap.html', 'assets/learning/learning-intelligence.css', 'assets/js/learning-intelligence.js']) {
        assert(fs.existsSync(path.join(root, file)), `Thiếu ${file}`);
    }
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert(index.includes('href="trung-tam-hoc-tap.html"'), 'Trang tổng quan chưa liên kết Trung tâm thông minh.');
    const page = fs.readFileSync(path.join(root, 'trung-tam-hoc-tap.html'), 'utf8');
    const js = fs.readFileSync(path.join(root, 'assets/js/learning-intelligence.js'), 'utf8');
    for (const snippet of ['Sổ tay lỗi sai', 'assets/js/learning-intelligence.js']) assert(page.includes(snippet), `Trang trung tâm thiếu tích hợp: ${snippet}`);
    for (const snippet of ['learningCoachToday', 'error-list', 'adaptivePracticeStart', 'learningCoachAsk']) assert(js.includes(snippet), `Frontend intelligence thiếu: ${snippet}`);
}

function testModels() {
    const source = fs.readFileSync(path.join(root, 'server/models/platform-models.js'), 'utf8');
    assert(source.includes('const learningErrorSchema'), 'Thiếu schema LearningError.');
    assert(source.includes('const adaptivePracticeSessionSchema'), 'Thiếu schema AdaptivePracticeSession.');
    assert(source.includes("LearningError: model('LearningError', learningErrorSchema)"), 'Chưa export model LearningError.');
    assert(source.includes("AdaptivePracticeSession: model('AdaptivePracticeSession', adaptivePracticeSessionSchema)"), 'Chưa export model AdaptivePracticeSession.');
    assert(source.includes("learningErrorSchema.index({ username: 1, fingerprint: 1 }, { unique: true })"), 'LearningError thiếu unique index username+fingerprint.');
    assert(source.includes('questionPool: { type: [mongoose.Schema.Types.Mixed]'), 'AdaptivePracticeSession thiếu questionPool.');
    assert(source.includes('history: { type: [mongoose.Schema.Types.Mixed]'), 'AdaptivePracticeSession thiếu history.');
}

function testScoreDetails() {
    const result = scoreObjectiveQuestions([{ _id: 'q1', code: 'Q1', prompt: '2+2?', options: ['3', '4', '5', '6'], answer: 1, skill: 'Phép tính', difficulty: 'EASY', explanation: '4' }], { q1: 0 });
    assert.strictEqual(result.correct, 0);
    assert.strictEqual(result.details[0].isCorrect, false);
    assert.strictEqual(result.details[0].prompt, '2+2?');
    assert.deepStrictEqual(result.details[0].options, ['3', '4', '5', '6']);
    assert.strictEqual(result.details[0].correctAnswer, 1);
    assert.strictEqual(result.details[0].chosenAnswer, 0);
    assert.strictEqual(result.details[0].skill, 'Phép tính');
}

function testAdaptiveQuestionPool() {
    const subject = curriculum.getSubject(6, 'toan', { includeLessons: true });
    assert(subject?.lessons?.length, 'Không có dữ liệu Toán lớp 6.');
    const questions = subject.lessons.flatMap(lesson => lesson.questions || []).filter(question => Number.isInteger(question.answer) && Array.isArray(question.options));
    assert(questions.length >= 50, 'Question pool lớp 6 chưa đủ lớn cho adaptive practice.');
    const difficulties = new Set(subject.lessons.map(lesson => String(lesson.difficulty || '')));
    assert(difficulties.size >= 2, 'Curriculum chưa có nhiều mức độ để adaptive practice điều chỉnh.');
}

function testRouteSurface() {
    const source = fs.readFileSync(path.join(root, 'server/routes/learning-intelligence-routes.js'), 'utf8');
    for (const route of ['/coach/today', '/coach/task-complete', '/errors', '/errors/:id/resolve', '/adaptive-practice/sessions', '/adaptive-practice/sessions/:id/answer', '/coach/ask']) {
        assert(source.includes(`'${route}'`), `Thiếu route ${route}`);
    }
    assert(source.includes("data.sourceType === 'ADAPTIVE_PRACTICE'"), 'Adaptive error chưa gom theo câu hỏi.');
    assert(source.includes('requestedQuestionId'), 'Adaptive practice chưa hỗ trợ luyện đúng câu trong Sổ tay lỗi.');
    assert(source.includes('completedTaskIds'), 'AI Coach chưa hiển thị nhiệm vụ đã hoàn tất trong ngày.');
    assert(source.includes('(bucket.correct * 100)'), 'Skill mastery chưa tính đúng trọng số theo số câu trong phiên.');
    assert(source.includes('logAdaptivePracticeCompletion'), 'Adaptive Practice chưa ghi nhận thời lượng học.');
}

for (const file of ['server/routes/learning-intelligence-routes.js', 'server/services/platform-services.js', 'server/models/platform-models.js', 'server.js', 'server/routes/platform-routes.js', 'assets/js/api.js', 'assets/js/learning-intelligence.js']) checkSyntax(file);
testFilesAndNavigation();
testModels();
testScoreDetails();
testAdaptiveQuestionPool();
testRouteSurface();
console.log('✅ Runtime V15: AI Coach hằng ngày, Sổ tay lỗi sai, Adaptive Practice, Error aggregation và navigation đều đạt.');
