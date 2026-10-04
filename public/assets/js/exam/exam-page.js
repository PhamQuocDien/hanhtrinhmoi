/**
 * TRANG LÀM BÀI — điểm vào cho học sinh.
 *
 * Trách nhiệm:
 *   - Nạp đề và câu hỏi từ máy chủ (máy chủ đã cắt sẵn phần đáp án đúng).
 *   - Dựng giao diện đúng theo từng loại câu.
 *   - Đếm thời gian theo mốc máy chủ, tự lưu nháp, rồi nộp bài.
 *
 * KHÔNG BAO GIỜ: tự tính điểm, hiển thị đáp án đúng trước khi nộp, hay tin
 * bất kỳ thứ gì client tự khai về điểm số.
 */

import { studentApi, ApiError } from '../core/api.js';
import {
    createElement,
    render,
    clear,
    message,
    formatCountdown,
    formatScore,
    questionTypeLabel
} from '../core/dom.js';
import {
    renderAnswer,
    collectAnswers,
    bindTrueFalseButtons,
    restoreAnswers
} from '../question/renderers.js';
import { ExamTimer, AutosaveManager } from './timer.js';

const state = {
    attemptId: null,
    exam: null,
    questions: [],
    answers: {},
    submitted: false,
    timeSpentSeconds: 0
};

let timer = null;
let autosave = null;
let removeUnloadGuard = null;

// ------------------------------------------------------------- KHỞI TẠO

/** Đọc examId từ URL và khởi động trang. */
async function init() {
    const examId = new URLSearchParams(window.location.search).get('examId');
    if (!examId) {
        render(document.getElementById('exam-root'), message('Thiếu mã đề thi.', 'error'));
        return;
    }

    bindStaticHandlers();
    await startAttempt(examId);
}

/** Gắn sự kiện cho các nút cố định của trang. */
function bindStaticHandlers() {
    document.getElementById('btn-submit')?.addEventListener('click', confirmSubmit);
    document.getElementById('btn-save')?.addEventListener('click', async () => {
        const result = await autosave?.flush();
        showToast(result ? 'Đã lưu nháp câu trả lời.' : 'Chưa có thay đổi để lưu.');
    });
}

/** Bắt đầu lượt làm bài mới và dựng giao diện. */
async function startAttempt(examId) {
    const root = document.getElementById('exam-root');
    render(root, message('Đang tải đề thi…', 'info'));

    try {
        const attempt = await studentApi.startAttempt(examId);

        state.attemptId = attempt.attemptId;
        state.exam = attempt.exam;
        state.questions = attempt.questions || [];
        state.answers = {};
        state.submitted = false;

        renderHeader(attempt);
        renderQuestions(root);

        timer = new ExamTimer(attempt.durationSeconds, {
            onTick: updateCountdown,
            onExpire: handleTimeUp
        }).start();

        autosave = new AutosaveManager({
            attemptId: state.attemptId,
            getAnswers: collectCurrentAnswers,
            api: studentApi,
            onSaved: () => markSaveState('Đã lưu nháp'),
            onError: () => markSaveState('Chưa lưu được — sẽ thử lại')
        }).start();

        removeUnloadGuard = autosave.guardBeforeUnload();
    } catch (error) {
        handleError(root, error);
    }
}

// ------------------------------------------------------------- KHU VỰC ĐẦU TRANG

/** Dựng phần đầu: tên đề, thời gian còn lại, trạng thái lưu nháp. */
function renderHeader(attempt) {
    const exam = attempt.exam || {};
    document.title = `${exam.title || 'Làm bài'} — Hành Tinh Mơ Ước`;

    const header = clear(document.getElementById('exam-header'));
    header.append(
        createElement('div', { className: 'exam-title', children: [
            createElement('h1', { text: exam.title || 'Bài kiểm tra' }),
            createElement('p', {
                className: 'exam-meta',
                text: [
                    `Lớp ${exam.grade}`,
                    exam.subjectId ? `Môn ${exam.subjectId}` : null,
                    `${attempt.questions.length} câu`,
                    `${exam.totalPoints} điểm`
                ].filter(Boolean).join(' • ')
            })
        ]}),
        createElement('div', { className: 'exam-status', children: [
            createElement('div', { className: 'countdown', id: 'countdown', text: '--:--' }),
            createElement('div', { className: 'save-state', id: 'save-state', text: '' })
        ]})
    );
}

/** Cập nhật đồng hồ đếm ngược. */
function updateCountdown(remaining) {
    const element = document.getElementById('countdown');
    if (!element) return;
    element.textContent = formatCountdown(remaining);
    // Cảnh báo khi còn dưới 5 phút.
    element.classList.toggle('countdown-warning', remaining <= 300);
    element.classList.toggle('countdown-danger', remaining <= 60);
}

/** Hiện trạng thái lưu nháp. */
function markSaveState(text) {
    const element = document.getElementById('save-state');
    if (element) element.textContent = text;
}

/** Báo ngắn gọn ở giữa màn hình. */
function showToast(text, variant = 'info') {
    const toast = createElement('div', { className: `toast toast-${variant}`, text });
    document.body.append(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ------------------------------------------------------------- KHU VỰC CÂU HỎI

/** Dựng toàn bộ danh sách câu hỏi. */
function renderQuestions(root) {
    const list = createElement('div', { className: 'question-list' });

    state.questions.forEach((question, index) => {
        const block = createElement('article', {
            className: 'question-block',
            attrs: {
                // Thuộc tính này là ranh giới để collectAnswers chỉ lấy ô của câu này.
                'data-question-id': question.questionId,
                'data-index': String(index)
            },
            children: [
                createElement('header', { className: 'question-head', children: [
                    createElement('span', { className: 'question-number', text: `Câu ${question.order || index + 1}` }),
                    createElement('span', { className: 'question-type', text: questionTypeLabel(question.type) }),
                    createElement('span', { className: 'question-points', text: `${question.points} điểm` })
                ] }),
                createElement('p', { className: 'question-text' }),
                renderAnswer(question)
            ]
        });

        fillQuestionText(block.querySelector('.question-text'), question);
        list.append(block);
    });

    render(root, list);
    bindTrueFalseButtons(list);
}

/**
 * Đưa nội dung câu vào đúng chỗ.
 *
 * Câu điền khuyết có placeholder `[[blank-1]]` và `renderAnswer` đã dựng sẵn
 * dòng chứa input, nên không lặp nội dung ở đây. Các câu khác hiện nguyên văn.
 */
function fillQuestionText(textElement, question) {
    const raw = String(question.questionText || '');
    if (question.type === 'fill_blank' && /\[\[blank-\d+\]\]/.test(raw)) {
        textElement.textContent = '';
        return;
    }
    textElement.textContent = raw;
}

/** Gom câu trả lời hiện tại từ DOM. */
function collectCurrentAnswers() {
    const root = document.querySelector('.question-list');
    if (!root) return state.answers;
    state.answers = collectAnswers(root, state.questions);
    return state.answers;
}

/** Một giá trị trả lời có "nội dung" hay không. */
function hasContent(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return Boolean(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
        return Object.values(value).some(text => String(text ?? '').trim());
    }
    return true;
}

/** Đánh dấu câu đã trả lời để học sinh dễ quét lại bài. */
function trackAnsweredState() {
    const root = document.querySelector('.question-list');
    if (!root) return;

    const answers = collectCurrentAnswers();
    for (const question of state.questions) {
        const block = root.querySelector(
            `[data-question-id="${CSS.escape(question.questionId)}"]`
        );
        if (block) block.classList.toggle('answered', hasContent(answers[question.questionId]));
    }
}

// ------------------------------------------------------------- NỘP BÀI

/** Hỏi lại trước khi nộp — nộp rồi thì không sửa được. */
function confirmSubmit() {
    trackAnsweredState();
    const answeredCount = Object.keys(collectCurrentAnswers()).length;
    const total = state.questions.length;
    const unanswered = total - answeredCount;

    const prompt = unanswered > 0
        ? `Bạn chưa trả lời ${unanswered}/${total} câu. Vẫn nộp bài?`
        : `Đã trả lời ${answeredCount}/${total} câu. Nộp bài?`;

    if (!window.confirm(prompt)) return;
    submitExam();
}

/** Nộp bài lên máy chủ — điểm do máy chủ tính. */
async function submitExam({ auto = false } = {}) {
    if (state.submitted) return;
    state.submitted = true;

    timer?.stop();
    autosave?.stop();
    removeUnloadGuard?.();

    const root = document.getElementById('exam-root');
    render(root, message('Đang nộp bài và chấm điểm…', 'info'));

    try {
        const answers = collectCurrentAnswers();
        renderResult(await studentApi.submitAttempt(state.attemptId, answers));
    } catch (error) {
        // Cho phép thử nộp lại sau lỗi mạng — đồng hồ đã dừng nên cần báo rõ.
        state.submitted = false;
        timer?.start();
        autosave?.start();
        handleError(root, error);
    }
}

/** Hết giờ: nộp luôn, không hỏi lại. */
function handleTimeUp() {
    showToast('Đã hết thời gian. Hệ thống đang nộp bài.', 'warning');
    submitExam({ auto: true });
}

// ------------------------------------------------------------- KẾT QUẢ

/** Hiển thị kết quả, phân biệt rõ "đã chấm" và "còn chờ chấm tay". */
function renderResult(payload) {
    const result = payload.result || {};
    const pending = result.finalScoreStatus === 'pending';
    const autoMax = result.totalPoints - (result.manualMaxPoints || 0);

    const summary = createElement('div', { className: 'result-summary', children: [
        createElement('h2', { text: pending ? 'Đã nộp bài — đang chờ chấm' : 'Kết quả' }),
        // Phần điểm máy chấm luôn hiển thị, kể cả khi còn câu chờ chấm.
        createElement('p', {
            className: 'auto-score',
            text: `Đã chấm tự động: ${formatScore(result.autoScore, autoMax)}`
        }),
        pending
            ? createElement('p', {
                className: 'pending-note',
                text: `${result.manualGradingQuestions} câu tự luận (${result.manualMaxPoints} điểm) đang chờ giáo viên chấm. Điểm cuối sẽ cập nhật sau khi chấm xong.`
            })
            : createElement('p', {
                className: 'final-score',
                text: `Điểm: ${formatScore(result.totalScore ?? result.autoScore, result.totalPoints)} (${result.scorePercent}%)`
            }),
        result.feedback ? createElement('p', { className: 'result-feedback', text: result.feedback }) : null
    ].filter(Boolean) });

    const review = createElement('div', { className: 'result-review' });
    for (const item of result.questionResults || []) review.append(renderQuestionResult(item));

    render(document.getElementById('exam-root'), summary, review);
}

/** Dựng khối kết quả của một câu. */
function renderQuestionResult(item) {
    const status = item.pendingGrading
        ? createElement('span', { className: 'result-status status-pending', text: 'Đang chờ chấm' })
        : createElement('span', {
            className: `result-status ${item.isCorrect ? 'status-correct' : 'status-wrong'}`,
            text: item.isCorrect ? 'Đúng' : 'Sai'
        });

    const children = [
        createElement('header', { className: 'question-head', children: [
            createElement('span', { className: 'question-number', text: `Câu ${item.order || '?'}` }),
            status,
            createElement('span', {
                className: 'question-points',
                // Câu chờ chấm chưa có điểm — hiện "chờ chấm" thay vì 0 điểm.
                text: item.pendingGrading
                    ? `Chờ chấm / ${item.maxPoints} điểm`
                    : `${item.awardedPoints}/${item.maxPoints} điểm`
            })
        ] }),
        createElement('p', { className: 'question-text', text: item.questionText }),
        createElement('div', { className: 'answer-review', children: [
            createElement('p', { className: 'review-line', children: [
                createElement('strong', { text: 'Bạn trả lời: ' }),
                createElement('span', { text: describeAnswer(item.questionType, item.studentAnswer) })
            ] }),
            createElement('p', { className: 'review-line', children: [
                createElement('strong', { text: 'Đáp án: ' }),
                createElement('span', { text: describeAnswer(item.questionType, item.correctAnswer) })
            ] })
        ] })
    ];

    if (item.pendingGrading) {
        children.push(createElement('p', { className: 'review-note', text: 'Đang chờ giáo viên chấm tay.' }));
    }
    if (item.explanation) {
        children.push(createElement('p', { className: 'review-explanation', text: `Giải thích: ${item.explanation}` }));
    }

    return createElement('article', { className: 'question-block result-block', children });
}

/** Mô tả câu trả lời cho người đọc kết quả. */
function describeAnswer(type, value) {
    if (value === null || value === undefined || value === '') return '(không trả lời)';
    if (Array.isArray(value)) {
        if (type === 'fill_blank') {
            return value.map(item => `${item.blankId}: ${(item.correctAnswers || []).join(' / ')}`).join('; ');
        }
        if (type === 'true_false') {
            return value.map(item => `${item.statementId}: ${item.correctAnswer ? 'Đúng' : 'Sai'}`).join('; ');
        }
        return value.join(', ');
    }
    if (typeof value === 'boolean') return value ? 'Đúng' : 'Sai';
    if (typeof value === 'object') {
        return Object.entries(value).map(([key, text]) => `${key}: ${text}`).join('; ');
    }
    return String(value);
}

// ------------------------------------------------------------- XỬ LÝ LỖI

/** Hiển thị lỗi; 401 thì đưa về trang đăng nhập. */
function handleError(root, error) {
    if (error instanceof ApiError && error.status === 401) {
        render(root, message('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error'));
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
        return;
    }
    if (error instanceof ApiError && error.status === 403) {
        render(root, message('Bạn không có quyền làm bài này.', 'error'));
        return;
    }
    render(root, message(error.message || 'Có lỗi xảy ra khi tải đề thi.', 'error'));
}

// ------------------------------------------------------------- KHỞI ĐỘNG

document.addEventListener('DOMContentLoaded', () => {
    init();
    // Mọi thay đổi câu trả lời đều đánh dấu để lưu nháp và cập nhật trạng thái câu.
    const root = document.getElementById('exam-root');
    root?.addEventListener('input', () => {
        autosave?.markDirty();
        trackAnsweredState();
    });
    root?.addEventListener('change', () => {
        autosave?.markDirty();
        trackAnsweredState();
    });
});