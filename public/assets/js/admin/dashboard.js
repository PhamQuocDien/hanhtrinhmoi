/** BẢNG ĐIỀU KHIỂN QUẢN TRỊ.
 *
 * Tổng hợp số liệu từ nhiều nguồn: thống kê ngân hàng câu hỏi, hàng đợi chấm tay
 * và lịch sử nhập DOCX. Mỗi khối gọi API riêng và báo lỗi riêng, nên một phần
 * chậm hoặc lỗi không làm trắng cả trang.
 */

import { adminApi } from '../core/api.js';
import { createElement, render, message, formatNumber, formatDate } from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const statCards = document.getElementById('stat-cards');

/** Một thẻ số liệu. */
function statTile(label, value, { href = '', hint = '' } = {}) {
    const body = [
        createElement('p', { className: 'tile-icon', attrs: { 'aria-hidden': 'true' }, text: label }),
        createElement('p', { className: 'tile-title', text: formatNumber(value) }),
        hint ? createElement('p', { className: 'tile-meta', text: hint }) : null
    ].filter(Boolean);

    return createElement(href ? 'a' : 'div', {
        className: 'tile',
        href: href || undefined,
        children: body
    });
}

/** Thống kê ngân hàng câu hỏi. */
async function renderQuestionStats() {
    const stats = await adminApi.getQuestionStats();
    statCards.setAttribute('aria-busy', 'false');
    render(statCards,
        statTile('📚', stats.total, {
            href: '/admin/question-bank.html',
            hint: `${formatNumber(stats.published)} đã công bố`
        }),
        statTile('🕒', stats.draft, {
            href: '/admin/question-bank.html',
            hint: 'còn nháp, chưa công bố'
        }),
        statTile('⚠️', stats.pendingReview, {
            href: '/admin/question-bank.html?needsReview=1',
            hint: 'cần người duyệt'
        })
    );
}

/** Số câu đang chờ chấm tay. */
async function renderGrading() {
    const box = document.getElementById('grading-summary');
    const stats = await adminApi.getGradingStats();

    // Máy chủ trả về { total, byGrade, bySubject, byType }.
    const pending = stats.total ?? 0;
    render(box,
        createElement('p', { className: 'auto-score', text: formatNumber(pending) }),
        createElement('p', { className: 'small muted', text: 'câu tự luận đang chờ chấm' }),
        createElement('a', { className: 'btn btn-primary', text: 'Mở danh sách chấm', href: '/admin/grading.html' })
    );
}

/** Các tệp Word mới nhập gần đây. */
async function renderImports() {
    const box = document.getElementById('import-summary');
    const data = await adminApi.getImportJobs();
    const items = data.items || [];

    if (!items.length) {
        render(box,
            message('Chưa có tệp Word nào được nhập.', 'info'),
            createElement('a', { className: 'btn btn-primary', text: 'Nhập từ Word', href: '/admin/import-docx.html' })
        );
        return;
    }

    render(box,
        createElement('div', { className: 'stack', children: items.slice(0, 5).map(job => createElement('div', {
            children: [
                createElement('p', { className: 'mb-0', text: job.sourceFileName || 'Tệp không tên' }),
                createElement('p', {
                    className: 'small muted',
                    text: `${job.status || '—'} · ${formatDate(job.createdAt)}`
                })
            ]
        })) }),
        createElement('a', { className: 'btn btn-secondary', text: 'Xem tất cả', href: '/admin/import-docx.html' })
    );
}

startAdminPage(async () => {
    await Promise.all([
        renderQuestionStats().catch(() => {
            statCards.setAttribute('aria-busy', 'false');
            render(statCards, message('Không tải được thống kê câu hỏi.', 'error'));
        }),
        renderGrading().catch(() => render(document.getElementById('grading-summary'),
            message('Không tải được hàng đợi chấm.', 'error'))),
        renderImports().catch(() => render(document.getElementById('import-summary'),
            message('Không tải được lịch sử nhập tệp.', 'error')))
    ]);
});