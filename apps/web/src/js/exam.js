import { apiRequest, currentUser, logout, showAlert, showToast, escapeHtml } from './api.js';

const params = new URLSearchParams(window.location.search);
const type = params.get('type') || 'practice';
const lessonId = params.get('lessonId') || '';
const unitId = params.get('unitId') || '';
const lessonMatch = lessonId.match(/^(ctst|kntt|canhdieu)-g([1-9])-([a-z_]+)-u([1-4])-l([1-4])$/);
const grade = params.get('grade') || lessonMatch?.[2] || '1';
const programCode = params.get('programCode') || lessonMatch?.[1] || 'ctst';
const subjectCode = params.get('subjectCode') || lessonMatch?.[3] || 'math';
let assessment = null;
let savedResult = null;
let examId = params.get('examId') || '';
let draftSaveTimer = null;
let draftSaving = false;
function examDraftKey() { return `htm:assessment-draft:${examId}`; }
function readLocalExamDraft() { try { const raw = JSON.parse(window.localStorage.getItem(examDraftKey()) || '[]'); return Array.isArray(raw) ? raw : []; } catch { return []; } }
function writeLocalExamDraft(answers) { try { window.localStorage.setItem(examDraftKey(), JSON.stringify(answers)); } catch {} }
function removeLocalExamDraft() { try { window.localStorage.removeItem(examDraftKey()); } catch {} }

function renderQuestion(question, index) {
  const title = `Câu ${index + 1}`;
  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    return `<fieldset class="exam-question" data-question-id="${escapeHtml(question.id)}"><legend><span class="question-label">${title} · ${escapeHtml(question.points)} điểm · ${question.type === 'true_false' ? 'Đúng/Sai' : 'Trắc nghiệm'}</span><span class="question-prompt">${escapeHtml(question.prompt)}</span></legend><div class="exam-options">${(question.options || []).map((option, optIndex) => `<label class="exam-option"><input type="radio" name="${escapeHtml(question.id)}" value="${escapeHtml(option.value)}"><span class="option-letter">${String.fromCharCode(65 + optIndex)}</span><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>`;
  }
  if (question.type === 'multiple_select') {
    return `<fieldset class="exam-question" data-question-id="${escapeHtml(question.id)}"><legend><span class="question-label">${title} · ${escapeHtml(question.points)} điểm · Chọn nhiều đáp án</span><span class="question-prompt">${escapeHtml(question.prompt)}</span></legend><div class="exam-options">${(question.options || []).map((option, optIndex) => `<label class="exam-option"><input type="checkbox" name="${escapeHtml(question.id)}" value="${escapeHtml(option.value)}"><span class="option-letter">${String.fromCharCode(65 + optIndex)}</span><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>`;
  }
  if (question.type === 'matching') {
    return `<fieldset class="exam-question structured-question" data-question-id="${escapeHtml(question.id)}"><legend><span class="question-label">${title} · ${escapeHtml(question.points)} điểm · Nối cặp</span><span class="question-prompt">${escapeHtml(question.prompt)}</span></legend><div class="matching-grid">${(question.matchingItems || []).map((item) => `<label class="matching-row"><span>${escapeHtml(item.label)}</span><select class="form-input" name="${escapeHtml(question.id)}__match__${escapeHtml(item.value)}"><option value="">Chọn nội dung tương ứng…</option>${(question.options || []).map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`;
  }
  if (question.type === 'ordering') {
    const count = (question.orderingItems || []).length || 4;
    return `<fieldset class="exam-question structured-question" data-question-id="${escapeHtml(question.id)}"><legend><span class="question-label">${title} · ${escapeHtml(question.points)} điểm · Sắp xếp thứ tự</span><span class="question-prompt">${escapeHtml(question.prompt)}</span></legend><div class="ordering-grid">${Array.from({ length: count }, (_, index) => `<label class="ordering-row"><span>Vị trí ${index + 1}</span><select class="form-input" name="${escapeHtml(question.id)}__order__${index}"><option value="">Chọn bước…</option>${(question.options || []).map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`;
  }
  if (question.type === 'fill_blank') {
    return `<div class="exam-question" data-question-id="${escapeHtml(question.id)}"><label class="question-prompt" for="answer-${escapeHtml(question.id)}"><span class="question-label">${title} · ${escapeHtml(question.points)} điểm</span>${escapeHtml(question.prompt)}</label><input id="answer-${escapeHtml(question.id)}" class="form-input exam-text-answer" name="${escapeHtml(question.id)}" type="text" maxlength="500" autocomplete="off" placeholder="Điền đáp án..."></div>`;
  }
  return `<div class="exam-question written-question" data-question-id="${escapeHtml(question.id)}"><label class="question-prompt" for="answer-${escapeHtml(question.id)}"><span class="question-label">${title} · ${escapeHtml(question.points)} điểm · ${question.type === 'essay' ? 'Tự luận' : 'Trả lời ngắn'}</span>${escapeHtml(question.prompt)}</label><textarea id="answer-${escapeHtml(question.id)}" name="${escapeHtml(question.id)}" rows="${question.type === 'essay' ? 5 : 3}" maxlength="5000" placeholder="Trình bày suy nghĩ của em bằng lời của mình..."></textarea><small>Hãy trả lời đúng trọng tâm. AI sẽ chấm theo tiêu chí và đưa ra gợi ý cải thiện.</small></div>`;
}
function feedbackMarkup(item, index, questions) {
  const question = questions.find((q) => q.id === item.questionId);
  const title = question?.prompt || `Câu ${index + 1}`;
  if (item.type === 'essay' || item.type === 'short_answer') {
    return `<article class="feedback-card ${item.score >= 70 ? 'feedback-good' : 'feedback-review'}"><div class="feedback-card-head"><strong>${escapeHtml(title)}</strong><span>${Math.round(item.score || 0)}/100</span></div><p>${escapeHtml(item.feedback || 'Đã chấm câu trả lời.')}</p>${item.strengths?.length ? `<div><b>Điểm tốt</b><ul>${item.strengths.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div>` : ''}${item.improvements?.length ? `<div><b>Có thể cải thiện</b><ul>${item.improvements.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul></div>` : ''}${item.sampleAnswer ? `<details><summary>Gợi ý cách trình bày</summary><p>${escapeHtml(item.sampleAnswer)}</p></details>` : ''}${item.gradingMode === 'heuristic-fallback' ? '<small class="grading-notice">Điểm sơ bộ theo quy tắc dự phòng — AI trực tuyến chưa chấm được câu này.</small>' : ''}</article>`;
  }
  const correctLabel = question?.type === 'true_false' ? (item.correctAnswer === 'true' ? 'Đúng' : 'Sai') : question?.type === 'matching' ? (String(item.correctAnswer || '').split('|').map((pair) => { const [left, right] = pair.split('='); return `${question.matchingItems?.find((value) => value.value === left)?.label || left} → ${question.options?.find((value) => value.value === right)?.label || right}`; }).join('; ')) : question?.type === 'ordering' ? String(item.correctAnswer || '').split('|').map((key) => question.options?.find((value) => value.value === key)?.label || key).join(' → ') : question?.type === 'multiple_select' ? String(item.correctAnswer || '').split('|').map((key) => question.options?.find((value) => value.value === key)?.label || key).join('; ') : item.correctAnswer;
  return `<article class="feedback-card ${item.correct ? 'feedback-good' : 'feedback-review'}"><div class="feedback-card-head"><strong>${escapeHtml(title)}</strong><span>${item.correct ? '✓ Đúng' : 'Chưa đúng'}</span></div>${!item.correct && correctLabel ? `<p>Đáp án tham khảo: <strong>${escapeHtml(correctLabel)}</strong></p>` : ''}${item.explanation ? `<p>${escapeHtml(item.explanation)}</p>` : ''}</article>`;
}
function renderResult(result) {
  savedResult = result;
  const box = document.getElementById('examResult');
  const questions = assessment.questions;
  box.hidden = false;
  box.innerHTML = `<div class="result-top ${result.passed ? 'passed' : 'not-passed'}"><div class="result-emblem">${result.passed ? '✓' : '↻'}</div><div><div class="section-kicker">KẾT QUẢ CỦA EM</div><h2>${result.passed ? 'Làm tốt lắm!' : 'Mình cùng ôn thêm nhé!'}</h2><p>${escapeHtml(result.message)}</p></div><div class="result-score"><strong>${result.score}</strong><span>/100 điểm</span></div></div><div class="result-progress"><span style="width:${result.score}%"></span></div><p class="grading-mode-note">Cách chấm: ${result.gradingMode === 'gemini-ai' ? 'AI Gemini' : result.gradingMode === 'mixed' ? 'Kết hợp chấm tự động và AI' : result.gradingMode === 'heuristic-fallback' ? 'Quy tắc dự phòng cho câu tự luận' : 'Chấm tự động theo đáp án'} · Điểm đạt yêu cầu: ${result.passScore}/100</p><div class="feedback-list">${result.feedback.map((item, index) => feedbackMarkup(item, index, questions)).join('')}</div><div class="result-actions"><a class="button button-quiet" href="/learning.html?grade=${grade}&programCode=${programCode}">Về lộ trình</a>${result.progress?.nextUnlockedLessonId ? `<a class="button button-primary" href="/lesson.html?id=${encodeURIComponent(result.progress.nextUnlockedLessonId)}">Học bài tiếp theo →</a>` : `<button id="retryExam" class="button button-primary" type="button">${result.passed ? 'Ôn tập thêm' : 'Thử lại bài kiểm tra'} ↻</button>`}</div>`;
  box.querySelector('#retryExam')?.addEventListener('click', async () => {
    const url = new URL(window.location.href);
    removeLocalExamDraft();
    url.searchParams.delete('examId');
    window.history.replaceState({}, '', url);
    examId = '';
    assessment = null;
    savedResult = null;
    document.getElementById('examResult').hidden = true;
    document.getElementById('examForm').hidden = false;
    document.getElementById('examForm').reset();
    document.getElementById('examLoading').hidden = false;
    document.getElementById('examContent').hidden = true;
    document.getElementById('examAlert').textContent = '';
    try { await loadAssessment(); } catch (error) { showAlert(document.getElementById('examAlert'), error.message || 'Không tạo được đề mới.'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function collectExamAnswers() {
  if (!assessment) return [];
  return assessment.questions.map((question) => {
    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      const checked = document.querySelector(`input[name="${CSS.escape(question.id)}"]:checked`);
      return { questionId: question.id, answer: checked?.value ?? '' };
    }
    if (question.type === 'multiple_select') {
      const selected = [...document.querySelectorAll(`input[name="${CSS.escape(question.id)}"]:checked`)].map((item) => item.value).sort();
      return { questionId: question.id, answer: selected.join('|') };
    }
    if (question.type === 'matching') {
      const answer = (question.matchingItems || []).map((item) => `${item.value}=${document.querySelector(`select[name="${CSS.escape(question.id)}__match__${CSS.escape(item.value)}"]`)?.value || ''}`).join('|');
      return { questionId: question.id, answer };
    }
    if (question.type === 'ordering') {
      const answer = (question.orderingItems || []).map((_, index) => document.querySelector(`select[name="${CSS.escape(question.id)}__order__${index}"]`)?.value || '').join('|');
      return { questionId: question.id, answer };
    }
    const control = document.querySelector(`input[name="${CSS.escape(question.id)}"], textarea[name="${CSS.escape(question.id)}"]`);
    return { questionId: question.id, answer: control?.value ?? '' };
  });
}
function applyExamAnswers(answers) {
  const byId = new Map((answers || []).map((item) => [item.questionId, String(item.answer ?? '')]));
  for (const question of assessment.questions) {
    if (!byId.has(question.id)) continue;
    const answer = byId.get(question.id);
    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      const radio = [...document.querySelectorAll(`input[name="${CSS.escape(question.id)}"]`)].find((item) => item.value === answer);
      if (radio) radio.checked = true;
    } else if (question.type === 'multiple_select') {
      const selected = new Set(answer.split('|'));
      for (const input of document.querySelectorAll(`input[name="${CSS.escape(question.id)}"]`)) input.checked = selected.has(input.value);
    } else if (question.type === 'matching') {
      const pairs = new Map(answer.split('|').map((part) => part.split('=')));
      for (const item of question.matchingItems || []) {
        const control = document.querySelector(`select[name="${CSS.escape(question.id)}__match__${CSS.escape(item.value)}"]`);
        if (control) control.value = pairs.get(item.value) || '';
      }
    } else if (question.type === 'ordering') {
      const sequence = answer.split('|');
      for (let index = 0; index < (question.orderingItems || []).length; index += 1) {
        const control = document.querySelector(`select[name="${CSS.escape(question.id)}__order__${index}"]`);
        if (control) control.value = sequence[index] || '';
      }
    } else {
      const control = document.querySelector(`input[name="${CSS.escape(question.id)}"], textarea[name="${CSS.escape(question.id)}"]`);
      if (control) control.value = answer;
    }
  }
}
async function saveExamDraftNow() {
  if (!assessment || !examId || draftSaving || document.getElementById('examForm').hidden) return;
  const answers = collectExamAnswers();
  writeLocalExamDraft(answers);
  draftSaving = true;
  try {
    await apiRequest('/api/learning/assessments/draft', { method: 'POST', body: JSON.stringify({ examId, answers }) });
  } catch {
    // The browser copy remains as a fallback if connectivity briefly drops.
  } finally { draftSaving = false; }
}
function scheduleExamDraftSave() {
  if (!assessment || !examId) return;
  const answers = collectExamAnswers();
  writeLocalExamDraft(answers);
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => { saveExamDraftNow(); }, 500);
}

async function loadAssessment() {
  const query = examId ? new URLSearchParams({ examId }) : new URLSearchParams({ type, grade, programCode, subjectCode });
  if (!examId && lessonId) query.set('lessonId', lessonId);
  if (!examId && unitId) query.set('unitId', unitId);
  const data = await apiRequest(`/api/learning/assessments?${query.toString()}`);
  assessment = data.assessment;
  examId = assessment.examId || '';
  if (examId) {
    const url = new URL(window.location.href);
    url.searchParams.set('examId', examId);
    window.history.replaceState({}, '', url);
  }
  document.getElementById('examLoading').hidden = true;
  document.getElementById('examContent').hidden = false;
  document.getElementById('examTitle').textContent = assessment.title;
  document.getElementById('examEyebrow').textContent = type === 'lesson' ? 'KIỂM TRA BÀI HỌC' : type === 'chapter' ? 'KIỂM TRA CHỦ ĐIỂM' : type === 'midterm' ? 'KIỂM TRA GIỮA KỲ' : type === 'final' ? 'KIỂM TRA CUỐI KỲ' : 'ĐỀ LUYỆN TẬP';
  document.getElementById('examDescription').textContent = `Lớp ${assessment.grade} · ${assessment.programName || (programCode === 'ctst' ? 'Chân trời sáng tạo' : programCode === 'kntt' ? 'Kết nối tri thức với cuộc sống' : 'Cánh Diều')} · ${assessment.subjectName || subjectCode} · Chủ đề: ${assessment.topicTitle || assessment.title}. Bộ câu hỏi được chọn ngẫu nhiên trong đúng phạm vi học.`;
  document.getElementById('examQuestionCount').textContent = `${assessment.questionCount} câu hỏi`;
  document.getElementById('examPassScore').textContent = `Đạt từ ${assessment.passScore} điểm`;
  document.getElementById('examQuestions').innerHTML = assessment.questions.map(renderQuestion).join('');
  const localDraft = readLocalExamDraft();
  const serverDraft = Array.isArray(data.savedAnswers) ? data.savedAnswers : [];
  const mergedById = new Map(serverDraft.map((item) => [item.questionId, item]));
  for (const item of localDraft) if (item && typeof item.answer === 'string') mergedById.set(item.questionId, item);
  applyExamAnswers([...mergedById.values()]);
  document.getElementById('examBack').href = lessonId ? `/lesson.html?id=${encodeURIComponent(lessonId)}` : `/learning.html?grade=${grade}&programCode=${programCode}`;
  if (data.result) {
    document.getElementById('examForm').hidden = true;
    renderResult(data.result);
  } else {
    document.getElementById('examForm').hidden = false;
    document.getElementById('examResult').hidden = true;
  }
}

document.getElementById('examQuestions').addEventListener('input', scheduleExamDraftSave);
document.getElementById('examQuestions').addEventListener('change', scheduleExamDraftSave);
window.addEventListener('pagehide', () => { if (assessment && examId) writeLocalExamDraft(collectExamAnswers()); });

document.getElementById('examForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('submitExam');
  button.disabled = true;
  button.textContent = 'Đang chấm bài...';
  const answers = collectExamAnswers();
  clearTimeout(draftSaveTimer);
  try {
    const data = await apiRequest('/api/learning/assessments/submit', { method: 'POST', body: JSON.stringify({ examId, type, grade: Number(grade), programCode, subjectCode, unitId, lessonId, answers }) });
    data.message = data.message || (data.passed ? 'Em đã đạt điểm yêu cầu.' : 'Hãy xem nhận xét để cải thiện.');
    document.getElementById('examForm').hidden = true;
    removeLocalExamDraft();
    renderResult(data);
    window.scrollTo({ top: document.getElementById('examResult').offsetTop - 70, behavior: 'smooth' });
  } catch (error) {
    showAlert(document.getElementById('examAlert'), error.message || 'Không thể chấm bài lúc này.');
    button.disabled = false;
    button.textContent = 'Nộp bài kiểm tra ↗';
  }
});

async function init() {
  try {
    const user = await currentUser();
    if (!user) return window.location.replace('/login.html');
    if (user.role !== 'student' && user.role !== 'university_student') return window.location.replace(user.role === 'admin' ? '/admin.html' : '/dashboard.html');
    document.getElementById('userName').textContent = user.fullName;
    document.getElementById('userAvatar').textContent = (user.fullName.trim()[0] || 'H').toLocaleUpperCase('vi-VN');
    await loadAssessment();
  } catch (error) {
    document.getElementById('examLoading').hidden = true;
    showAlert(document.getElementById('examAlert'), error.message || 'Không thể mở bài kiểm tra.');
  }
}
document.getElementById('logoutButton').addEventListener('click', async () => { try { await logout(); } catch (error) { showToast(error.message, 'error'); } });
init();
