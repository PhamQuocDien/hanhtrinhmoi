'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const software = require('../../../content/career-paths/software-development');

const EXPECTED_CODES = ['INPR140285', 'PRTE230385', 'DASA230179', 'OOPR230279', 'SOEN330679', 'WIPR230579', 'MOPR331279'];

test('Nhóm 1 có các khóa học chính theo mã học phần đã cung cấp', () => {
  assert.equal(software.GROUP.number, 1);
  assert.equal(software.GROUP.code, 'software-development');
  const codes = new Set(software.COURSES.map((item) => item.code));
  for (const code of EXPECTED_CODES) assert.ok(codes.has(code), `Thiếu học phần ${code}`);
  assert.ok(codes.has('SDCAPSTONE'));
});

test('mỗi khóa học có lộ trình riêng, module và bài học đều có mã duy nhất', () => {
  assert.ok(software.COURSES.length >= 8);
  const courseIds = new Set();
  const lessonIds = new Set();
  for (const item of software.COURSES) {
    assert.ok(!courseIds.has(item.id), `Trùng course id ${item.id}`);
    courseIds.add(item.id);
    assert.ok(item.modules.length >= 3, `${item.id} thiếu module`);
    assert.ok(item.lessonCount >= 9, `${item.id} thiếu bài học`);
    for (const module of item.modules) {
      assert.ok(module.title && module.summary);
      assert.ok(module.lessons.length > 0);
      for (const lesson of module.lessons) {
        assert.ok(!lessonIds.has(lesson.id), `Trùng lesson id ${lesson.id}`);
        lessonIds.add(lesson.id);
        for (const key of ['title', 'objective', 'material', 'practice', 'deliverable']) assert.ok(String(lesson[key] || '').trim(), `${lesson.id} thiếu ${key}`);
      }
    }
    assert.equal(item.lessons.length, item.lessonCount);
  }
});

test('các hướng nghề chỉ tham chiếu tới khóa học tồn tại và cung cấp lựa chọn khác nhau', () => {
  const valid = new Set(software.COURSES.map((item) => item.id));
  const pathSignatures = new Set();
  for (const pathway of software.PATHWAYS) {
    assert.ok(pathway.title && pathway.description);
    assert.ok(pathway.courseIds.length >= 5);
    for (const courseId of pathway.courseIds) assert.ok(valid.has(courseId), `${pathway.id} tham chiếu khóa không tồn tại: ${courseId}`);
    pathSignatures.add(pathway.courseIds.join('|'));
  }
  assert.ok(pathSignatures.size > 1, 'Mỗi hướng nghề phải có tập khóa học riêng');
});

test('chi tiết khóa học công khai có đầy đủ bài học để phục vụ giao diện và tiến độ', () => {
  for (const item of software.COURSES) {
    const detail = software.publicCourseDetail(item);
    assert.equal(detail.lessons.length, item.lessonCount);
    assert.equal(detail.modules.reduce((count, unit) => count + unit.lessons.length, 0), item.lessonCount);
    assert.equal(detail.modules[0].lessons[0].id, item.lessons[0].id);
    assert.ok(detail.project);
  }
});
