'use strict';

/**
 * Kết nối MongoDB với cơ chế thử lại.
 *
 * Quy tắc: KHÔNG bao giờ drop database, KHÔNG tự động xoá dữ liệu.
 * Nếu thiếu MONGO_URI, tiến trình vẫn khởi động ở chế độ chẩn đoán và các API
 * cần dữ liệu trả về 503 rõ ràng thay vì treo request.
 */

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

let connectTimer = null;
let attempts = 0;
let lastError = '';

/** Số lần thử lại trước khi bỏ cuộc (vẫn giữ server sống để Render khỏi restart vòng). */
const MAX_ATTEMPTS = 8;

/** Lùi theo số lần thử, tối đa 30 giây. */
function retryDelayMs() {
    return Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
}

/** Kết nối một lần. Trả về true nếu thành công. */
async function connectOnce() {
    if (!env.MONGO_URI) return false;
    try {
        mongoose.set('strictQuery', true);
        await mongoose.connect(env.MONGO_URI, {
            serverSelectionTimeoutMS: 8000,
            maxPoolSize: 20,
            minPoolSize: 2,
            autoIndex: !env.IS_PRODUCTION
        });
        attempts = 0;
        lastError = '';
        logger.info('Đã kết nối MongoDB.');
        return true;
    } catch (error) {
        lastError = error.message;
        logger.warn(`Kết nối MongoDB thất bại (lần ${attempts}): ${error.message}`);
        return false;
    }
}

/** Kết nối có tự thử lại theo backoff. */
async function connectMongoWithRetry() {
    if (!env.MONGO_URI) {
        logger.warn('Thiếu MONGO_URI/MONGODB_URI — chạy chế độ chẩn đoán, các API cần dữ liệu sẽ trả 503.');
        return false;
    }

    attempts += 1;
    const connected = await connectOnce();
    if (connected) return true;

    if (attempts >= MAX_ATTEMPTS) {
        logger.error(`Đã thử ${attempts} lần không được. Vẫn giữ tiến trình sống để endpoint /healthz phản hồi.`);
        return false;
    }

    connectTimer = setTimeout(() => {
        connectMongoWithRetry();
    }, retryDelayMs());
    connectTimer.unref?.();
    return false;
}

/** MongoDB có sẵn sàng nhận truy vấn không. */
function isReady() {
    return mongoose.connection.readyState === 1;
}

/** Mô tả trạng thái cho endpoint chẩn đoán. */
function status() {
    return {
        ready: isReady(),
        state: mongoose.connection.readyState,
        attempts,
        lastError
    };
}

/** Ngắt kết nối gọn gàng. */
async function disconnect() {
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = null;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

module.exports = { connectMongoWithRetry, isReady, status, disconnect, mongoose };