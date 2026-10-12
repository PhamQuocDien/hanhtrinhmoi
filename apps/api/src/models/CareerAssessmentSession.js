'use strict';
const mongoose = require('mongoose');
const careerAssessmentSessionSchema = new mongoose.Schema({
  examId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: String, required: true, index: true },
  moduleId: { type: String, default: '', index: true },
  lessonId: { type: String, default: '', index: true },
  scopeType: { type: String, enum: ['lesson', 'module', 'course', 'final', 'practice'], default: 'practice', index: true },
  title: { type: String, required: true, maxlength: 240 },
  questionIds: { type: [String], default: [] },
  questionMix: { type: mongoose.Schema.Types.Mixed, default: {} },
  questionsSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] },
  submittedAnswers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  answerFeedback: { type: [mongoose.Schema.Types.Mixed], default: [] },
  score: { type: Number, min: 0, max: 100, default: null },
  autoGradedScore: { type: Number, min: 0, max: 100, default: null },
  autoEarnedPoints: { type: Number, min: 0, default: 0 },
  autoPossiblePoints: { type: Number, min: 0, default: 0 },
  manualEarnedPoints: { type: Number, min: 0, default: 0 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  passed: { type: Boolean, default: false },
  manualReviewPending: { type: Number, default: 0 },
  status: { type: String, enum: ['in_progress', 'submitted', 'needs_review'], default: 'in_progress', index: true },
  passScore: { type: Number, min: 0, max: 100, default: 70 },
  elapsedSeconds: { type: Number, min: 0, max: 86400, default: 0 },
  submittedAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });
careerAssessmentSessionSchema.index({ user: 1, courseId: 1, lessonId: 1, createdAt: -1 });
module.exports = mongoose.model('CareerAssessmentSession', careerAssessmentSessionSchema);
