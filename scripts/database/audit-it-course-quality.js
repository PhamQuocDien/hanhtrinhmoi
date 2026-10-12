'use strict';
const catalog = require('../../content/career-paths/catalog');
const { buildCourseQuality, buildLessonLearningGuide, QUALITY_VERSION } = require('../../content/quality/it-course-quality');

function main() {
  const failures = [];
  const courses = catalog.getAllCourses();
  let lessonsChecked = 0;
  let codingScaffoldsChecked = 0;
  for (const course of courses) {
    const blueprint = buildCourseQuality(course);
    if (!blueprint.learningOutcomes.length) failures.push(`${course.id}: missing course outcomes`);
    if (blueprint.moduleMilestones.length !== course.modules.length) failures.push(`${course.id}: module milestones do not match modules`);
    if (blueprint.capstone.rubric.reduce((sum, row) => sum + row.points, 0) !== 100) failures.push(`${course.id}: capstone rubric must sum to 100`);
    for (const module of course.modules) for (const lesson of module.lessons) {
      lessonsChecked += 1;
      const guide = buildLessonLearningGuide({ course, module, lesson });
      if (guide.version !== QUALITY_VERSION || !guide.learningOutcomes.length || !guide.selfCheck.length) failures.push(`${course.id}/${lesson.id}: incomplete learning guide`);
      if (guide.rubric.reduce((sum, row) => sum + row.points, 0) !== 100) failures.push(`${lesson.id}: lesson rubric must sum to 100`);
      if (guide.studyPlan.reduce((sum, row) => sum + row.minutes, 0) !== guide.estimatedMinutes) failures.push(`${lesson.id}: study time must match lesson duration`);
      if (lesson.codeExercise?.enabled) {
        codingScaffoldsChecked += 1;
        for (const language of lesson.codeExercise.languages || []) {
          const starter = String(lesson.codeExercise.starterCodeByLanguage?.[language] || '');
          if (!starter.trim()) failures.push(`${lesson.id}: missing ${language} starter`);
          if (/readFileSync\(0,\s*['"]utf8['"]\)[\s\S]*console\.log\(input\)|getline\(cin,\s*input\)[\s\S]*cout\s*<<\s*input/.test(starter)) failures.push(`${lesson.id}: ${language} still uses input-echo placeholder`);
        }
      }
    }
  }
  if (courses.length !== 34) failures.push(`Expected 34 courses; found ${courses.length}`);
  if (lessonsChecked !== 414) failures.push(`Expected 414 lessons; found ${lessonsChecked}`);
  if (failures.length) {
    process.stderr.write(`IT course quality audit FAILED (${failures.length} finding(s))\n${failures.slice(0, 80).map((item) => `- ${item}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(JSON.stringify({ status: 'passed', version: QUALITY_VERSION, courses: courses.length, lessonsChecked, lessonsWithGuides: lessonsChecked, codingScaffoldsChecked, projectRubricTotal: 100, lessonRubricTotal: 100, generatedQuestionsActive: false, syllabusApproval: 'teacher-review-required' }, null, 2) + '\n');
}
main();
