
import { createElement, render, button, message, formatNumber } from '../core/dom.js';

/**
 * KHUNG XƯƠNG — hiển thị trong lúc chờ dữ liệu.
 *
 * Mục tiêu: người dùng thấy đúng hình dạng nội dung sắp tới thay vì dòng chữ
 * "Đang tải...". Giữ bố cục không nhảy khi dữ liệu về.
 *
 * @param {number} count số thẻ giả lập
 * @returns {HTMLElement} lưới khung xương
 */
export function skeletonGrid(count = 12) {
    return createElement('div', {
        className: 'skeleton-grid',
        attrs: { 'aria-hidden': 'true' },
        children: Array.from({ length: count }, () => createElement('div', { className: 'skeleton skeleton-card' }))
    });
}

/**
 * Skeleton dạng dòng chữ, dùng cho tiêu đề và mô tả.
 *
 * @param {number} count số dòng
 */
export function skeletonLines(count = 2) {
    return createElement('div', {
        attrs: { 'aria-hidden': 'true' },
        children: Array.from({ length: count }, (_, index) => createElement('div', {
            className: 'skeleton skeleton-line',
            // Dòng cuối ngắn hơn để trông như nội dung thật.
            attrs: { style: index === count - 1 ? 'width:60%' : '' }
        }))
    });
}

/** Dòng chữ "đang tải" kèm vòng quay. */
export function loadingText(text = 'Đang tải dữ liệu…') {
    return createElement('p', { className: 'loading-text', text, attrs: { role: 'status' } });
}

/**
 * Trạng thái rỗng — chưa có dữ liệu cho lựa chọn hiện tại.
 *
 * @param {string} title tiêu đề
 * @param {string} text giải thích
 * @param {string} [actionLabel] nhãn nút hành động
 * @param {Function} [onAction] hàm xử lý khi bấm nút
 */
export function emptyState(title, text, actionLabel = '', onAction = null) {
    return createElement('div', { className: 'empty-state', children: [
        createElement('div', { className: 'empty-state-icon', attrs: { 'aria-hidden': 'true' }, text: '📭' }),
        createElement('p', { className: 'empty-state-title', text: title }),
        createElement('p', { className: 'empty-state-text', text }),
        actionLabel && onAction ? button(actionLabel, { className: 'btn btn-secondary', onClick: onAction }) : null
    ].filter(Boolean) });
}

/**
 * Trạng thái lỗi — API lỗi hoặc mất mạng.
 *
 * @param {string} text thông báo lỗi
 * @param {Function} [onRetry] hàm thử lại
 */
export function errorState(text = 'Không thể tải dữ liệu. Vui lòng thử lại.', onRetry = null) {
    return createElement('div', { className: 'error-state', attrs: { role: 'alert' }, children: [
        createElement('p', { className: 'error-state-title', text: 'Có lỗi xảy ra' }),
        createElement('p', { className: 'error-state-text', text }),
        onRetry ? button('Thử lại', { className: 'btn btn-secondary', onClick: onRetry }) : null
    ].filter(Boolean) });
}

/**
 * Hộp trạng thái chung: gom logic "đang tải / lỗi / rỗng" cho các màn hình.
 *
 * Mỗi màn hình chỉ cần gọi `stateHost.render(loader)` rồi trong `try/catch`
 * gọi `renderContent(...)` hoặc `renderError(...)`.
 *
 * @param {HTMLElement} host phần tử chứa
 * @param {Function} loader hàm tải dữ liệu (async)
 * @param {Function} onSuccess nhận dữ liệu, trả về Node hoặc mảng Node
 * @param {object} [options] tuỳ chọn hiển thị
 */
export async function renderAsyncState(host, loader, onSuccess, options = {}) {
    const {
        emptyTitle = 'Chưa có dữ liệu',
        emptyText = 'Chưa có dữ liệu cho lựa chọn này.',
        skeleton = null,
        errorText = 'Không thể tải dữ liệu. Vui lòng thử lại.'
    } = options;

    host.setAttribute('aria-busy', 'true');
    render(host, skeleton || loadingText());

    try {
        const data = await loader();
        host.setAttribute('aria-busy', 'false');

        // Rỗng: nhiều API trả mảng rỗng thay vì lỗi khi chưa có nội dung.
        const isEmpty = Array.isArray(data) ? data.length === 0 : !data;
        if (isEmpty) {
            render(host, emptyState(emptyTitle, emptyText));
            return null;
        }

        const view = onSuccess(data);
        render(host, ...[view].flat().filter(Boolean));
        return view;
    } catch (error) {
        host.setAttribute('aria-busy', 'false');
        render(host, errorState(errorText, () => {
            renderAsyncState(host, loader, onSuccess, options);
        }));
        return null;
    }
}

/**
 * Nhãn trạng thái dữ liệu.
 *
 * @param {string} status VERIFIED / NEEDS_VERIFICATION / DRAFT
 * @returns {HTMLElement} nhãn
 */
export function verificationBadge(status) {
    const labels = {
        VERIFIED: { text: 'Đã xác minh', variant: 'success' },
        NEEDS_VERIFICATION: { text: 'Đang xác minh', variant: 'warning' },
        DRAFT: { text: 'Bản nháp', variant: 'neutral' }
    };
    const item = labels[status] || labels.NEEDS_VERIFICATION;
    return createElement('span', {
        className: `badge badge-${item.variant}`,
        text: item.text,
        attrs: { title: 'Trạng thái đối chiếu với nguồn chính thức' }
    });
}

/**
 * Đường dẫn (breadcrumb) — lớp → môn → bộ sách → chương → bài.
 *
 * @param {Array<{label: string, href?: string}>} items các mục
 */
export function breadcrumb(items) {
    return createElement('nav', { className: 'breadcrumb', attrs: { 'aria-label': 'Đường dẫn' },
        children: items.filter(Boolean).map(item => createElement('span', {
            className: 'breadcrumb-item',
            children: [item.href
                ? createElement('a', { text: item.label, href: item.href })
                : createElement('span', { text: item.label })]
        }))
    });
}

/** Thẻ thông báo dùng để giải thích dữ liệu đang ở trạng thái gì. */
export function notice(text, variant = 'info') {
    return createElement('p', {
        className: variant === 'warning' ? 'notice notice-warning' : 'notice',
        text,
        attrs: { role: 'note' }
    });
}

export { formatNumber, message };