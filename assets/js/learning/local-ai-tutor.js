'use strict';
(function exposeLocalAITutor(global) {
    const api = global.HanhTrinhApi;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    function render() {
        return `<section class="ai-v18-card local-ai-tutor" data-local-tutor><div class="local-ai-heading"><div><h3>🧠 Trợ giảng nội bộ</h3><p class="muted">Hỏi về bài học này. Trợ giảng ưu tiên học liệu đã công bố; không có nguồn thì sẽ nói rõ.</p></div><span class="chip" data-local-ai-mode>Đang kiểm tra</span></div><form data-local-ai-form><label for="local-ai-question">Bạn đang vướng ở đâu?</label><textarea id="local-ai-question" name="question" rows="3" maxlength="1200" required placeholder="Ví dụ: Hãy giải thích bước này bằng một ví dụ đơn giản…"></textarea><button class="button button-primary" type="submit">Hỏi trợ giảng</button><span class="muted" data-local-ai-status role="status"></span></form><div class="local-ai-answer" data-local-ai-answer hidden></div></section>`;
    }
    async function mount(root, { course, lesson } = {}) {
        if (!root || !api?.post) return;
        root.innerHTML = render();
        const mode = root.querySelector('[data-local-ai-mode]');
        const form = root.querySelector('[data-local-ai-form]');
        const status = root.querySelector('[data-local-ai-status]');
        const answer = root.querySelector('[data-local-ai-answer]');
        try {
            const runtime = await api.get('/api/ai-learning/local/status');
            mode.textContent = runtime.localModelEnabled && runtime.reachable && runtime.modelInstalled ? `Mô hình local: ${runtime.model}` : 'Kho tri thức nội bộ';
            mode.title = runtime.note || runtime.reason || '';
        } catch (_) { mode.textContent = 'Trợ giảng nội bộ'; }
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const question = String(new FormData(form).get('question') || '').trim();
            if (question.length < 3) { status.textContent = 'Nhập câu hỏi cụ thể hơn.'; return; }
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true; status.textContent = 'Đang tìm học liệu phù hợp…'; answer.hidden = true;
            try {
                const result = await api.post('/api/ai-learning/local/ask', { question, courseId: course?._id || course?.id || '', lessonTitle: lesson?.title || '' });
                const citations = (result.citations || []).map((source, index) => `<li><strong>[${esc(source.ref || `S${index + 1}`)}] ${esc(source.title)}</strong>${source.courseTitle ? ` · ${esc(source.courseTitle)}` : ''}</li>`).join('');
                answer.innerHTML = `<div class="local-ai-answer-body">${esc(result.answer || 'Chưa có câu trả lời.').replace(/\n/g, '<br>')}</div>${citations ? `<div class="local-ai-sources"><strong>Nguồn trong kho học liệu</strong><ul>${citations}</ul></div>` : '<p class="muted">Chưa có nguồn bài học phù hợp; không tự suy đoán đáp án.</p>'}<small class="muted">${esc(result.model || result.mode || 'LOCAL_RETRIEVAL_ONLY')} · Không gọi API AI cloud</small>`;
                answer.hidden = false; status.textContent = result.grounded ? 'Đã tìm thấy học liệu liên quan.' : 'Chưa đủ dữ liệu trong kho để trả lời chắc chắn.';
            } catch (error) { status.textContent = `Không thể hỏi lúc này: ${error.message}`; }
            finally { button.disabled = false; }
        });
    }
    global.HtmLocalAITutor = Object.freeze({ render, mount });
})(window);
