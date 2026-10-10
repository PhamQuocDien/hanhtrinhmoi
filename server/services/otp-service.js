'use strict';

/**
 * OTP Service (Phase 2 — mục 8).
 * - Mã OTP chỉ tồn tại dạng hash (sha256 + secret) — không log, không trả plaintext.
 * - TTL, giới hạn số lần sai, giới hạn số lần gửi per định danh/khoảng thời gian.
 * - Transport pluggable: mặc định null (chưa cấu hình kênh gửi) → trả sent:false
 *   và message trung thực; không bao giờ "giả vờ đã gửi".
 * - Ticket HMAC cho phép xác thực email/SAĐT NGAY SAU đăng ký (trước khi đăng nhập).
 * - Store interface nhỏ (get/put/delete/count) → thay Mongo adapter mà không đổi logic.
 */

const crypto = require('crypto');

const DEFAULT_TTL_MS = 10 * 60 * 1000;         // 10 phút
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 phút
const DEFAULT_MAX_PER_WINDOW = 3;
const TICKET_TTL_MS = 30 * 60 * 1000;          // 30 phút

function createMemoryStore() {
    const map = new Map();
    return {
        async get(key) { return map.get(key) || null; },
        async put(key, record) { map.set(key, record); },
        async delete(key) { map.delete(key); },
        async countSince(key, since) {
            const record = map.get(key);
            if (!record?.history) return 0;
            return record.history.filter(time => time >= since).length;
        }
    };
}

function hashCode(code, secret) {
    return crypto.createHmac('sha256', String(secret)).update(String(code)).digest('hex');
}

function generateNumericCode(digits = 6) {
    const value = crypto.randomInt(0, 10 ** digits);
    return String(value).padStart(digits, '0');
}

function createOtpService({
    secret = 'otp-dev-secret-change-me',
    store = createMemoryStore(),
    transport = null, // async ({ channel, identifier, code, purpose }) => void
    now = () => Date.now(),
    ttlMs = DEFAULT_TTL_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    rateWindowMs = DEFAULT_RATE_WINDOW_MS,
    maxPerWindow = DEFAULT_MAX_PER_WINDOW,
    codeDigits = 6
} = {}) {
    if (!secret || String(secret).length < 16) {
        throw new Error('OTP secret phải dài tối thiểu 16 ký tự.');
    }

    const keyFor = (purpose, channel, identifier) => `otp:${purpose}:${channel}:${identifier}`;
    const rateKeyFor = (purpose, channel, identifier) => `otprate:${purpose}:${channel}:${identifier}`;

    /** Tạo & (nếu có transport) gửi OTP. KHÔNG trả code ra ngoài. */
    async function issue({ purpose = 'registration', channel, identifier }) {
        if (channel !== 'email' && channel !== 'phone') {
            return { ok: false, reason: 'CHANNEL_INVALID', message: 'Kênh xác thực không hợp lệ.' };
        }
        const id = String(identifier || '').trim();
        if (!id) return { ok: false, reason: 'IDENTIFIER_REQUIRED', message: 'Thiếu thông tin xác thực.' };

        const rateKey = rateKeyFor(purpose, channel, id);
        const recent = await store.countSince(rateKey, now() - rateWindowMs);
        if (recent >= maxPerWindow) {
            return {
                ok: false,
                reason: 'RATE_LIMITED',
                message: `Đã gửi quá nhiều mã. Vui lòng thử lại sau ${Math.ceil(rateWindowMs / 60000)} phút.`
            };
        }

        const code = generateNumericCode(codeDigits);
        const timestamp = now();
        await store.put(keyFor(purpose, channel, id), {
            codeHash: hashCode(code, secret),
            expiresAt: timestamp + ttlMs,
            attempts: 0,
            issuedAt: timestamp
        });
        const rateRecord = (await store.get(rateKey)) || { history: [] };
        rateRecord.history = [...(rateRecord.history || []).filter(time => time >= timestamp - rateWindowMs), timestamp];
        await store.put(rateKey, rateRecord);

        let sent = false;
        let transportError = null;
        if (typeof transport === 'function') {
            try {
                await transport({ channel, identifier: id, code, purpose });
                sent = true;
            } catch (error) {
                transportError = error.message || 'transport failed';
            }
        }
        // KHÔNG log code. Chỉ trả thông tin không nhạy cảm.
        return {
            ok: true,
            sent,
            expiresInMinutes: Math.round(ttlMs / 60000),
            transportConfigured: typeof transport === 'function',
            ...(transportError ? { transportError } : {})
        };
    }

    /** Xác minh OTP. Chỉ trả lý do, không lộ code/hash. */
    async function verify({ purpose = 'registration', channel, identifier, code }) {
        const id = String(identifier || '').trim();
        const record = await store.get(keyFor(purpose, channel, id));
        if (!record) return { ok: false, reason: 'NOT_FOUND', message: 'Chưa có mã nào được gửi. Hãy yêu cầu mã mới.' };
        if (now() >= record.expiresAt) {
            await store.delete(keyFor(purpose, channel, id));
            return { ok: false, reason: 'EXPIRED', message: 'Mã đã hết hạn. Hãy yêu cầu mã mới.' };
        }
        if (record.attempts >= maxAttempts) {
            await store.delete(keyFor(purpose, channel, id));
            return { ok: false, reason: 'MAX_ATTEMPTS', message: 'Đã nhập sai quá số lần cho phép. Hãy yêu cầu mã mới.' };
        }
        const providedHash = hashCode(String(code ?? '').trim(), secret);
        const correct = providedHash.length === record.codeHash.length &&
            crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(record.codeHash));
        if (!correct) {
            record.attempts += 1;
            await store.put(keyFor(purpose, channel, id), record);
            return { ok: false, reason: 'MISMATCH', message: 'Mã không đúng.' };
        }
        await store.delete(keyFor(purpose, channel, id));
        return { ok: true };
    }

    /** Ticket ngắn hạn để xác thực sau đăng ký, trước khi đăng nhập. */
    function createTicket(username) {
        const payload = `${Buffer.from(String(username)).toString('base64url')}.${now() + TICKET_TTL_MS}.${now()}`;
        const signature = crypto.createHmac('sha256', String(secret)).update(payload).digest('base64url');
        return `${payload}.${signature}`;
    }

    function verifyTicket(ticket) {
        const parts = String(ticket || '').split('.');
        if (parts.length !== 4) return { ok: false, reason: 'INVALID' };
        const [usernameB64, expiresAtRaw, issuedAtRaw, signature] = parts;
        const payload = `${usernameB64}.${expiresAtRaw}.${issuedAtRaw}`;
        const expected = crypto.createHmac('sha256', String(secret)).update(payload).digest('base64url');
        const providedBuf = Buffer.from(signature);
        const expectedBuf = Buffer.from(expected);
        const valid = providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);
        if (!valid) return { ok: false, reason: 'INVALID' };
        if (now() > Number(expiresAtRaw)) return { ok: false, reason: 'EXPIRED' };
        let username = '';
        try { username = Buffer.from(usernameB64, 'base64url').toString('utf8'); } catch { return { ok: false, reason: 'INVALID' }; }
        if (!username) return { ok: false, reason: 'INVALID' };
        return { ok: true, username };
    }

    return { issue, verify, createTicket, verifyTicket };
}

module.exports = {
    createOtpService,
    createMemoryStore,
    DEFAULT_TTL_MS,
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_RATE_WINDOW_MS,
    DEFAULT_MAX_PER_WINDOW,
    TICKET_TTL_MS
};