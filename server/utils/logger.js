'use strict';

/**
 * Ghi log có nhãn và mã yêu cầu để truy vết lỗi xuyên suốt request.
 * Không dùng console trực tiếp trong business logic.
 */

const env = require('../config/env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const ACTIVE_LEVEL = env.IS_PRODUCTION ? LEVELS.info : LEVELS.debug;

function write(level, args) {
    if (LEVELS[level] > ACTIVE_LEVEL) return;
    const prefix = `[${level.toUpperCase()}]`;
    const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    target(prefix, ...args);
}

module.exports = {
    error: (...args) => write('error', args),
    warn: (...args) => write('warn', args),
    info: (...args) => write('info', args),
    debug: (...args) => write('debug', args),
    /** Log kèm mã yêu cầu nếu có. */
    withRequest: (requestId, level, ...args) => write(level, [`[${requestId || '-'}]`, ...args])
};