'use strict';

/**
 * Tự kiểm tra dữ liệu chương trình.
 *
 *   node scripts/validate-curriculum.js [--json]
 *
 * Phát hiện:
 *  - lesson trùng lessonId / lessonCode / displayTitle
 *  - lesson thiếu subject / grade / source / verificationStatus
 *  - tên bài chứa dấu hiệu dữ liệu mẫu ("làm quen...", "qua thực hành...",
 *    "bổ trợ...", "sample", "demo", "test", "placeholder")
 *  - bài học sai cấp, môn học sai cấp
 *  - chương / bài thiếu khóa ổn định
 *  - môn tích hợp thiếu mạch nội dung
 */

const curriculum = require('../data/curriculum/curriculum-registry');
const { hasSubjectInGrade, getSubject } = require('../data/subjects/subject-registry');

/**
 * Cụm từ cho thấy dữ liệu bị sinh tự động chứ không phải tên bài thật.
 * So khớp không phân biệt hoa/thường.
 *
 * LƯU Ý: không được khớp quá rộng. "Làm quen bản đồ Việt Nam" là tên bài hậu
 * thật của Lịch sử và Địa lí lớp 4; chỉ dấu hiệu đáng ngờ là khi "làm quen"
 * nằm trong cụu trọng tâm lớp được nối tự động vào sau tên bài, tức có dấu
 * phẩy + "và" phía sau (đúng hình dạng "làm quen trường học, đọc viết ban đầu
 * và tư duy trực quan").
 */
const SAMPLE_PATTERNS = [
    // "Bài 1: ..." / "Bài 2 - ..." : tiền tố số thứ tự sinh tự động.
    { pattern: /^bài\s*\d+\s*[:.\-–—]/i, reason: 'tiền tố "Bài N:" sinh tự động thay vì tên bài thật' },
    // "Chặng 1:" / "Unit 2 -" : nhãn chặng nội bộ bị lẫn vào tên bài.
    { pattern: /\b(chặng|unit)\s*\d+\s*[:.\-–—]/i, reason: 'nhãn chặng nội bộ bị lẫn vào tên bài' },
    // "… — …" : dấu gạch dài nối tên bài với trọng tâm lớp trong dữ liệu cũ.
    { pattern: /\s[—–]\s/, reason: 'có dấu gạch dài nối tên bài với trọng tâm lớp được sinh tự động' },
    // Cụu trọng tâm lớp: "làm quen trường học, đọc viết ban đầu và tư duy trực quan".
    { pattern: /\blàm quen\s+\S+[^,]{0,60},[^,]{0,60}\s+và\s/i, reason: 'cụm trọng tâm lớp "làm quen …, … và …" được nối tự động vào tên bài' },
    // Các cụu trọng tâm lớp còn lại cũng theo cùng hình dạng danh sách.
    {
        pattern: /\b(củng cố nền tảng|học độc lập bước đầu|mở rộng kiến thức|hoàn thiện năng lực tiểu học)\b[^.]{0,80},\s*[^.]{0,80}\s+và\s/i,
        reason: 'cụm trọng tâm lớp được nối tự động vào tên bài'
    },
    { pattern: /\bqua thực hành\s*$/i, reason: 'đuôi "qua thực hành" được nối tự động vào tên bài' },
    { pattern: /\bbổ trợ\b/i, reason: 'cụm "bổ trợ" không phải tên bài học' },
    { pattern: /\b(sample|demo|placeholder|lorem|xxx|todo|draft)\b/i, reason: 'từ khoá dữ liệu mẫu' },
    { pattern: /\btest\s*\d+\b/i, reason: 'tên bài chứa "test"' }
];

/** Kiểm tra một tên bài có dấu hiệu dữ liệu mẫu không. */
function inspectTitle(title) {
    const value = String(title || '');
    if (!value.trim()) return { suspicious: true, reason: 'tên bài rỗng' };
    for (const { pattern, reason } of SAMPLE_PATTERNS) {
        if (pattern.test(value)) return { suspicious: true, reason };
    }
    return { suspicious: false, reason: null };
}

/** Chuẩn hoá tên để so trùng (bỏ dấu câu, hạ chữ thường, gộp khoảng trắng). */
function normalizeTitle(title) {
    return String(title || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function createReport() {
    return {
        errors: [],
        warnings: [],
        stats: {
            grades: 0,
            subjects: 0,
            chapters: 0,
            lessons: 0,
            suspiciousTitles: 0,
            pendingImportSubjects: 0,
            needsVerification: 0
        }
    };
}

function run() {
    const { errors, warnings, stats } = createReport();
    const seenLessonIds = new Map();
    const seenLessonCodes = new Map();

    for (const grade of curriculum.getGrades()) {
        stats.grades += 1;
        const subjects = curriculum.getSubjectsForGrade(grade);

        if (!subjects.length) {
            errors.push(`Lớp ${grade}: không có môn học nào.`);
            continue;
        }

        for (const subject of subjects) {
            stats.subjects += 1;

            if (!hasSubjectInGrade(subject.subjectId, grade)) {
                errors.push(`Lớp ${grade}: môn "${subject.subjectId}" không thuộc cấp học này.`);
            }
            if (!subject.subjectId || !subject.officialName) {
                errors.push(`Lớp ${grade}: môn thiếu subjectId hoặc officialName.`);
            }
            if (!subject.source) errors.push(`Lớp ${grade}/${subject.subjectId}: thiếu trường source.`);
            if (!subject.verificationStatus) errors.push(`Lớp ${grade}/${subject.subjectId}: thiếu verificationStatus.`);
            if (subject.verificationStatus === 'NEEDS_VERIFICATION') stats.needsVerification += 1;

            if (subject.integratedSubject && !(subject.learningTracks || []).length) {
                errors.push(`Lớp ${grade}/${subject.subjectId}: môn tích hợp thiếu danh sách mạch nội dung.`);
            }

            if (subject.needsLessonImport) {
                stats.pendingImportSubjects += 1;
                warnings.push(`Lớp ${grade}/${subject.subjectId}: chưa có tên bài, cần admin nhập từ bản in sách.`);
                continue;
            }

            const titlesInSubject = new Map();
            for (const chapter of subject.chapters) {
                stats.chapters += 1;
                if (!chapter.chapterId) errors.push(`Lớp ${grade}/${subject.subjectId}: chương thiếu chapterId.`);
                if (!chapter.textbookId) {
                    errors.push(`Lớp ${grade}/${subject.subjectId}/${chapter.chapterId}: chương thiếu textbookId.`);
                }

                for (const lesson of chapter.lessons) {
                    stats.lessons += 1;

                    if (!lesson.lessonId) {
                        errors.push(`Lớp ${grade}/${subject.subjectId}: bài thiếu lessonId.`);
                        continue;
                    }
                    if (lesson.grade !== grade) {
                        errors.push(`${lesson.lessonId}: lesson.grade=${lesson.grade} sai, lớp đang duyệt là ${grade}.`);
                    }
                    if (lesson.subjectId !== subject.subjectId) {
                        errors.push(`${lesson.lessonId}: lesson.subjectId=${lesson.subjectId} không khớp môn ${subject.subjectId}.`);
                    }
                    if (!lesson.lessonCode) errors.push(`${lesson.lessonId}: thiếu lessonCode.`);
                    if (!lesson.source) errors.push(`${lesson.lessonId}: thiếu source.`);
                    if (!lesson.verificationStatus) errors.push(`${lesson.lessonId}: thiếu verificationStatus.`);

                    const previousId = seenLessonIds.get(lesson.lessonId);
                    if (previousId) errors.push(`Trùng lessonId "${lesson.lessonId}" (${previousId} và lớp ${grade}).`);
                    else seenLessonIds.set(lesson.lessonId, `lớp ${grade}`);

                    if (lesson.lessonCode) {
                        const previousCode = seenLessonCodes.get(lesson.lessonCode);
                        if (previousCode) {
                            errors.push(`Trùng lessonCode "${lesson.lessonCode}" (${previousCode} và ${lesson.lessonId}).`);
                        } else seenLessonCodes.set(lesson.lessonCode, lesson.lessonId);
                    }

                    const titleCheck = inspectTitle(lesson.displayTitle);
                    if (titleCheck.suspicious) {
                        stats.suspiciousTitles += 1;
                        errors.push(`${lesson.lessonId}: tên bài khả nghi "${lesson.displayTitle}" — ${titleCheck.reason}.`);
                    }

                    const key = normalizeTitle(lesson.displayTitle);
                    const previousTitle = titlesInSubject.get(key);
                    if (previousTitle && previousTitle !== lesson.lessonId) {
                        errors.push(`Lớp ${grade}/${subject.subjectId}: trùng tên bài "${lesson.displayTitle}".`);
                    }
                    titlesInSubject.set(key, lesson.lessonId);
                }
            }
        }
    }

    // Mạch nội dung phải tồn tại trong subject registry.
    for (const subjectId of ['khtn', 'tin_hoc_cong_nghe', 'nghe_thuat']) {
        const subject = getSubject(subjectId);
        if (!subject) {
            errors.push(`Subject registry thiếu môn tích hợp "${subjectId}".`);
            continue;
        }
        for (const trackId of subject.learningTracks) {
            if (!getSubject(trackId)) errors.push(`Môn "${subjectId}" khai báo mạch "${trackId}" không tồn tại.`);
        }
    }

    return { errors, warnings, stats };
}

function main() {
    const { errors, warnings, stats } = run();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify({ errors, warnings, stats }, null, 2));
        process.exit(errors.length ? 1 : 0);
    }

    console.log('📋 Kiểm tra dữ liệu chương trình');
    console.log(`   Lớp: ${stats.grades}  |  Môn: ${stats.subjects}  |  Chương: ${stats.chapters}  |  Bài: ${stats.lessons}`);
    console.log(`   Tên bài khả nghi: ${stats.suspiciousTitles}  |  Môn chờ nhập bài: ${stats.pendingImportSubjects}  |  Cần xác minh: ${stats.needsVerification}`);

    if (warnings.length) {
        console.log(`\n⚠️  ${warnings.length} cảnh báo:`);
        // Gộp theo môn để không spam hàng chục dòng giống nhau.
        const grouped = new Map();
        for (const warning of warnings) {
            const subjectId = warning.split('/')[1]?.split(':')[0] || '?';
            grouped.set(subjectId, (grouped.get(subjectId) || 0) + 1);
        }
        for (const [subjectId, count] of grouped) {
            console.log(`   - Môn "${subjectId}": cần nhập tên bài ở ${count} lớp.`);
        }
    }

    if (errors.length) {
        console.error(`\n❌ ${errors.length} lỗi:`);
        for (const error of errors.slice(0, 40)) console.error(`   - ${error}`);
        if (errors.length > 40) console.error(`   ... và ${errors.length - 40} lỗi khác.`);
        process.exit(1);
    }

    console.log('\n✅ Dữ liệu chương trình hợp lệ về cấu trúc và không còn dấu hiệu dữ liệu mẫu.');
}

if (require.main === module) main();

module.exports = { run, inspectTitle, normalizeTitle, SAMPLE_PATTERNS };