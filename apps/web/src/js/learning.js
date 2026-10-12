import { apiRequest, currentUser, logout, showAlert, clearAlert, showToast, escapeHtml } from './api.js';

const alertBox = document.getElementById('learningAlert');
const gradeSelect = document.getElementById('gradeSelect');
const programSelect = document.getElementById('programSelect');
const subjectGrid = document.getElementById('subjectGrid');
let activeUser = null;
let lastCatalog = null;
function selectionKey() { return `htm:user:${String(activeUser?.id || activeUser?._id || 'anonymous')}:learning-selection`; }
function readSavedSelection() { try { return JSON.parse(localStorage.getItem(selectionKey()) || '{}'); } catch { return {}; } }
function saveSelection() { try { localStorage.setItem(selectionKey(), JSON.stringify({ grade: Number(gradeSelect.value), programCode: programSelect.value })); } catch {} }

const typeLabels = { ctst: 'Chân trời sáng tạo', kntt: 'Kết nối tri thức với cuộc sống', canhdieu: 'Cánh Diều' };

function examUrl(type, course, unitId = '') {
  const params = new URLSearchParams({ type, grade: String(course.grade), programCode: course.programCode, subjectCode: course.subjectCode });
  if (unitId) params.set('unitId', unitId);
  return `/exam.html?${params.toString()}`;
}

function renderSubject(course, passScore) {
  const allLessons = course.units.flatMap((unit) => unit.lessons);
  const completeCount = allLessons.filter((lesson) => lesson.completed).length;
  const percent = allLessons.length ? Math.round(completeCount / allLessons.length * 100) : 0;
  const lessonsHtml = course.units.map((unit, unitIndex) => {
    const unitComplete = unit.lessons.every((lesson) => lesson.completed);
    const openChapterTest = unitComplete;
    return `<details class="unit-item" ${unitIndex === 0 ? 'open' : ''}><summary><span class="unit-number">${String(unit.sequence).padStart(2, '0')}</span><span class="unit-summary-copy"><strong>${escapeHtml(unit.title)}</strong><small>${unit.lessons.length} bài học · ${unit.lessons.filter((lesson) => lesson.completed).length}/${unit.lessons.length} hoàn thành</small></span><span class="unit-caret">⌄</span></summary><div class="unit-lessons">${unit.lessons.map((lesson) => `<a class="lesson-row ${lesson.completed ? 'is-completed' : ''} ${!lesson.unlocked ? 'is-locked' : ''}" href="${lesson.unlocked ? `/lesson.html?id=${encodeURIComponent(lesson.id)}` : '#'}" ${lesson.unlocked ? '' : 'aria-disabled="true" tabindex="-1"'}><span class="lesson-state">${lesson.completed ? '✓' : lesson.unlocked ? '▶' : '🔒'}</span><span class="lesson-row-copy"><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.completed ? `Đã đạt · ${lesson.bestScore} điểm` : lesson.unlocked ? `${lesson.parts} phần học · ${lesson.estimatedMinutes} phút` : `Cần đạt ${passScore} điểm ở bài trước`}</small></span><span class="lesson-row-end">${lesson.completed ? `${lesson.bestScore}đ` : lesson.unlocked ? 'Học bài →' : 'Đang khóa'}</span></a>`).join('')}${openChapterTest ? `<a class="unit-assessment-link" href="${examUrl('chapter', course, unit.id)}">✓ Làm kiểm tra chủ điểm</a>` : `<div class="unit-test-locked">🔒 Kiểm tra chủ điểm mở khi hoàn thành các bài trong chủ điểm.</div>`}</div></details>`;
  }).join('');
  const lessons = allLessons;
  const midtermCount = Math.max(1, Math.ceil(lessons.length / 2));
  const canMidterm = lessons.slice(0, midtermCount).every((lesson) => lesson.completed);
  const canFinal = lessons.every((lesson) => lesson.completed);
  return `<details class="subject-card" id="subject-${escapeHtml(course.subjectCode)}"><summary class="subject-card-head"><span class="subject-icon subject-${escapeHtml(course.subjectCode)}">${escapeHtml(course.subjectIcon || '📘')}</span><span class="subject-heading"><strong>${escapeHtml(course.subjectName)}</strong><small>${course.required ? 'Môn học theo chương trình' : 'Môn có thể lựa chọn'} · ${course.lessonCount} bài</small><span class="subject-progress"><i style="width:${percent}%"></i></span><small>${completeCount}/${lessons.length} bài hoàn thành · ${percent}%</small></span><span class="subject-open-icon">⌄</span></summary><div class="subject-card-body"><div class="subject-assessment-actions"><a class="small-action" href="${examUrl('practice', course)}">🧩 Đề luyện tập</a><a class="small-action ${canMidterm ? '' : 'disabled-action'}" href="${canMidterm ? examUrl('midterm', course) : '#'}" ${canMidterm ? '' : 'aria-disabled="true" tabindex="-1"'}>📝 Kiểm tra giữa kỳ</a><a class="small-action ${canFinal ? '' : 'disabled-action'}" href="${canFinal ? examUrl('final', course) : '#'}" ${canFinal ? '' : 'aria-disabled="true" tabindex="-1"'}>🏁 Kiểm tra cuối kỳ</a></div>${lessonsHtml}<div class="assessment-lock-note">Mở bài tiếp theo khi bài trước đạt ít nhất ${passScore}/100 và hoàn thành các câu kiểm tra từng phần.</div></div></details>`;
}

async function loadCatalog() {
  clearAlert(alertBox);
  subjectGrid.innerHTML = '<div class="catalog-loading">Đang tải lộ trình lớp học...</div>';
  const grade = Number(gradeSelect.value);
  const programCode = programSelect.value;
  try {
    const data = await apiRequest(`/api/learning/catalog?grade=${grade}&programCode=${encodeURIComponent(programCode)}`);
    lastCatalog = data;
    document.getElementById('catalogTitle').textContent = `Lộ trình lớp ${grade}`;
    document.getElementById('catalogSubtitle').textContent = `${typeLabels[programCode]} · lớp ${grade <= 5 ? 'tiểu học' : grade <= 9 ? 'THCS' : 'THPT'} · chương trình theo môn, chủ điểm và bài học`;
    document.getElementById('totalLessonCount').textContent = data.totals.lessons.toLocaleString('vi-VN');
    subjectGrid.innerHTML = data.courses.map((course) => renderSubject(course, data.passScore)).join('');
    if (data.contentStatus === 'draft-review-required') document.querySelector('.curriculum-note')?.classList.add('is-visible');
    const recommendationData = await apiRequest(`/api/learning/recommendations?grade=${grade}&programCode=${encodeURIComponent(programCode)}`);
    const recommendation = recommendationData.recommendation;
    document.getElementById('recommendTitle').textContent = recommendation.title;
    document.getElementById('recommendMessage').textContent = recommendation.message;
    const recommendationAction = document.getElementById('recommendAction');
    recommendationAction.href = recommendation.lessonId ? `/lesson.html?id=${encodeURIComponent(recommendation.lessonId)}` : '#subjectCatalog';
    recommendationAction.textContent = recommendation.lessonId ? 'Bắt đầu bước này →' : 'Xem môn học ↓';
  } catch (error) {
    subjectGrid.innerHTML = '';
    showAlert(alertBox, error.message || 'Không thể tải danh mục môn học.');
  }
}


async function createStudyPlan() {
  const button = document.getElementById('createStudyPlan');
  const resultBox = document.getElementById('studyPlanResult');
  button.disabled = true;
  button.textContent = 'Đang lập kế hoạch...';
  resultBox.hidden = false;
  resultBox.innerHTML = '<p class="study-plan-loading">Đang chọn các bài học phù hợp với tiến độ hiện tại...</p>';
  try {
    const data = await apiRequest('/api/learning/study-plan', { method: 'POST', body: JSON.stringify({ grade: Number(gradeSelect.value), programCode: programSelect.value }) });
    const plan = data.plan;
    resultBox.innerHTML = `<div class="study-plan-result-header"><div><h3>${escapeHtml(plan.title)}</h3><p>${escapeHtml(plan.summary)}</p></div><span class="plan-mode">${plan.mode === 'gemini-ai' ? 'AI Gemini' : 'Gợi ý theo quy tắc'}</span></div><div class="study-plan-sessions">${(plan.sessions || []).map((session) => `<article class="study-session"><span class="study-session-number">${String(session.session).padStart(2, '0')}</span><div class="study-session-copy"><div class="section-kicker">${escapeHtml(session.subjectName)} · ${escapeHtml(session.minutes)} PHÚT</div><h4>${escapeHtml(session.title)}</h4><p>${escapeHtml(session.focus)}</p><small>${escapeHtml(session.activity)}</small><a href="/lesson.html?id=${encodeURIComponent(session.lessonId)}">Mở bài học →</a></div></article>`).join('')}</div><p class="study-plan-notice">${escapeHtml(plan.notice || 'Điều chỉnh lịch học theo thời gian và sự hỗ trợ của giáo viên/phụ huynh.')}${data.profileUsed ? '' : ' Chưa có khảo sát đầu vào; kế hoạch chưa cá nhân hóa đầy đủ theo hồ sơ.'}</p>`;
  } catch (error) {
    resultBox.innerHTML = `<p class="study-plan-error">${escapeHtml(error.message || 'Không tạo được kế hoạch. Hãy thử lại sau.')}</p>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Tạo lại kế hoạch ↻';
  }
}

async function init() {
  try {
    activeUser = await currentUser();
    if (!activeUser) return window.location.replace('/login.html');
    if (activeUser.role === 'admin') return window.location.replace('/admin.html');
    if (activeUser.role === 'teacher') return window.location.replace('/teacher.html');
    document.getElementById('userName').textContent = activeUser.fullName;
    document.getElementById('userAvatar').textContent = (activeUser.fullName.trim()[0] || 'H').toLocaleUpperCase('vi-VN');
    const gradeMatch = String(activeUser.grade || '').match(/(?:lớp\s*)?(1[0-2]|[1-9])(?:\b|$)/i);
    const params = new URLSearchParams(window.location.search);
    const saved = readSavedSelection();
    const validGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    if (validGrades.includes(params.get('grade'))) gradeSelect.value = params.get('grade');
    else if (validGrades.includes(String(saved.grade))) gradeSelect.value = String(saved.grade);
    else if (gradeMatch) gradeSelect.value = gradeMatch[1];
    if (['ctst', 'kntt', 'canhdieu'].includes(params.get('programCode'))) programSelect.value = params.get('programCode');
    else if (['ctst', 'kntt', 'canhdieu'].includes(saved.programCode)) programSelect.value = saved.programCode;
    saveSelection();
    await loadCatalog();
  } catch (error) {
    showAlert(alertBox, error.message || 'Không thể tải trang học tập.');
  }
}

document.getElementById('createStudyPlan').addEventListener('click', createStudyPlan);
gradeSelect.addEventListener('change', () => { saveSelection(); loadCatalog(); });
programSelect.addEventListener('change', () => { saveSelection(); loadCatalog(); });
subjectGrid.addEventListener('click', (event) => {
  const locked = event.target.closest('.lesson-row.is-locked, .disabled-action');
  if (locked) {
    event.preventDefault();
    showToast('Hoàn thành bài học trước và đạt điểm yêu cầu để mở nội dung tiếp theo.', 'error');
  }
});
document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await logout(); } catch (error) { showToast(error.message, 'error'); }
});
init();
