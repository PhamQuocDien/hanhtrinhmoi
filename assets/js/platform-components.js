'use strict';

(function exposePlatformComponents(global) {
    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
    function renderStatus(container, status, message = '') {
        if (!container) return;
        container.dataset.state = status;
        container.innerHTML = status === 'loading' ? '<p role="status">Đang tải…</p>' : status === 'empty' ? '<p>Chưa có dữ liệu.</p>' : status === 'error' ? `<p role="alert">${escapeHtml(message || 'Không thể tải dữ liệu.')}</p>` : '';
    }
    function renderList(container, items, renderItem = item => `<li>${escapeHtml(item)}</li>`) {
        if (!container) return;
        if (!Array.isArray(items) || !items.length) return renderStatus(container, 'empty');
        container.dataset.state = 'success';
        container.innerHTML = `<ul>${items.map(renderItem).join('')}</ul>`;
    }
    function bindLoad(container, loader, render) {
        renderStatus(container, 'loading');
        return Promise.resolve().then(loader).then(data => { render(data); return data; }).catch(error => { renderStatus(container, 'error', error.message); throw error; });
    }
    function unwrapItems(value) {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.data)) return value.data;
        return [];
    }
    function renderCards(container, items, renderCard, emptyMessage = 'Chưa có dữ liệu.') {
        if (!container) return;
        const list = unwrapItems(items);
        if (!list.length) {
            container.dataset.state = 'empty';
            container.innerHTML = `<p class="platform-empty">${escapeHtml(emptyMessage)}</p>`;
            return;
        }
        container.dataset.state = 'success';
        container.innerHTML = list.map(renderCard).join('');
    }
    function renderNotificationCards(container, items) {
        renderCards(container, items, item => `<article class="platform-card notification-card ${item.read ? 'is-read' : 'is-unread'}" data-notification-id="${escapeHtml(item._id)}"><div class="platform-card-top"><strong>${escapeHtml(item.title || 'Thông báo')}</strong><span>${escapeHtml(item.read ? 'Đã đọc' : 'Mới')}</span></div><p>${escapeHtml(item.message || item.content || '')}</p><small>${item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}</small><button type="button" class="platform-card-action" data-mark-notification="${escapeHtml(item._id)}" ${item.read ? 'disabled' : ''}>${item.read ? 'Đã đọc' : 'Đánh dấu đã đọc'}</button></article>`);
    }
    function renderCatalogCards(container, items, kind) {
        renderCards(container, items, item => {
            const title = item.title || item.name || item.code || `${kind} item`;
            const description = item.description || item.objective || item.variant || item.educationLevel || '';
            return `<article class="platform-card"><div class="platform-card-top"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(item.status || item.publicationStatus || 'PUBLISHED')}</span></div><p>${escapeHtml(description)}</p><small>${escapeHtml(item.code || item.version || item.exam || '')}</small></article>`;
        });
    }
    function renderMasteryCards(container, items) {
        renderCards(container, items, item => `<article class="platform-card mastery-card"><div class="platform-card-top"><strong>${escapeHtml(item.skill)}</strong><span>${escapeHtml(item.status || 'NOT_STARTED')}</span></div><div class="platform-progress"><i style="width:${Math.max(0, Math.min(100, Number(item.accuracy || item.averageScore * 10 || 0)))}%"></i></div><small>Độ chính xác: ${escapeHtml(item.accuracy ?? '–')} • Lượt học: ${escapeHtml(item.attempts ?? 0)}</small></article>`);
    }
    global.HanhTrinhComponents = Object.freeze({ escapeHtml, renderStatus, renderList, bindLoad, unwrapItems, renderCards, renderNotificationCards, renderCatalogCards, renderMasteryCards });
})(typeof window !== 'undefined' ? window : globalThis);