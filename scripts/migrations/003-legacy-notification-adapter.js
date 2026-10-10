'use strict';

/** Idempotent adapter for the legacy Notification collection. */
const models = require('../../server/models/platform-models.js');

async function up({ connection = require('mongoose').connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before running a migration.');
    const legacy = connection.db.collection('notifications');
    const before = await legacy.countDocuments();
    let inserted = 0;
    const cursor = legacy.find({}, { projection: { title: 1, content: 1, type: 1, targetUsername: 1, date: 1 } });
    for await (const notification of cursor) {
        const recipient = notification.targetUsername ? String(notification.targetUsername) : 'BROADCAST';
        const title = String(notification.title || 'Thông báo').slice(0, 200);
        const message = String(notification.content || '').slice(0, 3000);
        const createdAt = notification.date ? new Date(notification.date) : null;
        const exists = await models.PlatformNotification.exists({ recipient, title, message, ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt } : {}) });
        if (exists) continue;
        await models.PlatformNotification.create({ recipient, type: String(notification.type || 'info').slice(0, 40), title, message, priority: 'NORMAL', data: { adapter: 'legacy-notifications', legacyId: String(notification._id) }, read: false, readBy: [] });
        inserted += 1;
    }
    const result = { migration: '003-legacy-notification-adapter', legacyNotifications: before, platformNotificationsInserted: inserted };
    logger.log(JSON.stringify(result));
    return result;
}

module.exports = { id: '003-legacy-notification-adapter', up };