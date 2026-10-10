'use strict';
(function exposeLessonProgress(global) {
    const api = global.HanhTrinhApi;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const objectId = value => /^[a-f0-9]{24}$/i.test(String(value || ''));
    function stepsFor(lesson = {}) {
        const steps = [];
        const sections = lesson.theorySections || lesson.payload?.theorySections || [];
        (Array.isArray(sections) ? sections : []).forEach((section, index) => {
            if (String(section?.content || '').trim()) steps.push({ id: `theory-${index}`, label: section.title || `Phần kiến thức ${index + 1}`, type: 'CONTENT' });
        });
        if (!steps.length && String(lesson.theory || lesson.description || '').trim()) steps.push({ id: 'theory', label: 'Lý thuyết chính', type: 'CONTENT' });
        if ((lesson.examples || lesson.payload?.examples || []).length) steps.push({ id: 'examples', label: 'Ví dụ có hướng dẫn', type: 'CONTENT' });
        const practice = lesson.payload?.practiceTasks || lesson.practiceTasks || lesson.activities || [];
        if (Array.isArray(practice) && practice.length) steps.push({ id: 'practice', label: 'Bài luyện tập', type: 'CONTENT' });
        const practical = lesson.payload?.practical || lesson.practical || {};
        if (practical.task || practical.instructions || lesson.programming || (lesson.codingTasks || []).length) steps.push({ id: 'practical', label: 'Thực hành / lab', type: 'CONTENT' });
        if ((lesson.payload?.quickChecks || lesson.quickChecks || []).length) steps.push({ id: 'quick-check', label: 'Tự kiểm tra kiến thức', type: 'CONTENT' });
        if (lesson.lessonTestId || lesson.payload?.lessonTestId || (lesson.assessmentIds || []).length) steps.push({ id: 'assessment', label: 'Bài kiểm tra kiến thức', type: 'ASSESSMENT' });
        return steps;
    }
    function storageKey(course, lesson) { return `htm-lesson-progress:${String(course?._id || course?.id || 'course')}:${String(lesson?._id || lesson?.id || 'lesson')}`; }
    function render(lesson) {
        const content = stepsFor(lesson);
        return `<div class="lesson-progress-widget" data-lesson-progress-root><div class="lesson-progress-top"><strong data-progress-label>Chưa xác minh</strong><span data-progress-count>0/0 điều kiện</span></div><div class="lesson-progress-track" role="progressbar" aria-label="Tiến độ được xác minh" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-progress-bar style="width:0%"></span></div><p class="lesson-progress-status muted" data-progress-status role="status">Tiến độ chỉ được công nhận từ bài kiểm tra và bài thực hành đã chấm, không thể tự tích hoàn thành.</p><section><h4>Nội dung học</h4><ul class="lesson-progress-content" data-content-steps>${content.map(step => `<li>${esc(step.label)} <span class="muted">· ${step.type === 'ASSESSMENT' ? 'Điều kiện đánh giá, không phải thao tác đánh dấu hoàn thành' : 'Nội dung cần học'}</span></li>`).join('') || '<li class="muted">Chưa nhận diện được các mục nội dung.</li>'}</ul></section><section><h4>Điều kiện được xác minh</h4><ul class="lesson-progress-evidence" data-evidence-steps><li class="muted">Đang tải kết quả đánh giá từ máy chủ…</li></ul></section></div>`;
    }
    function renderSummary(root, snapshot = {}) {
        const steps = Array.isArray(snapshot.evidenceSteps) ? snapshot.evidenceSteps : [];
        const completed = steps.filter(step => step.completed);
        const percent = Number(snapshot.progressPercent) || 0;
        const label = root.querySelector('[data-progress-label]');
        const count = root.querySelector('[data-progress-count]');
        const bar = root.querySelector('[data-progress-bar]');
        const track = root.querySelector('[role="progressbar"]');
        const status = root.querySelector('[data-progress-status]');
        const evidence = root.querySelector('[data-evidence-steps]');
        if (label) label.textContent = snapshot.completed ? 'Đã hoàn thành theo kết quả đánh giá' : `${percent}% tiến độ được xác minh`;
        if (count) count.textContent = `${completed.length}/${steps.length} điều kiện`;
        if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (track) track.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, percent))));
        if (evidence) evidence.innerHTML = steps.map(step => `<li class="${step.completed ? 'is-verified' : 'is-pending'}"><strong>${step.completed ? '✓ Đạt' : '○ Chưa đạt'}</strong> — ${esc(step.label)} <small>${esc(step.evidence || '')}</small></li>`).join('') || '<li class="muted">Chưa có điều kiện đánh giá.</li>';
        const issues = Array.isArray(snapshot.configurationIssues) ? snapshot.configurationIssues : [];
        if (status) status.textContent = snapshot.completed ? '🎉 Máy chủ đã xác nhận hoàn thành dựa trên kết quả đã lưu.' : issues.length ? `${issues.map(item => item.message || item.code).join(' ')}` : 'Hãy hoàn thành bài kiểm tra và các bài thực hành được chấm đạt. Đọc bài hoặc nhấn nút không tự hoàn thành tiến độ.';
    }
    async function mount(panel, lesson, course) {
        const root = panel?.querySelector('[data-lesson-progress-root]');
        if (!root) return;
        const lessonId = String(lesson?._id || lesson?.id || '');
        const courseId = String(course?._id || course?.id || '');
        if (!objectId(lessonId) || !objectId(courseId) || !api?.get) {
            renderSummary(root, { progressPercent: 0, evidenceSteps: [], configurationIssues: [{ message: 'Cần đăng nhập và tải bài học đã lưu trên máy chủ để xác minh tiến độ.' }] });
            return;
        }
        try {
            const response = await api.get(`/api/learning/lesson-progress?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`);
            const snapshot = response?.data && typeof response.data === 'object' ? response.data : response;
            if (!snapshot || typeof snapshot !== 'object') throw new Error('Máy chủ không trả về tiến độ hợp lệ.');
            renderSummary(root, snapshot);
        } catch (error) {
            renderSummary(root, { progressPercent: 0, evidenceSteps: [], configurationIssues: [{ message: `Không tải được bằng chứng tiến độ từ máy chủ: ${error.message || 'lỗi kết nối'}.` }] });
        }
    }
    global.HtmLessonProgress = Object.freeze({ stepsFor, storageKey, render, renderSummary, mount });
})(window);
