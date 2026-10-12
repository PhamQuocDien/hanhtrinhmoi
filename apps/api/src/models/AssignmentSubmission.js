'use strict';
const mongoose = require('mongoose');
const submissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment', required: true, index: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  response: { type: String, default: '', maxlength: 30000 },
  attachmentUrl: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['submitted', 'graded'], default: 'submitted', index: true },
  score: { type: Number, min: 0, default: null },
  feedback: { type: String, default: '', maxlength: 10000 },
  submittedAt: { type: Date, default: Date.now },
  gradedAt: { type: Date, default: null },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isLate: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ classroom: 1, status: 1, submittedAt: -1 });
module.exports = mongoose.model('AssignmentSubmission', submissionSchema);
