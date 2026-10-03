'use strict';

/**
 * Tiến độ học tập của học sinh theo (môn, bài).
 *
 * Mỗi bài học có một bản ghi; tổng hợp theo môn được tính lại từ các bản ghi
 * con thay vì lưu sẵn (tránh hai nguồn sự thật cho cùng một con số).
 */

const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    subjectId: { type: String, required: true },
    lessonId: { type: String, required: true },

    // ---- Đã học ----
    completed: { type: Boolean, default: false, index: true },
    completedAt: { type: Date, default: null },
    // Số phút học tự ghi nhận từ phía client; không dùng để tính điểm.
    minutesSpent: { type: Number, default: 0, min: 0 },

    // ---- Kết quả kiểm tra ----
    practiceAttempts: { type: Number, default: 0, min: 0 },
    bestScore: { type: Number, default: 0, min: 0, max: 100 },
    lastScore: { type: Number, default: 0, min: 0, max: 100 },

    lastStudiedAt: { type: Date, default: null, index: true }
}, { timestamps: true, collection: 'learning_progress' });

// Một học sinh chỉ có một bản ghi cho mỗi bài học.
progressSchema.index({ username: 1, lessonId: 1 }, { unique: true });
progressSchema.index({ username: 1, grade: 1, subjectId: 1 });

/** Tỉ lệ hoàn thành của một môn (0-100). */
progressSchema.statics.subjectCompletion = async function subjectCompletion(username, grade, subjectId) {
    const rows = await this.find({ username, grade, subjectId }).select('completed').lean();
    if (!rows.length) return { completed: 0, total: 0, percent: 0 };
    const completed = rows.filter(row => row.completed).length;
    return { completed, total: rows.length, percent: Math.round((completed / rows.length) * 100) };
};

module.exports = mongoose.models.LearningProgress || mongoose.model('LearningProgress', progressSchema);