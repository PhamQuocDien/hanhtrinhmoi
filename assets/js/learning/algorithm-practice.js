'use strict';
(function exposeAlgorithmPractice(global) {
    const api = global.HanhTrinhApi;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const getList = value => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
    const isProgrammingCourse = course => /computing|computer|programming|software|data structure|algorithm|lập trình|thuật toán|công nghệ thông tin|cntt|python|java|javascript|c\+\+/i.test([course?.name, course?.title, course?.description, course?.category, course?.subjectId, course?.academicDomainCode, course?.track].join(' '));
    function mount(root, context = {}) {
        if (!root || !isProgrammingCourse(context.course)) return;
        root.innerHTML = '<article class="ai-v18-card algorithm-practice"><h3>🧑‍💻 Thực hành thuật toán có test case</h3><p class="muted">Chọn một bài, đọc yêu cầu, viết code và nộp để chấm bằng test công khai/ẩn. Đáp án chuẩn và test ẩn không gửi xuống trình duyệt.</p><div data-practice-status>Đang tìm bài thực hành…</div><div data-practice-list></div><div data-practice-editor hidden></div></article>';
        const status = root.querySelector('[data-practice-status]');
        const list = root.querySelector('[data-practice-list]');
        const editor = root.querySelector('[data-practice-editor]');
        let currentTask = null;
        const setStatus = (message, error = false) => { status.textContent = message; status.classList.toggle('is-error', error); };
        async function loadTask(taskId) {
            try {
                const task = await api.get(`/api/learning-system/practice/tasks/${encodeURIComponent(taskId)}`);
                currentTask = task;
                const templates = Array.isArray(task.starterCodeTemplates) ? task.starterCodeTemplates : [];
                const selectedLanguage = templates[0]?.language || task.language || 'javascript';
                const starter = templates.find(item => item.language === selectedLanguage)?.code || task.starterCode || '';
                editor.hidden = false;
                const publicSamples = Array.isArray(task.samples) ? task.samples : Array.isArray(task.visibleTestCases) ? task.visibleTestCases : [];
                const publicWeight = publicSamples.reduce((sum, sample) => sum + Math.max(0.0001, Number(sample.weight) || 1), 0);
                const criteria = Array.isArray(task.scoringCriteria) ? task.scoringCriteria : [];
                editor.innerHTML = `<div class="algorithm-task"><header class="algorithm-task-heading"><div><span class="algorithm-kicker">${esc(task.skillCode || task.topic || 'THUẬT TOÁN')}</span><h4>${esc(task.title)}</h4></div><div class="algorithm-task-badges"><span>${esc(task.difficulty || 'BEGINNER')}</span><span>${Number(task.estimatedMinutes || 20)} phút</span><span>100 điểm</span></div></header><section class="algorithm-spec"><h5>Đề bài</h5><p>${esc(task.statement || task.description)}</p>${task.inputFormat ? `<div><strong>Đầu vào</strong><p>${esc(task.inputFormat)}</p></div>` : ''}${task.outputFormat ? `<div><strong>Đầu ra mong đợi</strong><p>${esc(task.outputFormat)}</p></div>` : ''}${(task.constraints || []).length ? `<div><strong>Ràng buộc</strong><ul>${task.constraints.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}</section><section class="algorithm-scoring"><h5>📊 Cách chấm điểm tự động</h5><p>Điểm = tổng trọng số các test đạt ÷ tổng trọng số các test được chấm × 100. Mỗi test có trọng số riêng; mặc định 1 nếu Admin chưa đặt. Mỗi lượt nộp chạy tối đa 12 test để giới hạn thời gian; hệ thống ưu tiên cả test công khai và test ẩn.</p><div class="algorithm-score-stats"><span><small>Ví dụ/test công khai được cung cấp</small><strong>${publicSamples.length}</strong><small>${publicWeight} trọng số công khai</small></span><span><small>Test ẩn</small><strong>${Number(task.hiddenTestCaseCount || 0)}</strong><small>Chỉ trả số lượng đạt</small></span></div>${criteria.length ? `<strong>Tiêu chí cần chú ý</strong><ul>${criteria.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}<small>Điểm phản ánh mức độ vượt qua test. Độ rõ ràng và phân tích độ phức tạp được phản hồi riêng nếu rubric có cấu hình; không giả lập điểm phong cách code.</small></section><section class="algorithm-samples"><h5>Ví dụ công khai</h5>${publicSamples.map((sample, index) => `<details><summary>Ví dụ ${index + 1} · trọng số ${Number(sample.weight || 1)}</summary><div class="algorithm-sample-grid"><div><strong>Input</strong><pre>${esc(sample.input)}</pre></div><div><strong>Output mong đợi</strong><pre>${esc(sample.expectedOutput)}</pre></div></div>${sample.explanation ? `<p>${esc(sample.explanation)}</p>` : ''}</details>`).join('') || '<p>Admin chưa thêm ví dụ công khai.</p>'}</section><div class="algorithm-editor-grid"><label>Ngôn ngữ lập trình<select data-practice-language>${(templates.length ? templates : [{ language: task.language || 'javascript', code: starter }]).map(item => `<option value="${esc(item.language)}" ${item.language === selectedLanguage ? 'selected' : ''}>${esc(({cpp:'C++17',c:'C11',java:'Java',python:'Python',javascript:'JavaScript'})[item.language] || item.language)}</option>`).join('')}</select></label><label>Mã nguồn của bạn<textarea data-practice-code spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></label></div><div class="algorithm-actions"><button type="button" data-practice-submit>▶ Nộp bài và chấm test (tối đa 12)</button><button type="button" data-practice-hint>Gợi ý</button></div><div data-practice-result aria-live="polite"></div><div data-practice-hints hidden></div></div>`;
                const language = editor.querySelector('[data-practice-language]');
                const code = editor.querySelector('[data-practice-code]');
                code.value = starter;
                language.addEventListener('change', () => { code.value = templates.find(item => item.language === language.value)?.code || ''; });
                editor.querySelector('[data-practice-submit]').addEventListener('click', submit);
                editor.querySelector('[data-practice-hint]').addEventListener('click', () => { const hints = editor.querySelector('[data-practice-hints]'); hints.hidden = !hints.hidden; hints.innerHTML = `<h5>Gợi ý</h5><ol>${(currentTask?.hints || []).map(hint => `<li>${esc(hint)}</li>`).join('') || '<li>Phân tích input/output và các trường hợp biên trước khi viết code.</li>'}</ol>`; });
                setStatus('Đã tải bài. Hãy tự giải trước khi xem gợi ý.');
            } catch (error) { setStatus(error.message || 'Không tải được bài thực hành.', true); }
        }
        async function submit() {
            if (!currentTask) return;
            const button = editor.querySelector('[data-practice-submit]'); const output = editor.querySelector('[data-practice-result]');
            button.disabled = true; output.textContent = 'Đang chấm bài…';
            try {
                const result = await api.post(`/api/learning-system/practice/tasks/${encodeURIComponent(currentTask._id || currentTask.id)}/submit`, { code: editor.querySelector('[data-practice-code]').value, language: editor.querySelector('[data-practice-language]').value });
                const attempt = result.attempt || {};
                const breakdown = attempt.scoreBreakdown || {};
                output.innerHTML = `<div class="algorithm-result ${attempt.status === 'PASSED' ? 'is-pass' : 'is-review'}"><strong>${attempt.status === 'PASSED' ? '✅ Đạt' : '🛠 Cần sửa'} · ${Number(attempt.score || 0)}/100 điểm</strong><p>Trọng số đạt: ${Number(breakdown.earnedWeight ?? 0)}/${Number(breakdown.possibleWeight ?? 0)} · Test công khai: ${Number(attempt.visiblePassed || 0)}/${Number(attempt.visibleTotal || 0)} · Test ẩn: ${Number(attempt.hiddenPassed || 0)}/${Number(attempt.hiddenTotal || 0)}.</p><div class="algorithm-score-stats"><span><small>Điểm từ test công khai</small><strong>${Number(breakdown.visibleEarnedWeight ?? 0)}/${Number(breakdown.visiblePossibleWeight ?? 0)}</strong></span><span><small>Điểm từ test ẩn</small><strong>${Number(breakdown.hiddenEarnedWeight ?? 0)}/${Number(breakdown.hiddenPossibleWeight ?? 0)}</strong></span></div><small>Không hiển thị dữ liệu test ẩn. Kết quả đã được lưu vào hồ sơ kỹ năng nếu server xác nhận lượt chấm thành công.</small></div>${(result.visibleResults || []).map((item, index) => `<details><summary>Test công khai ${index + 1} · ${item.passed ? '✅ Đạt' : '❌ Chưa đạt'} · ${Number(item.pointsEarned || 0)}/${Number(item.weight || 1)} trọng số</summary><div class="algorithm-sample-grid"><div><strong>Kết quả mong đợi</strong><pre>${esc(item.expectedOutput)}</pre></div><div><strong>Kết quả của bạn</strong><pre>${esc(item.actualOutput)}</pre></div></div></details>`).join('')}`;
            } catch (error) { output.innerHTML = `<div class="algorithm-result is-review"><strong>${esc(error.message || 'Không thể chấm bài')}</strong><p>Để chạy code thật cần bật executor biệt lập an toàn trên máy chủ; hệ thống không chạy mã học viên trực tiếp trong tiến trình web.</p></div>`; }
            finally { button.disabled = false; }
        }
        (async () => {
            try {
                const courseId = String(context.course?._id || context.course?.id || '');
                const query = /^[a-f0-9]{24}$/i.test(courseId) ? `?limit=50&courseId=${encodeURIComponent(courseId)}` : '?limit=50';
                const tasks = getList(await api.get(`/api/learning-system/practice/tasks${query}`));
                const trackTasks = tasks.filter(task => /UNIVERSITY_IT|COMPUTING|PROGRAMMING|DSA/.test(String(task.catalogTrack || '')));
                const asList = value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,;]+/).filter(Boolean) : value && typeof value === 'object' ? Object.values(value) : [];
                const skills = [...asList(context.lesson?.skills), ...asList(context.lesson?.knowledge)].map(value => String(value?.code || value?.name || value?.label || value?.title || value).toLowerCase()).filter(Boolean);
                const lessonWords = String(context.lesson?.title || '').toLowerCase().split(/[^a-z0-9À-ỹ]+/i).filter(word => word.length >= 4 && !['with', 'from', 'into', 'this', 'that', 'basic', 'nâng', 'cao'].includes(word));
                const matchingTasks = trackTasks.filter(task => {
                    const haystack = `${task.skillCode || ''} ${task.topic || ''} ${task.title || ''}`.toLowerCase();
                    const taskSkill = String(task.skillCode || '').toLowerCase();
                    return skills.some(skill => haystack.includes(skill) || (taskSkill && skill.includes(taskSkill))) || lessonWords.some(word => haystack.includes(word));
                });
                const available = matchingTasks;
                if (!available.length) { setStatus('Chưa có bài thực hành đã công bố khớp với khóa học và kỹ năng của bài này. Không hiển thị bài khác chủ đề; Admin cần liên kết hoặc công bố bài phù hợp.'); return; }
                list.innerHTML = `<div class="algorithm-task-list">${available.slice(0, 20).map(task => `<button type="button" data-practice-task="${esc(task._id || task.id)}"><strong>${esc(task.title)}</strong><small>${esc(task.skillCode || task.topic || 'Thuật toán')} · ${esc(task.difficulty || 'BEGINNER')} · ${Number(task.estimatedMinutes || 20)} phút</small></button>`).join('')}</div>`;
                list.querySelectorAll('[data-practice-task]').forEach(button => button.addEventListener('click', () => loadTask(button.dataset.practiceTask)));
                setStatus(`${available.length} bài thực hành đã công bố. Mỗi lần nộp chấm tối đa 12 test; kết quả ghi rõ số test công khai và test ẩn đã chạy.`);
            } catch (error) { setStatus(error.message || 'Chưa tải được kho bài lập trình.', true); }
        })();
    }
    global.HtmAlgorithmPractice = Object.freeze({ mount, isProgrammingCourse });
})(window);
