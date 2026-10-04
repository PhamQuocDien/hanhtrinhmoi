/**
 * TRANG ĐĂNG KÝ.
 *
 * Trách nhiệm:
 *   - Nạp danh sách 12 lớp từ máy chủ để người dùng chọn, không hardcode ở client.
 *   - Kiểm tra khớp hai ô mật khẩu (kiểm tra tiện nghiệm; máy chủ vẫn kiểm tra lại).
 *   - Gọi /api/auth/register. Tài khoản tạo ra LUÔN là học sinh — client không
 *     gửi role, và máy chủ cũng không nhận role từ client.
 */

import { authApi, ApiError, studentApi, AUTH_PATHS } from '../core/api.js';
import { createElement, render, message } from '../core/dom.js';

const form = document.getElementById('register-form');
const messageBox = document.getElementById('form-message');
const submitButton = document.getElementById('btn-submit');
const gradeSelect = document.getElementById('grade');

/** Đổ danh sách lớp 1–12 vào ô chọn. */
function fillGrades(grades) {
    const options = grades.map(grade => createElement('option', {
        text: `${grade.gradeName || `Lớp ${grade.grade}`} (${grade.subjectCount} môn)`,
        attrs: { value: grade.grade }
    }));
    render(gradeSelect, createElement('option', { text: '— Chọn lớp —', attrs: { value: '' } }), ...options);
}

/** Gửi biểu mẫu đăng ký. */
async function handleSubmit(event) {
    event.preventDefault();
    render(messageBox);

    const username = form.username.value.trim();
    const grade = Number(gradeSelect.value);
    const password = form.password.value;
    const confirm = form.confirm.value;

    if (username.length < 3) {
        render(messageBox, message('Tên đăng nhập phải có ít nhất 3 ký tự.', 'error'));
        return;
    }
    if (!grade) {
        render(messageBox, message('Vui lòng chọn lớp đang học.', 'error'));
        return;
    }
    if (password.length < 6) {
        render(messageBox, message('Mật khẩu phải có ít nhất 6 ký tự.', 'error'));
        return;
    }
    if (password !== confirm) {
        render(messageBox, message('Hai ô mật khẩu không khớp.', 'error'));
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Đang đăng ký…';

    try {
        await authApi.register(username, password, grade);
        // Đăng ký xong chưa có phiên -> chuyển sang đăng nhập với tên đã điền sẵn.
        window.location.href = `${AUTH_PATHS.login}?registered=1&username=${encodeURIComponent(username)}`;
    } catch (error) {
        const text = error instanceof ApiError ? error.message : 'Không đăng ký được. Vui lòng thử lại.';
        render(messageBox, message(text, 'error'));
        submitButton.disabled = false;
        submitButton.textContent = 'Đăng ký';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    form.addEventListener('submit', handleSubmit);

    try {
        fillGrades(await studentApi.getGrades());
    } catch {
        // Không tải được danh sách lớp thì vẫn cho đăng ký, máy chủ sẽ báo lỗi cụ thể.
        render(messageBox, message('Không tải được danh sách lớp. Vui lòng tải lại trang.', 'warning'));
        gradeSelect.disabled = true;
    }
});