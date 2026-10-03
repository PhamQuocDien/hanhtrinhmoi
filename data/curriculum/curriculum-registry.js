'use strict';

/**
 * REGISTRY CHƯƠNG TRÌNH — nguồn đọc duy nhất cho CURRICULUM -> GRADE -> SUBJECT
 * -> BOOK SERIES -> TEXTBOOK -> CHAPTER -> LESSON.
 *
 * Dữ liệu được nạp từ 12 file data/curriculum/grade-NN.js, mỗi file chỉ chứa
 * dữ liệu của một lớp. Không có danh sách lớp/môn nào được hardcode ở nơi khác.
 */

const path = require('path');

const GRADE_COUNT = 12;
const GRADES = Array.from({ length: GRADE_COUNT }, (_, index) => index + 1);

const CURRICULUM_VERSION = 'CTGDPT-2018';

const CURRICULUM_BY_GRADE = new Map();
const LESSON_BY_ID = new Map();
const CHAPTER_BY_ID = new Map();
const SUBJECT_BY_GRADE = new Map();

function fileForGrade(grade) {
    return path.join(__dirname, `grade-${String(grade).padStart(2, '0')}.js`);
}

/** Chuẩn hoá và kiểm tra một lớp trong khoảng 1..12. */
function normalizeGrade(grade) {
    const level = Number(grade);
    if (!Number.isInteger(level) || level < 1 || level > GRADE_COUNT) return null;
    return level;
}

/** Danh sách các lớp hợp lệ — nguồn duy nhất. */
function getGrades() {
    return [...GRADES];
}

function getGrade(grade) {
    const level = normalizeGrade(grade);
    if (level === null) return null;
    if (!CURRICULUM_BY_GRADE.has(level)) {
        // Nạp lười (lazy) để không tốn 12 file lúc khởi động nếu không dùng tới.
        // eslint-disable-next-line global-require
        CURRICULUM_BY_GRADE.set(level, require(fileForGrade(level)));
    }
    return CURRICULUM_BY_GRADE.get(level);
}

/** Danh sách môn của một lớp (không kèm chapters/lessons). */
function getSubjectsForGrade(grade) {
    const level = normalizeGrade(grade);
    if (level === null) return [];
    if (!SUBJECT_BY_GRADE.has(level)) {
        const data = getGrade(level);
        SUBJECT_BY_GRADE.set(level, new Map(data.subjects.map(subject => [subject.subjectId, subject])));
    }
    return [...SUBJECT_BY_GRADE.get(level).values()];
}

/** Một môn trong một lớp, hoặc null. */
function getSubject(grade, subjectId) {
    const level = normalizeGrade(grade);
    if (level === null) return null;
    const index = getSubjectsForGrade(level);
    return index.find(subject => subject.subjectId === String(subjectId || '')) || null;
}

/** Một chương theo chapterId. */
function getChapter(chapterId) {
    if (!CHAPTER_BY_ID.size) {
        for (const grade of GRADES) {
            const data = getGrade(grade);
            for (const subject of data.subjects) {
                for (const chapter of subject.chapters) CHAPTER_BY_ID.set(chapter.chapterId, chapter);
            }
        }
    }
    return CHAPTER_BY_ID.get(String(chapterId || '')) || null;
}

/**
 * Tìm một bài học theo lessonId, hoặc theo (lớp, môn, số bài).
 * lessonId là khoá chính; tham số thứ hai chỉ để tiện tra cứu nội bộ.
 */
function getLesson(lessonId) {
    if (!LESSON_BY_ID.size) {
        for (const grade of GRADES) {
            const data = getGrade(grade);
            for (const subject of data.subjects) {
                for (const chapter of subject.chapters) {
                    for (const lesson of chapter.lessons) {
                        LESSON_BY_ID.set(lesson.lessonId, {
                            ...lesson,
                            chapterTitle: chapter.displayTitle,
                            textbookId: chapter.textbookId,
                            seriesId: chapter.seriesId
                        });
                    }
                }
            }
        }
    }
    return LESSON_BY_ID.get(String(lessonId || '')) || null;
}

/** Toàn bộ bài học của một môn trong một lớp. */
function getLessonsForSubject(grade, subjectId) {
    const subject = getSubject(grade, subjectId);
    if (!subject) return [];
    return subject.chapters.flatMap(chapter => chapter.lessons.map(lesson => ({
        ...lesson,
        chapterTitle: chapter.displayTitle,
        textbookId: chapter.textbookId,
        seriesId: chapter.seriesId
    })));
}

/** Tổng quan toàn chương trình dùng cho trang chủ và báo cáo quản trị. */
function getOverview() {
    let subjects = 0;
    let lessons = 0;
    const pending = [];
    for (const grade of GRADES) {
        const data = getGrade(grade);
        subjects += data.subjectCount;
        lessons += data.lessonCount;
        for (const subject of data.subjects) {
            if (subject.needsLessonImport) {
                pending.push({ grade, subjectId: subject.subjectId, officialName: subject.officialName });
            }
        }
    }
    return {
        curriculumVersion: CURRICULUM_VERSION,
        gradeCount: GRADE_COUNT,
        grades: GRADES,
        subjectCount: subjects,
        lessonCount: lessons,
        pendingImportCount: pending.length,
        pendingImport: pending,
        verificationStatus: 'NEEDS_VERIFICATION',
        note: 'Tên bài học lấy từ dữ liệu dự án và đang chờ đối chiếu với bản in sách giáo khoa. Môn chưa có tên bài được đánh dấu cần nhập, không được tự đặt.'
    };
}

module.exports = {
    CURRICULUM_VERSION,
    GRADES,
    GRADE_COUNT,
    normalizeGrade,
    getGrades,
    getGrade,
    getSubject,
    getSubjectsForGrade,
    getChapter,
    getLesson,
    getLessonsForSubject,
    getOverview
};