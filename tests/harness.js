'use strict';

/**
 * Bộ kiểm thử nhẹ, không phụ thuộc thư viện ngoài và không cần MongoDB.
 *
 * Mỗi tệp kiểm thử trong tests/ trả về một hàm `run(t)` trong đó `t` là
 * một bộ assertion tối giản. Bộ này đảm bảo `npm test` chạy được trên máy
 * không có cơ sở dữ liệu, đồng thời vẫn kiểm tra đúng logic chấm điểm,
 * parser DOCX, validator và bảo mật đầu vào.
 */

let passed = 0;
let failed = 0;
const failures = [];
let currentSuite = '';

/** Assertion tối giản, không dùng thư viện ngoài. */
const assert = {
    ok(value, message = 'Điều kiện phải đúng') {
        if (!value) throw new Error(message);
    },
    equal(actual, expected, message = 'Hai giá trị phải bằng nhau') {
        if (actual !== expected) {
            throw new Error(`${message} — nhận ${JSON.stringify(actual)}, cần ${JSON.stringify(expected)}`);
        }
    },
    notEqual(actual, expected, message = 'Hai giá trị phải khác nhau') {
        if (actual === expected) throw new Error(`${message} — cả hai đều là ${JSON.stringify(actual)}`);
    },
    deepEqual(actual, expected, message = 'Hai cấu trúc phải giống nhau') {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) throw new Error(`${message} — nhận ${a}, cần ${b}`);
    },
    /** So số trong khoảng, tránh lỗi số thực. */
    closeTo(actual, expected, epsilon = 1e-9, message = 'Gần bằng') {
        if (Math.abs(Number(actual) - Number(expected)) > epsilon) {
            throw new Error(`${message} — nhận ${actual}, cần ${expected}`);
        }
    },
    throws(fn, message = 'Hàm phải ném lỗi') {
        try {
            fn();
        } catch {
            return;
        }
        throw new Error(message);
    },
    includes(haystack, needle, message = 'Chuỗi phải chứa đoạn cần tìm') {
        const text = String(haystack ?? '');
        const found = Array.isArray(needle)
            ? needle.some(item => text.includes(item))
            : text.includes(needle);
        if (!found) throw new Error(`${message} — "${needle}" không có trong "${text.slice(0, 200)}"`);
    }
};

/** Ghi kết quả của một phép kiểm tra, nuốt lỗi để chạy tiếp. */
function runCase(name, fn) {
    try {
        fn(assert);
        passed += 1;
        process.stdout.write('  ✓ ');
    } catch (error) {
        failed += 1;
        failures.push({ suite: currentSuite, name, message: error.message });
        process.stdout.write('  ✗ ');
    }
    process.stdout.write(`${name}\n`);
}

/** Bắt đầu một nhóm kiểm thử. */
function suite(name) {
    currentSuite = name;
    console.log(`\n📁 ${name}`);
}

/** In bảng tổng kết và trả về mã thoát cho process. */
function summary() {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Kết quả: ${passed} đạt, ${failed} không đạt.`);
    if (failures.length) {
        console.log('\nChi tiết lỗi:');
        for (const item of failures) {
            console.log(`  ✗ [${item.suite}] ${item.name}`);
            console.log(`      ${item.message}`);
        }
        return 1;
    }
    console.log('✅ Tất cả kiểm thử đều đạt.');
    return 0;
}

module.exports = { assert, runCase, suite, summary };