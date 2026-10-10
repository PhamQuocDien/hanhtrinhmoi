'use strict';

(function exposePlatformController(global) {
    function dependencies() {
        if (!global.HanhTrinhApi || !global.HanhTrinhState || !global.HanhTrinhComponents) throw new Error('Platform controller cần api.js, state.js và platform-components.js.');
        const state = global.HanhTrinhState;
        for (const key of ['notifications','mastery','assessments','surveys','placementTests','hubErrors']) if (!Array.isArray(state[key])) state[key] = [];
        if (!state.achievements || typeof state.achievements !== 'object') state.achievements = { catalog: [], unlocked: [] };
        return { api: global.HanhTrinhApi, state, components: global.HanhTrinhComponents };
    }

    async function loadLearnerDashboard({ grade, curriculumContainer, notificationContainer } = {}) {
        const { api, state, components } = dependencies();
        state.loading = true;
        state.resetError();
        try {
            const [curriculum, profile, plan, notifications] = await Promise.all([
                grade ? api.curriculum(grade) : Promise.resolve(null),
                api.profile(),
                api.get('/api/learning-platform/plan'),
                api.notifications(true)
            ]);
            state.patch({ curriculum, user: profile?.profile || null, education: profile?.education || null, learningPlan: plan, notifications: notifications?.items || [] });
            if (curriculumContainer) components.renderList(curriculumContainer, curriculum?.subjects || [], subject => `<li data-subject-id="${components.escapeHtml(subject.id)}"><strong>${components.escapeHtml(subject.name)}</strong><span>${components.escapeHtml(subject.statusLabel || '')}</span></li>`);
            if (notificationContainer) components.renderList(notificationContainer, state.notifications, notification => `<li data-notification-id="${components.escapeHtml(notification._id)}"><strong>${components.escapeHtml(notification.title)}</strong><p>${components.escapeHtml(notification.message)}</p></li>`);
            return state;
        } catch (error) {
            state.error = error.message;
            throw error;
        } finally {
            state.loading = false;
        }
    }

    async function generatePlan(payload) {
        const { api, state } = dependencies();
        state.loading = true;
        try {
            const plan = await api.post('/api/learning-platform/plan/generate', payload || {});
            state.learningPlan = plan;
            return plan;
        } finally {
            state.loading = false;
        }
    }

    async function markNotificationRead(id) {
        const { api, state } = dependencies();
        const notification = await api.markNotificationRead(id);
        state.notifications = state.notifications.map(item => String(item._id) === String(id) ? notification : item);
        return notification;
    }

    async function markAllNotificationsRead() {
        const { api, state } = dependencies();
        await api.markAllNotificationsRead();
        state.notifications = state.notifications.map(item => ({ ...item, read: true }));
        return state.notifications;
    }

    async function loadLearnerPlatformHub() {
        const { api, state, components } = dependencies();
        const results = await Promise.allSettled([
            api.notifications(true),
            api.mastery(),
            api.assessments(),
            api.surveys(),
            api.placementTests(),
            api.achievements()
        ]);
        const value = index => results[index].status === 'fulfilled' ? results[index].value : null;
        state.patch({
            notifications: componentsList(value(0)),
            mastery: componentsList(value(1)),
            assessments: componentsList(value(2)),
            surveys: componentsList(value(3)),
            placementTests: componentsList(value(4)),
            achievements: value(5) || { catalog: [], unlocked: [] },
            hubErrors: results.map(result => result.status === 'rejected' ? result.reason?.message : null)
        });
        return state;
    }

    function componentsList(value) {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.data?.items)) return value.data.items;
        for (const key of ['surveys', 'placements', 'placementTests', 'assessments', 'notifications', 'items']) {
            if (Array.isArray(value?.[key])) return value[key];
            if (Array.isArray(value?.data?.[key])) return value.data[key];
        }
        return [];
    }

    async function loadCmsList(url, container, renderItem) {
        const { api, components } = dependencies();
        return components.bindLoad(container, () => api.get(url), result => components.renderList(container, result?.items || [], renderItem));
    }

    async function mutateCms(resource, id, action, body) {
        const { api } = dependencies();
        if (action === 'publish') return api.cmsPublish(resource, id);
        if (action === 'archive') return api.cmsArchive(resource, id);
        return api.cmsUpdate(resource, id, body);
    }

    global.HanhTrinhPlatformController = Object.freeze({ loadLearnerDashboard, loadLearnerPlatformHub, generatePlan, markNotificationRead, markAllNotificationsRead, loadCmsList, mutateCms });
})(typeof window !== 'undefined' ? window : globalThis);