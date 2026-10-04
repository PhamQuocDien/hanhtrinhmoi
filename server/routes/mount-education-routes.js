'use strict';

/**
 * Gắn toàn bộ ROUTE của nền tảng học tập vào một ứng dụng Express đang chạy.
 *
 * Tách riêng thành một module để `server.js` chỉ cần gọi một lần, thay vì phải
 * biết chi tiết có bao nhiêu nhóm route. Đây cũng là nơi duy nhất biết thứ tự
 * gắn route — thứ tự này có ý nghĩa bảo mật.
 *
 * Thứ tự:
 *   1. `requireAdmin` cho nhóm /api/admin  — chặn ở tầng app, route thêm sau
 *      cũng không lọt (phòng trường hợp quên gắn middleware cho một route).
 *   2. Route xác thực (không yêu cầu đăng nhập).
 *   3. Route học sinh (tự kiểm tra phiên trong từng route).
 *   4. Route quản trị (đã qua lớp bảo vệ ở bước 1).
 *
 * @param {import('express').Express} app
 */
const { requireAdmin } = require('../middleware/auth.middleware');
const authRoutes = require('./auth.routes');
const studentRoutes = require('./student.routes');
const adminRoutes = require('./admin.routes');

module.exports = function mountEducationRoutes(app) {
    // 1. Lớp bảo vệ nhóm quản trị — đặt TRƯỚC mọi route admin.
    app.use('/api/admin', requireAdmin);

    // 2–4. Các nhóm route. Route nào chưa có trong `app.use('/api/admin', ...)`
    //     vẫn được bảo vệ nhờ bước 1.
    app.use('/api/auth', authRoutes);
    app.use('/api/student', studentRoutes);
    app.use('/api/admin', adminRoutes);
};
