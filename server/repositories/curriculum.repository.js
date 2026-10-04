'use strict';

/**
 * KHO DỮ LIỆU CHƯƠNG TRÌNH (repository) — lớp trung gian giữa registry tĩnh và
 * service nghiệp vụ.
 *
 * Tách riêng thành repository để service chỉ lo nghiệp vụ, không đụng cấu trúc
 * file registry; sau này thay nguồn dữ liệu (file -> CSDL) chỉ sửa tệp này.
 *
 * Mô hình: CURRICULUM -> LEVEL -> GRADE -> SUBJECT -> BOOK SERIES -> TEXTBOOK
 *           -> CHAPTER -> LESSON
 *
 * Nguyên tắc: **không suy diễn tên**. Mọi tên lấy từ registry; thứ chưa có thì
 * báo `hasContent: false` thay vì bịa ra.
 */

const curriculum = require('../../data/curriculum/curriculum-registry');
const { getLearningTracks } = require('../../data/subjects/subject-registry');
const { getSeriesForGrade, getBookSeries, getDefaultSeriesId } =
    require('../../data/textbooks/book-series-registry');
const { getTextbooksForGrade, getTextbook } = require('../../data/textbooks/textbook-registry');
const { levelOfGrade } = require('../../data/curriculum/education-levels');

/**
 * Môn học trong một lớp.
 *
 * Lưu ý: `subject-registry.getSubject(id)` lấy môn theo id và trả về bản ghi dùng
 * khoá `id`; còn bản ghi theo lớp (có `chapters`, `lessons`) nằm trong
 * `curriculum-registry.getSubject(grade, subjectId)` và dùng khoá `subjectId`.
 * Hàm này gọi đúng bản theo lớp.
 */
function subjectInGrade(grade, subjectId) {
    return curriculum.getSubject(Number(grade), String(subjectId || ''));
}

/** Có nội dung dạy học trong bản ghi bài hay không. */
function lessonHasContent(lesson) {
    return Boolean(lesson.contentStatus) && lesson.contentStatus !== 'EMPTY';
}

/** Dựng textbookId theo đúng quy tắc của registry. */
function textbookIdFor(grade, subjectId, seriesId) {
    return `tb-g${String(grade).padStart(2, '0')}-${subjectId}-${seriesId}`;
}

/** Tìm đầu sách theo (lớp, môn, bộ sách), có dự phòng về bộ mặc định. */
function resolveBook(grade, subjectId, seriesId) {
    const level = Number(grade);
    if (seriesId) return getTextbook(textbookIdFor(level, subjectId, seriesId));
    return getTextbook(textbookIdFor(level, subjectId, getDefaultSeriesId(level)))
        || getTextbook(textbookIdFor(level, subjectId, 'national'))
        || null;
}

/** Mô tả ngắn một đầu sách để frontend hiển thị. */
function describeTextbook(textbook) {
    if (!textbook) return null;
    return {
        textbookId: textbook.textbookId,
        officialTitle: textbook.officialTitle,
        seriesId: textbook.seriesId,
        seriesName: getBookSeries(textbook.seriesId)?.seriesName || null,
        publisher: textbook.publisher || null,
        verificationStatus: textbook.verificationStatus
    };
}

/** Chuyển một bài học về dạng gửi cho frontend. */
function mapLesson(lesson, chapter) {
    return {
        lessonId: lesson.lessonId,
        lessonNumber: lesson.lessonNumber,
        displayTitle: lesson.displayTitle,
        lessonCode: lesson.lessonCode,
        estimatedMinutes: lesson.estimatedMinutes,
        grade: lesson.grade,
        subjectId: lesson.subjectId,
        seriesId: chapter?.seriesId ?? lesson.seriesId ?? null,
        textbookId: chapter?.textbookId ?? lesson.textbookId ?? null,
        chapterId: chapter?.chapterId ?? null,
        chapterTitle: chapter?.displayTitle ?? null,
        hasContent: lessonHasContent(lesson),
        verificationStatus: lesson.verificationStatus
    };
}

/** Chuyển một chương (kèm bài) về dạng gửi cho frontend. */
function mapChapter(chapter) {
    return {
        chapterId: chapter.chapterId,
        chapterNumber: chapter.chapterNumber,
        displayTitle: chapter.displayTitle,
        grade: chapter.grade,
        subjectId: chapter.subjectId,
        seriesId: chapter.seriesId,
        textbookId: chapter.textbookId,
        lessonCount: chapter.lessonCount,
        verificationStatus: chapter.verificationStatus,
        lessons: (chapter.lessons || []).map(lesson => mapLesson(lesson, chapter))
    };
}
/** Chuyển một môn học trong một lớp về dạng gửi cho frontend. */
function mapSubject(subject, { withChapters = false } = {}) {
    const level = levelOfGrade(subject.grade);
    const tracks = getLearningTracks(subject.subjectId) || [];

    const base = {
        subjectId: subject.subjectId,
        officialName: subject.officialName,
        displayName: subject.displayName,
        icon: subject.icon,
        grade: subject.grade,
        educationLevelId: level.id,
        educationLevelName: level.shortName,
        status: subject.status,
        statusLabel: subject.statusLabel,
        // Môn tích hợp có các mạch nội dung bên trong (Vật lí / Hoá học / Sinh học).
        integratedSubject: Boolean(subject.integratedSubject),
        integratedInto: subject.integratedInto ?? null,
        learningTracks: (subject.learningTracks || []).map(track => ({
            subjectId: track,
            displayName: tracks.find(item => item.id === track)?.displayName || track
        })),
        chapterCount: subject.chapterCount,
        lessonCount: subject.lessonCount,
        needsLessonImport: Boolean(subject.needsLessonImport),
        verificationStatus: subject.verificationStatus
    };

    if (!withChapters) return base;
    return { ...base, chapters: (subject.chapters || []).map(mapChapter) };
}
/**
 * Các bộ sách có thể dùng cho một môn trong một lớp.
 *
 * Hệ thống KHÔNG giả định mỗi môn chỉ có một bộ sách: hàm trả về mọi bộ sách mà
 * lớp đó có, kèm số đầu sách tương ứng. Bộ sách chưa có đầu sách được đánh dấu
 * `textbookCount: 0` để giao diện hiện "chưa có dữ liệu" thay vì bịa ra.
 */
function listSeriesForSubject(grade, subjectId) {
    const level = Number(grade);
    if (!level || level < 1 || level > 12) return [];
    if (!subjectInGrade(grade, subjectId)) return [];

    const textbooks = getTextbooksForGrade(level).filter(book => book.subjectId === String(subjectId));
    const defaultSeriesId = getDefaultSeriesId(level);

    return getSeriesForGrade(level).map(series => {
        const books = textbooks.filter(book => book.seriesId === series.seriesId);
        return {
            seriesId: series.seriesId,
            seriesName: series.seriesName,
            publisher: series.publisher || null,
            source: series.source || null,
            verificationStatus: series.verificationStatus,
            isDefault: series.seriesId === defaultSeriesId,
            textbookCount: books.length,
            textbooks: books.map(describeTextbook)
        };
    });
}

/** Danh sách môn của một lớp. */
function listSubjectsOfGrade(grade) {
    const level = Number(grade);
    if (!level || level < 1 || level > 12) return [];
    return curriculum.getSubjectsForGrade(level).map(subject => mapSubject(subject));
}

/** Chi tiết một môn kèm chương và bài. */
/**
 * Cây chương/bài của một đầu sách cụ thể.
 *
 * Phục vụ luồng "lớp → môn → bộ sách → sách → chương → bài". Nếu đầu sách chưa
 * có dữ liệu chương, trả `hasContent: false` và mảng rỗng — KHÔNG bịa chương.
 */
function listChaptersForTextbook(grade, subjectId, seriesId) {
    const subject = subjectInGrade(grade, subjectId);
    if (!subject) return null;

    const textbook = resolveBook(grade, subjectId, seriesId);
    const chapters = (subject.chapters || []).map(mapChapter);

    return {
        grade: Number(grade),
        subjectId: String(subjectId),
        seriesId: textbook?.seriesId ?? seriesId ?? null,
        textbook: describeTextbook(textbook),
        chapterCount: chapters.length,
        lessonCount: chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0),
        hasContent: chapters.length > 0,
        chapters
    };
}

/** Bài học theo lessonId, kèm thông tin chương để dựng breadcrumb. */
function getLessonById(lessonId) {
    const lesson = curriculum.getLesson(lessonId);
    if (!lesson) return null;
    const chapter = curriculum.getChapter(lesson.chapterId);
    const subject = subjectInGrade(lesson.grade, lesson.subjectId);

    return {
        ...mapLesson(lesson, chapter),
        subject: subject
            ? { subjectId: subject.subjectId, displayName: subject.displayName }
            : null,
        series: chapter?.seriesId ? getBookSeries(chapter.seriesId) || null : null,
        curriculumVersion: subject?.curriculumVersion || 'CTGDPT-2018'
    };
}

/** Bài trước / bài sau trong cùng môn, để điều hướng bài học. */
function getLessonNeighbours(lessonId) {
    const lesson = curriculum.getLesson(lessonId);
    if (!lesson) return { previous: null, next: null };

    const siblings = curriculum.getLessonsForSubject(lesson.grade, lesson.subjectId);
    const index = siblings.findIndex(item => item.lessonId === lesson.lessonId);
    const shape = item => (item ? {
        lessonId: item.lessonId,
        lessonNumber: item.lessonNumber,
        displayTitle: item.displayTitle,
        chapterTitle: item.chapterTitle
    } : null);

    return {
        previous: index > 0 ? shape(siblings[index - 1]) : null,
        next: index >= 0 && index < siblings.length - 1 ? shape(siblings[index + 1]) : null
    };
}

module.exports = {
    getLessonById,
    getLessonNeighbours,
    getSubjectWithChapters,
    levelOfGrade,
    listChaptersForTextbook,
    listSeriesForSubject,
    listSubjectsOfGrade,
    mapChapter,
    mapLesson,
    mapSubject
};
function getSubjectWithChapters(grade, subjectId, seriesId) {
    const subject = subjectInGrade(grade, subjectId);
    if (!subject) return null;
    return {
        ...mapSubject(subject, { withChapters: true }),
        textbook: describeTextbook(resolveBook(grade, subjectId, seriesId))
    };
}

/** Chuyển một môn học trong một lớp về dạng gửi cho frontend. */
