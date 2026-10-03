'use strict';

/**
 * Định dạng phản hồi API thống nhất.
 *
 *   thành công: { success: true, data }
 *   thất bại : { success: false, code, message, requestId }
 *
 * Mọi route mới PHẢI dùng hai hàm này để client xử lý thống nhất.
 */

const { ERROR_CODES } = require('../config/constants');

/** Phản hồi thành công. */
function ok(res, data, status = 200) {
    return res.status(status).json({ success: true, data });
}

/** Phản hồi thành công có danh sách phân trang. */
function okList(res, { items, total, page = 1, pageSize = total || 0 }) {
    return res.status(200).json({
        success: true,
        data: {
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0
            }
        }
    });
}

/**
 * Phản hồi lỗi.
 * `details` chỉ dùng cho lỗi nghiệp vụ/validation, không chứa thông tin nhạy cảm.
 */
function fail(res, status, code, message, { requestId, details } = {}) {
    const body = {
        success: false,
        code,
        message,
        requestId: requestId || res.locals?.requestId || null
    };
    if (details) body.details = details;
    return res.status(status).json(body);
}

/** Lỗi 400 do người dùng nhập sai. */
function badRequest(res, message, details) {
    return fail(res, 400, ERROR_CODES.VALIDATION_FAILED, message, { requestId: res.locals?.requestId, details });
}

/** Lỗi 401 chưa đăng nhập. */
function unauthorized(res, message = 'Vui lòng đăng nhập để tiếp tục.') {
    return fail(res, 401, ERROR_CODES.UNAUTHORIZED, message, { requestId: res.locals?.requestId });
}

/** Lỗi 403 không đủ quyền. */
function forbidden(res, message = 'Bạn không có quyền thực hiện thao tác này.') {
    return fail(res, 403, ERROR_CODES.FORBIDDEN, message, { requestId: res.locals?.requestId });
}

/** Lỗi 404. */
function notFound(res, message = 'Không tìm thấy dữ liệu.') {
    return fail(res, 404, ERROR_CODES.NOT_FOUND, message, { requestId: res.locals?.requestId });
}

/** Lỗi 409 trùng lặp. */
function conflict(res, message) {
    return fail(res, 409, ERROR_CODES.DUPLICATE, message, { requestId: res.locals?.requestId });
}

/** Lỗi 503 khi cơ sở dữ liệu chưa sẵn sàng. */
function databaseUnavailable(res) {
    return fail(
        res,
        503,
        ERROR_CODES.DATABASE_UNAVAILABLE,
        'Cơ sở dữ liệu đang kết nối lại. Vui lòng thử lại sau ít phút.',
        { requestId: res.locals?.requestId }
    );
}

module.exports = {
    ok,
    okList,
    fail,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    databaseUnavailable
};