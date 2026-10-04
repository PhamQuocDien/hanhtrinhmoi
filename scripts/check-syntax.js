'use strict';

/**
 * Kiểm tra cú pháp JavaScript cho toàn bộ mã nguồn.
 *
 * Chạy được cho cả mã CommonJS (server/, scripts/, tests/) lẫn mã ES module
 * (public/assets/js/) vì `node --check` chỉ kiểm tra cú pháp, không thực thi.
 *
 *   node scripts/check-syntax.js
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'archive', 'uploads', '.vscode']);

/** Duyệt toàn bộ tệp .js trong thư mục. */
function walk(directory, results = []) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            walk(full, results);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            results.push(full);
        }
    }
    return results;
}

function main() {
    const files = walk(ROOT);
    const failures = [];

    for (const file of files) {
        try {
            execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
        } catch (error) {
            failures.push({
                file: path.relative(ROOT, file).replace(/\\/g, '/'),
                message: (error.stderr?.toString() || error.message).trim().split('\n').slice(0, 4).join('\n')
            });
        }
    }

    if (failures.length) {
        console.error(`❌ ${failures.length}/${files.length} tệp có lỗi cú pháp:\n`);
        for (const item of failures) {
            console.error(`  ${item.file}\n${item.message.split('\n').map(line => `      ${line}`).join('\n')}\n`);
        }
        process.exit(1);
    }

    console.log(`✅ Cú pháp hợp lệ: ${files.length} tệp JavaScript.`);
}

if (require.main === module) main();

module.exports = { main, walk };
