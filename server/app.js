'use strict';

/**
 * Ứng DỤNG EXPRESS của nền tảng học tập.
 *
 * Đây là tầng khởi tạo duy nhất; `server.js` chỉ khởi động HTTP + Socket.IO rồi
 * gọi hàm ở đây. Nhờ vậy ứng dụng có thể được kiểm thử mà không cần mở cổng.
 *
 * Thứ tự middleware có ý nghĩa bảo mật:
 *   1. requestId + header an toàn  (để log/điều tra được mọi request)
 *   2. tài nguyên công khai        (không cần phiên)
 *   3. session                     (sau khi đã phục vụ trang chẩn đoán)
 *   4. phân tích body              (giới hạn kích thước)
 *   5. route                       (/api/...)
 *   6. 404 + error                 (bắt lỗi tập trung)
 */

const path = require('path');
const express = require('express');
const session = require('express-session');

const env = require('./config/env');
const logger = require('./utils/logger');
const { requireAdmin } = require('./middleware/auth.middleware');
const {
    notFoundHandler,
    errorHandler,
    patchAsyncRoutes,
    installProcessGuards
} = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const adminRoutes = require('./routes/admin.routes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Cấu hình lưu phiên.
 *
 * Có MongoDB thì dùng `connect-mongo` để phiên sống lâu và không mất khi restart.
 * Không có MongoDB (chạy thử trên máy chưa cài DB) thì dùng bộ nhớ — chấp nhận
 * được cho môi trường phát triển, và sẽ cảnh báo rõ để không deploy nhầm.
 */
function buildSessionStore(MongoStore) {
    const base = {
        name: 'hanhtrinh.sid',
        secret: env.SESSION.secret,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: env.IS_PRODUCTION,
            maxAge: env.SECURITY.sessionMaxAgeMs
        }
    };

    if (!env.MONGO_URI) {
        if (env.IS_PRODUCTION) {
            logger.error('Thiếu MONGO_URI — phiên sẽ lưu trong bộ nhớ và mất khi restart.');
        }
        return session(base);
    }

    // `connect-mongo` tự dùng biến môi trường khi không truyền `mongoUrl`.
    return session({ ...base, store: MongoStore.create({ collectionName: 'sessions', ttl: 24 * 60 * 60 }) });
}

/**
 * Khởi tạo ứng dụng Express.
 * @param {object} deps { MongoStore } — nạp store phiên từ server.js.
 * @returns {import('express').Express}
 */
function createApp(deps = {}) {
    const app = express();
    installProcessGuards();

    // Express 4 không tự chuyển lỗi async/await sang error middleware.
    patchAsyncRoutes(app);

    // ---- 1. Mã yêu cầu + header an toàn (đứng đầu để mọi request đều có) ----
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        req.requestId = String(req.get('X-Request-Id')
            || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`)
            .slice(0, 80);
        res.locals.requestId = req.requestId;
        res.setHeader('X-Request-Id', req.requestId);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        // Chỉ cho phép tải tài nguyên từ chính máy chủ (chặn XSS qua tài nguyên ngoài).
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
        );
        next();
    });

    // ---- 2. Tài nguyên công khai (không cần phiên) ----
    const staticOptions = { etag: true, maxAge: env.IS_PRODUCTION ? '1h' : 0 };
    app.use(express.static(PUBLIC_DIR, staticOptions));

    // ---- 3. Phiên ----
    app.use(buildSessionStore(deps.MongoStore));

    // ---- 4. Phân tích body với giới hạn kích thước ----
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false, limit: '256kb' }));

    // ---- 5. Route ----
    // Bảo vệ nhóm /api/admin ở tầng app: route mới thêm vào sau cũng không lọt.
    app.use('/api/admin', requireAdmin);

    app.get('/api/health', (req, res) => res.json({
        status: 'alive',
        app: env.APP_NAME,
        version: env.APP_VERSION,
        uptimeSeconds: Math.floor(process.uptime())
    }));

    app.use('/api/auth', authRoutes);
    app.use('/api/student', studentRoutes);
    app.use('/api/admin', adminRoutes);

    // ---- 6. Bắt lỗi tập trung ----
    app.use('/api', notFoundHandler);
    app.use(errorHandler);

    return app;
}

module.exports = { PUBLIC_DIR, buildSessionStore, createApp };
