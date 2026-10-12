import { apiRequest, currentUser, escapeHtml, showAlert, showToast, logout } from './api.js';

const alertBox = document.getElementById('careerAlert');
const courseGrid = document.getElementById('courseGrid');
const pathwayGrid = document.getElementById('pathwayGrid');
const groupGrid = document.getElementById('groupGrid');
const dialog = document.getElementById('courseDialog');
let activeUser = null;
let catalogData = null;
let activeGroupId = null;
let activePathway = null;
let currentCourse = null;
let currentProgress = null;
let selectedLesson = null;
let activeAssessment = null;
let activeAssessmentPanelId = 'careerQuizPanel';
let assessmentDraftTimer = null;

function pct(progress) { return Math.max(0, Math.min(100, Number(progress?.percent || 0))); }
function currentGroup() { return catalogData?.groups.find((item) => item.id === activeGroupId) || catalogData?.groups[0] || null; }
function currentGroupCourses() { return (catalogData?.courses || []).filter((item) => item.groupId === activeGroupId); }
function selectedCourseIds() {
  const courses = currentGroupCourses();
  if (!activePathway || !currentGroup()) return new Set(courses.map((item) => item.id));
  const pathway = currentGroup().pathways?.find((item) => item.id === activePathway);
  return new Set(pathway?.courseIds || courses.map((item) => item.id));
}
function renderGroups() {
  if (!groupGrid) return;
  groupGrid.innerHTML = catalogData.groups.map((group) => `<button type="button" class="it-group-card ${activeGroupId === group.id ? 'is-selected' : ''}" data-group="${escapeHtml(group.id)}" aria-pressed="${activeGroupId === group.id}"><span class="it-group-number">${String(group.number).padStart(2, '0')}</span><div class="it-group-card-copy"><h3>${escapeHtml(group.title)}</h3><p>${escapeHtml(group.description || group.englishTitle || '')}</p><div class="it-group-careers">${(group.careers || []).slice(0, 3).map((career) => `<span>${escapeHtml(career)}</span>`).join('')}</div></div><div class="it-group-stat"><strong>${Number(group.courseCount || 0)}</strong><span>khóa</span><strong>${Number(group.lessonCount || 0)}</strong><span>bài học</span></div></button>`).join('');
}
function renderPathways() {
  const group = currentGroup();
  const pathways = group?.pathways || [];
  if (!pathways.length) { pathwayGrid.innerHTML = '<div class="catalog-loading">Nhóm ngành này đang hoàn thiện lộ trình.</div>'; return; }
  pathwayGrid.innerHTML = pathways.map((pathway, index) => `<button type="button" class="pathway-card ${activePathway === pathway.id ? 'is-selected' : ''}" data-pathway="${escapeHtml(pathway.id)}" aria-pressed="${activePathway === pathway.id}"><span class="pathway-number">${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(pathway.title)}</h3><p>${escapeHtml(pathway.description)}</p><div class="pathway-skills">${(pathway.skills || []).map((skill) => `<span>${escapeHtml(skill)}</span>`).join('')}</div><div class="pathway-footer"><span>${(pathway.courseIds || []).length} KHÓA HỌC ĐỀ XUẤT</span><b>↗</b></div></button>`).join('');
}
function courseCard(item) {
  const progress = item.progress || { enrolled: false, percent: 0, completedLessons: 0, lessonCount: item.lessonCount };
  const skills = (item.skills || []).slice(0, 4).map((skill) => `<span>${escapeHtml(skill)}</span>`).join('');
  let primaryAction = '';
  if (progress.enrolled) primaryAction = `<button type="button" class="button button-primary" data-open-course="${escapeHtml(item.id)}">Tiếp tục</button>`;
  else if (activeUser?.role === 'teacher') primaryAction = '<a class="button button-primary" href="/teacher.html#teacherAssignments">Dùng để giao bài</a>';
  else if (activeUser?.role === 'admin') primaryAction = '<a class="button button-primary" href="/admin.html">Quản trị nội dung</a>';
  else primaryAction = `<button type="button" class="button button-primary" data-enroll-course="${escapeHtml(item.id)}">Tham gia</button>`;
  return `<article class="career-course-card"><div class="course-card-top"><span class="course-code">${escapeHtml(item.code)}</span><span class="course-level">${escapeHtml(item.level)}</span></div><h3>${escapeHtml(item.title)}</h3><p class="course-tagline">${escapeHtml(item.tagline)}</p><div class="course-skill-list">${skills}</div><div class="course-card-meta"><span>${item.moduleCount || 0} chặng · ${item.lessonCount} bài</span><span>${item.estimatedHours} giờ dự kiến</span></div><div class="course-progress" aria-label="Tiến độ ${pct(progress)}%"><i style="width:${pct(progress)}%"></i></div><div class="course-card-meta"><span>${progress.enrolled ? `<b class="course-enrolled">ĐÃ THÊM VÀO LỘ TRÌNH</b>` : 'Lộ trình riêng theo khóa'}</span><span>${progress.completedLessons || 0}/${item.lessonCount} bài</span></div><div class="course-card-actions"><button type="button" class="button button-quiet" data-open-course="${escapeHtml(item.id)}">Xem lộ trình ↗</button>${primaryAction}</div></article>`;
}
function renderCourses() {
  const allowed = selectedCourseIds();
  const query = document.getElementById('courseSearch').value.trim().toLocaleLowerCase('vi-VN');
  const courses = currentGroupCourses().filter((item) => allowed.has(item.id) && [item.title, item.shortTitle, item.code, ...(item.skills || [])].join(' ').toLocaleLowerCase('vi-VN').includes(query));
  courseGrid.innerHTML = courses.length ? courses.map(courseCard).join('') : '<div class="catalog-loading">Không có khóa học phù hợp với từ khóa.</div>';
  const path = currentGroup()?.pathways?.find((item) => item.id === activePathway);
  document.getElementById('courseHeading').textContent = path ? path.title : `Các khóa học: ${currentGroup()?.title || 'CNTT'}`;
  document.getElementById('courseSubheading').textContent = path ? path.description : `${currentGroupCourses().length} khóa học thuộc nhóm ngành. Mỗi khóa có mô-đun, bài học và bài thực hành riêng.`;
}
function refreshMetrics() {
  const courses = currentGroupCourses();
  document.getElementById('courseCount').textContent = courses.length;
  document.getElementById('lessonCount').textContent = courses.reduce((sum, item) => sum + Number(item.lessonCount || 0), 0).toLocaleString('vi-VN');
  document.getElementById('pathwayCount').textContent = currentGroup()?.pathways?.length || 0;
  document.getElementById('enrolledCount').textContent = courses.filter((item) => item.progress?.enrolled).length;
  const group = currentGroup();
  const crumb = document.querySelector('.career-breadcrumb');
  const heroTitle = document.querySelector('.career-hero h1');
  if (crumb && group) crumb.innerHTML = `Công nghệ thông tin <span>/</span> Nhóm ${Number(group.number)} · ${escapeHtml(group.title)}`;
  if (heroTitle && group) heroTitle.innerHTML = `${escapeHtml(group.title)}<span>.</span><br><em>Learn. Build. Run.</em>`;
}
function renderDialogModules() {
  if (!currentCourse) return;
  const completed = new Set(currentProgress?.completedLessonIds || []);
  let lessonPosition = 0;
  document.getElementById('dialogModules').innerHTML = currentCourse.modules.map((module, moduleIndex) => `<details class="dialog-module" ${moduleIndex === 0 ? 'open' : ''}><summary><span class="module-number">${String(moduleIndex + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(module.title)}</strong><small>${escapeHtml(module.summary)} · ${module.lessons.length} bài</small></span></summary><div class="module-lessons">${module.lessons.map((lesson) => {
    const index = lessonPosition++;
    const done = completed.has(lesson.id);
    const unlocked = index === 0 || completed.has(currentCourse.lessons[index - 1]?.id);
    const buttonLabel = done ? 'Đã hoàn thành ✓' : !currentProgress?.enrolled ? 'Thêm khóa học' : unlocked ? 'Mở bài' : '🔒 Bị khóa';
    return `<div class="module-lesson"><span class="lesson-index">${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.minutes} phút · ${escapeHtml(lesson.objective)}</small></div><button type="button" class="button ${done ? 'button-quiet' : 'button-primary'}" data-study-lesson="${escapeHtml(lesson.id)}" ${(!currentProgress?.enrolled || !unlocked) ? 'disabled' : ''}>${buttonLabel}</button></div>`;
  }).join('')}</div></details>`).join('');
  const enrollButton = document.getElementById('enrollCourseButton');
  enrollButton.hidden = Boolean(currentProgress?.enrolled) || ['teacher', 'admin'].includes(activeUser?.role);
  enrollButton.textContent = 'Thêm vào lộ trình';
  document.getElementById('dialogCourseCode').textContent = `${currentCourse.code} · ${currentCourse.level}`;
  document.getElementById('dialogCourseTitle').textContent = currentCourse.title;
  document.getElementById('dialogCourseDescription').textContent = currentCourse.description;
  const courseQualityPanel = document.getElementById('dialogCourseQuality');
  if (courseQualityPanel) courseQualityPanel.innerHTML = renderCourseQuality(currentCourse.qualityBlueprint);
  document.getElementById('dialogCourseMeta').innerHTML = [`${currentCourse.modules.length} chặng học`, `${currentCourse.lessonCount} bài học`, `${currentCourse.estimatedHours} giờ dự kiến`, `Độ khó: ${currentCourse.difficulty}`, ...(currentCourse.tools || []).map((item) => `Công cụ: ${item}`)].map((text) => `<span>${escapeHtml(text)}</span>`).join('');
  const progressNote = currentProgress?.enrolled ? `${currentProgress.completedLessons}/${currentProgress.lessonCount} bài đã hoàn thành · ${currentProgress.percent}%` : 'Xem trước lộ trình — thêm khóa học để lưu tiến độ.';
  document.getElementById('dialogCourseMeta').insertAdjacentHTML('beforeend', `<span>${escapeHtml(progressNote)}</span>`);
  document.getElementById('lessonPanel').hidden = true;
  document.getElementById('courseFinalQuizPanel').hidden = true;
  activeAssessment = null;
  activeAssessmentPanelId = 'careerQuizPanel';
  selectedLesson = null;
  const completedCount = currentCourse.lessons.filter((lesson) => completed.has(lesson.id)).length;
  const finalEligibility = Boolean(currentProgress?.enrolled) && currentCourse.lessons.length > 0 && completedCount === currentCourse.lessons.length;
  const finalStatus = document.getElementById('courseFinalStatus');
  const finalButton = document.getElementById('startCourseFinalAssessment');
  if (finalStatus) {
    if (!currentProgress?.enrolled) finalStatus.textContent = 'Thêm khóa học vào lộ trình, hoàn thành toàn bộ bài học rồi bạn sẽ mở được bài kiểm tra tổng kết.';
    else if (finalEligibility) finalStatus.textContent = `Đã hoàn thành ${completedCount}/${currentCourse.lessons.length} bài học. Bài thi sẽ chọn tối đa 30 câu đã được giáo viên duyệt trong toàn khóa học.`;
    else finalStatus.textContent = `Đã hoàn thành ${completedCount}/${currentCourse.lessons.length} bài học. Hoàn thành các bài còn lại để mở bài kiểm tra cuối khóa.`;
  }
  if (finalButton) {
    finalButton.disabled = !finalEligibility;
    finalButton.textContent = finalEligibility ? 'Bắt đầu kiểm tra cuối khóa ↗' : !currentProgress?.enrolled ? 'Thêm khóa học để mở khóa' : 'Hoàn thành bài học để mở khóa';
  }
}
async function openCourse(courseId) {
  try {
    const data = await apiRequest(`/api/career/courses/${encodeURIComponent(courseId)}`);
    currentCourse = data.course;
    currentProgress = data.progress;
    renderDialogModules();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', 'open');
    await restoreCourseFinalAssessment();
  } catch (error) { showToast(error.message || 'Không tải được lộ trình khóa học.', 'error'); }
}
function renderVideo(lesson) {
  const url = String(lesson.videoUrl || '').trim();
  if (!url) return `<aside class="career-video-placeholder"><span>▶</span><div><strong>Video bài học đang được chuẩn bị</strong><p>Link video được quản lý riêng tại <code>content/video-links/video-links.csv</code>. Khi đã quay xong, thay URL và đặt status thành <code>ready</code>.</p></div></aside>`;
  let parsed;
  try { parsed = new URL(url); } catch (_error) { return ''; }
  if (parsed.protocol !== 'https:') return '';
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (/(\.mp4|\.webm)$/.test(path)) return `<div class="career-video-wrap"><video controls preload="metadata" src="${escapeHtml(url)}" title="${escapeHtml(lesson.videoTitle || lesson.title)}"></video></div>`;
  let embed = '';
  if (host === 'youtu.be') embed = `https://www.youtube.com/embed/${encodeURIComponent(parsed.pathname.slice(1).split('/')[0])}`;
  else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    const id = parsed.searchParams.get('v');
    if (id) embed = `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    else if (parsed.pathname.startsWith('/embed/')) embed = `https://www.youtube.com${parsed.pathname}`;
  } else if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean).pop();
    if (id && /^\d+$/.test(id)) embed = `https://player.vimeo.com/video/${id}`;
  }
  if (!embed) return `<p class="career-video-link">Video: <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Mở video trong tab mới ↗</a></p>`;
  return `<div class="career-video-wrap"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(lesson.videoTitle || lesson.title)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}
function renderCodeLab(lesson) {
  const exercise = lesson.codeExercise;
  if (!exercise?.enabled || !(exercise.languages || []).length) return '';
  const languages = exercise.languages.map((language) => `<option value="${escapeHtml(language)}" ${language === exercise.defaultLanguage ? 'selected' : ''}>${escapeHtml(({ cpp: 'C++', java: 'Java', csharp: 'C#', javascript: 'JavaScript', python: 'Python', sql: 'SQL / SQLite', html: 'HTML xem trước', css: 'CSS xem trước' })[language] || language)}</option>`).join('');
  const initial = exercise.starterCodeByLanguage?.[exercise.defaultLanguage] || '';
  return `<section class="code-lab" data-code-lab><div class="code-lab-heading"><div><span class="lesson-study-label">CODE LAB</span><h4>Viết code và chạy thử</h4><p>${escapeHtml(exercise.instructions || lesson.practice || 'Hoàn thành thử thách của bài học.')}</p></div><span class="code-lab-safe">Sandbox · giới hạn tài nguyên</span></div><div class="code-lab-toolbar"><label for="lessonCodeLanguage">Ngôn ngữ</label><select class="form-input" id="lessonCodeLanguage">${languages}</select><button class="button button-primary" id="runLessonCode" type="button">▶ Chạy code</button></div><label class="code-lab-label" for="lessonCodeEditor">Mã nguồn</label><textarea id="lessonCodeEditor" class="code-lab-editor" rows="14" spellcheck="false" autocapitalize="off" autocomplete="off">${escapeHtml(initial)}</textarea><div class="code-lab-stdin"><label for="lessonCodeStdin">Dữ liệu đầu vào (stdin)</label><textarea id="lessonCodeStdin" class="form-input" rows="2" placeholder="Nhập dữ liệu nếu chương trình cần"></textarea></div><div class="code-lab-output-wrap"><div class="code-lab-output-heading"><strong>Kết quả chạy</strong><span id="lessonCodeStatus">Chưa chạy</span></div><pre id="lessonCodeOutput" class="code-lab-output">Kết quả sẽ hiển thị tại đây.</pre></div><div id="lessonCodePreviewWrap" class="code-lab-preview-wrap" hidden><strong>Xem trước HTML/CSS</strong><iframe id="lessonCodePreview" class="code-lab-preview" sandbox="allow-scripts" title="Xem trước sản phẩm HTML/CSS"></iframe></div><p class="code-lab-footnote">Không chạy trực tiếp trên máy chủ web. C++/Java/C#/JavaScript/Python/SQL dùng Judge0 nếu được cấu hình; HTML/CSS được xem trước trong iframe sandbox.</p></section>`;
}
function runLocalPreview(language, source) {
  const wrap = document.getElementById('lessonCodePreviewWrap');
  const frame = document.getElementById('lessonCodePreview');
  if (!wrap || !frame) return;
  let html = source;
  if (language === 'css') html = `<!doctype html><html lang="vi"><meta charset="utf-8"><style>${source.replace(/<\/style/gi, '<\\/style')}</style><body><main class="demo-card"><h1>CSS Playground</h1><p>Đây là nội dung xem trước để thử bố cục và kiểu chữ.</p><button>Ví dụ nút</button></main></body></html>`;
  frame.srcdoc = html;
  wrap.hidden = false;
  const status = document.getElementById('lessonCodeStatus');
  const output = document.getElementById('lessonCodeOutput');
  if (status) status.textContent = 'Xem trước cục bộ';
  if (output) output.textContent = 'Đã nạp vào iframe sandbox. Đây là xem trước giao diện, không phải trình biên dịch.';
}
async function executeLessonCode() {
  const button = document.getElementById('runLessonCode');
  const language = document.getElementById('lessonCodeLanguage')?.value || '';
  const sourceCode = document.getElementById('lessonCodeEditor')?.value || '';
  const stdin = document.getElementById('lessonCodeStdin')?.value || '';
  const status = document.getElementById('lessonCodeStatus');
  const output = document.getElementById('lessonCodeOutput');
  const preview = document.getElementById('lessonCodePreviewWrap');
  if (preview) preview.hidden = true;
  if (['html', 'css'].includes(language)) { runLocalPreview(language, sourceCode); return; }
  if (!currentCourse || !selectedLesson || !output) return;
  if (!activeUser || !currentProgress?.enrolled) { showToast('Hãy đăng nhập và thêm khóa học trước khi chạy code.', 'error'); return; }
  button.disabled = true;
  button.textContent = 'Đang chạy…';
  if (status) status.textContent = 'Đang gửi lên sandbox';
  if (output) output.textContent = 'Đang biên dịch / thực thi…';
  try {
    const result = await apiRequest('/api/career/code/run', { method: 'POST', body: JSON.stringify({ courseId: currentCourse.id, lessonId: selectedLesson.id, language, sourceCode, stdin }) });
    const chunks = [];
    chunks.push(`Trạng thái: ${result.status || 'Không rõ'}`);
    if (result.stdout) chunks.push(`STDOUT:\n${result.stdout}`);
    if (result.stderr) chunks.push(`STDERR:\n${result.stderr}`);
    if (result.compileOutput) chunks.push(`BIÊN DỊCH:\n${result.compileOutput}`);
    if (result.message) chunks.push(`THÔNG BÁO:\n${result.message}`);
    chunks.push(`Thời gian: ${result.time ?? '—'} s · Bộ nhớ: ${result.memoryKb ?? '—'} KB · ${result.engine || 'Sandbox'}`);
    output.textContent = chunks.join('\n\n');
    if (status) status.textContent = result.status || 'Đã hoàn tất';
  } catch (error) {
    output.textContent = error.message || 'Không thể chạy code.';
    if (status) status.textContent = 'Lỗi';
  } finally { button.disabled = false; button.textContent = '▶ Chạy code'; }
}
function renderQualityProfile(profile) {
  if (!profile) return '';
  const frameworkLabels = {
    'ACM-IEEE-CS2023': 'CS2023 · ACM/IEEE-CS/AAAI',
    'ABET-CAC-2025-2026': 'ABET Computing Criteria 2025–2026 (tham chiếu)',
    'DIGCOMP-3.0': 'DigComp 3.0',
    'UNESCO-AI-STUDENTS-2024': 'UNESCO AI Competency Framework'
  };
  const refs = (profile.standardsAlignment?.references || []).map((id) => frameworkLabels[id] || id);
  const outcomes = (profile.learningOutcomes || []).slice(0, 4);
  return `<section class="career-quality-profile"><div class="career-quality-heading"><span>CHUẨN THAM CHIẾU & ĐẦU RA</span><small>Bản nháp · cần giảng viên duyệt</small></div><p><strong>Khung tham chiếu:</strong> ${refs.map(escapeHtml).join(' · ') || 'Chưa gán khung tham chiếu'}</p><ul>${outcomes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p><strong>Minh chứng:</strong> ${(profile.evidenceOfLearning || []).slice(0, 3).map(escapeHtml).join(' · ')}</p><small>Khung tham chiếu hỗ trợ thiết kế đầu ra; không phải tuyên bố chương trình đã được kiểm định hay chứng nhận.</small></section>`;
}
function renderCourseQuality(blueprint) {
  if (!blueprint) return '';
  const outcomes = (blueprint.learningOutcomes || []).slice(0, 8);
  const milestones = (blueprint.moduleMilestones || []).map((module) => `<article class="course-quality-milestone"><span>${String(module.number).padStart(2, '0')}</span><div><strong>${escapeHtml(module.title)}</strong><p>${escapeHtml(module.focus || '')}</p><small><b>Minh chứng:</b> ${escapeHtml(module.evidence || '')}</small></div></article>`).join('');
  const rubric = (blueprint.capstone?.rubric || []).map((item) => `<tr><td>${escapeHtml(item.criterion)}</td><td>${Number(item.points)}%</td><td>${escapeHtml(item.descriptor)}</td></tr>`).join('');
  const acceptance = (blueprint.capstone?.acceptance || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const assessment = (blueprint.suggestedAssessmentBlueprint?.questionTypes || []).map((item) => `<span>${escapeHtml(item.label)} <b>${Number(item.percent)}%</b></span>`).join('');
  return `<section class="career-course-quality-card"><div class="career-course-quality-head"><div><span class="career-theory-kicker">THIẾT KẾ HỌC TẬP · ${escapeHtml(blueprint.version || 'V8.0.4')}</span><h3>Học để làm được, không chỉ xem lý thuyết</h3></div><span class="career-theory-draft">Bản nháp cần giảng viên duyệt</span></div><div class="course-quality-outcomes"><strong>Đầu ra của khóa học</strong><ul>${outcomes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><details class="course-quality-details" open><summary>Đồ án tổng hợp và tiêu chí chấm</summary><p><strong>${escapeHtml(blueprint.capstone?.title || 'Đồ án cuối khóa')}</strong></p><p>${escapeHtml(blueprint.capstone?.description || '')}</p><div class="course-quality-table-wrap"><table class="course-quality-table"><thead><tr><th>Tiêu chí</th><th>Điểm</th><th>Minh chứng cần có</th></tr></thead><tbody>${rubric}</tbody></table></div><ul class="course-quality-acceptance">${acceptance}</ul></details><details class="course-quality-details"><summary>Lộ trình sản phẩm theo từng chặng (${(blueprint.moduleMilestones || []).length})</summary><div class="course-quality-milestones">${milestones}</div></details><details class="course-quality-details"><summary>Ma trận bài đánh giá gợi ý</summary><div class="course-quality-assessment-mix">${assessment}</div><p class="course-quality-note">${escapeHtml(blueprint.suggestedAssessmentBlueprint?.note || 'Đề thi chỉ sử dụng câu hỏi được duyệt.')}</p></details><small class="course-quality-note">Lộ trình do dự án đề xuất, chưa được xác nhận thay thế đề cương chính thức. Sản phẩm và rubric cần được giảng viên rà soát theo mục tiêu của khóa.</small></section>`;
}
function renderLessonLearningGuide(guide) {
  if (!guide) return '';
  const outcomes = (guide.learningOutcomes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const timings = (guide.studyPlan || []).map((item) => `<span><b>${Number(item.minutes)}′</b> ${escapeHtml(item.title)}</span>`).join('');
  const steps = (guide.guidedSteps || []).map((item, index) => `<li><span>${index + 1}</span><div>${escapeHtml(item)}</div></li>`).join('');
  const checks = (guide.selfCheck || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const rubric = (guide.rubric || []).map((item) => `<tr><td>${escapeHtml(item.criterion)}</td><td>${Number(item.points)}%</td><td>${escapeHtml(item.descriptor)}</td></tr>`).join('');
  return `<section class="career-lesson-guide"><header><div><span class="career-theory-kicker">HƯỚNG DẪN HỌC · ${escapeHtml(guide.version || 'V8.0.4')}</span><h4>Lộ trình hoàn thành bài học</h4></div><span class="lesson-guide-time">${Number(guide.estimatedMinutes)} phút</span></header><p class="lesson-guide-prerequisite"><strong>Kiến thức nền:</strong> ${escapeHtml(guide.prerequisite || '')}</p><div class="lesson-guide-outcomes"><strong>Sau bài này, bạn có thể</strong><ul>${outcomes}</ul></div><div class="lesson-guide-timeplan">${timings}</div><details class="lesson-guide-details" open><summary>Thực hành theo từng bước</summary><ol class="lesson-guide-steps">${steps}</ol></details><details class="lesson-guide-details"><summary>Chọn mức phù hợp và thử thách thêm</summary><div class="lesson-guide-levels"><article><strong>Củng cố</strong><p>${escapeHtml(guide.practiceLevels?.support || '')}</p></article><article><strong>Chuẩn</strong><p>${escapeHtml(guide.practiceLevels?.core || '')}</p></article><article><strong>Mở rộng</strong><p>${escapeHtml(guide.practiceLevels?.extension || '')}</p></article></div></details><details class="lesson-guide-details"><summary>Tự kiểm tra và rubric đánh giá</summary><ul class="lesson-guide-checks">${checks}</ul><div class="course-quality-table-wrap"><table class="course-quality-table"><thead><tr><th>Tiêu chí</th><th>Điểm</th><th>Biểu hiện đạt</th></tr></thead><tbody>${rubric}</tbody></table></div></details><small class="course-quality-note">Hướng dẫn và rubric là khung đánh giá đề xuất. Cần giảng viên xác nhận trước khi dùng để chấm điểm chính thức.</small></section>`;
}
function renderUniversityTheory(theory) {
  if (!theory || !Array.isArray(theory.sections) || !theory.sections.length) {
    return '<section class="career-theory-card"><span class="career-theory-kicker">LÝ THUYẾT</span><h4>Nội dung lý thuyết đang được cập nhật</h4><p>Giảng viên cần bổ sung mô hình, ví dụ và cách kiểm chứng cho bài này.</p></section>';
  }
  const text = (value) => escapeHtml(value || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
  const sections = theory.sections.map((section) => `<article class="career-theory-section"><h5>${escapeHtml(section.heading || 'Nội dung')}</h5>${section.body ? `<p>${text(section.body)}</p>` : ''}${Array.isArray(section.items) && section.items.length ? `<ul>${section.items.map((item) => `<li>${text(item)}</li>`).join('')}</ul>` : ''}</article>`).join('');
  return `<section class="career-theory-card"><div class="career-theory-card-head"><div><span class="career-theory-kicker">V8.0.4 · LÝ THUYẾT CHUYÊN ĐỀ</span><h4>${escapeHtml(theory.title || 'Lý thuyết trọng tâm')}</h4></div><span class="career-theory-draft">Cần giảng viên duyệt</span></div><p class="career-theory-summary">${text(theory.summary || '')}</p><div class="career-theory-sections">${sections}</div><small>${escapeHtml(theory.sourceNote || 'Nội dung tham khảo cần được giảng viên thẩm định.')}</small></section>`;
}
function openStudyLesson(lessonId) {
  const lesson = currentCourse?.lessons?.find((item) => item.id === lessonId);
  if (!lesson) return;
  selectedLesson = lesson;
  const completed = new Set(currentProgress?.completedLessonIds || []);
  const panel = document.getElementById('lessonPanel');
  panel.hidden = false;
  activeAssessment = null;
  activeAssessmentPanelId = 'careerQuizPanel';
  document.getElementById('courseFinalQuizPanel').hidden = true;
  if (assessmentDraftTimer) clearTimeout(assessmentDraftTimer);
  panel.innerHTML = `<span class="lesson-study-label">BÀI HỌC · ${lesson.minutes} PHÚT</span><h3>${escapeHtml(lesson.title)}</h3><p><strong>Mục tiêu:</strong> ${escapeHtml(lesson.objective)}</p>${renderUniversityTheory(lesson.theory)}${renderLessonLearningGuide(lesson.learningGuide)}${renderQualityProfile(lesson.qualityProfile)}${renderVideo(lesson)}<div class="lesson-study-grid"><article><strong>VÍ DỤ / CÁCH LÀM</strong><p>${escapeHtml(lesson.example || lesson.material)}</p></article><article><strong>THỰC HÀNH</strong><p>${escapeHtml(lesson.practice)}</p><p><strong>SẢN PHẨM:</strong> ${escapeHtml(lesson.deliverable)}</p></article></div>${renderCodeLab(lesson)}<div class="career-practice-actions"><label>Số câu<select class="form-input" id="careerPracticeCount"><option value="5">5 câu</option><option value="10" selected>10 câu</option><option value="15">15 câu</option><option value="20">20 câu</option><option value="30">30 câu</option></select></label><label>Ma trận mức độ<select class="form-input" id="careerPracticePreset"><option value="foundation">Củng cố · dễ nhiều hơn</option><option value="standard" selected>Tiêu chuẩn · cân bằng</option><option value="challenge">Thử thách · vận dụng cao</option></select></label><button type="button" class="button button-primary" id="startCareerPractice">Tạo đề 10 câu ↗</button><span class="footer-muted">Đề chỉ lấy câu đã được duyệt trong đúng bài; hệ thống cân bằng dạng câu hỏi, độ khó, mức tư duy và ưu tiên câu chưa gặp.</span></div><div id="careerQuizPanel" class="career-quiz-panel" hidden></div><div class="dialog-actions"><button type="button" class="button button-primary" id="markLessonComplete" ${completed.has(lesson.id) ? 'disabled' : ''}>${completed.has(lesson.id) ? 'Đã hoàn thành ✓' : 'Đánh dấu đã học xong'}</button><span class="footer-muted">Hãy đọc và thực hành trước khi hoàn thành.</span></div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('careerPracticeCount')?.addEventListener('change', (event) => { const button = document.getElementById('startCareerPractice'); if (button) button.textContent = `Tạo đề ${event.currentTarget.value} câu ↗`; });
  document.getElementById('lessonCodeLanguage')?.addEventListener('change', (event) => {
    const lang = event.currentTarget.value;
    const editor = document.getElementById('lessonCodeEditor');
    const code = lesson.codeExercise?.starterCodeByLanguage?.[lang];
    if (editor && code !== undefined) editor.value = code;
    const preview = document.getElementById('lessonCodePreviewWrap'); if (preview) preview.hidden = true;
    const status = document.getElementById('lessonCodeStatus'); if (status) status.textContent = 'Chưa chạy';
  });
  document.getElementById('runLessonCode')?.addEventListener('click', executeLessonCode);
  document.getElementById('startCareerPractice')?.addEventListener('click', () => startCareerAssessment(lesson));
  document.getElementById('careerQuizPanel')?.addEventListener('change', scheduleCareerDraftSave);
  document.getElementById('careerQuizPanel')?.addEventListener('click', async (event) => {
    if (event.target.closest('#submitCareerAssessment')) await submitCareerAssessment();
    if (event.target.closest('#retakeCareerAssessment')) await startCareerAssessment(lesson);
  });
  restoreCareerAssessment(lesson).catch(() => {});
  document.getElementById('markLessonComplete')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      const result = await apiRequest(`/api/career/courses/${encodeURIComponent(currentCourse.id)}/lessons/${encodeURIComponent(lesson.id)}/complete`, { method: 'POST', body: JSON.stringify({}) });
      currentProgress = result.progress;
      await loadCatalog(false);
      renderDialogModules();
      showToast(result.courseCompleted ? 'Hoàn thành toàn bộ khóa học. Chúc mừng bạn!' : 'Đã lưu tiến độ bài học.');
      openStudyLesson(lesson.id);
    } catch (error) { showToast(error.message || 'Không cập nhật được tiến độ.', 'error'); event.currentTarget.disabled = false; }
  });
}
function assessmentStorageKey(lesson) {
  return `htm-v610-assessment:${activeUser?.id || 'anonymous'}:${currentCourse?.id || ''}:${lesson.id}`;
}
function renderCareerAssessment(session, panelId = 'careerQuizPanel') {
  activeAssessment = session;
  activeAssessmentPanelId = panelId;
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.hidden = false;
  const answers = new Map((session.draftAnswers || []).map((item) => [item.questionId, String(item.answer || '')]));
  if (session.status && session.status !== 'in_progress') {
    panel.innerHTML = `<div class="career-quiz-result"><span class="lesson-study-label">KẾT QUẢ ĐỀ · ${escapeHtml(session.examId)}</span><h4>${session.status === 'needs_review' ? 'Đã nộp — chờ chấm tự luận/mã nguồn' : session.scopeType === 'final' ? 'Đã hoàn thành bài kiểm tra cuối khóa' : 'Đã hoàn thành bài luyện tập'}</h4><p>Điểm chấm tự động: <strong>${session.autoGradedScore ?? session.score ?? '—'}${session.autoGradedScore === null || session.autoGradedScore === undefined ? '' : '/100'}</strong>. ${session.manualReviewPending ? `${session.manualReviewPending} câu đang chờ giáo viên chấm.` : (session.passed ? 'Đạt ngưỡng 70 điểm.' : 'Chưa đạt ngưỡng 70 điểm.')}</p><button class="button button-primary" id="retakeCareerAssessment" type="button">${session.scopeType === 'final' ? 'Thi lại cuối khóa ↻' : 'Tạo đề mới'}</button></div>`;
    return;
  }
  const questions = session.questions || [];
  const typeLabels = { multiple_choice: 'Trắc nghiệm', true_false: 'Đúng / sai', fill_blank: 'Điền khuyết', short_answer: 'Trả lời ngắn', essay: 'Tự luận', code_challenge: 'Bài thực hành', debugging: 'Sửa lỗi', design_task: 'Thiết kế' };
  const content = questions.map((question, index) => {
    const id = escapeHtml(question.questionId);
    const val = answers.get(question.questionId) || '';
    let control = '';
    if (['multiple_choice', 'true_false'].includes(question.type)) {
      control = `<div class="career-quiz-options">${(question.options || []).map((option, optionIndex) => `<label><input type="radio" name="career-answer-${id}" data-career-answer="${id}" value="${escapeHtml(option.value)}" ${val === String(option.value) ? 'checked' : ''}><span>${escapeHtml(option.label || option.value || `Lựa chọn ${optionIndex + 1}`)}</span></label>`).join('')}</div>`;
    } else if (question.type === 'fill_blank') {
      control = `<input class="form-input career-quiz-short-input" type="text" data-career-answer="${id}" value="${escapeHtml(val)}" autocomplete="off" placeholder="Nhập câu trả lời">`;
    } else {
      control = `<textarea class="form-input career-quiz-response" rows="4" data-career-answer="${id}" placeholder="Trình bày cách làm, lý do, mã nguồn hoặc ví dụ kiểm thử">${escapeHtml(val)}</textarea>`;
    }
    return `<article class="career-quiz-question"><div class="career-quiz-question-meta"><span>CÂU ${index + 1} · ${escapeHtml(typeLabels[question.type] || question.type)}</span><span>${Number(question.points || 1)} điểm</span></div><h4>${escapeHtml(question.prompt)}</h4>${control}</article>`;
  }).join('');
  panel.innerHTML = `<div class="career-quiz-heading"><div><span class="lesson-study-label">NGÂN HÀNG ĐỀ · ${questions.length} CÂU · MA TRẬN ${escapeHtml(({ foundation: 'CỦNG CỐ', standard: 'TIÊU CHUẨN', challenge: 'THỬ THÁCH' })[session.questionMix?.preset] || 'TÙY CHỈNH')}</span><h4>${escapeHtml(session.title || 'Bài luyện tập')}</h4><p>Đề đã được lưu. Câu trả lời sẽ tự lưu khi bạn thay đổi; tải lại trang rồi mở lại bài để tiếp tục.</p></div><span class="career-quiz-pill">Đạt ${Number(session.passScore || 70)} điểm</span></div>${content}<div class="career-quiz-submit-row"><span id="careerDraftStatus" class="footer-muted">Câu trả lời được lưu tự động.</span><button type="button" class="button button-primary" id="submitCareerAssessment">Nộp bài và xem kết quả</button></div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function restoreCareerAssessment(lesson) {
  const examId = sessionStorage.getItem(assessmentStorageKey(lesson));
  if (!examId || !activeUser || !currentProgress?.enrolled) return;
  try {
    const session = await apiRequest(`/api/career/assessments/${encodeURIComponent(examId)}`);
    if (session.lessonId !== lesson.id || session.courseId !== currentCourse.id) return;
    renderCareerAssessment(session);
  } catch (_error) { sessionStorage.removeItem(assessmentStorageKey(lesson)); }
}
function courseFinalAssessmentStorageKey() {
  return `htm-v802-final-assessment:${activeUser?.id || 'anonymous'}:${currentCourse?.id || ''}`;
}
async function restoreCourseFinalAssessment() {
  const examId = sessionStorage.getItem(courseFinalAssessmentStorageKey());
  if (!examId || !activeUser || !currentProgress?.enrolled || !currentCourse) return;
  try {
    const session = await apiRequest(`/api/career/assessments/${encodeURIComponent(examId)}`);
    if (session.courseId !== currentCourse.id || session.scopeType !== 'final') return;
    renderCareerAssessment(session, 'courseFinalQuizPanel');
  } catch (_error) { sessionStorage.removeItem(courseFinalAssessmentStorageKey()); }
}
async function startCourseFinalAssessment() {
  const eligibility = Boolean(currentProgress?.enrolled) && currentCourse?.lessons?.length > 0 && currentCourse.lessons.every((lesson) => (currentProgress.completedLessonIds || []).includes(lesson.id));
  if (!activeUser || !eligibility) {
    showToast('Hãy thêm khóa học và hoàn thành toàn bộ bài học trước khi làm bài kiểm tra cuối khóa.', 'error');
    return;
  }
  const button = document.getElementById('startCourseFinalAssessment');
  const panel = document.getElementById('courseFinalQuizPanel');
  if (assessmentDraftTimer) clearTimeout(assessmentDraftTimer);
  activeAssessment = null;
  activeAssessmentPanelId = 'courseFinalQuizPanel';
  if (button) { button.disabled = true; button.textContent = 'Đang chuẩn bị đề…'; }
  try {
    const storageKey = courseFinalAssessmentStorageKey();
    const existingId = sessionStorage.getItem(storageKey);
    if (existingId) {
      try {
        const existing = await apiRequest(`/api/career/assessments/${encodeURIComponent(existingId)}`);
        if (existing.courseId === currentCourse.id && existing.scopeType === 'final' && existing.status === 'in_progress') {
          renderCareerAssessment(existing, 'courseFinalQuizPanel');
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          showToast('Đã khôi phục bài thi cuối khóa đang làm.');
          return;
        }
      } catch (_error) { /* Create a new final assessment if the saved session is no longer available. */ }
      sessionStorage.removeItem(storageKey);
    }
    const session = await apiRequest(`/api/career/courses/${encodeURIComponent(currentCourse.id)}/assessments`, { method: 'POST', body: JSON.stringify({ scopeType: 'final', count: 30, blueprintPreset: 'standard' }) });
    sessionStorage.setItem(storageKey, session.examId);
    session.draftAnswers = [];
    renderCareerAssessment(session, 'courseFinalQuizPanel');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`Đã tạo bài kiểm tra cuối khóa gồm ${session.questionCount} câu.`);
  } catch (error) {
    if (panel) { panel.hidden = false; panel.innerHTML = `<p class="career-quiz-error">${escapeHtml(error.message || 'Không tạo được bài kiểm tra cuối khóa.')}</p><p class="career-quiz-help">Bài thi chỉ sử dụng câu hỏi đã được giáo viên duyệt và kích hoạt; hiện có thể ngân hàng chưa đủ câu.</p>`; }
    showToast(error.message || 'Không tạo được bài kiểm tra cuối khóa.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Bắt đầu kiểm tra cuối khóa ↗';
    }
  }
}
async function startCareerAssessment(lesson) {
  if (!activeUser || !currentProgress?.enrolled) {
    showToast('Hãy đăng nhập và thêm khóa học vào lộ trình trước khi luyện tập.', 'error');
    return;
  }
  const button = document.getElementById('startCareerPractice');
  const count = Number(document.getElementById('careerPracticeCount')?.value || 10);
  const blueprintPreset = document.getElementById('careerPracticePreset')?.value || 'standard';
  if (button) { button.disabled = true; button.textContent = 'Đang tạo đề…'; }
  try {
    const session = await apiRequest(`/api/career/courses/${encodeURIComponent(currentCourse.id)}/assessments`, { method: 'POST', body: JSON.stringify({ scopeType: 'lesson', lessonId: lesson.id, count, blueprintPreset }) });
    sessionStorage.setItem(assessmentStorageKey(lesson), session.examId);
    session.draftAnswers = [];
    renderCareerAssessment(session);
    showToast(`Đã tạo đề ${session.questionCount} câu. ${session.repeatAvoidance || ''}`);
  } catch (error) {
    const panel = document.getElementById('careerQuizPanel');
    if (panel) { panel.hidden = false; panel.innerHTML = `<p class="career-quiz-error">${escapeHtml(error.message || 'Không tạo được đề kiểm tra.')}</p><p>Ngân hàng câu hỏi chỉ được dùng sau khi admin/giáo viên duyệt và bật câu hỏi đúng bài học.</p>`; }
    showToast(error.message || 'Không tạo được đề.', 'error');
  } finally { if (button) { button.disabled = false; button.textContent = `Tạo đề ${count} câu ↗`; } }
}
function collectCareerAnswers() {
  const panel = document.getElementById(activeAssessmentPanelId);
  if (!panel) return [];
  const values = new Map();
  panel.querySelectorAll('[data-career-answer]').forEach((element) => {
    const id = element.dataset.careerAnswer;
    if (!id) return;
    if (element.type === 'radio') {
      if (element.checked) values.set(id, element.value);
    } else values.set(id, element.value);
  });
  return [...values.entries()].map(([questionId, answer]) => ({ questionId, answer }));
}
function scheduleCareerDraftSave() {
  if (!activeAssessment || activeAssessment.status !== 'in_progress') return;
  const status = document.getElementById(activeAssessmentPanelId)?.querySelector('#careerDraftStatus');
  if (status) status.textContent = 'Đang lưu câu trả lời…';
  if (assessmentDraftTimer) clearTimeout(assessmentDraftTimer);
  assessmentDraftTimer = setTimeout(async () => {
    try {
      const result = await apiRequest(`/api/career/assessments/${encodeURIComponent(activeAssessment.examId)}/draft`, { method: 'PATCH', body: JSON.stringify({ answers: collectCareerAnswers() }) });
      if (status) status.textContent = `Đã lưu ${result.savedAnswers} câu trả lời.`;
      if (activeAssessment) activeAssessment.draftAnswers = collectCareerAnswers();
    } catch (error) { if (status) status.textContent = `Chưa lưu được: ${error.message}`; }
  }, 450);
}
async function submitCareerAssessment() {
  if (!activeAssessment || activeAssessment.status !== 'in_progress') return;
  if (assessmentDraftTimer) clearTimeout(assessmentDraftTimer);
  const panelId = activeAssessmentPanelId;
  const button = document.getElementById(panelId)?.querySelector('#submitCareerAssessment');
  if (button) { button.disabled = true; button.textContent = 'Đang chấm…'; }
  try {
    const result = await apiRequest(`/api/career/assessments/${encodeURIComponent(activeAssessment.examId)}/submit`, { method: 'POST', body: JSON.stringify({ answers: collectCareerAnswers() }) });
    activeAssessment = { ...activeAssessment, status: result.manualReviewPending ? 'needs_review' : 'submitted', score: result.score, autoGradedScore: result.autoGradedScore, passed: result.passed, manualReviewPending: result.manualReviewPending };
    renderCareerAssessment(activeAssessment, panelId);
    showToast(result.message || 'Đã nộp bài.');
  } catch (error) { showToast(error.message || 'Không nộp được bài.', 'error'); if (button) { button.disabled = false; button.textContent = 'Nộp bài và xem kết quả'; } }
}

async function enrollCourse(courseId) {
  if (activeUser?.role === 'teacher') return window.location.assign('/teacher.html#teacherAssignments');
  if (activeUser?.role === 'admin') return window.location.assign('/admin.html');
  try {
    const result = await apiRequest(`/api/career/courses/${encodeURIComponent(courseId)}/enroll`, { method: 'POST', body: JSON.stringify({}) });
    showToast(result.message);
    await loadCatalog(false);
    await openCourse(courseId);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      showToast('Hãy đăng nhập bằng tài khoản học sinh/sinh viên để lưu lộ trình.', 'error');
      window.location.assign(`/login.html?next=${encodeURIComponent('/career.html')}`);
      return;
    }
    showToast(error.message || 'Không thể thêm khóa học.', 'error');
  }
}
async function loadCatalog(initial = true) {
  const data = await apiRequest('/api/career/catalog');
  catalogData = data;
  const requestedGroup = new URLSearchParams(window.location.search).get('group');
  if (!activeGroupId) activeGroupId = catalogData.groups.find((item) => item.id === requestedGroup || String(item.number) === requestedGroup || item.code === requestedGroup)?.id || catalogData.groups[0]?.id || null;
  if (!currentGroup()?.pathways?.some((item) => item.id === activePathway)) activePathway = null;
  renderGroups(); renderPathways(); renderCourses(); refreshMetrics();
  if (initial && data.contentNotice) showNotice(data.contentNotice);
}
function showNotice(message) {
  const old = document.getElementById('careerContentNotice');
  if (old) old.remove();
  const notice = document.createElement('aside');
  notice.id = 'careerContentNotice'; notice.className = 'career-disclaimer'; notice.textContent = message;
  document.querySelector('.career-metrics')?.insertAdjacentElement('afterend', notice);
}
async function init() {
  try {
    activeUser = await currentUser();
    if (activeUser) {
      document.getElementById('loginLink').hidden = true;
      document.getElementById('registerLink').hidden = true;
      document.getElementById('careerUserChip').hidden = false;
      document.getElementById('careerUserName').textContent = activeUser.fullName;
      document.getElementById('careerAvatar').textContent = (activeUser.fullName.trim()[0] || 'H').toLocaleUpperCase('vi-VN');
      if (activeUser.role === 'student' || activeUser.role === 'university_student') document.getElementById('assignmentsNav').hidden = false;
      if (activeUser.role === 'teacher') {
        document.getElementById('assignmentsNav').hidden = false;
        document.getElementById('assignmentsNav').textContent = 'Khu vực giáo viên';
        document.getElementById('assignmentsNav').href = '/teacher.html';
      }
    }
    await loadCatalog();
  } catch (error) {
    courseGrid.innerHTML = '';
    showAlert(alertBox, error.message || 'Không tải được danh mục ngành nghề.');
  }
}

groupGrid?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-group]');
  if (!button) return;
  activeGroupId = button.dataset.group;
  activePathway = null;
  renderGroups(); renderPathways(); renderCourses(); refreshMetrics();
  const url = new URL(window.location.href); url.searchParams.set('group', String(currentGroup()?.number || activeGroupId));
  window.history.replaceState({}, '', url);
  document.getElementById('learningPaths').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
pathwayGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-pathway]');
  if (!button) return;
  activePathway = button.dataset.pathway;
  renderPathways(); renderCourses();
  document.getElementById('courseCatalog').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
courseGrid.addEventListener('click', async (event) => {
  const open = event.target.closest('[data-open-course]');
  const enroll = event.target.closest('[data-enroll-course]');
  if (open) return openCourse(open.dataset.openCourse);
  if (enroll) return enrollCourse(enroll.dataset.enrollCourse);
});
document.getElementById('dialogModules').addEventListener('click', (event) => {
  const button = event.target.closest('[data-study-lesson]');
  if (button && !button.disabled) openStudyLesson(button.dataset.studyLesson);
});
document.getElementById('courseFinalQuizPanel').addEventListener('change', scheduleCareerDraftSave);
document.getElementById('courseFinalQuizPanel').addEventListener('click', async (event) => {
  if (event.target.closest('#submitCareerAssessment')) await submitCareerAssessment();
  if (event.target.closest('#retakeCareerAssessment')) await startCourseFinalAssessment();
});
document.getElementById('startCourseFinalAssessment').addEventListener('click', startCourseFinalAssessment);
document.getElementById('enrollCourseButton').addEventListener('click', () => currentCourse && enrollCourse(currentCourse.id));
document.getElementById('closeCourseDialog').addEventListener('click', () => dialog.close());
document.getElementById('closeCourseFooter').addEventListener('click', () => dialog.close());
document.getElementById('courseSearch').addEventListener('input', renderCourses);
document.getElementById('logoutButton')?.addEventListener('click', async () => { try { await logout(); } catch (error) { showToast(error.message, 'error'); } });
init();
