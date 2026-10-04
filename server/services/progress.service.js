'use strict';

/**
 * Theo dõi tiến độ học tập của học sinh.
 *
 * Tiến độ được TÍNH LẠI từ các bản ghi bài học thay vì lưu sẵn tổng, để không
 * bao giờ có hai con số mâu thuẫn cho cùng một thứ.
 */

const Progress = require('../models/progress.model');
const Attempt = require('../models/attempt.model');
const curriculumService = require('./curriculum.service');
const milestoneService = require('./milestone.service');
const { getSubject } = require('../../data/subjects/subject-registry');

/**
 * Ghi nhận học sinh đã đọc xong một bài.
 *
 * KHÔNG đánh dấu `completed` ở đây: mở/đọc bài không đủ để coi là hoàn thành.
 * Việc đánh dấu do `milestoneService.evaluateLessonCompletion()` quyết định sau
 * khi học sinh làm mini test đạt — máy chủ là nguồn quyết định.
 *
 * @returns {Promise<object|null>} bản ghi tiến độ
 */
async function markLessonRead(username, { grade, subjectId, lessonId, minutesSpent = 0 }) {
    if (!lessonId) return null;
    return Progress.findOneAndUpdate(
        { username, lessonId },
        {
            $set: {
                grade: Number(grade),
                subjectId,
                readingDone: true,
                lastStudiedAt: new Date()
            },
            $inc: { minutesSpent: Math.max(0, Number(minutesSpent) || 0) }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

/**
 * Đánh dấu bài học hoàn thành nếu thoả điều kiện policy.
 *
 * Hàm này là IDEMPOTENT: gọi lại nhiều lần không làm tăng tiến độ hai lần.
 *
 * @param {string} username học sinh
 * @param {object} params lớp, môn, bài
 * @returns {Promise<object>} kết luận kèm lý do nếu chưa đạt
 */
async function evaluateAndMarkCompleted(username, { grade, subjectId, lessonId }) {
    const progress = await Progress.findOne({ username, lessonId }).lean();
    if (!progress) {
        return { completed: false, reasons: ['Chưa có dữ liệu tiến độ cho bài học này.'] };
    }

    const verdict = milestoneService.evaluateLessonCompletion({
        grade,
        subjectId,
        readingDone: Boolean(progress.readingDone),
        miniTestAttempted: (progress.miniTestAttempts || 0) > 0,
        miniTestBestPercent: progress.miniTestBestPercent ?? progress.bestScore ?? 0
    });

    if (verdict.completed && !progress.completed) {
        await Progress.updateOne(
            { username, lessonId },
            { $set: { completed: true, completedAt: new Date() } }
        );
        return { ...verdict, completed: true, justCompleted: true };
    }

    return { ...verdict, justCompleted: false };
}

/**
 * Tập bài học đã đạt yêu cầu hoàn thành.
 *
 * Dùng để tính coverage cho checkpoint / giữa kỳ / cuối kỳ.
 *
 * @param {string} username học sinh
 * @param {number} grade lớp
 * @param {string} subjectId môn
 * @returns {Promise<Set<string>>}
 */
async function getCompletedLessonIds(username, grade, subjectId) {
    const rows = await Progress.find({ username, grade: Number(grade), subjectId, completed: true })
        .select('lessonId')
        .lean();
    return new Set(rows.map(row => row.lessonId));
}

/** Ghi nhận học sinh đang học (chưa đánh dấu hoàn thành). */
async function touchLesson(username, { grade, subjectId, lessonId, minutesSpent = 0 }) {
    if (!lessonId) return null;
    return Progress.findOneAndUpdate(
        { username, lessonId },
        {
            $set: { grade: Number(grade), subjectId, lastStudiedAt: new Date() },
            $inc: { minutesSpent: Math.max(0, Number(minutesSpent) || 0) }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

/**
 * Ghi nhận kết quả một lần luyện tập/kiểm tra vào tiến độ của bài học.
 * `bestScore` chỉ tăng, `lastScore` luôn bằng lần mới nhất.
 */
async function recordAttemptResult(username, { grade, subjectId, lessonId, scorePercent }) {
    if (!lessonId) return null;
    const score = Math.max(0, Math.min(100, Number(scorePercent) || 0));

    return Progress.findOneAndUpdate(
        { username, lessonId },
        {
            $set: {
                grade: Number(grade),
                subjectId,
                lastScore: score,
                lastStudiedAt: new Date()
            },
            $inc: { practiceAttempts: 1 },
            $max: { bestScore: score }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

/**
 * Tiến độ tổng hợp theo môn của một lớp.
 * Dùng cho thanh tiến độ trên bảng điều khiển học sinh.
 */
async function getSubjectProgress(username, grade) {
    const subjects = curriculumService.listSubjects(grade);
    if (!subjects.length) return [];

    const rows = await Progress.find({ username, grade: Number(grade) }).lean();

    return subjects.map(subject => {
        const forSubject = rows.filter(row => row.subjectId === subject.subjectId);
        const completed = forSubject.filter(row => row.completed).length;
        // Môn chưa có bài học thì không có mốc để hoàn thành.
        const total = subject.lessonCount;
        const attempts = forSubject.reduce((sum, row) => sum + (row.practiceAttempts || 0), 0);
        const bestScores = forSubject.map(row => row.bestScore || 0).filter(score => score > 0);

        return {
            subjectId: subject.subjectId,
            subjectName: subject.displayName,
            icon: subject.icon,
            status: subject.status,
            statusLabel: subject.statusLabel,
            integratedSubject: subject.integratedSubject,
            learningTracks: subject.learningTracks || null,
            completed,
            total,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0,
            practiceAttempts: attempts,
            averageBestScore: bestScores.length
                ? Math.round(bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length)
                : null,
            needsLessonImport: subject.needsLessonImport
        };
    });
}

/** Bài học gần đây để gợi ý "tiếp tục học". */
async function getRecentLessons(username, limit = 5) {
    return Progress.find({ username, lastStudiedAt: { $ne: null } })
        .sort({ lastStudiedAt: -1 })
        .limit(limit)
        .lean();
}

/** Tổng quan tiến độ cho bảng điều khiển học sinh. */
async function getSummary(username, grade) {
    const [subjects, recent, attemptStats] = await Promise.all([
        getSubjectProgress(username, grade),
        getRecentLessons(username, 5),
        Attempt.aggregate([
            { $match: { username, grade: Number(grade), submittedAt: { $ne: null } } },
            { $group: { _id: null, total: { $sum: 1 }, average: { $avg: '$scorePercent' } } }
        ])
    ]);

    const withLessons = subjects.filter(subject => subject.total > 0);
    const overallPercent = withLessons.length
        ? Math.round(withLessons.reduce((sum, subject) => sum + subject.percent, 0) / withLessons.length)
        : 0;

    const recentDecorated = recent.map(row => ({
        ...row,
        subjectName: getSubject(row.subjectId)?.displayName || row.subjectId
    }));

    return {
        grade: Number(grade),
        subjects,
        overallPercent,
        totalAttempts: attemptStats[0]?.total || 0,
        averageScorePercent: attemptStats[0]?.average
            ? Math.round(attemptStats[0].average)
            : null,
        recentLessons: recentDecorated
    };
}

module.exports = {
    evaluateAndMarkCompleted,
    getCompletedLessonIds,
    getRecentLessons,
    getSubjectProgress,
    getSummary,
    markLessonRead,
    recordAttemptResult,
    touchLesson
};