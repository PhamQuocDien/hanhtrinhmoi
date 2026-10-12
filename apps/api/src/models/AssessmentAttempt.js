'use strict';
const mongoose = require('mongoose');

const assessmentAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  grade: { type: Number, required: true, min: 1, max: 12 },
  programCode: { type: String, enum: ['ctst', 'kntt', 'canhdieu'], required: true },
  subjectCode: { type: String, required: true },
  courseId: { type: String, required: true },
  type: { type: String, enum: ['part-checkpoint', 'lesson', 'chapter', 'midterm', 'final', 'practice'], required: true },
  scopeId: { type: String, default: '' },
  lessonId: { type: String, default: '' },
  sessionId: { type: String, default: '', index: true },
  questionIds: { type: [String], default: [] },
  questionsSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] },
  submittedAnswers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  score: { type: Number, required: true, min: 0, max: 100 },
  passed: { type: Boolean, required: true },
  gradingMode: { type: String, enum: ['objective', 'gemini-ai', 'heuristic-fallback', 'mixed'], required: true },
  answerFeedback: { type: [mongoose.Schema.Types.Mixed], default: [] },
  elapsedSeconds: { type: Number, min: 0, max: 86400, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

assessmentAttemptSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('AssessmentAttempt', assessmentAttemptSchema);
