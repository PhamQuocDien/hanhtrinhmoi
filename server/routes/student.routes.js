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
router.get('/curriculum/grades', requireAuth, safeAsyncRoute(controller.listGrades));
router.get('/curriculum/grades/:grade/subjects', requireAuth, safeAsyncRoute(controller.listSubjects));
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
router.post(
    '/progress/lessons/complete',
    requireAuth,
    safeAsyncRoute(controller.markLessonCompleted)
);

module.exports = router;