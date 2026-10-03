'use strict';

/**
 * Lượt làm bài của một học sinh.
 *
 * Điểm luôn do máy chủ tính và lưu tại đây. Lưu cả `answersSnapshot` để có thể
 * đối chiếu lại sau này, nhưng KHÔNG gửi đáp án đúng xuống trình duyệt trước
 * khi nộp bài.
 */

const mongoose = require('mongoose');
const { ATTEMPT_STATUS } = require('../config/constants');

const answeredQuestionSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    // Câu trả lời của học sinh, dạng thô (chuỗi / mảng / số).
    answer: { type: mongoose.Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, default: null },
    awardedPoints: { type: Number, default: 0, min: 0 },
    // Ghi chú của người chấm cho câu cần chấm tay.
    graderComment: { type: String, maxlength: 2000, default: '' }
}, { _id: false });

const attemptSchema = new mongoose.Schema({
    attemptId: { type: String, required: true, unique: true, index: true },
    examId: { type: String, required: true, index: true },
    examRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    subjectId: { type: String, required: true },

    status: { type: String, enum: Object.values(ATTEMPT_STATUS), default: ATTEMPT_STATUS.IN_PROGRESS, index: true },

    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    durationLimitSeconds: { type: Number, required: true, min: 1 },
    // Thời gian học sinh thực sự làm bài, tính bằng giây.
    timeSpentSeconds: { type: Number, default: 0, min: 0 },

    totalPoints: { type: Number, default: 0, min: 0 },
    earnedPoints: { type: Number, default: 0, min: 0 },
    scorePercent: { type: Number, default: 0, min: 0, max: 100 },
    correctCount: { type: Number, default: 0, min: 0 },
    questionCount: { type: Number, default: 0, min: 0 },
    passed: { type: Boolean, default: false },

    answers: { type: [answeredQuestionSchema], default: [] },
    // Có câu nào cần người chấm không.
    requiresManualGrading: { type: Boolean, default: false, index: true },
    gradedAt: { type: Date, default: null },
    gradedBy: { type: String, default: null }
}, { timestamps: true, collection: 'attempts' });

attemptSchema.index({ username: 1, examId: 1, createdAt: -1 });
attemptSchema.index({ username: 1, submittedAt: -1 });
attemptSchema.index({ status: 1, requiresManualGrading: 1 });

/** Lượt đã nộp chưa. */
attemptSchema.methods.isSubmitted = function isSubmitted() {
    return this.status !== ATTEMPT_STATUS.IN_PROGRESS;
};

/** Tổng quan cho danh sách lịch sử (không kèm chi tiết từng câu). */
attemptSchema.methods.toHistoryItem = function toHistoryItem() {
    return {
        attemptId: this.attemptId,
        examId: this.examId,
        grade: this.grade,
        subjectId: this.subjectId,
        status: this.status,
        scorePercent: this.scorePercent,
        earnedPoints: this.earnedPoints,
        totalPoints: this.totalPoints,
        correctCount: this.correctCount,
        questionCount: this.questionCount,
        passed: this.passed,
        timeSpentSeconds: this.timeSpentSeconds,
        submittedAt: this.submittedAt,
        requiresManualGrading: this.requiresManualGrading
    };
};

module.exports = mongoose.models.Attempt || mongoose.model('Attempt', attemptSchema);