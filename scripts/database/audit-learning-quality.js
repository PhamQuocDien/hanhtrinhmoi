'use strict';
const curriculum = require('../../content/curriculum');
const questionBanks = require('../../content/question-banks');
const careerCatalog = require('../../content/career-paths/catalog');
const { buildCareerQuestionBank } = require('../../content/career-paths/software-development/question-bank');
const { FRAMEWORKS, ASSESSMENT_TYPES, COURSE_QUALITY_GATES } = require('../../content/quality/learning-quality');

const PROGRAMS = ['ctst', 'kntt', 'canhdieu'];
const EXPECTED_TYPES = { multiple_choice: 32, true_false: 16, fill_blank: 16, multiple_select: 8, matching: 8, ordering: 8, short_answer: 16, essay: 16 };
const report = { release: 'V8.0.0', frameworks: FRAMEWORKS.length, assessmentFormats: ASSESSMENT_TYPES.length, qualityGates: COURSE_QUALITY_GATES.length, schoolLessons: 0, expectedSchoolAssessmentQuestions: 0, expectedSchoolCheckpointQuestions: 0, sampledQuestionLessons: 0, sampledAssessmentQuestions: 0, sampledCheckpointQuestions: 0, universityCourses: 0, universityLessons: 0, universityQuestionCandidates: 0, curriculumAlignmentErrors: 0, questionMetadataErrors: 0, duplicateQuestionIds: 0, duplicatePromptsWithinLesson: 0, qualityProfileErrors: 0, sampleIssues: [] };
function issue(key, details) { report[key] += 1; if (report.sampleIssues.length < 25) report.sampleIssues.push({ code: key, details }); }
function countsOf(rows) { return rows.reduce((counts, row) => { counts[row.type] = (counts[row.type] || 0) + 1; return counts; }, {}); }
function sameCounts(actual, expected) { return JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort()); }

// Check every lesson's outcomes and alignment profile. Sample the first lesson in every subject/course
// for actual generated-question validation; audit:curriculum performs the exhaustive per-question scan.
for (let grade = 1; grade <= 12; grade += 1) for (const programCode of PROGRAMS) {
  const catalog = curriculum.buildCatalog(grade, programCode);
  if (!catalog || catalog.grade !== grade || catalog.program?.code !== programCode || !Array.isArray(catalog.courses)) { issue('curriculumAlignmentErrors', `Missing/mismatched catalog g${grade}/${programCode}`); continue; }
  for (const course of catalog.courses) {
    for (const unit of course.units || []) for (const lesson of unit.lessons || []) {
      report.schoolLessons += 1;
      const profile = lesson.qualityProfile;
      if (!profile || profile.profileVersion !== 'V8.0.0' || profile.status !== 'draft-teacher-validation-required' || profile.standardsAlignment?.claim !== 'framework-referenced-not-accredited' || !profile.learningOutcomes?.length || !profile.learningSequence?.includes('guided-practice') || !profile.assessmentTypes?.length || profile.assessmentPolicy?.generatedContent !== 'inactive-until-reviewed') issue('qualityProfileErrors', `${lesson.id}: quality profile missing/incomplete or improperly claiming accreditation`);
      const alignment = lesson.alignment;
      if (!alignment || alignment.grade !== grade || alignment.subjectCode !== course.subjectCode || !alignment.alignmentId || !alignment.intendedOutcomes?.length || !alignment.frameworkReferenceIds?.includes('GDPT-2018-TT32-CONSOLIDATED') || !String(alignment.status).includes('teacher-validation-required')) issue('curriculumAlignmentErrors', `${lesson.id}: curriculum metadata not aligned/review-required`);
    }
    const sampleLesson = course.units?.[0]?.lessons?.[0];
    if (!sampleLesson) continue;
    report.sampledQuestionLessons += 1;
    const pool = questionBanks.buildQuestionPool({ grade, programCode, subjectCode: course.subjectCode, lesson: sampleLesson });
    const assessment = pool.filter((item) => item.purpose === 'assessment');
    const checkpoint = pool.filter((item) => item.purpose === 'checkpoint');
    report.sampledAssessmentQuestions += assessment.length;
    report.sampledCheckpointQuestions += checkpoint.length;
    if (assessment.length !== 120 || !sameCounts(countsOf(assessment), EXPECTED_TYPES)) issue('questionMetadataErrors', `${sampleLesson.id}: wrong question count/type mix ${assessment.length}/${JSON.stringify(countsOf(assessment))}`);
    if (checkpoint.length !== 32) issue('questionMetadataErrors', `${sampleLesson.id}: expected 32 checkpoint candidates, found ${checkpoint.length}`);
    for (const item of [...assessment, ...checkpoint]) {
      if (!item.questionId || !item.prompt || item.grade !== grade || item.programCode !== programCode || item.subjectCode !== course.subjectCode || item.lessonId !== sampleLesson.id || !item.topicTag || !item.topicTitle || !item.curriculumAlignmentId || !item.mappedStrand || !item.intendedOutcomes?.length || !String(item.contentStatus).includes('draft') || !['easy', 'medium', 'hard'].includes(item.difficulty) || !['remember', 'understand', 'apply', 'analyze', 'create'].includes(item.taxonomy)) issue('questionMetadataErrors', `${item.questionId || item.id}: missing scope/quality metadata`);
      if (item.type === 'matching' && (!(item.matchingItems || []).length || !(item.options || []).length || !String(item.correctAnswer || '').includes('='))) issue('questionMetadataErrors', `${item.questionId}: malformed matching question`);
      if (item.type === 'ordering' && (!(item.orderingItems || []).length || !(item.options || []).length || !String(item.correctAnswer || '').includes('|'))) issue('questionMetadataErrors', `${item.questionId}: malformed ordering question`);
      if (item.type === 'multiple_select' && (!(item.options || []).length || !String(item.correctAnswer || '').includes('|'))) issue('questionMetadataErrors', `${item.questionId}: malformed multiple-select question`);
    }
    if (new Set(assessment.map((item) => item.questionId)).size !== assessment.length || new Set(checkpoint.map((item) => item.questionId)).size !== checkpoint.length) issue('duplicateQuestionIds', `${sampleLesson.id}: repeated IDs in sampled lesson`);
    if (new Set(assessment.map((item) => String(item.prompt || '').trim().toLocaleLowerCase('vi-VN'))).size !== assessment.length || new Set(checkpoint.map((item) => String(item.prompt || '').trim().toLocaleLowerCase('vi-VN'))).size !== checkpoint.length) issue('duplicatePromptsWithinLesson', `${sampleLesson.id}: repeated prompt in sampled bank`);
  }
}

report.expectedSchoolAssessmentQuestions = report.schoolLessons * 120;
report.expectedSchoolCheckpointQuestions = report.schoolLessons * 32;
const courses = careerCatalog.getAllCourses();
const universityBank = buildCareerQuestionBank();
report.universityCourses = courses.length;
report.universityLessons = courses.reduce((sum, course) => sum + course.lessonCount, 0);
report.universityQuestionCandidates = universityBank.length;
const ids = new Set();
const promptsByLesson = new Map();
for (const item of universityBank) {
  if (!item.questionId || ids.has(item.questionId)) issue('duplicateQuestionIds', `University question ID duplicate/missing: ${item.questionId}`);
  ids.add(item.questionId);
  const key = `${item.courseId}|${item.lessonId}`;
  if (!promptsByLesson.has(key)) promptsByLesson.set(key, new Set());
  const set = promptsByLesson.get(key);
  if (!item.prompt || set.has(String(item.prompt).trim().toLocaleLowerCase('vi-VN'))) issue('duplicatePromptsWithinLesson', `University prompt repeated in ${key}`);
  set.add(String(item.prompt).trim().toLocaleLowerCase('vi-VN'));
  if (item.active !== false || item.contentStatus !== 'draft-teacher-review-required' || !item.courseId || !item.moduleId || !item.lessonId || !item.type || !item.taxonomy || !item.difficulty) issue('questionMetadataErrors', `University question malformed or activated before review: ${item.questionId}`);
}
for (const course of courses) {
  const detail = careerCatalog.publicCourseDetail(course);
  for (const lesson of detail.lessons) {
    const profile = lesson.qualityProfile;
    if (!profile || profile.context?.level !== 'university' || profile.standardsAlignment?.claim !== 'framework-referenced-not-accredited' || !profile.computingOutcomes?.length) issue('qualityProfileErrors', `${course.id}/${lesson.id}: missing IT quality outcomes/profile`);
  }
}
report.expectedGeneratedCandidateTotal = report.expectedSchoolAssessmentQuestions + report.expectedSchoolCheckpointQuestions + report.universityQuestionCandidates;
report.expectedCandidateTotal = 571680 + 152448 + 26496;
report.fullQuestionBankAudit = 'Use npm run audit:curriculum for an exhaustive school-question scan; sampledQuestionLessons checks a sample per subject/course.';
report.pass = report.schoolLessons === 4764 && report.expectedSchoolAssessmentQuestions === 571680 && report.expectedSchoolCheckpointQuestions === 152448 && report.sampledQuestionLessons > 0 && report.sampledAssessmentQuestions === report.sampledQuestionLessons * 120 && report.sampledCheckpointQuestions === report.sampledQuestionLessons * 32 && report.universityCourses === 34 && report.universityLessons === 414 && report.universityQuestionCandidates === 26496 && report.expectedGeneratedCandidateTotal === report.expectedCandidateTotal && report.curriculumAlignmentErrors === 0 && report.questionMetadataErrors === 0 && report.duplicateQuestionIds === 0 && report.duplicatePromptsWithinLesson === 0 && report.qualityProfileErrors === 0;
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
