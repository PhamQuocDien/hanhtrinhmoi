'use strict';

/**
 * Kiểm thử GIAO DIỆN — bảo đảm frontend không hỏng khi không có trình duyệt.
 *
 * Không cần MongoDB hay trình duyệt: đọc tệp tĩnh rồi kiểm tra tính nhất quán.
 *
 *   1. Mọi trang HTML bắt buộc đều tồn tại.
 *   2. Mọi tệp script/stylesheet mà HTML trỏ tới đều tồn tại.
 *   3. Mọi đường dẫn nội bộ trong HTML không hỏng.
 *   4. Mọi câu lệnh import trong JS trỏ tới tệp tồn tại.
 *   5. Mọi tệp JS có cú pháp ES module hợp lệ.
 *   6. Mọi tệp CSS cân bằng ngoặc.
 *   7. Frontend không dùng eval/innerHTML và không tự chứa đáp án đúng.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { suite, runCase } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

/** Duyệt đệ quy mọi tệp trong public/. */
function walk(directory, results = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            walk(full, results);
        } else if (entry.isFile()) {
            results.push(full);
        }
    }
    return results;
}

/** Đường dẫn tương đối so với public/, dùng '/' ở đầu. */
function toPublicPath(file) {
    return `/${path.relative(PUBLIC_DIR, file).replace(/\\/g, '/')}`;
}

/** Danh sách trang bắt buộc của nền tảng. */
const REQUIRED_PAGES = Object.freeze([
    'index.html',
    'auth/login.html',
    'auth/register.html',
    'student/dashboard.html',
    'student/subjects.html',
    'student/curriculum.html',
    'student/lesson.html',
    'student/practice.html',
    'student/exams.html',
    'student/exam.html',
    'student/result.html',
    'student/history.html',
    'student/progress.html',
    'student/profile.html',
    'admin/dashboard.html',
    'admin/students.html',
    'admin/curriculum.html',
    'admin/subjects.html',
    'admin/books.html',
    'admin/chapters.html',
    'admin/lessons.html',
    'admin/question-bank.html',
    'admin/exams.html',
    'admin/exam-editor.html',
    'admin/import-docx.html',
    'admin/grading.html'
]);

function run() {
    suite('Giao diện — HTML, CSS và JavaScript khớp nhau');

    const files = fs.existsSync(PUBLIC_DIR) ? walk(PUBLIC_DIR) : [];
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    const jsFiles = files.filter(file => file.endsWith('.js'));
    const cssFiles = files.filter(file => file.endsWith('.css'));

    runCase('public/ có đủ trang học sinh và quản trị', (t) => {
        const present = new Set(htmlFiles.map(toPublicPath));
        const missing = REQUIRED_PAGES.filter(page => !present.has(`/${page}`));
        t.deepEqual(missing, [], `Thiếu trang: ${missing.join(', ')}`);
    });

    runCase('mọi tệp script trong HTML đều tồn tại', (t) => {
        const missing = [];
        for (const file of htmlFiles) {
            const html = fs.readFileSync(file, 'utf8');
            for (const [, ref] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
                if (!ref.startsWith('/')) continue;
                if (!fs.existsSync(path.join(PUBLIC_DIR, ref.replace(/^\//, '')))) {
                    missing.push(`${toPublicPath(file)} -> ${ref}`);
                }
            }
        }
        t.deepEqual(missing, [], `Thiếu script: ${missing.join(', ')}`);
    });

    runCase('mọi stylesheet trong HTML đều tồn tại', (t) => {
        const missing = [];
        for (const file of htmlFiles) {
            const html = fs.readFileSync(file, 'utf8');
            for (const [, ref] of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) {
                if (!ref.startsWith('/')) continue;
                if (!fs.existsSync(path.join(PUBLIC_DIR, ref.replace(/^\//, '')))) {
                    missing.push(`${toPublicPath(file)} -> ${ref}`);
                }
            }
        }
        t.deepEqual(missing, [], `Thiếu stylesheet: ${missing.join(', ')}`);
    });

    runCase('mọi đường dẫn nội bộ trong HTML đều tồn tại', (t) => {
        const broken = [];
        for (const file of htmlFiles) {
const html = fs.readFileSync(file, 'utf8');
            for (const [, ref] of html.matchAll(/(?:href|src)="(\/[^"#?]+)"/g)) {
                if (ref.startsWith('/api/')) continue;
                if (!fs.existsSync(path.join(PUBLIC_DIR, ref.replace(/^\//, '')))) {
                    broken.push(`${toPublicPath(file)} -> ${ref}`);
                }
            }
        }
        t.deepEqual(broken, [], `Liên kết hỏng: ${broken.join(', ')}`);
    });

    runCase('mọi câu lệnh import trong JS đều trỏ tới tệp tồn tại', (t) => {
        const broken = [];
        for (const file of jsFiles) {
            const source = fs.readFileSync(file, 'utf8');
            for (const [, specifier] of source.matchAll(/from\s+'([^']+)'/g)) {
                if (!specifier.startsWith('.')) continue;
                const target = path.resolve(path.dirname(file), specifier);
                if (!fs.existsSync(target)) {
                    broken.push(`${toPublicPath(file)} -> ${specifier}`);
                }
            }
        }
        t.deepEqual(broken, [], `Import hỏng: ${broken.join(', ')}`);
    });

    runCase('mọi tệp JS giao diện có cú pháp ES module hợp lệ', (t) => {
        const failures = [];
        for (const file of jsFiles) {
            try {
                // SourceTextModule phân tích ES module mà KHÔNG thực thi mã.
                // eslint-disable-next-line no-new
                new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { identifier: file });
            } catch (error) {
                failures.push(`${toPublicPath(file)}: ${error.message}`);
            }
        }
        t.deepEqual(failures, [], `Lỗi cú pháp: ${failures.join(' | ')}`);
    });

    runCase('mọi tệp CSS cân bằng ngoặc', (t) => {
        const failures = [];
        for (const file of cssFiles) {
            const css = fs.readFileSync(file, 'utf8');
            let depth = 0;
            let extraClose = null;
            let line = 1;
            for (const char of css) {
                if (char === '\n') line += 1;
                if (char === '{') depth += 1;
                if (char === '}') {
                    depth -= 1;
                    if (depth < 0 && extraClose === null) extraClose = line;
                }
            }
            if (depth !== 0 || extraClose !== null) {
                failures.push(`${toPublicPath(file)} (thừa ngoặc dòng ${extraClose}, còn ${depth})`);
            }
        }
        t.deepEqual(failures, [], `CSS lỗi: ${failures.join(', ')}`);
    });

    runCase('không còn chữ "Coming soon" trong trang bắt buộc', (t) => {
        const offenders = [];
        for (const file of [...htmlFiles, ...jsFiles]) {
            const source = fs.readFileSync(file, 'utf8');
            if (/coming soon|not implemented/i.test(source)) {
                offenders.push(toPublicPath(file));
            }
        }
        t.deepEqual(offenders, [], `Còn placeholder: ${offenders.join(', ')}`);
    });

    runCase('frontend không dùng eval, innerHTML hay chứa đáp án đúng', (t) => {
        const offenders = [];
        // Nơi DUY NHẤT được phép nhắc tới đáp án đúng:
        //  - exam-page.js: hiển thị kết quả ngay sau khi nộp, trong cùng phiên làm bài.
        //  - result.js:    xem lại bài đã nộp.
        // Cả hai chỉ nhận dữ liệu sau khi máy chủ đã chấm, không phải trước khi nộp.
        const answerViewPages = [
            '/assets/js/exam/exam-page.js',
            '/assets/js/student/result.js'
        ];
        // Trang soạn câu hỏi của QUẢN TRỊ: đây là nơi duy nhất được nhập đáp án đúng,
        // và endpoint này chỉ cho phép vai trò admin.
        const adminEditorPages = [
            '/assets/js/admin/exam-editor.js'
        ];
        for (const file of jsFiles) {
            const source = fs.readFileSync(file, 'utf8');
            const name = toPublicPath(file);
            if (/\beval\s*\(/.test(source)) offenders.push(`${name}: eval()`);
            if (/\.innerHTML\s*=/.test(source)) offenders.push(`${name}: innerHTML=`);
            const allowed = [...answerViewPages, ...adminEditorPages];
            if (/correctAnswer/.test(source) && !allowed.includes(name)) {
                offenders.push(`${name}: nhắc tới correctAnswer`);
            }
        }
        t.deepEqual(offenders, [], `Frontend không an toàn: ${offenders.join(' | ')}`);
    });
}

module.exports = { run };
