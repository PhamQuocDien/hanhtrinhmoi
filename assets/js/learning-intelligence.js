'use strict';
(function initLearningIntelligence(global) {
    const api = global.HanhTrinhApi;
    const $ = id => document.getElementById(id);
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const state = { coach: null, errors: [], errorStatus: 'open', session: null, selectedSubject: '', selectedSkill: '' };
    function asList(value) { return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : []; }
    function setText(id, value) { const el = $(id); if (el) el.textContent = value; }
    function difficultyLabel(value) { return ({ EASY: 'Cơ bản', MEDIUM: 'Trung bình', HARD: 'Nâng cao' })[value] || value || 'Trung bình'; }
    function showMessage(text, error = false) { const box = $('intel-global-message'); if (!box) return; box.hidden = false; box.textContent = text; box.className = `intel-global-message${error ? ' error' : ''}`; }
    async function loadAll() { await Promise.all([loadCoach(), loadErrors(), loadStatus()]); fillPracticeSelectors(); }
    async function loadStatus() {
        try { const data = await api.learningIntelligenceStatus(); setText('engine-status', data.geminiConfigured ? `AI Coach: Gemini ${data.geminiModel}` : 'AI Coach: chế độ thông minh tích hợp'); setText('engine-errors', `${data.openErrors} lỗi đang mở`); } catch (error) { setText('engine-status', 'Đang học offline logic'); }
    }
    async function loadCoach() {
        const grade = $('intel-grade')?.value || '';
        const data = await api.learningCoachToday(grade);
        state.coach = data;
        setText('coach-date', data.date || 'Hôm nay'); setText('coach-date-copy', data.gradeName ? `${data.gradeName} · ${data.date || 'Hôm nay'}` : (data.date || 'Hôm nay')); setText('coach-summary', data.summary); setText('coach-minutes', `${data.todayMinutes} phút`); setText('coach-week-minutes', `${data.weekMinutes} phút`); setText('coach-target', `${data.targetMinutes} phút/ngày`); setText('coach-progress-text', `${data.completionPercent}%`);
        const progress = $('coach-progress'); if (progress) progress.style.width = `${data.completionPercent}%`;
        setText('coach-focus', data.focus ? data.focus.skill : 'Chưa đủ dữ liệu'); setText('coach-focus-meta', data.focus ? `Mastery ${Math.round(Number(data.focus.accuracy || 0))}% · ${data.focus.status || 'Đang học'}` : 'Làm một phiên luyện để hệ thống bắt đầu đo mastery.');
        const tasks = $('coach-tasks');
        if (tasks) tasks.innerHTML = (data.tasks || []).map(task => `<article class="intel-task ${task.completed ? 'completed' : ''}"><div class="intel-task-icon">${escapeHtml(task.icon || '🎯')}</div><div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description)}</p><small>${escapeHtml(task.reason || '')} · ${Number(task.minutes || 0)} phút</small></div><button class="intel-btn secondary" data-coach-task="${escapeHtml(task.id)}" ${task.completed ? 'disabled' : ''}>${task.completed ? '✓ Đã hoàn tất' : 'Hoàn tất'}</button></article>`).join('') || '<div class="intel-empty">Chưa có nhiệm vụ. Hãy làm placement hoặc một bài luyện đầu tiên.</div>';
    }
    async function loadErrors() {
        const data = await api.learningErrors(state.errorStatus, 50);
        state.errors = data.errors || [];
        renderErrors();
    }
    function renderErrors() {
        const root = $('error-list'); if (!root) return;
        if (!state.errors.length) { root.innerHTML = `<div class="intel-empty">${state.errorStatus === 'resolved' ? 'Chưa có lỗi đã xử lý.' : 'Chưa có lỗi nào đang mở. Hãy làm bài học hoặc phiên luyện thích ứng để hệ thống ghi nhận lỗi.'}</div>`; return; }
        root.innerHTML = state.errors.map(item => `<article class="intel-error ${item.resolved ? 'resolved' : ''}"><h3>${item.resolved ? '✅' : '⚠️'} ${escapeHtml(item.skill || 'Kiến thức')} · ${escapeHtml(difficultyLabel(item.difficulty))}</h3><p>${escapeHtml(item.prompt || '')}</p><div class="intel-error-meta"><span>📝 ${escapeHtml(item.subjectId || 'Môn học')}</span><span>🔁 Sai ${Number(item.occurrenceCount || 1)} lần</span><span>📅 Ôn ${item.nextReviewAt ? new Date(item.nextReviewAt).toLocaleDateString('vi-VN') : 'sớm'}</span></div>${item.explanation ? `<div class="intel-feedback">${escapeHtml(item.explanation)}</div>` : ''}${!item.resolved && String(item._id || '').length === 24 ? `<div class="intel-error-actions"><button class="intel-btn secondary" data-resolve-error="${escapeHtml(item._id)}">Đánh dấu đã xử lý</button><button class="intel-btn" data-start-error="${escapeHtml(item.subjectId || '')}" data-error-skill="${escapeHtml(item.skill || '')}" data-error-question="${escapeHtml(item.questionId || '')}">Luyện lỗi này</button></div>` : ''}</article>`).join('');
    }
    function fillPracticeSelectors() {
        const select = $('practice-subject'); if (!select || !state.coach) return;
        const subjects = new Map();
        for (const task of state.coach.tasks || []) if (task.subjectId) subjects.set(task.subjectId, task.subjectId);
        if (state.coach.focus?.subjectId) subjects.set(state.coach.focus.subjectId, state.coach.focus.subjectId);
        const options = [...subjects.keys()];
        select.innerHTML = '<option value="">Tự chọn theo điểm yếu</option>' + options.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
        select.value = state.selectedSubject || '';
    }
    async function startPractice(subjectId = '', skill = '', questionId = '') {
        const grade = $('intel-grade')?.value || '';
        const body = { grade: Number(grade) || undefined, subjectId: subjectId || $('practice-subject')?.value || '', skill: skill || $('practice-skill')?.value || '', questionId: questionId || '' };
        const button = $('start-practice'); if (button) { button.disabled = true; button.textContent = 'Đang tạo phiên…'; }
        try { state.session = await api.adaptivePracticeStart(body); state.selectedSubject = body.subjectId || ''; state.selectedSkill = body.skill || ''; renderQuestion(); $('practice-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch (error) { showMessage(error.message || 'Không thể tạo phiên luyện.', true); }
        finally { if (button) { button.disabled = false; button.textContent = '⚡ Bắt đầu 10 câu thích ứng'; } }
    }
    function renderQuestion() {
        const root = $('practice-shell'); if (!root) return;
        const session = state.session;
        if (!session) { root.innerHTML = '<div class="intel-empty">Chọn môn/skill rồi bắt đầu phiên luyện. Sau mỗi câu, độ khó sẽ tự thay đổi.</div>'; return; }
        const q = session.question;
        if (!q) { root.innerHTML = '<div class="intel-empty">Phiên luyện đã kết thúc.</div>'; return; }
        const options = q.options || [];
        root.innerHTML = `<div class="intel-quiz"><div class="intel-quiz-top"><div class="intel-question-meta"><span class="intel-pill">Câu ${(session.total || 0) + 1}/10</span><span class="intel-pill">${escapeHtml(q.subjectId)}</span><span class="intel-pill">${escapeHtml(difficultyLabel(q.difficulty))}</span><span class="intel-pill">${escapeHtml(q.skill)}</span></div><strong>${session.total || 0}/10</strong></div><div class="intel-progress"><span style="width:${Math.min(100, Math.round((session.total || 0) / 10 * 100))}%"></span></div><h3 class="intel-question">${escapeHtml(q.prompt)}</h3><div class="intel-options">${options.map((option,index) => `<label class="intel-option"><input type="radio" name="intel-answer" value="${index}"><span>${escapeHtml(option)}</span></label>`).join('')}</div><div style="margin-top:14px"><button class="intel-btn" id="submit-adaptive-answer">Nộp câu này</button></div><div id="adaptive-feedback"></div></div>`;
        $('submit-adaptive-answer')?.addEventListener('click', submitAnswer);
    }
    async function submitAnswer() {
        const answer = document.querySelector('input[name="intel-answer"]:checked');
        if (!answer) { showMessage('Hãy chọn một đáp án trước khi nộp.', true); return; }
        const button = $('submit-adaptive-answer'); button.disabled = true; button.textContent = 'Đang chấm…';
        try {
            const result = await api.adaptivePracticeAnswer(state.session.sessionId, Number(answer.value));
            const data = result;
            const feedback = $('adaptive-feedback'); if (feedback) feedback.innerHTML = `<div class="intel-feedback ${data.answer?.isCorrect ? 'correct' : 'wrong'}">${data.answer?.isCorrect ? '✅ Chính xác!' : '❌ Chưa đúng.'} ${escapeHtml(data.answer?.explanation || '')}<br><b>Đáp án đúng:</b> ${escapeHtml(state.session.question?.options?.[data.answer?.correctAnswer] ?? String(data.answer?.correctAnswer ?? ''))}<br><span>Độ khó tiếp theo: <b>${escapeHtml(difficultyLabel(data.currentDifficulty))}</b></span></div>`;
            if (data.completed) { state.session = { ...state.session, ...data, question: null, status: 'COMPLETED' }; renderResult(); await loadCoach(); await loadErrors(); await loadStatus(); return; }
            state.session = { ...state.session, ...data }; setTimeout(renderQuestion, 900);
        } catch (error) { showMessage(error.message || 'Không thể chấm câu hỏi.', true); button.disabled = false; button.textContent = 'Nộp câu này'; }
    }
    function renderResult() { const root = $('practice-shell'); if (!root) return; root.innerHTML = `<div class="intel-result"><div class="intel-kicker">ADAPTIVE PRACTICE</div><strong>${Math.round(Number(state.session.score || 0))}%</strong><div>Đúng ${Number(state.session.correct || 0)}/${Number(state.session.total || 0)} câu</div><p class="intel-muted">${state.session.score >= 80 ? 'Rất tốt. Hệ thống sẽ tăng độ khó trong các phiên tiếp theo.' : 'Hệ thống sẽ ưu tiên phần bạn còn yếu và hạ độ khó khi cần.'}</p><div class="intel-links"><button class="intel-btn" id="restart-practice">Luyện thêm 10 câu</button><a href="lo-trinh-hoc-tap.html">Mở lộ trình</a></div></div>`; $('restart-practice')?.addEventListener('click', () => startPractice(state.selectedSubject, state.selectedSkill)); }
    async function askCoach() {
        const input = $('coach-question'); const output = $('coach-answer'); if (!input || !output || !input.value.trim()) return;
        output.textContent = 'AI Coach đang phân tích…';
        try { const data = await api.learningCoachAsk(input.value); output.textContent = data.answer || 'Không có phản hồi.'; } catch (error) { output.textContent = error.message || 'Không thể gọi AI Coach.'; }
    }
    document.addEventListener('click', async event => {
        const task = event.target.closest('[data-coach-task]'); if (task) { task.disabled = true; try { await api.learningCoachComplete({ taskId: task.dataset.coachTask, taskType: 'COACH_TASK', grade: Number($('intel-grade')?.value || state.coach?.grade || 1), subjectId: state.coach?.tasks?.find(item => item.id === task.dataset.coachTask)?.subjectId || '', lessonId: state.coach?.tasks?.find(item => item.id === task.dataset.coachTask)?.lessonId || '', minutes: state.coach?.tasks?.find(item => item.id === task.dataset.coachTask)?.minutes || 10 }); task.textContent = '✓ Đã ghi nhận'; showMessage('Đã ghi nhận nhiệm vụ hôm nay.'); await loadCoach(); } catch (error) { task.disabled = false; showMessage(error.message || 'Không thể ghi nhận.', true); } }
        const resolve = event.target.closest('[data-resolve-error]'); if (resolve) { resolve.disabled = true; try { await api.resolveLearningError(resolve.dataset.resolveError); await loadErrors(); showMessage('Đã đánh dấu lỗi đã xử lý.'); } catch (error) { resolve.disabled = false; showMessage(error.message || 'Không thể cập nhật lỗi.', true); } }
        const startError = event.target.closest('[data-start-error]'); if (startError) { await startPractice(startError.dataset.startError, startError.dataset.errorSkill, startError.dataset.errorQuestion || ''); }
        const filter = event.target.closest('[data-error-filter]'); if (filter) { state.errorStatus = filter.dataset.errorFilter; document.querySelectorAll('[data-error-filter]').forEach(btn => btn.classList.toggle('active', btn === filter)); await loadErrors(); }
    });
    $('start-practice')?.addEventListener('click', () => startPractice()); $('ask-coach')?.addEventListener('click', askCoach); $('coach-question')?.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') askCoach(); }); $('intel-grade')?.addEventListener('change', loadCoach);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => loadAll().catch(error => showMessage(error.message || 'Không thể tải trung tâm học tập.', true))); else loadAll().catch(error => showMessage(error.message || 'Không thể tải trung tâm học tập.', true));
})(window);
