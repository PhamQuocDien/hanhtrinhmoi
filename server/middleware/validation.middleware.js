'use strict';

/**
 * Kiểm tra dữ liệu đầu vào trước khi vào service.
 *
 * Nguyên tắc: validator trả về danh sách lỗi có cấu trúc, KHÔNG tự ghi lỗi
 * vào response. Controller quyết định phản hồi. Nhờ vậy cùng một validator
 * dùng được cho cả API lẫn script ngoài dòng.
 */

const response = require('../utils/response');
const { cleanText, isValidPassword, isValidUsername } = require('../utils/sanitize');

/** Tạo một lỗi validation. */
function issue(field, message, code) {
    return { field, message, code: code || 'INVALID' };
}

/**
 * Bọc một hàm validate: nếu có lỗi thì trả 400 với danh sách, ngược lại
 * `req.validated = <giá trị đã chuẩn hoá>` rồi đi tiếp.
 */
function validate(schemaName) {
    return (req, res, next) => {
        const schema = VALIDATORS[schemaName];
        if (!schema) return next(new Error(`Không có bộ kiểm tra "${schemaName}"`));
        const result = schema(req.body || {}, req);
        if (!result.valid) {
            return response.badRequest(res, 'Dữ liệu gửi lên không hợp lệ.', { errors: result.errors });
        }
        req.validated = result.value;
        return next();
    };
}

// -------------------------------------------------------------- TIỆN ÍCH

function requireString(value, field, { min = 1, max = 200 } = {}) {
    const text = cleanText(value, { maxLength: max });
    if (text.length < min) return { error: issue(field, `Cần nhập ${field}.`) };
    return { text };
}

function requireInt(value, field, { min, max } = {}) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return { error: issue(field, `${field} phải là số nguyên.`) };
    if (min !== undefined && parsed < min) return { error: issue(field, `${field} phải >= ${min}.`) };
    if (max !== undefined && parsed > max) return { error: issue(field, `${field} phải <= ${max}.`) };
    return { value: parsed };
}

function optionalEnum(value, field, allowed, fallback) {
    if (value === undefined || value === null || value === '') return { value: fallback };
    if (!allowed.includes(value)) return { error: issue(field, `${field} không hợp lệ.`, 'INVALID_ENUM') };
    return { value };
}

// ------------------------------------------------------- BỘ KIỂM TRA

const VALIDATORS = {
    /** Đăng ký tài khoản học sinh. Không nhận `role` từ client. */
    register(body) {
        const errors = [];
        const username = cleanText(body.username, { maxLength: 24 });
        const password = String(body.password || '');

        if (!isValidUsername(username)) {
            errors.push(issue('username', 'Tên đăng nhập phải dài 3-24 ký tự, chỉ gồm chữ, số hoặc gạch dưới.'));
        }
        if (!isValidPassword(password)) {
            errors.push(issue('password', 'Mật khẩu phải dài từ 6 đến 72 ký tự.'));
        }
        const grade = requireInt(body.grade, 'grade', { min: 1, max: 12 });
        if (grade.error) errors.push(grade.error);

        return {
            valid: errors.length === 0,
            errors,
            // `role` cố ý KHÔNG lấy từ body: tự đăng ký luôn là học sinh.
            value: { username, password, grade: grade.value }
        };
    },

    /** Đăng nhập. */
    login(body) {
        const errors = [];
        const username = cleanText(body.username, { maxLength: 24 });
        const password = String(body.password || '');
        if (!username) errors.push(issue('username', 'Cần nhập tên đăng nhập.'));
        if (!password) errors.push(issue('password', 'Cần nhập mật khẩu.'));
        return { valid: errors.length === 0, errors, value: { username, password } };
    },

    /** Metadata kèm theo khi import đề từ DOCX. */
    importDocx(body) {
        const errors = [];
        const grade = requireInt(body.grade, 'grade', { min: 1, max: 12 });
        if (grade.error) errors.push(grade.error);

        const subjectId = cleanText(body.subjectId, { maxLength: 60 });
        if (!subjectId) errors.push(issue('subjectId', 'Cần chọn môn học.'));

        const title = requireString(body.examTitle, 'examTitle', { min: 3, max: 200 });
        if (title.error) errors.push(title.error);

        const duration = requireInt(body.durationMinutes, 'durationMinutes', { min: 1, max: 300 });
        if (duration.error) errors.push(duration.error);

        return {
            valid: errors.length === 0,
            errors,
            value: {
                grade: grade.value,
                subjectId,
                examTitle: title.text,
                durationMinutes: duration.value,
                seriesId: cleanText(body.seriesId, { maxLength: 60 }) || null,
                textbookId: cleanText(body.textbookId, { maxLength: 80 }) || null,
                chapterId: cleanText(body.chapterId, { maxLength: 80 }) || null,
                lessonId: cleanText(body.lessonId, { maxLength: 80 }) || null,
                description: cleanText(body.description, { maxLength: 1000, allowNewlines: true }) || ''
            }
        };
    },

    /** Nội dung một câu hỏi do admin chỉnh sửa sau khi parser đọc tài liệu. */
    question(body) {
        const errors = [];
        // eslint-disable-next-line global-require
        const { QUESTION_TYPES } = require('../config/constants');
        const text = requireString(body.questionText, 'questionText', { min: 1, max: 5000 });
        if (text.error) errors.push(text.error);

        const type = optionalEnum(body.type, 'type', Object.values(QUESTION_TYPES), QUESTION_TYPES.SINGLE_CHOICE);
        if (type.error) errors.push(type.error);

        const options = Array.isArray(body.options) ? body.options : [];
        if (type.value !== QUESTION_TYPES.ESSAY && options.length < 2) {
            errors.push(issue('options', 'Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn.'));
        }

        return {
            valid: errors.length === 0,
            errors,
            value: {
                questionText: text.text,
                type: type.value,
                options: options.map(option => cleanText(option, { maxLength: 1000 })).filter(Boolean),
                explanation: cleanText(body.explanation, { maxLength: 3000, allowNewlines: true }) || '',
                difficulty: String(body.difficulty || 'medium'),
                points: Number.isFinite(Number(body.points)) ? Number(body.points) : 1
            }
        };
    }
};

module.exports = { validate, VALIDATORS, issue };