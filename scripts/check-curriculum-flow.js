'use strict';

/**
 * KIỂM TRA LUỒNG CHƯƠNG TRÌNH QUA API THẬT.
 *
 * Mục tiêu: chứng minh đường đi thực tế của dữ liệu chạy được —
 *   HTTP -> middleware -> route -> controller -> service -> repository -> registry
 * chứ không chỉ gọi hàm service trực tiếp.
 *
 * Yêu cầu: máy chủ đang chạy. Không cần MongoDB vì dữ liệu chương trình nằm
 * trong registry tĩnh.
 *
 * Dùng khi:  node scripts/check-curriculum-flow.js
 */

const { HttpSession, PORT } = require('./lib/http-session');

const session = new HttpSession();
const data = HttpSession.dataOf;

let failures = 0;

/** Ghi kết quả một bước kiểm tra. */
function check(label, condition, detail = '') {
    if (condition) {
        console.log(`  V ${label}`);
    } else {
        failures += 1;
        console.log(`  X ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

/** Đăng nhập để có phiên; trả về false nếu không thành công. */
async function login() {
    const username = process.env.CHECK_USER || 'hocvien01';
    const password = process.env.CHECK_PASS || 'Hocvien@2026';
    const response = await session.post('/api/auth/login', { username, password });
    if (response.status !== 200) {
        console.log(`Khong dang nhap duoc (${response.status}).`);
        console.log('Dat CHECK_USER / CHECK_PASS cho tai khoan co san trong he thong.');
        return false;
    }
    console.log(`Dang nhap: ${username}\n`);
    return true;
}

/** Kiểm tra các endpoint cấp học và lớp. */
async function checkLevelsAndGrades() {
    const levels = data(await session.get('/api/student/curriculum/levels')) || [];
    check('/curriculum/levels tra ve 3 cap', levels.length === 3, `len=${levels.length}`);
    check('cap hoc phu du 1 den 12 lop',
        levels.reduce((sum, level) => sum + level.grades.length, 0) === 12,
        JSON.stringify(levels.map(level => level.grades)));

    const grades = data(await session.get('/api/student/curriculum/grades')) || [];
    check('/curriculum/grades tra ve 12 lop', grades.length === 12, `len=${grades.length}`);
    check('moi lop co ten cap hoc', grades.every(item => Boolean(item.educationLevelName)));
    check('lop 6 thuoc THCS',
        grades.find(item => item.grade === 6)?.educationLevelName === 'THCS',
        grades.find(item => item.grade === 6)?.educationLevelName);
    check('moi lop biet so bo sach', grades.every(item => typeof item.seriesCount === 'number'));
    return grades;
}

/** Kiểm tra danh sách môn của lớp 6. */
async function checkSubjects() {
    const subjects = data(await session.get('/api/student/curriculum/grades/6/subjects')) || [];
    check('/grades/6/subjects co mon', subjects.length > 0, `len=${subjects.length}`);
    check('mon co khoa va ten hien thi',
        subjects.every(item => Boolean(item.subjectId) && Boolean(item.displayName)));
    return subjects;
}
/** Kiểm tra bước chọn bộ sách — danh sách phải đến từ dữ liệu, không cố định trong mã. */
async function checkSeries() {
    const response = await session.get('/api/student/curriculum/grades/6/subjects/toan/series');
    const series = data(response)?.series || [];
    check('/grades/6/subjects/toan/series tra ve danh sach', series.length > 0,
        `status=${response.status} len=${series.length}`);
    check('moi bo sach co seriesId va so dau sach',
        series.every(item => Boolean(item.seriesId) && typeof item.textbookCount === 'number'),
        JSON.stringify(series.map(item => [item.seriesId, item.textbookCount])));

    // Bộ mặc định phải có đầu sách, nếu không luồng học sẽ đứt.
    const fallback = series.find(item => item.isDefault);
    check('bo sach mac dinh co dau sach', Boolean(fallback) && fallback.textbookCount > 0,
        fallback ? `textbookCount=${fallback.textbookCount}` : 'khong tim thay bo mac dinh');
    return series;
}

/** Kiểm tra bước chọn chương và bài theo bộ sách đã chọn. */
async function checkChapters(seriesId) {
    const response = await session.get(
        `/api/student/curriculum/grades/6/subjects/toan/chapters?seriesId=${encodeURIComponent(seriesId)}`
    );
    const body = data(response);
    check('/chapters?seriesId=... tra ve chuong', (body?.chapterCount || 0) > 0,
        `status=${response.status} chapters=${body?.chapterCount}`);
    check('moi chuong co danh sach bai',
        Boolean(body?.chapters?.length)
        && body.chapters.every(chapter => Array.isArray(chapter.lessons)));
    return body;
}

/** Kiểm tra mở một bài học cụ thể. */
async function checkLesson(lessonId) {
    const lesson = data(await session.get(`/api/student/curriculum/lessons/${encodeURIComponent(lessonId)}`));
    check('/lessons/:id tra ve bai hoc', Boolean(lesson?.displayTitle));
    check('bai hoc co thong tin chuong de ve duong dan',
        Boolean(lesson?.chapterTitle) || Boolean(lesson?.chapterId),
        `chapter=${lesson?.chapterTitle}`);
}

/** Kiểm tra xử lý lỗi và bảo mật. */
async function checkErrorsAndAuth() {
    const missing = await session.get('/api/student/curriculum/grades/6/subjects/khong_ton_tai/series');
    check('mon khong ton tai tra ve 404', missing.status === 404, `status=${missing.status}`);

    const saved = session.cookie;
    session.clearCookie();
    const anonymous = await session.get('/api/student/curriculum/grades');
    check('API bi tu choi khi chua dang nhap', anonymous.status === 401, `status=${anonymous.status}`);
    session.cookie = saved;
}

/**
 * Chạy toàn bộ kiểm tra.
 *
 * @returns {Promise<void>}
 */
async function main() {
    console.log(`Kiem tra API tren http://127.0.0.1:${PORT}\n`);
    if (!await login()) process.exit(2);

    await checkLevelsAndGrades();
    await checkSubjects();

    const series = await checkSeries();
    const usable = series.find(item => item.textbookCount > 0);
    if (!usable) {
        console.log('  X khong co bo sach nao co dau sach de kiem tra chuong');
        process.exit(1);
    }

    const chapters = await checkChapters(usable.seriesId);
    const lesson = chapters?.chapters?.[0]?.lessons?.[0];
    check('co bai hoc de mo', Boolean(lesson?.lessonId), lesson?.displayTitle);
    if (lesson) await checkLesson(lesson.lessonId);

    await checkErrorsAndAuth();

    console.log(failures === 0 ? '\nOK - luong chuong trinh chay dung qua API' : `\n${failures} loi`);
    process.exit(failures === 0 ? 0 : 1);
}

main();