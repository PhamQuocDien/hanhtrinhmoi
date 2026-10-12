'use strict';
const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Classroom = require('../models/Classroom');
const TeacherAssignment = require('../models/TeacherAssignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const User = require('../models/User');
const LearningProgress = require('../models/LearningProgress');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const CareerEnrollment = require('../models/CareerEnrollment');
const CareerAssessmentSession = require('../models/CareerAssessmentSession');
const { requireTeacher } = require('../middleware/security');
const { recordActivity } = require('../services/activity-log');
const career = require('../../../../content/career-paths/software-development');
const router = express.Router();
router.use(requireTeacher);
const teacherId = (req) => req.session.user.id;
const clean = (value, max = 3000) => String(value ?? '').trim().slice(0, max);

async function ownedClass(req, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Classroom.findOne({ _id: id, teacher: teacherId(req) });
}
async function ownedAssignment(req, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return TeacherAssignment.findOne({ _id: id, teacher: teacherId(req) });
}
function makeClassCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

router.get('/overview', async (req, res, next) => {
  try {
    const [classes, assignments] = await Promise.all([
      Classroom.find({ teacher: teacherId(req), status: 'active' }).select('students').lean(),
      TeacherAssignment.find({ teacher: teacherId(req) }).select('_id classroom title status').lean()
    ]);
    const studentIds = new Set(classes.flatMap((item) => (item.students || []).map((student) => String(student.user))));
    const assignmentIds = assignments.map((item) => item._id);
    const [pendingSubmissions, gradedSubmissions, recentSubmissions] = await Promise.all([
      AssignmentSubmission.countDocuments({ assignment: { $in: assignmentIds }, status: 'submitted' }),
      AssignmentSubmission.countDocuments({ assignment: { $in: assignmentIds }, status: 'graded' }),
      AssignmentSubmission.find({ assignment: { $in: assignmentIds } }).sort({ submittedAt: -1 }).limit(6).populate('student', 'fullName email').populate('assignment', 'title').lean()
    ]);
    res.json({ classes: classes.length, students: studentIds.size, assignments: assignments.length, pendingSubmissions, gradedSubmissions, recentSubmissions: recentSubmissions.map((row) => ({ id: String(row._id), studentName: row.student?.fullName || 'Tài khoản đã xóa', studentEmail: row.student?.email || '', assignmentTitle: row.assignment?.title || 'Bài tập', status: row.status, score: row.score, submittedAt: row.submittedAt })) });
  } catch (error) { next(error); }
});

router.get('/career-assessments', async (req, res, next) => {
  try {
    const classes = await Classroom.find({ teacher: teacherId(req) }).select('students.user').lean();
    const studentIds = [...new Set(classes.flatMap((row) => (row.students || []).map((student) => String(student.user))))].filter(Boolean);
    if (!studentIds.length) return res.json({ rows: [], total: 0 });
    const rows = await CareerAssessmentSession.find({ user: { $in: studentIds }, status: 'needs_review' }).sort({ submittedAt: 1 }).limit(100).populate('user', 'fullName email').lean();
    const courses = new Map(career.COURSES.map((item) => [item.id, item]));
    res.json({ total: rows.length, rows: rows.map((row) => {
      const course = courses.get(row.courseId);
      const lesson = course?.lessons.find((item) => item.id === row.lessonId);
      const answers = new Map((row.submittedAnswers || []).map((item) => [item.questionId, item.answer]));
      const questions = (row.questionsSnapshot || []).filter((item) => !['multiple_choice', 'true_false', 'fill_blank'].includes(item.type)).map((item) => ({
        questionId: item.questionId, type: item.type, prompt: item.prompt, answer: answers.get(item.questionId) || '', points: item.points || 1, rubric: item.rubric || []
      }));
      return { examId: row.examId, title: row.title, courseId: row.courseId, courseTitle: course?.title || row.courseId, lessonTitle: lesson?.title || 'Bài học tổng hợp', student: row.user ? { id: String(row.user._id), fullName: row.user.fullName, email: row.user.email } : { id: String(row.user), fullName: 'Tài khoản đã xóa', email: '' }, submittedAt: row.submittedAt, autoGradedScore: row.autoGradedScore, autoEarnedPoints: row.autoEarnedPoints || 0, autoPossiblePoints: row.autoPossiblePoints || 0, totalPoints: (row.questionsSnapshot || []).reduce((sum, item) => sum + Number(item.points || 1), 0), questions };
    }) });
  } catch (error) { next(error); }
});

router.patch('/career-assessments/:examId/review', async (req, res, next) => {
  try {
    const row = await CareerAssessmentSession.findOne({ examId: req.params.examId, status: 'needs_review' });
    if (!row) return res.status(404).json({ error: 'Không tìm thấy bài thi đang chờ chấm.' });
    const belongsToTeacher = await Classroom.exists({ teacher: teacherId(req), 'students.user': row.user });
    if (!belongsToTeacher) return res.status(403).json({ error: 'Chỉ giáo viên của lớp có học viên này mới được chấm bài.' });
    const manualQuestions = (row.questionsSnapshot || []).filter((item) => !['multiple_choice', 'true_false', 'fill_blank'].includes(item.type));
    const incoming = Array.isArray(req.body.reviews) ? req.body.reviews : [];
    const byQuestion = new Map(incoming.filter((item) => item && typeof item.questionId === 'string').map((item) => [item.questionId, item]));
    if (manualQuestions.some((item) => !byQuestion.has(item.questionId))) return res.status(400).json({ error: 'Cần chấm điểm cho tất cả câu tự luận/thực hành trước khi hoàn tất.' });
    let manualEarnedPoints = 0;
    const reviewMap = new Map();
    for (const question of manualQuestions) {
      const value = byQuestion.get(question.questionId);
      const maxPoints = Number(question.points || 1);
      const score = Number(value.score);
      if (!Number.isFinite(score) || score < 0 || score > maxPoints) return res.status(400).json({ error: `Điểm câu ${question.questionId} phải nằm trong khoảng 0–${maxPoints}.` });
      manualEarnedPoints += score;
      reviewMap.set(question.questionId, { score, maxScore: maxPoints, feedback: clean(value.feedback, 10000), reviewedBy: teacherId(req), reviewedAt: new Date() });
    }
    row.manualEarnedPoints = manualEarnedPoints;
    row.answerFeedback = (row.answerFeedback || []).map((feedback) => {
      const review = reviewMap.get(feedback.questionId);
      return review ? { ...feedback.toObject?.() || feedback, isCorrect: null, message: 'Đã được giáo viên chấm', score: review.score, maxScore: review.maxScore, feedback: review.feedback } : feedback;
    });
    row.manualReviewPending = 0;
    row.reviewedBy = teacherId(req);
    row.reviewedAt = new Date();
    const totalPossiblePoints = (row.questionsSnapshot || []).reduce((sum, item) => sum + Number(item.points || 1), 0);
    const totalEarnedPoints = Number(row.autoEarnedPoints || 0) + manualEarnedPoints;
    row.score = totalPossiblePoints ? Math.round(totalEarnedPoints / totalPossiblePoints * 100) : 0;
    row.passed = row.score >= row.passScore;
    row.status = 'submitted';
    await row.save();
    await recordActivity(req, { action: 'career.assessment.review', targetType: 'career-assessment', targetId: row.examId, targetName: row.title, description: 'Giáo viên đã chấm phần tự luận/thực hành của bài luyện tập CNTT.', metadata: { score: row.score, manualEarnedPoints, totalPossiblePoints } });
    res.json({ message: 'Đã lưu điểm và nhận xét cho bài luyện tập CNTT.', examId: row.examId, score: row.score, passed: row.passed, manualEarnedPoints, totalPossiblePoints });
  } catch (error) { next(error); }
});

router.get('/classes', async (req, res, next) => {
  try {
    const rows = await Classroom.find({ teacher: teacherId(req) }).sort({ updatedAt: -1 }).populate('students.user', 'fullName email role status grade school').lean();
    res.json({ rows: rows.map((row) => ({ ...row, id: String(row._id), students: (row.students || []).filter((entry) => entry.user).map((entry) => ({ id: String(entry.user._id), fullName: entry.user.fullName, email: entry.user.email, role: entry.user.role, status: entry.user.status, grade: entry.user.grade, school: entry.user.school, joinedAt: entry.joinedAt })) })) });
  } catch (error) { next(error); }
});

router.post('/classes', async (req, res, next) => {
  try {
    const name = clean(req.body.name, 120);
    if (name.length < 3) return res.status(400).json({ error: 'Tên lớp/nhóm cần ít nhất 3 ký tự.' });
    const subjectArea = clean(req.body.subjectArea || 'software-development', 100);
    const courseIds = Array.isArray(req.body.courseIds) ? [...new Set(req.body.courseIds.filter((id) => career.getCourse(String(id))).map(String))].slice(0, 20) : [];
    const classroom = await Classroom.create({ teacher: teacherId(req), name, description: clean(req.body.description, 3000), subjectArea, courseIds, inviteCode: makeClassCode() });
    await recordActivity(req, { action: 'teacher.class.create', targetType: 'classroom', targetId: String(classroom._id), targetName: classroom.name, description: 'Giáo viên tạo lớp/nhóm học.' });
    res.status(201).json({ message: 'Đã tạo lớp học.', classroom: { id: String(classroom._id), name: classroom.name, inviteCode: classroom.inviteCode } });
  } catch (error) { next(error); }
});

router.put('/classes/:id', async (req, res, next) => {
  try {
    const classroom = await ownedClass(req, req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Không tìm thấy lớp học của bạn.' });
    const name = clean(req.body.name ?? classroom.name, 120);
    if (name.length < 3) return res.status(400).json({ error: 'Tên lớp/nhóm cần ít nhất 3 ký tự.' });
    classroom.name = name;
    classroom.description = clean(req.body.description ?? classroom.description, 3000);
    classroom.subjectArea = clean(req.body.subjectArea ?? classroom.subjectArea, 100);
    if (Array.isArray(req.body.courseIds)) classroom.courseIds = [...new Set(req.body.courseIds.filter((id) => career.getCourse(String(id))).map(String))].slice(0, 20);
    if (['active', 'archived'].includes(req.body.status)) classroom.status = req.body.status;
    await classroom.save();
    await recordActivity(req, { action: 'teacher.class.update', targetType: 'classroom', targetId: String(classroom._id), targetName: classroom.name, description: 'Giáo viên chỉnh sửa lớp/nhóm học.' });
    res.json({ message: 'Đã cập nhật lớp học.' });
  } catch (error) { next(error); }
});

router.delete('/classes/:id', async (req, res, next) => {
  try {
    const classroom = await ownedClass(req, req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Không tìm thấy lớp học của bạn.' });
    classroom.status = 'archived';
    await classroom.save();
    await TeacherAssignment.updateMany({ classroom: classroom._id }, { $set: { status: 'closed' } });
    await recordActivity(req, { action: 'teacher.class.archive', targetType: 'classroom', targetId: String(classroom._id), targetName: classroom.name, description: 'Giáo viên lưu trữ lớp học; dữ liệu bài tập và kết quả được giữ lại.' });
    res.json({ message: 'Đã lưu trữ lớp học. Lịch sử bài tập và điểm vẫn được giữ.' });
  } catch (error) { next(error); }
});

router.post('/classes/:id/students', async (req, res, next) => {
  try {
    const classroom = await ownedClass(req, req.params.id);
    if (!classroom || classroom.status !== 'active') return res.status(404).json({ error: 'Không tìm thấy lớp đang hoạt động.' });
    const email = clean(req.body.email, 254).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Nhập email học viên hợp lệ.' });
    const student = await User.findOne({ email, role: { $in: ['student', 'university_student'] }, status: 'active' }).select('fullName email role').lean();
    if (!student) return res.status(404).json({ error: 'Không tìm thấy tài khoản học sinh/sinh viên đang hoạt động với email này.' });
    if (classroom.students.some((entry) => String(entry.user) === String(student._id))) return res.status(409).json({ error: 'Học viên đã có trong lớp.' });
    if (classroom.students.length >= 300) return res.status(409).json({ error: 'Lớp đã đạt giới hạn 300 học viên.' });
    classroom.students.push({ user: student._id, joinedAt: new Date() });
    await classroom.save();
    await recordActivity(req, { action: 'teacher.class.add-student', targetType: 'classroom', targetId: String(classroom._id), targetName: classroom.name, description: `Thêm học viên ${student.email} vào lớp.`, metadata: { studentId: String(student._id) } });
    res.status(201).json({ message: `Đã thêm ${student.fullName} vào lớp.` });
  } catch (error) { next(error); }
});

router.delete('/classes/:id/students/:studentId', async (req, res, next) => {
  try {
    const classroom = await ownedClass(req, req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
    const before = classroom.students.length;
    classroom.students = classroom.students.filter((entry) => String(entry.user) !== req.params.studentId);
    if (classroom.students.length === before) return res.status(404).json({ error: 'Học viên không nằm trong lớp này.' });
    await classroom.save();
    await recordActivity(req, { action: 'teacher.class.remove-student', targetType: 'classroom', targetId: String(classroom._id), targetName: classroom.name, description: 'Giáo viên gỡ học viên khỏi lớp; lịch sử cũ không bị xóa.', metadata: { studentId: req.params.studentId } });
    res.json({ message: 'Đã gỡ học viên khỏi lớp; lịch sử học tập trước đó vẫn được giữ.' });
  } catch (error) { next(error); }
});

router.get('/classes/:id/progress', async (req, res, next) => {
  try {
    const classroom = await ownedClass(req, req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Không tìm thấy lớp học.' });
    const roster = await Classroom.findById(classroom._id).populate('students.user', 'fullName email role status').lean();
    const students = (roster.students || []).filter((entry) => entry.user).map((entry) => entry.user);
    const ids = students.map((student) => student._id);
    const [progressRows, attempts, careerRows] = await Promise.all([
      LearningProgress.find({ user: { $in: ids } }).select('user courseId lessons lastActivityAt').lean(),
      AssessmentAttempt.find({ user: { $in: ids } }).select('user score createdAt type').sort({ createdAt: -1 }).lean(),
      classroom.courseIds.length ? CareerEnrollment.find({ user: { $in: ids }, courseId: { $in: classroom.courseIds } }).select('user courseId completedLessonIds status lastActivityAt').lean() : Promise.resolve([])
    ]);
    const byUser = new Map();
    for (const student of students) {
      const rows = progressRows.filter((row) => String(row.user) === String(student._id));
      const lessonRows = rows.flatMap((row) => row.lessons || []);
      const userCareerRows = careerRows.filter((row) => String(row.user) === String(student._id));
      const careerDone = userCareerRows.reduce((sum, row) => sum + (row.completedLessonIds || []).length, 0);
      const careerTracked = userCareerRows.reduce((sum, row) => sum + (career.getCourse(row.courseId)?.lessonCount || 0), 0);
      const userAttempts = attempts.filter((row) => String(row.user) === String(student._id));
      byUser.set(String(student._id), { id: String(student._id), fullName: student.fullName, email: student.email, status: student.status, completedLessons: lessonRows.filter((lesson) => lesson.passed).length + careerDone, trackedLessons: lessonRows.length + careerTracked, careerCourses: userCareerRows.map((row) => ({ courseId: row.courseId, title: career.getCourse(row.courseId)?.title || row.courseId, completedLessons: (row.completedLessonIds || []).length, lessonCount: career.getCourse(row.courseId)?.lessonCount || 0, status: row.status })), assessmentCount: userAttempts.length, averageScore: userAttempts.length ? Math.round(userAttempts.reduce((sum, row) => sum + Number(row.score || 0), 0) / userAttempts.length) : null, latestActivity: rows.map((row) => row.lastActivityAt).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null });
    }
    res.json({ classroom: { id: String(classroom._id), name: classroom.name }, students: [...byUser.values()] });
  } catch (error) { next(error); }
});

router.get('/assignments', async (req, res, next) => {
  try {
    const rows = await TeacherAssignment.find({ teacher: teacherId(req) }).sort({ updatedAt: -1 }).populate('classroom', 'name status').lean();
    const counts = await AssignmentSubmission.aggregate([{ $match: { assignment: { $in: rows.map((item) => item._id) }, status: 'submitted' } }, { $group: { _id: '$assignment', count: { $sum: 1 } } }]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
    res.json({ rows: rows.map((row) => ({ ...row, id: String(row._id), className: row.classroom?.name || 'Lớp đã lưu trữ', pendingCount: countMap.get(String(row._id)) || 0 })) });
  } catch (error) { next(error); }
});

router.post('/assignments', async (req, res, next) => {
  try {
    const classroom = await ownedClass(req, req.body.classroomId);
    if (!classroom || classroom.status !== 'active') return res.status(400).json({ error: 'Hãy chọn lớp đang hoạt động do bạn quản lý.' });
    const title = clean(req.body.title, 180);
    if (title.length < 3) return res.status(400).json({ error: 'Tiêu đề bài tập cần ít nhất 3 ký tự.' });
    const submissionType = ['text', 'link'].includes(req.body.submissionType) ? req.body.submissionType : 'text';
    const courseId = clean(req.body.courseId, 100);
    if (courseId && !career.getCourse(courseId)) return res.status(400).json({ error: 'Khóa học mục tiêu không hợp lệ.' });
    const maxScore = Number(req.body.maxScore ?? 100);
    if (!Number.isFinite(maxScore) || maxScore < 1 || maxScore > 1000) return res.status(400).json({ error: 'Điểm tối đa phải từ 1 đến 1000.' });
    const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Hạn nộp không hợp lệ.' });
    const status = ['draft', 'published'].includes(req.body.status) ? req.body.status : 'published';
    const assignment = await TeacherAssignment.create({ teacher: teacherId(req), classroom: classroom._id, title, instructions: clean(req.body.instructions, 10000), submissionType, courseId, lessonId: clean(req.body.lessonId, 140), dueAt, maxScore, status });
    await recordActivity(req, { action: 'teacher.assignment.create', targetType: 'assignment', targetId: String(assignment._id), targetName: assignment.title, description: 'Giáo viên tạo bài tập.', metadata: { classroomId: String(classroom._id), courseId } });
    res.status(201).json({ message: 'Đã tạo bài tập.', id: String(assignment._id) });
  } catch (error) { next(error); }
});

router.put('/assignments/:id', async (req, res, next) => {
  try {
    const assignment = await ownedAssignment(req, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập.' });
    const title = clean(req.body.title ?? assignment.title, 180);
    if (title.length < 3) return res.status(400).json({ error: 'Tiêu đề bài tập cần ít nhất 3 ký tự.' });
    if (req.body.classroomId && String(req.body.classroomId) !== String(assignment.classroom)) {
      const nextClass = await ownedClass(req, req.body.classroomId);
      if (!nextClass || nextClass.status !== 'active') return res.status(400).json({ error: 'Lớp mới không hợp lệ.' });
      assignment.classroom = nextClass._id;
    }
    assignment.title = title;
    assignment.instructions = clean(req.body.instructions ?? assignment.instructions, 10000);
    assignment.submissionType = ['text', 'link'].includes(req.body.submissionType) ? req.body.submissionType : assignment.submissionType;
    if (req.body.courseId !== undefined) {
      const courseId = clean(req.body.courseId, 100);
      if (courseId && !career.getCourse(courseId)) return res.status(400).json({ error: 'Khóa học mục tiêu không hợp lệ.' });
      assignment.courseId = courseId;
    }
    if (req.body.lessonId !== undefined) assignment.lessonId = clean(req.body.lessonId, 140);
    if (req.body.maxScore !== undefined) {
      const score = Number(req.body.maxScore);
      if (!Number.isFinite(score) || score < 1 || score > 1000) return res.status(400).json({ error: 'Điểm tối đa phải từ 1 đến 1000.' });
      assignment.maxScore = score;
    }
    if (req.body.dueAt !== undefined) {
      const date = req.body.dueAt ? new Date(req.body.dueAt) : null;
      if (date && Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Hạn nộp không hợp lệ.' });
      assignment.dueAt = date;
    }
    if (['draft', 'published', 'closed'].includes(req.body.status)) assignment.status = req.body.status;
    await assignment.save();
    await recordActivity(req, { action: 'teacher.assignment.update', targetType: 'assignment', targetId: String(assignment._id), targetName: assignment.title, description: 'Giáo viên cập nhật bài tập.' });
    res.json({ message: 'Đã cập nhật bài tập.' });
  } catch (error) { next(error); }
});

router.delete('/assignments/:id', async (req, res, next) => {
  try {
    const assignment = await ownedAssignment(req, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập.' });
    await Promise.all([AssignmentSubmission.deleteMany({ assignment: assignment._id }), assignment.deleteOne()]);
    await recordActivity(req, { action: 'teacher.assignment.delete', targetType: 'assignment', targetId: String(assignment._id), targetName: assignment.title, description: 'Giáo viên xóa bài tập và các bài nộp liên quan.' });
    res.json({ message: 'Đã xóa bài tập và bài nộp liên quan.' });
  } catch (error) { next(error); }
});

router.get('/assignments/:id/submissions', async (req, res, next) => {
  try {
    const assignment = await ownedAssignment(req, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập.' });
    const rows = await AssignmentSubmission.find({ assignment: assignment._id }).sort({ submittedAt: -1 }).populate('student', 'fullName email').lean();
    res.json({ assignment: { id: String(assignment._id), title: assignment.title, maxScore: assignment.maxScore }, rows: rows.map((row) => ({ id: String(row._id), studentId: String(row.student?._id || row.student), studentName: row.student?.fullName || 'Tài khoản đã xóa', studentEmail: row.student?.email || '', response: row.response, attachmentUrl: row.attachmentUrl, status: row.status, score: row.score, feedback: row.feedback, isLate: row.isLate, submittedAt: row.submittedAt, gradedAt: row.gradedAt })) });
  } catch (error) { next(error); }
});

router.patch('/submissions/:id/grade', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Mã bài nộp không hợp lệ.' });
    const submission = await AssignmentSubmission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Không tìm thấy bài nộp.' });
    const assignment = await ownedAssignment(req, submission.assignment);
    if (!assignment) return res.status(403).json({ error: 'Bạn không có quyền chấm bài nộp này.' });
    const score = Number(req.body.score);
    if (!Number.isFinite(score) || score < 0 || score > assignment.maxScore) return res.status(400).json({ error: `Điểm phải từ 0 đến ${assignment.maxScore}.` });
    submission.score = score;
    submission.feedback = clean(req.body.feedback, 10000);
    submission.status = 'graded';
    submission.gradedAt = new Date();
    submission.gradedBy = teacherId(req);
    await submission.save();
    await recordActivity(req, { action: 'teacher.submission.grade', targetType: 'assignment-submission', targetId: String(submission._id), targetName: assignment.title, description: 'Giáo viên chấm điểm và gửi nhận xét.', metadata: { score, maxScore: assignment.maxScore, studentId: String(submission.student) } });
    res.json({ message: 'Đã lưu điểm và nhận xét.' });
  } catch (error) { next(error); }
});

module.exports = router;
