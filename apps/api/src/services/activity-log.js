'use strict';
const ActivityLog = require('../models/ActivityLog');

async function recordActivity(req, { action, targetType = '', targetId = '', targetName = '', description = '', metadata = {}, success = true } = {}) {
  try {
    const actor = req?.session?.user || {};
    await ActivityLog.create({
      actorId: String(actor.id || ''),
      actorRole: String(actor.role || 'anonymous'),
      actorName: String(actor.fullName || actor.email || ''),
      action: String(action || 'unknown').slice(0, 80),
      targetType: String(targetType || '').slice(0, 60),
      targetId: String(targetId || '').slice(0, 160),
      targetName: String(targetName || '').slice(0, 180),
      description: String(description || '').slice(0, 500),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      success: Boolean(success)
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.warn('Activity logging skipped:', error.message);
  }
}
module.exports = { recordActivity };
