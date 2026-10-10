'use strict';

const express = require('express');
const crypto = require('crypto');
const { getCatalog, getSubject } = require('../../curriculum-data');
const { generateText, isGeminiConfigured, getGeminiModel } = require('../services/gemini-service');

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const DIFFICULTY_LABELS = { EASY: 'Cơ bản', MEDIUM: 'Trung bình', HARD: 'Nâng cao' };
const DIFFICULTY_SCORE = { EASY: 0, MEDIUM: 1, HARD: 2 };

function cleanText(value, max = 2000) {
    return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
}
function normalizeDifficulty(value) {
    const text = String(value || '').toLowerCase();
    if (/nâng cao|vận dụng cao|advanced|hard|khó/.test(text)) return 'HARD';
    if (/làm quen|cơ bản|foundation|easy|nhận biết/.test(text)) return 'EASY';
    return 'MEDIUM';
}
function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function fingerprint(parts) {
    return crypto.createHash('sha256').update(parts.map(item => String(item ?? '')).join('|')).digest('hex');
}
function studyDayKey(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
function nextReviewDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + Math.max(1, Number(days) || 1));
    return d;
}
function difficultyForLesson(lesson, questionIndex = 0) {
    const base = normalizeDifficulty(lesson?.difficulty);
    if (base !== 'MEDIUM') return base;
    if (Number(questionIndex) >= 8) return 'HARD';
    if (Number(questionIndex) <= 2) return 'EASY';
    return 'MEDIUM';
}
function publicQuestion(question) {
    if (!question) return null;
    return {
        id: String(question.id),
        code: String(question.code || question.id || ''),
        prompt: question.prompt || '',
        options: Array.isArray(question.options) ? question.options : [],
        subjectId: question.subjectId || '',
        lessonId: question.lessonId || '',
        lessonTitle: question.lessonTitle || '',
        skill: question.skill || 'Kiến thức',
        difficulty: question.difficulty || 'MEDIUM',
        difficultyLabel: DIFFICULTY_LABELS[question.difficulty] || DIFFICULTY_LABELS.MEDIUM
    };
}
function scoreLabel(percentage) {
    if (percentage >= 85) return { status: 'MASTERED', label: 'Đã nắm chắc' };
    if (percentage >= 70) return { status: 'PRACTICING', label: 'Đang vững dần' };
    if (percentage >= 50) return { status: 'LEARNING', label: 'Đang học' };
    return { status: 'REVIEW_REQUIRED', label: 'Cần ôn lại' };
}
function adjustDifficulty(current, isCorrect, correctStreak, accuracy) {
    const index = DIFFICULTY_SCORE[current] ?? 1;
    let next = index;
    if (isCorrect && (correctStreak >= 2 || accuracy >= 80)) next = Math.min(2, index + 1);
    if (!isCorrect && accuracy < 60) next = Math.max(0, index - 1);
    return DIFFICULTIES[next];
}
function chooseNext(pool, served, preferredDifficulty, history = []) {
    const servedSet = new Set(served.map(String));
    const available = pool.filter(item => !servedSet.has(String(item.id)));
    if (!available.length) return null;
    const recentIds = new Set(history.slice(-2).map(item => String(item.questionId)));
    const notRecent = available.filter(item => !recentIds.has(String(item.id)));
    const source = notRecent.length ? notRecent : available;
    source.sort((a, b) => {
        const distanceA = Math.abs((DIFFICULTY_SCORE[a.difficulty] ?? 1) - (DIFFICULTY_SCORE[preferredDifficulty] ?? 1));
        const distanceB = Math.abs((DIFFICULTY_SCORE[b.difficulty] ?? 1) - (DIFFICULTY_SCORE[preferredDifficulty] ?? 1));
        return distanceA - distanceB || String(a.skill).localeCompare(String(b.skill));
    });
    return source[0];
}
function flattenCatalogQuestions(grade, subjectId, skill) {
    const subject = getSubject(grade, subjectId, { includeLessons: true });
    if (!subject?.lessons?.length) return [];
    const targetSkill = cleanText(skill, 120).toLowerCase();
    const result = [];
    for (const lesson of subject.lessons) {
        for (const [index, question] of (lesson.questions || []).entries()) {
            if (question?.answer === undefined || question?.answer === null) continue;
            if (!Array.isArray(question.options) || question.options.length < 2) continue;
            const exactSkill = targetSkill && String(question.skill || '').toLowerCase() === targetSkill;
            result.push({
                id: `${grade}:${subject.id}:${lesson.id}:${question.id}`,
                code: question.id,
                prompt: question.prompt || '',
                options: question.options,
                answer: question.answer,
                explanation: question.explanation || '',
                subjectId: subject.id,
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                skill: question.skill || lesson.topic || subject.name,
                difficulty: difficultyForLesson(lesson, index),
                exactSkill,
                sourceType: 'CURRICULUM_PRACTICE'
            });
        }
    }
    result.sort((a, b) => Number(b.exactSkill) - Number(a.exactSkill));
    return result;
}
function findNextLesson(subject, records) {
    const lessons = Array.isArray(subject?.lessons) ? subject.lessons : [];
    const firstIncomplete = lessons.find(lesson => !records?.[lesson.id]?.passed);
    return firstIncomplete || lessons.find(lesson => records?.[lesson.id]?.nextReviewAt && new Date(records[lesson.id].nextReviewAt) <= new Date()) || null;
}
async function upsertLearningError(models, data) {
    if (!models?.LearningError || !data?.username || !data?.questionId) return null;
    const keyParts = data.sourceType === 'ADAPTIVE_PRACTICE'
        ? [data.username, data.sourceType, data.grade, data.subjectId, data.lessonId, data.questionId]
        : [data.username, data.sourceType, data.sourceId, data.questionId];
    const key = fingerprint(keyParts);
    const now = new Date();
    const filter = { username: data.username, fingerprint: key };
    const fields = {
        sourceType: cleanText(data.sourceType, 40), sourceId: cleanText(data.sourceId, 160), grade: Number(data.grade) || null,
        subjectId: cleanText(data.subjectId, 80), lessonId: cleanText(data.lessonId, 120), questionId: cleanText(data.questionId, 160), code: cleanText(data.code, 120),
        prompt: cleanText(data.prompt, 5000), options: Array.isArray(data.options) ? data.options.slice(0, 20) : [], correctAnswer: data.correctAnswer,
        userAnswer: data.userAnswer, explanation: cleanText(data.explanation, 3000), skill: cleanText(data.skill, 160), difficulty: cleanText(data.difficulty, 30),
        lastSeenAt: now, nextReviewAt: data.correct ? nextReviewDate(7) : nextReviewDate(1)
    };
    let existing = await models.LearningError.findOne(filter).lean();
    if (!existing) {
        try {
            const created = await models.LearningError.create({ ...fields, username: data.username, fingerprint: key, occurrenceCount: data.correct ? 0 : 1, correctStreak: data.correct ? 1 : 0, resolved: Boolean(data.correct), resolvedAt: data.correct ? now : null, createdAt: now });
            return created.toObject ? created.toObject() : created;
        } catch (error) {
            if (error?.code !== 11000) throw error;
            existing = await models.LearningError.findOne(filter).lean();
        }
    }
    const update = { $set: { ...fields } };
    if (!data.correct) {
        update.$inc = { occurrenceCount: 1 };
        update.$set.correctStreak = 0;
        update.$set.resolved = false;
        update.$set.resolvedAt = null;
    } else {
        const streak = Math.min(99, Number(existing?.correctStreak || 0) + 1);
        update.$set.correctStreak = streak;
        if (streak >= 2) { update.$set.resolved = true; update.$set.resolvedAt = now; }
    }
    return models.LearningError.findOneAndUpdate(filter, update, { new: true, runValidators: true }).lean();
}
async function recordLearningErrors({ models, username, sourceType, sourceId, grade, subjectId, lessonId, details = [] }) {
    if (!models?.LearningError || !username || !Array.isArray(details)) return [];
    const results = [];
    for (const detail of details) {
        const questionId = detail?.id || detail?.questionId;
        if (!detail || !questionId || detail.isCorrect !== false) continue;
        const item = await upsertLearningError(models, {
            username, sourceType, sourceId, grade, subjectId, lessonId, questionId, code: detail.code || String(questionId),
            prompt: detail.prompt || detail.code || String(questionId), options: detail.options, correctAnswer: detail.correctAnswer, userAnswer: detail.chosenAnswer ?? detail.chosen,
            explanation: detail.explanation, skill: detail.skill, difficulty: detail.difficulty || '', correct: Boolean(detail.isCorrect)
        });
        if (item) results.push(item);
    }
    return results;
}
function buildFallbackErrors(records = []) {
    const result = [];
    for (const record of records) {
        for (const detail of record.lastDetails || []) {
            if (detail?.isCorrect !== false || !detail?.id) continue;
            result.push({
                _id: `legacy-${record.subjectId}-${record.lessonId}-${detail.id}`,
                fingerprint: fingerprint([record.username, 'LESSON', `${record.subjectId}:${record.lessonId}`, detail.id]),
                username: record.username,
                sourceType: 'LESSON', sourceId: `${record.subjectId}:${record.lessonId}`,
                grade: record.grade, subjectId: record.subjectId, lessonId: record.lessonId, questionId: detail.id, code: detail.code || detail.id,
                prompt: detail.prompt, options: detail.options || [], correctAnswer: detail.correctAnswer, userAnswer: detail.chosenAnswer ?? detail.chosen,
                explanation: detail.explanation || '', skill: detail.skill || 'Kiến thức', occurrenceCount: 1, correctStreak: 0, resolved: false,
                nextReviewAt: record.nextReviewAt || new Date()
            });
        }
    }
    return result;
}
function compactErrors(errors = []) {
    const map = new Map();
    for (const item of errors) {
        const key = item.fingerprint || `${item.sourceType}|${item.sourceId}|${item.questionId}`;
        if (!map.has(key)) map.set(key, item);
    }
    return [...map.values()].sort((a, b) => Number(Boolean(a.resolved)) - Number(Boolean(b.resolved)) || new Date(b.lastSeenAt || b.createdAt || 0) - new Date(a.lastSeenAt || a.createdAt || 0));
}

function createLearningIntelligenceRouter({ models, requireAuth, legacyModels = {}, aiRateLimit }) {
    const router = express.Router();
    const rate = typeof aiRateLimit === 'function' ? aiRateLimit : (req, res, next) => next();
    const usernameOf = req => req.session.user.username;

    router.get('/status', requireAuth, async (req, res, next) => {
        try {
            const username = usernameOf(req);
            const [openErrors, masteryCount] = await Promise.all([
                models.LearningError.countDocuments({ username, resolved: false }),
                models.SkillMastery.countDocuments({ username })
            ]);
            return res.json({ success: true, data: { engine: 'LEARNING_INTELLIGENCE_V15', adaptivePractice: true, errorBook: true, dailyCoach: true, geminiConfigured: isGeminiConfigured(), geminiModel: isGeminiConfigured() ? getGeminiModel() : null, openErrors, masteryCount } });
        } catch (error) { return next(error); }
    });

    router.get('/coach/today', requireAuth, async (req, res, next) => {
        try {
            const username = usernameOf(req);
            const education = await models.EducationProfile.findOne({ username }).lean();
            const legacyProfile = legacyModels.LearningProfile ? await legacyModels.LearningProfile.findOne({ username }).lean() : null;
            const grade = clamp(req.query.grade || education?.grade || legacyProfile?.lastGrade, 1, 12, 1);
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 86400000);
            const [plan, mastery, errorDocs, legacyRecords, activities, attempts] = await Promise.all([
                models.LearningPlan.findOne({ username, status: 'ACTIVE' }).sort({ version: -1 }).lean(),
                models.SkillMastery.find({ username }).sort({ accuracy: 1, updatedAt: -1 }).limit(100).lean(),
                models.LearningError.find({ username, resolved: false }).sort({ nextReviewAt: 1, lastSeenAt: 1 }).limit(30).lean(),
                legacyModels.LearningRecord ? legacyModels.LearningRecord.find({ username, grade }).sort({ updatedAt: -1 }).lean() : [],
                legacyModels.LearningActivity ? legacyModels.LearningActivity.find({ username, createdAt: { $gte: weekAgo } }).sort({ createdAt: -1 }).limit(200).lean() : [],
                models.AssessmentAttempt.find({ username, status: { $in: ['SUBMITTED', 'REVIEW_REQUIRED'] } }).sort({ submittedAt: -1 }).limit(10).lean()
            ]);
            const errors = compactErrors([...errorDocs, ...buildFallbackErrors(legacyRecords)]);
            const dueMastery = mastery.filter(item => item.reviewDueAt && new Date(item.reviewDueAt) <= now).slice(0, 8);
            const subjectRecords = {};
            for (const record of legacyRecords) { subjectRecords[record.subjectId] ||= {}; subjectRecords[record.subjectId][record.lessonId] = record; }
            const catalog = getCatalog(grade);
            const weakest = [...mastery].filter(item => Number.isFinite(Number(item.accuracy))).sort((a, b) => Number(a.accuracy) - Number(b.accuracy))[0];
            const focusSubject = weakest?.subjectId || plan?.subjects?.find(item => item.priority === 'HIGH')?.subjectId || catalog.subjects[0]?.id;
            const focusSubjectData = catalog.subjects.find(item => item.id === focusSubject) || catalog.subjects[0];
            const nextLesson = findNextLesson(focusSubjectData, subjectRecords[focusSubjectData?.id] || {});
            const taskCandidates = [];
            if (errors[0]) taskCandidates.push({ id: `error:${errors[0].fingerprint}`, type: 'ERROR_REVIEW', icon: '🧠', title: `Sửa lỗi: ${errors[0].skill || 'kiến thức'}`, description: errors[0].prompt, minutes: 8, subjectId: errors[0].subjectId, lessonId: errors[0].lessonId, reason: 'Bạn đã từng trả lời sai nội dung này.' });
            if (dueMastery[0]) taskCandidates.push({ id: `mastery:${dueMastery[0]._id}`, type: 'MASTERY_REVIEW', icon: '🔁', title: `Ôn ${dueMastery[0].skill}`, description: `Điểm hiện tại ${Math.round(Number(dueMastery[0].accuracy || 0))}%. Nội dung đã đến hạn ôn.`, minutes: 10, subjectId: dueMastery[0].subjectId || '', skill: dueMastery[0].skill, reason: 'Spaced repetition: đã đến thời điểm ôn lại.' });
            if (weakest) taskCandidates.push({ id: `skill:${weakest.subjectId || 'all'}:${weakest.skill}`, type: 'WEAK_SKILL', icon: '🎯', title: `Tập trung ${weakest.skill}`, description: `Mastery hiện tại ${Math.round(Number(weakest.accuracy || 0))}%.`, minutes: 12, subjectId: weakest.subjectId || '', skill: weakest.skill, reason: 'Đây là vùng có mức độ thành thạo thấp nhất.' });
            if (nextLesson) taskCandidates.push({ id: `lesson:${focusSubjectData.id}:${nextLesson.id}`, type: 'NEXT_LESSON', icon: focusSubjectData.icon || '📘', title: nextLesson.title, description: nextLesson.topic || 'Bài tiếp theo trong lộ trình cá nhân.', minutes: Number(nextLesson.estimatedMinutes || 20), subjectId: focusSubjectData.id, lessonId: nextLesson.id, reason: 'Tiếp tục lộ trình theo tiến độ hiện tại.' });
            if (!taskCandidates.length) taskCandidates.push({ id: `adaptive:${grade}`, type: 'ADAPTIVE_PRACTICE', icon: '⚡', title: 'Luyện thích ứng 10 câu', description: 'Hệ thống sẽ điều chỉnh độ khó sau từng câu trả lời.', minutes: 15, subjectId: focusSubjectData?.id || '', reason: 'Chưa có đủ lịch sử để ưu tiên một skill cụ thể.' });
            const tasks = taskCandidates.slice(0, 4);
            const todayStart = startOfDay(now);
            const todayActivities = activities.filter(item => new Date(item.createdAt) >= todayStart);
            const completedTaskIds = new Set(todayActivities.map(item => item.metadata?.taskId).filter(Boolean).map(String));
            for (const task of tasks) task.completed = completedTaskIds.has(String(task.id));
            const todayMinutes = todayActivities.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
            const weekMinutes = activities.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
            const targetMinutes = Number(legacyProfile?.dailyGoalMinutes || 30);
            const completionPercent = Math.min(100, Math.round(todayMinutes / Math.max(1, targetMinutes) * 100));
            const assessmentScore = attempts.find(item => Number.isFinite(Number(item.score)))?.score ?? null;
            const summary = errors.length ? `Hôm nay ưu tiên xử lý ${errors.length} lỗi đang mở trước, sau đó mới tăng độ khó.` : weakest ? `Điểm yếu hiện tại là ${weakest.skill}; hãy dành ít nhất 12 phút để củng cố.` : 'Bạn đang có lộ trình rõ ràng. Hãy hoàn thành một phiên luyện thích ứng để hệ thống tiếp tục cập nhật mastery.';
            return res.json({ success: true, data: { date: studyDayKey(now), grade, gradeName: `Lớp ${grade}`, targetMinutes, todayMinutes, weekMinutes, completionPercent, completedTaskIds: [...completedTaskIds], summary, focus: weakest ? { skill: weakest.skill, subjectId: weakest.subjectId || '', accuracy: Number(weakest.accuracy || 0), status: weakest.status || 'LEARNING' } : null, openErrorCount: errors.filter(item => !item.resolved).length, dueReviewCount: dueMastery.length, latestAssessmentScore: assessmentScore, tasks, planVersion: plan?.version || null, ai: { configured: isGeminiConfigured(), model: isGeminiConfigured() ? getGeminiModel() : null } } });
        } catch (error) { return next(error); }
    });

    router.post('/coach/task-complete', requireAuth, async (req, res, next) => {
        try {
            const username = usernameOf(req);
            const taskId = cleanText(req.body?.taskId, 200);
            const minutes = clamp(req.body?.minutes, 1, 180, 10);
            const grade = clamp(req.body?.grade, 1, 12, 1);
            if (!taskId) return res.status(400).json({ success: false, code: 'TASK_ID_REQUIRED', message: 'Thiếu taskId.' });
            const idempotencyKey = cleanText(req.body?.idempotencyKey || `coach:${taskId}:${studyDayKey()}`, 200);
            const existing = await models.GamificationEvent.findOne({ username, idempotencyKey }).lean();
            if (existing) return res.json({ success: true, data: { duplicate: true, event: existing }, message: 'Nhiệm vụ hôm nay đã được ghi nhận.' });
            if (legacyModels.LearningActivity) {
                await legacyModels.LearningActivity.create({ username, grade, type: 'review', subjectId: cleanText(req.body?.subjectId, 80), lessonId: cleanText(req.body?.lessonId, 120), minutes, score: Number.isFinite(Number(req.body?.score)) ? Number(req.body.score) : null, metadata: { source: 'LEARNING_INTELLIGENCE_V15', taskId, taskType: cleanText(req.body?.taskType, 60) } });
            }
            if (legacyModels.LearningProfile) {
                await legacyModels.LearningProfile.findOneAndUpdate({ username }, { $setOnInsert: { username }, $addToSet: { studyDays: studyDayKey() }, $inc: { totalStudyMinutes: minutes, xp: Math.max(2, Math.round(minutes / 3)) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            }
            const event = await models.GamificationEvent.create({ username, eventType: 'LEARNING_COACH_TASK_COMPLETED', referenceId: taskId, idempotencyKey, payload: { grade, minutes, taskType: cleanText(req.body?.taskType, 60), subjectId: cleanText(req.body?.subjectId, 80), lessonId: cleanText(req.body?.lessonId, 120) }, processedAt: new Date() });
            return res.status(201).json({ success: true, data: { event, xpEarned: Math.max(2, Math.round(minutes / 3)) }, message: 'Đã ghi nhận hoàn thành nhiệm vụ của AI Coach.' });
        } catch (error) { return next(error); }
    });

    router.get('/errors', requireAuth, async (req, res, next) => {
        try {
            const username = usernameOf(req);
            const status = String(req.query.status || 'open').toLowerCase();
            const limit = clamp(req.query.limit, 1, 100, 40);
            const filter = { username };
            if (status === 'open') filter.resolved = false;
            if (status === 'resolved') filter.resolved = true;
            const docs = await models.LearningError.find(filter).sort({ resolved: 1, nextReviewAt: 1, lastSeenAt: -1 }).limit(limit).lean();
            let fallback = [];
            if (legacyModels.LearningRecord) {
                const grade = clamp(req.query.grade, 1, 12, null);
                const query = grade ? { username, grade } : { username };
                const records = await legacyModels.LearningRecord.find(query).sort({ updatedAt: -1 }).limit(100).lean();
                fallback = buildFallbackErrors(records);
            }
            const merged = compactErrors([...docs, ...fallback]).filter(item => status === 'all' ? true : status === 'resolved' ? Boolean(item.resolved) : !item.resolved).slice(0, limit);
            return res.json({ success: true, data: { count: merged.length, errors: merged } });
        } catch (error) { return next(error); }
    });

    router.patch('/errors/:id/resolve', requireAuth, async (req, res, next) => {
        try {
            const username = usernameOf(req);
            const item = await models.LearningError.findOneAndUpdate({ _id: req.params.id, username }, { $set: { resolved: true, resolvedAt: new Date(), correctStreak: 2, nextReviewAt: nextReviewDate(14) } }, { new: true }).lean();
            if (!item) return res.status(404).json({ success: false, code: 'ERROR_NOT_FOUND', message: 'Không tìm thấy lỗi cần đánh dấu.' });
            return res.json({ success: true, data: item, message: 'Đã đánh dấu lỗi đã xử lý.' });
        } catch (error) { return next(error); }
    });

    router.post('/adaptive-practice/sessions', requireAuth, async (req, res, next) => {
        try {
            const username = usernameOf(req);
            const education = await models.EducationProfile.findOne({ username }).lean();
            const legacyProfile = legacyModels.LearningProfile ? await legacyModels.LearningProfile.findOne({ username }).lean() : null;
            const grade = clamp(req.body?.grade || education?.grade || legacyProfile?.lastGrade, 1, 12, 1);
            const mastery = await models.SkillMastery.find({ username }).sort({ accuracy: 1, updatedAt: -1 }).limit(100).lean();
            const openErrors = await models.LearningError.find({ username, resolved: false }).sort({ lastSeenAt: -1 }).limit(30).lean();
            const catalog = getCatalog(grade);
            const targetSubject = cleanText(req.body?.subjectId || mastery.find(item => item.subjectId)?.subjectId || catalog.subjects[0]?.id, 80);
            const targetSkill = cleanText(req.body?.skill || mastery.find(item => item.subjectId === targetSubject)?.skill || openErrors.find(item => item.subjectId === targetSubject)?.skill || '', 120);
            const targetMastery = mastery.find(item => String(item.subjectId || '') === targetSubject && (!targetSkill || String(item.skill) === targetSkill));
            const initialAccuracy = Number(targetMastery?.accuracy);
            const startingDifficulty = Number.isFinite(initialAccuracy) ? initialAccuracy < 50 ? 'EASY' : initialAccuracy >= 80 ? 'HARD' : 'MEDIUM' : 'MEDIUM';
            const pool = flattenCatalogQuestions(grade, targetSubject, targetSkill);
            if (pool.length < 5) {
                const broader = flattenCatalogQuestions(grade, targetSubject, '');
                for (const item of broader) if (!pool.some(candidate => candidate.id === item.id)) pool.push(item);
            }
            if (pool.length < 5) return res.status(404).json({ success: false, code: 'PRACTICE_POOL_EMPTY', message: 'Chưa có đủ câu luyện tập cho môn/skill đã chọn.' });
            const prioritized = pool.sort((a, b) => Number(Boolean(b.exactSkill)) - Number(Boolean(a.exactSkill)) || Math.abs((DIFFICULTY_SCORE[a.difficulty] ?? 1) - DIFFICULTY_SCORE[startingDifficulty]) - Math.abs((DIFFICULTY_SCORE[b.difficulty] ?? 1) - DIFFICULTY_SCORE[startingDifficulty]));
            const requestedQuestionId = cleanText(req.body?.questionId, 160);
            const exactQuestion = requestedQuestionId ? prioritized.find(item => String(item.id) === requestedQuestionId || String(item.code) === requestedQuestionId) : null;
            const selectedPool = prioritized.slice(0, Math.min(30, prioritized.length));
            if (exactQuestion && !selectedPool.some(item => String(item.id) === String(exactQuestion.id))) selectedPool.unshift(exactQuestion);
            const first = exactQuestion || chooseNext(selectedPool, [], startingDifficulty, []);
            const session = await models.AdaptivePracticeSession.create({ username, grade, subjectId: targetSubject, skill: targetSkill, mode: 'ADAPTIVE_V1', targetDifficulty: startingDifficulty, questionPool: selectedPool, servedQuestionIds: [], currentQuestionId: first.id, answers: {}, history: [], correct: 0, total: 0, score: 0, status: 'IN_PROGRESS', startedAt: new Date(), recommendation: { startingAccuracy: Number.isFinite(initialAccuracy) ? initialAccuracy : null, rule: 'adjust difficulty after each answer using correctness, streak and running accuracy', targetQuestionId: exactQuestion?.id || null } });

            session.currentQuestionId = first.id;
            await session.save();
            return res.status(201).json({ success: true, data: { sessionId: session._id, grade, subjectId: targetSubject, skill: targetSkill, startingDifficulty, totalQuestions: 10, progress: 0, question: publicQuestion(first) }, message: 'Đã tạo phiên luyện thích ứng. Độ khó sẽ tự điều chỉnh sau từng câu.' });
        } catch (error) { return next(error); }
    });

    router.get('/adaptive-practice/sessions/:id', requireAuth, async (req, res, next) => {
        try {
            const session = await models.AdaptivePracticeSession.findOne({ _id: req.params.id, username: usernameOf(req) }).lean();
            if (!session) return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND', message: 'Không tìm thấy phiên luyện.' });
            const current = session.questionPool.find(item => String(item.id) === String(session.currentQuestionId));
            return res.json({ success: true, data: { sessionId: session._id, status: session.status, grade: session.grade, subjectId: session.subjectId, skill: session.skill, score: session.score, correct: session.correct, total: session.total, progress: Math.min(100, Math.round(Number(session.total || 0) / 10 * 100)), currentDifficulty: session.targetDifficulty, question: session.status === 'IN_PROGRESS' ? publicQuestion(current) : null, history: (session.history || []).map(item => ({ questionId: item.questionId, isCorrect: item.isCorrect, difficulty: item.difficulty, skill: item.skill })) } });
        } catch (error) { return next(error); }
    });

    router.post('/adaptive-practice/sessions/:id/answer', requireAuth, async (req, res, next) => {
        try {
            const username = usernameOf(req);
            const session = await models.AdaptivePracticeSession.findOne({ _id: req.params.id, username });
            if (!session) return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND', message: 'Không tìm thấy phiên luyện.' });
            if (session.status !== 'IN_PROGRESS') return res.status(409).json({ success: false, code: 'SESSION_CLOSED', message: 'Phiên luyện đã kết thúc.' });
            const question = (session.questionPool || []).find(item => String(item.id) === String(session.currentQuestionId));
            if (!question) return res.status(409).json({ success: false, code: 'QUESTION_STATE_INVALID', message: 'Không xác định được câu hỏi hiện tại.' });
            const chosen = req.body?.answer;
            const isCorrect = sameValue(chosen, question.answer);
            const historyItem = { questionId: question.id, code: question.code, isCorrect, difficulty: question.difficulty, skill: question.skill, subjectId: question.subjectId, lessonId: question.lessonId, chosenAnswer: chosen, correctAnswer: question.answer, explanation: question.explanation, answeredAt: new Date() };
            session.history.push(historyItem);
            session.servedQuestionIds.push(String(question.id));
            session.answers[String(question.id)] = chosen;
            session.total += 1;
            if (isCorrect) session.correct += 1;
            session.score = Number((session.correct / Math.max(1, session.total) * 100).toFixed(2));
            const currentStreak = session.history.slice().reverse().reduce((count, item) => item.isCorrect ? count + 1 : count, 0);
            const nextDifficulty = adjustDifficulty(session.targetDifficulty, isCorrect, currentStreak, session.score);
            const error = await upsertLearningError(models, { username, sourceType: 'ADAPTIVE_PRACTICE', sourceId: String(session._id), grade: session.grade, subjectId: question.subjectId, lessonId: question.lessonId, questionId: question.id, code: question.code, prompt: question.prompt, options: question.options, correctAnswer: question.answer, userAnswer: chosen, explanation: question.explanation, skill: question.skill, difficulty: question.difficulty, correct: isCorrect });
            if (session.total >= 10) {
                session.status = 'COMPLETED';
                session.completedAt = new Date();
                session.targetDifficulty = nextDifficulty;
                session.recommendation = { ...(session.recommendation || {}), finalAccuracy: session.score, result: scoreLabel(session.score), nextDifficulty };
                await session.save();
                await updateMastery(models, session);
                await logAdaptivePracticeCompletion(legacyModels, session);
                return res.json({ success: true, data: { completed: true, score: session.score, correct: session.correct, total: session.total, result: scoreLabel(session.score), currentDifficulty: nextDifficulty, answer: { isCorrect, chosen, correctAnswer: question.answer, explanation: question.explanation }, errorId: error?._id || null }, message: session.score >= 80 ? 'Rất tốt. Hệ thống đã tăng mức mastery của skill.' : 'Đã hoàn thành phiên. Hệ thống sẽ ưu tiên phần còn yếu trong lần luyện tiếp theo.' });
            }
            session.targetDifficulty = nextDifficulty;
            const nextQuestion = chooseNext(session.questionPool, session.servedQuestionIds, nextDifficulty, session.history);
            if (!nextQuestion) {
                session.status = 'COMPLETED';
                session.completedAt = new Date();
                await session.save();
                await updateMastery(models, session);
                await logAdaptivePracticeCompletion(legacyModels, session);
                return res.json({ success: true, data: { completed: true, score: session.score, correct: session.correct, total: session.total, result: scoreLabel(session.score), answer: { isCorrect, chosen, correctAnswer: question.answer, explanation: question.explanation } }, message: 'Đã hết câu trong pool; phiên được đóng tự động.' });
            }
            session.currentQuestionId = nextQuestion.id;
            await session.save();
            return res.json({ success: true, data: { completed: false, progress: Math.round(session.total / 10 * 100), score: session.score, correct: session.correct, total: session.total, currentDifficulty: nextDifficulty, answer: { isCorrect, chosen, correctAnswer: question.answer, explanation: question.explanation }, question: publicQuestion(nextQuestion), errorId: error?._id || null } });
        } catch (error) { return next(error); }
    });

    router.post('/coach/ask', requireAuth, rate, async (req, res, next) => {
        try {
            const question = cleanText(req.body?.question, 2000);
            if (!question) return res.status(400).json({ success: false, code: 'QUESTION_REQUIRED', message: 'Hãy nhập câu hỏi cho AI Coach.' });
            const username = usernameOf(req);
            const [plan, mastery, errors] = await Promise.all([
                models.LearningPlan.findOne({ username, status: 'ACTIVE' }).sort({ version: -1 }).lean(),
                models.SkillMastery.find({ username }).sort({ accuracy: 1 }).limit(20).lean(),
                models.LearningError.find({ username, resolved: false }).sort({ nextReviewAt: 1 }).limit(12).lean()
            ]);
            const context = { plan: plan ? { target: plan.target, subjects: plan.subjects?.slice(0, 10), weeklyPlan: plan.weeklyPlan?.slice(0, 7) } : null, weakSkills: mastery.slice(0, 10).map(item => ({ skill: item.skill, subjectId: item.subjectId, accuracy: item.accuracy, status: item.status, reviewDueAt: item.reviewDueAt })), openErrors: errors.slice(0, 10).map(item => ({ skill: item.skill, prompt: item.prompt, occurrenceCount: item.occurrenceCount, nextReviewAt: item.nextReviewAt })) };
            if (!isGeminiConfigured()) {
                const weak = mastery[0];
                const answer = weak ? `Tôi đang ưu tiên ${weak.skill} vì mastery hiện khoảng ${Math.round(Number(weak.accuracy || 0))}%. Hôm nay hãy làm một phiên luyện thích ứng 10 câu; nếu bạn sai, hệ thống sẽ tự hạ độ khó, còn khi bạn đúng liên tiếp hệ thống sẽ tăng độ khó. Bạn cũng đang có ${errors.length} lỗi cần xử lý.` : 'Tôi chưa có đủ dữ liệu lịch sử để cá nhân hóa sâu. Hãy làm một phiên luyện thích ứng hoặc hoàn thành placement/assessment trước; dữ liệu mới sẽ được dùng để điều chỉnh lộ trình.';
                return res.json({ success: true, data: { answer, generated: false, sourceType: 'RULE_BASED_COACH', context } });
            }
            const generated = await generateText({ prompt: `Câu hỏi của người học:\n${question}\n\nNgữ cảnh hệ thống (không được coi là nguồn chính thức):\n${JSON.stringify(context).slice(0, 12000)}`, systemInstruction: 'Bạn là AI Coach của Hành Trình Mới. Trả lời ngắn gọn, thực tế, ưu tiên hành động học tập tiếp theo dựa trên context. Không bịa điểm, không tự nhận nội dung là chương trình/đề thi chính thức. Không đưa chẩn đoán y khoa hay tâm lý. Khi dữ liệu thiếu, nói rõ.', maxOutputTokens: 1200, temperature: 0.35 });
            return res.json({ success: true, data: { answer: generated.text, generated: true, sourceType: 'GEMINI_AI_COACH', model: generated.model, context } });
        } catch (error) { return next(error); }
    });

    return router;
}

async function logAdaptivePracticeCompletion(legacyModels, session) {
    if (!legacyModels?.LearningActivity) return;
    await legacyModels.LearningActivity.create({
        username: session.username,
        grade: Number(session.grade),
        type: 'review',
        subjectId: session.subjectId || '',
        lessonId: '',
        minutes: Math.min(120, Math.max(5, Math.round(Number(session.total || 0) * 1.5))),
        score: Number(session.score || 0),
        metadata: { source: 'LEARNING_INTELLIGENCE_V15', sessionId: String(session._id), mode: session.mode || 'ADAPTIVE_V1', correct: Number(session.correct || 0), total: Number(session.total || 0) }
    });
}

async function updateMastery(models, session) {
    const groups = new Map();
    for (const item of session.history || []) {
        const key = `${item.subjectId}|${item.skill}`;
        const bucket = groups.get(key) || { subjectId: item.subjectId, skill: item.skill, correct: 0, total: 0 };
        bucket.total += 1;
        if (item.isCorrect) bucket.correct += 1;
        groups.set(key, bucket);
    }
    for (const bucket of groups.values()) {
        const existing = await models.SkillMastery.findOne({ username: session.username, subjectId: bucket.subjectId, skill: bucket.skill });
        const oldAttempts = Number(existing?.attempts || 0);
        const oldAccuracy = Number(existing?.accuracy || 0);
        const newAttempts = oldAttempts + bucket.total;
        const newAccuracy = Number((((oldAccuracy * oldAttempts) + (bucket.correct * 100)) / Math.max(1, newAttempts)).toFixed(2));
        const status = scoreLabel(newAccuracy).status;
        const reviewDays = newAccuracy >= 85 ? 14 : newAccuracy >= 70 ? 7 : newAccuracy >= 50 ? 3 : 1;
        await models.SkillMastery.findOneAndUpdate({ username: session.username, subjectId: bucket.subjectId, skill: bucket.skill }, { $set: { username: session.username, subjectId: bucket.subjectId, skill: bucket.skill, status, accuracy: newAccuracy, attempts: newAttempts, recentScore: Number((bucket.correct / Math.max(1, bucket.total) * 100).toFixed(2)), averageScore: newAccuracy, lastAttempt: new Date(), reviewDueAt: nextReviewDate(reviewDays) }, $inc: { timeSpent: 0 } }, { upsert: true, new: true, runValidators: true });
    }
}

module.exports = { createLearningIntelligenceRouter, recordLearningErrors };
