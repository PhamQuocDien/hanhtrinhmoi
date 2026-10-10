(() => {
    'use strict';

    const immersivePages = new Set([
        'trang-tri-phong.html', 'co-vua.html', 'giai-dieu-vui.html',
        'luyen-noi.html', 'luyen-noi-tieng-anh.html', 'xuong-ve.html'
    ]);

    function pageName() {
        return location.pathname.split('/').pop() || 'index.html';
    }

    function applyTheme(theme) {
        const next = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.uiTheme = next;
        localStorage.setItem('uiTheme', next);
        const button = document.getElementById('ui-theme-toggle');
        if (button) {
            button.textContent = next === 'dark' ? '☀️' : '🌙';
            button.title = next === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
        }
    }

    function showMiniToast(message) {
        let toast = document.querySelector('.ui-toast-mini');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'ui-toast-mini';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('is-visible');
        clearTimeout(showMiniToast.timer);
        showMiniToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
    }

    function createDock() {
        if (document.querySelector('.ui-quick-dock')) return;
        const filename = pageName();
        const dock = document.createElement('nav');
        dock.className = 'ui-quick-dock';
        dock.setAttribute('aria-label', 'Điều hướng nhanh');

        const network = document.createElement('span');
        network.className = `ui-network-indicator${navigator.onLine ? '' : ' is-offline'}`;
        network.title = navigator.onLine ? 'Đang trực tuyến' : 'Đang ngoại tuyến';

        const home = document.createElement('a');
        home.href = '/index.html';
        home.textContent = '🏠';
        home.title = 'Về trang chủ';
        home.setAttribute('aria-label', 'Về trang chủ');

        const back = document.createElement('button');
        back.type = 'button';
        back.textContent = '←';
        back.title = 'Quay lại';
        back.setAttribute('aria-label', 'Quay lại');
        back.addEventListener('click', () => {
            if (history.length > 1) history.back();
            else location.href = '/index.html';
        });

        const title = document.createElement('span');
        title.className = 'ui-quick-dock__title';
        title.textContent = document.title || filename;

        const theme = document.createElement('button');
        theme.type = 'button';
        theme.id = 'ui-theme-toggle';
        theme.setAttribute('aria-label', 'Đổi giao diện sáng tối');
        theme.addEventListener('click', () => {
            const next = document.documentElement.dataset.uiTheme === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            showMiniToast(next === 'dark' ? 'Đã bật giao diện tối' : 'Đã bật giao diện sáng');
        });

        dock.append(network, back, home, title, theme);
        document.body.appendChild(dock);
        applyTheme(localStorage.getItem('uiTheme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

        window.addEventListener('online', () => {
            network.classList.remove('is-offline');
            network.title = 'Đang trực tuyến';
            showMiniToast('Đã kết nối lại mạng');
        });
        window.addEventListener('offline', () => {
            network.classList.add('is-offline');
            network.title = 'Đang ngoại tuyến';
            showMiniToast('Mất kết nối mạng');
        });
    }

    function improveAccessibility() {
        document.querySelectorAll('button:not([aria-label])').forEach(button => {
            const label = (button.textContent || '').trim();
            if (label) button.setAttribute('aria-label', label.slice(0, 90));
        });
        document.querySelectorAll('img:not([alt])').forEach(image => image.setAttribute('alt', 'Hình minh họa'));
        document.querySelectorAll('a[target="_blank"]').forEach(link => {
            if (!link.rel.includes('noopener')) link.rel = `${link.rel} noopener noreferrer`.trim();
        });
    }

    function boot() {
        document.body.classList.add('ht-modern', 'ui-page-enter');
        if (immersivePages.has(pageName())) document.body.classList.add('ht-immersive');
        createDock();
        improveAccessibility();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
