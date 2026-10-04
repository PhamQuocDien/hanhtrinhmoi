/**
 * TRANG BÀI HỌC (quản trị).
 *
 * Liệt kê toàn bộ bài học của lớp/môn đang chọn, kèm mã bài, chương, trạng thái
 * nội dung và trạng thái xác minh — đây là danh sách dùng để đối chiếu với bản
 * in sách giáo khoa trước khi đánh dấu VERIFIED.
 */

import { studentApi } from '../core/api.js';
import {
    createElement,
    render,
    message,
    verificationBadge
} from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const tbody = document.getElementById('lessons-body');
const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subjectId');
const statusSelect = document.getElementById('status');

/** Lọc bài học theo trạng thái nội dung / xác minh đang chọn. */
function matchesStatus(lesson, status) {
    if (!status) return true;
    if (status === 'empty') return lesson.contentStatus === 'EMPTY';
    if (status === 'pending') return lesson.verificationStatus !== 'VERIFIED';
    return true;
}

/** Một dòng của bảng bài học. */
function lessonRow(lesson) {
    return createElement('tr', { children: [
        createElement('td', { text: lesson.lessonCode || lesson.lessonId }),
        createElement('td', { text: lesson.displayTitle }),
        createElement('td', { text: lesson.chapterTitle || '—' }),
        createElement('td', {
            children: [lesson.contentStatus === 'EMPTY'
                ? createElement('span', { className: 'badge badge-warning', text: 'Chưa có nội dung' })
                : createElement('span', { className: 'badge badge-success', text: lesson.contentStatus })]
        }),
        createElement('td', { children: [verificationBadge(lesson.verificationStatus)] })
    ] });
}

startAdminPage(async () => {
    const grades = await studentApi.getGrades();
    render(gradeSelect, ...grades.map(grade => createElement('option', {
        text: grade.gradeName || `Lớp ${grade.grade}`,
        attrs: { value: grade.grade }
    })));

    /** Nạp danh sách bài học của lớp/môn đang chọn. */
    async function load() {
        const grade = Number(gradeSelect.value);
        tbody.setAttribute('aria-busy', 'true');
        render(tbody, createElement('tr', {
            children: [createElement('td', { className: 'muted', text: 'Đang tải…', attrs: { colspan: 5 } })]
        }));

        try {
            const subjectId = subjectSelect.value;
            const subjects = await studentApi.getSubjects(grade);
            const targets = subjectId ? subjects.filter(item => item.subjectId === subjectId) : subjects;

            // Duyệt từng môn để lấy danh sách bài học đầy đủ.
            const rows = [];
            for (const subject of targets) {
                const detail = await studentApi.getSubject(grade, subject.subjectId);
                for (const chapter of detail.chapters || []) {
                    for (const lesson of chapter.lessons || []) {
                        rows.push({ ...lesson, chapterTitle: chapter.displayTitle });
                    }
                }
            }

            const filtered = rows.filter(lesson => matchesStatus(lesson, statusSelect.value));
            if (!filtered.length) {
                render(tbody, createElement('tr', {
                    children: [createElement('td', {
                        className: 'muted',
                        text: 'Không có bài học khớp bộ lọc.',
                        attrs: { colspan: 5 }
                    })]
                }));
                return;
            }

            render(tbody, ...filtered.map(lessonRow));
        } catch (error) {
            render(tbody, createElement('tr', {
                children: [createElement('td', {
                    className: 'message message-error',
                    text: error.message || 'Không tải được danh sách bài học.',
                    attrs: { colspan: 5 }
                })]
            }));
        } finally {
            tbody.removeAttribute('aria-busy');
        }
    }

    /** Nạp danh sách môn của lớp đang chọn. */
    async function loadSubjects() {
        const subjects = await studentApi.getSubjects(Number(gradeSelect.value));
        render(subjectSelect,
            createElement('option', { text: 'Tất cả môn', attrs: { value: '' } }),
            ...subjects.map(subject => createElement('option', {
                text: subject.displayName,
                attrs: { value: subject.subjectId }
            }))
        );
    }

    gradeSelect.addEventListener('change', async () => {
        await loadSubjects();
        load();
    });
    subjectSelect.addEventListener('change', load);
    statusSelect.addEventListener('change', load);

    await loadSubjects();
    await load();
});