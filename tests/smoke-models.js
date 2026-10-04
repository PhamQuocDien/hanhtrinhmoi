'use strict';
/* Kiểm tra nhanh model + validator (không cần MongoDB). */
const Q = require('../server/models/question.model');
const qv = require('../server/validators/question.validator');
const ev = require('../server/validators/exam.validator');
const scoring = require('../server/services/scoring.service');

console.log('models loaded OK');

const q = new Q({
    questionId: 't1',
    type: 'fill_blank',
    questionText: 'Thủ đô Việt Nam là _____.',
    grade: 8,
    subjectId: 'toan',
    createdBy: 'admin',
    source: 'kiem thu',
    blanks: [{ blankId: 'b1', correctAnswers: ['Hà Nội', 'Ha Noi'] }],
    correctAnswer: { type: 'fill_blank', value: [] },
    points: 1
});
const view = q.toStudentView();
console.log('student view blanks:', view.blanks.length, '| leak check:', view.correctAnswer === undefined);

const r = qv.validateQuestionDocument(q.toObject());
console.log('question valid:', r.valid, '| errors:', r.errors);

console.log('answer shape ok:', qv.validateStudentAnswerShape('fill_blank', { b1: 'Hà Nội' }).valid);
console.log('exam validator exports:', Object.keys(ev).length);

// Chấm một đề hỗn hợp 7 dạng.
const questions = [
    { questionId: 'q1', type: 'single_choice', correctAnswer: { value: 'B' }, options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }] },
    { questionId: 'q2', type: 'multiple_choice', correctAnswer: { value: ['A', 'C'] }, options: [{ label: 'A', text: 'a' }, { label: 'C', text: 'c' }] },
    { questionId: 'q3', type: 'true_false', correctAnswer: { value: true } },
    { questionId: 'q4', type: 'fill_blank', blanks: [{ blankId: 'b1', correctAnswers: ['Hà Nội'] }] },
    { questionId: 'q5', type: 'short_answer', gradingMode: 'auto', acceptedAnswers: ['2,3,5,7'], normalization: { collapseSeparators: true } },
    { questionId: 'q6', type: 'numeric', correctAnswer: { value: 15 }, tolerance: 0.5 },
    { questionId: 'q7', type: 'essay', gradingMode: 'manual', points: 3 }
];
const examItems = questions.map((q2, i) => ({ questionId: q2.questionId, points: 1, order: i + 1 }));
const answers = {
    q1: 'B', q2: ['A', 'C'], q3: true,
    q4: { b1: 'hà nội' }, q5: '2; 3; 5; 7', q6: '15,4', q7: 'Bài tự luận của học sinh...'
};
const graded = scoring.gradeExam(questions, answers, {}, examItems);
console.log('mixed exam ->', JSON.stringify({
    autoScore: graded.autoScore, manualGradingQuestions: graded.manualGradingQuestions,
    gradingStatus: graded.gradingStatus, totalPoints: graded.totalPoints,
    autoScoredPercent: graded.autoScoredPercent
}));
