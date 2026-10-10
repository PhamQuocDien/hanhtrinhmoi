'use strict';

(function bindLearnerPlatformHub(global) {
    function init() {
        const controller = global.HanhTrinhPlatformController;
        const state = global.HanhTrinhState && typeof global.HanhTrinhState === 'object' ? global.HanhTrinhState : null;
        const components = global.HanhTrinhComponents;
        if (!controller || !state || !components || !document.querySelector('[data-platform-page="hub"], [data-learner-platform-hub]')) return;
        const ids = ['platform-notifications', 'platform-mastery', 'platform-assessments', 'platform-surveys', 'platform-placement', 'platform-achievements'];
        ids.map(id => document.getElementById(id)).filter(Boolean).forEach(element => components.renderStatus(element, 'loading'));
        controller.loadLearnerPlatformHub().then(render).catch(error => {
            ids.map(id => document.getElementById(id)).filter(Boolean).forEach(element => components.renderStatus(element, 'error', error.message));
        });
        document.getElementById('platform-mark-all-read')?.addEventListener('click', async event => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
                await controller.markAllNotificationsRead();
                render(state);
            } catch (error) {
                button.disabled = false;
                global.alert?.(error.message);
            }
        });
        document.addEventListener('click', async event => {
            const button = event.target.closest('[data-mark-notification]');
            if (!button) return;
            button.disabled = true;
            try {
                await controller.markNotificationRead(button.dataset.markNotification);
                render(state);
            } catch (error) {
                button.disabled = false;
                global.alert?.(error.message);
            }
        });
    }
    function render(state) {
        state = state && typeof state === 'object' ? state : {};
        const list = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : [];
        const components = global.HanhTrinhComponents;
        const renderIfPresent=(id,renderer,...args)=>{const element=document.getElementById(id);if(element)renderer(element,...args)};
        renderIfPresent('platform-notifications',components.renderNotificationCards.bind(components),list(state.notifications));
        renderIfPresent('platform-mastery',components.renderMasteryCards.bind(components),list(state.mastery));
        renderIfPresent('platform-assessments',components.renderCatalogCards.bind(components),list(state.assessments),'Assessment');
        renderIfPresent('platform-surveys',components.renderCatalogCards.bind(components),list(state.surveys),'Survey');
        renderIfPresent('platform-placement',components.renderCatalogCards.bind(components),list(state.placementTests),'Placement');
        const unlocked = new Set((list(state.achievements?.unlocked)).map(item => String(item.achievementId)));
        renderIfPresent('platform-achievements',components.renderCards.bind(components),list(state.achievements?.catalog), item => `<article class="platform-card ${unlocked.has(String(item._id)) ? 'achievement-unlocked' : ''}"><div class="platform-card-top"><strong>🏅 ${components.escapeHtml(item.name || item.code || 'Achievement')}</strong><span>${unlocked.has(String(item._id)) ? 'Đã mở' : 'Chưa mở'}</span></div><p>${components.escapeHtml(item.description || item.rule?.event || 'Thành tựu do quản trị viên cấu hình.')}</p></article>`);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);