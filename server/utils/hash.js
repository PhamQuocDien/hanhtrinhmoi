'use strict';

/**
 * Băm mật khẩu và sinh mã ngẫu nhiên.
 * Mật khẩu KHÔNG BAO GIỜ được lưu dạng rõ hoặc trả về cho trình duyệt.
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const env = require('../config/env');

/** Băm mật khẩu bằng bcrypt với số vòng lặp cấu hình. */
async function hashPassword(password) {
    return bcrypt.hash(String(password), env.SECURITY.bcryptRounds);
}

/** Kiểm tra mật khẩu. Trả về false nếu hash không hợp lệ thay vì ném lỗi. */
async function verifyPassword(password, hash) {
    if (!hash) return false;
    try {
        return await bcrypt.compare(String(password), String(hash));
    } catch {
        return false;
    }
}

/** Chuỗi ngẫu nhiên an toàn về mật mã, dùng cho mã phiên/mã nội bộ. */
function randomToken(bytes = 24) {
    return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Mã ngắn gồm chữ cái và số, loại trừ ký tự dễ nhầm (0/O, 1/I/L).
 * Dùng cho mã mời giải đấu, mã phiếu, mã nhập viên.
 */
function randomHumanCode(length = 6, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
    const bytes = crypto.randomBytes(length);
    let output = '';
    for (let index = 0; index < length; index += 1) {
        output += alphabet[bytes[index] % alphabet.length];
    }
    return output;
}

/** So khớp hai giá trị mà không phụ thuộc thứ tự chữ hoa/thường. */
function equalsIgnoreCase(a, b) {
    return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

module.exports = { hashPassword, verifyPassword, randomToken, randomHumanCode, equalsIgnoreCase };