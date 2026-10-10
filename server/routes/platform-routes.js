'use strict';

const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { PlatformRepository } = require('../repositories/platform-repository');
const {
    calculateObjectiveScore,
    scoreObjectiveQuestions,
    scoreAssessmentQuestions,
    buildPlacementRecommendation,
    selectAdaptivePlacementQuestion,
    buildAssessmentSkillEvidence,
    buildEnglishSkillProfile,
    buildPersonalLearningPlan,
    estimateIeltsBand,
    buildEnglishPlan,
    normalizeSurveyResult,
    calculateAge,
    possibleEducationStage,
    cleanText,
    parseDocxRows,
    extractDocxText,
    parseLearningDocument
} = require('../services/platform-services');
const { getCatalog } = require('../../curriculum-data');
const { validateProfileUpdate } = require('../validators/auth-validators');
const { createAuditEntry, writeAudit } = require('../services/platform-audit-service');
const { notifyOnce } = require('../services/platform-notification-service');
const { registerPlatformCatalogRoutes } = require('./platform-catalog-routes');
const { buildK12Courses, buildK12CourseDetail, buildK12LessonDetail, K12_SOURCE_REF } = require('../services/learning-catalog-service');
const { generateLessonHelp, isGeminiConfigured, getGeminiModel, getAiMode } = require('../services/gemini-service');
const { STARTER_COURSES, buildStarterCourseDetail } = require('../services/starter-course-catalog');
const { buildK12Questions } = require('../modules/rich-learning-content-v20.js');
const { ensurePersonalCourse, inspectMaterializedCourse } = require('../services/ai-learning-service');
const { withCourseProvisionLock } = require('../services/course-provisioning-coordinator');
const { recordLearningErrors } = require('./learning-intelligence-routes');
const { validateSurvey, validatePlacement, validatePlacementSubmission, visibleSurveyQuestions } = require('../services/diagnostic-validation');
const { buildCourseBlueprint, validateCourseBlueprint, findDuplicateCourses, analyzeCatalogGaps, buildAdminGuide, identifyDomain, DOMAIN_COURSE_SEEDS, slug: localAiSlug, fingerprint: localAiFingerprint } = require('../services/local-education-ai');
const { auditCourseBlueprintV38, auditStoredCourseV38, validateRequestedCourseScope } = require('../services/course-quality-v38');
const { recalculateLessonProgress } = require('../services/lesson-progress-service');

function isObjectId(value) { return mongoose.Types.ObjectId.isValid(String(value || '')); }
function safePatch(value, depth = 0) {
    if (depth > 6) return undefined;
    if (Array.isArray(value)) return value.slice(0, 200).map(item => safePatch(item, depth + 1)).filter(item => item !== undefined);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('$') && !key.includes('.')).slice(0, 200).map(([key, item]) => [key, safePatch(item, depth + 1)]));
}

function createPlatformRouter({ models, requireAuth, requirePermission, legacyUserModel, aiRateLimit }) {
    const router = express.Router();
    const repositories = Object.fromEntries(Object.entries(models).map(([name, Model]) => [name, new PlatformRepository(Model)]));
    const planCourseProvisionJobs = new Map();
    const audit = async (req, action, entityType, entityId, before, after) => writeAudit(models.AuditLog, createAuditEntry({ req, actor: req.session?.user, action, entityType, entityId, before, after }));

    function ok(res, data, message = 'OK') { return res.json({ success: true, data, message }); }
    function fail(res, status, code, message, details) { return res.status(status).json({ success: false, code, message, ...(details ? { details } : {}) }); }
    function parsePage(req) { return { page: req.query.page, limit: req.query.limit }; }
    function guarded(permission) { return requirePermission ? requirePermission(permission) : requireAuth; }
    function answerIsPresent(value) { return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim() !== ''; }
    function surveyIsValid(survey) { return validateSurvey(survey).valid; }
    function placementIsValid(test) { return validatePlacement(test).valid; }
    function optionValue(option) { return option && typeof option === 'object' ? option.value ?? option.id ?? option.label ?? option.text ?? '' : option; }
    async function unlockedLessons(lessons, req, courseId) {
        const ordered = [...lessons].sort((a, b) => Number(a.payload?.chapterOrder || a.chapterOrder || 1) - Number(b.payload?.chapterOrder || b.chapterOrder || 1) || Number(a.payload?.lessonNo || a.lessonNo || a.payload?.order || a.order || 0) - Number(b.payload?.lessonNo || b.lessonNo || b.payload?.order || b.order || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        const username = req.session?.user?.username;
        if (!username) return new Set();
        if (String(req.session?.user?.role || '').toLowerCase() === 'admin') return new Set(ordered.map(item => String(item._id)));
        const unlocked = new Set();
        if (ordered.length) unlocked.add(String(ordered[0]._id));
        const progressRows = await models.LessonProgress.find({ username, courseId }).select('lessonId completed progressPercent').lean();
        const progress = new Map(progressRows.map(item => [String(item.lessonId), item]));
        for (let index = 1; index < ordered.length; index++) {
            const previous = ordered[index - 1];
            const previousId = String(previous._id);
            const required = await models.Assessment.find({ publicationStatus: 'PUBLISHED', $or: [{ lessonId: previous._id }, { 'metadata.lessonId': previousId }, { 'payload.lessonId': previousId }] }).select('_id passingScore').lean();
            if (required.length) {
                const attempts = await models.AssessmentAttempt.find({ username, assessmentId: { $in: required.map(item => item._id) }, status: 'SUBMITTED' }).select('assessmentId score result').lean();
                const passed = required.some(assessment => attempts.some(attempt => String(attempt.assessmentId) === String(assessment._id) && attempt.result?.requiresReview !== true && Number(attempt.result?.percentage ?? attempt.score ?? 0) >= Number(assessment.passingScore ?? 70)));
                if (!passed) break;
            } else if (!progress.get(previousId)?.completed) break;
            unlocked.add(String(ordered[index]._id));
        }
        return unlocked;
    }
    function safeLessonOutline(lesson, unlocked) {
        const payload = lesson.payload || {};
        const theorySections = Array.isArray(lesson.theorySections) ? lesson.theorySections : Array.isArray(payload.theorySections) ? payload.theorySections : [];
        const examples = Array.isArray(lesson.examples) ? lesson.examples : Array.isArray(payload.examples) ? payload.examples : [];
        const practice = payload.practiceTasks || lesson.practiceTasks || lesson.activities || [];
        return { _id: lesson._id, id: String(lesson._id), code: lesson.code, title: lesson.title, name: lesson.name, description: lesson.description || '', type: lesson.type, status: lesson.status, grade: lesson.grade, subjectId: lesson.subjectId, courseId: lesson.courseId || payload.courseId || null, lessonTestId: lesson.lessonTestId || payload.lessonTestId || payload.assessment?.assessmentCode || null, assessmentIds: lesson.assessmentIds || [], estimatedMinutes: lesson.estimatedMinutes || payload.estimatedMinutes || 45, theorySectionCount: theorySections.length || Number(payload.theorySectionCount || 0), exampleCount: examples.length || Number(payload.exampleCount || 0), practiceCount: Array.isArray(practice) ? practice.length : 0, questionCount: Number(lesson.questionCount || payload.questionCount || payload.assessment?.questionCount || lesson.assessment?.questionCount || 0), payload: { chapterTitle: payload.chapterTitle || 'Nội dung khóa học', chapterOrder: payload.chapterOrder || 1, lessonNo: payload.lessonNo || payload.order || 0, order: payload.order || payload.lessonNo || 0, estimatedMinutes: payload.estimatedMinutes || lesson.estimatedMinutes || 45 }, locked: !unlocked, ...(unlocked ? {} : { lockReason: 'Hoàn thành bài học trước và đạt bài kiểm tra để mở khóa bài tiếp theo.' }) };
    }
    function starterLessonOutline(lesson, unlocked) {
        return { id: lesson.id, _id: lesson._id || lesson.id, code: lesson.code, title: lesson.title, name: lesson.name || lesson.title, description: lesson.description || '', type: lesson.type || 'LESSON', status: lesson.status || 'PUBLISHED', grade: lesson.grade || null, subjectId: lesson.subjectId || '', courseId: lesson.courseId || '', lessonTestId: lesson.lessonTestId || null, assessmentIds: lesson.assessmentIds || [], estimatedMinutes: lesson.estimatedMinutes || lesson.payload?.estimatedMinutes || 45, theorySectionCount: Array.isArray(lesson.theorySections) ? lesson.theorySections.length : 0, exampleCount: Array.isArray(lesson.examples) ? lesson.examples.length : 0, practiceCount: Array.isArray(lesson.payload?.practiceTasks || lesson.practiceTasks) ? (lesson.payload?.practiceTasks || lesson.practiceTasks).length : 0, questionCount: Array.isArray(lesson.test?.questions) ? lesson.test.questions.length : Number(lesson.questionCount || 0), payload: { chapterTitle: lesson.payload?.chapterTitle || '', chapterOrder: lesson.payload?.chapterOrder || 1, lessonNo: lesson.payload?.lessonNo || 0, order: lesson.payload?.order || 0, estimatedMinutes: lesson.payload?.estimatedMinutes || lesson.estimatedMinutes || 45 }, locked: !unlocked, ...(unlocked ? {} : { lockReason: 'Hoàn thành bài học trước và đạt bài kiểm tra kiến thức để mở khóa bài tiếp theo.' }) };
    }
    function starterLessonLookup(code) {
        const match = String(code || '').trim().match(/^(.*)-L(\d{1,2})$/i);
        if (!match) return null;
        const starter = STARTER_COURSES.find(item => item.code === match[1]);
        if (!starter) return null;
        const detail = buildStarterCourseDetail(starter);
        const lesson = detail.lessons.find(item => String(item.id).toUpperCase() === String(code).toUpperCase());
        return lesson ? { starter, detail, lesson, index: detail.lessons.findIndex(item => String(item.id) === String(lesson.id)) } : null;
    }
    function publicStarterAssessment(assessment) {
        if (!assessment) return null;
        const { questions = [], ...meta } = assessment;
        return { ...meta, questionCount: questions.length };
    }
    function publicStarterLesson(lesson, unlocked) {
        if (!unlocked) return { id: lesson.id, _id: lesson._id, code: lesson.code, title: lesson.title, name: lesson.name, status: lesson.status, type: lesson.type, courseId: lesson.courseId, lessonTestId: lesson.lessonTestId, assessmentIds: lesson.assessmentIds, payload: { chapterTitle: lesson.payload?.chapterTitle, estimatedMinutes: lesson.estimatedMinutes || lesson.payload?.estimatedMinutes }, locked: true, lockReason: 'Hoàn thành bài học trước và đạt bài kiểm tra kiến thức để mở khóa bài tiếp theo.' };
        const { test, ...visible } = lesson;
        return { ...visible, ...(test ? { test: { title: test.title || `${lesson.title} · Kiểm tra`, passingScore: test.passingScore ?? 70, durationSeconds: test.durationSeconds || 900, questionCount: Array.isArray(test.questions) ? test.questions.length : 0, assessmentId: lesson.lessonTestId } } : {}), locked: false };
    }
    async function starterUnlockIndex(detail, req) {
        const username = req.session?.user?.username;
        if (!username) return -1;
        if (String(req.session?.user?.role || '').toLowerCase() === 'admin') return detail.lessons.length - 1;
        let lastUnlocked = detail.lessons.length ? 0 : -1;
        for (let index = 1; index < detail.lessons.length; index++) {
            const previous = detail.lessons[index - 1];
            let assessment = await models.Assessment.findOne({ code: previous.lessonTestId, publicationStatus: 'PUBLISHED' }).select('_id passingScore').lean();
            if (!assessment) {
                const fallback = starterAssessmentLookup(previous.lessonTestId);
                if (fallback) assessment = await persistStarterAssessment(fallback.starter, fallback.assessment);
                if (assessment) assessment = { _id: assessment._id, passingScore: assessment.passingScore };
            }
            if (!assessment) break;
            const attempts = await models.AssessmentAttempt.find({ username, assessmentId: assessment._id, status: 'SUBMITTED' }).select('score result').lean();
            const passed = attempts.some(attempt => attempt.result?.requiresReview !== true && Number(attempt.result?.percentage ?? attempt.score ?? 0) >= Number(assessment.passingScore ?? 70));
            if (!passed) break;
            lastUnlocked = index;
        }
        return lastUnlocked;
    }
    async function starterCourseForRequest(starter, req) {
        const detail = buildStarterCourseDetail(starter);
        const lastUnlocked = await starterUnlockIndex(detail, req);
        const lessons = detail.lessons.map((lesson, index) => starterLessonOutline(lesson, index <= lastUnlocked));
        const lessonMap = new Map(lessons.map(lesson => [String(lesson.id), lesson]));
        const chapters = detail.chapters.map(chapter => ({ ...chapter, lessons: chapter.lessons.map(lesson => lessonMap.get(String(lesson.id))).filter(Boolean), test: publicStarterAssessment(chapter.test) }));
        const assessments = detail.assessments.map(publicStarterAssessment);
        return { ...detail, lessons, chapters, chapterAssessments: (detail.chapterAssessments || []).map(publicStarterAssessment), assessments, finalAssessment: publicStarterAssessment(detail.finalAssessment), midtermAssessment: publicStarterAssessment(detail.midtermAssessment), mockAssessment: publicStarterAssessment(detail.mockAssessment), unlockPolicy: 'PASS_PREVIOUS_LESSON_TEST', progress: { lastUnlockedLesson: lastUnlocked >= 0 ? detail.lessons[lastUnlocked]?.id : null, unlockedCount: lastUnlocked + 1, totalLessons: detail.lessons.length } };
    }
    async function k12UnlockIndex(detail, req) {
        const username = req.session?.user?.username;
        const lessons = Array.isArray(detail?.lessons) ? detail.lessons : [];
        if (!username) return -1;
        if (['admin', 'super_admin', 'teacher', 'content_editor', 'exam_manager'].includes(String(req.session?.user?.role || '').toLowerCase())) return lessons.length - 1;
        let lastUnlocked = lessons.length ? 0 : -1;
        for (let index = 1; index < lessons.length; index++) {
            const previous = lessons[index - 1];
            const code = previous.assessment?.assessmentCode || previous.lessonTestId;
            if (!code) break;
            let assessment = await models.Assessment.findOne({ code, publicationStatus: 'PUBLISHED' }).select('_id passingScore').lean();
            if (!assessment) {
                const fallback = k12AssessmentLookup(code);
                if (fallback) assessment = await persistK12Assessment(fallback);
                if (assessment) assessment = { _id: assessment._id, passingScore: assessment.passingScore };
            }
            if (!assessment) break;
            const attempts = await models.AssessmentAttempt.find({ username, assessmentId: assessment._id, status: 'SUBMITTED' }).select('score result').lean();
            if (!attempts.some(attempt => attempt.result?.requiresReview !== true && Number(attempt.result?.percentage ?? attempt.score ?? 0) >= Number(assessment.passingScore ?? 70))) break;
            lastUnlocked = index;
        }
        return lastUnlocked;
    }
    async function k12CourseForRequest(detail, req) {
        const lastUnlocked = await k12UnlockIndex(detail, req);
        const lessonMap = new Map();
        const lessons = detail.lessons.map((lesson, index) => {
            const outline = { id: lesson.id, _id: lesson.id, code: lesson.id, title: lesson.title, name: lesson.title, description: lesson.description || '', type: 'LESSON', status: 'PUBLISHED', grade: lesson.grade, subjectId: lesson.subjectId, courseId: lesson.courseId, lessonTestId: lesson.assessment?.assessmentCode || null, estimatedMinutes: lesson.estimatedMinutes || 45, theorySectionCount: Array.isArray(lesson.theorySections) ? lesson.theorySections.length : 0, exampleCount: Array.isArray(lesson.examples) ? lesson.examples.length : 0, practiceCount: Array.isArray(lesson.practiceTasks) ? lesson.practiceTasks.length : 0, questionCount: Number(lesson.questionCount || lesson.assessment?.questionCount || 0), payload: { chapterTitle: lesson.unitTitle || lesson.unit || '', chapterOrder: Number(lesson.unitOrder || 1), lessonNo: lesson.legacyId || index + 1, order: lesson.legacyId || index + 1, estimatedMinutes: lesson.estimatedMinutes || 45 }, locked: index > lastUnlocked, ...(index > lastUnlocked ? { lockReason: 'Hoàn thành bài học trước và đạt bài kiểm tra để mở khóa bài tiếp theo.' } : {}) };
            lessonMap.set(String(lesson.id), outline);
            return outline;
        });
        const chapters = (detail.chapters || []).map(chapter => ({ order: chapter.order, title: chapter.title, description: chapter.description || '', lessons: (chapter.lessons || []).map(lesson => lessonMap.get(String(lesson.id))).filter(Boolean), test: publicStarterAssessment(chapter.test) }));
        const units = (detail.units || []).map(unit => ({ ...unit, lessons: (unit.lessons || []).map(lesson => lessonMap.get(String(lesson.id))).filter(Boolean) }));
        return { course: detail.course, program: detail.program, units, chapters, lessons, assessments: (detail.assessments || []).map(publicStarterAssessment), midtermAssessment: publicStarterAssessment(detail.midtermAssessment), finalAssessment: publicStarterAssessment(detail.finalAssessment), mockAssessment: publicStarterAssessment(detail.mockAssessment), catalogMeta: detail.catalogMeta, unlockPolicy: 'PASS_PREVIOUS_LESSON_TEST', progress: { lastUnlockedLesson: lastUnlocked >= 0 ? detail.lessons[lastUnlocked]?.id : null, unlockedCount: lastUnlocked + 1, totalLessons: detail.lessons.length }, source: 'legacy-curriculum-adapter' };
    }
    function answersEqual(actual, expected) {
        if (actual === undefined || expected === undefined) return false;
        if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
            if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
            const left = Object.entries(actual).map(([key, value]) => [String(key), String(value).trim().toLowerCase()]).sort(([a], [b]) => a.localeCompare(b));
            const right = Object.entries(expected).map(([key, value]) => [String(key), String(value).trim().toLowerCase()]).sort(([a], [b]) => a.localeCompare(b));
            return left.length === right.length && left.every(([key, value], index) => key === right[index][0] && value === right[index][1]);
        }
        if (Array.isArray(expected)) {
            const left = (Array.isArray(actual) ? actual : [actual]).map(value => String(value).trim().toLowerCase()).sort();
            const right = expected.map(value => String(value).trim().toLowerCase()).sort();
            return left.length === right.length && left.every((value, index) => value === right[index]);
        }
        if (typeof expected === 'boolean') return String(actual).toLowerCase() === String(expected);
        if (typeof expected === 'number') return Number.isFinite(Number(actual)) && Number(actual) === expected;
        return String(actual).trim().replace(/\s+/g, ' ').toLowerCase() === String(expected).trim().replace(/\s+/g, ' ').toLowerCase();
    }
    async function resolveEducationReferences(result = {}) {
        const escape = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        async function findReference(modelName, id, name, extra = {}) {
            const Model = models[modelName];
            if (!Model) return null;
            const base = { status: { $nin: ['ARCHIVED', 'DELETED'] }, ...extra };
            if (isObjectId(id)) {
                const byId = await Model.findOne({ ...base, _id: new mongoose.Types.ObjectId(String(id)) }).lean();
                if (byId) return byId;
            }
            const label = cleanText(name, 180);
            if (!label) return null;
            const field = modelName === 'TrainingProgram' ? 'programName' : 'name';
            return Model.findOne({ ...base, [field]: new RegExp(`^${escape(label)}$`, 'i') }).lean();
        }
        const university = await findReference('University', result.universityId, result.university || result.institution);
        const universityId = university?._id || null;
        const faculty = await findReference('Faculty', result.facultyId, result.faculty, universityId ? { universityId } : {});
        const field = await findReference('Field', result.fieldId, result.field);
        const fieldId = field?._id || null;
        const disciplineGroup = await findReference('DisciplineGroup', result.disciplineGroupId, result.disciplineGroup, fieldId ? { fieldId } : {});
        const disciplineGroupId = disciplineGroup?._id || null;
        const major = await findReference('Major', result.majorId, result.major, disciplineGroupId ? { disciplineGroupId } : {});
        const majorId = major?._id || null;
        const specialization = await findReference('Specialization', result.specializationId, result.specialization, majorId ? { majorId } : {});
        const specializationId = specialization?._id || null;
        const trainingProgram = await findReference('TrainingProgram', result.trainingProgramId, result.trainingProgram, { ...(universityId ? { institutionId: universityId } : {}), ...(majorId ? { majorId } : {}), ...(specializationId ? { specializationId } : {}) });
        const ids = Object.fromEntries(Object.entries({ universityId, facultyId: faculty?._id || null, fieldId, disciplineGroupId, majorId, specializationId, trainingProgramId: trainingProgram?._id || null }).filter(([, value]) => value));
        const names = {
            universityName: university?.name || '', facultyName: faculty?.name || '', fieldName: field?.name || '',
            disciplineGroupName: disciplineGroup?.name || '', majorName: major?.name || '',
            specializationName: specialization?.name || '', trainingProgramName: trainingProgram?.programName || ''
        };
        return { ids, names };
    }

    async function attachCatalogLinks(plan, education = {}) {
        const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9+#.]+/g, ' ').trim();
        const aliasMap = [
            { test: /(^|\s)(toan|math|mathematics)(\s|$)/, subjectIds: ['MATH', 'MATHEMATICS'] },
            { test: /(^|\s)(ngu van|van hoc|literature)(\s|$)/, subjectIds: ['LITERATURE', 'NGU_VAN', 'VIETNAMESE'] },
            { test: /(^|\s)(tieng anh|english)(\s|$)/, subjectIds: ['ENGLISH', 'TIENG_ANH'], targetExam: null },
            { test: /(^|\s)(tin hoc|lap trinh|programming|debug code|thuat toan|dsa|cntt|python|java|c\+\+|sql)(\s|$)/, tracks: ['UNIVERSITY_IT'], subjectIds: ['IT', 'PROGRAMMING', 'CS', 'DSA'] },
            { test: /(^|\s)(toeic)(\s|$)/, tracks: ['ENGLISH'], targetExam: 'TOEIC' },
            { test: /(^|\s)(ielts)(\s|$)/, tracks: ['ENGLISH'], targetExam: 'IELTS' },
            { test: /(^|\s)(mos|excel|word|powerpoint)(\s|$)/, tracks: ['MOS'] },
            { test: /(^|\s)(kinh te|kinh doanh|quan tri|marketing|tai chinh|ke toan|logistics)(\s|$)/, tracks: ['UNIVERSITY_ECONOMICS'] },
            { test: /(^|\s)(co dien tu|tu dong hoa|robot|co khi|dien tu)(\s|$)/, tracks: ['UNIVERSITY_MECHATRONICS', 'UNIVERSITY_ENGINEERING'] }
        ];
        for (const subject of plan.subjects || []) {
            const direct = String(subject.subjectId || subject.skill || '').trim();
            const normalized = normalize(direct);
            const aliases = aliasMap.filter(item => item.test.test(normalized));
            const queryClauses = [];
            if (direct) {
                const escaped = direct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                queryClauses.push({ subjectId: direct }, { code: direct }, { name: new RegExp(escaped, 'i') }, { 'syllabus.skills': new RegExp(escaped, 'i') });
            }
            for (const alias of aliases) {
                if (alias.subjectIds?.length) queryClauses.push({ subjectId: { $in: alias.subjectIds } });
                if (alias.tracks?.length) queryClauses.push({ 'syllabus.track': { $in: alias.tracks } });
                if (alias.targetExam) queryClauses.push({ 'syllabus.targetExam': alias.targetExam });
                if (alias.tracks?.includes('MOS')) queryClauses.push({ 'syllabus.track': 'MOS' });
            }
            let course = null;
            if (queryClauses.length) {
                const base = { status: { $in: ['ACTIVE', 'PUBLISHED'] } };
                const contexts = [];
                if (education.majorId && isObjectId(education.majorId)) contexts.push({ majorId: new mongoose.Types.ObjectId(String(education.majorId)) });
                if (education.trainingProgramId && isObjectId(education.trainingProgramId)) contexts.push({ trainingProgramId: new mongoose.Types.ObjectId(String(education.trainingProgramId)) });
                if (education.grade && Number(education.grade) >= 1 && Number(education.grade) <= 12) contexts.push({ grade: Number(education.grade) });
                const directQuery = { ...base, $or: queryClauses };
                if (contexts.length) {
                    course = await models.Course.find({ $and: [directQuery, { $or: contexts }] }).sort({ contentCompleteness: -1, createdAt: -1 }).lean();
                    course = course[0] || null;
                }
                if (!course) course = await models.Course.findOne(directQuery).sort({ contentCompleteness: -1, createdAt: -1 }).lean();
            }
            if (course) {
                const persisted = await inspectMaterializedCourse(models, course, Number(course.syllabus?.lessonCount) || 12);
                if (!persisted.ready) course = null;
            }
            if (course) {
                const lesson = await models.CurriculumContent.findOne({ courseId: course._id, type: 'LESSON', status: 'PUBLISHED' }).sort({ createdAt: 1 }).lean();
                const assessments = await models.Assessment.find({ $or: [{ courseId: course._id }, ...(lesson ? [{ lessonId: lesson._id }] : [])], publicationStatus: 'PUBLISHED' }).sort({ createdAt: 1 }).lean();
                subject.courseId = course._id;
                subject.courseCode = course.code;
                subject.courseName = course.name;
                subject.lessonId = lesson?._id || null;
                subject.lessonTitle = lesson?.title || '';
                subject.assessmentId = assessments[0]?._id || null;
                subject.prerequisites = (course.prerequisiteCourses || []).map(value => String(value));
                subject.courseGap = false;
                subject.reason = subject.currentScore === null || subject.currentScore === undefined ? 'Khóa học được khớp theo môn/kỹ năng và ngữ cảnh học tập; cần placement hoặc bài kiểm tra xác nhận mức độ.' : `Khóa học được khớp từ catalog theo bằng chứng kỹ năng ${subject.currentScore}%.`;
            } else {
                subject.courseId = null;
                subject.courseCode = '';
                subject.courseName = '';
                subject.lessonId = null;
                subject.lessonTitle = '';
                subject.assessmentId = null;
                subject.prerequisites = [];
                subject.courseGap = true;
                subject.reason = 'Catalog chưa có khóa học được khớp đủ tin cậy cho kỹ năng này. Ghi nhận COURSE_GAP thay vì tạo liên kết giả.';
            }
        }
        for (const recommendation of plan.recommendations || []) {
            const subject = (plan.subjects || []).find(item => item.subjectId === recommendation.subjectId);
            if (subject) Object.assign(recommendation, { courseId: subject.courseId || null, courseName: subject.courseName || '', lessonId: subject.lessonId || null, lessonTitle: subject.lessonTitle || '', assessmentId: subject.assessmentId || null, courseGap: Boolean(subject.courseGap), prerequisites: subject.prerequisites || [], estimatedMinutes: subject.estimatedMinutes, currentLevel: subject.currentLevel, targetLevel: subject.targetLevel, gap: subject.gap, priority: subject.priority });
        }
        return plan;
    }

    function courseGapKey(subject) { return String(subject?.subjectId || subject?.skill || subject?.title || subject?.subjectName || '').trim().toLowerCase(); }
    function mayProvisionGap(subject, now = Date.now()) {
        if (subject?.courseProvisionStatus !== 'FAILED') return true;
        const lastAttempt = new Date(subject.courseProvisionLastAttemptAt || 0).getTime();
        return Number.isFinite(lastAttempt) && now - lastAttempt >= 30 * 60 * 1000;
    }
    async function provisionPlanCourseGaps(username, plan, education = {}, options = {}) {
        if (!plan || !Array.isArray(plan.subjects)) return plan;
        let changed = false;
        const excluded = options.excludeSubjectKeys instanceof Set ? options.excludeSubjectKeys : new Set();
        const limit = Math.max(1, Math.min(8, Number(options.limit) || 2));
        const selected = plan.subjects.filter(item => item.courseGap && !excluded.has(courseGapKey(item)) && mayProvisionGap(item)).slice(0, limit);
        for (const subject of selected) {
            try {
                const focus = cleanText(subject.title || subject.skill || subject.subjectName || subject.subjectId || 'Kỹ năng cần củng cố', 180);
                const result = await withCourseProvisionLock(username, focus, () => ensurePersonalCourse({ models, username, request: { courseTitle: focus, prompt: `Tạo khóa học về ${focus}. Phù hợp với độ tuổi, cấp học, mục tiêu và các điểm yếu đã ghi nhận. Mỗi bài có mục tiêu, lý thuyết chia thành mục nhỏ, bài giảng, ví dụ giải từng bước, luyện tập có hướng dẫn, bài độc lập, vận dụng thực tế, bài kiểm tra riêng chủ đề và rubric phản hồi.`, domain: focus, grade: Number(education.grade || plan.currentGrade || 0) || undefined, educationLevel: education.educationLevel || plan.educationStage || '', subjectId: subject.subjectId || '', targetExam: plan.target?.targetExam || '', targetVariant: plan.target?.targetVariant || '', forceCreate: true, generateAudio: false } }));
                if (!result.courseId || !result.course) {
                    subject.courseProvisionStatus = 'FAILED';
                    subject.courseProvisionLastAttemptAt = new Date();
                    subject.courseProvisionAttempts = Number(subject.courseProvisionAttempts || 0) + 1;
                    subject.courseProvisionMessage = 'Chưa thể tạo khóa học tự động. Hệ thống sẽ thử lại sau.';
                    changed = true;
                    continue;
                }
                const persisted = await inspectMaterializedCourse(models, result.course, 12);
                if (!persisted.ready || !persisted.lessons.length) {
                    subject.courseId = null; subject.courseCode = ''; subject.courseName = ''; subject.lessonId = null; subject.lessonTitle = ''; subject.assessmentId = null; subject.courseGap = true;
                    subject.courseProvisionStatus = 'FAILED';
                    subject.courseProvisionLastAttemptAt = new Date();
                    subject.courseProvisionAttempts = Number(subject.courseProvisionAttempts || 0) + 1;
                    subject.courseProvisionMessage = 'Khóa học chưa vượt qua kiểm tra tính đầy đủ sau khi lưu. Hệ thống sẽ thử lại sau.';
                    subject.reason = `Khóa học được tạo nhưng chưa qua kiểm tra nội dung đã lưu (${(persisted.missing || ['lesson_missing']).join(', ')}). Hệ thống chưa gắn liên kết để tránh lộ trình giả.`;
                    changed = true;
                    continue;
                }
                const lesson = persisted.lessons[0];
                Object.assign(subject, { courseId: result.courseId, courseCode: result.course.code || '', courseName: result.course.name || focus, lessonId: lesson?._id || null, lessonTitle: lesson?.title || '', assessmentId: persisted.assessments.find(item => String(item.lessonId || '') === String(lesson._id))?._id || null, courseGap: false, courseSource: 'PERSONAL_AI', courseProvisionStatus: 'READY', courseProvisionLastAttemptAt: new Date(), courseProvisionMessage: '', reason: `Đã xác minh khóa học và ${persisted.lessonCount} bài học được lưu cùng bài kiểm tra bài học, kiểm tra chương, giữa kỳ, cuối kỳ và thi thử.` });
                changed = true;
            } catch (error) {
                subject.courseProvisionStatus = 'FAILED';
                subject.courseProvisionLastAttemptAt = new Date();
                subject.courseProvisionAttempts = Number(subject.courseProvisionAttempts || 0) + 1;
                subject.courseProvisionMessage = 'Có lỗi khi tạo khóa học tự động. Hệ thống sẽ thử lại sau.';
                subject.reason = `Chưa thể hoàn tất khóa học cho ${cleanText(subject.title || subject.skill || subject.subjectId || 'kỹ năng này', 120)}; vẫn giữ COURSE_GAP để không tạo liên kết giả.`;
                changed = true;
                console.warn(`Không tự tạo được khóa cho gap ${subject.subjectId || subject.skill || ''}:`, error.message);
            }
        }
        if (changed) {
            for (const recommendation of plan.recommendations || []) {
                const subject = plan.subjects.find(item => item.subjectId && item.subjectId === recommendation.subjectId || item.skill && item.skill === recommendation.skill || item.title && item.title === recommendation.title);
                if (subject) Object.assign(recommendation, { courseId: subject.courseId || null, courseCode: subject.courseCode || '', courseName: subject.courseName || '', lessonId: subject.lessonId || null, lessonTitle: subject.lessonTitle || '', courseGap: Boolean(subject.courseGap), courseSource: subject.courseSource || '', courseProvisionStatus: subject.courseProvisionStatus || '', courseProvisionMessage: subject.courseProvisionMessage || '', reason: subject.reason || recommendation.reason });
            }
            if (plan._id) await models.LearningPlan.updateOne({ _id: plan._id, username, status: 'ACTIVE' }, { $set: { subjects: plan.subjects, recommendations: plan.recommendations || [] } });
        }
        return plan;
    }

    function schedulePlanCourseGapProvisioning(username, plan, education = {}, options = {}) {
        if (!plan?._id || !Array.isArray(plan.subjects) || !plan.subjects.some(item => item.courseGap && mayProvisionGap(item))) return Promise.resolve(plan);
        const jobKey = `${username}:${String(plan._id)}`;
        if (planCourseProvisionJobs.has(jobKey)) return planCourseProvisionJobs.get(jobKey);
        const maxPerRun = Math.max(1, Math.min(8, Number(options.limit) || 8));
        const job = (async () => {
            let currentPlan = plan;
            const attempted = new Set();
            for (let count = 0; count < maxPerRun; count++) {
                const candidate = (currentPlan.subjects || []).find(item => item.courseGap && !attempted.has(courseGapKey(item)) && mayProvisionGap(item));
                if (!candidate) break;
                await provisionPlanCourseGaps(username, currentPlan, education, { limit: 1, excludeSubjectKeys: attempted });
                attempted.add(courseGapKey(candidate));
                const latest = await models.LearningPlan.findOne({ _id: plan._id, username, status: 'ACTIVE' }).lean();
                if (!latest) break;
                currentPlan = latest;
            }
            return currentPlan;
        })().finally(() => planCourseProvisionJobs.delete(jobKey));
        planCourseProvisionJobs.set(jobKey, job);
        return job;
    }

    async function syncAssessmentLearningPath({ username, assessment, result }) {
        const fallbackSkill = assessment.subjectId || assessment.code || 'GENERAL';
        const skillEvidence = buildAssessmentSkillEvidence(result.details || [], fallbackSkill);
        const [learningProfile, education, previous] = await Promise.all([
            models.LearningProfile.findOne({ username }).lean(),
            models.EducationProfile.findOne({ username }).lean(),
            models.LearningPlan.findOne({ username }).sort({ version: -1 }).lean()
        ]);
        const examText = [assessment.targetExam, assessment.syllabus?.targetExam, assessment.title, assessment.code, assessment.subjectId].filter(Boolean).join(' ');
        const exam = /IELTS/i.test(examText) ? 'IELTS' : /TOEIC/i.test(examText) ? 'TOEIC' : '';
        const reviewEvidence = Object.fromEntries((result.details || []).filter(item => item?.requiresReview || item?.gradingStatus === 'REVIEW_REQUIRED' || item?.gradingStatus === 'PARTIALLY_SCORED').map(item => [String(item.skill || fallbackSkill), { reviewRequired: true, status: item.gradingStatus || 'REVIEW_REQUIRED', questionType: item.type || '' }]));
        let englishProfile = null;
        const englishProfiles = { ...(learningProfile?.diagnostics?.englishProfiles || {}) };
        if (exam) {
            englishProfile = buildEnglishSkillProfile(exam, skillEvidence.scores, { ...skillEvidence.evidence, ...reviewEvidence });
            englishProfiles[exam] = { ...englishProfile, assessmentId: String(assessment._id), updatedAt: new Date() };
            const coreScores = Object.values(englishProfile.skillProfile);
            await models.EnglishAssessment.create({ username, exam, variant: assessment.assessmentType || 'ASSESSMENT_RESULT', skillScores: { ...englishProfile.skillProfile, ...skillEvidence.scores }, overallEstimate: coreScores.length ? Number((coreScores.reduce((sum, score) => sum + score, 0) / coreScores.length).toFixed(2)) : null, scoreEvidence: { method: 'assessment_result', assessmentId: String(assessment._id), officialScore: false, skillEvidence: { ...skillEvidence.evidence, ...reviewEvidence }, ...englishProfile }, assessmentVersion: assessment.version || '1' });
        }
        if (!Object.keys(skillEvidence.scores).length) {
            if (exam) await models.LearningProfile.updateOne({ username }, { $set: { [`diagnostics.englishProfiles.${exam}`]: englishProfiles[exam], lastAssessmentId: assessment._id }, $setOnInsert: { username } }, { upsert: true });
            return { updated: false, reason: 'NO_AUTO_SCORED_SKILLS', englishProfile: englishProfile || undefined };
        }
        for (const [skill, score] of Object.entries(skillEvidence.scores)) {
            const existing = await models.SkillMastery.findOne({ username, skill }).lean();
            const attempts = Number(existing?.attempts || 0) + 1;
            const average = existing && Number.isFinite(Number(existing.accuracy)) ? Number(((Number(existing.accuracy) * Math.max(1, Number(existing.attempts || 1)) + score) / attempts).toFixed(2)) : score;
            const status = average >= 80 ? 'MASTERED' : average < 60 ? 'REVIEW_REQUIRED' : 'LEARNING';
            const reviewDays = average >= 80 ? 14 : average < 40 ? 1 : average < 60 ? 3 : 7;
            await models.SkillMastery.findOneAndUpdate({ username, skill }, { $set: { username, skill, subjectId: assessment.subjectId || '', courseId: assessment.courseId || null, accuracy: average, averageScore: average, recentScore: score, attempts, lastAttempt: new Date(), status, reviewDueAt: new Date(Date.now() + reviewDays * 86400000) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        }
        const priorScores = learningProfile?.diagnostics?.scores && typeof learningProfile.diagnostics.scores === 'object' ? learningProfile.diagnostics.scores : {};
        const scores = { ...priorScores, ...skillEvidence.scores };
        const survey = learningProfile?.survey || {};
        const plan = buildPersonalLearningPlan({ username, educationStage: education?.educationLevel || education?.educationStatus || survey.educationLevel || '', currentGrade: education?.grade || survey.currentGrade || assessment.grade || null, survey, goals: learningProfile?.goals || survey.goals || [], subjectStrengths: survey.strengths || [], subjectWeaknesses: survey.weaknesses || [], placement: { scores, weakSkills: Object.entries(scores).filter(([, score]) => Number(score) < 60).map(([skill]) => skill) }, target: { name: assessment.title, courseId: assessment.courseId || null, lessonId: assessment.lessonId || null, assessmentType: assessment.assessmentType || 'ASSESSMENT' }, version: Number(previous?.version || 0) + 1 });
        await attachCatalogLinks(plan, education || {});
        plan.diagnostics = { ...plan.diagnostics, sourceAssessmentId: String(assessment._id), sourceAssessmentCode: assessment.code, assessmentType: assessment.assessmentType, skillEvidence: skillEvidence.evidence, scores, updatedAt: new Date() };
        await models.LearningPlan.updateMany({ username, status: 'ACTIVE' }, { $set: { status: 'ARCHIVED' } });
        const savedPlan = await models.LearningPlan.create(plan);
        await models.LearningProfile.updateOne({ username }, { $set: { learningPlanId: savedPlan._id, diagnostics: { ...(learningProfile?.diagnostics || {}), ...(exam ? { englishProfiles } : {}), assessmentAttemptUpdatedAt: new Date(), lastAssessmentId: assessment._id, scores, skillEvidence: { ...(learningProfile?.diagnostics?.skillEvidence || {}), ...skillEvidence.evidence } } }, $setOnInsert: { username } }, { upsert: true });
        setImmediate(() => schedulePlanCourseGapProvisioning(username, savedPlan.toObject ? savedPlan.toObject() : savedPlan, education || {}).catch(error => console.warn(`Không tự provision khóa học sau bài kiểm tra của ${username}:`, error.message)));
        return { updated: true, learningPlanId: savedPlan._id, version: savedPlan.version, scores, englishProfile: englishProfile || undefined };
    }

    function starterAssessmentLookup(code) {
        const normalized = String(code || '').trim();
        const match = normalized.match(/^(.*)-(L\d{2}-TEST|C\d+-TEST|MIDTERM|FINAL|MOCK)$/);
        if (!match) return null;
        const starter = STARTER_COURSES.find(item => item.code === match[1]);
        if (!starter) return null;
        const detail = buildStarterCourseDetail(starter);
        const assessment = (detail.assessments || []).find(item => item.code === normalized || item.id === normalized);
        return assessment ? { starter, assessment } : null;
    }
    async function persistStarterAssessment(starter, assessment) {
        const existing = await models.Assessment.findOne({ code: assessment.code, publicationStatus: 'PUBLISHED' });
        if (existing) return existing.toObject ? existing.toObject() : existing;
        const course = await models.Course.findOne({ code: starter.code, status: 'ACTIVE' }, { _id: 1, curriculumVersionId: 1 }).lean();
        const sourceRef = { sourceType: 'ORIGINAL_PRACTICE', documentName: 'Hành Trình Mới Full Learning Content Catalog', version: '20.0.0', verification: 'unverified', notes: 'Assessment fallback được materialize từ catalog V20 khi MongoDB chưa hydrate đủ nội dung.' };
        const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
        const questionIds = [];
        for (let index = 0; index < questions.length; index += 1) {
            const question = questions[index];
            const code = `${assessment.code}-Q${index + 1}`;
            const item = await models.Question.findOneAndUpdate({ code }, { $set: { curriculumVersionId: course?.curriculumVersionId || null, courseId: course?._id || null, subjectId: starter.subjectId || '', educationLevel: starter.educationLevel, type: question.type || 'single_choice', prompt: String(question.prompt || '').slice(0, 2000), options: Array.isArray(question.options) ? question.options.map(normalizeQuestionOption) : [], answer: question.answer, explanation: String(question.explanation || '').slice(0, 3000), points: Number(question.points || 1), difficulty: question.difficulty || 'MEDIUM', skill: question.skill || starter.skills?.[index % Math.max(1, starter.skills.length)] || starter.name, status: 'PUBLISHED', source: sourceRef }, $setOnInsert: { code } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
            questionIds.push(item._id);
        }
        const lessonId = mongoose.Types.ObjectId.isValid(String(assessment.lessonId || '')) ? assessment.lessonId : null;
        const doc = await models.Assessment.findOneAndUpdate({ code: assessment.code }, { $set: { title: assessment.title, assessmentType: assessment.assessmentType || 'FINAL', educationLevel: starter.educationLevel, grade: starter.grade || null, curriculumVersionId: course?.curriculumVersionId || null, subjectId: starter.subjectId || '', courseId: course?._id || null, lessonId, sections: [{ code: assessment.assessmentType || 'TEST', title: assessment.title, questionIds }], questionIds, questionPool: questionIds, durationSeconds: assessment.durationSeconds || 1800, attemptLimit: assessment.attemptLimit || 3, passingScore: assessment.passingScore ?? 70, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'objective_percentage', maxScore: 100 }, reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true }, version: '20.0.0', publicationStatus: 'PUBLISHED', sourceRef }, $setOnInsert: { code: assessment.code } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        return doc;
    }

    function normalizeQuestionOption(option) {
        if (option && typeof option === 'object') {
            const label = option.label ?? option.text ?? option.value ?? option.id ?? '';
            const value = option.value ?? option.id ?? option.label ?? option.text ?? label;
            return { label: String(label), value };
        }
        return { label: String(option ?? ''), value: option ?? '' };
    }
    function sanitizeAssessmentQuestion(question) {
        const safe = { ...question };
        const type = String(safe.type || '').toLowerCase();
        if (!safe.media || typeof safe.media !== 'object') safe.media = {};
        if (type === 'matching') {
            const pairs = Array.isArray(safe.options) ? safe.options.filter(option => option && typeof option === 'object' && option.left !== undefined && option.right !== undefined) : [];
            if (pairs.length) {
                safe.options = pairs.map(option => ({ label: String(option.left), value: String(option.value ?? option.left) }));
                safe.media = { ...safe.media, matchingOptions: [...new Set(pairs.map(option => String(option.right)))] };
            } else if (safe.answer && typeof safe.answer === 'object' && !Array.isArray(safe.answer)) {
                const mapping = safe.answer;
                safe.options = Object.keys(mapping).map(key => ({ label: String(key), value: String(key) }));
                safe.media = { ...safe.media, matchingOptions: [...new Set(Object.values(mapping).map(value => String(value)))] };
            } else if (Array.isArray(safe.acceptedAnswers?.[0]) && safe.acceptedAnswers[0][0] && typeof safe.acceptedAnswers[0][0] === 'object') {
                const mapping = safe.acceptedAnswers[0];
                safe.options = mapping.map(option => ({ label: String(option.left ?? option.label ?? ''), value: String(option.left ?? option.label ?? '') }));
                safe.media = { ...safe.media, matchingOptions: [...new Set(mapping.map(option => String(option.right ?? option.answer ?? '')))] };
            }
        }
        delete safe.answer;
        delete safe.acceptedAnswers;
        delete safe.rubric;
        const media = { ...safe.media };
        if (media.transcript) delete media.transcript;
        if (media.coding && typeof media.coding === 'object') media.coding = { ...media.coding, hiddenTestCases: [] };
        else if (Array.isArray(media.hiddenTestCases)) media.hiddenTestCases = [];
        safe.media = media;
        return safe;
    }
    function k12AssessmentLookup(code) {
        const normalized = String(code || '').trim();
        const match = normalized.match(/^k12-assessment-(1[0-2]|[1-9])-([a-z0-9_]+)-(lesson-(\d+)|unit-(\d+)|(midterm|final|mock))$/i);
        if (!match) return null;
        const kind = match[3].toLowerCase();
        return { code: normalized, grade: Number(match[1]), subjectId: match[2], scope: kind.startsWith('lesson-') ? 'LESSON' : kind.startsWith('unit-') ? 'UNIT' : kind.toUpperCase(), lessonNo: kind.startsWith('lesson-') ? Number(match[4]) : null, unitNo: kind.startsWith('unit-') ? Number(match[5]) : null };
    }
    async function persistK12Assessment(fallback) {
        const existing = await models.Assessment.findOne({ code: fallback.code, publicationStatus: 'PUBLISHED' });
        if (existing) return existing.toObject ? existing.toObject() : existing;
        const courseDetail = buildK12CourseDetail(`k12-g${fallback.grade}-${fallback.subjectId}`);
        if (!courseDetail?.lessons?.length) return null;
        const subject = courseDetail.catalogMeta?.subject || {};
        const subjectName = subject.name || fallback.subjectId;
        const allQuestions = courseDetail.lessons.flatMap((lesson, index) => buildK12Questions({ grade: fallback.grade, subjectId: fallback.subjectId, subjectName, topic: lesson.topic || lesson.title, index, count: 12, source: 'ORIGINAL_PRACTICE' }).map(question => ({ ...question, lessonNo: Number(lesson.legacyId || index + 1), lessonId: lesson.id })));
        let questions;
        let assessmentType;
        let title;
        let durationSeconds;
        let attemptLimit;
        if (fallback.scope === 'LESSON') {
            questions = allQuestions.filter(item => Number(item.lessonNo) === Number(fallback.lessonNo)).slice(0, 12);
            const lesson = courseDetail.lessons.find(item => Number(item.legacyId) === Number(fallback.lessonNo));
            assessmentType = 'LESSON_TEST'; title = `Kiểm tra bài ${fallback.lessonNo}: ${lesson?.title || subjectName}`; durationSeconds = 20 * 60; attemptLimit = 5;
        } else if (fallback.scope === 'UNIT') {
            const unit = courseDetail.chapters?.[Math.max(0, Number(fallback.unitNo) - 1)];
            const unitLessonNos = new Set((unit?.lessons || []).map(item => Number(item.legacyId)));
            questions = allQuestions.filter(item => unitLessonNos.has(Number(item.lessonNo))).slice(0, 24);
            assessmentType = 'CHAPTER_TEST'; title = `Kiểm tra chủ đề ${fallback.unitNo}: ${unit?.title || subjectName}`; durationSeconds = 30 * 60; attemptLimit = 3;
        } else if (fallback.scope === 'MIDTERM') {
            questions = allQuestions.filter((_, index) => index % 2 === 0).slice(0, 60);
            assessmentType = 'MIDTERM'; title = `Kiểm tra giữa kỳ · ${subjectName}`; durationSeconds = 60 * 60; attemptLimit = 2;
        } else if (fallback.scope === 'FINAL') {
            questions = allQuestions.slice(0, 100);
            assessmentType = 'FINAL'; title = `Kiểm tra cuối khóa · ${subjectName}`; durationSeconds = 90 * 60; attemptLimit = 2;
        } else {
            questions = allQuestions.filter((_, index) => index % 3 === 0).slice(0, 80);
            assessmentType = 'MOCK'; title = `Mock Test · ${subjectName}`; durationSeconds = 75 * 60; attemptLimit = 10;
        }
        if (!questions.length) return null;
        const questionIds = [];
        for (let index = 0; index < questions.length; index += 1) {
            const question = questions[index];
            const code = `${fallback.code}-Q${index + 1}`;
            const lesson = courseDetail.lessons.find(item => Number(item.legacyId) === Number(question.lessonNo));
            const doc = await models.Question.findOneAndUpdate({ code }, { $set: { grade: fallback.grade, educationLevel: lesson?.educationLevel || courseDetail.course.educationLevel, subjectId: fallback.subjectId, type: question.type, prompt: String(question.prompt || '').slice(0, 2500), options: Array.isArray(question.options) ? question.options.map(normalizeQuestionOption) : [], answer: question.answer, acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [], rubric: question.rubric || {}, explanation: String(question.explanation || '').slice(0, 4000), points: Number(question.points || 1), difficulty: question.difficulty || 'MEDIUM', cognitiveLevel: question.cognitiveLevel || 'APPLY', skill: String(question.skill || lesson?.title || subjectName).slice(0, 240), tags: question.tags || [fallback.subjectId, `G${fallback.grade}`, assessmentType], media: question.media || {}, lessonId: null, status: 'PUBLISHED', source: { sourceType: 'ORIGINAL_PRACTICE', organization: 'Hành Trình Mới', documentName: 'K12 Curriculum Adapter', version: '20.0.0', verification: 'unverified', notes: 'Assessment materialized from original K12 practice content.' } }, $setOnInsert: { code } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
            questionIds.push(doc._id);
        }
        const sourceRef = { sourceType: 'ORIGINAL_PRACTICE', organization: 'Hành Trình Mới', documentName: 'K12 Curriculum Adapter', version: '20.0.0', verification: 'unverified', notes: 'Bài kiểm tra nguyên bản bám mạch chương trình tham chiếu; không phải đề thi official.' };
        return models.Assessment.findOneAndUpdate({ code: fallback.code }, { $set: { title, assessmentType, educationLevel: courseDetail.course.educationLevel, grade: fallback.grade, subjectId: fallback.subjectId, sections: [{ code: assessmentType, title, questionIds }], questionIds, questionPool: questionIds, durationSeconds, attemptLimit, passingScore: 70, randomization: { enabled: true, mode: 'question', avoidImmediateRepeat: true }, scoring: { method: 'mixed_percentage', maxScore: 100, manualReviewTypes: ['essay','practical','timed_simulation'] }, reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true }, version: '20.0.0', publicationStatus: 'PUBLISHED', sourceRef }, $setOnInsert: { code: fallback.code } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    }

    router.get('/education/legacy-catalog', (req, res, next) => {
        try {
            const grade = Number(req.query.grade);
            if (!Number.isInteger(grade) || grade < 1 || grade > 12) return fail(res, 400, 'INVALID_GRADE', 'Lớp phải nằm trong khoảng 1–12.');
            return ok(res, getCatalog(grade), 'Catalog lấy từ curriculum adapter legacy.');
        } catch (e) { return next(e); }
    });

    router.get('/education/curriculum-versions', async (req, res, next) => { try { return ok(res, await repositories.CurriculumVersion.list({ status: req.query.status || 'ACTIVE' }, parsePage(req))); } catch (e) { return next(e); } });
    router.get('/education/curriculum-versions/:id', async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã curriculum không hợp lệ.'); const item = await repositories.CurriculumVersion.getById(req.params.id); if (!item || (item.status !== 'ACTIVE' && req.query.includeArchived !== 'true')) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy curriculum version công bố.'); return ok(res, item); } catch (e) { return next(e); } });
    router.post('/education/curriculum-versions', guarded('learning.curriculum.manage'), async (req, res, next) => { try { const body = req.body || {}; if (!body.code || !body.version || !body.educationLevel) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu code, version hoặc educationLevel.'); const item = await repositories.CurriculumVersion.create({ ...body, sourceRef: body.sourceRef || { verification: 'unverified' } }); await audit(req, 'CREATE', 'CurriculumVersion', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo curriculum version.' }); } catch (e) { return next(e); } });
    router.post('/education/curriculum-content', guarded('learning.lesson.create'), async (req, res, next) => { try { const body = req.body || {}; if (!body.curriculumVersionId || !body.type || !body.code || !body.title) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu curriculumVersionId, type, code hoặc title.'); const item = await repositories.CurriculumContent.create(body); await audit(req, 'CREATE', 'CurriculumContent', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo nội dung curriculum.' }); } catch (e) { return next(e); } });
    router.get('/education/curriculum-content', async (req, res, next) => { try { const filter = { status: req.query.status || 'PUBLISHED' }; if (req.query.curriculumVersionId && isObjectId(req.query.curriculumVersionId)) filter.curriculumVersionId = req.query.curriculumVersionId; if (req.query.type) filter.type = cleanText(req.query.type, 30); if (req.query.grade) filter.grade = Number(req.query.grade); return ok(res, await repositories.CurriculumContent.list(filter, parsePage(req))); } catch (e) { return next(e); } });
    router.get('/education/courses', async (req, res, next) => {
        try {
            const filter = { status: req.query.status || 'ACTIVE' };
            if (req.query.grade) filter.grade = Number(req.query.grade);
            if (req.query.subjectId) filter.subjectId = cleanText(req.query.subjectId, 80);
            if (req.query.educationLevel) filter.educationLevel = cleanText(req.query.educationLevel, 50);
            const track = String(req.query.track || 'K12').toUpperCase();
            if (track === 'UNIVERSITY_IT' || track === 'CNTT') filter['syllabus.track'] = 'UNIVERSITY_IT'; else if (track === 'UNIVERSITY') filter['syllabus.track'] = { $in: ['UNIVERSITY_IT', 'UNIVERSITY_ECONOMICS', 'UNIVERSITY_MECHATRONICS', 'UNIVERSITY_ENGINEERING', 'UNIVERSITY_APPLIED_SCIENCES'] };
            else if (track === 'TOEIC') filter['syllabus.targetExam'] = 'TOEIC';
            else if (track === 'IELTS') filter['syllabus.targetExam'] = 'IELTS';
            else if (track === 'ENGLISH') filter['syllabus.track'] = 'ENGLISH';
            else if (track === 'MOS') filter['syllabus.track'] = 'MOS';
            const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
            const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit || '100', 10) || 100));
            const isK12 = track === 'K12';
            const queryLimit = req.query.search && !isK12 ? Math.max(limit * 5, 300) : limit;
            const result = await repositories.Course.list(filter, { page: isK12 ? page : 1, limit: isK12 ? limit : queryLimit });
            let dbItems = Array.isArray(result?.items) ? result.items : [];
            if (!isK12) {
                if (track === 'UNIVERSITY') {
                    const starterByCode = new Map(STARTER_COURSES.filter(item => String(item.track || '').startsWith('UNIVERSITY_')).map(item => [item.code, item]));
                    const merged = new Map();
                    for (const item of dbItems) {
                        const starter = starterByCode.get(item.code) || {};
                        const academic = starter.academicDomainCode ? { educationStage: starter.educationStage, educationStageName: starter.educationStageName, degreeLevel: starter.degreeLevel, academicDomainCode: starter.academicDomainCode, academicDomainName: starter.academicDomainName, facultyCode: starter.facultyCode, facultyName: starter.facultyName, fieldCode: starter.fieldCode, fieldName: starter.fieldName, disciplineGroupCode: starter.disciplineGroupCode, disciplineGroupName: starter.disciplineGroupName, majorCodes: starter.majorCodes, isOfficialUniversityCurriculum: false, curriculumScope: 'GENERAL_SKILL_CATALOG' } : item.syllabus?.academic;
                        merged.set(String(item.code || item._id), { ...starter, ...item, id: String(item._id || item.id || item.code), academicDomainCode: item.academicDomainCode || academic?.academicDomainCode, academicDomainName: item.academicDomainName || academic?.academicDomainName, facultyName: item.facultyName || academic?.facultyName, fieldName: item.fieldName || academic?.fieldName, disciplineGroupName: item.disciplineGroupName || academic?.disciplineGroupName, majorCodes: item.majorCodes || academic?.majorCodes || item.syllabus?.majorTracks || [], syllabus: { ...(starter.syllabus || {}), ...(item.syllabus || {}), academic: item.syllabus?.academic || academic }, lessonCount: item.syllabus?.lessonCount || starter.lessonTitles?.length || item.lessonCount || 0, source: 'database-catalog' });
                    }
                    for (const item of starterByCode.values()) if (!merged.has(item.code)) merged.set(item.code, { ...item, id: item.code, lessonCount: item.lessonTitles?.length || 0, source: 'starter-catalog-memory' });
                    let allUniversityItems = [...merged.values()];
                    if (req.query.search) { const query = String(req.query.search).toLowerCase(); allUniversityItems = allUniversityItems.filter(item => JSON.stringify(item).toLowerCase().includes(query)); }
                    if (req.query.domainCode) allUniversityItems = allUniversityItems.filter(item => String(item.academicDomainCode || item.syllabus?.academic?.academicDomainCode || '').toUpperCase() === String(req.query.domainCode).toUpperCase());
                    const start = (page - 1) * limit;
                    return ok(res, { items: allUniversityItems.slice(start, start + limit), total: allUniversityItems.length, page, limit, source: 'university-domain-catalog', track, educationStage: 'HIGHER_EDUCATION', educationStageName: 'Đại học', domains: require('../services/university-taxonomy').UNIVERSITY_DOMAINS.map(domain => ({ code: domain.code, name: domain.name })) });
                }
                if (req.query.search) { const query = String(req.query.search).toLowerCase(); dbItems = dbItems.filter(item => JSON.stringify(item).toLowerCase().includes(query)); }
                if (!dbItems.length) {
                    const starterItems = STARTER_COURSES
                        .filter(item => {
                            if (track === 'UNIVERSITY_IT' || track === 'CNTT') return item.track === 'UNIVERSITY_IT'; if (track === 'UNIVERSITY') return String(item.track || '').startsWith('UNIVERSITY_');
                            if (track === 'TOEIC') return item.targetExam === 'TOEIC';
                            if (track === 'IELTS') return item.targetExam === 'IELTS';
                            if (track === 'ENGLISH') return item.track === 'ENGLISH';
                            return item.track === 'MOS';
                        })
                        .filter(item => !req.query.search || JSON.stringify(item).toLowerCase().includes(String(req.query.search).toLowerCase()))
                        .map(item => ({ ...item, id: item.code, source: 'starter-catalog-memory', lessonCount: item.lessonTitles.length }));
                    const start = (page - 1) * limit;
                    return ok(res, { items: starterItems.slice(start, start + limit), total: starterItems.length, page, limit, source: 'starter-catalog-memory', track, fallbackAvailable: true });
                }
                const start = (page - 1) * limit;
                return ok(res, { items: dbItems.slice(start, start + limit), total: dbItems.length, page, limit, source: 'database-catalog', track });
            }
            const legacyItems = buildK12Courses({ grade: req.query.grade, educationLevel: req.query.educationLevel, subjectId: req.query.subjectId, search: req.query.search });
            const byCode = new Map();
            for (const item of dbItems) {
                const grade = Number(item.grade ?? item.syllabus?.grade ?? 0) || null;
                const subjectId = item.subjectId || item.syllabus?.subjectId || '';
                const catalog = grade && subjectId ? buildK12Courses({ grade, subjectId }) : [];
                const enriched = { ...item, id: String(item._id), grade, subjectId, educationLevel: item.educationLevel || (grade ? (grade <= 5 ? 'PRIMARY' : grade <= 9 ? 'SECONDARY_LOWER' : 'SECONDARY_UPPER') : ''), subjectName: catalog[0]?.subjectName || subjectId, lessonCount: item.syllabus?.lessonCount ?? catalog[0]?.lessonCount ?? null, chapterCount: Array.isArray(item.syllabus?.chapters) ? item.syllabus.chapters.length : null, chapterAssessments: item.syllabus?.chapterAssessments || [], finalAssessmentId: item.syllabus?.finalAssessmentId || null, unitMap: catalog[0]?.unitMap || [], sourceRef: item.sourceRef || catalog[0]?.sourceRef || K12_SOURCE_REF, sourceLabel: catalog[0]?.sourceLabel || 'Nội dung có nguồn trong platform registry.' };
                byCode.set(enriched.code, enriched);
            }
            for (const item of legacyItems) if (!byCode.has(item.code)) byCode.set(item.code, item);
            let merged = [...byCode.values()];
            if (req.query.search) { const query = String(req.query.search).toLowerCase(); merged = merged.filter(item => JSON.stringify(item).toLowerCase().includes(query)); }
            if (req.query.grade) merged = merged.filter(item => Number(item.grade) === Number(req.query.grade));
            if (req.query.educationLevel) merged = merged.filter(item => item.educationLevel === req.query.educationLevel);
            if (req.query.subjectId) merged = merged.filter(item => item.subjectId === req.query.subjectId);
            merged.sort((a, b) => Number(a.grade || 99) - Number(b.grade || 99) || String(a.subjectName || a.name).localeCompare(String(b.subjectName || b.name), 'vi'));
            const start = (page - 1) * limit;
            return ok(res, { items: merged.slice(start, start + limit), total: merged.length, page, limit, source: dbItems.length ? 'database+legacy-adapter' : 'legacy-curriculum-adapter', fallbackAvailable: true });
        } catch (e) { return next(e); }
    });
    router.get('/education/courses/:id', async (req, res, next) => {
        try {
            if (isObjectId(req.params.id)) {
                const course = await models.Course.findOne({ _id: req.params.id, status: 'ACTIVE' }).lean();
                if (!course) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy khóa học.');
                const lessonFilter = { $or: [{ courseId: course._id }, { 'payload.courseId': course._id }], type: 'LESSON', status: 'PUBLISHED' }; if (course.curriculumVersionId) lessonFilter.curriculumVersionId = course.curriculumVersionId; const lessons = await models.CurriculumContent.find(lessonFilter).sort({ createdAt: 1 }).lean();
                const assessmentFilter = { courseId: course._id, publicationStatus: 'PUBLISHED' }; if (course.curriculumVersionId) assessmentFilter.curriculumVersionId = course.curriculumVersionId; const assessments = await models.Assessment.find(assessmentFilter, { answer: 0 }).sort({ createdAt: 1 }).lean();
                const unlocked = await unlockedLessons(lessons, req, String(course._id));
                const visibleLessons = lessons.map(lesson => safeLessonOutline(lesson, unlocked.has(String(lesson._id))));
                const chapterMap = new Map();
                for (const lesson of visibleLessons) {
                    const chapterTitle = String(lesson?.payload?.chapterTitle || 'Nội dung khóa học');
                    if (!chapterMap.has(chapterTitle)) chapterMap.set(chapterTitle, { title: chapterTitle, lessons: [] });
                    chapterMap.get(chapterTitle).lessons.push(lesson);
                }
                const syllabus = course.syllabus || {};
                if (lessons.length < 12 && course.code) { const starter = STARTER_COURSES.find(item => item.code === String(course.code)); if (starter) return ok(res, await starterCourseForRequest(starter, req), 'Khóa học dùng starter catalog đầy đủ và áp dụng mở khóa theo lượt kiểm tra.'); }
                const chapters = Array.isArray(syllabus.chapters) && syllabus.chapters.length
                    ? syllabus.chapters.map((chapter, index) => ({ order: chapter.order || index + 1, title: chapter.title, lessons: chapterMap.get(chapter.title)?.lessons || [] }))
                    : [...chapterMap.values()].map((chapter, index) => ({ order: index + 1, title: chapter.title, lessons: chapter.lessons }));
                const finalAssessmentId = syllabus.finalAssessmentId || null;
                return ok(res, { course: { ...course, id: String(course._id), grade: course.grade ?? course.syllabus?.grade ?? null, subjectId: course.subjectId || course.syllabus?.subjectId || '', chapterCount: chapters.length, lessonCount: lessons.length }, lessons: visibleLessons, chapters, chapterAssessments: syllabus.chapterAssessments || [], midtermAssessment: syllabus.midtermAssessmentId ? assessments.find(item => String(item._id) === String(syllabus.midtermAssessmentId)) || null : null, finalAssessment: finalAssessmentId ? assessments.find(item => String(item._id) === String(finalAssessmentId)) || null : null, mockAssessment: syllabus.mockAssessmentId ? assessments.find(item => String(item._id) === String(syllabus.mockAssessmentId)) || null : null, assessments, unlockPolicy: 'PASS_PREVIOUS_ASSESSMENT_OR_COMPLETE_PREVIOUS_LESSON', source: 'database' });
            }
            const code = String(req.params.id || '').trim();
            const byCode = code ? await models.Course.findOne({ code, status: 'ACTIVE' }).lean() : null;
            if (byCode) {
                const lessonFilter = { courseId: byCode._id, type: 'LESSON', status: 'PUBLISHED' }; if (byCode.curriculumVersionId) lessonFilter.curriculumVersionId = byCode.curriculumVersionId; const lessons = await models.CurriculumContent.find(lessonFilter).sort({ createdAt: 1 }).lean();
                const assessmentFilter = { courseId: byCode._id, publicationStatus: 'PUBLISHED' }; if (byCode.curriculumVersionId) assessmentFilter.curriculumVersionId = byCode.curriculumVersionId; const assessments = await models.Assessment.find(assessmentFilter, { answer: 0 }).sort({ createdAt: 1 }).lean();
                const unlocked = await unlockedLessons(lessons, req, String(byCode._id));
                const visibleLessons = lessons.map(lesson => safeLessonOutline(lesson, unlocked.has(String(lesson._id))));
                const chapterMap = new Map();
                for (const lesson of visibleLessons) { const title = String(lesson?.payload?.chapterTitle || 'Nội dung khóa học'); if (!chapterMap.has(title)) chapterMap.set(title, { title, lessons: [] }); chapterMap.get(title).lessons.push(lesson); }
                const chapters = [...chapterMap.values()].map((chapter, index) => ({ order: index + 1, ...chapter }));
                if (lessons.length < 12) {
                    const starter = STARTER_COURSES.find(item => item.code === code);
                    if (starter) return ok(res, await starterCourseForRequest(starter, req), 'Khóa học dùng starter catalog đầy đủ và áp dụng mở khóa theo lượt kiểm tra.');
                }
                return ok(res, { course: { ...byCode, id: String(byCode._id), lessonCount: lessons.length }, lessons: visibleLessons, chapters, chapterAssessments: byCode.syllabus?.chapterAssessments || [], midtermAssessment: byCode.syllabus?.midtermAssessmentId ? assessments.find(item => String(item._id) === String(byCode.syllabus.midtermAssessmentId)) || null : null, finalAssessment: byCode.syllabus?.finalAssessmentId ? assessments.find(item => String(item._id) === String(byCode.syllabus.finalAssessmentId)) || null : null, mockAssessment: byCode.syllabus?.mockAssessmentId ? assessments.find(item => String(item._id) === String(byCode.syllabus.mockAssessmentId)) || null : null, assessments, unlockPolicy: 'PASS_PREVIOUS_ASSESSMENT_OR_COMPLETE_PREVIOUS_LESSON', source: 'database-by-code' }, 'Khóa học được lấy từ catalog đã lưu trong MongoDB.');
            }
            const starter = STARTER_COURSES.find(item => item.code === code);
            if (starter) return ok(res, await starterCourseForRequest(starter, req), 'Khóa học được hiển thị từ starter catalog với tiến độ mở khóa tuần tự.');
            const fallback = buildK12CourseDetail(req.params.id);
            if (!fallback) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy khóa học.');
            return ok(res, await k12CourseForRequest(fallback, req), 'Khóa học hiển thị theo danh sách bài học; nội dung chỉ tải khi bài đã mở khóa.');
        } catch (e) { return next(e); }
    });
    router.get('/education/lessons/:id', requireAuth, async (req, res, next) => {
        try {
            const starterLookup = starterLessonLookup(req.params.id);
            if (starterLookup) {
                const lastUnlocked = await starterUnlockIndex(starterLookup.detail, req);
                if (starterLookup.index > lastUnlocked) return fail(res, 423, 'LESSON_LOCKED', 'Bài học đang khóa. Hãy hoàn thành và đạt bài kiểm tra của bài trước để mở khóa.');
                const lesson = publicStarterLesson(starterLookup.lesson, true);
                const questionSource = Array.isArray(starterLookup.lesson.test?.questions) ? starterLookup.lesson.test.questions : [];
                const questions = questionSource.map((question, index) => sanitizeAssessmentQuestion({ ...question, _id: question._id || question.id || `${starterLookup.lesson.lessonTestId}-Q${index + 1}` }));
                return ok(res, { lesson, questions, navigation: { previousLessonId: starterLookup.index > 0 ? starterLookup.detail.lessons[starterLookup.index - 1].id : null, nextLessonId: starterLookup.index + 1 < starterLookup.detail.lessons.length ? starterLookup.detail.lessons[starterLookup.index + 1].id : null }, source: 'starter-catalog-v29' });
            }
            if (isObjectId(req.params.id)) {
                const lesson = await models.CurriculumContent.findOne({ _id: req.params.id, type: 'LESSON', status: 'PUBLISHED' }).lean();
                if (!lesson) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bài học.');
                const courseId = String(lesson.courseId || lesson.payload?.courseId || '');
                if (courseId) {
                    const sameCourseFilter = lesson.courseId ? { courseId: lesson.courseId, type: 'LESSON', status: 'PUBLISHED' } : { 'payload.courseId': lesson.payload?.courseId, type: 'LESSON', status: 'PUBLISHED' }; const sameCourse = await models.CurriculumContent.find(sameCourseFilter).sort({ createdAt: 1 }).lean();
                    const unlocked = await unlockedLessons(sameCourse, req, courseId);
                    if (!unlocked.has(String(lesson._id))) return fail(res, 423, 'LESSON_LOCKED', 'Bài học đang khóa. Hãy hoàn thành bài trước và đạt bài kiểm tra để tiếp tục.');
                }
                const questions = await models.Question.find({ lessonId: lesson._id, status: 'PUBLISHED' }, { answer: 0, acceptedAnswers: 0, rubric: 0 }).limit(20).lean();
                const allLessons = courseId ? await models.CurriculumContent.find(lesson.courseId ? { courseId: lesson.courseId, type: 'LESSON', status: 'PUBLISHED' } : { 'payload.courseId': lesson.payload?.courseId, type: 'LESSON', status: 'PUBLISHED' }).sort({ createdAt: 1 }).lean() : [];
                const currentIndex = allLessons.findIndex(item => String(item._id) === String(lesson._id));
                const nextLesson = currentIndex >= 0 ? allLessons[currentIndex + 1] : null;
                return ok(res, { lesson, questions, navigation: { previousLessonId: null, nextLessonId: nextLesson?._id || null }, source: 'database' });
            }
            const lessonByCode = await models.CurriculumContent.findOne({ code: String(req.params.id || '').trim(), type: 'LESSON', status: 'PUBLISHED' }).lean();
            if (lessonByCode) {
                const courseId = String(lessonByCode.courseId || lessonByCode.payload?.courseId || '');
                if (courseId) {
                    const sameCourseFilter = lessonByCode.courseId ? { courseId: lessonByCode.courseId, type: 'LESSON', status: 'PUBLISHED' } : { 'payload.courseId': lessonByCode.payload?.courseId, type: 'LESSON', status: 'PUBLISHED' }; const sameCourse = await models.CurriculumContent.find(sameCourseFilter).sort({ createdAt: 1 }).lean();
                    const unlocked = await unlockedLessons(sameCourse, req, courseId);
                    if (!unlocked.has(String(lessonByCode._id))) return fail(res, 423, 'LESSON_LOCKED', 'Bài học đang khóa. Hãy hoàn thành bài trước và đạt bài kiểm tra để tiếp tục.');
                }
                const questions = await models.Question.find({ lessonId: lessonByCode._id, status: 'PUBLISHED' }, { answer: 0, acceptedAnswers: 0, rubric: 0 }).limit(20).lean();
                return ok(res, { lesson: lessonByCode, questions, navigation: { previousLessonId: null, nextLessonId: null }, source: 'database-by-code' });
            }
            const fallback = buildK12LessonDetail(req.params.id);
            if (!fallback) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bài học.');
            const detail = buildK12CourseDetail(fallback.lesson.courseId);
            if (detail) {
                const index = detail.lessons.findIndex(item => String(item.id) === String(fallback.lesson.id));
                const lastUnlocked = await k12UnlockIndex(detail, req);
                if (index > lastUnlocked) return fail(res, 423, 'LESSON_LOCKED', 'Bài học đang khóa. Hãy hoàn thành bài trước và đạt bài kiểm tra để tiếp tục.');
            }
            return ok(res, { ...fallback, source: 'legacy-curriculum-adapter' }, 'Bài học được tải riêng sau khi xác nhận quyền mở khóa.');
        } catch (e) { return next(e); }
    });
    router.get('/ai/status', requireAuth, async (req, res) => ok(res, { configured: isGeminiConfigured(), model: getGeminiModel(), provider: 'Google Gemini API', note: isGeminiConfigured() ? 'Gemini đang được cấu hình ở backend.' : 'Chưa cấu hình GEMINI_API_KEY trên server.' }));
    router.post('/ai/lesson-help', requireAuth, aiRateLimit || ((req, res, next) => next()), async (req, res, next) => {
        try {
            const body = req.body || {};
            if (!isGeminiConfigured()) return fail(res, 503, 'AI_NOT_CONFIGURED', 'Chưa cấu hình GEMINI_API_KEY trên server Render.');
            const grade = Number(body.grade);
            if (!Number.isInteger(grade) || grade < 1 || grade > 12) return fail(res, 400, 'INVALID_GRADE', 'Lớp phải nằm trong khoảng 1–12.');
            const result = await generateLessonHelp({ grade, subject: cleanText(body.subject, 100), topic: cleanText(body.topic, 200), question: cleanText(body.question, 2000), lessonContent: body.lessonContent });
            return ok(res, result, 'Gemini đã tạo phần giải thích hỗ trợ học tập.');
        } catch (e) { return next(e); }
    });
    // New namespace aliases keep the established education routes as the compatibility layer.
    router.get('/learning/catalog', (req, res, next) => { req.url = `/education/courses${req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''}`; return router.handle(req, res, next); });
    router.get('/learning/courses', (req, res, next) => { req.url = `/education/courses${req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''}`; return router.handle(req, res, next); });
    router.get('/learning/courses/:id', (req, res, next) => { req.url = `/education/courses/${encodeURIComponent(req.params.id)}`; return router.handle(req, res, next); });
    router.get('/learning/lessons/:id', (req, res, next) => { req.url = `/education/lessons/${encodeURIComponent(req.params.id)}`; return router.handle(req, res, next); });
    router.get('/learning/assessments', (req, res, next) => { req.url = `/assessment/assessments${req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''}`; return router.handle(req, res, next); });
    router.get('/education/profile', requireAuth, async (req, res, next) => {
        try {
            const username = req.session.user.username;
            const [storedProfile, education, learning, account] = await Promise.all([
                models.Profile.findOne({ username }).lean(),
                models.EducationProfile.findOne({ username }).lean(),
                models.LearningProfile.findOne({ username }).lean(),
                legacyUserModel.findOne({ username }).select('fullName dob age').lean()
            ]);
            const profile = storedProfile || (account ? { username, fullName: account.fullName || '', dob: account.dob || null, age: calculateAge(account.dob) } : null);
            if (profile && profile.age === undefined) profile.age = calculateAge(profile.dob);
            return ok(res, { profile, education, learning });
        } catch (e) { return next(e); }
    });
    function lessonProgressSteps(lesson = {}) {
        const steps = [];
        const sections = Array.isArray(lesson.theorySections) ? lesson.theorySections : [];
        sections.forEach((section, index) => { if (cleanText(section?.content || '', 8000).trim()) steps.push({ id: `theory-${index}`, label: cleanText(section.title || `Phần kiến thức ${index + 1}`, 120) }); });
        if (!steps.some(step => step.id.startsWith('theory-')) && cleanText(lesson.theory || lesson.description || '', 8000).trim()) steps.push({ id: 'theory', label: 'Đọc và hiểu lý thuyết chính' });
        if ((lesson.examples || []).length) steps.push({ id: 'examples', label: 'Xem ví dụ có hướng dẫn' });
        const tasks = lesson.payload?.practiceTasks || lesson.practiceTasks || lesson.activities || [];
        if (Array.isArray(tasks) && tasks.length) steps.push({ id: 'practice', label: 'Hoàn thành luyện tập' });
        const practical = lesson.payload?.practical || lesson.practical || {};
        if (practical.task || practical.instructions || lesson.programming || (lesson.codingTasks || []).length) steps.push({ id: 'practical', label: 'Hoàn thành thực hành / lab' });
        if ((lesson.payload?.quickChecks || lesson.quickChecks || []).length) steps.push({ id: 'quick-check', label: 'Tự kiểm tra kiến thức' });
        const assessmentIds = [lesson.lessonTestId, ...(lesson.assessmentIds || [])].filter(value => value && isObjectId(value)).map(String);
        if (assessmentIds.length) steps.push({ id: 'assessment', label: 'Làm bài kiểm tra bài học', assessmentIds });
        return steps;
    }
    const assignmentAttachmentTypes = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.zip': 'application/zip', '.cpp': 'text/plain; charset=utf-8', '.h': 'text/plain; charset=utf-8', '.hpp': 'text/plain; charset=utf-8', '.c': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8', '.java': 'text/plain; charset=utf-8', '.js': 'text/plain; charset=utf-8', '.ts': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.sql': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
    router.post('/learning/assignments/attachment', requireAuth, express.raw({ type: 'application/octet-stream', limit: '3mb' }), async (req, res, next) => {
        try {
            if (!models.AssignmentAttachment) return fail(res, 503, 'ATTACHMENT_UNAVAILABLE', 'Kho tệp nộp bài chưa sẵn sàng.');
            if (!Buffer.isBuffer(req.body) || req.body.length < 1 || req.body.length > 3 * 1024 * 1024) return fail(res, 400, 'ATTACHMENT_SIZE_INVALID', 'Tệp phải có dung lượng từ 1 byte đến 3 MB.');
            const inputName = cleanText(req.query.filename, 240).replace(/[\r\n\\/]/g, '_');
            const filename = inputName.split(/[\/]/).pop().replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-180) || 'bai-nop.bin';
            const extension = (filename.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(assignmentAttachmentTypes, extension)) return fail(res, 415, 'ATTACHMENT_TYPE_UNSUPPORTED', 'Định dạng chưa hỗ trợ. Cho phép PDF, Word, Excel, PowerPoint, TXT/CSV, ảnh, ZIP và tệp mã nguồn phổ biến.');
            const attachment = await models.AssignmentAttachment.create({ username: req.session.user.username, filename, extension, contentType: assignmentAttachmentTypes[extension], size: req.body.length, data: req.body, submissionId: '', deleteAfter: new Date(Date.now() + 86400000) });
            return res.status(201).json({ success: true, data: { id: String(attachment._id), filename: attachment.filename, size: attachment.size }, message: 'Đã tải tệp tạm lên. Tệp sẽ được gắn vào bài nộp khi bạn gửi bài.' });
        } catch (error) { return next(error); }
    });
    router.post('/learning/assignments/submit', requireAuth, async (req, res, next) => {
        try {
            const username = req.session.user.username;
            const body = req.body || {};
            const lessonId = cleanText(body.lessonId, 120);
            const taskTitle = cleanText(body.taskTitle, 240);
            const submissionText = String(body.submissionText || '').trim();
            const submissionUrl = cleanText(body.submissionUrl, 2048);
            const attachmentId = cleanText(body.attachmentId, 120);
            if (!lessonId || !taskTitle || submissionText.length > 20000 || (submissionText.length > 0 && submissionText.length < 10 && !attachmentId && !submissionUrl) || (submissionText.length < 10 && !attachmentId && !submissionUrl)) return fail(res, 400, 'ASSIGNMENT_INVALID', 'Hãy nộp lời giải tối thiểu 10 ký tự, một liên kết sản phẩm hoặc một tệp đính kèm.');
            if (submissionUrl && !/^https?:\/\//i.test(submissionUrl)) return fail(res, 400, 'ASSIGNMENT_URL_INVALID', 'Liên kết sản phẩm phải bắt đầu bằng http:// hoặc https://.');
            if (attachmentId && !isObjectId(attachmentId)) return fail(res, 400, 'ATTACHMENT_ID_INVALID', 'Mã tệp đính kèm không hợp lệ.');
            const isAdmin = ['admin', 'super_admin', 'teacher', 'content_editor', 'exam_manager'].includes(String(req.session.user.role || '').toLowerCase());
            let lesson = null;
            if (isObjectId(lessonId)) lesson = await models.CurriculumContent.findOne({ _id: lessonId, type: 'LESSON', status: 'PUBLISHED' }).lean();
            else lesson = await models.CurriculumContent.findOne({ code: lessonId, type: 'LESSON', status: 'PUBLISHED' }).lean();
            if (lesson) {
                const courseId = String(lesson.courseId || lesson.payload?.courseId || body.courseId || '');
                const sameCourseFilter = lesson.courseId ? { courseId: lesson.courseId } : { 'payload.courseId': lesson.payload?.courseId || body.courseId || '__no_course__' };
                const sameCourse = await models.CurriculumContent.find({ ...sameCourseFilter, type: 'LESSON', status: 'PUBLISHED' }).sort({ createdAt: 1 }).lean();
                const unlocked = await unlockedLessons(sameCourse, req, courseId);
                if (!isAdmin && !unlocked.has(String(lesson._id))) return fail(res, 423, 'LESSON_LOCKED', 'Bạn cần hoàn thành bài học trước và đạt bài kiểm tra để nộp bài cho phần này.');
            } else {
                const starterMatch = starterLessonLookup(lessonId);
                if (starterMatch) {
                    const lastUnlocked = await starterUnlockIndex(starterMatch.detail, req);
                    if (!isAdmin && starterMatch.index > lastUnlocked) return fail(res, 423, 'LESSON_LOCKED', 'Bạn cần mở khóa bài học này trước khi nộp bài.');
                } else {
                    const k12Match = buildK12LessonDetail(lessonId);
                    if (!k12Match) return fail(res, 404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học đã công bố để nhận bài nộp.');
                    const k12Detail = buildK12CourseDetail(k12Match.lesson.courseId);
                    const index = k12Detail?.lessons?.findIndex(item => String(item.id) === String(lessonId)) ?? -1;
                    const lastUnlocked = k12Detail ? await k12UnlockIndex(k12Detail, req) : -1;
                    if (!isAdmin && (index < 0 || index > lastUnlocked)) return fail(res, 423, 'LESSON_LOCKED', 'Bạn cần mở khóa bài học này trước khi nộp bài.');
                    lesson = k12Match.lesson;
                }
            }
            let reservedAttachment = null;
            let attachmentReservation = '';
            if (attachmentId) {
                if (!models.AssignmentAttachment) return fail(res, 503, 'ATTACHMENT_UNAVAILABLE', 'Kho tệp nộp bài chưa sẵn sàng.');
                attachmentReservation = `RESERVED:${crypto.randomBytes(12).toString('hex')}`;
                reservedAttachment = await models.AssignmentAttachment.findOneAndUpdate({ _id: attachmentId, username, submissionId: '' }, { $set: { submissionId: attachmentReservation } }, { new: true }).select('_id filename').lean();
                if (!reservedAttachment) return fail(res, 409, 'ATTACHMENT_ALREADY_USED', 'Tệp không tồn tại, đã hết hạn hoặc đã được gắn vào bài nộp khác. Hãy tải tệp lại.');
            }
            let created;
            try {
                created = await models.AssignmentSubmission.create({ username, courseId: cleanText(body.courseId, 120), courseCode: cleanText(body.courseCode, 120), lessonId, taskTitle, taskIndex: Math.max(0, Math.min(500, Number(body.taskIndex) || 0)), submissionText, submissionUrl, attachmentId: reservedAttachment?._id || null, attachmentFileName: reservedAttachment?.filename || '', status: 'SUBMITTED' });
                if (reservedAttachment) await models.AssignmentAttachment.updateOne({ _id: reservedAttachment._id, username, submissionId: attachmentReservation }, { $set: { submissionId: String(created._id) }, $unset: { deleteAfter: 1 } });
            } catch (error) {
                if (reservedAttachment) await models.AssignmentAttachment.updateOne({ _id: reservedAttachment._id, username, submissionId: attachmentReservation }, { $set: { submissionId: '', deleteAfter: new Date(Date.now() + 86400000) } }).catch(() => {});
                throw error;
            }
            if (models.LearningEvent) await models.LearningEvent.create({ username, eventType: 'PRACTICE_SUBMITTED', entityType: 'AssignmentSubmission', entityId: String(created._id), source: 'LEARNER_SUBMITTED', occurredAt: new Date(), metadata: { courseCode: created.courseCode, lessonCode: lesson?.code || lessonId, attemptStatus: 'SUBMITTED', reason: taskTitle } }).catch(() => {});
            return res.status(201).json({ success: true, data: { id: String(created._id), taskTitle: created.taskTitle, status: created.status, submittedAt: created.submittedAt }, message: 'Đã nhận bài làm. Bài đang chờ giáo viên/Admin chấm điểm.' });
        } catch (error) { return next(error); }
    });
    router.get('/learning/assignments/my-submissions', requireAuth, async (req, res, next) => {
        try {
            const filter = { username: req.session.user.username };
            if (req.query.lessonId) filter.lessonId = cleanText(req.query.lessonId, 120);
            const submissions = await models.AssignmentSubmission.find(filter).select('courseCode lessonId taskTitle taskIndex status score feedback reviewerUsername submittedAt gradedAt submissionUrl attachmentId attachmentFileName').sort({ submittedAt: -1 }).limit(50).lean();
            return ok(res, submissions);
        } catch (error) { return next(error); }
    });
    router.get('/admin/assignments/submissions', guarded('learning.lesson.read'), async (req, res, next) => {
        try {
            const filter = {};
            const status = String(req.query.status || 'SUBMITTED').toUpperCase();
            if (['SUBMITTED', 'GRADED', 'RETURNED'].includes(status)) filter.status = status;
            const submissions = await models.AssignmentSubmission.find(filter).sort({ submittedAt: 1 }).limit(Math.max(1, Math.min(100, Number(req.query.limit) || 50))).lean();
            return ok(res, submissions);
        } catch (error) { return next(error); }
    });
    router.get('/admin/assignments/submissions/:id/attachment', guarded('learning.lesson.read'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã bài nộp không hợp lệ.');
            const submission = await models.AssignmentSubmission.findById(req.params.id).select('username attachmentId attachmentFileName').lean();
            if (!submission?.attachmentId || !models.AssignmentAttachment) return fail(res, 404, 'ATTACHMENT_NOT_FOUND', 'Bài nộp không có tệp đính kèm.');
            const attachment = await models.AssignmentAttachment.findOne({ _id: submission.attachmentId, username: submission.username, submissionId: String(submission._id) }).lean();
            if (!attachment || !Buffer.isBuffer(attachment.data) && !attachment.data) return fail(res, 404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy nội dung tệp.');
            const filename = String(attachment.filename || submission.attachmentFileName || 'bai-nop.bin').replace(/[\r\n";]/g, '_');
            const body = Buffer.isBuffer(attachment.data) ? attachment.data : Buffer.from(attachment.data?.buffer || attachment.data);
            res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
            res.setHeader('Content-Length', String(body.length));
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            return res.status(200).send(body);
        } catch (error) { return next(error); }
    });
    router.post('/admin/assignments/submissions/:id/grade', guarded('learning.lesson.update'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã bài nộp không hợp lệ.');
            const score = Number(req.body?.score);
            const feedback = cleanText(req.body?.feedback, 5000);
            if (!Number.isFinite(score) || score < 0 || score > 100 || !feedback) return fail(res, 400, 'GRADE_INVALID', 'Điểm phải từ 0 đến 100 và nhận xét không được để trống.');
            const before = await models.AssignmentSubmission.findById(req.params.id).lean();
            if (!before) return fail(res, 404, 'SUBMISSION_NOT_FOUND', 'Không tìm thấy bài nộp.');
            const updated = await models.AssignmentSubmission.findByIdAndUpdate(req.params.id, { $set: { status: 'GRADED', score, feedback, reviewerUsername: req.session.user.username, gradedAt: new Date() } }, { new: true, runValidators: true }).lean();
            if (isObjectId(updated.courseId) && isObjectId(updated.lessonId)) await recalculateLessonProgress({ models, username: updated.username, courseId: updated.courseId, lessonId: updated.lessonId }).catch(error => console.warn('[lesson-progress] assignment refresh failed:', error.message));
            await audit(req, 'GRADE', 'AssignmentSubmission', req.params.id, { status: before.status, score: before.score }, { status: updated.status, score: updated.score, reviewerUsername: updated.reviewerUsername });
            return ok(res, { id: String(updated._id), status: updated.status, score: updated.score, feedback: updated.feedback, gradedAt: updated.gradedAt }, 'Đã lưu điểm và nhận xét cho bài nộp.');
        } catch (error) { return next(error); }
    });
    router.get('/learning/lesson-progress', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.query.courseId)) return fail(res, 400, 'COURSE_ID_REQUIRED', 'Thiếu hoặc sai mã khóa học.');
            if (req.query.lessonId) {
                if (!isObjectId(req.query.lessonId)) return fail(res, 400, 'INVALID_PROGRESS_TARGET', 'Mã bài học không hợp lệ.');
                const snapshot = await recalculateLessonProgress({ models, username: req.session.user.username, courseId: req.query.courseId, lessonId: req.query.lessonId });
                if (!snapshot) return fail(res, 404, 'LESSON_NOT_ACCESSIBLE', 'Không tìm thấy bài học đã công bố thuộc khóa học bạn có quyền truy cập.');
                return ok(res, snapshot, 'Tiến độ được tính từ bằng chứng đánh giá đã lưu.');
            }
            const username = req.session.user.username;
            const course = await models.Course.findOne({ _id: req.query.courseId, $or: [{ kind: 'CANONICAL', status: { $in: ['ACTIVE', 'PUBLISHED'] } }, { kind: 'PERSONAL_AI', ownerUsername: username, status: 'ACTIVE' }] }).select('_id').lean();
            if (!course) return fail(res, 404, 'COURSE_NOT_ACCESSIBLE', 'Không tìm thấy khóa học đã công bố mà bạn có quyền truy cập.');
            const lessons = await models.CurriculumContent.find({ courseId: course._id, type: 'LESSON', status: 'PUBLISHED' }).select('_id').sort({ createdAt: 1 }).limit(250).lean();
            const items = await Promise.all(lessons.map(lesson => recalculateLessonProgress({ models, username, courseId: String(course._id), lessonId: String(lesson._id) })));
            return ok(res, items.filter(Boolean));
        } catch (error) { return next(error); }
    });
    router.put('/learning/lesson-progress/:lessonId', requireAuth, async (req, res, next) => {
        try {
            if (!models.LessonProgress) return fail(res, 503, 'PROGRESS_UNAVAILABLE', 'Tính năng lưu tiến độ chưa sẵn sàng.');
            const lessonId = String(req.params.lessonId || '');
            const courseId = String(req.body?.courseId || '');
            if (!isObjectId(lessonId) || !isObjectId(courseId)) return fail(res, 400, 'INVALID_PROGRESS_TARGET', 'Mã bài học hoặc khóa học không hợp lệ.');
            // completedSteps/progressPercent từ client bị bỏ qua. Chỉ kết quả đánh giá đã lưu ở server mới được công nhận.
            const snapshot = await recalculateLessonProgress({ models, username: req.session.user.username, courseId, lessonId, requestedTimeSpentSeconds: req.body?.timeSpentSeconds });
            if (!snapshot) return fail(res, 404, 'LESSON_NOT_ACCESSIBLE', 'Không tìm thấy bài học đã công bố thuộc khóa học bạn có quyền truy cập.');
            return ok(res, snapshot, snapshot.completed ? 'Đã xác nhận hoàn thành dựa trên kết quả đánh giá.' : 'Tiến độ được cập nhật; chưa đủ bằng chứng để xác nhận hoàn thành.');
        } catch (error) { return next(error); }
    });
    router.put('/education/profile', requireAuth, async (req, res, next) => {
        try {
            const username = req.session.user.username;
            const body = req.body || {};
            const checked = validateProfileUpdate(body);
            if (!checked.ok) return fail(res, 400, 'VALIDATION_ERROR', checked.errors[0].message, checked.errors);
            if (body.clearDob === true || body.clearDob === 'true') return fail(res, 400, 'DOB_REQUIRED_FOR_PERSONALIZATION', 'Ngày sinh cần được giữ để xác định độ tuổi và chọn bài kiểm tra/lộ trình phù hợp. Hãy cập nhật ngày sinh hợp lệ thay vì xóa.');
            const profileValues = {
                ...(body.avatar !== undefined ? { avatar: cleanText(body.avatar, 500) } : {}),
                ...(checked.values.dob !== undefined ? { dob: checked.values.dob } : {}),
                ...(body.guardianUsername !== undefined ? { guardianUsername: cleanText(body.guardianUsername, 80) } : {}),
                ...(body.consent !== undefined ? { consent: body.consent } : {}),
                ...(checked.values.fullName !== undefined ? { fullName: checked.values.fullName } : {})
            };
            const profile = await models.Profile.findOneAndUpdate({ username }, { $set: profileValues }, { new: true, upsert: true, runValidators: true }).lean();
            const educationInput = body.education && typeof body.education === 'object' ? { ...body.education } : {};
            delete educationInput.username;
            delete educationInput._id;
            delete educationInput.provenance;
            const educationFields = ['educationLevel', 'grade', 'institution', 'universityName', 'facultyName', 'fieldName', 'disciplineGroupName', 'majorName', 'specializationName', 'trainingProgramName', 'cohort', 'academicYear', 'semester', 'universityId', 'facultyId', 'fieldId', 'disciplineGroupId', 'majorId', 'specializationId', 'trainingProgramId'];
            const educationValues = Object.fromEntries(Object.entries(educationInput).filter(([key]) => educationFields.includes(key)));
            educationValues.provenance = { source: 'USER_DECLARED', updatedAt: new Date() };
            if (checked.values.educationStatus !== undefined) educationValues.educationStatus = checked.values.educationStatus;
            if (checked.values.educationGrade !== undefined) educationValues.grade = checked.values.educationGrade;
            const education = await models.EducationProfile.findOneAndUpdate({ username }, { $set: educationValues }, { new: true, upsert: true, runValidators: true }).lean();
            let learning = await models.LearningProfile.findOne({ username });
            if (body.learning && typeof body.learning === 'object') {
                if (!learning) learning = new models.LearningProfile({ username });
                if (Array.isArray(body.learning.goals)) learning.goals = [...new Set(body.learning.goals.map(value => cleanText(value, 160)).filter(Boolean))].slice(0, 30);
                if (body.learning.aiPreferences && typeof body.learning.aiPreferences === 'object') learning.aiPreferences = { ...(learning.aiPreferences || {}), ...safePatch(body.learning.aiPreferences) };
                learning.survey = { ...(learning.survey || {}), goals: learning.goals || [], aiPreferences: learning.aiPreferences || {}, provenance: { source: 'USER_DECLARED', updatedAt: new Date() } };
                await learning.save();
                learning = learning.toObject();
            } else if (learning) learning = learning.toObject();
            if (legacyUserModel && (checked.values.fullName !== undefined || checked.values.dob !== undefined || checked.values.educationStatus !== undefined)) {
                const legacyValues = {};
                if (checked.values.fullName !== undefined) legacyValues.fullName = checked.values.fullName;
                if (checked.values.dob !== undefined) { legacyValues.dob = checked.values.dob; legacyValues.age = checked.values.age; }
                if (checked.values.educationStatus !== undefined) { legacyValues.educationStatus = checked.values.educationStatus; legacyValues.educationGrade = checked.values.educationGrade; }
                await legacyUserModel.updateOne({ username }, { $set: legacyValues });
            }
            return ok(res, { profile, education, learning }, 'Đã đồng bộ hồ sơ giáo dục và mục tiêu học tập.');
        } catch (e) { return next(e); }
    });

    const universityResources = [
        ['University', 'university', 'university.manage'], ['Faculty', 'faculty', 'university.manage'], ['Field', 'field', 'university.manage'],
        ['DisciplineGroup', 'discipline-group', 'university.manage'], ['Major', 'major', 'university.manage'], ['Specialization', 'specialization', 'university.manage'],
        ['TrainingProgram', 'training-program', 'university.manage'], ['Course', 'course', 'university.manage']
    ];
    for (const [modelName, pathName, permission] of universityResources) {
        router.get(`/university/${pathName}`, async (req, res, next) => { try { const filter = {}; const foreignKeys = ['universityId', 'fieldId', 'disciplineGroupId', 'majorId', 'institutionId', 'facultyId', 'programId']; for (const key of foreignKeys) if (req.query[key] && isObjectId(req.query[key])) filter[key] = req.query[key]; if (req.query.status) filter.status = cleanText(req.query.status, 30); else if (modelName !== 'DisciplineGroup') filter.status = 'ACTIVE'; return ok(res, await repositories[modelName].list(filter, parsePage(req))); } catch (e) { return next(e); } });
        router.post(`/university/${pathName}`, guarded(permission), async (req, res, next) => { try { const body = { ...(req.body || {}) }; if (!body.name && !body.programName && !body.code) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu trường định danh của dữ liệu đại học.'); const item = await repositories[modelName].create(body); await audit(req, 'CREATE', modelName, item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: `Đã tạo ${pathName}.` }); } catch (e) { return next(e); } });
        router.patch(`/university/${pathName}/:id`, guarded(permission), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu đại học không hợp lệ.'); const before = await models[modelName].findById(req.params.id).lean(); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu đại học.'); const changes = safePatch(req.body || {}); delete changes._id; delete changes.createdAt; delete changes.updatedAt; const item = await repositories[modelName].updateById(req.params.id, { $set: changes }); await audit(req, 'UPDATE', modelName, req.params.id, before, item); return ok(res, item, 'Đã cập nhật dữ liệu đại học.'); } catch (e) { return next(e); } });
        router.delete(`/university/${pathName}/:id`, guarded(permission), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu đại học không hợp lệ.'); const before = await models[modelName].findById(req.params.id).lean(); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu đại học.'); const item = await repositories[modelName].archiveById(req.params.id); await audit(req, 'ARCHIVE', modelName, req.params.id, before, item); return ok(res, item, 'Đã archive dữ liệu đại học; không xóa vật lý.'); } catch (e) { return next(e); } });
    }

    router.get('/question-bank/questions', async (req, res, next) => { try { const filter = { status: req.query.status || 'PUBLISHED' }; for (const key of ['subjectId', 'lessonId', 'courseId', 'educationLevel', 'type', 'difficulty', 'skill']) if (req.query[key]) filter[key] = cleanText(req.query[key], 80); if (req.query.grade) filter.grade = Number(req.query.grade); const result = await repositories.Question.list(filter, parsePage(req), { projection: '-answer -acceptedAnswers -rubric' }); result.items = (result.items || []).map(question => sanitizeAssessmentQuestion(question)); return ok(res, result); } catch (e) { return next(e); } });
    router.post('/question-bank/questions', guarded('learning.question.create'), async (req, res, next) => { try { const body = req.body || {}; if (!body.code || !body.type || !body.prompt) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu code, type hoặc prompt.'); if (!Array.isArray(body.options)) body.options = []; const item = await repositories.Question.create(body); await audit(req, 'CREATE', 'Question', item._id, null, { ...item.toObject(), answer: undefined }); return res.status(201).json({ success: true, data: item, message: 'Đã tạo câu hỏi.' }); } catch (e) { return next(e); } });

    router.get('/assessment/assessments', async (req, res, next) => { try { return ok(res, await repositories.Assessment.list({ publicationStatus: req.query.status || 'PUBLISHED' }, parsePage(req))); } catch (e) { return next(e); } });
    router.get('/assessment/assessments/:id', async (req, res, next) => {
        try {
            let assessment = null;
            if (isObjectId(req.params.id)) assessment = await models.Assessment.findOne({ _id: req.params.id, publicationStatus: 'PUBLISHED' }).lean();
            else assessment = await models.Assessment.findOne({ code: String(req.params.id || '').trim(), publicationStatus: 'PUBLISHED' }).lean();
            if (!assessment) {
                const fallback = starterAssessmentLookup(req.params.id);
                if (fallback) assessment = await persistStarterAssessment(fallback.starter, fallback.assessment);
            }
            if (!assessment && !isObjectId(req.params.id)) {
                const fallback = k12AssessmentLookup(req.params.id);
                if (fallback) assessment = await persistK12Assessment(fallback);
            }
            if (!assessment) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy assessment đã công bố.');
            const questions = (await models.Question.find({ _id: { $in: assessment.questionIds || [] }, status: 'PUBLISHED' }, { answer: 0, acceptedAnswers: 0, rubric: 0 }).lean()).map(sanitizeAssessmentQuestion);
            return ok(res, { ...assessment, questions });
        } catch (e) { return next(e); }
    });
    router.post('/assessment/assessments', guarded('learning.exam.create'), async (req, res, next) => { try { const body = req.body || {}; if (!body.code || !body.title) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu code hoặc title assessment.'); const item = await repositories.Assessment.create(body); await audit(req, 'CREATE', 'Assessment', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo assessment.' }); } catch (e) { return next(e); } });
    router.post('/assessment/:id/attempts', requireAuth, async (req, res, next) => {
        try {
            let assessment = null;
            if (isObjectId(req.params.id)) assessment = await models.Assessment.findOne({ _id: req.params.id, publicationStatus: 'PUBLISHED' }).lean();
            else assessment = await models.Assessment.findOne({ code: String(req.params.id || '').trim(), publicationStatus: 'PUBLISHED' }).lean();
            if (!assessment) { const fallback = starterAssessmentLookup(req.params.id); if (fallback) assessment = await persistStarterAssessment(fallback.starter, fallback.assessment); }
            if (!assessment && !isObjectId(req.params.id)) { const fallback = k12AssessmentLookup(req.params.id); if (fallback) assessment = await persistK12Assessment(fallback); }
            if (!assessment) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy assessment đã công bố.');
            const username = req.session.user.username;
            const activeAttempt = await models.AssessmentAttempt.findOne({ assessmentId: assessment._id, username, status: 'IN_PROGRESS' }).sort({ startedAt: -1 });
            if (activeAttempt) return ok(res, { attemptId: activeAttempt._id, assessmentId: activeAttempt.assessmentId, startedAt: activeAttempt.startedAt, expiresAt: activeAttempt.expiresAt, status: activeAttempt.status, answers: activeAttempt.answers || {}, resumed: true }, 'Khôi phục lượt làm bài đang mở và câu trả lời đã lưu.');
            const usedAttempts = await models.AssessmentAttempt.countDocuments({ assessmentId: assessment._id, username, status: { $in: ['SUBMITTED', 'REVIEW_REQUIRED'] } });
            if (Number.isFinite(assessment.attemptLimit) && assessment.attemptLimit > 0 && usedAttempts >= assessment.attemptLimit) return fail(res, 409, 'ATTEMPT_LIMIT', 'Bạn đã dùng hết số lượt làm bài.');
            const now = new Date();
            const expiresAt = assessment.durationSeconds ? new Date(now.getTime() + assessment.durationSeconds * 1000) : null;
            const attempt = await models.AssessmentAttempt.create({ assessmentId: assessment._id, username, startedAt: now, expiresAt });
            return res.status(201).json({ success: true, data: { attemptId: attempt._id, assessmentId: assessment._id, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, status: attempt.status, answers: {}, resumed: false }, message: 'Đã bắt đầu lượt làm bài.' });
        } catch (e) { return next(e); }
    });
    router.put('/assessment/attempts/:id/answers', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã attempt không hợp lệ.');
            const attempt = await models.AssessmentAttempt.findOne({ _id: req.params.id, username: req.session.user.username, status: 'IN_PROGRESS' });
            if (!attempt) return fail(res, 404, 'ATTEMPT_NOT_ACTIVE', 'Không tìm thấy lượt làm bài đang mở.');
            if (attempt.expiresAt && Date.now() > new Date(attempt.expiresAt).getTime()) return fail(res, 409, 'ATTEMPT_EXPIRED', 'Đã hết thời gian. Hệ thống sẽ chấm câu trả lời đã tự động lưu gần nhất.');
            const supplied = req.body?.answers;
            if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return fail(res, 400, 'ANSWERS_INVALID', 'Câu trả lời phải là object hợp lệ.');
            const assessment = await models.Assessment.findById(attempt.assessmentId).select('questionIds sections').lean();
            if (!assessment) return fail(res, 404, 'ASSESSMENT_NOT_FOUND', 'Không tìm thấy cấu hình bài kiểm tra.');
            const allowed = new Set([...(assessment.questionIds || []), ...(assessment.sections || []).flatMap(section => section.questionIds || [])].map(String));
            const entries = Object.entries(supplied).filter(([key]) => allowed.has(String(key))).slice(0, 250);
            attempt.answers = Object.fromEntries(entries);
            await attempt.save();
            return ok(res, { attemptId: String(attempt._id), savedAnswerCount: entries.length, savedAt: new Date().toISOString(), expiresAt: attempt.expiresAt }, 'Đã lưu bản nháp câu trả lời ở máy chủ.');
        } catch (e) { return next(e); }
    });
    router.post('/assessment/attempts/:id/submit', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã attempt không hợp lệ.');
            const attempt = await models.AssessmentAttempt.findOne({ _id: req.params.id, username: req.session.user.username });
            if (!attempt) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy lượt làm bài.');
            if (attempt.status !== 'IN_PROGRESS') return fail(res, 409, 'ATTEMPT_CLOSED', 'Lượt làm bài đã được đóng.');
            const assessment = await models.Assessment.findById(attempt.assessmentId).lean();
            if (!assessment) return fail(res, 404, 'ASSESSMENT_NOT_FOUND', 'Không tìm thấy cấu hình bài kiểm tra của lượt làm bài.');
            const expired = Boolean(attempt.expiresAt && new Date() > attempt.expiresAt);
            const suppliedAnswers = req.body?.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers) ? req.body.answers : {};
            const answerSource = expired ? (attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {}) : suppliedAnswers;
            const questions = await models.Question.find({ _id: { $in: assessment.questionIds || [] } }).lean();
            // Khi hết hạn, chỉ chấm snapshot cuối cùng đã lưu ở server; bỏ qua dữ liệu client gửi sau deadline.
            attempt.answers = answerSource;
            const result = await scoreAssessmentQuestions(questions, answerSource);
            attempt.score = result.percentage;
            attempt.result = { ...result, ...(expired ? { submittedAfterDeadline: true, deadlineAt: attempt.expiresAt } : {}) };
            attempt.submittedAt = new Date();
            attempt.status = result.requiresReview ? 'REVIEW_REQUIRED' : 'SUBMITTED';
            await attempt.save();
            await recordLearningErrors({ models, username: req.session.user.username, sourceType: 'ASSESSMENT', sourceId: String(assessment._id), grade: assessment.grade || null, subjectId: assessment.subjectId || '', lessonId: assessment.lessonId ? String(assessment.lessonId) : '', details: result.details });
            const learningSync = await syncAssessmentLearningPath({ username: req.session.user.username, assessment, result });
            if (assessment.courseId && assessment.lessonId) await recalculateLessonProgress({ models, username: req.session.user.username, courseId: String(assessment.courseId), lessonId: String(assessment.lessonId) }).catch(error => console.warn('[lesson-progress] assessment refresh failed:', error.message));
            return ok(res, { attemptId: attempt._id, score: result.percentage, passingScore: assessment.passingScore ?? null, passed: assessment.passingScore == null ? null : result.percentage >= assessment.passingScore && !result.requiresReview, status: attempt.status, expired, result, learningSync }, expired ? 'Đã chốt bài theo thời hạn phía máy chủ.' : 'Đã nộp bài, cập nhật lỗi học tập, mastery và learning plan.');
        } catch (e) { return next(e); }
    });

    router.get('/survey/surveys', async (req, res, next) => {
        try {
            const requestedStatus = req.query.status || 'PUBLISHED';
            let result = await repositories.Survey.list({ status: requestedStatus }, parsePage(req), { projection: '-questions.answer' });
            result.items = (result.items || []).filter(surveyIsValid);
            let repairError = null;
            if (!result.items.length && requestedStatus === 'PUBLISHED') {
                try {
                    await require('../../scripts/migrations/012-v27-typed-learning-system').ensureDiagnostics(console);
                } catch (error) {
                    repairError = error;
                    console.error('[onboarding-survey] Không thể khởi tạo khảo sát mặc định:', error.message);
                }
                result = await repositories.Survey.list({ status: 'PUBLISHED' }, parsePage(req), { projection: '-questions.answer' });
                result.items = (result.items || []).filter(surveyIsValid);
            }
            result.items = result.items.map(survey => ({ ...survey, questionCount: (survey.questions || []).length, sections: [...new Set((survey.questions || []).map(question => question.section || 'Khảo sát'))] }));
            result.total = result.items.length;
            if (!result.items.length && requestedStatus === 'PUBLISHED') return fail(res, 503, 'SURVEY_CATALOG_UNAVAILABLE', repairError ? 'Chưa thể khởi tạo khảo sát vì máy chủ hoặc cơ sở dữ liệu gặp lỗi. Vui lòng thử lại sau; quản trị viên cần kiểm tra kết nối MongoDB và log máy chủ.' : 'Chưa có khảo sát hợp lệ sau khi tự sửa danh mục. Vui lòng thử tải lại; quản trị viên có thể chạy chức năng sửa danh mục khảo sát/placement.');
            return ok(res, result, 'Đã tải khảo sát hợp lệ.');
        } catch (e) { return next(e); }
    });
    router.post('/survey/:id/attempts', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã survey không hợp lệ.');
            const survey = await models.Survey.findOne({ _id: req.params.id, status: 'PUBLISHED' }).lean();
            if (!survey) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy survey đã công bố.');
            if (!surveyIsValid(survey)) return fail(res, 409, 'SURVEY_INVALID', 'Khảo sát này chưa có bộ câu hỏi hợp lệ. Admin cần bổ sung câu hỏi bắt buộc trước khi công bố.');
            const supplied = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
            const allowed = new Set((survey.questions || []).flatMap(question => [question.id, question.code, question._id].filter(Boolean).map(String)));
            const candidateAnswers = Object.fromEntries(Object.entries(supplied).filter(([key]) => allowed.has(String(key))).slice(0, 250));
            const visibleQuestions = visibleSurveyQuestions(survey, candidateAnswers);
            const visibleKeys = new Set(visibleQuestions.flatMap(question => [question.code, question.id, question._id].filter(Boolean).map(String)));
            const answers = Object.fromEntries(Object.entries(candidateAnswers).filter(([key]) => visibleKeys.has(String(key))));
            const missing = visibleQuestions.filter(question => question.required && !answerIsPresent(answers[String(question.code || question.id || question._id || '')])).map(question => ({ code: question.code || question.id, prompt: question.prompt || question.title || question.code }));
            if (missing.length) return fail(res, 400, 'SURVEY_REQUIRED_ANSWERS', `Bạn còn ${missing.length} câu bắt buộc chưa trả lời.`, missing.slice(0, 20));
            const profile = normalizeSurveyResult(survey.questions || [], answers);
            const answered = visibleQuestions.filter(question => answerIsPresent(answers[String(question.code || question.id || question._id || '')])).length;
            const result = { ...profile, surveyId: String(survey._id), surveyVersion: survey.version || '1', answered, total: visibleQuestions.length, completion: Number((answered / Math.max(1, visibleQuestions.length) * 100).toFixed(2)), provenance: { ...(profile.provenance || {}), surveyId: String(survey._id), surveyVersion: survey.version || '1', source: 'USER_DECLARED', submittedAt: new Date().toISOString() } };
            const username = req.session.user.username;
            const attempt = await models.SurveyAttempt.create({ surveyId: survey._id, surveyVersion: survey.version || '1', username, answers, result, submittedAt: new Date() });
            const [account, previousEducation, previousPlan] = await Promise.all([
                legacyUserModel.findOne({ username }).select('dob').lean(),
                models.EducationProfile.findOne({ username }).lean(),
                models.LearningPlan.findOne({ username }).sort({ version: -1 }).lean()
            ]);
            const age = calculateAge(account?.dob);
            const inferredStage = possibleEducationStage(age);
            const educationReferences = await resolveEducationReferences(result);
            const educationLevel = ['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER', 'HIGHER_EDUCATION', 'ENGLISH_CERTIFICATION', 'SELF_STUDY'].includes(result.educationLevel) ? result.educationLevel : previousEducation?.educationLevel || inferredStage || '';
            const educationValues = {
                ...(educationLevel ? { educationLevel } : {}),
                ...(result.currentGrade ? { grade: result.currentGrade } : (['HIGHER_EDUCATION', 'ENGLISH_CERTIFICATION', 'SELF_STUDY'].includes(educationLevel) ? { grade: null } : {})),
                ...(result.educationStatus ? { educationStatus: result.educationStatus } : {}),
                ...(result.institution ? { institution: result.institution } : {}),
                ...(result.university ? { universityName: result.university } : {}),
                ...(result.faculty ? { facultyName: result.faculty } : {}),
                ...(result.field ? { fieldName: result.field } : {}),
                ...(result.disciplineGroup ? { disciplineGroupName: result.disciplineGroup } : {}),
                ...(result.major ? { majorName: result.major } : {}),
                ...(result.specialization ? { specializationName: result.specialization } : {}),
                ...(result.trainingProgram ? { trainingProgramName: result.trainingProgram } : {}),
                ...(educationReferences.names.universityName ? { universityName: educationReferences.names.universityName } : {}),
                ...(educationReferences.names.facultyName ? { facultyName: educationReferences.names.facultyName } : {}),
                ...(educationReferences.names.fieldName ? { fieldName: educationReferences.names.fieldName } : {}),
                ...(educationReferences.names.disciplineGroupName ? { disciplineGroupName: educationReferences.names.disciplineGroupName } : {}),
                ...(educationReferences.names.majorName ? { majorName: educationReferences.names.majorName } : {}),
                ...(educationReferences.names.specializationName ? { specializationName: educationReferences.names.specializationName } : {}),
                ...(educationReferences.names.trainingProgramName ? { trainingProgramName: educationReferences.names.trainingProgramName } : {}),
                ...educationReferences.ids,
                ...(result.cohort ? { cohort: result.cohort } : {}),
                ...(result.academicYear ? { academicYear: result.academicYear } : {}),
                ...(result.semester ? { semester: result.semester } : {}),
                provenance: { ...(previousEducation?.provenance || {}), source: 'USER_DECLARED', allowedSources: ['USER_DECLARED', 'AI_INFERRED', 'SYSTEM_DERIVED'], lastUpdatedBy: 'SURVEY_USER_DECLARED', surveyId: String(survey._id), surveyVersion: survey.version || '1', fields: { educationLevel: result.educationLevel ? 'USER_DECLARED' : 'SYSTEM_DERIVED', grade: result.currentGrade ? 'USER_DECLARED' : 'SYSTEM_DERIVED', universityName: result.university ? 'USER_DECLARED' : (educationReferences.names.universityName ? 'SYSTEM_DERIVED' : 'USER_DECLARED'), universityId: result.universityId ? 'USER_DECLARED' : (educationReferences.ids.universityId ? 'SYSTEM_DERIVED' : 'USER_DECLARED'), facultyId: result.facultyId ? 'USER_DECLARED' : (educationReferences.ids.facultyId ? 'SYSTEM_DERIVED' : 'USER_DECLARED'), fieldId: result.fieldId ? 'USER_DECLARED' : (educationReferences.ids.fieldId ? 'SYSTEM_DERIVED' : 'USER_DECLARED'), disciplineGroupId: result.disciplineGroupId ? 'USER_DECLARED' : (educationReferences.ids.disciplineGroupId ? 'SYSTEM_DERIVED' : 'USER_DECLARED'), majorId: result.majorId ? 'USER_DECLARED' : (educationReferences.ids.majorId ? 'SYSTEM_DERIVED' : 'USER_DECLARED'), specializationId: result.specializationId ? 'USER_DECLARED' : (educationReferences.ids.specializationId ? 'SYSTEM_DERIVED' : 'USER_DECLARED'), trainingProgramId: result.trainingProgramId ? 'USER_DECLARED' : (educationReferences.ids.trainingProgramId ? 'SYSTEM_DERIVED' : 'USER_DECLARED') }, updatedAt: new Date().toISOString() }
            };
            const education = await models.EducationProfile.findOneAndUpdate({ username }, { $set: educationValues, $setOnInsert: { username } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).lean();
            const learningProfile = await models.LearningProfile.findOneAndUpdate(
                { username },
                { $set: { survey: result, goals: result.goals, aiPreferences: result.preferences, inference: { ...(result.inference || {}), source: result.educationLevel ? 'USER_DECLARED' : 'SYSTEM_DERIVED', educationStage: educationLevel, requiresConfirmation: !result.educationLevel } , diagnostics: { surveyAttemptId: attempt._id, surveyId: String(survey._id), surveyVersion: survey.version || '1', age, possibleEducationStage: inferredStage, completedAt: new Date() } }, $setOnInsert: { username } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).lean();
            const plan = buildPersonalLearningPlan({ username, educationStage: education?.educationLevel || result.educationLevel || result.educationStatus || inferredStage, currentGrade: education?.grade || result.currentGrade, survey: result, goals: result.goals, subjectStrengths: result.strengths, subjectWeaknesses: result.weaknesses, englishGoals: result.englishGoals, targetDate: result.target.date, target: result.target, version: (previousPlan?.version || 0) + 1 });
            await attachCatalogLinks(plan, education);
            await models.LearningPlan.updateMany({ username, status: 'ACTIVE' }, { $set: { status: 'ARCHIVED' } });
            const savedPlan = await models.LearningPlan.create({ ...plan, diagnostics: { ...plan.diagnostics, surveyAttemptId: attempt._id, age, possibleEducationStage: inferredStage } });
            await models.LearningProfile.updateOne({ username }, { $set: { learningPlanId: savedPlan._id } });
            // Lưu kết quả khảo sát trước; tạo các khóa học cá nhân còn thiếu ở chế độ nền.
            // Không dùng API AI ngoài khi forceCreate=true và không đưa bản cá nhân vào catalog dùng chung.
            setImmediate(() => {
                schedulePlanCourseGapProvisioning(username, savedPlan.toObject ? savedPlan.toObject() : savedPlan, education || {}).catch(error => {
                    console.warn(`Không tự provision được khóa học sau khảo sát của ${username}:`, error.message);
                });
            });
            return res.status(201).json({ success: true, data: { attempt, result, learningProfile, education, learningPlan: savedPlan, learningPlanId: savedPlan._id, courseProvisioning: { status: 'STARTED', mode: 'LOCAL_EDUCATION_AI', autoPublishedPersonalCourses: true } }, message: 'Đã lưu khảo sát và tạo lộ trình. Hệ thống đang tự tạo các khóa học cá nhân còn thiếu ở chế độ nền.' });
        } catch (e) { return next(e); }
    });
    router.get('/placement/tests', async (req, res, next) => {
        try {
            const requestedStatus = req.query.status || 'PUBLISHED';
            let result = await repositories.PlacementTest.list({ status: requestedStatus }, parsePage(req));
            result.items = (result.items || []).filter(placementIsValid);
            if (!result.items.length && requestedStatus === 'PUBLISHED') {
                await require('../../scripts/migrations/012-v27-typed-learning-system').ensureDiagnostics(console);
                result = await repositories.PlacementTest.list({ status: 'PUBLISHED' }, parsePage(req));
                result.items = (result.items || []).filter(placementIsValid);
            }
            result.items = result.items.map(test => ({
                ...test,
                questionCount: (test.skillSections || []).reduce((sum, section) => sum + (section.questions || []).length, 0),
                skillSections: (test.skillSections || []).map(section => ({ ...section, questions: (section.questions || []).map(({ answer, correctAnswer, rubric, hiddenTestCases, testCases, expectedOutput, ...question }) => ({ ...question, options: (question.options || []).map(option => option && typeof option === 'object' ? { label: option.label ?? option.text ?? option.value ?? '', value: option.value ?? option.id ?? option.label ?? option.text ?? '' } : { label: String(option), value: option }) })) }))
            }));
            result.total = result.items.length;
            return ok(res, result, result.items.length ? 'Đã tải placement hợp lệ.' : 'Chưa có placement test hợp lệ. Admin cần chạy sửa danh mục hoặc kết nối MongoDB.');
        } catch (e) { return next(e); }
    });
    router.get('/placement/tests/:id', async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã placement test không hợp lệ.');
            const test = await models.PlacementTest.findOne({ _id: req.params.id, status: 'PUBLISHED' }).lean();
            if (!test || !placementIsValid(test)) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy placement test hợp lệ đã công bố.');
            return ok(res, { ...test, questionCount: (test.skillSections || []).reduce((sum, section) => sum + (section.questions || []).length, 0), skillSections: (test.skillSections || []).map(section => ({ ...section, questions: (section.questions || []).map(({ answer, correctAnswer, rubric, hiddenTestCases, testCases, expectedOutput, ...question }) => ({ ...question, options: (question.options || []).map(option => option && typeof option === 'object' ? { label: option.label ?? option.text ?? option.value ?? '', value: option.value ?? option.id ?? option.label ?? option.text ?? '' } : { label: String(option), value: option }) })) })) });
        } catch (e) { return next(e); }
    });
    router.post('/placement/:id/adaptive/next', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã placement test không hợp lệ.');
            const test = await models.PlacementTest.findOne({ _id: req.params.id, status: 'PUBLISHED' }).lean();
            if (!test || !placementIsValid(test)) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy placement test hợp lệ đã công bố.');
            const selection = selectAdaptivePlacementQuestion(test, {
                answers: req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {},
                askedQuestionIds: Array.isArray(req.body?.askedQuestionIds) ? req.body.askedQuestionIds.slice(0, 200) : [],
                currentQuestionId: req.body?.currentQuestionId || ''
            });
            return ok(res, selection, selection.done ? 'Đã đủ bằng chứng cho bài chẩn đoán.' : 'Đã chọn câu tiếp theo theo kỹ năng và độ khó.');
        } catch (e) { return next(e); }
    });

    router.post('/placement/:id/attempts', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã placement test không hợp lệ.');
            const test = await models.PlacementTest.findOne({ _id: req.params.id, status: 'PUBLISHED' }).lean();
            if (!test || !placementIsValid(test)) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy placement test hợp lệ đã công bố.');
            const suppliedAnswers = req.body?.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers) ? req.body.answers : {};
            const allQuestionIds = new Set((test.skillSections || []).flatMap(section => (section.questions || []).flatMap(question => [question.id, question.code, question._id].filter(Boolean).map(String))));
            const requestedQuestionIds = Array.isArray(req.body?.questionIds)
                ? req.body.questionIds.map(String)
                : Object.keys(suppliedAnswers).filter(questionId => allQuestionIds.has(String(questionId)));
            const submission = validatePlacementSubmission(test, requestedQuestionIds, suppliedAnswers);
            if (!submission.valid) return fail(res, 400, 'PLACEMENT_INCOMPLETE', submission.errors[0], { errors: submission.errors, coverage: submission.coverage });
            const selectedQuestionIds = new Set(submission.selectedQuestionIds);
            const scores = {};
            const evidence = {};
            const reviewRequiredSkills = [];
            for (const section of test.skillSections || []) {
                const allSectionQuestions = Array.isArray(section.questions) ? section.questions : [];
                const questions = allSectionQuestions.filter(question => selectedQuestionIds.has(String(question.id || question.code || question._id || '')));
                if (!questions.length) continue;
                let correct = 0, scoredCount = 0, answeredCount = 0;
                for (const question of questions) {
                    const key = String(question.id || question.code || '');
                    const selected = suppliedAnswers[key];
                    if (answerIsPresent(selected)) answeredCount += 1;
                    const expected = question.answer ?? question.correctAnswer;
                    const subjective = ['essay','speaking','coding','practical','timed_simulation'].includes(String(question.type || '').toLowerCase());
                    if (subjective || expected === undefined || expected === null || expected === '') { if (subjective) reviewRequiredSkills.push(section.skill || section.code || 'GENERAL'); continue; }
                    scoredCount += 1;
                    if (answersEqual(selected, expected)) correct += 1;
                }
                const skill = String(section.skill || section.code || 'GENERAL');
                evidence[skill] = { totalQuestions: questions.length, scoredQuestions: scoredCount, answeredQuestions: answeredCount, correct, score: scoredCount ? Number((correct / scoredCount * 100).toFixed(2)) : null, reviewRequired: reviewRequiredSkills.includes(skill) };
                if (scoredCount) scores[skill] = Number((correct / scoredCount * 100).toFixed(2));
            }
            if (!Object.keys(scores).length) return fail(res, 400, 'PLACEMENT_NOT_SCORABLE', 'Bài kiểm tra chưa có câu hỏi khách quan đủ đáp án để tính điểm.');
            const recommendation = buildPlacementRecommendation({ scores, target: req.body?.target || test.target, deadline: req.body?.deadline, availableMinutes: req.body?.availableMinutes });
            const username = req.session.user.username;
            const attempt = await models.PlacementAttempt.create({ placementTestId: test._id, username, answers: suppliedAnswers, scores, recommendation: { ...recommendation, evidence, reviewRequiredSkills: [...new Set(reviewRequiredSkills)] }, submittedAt: new Date() });
            const [learningProfile, education, account, previous] = await Promise.all([
                models.LearningProfile.findOne({ username }).lean(),
                models.EducationProfile.findOne({ username }).lean(),
                legacyUserModel.findOne({ username }).select('dob').lean(),
                models.LearningPlan.findOne({ username }).sort({ version: -1 }).lean()
            ]);
            const age = calculateAge(account?.dob);
            const inferredStage = possibleEducationStage(age);
            const nextSkills = { ...(learningProfile?.skills || {}), ...scores };
            await models.LearningProfile.findOneAndUpdate({ username }, { $set: { diagnostics: { ...(learningProfile?.diagnostics || {}), placementAttemptId: attempt._id, placementTestId: test._id, scores, evidence, recommendation, age, possibleEducationStage: inferredStage, updatedAt: new Date() }, skills: nextSkills }, $setOnInsert: { username } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            for (const [skill, accuracy] of Object.entries(scores)) {
                const existingMastery = await models.SkillMastery.findOne({ username, skill }).lean();
                const attempts = Number(existingMastery?.attempts || 0) + 1;
                const average = existingMastery && Number.isFinite(Number(existingMastery.accuracy)) ? Number(((Number(existingMastery.accuracy) * Number(existingMastery.attempts || 1) + accuracy) / attempts).toFixed(2)) : accuracy;
                const status = average >= 80 ? 'MASTERED' : average < 60 ? 'REVIEW_REQUIRED' : 'LEARNING';
                const reviewDays = average >= 80 ? 14 : average < 40 ? 1 : average < 60 ? 3 : 7;
                await models.SkillMastery.findOneAndUpdate({ username, skill }, { $set: { username, skill, subjectId: test.target || '', accuracy: average, averageScore: average, recentScore: accuracy, attempts, lastAttempt: new Date(), status, reviewDueAt: new Date(Date.now() + reviewDays * 86400000) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            }
            const survey = learningProfile?.survey || {};
            const plan = buildPersonalLearningPlan({ username, educationStage: education?.educationLevel || education?.educationStatus || survey.educationLevel || inferredStage, placement: { scores, ...recommendation }, survey, goals: learningProfile?.goals || survey.goals || [], currentGrade: education?.grade || survey.currentGrade || req.body?.currentGrade || null, target: { name: req.body?.target || test.target, exam: test.target, deadline: req.body?.deadline || survey.target?.date || '' }, version: (previous?.version || 0) + 1 });
            await attachCatalogLinks(plan, education || {});
            plan.diagnostics = { ...plan.diagnostics, placementAttemptId: attempt._id, placementTestId: test._id, placementEvidence: evidence, age, possibleEducationStage: inferredStage, reviewRequiredSkills: [...new Set(reviewRequiredSkills)] };
            await models.LearningPlan.updateMany({ username, status: 'ACTIVE' }, { $set: { status: 'ARCHIVED' } });
            const savedPlan = await models.LearningPlan.create(plan);
            await models.LearningProfile.updateOne({ username }, { $set: { learningPlanId: savedPlan._id } });
            setImmediate(() => schedulePlanCourseGapProvisioning(username, savedPlan.toObject ? savedPlan.toObject() : savedPlan, education || {}).catch(error => console.warn(`Không tự provision được khóa học sau placement của ${username}:`, error.message)));
            if (/TOEIC|IELTS/i.test(String(test.target || ''))) {
                const exam = /IELTS/i.test(String(test.target)) ? 'IELTS' : 'TOEIC';
                const englishProfile = buildEnglishSkillProfile(exam, scores, evidence);
                const coreScores = Object.values(englishProfile.skillProfile);
                await models.EnglishAssessment.create({ username, exam, variant: 'PLACEMENT_DIAGNOSTIC', skillScores: { ...englishProfile.skillProfile, ...scores }, overallEstimate: coreScores.length ? Number((coreScores.reduce((sum, score) => sum + score, 0) / coreScores.length).toFixed(2)) : null, scoreEvidence: { method: 'placement_diagnostic', placementAttemptId: String(attempt._id), officialScore: false, skillEvidence: evidence, ...englishProfile }, assessmentVersion: test.version || '1' });
                await models.LearningProfile.updateOne({ username }, { $set: { [`diagnostics.englishProfiles.${exam}`]: { ...englishProfile, placementAttemptId: String(attempt._id), updatedAt: new Date() } } });
            }
            return res.status(201).json({ success: true, data: { attempt, scores, evidence, recommendation, learningPlan: savedPlan, learningPlanId: savedPlan._id }, message: 'Đã chấm placement, cập nhật skill mastery và tạo phiên bản lộ trình mới.' });
        } catch (e) { return next(e); }
    });

    router.get('/learning-platform/plan', requireAuth, async (req, res, next) => { try { const username = req.session.user.username; const plan = await models.LearningPlan.findOne({ username, status: 'ACTIVE' }).sort({ version: -1 }).lean(); if (!plan) return ok(res, null, 'Chưa có learning plan.'); const education = await models.EducationProfile.findOne({ username }).lean() || {}; schedulePlanCourseGapProvisioning(username, plan, education).catch(error => console.warn(`Không tự provision được khóa học khi mở lộ trình của ${username}:`, error.message)); return ok(res, plan, 'Lộ trình đã tải. Hệ thống đang tự tạo các khóa học cá nhân còn thiếu ở chế độ nền.'); } catch (e) { return next(e); } });
    router.post('/learning-platform/plan/generate', requireAuth, async (req, res, next) => {
        try {
            const payload = req.body || {};
            await models.LearningPlan.updateMany({ username: req.session.user.username, status: 'ACTIVE' }, { $set: { status: 'ARCHIVED' } });
            const previous = await models.LearningPlan.findOne({ username: req.session.user.username }).sort({ version: -1 }).lean();
            const plan = buildPersonalLearningPlan({ ...payload, username: req.session.user.username, version: (previous?.version || 0) + 1 });
            const grade = Number(payload.currentGrade || payload.grade || 0);
            const subjectIds = [...new Set(plan.subjects.map(subject => String(subject.subjectId || '').trim()).filter(Boolean))];
            if (grade >= 1 && grade <= 12 && subjectIds.length) {
                const courses = await models.Course.find({ status: 'ACTIVE', 'syllabus.grade': grade, 'syllabus.subjectId': { $in: subjectIds } }).lean();
                const bySubject = new Map(courses.map(course => [course.syllabus?.subjectId, course]));
                const courseIds = courses.map(course => course._id);
                const [lessons, assessments] = await Promise.all([
                    models.CurriculumContent.find({ type: 'LESSON', status: 'PUBLISHED', 'payload.courseId': { $in: courseIds } }).sort({ code: 1 }).lean(),
                    models.Assessment.find({ courseId: { $in: courseIds }, publicationStatus: 'PUBLISHED' }).lean()
                ]);
                plan.subjects = plan.subjects.map(subject => {
                    const course = bySubject.get(subject.subjectId);
                    if (!course) return subject;
                    const lesson = lessons.find(item => String(item.payload?.courseId) === String(course._id));
                    const assessment = assessments.find(item => String(item.courseId) === String(course._id));
                    return { ...subject, courseId: course._id, lessonId: lesson?._id || null, assessmentId: assessment?._id || null, title: course.name };
                });
                plan.recommendations = plan.recommendations.map(item => {
                    const subject = plan.subjects.find(candidate => candidate.subjectId === item.subjectId);
                    return subject ? { ...item, courseId: subject.courseId || null, lessonId: subject.lessonId || null, assessmentId: subject.assessmentId || null } : item;
                });
            }
            const education = await models.EducationProfile.findOne({ username: req.session.user.username }).lean();
            await attachCatalogLinks(plan, education || { grade });
            const saved = await models.LearningPlan.create(plan);
            await models.LearningProfile.findOneAndUpdate({ username: req.session.user.username }, { $set: { learningPlanId: saved._id, diagnostics: { ...(payload.placement || {}), generatedBy: 'USER_REQUEST' } } }, { upsert: true, new: true });
            setImmediate(() => schedulePlanCourseGapProvisioning(req.session.user.username, saved.toObject ? saved.toObject() : saved, education || { grade }).catch(error => console.warn(`Không tự provision được khóa học của ${req.session.user.username}:`, error.message)));
            return res.status(201).json({ success: true, data: saved, courseProvisioning: { status: 'STARTED', mode: 'LOCAL_EDUCATION_AI', maxPerRun: 8 }, message: 'Đã tạo lộ trình. Hệ thống đang tự tạo các khóa học cá nhân còn thiếu ở chế độ nền.' });
        } catch (e) { return next(e); }
    });
    router.post('/learning-platform/mastery', requireAuth, async (req, res, next) => { try { const body = req.body || {}; const skill = cleanText(body.skill, 120); if (!skill) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu skill.'); const allowed = ['subjectId', 'courseId', 'status', 'accuracy', 'attempts', 'lastAttempt', 'averageScore', 'recentScore', 'timeSpent', 'streak', 'reviewDueAt']; const changes = Object.fromEntries(allowed.filter(key => body[key] !== undefined).map(key => [key, key === 'subjectId' ? cleanText(body[key], 80) : body[key]])); const item = await models.SkillMastery.findOneAndUpdate({ username: req.session.user.username, skill, subjectId: changes.subjectId || '' }, { $set: { ...changes, skill, username: req.session.user.username } }, { new: true, upsert: true, runValidators: true }).lean(); return ok(res, item, 'Đã cập nhật mastery.'); } catch (e) { return next(e); } });
    router.get('/learning-platform/mastery', requireAuth, async (req, res, next) => { try { const filter = { username: req.session.user.username }; if (req.query.skill) filter.skill = cleanText(req.query.skill, 120); if (req.query.subjectId) filter.subjectId = cleanText(req.query.subjectId, 80); return ok(res, await models.SkillMastery.find(filter).sort({ updatedAt: -1 }).lean()); } catch (e) { return next(e); } });

    router.post('/english/:exam/plan', requireAuth, async (req, res, next) => { try { const exam = String(req.params.exam || '').toUpperCase(); if (!['TOEIC', 'IELTS'].includes(exam)) return fail(res, 400, 'EXAM_INVALID', 'English exam không hợp lệ.'); const plan = buildEnglishPlan({ exam, variant: req.body?.variant, scores: req.body?.scores, target: req.body?.target }); return ok(res, plan, 'Đã tạo English skill plan.'); } catch (e) { return next(e); } });
    router.post('/english/ielts/estimate', requireAuth, async (req, res, next) => { try { return ok(res, estimateIeltsBand(req.body || {}), 'Đây là Estimated/Diagnostic Band, không phải chứng chỉ IELTS chính thức.'); } catch (e) { return next(e); } });
    router.post('/english/assessments', requireAuth, async (req, res, next) => { try { const body = req.body || {}; if (!['TOEIC', 'IELTS'].includes(String(body.exam || '').toUpperCase())) return fail(res, 400, 'EXAM_INVALID', 'Exam phải là TOEIC hoặc IELTS.'); const item = await models.EnglishAssessment.create({ ...body, username: req.session.user.username, exam: String(body.exam).toUpperCase() }); return res.status(201).json({ success: true, data: item, message: 'Đã lưu English assessment.' }); } catch (e) { return next(e); } });
    router.get('/english/assessments', requireAuth, async (req, res, next) => { try { const filter = { username: req.session.user.username }; if (req.query.exam) filter.exam = String(req.query.exam).toUpperCase(); return ok(res, await models.EnglishAssessment.find(filter).sort({ createdAt: -1 }).limit(100).lean()); } catch (e) { return next(e); } });
    router.get('/english/configs', async (req, res, next) => { try { const filter = { status: req.query.status || 'ACTIVE' }; if (req.query.exam) filter.exam = String(req.query.exam).toUpperCase(); if (req.query.variant) filter.variant = cleanText(req.query.variant, 40); return ok(res, await repositories.EnglishTestConfig.list(filter, parsePage(req))); } catch (e) { return next(e); } });
    router.post('/admin/platform/english-configs', (req, res, next) => { const exam = String(req.body?.exam || '').toUpperCase(); const permission = exam === 'IELTS' ? 'english.ielts.manage' : 'english.toeic.manage'; return guarded(permission)(req, res, next); }, async (req, res, next) => { try { const body = req.body || {}; const exam = String(body.exam || '').toUpperCase(); if (!body.code || !['TOEIC', 'IELTS'].includes(exam) || !body.version || !body.sourceRef) return fail(res, 400, 'VALIDATION_ERROR', 'English config cần code, exam, version và sourceRef.'); const item = await repositories.EnglishTestConfig.create({ ...body, exam }); await audit(req, 'CREATE', 'EnglishTestConfig', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo English assessment config.' }); } catch (e) { return next(e); } });

    const gamificationResources = [['Achievement', 'achievements'], ['Reward', 'rewards']];
    for (const [modelName, pathName] of gamificationResources) {
        router.get(`/admin/platform/${pathName}`, guarded('gamification.manage'), async (req, res, next) => { try { const filter = req.query.status ? { status: cleanText(req.query.status, 30) } : {}; return ok(res, await repositories[modelName].list(filter, parsePage(req))); } catch (e) { return next(e); } });
        router.post(`/admin/platform/${pathName}`, guarded('gamification.manage'), async (req, res, next) => { try { const body = req.body || {}; if (!body.code || !body.name) return fail(res, 400, 'VALIDATION_ERROR', `${pathName} cần code và name.`); const item = await repositories[modelName].create({ ...body, code: cleanText(body.code, 120), name: cleanText(body.name, 160) }); await audit(req, 'CREATE', modelName, item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: `Đã tạo ${pathName}.` }); } catch (e) { return next(e); } });
        router.patch(`/admin/platform/${pathName}/:id`, guarded('gamification.manage'), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã gamification không hợp lệ.'); const before = await models[modelName].findById(req.params.id).lean(); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy cấu hình gamification.'); const changes = { ...(req.body || {}) }; delete changes._id; delete changes.createdAt; delete changes.updatedAt; const item = await repositories[modelName].updateById(req.params.id, { $set: changes }); await audit(req, 'UPDATE', modelName, req.params.id, before, item); return ok(res, item, 'Đã cập nhật cấu hình gamification.'); } catch (e) { return next(e); } });
        router.delete(`/admin/platform/${pathName}/:id`, guarded('gamification.manage'), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã gamification không hợp lệ.'); const item = await repositories[modelName].archiveById(req.params.id); return ok(res, item, 'Đã archive cấu hình gamification.'); } catch (e) { return next(e); } });
    }

    const diagnosticResources = [
        ['Survey', 'surveys', 'learning.survey.manage'],
        ['PlacementTest', 'placement-tests', 'learning.placement.manage']
    ];
    for (const [modelName, pathName, permission] of diagnosticResources) {
        router.get(`/admin/platform/${pathName}`, guarded(permission), async (req, res, next) => {
            try {
                const filter = req.query.status ? { status: cleanText(req.query.status, 30) } : {};
                const result = await repositories[modelName].list(filter, parsePage(req), modelName === 'Survey' ? '-questions.answer' : null);
                if (modelName === 'Survey') result.items = (result.items || []).map(item => ({ ...item, validation: validateSurvey(item) }));
                if (modelName === 'PlacementTest') result.items = (result.items || []).map(item => ({ ...item, validation: validatePlacement(item) }));
                return ok(res, result);
            } catch (e) { return next(e); }
        });
        router.post(`/admin/platform/${pathName}`, guarded(permission), async (req, res, next) => {
            try {
                const body = safePatch(req.body || {});
                const required = modelName === 'Survey' ? body.title : body.code;
                if (!required) return fail(res, 400, 'VALIDATION_ERROR', `${pathName} thiếu trường định danh.`);
                const validation = modelName === 'Survey' ? validateSurvey(body) : modelName === 'PlacementTest' ? validatePlacement(body) : null;
                if (String(body.status || '').toUpperCase() === 'PUBLISHED' && validation && !validation.valid) return fail(res, 409, 'DIAGNOSTIC_INVALID', 'Không thể tạo bản ghi ở trạng thái PUBLISHED khi dữ liệu chưa hợp lệ.', validation.errors);
                const item = await repositories[modelName].create(body);
                await audit(req, 'CREATE', modelName, item._id, null, item.toObject());
                return res.status(201).json({ success: true, data: item, message: `Đã tạo ${pathName}.` });
            } catch (e) { return next(e); }
        });
        router.patch(`/admin/platform/${pathName}/:id`, guarded(permission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã diagnostic không hợp lệ.');
                const before = await models[modelName].findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy diagnostic.');
                const changes = safePatch(req.body || {}); delete changes._id; delete changes.createdAt; delete changes.updatedAt;
                const candidate = { ...before, ...changes };
                const validation = modelName === 'Survey' ? validateSurvey(candidate) : modelName === 'PlacementTest' ? validatePlacement(candidate) : null;
                if (String(candidate.status || '').toUpperCase() === 'PUBLISHED' && validation && !validation.valid) return fail(res, 409, 'DIAGNOSTIC_INVALID', 'Không thể công bố/chỉnh sửa thành PUBLISHED khi dữ liệu chưa hợp lệ.', validation.errors);
                const item = await repositories[modelName].updateById(req.params.id, { $set: changes });
                await audit(req, 'UPDATE', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã cập nhật diagnostic.');
            } catch (e) { return next(e); }
        });
        router.post(`/admin/platform/${pathName}/:id/publish`, guarded(permission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã diagnostic không hợp lệ.');
                const before = await models[modelName].findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy diagnostic.');
                const validation = modelName === 'Survey' ? validateSurvey(before) : modelName === 'PlacementTest' ? validatePlacement(before) : null;
                if (validation && !validation.valid) return fail(res, 409, 'DIAGNOSTIC_INVALID', 'Không thể công bố dữ liệu chưa hợp lệ. Hãy sửa các lỗi trong phần validation.', validation.errors);
                const item = await repositories[modelName].updateById(req.params.id, { $set: { status: 'PUBLISHED' } });
                await audit(req, 'PUBLISH', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã publish diagnostic.');
            } catch (e) { return next(e); }
        });
        router.delete(`/admin/platform/${pathName}/:id`, guarded(permission), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã diagnostic không hợp lệ.'); const before = await models[modelName].findById(req.params.id).lean(); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy diagnostic.'); const item = await repositories[modelName].archiveById(req.params.id); await audit(req, 'ARCHIVE', modelName, req.params.id, before, item); return ok(res, item, 'Đã archive diagnostic.'); } catch (e) { return next(e); } });
    }

    router.get('/national-exam/blueprints', async (req, res, next) => { try { const filter = { status: req.query.status || 'PUBLISHED' }; if (req.query.year) filter.year = Number(req.query.year); if (req.query.subject) filter.subject = cleanText(req.query.subject, 80); return ok(res, await repositories.ExamBlueprint.list(filter, parsePage(req))); } catch (e) { return next(e); } });
    router.post('/national-exam/blueprints', guarded('learning.exam.create'), async (req, res, next) => { try { const body = req.body || {}; if (!body.code || !body.name || !body.version || !body.sourceType) return fail(res, 400, 'VALIDATION_ERROR', 'Blueprint cần code, name, version và sourceType.'); const item = await repositories.ExamBlueprint.create(body); await audit(req, 'CREATE', 'ExamBlueprint', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo exam blueprint.' }); } catch (e) { return next(e); } });

    async function handleWordImportPreview(req, res, body = {}) {
        const filename = cleanText(body.filename || 'noi-dung-nhap.md', 255);
        const extension = filename.toLowerCase().split('.').pop();
        const requestedType = String(body.targetType || 'AUTO').toUpperCase();
        const allowedTypes = ['AUTO','COURSE','LESSON','LECTURE','QUESTION','QUESTION_BANK','ASSESSMENT'];
        if (!allowedTypes.includes(requestedType)) return fail(res, 400, 'IMPORT_TARGET_INVALID', 'Loại nội dung nhập không được hỗ trợ.');
        let extractedText = String(body.contentText || body.text || '').slice(0, 240000);
        if (extension === 'docx' && body.base64) extractedText = extractDocxText(body.base64);
        else if (!extractedText && Array.isArray(body.rows)) extractedText = body.rows.map(row => row.prompt || '').join('\n');
        if (!['docx','md','markdown','txt','text'].includes(extension) && !Array.isArray(body.rows)) return fail(res, 400, 'IMPORT_FILE_UNSUPPORTED', 'Chỉ hỗ trợ tệp .docx, .md, .markdown hoặc .txt.');
        const parsed = parseLearningDocument({ text: extractedText, filename, targetType: requestedType === 'QUESTION' ? 'QUESTION_BANK' : requestedType });
        parsed.title = cleanText(body.title || parsed.title, 180) || 'Nội dung nhập mới';
        parsed.targetType = requestedType === 'AUTO' ? parsed.targetType : requestedType === 'QUESTION' ? 'QUESTION_BANK' : requestedType;
        const errors = [];
        const warnings = [...(parsed.warnings || [])];
        if (!parsed.extractedText) errors.push({ field: 'content', message: 'Không nhận diện được văn bản trong tài liệu.' });
        if (['QUESTION','QUESTION_BANK','ASSESSMENT'].includes(parsed.targetType) && !parsed.questions.length) errors.push({ field: 'questions', message: 'Không tìm thấy câu hỏi có cấu trúc. Dùng “Câu 1: Nội dung”, các lựa chọn “A. …”, và “Đáp án: A”.' });
        parsed.questions.forEach((question, index) => { if (!question.prompt) errors.push({ row: index + 1, field: 'prompt', message: 'Câu hỏi không có nội dung.' }); if (question.options.length && question.answer === undefined) warnings.push(`Câu ${index + 1} thiếu đáp án; bản nháp cần được rà soát trước khi công bố.`); });
        const metadata = {
            educationLevel: cleanText(body.educationLevel || '', 40), grade: Number(body.grade) >= 1 && Number(body.grade) <= 12 ? Number(body.grade) : null,
            subjectId: cleanText(body.subjectId || '', 100), courseCode: cleanText(body.courseCode || '', 120), assessmentType: cleanText(body.assessmentType || 'FREE_TEST', 30),
            durationMinutes: Math.min(300, Math.max(5, Number(body.durationMinutes) || 30)), passingScore: Math.min(100, Math.max(0, Number(body.passingScore) || 70))
        };
        const item = await repositories.WordImport.create({
            uploadedBy: req.session.user.username, filename, mimeType: cleanText(body.mimeType || (extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/markdown'), 120),
            size: Number(body.size) || Buffer.byteLength(extractedText, 'utf8'), targetType: parsed.targetType, status: errors.length ? 'REJECTED' : 'PREVIEWED',
            preview: { ...parsed, metadata, rows: parsed.questions.slice(0, 200), rowCount: parsed.questions.length }, validation: { errors, warnings: [...new Set(warnings)].slice(0, 100) }
        });
        return ok(res, { importId: item._id, status: item.status, filename, targetType: item.targetType, validation: item.validation, preview: item.preview }, errors.length ? 'Đã đọc tài liệu nhưng cần sửa lỗi trước khi lưu bản nháp.' : 'Đã nhận diện tài liệu. Kiểm tra nội dung trước khi lưu bản nháp.');
    }
    router.post('/admin/platform/word-imports/preview', guarded('learning.question.import'), async (req, res, next) => {
        try { return await handleWordImportPreview(req, res, req.body || {}); }
        catch (e) { return next(e); }
    });
    router.post('/admin/platform/word-imports/preview-docx', guarded('learning.question.import'), express.raw({ type: 'application/octet-stream', limit: '3mb' }), async (req, res, next) => {
        try {
            if (!Buffer.isBuffer(req.body) || !req.body.length) return fail(res, 400, 'IMPORT_FILE_EMPTY', 'Tệp Word rỗng hoặc chưa được gửi đúng định dạng.');
            const query = req.query || {};
            const body = { ...query, filename: cleanText(query.filename || req.get('x-import-filename') || 'tai-lieu.docx', 255), mimeType: cleanText(query.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 120), size: req.body.length, contentText: extractDocxText(req.body) };
            return await handleWordImportPreview(req, res, body);
        } catch (e) { return next(e); }
    });
    router.patch('/admin/platform/word-imports/:id/preview', guarded('learning.question.import'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã import không hợp lệ.');
            const item = await models.WordImport.findById(req.params.id);
            if (!item) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bản nhập.');
            if (!['PREVIEWED','REJECTED'].includes(item.status)) return fail(res, 409, 'IMPORT_LOCKED', 'Chỉ có thể sửa bản xem trước chưa commit.');
            const text = String(req.body?.contentText ?? item.preview?.extractedText ?? '').slice(0, 240000);
            const targetType = String(req.body?.targetType || item.targetType).toUpperCase();
            if (!['COURSE','LESSON','LECTURE','QUESTION_BANK','ASSESSMENT'].includes(targetType)) return fail(res, 400, 'IMPORT_TARGET_INVALID', 'Loại nội dung không hợp lệ.');
            const parsed = parseLearningDocument({ text, filename: item.filename, targetType });
            parsed.title = cleanText(req.body?.title || item.preview?.title || parsed.title, 180);
            parsed.targetType = targetType;
            const errors = [];
            const warnings = [...(parsed.warnings || [])];
            if (!parsed.extractedText) errors.push({ field: 'content', message: 'Nội dung không được để trống.' });
            if (['QUESTION_BANK','ASSESSMENT'].includes(targetType) && !parsed.questions.length) errors.push({ field: 'questions', message: 'Chưa nhận diện được câu hỏi.' });
            parsed.questions.forEach((question, index) => { if (question.options.length && question.answer === undefined) warnings.push(`Câu ${index + 1} chưa có đáp án.`); });
            const metadata = { ...(item.preview?.metadata || {}), ...(req.body?.metadata && typeof req.body.metadata === 'object' ? safePatch(req.body.metadata) : {}) };
            item.targetType = targetType;
            item.preview = { ...parsed, metadata, rows: parsed.questions.slice(0, 200), rowCount: parsed.questions.length };
            item.validation = { errors, warnings: [...new Set(warnings)].slice(0, 100) };
            item.status = errors.length ? 'REJECTED' : 'PREVIEWED';
            await item.save();
            return ok(res, { importId: item._id, status: item.status, targetType, validation: item.validation, preview: item.preview }, errors.length ? 'Bản xem trước còn lỗi.' : 'Đã cập nhật bản xem trước.');
        } catch (e) { return next(e); }
    });
    router.post('/admin/platform/word-imports/:id/commit', guarded('learning.question.import'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã import không hợp lệ.');
            const item = await models.WordImport.findById(req.params.id);
            if (!item) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy import.');
            if (item.status === 'COMMITTED') return ok(res, item, 'Import đã được commit trước đó.');
            if (item.status !== 'PREVIEWED' || item.validation?.errors?.length) return fail(res, 409, 'IMPORT_NOT_VALID', 'Import phải được preview và không có lỗi trước khi lưu bản nháp.');
            const preview = item.preview || {};
            const metadata = preview.metadata || {};
            const createdIds = [];
            const source = { sourceType: 'USER_IMPORTED', organization: 'Hành Trình Mới Admin', documentName: item.filename, version: '21.0.0', verification: 'unverified', notes: 'Nội dung do quản trị viên nhập/tải lên; chưa được xác minh là tài liệu official.' };
            const safeCode = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 72) || 'IMPORTED-CONTENT';
            const baseCode = safeCode(metadata.courseCode || preview.title);
            if (['QUESTION','QUESTION_BANK','ASSESSMENT'].includes(item.targetType)) {
                const rows = Array.isArray(preview.questions) ? preview.questions : Array.isArray(preview.rows) ? preview.rows : [];
                if (!rows.length) return fail(res, 409, 'IMPORT_QUESTIONS_MISSING', 'Không có câu hỏi để lưu.');
                for (let index = 0; index < rows.length; index += 1) {
                    const row = rows[index];
                    const code = `${baseCode}-${String(item._id).slice(-6).toUpperCase()}-Q${index + 1}`;
                    const question = await models.Question.findOneAndUpdate({ code }, { $setOnInsert: {
                        code, prompt: cleanText(row.prompt, 5000), type: row.type || (row.options?.length ? 'single_choice' : 'short_answer'), options: (row.options || []).slice(0, 20).map(normalizeQuestionOption),
                        answer: row.answer, acceptedAnswers: Array.isArray(row.acceptedAnswers) ? row.acceptedAnswers : [], explanation: cleanText(row.explanation, 3000), rubric: row.rubric || {}, points: Number(row.points) > 0 ? Number(row.points) : 1,
                        difficulty: row.difficulty || 'MEDIUM', cognitiveLevel: row.cognitiveLevel || 'APPLY', skill: row.skill || metadata.subjectId || preview.title, grade: metadata.grade || null, educationLevel: metadata.educationLevel || undefined,
                        subjectId: metadata.subjectId || '', tags: ['USER_IMPORTED', item.targetType, item.filename], status: 'DRAFT', source
                    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                    createdIds.push(question._id);
                }
                if (item.targetType === 'ASSESSMENT') {
                    const curriculumVersion = await models.CurriculumVersion.findOne({ code: 'HTM-CATALOG-V20', version: '1' }).lean() || await models.CurriculumVersion.findOne({ status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
                    const assessmentCode = `${baseCode}-${String(item._id).slice(-6).toUpperCase()}`;
                    const questionIds = createdIds.slice();
                    const assessment = await models.Assessment.findOneAndUpdate({ code: assessmentCode }, { $setOnInsert: {
                        code: assessmentCode, title: preview.title || item.filename, assessmentType: ['LESSON_TEST','CHAPTER_TEST','MIDTERM','FINAL','MOCK','DIAGNOSTIC','FREE_TEST'].includes(metadata.assessmentType) ? metadata.assessmentType : 'FREE_TEST',
                        educationLevel: metadata.educationLevel || undefined, grade: metadata.grade || null, curriculumVersionId: curriculumVersion?._id || undefined, subjectId: metadata.subjectId || '', questionIds, questionPool: questionIds,
                        sections: [{ code: 'IMPORTED', title: preview.title || item.filename, questionIds }], durationSeconds: (Number(metadata.durationMinutes) || 30) * 60, attemptLimit: 3, passingScore: Number(metadata.passingScore) || 70,
                        randomization: { enabled: true, mode: 'question' }, scoring: { method: 'mixed_percentage', maxScore: 100, manualReviewTypes: ['essay','speaking','practical','coding'] }, reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true }, version: '1', publicationStatus: 'DRAFT', sourceRef: source
                    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                    createdIds.push(assessment._id);
                }
            } else if (item.targetType === 'COURSE') {
                const curriculumVersion = await models.CurriculumVersion.findOne({ code: 'HTM-CATALOG-V20', version: '1' }).lean() || await models.CurriculumVersion.findOne({ status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
                if (!curriculumVersion) return fail(res, 409, 'CURRICULUM_VERSION_MISSING', 'Chưa có phiên bản chương trình học để gắn khóa mới. Chạy migration catalog trước.');
                const courseCode = `${baseCode}-${String(item._id).slice(-6).toUpperCase()}`;
                const inferredLevel = metadata.grade ? Number(metadata.grade) <= 5 ? 'PRIMARY' : Number(metadata.grade) <= 9 ? 'SECONDARY_LOWER' : 'SECONDARY_UPPER' : 'HIGHER_EDUCATION';
                const course = await models.Course.findOneAndUpdate({ code: courseCode }, { $setOnInsert: {
                    code: courseCode, name: preview.title || item.filename, description: cleanText(preview.extractedText, 3000), curriculumVersionId: curriculumVersion._id,
                    educationLevel: metadata.educationLevel || inferredLevel, grade: metadata.grade || null, subjectId: metadata.subjectId || '', category: metadata.grade ? 'GENERAL_EDUCATION' : 'MAJOR_FOUNDATION',
                    objectives: (preview.sections || []).filter(section => /mục tiêu|objective|outcome/i.test(section.title)).map(section => section.content || section.title).slice(0, 8), syllabus: { overview: cleanText(preview.extractedText, 12000), sections: (preview.sections || []).slice(0, 80), importedFrom: item.filename, wordCount: preview.wordCount || 0 },
                    sourceRef: source, kind: 'AI_DRAFT', contentCompleteness: Math.min(75, Math.round((preview.wordCount || 0) / 20)), status: 'DRAFT'
                } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                createdIds.push(course._id);
                const sections = (preview.sections || []).filter(section => String(section.content || '').trim());
                const unitRows = sections.map((section, index) => ({ section, index })).filter(row => /^(chương|chapter|unit|module)\b/i.test(String(row.section.title || '').trim()) && (row.section.level || 0) >= 2);
                const units = new Map();
                for (const row of unitRows) {
                    const code = `${courseCode}-U${row.index + 1}`.slice(0, 120);
                    const unit = await models.CurriculumContent.findOneAndUpdate({ curriculumVersionId: curriculumVersion._id, type: 'UNIT', code }, { $setOnInsert: {
                        curriculumVersionId: curriculumVersion._id, type: 'UNIT', code, title: row.section.title, description: cleanText(row.section.content, 900), courseId: course._id,
                        grade: metadata.grade || null, educationLevel: metadata.educationLevel || inferredLevel, subjectId: metadata.subjectId || '', theory: row.section.content, theorySections: [{ title: row.section.title, content: row.section.content }],
                        status: 'DRAFT', sourceRef: source, payload: { importedFilename: item.filename, importedFromCourse: course.code }
                    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                    units.set(row.index, unit); createdIds.push(unit._id);
                }
                const lessonRows = sections.map((section, index) => ({ section, index })).filter(row => /^(bài|lesson|part)\b/i.test(String(row.section.title || '').trim()) || (row.section.level || 0) >= 3);
                for (const row of lessonRows) {
                    const parent = [...unitRows].reverse().find(unitRow => unitRow.index < row.index);
                    const code = `${courseCode}-L${row.index + 1}`.slice(0, 120);
                    const lesson = await models.CurriculumContent.findOneAndUpdate({ curriculumVersionId: curriculumVersion._id, type: 'LESSON', code }, { $setOnInsert: {
                        curriculumVersionId: curriculumVersion._id, type: 'LESSON', code, title: row.section.title, description: cleanText(row.section.content, 900), courseId: course._id, parentId: parent ? units.get(parent.index)?._id || null : null,
                        grade: metadata.grade || null, educationLevel: metadata.educationLevel || inferredLevel, subjectId: metadata.subjectId || '', theory: row.section.content, theorySections: [{ title: row.section.title, content: row.section.content }],
                        examples: /ví dụ|example/i.test(row.section.title) ? [{ title: row.section.title, content: row.section.content }] : [], activities: /luyện tập|thực hành|practice|activity/i.test(row.section.title) ? [{ title: row.section.title, content: row.section.content }] : [],
                        knowledge: [row.section.title], skills: metadata.subjectId ? [metadata.subjectId] : [], estimatedMinutes: Math.max(15, Math.min(240, Math.ceil((String(row.section.content || '').split(/\s+/).filter(Boolean).length || 300) / 150) * 5)), difficulty: 'MEDIUM', status: 'DRAFT', sourceRef: source,
                        payload: { importedFilename: item.filename, courseId: course._id, wordCount: String(row.section.content || '').split(/\s+/).filter(Boolean).length }
                    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                    createdIds.push(lesson._id);
                }
                if (!lessonRows.length) {
                    const code = `${courseCode}-L1`.slice(0, 120);
                    const lesson = await models.CurriculumContent.findOneAndUpdate({ curriculumVersionId: curriculumVersion._id, type: 'LESSON', code }, { $setOnInsert: {
                        curriculumVersionId: curriculumVersion._id, type: 'LESSON', code, title: preview.title || item.filename, description: cleanText(preview.extractedText, 900), courseId: course._id,
                        grade: metadata.grade || null, educationLevel: metadata.educationLevel || inferredLevel, subjectId: metadata.subjectId || '', theory: preview.extractedText, theorySections: sections.map(section => ({ title: section.title, content: section.content })).slice(0, 80),
                        examples: sections.filter(section => /ví dụ|example/i.test(section.title)).map(section => ({ title: section.title, content: section.content })).slice(0, 20), activities: sections.filter(section => /luyện tập|thực hành|practice|activity/i.test(section.title)).map(section => ({ title: section.title, content: section.content })).slice(0, 20),
                        knowledge: sections.map(section => section.title).slice(0, 40), skills: metadata.subjectId ? [metadata.subjectId] : [], estimatedMinutes: Math.max(15, Math.min(240, Math.ceil((preview.wordCount || 300) / 150) * 5)), difficulty: 'MEDIUM', status: 'DRAFT', sourceRef: source,
                        payload: { importedFilename: item.filename, courseId: course._id, wordCount: preview.wordCount || 0 }
                    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                    createdIds.push(lesson._id);
                }
            } else if (['LESSON','LECTURE'].includes(item.targetType)) {
                const curriculumVersion = await models.CurriculumVersion.findOne({ code: 'HTM-CATALOG-V20', version: '1' }).lean() || await models.CurriculumVersion.findOne({ status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
                if (!curriculumVersion) return fail(res, 409, 'CURRICULUM_VERSION_MISSING', 'Chưa có phiên bản chương trình học để lưu bài. Chạy migration catalog trước.');
                let course = null;
                if (metadata.courseCode) course = await models.Course.findOne({ code: metadata.courseCode }).lean();
                const lessonCode = `${baseCode}-${String(item._id).slice(-6).toUpperCase()}`;
                const lesson = await models.CurriculumContent.findOneAndUpdate({ curriculumVersionId: curriculumVersion._id, type: 'LESSON', code: lessonCode }, { $setOnInsert: {
                    curriculumVersionId: curriculumVersion._id, type: 'LESSON', code: lessonCode, title: preview.title || item.filename, description: cleanText(preview.extractedText.slice(0, 900), 900), courseId: course?._id || null,
                    grade: metadata.grade || null, educationLevel: metadata.educationLevel || undefined, subjectId: metadata.subjectId || '', objectives: (preview.sections || []).filter(section => /mục tiêu|objective/i.test(section.title)).map(section => section.content).filter(Boolean).slice(0, 5),
                    theory: preview.extractedText, theorySections: (preview.sections || []).map(section => ({ title: section.title, content: section.content })), examples: (preview.sections || []).filter(section => /ví dụ|example/i.test(section.title)).map(section => ({ title: section.title, content: section.content })),
                    activities: (preview.sections || []).filter(section => /luyện tập|thực hành|practice|activity/i.test(section.title)).map(section => ({ title: section.title, content: section.content })), knowledge: (preview.sections || []).map(section => section.title).slice(0, 40),
                    skills: metadata.subjectId ? [metadata.subjectId] : [], estimatedMinutes: Math.max(15, Math.min(240, Math.ceil((preview.wordCount || 300) / 150) * 5)), difficulty: 'MEDIUM', status: 'DRAFT', sourceRef: source,
                    payload: { importedContentType: item.targetType, lectureScript: item.targetType === 'LECTURE' ? preview.extractedText : '', courseId: course?._id || null, importedFilename: item.filename, wordCount: preview.wordCount || 0 }
                } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                createdIds.push(lesson._id);
            }
            item.committedEntityIds = createdIds;
            item.status = 'COMMITTED';
            await item.save();
            await audit(req, 'IMPORT', 'WordImport', item._id, null, item.toObject());
            return ok(res, { import: item, createdEntityIds: createdIds, targetType: item.targetType }, 'Đã lưu nội dung thành bản nháp. Hãy kiểm tra và công bố từ CMS khi sẵn sàng.');
        } catch (e) { return next(e); }
    });

    router.get('/notifications', requireAuth, async (req, res, next) => { try { const username = req.session.user.username; const filter = { $or: [{ recipient: username }, { recipient: 'BROADCAST' }] }; if (req.query.unread === 'true') filter.$and = [{ $or: [{ recipient: username, read: false }, { recipient: 'BROADCAST', readBy: { $ne: username } }] }]; const result = await repositories.PlatformNotification.list(filter, parsePage(req)); if (Array.isArray(result.items)) result.items = result.items.map(item => item.recipient === 'BROADCAST' ? { ...item, read: Array.isArray(item.readBy) && item.readBy.includes(username) } : item); return ok(res, result); } catch (e) { return next(e); } });
    router.patch('/notifications/:id/read', requireAuth, async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã notification không hợp lệ.'); const username = req.session.user.username; const current = await models.PlatformNotification.findOne({ _id: req.params.id, recipient: { $in: [username, 'BROADCAST'] } }).lean(); if (!current) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy notification.'); const update = current.recipient === 'BROADCAST' ? { $addToSet: { readBy: username } } : { $set: { read: true } }; const item = await models.PlatformNotification.findByIdAndUpdate(req.params.id, update, { new: true }).lean(); if (item?.recipient === 'BROADCAST') item.read = true; return ok(res, item, 'Đã đánh dấu notification đã đọc.'); } catch (e) { return next(e); } });
    router.patch('/notifications/read-all', requireAuth, async (req, res, next) => { try { const username = req.session.user.username; const personal = await models.PlatformNotification.updateMany({ recipient: username, read: false }, { $set: { read: true } }); const broadcast = await models.PlatformNotification.updateMany({ recipient: 'BROADCAST', readBy: { $ne: username } }, { $addToSet: { readBy: username } }); return ok(res, { modifiedCount: (personal.modifiedCount || 0) + (broadcast.modifiedCount || 0) }, 'Đã đánh dấu các notification là đã đọc.'); } catch (e) { return next(e); } });
    router.post('/admin/platform/notifications', guarded('notification.manage'), async (req, res, next) => { try { const body = req.body || {}; if (!body.title || !body.message) return fail(res, 400, 'VALIDATION_ERROR', 'Thông báo cần title và message.'); const recipient = body.recipient === 'BROADCAST' ? 'BROADCAST' : cleanText(body.recipient, 80); if (!recipient) return fail(res, 400, 'VALIDATION_ERROR', 'Notification cần recipient hoặc BROADCAST.'); const item = await repositories.PlatformNotification.create({ recipient, type: cleanText(body.type, 40), title: cleanText(body.title, 120), message: cleanText(body.message, 2000), priority: cleanText(body.priority, 20), data: safePatch(body.data && typeof body.data === 'object' ? body.data : {}) }); await audit(req, 'CREATE', 'PlatformNotification', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo notification.' }); } catch (e) { return next(e); } });
    router.post('/gamification/events', requireAuth, async (req, res, next) => { try { const body = req.body || {}; const username = req.session.user.username; const eventType = cleanText(body.eventType, 80); const idempotencyKey = cleanText(body.idempotencyKey, 160); if (!eventType || !idempotencyKey) return fail(res, 400, 'VALIDATION_ERROR', 'Event cần eventType và idempotencyKey.'); const existing = await models.GamificationEvent.findOne({ username, idempotencyKey }); if (existing) return ok(res, existing, 'Event đã được ghi nhận trước đó.'); const item = await models.GamificationEvent.create({ eventType, idempotencyKey, referenceId: cleanText(body.referenceId, 160), payload: body.payload && typeof body.payload === 'object' ? body.payload : {}, username }); const achievements = await models.Achievement.find({ status: 'ACTIVE', event: eventType }).lean(); const unlocked = []; const grants = []; const notifications = []; for (const achievement of achievements) { const alreadyUnlocked = await models.UserAchievement.exists({ username, achievementId: achievement._id }); if (alreadyUnlocked) continue; const requiredCount = Math.max(1, Number(achievement.rule?.count) || 1); const eventCount = await models.GamificationEvent.countDocuments({ username, eventType }); if (eventCount < requiredCount) continue; const unlockedAchievement = await models.UserAchievement.create({ username, achievementId: achievement._id, evidence: { eventType, eventId: item._id, eventCount } }); unlocked.push(unlockedAchievement); notifications.push(await notifyOnce(models.PlatformNotification, { recipient: username, type: 'achievement', title: `Đã mở thành tựu: ${achievement.name}`, message: achievement.description || 'Bạn vừa mở một thành tựu mới.', priority: 'NORMAL', referenceId: `achievement:${achievement._id}`, data: { achievementId: achievement._id, eventId: item._id } })); const rewardCode = cleanText(achievement.rule?.rewardCode, 120); if (rewardCode) { const reward = await models.Reward.findOne({ code: rewardCode, status: 'ACTIVE' }).lean(); if (reward) { const grant = await models.RewardGrant.create({ username, rewardId: reward._id, sourceEvent: String(item._id), amount: Number(reward.amount) || 0, metadata: { achievementId: achievement._id, rewardType: reward.type || '' } }); grants.push(grant); notifications.push(await notifyOnce(models.PlatformNotification, { recipient: username, type: 'reward', title: `Bạn nhận được phần thưởng: ${reward.name}`, message: `Phần thưởng đã được ghi nhận${reward.amount ? ` với giá trị ${reward.amount}` : ''}.`, priority: 'NORMAL', referenceId: `reward:${grant._id}`, data: { rewardId: reward._id, grantId: grant._id } })); } } } item.processedAt = new Date(); await item.save(); return res.status(201).json({ success: true, data: { event: item, unlocked, grants, notifications: notifications.filter(Boolean) }, message: 'Đã ghi nhận và xử lý gamification event.' }); } catch (e) { if (e?.code === 11000) { const existing = await models.GamificationEvent.findOne({ username: req.session.user.username, idempotencyKey: cleanText(req.body?.idempotencyKey, 160) }).lean(); if (existing) return ok(res, existing, 'Event đã được ghi nhận trước đó.'); } return next(e); } });
    router.get('/gamification/achievements', requireAuth, async (req, res, next) => { try { const [catalog, unlocked] = await Promise.all([models.Achievement.find({ status: 'ACTIVE' }).lean(), models.UserAchievement.find({ username: req.session.user.username }).lean()]); return ok(res, { catalog, unlocked }); } catch (e) { return next(e); } });
    router.get('/learning-platform/rules', async (req, res, next) => { try { return ok(res, await repositories.LearningPathRule.list({ status: 'ACTIVE' }, parsePage(req))); } catch (e) { return next(e); } });
    router.post('/admin/platform/learning-path-rules', guarded('learning.path.manage'), async (req, res, next) => { try { const body = req.body || {}; if (!body.code || !body.version || !body.sourceRef) return fail(res, 400, 'VALIDATION_ERROR', 'Learning path rule cần code, version và sourceRef.'); const item = await repositories.LearningPathRule.create(body); await audit(req, 'CREATE', 'LearningPathRule', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo learning path rule version.' }); } catch (e) { return next(e); } });

    const cmsResources = [
        ['CurriculumVersion', 'education/curriculum-versions', 'learning.curriculum.manage'],
        ['CurriculumContent', 'education/curriculum-content', 'learning.lesson.update'],
        ['Course', 'education/courses', 'learning.curriculum.manage'],
        ['Question', 'question-bank/questions', 'learning.question.update'],
        ['Assessment', 'assessment/assessments', 'learning.exam.create'],
        ['ExamBlueprint', 'national-exam/blueprints', 'learning.exam.create'],
        ['LearningPathRule', 'learning-path-rules', 'learning.path.manage']
    ];
    for (const [modelName, pathName, permission] of cmsResources) {
        router.get(`/admin/platform/${pathName}`, guarded(permission), async (req, res, next) => {
            try {
                const filter = {};
                if (req.query.status) filter[modelName === 'Assessment' ? 'publicationStatus' : 'status'] = cleanText(req.query.status, 30);
                if (req.query.grade) filter.grade = Number(req.query.grade);
                if (req.query.search) {
                    const search = cleanText(req.query.search, 100);
                    filter.$or = [{ code: new RegExp(search, 'i') }, { title: new RegExp(search, 'i') }, { name: new RegExp(search, 'i') }];
                }
                return ok(res, await repositories[modelName].list(filter, parsePage(req), modelName === 'Question' ? '-answer -acceptedAnswers -rubric' : null));
            } catch (e) { return next(e); }
        });
        router.post(`/admin/platform/${pathName}`, guarded(permission), async (req, res, next) => {
            try {
                const body = safePatch(req.body || {});
                const required = modelName === 'CurriculumVersion'
                    ? body.code && body.version
                    : modelName === 'CurriculumContent'
                        ? body.code && body.title && body.curriculumVersionId
                        : modelName === 'Course'
                            ? body.code && body.name && (body.programId || body.curriculumVersionId || (body.grade >= 1 && body.grade <= 12))
                            : modelName === 'Question'
                                ? body.code && body.type && body.prompt
                                : body.code && body.title;
                if (!required) return fail(res, 400, 'VALIDATION_ERROR', `Dữ liệu ${pathName} chưa đủ trường bắt buộc.`);
                const item = await repositories[modelName].create(body);
                await audit(req, 'CREATE', modelName, item._id, null, item.toObject());
                return res.status(201).json({ success: true, data: item, message: `Đã tạo dữ liệu ${pathName}.` });
            } catch (e) { return next(e); }
        });
        router.patch(`/admin/platform/${pathName}/:id`, guarded(permission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu không hợp lệ.');
                const before = await models[modelName].findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
                const changes = safePatch(req.body || {});
                delete changes._id; delete changes.createdAt; delete changes.updatedAt;
                if (modelName === 'Course') {
                    if (changes.code) {
                        changes.code = safeSlug(changes.code);
                        const duplicateCode = await models.Course.findOne({ _id: { $ne: before._id }, code: changes.code, status: { $nin: ['ARCHIVED','DELETED'] } }).lean();
                        if (duplicateCode) return fail(res, 409, 'DUPLICATE_COURSE_CODE', 'Mã khóa này đã được sử dụng.', { id: String(duplicateCode._id), name: duplicateCode.name });
                    }
                    const nextProgramId = changes.trainingProgramId ?? changes.programId;
                    if (nextProgramId !== undefined) {
                        if (nextProgramId && !isObjectId(nextProgramId)) return fail(res, 400, 'COURSE_PROGRAM_INVALID', 'Chương trình đào tạo đã chọn không hợp lệ.');
                        const program = nextProgramId ? await models.TrainingProgram.findOne({ _id: nextProgramId, status: { $nin: ['ARCHIVED','DELETED'] } }).lean() : null;
                        if (nextProgramId && !program) return fail(res, 400, 'COURSE_PROGRAM_NOT_FOUND', 'Không tìm thấy chương trình đào tạo đã chọn.');
                        changes.programId = program?._id || null; changes.trainingProgramId = program?._id || null;
                        changes.institutionId = program?.institutionId || null; changes.facultyId = program?.facultyId || null;
                        changes.majorId = program?.majorId || null; changes.specializationId = program?.specializationId || null;
                    }
                }
                const item = await repositories[modelName].updateById(req.params.id, { $set: changes });
                await audit(req, 'UPDATE', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã cập nhật dữ liệu CMS.');
            } catch (e) { return next(e); }
        });
        const publishPermission = modelName === 'CurriculumContent' ? 'learning.lesson.publish' : modelName === 'Question' ? 'learning.question.update' : modelName === 'Assessment' || modelName === 'ExamBlueprint' ? 'learning.exam.publish' : permission;
        router.post(`/admin/platform/${pathName}/:id/publish`, guarded(publishPermission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu không hợp lệ.');
                const before = await models[modelName].findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
                const statusField = modelName === 'Assessment' ? 'publicationStatus' : 'status';
                const publishedStatus = ['LearningPathRule', 'Course'].includes(modelName) ? 'ACTIVE' : 'PUBLISHED';
                if (modelName === 'Course') {
                    if (before.kind === 'PERSONAL_AI' || before.ownerUsername) return fail(res, 409, 'PERSONAL_COURSE_PRIVATE', 'Khóa học cá nhân không thể công bố vào catalog chung. Hãy tạo bản canonical mới sau khi rà soát.');
                    const [lessons, publishedAssessments] = await Promise.all([
                        models.CurriculumContent.find({ courseId: before._id, type: 'LESSON', status: { $nin: ['ARCHIVED', 'DELETED'] } }).select('title theory theorySections examples activities payload skills').lean(),
                        models.Assessment.find({ courseId: before._id, publicationStatus: { $in: ['PUBLISHED', 'ACTIVE'] } }).select('_id title questionIds').lean()
                    ]);
                    if (!lessons.length) return fail(res, 409, 'COURSE_NO_LESSONS', 'Chưa thể công bố khóa học: hãy tạo ít nhất một bài học có nội dung.');
                    const lessonIssues = lessons.map(lesson => {
                        const theory = Array.isArray(lesson.theorySections) ? lesson.theorySections.map(section => section.content || '').join(' ') : (lesson.theory || '');
                        const words = String(theory).trim().split(/\s+/).filter(Boolean).length;
                        const hasPractice = (lesson.activities || []).length > 0 || Boolean(lesson.payload?.practical?.instructions || lesson.payload?.practice?.length);
                        const hasExamples = (lesson.examples || []).length > 0;
                        return { title: lesson.title, words, theorySections: (lesson.theorySections || []).length, hasPractice, hasExamples, valid: words >= 80 && (lesson.theorySections || []).filter(section => String(section.content || '').trim()).length >= 2 && (hasPractice || hasExamples) };
                    }).filter(item => !item.valid);
                    if (lessonIssues.length) return fail(res, 409, 'COURSE_LESSON_QUALITY_GATE', 'Có bài học còn quá ngắn hoặc thiếu ví dụ/thực hành. Hãy sửa các bài được liệt kê trước khi công bố.', lessonIssues.slice(0, 20));
                    if (!publishedAssessments.length) return fail(res, 409, 'COURSE_TEST_REQUIRED', 'Khóa học cần có ít nhất một bài kiểm tra đã công bố. Tạo đề, kiểm tra đáp án/rubric rồi công bố đề trước.');
                    const completeness = Math.round(100 * (Number(lessons.length > 0) + Number(lessons.every(lesson => String(lesson.theory || '').trim() || (lesson.theorySections || []).length >= 2)) + Number(lessons.every(lesson => (lesson.activities || []).length || (lesson.examples || []).length)) + Number(publishedAssessments.length > 0)) / 4);
                    const item = await repositories[modelName].updateById(req.params.id, { $set: { [statusField]: publishedStatus, contentCompleteness: Math.min(100, completeness), kind: before.kind === 'PERSONAL_AI' ? 'PERSONAL_AI' : before.kind === 'AI_DRAFT' ? 'CANONICAL' : (before.kind || 'CANONICAL') } });
                    await audit(req, 'PUBLISH', modelName, req.params.id, before, item);
                    return ok(res, item, 'Khóa học đã qua quality gate và được công bố. Nội dung vẫn giữ source/provenance; không tự động trở thành OFFICIAL.');
                }
                if (modelName === 'Assessment') {
                    const questionIds = Array.isArray(before.questionIds) ? before.questionIds : [];
                    if (!questionIds.length) return fail(res, 409, 'ASSESSMENT_EMPTY', 'Không thể công bố bài kiểm tra chưa có câu hỏi.');
                    const questions = await models.Question.find({ _id: { $in: questionIds } }).lean();
                    if (questions.length !== questionIds.length || questions.some(question => !String(question.prompt || '').trim())) return fail(res, 409, 'ASSESSMENT_QUESTIONS_INVALID', 'Bài kiểm tra có câu hỏi thiếu hoặc không hợp lệ. Hãy sửa bản nháp trước khi công bố.');
                    const needsAnswer = questions.filter(question => ['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'numerical', 'matching', 'ordering'].includes(String(question.type || '').toLowerCase()));
                    if (needsAnswer.some(question => question.answer === undefined || question.answer === null || (Array.isArray(question.answer) && !question.answer.length) || (!Array.isArray(question.answer) && String(question.answer).trim() === ''))) return fail(res, 409, 'ASSESSMENT_ANSWER_MISSING', 'Có câu trắc nghiệm/khách quan chưa khai báo đáp án.');
                    const noRubric = questions.filter(question => ['essay','speaking','practical','coding'].includes(String(question.type || '').toLowerCase()) && !Object.keys(question.rubric || {}).length);
                    if (noRubric.length) return fail(res, 409, 'ASSESSMENT_RUBRIC_MISSING', 'Câu tự luận/nói/thực hành/coding cần có rubric chấm trước khi công bố.', noRubric.map(question => ({ code: question.code, type: question.type })));
                    const noCodingTests = questions.filter(question => String(question.type || '').toLowerCase() === 'coding' && (!question.media?.coding?.starterCode || !Array.isArray(question.media?.coding?.visibleTestCases) || !question.media.coding.visibleTestCases.length));
                    if (noCodingTests.length) return fail(res, 409, 'ASSESSMENT_CODING_TESTS_MISSING', 'Câu coding cần starter code và ít nhất một test công khai.', noCodingTests.map(question => question.code));
                    await models.Question.updateMany({ _id: { $in: questionIds }, status: { $ne: 'PUBLISHED' } }, { $set: { status: 'PUBLISHED' } });
                }
                const item = await repositories[modelName].updateById(req.params.id, { $set: { [statusField]: publishedStatus } });
                await audit(req, 'PUBLISH', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã kiểm tra hợp lệ và công bố dữ liệu CMS.');
            } catch (e) { return next(e); }
        });
        router.delete(`/admin/platform/${pathName}/:id`, guarded(permission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu không hợp lệ.');
                const before = await models[modelName].findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
                const statusField = modelName === 'Assessment' ? 'publicationStatus' : 'status';
                const item = await repositories[modelName].archiveById(req.params.id, statusField);
                await audit(req, 'ARCHIVE', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã archive dữ liệu; không xóa vật lý.');
            } catch (e) { return next(e); }
        });
    }

    router.post('/admin/platform/sources', guarded('system.manage'), async (req, res, next) => { try { const item = await repositories.SourceRegistry.create(req.body || {}); await audit(req, 'CREATE', 'SourceRegistry', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: item, message: 'Đã tạo source registry entry.' }); } catch (e) { return next(e); } });
    router.get('/admin/platform/sources', guarded('system.audit.read'), async (req, res, next) => { try { return ok(res, await repositories.SourceRegistry.list({}, parsePage(req))); } catch (e) { return next(e); } });
    router.patch('/admin/platform/sources/:id', guarded('system.manage'), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã source không hợp lệ.'); const before = await models.SourceRegistry.findById(req.params.id).lean(); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy source registry entry.'); const changes = safePatch(req.body || {}); delete changes._id; delete changes.createdAt; delete changes.updatedAt; const item = await repositories.SourceRegistry.updateById(req.params.id, { $set: changes }); await audit(req, 'UPDATE', 'SourceRegistry', req.params.id, before, item); return ok(res, item, 'Đã cập nhật source registry entry.'); } catch (e) { return next(e); } });
    router.post('/admin/platform/sources/:id/verify', guarded('system.manage'), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã source không hợp lệ.'); const verification = ['unverified', 'title_verified', 'full_text_verified'].includes(req.body?.verification) ? req.body.verification : null; if (!verification) return fail(res, 400, 'VALIDATION_ERROR', 'verification không hợp lệ.'); const before = await models.SourceRegistry.findById(req.params.id).lean(); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy source registry entry.'); const item = await repositories.SourceRegistry.updateById(req.params.id, { $set: { verification, verifiedAt: new Date() } }); await audit(req, 'VERIFY', 'SourceRegistry', req.params.id, before, item); return ok(res, item, 'Đã cập nhật trạng thái xác minh source.'); } catch (e) { return next(e); } });
    router.delete('/admin/platform/sources/:id', guarded('system.manage'), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã source không hợp lệ.'); const before = await models.SourceRegistry.findById(req.params.id).lean(); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy source registry entry.'); const item = await repositories.SourceRegistry.archiveById(req.params.id); await audit(req, 'ARCHIVE', 'SourceRegistry', req.params.id, before, item); return ok(res, item, 'Đã archive source registry entry.'); } catch (e) { return next(e); } });
    router.get('/admin/platform/audit-logs', guarded('system.audit.read'), async (req, res, next) => { try { const filter = {}; for (const key of ['action', 'entityType', 'actorUsername']) if (req.query[key]) filter[key] = cleanText(req.query[key], 100); return ok(res, await repositories.AuditLog.list(filter, parsePage(req))); } catch (e) { return next(e); } });

    // Phase 3: admin-friendly CMS, local-first Course Factory and Autopilot.
    // This engine is project-specific and does not call a remote AI provider.
    async function ensureFactoryCurriculum(educationLevel, grade) {
        const level = cleanText(educationLevel || 'HIGHER_EDUCATION', 40).toUpperCase();
        const scope = grade ? `G${Number(grade)}` : 'ALL';
        const code = `HTM-LOCAL-AI-${level}-${scope}`.replace(/[^A-Z0-9-]/g, '-');
        let version = await models.CurriculumVersion.findOne({ code, version: '1' });
        if (!version) version = await models.CurriculumVersion.create({ code, version: '1', status: 'DRAFT', educationLevel: level, grades: grade ? [Number(grade)] : [], objectives: ['Nội dung khởi tạo qua Local Education AI; cần quản trị viên rà soát.'], metadata: { sourceType: 'AI_GENERATED', official: false, engine: 'LOCAL_EDUCATION_AI' }, sourceRef: { sourceType: 'AI_GENERATED', organization: 'Hành Trình Mới', documentName: 'Local Education AI', verification: 'unverified', notes: 'Bản nháp do bộ máy quy tắc nội bộ tạo; không phải chương trình chính thức.' } });
        return version;
    }
    function normalizeAdminQuestion(question, context = {}) {
        const type = String(question.type || 'single_choice').toLowerCase();
        const options = Array.isArray(question.options) ? question.options.slice(0, 12).map((option, index) => option && typeof option === 'object' ? option : ({ label: String(option), value: String(option).slice(0, 100) })) : [];
        return {
            code: cleanText(question.code || `ADMIN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`, 100),
            prompt: cleanText(question.prompt, 5000), type, options, answer: question.answer,
            acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers.slice(0, 40) : [],
            explanation: cleanText(question.explanation, 5000), rubric: safePatch(question.rubric || {}), media: safePatch(question.media || {}),
            points: Math.min(100, Math.max(0.25, Number(question.points) || 1)), difficulty: cleanText(question.difficulty || 'MEDIUM', 30),
            cognitiveLevel: cleanText(question.cognitiveLevel || 'APPLY', 30), skill: cleanText(question.skill || context.subjectId || 'Kiến thức', 160),
            tags: Array.isArray(question.tags) ? question.tags.map(tag => cleanText(tag, 80)).filter(Boolean).slice(0, 30) : [],
            educationLevel: context.educationLevel, grade: context.grade || null, subjectId: cleanText(context.subjectId || '', 120),
            courseId: context.courseId || null, lessonId: context.lessonId || null, status: 'DRAFT',
            source: { sourceType: 'ADMIN_CREATED', organization: 'Hành Trình Mới Admin', documentName: 'Admin Content Studio', verification: 'unverified', notes: 'Nội dung do quản trị viên tạo; không tự nhận là đề thi/tài liệu official.' }
        };
    }
    function safeSlug(value) { return localAiSlug(value, 70).replace(/^-+|-+$/g, '') || `CONTENT-${Date.now().toString(36).toUpperCase()}`; }

    router.get('/admin/platform/course-factory/guide', guarded('learning.ai.manage'), async (req, res) => ok(res, buildAdminGuide()));
    router.post('/admin/platform/course-factory/audit-v38', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const courses = await models.Course.find({ status: { $nin: ['ARCHIVED', 'DELETED'] } }).select('code name title educationLevel grade subjectId status').limit(5000).lean();
            const ids = courses.map(course => course._id);
            const [lessons, questions, assessments] = await Promise.all([
                models.CurriculumContent.find({ courseId: { $in: ids }, type: 'LESSON', status: { $nin: ['ARCHIVED', 'DELETED'] } }).lean(),
                models.Question.find({ courseId: { $in: ids }, status: { $nin: ['ARCHIVED', 'DELETED'] } }).lean(),
                models.Assessment.find({ courseId: { $in: ids }, publicationStatus: { $nin: ['ARCHIVED', 'DELETED'] } }).lean()
            ]);
            const reports = courses.map(course => auditStoredCourseV38({ course, lessons: lessons.filter(item => String(item.courseId) === String(course._id)), questions: questions.filter(item => String(item.courseId) === String(course._id)), assessments: assessments.filter(item => String(item.courseId) === String(course._id)) })).sort((a, b) => a.score - b.score);
            const summary = { coursesScanned: reports.length, healthy: reports.filter(item => item.status === 'HEALTHY').length, needsRepair: reports.filter(item => item.status === 'NEEDS_REPAIR').length, review: reports.filter(item => item.status === 'REVIEW').length, highSeverityIssues: reports.reduce((sum, item) => sum + item.issues.filter(issue => issue.severity === 'HIGH').length, 0), totalIssues: reports.reduce((sum, item) => sum + item.issueCount, 0) };
            await audit(req, 'COURSE_CATALOG_AUDIT_V38', 'CourseCatalog', 'ALL', null, summary);
            return ok(res, { version: '38.0.0', summary, courses: reports }, 'Đã kiểm toán catalog theo V38. Báo cáo chỉ đọc; chưa tự sửa dữ liệu khóa học hiện có.');
        } catch (error) { return next(error); }
    });
    router.get('/admin/platform/course-factory/overview', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const [courses, lessons, questions, assessments, incompleteCourses, lessonRows, questionRows, recentJobs] = await Promise.all([
                models.Course.countDocuments({ status: { $nin: ['ARCHIVED', 'DELETED'] } }),
                models.CurriculumContent.countDocuments({ type: 'LESSON', status: { $nin: ['ARCHIVED', 'DELETED'] } }),
                models.Question.countDocuments({ status: { $nin: ['ARCHIVED', 'DELETED'] } }),
                models.Assessment.countDocuments({ publicationStatus: { $nin: ['ARCHIVED', 'DELETED'] } }),
                models.Course.countDocuments({ $or: [{ status: 'DRAFT' }, { contentCompleteness: { $lt: 70 } }] }),
                models.CurriculumContent.find({ type: 'LESSON', status: { $nin: ['ARCHIVED', 'DELETED'] } }).select('theory theorySections lessonTestId assessmentIds activities practiceIds payload status').limit(1500).lean(),
                models.Question.find({ status: { $nin: ['ARCHIVED', 'DELETED'] } }).select('type prompt answer options rubric media status').limit(2000).lean(),
                models.AIGenerationJob.find({}).sort({ createdAt: -1 }).limit(30).select('type status priority progress currentStep attempts model fallbackUsed generationTimeMs error result payload startedAt completedAt finishedAt createdAt').lean()
            ]);
            const shallowLessons = lessonRows.filter(lesson => {
                const theory = Array.isArray(lesson.theorySections) ? lesson.theorySections.map(section => section.content || '').join(' ') : typeof lesson.theory === 'string' ? lesson.theory : JSON.stringify(lesson.theory || '');
                return theory.trim().split(/\s+/).filter(Boolean).length < 100;
            }).length;
            const missingTests = lessonRows.filter(lesson => !lesson.lessonTestId && !(lesson.assessmentIds || []).length).length;
            const invalidQuestions = questionRows.filter(question => !String(question.prompt || '').trim() || (['single_choice','multiple_choice','true_false'].includes(question.type) && (!Array.isArray(question.options) || question.options.length < 2))).length;
            const missingCodingTests = questionRows.filter(question => question.type === 'coding' && (!question.media?.coding?.starterCode || !Array.isArray(question.media?.coding?.visibleTestCases) || !question.media.coding.visibleTestCases.length)).length;
            const missingRubric = questionRows.filter(question => ['essay','speaking','practical','coding'].includes(question.type) && !Object.keys(question.rubric || {}).length).length;
            return ok(res, { courses, lessons, questions, assessments, incompleteCourses, shallowLessons, missingTests, invalidQuestions, missingCodingTests, missingRubric, unpublishedDrafts: await models.AIContentDraft.countDocuments({ mode: 'ADMIN', status: { $in: ['DRAFT','VALIDATED'] } }), failedGenerationJobs: recentJobs.filter(job => job.status === 'FAILED').length, queuedJobs: recentJobs.filter(job => ['QUEUED','WAITING_RETRY'].includes(job.status)).length, completedJobs: recentJobs.filter(job => job.status === 'COMPLETED').length, recentJobs: recentJobs.map(job => ({ ...job, payload: undefined })), engine: { name: 'ADAPTIVE_AI_COURSE_GENERATOR_V38', remoteApiUsed: isGeminiConfigured() && getAiMode() !== 'OFF', configured: isGeminiConfigured(), mode: getAiMode(), capabilities: ['adaptive course blueprint generation', 'track-specific theory and practice', 'lesson/chapter/final assessment generation', 'deep content quality gate', 'question uniqueness and scope audit', 'duplicate course detection'], fallbackPolicy: 'Không thay nội dung AI bằng khuôn mẫu khi thiếu quota; báo lỗi rõ ràng.' } });
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/catalog-expansion', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const requestedDomains = Array.isArray(req.body?.domains) ? req.body.domains.map(value => cleanText(value, 50).toUpperCase()).filter(code => Object.prototype.hasOwnProperty.call(DOMAIN_COURSE_SEEDS, code)) : [];
            const domains = [...new Set(requestedDomains)];
            if (!domains.length) return fail(res, 400, 'CATALOG_DOMAIN_REQUIRED', 'Chọn ít nhất một lĩnh vực cần rà soát/mở rộng.');
            const level = cleanText(req.body?.educationLevel || 'HIGHER_EDUCATION', 40).toUpperCase();
            const grade = req.body?.grade ? Number(req.body.grade) : null;
            if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 12)) return fail(res, 400, 'GRADE_INVALID', 'Lớp phải nằm từ 1 đến 12.');
            if (domains.includes('K12') && !grade) return fail(res, 400, 'GRADE_REQUIRED', 'Khi mở rộng catalog K12, cần chọn rõ lớp 1–12.');
            const execute = req.body?.execute === true;
            const maxItems = Math.min(25, Math.max(1, Number(req.body?.maxItems) || 20));
            const existingCourses = await models.Course.find({ status: { $nin: ['ARCHIVED', 'DELETED'] } }).select('code name title educationLevel grade subjectId category track syllabus kind trainingProgramId majorId specializationId').limit(3000).lean();
            const candidates = [];
            for (const domainCode of domains) {
                for (const [title, subjectId] of DOMAIN_COURSE_SEEDS[domainCode] || []) {
                    if (candidates.length >= maxItems) break;
                    const effectiveLevel = domainCode === 'K12' ? (grade <= 5 ? 'PRIMARY' : grade <= 9 ? 'SECONDARY_LOWER' : 'SECONDARY_UPPER') : (['ENGLISH', 'MOS'].includes(domainCode) ? 'ENGLISH_CERTIFICATION' : level);
                    const courseTitle = domainCode === 'K12' ? `${title.replace(/ theo lớp$/i, '')} lớp ${grade}` : title;
                    const input = { title: courseTitle, name: courseTitle, domainCode, subjectId, educationLevel: effectiveLevel, grade: domainCode === 'K12' ? grade : null, track: domainCode === 'COMPUTING' ? 'UNIVERSITY_IT' : domainCode === 'ECONOMICS' ? 'UNIVERSITY_ECONOMICS' : domainCode === 'MECHATRONICS' ? 'UNIVERSITY_MECHATRONICS' : domainCode === 'APPLIED_SCIENCES' ? 'UNIVERSITY_APPLIED_SCIENCES' : domainCode === 'ENGINEERING' ? 'UNIVERSITY_ENGINEERING' : domainCode, prompt: `Khóa học ${title}; cần chương, bài giảng, ví dụ, bài tập áp dụng, thực hành/case/project và kiểm tra kiến thức phù hợp lĩnh vực ${domainCode}.` };
                    const duplicateCandidates = findDuplicateCourses(input, existingCourses, STARTER_COURSES);
                    const fingerprintValue = localAiFingerprint(input);
                    candidates.push({ ...input, fingerprint: fingerprintValue, duplicateCandidates, duplicate: duplicateCandidates.some(item => item.score >= 0.8), suggestedAction: duplicateCandidates.some(item => item.score >= 0.8) ? 'REUSE_OR_ENRICH' : 'CREATE_DRAFT' });
                }
            }
            const queuedJobs = [];
            if (execute) {
                for (const candidate of candidates.filter(item => !item.duplicate).slice(0, maxItems)) {
                    const idempotencyKey = `CATALOG_EXPANSION:${candidate.fingerprint}`;
                    let job = await models.AIGenerationJob.findOne({ idempotencyKey }).lean();
                    if (!job) job = await models.AIGenerationJob.create({ username: req.session?.user?.username || '', type: 'COURSE', status: 'QUEUED', priority: 50, progress: 0, currentStep: 'QUEUED', model: 'LOCAL_EDUCATION_AI', fallbackUsed: false, payload: { localAction: 'COURSE_FACTORY', input: { ...candidate, domainCode: candidate.domainCode }, requestedBy: req.session?.user?.username || '', remoteApiUsed: false, expansionBatch: true }, idempotencyKey, nextRunAt: new Date() });
                    queuedJobs.push({ jobId: String(job._id), status: job.status, title: candidate.title, domainCode: candidate.domainCode });
                }
            }
            const result = { engine: 'LOCAL_EDUCATION_AI', remoteApiUsed: false, execute, maxItems, domains, inspected: candidates.length, duplicateCount: candidates.filter(item => item.duplicate).length, missingCount: candidates.filter(item => !item.duplicate).length, queuedCount: queuedJobs.length, queuedJobs, candidates: candidates.map(({ title, subjectId, domainCode, educationLevel, grade: itemGrade, fingerprint, duplicate, duplicateCandidates, suggestedAction }) => ({ title, subjectId, domainCode, educationLevel, grade: itemGrade, fingerprint, duplicate, duplicateCandidates, suggestedAction })), publishPolicy: 'ADMIN_REVIEW_REQUIRED' };
            await audit(req, 'LOCAL_CATALOG_EXPANSION', 'CatalogExpansion', req.session?.user?.username || 'CATALOG', null, { domains, inspected: result.inspected, duplicateCount: result.duplicateCount, queuedCount: result.queuedCount, remoteApiUsed: false });
            return ok(res, result, execute ? 'Đã rà soát catalog và xếp các khóa còn thiếu vào hàng đợi tạo bản nháp. Không khóa nào được tự công bố.' : 'Đã rà soát catalog ở chế độ xem trước; chưa tạo dữ liệu mới.');
        } catch (error) { return next(error); }
    });
    router.get('/admin/platform/course-factory/repair/options', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const [lessons, questions, assessments] = await Promise.all([
                models.CurriculumContent.find({ type: 'LESSON', status: { $nin: ['ARCHIVED','DELETED'] } }).select('title code courseId subjectId status').sort({ updatedAt: -1 }).limit(400).lean(),
                models.Question.find({ status: { $nin: ['ARCHIVED','DELETED'] } }).select('prompt code type courseId subjectId status').sort({ updatedAt: -1 }).limit(400).lean(),
                models.Assessment.find({ publicationStatus: { $nin: ['ARCHIVED','DELETED'] } }).select('title code assessmentType courseId subjectId publicationStatus questionIds').sort({ updatedAt: -1 }).limit(400).lean()
            ]);
            return ok(res, {
                lessons: lessons.map(item => ({ id: String(item._id), title: item.title, code: item.code, subtitle: `${item.subjectId || 'Bài học'} · ${item.status || 'DRAFT'}` })),
                questions: questions.map(item => ({ id: String(item._id), title: item.prompt, code: item.code, subtitle: `${item.type} · ${item.subjectId || item.status || ''}` })),
                assessments: assessments.map(item => ({ id: String(item._id), title: item.title, code: item.code, subtitle: `${item.assessmentType} · ${(item.questionIds || []).length} câu · ${item.publicationStatus}` }))
            });
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/repair', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const targetType = cleanText(req.body?.targetType || '', 30).toUpperCase();
            const targetId = cleanText(req.body?.targetId || '', 80);
            if (!['LESSON','QUESTION','ASSESSMENT'].includes(targetType) || !isObjectId(targetId)) return fail(res, 400, 'REPAIR_TARGET_INVALID', 'Hãy chọn một bài học, câu hỏi hoặc bài kiểm tra hợp lệ.');
            const modelName = targetType === 'LESSON' ? 'CurriculumContent' : targetType === 'QUESTION' ? 'Question' : 'Assessment';
            const selector = targetType === 'LESSON' ? { _id: targetId, type: 'LESSON' } : { _id: targetId };
            const target = await models[modelName].findOne(selector).select('_id title prompt code updatedAt').lean();
            if (!target) return fail(res, 404, 'REPAIR_TARGET_NOT_FOUND', 'Không tìm thấy nội dung đã chọn.');
            const active = await models.AIGenerationJob.findOne({ type: 'COURSE', status: { $in: ['QUEUED','RUNNING','WAITING_RETRY'] }, 'payload.localAction': 'CONTENT_REPAIR', 'payload.targetType': targetType, 'payload.targetId': targetId }).lean();
            if (active) return ok(res, { jobId: String(active._id), status: active.status, targetType, targetId }, 'Đã có tác vụ sửa nội dung đang chạy.');
            const idempotencyKey = `CONTENT_REPAIR:${targetType}:${targetId}:${target.updatedAt ? new Date(target.updatedAt).getTime() : Date.now()}`;
            const existingByKey = await models.AIGenerationJob.findOne({ idempotencyKey }).lean();
            if (existingByKey) return ok(res, { jobId: String(existingByKey._id), status: existingByKey.status, targetType, targetId, result: existingByKey.result || {} }, 'Nội dung này đã được kiểm tra ở phiên bản hiện tại. Nếu còn lỗi, hãy chỉnh nội dung trước rồi mới yêu cầu sửa lại.');
            const job = await models.AIGenerationJob.create({ username: req.session?.user?.username || '', type: 'COURSE', status: 'QUEUED', priority: 85, progress: 0, currentStep: 'QUEUED_CONTENT_REPAIR', model: 'LOCAL_EDUCATION_AI', fallbackUsed: false, payload: { localAction: 'CONTENT_REPAIR', targetType, targetId, remoteApiUsed: false, requestedBy: req.session?.user?.username || '' }, idempotencyKey, nextRunAt: new Date() });
            await audit(req, 'QUEUE_LOCAL_CONTENT_REPAIR', modelName, targetId, null, { jobId: String(job._id), targetType, remoteApiUsed: false });
            return res.status(202).json({ success: true, data: { jobId: String(job._id), status: job.status, targetType, targetId }, message: 'Đã xếp tác vụ sửa đúng mục đã chọn. Bản sửa vẫn cần Admin rà soát.' });
        } catch (error) {
            if (error?.code === 11000) return fail(res, 409, 'REPAIR_ALREADY_QUEUED', 'Tác vụ sửa nội dung này đã được xếp trước đó. Hãy kiểm tra tab Theo dõi tác vụ.');
            return next(error);
        }
    });
    router.post('/admin/platform/course-factory/jobs/:id/retry', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'JOB_ID_INVALID', 'Mã tác vụ không hợp lệ.');
            const before = await models.AIGenerationJob.findOne({ _id: req.params.id, type: 'COURSE', status: 'FAILED', 'payload.localAction': { $in: ['COURSE_FACTORY','CONTENT_REPAIR'] } }).lean();
            if (!before) return fail(res, 409, 'JOB_NOT_RETRYABLE', 'Chỉ có thể thử lại tác vụ Course Factory/Sửa nội dung đang ở trạng thái FAILED.');
            const result = await models.AIGenerationJob.updateOne({ _id: before._id, status: 'FAILED' }, { $set: { status: 'QUEUED', progress: 0, currentStep: 'MANUAL_RETRY_QUEUED', attempts: 0, error: {}, nextRunAt: new Date(), lockedAt: null, startedAt: null, completedAt: null, finishedAt: null } });
            if (!result.modifiedCount) return fail(res, 409, 'JOB_STATE_CHANGED', 'Trạng thái tác vụ đã thay đổi; hãy làm mới danh sách.');
            await audit(req, 'RETRY_LOCAL_AI_JOB', 'AIGenerationJob', before._id, before, { status: 'QUEUED', currentStep: 'MANUAL_RETRY_QUEUED' });
            return ok(res, { jobId: String(before._id), status: 'QUEUED' }, 'Đã xếp lại tác vụ vào hàng đợi nội bộ.');
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/ai-generation-jobs/:id/retry', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'JOB_ID_INVALID', 'Mã tác vụ không hợp lệ.');
            const before = await models.AIGenerationJob.findOne({ _id: req.params.id, status: 'FAILED', type: { $in: ['IMAGE', 'AUDIO', 'LESSON', 'ASSESSMENT', 'COURSE', 'PERSONAL_COURSE'] } }).lean();
            if (!before) return fail(res, 409, 'JOB_NOT_RETRYABLE', 'Chỉ có thể thử lại tác vụ AI đang FAILED. Kiểm tra quota/cấu hình trước khi thử lại.');
            const result = await models.AIGenerationJob.updateOne({ _id: before._id, status: 'FAILED' }, { $set: { status: 'QUEUED', progress: 0, currentStep: 'MANUAL_RETRY_QUEUED', attempts: 0, error: {}, nextRunAt: new Date(), lockedAt: null, startedAt: null, completedAt: null, finishedAt: null } });
            if (!result.modifiedCount) return fail(res, 409, 'JOB_STATE_CHANGED', 'Trạng thái tác vụ đã thay đổi; hãy tải lại danh sách.');
            await audit(req, 'RETRY_AI_GENERATION_JOB', 'AIGenerationJob', before._id, { status: before.status, type: before.type, attempts: before.attempts }, { status: 'QUEUED', attempts: 0 });
            return ok(res, { jobId: String(before._id), type: before.type, status: 'QUEUED' }, 'Đã xếp lại tác vụ. Nếu quota vẫn bằng 0, tác vụ sẽ dừng sau số lần thử có giới hạn.');
        } catch (error) { return next(error); }
    });
    router.get('/admin/platform/course-factory/jobs', guarded('learning.ai.manage'), async (req, res, next) => {
        try { const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30)); const jobs = await models.AIGenerationJob.find({ 'payload.localAction': { $in: ['COURSE_FACTORY', 'CATALOG_EXPANSION', 'CONTENT_REPAIR'] } }).sort({ createdAt: -1 }).limit(limit).select('-payload.input').lean(); return ok(res, jobs); }
        catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/jobs', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const input = safePatch(req.body?.input || req.body || {});
            input.title = cleanText(input.title || input.name || input.prompt || input.subjectId, 180);
            if (!input.title) return fail(res, 400, 'COURSE_TITLE_REQUIRED', 'Nhập tên khóa học hoặc kỹ năng muốn xây dựng.');
            input.educationLevel = cleanText(input.educationLevel || 'HIGHER_EDUCATION', 40).toUpperCase();
            if (input.grade !== undefined && input.grade !== null && input.grade !== '') {
                input.grade = Number(input.grade);
                if (!Number.isInteger(input.grade) || input.grade < 1 || input.grade > 12) return fail(res, 400, 'GRADE_INVALID', 'Lớp phải nằm từ 1 đến 12.');
            } else input.grade = null;
            if (!input.subjectId) input.subjectId = input.domainCode || identifyDomain(input).code;
            const key = `LOCAL_COURSE_FACTORY:${localAiFingerprint(input)}`;
            const existing = await models.AIGenerationJob.findOne({ idempotencyKey: key }).lean();
            if (existing) return ok(res, { jobId: String(existing._id), status: existing.status, progress: existing.progress, reusedJob: true }, 'Đã có job cùng yêu cầu; dùng lại job để không tạo trùng.');
            const job = await models.AIGenerationJob.create({ username: req.session?.user?.username || '', type: 'COURSE', status: 'QUEUED', priority: Number(req.body?.priority) || 60, progress: 0, currentStep: 'QUEUED', model: 'LOCAL_EDUCATION_AI', fallbackUsed: false, payload: { localAction: 'COURSE_FACTORY', input, requestedBy: req.session?.user?.username || '', remoteApiUsed: false }, idempotencyKey: key, nextRunAt: new Date() });
            await audit(req, 'QUEUE_LOCAL_GENERATION', 'AIGenerationJob', job._id, null, { type: job.type, status: job.status, model: job.model, inputTitle: input.title });
            return res.status(202).json({ success: true, data: { jobId: String(job._id), status: job.status, progress: 0, model: 'LOCAL_EDUCATION_AI', remoteApiUsed: false }, message: 'Đã xếp hàng tạo bản nháp bằng AI nội bộ; không gọi API bên ngoài.' });
        } catch (error) { return next(error); }
    });
    router.get('/admin/platform/course-factory/jobs/:id', guarded('learning.ai.manage'), async (req, res, next) => {
        try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Job ID không hợp lệ.'); const job = await models.AIGenerationJob.findOne({ _id: req.params.id, 'payload.localAction': { $in: ['COURSE_FACTORY','CATALOG_EXPANSION','CONTENT_REPAIR'] } }).lean(); if (!job) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy job AI nội bộ.'); return ok(res, job); }
        catch (error) { return next(error); }
    });
    router.get('/admin/platform/course-factory/drafts', guarded('learning.ai.manage'), async (req, res, next) => {
        try { const drafts = await models.AIContentDraft.find({ mode: 'ADMIN', type: 'COURSE' }).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, Number(req.query.limit) || 30))).select('-draft').lean(); return ok(res, drafts); }
        catch (error) { return next(error); }
    });
    router.get('/admin/platform/course-factory/drafts/:id', guarded('learning.ai.manage'), async (req, res, next) => {
        try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Draft ID không hợp lệ.'); const draft = await models.AIContentDraft.findOne({ _id: req.params.id, mode: 'ADMIN', type: 'COURSE' }).lean(); if (!draft) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bản nháp.'); return ok(res, draft); }
        catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/analyze', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const username = cleanText(req.body?.username || '', 80);
            const [courses, mastery, errors, learningProfile, education, latestSurvey, latestPlacement, activePlan, recentAttempts] = await Promise.all([
                models.Course.find({ status: { $nin: ['ARCHIVED','DELETED'] } }).select('code name title description educationLevel grade subjectId track syllabus skills aliases').limit(2500).lean(),
                username ? models.SkillMastery.find({ username }).limit(500).lean() : Promise.resolve([]),
                username ? models.LearningError.find({ username, resolved: false }).limit(200).lean() : Promise.resolve([]),
                username ? models.LearningProfile.findOne({ username }).lean() : Promise.resolve(null),
                username ? models.EducationProfile.findOne({ username }).lean() : Promise.resolve(null),
                username ? models.SurveyAttempt.findOne({ username }).sort({ submittedAt: -1 }).lean() : Promise.resolve(null),
                username ? models.PlacementAttempt.findOne({ username }).sort({ submittedAt: -1 }).lean() : Promise.resolve(null),
                username ? models.LearningPlan.findOne({ username, status: 'ACTIVE' }).sort({ version: -1 }).lean() : Promise.resolve(null),
                username ? models.AssessmentAttempt.find({ username, status: { $in: ['SUBMITTED','REVIEW_REQUIRED'] } }).sort({ submittedAt: -1 }).limit(20).select('assessmentId status score result submittedAt').lean() : Promise.resolve([])
            ]);
            const requestSkills = Array.isArray(req.body?.skills) ? req.body.skills.map(value => cleanText(typeof value === 'string' ? value : value?.skill || value?.name, 120)).filter(Boolean).slice(0, 30) : [];
            const placementScores = latestPlacement?.scores && typeof latestPlacement.scores === 'object' ? latestPlacement.scores : {};
            const placementSkillNames = Object.entries(placementScores).filter(([, value]) => Number(typeof value === 'object' ? value.score ?? value.accuracy : value) < 65).map(([key]) => key.replace(/[_-]+/g, ' '));
            const planWeakSkills = [...(activePlan?.recommendations || []), ...(activePlan?.subjects || [])].flatMap(item => Number(item?.currentLevel ?? item?.accuracy ?? 100) < 70 ? [item.skill, item.skillName, ...(item.weakSkills || [])] : []).filter(value => typeof value === 'string' && value.trim());
            const surveyResult = latestSurvey?.result && typeof latestSurvey.result === 'object' ? latestSurvey.result : {};
            const surveyGoals = [surveyResult.goal, surveyResult.primaryGoal, ...(Array.isArray(surveyResult.goals) ? surveyResult.goals : [])].filter(value => typeof value === 'string' && value.trim());
            const surveyWeaknesses = [surveyResult.weaknesses, surveyResult.weakSkills, surveyResult.learningDifficulties].flat().filter(value => typeof value === 'string' && value.trim());
            const mergedSkills = [...new Set([...requestSkills, ...placementSkillNames, ...planWeakSkills.map(value => cleanText(value, 120)), ...surveyWeaknesses.map(value => cleanText(value, 120))])].slice(0, 40);
            const goal = req.body?.goal || learningProfile?.goals?.[0] || activePlan?.target?.goal || activePlan?.target?.title || surveyGoals[0] || '';
            const result = analyzeCatalogGaps({ goal, requestedSkills: mergedSkills, courses, mastery, learningErrors: errors, starterCourses: STARTER_COURSES });
            if (username && learningProfile) result.learnerContext = { username, goals: learningProfile.goals || [], educationLevel: education?.educationLevel || learningProfile.educationLevel || '', grade: education?.grade || education?.currentGrade || null, majorName: education?.majorName || '', surveyVersion: latestSurvey?.surveyVersion || '', placementDate: latestPlacement?.submittedAt || null, learningPlanVersion: activePlan?.version || null, recentAssessmentAttempts: recentAttempts.length, source: 'PROFILE_SURVEY_PLACEMENT_LEARNING_PLAN' };
            await audit(req, 'LOCAL_AUTOPILOT_ANALYZE', 'CatalogGap', username || 'CATALOG', null, { summary: result.summary, goal: result.goal, remoteApiUsed: false });
            return ok(res, result, 'Local Education AI đã phân tích catalog mà không gọi API bên ngoài.');
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/autopilot/run', guarded('learning.ai.manage'), async (req, res, next) => {
        try {
            const result = await (async () => {
                const username = cleanText(req.body?.username || '', 80);
                const [profile, education, mastery, errors, courses, latestSurvey, latestPlacement, activePlan, recentAttempts] = await Promise.all([
                    username ? models.LearningProfile.findOne({ username }).lean() : null,
                    username ? models.EducationProfile.findOne({ username }).lean() : null,
                    username ? models.SkillMastery.find({ username }).limit(500).lean() : [],
                    username ? models.LearningError.find({ username, resolved: false }).limit(200).lean() : [],
                    models.Course.find({ status: { $nin: ['ARCHIVED','DELETED'] } }).select('code name title description educationLevel grade subjectId track syllabus skills aliases').limit(2500).lean(),
                    username ? models.SurveyAttempt.findOne({ username }).sort({ submittedAt: -1 }).lean() : null,
                    username ? models.PlacementAttempt.findOne({ username }).sort({ submittedAt: -1 }).lean() : null,
                    username ? models.LearningPlan.findOne({ username, status: 'ACTIVE' }).sort({ version: -1 }).lean() : null,
                    username ? models.AssessmentAttempt.find({ username, status: { $in: ['SUBMITTED','REVIEW_REQUIRED'] } }).sort({ submittedAt: -1 }).limit(20).select('assessmentId status score result submittedAt').lean() : []
                ]);
                const bodySkills = Array.isArray(req.body?.skills) ? req.body.skills.map(value => cleanText(typeof value === 'string' ? value : value?.skill || value?.name, 120)).filter(Boolean) : [];
                const scoreObject = latestPlacement?.scores && typeof latestPlacement.scores === 'object' ? latestPlacement.scores : {};
                const placementWeak = Object.entries(scoreObject).filter(([, value]) => Number(typeof value === 'object' ? value.score ?? value.accuracy : value) < 65).map(([key]) => key.replace(/[_-]+/g, ' '));
                const recentWeak = mastery.filter(item => Number(item.accuracy ?? item.score ?? 100) < 65).map(item => cleanText(item.skill || item.code, 120)).filter(Boolean);
                const surveyResult = latestSurvey?.result && typeof latestSurvey.result === 'object' ? latestSurvey.result : {};
                const surveyWeak = [surveyResult.weaknesses, surveyResult.weakSkills, surveyResult.learningDifficulties].flat().filter(value => typeof value === 'string' && value.trim());
                const planRecommendations = [...(activePlan?.recommendations || []), ...(activePlan?.subjects || [])];
                const planWeak = planRecommendations.flatMap(item => Number(item.currentLevel ?? item.accuracy ?? 100) < 70 ? [item.skill, item.skillName].filter(Boolean) : []).map(value => cleanText(value, 120));
                const requestSkills = [...new Set([...bodySkills, ...placementWeak, ...recentWeak, ...surveyWeak.map(value => cleanText(value, 120)), ...planWeak])].filter(Boolean).slice(0, 50);
                const goal = req.body?.goal || profile?.goals?.[0] || activePlan?.target?.goal || activePlan?.target?.title || surveyResult.goal || surveyResult.primaryGoal || '';
                const analysis = analyzeCatalogGaps({ goal, requestedSkills: requestSkills, courses, mastery, learningErrors: errors, starterCourses: STARTER_COURSES });
                const actions = analysis.recommendedActions.slice(0, 5);
                const queuedJobs = [];
                if (req.body?.execute === true) {
                    for (const action of actions) {
                        const input = { title: action.title.replace(/^Đề xuất khóa học:\s*/i, ''), prompt: action.reason, subjectId: action.skill, educationLevel: education?.educationLevel || req.body?.educationLevel || 'HIGHER_EDUCATION', grade: education?.grade || req.body?.grade || null };
                        const idempotencyKey = `LOCAL_COURSE_FACTORY:${localAiFingerprint(input)}`;
                        let job = await models.AIGenerationJob.findOne({ idempotencyKey }).lean();
                        if (!job) job = await models.AIGenerationJob.create({ username: req.session?.user?.username || '', type: 'COURSE', status: 'QUEUED', priority: 70, progress: 0, currentStep: 'QUEUED', model: 'LOCAL_EDUCATION_AI', payload: { localAction: 'COURSE_FACTORY', input, requestedBy: req.session?.user?.username || '', learnerUsername: username, remoteApiUsed: false }, idempotencyKey, nextRunAt: new Date() });
                        queuedJobs.push({ jobId: String(job._id), status: job.status, skill: action.skill });
                    }
                }
                return { cycle: ['OBSERVE','ANALYZE','DECIDE', ...(req.body?.execute === true ? ['EXECUTE'] : []),'MEASURE'], engine: 'LOCAL_EDUCATION_AI', remoteApiUsed: false, learner: username || null, education: education ? { educationLevel: education.educationLevel, grade: education.grade, majorName: education.majorName, trainingProgramId: education.trainingProgramId } : null, evidenceSources: { survey: Boolean(latestSurvey), placement: Boolean(latestPlacement), activeLearningPlanVersion: activePlan?.version || null, recentAssessmentAttempts: recentAttempts.length, skillMasteryCount: mastery.length, unresolvedErrors: errors.length }, analysis, decisions: actions, queuedJobs, executed: req.body?.execute === true, publishPolicy: 'ADMIN_REVIEW_REQUIRED' };
            })();
            await audit(req, 'LOCAL_AUTOPILOT_RUN', 'AIAutopilot', result.learner || 'CATALOG', null, { summary: result.analysis.summary, queuedJobs: result.queuedJobs.length, remoteApiUsed: false });
            return ok(res, result, result.executed ? 'Autopilot đã xếp job tạo nháp; không tự công bố.' : 'Autopilot đã phân tích và đề xuất; chưa thực thi thay đổi.');
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/drafts/:id/commit', guarded('learning.curriculum.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Draft ID không hợp lệ.');
            const draftRecord = await models.AIContentDraft.findOne({ _id: req.params.id, mode: 'ADMIN', type: 'COURSE' });
            if (!draftRecord) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bản nháp khóa học.');
            if (draftRecord.committedCourseId) { const existingCourse = await models.Course.findById(draftRecord.committedCourseId).lean(); return ok(res, { course: existingCourse, alreadyCommitted: true }, 'Bản nháp đã được lưu thành khóa học trước đó.'); }
            const blueprint = draftRecord.draft || {}; let validation = auditCourseBlueprintV38(blueprint);
            const scopeValidation = validateRequestedCourseScope(blueprint, draftRecord.context || {});
            if (!scopeValidation.valid) validation = { ...validation, valid: false, status: 'REJECTED_SCOPE_MISMATCH', errors: [...validation.errors, ...scopeValidation.errors] };
            if (!validation.valid || !['VALIDATED','COMMITTED'].includes(draftRecord.status)) return fail(res, 409, 'DRAFT_INVALID', 'Bản nháp chưa qua V38 quality gate hoặc sai phạm vi yêu cầu. Hãy sửa lỗi nội dung trước khi lưu.', validation);
            const dbCourses = await models.Course.find({ status: { $nin: ['ARCHIVED','DELETED'] } }).select('code name educationLevel grade subjectId track syllabus kind').limit(2000).lean();
            const duplicates = findDuplicateCourses(blueprint, dbCourses, STARTER_COURSES);
            if (duplicates.some(item => item.score >= 0.99)) return fail(res, 409, 'DUPLICATE_COURSE', 'Phát hiện khóa học trùng gần như chính xác. Không tạo bản sao; hãy mở khóa học hiện có để bổ sung nội dung hoặc đổi mục tiêu/tên khóa.', duplicates);
            const courseCode = safeSlug(blueprint.code || blueprint.title);
            const existingCode = await models.Course.findOne({ code: courseCode, status: { $nin: ['ARCHIVED','DELETED'] } }).lean();
            if (existingCode) return fail(res, 409, 'DUPLICATE_COURSE_CODE', 'Mã khóa học đã tồn tại. Hãy sửa mã ở bản nháp trước khi tiếp tục.', { code: courseCode, existingCourseId: String(existingCode._id) });
            const curriculumVersion = await ensureFactoryCurriculum(blueprint.educationLevel, blueprint.grade);
            const sourceRef = { sourceType: 'AI_GENERATED', organization: 'Hành Trình Mới AI Course Generator', documentName: 'Adaptive AI generated draft', version: '38.0.0', verification: 'unverified', notes: 'Nội dung do AI tạo và qua kiểm định cấu trúc/nội dung tự động; không phải tài liệu official và vẫn cần xem trước trước khi công bố.' };
            const course = await models.Course.create({ code: courseCode, name: cleanText(blueprint.title, 180), description: cleanText(blueprint.description, 2000), educationLevel: blueprint.educationLevel, grade: blueprint.grade || null, subjectId: cleanText(blueprint.subjectId, 100), category: blueprint.category || 'OTHER', curriculumVersionId: curriculumVersion._id, objectives: blueprint.objectives || [], estimatedMinutes: Number(blueprint.estimatedMinutes) || 300, difficulty: 'FOUNDATION_TO_APPLIED', sourceRef, syllabus: { domainCode: blueprint.domainCode, track: blueprint.track, majorName: blueprint.majorName, chapters: (blueprint.chapters || []).map(chapter => ({ code: chapter.code, title: chapter.title, overview: chapter.overview })), skills: [...new Set((blueprint.chapters || []).flatMap(chapter => (chapter.lessons || []).flatMap(lesson => lesson.skills || [])))], fingerprint: blueprint.metadata?.fingerprint, sourceType: 'AI_GENERATED', source: 'LOCAL_EDUCATION_AI' }, kind: 'AI_DRAFT', ownerUsername: '', personalizedFor: {}, aiGeneration: { engine: draftRecord.model || blueprint.metadata?.generatedBy || 'GEMINI_COURSE_GENERATION_V38', remoteApiUsed: draftRecord.metadata?.remoteApiUsed !== false, version: '38.0.0', qualityScore: validation.qualityScore, draftId: String(draftRecord._id), createdAt: new Date() }, contentCompleteness: Math.min(95, Math.max(70, Number(draftRecord.validation?.lessonCount) * 5)), status: 'DRAFT' });
            const createdLessons = []; const allQuestionIds = []; const chapterAssessmentIds = [];
            for (let ci = 0; ci < blueprint.chapters.length; ci += 1) {
                const chapter = blueprint.chapters[ci];
                const unit = await models.CurriculumContent.create({ curriculumVersionId: curriculumVersion._id, type: 'UNIT', code: `${courseCode}-CH${ci + 1}`, title: cleanText(chapter.title, 180), description: cleanText(chapter.overview, 800), courseId: course._id, grade: blueprint.grade || null, educationLevel: blueprint.educationLevel, subjectId: blueprint.subjectId, objectives: [], status: 'DRAFT', sourceRef, payload: { sourceType: 'AI_GENERATED', generatedBy: blueprint.metadata?.generatedBy || 'GEMINI', chapterCode: chapter.code } });
                const chapterQuestionIds = [];
                for (let li = 0; li < (chapter.lessons || []).length; li += 1) {
                    const lessonDraft = chapter.lessons[li];
                    const lessonCode = `${courseCode}-CH${ci + 1}-L${li + 1}`;
                    const lesson = await models.CurriculumContent.create({ curriculumVersionId: curriculumVersion._id, type: 'LESSON', parentId: unit._id, courseId: course._id, code: lessonCode, title: cleanText(lessonDraft.title, 180), description: cleanText(lessonDraft.objectives?.join(' '), 1000), grade: blueprint.grade || null, educationLevel: blueprint.educationLevel, subjectId: blueprint.subjectId, objectives: lessonDraft.objectives || [], theory: (lessonDraft.theorySections || []).map(section => `${section.title}\n${section.content}`).join('\n\n'), theorySections: lessonDraft.theorySections || [], examples: lessonDraft.examples || [], activities: [...(lessonDraft.activities || []), ...(lessonDraft.practice || []), ...(lessonDraft.practical ? [lessonDraft.practical] : [])], knowledge: (lessonDraft.theorySections || []).map(section => section.title), skills: lessonDraft.skills || [], prerequisiteIds: [], estimatedMinutes: Number(lessonDraft.estimatedMinutes) || 25, difficulty: lessonDraft.difficulty || 'FOUNDATION', status: 'DRAFT', sourceRef, generationMetadata: { engine: blueprint.metadata?.generatedBy || 'GEMINI', version: '38.0.0', sourceType: 'AI_GENERATED', official: false }, payload: { lectureScript: lessonDraft.lectureScript, practice: lessonDraft.practice || [], practical: lessonDraft.practical || {}, courseId: String(course._id), chapterId: String(unit._id), prerequisitesText: lessonDraft.prerequisites || [] } });
                    const createdQuestionIds = [];
                    for (const [questionIndex, questionDraft] of (lessonDraft.questions || []).entries()) {
                        const question = await models.Question.create(normalizeAdminQuestion({ ...questionDraft, code: `${lessonCode}-Q${questionIndex + 1}` }, { educationLevel: blueprint.educationLevel, grade: blueprint.grade, subjectId: blueprint.subjectId, courseId: course._id, lessonId: lesson._id }));
                        createdQuestionIds.push(question._id); chapterQuestionIds.push(question._id); allQuestionIds.push(question._id);
                    }
                    const lessonAssessment = await models.Assessment.create({ code: `${lessonCode}-TEST`, title: `Kiểm tra bài: ${lesson.title}`, educationLevel: blueprint.educationLevel, grade: blueprint.grade || null, curriculumVersionId: curriculumVersion._id, subjectId: blueprint.subjectId, courseId: course._id, lessonId: lesson._id, assessmentType: 'LESSON_TEST', questionIds: createdQuestionIds, questionPool: createdQuestionIds, sections: [{ code: 'LESSON', title: lesson.title, questionIds: createdQuestionIds }], durationSeconds: Math.max(300, Number(lessonDraft.estimatedMinutes || 25) * 60), attemptLimit: 3, passingScore: 70, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'mixed_percentage', maxScore: createdQuestionIds.length ? createdQuestionIds.length : 1, manualReviewTypes: ['short_answer','essay','speaking','practical','coding'] }, reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true }, version: '1', publicationStatus: 'DRAFT', sourceRef });
                    await models.CurriculumContent.updateOne({ _id: lesson._id }, { $set: { lessonTestId: lessonAssessment._id, assessmentIds: [lessonAssessment._id] } });
                    await models.CurriculumContent.updateOne({ _id: unit._id }, { $addToSet: { assessmentIds: lessonAssessment._id } });
                    createdLessons.push({ id: String(lesson._id), code: lessonCode, title: lesson.title, questionCount: createdQuestionIds.length, assessmentId: String(lessonAssessment._id), chapterId: String(unit._id) });
                    chapterAssessmentIds.push(lessonAssessment._id);
                }
                const chapterAssessmentQuestionIds = [];
                for (const [qi, questionDraft] of (chapter.assessment?.questions || []).entries()) {
                    const question = await models.Question.create(normalizeAdminQuestion({ ...questionDraft, code: questionDraft.code || `${courseCode}-CH${ci + 1}-ASSESS-Q${qi + 1}` }, { educationLevel: blueprint.educationLevel, grade: blueprint.grade, subjectId: blueprint.subjectId, courseId: course._id }));
                    chapterAssessmentQuestionIds.push(question._id); allQuestionIds.push(question._id);
                }
                if (chapterAssessmentQuestionIds.length) {
                    const chapterAssessment = await models.Assessment.create({ code: `${courseCode}-CH${ci + 1}-TEST`, title: `Kiểm tra chương ${ci + 1}: ${chapter.title}`, educationLevel: blueprint.educationLevel, grade: blueprint.grade || null, curriculumVersionId: curriculumVersion._id, subjectId: blueprint.subjectId, courseId: course._id, assessmentType: 'CHAPTER_TEST', questionIds: chapterAssessmentQuestionIds, questionPool: chapterAssessmentQuestionIds, sections: [{ code: `CH${ci + 1}`, title: chapter.title, questionIds: chapterAssessmentQuestionIds }], durationSeconds: Math.max(600, Number(chapter.assessment?.durationSeconds) || 1800), attemptLimit: 3, passingScore: Number(chapter.assessment?.passingScore) || 70, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'mixed_percentage', maxScore: chapterAssessmentQuestionIds.length, manualReviewTypes: ['short_answer','essay','speaking','practical','coding'] }, reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true }, version: '38.0.0', publicationStatus: 'DRAFT', sourceRef });
                    chapterAssessmentIds.push(chapterAssessment._id);
                    await models.CurriculumContent.updateOne({ _id: unit._id }, { $addToSet: { assessmentIds: chapterAssessment._id } });
                }
            }
            const finalQuestionIds = [];
            for (const [qi, questionDraft] of (blueprint.finalAssessment?.questions || []).entries()) {
                const question = await models.Question.create(normalizeAdminQuestion({ ...questionDraft, code: questionDraft.code || `${courseCode}-FINAL-Q${qi + 1}` }, { educationLevel: blueprint.educationLevel, grade: blueprint.grade, subjectId: blueprint.subjectId, courseId: course._id }));
                finalQuestionIds.push(question._id); allQuestionIds.push(question._id);
            }
            const finalAssessment = await models.Assessment.create({ code: `${courseCode}-FINAL`, title: `Bài kiểm tra cuối khóa: ${course.name}`, educationLevel: blueprint.educationLevel, grade: blueprint.grade || null, curriculumVersionId: curriculumVersion._id, subjectId: blueprint.subjectId, courseId: course._id, assessmentType: 'FINAL', questionIds: finalQuestionIds.slice(0, 100), questionPool: finalQuestionIds, sections: [{ code: 'FINAL', title: 'Tổng hợp kiến thức', questionIds: finalQuestionIds.slice(0, 100) }], durationSeconds: Math.max(900, Number(blueprint.finalAssessment?.durationSeconds) || 3600), attemptLimit: 3, passingScore: Number(blueprint.finalAssessment?.passingScore) || 70, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'mixed_percentage', maxScore: Math.min(100, finalQuestionIds.length), manualReviewTypes: ['short_answer','essay','speaking','practical','coding'] }, reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true }, version: '38.0.0', publicationStatus: 'DRAFT', sourceRef });
            draftRecord.status = 'COMMITTED'; draftRecord.committedCourseId = course._id; draftRecord.metadata = { ...(draftRecord.metadata || {}), committedAt: new Date(), chapterIds: [], lessonCount: createdLessons.length, questionCount: allQuestionIds.length, lessonRecords: createdLessons, chapterAssessmentIds: chapterAssessmentIds.map(String), finalAssessmentId: String(finalAssessment._id), sourceType: 'AI_GENERATED', official: false };
            await draftRecord.save();
            await audit(req, 'MATERIALIZE_LOCAL_COURSE', 'Course', course._id, null, { code: course.code, name: course.name, lessonCount: createdLessons.length, questionCount: allQuestionIds.length, kind: course.kind, sourceType: 'AI_GENERATED' });
            return res.status(201).json({ success: true, data: { course, lessonCount: createdLessons.length, questionCount: allQuestionIds.length, assessmentCount: chapterAssessmentIds.length + 1, lessons: createdLessons, finalAssessmentId: String(finalAssessment._id), sourceType: 'AI_GENERATED', official: false }, message: 'Đã lưu thành khóa học AI_DRAFT gồm chương, bài học, câu hỏi, kiểm tra bài/chương và cuối khóa. Cần Admin preview và công bố thủ công.' });
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/drafts/:id/publish', guarded('learning.lesson.publish'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Draft ID không hợp lệ.');
            const draft = await models.AIContentDraft.findOne({ _id: req.params.id, mode: 'ADMIN', type: 'COURSE', status: 'COMMITTED' });
            if (!draft?.committedCourseId) return fail(res, 409, 'COURSE_NOT_COMMITTED', 'Cần lưu bản nháp thành khóa học và preview trước khi công bố.');
            const course = await models.Course.findById(draft.committedCourseId).lean();
            if (!course) return fail(res, 404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học.');
            const lessons = await models.CurriculumContent.find({ courseId: course._id, type: 'LESSON', status: { $ne: 'ARCHIVED' } }).lean();
            const [assessments, allCourseQuestions] = await Promise.all([models.Assessment.find({ courseId: course._id }).lean(), models.Question.find({ courseId: course._id }).lean()]);
            if (!lessons.length || lessons.some(lesson => !lesson.lessonTestId) || !assessments.some(item => item.assessmentType === 'FINAL')) return fail(res, 409, 'COURSE_QUALITY_GATE_FAILED', 'Khóa học thiếu bài học, lesson test hoặc final assessment. Chưa thể công bố.');
            const catalogAudit = auditStoredCourseV38({ course, lessons, questions: allCourseQuestions, assessments });
            if (catalogAudit.status !== 'HEALTHY') return fail(res, 409, 'COURSE_QUALITY_GATE_FAILED', 'Khóa học chưa đạt kiểm định V38 về chiều sâu học liệu, câu hỏi và liên kết bài kiểm tra.', catalogAudit);
            const questionIds = [...new Set(assessments.flatMap(item => item.questionIds || []).map(String))];
            const questions = await models.Question.find({ _id: { $in: questionIds } }).lean();
            if (!questions.length || questions.some(question => !String(question.prompt || '').trim())) return fail(res, 409, 'COURSE_QUESTION_INVALID', 'Khóa học có câu hỏi không hợp lệ.');
            await models.Question.updateMany({ _id: { $in: questionIds } }, { $set: { status: 'PUBLISHED' } });
            await models.Assessment.updateMany({ courseId: course._id }, { $set: { publicationStatus: 'PUBLISHED' } });
            await models.CurriculumContent.updateMany({ courseId: course._id }, { $set: { status: 'PUBLISHED' } });
            const publishedCourse = await models.Course.findByIdAndUpdate(course._id, { $set: { status: 'ACTIVE', kind: 'CANONICAL' } }, { new: true }).lean();
            await draft.updateOne({ $set: { metadata: { ...(draft.metadata || {}), adminReviewedAt: new Date(), publicationDecision: 'PUBLISHED_CANONICAL_CATALOG', sourceType: 'AI_GENERATED', official: false } } });
            await audit(req, 'PUBLISH_REVIEWED_AI_COURSE', 'Course', course._id, course, publishedCourse);
            return ok(res, { course: publishedCourse, lessonCount: lessons.length, questionCount: questions.length, assessmentCount: assessments.length, sourceType: 'AI_GENERATED', official: false }, 'Đã công bố vào catalog sau quality gate và thao tác thủ công của Admin. Nội dung vẫn được đánh dấu AI_GENERATED, không phải tài liệu official.');
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/course-factory/drafts/:id/reject', guarded('learning.ai.manage'), async (req, res, next) => {
        try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Draft ID không hợp lệ.'); const draft = await models.AIContentDraft.findOneAndUpdate({ _id: req.params.id, mode: 'ADMIN', type: 'COURSE', status: { $ne: 'COMMITTED' } }, { $set: { status: 'REJECTED', 'metadata.rejectionReason': cleanText(req.body?.reason || 'Admin từ chối bản nháp.', 500), 'metadata.rejectedAt': new Date() } }, { new: true }); if (!draft) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy draft hoặc nội dung đã được materialize.'); await audit(req, 'REJECT_LOCAL_COURSE_DRAFT', 'AIContentDraft', draft._id, null, { reason: draft.metadata?.rejectionReason }); return ok(res, { id: String(draft._id), status: draft.status }, 'Đã từ chối bản nháp.'); }
        catch (error) { return next(error); }
    });

    // Simple form endpoints: administrators never need to type Mongo JSON for common content operations.
    router.get('/admin/platform/studio/options', guarded('learning.curriculum.manage'), async (req, res, next) => {
        try {
            const [courses, versions, questions, lessons, assessments, curriculumNodes, universities, faculties, fields, disciplineGroups, majors, specializations, trainingPrograms] = await Promise.all([
                models.Course.find({ status: { $nin: ['ARCHIVED','DELETED'] } }).select('code name educationLevel grade subjectId status kind syllabus curriculumVersionId').sort({ name: 1 }).limit(500).lean(),
                models.CurriculumVersion.find({ status: { $nin: ['ARCHIVED'] } }).select('code version educationLevel status').sort({ createdAt: -1 }).limit(200).lean(),
                models.Question.find({ status: { $nin: ['ARCHIVED'] } }).select('code prompt type points skill status courseId lessonId').sort({ createdAt: -1 }).limit(500).lean(),
                models.CurriculumContent.find({ type: 'LESSON', status: { $nin: ['ARCHIVED'] } }).select('code title type courseId parentId status educationLevel grade subjectId lessonTestId theory theorySections payload examples activities skills estimatedMinutes difficulty objectives description').sort({ createdAt: -1 }).limit(500).lean(),
                models.Assessment.find({ publicationStatus: { $nin: ['ARCHIVED'] } }).select('code title assessmentType publicationStatus courseId questionIds durationSeconds passingScore attemptLimit randomization reviewSettings').sort({ createdAt: -1 }).limit(300).lean(),
                models.CurriculumContent.find({ type: { $in: ['SUBJECT','DOMAIN','UNIT'] }, status: { $nin: ['ARCHIVED'] } }).select('code title type courseId parentId status educationLevel grade subjectId curriculumVersionId payload').sort({ createdAt: -1 }).limit(500).lean(),
                models.University.find({ status: { $ne: 'ARCHIVED' } }).select('code name shortName status').sort({ name: 1 }).limit(300).lean(),
                models.Faculty.find({ status: { $ne: 'ARCHIVED' } }).select('universityId code name status').sort({ name: 1 }).limit(500).lean(),
                models.Field.find({ status: { $ne: 'ARCHIVED' } }).select('code name status').sort({ name: 1 }).limit(300).lean(),
                models.DisciplineGroup.find({}).select('fieldId code name').sort({ name: 1 }).limit(500).lean(),
                models.Major.find({ status: { $ne: 'ARCHIVED' } }).select('disciplineGroupId code name status').sort({ name: 1 }).limit(500).lean(),
                models.Specialization.find({}).select('majorId code name').sort({ name: 1 }).limit(700).lean(),
                models.TrainingProgram.find({ status: { $nin: ['ARCHIVED'] } }).select('institutionId facultyId fieldId disciplineGroupId majorId specializationId programName version status academicYear cohort totalCredits learningOutcomes').sort({ programName: 1 }).limit(500).lean()
            ]);
            return ok(res, { courses, curriculumVersions: versions, questions, lessons, assessments, curriculumNodes, universities, faculties, fields, disciplineGroups, majors, specializations, trainingPrograms });
        } catch (error) { return next(error); }
    });
    router.get('/admin/platform/studio/details/:type/:id', guarded('learning.curriculum.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu không hợp lệ.');
            const map = { course: ['Course', 'learning.curriculum.manage'], lesson: ['CurriculumContent', 'learning.lesson.update'], curriculum: ['CurriculumContent', 'learning.lesson.update'], question: ['Question', 'learning.question.update'], assessment: ['Assessment', 'learning.exam.create'] };
            const mapping = map[String(req.params.type || '').toLowerCase()];
            if (!mapping) return fail(res, 400, 'TYPE_INVALID', 'Loại dữ liệu không được hỗ trợ.');
            const permissionCheck = requirePermission ? requirePermission(mapping[1]) : requireAuth;
            if (!req.session?.user) return fail(res, 401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập.');
            const { hasPermission } = require('../middleware/permissions');
            if (!hasPermission(req.session.user.role, mapping[1])) return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền xem dữ liệu này.');
            const record = await models[mapping[0]].findById(req.params.id).lean();
            if (!record) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
            return ok(res, record);
        } catch (error) { return next(error); }
    });
    router.get('/admin/platform/studio/preview/:type/:id', guarded('learning.curriculum.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã nội dung không hợp lệ.');
            const type = String(req.params.type || '').toLowerCase();
            const permission = type === 'assessment' ? 'learning.exam.create' : type === 'question' ? 'learning.question.update' : type === 'lesson' ? 'learning.lesson.update' : 'learning.curriculum.manage';
            const { hasPermission } = require('../middleware/permissions');
            if (!req.session?.user) return fail(res, 401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập.');
            if (!hasPermission(req.session.user.role, permission)) return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền xem trước nội dung này.');
            if (type === 'course') {
                const course = await models.Course.findById(req.params.id).lean();
                if (!course) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy khóa học.');
                const [chapters, lessons, assessments] = await Promise.all([
                    models.CurriculumContent.find({ courseId: course._id, type: 'UNIT', status: { $nin: ['ARCHIVED', 'DELETED'] } }).sort({ createdAt: 1 }).lean(),
                    models.CurriculumContent.find({ courseId: course._id, type: 'LESSON', status: { $nin: ['ARCHIVED', 'DELETED'] } }).sort({ createdAt: 1 }).lean(),
                    models.Assessment.find({ courseId: course._id, publicationStatus: { $nin: ['ARCHIVED', 'DELETED'] } }).select('title code assessmentType publicationStatus questionIds durationSeconds passingScore').sort({ createdAt: 1 }).lean()
                ]);
                const questionIds = [...new Set(assessments.flatMap(row => row.questionIds || []).map(String))];
                const questions = questionIds.length ? await models.Question.find({ _id: { $in: questionIds } }).select('code prompt type options answer acceptedAnswers explanation points rubric media skill status').lean() : [];
                return ok(res, { type, course, chapters, lessons, assessments, questions, sourceType: course.sourceRef?.sourceType || course.syllabus?.sourceType || 'UNKNOWN', official: false });
            }
            const modelName = type === 'lesson' ? 'CurriculumContent' : type === 'assessment' ? 'Assessment' : type === 'question' ? 'Question' : null;
            if (!modelName) return fail(res, 400, 'TYPE_INVALID', 'Loại nội dung chưa hỗ trợ xem trước.');
            const item = await models[modelName].findById(req.params.id).lean();
            if (!item) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy nội dung.');
            if (type === 'assessment') {
                const questions = await models.Question.find({ _id: { $in: item.questionIds || [] } }).select('code prompt type options answer acceptedAnswers explanation points rubric media skill status').lean();
                return ok(res, { type, item, questions, official: false });
            }
            return ok(res, { type, item, official: false });
        } catch (error) { return next(error); }
    });

    router.post('/admin/platform/studio/training-programs', guarded('university.manage'), async (req, res, next) => {
        try {
            const body = req.body || {};
            const programName = cleanText(body.programName, 180);
            if (!programName) return fail(res, 400, 'PROGRAM_NAME_REQUIRED', 'Nhập tên chương trình đào tạo.');
            if (!isObjectId(body.institutionId)) return fail(res, 400, 'PROGRAM_INSTITUTION_REQUIRED', 'Chọn trường/cơ sở đào tạo.');
            const institution = await models.University.findById(body.institutionId).lean();
            if (!institution) return fail(res, 400, 'PROGRAM_INSTITUTION_INVALID', 'Trường/cơ sở đào tạo không tồn tại.');
            const ids = {};
            for (const key of ['facultyId','fieldId','disciplineGroupId','majorId','specializationId']) {
                if (body[key] && !isObjectId(body[key])) return fail(res, 400, 'PROGRAM_REFERENCE_INVALID', `Mã ${key} không hợp lệ.`);
                if (body[key] && isObjectId(body[key])) ids[key] = body[key];
            }
            if (ids.facultyId) { const faculty = await models.Faculty.findById(ids.facultyId).lean(); if (!faculty || String(faculty.universityId) !== String(institution._id)) return fail(res, 400, 'PROGRAM_FACULTY_MISMATCH', 'Khoa đã chọn không thuộc trường/cơ sở đào tạo này.'); }
            if (ids.disciplineGroupId) { const group = await models.DisciplineGroup.findById(ids.disciplineGroupId).lean(); if (!group || (ids.fieldId && String(group.fieldId) !== String(ids.fieldId))) return fail(res, 400, 'PROGRAM_GROUP_MISMATCH', 'Nhóm ngành không thuộc lĩnh vực đã chọn.'); }
            if (ids.majorId) { const major = await models.Major.findById(ids.majorId).lean(); if (!major || (ids.disciplineGroupId && String(major.disciplineGroupId) !== String(ids.disciplineGroupId))) return fail(res, 400, 'PROGRAM_MAJOR_MISMATCH', 'Ngành không thuộc nhóm ngành đã chọn.'); }
            if (ids.specializationId) { const specialization = await models.Specialization.findById(ids.specializationId).lean(); if (!specialization || (ids.majorId && String(specialization.majorId) !== String(ids.majorId))) return fail(res, 400, 'PROGRAM_SPECIALIZATION_MISMATCH', 'Chuyên ngành không thuộc ngành đã chọn.'); }
            const sourceRef = { sourceType: 'ADMIN_CREATED', organization: 'Hành Trình Mới Admin', documentName: 'Admin Training Program Builder', verification: 'unverified', notes: 'Cần xác minh với nguồn chính thức của trường trước khi gắn nhãn official.' };
            const item = await models.TrainingProgram.create({ institutionId: institution._id, ...ids, programName, version: cleanText(body.version || '1', 40), academicYear: cleanText(body.academicYear || '', 40), cohort: cleanText(body.cohort || '', 40), totalCredits: body.totalCredits ? Math.max(0, Number(body.totalCredits)) : undefined, learningOutcomes: String(body.learningOutcomes || '').split(/\n+/).map(value => cleanText(value, 300)).filter(Boolean).slice(0, 30), status: 'DRAFT', sourceRef });
            await audit(req, 'CREATE', 'TrainingProgram', item._id, null, { programName, institutionId: String(institution._id), status: item.status });
            return res.status(201).json({ success: true, data: item, message: 'Đã tạo chương trình đào tạo bản nháp.' });
        } catch (error) { return next(error); }
    });

    router.post('/admin/platform/studio/curriculum-nodes', guarded('learning.curriculum.manage'), async (req, res, next) => {
        try {
            const body = req.body || {};
            const type = ['SUBJECT','DOMAIN','UNIT'].includes(String(body.type || '').toUpperCase()) ? String(body.type).toUpperCase() : 'SUBJECT';
            const title = cleanText(body.title, 180);
            const code = safeSlug(body.code || title);
            if (!title) return fail(res, 400, 'CURRICULUM_TITLE_REQUIRED', 'Nhập tên môn học/chủ đề/chương trình.');
            const level = cleanText(body.educationLevel || 'HIGHER_EDUCATION', 40).toUpperCase();
            const grade = body.grade ? Number(body.grade) : null;
            if (grade && (!Number.isInteger(grade) || grade < 1 || grade > 12)) return fail(res, 400, 'GRADE_INVALID', 'Lớp phải từ 1 đến 12.');
            const version = await ensureFactoryCurriculum(level, grade);
            const parentId = body.parentId && isObjectId(body.parentId) ? body.parentId : null;
            const course = body.courseId && isObjectId(body.courseId) ? await models.Course.findById(body.courseId).lean() : null;
            if (body.courseId && !course) return fail(res, 400, 'CURRICULUM_COURSE_NOT_FOUND', 'Không tìm thấy khóa học đã chọn.');
            if (type === 'UNIT' && !course) return fail(res, 400, 'CURRICULUM_COURSE_REQUIRED', 'Chương phải được gắn với một khóa học cụ thể.');
            if (parentId) {
                const parent = await models.CurriculumContent.findById(parentId).lean();
                if (!parent) return fail(res, 400, 'CURRICULUM_PARENT_NOT_FOUND', 'Không tìm thấy mục cha.');
                if (course && parent.courseId && String(parent.courseId) !== String(course._id)) return fail(res, 400, 'CURRICULUM_PARENT_SCOPE', 'Mục cha phải thuộc cùng khóa học.');
            }
            const versionId = course?.curriculumVersionId || version._id;
            const duplicate = await models.CurriculumContent.findOne({ curriculumVersionId: versionId, type, code }).lean();
            if (duplicate) return fail(res, 409, 'CURRICULUM_DUPLICATE_CODE', 'Mã này đã tồn tại trong chương trình.');
            const item = await models.CurriculumContent.create({ curriculumVersionId: versionId, type, parentId, courseId: course?._id || null, code, title, description: cleanText(body.description, 1200), educationLevel: course?.educationLevel || level, grade: course?.grade || grade, subjectId: cleanText(body.subjectId || course?.subjectId || title, 120), objectives: String(body.objectives || '').split(/\n+/).map(value => cleanText(value, 300)).filter(Boolean).slice(0, 15), status: 'DRAFT', sourceRef: { sourceType: 'ADMIN_CREATED', organization: 'Hành Trình Mới Admin', documentName: 'Admin Curriculum Builder', verification: 'unverified' }, payload: { programName: cleanText(body.programName || '', 180), domainCode: cleanText(body.domainCode || '', 60), createdVia: 'FORM_BUILDER' } });
            await audit(req, 'CREATE', 'CurriculumContent', item._id, null, { type, code, title });
            return res.status(201).json({ success: true, data: item, message: 'Đã tạo mục chương trình dạng bản nháp.' });
        } catch (error) { return next(error); }
    });

        router.post('/admin/platform/studio/courses', guarded('learning.curriculum.manage'), async (req, res, next) => {
        try {
            const body = req.body || {}; const name = cleanText(body.name, 180); const code = safeSlug(body.code || name);
            if (!name) return fail(res, 400, 'COURSE_NAME_REQUIRED', 'Nhập tên khóa học.');
            const duplicateCode = await models.Course.findOne({ code, status: { $nin: ['ARCHIVED','DELETED'] } }).lean();
            if (duplicateCode) return fail(res, 409, 'DUPLICATE_COURSE_CODE', 'Mã khóa đã tồn tại. Hãy sửa mã hoặc mở khóa học hiện có.', { id: String(duplicateCode._id), name: duplicateCode.name });
            const level = cleanText(body.educationLevel || 'HIGHER_EDUCATION', 40).toUpperCase();
            const grade = body.grade ? Number(body.grade) : null;
            if (grade && (!Number.isInteger(grade) || grade < 1 || grade > 12)) return fail(res, 400, 'GRADE_INVALID', 'Lớp phải từ 1 đến 12.');
            if (['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER'].includes(level) && !grade) return fail(res, 400, 'GRADE_REQUIRED', 'Với khóa phổ thông, hãy chọn lớp từ 1 đến 12.');
            const trainingProgramId = body.trainingProgramId || body.programId || null;
            if (trainingProgramId && !isObjectId(trainingProgramId)) return fail(res, 400, 'COURSE_PROGRAM_INVALID', 'Chương trình đào tạo đã chọn không hợp lệ.');
            const trainingProgram = trainingProgramId ? await models.TrainingProgram.findOne({ _id: trainingProgramId, status: { $nin: ['ARCHIVED', 'DELETED'] } }).lean() : null;
            if (trainingProgramId && !trainingProgram) return fail(res, 400, 'COURSE_PROGRAM_NOT_FOUND', 'Không tìm thấy chương trình đào tạo đã chọn.');
            const existingCourses = await models.Course.find({ status: { $nin: ['ARCHIVED','DELETED'] } }).select('code name title educationLevel grade subjectId category track syllabus kind programId trainingProgramId majorId specializationId').limit(2500).lean();
            const duplicateCandidates = findDuplicateCourses({ title: name, name, educationLevel: level, grade, subjectId: cleanText(body.subjectId, 100), domainCode: cleanText(body.domainCode, 60), track: cleanText(body.track, 100), syllabus: body.syllabus || {} }, existingCourses, STARTER_COURSES);
            const strongDuplicate = duplicateCandidates.find(candidate => candidate.score >= 0.92);
            if (strongDuplicate) return fail(res, 409, 'DUPLICATE_COURSE', 'Đã có khóa học cùng lĩnh vực và tên tương tự. Hãy mở khóa hiện tại để bổ sung nội dung hoặc điều chỉnh rõ mục tiêu.', duplicateCandidates);
            const curriculumVersion = await ensureFactoryCurriculum(level, grade);
            const sourceRef = { sourceType: 'ADMIN_CREATED', organization: 'Hành Trình Mới Admin', documentName: 'Admin Content Studio', verification: 'unverified', notes: 'Do Admin nhập trực tiếp; chưa xác minh là tài liệu official.' };
            const syllabus = { ...(body.syllabus && typeof body.syllabus === 'object' ? safePatch(body.syllabus) : {}), domainCode: cleanText(body.domainCode || body.syllabus?.domainCode, 60), track: cleanText(body.track || body.syllabus?.track, 100), majorName: cleanText(body.track || body.syllabus?.majorName, 160), sourceType: 'ADMIN_CREATED', official: false, fingerprint: localAiFingerprint({ name, level, grade, subjectId: body.subjectId, domainCode: body.domainCode, track: body.track, programId: trainingProgramId }) };
            const course = await models.Course.create({ code, name, educationLevel: level, grade, subjectId: cleanText(body.subjectId, 100), category: body.category || (grade ? 'GENERAL_EDUCATION' : 'MAJOR_FOUNDATION'), description: cleanText(body.description, 3000), objectives: String(body.objectives || '').split(/\n+/).map(item => cleanText(item, 300)).filter(Boolean).slice(0, 15), curriculumVersionId: curriculumVersion._id, syllabus, ...(trainingProgram ? { programId: trainingProgram._id, trainingProgramId: trainingProgram._id, institutionId: trainingProgram.institutionId, facultyId: trainingProgram.facultyId || null, majorId: trainingProgram.majorId || null, specializationId: trainingProgram.specializationId || null, academicYear: trainingProgram.academicYear } : {}), sourceRef, kind: 'CANONICAL', status: 'DRAFT', contentCompleteness: 0 });
            await audit(req, 'CREATE', 'Course', course._id, null, course.toObject());
            return res.status(201).json({ success: true, data: course, message: 'Đã tạo khóa học dạng bản nháp.' });
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/studio/lessons', guarded('learning.lesson.create'), async (req, res, next) => {
        try {
            const body = req.body || {}; const course = isObjectId(body.courseId) ? await models.Course.findById(body.courseId).lean() : null;
            if (!course) return fail(res, 400, 'LESSON_COURSE_REQUIRED', 'Hãy chọn khóa học liên kết.');
            const title = cleanText(body.title, 180); if (!title) return fail(res, 400, 'LESSON_TITLE_REQUIRED', 'Nhập tên bài học.');
            const version = course.curriculumVersionId ? await models.CurriculumVersion.findById(course.curriculumVersionId).lean() : await ensureFactoryCurriculum(course.educationLevel, course.grade);
            const latestUnit = body.chapterId && isObjectId(body.chapterId) ? await models.CurriculumContent.findOne({ _id: body.chapterId, courseId: course._id, type: 'UNIT' }).lean() : null;
            const code = safeSlug(body.code || `${course.code}-${title}`);
            const theorySections = String(body.theory || '').split(/\n\s*\n/).map((content, index) => ({ title: `Phần ${index + 1}`, content: cleanText(content, 4000) })).filter(section => section.content).slice(0, 40);
            const practice = String(body.practice || '').split(/\n+/).map(line => cleanText(line, 500)).filter(Boolean).slice(0, 40).map((instructions, index) => ({ title: `Bài luyện tập ${index + 1}`, instructions }));
            const examples = String(body.examples || '').split(/\n+/).map(line => cleanText(line, 1000)).filter(Boolean).slice(0, 30).map((content, index) => ({ title: `Ví dụ ${index + 1}`, content }));
            if (theorySections.length < 2) return fail(res, 400, 'LESSON_THEORY_REQUIRED', 'Hãy chia lý thuyết thành ít nhất 2 đoạn bằng cách để một dòng trống giữa các phần.');
            const lesson = await models.CurriculumContent.create({ curriculumVersionId: version._id, type: 'LESSON', parentId: latestUnit?._id || null, courseId: course._id, code, title, description: cleanText(body.description, 1000), educationLevel: course.educationLevel, grade: course.grade, subjectId: course.subjectId, objectives: String(body.objectives || '').split(/\n+/).map(line => cleanText(line, 300)).filter(Boolean).slice(0, 15), theory: theorySections.map(section => section.content).join('\n\n'), theorySections, examples, activities: practice, skills: String(body.skills || '').split(/[,\n]/).map(line => cleanText(line, 120)).filter(Boolean).slice(0, 30), estimatedMinutes: Math.min(360, Math.max(5, Number(body.estimatedMinutes) || 25)), difficulty: cleanText(body.difficulty || 'FOUNDATION', 50), status: 'DRAFT', sourceRef: { sourceType: 'ADMIN_CREATED', organization: 'Hành Trình Mới Admin', documentName: 'Admin Lesson Builder', verification: 'unverified' }, payload: { lectureScript: cleanText(body.lectureScript, 10000), practice, practical: { instructions: cleanText(body.practical, 5000) }, createdVia: 'FORM_BUILDER' } });
            await audit(req, 'CREATE', 'CurriculumContent', lesson._id, null, { title: lesson.title, courseId: String(course._id) });
            return res.status(201).json({ success: true, data: lesson, message: 'Đã tạo bài học bản nháp.' });
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/studio/questions', guarded('learning.question.create'), async (req, res, next) => {
        try {
            const body = req.body || {}; const questionBody = normalizeAdminQuestion(body, { educationLevel: body.educationLevel, grade: body.grade, subjectId: body.subjectId, courseId: isObjectId(body.courseId) ? body.courseId : null, lessonId: isObjectId(body.lessonId) ? body.lessonId : null });
            if (!questionBody.prompt || !['single_choice','multiple_choice','true_false'].includes(questionBody.type) && !['fill_blank','short_answer','numerical','ordering','matching','essay','reading_comprehension','listening','speaking','image_based','coding','practical','timed_simulation'].includes(questionBody.type)) return fail(res, 400, 'QUESTION_INVALID', 'Chọn dạng câu hợp lệ và nhập nội dung.');
            if (['single_choice','multiple_choice','true_false','ordering'].includes(questionBody.type) && questionBody.options.length < 2) return fail(res, 400, 'QUESTION_OPTIONS_REQUIRED', 'Dạng câu hỏi này cần ít nhất 2 lựa chọn.');
            if (questionBody.type === 'true_false' && questionBody.options.length !== 2) return fail(res, 400, 'TRUE_FALSE_OPTIONS_INVALID', 'Câu đúng/sai phải có đúng 2 lựa chọn.');
            const optionValues = questionBody.options.map(option => String(option?.value ?? option?.id ?? option?.label ?? option?.text ?? '').trim()).filter(Boolean);
            const answers = Array.isArray(questionBody.answer) ? questionBody.answer.map(String) : questionBody.answer === undefined || questionBody.answer === null ? [] : [String(questionBody.answer)];
            if (['single_choice','multiple_choice','true_false'].includes(questionBody.type) && !answers.length) return fail(res, 400, 'QUESTION_ANSWER_REQUIRED', 'Câu hỏi trắc nghiệm cần đánh dấu đáp án chuẩn.');
            if (['single_choice','multiple_choice','true_false'].includes(questionBody.type) && answers.some(answer => !optionValues.includes(answer))) return fail(res, 400, 'QUESTION_ANSWER_MISMATCH', 'Đáp án chuẩn phải khớp giá trị của một hoặc nhiều phương án.');
            if (['essay','speaking','practical','coding'].includes(questionBody.type) && !Object.keys(questionBody.rubric || {}).length) return fail(res, 400, 'QUESTION_RUBRIC_REQUIRED', 'Dạng tự luận/nói/thực hành/coding cần tiêu chí chấm.');
            if (questionBody.type === 'coding' && (!questionBody.media?.coding?.starterCode || !Array.isArray(questionBody.media?.coding?.visibleTestCases) || !questionBody.media.coding.visibleTestCases.length)) return fail(res, 400, 'CODING_TESTS_REQUIRED', 'Bài coding cần starter code và ít nhất 1 test công khai.');
            if (['essay','speaking','practical','coding'].includes(questionBody.type) && !Object.keys(questionBody.rubric || {}).length) return fail(res, 400, 'QUESTION_RUBRIC_REQUIRED', 'Dạng tự luận/nói/thực hành/coding cần rubric chấm.');
            const item = await models.Question.create(questionBody); await audit(req, 'CREATE', 'Question', item._id, null, { code: item.code, type: item.type, prompt: item.prompt });
            return res.status(201).json({ success: true, data: item, message: 'Đã lưu câu hỏi bản nháp.' });
        } catch (error) { return next(error); }
    });
    router.post('/admin/platform/studio/assessments', guarded('learning.exam.create'), async (req, res, next) => {
        try {
            const body = req.body || {}; const questionIds = Array.isArray(body.questionIds) ? [...new Set(body.questionIds.filter(isObjectId))] : [];
            if (!cleanText(body.title, 180)) return fail(res, 400, 'ASSESSMENT_TITLE_REQUIRED', 'Nhập tên bài kiểm tra.');
            if (!questionIds.length) return fail(res, 400, 'ASSESSMENT_EMPTY', 'Chọn ít nhất một câu hỏi từ ngân hàng.');
            const questions = await models.Question.find({ _id: { $in: questionIds } }).lean();
            if (questions.length !== questionIds.length) return fail(res, 400, 'ASSESSMENT_QUESTION_NOT_FOUND', 'Một số câu hỏi đã bị archive hoặc không tồn tại.');
            const version = body.curriculumVersionId && isObjectId(body.curriculumVersionId) ? await models.CurriculumVersion.findById(body.curriculumVersionId).lean() : null;
            const course = body.courseId && isObjectId(body.courseId) ? await models.Course.findById(body.courseId).lean() : null;
            const sourceRef = { sourceType: 'ADMIN_CREATED', organization: 'Hành Trình Mới Admin', documentName: 'Admin Assessment Builder', verification: 'unverified' };
            const assessment = await models.Assessment.create({ code: safeSlug(body.code || body.title), title: cleanText(body.title, 180), educationLevel: body.educationLevel || course?.educationLevel, grade: body.grade ? Number(body.grade) : course?.grade || null, curriculumVersionId: version?._id || course?.curriculumVersionId || undefined, subjectId: cleanText(body.subjectId || course?.subjectId || '', 100), courseId: course?._id || undefined, assessmentType: ['LESSON_TEST','CHAPTER_TEST','MIDTERM','FINAL','MOCK','DIAGNOSTIC','FREE_TEST'].includes(body.assessmentType) ? body.assessmentType : 'FREE_TEST', questionIds, questionPool: questionIds, sections: [{ code: 'MAIN', title: cleanText(body.title, 180), questionIds }], durationSeconds: Math.max(60, Math.min(36000, Number(body.durationMinutes || 30) * 60)), attemptLimit: Math.min(20, Math.max(1, Number(body.attemptLimit) || 3)), passingScore: Math.min(100, Math.max(0, Number(body.passingScore) || 70)), randomization: { enabled: Boolean(body.randomize), mode: body.randomize ? 'question' : 'none' }, scoring: { method: 'mixed_percentage', maxScore: questions.reduce((sum, question) => sum + (Number(question.points) || 1), 0), manualReviewTypes: ['short_answer','essay','speaking','practical','coding'] }, reviewSettings: { showExplanationAfterSubmit: body.showExplanations !== false, showCorrectAnswerAfterSubmit: body.showAnswersAfterSubmit === true }, version: '1', publicationStatus: 'DRAFT', sourceRef });
            await audit(req, 'CREATE', 'Assessment', assessment._id, null, { title: assessment.title, questionCount: questionIds.length, status: 'DRAFT' });
            return res.status(201).json({ success: true, data: assessment, message: 'Đã tạo bài kiểm tra dạng bản nháp.' });
        } catch (error) { return next(error); }
    });

    registerPlatformCatalogRoutes({ router, models, repositories, guarded, audit, ok, fail, parsePage, cleanText });

    return router;
}

module.exports = { createPlatformRouter };