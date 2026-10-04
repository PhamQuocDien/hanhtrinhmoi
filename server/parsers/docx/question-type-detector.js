'use strict';

/**
 * Nhận diện LOẠI CÂU HỎI từ nội dung DOCX.
 *
 * Nguyên tắc: KHÔNG ĐOÁN. Nếu không đủ tín hiệu, câu được đánh dấu
 * `needsReview` và gán loại mặc định an toàn để admin quyết định.
 *
 * Thứ tự quyết định (từ tín hiệu mạnh nhất tới yếu nhất):
 *   1. Có dấu chấm lửng / gạch dưỡng trong thân  -> fill_blank
 *   2. Có lựa chọn A-D và đáp án nhiều ký hiệu   -> multiple_choice
 *   3. Có lựa chọn A-D                            -> single_choice
 *   4. Đề yêu cầu phân tích / giải thích        -> essay
 *   5. Đáp án là một số                          -> numeric
 *   6. Có đáp án ngắn đã biết                    -> short_answer
 *   7. Còn lại                                     -> essay (chờ duyệt)
 */

const { QUESTION_TYPES } = require('../../config/constants');

/**
 * Dấu thể hiện ô trống trong câu hỏi.
 * Yêu cầu TỐI THIỂU 2 ký tự gạch/dấu chấm liên tiếp để tránh nhận nhầm
 * dấu gạch trong phép trừ hoặc gạch nối từ.
 */
const BLANK_MARKER = /(_{2,}|\.{4,}|…{2,}|·{3,})/;

/** Cụm yêu cầu trả lời dạng tự luận. */
const ESSAY_CUES = [
    'hãy phân tích', 'phân tích', 'hãy giải thích', 'giải thích', 'hãy trình bày',
    'hãy chứng minh', 'chứng minh', 'hãy nhận xét', 'nhận xét', 'hãy bày tỏ',
    'hãy đánh giá', 'hãy so sánh', 'hãy liên hệ', 'hãy kể lại', 'hãy mô tả',
    'hãy cho ví dụ', 'ý kiến của bạn', 'suy nghĩ của bạn', 'hãy giải quyết',
    'giải quyết vấn đề', 'hãy lập luận', 'lập luận'
];

/** Cụm gợi ý câu trả lời ngắn. */
const SHORT_ANSWER_CUES = [
    'hãy nêu', 'nêu', 'liệt kê', 'ghi tên', 'kể tên', 'cho biết', 'xác định',
    'tính', 'đổi', 'viết', 'đọc', 'vẽ hình'
];

/**
 * Đếm các ô trống trong một đoạn văn.
 * Dùng chung bộ dò của blank-detector để hai nơi không hiểu ô trống khác nhau.
 *
 * @returns {{count: number, positions: number[]}}
 */
function countBlanks(text) {
    // eslint-disable-next-line global-require
    const { findBlankMarkers } = require('./blank-detector');
    const markers = findBlankMarkers(text);
    return { count: markers.length, positions: markers.map(marker => marker.index) };
}

/** Có dấu hiệu câu hỏi tự luận không. */
function looksLikeEssay(text) {
    const lower = String(text || '').toLowerCase();
    return ESSAY_CUES.some(cue => lower.includes(cue));
}

/** Có dấu hiệu câu hỏi trả lời ngắn không. */
function looksLikeShortAnswer(text) {
    const lower = String(text || '').toLowerCase();
    return SHORT_ANSWER_CUES.some(cue => lower.includes(cue));
}

/** Đáp án có phải một con số không (chấp nhận số thập phân, phân số, phần trăm). */
function looksNumeric(value) {
    const text = String(value ?? '').trim();
    if (!text || text.length > 40) return false;
    return /^-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?\s*%?$/.test(text);
}

/**
 * Quyết định loại câu hỏi.
 *
 * @param {object} input { text, options, answer }
 * @returns {{type: string, reason: string, needsReview: boolean, confidence: string}}
 */
function detectQuestionType({ text = '', options = [], answer = null } = {}) {
    const blanks = countBlanks(text);
    const labels = Array.isArray(options) ? options : [];

    // 1. Ô trống — tín hiệu mạnh nhất, độc lập với lựa chọn.
    if (blanks.count > 0) {
        return {
            type: QUESTION_TYPES.FILL_BLANK,
            reason: `Có ${blanks.count} dấu ô trống trong nội dung câu.`,
            needsReview: false,
            confidence: 'high'
        };
    }

    // 2 & 3. Có lựa chọn A-D.
    if (labels.length >= 2) {
        if (Array.isArray(answer) && answer.length >= 2) {
            return {
                type: QUESTION_TYPES.MULTIPLE_CHOICE,
                reason: 'Có lựa chọn A-D và đáp án gồm nhiều ký hiệu.',
                needsReview: false,
                confidence: 'high'
            };
        }
        return {
            type: QUESTION_TYPES.SINGLE_CHOICE,
            reason: 'Có lựa chọn A-D, đáp án là một ký hiệu.',
            needsReview: false,
            confidence: 'high'
        };
    }

    // 4. Câu yêu cầu phân tích / giải thích -> tự luận.
    if (looksLikeEssay(text)) {
        return {
            type: QUESTION_TYPES.ESSAY,
            reason: 'Đề bài yêu cầu phân tích / giải thích / trình bày.',
            needsReview: false,
            confidence: 'high'
        };
    }

    // 5. Đáp án là một số -> câu số.
    if (answer !== null && looksNumeric(answer)) {
        return {
            type: QUESTION_TYPES.NUMERIC,
            reason: 'Đáp án là một giá trị số.',
            needsReview: false,
            confidence: 'high'
        };
    }

    // 6. Câu lệnh ngắn và có đáp án ngắn đã biết -> trả lời ngắn.
    if (answer !== null && String(answer).trim()) {
        const short = looksLikeShortAnswer(text);
        return {
            type: QUESTION_TYPES.SHORT_ANSWER,
            reason: short
                ? 'Câu lệnh ngắn và có đáp án chấp nhận trong tài liệu.'
                : 'Không có lựa chọn, đã tìm thấy đáp án ngắn trong tài liệu.',
            needsReview: !short,
            confidence: short ? 'high' : 'medium'
        };
    }

    // 7. Không đủ tín hiệu -> tự luận + chờ duyệt. TUYỆT ĐỐI KHÔNG ĐOÁN.
    return {
        type: QUESTION_TYPES.ESSAY,
        reason: 'Không có lựa chọn và chưa xác định được đáp án — tạm xếp tự luận, cần admin xác nhận.',
        needsReview: true,
        confidence: 'low'
    };
}

/**
 * Nhận diện câu Đúng/Sai trong câu hỏi không có lựa chọn.
 * Câu đúng/sai đơn giản: nội dung là mệnh đề + đáp án là Đúng/Sai.
 * Câu đúng/sai NHIỀU ý: có các dòng a) b) c) d) trong thân câu.
 */
function detectTrueFalse({ text = '', answer = null, statements = [] } = {}) {
    // Dạng nhiều ý: các dòng con đã được tách sẵn.
    if (Array.isArray(statements) && statements.length >= 2) {
        return {
            isTrueFalse: true,
            isMultiStatement: true,
            reason: `Có ${statements.length} ý đánh giá Đúng/Sai trong câu.`
        };
    }

    const isBooleanAnswer = answer === true || answer === false
        || ['đúng', 'sai', 'true', 'false'].includes(String(answer ?? '').toLowerCase());
    if (!isBooleanAnswer) return { isTrueFalse: false, isMultiStatement: false, reason: 'Đáp án không phải Đúng/Sai.' };

    // Mệnh đề Đúng/Sai là khẳng định, không phải câu hỏi mở.
    const isStatement = !String(text || '').includes('?');
    return {
        isTrueFalse: true,
        isMultiStatement: false,
        isStatement,
        reason: isStatement
            ? 'Đáp án là Đúng/Sai và nội dung là mệnh đề.'
            : 'Đáp án là Đúng/Sai nhưng nội dung là câu hỏi — cần admin kiểm tra.'
    };
}

module.exports = {
    BLANK_MARKER,
    ESSAY_CUES,
    SHORT_ANSWER_CUES,
    countBlanks,
    detectQuestionType,
    detectTrueFalse,
    looksLikeEssay,
    looksLikeShortAnswer,
    looksNumeric
};