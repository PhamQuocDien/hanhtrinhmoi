/**
 * TRANG CHỌN MÔN HỌC.
 *
 * Hiển thị môn học theo lớp. Lớp đến từ tham số `?grade=`; nếu không có thì lấy
 * lớp trong hồ sơ tài khoản. Đổi lớp chỉ cần đổi tham số, không tải lại trang.
 */

import { studentApi, authApi, requireUser } from '../core/api.js';
import {
    createElement,
    render,
    message,
    renderShell,
    STUDENT_MENU,
    queryParam,
    verificationBadge,
    formatNumber
} from '../core/dom.js';

const gradeSelect = document.getElementById('grade');
const listBox = document.getElementById('subject-list');

/** Đổ danh sách 12 lớp vào ô chọn và chọn lớp đang xem. */
function fillGrades(grades, currentGrade) {
    render(gradeSelect, ...grades.map(grade => createElement('option', {
        text: grade.gradeName || `Lớp ${grade.grade}`,
        attrs: { value: grade.grade, selected: grade.grade === currentGrade }
    })));
}

/** Một thẻ môn học, kèm các bộ sách đang có cho môn đó. */
function subjectTile(grade, subject) {
    const series = (subject.availableSeries || [])
        .map(item => item.seriesName)
        .join(', ');

    return createElement('a', {
        className: 'tile',
        href: `/student/curriculum.html?grade=${grade}&subjectId=${encodeURIComponent(subject.subjectId)}`,
        children: [
            createElement('p', { className: 'tile-icon', attrs: { 'aria-hidden': 'true' }, text: subject.icon || '📘' }),
            createElement('p', { className: 'tile-title', text: subject.displayName }),
            createElement('p', {
                className: 'tile-meta',
                text: `${formatNumber(subject.chapterCount)} chương · ${formatNumber(subject.lessonCount)} bài`
            }),
            createElement('p', { className: 'tile-meta', text: `Trạng thái: ${subject.statusLabel || subject.status}` }),
            series ? createElement('p', { className: 'tile-meta', text: `Bộ sách: ${series}` }) : null,
            verificationBadge(subject.verificationStatus),
            // Môn chưa có tên bài: nói rõ thay vì hiển thị danh sách rỗng.
            subject.needsLessonImport
                ? createElement('p', { className: 'small muted', text: 'Chưa có nội dung bài học.' })
                : null
        ].filter(Boolean)
    });
}

/** Nạp và dựng danh sách môn của một lớp. */
async function loadSubjects(grade) {
    listBox.setAttribute('aria-busy', 'true');
    render(listBox, message('Đang tải môn học…', 'info'));

    try {
        const subjects = await studentApi.getSubjects(grade);
        if (!subjects.length) {
            render(listBox, message('Lớp này chưa có môn học.', 'info'));
            return;
        }
        render(listBox, createElement('div', {
            className: 'grid',
            children: subjects.map(subject => subjectTile(grade, subject))
        }));
    } catch (error) {
        render(listBox, message(error.message || 'Không tải được môn học.', 'error'));
    } finally {
        listBox.setAttribute('aria-busy', 'false');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireUser();
    if (!user) return;

    renderShell({
        user,
        menu: STUDENT_MENU,
        onLogout: async () => {
            await authApi.logout();
            window.location.href = '/auth/login.html';
        }
    });

    const grades = await studentApi.getGrades();
    const requested = Number(queryParam('grade'));
    const grade = requested || Number(user.grade) || grades[0]?.grade;

    fillGrades(grades, grade);
    await loadSubjects(grade);

    gradeSelect.addEventListener('change', () => {
        const next = gradeSelect.value;
        // Cập nhật URL để người dùng sao chép được link tới đúng lớp.
        window.history.replaceState(null, '', `?grade=${next}`);
        loadSubjects(Number(next));
    });
});