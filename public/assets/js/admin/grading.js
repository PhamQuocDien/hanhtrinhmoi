/**
 * TRANG BÀI CẦN CHẤM (quản trị).
 *
 * Luồng:
 *   danh sách câu chờ chấm -> mở một bài -> nhập điểm + nhận xét -> lưu
 *   -> nếu còn câu chờ thì bài vẫn "chờ chấm"; hết câu chờ thì điểm tổng chốt.
 *
 * `graderId` do máy chủ lấy từ phiên đăng nhập — trang này không gửi lên và
 * không thể tự quyết định ai là người chấm.
 */

import { adminApi } from '../core/api.js';
import {
    createElement,
    render,
    message,
    questionTypeLabel,
    toast,
    formatNumber,
    formatDate
} from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const statsBox = document.getElementById('stats');
const tbody = document.getElementById('queue-body');
const gradeSelect = document.getElementById('grade');
const usernameInput = document.getElementById('username');
const panel = document.getElementById('grading-panel');
const panelBody = document.getElementById('grading-body');
const panelTitle = document.getElementById('grading-title');

/** Bảng thông báo. */
function notice(text, variant = 'muted') {
    render(tbody, createElement('tr', {
        children: [createElement('td', { className: variant, text, attrs: { colspan: 7 } })]
    }));
}

/** Rút gọn bài làm cho danh sách. */
function previewAnswer(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > 70 ? `${clean.slice(0, 70)}…` : (clean || '(không trả lời)');
}

/** Một dòng của danh sách chờ chấm. */
function queueRow(item) {
    return createElement('tr', { children: [
        createElement('td', { text: item.username }),
        createElement('td', { text: item.examTitle }),
        createElement('td', {
            text: `Câu ${item.questionNumber ?? '?'} · ${questionTypeLabel(item.questionType)}`
        }),
        createElement('td', { text: previewAnswer(item.studentAnswer) }),
        createElement('td', {
            text: item.wordCount === null ? '—' : `${item.wordCount} từ`
        }),
        createElement('td', { text: `${formatNumber(item.maxPoints, 1)} điểm` }),
        createElement('td', { children: [createElement('button', {
            className: 'btn btn-primary',
            text: 'Chấm',
            attrs: { type: 'button' },
            onClick: () => openSheet(item.attemptId, item.username)
        })] })
    ] });
}
/** Một câu cần chấm: bài làm + rubric + ô nhập điểm và nhận xét. */
function gradingBlock(question, maxPoints) {
    const scoreInput = createElement('input', {
        attrs: {
            type: 'number',
            min: '0',
            max: String(maxPoints),
            step: '0.25',
            value: '',
            placeholder: `0 – ${formatNumber(maxPoints, 2)}`,
            'aria-label': `Điểm câu ${question.order ?? ''}`
        }
    });
    const feedbackInput = createElement('textarea', {
        attrs: { rows: '2', placeholder: 'Nhận xét cho học sinh…', 'aria-label': 'Nhận xét' }
    });

    // Rubric giúp người chấm nhìn từng tiêu chí và điểm tối đa của nó.
    const rubric = (question.rubric || []).length
        ? createElement('ul', { className: 'small muted', children: question.rubric.map(item => createElement('li', {
            text: `${item.description || item.criterionId}: tối đa ${formatNumber(item.maxPoints, 2)} điểm`
        })) })
        : null;

    const block = createElement('article', { className: 'question-block', children: [
        createElement('div', { className: 'question-head', children: [
            createElement('span', { className: 'question-number', text: `Câu ${question.order ?? '?'}` }),
            createElement('span', { className: 'question-type', text: questionTypeLabel(question.questionType) }),
            createElement('span', { className: 'question-points', text: `Tối đa ${formatNumber(maxPoints, 2)} điểm` })
        ] }),
        createElement('p', { className: 'question-text', text: question.questionText }),
        createElement('div', { className: 'answer-review', children: [
            createElement('p', { className: 'review-line', children: [
                createElement('strong', { text: 'Bài làm của học sinh: ' }),
                createElement('span', { text: question.studentAnswer ?? '(không trả lời)' })
            ] })
        ] }),
        rubric,
        createElement('label', { className: 'field', children: [
            createElement('span', { className: 'field-label', text: 'Điểm' }),
            scoreInput
        ] }),
        createElement('label', { className: 'field', children: [
            createElement('span', { className: 'field-label', text: 'Nhận xét' }),
            feedbackInput
        ] })
    ].filter(Boolean) });

    return {
        questionId: question.questionId,
        maxPoints,
        block,
        scoreInput,
        feedbackInput
    };
/** Mở bài làm để chấm. */
async function openSheet(attemptId, username) {
    panel.hidden = false;
    render(panelBody, message('Đang tải bài làm…', 'info'));

    try {
        const sheet = await adminApi.getGradingSheet(attemptId, username || undefined);
        const questions = (sheet.questions || []).filter(item => item.needsManualGrading);

        if (!questions.length) {
            render(panelBody, message('Bài này không còn câu nào chờ chấm.', 'info'));
            return;
        }

        panelTitle.textContent = `Chấm bài — ${username} · ${sheet.exam?.title || ''}`;
        const blocks = questions.map(item => gradingBlock(item, item.maxPoints));

        render(panelBody,
            createElement('div', { className: 'stack', children: blocks.map(item => item.block) }),
            createElement('button', {
                className: 'btn btn-primary',
                text: 'Lưu điểm',
                attrs: { type: 'button' },
                onClick: async event => {
                    event.target.disabled = true;
                    try {
                        // Gom tất cả câu đã nhập điểm rồi gửi một lần.
                        const grades = blocks
                            .filter(item => item.scoreInput.value !== '')
                            .map(item => ({
                                questionId: item.questionId,
                                score: Number(item.scoreInput.value),
                                feedback: item.feedbackInput.value.trim()
                            }));

                        if (!grades.length) {
                            toast('Chưa nhập điểm cho câu nào.', 'warning');
                            return;
                        }

                        const result = await adminApi.gradeBulk(attemptId, grades);
                        toast(result.message || 'Đã lưu điểm.');
                        await loadQueue();
                        if (!result.requiresManualGrading) panel.hidden = true;
                    } catch (error) {
                        toast(error.message || 'Không lưu được điểm.', 'error');
                    } finally {
                        event.target.disabled = false;
                    }
                }
            })
        );
    } catch (error) {
        render(panelBody, message(error.message || 'Không tải được bài làm.', 'error'));
    }
}
}
startAdminPage(async () => {
    render(gradeSelect,
        createElement('option', { text: 'Tất cả', attrs: { value: '' } }),
        ...Array.from({ length: 12 }, (_, index) => index + 1).map(grade => createElement('option', {
            text: `Lớp ${grade}`,
            attrs: { value: grade }
        }))
    );

    /** Nạp số liệu hàng đợi chấm. */
    async function loadStats() {
        try {
            const stats = await adminApi.getGradingStats();
            render(statsBox,
                createElement('p', { className: 'auto-score', text: `Còn ${formatNumber(stats.total || 0)} câu chờ chấm` })
            );
        } catch (error) {
            render(statsBox, message(error.message || 'Không tải được thống kê chấm.', 'error'));
        }
    }

    /** Nạp danh sách câu chờ chấm theo bộ lọc. */
    async function loadQueue() {
        notice('Đang tải…');
        try {
            const data = await adminApi.getPendingGrading({
                grade: gradeSelect.value || undefined,
                username: usernameInput.value.trim() || undefined,
                pageSize: 30
            });

            const items = data.items || [];
            if (!items.length) {
                notice('Không có câu nào đang chờ chấm.');
                return;
            }
            render(tbody, ...items.map(queueRow));
        } catch (error) {
            notice(error.message || 'Không tải được danh sách chờ chấm.', 'message message-error');
        }
    }

    document.getElementById('btn-search').addEventListener('click', loadQueue);
    gradeSelect.addEventListener('change', loadQueue);

    await loadStats();
    await loadQueue();
});