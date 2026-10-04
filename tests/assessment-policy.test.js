'use strict';

/**
 * KIỂM TRA CHÍNH SÁCH ĐÁNH GIÁ VÀ MỐC TIẾN ĐỘ.
 *
 * Phạm vi: "học bao nhiêu bài thì được làm bài kiểm tra", điều kiện hoàn thành
 * bài học, và ranh giới giữa mini test / checkpoint / giữa kỳ / cuối kỳ.
 *
 * Trạng thái kiểm thử này KHÔNG cần cơ sở dữ liệu: phần còn lại của luồng học
 * (tiến độ đã lưu, điểm, lịch sử) cần MongoDB và được kiểm tra riêng.
 */

const assert = require('node:assert/strict');
const policyRegistry = require('../data/curriculum/assessment-policy-registry');
const calendar = require('../data/curriculum/academic-calendar');
const miniTestPolicy = require('../data/curriculum/mini-test-policy');
const milestone = require('../server/services/milestone.service');

/**
 * Đăng ký một nhóm kiểm tra.
 *
 * @param {string} name tên nhóm
 * @param {Function} body các phép kiểm tra
 */
function suite(name, body) {
    console.log(`\n${name}`);
    body();
}

/* ------------------------------------------------- Không giả quy định Bộ -- */

suite('Ngưỡng mặc định KHÔNG được trình bày là quy định của Bộ', () => {
    for (const grade of [1, 6, 10]) {
        const policy = policyRegistry.resolvePolicy({ grade });
        assert.equal(policy.isOfficialRegulation, false,
            `Lớp ${grade}: ngưỡng mặc định không phải quy định của Bộ`);
        assert.equal(policy.sourceKind, policyRegistry.SOURCE_KIND.PLATFORM_DEFAULT,
            `Lớp ${grade}: phải ghi rõ là mặc định nền tảng`);
        assert.equal(policy.verificationStatus,
            policyRegistry.VERIFICATION_STATUS.NEEDS_VERIFICATION,
            `Lớp ${grade}: ngưỡng chưa có căn cứ thì phải cần xác minh`);
    }
    console.log('  V Mọi ngưỡng mặc định đều ghi rõ nguồn và trạng thái xác minh');
});

suite('Ba cấp học có tham số khác nhau, không dùng một con số chung', () => {
    const primary = policyRegistry.resolvePolicy({ grade: 1 });
    const middle = policyRegistry.resolvePolicy({ grade: 6 });
    const high = policyRegistry.resolvePolicy({ grade: 10 });

    assert.equal(primary.educationLevel, 'primary');
    assert.equal(middle.educationLevel, 'middle');
    assert.equal(high.educationLevel, 'high');

    const values = new Set([primary, middle, high].map(item => item.lessonsBeforeCheckpoint));
    assert.ok(values.size > 1, 'Không được áp một con số giống nhau cho cả 1–12');

    // Lớp ngoài phạm vi vẫn trả về policy hợp lệ thay vì ném lỗi.
    assert.ok(policyRegistry.resolvePolicy({ grade: 99 }), 'Lớp lạ vẫn có policy dự phòng');
    console.log(`  V Tiểu học=${primary.lessonsBeforeCheckpoint}, `
        + `THCS=${middle.lessonsBeforeCheckpoint}, THPT=${high.lessonsBeforeCheckpoint}`);
});

suite('Policy ghi đè theo lớp/môn được ưu tiên và mang nguồn', () => {
    policyRegistry.clearOverrides();
    policyRegistry.upsertOverride({
        grade: 6,
        subjectId: 'toan',
        lessonsBeforeCheckpoint: 5,
        source: 'Lịch kiểm tra giữa kỳ năm học 2025-2026 của trường'
    });

    const forToan = policyRegistry.resolvePolicy({ grade: 6, subjectId: 'toan' });
    assert.equal(forToan.lessonsBeforeCheckpoint, 5, 'Phải dùng policy ghi đè');
    assert.equal(forToan.sourceKind, policyRegistry.SOURCE_KIND.SCHOOL_SCHEDULE);
    assert.ok(forToan.source.includes('trường'), 'Phải giữ nguồn của lịch nhà trường');

    // Môn khác cùng lớp vẫn dùng policy mặc định.
    assert.equal(
        policyRegistry.resolvePolicy({ grade: 6, subjectId: 'ngu_van' }).lessonsBeforeCheckpoint,
        policyRegistry.resolvePolicy({ grade: 6 }).lessonsBeforeCheckpoint,
        'Môn không có ghi đè phải rơi về policy mặc định'
    );

    policyRegistry.clearOverrides();
    console.log('  V Ghi đè có hiệu lực, môn khác không bị ảnh hưởng');
});

/* ---------------------------------------------------------------- Mốc -- */

suite('Điều kiện mở checkpoint chỉ đạt khi đủ bài VÀ đủ phạm vi', () => {
    const scope = milestone.lessonScope({ grade: 6, subjectId: 'toan' });
    assert.ok(scope.length > 8, 'Cần đủ bài để kiểm tra ngưỡng');

    const nothing = milestone.evaluateMilestone({ grade: 6, subjectId: 'toan', completedLessonId: [] });
    assert.equal(nothing.checkpoint.eligible, false, 'Chưa học gì thì chưa đủ điều kiện');
    assert.equal(nothing.coveragePercent, 0);
    assert.ok(nothing.checkpoint.remainingLessons > 0, 'Phải báo còn thiếu bao nhiêu bài');

    const all = milestone.evaluateMilestone({
        grade: 6,
        subjectId: 'toan',
        completedLessonId: scope.map(item => item.lessonId)
    });
    assert.equal(all.checkpoint.eligible, true, 'Học hết phải đủ điều kiện checkpoint');
    assert.equal(all.coveragePercent, 100);
    console.log(`  V Phạm vi ${scope.length} bài; đủ bài thì mở checkpoint`);
});

suite('Phạm vi rỗng không được báo nhầm là "học chưa đủ"', () => {
    const empty = milestone.evaluateMilestone({ grade: 6, subjectId: 'khong_ton_tai' });
    for (const key of ['checkpoint', 'midterm', 'final']) {
        assert.equal(empty[key].eligible, false, `${key} phải không mở`);
        assert.equal(empty[key].hasScope, false, `${key} phải báo là chưa có phạm vi`);
    }
    console.log('  V Môn chưa có bài: mọi mốc đều khai rõ chưa có phạm vi');
});

suite('Mốc ghi nguồn và không tự nhận là quy định Bộ', () => {
    const result = milestone.evaluateMilestone({ grade: 6, subjectId: 'toan' });
    for (const key of ['checkpoint', 'midterm', 'final']) {
        const item = result[key];
        assert.ok(item.source, `${key} phải có nguồn`);
/* ---------------------------------------------- Điều kiện hoàn thành bài -- */

suite('Mở bài KHÔNG đủ để coi là hoàn thành', () => {
    const justOpened = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: false
    });
    assert.equal(justOpened.completed, false, 'Mở bài không được tính hoàn thành');
    assert.ok(justOpened.reasons.length > 0, 'Phải nói rõ còn thiếu gì');
    console.log(`  V Chưa đọc: "${justOpened.reasons[0]}"`);
});

suite('Đọc xong nhưng chưa làm mini test vẫn chưa hoàn thành', () => {
    const read = milestone.evaluateLessonCompletion({ grade: 6, subjectId: 'toan', readingDone: true });
    assert.equal(read.completed, false);
    assert.ok(read.reasons.some(reason => reason.includes('mini test')), 'Phải nhắc làm mini test');
    console.log(`  V "${read.reasons[0]}"`);
});

suite('Mini test đạt ngưỡng thì hoàn thành bài', () => {
    const passed = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 80
    });
    assert.equal(passed.completed, true, 'Đạt 80% (> 60%) thì hoàn thành');

    // Chỉ đạt đúng ngưỡng vẫn đủ.
    const exact = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 60
    });
    assert.equal(exact.completed, true, 'Đúng ngưỡng cũng được');
    console.log('  V Đạt ngưỡng -> hoàn thành bài');
});

suite('Mini test trượt KHÔNG được tạo kết quả đạt giả', () => {
    const failed = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 30
    });
    assert.equal(failed.completed, false, 'Trượt thì chưa hoàn thành');
    assert.ok(failed.reasons.some(reason => reason.includes('30')), 'Phải nêu kết quả thực tế');
    console.log(`  V "${failed.reasons[0]}"`);
});

suite('Làm lại không làm mất kết quả đã đạt, hết lượt thì báo rõ', () => {
    // Kết quả tốt nhất đã đạt: còn lượt làm lại vẫn giữ trạng thái đạt.
    const keepPassed = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 75,
        attemptsAllowed: 3, attemptsUsed: 1
    });
    assert.equal(keepPassed.completed, true, 'Đã đạt thì không mất trạng thái');
    assert.equal(keepPassed.remainingAttempts, 2);

    // Hết lượt mà chưa từng làm: báo hết lượt, KHÔNG tự coi là đạt.
    const exhausted = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: false, miniTestBestPercent: 0,
        attemptsAllowed: 3, attemptsUsed: 3
    });
    assert.equal(exhausted.completed, false, 'Hết lượt mà chưa làm thì không đạt');
    assert.equal(exhausted.remainingAttempts, 0);
    console.log('  V Làm lại giữ kết quả tốt nhất; hết lượt thì báo rõ');
});

/* ------------------------------------------------------- Phân loại mốc -- */

suite('Mini test / checkpoint / giữa kỳ / cuối kỳ là các loại riêng', () => {
    const types = policyRegistry.ASSESSMENT_TYPE;
    const all = Object.values(types);
    assert.equal(new Set(all).size, all.length, 'Các loại không được trùng nhau');
    for (const name of ['PRACTICE', 'MINI_TEST', 'CHECKPOINT', 'MIDTERM', 'FINAL']) {
        assert.ok(types[name], `Thiếu loại ${name}`);
    }
    // Mini test không được tự biến thành điểm định kỳ.
    assert.notEqual(types.MINI_TEST, types.MIDTERM);
    assert.notEqual(types.CHECKPOINT, types.FINAL);
    assert.notEqual(types.PRACTICE, types.MIDTERM);
    console.log(`  V ${all.length} loại đánh giá: ${all.join(', ')}`);
});

/* ----------------------------------------------- Năm học và học kỳ -- */

suite('Năm học và học kỳ suy ra đúng theo tháng', () => {
    // Tháng 9 trở đi thuộc năm học bắt đầu năm đó.
    const sept = calendar.academicYearOf(new Date(2025, 8, 15));
    assert.equal(sept.id, '2025-2026');
    assert.equal(calendar.currentSemesterId(new Date(2025, 8, 15)), 1, 'Tháng 9 là học kỳ 1');

    // Tháng 1 vẫn thuộc năm học đã bắt đầu năm trước.
    const jan = calendar.academicYearOf(new Date(2026, 0, 20));
    assert.equal(jan.id, '2025-2026', 'Tháng 1 vẫn thuộc năm học bắt đầu năm trước');
    assert.equal(calendar.currentSemesterId(new Date(2026, 0, 20)), 1);

    assert.equal(calendar.currentSemesterId(new Date(2026, 3, 1)), 2, 'Tháng 4 là học kỳ 2');
    console.log('  V Năm học và học kỳ suy ra đúng');
});

/* -------------------------------------------------- Cấu hình mini test -- */

suite('Cấu hình mini test có thể ghi đè theo lớp/môn', () => {
    miniTestPolicy.clearMiniTestConfigs();
    const base = miniTestPolicy.resolveMiniTestConfig({ grade: 6, subjectId: 'toan' });
    assert.equal(base.questionCount, 5);
    assert.equal(base.passPercent, 60);
    assert.equal(base.maxAttempts, 3);
    assert.equal(base.isOfficialRegulation, false, 'Không phải quy định Bộ');

    miniTestPolicy.upsertMiniTestConfig({ grade: 6, subjectId: 'toan', questionCount: 3, passPercent: 80 });
    const overridden = miniTestPolicy.resolveMiniTestConfig({ grade: 6, subjectId: 'toan' });
    assert.equal(overridden.questionCount, 3);
    assert.equal(overridden.passPercent, 80);
    assert.equal(miniTestPolicy.resolveMiniTestConfig({ grade: 6, subjectId: 'ngu_van' }).questionCount, 5,
        'Môn khác không bị ảnh hưởng');

    miniTestPolicy.clearMiniTestConfigs();
    console.log('  V Ghi đè có hiệu lực và có thể hoàn nguyên');
});

console.log('\nOK - chinh sach danh gia va moc tien do dat dung');
        assert.ok(item.verificationStatus, `${key} phải có trạng thái xác minh`);
        assert.equal(item.isOfficialRegulation, false);
    }
    assert.equal(milestone.sourceLabel('PLATFORM_DEFAULT'), 'Mặc định của nền tảng');
    assert.equal(milestone.sourceLabel('SCHOOL_SCHEDULE'), 'Theo lịch nhà trường');
    console.log('  V Mọi mốc mang nguồn, nhãn nguồn không gọi nhầm là quy định Bộ');
});