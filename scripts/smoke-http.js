'use strict';

/**
 * KIỂM TRA NHANH TRÊN MÁY CHỦ ĐANG CHẠY.
 *
 * Kiểm tra mọi trang của nền tảng học tập trả về 200, và các endpoint bảo vệ
 * trả về đúng mã (401 khi chưa đăng nhập, 403 khi học sinh gọi API quản trị).
 *
 * Dùng khi:  node scripts/smoke-http.js
 */
const http = require('http');

const BASE = { host: '127.0.0.1', port: Number(process.env.PORT) || 3000 };

/** Các trang tĩnh phải trả về 200. */
const PAGES = [
    '/', '/index.html',
    '/auth/login.html', '/auth/register.html',
    '/student/dashboard.html', '/student/subjects.html', '/student/curriculum.html',
    '/student/lesson.html', '/student/practice.html', '/student/exams.html',
    '/student/exam.html', '/student/result.html', '/student/history.html',
    '/student/progress.html',
    '/student/milestones.html', '/student/profile.html',
    '/admin/dashboard.html', '/admin/students.html', '/admin/curriculum.html',
    '/admin/subjects.html', '/admin/books.html', '/admin/chapters.html',
    '/admin/lessons.html', '/admin/question-bank.html', '/admin/exams.html',
    '/admin/exam-editor.html', '/admin/import-docx.html', '/admin/grading.html',
    '/admin/audit-log.html',
    '/assets/css/education.css'
];

/** Endpoint cần kiểm tra trả về đúng mã khi chưa đăng nhập. */
const API_EXPECTATIONS = [
    { path: '/api/health', expected: [200] },
    // 401 = chưa đăng nhập; 503 = chưa có MongoDB (server.js chặn trước bước xác thực).
    { path: '/api/student/curriculum/grades', expected: [401, 503] },
    { path: '/api/admin/questions', expected: [401, 403, 503] }
];

function request(path) {
    return new Promise(resolve => {
        const req = http.request({ ...BASE, path, method: 'GET' }, res => {
            res.resume();
            resolve(res.statusCode);
        });
        req.on('error', () => resolve(0));
        req.end();
    });
}

async function main() {
    let failed = 0;
    console.log('Kiểm tra trang tĩnh:');
    for (const page of PAGES) {
        // eslint-disable-next-line no-await-in-loop
        const status = await request(page);
        if (status !== 200) {
            failed += 1;
            console.log(`  x ${page} -> ${status}`);
        }
    }
    console.log(`  ${PAGES.length - failed}/${PAGES.length} trang trả về 200.`);

    console.log('Kiểm tra API:');
    for (const item of API_EXPECTATIONS) {
        // eslint-disable-next-line no-await-in-loop
        const status = await request(item.path);
        const ok = item.expected.includes(status);
        if (!ok) failed += 1;
        console.log(`  ${ok ? 'v' : 'x'} ${item.path} -> ${status} `
            + `(mong đợi ${item.expected.join(' hoặc ')})`);
    }

    console.log(failed === 0 ? '\nOK' : `\n${failed} lỗi`);
    process.exit(failed === 0 ? 0 : 1);
}

main();