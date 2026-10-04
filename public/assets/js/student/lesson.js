/**
 * TRANG BÀI HỌC.
 *
 * Bài học trong dữ liệu chương trình hiện chỉ có metadata (tên bài, mã bài, thời
 * lượng, trạng thái xác minh) — chưa có nội dung dạy học đầy đủ.
 *
 * Vì vậy trang này:
 *   - hiển thị đúng những gì có (metadata + nguồn + trạng thái xác minh),
 *   - nói rõ phần nào CHƯA có nội dung thay vì bịa nội dung giáo dục,
 *   - cho học sinh đánh dấu đã học, luyện tập và làm bài kiểm tra.
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
    toast,
    formatNumber
} from '../core/dom.js';

const contentBox = document.getElementById('lesson-content');

/** Nội dung bài học, hoặc thông báo trung thực khi chưa có nội dung. */
function renderContent(lesson) {
    const hasContent = lesson.contentStatus && lesson.contentStatus !== 'EMPTY';

    if (!hasContent) {
        render(contentBox,
            message('Bài học này chưa có nội dung dạy học.', 'warning'),
            createElement('p', {
                className: 'muted',
                text: 'Nội dung sẽ được bổ sung sau khi đối chiếu với bản in sách giáo khoa. '
                    + 'Trong lúc đó bạn vẫn có thể luyện tập và làm bài kiểm tra nếu đề đã được mở.'
            })
        );
        return;
    }

    render(contentBox,
        createElement('p', { text: lesson.summary || '' }),
        createElement('p', { className: 'muted small', text: `Nội dung chi tiết sẽ hiển thị tại đây.` })
    );
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

    const lessonId = queryParam('lessonId');
    if (!lessonId) {
        render(contentBox, message('Thiếu mã bài học.', 'error'));
        return;
    }

    // Liên kết tới luyện tập và đề thi đều gắn theo đúng bài đang xem.
    document.getElementById('btn-practice').href =
        `/student/practice.html?lessonId=${encodeURIComponent(lessonId)}`;
    document.getElementById('btn-exam').href =
        `/student/exams.html?lessonId=${encodeURIComponent(lessonId)}`;

    try {
        const lesson = await studentApi.getLesson(lessonId);

        document.getElementById('lesson-title').textContent = lesson.displayTitle;
        document.getElementById('lesson-meta').textContent = [
            lesson.subjectName,
            lesson.chapterTitle ? `Chương: ${lesson.chapterTitle}` : null,
            lesson.estimatedMinutes ? `${lesson.estimatedMinutes} phút` : null
        ].filter(Boolean).join(' · ');

        render(contentBox, createElement('div', { className: 'stack' }, [
            createElement('p', { className: 'mb-0', children: [
                createElement('strong', { text: `Mã bài: ${lesson.lessonCode || lesson.lessonId}` }),
                ' ',
                verificationBadge(lesson.verificationStatus)
            ] })
        ].filter(Boolean)));
        renderContent(lesson);
    } catch (error) {
        render(contentBox, message(error.message || 'Không tải được bài học.', 'error'));
    } finally {
        contentBox.setAttribute('aria-busy', 'false');
    }

    // Đánh dấu đã đọc xong: máy chủ quyết định bài có hoàn thành hay không.
    // Học sinh luôn thấy lý do còn thiếu nếu chưa đủ điều kiện.
    const completeBtn = document.getElementById('btn-complete');
    completeBtn.addEventListener('click', async () => {
        completeBtn.disabled = true;
        try {
            const result = await studentApi.markLessonRead(lessonId);

            if (result.completed) {
                toast('Bài học đã đạt yêu cầu hoàn thành.');
                completeBtn.textContent = 'Đã hoàn thành';
                return;
            }

            // Chưa đủ điều kiện: nói rõ còn thiếu gì thay vì báo thành công.
            const reason = (result.reasons || [])[0] || 'Chưa đủ điều kiện hoàn thành.';
            toast(reason, 'error');
            completeBtn.disabled = false;
        } catch (error) {
            toast(error.message || 'Không lưu được tiến độ.', 'error');
            completeBtn.disabled = false;
        }
    });
});