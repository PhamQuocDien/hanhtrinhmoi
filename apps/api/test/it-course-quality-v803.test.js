'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../../content/career-paths/catalog');
const { buildLessonLearningGuide, buildCourseQuality, QUALITY_VERSION } = require('../../../content/quality/it-course-quality');
const { buildUniversityTheory } = require('../../../content/quality/theory-content');

test('V8.0.3 provides an outcome and project blueprint for all 34 IT courses', () => {
  const courses = catalog.getAllCourses();
  assert.equal(QUALITY_VERSION, 'V8.0.3');
  assert.equal(courses.length, 34);
  for (const course of courses) {
    const blueprint = buildCourseQuality(course);
    assert.equal(blueprint.version, 'V8.0.3', course.id);
    assert.equal(blueprint.approvedForOfficialSyllabus, false, course.id);
    assert.ok(blueprint.learningOutcomes.length > 0, course.id);
    assert.equal(blueprint.moduleMilestones.length, course.modules.length, course.id);
    assert.equal(blueprint.capstone.rubric.reduce((sum, row) => sum + row.points, 0), 100, course.id);
    assert.ok(blueprint.capstone.acceptance.length >= 3, course.id);
    assert.ok(blueprint.suggestedAssessmentBlueprint.questionTypes.length >= 5, course.id);
  }
});

test('every IT lesson receives a concrete guide, timed study plan, task checklist and 100-point rubric', () => {
  let count = 0;
  for (const course of catalog.getAllCourses()) {
    const publicCourse = catalog.publicCourseDetail(course);
    assert.equal(publicCourse.qualityBlueprint.version, 'V8.0.3');
    for (const module of publicCourse.modules) for (const lesson of module.lessons) {
      count += 1;
      const guide = lesson.learningGuide;
      assert.equal(guide.version, 'V8.0.3', `${course.id}/${lesson.id}`);
      assert.equal(guide.status, 'draft-teacher-review-required');
      assert.equal(guide.teacherReview.curriculumApproved, false);
      assert.ok(guide.learningOutcomes.some((item) => item.includes(lesson.objective)), `${lesson.id} missing objective`);
      assert.ok(guide.guidedSteps.some((item) => item.includes(lesson.practice)), `${lesson.id} missing practice`);
      assert.ok(guide.masteryEvidence.some((item) => item.includes(lesson.deliverable)), `${lesson.id} missing deliverable`);
      assert.equal(guide.rubric.reduce((sum, item) => sum + item.points, 0), 100, `${lesson.id} rubric total`);
      assert.equal(guide.studyPlan.reduce((sum, item) => sum + item.minutes, 0), guide.estimatedMinutes, `${lesson.id} study plan total`);
      assert.ok(guide.selfCheck.length >= 3, `${lesson.id} needs self-check questions`);
    }
  }
  assert.equal(count, 414);
});

test('module context specializes otherwise generic lessons without claiming accreditation', () => {
  const theory = buildUniversityTheory({ courseTitle: 'Career reflection', moduleTitle: 'Cloud reliability, RPO and RTO', groupId: 'it-group-7', lesson: { title: 'Project reflection', objective: 'Summarize completed work', material: 'Describe the work completed', practice: 'Gather two pieces of peer feedback' } });
  assert.equal(theory.pedagogyVersion, 'V8.0.3');
  assert.equal(theory.matchContext, 'module-title');
  assert.match(theory.conceptName, /Cloud reliability|phục hồi/i);
  assert.match(theory.sections[0].body, /RPO|RTO|phục hồi/i);
  assert.equal(theory.status, 'draft-teacher-review-required');
});
