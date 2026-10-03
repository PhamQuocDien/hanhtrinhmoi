'use strict';

/**
 * Nhật ký thao tác quản trị.
 *
 * Ghi lại mọi thay đổi quan trọng để truy vết được "ai sửa cái gì, lúc nào".
 * Không ghi mật khẩu hay đáp án đúng vào nhật ký.
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    // Đơn vị nhật ký.
    actor: { type: String, required: true, index: true },
    actorRole: { type: String, required: true },

    action: {
        type: String,
        required: true,
        enum: [
            'auth.login',
            'auth.register',
            'auth.logout',
            'user.create',
            'user.update',
            'user.delete',
            'user.suspend',
            'user.unsuspend',
            'curriculum.update',
            'question.create',
            'question.update',
            'question.delete',
            'exam.create',
            'exam.update',
            'exam.publish',
            'exam.archive',
            'exam.import',
            'exam.grade'
        ],
        index: true
    },

    // Loại đối tượng bị tác động và khoá của nó.
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '', index: true },

    // Mô tả ngắn + dữ liệu thay đổi đã lọc bỏ trường nhạy cảm.
    summary: { type: String, default: '', maxlength: 500 },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },

    ip: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 300 },
    requestId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, index: true }
}, {
    // Nhật ký chỉ ghi thêm, không sửa/xoá.
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs'
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

/** Các trường không bao giờ được ghi vào nhật ký. */
const REDACTED_FIELDS = ['password', 'passwordHash', 'correctAnswer', 'value'];

/** Lọc bỏ trường nhạy cảm khỏi dữ liệu thay đổi trước khi ghi. */
function redactChanges(changes) {
    if (!changes || typeof changes !== 'object') return {};
    const output = {};
    for (const [key, value] of Object.entries(changes)) {
        if (REDACTED_FIELDS.includes(key)) continue;
        output[key] = value;
    }
    return output;
}

/**
 * Ghi một mục nhật ký. Không bao giờ làm request lỗi vì nhật ký.
 */
auditLogSchema.statics.record = async function record(entry) {
    try {
        return await this.create({
            ...entry,
            changes: redactChanges(entry.changes),
            createdAt: new Date()
        });
    } catch {
        // Nhật ký thất bại không được làm hỏng nghiệp vụ chính.
        return null;
    }
};

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
module.exports.REDACTED_FIELDS = REDACTED_FIELDS;