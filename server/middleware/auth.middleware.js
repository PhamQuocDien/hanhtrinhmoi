'use strict';

/**
 * Middleware xác thực và phân quyền.
 *
 * NGUYÊN TẮC: quyền luôn do MÁY CHỦ quyết định.
 * Không tin `req.body.role`, `localStorage.role`, hay role do client tự gửi lên.
 */

const { ROLES } = require('../config/constants');
const response = require('../utils/response');

/** Session đã đăng nhập hay chưa. */
function isAuthenticated(req) {
    return Boolean(req.session?.user?.username);
}

/** Bắt buộc đăng nhập. */
function requireAuth(req, res, next) {
    if (!isAuthenticated(req)) return response.unauthorized(res);
    return next();
}

/** Bắt buộc đăng nhập và có vai trò cụ thể. */
function requireRole(...roles) {
    const allowed = new Set(roles.flat());
    return (req, res, next) => {
        if (!isAuthenticated(req)) return response.unauthorized(res);
        // So sánh từ session phía máy chủ, không lấy role từ request body.
        if (!allowed.has(req.session.user.role)) {
            return response.forbidden(res, 'Tài khoản của bạn không được phép thực hiện thao tác này.');
        }
        return next();
    };
}

/** Bắt buộc là quản trị viên. */
function requireAdmin(req, res, next) {
    return requireRole(ROLES.ADMIN)(req, res, next);
}

/** Bắt buộc là học sinh (hoặc giáo viên xem được dữ liệu của học sinh). */
function requireStudent(req, res, next) {
    return requireRole(ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN)(req, res, next);
}

/** Bắt buộc là phụ huynh. */
function requireParent(req, res, next) {
    return requireRole(ROLES.PARENT)(req, res, next);
}

/**
 * Nạp thông tin người dùng đầy đủ vào req.user.
 * Route cần dữ liệu người dùng (lớp, bộ sách…) mới gọi middleware này sau
 * requireAuth. Không đưa mật khẩu hash vào req.user.
 */
function attachUser(User) {
    return async function loadUser(req, res, next) {
        if (!isAuthenticated(req)) return response.unauthorized(res);
        try {
            // eslint-disable-next-line global-require
            const user = await User.findOne({ username: req.session.user.username })
                .select('-password')
                .lean();
            if (!user) return response.unauthorized(res, 'Tài khoản không tồn tại hoặc đã bị xoá.');
            if (user.isSuspended) {
                return response.forbidden(res, 'Tài khoản đã bị khoá.');
            }
            req.user = user;
            return next();
        } catch (error) {
            return next(error);
        }
    };
}

module.exports = {
    attachUser,
    isAuthenticated,
    requireAdmin,
    requireAuth,
    requireParent,
    requireRole,
    requireStudent
};