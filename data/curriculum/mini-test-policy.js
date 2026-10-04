'use strict';

/**
 * CẤU HÌNH MINI TEST — bài kiểm tra cuối mỗi bài học.
 *
 * Tách thành mô-đun dữ liệu riêng để:
 *   - quản trị viên đổi cấu hình mà không sửa mã;
 *   - mỗi con số đều mang nguồn và trạng thái xác minh.
 *
 * Cần nhấn mạnh: các ngưỡng dưới đây là quy ước của nền tảng, KHÔNG phải quy
 * định của Bộ GDĐT. Bộ chưa quy định số câu mini test cho từng môn, nên mọi
 * bản ghi đều ở trạng thái `NEEDS_VERIFICATION`.
 */

/** Cấu hình mặc định áp dụng cho mọi lớp/môn. */
const DEFAULT_MINI_TEST_CONFIG = Object.freeze({
    title: 'Kiểm tra cuối bài',
    // Số câu lấy từ kho câu hỏi của bài học; nếu bài có ít hơn thì lấy hết.
    questionCount: 5,
    // Tỉ lệ (%) để coi là đạt mini test.
    passPercent: 60,
    // Số lần được làm lại. Làm lại không làm mất kết quả tốt nhất.
    maxAttempts: 3,
    source: 'Mặc định vận học của nền tảng Hành Tinh Mơ Ước',
    verificationStatus: 'NEEDS_VERIFICATION',
    isOfficialRegulation: false
});

/** Cấu hình ghi đè theo (lớp, môn). */
const OVERRIDES = new Map();

/** Khoá ghi đè. */
function overrideKey({ grade, subjectId = '*' }) {
    return [Number(grade), subjectId].join('|');
}

/**
 * Thêm hoặc cập nhật cấu hình mini test.
 *
 * @param {object} input cấu hình
 * @returns {object} cấu hình đã lưu
 */
function upsertMiniTestConfig(input) {
    const key = overrideKey(input);
    const config = {
        ...DEFAULT_MINI_TEST_CONFIG,
        ...Object.fromEntries(
            Object.entries(input).filter(([name]) => name !== 'grade' && name !== 'subjectId')
        ),
        grade: Number(input.grade),
        subjectId: input.subjectId === '*' ? null : input.subjectId
    };
    OVERRIDES.set(key, Object.freeze(config));
    return config;
}

/** Xoá cấu hình ghi đè (dùng khi kiểm thử). */
function clearMiniTestConfigs() {
    OVERRIDES.clear();
}

/** Tất cả cấu hình ghi đè. */
function listMiniTestConfigs() {
    return [...OVERRIDES.values()];
}

/**
 * Cấu hình áp dụng cho một lớp/môn.
 *
 * Ưu tiên (lớp, môn) > (lớp) > mặc định.
 *
 * @param {object} scope lớp và môn
 * @returns {object} cấu hình
 */
function resolveMiniTestConfig({ grade, subjectId = '*' } = {}) {
    const specific = OVERRIDES.get(overrideKey({ grade, subjectId }));
    if (specific) return specific;
    const byGrade = OVERRIDES.get(overrideKey({ grade }));
    return byGrade || DEFAULT_MINI_TEST_CONFIG;
}

module.exports = {
    DEFAULT_MINI_TEST_CONFIG,
    clearMiniTestConfigs,
    listMiniTestConfigs,
    resolveMiniTestConfig,
    upsertMiniTestConfig
};