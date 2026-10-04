/**
 * TRANG TÀI KHOẢN.
 *
 * Chỉ hiển thị và cho đổi những gì tài khoản được phép. Vai trò, lớp và bộ sách
 * do máy chủ quyết định — trang này KHÔNG cho sửa role (đó là việc của quản
 * trị viên và phải qua máy chủ).
 */

import { authApi, requireUser, ApiError } from '../core/api.js';
import {
    createElement,
    render,
    message,
    renderShell,
    STUDENT_MENU,
    formatDate,
    toast
} from '../core/dom.js';

const profileBody = document.getElementById('profile-body');
const passwordForm = document.getElementById('password-form');
const passwordMessage = document.getElementById('password-message');

/** Các dòng thông tin của tài khoản. */
function renderProfile(user) {
    const rows = [
        ['Tên đăng nhập', user.username],
        ['Họ tên', user.fullName || '—'],
        ['Vai trò', user.role === 'admin' ? 'Quản trị viên' : 'Học sinh'],
        ['Lớp', user.grade ? `Lớp ${user.grade}` : 'Chưa cập nhật'],
        ['Bộ sách', user.bookSeriesId || '—'],
        ['Trường', user.schoolName || '—'],
        ['Chuỗi đăng nhập', `${user.loginStreak || 0} ngày`],
        ['Đăng nhập gần nhất', user.lastLoginAt ? formatDate(user.lastLoginAt) : '—']
    ];

    render(profileBody, ...rows.map(([label, value]) => createElement('tr', { children: [
        createElement('th', { text: label, attrs: { scope: 'row' } }),
        createElement('td', { text: String(value) })
    ] })));
}

/** Gửi yêu cầu đổi mật khẩu. */
async function handlePasswordSubmit(event) {
    event.preventDefault();
    render(passwordMessage);

    const currentPassword = passwordForm.currentPassword.value;
    const newPassword = passwordForm.newPassword.value;

    if (newPassword.length < 6) {
        render(passwordMessage, message('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error'));
        return;
    }

    try {
        await authApi.changePassword(currentPassword, newPassword);
        render(passwordMessage, message('Đã đổi mật khẩu thành công.', 'success'));
        passwordForm.reset();
        toast('Đổi mật khẩu thành công.');
    } catch (error) {
        const text = error instanceof ApiError ? error.message : 'Không đổi được mật khẩu.';
        render(passwordMessage, message(text, 'error'));
    }
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

    renderProfile(user);
    passwordForm.addEventListener('submit', handlePasswordSubmit);
});