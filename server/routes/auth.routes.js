'use strict';

/**
 * Route xác thực: đăng ký, đăng nhập, đăng xuất, thông tin tài khoản.
 *
 * Bảo mật:
 *   - Đăng ký KHÔNG nhận `role` từ client — tự đăng ký luôn là học sinh.
 *   - Đăng nhập regenerate phiên để chống chiếm phiên.
 *   - Thông báo lỗi chung cho "sai tên" và "sai mật khẩu" để không lộ tài khoản.
 */

const express = require('express');

const authService = require('../services/auth.service');
const User = require('../models/user.model');
const response = require('../utils/response');
const { validate } = require('../middleware/validation.middleware');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const { safeAsyncRoute } = require('../middleware/error.middleware');
const { isValidUsername, isValidPassword } = require('../utils/sanitize');

const router = express.Router();

/** Chuẩn hoá tên đăng nhập: bỏ khoảng trắng thừa, giữ nguyên chữ có dấu. */
function normalizeUsername(value) {
    return String(value || '').trim().slice(0, 24);
}

/** Đăng ký tài khoản học sinh. */
router.post('/register', validate('register'), safeAsyncRoute(async (req, res) => {
    const result = await authService.register(req.validated);
    if (result.error) {
        return response.conflict(res, result.message);
    }
    // Không tự đăng nhập: client gọi /login sau khi đăng ký để tạo phiên sạch.
    return response.ok(res, result.user, 201);
}));

/** Đăng nhập. */
router.post('/login', validate('login'), safeAsyncRoute(async (req, res) => {
    const result = await authService.login({
        username: normalizeUsername(req.validated.username),
        password: req.validated.password
    });

    if (result.error === 'INVALID_CREDENTIALS') {
        return response.fail(res, 401, 'INVALID_CREDENTIALS', result.message, {
            requestId: res.locals?.requestId
        });
    }
    if (result.error === 'SUSPENDED') {
        return response.forbidden(res, result.message);
    }

    await authService.regenerateSession(req, authService.toSessionUser(result.user));
    authService.logAuthAction('login', result.user.username, result.user.role, req);

    // `toPublicJSON` không bao giờ chứa hash mật khẩu.
    return response.ok(res, result.user.toPublicJSON());
}));

/** Đăng xuất. */
router.post('/logout', safeAsyncRoute(async (req, res) => {
    await authService.logout(req, res);
    return response.ok(res, { message: 'Đã đăng xuất.' });
}));

/** Tài khoản đang đăng nhập. */
router.get('/me', requireAuth, attachUser(User), safeAsyncRoute(async (req, res) => {
    return response.ok(res, req.user);
}));

/** Đổi mật khẩu. */
router.post('/change-password', requireAuth, safeAsyncRoute(async (req, res) => {
    const current = String(req.body.currentPassword || '');
    const next = String(req.body.newPassword || '');

    if (!isValidPassword(next)) {
        return response.badRequest(res, 'Mật khẩu mới phải dài từ 6 đến 72 ký tự.');
    }

    const user = await User.findOne({ username: req.session.user.username }).select('+passwordHash +password');
    const { verifyPassword, hashPassword } = require('../utils/hash');

    if (!(await verifyPassword(current, user.getPasswordHash()))) {
        return response.fail(res, 401, 'INVALID_CREDENTIALS', 'Mật khẩu hiện tại không đúng.', {
            requestId: res.locals?.requestId
        });
    }

    const hash = await hashPassword(next);
    user.passwordHash = hash;
    // Một số bản ghi cũ vẫn dùng trường `password` -> ghi cả hai cho nhất quán.
    user.password = hash;
    await user.save();

    return response.ok(res, { changed: true });
}));

/** Kiểm tra tên đăng nhập đã có chưa (dùng khi đăng ký, không tiết lộ thông tin khác). */
router.get('/check-username', safeAsyncRoute(async (req, res) => {
    const username = normalizeUsername(req.query.username);
    if (!isValidUsername(username)) {
        return response.ok(res, { valid: false, available: false });
    }
    const exists = await User.findOne({ username }).select('username').lean();
    return response.ok(res, { valid: true, available: !exists });
}));

module.exports = router;