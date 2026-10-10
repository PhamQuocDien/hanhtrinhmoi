'use strict';

const activeJobs = new Map();

function normalizeProvisionKey(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 180);
}

function withCourseProvisionLock(username, focus, task) {
    if (typeof task !== 'function') throw new TypeError('task must be a function');
    const userKey = normalizeProvisionKey(username);
    const focusKey = normalizeProvisionKey(focus);
    if (!userKey || !focusKey) return Promise.resolve().then(task);
    const key = `${userKey}:${focusKey}`;
    const existing = activeJobs.get(key);
    if (existing) return existing;
    const job = Promise.resolve().then(task).finally(() => {
        if (activeJobs.get(key) === job) activeJobs.delete(key);
    });
    activeJobs.set(key, job);
    return job;
}

function getActiveProvisionJobs() { return activeJobs.size; }

module.exports = { withCourseProvisionLock, getActiveProvisionJobs };
