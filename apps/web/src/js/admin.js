import { apiRequest, currentUser, logout, showAlert, showToast, escapeHtml } from './api.js';

const alertBox = document.getElementById('adminAlert');
const roleNames = { student: 'Học sinh', university_student: 'Sinh viên', teacher: 'Giáo viên', admin: 'Admin', anonymous: 'Ẩn danh' };
const programNames = { ctst: 'Chân trời sáng tạo', kntt: 'Kết nối tri thức', canhdieu: 'Cánh Diều' };
const contentNames = { course: 'Khóa học', lesson: 'Bài học', assessment: 'Bài kiểm tra', import: 'Nhập Word' };
const actionNames = {
  'account.login': 'Đăng nhập', 'account.register': 'Đăng ký', 'admin.login': 'Admin đăng nhập', 'account.logout': 'Đăng xuất',
  'account.suspend': 'Khóa tài khoản', 'account.activate': 'Mở khóa tài khoản', 'account.delete': 'Xóa tài khoản',
  'learning.lesson.open': 'Mở bài học', 'learning.assessment.submit': 'Nộp kiểm tra', 'content.create': 'Tạo nội dung',
  'content.update': 'Sửa nội dung', 'content.delete': 'Xóa nội dung', 'question.create': 'Thêm câu hỏi', 'question.update': 'Sửa câu hỏi',
  'question.disable': 'Tắt câu hỏi', 'career.question.create': 'Tạo câu hỏi CNTT', 'career.question.update': 'Sửa câu hỏi CNTT', 'career.question.activate': 'Duyệt câu hỏi CNTT', 'career.question.disable': 'Tắt câu hỏi CNTT', 'career.question.delete': 'Lưu trữ câu hỏi CNTT', 'career.question.bulk-activate': 'Duyệt hàng loạt câu CNTT', 'career.question.bulk-disable': 'Tắt hàng loạt câu CNTT', 'account.delete.verification_failed': 'Xóa tài khoản chưa xác minh', 'word-import.preview': 'Nhận diện file Word', 'word-import.commit': 'Lưu file Word'
};
const typeNames = { multiple_choice: 'Trắc nghiệm', true_false: 'Đúng / sai', fill_blank: 'Điền khuyết', short_answer: 'Trả lời ngắn', essay: 'Tự luận', code_challenge: 'Bài lập trình', debugging: 'Debug', design_task: 'Bài thiết kế' };
let usersPage = 1;
let activityPage = 1;
let wordImportState = null;
let contentCache = [];
let questionCache = [];
let careerQuestionCache = [];
let careerCourseCache = [];

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function setSelectOptions(element, rows, emptyLabel = '') {
  if (!element) return;
  const previous = element.value;
  const opts = [];
  if (emptyLabel !== null) opts.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
  for (const row of rows) opts.push(`<option value="${escapeHtml(row.value)}">${escapeHtml(row.label)}</option>`);
  element.innerHTML = opts.join('');
  if ([...element.options].some((item) => item.value === previous)) element.value = previous;
}
function gradeOptions(element, includeAll = false) {
  const rows = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Lớp ${index + 1}` }));
  setSelectOptions(element, rows, includeAll ? 'Tất cả lớp' : null);
  if (!includeAll && !element.value) element.value = '1';
}
async function populateLocation(prefix) {
  const grade = document.getElementById(`${prefix}Grade`);
  const program = document.getElementById(`${prefix}Program`);
  const subject = document.getElementById(`${prefix}Subject`);
  const lesson = document.getElementById(`${prefix}Lesson`);
  const courseId = document.getElementById(`${prefix}CourseId`);
  const selectedGrade = grade?.value || '1';
  const selectedProgram = program?.value || 'ctst';
  if (!subject) return;
  try {
    const catalog = await apiRequest(`/api/admin/curriculum/catalog?grade=${encodeURIComponent(selectedGrade)}&programCode=${encodeURIComponent(selectedProgram)}`);
    const subjects = catalog.subjects.map((item) => ({ value: item.code, label: `${item.name}${item.courseId && item.courseId.includes('g10') && !item.code ? '' : ''}` }));
    const oldSubject = subject.value;
    setSelectOptions(subject, subjects, null);
    if (subjects.some((item) => item.value === oldSubject)) subject.value = oldSubject;
    else if (subjects.length) subject.value = subjects[0].value;
    const course = catalog.subjects.find((item) => item.code === subject.value) || catalog.subjects[0];
    if (courseId && course) courseId.value = course.courseId;
    if (lesson) {
      const lessons = (course?.units || []).flatMap((unit) => unit.lessons.map((item) => ({ value: item.id, label: `${unit.title} · ${item.title}` })));
      setSelectOptions(lesson, lessons, '— Chọn bài học đích —');
    }
  } catch (error) { showToast(`Không tải được danh mục lớp ${selectedGrade}: ${error.message}`, 'error'); }
}
function initGradeSelects() {
  ['contentGrade', 'questionGrade', 'questionFilterGrade', 'wordGrade'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) gradeOptions(element, id === 'questionFilterGrade');
  });
}
function setActiveTab(name) {
  document.querySelectorAll('.admin-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === name));
  document.querySelectorAll('.admin-section').forEach((section) => section.classList.toggle('active', section.id === `tab-${name}`));
  if (name === 'users') loadUsers();
  if (name === 'activity') loadActivity();
  if (name === 'content') loadContent();
  if (name === 'questions') loadQuestions();
  if (name === 'career-questions') loadCareerQuestions();
}
async function loadOverview() {
  const [overview, surveys] = await Promise.all([apiRequest('/api/admin/overview'), apiRequest('/api/admin/survey-responses?page=1&limit=15')]);
  document.getElementById('userCount').textContent = overview.users;
  document.getElementById('studentCount').textContent = overview.students;
  document.getElementById('universityCount').textContent = overview.universityStudents;
  document.getElementById('suspendedCount').textContent = overview.suspendedUsers;
  document.getElementById('questionCount').textContent = overview.questionCount;
  document.getElementById('draftCount').textContent = overview.contentDrafts;
  document.getElementById('surveyTotalLabel').textContent = `${surveys.total} PHẢN HỒI`;
  const educationNames = { primary: 'Tiểu học', middle_school: 'THCS', high_school: 'THPT', university: 'Đại học/CĐ', other: 'Khác' };
  const goalNames = { school_support: 'Học tốt ở trường', entrance_exam: 'Ôn thi chuyển cấp', university: 'Học đại học', career: 'Nghề nghiệp', programming: 'Lập trình', english: 'Tiếng Anh', mos: 'MOS', explore: 'Khám phá' };
  const topicNames = { cpp: 'C++', javascript: 'JavaScript', css_html: 'HTML/CSS', java: 'Java', csharp: 'C#', python: 'Python', math: 'Toán', english: 'Tiếng Anh', toeic: 'TOEIC', mos: 'MOS', soft_skills: 'Kỹ năng mềm', school_subjects: 'Môn phổ thông' };
  document.getElementById('surveysTable').innerHTML = surveys.rows.length ? surveys.rows.map((item) => `<tr><td><strong>${escapeHtml(item.user?.fullName || 'Tài khoản đã xóa')}</strong><br><small>${escapeHtml(item.user?.email || '')}</small></td><td>${escapeHtml(educationNames[item.educationLevel] || item.educationLevel)}</td><td>${escapeHtml(goalNames[item.goal] || item.goal)}</td><td>${(item.topics || []).map((topic) => escapeHtml(topicNames[topic] || topic)).join(', ')}</td><td>${escapeHtml(item.weeklyHours)} giờ</td><td>${dateTime(item.completedAt)}</td></tr>`).join('') : '<tr><td colspan="6">Chưa có phản hồi khảo sát.</td></tr>';
}
async function loadUsers() {
  const tbody = document.getElementById('usersTable');
  tbody.innerHTML = '<tr><td colspan="6">Đang tải tài khoản…</td></tr>';
  try {
    const q = new URLSearchParams({ page: String(usersPage), limit: '20' });
    const search = document.getElementById('userSearch').value.trim();
    const status = document.getElementById('userStatusFilter').value;
    const role = document.getElementById('userRoleFilter').value;
    if (search) q.set('q', search); if (status) q.set('status', status); if (role) q.set('role', role);
    const data = await apiRequest(`/api/admin/users?${q}`);
    tbody.innerHTML = data.rows.length ? data.rows.map((item) => `<tr><td><strong>${escapeHtml(item.fullName)}</strong><br><small>${escapeHtml(item.email)}</small></td><td>${escapeHtml(roleNames[item.role] || item.role)}</td><td>${escapeHtml(item.school || '—')}<br><small>${escapeHtml(item.grade || '')}</small></td><td><span class="status-pill ${item.status === 'suspended' ? 'status-off' : 'status-on'}">${item.status === 'suspended' ? 'Đã khóa' : 'Hoạt động'}</span></td><td>${dateTime(item.createdAt)}</td><td><div class="row-actions"><button class="button button-quiet button-small" data-user-action="${item.status === 'suspended' ? 'activate' : 'suspend'}" data-user-id="${escapeHtml(item._id)}">${item.status === 'suspended' ? 'Mở khóa' : 'Khóa'}</button><button class="button button-danger button-small" data-user-action="delete" data-user-id="${escapeHtml(item._id)}">Xóa</button></div></td></tr>`).join('') : '<tr><td colspan="6">Không tìm thấy tài khoản phù hợp.</td></tr>';
    document.getElementById('usersPagination').textContent = `Trang ${data.page} · ${data.total} tài khoản`;
    document.getElementById('usersPrev').disabled = usersPage <= 1;
    document.getElementById('usersNext').disabled = usersPage * data.limit >= data.total;
  } catch (error) { tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`; }
}
async function loadActivity() {
  const tbody = document.getElementById('activityTable'); tbody.innerHTML = '<tr><td colspan="5">Đang tải nhật ký…</td></tr>';
  try {
    const q = new URLSearchParams({ page: String(activityPage), limit: '40' });
    const role = document.getElementById('activityRoleFilter').value; const action = document.getElementById('activityActionFilter').value;
    if (role) q.set('actorRole', role); if (action) q.set('action', action);
    const data = await apiRequest(`/api/admin/activity?${q}`);
    tbody.innerHTML = data.rows.length ? data.rows.map((item) => {
      const meta = item.metadata && Object.keys(item.metadata).length ? JSON.stringify(item.metadata) : '';
      return `<tr><td>${dateTime(item.createdAt)}</td><td><strong>${escapeHtml(item.actorName || 'Không xác định')}</strong><br><small>${escapeHtml(roleNames[item.actorRole] || item.actorRole)}</small></td><td><span class="status-pill status-neutral">${escapeHtml(actionNames[item.action] || item.action)}</span></td><td>${escapeHtml(item.targetType || '—')}<br><small>${escapeHtml(item.targetName || item.targetId || '')}</small></td><td>${escapeHtml(item.description || '')}${meta ? `<details class="inline-meta"><summary>Chi tiết</summary><code>${escapeHtml(meta)}</code></details>` : ''}</td></tr>`;
    }).join('') : '<tr><td colspan="5">Chưa có sự kiện phù hợp.</td></tr>';
    document.getElementById('activityPagination').textContent = `Trang ${data.page} · ${data.total} sự kiện`;
    document.getElementById('activityPrev').disabled = activityPage <= 1;
    document.getElementById('activityNext').disabled = activityPage * data.limit >= data.total;
  } catch (error) { tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`; }
}
function contentPayload() {
  return {
    contentType: document.getElementById('contentType').value, status: document.getElementById('contentStatus').value,
    programCode: document.getElementById('contentProgram').value, grade: Number(document.getElementById('contentGrade').value),
    subjectCode: document.getElementById('contentSubject').value, lessonId: document.getElementById('contentLesson').value,
    courseId: document.getElementById('contentCourseId').value.trim(), title: document.getElementById('contentTitle').value.trim(),
    assessmentType: document.getElementById('contentAssessmentType').value, objective: document.getElementById('contentObjective').value.trim(),
    videoTitle: document.getElementById('contentVideoTitle').value.trim(), videoUrl: document.getElementById('contentVideoUrl').value.trim(),
    theory: document.getElementById('contentTheory').value.trim(), lecture: document.getElementById('contentLecture').value.trim(),
    practice: document.getElementById('contentPractice').value.trim(), body: document.getElementById('contentBody').value.trim()
  };
}
function resetContentForm() {
  document.getElementById('contentId').value = '';
  document.getElementById('contentForm').reset();
  document.getElementById('contentStatus').value = 'draft';
  document.getElementById('contentFormTitle').textContent = 'Tạo nội dung học tập';
  populateLocation('content');
}
async function loadContent() {
  const list = document.getElementById('contentList'); list.innerHTML = '<p class="empty-message">Đang tải nội dung…</p>';
  try {
    const q = new URLSearchParams({ page: '1', limit: '50' });
    const type = document.getElementById('contentFilterType').value; const status = document.getElementById('contentFilterStatus').value; const search = document.getElementById('contentSearch').value.trim();
    if (type) q.set('contentType', type); if (status) q.set('status', status); if (search) q.set('q', search);
    const data = await apiRequest(`/api/admin/content?${q}`); contentCache = data.rows;
    list.innerHTML = data.rows.length ? data.rows.map((item) => `<article class="content-row"><div class="content-row-main"><div class="content-row-kicker">${escapeHtml(contentNames[item.contentType] || item.contentType)} · LỚP ${item.grade} · ${escapeHtml(programNames[item.programCode] || item.programCode)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subjectCode)}${item.lessonId ? ` · ${escapeHtml(item.lessonId)}` : ''}</p><span class="status-pill ${item.status === 'published' ? 'status-on' : item.status === 'archived' ? 'status-off' : 'status-neutral'}">${item.status === 'published' ? 'Đã công bố' : item.status === 'archived' ? 'Lưu trữ' : 'Bản nháp'}</span><small>Cập nhật ${dateTime(item.updatedAt)}</small></div><div class="row-actions"><button class="button button-quiet button-small" data-edit-content="${escapeHtml(item._id)}">Sửa</button><button class="button button-danger button-small" data-delete-content="${escapeHtml(item._id)}">Xóa</button></div></article>`).join('') : '<p class="empty-message">Chưa có nội dung. Bạn có thể tạo nội dung ở biểu mẫu bên trái hoặc nhập từ file Word.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-message">${escapeHtml(error.message)}</p>`; }
}
function editContent(id) {
  const item = contentCache.find((entry) => entry._id === id); if (!item) return;
  document.getElementById('contentId').value = item._id;
  document.getElementById('contentFormTitle').textContent = 'Chỉnh sửa nội dung';
  for (const key of ['contentType', 'contentStatus', 'contentProgram', 'contentGrade', 'contentSubject', 'contentTitle', 'contentCourseId', 'contentObjective', 'contentAssessmentType', 'contentVideoTitle', 'contentVideoUrl', 'contentTheory', 'contentLecture', 'contentPractice', 'contentBody']) {
    const values = { contentType: item.contentType, contentStatus: item.status, contentProgram: item.programCode, contentGrade: String(item.grade), contentSubject: item.subjectCode, contentTitle: item.title, contentCourseId: item.courseId, contentObjective: item.objective, contentAssessmentType: item.assessmentType || 'practice', contentVideoTitle: item.videoTitle, contentVideoUrl: item.videoUrl, contentTheory: item.theory, contentLecture: item.lecture, contentPractice: item.practice, contentBody: item.body };
    const el = document.getElementById(key); if (el) el.value = values[key] ?? '';
  }
  populateLocation('content').then(() => { document.getElementById('contentSubject').value = item.subjectCode; return populateLocation('content'); }).then(() => { document.getElementById('contentLesson').value = item.lessonId || ''; document.getElementById('contentCourseId').value = item.courseId || ''; });
  document.getElementById('contentForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function optionsToObjects(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(/^([A-H])[.)\s:-]+(.+)$/i); const value = match ? match[1].toUpperCase() : String(index + 1);
    return { value, label: match ? `${value}. ${match[2].trim()}` : line };
  }).slice(0, 8);
}
function questionPayload() {
  const acceptedAnswers = document.getElementById('questionAccepted').value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  return { grade: Number(document.getElementById('questionGrade').value), programCode: document.getElementById('questionProgram').value, subjectCode: document.getElementById('questionSubject').value, lessonId: document.getElementById('questionLesson').value, type: document.getElementById('questionType').value, prompt: document.getElementById('questionPrompt').value.trim(), options: optionsToObjects(document.getElementById('questionOptions').value), correctAnswer: document.getElementById('questionAnswer').value.trim(), acceptedAnswers, explanation: document.getElementById('questionExplanation').value.trim(), points: Number(document.getElementById('questionPoints').value) || 1, active: document.getElementById('questionActive').checked };
}
function resetQuestionForm() {
  document.getElementById('questionId').value = ''; document.getElementById('questionForm').reset();
  document.getElementById('questionPoints').value = '1'; document.getElementById('questionFormTitle').textContent = 'Thêm câu hỏi';
  populateLocation('question');
}
async function loadQuestions() {
  const list = document.getElementById('questionList'); list.innerHTML = '<p class="empty-message">Đang tải ngân hàng câu hỏi…</p>';
  try {
    const q = new URLSearchParams({ page: '1', limit: '60' });
    const grade = document.getElementById('questionFilterGrade').value; const program = document.getElementById('questionFilterProgram').value; const active = document.getElementById('questionFilterActive').value;
    if (grade) q.set('grade', grade); if (program) q.set('programCode', program); if (active) q.set('active', active);
    const data = await apiRequest(`/api/admin/question-bank?${q}`); questionCache = data.rows;
    list.innerHTML = data.rows.length ? data.rows.map((item) => `<article class="content-row"><div class="content-row-main"><div class="content-row-kicker">LỚP ${item.grade} · ${escapeHtml(programNames[item.programCode] || item.programCode)} · ${escapeHtml(item.subjectCode)} · ${escapeHtml(typeNames[item.type] || item.type)}</div><h3>${escapeHtml(item.prompt)}</h3><p>${escapeHtml(item.lessonId)} · ${item.active ? 'Đang hoạt động' : 'Đang tắt / chờ rà soát'}</p><small>${escapeHtml(item.questionId)}</small></div><div class="row-actions"><button class="button button-quiet button-small" data-edit-question="${escapeHtml(item.questionId)}">Sửa</button><button class="button button-danger button-small" data-disable-question="${escapeHtml(item.questionId)}">${item.active ? 'Tắt' : 'Xóa/tắt'}</button></div></article>`).join('') : '<p class="empty-message">Không có câu hỏi phù hợp bộ lọc. Ngân hàng dữ liệu chưa nạp hoặc chưa có câu hỏi đã nhập.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-message">${escapeHtml(error.message)}</p>`; }
}
function editQuestion(id) {
  const item = questionCache.find((question) => question.questionId === id); if (!item) return;
  document.getElementById('questionId').value = item.questionId;
  document.getElementById('questionFormTitle').textContent = 'Chỉnh sửa câu hỏi';
  document.getElementById('questionGrade').value = String(item.grade); document.getElementById('questionProgram').value = item.programCode;
  populateLocation('question').then(() => {
    document.getElementById('questionSubject').value = item.subjectCode;
    return populateLocation('question');
  }).then(() => { document.getElementById('questionLesson').value = item.lessonId; });
  document.getElementById('questionType').value = item.type; document.getElementById('questionPrompt').value = item.prompt;
  document.getElementById('questionOptions').value = (item.options || []).map((option, index) => `${String(option.value || String.fromCharCode(65 + index))}. ${option.label || option.value || ''}`).join('\n');
  document.getElementById('questionAnswer').value = item.correctAnswer || ''; document.getElementById('questionAccepted').value = (item.acceptedAnswers || []).join('\n');
  document.getElementById('questionExplanation').value = item.explanation || ''; document.getElementById('questionPoints').value = item.points || 1; document.getElementById('questionActive').checked = Boolean(item.active);
  document.getElementById('questionForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function previewWord() {
  const file = document.getElementById('wordFile').files?.[0]; if (!file) throw new Error('Chọn file .docx trước.');
  if (!file.name.toLowerCase().endsWith('.docx')) throw new Error('Chỉ nhận file .docx. Hãy đổi file .doc sang .docx.');
  const form = new FormData(); form.append('file', file);
  const button = document.getElementById('previewWordButton'); button.disabled = true; button.textContent = 'Đang trích xuất…';
  try {
    wordImportState = await apiRequest('/api/admin/content-import/preview', { method: 'POST', body: form });
    const detected = wordImportState.detection;
    document.getElementById('wordPreview').hidden = false;
    document.getElementById('wordDetectionTitle').textContent = `${contentNames[detected.contentType] || detected.contentType}${detected.assessmentType ? ` · ${detected.assessmentType}` : ''}`;
    document.getElementById('wordDetectionReason').textContent = `${detected.reason} Đây là gợi ý tự động, hãy tự chọn lại nếu cần.`;
    document.getElementById('wordDetectionConfidence').textContent = `Độ tin cậy: ${detected.confidence}`;
    document.getElementById('wordCharCount').textContent = wordImportState.extractedText.length.toLocaleString('vi-VN');
    document.getElementById('wordQuestionCount').textContent = wordImportState.detectedQuestionCount;
    document.getElementById('wordExtractedText').textContent = wordImportState.extractedText;
    document.getElementById('wordExtractedQuestions').innerHTML = wordImportState.questions.length ? wordImportState.questions.slice(0, 100).map((item) => `<article class="import-question"><strong>Câu ${item.order} · ${escapeHtml(typeNames[item.type] || item.type)}</strong><p>${escapeHtml(item.prompt)}</p>${item.options.length ? `<small>${item.options.map((option) => escapeHtml(option.label)).join(' · ')}</small>` : ''}${item.correctAnswer ? `<small>Đáp án nhận diện: ${escapeHtml(item.correctAnswer)}</small>` : '<small>Chưa nhận diện được đáp án — cần nhập/kiểm tra.</small>'}</article>`).join('') : '<p>Không tự tách được cấu trúc câu hỏi. Vẫn có thể lưu toàn văn và biên tập thủ công.</p>';
    document.getElementById('wordTitle').value = wordImportState.fileName.replace(/\.docx$/i, '');
    document.getElementById('wordContentType').value = ['course', 'lesson', 'assessment'].includes(detected.contentType) ? detected.contentType : 'lesson';
    document.getElementById('wordAssessmentType').value = detected.assessmentType || 'practice';
    await populateLocation('word');
    showToast('Đã trích xuất Word. Hãy chọn đúng lớp, môn, bài trước khi lưu.');
  } catch (error) { throw error; }
  finally { button.disabled = false; button.textContent = 'Trích xuất và nhận diện'; }
}
async function commitWord() {
  if (!wordImportState) throw new Error('Hãy trích xuất file Word trước khi lưu.');
  const body = {
    fileName: wordImportState.fileName, extractedText: wordImportState.extractedText,
    contentType: document.getElementById('wordContentType').value, programCode: document.getElementById('wordProgram').value,
    grade: Number(document.getElementById('wordGrade').value), subjectCode: document.getElementById('wordSubject').value,
    lessonId: document.getElementById('wordLesson').value, title: document.getElementById('wordTitle').value.trim(),
    objective: document.getElementById('wordObjective').value.trim(), assessmentType: document.getElementById('wordAssessmentType').value,
    importQuestionsToBank: document.getElementById('importQuestionsToBank').checked,
    publishNow: document.getElementById('wordPublishNow').checked
  };
  if (!body.title) throw new Error('Nhập tiêu đề để lưu nội dung.');
  if (body.contentType !== 'course' && !body.lessonId) throw new Error('Hãy chọn bài học đích trước khi lưu bài học/đề.');
  const result = await apiRequest('/api/admin/content-import/commit', { method: 'POST', body: JSON.stringify(body) });
  showToast(`${result.message} Đã tách ${result.extractedQuestionCount} câu; nhập ngân hàng: ${result.importedBankCount}.`);
  wordImportState = null; document.getElementById('wordUploadForm').reset(); document.getElementById('wordPreview').hidden = true;
  loadOverview(); loadContent(); loadQuestions();
}

async function auditEmail() {
  const input = document.getElementById('emailDiagnosticInput');
  const output = document.getElementById('emailDiagnosticResult');
  const button = document.getElementById('auditEmailButton');
  const email = input.value.trim();
  if (!email) return showToast('Nhập email cần kiểm tra trước.', 'error');
  button.disabled = true; output.hidden = false; output.textContent = 'Đang kiểm tra dữ liệu MongoDB…';
  try {
    const data = await apiRequest(`/api/admin/email-diagnostics?email=${encodeURIComponent(email)}`);
    output.innerHTML = `<strong>${data.normalizedMatchCount ? `Tìm thấy ${data.normalizedMatchCount} tài khoản khớp` : 'Không thấy tài khoản khớp trong collection users'}</strong><p>Database: ${escapeHtml(data.database || 'không xác định')} · Kết nối: ${data.databaseConnected ? 'đang kết nối' : 'mất kết nối'} · Email trùng chính xác: ${data.exactStoredMatchCount} · Unique index email: ${data.emailUniqueIndexes.length ? data.emailUniqueIndexes.map((item) => escapeHtml(item.name)).join(', ') : 'không tìm thấy'}</p>${data.normalizedMatches.length ? `<div class="email-diagnostic-matches">${data.normalizedMatches.map((item) => `<div><strong>${escapeHtml(item.fullName)}</strong><span>${escapeHtml(item.email)}</span><small>${escapeHtml(item.role)} · ${escapeHtml(item.status)} · ID ${escapeHtml(item.id)}</small></div>`).join('')}</div>` : ''}<p>${escapeHtml(data.guidance)}</p>`;
  } catch (error) { output.textContent = error.message || 'Không thể tra cứu email.'; }
  finally { button.disabled = false; }
}
async function loadCareerQuestionCourses() {
  const data = await apiRequest('/api/career/software-development');
  careerCourseCache = data.courses || [];
  const rows = careerCourseCache.map((item) => ({ value: item.id, label: `${item.code} · ${item.title}` }));
  setSelectOptions(document.getElementById('careerQuestionCourse'), rows, null);
  setSelectOptions(document.getElementById('careerQuestionFilterCourse'), rows, 'Tất cả khóa học');
  await Promise.all([populateCareerLessons(document.getElementById('careerQuestionCourse').value), populateCareerFilterLessons(document.getElementById('careerQuestionFilterCourse').value)]);
}
async function populateCareerFilterLessons(courseId) {
  const select = document.getElementById('careerQuestionFilterLesson');
  if (!select) return;
  if (!courseId) { setSelectOptions(select, [], 'Chọn khóa học trước'); select.disabled = true; return; }
  select.disabled = false;
  try {
    const data = await apiRequest(`/api/career/software-development/courses/${encodeURIComponent(courseId)}`);
    const lessons = (data.course.modules || []).flatMap((module) => module.lessons.map((lesson) => ({ value: lesson.id, label: `${module.title} · ${lesson.title}` })));
    setSelectOptions(select, lessons, 'Tất cả bài học trong khóa');
  } catch (error) { setSelectOptions(select, [], 'Không tải được bài học'); showToast(error.message || 'Không tải được danh sách bài học.', 'error'); }
}
async function populateCareerLessons(courseId, preferredLesson = '') {
  const select = document.getElementById('careerQuestionLesson');
  if (!courseId || !select) { setSelectOptions(select, [], null); return; }
  const data = await apiRequest(`/api/career/software-development/courses/${encodeURIComponent(courseId)}`);
  const lessons = (data.course.modules || []).flatMap((module) => module.lessons.map((lesson) => ({ value: lesson.id, label: `${module.title} · ${lesson.title}` })));
  setSelectOptions(select, lessons, null);
  if (preferredLesson && lessons.some((item) => item.value === preferredLesson)) select.value = preferredLesson;
}
function careerQuestionPayload() {
  const lines = (id) => document.getElementById(id).value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const options = lines('careerQuestionOptions').map((value) => ({ value, label: value }));
  return {
    courseId: document.getElementById('careerQuestionCourse').value,
    lessonId: document.getElementById('careerQuestionLesson').value,
    type: document.getElementById('careerQuestionType').value,
    prompt: document.getElementById('careerQuestionPrompt').value.trim(),
    options,
    correctAnswer: document.getElementById('careerQuestionAnswer').value.trim(),
    acceptedAnswers: lines('careerQuestionAccepted'),
    explanation: document.getElementById('careerQuestionExplanation').value.trim(),
    rubric: lines('careerQuestionRubric'),
    points: Number(document.getElementById('careerQuestionPoints').value) || 1,
    difficulty: document.getElementById('careerQuestionDifficulty').value,
    taxonomy: document.getElementById('careerQuestionTaxonomy').value
  };
}
function resetCareerQuestionForm() {
  document.getElementById('careerQuestionId').value = '';
  document.getElementById('careerQuestionForm').reset();
  document.getElementById('careerQuestionPoints').value = '1';
  document.getElementById('careerQuestionFormTitle').textContent = 'Tạo câu hỏi CNTT';
  document.getElementById('saveCareerQuestion').textContent = 'Lưu câu hỏi bản nháp';
  document.getElementById('careerQuestionDifficulty').value = 'medium';
  populateCareerLessons(document.getElementById('careerQuestionCourse').value);
}
async function loadCareerQuestions() {
  const list = document.getElementById('careerQuestionList');
  list.innerHTML = '<p class="empty-message">Đang tải ngân hàng câu hỏi CNTT…</p>';
  try {
    const q = new URLSearchParams({ page: '1', limit: '60' });
    const courseId = document.getElementById('careerQuestionFilterCourse').value;
    const lessonId = document.getElementById('careerQuestionFilterLesson').value;
    const active = document.getElementById('careerQuestionFilterActive').value;
    const text = document.getElementById('careerQuestionSearch').value.trim();
    if (courseId) q.set('courseId', courseId);
    if (lessonId) q.set('lessonId', lessonId);
    if (active) q.set('active', active);
    if (text) q.set('q', text);
    const data = await apiRequest(`/api/admin/career-question-bank?${q}`);
    careerQuestionCache = data.rows || [];
    list.innerHTML = careerQuestionCache.length ? careerQuestionCache.map((item) => `<article class="content-row"><div class="content-row-main"><div class="content-row-kicker">${escapeHtml(item.courseTitle)} · ${escapeHtml(item.lessonTitle)} · ${escapeHtml(typeNames[item.type] || item.type)} · ${escapeHtml(item.difficulty || 'medium')}</div><h3>${escapeHtml(item.prompt)}</h3><p>${item.active ? 'ĐÃ DUYỆT / ĐANG DÙNG' : 'BẢN NHÁP / ĐANG TẮT'} · ${Number(item.points || 1)} điểm · ${escapeHtml(item.taxonomy || 'understand')}</p><small>ID ${escapeHtml(item.questionId)} · Đáp án: ${escapeHtml(item.correctAnswer || 'cần chấm thủ công')} ${item.acceptedAnswers?.length ? `· Chấp nhận: ${escapeHtml(item.acceptedAnswers.join(' / '))}` : ''}</small><details class="inline-meta"><summary>Giải thích / rubric</summary><p>${escapeHtml(item.explanation || 'Chưa có giải thích')}</p><small>${escapeHtml((item.rubric || []).join(' · '))}</small></details></div><div class="row-actions"><button class="button button-quiet button-small" data-edit-career-question="${escapeHtml(item.questionId)}">Sửa</button><button class="button button-small ${item.active ? 'button-quiet' : 'button-primary'}" data-toggle-career-question="${escapeHtml(item.questionId)}" data-active="${item.active ? 'true' : 'false'}">${item.active ? 'Tắt' : 'Duyệt + bật'}</button><button class="button button-danger button-small" data-delete-career-question="${escapeHtml(item.questionId)}">Lưu trữ</button></div></article>`).join('') : '<p class="empty-message">Không tìm thấy câu hỏi. Chạy npm run seed:career-question-bank để nạp kho mẫu, sau đó rà soát và bật từng câu phù hợp.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-message">${escapeHtml(error.message)}</p>`; }
}
async function editCareerQuestion(id) {
  const item = careerQuestionCache.find((question) => question.questionId === id);
  if (!item) return;
  document.getElementById('careerQuestionId').value = item.questionId;
  document.getElementById('careerQuestionFormTitle').textContent = 'Sửa câu hỏi CNTT';
  document.getElementById('saveCareerQuestion').textContent = 'Lưu và chuyển về chờ duyệt';
  document.getElementById('careerQuestionCourse').value = item.courseId;
  await populateCareerLessons(item.courseId, item.lessonId);
  document.getElementById('careerQuestionType').value = item.type;
  document.getElementById('careerQuestionPrompt').value = item.prompt || '';
  document.getElementById('careerQuestionOptions').value = (item.options || []).map((option) => option.value).join('\n');
  document.getElementById('careerQuestionAnswer').value = item.correctAnswer || '';
  document.getElementById('careerQuestionAccepted').value = (item.acceptedAnswers || []).join('\n');
  document.getElementById('careerQuestionExplanation').value = item.explanation || '';
  document.getElementById('careerQuestionRubric').value = (item.rubric || []).join('\n');
  document.getElementById('careerQuestionPoints').value = item.points || 1;
  document.getElementById('careerQuestionDifficulty').value = item.difficulty || 'medium';
  document.getElementById('careerQuestionTaxonomy').value = item.taxonomy || 'understand';
  document.getElementById('careerQuestionForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function saveCareerQuestion(event) {
  event.preventDefault();
  const button = document.getElementById('saveCareerQuestion');
  const id = document.getElementById('careerQuestionId').value;
  button.disabled = true;
  try {
    const payload = careerQuestionPayload();
    if (payload.type === 'multiple_choice' && (payload.options.length < 2 || !payload.options.some((item) => item.value === payload.correctAnswer))) throw new Error('Câu trắc nghiệm cần tối thiểu hai lựa chọn và đáp án phải khớp nguyên văn một lựa chọn.');
    if (payload.type === 'true_false' && !['true', 'false'].includes(payload.correctAnswer)) throw new Error('Câu đúng/sai cần đáp án true hoặc false.');
    const result = await apiRequest(id ? `/api/admin/career-question-bank/${encodeURIComponent(id)}` : '/api/admin/career-question-bank', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    showToast(result.message);
    resetCareerQuestionForm();
    await Promise.all([loadCareerQuestions(), loadActivity(), loadOverview()]);
  } catch (error) { showToast(error.message || 'Không lưu được câu hỏi.', 'error'); }
  finally { button.disabled = false; }
}
async function handleCareerQuestionActions(event) {
  const edit = event.target.closest('[data-edit-career-question]');
  const toggle = event.target.closest('[data-toggle-career-question]');
  const remove = event.target.closest('[data-delete-career-question]');
  if (edit) return editCareerQuestion(edit.dataset.editCareerQuestion);
  if (toggle) {
    const active = toggle.dataset.active !== 'true';
    if (active && !window.confirm('Bạn đã kiểm tra nội dung, phạm vi bài học và đáp án của câu hỏi này?')) return;
    toggle.disabled = true;
    try { const result = await apiRequest(`/api/admin/career-question-bank/${encodeURIComponent(toggle.dataset.toggleCareerQuestion)}/status`, { method: 'PATCH', body: JSON.stringify({ active }) }); showToast(result.message); await Promise.all([loadCareerQuestions(), loadActivity(), loadOverview()]); }
    catch (error) { showToast(error.message, 'error'); toggle.disabled = false; }
    return;
  }
  if (remove) {
    if (!window.confirm('Lưu trữ câu hỏi khỏi các đề mới? Đề đã tạo và lịch sử vẫn được giữ.')) return;
    remove.disabled = true;
    try { const result = await apiRequest(`/api/admin/career-question-bank/${encodeURIComponent(remove.dataset.deleteCareerQuestion)}`, { method: 'DELETE', body: JSON.stringify({}) }); showToast(result.message); await Promise.all([loadCareerQuestions(), loadActivity(), loadOverview()]); }
    catch (error) { showToast(error.message, 'error'); remove.disabled = false; }
  }
}


async function bulkSetCareerQuestionStatus(active) {
  const courseId = document.getElementById('careerQuestionFilterCourse').value;
  const lessonId = document.getElementById('careerQuestionFilterLesson').value;
  if (!courseId || !lessonId) return showToast('Hãy chọn chính xác một khóa học và một bài học trước.', 'error');
  const course = careerCourseCache.find((item) => item.id === courseId);
  const lessonSelect = document.getElementById('careerQuestionFilterLesson');
  const lessonTitle = lessonSelect.selectedOptions[0]?.textContent || lessonId;
  const prompt = active
    ? `Bạn đã đọc và kiểm tra TOÀN BỘ câu hỏi, đáp án/rubric và mức độ bám sát bài “${lessonTitle}” trong khóa “${course?.title || courseId}” chưa? Chỉ xác nhận nếu đã rà nội dung từng câu. Sau đó mới bật cho đề kiểm tra.`
    : `Tắt toàn bộ câu hỏi thuộc bài “${lessonTitle}” khỏi các đề mới? Lịch sử và đề đã tạo được giữ.`;
  if (!window.confirm(prompt)) return;
  const button = document.getElementById('bulkReviewCareerQuestions');
  button.disabled = true;
  try {
    const result = await apiRequest('/api/admin/career-question-bank/bulk-status', { method: 'PATCH', body: JSON.stringify({ courseId, lessonId, active }) });
    showToast(`${result.message} (${result.modifiedCount}/${result.matchedCount})`);
    await Promise.all([loadCareerQuestions(), loadActivity(), loadOverview()]);
  } catch (error) { showToast(error.message || `Không thể ${active ? 'bật' : 'tắt'} ngân hàng.`, 'error'); }
  finally { button.disabled = false; }
}

async function init() {
  try {
    const user = await currentUser();
    if (!user) return window.location.replace('/admin-login.html');
    if (user.role !== 'admin') return window.location.replace('/dashboard.html');
    initGradeSelects();
    document.querySelectorAll('.admin-tab').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.tab)));
    document.getElementById('logoutButton').addEventListener('click', async () => { try { await logout(); } catch (error) { showToast(error.message, 'error'); } });
    await Promise.all([populateLocation('content'), populateLocation('question'), populateLocation('word'), loadCareerQuestionCourses(), loadOverview()]);
    await Promise.all([loadUsers(), loadActivity(), loadContent(), loadQuestions()]);
  } catch (error) { showAlert(alertBox, error.message || 'Không tải được dữ liệu quản trị.'); }
}

document.getElementById('auditEmailButton').addEventListener('click', auditEmail);
document.getElementById('emailDiagnosticInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); auditEmail(); } });
document.getElementById('careerQuestionCourse').addEventListener('change', () => populateCareerLessons(document.getElementById('careerQuestionCourse').value));
document.getElementById('careerQuestionFilterCourse').addEventListener('change', async () => { await populateCareerFilterLessons(document.getElementById('careerQuestionFilterCourse').value); await loadCareerQuestions(); });
document.getElementById('careerQuestionFilterLesson').addEventListener('change', loadCareerQuestions);
document.getElementById('careerQuestionFilterActive').addEventListener('change', loadCareerQuestions);
document.getElementById('bulkReviewCareerQuestions').addEventListener('click', () => bulkSetCareerQuestionStatus(true));
document.getElementById('bulkDisableCareerQuestions').addEventListener('click', () => bulkSetCareerQuestionStatus(false));
document.getElementById('refreshCareerQuestions').addEventListener('click', loadCareerQuestions);
document.getElementById('searchCareerQuestions').addEventListener('click', loadCareerQuestions);
document.getElementById('newCareerQuestion').addEventListener('click', resetCareerQuestionForm);
document.getElementById('careerQuestionForm').addEventListener('submit', saveCareerQuestion);
document.getElementById('careerQuestionList').addEventListener('click', handleCareerQuestionActions);
document.getElementById('refreshUsers').addEventListener('click', () => loadUsers());
document.getElementById('searchUsers').addEventListener('click', () => { usersPage = 1; loadUsers(); });
document.getElementById('userSearch').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); usersPage = 1; loadUsers(); } });
document.getElementById('usersPrev').addEventListener('click', () => { usersPage = Math.max(1, usersPage - 1); loadUsers(); });
document.getElementById('usersNext').addEventListener('click', () => { usersPage += 1; loadUsers(); });
document.getElementById('usersTable').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-user-action]'); if (!button) return;
  const id = button.dataset.userId; const action = button.dataset.userAction;
  if (action === 'delete' && !window.confirm('Xóa tài khoản này và phản hồi khảo sát liên quan? Thao tác không thể hoàn tác.')) return;
  if (action !== 'delete' && !window.confirm(action === 'suspend' ? 'Khóa tài khoản này? Các yêu cầu API tiếp theo sẽ bị từ chối.' : 'Mở khóa tài khoản này?')) return;
  button.disabled = true;
  try {
    let actionResult;
    if (action === 'delete') actionResult = await apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({}) });
    else actionResult = await apiRequest(`/api/admin/users/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: action === 'suspend' ? 'suspended' : 'active' }) });
    if (action === 'delete') {
      const counts = actionResult.purgeCounts || {};
      const dependentTotal = Object.entries(counts).filter(([key]) => key !== 'users').reduce((sum, [, value]) => sum + Number(value || 0), 0);
      showToast(`${actionResult.deletedFromDatabase && actionResult.verification?.verified ? `Đã xóa và xác minh trong MongoDB ${actionResult.database || ''}` : 'Chưa xác minh xóa hoàn toàn'}; đã dọn ${dependentTotal} bản ghi liên quan. Nhật ký kiểm toán được giữ.`);
    } else showToast(action === 'suspend' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
    await Promise.all([loadUsers(), loadOverview(), loadActivity()]);
  } catch (error) { showToast(error.message, 'error'); button.disabled = false; }
});
document.getElementById('refreshActivity').addEventListener('click', loadActivity);
document.getElementById('filterActivity').addEventListener('click', () => { activityPage = 1; loadActivity(); });
document.getElementById('activityPrev').addEventListener('click', () => { activityPage = Math.max(1, activityPage - 1); loadActivity(); });
document.getElementById('activityNext').addEventListener('click', () => { activityPage += 1; loadActivity(); });
document.getElementById('refreshContent').addEventListener('click', loadContent);
document.getElementById('searchContent').addEventListener('click', loadContent);
document.getElementById('newContent').addEventListener('click', resetContentForm);
for (const id of ['contentGrade', 'contentProgram']) document.getElementById(id).addEventListener('change', () => populateLocation('content'));
document.getElementById('contentSubject').addEventListener('change', () => populateLocation('content'));
document.getElementById('contentForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const id = document.getElementById('contentId').value; const button = document.getElementById('saveContent'); button.disabled = true;
  try {
    const payload = contentPayload();
    if (!payload.courseId) payload.courseId = `${payload.programCode}-g${payload.grade}-${payload.subjectCode}`;
    const result = await apiRequest(id ? `/api/admin/content/${encodeURIComponent(id)}` : '/api/admin/content', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    showToast(result.message); resetContentForm(); await Promise.all([loadContent(), loadOverview(), loadActivity()]);
  } catch (error) { showToast(error.message, 'error'); } finally { button.disabled = false; }
});
document.getElementById('contentList').addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-content]'); const del = event.target.closest('[data-delete-content]');
  if (edit) { editContent(edit.dataset.editContent); return; }
  if (del) {
    if (!window.confirm('Xóa bản ghi nội dung này?')) return;
    del.disabled = true;
    try { const result = await apiRequest(`/api/admin/content/${encodeURIComponent(del.dataset.deleteContent)}`, { method: 'DELETE', body: JSON.stringify({}) }); showToast(result.message); await Promise.all([loadContent(), loadOverview(), loadActivity()]); }
    catch (error) { showToast(error.message, 'error'); del.disabled = false; }
  }
});
document.getElementById('refreshQuestions').addEventListener('click', loadQuestions);
document.getElementById('searchQuestions').addEventListener('click', loadQuestions);
document.getElementById('newQuestion').addEventListener('click', resetQuestionForm);
for (const id of ['questionGrade', 'questionProgram']) document.getElementById(id).addEventListener('change', () => populateLocation('question'));
document.getElementById('questionSubject').addEventListener('change', () => populateLocation('question'));
document.getElementById('questionForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const id = document.getElementById('questionId').value; const button = document.getElementById('saveQuestion'); button.disabled = true;
  try {
    const payload = questionPayload();
    if (payload.type === 'multiple_choice' && (!payload.options.length || !payload.correctAnswer)) throw new Error('Câu trắc nghiệm cần các lựa chọn và đáp án đúng.');
    const result = await apiRequest(id ? `/api/admin/question-bank/${encodeURIComponent(id)}` : '/api/admin/question-bank', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    showToast(result.message); resetQuestionForm(); await Promise.all([loadQuestions(), loadOverview(), loadActivity()]);
  } catch (error) { showToast(error.message, 'error'); } finally { button.disabled = false; }
});
document.getElementById('questionList').addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-question]'); const disable = event.target.closest('[data-disable-question]');
  if (edit) { editQuestion(edit.dataset.editQuestion); return; }
  if (disable) {
    if (!window.confirm('Tắt câu hỏi này khỏi các đề mới? Đề cũ và lịch sử vẫn được giữ.')) return;
    disable.disabled = true;
    try { const result = await apiRequest(`/api/admin/question-bank/${encodeURIComponent(disable.dataset.disableQuestion)}`, { method: 'DELETE', body: JSON.stringify({}) }); showToast(result.message); await Promise.all([loadQuestions(), loadOverview(), loadActivity()]); }
    catch (error) { showToast(error.message, 'error'); disable.disabled = false; }
  }
});
for (const id of ['wordGrade', 'wordProgram']) document.getElementById(id).addEventListener('change', () => populateLocation('word'));
document.getElementById('wordSubject').addEventListener('change', () => populateLocation('word'));
document.getElementById('wordUploadForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await previewWord(); } catch (error) { showToast(error.message, 'error'); } });
document.getElementById('saveWordImport').addEventListener('click', async () => {
  const button = document.getElementById('saveWordImport'); button.disabled = true;
  try { await commitWord(); } catch (error) { showToast(error.message, 'error'); } finally { button.disabled = false; }
});

init();
