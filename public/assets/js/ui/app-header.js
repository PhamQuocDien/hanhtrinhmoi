/**
 * HEADER ỨNG DỤNG — logo, menu điều hướng và khu vực tài khoản.
 *
 * Menu được sinh từ cấu hình `NAV_ITEMS` chứ không viết cứng trong HTML, nên thêm
 * một mục mới chỉ cần sửa mảng này. Trạng thái đăng nhập quyết định hiển thị nút
 * "Đăng nhập/Đăng ký" hay avatar học sinh.
 */

import { createElement, render } from '../core/dom.js';
import { currentUser, AUTH_PATHS, homePathFor } from '../core/api.js';

/** Các mục menu cho người đã đăng nhập. */
export const NAV_ITEMS = Object.freeze([
    { label: 'Trang chủ', href: '/index.html' },
    { label: 'Học tập', href: '/student/curriculum.html' },
    { label: 'Bài học', href: '/student/dashboard.html' },
    { label: 'Luyện tập', href: '/student/practice.html' },
    { label: 'Bài kiểm tra', href: '/student/exams.html' },
    { label: 'Kết quả', href: '/student/result.html' },
    { label: 'Tiến độ', href: '/student/progress.html' }
]);

/** Các mục menu cho quản trị viên. */
const ADMIN_NAV_ITEMS = Object.freeze([
    { label: 'Trang chủ', href: '/admin/dashboard.html' },
    { label: 'Học sinh', href: '/admin/students.html' },
    { label: 'Chương trình', href: '/admin/curriculum.html' },
    { label: 'Ngân hàng câu hỏi', href: '/admin/question-bank.html' },
    { label: 'Đề thi', href: '/admin/exams.html' },
    { label: 'Chấm bài', href: '/admin/grading.html' },
    { label: 'Nhập từ Word', href: '/admin/import-docx.html' },
    { label: 'Nhật ký', href: '/admin/audit-log.html' }
]);

/**
 * Dựng phần tử `<li>` cho một mục menu, đánh dấu trang đang mở.
 *
 * @param {object} item mục menu
 * @param {string} pathname đường dẫn hiện tại
 */
function navItem(item, pathname) {
    const isCurrent = item.href === pathname;
    return createElement('li', { children: [
        createElement('a', {
            className: 'app-nav-link',
            text: item.label,
            href: item.href,
            // `aria-current` giúp trình đọc màn hình biết đang ở trang nào.
            attrs: isCurrent ? { 'aria-current': 'page' } : undefined
        })
    ] });
}

/**
 * Dựng menu điều hướng cho người dùng hiện tại.
 *
 * @param {HTMLElement} host phần tử chứa
 * @param {object} user thông tin người dùng hoặc null
 * @param {string} pathname đường dẫn hiện tại
 */
export function renderNav(host, user, pathname) {
    const items = user?.role === 'admin' ? ADMIN_NAV_ITEMS : NAV_ITEMS;
    render(host, createElement('ul', {
        className: 'app-nav-list',
        children: items.map(item => navItem(item, pathname))
    }));
}

/**
 * Dựng khu vực tài khoản ở góc phải.
 *
 * @param {HTMLElement} host phần tử chứa
 * @param {object} user thông tin người dùng hoặc null
 */
export async function renderUserActions(host, user) {
    if (!user) {
        render(host,
            createElement('a', { className: 'btn btn-secondary', text: 'Đăng nhập', href: AUTH_PATHS.login }),
            createElement('a', { className: 'btn btn-primary', text: 'Đăng ký', href: AUTH_PATHS.register }));
        return;
    }

    // Chữ cái đầu làm avatar; không cần ảnh thật nên trang tải nhanh.
    const initial = (user.displayName || user.username || '?').trim().charAt(0).toUpperCase();

    render(host, createElement('div', { className: 'user-chip', children: [
        createElement('a', {
            className: 'user-avatar',
            href: homePathFor(user.role),
            text: initial,
            attrs: { 'aria-label': `Tài khoản ${user.displayName || user.username}` }
        }),
        createElement('a', { className: 'user-name', text: user.displayName || user.username, href: '/student/profile.html' }),
        createElement('a', { className: 'btn btn-ghost', text: 'Đăng xuất', href: AUTH_PATHS.logout })
    ] }));
}

/**
 * Gắn nút hamburger để mở/đóng menu trên màn hình hẹp.
 *
 * Dùng `aria-expanded` để trình đọc màn hình biết menu đang mở hay đóng.
 *
 * @param {HTMLElement} toggle nút hamburger
 * @param {HTMLElement} nav phần tử menu
 */
export function bindNavToggle(toggle, nav) {
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        toggle.setAttribute('aria-label', open ? 'Mở menu điều hướng' : 'Đóng menu điều hướng');
        nav.classList.toggle('is-open', !open);
    });

    // Đóng menu khi bấm ra ngoài hoặc nhấn Esc — trải nghiệm mobile quen thuộc.
    document.addEventListener('click', event => {
        if (nav.classList.contains('is-open')
            && !nav.contains(event.target)
            && !toggle.contains(event.target)) {
            nav.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && nav.classList.contains('is-open')) {
            nav.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.focus();
        }
    });
}

/**
 * Khởi tạo header cho một trang bất kỳ.
 *
 * @returns {Promise<object|null>} thông tin người dùng để trang dùng tiếp
 */
export async function initHeader() {
    const nav = document.getElementById('app-nav');
    const actions = document.getElementById('home-actions');
    const toggle = document.getElementById('nav-toggle');

    const user = await currentUser();
    renderNav(nav, user, window.location.pathname);
    await renderUserActions(actions, user);
    bindNavToggle(toggle, nav);
    return user;
}