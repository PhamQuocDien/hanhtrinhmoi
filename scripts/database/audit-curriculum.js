'use strict';
const curriculum = require('../../content/curriculum');
const questionBanks = require('../../content/question-banks');
const career = require('../../content/career-paths/catalog');
const { buildCareerQuestionBank } = require('../../content/career-paths/software-development/question-bank');
const PROGRAMS = ['ctst', 'kntt', 'canhdieu'];
const EXPECTED_TYPES = { multiple_choice: 32, true_false: 16, fill_blank: 16, multiple_select: 8, matching: 8, ordering: 8, short_answer: 16, essay: 16 };
const TAXONOMIES = new Set(['remember', 'understand', 'apply', 'analyze', 'create']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const report = {
  release: 'V8.0.0',
  officialFramework: 'Chương trình Giáo dục phổ thông 2018; mã căn chỉnh nội bộ, cần giáo viên thẩm định',
  programs: PROGRAMS.length,
  grades: 12,
  lessons: 0,
  assessmentQuestions: 0,
  checkpointQuestions: 0,
  uniqueAssessmentPrompts: 0,
  uniqueCheckpointPrompts: 0,
  curriculumAlignmentMissing: 0,
  questionMetadataErrors: 0,
  questionDuplicates: 0,
  questionTypeErrors: 0,
  courseMetadataErrors: 0,
  sampleIssues: []
};
function issue(code, details) {
  report[code] += 1;
  if (report.sampleIssues.length < 20) report.sampleIssues.push({ code, details });
}
for (let grade = 1; grade <= 12; grade += 1) {
  for (const programCode of PROGRAMS) {
    const catalog = curriculum.buildCatalog(grade, programCode);
    if (!catalog || catalog.grade !== grade || !Array.isArray(catalog.courses)) {
      issue('courseMetadataErrors', `Catalog missing/mismatched grade=${grade} program=${programCode}`);
      continue;
    }
    for (const course of catalog.courses) {
      if (course.grade !== grade || course.programCode !== programCode || !course.subjectCode || !Array.isArray(course.units)) {
        issue('courseMetadataErrors', `Course metadata mismatch: ${course.id}`);
      }
      for (const unit of course.units) for (const lesson of unit.lessons || []) {
        report.lessons += 1;
        const alignment = lesson.alignment;
        if (!alignment || alignment.grade !== grade || alignment.subjectCode !== course.subjectCode || !alignment.alignmentId || alignment.intendedOutcomes?.length < 3 || !alignment.frameworkReferenceIds?.includes('GDPT-2018-TT32-CONSOLIDATED') || !String(alignment.status).includes('teacher-validation-required')) {
          issue('curriculumAlignmentMissing', `${lesson.id}: grade=${grade}, subject=${course.subjectCode}, alignment=${Boolean(alignment)}`);
        }
        const pool = questionBanks.buildQuestionPool({ grade, programCode, subjectCode: course.subjectCode, lesson });
        const formal = pool.filter((item) => item.purpose === 'assessment');
        const checkpoints = pool.filter((item) => item.purpose === 'checkpoint');
        report.assessmentQuestions += formal.length;
        report.checkpointQuestions += checkpoints.length;
        if (formal.length !== 120 || JSON.stringify(Object.entries(formal.reduce((counts, item) => { counts[item.type] = (counts[item.type] || 0) + 1; return counts; }, {})).sort()) !== JSON.stringify(Object.entries(EXPECTED_TYPES).sort())) {
          issue('questionTypeErrors', `${lesson.id}: assessment length=${formal.length}, counts=${JSON.stringify(formal.reduce((counts, item) => { counts[item.type] = (counts[item.type] || 0) + 1; return counts; }, {}))}`);
        }
        if (checkpoints.length !== 32) issue('questionTypeErrors', `${lesson.id}: checkpoint length=${checkpoints.length}`);
        for (const part of lesson.parts || []) {
          if (checkpoints.filter((item) => item.partId === part.id).length !== 8) issue('questionTypeErrors', `${lesson.id}/${part.id}: checkpoint candidates must be 8`);
        }
        const allItems = [...formal, ...checkpoints];
        for (const item of allItems) {
          if (item.grade !== grade || item.programCode !== programCode || item.subjectCode !== course.subjectCode || item.lessonId !== lesson.id || !item.topicTag || !item.topicTitle || !TAXONOMIES.has(item.taxonomy) || !DIFFICULTIES.has(item.difficulty) || !item.curriculumAlignmentId || !item.mappedStrand || !item.intendedOutcomes?.length || !String(item.contentStatus).includes('draft')) {
            issue('questionMetadataErrors', `${item.questionId || item.id}: misaligned or incomplete metadata`);
          }
        }
        const assessmentPrompts = formal.map((item) => String(item.prompt || '').trim().toLocaleLowerCase('vi-VN'));
        const checkpointPrompts = checkpoints.map((item) => String(item.prompt || '').trim().toLocaleLowerCase('vi-VN'));
        report.uniqueAssessmentPrompts += new Set(assessmentPrompts).size;
        report.uniqueCheckpointPrompts += new Set(checkpointPrompts).size;
        if (new Set(assessmentPrompts).size !== assessmentPrompts.length) issue('questionDuplicates', `${lesson.id}: duplicated assessment prompts`);
        if (new Set(checkpointPrompts).size !== checkpointPrompts.length) issue('questionDuplicates', `${lesson.id}: duplicated checkpoint prompts`);
      }
    }
  }
}
const universityBank = buildCareerQuestionBank();
report.universityCourses = career.listCourses().length;
report.universityLessons = career.getAllCourses().reduce((sum, item) => sum + item.lessonCount, 0);
report.universityQuestions = universityBank.length;
report.universityUniqueQuestionIds = new Set(universityBank.map((item) => item.questionId)).size;
if (report.universityCourses !== 34 || report.universityLessons !== 414 || report.universityQuestions !== 26496 || report.universityUniqueQuestionIds !== universityBank.length) {
  issue('questionMetadataErrors', `University bank totals invalid: courses=${report.universityCourses}, lessons=${report.universityLessons}, questions=${report.universityQuestions}`);
}
for (const question of universityBank) {
  if (question.active !== false || question.contentStatus !== 'draft-teacher-review-required' || !TAXONOMIES.has(question.taxonomy) || !DIFFICULTIES.has(question.difficulty) || !question.prompt || !question.courseId || !question.moduleId || !question.lessonId) {
    issue('questionMetadataErrors', `University question schema invalid: ${question.questionId}`);
  }
}
report.generatedQuestionRecords = report.assessmentQuestions + report.checkpointQuestions + report.universityQuestions;
report.pass = report.curriculumAlignmentMissing === 0 && report.questionMetadataErrors === 0 && report.questionDuplicates === 0 && report.questionTypeErrors === 0 && report.courseMetadataErrors === 0 && report.lessons === 4764 && report.assessmentQuestions === 571680 && report.checkpointQuestions === 152448;
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
