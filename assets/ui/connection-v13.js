(() => {
    'use strict';
    if (window.__connectionMonitorV13) return;
    window.__connectionMonitorV13 = true;
    let lastState = '';
    let timer = null;

    function ensureBanner() {
        if (document.getElementById('server-state')) return null;
        let banner = document.getElementById('server-connection-v13');
        if (banner) return banner;
        banner = document.createElement('div');
        banner.id = 'server-connection-v13';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.innerHTML = '<span></span><div><button type="button" data-retry>Thử lại</button><a href="status.html">Chi tiết</a></div>';
        banner.querySelector('[data-retry]').addEventListener('click', () => check(true));
        document.body.append(banner);
        return banner;
    }
    function update(state, message, detail = {}) {
        const banner = ensureBanner();
        if (banner) {
            banner.className = state;
            banner.querySelector('span').textContent = message;
            banner.hidden = state === 'online';
        }
        lastState = state;
        document.documentElement.dataset.connectionState = state;
        window.dispatchEvent(new CustomEvent('hanhtrinh:connection-state', { detail: { state, message, ...detail } }));
    }
    async function check(manual = false) {
        clearTimeout(timer);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        try {
            const response = await fetch('/api/health', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data.database === 'connected') {
                const previousState = lastState;
                update('online', 'Đã kết nối máy chủ.', data);
                if (manual && previousState !== 'online') window.showUIMessageV11?.('Đã kết nối lại máy chủ.');
            } else {
                update('degraded', `Máy chủ đang hoạt động nhưng kho dữ liệu chưa sẵn sàng${data.version ? ` • V${data.version}` : ''}.`, data);
            }
        } catch (error) {
            update('offline', navigator.onLine ? 'Không thể liên hệ máy chủ Render. Dữ liệu chưa được gửi.' : 'Thiết bị đang mất mạng. Dữ liệu chưa được gửi.');
        } finally {
            clearTimeout(timeout);
            timer = setTimeout(check, lastState === 'online' ? 45000 : 10000);
        }
    }
    window.addEventListener('online', () => check(true));
    window.addEventListener('offline', () => update('offline', 'Thiết bị đang mất mạng. Dữ liệu chưa được đồng bộ.'));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => check(false));
    else check(false);
    window.HanhTrinhConnectionV13 = { check, getState: () => lastState };
})();
