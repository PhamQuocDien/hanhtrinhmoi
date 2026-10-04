/**
 * TRANG CHƯƠNG (quản trị).
 *
 * Liệt kê chương của các môn trong lớp đang chọn, kèm mã chương, số thứ tự và
 * số bài học — dùng để đối chiếu cấu trúc với bản in sách giáo khoa.
 */

import { studentApi } from '../core/api.js';
import { createElement, render, formatNumber } from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const tbody = document.getElementById('chapters-body');
const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subjectId');

startAdminPage(async () => {
    const grades = await studentApi.getGrades();
    render(gradeSelect, ...grades.map(grade => createElement('option', {
        text: grade.gradeName || `Lớp ${grade.grade}`,
        attrs: { value: grade.grade }
    })));

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

    /** Nạp danh sách chương theo bộ lọc. */
    async function load() {
        const grade = Number(gradeSelect.value);
        tbody.setAttribute('aria-busy', 'true');
        render(tbody, createElement('tr', {
            children: [createElement('td', { className: 'muted', text: 'Đang tải…', attrs: { colspan: 6 } })]
        }));

        try {
            const subjects = await studentApi.getSubjects(grade);
            const targets = subjectSelect.value
                ? subjects.filter(item => item.subjectId === subjectSelect.value)
                : subjects;

            const rows = [];
            for (const subject of targets) {
                const detail = await studentApi.getSubject(grade, subject.subjectId);
                for (const chapter of detail.chapters || []) {
                    rows.push({ ...chapter, subjectName: detail.displayName, textbook: detail.textbook });
                }
            }

            if (!rows.length) {
                render(tbody, createElement('tr', {
                    children: [createElement('td', { className: 'muted', text: 'Không có chương nào.', attrs: { colspan: 6 } })]
                }));
                return;
            }

            render(tbody, ...rows.map(chapter => createElement('tr', { children: [
                createElement('td', { text: chapter.chapterId }),
                createElement('td', { text: String(chapter.chapterNumber) }),
                createElement('td', { text: chapter.displayTitle }),
                createElement('td', { text: `${chapter.subjectName} · L${grade}` }),
                createElement('td', { text: formatNumber(chapter.lessonCount) }),
                createElement('td', { text: chapter.textbook?.officialTitle || chapter.textbookId || '—' })
            ] })));
        } catch (error) {
            render(tbody, createElement('tr', {
                children: [createElement('td', {
                    className: 'message message-error',
                    text: error.message || 'Không tải được danh sách chương.',
                    attrs: { colspan: 6 }
                })]
            }));
        } finally {
            tbody.removeAttribute('aria-busy');
        }
    }

    gradeSelect.addEventListener('change', async () => {
        await loadSubjects();
        load();
    });
    subjectSelect.addEventListener('change', load);

    await loadSubjects();
    await load();
});