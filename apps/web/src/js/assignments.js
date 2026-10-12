import { apiRequest, currentUser, logout, showAlert, showToast, escapeHtml } from './api.js';
const alertBox = document.getElementById('assignmentsAlert');
let loadedRows = [];
function fmt(value) { if (!value) return 'Không đặt hạn'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Không rõ' : date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }); }
function safeLink(value) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function renderRow(row) {
  const submission = row.submission;
  const status = submission?.status === 'graded' ? 'Đã chấm' : submission ? 'Đã nộp' : 'Chưa nộp';
  const statusClass = submission?.status || 'todo';
  const response = submission?.response || '';
  const attachmentUrl = submission?.attachmentUrl || '';
  const feedback = submission?.status === 'graded' ? `<aside class="assignment-feedback"><strong>Điểm: ${escapeHtml(submission.score ?? '—')}/${row.maxScore}</strong>${escapeHtml(submission.feedback || 'Giáo viên chưa để lại nhận xét.')}</aside>` : '';
  const currentSubmission = submission ? `<p class="assignment-context">Đã nộp: ${escapeHtml(fmt(submission.submittedAt))}${submission.isLate ? ' · <span class="assignment-late">NỘP TRỄ</span>' : ''}</p>` : '';
  const input = row.submissionType === 'link' ? `<label>Đường dẫn sản phẩm<input name="attachmentUrl" type="url" placeholder="https://..." value="${escapeHtml(attachmentUrl)}" required></label>` : `<label>Nội dung bài làm<textarea name="response" rows="5" maxlength="30000" placeholder="Nhập bài làm, lời giải hoặc dán mã nguồn…" required>${escapeHtml(response)}</textarea></label>`;
  return `<article class="assignment-card"><div class="assignment-card-top"><span>${escapeHtml(row.className)} · ${escapeHtml(row.teacherName || 'Giáo viên')}</span><b class="assignment-status ${statusClass}">${status}</b></div><h3>${escapeHtml(row.title)}</h3><p class="assignment-context">Hạn nộp: ${escapeHtml(fmt(row.dueAt))} · Điểm tối đa: ${row.maxScore}${row.courseId ? ` · Khóa học: ${escapeHtml(row.courseId)}` : ''}</p><div class="assignment-instructions">${escapeHtml(row.instructions || 'Không có hướng dẫn bổ sung.')}</div>${feedback}${currentSubmission}<form class="assignment-submit-form" data-submit-assignment="${escapeHtml(row.id)}" data-submission-type="${escapeHtml(row.submissionType)}">${input}<button type="submit" class="button button-primary">${submission ? 'Cập nhật bài nộp' : 'Nộp bài'} ↗</button></form></article>`;
}
async function loadAssignments() {
  const list = document.getElementById('assignmentList');
  list.innerHTML = '<div class="assignment-empty">Đang tải bài tập…</div>';
  const data = await apiRequest('/api/assignments/my');
  loadedRows = data.rows || [];
  document.getElementById('assignmentTotal').textContent = loadedRows.length;
  document.getElementById('assignmentSummary').textContent = loadedRows.length ? `${loadedRows.filter((row) => row.submission?.status === 'graded').length} đã chấm · ${loadedRows.filter((row) => row.submission?.status === 'submitted').length} chờ phản hồi` : 'Chưa có bài tập được giao từ các lớp đang tham gia.';
  list.innerHTML = loadedRows.length ? loadedRows.map(renderRow).join('') : '<div class="assignment-empty">Bạn chưa có bài tập được giao.<br>Hãy xác nhận với giáo viên rằng tài khoản email của bạn đã được thêm vào lớp.</div>';
}
async function init() {
  try {
    const user = await currentUser();
    if (!user) return window.location.replace('/login.html');
    if (!['student', 'university_student'].includes(user.role)) return window.location.replace(user.role === 'teacher' ? '/teacher.html' : user.role === 'admin' ? '/admin.html' : '/dashboard.html');
    document.getElementById('assignmentUserName').textContent = user.fullName;
    document.getElementById('assignmentAvatar').textContent = (user.fullName.trim()[0] || 'H').toLocaleUpperCase('vi-VN');
    await loadAssignments();
  } catch (error) { showAlert(alertBox, error.message || 'Không tải được danh sách bài tập.'); }
}
document.getElementById('assignmentList').addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-submit-assignment]');
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  const payload = {};
  if (form.dataset.submissionType === 'link') payload.attachmentUrl = String(new FormData(form).get('attachmentUrl') || '').trim();
  else payload.response = String(new FormData(form).get('response') || '').trim();
  const previous = loadedRows.find((row) => row.id === form.dataset.submitAssignment)?.submission;
  try {
    if (previous?.status === 'graded' && !window.confirm('Bài này đã được chấm. Cập nhật bài sẽ gửi lại và xóa điểm cũ để giáo viên chấm lại. Tiếp tục?')) { button.disabled = false; return; }
    const data = await apiRequest(`/api/assignments/${encodeURIComponent(form.dataset.submitAssignment)}/submit`, { method: 'POST', body: JSON.stringify(payload) });
    showToast(data.message); await loadAssignments();
  } catch (error) { showToast(error.message || 'Không nộp được bài.', 'error'); button.disabled = false; }
});
document.getElementById('refreshAssignments').addEventListener('click', async () => { try { await loadAssignments(); showToast('Đã làm mới danh sách.'); } catch (error) { showToast(error.message, 'error'); } });
document.getElementById('assignmentLogout').addEventListener('click', async () => { try { await logout(); } catch (error) { showToast(error.message, 'error'); } });
init();
