'use strict';

/**
 * Validators & helpers thuần cho đăng ký / xác thực (Phase 2).
 * - Không phụ thuộc Express/Mongoose → test độc lập bằng node assert.
 * - Backend là nguồn sự thật: mọi trường "verified"/"role" từ client bị bỏ qua,
 *   trạng thái xác thực chỉ do OTP service quyết định.
 */

const VERIFICATION_STATUSES = ['EMAIL_UNVERIFIED', 'PHONE_UNVERIFIED', 'PARTIALLY_VERIFIED', 'VERIFIED', 'SUSPENDED', 'LOCKED'];
const EDUCATION_STATUSES = ['studying', 'university', 'graduated', 'retake_supplement', 'working_adult', 'other'];

function collapseWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function fail(field, message) {
    return { ok: false, field, message };
}

function pass(value) {
    return { ok: true, value };
}

/** Họ và tên: không rỗng, 2–100 ký tự sau chuẩn hóa, không chứa HTML/script. */
function validateFullName(raw) {
    const value = collapseWhitespace(raw);
    if (!value) return fail('fullName', 'Họ và tên không được để trống.');
    if (/[<>]/.test(value)) return fail('fullName', 'Họ và tên không được chứa mã HTML.');
    if (/javascript:/i.test(value)) return fail('fullName', 'Họ và tên không được chứa nội dung script.');
    if (value.length < 2) return fail('fullName', 'Họ và tên quá ngắn (tối thiểu 2 ký tự).');
    if (value.length > 100) return fail('fullName', 'Họ và tên quá dài (tối đa 100 ký tự).');
    return pass(value);
}

/** Email: format hợp lệ + luôn lowercase. */
function validateEmail(raw) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!value) return fail('email', 'Email không được để trống.');
    if (value.length > 254) return fail('email', 'Email quá dài.');
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value)) {
        return fail('email', 'Email không hợp lệ.');
    }
    return pass(value);
}

/** Số điện thoại Việt Nam: normalize về dạng 0xxxxxxxxx (10–11 số). */
function validatePhone(raw) {
    let value = collapseWhitespace(raw).replace(/[\s.\-()]/g, '');
    if (!value) return fail('phone', 'Số điện thoại không được để trống.');
    if (/^\+84/.test(value)) value = '0' + value.slice(3);
    else if (/^84\d{9,10}$/.test(value)) value = '0' + value.slice(2);
    if (!/^0\d{9,10}$/.test(value)) return fail('phone', 'Số điện thoại không hợp lệ (VD: 0912345678).');
    return pass(value);
}

/** Game ID: 3–24 ký tự, chữ/số/gạch dưới, không nhầm sang tài khoản admin. */
function validateGameId(raw, { reserved = ['admin'] } = {}) {
    const value = String(raw ?? '').trim();
    if (!value) return fail('gameId', 'ID trong game không được để trống.');
    if (value.length < 3 || value.length > 24) return fail('gameId', 'ID trong game phải dài 3–24 ký tự.');
    if (!/^[A-Za-z0-9_]+$/.test(value)) return fail('gameId', 'ID trong game chỉ gồm chữ, số và gạch dưới.');
    if (reserved.includes(value.toLowerCase())) return fail('gameId', 'ID trong game này đã được dành riêng.');
    return pass(value);
}

/** Ngày sinh: lịch thật, không tương lai, không ngoài 1900–năm hiện tại. */
function validateDob(dayRaw, monthRaw, yearRaw, now = new Date()) {
    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return fail('dob', 'Ngày sinh không hợp lệ.');
    }
    if (year < 1900 || year > now.getFullYear()) return fail('dob', 'Năm sinh không hợp lệ.');
    if (month < 1 || month > 12) return fail('dob', 'Tháng sinh không hợp lệ.');
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return fail('dob', 'Ngày sinh không tồn tại trong lịch.');
    }
    if (date.getTime() > now.getTime()) return fail('dob', 'Ngày sinh không được là ngày tương lai.');
    const age = computeAge({ day, month, year }, now);
    if (age === null || age > 120) return fail('dob', 'Tuổi không hợp lệ.');
    return pass({ day, month, year, age });
}

/** Tính tuổi phía backend từ ngày/tháng/năm (không tin age từ client). */
function computeAge({ day, month, year }, now = new Date()) {
    if (![day, month, year].every(Number.isInteger)) return null;
    let age = now.getFullYear() - year;
    const monthDiff = now.getMonth() + 1 - month;
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) age -= 1;
    return age < 0 ? null : age;
}

/**
 * Trạng thái xác thực do backend quyết định (mục 8).
 * Chỉ 3 tín hiệu đầu vào: emailVerified, phoneVerified, isSuspended/isLocked.
 */
function computeVerificationStatus({ emailVerified = false, phoneVerified = false, isSuspended = false, isLocked = false } = {}) {
    if (isLocked) return 'LOCKED';
    if (isSuspended) return 'SUSPENDED';
    if (emailVerified && phoneVerified) return 'VERIFIED';
    if (emailVerified && !phoneVerified) return 'PHONE_UNVERIFIED';
    if (!emailVerified && phoneVerified) return 'PARTIALLY_VERIFIED';
    return 'EMAIL_UNVERIFIED';
}

/**
 * Validate toàn bộ payload đăng ký v2 (mục 7).
 * Trả về { ok, values, errors } — values đã normalize; KHÔNG bao giờ đọc
 * các trường role/verified/emailVerified… từ client.
 */
function validateRegistration(payload = {}, { now = new Date() } = {}) {
    const fields = [
        ['fullName', validateFullName(payload.fullName)],
        ['email', validateEmail(payload.email)],
        ['phone', validatePhone(payload.phone)],
        ['gameId', validateGameId(payload.gameId)],
        ['dob', validateDob(payload.dobDay, payload.dobMonth, payload.dobYear, now)]
    ];
    const errors = [];
    const values = {};
    for (const [field, result] of fields) {
        if (!result.ok) errors.push({ field: result.field, message: result.message });
        else if (field === 'dob') Object.assign(values, { dob: { day: result.value.day, month: result.value.month, year: result.value.year }, age: result.value.age });
        else values[field] = result.value;
    }
    return errors.length ? { ok: false, errors } : { ok: true, values };
}

/** Validate cập nhật hồ sơ (PUT /api/profile) — không gồm email/phone/gameId (bảo mật). */
function validateProfileUpdate(payload = {}, { now = new Date() } = {}) {
    const errors = [];
    const values = {};
    if (payload.fullName !== undefined) {
        const result = validateFullName(payload.fullName);
        if (!result.ok) errors.push({ field: 'fullName', message: result.message });
        else values.fullName = result.value;
    }
    if (payload.dobDay !== undefined || payload.dobMonth !== undefined || payload.dobYear !== undefined) {
        const result = validateDob(payload.dobDay, payload.dobMonth, payload.dobYear, now);
        if (!result.ok) errors.push({ field: 'dob', message: result.message });
        else {
            values.dob = { day: result.value.day, month: result.value.month, year: result.value.year };
            values.age = result.value.age;
        }
    } else if (payload.clearDob === true) {
        values.dob = null;
        values.age = null;
    }
    if (payload.educationStatus !== undefined) {
        const status = String(payload.educationStatus || '');
        if (!EDUCATION_STATUSES.includes(status)) {
            errors.push({ field: 'educationStatus', message: 'Trình trạng học tập không hợp lệ.' });
        } else {
            values.educationStatus = status;
            if (status === 'studying') {
                const grade = Number(payload.educationGrade);
                if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
                    errors.push({ field: 'educationGrade', message: 'Lớp học phải từ 1 đến 12.' });
                } else {
                    values.educationGrade = grade;
                }
            } else {
                values.educationGrade = null;
            }
        }
    }
    return errors.length ? { ok: false, errors } : { ok: true, values };
}

module.exports = {
    VERIFICATION_STATUSES,
    EDUCATION_STATUSES,
    collapseWhitespace,
    validateFullName,
    validateEmail,
    validatePhone,
    validateGameId,
    validateDob,
    computeAge,
    computeVerificationStatus,
    validateRegistration,
    validateProfileUpdate
};