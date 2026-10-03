'use strict';

/**
 * Phân quyền phía máy chủ cho toàn bộ API quản trị.
 *
 * Áp dụng lên cả nhóm route `/api/admin/*` lẫn từng route nhạy cảm, để một lỗi
 * cấu hình đường dẫn không làm lộ API quản trị. Việc này thay cho việc tin
 * `role` do client gửi lên.
 */

const { ROLES } = require('../config/constants');
const { requireRole, requireAdmin } = require('./auth.middleware');

/**
 * Gắn cờ `isAdmin` vào request để các service khác dùng mà không cần tra cứu
 * lại session. Giá trị này LUÔN lấy từ session phía máy chủ.
 */
function markRole(req, _res, next) {
    req.isAdmin = req.session?.user?.role === ROLES.ADMIN;
    req.role = req.session?.user?.role || null;
    next();
}

/**
 * Bảo vệ cả nhóm `/api/admin`. Dùng trong app.js để mọi route admin đều an toàn
 * kể cả khi quên gắn requireAdmin thủ công.
 */
const protectAdminRoutes = requireAdmin;

/** Chỉ cho phép một danh sách vai trò cụ thể. */
const allowRoles = (...roles) => requireRole(...roles);

module.exports = { allowRoles, markRole, protectAdminRoutes };