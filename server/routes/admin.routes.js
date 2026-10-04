'use strict';

/**
 * Route quản trị: ngân hàng câu hỏi, đề thi, nhập DOCX, chấm tay.
 *
 * Bảo mật:
 *   - `router.use(requireAdmin)` ở ĐẦU file, không phải gắn từng route. Nhờ vậy
 *     route mới thêm vào sau cũng tự động được bảo vệ — không có đường vòng.
 *   - Học sinh gọi vào đây luôn nhận 403, kể cả route chưa viết xong.
 */

const express = require('express');

const controller = require('../controllers/admin.controller');
const { requireAdmin } = require('../middleware/auth.middleware');
const { docxUpload } = require('../middleware/upload.middleware');
const { safeAsyncRoute } = require('../middleware/error.middleware');

const router = express.Router();

// BẢO VỆ TOÀN BỘ NHÓM ROUTE — phải ở dòng đầu tiên sau khi khai báo router.
router.use(requireAdmin);

// ---- Danh mục cho màn hình quản trị ----
router.get('/catalog', safeAsyncRoute(controller.getCatalog));
router.get('/curriculum/tree', safeAsyncRoute(controller.getCurriculumTree));

// ---- Người dùng và nhật ký ----
// Danh sách học sinh và nhật ký thao tác để truy vết "ai làm gì, lúc nào".
router.get('/students', safeAsyncRoute(controller.listStudents));
router.get('/audit-logs', safeAsyncRoute(controller.listAuditLogs));

// ---- Ngân hàng câu hỏi ----
router.get('/questions', safeAsyncRoute(controller.listQuestions));
router.get('/questions/stats', safeAsyncRoute(controller.getQuestionStats));
router.post('/questions', safeAsyncRoute(controller.createQuestion));
router.get('/questions/:questionId', safeAsyncRoute(controller.getQuestion));
router.put('/questions/:questionId', safeAsyncRoute(controller.updateQuestion));
router.delete('/questions/:questionId', safeAsyncRoute(controller.deleteQuestion));

// ---- Đề thi ----
router.get('/exams', safeAsyncRoute(controller.listExams));
router.post('/exams', safeAsyncRoute(controller.createExam));
router.get('/exams/:examId', safeAsyncRoute(controller.getExam));
router.put('/exams/:examId', safeAsyncRoute(controller.updateExam));
router.post('/exams/:examId/publish', safeAsyncRoute(controller.publishExam));
router.post('/exams/:examId/status', safeAsyncRoute(controller.changeExamStatus));
router.get('/exams/:examId/attempts', safeAsyncRoute(controller.listExamAttempts));

// ---- Nhập đề thi từ DOCX ----
// `docxUpload` chạy trước controller: kiểm tra đuôi tệp, kích thước, chữ ký nhị phân.
router.post('/imports/docx', docxUpload, safeAsyncRoute(controller.importDocxFile));
router.get('/imports', safeAsyncRoute(controller.listImportJobs));
router.get('/imports/:jobId', safeAsyncRoute(controller.getImportJob));
router.put('/imports/:jobId', safeAsyncRoute(controller.saveImportJob));
router.post('/imports/:jobId/publish', safeAsyncRoute(controller.publishImportJob));

// ---- Chấm tay ----
router.get('/grading/pending', safeAsyncRoute(controller.listPendingGrading));
router.get('/grading/stats', safeAsyncRoute(controller.getGradingStats));
router.get('/grading/attempts/:attemptId', safeAsyncRoute(controller.getGradingSheet));
router.post('/grading/attempts/:attemptId/grade', safeAsyncRoute(controller.gradeQuestion));
router.post('/grading/attempts/:attemptId/grade-bulk', safeAsyncRoute(controller.gradeBulk));

module.exports = router;