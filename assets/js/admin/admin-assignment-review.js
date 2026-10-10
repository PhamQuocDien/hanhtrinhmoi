'use strict';
(function exposeAssignmentReview(global) {
    const api = global.HanhTrinhApi;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    const dateLabel = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
    async function render(root) {
        root.innerHTML = `<div class="admin-page-heading"><div><h1>Bài nộp cần chấm</h1><p>Đọc sản phẩm học sinh đã nộp, chấm theo rubric của bài học và trả nhận xét cụ thể. Điểm chỉ được lưu khi người chấm xác nhận.</p></div><button class="admin-button secondary" data-assignment-refresh>Làm mới</button></div><div class="admin-toolbar"><label>Trạng thái <select data-assignment-status-filter><option value="SUBMITTED">Chờ chấm</option><option value="GRADED">Đã chấm</option><option value="RETURNED">Yêu cầu sửa</option></select></label></div><p class="admin-status" data-assignment-review-status role="status"></p><div data-assignment-review-list class="admin-list"><div class="admin-empty">Đang tải bài nộp…</div></div>`;
        const list = root.querySelector('[data-assignment-review-list]');
        const status = root.querySelector('[data-assignment-review-status]');
        const filter = root.querySelector('[data-assignment-status-filter]');
        async function load() {
            status.textContent = 'Đang tải…';
            try {
                const items = await api.get(`/api/admin/assignments/submissions?status=${encodeURIComponent(filter.value)}&limit=100`);
                const rows = Array.isArray(items) ? items : [];
                list.innerHTML = rows.length ? rows.map(item => `<article class="admin-panel" style="margin-bottom:14px"><div class="admin-page-heading"><div><h2>${escapeHtml(item.taskTitle)}</h2><p>Học sinh: <strong>${escapeHtml(item.username)}</strong> · Khóa: ${escapeHtml(item.courseCode || item.courseId || '—')} · Bài: ${escapeHtml(item.lessonId)} · Nộp lúc: ${dateLabel(item.submittedAt)}</p></div><span class="admin-badge ${item.status === 'GRADED' ? 'success' : ''}">${escapeHtml(item.status)}</span></div><div style="white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:var(--admin-soft,#f5f8fb);border-radius:10px">${escapeHtml(item.submissionText || '(Không có phần trình bày)')}</div>${item.submissionUrl ? `<p><a href="${escapeHtml(item.submissionUrl)}" target="_blank" rel="noopener noreferrer">Mở liên kết sản phẩm</a></p>` : ''}${item.attachmentId ? `<p><a href="/api/admin/assignments/submissions/${encodeURIComponent(item._id)}/attachment">Tải tệp: ${escapeHtml(item.attachmentFileName || 'sản phẩm học sinh')}</a></p>` : ''}${item.status === 'GRADED' ? `<p><strong>Điểm:</strong> ${escapeHtml(item.score)}/100 · <strong>Người chấm:</strong> ${escapeHtml(item.reviewerUsername || '—')}</p><p><strong>Nhận xét:</strong> ${escapeHtml(item.feedback || '—')}</p>` : ''}<form data-grade-form data-submission-id="${escapeHtml(item._id)}" class="admin-form-grid" style="margin-top:14px"><label>Điểm (0–100)<input name="score" type="number" min="0" max="100" step="0.5" value="${escapeHtml(item.score ?? 80)}" required></label><label style="grid-column:1/-1">Nhận xét và hướng sửa<textarea name="feedback" rows="3" maxlength="5000" required placeholder="Nêu điểm tốt, lỗi cần sửa và bước tiếp theo…">${escapeHtml(item.feedback || '')}</textarea></label><button class="admin-button primary" type="submit">Lưu điểm và nhận xét</button><p class="admin-status" data-grade-status role="status"></p></form></article>`).join('') : '<div class="admin-empty">Không có bài nộp ở trạng thái này.</div>';
                status.textContent = `${rows.length} bài nộp được tải (tối đa 100).`;
                list.querySelectorAll('[data-grade-form]').forEach(form => form.addEventListener('submit', async event => {
                    event.preventDefault();
                    const button = form.querySelector('button[type="submit"]');
                    const message = form.querySelector('[data-grade-status]');
                    const formData = new FormData(form);
                    if (button) button.disabled = true;
                    if (message) message.textContent = 'Đang lưu điểm…';
                    try {
                        const result = await api.post(`/api/admin/assignments/submissions/${encodeURIComponent(form.dataset.submissionId)}/grade`, { score: Number(formData.get('score')), feedback: String(formData.get('feedback') || '').trim() });
                        if (message) message.textContent = result.message || 'Đã lưu điểm.';
                        await load();
                    } catch (error) { if (message) message.textContent = error.message || 'Không thể lưu điểm.'; }
                    finally { if (button) button.disabled = false; }
                }));
            } catch (error) { list.innerHTML = `<div class="admin-empty">Không thể tải bài nộp: ${escapeHtml(error.message || 'Lỗi hệ thống')}</div>`; status.textContent = 'Kiểm tra quyền learning.lesson.read và kết nối MongoDB.'; }
        }
        filter.addEventListener('change', load);
        root.querySelector('[data-assignment-refresh]').addEventListener('click', load);
        await load();
    }
    global.HanhTrinhAdminAssignmentReview = Object.freeze({ render });
})(window);
