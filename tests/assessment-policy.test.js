'use strict';

/**
 * CHÍNH SÁCH ĐÁNH GIÁ, MỐC TIẾN ĐỘ VÀ LỊCH HỌC KỲ.
 *
 * Phạm vi: "học bao nhiêu bài thì được làm bài kiểm tra", điều kiện hoàn thành
 * bài học, và cờ checkpoint theo tuần học.
 *
 * Không cần cơ sở dữ liệu: dữ liệu chương trình nằm trong registry tĩnh.
 */

const assert = require('node:assert/strict');
const policy = require('../data/curriculum/assessment-policy-registry');
const academic = require('../data/curriculum/academic-calendar');
const miniTestPolicy = require('../data/curriculum/mini-test-policy');
const milestone = require('../server/services/milestone.service');
const schoolCalendar = require('../server/services/school-calendar.service');

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

const { SOURCE_KIND, VERIFICATION_STATUS, ASSESSMENT_TYPE } = policy;

suite('Ngưỡng mặc định KHÔNG được trình bày là quy định của Bộ', () => {
    for (const grade of [1, 6, 10]) {
        const item = policy.resolvePolicy({ grade });
        assert.equal(item.isOfficialRegulation, false, `Lớp ${grade}: không phải quy định Bộ`);
        assert.equal(item.sourceKind, SOURCE_KIND.PLATFORM_DEFAULT, 'Phải ghi rõ là mặc định');
        assert.equal(item.verificationStatus, VERIFICATION_STATUS.NEEDS_VERIFICATION);
        assert.ok(item.source, 'Phải có nguồn để hiển thị');
    }
    console.log('  V Mọi ngưỡng mặc định đều ghi rõ nguồn và trạng thái xác minh');
});

suite('Ba cấp học có tham số khác nhau', () => {
    const primary = policy.resolvePolicy({ grade: 1 });
    const middle = policy.resolvePolicy({ grade: 6 });
    const high = policy.resolvePolicy({ grade: 10 });

    assert.equal(primary.educationLevel, 'primary');
    assert.equal(middle.educationLevel, 'middle');
    assert.equal(high.educationLevel, 'high');

    const values = new Set([primary, middle, high].map(item => item.lessonsBeforeCheckpoint));
    assert.ok(values.size > 1, 'Không được áp một con số giống nhau cho cả 1–12');
    assert.ok(policy.resolvePolicy({ grade: 99 }), 'Lớp lạ vẫn có policy dự phòng');

    console.log(`  V Tiểu học=${primary.lessonsBeforeCheckpoint}, `
        + `THCS=${middle.lessonsBeforeCheckpoint}, THPT=${high.lessonsBeforeCheckpoint}`);
});

suite('Policy ghi đè theo lớp/môn được ưu tiên và mang nguồn', () => {
    policy.clearOverrides();
    policy.upsertOverride({
        grade: 6,
        subjectId: 'toan',
        lessonsBeforeCheckpoint: 5,
        source: 'Lịch kiểm tra năm học của trường'
    });

    const forToan = policy.resolvePolicy({ grade: 6, subjectId: 'toan' });
    assert.equal(forToan.lessonsBeforeCheckpoint, 5, 'Phải dùng policy ghi đè');
    assert.equal(forToan.sourceKind, SOURCE_KIND.SCHOOL_SCHEDULE);
    assert.ok(forToan.source.includes('trường'));

    assert.equal(
        policy.resolvePolicy({ grade: 6, subjectId: 'ngu_van' }).lessonsBeforeCheckpoint,
        policy.resolvePolicy({ grade: 6 }).lessonsBeforeCheckpoint,
        'Môn không ghi đè phải rơi về policy mặc định'
    );

    policy.clearOverrides();
    console.log('  V Ghi đè có hiệu lực, môn khác không bị ảnh hưởng');
});

suite('Điều kiện mở checkpoint cần đủ bài VÀ đủ phạm vi', () => {
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
    assert.equal(all.checkpoint.eligible, true, 'Học hết phải đủ điều kiện');
    assert.equal(all.coveragePercent, 100);
    console.log(`  V Phạm vi ${scope.length} bài; đủ bài thì mở checkpoint`);
});

suite('Phạm vi rỗng không báo nhầm là "học chưa đủ"', () => {
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
        assert.ok(item.verificationStatus, `${key} phải có trạng thái xác minh`);
        assert.equal(item.isOfficialRegulation, false);
    }
    assert.equal(milestone.sourceLabel('PLATFORM_DEFAULT'), 'Mặc định của nền tảng');
    assert.equal(milestone.sourceLabel('SCHOOL_SCHEDULE'), 'Theo lịch nhà trường');
    console.log('  V Mọi mốc mang nguồn, nhãn không gọi nhầm là quy định Bộ');
});

suite('Mở bài KHÔNG đủ để coi là hoàn thành', () => {
    const opened = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: false
    });
    assert.equal(opened.completed, false, 'Mở bài không được tính hoàn thành');
    assert.ok(opened.reasons.length > 0, 'Phải nói rõ còn thiếu gì');
    console.log(`  V Chưa đọc: "${opened.reasons[0]}"`);
});

suite('Đọc xong nhưng chưa làm mini test vẫn chưa hoàn thành', () => {
    const read = milestone.evaluateLessonCompletion({ grade: 6, subjectId: 'toan', readingDone: true });
    assert.equal(read.completed, false);
    assert.ok(read.reasons.some(reason => reason.includes('mini test')));
    console.log(`  V "${read.reasons[0]}"`);
});

suite('Mini test đạt ngưỡng thì hoàn thành; trượt thì không tạo kết quả đạt giả', () => {
    const passed = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 80
    });
    assert.equal(passed.completed, true, 'Đạt 80% (> 60%) thì hoàn thành');

    const exact = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 60
    });
    assert.equal(exact.completed, true, 'Đúng ngưỡng cũng được');

    const failed = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 30
    });
    assert.equal(failed.completed, false, 'Trượt thì chưa hoàn thành');
    assert.ok(failed.reasons.some(reason => reason.includes('30')), 'Phải nêu kết quả thực tế');
    console.log('  V Đạt ngưỡng -> hoàn thành; trượt -> nêu rõ điểm thật');
});

suite('Làm lại không làm mất kết quả đã đạt, hết lượt thì báo rõ', () => {
    const keepPassed = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: true, miniTestBestPercent: 75,
        attemptsAllowed: 3, attemptsUsed: 1
    });
    assert.equal(keepPassed.completed, true, 'Đã đạt thì không mất trạng thái');
    assert.equal(keepPassed.remainingAttempts, 2);

    const exhausted = milestone.evaluateLessonCompletion({
        grade: 6, subjectId: 'toan', readingDone: true,
        miniTestAttempted: false, miniTestBestPercent: 0,
        attemptsAllowed: 3, attemptsUsed: 3
    });
    assert.equal(exhausted.completed, false, 'Hết lượt mà chưa làm thì không đạt');
    assert.equal(exhausted.remainingAttempts, 0);
    console.log('  V Làm lại giữ kết quả tốt nhất; hết lượt thì báo rõ');
});

suite('Mini test / checkpoint / giữa kỳ / cuối kỳ là các loại riêng', () => {
    const all = Object.values(ASSESSMENT_TYPE);
    assert.equal(new Set(all).size, all.length, 'Các loại không được trùng nhau');
    for (const name of ['PRACTICE', 'MINI_TEST', 'CHECKPOINT', 'MIDTERM', 'FINAL']) {
        assert.ok(ASSESSMENT_TYPE[name], `Thiếu loại ${name}`);
    }
    // Mini test không được tự biến thành điểm định kỳ.
    assert.notEqual(ASSESSMENT_TYPE.MINI_TEST, ASSESSMENT_TYPE.MIDTERM);
    assert.notEqual(ASSESSMENT_TYPE.CHECKPOINT, ASSESSMENT_TYPE.FINAL);
    assert.notEqual(ASSESSMENT_TYPE.PRACTICE, ASSESSMENT_TYPE.MIDTERM);
    console.log(`  V ${all.length} loại đánh giá: ${all.join(', ')}`);
});

suite('Năm học và học kỳ suy ra đúng theo tháng', () => {
    assert.equal(academic.academicYearOf(new Date(2025, 8, 15)).id, '2025-2026');
    assert.equal(academic.currentSemesterId(new Date(2025, 8, 15)), 1, 'Tháng 9 là học kỳ 1');
    // Tháng 1 vẫn thuộc năm học đã bắt đầu năm trước.
    assert.equal(academic.academicYearOf(new Date(2026, 0, 20)).id, '2025-2026');
    assert.equal(academic.currentSemesterId(new Date(2026, 3, 1)), 2, 'Tháng 4 là học kỳ 2');
    console.log('  V Năm học và học kỳ suy ra đúng');
});

suite('Cấu hình mini test ghi đè được và hoàn nguyên được', () => {
    miniTestPolicy.clearMiniTestConfigs();
    const base = miniTestPolicy.resolveMiniTestConfig({ grade: 6, subjectId: 'toan' });
    assert.equal(base.questionCount, 5);
    assert.equal(base.passPercent, 60);
    assert.equal(base.maxAttempts, 3);
    assert.equal(base.isOfficialRegulation, false, 'Không phải quy định Bộ');

    miniTestPolicy.upsertMiniTestConfig({
        grade: 6, subjectId: 'toan', questionCount: 3, passPercent: 80
    });
    const overridden = miniTestPolicy.resolveMiniTestConfig({ grade: 6, subjectId: 'toan' });
    assert.equal(overridden.questionCount, 3);
    assert.equal(overridden.passPercent, 80);
    assert.equal(
        miniTestPolicy.resolveMiniTestConfig({ grade: 6, subjectId: 'ngu_van' }).questionCount, 5,
        'Môn khác không bị ảnh hưởng'
    );

    miniTestPolicy.clearMiniTestConfigs();
    console.log('  V Ghi đè có hiệu lực và có thể hoàn nguyên');
});

suite('Lịch học kỳ lấy cờ checkpoint từ một nguồn duy nhất', () => {
    const weeks = schoolCalendar.buildWeekPlan({ totalLessons: 140 });
    assert.equal(weeks.length, schoolCalendar.WEEKS_PER_SCHOOL_YEAR);
    assert.ok(weeks.every(item => item.week > 0 && item.targetLessons >= 1));
    // Cờ checkpoint không được ghi thẳng trong route nữa.
    const flagged = weeks.filter(item => item.checkpoint).map(item => item.week);
    assert.deepEqual(flagged, [...schoolCalendar.CHECKPOINT_WEEKS]);
    assert.equal(new Set(weeks.map(item => item.phase)).size, 4, 'Phải có 4 giai đoạn');
    console.log(`  V ${weeks.length} tuần, mốc tại tuần ${flagged.join(', ')}`);
});

suite('Số bài kỳ vọng luôn nằm trong giới hạn', () => {
    assert.equal(schoolCalendar.expectedLessonsAtWeek(100, 35), 100);
    assert.ok(schoolCalendar.expectedLessonsAtWeek(10, 35) <= 10, 'Không vượt tổng số bài');
    assert.equal(schoolCalendar.clampWeek(0), 1);
    assert.equal(schoolCalendar.clampWeek(999), schoolCalendar.WEEKS_PER_SCHOOL_YEAR);
    assert.equal(schoolCalendar.clampWeek('abc'), 1, 'Tuần không phải số thì về tuần đầu');
    console.log('  V Số bài kỳ vọng và tuần đều được kẹp về biên hợp lệ');
});

console.log('\nOK - chinh sach danh gia va lich hoc ky dat dung');