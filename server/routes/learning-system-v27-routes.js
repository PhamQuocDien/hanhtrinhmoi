'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { executeCode } = require('../services/code-runner');
const { ensurePersonalCourse, inspectMaterializedCourse } = require('../services/ai-learning-service');
const { withCourseProvisionLock } = require('../services/course-provisioning-coordinator');
const { validateSurvey, validatePlacement } = require('../services/diagnostic-validation');
const { ensureDiagnostics } = require('../../scripts/migrations/012-v27-typed-learning-system');
const {
    normalizeContentBlock, normalizeQuestionForm, validatePracticeTask, auditCourseCatalog,
    buildAdaptiveRecommendations, ageFromDob, sanitizeTaskForLearner, scorePracticeTests, normalizeOutput, normalizeCode
} = require('../services/learning-system-v27');

const MAX_PAGE = 100;
const asId = value => mongoose.Types.ObjectId.isValid(String(value || ''));
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
function listValues(value, depth = 0) {
    if (depth > 5 || value === null || value === undefined || value === '') return [];
    if (Array.isArray(value)) return value.flatMap(item => item === null || item === undefined ? [] : [item]).slice(0, 300);
    if (typeof value === 'string') return value.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean).slice(0, 300);
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    if (typeof value === 'object') {
        for (const key of ['items', 'values', 'goals', 'skills', 'knowledge', 'objectives', 'favoriteSubjects', 'weaknesses', 'data']) {
            if (value[key] !== undefined && value[key] !== value) return listValues(value[key], depth + 1);
        }
        const label = value.label ?? value.name ?? value.title ?? value.skill ?? value.text ?? value.value ?? value.code;
        if (label !== undefined && label !== null) return listValues(label, depth + 1);
    }
    return [];
}
const listText = value => listValues(value).map(item => typeof item === 'object' ? (item.label ?? item.name ?? item.title ?? item.skill ?? item.text ?? item.value ?? item.code ?? '') : String(item)).map(item => text(item, 200)).filter(Boolean).slice(0, 300);
const ownUsername = req => text(req.session?.user?.username, 80);
const isAdmin = req => ['admin', 'super_admin'].includes(String(req.session?.user?.role || '').toLowerCase());
const safeError = message => String(message || 'Có lỗi khi xử lý yêu cầu.').slice(0, 1200);
function selectPracticeCases(visibleCases = [], hiddenCases = [], limit = 12) {
    const visible = visibleCases.slice(0, Math.min(6, visibleCases.length, limit));
    const hidden = hiddenCases.slice(0, Math.min(6, hiddenCases.length, Math.max(0, limit - visible.length)));
    let remaining = Math.max(0, limit - visible.length - hidden.length);
    if (remaining) { const extraVisible = visibleCases.slice(visible.length, visible.length + remaining); visible.push(...extraVisible); remaining -= extraVisible.length; }
    if (remaining) hidden.push(...hiddenCases.slice(hidden.length, hidden.length + remaining));
    return { visible, hidden };
}
function publicQuestion(question) {
    const value = typeof question?.toObject === 'function' ? question.toObject() : { ...question };
    delete value.answer; delete value.acceptedAnswers; delete value.rubric; delete value.solution; delete value.hiddenTestCases;
    return value;
}
function adminPracticeTask(task) {
    if (!task) return null;
    const value = typeof task.toObject === 'function' ? task.toObject() : { ...task };
    delete value.solution;
    value.hiddenTestCaseCount = Array.isArray(value.hiddenTestCases) ? value.hiddenTestCases.length : 0;
    return value;
}
function safeContentBlock(block) {
    const value = typeof block?.toObject === 'function' ? block.toObject() : { ...block };
    if (value.type === 'CODE_CHALLENGE') { delete value.solution; delete value.hiddenTestCases; }
    return value;
}
function safeLearningEvent(event) { return { id: String(event._id), eventType: event.eventType, entityType: event.entityType, entityId: event.entityId, skillCode: event.skillCode, score: event.score, durationSeconds: event.durationSeconds, occurredAt: event.occurredAt, source: event.source }; }

function createLearningSystemV27Router({ models, requireAuth, requirePermission }) {
    const router = express.Router();
    const adaptiveCourseProvisionJobs = new Map();
    const guard = permission => requirePermission ? requirePermission(permission) : requireAuth;
    const learner = requireAuth;
    const fail = (res, status, code, message, details) => res.status(status).json({ success: false, code, message, ...(details ? { details } : {}) });
    const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
    async function audit(req, action, type, id, before = null, after = null) {
        if (!models.AuditLog) return;
        await models.AuditLog.create({ actorUsername: ownUsername(req), action, entityType: type, entityId: String(id || ''), before: before || undefined, after: after || undefined, ip: req.ip, userAgent: text(req.get('user-agent'), 300) }).catch(() => {});
    }
    async function loadPlanEvidence(username) {
        const [profile, education, learning, mastery, errors, courses, tasks, activePlan] = await Promise.all([
            models.Profile?.findOne({ username }).lean() || null,
            models.EducationProfile?.findOne({ username }).lean() || null,
            models.LearningProfile?.findOne({ username }).lean() || null,
            models.SkillMastery?.find({ username }).sort({ updatedAt: -1 }).limit(300).lean() || [],
            models.LearningError?.find({ username }).sort({ createdAt: -1 }).limit(200).lean() || [],
            models.Course?.find({ $or: [{ kind: 'CANONICAL', status: { $in: ['ACTIVE', 'PUBLISHED'] } }, { kind: { $exists: false }, status: { $in: ['ACTIVE', 'PUBLISHED'] }, $or: [{ ownerUsername: '' }, { ownerUsername: null }, { ownerUsername: { $exists: false } }] }, { kind: 'PERSONAL_AI', ownerUsername: username, status: 'ACTIVE' }] }).select('_id code name description subjectId educationLevel grade majorId kind ownerUsername status').limit(3000).lean() || [],
            models.PracticeTask?.find({ status: 'PUBLISHED' }).select('_id code title catalogTrack topic skillCode difficulty courseId lessonId estimatedMinutes status').limit(3000).lean() || [],
            models.LearningPlan?.findOne({ username, status: 'ACTIVE' }).sort({ version: -1 }).lean() || null
        ]);
        const accessibleCourseIds = courses.map(course => course._id);
        const lessons = models.CurriculumContent ? await models.CurriculumContent.find({ type: 'LESSON', status: 'PUBLISHED', $or: [{ courseId: { $in: accessibleCourseIds } }, { $and: [{ courseId: null }, { $or: [{ 'payload.courseId': null }, { 'payload.courseId': '' }] }] }] }).select('_id code title description courseId parentId subjectId grade educationLevel objectives knowledge skills outcomes prerequisiteIds estimatedMinutes status theory theorySections activities').limit(12000).lean() : [];
        return { profile: profile || {}, education: education || {}, learning: learning || {}, mastery: mastery || [], errors: errors || [], courses: courses || [], lessons: lessons || [], tasks: tasks || [], activePlan: activePlan || null };
    }
    function recommendationsFromEvidence(evidence) {
        const recommendations = buildAdaptiveRecommendations({ profile: evidence.profile, education: evidence.education, learning: evidence.learning, mastery: evidence.mastery, errors: evidence.errors, lessons: evidence.lessons, courses: evidence.courses, tasks: evidence.tasks });
        const normalize = value => text(value, 200).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const previousItems = [...(evidence.activePlan?.recommendations || []), ...(evidence.activePlan?.subjects || [])].filter(item => item && (item.skill || item.skillCode));
        const previousLinks = previousItems.filter(item => item.courseGap !== true && item.courseId).map(item => [normalize(item.skill || item.skillCode), item]);
        const linkedBySkill = new Map(previousLinks);
        const previousGaps = new Map(previousItems.filter(item => item.courseGap === true && item.courseProvisionStatus === 'FAILED').map(item => [normalize(item.skill || item.skillCode), item]));
        return recommendations.map(item => {
            const previousGap = previousGaps.get(normalize(item.skill));
            const lastAttempt = new Date(previousGap?.courseProvisionLastAttemptAt || 0).getTime();
            if (previousGap && Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 30 * 60 * 1000) return { ...item, courseProvisionStatus: 'FAILED', courseProvisionLastAttemptAt: previousGap.courseProvisionLastAttemptAt, courseProvisionMessage: previousGap.courseProvisionMessage || 'Tạo tự động chưa thành công; có thể bấm thử lại.' };
            const previous = linkedBySkill.get(normalize(item.skill));
            if (!previous) return item;
            const course = evidence.courses.find(value => String(value._id) === String(previous.courseId));
            const lesson = evidence.lessons.find(value => String(value._id) === String(previous.lessonId) && String(value.courseId || '') === String(previous.courseId));
            const allowed = course && (course.kind === 'CANONICAL' || (course.kind === 'PERSONAL_AI' && course.ownerUsername === evidence.profile?.username));
            if (!allowed || !lesson) return item;
            return { ...item, courseId: course._id, courseName: course.name || previous.courseName || '', courseCode: course.code || previous.courseCode || '', lessonId: lesson._id, lessonTitle: lesson.title || previous.lessonTitle || '', courseGap: false, courseSource: course.kind === 'PERSONAL_AI' ? 'PERSONAL_AI' : previous.courseSource || 'CATALOG', reason: previous.reason || item.reason };
        });
    }
    async function rebuildAdaptivePlan(username) {
        const evidence = await loadPlanEvidence(username);
        const recommendations = recommendationsFromEvidence(evidence);
        const oldPlans = await models.LearningPlan.find({ username }).sort({ version: -1 }).limit(100).select('_id version').lean();
        const version = oldPlans.reduce((max, plan) => Math.max(max, Number(plan.version) || 0), 0) + 1;
        if (evidence.activePlan?._id) await models.LearningPlan.updateOne({ _id: evidence.activePlan._id, username }, { $set: { status: 'ARCHIVED' } });
        const dob = evidence.profile.dob || {};
        const plan = await models.LearningPlan.create({ username, educationStage: evidence.education.educationLevel || 'UNSPECIFIED', age: ageFromDob(dob), educationStatus: evidence.education.educationStatus || '', currentGrade: evidence.education.grade || null, target: { goals: evidence.learning.goals || [], majorName: evidence.education.majorName || '', targetExam: evidence.learning.survey?.targetExam || '' }, version, status: 'ACTIVE', generatedAt: new Date(), subjects: recommendations.map(item => ({ skill: item.skill, skillCode: normalizeCode(item.skill), currentLevel: item.currentLevel, targetLevel: item.targetLevel, gap: item.gap, priority: item.priority, courseId: item.courseId, courseName: item.courseName, lessonId: item.lessonId, lessonTitle: item.lessonTitle, practiceTaskId: item.practiceTaskId, practiceTaskTitle: item.practiceTaskTitle, courseGap: item.courseGap, reason: item.reason, estimatedMinutes: item.estimatedMinutes })), recommendations, diagnostics: { source: 'ADAPTIVE_V27', generatedBy: 'SYSTEM_RULES', skillCount: evidence.mastery.length, learningErrorCount: evidence.errors.length, generatedAt: new Date().toISOString() } });
        const steps = recommendations.map((item, index) => ({ username, planId: plan._id, planVersion: version, sequence: index + 1, kind: item.courseGap ? 'COURSE_GAP' : item.type === 'REVIEW' ? 'REVIEW' : item.type === 'PRACTICE' ? 'PRACTICE' : 'LESSON', title: item.practiceTaskTitle || item.lessonTitle || item.courseName || `Củng cố: ${item.skill}`, skillCode: normalizeCode(item.skill), currentLevel: item.currentLevel, targetLevel: item.targetLevel, gap: item.gap, priority: item.priority, courseId: item.courseId || undefined, lessonId: item.lessonId || undefined, practiceTaskId: item.practiceTaskId || undefined, reason: item.reason, estimatedMinutes: item.estimatedMinutes, status: item.courseGap ? 'COURSE_GAP' : 'READY' }));
        if (steps.length) await models.LearningPlanStep.insertMany(steps, { ordered: false });
        await models.LearningEvent.create({ username, eventType: 'PLAN_GENERATED', entityType: 'LearningPlan', entityId: String(plan._id), source: 'ADAPTIVE_V27', idempotencyKey: `plan:${String(plan._id)}`, metadata: { reason: `version:${version}` } }).catch(() => {});
        await models.LearningProfile.findOneAndUpdate({ username }, { $set: { learningPlanId: plan._id } }, { upsert: true });
        return { plan, steps, age: plan.age };
    }
    async function provisionAdaptiveCourseGaps(username, evidence, recommendations, { limit = 2, skill = '', forceRetry = false } = {}) {
        const norm = value => text(value, 200).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const targetSkill = norm(skill);
        const gaps = recommendations.filter(item => item.courseGap && (!targetSkill || norm(item.skill) === targetSkill) && (forceRetry || item.courseProvisionStatus !== 'FAILED' || !item.courseProvisionLastAttemptAt || Date.now() - new Date(item.courseProvisionLastAttemptAt).getTime() >= 30 * 60 * 1000)).slice(0, Math.max(1, Math.min(8, Number(limit) || 2)));
        const linked = [];
        for (const gap of gaps) {
            try {
                gap.courseProvisionStatus = 'RUNNING';
                const prompt = `Tạo khóa học về ${gap.skill}. Dựa trên độ tuổi/cấp học và mục tiêu hiện tại, xây dựng lộ trình có bài học chi tiết, lý thuyết từng phần, ví dụ có lời giải, luyện tập có hướng dẫn, bài độc lập, vận dụng thực tế và bài kiểm tra chỉ về kỹ năng này.`;
                const created = await withCourseProvisionLock(username, gap.skill, () => ensurePersonalCourse({ models, username, request: { courseTitle: gap.skill, prompt, domain: gap.skill, grade: evidence.education?.grade, educationLevel: evidence.education?.educationLevel, subjectId: evidence.education?.subjectId || '', targetExam: evidence.learning?.survey?.targetExam || '', forceCreate: true, generateAudio: false } }));
                if (!created.courseId || !created.course) {
                    gap.courseProvisionStatus = 'FAILED';
                    gap.courseProvisionLastAttemptAt = new Date();
                    gap.courseProvisionMessage = 'Chưa thể tạo khóa học tự động; hệ thống sẽ tiếp tục thử khi người học mở lại lộ trình.';
                    continue;
                }
                const persisted = await inspectMaterializedCourse(models, created.course, 12);
                if (!persisted.ready || !persisted.lessons.length) {
                    gap.courseProvisionStatus = 'FAILED';
                    gap.courseProvisionLastAttemptAt = new Date();
                    gap.courseProvisionMessage = `Khóa học chưa đủ nội dung đã lưu (${(persisted.missing || ['lesson_missing']).join(', ')}).`;
                    gap.reason = `${gap.courseProvisionMessage} COURSE_GAP vẫn được giữ để tránh liên kết giả.`;
                    continue;
                }
                const firstLesson = persisted.lessons[0];
                Object.assign(gap, { type: 'GENERATED_COURSE', courseGap: false, courseId: created.courseId, courseName: created.course.name || gap.skill, courseCode: created.course.code || '', lessonId: firstLesson._id, lessonTitle: firstLesson.title || '', courseSource: 'PERSONAL_AI', courseProvisionStatus: 'READY', courseProvisionMessage: '', reason: `Đã tạo và xác minh ${persisted.lessonCount} bài học cùng bài kiểm tra được lưu thật.`, generation: created.generation?.model || created.materialized?.generation?.model || 'LOCAL-EDUCATION-COMPOSER-V32' });
                linked.push(gap);
            } catch (error) {
                gap.courseProvisionStatus = 'FAILED';
                gap.courseProvisionLastAttemptAt = new Date();
                gap.courseProvisionMessage = 'Có lỗi khi tạo khóa học tự động; hệ thống sẽ cho phép thử lại.';
                gap.reason = `${gap.courseProvisionMessage} COURSE_GAP vẫn được giữ.`;
                console.warn(`Tự tạo khóa học cho khoảng trống ${gap.skill} thất bại:`, error.message);
            }
        }
        if (gaps.length && evidence.activePlan?._id) {
            const active = await models.LearningPlan.findOne({ _id: evidence.activePlan._id, username, status: 'ACTIVE' });
            if (active) {
                const resultForSkill = item => recommendations.find(value => norm(value.skill) === norm(item.skill || item.skillCode || ''));
                active.subjects = (active.subjects || []).map(subject => {
                    const update = resultForSkill(subject);
                    if (!update) return subject;
                    const current = subject.toObject?.() || subject;
                    return { ...current, courseGap: Boolean(update.courseGap), courseId: update.courseId || null, courseName: update.courseName || '', lessonId: update.lessonId || null, lessonTitle: update.lessonTitle || '', reason: update.reason || current.reason, courseSource: update.courseSource || current.courseSource || '', courseProvisionStatus: update.courseProvisionStatus || current.courseProvisionStatus || '', courseProvisionLastAttemptAt: update.courseProvisionLastAttemptAt || current.courseProvisionLastAttemptAt, courseProvisionMessage: update.courseProvisionMessage || '' };
                });
                active.recommendations = recommendations;
                await active.save();
                if (models.LearningPlanStep?.updateMany) for (const item of linked) await models.LearningPlanStep.updateMany({ username, planId: active._id, skillCode: normalizeCode(item.skill), status: 'COURSE_GAP' }, { $set: { kind: 'LESSON', status: 'READY', courseId: item.courseId, lessonId: item.lessonId || undefined, title: item.lessonTitle || item.courseName, reason: item.reason } });
            }
        }
        return { recommendations, autoCreatedCourseCount: linked.length, pendingCount: recommendations.filter(item => item.courseGap).length };
    }
    function scheduleAdaptiveCourseGaps(username, evidence, recommendations, options = {}) {
        const jobKey = `${username}:${String(evidence.activePlan?._id || 'no-plan')}`;
        if (adaptiveCourseProvisionJobs.has(jobKey)) return adaptiveCourseProvisionJobs.get(jobKey);
        const job = provisionAdaptiveCourseGaps(username, evidence, recommendations, options).finally(() => adaptiveCourseProvisionJobs.delete(jobKey));
        adaptiveCourseProvisionJobs.set(jobKey, job);
        return job;
    }

    router.get('/health', (req, res) => ok(res, { version: '39.0.0', feature: 'typed-learning-system', localAI: true, cloudRequired: false }));

    router.get('/admin/overview', guard('learning.lesson.read'), async (req, res, next) => {
        try {
            const count = async Model => Model?.countDocuments ? Model.countDocuments({}) : 0;
            const [courses, lessons, questions, assessments, surveys, placements, blocks, tasks, attempts, learningEvents, jobs, quality] = await Promise.all([
                count(models.Course), count(models.CurriculumContent), count(models.Question), count(models.Assessment), count(models.Survey), count(models.PlacementTest), count(models.ContentBlock), count(models.PracticeTask), count(models.PracticeAttempt), count(models.LearningEvent), count(models.AIGenerationJob), count(models.CourseQualitySnapshot)
            ]);
            const [publishedSurveys, publishedPlacements, queuedJobs, failedJobs, recentAttempts] = await Promise.all([
                models.Survey.find({ status: 'PUBLISHED' }).lean(), models.PlacementTest.find({ status: 'PUBLISHED' }).lean(), models.AIGenerationJob.countDocuments({ status: { $in: ['QUEUED', 'RUNNING', 'WAITING_RETRY'] } }), models.AIGenerationJob.countDocuments({ status: 'FAILED' }), models.PracticeAttempt.find({}).sort({ submittedAt: -1 }).limit(10).select('taskId status score submittedAt').lean()
            ]);
            return ok(res, { counts: { courses, lessons, questions, assessments, surveys, placements, contentBlocks: blocks, practiceTasks: tasks, practiceAttempts: attempts, learningEvents, generationJobs: jobs, qualitySnapshots: quality }, diagnosticHealth: { publishedValidSurveys: publishedSurveys.filter(item => validateSurvey(item).valid).length, publishedInvalidSurveys: publishedSurveys.filter(item => !validateSurvey(item).valid).length, publishedValidPlacements: publishedPlacements.filter(item => validatePlacement(item).valid).length, publishedInvalidPlacements: publishedPlacements.filter(item => !validatePlacement(item).valid).length }, jobs: { queued: queuedJobs, failed: failedJobs }, recentAttempts });
        } catch (error) { next(error); }
    });

    router.get('/admin/content-audit', guard('learning.lesson.read'), async (req, res, next) => {
        try {
            const [courses, lessons, questions, assessments, tasks, blocks] = await Promise.all([
                models.Course.find({ status: { $nin: ['ARCHIVED', 'DELETED'] } }).limit(5000).lean(), models.CurriculumContent.find({ type: 'LESSON', status: { $nin: ['ARCHIVED', 'DELETED'] } }).limit(15000).lean(), models.Question.find({}).limit(25000).lean(), models.Assessment.find({}).limit(10000).lean(), models.PracticeTask.find({}).limit(10000).lean(), models.ContentBlock.find({}).limit(25000).lean()
            ]);
            const report = auditCourseCatalog({ courses, lessons, questions, assessments, practiceTasks: tasks, blocks });
            const surveys = await models.Survey.find({}).limit(2000).lean();
            const placements = await models.PlacementTest.find({}).limit(2000).lean();
            report.diagnostics = { surveys: surveys.map(item => ({ id: String(item._id), title: item.title, status: item.status, version: item.version, ...validateSurvey(item) })), placements: placements.map(item => ({ id: String(item._id), code: item.code, title: item.title, status: item.status, ...validatePlacement(item) })) };
            return ok(res, report);
        } catch (error) { next(error); }
    });

    router.post('/admin/diagnostics/repair', guard('learning.survey.manage'), async (req, res, next) => {
        try { const result = await ensureDiagnostics(console); await audit(req, 'REPAIR_DIAGNOSTIC_CATALOG', 'SurveyPlacement', 'baseline', null, result); return ok(res, result, 'Đã kiểm tra và sửa danh mục khảo sát/placement cơ bản.'); }
        catch (error) { next(error); }
    });

    router.get('/admin/catalog-gaps', guard('learning.lesson.read'), async (req, res, next) => {
        try {
            const [courses, lessons, tasks, mastery, learningProfiles] = await Promise.all([
                models.Course.find({ status: { $in: ['ACTIVE', 'PUBLISHED'] } }).select('code name subjectId educationLevel majorId category').limit(5000).lean(),
                models.CurriculumContent.find({ type: 'LESSON', status: 'PUBLISHED' }).select('title subjectId skills knowledge status').limit(15000).lean(),
                models.PracticeTask.find({ status: 'PUBLISHED' }).select('title skillCode catalogTrack status').limit(10000).lean(),
                models.SkillMastery.find({}).select('skill accuracy averageScore status').limit(10000).lean(),
                models.LearningProfile.find({}).select('goals survey skills').limit(10000).lean()
            ]);
            const frequency = new Map();
            for (const profile of learningProfiles) {
                const values = [...listText(profile.goals), ...listText(profile.survey?.favoriteSubjects), ...listText(profile.survey?.weaknesses), ...Object.keys(profile.skills && typeof profile.skills === 'object' && !Array.isArray(profile.skills) ? profile.skills : {})];
                for (const value of values) { const key = text(value, 120); if (key) frequency.set(key, (frequency.get(key) || 0) + 1); }
            }
            const weak = mastery.filter(item => Number(item.accuracy ?? item.averageScore ?? 0) < 60).reduce((map, item) => { const key = text(item.skill, 120); if (key) map.set(key, (map.get(key) || 0) + 1); return map; }, new Map());
            const gaps = [...new Set([...frequency.keys(), ...weak.keys()])].map(skill => {
                const foundLessons = lessons.filter(item => `${item.title || ''} ${listText(item.skills).join(' ')} ${listText(item.knowledge).join(' ')}`.toLowerCase().includes(skill.toLowerCase()));
                const foundTasks = tasks.filter(item => `${item.title} ${item.skillCode}`.toLowerCase().includes(skill.toLowerCase()));
                return { skill, demand: frequency.get(skill) || 0, lowMasteryEvidence: weak.get(skill) || 0, matchingLessonCount: foundLessons.length, matchingPracticeCount: foundTasks.length, courses: courses.filter(course => `${course.name} ${course.subjectId} ${course.code}`.toLowerCase().includes(skill.toLowerCase())).slice(0, 5).map(course => ({ id: course._id, code: course.code, name: course.name })), suggestedAction: foundLessons.length && foundTasks.length ? 'RECOMMEND_EXISTING' : 'COURSE_GAP' };
            }).sort((a, b) => b.lowMasteryEvidence + b.demand - (a.lowMasteryEvidence + a.demand)).slice(0, 100);
            return ok(res, { gaps, demandProfileCount: learningProfiles.length, generatedAt: new Date().toISOString() });
        } catch (error) { next(error); }
    });

    router.get('/content-blocks/lesson/:id', learner, async (req, res, next) => {
        try {
            if (!asId(req.params.id)) return fail(res, 400, 'INVALID_LESSON_ID', 'Mã bài học không hợp lệ.');
            const lesson = await models.CurriculumContent.findOne({ _id: req.params.id, type: 'LESSON', status: 'PUBLISHED' }).select('_id courseId').lean();
            if (!lesson) return fail(res, 404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học đã công bố.');
            const blocks = await models.ContentBlock.find({ lessonId: lesson._id, status: 'PUBLISHED' }).sort({ order: 1, createdAt: 1 }).limit(300).lean();
            return ok(res, blocks.map(safeContentBlock));
        } catch (error) { next(error); }
    });

    router.get('/admin/content-blocks', guard('learning.lesson.read'), async (req, res, next) => {
        try { const filter = {}; if (asId(req.query.lessonId)) filter.lessonId = req.query.lessonId; if (asId(req.query.courseId)) filter.courseId = req.query.courseId; if (req.query.status) filter.status = text(req.query.status, 30); return ok(res, (await models.ContentBlock.find(filter).sort({ order: 1, createdAt: 1 }).limit(MAX_PAGE * 10).lean()).map(safeContentBlock)); }
        catch (error) { next(error); }
    });
    router.post('/admin/content-blocks', guard('learning.lesson.create'), async (req, res, next) => {
        try {
            const normalized = normalizeContentBlock(req.body || {});
            if (!normalized.valid) return fail(res, 400, 'CONTENT_VALIDATION_FAILED', 'Nội dung chưa hợp lệ.', normalized.errors);
            if (!asId(req.body?.lessonId) && !asId(req.body?.courseId)) return fail(res, 400, 'CONTENT_PARENT_REQUIRED', 'Chọn bài học hoặc khóa học để gắn nội dung.');
            if (asId(req.body?.lessonId)) { const lesson = await models.CurriculumContent.findOne({ _id: req.body.lessonId, type: 'LESSON' }).select('_id courseId').lean(); if (!lesson) return fail(res, 404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học được chọn.'); normalized.block.lessonId = lesson._id; normalized.block.courseId = lesson.courseId || req.body.courseId || null; }
            if (asId(req.body?.courseId)) { const course = await models.Course.findById(req.body.courseId).select('_id').lean(); if (!course) return fail(res, 404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học được chọn.'); normalized.block.courseId = course._id; }
            normalized.block.ownerUsername = ownUsername(req); const item = await models.ContentBlock.create(normalized.block); await audit(req, 'CREATE', 'ContentBlock', item._id, null, item.toObject()); return res.status(201).json({ success: true, data: safeContentBlock(item), message: 'Đã tạo phần nội dung ở trạng thái bản nháp.' });
        } catch (error) { if (error?.code === 11000) return fail(res, 409, 'CONTENT_CODE_EXISTS', 'Mã phần nội dung đã tồn tại.'); next(error); }
    });
    router.patch('/admin/content-blocks/:id', guard('learning.lesson.update'), async (req, res, next) => {
        try { if (!asId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã nội dung không hợp lệ.'); const before = await models.ContentBlock.findById(req.params.id); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy phần nội dung.'); const body = { ...req.body }; delete body._id; delete body.status; delete body.sourceVerified; const normalized = normalizeContentBlock({ ...before.toObject(), ...body, status: before.status }); if (!normalized.valid) return fail(res, 400, 'CONTENT_VALIDATION_FAILED', 'Nội dung chưa hợp lệ.', normalized.errors); const updated = await models.ContentBlock.findByIdAndUpdate(req.params.id, { $set: normalized.block }, { new: true, runValidators: true }); await audit(req, 'UPDATE', 'ContentBlock', updated._id, before.toObject(), updated.toObject()); return ok(res, safeContentBlock(updated), 'Đã cập nhật phần nội dung.'); }
        catch (error) { next(error); }
    });
    router.post('/admin/content-blocks/:id/publish', guard('learning.lesson.publish'), async (req, res, next) => {
        try { if (!asId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã nội dung không hợp lệ.'); const item = await models.ContentBlock.findById(req.params.id); if (!item) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy phần nội dung.'); const check = normalizeContentBlock({ ...item.toObject(), status: 'PUBLISHED' }); if (!check.valid) return fail(res, 400, 'CONTENT_VALIDATION_FAILED', 'Không thể công bố phần nội dung.', check.errors); if (item.sourceType === 'OFFICIAL' && item.sourceVerified !== true) return fail(res, 400, 'OFFICIAL_SOURCE_NOT_VERIFIED', 'Tài liệu chưa có nguồn được xác minh.'); const before = item.toObject(); item.status = 'PUBLISHED'; await item.save(); await audit(req, 'PUBLISH', 'ContentBlock', item._id, before, item.toObject()); return ok(res, safeContentBlock(item), 'Đã công bố phần nội dung.'); }
        catch (error) { next(error); }
    });

    router.get('/practice/tasks', learner, async (req, res, next) => {
        try { const filter = { status: 'PUBLISHED' }; if (asId(req.query.courseId)) filter.$or = [{ courseId: req.query.courseId }, { courseId: null }]; if (req.query.track) filter.catalogTrack = text(req.query.track, 60).toUpperCase(); if (req.query.skill) filter.skillCode = normalizeCode(req.query.skill); const tasks = await models.PracticeTask.find(filter).sort({ difficulty: 1, code: 1 }).limit(Math.min(MAX_PAGE, Math.max(1, Number(req.query.limit) || 30))).lean(); return ok(res, tasks.map(sanitizeTaskForLearner)); }
        catch (error) { next(error); }
    });
    router.get('/practice/tasks/:id', learner, async (req, res, next) => {
        try { const query = asId(req.params.id) ? { _id: req.params.id, status: 'PUBLISHED' } : { code: text(req.params.id, 100).toUpperCase(), status: 'PUBLISHED' }; const task = await models.PracticeTask.findOne(query).lean(); if (!task) return fail(res, 404, 'PRACTICE_NOT_FOUND', 'Không tìm thấy bài thực hành đã công bố.'); return ok(res, sanitizeTaskForLearner(task)); }
        catch (error) { next(error); }
    });
    router.post('/practice/tasks/:id/submit', learner, async (req, res, next) => {
        try {
            const username = ownUsername(req); const task = await models.PracticeTask.findOne({ _id: req.params.id, status: 'PUBLISHED' }).lean();
            if (!task) return fail(res, 404, 'PRACTICE_NOT_FOUND', 'Không tìm thấy bài thực hành đã công bố.');
            const code = String(req.body?.code || ''); const language = text(req.body?.language || task.language, 20).toLowerCase();
            if (!task.supportedLanguages.includes(language)) return fail(res, 400, 'LANGUAGE_NOT_SUPPORTED', 'Ngôn ngữ này chưa được bật cho bài thực hành.');
            if (!code.trim() || Buffer.byteLength(code, 'utf8') > 512000) return fail(res, 400, 'INVALID_CODE', 'Mã nguồn trống hoặc vượt quá giới hạn 512 KB.');
            const runnerCheck = await executeCode({ language, code, stdin: '' });
            if (runnerCheck.disabled || runnerCheck.status === 'SANDBOX_REQUIRED') return fail(res, 503, 'CODE_RUNNER_UNAVAILABLE', runnerCheck.message || 'Bộ chạy code hiện chưa được bật an toàn. Hãy cấu hình executor biệt lập.');
            const visibleResults = [];
            const hiddenResults = [];
            const selectedTests = selectPracticeCases(task.visibleTestCases || [], task.hiddenTestCases || [], 12);
            let runtimeMs = 0;
            for (const test of selectedTests.visible) {
                const output = await executeCode({ language, code, stdin: test.input }); runtimeMs += Number(output.runtimeMs || 0);
                const passed = output.status === 'SUCCESS' && normalizeOutput(output.stdout) === normalizeOutput(test.expectedOutput);
                visibleResults.push({ passed, expectedOutput: test.expectedOutput, actualOutput: normalizeOutput(output.stdout || output.stderr), status: output.status, weight: Number(test.weight) || 1, pointsEarned: passed ? (Number(test.weight) || 1) : 0 });
                if (output.status === 'DISABLED' || output.status === 'SANDBOX_REQUIRED') return fail(res, 503, 'CODE_RUNNER_UNAVAILABLE', output.message || 'Bộ chạy code chưa sẵn sàng.');
            }
            for (const test of selectedTests.hidden) {
                const output = await executeCode({ language, code, stdin: test.input }); runtimeMs += Number(output.runtimeMs || 0);
                const passed = output.status === 'SUCCESS' && normalizeOutput(output.stdout) === normalizeOutput(test.expectedOutput);
                hiddenResults.push({ passed, weight: Number(test.weight) || 1 });
                if (output.status === 'DISABLED' || output.status === 'SANDBOX_REQUIRED') return fail(res, 503, 'CODE_RUNNER_UNAVAILABLE', output.message || 'Bộ chạy code chưa sẵn sàng.');
            }
            const scoring = scorePracticeTests(visibleResults, hiddenResults);
            const score = scoring.score;
            const status = score === 100 ? 'PASSED' : score > 0 ? 'PARTIAL' : 'FAILED';
            const attempt = await models.PracticeAttempt.create({ username, taskId: task._id, code, language, status, score, scoreBreakdown: { earnedWeight: scoring.earnedWeight, possibleWeight: scoring.possibleWeight, visibleEarnedWeight: scoring.visible.earnedWeight, visiblePossibleWeight: scoring.visible.possibleWeight, hiddenEarnedWeight: scoring.hidden.earnedWeight, hiddenPossibleWeight: scoring.hidden.possibleWeight }, visiblePassed: visibleResults.filter(test => test.passed).length, visibleTotal: visibleResults.length, hiddenPassed: hiddenResults.filter(test => test.passed).length, hiddenTotal: hiddenResults.length, runtimeMs, feedback: status === 'PASSED' ? ['Tất cả test đã qua.'] : ['Có test chưa đạt. Kiểm tra lại các trường hợp biên và cách phân tích dữ liệu đầu vào.'], submittedAt: new Date() });
            await models.LearningEvent.create({ username, eventType: 'PRACTICE_SUBMITTED', entityType: 'PracticeTask', entityId: String(task._id), skillCode: task.skillCode, score, source: 'CODE_PRACTICE', idempotencyKey: `practice:${attempt._id}`, metadata: { attemptStatus: status, reason: task.code } }).catch(() => {});
            const previous = await models.SkillMastery.findOne({ username, skill: task.skillCode });
            const priorScore = Number(previous?.accuracy ?? previous?.averageScore ?? score); const masteryScore = previous ? Math.round(priorScore * 0.65 + score * 0.35) : score;
            await models.SkillMastery.findOneAndUpdate({ username, skill: task.skillCode }, { $set: { accuracy: masteryScore, averageScore: masteryScore, recentScore: score, status: masteryScore >= 80 ? 'MASTERED' : masteryScore < 50 ? 'REVIEW_REQUIRED' : 'PRACTICING', lastAttempt: new Date(), reviewDueAt: new Date(Date.now() + (masteryScore >= 80 ? 7 : 1) * 86400000), courseId: task.courseId || undefined }, $inc: { attempts: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            const updatedPlan = await rebuildAdaptivePlan(username);
            return ok(res, { attempt: { id: String(attempt._id), status, score, scoreBreakdown: attempt.scoreBreakdown, visiblePassed: attempt.visiblePassed, visibleTotal: attempt.visibleTotal, hiddenPassed: attempt.hiddenPassed, hiddenTotal: attempt.hiddenTotal, runtimeMs }, visibleResults, hiddenSummary: { passed: attempt.hiddenPassed, total: attempt.hiddenTotal, earnedWeight: scoring.hidden.earnedWeight, possibleWeight: scoring.hidden.possibleWeight }, scoringModel: 'WEIGHTED_TEST_CASES', skill: task.skillCode, masteryScore, learningPlanVersion: updatedPlan.plan.version }, status === 'PASSED' ? 'Chúc mừng, bạn đã vượt qua toàn bộ test. Lộ trình cũng đã được cập nhật.' : 'Đã chấm bài và cập nhật lộ trình theo kỹ năng này.');
        } catch (error) { next(error); }
    });

    router.get('/plan/recommendations', learner, async (req, res, next) => {
        try {
            const username = ownUsername(req);
            const evidence = await loadPlanEvidence(username);
            const recommendations = recommendationsFromEvidence(evidence);
            const canStart = recommendations.filter(item => item.courseGap && (item.courseProvisionStatus !== 'FAILED' || !item.courseProvisionLastAttemptAt || Date.now() - new Date(item.courseProvisionLastAttemptAt).getTime() >= 30 * 60 * 1000));
            if (canStart.length) scheduleAdaptiveCourseGaps(username, evidence, recommendations, { limit: 2 }).catch(error => console.warn(`Tự động tạo khóa từ đề xuất lộ trình thất bại cho ${username}:`, error.message));
            const retryWaitCount = recommendations.filter(item => item.courseGap && item.courseProvisionStatus === 'FAILED' && item.courseProvisionLastAttemptAt && Date.now() - new Date(item.courseProvisionLastAttemptAt).getTime() < 30 * 60 * 1000).length;
            return ok(res, { recommendations, plan: evidence.activePlan, age: ageFromDob(evidence.profile.dob), personalizedBy: ['education', 'goals', 'skillMastery', 'learningErrors', 'accessible-published-catalog', 'local-course-composer', 'persisted-course-integrity-check'], autoCreatedCourseCount: recommendations.filter(item => item.courseSource === 'PERSONAL_AI' && !item.courseGap).length, autoProvisioning: { status: canStart.length ? 'STARTED' : retryWaitCount ? 'RETRY_WAIT' : 'NOT_REQUIRED', pendingCount: canStart.length + retryWaitCount, retryWaitCount, mode: 'LOCAL_EDUCATION_AI' } });
        } catch (error) { next(error); }
    });
    router.post('/plan/retry-gaps', learner, async (req, res, next) => {
        try {
            const username = ownUsername(req);
            const evidence = await loadPlanEvidence(username);
            const recommendations = recommendationsFromEvidence(evidence);
            const norm = value => text(value, 200).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            const skill = text(req.body?.skill || '', 200);
            const matching = recommendations.filter(item => item.courseGap && (!skill || norm(item.skill) === norm(skill)));
            if (!matching.length) return fail(res, 404, 'COURSE_GAP_NOT_FOUND', 'Không còn khoảng trống khóa học phù hợp để tạo lại. Hãy tải lại lộ trình.');
            const result = await provisionAdaptiveCourseGaps(username, evidence, recommendations, { limit: 1, skill, forceRetry: true });
            return ok(res, { ...result, age: ageFromDob(evidence.profile.dob), autoProvisioning: { status: result.pendingCount ? 'PENDING' : 'COMPLETE', mode: 'LOCAL_EDUCATION_AI' } }, result.autoCreatedCourseCount ? 'Đã tạo và kiểm tra khóa học cá nhân.' : 'Chưa tạo xong khóa học; khoảng trống vẫn được giữ để tránh liên kết giả.');
        } catch (error) { next(error); }
    });
    router.post('/plan/rebuild', learner, async (req, res, next) => {
        try { const result = await rebuildAdaptivePlan(ownUsername(req)); return ok(res, result, 'Đã tạo lộ trình mới từ hồ sơ, kỹ năng và kết quả học tập.'); }
        catch (error) { next(error); }
    });
    router.get('/plan/steps', learner, async (req, res, next) => {
        try { const username = ownUsername(req); const active = await models.LearningPlan.findOne({ username, status: 'ACTIVE' }).sort({ version: -1 }).select('_id version').lean(); if (!active) return ok(res, []); const steps = await models.LearningPlanStep.find({ username, planId: active._id }).sort({ sequence: 1 }).lean(); return ok(res, steps); }
        catch (error) { next(error); }
    });

    router.get('/admin/analytics', guard('system.manage'), async (req, res, next) => {
        try {
            const now = new Date(); const since = new Date(now.getTime() - 30 * 86400000);
            const [users, activePlans, progress, practiceAttempts, assessmentAttempts, lessonEvents, masteredSkills, recentEvents] = await Promise.all([
                models.Profile.countDocuments({}), models.LearningPlan.countDocuments({ status: 'ACTIVE' }), models.LessonProgress.find({ lastSeenAt: { $gte: since } }).select('username courseId lessonId completed timeSpentSeconds progressPercent').lean(), models.PracticeAttempt.find({ submittedAt: { $gte: since } }).select('taskId status score submittedAt').lean(), models.AssessmentAttempt.find({ submittedAt: { $gte: since } }).select('username assessmentId status score submittedAt').lean(), models.LearningEvent.find({ occurredAt: { $gte: since } }).select('username eventType skillCode score occurredAt').lean(), models.SkillMastery.countDocuments({ status: 'MASTERED' }), models.LearningEvent.find({}).sort({ occurredAt: -1 }).limit(30).lean()
            ]);
            const uniqueLearners = new Set([...progress.map(item => item.username), ...practiceAttempts.map(item => item.username), ...assessmentAttempts.map(item => item.username)]).size;
            const totalTimeSeconds = progress.reduce((sum, item) => sum + Number(item.timeSpentSeconds || 0), 0);
            const scoreAverage = list => list.length ? Math.round(list.reduce((sum, item) => sum + Number(item.score || 0), 0) / list.length) : null;
            const skillMap = new Map(); for (const event of lessonEvents) { if (!event.skillCode) continue; const current = skillMap.get(event.skillCode) || { skill: event.skillCode, evidenceCount: 0, averageScore: 0, sum: 0 }; current.evidenceCount += 1; current.sum += Number(event.score || 0); current.averageScore = Math.round(current.sum / current.evidenceCount); skillMap.set(event.skillCode, current); }
            return ok(res, { periodDays: 30, learnerProfiles: users, activeLearningPlans: activePlans, activeLearners30d: uniqueLearners, completedLessonProgress: progress.filter(item => item.completed).length, lessonProgressRecords: progress.length, practiceAttempts: practiceAttempts.length, practicePassRate: practiceAttempts.length ? Math.round(practiceAttempts.filter(item => item.status === 'PASSED').length / practiceAttempts.length * 100) : null, practiceAverageScore: scoreAverage(practiceAttempts), assessmentAttempts: assessmentAttempts.length, assessmentAverageScore: scoreAverage(assessmentAttempts), totalTrackedStudyMinutes: Math.round(totalTimeSeconds / 60), masteredSkillRecords: masteredSkills, skillPerformance: [...skillMap.values()].sort((a, b) => a.averageScore - b.averageScore).slice(0, 30), eventCounts: Object.entries(lessonEvents.reduce((map, item) => { map[item.eventType] = (map[item.eventType] || 0) + 1; return map; }, {})).map(([eventType, count]) => ({ eventType, count })), recentEvents: recentEvents.map(safeLearningEvent) });
        } catch (error) { next(error); }
    });
    router.post('/admin/course-audit/:id/snapshot', guard('system.manage'), async (req, res, next) => {
        try { if (!asId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã khóa học không hợp lệ.'); const course = await models.Course.findById(req.params.id).lean(); if (!course) return fail(res, 404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học.'); const [lessons, questions, assessments, tasks, blocks] = await Promise.all([models.CurriculumContent.find({ type: 'LESSON' }).lean(), models.Question.find({}).lean(), models.Assessment.find({}).lean(), models.PracticeTask.find({}).lean(), models.ContentBlock.find({}).lean()]); const report = auditCourseCatalog({ courses: [course], lessons, questions, assessments, practiceTasks: tasks, blocks }).courses[0]; const snapshot = await models.CourseQualitySnapshot.create({ courseId: course._id, courseCode: course.code, courseTitle: course.name, score: report.score, status: report.status, lessonCount: report.lessonCount, publishedLessonCount: report.publishedLessonCount, questionCount: report.questionCount, practiceCount: report.practiceCount, issues: report.issues, checkedBy: ownUsername(req), checkedAt: new Date() }); await audit(req, 'COURSE_QUALITY_AUDIT', 'Course', course._id, null, report); return ok(res, { report, snapshot }); }
        catch (error) { next(error); }
    });

    router.get('/admin/practice/tasks', guard('learning.lesson.read'), async (req, res, next) => {
        try { const filter = {}; if (req.query.status) filter.status = text(req.query.status, 30); if (req.query.track) filter.catalogTrack = normalizeCode(req.query.track); const items = await models.PracticeTask.find(filter).sort({ createdAt: -1 }).limit(500).lean(); return ok(res, items.map(adminPracticeTask)); }
        catch (error) { next(error); }
    });
    router.post('/admin/practice/tasks', guard('learning.lesson.create'), async (req, res, next) => {
        try { const normalized = validatePracticeTask({ ...(req.body || {}), ownerUsername: ownUsername(req), status: 'DRAFT' }); if (!normalized.valid) return fail(res, 400, 'PRACTICE_VALIDATION_FAILED', 'Bài thực hành còn thiếu nội dung.', normalized.errors); const item = await models.PracticeTask.create(normalized.task); await audit(req, 'CREATE', 'PracticeTask', item._id, null, { code: item.code, title: item.title, status: item.status }); return res.status(201).json({ success: true, data: adminPracticeTask(item), message: 'Đã tạo bài thực hành nháp. Kiểm tra test ẩn trước khi công bố.' }); }
        catch (error) { if (error?.code === 11000) return fail(res, 409, 'PRACTICE_CODE_EXISTS', 'Mã bài thực hành đã tồn tại.'); next(error); }
    });
    router.patch('/admin/practice/tasks/:id', guard('learning.lesson.update'), async (req, res, next) => {
        try { if (!asId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã bài không hợp lệ.'); const before = await models.PracticeTask.findById(req.params.id); if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bài thực hành.'); const normalized = validatePracticeTask({ ...before.toObject(), ...req.body, status: before.status, code: before.code, ownerUsername: before.ownerUsername }); if (!normalized.valid) return fail(res, 400, 'PRACTICE_VALIDATION_FAILED', 'Bài thực hành chưa hợp lệ.', normalized.errors); const item = await models.PracticeTask.findByIdAndUpdate(req.params.id, { $set: normalized.task }, { new: true, runValidators: true }); await audit(req, 'UPDATE', 'PracticeTask', item._id, { code: before.code, title: before.title, status: before.status }, { code: item.code, title: item.title, status: item.status }); return ok(res, adminPracticeTask(item)); }
        catch (error) { next(error); }
    });
    router.post('/admin/practice/tasks/:id/publish', guard('learning.lesson.publish'), async (req, res, next) => {
        try { if (!asId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã bài không hợp lệ.'); const item = await models.PracticeTask.findById(req.params.id); if (!item) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bài thực hành.'); const normalized = validatePracticeTask({ ...item.toObject(), status: 'PUBLISHED' }); if (!normalized.valid) return fail(res, 400, 'PRACTICE_VALIDATION_FAILED', 'Không thể công bố bài thực hành.', normalized.errors); if (item.sourceType === 'AI_GENERATED' && !item.scoringCriteria?.length) return fail(res, 400, 'QUALITY_GATE_FAILED', 'Bài AI cần tiêu chí chấm trước khi công bố.'); const before = { code: item.code, title: item.title, status: item.status }; item.status = 'PUBLISHED'; await item.save(); await audit(req, 'PUBLISH', 'PracticeTask', item._id, before, { ...before, status: item.status }); return ok(res, sanitizeTaskForLearner(item), 'Đã công bố bài thực hành. Đáp án và test ẩn vẫn chỉ ở server.'); }
        catch (error) { next(error); }
    });
    router.post('/admin/practice/tasks/:id/archive', guard('learning.lesson.update'), async (req, res, next) => {
        try { if (!asId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã bài không hợp lệ.'); const item = await models.PracticeTask.findByIdAndUpdate(req.params.id, { $set: { status: 'ARCHIVED' } }, { new: true }); if (!item) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bài thực hành.'); await audit(req, 'ARCHIVE', 'PracticeTask', item._id, null, { code: item.code, status: item.status }); return ok(res, sanitizeTaskForLearner(item), 'Đã lưu trữ bài thực hành.'); }
        catch (error) { next(error); }
    });
    router.get('/profile/learning-age', learner, async (req, res, next) => {
        try { const username = ownUsername(req); const [profile, education, legacy] = await Promise.all([models.Profile.findOne({ username }).lean(), models.EducationProfile.findOne({ username }).lean(), models.LearningProfile.findOne({ username }).lean()]); const age = ageFromDob(profile?.dob); let ageBand = 'UNKNOWN'; if (age !== null) ageBand = age <= 10 ? 'PRIMARY_CHILD' : age <= 15 ? 'LOWER_SECONDARY' : age <= 18 ? 'UPPER_SECONDARY' : age <= 24 ? 'YOUNG_ADULT' : 'ADULT'; return ok(res, { dob: profile?.dob || null, age, ageBand, educationLevel: education?.educationLevel || '', grade: education?.grade || null, majorName: education?.majorName || '', profileGoals: legacy?.goals || [], personalizedRules: age === null ? ['Chưa có ngày sinh; dùng cấp học khai báo và điều chỉnh được bởi người học.'] : ageBand === 'PRIMARY_CHILD' ? ['Chia nội dung thành nhiệm vụ ngắn', 'Ưu tiên ví dụ cụ thể, phản hồi khích lệ', 'Hạn chế phiên học liên tục dài'] : ageBand === 'LOWER_SECONDARY' ? ['Kết hợp ví dụ và bài vận dụng', 'Tăng dần độ tự chủ'] : ageBand === 'UPPER_SECONDARY' ? ['Cân bằng kiến thức, luyện đề và mục tiêu thi', 'Theo dõi tiến bộ theo môn'] : ['Ưu tiên dự án, kỹ năng nghề và mục tiêu tự chọn'] }); }
        catch (error) { next(error); }
    });
    return router;
}

module.exports = { createLearningSystemV27Router, publicQuestion, safeContentBlock };
