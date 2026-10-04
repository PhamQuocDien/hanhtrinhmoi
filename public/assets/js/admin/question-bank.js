/**
 * TRANG NGÂN HÀNG CÂU HỎI (quản trị).
 *
 * Tìm và lọc câu hỏi theo lớp, môn, dạng, mức độ và trạng thái duyệt.
 * Sửa một câu hỏi qua màn hình soạn thảo riêng.
 */

import { adminApi } from '../core/api.js';
import {
    createElement,
    render,
    questionTypeLabel,
    formatNumber
} from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const tbody = document.getElementById('questions-body');
const pager = document.getElementById('pagination');
const statsBox = document.getElementById('stats');

const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subjectId');
const typeSelect = document.getElementById('type');
const difficultySelect = document.getElementById('difficulty');
const reviewSelect = document.getElementById('needsReview');

let currentPage = 1;

/** Nhãn tiếng Việt của mức độ. */
const DIFFICULTY_LABELS = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

/** Cắt ngắn phần đầu câu hỏi cho bảng. */
function preview(text, max = 90) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Một dòng của bảng câu hỏi. */
function questionRow(item) {
    return createElement('tr', { children: [
        createElement('td', { text: preview(item.questionText) }),
        createElement('td', { text: questionTypeLabel(item.type) }),
        createElement('td', { text: `L${item.grade} · ${item.subjectId}` }),
        createElement('td', { text: DIFFICULTY_LABELS[item.difficulty] || item.difficulty }),
        createElement('td', { text: formatNumber(item.points, 1) }),
        createElement('td', { children: [
            item.needsReview
                ? createElement('span', { className: 'badge badge-warning', text: 'Cần duyệt' })
                : createElement('span', { className: 'badge badge-success', text: 'Sẵn sàng' })
        ] }),
        createElement('td', { children: [createElement('a', {
            href: `/admin/exam-editor.html?questionId=${encodeURIComponent(item.questionId)}`,
            text: 'Sửa'
        })] })
    ] });
}

/** Bảng thông báo khi không có dữ liệu hoặc có lỗi. */
function notice(text, variant = 'muted') {
    render(tbody, createElement('tr', {
        children: [createElement('td', { className: variant, text, attrs: { colspan: 7 } })]
    }));
}

startAdminPage(async () => {
    const catalog = await adminApi.getCatalog();

    // Lấy danh sách dạng câu hỏi từ máy chủ để không lệch với server.
    render(typeSelect,
        createElement('option', { text: 'Tất cả', attrs: { value: '' } }),
        ...(catalog.questionTypes || []).map(item => createElement('option', {
            text: item.label,
            attrs: { value: item.type }
        }))
    );

    render(gradeSelect,
        createElement('option', { text: 'Tất cả', attrs: { value: '' } }),
        ...Array.from({ length: 12 }, (_, index) => index + 1).map(grade => createElement('option', {
            text: `Lớp ${grade}`,
            attrs: { value: grade }
        }))
    );

    /** Nạp danh sách môn theo lớp đang chọn. */
    async function loadSubjects() {
        const grade = gradeSelect.value;
        if (!grade) {
            render(subjectSelect, createElement('option', { text: 'Tất cả', attrs: { value: '' } }));
            return;
        }
        const subjects = (catalog.subjects || [])
            .filter(subject => subject.grades?.includes(Number(grade)));
        render(subjectSelect,
            createElement('option', { text: 'Tất cả', attrs: { value: '' } }),
            ...subjects.map(subject => createElement('option', {
                text: subject.displayName,
                attrs: { value: subject.subjectId }
            }))
        );
    }

    /** Nạp một trang câu hỏi theo bộ lọc. */
    async function load(page = 1) {
        currentPage = page;
        notice('Đang tải…');

        try {
            const data = await adminApi.getQuestions({
                grade: gradeSelect.value || undefined,
                subjectId: subjectSelect.value || undefined,
                type: typeSelect.value || undefined,
                difficulty: difficultySelect.value || undefined,
                needsReview: reviewSelect.value || undefined,
                page,
                pageSize: 20
            });

            const items = data.items || [];
            if (!items.length) {
                notice(page === 1 ? 'Không có câu hỏi khớp bộ lọc.' : 'Không có dữ liệu ở trang này.');
                render(pager);
                await renderStats();
                return;
            }

            render(tbody, ...items.map(questionRow));
            renderPager(data.pagination);
        } catch (error) {
            notice(error.message || 'Không tải được danh sách câu hỏi.', 'message message-error');
        }
    }

/** Hiện thống kê nhỏ ở trên bảng. */
    async function renderStats() {
        try {
            const stats = await adminApi.getQuestionStats({
                grade: gradeSelect.value || undefined,
                subjectId: subjectSelect.value || undefined
            });
            render(statsBox, `Tổng: ${formatNumber(stats.total)} · Đã công bố: ${formatNumber(stats.published)}`
                + ` · Cần duyệt: ${formatNumber(stats.pendingReview)} · Nháp: ${formatNumber(stats.draft)}`);
        } catch {
            render(statsBox);
        }
    }

    /** Dựng nút chuyển trang. */
    function renderPager(pagination) {
        const totalPages = pagination?.totalPages || 1;
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
    }

    document.getElementById('btn-search').addEventListener('click', () => load(1));
    gradeSelect.addEventListener('change', async () => {
        await loadSubjects();
        load(1);
    });
    subjectSelect.addEventListener('change', () => load(1));
    typeSelect.addEventListener('change', () => load(1));
    difficultySelect.addEventListener('change', () => load(1));
    reviewSelect.addEventListener('change', () => load(1));

    // Nếu đến từ bảng điều khiển với bộ lọc "cần duyệt", tự áp dụng.
    if (new URLSearchParams(window.location.search).get('needsReview') === '1') {
        reviewSelect.value = '1';
    }

    await load(1);
});