'use strict';

/**
 * Cấu hình môi trường — nguồn duy nhất cho mọi giá trị cấu hình.
 * Không được đọc process.env rải rác ở nhiều module khác.
 */

const crypto = require('crypto');

/** Đọc số nguyên trong khoảng [min, max], có giá trị dự phòng. */
function readEnvInt(name, fallback, min, max) {
    const parsed = Number.parseInt(process.env[name], 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

/** Đọc cờ boolean từ biến môi trường. */
function readEnvBool(name, fallback = false) {
    const raw = String(process.env[name] ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes';
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const APP_VERSION = '15.0.0';
const APP_NAME = 'Hành Tinh Mơ Ước — Nền tảng học tập';

/**
 * Khoá phiên: ưu tiên SESSION_SECRET từ môi trường. Nếu thiếu hoặc quá ngắn
 * thì sinh khoá ổn định từ cấu hình máy chủ để không mất phiên khi restart,
 * đồng thời cảnh báo rõ ràng.
 */
function resolveSessionSecret() {
    const provided = String(process.env.SESSION_SECRET || '');
    if (provided.length >= 32) return { secret: provided, isDerived: false };
    const fallbackMaterial = `hanh-trinh-mo-uoc|${MONGO_URI || 'local'}|session-v15`;
    return {
        secret: crypto.createHash('sha256').update(fallbackMaterial).digest('hex'),
        isDerived: true
    };
}

/** Cấu hình giới hạn upload tài liệu DOCX. */
const UPLOAD_LIMITS = Object.freeze({
    // 8 MB là trần cho một đề thi Word có hình.
    maxFileSizeBytes: readEnvInt('UPLOAD_MAX_BYTES', 8 * 1024 * 1024, 1024 * 1024, 32 * 1024 * 1024),
    // Số câu tối đa nhận từ một tài liệu để tránh nhập nhầm cả tập đề.
    maxQuestionsPerImport: readEnvInt('UPLOAD_MAX_QUESTIONS', 300, 10, 2000),
    allowedExtension: '.docx',
    // Chữ ký nhị phân của tệp .docx (Office Open XML, ZIP).
    allowedMagic: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    allowedMimeTypes: Object.freeze([
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/octet-stream'
    ])
});

/** Cấu hình chấm điểm. */
const SCORING = Object.freeze({
    // Điểm đạt (thang 10) cho bài kiểm tra tự chấm.
    passScore: readEnvInt('EXAM_PASS_SCORE', 5, 0, 10),
    // Số câu tối đa trong một đề ngẫu nhiên.
    maxQuestionsPerExam: readEnvInt('EXAM_MAX_QUESTIONS', 30, 5, 100),
    minQuestionsPerExam: readEnvInt('EXAM_MIN_QUESTIONS', 10, 1, 50),
    // Số phút cho mỗi câu khi không khai báo duration riêng.
    defaultMinutesPerQuestion: readEnvInt('EXAM_MINUTES_PER_QUESTION', 2, 1, 30),
    // Phần trăm cảnh báo khi điểm thấp để gợi ý ôn tập.
    weakScoreThreshold: readEnvInt('EXAM_WEAK_THRESHOLD', 5, 0, 10)
});

/** Cấu hình bảo mật phiên / mật khẩu. */
const SECURITY = Object.freeze({
    bcryptRounds: readEnvInt('BCRYPT_ROUNDS', 10, 10, 12),
    sessionMaxAgeMs: readEnvInt('SESSION_MAX_AGE_HOURS', 24, 1, 24 * 30) * 60 * 60 * 1000,
    // Số lần đăng nhập/đăng ký tối đa trong 15 phút cho mỗi tài khoản/IP.
    authRateLimitMax: readEnvInt('AUTH_RATE_LIMIT_MAX', 30, 1, 500),
    authRateLimitWindowMs: readEnvInt('AUTH_RATE_LIMIT_WINDOW_MIN', 15, 1, 1440) * 60 * 1000,
    adminRateLimitMax: readEnvInt('ADMIN_RATE_LIMIT_MAX', 120, 1, 5000)
});

/** Danh sách tên đệm tuyệt đối không cho đăng ký. */
const RESERVED_USERNAMES = Object.freeze(['admin', 'administrator', 'root', 'system', 'mod', 'moderator', 'support']);

const env = {
    APP_NAME,
    APP_VERSION,
    HOST,
    IS_PRODUCTION,
    MONGO_URI,
    PORT,
    RESERVED_USERNAMES,
    SCORING,
    SECURITY,
    SESSION: resolveSessionSecret(),
    UPLOAD_LIMITS,
    // Cổng MongoDB dùng cho script migrate/seed chạy ngoài HTTP server.
    MIGRATION_BATCH_SIZE: readEnvInt('MIGRATION_BATCH_SIZE', 500, 1, 5000)
};

module.exports = env;