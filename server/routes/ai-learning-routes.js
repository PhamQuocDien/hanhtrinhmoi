'use strict';

const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { queueGenerationJob } = require('../services/generation-job-queue');
const { isGeminiConfigured, getGeminiModel, getGeminiFallbackModels, getAiMode, generateStructured, generateText, generateMultimodalStructured, generateImage } = require('../services/gemini-service');
const { buildLearnerContext, inferLearnerContext, generateCourseDraft, buildDirectorDecision, materializeCourse, ensurePersonalCourse, generateDiagnosticAssessment } = require('../services/ai-learning-service');
const { generateAmbientInsight, autoProvisionCourse, choosePageKey } = require('../services/ai-autopilot-service');
const { createAuditEntry, writeAudit } = require('../services/platform-audit-service');
const { answerFromLocalKnowledge, documentFromLesson, getLocalRuntimeStatus, cleanText: cleanLocalText } = require('../services/local-ai-runtime');
const { executorStatus } = require('../services/code-runner');

function isObjectId(value) { return mongoose.Types.ObjectId.isValid(String(value || '')); }
function ok(res, data, message = 'OK') { return res.json({ success: true, data, message }); }
function fail(res, status, code, message, details) { return res.status(status).json({ success: false, code, message, ...(details ? { details } : {}) }); }
function guard(requirePermission, permission) { return requirePermission ? requirePermission(permission) : (req, res, next) => next(); }

function registerAiLearningRoutes({ models, requireAuth, requirePermission, aiRateLimit }) {
    const router = express.Router();
    const audit = async (req, action, entityType, entityId, before, after) => writeAudit(models.AuditLog, createAuditEntry({ req, actor: req.session?.user, action, entityType, entityId, before, after }));
    const rate = aiRateLimit || ((req, res, next) => next());

    router.get('/status', requireAuth, async (req, res) => ok(res, { configured: isGeminiConfigured(), model: getGeminiModel(), fallbackModels: getGeminiFallbackModels(), ttsModel: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts', provider: 'Google Gemini API', mode: `${getAiMode()} · Resilient AI Decision Engine + AI Course Composer + AI Tutor`, resilience: { retryTransientErrors: true, modelFallback: true, ruleBasedFallback: true, nonBlocking: true } }));
    router.get('/code/status', requireAuth, async (req, res) => {
        const configured = executorStatus();
        let status = { ...configured, configured: configured.enabled, healthy: configured.executor === 'docker' ? null : false };
        if (configured.enabled && ['remote', 'judge0'].includes(configured.executor)) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            try {
                const endpoint = configured.executor === 'judge0' ? new URL('/about', String(process.env.CODE_JUDGE0_URL || 'https://ce.judge0.com').trim()) : new URL('/health', String(process.env.CODE_EXECUTOR_URL || '').trim());
                const response = await fetch(endpoint, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal });
                const health = response.ok ? await response.json().catch(() => ({})) : {};
                const healthy = configured.executor === 'judge0' ? response.ok && Boolean(health.version || health.homepage) : response.ok && health.ok === true && health.isolated === true;
                status = { ...status, enabled: healthy, healthy, reason: healthy ? '' : configured.executor === 'judge0' ? 'Judge0 chưa xác nhận endpoint /about.' : 'Executor chưa xác nhận /health và isolation.' };
            } catch (_) {
                status = { ...status, enabled: false, healthy: false, reason: configured.executor === 'judge0' ? 'Không kết nối được Judge0 Cloud; dịch vụ miễn phí có thể giới hạn hoặc tạm thời quá tải.' : 'Không kết nối được executor biệt lập. Kiểm tra URL /health và trạng thái Docker.' };
            } finally { clearTimeout(timer); }
        }
        return ok(res, { ...status, securelyIsolated: status.enabled && ['judge0', 'remote', 'docker'].includes(status.executor), message: status.enabled ? 'Executor đã phản hồi health check. Có thể chạy code thử.' : `Code Runner hiện chưa sẵn sàng: ${status.reason || 'Thiếu cấu hình executor biệt lập.'}`, configuration: { enabledVariable: 'CODE_RUNNER_ENABLED=true', executorVariable: 'CODE_RUNNER_EXECUTOR=judge0', judge0UrlVariable: 'CODE_JUDGE0_URL', urlVariable: 'CODE_EXECUTOR_URL', tokenVariable: 'CODE_EXECUTOR_TOKEN' } });
    });
    router.get('/local/status', requireAuth, rate, async (req, res) => {
        const runtime = await getLocalRuntimeStatus({ probe: true });
        const { baseUrl, ...safeRuntime } = runtime;
        return ok(res, { ...safeRuntime, builtInKnowledgeRetrieval: true, externalCloudApiUsedForLocalTutor: false, note: runtime.localModelEnabled && runtime.reachable && runtime.modelInstalled ? 'Mô hình cục bộ đã sẵn sàng.' : 'Trợ giảng vẫn dùng truy xuất học liệu nội bộ; có thể cài Ollama/mô hình local để tăng khả năng diễn giải.' });
    });
    router.post('/local/ask', requireAuth, rate, async (req, res, next) => {
        try {
            const username = req.session.user.username;
            const query = cleanLocalText(req.body?.question || req.body?.query, 2000);
            if (query.length < 3) return fail(res, 400, 'QUERY_TOO_SHORT', 'Hãy nhập câu hỏi có ít nhất 3 ký tự.');
            if (query.length > 1200) return fail(res, 413, 'QUERY_TOO_LONG', 'Câu hỏi tối đa 1.200 ký tự.');
            const requestedCourseId = String(req.body?.courseId || '');
            if (requestedCourseId && !isObjectId(requestedCourseId)) return fail(res, 400, 'INVALID_COURSE_ID', 'Mã khóa học không hợp lệ.');
            const courseFilter = { status: { $nin: ['ARCHIVED', 'DELETED'] }, $or: [{ kind: 'CANONICAL', status: { $in: ['ACTIVE', 'PUBLISHED'] } }, { kind: 'PERSONAL_AI', ownerUsername: username, status: 'ACTIVE' }] };
            if (requestedCourseId) courseFilter._id = requestedCourseId;
            const courses = await models.Course.find(courseFilter).select('_id name title code kind ownerUsername status').sort({ updatedAt: -1 }).limit(requestedCourseId ? 1 : 250).lean();
            if (requestedCourseId && !courses.length) return fail(res, 404, 'COURSE_NOT_ACCESSIBLE', 'Không tìm thấy khóa học hoặc bạn không có quyền truy cập.');
            const courseById = new Map(courses.map(course => [String(course._id), course]));
            const lessons = courses.length ? await models.CurriculumContent.find({ courseId: { $in: courses.map(course => course._id) }, type: 'LESSON', status: 'PUBLISHED' }).select('_id courseId title description theory theorySections examples knowledge skills').limit(requestedCourseId ? 120 : 900).lean() : [];
            const documents = lessons.map(lesson => documentFromLesson(lesson, courseById.get(String(lesson.courseId))?.name || '')).filter(Boolean);
            const result = await answerFromLocalKnowledge({ query, documents, lessonFocus: cleanLocalText(req.body?.lessonTitle, 200) });
            if (!result.ok) return fail(res, 400, result.code, result.message);
            try {
                await models.AIDecisionLog.create({ username, decision: 'LOCAL_RAG_TUTOR_ANSWER', reason: (result.citations || []).map(source => source.title), context: { query: query.slice(0, 500), courseId: requestedCourseId || '', sourceIds: (result.citations || []).map(source => source.id) }, output: { mode: result.mode, grounded: result.grounded, confidence: result.confidence, sourceCount: (result.citations || []).length }, model: result.model || 'LOCAL_RETRIEVAL_ONLY', promptVersion: 'LOCAL-RAG-1', actionTaken: 'ANSWER_FROM_PUBLISHED_LESSONS' });
            } catch (logError) { console.warn('Không lưu được nhật ký Local Tutor:', logError.message); }
            return ok(res, { ...result, localOnly: true, remoteApiUsed: false }, result.mode === 'LOCAL_RAG_OLLAMA' ? 'Trợ giảng đã trả lời bằng mô hình local và học liệu nội bộ.' : 'Trợ giảng đã truy xuất học liệu nội bộ.');
        } catch (error) { return next(error); }
    });
    router.get('/context', requireAuth, async (req, res, next) => { try { return ok(res, await buildLearnerContext(models, req.session.user.username)); } catch (error) { return next(error); } });

    router.post('/ambient/observe', requireAuth, rate, async (req, res, next) => {
        try {
            const pageKey = choosePageKey(req.body?.pathname || '', req.body?.title || '');
            const event = { type: req.body?.eventType || 'PAGE_VIEW', endpoint: req.body?.endpoint || '', method: req.body?.method || 'GET', status: req.body?.status || 0, result: req.body?.result || {} };
            const insight = await generateAmbientInsight({ models, username: req.session.user.username, pageKey, event, force: Boolean(req.body?.force) });
            await models.AIDecisionLog.create({ username: req.session.user.username, decision: 'AMBIENT_AI_ANALYSIS', reason: insight.insights || [], context: { pageKey, event }, output: insight, model: insight.model || getGeminiModel(), promptVersion: 'AI-AUTOPILOT-1', actionTaken: insight.nextStep || '' });
            return ok(res, { ...insight, pageKey, pageLabel: require('../services/ai-autopilot-service').PAGE_LABELS[pageKey] || 'Hoạt động' }, 'AI đã tự phân tích hoạt động hiện tại.');
        } catch (error) { return next(error); }
    });

    router.post('/ambient/auto-course', requireAuth, rate, async (req, res, next) => {
        try {
            const pageKey = choosePageKey(req.body?.pathname || '', req.body?.title || '');
            const result = await autoProvisionCourse({ models, username: req.session.user.username, prompt: req.body?.coursePrompt || req.body?.prompt || '', pageKey });
            await models.AIDecisionLog.create({ username: req.session.user.username, decision: 'AMBIENT_AI_COURSE', reason: result.reason || [], context: { pageKey }, output: result, model: getGeminiModel(), promptVersion: 'AI-AUTOPILOT-COURSE-1', actionTaken: result.decision || '' });
            const message = result.created ? 'AI đã tự tạo khóa học cá nhân phù hợp.' : result.decision === 'AI_TEMPORARILY_UNAVAILABLE' ? 'AI đang tạm quá tải; hệ thống đã chuyển sang chế độ dự phòng và sẽ tự thử lại.' : 'AI đã tìm thấy khóa học phù hợp trong catalog.';
            return res.status(result.created ? 201 : 200).json({ success: true, data: result, message });
        } catch (error) { return next(error); }
    });

    router.post('/profile/analyze', requireAuth, rate, async (req, res, next) => {
        try {
            const result = await inferLearnerContext({ models, username: req.session.user.username, force: Boolean(req.body?.force) });
            await audit(req, 'AI_PROFILE_INFER', 'LearningProfile', req.session.user.username, null, result.inference);
            return ok(res, result, result.reused ? 'Đã sử dụng ngữ cảnh học tập AI đã phân tích.' : 'Đã phân tích ngữ cảnh học tập.');
        } catch (error) { return next(error); }
    });

    router.post('/director', requireAuth, rate, async (req, res, next) => {
        try {
            const decision = await buildDirectorDecision({ models, username: req.session.user.username, request: req.body || {} });
            let execution = null;
            if (req.body?.autoExecute && decision.decision === 'CREATE_PERSONAL_COURSE') execution = await ensurePersonalCourse({ models, username: req.session.user.username, request: { ...(req.body || {}), prompt: decision.courseRequest || req.body?.prompt, forceCreate: false } });
            const item = await models.AIDecisionLog.create({ username: req.session.user.username, decision: decision.decision, reason: decision.reason || [], context: { request: req.body || {}, skillGaps: decision.skillGaps || [], educationContext: decision.context?.educationContext || {} }, output: { decision, execution }, model: decision.model, promptVersion: decision.promptVersion, actionTaken: execution?.decision || decision.recommendedAction, validation: { ok: true } });
            return ok(res, { ...decision, execution, decisionLogId: item._id }, execution ? 'AI đã phân tích và thực thi quyết định.' : 'AI Learning Director đã phân tích hành trình.');
        } catch (error) { return next(error); }
    });

    router.post('/lesson-help', requireAuth, rate, async (req, res, next) => {
        try {
            const body = req.body || {};
            const username = req.session.user.username;
            const lessonTitle = cleanLocalText(body.lessonTitle, 200);
            const question = cleanLocalText(body.question, 3000);
            if (question.length < 3) return fail(res, 400, 'QUESTION_TOO_SHORT', 'Hãy nhập câu hỏi cụ thể.');
            const context = await buildLearnerContext(models, username);
            const courses = await models.Course.find({ $or: [{ kind: 'CANONICAL', status: { $in: ['ACTIVE', 'PUBLISHED'] } }, { kind: 'PERSONAL_AI', ownerUsername: username, status: 'ACTIVE' }] }).select('_id name').limit(120).lean();
            const courseById = new Map(courses.map(course => [String(course._id), course]));
            const publishedLessons = courses.length ? await models.CurriculumContent.find({ courseId: { $in: courses.map(course => course._id) }, type: 'LESSON', status: 'PUBLISHED' }).select('_id courseId title description theory theorySections examples knowledge skills objectives').limit(600).lean() : [];
            const clientLesson = { _id: 'current-lesson', title: lessonTitle, theorySections: Array.isArray(body.theory) ? body.theory : [], examples: Array.isArray(body.examples) ? body.examples : [], description: '' };
            const documents = [documentFromLesson(clientLesson, 'Bài đang học'), ...publishedLessons.map(lesson => documentFromLesson(lesson, courseById.get(String(lesson.courseId))?.name || '')).filter(Boolean)].filter(Boolean);
            const result = await answerFromLocalKnowledge({ query: `${lessonTitle ? `Bài học: ${lessonTitle}. ` : ''}${question}`, documents, lessonFocus: lessonTitle });
            if (!result.ok) return fail(res, 400, result.code, result.message);
            let answer = result.answer;
            if (!result.grounded && body.theory) answer = `Gợi ý dựa trên nội dung bạn đang học:\n1. Xác định đúng khái niệm liên quan trong bài.\n2. Chia câu hỏi thành các bước nhỏ; làm thử bước đầu tiên rồi kiểm tra với ví dụ.\n3. Nêu dữ kiện và giải thích vì sao chọn cách làm đó.\n\nCâu hỏi của bạn: ${question}`;
            await models.AIDecisionLog.create({ username, decision: 'LOCAL_LESSON_TUTOR', reason: (result.citations || []).map(source => source.title), context: { lessonTitle, question: question.slice(0, 500) }, output: { grounded: result.grounded, confidence: result.confidence, sourceCount: (result.citations || []).length }, model: result.model || 'LOCAL_RULES_TUTOR', promptVersion: 'LOCAL-LESSON-TUTOR-V32', actionTaken: 'GUIDED_HINT' }).catch(() => {});
            return ok(res, { answer, model: result.model || 'LOCAL_RULES_TUTOR', localOnly: true, remoteApiUsed: false, grounded: Boolean(result.grounded), citations: result.citations || [] }, 'Trợ giảng nội bộ đã trả lời từ học liệu và hướng dẫn từng bước.');
        } catch (error) { return next(error); }
    });

    router.post('/personal-course', requireAuth, rate, async (req, res, next) => {
        try {
            const result = await ensurePersonalCourse({ models, username: req.session.user.username, request: req.body || {} });
            await models.AIDecisionLog.create({ username: req.session.user.username, decision: result.decision, reason: result.reason || [], context: result.context || {}, output: { courseId: result.courseId, generation: result.generation?.model || '' }, model: result.generation?.model || getGeminiModel(), promptVersion: result.generation?.promptVersion || 'AI-DIRECTOR-2', actionTaken: result.decision });
            const message = result.decision === 'CREATE_PERSONAL_COURSE' ? 'AI đã tạo khóa học cá nhân mới.' : result.decision === 'AI_TEMPORARILY_UNAVAILABLE' ? 'AI đang tạm quá tải; khóa học chưa tạo mới nhưng dữ liệu học tập vẫn an toàn.' : 'AI đã chọn khóa học phù hợp trong catalog.';
            return res.status(result.decision === 'CREATE_PERSONAL_COURSE' ? 201 : 200).json({ success: true, data: result, message });
        } catch (error) { return next(error); }
    });

    router.get('/personal-courses', requireAuth, async (req, res, next) => {
        try { return ok(res, await models.Course.find({ ownerUsername: req.session.user.username, kind: 'PERSONAL_AI', status: 'ACTIVE' }).sort({ createdAt: -1 }).limit(50).lean()); } catch (error) { return next(error); }
    });

    router.get('/personal-courses/:id', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã khóa học không hợp lệ.');
            const course = await models.Course.findOne({ _id: req.params.id, ownerUsername: req.session.user.username, kind: 'PERSONAL_AI', status: 'ACTIVE' }).lean();
            if (!course) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy khóa học AI cá nhân.');
            const lessons = await models.CurriculumContent.find({ courseId: course._id, type: 'LESSON', status: 'PUBLISHED' }).sort({ createdAt: 1 }).lean();
            const assessments = await models.Assessment.find({ courseId: course._id, publicationStatus: 'PUBLISHED' }).sort({ createdAt: 1 }).lean();
            return ok(res, { course, lessons, assessments });
        } catch (error) { return next(error); }
    });

    const speakingSchema = {
        type: 'object', properties: {
            transcript: { type: 'string' },
            scores: { type: 'object', properties: { overall: { type: 'number' }, pronunciation: { type: 'number' }, intonation: { type: 'number' }, fluency: { type: 'number' }, grammar: { type: 'number' }, vocabulary: { type: 'number' } } },
            pronunciation: { type: 'object', properties: { score: { type: 'number' }, issues: { type: 'array', items: { type: 'string' } }, strongPoints: { type: 'array', items: { type: 'string' } } } },
            intonation: { type: 'object', properties: { score: { type: 'number' }, issues: { type: 'array', items: { type: 'string' } }, pattern: { type: 'string' } } },
            fluency: { type: 'object', properties: { score: { type: 'number' }, issues: { type: 'array', items: { type: 'string' } } } },
            grammar: { type: 'object', properties: { score: { type: 'number' }, issues: { type: 'array', items: { type: 'string' } } } },
            vocabulary: { type: 'object', properties: { score: { type: 'number' }, issues: { type: 'array', items: { type: 'string' } } } },
            feedback: { type: 'array', items: { type: 'string' } }, nextPractice: { type: 'array', items: { type: 'string' } }
        }, required: ['transcript','scores','pronunciation','intonation','fluency','grammar','vocabulary','feedback','nextPractice']
    };

    router.get('/lessons/:id/media', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã bài học không hợp lệ.');
            const lesson = await models.CurriculumContent.findOne({ _id: req.params.id, type: 'LESSON', status: 'PUBLISHED' }).lean();
            if (!lesson) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bài học.');
            const audioReady = Boolean(lesson.audioAssetId);
            const imageReady = Boolean(lesson.payload?.aiImageAssetId || (lesson.media || []).some(item => item?.type === 'AI_IMAGE' && item?.assetId));
            if (models.AIGenerationJob) {
                if (!audioReady && String(lesson.payload?.audioScript || '').trim()) await queueGenerationJob(models, { idempotencyKey: `AUDIO:${lesson.courseId}:${lesson._id}`, type: 'AUDIO', username: req.session.user.username, priority: 30, payload: { courseId: lesson.courseId, lessonId: lesson._id, text: lesson.payload.audioScript, textHash: crypto.createHash('sha256').update(String(lesson.payload.audioScript)).digest('hex') } });
                if (!imageReady && String(lesson.payload?.visualPrompt || '').trim()) await queueGenerationJob(models, { idempotencyKey: `IMAGE:${lesson.courseId}:${lesson._id}`, type: 'IMAGE', username: req.session.user.username, priority: 18, payload: { courseId: lesson.courseId, lessonId: lesson._id, prompt: lesson.payload.visualPrompt, promptHash: crypto.createHash('sha256').update(String(lesson.payload.visualPrompt)).digest('hex') } });
            }
            const jobs = models.AIGenerationJob ? await models.AIGenerationJob.find({ 'payload.lessonId': lesson._id }).sort({ createdAt: -1 }).limit(4).lean() : [];
            const audioJob = jobs.find(job => job.type === 'AUDIO'); const imageJob = jobs.find(job => job.type === 'IMAGE');
            const mediaState = (ready, job) => ready ? 'READY' : job?.status === 'FAILED' ? 'FAILED' : job?.status || 'NOT_QUEUED';
            return ok(res, { audioAssetId: lesson.audioAssetId || null, imageAssetId: lesson.payload?.aiImageAssetId || (lesson.media || []).find(item => item?.type === 'AI_IMAGE')?.assetId || null, audioStatus: mediaState(audioReady, audioJob), imageStatus: mediaState(imageReady, imageJob), jobs: jobs.map(job => ({ type: job.type, status: job.status, attempts: job.attempts, error: job.error })) });
        } catch (error) { return next(error); }
    });

    router.get('/images/:id', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return res.status(400).end();
            const asset = await models.AIImageAsset.findById(req.params.id).lean();
            if (!asset) return res.status(404).end();
            const role = req.session?.user?.role;
            const owns = asset.ownerUsername === req.session.user.username || (asset.courseId && await models.Course.exists({ _id: asset.courseId, $or: [{ ownerUsername: req.session.user.username }, { kind: 'CANONICAL' }] }));
            if (!owns && !['admin','super_admin'].includes(role)) return res.status(403).end();
            res.setHeader('Content-Type', asset.mimeType || 'image/png'); res.setHeader('Cache-Control', 'private, max-age=86400'); return res.send(asset.data);
        } catch (error) { return next(error); }
    });

    router.post('/lessons/:id/visual', requireAuth, rate, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã bài học không hợp lệ.');
            const lesson = await models.CurriculumContent.findOne({ _id: req.params.id, type: 'LESSON', status: 'PUBLISHED' }).lean();
            if (!lesson) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy bài học.');
            const prompt = String(req.body?.prompt || lesson.payload?.visualPrompt || `Educational infographic for ${lesson.title}`).slice(0, 12000);
            const promptHash = crypto.createHash('sha256').update(`${lesson.courseId}:${lesson._id}:${prompt}`).digest('hex');
            const existing = await models.AIImageAsset.findOne({ courseId: lesson.courseId, lessonId: lesson._id, promptHash }).lean();
            if (existing) return ok(res, { status: 'READY', assetId: existing._id, url: `/api/ai-learning/images/${existing._id}` }, 'Ảnh AI đã có sẵn.');
            const generated = await generateImage({ prompt, model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image', fallbackModels: String(process.env.GEMINI_IMAGE_FALLBACK_MODELS || 'gemini-3.1-flash-image').split(',').map(x => x.trim()).filter(Boolean), timeoutMs: 180000 });
            const asset = await models.AIImageAsset.create({ ownerUsername: req.session.user.username, courseId: lesson.courseId, lessonId: lesson._id, promptHash, mimeType: generated.mimeType || 'image/png', model: generated.model, data: generated.buffer, width: generated.width, height: generated.height, metadata: { prompt, source: 'ON_DEMAND_AUTO' } });
            await models.CurriculumContent.updateOne({ _id: lesson._id }, { $set: { 'payload.aiImageAssetId': asset._id, 'payload.aiImageStatus': 'READY' } });
            return ok(res, { status: 'READY', assetId: asset._id, url: `/api/ai-learning/images/${asset._id}`, model: generated.model }, 'AI đã tạo ảnh cho bài học.');
        } catch (error) { return next(error); }
    });

    router.post('/english/speaking/analyze', requireAuth, rate, async (req, res, next) => {
        try {
            const body = req.body || {};
            if (!isGeminiConfigured()) return fail(res, 503, 'AI_NOT_CONFIGURED', 'Chưa cấu hình GEMINI_API_KEY.');
            const raw = String(body.audioBase64 || '').replace(/^data:[^;]+;base64,/, '');
            if (!raw) return fail(res, 400, 'AUDIO_REQUIRED', 'Thiếu dữ liệu thu âm.');
            if (Buffer.byteLength(raw, 'base64') > 8 * 1024 * 1024) return fail(res, 413, 'AUDIO_TOO_LARGE', 'Âm thanh tối đa 8 MB.');
            const mimeType = String(body.mimeType || 'audio/webm').split(';')[0].slice(0, 80);
            const audioBuffer = Buffer.from(raw, 'base64');
            const sha256 = crypto.createHash('sha256').update(audioBuffer).digest('hex');
            const audio = await models.UserAudioAsset.findOneAndUpdate({ ownerUsername: req.session.user.username, sha256 }, { $setOnInsert: { ownerUsername: req.session.user.username, mimeType, data: audioBuffer, durationSeconds: Number(body.durationSeconds || 0) || null, metadata: { exam: String(body.exam || 'IELTS').toUpperCase(), task: String(body.task || 'SPEAKING'), prompt: String(body.prompt || '').slice(0, 4000) } } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            const prompt = `Phân tích bài nói tiếng Anh của học viên. Exam=${String(body.exam || 'IELTS').toUpperCase()}, variant=${String(body.variant || '')}, task=${String(body.task || 'SPEAKING')}. Prompt: ${String(body.prompt || '').slice(0,3000)}. Expected text: ${String(body.expectedText || '').slice(0,5000)}. Đánh giá transcript, pronunciation, intonation, fluency, grammar, vocabulary. Phải chỉ ra lỗi cụ thể, ví dụ từ/cụm và đề xuất bài luyện tiếp theo. Không tự nhận là điểm thi chính thức.`;
            const result = await generateMultimodalStructured({ prompt, schema: speakingSchema, audioBase64: raw, mimeType, model: process.env.GEMINI_AUDIO_MODEL || 'gemini-3.8-flash', maxOutputTokens: 4500, temperature: 0.15, profile: 'audio', timeoutMs: 180000, dedupeKey: `speech:${req.session.user.username}:${sha256}` });
            const analyzed = result.data;
            const attempt = await models.EnglishSpeakingAttempt.create({ username: req.session.user.username, exam: String(body.exam || 'IELTS').toUpperCase() === 'TOEIC' ? 'TOEIC' : 'IELTS', variant: String(body.variant || ''), task: String(body.task || 'SPEAKING'), prompt: String(body.prompt || ''), expectedText: String(body.expectedText || ''), audioAssetId: audio._id, transcript: analyzed.transcript, scores: analyzed.scores, pronunciation: analyzed.pronunciation, intonation: analyzed.intonation, fluency: analyzed.fluency, grammar: analyzed.grammar, vocabulary: analyzed.vocabulary, feedback: analyzed.feedback, nextPractice: analyzed.nextPractice, model: result.model, status: 'ANALYZED' });
            await models.AIDecisionLog.create({ username: req.session.user.username, decision: 'ENGLISH_SPEAKING_ANALYSIS', reason: analyzed.feedback || [], context: { exam: body.exam, task: body.task, audioAssetId: audio._id }, output: { attemptId: attempt._id, scores: analyzed.scores }, model: result.model, promptVersion: 'AI-SPEAKING-1', actionTaken: 'SAVE_SPEAKING_ANALYSIS' });
            return ok(res, { attempt, audioAssetId: audio._id, model: result.model, fallbackUsed: Boolean(result.fallbackUsed) }, 'AI đã phân tích thu âm, phát âm và ngữ điệu.');
        } catch (error) {
            if (error?.code?.startsWith('GEMINI_')) return fail(res, 503, 'AI_TEMPORARILY_UNAVAILABLE', 'AI đang bận; bản thu âm đã có thể được lưu và sẽ phân tích lại khi hệ thống rảnh.', { retryAfterSeconds: Math.max(30, Math.ceil(Number(error.retryAfterMs || 60000) / 1000)) });
            return next(error);
        }
    });

    router.get('/english/speaking/attempts', requireAuth, async (req, res, next) => {
        try { return ok(res, await models.EnglishSpeakingAttempt.find({ username: req.session.user.username }).sort({ createdAt: -1 }).limit(30).lean()); } catch (error) { return next(error); }
    });

    router.post('/code/execute', requireAuth, rate, async (req, res, next) => {
        try {
            const { executeCode } = require('../services/code-runner');
            const body = req.body || {};
            const result = await executeCode({ language: body.language, code: body.code, stdin: body.stdin });
            const saved = await models.CodeExecutionAttempt.create({ username: req.session.user.username, courseId: isObjectId(body.courseId) ? body.courseId : null, lessonId: isObjectId(body.lessonId) ? body.lessonId : null, language: String(body.language || '').toLowerCase(), code: String(body.code || '').slice(0, 512 * 1024), stdin: String(body.stdin || '').slice(0, 32 * 1024), stdout: String(result.stdout || ''), stderr: String(result.stderr || ''), compileError: String(result.compileError || ''), exitCode: result.exitCode ?? null, timedOut: Boolean(result.timedOut), runtimeMs: Number(result.runtimeMs || 0), status: result.status || 'ERROR' });
            return ok(res, { ...result, executionId: saved._id }, result.status === 'SUCCESS' ? 'Code chạy thành công.' : ['DISABLED', 'SANDBOX_REQUIRED', 'EXECUTOR_UNAVAILABLE'].includes(result.status) ? (result.message || 'Executor biệt lập chưa được cấu hình; không thực thi mã trên máy chủ web.') : result.status === 'TIMEOUT' ? 'Code vượt thời gian giới hạn.' : 'Đã xử lý code và lưu kết quả.');
        } catch (error) { return next(error); }
    });

    router.get('/audio/:id', requireAuth, async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return res.status(400).end();
            const asset = await models.AIAudioAsset.findById(req.params.id).lean();
            if (!asset) return res.status(404).end();
            const role = req.session?.user?.role;
            let ownsAttachedCourse = false;
            if (asset.courseId) ownsAttachedCourse = Boolean(await models.Course.exists({ _id: asset.courseId, ownerUsername: req.session.user.username, kind: 'PERSONAL_AI', status: 'ACTIVE' }));
            if (asset.ownerUsername && asset.ownerUsername !== req.session.user.username && !ownsAttachedCourse && !['admin', 'super_admin'].includes(role)) return res.status(403).end();
            res.setHeader('Content-Type', asset.mimeType || 'audio/wav');
            res.setHeader('Cache-Control', 'private, max-age=86400');
            return res.send(asset.data);
        } catch (error) { return next(error); }
    });

    router.post('/diagnostic/generate', requireAuth, rate, async (req, res, next) => {
        try {
            // Diagnostic builder has an offline local assessment path; cloud AI is optional.
            const result = await generateDiagnosticAssessment({ models, username: req.session.user.username, request: req.body || {} });
            await audit(req, 'AI_GENERATE', 'Assessment', result.assessmentId, null, result);
            return res.status(201).json({ success: true, data: result, message: 'Đã tạo diagnostic thích ứng bằng AI.' });
        } catch (error) { return next(error); }
    });

    router.post('/admin/course-drafts/generate', guard(requirePermission, 'learning.ai.manage'), rate, async (req, res, next) => {
        try {
            // The built-in Course Composer must remain usable without a paid AI API.
            const context = { adminRequest: req.body || {}, education: req.body?.education || {}, educationContext: req.body?.educationContext || {}, learning: req.body?.learning || {}, mastery: [], currentPlan: null, courses: [] };
            const generated = await generateCourseDraft({ request: req.body || {}, context, mode: 'ADMIN' });
            let materialized = null;
            if (generated.validation.valid) {
                materialized = await materializeCourse({ models, draft: generated.draft, mode: 'ADMIN', ownerUsername: '', request: req.body || {}, context: { ...(req.body?.education || {}), ...(req.body?.educationContext || {}), generationModel: generated.model }, generateAudioAssets: false });
            }
            const draft = await models.AIContentDraft.create({ type: 'COURSE', mode: 'ADMIN', requestedBy: req.session.user.username, title: generated.draft.title, prompt: String(req.body?.prompt || '').slice(0, 6000), context, draft: generated.draft, validation: generated.validation, status: materialized?.course?._id ? 'COMMITTED' : generated.validation.valid ? 'VALIDATED' : 'DRAFT', ...(materialized?.course?._id ? { committedCourseId: materialized.course._id } : {}), model: generated.model, promptVersion: generated.promptVersion, sourceFingerprint: `${generated.model}:${Date.now()}`, metadata: materialized ? { lessonCount: materialized.lessonCount, assessmentCount: (materialized.chapterAssessments?.length || 0) + 3, materializedAt: new Date(), audioGenerated: 0 } : {} });
            await audit(req, 'AI_GENERATE', 'AIContentDraft', draft._id, null, draft.toObject());
            return res.status(201).json({ success: true, data: { ...(draft.toObject()), materialized: materialized ? { courseId: materialized.course._id, courseName: materialized.course.name, lessonCount: materialized.lessonCount, assessmentCount: (materialized.chapterAssessments?.length || 0) + 3, status: 'DRAFT_REVIEW_REQUIRED' } : null }, message: materialized ? `Đã tạo và lưu khóa học cùng ${materialized.lessonCount} bài học và bài kiểm tra. Khóa vẫn ở trạng thái nháp để Admin duyệt trước khi công bố.` : generated.validation.valid ? 'Bản nội dung đã được tạo; chưa thể lưu thành khóa học vì thiếu thành phần bắt buộc.' : 'Bản nháp chưa đạt kiểm tra nội dung; cần chỉnh hoặc tạo lại.' });
        } catch (error) { return next(error); }
    });

    router.get('/admin/course-drafts', guard(requirePermission, 'learning.ai.manage'), async (req, res, next) => { try { return ok(res, await models.AIContentDraft.find({ type: 'COURSE', mode: 'ADMIN' }).sort({ createdAt: -1 }).limit(50).lean()); } catch (error) { return next(error); } });
    router.get('/admin/course-drafts/:id', guard(requirePermission, 'learning.ai.manage'), async (req, res, next) => { try { if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã draft không hợp lệ.'); const draft = await models.AIContentDraft.findOne({ _id: req.params.id, type: 'COURSE', mode: 'ADMIN' }).lean(); if (!draft) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy AI draft.'); return ok(res, draft); } catch (error) { return next(error); } });

    router.post('/admin/course-drafts/:id/commit', guard(requirePermission, 'learning.ai.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã draft không hợp lệ.');
            const draft = await models.AIContentDraft.findOne({ _id: req.params.id, type: 'COURSE', mode: 'ADMIN' });
            if (!draft) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy AI draft.');
            if (draft.status === 'COMMITTED' && draft.committedCourseId) { const course = await models.Course.findById(draft.committedCourseId).lean(); return ok(res, { courseId: draft.committedCourseId, course, lessonCount: draft.metadata?.lessonCount || course?.syllabus?.lessonCount || 0, assessmentCount: draft.metadata?.assessmentCount || 0, alreadyMaterialized: true }, 'Khóa học và bài học đã được tạo trước đó; không tạo trùng.'); }
            if (!draft.validation?.valid) return fail(res, 409, 'AI_DRAFT_INVALID', 'Draft chưa vượt qua validation.');
            const adminContext = draft.context?.adminRequest || {};
            const result = await materializeCourse({ models, draft: draft.draft, mode: 'ADMIN', ownerUsername: '', request: adminContext, context: { ...(draft.context?.education || {}), ...(draft.context?.educationContext || {}) }, generateAudioAssets: req.body?.generateAudio !== false });
            draft.status = 'COMMITTED'; draft.committedCourseId = result.course._id; draft.metadata = { ...(draft.metadata || {}), committedAt: new Date(), audioGenerated: result.audioGenerated };
            await draft.save();
            await audit(req, 'AI_COMMIT', 'AIContentDraft', draft._id, null, draft.toObject());
            return res.status(201).json({ success: true, data: result, message: 'Đã materialize khóa học AI. Khóa học vẫn là AI_DRAFT; Admin cần publish sau khi review.' });
        } catch (error) { return next(error); }
    });

    router.post('/admin/course-drafts/:id/publish', guard(requirePermission, 'learning.ai.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã draft không hợp lệ.');
            const draft = await models.AIContentDraft.findOne({ _id: req.params.id, type: 'COURSE', mode: 'ADMIN' }).lean();
            if (!draft?.committedCourseId) return fail(res, 409, 'NOT_COMMITTED', 'Draft chưa được materialize.');
            const before = await models.Course.findById(draft.committedCourseId).lean();
            if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy khóa học materialized.');
            const course = await models.Course.findByIdAndUpdate(before._id, { $set: { kind: 'CANONICAL', status: 'ACTIVE', 'sourceRef.verification': 'unverified', 'sourceRef.notes': 'AI-generated and Admin reviewed/published. Không mặc định là official.' } }, { new: true }).lean();
            await models.CurriculumContent.updateMany({ courseId: before._id }, { $set: { status: 'PUBLISHED' } });
            await models.Question.updateMany({ courseId: before._id }, { $set: { status: 'PUBLISHED' } });
            await models.Assessment.updateMany({ courseId: before._id }, { $set: { publicationStatus: 'PUBLISHED' } });
            await audit(req, 'AI_PUBLISH', 'Course', before._id, before, course);
            return ok(res, course, 'Đã publish khóa học AI thành khóa học dùng chung.');
        } catch (error) { return next(error); }
    });

    router.post('/admin/course-drafts/:id/reject', guard(requirePermission, 'learning.ai.manage'), async (req, res, next) => {
        try {
            if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã draft không hợp lệ.');
            const draft = await models.AIContentDraft.findByIdAndUpdate(req.params.id, { $set: { status: 'REJECTED', 'metadata.rejectedAt': new Date(), 'metadata.rejectionReason': String(req.body?.reason || '').slice(0, 1000) } }, { new: true }).lean();
            if (!draft) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy draft.');
            await audit(req, 'AI_REJECT', 'AIContentDraft', req.params.id, null, draft);
            return ok(res, draft, 'Đã từ chối draft.');
        } catch (error) { return next(error); }
    });

    return router;
}

module.exports = { registerAiLearningRoutes };
