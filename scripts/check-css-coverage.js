'use strict';

/**
 * ĐO ĐỘ PHỦ CSS — class trong HTML mà CSS chưa định nghĩa.
 *
 * Bắt được nguyên nhân giao diện "như HTML mặc định": thẻ có class nhưng không
 * có luật nào, nên trình duyệt vẽ ra theo mặc định.
 *
 * Dùng khi:  node scripts/check-css-coverage.js
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function walk(dir, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, results);
        else results.push(full);
    }
    return results;
}

const files = walk(PUBLIC_DIR);
const htmlFiles = files.filter(f => f.endsWith('.html'));
const cssFiles = files.filter(f => f.endsWith('.css'));

// Gom class dùng trong HTML.
const used = new Map();
for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/class="([^"]+)"/g)) {
        for (const name of match[1].trim().split(/\s+/)) {
            if (!name) continue;
            if (!used.has(name)) used.set(name, []);
            used.get(name).push(path.relative(PUBLIC_DIR, file).replace(/\\/g, '/'));
        }
    }
}

// Gom class và biến có trong CSS.
const cssText = cssFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const defined = new Set();
for (const match of cssText.matchAll(/\.([a-zA-Z][\w-]*)/g)) defined.add(match[1]);

const missing = [...used.entries()]
    .filter(([name]) => !defined.has(name))
    .map(([name, pages]) => `  ${name.padEnd(26)} <- ${[...new Set(pages)].join(', ')}`);

console.log(`HTML dung ${used.size} class khac nhau; CSS dinh nghia ${defined.size} class.`);
if (missing.length) {
    console.log(`\n${missing.length} class CHUA duoc CSS dinh nghia:`);
    console.log(missing.join('\n'));
} else {
    console.log('\nMoi class trong HTML deu co quy tac CSS.');
}