'use strict';
const mongoose = require('mongoose');
const placementAssessmentSchema = new mongoose.Schema({
  placementId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  grade: { type: Number, required: true, min: 1, max: 12 },
  ageAtStart: { type: Number, required: true, min: 4, max: 100 },
  programCode: { type: String, enum: ['ctst', 'kntt', 'canhdieu'], required: true },
  subjects: { type: [String], default: [] },
  topics: { type: [String], default: [] },
  questionIds: { type: [String], default: [] },
  questionsSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] },
  submittedAnswers: { type: [mongoose.Schema.Types.Mixed], default: [] },
  score: { type: Number, min: 0, max: 100, default: null },
  suggestedGrade: { type: Number, min: 1, max: 12, default: null },
  status: { type: String, enum: ['in_progress', 'submitted', 'expired'], default: 'in_progress', index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  submittedAt: { type: Date, default: null }
}, { versionKey: false });
placementAssessmentSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('PlacementAssessment', placementAssessmentSchema);
