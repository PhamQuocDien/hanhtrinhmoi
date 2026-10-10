'use strict';

(function initBoardUi(global) {
    if (global.__hanhTrinhBoardUi) return;
    global.__hanhTrinhBoardUi = true;
    const body = document.body;
    if (!body) return;
    body.classList.add('board-page');
    const storageKey = 'boardUiPreferences';
    let prefs = { contrast: false, largeControls: false };
    try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch (_) {}
    const savePrefs = () => { try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch (_) {} };
    const find = selector => document.querySelector(selector);
    const findAll = selector => Array.from(document.querySelectorAll(selector));
    const tools = document.createElement('div');
    tools.className = 'board-ui-tools';
    tools.setAttribute('aria-label', 'Công cụ hỗ trợ bàn cờ');
    const full = document.createElement('button');
    full.type = 'button';
    full.textContent = '⛶ Toàn màn hình';
    full.title = 'Mở hoặc thoát toàn màn hình';
    full.addEventListener('click', async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
            setTimeout(() => global.dispatchEvent(new Event('resize')), 80);
        } catch (_) { global.boardNotice?.('Thiết bị không cho phép mở toàn màn hình.'); }
    });
    const contrast = document.createElement('button');
    contrast.type = 'button';
    const large = document.createElement('button');
    large.type = 'button';
    const top = document.createElement('button');
    top.type = 'button';
    top.textContent = '↑ Đầu trang';
    top.addEventListener('click', () => global.scrollTo({ top: 0, behavior: 'smooth' }));
    tools.append(full, contrast, large, top);
    body.appendChild(tools);

    const banner = document.createElement('div');
    banner.className = 'board-network hidden';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    body.appendChild(banner);
    const notice = document.createElement('div');
    notice.className = 'board-notice hidden';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'assertive');
    body.appendChild(notice);
    let noticeTimer;
    global.boardNotice = message => {
        notice.textContent = String(message || '');
        notice.classList.remove('hidden');
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => notice.classList.add('hidden'), 3200);
    };
    const applyPrefs = () => {
        body.classList.toggle('board-high-contrast', Boolean(prefs.contrast));
        body.classList.toggle('board-large-controls', Boolean(prefs.largeControls));
        contrast.textContent = prefs.contrast ? '◐ Tương phản: Bật' : '◐ Tương phản';
        large.textContent = prefs.largeControls ? 'Aa Nút lớn: Bật' : 'Aa Nút lớn';
    };
    contrast.addEventListener('click', () => { prefs.contrast = !prefs.contrast; savePrefs(); applyPrefs(); });
    large.addEventListener('click', () => { prefs.largeControls = !prefs.largeControls; savePrefs(); applyPrefs(); });

    const showNetwork = online => {
        banner.classList.remove('hidden', 'online');
        banner.classList.toggle('online', online);
        banner.textContent = online ? '✓ Đã kết nối lại' : '⚠ Mất kết nối mạng';
        clearTimeout(showNetwork.timer);
        if (online) showNetwork.timer = setTimeout(() => banner.classList.add('hidden'), 1800);
    };
    global.addEventListener('online', () => showNetwork(true));
    global.addEventListener('offline', () => showNetwork(false));
    global.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.fullscreenElement) document.exitFullscreen().catch(() => {});
        if (event.key.toLowerCase() === 'h') global.boardNotice('Mẹo: dùng Toàn màn hình, Tương phản hoặc Nút lớn.');
    });
    document.addEventListener('fullscreenchange', () => setTimeout(resizeBoards, 100));
    global.addEventListener('orientationchange', () => setTimeout(resizeBoards, 180));
    findAll('canvas,.board,.othello-grid,#myBoard,#main-board').forEach(el => {
        el.addEventListener('contextmenu', event => event.preventDefault());
        el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
    });

    function markBoardImagesEager() {
        findAll('#myBoard img,.board-container img,.board-wrap img,#main-board img').forEach(img => {
            img.loading = 'eager';
            img.decoding = 'sync';
            img.removeAttribute('width');
            img.removeAttribute('height');
        });
    }
    function resizeBoards() {
        markBoardImagesEager();
        try { if (global.board && typeof global.board.resize === 'function') global.board.resize(); } catch (_) {}
        global.dispatchEvent(new CustomEvent('board:resize'));
    }
    const observer = new MutationObserver(mutations => {
        if (mutations.some(item => item.addedNodes.length)) global.requestAnimationFrame(markBoardImagesEager);
    });
    observer.observe(body, { childList: true, subtree: true });
    if ('ResizeObserver' in global) {
        const target = find('.game-layout,.shell,.game-container,#myBoard,.board-container');
        if (target) new ResizeObserver(() => global.requestAnimationFrame(resizeBoards)).observe(target);
    }
    let resizeTimer;
    global.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resizeBoards, 120); }, { passive: true });
    applyPrefs();
    markBoardImagesEager();
    setTimeout(resizeBoards, 100);
    setTimeout(resizeBoards, 800);
})(window);
