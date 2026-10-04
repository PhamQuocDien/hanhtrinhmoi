/**
 * TRANG HỌC SINH (quản trị).
 *
 * Xem danh sách tài khoản học sinh, lọc theo lớp và tìm theo tên.
 * Trang này chỉ ĐỌC: khoá/mở khoá hay đổi vai trò là thao tác nhạy cảm nên
 * không gộp vào bảng xem nhanh.
 */

import { adminApi } from '../core/api.js';
import { createElement, render, message, formatDate } from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const tbody = document.getElementById('students-body');
const gradeSelect = document.getElementById('grade');
const keywordInput = document.getElementById('keyword');

/** Một dòng của bảng học sinh. */
function studentRow(item) {
    return createElement('tr', { children: [
        createElement('td', { children: [
            createElement('strong', { text: item.username }),
            item.fullName ? createElement('p', { className: 'small muted mb-0', text: item.fullName }) : null,
            item.isSuspended
                ? createElement('span', { className: 'badge badge-danger', text: 'Đã khoá' })
                : null
        ].filter(Boolean) }),
        createElement('td', { text: item.grade ? `Lớp ${item.grade}` : '—' }),
        createElement('td', { text: item.bookSeriesId || '—' }),
        createElement('td', { text: `${item.loginStreak || 0} ngày` }),
        createElement('td', { text: item.lastLoginAt ? formatDate(item.lastLoginAt) : 'Chưa đăng nhập' })
    ] });
}

/** Thay nội dung bảng khi có lỗi hoặc không có dữ liệu. */
function renderNotice(text, variant = 'muted') {
    render(tbody, createElement('tr', {
        children: [createElement('td', {
            className: variant,
            text,
            attrs: { colspan: 5 }
        })]
    }));
}

startAdminPage(async () => {
    const tree = await adminApi.getCurriculumTree();
    render(gradeSelect,
        createElement('option', { text: 'Tất cả lớp', attrs: { value: '' } }),
        ...(tree.grades || []).map(grade => createElement('option', {
            text: grade.gradeName || `Lớp ${grade.grade}`,
            attrs: { value: grade.grade }
        }))
    );

    /** Nạp danh sách học sinh theo bộ lọc hiện tại. */
    async function load() {
        renderNotice('Đang tải…');
        try {
            const data = await adminApi.getStudents({
                grade: gradeSelect.value || undefined,
                keyword: keywordInput.value.trim() || undefined,
                pageSize: 50
            });
            const items = data.items || [];
            if (!items.length) {
                renderNotice('Không có học sinh nào khớp bộ lọc.');
                return;
            }
            render(tbody, ...items.map(studentRow));
        } catch (error) {
            renderNotice(error.message || 'Không tải được danh sách học sinh.', 'message message-error');
        }
    }

    await load();

    gradeSelect.addEventListener('change', load);
    // Chỉ tìm khi người dùng ngừng gõ, tránh gọi API liên tục mỗi ký tự.
    keywordInput.addEventListener('input', () => {
        clearTimeout(keywordInput._timer);
        keywordInput._timer = setTimeout(load, 350);
    });
});