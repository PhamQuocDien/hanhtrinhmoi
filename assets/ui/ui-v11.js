(() => {
    'use strict';

    function wrapTables(root = document) {
        root.querySelectorAll('table').forEach(table => {
            if (table.closest('.ui-table-scroll-v11')) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'ui-table-scroll-v11';
            table.parentNode?.insertBefore(wrapper, table);
            wrapper.append(table);
        });
    }

    function upgradeTabs(root = document) {
        const selectors = ['.tabs', '.tab-bar', '.tab-buttons', '.nav-tabs', '.tabs-container', '.tab-container', '.tabs-wrapper', '.auth-tabs', '.main-category-tabs', '.mode-tabs', '.subject-tabs'];
        root.querySelectorAll(selectors.join(',')).forEach(group => {
            group.classList.add('ui-tab-scroll-v11');
            if (!group.hasAttribute('role')) group.setAttribute('role', 'tablist');
            if (group.dataset.uiV11Tabs === 'ready') return;
            group.dataset.uiV11Tabs = 'ready';
            const buttons = [...group.querySelectorAll('button,[data-tab],a')];
            buttons.forEach((button, index) => {
                if (!button.hasAttribute('role')) button.setAttribute('role', 'tab');
                button.addEventListener('keydown', event => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !buttons.length) return;
                    event.preventDefault();
                    let next = index;
                    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
                    if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
                    if (event.key === 'Home') next = 0;
                    if (event.key === 'End') next = buttons.length - 1;
                    buttons[next]?.focus();
                    buttons[next]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                });
            });
        });
    }

    function checkDuplicateIds() {
        const seen = new Set();
        const duplicates = [];
        document.querySelectorAll('[id]').forEach(element => {
            if (seen.has(element.id)) duplicates.push(element.id);
            else seen.add(element.id);
        });
        if (duplicates.length) console.warn('V11 duplicate IDs:', [...new Set(duplicates)]);
    }

    function makeMessageBox(className, role) {
        const box = document.createElement('div');
        box.className = className;
        box.setAttribute('role', role);
        box.innerHTML = '<button type="button" aria-label="Đóng">×</button><span></span>';
        box.querySelector('button').addEventListener('click', () => box.remove());
        document.body.append(box);
        return box;
    }

    function showToast(message, options = {}) {
        if (!message || !document.body) return;
        let box = document.querySelector('.ui-toast-v11');
        if (!box) box = makeMessageBox('ui-toast-v11', options.error ? 'alert' : 'status');
        box.classList.toggle('error', Boolean(options.error));
        box.querySelector('span').textContent = String(message).slice(0, 800);
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => box.remove(), Number(options.duration) || 6500);
    }

    function showError(message) {
        if (!message || /ResizeObserver loop|Script error\.?$/i.test(String(message))) return;
        let box = document.querySelector('.ui-error-v11');
        if (!box) box = makeMessageBox('ui-error-v11', 'alert');
        box.querySelector('span').textContent = `Có lỗi giao diện vừa được ghi nhận. Hãy thử tải lại trang.\n${String(message).slice(0, 180)}`;
        clearTimeout(showError.timer);
        showError.timer = setTimeout(() => box.remove(), 6500);
    }

    function applySavedAccessibility() {
        try {
            const settings = JSON.parse(localStorage.getItem('htm-accessibility-v11') || '{}');
            document.documentElement.classList.toggle('ui-large-text-v11', Boolean(settings.largeText));
            document.documentElement.classList.toggle('ui-reduced-motion-v11', Boolean(settings.reducedMotion));
            document.documentElement.classList.toggle('ui-high-contrast-v11', Boolean(settings.highContrast));
            document.documentElement.classList.toggle('ui-reading-guide-v11', Boolean(settings.readingGuide));
        } catch {}
    }

    function run() {
        applySavedAccessibility();
        wrapTables();
        upgradeTabs();
        checkDuplicateIds();
        const observer = new MutationObserver(records => {
            clearTimeout(run.timer);
            run.timer = setTimeout(() => {
                for (const record of records) {
                    for (const node of record.addedNodes) {
                        if (!(node instanceof Element)) continue;
                        wrapTables(node.matches('table') ? node.parentElement || node : node);
                        upgradeTabs(node);
                    }
                }
            }, 100);
        });
        observer.observe(document.body, { subtree: true, childList: true });
    }

    window.showUIMessageV11 = showToast;
    if (!window.__nativeAlertV11) window.__nativeAlertV11 = window.alert.bind(window);
    window.alert = message => showToast(message, { duration: 7500 });
    window.addEventListener('error', event => showError(event.message));
    window.addEventListener('unhandledrejection', event => showError(event.reason?.message || event.reason));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();
