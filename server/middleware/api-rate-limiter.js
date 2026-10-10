'use strict';

const DEFAULT_POLICIES = [
    { name: 'otp', match: /(?:otp|verify-email|verify-phone|password-reset)/i, windowMs: 15 * 60 * 1000, max: 8 },
    { name: 'auth', match: /(?:login|register|signup|forgot-password|reset-password)/i, windowMs: 15 * 60 * 1000, max: 15 },
    { name: 'code', match: /(?:code-runner|code-execution|execute|practice\/tasks\/[^/]+\/submit)/i, windowMs: 5 * 60 * 1000, max: 25 },
    { name: 'upload', match: /(?:upload|attachments?|media)/i, windowMs: 10 * 60 * 1000, max: 20 },
    { name: 'ai', match: /(?:ai|tutor|generation|speaking|assessment\/grade|essay|course-factory)/i, windowMs: 10 * 60 * 1000, max: 30 },
    { name: 'assessment', match: /(?:assessment|placement|survey|submit|grade|score)/i, windowMs: 10 * 60 * 1000, max: 60 }
];
const GENERAL_POLICY = { name: 'api', windowMs: 15 * 60 * 1000, max: 300 };
function boundedEnvInt(name, fallback, min, max) {
    const value = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
function configuredPolicies() {
    return DEFAULT_POLICIES.map(policy => {
        const suffix = policy.name.toUpperCase();
        return { ...policy, max: boundedEnvInt(`API_RATE_LIMIT_${suffix}_MAX`, policy.max, 1, 10000), windowMs: boundedEnvInt(`API_RATE_LIMIT_${suffix}_WINDOW_MS`, policy.windowMs, 1000, 86400000) };
    });
}
function configuredGeneralPolicy() {
    return { ...GENERAL_POLICY, max: boundedEnvInt('API_RATE_LIMIT_API_MAX', GENERAL_POLICY.max, 1, 100000), windowMs: boundedEnvInt('API_RATE_LIMIT_API_WINDOW_MS', GENERAL_POLICY.windowMs, 1000, 86400000) };
}

function createApiRateLimiter({ policies = configuredPolicies(), general = configuredGeneralPolicy(), now = Date.now } = {}) {
    const buckets = new Map();
    let calls = 0;
    function consume(key, policy) {
        const timestamp = now();
        const current = buckets.get(key);
        const bucket = !current || current.expiresAt <= timestamp
            ? { count: 0, expiresAt: timestamp + policy.windowMs, policy }
            : current;
        bucket.count += 1;
        buckets.set(key, bucket);
        return { allowed: bucket.count <= policy.max, remaining: Math.max(0, policy.max - bucket.count), retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - timestamp) / 1000)), limit: policy.max };
    }
    return function apiRateLimiter(req, res, next) {
        if (req.method === 'OPTIONS' || /^\/api\/(?:health|ready)(?:\/|$)/i.test(req.path)) return next();
        const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 120);
        const route = String(req.path || '/').split('/').slice(0, 4).join('/').slice(0, 160);
        const policy = policies.find(item => item.match.test(route)) || general;
        const account = String(req.session?.user?.username || req.body?.username || '').trim().toLowerCase().slice(0, 120);
        const checks = [consume(`${policy.name}:ip:${ip}:${route}`, policy)];
        if (account) checks.push(consume(`${policy.name}:account:${account}`, policy));
        calls += 1;
        if (calls % 256 === 0 || buckets.size > 12000) {
            const timestamp = now();
            for (const [key, bucket] of buckets) if (bucket.expiresAt <= timestamp) buckets.delete(key);
            if (buckets.size > 12000) {
                for (const key of buckets.keys()) { buckets.delete(key); if (buckets.size <= 10000) break; }
            }
        }
        const blocked = checks.find(item => !item.allowed);
        res.setHeader('RateLimit-Limit', String(blocked?.limit || checks[0].limit));
        res.setHeader('RateLimit-Remaining', String(Math.min(...checks.map(item => item.remaining))));
        if (!blocked) return next();
        res.setHeader('Retry-After', String(blocked.retryAfterSeconds));
        return res.status(429).json({ success: false, code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.', retryAfterSeconds: blocked.retryAfterSeconds, requestId: req.requestId });
    };
}

module.exports = { createApiRateLimiter, DEFAULT_POLICIES, GENERAL_POLICY, configuredPolicies, configuredGeneralPolicy };
