'use strict';
(function () {
    const api = window.HanhTrinhApi;
    function mount() {
        if (!api || document.querySelector('[data-account-menu]')) return;
        if (!document.getElementById('shared-account-styles')) {
            const style = document.createElement('style');
            style.id = 'shared-account-styles';
            style.textContent = '.shared-account-menu{position:relative;display:inline-flex;z-index:20}.shared-account-trigger{display:flex;align-items:center;gap:7px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#102a43;padding:6px 10px;font:700 12px/1.2 inherit;cursor:pointer}.shared-account-avatar{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#dbeafe;color:#1d4ed8}.shared-account-panel{position:absolute;right:0;top:calc(100% + 8px);min-width:160px;padding:6px;border:1px solid #d9e2ec;border-radius:12px;background:#fff;box-shadow:0 12px 28px #102a4326}.shared-account-panel a,.shared-account-panel button{display:block;width:100%;padding:9px 10px;border:0;background:transparent;color:#102a43;text-align:left;text-decoration:none;font:600 13px/1.2 inherit;border-radius:8px;cursor:pointer}.shared-account-panel a:hover,.shared-account-panel button:hover{background:#eff6ff}@media(max-width:600px){.shared-account-name{display:none}}';
            document.head.append(style);
        }
        const wrapper = document.createElement('div');
        wrapper.dataset.accountMenu = 'true';
        wrapper.className = 'shared-account-menu';
        wrapper.innerHTML = '<button class="shared-account-trigger" type="button" aria-expanded="false"><span class="shared-account-avatar">?</span><span class="shared-account-name">Tài khoản</span><span aria-hidden="true">⌄</span></button><div class="shared-account-panel" hidden><a href="profile.html">Hồ sơ</a><a href="thong-bao.html">Thông báo</a><button type="button" data-account-logout>Đăng xuất</button></div>';
        const host = document.querySelector('.platform-topbar .topbar-actions, .platform-legacy-account, .flow-top, .learning-header');
        (host || document.body).append(wrapper);
        const trigger = wrapper.querySelector('.shared-account-trigger');
        const panel = wrapper.querySelector('.shared-account-panel');
        trigger.addEventListener('click', () => { const open = panel.hidden; panel.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); });
        wrapper.querySelector('[data-account-logout]').addEventListener('click', async () => { try { await api.logout(); } finally { window.location.replace('/login.html'); } });
        api.get('/api/auth/session').then(payload => { const data = payload.data || payload; const user = data.user || {}; const name = user.fullName || user.username || 'Tài khoản'; wrapper.querySelector('.shared-account-name').textContent = name; wrapper.querySelector('.shared-account-avatar').textContent = name.charAt(0).toUpperCase(); }).catch(() => {});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();