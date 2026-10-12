'use strict';
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const LearningProgress = require('../models/LearningProgress');
const AssessmentAttempt = require('../models/AssessmentAttempt');
const AssessmentSession = require('../models/AssessmentSession');
const PartCheckpointSession = require('../models/PartCheckpointSession');
const QuestionBankItem = require('../models/QuestionBankItem');
const ContentEntry = require('../models/ContentEntry');
const { getVideoLink } = require('../../../../content/video-links');
const { recordActivity } = require('../services/activity-log');
const crypto = require('node:crypto');
const SurveyResponse = require('../models/SurveyResponse');
const { requireLearner } = require('../middleware/security');
const curriculum = require('../../../../content/curriculum');
const questionBank = require('../../../../content/question-banks');
const { selectQuestionPaper, filterQuestionPool } = require('../services/assessment-generator');
const { aiConfigured, gradeWrittenAnswer, tutorReply, recommendNextStep, createPersonalizedStudyPlan, normalizeText } = require('../services/learning-ai.service');
const learningPolicy = require('../services/learning-policy');
const { recordPartPosition, wasPartViewed, lastViewedPart, chooseResumePart } = require('../services/progress-state');

const router = express.Router();
const AI_LIMIT = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau.' } });
const PASS_SCORE = Math.min(95, Math.max(50, Number(process.env.LEARNING_UNLOCK_SCORE) || 70));
const CHECKPOINT_PASS_SCORE = Math.min(95, Math.max(50, Number(process.env.LEARNING_CHECKPOINT_SCORE) || 70));
router.use(requireLearner);

function parseLessonId(lessonId) {
  const match = typeof lessonId === 'string' && lessonId.match(/^(ctst|kntt|canhdieu)-g(1[0-2]|[1-9])-([a-z_]+)-u([1-4])-l([1-4])$/);
  if (!match) return null;
  return { programCode: match[1], grade: Number(match[2]), subjectCode: match[3], lessonId };
}
function parseCourse(query) {
  const grade = curriculum.normalizeGrade(query.grade);
  const programCode = String(query.programCode || query.program || 'ctst');
  const subjectCode = String(query.subjectCode || query.subject || 'math');
  if (!grade || !curriculum.normalizeProgram(programCode)) return null;
  const course = curriculum.buildCourse(grade, programCode, subjectCode);
  if (!course) return null;
  return { grade, programCode, subjectCode, course };
}
function emptyProgress() { return { completedParts: [], viewedParts: [], lessons: [], currentLessonId: '', currentPartId: '' }; }
const { getPartProgress, getLessonProgress, lessonPassed: lessonPassedAtScore, findPreviousLesson, isLessonUnlocked: unlockedAtScore, allPartsPassed, courseLessonList } = learningPolicy;
function lessonPassed(progress, lessonId) { return lessonPassedAtScore(progress, lessonId, PASS_SCORE); }
function isLessonUnlocked(course, lesson, progress) { return unlockedAtScore(course, lesson, progress, PASS_SCORE); }
function sanitizeCourse(course, progress) {
  return {
    id: course.id, grade: course.grade, programCode: course.programCode, programName: course.programName,
    approach: course.approach, subjectCode: course.subjectCode, subjectName: course.displayName || course.subjectName,
    subjectIcon: course.subjectIcon, optional: course.optional, required: course.required,
    lessonCount: course.lessonCount, contentStatus: course.contentStatus,
    units: course.units.map((unit) => ({ id: unit.id, title: unit.title, sequence: unit.sequence, lessons: unit.lessons.map((lesson) => {
      const record = getLessonProgress(progress, lesson.id);
      return { id: lesson.id, title: lesson.title, sequence: lesson.sequence, estimatedMinutes: lesson.estimatedMinutes,
        unlocked: isLessonUnlocked(course, lesson, progress), completed: lessonPassed(progress, lesson.id),
        bestScore: Number(record?.bestScore || 0), attempts: Number(record?.attempts || 0),
        parts: lesson.parts.length, assessmentTypes: ['lesson'] };
    }) }))
  };
}
function tidyAnswer(value) { return String(value ?? '').trim().slice(0, 5000); }
function normalizeStructuredAnswer(type, answer) {
  const value = String(answer ?? '').normalize('NFKC').trim().toLocaleLowerCase('vi-VN');
  if (type === 'multiple_select') return value.split('|').map((item) => item.trim()).filter(Boolean).sort().join('|');
  if (type === 'matching') return value.split('|').map((item) => item.trim()).filter(Boolean).sort().join('|');
  if (type === 'ordering') return value.split('|').map((item) => item.trim()).filter(Boolean).join('|');
  return normalizeText(value);
}
function isAnswerCorrect(question, answer) {
  const value = normalizeStructuredAnswer(question.type, answer);
  const correct = normalizeStructuredAnswer(question.type, question.correctAnswer);
  const accepted = (question.acceptedAnswers || [question.correctAnswer]).map((item) => normalizeStructuredAnswer(question.type, item));
  return accepted.includes(value) || value === correct;
}
const OBJECTIVE_QUESTION_TYPES = new Set(['multiple_choice', 'true_false', 'fill_blank', 'multiple_select', 'matching', 'ordering']);
function calculateObjectiveScore(questions, answers) {
  const byId = new Map(answers.map((item) => [item.questionId, tidyAnswer(item.answer)]));
  let possible = 0;
  let earned = 0;
  const feedback = [];
  for (const question of questions) {
    if (!OBJECTIVE_QUESTION_TYPES.has(question.type)) continue;
    possible += Number(question.points || 0);
    const answer = byId.get(question.id) || '';
    const correct = isAnswerCorrect(question, answer);
    if (correct) earned += Number(question.points || 0);
    feedback.push({ questionId: question.id, type: question.type, correct, correctAnswer: question.correctAnswer, explanation: question.explanation || '' });
  }
  return { possible, earned, feedback, answersById: byId };
}
function selectAssessmentLessons(context, type, unitId, lessonId) {
  const allLessons = courseLessonList(context.course);
  if (type === 'lesson') {
    const lesson = allLessons.find((item) => item.id === lessonId);
    return lesson ? { selectedLessons: [lesson], scopeId: lessonId, lessonId, title: `Kiểm tra bài: ${lesson.title}` } : null;
  }
  if (type === 'chapter') {
    const unit = context.course.units.find((item) => item.id === unitId);
    return unit ? { selectedLessons: unit.lessons, scopeId: unit.id, lessonId: '', title: `Kiểm tra chủ điểm: ${unit.title}` } : null;
  }
  if (type === 'midterm') {
    const selectedLessons = allLessons.slice(0, Math.max(1, Math.ceil(allLessons.length / 2)));
    return { selectedLessons, scopeId: 'midterm', lessonId: '', title: 'Kiểm tra giữa kỳ' };
  }
  if (type === 'final') return { selectedLessons: allLessons, scopeId: 'final', lessonId: '', title: 'Kiểm tra cuối kỳ' };
  if (type === 'practice') return { selectedLessons: allLessons, scopeId: 'practice', lessonId: '', title: 'Đề luyện tập tổng hợp' };
  return null;
}
async function buildAssessment(context, type, unitId, lessonId, userId) {
  const { course } = context;
  const scope = selectAssessmentLessons(context, type, unitId, lessonId);
  if (!scope) return null;
  const lessonsById = new Map(scope.selectedLessons.map((lesson) => [lesson.id, lesson]));
  const lessonIds = [...lessonsById.keys()];
  let pool = [];
  // Only load records tagged with this exact curriculum, grade, subject and selected lesson scope.
  try {
    pool = await QuestionBankItem.find({ grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, lessonId: { $in: lessonIds }, purpose: 'assessment', active: true }).lean();
  } catch (error) {
    // A missing/not-yet-connected bank falls back to the same deterministic, lesson-scoped source.
    if (process.env.NODE_ENV === 'development') console.warn('Question bank database fallback:', error.message);
  }
  if (!pool.length) {
    pool = scope.selectedLessons.flatMap((lesson) => questionBank.buildQuestionPool({ programCode: context.programCode, grade: context.grade, subjectCode: context.subjectCode, lesson }).filter((item) => item.purpose === 'assessment'));
  }
  const questionScope = { grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, lessonsById };
  pool = filterQuestionPool(pool, questionScope);
  // If an older/partial DB seed has stale topic tags, regenerate only from the exact selected lessons.
  if (!pool.length) {
    pool = scope.selectedLessons.flatMap((lesson) => questionBank.buildQuestionPool({ programCode: context.programCode, grade: context.grade, subjectCode: context.subjectCode, lesson }).filter((item) => item.purpose === 'assessment'));
    pool = filterQuestionPool(pool, questionScope);
  }
  pool = pool.map((question) => {
    const { _id, __v, createdAt, updatedAt, ...cleanQuestion } = question;
    const sourceLesson = lessonsById.get(cleanQuestion.lessonId);
    return { ...cleanQuestion, id: cleanQuestion.questionId || cleanQuestion.id, questionId: cleanQuestion.questionId || cleanQuestion.id, lessonTitle: sourceLesson?.title || cleanQuestion.topicTitle || '', sourceLessonId: cleanQuestion.lessonId, topicTitle: cleanQuestion.topicTitle || sourceLesson?.title || '' };
  });
  if (!pool.length) return null;
  let excludedIds = [];
  if (userId) {
    // Share question history across lesson/chapter/midterm/final/practice for this course.
    // This prevents the same bank item appearing again under another assessment type.
    const [attempted, issued] = await Promise.all([
      AssessmentAttempt.distinct('questionIds', { user: userId, grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, courseId: context.course.id }),
      AssessmentSession.distinct('questionIds', { user: userId, grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, courseId: context.course.id })
    ]);
    excludedIds = [...new Set([...attempted, ...issued].filter(Boolean))];
  }
  const questions = selectQuestionPaper(pool, type, excludedIds);
  if (!questions.length) return null;
  return { type, scopeId: scope.scopeId, lessonId: scope.lessonId, title: scope.title, questions, selectedLessons: scope.selectedLessons, topicTitle: type === 'lesson' ? scope.selectedLessons[0]?.title : scope.title };
}
function assessmentFromSession(session, course) {
  const allLessons = courseLessonList(course);
  let selectedLessons = [];
  if (session.type === 'lesson') selectedLessons = allLessons.filter((item) => item.id === session.lessonId);
  else if (session.type === 'chapter') selectedLessons = (course.units.find((unit) => unit.id === session.scopeId)?.lessons || []);
  else if (session.type === 'midterm') selectedLessons = allLessons.slice(0, Math.max(1, Math.ceil(allLessons.length / 2)));
  else selectedLessons = allLessons;
  return { type: session.type, scopeId: session.scopeId, lessonId: session.lessonId, title: session.title, questions: session.questionsSnapshot || [], selectedLessons, topicTitle: session.title };
}

function assessmentPrerequisite(context, assessment, progress) {
  if (assessment.type === 'lesson') {
    const lesson = assessment.selectedLessons[0];
    if (!isLessonUnlocked(context.course, lesson, progress)) return { allowed: false, message: 'Bài học này đang khóa. Em cần đạt điểm yêu cầu ở bài trước.' };
    if (!allPartsPassed(lesson, progress)) return { allowed: false, message: 'Em hãy học xong từng phần và đạt yêu cầu ở câu hỏi kiểm tra sau mỗi phần trước khi làm bài kiểm tra bài học.' };
  }
  if (assessment.type === 'chapter') {
    const incomplete = assessment.selectedLessons.find((lesson) => !lessonPassed(progress, lesson.id));
    if (incomplete) return { allowed: false, message: `Cần hoàn thành bài “${incomplete.title}” với điểm từ ${PASS_SCORE} trở lên trước khi kiểm tra chương.` };
  }
  if (assessment.type === 'midterm') {
    const incomplete = assessment.selectedLessons.find((lesson) => !lessonPassed(progress, lesson.id));
    if (incomplete) return { allowed: false, message: `Cần hoàn thành các bài trước giữa kỳ. Bài còn thiếu: “${incomplete.title}”.` };
  }
  if (assessment.type === 'final') {
    const incomplete = assessment.selectedLessons.find((lesson) => !lessonPassed(progress, lesson.id));
    if (incomplete) return { allowed: false, message: `Cần hoàn thành toàn bộ bài học trong môn trước khi kiểm tra cuối kỳ. Bài còn thiếu: “${incomplete.title}”.` };
  }
  return { allowed: true };
}
async function loadProgress(userId, courseId) {
  const found = await LearningProgress.findOne({ user: userId, courseId });
  return found || { completedParts: [], lessons: [] };
}
async function getOrCreateCheckpointSession({ userId, found, part }) {
  const existing = await PartCheckpointSession.findOne({ user: userId, lessonId: found.lesson.id, partId: part.id, status: 'in_progress' }).sort({ createdAt: -1 });
  if (existing) return existing;
  let pool = [];
  try {
    pool = await QuestionBankItem.find({ grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode, lessonId: found.lesson.id, partId: part.id, purpose: 'checkpoint', active: true }).lean();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.warn('Checkpoint bank fallback:', error.message);
  }
  if (!pool.length) pool = questionBank.buildQuestionPool({ programCode: found.course.programCode, grade: found.course.grade, subjectCode: found.course.subjectCode, lesson: found.lesson }).filter((item) => item.purpose === 'checkpoint' && item.partId === part.id);
  pool = pool.filter((item) => Number(item.grade) === found.course.grade && item.programCode === found.course.programCode && item.subjectCode === found.course.subjectCode && item.lessonId === found.lesson.id && item.partId === part.id && item.topicTag === (found.lesson.topicTag || found.lesson.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()));
  if (!pool.length) pool = part.checkpoint.map((question) => ({ ...question, purpose: 'checkpoint', partId: part.id, grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode, lessonId: found.lesson.id, topicTag: found.lesson.topicTag || found.lesson.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase() }));
  const previousIds = new Set(await PartCheckpointSession.distinct('questionIds', { user: userId, lessonId: found.lesson.id, partId: part.id, status: { $in: ['passed', 'failed', 'abandoned'] } }));
  const freshPool = pool.filter((item) => !previousIds.has(item.questionId || item.id));
  const source = freshPool.length ? freshPool : pool;
  const selected = questionBank.pickRandom(source, Math.min(2, source.length));
  if (!selected.length) throw new Error(`Chưa có câu hỏi checkpoint cho phần ${part.title}. Hãy nạp ngân hàng câu hỏi.`);
  const sessionId = crypto.randomUUID();
  return PartCheckpointSession.create({ sessionId, user: userId, grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode, courseId: found.course.id, lessonId: found.lesson.id, partId: part.id, questionIds: selected.map((item) => item.questionId || item.id), questionsSnapshot: selected, status: 'in_progress' });
}

async function savePartResult(userId, context, lesson, part, score) {
  let progress = await LearningProgress.findOne({ user: userId, courseId: context.course.id });
  if (!progress) progress = new LearningProgress({ user: userId, courseId: context.course.id, grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, completedParts: [], lessons: [] });
  const record = progress.completedParts.find((item) => item.lessonId === lesson.id && item.partId === part.id);
  if (record) {
    record.bestScore = Math.max(record.bestScore || 0, score);
    record.passed = Boolean(record.passed || score >= CHECKPOINT_PASS_SCORE);
    record.attempts += 1;
    if (record.passed && !record.completedAt) record.completedAt = new Date();
  } else {
    progress.completedParts.push({ lessonId: lesson.id, partId: part.id, bestScore: score, passed: score >= CHECKPOINT_PASS_SCORE, attempts: 1, completedAt: score >= CHECKPOINT_PASS_SCORE ? new Date() : null });
  }
  progress.lastLessonId = lesson.id;
  progress.lastActivityAt = new Date();
  await progress.save();
  return progress;
}
async function saveLessonResult(userId, context, lesson, score) {
  let progress = await LearningProgress.findOne({ user: userId, courseId: context.course.id });
  if (!progress) progress = new LearningProgress({ user: userId, courseId: context.course.id, grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, completedParts: [], lessons: [] });
  const record = progress.lessons.find((item) => item.lessonId === lesson.id);
  if (record) {
    record.bestScore = Math.max(record.bestScore || 0, score);
    record.lastScore = score;
    record.passed = Boolean(record.passed || score >= PASS_SCORE);
    record.attempts += 1;
    record.lastAttemptAt = new Date();
    if (record.passed && !record.completedAt) record.completedAt = new Date();
  } else {
    progress.lessons.push({ lessonId: lesson.id, bestScore: score, lastScore: score, passed: score >= PASS_SCORE, attempts: 1, completedAt: score >= PASS_SCORE ? new Date() : null, lastAttemptAt: new Date() });
  }
  progress.lastLessonId = lesson.id;
  progress.lastActivityAt = new Date();
  await progress.save();
  return progress;
}
function parseRequestCourse(bodyOrQuery) {
  const grade = curriculum.normalizeGrade(bodyOrQuery.grade);
  const programCode = String(bodyOrQuery.programCode || bodyOrQuery.program || 'ctst');
  const subjectCode = String(bodyOrQuery.subjectCode || bodyOrQuery.subject || 'math');
  if (!grade || !curriculum.normalizeProgram(programCode)) return null;
  const course = curriculum.buildCourse(grade, programCode, subjectCode);
  return course ? { grade, programCode, subjectCode, course } : null;
}

router.get('/meta', (_req, res) => res.json({ programs: curriculum.PROGRAMS.map(({ code, name, shortName, approach }) => ({ code, name, shortName, approach })), grades: Array.from({ length: 12 }, (_, index) => index + 1), passScore: PASS_SCORE, checkpointPassScore: CHECKPOINT_PASS_SCORE, contentNotice: 'Nội dung khởi tạo là bản nháp được biên soạn mới theo các mạch năng lực của Chương trình GDPT 2018; cần giáo viên đối chiếu yêu cầu cần đạt và sách giáo khoa hiện hành trước khi xem là nội dung chuẩn đã duyệt.', ai: { mode: process.env.AI_MODE || 'SMART', onlineAvailable: aiConfigured(), essayGrading: 'Gemini nếu cấu hình; nếu không sẽ dùng điểm sơ bộ quy tắc và ghi rõ phương pháp.' } }));

router.get('/catalog', async (req, res, next) => {
  try {
    const grade = curriculum.normalizeGrade(req.query.grade || String(req.session.user.grade || '').match(/(1[0-2]|[1-9])/)?.[0] || 1) || 1;
    const programCode = String(req.query.programCode || req.query.program || 'ctst');
    const catalog = curriculum.buildCatalog(grade, programCode);
    if (!catalog) return res.status(400).json({ error: 'Lớp hoặc chương trình sách chưa hợp lệ.' });
    const progressDocs = await LearningProgress.find({ user: req.session.user.id, grade, programCode }).lean();
    const bySubject = new Map(progressDocs.map((doc) => [doc.subjectCode, doc]));
    const overrides = await ContentEntry.find({ grade, programCode, status: 'published', contentType: { $in: ['course', 'lesson'] } }).lean();
    const courseOverrides = new Map(overrides.filter((item) => item.contentType === 'course').map((item) => [item.courseId || `${item.programCode}-g${item.grade}-${item.subjectCode}`, item]));
    const lessonOverrides = new Map(overrides.filter((item) => item.contentType === 'lesson' && item.lessonId).map((item) => [item.lessonId, item]));
    const editedCatalog = catalog.courses.map((course) => {
      const courseOverride = courseOverrides.get(course.id);
      if (courseOverride) course.displayName = courseOverride.title;
      course.units = course.units.map((unit) => ({ ...unit, lessons: unit.lessons.map((lesson) => { const override = lessonOverrides.get(lesson.id); return override ? { ...lesson, title: override.title || lesson.title } : lesson; }) }));
      return course;
    });
    const courses = editedCatalog.map((course) => sanitizeCourse(course, bySubject.get(course.subjectCode) || emptyProgress()));
    res.json({ grade, educationLevel: grade <= 5 ? 'primary' : grade <= 9 ? 'lower-secondary' : 'high-school', program: catalog.program, curriculumFramework: catalog.curriculumFramework, totals: catalog.totals, passScore: PASS_SCORE, courses, contentStatus: 'draft-review-required' });
  } catch (error) { next(error); }
});

router.get('/lesson/:lessonId', async (req, res, next) => {
  try {
    const parsed = parseLessonId(req.params.lessonId);
    if (!parsed) return res.status(400).json({ error: 'Mã bài học không hợp lệ.' });
    let found = curriculum.findLesson(parsed);
    if (!found) return res.status(404).json({ error: 'Không tìm thấy bài học trong chương trình đã chọn.' });
    const contentOverride = await ContentEntry.findOne({ contentType: 'lesson', grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode, lessonId: found.lesson.id, status: 'published' }).sort({ updatedAt: -1 }).lean();
    const videoConfig = getVideoLink({ programCode: found.course.programCode, grade: found.course.grade, subjectCode: found.course.subjectCode, lessonId: found.lesson.id });
    const videoUrl = contentOverride?.videoUrl || videoConfig.videoUrl || '';
    const videoStatus = contentOverride?.videoUrl ? (contentOverride.videoUrl.includes('example.com') ? 'placeholder' : 'ready') : videoConfig.status;
    if (contentOverride) {
      const lesson = { ...found.lesson, title: contentOverride.title || found.lesson.title, objective: contentOverride.objective || found.lesson.objective, parts: found.lesson.parts.map((part) => ({ ...part, content: part.id === 'theory' ? (contentOverride.theory || contentOverride.body || part.content) : part.id === 'lecture' ? (contentOverride.lecture || part.content) : part.id.includes('practice') ? (contentOverride.practice || part.content) : part.content })) };
      found = { ...found, lesson };
    }
    found = { ...found, lesson: { ...found.lesson, video: { videoUrl, videoTitle: contentOverride?.videoTitle || videoConfig.videoTitle || 'Video bài học', status: videoStatus, notes: videoConfig.notes || '' } } };
    const progress = await loadProgress(req.session.user.id, found.course.id);
    const unlocked = isLessonUnlocked(found.course, found.lesson, progress);
    if (!unlocked) {
      const previous = findPreviousLesson(found.course, found.lesson);
      return res.status(423).json({ error: `Bài đang khóa. Hãy đạt ít nhất ${PASS_SCORE} điểm ở bài trước.`, locked: true, requiredScore: PASS_SCORE, previousLessonId: previous?.id || '' });
    }
    const partStates = found.lesson.parts.map((part) => ({ id: part.id, passed: Boolean(getPartProgress(progress, found.lesson.id, part.id)?.passed), bestScore: Number(getPartProgress(progress, found.lesson.id, part.id)?.bestScore || 0), viewed: wasPartViewed(progress, found.lesson.id, part.id), views: Number((progress.viewedParts || []).find((item) => item.lessonId === found.lesson.id && item.partId === part.id)?.views || 0) }));
    let priorPassed = true;
    const lessonWithCheckpoints = { ...found.lesson, parts: [] };
    for (let index = 0; index < found.lesson.parts.length; index += 1) {
      const part = found.lesson.parts[index];
      const passed = Boolean(getPartProgress(progress, found.lesson.id, part.id)?.passed);
      if (!passed && priorPassed) {
        const checkpointSession = await getOrCreateCheckpointSession({ userId: req.session.user.id, found, part });
        lessonWithCheckpoints.parts.push({ ...part, checkpointSessionId: checkpointSession.sessionId, checkpointDraft: checkpointSession.draftAnswers || [], checkpoint: checkpointSession.questionsSnapshot.map(curriculum.publicQuestion) });
      } else {
        lessonWithCheckpoints.parts.push({ ...part, checkpointSessionId: '', checkpoint: passed ? [] : [] });
      }
      priorPassed = priorPassed && passed;
    }
    found = { ...found, lesson: lessonWithCheckpoints };
    const lessonRecord = getLessonProgress(progress, found.lesson.id);
    recordActivity(req, { action: 'learning.lesson.open', targetType: 'lesson', targetId: found.lesson.id, targetName: found.lesson.title, description: 'Người học mở bài học.', metadata: { grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode } });
    res.json({ course: { id: found.course.id, grade: found.course.grade, programCode: found.course.programCode, programName: found.course.programName, subjectCode: found.course.subjectCode, subjectName: found.course.subjectName }, unit: { id: found.unit.id, title: found.unit.title }, lesson: { ...curriculum.publicLesson(found.lesson), video: found.lesson.video || { videoUrl: '', videoTitle: 'Video bài học', status: 'not-configured' } }, progress: { parts: partStates, lessonPassed: Boolean(lessonRecord?.passed), bestScore: Number(lessonRecord?.bestScore || 0), attempts: Number(lessonRecord?.attempts || 0), allPartsPassed: allPartsPassed(found.lesson, progress), passScore: PASS_SCORE, checkpointPassScore: CHECKPOINT_PASS_SCORE, currentPartId: chooseResumePart(found.lesson.parts, partStates, lastViewedPart(progress, found.lesson.id)) }, ai: { onlineAvailable: aiConfigured(), mode: process.env.AI_MODE || 'SMART' } });
  } catch (error) { next(error); }
});

router.post('/progress/position', async (req, res, next) => {
  try {
    const lessonId = String(req.body.lessonId || '');
    const partId = String(req.body.partId || '');
    const parsed = parseLessonId(lessonId);
    if (!parsed) return res.status(400).json({ error: 'Mã bài học không hợp lệ.' });
    const found = curriculum.findLesson(parsed);
    if (!found) return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    const partIndex = found.lesson.parts.findIndex((item) => item.id === partId);
    if (partIndex < 0) return res.status(400).json({ error: 'Phần học không hợp lệ.' });
    const progress = await loadProgress(req.session.user.id, found.course.id);
    if (!isLessonUnlocked(found.course, found.lesson, progress)) return res.status(423).json({ error: 'Bài học đang khóa.' });
    for (let index = 0; index < partIndex; index += 1) {
      if (!getPartProgress(progress, found.lesson.id, found.lesson.parts[index].id)?.passed) return res.status(423).json({ error: 'Hãy đạt checkpoint phần trước để mở phần này.' });
    }
    let saved = await LearningProgress.findOne({ user: req.session.user.id, courseId: found.course.id });
    if (!saved) saved = new LearningProgress({ user: req.session.user.id, courseId: found.course.id, grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode, completedParts: [], viewedParts: [], lessons: [] });
    recordPartPosition(saved, found.lesson.id, partId);
    await saved.save();
    res.json({ saved: true, lessonId: found.lesson.id, partId, viewed: true, currentPartId: saved.currentPartId, views: Number(saved.viewedParts.find((item) => item.lessonId === found.lesson.id && item.partId === partId)?.views || 1), viewedPartCount: saved.viewedParts.filter((item) => item.lessonId === found.lesson.id).length });
  } catch (error) { next(error); }
});

router.post('/parts/:lessonId/:partId/checkpoint/draft', async (req, res, next) => {
  try {
    const parsed = parseLessonId(req.params.lessonId);
    if (!parsed) return res.status(400).json({ error: 'Mã bài học không hợp lệ.' });
    const found = curriculum.findLesson(parsed);
    if (!found) return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    const part = found.lesson.parts.find((item) => item.id === req.params.partId);
    if (!part) return res.status(404).json({ error: 'Không tìm thấy phần học.' });
    const sessionId = String(req.body.checkpointSessionId || '').trim();
    const session = await PartCheckpointSession.findOne({ sessionId, user: req.session.user.id, lessonId: found.lesson.id, partId: part.id, status: 'in_progress' });
    if (!session) return res.status(409).json({ error: 'Phiên checkpoint đã thay đổi. Hãy tải lại bài học.' });
    const allowedIds = new Set((session.questionsSnapshot || []).map((question) => String(question.id || question.questionId)));
    const incoming = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 4) : [];
    const draft = [];
    const seen = new Set();
    for (const item of incoming) {
      const questionId = String(item?.questionId || '');
      if (!allowedIds.has(questionId) || seen.has(questionId) || typeof item.answer !== 'string' || item.answer.length > 5000) continue;
      seen.add(questionId);
      draft.push({ questionId, answer: item.answer });
    }
    session.draftAnswers = draft;
    await session.save();
    res.json({ saved: true, sessionId, savedCount: draft.length, savedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/parts/:lessonId/:partId/checkpoint', async (req, res, next) => {
  try {
    const parsed = parseLessonId(req.params.lessonId);
    if (!parsed) return res.status(400).json({ error: 'Mã bài học không hợp lệ.' });
    const found = curriculum.findLesson(parsed);
    if (!found) return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    const progress = await loadProgress(req.session.user.id, found.course.id);
    if (!isLessonUnlocked(found.course, found.lesson, progress)) return res.status(423).json({ error: 'Bài học đang khóa vì bài trước chưa đạt điểm yêu cầu.' });
    const partIndex = found.lesson.parts.findIndex((item) => item.id === req.params.partId);
    if (partIndex < 0) return res.status(404).json({ error: 'Không tìm thấy phần học.' });
    for (let i = 0; i < partIndex; i += 1) {
      if (!getPartProgress(progress, found.lesson.id, found.lesson.parts[i].id)?.passed) return res.status(423).json({ error: `Hãy đạt yêu cầu ở phần “${found.lesson.parts[i].title}” trước.` });
    }
    const sessionId = String(req.body.checkpointSessionId || '').trim();
    const checkpointSession = await PartCheckpointSession.findOne({ sessionId, user: req.session.user.id, lessonId: found.lesson.id, partId: found.lesson.parts[partIndex].id, status: 'in_progress' });
    if (!checkpointSession) return res.status(409).json({ error: 'Bộ câu hỏi này đã hết hiệu lực. Hãy tải lại bài học để lấy bộ câu hỏi mới.' });
    const checkpointQuestions = checkpointSession.questionsSnapshot || [];
    const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 4) : [];
    const allowedIds = new Set(checkpointQuestions.map((q) => String(q.id || q.questionId)));
    if (answers.length !== allowedIds.size || new Set(answers.map((item) => item?.questionId)).size !== allowedIds.size || answers.some((item) => !item || !allowedIds.has(item.questionId) || typeof item.answer !== 'string' || item.answer.length > 5000)) return res.status(400).json({ error: 'Hãy trả lời đủ các câu hỏi trong bộ checkpoint hiện tại.' });
    const normalizedQuestions = checkpointQuestions.map((question) => ({ ...question, id: question.id || question.questionId }));
    const result = calculateObjectiveScore(normalizedQuestions, answers);
    const score = Math.round(result.earned / Math.max(1, result.possible) * 100);
    checkpointSession.draftAnswers = answers.map((item) => ({ questionId: item.questionId, answer: tidyAnswer(item.answer) }));
    checkpointSession.score = score;
    checkpointSession.status = score >= CHECKPOINT_PASS_SCORE ? 'passed' : 'failed';
    checkpointSession.submittedAt = new Date();
    await checkpointSession.save();
    const updated = await savePartResult(req.session.user.id, { grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode, course: found.course }, found.lesson, found.lesson.parts[partIndex], score);
    const saved = getPartProgress(updated, found.lesson.id, found.lesson.parts[partIndex].id);
    await AssessmentAttempt.create({ user: req.session.user.id, grade: found.course.grade, programCode: found.course.programCode, subjectCode: found.course.subjectCode, courseId: found.course.id, type: 'part-checkpoint', scopeId: found.lesson.parts[partIndex].id, lessonId: found.lesson.id, score, passed: Boolean(saved.passed), gradingMode: 'objective', answerFeedback: result.feedback.map(({ correctAnswer, ...item }) => item) });
    res.json({ message: saved.passed ? 'Tốt lắm! Em đã vượt qua phần kiểm tra.' : `Em được ${score} điểm. Hãy xem lại phần học và thử lại nhé.`, score, passed: Boolean(saved.passed), requiredScore: CHECKPOINT_PASS_SCORE, feedback: result.feedback.map((item) => ({ questionId: item.questionId, correct: item.correct, correctAnswer: item.correctAnswer, explanation: item.explanation })), checkpointSessionId: sessionId, completedParts: updated.completedParts.filter((item) => item.lessonId === found.lesson.id && item.passed).length, totalParts: found.lesson.parts.length, canContinue: Boolean(saved.passed) });
  } catch (error) { next(error); }
});

router.get('/assessments', async (req, res, next) => {
  try {
    let context;
    let assessment;
    let session;
    const requestedExamId = String(req.query.examId || '').trim();
    if (requestedExamId) {
      session = await AssessmentSession.findOne({ examId: requestedExamId, user: req.session.user.id }).lean();
      if (!session) return res.status(404).json({ error: 'Không tìm thấy lần làm bài này.' });
      context = parseRequestCourse({ grade: session.grade, programCode: session.programCode, subjectCode: session.subjectCode });
      if (!context || context.course.id !== session.courseId) return res.status(409).json({ error: 'Dữ liệu đề kiểm tra không còn khớp chương trình hiện tại.' });
      assessment = assessmentFromSession(session, context.course);
      if (session.status === 'submitted') {
        const attempt = await AssessmentAttempt.findOne({ user: req.session.user.id, sessionId: session.examId }).sort({ createdAt: -1 }).lean();
        if (!attempt) return res.status(409).json({ error: 'Không tìm thấy kết quả đã lưu của đề này.' });
        return res.json({ assessment: { examId: session.examId, type: assessment.type, scopeId: assessment.scopeId, lessonId: assessment.lessonId, title: assessment.title, topicTitle: assessment.topicTitle || assessment.title, grade: context.grade, programCode: context.programCode, programName: context.course.programName, subjectCode: context.subjectCode, subjectName: context.course.subjectName, passScore: PASS_SCORE, questionCount: assessment.questions.length, questions: assessment.questions.map(curriculum.publicQuestion) }, result: { message: attempt.passed ? 'Bạn đã đạt yêu cầu ở lần làm bài đã lưu.' : 'Kết quả lần làm bài đã lưu. Bạn có thể xem nhận xét hoặc tạo đề mới để luyện tập.', score: attempt.score, passed: attempt.passed, passScore: PASS_SCORE, gradingMode: attempt.gradingMode, feedback: attempt.answerFeedback || [], progress: null } });
      }
      if (session.status !== 'in_progress') return res.status(409).json({ error: 'Phiên làm bài đã hết hiệu lực. Hãy tạo đề mới.' });
    } else {
      context = parseRequestCourse(req.query);
      if (!context) return res.status(400).json({ error: 'Vui lòng chọn lớp, bộ sách và môn học hợp lệ.' });
      const type = String(req.query.type || 'lesson');
      const lessonId = String(req.query.lessonId || '');
      const unitId = String(req.query.unitId || '');
      assessment = await buildAssessment(context, type, unitId, lessonId, req.session.user.id);
      if (!assessment) return res.status(404).json({ error: 'Chưa có đủ câu hỏi phù hợp với chủ đề này.' });
    }
    const progress = await loadProgress(req.session.user.id, context.course.id);
    const prerequisite = assessmentPrerequisite(context, assessment, progress);
    if (!prerequisite.allowed) return res.status(423).json({ error: prerequisite.message, locked: true, requiredScore: PASS_SCORE });
    if (!session) {
      const examId = crypto.randomUUID();
      session = await AssessmentSession.create({ examId, user: req.session.user.id, grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, courseId: context.course.id, type: assessment.type, scopeId: assessment.scopeId, lessonId: assessment.lessonId, title: assessment.title, questionIds: assessment.questions.map((question) => question.questionId || question.id), questionsSnapshot: assessment.questions, status: 'in_progress', passScore: PASS_SCORE });
    }
    res.json({ assessment: { examId: session.examId, type: assessment.type, scopeId: assessment.scopeId, lessonId: assessment.lessonId, title: assessment.title, topicTitle: assessment.topicTitle || assessment.title, grade: context.grade, programCode: context.programCode, programName: context.course.programName, subjectCode: context.subjectCode, subjectName: context.course.subjectName, passScore: PASS_SCORE, questionCount: assessment.questions.length, selectionPolicy: 'random-subset-same-scope-bank', questions: assessment.questions.map(curriculum.publicQuestion) }, savedAnswers: session.draftAnswers || [] });
  } catch (error) { next(error); }
});

router.post('/assessments/draft', async (req, res, next) => {
  try {
    const examId = String(req.body.examId || '').trim();
    if (!examId) return res.status(400).json({ error: 'Thiếu mã phiên kiểm tra.' });
    const session = await AssessmentSession.findOne({ examId, user: req.session.user.id, status: 'in_progress' });
    if (!session) return res.status(409).json({ error: 'Phiên kiểm tra không còn mở. Hãy tải lại để xem trạng thái mới nhất.' });
    const allowedIds = new Set((session.questionsSnapshot || []).map((question) => String(question.id || question.questionId)));
    const incoming = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 30) : [];
    const seen = new Set();
    const draftAnswers = [];
    for (const item of incoming) {
      const questionId = String(item?.questionId || '');
      if (!allowedIds.has(questionId) || seen.has(questionId) || typeof item?.answer !== 'string' || item.answer.length > 5000) continue;
      seen.add(questionId);
      draftAnswers.push({ questionId, answer: item.answer });
    }
    session.draftAnswers = draftAnswers;
    await session.save();
    res.json({ saved: true, examId: session.examId, savedCount: draftAnswers.length, savedAt: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/assessments/submit', AI_LIMIT, async (req, res, next) => {
  try {
    const examId = String(req.body.examId || '').trim();
    if (!examId) return res.status(400).json({ error: 'Thiếu mã phiên làm bài. Hãy mở đề kiểm tra lại từ trang học tập.' });
    const session = await AssessmentSession.findOne({ examId, user: req.session.user.id, status: 'in_progress' });
    if (!session) return res.status(409).json({ error: 'Phiên làm bài không tồn tại, đã hết hạn hoặc đã được nộp. Hãy tạo đề mới.' });
    const context = parseRequestCourse({ grade: session.grade, programCode: session.programCode, subjectCode: session.subjectCode });
    if (!context || context.course.id !== session.courseId) return res.status(409).json({ error: 'Không khớp lớp, chương trình hoặc môn học của đề đã tạo.' });
    const assessment = assessmentFromSession(session, context.course);
    const suppliedGrade = req.body.grade == null ? session.grade : Number(req.body.grade);
    if (suppliedGrade !== session.grade || (req.body.programCode && req.body.programCode !== session.programCode) || (req.body.subjectCode && req.body.subjectCode !== session.subjectCode) || (req.body.type && req.body.type !== session.type)) return res.status(400).json({ error: 'Thông tin bài nộp không khớp đề kiểm tra đã tạo.' });
    const progress = await loadProgress(req.session.user.id, context.course.id);
    const prerequisite = assessmentPrerequisite(context, assessment, progress);
    if (!prerequisite.allowed) return res.status(423).json({ error: prerequisite.message, locked: true });
    const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 30) : [];
    const allowedIds = new Set(assessment.questions.map((question) => question.id));
    const receivedIds = new Set(answers.map((item) => item?.questionId));
    if (answers.length !== assessment.questions.length || receivedIds.size !== assessment.questions.length || answers.some((item) => !item || !allowedIds.has(item.questionId) || typeof item.answer !== 'string' || item.answer.length > 5000)) return res.status(400).json({ error: 'Hãy nộp đủ đáp án cho đúng các câu hỏi trong đề đã cấp.' });
    const byId = new Map(answers.map((item) => [item.questionId, tidyAnswer(item.answer)]));
    let possiblePoints = 0;
    let earnedPoints = 0;
    const feedback = [];
    const aiModes = new Set();
    for (const question of assessment.questions) {
      const points = Number(question.points || 0);
      possiblePoints += points;
      if (OBJECTIVE_QUESTION_TYPES.has(question.type)) {
        const answer = byId.get(question.id) || '';
        const correct = isAnswerCorrect(question, answer);
        if (correct) earnedPoints += points;
        feedback.push({ questionId: question.id, type: question.type, correct, earnedPoints: correct ? points : 0, points, correctAnswer: question.correctAnswer, explanation: question.explanation || '' });
        continue;
      }
      const answer = byId.get(question.id) || '';
      const foundLesson = question.sourceLessonId ? curriculum.findLesson({ grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, lessonId: question.sourceLessonId }) : assessment.selectedLessons.find((item) => item.id === question.lessonId) ? { lesson: assessment.selectedLessons.find((item) => item.id === question.lessonId) } : null;
      const lesson = foundLesson?.lesson || { title: question.lessonTitle || assessment.title, subjectName: context.course.subjectName, subjectCode: context.subjectCode, objective: 'Thể hiện hiểu biết đúng và rõ ràng về nội dung môn học.', parts: [] };
      const graded = await gradeWrittenAnswer({ answer, question, lesson, grade: context.grade });
      aiModes.add(graded.gradingMode);
      const earned = points * graded.score / 100;
      earnedPoints += earned;
      feedback.push({ questionId: question.id, type: question.type, score: graded.score, earnedPoints: Math.round(earned * 10) / 10, points, feedback: graded.feedback, strengths: graded.strengths, improvements: graded.improvements, sampleAnswer: graded.sampleAnswer, uncertain: graded.uncertain, gradingMode: graded.gradingMode });
    }
    const score = Math.round(Math.max(0, Math.min(100, earnedPoints / Math.max(1, possiblePoints) * 100)));
    const passed = score >= PASS_SCORE;
    const gradingMode = aiModes.size === 0 ? 'objective' : aiModes.size > 1 ? 'mixed' : [...aiModes][0];
    let nextUnlocked = '';
    if (session.type === 'lesson') {
      const found = curriculum.findLesson({ grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, lessonId: session.lessonId });
      if (found) {
        const updated = await saveLessonResult(req.session.user.id, context, found.lesson, score);
        const next = courseLessonList(context.course).find((item) => item.sequence === found.lesson.sequence + 1);
        if (next && lessonPassed(updated, found.lesson.id)) nextUnlocked = next.id;
      }
    }
    session.draftAnswers = answers.map((item) => ({ questionId: item.questionId, answer: tidyAnswer(item.answer) }));
    session.status = 'submitted';
    session.submittedAt = new Date();
    await session.save();
    await AssessmentAttempt.create({ user: req.session.user.id, grade: context.grade, programCode: context.programCode, subjectCode: context.subjectCode, courseId: context.course.id, type: session.type, scopeId: session.scopeId, lessonId: session.lessonId, sessionId: session.examId, questionIds: assessment.questions.map((question) => question.questionId || question.id), questionsSnapshot: assessment.questions, submittedAnswers: answers.map((item) => ({ questionId: item.questionId, answer: tidyAnswer(item.answer) })), score, passed, gradingMode, answerFeedback: feedback, elapsedSeconds: Math.max(0, Math.min(86400, Number(req.body.elapsedSeconds) || 0)) });
    const savedProgress = await loadProgress(req.session.user.id, context.course.id);
    const progressSummary = { completedLessons: (savedProgress.lessons || []).filter((item) => item.passed).length, totalLessons: context.course.lessonCount, nextUnlockedLessonId: nextUnlocked, nextLessonUnlocked: Boolean(nextUnlocked), passScore: PASS_SCORE };
    recordActivity(req, { action: 'learning.assessment.submit', targetType: 'assessment', targetId: session.examId, targetName: session.title, description: 'Nộp bài kiểm tra.', metadata: { grade: session.grade, subjectCode: session.subjectCode, type: session.type, score, passed } });
    res.json({ message: passed ? 'Chúc mừng! Em đã đạt điểm yêu cầu.' : `Em đạt ${score} điểm. Cần ít nhất ${PASS_SCORE} điểm để đạt yêu cầu. Hãy xem nhận xét, ôn lại bài và thử lại.`, examId: session.examId, score, passed, passScore: PASS_SCORE, gradingMode, feedback, progress: progressSummary });
  } catch (error) { next(error); }
});

router.post('/tutor', AI_LIMIT, async (req, res, next) => {
  try {
    const parsed = parseLessonId(String(req.body.lessonId || ''));
    if (!parsed) return res.status(400).json({ error: 'Bài học không hợp lệ.' });
    const found = curriculum.findLesson(parsed);
    if (!found) return res.status(404).json({ error: 'Không tìm thấy bài học.' });
    const progress = await loadProgress(req.session.user.id, found.course.id);
    if (!isLessonUnlocked(found.course, found.lesson, progress)) return res.status(423).json({ error: 'Hãy mở khóa bài học trước khi hỏi trợ giảng.' });
    const recent = await AssessmentAttempt.find({ user: req.session.user.id, courseId: found.course.id, lessonId: found.lesson.id }).sort({ createdAt: -1 }).limit(3).select('score type passed').lean();
    const summary = recent.length ? `Điểm gần đây: ${recent.map((item) => `${item.type} ${item.score}/100`).join(', ')}` : 'Chưa có điểm kiểm tra của bài này.';
    const result = await tutorReply({ message: req.body.message, lesson: found.lesson, grade: found.course.grade, progressSummary: summary });
    res.json({ ...result, lessonId: found.lesson.id });
  } catch (error) { next(error); }
});

router.post('/study-plan', AI_LIMIT, async (req, res, next) => {
  try {
    const grade = curriculum.normalizeGrade(req.body.grade);
    const program = curriculum.normalizeProgram(String(req.body.programCode || req.body.program || 'ctst'));
    if (!grade || !program) return res.status(400).json({ error: 'Vui lòng chọn lớp 1–12 và bộ sách hợp lệ.' });
    const catalog = curriculum.buildCatalog(grade, program.code);
    const progressDocs = await LearningProgress.find({ user: req.session.user.id, grade, programCode: program.code }).lean();
    const survey = await SurveyResponse.findOne({ user: req.session.user.id }).select('educationLevel goal topics weeklyHours learningStyle currentLevel').lean();
    const plan = await createPersonalizedStudyPlan({ survey, grade, programCode: program.code, programName: program.name, courseCatalog: catalog.courses, progressDocs });
    res.json({ plan, profileUsed: Boolean(survey), onlineAiAvailable: aiConfigured() });
  } catch (error) { next(error); }
});

router.get('/recommendations', async (req, res, next) => {
  try {
    const grade = curriculum.normalizeGrade(req.query.grade) || 1;
    const programCode = curriculum.normalizeProgram(String(req.query.programCode || req.query.program || 'ctst'))?.code || 'ctst';
    const progressDocs = await LearningProgress.find({ user: req.session.user.id, grade, programCode }).lean();
    const courseCatalog = curriculum.buildCatalog(grade, programCode)?.courses || [];
    const recommendation = recommendNextStep({ progressDocs, courseCatalog, grade, programCode });
    res.json({ recommendation, passScore: PASS_SCORE, aiMode: process.env.AI_MODE || 'SMART', onlineAiAvailable: aiConfigured() });
  } catch (error) { next(error); }
});

router.get('/history', async (req, res, next) => {
  try {
    const items = await AssessmentAttempt.find({ user: req.session.user.id }).sort({ createdAt: -1 }).limit(30).select('grade programCode subjectCode type scopeId lessonId score passed gradingMode createdAt').lean();
    res.json({ attempts: items });
  } catch (error) { next(error); }
});

module.exports = router;
