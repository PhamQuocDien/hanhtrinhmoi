'use strict';

/**
 * Lượt làm bài của một học sinh.
 *
 * Điểm luôn do máy chủ tính và lưu tại đây. Lưu cả `answersSnapshot` để có thể
 * đối chiếu lại sau này, nhưng KHÔNG gửi đáp án đúng xuống trình duyệt trước
 * khi nộp bài.
 */

const mongoose = require('mongoose');
const { ATTEMPT_STATUS, GRADING_STATUS } = require('../config/constants');

/**
 * Kết quả MỘT CÂU sau khi chấm. Lưu đủ để chấm lại và hiển thị kết quả mà
 * không cần nạp lại câu hỏi gốc.
 *
 * `correctAnswer` cố tình lưu ở phía máy chủ: kết quả chỉ trả về cho học sinh
 * SAU KHI đã nộp bài, không bao giờ gửi lúc đang làm bài.
 */
const questionResultSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    questionType: { type: String, required: true },
    order: { type: Number, default: null },

    // Bản chụp nội dung câu để kết quả không đổi khi admin sửa câu gốc.
    questionText: { type: String, default: '', maxlength: 8000 },
    options: { type: [mongoose.Schema.Types.Mixed], default: [] },

    // Đáp án đúng — CHỈ ở phía máy chủ.
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },

    // Câu trả lời của học sinh.
    studentAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    hasAnswer: { type: Boolean, default: false },

    isCorrect: { type: Boolean, default: false },
    awardedPoints: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 0 },

    // ---- Phần chấm tay ----
    needsManualGrading: { type: Boolean, default: false, index: true },
    // null = chưa chấm; số = đã chấm xong.
    manualScore: { type: Number, default: null },
    manualFeedback: { type: String, maxlength: 2000, default: '' },
    graderId: { type: String, default: null },
    gradedAt: { type: Date, default: null },

    // Chi tiết riêng theo loại (kết quả từng ô trống, từng ý Đúng/Sai, số từ...).
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
    explanation: { type: String, maxlength: 5000, default: '' }
}, { _id: false });

/** Nháp câu trả lời khi học sinh chưa nộp (autosave). */
const draftAnswerSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    answer: { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: false });

const attemptSchema = new mongoose.Schema({
    attemptId: { type: String, required: true, unique: true, index: true },
    examId: { type: String, required: true, index: true },
    examRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    subjectId: { type: String, required: true },

    status: { type: String, enum: Object.values(ATTEMPT_STATUS), default: ATTEMPT_STATUS.IN_PROGRESS, index: true },
    // Trạng thái chấm điểm tách khỏi trạng thái lượt làm bài.
    gradingStatus: {
        type: String,
        enum: Object.values(GRADING_STATUS),
        default: GRADING_STATUS.PENDING,
        index: true
    },

    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    durationLimitSeconds: { type: Number, required: true, min: 1 },
    // Thời gian học sinh thực sự làm bài, tính bằng giây.
    timeSpentSeconds: { type: Number, default: 0, min: 0 },
    lastSavedAt: { type: Date, default: null },

    // ---- Điểm ----
    totalPoints: { type: Number, default: 0, min: 0 },
    // Điểm máy chấm được.
    autoScore: { type: Number, default: 0, min: 0 },
    // Điểm người chấm cho câu tự luận.
    manualScore: { type: Number, default: 0, min: 0 },
    // Điểm cuối = autoScore + manualScore.
    totalScore: { type: Number, default: 0, min: 0 },
    // Giữ lại tên cũ để code đang chạy không hỏng; luôn bằng totalScore.
    earnedPoints: { type: Number, default: 0, min: 0 },
    scorePercent: { type: Number, default: 0, min: 0, max: 100 },

    // ---- Thống kê câu hỏi ----
    questionCount: { type: Number, default: 0, min: 0 },
    answeredCount: { type: Number, default: 0, min: 0 },
    correctCount: { type: Number, default: 0, min: 0 },
    wrongCount: { type: Number, default: 0, min: 0 },
    autoScoredCount: { type: Number, default: 0, min: 0 },
    manualGradingCount: { type: Number, default: 0, min: 0 },

    passed: { type: Boolean, default: false },

    // Nháp câu trả lời (chỉ dùng khi chưa nộp).
    draftAnswers: { type: [draftAnswerSchema], default: [] },
    // Kết quả chấm chi tiết từng câu, lưu lúc nộp bài.
    questionResults: { type: [questionResultSchema], default: [] },

    requiresManualGrading: { type: Boolean, default: false, index: true },
    gradedAt: { type: Date, default: null },
    gradedBy: { type: String, default: null }
}, { timestamps: true, collection: 'attempts' });

attemptSchema.index({ username: 1, examId: 1, createdAt: -1 });
attemptSchema.index({ username: 1, submittedAt: -1 });
attemptSchema.index({ status: 1, requiresManualGrading: 1 });
attemptSchema.index({ 'questionResults.needsManualGrading': 1, 'questionResults.manualScore': 1 });

/** Lượt đã nộp chưa. */
attemptSchema.methods.isSubmitted = function isSubmitted() {
    return this.status !== ATTEMPT_STATUS.IN_PROGRESS;
};

/** Còn câu nào đang chờ người chấm không. */
attemptSchema.methods.hasPendingManualGrading = function hasPendingManualGrading() {
    return this.questionResults.some(
        item => item.needsManualGrading && (item.manualScore === null || item.manualScore === undefined)
    );
};

/**
 * Tổng quan cho danh sách lịch sử (không kèm chi tiết từng câu).
 * Có nhãn trạng thái tiếng Việt để UI hiển thị đúng.
 */
attemptSchema.methods.toHistoryItem = function toHistoryItem() {
    const pending = this.gradingStatus === GRADING_STATUS.PENDING_MANUAL_GRADING;
    return {
        attemptId: this.attemptId,
        examId: this.examId,
        grade: this.grade,
        subjectId: this.subjectId,
        status: this.status,
        gradingStatus: this.gradingStatus,
        finalScoreStatus: pending ? 'pending' : 'final',
        totalPoints: this.totalPoints,
        autoScore: this.autoScore,
        manualScore: this.manualScore,
        totalScore: this.totalScore ?? this.earnedPoints,
        scorePercent: this.scorePercent,
        correctCount: this.correctCount,
        wrongCount: this.wrongCount,
        answeredCount: this.answeredCount,
        questionCount: this.questionCount,
        manualGradingCount: this.manualGradingCount,
        passed: this.passed,
        timeSpentSeconds: this.timeSpentSeconds,
        submittedAt: this.submittedAt,
        requiresManualGrading: this.requiresManualGrading,
        gradingLabel: pending ? 'Đang chờ chấm' : 'Đã chấm xong'
    };
};

module.exports = mongoose.models.Attempt || mongoose.model('Attempt', attemptSchema);
