'use strict';

/**
 * CHUẨN HOÁ CÂU TRẢ LỜI — nguồn duy nhất cho mọi so khớp.
 *
 * Nguyên tắc bất di bất dịch:
 *   - Chuẩn hoá KHÔNG được biến một đáp án sai thành đúng.
 *   - Mặc định chỉ bỏ khoảng trắng thừa + gộp khoảng trắng. Hạ chữ thường và bỏ
 *     dấu tiếng Việt là TÙY CHỌN, phải được câu hỏi khai báo tường minh.
 *   - Không bao giờ bỏ ký hiệu toán học, dấu gạch nối hay dấu phẩy — chúng có ý nghĩa.
 *
 * Mỗi câu hỏi có thể cấu hình:
 *   { trimWhitespace: true, caseInsensitive: false, normalizeUnicode: false,
 *     stripDiacritics: false, collapseSeparators: false }
 */

const DEFAULT_RULES = Object.freeze({
    trimWhitespace: true,
    caseInsensitive: false,
    normalizeUnicode: true,   // NFC: gộp dấu Unicode về dạng chuẩn, KHÔNG bỏ dấu.
    stripDiacritics: false,
    collapseSeparators: false // gộp ", ; - " thành một dấu phân cách khi so list đáp án.
});

/** Hợp nhất cấu hình chuẩn hoá với mặc định. */
function resolveRules(rules = {}) {
    return { ...DEFAULT_RULES, ...(rules || {}) };
}

/** Bỏ dấu tiếng Việt + hạ chữ thường (chỉ dùng khi câu khai báo cho phép). */
function stripDiacritics(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

/** Gộp các dấu phân cách thành một ký hiệu duy nhất để so list "2,3,5,7". */
function collapseSeparators(value) {
    return String(value).replace(/\s*[,;|/]\s*/g, ',').replace(/\s+và\s+/gi, ',');
}

/**
 * Chuẩn hoá một chuỗi câu trả lời theo cấu hình.
 * @param {*} value
 * @param {object} rules
 * @returns {string}
 */
function normalize(value, rules = {}) {
    const config = resolveRules(rules);
    let text = String(value ?? '');

    if (config.normalizeUnicode) text = text.normalize('NFC');
    // Ký tự không in được không mang ý nghĩa -> loại bỏ để so khớp ổn định.
    text = text.replace(/[\u0000-\u001F\u007F]/g, ' ');
    if (config.stripDiacritics) text = stripDiacritics(text);
    if (config.collapseSeparators) text = collapseSeparators(text);
    if (config.caseInsensitive) text = text.toLowerCase();

    if (config.trimWhitespace) {
        text = text.replace(/\s+/g, ' ').trim();
        // Dấu phân cách cuối không mang ý nghĩa: "2, 3, 5, 7," -> "2, 3, 5, 7".
        text = text.replace(/[,;\s]+$/, '');
    }

    return text;
}

/**
 * Chuẩn hoá một danh sách đáp án, loại trùng và giữ thứ tự.
 * Dùng cho `acceptedAnswers` và `blanks[].correctAnswers`.
 */
function normalizeList(values, rules = {}) {
    const list = Array.isArray(values) ? values : [values];
    const seen = new Set();
    const result = [];
    for (const item of list) {
        const normalized = normalize(item, rules);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

/**
 * So khớp một câu trả lời với một danh sách đáp án chấp nhận.
 * Trả về giá trị đã chuẩn hoá khớp, hoặc null.
 */
function matchAccepted(value, acceptedAnswers, rules = {}) {
    const given = normalize(value, rules);
    if (!given) return null;
    const accepted = normalizeList(acceptedAnswers, rules);
    if (!accepted.length) return null;
    return accepted.includes(given) ? given : null;
}

/**
 * Chuẩn hoá một giá trị số chấp nhận cả dấu phẩy thập phân kiểu Việt Nam.
 * @returns {number|null}
 */
function normalizeNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    // "1.234,56" (kiểu Việt Nam) vs "1,234.56" (kiểu Anh) — xử lý cả hai.
    const hasComma = raw.includes(',');
    const hasDot = raw.includes('.');
    let normalized = raw.replace(/\s/g, '');
    if (hasComma && hasDot) {
        // Dấu phân cách thập phân là dấu xuất hiện SAU CÙNG.
        const decimalSeparator = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.';
        const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
        normalized = raw.replace(thousandsSeparator, '').replace(decimalSeparator, '.');
    } else if (hasComma) {
        normalized = raw.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

module.exports = {
    DEFAULT_RULES,
    collapseSeparators,
    matchAccepted,
    normalize,
    normalizeList,
    normalizeNumber,
    resolveRules,
    stripDiacritics
};