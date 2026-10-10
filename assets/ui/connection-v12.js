(() => {
    'use strict';
    if (window.__connectionMonitorV12) return;
    window.__connectionMonitorV12 = true;

    let lastState = '';
    let timer = null;

    function ensureBanner() {
        if (document.getElementById('server-connection-v12') || document.getElementById('server-state')) return null;
        const banner = document.createElement('div');
        banner.id = 'server-connection-v12';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.innerHTML = '<span></span><button type="button">Thử lại</button>';
        banner.querySelector('button').addEventListener('click', () => check(true));
        document.body.append(banner);
        return banner;
    }

    function update(state, message) {
        const banner = ensureBanner();
        if (!banner) return;
        banner.className = state;
        banner.querySelector('span').textContent = message;
        banner.hidden = state === 'online';
        lastState = state;
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
                update('online', 'Đã kết nối máy chủ.');
                if (manual && previousState !== 'online') window.showUIMessageV11?.('Đã kết nối lại máy chủ.');
            } else {
                update('degraded', 'Máy chủ đang kết nối lại cơ sở dữ liệu. Một số thao tác lưu dữ liệu tạm thời chưa dùng được.');
            }
        } catch (error) {
            update('offline', navigator.onLine ? 'Không thể liên hệ máy chủ Render.' : 'Thiết bị đang mất mạng.');
        } finally {
            clearTimeout(timeout);
            timer = setTimeout(check, lastState === 'online' ? 45000 : 12000);
        }
    }

    window.addEventListener('online', () => check(true));
    window.addEventListener('offline', () => update('offline', 'Thiết bị đang mất mạng. Dữ liệu chưa thể đồng bộ.'));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => check(false));
    else check(false);
})();
