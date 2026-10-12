import { apiRequest, currentUser, logout, showAlert, clearAlert, showToast, escapeHtml } from './api.js';

const alertBox = document.getElementById('lessonAlert');
const lessonId = new URLSearchParams(window.location.search).get('id') || '';
let lessonState = null;
let positionObserver = null;
let lastPositionSaved = '';
let storageUserId = 'anonymous';
let draftPrefix = `htm:user:anonymous:checkpoint-draft:${lessonId}:`;
const checkpointDraftTimers = new Map();
function positionKey() { return `htm:user:${storageUserId}:last-position:${lessonId}`; }
function safeStorageGet(key) { try { return window.localStorage.getItem(key); } catch { return null; } }
function safeStorageSet(key, value) { try { window.localStorage.setItem(key, value); } catch {} }
function safeStorageRemove(key) { try { window.localStorage.removeItem(key); } catch {} }


function renderVideo(video = {}) {
  const container = document.getElementById('lessonVideo');
  if (!container) return;
  const raw = String(video.videoUrl || '').trim();
  const title = escapeHtml(video.videoTitle || 'Video bài giảng');
  if (!raw || video.status === 'not-configured' || video.status === 'placeholder' || /example\.com|replace-before-release|replace-with/i.test(raw)) {
    container.innerHTML = `<div class="video-placeholder"><span class="video-placeholder-icon">▶</span><div><strong>${title}</strong><p>Video đang được chuẩn bị. Khi quay xong, hãy thay link trong <code>content/video-links/video-links.csv</code>.</p><small>Video được quản lý độc lập với nội dung bài học.</small></div></div>`;
    return;
  }
  let url;
  try { url = new URL(raw); } catch { url = null; }
  if (!url || url.protocol !== 'https:') {
    container.innerHTML = `<div class="video-placeholder"><span class="video-placeholder-icon">!</span><div><strong>${title}</strong><p>Link video không hợp lệ hoặc chưa dùng HTTPS.</p></div></div>`;
    return;
  }
  let embed = '';
  if (url.hostname === 'youtu.be') embed = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.pathname.slice(1))}`;
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) && url.pathname === '/watch') embed = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.searchParams.get('v') || '')}`;
  else if (url.hostname === 'www.youtube-nocookie.com' && url.pathname.startsWith('/embed/')) embed = url.href;
  else if (url.hostname === 'vimeo.com') embed = `https://player.vimeo.com/video/${encodeURIComponent(url.pathname.split('/').filter(Boolean)[0] || '')}`;
  else if (url.hostname === 'player.vimeo.com' && url.pathname.startsWith('/video/')) embed = url.href;
  if (embed && !/\/embed\/$|\/video\/$/.test(embed)) {
    container.innerHTML = `<div class="lesson-video-heading"><div><span class="section-kicker">VIDEO BÀI GIẢNG</span><h2>${title}</h2></div><span class="video-live-pill">Đã cấu hình</span></div><div class="video-frame"><iframe src="${escapeHtml(embed)}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    return;
  }
  if (/\.(mp4|webm|ogg)(?:$|\?)/i.test(url.href)) {
    container.innerHTML = `<div class="lesson-video-heading"><div><span class="section-kicker">VIDEO BÀI GIẢNG</span><h2>${title}</h2></div><span class="video-live-pill">Đã cấu hình</span></div><video class="hosted-video" controls preload="metadata" src="${escapeHtml(url.href)}">Trình duyệt không hỗ trợ video HTML5.</video>`;
    return;
  }
  container.innerHTML = `<div class="video-placeholder"><span class="video-placeholder-icon">↗</span><div><strong>${title}</strong><p>Link video đã cấu hình. Mở trong tab mới để xem.</p><a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">Mở video ↗</a></div></div>`;
}

function renderContent(value) {
  return escapeHtml(value || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}
function renderRichTheoryText(value) {
  const safe = escapeHtml(value || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return safe.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('');
}
function renderTheory(theory) {
  const panel = document.getElementById('theoryPanel');
  if (!panel) return;
  if (!theory || !Array.isArray(theory.sections) || !theory.sections.length) {
    panel.hidden = false;
    panel.innerHTML = '<div class="theory-panel-heading"><span class="theory-kicker">LÝ THUYẾT</span><h2 id="theoryPanelTitle">Nội dung lý thuyết đang được cập nhật</h2></div><p>Giáo viên cần bổ sung phần giải thích, ví dụ và cách vận dụng trước khi phát hành bài này.</p>';
    return;
  }
  const sections = theory.sections.map((section) => {
    const body = section.body ? renderRichTheoryText(section.body) : '';
    const items = Array.isArray(section.items) && section.items.length ? `<ul>${section.items.map((item) => `<li>${renderRichTheoryText(item)}</li>`).join('')}</ul>` : '';
    return `<article class="theory-section"><h3>${escapeHtml(section.heading || 'Nội dung')}</h3>${body}${items}</article>`;
  }).join('');
  panel.hidden = false;
  panel.innerHTML = `<div class="theory-panel-heading"><div><span class="theory-kicker">V8.0.3 · HỌC LÝ THUYẾT TRƯỚC KHI LUYỆN TẬP</span><h2 id="theoryPanelTitle">${escapeHtml(theory.title || 'Lý thuyết trọng tâm')}</h2><div class="theory-summary">${renderRichTheoryText(theory.summary || '')}</div></div><span class="theory-review-badge">Bản nháp · cần giáo viên duyệt</span></div><div class="theory-section-grid">${sections}</div><p class="theory-source-note">${escapeHtml(theory.sourceNote || 'Nội dung cần được đối chiếu với chương trình và tài liệu học chính thức trước khi phát hành.')}</p>`;
}
function renderQuestion(question, prefix) {
  const fieldName = `${prefix}-${question.id}`;
  if (question.type === 'multiple_choice') {
    return `<fieldset class="checkpoint-question"><legend>${escapeHtml(question.prompt)}</legend><div class="checkpoint-options">${(question.options || []).map((option, index) => `<label class="checkpoint-option"><input type="radio" data-question-id="${escapeHtml(question.id)}" name="${escapeHtml(fieldName)}" value="${escapeHtml(option.value)}" ${index === 0 ? '' : ''} required><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></fieldset>`;
  }
  return `<label class="checkpoint-question"><span>${escapeHtml(question.prompt)}</span><input class="form-input" data-question-id="${escapeHtml(question.id)}" type="text" name="${escapeHtml(fieldName)}" maxlength="300" autocomplete="off" required placeholder="Nhập câu trả lời của em"></label>`;
}
function renderPart(part, index, states) {
  const state = states.find((item) => item.id === part.id);
  const unlocked = index === 0 || states.slice(0, index).every((item) => item.passed);
  const passed = Boolean(state?.passed);
  const viewed = Boolean(state?.viewed);
  const formQuestions = part.checkpoint || [];
  const form = !passed ? `<form class="checkpoint-form" data-part-id="${escapeHtml(part.id)}" data-checkpoint-session-id="${escapeHtml(part.checkpointSessionId || '')}"><div class="checkpoint-heading"><div><span class="section-kicker">KIỂM TRA NHANH</span><h3>Em đã nắm phần này chưa?</h3><p>Trả lời 1–2 câu hỏi được chọn ngẫu nhiên từ ngân hàng đúng nội dung phần học. Cần từ ${lessonState.progress.checkpointPassScore} điểm để tiếp tục.</p></div><span class="checkpoint-count">${formQuestions.length} câu</span></div>${formQuestions.map((question) => renderQuestion(question, `part-${part.id}`)).join('')}<div class="checkpoint-footer"><span>🔒 Đạt điểm mới mở phần kế tiếp</span><button class="button button-primary" type="submit">Kiểm tra phần này →</button></div><div class="part-feedback" role="status" hidden></div></form>` : '';
  return `<section class="lesson-part ${passed ? 'part-passed' : ''} ${unlocked ? '' : 'part-locked'} ${viewed ? 'part-viewed' : ''}" id="part-${escapeHtml(part.id)}" data-part-id="${escapeHtml(part.id)}"><div class="part-heading"><span class="part-number">${String(index + 1).padStart(2, '0')}</span><div class="part-heading-copy"><div class="section-kicker">${part.durationMinutes} PHÚT · PHẦN ${index + 1}/4</div><h2>${escapeHtml(part.title.replace(/^\d+\.\s*/, ''))}</h2></div><span class="part-status ${passed ? 'passed' : unlocked ? 'available' : 'locked'}">${passed ? '✓ Đã đạt' : unlocked ? (viewed ? 'Đã xem · đang học' : 'Đang học') : '🔒 Chưa mở'}</span></div>${unlocked ? `<div class="part-content">${renderContent(part.content)}</div>${passed ? `<div class="checkpoint-success"><span>✓</span><div><strong>Đã vượt qua phần này</strong><small>Điểm tốt nhất: ${state.bestScore}/100. Em có thể xem lại nội dung bất cứ lúc nào.</small></div></div>` : form}` : `<div class="part-locked-message">Hoàn thành và đạt yêu cầu ở phần trước để mở nội dung này.</div>`}</section>`;
}
function renderLesson() {
  positionObserver?.disconnect();
  const { course, unit, lesson, progress } = lessonState;
  document.getElementById('lessonLoading').hidden = true;
  document.getElementById('lessonContent').hidden = false;
  document.getElementById('lessonBreadcrumb').textContent = `LỚP ${course.grade}  /  ${course.programName}  /  ${course.subjectName}  /  ${unit.title}`;
  document.getElementById('subjectIcon').textContent = course.subjectCode === 'math' ? '➗' : course.subjectCode === 'vietnamese' ? '📖' : '📘';
  document.getElementById('lessonEyebrow').textContent = `BÀI ${lesson.sequence} · ${lesson.estimatedMinutes} PHÚT`;
  document.getElementById('lessonTitle').textContent = lesson.title;
  document.getElementById('lessonObjective').textContent = lesson.objective;
  renderTheory(lesson.theory);
  renderVideo(lesson.video || {});
  document.getElementById('bestScore').textContent = `${progress.bestScore}/100`;
  document.getElementById('unlockScoreLabel').textContent = `Điểm mở khóa: ${progress.passScore}/100`;
  const complete = progress.parts.filter((item) => item.passed).length;
  document.getElementById('partProgressText').textContent = `${complete}/4 phần hoàn thành`;
  document.getElementById('lessonStatusText').textContent = progress.lessonPassed ? 'Bài học đã đạt yêu cầu — có thể ôn lại' : 'Học xong một phần, kiểm tra nhanh rồi mới tiếp tục';
  document.getElementById('partProgressBar').style.width = `${complete / 4 * 100}%`;
  document.getElementById('partNavigation').innerHTML = lesson.parts.map((part, index) => {
    const state = progress.parts.find((item) => item.id === part.id);
    return `<a data-part-id="${escapeHtml(part.id)}" class="part-nav-item ${state?.passed ? 'is-done' : ''} ${index === 0 || progress.parts.slice(0, index).every((item) => item.passed) ? '' : 'is-locked'}" href="#part-${escapeHtml(part.id)}"><span>${state?.passed ? '✓' : String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(part.title.replace(/^\d+\.\s*/, ''))}</strong></a>`;
  }).join('');
  document.getElementById('partsContainer').innerHTML = lesson.parts.map((part, index) => renderPart(part, index, progress.parts)).join('');
  restoreCheckpointDrafts();
  document.getElementById('partNavigation').querySelectorAll('a[data-part-id]').forEach((link) => link.addEventListener('click', () => { const partId = link.dataset.partId; safeStorageSet(positionKey(), partId); markCurrentPart(partId, true); }));
  restoreLessonPosition();
  const examButton = document.getElementById('openLessonExam');
  examButton.disabled = !progress.allPartsPassed;
  examButton.textContent = progress.lessonPassed ? 'Làm lại bài kiểm tra ↗' : progress.allPartsPassed ? 'Vào kiểm tra →' : 'Hoàn thành 4 phần trước';
  examButton.onclick = () => {
    const params = new URLSearchParams({ type: 'lesson', lessonId: lesson.id, grade: String(course.grade), programCode: course.programCode, subjectCode: course.subjectCode });
    window.location.assign(`/exam.html?${params.toString()}`);
  };
  document.getElementById('aiStatus').textContent = lessonState.ai.onlineAvailable ? 'AI trực tuyến' : 'Trợ giảng dự phòng';
  document.getElementById('backToCatalog').href = `/learning.html?grade=${course.grade}&programCode=${course.programCode}`;
}

function restoreCheckpointDrafts() {
  document.querySelectorAll('.checkpoint-form').forEach((form) => {
    const partId = form.dataset.partId;
    const part = lessonState.lesson.parts.find((item) => item.id === partId);
    const serverDraft = new Map((part?.checkpointDraft || []).map((item) => [item.questionId, String(item.answer ?? '')]));
    const local = (() => { try { return JSON.parse(safeStorageGet(`${draftPrefix}${partId}`) || '{}'); } catch { return {}; } })();
    for (const control of form.querySelectorAll('input[name]')) {
      const questionId = control.dataset.questionId;
      const name = control.name;
      const hasLocal = Object.prototype.hasOwnProperty.call(local, name);
      const hasServer = serverDraft.has(questionId);
      if (!hasLocal && !hasServer) continue;
      const saved = hasLocal ? String(local[name] ?? '') : serverDraft.get(questionId);
      if (control.type === 'radio') control.checked = saved === control.value;
      else control.value = saved;
    }
  });
}
function checkpointAnswersForForm(form) {
  const part = lessonState?.lesson.parts.find((item) => item.id === form.dataset.partId);
  if (!part) return [];
  return part.checkpoint.map((question) => {
    const controls = [...form.querySelectorAll(`[data-question-id="${CSS.escape(question.id)}"]`)];
    const answer = controls[0]?.type === 'radio' ? controls.find((control) => control.checked)?.value || '' : controls[0]?.value || '';
    return { questionId: question.id, answer };
  });
}
function saveCheckpointDraft(form) {
  const draft = {};
  for (const control of form.querySelectorAll('input[name]')) {
    if (control.type === 'radio') {
      if (control.checked) draft[control.name] = control.value;
    } else draft[control.name] = control.value;
  }
  safeStorageSet(`${draftPrefix}${form.dataset.partId}`, JSON.stringify(draft));
  const partId = form.dataset.partId;
  clearTimeout(checkpointDraftTimers.get(partId));
  checkpointDraftTimers.set(partId, setTimeout(async () => {
    const answers = checkpointAnswersForForm(form);
    try {
      await apiRequest(`/api/learning/parts/${encodeURIComponent(lessonId)}/${encodeURIComponent(partId)}/checkpoint/draft`, { method: 'POST', body: JSON.stringify({ checkpointSessionId: form.dataset.checkpointSessionId, answers }) });
    } catch {
      // Keep a local fallback if connectivity drops; the active session remains unchanged on the server.
    }
  }, 450));
}
async function markCurrentPart(partId, force = false) {
  if (!lessonState || !partId) return;
  const index = lessonState.lesson.parts.findIndex((part) => part.id === partId);
  if (index < 0) return;
  const states = lessonState.progress.parts;
  if (index > 0 && !states.slice(0, index).every((item) => item.passed)) return;
  if (!force && lastPositionSaved === partId) return;
  try {
    const result = await apiRequest('/api/learning/progress/position', { method: 'POST', body: JSON.stringify({ lessonId, partId }) });
    lastPositionSaved = partId;
    lessonState.progress.currentPartId = result.currentPartId || partId;
    const state = states.find((item) => item.id === partId);
    if (state) { state.viewed = true; state.views = result.views || state.views; }
    document.querySelectorAll('.lesson-part').forEach((node) => node.classList.toggle('part-current', node.dataset.partId === partId));
  } catch (error) {
    // A brief network failure should not prevent studying; localStorage still keeps the current position.
    safeStorageSet(positionKey(), partId);
  }
}
function setupPositionTracking() {
  positionObserver?.disconnect();
  if (!('IntersectionObserver' in window)) return;
  positionObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible?.target?.dataset.partId) markCurrentPart(visible.target.dataset.partId);
  }, { rootMargin: '-18% 0px -58% 0px', threshold: [0.1, 0.3, 0.6] });
  document.querySelectorAll('.lesson-part:not(.part-locked)').forEach((node) => positionObserver.observe(node));
}
function restoreLessonPosition() {
  const parts = lessonState.lesson.parts;
  const states = lessonState.progress.parts;
  const serverTarget = lessonState.progress.currentPartId || '';
  const localTarget = safeStorageGet(positionKey()) || '';
  let target = serverTarget || localTarget;
  const localIndex = parts.findIndex((part) => part.id === localTarget);
  const serverIndex = parts.findIndex((part) => part.id === serverTarget);
  const isAccessible = (index) => index >= 0 && (index === 0 || states.slice(0, index).every((item) => item.passed));
  // If saving position failed during a brief network issue, recover the local position only
  // when the server has not recorded that part as viewed yet.
  if (localIndex >= 0 && isAccessible(localIndex) && localTarget !== serverTarget && !states[localIndex]?.viewed && (serverIndex < 0 || !states[serverIndex]?.viewed)) target = localTarget;
  let index = parts.findIndex((part) => part.id === target);
  if (index < 0 || !isAccessible(index)) {
    index = parts.findIndex((_part, itemIndex) => !states[itemIndex]?.passed && (itemIndex === 0 || states.slice(0, itemIndex).every((item) => item.passed)));
    if (index < 0) index = parts.length - 1;
    target = parts[index]?.id || '';
  }
  if (!target) return;
  safeStorageSet(positionKey(), target);
  requestAnimationFrame(() => {
    document.getElementById(`part-${target}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    markCurrentPart(target, true);
    setupPositionTracking();
  });
}

async function loadLesson() {
  if (!lessonId) throw new Error('Thiếu mã bài học. Hãy quay lại trang lộ trình và chọn một bài đang mở.');
  const data = await apiRequest(`/api/learning/lesson/${encodeURIComponent(lessonId)}`);
  lessonState = data;
  renderLesson();
}

document.getElementById('partsContainer').addEventListener('input', (event) => { const form = event.target.closest('form[data-part-id]'); if (form) saveCheckpointDraft(form); });
document.getElementById('partsContainer').addEventListener('change', (event) => { const form = event.target.closest('form[data-part-id]'); if (form) saveCheckpointDraft(form); });

document.getElementById('partsContainer').addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-part-id]');
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const answers = [];
  const controls = [...form.querySelectorAll('input[name]')];
  const groups = new Map();
  for (const control of controls) {
    if (control.type === 'radio') {
      if (control.checked) groups.set(control.name, control.value);
    } else groups.set(control.name, control.value.trim());
  }
  const questionIds = [...new Set(controls.map((control) => control.name))];
  for (const name of questionIds) {
    const questionId = name.slice(name.indexOf('-') + 1).replace(/^.*?-q-/, 'q-');
    answers.push({ questionId: controls.find((control) => control.name === name)?.dataset.questionId || questionId, answer: groups.get(name) || '' });
  }
  // IDs are stored in input names after the form-specific prefix; resolve from the lesson payload to avoid accepting arbitrary client IDs.
  const part = lessonState.lesson.parts.find((item) => item.id === form.dataset.partId);
  answers.splice(0, answers.length, ...part.checkpoint.map((question) => {
    const name = `part-${part.id}-${question.id}`;
    return { questionId: question.id, answer: groups.get(name) || '' };
  }));
  const feedbackBox = form.querySelector('.part-feedback');
  try {
    const result = await apiRequest(`/api/learning/parts/${encodeURIComponent(lessonId)}/${encodeURIComponent(form.dataset.partId)}/checkpoint`, { method: 'POST', body: JSON.stringify({ answers, checkpointSessionId: form.dataset.checkpointSessionId }) });
    feedbackBox.hidden = false;
    feedbackBox.className = `part-feedback ${result.passed ? 'success' : 'error'}`;
    feedbackBox.textContent = `${result.message} ${result.score}/100`;
    if (result.passed) {
      safeStorageRemove(`${draftPrefix}${form.dataset.partId}`);
      showToast('Đã lưu tiến độ phần học.');
      await loadLesson();
      const nextPart = lessonState?.lesson.parts.find((part) => !lessonState.progress.parts.find((item) => item.id === part.id)?.passed);
      document.getElementById(`part-${nextPart?.id || form.dataset.partId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      button.disabled = true;
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'button button-quiet checkpoint-new-set'; retry.textContent = 'Lấy bộ câu hỏi khác ↻';
      retry.addEventListener('click', async () => { button.disabled = false; await loadLesson(); document.getElementById(`part-${form.dataset.partId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      form.querySelector('.checkpoint-footer')?.append(retry);
    }
  } catch (error) {
    feedbackBox.hidden = false;
    feedbackBox.className = 'part-feedback error';
    feedbackBox.textContent = error.message;
    button.disabled = false;
  }
});

document.getElementById('tutorForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.getElementById('tutorMessage').value.trim();
  if (!message) return;
  const button = document.getElementById('tutorSubmit');
  const reply = document.getElementById('tutorReply');
  button.disabled = true;
  button.textContent = 'Đang suy nghĩ...';
  reply.hidden = false;
  reply.textContent = 'Trợ giảng đang chuẩn bị câu trả lời...';
  try {
    const data = await apiRequest('/api/learning/tutor', { method: 'POST', body: JSON.stringify({ lessonId, message }) });
    reply.innerHTML = `<div class="tutor-reply-label">${data.mode === 'gemini-ai' ? '✦ Trợ giảng AI' : '✦ Trợ giảng học tập'}</div><p>${escapeHtml(data.answer).replace(/\n/g, '<br>')}</p>${data.followUp ? `<small>${escapeHtml(data.followUp)}</small>` : ''}`;
    document.getElementById('tutorMessage').value = '';
  } catch (error) {
    reply.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Hỏi trợ giảng ↗';
  }
});

async function init() {
  try {
    const user = await currentUser();
    if (!user) return window.location.replace('/login.html');
    storageUserId = String(user.id || user._id || 'anonymous');
    draftPrefix = `htm:user:${storageUserId}:checkpoint-draft:${lessonId}:`;
    if (user.role === 'teacher') return window.location.replace('/dashboard.html');
    if (user.role === 'admin') return window.location.replace('/admin.html');
    document.getElementById('userName').textContent = user.fullName;
    document.getElementById('userAvatar').textContent = (user.fullName.trim()[0] || 'H').toLocaleUpperCase('vi-VN');
    await loadLesson();
  } catch (error) {
    document.getElementById('lessonLoading').hidden = true;
    showAlert(alertBox, error.message || 'Không thể tải bài học.');
  }
}
document.getElementById('logoutButton').addEventListener('click', async () => { try { await logout(); } catch (error) { showToast(error.message, 'error'); } });
init();
