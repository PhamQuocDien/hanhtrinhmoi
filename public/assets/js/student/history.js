/**
 * TRANG LỊCH SỬ LÀM BÀI.
 *
 * Bảng phân trang theo server. Cột điểm hiển thị "chờ chấm" thay vì 0 điểm khi
 * bài còn câu tự luận chưa được giáo viên chấm — hai trạng thái này khác nhau.
 */

import { studentApi, authApi, requireUser } from '../core/api.js';
import {
    createElement,
    render,
    renderShell,
    STUDENT_MENU,
    formatDate,
    formatScore
} from '../core/dom.js';

const tbody = document.getElementById('history-body');
const pager = document.getElementById('pagination');

let currentPage = 1;

/** Nhãn + màu của trạng thái chấm. */
function gradingBadge(status) {
    const map = {
        pending: ['badge', 'Đang chờ'],
        pending_manual_grading: ['badge badge-warning', 'Chờ giáo viên chấm'],
        graded: ['badge badge-success', 'Đã chấm']
    };
    const [className, text] = map[status] || map.pending;
    return createElement('span', { className, text });
}

/** Một dòng của bảng lịch sử. */
function historyRow(item) {
    const pending = item.gradingStatus === 'pending_manual_grading';

    return createElement('tr', { children: [
        createElement('td', { text: item.examTitle }),
        createElement('td', { text: item.subjectId || '—' }),
        createElement('td', { text: item.grade ? `Lớp ${item.grade}` : '—' }),
        createElement('td', { text: formatDate(item.submittedAt) }),
        createElement('td', { text: formatScore(item.totalScore, item.totalPoints, { pending }) }),
        createElement('td', { children: [gradingBadge(item.gradingStatus)] }),
        createElement('td', { children: [createElement('a', {
            href: `/student/result.html?attemptId=${encodeURIComponent(item.attemptId)}`,
            text: 'Xem kết quả'
        })] })
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

    /** Nạp một trang lịch sử và dựng bảng + nút phân trang. */
    async function load(page) {
        currentPage = page;
        render(tbody, createElement('tr', {
            children: [createElement('td', { className: 'muted', text: 'Đang tải…', attrs: { colspan: 7 } })]
        }));

        try {
            const data = await studentApi.getHistory(page);
            const items = data.items || [];

            if (!items.length) {
                render(tbody, createElement('tr', {
                    children: [createElement('td', {
                        className: 'muted',
                        text: page === 1 ? 'Bạn chưa nộp bài kiểm tra nào.' : 'Không có dữ liệu ở trang này.',
                        attrs: { colspan: 7 }
                    })]
                }));
                render(pager);
                return;
            }

            render(tbody, ...items.map(historyRow));

            const totalPages = data.pagination?.totalPages || 1;
            if (totalPages <= 1) {
                render(pager);
                return;
            }

            render(pager,
                createElement('button', {
                    className: 'btn btn-secondary',
                    text: 'Trang trước',
                    attrs: { type: 'button', disabled: currentPage <= 1 },
                    onClick: () => load(currentPage - 1)
                }),
                createElement('span', { className: 'muted', text: `Trang ${currentPage}/${totalPages}` }),
                createElement('button', {
                    className: 'btn btn-secondary',
                    text: 'Trang sau',
                    attrs: { type: 'button', disabled: currentPage >= totalPages },
                    onClick: () => load(currentPage + 1)
                })
            );
        } catch (error) {
            render(tbody, createElement('tr', {
                children: [createElement('td', {
                    className: 'muted',
                    text: error.message || 'Không tải được lịch sử.',
                    attrs: { colspan: 7 }
                })]
            }));
        }
    }

    await load(1);
});