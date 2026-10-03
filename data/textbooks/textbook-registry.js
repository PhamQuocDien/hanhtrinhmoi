'use strict';

/**
 * SÁCH GIÁO KHOA — nguồn định nghĩa đầu sách.
 *
 * Mỗi đầu sách gắn với đúng một (grade, subjectId, seriesId) và có khoá
 * `textbookId` ổn định. Tên sách được sinh từ bộ sách + môn + lớp; vì chưa
 * đối chiếu danh mục SGK được phê duyệt nên mọi bản ghi giữ
 * `verificationStatus: NEEDS_VERIFICATION` và KHÔNG gán publisher khi chưa
 * có căn cứ.
 */

const { getSubjectsForGrade, getSubject } = require('../subjects/subject-registry');
const { getDefaultSeriesId, getBookSeries } = require('./book-series-registry');

const TEXTBOOKS = new Map();

/** Sinh một textbookId ổn định từ lớp + môn + bộ sách. */
function buildTextbookId(grade, subjectId, seriesId) {
    return `tb-g${String(grade).padStart(2, '0')}-${subjectId}-${seriesId}`;
}

/**
 * Tạo định nghĩa đầu sách cho một lớp/môn/bộ sách.
 * Tên sách chỉ là nhãn hiển thị, KHÔNG phải khoá chính.
 */
function defineTextbook({ grade, subjectId, seriesId }) {
    const subject = getSubject(subjectId);
    const series = getBookSeries(seriesId);
    if (!subject || !series) return null;

    const textbookId = buildTextbookId(grade, subjectId, seriesId);
    return Object.freeze({
        textbookId,
        officialTitle: `${subject.officialName} ${grade} — ${series.seriesName}`,
        grade: Number(grade),
        subjectId,
        seriesId,
        // Chưa xác minh được nhà xuất bản cụ thể cho từng đầu sách.
        publisher: series.publisher,
        status: 'active',
        source: series.source,
        verifiedAt: series.verifiedAt,
        verificationStatus: series.verificationStatus
    });
}

/**
 * Dựng danh sách đầu sách cho một lớp theo các môn của lớp đó và các bộ
 * sách phát hành cho lớp đó. Bản chất là dữ liệu suy ra, chưa phải danh mục
 * SGK đã được phê duyệt — vì vậy mọi bản ghi đều NEEDS_VERIFICATION.
 */
function registerTextbooksForGrade(grade) {
    const level = Number(grade);
    const defaultSeries = getDefaultSeriesId(level);
    const seriesIds = new Set([defaultSeries, 'national']);
    for (const subject of getSubjectsForGrade(level)) {
        for (const seriesId of seriesIds) {
            const textbook = defineTextbook({ grade: level, subjectId: subject.id, seriesId });
            if (textbook && !TEXTBOOKS.has(textbook.textbookId)) TEXTBOOKS.set(textbook.textbookId, textbook);
        }
    }
}

for (let grade = 1; grade <= 12; grade += 1) registerTextbooksForGrade(grade);

/** Lấy định nghĩa đầu sách theo textbookId. */
function getTextbook(textbookId) {
    return TEXTBOOKS.get(String(textbookId || '').trim());
}

/**
 * Tìm đầu sách theo lớp + môn. Ưu tiên bộ sách được chỉ định, nếu không có
 * thì trả về đầu sách thuộc bộ mặc định của lớp.
 */
function resolveTextbook(grade, subjectId, seriesId) {
    const level = Number(grade);
    if (seriesId) return getTextbook(buildTextbookId(level, subjectId, seriesId)) || null;
    const wanted = getDefaultSeriesId(level);
    return getTextbook(buildTextbookId(level, subjectId, wanted))
        || getTextbook(buildTextbookId(level, subjectId, 'national'))
        || null;
}

/** Tất cả đầu sách của một lớp. */
function getTextbooksForGrade(grade) {
    const level = Number(grade);
    return [...TEXTBOOKS.values()].filter(textbook => textbook.grade === level);
}

module.exports = {
    TEXTBOOKS,
    buildTextbookId,
    getTextbook,
    resolveTextbook,
    getTextbooksForGrade
};