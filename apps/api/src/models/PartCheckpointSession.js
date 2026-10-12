"use strict";
const mongoose = require('mongoose');
const partCheckpointSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  grade: { type: Number, required: true, min: 1, max: 12 },
  programCode: { type: String, enum: ['ctst', 'kntt', 'canhdieu'], required: true },
  subjectCode: { type: String, required: true },
  courseId: { type: String, required: true },
  lessonId: { type: String, required: true, index: true },
  partId: { type: String, required: true },
  questionIds: { type: [String], required: true },
  questionsSnapshot: { type: [mongoose.Schema.Types.Mixed], required: true },
  draftAnswers: { type: [new mongoose.Schema({ questionId: { type: String, required: true }, answer: { type: String, default: '', maxlength: 5000 } }, { _id: false })], default: [] },
  status: { type: String, enum: ['in_progress', 'passed', 'failed', 'abandoned'], default: 'in_progress', index: true },
  score: { type: Number, min: 0, max: 100, default: null },
  createdAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null }
}, { versionKey: false });
partCheckpointSessionSchema.index({ user: 1, lessonId: 1, partId: 1, status: 1 });
partCheckpointSessionSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('PartCheckpointSession', partCheckpointSessionSchema);
