'use strict';
const mongoose = require('mongoose');

const partProgressSchema = new mongoose.Schema({
  lessonId: { type: String, required: true },
  partId: { type: String, required: true },
  bestScore: { type: Number, min: 0, max: 100, default: 0 },
  passed: { type: Boolean, default: false },
  attempts: { type: Number, min: 0, default: 0 },
  completedAt: { type: Date, default: null }
}, { _id: false });

const viewedPartSchema = new mongoose.Schema({
  lessonId: { type: String, required: true },
  partId: { type: String, required: true },
  views: { type: Number, min: 1, default: 1 },
  lastViewedAt: { type: Date, default: Date.now }
}, { _id: false });

const lessonProgressSchema = new mongoose.Schema({
  lessonId: { type: String, required: true },
  bestScore: { type: Number, min: 0, max: 100, default: 0 },
  lastScore: { type: Number, min: 0, max: 100, default: 0 },
  passed: { type: Boolean, default: false },
  attempts: { type: Number, min: 0, default: 0 },
  completedAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null }
}, { _id: false });

const learningProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: String, required: true },
  grade: { type: Number, required: true, min: 1, max: 12 },
  programCode: { type: String, enum: ['ctst', 'kntt', 'canhdieu'], required: true },
  subjectCode: { type: String, required: true },
  completedParts: { type: [partProgressSchema], default: [] },
  viewedParts: { type: [viewedPartSchema], default: [] },
  lessons: { type: [lessonProgressSchema], default: [] },
  lastLessonId: { type: String, default: '' },
  currentLessonId: { type: String, default: '' },
  currentPartId: { type: String, default: '' },
  lastPositionAt: { type: Date, default: null },
  lastActivityAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

learningProgressSchema.index({ user: 1, courseId: 1 }, { unique: true });
module.exports = mongoose.model('LearningProgress', learningProgressSchema);
