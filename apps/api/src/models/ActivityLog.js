'use strict';
const mongoose = require('mongoose');
const activityLogSchema = new mongoose.Schema({
  actorId: { type: String, default: '' },
  actorRole: { type: String, default: 'anonymous', index: true },
  actorName: { type: String, default: '', maxlength: 100 },
  action: { type: String, required: true, index: true, maxlength: 80 },
  targetType: { type: String, default: '', maxlength: 60 },
  targetId: { type: String, default: '', index: true, maxlength: 160 },
  targetName: { type: String, default: '', maxlength: 180 },
  description: { type: String, default: '', maxlength: 500 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  success: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now, index: true }
}, { versionKey: false });
activityLogSchema.index({ createdAt: -1, actorRole: 1 });
module.exports = mongoose.model('ActivityLog', activityLogSchema);
