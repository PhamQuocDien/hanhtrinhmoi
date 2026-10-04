'use strict';

/**
 * Tác vụ nhập đề thi từ tệp DOCX.
 *
 * Giữ toàn bộ kết quả parse để admin xem lại và sửa trước khi publish.
 * Câu hỏi chỉ được ghi vào collection `questions` khi đề được publish, không
 * ghi thẳng lúc upload — để lỗi parse không làm bẩn ngân hàng câu hỏi.
 */

const mongoose = require('mongoose');
const { IMPORT_STATUS, QUESTION_TYPES } = require('../config/constants');

/** Một ô trống của câu điền khuyết đọc được từ DOCX. */
const parsedBlankSchema = new mongoose.Schema({
    blankId: { type: String, required: true },
    position: { type: Number, default: 1 },
    correctAnswers: { type: [String], default: [] },
    points: { type: Number, default: null },
    normalization: { type: mongoose.Schema.Types.Mixed, default: {} },
    hint: { type: String, default: '', maxlength: 200 }
}, { _id: false });

/** Một ý Đúng/Sai đọc được từ DOCX. */
const parsedStatementSchema = new mongoose.Schema({
    statementId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 1000 },
    // null = admin phải xác nhận, parser không đoán.
    correctAnswer: { type: Boolean, default: null }
}, { _id: false });

/** Một tiêu chí rubric đọc được từ phần "Hướng dẫn chấm". */
const parsedRubricItemSchema = new mongoose.Schema({
    criterionId: { type: String, required: true },
    description: { type: String, required: true, maxlength: 500 },
    maxPoints: { type: Number, required: true, min: 0 }
}, { _id: false });

const parsedQuestionSchema = new mongoose.Schema({
    // Số thứ tự câu trong tài liệu gốc.
    number: { type: Number, required: true, min: 1 },
    type: { type: String, enum: Object.values(QUESTION_TYPES), default: QUESTION_TYPES.SINGLE_CHOICE },
    questionText: { type: String, required: true, maxlength: 8000 },
    options: {
        type: [{
            _id: false,
            label: { type: String, required: true, maxlength: 8 },
            text: { type: String, required: true, maxlength: 1500 }
        }],
        default: []
    },
    blanks: { type: [parsedBlankSchema], default: [] },
    statements: { type: [parsedStatementSchema], default: [] },
    rubric: { type: [parsedRubricItemSchema], default: [] },

    // null nghĩa là parser KHÔNG xác định được đáp án — tuyệt đối không đoán.
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    answerDetected: { type: Boolean, default: false },
    explanation: { type: String, default: '', maxlength: 5000 },
    media: {
        type: [{
            _id: false,
            type: { type: String, default: 'image' },
            url: { type: String, required: true },
            mimeType: { type: String, default: '' },
            caption: { type: String, default: '', maxlength: 300 }
        }],
        default: []
    },
    difficulty: { type: String, default: 'medium' },
    points: { type: Number, default: 1, min: 0, max: 100 },
    lessonId: { type: String, default: null },

    // Lý do parser chọn loại câu — admin nhìn thấy để biết độ tin cậy.
    typeDetection: {
        reason: { type: String, default: '' },
        confidence: { type: String, default: 'medium' }
    },
    // Công thức/bảng/hình parser không chắc chuyển đúng.
    hasFormula: { type: Boolean, default: false },
    parserVersion: { type: String, default: '' },

    // Lỗi/cảnh báo của riêng câu này (thiếu đáp án, thiếu lựa chọn, công thức...).
    // Dùng `errorList` thay cho `errors` vì `errors` là khoá dành riêng của Mongoose.
    warnings: { type: [String], default: [] },
    errorList: { type: [String], default: [] },
    valid: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: false },
    // true nếu admin đã sửa tay sau khi parse.
    editedByAdmin: { type: Boolean, default: false }
}, { _id: false });

const importJobSchema = new mongoose.Schema({
    jobId: { type: String, required: true, unique: true, index: true },

    // ---- Metadata người dùng chọn ----
    title: { type: String, required: true, trim: true, maxlength: 250 },
    description: { type: String, maxlength: 2000, default: '' },
    grade: { type: Number, required: true, min: 1, max: 12 },
    subjectId: { type: String, required: true },
    seriesId: { type: String, default: null },
    textbookId: { type: String, default: null },
    chapterId: { type: String, default: null },
    lessonId: { type: String, default: null },
    durationMinutes: { type: Number, required: true, min: 1, max: 300 },

    // ---- Thông tin tệp ----
    fileName: { type: String, required: true, maxlength: 255 },
    fileSizeBytes: { type: Number, required: true, min: 0 },
    // Tệp KHÔNG được phục vụ lại cho trình duyệt; chỉ lưu tên + kích thước + hash.
    fileSha256: { type: String, required: true },

    // ---- Kết quả parse ----
    status: {
        type: String,
        enum: Object.values(IMPORT_STATUS),
        default: IMPORT_STATUS.UPLOADED,
        index: true
    },
    questions: { type: [parsedQuestionSchema], default: [] },
    questionCount: { type: Number, default: 0 },
    validCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    // Cảnh báo ở cấp tài liệu (công thức, bảng, hình không xử lý được...).
    documentWarnings: { type: [String], default: [] },
    // true nếu có công thức/bảng khiến nội dung có thể sai.
    needsReview: { type: Boolean, default: false, index: true },
    parseSummary: { type: mongoose.Schema.Types.Mixed, default: {} },

    uploadedBy: { type: String, required: true },
    publishedExamId: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: String, default: null }
}, { timestamps: true, collection: 'import_jobs' });

importJobSchema.index({ uploadedBy: 1, createdAt: -1 });
importJobSchema.index({ status: 1, needsReview: 1 });

/** Tác vụ đã tạo đề hay chưa. */
importJobSchema.methods.isPublished = function isPublished() {
    return this.status === IMPORT_STATUS.PUBLISHED;
};

/**
 * Đề chỉ được publish khi không còn lỗi chặn.
 * `needsReview` là cờ chặn mềm: admin phải xác nhận đã kiểm tra công thức/hình.
 */
importJobSchema.methods.canPublish = function canPublish() {
    return {
        canPublish: this.errorCount === 0 && this.questionCount > 0,
        blockedReasons: [
            ...(this.errorCount > 0 ? [`${this.errorCount} câu hỏi không hợp lệ.`] : []),
            ...(this.questionCount === 0 ? ['Không tìm thấy câu hỏi nào trong tài liệu.'] : []),
            ...(this.needsReview ? ['Tài liệu có công thức/bảng/hình cần admin kiểm tra thủ công.'] : [])
        ]
    };
};

module.exports = mongoose.models.ImportJob || mongoose.model('ImportJob', importJobSchema);