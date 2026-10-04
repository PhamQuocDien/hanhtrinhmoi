'use strict';

/**
 * KIỂM TRA GIAO DIỆN THỰC TẾ — tải trang và CSS, kiểm tra nội dung thật.
 *
 * Mục tiêu: bắt được lỗi "trông như HTML mặc định" — tức là CSS không được
 * nạp, hoặc nạp sai, hoặc có lỗi cú pháp khiến trình duyệt bỏ qua.
 *
 * Dùng khi:  node scripts/check-ui-delivery.js
 */
const http = require('http');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;

/** Tải một đường dẫn và trả về { status, type, body }. */
function fetchPath(path) {
    return new Promise(resolve => {
        const req = http.request({ host: HOST, port: PORT, path, method: 'GET' }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve({
                status: res.statusCode,
                type: res.headers['content-type'] || '',
                length: res.headers['content-length'] || '',
                body
            }));
        });
        req.on('error', error => resolve({ status: 0, type: '', length: '', body: '', error: error.message }));
        req.end();
    });
}

async function main() {
    let problems = 0;
    const fail = message => {
        problems += 1;
        console.log(`  X ${message}`);
    };

    // ---- 1. CSS phải được phục vụ đúng kiểu và có nội dung thật -------------
    console.log('Kiem tra CSS:');
    const css = await fetchPath('/assets/css/education.css');
    if (css.status !== 200) {
        fail(`/assets/css/education.css tra ve ${css.status}`);
    } else if (!css.type.includes('text/css')) {
        fail(`CSS phai la text/css, nhan "${css.type}"`);
    } else {
        console.log(`  V CSS 200, ${css.body.length} bytes, ${css.type}`);

        // Trình duyệt bỏ qua CSS nếu có lỗi cú pháp nghiêm trọng ở đầu tệp.
        if (css.body.length < 500) fail('CSS quá ngắn, có thể bị chặn hoặc rỗng');
        if (!/:root\s*\{/.test(css.body)) fail('CSS thieu bien CSS (`:root`)');
        if (!/font-family/.test(css.body)) fail('CSS thieu font-family');
        if (!/@media/.test(css.body)) fail('CSS thieu breakpoint (media query)');
        if (/\{\s*\}/.test(css.body)) fail('CSS co khoi rong {}');

        // So khớp ngoặc để bắt lỗi cắt khúc.
        let depth = 0;
        for (const char of css.body) {
            if (char === '{') depth += 1;
            if (char === '}') depth -= 1;
        }
        if (depth !== 0) fail(`CSS lech ngoac (depth ${depth})`);
    }

    // ---- 2. HTML phải liên kết CSS và không còn style mặc định ---------------
    console.log('Kiem tra HTML:');
    const pages = ['/', '/auth/login.html', '/student/dashboard.html', '/admin/dashboard.html'];
    for (const page of pages) {
        const html = await fetchPath(page);
        if (html.status !== 200) {
            fail(`${page} tra ve ${html.status}`);
            continue;
        }
        if (!/<link[^>]+stylesheet/i.test(html.body)) fail(`${page} khong co <link stylesheet>`);
        if (!/lang="vi"/.test(html.body)) fail(`${page} thieu lang="vi"`);
        if (!/<meta[^>]+name="viewport"/.test(html.body)) fail(`${page} thieu viewport`);
        // Font chữ mặc định của trình duyệt là Times — dấu hiệu CSS chưa nạp.
        if (/font-family:\s*"?Times/i.test(html.body)) fail(`${page} dung font Times`);
    }

    // ---- 3. Không còn kiểu HTML mặc định lọt vào thẻ -----------------------
    console.log('Kiem tra style mac dinh:');
    for (const page of pages) {
        const html = await fetchPath(page);
        if (html.status !== 200) continue;
        if (/text-decoration:\s*underline/i.test(html.body)) {
            fail(`${page} con gach chan mac dinh`);
        }
        if (/<h1[^>]*font-size:\s*(3[2-9]|[4-9][0-9])px/i.test(html.body)) {
            fail(`${page} con tieu de qua lon`);
        }
    }

    console.log(problems === 0 ? '\nOK - giao dien duoc phuc vu dung' : `\n${problems} van de`);
    process.exit(problems === 0 ? 0 : 1);
}

main();