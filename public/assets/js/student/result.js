/**
 * TRANG KẾT QUẢ.
 *
 * Máy chủ trả về điểm, đáp án đúng và giải thích CHỈ sau khi đã nộp bài.
 * Nếu còn câu tự luận chưa chấm, điểm cuối cùng chưa chốt — trang hiển thị điểm
 * máy chấm và nói rõ đang chờ giáo viên, KHÔNG hiển thị một điểm tổng giả.
 */

import { studentApi, authApi, requireUser } from '../core/api.js';
import {
    createElement,
    render,
    message,
    renderShell,
    STUDENT_MENU,
    queryParam,
    questionTypeLabel,
    formatScore,
    formatDate
} from '../core/dom.js';

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

/** Thẻ một câu trong phần xem lại. */
function reviewBlock(item) {
    const status = item.pendingGrading
        ? createElement('span', { className: 'result-status status-pending', text: 'Chờ chấm' })
        : createElement('span', {
            className: `result-status ${item.isCorrect ? 'status-correct' : 'status-wrong'}`,
            text: item.isCorrect ? 'Đúng' : 'Sai'
        });

    return createElement('article', { className: 'question-block result-block', children: [
        createElement('div', { className: 'question-head', children: [
            createElement('span', { className: 'question-number', text: `Câu ${item.order}` }),
            createElement('span', { className: 'question-type', text: questionTypeLabel(item.questionType) }),
            status,
            createElement('span', {
                className: 'question-points',
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
        ] }),
        item.pendingGrading
            ? createElement('p', { className: 'review-note', text: 'Đang chờ giáo viên chấm tay.' })
            : null,
        item.manualFeedback
            ? createElement('p', { className: 'review-explanation', text: `Nhận xét: ${item.manualFeedback}` })
            : null,
        item.explanation
            ? createElement('p', { className: 'review-explanation', text: `Giải thích: ${item.explanation}` })
            : null
    ].filter(Boolean) });
}

/** Tổng kết điểm, phân biệt rõ "chờ chấm" và "đã chấm xong". */
function renderSummary(detail) {
    const pending = detail.finalScoreStatus === 'pending';

    render(document.getElementById('summary-card'),
        createElement('div', { className: 'result-summary', children: [
            createElement('p', { className: 'auto-score', text: `Điểm máy chấm: ${formatScore(detail.autoScore, detail.totalPoints)}` }),
            pending
                ? createElement('p', { className: 'pending-note', text: 'Còn câu tự luận đang chờ giáo viên chấm. Điểm cuối cùng sẽ hiển thị sau khi chấm xong.' })
                : createElement('p', { className: 'final-score', text: `Điểm cuối cùng: ${formatScore(detail.totalScore, detail.totalPoints)}` }),
            createElement('p', {
                className: 'small muted',
                text: [
                    `Đúng ${detail.correctCount ?? 0}`,
                    `Sai ${detail.wrongCount ?? 0}`,
                    `Đã trả lời ${detail.answeredCount ?? 0}`,
                    detail.passed === true ? 'Đạt' : (detail.passed === false ? 'Chưa đạt' : null)
                ].filter(Boolean).join(' · ')
            }),
            detail.feedback
                ? createElement('p', { className: 'result-feedback', text: detail.feedback })
                : null
        ].filter(Boolean) })
    );
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireUser();
    if (!user) return;

    renderShell({
        user,
        menu: STUDENT_MENU,
        onLogout: async () => {
            await authApi.logout();
            window.location.href = '/auth/login.html';
        }
    });

    const attemptId = queryParam('attemptId');
    const reviewRoot = document.getElementById('review-root');

    if (!attemptId) {
        render(reviewRoot, message('Thiếu mã lượt làm bài.', 'error'));
        return;
    }

    try {
        const detail = await studentApi.getAttempt(attemptId);
        const exam = detail.exam || {};

        document.getElementById('exam-title').textContent = exam.title || 'Kết quả';
        document.getElementById('exam-meta').textContent = [
            `Lớp ${exam.grade}`,
            detail.submittedAt ? `Nộp lúc ${formatDate(detail.submittedAt)}` : null
        ].filter(Boolean).join(' · ');

        renderSummary(detail);

        const questions = detail.questions || [];
        render(reviewRoot, questions.length
            ? createElement('div', { className: 'result-review', children: questions.map(reviewBlock) })
            : message('Không có dữ liệu câu hỏi cho lượt làm bài này.', 'info'));
    } catch (error) {
        render(reviewRoot, message(error.message || 'Không tải được kết quả.', 'error'));
    } finally {
        document.getElementById('summary-card').setAttribute('aria-busy', 'false');
    }
});