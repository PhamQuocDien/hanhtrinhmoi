'use strict';

const crypto = require('crypto');
const { generateStructured, isGeminiConfigured, getGeminiModel, isRemoteAiAllowed, getAiMode } = require('./gemini-service');
const { buildLearnerContext, inferLearnerContext, ensurePersonalCourse } = require('./ai-learning-service');
const { STARTER_COURSES } = require('./starter-course-catalog');

const ambientSchema = {
    type: 'object',
    properties: {
        headline: { type: 'string' },
        summary: { type: 'string' },
        priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH'] },
        insights: { type: 'array', items: { type: 'string' } },
        gaps: { type: 'array', items: { type: 'string' } },
        recommendations: {
            type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' }, reason: { type: 'string' }, action: { type: 'string' }, url: { type: 'string' }
            }, required: ['title', 'reason', 'action'] }
        },
        nextStep: { type: 'string' },
        shouldCreateCourse: { type: 'boolean' },
        coursePrompt: { type: 'string' },
        confidence: { type: 'number' }
    },
    required: ['headline', 'summary', 'priority', 'insights', 'gaps', 'recommendations', 'nextStep', 'shouldCreateCourse', 'coursePrompt', 'confidence']
};

const AMBIENT_GEMINI_LAST = new Map();
const AMBIENT_GEMINI_MIN_INTERVAL_MS = Math.max(30000, Number(process.env.AI_AUTOPILOT_GEMINI_MIN_INTERVAL_MS || 120000));

const PAGE_LABELS = {
    home: 'Trang tổng quan học tập',
    learning: 'Lộ trình học tập',
    course: 'Khóa học',
    'course-catalog': 'Catalog khóa học',
    'course-detail': 'Chi tiết khóa học',
    lesson: 'Bài học',
    assessment: 'Bài kiểm tra',
    exam: 'Kỳ thi mô phỏng',
    survey: 'Khảo sát',
    placement: 'Kiểm tra đầu vào',
    university: 'Đại học',
    english: 'TOEIC / IELTS',
    speaking: 'Luyện nói',
    writing: 'Luyện viết',
    parent: 'Phụ huynh',
    profile: 'Hồ sơ học tập',
    task: 'Nhiệm vụ',
    notification: 'Thông báo',
    game: 'Hoạt động trò chơi',
    admin: 'Quản trị hệ thống',
    other: 'Hoạt động trên Hành Trình Mới'
};

function clean(value, max = 5000) { return String(value ?? '').trim().slice(0, max); }
function asList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean);
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data?.items)) return value.data.items;
    if (Array.isArray(value?.data)) return value.data;
    if (value && typeof value === 'object') return Object.values(value).filter(item => ['string', 'number'].includes(typeof item));
    return [];
}
function listText(value) {
    return asList(value).map(item => item && typeof item === 'object' ? clean(item.label || item.title || item.name || item.code || item.value || '') : clean(item, 300)).filter(Boolean);
}
function fingerprint(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function normalizeTokens(value) { return clean(value, 2000).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(token => token.length > 2); }
function similarity(a, b) {
    const left = new Set(normalizeTokens(a));
    const right = new Set(normalizeTokens(b));
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    for (const token of left) if (right.has(token)) overlap += 1;
    return overlap / Math.max(left.size, right.size);
}
function pageLabel(pageKey) { return PAGE_LABELS[pageKey] || PAGE_LABELS.other; }
function safeEvent(event = {}) {
    return {
        type: clean(event.type || 'PAGE_VIEW', 60), endpoint: clean(event.endpoint || '', 240), method: clean(event.method || 'GET', 12),
        status: Number(event.status) || 0, result: event.result && typeof event.result === 'object' ? sanitizeResult(event.result) : {}
    };
}
function sanitizeResult(value, depth = 0) {
    if (depth > 2) return undefined;
    if (Array.isArray(value)) return value.slice(0, 6).map(item => sanitizeResult(item, depth + 1)).filter(item => item !== undefined);
    if (!value || typeof value !== 'object') {
        if (typeof value === 'string') return value.slice(0, 280);
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        return undefined;
    }
    const allowed = ['score', 'percentage', 'passed', 'correct', 'total', 'status', 'level', 'xpEarned', 'streak', 'recommendation', 'scores', 'action', 'decision', 'priority', 'target', 'exam', 'variant', 'skill', 'courseId', 'assessmentId', 'learningPlanId'];
    const result = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(value, key)) {
        const child = sanitizeResult(value[key], depth + 1);
        if (child !== undefined) result[key] = child;
    }
    return result;
}
function choosePageKey(pathname = '', title = '') {
    const path = clean(pathname, 250).toLowerCase();
    const value = `${path} ${clean(title, 200).toLowerCase()}`;
    if (path.includes('/admin') || documentLikeAdmin(value)) return 'admin';
    if (value.includes('trung-tam-hoc-tap') || value.includes('learning hub')) return 'home';
    if (value.includes('lo-trinh-hoc-tap') || value.includes('lộ trình')) return 'learning';
    if (value.includes('khoa-hoc-chi-tiet') || value.includes('course detail') || value.includes('chi tiết khóa học')) return 'course-detail';
    if (value.includes('khoa-hoc.html') || value.includes('catalog khóa học') || value.includes('course catalog')) return 'course-catalog';
    if (value.includes('ai-course') || value.includes('khóa học ai')) return 'course';
    if (value.includes('assessment') || value.includes('bài kiểm tra')) return 'assessment';
    if (value.includes('bai-kiem-tra') || value.includes('kỳ thi')) return 'exam';
    if (value.includes('placement')) return 'placement';
    if (value.includes('survey') || value.includes('khảo sát')) return 'survey';
    if (value.includes('university') || value.includes('đại học')) return 'university';
    if (value.includes('english') || value.includes('toeic') || value.includes('ielts')) return 'english';
    if (value.includes('luyen-noi-tieng-anh') || value.includes('speaking')) return 'speaking';
    if (value.includes('luyen-noi') || value.includes('writing')) return 'writing';
    if (value.includes('phu-huynh')) return 'parent';
    if (value.includes('profile') || value.includes('hồ sơ')) return 'profile';
    if (value.includes('nhiem-vu') || value.includes('nhiệm vụ')) return 'task';
    if (value.includes('thong-bao') || value.includes('thông báo')) return 'notification';
    if (/caro|co-vua|co-vay|othello|co-ty-phu|game-hub|ghep-hinh|survival|dau-truong|giai-dau/.test(value)) return 'game';
    return 'other';
}
function documentLikeAdmin(value) { return /admin application|ứng dụng quản trị/.test(value); }

function courseCandidates(context, searchText) {
    const majorCode = context.educationContext?.major?.code || '';
    const targetExam = String(context.learning?.survey?.englishGoal || '').toUpperCase();
    const dbCourses = asList(context.courses).filter(course => course && typeof course === 'object' && course.ownerUsername !== context.profile?.username);
    const dbCodes = new Set(dbCourses.map(course => String(course.code || '')));
    const virtualStarters = STARTER_COURSES.filter(course => !dbCodes.has(course.code)).map(course => ({ ...course, id: course.code, syllabus: { track: course.track, audience: course.audience, targetExam: course.targetExam, targetVariant: course.targetVariant, skills: course.skills, majorTracks: course.majorTracks, aliases: course.aliases, starter: true }, ownerUsername: '' }));
    return [...dbCourses, ...virtualStarters].map(course => {
        const text = `${course.name || course.title || ''} ${course.code || ''} ${course.subjectId || ''} ${course.category || ''} ${course.syllabus?.audience || course.audience || ''} ${course.syllabus?.track || course.track || ''} ${course.syllabus?.targetExam || course.targetExam || ''} ${course.syllabus?.targetVariant || course.targetVariant || ''} ${listText(course.syllabus?.skills ?? course.skills).join(' ')} ${listText(course.syllabus?.majorTracks ?? course.majorTracks).join(' ')} ${listText(course.syllabus?.aliases ?? course.aliases).join(' ')}`;
        let match = Math.max(similarity(searchText, text), similarity(context.educationContext?.major?.name, text), similarity(majorCode, text));
        if (targetExam && String(course.syllabus?.targetExam || course.targetExam || '').toUpperCase() === targetExam) match += 0.35;
        if (majorCode && Array.isArray(course.syllabus?.majorTracks || course.majorTracks) && (course.syllabus?.majorTracks || course.majorTracks).includes(majorCode)) match += 0.3;
        if (String(course.syllabus?.track || course.track || '').toUpperCase() === 'MOS' && /mos|word|excel|powerpoint/i.test(searchText)) match += 0.35;
        return { ...course, match: Math.min(1, match) };
    }).sort((a, b) => b.match - a.match).slice(0, 8);
}

function heuristicInsight({ context, pageKey, event }) {
    const mastery = asList(context.mastery).filter(item => item && typeof item === 'object');
    const weak = mastery.filter(item => Number(item.accuracy) < 60).sort((a, b) => Number(a.accuracy || 0) - Number(b.accuracy || 0)).slice(0, 5);
    const overdue = mastery.filter(item => item.reviewDueAt && new Date(item.reviewDueAt) <= new Date()).slice(0, 4);
    const goal = listText(context.learning?.goals)[0] || context.learning?.inference?.careerGoal || '';
    const major = context.educationContext?.major?.name || context.learning?.inference?.major || '';
    const searchText = [goal, major, pageLabel(pageKey), ...weak.map(item => item.skill)].filter(Boolean).join(' ');
    const candidates = courseCandidates(context, searchText);
    const recommendations = candidates.filter(item => item.match >= 0.14).slice(0, 3).map(item => ({ title: item.name, reason: `Phù hợp khoảng ${(item.match * 100).toFixed(0)}% với mục tiêu/ngữ cảnh hiện tại.`, action: 'Học khóa học này', url: `/khoa-hoc-chi-tiet.html?id=${encodeURIComponent(item.id || item._id || item.code)}` }));
    const gaps = weak.map(item => `${item.skill} (${Math.round(Number(item.accuracy || 0))}%)`);
    if (overdue.length) for (const item of overdue) if (!gaps.includes(item.skill)) gaps.push(`${item.skill} · đến hạn ôn`);
    const educationLevel = String(context.education?.educationLevel || '').toUpperCase();
    const strongNeed = Boolean(goal || major || context.learning?.inference?.careerGoal || weak.length || /toeic|ielts|mos|word|excel|powerpoint|cntt|công nghệ thông tin/i.test(searchText));
    const topCandidate = candidates[0] || null;
    const topSkills = topCandidate ? (topCandidate.syllabus?.skills || topCandidate.skills || []) : [];
    const uncoveredWeak = weak.some(item => !topSkills.some(skill => similarity(item.skill, skill) > 0.45 || similarity(skill, item.skill) > 0.45));
    const lowCoverage = Boolean(topCandidate && topCandidate.match < 0.3);
    const shouldCreateCourse = strongNeed && (
        !recommendations.length ||
        uncoveredWeak ||
        lowCoverage
    ) && (Boolean(major) || Boolean(goal) || educationLevel === 'HIGHER_EDUCATION' || educationLevel === 'ENGLISH_CERTIFICATION' || ['university', 'english', 'learning'].includes(pageKey));
    const headline = event.type === 'API_SUCCESS' ? 'AI vừa cập nhật phân tích từ hoạt động của bạn' : 'AI đang theo dõi và tối ưu hành trình học';
    const summary = weak.length ? `AI phát hiện ${weak.length} kỹ năng cần ưu tiên${major ? ` trong ngữ cảnh ${major}` : ''}.` : 'Dữ liệu hiện tại chưa cho thấy khoảng trống lớn; AI sẽ tiếp tục theo dõi kết quả mới.';
    return {
        headline, summary, priority: weak.length >= 2 ? 'HIGH' : 'NORMAL',
        insights: [
            major ? `Ngành/chuyên ngành hiện tại: ${major}.` : goal ? `Mục tiêu hiện tại: ${goal}.` : 'AI chưa có mục tiêu đủ rõ để tối ưu sâu.',
            weak.length ? `Ưu tiên gần nhất: ${weak.map(item => item.skill).slice(0, 3).join(', ')}.` : 'Hãy tiếp tục học để AI có thêm dữ liệu cá nhân hóa.',
            event.result?.score !== undefined ? `Kết quả hoạt động gần nhất: ${event.result.score}%.` : ''
        ].filter(Boolean),
        gaps: gaps.slice(0, 5), recommendations, nextStep: shouldCreateCourse ? 'Không thấy khóa học đủ sát nhu cầu; AI nên tạo một khóa học cá nhân ngắn theo gap này.' : (recommendations[0]?.title ? `Tiếp tục với ${recommendations[0].title}.` : 'Tiếp tục bài học kế tiếp trong lộ trình.'),
        shouldCreateCourse, coursePrompt: [goal && `Mục tiêu: ${goal}`, major && `Ngành: ${major}`, gaps.length && `Skill gaps: ${gaps.join(', ')}`, `Ngữ cảnh: ${pageLabel(pageKey)}`].filter(Boolean).join('\n'), confidence: 0.62,
        sourceType: 'RULE_BASED_AMBIENT_AI'
    };
}

async function generateAmbientInsight({ models, username, pageKey = 'other', event = {}, force = false } = {}) {
    const cleanPage = PAGE_LABELS[pageKey] ? pageKey : 'other';
    const safe = safeEvent(event);
    const remoteAiOptIn = String(process.env.AI_REMOTE_FALLBACK_ENABLED || 'false').toLowerCase() === 'true';
    const context = remoteAiOptIn && isRemoteAiAllowed() && isGeminiConfigured() ? (await inferLearnerContext({ models, username, force: false })).context : await buildLearnerContext(models, username);
    const weakSkills = (context.mastery || []).filter(item => Number(item.accuracy) < 60).slice(0, 8).map(item => item.skill);
    const contextKey = fingerprint({ education: context.education, educationContext: context.educationContext, goals: context.learning?.goals, inference: context.learning?.inference, weakSkills });
    const key = fingerprint({ username, pageKey: cleanPage, contextKey });
    const meaningfulEvent = safe.method !== 'GET' || safe.type === 'API_ERROR' || /submit|attempt|complete|result|assessment|placement|survey|course|lesson/i.test(safe.endpoint);
    const cacheTtl = meaningfulEvent ? 45 * 1000 : 5 * 60 * 1000;
    if (!force && models.AIAmbientInsight) {
        const cached = await models.AIAmbientInsight.findOne({ username, fingerprint: key }).sort({ createdAt: -1 }).lean();
        if (cached && new Date(cached.createdAt).getTime() > Date.now() - cacheTtl) return { ...cached.insight, cached: true, generatedAt: cached.createdAt, model: cached.model || 'ambient-cache', fingerprint: key };
    }
    const input = {
        pageKey: cleanPage, event: safe,
        education: context.education, educationContext: context.educationContext,
        learning: context.learning, mastery: asList(context.mastery).slice(0, 50), currentPlan: context.currentPlan,
        recentCourses: asList(context.courses).slice(0, 120)
    };
    const heuristic = heuristicInsight({ context, pageKey: cleanPage, event: safe });
    let insight = heuristic;
    let model = 'RULE_BASED_AUTOPILOT';
    const highValueEvent = meaningfulEvent || safe.type === 'PAGE_VIEW' && ['assessment', 'placement', 'speaking', 'writing'].includes(cleanPage);
    const ambientKey = `${username}:${cleanPage}`;
    const lastGeminiAt = AMBIENT_GEMINI_LAST.get(ambientKey) || 0;
    const geminiAllowed = remoteAiOptIn && isRemoteAiAllowed() && isGeminiConfigured() && highValueEvent && (force || Date.now() - lastGeminiAt >= AMBIENT_GEMINI_MIN_INTERVAL_MS);
    if (geminiAllowed) {
        AMBIENT_GEMINI_LAST.set(ambientKey, Date.now());
        const prompt = `Bạn là AI Learning Director chạy ngầm trong Hành Trình Mới. Không chờ người học bấm nút AI. Hãy phân tích hoạt động hiện tại, ngành/lớp, mục tiêu, mastery, khóa học catalog và skill gaps để quyết định bước học tiếp theo. Trang: ${pageLabel(cleanPage)}. Event: ${JSON.stringify(safe)}. Context: ${JSON.stringify(input).slice(0, 34000)}.`;
        try {
            const result = await generateStructured({
                prompt, schema: ambientSchema,
                systemInstruction: 'Ưu tiên catalog có sẵn. Nếu catalog không phủ gap thì shouldCreateCourse=true và coursePrompt phải chỉ rõ track, skill và đầu ra. Không nhận nội dung AI là official. JSON phải đầy đủ và hợp lệ.',
                maxOutputTokens: 3200, temperature: 0.2
            });
            const modelData = { ...result.data };
            const modelRecommendations = Array.isArray(modelData.recommendations) ? modelData.recommendations : [];
            if (!modelRecommendations.length && heuristic.shouldCreateCourse) modelData.shouldCreateCourse = true;
            if (!modelData.coursePrompt && heuristic.coursePrompt) modelData.coursePrompt = heuristic.coursePrompt;
            insight = { ...heuristic, ...modelData, sourceType: 'GEMINI_AMBIENT_AI', fallbackUsed: Boolean(result.fallbackUsed) };
            model = result.model;
        } catch (error) {
            insight = { ...heuristic, degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE' };
        }
    }
    if (models.AIAmbientInsight) {
        try {
            await models.AIAmbientInsight.create({ username, pageKey: cleanPage, eventType: safe.type, endpoint: safe.endpoint, fingerprint: key, insight, model, generatedAt: new Date(), sourceType: insight.sourceType || 'RULE_BASED_AMBIENT_AI' });
        } catch (_) {}
    }
    const autoEligible = meaningfulEvent || (safe.type === 'PAGE_VIEW' && ['home', 'learning', 'university', 'english'].includes(cleanPage));
    if (insight.shouldCreateCourse && autoEligible) {
        try {
            const provision = await queueAutoProvisionCourse({ models, username, prompt: insight.coursePrompt || heuristic.coursePrompt, pageKey: cleanPage, personalizeFromStarter: Boolean(insight.shouldCreateCourse && heuristic.recommendations?.length) });
            insight = { ...insight, autoCourse: provision, shouldCreateCourse: false };
        } catch (error) {
            insight = { ...insight, autoCourse: { created: false, queued: false, decision: 'AUTO_COURSE_QUEUE_ERROR', message: error?.message || 'Không thể xếp hàng tạo course lúc này.' } };
        }
    }
    return { ...insight, generatedAt: new Date(), model, fingerprint: key, cached: false, aiMode: getAiMode() };
}

async function queueAutoProvisionCourse({ models, username, prompt = '', pageKey = 'other', personalizeFromStarter = false } = {}) {
    if (!models.AIGenerationJob) return { created: false, queued: false, decision: 'QUEUE_UNAVAILABLE' };
    const request = { prompt: String(prompt || '').slice(0, 6000), personalizeFromStarter: Boolean(personalizeFromStarter) };
    const idempotencyKey = `PERSONAL_COURSE:${username}:${crypto.createHash('sha256').update(JSON.stringify({ pageKey, request })).digest('hex').slice(0, 28)}`;
    const existing = await models.AIGenerationJob.findOne({ idempotencyKey }).lean();
    if (existing) {
        if (existing.status === 'COMPLETED') return { created: Boolean(existing.result?.courseId), queued: false, completed: true, decision: existing.result?.decision || 'COMPLETED', courseId: existing.result?.courseId || '', reason: existing.result?.reason || [], url: existing.result?.courseId ? `/ai-course.html?id=${encodeURIComponent(existing.result.courseId)}` : '' };
        return { created: false, queued: true, jobId: String(existing._id), decision: 'QUEUED_PERSONAL_COURSE', reason: ['AI đã tự xếp hàng tạo khóa học; worker sẽ xử lý tuần tự để giảm quá tải Gemini.'] };
    }
    const job = await models.AIGenerationJob.create({ username, type: 'PERSONAL_COURSE', status: 'QUEUED', priority: 90, payload: { username, pageKey, request }, idempotencyKey, nextRunAt: new Date() });
    return { created: false, queued: true, jobId: String(job._id), decision: 'QUEUED_PERSONAL_COURSE', reason: ['AI đã tự xếp hàng tạo khóa học và sẽ lưu trọn course, lesson, test, midterm và final vào MongoDB khi hoàn tất.'] };
}

async function autoProvisionCourse({ models, username, prompt = '', pageKey = 'other', personalizeFromStarter = false } = {}) {
    const supported = ['home', 'learning', 'university', 'english', 'assessment', 'placement', 'speaking', 'writing', 'course', 'exam'];
    if (!supported.includes(pageKey)) return { created: false, reason: 'PAGE_NOT_SUPPORTED' };
    const request = { prompt: clean(prompt, 6000) || 'Tạo khóa học cá nhân dựa trên profile, ngành, mục tiêu và skill gaps hiện tại.', generateAudio: false, personalizeFromStarter: Boolean(personalizeFromStarter) };
    const result = await ensurePersonalCourse({ models, username, request });
    const created = result.decision === 'CREATE_PERSONAL_COURSE';
    const reused = result.decision === 'USE_EXISTING_COURSE';
    const courseId = result.courseId ? String(result.courseId) : '';
    return { created, reused, courseId, decision: result.decision, reason: result.reason || [], source: result.source || '', starterCode: result.starterCode || '', url: courseId ? (created ? `/ai-course.html?id=${encodeURIComponent(courseId)}` : `/khoa-hoc-chi-tiet.html?id=${encodeURIComponent(courseId)}`) : '' };
}

module.exports = { generateAmbientInsight, autoProvisionCourse, queueAutoProvisionCourse, PAGE_LABELS, choosePageKey, ambientSchema, sanitizeResult };
