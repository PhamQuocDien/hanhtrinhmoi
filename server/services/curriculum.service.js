'use strict';

/**
 * Nghiệp vụ chương trình: đọc từ registry và trả về dữ liệu cho giao diện.
 *
 * Service này là ranh giới giữa `data/` (dữ liệu tĩnh) và HTTP controller.
 * Nó KHÔNG đọc trực tiếp từng file registry, để khi đổi nguồn dữ liệu
 * (file -> MongoDB) chỉ sửa file này.
 */

const curriculum = require('../../data/curriculum/curriculum-registry');
const {
    SUBJECTS,
    getSubject,
    getSubjectStatusForGrade,
    getLearningTracks,
    getParentSubject,
    SUBJECT_STATUS
} = require('../../data/subjects/subject-registry');
const { BOOK_SERIES, getSeriesForGrade, getDefaultSeriesId } = require('../../data/textbooks/book-series-registry');
const { resolveTextbook, getTextbooksForGrade } = require('../../data/textbooks/textbook-registry');

/** Tổng quan chương trình cho trang chủ. */
function getOverview() {
    return curriculum.getOverview();
}

/** Danh sách 12 lớp, kèm số môn và bài của từng lớp. */
function listGrades() {
    return curriculum.getGrades().map(grade => {
        const data = curriculum.getGrade(grade);
        return {
            grade: data.grade,
            gradeName: data.gradeName,
            gradeFocus: data.gradeFocus,
            subjectCount: data.subjectCount,
            lessonCount: data.lessonCount,
            pendingImportCount: data.subjectsPendingImport.length,
            seriesId: data.seriesId
        };
    });
}

/**
 * Danh sách môn của một lớp.
 * @param {number} grade
 * @param {boolean} withLessons có kèm chương/bài hay không
 */
function listSubjects(grade, { withLessons = false } = {}) {
    const subjects = curriculum.getSubjectsForGrade(grade);
    if (!subjects.length) return [];

    return subjects.map(subject => {
        const base = {
            subjectId: subject.subjectId,
            officialName: subject.officialName,
            displayName: subject.displayName,
            icon: subject.icon,
            status: subject.status,
            statusLabel: subject.statusLabel,
            integratedSubject: subject.integratedSubject,
            // Mô hình "một chương trình, nhiều bộ sách": trả về mọi bộ phát hành.
            availableSeries: getSeriesForGrade(subject.grade).map(series => ({
                seriesId: series.seriesId,
                seriesName: series.seriesName,
                verificationStatus: series.verificationStatus
            })),
            textbookId: subject.textbookId,
            chapterCount: subject.chapterCount,
            lessonCount: subject.lessonCount,
            needsLessonImport: subject.needsLessonImport,
            verificationStatus: subject.verificationStatus
        };

        // Môn tích hợp: trả kèm các mạch nội dung để giao diện hiển thị đúng cấp.
        if (subject.integratedSubject && subject.learningTracks.length) {
            base.learningTracks = getLearningTracks(subject.subjectId)
                .map(track => ({ subjectId: track.id, displayName: track.displayName, icon: track.icon }));
        }

        if (!withLessons) return base;

        return {
            ...base,
            chapters: subject.chapters.map(chapter => ({
                chapterId: chapter.chapterId,
                chapterNumber: chapter.chapterNumber,
                displayTitle: chapter.displayTitle,
                lessonCount: chapter.lessonCount,
                lessons: chapter.lessons.map(lesson => ({
                    lessonId: lesson.lessonId,
                    lessonNumber: lesson.lessonNumber,
                    displayTitle: lesson.displayTitle,
                    lessonCode: lesson.lessonCode,
                    estimatedMinutes: lesson.estimatedMinutes,
                    contentStatus: lesson.contentStatus,
                    verificationStatus: lesson.verificationStatus
                }))
            }))
        };
    });
}

/** Chi tiết một môn trong một lớp, kèm chương và bài. */
function getSubjectDetail(grade, subjectId, { seriesId } = {}) {
    const subject = curriculum.getSubject(grade, subjectId);
    if (!subject) return null;

    const textbook = resolveTextbook(grade, subjectId, seriesId || subject.seriesId);
    return {
        ...subject,
        textbook: textbook ? {
            textbookId: textbook.textbookId,
            officialTitle: textbook.officialTitle,
            seriesId: textbook.seriesId,
            publisher: textbook.publisher,
            verificationStatus: textbook.verificationStatus
        } : null,
        // Nếu môn là mạch nội dung, nói rõ môn chủ để UI không hiểu nhầm.
        parentSubject: subject.integratedInto
            ? getParentSubject(subject.subjectId, grade)?.displayName || null
            : null
    };
}

/** Một bài học cụ thể. */
function getLessonDetail(lessonId) {
    const lesson = curriculum.getLesson(lessonId);
    if (!lesson) return null;

    const subject = getSubject(lesson.subjectId);
    return {
        ...lesson,
        subjectName: subject?.officialName || lesson.subjectId,
        curriculumVersion: subject?.curriculumVersion || 'CTGDPT-2018'
    };
}

/** Tất cả bài học của một môn (dùng để sinh câu hỏi luyện tập). */
function listLessons(grade, subjectId) {
    return curriculum.getLessonsForSubject(grade, subjectId);
}

/** Danh sách môn toàn hệ thống, dùng cho trang quản trị. */
function listAllSubjects() {
    return SUBJECTS.map(subject => ({
        subjectId: subject.id,
        officialName: subject.officialName,
        displayName: subject.displayName,
        grades: subject.grades,
        status: subject.status,
        statusByGrade: subject.statusByGrade || null,
        integratedSubject: subject.integratedSubject,
        integratedInto: subject.integratedInto,
        learningTracks: subject.learningTracks,
        verificationStatus: subject.verificationStatus,
        source: subject.source
    }));
}

/** Danh sách bộ sách toàn hệ thống, dùng cho trang quản trị. */
function listBookSeries() {
    return BOOK_SERIES.map(series => ({
        seriesId: series.seriesId,
        seriesName: series.seriesName,
        publisher: series.publisher,
        grades: series.grades,
        defaultForGrades: series.defaultForGrades,
        verificationStatus: series.verificationStatus,
        source: series.source,
        textbookCount: series.grades.reduce((sum, grade) => sum + getTextbooksForGrade(grade).filter(
            book => book.seriesId === series.seriesId
        ).length, 0)
    }));
}

/** Danh sách đầu sách, lọc theo bộ sách và/hoặc lớp. */
function listTextbooks({ seriesId, grade } = {}) {
    const textbooks = grade ? getTextbooksForGrade(grade) : getTextbooksForGrade(1);
    const filtered = seriesId ? textbooks.filter(item => item.seriesId === seriesId) : textbooks;
    return filtered.map(item => ({
        textbookId: item.textbookId,
        officialTitle: item.officialTitle,
        grade: item.grade,
        subjectId: item.subjectId,
        seriesId: item.seriesId,
        publisher: item.publisher,
        verificationStatus: item.verificationStatus
    }));
}

/**
 * Môn có thuộc lớp không. Dùng để chặn truy cập chéo cấp trong API.
 */
function validateSubjectInGrade(grade, subjectId) {
    if (!getSubject(subjectId)) {
        return { valid: false, reason: 'Môn học không tồn tại trong danh mục.' };
    }
    if (!curriculum.getSubject(grade, subjectId)) {
        return { valid: false, reason: 'Môn học này không thuộc lớp đang chọn.' };
    }
    return { valid: true, status: getSubjectStatusForGrade(subjectId, grade) };
}

module.exports = {
    SUBJECT_STATUS,
    getDefaultSeriesId,
    getLessonDetail,
    getOverview,
    getSubjectDetail,
    listAllSubjects,
    listBookSeries,
    listGrades,
    listLessons,
    listSubjects,
    listTextbooks,
    validateSubjectInGrade
};