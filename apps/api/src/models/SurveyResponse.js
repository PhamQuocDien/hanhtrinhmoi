'use strict';
const mongoose = require('mongoose');
const surveyResponseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  birthDate: { type: Date, required: true },
  age: { type: Number, required: true, min: 4, max: 100 },
  gender: { type: String, enum: ['female', 'male', 'other', 'prefer_not_to_say'], required: true },
  educationLevel: { type: String, required: true },
  currentSchoolGrade: { type: Number, min: 1, max: 12, default: null },
  expectedGrade: { type: Number, min: 1, max: 12, default: null },
  gradeAgeMismatch: { type: Boolean, default: false },
  programCode: { type: String, enum: ['ctst', 'kntt', 'canhdieu'], default: 'ctst' },
  goal: { type: String, required: true },
  topics: { type: [String], required: true, default: [] },
  weeklyHours: { type: String, required: true },
  learningStyle: { type: String, required: true },
  currentLevel: { type: String, required: true },
  challenges: { type: String, default: '', maxlength: 1000 },
  target: { type: String, default: '', maxlength: 300 },
  placementScore: { type: Number, min: 0, max: 100, default: null },
  recommendedGrade: { type: Number, min: 1, max: 12, default: null },
  placementCompletedAt: { type: Date, default: null },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
