'use strict';

/**
 * KIỂM TRA CÚ PHÁP TOÀN BỘ JAVASCRIPT GIAO DIỆN.
 *
 * Vì sao cần tệp này: `node --check` mặc định phân tích tệp .js như CommonJS,
 * nên bỏ qua lỗi cú pháp ES module (`import` / `export`). Bộ kiểm thử giao diện
 * lại phân tích đúng kiểu module và bắt được lỗi. Tệp này dùng `vm.SourceTextModule`
 * để phân tích GIỐNG HỆT cách trình duyệt và Node đọc các tệp module.
 *
 * Dùng khi:  node scripts/check-frontend-syntax.js
 * Yêu cầu:   node --experimental-vm-modules
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'assets', 'js');

/** Thu thập mọi tệp .js bên trong một thư mục. */
function collectJsFiles(dir, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectJsFiles(full, results);
        else if (entry.name.endsWith('.js')) results.push(full);
    }
    return results;
}

/**
 * Kiểm tra cú pháp một tệp theo kiểu ES module.
 *
 * @param {string} file đường dẫn tuyệt đối
 * @returns {{ok: boolean, error: string}}
 */
function checkModuleSyntax(file) {
    try {
        // Chỉ cần biên dịch, không thực thi: `SourceTextModule` báo lỗi cú pháp ngay.
        new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { identifier: file });
        return { ok: true, error: '' };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

function main() {
    const files = collectJsFiles(PUBLIC_DIR);
    const broken = [];

    for (const file of files) {
        const { ok, error } = checkModuleSyntax(file);
        if (ok) {
            console.log(`  V ${path.relative(PUBLIC_DIR, file)}`);
        } else {
            broken.push({ file, error });
            console.log(`  X ${path.relative(PUBLIC_DIR, file)}`);
        }
    }

    console.log(`\nKiem tra ${files.length} tep JS giao dien.`);
    if (broken.length) {
        console.log(`${broken.length} tep LOI CÚ PHÁP:\n`);
        for (const item of broken) {
            console.log(`--- ${item.file}`);
            console.log(item.error);
            console.log('');
        }
        process.exit(1);
    }
    console.log('OK - moi tep JS giao dien deu hop le cu phap ES module');
}

main();