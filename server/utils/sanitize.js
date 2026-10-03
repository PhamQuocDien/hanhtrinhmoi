'use strict';

/**
 * Làm sạch và kiểm tra đầu vào.
 *
 * DOCX import là nơi nguy hiểm nhất: nội dung do người dùng tải lên có thể chứa
 * kịch bản, thẻ HTML, đường dẫn tệp hoặc công thức bị hỏng. Mọi dữ liệu từ tài
 * liệu phải đi qua đây trước khi lưu hoặc render.
 */

/** Ký tự điều khiển không được phép (trừ xuống dòng và tab). */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Rút gọn chuỗi về độ dài tối đa, cắt ở ranh giới từ nếu có thể. */
function clamp(value, maxLength) {
    const text = String(value ?? '');
    if (text.length <= maxLength) return text;
    const sliced = text.slice(0, maxLength);
    const lastSpace = sliced.lastIndexOf(' ');
    return `${(lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced).trim()}...`;
}

/**
 * Làm sạch văn bản thuần: bỏ ký tự điều khiển, gộp khoảng trắng, cắt độ dài.
 * KHÔNG giữ lại thẻ HTML.
 */
function cleanText(value, { maxLength = 4000, allowNewlines = false } = {}) {
    let text = String(value ?? '').replace(CONTROL_CHARS, '');
    // Vô hiệu hoá chèn thẻ bằng cách bỏ ký tự '<' '>' rời rạc để nội dung Word
    // không thể trở thành HTML khi render client.
    text = text.replace(/[<>]/g, '');
    text = allowNewlines ? text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim() : text.replace(/\s+/g, ' ').trim();
    return clamp(text, maxLength);
}

/**
 * Bỏ dấu tiếng Việt để so sánh/tìm kiếm không phụ thuộc dấu.
 */
function normalizeKey(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** Chuyển chuỗi thành khoá/slug an toàn cho tên file và URL. */
function slugify(value, maxLength = 80) {
    const slug = normalizeKey(value).replace(/\s+/g, '-');
    return clamp(slug, maxLength);
}

/**
 * Kiểm tra tên tệp upload.
 *
 * Chỉ chấp nhận `.docx`. Chặn rõ các đuôi thực thi/kịch bản và bất kỳ đường
 * dẫn nào chứa ký tự điều hướng thư mục, để file upload không thể trở
 * thành tệp thực thi.
 */
const BLOCKED_EXTENSIONS = Object.freeze([
    '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.ps1', '.vbs', '.js',
    '.jse', '.wsf', '.hta', '.php', '.phtml', '.py', '.pl', '.rb', '.sh',
    '.html', '.htm', '.xhtml', '.svg', '.jar', '.dll', '.so', '.apk'
]);

const VALID_FILE_NAME = /^[A-Za-z0-9._\-\p{L} ]{1,180}$/u;

function validateUploadFileName(originalName) {
    const name = String(originalName || '').trim();
    if (!name) return { valid: false, reason: 'Thiếu tên tệp.' };
    if (name.includes('/') || name.includes('\\') || name.includes('\u0000')) {
        return { valid: false, reason: 'Tên tệp chứa ký tự đường dẫn không hợp lệ.' };
    }
    if (!VALID_FILE_NAME.test(name)) {
        return { valid: false, reason: 'Tên tệp chứa ký tự không cho phép.' };
    }
    const lower = name.toLowerCase();
    const extension = lower.slice(lower.lastIndexOf('.'));
    if (BLOCKED_EXTENSIONS.includes(extension)) {
        return { valid: false, reason: `Đuôi tệp ${extension} không được phép tải lên.` };
    }
    if (!lower.endsWith('.docx')) {
        return { valid: false, reason: 'Chỉ chấp nhận tệp .docx.' };
    }
    return { valid: true, extension };
}

/**
 * Kiểm tra chữ ký nhị phân của tệp.
 * `.docx` thực chất là tệp ZIP nên phải bắt đầu bằng "PK\u0003\u0004".
 * Đây là lớp phòng thủ thứ hai sau kiểm tra đuôi tệp.
 */
function hasDocxSignature(buffer, magic) {
    if (!Buffer.isBuffer(buffer) || buffer.length < magic.length) return false;
    return buffer.subarray(0, magic.length).equals(magic);
}

/** Kiểm tra tên đăng nhập: chữ/số/gạch dưới, 3–24 ký tự, có dấu tiếng Việt. */
function isValidUsername(username) {
    return /^[A-Za-z0-9_À-ỹ]{3,24}$/u.test(String(username || ''));
}

/** Kiểm tra mật khẩu: 6–72 ký tự. */
function isValidPassword(password) {
    const value = String(password || '');
    return value.length >= 6 && value.length <= 72;
}

module.exports = {
    BLOCKED_EXTENSIONS,
    clamp,
    cleanText,
    hasDocxSignature,
    isValidPassword,
    isValidUsername,
    normalizeKey,
    slugify,
    validateUploadFileName
};