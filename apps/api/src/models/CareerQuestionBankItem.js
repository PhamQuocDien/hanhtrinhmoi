'use strict';
const mongoose = require('mongoose');
const careerQuestionBankItemSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true, index: true },
  courseId: { type: String, required: true, index: true },
  moduleId: { type: String, required: true, index: true },
  lessonId: { type: String, required: true, index: true },
  type: { type: String, enum: ['multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'essay', 'code_challenge', 'debugging', 'design_task'], required: true, index: true },
  prompt: { type: String, required: true, maxlength: 12000 },
  options: { type: [mongoose.Schema.Types.Mixed], default: [] },
  correctAnswer: { type: String, default: '', select: false },
  acceptedAnswers: { type: [String], default: [], select: false },
  explanation: { type: String, default: '', maxlength: 4000, select: false },
  rubric: { type: [String], default: [] },
  points: { type: Number, min: 0, max: 100, default: 1 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium', index: true },
  taxonomy: { type: String, enum: ['remember', 'understand', 'apply', 'analyze', 'create'], default: 'understand', index: true },
  topicTags: { type: [String], default: [] },
  source: { type: String, default: 'curriculum-derived-template' },
  contentStatus: { type: String, default: 'draft-teacher-review-required', index: true },
  active: { type: Boolean, default: false, index: true },
  bankVersion: { type: String, default: 'V6.1.1' },
  updatedBy: { type: String, default: '' }
}, { timestamps: true, versionKey: false });
careerQuestionBankItemSchema.index({ courseId: 1, lessonId: 1, active: 1, difficulty: 1, type: 1 });
module.exports = mongoose.model('CareerQuestionBankItem', careerQuestionBankItemSchema);
