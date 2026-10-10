// Tên file: global-client.js
// NỘI DUNG ĐẦY ĐỦ

(function() {
    // --- TÍNH NĂNG MỚI: Kết nối Socket.IO toàn cục ---
    // Chỉ kết nối nếu user đã đăng nhập (kiểm tra localStorage từ file index.html)
    const currentUser = localStorage.getItem('currentUser');
    let globalSocket;

    if (currentUser) {
        // Giả định /socket.io/socket.io.js đã được tải
        try {
            globalSocket = io(); 

            // --- TÍNH NĂNG MỚI: Lắng nghe thông báo từ Admin ---
            globalSocket.on('adminNotification', (data) => {
                // Hiển thị popup thông báo
                showAdminPopup(data.title, data.message);
            });

            // Xử lý khi bị ngắt kết nối do hết giờ (từ server)
            globalSocket.on('playtimeLimitExceeded', () => {
                handlePlaytimeLimit();
            });

        } catch (e) {
            console.warn("Socket.IO chưa được tải hoặc kết nối thất bại.", e);
        }
    }

    // --- TÍNH NĂNG CŨ: Logic Heartbeat (HTTP) (Lấy từ file heartbeat.js) ---
    let heartbeatInterval;

    async function sendHeartbeat() {
        if (!currentUser) {
             if (heartbeatInterval) clearInterval(heartbeatInterval);
             return;
        }
        
        try {
            const response = await fetch('/api/user/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                 const errorData = await response.json();
                 if (response.status === 403 || errorData.code === 'PLAYTIME_LIMIT_EXCEEDED') {
                    handlePlaytimeLimit();
                 }
                 return;
            }
            
            const data = await response.json();
            if (data.status === 'limit_exceeded') {
                handlePlaytimeLimit();
            }
        } catch (error) {
            console.error('Heartbeat error:', error);
        }
    }

    // Hàm xử lý khi hết giờ (Lấy từ file heartbeat.js)
    function handlePlaytimeLimit() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        // Ngắt kết nối socket nếu có
        if (globalSocket) {
            globalSocket.disconnect();
        }
        
        // Ngắt kết nối các socket game khác (nếu có, giả sử tên biến là 'socket')
        if (typeof socket !== 'undefined' && socket.disconnect) {
            socket.disconnect();
        }

        // Hiển thị thông báo che màn hình
        if (document.getElementById('playtime-overlay')) return; // Đã hiển thị
        
        const overlay = document.createElement('div');
        overlay.id = 'playtime-overlay';
        overlay.style = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 9998;
            display: flex; justify-content: center; align-items: center;
            color: white; font-family: 'Baloo 2', cursive; text-align: center;
        `;
        overlay.innerHTML = `
            <div style="background: #fff; color: #333; padding: 40px; border-radius: 20px; box-shadow: 0 5px 20px rgba(0,0,0,0.5);">
                <h1 style="font-size: 2.5rem; color: #e74c3c;">Đã hết giờ!</h1>
                <p style="font-size: 1.2rem;">Bạn đã sử dụng hết thời gian chơi cho ngày hôm nay.</p>
                <p style="font-size: 1.2rem;">Hãy quay lại vào ngày mai để tiếp tục khám phá nhé!</p>
                <a href="index.html" style="display: inline-block; padding: 10px 20px; background: #3498db; color: white; border-radius: 10px; text-decoration: none; font-weight: bold; margin-top: 20px;">Về Trang Chủ</a>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // --- TÍNH NĂNG MỚI: Hàm hiển thị popup thông báo của Admin ---
    function showAdminPopup(title, message) {
        if (document.getElementById('admin-popup')) return; // Đã có popup

        const popup = document.createElement('div');
        popup.id = 'admin-popup';
        popup.style = `
            position: fixed; top: 20px; right: 20px;
            background: #fff; border: 2px solid #3498db;
            border-radius: 10px; padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
            font-family: 'Arial', sans-serif;
            transition: opacity 0.3s;
            opacity: 0;
        `;
        popup.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #2980b9;">${title || 'Thông báo'}</h3>
            <p style="margin: 0 0 15px 0; color: #333; max-height: 100px; overflow-y: auto;">${message}</p>
            <button id="admin-popup-close" style="padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Đã hiểu</button>
        `;
        document.body.appendChild(popup);
        
        // Hiệu ứng mờ
        setTimeout(() => { popup.style.opacity = '1'; }, 10);
        
        popup.querySelector('#admin-popup-close').onclick = () => {
            popup.style.opacity = '0';
            setTimeout(() => { popup.remove(); }, 300);
        };

        // Tự động đóng sau 15 giây
        setTimeout(() => {
            if (popup) {
                popup.style.opacity = '0';
                setTimeout(() => { popup.remove(); }, 300);
            }
        }, 15000);
    }

    // Bắt đầu gửi heartbeat sau khi trang tải
    document.addEventListener('DOMContentLoaded', () => {
        if (currentUser) { // Chỉ chạy nếu đã đăng nhập
            setTimeout(sendHeartbeat, 5000); // Gửi 1 lần sau 5 giây
            heartbeatInterval = setInterval(sendHeartbeat, 60000); // Gửi mỗi 60 giây (1 phút)
        }
    });

})();