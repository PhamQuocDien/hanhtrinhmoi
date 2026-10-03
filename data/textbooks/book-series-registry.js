'use strict';

/**
 * BỘ SÁCH GIÁO KHOA — nguồn định nghĩa bộ sách (series).
 *
 * Hệ thống hỗ trợ mô hình "một chương trình, nhiều bộ sách": cùng một môn/lớp
 * có thể dùng SGK của nhiều nhà xuất bản khác nhau. Vì vậy `seriesId` mới là
 * khóa chính, KHÔNG gộp "book = Toán lớp 8" làm một chuỗi.
 *
 * Mỗi bộ đều có `source` + `verificationStatus`. Tên bộ/nhà xuất bản chưa được
 * đối chiếu danh mục sách giáo khoa được phê duyệt thì giữ NEEDS_VERIFICATION.
 */

const { CURRICULUM_VERSION } = require('../subjects/subject-registry');

/**
 * seriesId            - khoá ổn định
 * seriesName          - tên bộ sách
 * publisher           - nhà xuất bản
 * grades              - các lớp bộ phát hành
 * defaultForGrades    - bộ mặc định nếu chưa cấu hình (null = không mặc định)
 */
const BOOK_SERIES = Object.freeze([
    {
        seriesId: 'national',
        seriesName: 'Sách giáo khoa theo chương trình chung',
        publisher: null,
        grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        defaultForGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        status: 'active',
        source: `${CURRICULUM_VERSION} — bám yêu cầu cần đạt, không sao chép nguyên văn SGK`,
        verifiedAt: null,
        verificationStatus: 'NEEDS_VERIFICATION'
    },
    {
        seriesId: 'ket-noi-tri-thuc-cuoc-song',
        seriesName: 'Kết nối tri thức với cuộc sống',
        publisher: null,
        grades: [1, 2, 3, 4, 5],
        defaultForGrades: null,
        status: 'active',
        source: 'Danh mục sách giáo khoa được phê duyệt — cần đối chiếu lại từng đầu sách',
        verifiedAt: null,
        verificationStatus: 'NEEDS_VERIFICATION'
    },
    {
        seriesId: 'chan-troi-sang-tao',
        seriesName: 'Chân trời sáng tạo',
        publisher: null,
        grades: [1, 2, 3, 4, 5],
        defaultForGrades: null,
        status: 'active',
        source: 'Danh mục sách giáo khoa được phê duyệt — cần đối chiếu lại từng đầu sách',
        verifiedAt: null,
        verificationStatus: 'NEEDS_VERIFICATION'
    },
    {
        seriesId: 'canh-dieu',
        seriesName: 'Cánh Diều',
        publisher: null,
        grades: [1, 2, 3, 4, 5, 6],
        defaultForGrades: null,
        status: 'active',
        source: 'Danh mục sách giáo khoa được phê duyệt — cần đối chiếu lại từng đầu sách',
        verifiedAt: null,
        verificationStatus: 'NEEDS_VERIFICATION'
    }
]);

const SERIES_BY_ID = new Map(BOOK_SERIES.map(series => [series.seriesId, series]));
const DEFAULT_SERIES_BY_GRADE = new Map();
for (const series of BOOK_SERIES) {
    for (const grade of series.defaultForGrades || []) DEFAULT_SERIES_BY_GRADE.set(grade, series.seriesId);
}

/** Lấy định nghĩa bộ sách theo seriesId. */
function getBookSeries(seriesId) {
    return SERIES_BY_ID.get(String(seriesId || '').trim());
}

/** Danh sách bộ sách phát hành cho một lớp. */
function getSeriesForGrade(grade) {
    const level = Number(grade);
    return BOOK_SERIES.filter(series => series.grades.includes(level));
}

/** seriesId mặc định của một lớp (luôn có để hệ thống không bị trống). */
function getDefaultSeriesId(grade) {
    return DEFAULT_SERIES_BY_GRADE.get(Number(grade)) || 'national';
}

module.exports = {
    BOOK_SERIES,
    getBookSeries,
    getSeriesForGrade,
    getDefaultSeriesId
};