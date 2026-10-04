/**
 * TRANG CHỦ — chọn lớp và điều hướng theo vai trò.
 *
 * Trang này KHÔNG nạp toàn bộ chương trình hay ngân hàng câu hỏi: chỉ gọi
 * /api/student/curriculum/grades (12 dòng) để dựng bộ chọn lớp. Nhờ vậy trang
 * chủ mở nhanh và không kéo theo dữ liệu lớn.
 */

import { studentApi, currentUser, AUTH_PATHS, homePathFor, ApiError } from '../core/api.js';
import { createElement, render, message, formatNumber } from '../core/dom.js';

const picker = document.getElementById('grade-picker');
const actionsBox = document.getElementById('home-actions');
const noteBox = document.getElementById('curriculum-note');

/** Nút đăng nhập / vào bảng điều khiển tuỳ theo trạng thái phiên. */
async function renderActions() {
    const user = await currentUser();
    render(actionsBox, createElement('a', {
        className: 'btn btn-primary',
        text: user ? 'Vào bảng điều khiển' : 'Đăng nhập',
        href: user ? homePathFor(user.role) : AUTH_PATHS.login
    }));

    if (!user) {
        render(actionsBox, createElement('a', {
            className: 'btn btn-secondary',
            text: 'Đăng ký',
            href: AUTH_PATHS.register
        }));
    }
}

/** Dựng lưới 12 thẻ lớp. */
function renderGrades(grades) {
    picker.setAttribute('aria-busy', 'false');
    render(picker, ...grades.map(grade => createElement('a', {
        className: 'tile',
        href: `/student/subjects.html?grade=${grade.grade}`,
        children: [
            createElement('p', { className: 'tile-icon', attrs: { 'aria-hidden': 'true' }, text: `Lớp ${grade.grade}` }),
            createElement('p', { className: 'tile-title', text: grade.gradeName || `Lớp ${grade.grade}` }),
            createElement('p', {
                className: 'tile-meta',
                text: [
                    `${formatNumber(grade.subjectCount)} môn`,
                    `${formatNumber(grade.lessonCount)} bài`
                ].join(' · ')
            })
        ]
    })));
}

/** Hiển thị ghi chú về trạng thái xác minh của dữ liệu chương trình. */
function renderNote(overview) {
    if (!overview) return;
    render(noteBox,
        `Chương trình ${overview.curriculumVersion} · `,
        createElement('strong', {
            text: `${formatNumber(overview.subjectCount)} môn, ${formatNumber(overview.lessonCount)} bài học`
        }),
        overview.pendingImportCount
            ? ` · ${formatNumber(overview.pendingImportCount)} môn chờ nhập nội dung bài học`
            : '',
        '. ',
        overview.verificationStatus !== 'VERIFIED'
            ? 'Tên bài học đang chờ đối chiếu với bản in sách giáo khoa.'
            : ''
    );
}

document.addEventListener('DOMContentLoaded', async () => {
    renderActions();

    try {
        // Hai lời gọi độc lập: bộ chọn lớp hiện ngay, ghi chú chương trình sau.
        const grades = await studentApi.getGrades();
        renderGrades(grades);
        studentApi.getOverview().then(renderNote).catch(() => {});
    } catch (error) {
        picker.setAttribute('aria-busy', 'false');
        const text = error instanceof ApiError
            ? error.message
            : 'Không tải được danh sách lớp. Vui lòng tải lại trang.';
        render(picker, message(text, 'error'));
    }
});