'use strict';

/**
 * Nhận diện phần giải thích đáp án.
 *
 * Nhiều đề viết giải thích theo nhiều cách:
 *   "Giải thích: ..."  |  "Lời giải: ..."  |  "Nhận xét: ..."
 *   "Vì ..."           |  "Do ..."          |  "Theo định nghĩa ..."
 * hoặc giải thích nằm ở CÁC DÒNG SAU dòng "Đáp án" cho tới câu hỏi kế tiếp.
 */

/** Nhãn mở đầu giải thích. */
const EXPLANATION_LABEL = /^\s*(?:giải\s*thích(?:\s*đáp\s*án)?|lời\s*giải|nhận\s*xét|thuyết\s*minh|explanation|solution)\s*[:\-–—]?\s*(.*)$/i;

/** Cụm mở đầu mang tính giải thích khi không có nhãn. */
const EXPLANATION_HINT = /^\s*(?:vì\s|do\s|lời\s+giải|ta\s+có|theo\s+định\s*nghĩa|nhận\s*xét)/i;

/**
 * Trích giải thích từ các đoạn thân câu hỏi.
 * Chỉ dùng nội dung sau dòng đáp án, tránh lấy nhầm phần lựa chọn.
 *
 * @returns {string}
 */
function detectExplanation(paragraphs, { afterAnswerOnly = true } = {}) {
    const texts = paragraphs.map(item => String(item.text || ''));
    const startIndex = findAnswerLineIndex(texts);

    const candidates = startIndex >= 0 && afterAnswerOnly
        ? texts.slice(startIndex + 1)
        : texts;

    const explicit = [];
    const hinted = [];

    for (const text of candidates) {
        if (!text) continue;
        const labelMatch = text.match(EXPLANATION_LABEL);
        if (labelMatch) {
            const rest = labelMatch[1].trim();
            if (rest) explicit.push(rest);
            continue;
        }
        // Bỏ qua dòng là lựa chọn hoặc dòng đáp án.
        if (/^\s*[A-H]\s*[.):\-–—]/i.test(text)) continue;
        if (/^\s*(?:đáp\s*án|answer)/i.test(text)) continue;
        if (EXPLANATION_HINT.test(text)) hinted.push(text.trim());
    }

    if (explicit.length) return explicit.join(' ');
    if (hinted.length) return hinted.join(' ');
    return '';
}

/** Vị trí của dòng chứa "Đáp án" trong danh sách đoạn, hoặc -1. */
function findAnswerLineIndex(texts) {
    return texts.findIndex(text => /^\s*(?:đáp\s*án(?:\s*đúng)?|answer)\s*[:\-–—]?/i.test(text));
}

module.exports = {
    EXPLANATION_HINT,
    EXPLANATION_LABEL,
    detectExplanation,
    findAnswerLineIndex
};