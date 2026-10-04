/**
 * DANH SÁCH BÀI KIỂM TRA.
 *
 * Lọc theo lớp và môn (và bài học nếu đến từ trang bài học). Chỉ hiển thị đề đã
 * được quản trị viên công bố — máy chủ đã lọc sẵn.
 */

import { studentApi, authApi, requireUser } from '../core/api.js';
import {
    createElement,
    render,
    message,
    renderShell,
    STUDENT_MENU,
    queryParam,
    formatNumber
} from '../core/dom.js';

const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subjectId');
const listBox = document.getElementById('exam-list');

/** Nạp danh sách bài kiểm tra theo bộ lọc hiện tại. */
async function loadExams() {
    const grade = Number(gradeSelect.value) || undefined;
    const subjectId = subjectSelect.value || undefined;
    const lessonId = queryParam('lessonId') || undefined;

    listBox.setAttribute('aria-busy', 'true');
    render(listBox, message('Đang tải bài kiểm tra…', 'info'));

    try {
        const exams = await studentApi.getExams({ grade, subjectId, lessonId });

        if (!exams.length) {
            render(listBox, message('Chưa có bài kiểm tra nào phù hợp.', 'info'));
            return;
        }

        render(listBox, createElement('div', { className: 'grid', children: exams.map(exam => createElement('a', {
            className: 'tile',
            href: `/student/exam.html?examId=${encodeURIComponent(exam.examId)}`,
            children: [
                createElement('p', { className: 'tile-title', text: exam.title }),
                exam.description
                    ? createElement('p', { className: 'tile-meta', text: exam.description })
                    : null,
                createElement('p', {
                    className: 'tile-meta',
                    text: [
                        `Lớp ${exam.grade}`,
                        `${formatNumber(exam.questionCount)} câu`,
                        `${exam.durationMinutes} phút`,
                        `${exam.totalPoints} điểm`,
                        `Đạt từ ${exam.passScorePercent}%`
                    ].join(' · ')
                }),
                exam.attemptCount
                    ? createElement('p', {
                        className: 'tile-meta',
                        text: `Đã làm ${exam.attemptCount} lần · điểm trung bình ${Math.round(exam.averageScorePercent || 0)}%`
                    })
                    : null
            ].filter(Boolean)
        })) }));
    } catch (error) {
        render(listBox, message(error.message || 'Không tải được danh sách bài kiểm tra.', 'error'));
    } finally {
        listBox.setAttribute('aria-busy', 'false');
    }
}

/** Nạp danh sách môn của lớp đang chọn. */
async function loadSubjects(grade) {
    if (!grade) return;
    try {
        const subjects = await studentApi.getSubjects(grade);
        render(subjectSelect,
            createElement('option', { text: 'Tất cả môn', attrs: { value: '' } }),
            ...subjects.map(subject => createElement('option', {
                text: subject.displayName,
                attrs: { value: subject.subjectId }
            }))
        );
        const wanted = queryParam('subjectId');
        if (wanted) subjectSelect.value = wanted;
    } catch {
        render(subjectSelect, createElement('option', { text: 'Tất cả môn', attrs: { value: '' } }));
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
    const grade = Number(queryParam('grade')) || Number(user.grade) || grades[0]?.grade;

    render(gradeSelect, ...grades.map(item => createElement('option', {
        text: item.gradeName || `Lớp ${item.grade}`,
        attrs: { value: item.grade, selected: item.grade === grade }
    })));

    document.getElementById('exam-subtitle').textContent = queryParam('lessonId')
        ? 'Bài kiểm tra gắn với bài học đang xem.'
        : 'Chọn bài kiểm tra để bắt đầu làm bài.';

    await loadSubjects(grade);
    await loadExams();

    gradeSelect.addEventListener('change', async () => {
        await loadSubjects(Number(gradeSelect.value));
        loadExams();
    });
    subjectSelect.addEventListener('change', loadExams);
});