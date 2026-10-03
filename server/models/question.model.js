'use strict';

/**
 * Mô hình câu hỏi — nguồn duy nhất cho ngân hàng câu hỏi.
 *
 * Bảo mật: `correctAnswer` KHÔNG BAO GIỜ được gửi xuống trình duyệt khi lấy đề.
 * Mọi endpoint dành cho học sinh phải dùng `Question.toStudentView()`.
 */

const mongoose = require('mongoose');
const { QUESTION_TYPES, DIFFICULTIES, AUTO_SCORABLE_TYPES } = require('../config/constants');

const TYPE_VALUES = Object.values(QUESTION_TYPES);

const optionSchema = new mongoose.Schema({
    label: { type: String, required: true, trim: true, maxlength: 8 }, // A, B, C, D
    text: { type: String, required: true, trim: true, maxlength: 1500 }
}, { _id: false });

/**
 * Đáp án đúng.
 * - single_choice / true_false : chuỗi ký hiệu, ví dụ "B"
 * - multiple_choice            : mảng ký hiệu, ví dụ ["A","C"]
 * - numeric                    : số
 * - short_answer / essay       : mảng từ khoá chấp nhận, để người chấm đối chiếu
 */
const answerSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: TYPE_VALUES
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    // Chuẩn hoá dùng để so khớp câu trả lời tự do/numeric.
    normalizedValue: { type: String, default: '' },
    // Câu này có cần người chấm không.
    manualGradingRequired: { type: Boolean, default: false, index: true }
}, { _id: false });

const mediaSchema = new mongoose.Schema({
    type: { type: String, enum: ['image', 'audio', 'video'], required: true },
    url: { type: String, required: true, maxlength: 500 },
    caption: { type: String, maxlength: 300, default: '' }
}, { _id: false });

const questionSchema = new mongoose.Schema({
    // Khoá ổn định, KHÔNG dùng nội dung câu hỏi làm khoá.
    questionId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: TYPE_VALUES, default: QUESTION_TYPES.SINGLE_CHOICE },
    questionText: { type: String, required: true, trim: true, maxlength: 8000 },

    // ---- Gắn với chương trình ----
    grade: { type: Number, required: true, min: 1, max: 12, index: true },
    subjectId: { type: String, required: true, index: true },
    seriesId: { type: String, default: null },
    textbookId: { type: String, default: null, index: true },
    chapterId: { type: String, default: null, index: true },
    lessonId: { type: String, default: null, index: true },

    options: { type: [optionSchema], default: [] },
    correctAnswer: { type: answerSchema, required: true },
    explanation: { type: String, maxlength: 5000, default: '' },

    difficulty: { type: String, enum: DIFFICULTIES, default: 'medium', index: true },
    points: { type: Number, default: 1, min: 0, max: 100 },

    // Công thức/bảng/hình mà parser không chắc chắn chuyển đúng.
    needsReview: { type: Boolean, default: false },
    reviewNotes: { type: [String], default: [] },
    media: { type: [mediaSchema], default: [] },

    // ---- Nguồn & kiểm duyệt ----
    source: { type: String, default: '' },
    sourceDocument: { type: String, default: '' },
    verificationStatus: { type: String, default: 'NEEDS_VERIFICATION' },
    createdBy: { type: String, required: true },
    publishedAt: { type: Date, default: null },
    importJobId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }
}, { timestamps: true, collection: 'questions' });

questionSchema.index({ grade: 1, subjectId: 1, difficulty: 1, publishedAt: 1 });
questionSchema.index({ lessonId: 1, difficulty: 1 });

/** Loại câu nào máy chấm được — không suy diễn, dựa trên khai báo đã lưu. */
questionSchema.methods.isAutoScorable = function isAutoScorable() {
    return AUTO_SCORABLE_TYPES.includes(this.type) && !this.correctAnswer?.manualGradingRequired;
};

/**
 * Bản nhìn cho học sinh: KHÔNG có correctAnswer, KHÔNG có explanation trước khi nộp bài.
 * `explanationAfterSubmit` được bật bởi endpoint kết quả, không phải ở đây.
 */
questionSchema.methods.toStudentView = function toStudentView({ withExplanation = false } = {}) {
    return {
        questionId: this.questionId,
        type: this.type,
        questionText: this.questionText,
        options: this.options.map(option => ({ label: option.label, text: option.text })),
        media: this.media.map(item => ({ type: item.type, url: item.url, caption: item.caption })),
        points: this.points,
        difficulty: this.difficulty,
        lessonId: this.lessonId,
        ...(withExplanation ? { explanation: this.explanation } : {})
    };
};

module.exports = mongoose.models.Question || mongoose.model('Question', questionSchema);
module.exports.TYPE_VALUES = TYPE_VALUES;