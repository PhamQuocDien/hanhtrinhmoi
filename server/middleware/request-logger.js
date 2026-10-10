'use strict';

function createRequestLogger({ write = line => process.stdout.write(`${line}\n`), now = Date.now } = {}) {
    return function requestLogger(req, res, next) {
        const startedAt = now();
        res.once('finish', () => {
            const path = String(req.path || '/').split('?')[0].slice(0, 180);
            write(JSON.stringify({
                level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
                event: 'http_request', requestId: req.requestId || '', method: req.method,
                path, status: res.statusCode, durationMs: Math.max(0, now() - startedAt),
                ip: String(req.ip || req.socket?.remoteAddress || '').slice(0, 80)
            }));
        });
        next();
    };
}

module.exports = { createRequestLogger };
