/**
 * BỘ CHỌN LỚP — dựng lưới thẻ lớp 1–12.
 *
 * Tách riêng khỏi `CurriculumPicker` vì đây là bước đầu tiên và được dùng ở
 * nhiều trang (trang chủ, trang chương trình, trang quản trị).
 */

import { createElement, render, formatNumber } from '../core/dom.js';
import { emptyState, errorState, skeletonGrid } from './ui-states.js';

/**
 * Dựng lưới thẻ lớp.
 *
 * Mỗi thẻ là một nút `<button>` thật nên bấm được bằng bàn phím và có nhãn đọc
 * bằng trình đọc màn hình.
 *
 * @param {HTMLElement} host phần tử chứa
 * @param {Function} loader hàm async trả về danh sách lớp
 * @param {Function} onSelect hàm nhận đối tượng lớp khi người dùng chọn
 */
export async function renderGradePicker(host, loader, onSelect) {
    host.setAttribute('aria-busy', 'true');
    render(host, skeletonGrid(12));

    try {
        const grades = await loader();
        host.setAttribute('aria-busy', 'false');

        if (!grades?.length) {
            render(host, emptyState('Chưa có dữ liệu lớp học',
                'Chưa có dữ liệu chương trình. Vui lòng thử lại sau.'));
            return;
        }

        render(host, createElement('div', { className: 'grid', children: grades.map(grade => (
            createElement('button', {
                className: 'grade-card',
                attrs: {
                    type: 'button',
                    'aria-label': `Lớp ${grade.grade}, ${grade.educationLevelName || ''}`.trim()
                },
                onClick: () => onSelect(grade),
                children: [
                    createElement('span', { className: 'grade-number', text: grade.grade }),
                    createElement('span', { className: 'grade-name', text: grade.gradeName || `Lớp ${grade.grade}` }),
                    // Tên cấp học lấy từ dữ liệu, không hard-code theo số lớp.
                    createElement('span', { className: 'grade-level', text: grade.educationLevelName || '' }),
                    createElement('span', {
                        className: 'grade-meta',
                        text: [
                            `${formatNumber(grade.subjectCount)} môn`,
                            `${formatNumber(grade.lessonCount)} bài`,
                            grade.seriesCount ? `${grade.seriesCount} bộ sách` : null
                        ].filter(Boolean).join(' · ')
                    })
                ]
            })
        )) }));
    } catch (error) {
        host.setAttribute('aria-busy', 'false');
        render(host, errorState('Không thể tải danh sách lớp. Vui lòng thử lại.', () => {
            renderGradePicker(host, loader, onSelect);
        }));
    }
}

/**
 * Tiêu đề bước chọn lớp.
 *
 * @param {number} [count] số lớp nếu đã biết
 */
export function gradePickerHeading(count = null) {
    return createElement('div', { className: 'picker-header', children: [
        createElement('h2', { className: 'picker-title', text: 'Chọn lớp học' }),
        createElement('p', {
            className: 'picker-subtext',
            text: count
                ? `Chọn lớp để xem ${count} môn học và nội dung học tập tương ứng.`
                : 'Chọn lớp để xem các môn học và nội dung học tập tương ứng.'
        })
    ] });
}

export default renderGradePicker;