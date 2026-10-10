'use strict';

/** Shared browser API client for the platform namespace.
 * It understands both new envelopes and legacy `{ message, ... }` responses.
 */
(function exposePlatformApi(global) {
    async function request(url, options = {}) {
        const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
        const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
        const payload = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
        if (!response.ok || payload.success === false) {
            const error = new Error(payload.message || `HTTP ${response.status}`);
            error.code = payload.code || `HTTP_${response.status}`;
            error.status = response.status;
            error.details = payload.details || [];
            throw error;
        }
        return payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
    }

    const api = {
        get: (url, options) => request(url, { ...options, method: 'GET' }),
        post: (url, body, options) => request(url, { ...options, method: 'POST', body: JSON.stringify(body ?? {}) }),
        uploadBinary: (url, file, metadata = {}) => {
            if (!(file instanceof Blob)) return Promise.reject(new TypeError('Tệp tải lên không hợp lệ.'));
            const query = new URLSearchParams(Object.entries({ ...metadata, filename: file?.name || metadata.filename || 'tep-dinh-kem.bin', size: file?.size || metadata.size || 0 }).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => [key, String(value)]));
            return request(`${url}?${query.toString()}`, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } });
        },
        uploadDocx: (url, file, metadata = {}) => {
            const query = new URLSearchParams(Object.entries({ ...metadata, filename: file?.name || metadata.filename || 'tai-lieu.docx', mimeType: file?.type || metadata.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: file?.size || metadata.size || 0 }).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => [key, String(value)]));
            return request(`${url}?${query.toString()}`, { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } });
        },
        put: (url, body, options) => request(url, { ...options, method: 'PUT', body: JSON.stringify(body ?? {}) }),
        patch: (url, body, options) => request(url, { ...options, method: 'PATCH', body: JSON.stringify(body ?? {}) }),
        delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
        register: body => request('/api/register', { method: 'POST', body: JSON.stringify(body || {}) }),
        login: body => request('/api/login', { method: 'POST', body: JSON.stringify(body || {}) }),
        requestOtp: body => request('/api/auth/otp/request', { method: 'POST', body: JSON.stringify(body || {}) }),
        verifyOtp: body => request('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify(body || {}) }),
        curriculum: grade => request(`/api/education/legacy-catalog?grade=${encodeURIComponent(grade)}`),
        courses: (query = '') => request(`/api/education/courses${query ? `?${query}` : ''}`),
        course: id => request(`/api/education/courses/${encodeURIComponent(id)}`),
        lesson: id => request(`/api/education/lessons/${encodeURIComponent(id)}`),
        legacyCatalog: grade => request(`/api/learning/catalog?grade=${encodeURIComponent(grade)}`),
        submitLegacyLesson: (grade, subjectId, lessonId, answers) => request(`/api/learning/lesson/${encodeURIComponent(grade)}/${encodeURIComponent(subjectId)}/${encodeURIComponent(lessonId)}/submit`, { method: 'POST', body: JSON.stringify({ answers: answers || {} }) }),
        profile: () => request('/api/education/profile'),
        notifications: unread => request(`/api/notifications${unread ? '?unread=true' : ''}`),
        markNotificationRead: id => request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
        markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
        cmsUpdate: (resource, id, body) => request(`/api/admin/platform/${resource}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body || {}) }),
        cmsPublish: (resource, id) => request(`/api/admin/platform/${resource}/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' }),
        cmsArchive: (resource, id) => request(`/api/admin/platform/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' })
        ,mastery: query => request(`/api/learning-platform/mastery${query ? `?${query}` : ''}`)
        ,englishAssessments: exam => request(`/api/english/configs${exam ? `?exam=${encodeURIComponent(exam)}` : ''}`)
        ,assessments: () => request('/api/assessment/assessments')
        ,assessment: id => request(`/api/assessment/assessments/${encodeURIComponent(id)}`)
        ,surveys: () => request('/api/survey/surveys')
        ,placementTests: () => request('/api/placement/tests')
        ,placementTest: id => request(`/api/placement/tests/${encodeURIComponent(id)}`)
        ,achievements: () => request('/api/gamification/achievements')
        ,userProgress: () => request('/api/user/progress')
        ,learningDashboard: grade => request(`/api/learning/adaptive-dashboard${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`)
        ,learningRoadmap: grade => request(`/api/learning/roadmap${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`)
        ,learningProgress: grade => request(`/api/learning/progress${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`)
        ,learningAssignments: grade => request(`/api/learning/weekly-assignments${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`)
        ,testCatalog: () => request('/api/test/catalog')
        ,parentDashboard: () => request('/api/parent/dashboard')
        ,notificationsList: () => request('/api/notifications')
        ,tournaments: scope => request(`/api/tournaments${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`)
        ,universityCatalog: (resource, query = '') => request(`/api/university/${encodeURIComponent(resource)}${query ? `?${query}` : ''}`)
        ,submitSurvey: (id, answers) => request(`/api/survey/${encodeURIComponent(id)}/attempts`, { method: 'POST', body: JSON.stringify({ answers: answers || {} }) })
        ,submitPlacement: (id, payload) => request(`/api/placement/${encodeURIComponent(id)}/attempts`, { method: 'POST', body: JSON.stringify(payload || {}) })
        ,logout: () => request('/api/logout', { method: 'POST', body: '{}' })
        ,catalog: (resource, query = '') => request(`/api/admin/platform/${resource}${query ? `?${query}` : ''}`)
        ,catalogCreate: (resource, body) => request(`/api/admin/platform/${resource}`, { method: 'POST', body: JSON.stringify(body || {}) })
        ,catalogPublish: (resource, id) => request(`/api/admin/platform/${resource}/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' })
        ,catalogArchive: (resource, id) => request(`/api/admin/platform/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' })
        ,aiStatus: () => request('/api/ai-learning/status')
        ,aiContext: () => request('/api/ai-learning/context')
        ,aiProfileAnalyze: body => request('/api/ai-learning/profile/analyze', { method: 'POST', body: JSON.stringify(body || {}) })
        ,lessonHelp: body => request('/api/ai-learning/lesson-help', { method: 'POST', body: JSON.stringify(body || {}) })
        ,aiDirector: body => request('/api/ai-learning/director', { method: 'POST', body: JSON.stringify(body || {}) })
        ,aiPersonalCourse: body => request('/api/ai-learning/personal-course', { method: 'POST', body: JSON.stringify(body || {}) })
        ,aiPersonalCourses: () => request('/api/ai-learning/personal-courses')
        ,aiAdminGenerateCourse: body => request('/api/ai-learning/admin/course-drafts/generate', { method: 'POST', body: JSON.stringify(body || {}) })
        ,aiAdminDrafts: () => request('/api/ai-learning/admin/course-drafts')
        ,aiAdminDraft: id => request(`/api/ai-learning/admin/course-drafts/${encodeURIComponent(id)}`)
        ,aiAdminCommitDraft: (id, body) => request(`/api/ai-learning/admin/course-drafts/${encodeURIComponent(id)}/commit`, { method: 'POST', body: JSON.stringify(body || {}) })
        ,aiAdminRejectDraft: (id, reason) => request(`/api/ai-learning/admin/course-drafts/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
        ,aiAdminPublishDraft: id => request(`/api/ai-learning/admin/course-drafts/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' })
        ,aiDiagnostic: body => request('/api/ai-learning/diagnostic/generate', { method: 'POST', body: JSON.stringify(body || {}) })
        ,learningIntelligenceStatus: () => request('/api/learning-intelligence/status')
        ,learningCoachToday: grade => request(`/api/learning-intelligence/coach/today${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`)
        ,learningCoachComplete: body => request('/api/learning-intelligence/coach/task-complete', { method: 'POST', body: JSON.stringify(body || {}) })
        ,learningErrors: status => request(`/api/learning-intelligence/errors${status ? `?status=${encodeURIComponent(status)}` : ''}`)
        ,resolveLearningError: id => request(`/api/learning-intelligence/errors/${encodeURIComponent(id)}/resolve`, { method: 'PATCH', body: '{}' })
        ,adaptivePracticeStart: body => request('/api/learning-intelligence/adaptive-practice/sessions', { method: 'POST', body: JSON.stringify(body || {}) })
        ,adaptivePracticeSession: id => request(`/api/learning-intelligence/adaptive-practice/sessions/${encodeURIComponent(id)}`)
        ,adaptivePracticeAnswer: (id, answer) => request(`/api/learning-intelligence/adaptive-practice/sessions/${encodeURIComponent(id)}/answer`, { method: 'POST', body: JSON.stringify({ answer }) })
        ,learningCoachAsk: question => request('/api/learning-intelligence/coach/ask', { method: 'POST', body: JSON.stringify({ question }) })
        ,aiAmbientObserve: body => request('/api/ai-learning/ambient/observe', { method: 'POST', body: JSON.stringify(body || {}) })
        ,aiAmbientAutoCourse: body => request('/api/ai-learning/ambient/auto-course', { method: 'POST', body: JSON.stringify(body || {}) })
        ,localAiStatus: () => request('/api/ai-learning/local/status')
        ,localAiAsk: body => request('/api/ai-learning/local/ask', { method: 'POST', body: JSON.stringify(body || {}) })
        ,lessonProgressList: courseId => request(`/api/learning/lesson-progress?courseId=${encodeURIComponent(courseId || '')}`)
        ,saveLessonProgress: (lessonId, body) => request(`/api/learning/lesson-progress/${encodeURIComponent(lessonId)}`, { method: 'PUT', body: JSON.stringify(body || {}) })
    };
    global.HanhTrinhApi = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);