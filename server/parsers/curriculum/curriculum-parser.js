'use strict';

/**
 * Công cụ đọc dữ liệu chương trình CŨ (curriculum-data.js) để phục vụ migration.
 *
 * File cũ là một khối JavaScript lớn, không export GRADE_THEMES/TOPICS.
 * Ta đọc bằng cách cắt đoạn mã nguồn rồi đánh giá trong hàm kín — không `eval`
 * toàn bộ file và không phụ thuộc thứ tự khai báo bên trong.
 *
 * Mục đích: scripts/migrate-curriculum.js dùng để SINH data/curriculum/grade-NN.js
 * một lần, sau đó dữ liệu mới là nguồn đọc chính. Không phụ thuộc file cũ ở
 * runtime.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// server/parsers/curriculum/ -> server/parsers/ -> server/ -> <root>
const LEGACY_CURRICULUM_PATH = path.resolve(__dirname, '../../../curriculum-data.js');

/** Cắt một hằng `const NAME = {...};` hoặc `const NAME = {...` ra khỏi mã nguồn. */
function extractObjectLiteral(source, name) {
    const marker = `const ${name}`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Không tìm thấy "${name}" trong curriculum-data.js`);

    const braceStart = source.indexOf('{', start);
    if (braceStart < 0) throw new Error(`"${name}" không phải object literal`);

    // Quét cân bằng ngoặc, bỏ qua dấu nháy và chú thích để không cắt nhầm.
    let depth = 0;
    let quote = null;
    let index = braceStart;
    for (; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
            if (char === '\\') { index += 1; continue; }
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) break;
        }
    }
    if (depth !== 0) throw new Error(`"${name}" không cân bằng ngoặc`);

    const literal = source.slice(braceStart, index + 1);
    return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 5000 });
}

/** Cắt một hằng `const NAME = [` (mảng) ra khỏi mã nguồn. */
function extractArrayLiteral(source, name) {
    const marker = `const ${name}`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Không tìm thấy "${name}" trong curriculum-data.js`);
    const bracketStart = source.indexOf('[', start);
    let depth = 0;
    let quote = null;
    let index = bracketStart;
    for (; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
            if (char === '\\') { index += 1; continue; }
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
        if (char === '[') depth += 1;
        else if (char === ']') {
            depth -= 1;
            if (depth === 0) break;
        }
    }
    return vm.runInNewContext(`(${source.slice(bracketStart, index + 1)})`, Object.create(null), { timeout: 5000 });
}

let cache = null;

/** Nạp và cache toàn bộ dữ liệu thô từ curriculum-data.js. */
function loadLegacyCurriculum() {
    if (cache) return cache;
    const source = fs.readFileSync(LEGACY_CURRICULUM_PATH, 'utf8');

    const GRADE_THEMES = extractObjectLiteral(source, 'GRADE_THEMES');
    const TOPICS = extractObjectLiteral(source, 'TOPICS');
    const GRADE_FOCUS = extractObjectLiteral(source, 'GRADE_FOCUS');
    const GRADE_SUBJECTS = extractObjectLiteral(source, 'GRADE_SUBJECTS');
    const OPTIONAL_BY_GRADE = extractObjectLiteral(source, 'OPTIONAL_BY_GRADE');

    // SUBJECTS là map id -> [tên, icon]; biến thành object thuận để đọc.
    const rawSubjects = extractObjectLiteral(source, 'SUBJECTS');
    const SUBJECTS = {};
    for (const [id, value] of Object.entries(rawSubjects)) {
        SUBJECTS[id] = { name: value[0], icon: value[1] };
    }

    // OPTIONAL_BY_GRADE chứa Set, không đọc được qua vm; quét thủ công từ mã nguồn.
    const optional = {};
    const optionalBlock = source.slice(source.indexOf('const OPTIONAL_BY_GRADE'), source.indexOf('const GRADE_FOCUS'));
    for (const line of optionalBlock.split('\n')) {
        const gradeMatch = line.match(/^\s*(\d+):\s*new Set\(\[([^\]]*)\]/);
        if (!gradeMatch) continue;
        const ids = gradeMatch[2].split(',').map(item => item.trim().replace(/^'|'$/g, '')).filter(Boolean);
        optional[gradeMatch[1]] = ids;
    }

    cache = { GRADE_THEMES, TOPICS, GRADE_FOCUS, GRADE_SUBJECTS, OPTIONAL_BY_GRADE: optional, SUBJECTS };
    return cache;
}

/** Danh sách chủ đề thực (nếu có) của một lớp + môn. */
function getGradeThemes(grade, subjectId) {
    const data = loadLegacyCurriculum();
    return data.GRADE_THEMES[grade]?.[subjectId] ? [...data.GRADE_THEMES[grade][subjectId]] : [];
}

/** Danh sách mạng chủ đề chung của một môn. */
function getTopics(subjectId) {
    const data = loadLegacyCurriculum();
    return data.TOPICS[subjectId] ? [...data.TOPICS[subjectId]] : [];
}

module.exports = {
    LEGACY_CURRICULUM_PATH,
    loadLegacyCurriculum,
    getGradeThemes,
    getTopics,
    extractObjectLiteral,
    extractArrayLiteral
};