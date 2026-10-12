'use strict';
const software = require('./software-development');
const extended = require('./it-groups');
const videoLinks = require('../video-links');
const { createLessonQualityProfile } = require('../quality/learning-quality');
const { buildUniversityTheory } = require('../quality/theory-content');
const { buildLessonLearningGuide, buildCourseQuality } = require('../quality/it-course-quality');

const LEGACY_CODE_COURSES = {
  'INPR140285': { languages: ['cpp'], defaultLanguage: 'cpp' },
  'PRTE230385': { languages: ['cpp'], defaultLanguage: 'cpp' },
  'DASA230179': { languages: ['cpp'], defaultLanguage: 'cpp' },
  'OOPR230279': { languages: ['cpp', 'java'], defaultLanguage: 'java' },
  'WIPR230579': { languages: ['csharp'], defaultLanguage: 'csharp' },
  'MOPR331279': { languages: ['java'], defaultLanguage: 'java' }
};
const legacyPrepared = new WeakSet();
function prepareLegacy(course) {
  if (!course || legacyPrepared.has(course)) return course;
  const codeInfo = LEGACY_CODE_COURSES[course.id];
  for (const unit of course.modules || []) {
    for (const lesson of unit.lessons || []) {
      lesson.moduleId = unit.id;
      lesson.videoUrl ??= '';
      lesson.videoStatus ??= 'placeholder-to-be-replaced';
      lesson.example ??= `Ví dụ: áp dụng mục tiêu “${lesson.objective}” vào nhiệm vụ “${lesson.practice}” và đối chiếu sản phẩm “${lesson.deliverable}”.`;
      lesson.sections ??= [
        { id: `${lesson.id}-theory`, type: 'theory', title: 'Lý thuyết cốt lõi', content: lesson.material || '' },
        { id: `${lesson.id}-example`, type: 'worked-example', title: 'Ví dụ minh họa', content: lesson.example || '' },
        { id: `${lesson.id}-practice`, type: 'practice', title: 'Thực hành có hướng dẫn', content: lesson.practice || '' },
        { id: `${lesson.id}-deliverable`, type: 'deliverable', title: 'Sản phẩm cần bàn giao', content: lesson.deliverable || '' }
      ];
      if (codeInfo && !lesson.codeExercise) {
        lesson.codeExercise = {
          enabled: true,
          instructions: lesson.practice || `Thực hành nội dung: ${lesson.title}`,
          languages: codeInfo.languages,
          runnableLanguages: codeInfo.languages,
          defaultLanguage: codeInfo.defaultLanguage,
          starterCodeByLanguage: Object.fromEntries(codeInfo.languages.map((language) => [language, extended.starterFor(language, lesson.title, lesson.practice)])),
          sampleStdin: '',
          note: 'Bài chạy console trong sandbox. Nội dung Android/Windows có API thiết bị riêng cần tiếp tục thực hành trong IDE chuyên dụng.'
        };
      }
    }
  }
  course.lessons = (course.modules || []).flatMap((unit) => unit.lessons || []);
  course.lessonCount = course.lessons.length;
  course.moduleCount = course.modules.length;
  course.groupId = 'it-group-1';
  course.groupCode = software.GROUP.code;
  course.groupTitle = software.GROUP.title;
  legacyPrepared.add(course);
  return course;
}
for (const course of software.COURSES) prepareLegacy(course);

const GROUPS = [
  { ...software.GROUP, pathways: software.PATHWAYS, courseCount: software.COURSES.length, lessonCount: software.COURSES.reduce((sum, item) => sum + item.lessonCount, 0) },
  ...extended.listGroups()
];
function listGroups() { return GROUPS.map((item) => ({ ...item, pathways: item.pathways.map((pathway) => ({ ...pathway })) })); }
function normalizeGroupId(groupId) {
  if (!groupId) return null;
  return GROUPS.find((group) => group.id === groupId || group.code === groupId || String(group.number) === String(groupId)) || null;
}
function listCourses(groupId) {
  const group = normalizeGroupId(groupId);
  const legacy = software.COURSES.filter((course) => !group || group.number === 1).map((course) => {
    const { modules, lessons, ...summary } = prepareLegacy(course);
    return { ...summary, moduleCount: modules.length, lessonCount: lessons.length, questionBankTarget: lessons.length * 64, contentStatus: summary.contentStatus || 'draft-teacher-review-required' };
  });
  const extra = extended.listCourses(group && group.number === 1 ? '__none__' : (group ? group.id : undefined));
  return [...legacy, ...extra].filter((item) => !group || item.groupId === group.id);
}
function getCourse(courseId) {
  const legacy = software.getCourse(courseId);
  if (legacy) return prepareLegacy(legacy);
  return extended.getCourse(courseId);
}
function getGroupForCourse(courseId) {
  const course = getCourse(courseId);
  return course ? normalizeGroupId(course.groupId || course.groupCode) : null;
}
function getAllCourses() { return [...software.COURSES.map(prepareLegacy), ...extended.getAllCourses()]; }
function resolveCareerVideo(course, lesson) {
  const entry = videoLinks.getVideoLink({ programCode: 'career', grade: 'university', subjectCode: course.groupCode || course.groupId, lessonId: lesson.id });
  return entry?.status === 'ready' && /^https:\/\//i.test(entry.videoUrl || '') ? { videoUrl: entry.videoUrl, videoTitle: entry.videoTitle || 'Video bài học', videoStatus: 'ready' } : { videoUrl: lesson.videoUrl || '', videoTitle: entry?.videoTitle || 'Video bài học', videoStatus: entry?.status || lesson.videoStatus || 'placeholder-to-be-replaced' };
}
function publicCourseDetail(course) {
  if (!course) return null;
  const safeModules = (course.modules || []).map((unit, moduleIndex) => ({
    id: unit.id, title: unit.title, summary: unit.summary,
    lessons: (unit.lessons || []).map((item) => {
      const theory = buildUniversityTheory({ courseTitle: course.title, moduleTitle: unit.title, groupId: course.groupId || course.groupCode, lesson: item });
      const courseLessonIndex = (course.lessons || []).findIndex((lesson) => lesson.id === item.id);
      const enrichedSections = (item.sections || []).map((section) => section.type === 'theory' ? { ...section, content: theory.sections[0]?.body || theory.summary } : section);
      return {
      id: item.id, moduleId: unit.id, title: item.title, minutes: item.minutes, objective: item.objective,
      material: item.material, example: item.example || '', practice: item.practice, deliverable: item.deliverable, theory,
      sections: enrichedSections, learningGuide: buildLessonLearningGuide({ course, module: unit, lesson: item, lessonIndex: courseLessonIndex >= 0 ? courseLessonIndex : moduleIndex }), qualityProfile: createLessonQualityProfile({ level: 'university', subjectCode: course.groupCode || course.groupId, lesson: item, hasCodeLab: Boolean(item.codeExercise?.enabled) }), ...resolveCareerVideo(course, item),
      codeExercise: item.codeExercise ? {
        enabled: true, instructions: item.codeExercise.instructions,
        languages: item.codeExercise.languages, runnableLanguages: item.codeExercise.runnableLanguages,
        defaultLanguage: item.codeExercise.defaultLanguage,
        starterCodeByLanguage: item.codeExercise.starterCodeByLanguage,
        sampleStdin: item.codeExercise.sampleStdin || '', note: item.codeExercise.note || ''
      } : null
    }; })
  }));
  const { modules, lessons, ...summary } = course;
  return { ...summary, qualityBlueprint: buildCourseQuality(course), modules: safeModules, lessons: safeModules.flatMap((item) => item.lessons) };
}
module.exports = { GROUPS, listGroups, listCourses, normalizeGroupId, getCourse, getGroupForCourse, getAllCourses, publicCourseDetail, resolveCareerVideo, software, extended };
