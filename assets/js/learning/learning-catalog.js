'use strict';

(function initLearningCatalog(global) {
    const api = global.HanhTrinhApi;
    const $ = id => document.getElementById(id);
    const state = {
        track: 'K12',
        courses: [],
        selectedCourse: null,
        selectedLesson: null,
        profile: null,
        university: { university: [], faculty: [], field: [], disciplineGroup: [], major: [], specialization: [], trainingProgram: [], course: [] },
        universitySelected: {}
    };
    const trackMeta = {
        K12: { label: 'Phổ thông 1–12', description: 'Chương trình được phân tầng rõ theo chương trình → cấp học → lớp → môn → khóa học → Unit/Chủ đề → bài học → luyện tập → đánh giá.' },
        UNIVERSITY: { label: 'Đại học', description: 'Cơ sở đào tạo → Khoa → Lĩnh vực → Nhóm ngành → Ngành → Chuyên ngành → Chương trình → Khóa → Học kỳ → Học phần → Bài học.' },
        TOEIC: { label: 'TOEIC 4 kỹ năng', description: 'Placement → Listening → Reading → Speaking → Writing → Practice → Mock → Result.' },
        IELTS: { label: 'IELTS Academic / General Training', description: 'Variant → Placement → Listening → Reading → Writing → Speaking → Practice → Mock → Estimated Result.' }
    };
    const safe = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.data) ? payload.data : [];
    const toList = payload => Array.isArray(payload) ? payload : typeof payload === 'string' ? payload.split(/[,;\n]/).map(item => item.trim()).filter(Boolean) : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.data) ? payload.data : payload && typeof payload === 'object' ? Object.values(payload).filter(item => ['string','number'].includes(typeof item)) : [];
    const normalizeTheory = value => Array.isArray(value) ? value.map(String).filter(Boolean) : value ? [String(value)] : [];
    function renderReadableContent(value, chunkCards = false) {
        const raw = String(value ?? '').replace(/\r/g, '').trim();
        if (!raw) return '';
        const escape = safe;
        function shortPieces(text, maxChars = 220) {
            const clauses = String(text || '').split(/(?<=[.!?。！？])\s+|(?<=;)\s+/u).map(item => item.trim()).filter(Boolean);
            const pieces = [];
            for (const clause of clauses) {
                if (clause.length <= maxChars) { pieces.push(clause); continue; }
                let buffer = '';
                for (const word of clause.split(/\s+/u)) {
                    if (word.length > maxChars) {
                        if (buffer) { pieces.push(buffer); buffer = ''; }
                        for (let offset = 0; offset < word.length; offset += maxChars) pieces.push(word.slice(offset, offset + maxChars));
                        continue;
                    }
                    if (buffer && `${buffer} ${word}`.length > maxChars) { pieces.push(buffer); buffer = word; }
                    else buffer = `${buffer}${buffer ? ' ' : ''}${word}`;
                }
                if (buffer) pieces.push(buffer);
            }
            const groups = []; let buffer = ''; let count = 0;
            for (const piece of pieces) {
                if (buffer && (count >= 2 || `${buffer} ${piece}`.length > maxChars + 35)) { groups.push(buffer); buffer = ''; count = 0; }
                buffer = `${buffer}${buffer ? ' ' : ''}${piece}`; count += 1;
                if (count >= 2 || buffer.length >= maxChars) { groups.push(buffer); buffer = ''; count = 0; }
            }
            if (buffer) groups.push(buffer);
            return groups;
        }
        const paragraphHtml = (text) => {
            const groups = shortPieces(text);
            return groups.map((item, index) => chunkCards
                ? `<article class="learning-content-piece"><small>Ý nhỏ ${index + 1}</small><p>${escape(item)}</p></article>`
                : `<p class="learning-content-chunk">${escape(item)}</p>`).join('');
        };
        const segments = raw.split(/(?=Bước\s+\d+\s*:)/iu);
        let html = ''; let steps = [];
        const flushSteps = () => {
            if (steps.length) {
                html += `<ol class="learning-content-steps">${steps.map(item => {
                    const match = item.match(/^Bước\s+(\d+)\s*:\s*([\s\S]*)$/iu);
                    return `<li>${match ? `<strong>Bước ${escape(match[1])}</strong>` : ''}${paragraphHtml(match ? match[2] : item)}</li>`;
                }).join('')}</ol>`;
                steps = [];
            }
        };
        for (const segment of segments) {
            if (/^Bước\s+\d+\s*:/iu.test(segment.trim())) { steps.push(segment.trim()); continue; }
            flushSteps();
            const lines = segment.split(/\n{1,}/u).map(item => item.trim()).filter(Boolean);
            let bullets = [];
            const flushBullets = () => {
                if (bullets.length) { html += `<ul class="learning-content-points">${bullets.map(item => `<li>${paragraphHtml(item.replace(/^(?:[-•*]|\d+[.)])\s*/u, ''))}</li>`).join('')}</ul>`; bullets = []; }
            };
            for (const line of lines) {
                if (/^(?:[-•*]|\d+[.)])\s+/u.test(line)) bullets.push(line);
                else { flushBullets(); html += paragraphHtml(line); }
            }
            flushBullets();
        }
        flushSteps();
        return html;
    }

    function showSection(id, visible) {
        const el = $(id);
        if (el) el.hidden = !visible;
    }

    function setStatus(message, tone = '') {
        const el = $('learning-status');
        if (!el) return;
        el.textContent = message || '';
        el.dataset.tone = tone;
    }

    function setText(id, value, fallback = '—') {
        const el = $(id);
        if (el) el.textContent = value === undefined || value === null || value === '' ? fallback : String(value);
    }

    function renderProfile(profile) {
        state.profile = profile || {};
        const education = profile?.education || {};
        const learning = profile?.learning || {};
        const age = profile?.profile?.age;
        const grade = Number(education.grade || 0);
        setText('learner-age', age, 'Chưa có ngày sinh');
        setText('learner-status', education.educationStatus, 'Chưa khai báo');
        setText('learner-level', education.educationLevel, 'Chưa khai báo');
        setText('learner-grade', grade >= 1 && grade <= 12 ? `Lớp ${grade}` : education.programName || 'Chưa khai báo');
        setText('learner-goal', toList(learning.goals).join(', '), 'Chưa khai báo');
        if (grade >= 1 && grade <= 12) {
            const filter = $('grade-filter');
            if (filter && !filter.value) filter.value = String(grade);
        }
    }

    function populateGradeOptions() {
        const select = $('grade-filter');
        if (!select || select.dataset.ready === 'true') return;
        select.dataset.ready = 'true';
        select.innerHTML = '<option value="">Tất cả lớp</option>' + Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}">Lớp ${index + 1}</option>`).join('');
    }

    function renderTrackHeader() {
        const meta = trackMeta[state.track] || trackMeta.K12;
        setText('track-title', meta.label);
        setText('track-description', meta.description);
        document.querySelectorAll('[data-learning-track]').forEach(button => button.classList.toggle('is-active', button.dataset.learningTrack === state.track));
        document.querySelectorAll('[data-track-panel]').forEach(panel => { panel.hidden = panel.dataset.trackPanel !== state.track; });
        setText('crumb-level', state.track === 'K12' ? 'Cấp học' : state.track === 'UNIVERSITY' ? 'Đại học' : state.track);
        if (state.track !== 'K12') {
            showSection('catalog-view', false);
            showSection('course-detail-view', false);
            showSection('lesson-detail-view', false);
        }
        if (state.track === 'K12') {
            showSection('catalog-view', true);
            showSection('course-detail-view', false);
            showSection('lesson-detail-view', false);
        }
    }

    function renderK12Catalog() {
        const root = $('course-catalog');
        if (!root) return;
        const selectedGrade = $('grade-filter')?.value || '';
        const selectedLevel = $('level-filter')?.value || '';
        const selectedSubject = $('subject-filter')?.value || '';
        const query = ($('search-filter')?.value || '').trim().toLowerCase();
        let items = state.courses.slice().filter(item => (!selectedGrade || String(item.grade) === selectedGrade) && (!selectedLevel || item.educationLevel === selectedLevel) && (!selectedSubject || item.subjectId === selectedSubject));
        if (query) items = items.filter(item => JSON.stringify(item).toLowerCase().includes(query));
        if (!items.length) {
            root.innerHTML = '<div class="learning-empty"><strong>Chưa có khóa học phù hợp.</strong><p>Kiểm tra bộ lọc lớp/môn. Hệ thống có adapter K12 đọc trực tiếp curriculum-data.js để tránh trường hợp database chưa hydrate.</p></div>';
            setStatus('Không tìm thấy khóa học theo bộ lọc hiện tại.', 'error');
            return;
        }
        const groups = new Map();
        for (const course of items.sort((a, b) => Number(a.grade || 99) - Number(b.grade || 99) || String(a.subjectName || a.name).localeCompare(String(b.subjectName || b.name), 'vi'))) {
            if (!groups.has(course.grade)) groups.set(course.grade, []);
            groups.get(course.grade).push(course);
        }
        root.innerHTML = [...groups.entries()].map(([grade, courses]) => `<section class="learning-grade-block"><header class="learning-grade-head"><div><div class="learning-kicker">${safe(courses[0]?.educationLevel || '')}</div><h3>Lớp ${safe(grade)}</h3><small>${courses.length} môn/khóa học · chương trình ${safe(courses[0]?.programCode || 'VN-GDPT')}</small></div><span class="learning-chip">${courses.reduce((sum, item) => sum + Number(item.lessonCount || 0), 0)} bài</span></header><div class="learning-subjects">${courses.map(courseCard).join('')}</div></section>`).join('');
        root.querySelectorAll('[data-course-open]').forEach(button => button.addEventListener('click', () => openCourse(button.dataset.courseOpen)));
        const subjects = [...new Map(items.map(item => [item.subjectId, item.subjectName || item.name])).entries()];
        const subjectFilter = $('subject-filter');
        if (subjectFilter) {
            const current = subjectFilter.value;
            subjectFilter.innerHTML = '<option value="">Tất cả môn</option>' + subjects.sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'vi')).map(([id, name]) => `<option value="${safe(id)}">${safe(name)}</option>`).join('');
            subjectFilter.value = subjects.some(([id]) => id === current) ? current : '';
        }
        setStatus(`Đã sắp xếp ${items.length} khóa học theo chương trình → cấp học → lớp → môn.`);
        setText('crumb-grade', selectedGrade ? `Lớp ${selectedGrade}` : 'Lớp 1–12', 'Lớp 1–12');
    }

    function courseCard(course) {
        const label = course.subjectName || course.name;
        const source = course.sourceRef?.verification === 'full_text_verified' ? 'Nguồn đã xác minh toàn văn' : 'Nguồn cần xác minh';
        const levelName = course.educationLevel === 'PRIMARY' ? 'Tiểu học' : course.educationLevel === 'SECONDARY_LOWER' ? 'THCS' : 'THPT';
        return `<article class="learning-course-card"><div class="learning-course-top"><div><div class="learning-kicker">${safe(levelName)} · Lớp ${safe(course.grade)}</div><h4>${safe(label)}</h4></div><span class="learning-chip">${safe(course.code || '')}</span></div><p>${safe(course.description || `Khóa học ${label} lớp ${course.grade}.`)}</p><div class="learning-course-meta"><span class="learning-chip">${Number(course.unitCount || course.unitMap?.length || 0)} Unit</span><span class="learning-chip">${Number(course.lessonCount || 0)} bài học</span><span class="learning-chip">${course.compulsory ? 'Bắt buộc' : 'Lựa chọn'}</span></div><div class="learning-course-actions"><button class="learning-btn primary" type="button" data-course-open="${safe(course.id || course._id)}">Mở khóa học</button><span class="learning-source">${safe(source)}</span></div></article>`;
    }

    async function loadK12Courses() {
        setStatus('Đang nạp danh mục K12…');
        const payload = await api.courses(new URLSearchParams({ track: 'K12', page: '1', limit: '200' }).toString());
        state.courses = list(payload);
        renderK12Catalog();
    }

    async function openCourse(id) {
        try {
            setStatus('Đang mở khóa học…');
            const data = await api.course(id);
            const course = data.course || data;
            state.selectedCourse = course;
            showSection('catalog-view', false);
            showSection('course-detail-view', true);
            showSection('lesson-detail-view', false);
            setText('course-detail-title', course.name || course.title, 'Khóa học');
            setText('course-detail-description', course.description, 'Chưa có mô tả.');
            setText('crumb-level', course.educationLevel || 'Cấp học');
            setText('crumb-grade', course.grade ? `Lớp ${course.grade}` : '—');
            setText('crumb-subject', course.subjectName || course.subjectId, 'Môn học');
            setText('crumb-course', course.name || course.title, 'Khóa học');
            const path = $('course-detail-path');
            if (path) path.innerHTML = `<span class="learning-chip">${safe(course.programName || 'Chương trình')}</span><span class="learning-chip">${safe(course.educationLevel || '')}</span>${course.grade ? `<span class="learning-chip">Lớp ${safe(course.grade)}</span>` : ''}<span class="learning-chip">${safe(course.subjectName || course.subjectId || '')}</span><span class="learning-chip">${Number(course.lessonCount || data.lessons?.length || 0)} bài học</span>`;
            const units = Array.isArray(data.units) ? data.units : groupLessonsByUnit(data.lessons || []);
            const root = $('course-units');
            if (!root) return;
            root.innerHTML = units.length ? units.map(unit => `<section class="learning-unit"><header class="learning-unit-head"><div><div class="learning-kicker">UNIT ${safe(unit.unit)}</div><h3>${safe(unit.title || 'Chủ đề')}</h3></div><span class="learning-chip">${unit.lessons.length} bài</span></header><div class="learning-unit-body">${unit.lessons.map(lesson => `<div class="learning-lesson-row"><div class="learning-lesson-no">Bài ${safe(lesson.legacyId || lesson.order || '')}</div><div class="learning-lesson-info"><strong>${safe(lesson.title)}</strong><small>${safe(lesson.topic || '')} · ${safe(lesson.phase || '')} · ${safe(lesson.difficulty || '')} · ${safe(lesson.estimatedMinutes || '—')} phút</small></div><button class="learning-btn secondary" type="button" data-lesson-open="${safe(lesson.id)}">Học bài</button></div>`).join('')}</div></section>`).join('') : '<div class="learning-empty">Khóa học chưa có bài học được công bố.</div>';
            root.querySelectorAll('[data-lesson-open]').forEach(button => button.addEventListener('click', () => openLesson(button.dataset.lessonOpen)));
            setStatus(`Đã mở khóa học ${course.name || course.title}. Chọn Unit → bài học để học nội dung đầy đủ.`);
            $('course-detail-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) { setStatus(error.message || 'Không thể mở khóa học.', 'error'); }
    }

    function groupLessonsByUnit(lessons) {
        const groups = new Map();
        for (const lesson of lessons) {
            const unit = Number(lesson.unit || 1);
            if (!groups.has(unit)) groups.set(unit, { unit, title: lesson.unitTitle || `Unit ${unit}`, lessons: [] });
            groups.get(unit).lessons.push(lesson);
        }
        return [...groups.values()];
    }

    async function openLesson(id) {
        try {
            setStatus('Đang nạp toàn bộ nội dung bài học…');
            const data = await api.lesson(id);
            const lesson = data.lesson || {};
            state.selectedLesson = { ...lesson, navigation: data.navigation || {}, course: state.selectedCourse };
            showSection('course-detail-view', false);
            showSection('catalog-view', false);
            showSection('lesson-detail-view', true);
            setText('lesson-detail-title', lesson.title, 'Bài học');
            const meta = $('lesson-detail-meta');
            if (meta) meta.innerHTML = `<span class="learning-chip">Lớp ${safe(lesson.grade)}</span><span class="learning-chip">${safe(lesson.subjectName || lesson.subjectId)}</span><span class="learning-chip">Unit ${safe(lesson.unit || '—')}</span><span class="learning-chip">${safe(lesson.estimatedMinutes || '—')} phút</span><span class="learning-chip">${safe(lesson.difficulty || '')}</span>`;
            setText('crumb-grade', `Lớp ${lesson.grade}`);
            setText('crumb-subject', lesson.subjectName || lesson.subjectId, 'Môn học');
            setText('crumb-course', state.selectedCourse?.name || 'Khóa học', 'Khóa học');
            renderLessonContent(lesson);
            renderLessonQuestions(lesson.questions || []);
            renderLessonAuxiliary(lesson);
            const nextButton = $('next-lesson');
            if (nextButton) nextButton.disabled = !state.selectedLesson.navigation?.nextLessonId;
            wireAiLesson();
            setStatus(`Đã tải nội dung bài học, ${lesson.questions?.length || 0} câu luyện tập.`);
            $('lesson-detail-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) { setStatus(error.message || 'Không thể mở bài học.', 'error'); }
    }

    function renderLessonContent(lesson) {
        const root = $('lesson-theory');
        if (!root) return;
        const sections = Array.isArray(lesson.theorySections) ? lesson.theorySections : [];
        const theory = normalizeTheory(lesson.theory);
        const objectives = Array.isArray(lesson.objectives) ? lesson.objectives : [];
        const keyPoints = Array.isArray(lesson.keyPoints) ? lesson.keyPoints : [];
        const sectionHtml = sections.length ? `<div class="learning-theory-toolbar"><span>${sections.length} phần lý thuyết — mở từng phần để học theo nhịp nhỏ</span><div><button type="button" class="learning-btn secondary" data-expand-lesson-sections>Mở tất cả</button><button type="button" class="learning-btn secondary" data-collapse-lesson-sections>Thu gọn</button></div></div>${sections.map((section, index) => `<details class="learning-theory-box learning-theory-section" ${index === 0 ? 'open' : ''}><summary><span>${safe(section.title || `Phần ${index + 1}`)}</span><small>Phần ${index + 1}/${sections.length}</small></summary><div class="learning-theory-section-content">${section.content ? renderReadableContent(section.content, true) : `<ul>${(section.bullets || []).map(item => `<li>${safe(item)}</li>`).join('')}</ul>`}</div></details>`).join('')}` : `<div class="learning-theory-summary">${theory.map(item => renderReadableContent(item, true)).join('')}</div>`;
        root.innerHTML = `${objectives.length ? `<div class="learning-theory-box"><h4>Mục tiêu bài học</h4><ul>${objectives.map(item => `<li>${safe(item)}</li>`).join('')}</ul></div>` : ''}${sectionHtml}${keyPoints.length ? `<div class="learning-theory-box"><h4>Điểm cần nhớ</h4><ul>${keyPoints.map(item => `<li>${safe(item)}</li>`).join('')}</ul></div>` : ''}<div class="learning-theory-box"><h4>Từ khóa</h4><p>${safe(toList(lesson.glossary).join(' · ') || 'Chưa có')}</p></div><div class="learning-theory-box"><h4>Lỗi thường gặp</h4><ul>${toList(lesson.commonMistakes).map(item => `<li>${safe(item)}</li>`).join('') || '<li>Chưa có dữ liệu.</li>'}</ul></div><div class="learning-theory-box"><h4>Tự kiểm tra trước khi làm bài</h4><ul>${toList(lesson.quickChecks).map(item => `<li>${safe(item)}</li>`).join('') || '<li>Hãy tự nói lại ý chính của bài học bằng lời của em.</li>'}</ul></div>`;
        root.querySelector('[data-expand-lesson-sections]')?.addEventListener('click', () => root.querySelectorAll('details.learning-theory-section').forEach(section => { section.open = true; }));
        root.querySelector('[data-collapse-lesson-sections]')?.addEventListener('click', () => root.querySelectorAll('details.learning-theory-section').forEach(section => { section.open = false; }));
        const source = $('lesson-source');
        if (source) source.textContent = lesson.sourceRef ? `Nguồn: ${lesson.sourceRef.sourceType || 'unknown'} · ${lesson.sourceRef.documentName || 'chưa có tài liệu'} · trạng thái ${lesson.sourceRef.verification || 'unverified'}` : 'Chưa có source mapping.';
    }

    function renderLessonAuxiliary(lesson) {
        const steps = $('lesson-steps');
        if (steps) steps.innerHTML = Array.isArray(lesson.studySteps) && lesson.studySteps.length ? `<ol>${lesson.studySteps.map(item => `<li>${safe(item)}</li>`).join('')}</ol>` : '<p>Chưa có hướng dẫn học.</p>';
        const tasks = $('lesson-tasks');
        if (tasks) tasks.innerHTML = Array.isArray(lesson.practiceTasks) && lesson.practiceTasks.length ? `<ul>${lesson.practiceTasks.map(item => `<li>${safe(item)}</li>`).join('')}</ul>` : '<p>Phần thực hành sẽ lấy từ practice/assessment của bài.</p>';
    }

    function renderLessonQuestions(questions) {
        const root = $('lesson-questions');
        const form = $('lesson-practice-form');
        if (!root || !form) return;
        form.reset?.();
        if (!questions.length) {
            root.innerHTML = '<div class="learning-empty"><strong>Chưa có câu luyện tập cho bài học này.</strong><p>Kiểm tra question bank của bài hoặc trạng thái Publish trong CMS.</p></div>';
            form.hidden = true;
            return;
        }
        root.innerHTML = questions.map((question, index) => `<fieldset class="learning-question"><legend>Câu ${index + 1}</legend><p>${safe(question.prompt || '')}</p><div class="learning-options">${(question.options || []).length ? question.options.map((option, optionIndex) => `<label class="learning-option"><input type="radio" name="${safe(question.id)}" value="${optionIndex}" required><span>${safe(option)}</span></label>`).join('') : `<input class="learning-answer-input" name="${safe(question.id)}" placeholder="Nhập câu trả lời…" required>`}</div></fieldset>`).join('');
        form.hidden = false;
        const result = $('lesson-practice-result');
        if (result) result.hidden = true;
    }

    async function submitPractice(event) {
        event.preventDefault();
        const lesson = state.selectedLesson;
        if (!lesson) return;
        const answers = {};
        for (const question of lesson.questions || []) {
            const selector = `input[name="${CSS.escape(question.id)}"]`;
            const input = document.querySelector(`${selector}:checked`) || document.querySelector(selector);
            if (!input || input.value === '') { setPracticeResult('Vui lòng trả lời đủ câu hỏi.', true); return; }
            answers[question.id] = Number.isNaN(Number(input.value)) ? input.value : Number(input.value);
        }
        try {
            const result = await api.submitLegacyLesson(lesson.grade, lesson.subjectId, lesson.legacyId || lesson.id, answers);
            setPracticeResult(`Điểm: ${result.score}/10 · Đúng ${result.correct}/${result.total}. ${result.passed ? 'Bạn đã đạt và có thể tiếp tục bài kế tiếp.' : 'Hãy xem lại phần giải thích và luyện lại.'}`, !result.passed);
            if (result.passed && lesson.navigation?.nextLessonId) {
                const next = $('next-lesson');
                if (next) next.disabled = false;
            }
        } catch (error) { setPracticeResult(error.message || 'Không thể nộp bài.', true); }
    }

    function setPracticeResult(message, fail = false) {
        const el = $('lesson-practice-result');
        if (!el) return;
        el.className = `learning-result${fail ? ' fail' : ''}`;
        el.textContent = message;
        el.hidden = false;
    }

    function wireAiLesson() {
        const button = $('ai-lesson-help');
        if (!button || button.dataset.wired === 'true') return;
        button.dataset.wired = 'true';
        button.addEventListener('click', async () => {
            const output = $('ai-lesson-output');
            const question = $('ai-lesson-question');
            if (!output || !state.selectedLesson) return;
            output.textContent = 'Đang nhờ Gemini giải thích…';
            showSection('ai-lesson-view', true);
            try {
                const result = await api.lessonHelp({ grade: state.selectedLesson.grade, subject: state.selectedLesson.subjectName || state.selectedLesson.subjectId, topic: state.selectedLesson.topic, question: question?.value || '', lessonContent: { title: state.selectedLesson.title, topic: state.selectedLesson.topic, objectives: state.selectedLesson.objectives, theory: state.selectedLesson.theory, theorySections: state.selectedLesson.theorySections, glossary: state.selectedLesson.glossary, commonMistakes: state.selectedLesson.commonMistakes, quickChecks: state.selectedLesson.quickChecks } });
                output.textContent = result.answer || result.text || 'Gemini không trả nội dung.';
            } catch (error) { output.textContent = error.message || 'Không thể gọi Gemini.'; }
        });
    }

    async function loadEnglishCatalog() {
        const root = state.track === 'IELTS' ? $('ielts-catalog') : $('english-catalog');
        if (!root) return;
        const exam = state.track === 'IELTS' ? 'IELTS' : 'TOEIC';
        try {
            const payload = await api.englishAssessments(exam);
            const configs = list(payload);
            const variants = state.track === 'IELTS' ? [['ACADEMIC', 'IELTS Academic'], ['GENERAL_TRAINING', 'IELTS General Training']] : [['TOEIC', 'TOEIC 4 kỹ năng']];
            root.innerHTML = `<div class="learning-course-head"><div><div class="learning-kicker">ENGLISH TRAINING</div><h2>${exam === 'IELTS' ? 'IELTS Academic / General Training' : 'TOEIC 4 kỹ năng'}</h2><p>Cấu hình bài luyện phải có sourceRef và assessmentVersion. Nội dung tự tạo luôn được gắn Practice/Simulation.</p></div></div><div class="learning-english-variants">${variants.map(([code, label]) => `<button type="button" class="learning-btn secondary" data-english-variant="${code}">${label}</button>`).join('')}</div><div class="learning-ai-action"><button type="button" class="learning-btn primary" data-ai-english-course>🤖 AI tạo lộ trình ${exam}</button><span class="learning-source">AI sẽ chọn hoặc tự tạo khóa học theo mục tiêu và skill gaps của bạn.</span></div><div id="english-config-root" class="learning-english-config"></div>`;
            const detailRoot = $('english-config-root');
            const renderVariant = variant => {
                const selected = configs.filter(item => String(item.variant || item.track || item.examVariant || item.exam || '').toUpperCase().includes(variant));
                const parts = exam === 'IELTS' ? ['LISTENING', 'READING', 'WRITING', 'SPEAKING'] : ['LISTENING', 'READING', 'SPEAKING', 'WRITING'];
                const fallbackConfig = parts.map(skill => ({ skill, title: skill, count: 0 }));
                const content = parts.map(skill => {
                    const config = selected.find(item => String(item.skill || item.part || '').toUpperCase() === skill);
                    return `<article class="learning-course-card"><div class="learning-kicker">${skill}</div><h4>${safe(config?.title || skillLabel(skill))}</h4><p>${safe(englishDescription(exam, skill))}</p><div class="learning-course-meta"><span class="learning-chip">${Number(config?.itemCount || config?.items || 0) || 0} items nếu đã cấu hình</span><span class="learning-chip">${config?.status || 'Practice'}</span></div><span class="learning-source">${safe(config?.sourceRef ? `${config.sourceRef.sourceType || ''} · ${config.sourceRef.documentName || ''}` : 'Chưa có sourceRef trong cấu hình')}</span></article>`;
                }).join('');
                if (detailRoot) detailRoot.innerHTML = `<section class="learning-grade-block"><header class="learning-grade-head"><div><h3>${exam === 'IELTS' ? (variant === 'ACADEMIC' ? 'IELTS Academic' : 'IELTS General Training') : 'TOEIC 4 kỹ năng'}</h3><small>Đây là khu luyện tập/diagnostic, không phải chứng chỉ chính thức.</small></div><span class="learning-chip">${fallbackConfig.length} skills</span></header><div class="learning-subjects">${content}</div></section><div class="learning-note">${configs.length ? `Đã đọc ${configs.length} cấu hình từ backend.` : 'Chưa có cấu hình English Assessment PUBLISHED. Hãy bổ sung trong Admin CMS; không tạo dữ liệu official giả.'}</div>`;
            };
            root.querySelectorAll('[data-english-variant]').forEach(button => button.addEventListener('click', () => renderVariant(button.dataset.englishVariant)));
            root.querySelector('[data-ai-english-course]')?.addEventListener('click', async () => { const variant = variants[0][0]; const button = root.querySelector('[data-ai-english-course]'); try { button.disabled = true; button.textContent = '🤖 AI đang phân tích…'; const result = await api.aiPersonalCourse({ targetExam: exam, targetVariant: variant, prompt: `Tạo lộ trình ${exam} ${variant} cá nhân hóa cho người học dựa trên hồ sơ và mục tiêu hiện tại. Mỗi lesson phải có lý thuyết, ví dụ, audio, practice và lesson test riêng.`, generateAudio: true }); if (result.courseId) window.location.href = `ai-course.html?id=${encodeURIComponent(result.courseId)}`; } catch (error) { setStatus(error.message || 'Không thể tạo lộ trình AI.', 'error'); button.disabled = false; button.textContent = `🤖 AI tạo lộ trình ${exam}`; } });
            renderVariant(variants[0][0]);
            setStatus(`Đã mở danh mục ${exam}.`);
        } catch (error) {
            root.innerHTML = `<div class="learning-empty">Không thể tải ${exam}: ${safe(error.message || 'lỗi không xác định')}</div>`;
            setStatus(error.message || `Không thể tải ${exam}.`, 'error');
        }
    }

    function skillLabel(skill) {
        return ({ LISTENING: 'Listening', READING: 'Reading', SPEAKING: 'Speaking', WRITING: 'Writing' })[skill] || skill;
    }

    function englishDescription(exam, skill) {
        if (exam === 'TOEIC') return ({ LISTENING: 'Audio + timed practice; question-response/conversations theo cấu hình.', READING: 'Sentence completion, text completion và reading comprehension.', SPEAKING: 'Read aloud, describe picture, response/information/opinion và ghi âm.', WRITING: 'Sentence-based, written response/opinion và giới hạn thời gian.' })[skill];
        return ({ LISTENING: 'Multiple choice, matching, completion và listening practice.', READING: 'Headings, information, completion, T/F/NG, Y/N/NG và reading.', WRITING: 'Academic/General Task 1 + Task 2, word count và rubric version.', SPEAKING: 'Part 1 + Part 2 + Part 3, preparation, recording và rubric.' })[skill];
    }

    function resetUniversitySelect(id, placeholder, disabled = true) {
        const select = $(id);
        if (!select) return;
        select.innerHTML = `<option value="">${placeholder}</option>`;
        select.disabled = disabled;
    }

    function fillUniversitySelect(id, items, placeholder, labelFn = item => item.name || item.title || item.code) {
        const select = $(id);
        if (!select) return;
        select.innerHTML = `<option value="">${placeholder}</option>` + items.map(item => `<option value="${safe(item._id || item.id || item.code)}">${safe(labelFn(item))}</option>`).join('');
        select.disabled = !items.length;
    }

    async function loadUniversityResource(resource, query = '') {
        const data = await api.universityCatalog(resource, query);
        return list(data);
    }

    async function renderUniversityCatalog() {
        const root = $('university-catalog');
        if (!root) return;
        root.innerHTML = `<div class="learning-course-head"><div><div class="learning-kicker">HIGHER EDUCATION</div><h2>Khám phá chương trình đại học</h2><p>Chọn theo đúng cấu trúc cơ sở đào tạo → khoa → lĩnh vực → nhóm ngành → ngành → chuyên ngành → chương trình → học phần.</p></div></div><div class="learning-ai-action"><button type="button" class="learning-btn primary" id="ai-university-course">🤖 AI xây lộ trình đại học theo ngành của tôi</button><span class="learning-source">AI đọc hồ sơ ngành/chuyên ngành/học kỳ và tạo hoặc chọn khóa học phù hợp.</span></div><div class="learning-university-filters"><div class="learning-field"><label for="uni-university">Cơ sở đào tạo</label><select id="uni-university"><option value="">Đang tải…</option></select></div><div class="learning-field"><label for="uni-faculty">Khoa</label><select id="uni-faculty" disabled><option value="">Chọn cơ sở đào tạo</option></select></div><div class="learning-field"><label for="uni-field">Lĩnh vực</label><select id="uni-field" disabled><option value="">Chọn khoa</option></select></div><div class="learning-field"><label for="uni-discipline">Nhóm ngành</label><select id="uni-discipline" disabled><option value="">Chọn lĩnh vực</option></select></div><div class="learning-field"><label for="uni-major">Ngành</label><select id="uni-major" disabled><option value="">Chọn nhóm ngành</option></select></div><div class="learning-field"><label for="uni-specialization">Chuyên ngành</label><select id="uni-specialization" disabled><option value="">Chọn ngành</option></select></div><div class="learning-field"><label for="uni-program">Chương trình đào tạo</label><select id="uni-program" disabled><option value="">Chọn chuyên ngành</option></select></div><div class="learning-field"><label for="uni-course">Học phần</label><select id="uni-course" disabled><option value="">Chọn chương trình</option></select></div></div><div id="university-result" class="learning-empty">Đang tải danh sách cơ sở đào tạo…</div>`;
        try {
            state.university.university = await loadUniversityResource('university');
            fillUniversitySelect('uni-university', state.university.university, 'Chọn cơ sở đào tạo');
            $('ai-university-course')?.addEventListener('click', async () => { const button = $('ai-university-course'); try { button.disabled = true; button.textContent = '🤖 AI đang phân tích ngành…'; const result = await api.aiPersonalCourse({ prompt: 'Tạo lộ trình học đại học CNTT/công nghệ phù hợp với ngành, chuyên ngành, chương trình, học kỳ, mục tiêu nghề nghiệp và skill gaps trong hồ sơ của tôi. Ưu tiên tài nguyên hiện có; nếu thiếu thì tự tạo personal course hoàn chỉnh với lý thuyết, ví dụ, audio, practice, lesson test, chapter test và final assessment.', domain: 'UNIVERSITY_IT', generateAudio: true }); if (result.courseId) window.location.href = `ai-course.html?id=${encodeURIComponent(result.courseId)}`; } catch (error) { setStatus(error.message || 'Không thể tạo lộ trình đại học bằng AI.', 'error'); button.disabled = false; button.textContent = '🤖 AI xây lộ trình đại học theo ngành của tôi'; } });
            bindUniversityCascade();
            $('university-result').textContent = state.university.university.length ? 'Hãy chọn trường để tiếp tục đi xuống từng tầng chương trình.' : 'Chưa có dữ liệu cơ sở đào tạo. Admin cần nhập và công bố dữ liệu University CMS.';
        } catch (error) {
            const result = $('university-result');
            if (result) result.textContent = error.message || 'Không thể tải dữ liệu đại học.';
        }
    }

    function bindUniversityCascade() {
        $('uni-university')?.addEventListener('change', async event => {
            const id = event.target.value;
            resetUniversitySelect('uni-faculty', 'Chọn cơ sở đào tạo', !id);
            resetUniversitySelect('uni-field', 'Chọn khoa', true);
            resetUniversitySelect('uni-discipline', 'Chọn lĩnh vực', true);
            resetUniversitySelect('uni-major', 'Chọn nhóm ngành', true);
            resetUniversitySelect('uni-specialization', 'Chọn ngành', true);
            resetUniversitySelect('uni-program', 'Chọn chuyên ngành', true);
            resetUniversitySelect('uni-course', 'Chọn chương trình', true);
            if (!id) return;
            state.university.faculty = await loadUniversityResource('faculty', `universityId=${encodeURIComponent(id)}`);
            fillUniversitySelect('uni-faculty', state.university.faculty, 'Chọn khoa');
        });
        $('uni-faculty')?.addEventListener('change', async event => {
            const id = event.target.value;
            resetUniversitySelect('uni-field', 'Chọn khoa', !id);
            resetUniversitySelect('uni-discipline', 'Chọn lĩnh vực', true);
            resetUniversitySelect('uni-major', 'Chọn nhóm ngành', true);
            resetUniversitySelect('uni-specialization', 'Chọn ngành', true);
            resetUniversitySelect('uni-program', 'Chọn chuyên ngành', true);
            resetUniversitySelect('uni-course', 'Chọn chương trình', true);
            if (!id) return;
            state.university.field = await loadUniversityResource('field');
            fillUniversitySelect('uni-field', state.university.field, 'Chọn lĩnh vực');
        });
        $('uni-field')?.addEventListener('change', async event => {
            const id = event.target.value;
            resetUniversitySelect('uni-discipline', 'Chọn lĩnh vực', !id);
            resetUniversitySelect('uni-major', 'Chọn nhóm ngành', true);
            resetUniversitySelect('uni-specialization', 'Chọn ngành', true);
            resetUniversitySelect('uni-program', 'Chọn chuyên ngành', true);
            resetUniversitySelect('uni-course', 'Chọn chương trình', true);
            if (!id) return;
            state.university.disciplineGroup = await loadUniversityResource('discipline-group', `fieldId=${encodeURIComponent(id)}`);
            fillUniversitySelect('uni-discipline', state.university.disciplineGroup, 'Chọn nhóm ngành');
        });
        $('uni-discipline')?.addEventListener('change', async event => {
            const id = event.target.value;
            resetUniversitySelect('uni-major', 'Chọn nhóm ngành', !id);
            resetUniversitySelect('uni-specialization', 'Chọn ngành', true);
            resetUniversitySelect('uni-program', 'Chọn chuyên ngành', true);
            resetUniversitySelect('uni-course', 'Chọn chương trình', true);
            if (!id) return;
            state.university.major = await loadUniversityResource('major', `disciplineGroupId=${encodeURIComponent(id)}`);
            fillUniversitySelect('uni-major', state.university.major, 'Chọn ngành');
        });
        $('uni-major')?.addEventListener('change', async event => {
            const id = event.target.value;
            resetUniversitySelect('uni-specialization', 'Chọn ngành', !id);
            resetUniversitySelect('uni-program', 'Chọn chuyên ngành', true);
            resetUniversitySelect('uni-course', 'Chọn chương trình', true);
            if (!id) return;
            state.university.specialization = await loadUniversityResource('specialization', `majorId=${encodeURIComponent(id)}`);
            fillUniversitySelect('uni-specialization', state.university.specialization, 'Chọn chuyên ngành');
        });
        $('uni-specialization')?.addEventListener('change', async event => {
            const id = event.target.value;
            resetUniversitySelect('uni-program', 'Chọn chuyên ngành', !id);
            resetUniversitySelect('uni-course', 'Chọn chương trình', true);
            if (!id) return;
            state.university.trainingProgram = await loadUniversityResource('training-program', `specializationId=${encodeURIComponent(id)}`);
            fillUniversitySelect('uni-program', state.university.trainingProgram, 'Chọn chương trình đào tạo', item => item.programName || item.name || item.code);
        });
        $('uni-program')?.addEventListener('change', async event => {
            const id = event.target.value;
            resetUniversitySelect('uni-course', 'Chọn chương trình', !id);
            if (!id) return;
            state.university.course = await loadUniversityResource('course', `programId=${encodeURIComponent(id)}`);
            fillUniversitySelect('uni-course', state.university.course, 'Chọn học phần', item => item.name || item.courseName || item.code);
            const result = $('university-result');
            if (result) result.textContent = state.university.course.length ? `Đã tìm thấy ${state.university.course.length} học phần thuộc chương trình đã chọn.` : 'Chương trình chưa có học phần được công bố.';
        });
        $('uni-course')?.addEventListener('change', event => {
            const course = state.university.course.find(item => String(item._id || item.id || item.code) === String(event.target.value));
            const result = $('university-result');
            if (!result) return;
            if (!course) { result.textContent = 'Chọn học phần để xem thông tin.'; return; }
            result.innerHTML = `<div class="learning-content-card"><h3>${safe(course.name || course.courseName || course.code)}</h3><p>${safe(course.description || '')}</p><div class="learning-course-meta"><span class="learning-chip">${safe(course.credits ?? '—')} tín chỉ</span><span class="learning-chip">${safe(course.category || 'Chưa phân loại')}</span><span class="learning-chip">${course.required ? 'Bắt buộc' : 'Tự chọn'}</span></div><p class="learning-source">Chương trình/học phần phải có sourceRef và version phù hợp với cơ sở đào tạo.</p></div>`;
        });
    }

    async function loadProfile() {
        try { renderProfile(await api.profile()); } catch (error) { setStatus(error.message || 'Không thể tải hồ sơ người học.', 'error'); }
    }

    function bindFilters() {
        ['grade-filter', 'level-filter', 'subject-filter', 'search-filter'].forEach(id => $(id)?.addEventListener(id === 'search-filter' ? 'input' : 'change', renderK12Catalog));
        $('lesson-practice-form')?.addEventListener('submit', submitPractice);
        document.querySelectorAll('[data-learning-track]').forEach(button => button.addEventListener('click', () => {
            state.track = button.dataset.learningTrack || 'K12';
            renderTrackHeader();
            if (state.track === 'K12') loadK12Courses().catch(error => setStatus(error.message, 'error'));
            else if (state.track === 'TOEIC' || state.track === 'IELTS') loadEnglishCatalog();
            else renderUniversityCatalog();
        }));
        $('back-to-catalog')?.addEventListener('click', () => { renderTrackHeader(); showSection('catalog-view', true); showSection('course-detail-view', false); showSection('lesson-detail-view', false); setStatus('Đã quay lại danh mục K12.'); });
        $('back-to-course')?.addEventListener('click', () => { showSection('course-detail-view', true); showSection('lesson-detail-view', false); });
        $('next-lesson')?.addEventListener('click', () => { const next = state.selectedLesson?.navigation?.nextLessonId; if (next) openLesson(next); });
    }

    async function init() {
        if (document.body?.dataset?.flowPage !== 'learning') return;
        if (!api) return;
        populateGradeOptions();
        renderTrackHeader();
        bindFilters();
        await loadProfile();
        await loadK12Courses();
    }

    document.addEventListener('DOMContentLoaded', init);
})(window);
