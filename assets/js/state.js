'use strict';

(function exposePlatformState(global) {
    const state = {
        user: null,
        education: null,
        learningPlan: null,
        mastery: [],
        assessments: [],
        surveys: [],
        placementTests: [],
        achievements: { catalog: [], unlocked: [] },
        curriculum: null,
        notifications: [],
        hubErrors: [],
        loading: false,
        error: null
    };
    function patch(values = {}) { if (!values || typeof values !== 'object') values = {}; Object.assign(state, values); for (const key of ['mastery','assessments','surveys','placementTests','notifications','hubErrors']) if (!Array.isArray(state[key])) state[key] = []; if (!state.achievements || typeof state.achievements !== 'object') state.achievements = { catalog: [], unlocked: [] }; return state; }
    function resetError() { state.error = null; return state; }
    state.patch = patch;
    state.resetError = resetError;
    global.HanhTrinhState = state;
})(typeof window !== 'undefined' ? window : globalThis);