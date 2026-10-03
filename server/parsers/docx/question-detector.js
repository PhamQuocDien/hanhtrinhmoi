'use strict';

/**
 * Nhận diện câu hỏi trong danh sách đoạn văn đã trích từ DOCX.
 *
 * Hỗ trợ các cách viết phổ biến trong đề thi Word:
 *   "Câu 1." / "Câu 12:" / "Câu 3 -" / "1." / "12)" / "Bài 1:"
 *
 * Nguyên tắc: chỉ nhận diện nếu đủ tin cậy. Mẫu câu hỏi không khớp mẫu nào
 * thì câu đó sẽ không được tạo — tốt hơn là tạo câu hỏi sai.
 */

/** Mẫu đầu câu hỏi, theo thứ tự ưu tiên từ cụ thể tới tổng quát. */
const QUESTION_START_PATTERNS = [
    // "Câu 1." / "Câu 1:" / "Câu 1 -" / "CAU 1."
    { pattern: /^\s*câu\s*(\d{1,3})\s*[.):\-–—]\s*(.*)$/i, source: 'cau-numbered' },
    // "Bài 1:" — một số đề dùng "Bài" thay "Câu".
    { pattern: /^\s*bài\s*(\d{1,3})\s*[.):\-–—]\s*(.*)$/i, source: 'bai-numbered' },
    // "1." / "12)" — chỉ nhận khi dòng đó KHÔNG phải lựa chọn A-D và có nội dung.
    { pattern: /^\s*(\d{1,3})\s*[.)]\s+(.*)$/, source: 'plain-numbered' },
    // "Câu 1" không có dấu chấm kết thúc.
    { pattern: /^\s*câu\s*(\d{1,3})\s*:?\s+(.*)$/i, source: 'cau-prefix' }
];

/** Các mẫu đầu đoạn tuyệt đối không phải câu hỏi. */
const NOT_QUESTION_PATTERNS = [
    /^\s*(đáp\s*án|đáp án đúng|answer|key)\b/i,
    /^\s*(giải\s*thích|giải thích đáp án)\b/i,
    /^\s*(học\s*sinh|thời\s*gian|lưu\s*ý|chú\s*ý)\b/i,
    /^\s*(đề\s*thi|bài\s*kiểm\s*tra|kiểm\s*tra)\b/i
];

/** Một dòng có phải lựa chọn A/B/C/D không (để loại khỏi mẫu số thứ tự). */
const OPTION_PATTERN = /^\s*[A-H]\s*[.):\-–]\s*\S/i;

/**
 * Kiểm tra một dòng có phải bắt đầu câu hỏi không.
 *
 * Thân câu hỏi có thể nằm trên nhiều dòng (Word hay để xuống dòng trong câu,
 * hoặc chứa công thức). Vì vậy mẫu chỉ khớp với DÒNG ĐẦU TIÊN; phần còn lại
 * được giữ nguyên trong `stem`.
 *
 * @returns {{isQuestion: boolean, number?: number, stem: string, source: string}}
 */
function matchQuestionStart(line) {
    const raw = String(line || '');
    const newlineIndex = raw.indexOf('\n');
    const firstLine = (newlineIndex >= 0 ? raw.slice(0, newlineIndex) : raw).trim();
    // Phần còn lại của đoạn (nếu có) nối tiếp vào thân câu hỏi.
    const remainder = newlineIndex >= 0 ? raw.slice(newlineIndex + 1).trim() : '';

    if (!firstLine) return { isQuestion: false };

    // Lựa chọn không bao giờ là câu hỏi.
    if (OPTION_PATTERN.test(firstLine)) return { isQuestion: false };
    // Các mục dẫn không phải câu hỏi.
    for (const pattern of NOT_QUESTION_PATTERNS) {
        if (pattern.test(firstLine)) return { isQuestion: false };
    }

    for (const { pattern, source } of QUESTION_START_PATTERNS) {
        const match = firstLine.match(pattern);
        if (!match) continue;
        const number = Number.parseInt(match[1], 10);
        const stem = [match[2] || '', remainder].filter(Boolean).join(' ').trim();
        // Số thứ tự hợp lệ (1-999) và phần nội dung không rỗng.
        if (!Number.isInteger(number) || number < 1 || number > 999) return { isQuestion: false };
        if (!stem) return { isQuestion: false };
        return { isQuestion: true, number, stem, source };
    }

    return { isQuestion: false };
}

/**
 * Tách danh sách đoạn văn thành các khối câu hỏi.
 *
 * @param {Array<{text: string}>} paragraphs
 * @returns {Array<{number: number, stem: string, startIndex: number}>}
 */
function splitIntoQuestions(paragraphs) {
    const questions = [];

    for (let index = 0; index < paragraphs.length; index += 1) {
        const match = matchQuestionStart(paragraphs[index].text);
        if (!match.isQuestion) continue;

        const previous = questions[questions.length - 1];
        // Bỏ qua số thứ tự lặp lại do mục lục/đầu bài in ngoài ý muốn.
        if (previous && match.number <= previous.number) continue;

        questions.push({
            number: match.number,
            stem: match.stem,
            startIndex: index,
            source: match.source
        });
    }

    return questions;
}

/** Vị trí kết thúc của một câu hỏi (trước câu hỏi kế tiếp). */
function endIndexOfQuestion(questions, position, paragraphsLength) {
    if (position + 1 < questions.length) return questions[position + 1].startIndex;
    return paragraphsLength;
}

module.exports = {
    OPTION_PATTERN,
    NOT_QUESTION_PATTERNS,
    QUESTION_START_PATTERNS,
    endIndexOfQuestion,
    matchQuestionStart,
    splitIntoQuestions
};