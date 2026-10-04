'use strict';

/**
 * Tổng hợp kết quả chấm CẢ ĐỀ THI.
 *
 * Nguyên tắc bất di bất dịch:
 *   - Tách rõ `autoScore` (máy chấm) và `manualScore` (người chấm).
 *   - Còn câu chờ chấm -> `gradingStatus = pending_manual_grading`,
 *     `finalScore` KHÔNG được coi là kết luận cuối cùng.
 *   - Mọi phép cộng làm tròn ở 3 chữ số thập phân để không mất điểm lẻ.
 */

const { GRADING_STATUS, QUESTION_TYPES } = require('../../config/constants');
const graders = require('./question-graders');

const { gradeByType, roundPoints, toMaxPoints } = graders;

/** Điểm tối đa của một câu: ưu tiên điểm khai trong đề, sau đó mới tới điểm mặc định. */
function resolvePoints(examItem, question) {
    const fromExam = Number(examItem?.points);
    if (Number.isFinite(fromExam) && fromExam > 0) return fromExam;
    return toMaxPoints(question?.points);
}

/** Chấp nhận cả map lẫn mảng câu trả lời từ client. */
function normalizeAnswers(answers) {
    const map = new Map();
    if (Array.isArray(answers)) {
        for (const item of answers) {
            if (item && item.questionId !== undefined) map.set(String(item.questionId), item.answer);
        }
        return map;
    }
    if (answers && typeof answers === 'object') {
        for (const [key, value] of Object.entries(answers)) map.set(String(key), value);
    }
    return map;
}

/** Lấy đáp án đúng để lưu SERVER-SIDE, không phát tán ra client. */
function extractCorrectAnswer(question) {
    switch (question.type) {
        case QUESTION_TYPES.FILL_BLANK:
            return (question.blanks || []).map((blank, index) => ({
                blankId: blank.blankId ?? blank.id ?? `blank-${index + 1}`,
                correctAnswers: blank.correctAnswers || []
            }));
        case QUESTION_TYPES.TRUE_FALSE:
            if (Array.isArray(question.statements) && question.statements.length) {
                return question.statements.map((statement, index) => ({
                    statementId: statement.statementId ?? statement.id ?? `s${index + 1}`,
                    correctAnswer: statement.correctAnswer
                }));
            }
            return question.correctAnswer?.value ?? question.correctAnswer ?? null;
        case QUESTION_TYPES.ESSAY:
            // Tự luận KHÔNG có đáp án đúng máy đọc được -> không gửi gì.
            return null;
        case QUESTION_TYPES.SHORT_ANSWER:
            return question.acceptedAnswers || question.correctAnswer?.value || null;
        default:
            return question.correctAnswer?.value ?? question.correctAnswer ?? null;
    }
}

/**
 * Chấm toàn bộ bài.
 *
 * @param {Array}  questions câu hỏi ĐÃ NẠP KÈM ĐÁP ÁN (chỉ ở máy chủ).
 * @param {object} answers   map { questionId: đáp án học sinh } hoặc mảng answer.
 * @param {object} pointsMap map { questionId: điểm của câu trong đề }
 * @param {Array}  examItems mảng { questionId, points, order } của đề (tuỳ chọn)
 * @returns {object} kết quả đầy đủ
 */
function gradeExam(questions = [], answers = {}, pointsMap = {}, examItems = null) {
    const answerMap = normalizeAnswers(answers);
    const items = (Array.isArray(examItems) && examItems.length)
        ? examItems
        : questions.map(question => ({ questionId: question.questionId, points: pointsMap[question.questionId] }));

    const questionResults = [];
    let totalPoints = 0;
    let autoScore = 0;
    let correctQuestions = 0;
    let answeredQuestions = 0;
    let autoScoredQuestions = 0;
    let manualGradingQuestions = 0;
    let manualMaxPoints = 0;

    for (const item of items) {
        const question = questions.find(candidate => candidate.questionId === item.questionId);
        if (!question) continue;

        const maxPoints = resolvePoints(item, question);
        totalPoints = roundPoints(totalPoints + maxPoints);

        const studentAnswer = answerMap.has(question.questionId)
            ? answerMap.get(question.questionId)
            : null;
        const hasAnswer = !graders.isBlank(studentAnswer);
        if (hasAnswer) answeredQuestions += 1;

        const result = gradeByType(question, studentAnswer, maxPoints);

        if (result.needsManualGrading) {
            manualGradingQuestions += 1;
            manualMaxPoints = roundPoints(manualMaxPoints + maxPoints);
        } else {
            autoScoredQuestions += 1;
            autoScore = roundPoints(autoScore + result.awardedPoints);
            if (result.isCorrect) correctQuestions += 1;
        }

        questionResults.push({
            questionId: question.questionId,
            questionType: question.type,
            order: item.order ?? null,
            questionText: question.questionText,
            options: (question.options || []).map(option => ({ label: option.label, text: option.text })),
            // Đáp án đúng lưu SERVER-SIDE; client chỉ nhận sau khi đã nộp bài.
            correctAnswer: extractCorrectAnswer(question),
            studentAnswer,
            hasAnswer,
            isCorrect: result.isCorrect,
            awardedPoints: result.awardedPoints,
            maxPoints,
            needsManualGrading: result.needsManualGrading,
            manualScore: result.manualScore,
            manualFeedback: '',
            graderId: null,
            gradedAt: null,
            detail: result.detail,
            explanation: question.explanation || ''
        });
    }

    const totalQuestions = questionResults.length;
    const pendingManualGrading = manualGradingQuestions > 0;

    return {
        totalQuestions,
        answeredQuestions,
        unansweredQuestions: totalQuestions - answeredQuestions,
        correctQuestions,
        wrongQuestions: answeredQuestions - correctQuestions,
        autoScoredQuestions,
        manualGradingQuestions,
        totalPoints,
        autoScore,
        manualScore: 0,
        manualMaxPoints,
        // Điểm chốt hiện tại = điểm máy chấm (điểm chờ chấm chưa có).
        currentScore: autoScore,
        scorePercent: totalPoints > 0 ? Number(((autoScore / totalPoints) * 100).toFixed(1)) : 0,
        gradingStatus: pendingManualGrading
            ? GRADING_STATUS.PENDING_MANUAL_GRADING
            : GRADING_STATUS.GRADED,
        finalScoreStatus: pendingManualGrading ? 'pending' : 'final',
        // Tỉ lệ trên PHẦN ĐIỂM MÁY CHẤM ĐƯỢC, để học sinh vẫn thấy kết quả tạm thời.
        autoScoredPercent: (totalPoints - manualMaxPoints) > 0
            ? Number(((autoScore / (totalPoints - manualMaxPoints)) * 100).toFixed(1))
            : 0,
        questionResults
    };
}

/**
 * Tính lại điểm cuối sau khi người chấm đã chấm câu tự luận.
 * Không làm tròn sai; chỉ giới hạn trong [0, totalPoints].
 */
function finalizeScores(result, manualScores = {}) {
    const manualScore = roundPoints(Object.values(manualScores).reduce(
        (sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0),
        0
    ));
    // Chặn trên: điểm cuối không bao giờ vượt quá tổng điểm đề, dù admin nhập sai.
    const cappedManual = Math.min(manualScore, Math.max(0, result.totalPoints - result.autoScore));
    const totalScore = roundPoints(result.autoScore + cappedManual);
    const remaining = (result.questionResults || []).filter(
        item => item.needsManualGrading && manualScores[item.questionId] === undefined
    ).length;

    return {
        ...result,
        manualScore,
        totalScore,
        currentScore: totalScore,
        scorePercent: result.totalPoints > 0
            ? Number(((totalScore / result.totalPoints) * 100).toFixed(1))
            : 0,
        gradingStatus: remaining > 0
            ? GRADING_STATUS.PENDING_MANUAL_GRADING
            : GRADING_STATUS.GRADED,
        finalScoreStatus: remaining > 0 ? 'pending' : 'final'
    };
}

module.exports = {
    extractCorrectAnswer,
    finalizeScores,
    gradeExam,
    normalizeAnswers,
    resolvePoints
};