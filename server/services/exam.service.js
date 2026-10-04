'use strict';

/**
 * Nghiệp vụ đề thi cho HỌC SINH.
 *
 * Quy tắc bất di bất dịch:
 *   1. Chỉ đề PUBLISHED mới hiện và được làm.
 *   2. Đề chỉ trả về questionId / nội dung / lựa chọn / hình — TUYỆT ĐỐI KHÔNG
 *      có correctAnswer hay explanation trước khi học sinh nộp bài.
 *   3. Điểm luôn do máy chủ tính. Client chỉ gửi câu trả lời.
 *   4. Hết giờ hoặc vượt thời gian cho phép thì từ chối chấm, không cho điểm ảo.
 */

const mongoose = require('mongoose');
const Exam = require('../models/exam.model');
const Attempt = require('../models/attempt.model');
const questionService = require('./question.service');
const scoring = require('./scoring.service');
const env = require('../config/env');
const { EXAM_STATUS, ATTEMPT_STATUS, GRADING_STATUS } = require('../config/constants');

/** Kiểm tra định danh hợp lệ để tránh truy vấn với rác. */
function isValidId(value) {
    return mongoose.isValidObjectId(String(value || ''));
}

/** Danh sách đề công khai cho học sinh, lọc theo lớp/môn/bài. */
async function listAvailableExams({ grade, subjectId, lessonId } = {}) {
    const filter = { status: EXAM_STATUS.PUBLISHED };
    if (grade) filter.grade = Number(grade);
    if (subjectId) filter.subjectId = String(subjectId);
    if (lessonId) filter.lessonId = String(lessonId);

    const exams = await Exam.find(filter).sort({ publishedAt: -1 }).limit(100);
    return exams.map(exam => ({
        ...exam.toStudentInfo(),
        attemptCount: exam.attemptCount,
        averageScorePercent: exam.averageScorePercent
    }));
}

/** Lấy thông tin một đề đã publish. */
async function getExamInfo(examId) {
    const exam = await Exam.findOne({ examId: String(examId || ''), status: EXAM_STATUS.PUBLISHED });
    return exam ? exam.toStudentInfo() : null;
}

/**
 * Bắt đầu làm bài.
 *
 * Nạp câu hỏi kèm đáp án ở máy chủ, rồi mới cắt phần trả cho học sinh bằng
 * `toStudentView` — đảm bảo đáp án không bao giờ lọt ra ngoài.
 */
async function startAttempt({ examId, username }) {
    const exam = await Exam.findOne({ examId: String(examId || ''), status: EXAM_STATUS.PUBLISHED });
    if (!exam) return { error: 'NOT_FOUND', message: 'Không tìm thấy đề thi.' };

    const questions = await questionService.findQuestionsWithAnswers(exam.questions.map(item => item.questionId));
    const byId = new Map(questions.map(question => [question.questionId, question]));

    // Giữ đúng thứ tự đã trộn sẵn trong đề.
    const ordered = exam.questions
        .map((item, index) => {
            const question = byId.get(item.questionId);
            return question ? { question, item, order: index + 1 } : null;
        })
        .filter(Boolean);

    if (!ordered.length) {
        return { error: 'EMPTY_EXAM', message: 'Đề thi chưa có câu hỏi hợp lệ.' };
    }

    const attempt = await Attempt.create({
        attemptId: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        examId: exam.examId,
        examRef: exam._id,
        username,
        grade: exam.grade,
        subjectId: exam.subjectId,
        status: ATTEMPT_STATUS.IN_PROGRESS,
        startedAt: new Date(),
        durationLimitSeconds: exam.durationMinutes * 60,
        questionCount: ordered.length,
        totalPoints: exam.totalPoints
    });

    return {
        attemptId: attempt.attemptId,
        exam: exam.toStudentInfo(),
        durationSeconds: exam.durationLimitSeconds,
        questions: ordered.map(({ question, item, order }) => ({
            ...question.toStudentView(),
            order,
            points: item.points
        }))
    };
}

/**
 * Nộp bài và chấm điểm ở máy chủ.
 *
 * Điểm máy chấm (`autoScore`) và điểm người chấm (`manualScore`) được TÁCH RIÊNG.
 * Còn câu tự luận chưa chấm -> `gradingStatus = pending_manual_grading`, học sinh
 * thấy "đã chấm tự động 7/7, còn 3 điểm tự luận đang chờ chấm".
 *
 * @returns kết quả kèm giải thích, hoặc lỗi có mã để controller trả về.
 */
async function submitAttempt({ attemptId, username, answers }) {
    const attempt = await Attempt.findOne({ attemptId: String(attemptId || ''), username });
    if (!attempt) return { error: 'NOT_FOUND', message: 'Không tìm thấy lượt làm bài.' };

    // Chống nộp trùng.
    if (attempt.isSubmitted()) {
        return { error: 'ALREADY_SUBMITTED', message: 'Bài này đã được nộp trước đó.' };
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    // Cho thêm 60 giây làm phần thao tác kết thúc.
    if (elapsedSeconds > attempt.durationLimitSeconds + 60) {
        attempt.status = ATTEMPT_STATUS.EXPIRED;
        attempt.submittedAt = new Date();
        await attempt.save();
        return { error: 'TIME_EXPIRED', message: 'Đã quá thời gian làm bài. Lượt này không được tính điểm.' };
    }

    const exam = await Exam.findById(attempt.examRef);
    if (!exam) return { error: 'NOT_FOUND', message: 'Không tìm thấy đề thi.' };

    // Nạp đáp án đúng ở máy chủ rồi chấm.
    const questions = await questionService.findQuestionsWithAnswers(
        exam.questions.map(item => item.questionId)
    );
    const pointsByQuestion = Object.fromEntries(
        exam.questions.map(item => [item.questionId, item.points])
    );

    // `gradeExam` bỏ qua mọi trường score/isCorrect client gửi lên.
    const result = scoring.gradeExam(questions, answers || {}, pointsByQuestion, exam.questions);
    const pendingManual = result.gradingStatus === GRADING_STATUS.PENDING_MANUAL_GRADING;
    // Còn câu chờ người chấm thì CHƯA kết luận đạt/không đạt.
    const passed = pendingManual ? false : scoring.isPassing(result.scorePercent, exam.passScorePercent);

    attempt.submittedAt = new Date();
    attempt.timeSpentSeconds = Math.max(0, elapsedSeconds);
    attempt.totalPoints = result.totalPoints;
    attempt.autoScore = result.autoScore;
    attempt.manualScore = 0;
    attempt.totalScore = result.autoScore;
    attempt.earnedPoints = result.autoScore;
    attempt.scorePercent = result.scorePercent;
    attempt.correctCount = result.correctQuestions;
    attempt.wrongCount = result.wrongQuestions;
    attempt.answeredCount = result.answeredQuestions;
    attempt.questionCount = result.totalQuestions;
    attempt.autoScoredCount = result.autoScoredQuestions;
    attempt.manualGradingCount = result.manualGradingQuestions;
    attempt.requiresManualGrading = pendingManual;
    attempt.gradingStatus = result.gradingStatus;
    attempt.status = pendingManual ? ATTEMPT_STATUS.SUBMITTED : ATTEMPT_STATUS.GRADED;
    attempt.passed = passed;
    attempt.questionResults = result.questionResults;
    await attempt.save();

    // Cập nhật thống kê đề bằng $inc để không mất số liệu khi có nhiều lượt song song.
    await Exam.updateOne(
        { _id: exam._id },
        { $inc: { attemptCount: 1 }, $set: { updatedAt: new Date() } }
    );
    await recalculateExamAverage(exam._id);

    return {
        attemptId: attempt.attemptId,
        exam: exam.toStudentInfo(),
        result: {
            ...result,
            passed,
            feedback: scoring.feedbackFor(result.scorePercent),
            needsReview: scoring.needsReview(result.scorePercent),
            timeSpentSeconds: attempt.timeSpentSeconds
        }
    };
}

/**
 * Lưu nháp câu trả lời (autosave).
 *
 * KHÔNG chấm điểm ở bước này — chỉ lưu để học sinh tải lại trang vẫn còn bài làm.
 * Chỉ lượt CHƯA NỘP mới được ghi đè.
 */
async function saveDraftAnswers({ attemptId, username, answers }) {
    const attempt = await Attempt.findOne({ attemptId: String(attemptId || ''), username });
    if (!attempt) return { error: 'NOT_FOUND', message: 'Không tìm thấy lượt làm bài.' };
    if (attempt.isSubmitted()) {
        return { error: 'ALREADY_SUBMITTED', message: 'Bài đã nộp, không thể sửa nháp.' };
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    if (elapsedSeconds > attempt.durationLimitSeconds + 60) {
        return { error: 'TIME_EXPIRED', message: 'Đã quá thời gian làm bài.' };
    }

    const normalized = scoring.normalizeAnswers(answers);
    attempt.draftAnswers = [...normalized.entries()].map(([questionId, answer]) => ({
        questionId,
        answer
    }));
    attempt.lastSavedAt = new Date();
    await attempt.save();

    return {
        attemptId: attempt.attemptId,
        savedCount: attempt.draftAnswers.length,
        remainingSeconds: Math.max(0, attempt.durationLimitSeconds - elapsedSeconds),
        savedAt: attempt.lastSavedAt
    };
}

/** Lấy lại nháp câu trả lời khi học sinh quay lại làm tiếp. */
async function getDraftAnswers({ attemptId, username }) {
    const attempt = await Attempt.findOne({ attemptId: String(attemptId || ''), username });
    if (!attempt) return { error: 'NOT_FOUND', message: 'Không tìm thấy lượt làm bài.' };
    if (attempt.isSubmitted()) return { error: 'ALREADY_SUBMITTED', message: 'Bài đã nộp.' };

    const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    return {
        attemptId: attempt.attemptId,
        answers: attempt.draftAnswers || [],
        remainingSeconds: Math.max(0, attempt.durationLimitSeconds - elapsedSeconds),
        startedAt: attempt.startedAt,
        durationLimitSeconds: attempt.durationLimitSeconds
    };
}

/** Tính lại điểm trung bình của một đề từ các lượt đã nộp. */
async function recalculateExamAverage(examRef) {
    const stats = await Attempt.aggregate([
        { $match: { examRef, status: { $in: [ATTEMPT_STATUS.GRADED, ATTEMPT_STATUS.SUBMITTED] } } },
        { $group: { _id: null, average: { $avg: '$scorePercent' } } }
    ]);
    if (!stats.length) return;
    await Exam.updateOne(
        { _id: examRef },
        { $set: { averageScorePercent: Number(stats[0].average.toFixed(1)) } }
    );
}

/** Lịch sử làm bài của một học sinh. */
async function listHistory(username, { page = 1, pageSize = 20 } = {}) {
    const skip = Math.max(0, (page - 1) * pageSize);
    const [items, total] = await Promise.all([
        Attempt.find({ username, submittedAt: { $ne: null } })
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(pageSize),
        Attempt.countDocuments({ username, submittedAt: { $ne: null } })
    ]);

    // Gắn tên đề để lịch sử dễ đọc.
    const exams = await Exam.find({ examId: { $in: [...new Set(items.map(item => item.examId))] } })
        .select('examId title subjectId difficulty')
        .lean();
    const byId = new Map(exams.map(exam => [exam.examId, exam]));

    return {
        items: items.map(item => ({
            ...item.toHistoryItem(),
            examTitle: byId.get(item.examId)?.title || 'Đề thi',
            examDifficulty: byId.get(item.examId)?.difficulty || null
        })),
        total,
        page,
        pageSize
    };
}

/**
 * Chi tiết một lượt làm bài (kèm giải thích — chỉ sau khi đã nộp).
 *
 * Kết quả đã được chấm và lưu lúc nộp bài nên không cần nạp lại câu hỏi.
 * Câu tự luận chưa chấm hiển thị "chờ chấm" thay vì điểm 0 — 0 điểm và
 * "chưa chấm" là hai điều khác nhau, không được nhập làm một.
 */
async function getAttemptDetail(attemptId, username) {
    const attempt = await Attempt.findOne({ attemptId: String(attemptId || ''), username }).lean();
    if (!attempt) return null;

    const exam = await Exam.findOne({ examId: attempt.examId });
    if (!exam) return null;

    const results = Array.isArray(attempt.questionResults) ? attempt.questionResults : [];
    const resultById = new Map(results.map(item => [item.questionId, item]));

    return {
        attemptId: attempt.attemptId,
        exam: exam.toStudentInfo(),
        submittedAt: attempt.submittedAt,
        timeSpentSeconds: attempt.timeSpentSeconds,
        totalPoints: attempt.totalPoints,
        autoScore: attempt.autoScore,
        manualScore: attempt.manualScore,
        totalScore: attempt.totalScore ?? attempt.earnedPoints ?? 0,
        scorePercent: attempt.scorePercent,
        gradingStatus: attempt.gradingStatus || GRADING_STATUS.PENDING,
        finalScoreStatus: attempt.gradingStatus === GRADING_STATUS.PENDING_MANUAL_GRADING
            ? 'pending'
            : 'final',
        requiresManualGrading: attempt.requiresManualGrading,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount ?? 0,
        answeredCount: attempt.answeredCount ?? 0,
        passed: attempt.passed,
        feedback: scoring.feedbackFor(attempt.scorePercent),
        questions: exam.questions
            .map((item, index) => {
                const result = resultById.get(item.questionId);
                if (!result) return null;
                const pending = result.needsManualGrading && result.manualScore === null;
                return {
                    questionId: item.questionId,
                    order: index + 1,
                    questionType: result.questionType,
                    questionText: result.questionText,
                    options: result.options || [],
                    maxPoints: result.maxPoints,
                    studentAnswer: result.studentAnswer,
                    correctAnswer: result.correctAnswer,
                    explanation: result.explanation || '',
                    isCorrect: pending ? null : result.isCorrect,
                    awardedPoints: pending ? null : result.awardedPoints,
                    pendingGrading: pending,
                    manualScore: pending ? null : result.manualScore,
                    manualFeedback: result.manualFeedback || '',
                    detail: result.detail || {}
                };
            })
            .filter(Boolean)
    };
}

/** Xoá một lượt làm bài chưa nộp (khi học sinh bỏ dở). */
async function abandonAttempt(attemptId, username) {
    const result = await Attempt.deleteOne({
        attemptId: String(attemptId || ''),
        username,
        status: ATTEMPT_STATUS.IN_PROGRESS
    });
    return result.deletedCount || 0;
}

/** Số câu tối đa cho một đề, theo cấu hình. */
function maxQuestions() {
    return env.SCORING.maxQuestionsPerExam;
}

module.exports = {
    abandonAttempt,
    getAttemptDetail,
    getDraftAnswers,
    getExamInfo,
    isValidId,
    listAvailableExams,
    listHistory,
    maxQuestions,
    recalculateExamAverage,
    saveDraftAnswers,
    startAttempt,
    submitAttempt
};