'use strict';
const mongoose = require('mongoose');
const assessmentSessionSchema = new mongoose.Schema({
  examId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  grade: { type: Number, required: true, min: 1, max: 12 },
  programCode: { type: String, enum: ['ctst', 'kntt', 'canhdieu'], required: true },
  subjectCode: { type: String, required: true },
  courseId: { type: String, required: true },
  type: { type: String, enum: ['lesson', 'chapter', 'midterm', 'final', 'practice'], required: true },
  scopeId: { type: String, default: '' },
  lessonId: { type: String, default: '' },
  title: { type: String, required: true },
  questionIds: { type: [String], required: true },
  questionsSnapshot: { type: [mongoose.Schema.Types.Mixed], required: true },
  draftAnswers: { type: [new mongoose.Schema({ questionId: { type: String, required: true }, answer: { type: String, default: '', maxlength: 5000 } }, { _id: false })], default: [] },
  status: { type: String, enum: ['in_progress', 'submitted', 'abandoned'], default: 'in_progress', index: true },
  passScore: { type: Number, min: 0, max: 100, default: 70 },
  createdAt: { type: Date, default: Date.now, index: true },
  submittedAt: { type: Date, default: null }
}, { versionKey: false });
assessmentSessionSchema.index({ user: 1, createdAt: -1 });
assessmentSessionSchema.index({ user: 1, grade: 1, programCode: 1, subjectCode: 1, type: 1, scopeId: 1, status: 1 });
module.exports = mongoose.model('AssessmentSession', assessmentSessionSchema);
