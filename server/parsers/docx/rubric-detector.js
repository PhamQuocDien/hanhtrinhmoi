'use strict';

/**
 * Nhận diện RUBRIC (thang chấm điểm chi tiết) cho câu tự luận.
 *
 * Nhiều đề thi in sẵn phần "Hướng dẫn chấm" ở cuối tài liệu:
 *
 *   Câu 10. Hướng dẫn chấm:
 *   - Ý 1: 2 điểm
 *   - Ý 2: 3 điểm
 *   - Lập luận: 2 điểm
 *   - Trình bày: 1 điểm
 *
 * Hoặc dạng một dòng: "Câu 10: Ý 1 (2đ), Lập luận (2,5đ), Trình bày (1đ)"
 *
 * Nếu không tìm thấy rubric -> KHÔNG BỊA. Trả về mảng rỗng kèm warning,
 * câu đó vẫn là tự luận nhưng admin phải soạn rubric trước khi publish.
 */

/** Nhãn mở đầu phần hướng dẫn chấm. */
const GUIDING_LABEL = /^\s*(?:hướng\s*dẫn\s*chấm|tham\s*khảo|thang\s*điểm|h\d1\s*đi\s*chấm|rubric)\s*[:\-–—]?\s*(.*)$/i;

/** Một tiêu chí: "Ý 1: 2 điểm" | "Lập luận (2,5 điểm)" | "- Trình bày: 1đ" */
const CRITERION_LINE = /^\s*(?:[-•*]\s*)?(.{1,120}?)\s*[:(\-–]\s*(\d+(?:[.,]\d+)?)\s*(?:điểm|đ|pt)\s*\)?\s*$/i;

/**
 * Số điểm trong một tiêu chí, ví dụ "2 điểm", "2đ", "1,5 đ".
 * Dấu kết thúc phải là ranh giới từ HOẶC ký tự đóng ngoặc, vì "2đ)" hay
 * xuất hiện rất phổ biến trong đề thi Word.
 */
const NUMERIC_CRITERION = /(\d+(?:[.,]\d+)?)\s*(?:điểm|đ)(?=\W|$)/gi;

/**
 * Lấy danh sách tiêu chí từ các dòng văn bản.
 * @param {Array<string>} lines
 * @returns {Array<{criterionId: string, description: string, maxPoints: number}>}
 */
function parseCriteria(lines = []) {
    const criteria = [];
    for (const line of lines) {
        const text = String(line || '').trim();
        if (!text) continue;

        // Dạng gộp trên một dòng: "Ý 1 (2đ), Lập luận (2,5đ)". Phải thử TRƯỚC
        // mẫu một tiêu chí, vì mẫu một tiêu chí cũng khớp và sẽ nuốt cả dòng.
        NUMERIC_CRITERION.lastIndex = 0;
        const matches = [...text.matchAll(NUMERIC_CRITERION)];
        if (matches.length >= 2) {
            let cursor = 0;
            for (const item of matches) {
                // Bỏ phần "(2đ)" đã bị regex ăn vào trước mốc hiện tại.
                const raw = text.slice(cursor, item.index);
                const description = raw
                    .replace(/[,;:]+\s*$/, '')
                    .replace(/[([{]\s*$/, '')
                    .trim();
                cursor = item.index + item[0].length;
                if (description.length >= 2) {
                    criteria.push({
                        criterionId: `c${String(criteria.length + 1).padStart(2, '0')}`,
                        description,
                        maxPoints: Number(item[1].replace(',', '.'))
                    });
                }
            }
            if (criteria.length) continue;
        }

        const match = text.match(CRITERION_LINE);
        if (match) {
            const description = match[1].replace(/^[-•*]\s*/, '').replace(/[:(\-–]\s*$/, '').trim();
            if (description) {
                criteria.push({
                    criterionId: `c${String(criteria.length + 1).padStart(2, '0')}`,
                    description,
                    maxPoints: Number(match[2].replace(',', '.'))
                });
            }
        }
    }
    return criteria;
}

/**
 * Tìm phần hướng dẫn chấm của một câu trong danh sách đoạn thân câu.
 *
 * @param {Array<{text: string}>} paragraphs thân câu hỏi
 * @returns {{rubric: Array, warnings: string[], guideText: string}}
 */
function detectRubric(paragraphs = []) {
    const texts = paragraphs.map(item => String(item?.text || ''));
    const warnings = [];

    const labelIndex = texts.findIndex(text => GUIDING_LABEL.test(text));
    if (labelIndex < 0) {
        return {
            rubric: [],
            warnings: ['Không tìm thấy hướng dẫn chấm — cần admin soạn rubric trước khi publish.'],
            guideText: ''
        };
    }

    // Nội dung ngay sau nhãn là dòng đầu tiên của hướng dẫn.
    const inlineContent = (texts[labelIndex].match(GUIDING_LABEL)?.[1] || '').trim();
    const candidates = [];
    if (inlineContent) candidates.push(inlineContent);
    candidates.push(...texts.slice(labelIndex + 1));

    const rubric = parseCriteria(candidates);

    if (rubric.length < 2) {
        warnings.push('Hướng dẫn chấm không đủ tiêu chí rõ ràng — cần admin kiểm tra lại.');
    }
    if (rubric.some(item => !Number.isFinite(item.maxPoints) || item.maxPoints <= 0)) {
        warnings.push('Có tiêu chí chấm 0 điểm — cần admin kiểm tra lại.');
    }

    return {
        rubric,
        warnings,
        guideText: candidates.join(' ').trim()
    };
}

/**
 * Tra rubric của câu N từ bảng hướng dẫn chấm cuối tài liệu.
 * Bảng này dùng khi đề thi in "Câu 10: Hướng dẫn chấm ..." ở CUỐI tài liệu.
 *
 * @param {Array<{text: string}>} paragraphs toàn bộ đoạn văn tài liệu
 * @returns {Map<number, Array<object>>} map số câu -> rubric
 */
function detectRubricKey(paragraphs = []) {
    const result = new Map();
    const texts = paragraphs.map(item => String(item?.text || ''));

    for (let index = 0; index < texts.length; index += 1) {
        // "10. Hướng dẫn chấm:" hoặc "Câu 10: Hướng dẫn chấm"
        const match = texts[index].match(/^\s*(?:câu\s*)?(\d{1,3})\s*[.):\-–—]\s*(?:hướng\s*dẫn\s*chấm|tham\s*khảo|rubric)\s*[:\-–—]?\s*(.*)$/i);
        if (!match) continue;

        const questionNumber = Number.parseInt(match[1], 10);
        if (!Number.isInteger(questionNumber)) continue;

        const candidates = [];
        if (match[2].trim()) candidates.push(match[2].trim());
        // Thu thập dòng tiếp theo cho tới khi gặp dòng bắt đầu câu mới.
        for (let next = index + 1; next < texts.length; next += 1) {
            if (/^\s*(?:câu\s*)?\d{1,3}\s*[.):\-–—]/.test(texts[next])) break;
            if (!texts[next].trim()) continue;
            candidates.push(texts[next]);
            if (candidates.length >= 10) break;
        }

        const rubric = parseCriteria(candidates);
        if (rubric.length) result.set(questionNumber, rubric);
    }

    return result;
}

/** Tổng điểm của một rubric. */
function totalRubricPoints(rubric = []) {
    return Math.round(rubric.reduce((sum, item) => sum + (Number(item.maxPoints) || 0), 0) * 1000) / 1000;
}

module.exports = {
    CRITERION_LINE,
    GUIDING_LABEL,
    detectRubric,
    detectRubricKey,
    parseCriteria,
    totalRubricPoints
};