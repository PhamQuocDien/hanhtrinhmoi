import { apiRequest, currentUser, logout, showAlert, showToast, escapeHtml } from './api.js';

const alertBox = document.getElementById('teacherAlert');
let teacher = null;
let classrooms = [];
let assignments = [];
let careerCourses = [];
let selectedClassId = '';

function roleRedirect(user) {
  if (!user) { window.location.replace('/login.html'); return true; }
  if (user.role !== 'teacher') { window.location.replace(user.role === 'admin' ? '/admin.html' : '/dashboard.html'); return true; }
  return false;
}
function localInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}
function formatDate(value) {
  if (!value) return 'Chưa đặt';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
function statusText(status) { return ({ active: 'Đang hoạt động', archived: 'Đã lưu trữ', draft: 'Bản nháp', published: 'Đã giao', closed: 'Đã đóng', submitted: 'Chờ chấm', graded: 'Đã chấm' })[status] || status; }
function pill(status) { return `<span class="teacher-status-pill ${escapeHtml(status)}">${escapeHtml(statusText(status))}</span>`; }
function toastError(error) { showToast(error?.message || 'Có lỗi xảy ra. Hãy thử lại.', 'error'); }

async function loadOverview() {
  const data = await apiRequest('/api/teacher/overview');
  document.getElementById('statClasses').textContent = data.classes;
  document.getElementById('statStudents').textContent = data.students;
  document.getElementById('statAssignments').textContent = data.assignments;
  document.getElementById('statPending').textContent = data.pendingSubmissions;
  document.getElementById('statGradedNote').textContent = `${data.gradedSubmissions} bài đã chấm`;
  document.getElementById('pendingFocus').textContent = `${data.pendingSubmissions} bài cần chấm`;
  document.getElementById('pendingDescription').textContent = data.pendingSubmissions ? 'Các bài nộp đang chờ phản hồi sẽ được ưu tiên hiển thị.' : 'Chưa có bài nộp nào đang chờ chấm.';
  const recent = document.getElementById('recentSubmissionList');
  recent.innerHTML = data.recentSubmissions.length ? data.recentSubmissions.map((row) => `<article class="recent-submission-card"><span class="recent-symbol">${row.status === 'graded' ? '✓' : '✎'}</span><div><strong>${escapeHtml(row.studentName)}</strong><p>${escapeHtml(row.assignmentTitle)}</p><small>${escapeHtml(formatDate(row.submittedAt))} · ${row.status === 'graded' ? `Điểm ${escapeHtml(row.score ?? '—')}` : 'Đang chờ chấm'}</small></div></article>`).join('') : '<div class="teacher-empty">Chưa có bài nộp gần đây. Khi học viên nộp bài, hoạt động sẽ hiện tại đây.</div>';
}
async function loadCareerCourses() {
  const data = await apiRequest('/api/career/software-development');
  careerCourses = data.courses || [];
  const select = document.getElementById('assignmentCourse');
  select.innerHTML = '<option value="">Không gắn khóa học</option>' + careerCourses.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.code)} · ${escapeHtml(item.title)}</option>`).join('');
  const classCourses = document.getElementById('classCourseIds');
  classCourses.innerHTML = careerCourses.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.code)} · ${escapeHtml(item.title)}</option>`).join('');
}
function renderClasses() {
  document.getElementById('classCountLabel').textContent = `${classrooms.length} LỚP`;
  const active = classrooms.filter((row) => row.status === 'active');
  const select = document.getElementById('assignmentClassroom');
  const chosen = select.value;
  select.innerHTML = active.length ? '<option value="">Chọn lớp nhận bài</option>' + active.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join('') : '<option value="">Tạo lớp trước</option>';
  if (active.some((row) => row.id === chosen)) select.value = chosen;
  const list = document.getElementById('teacherClassList');
  list.innerHTML = classrooms.length ? classrooms.map((row) => `<article class="teacher-list-card ${row.status === 'archived' ? 'is-archived' : ''}"><div class="teacher-list-card-main"><span class="teacher-list-icon">▦</span><div class="teacher-list-copy"><strong>${escapeHtml(row.name)}</strong><p>${escapeHtml(row.description || 'Chưa có mô tả lớp học.')}</p><small>${(row.students || []).length} học viên · Mã ${escapeHtml(row.inviteCode)} · ${escapeHtml(row.subjectArea)}</small></div></div><div class="teacher-list-actions"><button type="button" class="button button-quiet" data-class-action="view" data-class-id="${escapeHtml(row.id)}">Xem lớp</button><button type="button" class="button button-quiet" data-class-action="edit" data-class-id="${escapeHtml(row.id)}">Sửa</button>${row.status === 'active' ? '<button type="button" class="button button-quiet" data-class-action="archive" data-class-id="'+escapeHtml(row.id)+'">Lưu trữ</button>' : pill(row.status)}</div></article>`).join('') : '<div class="teacher-empty">Bạn chưa tạo lớp nào. Tạo lớp đầu tiên ở biểu mẫu bên trái.</div>';
}
async function loadClasses() {
  const data = await apiRequest('/api/teacher/classes');
  classrooms = data.rows || [];
  renderClasses();
  if (selectedClassId && classrooms.some((row) => row.id === selectedClassId)) await openClass(selectedClassId, false);
  else if (selectedClassId) { selectedClassId = ''; document.getElementById('selectedClassPanel').hidden = true; }
}
function resetClassForm() {
  document.getElementById('classForm').reset();
  document.getElementById('classId').value = '';
  document.getElementById('classFormTitle').textContent = 'Tạo lớp / nhóm học';
  document.getElementById('saveClassButton').textContent = 'Tạo lớp học';
  document.getElementById('cancelClassEdit').hidden = true;
}
function editClass(id) {
  const row = classrooms.find((item) => item.id === id);
  if (!row) return;
  document.getElementById('classId').value = row.id;
  document.getElementById('className').value = row.name;
  document.getElementById('classDescription').value = row.description || '';
  document.getElementById('classSubjectArea').value = row.subjectArea || 'software-development';
  const selectedCourseIds = new Set(row.courseIds || []);
  Array.from(document.getElementById('classCourseIds').options).forEach((option) => { option.selected = selectedCourseIds.has(option.value); });
  document.getElementById('classFormTitle').textContent = 'Chỉnh sửa lớp học';
  document.getElementById('saveClassButton').textContent = 'Lưu thay đổi';
  document.getElementById('cancelClassEdit').hidden = false;
  document.getElementById('classForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function openClass(id, scroll = true) {
  const row = classrooms.find((item) => item.id === id);
  if (!row) return;
  selectedClassId = id;
  document.getElementById('selectedClassPanel').hidden = false;
  document.getElementById('selectedClassTitle').textContent = row.name;
  document.getElementById('selectedClassDescription').textContent = row.description || 'Chưa có mô tả lớp học.';
  document.getElementById('selectedClassCode').textContent = row.inviteCode;
  document.getElementById('classProgressBody').innerHTML = '<tr><td colspan="6">Đang tải tiến độ...</td></tr>';
  const data = await apiRequest(`/api/teacher/classes/${encodeURIComponent(id)}/progress`);
  document.getElementById('classProgressBody').innerHTML = data.students.length ? data.students.map((student) => `<tr><td><strong>${escapeHtml(student.fullName)}</strong><small>${escapeHtml(student.email)} · ${escapeHtml(student.status)}</small></td><td>${student.completedLessons}/${student.trackedLessons} bài${student.careerCourses?.length ? `<small>${student.careerCourses.map((item) => `${escapeHtml(item.title)}: ${item.completedLessons}/${item.lessonCount}`).join(' · ')}</small>` : ''}</td><td>${student.assessmentCount}</td><td>${student.averageScore === null ? '—' : `${student.averageScore}/100`}</td><td>${escapeHtml(formatDate(student.latestActivity))}</td><td><button type="button" class="button button-quiet" data-remove-student="${escapeHtml(student.id)}">Gỡ khỏi lớp</button></td></tr>`).join('') : '<tr><td colspan="6">Lớp chưa có học viên. Thêm học viên bằng email đã đăng ký.</td></tr>';
  if (scroll) document.getElementById('selectedClassPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function loadAssignments() {
  const data = await apiRequest('/api/teacher/assignments');
  assignments = data.rows || [];
  document.getElementById('assignmentCountLabel').textContent = `${assignments.length} BÀI`;
  const list = document.getElementById('teacherAssignmentList');
  list.innerHTML = assignments.length ? assignments.map((row) => `<article class="teacher-list-card"><div class="teacher-list-card-main"><span class="teacher-list-icon">✎</span><div class="teacher-list-copy"><strong>${escapeHtml(row.title)}</strong><p class="assignment-instructions">${escapeHtml(row.instructions || 'Không có hướng dẫn bổ sung.')}</p><small>${escapeHtml(row.className)} · Hạn: ${escapeHtml(formatDate(row.dueAt))} · ${row.pendingCount} bài chờ chấm</small><small>${row.courseId ? escapeHtml(careerCourses.find((item) => item.id === row.courseId)?.title || row.courseId) : 'Không gắn khóa học'} · Điểm tối đa ${row.maxScore}</small></div>${pill(row.status)}</div><div class="teacher-list-actions"><button type="button" class="button button-primary" data-assignment-action="submissions" data-assignment-id="${escapeHtml(row.id)}">Xem bài nộp (${row.pendingCount})</button><button type="button" class="button button-quiet" data-assignment-action="edit" data-assignment-id="${escapeHtml(row.id)}">Sửa</button><button type="button" class="button button-quiet" data-assignment-action="delete" data-assignment-id="${escapeHtml(row.id)}">Xóa</button></div></article>`).join('') : '<div class="teacher-empty">Chưa có bài tập nào. Chọn một lớp rồi giao bài từ biểu mẫu.</div>';
}
function resetAssignmentForm() {
  document.getElementById('assignmentForm').reset();
  document.getElementById('assignmentId').value = '';
  document.getElementById('assignmentMaxScore').value = '100';
  document.getElementById('assignmentFormTitle').textContent = 'Tạo bài tập';
  document.getElementById('saveAssignmentButton').textContent = 'Giao bài tập';
  document.getElementById('cancelAssignmentEdit').hidden = true;
}
function editAssignment(id) {
  const row = assignments.find((item) => item.id === id);
  if (!row) return;
  document.getElementById('assignmentId').value = row.id;
  document.getElementById('assignmentClassroom').value = String(row.classroom?._id || row.classroom || '');
  document.getElementById('assignmentTitle').value = row.title;
  document.getElementById('assignmentInstructions').value = row.instructions || '';
  document.getElementById('assignmentCourse').value = row.courseId || '';
  document.getElementById('assignmentLessonId').value = row.lessonId || '';
  document.getElementById('assignmentType').value = row.submissionType || 'text';
  document.getElementById('assignmentMaxScore').value = row.maxScore || 100;
  document.getElementById('assignmentDueAt').value = localInputDate(row.dueAt);
  document.getElementById('assignmentStatus').value = row.status;
  document.getElementById('assignmentFormTitle').textContent = 'Chỉnh sửa bài tập';
  document.getElementById('saveAssignmentButton').textContent = 'Lưu thay đổi';
  document.getElementById('cancelAssignmentEdit').hidden = false;
  document.getElementById('assignmentForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function showSubmissions(id) {
  const data = await apiRequest(`/api/teacher/assignments/${encodeURIComponent(id)}/submissions`);
  const panel = document.getElementById('submissionPanel');
  panel.innerHTML = `<div class="submission-head"><h3>${escapeHtml(data.assignment.title)}</h3><p>Điểm tối đa: ${data.assignment.maxScore} · ${data.rows.length} bài nộp</p></div>${data.rows.length ? `<div class="submission-grid">${data.rows.map((row) => `<article class="submission-card"><div class="submission-card-head"><h4>${escapeHtml(row.studentName)}</h4>${pill(row.status)}</div><p class="submission-student">${escapeHtml(row.studentEmail)} · ${escapeHtml(formatDate(row.submittedAt))} ${row.isLate ? '· NỘP TRỄ' : ''}</p><div class="submission-response">${row.response ? escapeHtml(row.response) : safeExternalUrl(row.attachmentUrl) ? `<a href="${escapeHtml(safeExternalUrl(row.attachmentUrl))}" target="_blank" rel="noopener noreferrer">Mở sản phẩm / đường dẫn nộp bài ↗</a>` : 'Không có nội dung hoặc đường dẫn không hợp lệ.'}</div>${row.status === 'graded' ? `<p class="submission-meta">Điểm: ${row.score}/${data.assignment.maxScore} · ${escapeHtml(row.feedback || 'Không có nhận xét.')}</p>` : '<p class="submission-meta">Chưa có điểm — nhập điểm và nhận xét ở bên dưới.</p>'}<form class="grade-form" data-grade-form="${escapeHtml(row.id)}"><label>Điểm<input name="score" type="number" min="0" max="${data.assignment.maxScore}" step="0.5" value="${row.score ?? ''}" required></label><label>Nhận xét<textarea name="feedback" rows="3" maxlength="10000" placeholder="Điểm tốt, lỗi cần sửa, bước cải thiện…">${escapeHtml(row.feedback || '')}</textarea></label><button class="button button-primary" type="submit">Lưu điểm và phản hồi</button></form></article>`).join('')}</div>` : '<div class="teacher-empty">Chưa có học viên nộp bài này.</div>'}`;
  panel.dataset.assignmentId = id;
  document.getElementById('teacherSubmissions').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function loadCareerAssessmentReviews() {
  const list = document.getElementById('careerAssessmentReviewList');
  if (!list) return;
  list.innerHTML = '<div class="teacher-empty">Đang tải bài thi chờ chấm…</div>';
  try {
    const data = await apiRequest('/api/teacher/career-assessments');
    list.innerHTML = data.rows.length ? data.rows.map((row) => `<article class="career-assessment-review-card"><div class="career-assessment-review-head"><div><span class="section-kicker">${escapeHtml(row.courseTitle)} · ${escapeHtml(row.lessonTitle)}</span><h4>${escapeHtml(row.student.fullName)} — ${escapeHtml(row.title)}</h4><p>${escapeHtml(row.student.email)} · Nộp ${escapeHtml(formatDate(row.submittedAt))} · Điểm tự động sơ bộ: ${row.autoGradedScore ?? '—'}/100</p></div><span class="teacher-status-pill submitted">${row.questions.length} câu cần chấm</span></div><form data-career-review-form="${escapeHtml(row.examId)}"><div class="career-assessment-manual-questions">${row.questions.map((question, index) => `<section class="career-assessment-manual-question"><div class="career-assessment-question-title"><strong>Câu ${index + 1} · ${escapeHtml(question.type)}</strong><span>Tối đa ${Number(question.points || 1)} điểm</span></div><p>${escapeHtml(question.prompt)}</p><div class="career-assessment-answer"><b>Bài làm của học viên</b><pre>${escapeHtml(question.answer || 'Không có câu trả lời.')}</pre></div>${question.rubric?.length ? `<div class="career-assessment-rubric"><b>Tiêu chí tham khảo</b><ul>${question.rubric.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}<div class="career-assessment-mark-fields"><label>Điểm<input type="number" min="0" max="${Number(question.points || 1)}" step="0.5" required data-career-score="${escapeHtml(question.questionId)}"></label><label>Nhận xét<textarea rows="2" maxlength="10000" data-career-feedback="${escapeHtml(question.questionId)}" placeholder="Nêu điểm đúng, phần còn thiếu và bước cải thiện"></textarea></label></div></section>`).join('')}</div><button class="button button-primary" type="submit">Lưu điểm tổng kết</button></form></article>`).join('') : '<div class="teacher-empty">Không có bài luyện tập CNTT cần chấm trong các lớp bạn quản lý.</div>';
  } catch (error) { list.innerHTML = `<div class="teacher-empty">${escapeHtml(error.message || 'Không tải được hàng đợi chấm.')}</div>`; }
}
async function submitCareerAssessmentReview(event) {
  const form = event.target.closest('[data-career-review-form]');
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  const scores = [...form.querySelectorAll('[data-career-score]')];
  const reviews = scores.map((input) => ({ questionId: input.dataset.careerScore, score: Number(input.value), feedback: form.querySelector(`[data-career-feedback="${CSS.escape(input.dataset.careerScore)}"]`)?.value || '' }));
  try {
    const result = await apiRequest(`/api/teacher/career-assessments/${encodeURIComponent(form.dataset.careerReviewForm)}/review`, { method: 'PATCH', body: JSON.stringify({ reviews }) });
    showToast(`${result.message} Điểm tổng kết: ${result.score}/100${result.passed ? ' · Đạt' : ' · Chưa đạt'}`);
    await Promise.all([loadCareerAssessmentReviews(), loadOverview()]);
  } catch (error) { toastError(error); button.disabled = false; }
}

async function init() {
  try {
    teacher = await currentUser();
    if (roleRedirect(teacher)) return;
    document.getElementById('teacherName').textContent = teacher.fullName;
    document.getElementById('teacherAvatar').textContent = (teacher.fullName.trim()[0] || 'G').toLocaleUpperCase('vi-VN');
    await loadCareerCourses();
    await Promise.all([loadOverview(), loadClasses(), loadAssignments(), loadCareerAssessmentReviews()]);
  } catch (error) { showAlert(alertBox, error.message || 'Không tải được không gian giáo viên.'); }
}

document.getElementById('classForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('classId').value;
  const button = document.getElementById('saveClassButton'); button.disabled = true;
  const body = { name: document.getElementById('className').value.trim(), description: document.getElementById('classDescription').value.trim(), subjectArea: document.getElementById('classSubjectArea').value, courseIds: Array.from(document.getElementById('classCourseIds').selectedOptions).map((option) => option.value) };
  try {
    const result = await apiRequest(id ? `/api/teacher/classes/${encodeURIComponent(id)}` : '/api/teacher/classes', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    showToast(result.message); resetClassForm(); await Promise.all([loadClasses(), loadOverview()]);
  } catch (error) { toastError(error); } finally { button.disabled = false; }
});
document.getElementById('cancelClassEdit').addEventListener('click', resetClassForm);
document.getElementById('teacherClassList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-class-action]'); if (!button) return;
  const id = button.dataset.classId; const action = button.dataset.classAction;
  try {
    if (action === 'view') return await openClass(id);
    if (action === 'edit') return editClass(id);
    if (action === 'archive') {
      if (!window.confirm('Lưu trữ lớp này? Bài tập được đóng nhưng lịch sử và điểm được giữ lại.')) return;
      await apiRequest(`/api/teacher/classes/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({}) });
      showToast('Đã lưu trữ lớp học.');
      await Promise.all([loadClasses(), loadAssignments(), loadOverview()]);
    }
  } catch (error) { toastError(error); }
});
document.getElementById('closeSelectedClass').addEventListener('click', () => { selectedClassId = ''; document.getElementById('selectedClassPanel').hidden = true; });
document.getElementById('addStudentForm').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!selectedClassId) return;
  const button = event.submitter; if (button) button.disabled = true;
  try {
    const result = await apiRequest(`/api/teacher/classes/${encodeURIComponent(selectedClassId)}/students`, { method: 'POST', body: JSON.stringify({ email: document.getElementById('studentEmail').value.trim() }) });
    showToast(result.message); document.getElementById('studentEmail').value = ''; await Promise.all([loadClasses(), loadOverview()]);
  } catch (error) { toastError(error); } finally { if (button) button.disabled = false; }
});
document.getElementById('classProgressBody').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-remove-student]'); if (!button || !selectedClassId) return;
  if (!window.confirm('Gỡ học viên khỏi lớp? Lịch sử đã lưu của học viên không bị xóa.')) return;
  try {
    const result = await apiRequest(`/api/teacher/classes/${encodeURIComponent(selectedClassId)}/students/${encodeURIComponent(button.dataset.removeStudent)}`, { method: 'DELETE', body: JSON.stringify({}) });
    showToast(result.message); await Promise.all([loadClasses(), loadOverview()]);
  } catch (error) { toastError(error); }
});
document.getElementById('assignmentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('assignmentId').value;
  const button = document.getElementById('saveAssignmentButton'); button.disabled = true;
  const dueValue = document.getElementById('assignmentDueAt').value;
  const body = { classroomId: document.getElementById('assignmentClassroom').value, title: document.getElementById('assignmentTitle').value.trim(), instructions: document.getElementById('assignmentInstructions').value.trim(), courseId: document.getElementById('assignmentCourse').value, lessonId: document.getElementById('assignmentLessonId').value.trim(), submissionType: document.getElementById('assignmentType').value, maxScore: Number(document.getElementById('assignmentMaxScore').value), dueAt: dueValue ? new Date(dueValue).toISOString() : '', status: document.getElementById('assignmentStatus').value };
  try {
    const result = await apiRequest(id ? `/api/teacher/assignments/${encodeURIComponent(id)}` : '/api/teacher/assignments', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    showToast(result.message); resetAssignmentForm(); await Promise.all([loadAssignments(), loadOverview()]);
  } catch (error) { toastError(error); } finally { button.disabled = false; }
});
document.getElementById('cancelAssignmentEdit').addEventListener('click', resetAssignmentForm);
document.getElementById('teacherAssignmentList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-assignment-action]'); if (!button) return;
  const id = button.dataset.assignmentId; const action = button.dataset.assignmentAction;
  try {
    if (action === 'submissions') return await showSubmissions(id);
    if (action === 'edit') return editAssignment(id);
    if (action === 'delete') {
      if (!window.confirm('Xóa bài tập này cùng các bài nộp và điểm liên quan?')) return;
      const result = await apiRequest(`/api/teacher/assignments/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({}) });
      showToast(result.message); if (document.getElementById('submissionPanel').dataset.assignmentId === id) document.getElementById('submissionPanel').innerHTML = '<div class="teacher-empty">Bài tập đã bị xóa.</div>';
      await Promise.all([loadAssignments(), loadOverview()]);
    }
  } catch (error) { toastError(error); }
});
document.getElementById('submissionPanel').addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-grade-form]'); if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  const formData = new FormData(form); const score = Number(formData.get('score')); const feedback = String(formData.get('feedback') || '').trim();
  try {
    const result = await apiRequest(`/api/teacher/submissions/${encodeURIComponent(form.dataset.gradeForm)}/grade`, { method: 'PATCH', body: JSON.stringify({ score, feedback }) });
    showToast(result.message); await Promise.all([showSubmissions(document.getElementById('submissionPanel').dataset.assignmentId), loadOverview(), loadAssignments()]);
  } catch (error) { toastError(error); button.disabled = false; }
});
document.getElementById('refreshTeacher').addEventListener('click', async () => { try { await Promise.all([loadOverview(), loadClasses(), loadAssignments(), loadCareerAssessmentReviews()]); showToast('Đã cập nhật dữ liệu.'); } catch (error) { toastError(error); } });
document.getElementById('teacherLogout').addEventListener('click', async () => { try { await logout(); } catch (error) { toastError(error); } });
init();
