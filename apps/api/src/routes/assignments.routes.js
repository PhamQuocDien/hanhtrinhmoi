'use strict';
const express = require('express');
const mongoose = require('mongoose');
const Classroom = require('../models/Classroom');
const TeacherAssignment = require('../models/TeacherAssignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const { requireLearner } = require('../middleware/security');
const { recordActivity } = require('../services/activity-log');
const router = express.Router();
router.use(requireLearner);

router.get('/my', async (req, res, next) => {
  try {
    const classrooms = await Classroom.find({ status: 'active', 'students.user': req.session.user.id }).select('name description teacher').lean();
    const rows = await TeacherAssignment.find({ classroom: { $in: classrooms.map((row) => row._id) }, status: 'published' }).sort({ dueAt: 1, createdAt: -1 }).populate('classroom', 'name').populate('teacher', 'fullName').lean();
    const submissions = await AssignmentSubmission.find({ student: req.session.user.id, assignment: { $in: rows.map((row) => row._id) } }).lean();
    const byAssignment = new Map(submissions.map((row) => [String(row.assignment), row]));
    res.json({ rows: rows.map((row) => {
      const submission = byAssignment.get(String(row._id));
      return { id: String(row._id), title: row.title, instructions: row.instructions, submissionType: row.submissionType, courseId: row.courseId, lessonId: row.lessonId, dueAt: row.dueAt, maxScore: row.maxScore, className: row.classroom?.name || '', teacherName: row.teacher?.fullName || '', submission: submission ? { id: String(submission._id), response: submission.response, attachmentUrl: submission.attachmentUrl, status: submission.status, score: submission.score, feedback: submission.feedback, isLate: submission.isLate, submittedAt: submission.submittedAt, gradedAt: submission.gradedAt } : null };
    }) });
  } catch (error) { next(error); }
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Mã bài tập không hợp lệ.' });
    const assignment = await TeacherAssignment.findOne({ _id: req.params.id, status: 'published' });
    if (!assignment) return res.status(404).json({ error: 'Không tìm thấy bài tập đang mở.' });
    const member = await Classroom.exists({ _id: assignment.classroom, status: 'active', 'students.user': req.session.user.id });
    if (!member) return res.status(403).json({ error: 'Bài tập không thuộc lớp bạn đang tham gia.' });
    const response = String(req.body.response ?? '').trim().slice(0, 30000);
    const attachmentUrl = String(req.body.attachmentUrl ?? '').trim().slice(0, 2000);
    if (assignment.submissionType === 'text' && response.length < 1) return res.status(400).json({ error: 'Hãy nhập nội dung bài làm.' });
    if (assignment.submissionType === 'link' && !/^https?:\/\//i.test(attachmentUrl)) return res.status(400).json({ error: 'Hãy nhập đường dẫn bắt đầu bằng http:// hoặc https://.' });
    const isLate = Boolean(assignment.dueAt && new Date() > assignment.dueAt);
    const submission = await AssignmentSubmission.findOneAndUpdate(
      { assignment: assignment._id, student: req.session.user.id },
      { $set: { classroom: assignment.classroom, response, attachmentUrl, status: 'submitted', score: null, feedback: '', submittedAt: new Date(), gradedAt: null, gradedBy: null, isLate } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await recordActivity(req, { action: 'student.assignment.submit', targetType: 'assignment-submission', targetId: String(submission._id), targetName: assignment.title, description: 'Học viên nộp hoặc cập nhật bài tập.', metadata: { assignmentId: String(assignment._id), isLate } });
    res.json({ message: isLate ? 'Đã nộp bài. Bài được đánh dấu nộp trễ.' : 'Đã lưu bài nộp.', submission: { id: String(submission._id), status: submission.status, submittedAt: submission.submittedAt, isLate } });
  } catch (error) { next(error); }
});
module.exports = router;
