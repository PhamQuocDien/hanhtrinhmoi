'use strict';

/**
 * Xử lý lỗi tập trung và chặn request treo.
 *
 * Express 4 không tự chuyển lỗi từ route async/await sang error middleware.
 * `safeAsyncRoute` bọc handler để một lỗi MongoDB không làm request treo hoặc
 * sập tiến trình.
 */

const { ERROR_CODES } = require('../config/constants');
const response = require('../utils/response');
const logger = require('../utils/logger');
const env = require('../config/env');

/** Bọc một handler async để lỗi luôn tới error middleware. */
function safeAsyncRoute(handler) {
    return function wrapped(req, res, next) {
        try {
            const result = handler(req, res, next);
            if (result && typeof result.then === 'function') result.catch(next);
            return result;
        } catch (error) {
            return next(error);
        }
    };
}

/**
 * Bọc toàn bộ phương thức định tuyến của Express một lần khi khởi tạo app,
 * thay vì bọc thủ công từng route.
 */
function patchAsyncRoutes(app) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
        const original = app[method].bind(app);
        app[method] = (routePath, ...handlers) => {
            if (!handlers.length) return original(routePath);
            return original(routePath, ...handlers.map(handler => (
                typeof handler === 'function' ? safeAsyncRoute(handler) : handler
            )));
        };
    }
    return app;
}

/** 404 cho API không tồn tại. */
function notFoundHandler(req, res) {
    response.fail(res, 404, ERROR_CODES.NOT_FOUND, 'API không tồn tại.', {
        requestId: res.locals?.requestId
    });
}

/** Chuyển lỗi Mongoose thành thông điệp thân thiện. */
function describeError(error) {
    if (!error) return { status: 500, code: ERROR_CODES.INTERNAL_ERROR, message: 'Hệ thống gặp lỗi.' };
    if (error.name === 'ValidationError') {
        return { status: 400, code: ERROR_CODES.VALIDATION_FAILED, message: 'Dữ liệu gửi lên không hợp lệ.' };
    }
    if (error.name === 'CastError') {
        return { status: 400, code: ERROR_CODES.VALIDATION_FAILED, message: 'Định danh không hợp lệ.' };
    }
    if (error.code === 11000) {
        return { status: 409, code: ERROR_CODES.DUPLICATE, message: 'Dữ liệu đã tồn tại.' };
    }
    if (error.type === 'entity.parse.failed') {
        return { status: 400, code: ERROR_CODES.VALIDATION_FAILED, message: 'Nội dung yêu cầu không phải JSON hợp lệ.' };
    }
    return {
        status: error.status || error.statusCode || 500,
        code: error.code || ERROR_CODES.INTERNAL_ERROR,
        message: error.expose && error.status < 500 ? error.message : 'Hệ thống gặp lỗi ngoài dự kiến.'
    };
}

/** Error middleware cuối cùng. */
function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    const described = describeError(error);
    logger.withRequest(res.locals?.requestId, 'error', `${req.method} ${req.originalUrl} —`, error.message);

    // Không rò rỉ chi tiết lỗi nội bộ ra ngoài ở môi trường production.
    const details = env.IS_PRODUCTION ? undefined : { stack: error.stack?.split('\n').slice(0, 4) };
    return response.fail(res, described.status, described.code, described.message, {
        requestId: res.locals?.requestId,
        details
    });
}

/** Bắt lỗi ngoài dự kiến để tiến trình không bị sập. */
function installProcessGuards() {
    process.on('unhandledRejection', error => {
        logger.error('Promise bị từ chối chưa xử lý:', error?.message || error);
    });
    process.on('uncaughtException', error => {
        logger.error('Ngoại lệ chưa bắt:', error?.message || error);
    });
}

module.exports = {
    describeError,
    errorHandler,
    installProcessGuards,
    notFoundHandler,
    patchAsyncRoutes,
    safeAsyncRoute
};