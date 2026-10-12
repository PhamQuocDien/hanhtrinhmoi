'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const curriculum = require('../../../content/curriculum');
const career = require('../../../content/career-paths/catalog');
const { buildSchoolTheory, buildUniversityTheory } = require('../../../content/quality/theory-content');

const theorySectionIds = ['concept', 'principles', 'worked-example', 'method', 'misconceptions', 'self-check'];
test('school theory is visible in API lesson payload and contains six substantive sections', () => {
  const course = curriculum.buildCourse(2, 'ctst', 'math');
  const lesson = course.units.flatMap((unit) => unit.lessons).find((item) => item.title.includes('Đọc, viết và phân tích số'));
  assert.ok(lesson);
  const safe = curriculum.publicLesson(lesson);
  assert.ok(safe.theory);
  assert.equal(safe.theory.version, 'V8.0.0');
  assert.equal(safe.theory.status, 'draft-teacher-review-required');
  assert.ok(safe.theory.sections.length >= 6);
  for (const id of theorySectionIds) assert.ok(safe.theory.sections.some((item) => item.id === id), `missing ${id}`);
  assert.match(safe.theory.sections.find((item) => item.id === 'worked-example').body, /407|hàng/);
});

test('topic matcher does not confuse direct reading with poetry, or number patterns with arithmetic', () => {
  const reading = buildSchoolTheory({ grade: 1, subjectCode: 'vietnamese', subjectName: 'Tiếng Việt', title: 'Đọc câu ngắn và tìm thông tin trực tiếp', objective: 'Tìm thông tin trực tiếp', unitTitle: 'Đọc hiểu' });
  assert.equal(reading.matchContext, 'lesson-title');
  assert.match(reading.conceptKey, /doc-cau-ngan/);
  assert.match(reading.sections.find((item) => item.id === 'worked-example').body, /Lan đến thư viện/);

  const math = buildSchoolTheory({ grade: 2, subjectCode: 'math', subjectName: 'Toán', title: 'Xác định vị trí và quy luật đơn giản', objective: 'Nhận biết quy luật', unitTitle: 'Số và phép tính' });
  assert.equal(math.conceptKey, 'day-so-va-quy-luat');
  assert.match(math.sections.find((item) => item.id === 'worked-example').body, /tăng 4 mỗi lần/);
});

test('subject-specific theory covers science, measurement and English lifestyle topics', () => {
  const science = buildSchoolTheory({ grade: 8, subjectCode: 'science', subjectName: 'Khoa học tự nhiên', title: 'Biến đổi vật lí và biến đổi hóa học', objective: 'Phân biệt hai dạng biến đổi', unitTitle: 'Chất' });
  assert.match(science.sections.find((item) => item.id === 'worked-example').body, /Nước đá tan/);

  const physics = buildSchoolTheory({ grade: 10, subjectCode: 'physics', subjectName: 'Vật lí', title: 'Đại lượng và phép đo', objective: 'Thực hiện phép đo', unitTitle: 'Mở đầu' });
  assert.match(physics.sections.find((item) => item.id === 'worked-example').body, /1 mm/);

  const english = buildSchoolTheory({ grade: 11, subjectCode: 'english', subjectName: 'Tiếng Anh', title: 'Healthy lifestyles', objective: 'Talk about healthy lifestyles', unitTitle: 'Health' });
  assert.match(english.sections.find((item) => item.id === 'worked-example').body, /should get enough sleep/);
});

test('school theory has a visible render panel before the lesson progresses to video and practice', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../web/lesson.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../../web/src/js/lesson.js'), 'utf8');
  assert.match(html, /id="theoryPanel"/);
  assert.match(js, /function renderTheory\(theory\)/);
  assert.match(js, /renderTheory\(lesson\.theory\)/);
  assert.ok(html.indexOf('id="theoryPanel"') < html.indexOf('id="lessonVideo"'));
});

test('university IT theory is returned for every course lesson and uses lesson-specific concepts first', () => {
  const courses = career.getAllCourses();
  assert.ok(courses.length >= 9);
  let lessons = 0;
  for (const course of courses) {
    const publicCourse = career.publicCourseDetail(course);
    for (const unit of publicCourse.modules) for (const lesson of unit.lessons) {
      lessons += 1;
      assert.ok(lesson.theory?.sections?.length >= 6, `${course.title}: ${lesson.title}`);
      assert.ok(lesson.theory.conceptName);
      assert.equal(lesson.theory.version, 'V8.0.0');
      assert.equal(lesson.theory.status, 'draft-teacher-review-required');
      assert.ok(lesson.theory.matchContext);
      if (lesson.codeExercise) assert.equal(Object.hasOwn(lesson.codeExercise, 'testCases'), false);
    }
  }
  assert.equal(lessons, 414);
});

test('lesson theory builders clearly label generated content as requiring teacher review', () => {
  const school = buildSchoolTheory({ grade: 6, subjectCode: 'technology', subjectName: 'Công nghệ', title: 'Vật liệu và dụng cụ', unitTitle: 'Thiết kế', objective: 'Chọn vật liệu phù hợp' });
  const university = buildUniversityTheory({ groupId: 'it-group-2', courseTitle: 'Phát triển Web', lesson: { title: 'REST API và HTTP', objective: 'Thiết kế API' } });
  assert.equal(school.status, 'draft-teacher-review-required');
  assert.match(school.sourceNote, /Giáo viên cần đối chiếu/);
  assert.equal(university.status, 'draft-teacher-review-required');
  assert.equal(university.matchContext, 'lesson-title');
});

test('every generated school and university lesson receives topic-led theory without generic fallback', () => {
  let schoolLessons = 0;
  for (let grade = 1; grade <= 12; grade += 1) {
    for (const programCode of ['ctst', 'kntt', 'canhdieu']) {
      for (const subject of curriculum.subjectsForGrade(grade)) {
        const course = curriculum.buildCourse(grade, programCode, subject.code);
        for (const unit of course.units || []) for (const lesson of unit.lessons || []) {
          schoolLessons += 1;
          assert.ok(lesson.theory?.sections?.length >= 6, `${grade}/${subject.code}/${lesson.title}`);
          assert.ok(['lesson-title', 'learning-objective', 'unit-title'].includes(lesson.theory.matchContext), `${grade}/${subject.code}/${lesson.title}: ${lesson.theory.matchContext}`);
          assert.ok(lesson.theory.sections.find((section) => section.id === 'worked-example')?.body?.length >= 45, `${grade}/${subject.code}/${lesson.title}: missing worked example`);
        }
      }
    }
  }
  assert.equal(schoolLessons, 4764);
  let universityLessons = 0;
  for (const course of career.getAllCourses()) {
    for (const module of career.publicCourseDetail(course).modules || []) for (const lesson of module.lessons || []) {
      universityLessons += 1;
      assert.ok(lesson.theory?.sections?.length >= 6, `${course.title}/${lesson.title}`);
      assert.notEqual(lesson.theory.matchContext, 'career-group-default', `${course.title}/${lesson.title}`);
      assert.notEqual(lesson.theory.matchContext, 'general-engineering', `${course.title}/${lesson.title}`);
    }
  }
  assert.equal(universityLessons, 414);
});

test('V8 theory contains specific explanations for recurring cross-subject lessons', () => {
  const ethics = buildSchoolTheory({ grade: 3, subjectCode: 'ethics', title: 'Giữ lời hứa và hoàn thành nhiệm vụ' });
  assert.match(ethics.summary, /cam kết|trách nhiệm/);
  const pe = buildSchoolTheory({ grade: 2, subjectCode: 'pe', title: 'Khởi động và hồi tĩnh đúng cách' });
  assert.match(pe.summary, /Khởi động/);
  const literature = buildSchoolTheory({ grade: 8, subjectCode: 'literature', title: 'Nghĩa tường minh và hàm ý' });
  assert.match(literature.summary, /Hàm ý|hàm ý|ngữ cảnh/);
  const ict = buildSchoolTheory({ grade: 7, subjectCode: 'ict', title: 'Tìm và kiểm chứng nguồn tin' });
  assert.match(ict.summary, /nguồn|kiểm chứng/);
  const university = buildUniversityTheory({ groupId: 'it-group-7', courseTitle: 'Cloud Computing', lesson: { title: 'RPO, RTO và phục hồi' } });
  assert.equal(university.matchContext, 'lesson-title');
  assert.match(university.summary, /RPO|RTO/);
});
