'use strict';
(function adaptiveEvidencePlan() {
    const api = window.HanhTrinhApi;
    const status = document.getElementById('adaptive-evidence-status');
    const content = document.getElementById('adaptive-evidence-content');
    const button = document.getElementById('adaptive-plan-rebuild');
    let autoPollCount = 0;
    let autoPollTimer = null;
    if (!status || !content || !api) return;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const rows = value => Array.isArray(value) ? value : Array.isArray(value?.recommendations) ? value.recommendations : [];
    function render(recommendations, meta = {}) {
        if (!recommendations.length) {
            content.innerHTML = '<div class="learning-source">Chưa có đủ bằng chứng để cá nhân hóa. Hãy hoàn thành khảo sát và placement; hệ thống sẽ tự tạo khóa cá nhân và các bài học tương ứng khi catalog chưa có tài liệu phù hợp.</div>';
            return;
        }
        content.innerHTML = recommendations.map((item, index) => {
            const title = item.practiceTaskTitle || item.lessonTitle || item.courseName || item.skill || 'Bước học tiếp theo';
            const sub = item.reason || (item.courseGap ? 'Hệ thống đang tạo khóa học và gắn bài học cho kỹ năng này' : 'Đề xuất theo kết quả hiện tại');
            const target = item.courseId ? `<a class="learning-btn secondary" href="${item.courseSource === 'PERSONAL_AI' ? 'ai-course.html' : 'khoa-hoc-chi-tiet.html'}?id=${encodeURIComponent(item.courseId)}">Mở khóa học</a>` : '';
            const retry = item.courseGap ? `<button class="learning-btn primary" type="button" data-retry-gap="${esc(item.skill || '')}">Thử tạo khóa học + bài học</button>` : '';
            const mins = Math.max(1, Number(item.estimatedMinutes || 15));
            return `<article class="learning-content-card adaptive-step"><div class="adaptive-step-head"><span class="learning-kicker">BƯỚC ${index + 1} · ${esc(item.type || (item.courseGap ? 'COURSE_GAP' : 'LESSON'))}</span><strong>${esc(item.priority >= 80 ? 'Ưu tiên cao' : item.priority >= 50 ? 'Ưu tiên vừa' : 'Theo lộ trình')}</strong></div><h3>${esc(title)}</h3><p>${esc(sub)}</p><div class="learning-course-path"><span>🧠 ${esc(item.skill || 'Kỹ năng')}</span><span>🎯 Mục tiêu ${esc(item.targetLevel ?? 80)}%</span><span>⏱ ${mins} phút</span>${item.ageBand ? `<span>👤 ${esc(item.ageBand)}</span>` : ''}</div><div class="learning-step-gap"><span style="width:${Math.max(0, Math.min(100, Number(item.currentLevel || 0)))}%"></span></div><small>Mức hiện tại ${esc(item.currentLevel ?? 0)}% · khoảng cách ${esc(item.gap ?? 0)}%</small><div class="personalized-plan-actions">${target}${retry}${item.courseGap ? '<span class="learning-source">Chưa có khóa học được liên kết. Hệ thống chỉ cập nhật khi đã lưu và kiểm tra được bài học cùng bài kiểm tra thật.</span>' : ''}</div></article>`;
        }).join('');
        content.querySelectorAll('[data-retry-gap]').forEach(retryButton => retryButton.addEventListener('click', async () => {
            autoPollCount = 0;
            retryButton.disabled = true;
            status.textContent = 'Đang biên soạn khóa học, lưu bài học và kiểm tra tính toàn vẹn…';
            try {
                const result = await api.post('/api/learning-system/plan/retry-gaps', { skill: retryButton.dataset.retryGap || '' });
                const items = rows(result.recommendations);
                if (items.length) render(items, result);
                else await load();
                status.textContent = result.message || (result.autoCreatedCourseCount ? 'Đã tạo khóa học cá nhân.' : 'Chưa tạo xong; khoảng trống vẫn được giữ để không gắn liên kết giả.');
            } catch (error) {
                status.textContent = error.message || 'Không thể thử tạo khóa học lúc này.';
                retryButton.disabled = false;
            }
        }));
        const age = meta.age == null ? 'chưa khai báo ngày sinh' : `${meta.age} tuổi`;
        const provisionStatus = meta.autoProvisioning?.status || '';
        status.textContent = provisionStatus === 'STARTED' ? `Đang tự tạo khóa học cho các kỹ năng còn thiếu; ${recommendations.length} đề xuất · ${age}.` : provisionStatus === 'RETRY_WAIT' ? `Một số khóa chưa tạo được; bạn có thể bấm “Thử tạo khóa học + bài học” để thử lại · ${age}.` : `Đã đối chiếu kỹ năng, lỗi học tập và học liệu thật; ${recommendations.length} đề xuất · ${age}.`;
        if (autoPollTimer) clearTimeout(autoPollTimer);
        if (provisionStatus === 'STARTED' && autoPollCount < 8) {
            autoPollCount += 1;
            autoPollTimer = setTimeout(() => load(), 4000);
        } else if (!recommendations.some(item => item.courseGap)) autoPollCount = 0;
    }
    async function load() {
        status.textContent = 'Đang phân tích hồ sơ, kết quả và catalog…';
        content.innerHTML = '<div class="learning-loading">Đang nạp lộ trình…</div>';
        try {
            const result = await api.get('/api/learning-system/plan/recommendations');
            const items = rows(result.recommendations);
            render(items, result);
        } catch (error) {
            status.textContent = 'Chưa tải được lộ trình cá nhân hóa.';
            content.innerHTML = `<div class="learning-source">${esc(error.message || 'Bạn hãy đăng nhập và thử lại.')}</div>`;
        }
    }
    button?.addEventListener('click', async () => {
        button.disabled = true; status.textContent = 'Đang tạo phiên bản lộ trình mới…';
        try {
            const result = await api.post('/api/learning-system/plan/rebuild', {});
            const steps = rows(result.steps).length ? rows(result.steps) : rows(result.recommendations);
            render(steps.map(step => ({ ...step, lessonTitle: step.title || step.lessonTitle, courseId: step.courseId, courseName: step.courseName, currentLevel: step.currentLevel, targetLevel: step.targetLevel, gap: step.gap, estimatedMinutes: step.estimatedMinutes })), result);
            status.textContent = `Đã tạo lộ trình phiên bản ${result.plan?.version || 'mới'}; đề xuất được liên kết tới tài liệu thực nếu có.`;
        } catch (error) { status.textContent = error.message || 'Không thể cập nhật lộ trình.'; }
        finally { button.disabled = false; }
    });
    load();
})();
