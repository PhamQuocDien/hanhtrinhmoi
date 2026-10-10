'use strict';

const crypto = require('crypto');
const { generateText, generateStructured, generateImage, generateSpeech, isGeminiConfigured, getAiMode } = require('./gemini-service');
const { makeCourseGenerationPrompt, courseBlueprintSchemaV38, normalizeGeneratedBlueprint, auditCourseBlueprintV38, validateRequestedCourseScope } = require('./course-quality-v38');
const { buildCourseBlueprint, validateCourseBlueprint, findDuplicateCourses, buildLessonRepairPatch, buildQuestionRepairPatch, buildAssessmentRepairPatch } = require('./local-education-ai');
const { STARTER_COURSES } = require('./starter-course-catalog');
const { ensurePersonalCourse } = require('./ai-learning-service');

let running = false;
let timer = null;

function clean(value, max = 5000) { return String(value ?? '').trim().slice(0, max); }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function nextDelay(error, attempts) { return Math.min(15 * 60 * 1000, Math.max(30 * 1000, Number(error?.retryAfterMs || 0), 30 * 1000 * Math.pow(2, Math.max(0, attempts - 1)))); }

async function processJob(models) {
    if (running || !models?.AIGenerationJob) return null;
    running = true;
    let job = null;
    try {
        const now = new Date();
        job = await models.AIGenerationJob.findOneAndUpdate(
            { status: { $in: ['QUEUED', 'WAITING_RETRY'] }, nextRunAt: { $lte: now }, $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }] },
            { $set: { status: 'RUNNING', lockedAt: now, startedAt: now, progress: 5, currentStep: 'STARTING', error: {} }, $inc: { attempts: 1 } },
            { sort: { priority: -1, createdAt: 1 }, new: true }
        );
        if (!job) return null;
        const quotaBlocker = typeof models.AIGenerationJob.findOne === 'function' ? await models.AIGenerationJob.findOne({ _id: { $ne: job._id }, 'error.dailyQuota': true, 'error.cooldownUntil': { $gt: now } }).sort({ 'error.cooldownUntil': -1 }).lean() : null;
        if (quotaBlocker && ['COURSE','LESSON','ASSESSMENT','AUDIO','IMAGE','PERSONAL_COURSE','SPEAKING_ANALYSIS'].includes(String(job.type || '').toUpperCase())) {
            const cooldownUntil = new Date(quotaBlocker.error.cooldownUntil);
            await models.AIGenerationJob.updateOne({ _id: job._id }, { $set: { status: 'WAITING_RETRY', nextRunAt: cooldownUntil, lockedAt: null, currentStep: 'GEMINI_DAILY_QUOTA_COOLDOWN', error: { code: 'GEMINI_DAILY_QUOTA_COOLDOWN', message: 'Đang tạm dừng tác vụ AI vì quota ngày đã hết; worker không gọi lại Gemini trong thời gian cooldown.', dailyQuota: true, cooldownUntil } } });
            return { id: String(job._id), type: job.type, status: 'WAITING_RETRY', reason: 'GEMINI_DAILY_QUOTA_COOLDOWN', nextRunAt: cooldownUntil };
        }
        const payload = job.payload || {};
        let result = null;
        if (job.type === 'COURSE' && payload.localAction === 'COURSE_FACTORY') {
            const started = Date.now();
            await models.AIGenerationJob.updateOne({ _id: job._id }, { $set: { progress: 15, currentStep: 'GENERATE_ADAPTIVE_BLUEPRINT', model: 'GEMINI_COURSE_GENERATION_V38', fallbackUsed: false } });
            if (!isGeminiConfigured() || getAiMode() === 'OFF') throw Object.assign(new Error('Không thể tạo khóa học AI theo yêu cầu: hãy cấu hình GEMINI_API_KEY và không đặt AI_MODE=OFF. V38 không âm thầm thay nội dung AI bằng dàn ý mẫu.'), { code: 'COURSE_AI_REQUIRED', retryable: false });
            const input = payload.input || {};
            const generated = await generateStructured({ prompt: makeCourseGenerationPrompt(input), schema: courseBlueprintSchemaV38, profile: 'course', temperature: 0.45, maxOutputTokens: Number(process.env.GEMINI_COURSE_MAX_OUTPUT_TOKENS || 24000), timeoutMs: Number(process.env.GEMINI_COURSE_TIMEOUT_MS || 600000), dedupeKey: `course-v38:${job.idempotencyKey || job._id}` });
            let blueprint = normalizeGeneratedBlueprint(generated.data, input, generated.model);
            await models.AIGenerationJob.updateOne({ _id: job._id }, { $set: { progress: 60, currentStep: 'AUDIT_CONTENT_DEPTH_AND_ASSESSMENTS', model: generated.model, fallbackUsed: Boolean(generated.fallbackUsed) } });
            let validation = auditCourseBlueprintV38(blueprint);
            const initialScope = validateRequestedCourseScope(blueprint, input);
            if (!initialScope.valid) validation = { ...validation, valid: false, status: 'REJECTED_SCOPE_MISMATCH', errors: [...validation.errors, ...initialScope.errors] };
            if (!validation.valid) {
                const repair = await generateStructured({ prompt: `${makeCourseGenerationPrompt(input)}\n\nSỬA BẢN NHÁP THEO LỖI QUALITY GATE SAU. Giữ đúng chủ đề/track, sửa nội dung thực sự chứ không chỉ tăng số lượng; không dùng câu hỏi chung chung, không lặp câu.\nLỖI:\n${validation.errors.slice(0, 80).join('\n')}\n\nBản nháp cần sửa:\n${JSON.stringify(blueprint).slice(0, 30000)}`, schema: courseBlueprintSchemaV38, profile: 'course', temperature: 0.25, maxOutputTokens: Number(process.env.GEMINI_COURSE_REPAIR_MAX_OUTPUT_TOKENS || 24000), timeoutMs: Number(process.env.GEMINI_COURSE_TIMEOUT_MS || 600000), dedupeKey: `course-v38-repair:${job.idempotencyKey || job._id}` });
                blueprint = normalizeGeneratedBlueprint(repair.data, input, repair.model);
                blueprint.metadata = { ...blueprint.metadata, repairAttempted: true, repairModel: repair.model };
                validation = auditCourseBlueprintV38(blueprint);
                const repairedScope = validateRequestedCourseScope(blueprint, input);
                if (!repairedScope.valid) validation = { ...validation, valid: false, status: 'REJECTED_SCOPE_MISMATCH', errors: [...validation.errors, ...repairedScope.errors] };
            }
            const existingCourses = models.Course ? await models.Course.find({ status: { $nin: ['ARCHIVED', 'DELETED'] } }).select('code name educationLevel grade subjectId category track syllabus kind').limit(2500).lean() : [];
            const duplicateCandidates = findDuplicateCourses(blueprint, existingCourses, STARTER_COURSES);
            if (duplicateCandidates.some(item => item.score >= 0.99)) validation = { ...validation, valid: false, status: 'REJECTED_DUPLICATE', errors: [...validation.errors, 'Khóa học trùng gần như chính xác với catalog hiện có; hãy bổ sung/nâng cấp khóa cũ thay vì tạo bản sao.'] };
            const draft = await models.AIContentDraft.create({ type: 'COURSE', mode: 'ADMIN', ownerUsername: '', requestedBy: job.username || '', title: blueprint.title, prompt: String(input.prompt || input.title || blueprint.title).slice(0, 5000), context: { ...input, domainCode: blueprint.domainCode, generationMode: 'ADAPTIVE_AI_V38' }, draft: blueprint, validation: { ...validation, duplicateCandidates, duplicateCheckCompleted: true }, status: validation.valid ? 'VALIDATED' : 'DRAFT', model: generated.model, promptVersion: 'adaptive-course-quality-v38', sourceFingerprint: blueprint.metadata.fingerprint, metadata: { generationMode: 'ADAPTIVE_AI', remoteApiUsed: true, sourceType: 'AI_GENERATED', requiresAdminReview: true, qualityScore: validation.qualityScore, repairAttempted: Boolean(blueprint.metadata?.repairAttempted) } });
            result = { draftId: String(draft._id), title: draft.title, validation: draft.validation, duplicateCandidates, chapterCount: validation.chapterCount, lessonCount: validation.lessonCount, questionCount: validation.questionCount, model: generated.model, remoteApiUsed: true, repaired: Boolean(blueprint.metadata?.repairAttempted), generationTimeMs: Date.now() - started };
        } else if (job.type === 'COURSE' && payload.localAction === 'CONTENT_REPAIR') {
            const started = Date.now();
            const targetType = String(payload.targetType || '').toUpperCase();
            const targetId = payload.targetId;
            await models.AIGenerationJob.updateOne({ _id: job._id }, { $set: { progress: 20, currentStep: `REPAIR_${targetType}`, model: 'LOCAL_EDUCATION_AI', fallbackUsed: false } });
            let target = null;
            let repair = null;
            let queryModel = null;
            if (targetType === 'LESSON') {
                target = await models.CurriculumContent.findOne({ _id: targetId, type: 'LESSON' }).lean();
                if (!target) throw Object.assign(new Error('Không tìm thấy bài học để sửa.'), { code: 'REPAIR_TARGET_NOT_FOUND' });
                const course = target.courseId && models.Course ? await models.Course.findById(target.courseId).lean() : null;
                repair = buildLessonRepairPatch({ lesson: target, course: course || {} });
                queryModel = models.CurriculumContent;
            } else if (targetType === 'QUESTION') {
                target = await models.Question.findById(targetId).lean();
                if (!target) throw Object.assign(new Error('Không tìm thấy câu hỏi để sửa.'), { code: 'REPAIR_TARGET_NOT_FOUND' });
                repair = buildQuestionRepairPatch({ question: target });
                queryModel = models.Question;
            } else if (targetType === 'ASSESSMENT') {
                target = await models.Assessment.findById(targetId).lean();
                if (!target) throw Object.assign(new Error('Không tìm thấy bài kiểm tra để sửa.'), { code: 'REPAIR_TARGET_NOT_FOUND' });
                const selector = { status: { $nin: ['ARCHIVED'] }, $or: [] };
                if (target.courseId) selector.$or.push({ courseId: target.courseId });
                if (target.subjectId) selector.$or.push({ subjectId: target.subjectId });
                if (Array.isArray(target.questionIds) && target.questionIds.length) selector.$or.push({ _id: { $in: target.questionIds } });
                const availableQuestions = selector.$or.length ? await models.Question.find(selector).select('_id prompt type status courseId subjectId').limit(200).lean() : [];
                repair = buildAssessmentRepairPatch({ assessment: target, availableQuestions });
                queryModel = models.Assessment;
            } else throw Object.assign(new Error('Loại nội dung sửa không được hỗ trợ.'), { code: 'REPAIR_TYPE_UNSUPPORTED' });
            if (repair?.repairable && Object.keys(repair.patch || {}).length) await queryModel.updateOne({ _id: target._id }, { $set: repair.patch });
            result = { targetType, targetId: String(target._id), outcome: repair.status, repairable: Boolean(repair.repairable), changedFields: repair.changedFields || [], errors: repair.errors || [], note: repair.note || '', wordCount: repair.wordCount || null, questionCount: repair.questionCount || null, model: 'LOCAL_EDUCATION_AI', remoteApiUsed: false, generationTimeMs: Date.now() - started, requiresAdminReview: true };
        } else if (job.type === 'PERSONAL_COURSE') {
            const generated = await ensurePersonalCourse({ models, username: payload.username || job.username, request: payload.request || {} });
            result = { decision: generated.decision, courseId: generated.courseId ? String(generated.courseId) : '', source: generated.source || '', degraded: Boolean(generated.degraded), reason: generated.reason || [] };
        } else if (job.type === 'IMAGE') {
            const generated = await generateImage({ prompt: clean(payload.prompt, 8000), model: payload.model || process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image', timeoutMs: 180000, dedupeKey: `image:${payload.courseId || ''}:${payload.lessonId || ''}:${payload.promptHash || sha(payload.prompt)}` });
            const asset = await models.AIImageAsset.findOneAndUpdate(
                { courseId: payload.courseId || null, lessonId: payload.lessonId || null, promptHash: payload.promptHash || sha(payload.prompt) },
                { $setOnInsert: { ownerUsername: payload.username || job.username || '', courseId: payload.courseId || null, lessonId: payload.lessonId || null, promptHash: payload.promptHash || sha(payload.prompt), mimeType: generated.mimeType || 'image/png', model: generated.model || '', data: generated.data, width: generated.width, height: generated.height, metadata: { prompt: payload.prompt, generatedBy: 'AI_GENERATION_WORKER', generatedAt: new Date() } } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            if (payload.lessonId) await models.CurriculumContent.updateOne({ _id: payload.lessonId }, { $set: { 'payload.aiImageAssetId': asset._id, 'payload.aiImageStatus': 'READY' }, $push: { media: { type: 'AI_IMAGE', assetId: asset._id, status: 'READY', model: generated.model } } });
            result = { assetId: asset._id, model: generated.model };
        } else if (job.type === 'AUDIO') {
            const generated = await generateSpeech({ text: clean(payload.text, 10000), voice: payload.voice || 'Kore', model: payload.model || process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts', timeoutMs: 180000, dedupeKey: `tts:${payload.courseId || ''}:${payload.lessonId || ''}:${payload.textHash || sha(payload.text)}` });
            const asset = await models.AIAudioAsset.findOneAndUpdate(
                { courseId: payload.courseId || null, lessonId: payload.lessonId || null, textHash: payload.textHash || sha(payload.text) },
                { $setOnInsert: { ownerUsername: payload.username || job.username || '', courseId: payload.courseId || null, lessonId: payload.lessonId || null, textHash: payload.textHash || sha(payload.text), mimeType: generated.mimeType || 'audio/wav', model: generated.model || '', voice: generated.voice || payload.voice || 'Kore', data: generated.data, metadata: { text: payload.text, generatedBy: 'AI_GENERATION_WORKER', generatedAt: new Date() } } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            if (payload.lessonId) await models.CurriculumContent.updateOne({ _id: payload.lessonId }, { $set: { audioAssetId: asset._id, 'payload.audioStatus': 'READY' } });
            result = { assetId: asset._id, model: generated.model };
        } else if (job.type === 'LESSON' || job.type === 'ASSESSMENT' || job.type === 'COURSE') {
            if (!isGeminiConfigured()) throw Object.assign(new Error('Gemini chưa được cấu hình.'), { code: 'GEMINI_NOT_CONFIGURED', retryAfterMs: 300000 });
            const generated = await generateText({ prompt: clean(payload.prompt, 24000), systemInstruction: clean(payload.systemInstruction, 5000), maxOutputTokens: Number(payload.maxOutputTokens || 2500), temperature: Number(payload.temperature ?? 0.2), profile: payload.profile || 'routine', timeoutMs: Number(payload.timeoutMs || 180000), dedupeKey: payload.dedupeKey || `${job.type}:${job.id}` });
            result = { text: generated.text, model: generated.model, fallbackUsed: generated.fallbackUsed };
        } else if (job.type === 'SPEAKING_ANALYSIS') {
            result = { status: 'QUEUED_FOR_ROUTE', message: 'Speaking analysis được xử lý bởi endpoint phân tích đa phương thức.' };
        }
        await models.AIGenerationJob.updateOne({ _id: job._id }, { $set: { status: 'COMPLETED', result: result || {}, error: {}, lockedAt: null, completedAt: new Date(), finishedAt: new Date(), progress: 100, currentStep: 'COMPLETED', model: result?.model || job.model || '', fallbackUsed: Boolean(result?.fallbackUsed), generationTimeMs: Number(result?.generationTimeMs || job.generationTimeMs || 0) } });
        return { id: String(job._id), type: job.type, status: 'COMPLETED', result };
    } catch (error) {
        if (!job) return null;
        const attempts = Number(job.attempts || 0);
        const dailyQuotaFailure = Boolean(error?.dailyQuota);
        const quotaFailure = dailyQuotaFailure || Boolean(error?.quota || error?.code === 'GEMINI_COOLDOWN');
        const terminal = attempts >= Number(process.env.AI_WORKER_MAX_ATTEMPTS || 5) || quotaFailure || error?.retryable === false;
        const cooldownMs = dailyQuotaFailure ? Math.max(Number(error?.retryAfterMs || 0), Number(process.env.GEMINI_DAILY_QUOTA_COOLDOWN_MS || 86400000)) : quotaFailure ? Math.max(Number(error?.retryAfterMs || 0), Number(process.env.GEMINI_QUOTA_COOLDOWN_MS || 600000)) : 0;
        const cooldownUntil = cooldownMs ? new Date(Date.now() + cooldownMs) : null;
        await models.AIGenerationJob.updateOne({ _id: job._id }, { $set: { status: terminal ? 'FAILED' : 'WAITING_RETRY', nextRunAt: cooldownUntil || (terminal ? new Date(Date.now() + 24 * 60 * 60 * 1000) : new Date(Date.now() + nextDelay(error, attempts))), lockedAt: null, currentStep: terminal ? 'FAILED' : 'WAITING_RETRY', finishedAt: terminal ? new Date() : null, error: { code: error?.code || 'AI_WORKER_ERROR', message: clean(error?.message || error, 1200), retryAfterMs: Number(error?.retryAfterMs || 0), quota: Boolean(error?.quota), dailyQuota: dailyQuotaFailure, cooldownUntil } } });
        console.warn(`⚠️ AI worker ${job.type} [${job._id}] ${terminal ? 'failed' : 'waiting retry'}: ${error?.message || error}`);
        return { id: String(job._id), type: job.type, status: terminal ? 'FAILED' : 'WAITING_RETRY' };
    } finally { running = false; }
}

function startAIGenerationWorker({ models, intervalMs = Number(process.env.AI_WORKER_INTERVAL_MS || 12000) } = {}) {
    if (timer) return timer;
    const tick = async () => { try { await processJob(models); } catch (error) { console.warn('⚠️ AI worker tick:', error?.message || error); } };
    timer = setInterval(tick, Math.max(5000, intervalMs));
    timer.unref?.();
    setTimeout(tick, 2500).unref?.();
    return timer;
}
function stopAIGenerationWorker() { if (timer) clearInterval(timer); timer = null; }
module.exports = { startAIGenerationWorker, stopAIGenerationWorker, processJob };
