'use strict';

(function exposeAdminCms(global) {
    const api = global.HanhTrinhApi;
    const resources = {
        curriculum: ['education/curriculum-versions', 'Phiên bản chương trình học'],
        courses: ['education/courses', 'Khóa học'],
        questions: ['question-bank/questions', 'Ngân hàng câu hỏi'],
        assessments: ['assessment/assessments', 'Bài đánh giá'],
        survey: ['surveys', 'Khảo sát'],
        placement: ['placement-tests', 'Bài kiểm tra đầu vào'],
        'learning-path': ['learning-path-rules', 'Quy tắc lộ trình học'],
        universities: ['university/university', 'Cơ sở đào tạo'],
        english: ['english-configs', 'TOEIC & IELTS'],
        'national-exam': ['national-exam/blueprints', 'Blueprint kỳ thi mô phỏng'],
        import: ['word-imports', 'Dữ liệu nhập Word chờ xử lý'],
        achievements: ['achievements', 'Thành tích'],
        sources: ['sources', 'Danh mục nguồn'],
        audit: ['audit-logs', 'Nhật ký quản trị']
    };
    const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    const id = item => String(item?._id || item?.id || '');
    const title = item => item?.title || item?.name || item?.code || id(item) || 'Bản ghi không có tên';
    const records = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.data) ? payload.data : payload ? [payload] : [];
    const apiPath = resourcePath => resourcePath.startsWith('university/') ? `/api/${resourcePath}` : `/api/admin/platform/${resourcePath}`;
    const protectedKeys = new Set(['_id','id','createdAt','updatedAt','__v','validation','questionCount','sections','answerKey','ownerUsername','createdBy','sourceRef','provenance']);
    const sensitiveKey = key => /password|secret|token|hash|credential/i.test(key);
    const isSimpleArray = value => Array.isArray(value) && value.every(item => item === null || ['string','number','boolean'].includes(typeof item));
    const scalarFields = item => Object.entries(item || {}).filter(([key, value]) => !protectedKeys.has(key) && !sensitiveKey(key) && (value === null || ['string','number','boolean'].includes(typeof value) || isSimpleArray(value)));
    function fieldValue(value) { return Array.isArray(value) ? value.join('\n') : value == null ? '' : String(value); }
    function inputType(value) { return typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text'; }
    function parseField(value, original) {
        if (Array.isArray(original)) return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => typeof original[0] === 'number' ? Number(line) : typeof original[0] === 'boolean' ? line === 'true' : line);
        if (typeof original === 'number') return value === '' ? null : Number(value);
        if (typeof original === 'boolean') return Boolean(value);
        if (original === null) return value === '' ? null : value;
        return value;
    }
    async function render(root, view) {
        const resource = resources[view] || resources.curriculum;
        root.innerHTML = `<style>.admin-cms-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.admin-cms-field{display:flex;flex-direction:column;gap:5px;min-width:0}.admin-cms-field.full{grid-column:1/-1}.admin-cms-field input,.admin-cms-field textarea,.admin-cms-field select{width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--border,#d5dce7);border-radius:8px;font:inherit}.admin-cms-field textarea{min-height:88px;resize:vertical}.admin-cms-hint{font-size:.85rem;opacity:.8;margin:8px 0}.admin-cms-selected{background:var(--surface,#f7f9fc)}@media(max-width:760px){.admin-cms-fields{grid-template-columns:1fr}}</style>
        <div class="admin-page-heading"><div><h1>${safe(resource[1])}</h1><p>Chỉnh sửa theo trường dữ liệu; trường lồng nhau được giữ nguyên để tránh làm hỏng dữ liệu.</p></div><button class="admin-button" data-cms-load>Tải dữ liệu</button></div>
        <div class="admin-cms-grid"><div class="admin-panel"><h2>Nhóm dữ liệu</h2><div class="admin-resource-list">${Object.entries(resources).map(([key, item]) => `<button class="${key === view ? 'is-active' : ''}" data-resource="${key}">${safe(item[1])}</button>`).join('')}</div></div>
        <div class="admin-panel"><div class="admin-toolbar"><input data-cms-search type="search" placeholder="Tìm mã, tên, tiêu đề…"></div><div class="admin-status" data-cms-status role="status"></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Tên</th><th>Mã</th><th>Trạng thái</th><th>ID</th></tr></thead><tbody data-cms-list><tr><td colspan="4" class="admin-empty">Đang tải dữ liệu…</td></tr></tbody></table></div>
        <div class="admin-editor admin-cms-selected" style="margin-top:18px;padding:16px;border-radius:12px"><h2 data-cms-edit-title>Chọn bản ghi</h2><p class="admin-cms-hint">Không cần nhập JSON. Các danh sách đơn giản có thể nhập mỗi phần tử trên một dòng. Dữ liệu lồng nhau được bảo toàn, cần biểu mẫu chuyên biệt để sửa.</p><form data-cms-form><div data-cms-fields class="admin-cms-fields"><p>Chọn một bản ghi để chỉnh sửa.</p></div><div class="admin-editor-actions" style="margin-top:14px"><button class="admin-button" data-cms-save disabled type="submit">Lưu thay đổi</button><button class="admin-button secondary" data-cms-publish disabled type="button">Công bố</button><button class="admin-button danger" data-cms-archive disabled type="button">Lưu trữ</button></div></form></div></div></div>`;
        const status = root.querySelector('[data-cms-status]'); const list = root.querySelector('[data-cms-list]'); const fields = root.querySelector('[data-cms-fields]'); const loadButton = root.querySelector('[data-cms-load]'); const searchInput = root.querySelector('[data-cms-search]'); const saveButton = root.querySelector('[data-cms-save]'); const publishButton = root.querySelector('[data-cms-publish]'); const archiveButton = root.querySelector('[data-cms-archive]'); const form = root.querySelector('[data-cms-form]'); const editTitle = root.querySelector('[data-cms-edit-title]');
        if (!status || !list || !fields || !loadButton || !searchInput || !saveButton || !publishButton || !archiveButton || !form) return;
        const readOnly = ['audit','import'].includes(view); const canPublish = !['universities','sources','audit','import'].includes(view); let allItems = []; let selected = null;
        const setButtons = enabled => { const invalid = Boolean(selected?.validation && selected.validation.valid === false); saveButton.disabled = !enabled || readOnly; publishButton.disabled = !enabled || !canPublish || invalid; archiveButton.disabled = !enabled || readOnly; publishButton.title = invalid ? (selected.validation.errors || []).join('\n') : ''; };
        function renderFields(item) {
            fields.innerHTML = '';
            const editable = scalarFields(item);
            editable.forEach(([key, value]) => {
                const label = document.createElement('label'); label.className = 'admin-cms-field' + (typeof value === 'string' && value.length > 100 ? ' full' : '');
                const caption = document.createElement('span'); caption.textContent = key; label.appendChild(caption);
                let input;
                if (inputType(value) === 'checkbox') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(value); input.dataset.field = key; }
                else if (Array.isArray(value) || (typeof value === 'string' && value.length > 120)) { input = document.createElement('textarea'); input.value = fieldValue(value); input.dataset.field = key; }
                else { input = document.createElement('input'); input.type = inputType(value); input.value = fieldValue(value); input.dataset.field = key; }
                if (readOnly) input.disabled = true;
                label.appendChild(input); fields.appendChild(label);
            });
            if (!editable.length) fields.innerHTML = '<p>Bản ghi này không có trường đơn giản có thể sửa ở màn hình chung. Dữ liệu cấu trúc phức tạp được giữ nguyên.</p>';
            const complexCount = Object.keys(item || {}).filter(key => !protectedKeys.has(key) && !sensitiveKey(key) && item[key] && typeof item[key] === 'object' && !isSimpleArray(item[key])).length;
            if (complexCount) { const note = document.createElement('p'); note.className = 'admin-cms-hint full'; note.textContent = `${complexCount} trường dữ liệu lồng nhau đang được giữ nguyên để tránh mất dữ liệu. Dùng màn hình chuyên biệt/nhập tài liệu để chỉnh nội dung phức tạp.`; fields.appendChild(note); }
            setButtons(Boolean(id(item)));
        }
        function drawList() {
            const query = searchInput.value.trim().toLocaleLowerCase('vi');
            const items = allItems.filter(item => !query || [title(item), item.code, item.status, item.publicationStatus, id(item)].some(value => String(value || '').toLocaleLowerCase('vi').includes(query)));
            list.innerHTML = '';
            if (!items.length) { list.innerHTML = '<tr><td colspan="4" class="admin-empty">Không có dữ liệu phù hợp.</td></tr>'; return; }
            items.forEach(item => { const row = document.createElement('tr'); const invalid = Boolean(item.validation && item.validation.valid === false); const statusText = invalid ? 'INVALID / NEEDS_REPAIR' : (item.publicationStatus || item.status || item.verification || '—'); row.innerHTML = `<td><button class="admin-button secondary" type="button">${safe(title(item))}</button></td><td>${safe(item.code || '—')}</td><td><span class="admin-badge">${safe(statusText)}</span></td><td>${safe(id(item))}</td>`; row.querySelector('button').addEventListener('click', () => { selected = item; editTitle.textContent = `Chỉnh sửa: ${title(item)}`; renderFields(item); if (invalid) status.textContent = `${item.validation.errors?.length || 0} lỗi cần sửa trước khi công bố: ${(item.validation.errors || []).slice(0,3).join(' · ')}`; }); list.appendChild(row); });
        }
        async function load() { status.textContent = 'Đang tải dữ liệu…'; list.innerHTML = ''; try { const payload = await api.get(`${apiPath(resource[0])}?page=1&limit=100`); allItems = records(payload.data || payload); drawList(); status.textContent = `Đã tải ${allItems.length} bản ghi.`; } catch (error) { list.innerHTML = '<tr><td colspan="4" class="admin-empty">Không thể tải dữ liệu hoặc bạn không có quyền.</td></tr>'; status.textContent = error.message || 'Không thể tải dữ liệu.'; } }
        loadButton.addEventListener('click', load); searchInput.addEventListener('input', drawList); root.querySelectorAll('[data-resource]').forEach(button => button.addEventListener('click', () => { window.location.hash = button.dataset.resource; }));
        form.addEventListener('submit', async event => { event.preventDefault(); if (!selected || readOnly) return; try { const body = {}; fields.querySelectorAll('[data-field]').forEach(input => { const key = input.dataset.field; body[key] = parseField(input.type === 'checkbox' ? input.checked : input.value, selected[key]); }); await api.patch(`${apiPath(resource[0])}/${encodeURIComponent(id(selected))}`, body); status.textContent = 'Đã lưu các trường và ghi audit.'; await load(); } catch (error) { status.textContent = error.message || 'Không thể lưu thay đổi.'; } });
        publishButton.addEventListener('click', async () => { if (!selected) return; try { await api.post(`${apiPath(resource[0])}/${encodeURIComponent(id(selected))}/publish`, {}); status.textContent = 'Đã công bố và ghi audit.'; await load(); } catch (error) { status.textContent = error.message || 'Không thể công bố.'; } });
        archiveButton.addEventListener('click', async () => { if (!selected || !window.confirm(`Lưu trữ bản ghi “${title(selected)}”?`)) return; try { await api.delete(`${apiPath(resource[0])}/${encodeURIComponent(id(selected))}`); status.textContent = 'Đã lưu trữ và ghi audit.'; selected = null; fields.innerHTML = '<p>Chọn một bản ghi để chỉnh sửa.</p>'; setButtons(false); await load(); } catch (error) { status.textContent = error.message || 'Không thể lưu trữ.'; } });
        setButtons(false); load();
    }
    global.HanhTrinhAdminCms = Object.freeze({ render, resources });
})(window);
