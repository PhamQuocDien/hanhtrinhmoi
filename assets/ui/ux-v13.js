(() => {
    'use strict';
    if (window.__uxV13) return;
    window.__uxV13 = true;
    function setupForms() {
        document.addEventListener('submit', event => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement) || form.dataset.allowDuplicateSubmit === 'true') return;
            const button = form.querySelector('button[type="submit"],input[type="submit"]');
            if (!button || button.dataset.busyByPage === 'true') return;
            button.dataset.originalLabel ||= button.textContent || button.value || '';
            button.dataset.uxSubmitAt = String(Date.now());
            setTimeout(() => {
                if (button.dataset.uxSubmitAt && Date.now() - Number(button.dataset.uxSubmitAt) > 30000) {
                    button.disabled = false;
                    button.removeAttribute('aria-busy');
                    delete button.dataset.uxSubmitAt;
                }
            }, 31000);
        }, true);
    }
    function setupAccessibility() {
        if (!document.querySelector('.skip-link-v13')) {
            const link = document.createElement('a');
            link.href = '#main-content';
            link.className = 'skip-link-v13';
            link.textContent = 'Bỏ qua đến nội dung chính';
            document.body.prepend(link);
            const main = document.querySelector('main');
            if (main && !main.id) main.id = 'main-content';
        }
        document.querySelectorAll('img:not([loading])').forEach(img => { if (!img.closest('[data-eager-images],#myBoard,.board-container,.board-wrap,#main-board,#othello-board')) img.loading = 'lazy'; else img.loading = 'eager'; });
        document.querySelectorAll('[role="tablist"],.tabs,.auth-tabs').forEach(node => {
            node.addEventListener('wheel', event => {
                if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && node.scrollWidth > node.clientWidth) {
                    node.scrollLeft += event.deltaY;
                    event.preventDefault();
                }
            }, { passive: false });
        });
    }
    function setupUnsavedText() {
        const dirty = new WeakSet();
        document.addEventListener('input', event => {
            const el = event.target;
            if (el instanceof HTMLTextAreaElement || el?.isContentEditable) dirty.add(el.closest('form') || el);
        });
        document.addEventListener('submit', event => dirty.delete(event.target), true);
        window.addEventListener('beforeunload', event => {
            const hasDirty = [...document.querySelectorAll('form,textarea,[contenteditable="true"]')].some(el => dirty.has(el));
            if (!hasDirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }
    function setup() { setupForms(); setupAccessibility(); setupUnsavedText(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
