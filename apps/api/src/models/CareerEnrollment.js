'use strict';
const mongoose = require('mongoose');
const careerEnrollmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseId: { type: String, required: true, maxlength: 100 },
  completedLessonIds: { type: [String], default: [] },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress', index: true },
  enrolledAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });
careerEnrollmentSchema.index({ user: 1, courseId: 1 }, { unique: true });
module.exports = mongoose.model('CareerEnrollment', careerEnrollmentSchema);
