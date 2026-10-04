'use strict';

/**
 * Xác thực tài khoản.
 *
 * Bảo mật:
 *  - Mật khẩu luôn được băm bằng bcrypt, không bao giờ lưu rõ.
 *  - So khớp tên đăng nhập không phân biệt hoa/thường nhưng vẫn escape ký tự
 *    đặc biệt, tránh bị chèn biểu thức chính quy.
 *  - Đăng ký tự do KHÔNG thể chọn role; role luôn là học sinh.
 *  - Tài khoản admin được tạo từ biến môi trường, không qua form đăng ký.
 *  - Khi đăng nhập, phiên cũ bị regenerate để chống chiếm phiên.
 */

const User = require('../models/user.model');
const AuditLog = require('../models/audit-log.model');
const { hashPassword, verifyPassword, equalsIgnoreCase } = require('../utils/hash');
const { ROLES } = require('../config/constants');
const env = require('../config/env');
const logger = require('../utils/logger');
const { getDefaultSeriesId } = require('../../data/textbooks/book-series-registry');

/** Ngày theo định dạng YYYY-MM-DD tại giờ Việt Nam. */
function vietnamDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

/** Ngày liền trước (để tính chuỗi đăng nhập liên tục). */
function isPreviousDate(previousKey, currentKey) {
    if (!previousKey) return false;
    const previous = new Date(`${previousKey}T00:00:00+07:00`);
    const current = new Date(`${currentKey}T00:00:00+07:00`);
    return current - previous === 24 * 60 * 60 * 1000;
}

/** Escape ký tự đặc biệt trước khi dựng RegExp. */
function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Đăng ký tài khoản học sinh.
 * Role KHÔNG lấy từ dữ liệu gửi lên.
 */
async function register({ username, password, grade }) {
    if (env.RESERVED_USERNAMES.some(name => equalsIgnoreCase(name, username))) {
        return { error: 'RESERVED', message: 'Tên đăng nhập này được dành riêng cho hệ thống.' };
    }

    const existing = await User.findOne({
        username: { $regex: new RegExp(`^${escapeRegExp(username)}$`, 'i') }
    }).select('username');
    if (existing) return { error: 'DUPLICATE', message: 'Tên đăng nhập đã tồn tại.' };

    const passwordHash = await hashPassword(password);
    const user = await User.create({
        username,
        passwordHash,
        // role cố định, không nhận từ client.
        role: ROLES.STUDENT,
        grade: Number(grade),
        bookSeriesId: getDefaultSeriesId(grade)
    });

    return { user: { username: user.username, role: user.role, grade: user.grade } };
}

/**
 * Đăng nhập.
 * Trả về thông tin công khai, KHÔNG bao giờ trả hash mật khẩu.
 */
async function login({ username, password }) {
    await syncAdminFromEnvironment();

    const user = await User.findOne({
        username: { $regex: new RegExp(`^${escapeRegExp(username)}$`, 'i') }
    }).select('+passwordHash +password');

    // Thông điệp chung cho cả "sai tên" lẫn "sai mật khẩu" để không lộ tài khoản.
    if (!user) return { error: 'INVALID_CREDENTIALS', message: 'Sai tên đăng nhập hoặc mật khẩu.' };
    if (!(await verifyPassword(password, user.getPasswordHash()))) {
        return { error: 'INVALID_CREDENTIALS', message: 'Sai tên đăng nhập hoặc mật khẩu.' };
    }
    if (user.isSuspended) {
        const reason = user.suspendedReason ? `: ${user.suspendedReason}` : '.';
        return { error: 'SUSPENDED', message: `Tài khoản đã bị khoá${reason}` };
    }

    const today = vietnamDateKey();
    if (user.lastLoginDate !== today) {
        user.loginStreak = isPreviousDate(user.lastLoginDate, today)
            ? Math.max(1, user.loginStreak || 0) + 1
            : 1;
        user.lastLoginDate = today;
    }
    user.lastLoginAt = new Date();
    await user.save();

    return { user: user.toPublicJSON(), document: user };
}

/** Ghi thông tin phiên sau khi đăng nhập thành công. */
function toSessionUser(user) {
    return { username: user.username, role: user.role };
}

/**
 * Tạo/cập nhật tài khoản admin từ biến môi trường.
 * Không tạo admin nếu chưa cấu hình ADMIN_PASSWORD, để không có tài khoản
 * quản trị với mật khẩu mặc định yếu.
 */
async function syncAdminFromEnvironment() {
    const adminUsername = String(process.env.ADMIN_USERNAME || 'admin');
    const adminPassword = String(process.env.ADMIN_PASSWORD || '');
    if (adminPassword.length < 8) return null;

    const existing = await User.findOne({
        username: { $regex: new RegExp(`^${escapeRegExp(adminUsername)}$`, 'i') }
    });
    const passwordHash = await hashPassword(adminPassword);

    if (!existing) {
        return User.create({
            username: adminUsername,
            passwordHash,
            role: ROLES.ADMIN,
            fullName: 'Quản trị viên'
        });
    }

    // Đồng bộ lại hash nếu mật khẩu môi trường khác hoặc tài khoản chưa phải admin.
    if (existing.role !== ROLES.ADMIN || !(await verifyPassword(adminPassword, existing.getPasswordHash()))) {
        existing.passwordHash = passwordHash;
        existing.role = ROLES.ADMIN;
        await existing.save();
        logger.info(`Đã đồng bộ tài khoản quản trị "${adminUsername}" từ cấu hình môi trường.`);
    }
    return existing;
}

/** Đăng xuất: xoá phiên và cookie. */
function logout(req, res) {
    return new Promise((resolve, reject) => {
        if (!req.session) return resolve();
        return req.session.destroy(error => {
            res.clearCookie('hanhtrinh.sid');
            if (error) return reject(error);
            return resolve();
        });
    });
}

/**
 * Regenerate phiên sau đăng nhập để chống chiếm phiên (session fixation).
 */
function regenerateSession(req, user) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(error => {
            if (error) return reject(error);
            req.session.user = user;
            return req.session.save(saveError => (saveError ? reject(saveError) : resolve()));
        });
    });
}

/** Ghi nhật ký đăng nhập/đăng ký. */
function logAuthAction(action, username, role, req) {
    return AuditLog.record({
        actor: username,
        actorRole: role,
        action,
        entityType: 'user',
        entityId: username,
        summary: `${action} — ${username}`,
        ip: req?.ip || '',
        userAgent: String(req?.get?.('user-agent') || '').slice(0, 300),
        requestId: req?.res?.locals?.requestId || ''
    });
}

module.exports = {
    escapeRegExp,
    isPreviousDate,
    logAuthAction,
    login,
    logout,
    regenerateSession,
    register,
    syncAdminFromEnvironment,
    toSessionUser,
    vietnamDateKey
};