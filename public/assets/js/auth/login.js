/**
 * TRANG ĐĂNG NHẬP.
 *
 * Trách nhiệm:
 *   - Gửi tên đăng nhập + mật khẩu lên máy chủ (không tự kiểm tra đúng/sai ở client).
 *   - Hiển thị thông báo lỗi bằng tiếng Việt, không lộ thêm thông tin nào.
 *   - Điều hướng về trang theo vai trò, hoặc về `next` nếu người dùng đến từ
 *     một trang cụ thể.
 */

import { authApi, ApiError, homePathFor, currentUser } from '../core/api.js';
import { render, message, toast, queryParam } from '../core/dom.js';

const form = document.getElementById('login-form');
const messageBox = document.getElementById('form-message');
const submitButton = document.getElementById('btn-submit');

/** Chỉ nhận đường dẫn nội bộ để tránh chuyển hướng ra ngoài. */
function safeNextPath() {
    const next = queryParam('next');
    // Chỉ nhận đường dẫn bắt đầu bằng "/" và không phải "//" (tránh open redirect).
    if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
    return next;
}

/** Nếu đã đăng nhập thì không cần hiện form đăng nhập nữa. */
async function redirectIfLoggedIn() {
    const user = await currentUser();
    if (!user) return false;
    window.location.href = safeNextPath() || homePathFor(user.role);
    return true;
}

/** Gửi biểu mẫu đăng nhập. */
async function handleSubmit(event) {
    event.preventDefault();
    render(messageBox);

    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
        render(messageBox, message('Vui lòng nhập tên đăng nhập và mật khẩu.', 'error'));
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Đang đăng nhập…';

    try {
        const user = await authApi.login(username, password);
        toast(`Xin chào, ${user.username}!`);
        window.location.href = safeNextPath() || homePathFor(user.role);
    } catch (error) {
        // Sai tên và sai mật khẩu trả về cùng một thông báo từ máy chủ — giữ nguyên.
        const text = error instanceof ApiError ? error.message : 'Không đăng nhập được. Vui lòng thử lại.';
        render(messageBox, message(text, 'error'));
        submitButton.disabled = false;
        submitButton.textContent = 'Đăng nhập';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (await redirectIfLoggedIn()) return;
    form.addEventListener('submit', handleSubmit);
    form.username.focus();
});