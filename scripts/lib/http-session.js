'use strict';

/**
 * TIỆN ÍCH HTTP CHO CÁC TỆP KIỂM TRA SCRIPT.
 *
 * Các tệp kiểm tra cần gọi API thật (đã đăng nhập, có cookie phiên) nên dùng
 * chung một lớp HTTP nhỏ thay vì lặp lại `http.request` ở mỗi tệp.
 */

const http = require('http');

/** Máy chủ mặc định của dự án. */
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;

/**
 * Máy khách HTTP giữ cookie phiên giữa các yêu cầu.
 *
 * Cookie là cần thiết vì phần lớn API dùng `requireAuth`, đọc `req.session.user`.
 */
class HttpSession {
    constructor({ host = HOST, port = PORT } = {}) {
        this.host = host;
        this.port = port;
        this.cookie = '';
    }

    /**
     * Gửi một yêu cầu và chờ phản hồi.
     *
     * @param {string} method động từ HTTP
     * @param {string} path đường dẫn kèm query
     * @param {object} [body] dữ liệu JSON gửi đi
     * @returns {Promise<{status: number, json: object|null, raw: string}>}
     */
    request(method, path, body = null) {
        return new Promise(resolve => {
            const payload = body ? Buffer.from(JSON.stringify(body)) : null;
            const req = http.request({
                host: this.host,
                port: this.port,
                path,
                method,
                headers: {
                    ...(this.cookie ? { cookie: this.cookie } : {}),
                    ...(payload ? {
                        'content-type': 'application/json',
                        'content-length': payload.length
                    } : {})
                }
            }, res => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { text += chunk; });
                res.on('end', () => {
                    this.rememberCookies(res.headers['set-cookie'] || []);
                    let json = null;
                    try {
                        json = JSON.parse(text);
                    } catch (error) {
                        // Phản hồi không phải JSON (ví dụ trang HTML) — để raw cho người đọc.
                    }
                    resolve({ status: res.statusCode, json, raw: text });
                });
            });
            req.on('error', error => resolve({ status: 0, json: null, raw: '', error: error.message }));
            if (payload) req.write(payload);
            req.end();
        });
    }

    /** Gọi GET. */
    get(path) {
        return this.request('GET', path);
    }

    /** Gọi POST. */
    post(path, body) {
        return this.request('POST', path, body);
    }

    /**
     * Chỉ giữ cookie phiên; bỏ cookie tĩnh không cần thiết cho việc kiểm tra.
     *
     * @param {string[]} setCookie danh sách cookie từ phản hồi
     */
    rememberCookies(setCookie) {
        for (const entry of setCookie) {
            const [pair] = entry.split(';');
            if (pair.startsWith('connect.sid')) this.cookie = pair;
        }
    }

    /** Xoá cookie, dùng để kiểm tra hành vi khi chưa đăng nhập. */
    clearCookie() {
        this.cookie = '';
    }

    /**
     * Dữ liệu trong trường `data` của phản hồi.
     *
     * @param {object} response phản hồi
     * @returns {*} dữ liệu hoặc null
     */
    static dataOf(response) {
        return response?.json?.data ?? null;
    }
}

module.exports = { HOST, HttpSession, PORT };