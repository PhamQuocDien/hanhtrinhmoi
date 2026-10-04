/**
 * TIỆN ÍCH DOM — hàm nhỏ để mã giao diện không lặp lại thao tác tạo phần tử.
 *
 * Mọi nội dung do người dùng nhập đều đi qua `textContent`, KHÔNG dùng
 * `innerHTML`, để nội dung câu hỏi và bài luận không thể trở thành mã chạy.
 */

/** Tạo phần tử với thuộc tính và nội dung con tùy ý. */
export function createElement(tag, { className, text, attrs, children, onClick } = {}) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === false || value === undefined || value === null) continue;
        element.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children || []) {
        if (child) element.append(child);
    }
    if (onClick) element.addEventListener('click', onClick);
    return element;
}

/** Xoá sạch nội dung một phần tử. */
export function clear(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
    return element;
}

/** Gán nội dung mới, thay thế toàn bộ con cũ. */
export function render(element, ...children) {
    clear(element);
    element.append(...children.filter(Boolean));
    return element;
}

/** Tạo nút. */
export function button(label, { className = 'btn', onClick, type = 'button', disabled = false } = {}) {
    const element = createElement('button', { className, text: label, attrs: { type, disabled } });
    if (onClick) element.addEventListener('click', onClick);
    return element;
}

/** Tạo ô nhập liệu có nhãn. */
export function field(labelText, input, { hint = '' } = {}) {
    return createElement('label', { className: 'field', children: [
        createElement('span', { className: 'field-label', text: labelText }),
        input,
        hint ? createElement('span', { className: 'field-hint', text: hint }) : null
    ].filter(Boolean) });
}

/** Tạo thông báo trạng thái. */
export function message(text, variant = 'info') {
    return createElement('p', { className: `message message-${variant}`, text });
}

/** Tạo thẻ (card) có tiêu đề. */
export function card(title, content, { className = '' } = {}) {
    return createElement('section', { className: `card ${className}`.trim(), children: [
        title ? createElement('h2', { className: 'card-title', text: title }) : null,
        content
    ].filter(Boolean) });
}

/** Định dạng số kiểu Việt Nam, bỏ phần thập phân dư thừa. */
export function formatNumber(value, maximumFractionDigits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0';
    return number.toLocaleString('vi-VN', { maximumFractionDigits });
}

/** Định dạng điểm "8.5/10" hoặc "Đang chờ chấm". */
export function formatScore(score, totalPoints, { pending = false } = {}) {
    if (pending) return 'Đang chờ chấm';
    if (!Number.isFinite(Number(score))) return '—';
    return `${formatNumber(score)}/${formatNumber(totalPoints)}`;
}

/** Định dạng thời gian "3 phút 20 giây" hoặc "45 giây". */
export function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    if (!minutes) return `${rest} giây`;
    return `${minutes} phút ${rest} giây`;
}

/** Định dạng thời gian đếm ngược "mm:ss". */
export function formatCountdown(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** Định dạng ngày theo tiếng Việt. */
export function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/** Nhãn tiếng Việt của từng loại câu hỏi (khớp với server). */
export const QUESTION_TYPE_LABELS = Object.freeze({
    single_choice: 'Trắc nghiệm một đáp án',
    multiple_choice: 'Trắc nghiệm nhiều đáp án',
    true_false: 'Đúng / Sai',
    fill_blank: 'Điền khuyết',
    short_answer: 'Trả lời ngắn',
    numeric: 'Câu số',
    essay: 'Tự luận'
});

/** Lấy nhãn loại câu, có dự phòng cho loại lạ. */
export function questionTypeLabel(type) {
    return QUESTION_TYPE_LABELS[type] || type || 'Không rõ';
}

/** Ghi thông báo ngắn lên góc màn hình, tự ẩn sau vài giây. */
export function toast(text, variant = 'info') {
    const element = createElement('div', {
        className: `toast${variant === 'info' ? '' : ` toast-${variant}`}`,
        text,
        attrs: { role: 'status' }
    });
    document.body.append(element);
    setTimeout(() => element.remove(), 2600);
    return element;
}

/** Đọc tham số truy vấn của trang. */
export function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

/** Dựng thẻ tiến độ từ phần trăm (0-100). */
export function progressBar(percent, { label = '' } = {}) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    // Dùng thuộc tính role để trình đọc màn hình đọc được mức độ hoàn thành.
    const fill = createElement('div', {
        className: `progress-fill${value >= 100 ? ' done' : (value < 34 ? ' low' : '')}`,
        attrs: { style: `width:${value}%`, role: 'progressbar', 'aria-valuenow': value, 'aria-valuemin': 0, 'aria-valuemax': 100 }
    });
    return createElement('div', { className: 'progress-block', children: [
        createElement('div', {
            className: 'progress-bar',
            children: [fill]
        }),
        label ? createElement('p', { className: 'small muted mb-0', text: label }) : null
    ].filter(Boolean) });
}

/** Nhãn trạng thái xác minh của dữ liệu chương trình. */
export const VERIFICATION_LABELS = Object.freeze({
    VERIFIED: 'Đã đối chiếu',
    NEEDS_VERIFICATION: 'Chờ đối chiếu',
    LEGACY: 'Dữ liệu cũ',
    SAMPLE: 'Dữ liệu mẫu'
});

/** Tạo nhãn trạng thái xác minh. */
export function verificationBadge(status) {
    const map = {
        VERIFIED: 'badge-success',
        NEEDS_VERIFICATION: 'badge-warning',
        LEGACY: 'badge-info',
        SAMPLE: 'badge-info'
    };
    return createElement('span', {
        className: `badge ${map[status] || ''}`,
        text: VERIFICATION_LABELS[status] || status || 'Chưa rõ'
    });
}

/** Menu học sinh — khớp với các trang trong public/student/. */
export const STUDENT_MENU = Object.freeze([
    { href: '/student/dashboard.html', label: 'Bảng điều khiển' },
    { href: '/student/subjects.html', label: 'Môn học' },
    { href: '/student/curriculum.html', label: 'Chương trình' },
    { href: '/student/exams.html', label: 'Bài kiểm tra' },
    { href: '/student/history.html', label: 'Lịch sử' },
    { href: '/student/progress.html', label: 'Tiến độ' },
    { href: '/student/profile.html', label: 'Tài khoản' }
]);

/** Menu quản trị — khớp với các trang trong public/admin/. */
export const ADMIN_MENU = Object.freeze([
    { href: '/admin/dashboard.html', label: 'Bảng điều khiển' },
    { href: '/admin/students.html', label: 'Học sinh' },
    { href: '/admin/curriculum.html', label: 'Chương trình' },
    { href: '/admin/subjects.html', label: 'Môn học' },
    { href: '/admin/books.html', label: 'Bộ sách' },
    { href: '/admin/chapters.html', label: 'Chương' },
    { href: '/admin/lessons.html', label: 'Bài học' },
    { href: '/admin/question-bank.html', label: 'Ngân hàng câu hỏi' },
    { href: '/admin/exams.html', label: 'Bài kiểm tra' },
    { href: '/admin/import-docx.html', label: 'Nhập từ Word' },
    { href: '/admin/grading.html', label: 'Bài cần chấm' },
    { href: '/admin/audit-log.html', label: 'Nhật ký' }
]);

/**
 * Dựng thanh trên cùng và thanh điều hướng dùng chung cho mọi trang.
 *
 * @param {object} options
 * @param {object} options.user   thông tin tài khoản (từ /api/auth/me)
 * @param {Array}  options.menu   các mục điều hướng
 * @param {Function} options.onLogout hàm xử lý đăng xuất
 */
export function renderShell({ user, menu, onLogout }) {
    const current = window.location.pathname;

    const header = createElement('header', { className: 'app-header', children: [
        createElement('div', { className: 'app-header-inner', children: [
            createElement('a', { className: 'app-brand', href: '/index.html', children: [
                createElement('span', { attrs: { 'aria-hidden': 'true' }, text: '🎓' }),
                createElement('span', { text: 'Hành Tinh Mơ Ước' })
            ] }),
            createElement('div', { className: 'app-user', children: [
                createElement('span', { text: `${user.username}${user.grade ? ` — Lớp ${user.grade}` : ''}` }),
                createElement('button', {
                    className: 'btn btn-ghost',
                    text: 'Đăng xuất',
                    attrs: { type: 'button', id: 'btn-logout' }
                })
            ] })
        ] })
    ] });

    const nav = menu?.length
        ? createElement('nav', { className: 'app-nav', attrs: { 'aria-label': 'Điều hướng chính' }, children: [
            createElement('div', { className: 'app-nav-inner', children: menu.map(item => createElement('a', {
                href: item.href,
                text: item.label,
                // Đánh dấu trang đang mở để người dùng biết đang ở đâu.
                attrs: item.href === current ? { 'aria-current': 'page' } : {}
            })) })
        ] })
        : null;

    document.body.prepend(nav || document.createComment('nav'));
    document.body.prepend(header);

    document.getElementById('btn-logout')?.addEventListener('click', onLogout);
    return { header, nav };
}
