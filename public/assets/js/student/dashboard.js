/**
 * BẢNG ĐIỀU KHIỂN HỌC SINH.
 *
 * Gom những thứ học sinh cần ngay sau khi đăng nhập: môn đang học, bài kiểm tra
 * sắp tới, tiến độ theo môn và bài học vừa học.
 *
 * Trang này gọi 4 API độc lập; phần nào lỗi thì chỉ ảnh hưởng phần đó, không làm
 * trắng toàn bộ trang.
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

/** Ghi thông báo lỗi cho một khối nội dung. */
function renderError(box, error) {
    if (!box) return;
    render(box, message(error?.message || 'Không tải được dữ liệu.', 'error'));
}

/** Danh sách môn của lớp đang học. */
async function renderSubjects(grade) {
    const box = document.getElementById('subject-list');
    box.setAttribute('aria-busy', 'false');

    const subjects = await studentApi.getSubjects(grade);
    if (!subjects.length) {
        render(box, message('Lớp này chưa có môn học.', 'info'));
        return;
    }

    render(box, createElement('div', { className: 'grid', children: subjects.map(subject => createElement('a', {
        className: 'tile',
        href: `/student/curriculum.html?grade=${grade}&subjectId=${encodeURIComponent(subject.subjectId)}`,
        children: [
            createElement('p', { className: 'tile-icon', attrs: { 'aria-hidden': 'true' }, text: subject.icon || '📘' }),
            createElement('p', { className: 'tile-title', text: subject.displayName }),
            createElement('p', {
                className: 'tile-meta',
                text: `${formatNumber(subject.lessonCount)} bài · ${subject.statusLabel || subject.status}`
            })
        ]
    })) }));
}

/** Bài học gần đây để học sinh quay lại đúng chỗ đang dở. */
function renderContinue(progress) {
    const card = document.getElementById('continue-card');
    const box = document.getElementById('continue-list');
    const recent = progress?.recentLessons || [];
    if (!recent.length) return;

    card.hidden = false;
    render(box, createElement('ul', { children: recent.map(row => createElement('li', { children: [
        createElement('a', {
            href: `/student/lesson.html?lessonId=${encodeURIComponent(row.lessonId)}`,
            text: row.displayTitle || row.lessonId
        })
    ] })) }));
}

/** Các đề thi đang mở cho lớp này. */
async function renderExams(grade) {
    const box = document.getElementById('exam-list');
    const exams = await studentApi.getExams({ grade });

    if (!exams.length) {
        render(box, message('Chưa có bài kiểm tra nào được mở cho lớp này.', 'info'));
        return;
    }
/** Tổng quan tiến độ theo môn, dùng dữ liệu đã nạp sẵn. */
function renderProgress(summary) {
    const box = document.getElementById('progress-summary');

    const rows = (summary.subjects || [])
        .filter(subject => subject.total > 0)
        .slice(0, 6)
        .map(subject => createElement('div', { className: 'stack', children: [
            createElement('p', { className: 'mb-0', children: [
                createElement('strong', { text: `${subject.icon || ''} ${subject.subjectName}` }),
                createElement('span', {
                    className: 'muted small',
                    text: ` — ${subject.completed}/${subject.total} bài`
                })
            ] }),
            progressBar(subject.percent, { label: `${subject.percent}%` })
        ] }));

    render(box,
        createElement('p', {
            className: 'small muted',
            text: `Tổng thể: ${summary.overallPercent}% · Đã làm ${summary.totalAttempts} bài kiểm tra.`
        }),
        rows.length
            ? createElement('div', { className: 'stack', children: rows })
            : message('Chưa có dữ liệu bài học cho lớp này.', 'info')
    );
    return summary;
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

    document.getElementById('greeting').textContent = `Xin chào, ${user.username}`;

    const grade = Number(user.grade);
    if (!grade) {
        // Tài khoản cũ chưa có lớp: hướng dẫn cập nhật ở trang tài khoản.
        render(document.getElementById('profile-line'),
            'Tài khoản chưa có lớp. Vui lòng cập nhật tại trang Tài khoản.');
        for (const id of ['subject-list', 'exam-list', 'progress-summary']) {
            const box = document.getElementById(id);
            if (box) {
                box.setAttribute('aria-busy', 'false');
                render(box, message('Cần có lớp để xem mục này.', 'info'));
            }
        }
        return;
    }

    document.getElementById('profile-line').textContent =
        `Lớp ${grade} · ${user.bookSeriesId || 'chưa chọn bộ sách'}`;

    // Nạp tiến độ trước vì cả "tiếp tục học" và "tiến độ" đều dùng dữ liệu này.
    let summary = null;
    try {
        summary = await studentApi.getProgress(grade);
        renderProgress(summary);
    } catch (error) {
        renderError(document.getElementById('progress-summary'), error);
    }
    renderContinue(summary);

    await Promise.all([
        renderSubjects(grade).catch(error => renderError(document.getElementById('subject-list'), error)),
        renderExams(grade).catch(error => renderError(document.getElementById('exam-list'), error))
    ]);
});

    render(box, createElement('div', { className: 'stack', children: exams.slice(0, 5).map(exam => createElement('a', {
        className: 'tile',
        href: `/student/exam.html?examId=${encodeURIComponent(exam.examId)}`,
        children: [
            createElement('p', { className: 'tile-title', text: exam.title }),
            createElement('p', {
                className: 'tile-meta',
                text: `${exam.questionCount} câu · ${exam.durationMinutes} phút · ${exam.totalPoints} điểm`
            })
        ]
    })) }));
}