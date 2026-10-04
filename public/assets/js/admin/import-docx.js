/**
 * TRANG NHẬP ĐỀ THI TỪ WORD (quản trị).
 *
 * Luồng: chọn lớp + môn -> tải .docx -> máy chủ đọc và nhận dạng -> xem lại kết
 * quả -> sửa câu sai dạng -> lưu nháp -> công bố.
 *
 * Trang KHÔNG tự đoán đáp án và không tự sửa nội dung giáo dục: những phần không
 * chắc chắn được máy chủ đánh dấu để người quản trị xem lại.
 */

import { adminApi, studentApi } from '../core/api.js';
import {
    createElement,
    render,
    message,
    questionTypeLabel,
    toast,
    formatDate,
    formatNumber
} from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file');
const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subjectId');
const uploadMessage = document.getElementById('upload-message');
const previewCard = document.getElementById('preview-card');
const previewStats = document.getElementById('preview-stats');
const previewList = document.getElementById('preview-list');
const publishMessage = document.getElementById('publish-message');

let currentJob = null;

/** Bảng thống kê số câu theo từng dạng sau khi đọc tệp. */
function renderPreviewSummary(job, questions) {
    const summary = job.parseSummary?.typeSummary || {};

    render(previewStats,
        createElement('p', {
            className: 'auto-score',
            text: `${formatNumber(job.questionCount)} câu · `
                + `${formatNumber(job.validCount)} hợp lệ · `
                + `${formatNumber(job.warningCount)} cảnh báo · `
                + `${formatNumber(job.errorCount)} lỗi`
        }),
        createElement('div', { className: 'row-actions', children: Object.entries(summary).map(([type, count]) => createElement('span', {
            className: 'badge',
            text: `${questionTypeLabel(type)}: ${count}`
        })) }),
        job.documentWarnings?.length
            ? createElement('div', { className: 'message message-warning', children: [
                createElement('strong', { text: 'Cảnh báo khi đọc tệp:' }),
                createElement('ul', { children: job.documentWarnings.slice(0, 10).map(warning => createElement('li', {
                    text: typeof warning === 'string' ? warning : (warning.message || JSON.stringify(warning))
                })) })
            ] })
            : null
    );
}

/** Một câu hỏi trong khung xem lại, kèm ô đổi dạng. */
function previewQuestionCard(question, index) {
    // Cho phép đổi dạng ngay tại đây: parser có thể nhận nhầm short_answer/essay.
    const typeSelect = createElement('select', { attrs: { 'aria-label': `Dạng câu ${index + 1}` } });
    for (const type of [
        'single_choice', 'multiple_choice', 'true_false',
        'fill_blank', 'short_answer', 'numeric', 'essay'
    ]) {
        typeSelect.append(createElement('option', {
            text: questionTypeLabel(type),
            attrs: { value: type, selected: type === question.type }
        }));
    }

    const card = createElement('article', { className: 'question-block', children: [
        createElement('div', { className: 'question-head', children: [
            createElement('span', { className: 'question-number', text: `Câu ${index + 1}` }),
            question.needsReview
                ? createElement('span', { className: 'badge badge-warning', text: 'Cần xem lại' })
                : createElement('span', { className: 'badge badge-success', text: 'Hợp lệ' })
        ] }),
        createElement('p', { className: 'question-text', text: question.questionText }),
        question.options?.length
            ? createElement('ul', { className: 'small muted', children: question.options.map(option => createElement('li', {
                text: `${option.label}. ${option.text}`
            })) })
            : null,
        question.blanks?.length
            ? createElement('p', { className: 'small muted', text: `Có ${question.blanks.length} ô điền khuyết.` })
            : null,
            question.warnings?.length || question.reviewNotes?.length
            ? createElement('ul', { className: 'small', children: (question.warnings || question.reviewNotes).map(warning => createElement('li', {
                text: typeof warning === 'string' ? warning : JSON.stringify(warning)
            })) })
            : null,
        createElement('label', { className: 'field', children: [
            createElement('span', { className: 'field-label', text: 'Dạng câu hỏi' }),
            typeSelect
        ] })
    ].filter(Boolean) });

    return { card, typeSelect, question };
}
/** Lịch sử các lần nhập gần đây. */
async function loadHistory() {
    const tbody = document.getElementById('history-body');
    try {
        const data = await adminApi.getImportJobs();
        const items = data.items || [];
        if (!items.length) {
            render(tbody, createElement('tr', {
                children: [createElement('td', { className: 'muted', text: 'Chưa có lần nhập nào.', attrs: { colspan: 5 } })]
            }));
            return;
        }
        render(tbody, ...items.map(job => createElement('tr', { children: [
            createElement('td', { text: job.fileName || job.title || '—' }),
            createElement('td', { text: job.status }),
            createElement('td', { text: formatNumber(job.questionCount) }),
            createElement('td', { text: formatNumber(job.warningCount) }),
            createElement('td', { text: formatDate(job.createdAt) })
        ] })));
    } catch (error) {
        render(tbody, createElement('tr', {
            children: [createElement('td', {
                className: 'message message-error',
                text: error.message || 'Không tải được lịch sử nhập.',
                attrs: { colspan: 5 }
            })]
        }));
    }
}

startAdminPage(async () => {
    const grades = await studentApi.getGrades();
    render(gradeSelect, ...grades.map(grade => createElement('option', {
        text: grade.gradeName || `Lớp ${grade.grade}`,
        attrs: { value: grade.grade }
    })));

    /** Nạp danh sách môn theo lớp. */
    async function loadSubjects() {
        const subjects = await studentApi.getSubjects(Number(gradeSelect.value));
        render(subjectSelect, ...subjects.map(subject => createElement('option', {
            text: subject.displayName,
            attrs: { value: subject.subjectId }
        })));
    }

    await loadSubjects();
    await loadHistory();

    gradeSelect.addEventListener('change', loadSubjects);

    // Gửi tệp lên kèm metadata bắt buộc.
    form.addEventListener('submit', async event => {
        event.preventDefault();
        render(uploadMessage);

        const file = fileInput.files?.[0];
        if (!file) {
            render(uploadMessage, message('Hãy chọn một tệp .docx.', 'error'));
            return;
        }

        const body = new FormData();
        body.append('file', file);
        body.append('grade', gradeSelect.value);
        body.append('subjectId', subjectSelect.value);
        body.append('durationMinutes', document.getElementById('durationMinutes').value || '45');
        const title = document.getElementById('examTitle').value.trim();
        if (title) body.append('examTitle', title);

        document.getElementById('btn-upload').disabled = true;
        try {
            const job = await adminApi.uploadDocx(body);
            currentJob = job;

            const detail = await adminApi.getImportJob(job.jobId);
            const questions = detail.questions || [];

            previewCard.hidden = false;
            renderPreviewSummary(detail, questions);
            render(previewList, createElement('div', { className: 'stack', children: [
                createElement('p', { className: 'small muted', text: `Mã lần nhập: ${job.jobId}` }),
                ...questions.map(previewQuestionCard)
            ] }));
            render(uploadMessage, message('Đã đọc xong tệp. Xem lại bên dưới trước khi lưu.', 'success'));
            loadHistory();
        } catch (error) {
            render(uploadMessage, message(error.message || 'Không đọc được tệp Word.', 'error'));
        } finally {
            document.getElementById('btn-upload').disabled = false;
        }
    });

    document.getElementById('btn-save-draft').addEventListener('click', async () => {
        if (!currentJob) return;
        try {
            const detail = await adminApi.getImportJob(currentJob.jobId);
            const questions = (detail.questions || []).map((question, index) => {
                const select = previewList.querySelectorAll('select')[index];
                return { ...question, type: select?.value || question.type };
            });
            await adminApi.saveImportJob(currentJob.jobId, questions);
            toast('Đã lưu nháp câu hỏi.');
        } catch (error) {
            toast(error.message || 'Không lưu được nháp.', 'error');
        }
    });

    document.getElementById('btn-publish').addEventListener('click', async () => {
        if (!currentJob) return;
        render(publishMessage, message('Đang công bố…', 'info'));
        try {
            const result = await adminApi.publishImportJob(currentJob.jobId);
            toast(result.message || 'Đã công bố đề thi.');
            render(publishMessage, message('Đã công bố đề thi.', 'success'));
        } catch (error) {
            render(publishMessage, message(error.message || 'Không công bố được đề.', 'error'));
        }
    });
});
