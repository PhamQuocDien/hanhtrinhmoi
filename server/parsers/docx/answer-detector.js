'use strict';

/**
 * Nhận diện đáp án trong DOCX.
 *
 * Nguồn đáp án có thể nằm ở ba nơi:
 *   1. Ngay trong từng câu: "Đáp án: B", "Đáp án đúng: C", "Đáp án: A, C"
 *   2. Cuối tài liệu dưới dạng bảng đáp án: "1. B", "2) C", "1-A", "1: A"
 *   3. Không có — KHI ĐÓ KHÔNG ĐOÁN, để đáp án là null.
 *
 * Chỉ chấp nhận ký hiệu thực sự tồn tại trong danh sách lựa chọn của câu.
 */

const { normalizeLabel } = require('./option-detector');

/** Dòng đáp án nằm trong câu. */
const INLINE_ANSWER = /^\s*(?:đáp\s*án(?:\s*đúng)?|đáp\s*án\s*trả\s*lời|answer)\s*[:\-–—]?\s*(.+)$/i;

/** Dòng giải thích đi kèm đáp án. */
const INLINE_EXPLANATION = /^\s*(?:giải\s*thích(?:\s*đáp\s*án)?|lời\s*giải|explanation)\s*[:\-–—]?\s*(.+)$/i;

/**
 * Dòng trong bảng đáp án cuối tài liệu.
 * "1. B" | "1) C" | "1-A" | "1: D" | "Câu 1: A"
 */
const ANSWER_KEY_LINE = /^\s*(?:câu\s*)?(\d{1,3})\s*[.):\-–—]\s*([A-H](?:\s*[,;và và]+\s*[A-H])*)\s*$/i;

/** Kiểm tra chuỗi có phải mẫu đáp án nhiều lựa chọn không. */
const MULTI_ANSWER = /^[A-H](?:\s*[,;và và]+\s*[A-H])+$/i;

/** Đáp án viết bằng chữ, không phải ký hiệu A-D. */
const WORD_ANSWER = /^(đúng|sai|true|false|không|có|động|vô định|hữu hạn|vô hạn)$/i;

/** Đáp án là một giá trị số (kể cả số thập phân, phân số, phần trăm). */
const NUMERIC_ANSWER = /^-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?\s*%?$/;

/**
 * Đáp án có phải một danh sách được phân tách bằng dấu phẩy/chấm phẩy không.
 * Ví dụ ô trống hai chỗ: "Đông; Tây" hoặc "Hà Nội, Paris".
 */
function splitListAnswer(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    const parts = text
        .split(/\s*[;,]\s*|\s+và\s+|\s+\/\s+/)
        .map(part => part.trim())
        .filter(Boolean);
    // Một giá trị đơn không phải danh sách.
    return parts.length > 1 ? parts : null;
}

/**
 * Chuẩn hoá đáp án KHÔNG thuộc dạng chọn ký hiệu A-D.
 * Dùng cho điền khuyết, trả lời ngắn, câu số, Đúng/Sai.
 *
 * @returns {string|string[]|boolean|null}
 */
function normalizeFreeAnswerValue(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;

    if (WORD_ANSWER.test(text)) {
        return ['đúng', 'true', 'có', 'động'].includes(text.toLowerCase());
    }

    // Số thuần -> trả về số để câu số so khớp chính xác.
    if (NUMERIC_ANSWER.test(text)) {
        const parsed = Number(text.replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : text;
    }

    const list = splitListAnswer(text);
    if (list) return list;

    // Còn lại: giữ nguyên dạng chuỗi để so khớp với chuẩn hoá mặc định.
    return text;
}

/**
 * Chuẩn hoá giá trị đáp án từ một chuỗi.
 * @returns {string|string[]|null}
 */
function normalizeAnswerValue(raw, availableLabels) {
    const text = String(raw || '').trim();
    if (!text) return null;

    const letters = text.toUpperCase().match(/[A-H]/g);
    if (!letters || !letters.length) return null;

    // Chỉ nhận ký hiệu thực sự có trong danh sách lựa chọn.
    const valid = [...new Set(letters)].filter(label => availableLabels.includes(label));
    if (!valid.length) return null;

    if (valid.length === 1) return valid[0];
    return valid.sort();
}

/**
 * Tìm dòng đáp án/giải thích trong thân một câu hỏi.
 *
 * `availableLabels` rỗng nghĩa là câu KHÔNG có lựa chọn A-D — khi đó đọc
 * đáp án tự do (điền khuyết, trả lời ngắn, số, Đúng/Sai).
 *
 * @returns {{answer: *, explanation: string, answerRaw: string|null}}
 */
function detectAnswerInQuestion(paragraphs, availableLabels = ['A', 'B', 'C', 'D']) {
    let answer = null;
    let answerRaw = null;
    let explanation = '';
    const usesLabels = Array.isArray(availableLabels) && availableLabels.length > 0;

    for (const paragraph of paragraphs) {
        const text = paragraph.text || '';

        const explanationMatch = text.match(INLINE_EXPLANATION);
        if (explanationMatch) {
            if (!explanation) explanation = explanationMatch[1].trim();
            continue;
        }

        const answerMatch = text.match(INLINE_ANSWER);
        if (answerMatch && answer === null) {
            answerRaw = answerMatch[1].trim();
            answer = usesLabels
                ? normalizeAnswerValue(answerRaw, availableLabels)
                : normalizeFreeAnswerValue(answerRaw);
        }
    }

    return { answer, explanation, answerRaw };
}

/**
 * Tìm bảng đáp án ở cuối tài liệu.
 * Chỉ coi là bảng đáp án khi có ÍT NHẤT 2 dòng khớp mẫu, tránh nhầm với nội dung.
 *
 * @returns {Map<number, string|string[]>}
 */
function detectAnswerKey(paragraphs, availableLabelsByNumber = {}) {
    const map = new Map();

    for (const paragraph of paragraphs) {
        const match = String(paragraph.text || '').match(ANSWER_KEY_LINE);
        if (!match) continue;

        const number = Number.parseInt(match[1], 10);
        if (!Number.isInteger(number)) continue;

        const available = availableLabelsByNumber[number] || ['A', 'B', 'C', 'D'];
        const value = normalizeAnswerValue(match[2], available);
        if (value !== null) map.set(number, value);
    }

    // Cần tối thiểu 2 dòng mới tin đây là bảng đáp án, không phải nội dung câu hỏi.
    return map.size >= 2 ? map : new Map();
}

/** Kiểm tra chuỗi có phải mẫu đáp án nhiều lựa chọn không. */
function isMultiAnswer(value) {
    return Array.isArray(value);
}

module.exports = {
    ANSWER_KEY_LINE,
    INLINE_ANSWER,
    INLINE_EXPLANATION,
    MULTI_ANSWER,
    NUMERIC_ANSWER,
    WORD_ANSWER,
    detectAnswerInQuestion,
    detectAnswerKey,
    isMultiAnswer,
    normalizeAnswerValue,
    normalizeFreeAnswerValue,
    splitListAnswer
};