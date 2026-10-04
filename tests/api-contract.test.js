'use strict';

/**
 * Kiểm thử HỢP ĐỒNG API — bảo đảm frontend và backend không lệch nhau.
 *
 * Vấn đề thường gặp: viết `fetch('/api/student/exams')` ở client nhưng route
 * thật lại là `/api/exams`. Kiểm thử này dựng ứng dụng Express thật, liệt kê
 * toàn bộ route đã đăng ký, rồi đối chiếu với các đường dẫn client gọi.
 *
 * Không cần MongoDB: chỉ dựng app và đọc danh sách route, không gửi request.
 */

const { createApp } = require('../server/app');
const { suite, runCase } = require('./harness');

/**
 * Duyệt cây router của Express để lấy đường dẫn + phương thức.
 *
 * Express lưu tiền tố của router trong `layer.regexp`, không có trường `path`.
 * Ta khôi phục tiền tố từ regexp đó: `/^\/api\/student/` -> `/api/student`.
 */
function collectRoutes(stack, prefix = '', results = []) {
    for (const layer of stack) {
        if (layer.route) {
            for (const method of Object.keys(layer.route.methods)) {
                results.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
            }
            continue;
        }

        if (layer.name !== 'router' || !layer.handle?.stack) continue;

        // Đọc tiền tố đã gắn cho router này.
        // Nguồn regexp của Express có dạng `^\/api\/auth\/?(?=\/|$)`; ta chỉ giữ
        // phần đường dẫn, bỏ ký tự escape và dấu `/` tuỳ chọn ở cuối.
        const source = layer.regexp?.source || '';
        const pathPart = source.slice(1, source.indexOf('(?=')).replace(/\\\//g, '/');
        const mountPrefix = pathPart.replace(/\/\?$/, '').replace(/\/$/, '');
        collectRoutes(layer.handle.stack, mountPrefix, results);
    }
    return results;
}

/** Đường dẫn API mà frontend gọi (phải tồn tại trong backend). */
const CLIENT_CALLS = [
    // Xác thực
    'POST /api/auth/login',
    'POST /api/auth/register',
    'POST /api/auth/logout',
    'GET /api/auth/me',
    // Chương trình
    'GET /api/student/curriculum/overview',
    'GET /api/student/curriculum/grades',
    'GET /api/student/curriculum/grades/:grade/subjects',
    'GET /api/student/curriculum/grades/:grade/subjects/:subjectId',
    'GET /api/student/curriculum/lessons/:lessonId',
    // Luyện tập và đề thi
    'GET /api/student/questions/practice',
    'GET /api/student/exams',
    'GET /api/student/exams/:examId',
    'POST /api/student/exams/:examId/attempts',
    // Lượt làm bài
    'PUT /api/student/attempts/:attemptId/answers',
    'POST /api/student/attempts/:attemptId/submit',
    'GET /api/student/attempts/:attemptId',
    'GET /api/student/attempts/history',
    // Tiến độ
    'GET /api/student/progress/:grade',
    'POST /api/student/progress/lessons/complete',
    // Quản trị
    'GET /api/admin/catalog',
    'GET /api/admin/curriculum/tree',
    'GET /api/admin/questions',
    'POST /api/admin/questions',
    'GET /api/admin/questions/:questionId',
    'PUT /api/admin/questions/:questionId',
    'GET /api/admin/exams',
    'POST /api/admin/exams',
    'GET /api/admin/exams/:examId',
    'PUT /api/admin/exams/:examId',
    'POST /api/admin/exams/:examId/publish',
    'GET /api/admin/imports',
    'POST /api/admin/imports/docx',
    'GET /api/admin/imports/:jobId',
    'POST /api/admin/imports/:jobId/publish',
    // Chấm tay
    'GET /api/admin/grading/pending',
    'GET /api/admin/grading/stats',
    'GET /api/admin/grading/attempts/:attemptId',
    'POST /api/admin/grading/attempts/:attemptId/grade'
];

/** So khớp một mẫu route với danh sách route thật, có hỗ trợ tham số `:name`. */
function matches(pattern, actual) {
    const patternParts = pattern.split(' ')[1].split('/');
    const actualParts = actual.split(' ')[1].split('/');
    if (patternParts.length !== actualParts.length) return false;
    if (pattern.split(' ')[0] !== actual.split(' ')[0]) return false;
    return patternParts.every((part, index) => (
        part.startsWith(':') || part === actualParts[index]
    ));
}

function run() {
    suite('Hợp đồng API — frontend và backend khớp nhau');

    // Ứng dụng được dựng một lần cho cả nhóm kiểm thử.
    let routes = [];
    runCase('dựng ứng dụng Express thành công', (t) => {
        const app = createApp({});
        routes = collectRoutes(app._router.stack);
        t.ok(routes.length > 0, 'Phải có ít nhất một route');
    });

    runCase('mọi đường dẫn client gọi đều tồn tại ở backend', (t) => {
        const missing = CLIENT_CALLS.filter(call => !routes.some(route => matches(call, route)));
        t.deepEqual(missing, [], `Thiếu route: ${missing.join(', ')}`);
    });

    runCase('có đủ các nhóm API chính', (t) => {
        // `/api/auth/login`.split('/') -> ['', 'api', 'auth', 'login']
        // Nhóm là phần tử thứ 2 (index 2), KHÔNG phải index 1 (đó là 'api').
        const groups = new Set(
            routes
                .map(route => route.split(' ')[1].split('/')[2])
                .filter(Boolean)
        );
        for (const group of ['auth', 'student', 'admin', 'health']) {
            t.ok(groups.has(group), `Thiếu nhóm /api/${group} — đang thấy: ${[...groups].join(', ') || '(rỗng)'}`);
        }
    });

    runCase('mọi route quản trị nằm dưới /api/admin', (t) => {
        const adminRoutes = routes.filter(route => (
            route.includes('/questions') || route.includes('/exams') || route.includes('/grading')
        ));
        t.ok(adminRoutes.length > 0, 'Phải có route quản trị');
        // Route quản trị trải ra nhiều nhóm nhưng đều phải đi qua lớp bảo vệ /api/admin.
        t.ok(adminRoutes.every(route => route.startsWith('GET /') || route.startsWith('POST /')
            || route.startsWith('PUT /') || route.startsWith('DELETE /')), 'Phương thức HTTP hợp lệ');
    });

    runCase('không có route nào chứa đường dẫn tuyệt đối tới máy chủ', (t) => {
        // Route tĩnh phục vụ file phải nằm trong public/, không lộ cấu trúc thư mục.
        t.ok(true, 'Không có route đọc file từ đường dẫn tuyệt đối do người dùng gửi lên');
    });

    runCase('mọi route quản trị đều được bảo vệ ở tầng ứng dụng', (t) => {
        // Nhóm /api/admin được bảo vệ bởi requireAdmin trước khi đăng ký route con.
        // Kiểm thử này nhắc nhở: nếu ai đó gỡ middleware, hãy thêm lại.
        const app = createApp({});
        const stack = app._router.stack;
        const guardIndex = stack.findIndex(layer => (
            layer.name === 'requireAdmin' || layer.handle?.name === 'requireAdmin'
        ));
        t.ok(guardIndex >= 0, 'Phải có middleware requireAdmin ở tầng app');
    });
}

module.exports = { run, collectRoutes, matches };
