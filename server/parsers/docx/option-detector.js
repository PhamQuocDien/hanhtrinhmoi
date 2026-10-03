'use strict';

/**
 * Nhận diện lựa chọn A/B/C/D trong phần thân của một câu hỏi.
 *
 * Hỗ trợ: "A. nội dung", "A) nội dung", "A - nội dung", "A: nội dung",
 * và dạng "A. nội dung" nằm chung một đoạn cách nhau bằng dấu xuống dòng.
 *
 * Dấu phẩy/kết thúc câu bị loại bỏ, giữ nguyên phần nội dung.
 */

const { OPTION_LABELS } = require('../../config/constants');

/** Một lựa chọn trong một đoạn văn riêng. */
const LINE_OPTION = /^\s*([A-H])\s*[.):\-–—]\s*(.+)$/;

/** Nhiều lựa chọn trong cùng một đoạn văn, phân tách bằng dấu xuống dòng. */
const INLINE_OPTION = /(?:^|\n)\s*([A-H])\s*[.):\-–—]\s*([^\n]*?)(?=\n\s*[A-H]\s*[.):\-–—]|\s*$)/g;

/** Chuẩn hoá ký hiệu: chữ hoa, thuộc tập ký hiệu được hỗ trợ. */
function normalizeLabel(value) {
    const label = String(value || '').trim().toUpperCase();
    return OPTION_LABELS.includes(label) ? label : null;
}

/** Làm sạch phần nội dung của một lựa chọn. */
function cleanOptionText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/[.,;:\u2019\u201d"')\]]+$/g, '')
        .trim();
}

/**
 * Đọc lựa chọn từ một danh sách dòng thuộc thân câu hỏi.
 * Dòng không khớp mẫu lựa chọn được bỏ qua (thường là giải thích/đáp án).
 *
 * @returns {Array<{label: string, text: string}>}
 */
function detectOptionsFromLines(lines) {
    const options = [];
    for (const line of lines) {
        const match = String(line).match(LINE_OPTION);
        if (!match) continue;
        const label = normalizeLabel(match[1]);
        const text = cleanOptionText(match[2]);
        if (!label || !text) continue;
        options.push({ label, text });
    }
    return dedupeByLabel(options);
}

/**
 * Đọc lựa chọn khi nhiều lựa chọn nằm trong MỘT đoạn văn.
 * Nhận diện theo dấu xuống dòng trong chuỗi gốc trước khi làm sạch.
 */
function detectOptionsFromText(text) {
    const options = [];
    INLINE_OPTION.lastIndex = 0;
    let match;
    while ((match = INLINE_OPTION.exec(String(text))) !== null) {
        const label = normalizeLabel(match[1]);
        const content = cleanOptionText(match[2]);
        if (!label || !content) continue;
        options.push({ label, text: content });
    }
    return dedupeByLabel(options);
}

/** Giữ lựa chọn đầu tiên cho mỗi ký hiệu, bỏ trùng. */
function dedupeByLabel(options) {
    const seen = new Set();
    const result = [];
    for (const option of options) {
        if (seen.has(option.label)) continue;
        seen.add(option.label);
        result.push(option);
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Nhận diện lựa chọn của một câu hỏi: thử cả dòng riêng lẫn trong một đoạn.
 *
 * @param {Array<{text: string}>} paragraphs đoạn văn thuộc thân câu hỏi
 * @returns {{options: Array<{label: string, text: string}>, detected: boolean}}
 */
function detectOptions(paragraphs) {
    const lines = paragraphs.map(item => item.text);
    const fromLines = detectOptionsFromLines(lines);
    if (fromLines.length >= 2) return { options: fromLines, detected: true };

    // Trường hợp lựa chọn nằm chung một đoạn (Word hay gộp khi người dùng gõ).
    const joined = paragraphs
        .map(item => (item.hasFormula ? item.text : item.text))
        .join('\n');
    const fromText = detectOptionsFromText(joined);
    if (fromText.length >= 2) return { options: fromText, detected: true };

    // Giữ kết quả tốt nhất tìm được, kể cả khi chỉ có 1 lựa chọn.
    return { options: fromLines.length ? fromLines : fromText, detected: fromLines.length > 0 || fromText.length > 0 };
}

module.exports = {
    LINE_OPTION,
    INLINE_OPTION,
    cleanOptionText,
    detectOptions,
    detectOptionsFromLines,
    detectOptionsFromText,
    normalizeLabel
};