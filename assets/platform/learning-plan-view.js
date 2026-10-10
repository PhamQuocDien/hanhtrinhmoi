'use strict';
(function () {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char]));
    const request = async url => {
        const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) throw new Error(payload.message || `HTTP ${response.status}`);
        return payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
    };
    function status(text, error = false) {
        const element = $('personalized-plan-status');
        if (element) {
            element.textContent = text;
            element.style.color = error ? '#b42318' : '';
        }
    }
    function priorityLabel(value) {
        return ({ CRITICAL: 'Ưu tiên rất cao', HIGH: 'Ưu tiên cao', NORMAL: 'Bình thường', LOW: 'Có thể học sau' })[value] || 'Chưa xếp ưu tiên';
    }
    function subjectCard(subject, index) {
        const title = subject.courseName || subject.title || subject.subjectId || subject.skill || `Mục tiêu ${index + 1}`;
        const current = subject.currentScore == null ? 'Chưa có điểm chẩn đoán' : `Điểm hiện tại: ${Math.round(Number(subject.currentScore) || 0)}%`;
        const gap = subject.courseGap ? '<span class="plan-pill gap">Đang cần tạo khóa</span>' : subject.courseSource === 'PERSONAL_AI' ? '<span class="plan-pill linked">Đã tạo khóa cá nhân</span>' : '<span class="plan-pill linked">Đã khớp catalog</span>';
        const courseLink = subject.courseId ? `<a class="plan-course-link" href="${subject.courseSource === 'PERSONAL_AI' ? 'ai-course.html' : 'khoa-hoc-chi-tiet.html'}?id=${encodeURIComponent(subject.courseId)}">Mở khóa học →</a>` : '';
        const lesson = subject.lessonTitle ? `<div class="plan-next-lesson"><small>Bài học gợi ý</small><strong>${esc(subject.lessonTitle)}</strong>${subject.lessonId ? `<a href="lo-trinh-hoc-tap.html?lesson=${encodeURIComponent(subject.lessonId)}">Xem bài</a>` : ''}</div>` : '';
        const width = Math.max(0, Math.min(100, Number(subject.currentScore) || 0));
        const progress = subject.currentScore == null ? '' : `<div class="plan-progress"><span style="width:${width}%"></span></div>`;
        return `<article class="plan-subject-card"><div class="plan-subject-top"><span class="plan-step">${index + 1}</span><div class="plan-subject-title"><h3>${esc(title)}</h3><p>${esc(current)} · ${esc(priorityLabel(subject.priority))}</p></div>${gap}</div>${progress}<p class="plan-reason">${esc(subject.reason || (subject.courseGap ? 'Cần bổ sung khóa học phù hợp hoặc chọn khóa học trong danh mục.' : 'Học theo bài gợi ý, luyện tập rồi làm kiểm tra lại.'))}</p>${lesson}${courseLink}</article>`;
    }
    const toList = value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean) : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : value && typeof value === 'object' ? Object.values(value).filter(item => ['string','number'].includes(typeof item)) : [];
    const joinList = (value, separator = ', ') => toList(value).map(item => item && typeof item === 'object' ? (item.label || item.title || item.name || item.value || '') : String(item ?? '')).filter(Boolean).join(separator);
    function render(plan, education, learning) {
        const content = $('personalized-plan-content');
        if (!content) return;
        if ($('learner-status')) $('learner-status').textContent = education.educationStatus || 'Chưa khai báo';
        if ($('learner-level')) $('learner-level').textContent = education.educationLevel || 'Chưa xác định';
        if ($('learner-grade')) $('learner-grade').textContent = education.grade ? `Lớp ${education.grade}` : education.academicYear || education.trainingProgramName || education.majorName || 'Chưa khai báo';
        if ($('learner-goal')) $('learner-goal').textContent = joinList(learning.goals ?? learning.survey?.goals ?? plan?.target?.goals).split(', ').slice(0, 3).join(', ') || learning.survey?.target?.detail || 'Chưa khai báo';
        const nameParts = [education.universityName, education.facultyName, education.majorName].filter(Boolean);
        const context = nameParts.length ? `<p class="plan-education-context"><b>Ngữ cảnh đào tạo:</b> ${esc(nameParts.join(' · '))}${education.specializationName ? ` · ${esc(education.specializationName)}` : ''}</p>` : '';
        if (!plan || !Array.isArray(plan.subjects) || !plan.subjects.length) {
            status('Chưa có Learning Plan', false);
            content.innerHTML = `${context}<div class="plan-empty"><h3>Hãy bắt đầu bằng khảo sát mục tiêu</h3><p>Sau khi lưu khảo sát, hệ thống sẽ tạo phiên bản lộ trình. Bài kiểm tra đầu vào tiếp tục bổ sung bằng chứng theo từng kỹ năng và đề xuất khóa học phù hợp.</p><div class="plan-empty-actions"><a class="learning-btn primary" href="survey.html">Bắt đầu khảo sát</a><a class="learning-btn secondary" href="placement.html">Xem bài kiểm tra đầu vào</a></div></div>`;
            return;
        }
        const subjects = [...plan.subjects].sort((a, b) => ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[a.priority] ?? 4) - ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[b.priority] ?? 4));
        const weakCount = subjects.filter(item => item.courseGap || ['CRITICAL', 'HIGH'].includes(item.priority)).length;
        status(`Phiên bản ${plan.version || 1} · ${subjects.length} mục tiêu · ${weakCount} mục cần ưu tiên`);
        content.innerHTML = `${context}<div class="plan-summary-grid"><div><small>Phiên bản lộ trình</small><strong>${esc(plan.version || 1)}</strong></div><div><small>Mục tiêu</small><strong>${subjects.length}</strong></div><div><small>Khóa cần bổ sung/ghép</small><strong>${subjects.filter(item => item.courseGap).length}</strong></div><div><small>Tổng thời lượng dự kiến</small><strong>${Math.round(subjects.reduce((sum, item) => sum + (Number(item.estimatedMinutes) || 0), 0) / 60 * 10) / 10} giờ</strong></div></div><div class="plan-subject-list">${subjects.slice(0, 20).map(subjectCard).join('')}</div><p class="plan-disclaimer">Điểm placement là chẩn đoán học tập, không phải điểm thi/chứng chỉ chính thức. Khi chưa có khóa đủ phù hợp, hệ thống tự biên soạn và lưu khóa học cá nhân kèm bài học; khóa AI cá nhân được mở trực tiếp từ lộ trình.</p>`;
    }
    async function load() {
        try {
            const [plan, data] = await Promise.all([request('/api/learning-platform/plan').catch(() => null), request('/api/education/profile').catch(() => ({}))]);
            render(plan, data.education || {}, data.learning || {});
        } catch (error) {
            status('Không tải được lộ trình', true);
            const content = $('personalized-plan-content');
            if (content) content.innerHTML = `<p>${esc(error.message)}. Hãy đăng nhập lại rồi tải trang.</p>`;
        }
    }
    document.addEventListener('DOMContentLoaded', load);
    if (document.readyState !== 'loading') load();
})();
