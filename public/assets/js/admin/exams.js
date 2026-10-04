/**
 * TRANG ĐỀ KIỂM TRA (quản trị).
 *
 * Liệt kê đề theo trạng thái (nháp / đang duyệt / đã công bố / lưu trữ),
 * mở màn hình soạn thảo, công bố đề hợp lệ và xem lượt làm bài.
 */

import { adminApi } from '../core/api.js';
import { createElement, render, toast, formatNumber } from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const tbody = document.getElementById('exams-body');
const pager = document.getElementById('pagination');
const gradeSelect = document.getElementById('grade');
const statusSelect = document.getElementById('status');

let currentPage = 1;

/** Nhãn + màu của từng trạng thái đề. */
const STATUS_LABELS = {
    draft: ['badge', 'Nháp'],
    review: ['badge badge-warning', 'Đang duyệt'],
    published: ['badge badge-success', 'Đã công bố'],
    archived: ['badge', 'Lưu trữ']
};

/** Dựng nút công bố đề — máy chủ chạy validator, không publish đề hỏng. */
function publishButton(exam) {
    if (exam.status !== 'draft' && exam.status !== 'review') return null;

    return createElement('button', {
        className: 'btn btn-primary',
        text: 'Công bố',
        attrs: { type: 'button' },
        onClick: async () => {
            try {
                await adminApi.publishExam(exam.examId);
                toast('Đã công bố đề thi.');
                load(currentPage);
            } catch (error) {
                toast(error.message || 'Không công bố được. Kiểm tra lại câu hỏi trong đề.', 'error');
            }
        }
    });
}

/** Một dòng của bảng đề thi. */
function examRow(exam) {
    const [statusClass, statusText] = STATUS_LABELS[exam.status] || STATUS_LABELS.draft;

    return createElement('tr', { children: [
        createElement('td', { children: [
            createElement('strong', { text: exam.title }),
            exam.sourceFileName
                ? createElement('p', { className: 'small muted mb-0', text: `Nguồn: ${exam.sourceFileName}` })
                : null
        ].filter(Boolean) }),
        createElement('td', { text: `L${exam.grade} · ${exam.subjectId}` }),
        createElement('td', { text: formatNumber(exam.questionCount) }),
        createElement('td', { text: `${exam.durationMinutes} phút` }),
        createElement('td', { text: `${formatNumber(exam.attemptCount)} lần` }),
        createElement('td', { children: [createElement('span', { className: statusClass, text: statusText })] }),
        createElement('td', { children: [
            createElement('a', {
                href: `/admin/exam-editor.html?examId=${encodeURIComponent(exam.examId)}`,
                text: 'Mở đề'
            }),
            publishButton(exam)
        ].filter(Boolean) })
    ] });
}

startAdminPage(async () => {
    render(gradeSelect,
        createElement('option', { text: 'Tất cả', attrs: { value: '' } }),
        ...Array.from({ length: 12 }, (_, index) => index + 1).map(grade => createElement('option', {
            text: `Lớp ${grade}`,
            attrs: { value: grade }
        }))
    );

    /** Nạp một trang danh sách đề. */
    async function load(page = 1) {
        currentPage = page;
        render(tbody, createElement('tr', {
            children: [createElement('td', { className: 'muted', text: 'Đang tải…', attrs: { colspan: 7 } })]
        }));

        try {
            const data = await adminApi.getExams({
                grade: gradeSelect.value || undefined,
                status: statusSelect.value || undefined,
                page,
                pageSize: 20
            });

            const items = data.items || [];
            if (!items.length) {
                render(tbody, createElement('tr', {
                    children: [createElement('td', {
                        className: 'muted',
                        text: page === 1 ? 'Chưa có đề thi nào.' : 'Không có dữ liệu ở trang này.',
                        attrs: { colspan: 7 }
                    })]
                }));
                render(pager);
                return;
            }

            render(tbody, ...items.map(examRow));

            const totalPages = data.pagination?.totalPages || 1;
            render(pager, totalPages <= 1 ? null : createElement('button', {
                className: 'btn btn-secondary',
                text: 'Trang sau',
                attrs: { type: 'button', disabled: currentPage >= totalPages },
                onClick: () => load(currentPage + 1)
            }));
        } catch (error) {
            render(tbody, createElement('tr', {
                children: [createElement('td', {
                    className: 'message message-error',
                    text: error.message || 'Không tải được danh sách đề.',
                    attrs: { colspan: 7 }
                })]
            }));
        }
    }

    gradeSelect.addEventListener('change', () => load(1));
    statusSelect.addEventListener('change', () => load(1));

    await load(1);
});