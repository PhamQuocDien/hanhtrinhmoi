'use strict';

/**
 * NĂM HỌC VÀ HỌC KỲ — khung thời gian dùng chung cho tiến độ và đánh giá.
 *
 * Tách riêng khỏi chính sách đánh giá vì nhiều nơi cần biết "học kỳ nào":
 * bài học, chương, bài kiểm tra giữa kỳ và cuối kỳ đều gắn với học kỳ.
 *
 * Quy ước mã học kỳ:
 *   1 = học kỳ 1, 2 = học kỳ 2
 *   sum = học kỳ sum (dùng cho cả năm, không tách đôi)
 *
 * Lưu ý: ngày bắt đầu năm học trong hệ thống là MẶC ĐỊNH vận hành của nền
 * tảng, KHÔNG phải quy định của Bộ GDĐT. Ngày lịch thi/kỳ thi do nhà trường
 * cung cấp nằm ở `assessment-policy`, không nằm ở đây.
 */

/** Học kỳ trong một năm học. */
const SEMESTERS = Object.freeze([
    Object.freeze({
        id: 1,
        code: 'semester-1',
        name: 'Học kỳ I',
        shortName: 'HK1',
        order: 1
    }),
    Object.freeze({
        id: 2,
        code: 'semester-2',
        name: 'Học kỳ II',
        shortName: 'HK2',
        order: 2
    }),
    Object.freeze({
        id: 'sum',
        code: 'summer',
        name: 'Học kỳ hè',
        shortName: 'HKHè',
        order: 3
    })
]);

/**
 * Năm học theo dạng `2025-2026`.
 *
 * @param {Date} date ngày cần xác định năm học
 * @returns {{id: string, startYear: number, label: string}}
 */
function academicYearOf(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    // Năm học bắt đầu từ 01/09. Tháng 9–12 thuộc năm học bắt đầu năm đó,
    // tháng 1–8 thuộc năm học bắt đầu năm trước.
    const month = value.getMonth() + 1;
    const year = value.getFullYear();
    const startYear = month >= 9 ? year : year - 1;
    return {
        id: `${startYear}-${startYear + 1}`,
        startYear,
        label: `Năm học ${startYear}-${startYear + 1}`
    };
}

/**
 * Học kỳ hiện tại theo tháng.
 *
 * @param {Date} [date] ngày xác định
 * @returns {object} mô tả học kỳ
 */
function currentSemester(date = new Date()) {
    const month = (date instanceof Date ? date : new Date(date)).getMonth() + 1;
    if (month >= 9 || month <= 1) return SEMESTERS[0];
    if (month <= 6) return SEMESTERS[1];
    return SEMESTERS[2];
}

/** Mã học kỳ hiện tại (1 | 2 | 'sum'). */
function currentSemesterId(date = new Date()) {
    return currentSemester(date).id;
}

/**
 * Học kỳ theo mã.
 *
 * @param {number|string} id mã học kỳ
 * @returns {object|null}
 */
function findSemester(id) {
    const key = String(id);
    return SEMESTERS.find(item => String(item.id) === key) || null;
}

/** Chuẩn hoá mọi giá trị học kỳ về mã hợp lệ, mặc định là học kỳ hiện tại. */
function normalizeSemester(id) {
    return findSemester(id)?.id ?? currentSemesterId();
}

module.exports = {
    SEMESTERS,
    academicYearOf,
    currentSemester,
    currentSemesterId,
    findSemester,
    normalizeSemester
};