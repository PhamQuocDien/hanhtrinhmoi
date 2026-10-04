'use strict';

/**
 * Controller học sinh: xem chương trình, làm bài, xem kết quả và lịch sử.
 *
 * Nguyên tắc:
 *   - Mọi thao tác dùng `req.session.user` — KHÔNG tin `req.body.username`.
 *   - Chỉ trả về dữ liệu đã cắt bằng `toStudentView()` (không có đáp án đúng).
 *   - Không có endpoint nào nhận `score` / `correctAnswers` từ client.
 */

const response = require('../utils/response');
const curriculumService = require('../services/curriculum.service');
const examService = require('../services/exam.service');
const progressService = require('../services/progress.service');
const questionService = require('../services/question.service');
const scoring = require('../services/scoring.service');

/** Chuyển lỗi nghiệp vụ { error, message } thành mã HTTP cho chuẩn. */
const ERROR_STATUS = Object.freeze({
    NOT_FOUND: 404,
    EMPTY_EXAM: 409,
    ALREADY_SUBMITTED: 409,
    TIME_EXPIRED: 409,
    FORBIDDEN: 403
});

/** Phát lại lỗi nghiệp vụ hoặc trả 400 khi lỗi không lường trước. */
function sendServiceError(res, result, fallbackMessage) {
    const status = ERROR_STATUS[result.error] || 400;
    return response.fail(res, status, result.error, result.message || fallbackMessage, {
        requestId: res.locals?.requestId
    });
}

/** Danh sách lớp cho bảng chọn. */
function listGrades(req, res) {
    return response.ok(res, curriculumService.listGrades());
}

/** Tổng quan toàn chương trình. */
function getOverview(req, res) {
    return response.ok(res, curriculumService.getOverview());
}

/** Danh sách môn của một lớp; `withLessons=1` để lấy kèm chương và bài. */
function listSubjects(req, res) {
    const grade = Number(req.params.grade);
    if (!grade || grade < 1 || grade > 12) {
        return response.badRequest(res, 'Lớp phải từ 1 đến 12.');
    }
    const subjects = curriculumService.listSubjects(grade, {
        withLessons: req.query.withLessons === '1'
    });
    if (!subjects.length) return response.notFound(res, 'Lớp này chưa có môn học.');
    return response.ok(res, subjects);
}

/** Chi tiết một môn kèm danh sách bài học. */
function getSubjectDetail(req, res) {
    const detail = curriculumService.getSubjectDetail(Number(req.params.grade), req.params.subjectId);
    if (!detail) return response.notFound(res, 'Không tìm thấy môn học trong lớp này.');
    return response.ok(res, detail);
}

/** Bài học cụ thể. */
function getLesson(req, res) {
    const lesson = curriculumService.getLessonDetail(req.params.lessonId);
    if (!lesson) return response.notFound(res, 'Không tìm thấy bài học.');
    return response.ok(res, lesson);
}

/** Tổng quan tiến độ học tập của học sinh. */
async function getProgress(req, res) {
    const grade = Number(req.params.grade || req.user?.grade);
    if (!grade || grade < 1 || grade > 12) {
        return response.badRequest(res, 'Thiếu lớp hợp lệ để xem tiến độ.');
    }
    return response.ok(res, await progressService.getSummary(req.session.user.username, grade));
}

/** Ghi nhận đã đọc xong một bài. */
async function markLessonCompleted(req, res) {
    const lesson = curriculumService.getLessonDetail(req.body.lessonId);
    if (!lesson) return response.notFound(res, 'Không tìm thấy bài học.');

    await progressService.markLessonCompleted(req.session.user.username, {
        grade: lesson.grade,
        subjectId: lesson.subjectId,
        lessonId: lesson.lessonId,
        minutesSpent: Number(req.body.minutesSpent) || 0
    });
    return response.ok(res, { lessonId: lesson.lessonId, completed: true });
}

/** Ngân hàng câu hỏi luyện tập — KHÔNG kèm đáp án đúng. */
async function listPracticeQuestions(req, res) {
    const questions = await questionService.findPublishedQuestions({
        grade: req.query.grade ? Number(req.query.grade) : undefined,
        subjectId: req.query.subjectId,
        chapterId: req.query.chapterId,
        lessonId: req.query.lessonId,
        difficulty: req.query.difficulty,
        types: req.query.type ? String(req.query.type).split(',') : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined
    });
    return response.ok(res, questions.map(question => question.toStudentView()));
}

/** Danh sách đề thi công khai cho học sinh. */
async function listExams(req, res) {
    const exams = await examService.listAvailableExams({
        grade: req.query.grade ? Number(req.query.grade) : undefined,
        subjectId: req.query.subjectId,
        lessonId: req.query.lessonId
    });
    return response.ok(res, exams);
}

/** Thông tin một đề (KHÔNG có câu hỏi, không có đáp án). */
async function getExam(req, res) {
    const exam = await examService.getExamInfo(req.params.examId);
    if (!exam) return response.notFound(res, 'Không tìm thấy đề thi.');
    return response.ok(res, exam);
}

/** Bắt đầu làm bài — máy chủ cắt sẵn phần đáp án trước khi trả cho client. */
async function startAttempt(req, res) {
    const result = await examService.startAttempt({
        examId: req.params.examId,
        username: req.session.user.username
    });
    if (result.error) return sendServiceError(res, result, 'Không thể bắt đầu làm bài.');
    return response.ok(res, result, 201);
}

/** Lưu nháp câu trả lời để học sinh tạm thoát rồi quay lại. */
async function saveAnswers(req, res) {
    const result = await examService.saveDraftAnswers({
        attemptId: req.params.attemptId,
        username: req.session.user.username,
        answers: req.body.answers
    });
    if (result.error) return sendServiceError(res, result, 'Không lưu được nháp câu trả lời.');
    return response.ok(res, result);
}

/** Nộp bài — điểm luôn do máy chủ tính. */
async function submitAttempt(req, res) {
    const result = await examService.submitAttempt({
        attemptId: req.params.attemptId,
        username: req.session.user.username,
        answers: req.body.answers
    });
    if (result.error) return sendServiceError(res, result, 'Không nộp được bài.');

    // Ghi nhận vào tiến độ bài học nếu đề gắn với một bài cụ thể.
    if (result.exam?.lessonId) {
        await progressService.recordAttemptResult(req.session.user.username, {
            grade: result.exam.grade,
            subjectId: result.exam.subjectId,
            lessonId: result.exam.lessonId,
            scorePercent: result.result.scorePercent
        });
    }

    return response.ok(res, result);
}

/** Lịch sử làm bài của học sinh. */
async function listHistory(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    return response.ok(res, await examService.listHistory(req.session.user.username, { page, pageSize }));
}

/** Chi tiết một lượt làm bài — kèm đáp án đúng vì đã nộp xong. */
async function getAttempt(req, res) {
    const detail = await examService.getAttemptDetail(req.params.attemptId, req.session.user.username);
    if (!detail) return response.notFound(res, 'Không tìm thấy lượt làm bài.');
    return response.ok(res, { ...detail, feedback: scoring.feedbackFor(detail.scorePercent) });
}

/** Bỏ dở một lượt làm bài chưa nộp. */
async function abandonAttempt(req, res) {
    const removed = await examService.abandonAttempt(req.params.attemptId, req.session.user.username);
    if (!removed) return response.notFound(res, 'Không có lượt làm bài đang dở.');
    return response.ok(res, { removed });
}

module.exports = {
    abandonAttempt,
    getAttempt,
    getExam,
    getLesson,
    getOverview,
    getProgress,
    getSubjectDetail,
    listExams,
    listGrades,
    listHistory,
    listPracticeQuestions,
    listSubjects,
    markLessonCompleted,
    saveAnswers,
    startAttempt,
    submitAttempt
};