/**
 * TRANG CHƯƠNG TRÌNH (quản trị).
 *
 * Xem cấu trúc chương trình theo lớp: môn học, bộ sách, chương và bài học —
 * kèm trạng thái xác minh của từng bài.
 *
 * Đây là trang XEM và ĐỐI CHIẾU. Dữ liệu chương trình nằm trong data/curriculum/
 * và data/textbooks/; mọi mục chưa đối chiếu với bản in sách giáo khoa đều mang
 * nhãn NEEDS_VERIFICATION và không được tự động nâng thành VERIFIED.
 */

import { studentApi } from '../core/api.js';
import {
    createElement,
    render,
    message,
    formatNumber,
    verificationBadge
} from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const root = document.getElementById('curriculum-root');
const gradeSelect = document.getElementById('grade');
const keywordInput = document.getElementById('keyword');

/** Lọc danh sách môn theo từ khoá (không phân biệt hoa thường). */
function filterSubjects(subjects, keyword) {
    if (!keyword) return subjects;
    const needle = keyword.toLowerCase();
    return subjects.filter(subject => (
        subject.displayName.toLowerCase().includes(needle)
        || subject.subjectId.toLowerCase().includes(needle)
    ));
}

/** Dựng một thẻ môn học kèm chương và bài học. */
function subjectCard(grade, subject) {
    return createElement('section', { className: 'card', children: [
        createElement('h2', { className: 'card-title', text: `${subject.icon || ''} ${subject.displayName}` }),
        createElement('p', { className: 'small muted', children: [
            createElement('span', {
                text: `${subject.statusLabel || subject.status} · `
                    + `${formatNumber(subject.chapterCount)} chương · ${formatNumber(subject.lessonCount)} bài · `
            }),
            verificationBadge(subject.verificationStatus)
        ] }),
        ...(subject.chapters || []).map(chapter => createElement('details', { className: 'stack', children: [
            createElement('summary', { text: `Chương ${chapter.chapterNumber}: ${chapter.displayTitle} (${formatNumber(chapter.lessonCount)} bài)` }),
            createElement('ul', { children: (chapter.lessons || []).map(lesson => createElement('li', {
                children: [
                    createElement('span', { text: `${lesson.lessonNumber}. ${lesson.displayTitle}` }),
                    ' ',
                    verificationBadge(lesson.verificationStatus),
                    lesson.contentStatus === 'EMPTY'
                        ? createElement('span', { className: 'badge badge-warning', text: 'chưa có nội dung' })
                        : null
                ].filter(Boolean)
            })) })
        ] }))
    ] });
}

startAdminPage(async () => {
    const grades = await studentApi.getGrades();
    render(gradeSelect, ...grades.map(grade => createElement('option', {
        text: grade.gradeName || `Lớp ${grade.grade}`,
        attrs: { value: grade.grade }
    })));

    /** Nạp và dựng chương trình của lớp đang chọn. */
    async function load() {
        const grade = Number(gradeSelect.value);
        root.setAttribute('aria-busy', 'true');
        render(root, message('Đang tải chương trình…', 'info'));

        try {
            // `withLessons=1` để lấy kèm chương và bài trong một lần gọi.
            const subjects = filterSubjects(
                await studentApi.getSubjects(grade, true),
                keywordInput.value.trim().toLowerCase()
            );

            if (!subjects.length) {
                render(root, message('Không có môn học khớp bộ lọc.', 'info'));
                return;
            }
            render(root, ...subjects.map(subject => subjectCard(grade, subject)));
        } catch (error) {
            render(root, message(error.message || 'Không tải được chương trình.', 'error'));
        } finally {
            root.setAttribute('aria-busy', 'false');
        }
    }

    await load();
    gradeSelect.addEventListener('change', load);
    keywordInput.addEventListener('input', load);
});