'use strict';

function normalizeQuestUser(user) {
    user.quests = Array.isArray(user?.quests) ? user.quests : [];
    user.history = Array.isArray(user?.history) ? user.history : [];
    user.score = Math.max(0, Number(user?.score) || 0);
    return user;
}

function applyExpiredQuestPenalties(user, nowValue = Date.now()) {
    normalizeQuestUser(user);
    const now = Number(nowValue) || Date.now();
    const expired = [];
    for (let index = user.quests.length - 1; index >= 0; index -= 1) {
        const quest = user.quests[index] || {};
        const timeLimit = Number(quest.timeLimit) || 0;
        const startTime = new Date(quest.startTime || 0).getTime();
        if (!(timeLimit > 0) || !Number.isFinite(startTime) || startTime <= 0) continue;
        const deadline = startTime + timeLimit * 1000;
        if (now <= deadline) continue;
        const penalty = Math.max(0, Number.parseInt(quest.penalty || 0, 10) || 0);
        user.score = Math.max(0, user.score - penalty);
        user.history.push({
            activity: `⏰ Hệ thống tự động phạt NV ${String(quest.taskType || 'không tên')}: Hết thời gian (-${penalty}đ)`,
            referenceId: `QUEST_EXPIRED:${String(quest.id || quest._id || index)}:${deadline}`,
            timestamp: new Date(now)
        });
        expired.push({ quest, penalty, deadline });
        user.quests.splice(index, 1);
    }
    if (user.history.length > 200) user.history = user.history.slice(-200);
    return { changed: expired.length > 0, expired };
}

function createQuestExpiryJob({ User, io, onlineUsers = {}, logger = console, limit = 250 }) {
    if (!User || typeof User.find !== 'function') throw new TypeError('Quest job cần model User hợp lệ.');
    let running = false;
    return async function runQuestExpiryJob(nowValue = Date.now()) {
        if (running) return { skipped: true, reason: 'overlap' };
        running = true;
        const summary = { scanned: 0, changed: 0, expired: 0, failedUsers: 0 };
        try {
            const users = await User.find({
                quests: { $elemMatch: { timeLimit: { $gt: 0 }, startTime: { $exists: true, $ne: null } } }
            }).select('username score quests history').limit(limit);
            summary.scanned = users.length;
            for (const user of users) {
                try {
                    const result = applyExpiredQuestPenalties(user, nowValue);
                    if (!result.changed) continue;
                    summary.changed += 1;
                    summary.expired += result.expired.length;
                    if (typeof user.markModified === 'function') {
                        user.markModified('quests');
                        user.markModified('history');
                    }
                    await user.save();
                    const socketId = onlineUsers[user.username];
                    if (socketId && io?.to) {
                        io.to(socketId).emit('adminNotification', {
                            title: '⚠️ NHIỆM VỤ THẤT BẠI',
                            message: result.expired.length > 1
                                ? `${result.expired.length} nhiệm vụ đã hết thời gian và được xử lý.`
                                : 'Nhiệm vụ đã hết thời gian và bị trừ điểm.'
                        });
                    }
                } catch (userError) {
                    summary.failedUsers += 1;
                    logger.error?.(`❌ Không thể xử lý nhiệm vụ quá hạn của ${user?.username || 'tài khoản không rõ'}:`, userError);
                }
            }
            return summary;
        } catch (error) {
            logger.error?.('❌ Lỗi quét nhiệm vụ quá hạn:', error);
            return { ...summary, error: error.message };
        } finally {
            running = false;
        }
    };
}

function scheduleQuestExpiryJob(runJob, intervalMs = 60_000) {
    const timer = setInterval(() => {
        Promise.resolve(runJob()).catch(error => console.error('❌ Lỗi ngoài dự kiến của lịch quét nhiệm vụ:', error));
    }, Math.max(10_000, Number(intervalMs) || 60_000));
    timer.unref?.();
    return timer;
}

module.exports = { normalizeQuestUser, applyExpiredQuestPenalties, createQuestExpiryJob, scheduleQuestExpiryJob };
