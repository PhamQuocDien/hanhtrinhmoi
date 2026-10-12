'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'university_student', 'teacher'], required: true, index: true },
  school: { type: String, default: '', maxlength: 120 },
  grade: { type: String, default: '', maxlength: 30 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' }
}, { timestamps: true, versionKey: false });

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
