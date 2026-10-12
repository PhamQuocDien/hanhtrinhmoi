'use strict';
const mongoose = require('mongoose');
const classroomStudentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });
const classroomSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 3000 },
  subjectArea: { type: String, default: 'software-development', maxlength: 100 },
  courseIds: { type: [String], default: [] },
  students: { type: [classroomStudentSchema], default: [] },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  inviteCode: { type: String, required: true, unique: true, index: true }
}, { timestamps: true, versionKey: false });
classroomSchema.index({ teacher: 1, status: 1, updatedAt: -1 });
module.exports = mongoose.model('Classroom', classroomSchema);
