/**
 * THẺ CHỌN — dựng giao diện cho từng bước trong luồng chọn chương trình.
 *
 * Tách khỏi `CurriculumPicker` để tệp điều phối chỉ lo điều hướng luồng, còn tệp
 * này lo về hình dạng thẻ. Nhờ vậy thêm bước mới không phải sửa tệp lớn.
 */

import { createElement, formatNumber } from '../core/dom.js';
import { verificationBadge } from './ui-states.js';

/**
 * Nhóm môn học theo loại (bắt buộc / tự chọn / lựa chọn).
 *
 * Nhóm lấy từ `statusLabel` của dữ liệu, không hard-code danh sách môn.
 *
 * @param {Array} subjects danh sách môn
 * @returns {Map<string, Array>} nhãn nhóm → các môn
 */
export function groupSubjectsByStatus(subjects) {
    const groups = new Map();
    for (const subject of subjects) {
        const key = subject.statusLabel || 'Môn khác';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(subject);
    }
    return groups;
}

/** Thẻ một môn học. */
export function subjectCard(subject, onSelect) {
    return createElement('button', {
        className: 'pick-card',
        attrs: { type: 'button' },
        onClick: () => onSelect(subject),
        children: [
            createElement('span', { className: 'pick-card-title', children: [
                subject.icon ? createElement('span', { attrs: { 'aria-hidden': 'true' }, text: subject.icon }) : null,
                createElement('span', { text: subject.displayName || subject.officialName })
            ].filter(Boolean) }),
            createElement('span', {
                className: 'pick-card-desc',
                text: `${formatNumber(subject.chapterCount)} chương · ${formatNumber(subject.lessonCount)} bài`
            }),
            // Môn tích hợp (Khoa học tự nhiên) có các mạch nội dung bên trong.
            subject.integratedSubject && subject.learningTracks?.length
                ? createElement('span', {
                    className: 'pick-card-desc',
                    text: `Gồm: ${subject.learningTracks.map(track => track.displayName).join(', ')}`
                })
                : null,
            createElement('span', { className: 'pick-card-foot', children: [
                createElement('span', {
                    className: `badge badge-${subject.status === 'required' ? 'brand' : 'neutral'}`,
                    text: subject.statusLabel || subject.status
                }),
                subject.needsLessonImport
                    ? createElement('span', { className: 'badge badge-warning', text: 'Chưa đủ nội dung' })
                    : null
            ].filter(Boolean) })
        ].filter(Boolean)
    });
}

/**
 * Thẻ một bộ sách.
 *
 * Bộ sách chưa có đầu sách thì khoá lại để không dẫn người học tới trang trống,
 * nhưng vẫn hiện kèm nhãn để họ biết bộ sách đó có trong hệ thống.
 */
export function seriesCard(series, onSelect) {
    const usable = series.textbookCount > 0;
    return createElement('button', {
        className: 'pick-card',
        attrs: { type: 'button', disabled: !usable },
        onClick: () => usable && onSelect(series),
        children: [
            createElement('span', { className: 'pick-card-title', text: series.seriesName }),
            series.publisher
                ? createElement('span', { className: 'pick-card-desc', text: `Nhà xuất bản: ${series.publisher}` })
                : null,
            createElement('span', { className: 'pick-card-foot', children: [
                series.isDefault ? createElement('span', { className: 'badge badge-brand', text: 'Bộ mặc định' }) : null,
                usable
                    ? createElement('span', { className: 'badge badge-success', text: `${series.textbookCount} đầu sách` })
                    : createElement('span', { className: 'badge badge-warning', text: 'Chưa có đầu sách' }),
                verificationBadge(series.verificationStatus)
            ].filter(Boolean) })
        ].filter(Boolean)
    });
}
/** Thẻ một đầu sách trong bộ sách đã chọn. */
export function textbookCard(book, series, onSelect) {
    return createElement('button', {
        className: 'pick-card',
        attrs: { type: 'button' },
        onClick: () => onSelect(book),
        children: [
            createElement('span', { className: 'pick-card-title', text: book.officialTitle }),
            createElement('span', { className: 'pick-card-desc', text: `Thuộc bộ: ${series.seriesName}` }),
            createElement('span', { className: 'pick-card-foot', children: [
                createElement('span', {
                    className: 'badge badge-neutral',
                    text: book.publisher || 'Chưa rõ nhà xuất bản'
                }),
                verificationBadge(book.verificationStatus)
            ] })
        ]
    });
}

/** Thẻ một chương. */
export function chapterCard(chapter, onSelect) {
    return createElement('button', {
        className: 'pick-card',
        attrs: { type: 'button' },
        onClick: () => onSelect(chapter),
        children: [
            createElement('span', { className: 'pick-card-title', text: chapter.displayTitle }),
            createElement('span', { className: 'pick-card-desc', text: `${formatNumber(chapter.lessonCount)} bài học` }),
            createElement('span', { className: 'pick-card-foot', children: [
                verificationBadge(chapter.verificationStatus)
            ] })
        ]
    });
}

/**
 * Thẻ một bài học, liên kết sang trang bài học.
 *
 * Giữ nguyên lớp/môn/bộ sách trên URL để người học quay lại đúng chỗ.
 */
export function lessonCard(lesson, href) {
    return createElement('a', {
        className: 'list-card',
        href,
        children: [
            createElement('span', {
                className: 'list-card-index',
                attrs: { 'aria-hidden': 'true' },
                text: lesson.lessonNumber
            }),
            createElement('span', { children: [
                createElement('span', { className: 'list-card-title', text: lesson.displayTitle }),
                createElement('span', {
                    className: 'list-card-meta',
                    text: [
                        lesson.estimatedMinutes ? `${lesson.estimatedMinutes} phút` : null,
                        lesson.hasContent ? 'Đã có nội dung' : 'Chưa có nội dung'
                    ].filter(Boolean).join(' · ')
                })
            ] })
        ]
    });
}