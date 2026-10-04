'use strict';

/**
 * Nhận diện Ô TRỐNG (câu điền khuyết) trong nội dung DOCX.
 *
 * Ba dạng dấu ô trống thường gặp trong đề thi Word:
 *   "Thủ đô Việt Nam là ______."
 *   "Thủ đô Việt Nam là ............"
 *   "Thủ đô Việt Nam là _____"
 *
 * KHÔNG tự biến mọi dấu gạch thành ô trống:
 *   - Dấu gạch giữa hai số là phép trừ: "5 - 3".
 *   - Gạch nối từ: "Hà-Nội".
 *   - Dấu gạch trang trí (----).
 * Khi không chắc -> KHÔNG tạo ô trống, trả về warning cho admin.
 */

const BLANK_PATTERNS = Object.freeze([
    { name: 'underscore', pattern: /_{2,}/ },
    { name: 'dots', pattern: /\.{4,}/ },
    { name: 'ellipsis', pattern: /…{2,}|\.{3,}/ },
    { name: 'middle-dots', pattern: /·{3,}|∙{3,}/ }
]);

/**
 * Tìm các dấu ô trống trong MỘT đoạn văn.
 * @returns {Array<{index: number, length: number, style: string, marker: string}>}
 */
function findBlankMarkers(text) {
    const value = String(text || '');
    if (!value) return [];

    const found = [];
    // Duyệt từ trái sang phải, bỏ qua ký tự đã nằm trong một dấu tìm thấy trước.
    let cursor = 0;
    while (cursor < value.length) {
        let best = null;
        for (const { name, pattern } of BLANK_PATTERNS) {
            const regex = new RegExp(pattern.source, 'g');
            regex.lastIndex = cursor;
            const match = regex.exec(value);
            if (match && (!best || match.index < best.index)) {
                best = { name, index: match.index, length: match[0].length, marker: match[0] };
            }
        }
        if (!best) break;

        const before = value.slice(Math.max(0, best.index - 3), best.index);
        const after = value.slice(best.index + best.length, best.index + best.length + 3);

        // ---- Loại trừ: dấu gạch trong phép trừ "5 - 3", "10-2" ----
        const isArithmetic = /^[-+*/]/.test(best.marker)
            && /[\d)\]]\s*$/.test(before)
            && /^\s*[\d(\[{]/.test(after);
        // ---- Loại trừ: gạch nối trong "Hà-Nội" ----
        const isHyphenJoin = /^-+$/.test(best.marker)
            && /\p{L}\s*$/u.test(before)
            && /^\s*\p{L}/u.test(after);
        // ---- Loại trừ: dấu trang trí (----) ----
        const isDecoration = /^[-=_*#~]{4,}$/.test(value.trim());

        if (!isArithmetic && !isHyphenJoin && !isDecoration) found.push(best);
        cursor = best.index + best.length;
    }
    return found;
}

/**
 * Dựng danh sách ô trống cho một câu điền khuyết.
 *
 * @param {string} questionText nội dung câu (đã bỏ số thứ tự câu)
 * @param {object} [options]
 *   - answers    : map { "blank-1": "Hà Nội" } lấy từ dòng "Đáp án" của câu.
 *   - totalPoints: điểm của cả câu, chia đều cho các ô.
 * @returns {{blanks: Array, warnings: string[], replacedText: string, hasBlankMarker: boolean}}
 */
function detectBlanks(questionText, { answers = null, totalPoints = 1 } = {}) {
    const text = String(questionText || '');
    const markers = findBlankMarkers(text);
    const warnings = [];

    if (!markers.length) {
        return {
            blanks: [],
            warnings: ['Không tìm thấy dấu ô trống trong nội dung câu.'],
            replacedText: text,
            hasBlankMarker: false
        };
    }

    // Chia điểm đều cho các ô; làm tròn 3 chữ số để tổng không lệch.
    const perBlank = Math.round((Number(totalPoints) || 1) / markers.length * 1000) / 1000;

    const blanks = markers.map((marker, index) => {
        const blankId = `blank-${index + 1}`;
        const key = String(index + 1);
        const raw = answers ? (answers[blankId] ?? answers[key]) : null;
        const correctAnswers = Array.isArray(raw)
            ? raw
            : (raw === undefined || raw === null || raw === '' ? [] : [raw]);

        if (!correctAnswers.length) {
            warnings.push(`Ô ${index + 1} chưa có đáp án trong tài liệu — cần admin nhập, tuyệt đối không đoán.`);
        }

        return {
            blankId,
            position: index + 1,
            correctAnswers,
            points: perBlank,
            // Mặc định chỉ bỏ khoảng trắng thừa; KHÔNG bỏ dấu, KHÔNG hạ chữ thường.
            // Admin phải tự bật `caseInsensitive` nếu thực sự muốn.
            normalization: {
                trimWhitespace: true,
                caseInsensitive: false,
                normalizeUnicode: true,
                stripDiacritics: false,
                collapseSeparators: false
            },
            hint: ''
        };
    });

    // Thay dấu ô trống bằng placeholder để UI hiển thị input đúng vị trí.
    // Lùi từ cuối để chỉ số không bị lệch khi thay.
    let replacedText = text;
    for (let index = markers.length - 1; index >= 0; index -= 1) {
        const marker = markers[index];
        replacedText = `${replacedText.slice(0, marker.index)}[[blank-${index + 1}]]${replacedText.slice(marker.index + marker.length)}`;
    }

    return { blanks, warnings, replacedText, hasBlankMarker: true };
}

/**
 * Tách các ý con a) b) c) d) của một câu Đúng/Sai nhiều ý.
 *
 * CHỈ nhận ký hiệu CHỮ THƯỜNG. Ký hiệu in hoa A B C D là LỰA CHỌN, không
 * phải ý con — nhận nhầm sẽ biến câu trắc nghiệm thành câu Đúng/Sai nhiều ý.
 *
 * @param {Array<{text: string}>} paragraphs
 * @returns {Array<{statementId: string, text: string}>}
 */
function detectSubStatements(paragraphs = []) {
    const statementPattern = /^\s*([a-zà-ỹ])\s*[.)\-–—]\s*(.+)$/;
    const statements = [];

    for (const paragraph of paragraphs) {
        const match = String(paragraph?.text || '').match(statementPattern);
        if (!match) continue;
        const text = match[2].trim();
        if (!text) continue;
        statements.push({
            statementId: `s-${String(statements.length + 1).padStart(2, '0')}`,
            text
        });
    }

    // Cần ít nhất 2 ý mới coi là dạng nhiều ý; 1 ý có thể là lựa chọn lỡ.
    return statements.length >= 2 ? statements : [];
}

module.exports = {
    BLANK_PATTERNS,
    detectBlanks,
    detectSubStatements,
    findBlankMarkers
};