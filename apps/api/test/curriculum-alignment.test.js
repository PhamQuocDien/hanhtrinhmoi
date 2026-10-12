'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const curriculum = require('../../../content/curriculum');
const questionBanks = require('../../../content/question-banks');
const alignment = require('../../../content/curriculum/curriculum-alignment');
const career = require('../../../content/career-paths/software-development');
const { buildCareerQuestionBank } = require('../../../content/career-paths/software-development/question-bank');
const careerCatalog = require('../../../content/career-paths/catalog');
const PROGRAMS = ['ctst', 'kntt', 'canhdieu'];
const EXPECTED_TYPES = { multiple_choice: 32, true_false: 16, fill_blank: 16, multiple_select: 8, matching: 8, ordering: 8, short_answer: 16, essay: 16 };
const validTaxonomy = new Set(['remember', 'understand', 'apply', 'analyze', 'create']);
const validDifficulty = new Set(['easy', 'medium', 'hard']);

test('GDPT 2018 mapping is explicit and every lesson in grades 1–12 has teacher-review status', () => {
  assert.ok(alignment.OFFICIAL_REFERENCES.some((item) => item.id === 'GDPT-2018-TT32-CONSOLIDATED'));
  let lessonCount = 0;
  for (let grade = 1; grade <= 12; grade += 1) for (const programCode of PROGRAMS) {
    const catalog = curriculum.buildCatalog(grade, programCode);
    assert.ok(catalog, `missing catalog: grade=${grade}, program=${programCode}`);
    for (const course of catalog.courses) for (const unit of course.units) for (const lesson of unit.lessons) {
      lessonCount += 1;
      assert.equal(course.grade, grade);
      assert.equal(course.programCode, programCode);
      assert.equal(lesson.alignment.subjectCode, course.subjectCode);
      assert.equal(lesson.alignment.grade, grade);
      assert.equal(lesson.alignment.subjectCode, course.subjectCode);
      assert.ok(lesson.alignment.intendedOutcomes.length >= 3);
      assert.ok(lesson.alignment.frameworkReferenceIds.includes('GDPT-2018-TT32-CONSOLIDATED'));
      assert.match(lesson.alignment.status, /teacher-validation-required/);
      assert.doesNotMatch(lesson.alignment.status, /approved|certified/i);
    }
  }
  assert.equal(lessonCount, 4764);
});

test('math bank across grades 1–12 keeps 120 assessment questions and 32 checkpoint candidates per lesson', () => {
  for (let grade = 1; grade <= 12; grade += 1) for (const programCode of PROGRAMS) {
    const course = curriculum.buildCourse(grade, programCode, 'math');
    assert.ok(course, `math course missing: grade=${grade}, program=${programCode}`);
    for (const unit of course.units) for (const lesson of unit.lessons) {
      const pool = questionBanks.buildQuestionPool({ grade, programCode, subjectCode: 'math', lesson });
      const assessment = pool.filter((item) => item.purpose === 'assessment');
      const checkpoints = pool.filter((item) => item.purpose === 'checkpoint');
      assert.equal(assessment.length, 120, lesson.id);
      assert.equal(checkpoints.length, 32, lesson.id);
      assert.deepEqual(assessment.reduce((counts, item) => { counts[item.type] = (counts[item.type] || 0) + 1; return counts; }, {}), EXPECTED_TYPES);
      assert.equal(new Set(assessment.map((item) => item.questionId)).size, 120, lesson.id);
      assert.equal(new Set(assessment.map((item) => item.prompt.trim().toLocaleLowerCase('vi-VN'))).size, 120, `repeated assessment prompt: ${lesson.id}`);
      assert.equal(new Set(checkpoints.map((item) => item.prompt.trim().toLocaleLowerCase('vi-VN'))).size, 32, `repeated checkpoint prompt: ${lesson.id}`);
      for (const item of [...assessment, ...checkpoints]) {
        assert.equal(item.grade, grade);
        assert.equal(item.programCode, programCode);
        assert.equal(item.subjectCode, 'math');
        assert.equal(item.lessonId, lesson.id);
        assert.ok(validTaxonomy.has(item.taxonomy));
        assert.ok(validDifficulty.has(item.difficulty));
        assert.ok(item.curriculumAlignmentId && item.mappedStrand && item.intendedOutcomes.length >= 3);
      }
      for (const part of lesson.parts) assert.equal(checkpoints.filter((item) => item.partId === part.id).length, 8);
    }
  }
});

test('representative non-math banks keep subjects separate and carry intended-outcome metadata', () => {
  const samples = [
    [1, 'ctst', 'vietnamese'], [3, 'kntt', 'ict'], [5, 'canhdieu', 'science'],
    [6, 'ctst', 'history_geo'], [7, 'kntt', 'english'], [9, 'canhdieu', 'civic'],
    [10, 'ctst', 'physics'], [11, 'kntt', 'economics_law'], [12, 'canhdieu', 'literature']
  ];
  for (const [grade, programCode, subjectCode] of samples) {
    const course = curriculum.buildCourse(grade, programCode, subjectCode);
    assert.ok(course, `course missing: ${grade}/${programCode}/${subjectCode}`);
    const lesson = course.units[0].lessons[0];
    const pool = questionBanks.buildQuestionPool({ grade, programCode, subjectCode, lesson });
    const assessment = pool.filter((item) => item.purpose === 'assessment');
    assert.equal(assessment.length, 120, lesson.id);
    assert.equal(new Set(assessment.map((item) => item.prompt.trim().toLocaleLowerCase('vi-VN'))).size, 120, lesson.id);
    assert.ok(assessment.every((item) => item.grade === grade && item.programCode === programCode && item.subjectCode === subjectCode && item.lessonId === lesson.id));
  }
});

test('university IT bank has 64 distinct draft questions for every lesson across all nine career groups', () => {
  assert.equal(career.COURSES.length, 9);
  const bank = buildCareerQuestionBank();
  assert.equal(career.COURSES.reduce((total, item) => total + item.lessonCount, 0), 189);
  assert.equal(careerCatalog.listCourses().length, 34);
  assert.equal(careerCatalog.getAllCourses().reduce((total, item) => total + item.lessonCount, 0), 414);
  assert.equal(bank.length, 26496);
  assert.equal(new Set(bank.map((item) => item.questionId)).size, bank.length);
  const prompts = new Map();
  for (const item of bank) {
    const key = `${item.courseId}|${item.lessonId}`;
    if (!prompts.has(key)) prompts.set(key, new Set());
    assert.ok(!prompts.get(key).has(item.prompt), `duplicate university prompt: ${key}`);
    prompts.get(key).add(item.prompt);
    assert.equal(item.active, false, 'AI/generated content must stay inactive until reviewed');
    assert.equal(item.contentStatus, 'draft-teacher-review-required');
    assert.ok(validTaxonomy.has(item.taxonomy));
    assert.ok(validDifficulty.has(item.difficulty));
  }
  assert.equal(prompts.size, 414);
  for (const [lessonId, questions] of prompts) assert.equal(questions.size, 64, lessonId);
});
