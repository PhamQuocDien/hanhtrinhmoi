'use strict';

/**
 * Sinh data/curriculum/grade-01.js .. grade-12.js từ dữ liệu chương trình cũ.
 *
 * Chạy:
 *   node scripts/migrate-curriculum.js --dry-run    (chỉ báo cáo, không ghi file)
 *   node scripts/migrate-curriculum.js             (ghi lại 12 file)
 *
 * Script idempotent: chạy lại nhiều lần cho kết quả giống nhau.
 * `generatedAt` cố tình để null để đầu ra ổn định giữa các lần chạy.
 */

const fs = require('fs');
const path = require('path');
const { buildGradeCurriculum } = require('../data/curriculum/curriculum-builder');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'data', 'curriculum');
const GRADES = Array.from({ length: 12 }, (_, index) => index + 1);

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n');

/** Tên file theo quy ước grade-NN.js (2 chữ số). */
function gradeFileName(grade) {
    return `grade-${String(grade).padStart(2, '0')}.js`;
}

/** Render một file dữ liệu lớp. */
function renderGradeFile(grade, data) {
    return `'use strict';

// TỰ ĐỘNG SINH BỞI scripts/migrate-curriculum.js — ĐỪNG SỬA TAY.
// Nguồn: curriculum-data.js (dự án cũ) — mọi bản ghi NEEDS_VERIFICATION,
// cần đối chiếu lại với bản in sách giáo khoa trước khi dùng cho học sinh.

module.exports = ${JSON.stringify(data, null, 4)};
`;
}

function main() {
    console.log(DRY_RUN
        ? '🔍 CHẾ ĐỘ DRY-RUN: không ghi file nào.'
        : '✍️  Đang sinh dữ liệu chương trình theo lớp...');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const report = [];
    for (const grade of GRADES) {
        const data = buildGradeCurriculum(grade);
        const file = path.join(OUTPUT_DIR, gradeFileName(grade));
        const content = renderGradeFile(grade, data);

        let action = 'unchanged';
        if (!fs.existsSync(file)) action = 'created';
        else if (fs.readFileSync(file, 'utf8') !== content) action = 'updated';

        if (!DRY_RUN && action !== 'unchanged') fs.writeFileSync(file, content, 'utf8');

        report.push({
            grade,
            file: `data/curriculum/${gradeFileName(grade)}`,
            action,
            subjects: data.subjectCount,
            lessons: data.lessonCount,
            pendingImport: data.subjectsPendingImport.length,
            bytes: Buffer.byteLength(content, 'utf8')
        });
    }

    for (const row of report) {
        console.log(
            `  Lớp ${String(row.grade).padStart(2, ' ')}  ${row.action.padEnd(9)}` +
            ` ${String(row.subjects).padStart(2)} môn` +
            ` ${String(row.lessons).padStart(3)} bài` +
            ` ${String(row.pendingImport).padStart(2)} môn cần nhập` +
            ` (${row.bytes} bytes)`
        );
    }

    const totalLessons = report.reduce((sum, row) => sum + row.lessons, 0);
    const totalPending = report.reduce((sum, row) => sum + row.pendingImport, 0);
    console.log(`\nTổng: ${report.length} lớp, ${totalLessons} bài học có tên nguồn, ${totalPending} môn cần admin nhập tên bài.`);
    console.log(DRY_RUN ? 'Dry-run xong (không ghi file).' : 'Đã ghi xong.');
}

if (require.main === module) main();

module.exports = { renderGradeFile, gradeFileName };