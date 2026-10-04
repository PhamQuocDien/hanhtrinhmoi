'use strict';

/**
 * LỊCH HỌC KỲ VÀ MỐC KIỂM TRA TRONG NĂM — quy ước vận hành của nền tảng.
 *
 * Vì sao tách thành mô-đun riêng:
 *   - Trước đây `server.js` ghi thẳng hằng số `[9, 18, 27, 35]` ngay trong
 *     route, khiến không ai biết con số đó từ đâu ra và dễ bị sửa lệch chỗ.
 *   - Mốc đánh giá còn có một nguồn thứ hai là `assessment-policy-registry`
 *     (ngưỡng theo SỐ BÀI đã học). Hai nơi phải cùng một bộ quy tắc.
 *
 * Lưu ý quan trọng: những con số ở đây là **quy ước của nền tảng**, KHÔNG phải
 * quy định của Bộ GDĐT. Ngày lịch thi thật do nhà trường cung cấp thuộc về
 * `assessment-policy` với `sourceKind: SCHOOL_SCHEDULE`.
 */

/** Số tuần học trong một năm học (tương đương 35 tuần, chia đều hai học kỳ). */
const WEEKS_PER_SCHOOL_YEAR = 35;

/**
 * Tuần bắt đầu của từng mốc checkpoint trong năm học.
 *
 * Mốc đầu tiên rơi vào khoảng 1/4 năm học, các mốc sau cách đều nhau — tương
 * ứng với 4 lần đánh giá giữa năm.
 */
const CHECKPOINT_WEEKS = Object.freeze([9, 18, 27, 35]);

/** Mốc tuần kết thúc từng giai đoạn học, dùng để gắn nhãn tiến độ. */
const PHASE_BOUNDS = Object.freeze([
    { untilWeek: 8, label: 'Học kỳ I • Giai đoạn 1' },
    { untilWeek: 18, label: 'Học kỳ I • Củng cố' },
    { untilWeek: 27, label: 'Học kỳ II • Giai đoạn 1' },
    { untilWeek: 35, label: 'Học kỳ II • Tổng kết' }
]);

/**
 * Nhãn giai đoạn của một tuần học.
 *
 * @param {number} week tuần thứ mấy trong năm học (1-based)
 * @returns {string} tên giai đoạn
 */
function phaseOfWeek(week) {
    const phase = PHASE_BOUNDS.find(item => week <= item.untilWeek);
    return phase ? phase.label : PHASE_BOUNDS[PHASE_BOUNDS.length - 1].label;
}

/**
 * Dựng lịch học kỳ của một lớp.
 *
 * @param {object} options đầu vào
 * @param {number} options.totalLessons tổng số bài trong lớp
 * @returns {Array<object>} danh sách tuần kèm mốc và mục tiêu
 */
function buildWeekPlan({ totalLessons = 0 }) {
    const lessons = Math.max(0, Number(totalLessons) || 0);
    return Array.from({ length: WEEKS_PER_SCHOOL_YEAR }, (_, index) => {
        const week = index + 1;
        return {
            week,
            phase: phaseOfWeek(week),
            targetLessons: Math.max(1, Math.round(lessons / WEEKS_PER_SCHOOL_YEAR)),
            checkpoint: CHECKPOINT_WEEKS.includes(week)
        };
    });
}

/**
 * Số bài nên hoàn thành tính đến tuần hiện tại.
 *
 * @param {number} totalLessons tổng số bài
 * @param {number} currentWeek tuần hiện tại
 * @returns {number} số bài kỳ vọng
 */
function expectedLessonsAtWeek(totalLessons, currentWeek) {
    const lessons = Math.max(0, Number(totalLessons) || 0);
    const week = Math.max(1, Math.min(WEEKS_PER_SCHOOL_YEAR, currentWeek));
    return Math.min(lessons, Math.round(lessons * week / WEEKS_PER_SCHOOL_YEAR));
}

/** Gộp tuần hiện tại về khoảng hợp lệ của năm học. */
function clampWeek(week) {
    const value = Number(week);
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(WEEKS_PER_SCHOOL_YEAR, Math.round(value)));
}

module.exports = {
    CHECKPOINT_WEEKS,
    PHASE_BOUNDS,
    WEEKS_PER_SCHOOL_YEAR,
    buildWeekPlan,
    clampWeek,
    expectedLessonsAtWeek,
    phaseOfWeek
};