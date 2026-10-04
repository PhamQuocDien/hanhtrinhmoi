'use strict';

/**
 * Kiểm tra tính hợp lệ của các câu hỏi đã đọc từ DOCX.
 *
 * Phân loại hai mức:
 *   - LỖI (chặn publish): câu không thể dùng được, ví dụ không có đáp án,
 *     đáp án trỏ tới lựa chọn không tồn tại, lựa chọn trùng nhau.
 *   - CẢNH BÁO (cho admin xem xét): câu dùng được nhưng có rủi ro sai nghĩa,
 *     ví dụ có công thức, hình ảnh, thiếu giải thích.
 *
 * Câu hỏi có lỗi chặn publish sẽ KHÔNG được đưa vào ngân hàng câu hỏi.
 */

const { QUESTION_TYPES } = require('../../config/constants');
const { totalRubricPoints } = require('./rubric-detector');

/** Ký hiệu đánh dấu lỗi chặn publish. */
const SEVERITY_ERROR = 'error';
const SEVERITY_WARNING = 'warning';

/** Loại câu nào không dùng lựa chọn A-D. */
const TYPES_WITHOUT_OPTIONS = Object.freeze([
    QUESTION_TYPES.FILL_BLANK,
    QUESTION_TYPES.SHORT_ANSWER,
    QUESTION_TYPES.NUMERIC,
    QUESTION_TYPES.ESSAY
]);

/** Loại câu nào bắt buộc phải có đáp án máy đọc được. */
const TYPES_REQUIRING_ANSWER = Object.freeze([
    QUESTION_TYPES.SINGLE_CHOICE,
    QUESTION_TYPES.MULTIPLE_CHOICE,
    QUESTION_TYPES.TRUE_FALSE,
    QUESTION_TYPES.NUMERIC
]);

/**
 * Kiểm tra một câu hỏi đã parse.
 *
 * @param {object} question
 * @returns {{valid: boolean, warnings: string[], errors: string[]}}
 */
function validateQuestion(question) {
    const errors = [];
    const warnings = [];
    const type = question.type;

    // ---- Nội dung câu hỏi ----
    if (!question.questionText || !String(question.questionText).trim()) {
        errors.push('Thiếu nội dung câu hỏi.');
    }

    // ---- Điểm ----
    const points = Number(question.points);
    if (!Number.isFinite(points) || points <= 0) {
        errors.push('Điểm của câu phải lớn hơn 0.');
    }

    // ---- Lựa chọn A-D ----
    const options = Array.isArray(question.options) ? question.options : [];
    const usesOptions = !TYPES_WITHOUT_OPTIONS.includes(type);

    if (usesOptions) {
        if (options.length < 2) errors.push('Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn.');
        const labels = options.map(option => option.label);
        if (new Set(labels).size !== labels.length) errors.push('Có ký hiệu lựa chọn bị trùng.');
        if (options.some(option => !String(option.text || '').trim())) errors.push('Có lựa chọn rỗng.');
        const texts = options.map(option => String(option.text || '').trim());
        if (new Set(texts).size !== texts.length) warnings.push('Có hai lựa chọn trùng nội dung.');
    } else if (options.length) {
        warnings.push('Câu này không dùng lựa chọn A-D nhưng vẫn có dữ liệu lựa chọn.');
    }

    // ---- Đáp án ----
    const answer = question.correctAnswer;
    const hasAnswer = !(answer === null || answer === undefined || answer === ''
        || (Array.isArray(answer) && !answer.length));

    if (TYPES_REQUIRING_ANSWER.includes(type) && !hasAnswer) {
        errors.push('Chưa xác định được đáp án đúng — cần nhập tay trước khi publish.');
    } else if (usesOptions && hasAnswer && options.length) {
        const validLabels = options.map(option => option.label);
        const given = Array.isArray(answer) ? answer : [answer];
        const unknown = given.filter(label => !validLabels.includes(label));
        if (unknown.length) {
            errors.push(`Đáp án "${unknown.join(', ')}" không khớp lựa chọn nào của câu.`);
        }
        if (type === QUESTION_TYPES.SINGLE_CHOICE && Array.isArray(answer)) {
            errors.push('Câu một đáp án chỉ được có đúng MỘT ký hiệu đúng.');
        }
        if (type === QUESTION_TYPES.MULTIPLE_CHOICE && !Array.isArray(answer)) {
            errors.push('Câu nhiều đáp án phải khai báo đáp án dạng mảng ký hiệu.');
        }
    }

    // ---- Ô trống (điền khuyết) ----
    if (type === QUESTION_TYPES.FILL_BLANK) {
        const blanks = Array.isArray(question.blanks) ? question.blanks : [];
        if (!blanks.length) {
            errors.push('Câu điền khuyết chưa nhận dạng được ô trống nào.');
        } else {
            const missing = blanks.filter(blank => !(blank.correctAnswers || []).length);
            if (missing.length) {
                errors.push(`${missing.length} ô trống chưa có đáp án đúng — không được đoán.`);
            }
            const ids = blanks.map(blank => blank.blankId);
            if (new Set(ids).size !== ids.length) errors.push('Có blankId bị trùng.');
        }
    }

    // ---- Ý Đúng/Sai nhiều ý ----
    if (type === QUESTION_TYPES.TRUE_FALSE && Array.isArray(question.statements) && question.statements.length) {
        const missing = question.statements.filter(s => typeof s.correctAnswer !== 'boolean');
        if (missing.length) {
            errors.push(`${missing.length} ý Đúng/Sai chưa xác định đáp án.`);
        }
    }

    // ---- Rubric cho câu tự luận ----
    if (type === QUESTION_TYPES.ESSAY) {
        const rubric = Array.isArray(question.rubric) ? question.rubric : [];
        if (!rubric.length) {
            errors.push('Câu tự luận chưa có rubric — cần soạn tiêu chí chấm điểm.');
        } else {
            const total = totalRubricPoints(rubric);
            if (Number.isFinite(points) && points > 0 && Math.abs(total - points) > 0.001) {
                errors.push(`Tổng điểm rubric (${total}) không khớp điểm câu (${points}).`);
            }
        }
    }

    // ---- Cảnh báo nội dung ----
    if (Array.isArray(question.media) && question.media.length) {
        warnings.push('Câu hỏi có hình — cần kiểm tra hình hiển thị đúng.');
    }
    if (question.hasFormula || /\[CÔNG THỨC\]/.test(String(question.questionText || ''))) {
        warnings.push('Câu hỏi có công thức — cần đối chiếu với bản in để chắc chắn chính xác.');
    }
    if (!String(question.explanation || '').trim()) {
        warnings.push('Chưa có giải thích đáp án.');
    }
    if (type === QUESTION_TYPES.ESSAY) {
        warnings.push('Câu tự luận — sẽ cần người chấm, hệ thống không tự cho điểm.');
    }
    if (type === QUESTION_TYPES.SHORT_ANSWER) {
        warnings.push('Câu trả lời ngắn — kiểm tra kỹ danh sách đáp án chấp nhận trước khi chấm tự động.');
    }

    return { valid: errors.length === 0, errors, warnings };
}

/** Tổng hợp số câu theo từng loại — dùng cho màn hình xem trước sau khi import. */
function summarizeByType(questions = []) {
    const summary = {};
    for (const type of Object.values(QUESTION_TYPES)) summary[type] = 0;
    for (const question of questions) {
        if (question?.type && summary[question.type] !== undefined) summary[question.type] += 1;
    }
    return summary;
}

/**
 * Kiểm tra toàn bộ tài liệu đã parse.
 * Bổ sung lỗi chặn publish ở cấp tài liệu: trùng số thứ tự, thiếu câu.
 */
function validateDocument(parsed) {
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const documentErrors = [];
    const documentWarnings = [...(parsed.documentWarnings || [])];

    if (!questions.length) {
        documentErrors.push('Không nhận dạng được câu hỏi nào từ tài liệu.');
    }

    const seenNumbers = new Set();
    let errorCount = 0;
    let validCount = 0;
    let warningCount = 0;

    const validated = questions.map((question, index) => {
        // ID tạm thời ổn định để admin sửa và publish.
        const id = question.id || `imp-q${String(index + 1).padStart(3, '0')}`;
        const result = validateQuestion({ ...question, id });

        if (seenNumbers.has(question.number)) {
            result.errors.push(`Số thứ tự câu ${question.number} bị lặp trong tài liệu.`);
            result.valid = false;
        }
        seenNumbers.add(question.number);

        if (result.valid) validCount += 1;
        else errorCount += 1;
        warningCount += result.warnings.length;

        return {
            ...question,
            id,
            valid: result.valid,
            // Câu cần người duyệt nếu: có lỗi, có cảnh báo nghiêm trọng, hoặc parser không chắc.
            needsReview: Boolean(question.needsReview) || result.warnings.length > 0,
            warnings: [...result.warnings, ...(question.warnings || [])],
            // Tên `errorList` để không đụng khoá dành riêng `errors` của Mongoose.
            errorList: result.errors
        };
    });

    const typeSummary = summarizeByType(validated);

    return {
        questions: validated,
        questionCount: validated.length,
        validCount,
        errorCount,
        warningCount,
        documentErrors,
        documentWarnings,
        // Số câu đã đọc được theo từng loại — admin nhìn thấy ngay trạng thái.
        typeSummary,
        parserVersion: parsed.parserVersion || null,
        // Chỉ cần duyệt tay khi có công thức/bảng hoặc hình nhúng.
        needsReview: Boolean(parsed.hasFormula || (parsed.media || []).length)
    };
}

module.exports = {
    SEVERITY_ERROR,
    SEVERITY_WARNING,
    TYPES_REQUIRING_ANSWER,
    TYPES_WITHOUT_OPTIONS,
    summarizeByType,
    validateDocument,
    validateQuestion
};