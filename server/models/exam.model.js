'use strict';

/**
 * Mô hình đề thi.
 *
 * Vòng đời: DRAFT -> (admin duyệt) -> PUBLISHED -> ARCHIVED
 * Chỉ đề PUBLISHED mới hiện với học sinh và được phép làm.
 *
 * `questions` lưu bản chụp (snapshot) tham chiếu questionId + điểm tại thời
 * điểm tạo đề, để đề không bị đổi nội dung khi admin sửa câu hỏi gốc.
 */

const mongoose = require('mongoose');
const { EXAM_STATUS, DIFFICULTIES, SOURCE_TYPE } = require('../config/constants');

const examQuestionSchema = new mongoose.Schema({
    questionId: { type: String, required: true },
    points: { type: Number, default: 1, min: 0, max: 100 },
    // Thứ tự hiển thị trong đề đã trộn sẵn.
    order: { type: Number, required: true, min: 1 }
}, { _id: false });

const examSchema = new mongoose.Schema({
    // Khoá ổn định.
    examId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 250 },
    description: { type: String, maxlength: 2000, default: '' },

    grade: { type: Number, required: true, min: 1, max: 12, index: true },
    subjectId: { type: String, required: true, index: true },
    seriesId: { type: String, default: null },
    textbookId: { type: String, default: null },
    chapterId: { type: String, default: null },
    lessonId: { type: String, default: null },

    difficulty: { type: String, enum: DIFFICULTIES, default: 'medium' },
    durationMinutes: { type: Number, required: true, min: 1, max: 300 },
    // Tổng điểm = tổng `points` của các câu trong questions.
    totalPoints: { type: Number, default: 0, min: 0 },
    passScorePercent: { type: Number, default: 50, min: 0, max: 100 },

    questions: { type: [examQuestionSchema], default: [] },
    questionCount: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: Object.values(EXAM_STATUS), default: EXAM_STATUS.DRAFT, index: true },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: String, default: null },

    createdBy: { type: String, required: true },
    updatedBy: { type: String, default: null },
    importJobId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    // ---- Truy vết nguồn ----
    // Đề đến từ đâu: nhập DOCX, soạn tay, hay sinh tự động từ ngân hàng câu hỏi.
    sourceType: {
        type: String,
        enum: Object.values(SOURCE_TYPE),
        default: SOURCE_TYPE.MANUAL
    },
    sourceFileName: { type: String, default: '', maxlength: 255 },
    // Phiên bản bộ dò DOCX đã dùng, để truy vết khi parser đổi hành vi.
    parserVersion: { type: String, default: '', maxlength: 50 },

    // Số lượt làm bài, cập nhật bằng $inc để không mất dữ liệu khi chạy song song.
    attemptCount: { type: Number, default: 0, min: 0 },
    averageScorePercent: { type: Number, default: 0, min: 0, max: 100 }
}, { timestamps: true, collection: 'exams' });

examSchema.index({ grade: 1, subjectId: 1, status: 1, publishedAt: -1 });

/** Tổng điểm của đề, luôn tính lại từ danh sách câu. */
examSchema.methods.recalculateTotal = function recalculateTotal() {
    this.totalPoints = this.questions.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
    this.questionCount = this.questions.length;
    return this.totalPoints;
};

/** Đề có được phép cho học sinh làm không. */
examSchema.methods.isAvailable = function isAvailable() {
    return this.status === EXAM_STATUS.PUBLISHED;
};

/**
 * Thông tin đề gửi cho học sinh trước khi bắt đầu: KHÔNG có danh sách câu hỏi.
 */
examSchema.methods.toStudentInfo = function toStudentInfo() {
    return {
        examId: this.examId,
        title: this.title,
        description: this.description,
        grade: this.grade,
        subjectId: this.subjectId,
        seriesId: this.seriesId,
        textbookId: this.textbookId,
        difficulty: this.difficulty,
        durationMinutes: this.durationMinutes,
        questionCount: this.questionCount,
        totalPoints: this.totalPoints,
        passScorePercent: this.passScorePercent
    };
};

module.exports = mongoose.models.Exam || mongoose.model('Exam', examSchema);