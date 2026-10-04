'use strict';

/**
 * KIỂM TRA KHỚP TÊN GIỮA IMPORT VÀ EXPORT.
 *
 * `node --check` chỉ bắt lỗi cú pháp. Nếu một tệp `import { renderGird }` trong
 * khi tệp kia `export function renderGrid`, mọi thứ vẫn hợp lệ về cú pháp nhưng
 * trang sẽ lỗi `undefined is not a function` khi chạy trên trình duyệt.
 *
 * Tệp này đối chiếu từng tên được import với các tên tệp đích thực sự export.
 *
 * Dùng khi:  node scripts/check-module-contract.js
 */

const fs = require('fs');
const path = require('path');

const JS_ROOT = path.join(__dirname, '..', 'public', 'assets', 'js');

/** Thu thập mọi tệp .js. */
function collectJsFiles(dir, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collectJsFiles(full, results);
        else if (entry.name.endsWith('.js')) results.push(full);
    }
    return results;
}

/**
 * Các tên được export từ một tệp.
 *
 * Gom cả `export function|const|class`, `export { a, b }` và `export default`.
 *
 * @param {string} source nội dung tệp
 * @returns {{named: Set<string>, hasDefault: boolean}}
 */
function readExports(source) {
    const named = new Set();
    let hasDefault = false;

    for (const match of source.matchAll(
        /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/gm
    )) {
        named.add(match[1]);
    }

    for (const match of source.matchAll(/^export\s*\{([^}]+)\}/gm)) {
        for (const part of match[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/).pop().trim();
            if (name) named.add(name);
        }
    }

    if (/^export\s+default\b/m.test(source)) hasDefault = true;
    return { named, hasDefault };
}

/**
 * Từng mệnh đề import và các tên nó yêu cầu.
 *
 * @param {string} source nội dung tệp
 * @returns {Array<{spec: string, named: string[], hasDefault: boolean}>}
 */
function readImports(source) {
    const statements = [];

    // import { a, b } from 'x'
    for (const match of source.matchAll(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)'/gm)) {
        statements.push({
            spec: match[2],
            named: match[1].split(',').map(part => part.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean),
            hasDefault: false
        });
    }

    // import x from 'y'
    for (const match of source.matchAll(/^import\s+(\w+)\s*from\s*'([^']+)'/gm)) {
        statements.push({ spec: match[2], named: [], hasDefault: true });
    }

    return statements;
}

function main() {
    const files = collectJsFiles(JS_ROOT);
    const problems = [];

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        for (const statement of readImports(source)) {
            if (!statement.spec.startsWith('.')) continue;

            const target = path.resolve(path.dirname(file), statement.spec);
            if (!fs.existsSync(target)) {
                problems.push(`${file}: import "${statement.spec}" — tệp không tồn tại`);
                continue;
            }

            const targetExports = readExports(fs.readFileSync(target, 'utf8'));
            for (const name of statement.named) {
                if (!targetExports.named.has(name)) {
                    problems.push(
                        `${path.relative(JS_ROOT, file)}: import { ${name} } `
                        + `từ "${statement.spec}" nhưng tệp đó KHÔNG export tên này`
                    );
                }
            }
            if (statement.hasDefault && !targetExports.hasDefault) {
                problems.push(
                    `${path.relative(JS_ROOT, file)}: import mặc định `
                    + `từ "${statement.spec}" nhưng tệp đó không có export default`
                );
            }
        }
    }

    if (problems.length) {
        console.log(`${problems.length} khong khop giua import va export:\n`);
        console.log(problems.join('\n'));
        process.exit(1);
    }
    console.log(`OK - ${files.length} tep: moi ten import deu co export tuong ung`);
}

main();