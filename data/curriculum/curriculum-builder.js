'use strict';

/**
 * Dựng cấu trúc chương trình theo lớp từ dữ liệu cũ, với metadata trung thực.
 *
 * NGUYÊN TẮC KHÔNG BỊA:
 *  - Chủ đề lấy từ `GRADE_THEMES` (tên bài có thật trong dữ liệu dự án).
 *  - Với môn KHÔNG có GRADE_THEMES, KHÔNG được bịa tên bài. Môn đó được đánh
 *    dấu `needsLessonImport = true` và không sinh bài giả.
 *  - Tên bài KHÔNG bao giờ gắn tiền tố "Bài 1:" sinh tự động hay chuỗi trộn
 *    trọng tâm lớp ("... qua thực hành") — đó là dấu hiệu dữ liệu mẫu.
 *  - Mọi bản ghi đều có `source` + `verificationStatus`.
 */

const {
    loadLegacyCurriculum,
    getGradeThemes,
    getTopics
} = require('../../server/parsers/curriculum/curriculum-parser');
const {
    getSubjectsForGrade,
    getSubjectStatusForGrade,
    SUBJECT_STATUS
} = require('../subjects/subject-registry');
const { getDefaultSeriesId } = require('../textbooks/book-series-registry');
const { resolveTextbook } = require('../textbooks/textbook-registry');

/** Số bài tối đa gom trong một chương. */
const LESSONS_PER_CHAPTER = 4;

/** Nhãn tiếng Việt cho trạng thái môn. */
function describeStatus(status) {
    switch (status) {
        case SUBJECT_STATUS.REQUIRED: return 'Bắt buộc';
        case SUBJECT_STATUS.ELECTIVE: return 'Môn lựa chọn';
        case SUBJECT_STATUS.INTEGRATED: return 'Môn tích hợp';
        case SUBJECT_STATUS.SUPPLEMENTARY: return 'Nội dung bổ trợ';
        case SUBJECT_STATUS.LOCAL_CONTENT: return 'Nội dung địa phương';
        default: return 'Khác';
    }
}

/**
 * Dựng một bài học từ tên chủ đề có thật.
 * KHÔNG sinh tên bài từ trọng tâm lớp.
 */
function buildLesson(grade, subjectId, chapterNumber, index, topic) {
    const lessonNumber = (chapterNumber - 1) * LESSONS_PER_CHAPTER + index + 1;
    const pad = value => String(value).padStart(2, '0');
    return {
        lessonId: `les-g${pad(grade)}-${subjectId}-c${pad(chapterNumber)}-l${pad(index + 1)}`,
        grade,
        subjectId,
        lessonNumber,
        chapterNumber,
        // Tên bài lấy nguyên văn từ nguồn, chỉ chuẩn hoá khoảng trắng.
        displayTitle: String(topic).replace(/\s+/g, ' ').trim(),
        lessonCode: `${subjectId.toUpperCase()}-${grade}-${String(lessonNumber).padStart(3, '0')}`,
        estimatedMinutes: grade <= 2 ? 20 : grade <= 5 ? 25 : grade <= 9 ? 35 : 40,
        // Nội dung bài học do giáo viên/admin nhập sau khi publish.
        contentStatus: 'EMPTY',
        source: 'legacy-curriculum-data.js#GRADE_THEMES',
        verifiedAt: null,
        verificationStatus: 'NEEDS_VERIFICATION'
    };
}

/**
 * Gom danh sách chủ đề thành các chương, mỗi chương tối đa LESSONS_PER_CHAPTER bài.
 */
function buildChapters(grade, subjectId, seriesId, textbookId, topics) {
    const chapters = [];
    const chapterCount = Math.max(1, Math.ceil(topics.length / LESSONS_PER_CHAPTER));
    const pad = value => String(value).padStart(2, '0');

    for (let chapterIndex = 0; chapterIndex < chapterCount; chapterIndex += 1) {
        const slice = topics.slice(chapterIndex * LESSONS_PER_CHAPTER, (chapterIndex + 1) * LESSONS_PER_CHAPTER);
        if (!slice.length) continue;
        const chapterNumber = chapterIndex + 1;
        chapters.push({
            chapterId: `cha-g${pad(grade)}-${subjectId}-c${pad(chapterNumber)}`,
            grade,
            subjectId,
            seriesId,
            textbookId,
            chapterNumber,
            displayTitle: String(slice[0]).replace(/\s+/g, ' ').trim(),
            lessonCount: slice.length,
            lessons: slice.map((topic, index) => buildLesson(grade, subjectId, chapterNumber, index, topic)),
            source: 'legacy-curriculum-data.js#GRADE_THEMES',
            verificationStatus: 'NEEDS_VERIFICATION'
        });
    }
    return chapters;
}

/**
 * Dựng dữ liệu chương trình của MỘT lớp.
 * Mỗi môn luôn có entry; môn thiếu dữ liệu bài học được đánh dấu rõ.
 */
function buildGradeCurriculum(grade) {
    const legacy = loadLegacyCurriculum();
    const level = Number(grade);
    const seriesId = getDefaultSeriesId(level);
    const subjects = [];

    for (const subject of getSubjectsForGrade(level)) {
        const status = getSubjectStatusForGrade(subject.id, level);
        const textbook = resolveTextbook(level, subject.id, seriesId);
        const topics = getGradeThemes(level, subject.id);
        const hasLessonData = topics.length > 0;

        const entry = {
            subjectId: subject.id,
            officialName: subject.officialName,
            displayName: subject.displayName,
            icon: subject.icon,
            status,
            statusLabel: describeStatus(status),
            integratedSubject: Boolean(subject.integratedSubject),
            integratedInto: subject.integratedInto || null,
            learningTracks: subject.learningTracks || [],
            seriesId,
            textbookId: textbook ? textbook.textbookId : null,
            textbookTitle: textbook ? textbook.officialTitle : null,
            chapterCount: 0,
            lessonCount: 0,
            chapters: [],
            // Không có GRADE_THEMES -> cần admin nhập tên bài từ bản in sách.
            needsLessonImport: !hasLessonData,
            curriculumVersion: subject.curriculumVersion,
            source: subject.source,
            verificationStatus: subject.verificationStatus
        };

        if (hasLessonData) {
            entry.chapters = buildChapters(level, subject.id, seriesId, entry.textbookId, topics);
            entry.chapterCount = entry.chapters.length;
            entry.lessonCount = entry.chapters.reduce((sum, chapter) => sum + chapter.lessonCount, 0);
        }

        subjects.push(entry);
    }

    return {
        grade: level,
        gradeName: `Lớp ${level}`,
        gradeFocus: legacy.GRADE_FOCUS[level] || '',
        curriculumVersion: 'CTGDPT-2018',
        seriesId,
        subjectCount: subjects.length,
        lessonCount: subjects.reduce((sum, subject) => sum + subject.lessonCount, 0),
        subjectsPendingImport: subjects.filter(subject => subject.needsLessonImport).map(subject => subject.subjectId),
        subjects,
        generatedAt: null,
        generatedBy: 'scripts/migrate-curriculum.js',
        source: 'legacy-curriculum-data.js',
        verificationStatus: 'NEEDS_VERIFICATION'
    };
}

module.exports = {
    LESSONS_PER_CHAPTER,
    describeStatus,
    buildLesson,
    buildChapters,
    buildGradeCurriculum
};