(() => {
    'use strict';
    if (window.LearningReliabilityV13) return;
    const STORAGE_KEY = 'learning-submission-outbox-v13';
    let flushing = false;

    function read() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(value) ? value.slice(-20) : [];
        } catch { return []; }
    }
    function write(items) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-20)));
        render();
    }
    function queue(item) {
        const items = read();
        const normalized = {
            id: String(item.submissionId || item.id || ''),
            url: String(item.url || ''),
            payload: item.payload || {},
            label: String(item.label || 'Bài học'),
            createdAt: Number(item.createdAt || Date.now()),
            lastError: String(item.lastError || ''),
            attempts: Number(item.attempts || 0)
        };
        if (!normalized.id || !normalized.url) return false;
        const index = items.findIndex(entry => entry.id === normalized.id);
        if (index >= 0) items[index] = { ...items[index], ...normalized };
        else items.push(normalized);
        write(items);
        return true;
    }
    function remove(id) { write(read().filter(item => item.id !== id)); }
    function shouldQueue(error) {
        const message = String(error?.message || error || '').toLowerCase();
        return !navigator.onLine || /kết nối|render|phản hồi quá lâu|cơ sở dữ liệu|503|network|failed to fetch/.test(message);
    }
    async function send(item) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(item.url, {
                method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'X-Submission-Outbox': 'v13' },
                body: JSON.stringify(item.payload), signal: controller.signal
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(data.message || `Không thể nộp (${response.status}).`);
                error.status = response.status;
                throw error;
            }
            return data;
        } finally { clearTimeout(timeout); }
    }
    async function flush(manual = false) {
        if (flushing || !navigator.onLine) return;
        flushing = true;
        try {
            const items = read();
            for (const item of items) {
                try {
                    const data = await send(item);
                    remove(item.id);
                    window.dispatchEvent(new CustomEvent('learning:outbox-sent', { detail: { item, data } }));
                    window.showUIMessageV11?.(`Đã đồng bộ ${item.label}. Mã: ${data.receiptId || item.id}`);
                } catch (error) {
                    const status = Number(error.status) || 0;
                    const updated = read();
                    const index = updated.findIndex(entry => entry.id === item.id);
                    if (index >= 0) {
                        updated[index].attempts = (updated[index].attempts || 0) + 1;
                        updated[index].lastError = String(error.message || error).slice(0, 240);
                        write(updated);
                    }
                    // 400/403/404 cần người học sửa điều kiện, không gửi lặp liên tục.
                    if ([400, 403, 404].includes(status)) break;
                    if (status === 401) {
                        if (manual) location.href = 'login.html';
                        break;
                    }
                    break;
                }
            }
        } finally { flushing = false; render(); }
    }
    function ensureUI() {
        if (document.getElementById('learning-outbox-v13')) return;
        const box = document.createElement('aside');
        box.id = 'learning-outbox-v13';
        box.hidden = true;
        box.innerHTML = '<span></span><button type="button">Gửi lại</button>';
        box.querySelector('button').addEventListener('click', () => flush(true));
        document.body.appendChild(box);
    }
    function render() {
        ensureUI();
        const box = document.getElementById('learning-outbox-v13');
        const items = read();
        box.hidden = items.length === 0;
        if (!items.length) return;
        const failed = items.find(item => item.lastError);
        box.querySelector('span').textContent = failed
            ? `Có ${items.length} bài đang chờ đồng bộ. Lỗi gần nhất: ${failed.lastError}`
            : `Có ${items.length} bài đã lưu an toàn trên thiết bị và đang chờ gửi.`;
    }
    window.addEventListener('online', () => flush(false));
    window.addEventListener('learning:outbox-sent', event => {
        window.dispatchEvent(new CustomEvent('hanhtrinh:learning-synced', { detail: event.detail }));
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { render(); setTimeout(flush, 4000); });
    else { render(); setTimeout(flush, 4000); }
    window.LearningReliabilityV13 = { queue, flush, read, remove, shouldQueue };
})();
