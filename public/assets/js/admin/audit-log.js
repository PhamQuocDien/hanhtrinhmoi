/**
 * TRANG NHẬT KÝ THAO TÁC (quản trị).
 *
 * Nhật ký chỉ ghi ghi và không sửa (append-only) ở máy chủ. Trường nhạy cảm như
 * mật khẩu và đáp án đúng đã bị lọc bỏ lúc ghi nên không xuất hiện ở đây.
 */

import { adminApi } from '../core/api.js';
import { createElement, render, formatDate } from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const tbody = document.getElementById('audit-body');
const pager = document.getElementById('pagination');
const actorInput = document.getElementById('actor');

let currentPage = 1;

/** Một dòng của bảng nhật ký. */
function auditRow(item) {
    return createElement('tr', { children: [
        createElement('td', { text: formatDate(item.createdAt) }),
        createElement('td', { text: item.actor || '—' }),
        createElement('td', { text: item.actorRole || '—' }),
        createElement('td', { text: item.action || '—' }),
        createElement('td', { text: item.entityType ? `${item.entityType}:${item.entityId || ''}` : '—' }),
        createElement('td', { text: item.summary || '' })
    ] });
}

startAdminPage(async () => {
    /** Nạp một trang nhật ký. */
    async function load(page = 1) {
        currentPage = page;
        render(tbody, createElement('tr', {
            children: [createElement('td', { className: 'muted', text: 'Đang tải…', attrs: { colspan: 6 } })]
        }));

        try {
            const data = await adminApi.getAuditLogs({
                actor: actorInput.value.trim() || undefined,
                page,
                pageSize: 30
            });

            const items = data.items || [];
            if (!items.length) {
                render(tbody, createElement('tr', {
                    children: [createElement('td', {
                        className: 'muted',
                        text: page === 1 ? 'Chưa có thao tác nào được ghi nhận.' : 'Không có dữ liệu ở trang này.',
                        attrs: { colspan: 6 }
                    })]
                }));
                render(pager);
                return;
            }

            render(tbody, ...items.map(auditRow));

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
                    className: 'message message-error',
                    text: error.message || 'Không tải được nhật ký.',
                    attrs: { colspan: 6 }
                })]
            }));
        }
    }

    document.getElementById('btn-search').addEventListener('click', () => load(1));
    await load(1);
});