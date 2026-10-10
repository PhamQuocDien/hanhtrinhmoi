'use strict';

(function initAiAutopilot(global) {
    if (!global.document) return;
    if (/login\.html$|status\.html$/.test(global.location.pathname)) return;
    const state = { lastKey: '', timer: null, pending: [], session: null, booted: false, sending: false, interactive: false };
    const $ = (selector, root = document) => root.querySelector(selector);
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    function rootNode() { return document.querySelector('.platform-main') || document.querySelector('.learning-app') || document.querySelector('.flow-shell') || document.querySelector('.admin-content') || document.querySelector('main') || document.body; }
    function panel() {
        let element = document.getElementById('ai-autopilot-panel');
        if (element) return element;
        element = document.createElement('section');
        element.id = 'ai-autopilot-panel';
        element.className = 'ai-autopilot-panel';
        element.innerHTML = `<div class="ai-autopilot-head"><div><div class="ai-autopilot-kicker">AI LEARNING AUTOPILOT</div><h2 class="ai-autopilot-title">AI đang tự phân tích hành trình của bạn</h2></div><span id="ai-autopilot-chip" class="ai-autopilot-chip">Đang phân tích…</span></div><p id="ai-autopilot-summary" class="ai-autopilot-summary">AI sẽ tự đọc ngữ cảnh trang, mục tiêu, ngành/lớp, mastery và hoạt động học gần nhất để điều chỉnh đề xuất.</p><div id="ai-autopilot-content"></div>`;
        const root = rootNode();
        if (root.firstElementChild) root.insertBefore(element, root.firstElementChild); else root.appendChild(element);
        return element;
    }
    function setChip(text, tone = '') { const el = $('#ai-autopilot-chip'); if (el) { el.textContent = text; el.dataset.tone = tone; } }
    function renderInsight(data) {
        const root = panel();
        const summary = $('#ai-autopilot-summary', root);
        const content = $('#ai-autopilot-content', root);
        if (summary) summary.textContent = data.summary || data.nextStep || 'AI đã phân tích dữ liệu hiện tại.';
        const insights = Array.isArray(data.insights) ? data.insights.slice(0, 3) : [];
        const gaps = Array.isArray(data.gaps) ? data.gaps.slice(0, 5) : [];
        const recommendations = Array.isArray(data.recommendations) ? data.recommendations.slice(0, 3) : [];
        const recommendationHtml = recommendations.length ? `<div class="ai-autopilot-block"><h4>AI đề xuất ngay</h4><div class="ai-autopilot-list">${recommendations.map((item,index)=>`<div class="ai-autopilot-recommendation"><div><strong>${esc(item.title || 'Khóa học đề xuất')}</strong><small>${esc(item.reason || '')}</small></div>${item.url ? `<a class="ai-autopilot-action" href="${esc(item.url)}">Học ngay</a>` : ''}</div>`).join('')}</div></div>` : '';
        const insightHtml = `<div class="ai-autopilot-block"><h4>AI nhìn thấy</h4><ul class="ai-autopilot-list">${(insights.length ? insights : ['AI sẽ tiếp tục cập nhật khi bạn phát sinh hoạt động mới.']).map(item => `<li>• ${esc(item)}</li>`).join('')}</ul></div>`;
        const gapHtml = gaps.length ? `<div class="ai-autopilot-block"><h4>Khoảng trống cần xử lý</h4><ul class="ai-autopilot-list">${gaps.map(item => `<li>⚠️ ${esc(item)}</li>`).join('')}</ul></div>` : '';
        const autoCourse = data.autoCourse || null;
        const autoCourseHtml = data.shouldCreateCourse || autoCourse ? `<div class="ai-autopilot-missing"><div><strong>${autoCourse?.created ? '🤖 AI đã tự tạo khóa học.' : autoCourse?.reused ? '📚 AI đã tự chọn khóa học nền tảng.' : '🧠 AI đang tự xử lý khoảng trống học tập.'}</strong><div>${esc(autoCourse?.created ? 'Khóa học cá nhân đã được xây từ catalog và hồ sơ của bạn.' : (data.coursePrompt || 'Hệ thống sẽ tự tạo hoặc ghép resource phù hợp khi đủ dữ liệu.'))}</div></div>${autoCourse?.url ? `<a class="ai-autopilot-action" href="${esc(autoCourse.url)}">Mở khóa học</a>` : ''}</div>` : '';
        content.innerHTML = `<div class="ai-autopilot-grid">${insightHtml}${gapHtml || recommendationHtml}</div>${gapHtml && recommendationHtml ? recommendationHtml : ''}<div class="ai-autopilot-next">🎯 Bước tiếp theo: ${esc(data.nextStep || 'Tiếp tục học theo lộ trình được đề xuất.')}</div>${autoCourseHtml}`;
        if (autoCourse?.created) setChip('AI đã tự tạo khóa học', 'success');
        else setChip(data.cached ? 'AI cập nhật' : (data.degraded ? 'AI dự phòng đang hoạt động' : (data.model && data.model !== 'RULE_BASED_AUTOPILOT' ? (data.fallbackUsed ? 'AI Gemini dự phòng' : 'AI Gemini đang chạy') : 'AI đang tự theo dõi')), data.degraded ? 'warn' : 'success');
    }
    function safeResult(value, depth = 0) {
        if (depth > 2 || value == null) return undefined;
        if (Array.isArray(value)) return value.slice(0, 5).map(item => safeResult(item, depth + 1)).filter(item => item !== undefined);
        if (typeof value === 'string') return value.slice(0, 180);
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        if (typeof value !== 'object') return undefined;
        const allowed = ['score','percentage','passed','correct','total','status','level','xpEarned','streak','recommendation','scores','action','decision','priority','target','exam','variant','skill','courseId','assessmentId','learningPlanId'];
        const out = {}; for (const key of allowed) if (key in value) { const item = safeResult(value[key], depth + 1); if (item !== undefined) out[key] = item; } return out;
    }
    function pageEvent(eventType, event = {}) {
        return { pathname: location.pathname, title: document.title, eventType, endpoint: String(event.endpoint || '').slice(0, 900), method: String(event.method || 'GET').slice(0, 12), status: Number(event.status) || 0, result: safeResult(event.result || {}) || {} };
    }
    async function observe(eventType, event = {}, immediate = false) {
        state.pending.push(pageEvent(eventType, event));
        clearTimeout(state.timer);
        state.timer = setTimeout(() => flush(), immediate ? 50 : 900);
    }
    async function flush() {
        if (state.sending || !state.pending.length) return;
        state.sending = true;
        const events = state.pending.splice(-6);
        const last = events[events.length - 1] || {};
        const endpoint = Array.from(new Set(events.map(item => item.endpoint).filter(Boolean))).slice(-5).join(', ');
        const result = Object.assign({}, ...events.map(item => item.result || {}));
        const body = { ...last, eventType: events.some(item => item.eventType === 'API_SUCCESS') ? 'API_SUCCESS' : last.eventType, endpoint, result };
        try {
            const response = await fetch('/api/ai-learning/ambient/observe', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
            const payload = await response.json().catch(() => ({}));
            if (response.ok && payload.success !== false) renderInsight(payload.data || payload);
            else if (response.status !== 401) { setChip('AI tạm chờ dữ liệu', 'warn'); }
        } catch (_) { if (state.booted) setChip('AI offline', 'warn'); }
        state.sending = false;
    }
    function shouldObserveApi(url, method) {
        if (!/^\/api\//.test(url) && !url.includes('/api/')) return false;
        if (/\/api\/ai-learning\/ambient\//.test(url) || /\/api\/health|\/api\/ready/.test(url)) return false;
        if (method === 'GET') {
            if (!state.interactive) return false;
            return /\/api\/(education|learning|assessment|placement|survey|university|english|user|game|tournament|notifications)/.test(url);
        }
        return true;
    }
    function installFetchObserver() {
        const original = global.fetch.bind(global);
        global.fetch = async function ambientFetch(input, init = {}) {
            const url = typeof input === 'string' ? input : String(input?.url || '');
            const method = String(init?.method || input?.method || 'GET').toUpperCase();
            const response = await original(input, init);
            if (shouldObserveApi(url, method)) {
                let result = {};
                try { result = await response.clone().json(); result = result?.data || result || {}; } catch (_) {}
                observe(response.ok ? 'API_SUCCESS' : 'API_ERROR', { endpoint: url.replace(location.origin, ''), method, status: response.status, result }, method !== 'GET');
            }
            return response;
        };
    }
    async function bootstrap() {
        if (state.booted) return;
        state.booted = true;
        panel();
        installFetchObserver();
        try {
            const session = await fetch('/api/auth/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
            if (!session.ok) { document.getElementById('ai-autopilot-panel')?.classList.add('ai-autopilot-hidden'); return; }
            state.session = await session.json().catch(() => ({}));
            const role = state.session?.data?.user?.role || '';
            setTimeout(() => { state.interactive = true; }, 4000);
            observe('PAGE_VIEW', { endpoint: '', method: 'GET', status: 200, result: { role } }, true);
        } catch (_) { document.getElementById('ai-autopilot-panel')?.classList.add('ai-autopilot-hidden'); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap); else bootstrap();
})(window);
