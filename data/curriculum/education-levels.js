'use strict';

/**
 * CẤP HỌC — phân lớp 1–12 thành các cấp.
 *
 * Tách riêng thành một mô-đun vì cả frontend lẫn backend đều cần biết một lớp
 * thuộc cấp nào. Nhờ vậy frontend KHÔNG phải viết kiểu `if (grade <= 5) ...`
 * mà vẫn hiển thị đúng tên cấp học.
 *
 * Lưu ý về dữ liệu: đây là **cấu trúc phân cấp**, không phải tên sách hay tên
 * bài. Tên cấp học là thuật ngữ chính thức của chương trình giáo dục Việt Nam:
 * tiểu học (1–5), trung học cơ sở (6–9), trung học phổ thông (10–12).
 */

const EDUCATION_LEVELS = Object.freeze([
    Object.freeze({
        id: 'primary',
        name: 'Tiểu học',
        shortName: 'Tiểu học',
        description: 'Lớp 1 đến lớp 5',
        gradeRange: [1, 5],
        stage: 'primary',
        source: 'CTGDPT-2018',
        verificationStatus: 'NEEDS_VERIFICATION'
    }),
    Object.freeze({
        id: 'middle',
        name: 'Trung học cơ sở',
        shortName: 'THCS',
        description: 'Lớp 6 đến lớp 9',
        gradeRange: [6, 9],
        stage: 'middle',
        source: 'CTGDPT-2018',
        verificationStatus: 'NEEDS_VERIFICATION'
    }),
    Object.freeze({
        id: 'high',
        name: 'Trung học phổ thông',
        shortName: 'THPT',
        description: 'Lớp 10 đến lớp 12',
        gradeRange: [10, 12],
        stage: 'high',
        source: 'CTGDPT-2018',
        verificationStatus: 'NEEDS_VERIFICATION'
    })
]);

/**
 * Cấp học của một lớp.
 * @param {number} grade lớp 1–12
 * @returns {object} mô tả cấp học
 */
function levelOfGrade(grade) {
    const level = Number(grade);
    const found = EDUCATION_LEVELS.find(item => level >= item.gradeRange[0] && level <= item.gradeRange[1]);
    // Lớp ngoài 1–12 không có trong chương trình; trả về cấp đầu để UI không vỡ.
    return found || EDUCATION_LEVELS[0];
}

/** Mã cấp học của một lớp. */
function levelIdOfGrade(grade) {
    return levelOfGrade(grade).id;
}

module.exports = { EDUCATION_LEVELS, levelIdOfGrade, levelOfGrade };