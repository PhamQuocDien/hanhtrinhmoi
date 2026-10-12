'use strict';
const catalog = require('../../content/career-paths/catalog');
const { buildCareerQuestionBank } = require('../../content/career-paths/software-development/question-bank');
const { getVideoLink } = require('../../content/video-links');

function main() {
  const failures = [];
  const groups = catalog.listGroups();
  const courses = catalog.getAllCourses();
  const lessons = courses.flatMap((course) => course.lessons.map((lesson) => ({ course, lesson })));
  const groupIds = new Set(groups.map((group) => group.id));
  const courseIds = new Set();
  const lessonIds = new Set();
  const executableLanguages = new Set(['cpp', 'java', 'csharp', 'javascript', 'python', 'sql']);
  if (groups.length !== 9) failures.push(`Expected 9 IT groups; found ${groups.length}`);
  if (courses.length !== 34) failures.push(`Expected 34 courses; found ${courses.length}`);
  for (const group of groups) {
    if (!groupIds.has(group.id)) failures.push(`Duplicate/unknown group id: ${group.id}`);
    const items = catalog.listCourses(group.id);
    if (items.length < 3) failures.push(`${group.id} has fewer than 3 courses`);
    const ids = new Set(items.map((item) => item.id));
    for (const path of group.pathways || []) {
      for (const courseId of path.courseIds || []) if (!ids.has(courseId)) failures.push(`${path.id} links a course outside ${group.id}: ${courseId}`);
    }
  }
  for (const course of courses) {
    if (courseIds.has(course.id)) failures.push(`Duplicate course id: ${course.id}`);
    courseIds.add(course.id);
    if (!(course.modules || []).length) failures.push(`${course.id} has no modules`);
    for (const lesson of course.lessons) {
      if (lessonIds.has(lesson.id)) failures.push(`Duplicate lesson id: ${lesson.id}`);
      lessonIds.add(lesson.id);
      for (const field of ['title', 'objective', 'material', 'example', 'practice', 'deliverable']) if (!String(lesson[field] || '').trim()) failures.push(`${lesson.id} missing ${field}`);
      if (!Array.isArray(lesson.sections) || !lesson.sections.some((section) => section.type === 'theory') || !lesson.sections.some((section) => section.type === 'practice')) failures.push(`${lesson.id} missing theory/practice section`);
      if (lesson.videoUrl === undefined || lesson.videoStatus === undefined) failures.push(`${lesson.id} missing video placeholder fields`);
      const video = getVideoLink({ programCode: 'career', grade: 'university', subjectCode: course.groupCode || course.groupId, lessonId: lesson.id });
      if (!video.videoUrl || !video.videoUrl.includes(lesson.id)) failures.push(`${lesson.id} missing external video-link row`);
      if (lesson.codeExercise?.enabled) {
        for (const language of lesson.codeExercise.runnableLanguages || []) {
          if (!executableLanguages.has(language)) failures.push(`${lesson.id} uses unapproved runtime: ${language}`);
          if (!String(lesson.codeExercise.starterCodeByLanguage?.[language] || '').trim()) failures.push(`${lesson.id} missing starter code for ${language}`);
        }
        for (const language of lesson.codeExercise.languages || []) if (!String(lesson.codeExercise.starterCodeByLanguage?.[language] || '').trim()) failures.push(`${lesson.id} missing sample/editor contents for ${language}`);
      }
    }
  }
  const questions = buildCareerQuestionBank();
  const questionIds = new Set();
  const perLesson = new Map();
  for (const item of questions) {
    if (questionIds.has(item.questionId)) failures.push(`Duplicate question id: ${item.questionId}`);
    questionIds.add(item.questionId);
    if (!item.courseId || !item.moduleId || !item.lessonId || !item.type || !item.taxonomy || !item.difficulty) failures.push(`Question missing metadata: ${item.questionId}`);
    if (item.active !== false || item.contentStatus !== 'draft-teacher-review-required') failures.push(`Generated question is not safely inactive draft: ${item.questionId}`);
    const rows = perLesson.get(item.lessonId) || [];
    rows.push(item);
    perLesson.set(item.lessonId, rows);
  }
  for (const [lessonId, rows] of perLesson) {
    if (new Set(rows.map((item) => item.prompt)).size !== rows.length) failures.push(`Repeated prompts within lesson ${lessonId}`);
  }
  if (lessons.length !== 414) failures.push(`Expected 414 lessons; found ${lessons.length}`);
  if (questions.length !== lessons.length * 64) failures.push(`Expected 64 questions per lesson; found ${questions.length} questions for ${lessons.length} lessons`);
  if (failures.length) {
    process.stderr.write(`IT curriculum audit FAILED (${failures.length} finding(s))\n${failures.slice(0, 80).map((item) => `- ${item}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(JSON.stringify({ status: 'passed', groups: groups.length, courses: courses.length, lessons: lessons.length, questionCandidates: questions.length, checkpointCodeLabCoverage: lessons.filter(({ lesson }) => lesson.codeExercise?.enabled).length, questionIdsUnique: true, promptsUniqueWithinLesson: true, careerVideoLinkRows: lessons.length, generatedQuestionsActive: false, curriculumAccreditation: 'requires teacher review' }, null, 2) + '\n');
}
main();
