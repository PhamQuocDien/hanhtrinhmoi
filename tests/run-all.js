#!/usr/bin/env node
'use strict';

/**
 * Điểm khởi chạy của toàn bộ bộ kiểm thử.
 *
 *   node tests/run-all.js
 *
 * Không cần MongoDB: mọi kiểm thử đều chạy trên dữ liệu tĩnh và hàm thuần.
 * Nhờ vậy `npm test` chạy được ở máy mới cài dự án, trên CI, và trong container.
 */

const { summary } = require('./harness');

// Tên tệp kiểm thử theo thứ tự ưu tiên: nền tảng trước, chi tiết sau.
const SUITES = [
    ['Chương trình lớp 1–12', './curriculum.test'],
    ['Chấm điểm 7 dạng câu hỏi', './scoring.test'],
    ['Nhập đề thi DOCX', './docx.test'],
    ['Validator và bảo mật', './security.test'],
    ['Hợp đồng API', './api-contract.test'],
    ['Giao diện web', './frontend.test']
];

async function main() {
    console.log('🧪 Kiểm thử nền tảng học tập — Hành Tinh Mơ Ước');

    for (const [name, path] of SUITES) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`▶ ${name}`);
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const suiteModule = require(path);
        // eslint-disable-next-line no-await-in-loop
        await suiteModule.run();
    }

    process.exit(summary());
}

main().catch(error => {
    console.error('\n❌ Bộ kiểm thử gặp lỗi không mong đợi:');
    console.error(error);
    process.exit(1);
});