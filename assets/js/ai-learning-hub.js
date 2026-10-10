'use strict';

(function initAiLearningHub(global) {
    let api = global.HanhTrinhApi;
    const $ = id => document.getElementById(id);
    if (!api || !$('ai-director-card')) return;
    async function ensureCurrentApi() {
        const required = ['aiDirector', 'aiPersonalCourse', 'aiPersonalCourses'];
        if (required.every(name => typeof api[name] === 'function')) return api;
        const script = document.createElement('script');
        script.src = `assets/js/api.js?v=19.2.0&refresh=${Date.now()}`;
        await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
        api = global.HanhTrinhApi;
        if (!api || !required.every(name => typeof api[name] === 'function')) throw new Error('API client chưa được cập nhật. Hãy tải lại trang bằng Ctrl+F5.');
        return api;
    }
    const safeList = value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean) : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : value && typeof value === 'object' ? Object.values(value).filter(item => ['string','number'].includes(typeof item)) : [];
    const joinSafe = (value, separator = ', ') => safeList(value).map(item => item && typeof item === 'object' ? (item.label || item.title || item.name || item.value || '') : String(item ?? '')).filter(Boolean).join(separator);
    const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    function setStatus(text, tone = '') { const el = $('ai-status-chip'); if (el) { el.textContent = text; el.dataset.tone = tone; } }
    function renderCourses(courses) { const root = $('ai-personal-courses'); if (!root) return; if (!courses.length) { root.innerHTML = '<p class="muted">AI chưa tạo khóa học cá nhân nào.</p>'; return; } root.innerHTML = courses.map(course => `<article class="ai-personal-course"><div><span class="learning-chip">PERSONAL AI</span><h4>${safe(course.name)}</h4><p>${safe(course.description || 'Khóa học được AI tạo từ nhu cầu học tập của bạn.')}</p><small>${safe(course.difficulty || 'Adaptive')} · ${safe(course.estimatedMinutes || '—')} phút · ${safe(course.educationLevel || '')}</small></div><a class="button button-small button-primary" href="ai-course.html?id=${encodeURIComponent(course._id)}">Mở khóa học</a></article>`).join(''); }
    async function loadCourses() { try { await ensureCurrentApi(); renderCourses(safeList(await api.aiPersonalCourses())); } catch (error) { const root = $('ai-personal-courses'); if (root) root.innerHTML = `<p class="muted">${safe(error.message || 'Không thể tải khóa học AI.')}</p>`; } }
    async function runDirector() {
        const result = $('ai-director-result'); const summary = $('ai-director-summary');
        try {
            await ensureCurrentApi();
            setStatus('Đang phân tích…');
            const data = await api.aiAmbientObserve({ pathname: location.pathname, title: document.title, eventType: 'PAGE_VIEW', endpoint: '/api/home/dashboard', method: 'GET', status: 200, result: { source: 'HOME_DASHBOARD' } });
            const context = data.context || {};
            const education = data.educationContext || context.educationContext || {};
            const contextLine = [education.university?.name, education.major?.name, data.education?.grade ? `Lớp ${data.education.grade}` : null, education.specialization?.name].filter(Boolean).join(' · ');
            if (summary) summary.textContent = `${joinSafe(data.insights, ' ') || data.summary || 'AI đã tự phân tích hành trình.'}${contextLine ? ` Ngữ cảnh: ${contextLine}.` : ''}`;
            if (result) {
                result.hidden = false;
                result.innerHTML = `<div><strong>${safe(data.headline || data.priority || 'AI Learning Autopilot')}</strong><p>${safe(data.nextStep || data.summary || '')}</p><small>Ưu tiên: ${safe(data.priority || 'NORMAL')} · Skill gaps: ${safe(joinSafe(data.gaps, ', ') || 'Không phát hiện')}</small>${data.autoCourse?.courseId ? `<div class="ai-director-course-result">🤖 AI đã tự xử lý khóa học: <a href="${safe(data.autoCourse.created ? `ai-course.html?id=${encodeURIComponent(data.autoCourse.courseId)}` : `khoa-hoc-chi-tiet.html?id=${encodeURIComponent(data.autoCourse.courseId)}`)}">Mở ngay →</a></div>` : ''}</div>`;
            }
            if (data.degraded) {
                setStatus('AI dự phòng đang hoạt động', 'warn');
                if (summary) summary.textContent = `${(summary.textContent || '').trim()} AI chính đang bận; hệ thống vẫn tiếp tục bằng chế độ dự phòng và sẽ tự thử lại.`.trim();
            } else setStatus(data.execution ? 'AI đã tự điều phối' : 'AI sẵn sàng', 'success');
            await loadCourses();
        } catch (error) { setStatus('AI đang tự khôi phục', 'warn'); if (summary) summary.textContent = `${error.message || 'AI tạm thời bận.'} Hệ thống vẫn giữ nguyên dữ liệu và sẽ tự thử lại.`; }
    }
    async function createCourse() {
        const summary = $('ai-director-summary');
        try {
            await ensureCurrentApi();
            setStatus('AI đang tạo…');
            const request = { prompt: document.body.dataset.aiNeed || 'Tạo khóa học cá nhân dựa trên hồ sơ, ngành/chuyên ngành, mục tiêu và skill gaps hiện tại.', generateAudio: true };
            const result = await api.aiPersonalCourse(request);
            if (summary) summary.textContent = joinSafe(result.reason, ' ');
            setStatus('Đã tạo khóa học', 'success');
            await loadCourses();
            if (result.courseId && result.decision === 'CREATE_PERSONAL_COURSE') window.location.href = `ai-course.html?id=${encodeURIComponent(result.courseId)}`;
        } catch (error) { setStatus('Tạo thất bại', 'error'); if (summary) summary.textContent = error.message || 'Không thể tạo khóa học.'; }
    }
    $('ai-director-run')?.addEventListener('click', runDirector);
    $('ai-create-course')?.addEventListener('click', createCourse);
    loadCourses();
    const AUTO_KEY = 'htm-ai-director-last-run-v19';
    const AUTO_TTL = 10 * 60 * 1000;
    const lastRun = Number(sessionStorage.getItem(AUTO_KEY) || 0);
    $('ai-director-actions')?.classList.add('ai-autopilot-hidden');
    if (!lastRun || Date.now() - lastRun > AUTO_TTL) {
        sessionStorage.setItem(AUTO_KEY, String(Date.now()));
        setTimeout(() => runDirector(), 500);
    } else {
        setStatus('AI đã theo dõi gần đây', 'success');
    }
})(window);
