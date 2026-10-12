import { apiRequest, currentUser, logout, showAlert, clearAlert, escapeHtml, showToast } from './api.js';

const form = document.getElementById('surveyForm');
const container = document.getElementById('questionsContainer');
const alertBox = document.getElementById('surveyAlert');
const submitButton = document.getElementById('submitSurvey');
const formActions = form.querySelector('.survey-actions');
const gradeField = document.getElementById('gradeField');
const programField = document.getElementById('programField');
const gradeAgeNotice = document.getElementById('gradeAgeNotice');
let questions = [];
let savedValues = {};
const QUESTION_KEYS = ['educationLevel', 'goal', 'topics', 'currentLevel', 'weeklyHours', 'learningStyle'];
const LABELS = {
  educationLevel: { primary: 'Tiểu học', middle_school: 'THCS', high_school: 'THPT', university: 'Đại học / Cao đẳng', other: 'Khác' },
  goal: { school_support: 'Học tốt ở trường', entrance_exam: 'Ôn thi chuyển cấp', university: 'Học đại học / chuyên ngành', career: 'Nghề nghiệp', programming: 'Lập trình', english: 'Tiếng Anh', mos: 'MOS', explore: 'Khám phá' },
  currentLevel: { beginner: 'Mới bắt đầu', basic: 'Biết cơ bản', intermediate: 'Đã thực hành được', advanced: 'Khá vững, muốn nâng cao' },
  weeklyHours: { '1-2': '1–2 giờ', '3-5': '3–5 giờ', '6-9': '6–9 giờ', '10+': 'Từ 10 giờ trở lên' },
  learningStyle: { reading: 'Đọc lý thuyết', video: 'Video bài giảng', practice: 'Luyện tập', project: 'Dự án thực tế', mixed: 'Kết hợp nhiều cách' },
  gender: { female: 'Nữ', male: 'Nam', other: 'Khác / tự mô tả', prefer_not_to_say: 'Không muốn trả lời' },
  programCode: { ctst: 'Chân trời sáng tạo', kntt: 'Kết nối tri thức với cuộc sống', canhdieu: 'Cánh Diều' }
};
const SCHOOL_LEVELS = new Set(['primary', 'middle_school', 'high_school']);

function selectedEducationLevel() {
  return form.querySelector('input[name="educationLevel"]:checked')?.value || savedValues.educationLevel || '';
}
function syncGradeField() {
  const schoolLevel = SCHOOL_LEVELS.has(selectedEducationLevel());
  gradeField.hidden = !schoolLevel;
  programField.hidden = !schoolLevel;
  const gradeSelect = document.getElementById('currentSchoolGrade');
  gradeSelect.required = schoolLevel;
  document.getElementById('programCode').required = schoolLevel;
  updateGradeAgeNotice();
}
function updateGradeAgeNotice() {
  const birthDate = document.getElementById('birthDate').value;
  const grade = Number(document.getElementById('currentSchoolGrade').value);
  const education = selectedEducationLevel();
  if (!birthDate || !grade || !SCHOOL_LEVELS.has(education)) {
    gradeAgeNotice.hidden = true;
    gradeAgeNotice.textContent = '';
    return;
  }
  const [year, month, day] = birthDate.split('-').map(Number);
  const startYear = Number((document.querySelector('meta[name="school-year"]')?.content || '2026-2027').split('-')[0]);
  const ref = new Date(Date.UTC(startYear, 8, 1));
  let age = ref.getUTCFullYear() - year;
  if (ref.getUTCMonth() < month - 1 || (ref.getUTCMonth() === month - 1 && ref.getUTCDate() < day)) age -= 1;
  const expected = Math.min(12, Math.max(1, age - 5));
  if (age < 4 || age > 100 || Math.abs(expected - grade) <= 1) {
    gradeAgeNotice.hidden = true;
    gradeAgeNotice.textContent = '';
    return;
  }
  gradeAgeNotice.hidden = false;
  gradeAgeNotice.textContent = `Ngày sinh gợi ý khoảng lớp ${expected}, còn bạn chọn lớp ${grade}. Hệ thống sẽ giữ nguyên lớp bạn khai báo và yêu cầu xác nhận trước khi tạo bài kiểm tra đầu vào. Nếu bạn học vượt/chậm hoặc nhập nhầm, hãy kiểm tra lại thông tin.`;
}
function applySavedProfile() {
  document.getElementById('birthDate').value = savedValues.birthDateText || (savedValues.birthDate ? new Date(savedValues.birthDate).toISOString().slice(0, 10) : '');
  document.getElementById('gender').value = savedValues.gender || '';
  document.getElementById('currentSchoolGrade').value = savedValues.currentSchoolGrade == null ? '' : String(savedValues.currentSchoolGrade);
  document.getElementById('programCode').value = savedValues.programCode || 'ctst';
  syncGradeField();
}
function renderQuestions() {
  container.innerHTML = questions.map((question, index) => {
    const isMultiple = question.type === 'multiple';
    const saved = savedValues[question.key];
    const savedSet = new Set(Array.isArray(saved) ? saved : saved ? [saved] : []);
    const options = question.options.map((option) => {
      const checked = savedSet.has(option.value) ? ' checked' : '';
      const inputType = isMultiple ? 'checkbox' : 'radio';
      const hint = option.hint ? `<small>${escapeHtml(option.hint)}</small>` : '';
      return `<label class="choice-option"><input type="${inputType}" name="${escapeHtml(question.key)}" value="${escapeHtml(option.value)}"${checked}><span><strong>${escapeHtml(option.label)}</strong>${hint}</span></label>`;
    }).join('');
    return `<section class="survey-card" data-question="${escapeHtml(question.key)}"><div class="survey-question-head"><span class="question-number">${String(index + 1).padStart(2, '0')}</span><div><h2>${escapeHtml(question.title)} <span aria-hidden="true">*</span></h2><p>${isMultiple ? 'Chọn một hoặc nhiều đáp án.' : 'Chọn một đáp án phù hợp nhất.'}</p></div></div><div class="choice-grid ${question.key === 'topics' ? 'cols-3' : ''}">${options}</div><div class="field-error" data-question-error="${escapeHtml(question.key)}"></div></section>`;
  }).join('');
  document.getElementById('challenges').value = savedValues.challenges || '';
  document.getElementById('target').value = savedValues.target || '';
  applySavedProfile();
  container.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => {
    if (input.name === 'educationLevel') syncGradeField();
    updateProgress();
  }));
  document.getElementById('progressLabel').textContent = 'Thông tin cá nhân + 6 câu khảo sát · khoảng 4 phút';
  updateProgress();
}
function getFormValues() {
  const value = {};
  for (const key of QUESTION_KEYS) {
    if (key === 'topics') value.topics = [...form.querySelectorAll('input[name="topics"]:checked')].map((item) => item.value);
    else value[key] = form.querySelector(`input[name="${key}"]:checked`)?.value || '';
  }
  value.birthDate = document.getElementById('birthDate').value;
  value.gender = document.getElementById('gender').value;
  value.currentSchoolGrade = document.getElementById('currentSchoolGrade').value;
  value.programCode = document.getElementById('programCode').value || 'ctst';
  value.challenges = document.getElementById('challenges').value.trim();
  value.target = document.getElementById('target').value.trim();
  return value;
}
function requiredFieldCount(value) {
  return QUESTION_KEYS.length + 2 + (SCHOOL_LEVELS.has(value.educationLevel) ? 2 : 0);
}
function countCompleted(value) {
  let count = QUESTION_KEYS.filter((key) => key === 'topics' ? value.topics.length > 0 : Boolean(value[key])).length;
  if (value.birthDate) count += 1;
  if (value.gender) count += 1;
  if (SCHOOL_LEVELS.has(value.educationLevel)) {
    if (value.currentSchoolGrade) count += 1;
    if (value.programCode) count += 1;
  }
  return count;
}
function updateProgress() {
  const value = getFormValues();
  const total = requiredFieldCount(value);
  const count = countCompleted(value);
  document.getElementById('progressCount').textContent = `${count}/${total} mục bắt buộc hoàn thành`;
  document.getElementById('progressBar').style.width = `${Math.round(count / total * 100)}%`;
  updateGradeAgeNotice();
}
function clearQuestionErrors() {
  form.querySelectorAll('[data-question-error], [data-field-error]').forEach((element) => { element.textContent = ''; });
}
function showQuestionsForEditing(response) {
  savedValues = { ...response };
  renderQuestions();
  formActions.hidden = false;
  submitButton.textContent = 'Cập nhật khảo sát →';
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderSummary(response, recommendation = []) {
  savedValues = { ...response };
  const get = (key) => (LABELS[key] && LABELS[key][response[key]]) || response[key] || 'Chưa có';
  const topicLabels = (response.topics || []).map((topic) => {
    const option = questions.find((question) => question.key === 'topics')?.options.find((item) => item.value === topic);
    return option?.label || topic;
  });
  const schoolLearner = SCHOOL_LEVELS.has(response.educationLevel) && Number.isInteger(Number(response.currentSchoolGrade));
  const mismatchNotice = response.gradeAgeMismatch ? `<p class="summary-detail"><strong>Lưu ý độ tuổi:</strong> Bạn chọn lớp ${escapeHtml(response.currentSchoolGrade)}, còn ngày sinh gợi ý khoảng lớp ${escapeHtml(response.expectedGrade)}. Hệ thống không tự đổi lớp; cần xác nhận trước khi tạo bài kiểm tra.</p>` : '';
  container.innerHTML = `<section class="survey-card"><div class="survey-question-head"><span class="question-number">✓</span><div><h2>Khảo sát đã được lưu!</h2><p>Hệ thống dùng ngày sinh, lớp hiện tại và lĩnh vực muốn học để chọn bài đánh giá phù hợp.</p></div></div><div class="stats-grid summary-stats"><div class="stat-card"><span class="stat-label">Cấp học</span><span class="stat-value summary-stat-value">${escapeHtml(get('educationLevel'))}</span></div><div class="stat-card"><span class="stat-label">Lớp hiện tại</span><span class="stat-value summary-stat-value">${escapeHtml(response.currentSchoolGrade ? `Lớp ${response.currentSchoolGrade}` : 'Không áp dụng')}</span></div><div class="stat-card"><span class="stat-label">Độ tuổi</span><span class="stat-value summary-stat-value">${escapeHtml(response.age ? `${response.age} tuổi` : '—')}</span></div><div class="stat-card"><span class="stat-label">Giới tính</span><span class="stat-value summary-stat-value">${escapeHtml(get('gender'))}</span></div></div><div class="survey-summary-profile"><strong>Ngày sinh:</strong> ${escapeHtml(response.birthDateText || '—')} &nbsp;·&nbsp; <strong>Chương trình:</strong> ${escapeHtml(get('programCode'))}</div><div class="panel summary-panel"><div class="panel-heading"><h2>Mục tiêu và lĩnh vực quan tâm</h2><span>HỒ SƠ CỦA BẠN</span></div><p class="summary-goal"><strong>Mục tiêu:</strong> ${escapeHtml(get('goal'))}</p><div class="summary-topics">${topicLabels.map((topic) => `<span class="pill">${escapeHtml(topic)}</span>`).join('')}</div>${response.challenges ? `<p class="summary-detail"><strong>Khó khăn:</strong> ${escapeHtml(response.challenges)}</p>` : ''}${response.target ? `<p class="summary-detail"><strong>Kết quả mong muốn:</strong> ${escapeHtml(response.target)}</p>` : ''}${mismatchNotice}</div>${recommendation.length ? `<div class="panel summary-panel"><div class="panel-heading"><h2>Gợi ý bước tiếp theo</h2><span>ĐỊNH HƯỚNG BAN ĐẦU</span></div><div class="mini-list">${recommendation.map((item) => `<div class="mini-list-item"><span class="mini-list-icon">↗</span><div><p>${escapeHtml(item)}</p></div></div>`).join('')}</div></div>` : ''}<div class="summary-actions"><a class="button button-quiet" href="/dashboard.html">Về bảng điều khiển</a>${schoolLearner ? '<button id="startPlacement" type="button" class="button button-primary">Làm bài kiểm tra đầu vào ↗</button>' : ''}<button id="editSurvey" type="button" class="button button-quiet">Cập nhật câu trả lời</button></div>${schoolLearner ? '<section class="placement-panel" id="placementPanel" hidden></section>' : ''}</section>`;
  document.getElementById('progressLabel').textContent = 'Khảo sát đã hoàn thành';
  document.getElementById('progressCount').textContent = `${requiredFieldCount(response)}/${requiredFieldCount(response)} mục bắt buộc hoàn thành`;
  document.getElementById('progressBar').style.width = '100%';
  formActions.hidden = true;
  document.getElementById('editSurvey').addEventListener('click', () => showQuestionsForEditing(response));
  document.getElementById('startPlacement')?.addEventListener('click', startPlacementTest);
}
function renderPlacementPaper(panel, assessment) {
  panel.hidden = false;
  panel.innerHTML = `<div class="panel-heading"><div><h2>Kiểm tra đầu vào · Lớp ${escapeHtml(assessment.grade)}</h2><p>Đề gồm ${assessment.questionCount} câu theo lớp, môn và lĩnh vực đã chọn. Kết quả chỉ gợi ý ôn tập, không tự thay đổi lớp.</p></div><span class="pill">${escapeHtml(assessment.age)} tuổi</span></div><form id="placementForm">${assessment.questions.map((question, index) => {
    const title = `<span class="section-kicker">CÂU ${index + 1} · ${escapeHtml(question.subjectTitle || 'Kiến thức phổ thông')}</span><div class="placement-question-title">${escapeHtml(question.prompt)}</div>`;
    if (question.type === 'multiple_choice') return `<fieldset class="placement-question"><legend>${title}</legend><div class="placement-options">${(question.options || []).map((option) => `<label class="placement-option"><input type="radio" name="q-${escapeHtml(question.id)}" value="${escapeHtml(option.value)}" required><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>`;
    return `<label class="placement-question"><span>${title}</span><input class="control-input" data-placement-answer="${escapeHtml(question.id)}" maxlength="1000" required placeholder="Nhập đáp án ngắn gọn"></label>`;
  }).join('')}<div class="placement-actions"><button class="button button-primary" type="submit">Nộp bài kiểm tra</button><button class="button button-quiet" id="cancelPlacement" type="button">Để sau</button></div></form><div id="placementResult"></div>`;
  document.getElementById('placementForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter || panel.querySelector('button[type="submit"]');
    button.disabled = true;
    const answers = assessment.questions.map((question) => {
      if (question.type === 'multiple_choice') return { questionId: question.id, answer: panel.querySelector(`input[name="q-${CSS.escape(question.id)}"]:checked`)?.value || '' };
      return { questionId: question.id, answer: panel.querySelector(`[data-placement-answer="${CSS.escape(question.id)}"]`)?.value.trim() || '' };
    });
    try {
      const result = await apiRequest(`/api/survey/placement-test/${encodeURIComponent(assessment.placementId)}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
      document.getElementById('placementResult').innerHTML = `<div class="placement-result"><strong>Kết quả: ${escapeHtml(result.score)}/100</strong><p>${escapeHtml(result.message)}</p><p>Lớp đang khai báo: ${escapeHtml(result.currentGrade)} · Mức nên ôn tiếp: ${escapeHtml(result.suggestedGrade)}.</p><p>${result.passed ? 'Đã đạt mốc đánh giá 70 điểm.' : 'Chưa đạt mốc 70 điểm; hãy xem lại kiến thức và thử đề khác sau.'} Lớp chính thức không tự đổi theo điểm.</p></div>`;
      panel.querySelector('#placementForm').querySelectorAll('input,button').forEach((item) => { item.disabled = true; });
      showToast('Đã lưu kết quả kiểm tra đầu vào.');
    } catch (error) {
      showAlert(alertBox, error.message || 'Không thể nộp bài kiểm tra đầu vào.');
      button.disabled = false;
    }
  });
  panel.querySelector('#cancelPlacement').addEventListener('click', () => { panel.hidden = true; });
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function startPlacementTest() {
  const panel = document.getElementById('placementPanel');
  const button = document.getElementById('startPlacement');
  if (!panel || !button) return;
  let confirmGradeMismatch = false;
  if (savedValues.gradeAgeMismatch) {
    confirmGradeMismatch = window.confirm(`Ngày sinh gợi ý khoảng lớp ${savedValues.expectedGrade}, nhưng hồ sơ đang chọn lớp ${savedValues.currentSchoolGrade}. Bạn có muốn tạo bài kiểm tra đúng theo lớp ${savedValues.currentSchoolGrade} mà bạn đã khai báo không? Hệ thống sẽ không tự chuyển lớp.`);
    if (!confirmGradeMismatch) return;
  }
  button.disabled = true;
  button.textContent = 'Đang tạo đề…';
  clearAlert(alertBox);
  try {
    const assessment = await apiRequest('/api/survey/placement-test', { method: 'POST', body: JSON.stringify({ confirmGradeMismatch }) });
    renderPlacementPaper(panel, assessment);
    button.textContent = 'Đề kiểm tra đã tạo';
  } catch (error) {
    showAlert(alertBox, error.message || 'Không thể tạo bài kiểm tra đầu vào.');
    button.disabled = false;
    button.textContent = 'Thử tạo bài kiểm tra lại ↗';
  }
}
async function init() {
  try {
    const user = await currentUser();
    if (!user) return window.location.replace('/login.html');
    if (!['student', 'university_student'].includes(user.role)) return window.location.replace('/dashboard.html');
    const [questionData, responseData] = await Promise.all([apiRequest('/api/survey/questions'), apiRequest('/api/survey/me')]);
    questions = questionData.questions;
    savedValues = responseData.response || {};
    if (responseData.completed && responseData.response) renderSummary(responseData.response, responseData.recommendation || []);
    else renderQuestions();
  } catch (error) {
    showAlert(alertBox, error.message || 'Không tải được khảo sát.');
  }
}
form.addEventListener('submit', async (event) => {
  event.preventDefault(); clearAlert(alertBox); clearQuestionErrors();
  const value = getFormValues();
  const missing = QUESTION_KEYS.filter((key) => key === 'topics' ? !value.topics.length : !value[key]);
  if (!value.birthDate) missing.push('birthDate');
  if (!value.gender) missing.push('gender');
  if (SCHOOL_LEVELS.has(value.educationLevel)) {
    if (!value.currentSchoolGrade) missing.push('currentSchoolGrade');
    if (!value.programCode) missing.push('programCode');
  }
  if (missing.length) {
    missing.forEach((key) => {
      const node = form.querySelector(`[data-question-error="${key}"], [data-field-error="${key}"]`);
      if (node) node.textContent = key === 'topics' ? 'Hãy chọn ít nhất một lĩnh vực.' : 'Vui lòng điền/chọn mục này.';
    });
    showAlert(alertBox, 'Hãy hoàn thành các mục bắt buộc trước khi lưu.');
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = 'Đang lưu…';
  try {
    const data = await apiRequest('/api/survey/submit', { method: 'POST', body: JSON.stringify(value) });
    savedValues = data.response;
    showToast(data.message || 'Đã lưu khảo sát.');
    renderSummary(data.response, data.recommendation || []);
  } catch (error) {
    showAlert(alertBox, error.message || 'Không thể lưu khảo sát.');
    for (const [key, message] of Object.entries(error.fields || {})) {
      const node = form.querySelector(`[data-question-error="${key}"], [data-field-error="${key}"]`);
      if (node) node.textContent = message;
    }
  } finally {
    submitButton.disabled = false;
    if (!formActions.hidden) submitButton.textContent = 'Lưu khảo sát →';
  }
});
document.getElementById('birthDate').addEventListener('change', updateProgress);
document.getElementById('gender').addEventListener('change', updateProgress);
document.getElementById('currentSchoolGrade').addEventListener('change', updateProgress);
document.getElementById('programCode').addEventListener('change', updateProgress);
document.getElementById('logoutButton').addEventListener('click', async () => {
  try { await logout(); } catch (error) { showToast(error.message, 'error'); }
});
init();
