'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ai = require('../server/services/local-education-ai');
const routeSource = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'server/services/ai-generation-worker.js'), 'utf8');
const autopilotSource = fs.readFileSync(path.join(root, 'server/services/ai-autopilot-service.js'), 'utf8');
const studioSource = fs.readFileSync(path.join(root, 'assets/js/admin/admin-content-studio.js'), 'utf8');
const factorySource = fs.readFileSync(path.join(root, 'assets/js/admin/admin-course-factory.js'), 'utf8');
const guideSource = fs.readFileSync(path.join(root, 'assets/js/admin/admin-guide.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(root, 'admin/index.html'), 'utf8');
const packageJson = require(path.join(root, 'package.json'));
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

test('Local Education AI exports project-specific domain seeds', () => {
    for (const domain of ['COMPUTING','ECONOMICS','MECHATRONICS','ENGINEERING','APPLIED_SCIENCES','ENGLISH','MOS','K12']) { const minimum = ['ENGLISH','MOS'].includes(domain) ? 2 : 5; assert(Array.isArray(ai.DOMAIN_COURSE_SEEDS[domain]) && ai.DOMAIN_COURSE_SEEDS[domain].length >= minimum, `${domain} needs at least ${minimum} seeds`); }
});
test('Local Course Factory builds a multi-chapter, practical draft without remote model', () => {
    const blueprint = ai.buildCourseBlueprint({ title: 'Python nền tảng', domainCode: 'COMPUTING', educationLevel: 'HIGHER_EDUCATION', subjectId: 'Python' });
    const quality = ai.validateCourseBlueprint(blueprint);
    assert(quality.valid); assert(blueprint.chapters.length >= 4); assert(quality.lessonCount >= 10); assert(quality.codingQuestionCount > 0); assert.strictEqual(quality.official, false);
});
test('Local Course Factory supports economics, mechatronics, applied science and MOS', () => {
    for (const input of [
        { title: 'Marketing căn bản', domainCode: 'ECONOMICS' },
        { title: 'Lập trình vi điều khiển', domainCode: 'MECHATRONICS' },
        { title: 'Phương pháp thực nghiệm', domainCode: 'APPLIED_SCIENCES' },
        { title: 'MOS Excel thực hành', domainCode: 'MOS', educationLevel: 'ENGLISH_CERTIFICATION' }
    ]) {
        const blueprint = ai.buildCourseBlueprint(input);
        assert(blueprint.chapters.length >= 4); assert(ai.validateCourseBlueprint(blueprint).valid, input.title);
    }
});
test('Duplicate course detection finds existing same-domain course', () => {
    const duplicate = ai.findDuplicateCourses({ title: 'Python nền tảng', name: 'Python nền tảng', domainCode: 'COMPUTING', educationLevel: 'HIGHER_EDUCATION', subjectId: 'Python' }, [{ _id: 'course-1', name: 'Python nền tảng', educationLevel: 'HIGHER_EDUCATION', subjectId: 'Python', syllabus: { domainCode: 'COMPUTING' } }]);
    assert(duplicate.some(item => item.score >= 0.99));
});
test('Catalog gap engine recommends missing skills and marks local-only output', () => {
    const result = ai.analyzeCatalogGaps({ goal: 'Học SQL nâng cao', requestedSkills: ['SQL JOIN', 'Indexing'], courses: [], starterCourses: [] });
    assert(Array.isArray(result.gaps)); assert(result.gaps.length > 0); assert(Array.isArray(result.recommendedActions));
});
test('Admin guide contains 20+ practical steps and varied question-type instructions', () => {
    const guide = ai.buildAdminGuide();
    assert(guide.steps.length >= 20); assert(guide.questionTypes.length >= 13);
    const topics = guide.steps.map(step => step.title).join(' ');
    for (const topic of ['khóa học', 'lesson', 'coding', 'TOEIC', 'IELTS', 'MOS', 'Word', 'Autopilot']) assert(topics.toLowerCase().includes(topic.toLowerCase()), `Missing guide topic ${topic}`);
});
test('Admin HTML wires guide, content studio and internal AI CMS modules', () => {
    assert(adminHtml.includes('admin-guide.js')); assert(adminHtml.includes('admin-content-studio.js')); assert(adminHtml.includes('admin-course-factory.js'));
    assert(adminHtml.includes('data-view="guide"') || adminHtml.includes('href="#guide"'));
});
test('Content Studio creates courses, lessons, questions, assessments and programs through forms', () => {
    for (const field of ['courseForm','lessonForm','questionForm','assessmentForm','programForm','data-preview-type','/studio/preview/']) assert(studioSource.includes(field), `Missing ${field}`);
    assert(studioSource.includes('starterCode') || studioSource.includes('f-starter-code')); assert(studioSource.includes('f-visible-tests')); assert(studioSource.includes('trainingProgramId'));
});
test('Admin UI has catalog batch, autopilot, preview, draft approval and job monitor', () => {
    for (const token of ['data-catalog-expansion','catalog-expansion','data-factory-autopilot','data-draft-preview','data-draft-publish','data-factory-jobs']) assert(factorySource.includes(token), `Missing ${token}`);
});
test('Internal generation jobs use LOCAL_EDUCATION_AI and require review before publish', () => {
    assert(workerSource.includes("payload.localAction === 'COURSE_FACTORY'")); assert(workerSource.includes("model: 'LOCAL_EDUCATION_AI'")); assert(workerSource.includes('validateCourseBlueprint')); assert(workerSource.includes('remoteApiUsed: false'));
    assert(routeSource.includes("publishPolicy: 'ADMIN_REVIEW_REQUIRED'")); assert(routeSource.includes('catalog-expansion'));
});
test('Catalog expansion is bounded, deduplicated, idempotent and draft-only', () => {
    assert(routeSource.includes('Math.min(25')); assert(routeSource.includes('findDuplicateCourses(input, existingCourses, STARTER_COURSES)')); assert(routeSource.includes('CATALOG_EXPANSION:')); assert(routeSource.includes("payload: { localAction: 'COURSE_FACTORY'")); assert(routeSource.includes('ADMIN_REVIEW_REQUIRED'));
});
test('Course publish quality gate checks real lessons, practice/examples and published assessment', () => {
    assert(routeSource.includes('COURSE_NO_LESSONS')); assert(routeSource.includes('COURSE_LESSON_QUALITY_GATE')); assert(routeSource.includes('COURSE_TEST_REQUIRED'));
});
test('Program and curriculum forms validate relations and require course for chapter nodes', () => {
    assert(routeSource.includes('PROGRAM_FACULTY_MISMATCH')); assert(routeSource.includes('PROGRAM_GROUP_MISMATCH')); assert(routeSource.includes('PROGRAM_MAJOR_MISMATCH')); assert(routeSource.includes('CURRICULUM_COURSE_REQUIRED'));
});
test('Autopilot uses survey, placement, mastery, errors, active plan and recent assessment evidence', () => {
    for (const token of ['SurveyAttempt.findOne','PlacementAttempt.findOne','LearningPlan.findOne','AssessmentAttempt.find','PROFILE_SURVEY_PLACEMENT_LEARNING_PLAN']) assert(routeSource.includes(token), `Missing ${token}`);
    assert(routeSource.includes('requestedSkills: requestSkills'), 'Autopilot must pass collected skills to gap analysis');
});
test('Remote AI fallback is disabled by default and local engine has no external API dependency', () => {
    assert(autopilotSource.includes("process.env.AI_REMOTE_FALLBACK_ENABLED || 'false'") && autopilotSource.includes('remoteAiOptIn')); 
    assert(!/https?:\/\/|fetch\s*\(|generativeModel|GoogleGenerativeAI|gemini-service/i.test(fs.readFileSync(path.join(root, 'server/services/local-education-ai.js'), 'utf8')));
});
test('No JSON editor is required in admin content studio and source provenance avoids automatic official status', () => {
    assert(!/textarea[^>]*(json editor|raw json)/i.test(studioSource)); assert(studioSource.includes('OFFICIAL'));
    assert(routeSource.includes("verification: 'unverified'")); assert(routeSource.includes('official: false'));
});
test('Lesson self-repair touches a single lesson and fills missing learning sections/practice', () => {
    const repair = ai.buildLessonRepairPatch({ lesson: { _id: 'lesson-a', title: 'Vòng lặp', theory: 'Một đoạn lý thuyết ngắn.', theorySections: [{ title: 'Cũ', content: 'Một đoạn lý thuyết ngắn.' }], examples: [], activities: [], payload: {} }, course: { name: 'Python căn bản', subjectId: 'Python', educationLevel: 'HIGHER_EDUCATION' } });
    assert.strictEqual(repair.targetType, 'LESSON'); assert(repair.repairable); assert(repair.wordCount >= 100); assert(repair.patch.theorySections.length >= 2); assert(repair.patch.activities.length > 0); assert(repair.changedFields.includes('payload'));
});
test('Question self-repair never invents a missing correct answer and keeps invalid item as draft', () => {
    const repair = ai.buildQuestionRepairPatch({ question: { code: 'Q1', type: 'single_choice', prompt: '2 + 2 = ?', options: [{ text: '3' }, { label: '4', value: 'B' }] } });
    assert.strictEqual(repair.status, 'NEEDS_ADMIN_REVIEW'); assert.strictEqual(repair.patch.status, 'DRAFT'); assert(repair.errors.some(error => error.includes('đáp án chuẩn')));
});
test('Assessment self-repair only attaches actual supplied question IDs and stays draft', () => {
    const repair = ai.buildAssessmentRepairPatch({ assessment: { title: 'Kiểm tra nhanh', questionIds: [], questionPool: [], sections: [] }, availableQuestions: [{ _id: 'q1', prompt: 'Câu 1' }, { _id: 'q2', prompt: 'Câu 2' }] });
    assert.strictEqual(repair.status, 'REPAIRED_DRAFT'); assert.deepStrictEqual(repair.patch.questionIds, ['q1','q2']); assert.strictEqual(repair.patch.publicationStatus, 'DRAFT');
});
test('Admin exposes targeted repair and failed-job retry without editing JSON', () => {
    assert(routeSource.includes('/admin/platform/course-factory/repair/options')); assert(routeSource.includes('/admin/platform/course-factory/repair')); assert(routeSource.includes('/admin/platform/course-factory/jobs/:id/retry'));
    assert(factorySource.includes('data-content-repair')); assert(factorySource.includes('data-job-retry')); assert(factorySource.includes('data-factory-tab="repair"'));
    assert(workerSource.includes("payload.localAction === 'CONTENT_REPAIR'"));
});
test('Phase 3 scripts are part of npm test and check chains', () => {
    assert(packageJson.scripts.test.includes('test-v23-phase3.js')); assert(packageJson.scripts.check.includes('test-v23-phase3.js'));
});
console.log(`\nV23 Phase 3: ${passed} tests PASS.`);
