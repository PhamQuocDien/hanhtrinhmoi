'use strict';

/**
 * Mô hình người dùng.
 *
 * Quy ước bảo mật:
 *  - `passwordHash` KHÔNG BAO GIỜ được chọn ra trong response. Các truy vấn
 *    đọc thông tin người dùng phải dùng `.select('-passwordHash')`.
 *  - `role` do máy chủ quyết định. Đăng ký tự do luôn tạo role `student`.
 */

const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const ROLE_VALUES = Object.values(ROLES);

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 24
    },
    // Tên trường mới; dữ liệu cũ dùng `password`. Không tự động đọc lại dữ liệu
    // cũ trong migration, nhưng vẫn nhận alias để không phá dữ liệu đang có.
    passwordHash: {
        type: String,
        required: true,
        select: false
    },
    password: {
        type: String,
        select: false
    },
    role: {
        type: String,
        required: true,
        enum: ROLE_VALUES,
        default: ROLES.STUDENT,
        index: true
    },

    // ---- Hồ sơ học tập ----
    // Lớp đang học (1-12). Chỉ có ý nghĩa với học sinh.
    grade: {
        type: Number,
        min: 1,
        max: 12,
        default: null
    },
    // Bộ sách giáo khoa học sinh đang sử dụng.
    bookSeriesId: {
        type: String,
        default: 'national'
    },
    fullName: {
        type: String,
        trim: true,
        maxlength: 120,
        default: ''
    },
    schoolName: {
        type: String,
        trim: true,
        maxlength: 160,
        default: ''
    },

    // ---- Trạng thái tài khoản ----
    isSuspended: { type: Boolean, default: false },
    suspendedReason: { type: String, maxlength: 300, default: '' },
    lastLoginAt: { type: Date, default: null },
    loginStreak: { type: Number, default: 0 },

    // ---- Phụ huynh (giữ tương thích với hệ thống cũ) ----
    parentCode: { type: String, default: null, index: true },
    children: { type: [String], default: [] }
}, {
    timestamps: true,
    collection: 'users'
});

userSchema.index({ role: 1, grade: 1 });

/**
 * Lấy mật khẩu đã băm, tương thích với dữ liệu cũ dùng trường `password`.
 * Hàm này chỉ được gọi trong quá trình xác thực, tuyệt đối không trả ra API.
 */
userSchema.methods.getPasswordHash = function getPasswordHash() {
    return this.passwordHash || this.password;
};

/** Dữ liệu công khai an toàn để trả về client. */
userSchema.methods.toPublicJSON = function toPublicJSON() {
    return {
        username: this.username,
        role: this.role,
        fullName: this.fullName,
        grade: this.grade,
        bookSeriesId: this.bookSeriesId,
        schoolName: this.schoolName,
        loginStreak: this.loginStreak,
        lastLoginAt: this.lastLoginAt,
        children: this.children
    };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
module.exports.ROLE_VALUES = ROLE_VALUES;