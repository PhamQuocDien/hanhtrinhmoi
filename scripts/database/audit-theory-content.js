'use strict';

const curriculum = require('../../content/curriculum');
const career = require('../../content/career-paths/catalog');
const report = {
  release: 'V8.0.0',
  purpose: 'Check that generated lesson theory is present, structured, and matched to lesson-topic context; this is a heuristic audit, not teacher accreditation.',
  schoolPrograms: ['ctst', 'kntt', 'canhdieu'].length,
  grades: 12,
  schoolLessons: 0,
  schoolTheoryMissing: 0,
  schoolTheoryStructureErrors: 0,
  schoolEmptyExamples: 0,
  schoolGenericFallbacks: 0,
  schoolMatchContexts: {},
  schoolSubjectMatchContexts: {},
  universityCourses: 0,
  universityLessons: 0,
  universityTheoryMissing: 0,
  universityTheoryStructureErrors: 0,
  universityGenericFallbacks: 0,
  universityMatchContexts: {},
  issueSamples: [],
};
function issue(category, details) {
  report[category] += 1;
  if (report.issueSamples.length < 30) report.issueSamples.push({ category, details });
}
function countContext(map, context) {
  const key = String(context || 'missing');
  map[key] = (map[key] || 0) + 1;
}
function checkTheory(theory, lessonTitle, type) {
  const missingKey = type === 'school' ? 'schoolTheoryMissing' : 'universityTheoryMissing';
  const structureKey = type === 'school' ? 'schoolTheoryStructureErrors' : 'universityTheoryStructureErrors';
  if (!theory || !Array.isArray(theory.sections) || theory.sections.length < 6 || !String(theory.summary || '').trim() || !String(theory.sourceNote || '').trim()) {
    issue(structureKey, `${type} lesson "${lessonTitle}" has no complete theory object or six sections`);
    if (!theory) report[missingKey] += 1;
    return;
  }
  const required = type === 'school' ? ['concept', 'principles', 'worked-example', 'method', 'misconceptions', 'self-check'] : ['concept', 'terms', 'example', 'procedure', 'deliverable', 'pitfalls'];
  const ids = new Set(theory.sections.map((item) => item.id));
  if (required.some((id) => !ids.has(id)) || theory.status !== 'draft-teacher-review-required' || theory.version !== 'V8.0.0') {
    issue(structureKey, `${type} lesson "${lessonTitle}" is missing required section IDs/status/version`);
  }
  const exampleId = type === 'school' ? 'worked-example' : 'example';
  const example = theory.sections.find((item) => item.id === exampleId);
  const exampleText = `${example?.body || ''} ${(example?.items || []).join(' ')}`.trim();
  if (exampleText.length < 45) issue(type === 'school' ? 'schoolEmptyExamples' : 'universityTheoryStructureErrors', `${type} lesson "${lessonTitle}" has a thin worked example`);
}

for (let grade = 1; grade <= 12; grade += 1) {
  for (const programCode of ['ctst', 'kntt', 'canhdieu']) {
    for (const subject of curriculum.subjectsForGrade(grade)) {
      const course = curriculum.buildCourse(grade, programCode, subject.code);
      if (!course) {
        issue('schoolTheoryStructureErrors', `Missing course: grade=${grade}, program=${programCode}, subject=${subject.code}`);
        continue;
      }
      for (const unit of course.units || []) {
        for (const lesson of unit.lessons || []) {
          report.schoolLessons += 1;
          checkTheory(lesson.theory, lesson.title, 'school');
          countContext(report.schoolMatchContexts, lesson.theory?.matchContext);
          if (['subject-default', 'subject-specific-default'].includes(lesson.theory?.matchContext)) issue('schoolGenericFallbacks', `${subject.code} grade ${grade}: generic theory fallback for ${lesson.title}`);
          const subjectContext = `${subject.code}/${lesson.theory?.matchContext || 'missing'}`;
          countContext(report.schoolSubjectMatchContexts, subjectContext);
          const publicLesson = curriculum.publicLesson(lesson);
          if (!publicLesson.theory || publicLesson.theory.sections?.length < 6) {
            issue('schoolTheoryStructureErrors', `publicLesson removed theory for ${lesson.id}`);
          }
        }
      }
    }
  }
}

const courses = career.getAllCourses();
report.universityCourses = courses.length;
for (const course of courses) {
  const publicCourse = career.publicCourseDetail(course);
  for (const unit of publicCourse?.modules || []) {
    for (const lesson of unit.lessons || []) {
      report.universityLessons += 1;
      checkTheory(lesson.theory, lesson.title, 'university');
      countContext(report.universityMatchContexts, lesson.theory?.matchContext);
      if (['career-group-default', 'general-engineering'].includes(lesson.theory?.matchContext)) issue('universityGenericFallbacks', `${course.title}: generic theory fallback for ${lesson.title}`);
      if (!lesson.theory?.conceptName || !String(lesson.theory.summary || '').trim()) {
        issue('universityTheoryStructureErrors', `Missing concept/summary for ${course.id}/${lesson.id}`);
      }
    }
  }
}

report.expectedSchoolLessons = 4764;
report.expectedUniversityCourses = 34;
report.expectedUniversityLessons = 414;
report.pass = report.schoolLessons === report.expectedSchoolLessons
  && report.schoolTheoryMissing === 0
  && report.schoolTheoryStructureErrors === 0
  && report.schoolEmptyExamples === 0
  && report.schoolGenericFallbacks === 0
  && report.universityGenericFallbacks === 0
  && report.universityCourses === report.expectedUniversityCourses
  && report.universityLessons === report.expectedUniversityLessons
  && report.universityTheoryMissing === 0
  && report.universityTheoryStructureErrors === 0;
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
