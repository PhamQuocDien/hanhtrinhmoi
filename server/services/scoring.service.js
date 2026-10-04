'use strict';

/**
 * CHẤM ĐIỂM — TOÀN BỘ logic nằm ở máy chủ.
 *
 * Trình duyệt chỉ gửi câu trả lời. Máy chủ tự:
 *   nạp đáp án đúng -> so khớp -> tính điểm -> trả kết quả kèm giải thích.
 *
 * KHÔNG BAO GIỜ tin điểm do client gửi lên.
 *
 * Cấu trúc:
 *   services/scoring.service.js          <- facade (file này)
 *   services/scoring/question-graders.js  <- MỘT hàm chấm cho TỪNG loại câu hỏi
 *   services/scoring/exam-grader.js       <- gom kết quả cả đề + chấm tay
 */

const { QUESTION_TYPES } = require('../config/constants');
const env = require('../config/env');
const normalizer = require('../utils/answer-normalizer');
const questionGraders = require('./scoring/question-graders');
const examGrader = require('./scoring/exam-grader');

// ------------------------------------------------------------------ HÀM CHẤM TỪNG LOẠI

const {
    gradeSingleChoice,
    gradeMultipleChoice,
    gradeTrueFalse,
    gradeFillBlank,
    gradeShortAnswer,
    gradeNumeric,
    gradeEssay,
    gradeByType,
    GRADERS,
    countWords,
    isBlank,
    parseBoolean,
    roundPoints,
    toMaxPoints
} = questionGraders;

// ------------------------------------------------------------------ SO KHỚP NHANH

/**
 * So khớp một câu trả lời với đáp án đúng.
 * Hàm tiện lợi cho nơi khác chỉ cần một phép so khớp đơn lẻ.
 */
function isAnswerCorrect(question, givenAnswer) {
    return gradeByType(question, givenAnswer, toMaxPoints(question.points)).isCorrect;
}

/**
 * Chấm một câu. Giữ tên cũ để code đang chạy không hỏng.
 * @returns {{isCorrect: boolean, awardedPoints: number, needsManualGrading: boolean}}
 */
function gradeQuestion(question, givenAnswer, points) {
    const result = gradeByType(question, givenAnswer, points);
    return {
        isCorrect: result.isCorrect,
        awardedPoints: result.awardedPoints,
        needsManualGrading: result.needsManualGrading,
        maxPoints: result.maxPoints,
        detail: result.detail
    };
}

/**
 * Chấm cả một bài thi.
 *
 * @param {Array}  questions câu hỏi kèm correctAnswer (được nạp từ DB ở máy chủ)
 * @param {object} answers   map { questionId: đáp án của học sinh }
 * @param {object} pointsMap map { questionId: điểm của câu trong đề }
 * @param {Array}  examItems mảng { questionId, points, order } của đề (tuỳ chọn)
 * @returns {object} kết quả chấm đầy đủ
 */
function gradeExam(questions, answers = {}, pointsMap = {}, examItems = null) {
    return examGrader.gradeExam(questions, answers, pointsMap, examItems);
}

/** Chấm lại điểm cuối sau khi có điểm người chấm cho câu tự luận. */
function finalizeScores(result, manualScores = {}) {
    return examGrader.finalizeScores(result, manualScores);
}

// ------------------------------------------------------------------ ĐÁNH GIÁ KẾT QUẢ

/** Đánh giá đạt/không đạt theo ngưỡng cấu hình. */
function isPassing(scorePercent, threshold = env.SCORING.passScore) {
    return Number(scorePercent) >= Number(threshold);
}

/** Thông điệp động viên theo điểm số. */
function feedbackFor(scorePercent) {
    if (scorePercent >= 90) return 'Xuất sắc! Bạn đã nắm vững phần kiến thức này.';
    if (scorePercent >= 80) return 'Rất tốt! Hãy ôn lại những câu còn sai.';
    if (scorePercent >= 50) return 'Đã đạt. Xem phần giải thích để tránh lặp lại lỗi.';
    if (scorePercent > 0) return 'Chưa đạt. Ôn lại bài rồi thử lại nhé.';
    return 'Hãy đọc lại lý thuyết trước khi làm lại bài này.';
}

/** Có cần nhắc ôn tập không. */
function needsReview(scorePercent, threshold = env.SCORING.weakScoreThreshold) {
    return Number(scorePercent) < Number(threshold);
}

/**
 * Thống kê cấu trúc một đề theo loại câu hỏi — dùng cho màn hình xem trước đề.
 * @returns {object} map { single_choice: 2, essay: 1, ... }
 */
function summarizeTypes(questions = []) {
    const summary = {};
    for (const type of Object.values(QUESTION_TYPES)) summary[type] = 0;
    for (const question of questions) {
        if (question?.type && summary[question.type] !== undefined) summary[question.type] += 1;
    }
    return summary;
}

module.exports = {
    // Hàm chấm từng loại câu hỏi
    gradeSingleChoice,
    gradeMultipleChoice,
    gradeTrueFalse,
    gradeFillBlank,
    gradeShortAnswer,
    gradeNumeric,
    gradeEssay,
    gradeByType,
    GRADERS,

    // Chấm cả đề
    gradeExam,
    gradeQuestion,
    finalizeScores,

    // Tiện ích
    countWords,
    extractCorrectAnswer: examGrader.extractCorrectAnswer,
    feedbackFor,
    isAnswerCorrect,
    isBlank,
    isPassing,
    needsReview,
    normalizeAnswers: examGrader.normalizeAnswers,
    normalizeFreeText: value => normalizer.normalize(value, {
        trimWhitespace: true,
        caseInsensitive: true,
        stripDiacritics: true
    }),
    normalizeLabel: value => normalizer.normalize(value, { trimWhitespace: true, caseInsensitive: true }),
    normalizeLabelSet: value => normalizer.normalizeList(value, { trimWhitespace: true, caseInsensitive: true }),
    parseBoolean,
    roundPoints,
    summarizeTypes,
    toMaxPoints
};