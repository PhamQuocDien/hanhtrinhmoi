/**
 * KHỞI ĐỘNG TRANG QUẢN TRỊ.
 *
 * Mọi trang trong public/admin/ đều bắt đầu bằng hàm này:
 *   - kiểm tra phiên và VAI TRÒ admin trước khi vẽ bất cứ thứ gì;
 *   - dựng thanh trên cùng + thanh điều hướng dùng chung;
 *   - gắn sẵn hàm đăng xuất.
 *
 * Lưu ý: đây chỉ là tiện nghiệm phía trình duyệt. Quyền thật luôn do máy chủ
 * kiểm tra lại ở mọi endpoint /api/admin/*.
 */

import { authApi, requireUser } from '../core/api.js';
import { renderShell, ADMIN_MENU, message, render } from '../core/dom.js';

/**
 * Bọc logic của trang quản trị.
 * @param {(user: object) => Promise<void>} handler
 */
export function startAdminPage(handler) {
    document.addEventListener('DOMContentLoaded', async () => {
        const user = await requireUser({ role: 'admin' });
        if (!user) return;

        renderShell({
            user,
            menu: ADMIN_MENU,
            onLogout: async () => {
                await authApi.logout();
                window.location.href = '/auth/login.html';
            }
        });

        try {
            await handler(user);
        } catch (error) {
            const root = document.querySelector('.page');
            if (root) render(root, message(error.message || 'Có lỗi xảy ra.', 'error'));
        }
    });
}