/**
 * LỚP ĐỆM DỮ LIỆU CHƯƠNG TRÌNH — gom các lời gọi API chương trình thành một nơi.
 *
 * Mục đích:
 *   - Giao diện gọi `curriculumService.getSeries(...)` thay vì ghép tay URL.
 *   - Đổi endpoint hoặc thêm bộ nhớ tạm chỉ sửa tệp này.
 *   - Chuẩn hoá lỗi để mọi màn hình báo "không tải được" giống nhau.
 */

import { studentApi } from '../core/api.js';

/**
 * Danh sách lớp. Trả về mảng rỗng thay vì ném lỗi để màn hình tự hiện trạng
 * thái rỗng kèm lý do.
 */
export async function getGrades() {
    const grades = await studentApi.getGrades();
    return Array.isArray(grades) ? grades : [];
}

/** Cấp học (tiểu học / THCS / THPT) kèm các lớp thuộc cấp. */
export async function getEducationLevels() {
    const levels = await studentApi.getEducationLevels();
    return Array.isArray(levels) ? levels : [];
}

/** Danh sách môn của một lớp. */
export async function getSubjects(grade) {
    const subjects = await studentApi.getSubjects(grade);
    return Array.isArray(subjects) ? subjects : [];
}

/**
 * Các bộ sách dùng cho một môn trong một lớp.
 *
 * Hàm này là nguồn duy nhất cho danh sách "chọn bộ sách". Nó KHÔNG trả về danh
 * sách cố định: mọi bộ sách đều đến từ dữ liệu chương trình.
 *
 * @returns {Promise<Array>} danh sách bộ sách, mỗi bộ kèm `textbooks`
 */
export async function getTextbookSeries(grade, subjectId) {
    const result = await studentApi.getSeries(grade, subjectId);
    return Array.isArray(result?.series) ? result.series : [];
}

/** Đầu sách của một bộ sách trong môn/lớp đã chọn. */
export async function getTextbooks(grade, subjectId, seriesId) {
    const result = await studentApi.getSeries(grade, subjectId);
    const series = (Array.isArray(result?.series) ? result.series : [])
        .find(item => item.seriesId === seriesId);
    return series?.textbooks || [];
}

/**
 * Chương và bài của một môn theo bộ sách đã chọn.
 *
 * Khi bộ sách chưa có đầu sách, kết quả vẫn được trả về với `hasContent: false`
 * để giao diện hiện đúng trạng thái thay vì bịa nội dung.
 */
export async function getChapters(grade, subjectId, seriesId) {
    return studentApi.getChapters(grade, subjectId, seriesId);
}

/** Chi tiết một môn kèm chương và bài. */
export async function getSubject(grade, subjectId) {
    return studentApi.getSubject(grade, subjectId);
}

/** Chi tiết một bài học. */
export async function getLesson(lessonId) {
    return studentApi.getLesson(lessonId);
}

/**
 * Đường dẫn sang trang bài học, giữ nguyên ngữ cảnh lớp/môn/bộ sách để quay lại.
 *
 * @param {object} context lớp, môn, bộ sách hiện tại
 * @param {string} lessonId khoá bài học
 * @returns {string} URL tương đối
 */
export function lessonHref(context, lessonId) {
    const params = new URLSearchParams();
    if (context?.grade) params.set('grade', String(context.grade));
    if (context?.subjectId) params.set('subjectId', context.subjectId);
    if (context?.seriesId) params.set('seriesId', context.seriesId);
    params.set('lessonId', lessonId);
    return `/student/lesson.html?${params.toString()}`;
}

/** Đường dẫn sang trang luyện tập, giữ ngữ cảnh lớp/môn. */
export function practiceHref(context) {
    const params = new URLSearchParams();
    if (context?.grade) params.set('grade', String(context.grade));
    if (context?.subjectId) params.set('subjectId', context.subjectId);
    if (context?.seriesId) params.set('seriesId', context.seriesId);
    return `/student/practice.html?${params.toString()}`;
}

export const curriculumService = {
    getChapters,
    getEducationLevels,
    getGrades,
    getLesson,
    getSubject,
    getSubjects,
    getTextbookSeries,
    getTextbooks,
    lessonHref,
    practiceHref
};

export default curriculumService;
