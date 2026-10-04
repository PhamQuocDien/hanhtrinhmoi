/**
 * TRANG DANH MỤC MÔN HỌC (quản trị).
 *
 * Đọc từ `data/subjects/subject-registry.js` qua API danh mục — không hardcode
 * danh sách môn ở trình duyệt.
 */

import { adminApi } from '../core/api.js';
import { createElement, render, verificationBadge } from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const tbody = document.getElementById('subjects-body');
const keywordInput = document.getElementById('keyword');

/** Gộp danh sách lớp thành chuỗi ngắn gọn. */
function formatGrades(grades) {
    const list = grades || [];
    if (!list.length) return '—';
    // Rút gọn dãy liên tiếp: 1,2,3,4,5,6,7,8,9 -> "Lớp 1–9".
    const sorted = [...list].sort((a, b) => a - b);
    const runs = [];
    let start = sorted[0];
    let previous = sorted[0];
    for (let index = 1; index <= sorted.length; index += 1) {
        if (sorted[index] === previous + 1) {
            previous = sorted[index];
            continue;
        }
        runs.push(start === previous ? `L${start}` : `L${start}–${previous}`);
        start = sorted[index];
        previous = sorted[index];
    }
    return runs.join(', ');
}

/** Nhãn loại môn: bắt buộc / lựa chọn / mạch nội dung. */
function subjectKind(subject) {
    if (subject.integratedSubject) return 'Môn tích hợp';
    if (subject.integratedInto) return `Mạch của ${subject.integratedInto}`;
    if (subject.status === 'required') return 'Bắt buộc';
    return 'Lựa chọn';
}

/** Một dòng của bảng môn học. */
function subjectRow(subject) {
    return createElement('tr', { children: [
        createElement('td', { text: subject.subjectId }),
        createElement('td', { children: [
            createElement('strong', { text: subject.displayName }),
            subject.displayName !== subject.officialName
                ? createElement('p', { className: 'small muted mb-0', text: `Tên chính thức: ${subject.officialName}` })
                : null
        ].filter(Boolean) }),
        createElement('td', { text: formatGrades(subject.grades) }),
        createElement('td', { text: subject.status }),
        createElement('td', { text: subjectKind(subject) }),
        createElement('td', { children: [verificationBadge(subject.verificationStatus)] })
    ] });
}

startAdminPage(async () => {
    const subjects = await adminApi.getCatalog().then(catalog => catalog.subjects || []);

    /** Vẽ bảng theo từ khoá. */
    function draw() {
        const needle = keywordInput.value.trim().toLowerCase();
        const rows = needle
            ? subjects.filter(subject => (
                subject.displayName.toLowerCase().includes(needle)
                || subject.subjectId.toLowerCase().includes(needle)
                || (subject.officialName || '').toLowerCase().includes(needle)
            ))
            : subjects;

        if (!rows.length) {
            render(tbody, createElement('tr', {
                children: [createElement('td', { className: 'muted', text: 'Không có môn khớp.', attrs: { colspan: 6 } })]
            }));
            return;
        }
        render(tbody, ...rows.map(subjectRow));
    }

    draw();
    keywordInput.addEventListener('input', draw);
});