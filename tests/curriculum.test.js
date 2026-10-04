'use strict';

/**
 * Kiểm thử DỮ LIỆU CHƯƠNG TRÌNH: lớp 1–12, môn học, bộ sách, đầu sách.
 * Đây là nguồn dữ liệu tĩnh nên kiểm thử không cần MongoDB.
 */

const curriculum = require('../data/curriculum/curriculum-registry');
const subjects = require('../data/subjects/subject-registry');
const series = require('../data/textbooks/book-series-registry');
const textbooks = require('../data/textbooks/textbook-registry');

const { suite, runCase } = require('./harness');

function testGrades() {
    suite('Chương trình — cấu trúc lớp 1–12');

    runCase('có đủ 12 lớp', (t) => {
        t.equal(curriculum.getGrades().length, 12, 'Phải có 12 lớp');
        for (let grade = 1; grade <= 12; grade += 1) {
            t.ok(curriculum.getGrade(grade), `Thiếu dữ liệu lớp ${grade}`);
        }
    });

    runCase('mỗi lớp có môn học', (t) => {
        for (let grade = 1; grade <= 12; grade += 1) {
            t.ok(curriculum.getGrade(grade).subjects.length > 0, `Lớp ${grade} phải có môn`);
        }
    });

    runCase('lessonId là khoá ổn định, KHÔNG phải tên hiển thị', (t) => {
        const lesson = curriculum.getLessonsForSubject(8, 'toan')[0];
        t.ok(lesson, 'Phải có bài học Toán 8');
        t.includes(lesson.lessonId, 'les-g08', 'Khoá có cấu trúc lớp');
        t.notEqual(lesson.lessonId, lesson.displayTitle, 'Khoá không được là tên bài');
    });

    runCase('mỗi bài học có số thứ tự và trạng thái xác minh', (t) => {
        for (const lesson of curriculum.getLessonsForSubject(8, 'toan')) {
            t.ok(lesson.lessonNumber > 0, 'Phải có số thứ tự bài');
            t.ok(lesson.verificationStatus, 'Phải có trạng thái xác minh');
            t.ok(lesson.source, 'Phải ghi nguồn');
        }
    });

    runCase('dữ liệu chưa đối chiếu KHÔNG được gắn nhãn VERIFIED', (t) => {
        for (const subject of curriculum.getGrade(8).subjects) {
            t.notEqual(subject.verificationStatus, 'VERIFIED', 'Dữ liệu bịa không được gắn VERIFIED');
        }
    });

    runCase('môn chưa có tên bài được đánh dấu, KHÔNG tự đặt', (t) => {
        const pending = curriculum.getGrade(8).subjects.filter(subject => subject.needsLessonImport);
        t.ok(pending.length > 0, 'Lớp 8 có môn chờ nhập bài');
        t.equal(pending[0].lessonCount, 0, 'Môn chờ nhập không được có bài giả');
    });
}

function testSubjects() {
    suite('Môn học — danh mục là nguồn duy nhất');

    runCase('Toán có ở cả 12 lớp', (t) => {
        t.equal(subjects.getSubject('toan').grades.length, 12, 'Toán ở mọi lớp');
    });

    runCase('Tiếng Việt lớp 1–5, Ngữ văn từ lớp 6', (t) => {
        t.deepEqual(subjects.getSubject('tieng_viet').grades, [1, 2, 3, 4, 5], 'Tiếng Việt tiểu học');
        t.equal(subjects.getSubject('ngu_van').grades[0], 6, 'Ngữ văn bắt đầu lớp 6');
    });

    runCase('Ngoại ngữ lớp 1–2 là nội dung BỔ TRỢ', (t) => {
        t.equal(subjects.getSubjectStatusForGrade('tieng_anh', 1), subjects.SUBJECT_STATUS.SUPPLEMENTARY, 'Lớp 1 là bổ trợ');
        t.equal(subjects.getSubjectStatusForGrade('tieng_anh', 3), subjects.SUBJECT_STATUS.REQUIRED, 'Lớp 3 là bắt buộc');
    });

    runCase('Khoa học tự nhiên có mạch Vật lí/Hoá/Sinh ở THCS', (t) => {
        const khtn = subjects.getSubject('khtn');
        t.ok(khtn.integratedSubject, 'KHTN là môn tích hợp');
        t.includes(khtn.learningTracks, 'vat_ly', 'Có mạch Vật lí');
        t.includes(khtn.learningTracks, 'hoa_hoc', 'Có mạch Hoá học');
        t.includes(khtn.learningTracks, 'sinh_hoc', 'Có mạch Sinh học');
    });

    runCase('Vật lí/Hoá/Sinh ở THPT là môn LỰA CHỌN', (t) => {
        for (const trackId of ['vat_ly', 'hoa_hoc', 'sinh_hoc']) {
            t.equal(subjects.getSubjectStatusForGrade(trackId, 10), subjects.SUBJECT_STATUS.ELECTIVE, `${trackId} lớp 10`);
        }
    });

    runCase('mọi môn đều có nguồn và trạng thái xác minh', (t) => {
        for (const subject of subjects.SUBJECTS) {
            t.ok(subject.source, `${subject.id} thiếu source`);
            t.ok(subject.verificationStatus, `${subject.id} thiếu verificationStatus`);
        }
    });

    runCase('tra cứu môn không tồn tại trả về undefined', (t) => {
        t.equal(subjects.getSubject('khong_ton_tai'), undefined, 'Không được bịa môn');
    });
}

function testTextbooks() {
    suite('Sách giáo khoa — nhiều bộ sách cho một môn');

    runCase('có nhiều bộ sách', (t) => {
        t.ok(series.BOOK_SERIES.length >= 3, 'Phải có ít nhất 3 bộ sách');
    });

    runCase('mỗi bộ sách có khoá ổn định và nguồn', (t) => {
        for (const item of series.BOOK_SERIES) {
            t.ok(item.seriesId, 'Phải có seriesId');
            t.ok(item.source, 'Phải ghi nguồn');
        }
    });

    runCase('mỗi lớp có ít nhất một đầu sách', (t) => {
        for (let grade = 1; grade <= 12; grade += 1) {
            t.ok(textbooks.getTextbooksForGrade(grade).length > 0, `Lớp ${grade} phải có sách`);
        }
    });

    runCase('đầu sách có đủ metadata theo yêu cầu', (t) => {
        const [book] = textbooks.getTextbooksForGrade(8);
        t.ok(book.textbookId, 'textbookId ổn định');
        t.ok(book.officialTitle, 'Tên sách');
        t.ok(book.grade, 'Lớp');
        t.ok(book.subjectId, 'Môn');
        t.ok(book.seriesId, 'Bộ sách');
        t.ok(book.verificationStatus, 'Trạng thái xác minh');
    });
}

function run() {
    testGrades();
    testSubjects();
    testTextbooks();
}

module.exports = { run };