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

/** Ký hiệu đánh dấu lỗi chặn publish. */
const SEVERITY_ERROR = 'error';
const SEVERITY_WARNING = 'warning';

/**
 * Kiểm tra một câu hỏi đã parse.
 *
 * @param {object} question
 * @returns {{valid: boolean, warnings: string[], errors: string[]}}
 */
function validateQuestion(question) {
    const errors = [];
    const warnings = [];

    // ---- Nội dung câu hỏi ----
    if (!question.questionText || !String(question.questionText).trim()) {
        errors.push('Thiếu nội dung câu hỏi.');
    }

    // ---- Lựa chọn ----
    const options = Array.isArray(question.options) ? question.options : [];
    const isEssay = question.type === QUESTION_TYPES.ESSAY;

    if (!isEssay) {
        if (options.length < 2) {
            errors.push('Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn.');
        }
        const labels = options.map(option => option.label);
        if (new Set(labels).size !== labels.length) {
            errors.push('Có ký hiệu lựa chọn bị trùng.');
        }
        const texts = options.map(option => String(option.text || '').trim());
        if (new Set(texts).size !== texts.length) {
            warnings.push('Có hai lựa chọn trùng nội dung.');
        }
        if (options.some(option => !String(option.text || '').trim())) {
            errors.push('Có lựa chọn rỗng.');
        }
    }

    // ---- Đáp án ----
    const answer = question.correctAnswer;
    if (answer === null || answer === undefined || answer === '') {
        errors.push('Chưa xác định được đáp án đúng — cần nhập tay trước khi publish.');
    } else if (!isEssay && Array.isArray(options) && options.length) {
        const validLabels = options.map(option => option.label);
        const given = Array.isArray(answer) ? answer : [answer];
        const unknown = given.filter(label => !validLabels.includes(label));
        if (unknown.length) {
            errors.push(`Đáp án "${unknown.join(', ')}" không khớp lựa chọn nào của câu.`);
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
    if (isEssay) {
        warnings.push('Câu tự luận — sẽ cần người chấm, hệ thống không tự cho điểm.');
    }

    return { valid: errors.length === 0, errors, warnings };
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
            warnings: [...result.warnings, ...(question.warnings || [])],
            errors: result.errors
        };
    });

    return {
        questions: validated,
        questionCount: validated.length,
        validCount,
        errorCount,
        warningCount,
        documentErrors,
        documentWarnings,
        // Chỉ cần duyệt tay khi có công thức/bảng hoặc hình nhúng.
        needsReview: Boolean(parsed.hasFormula || (parsed.media || []).length)
    };
}

module.exports = {
    SEVERITY_ERROR,
    SEVERITY_WARNING,
    validateDocument,
    validateQuestion
};