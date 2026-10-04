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
// Tên tệp kiểm thử theo thứ tự ưu tiên: nền tảng trước, chi tiết sau.
const SUITES = [
    ['Chương trình lớp 1–12', './curriculum.test'],
    ['Chấm điểm 7 dạng câu hỏi', './scoring.test'],
    ['Nhập đề thi DOCX', './docx.test'],
    ['Validator và bảo mật', './security.test'],
    ['Hợp đồng API', './api-contract.test'],
    ['Giao diện web', './frontend.test']
];

/**
 * Các bộ kiểm thử viết theo kiểu tự chạy (in kết quả bằng `console.log`).
 *
 * Vì sao cần: các bộ này kiểm tra cả quy tắc nghiệp vụ lẫn thông điệp hiển
 * thị cho người học (ví dụ "Mini test chưa đạt: cần ít nhất 60%..."), nên phải
 * dùng `node:assert` trực tiếp thay vì bộ đếm của harness. Bộ đếm của harness
 * chỉ nhận hàm đồng bộ trả về `undefined`; các bộ này có bước bất đồng bộ
 * nên không vừa khuôn đó.
 *
 * Chạy độc lập: `node tests/assessment-policy.test.js`.
 */
const SELF_RUNNING_SUITES = [
    // Cấu trúc bộ kiểm thử phải đúng trước, nếu không các nhóm sau có thể
    // chạy sai số lần mà vẫn báo đạt.
    ['Cấu trúc bộ kiểm thử', './structure.test'],
    ['Dữ liệu chương trình và bộ sách', './curriculum-browse.test'],
    ['Chính sách đánh giá và mốc tiến độ', './assessment-policy.test']
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

    // Các bộ tự chạy: ném lỗi khi hỏng, không dùng bộ đếm của harness.
    // Chạy kiểm tra cấu trúc TRƯỚC để phát hiện sớm một khối `suite()` bị chèn
    // nhầm vào vòng lặp — lỗi khiến cùng một nhóm chạy hàng trăm lần mà vẫn
    // báo "đạt", che mất việc kiểm tra thật sự đã diễn ra.
    for (const [name, path] of SELF_RUNNING_SUITES) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`▶ ${name}`);
        // eslint-disable-next-line global-require, import/no-dynamic-require
        require(path);
    }

    process.exit(summary());
}

main().catch(error => {
    console.error('\n❌ Bộ kiểm thử gặp lỗi không mong đợi:');
    console.error(error);
    process.exit(1);
});