/**
 * TRANG BỘ SÁCH (quản trị).
 *
 * Liệt kê các bộ sách giáo khoa đang có, kèm nhà xuất bản, lớp áp dụng, số đầu
 * sách và trạng thái xác minh.
 *
 * Lưu ý về dữ liệu: hệ thống không coi bộ nào là "bộ duy nhất của Bộ". Tên bộ
 * sách ở đây là dữ liệu tham chiếu và đều kèm trạng thái xác minh; xem
 * docs/TEXTBOOKS.md để biết căn cứ của từng mục.
 */

import { adminApi } from '../core/api.js';
import {
    createElement,
    render,
    message,
    formatNumber,
    verificationBadge
} from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const root = document.getElementById('series-root');

/** Rút gọn dãy lớp liên tiếp cho dễ đọc. */
function formatGrades(grades) {
    const list = (grades || []).sort((a, b) => a - b);
    if (!list.length) return '—';
    const runs = [];
    let start = list[0];
    let previous = list[0];
    for (let index = 1; index <= list.length; index += 1) {
        if (list[index] === previous + 1) {
            previous = list[index];
            continue;
        }
        runs.push(start === previous ? `Lớp ${start}` : `Lớp ${start}–${previous}`);
        start = list[index];
        previous = list[index];
    }
    return runs.join(', ');
}

/** Một thẻ cho mỗi bộ sách. */
function seriesCard(series) {
    return createElement('section', { className: 'card', children: [
        createElement('h2', { className: 'card-title', text: series.seriesName }),
        createElement('p', { className: 'small muted', children: [
            createElement('span', { text: `Nhà xuất bản: ${series.publisher || '—'} · ` }),
            createElement('span', { text: `${formatNumber(series.textbookCount)} đầu sách · ` }),
            createElement('span', { text: `Áp dụng: ${formatGrades(series.grades)} · ` }),
            verificationBadge(series.verificationStatus)
        ] }),
        // Lớp nào dùng bộ này làm mặc định — thông tin quan trọng khi nhiều bộ cùng tồn tại.
        series.defaultForGrades?.length
            ? createElement('p', {
                className: 'small',
                text: `Mặc định cho: ${formatGrades(series.defaultForGrades)}`
            })
            : null
    ].filter(Boolean) });
}

startAdminPage(async () => {
    root.setAttribute('aria-busy', 'true');
    try {
        const series = await adminApi.getCatalog().then(catalog => catalog.bookSeries || []);
        if (!series.length) {
            render(root, message('Chưa có bộ sách nào trong danh mục.', 'info'));
            return;
        }
        render(root, ...series.map(seriesCard));
    } catch (error) {
        render(root, message(error.message || 'Không tải được danh sách bộ sách.', 'error'));
    } finally {
        root.setAttribute('aria-busy', 'false');
    }
});