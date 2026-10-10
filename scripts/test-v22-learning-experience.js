'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STARTER_COURSES } = require('../server/services/starter-course-catalog.js');
const { UNIVERSITY_DOMAINS, getUniversityDomain, getUniversityAcademicContext } = require('../server/services/university-taxonomy.js');
const { UNIVERSITY_V20_COURSES, UNIVERSITY_V20_GROUPS } = require('../server/services/catalog-v20-university.js');
const { buildK12Courses, buildK12CourseDetail } = require('../server/services/learning-catalog-service.js');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

assert.equal(UNIVERSITY_DOMAINS.length, 5, 'Bậc Đại học có đủ 5 lĩnh vực tham chiếu');
assert.equal(new Set(UNIVERSITY_DOMAINS.map(domain => domain.code)).size, UNIVERSITY_DOMAINS.length, 'Mã lĩnh vực phải duy nhất');
assert.equal(new Set(UNIVERSITY_DOMAINS.map(domain => domain.track)).size, UNIVERSITY_DOMAINS.length, 'Track lĩnh vực phải duy nhất');
assert.ok(UNIVERSITY_DOMAINS.every(domain => domain.facultyCode && domain.fieldCode && domain.disciplineGroupCode && domain.majors.length), 'Mỗi lĩnh vực phải có khoa, lĩnh vực, nhóm ngành và ngành');
assert.ok(UNIVERSITY_DOMAINS.some(domain => domain.code === 'APPLIED_SCIENCES'), 'Có lĩnh vực Khoa học ứng dụng');
assert.ok(UNIVERSITY_DOMAINS.some(domain => domain.code === 'COMPUTING'), 'Có lĩnh vực CNTT/Máy tính');

const universityCourses = STARTER_COURSES.filter(course => String(course.track || '').startsWith('UNIVERSITY_'));
assert.equal(STARTER_COURSES.length, 283, 'Catalog dự kiến có 283 khóa');
assert.ok(universityCourses.length >= 36, 'Có nhiều khóa đại học ở các lĩnh vực');
for (const course of universityCourses) {
    assert.equal(course.educationLevel, 'HIGHER_EDUCATION', `${course.code} phải giữ cấp học Đại học`);
    assert.equal(course.educationLevelName, 'Đại học', `${course.code} phải hiển thị cấp học Đại học`);
    assert.ok(course.academicDomainCode, `${course.code} phải có lĩnh vực học thuật riêng`);
    assert.ok(getUniversityDomain(course.track), `${course.code} phải map về lĩnh vực hợp lệ`);
    assert.equal(course.isOfficialUniversityCurriculum, false, `${course.code} không được tự nhận là chương trình chính thức`);
    assert.equal(course.curriculumScope, 'GENERAL_SKILL_CATALOG');
    assert.ok(course.pathDesign?.stages?.includes('Lab/Case') || course.pathDesign?.stages?.includes('Project'), `${course.code} phải có hoạt động ứng dụng`);
}
const applied = universityCourses.filter(course => course.academicDomainCode === 'APPLIED_SCIENCES');
assert.ok(applied.length >= 5, 'Khoa học ứng dụng có ít nhất 5 khóa');
assert.equal(UNIVERSITY_V20_COURSES.length, 36, 'Catalog đại học mở rộng V20 có 36 khóa');
assert.ok(UNIVERSITY_V20_GROUPS.APPLIED_SCIENCES, 'Migrations có nhóm học thuật Khoa học ứng dụng');
const context = getUniversityAcademicContext({ track: 'UNIVERSITY_APPLIED_SCIENCES', majorTracks: ['APPSCI'] });
assert.equal(context.educationStageName, 'Đại học');
assert.equal(context.academicDomainCode, 'APPLIED_SCIENCES');

for (let grade = 1; grade <= 12; grade += 1) {
    const courses = buildK12Courses({ grade });
    assert.ok(courses.length > 0, `Lớp ${grade} phải có môn học`);
    const first = courses[0];
    const detail = buildK12CourseDetail(first.id);
    assert.ok(detail?.lessons?.length > 0, `Lớp ${grade} phải có bài học chi tiết`);
    assert.ok(detail.lessons[0].theorySections?.length > 0, `Lớp ${grade} phải có các phần lý thuyết`);
    assert.ok(detail.lessons[0].questions?.length > 0, `Lớp ${grade} phải có câu hỏi tự kiểm tra`);
}

const catalogPage = read('khoa-hoc.html');
assert.ok(/data-track="UNIVERSITY"[^>]*>Đại học<\/button>/.test(catalogPage), 'Catalog phải gọi bậc học là Đại học');
assert.ok(!catalogPage.includes('data-track="UNIVERSITY_IT">Đại học CNTT'), 'Không còn tab sai tên Đại học CNTT');
for (const label of ['Khoa học ứng dụng', 'Kinh tế và Kinh doanh', 'Cơ điện tử và Tự động hóa', 'Kỹ thuật ứng dụng']) assert.ok(catalogPage.includes(label), `Catalog có bộ lọc ${label}`);
const universityPage = read('university.html');
assert.ok(universityPage.includes('<h1>Bậc học Đại học</h1>'));
assert.ok(universityPage.includes('Đại học có nhiều lĩnh vực, không phải một ngành CNTT'));
for (const domain of ['COMPUTING','APPLIED_SCIENCES','ECONOMICS','MECHATRONICS','ENGINEERING']) assert.ok(universityPage.includes(`domain=${domain}`), `Trang Đại học có liên kết ${domain}`);
const detailPage = read('khoa-hoc-chi-tiet.html');
assert.ok(detailPage.includes('<details class="theory-block"'), 'Lý thuyết chia thành phần có thể thu gọn');
assert.ok(detailPage.includes('chapter-accordion'), 'Chương có thể mở/đóng');
assert.ok(detailPage.includes('Lý thuyết theo từng phần'));
assert.ok(detailPage.includes('Thực hành / Lab / Project'));
assert.ok(detailPage.includes('Timed test') || detailPage.includes('Timed practice'));
assert.ok(!detailPage.includes('</script></script>'), 'Không có đóng thẻ script trùng');
const migration009 = read('scripts/migrations/009-v19-rich-course-engine.js');
assert.ok(migration009.includes('HTM-UNIVERSITY-ACADEMIC-V20'), 'Migration cũ cũng dùng root bậc Đại học chung');
assert.ok(!migration009.includes('Catalog Đại học CNTT'), 'Migration không còn đặt tên cấp học thành Đại học CNTT');
const migration010 = read('scripts/migrations/010-v20-full-learning-content.js');
assert.ok(migration010.includes('majorDomainMap'), 'Major map phân biệt trùng mã ngành giữa các lĩnh vực');
assert.ok(migration010.includes('UNIVERSITY_APPLIED_SCIENCES'), 'Migration seed lĩnh vực Khoa học ứng dụng');
assert.ok(migration010.includes("status: 'ARCHIVED'"), 'Catalog gốc trùng được archive nhưng không xóa');
console.log(JSON.stringify({ test: 'V22 learning experience', result: 'PASS', catalogCourses: STARTER_COURSES.length, universityCourses: universityCourses.length, universityDomains: UNIVERSITY_DOMAINS.length, appliedSciencesCourses: applied.length, k12GradesChecked: 12, checks: 41 }, null, 2));
