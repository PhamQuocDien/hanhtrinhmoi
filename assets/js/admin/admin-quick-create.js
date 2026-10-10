'use strict';

(function exposeAdminQuickCreate(global) {
    const api = global.HanhTrinhApi;
    const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    const selectValue = value => String(value || '').toUpperCase();

    function render(root) {
        root.innerHTML = `
            <div class="admin-page-heading"><div><h1>Tạo khóa học, bài giảng & bài kiểm tra</h1><p>Trình soạn nội dung gọn: tải Word/Markdown, nhận diện cấu trúc, xem trước và lưu bản nháp. Chỉ công bố sau khi đã rà soát.</p></div><span class="admin-badge success">Word · Markdown · TXT</span></div>
            <div class="quick-create-grid">
                <section class="admin-panel quick-create-form-panel">
                    <div class="quick-create-step"><span>1</span><div><h2>Nhập tài liệu</h2><p>Chọn loại nội dung hoặc để hệ thống tự nhận diện. Có thể tải tệp hoặc dán nội dung trực tiếp.</p></div></div>
                    <form id="quick-create-form" class="quick-create-form">
                        <label>Tên nội dung<input id="qc-title" maxlength="180" placeholder="Ví dụ: Bài 1 — Hàm trong Python"></label>
                        <label>Muốn tạo loại nào?<select id="qc-target"><option value="AUTO">Tự nhận diện</option><option value="COURSE">Khóa học</option><option value="LESSON">Bài học / lý thuyết</option><option value="LECTURE">Bài giảng</option><option value="QUESTION_BANK">Ngân hàng câu hỏi</option><option value="ASSESSMENT">Bài kiểm tra / đề thi</option></select></label>
                        <div class="quick-create-meta"><label>Cấp học<select id="qc-level"><option value="">Tự xác định</option><option value="PRIMARY">Tiểu học</option><option value="SECONDARY_LOWER">THCS</option><option value="SECONDARY_UPPER">THPT</option><option value="HIGHER_EDUCATION">Đại học</option><option value="ENGLISH_CERTIFICATION">Chứng chỉ / ngoại ngữ</option></select></label><label>Lớp (nếu có)<input id="qc-grade" type="number" min="1" max="12" placeholder="1–12"></label></div>
                        <div class="quick-create-meta"><label>Môn / kỹ năng<input id="qc-subject" placeholder="Ví dụ: Python, Excel, TOEIC"></label><label>Mã khóa liên kết / mã khóa mới<input id="qc-course-code" placeholder="Ví dụ: PYTHON-01"></label></div>
                        <div class="quick-create-meta" id="qc-assessment-settings"><label>Loại bài kiểm tra<select id="qc-assessment-type"><option value="FREE_TEST">Bài kiểm tra tự do</option><option value="LESSON_TEST">Kiểm tra bài học</option><option value="CHAPTER_TEST">Kiểm tra chương</option><option value="MIDTERM">Giữa kỳ</option><option value="FINAL">Cuối kỳ</option><option value="MOCK">Đề thi thử</option><option value="DIAGNOSTIC">Kiểm tra đầu vào</option></select></label><label>Thời gian làm bài (phút)<input id="qc-duration" type="number" min="5" max="300" value="30"></label></div>
                        <label id="qc-passing-label">Điểm đạt (%)<input id="qc-passing" type="number" min="0" max="100" value="70"></label>
                        <label>Tải tệp Word / Markdown<input id="qc-file" type="file" accept=".docx,.md,.markdown,.txt,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"><small>Hỗ trợ .docx, .md, .markdown, .txt; tối đa 3 MB mỗi tệp.</small></label>
                        <label>Nội dung (có thể dán Markdown)<textarea id="qc-content" rows="12" placeholder="# Tiêu đề bài học\n\n## Lý thuyết\nGiải thích chi tiết…\n\n## Ví dụ\n…\n\n## Luyện tập\n…\n\nĐối với đề thi, dùng:\nCâu 1: Nội dung câu hỏi\nA. Lựa chọn A\nB. Lựa chọn B\nĐáp án: A"></textarea></label>
                        <div class="quick-create-actions"><button type="button" id="qc-preview" class="admin-button">Đọc tài liệu & xem trước</button><button type="button" id="qc-save" class="admin-button" disabled>Lưu bản nháp</button><span id="qc-status" role="status" aria-live="polite"></span></div>
                    </form>
                </section>
                <section class="admin-panel quick-create-preview-panel"><div class="quick-create-step"><span>2</span><div><h2>Bản xem trước</h2><p>Kiểm tra mục lục, số từ, câu hỏi và cảnh báo trước khi lưu.</p></div></div><div id="qc-preview-body" class="quick-create-preview-empty"><strong>Chưa có bản xem trước</strong><p>Chọn tệp hoặc dán nội dung, sau đó nhấn “Đọc tài liệu & xem trước”.</p></div><div id="qc-created" class="quick-create-created" hidden></div></section>
            </div>
            <section class="admin-panel quick-create-guide"><h2>Mẫu tài liệu để nhận diện tốt</h2><div class="quick-create-guide-grid"><article><h3>Khóa học / bài giảng</h3><pre># Tên bài
## Mục tiêu
...
## Lý thuyết
...
## Ví dụ
...
## Thực hành
...
## Tổng kết
...</pre></article><article><h3>Bài kiểm tra</h3><pre># Kiểm tra chương 1
Câu 1: ...
A. ...
B. ...
C. ...
D. ...
Đáp án: B
Giải thích: ...</pre></article></div><p class="quick-create-note">Tài liệu được lưu ở trạng thái bản nháp. Hệ thống không tự đánh dấu tài liệu tải lên là official và không tự công bố đề khi chưa được rà soát.</p></section>`;

        const $ = selector => root.querySelector(selector);
        const status = $('#qc-status');
        const previewBody = $('#qc-preview-body');
        const typeSelect = $('#qc-target');
        const assessmentSettings = $('#qc-assessment-settings');
        const passingLabel = $('#qc-passing-label');
        const updateTypeVisibility = () => {
            const type = typeSelect.value;
            if (assessmentSettings) assessmentSettings.hidden = !['ASSESSMENT','AUTO'].includes(type);
            if (passingLabel) passingLabel.hidden = !['ASSESSMENT','AUTO'].includes(type);
        };
        typeSelect.addEventListener('change', updateTypeVisibility);
        updateTypeVisibility();
        const previewButton = $('#qc-preview');
        const saveButton = $('#qc-save');
        let importId = '';
        let latestPreview = null;

        const metadata = () => ({
            educationLevel: $('#qc-level').value,
            grade: $('#qc-grade').value ? Number($('#qc-grade').value) : null,
            subjectId: $('#qc-subject').value.trim(),
            courseCode: $('#qc-course-code').value.trim(),
            assessmentType: $('#qc-assessment-type').value,
            durationMinutes: Math.max(5, Math.min(300, Number($('#qc-duration').value) || 30)),
            passingScore: Math.max(0, Math.min(100, Number($('#qc-passing').value) || 70))
        });
        function showPreview(data) {
            const preview = data.preview || {};
            latestPreview = data;
            importId = String(data.importId || importId);
            if (preview.title && !$('#qc-title').value.trim()) $('#qc-title').value = preview.title;
            if (preview.extractedText) $('#qc-content').value = preview.extractedText;
            if ($('#qc-target').value === 'AUTO') $('#qc-target').value = data.targetType || preview.targetType || 'LESSON';
            const sections = (preview.sections || []).slice(0, 24).map(section => `<li><span>${safe(section.title || 'Phần nội dung')}</span><small>${safe((section.content || '').trim().split(/\s+/).filter(Boolean).length)} từ</small></li>`).join('');
            const questions = (preview.questions || []).slice(0, 12).map((question, index) => `<article class="qc-question"><strong>Câu ${index + 1} · ${safe(question.type || 'single_choice')}</strong><p>${safe(question.prompt)}</p><small>${safe((question.options || []).length)} lựa chọn ${question.answer === undefined ? '· chưa có đáp án nhận diện' : '· có đáp án nhận diện'}</small></article>`).join('');
            const warnings = (data.validation?.warnings || []).map(message => `<li>${safe(message)}</li>`).join('');
            const errors = (data.validation?.errors || []).map(message => `<li>${safe(message.message || message.field || message)}</li>`).join('');
            previewBody.className = 'quick-create-preview';
            previewBody.innerHTML = `<div class="qc-preview-stats"><span><small>Loại</small><b>${safe(data.targetType || preview.targetType)}</b></span><span><small>Số từ</small><b>${safe(preview.wordCount || 0)}</b></span><span><small>Mục/heading</small><b>${safe((preview.sections || []).length)}</b></span><span><small>Câu hỏi</small><b>${safe((preview.questions || []).length)}</b></span></div><h3>${safe($('#qc-title').value || preview.title || 'Nội dung mới')}</h3><p class="qc-muted">Tệp: ${safe(data.filename || 'Nội dung dán trực tiếp')} · bộ nhận diện: ${safe(preview.parser || 'built-in')}</p>${errors ? `<div class="qc-validation qc-error"><b>Cần sửa trước khi lưu</b><ul>${errors}</ul></div>` : ''}${warnings ? `<div class="qc-validation qc-warning"><b>Lưu ý</b><ul>${warnings}</ul></div>` : ''}<h3>Cấu trúc được nhận diện</h3><ul class="qc-section-list">${sections || '<li>Không nhận diện heading; nội dung vẫn có thể lưu thành bản nháp.</li>'}</ul>${questions ? `<h3>Các câu hỏi đã nhận diện</h3><div class="qc-question-list">${questions}</div>` : ''}<details><summary>Xem toàn bộ văn bản đã trích xuất</summary><pre class="qc-full-text">${safe(preview.extractedText || '')}</pre></details>`;
            saveButton.disabled = !importId || Boolean(data.validation?.errors?.length);
            status.textContent = data.validation?.errors?.length ? 'Đã nhận diện nhưng còn lỗi; chỉnh nội dung rồi xem trước lại.' : 'Đã nhận diện. Hãy rà soát nội dung rồi lưu bản nháp.';
        }
        function validateFile(file) {
            const extension = file.name.toLowerCase().split('.').pop();
            if (!['docx','md','markdown','txt'].includes(extension)) throw new Error('Định dạng không hỗ trợ. Hãy chọn .docx, .md, .markdown hoặc .txt.');
            if (file.size > 3 * 1024 * 1024) throw new Error('Tệp lớn hơn 3 MB. Hãy chia tài liệu thành các phần nhỏ hơn.');
            return extension;
        }
        async function readFile(file, extension) {
            if (extension === 'docx') return { rawDocx: true };
            return { contentText: await file.text() };
        }
        previewButton.addEventListener('click', async () => {
            try {
                previewButton.disabled = true; saveButton.disabled = true; status.textContent = 'Đang đọc và nhận diện tài liệu…';
                const file = $('#qc-file').files?.[0];
                let data;
                if (file) {
                    const extension = validateFile(file);
                    const content = await readFile(file, extension);
                    const body = { filename: file.name, mimeType: file.type || (extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain'), size: file.size, targetType: $('#qc-target').value, title: $('#qc-title').value.trim(), ...metadata(), ...content };
                    data = content.rawDocx
                        ? await api.uploadDocx('/api/admin/platform/word-imports/preview-docx', file, body)
                        : await api.post('/api/admin/platform/word-imports/preview', body);
                } else {
                    const contentText = $('#qc-content').value.trim();
                    if (!contentText) throw new Error('Hãy tải tệp hoặc dán nội dung trước khi xem trước.');
                    data = await api.post('/api/admin/platform/word-imports/preview', { filename: 'noi-dung-dan-truc-tiep.md', mimeType: 'text/markdown', size: 0, targetType: $('#qc-target').value, title: $('#qc-title').value.trim(), ...metadata(), contentText });
                }
                showPreview(data);
                if (file) $('#qc-file').value = '';
            } catch (error) { status.textContent = error.message || 'Không thể nhận diện tài liệu.'; }
            finally { previewButton.disabled = false; }
        });
        saveButton.addEventListener('click', async () => {
            try {
                if (!importId || !latestPreview) throw new Error('Hãy tạo bản xem trước trước.');
                saveButton.disabled = true; status.textContent = 'Đang cập nhật bản xem trước…';
                const targetType = selectValue($('#qc-target').value || latestPreview.targetType);
                const updated = await api.patch(`/api/admin/platform/word-imports/${encodeURIComponent(importId)}/preview`, { title: $('#qc-title').value.trim(), targetType, contentText: $('#qc-content').value, metadata: metadata() });
                showPreview(updated);
                if (updated.validation?.errors?.length) throw new Error('Bản xem trước còn lỗi nên chưa thể lưu.');
                status.textContent = 'Đang lưu bản nháp…';
                const committed = await api.post(`/api/admin/platform/word-imports/${encodeURIComponent(importId)}/commit`, {});
                const created = committed.createdEntityIds || committed.import?.committedEntityIds || [];
                const createdPanel = $('#qc-created');
                if (!createdPanel) throw new Error('Thiếu vùng hiển thị kết quả lưu nội dung (qc-created). Hãy tải lại trang Admin.');
                createdPanel.hidden = false;
                createdPanel.innerHTML = `<strong>Đã lưu bản nháp thành công</strong><p>Loại nội dung: ${safe(committed.targetType || targetType)} · số bản ghi: ${safe(created.length)}</p><p>Import ID: <code>${safe(importId)}</code></p><p>Vào mục Khóa học & bài học, Ngân hàng câu hỏi hoặc Đánh giá & kỳ thi để rà soát và công bố phù hợp.</p><button type="button" class="admin-button secondary" id="qc-new">Tạo nội dung tiếp theo</button>`;
                createdPanel.querySelector('#qc-new')?.addEventListener('click', () => render(root));
                status.textContent = 'Hoàn tất. Nội dung vẫn ở trạng thái bản nháp.';
                saveButton.disabled = true;
            } catch (error) { status.textContent = error.message || 'Không thể lưu bản nháp.'; saveButton.disabled = !importId || Boolean(latestPreview?.validation?.errors?.length); }
        });
    }
    global.HanhTrinhAdminQuickCreate = Object.freeze({ render });
})(window);
