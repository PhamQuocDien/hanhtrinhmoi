/**
 * TRANG CHƯƠNG TRÌNH — lớp -> môn -> chương -> bài học.
 *
 * Hiển thị đúng cấp thứ tự mà chương trình quy định. Mỗi bài học dẫn tới trang
 * học; mỗi chương có nút xem đề thi của chương đó nếu có.
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

const listBox = document.getElementById('chapter-list');

/** Một bài học trong danh sách. */
function lessonRow(grade, lesson) {
    return createElement('li', { className: 'stack', children: [
        createElement('a', {
            href: `/student/lesson.html?lessonId=${encodeURIComponent(lesson.lessonId)}`,
            text: `${lesson.lessonNumber}. ${lesson.displayTitle}`
        }),
        createElement('span', { className: 'small muted', text: `Mã bài: ${lesson.lessonCode || lesson.lessonId}` }),
        verificationBadge(lesson.verificationStatus)
    ].filter(Boolean) });
}

/** Một chương kèm các bài học bên trong. */
function chapterCard(grade, subjectId, chapter) {
    return createElement('section', { className: 'card', children: [
        createElement('h2', { className: 'card-title', text: `Chương ${chapter.chapterNumber}: ${chapter.displayTitle}` }),
        createElement('p', { className: 'small muted', text: `${formatNumber(chapter.lessonCount)} bài học` }),
        createElement('a', {
            className: 'btn btn-secondary',
            text: 'Xem đề thi của chương',
            href: `/student/exams.html?grade=${grade}&subjectId=${encodeURIComponent(subjectId)}&chapterId=${encodeURIComponent(chapter.chapterId)}`
        }),
        createElement('ul', { className: 'stack', children: (chapter.lessons || []).map(lesson => lessonRow(grade, lesson)) })
    ] });
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

    const grade = Number(queryParam('grade')) || Number(user.grade);
    const subjectId = queryParam('subjectId');

    if (!grade || !subjectId) {
        render(listBox, message('Thiếu lớp hoặc môn học. Vui lòng chọn từ danh sách môn học.', 'warning'));
        return;
    }

    try {
        const subject = await studentApi.getSubject(grade, subjectId);

        document.getElementById('subject-title').textContent = subject.displayName;
        document.getElementById('subject-meta').textContent = [
            `Lớp ${grade}`,
            `${formatNumber(subject.chapterCount)} chương`,
            `${formatNumber(subject.lessonCount)} bài học`,
            subject.textbook?.officialTitle || ''
        ].filter(Boolean).join(' · ');

        const chapters = subject.chapters || [];
        if (!chapters.length) {
            render(listBox, message('Môn này chưa có danh sách chương.', 'info'));
            return;
        }

        render(listBox, ...chapters.map(chapter => chapterCard(grade, subjectId, chapter)));
    } catch (error) {
        render(listBox, message(error.message || 'Không tải được chương trình.', 'error'));
    } finally {
        listBox.setAttribute('aria-busy', 'false');
    }
});