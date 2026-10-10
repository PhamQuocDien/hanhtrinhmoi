'use strict';

function notificationKey({ username, type, referenceId }) {
    return `${String(username || '').slice(0, 80)}:${String(type || '').slice(0, 80)}:${String(referenceId || '').slice(0, 160)}`;
}

async function notifyOnce(PlatformNotification, { recipient, type = 'info', title, message, priority = 'NORMAL', data = {}, referenceId = '' } = {}) {
    if (!PlatformNotification || !recipient || !title || !message) return null;
    const key = notificationKey({ username: recipient, type, referenceId });
    const existing = await PlatformNotification.findOne({ recipient, 'data.idempotencyKey': key }).lean();
    if (existing) return existing;
    return PlatformNotification.create({ recipient, type, title: String(title).slice(0, 200), message: String(message).slice(0, 3000), priority, data: { ...data, idempotencyKey: key }, read: false });
}

module.exports = { notificationKey, notifyOnce };