'use strict';

/**
 * Route học sinh và khoản học tập (dùng chung, không cần quyền admin).
 *
 * Bảo mật:
 *   - Mọi route đều đi qua `requireAuth` -> 401 nếu chưa đăng nhập.
 *   - Đề thi, bài làm, tiến độ đều lấy `username` từ SESSION, không lấy từ URL/body
 *     để không thể xem bài của người khác chỉ bằng cách đổi tham số.
 */

const express = require('express');

const controller = require('../controllers/student.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { safeAsyncRoute } = require('../middleware/error.middleware');

const router = express.Router();

// ---- Chương trình (mở cho mọi tài khoản đã đăng nhập) ----
router.get('/curriculum/overview', requireAuth, safeAsyncRoute(controller.getOverview));

// Cấp học (tiểu học / THCS / THPT) kèm các lớp thuộc cấp đó.
router.get('/curriculum/levels', requireAuth, safeAsyncRoute(controller.listEducationLevels));

router.get('/curriculum/grades', requireAuth, safeAsyncRoute(controller.listGrades));
router.get('/curriculum/grades/:grade/subjects', requireAuth, safeAsyncRoute(controller.listSubjects));

// Bộ sách dùng cho một môn trong một lớp — bước "chọn bộ sách".
router.get(
    '/curriculum/grades/:grade/subjects/:subjectId/series',
    requireAuth,
    safeAsyncRoute(controller.listSeries)
);

// Chương và bài theo bộ sách đã chọn — bước "xem sách".
router.get(
    '/curriculum/grades/:grade/subjects/:subjectId/chapters',
    requireAuth,
    safeAsyncRoute(controller.listChapters)
);

router.get(
    '/curriculum/grades/:grade/subjects/:subjectId',
    requireAuth,
    safeAsyncRoute(controller.getSubjectDetail)
);
router.get('/curriculum/lessons/:lessonId', requireAuth, safeAsyncRoute(controller.getLesson));

// ---- Luyện tập ----
router.get('/questions/practice', requireAuth, safeAsyncRoute(controller.listPracticeQuestions));

// ---- Đề thi ----
router.get('/exams', requireAuth, safeAsyncRoute(controller.listExams));
router.get('/exams/:examId', requireAuth, safeAsyncRoute(controller.getExam));

// ---- Lượt làm bài ----
router.post('/exams/:examId/attempts', requireAuth, safeAsyncRoute(controller.startAttempt));
router.get('/attempts/:attemptId', requireAuth, safeAsyncRoute(controller.getAttempt));
router.put('/attempts/:attemptId/answers', requireAuth, safeAsyncRoute(controller.saveAnswers));
router.post('/attempts/:attemptId/submit', requireAuth, safeAsyncRoute(controller.submitAttempt));
router.delete('/attempts/:attemptId', requireAuth, safeAsyncRoute(controller.abandonAttempt));
router.get('/attempts/history', requireAuth, safeAsyncRoute(controller.listHistory));

// ---- Tiến độ ----
router.get('/progress/:grade', requireAuth, safeAsyncRoute(controller.getProgress));

// Đánh dấu đã đọc xong bài. KHÔNG tự đánh dấu hoàn thành — policy mới quyết định.
router.post(
    '/progress/lessons/read',
    requireAuth,
    safeAsyncRoute(controller.markLessonRead)
);

// Trạng thái học tập của một bài (đã đọc, mini test, điều kiện hoàn thành).
router.get(
    '/lessons/:lessonId/state',
    requireAuth,
    safeAsyncRoute(controller.getLessonState)
);

// ---- Mini test: kiểm tra cuối bài ----
// Mở mini test — KHÔNG kèm đáp án đúng.
router.get(
    '/lessons/:lessonId/mini-test',
    requireAuth,
    safeAsyncRoute(controller.getMiniTest)
);
// Nộp bài — chỉ nhận `answers`, điểm do máy chủ chấm.
router.post(
    '/lessons/mini-test/submit',
    requireAuth,
    safeAsyncRoute(controller.submitMiniTest)
);

// ---- Mốc đánh giá: checkpoint / giữa kỳ / cuối kỳ ----
// Eligibility luôn tính ở máy chủ từ tiến độ thật và chính sách đã cấu hình.
router.get(
    '/milestones/:grade/:subjectId',
    requireAuth,
    safeAsyncRoute(controller.getMilestones)
);

module.exports = router;