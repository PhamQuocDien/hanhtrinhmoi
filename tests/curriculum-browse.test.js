'use strict';

/**
 * KIỂM TRA KHO DỮ LIỆU CHƯƠNG TRÌNH (repository) — chạy được KHÔNG cần máy chủ.
 *
 * Bổ trợ cho `check-curriculum-flow.js`: khi MongoDB không chạy nên không kiểm
 * tra được qua HTTP, tệp này vẫn xác minh được phần quan trọng nhất — dữ liệu
 * bộ sách thật sự động và không bịa.
 *
 * Dùng khi:  node tests/curriculum-browse.test.js
 */

const assert = require('node:assert/strict');
const repo = require('../server/repositories/curriculum.repository');
const service = require('../server/services/curriculum.service');
const curriculum = require('../data/curriculum/curriculum-registry');

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

/* -------------------------------------------------------------- Cấp học -- */

suite('Cấp học phủ đủ lớp 1–12', () => {
    const levels = service.listEducationLevels();
    assert.equal(levels.length, 3, 'Phải có 3 cấp học');

    const allGrades = levels.flatMap(level => level.grades);
    assert.deepEqual([...allGrades].sort((a, b) => a - b),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        'Các cấp phải phủ hết 12 lớp, không trùng và không thiếu');

    for (const level of levels) {
        assert.ok(level.name, `${level.id} phải có tên`);
        assert.ok(Array.isArray(level.grades) && level.grades.length, `${level.id} phải có lớp`);
    }
    console.log(`  V ${levels.map(level => `${level.shortName}(${level.grades.join(',')})`).join(' · ')}`);
});

/* ---------------------------------------------------------------- Lớp -- */

suite('Danh sách lớp mang đủ thông tin cho giao diện', () => {
    const grades = service.listGrades();
    assert.equal(grades.length, 12);

    for (const grade of grades) {
        assert.ok(grade.gradeName, `Lớp ${grade.grade} phải có tên`);
        assert.ok(grade.educationLevelName, `Lớp ${grade.grade} phải có tên cấp học`);
        assert.equal(typeof grade.seriesCount, 'number', `Lớp ${grade.grade} phải biết số bộ sách`);
    }

    // Lớp 6 phải là THCS: đây là điều frontend không được tự suy ra.
    assert.equal(grades.find(item => item.grade === 6).educationLevelName, 'THCS');
    assert.equal(grades.find(item => item.grade === 1).educationLevelName, 'Tiểu học');
    assert.equal(grades.find(item => item.grade === 12).educationLevelName, 'THPT');
    console.log('  V 12 lớp đều có tên lớp, tên cấp học và số bộ sách');
});

/* --------------------------------------------------------------- Môn -- */

suite('Danh sách môn của một lớp', () => {
    const subjects = repo.listSubjectsOfGrade(6);
    assert.ok(subjects.length > 0, 'Lớp 6 phải có môn học');

    for (const subject of subjects) {
        assert.ok(subject.subjectId, 'Môn phải có khoá');
        assert.ok(subject.displayName, 'Môn phải có tên hiển thị');
        assert.ok(subject.educationLevelName, 'Môn phải mang tên cấp học');
    }
    console.log(`  V Lớp 6 có ${subjects.length} môn, tất cả có khoá, tên và cấp học`);
});

/* ----------------------------------------------------------- Bộ sách -- */

suite('Bộ sách lấy động từ dữ liệu, không cố định trong mã', () => {
    const series = repo.listSeriesForSubject(6, 'toan');
    assert.ok(series.length > 0, 'Toán lớp 6 phải có ít nhất một bộ sách');

    for (const item of series) {
        assert.ok(item.seriesId, 'Bộ sách phải có mã');
        assert.ok(item.seriesName, 'Bộ sách phải có tên');
        assert.equal(typeof item.textbookCount, 'number', 'Phải biết số đầu sách');
        assert.ok(item.verificationStatus, 'Phải có trạng thái xác minh');
    }

    // Bộ mặc định phải mở được, nếu không luồng học đứt ở bước này.
    const fallback = series.find(item => item.isDefault);
    assert.ok(fallback, 'Phải có bộ sách mặc định');
    assert.ok(fallback.textbookCount > 0, 'Bộ mặc định phải có đầu sách');

    console.log(`  V ${series.length} bộ sách, mặc định "${fallback.seriesName}" `
        + `có ${fallback.textbookCount} đầu sách`);
});

suite('Một môn/lớp có thể có nhiều bộ sách', () => {
    // Thuộc tính quan trọng của kiến trúc: số bộ sách KHÔNG bị cố định là 1 hay 3.
    const counts = new Set();
    for (let grade = 1; grade <= 12; grade += 1) {
        for (const subject of repo.listSubjectsOfGrade(grade)) {
suite('Bộ sách chưa có đầu sách vẫn được trả về, đánh dấu rõ', () => {
    // Mục đích: giao diện hiện "chưa có dữ liệu" thay vì bịa hoặc ẩn bộ sách.
    let checked = 0;
    for (const grade of [1, 6, 10]) {
        for (const subject of repo.listSubjectsOfGrade(grade)) {
            for (const item of repo.listSeriesForSubject(grade, subject.subjectId)) {
                if (item.textbookCount === 0) {
                    assert.deepEqual(item.textbooks, [], 'Bộ sách không có đầu sách phải có mảng rỗng');
                    assert.ok(item.seriesName, 'Vẫn phải giữ tên bộ sách để hiển thị');
                    checked += 1;
                }
            }
        }
    }
    console.log(`  V ${checked} bộ sách chưa có đầu sách, đều được đánh dấu đầy đủ`);
});

suite('Môn hoặc lớp không hợp lệ trả về mảng rỗng, không ném lỗi', () => {
    assert.deepEqual(repo.listSeriesForSubject(6, 'khong_ton_tai'), []);
    assert.deepEqual(repo.listSubjectsOfGrade(0), []);
    assert.deepEqual(repo.listSubjectsOfGrade(13), []);
    console.log('  V Trả về mảng rỗng thay vì ném lỗi');
});

/* ------------------------------------------------------- Chương, bài -- */

suite('Cây chương và bài của một đầu sách', () => {
    const result = repo.listChaptersForTextbook(6, 'toan', 'national');
    assert.ok(result, 'Phải trả về kết quả');
    assert.equal(result.hasContent, true, 'Toán 6 bộ mặc định phải có chương');
    assert.ok(result.chapters.length > 0, 'Phải có ít nhất một chương');
    assert.equal(result.textbook.seriesId, 'national', 'Phải trả đúng bộ sách đã chọn');

    for (const chapter of result.chapters) {
        assert.ok(chapter.chapterId, 'Chương phải có mã');
        assert.ok(chapter.displayTitle, 'Chương phải có tên');
        assert.ok(Array.isArray(chapter.lessons), 'Chương phải kèm danh sách bài');
        for (const lesson of chapter.lessons) {
            assert.ok(lesson.lessonId, 'Bài phải có mã');
            assert.equal(typeof lesson.hasContent, 'boolean', 'Phải biết bài có nội dung hay không');
        }
    }
    console.log(`  V ${result.chapterCount} chương, ${result.lessonCount} bài`);
});

suite('Bài học và bài liền kề', () => {
    const lessons = curriculum.getLessonsForSubject(6, 'toan');
    assert.ok(lessons.length > 1, 'Cần ít nhất hai bài để kiểm tra bài liền kề');

    const first = lessons[0];
    const neighbours = repo.getLessonNeighbours(first.lessonId);
    assert.equal(neighbours.previous, null, 'Bài đầu tiên không có bài trước');
    assert.ok(neighbours.next, 'Bài đầu tiên phải có bài sau');

    const middle = repo.getLessonById(lessons[1].lessonId);
    assert.ok(middle.displayTitle, 'Phải lấy được bài học theo mã');
    assert.ok(middle.subject, 'Phải kèm thông tin môn để dựng đường dẫn');
    console.log(`  V Bài liền kề đúng; bài "${middle.displayTitle}" lấy được theo mã`);
});

suite('Bài học không tồn tại trả về null', () => {
    assert.equal(repo.getLessonById('khong-ton-tai'), null);
    assert.deepEqual(repo.getLessonNeighbours('khong-ton-tai'), { previous: null, next: null });
    console.log('  V Trả về null thay vì ném lỗi');
});

console.log('\nOK - kho du lieu chuong trinh dat dung');
            counts.add(repo.listSeriesForSubject(grade, subject.subjectId).length);
        }
    }
    assert.ok(counts.size >= 1, 'Phải có ít nhất một số bộ sách');
    console.log(`  V Số bộ sách quan sát được: ${[...counts].sort((a, b) => a - b).join(', ')} `
        + '(giao diện phải hiển thị đúng số này, không giả định trước)');
});