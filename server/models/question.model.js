'use strict';

/**
 * Mô hình câu hỏi — nguồn duy nhất cho ngân hàng câu hỏi.
 *
 * Bảo mật: `correctAnswer` KHÔNG BAO GIỜ được gửi xuống trình duyệt khi lấy đề.
 * Mọi endpoint dành cho học sinh phải dùng `Question.toStudentView()`.
 */

const mongoose = require('mongoose');
const {
    QUESTION_TYPES,
    DIFFICULTIES,
    AUTO_SCORABLE_TYPES,
    MANUAL_GRADING_TYPES,
    GRADING_MODES,
    MULTIPLE_CHOICE_MODES,
    OPTION_LABELS
} = require('../config/constants');

const TYPE_VALUES = Object.values(QUESTION_TYPES);

const optionSchema = new mongoose.Schema({
    label: { type: String, required: true, trim: true, maxlength: 8 }, // A, B, C, D
    text: { type: String, required: true, trim: true, maxlength: 1500 }
}, { _id: false });

/** Ô trống của câu điền khuyết. */
const blankSchema = new mongoose.Schema({
    blankId: { type: String, required: true, trim: true, maxlength: 40 },
    // Thứ tự xuất hiện trong câu hỏi (1-based).
    position: { type: Number, min: 1, default: 1 },
    // Nhiều đáp án tương đương được phép: "Hà Nội", "Ha Noi", "ha noi".
    correctAnswers: { type: [String], default: [] },
    points: { type: Number, min: 0, max: 100, default: null },
    // Cấu hình chuẩn hoá riêng cho ô này (không áp dụng chung toàn câu).
    normalization: {
        trimWhitespace: { type: Boolean, default: true },
        caseInsensitive: { type: Boolean, default: false },
        normalizeUnicode: { type: Boolean, default: true },
        stripDiacritics: { type: Boolean, default: false },
        collapseSeparators: { type: Boolean, default: false }
    },
    // Gợi ý hiển thị cho UI (ví dụ: "gợi ý: 1 chữ").
    hint: { type: String, maxlength: 200, default: '' }
}, { _id: false });

/** Một ý của câu Đúng/Sai nhiều ý. */
const statementSchema = new mongoose.Schema({
    statementId: { type: String, required: true, trim: true, maxlength: 40 },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    correctAnswer: { type: Boolean, required: true },
    points: { type: Number, min: 0, max: 100, default: null }
}, { _id: false });

/** Một tiêu chí của câu tự luận (rubric do admin soạn). */
const rubricItemSchema = new mongoose.Schema({
    criterionId: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    maxPoints: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

/** Cấu hình chuẩn hoá đáp án tự do. */
const normalizationSchema = new mongoose.Schema({
    trimWhitespace: { type: Boolean, default: true },
    caseInsensitive: { type: Boolean, default: false },
    normalizeUnicode: { type: Boolean, default: true },
    // Bỏ dấu tiếng Việt — BẬT CẨN THẬN: có thể làm hai đáp án khác nghĩa trùng nhau.
    stripDiacritics: { type: Boolean, default: false },
    collapseSeparators: { type: Boolean, default: false }
}, { _id: false });

/**
 * Đáp án đúng.
 *   single_choice / true_false (đơn) : "B" hoặc true/false
 *   multiple_choice                   : ["A","C"]
 *   fill_blank                        : nằm ở `blanks`
 *   numeric                           : số
 *   short_answer / essay              : mảng đáp án chấp nhận hoặc rỗng (chờ người chấm)
 */
const answerSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: TYPE_VALUES },
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

    // ---- Đáp án theo từng loại câu ----
    // Điền khuyết: danh sách ô trống, mỗi ô có đáp án tương đương riêng.
    blanks: { type: [blankSchema], default: [] },
    // Đúng/Sai nhiều ý.
    statements: { type: [statementSchema], default: [] },
    // Tự luận: tiêu chí chấm điểm do admin soạn.
    rubric: { type: [rubricItemSchema], default: [] },
    // Trả lời ngắn: các cách viết được chấp nhận.
    acceptedAnswers: { type: [String], default: [] },
    // Câu số: đơn vị gợi ý (không bắt buộc khi nhập).
    unit: { type: String, maxlength: 30, default: '' },

    correctAnswer: { type: answerSchema, required: true },
    explanation: { type: String, maxlength: 5000, default: '' },

    // ---- Cấu hình chấm ----
    gradingMode: {
        type: String,
        enum: Object.values(GRADING_MODES),
        default: GRADING_MODES.AUTO
    },
    // Riêng cho câu nhiều đáp án: all_or_nothing | partial_credit
    multipleChoiceMode: {
        type: String,
        enum: Object.values(MULTIPLE_CHOICE_MODES),
        default: MULTIPLE_CHOICE_MODES.ALL_OR_NOTHING
    },
    // Điểm trừ cho mỗi đáp án sai (chỉ dùng khi partial_credit).
    wrongAnswerPenalty: { type: Number, min: 0, max: 100, default: null },
    // Sai số cho phép của câu số.
    tolerance: { type: Number, min: 0, max: 1000, default: 0 },
    // Ràng buộc số từ của câu tự luận.
    minWords: { type: Number, min: 0, max: 5000, default: null },
    maxWords: { type: Number, min: 0, max: 20000, default: null },
    // Cấu hình chuẩn hoá cho câu tự do.
    normalization: { type: normalizationSchema, default: () => ({}) },

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
questionSchema.index({ type: 1, grade: 1, publishedAt: 1 });

/**
 * Loại câu nào máy chấm được — đọc từ dữ liệu đã lưu, KHÔNG suy diễn.
 * `gradingMode = manual/hybrid` luôn cần người chấm trừ khi câu hybrid đã khớp.
 */
questionSchema.methods.isAutoScorable = function isAutoScorable() {
    if (this.correctAnswer?.manualGradingRequired) return false;
    if (this.gradingMode === GRADING_MODES.MANUAL) return false;
    return AUTO_SCORABLE_TYPES.includes(this.type);
};

/** Câu này có bắt buộc người chấm không (tự luận luôn có). */
questionSchema.methods.requiresManualGrading = function requiresManualGrading() {
    return this.gradingMode === GRADING_MODES.MANUAL
        || MANUAL_GRADING_TYPES.includes(this.type)
        || Boolean(this.correctAnswer?.manualGradingRequired);
};

/**
 * Bản nhìn cho học sinh: KHÔNG có correctAnswer, KHÔNG có rubric tự luận.
 *
 * `withAnswers` chỉ được bật bởi endpoint kết quả SAU khi đã nộp bài, hoặc bởi
 * màn hình soạn thảo của admin — không bao giờ bật ở endpoint bắt đầu làm bài.
 */
questionSchema.methods.toStudentView = function toStudentView({
    withExplanation = false,
    withAnswers = false
} = {}) {
    const view = {
        questionId: this.questionId,
        type: this.type,
        questionText: this.questionText,
        options: this.options.map(option => ({ label: option.label, text: option.text })),
        media: this.media.map(item => ({ type: item.type, url: item.url, caption: item.caption })),
        points: this.points,
        difficulty: this.difficulty,
        lessonId: this.lessonId,
        // Điền khuyết: UI cần biết có bao nhiêu ô và thứ tự, KHÔNG cần đáp án.
        ...(this.type === QUESTION_TYPES.FILL_BLANK
            ? {
                blanks: this.blanks.map((blank, index) => ({
                    blankId: blank.blankId,
                    position: blank.position ?? index + 1,
                    points: blank.points,
                    hint: blank.hint || ''
                }))
            }
            : {}),
        // Đúng/Sai nhiều ý: UI cần biết có bao nhiêu ý, không cần đáp án.
        ...(this.type === QUESTION_TYPES.TRUE_FALSE && this.statements.length
            ? {
                statements: this.statements.map(statement => ({
                    statementId: statement.statementId,
                    text: statement.text
                }))
            }
            : {}),
        // Ràng buộc số từ cho textarea tự luận — không phải đáp án.
        ...(this.type === QUESTION_TYPES.ESSAY
            ? { minWords: this.minWords, maxWords: this.maxWords }
            : {}),
        ...(this.type === QUESTION_TYPES.NUMERIC && this.unit ? { unit: this.unit } : {}),
        ...(withExplanation ? { explanation: this.explanation } : {})
    };

    // Chỉ màn hình soạn thảo admin và màn hình xem kết quả mới cần đáp án.
    if (withAnswers) {
        view.correctAnswer = this.correctAnswer?.value;
        view.acceptedAnswers = this.acceptedAnswers;
        view.rubric = this.rubric;
    }

    return view;
};

/**
 * Kiểm tra câu hỏi có dùng được để publish không.
 * Dùng chung cho API admin và cho bước publish sau khi import DOCX.
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
questionSchema.methods.validateForPublishing = function validateForPublishing() {
    // eslint-disable-next-line global-require
    const { validateQuestionDocument } = require('../validators/question.validator');
    return validateQuestionDocument(this.toObject({ depopulate: true }));
};

/** Kiểm tra metadata gắn với chương trình có đầy đủ không. */
questionSchema.methods.hasCompleteCurriculumMetadata = function hasCompleteCurriculumMetadata() {
    return Boolean(this.grade && this.subjectId && this.source);
};

module.exports = mongoose.models.Question || mongoose.model('Question', questionSchema);
module.exports.TYPE_VALUES = TYPE_VALUES;