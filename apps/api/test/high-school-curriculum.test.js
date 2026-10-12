"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const curriculum = require('../../../content/curriculum');
const questionBanks = require('../../../content/question-banks');
const { selectQuestionPaper } = require('../src/services/assessment-generator');
const { getVideoLink } = require('../../../content/video-links');

const PROGRAMS = ['ctst', 'kntt', 'canhdieu'];

test('THPT grades 10–12 expose separate course paths for all textbook programmes', () => {
  for (const grade of [10, 11, 12]) for (const programCode of PROGRAMS) {
    const catalog = curriculum.buildCatalog(grade, programCode);
    assert.ok(catalog, `Missing grade ${grade}, program ${programCode}`);
    assert.equal(catalog.grade, grade);
    assert.ok(catalog.courses.length >= 15);
    for (const course of catalog.courses) {
      assert.equal(course.units.length, 4);
      assert.equal(course.lessonCount, 12);
      for (const unit of course.units) for (const lesson of unit.lessons) {
        assert.equal(lesson.parts.length, 4);
        assert.ok(lesson.parts.every((part) => part.checkpoint.length >= 1));
        const video = getVideoLink({ programCode, grade, subjectCode: course.subjectCode, lessonId: lesson.id });
        assert.ok(video.videoUrl, `Missing video placeholder for ${lesson.id}`);
      }
    }
  }
});

test('every THPT lesson generates a large assessment bank and 8 separate checkpoint questions per part', () => {
  for (const grade of [10, 11, 12]) {
    const course = curriculum.buildCourse(grade, 'kntt', 'math');
    const lesson = course.units[0].lessons[0];
    const pool = questionBanks.buildQuestionPool({ programCode: 'kntt', grade, subjectCode: 'math', lesson });
    const formal = pool.filter((item) => item.purpose === 'assessment');
    const checkpoints = pool.filter((item) => item.purpose === 'checkpoint');
    assert.equal(formal.length, 120);
    assert.equal(checkpoints.length, 32);
    for (const part of lesson.parts) assert.equal(checkpoints.filter((item) => item.partId === part.id).length, 8);
    assert.deepEqual(formal.reduce((counts, item) => { counts[item.type] = (counts[item.type] || 0) + 1; return counts; }, {}), { multiple_choice: 32, true_false: 16, fill_blank: 16, multiple_select: 8, matching: 8, ordering: 8, short_answer: 16, essay: 16 });
    assert.equal(new Set(formal.map((item) => item.questionId)).size, formal.length);
    assert.ok(checkpoints.every((item) => !formal.some((formalItem) => formalItem.questionId === item.questionId)), 'Checkpoint phải là ngân hàng độc lập với đề bài học');
  }
});

test('repeated THPT lesson assessments choose fresh IDs when enough questions remain', () => {
  const course = curriculum.buildCourse(10, 'ctst', 'math');
  const lesson = course.units[0].lessons[0];
  const pool = questionBanks.buildQuestionPool({ programCode: 'ctst', grade: 10, subjectCode: 'math', lesson }).filter((item) => item.purpose === 'assessment');
  const first = selectQuestionPaper(pool, 'lesson', []);
  const second = selectQuestionPaper(pool, 'lesson', first.map((item) => item.questionId));
  assert.equal(first.length, 8);
  assert.equal(second.length, 8);
  assert.equal(second.filter((item) => first.some((previous) => previous.questionId === item.questionId)).length, 0);
  assert.ok([...first, ...second].every((item) => item.grade === 10 && item.programCode === 'ctst' && item.subjectCode === 'math' && item.lessonId === lesson.id));
});

test('mỗi bài từ lớp 1 đến 12 trong cả ba bộ sách có một dòng video độc lập', () => {
  let lessonCount = 0;
  for (let grade = 1; grade <= 12; grade += 1) for (const programCode of PROGRAMS) {
    const catalog = curriculum.buildCatalog(grade, programCode);
    assert.ok(catalog, `Missing catalog for grade ${grade}, programme ${programCode}`);
    for (const course of catalog.courses) for (const unit of course.units) for (const lesson of unit.lessons) {
      lessonCount += 1;
      const video = getVideoLink({ programCode, grade, subjectCode: course.subjectCode, lessonId: lesson.id });
      assert.ok(video.videoUrl, `Bài ${lesson.id} thiếu dòng video trong CSV`);
      assert.equal(video.status, 'placeholder');
    }
  }
  assert.equal(lessonCount, 4764);
});
