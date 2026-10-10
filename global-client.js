// Tiện ích dùng chung cho Hành Tinh Mơ Ước v2.
(() => {
    'use strict';

    let currentUser = localStorage.getItem('currentUser');
    let heartbeatTimer = null;
    let globalSocket = null;

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function showToast({ title = 'Thông báo', message = '', type = 'info', actionText, actionUrl, duration = 15000 }) {
        const container = document.getElementById('global-toast-container') || (() => {
            const node = createElement('div', 'global-toast-container');
            node.id = 'global-toast-container';
            node.setAttribute('aria-live', 'polite');
            document.body.appendChild(node);
            return node;
        })();

        const toast = createElement('section', `global-toast global-toast--${type}`);
        const header = createElement('div', 'global-toast__header');
        const heading = createElement('strong', 'global-toast__title', title);
        const closeButton = createElement('button', 'global-toast__close', '×');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Đóng thông báo');
        header.append(heading, closeButton);

        const body = createElement('p', 'global-toast__message', message);
        toast.append(header, body);

        if (actionText && actionUrl) {
            const action = createElement('a', 'global-toast__action', actionText);
            action.href = actionUrl;
            toast.appendChild(action);
        }

        let removed = false;
        const remove = () => {
            if (removed) return;
            removed = true;
            toast.classList.add('is-leaving');
            setTimeout(() => toast.remove(), 220);
        };
        closeButton.addEventListener('click', remove);
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('is-visible'));
        if (duration > 0) setTimeout(remove, duration);
        return toast;
    }

    function showBlockOverlay(title, message, linkText = 'Về trang đăng nhập') {
        if (document.getElementById('block-overlay')) return;

        const overlay = createElement('div', 'block-overlay');
        overlay.id = 'block-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const panel = createElement('div', 'block-overlay__panel');
        panel.append(
            createElement('div', 'block-overlay__icon', '🛡️'),
            createElement('h1', 'block-overlay__title', title),
            createElement('p', 'block-overlay__message', message)
        );
        const link = createElement('a', 'block-overlay__action', linkText);
        link.href = '/login.html';
        panel.appendChild(link);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (globalSocket) globalSocket.disconnect();
        localStorage.removeItem('currentUser');
        localStorage.removeItem('role');
    }

    function emitNotificationChange(detail = {}) {
        window.dispatchEvent(new CustomEvent('hanhtrinh:notification', { detail }));
    }

    async function sendHeartbeat() {
        if (!currentUser) return;
        try {
            const response = await fetch('/api/user/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'
            });
            const data = await response.json().catch(() => ({}));

            if (response.status === 401) {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('role');
                window.dispatchEvent(new CustomEvent('hanhtrinh:session-expired'));
                return;
            }
            if (data.code === 'PLAYTIME_LIMIT_EXCEEDED') {
                showBlockOverlay('Đã hết thời gian chơi', 'Bạn đã dùng hết thời gian được phép hôm nay. Hãy nghỉ ngơi và quay lại vào ngày mai nhé!');
            } else if (data.code === 'ACCOUNT_SUSPENDED') {
                showBlockOverlay('Tài khoản đã bị khóa', data.message || 'Vui lòng liên hệ quản trị viên.');
            } else if (data.code === 'MAINTENANCE') {
                showBlockOverlay('Hệ thống đang bảo trì', data.message || 'Vui lòng quay lại sau.');
            } else if (response.ok) {
                window.dispatchEvent(new CustomEvent('hanhtrinh:heartbeat', { detail: data }));
            }
        } catch (error) {
            console.warn('Không thể gửi heartbeat:', error.message);
        }
    }

    function connectSocket() {
        if (!currentUser || typeof window.io !== 'function' || globalSocket?.connected) return;
        try {
            globalSocket = window.io({ transports: ['websocket', 'polling'] });
            window.hanhTrinhSocket = globalSocket;

            globalSocket.on('adminNotification', data => {
                showToast({
                    title: data?.title || 'Thông báo từ Admin',
                    message: data?.message || '',
                    type: data?.type || 'info'
                });
                emitNotificationChange({ type: 'admin', data });
            });

            globalSocket.on('matchNotice', data => {
                showToast({
                    title: data?.title || 'Sắp đến giờ thi đấu',
                    message: data?.message || '',
                    type: 'warning',
                    actionText: 'Đến sân vận động',
                    actionUrl: '/giai-dau.html',
                    duration: 30000
                });
                emitNotificationChange({ type: 'match', data });
            });

            globalSocket.on('playtimeLimitExceeded', () => {
                showBlockOverlay('Đã hết thời gian chơi', 'Bạn đã dùng hết thời gian chơi được phép trong ngày hôm nay.');
            });
            globalSocket.on('accountSuspended', data => {
                showBlockOverlay('Tài khoản đã bị khóa', data?.message || 'Vui lòng liên hệ quản trị viên.');
            });
            globalSocket.on('maintenanceModeOn', data => {
                showBlockOverlay('Hệ thống đang bảo trì', data?.message || 'Vui lòng quay lại sau.');
            });
            globalSocket.on('maintenanceModeOff', data => {
                const overlay = document.getElementById('block-overlay');
                if (overlay) overlay.remove();
                showToast({
                    title: 'Hệ thống đã mở lại',
                    message: data?.message || 'Bạn có thể tải lại trang để tiếp tục.',
                    type: 'success'
                });
            });
        } catch (error) {
            console.warn('Socket.IO chưa sẵn sàng:', error.message);
        }
    }

    function start() {
        currentUser = localStorage.getItem('currentUser');
        if (!currentUser) return;
        connectSocket();
        if (!heartbeatTimer) {
            setTimeout(sendHeartbeat, 3000);
            heartbeatTimer = setInterval(sendHeartbeat, 60000);
        }
    }

    document.addEventListener('DOMContentLoaded', start);
    window.addEventListener('hanhtrinh:authenticated', start);

    window.HanhTrinhClient = { showToast, start, getSocket: () => globalSocket };
})();
