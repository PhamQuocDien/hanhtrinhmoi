/**
 * TRANG MỐC ĐÁNH GIÁ — xem điều kiện làm checkpoint / giữa kỳ / cuối kỳ.
 *
 * Trang này CHỈ hiển thị. Việc quyết định mở đề luôn do máy chủ kiểm tra lại khi
 * học sinh bấm làm bài, nên sửa JavaScript ở đây không thể mở khóa đề.
 */

import { createElement, render } from '../core/dom.js';
import { initHeader } from '../ui/app-header.js';
import {
    emptyState,
    errorState,
    loadingText,
    notice,
    verificationBadge
} from '../ui/ui-states.js';
import { studentApi } from '../core/api.js';

const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subject');
const policyNote = document.getElementById('policy-note');
const panel = document.getElementById('milestone-panel');

/** Nhãn tiếng Việt cho từng loại mốc. */
const MILESTONE_LABELS = {
    checkpoint: 'Bài kiểm tra checkpoint',
    midterm: 'Kiểm tra giữa kỳ',
    final: 'Kiểm tra cuối kỳ'
};

/**
 * Thẻ hiển thị một mốc: đã đủ điều kiện chưa, còn thiếu bao nhiêu bài, căn cứ.
 *
 * @param {object} milestone dữ liệu mốc từ API
 * @returns {HTMLElement}
 */
function milestoneCard(milestone) {
    const title = MILESTONE_LABELS[milestone.assessmentType] || milestone.assessmentType;

    // Chưa có phạm vi bài học thì nói rõ, khác với "học chưa đủ".
    const status = !milestone.hasScope
        ? { text: 'Chưa có dữ liệu bài học cho môn này', variant: 'neutral' }
        : milestone.eligible
            ? { text: 'Đã đủ điều kiện', variant: 'success' }
            : { text: 'Chưa đủ điều kiện', variant: 'warning' };

    return createElement('section', { className: 'card milestone-card', children: [
        createElement('div', { className: 'milestone-head', children: [
            createElement('h3', { className: 'card-title', text: title }),
            createElement('span', { className: `badge badge-${status.variant}`, text: status.text })
        ] }),

        // Thanh phạm vi đã học.
        createElement('div', {
            className: 'progress-track',
            attrs: {
                role: 'progressbar',
                'aria-valuenow': String(milestone.coveragePercent),
                'aria-valuemin': '0',
                'aria-valuemax': '100',
                'aria-label': `Phạm vi đã học: ${milestone.coveragePercent}%`
            },
            children: [createElement('div', {
                className: 'progress-fill',
                attrs: { style: `width:${milestone.coveragePercent}%` }
            })]
        }),
        createElement('p', {
            className: 'muted small',
            text: `Đã học ${milestone.completedLessons}/${milestone.totalLessons} bài · `
                + `phạm vi ${milestone.coveragePercent}%`
        }),

        milestone.hasScope && !milestone.eligible
            ? createElement('p', {
                className: 'muted small',
                text: `Cần đủ ${milestone.requiredLessons} bài và `
                    + `${milestone.requiredCoveragePercent}% phạm vi. `
                    + `Còn thiếu ${milestone.remainingLessons} bài.`
            })
            : null,

        // Nói rõ ngưỡng này lấy từ đâu — không gọi nhầm là quy định của Bộ.
        createElement('div', { className: 'pick-card-foot', children: [
            createElement('span', {
                className: 'badge badge-neutral',
                text: milestone.isOfficialRegulation
                    ? 'Theo văn bản quy phạm pháp luật'
                    : 'Mặc định của nền tảng'
            }),
            verificationBadge(milestone.verificationStatus)
        ] })
    ].filter(Boolean) });
}

/** Tải và hiển thị ba mốc của môn đang chọn. */
async function loadMilestones() {
    const grade = gradeSelect.value;
    const subjectId = subjectSelect.value;
    if (!grade || !subjectId) return;

    panel.setAttribute('aria-busy', 'true');
    render(panel, loadingText());

    try {
        const result = await studentApi.getMilestones(grade, subjectId);

        render(policyNote, notice(
            `Điều kiện này lấy theo: ${result.sourceLabel}. `
            + 'Mốc kiểm tra chỉ mở khi máy chủ xác nhận bạn đã học đủ phạm vi bài học.',
            'info'
        ));

        render(panel, createElement('div', { className: 'grid-3', children: [
            milestoneCard(result.checkpoint),
            milestoneCard(result.midterm),
            milestoneCard(result.final)
        ] }));
    } catch (error) {
        render(panel, errorState(
            'Không thể tải trạng thái mốc đánh giá. Vui lòng thử lại.',
            loadMilestones
        ));
    } finally {
        panel.setAttribute('aria-busy', 'false');
    }
}

/** Nạp danh sách môn của lớp đang chọn. */
async function loadSubjects() {
    const grade = gradeSelect.value;
    render(subjectSelect, createElement('option', { text: 'Đang tải…', attrs: { disabled: true } }));
    if (!grade) return;

    try {
        const subjects = await studentApi.getSubjects(grade);
        render(subjectSelect,
            createElement('option', { text: '— Chọn môn học —', attrs: { value: '' } }),
            ...subjects.map(subject => createElement('option', {
                text: `${subject.displayName} (${subject.lessonCount} bài)`,
                attrs: { value: subject.subjectId }
            })));
    } catch (error) {
        render(subjectSelect, createElement('option', {
            text: 'Không tải được danh sách môn',
            attrs: { disabled: true }
        }));
    }
}

/** Nạp mốc cho môn đầu tiên, hoặc báo rỗng nếu môn không có bài học. */
async function selectFirstSubjectAndLoad() {
    await loadSubjects();
    if (subjectSelect.options.length > 1) {
        subjectSelect.value = subjectSelect.options[1].value;
        loadMilestones();
        return;
    }
    render(panel, emptyState('Chưa có môn học', 'Hãy chọn lớp khác hoặc thử lại sau.'));
}

/** Gắn sự kiện cho các ô chọn. */
function bindControls() {
    gradeSelect.addEventListener('change', selectFirstSubjectAndLoad);
    subjectSelect.addEventListener('change', loadMilestones);
}

/**
 * Khởi tạo trang.
 *
 * @returns {Promise<void>}
 */
async function main() {
    await initHeader();

    bindControls();

    try {
        const grades = await studentApi.getGrades();
        render(gradeSelect, ...grades.map(grade => createElement('option', {
            text: `${grade.gradeName} · ${grade.educationLevelName}`,
            attrs: { value: grade.grade }
        })));
    } catch (error) {
        render(gradeSelect, createElement('option', {
            text: 'Không tải được danh sách lớp',
            attrs: { disabled: true }
        }));
        return;
    }

    await selectFirstSubjectAndLoad();
}

main();
