'use strict';
const mongoose = require('mongoose');
const contentEntrySchema = new mongoose.Schema({
  contentType: { type: String, enum: ['course', 'lesson', 'assessment', 'import'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  programCode: { type: String, enum: ['ctst', 'kntt', 'canhdieu'], default: 'ctst', index: true },
  grade: { type: Number, min: 1, max: 12, required: true, index: true },
  subjectCode: { type: String, required: true, trim: true, maxlength: 80, index: true },
  courseId: { type: String, default: '', maxlength: 180, index: true },
  unitId: { type: String, default: '', maxlength: 180 },
  lessonId: { type: String, default: '', maxlength: 180, index: true },
  assessmentType: { type: String, enum: ['lesson', 'chapter', 'midterm', 'final', 'practice', ''], default: '' },
  objective: { type: String, default: '', maxlength: 5000 },
  theory: { type: String, default: '', maxlength: 50000 },
  lecture: { type: String, default: '', maxlength: 50000 },
  practice: { type: String, default: '', maxlength: 50000 },
  body: { type: String, default: '', maxlength: 100000 },
  videoUrl: { type: String, default: '', maxlength: 2000 },
  videoTitle: { type: String, default: '', maxlength: 240 },
  extractedText: { type: String, default: '', maxlength: 200000 },
  extractedQuestions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  sourceFileName: { type: String, default: '', maxlength: 240 },
  detectedType: { type: String, default: '', maxlength: 80 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' }
}, { timestamps: true, versionKey: false });
contentEntrySchema.index({ contentType: 1, programCode: 1, grade: 1, subjectCode: 1, lessonId: 1, status: 1 });
module.exports = mongoose.model('ContentEntry', contentEntrySchema);
