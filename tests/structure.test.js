'use strict';

/**
 * KIỂM TRA TÍNH TOÀN VẸN CỦA BỘ KIỂM THỬ.
 *
 * Bắt loại lỗi đã thực sự xảy ra trong dự án: một khối `suite(...)` bị chèn
 * nhầm vào GIỮA một vòng lặp, khiến cùng một nhóm kiểm tra chạy hàng trăm lần
 * mà bộ kiểm thử vẫn báo "đạt". Loại lỗi này nguy hiểm vì nó làm đầu ra khó
 * đọc và che mất việc kiểm tra thật sự đã chạy.
 *
 * Hai phép kiểm tra:
 *   1. Không có tên nhóm kiểm tra nào bị lặp trong cùng một tệp.
 *   2. Không có lệnh `suite(` nào nằm sâu bên trong một vòng lặp chưa đóng.
 *
 * Dùng khi:  node tests/structure.test.js
 */

const fs = require('fs');
const path = require('path');

const TESTS_DIR = __dirname;

/** @param {string} name tên tệp kiểm thử @returns {string} nội dung */
function readTest(name) {
    return fs.readFileSync(path.join(TESTS_DIR, name), 'utf8');
}

/**
 * Ghi nhận các dòng mở vòng lặp mà chưa đóng.
 *
 * Khác với `depthPerLine`, hàm này chỉ tính `for` / `while` / `do`, bỏ qua
 * hàm và khối. Nhờ vậy một lời gọi `suite()` nằm trong `run()` vẫn được coi là
 * hợp lệ, còn lời gọi nằm trong vòng lặp thì bị bắt đúng.
 *
 * @param {string} source nội dung tệp
 * @returns {number[]} số vòng lặp đang mở tính TỚI TRƯỚC mỗi dòng
 */
function openLoopsBefore(source) {
    const result = [];
    // Mỗi phần tử là chiều sâu của vòng lặp đó; null nghĩa là vòng lặp đã đóng.
    const stack = [];
    let counter = 0;

    for (const rawLine of source.split('\n')) {
        result.push(counter);
        const line = stripLiterals(rawLine);

        for (const token of line.matchAll(/\b(for|while|do|switch)\b/g)) {
            if (token[1] === 'for' || token[1] === 'while' || token[1] === 'do') {
                stack.push(counter);
                counter += 1;
            }
        }
        for (const token of line.matchAll(/[{}]/g)) {
            if (token[0] === '}') {
                // Đóng vòng lặp gần nhất đang mở.
                for (let i = stack.length - 1; i >= 0; i -= 1) {
                    if (stack[i] !== null) {
                        stack[i] = null;
                        counter -= 1;
                        break;
                    }
                }
            }
        }
    }
    return result;
}

/** Bỏ phần chuỗi và chú thích để không đếm nhầm từ khoá trong văn bản. */
function stripLiterals(line) {
    return line
        .replace(/\/\/.*$/, '')
        .replace(/'(\\.|[^'\\])*'/g, "''")
        .replace(/"(\\.|[^"\\])*"/g, '""')
        .replace(/`(\\.|[^`\\])*`/g, '``');
}

let failures = 0;

/**
 * Ghi kết quả một phép kiểm tra.
 *
 * @param {string} label nhãn
 * @param {boolean} ok kết quả
 * @param {string} [detail] chi tiết lỗi
 */
function report(label, ok, detail = '') {
    if (ok) {
        console.log(`  V ${label}`);
    } else {
        failures += 1;
        console.log(`  X ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

console.log('📁 Kiểm thử — cấu trúc bộ kiểm thử');

// --- 1. Không có tên nhóm nào bị lặp --------------------------------------
for (const name of fs.readdirSync(TESTS_DIR).filter(item => item.endsWith('.test.js'))) {
    const source = readTest(name);
    const titles = [...source.matchAll(/^suite\(\s*'([^']+)'/gm)].map(match => match[1]);
    const seen = new Set();
    const repeated = [];
    for (const title of titles) {
        if (seen.has(title)) repeated.push(title);
        seen.add(title);
    }
    report(
        `${name}: ${titles.length} nhóm, không lặp tên`,
        repeated.length === 0,
        repeated.length ? `lặp: ${repeated.join(' | ')}` : ''
    );
}

// --- 2. Không có suite() nào nằm sâu trong vòng lặp -----------------------
// Một `suite(...)` nằm bên trong vòng lặp sẽ chạy nhiều lần.
//
// Cách tính: lấy độ sâu ngoặc tính TỚI TRƯỚC dòng đó. Một lời gọi ở cấp cao
// nhất sẽ có độ sâu trước = 0; nếu nằm trong `for`/`while` thì độ sâu trước > 0.
// Không tính ngoặc của chính dòng đang xét, vì `suite('...', () => {` luôn mở
// thêm một cặp ngoặc ngay trên dòng đó.
for (const name of fs.readdirSync(TESTS_DIR).filter(item => item.endsWith('.test.js'))) {
    const source = readTest(name);
    const loops = openLoopsBefore(source);
    const lines = source.split('\n');

    const nested = [];
    lines.forEach((line, index) => {
        if (!/^\s*suite\(/.test(line)) return;
        if (loops[index] > 0) nested.push(`dong ${index + 1} (trong ${loops[index]} vong lap)`);
    });

    report(
        `${name}: không có suite() nằm trong vòng lặp`,
        nested.length === 0,
        nested.length ? nested.join(', ') : ''
    );
}

console.log(failures === 0
    ? '\n✅ Cấu trúc bộ kiểm thử hợp lệ.'
    : `\n❌ ${failures} vấn đề cấu trúc.`);

// Chỉ tự kết thúc tiến trình khi chạy trực tiếp. Khi được `run-all.js` nạp vào,
// gọi `process.exit()` sẽ cắt ngang các bộ kiểm thử còn lại.
if (require.main === module) process.exit(failures === 0 ? 0 : 1);
else if (failures > 0) throw new Error(`${failures} vấn đề cấu trúc bộ kiểm thử.`);