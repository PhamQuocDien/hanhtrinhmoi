'use strict';
const mongoose = require('mongoose');
const assignmentSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  instructions: { type: String, default: '', maxlength: 10000 },
  submissionType: { type: String, enum: ['text', 'link'], default: 'text' },
  courseId: { type: String, default: '', maxlength: 100 },
  lessonId: { type: String, default: '', maxlength: 140 },
  dueAt: { type: Date, default: null },
  maxScore: { type: Number, min: 1, max: 1000, default: 100 },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'published', index: true }
}, { timestamps: true, versionKey: false });
assignmentSchema.index({ classroom: 1, status: 1, dueAt: 1 });
module.exports = mongoose.model('TeacherAssignment', assignmentSchema);
