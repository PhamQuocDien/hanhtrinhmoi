'use strict';

(function exposeAdminAiStudio(global) {
    const api = global.HanhTrinhApi;
    const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    const id = item => String(item?._id || item?.id || '');
    const find = (root, selector) => root?.querySelector(selector) || null;
    const list = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data?.items) ? value.data.items : Array.isArray(value?.data) ? value.data : [];

    function render(root) {
        if (!root || !api) return;
        root.innerHTML = `<div class="admin-page-heading"><div><h1>🤖 AI Course Studio</h1><p>Ra lệnh cho AI tạo khóa học đầy đủ: cấu trúc, lý thuyết, ví dụ, audio, luyện tập, kiểm tra từng bài, kiểm tra chương và final assessment.</p></div><span class="admin-badge success">AI Decision + Course Composer</span></div>
        <div class="admin-grid-2">
          <section class="admin-panel"><h2>Tạo khóa học bằng AI</h2><div class="ai-studio-form">
            <label>Yêu cầu khóa học<textarea data-ai-prompt rows="6" placeholder="Ví dụ: Tạo khóa Java OOP cho sinh viên CNTT năm 2, từ nền tảng đến project, 8 chương, mỗi bài có lý thuyết đầy đủ, ví dụ, audio, practice và lesson test; mỗi chương có chapter test và cuối khóa có final assessment."></textarea></label>
            <div class="ai-studio-grid"><label>Đối tượng<input data-ai-audience placeholder="SV CNTT năm 2"></label><label>Ngành<input data-ai-domain placeholder="Công nghệ thông tin / Kỹ thuật phần mềm"></label><label>Học kỳ<input data-ai-semester placeholder="Năm 2 - HK1"></label><label>Grade<input data-ai-grade type="number" min="1" max="12" placeholder="1–12 nếu là K12"></label><label>Môn / subject<input data-ai-subject placeholder="OOP / Toán / English"></label><label>Kỳ thi<input data-ai-exam placeholder="TOEIC / IELTS nếu có"></label><label>Variant<input data-ai-variant placeholder="Academic / General Training"></label><label>Loại khóa<input data-ai-course-type placeholder="Adaptive / Mastery / Exam Prep"></label></div>
            <label class="ai-check"><input data-ai-audio type="checkbox" checked> Tự động tạo audio cho lesson</label>
            <button class="admin-button" data-ai-generate>🤖 Tạo bản nháp hoàn chỉnh</button><div class="admin-status" data-ai-status role="status"></div>
          </div></section>
          <section class="admin-panel"><h2>AI Learning Director</h2><p class="admin-muted">AI đọc dữ liệu học tập mẫu của hệ thống để đưa ra quyết định learning. Với người học thật, Director dùng context tài khoản hiện tại.</p><textarea data-ai-director-prompt rows="4" placeholder="Ví dụ: tìm skill gap và đề xuất khóa học còn thiếu"></textarea><label class="ai-check"><input data-ai-auto type="checkbox"> Nếu AI quyết định cần khóa mới, tự tạo personal course</label><button class="admin-button secondary" data-ai-refresh-director>🤖 Phân tích quyết định</button><pre class="ai-studio-output" data-ai-director>Chưa có quyết định.</pre></section>
        </div>
        <section class="admin-panel"><div class="admin-page-heading compact"><div><h2>AI drafts</h2><p>Khóa và bài học được tạo/lưu ngay khi bản hợp lệ. Publish chỉ sau khi Admin xem lại vì nội dung nội bộ chưa mặc định là giáo trình chính thức.</p></div><button class="admin-button secondary" data-ai-reload>↻ Làm mới</button></div><div data-ai-drafts class="ai-draft-list"></div></section>
        <section class="admin-panel" data-ai-preview hidden><div class="admin-page-heading compact"><div><h2>Preview khóa học</h2><p data-ai-preview-meta></p></div><div class="ai-draft-actions"><button class="admin-button secondary" data-ai-commit>Commit</button><button class="admin-button" data-ai-publish>Publish</button></div></div><pre class="ai-studio-output" data-ai-preview-json></pre></section>`;
        const status = root.querySelector('[data-ai-status]');
        async function loadDrafts() {
            try {
                const drafts = await api.aiAdminDrafts();
                const items = list(drafts);
                const target = find(root, '[data-ai-drafts]');
                if (!target) { if (status) status.textContent = 'Không tìm thấy vùng hiển thị danh sách AI draft.'; return; }
                target.innerHTML = items.length ? items.map(item => `<article class="ai-draft-card"><div><strong>${safe(item.title || 'AI draft')}</strong><small>${safe(item.status)} · ${safe(item.model || 'AI nội bộ')} · ${new Date(item.createdAt || Date.now()).toLocaleString('vi-VN')}</small></div><div class="ai-draft-actions"><button class="admin-button secondary" data-ai-open="${safe(id(item))}">Xem</button>${item.status === 'VALIDATED' ? `<button class="admin-button" data-ai-commit-id="${safe(id(item))}">Commit</button>` : ''}${item.status === 'COMMITTED' && item.committedCourseId ? `<button class="admin-button" data-ai-publish-id="${safe(id(item))}">Publish</button>` : ''}</div></article>`).join('') : '<div class="admin-empty">Chưa có AI draft.</div>';
                target.querySelectorAll('[data-ai-open]').forEach(button => button.addEventListener('click', () => openDraft(button.dataset.aiOpen)));
                target.querySelectorAll('[data-ai-commit-id]').forEach(button => button.addEventListener('click', () => commitDraft(button.dataset.aiCommitId)));
                target.querySelectorAll('[data-ai-publish-id]').forEach(button => button.addEventListener('click', () => publishDraft(button.dataset.aiPublishId)));
            } catch (error) { if (status) status.textContent = error.message || 'Không tải được AI draft.'; }
        }
        async function openDraft(draftId) {
            try {
                const draft = await api.aiAdminDraft(draftId);
                const panel = find(root, '[data-ai-preview]');
                const commitButton = find(panel, '[data-ai-commit]');
                const publishButton = find(panel, '[data-ai-publish]');
                const meta = find(root, '[data-ai-preview-meta]');
                const preview = find(root, '[data-ai-preview-json]');
                if (!panel || !meta || !preview) throw new Error('Thiếu vùng xem trước AI draft. Hãy tải lại trang quản trị.');
                panel.hidden = false; panel.dataset.id = draft._id || draftId;
                if (commitButton) commitButton.hidden = draft.status === 'COMMITTED';
                if (publishButton) publishButton.hidden = draft.status !== 'COMMITTED';
                meta.textContent = `${draft.title || 'AI draft'} · ${draft.status || 'UNKNOWN'} · ${draft.metadata?.lessonCount || draft.validation?.lessonCount || 0} bài học · ${draft.validation?.valid ? 'VALID' : 'REVIEW'}`;
                preview.textContent = JSON.stringify(draft.draft ?? draft, null, 2);
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (error) { if (status) status.textContent = error.message || 'Không mở được draft.'; }
        }
        async function commitDraft(draftId) {
            try { status.textContent = 'Đang materialize khóa học và tạo audio…'; const result = await api.aiAdminCommitDraft(draftId, { generateAudio: true }); status.textContent = `Đã tạo khóa học ${result.course?.name || ''}. ${result.lessonCount || 0} lessons · ${result.audioGenerated || 0} audio.`; await loadDrafts(); } catch (error) { status.textContent = error.message || 'Commit AI draft thất bại.'; }
        }
        async function publishDraft(draftId) {
            try { if (status) status.textContent = 'Đang publish khóa học…'; const result = await api.aiAdminPublishDraft(draftId); if (status) status.textContent = `Đã publish ${result.name || result.code || ''}.`; await loadDrafts(); if (find(root, '[data-ai-preview]')?.dataset.id === draftId) { const meta = find(root, '[data-ai-preview-meta]'); if (meta) meta.textContent += ' · PUBLISHED'; } } catch (error) { if (status) status.textContent = error.message || 'Publish AI draft thất bại.'; }
        }
        const generateButton = find(root, '[data-ai-generate]');
        if (generateButton) generateButton.addEventListener('click', async () => {
            try {
                if (status) status.textContent = 'Bộ biên soạn nội bộ đang tạo cấu trúc và nội dung bài học; mô hình cloud chỉ dùng khi được cấu hình và cần thiết…';
                const payload = { prompt: root.querySelector('[data-ai-prompt]').value, audience: root.querySelector('[data-ai-audience]').value, domain: root.querySelector('[data-ai-domain]').value, semester: root.querySelector('[data-ai-semester]').value, grade: root.querySelector('[data-ai-grade]').value || null, subjectId: root.querySelector('[data-ai-subject]').value, targetExam: root.querySelector('[data-ai-exam]').value, targetVariant: root.querySelector('[data-ai-variant]').value, courseType: root.querySelector('[data-ai-course-type]').value, generateAudio: root.querySelector('[data-ai-audio]').checked };
                const result = await api.aiAdminGenerateCourse(payload);
                if (status) status.textContent = result.materialized ? `Đã tạo và lưu khóa ${result.materialized.courseName} cùng ${result.materialized.lessonCount} bài học và ${result.materialized.assessmentCount} bài kiểm tra. Khóa ở trạng thái nháp, chưa công bố.` : result.validation?.valid ? `Bản nội dung đã hợp lệ (${result.validation.lessonCount} bài) nhưng chưa tạo được bản ghi khóa học.` : `Draft còn lỗi: ${list(result.validation?.errors).join(' ')}`;
                if (result._id) await openDraft(result._id);
                await loadDrafts();
            } catch (error) { if (status) status.textContent = error.message || 'AI generation thất bại.'; }
        });
        find(root, '[data-ai-reload]')?.addEventListener('click', loadDrafts);
        find(root, '[data-ai-commit]')?.addEventListener('click', () => { const draftId = find(root, '[data-ai-preview]')?.dataset.id; if (draftId) commitDraft(draftId); });
        find(root, '[data-ai-publish]')?.addEventListener('click', () => { const draftId = find(root, '[data-ai-preview]')?.dataset.id; if (draftId) publishDraft(draftId); });
        find(root, '[data-ai-refresh-director]')?.addEventListener('click', async () => {
            const prompt = find(root, '[data-ai-director-prompt]'); const auto = find(root, '[data-ai-auto]'); const output = find(root, '[data-ai-director]');
            if (!output) return;
            try { const result = await api.aiDirector({ prompt: prompt?.value || '', autoExecute: Boolean(auto?.checked) }); output.textContent = JSON.stringify(result, null, 2); } catch (error) { output.textContent = error.message || 'Không phân tích được quyết định AI.'; }
        });
        loadDrafts();
    }
    global.HanhTrinhAdminAiStudio = Object.freeze({ render });
})(window);
