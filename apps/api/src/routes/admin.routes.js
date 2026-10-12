'use strict';
const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const User = require('../models/User');
const SurveyResponse = require('../models/SurveyResponse');
const ActivityLog = require('../models/ActivityLog');
const ContentEntry = require('../models/ContentEntry');
const QuestionBankItem = require('../models/QuestionBankItem');
const LearningProgress = require('../models/LearningProgress');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const AssessmentSession = require('../models/AssessmentSession');
const PartCheckpointSession = require('../models/PartCheckpointSession');
const PlacementAssessment = require('../models/PlacementAssessment');
const CareerEnrollment = require('../models/CareerEnrollment');
const CareerQuestionBankItem = require('../models/CareerQuestionBankItem');
const CareerAssessmentSession = require('../models/CareerAssessmentSession');
const Classroom = require('../models/Classroom');
const TeacherAssignment = require('../models/TeacherAssignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const { normalizeEmail, canonicalEmailFilter } = require('../utils/email-identity');
const { requireAdmin } = require('../middleware/security');
const { recordActivity } = require('../services/activity-log');
const { classifyDocument, parseQuestions, validateWordContext } = require('../services/word-import');
const curriculum = require('../../../../content/curriculum');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter(_req, file, callback) {
  const extensionOkay = /\.docx$/i.test(file.originalname || '');
  const mimeOkay = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimetype === 'application/octet-stream';
  if (!extensionOkay || !mimeOkay) return callback(new Error('Chỉ hỗ trợ file Word .docx. Hãy lưu file .doc cũ thành .docx trước khi tải lên.'));
  callback(null, true);
} });

router.use(requireAdmin);
function safePage(value, fallback = 1, max = 10000) { return Math.max(1, Math.min(max, Number.parseInt(value, 10) || fallback)); }
function safeString(value, max = 50000) { return String(value ?? '').trim().slice(0, max); }
function contentPayload(body, actorId, existing = {}) {
  const type = safeString(body.contentType || existing.contentType || 'lesson', 30);
  const allowedTypes = ['course', 'lesson', 'assessment', 'import'];
  if (!allowedTypes.includes(type)) return { error: 'Loại nội dung không hợp lệ.' };
  const grade = Number(body.grade ?? existing.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { error: 'Lớp phải nằm trong khoảng 1–12.' };
  const programCode = safeString(body.programCode ?? existing.programCode ?? 'ctst', 20);
  if (!['ctst', 'kntt', 'canhdieu'].includes(programCode)) return { error: 'Bộ sách không hợp lệ.' };
  const subjectCode = safeString(body.subjectCode ?? existing.subjectCode, 80);
  if (!/^[a-z_]{2,80}$/.test(subjectCode)) return { error: 'Mã môn học không hợp lệ.' };
  const status = ['draft', 'published', 'archived'].includes(body.status) ? body.status : (existing.status || 'draft');
  const output = {
    contentType: type,
    title: safeString(body.title ?? existing.title, 240),
    programCode, grade, subjectCode,
    courseId: safeString(body.courseId ?? existing.courseId, 180),
    unitId: safeString(body.unitId ?? existing.unitId, 180),
    lessonId: safeString(body.lessonId ?? existing.lessonId, 180),
    assessmentType: ['lesson', 'chapter', 'midterm', 'final', 'practice', ''].includes(body.assessmentType) ? body.assessmentType : (existing.assessmentType || ''),
    objective: safeString(body.objective ?? existing.objective, 5000),
    theory: safeString(body.theory ?? existing.theory, 50000),
    lecture: safeString(body.lecture ?? existing.lecture, 50000),
    practice: safeString(body.practice ?? existing.practice, 50000),
    body: safeString(body.body ?? existing.body, 100000),
    videoUrl: safeString(body.videoUrl ?? existing.videoUrl, 2000),
    videoTitle: safeString(body.videoTitle ?? existing.videoTitle, 240),
    extractedText: safeString(body.extractedText ?? existing.extractedText, 200000),
    extractedQuestions: Array.isArray(body.extractedQuestions) ? body.extractedQuestions.slice(0, 300) : (existing.extractedQuestions || []),
    sourceFileName: safeString(body.sourceFileName ?? existing.sourceFileName, 240),
    detectedType: safeString(body.detectedType ?? existing.detectedType, 80),
    status,
    updatedBy: actorId
  };
  if (!output.title) return { error: 'Tiêu đề là bắt buộc.' };
  if (type !== 'course' && !output.lessonId && type !== 'import') return { error: 'Hãy chọn bài học đích trước khi lưu nội dung.' };
  if (type === 'assessment' && !output.assessmentType) output.assessmentType = 'practice';
  return { value: output };
}

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, students, universityStudents, teachers, surveys, suspendedUsers, activityCount, contentDrafts, questionCount] = await Promise.all([
      User.countDocuments(), User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'university_student' }), User.countDocuments({ role: 'teacher' }), SurveyResponse.countDocuments(), User.countDocuments({ status: 'suspended' }), ActivityLog.countDocuments(), ContentEntry.countDocuments({ status: 'draft' }), QuestionBankItem.countDocuments({ active: true })
    ]);
    res.json({ users, students, universityStudents, teachers, surveys, suspendedUsers, activityCount, contentDrafts, questionCount, publishedCourses: 0, courseMessage: 'Khung nội dung có thể chỉnh sửa; kiểm duyệt trước khi công bố.', version: '5.1.2' });
  } catch (error) { next(error); }
});

router.get('/survey-responses', async (req, res, next) => {
  try {
    const page = safePage(req.query.page, 1, 10000); const limit = safePage(req.query.limit, 20, 50);
    const [total, rows] = await Promise.all([SurveyResponse.countDocuments(), SurveyResponse.find().sort({ completedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'fullName email role school grade').lean()]);
    res.json({ page, limit, total, rows });
  } catch (error) { next(error); }
});
router.get('/users', async (req, res, next) => {
  try {
    const page = safePage(req.query.page, 1, 10000); const limit = safePage(req.query.limit, 20, 100);
    const filter = {};
    if (['active', 'suspended'].includes(req.query.status)) filter.status = req.query.status;
    if (['student', 'university_student', 'teacher'].includes(req.query.role)) filter.role = req.query.role;
    if (req.query.q) { const escaped = safeString(req.query.q, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ fullName: new RegExp(escaped, 'i') }, { email: new RegExp(escaped, 'i') }]; }
    const [total, rows] = await Promise.all([User.countDocuments(filter), User.find(filter).select('fullName email role school grade status createdAt updatedAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
    res.json({ page, limit, total, rows });
  } catch (error) { next(error); }
});
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Mã tài khoản không hợp lệ.' });
    const status = String(req.body.status || '');
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Trạng thái chỉ có thể là active hoặc suspended.' });
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true, runValidators: true }).select('fullName email role status').lean();
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    await recordActivity(req, { action: status === 'suspended' ? 'account.suspend' : 'account.activate', targetType: 'user', targetId: String(user._id), targetName: user.email, description: `Quản trị viên chuyển trạng thái tài khoản thành ${status}.` });
    res.json({ message: status === 'suspended' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.', user });
  } catch (error) { next(error); }
});
async function purgeUserData(userId, session = null) {
  const query = (modelQuery) => session ? modelQuery.session(session) : modelQuery;
  const options = session ? { session } : {};
  const classroomRows = await query(Classroom.find({ teacher: userId }).select('_id').lean());
  const classroomIds = classroomRows.map((item) => item._id);
  const assignmentRows = await query(TeacherAssignment.find({ $or: [{ teacher: userId }, { classroom: { $in: classroomIds } }] }).select('_id').lean());
  const assignmentIds = assignmentRows.map((item) => item._id);
  const counts = {};
  const deleteAndCount = async (key, model, filter) => {
    const result = await model.deleteMany(filter, options);
    counts[key] = result.deletedCount || 0;
  };
  await deleteAndCount('submissions', AssignmentSubmission, { $or: [{ student: userId }, { assignment: { $in: assignmentIds } }] });
  await deleteAndCount('assignments', TeacherAssignment, { _id: { $in: assignmentIds } });
  await deleteAndCount('careerEnrollments', CareerEnrollment, { user: userId });
  await deleteAndCount('surveys', SurveyResponse, { user: userId });
  await deleteAndCount('learningProgress', LearningProgress, { user: userId });
  await deleteAndCount('assessmentAttempts', AssessmentAttempt, { user: userId });
  await deleteAndCount('assessmentSessions', AssessmentSession, { user: userId });
  await deleteAndCount('checkpointSessions', PartCheckpointSession, { user: userId });
  await deleteAndCount('placementAssessments', PlacementAssessment, { user: userId });
  await deleteAndCount('careerAssessmentSessions', CareerAssessmentSession, { user: userId });
  const removedFromClasses = await Classroom.updateMany({ 'students.user': userId }, { $pull: { students: { user: userId } } }, options);
  counts.classMembershipsRemoved = removedFromClasses.modifiedCount || 0;
  await deleteAndCount('teacherClasses', Classroom, { teacher: userId });
  const deleted = await User.deleteOne({ _id: userId }, options);
  counts.users = deleted.deletedCount || 0;
  if (counts.users !== 1) throw new Error('Tài khoản không còn tồn tại tại thời điểm xóa; thao tác dọn dữ liệu đã bị hủy nếu có transaction.');
  return counts;
}
function isTransactionUnavailable(error) {
  return error?.code === 20 || /Transaction numbers are only allowed|transactions are not supported|replica set member or mongos/i.test(error?.message || '');
}
async function verifyUserDeletion(userId) {
  const checks = await Promise.all([
    ['surveys', SurveyResponse.countDocuments({ user: userId })],
    ['learningProgress', LearningProgress.countDocuments({ user: userId })],
    ['assessmentAttempts', AssessmentAttempt.countDocuments({ user: userId })],
    ['assessmentSessions', AssessmentSession.countDocuments({ user: userId })],
    ['checkpointSessions', PartCheckpointSession.countDocuments({ user: userId })],
    ['placementAssessments', PlacementAssessment.countDocuments({ user: userId })],
    ['careerEnrollments', CareerEnrollment.countDocuments({ user: userId })],
    ['careerAssessmentSessions', CareerAssessmentSession.countDocuments({ user: userId })],
    ['studentSubmissions', AssignmentSubmission.countDocuments({ student: userId })],
    ['teacherAssignments', TeacherAssignment.countDocuments({ teacher: userId })],
    ['teacherClasses', Classroom.countDocuments({ teacher: userId })],
    ['classMemberships', Classroom.countDocuments({ 'students.user': userId })]
  ].map(async ([key, query]) => [key, await query]));
  const userStillExists = Boolean(await User.exists({ _id: userId }));
  const residualRecords = Object.fromEntries(checks);
  return { userStillExists, residualRecords, verified: !userStillExists && checks.every(([, count]) => count === 0) };
}
router.get('/email-diagnostics', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Nhập địa chỉ email hợp lệ để kiểm tra.' });
    const accounts = await User.find(canonicalEmailFilter(email)).select('_id fullName email role status createdAt updatedAt').sort({ createdAt: 1 }).lean();
    const indexes = await User.collection.indexes();
    const emailUniqueIndexes = indexes.filter((item) => item.key?.email === 1 && item.unique === true).map((item) => ({ name: item.name, unique: true, key: item.key }));
    res.json({ queriedEmail: email, database: mongoose.connection.name || '', databaseConnected: mongoose.connection.readyState === 1, exactStoredMatchCount: await User.countDocuments({ email }), normalizedMatchCount: accounts.length, normalizedMatches: accounts.map((item) => ({ id: String(item._id), fullName: item.fullName, email: item.email, normalizedEmail: normalizeEmail(item.email), role: item.role, status: item.status, createdAt: item.createdAt })), emailUniqueIndexes, guidance: accounts.length ? 'Có tài khoản trong MongoDB khớp sau khi chuẩn hóa chữ hoa/thường/khoảng trắng. Nếu người dùng cho rằng chưa đăng ký, kiểm tra đúng tài khoản và trạng thái trước khi xóa.' : 'Không tìm thấy tài khoản khớp trong collection users theo email đã chuẩn hóa; nếu đăng ký vẫn báo trùng, hãy kiểm tra log lỗi E11000 và index/collection môi trường triển khai.' });
  } catch (error) { next(error); }
});
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Mã tài khoản không hợp lệ.' });
    const user = await User.findById(req.params.id).select('fullName email role').lean();
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản trong collection users của MongoDB.' });
    let purgeCounts;
    const dbSession = await mongoose.startSession();
    try {
      try {
        await dbSession.withTransaction(async () => { purgeCounts = await purgeUserData(user._id, dbSession); });
      } catch (error) {
        if (!isTransactionUnavailable(error)) throw error;
        // MongoDB standalone instances do not support transactions. In that case, delete dependent data first and delete users last.
        purgeCounts = await purgeUserData(user._id, null);
      }
    } finally { await dbSession.endSession(); }
    const verification = await verifyUserDeletion(user._id);
    if (!verification.verified) {
      await recordActivity(req, { action: 'account.delete.verification_failed', targetType: 'user', targetId: String(user._id), targetName: user.email, description: 'Không vượt qua xác minh sau khi xóa; cần kiểm tra các bản ghi còn lại.', success: false, metadata: { role: user.role, purgeCounts, verification, database: mongoose.connection.name || '' } });
      return res.status(500).json({ error: 'Không thể xác nhận đã dọn hết dữ liệu liên quan trong MongoDB. Hãy kiểm tra kết quả bên dưới trước khi thử lại.', deletedFromDatabase: !verification.userStillExists, purgeCounts, verification, database: mongoose.connection.name || '' });
    }
    let invalidatedSessions = 0;
    try {
      const sessionPattern = new RegExp('"id"\\s*:\\s*"' + String(user._id) + '"');
      const sessionResult = await mongoose.connection.collection('sessions').deleteMany({ session: { $regex: sessionPattern } });
      invalidatedSessions = sessionResult.deletedCount || 0;
    } catch (_error) {
      // The user's database record is already verified absent; middleware rejects a deleted account on its next API request.
    }
    await recordActivity(req, { action: 'account.delete', targetType: 'user', targetId: String(user._id), targetName: user.email, description: 'Đã xác minh xóa tài khoản trong MongoDB và dọn các bản ghi liên quan; nhật ký kiểm toán được giữ lại.', metadata: { role: user.role, purgeCounts, invalidatedSessions, verification, database: mongoose.connection.name || '' } });
    res.json({ message: 'Đã xóa tài khoản khỏi MongoDB; kiểm tra sau xóa đã thành công. Nhật ký kiểm toán được giữ lại.', deletedFromDatabase: true, purgeCounts, invalidatedSessions, verification, database: mongoose.connection.name || '', auditLogRetained: true });
  } catch (error) { next(error); }
});
router.get('/activity', async (req, res, next) => {
  try {
    const page = safePage(req.query.page, 1, 10000); const limit = safePage(req.query.limit, 30, 100);
    const filter = {};
    if (req.query.action) filter.action = safeString(req.query.action, 80);
    if (req.query.actorRole) filter.actorRole = safeString(req.query.actorRole, 40);
    if (req.query.targetId) filter.targetId = safeString(req.query.targetId, 160);
    const [total, rows] = await Promise.all([ActivityLog.countDocuments(filter), ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
    res.json({ page, limit, total, rows });
  } catch (error) { next(error); }
});

router.get('/curriculum/catalog', async (req, res, next) => {
  try {
    const grade = curriculum.normalizeGrade(req.query.grade || 1); const programCode = String(req.query.programCode || 'ctst');
    const catalog = curriculum.buildCatalog(grade, programCode);
    if (!catalog) return res.status(400).json({ error: 'Lớp hoặc bộ sách không hợp lệ.' });
    res.json({ grade, programCode, subjects: catalog.courses.map((course) => ({ code: course.subjectCode, name: course.subjectName, courseId: course.id, units: course.units.map((unit) => ({ id: unit.id, title: unit.title, lessons: unit.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title })) })) })) });
  } catch (error) { next(error); }
});

router.get('/content', async (req, res, next) => {
  try {
    const page = safePage(req.query.page, 1, 10000); const limit = safePage(req.query.limit, 20, 100); const filter = {};
    if (['course', 'lesson', 'assessment', 'import'].includes(req.query.contentType)) filter.contentType = req.query.contentType;
    if (['draft', 'published', 'archived'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.grade) { const grade = Number(req.query.grade); if (Number.isInteger(grade) && grade >= 1 && grade <= 12) filter.grade = grade; }
    if (req.query.q) filter.title = new RegExp(safeString(req.query.q, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [total, rows] = await Promise.all([ContentEntry.countDocuments(filter), ContentEntry.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
    res.json({ page, limit, total, rows });
  } catch (error) { next(error); }
});
router.post('/content', async (req, res, next) => {
  try {
    const prepared = contentPayload(req.body, String(req.session.user.id));
    if (prepared.error) return res.status(400).json({ error: prepared.error });
    const entry = await ContentEntry.create({ ...prepared.value, createdBy: String(req.session.user.id) });
    await recordActivity(req, { action: 'content.create', targetType: entry.contentType, targetId: String(entry._id), targetName: entry.title, description: 'Tạo nội dung quản trị mới.' });
    res.status(201).json({ message: 'Đã tạo nội dung.', entry });
  } catch (error) { next(error); }
});
router.put('/content/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Mã nội dung không hợp lệ.' });
    const existing = await ContentEntry.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy nội dung.' });
    const prepared = contentPayload(req.body, String(req.session.user.id), existing);
    if (prepared.error) return res.status(400).json({ error: prepared.error });
    const entry = await ContentEntry.findByIdAndUpdate(existing._id, { $set: prepared.value }, { new: true, runValidators: true }).lean();
    await recordActivity(req, { action: 'content.update', targetType: entry.contentType, targetId: String(entry._id), targetName: entry.title, description: 'Cập nhật nội dung học tập.' });
    res.json({ message: 'Đã cập nhật nội dung.', entry });
  } catch (error) { next(error); }
});
router.delete('/content/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Mã nội dung không hợp lệ.' });
    const entry = await ContentEntry.findByIdAndDelete(req.params.id).lean();
    if (!entry) return res.status(404).json({ error: 'Không tìm thấy nội dung.' });
    await recordActivity(req, { action: 'content.delete', targetType: entry.contentType, targetId: String(entry._id), targetName: entry.title, description: 'Xóa nội dung quản trị.' });
    res.json({ message: 'Đã xóa nội dung.' });
  } catch (error) { next(error); }
});

router.get('/question-bank', async (req, res, next) => {
  try {
    const filter = {};
    for (const key of ['programCode', 'subjectCode', 'lessonId', 'type']) if (req.query[key]) filter[key] = safeString(req.query[key], 180);
    if (req.query.grade) filter.grade = Number(req.query.grade);
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;
    const page = safePage(req.query.page, 1, 10000); const limit = safePage(req.query.limit, 30, 100);
    const [total, rows] = await Promise.all([QuestionBankItem.countDocuments(filter), QuestionBankItem.find(filter).sort({ updatedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
    res.json({ page, limit, total, rows });
  } catch (error) { next(error); }
});
function questionPayload(body, existing = {}) {
  const grade = Number(body.grade ?? existing.grade);
  const programCode = safeString(body.programCode ?? existing.programCode ?? 'ctst', 20);
  const subjectCode = safeString(body.subjectCode ?? existing.subjectCode, 80);
  const lessonId = safeString(body.lessonId ?? existing.lessonId, 180);
  const type = safeString(body.type ?? existing.type ?? 'multiple_choice', 30);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { error: 'Lớp phải nằm trong khoảng 1–12.' };
  if (!['ctst', 'kntt', 'canhdieu'].includes(programCode) || !/^[a-z_]{2,80}$/.test(subjectCode)) return { error: 'Bộ sách hoặc môn học không hợp lệ.' };
  if (!['multiple_choice', 'fill_blank', 'short_answer', 'essay'].includes(type)) return { error: 'Loại câu hỏi không hợp lệ.' };
  if (!lessonId || !safeString(body.prompt ?? existing.prompt, 5000)) return { error: 'Cần chọn bài học và nhập nội dung câu hỏi.' };
  const program = curriculum.normalizeProgram(programCode); const found = curriculum.findLesson({ grade, programCode, subjectCode, lessonId });
  if (!program || !found) return { error: 'Bài học không tồn tại trong đúng lớp, bộ sách và môn đã chọn.' };
  return { value: { questionId: safeString(body.questionId ?? existing.questionId, 180) || `adm-${new mongoose.Types.ObjectId().toString()}`, id: safeString(body.id ?? existing.id, 180) || `adm-${new mongoose.Types.ObjectId().toString()}`, grade, programCode, subjectCode, courseId: found.course.id, unitId: found.unit.id, lessonId, topicTag: found.lesson.topicTag, topicTitle: found.lesson.title, type, prompt: safeString(body.prompt ?? existing.prompt, 5000), options: Array.isArray(body.options) ? body.options.slice(0, 8) : (existing.options || []), correctAnswer: safeString(body.correctAnswer ?? existing.correctAnswer, 2000), acceptedAnswers: Array.isArray(body.acceptedAnswers) ? body.acceptedAnswers.slice(0, 50).map((v) => safeString(v, 500)) : (existing.acceptedAnswers || []), points: Math.min(100, Math.max(0, Number(body.points ?? existing.points) || 1)), explanation: safeString(body.explanation ?? existing.explanation, 5000), rubric: Array.isArray(body.rubric) ? body.rubric.slice(0, 20).map((v) => safeString(v, 500)) : (existing.rubric || []), contentStatus: 'draft-teacher-review-required', active: body.active === true || body.active === 'true', updatedAt: new Date() } };
}
router.post('/question-bank', async (req, res, next) => {
  try {
    const prepared = questionPayload(req.body);
    if (prepared.error) return res.status(400).json({ error: prepared.error });
    const record = await QuestionBankItem.create({ ...prepared.value, createdAt: new Date(), bankVersion: 'V6.1.0' });
    await recordActivity(req, { action: 'question.create', targetType: 'question', targetId: record.questionId, targetName: record.prompt, description: 'Thêm câu hỏi vào ngân hàng.' });
    res.status(201).json({ message: 'Đã thêm câu hỏi vào ngân hàng.', question: record });
  } catch (error) { if (error?.code === 11000) return res.status(409).json({ error: 'Mã câu hỏi đã tồn tại.' }); next(error); }
});
router.put('/question-bank/:id', async (req, res, next) => {
  try {
    const existing = await QuestionBankItem.findOne({ $or: [{ _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { questionId: req.params.id }] });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
    const prepared = questionPayload({ ...existing.toObject(), ...req.body, questionId: existing.questionId, id: existing.id }, existing.toObject());
    if (prepared.error) return res.status(400).json({ error: prepared.error });
    Object.assign(existing, prepared.value, { questionId: existing.questionId, id: existing.id });
    await existing.save();
    await recordActivity(req, { action: 'question.update', targetType: 'question', targetId: existing.questionId, targetName: existing.prompt, description: 'Cập nhật câu hỏi trong ngân hàng.' });
    res.json({ message: 'Đã cập nhật câu hỏi.', question: existing });
  } catch (error) { next(error); }
});
router.delete('/question-bank/:id', async (req, res, next) => {
  try {
    const question = await QuestionBankItem.findOneAndUpdate({ $or: [{ _id: mongoose.isValidObjectId(req.params.id) ? req.params.id : null }, { questionId: req.params.id }] }, { $set: { active: false, updatedAt: new Date(), contentStatus: 'archived-admin-disabled' } }, { new: true }).lean();
    if (!question) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
    await recordActivity(req, { action: 'question.disable', targetType: 'question', targetId: question.questionId, targetName: question.prompt, description: 'Vô hiệu hóa câu hỏi (giữ lại lịch sử).'});
    res.json({ message: 'Đã vô hiệu hóa câu hỏi; lịch sử đề cũ vẫn được giữ.' });
  } catch (error) { next(error); }
});

router.post('/career-question-bank', async (req, res, next) => {
  try {
    const course = require('../../../../content/career-paths/software-development').getCourse(safeString(req.body.courseId, 100));
    if (!course) return res.status(400).json({ error: 'Hãy chọn khóa học Nhóm 1 hợp lệ.' });
    const lesson = course.lessons.find((item) => item.id === safeString(req.body.lessonId, 140));
    const module = course.modules.find((item) => item.lessons.some((entry) => entry.id === lesson?.id));
    if (!lesson || !module) return res.status(400).json({ error: 'Bài học không thuộc khóa đã chọn.' });
    const type = safeString(req.body.type, 30);
    const allowedTypes = ['multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'essay', 'code_challenge', 'debugging', 'design_task'];
    if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Dạng câu hỏi không hợp lệ.' });
    const prompt = safeString(req.body.prompt, 12000);
    const correctAnswer = safeString(req.body.correctAnswer, 12000);
    const options = Array.isArray(req.body.options) ? req.body.options.slice(0, 8).map((option) => ({ value: safeString(option.value, 1200), label: safeString(option.label || option.value, 1400) })).filter((option) => option.value) : [];
    const acceptedAnswers = Array.isArray(req.body.acceptedAnswers) ? req.body.acceptedAnswers.map((value) => safeString(value, 1200)).filter(Boolean).slice(0, 30) : [];
    const rubric = Array.isArray(req.body.rubric) ? req.body.rubric.map((value) => safeString(value, 1200)).filter(Boolean).slice(0, 20) : [];
    if (prompt.length < 8) return res.status(400).json({ error: 'Nội dung câu hỏi phải có ít nhất 8 ký tự.' });
    if (type === 'multiple_choice' && (options.length < 2 || !options.some((option) => option.value === correctAnswer))) return res.status(400).json({ error: 'Câu trắc nghiệm cần ít nhất hai lựa chọn và đáp án đúng nằm trong lựa chọn.' });
    if (type === 'true_false' && !['true', 'false'].includes(correctAnswer)) return res.status(400).json({ error: 'Câu đúng/sai cần đáp án true hoặc false.' });
    const item = await CareerQuestionBankItem.create({
      questionId: `career-admin-${crypto.randomUUID()}`, courseId: course.id, moduleId: module.id, lessonId: lesson.id, type, prompt, options,
      correctAnswer, acceptedAnswers: uniqueStrings([correctAnswer, ...acceptedAnswers]), explanation: safeString(req.body.explanation, 4000), rubric,
      points: Math.max(1, Math.min(100, Number(req.body.points) || 1)), difficulty: ['easy', 'medium', 'hard'].includes(req.body.difficulty) ? req.body.difficulty : 'medium',
      taxonomy: ['remember', 'understand', 'apply', 'analyze', 'create'].includes(req.body.taxonomy) ? req.body.taxonomy : 'understand',
      topicTags: [course.id, module.id, lesson.id], contentStatus: 'draft-manual-question-review-required', active: false, bankVersion: 'V6.1.0', updatedBy: String(req.session.user.id)
    });
    await recordActivity(req, { action: 'career.question.create', targetType: 'career-question', targetId: item.questionId, targetName: item.prompt, description: 'Tạo câu hỏi trong ngân hàng Đại học – Phát triển phần mềm; mặc định chờ duyệt.' });
    res.status(201).json({ message: 'Đã tạo câu hỏi ở trạng thái chờ duyệt.', question: { questionId: item.questionId, courseId: item.courseId, lessonId: item.lessonId, type: item.type, prompt: item.prompt, active: item.active } });
  } catch (error) { next(error); }
});
function uniqueStrings(values) { return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]; }
router.get('/career-question-bank', async (req, res, next) => {
  try {
    const page = safePage(req.query.page, 1, 100000); const limit = safePage(req.query.limit, 30, 100); const filter = {};
    for (const key of ['courseId', 'lessonId', 'type', 'contentStatus']) if (req.query[key]) filter[key] = safeString(req.query[key], 180);
    if (['true', 'false'].includes(req.query.active)) filter.active = req.query.active === 'true';
    if (req.query.q) filter.prompt = new RegExp(safeString(req.query.q, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [total, rows] = await Promise.all([
      CareerQuestionBankItem.countDocuments(filter),
      CareerQuestionBankItem.find(filter).select('+correctAnswer +acceptedAnswers +explanation').sort({ courseId: 1, lessonId: 1, createdAt: 1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);
    const catalog = require('../../../../content/career-paths/software-development');
    const enriched = rows.map((row) => { const course = catalog.getCourse(row.courseId); const lesson = course?.lessons.find((item) => item.id === row.lessonId); return { ...row, courseTitle: course?.title || row.courseId, lessonTitle: lesson?.title || row.lessonId }; });
    res.json({ page, limit, total, rows: enriched });
  } catch (error) { next(error); }
});
router.put('/career-question-bank/:id', async (req, res, next) => {
  try {
    const item = await CareerQuestionBankItem.findOne({ $or: [{ questionId: req.params.id }, ...(mongoose.isValidObjectId(req.params.id) ? [{ _id: req.params.id }] : [])] }).select('+correctAnswer +acceptedAnswers +explanation');
    if (!item) return res.status(404).json({ error: 'Không tìm thấy câu hỏi ngành CNTT.' });
    const courseId = safeString(req.body.courseId ?? item.courseId, 100);
    const lessonId = safeString(req.body.lessonId ?? item.lessonId, 140);
    const course = require('../../../../content/career-paths/software-development').getCourse(courseId);
    const lesson = course?.lessons.find((entry) => entry.id === lessonId);
    const module = course?.modules.find((entry) => entry.lessons.some((candidate) => candidate.id === lessonId));
    if (!course || !lesson || !module) return res.status(400).json({ error: 'Bài học phải thuộc đúng khóa học được chọn.' });
    const prompt = safeString(req.body.prompt ?? item.prompt, 12000);
    const correctAnswer = safeString(req.body.correctAnswer ?? item.correctAnswer, 12000);
    const acceptedAnswers = Array.isArray(req.body.acceptedAnswers) ? req.body.acceptedAnswers.map((value) => safeString(value, 1200)).filter(Boolean).slice(0, 30) : item.acceptedAnswers;
    const options = Array.isArray(req.body.options) ? req.body.options.slice(0, 8).map((option) => ({ value: safeString(option.value, 1200), label: safeString(option.label || option.value, 1400) })).filter((option) => option.value) : item.options;
    const rubric = Array.isArray(req.body.rubric) ? req.body.rubric.map((value) => safeString(value, 1200)).filter(Boolean).slice(0, 20) : item.rubric;
    if (prompt.length < 8) return res.status(400).json({ error: 'Nội dung câu hỏi phải có ít nhất 8 ký tự.' });
    if (item.type === 'multiple_choice' && (options.length < 2 || !options.some((option) => option.value === correctAnswer))) return res.status(400).json({ error: 'Câu trắc nghiệm cần ít nhất hai lựa chọn và đáp án đúng phải nằm trong các lựa chọn.' });
    if (['fill_blank', 'true_false'].includes(item.type) && !correctAnswer) return res.status(400).json({ error: 'Câu hỏi chấm tự động cần có đáp án đúng.' });
    if (item.type === 'true_false' && !['true', 'false'].includes(correctAnswer)) return res.status(400).json({ error: 'Câu đúng/sai chỉ nhận đáp án true hoặc false.' });
    item.courseId = course.id; item.moduleId = module.id; item.lessonId = lesson.id; item.topicTags = [course.id, module.id, lesson.id];
    item.prompt = prompt; item.correctAnswer = correctAnswer; item.acceptedAnswers = acceptedAnswers; item.options = options; item.rubric = rubric;
    item.explanation = safeString(req.body.explanation ?? item.explanation, 4000);
    item.points = Math.max(1, Math.min(100, Number(req.body.points ?? item.points) || 1));
    item.difficulty = ['easy', 'medium', 'hard'].includes(req.body.difficulty) ? req.body.difficulty : item.difficulty;
    item.taxonomy = ['remember', 'understand', 'apply', 'analyze', 'create'].includes(req.body.taxonomy) ? req.body.taxonomy : item.taxonomy;
    // Any edit returns the item to inactive review to avoid publishing unverified changes.
    item.active = false; item.contentStatus = 'draft-edited-review-required'; item.updatedBy = String(req.session.user.id);
    await item.save();
    await recordActivity(req, { action: 'career.question.update', targetType: 'career-question', targetId: item.questionId, targetName: item.prompt, description: 'Chỉnh sửa câu hỏi ngành Phát triển phần mềm; chuyển về trạng thái chờ duyệt.' });
    res.json({ message: 'Đã lưu câu hỏi ở trạng thái chờ duyệt lại.', question: { questionId: item.questionId, prompt: item.prompt, active: item.active, contentStatus: item.contentStatus } });
  } catch (error) { next(error); }
});
router.patch('/career-question-bank/bulk-status', async (req, res, next) => {
  try {
    const courseId = safeString(req.body.courseId, 100);
    const lessonId = safeString(req.body.lessonId, 140);
    const active = req.body.active;
    if (!courseId || !lessonId || typeof active !== 'boolean') return res.status(400).json({ error: 'Cần chọn chính xác khóa học, bài học và trạng thái muốn đặt.' });
    const course = require('../../../../content/career-paths/software-development').getCourse(courseId);
    if (!course || !course.lessons.some((lesson) => lesson.id === lessonId)) return res.status(400).json({ error: 'Bài học không thuộc khóa học đã chọn.' });
    const items = await CareerQuestionBankItem.find({ courseId, lessonId }).select('+correctAnswer +acceptedAnswers +explanation');
    if (!items.length) return res.status(404).json({ error: 'Bài học này chưa có câu hỏi trong ngân hàng.' });
    if (active) {
      const invalid = items.filter((item) => item.prompt.trim().length < 8 ||
        (item.type === 'multiple_choice' && (!item.correctAnswer || !(item.options || []).some((option) => String(option.value) === item.correctAnswer))) ||
        (item.type === 'true_false' && !['true', 'false'].includes(item.correctAnswer)) ||
        (item.type === 'fill_blank' && !item.correctAnswer && !(item.acceptedAnswers || []).length) ||
        (['essay', 'short_answer', 'code_challenge', 'debugging', 'design_task'].includes(item.type) && !(item.rubric || []).length));
      if (invalid.length) return res.status(400).json({ error: `${invalid.length}/${items.length} câu chưa đủ điều kiện (đáp án trắc nghiệm, đáp án chấm tự động, hoặc rubric). Hãy sửa các câu lỗi trước khi duyệt hàng loạt.`, invalidQuestionIds: invalid.slice(0, 30).map((item) => item.questionId) });
    }
    const result = await CareerQuestionBankItem.updateMany({ courseId, lessonId }, { $set: { active, contentStatus: active ? 'teacher-reviewed-approved' : 'draft-disabled', updatedBy: String(req.session.user.id), updatedAt: new Date() } });
    await recordActivity(req, { action: active ? 'career.question.bulk-activate' : 'career.question.bulk-disable', targetType: 'career-question-bank', targetId: `${courseId}:${lessonId}`, targetName: `${course.title} · ${course.lessons.find((item) => item.id === lessonId).title}`, description: active ? 'Quản trị viên duyệt và bật toàn bộ ngân hàng của bài học.' : 'Quản trị viên tắt toàn bộ ngân hàng của bài học.', metadata: { modifiedCount: result.modifiedCount || 0, itemCount: items.length } });
    res.json({ message: active ? 'Đã bật các câu hỏi đã qua kiểm tra cấu trúc. Trách nhiệm rà soát nội dung trước khi bấm duyệt vẫn thuộc quản trị viên/giáo viên.' : 'Đã tắt các câu hỏi của bài học; dữ liệu và lịch sử đề được giữ.', matchedCount: items.length, modifiedCount: result.modifiedCount || 0, active });
  } catch (error) { next(error); }
});

router.patch('/career-question-bank/:id/status', async (req, res, next) => {
  try {
    const active = req.body.active;
    if (typeof active !== 'boolean') return res.status(400).json({ error: 'Trạng thái active phải là true hoặc false.' });
    const item = await CareerQuestionBankItem.findOne({ $or: [{ questionId: req.params.id }, ...(mongoose.isValidObjectId(req.params.id) ? [{ _id: req.params.id }] : [])] }).select('+correctAnswer +acceptedAnswers');
    if (!item) return res.status(404).json({ error: 'Không tìm thấy câu hỏi ngành CNTT.' });
    if (active && item.type === 'multiple_choice' && (!item.correctAnswer || !item.options.some((option) => String(option.value) === item.correctAnswer))) return res.status(400).json({ error: 'Không thể kích hoạt: cần có đáp án đúng khớp một lựa chọn.' });
    if (active && ['true_false', 'fill_blank'].includes(item.type) && !item.correctAnswer && !(item.acceptedAnswers || []).length) return res.status(400).json({ error: 'Không thể kích hoạt câu hỏi tự chấm nếu chưa có đáp án.' });
    item.active = active; item.contentStatus = active ? 'teacher-reviewed-approved' : 'draft-disabled'; item.updatedBy = String(req.session.user.id); await item.save();
    await recordActivity(req, { action: active ? 'career.question.activate' : 'career.question.disable', targetType: 'career-question', targetId: item.questionId, targetName: item.prompt, description: active ? 'Duyệt và kích hoạt câu hỏi ngành CNTT.' : 'Tắt câu hỏi ngành CNTT.' });
    res.json({ message: active ? 'Đã kích hoạt câu hỏi.' : 'Đã tắt câu hỏi.', questionId: item.questionId, active: item.active, contentStatus: item.contentStatus });
  } catch (error) { next(error); }
});
router.delete('/career-question-bank/:id', async (req, res, next) => {
  try {
    const item = await CareerQuestionBankItem.findOne({ $or: [{ questionId: req.params.id }, ...(mongoose.isValidObjectId(req.params.id) ? [{ _id: req.params.id }] : [])] });
    if (!item) return res.status(404).json({ error: 'Không tìm thấy câu hỏi ngành CNTT.' });
    item.active = false; item.contentStatus = 'archived-admin-disabled'; item.updatedBy = String(req.session.user.id); await item.save();
    await recordActivity(req, { action: 'career.question.delete', targetType: 'career-question', targetId: item.questionId, targetName: item.prompt, description: 'Ngừng sử dụng câu hỏi; giữ bản ghi để bảo toàn lịch sử đề.' });
    res.json({ message: 'Đã ngừng sử dụng câu hỏi. Bản ghi được giữ để bảo toàn lịch sử đề.' });
  } catch (error) { next(error); }
});

router.post('/content-import/preview', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Hãy chọn file Word .docx.' });
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    const extractedText = String(result.value || '').trim();
    if (!extractedText) return res.status(400).json({ error: 'Không trích xuất được nội dung văn bản từ file Word.' });
    if (extractedText.length > 200000) return res.status(413).json({ error: 'Nội dung sau khi trích xuất vượt giới hạn 200.000 ký tự.' });
    const detection = classifyDocument(extractedText);
    const questions = parseQuestions(extractedText);
    await recordActivity(req, { action: 'word-import.preview', targetType: 'document', targetName: req.file.originalname, description: 'Trích xuất và nhận diện file Word.', metadata: { characters: extractedText.length, detectedType: detection.contentType, questionCount: questions.length } });
    res.json({ fileName: safeString(req.file.originalname, 240), extractedText, detection, detectedQuestionCount: questions.length, questions, warnings: (result.messages || []).slice(0, 5).map((item) => item.message), message: 'Đã trích xuất. Cần kiểm tra kết quả nhận diện và chọn vị trí lưu trước khi xác nhận.' });
  } catch (error) {
    if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File Word tối đa 10 MB.' });
    next(error);
  }
});
router.post('/content-import/commit', async (req, res, next) => {
  try {
    const context = validateWordContext(req.body);
    if (!context.valid) return res.status(400).json({ error: context.error });
    const extractedText = safeString(req.body.extractedText, 200000);
    if (!extractedText) return res.status(400).json({ error: 'Không có nội dung đã trích xuất để lưu.' });
    const detection = classifyDocument(extractedText);
    const pickedType = context.value.contentType;
    const questions = parseQuestions(extractedText);
    const grade = context.value.grade; const programCode = context.value.programCode; const subjectCode = context.value.subjectCode;
    const lessonId = safeString(req.body.lessonId, 180);
    let found = null;
    if (lessonId) found = curriculum.findLesson({ grade, programCode, subjectCode, lessonId });
    if (lessonId && !found) return res.status(400).json({ error: 'Mã bài học không thuộc đúng lớp, bộ sách và môn đã chọn.' });
    const catalogCourse = curriculum.buildCourse(grade, programCode, subjectCode);
    if (!catalogCourse) return res.status(400).json({ error: 'Môn học không có trong lớp và bộ sách đã chọn.' });
    const status = req.body.publishNow === true ? 'published' : 'draft';
    const entry = await ContentEntry.create({
      contentType: pickedType,
      title: safeString(req.body.title, 240) || safeString(req.body.fileName, 240) || 'Nội dung nhập từ Word',
      programCode, grade, subjectCode, courseId: catalogCourse.id, unitId: found?.unit.id || safeString(req.body.unitId, 180), lessonId,
      assessmentType: ['lesson', 'chapter', 'midterm', 'final', 'practice'].includes(req.body.assessmentType) ? req.body.assessmentType : (detection.assessmentType || ''),
      objective: safeString(req.body.objective, 5000), body: extractedText, extractedText,
      extractedQuestions: questions, sourceFileName: safeString(req.body.fileName, 240), detectedType: detection.contentType,
      status, createdBy: String(req.session.user.id), updatedBy: String(req.session.user.id)
    });
    let importedBankCount = 0;
    if (req.body.importQuestionsToBank === true && lessonId && questions.length) {
      const ops = questions.map((q, index) => ({ updateOne: { filter: { questionId: `${entry._id}-q${index + 1}` }, update: { $set: {
        questionId: `${entry._id}-q${index + 1}`, id: `${entry._id}-q${index + 1}`, grade, programCode, subjectCode, courseId: catalogCourse.id, unitId: found?.unit.id || '', lessonId, topicTag: found?.lesson.topicTag || '', topicTitle: found?.lesson.title || entry.title,
        type: q.type, prompt: q.prompt, options: q.options || [], correctAnswer: q.correctAnswer || '', acceptedAnswers: q.acceptedAnswers || [], points: q.points || 1, explanation: q.explanation || '', rubric: q.rubric || [], keyConcepts: [], contentStatus: 'draft-word-import-review-required', active: false, bankVersion: 'V6.1.0', updatedAt: new Date()
      }, $setOnInsert: { createdAt: new Date() } }, upsert: true } }));
      if (ops.length) { const result = await QuestionBankItem.bulkWrite(ops, { ordered: false }); importedBankCount = (result.upsertedCount || 0) + (result.modifiedCount || 0); }
    }
    await recordActivity(req, { action: 'word-import.commit', targetType: pickedType, targetId: String(entry._id), targetName: entry.title, description: 'Lưu nội dung được trích xuất từ Word.', metadata: { grade, programCode, subjectCode, lessonId, detectedType: detection.contentType, extractedQuestionCount: questions.length, importedBankCount, status } });
    res.status(201).json({ message: status === 'published' ? 'Đã lưu nội dung ở trạng thái công bố; vẫn cần rà soát nội dung.' : 'Đã lưu bản nháp để rà soát.', entry, extractedQuestionCount: questions.length, importedBankCount, importedQuestionsAreInactive: importedBankCount > 0 });
  } catch (error) { next(error); }
});

router.get('/video-links-help', (_req, res) => res.json({ file: 'content/video-links/video-links.csv', instructions: 'Thay URL example.com bằng link video đã quay; thay status thành ready khi video được duyệt.' }));
module.exports = router;
