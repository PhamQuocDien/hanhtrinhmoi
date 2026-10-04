'use strict';

/**
 * NGHIỆP VỤ CHẤM TAY — bảng điều khiển "Bài cần chấm" của quản trị viên.
 *
 * Luồng:
 *   Học sinh nộp bài (có câu tự luận)
 *      -> attempt.gradingStatus = pending_manual_grading
 *      -> vào danh sách chờ chấm
 *      -> admin mở bài làm, xem câu + rubric + bài học sinh
 *      -> nhập điểm + nhận xét -> lưu
 *      -> khi chấm đủ câu chờ -> gradingStatus = graded, chốt điểm cuối
 *
 * Nguyên tắc:
 *   - Chỉ admin được chấm. `graderId` lấy từ SESSION, không lấy từ request body.
 *   - Điểm người chấm được chặn trên theo `maxPoints` của câu.
 *   - Chấm xong câu này KHÔNG đụng tới kết quả máy đã chấm.
 */

const Attempt = require('../models/attempt.model');
const Exam = require('../models/exam.model');
const Question = require('../models/question.model');
const scoring = require('./scoring.service');
const logger = require('../utils/logger');
const {
    ATTEMPT_STATUS,
    GRADING_STATUS,
    MANUAL_GRADING_TYPES
} = require('../config/constants');

/** Một câu chờ chấm được mô tả cho danh sách. */
function toQueueItem(attempt, exam, result) {
    return {
        attemptId: attempt.attemptId,
        username: attempt.username,
        grade: attempt.grade,
        subjectId: attempt.subjectId,
        examId: attempt.examId,
        examTitle: exam?.title || 'Đề thi',
        submittedAt: attempt.submittedAt,
        questionId: result.questionId,
        questionType: result.questionType,
        questionText: result.questionText,
        questionNumber: result.order,
        maxPoints: result.maxPoints,
        studentAnswer: result.studentAnswer,
        // Số từ / cảnh báo độ dài để người chấm đánh giá nhanh.
        wordCount: result.detail?.wordCount ?? null,
        characterCount: result.detail?.characterCount ?? null,
        warnings: result.detail?.warnings || []
    };
}

/**
 * Danh sách câu đang chờ chấm.
 *
 * @param {object} options { grade, subjectId, examId, username, page, pageSize }
 */
async function listPendingGrading(options = {}) {
    const { grade, subjectId, examId, username, page = 1, pageSize = 20 } = options;

    const filter = {
        requiresManualGrading: true,
        submittedAt: { $ne: null },
        'questionResults.needsManualGrading': true,
        // manualScore = null nghĩa là câu chưa được chấm.
        'questionResults.manualScore': null
    };
    if (grade) filter.grade = Number(grade);
    if (subjectId) filter.subjectId = String(subjectId);
    if (examId) filter.examId = String(examId);
    if (username) filter.username = String(username);

    const skip = Math.max(0, (page - 1) * pageSize);
    const [attempts, total] = await Promise.all([
        Attempt.find(filter)
            .sort({ submittedAt: 1 })
            .skip(skip)
            .limit(pageSize)
            .lean(),
        Attempt.countDocuments(filter)
    ]);

    if (!attempts.length) {
        return { items: [], total: 0, page, pageSize };
    }

    const exams = await Exam.find({
        examId: { $in: [...new Set(attempts.map(item => item.examId))] }
    }).select('examId title').lean();
    const examById = new Map(exams.map(exam => [exam.examId, exam]));

    // Mỗi lượt làm bài có thể có nhiều câu chờ chấm — đưa hết ra danh sách.
    const items = attempts.flatMap(attempt => attempt.questionResults
        .filter(result => result.needsManualGrading && result.manualScore === null)
        .map(result => toQueueItem(attempt, examById.get(attempt.examId), result)));

    return { items, total, page, pageSize };
}

/** Số lượng câu chờ chấm theo lớp/môn — cho biểu đồ trên trang quản trị. */
async function getQueueStats(filter = {}) {
    const match = {
        requiresManualGrading: true,
        submittedAt: { $ne: null },
        'questionResults.needsManualGrading': true,
        'questionResults.manualScore': null
    };
    if (filter.grade) match.grade = Number(filter.grade);
    if (filter.subjectId) match.subjectId = String(filter.subjectId);

    const [byGrade, bySubject, byType] = await Promise.all([
        Attempt.aggregate([
            { $match: match },
            { $unwind: '$questionResults' },
            { $match: { 'questionResults.manualScore': null, 'questionResults.needsManualGrading': true } },
            { $group: { _id: '$grade', count: { $sum: 1 } } }
        ]),
        Attempt.aggregate([
            { $match: match },
            { $unwind: '$questionResults' },
            { $match: { 'questionResults.manualScore': null, 'questionResults.needsManualGrading': true } },
            { $group: { _id: '$subjectId', count: { $sum: 1 } } }
        ]),
        Attempt.aggregate([
            { $match: match },
            { $unwind: '$questionResults' },
            { $match: { 'questionResults.manualScore': null, 'questionResults.needsManualGrading': true } },
            { $group: { _id: '$questionResults.questionType', count: { $sum: 1 } } }
        ])
    ]);

    return {
        total: byGrade.reduce((sum, row) => sum + row.count, 0),
        byGrade: Object.fromEntries(byGrade.map(row => [row._id, row.count])),
        bySubject: Object.fromEntries(bySubject.map(row => [row._id, row.count])),
        byType: Object.fromEntries(byType.map(row => [row._id ?? 'unknown', row.count]))
    };
}

/**
 * Mở một bài làm để chấm: trả về đề, câu hỏi, rubric và toàn bộ bài làm.
 */
async function getGradingSheet({ attemptId, username = null }) {
    const filter = { attemptId: String(attemptId || '') };
    if (username) filter.username = String(username);

    const attempt = await Attempt.findOne(filter).lean();
    if (!attempt) return { error: 'NOT_FOUND', message: 'Không tìm thấy lượt làm bài.' };

    const exam = await Exam.findOne({ examId: attempt.examId }).lean();
    if (!exam) return { error: 'NOT_FOUND', message: 'Không tìm thấy đề thi.' };

    // Nạp câu hỏi gốc để lấy rubric (kết quả lúc nộp không lưu rubric).
    const questionIds = [...new Set(attempt.questionResults.map(item => item.questionId))];
    const questions = await Question.find({ questionId: { $in: questionIds } })
        .select('questionId type rubric minWords maxWords questionText')
        .lean();
    const questionById = new Map(questions.map(question => [question.questionId, question]));

    return {
        attemptId: attempt.attemptId,
        username: attempt.username,
        grade: attempt.grade,
        subjectId: attempt.subjectId,
        exam: {
            examId: exam.examId,
            title: exam.title,
            totalPoints: attempt.totalPoints,
            autoScore: attempt.autoScore,
            manualScore: attempt.manualScore,
            totalScore: attempt.totalScore,
            scorePercent: attempt.scorePercent,
            passScorePercent: exam.passScorePercent,
            gradingStatus: attempt.gradingStatus
        },
        submittedAt: attempt.submittedAt,
        questions: attempt.questionResults.map(result => {
            const question = questionById.get(result.questionId);
            const pending = result.needsManualGrading && result.manualScore === null;
            return {
                questionId: result.questionId,
                order: result.order,
                questionType: result.questionType,
                questionText: result.questionText,
                options: result.options,
                maxPoints: result.maxPoints,
                studentAnswer: result.studentAnswer,
                awardedPoints: result.awardedPoints,
                isCorrect: result.isCorrect,
                pendingGrading: pending,
                manualScore: result.manualScore,
                manualFeedback: result.manualFeedback || '',
                // Rubric do admin soạn — người chấm cần để chấm nhất quán.
                rubric: question?.rubric?.length ? question.rubric : (result.detail?.rubric || []),
                minWords: question?.minWords ?? null,
                maxWords: question?.maxWords ?? null,
                detail: result.detail || {}
            };
        })
    };
}

/**
 * Chấm MỘT câu tự luận.
 *
 * `graderId` PHẢI lấy từ session phía máy chủ — không bao giờ tin request body.
 * @returns kết quả, hoặc lỗi có mã để controller trả về.
 */
async function gradeQuestion({ attemptId, questionId, score, feedback = '', graderId }) {
    const attempt = await Attempt.findOne({ attemptId: String(attemptId || '') });
    if (!attempt) return { error: 'NOT_FOUND', message: 'Không tìm thấy lượt làm bài.' };
    if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
        return { error: 'NOT_SUBMITTED', message: 'Học sinh chưa nộp bài.' };
    }

    const result = attempt.questionResults.find(item => item.questionId === String(questionId));
    if (!result) return { error: 'NOT_FOUND', message: 'Không tìm thấy câu hỏi trong bài làm.' };
    if (!result.needsManualGrading) {
        return { error: 'NOT_MANUAL', message: 'Câu này được máy chấm, không cần chấm tay.' };
    }
    if (result.manualScore !== null && result.manualScore !== undefined) {
        return { error: 'ALREADY_GRADED', message: 'Câu này đã được chấm.' };
    }

    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0) {
        return { error: 'INVALID_SCORE', message: 'Điểm phải là số không âm.' };
    }
    // Chặn trên: không thể cho điểm vượt quá điểm tối đa của câu.
    if (numericScore > result.maxPoints) {
        return {
            error: 'SCORE_TOO_HIGH',
            message: `Điểm không được vượt quá ${result.maxPoints} điểm của câu này.`
        };
    }

    const now = new Date();
    result.manualScore = scoring.roundPoints(numericScore);
    result.manualFeedback = String(feedback || '').slice(0, 2000);
    result.graderId = String(graderId || '');
    result.gradedAt = now;

    return finalizeAttempt(attempt, { graderId: String(graderId || ''), now });
}

/**
 * Tính lại điểm cuối của lượt làm bài sau mỗi lần chấm.
 *
 * `autoScore` KHÔNG đổi — điểm máy chấm là chốt. `manualScore` cộng dồn từ các
 * câu đã chấm, không cộng dồn khoáy mỗi lần lưu (tránh chấm hai lần cộng hai lần).
 */
async function finalizeAttempt(attempt, { graderId, now, passScorePercent = 50 }) {
    const manualScores = {};
    for (const result of attempt.questionResults) {
        if (result.needsManualGrading && result.manualScore !== null && result.manualScore !== undefined) {
            manualScores[result.questionId] = result.manualScore;
        }
    }

    const pendingCount = attempt.questionResults.filter(
        item => item.needsManualGrading && (item.manualScore === null || item.manualScore === undefined)
    ).length;

    const final = scoring.finalizeScores(
        { autoScore: attempt.autoScore, totalPoints: attempt.totalPoints },
        manualScores
    );

    attempt.manualScore = final.manualScore;
    attempt.totalScore = final.totalScore;
    attempt.earnedPoints = final.totalScore;
    attempt.scorePercent = final.scorePercent;
    attempt.gradingStatus = final.gradingStatus;
    attempt.requiresManualGrading = final.gradingStatus === GRADING_STATUS.PENDING_MANUAL_GRADING;
    attempt.status = attempt.requiresManualGrading
        ? ATTEMPT_STATUS.SUBMITTED
        : ATTEMPT_STATUS.GRADED;
    // Chỉ kết luận đạt/không đạt khi đã chấm xong hết.
    attempt.passed = attempt.requiresManualGrading
        ? false
        : final.scorePercent >= Number(passScorePercent);

    if (!attempt.requiresManualGrading) {
        attempt.gradedAt = now;
        attempt.gradedBy = graderId;
    }

    await attempt.save();

    return {
        attemptId: attempt.attemptId,
        graded: true,
        manualScore: attempt.manualScore,
        totalScore: attempt.totalScore,
        scorePercent: attempt.scorePercent,
        gradingStatus: attempt.gradingStatus,
        passed: attempt.passed,
        pendingCount,
        finalScoreStatus: final.finalScoreStatus,
        message: attempt.requiresManualGrading
            ? `Đã lưu điểm. Còn ${pendingCount} câu chờ chấm.`
            : 'Đã chấm xong toàn bộ bài.'
    };
}

/** Chấm nhiều câu một lúc (tiện khi một bài có nhiều câu tự luận). */
async function gradeBulk({ attemptId, grades = [], graderId }) {
    const attempt = await Attempt.findOne({ attemptId: String(attemptId || '') });
    if (!attempt) return { error: 'NOT_FOUND', message: 'Không tìm thấy lượt làm bài.' };

    const now = new Date();
    const applied = [];
    const skipped = [];

    for (const item of grades) {
        const result = attempt.questionResults.find(
            entry => entry.questionId === String(item.questionId)
        );
        if (!result || !result.needsManualGrading) {
            skipped.push({ questionId: item.questionId, reason: 'KHÔNG_CẦN_CHẤM_TAY' });
            continue;
        }
        if (result.manualScore !== null && result.manualScore !== undefined) {
            skipped.push({ questionId: item.questionId, reason: 'ĐÃ_CHẤM_RỒI' });
            continue;
        }
        const numericScore = Number(item.score);
        if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > result.maxPoints) {
            skipped.push({ questionId: item.questionId, reason: 'ĐIỂM_KHÔNG_HỢP_LỆ' });
            continue;
        }
        result.manualScore = scoring.roundPoints(numericScore);
        result.manualFeedback = String(item.feedback || '').slice(0, 2000);
        result.graderId = String(graderId || '');
        result.gradedAt = now;
        applied.push(item.questionId);
    }

    const summary = await finalizeAttempt(attempt, { graderId: String(graderId || ''), now });
    logger.info(`Chấm tay ${applied.length} câu của lượt ${attemptId} bởi ${graderId}.`);

    return { ...summary, applied, skipped };
}

/** Các loại câu hỗ trợ chấm tay — dùng cho bộ lọc trên UI. */
function manualGradingTypes() {
    return [...MANUAL_GRADING_TYPES];
}

module.exports = {
    MANUAL_GRADING_TYPES,
    finalizeAttempt,
    getGradingSheet,
    getQueueStats,
    gradeBulk,
    gradeQuestion,
    listPendingGrading,
    manualGradingTypes
};