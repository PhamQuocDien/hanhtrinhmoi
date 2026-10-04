/**
 * TRANG TIẾN ĐỘ HỌC TẬP.
 *
 * Tiến độ luôn được TÍNH LẠI ở máy chủ từ các bản ghi bài học, nên không bao giờ
 * có hai con số mâu thuẫn cho cùng một thứ.
 */

import { studentApi, authApi, requireUser } from '../core/api.js';
import {
    createElement,
    render,
    message,
    renderShell,
    STUDENT_MENU,
    progressBar,
    formatNumber
} from '../core/dom.js';

const gradeSelect = document.getElementById('grade');
const summaryBody = document.getElementById('summary-body');
const listBox = document.getElementById('subject-progress');

/** Thẻ tiến độ của một môn. */
function subjectCard(subject) {
    return createElement('section', { className: 'card', children: [
        createElement('h2', { className: 'card-title', text: `${subject.icon || ''} ${subject.subjectName}` }),
        createElement('p', {
            className: 'small muted',
            text: [
                `${subject.completed}/${subject.total} bài hoàn thành`,
                `${formatNumber(subject.practiceAttempts)} lượt luyện tập`,
                subject.averageBestScore !== null ? `điểm tốt nhất TB ${subject.averageBestScore}%` : null
            ].filter(Boolean).join(' · ')
        }),
        progressBar(subject.percent, { label: `${subject.percent}% hoàn thành` }),
        // Môn chưa có bài học thì không có mốc để hoàn thành — nói rõ.
        subject.needsLessonImport
            ? createElement('p', { className: 'small muted', text: 'Môn này chưa có nội dung bài học trong hệ thống.' })
            : null
    ].filter(Boolean) });
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
    const grade = Number(user.grade) || grades[0]?.grade;

    render(gradeSelect, ...grades.map(item => createElement('option', {
        text: item.gradeName || `Lớp ${item.grade}`,
        attrs: { value: item.grade, selected: item.grade === grade }
    })));

    /** Nạp tiến độ của một lớp và dựng giao diện. */
    async function load(targetGrade) {
        listBox.setAttribute('aria-busy', 'true');
        render(listBox, message('Đang tải tiến độ…', 'info'));
        render(summaryBody, message('Đang tải…', 'info'));

        try {
            const summary = await studentApi.getProgress(targetGrade);

            render(summaryBody, createElement('div', { className: 'stack', children: [
                createElement('p', { className: 'auto-score', text: `${summary.overallPercent}%` }),
                createElement('p', { className: 'small muted', text: `Lớp ${summary.grade} · Đã làm ${summary.totalAttempts} bài kiểm tra.` }),
                progressBar(summary.overallPercent)
            ] }));

            const rows = (summary.subjects || []).filter(subject => subject.total > 0);
            if (!rows.length) {
                render(listBox, message('Chưa có bài học nào trong lớp này.', 'info'));
                return;
            }
            render(listBox, ...rows.map(subjectCard));
        } catch (error) {
            render(listBox, message(error.message || 'Không tải được tiến độ.', 'error'));
            render(summaryBody, message('Không tải được tổng quan.', 'error'));
        } finally {
            listBox.setAttribute('aria-busy', 'false');
        }
    }

    await load(grade);
    gradeSelect.addEventListener('change', () => load(Number(gradeSelect.value)));
});