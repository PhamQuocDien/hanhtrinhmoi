'use strict';
const express = require('express');
const mongoose = require('mongoose');
const CareerEnrollment = require('../models/CareerEnrollment');
const CareerQuestionBankItem = require('../models/CareerQuestionBankItem');
const CareerAssessmentSession = require('../models/CareerAssessmentSession');
const crypto = require('node:crypto');
const { chooseBalancedQuestions, dedupeQuestionPrompts } = require('../services/career-assessment-generator');
const { MIN_FINAL_ASSESSMENT_QUESTIONS, getCourseFinalAssessmentEligibility, hasEnoughFinalAssessmentQuestions } = require('../services/career-assessment-policy');
const { requireLearner } = require('../middleware/security');
const { recordActivity } = require('../services/activity-log');
const catalog = require('../../../../content/career-paths/catalog');
const softwareCatalog = require('../../../../content/career-paths/software-development');
const { runCode } = require('../services/code-runner.service');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();

function publicEnrollment(enrollment, targetCourse) {
  const completed = new Set(enrollment?.completedLessonIds || []);
  const lessonIds = targetCourse.lessons.map((item) => item.id);
  const firstIncompleteIndex = lessonIds.findIndex((id) => !completed.has(id));
  return {
    enrolled: Boolean(enrollment),
    status: enrollment?.status || 'not_enrolled',
    completedLessonIds: [...completed],
    completedLessons: completed.size,
    lessonCount: lessonIds.length,
    percent: lessonIds.length ? Math.round(completed.size / lessonIds.length * 100) : 0,
    nextLessonId: firstIncompleteIndex >= 0 ? lessonIds[firstIncompleteIndex] : '',
    enrolledAt: enrollment?.enrolledAt || null,
    completedAt: enrollment?.completedAt || null
  };
}

router.get('/software-development', async (req, res, next) => {
  try {
    let enrollments = [];
    const userId = req.session?.user?.id;
    if (userId && mongoose.isValidObjectId(userId) && ['student', 'university_student'].includes(req.session.user.role)) {
      enrollments = await CareerEnrollment.find({ user: userId }).lean();
    }
    const byCourse = new Map(enrollments.map((item) => [item.courseId, item]));
    res.json({
      group: softwareCatalog.GROUP,
      pathways: softwareCatalog.PATHWAYS,
      courses: catalog.listCourses('1').map((item) => ({ ...item, progress: publicEnrollment(byCourse.get(item.id), catalog.getCourse(item.id)) })),
      contentNotice: 'Lộ trình là bản khởi tạo để học và thực hành; cần giảng viên rà soát theo đề cương học phần chính thức của cơ sở đào tạo.'
    });
  } catch (error) { next(error); }
});


router.get('/catalog', async (req, res, next) => {
  try {
    const userId = req.session?.user?.id;
    const canTrack = userId && mongoose.isValidObjectId(userId) && ['student', 'university_student'].includes(req.session.user.role);
    const enrollments = canTrack ? await CareerEnrollment.find({ user: userId }).lean() : [];
    const byCourse = new Map(enrollments.map((item) => [item.courseId, item]));
    const groups = catalog.listGroups().map((group) => ({ ...group, courseCount: catalog.listCourses(group.id).length }));
    const courses = catalog.listCourses().map((item) => ({ ...item, progress: publicEnrollment(byCourse.get(item.id), catalog.getCourse(item.id)) }));
    res.json({ version: 'V8.0.3', groups, courses, contentNotice: 'Lộ trình V8.0.3 bổ sung đầu ra, rubric, hướng dẫn học theo bước và bộ khung code theo chủ đề. Nội dung tự biên soạn cần được giảng viên rà soát theo đề cương của cơ sở đào tạo; chỉ bài code có sandbox exercise mới có nút chạy code.' });
  } catch (error) { next(error); }
});

router.get('/groups/:groupId', async (req, res, next) => {
  try {
    const group = catalog.normalizeGroupId(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Không tìm thấy nhóm ngành CNTT.' });
    const courses = catalog.listCourses(group.id);
    res.json({ group, courses, pathways: group.pathways || [] });
  } catch (error) { next(error); }
});

const codeRunLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Bạn đã chạy code quá nhiều lần. Hãy chờ một chút rồi thử lại.' } });
router.post('/code/run', codeRunLimiter, requireLearner, async (req, res, next) => {
  try {
    const courseId = String(req.body.courseId || '').trim();
    const lessonId = String(req.body.lessonId || '').trim();
    const language = String(req.body.language || '').toLowerCase();
    const course = catalog.getCourse(courseId);
    if (!course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });
    const lesson = course.lessons.find((item) => item.id === lessonId);
    if (!lesson || !lesson.codeExercise?.enabled) return res.status(400).json({ error: 'Bài này không có bài thực hành code chạy qua trình biên dịch.' });
    if (!(lesson.codeExercise.runnableLanguages || []).includes(language)) return res.status(400).json({ error: 'Ngôn ngữ này chỉ hỗ trợ xem trước trên trình duyệt hoặc không được bật cho bài học.' });
    const enrolled = await CareerEnrollment.exists({ user: req.session.user.id, courseId: course.id, status: { $in: ['in_progress', 'completed'] } });
    if (!enrolled) return res.status(403).json({ error: 'Hãy thêm khóa học vào lộ trình trước khi chạy code.' });
    const result = await runCode({ language, sourceCode: req.body.sourceCode, stdin: req.body.stdin || '' });
    await recordActivity(req, { action: 'career.code.run', targetType: 'career-lesson', targetId: lesson.id, targetName: lesson.title, description: 'Người học chạy code trong sandbox của bài thực hành.', metadata: { courseId: course.id, language, status: result.status, statusId: result.statusId, time: result.time } });
    res.json({ ...result, courseId: course.id, lessonId: lesson.id });
  } catch (error) {
    if (/trình chạy|ngôn ngữ|mã nguồn|dữ liệu đầu vào|CODE_RUNNER|fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT|AbortError/i.test(error.message || error.code || '')) return res.status(503).json({ error: 'Trình chạy code tạm thời không khả dụng hoặc đã hết thời gian chờ. Hãy thử lại sau.' });
    next(error);
  }
});

router.get(['/software-development/courses/:courseId', '/courses/:courseId'], async (req, res, next) => {
  try {
    const item = catalog.getCourse(req.params.courseId);
    if (!item) return res.status(404).json({ error: 'Không tìm thấy khóa học ngành Phát triển phần mềm.' });
    let enrollment = null;
    const userId = req.session?.user?.id;
    if (userId && mongoose.isValidObjectId(userId)) enrollment = await CareerEnrollment.findOne({ user: userId, courseId: item.id }).lean();
    res.json({ course: catalog.publicCourseDetail(item), progress: publicEnrollment(enrollment, item) });
  } catch (error) { next(error); }
});


function publicQuestion(question) {
  return { questionId: question.questionId, type: question.type, prompt: question.prompt, options: question.options || [], points: question.points || 1, difficulty: question.difficulty || 'medium' };
}
function normalizeAnswer(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
}
function isAutoGraded(question) { return ['multiple_choice', 'true_false', 'fill_blank'].includes(question.type); }
router.post(['/software-development/courses/:courseId/assessments', '/courses/:courseId/assessments'], requireLearner, async (req, res, next) => {
  try {
    const course = catalog.getCourse(req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });
    const scopeType = ['lesson', 'module', 'course', 'final', 'practice'].includes(req.body.scopeType) ? req.body.scopeType : 'practice';
    const lessonId = String(req.body.lessonId || '').trim();
    const moduleId = String(req.body.moduleId || '').trim();
    if (scopeType === 'lesson' && !course.lessons.some((item) => item.id === lessonId)) return res.status(400).json({ error: 'Bài học không thuộc khóa học đã chọn.' });
    if (scopeType === 'module' && !course.modules.some((item) => item.id === moduleId)) return res.status(400).json({ error: 'Chặng học không thuộc khóa học đã chọn.' });
    const enrollment = await CareerEnrollment.findOne({ user: req.session.user.id, courseId: course.id }).lean();
    if (!enrollment) return res.status(409).json({ error: 'Hãy thêm khóa học vào lộ trình trước khi tạo bài luyện tập.' });
    if (scopeType === 'final') {
      const eligibility = getCourseFinalAssessmentEligibility(course, enrollment);
      if (!eligibility.allowed) {
        if (eligibility.reason === 'lessons_incomplete') {
          const firstMissing = eligibility.incompleteLessons[0]?.title || 'bài học chưa hoàn thành';
          return res.status(409).json({ error: `Cần hoàn thành toàn bộ ${eligibility.lessonCount} bài học trước khi làm bài kiểm tra cuối khóa. Đã hoàn thành ${eligibility.completedLessons}/${eligibility.lessonCount}; bài còn thiếu đầu tiên: “${firstMissing}”.` });
        }
        return res.status(409).json({ error: 'Khóa học chưa có bài học để kiểm tra cuối khóa.' });
      }
    }
    const filter = { courseId: course.id, active: true };
    if (scopeType === 'lesson') filter.lessonId = lessonId;
    if (scopeType === 'module') filter.moduleId = moduleId;
    let bank = await CareerQuestionBankItem.find(filter).select('+correctAnswer +acceptedAnswers +explanation +rubric').lean();
    bank = dedupeQuestionPrompts(bank);
    if (!bank.length) {
      const message = scopeType === 'final'
        ? 'Chưa có câu hỏi cuối khóa nào được giáo viên duyệt/kích hoạt cho khóa học này. Hãy nhờ giáo viên hoặc quản trị viên duyệt ngân hàng câu hỏi.'
        : 'Ngân hàng câu hỏi của phạm vi này chưa có câu đã được giáo viên duyệt/kích hoạt. Hãy nhờ giáo viên hoặc quản trị viên duyệt ngân hàng.';
      return res.status(409).json({ error: message });
    }
    if (scopeType === 'final' && !hasEnoughFinalAssessmentQuestions(bank.length)) {
      return res.status(409).json({ error: `Bài kiểm tra cuối khóa cần tối thiểu ${MIN_FINAL_ASSESSMENT_QUESTIONS} câu đã được giáo viên duyệt. Hiện chỉ có ${bank.length} câu hợp lệ; hãy bổ sung và duyệt thêm câu hỏi.` });
    }
    const defaultCount = scopeType === 'lesson' ? 10 : scopeType === 'final' ? 30 : 15;
    const count = Math.min(30, Math.max(3, Number.parseInt(req.body.count, 10) || defaultCount), bank.length);
    const historyFilter = { user: req.session.user.id, courseId: course.id, status: { $in: ['submitted', 'needs_review'] } };
    if (scopeType === 'lesson') historyFilter.lessonId = lessonId;
    else if (scopeType === 'module') historyFilter.moduleId = moduleId;
    else historyFilter.scopeType = scopeType;
    const history = await CareerAssessmentSession.find(historyFilter).sort({ createdAt: -1 }).limit(12).select('questionIds').lean();
    const recentlySeen = new Set(history.flatMap((item) => item.questionIds || []));
    const blueprintPresets = {
      foundation: { difficultyWeights: { easy: 0.60, medium: 0.35, hard: 0.05 }, taxonomyWeights: { remember: 0.30, understand: 0.35, apply: 0.25, analyze: 0.08, create: 0.02 } },
      standard: { difficultyWeights: { easy: 0.25, medium: 0.50, hard: 0.25 }, taxonomyWeights: { remember: 0.15, understand: 0.25, apply: 0.30, analyze: 0.20, create: 0.10 } },
      challenge: { difficultyWeights: { easy: 0.10, medium: 0.35, hard: 0.55 }, taxonomyWeights: { remember: 0.05, understand: 0.15, apply: 0.30, analyze: 0.25, create: 0.25 } }
    };
    const blueprintPreset = ['foundation', 'standard', 'challenge'].includes(req.body.blueprintPreset) ? req.body.blueprintPreset : 'standard';
    const selection = chooseBalancedQuestions(bank, count, [...recentlySeen], blueprintPresets[blueprintPreset]);
    selection.questionMix = { ...selection.questionMix, preset: blueprintPreset, targets: selection.blueprintTargets };
    const chosen = selection.questions;
    if (!chosen.length) return res.status(409).json({ error: 'Không đủ câu hỏi đã được duyệt trong phạm vi bài học này.' });
    const examId = `cax-${crypto.randomBytes(16).toString('hex')}`;
    const title = scopeType === 'lesson' ? `Luyện tập: ${course.lessons.find((item) => item.id === lessonId).title}` : scopeType === 'module' ? `Ôn tập: ${course.modules.find((item) => item.id === moduleId).title}` : scopeType === 'final' ? `Kiểm tra cuối khóa: ${course.title}` : `${scopeType === 'course' ? 'Kiểm tra khóa học' : 'Luyện tập tổng hợp'}: ${course.title}`;
    const session = await CareerAssessmentSession.create({
      examId, user: req.session.user.id, courseId: course.id, moduleId: scopeType === 'module' ? moduleId : '', lessonId: scopeType === 'lesson' ? lessonId : '', scopeType,
      title, questionIds: chosen.map((item) => item.questionId), questionMix: selection.questionMix, questionsSnapshot: chosen.map((item) => ({ questionId: item.questionId, courseId: item.courseId, moduleId: item.moduleId, lessonId: item.lessonId, type: item.type, prompt: item.prompt, options: item.options || [], correctAnswer: item.correctAnswer || '', acceptedAnswers: item.acceptedAnswers || [], explanation: item.explanation || '', rubric: item.rubric || [], points: item.points || 1, difficulty: item.difficulty || 'medium' })), status: 'in_progress', passScore: 70
    });
    res.status(201).json({ examId: session.examId, title: session.title, courseId: course.id, scopeType, lessonId: session.lessonId, moduleId: session.moduleId, passScore: session.passScore, questionCount: chosen.length, questionMix: selection.questionMix, questions: session.questionsSnapshot.map(publicQuestion), repeatAvoidance: selection.repeatAvoidance, createdAt: session.createdAt });
  } catch (error) { next(error); }
});

router.get(['/software-development/assessments/:examId', '/assessments/:examId'], requireLearner, async (req, res, next) => {
  try {
    const session = await CareerAssessmentSession.findOne({ examId: req.params.examId, user: req.session.user.id }).lean();
    if (!session) return res.status(404).json({ error: 'Không tìm thấy đề luyện tập.' });
    res.json({ examId: session.examId, title: session.title, courseId: session.courseId, lessonId: session.lessonId, moduleId: session.moduleId, scopeType: session.scopeType, status: session.status, passScore: session.passScore, questionCount: session.questionsSnapshot.length, questionMix: session.questionMix || {}, questions: session.questionsSnapshot.map(publicQuestion), draftAnswers: (session.submittedAnswers || []).map((item) => ({ questionId: item.questionId, answer: item.answer })), score: session.score, autoGradedScore: session.autoGradedScore, manualReviewPending: session.manualReviewPending, createdAt: session.createdAt, submittedAt: session.submittedAt });
  } catch (error) { next(error); }
});

router.patch(['/software-development/assessments/:examId/draft', '/assessments/:examId/draft'], requireLearner, async (req, res, next) => {
  try {
    const session = await CareerAssessmentSession.findOne({ examId: req.params.examId, user: req.session.user.id });
    if (!session) return res.status(404).json({ error: 'Không tìm thấy phiên đề.' });
    if (session.status !== 'in_progress') return res.status(409).json({ error: 'Phiên đề đã nộp nên không thể sửa bản nháp.' });
    const validIds = new Set((session.questionsSnapshot || []).map((item) => item.questionId));
    const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 40).filter((item) => item && validIds.has(String(item.questionId))).map((item) => ({ questionId: String(item.questionId), answer: String(item.answer ?? '').slice(0, 30000) })) : [];
    session.submittedAnswers = answers;
    session.lastSeenAt = new Date();
    await session.save();
    res.json({ message: 'Đã lưu câu trả lời tạm thời.', examId: session.examId, savedAnswers: answers.length, lastSeenAt: session.lastSeenAt });
  } catch (error) { next(error); }
});

router.post(['/software-development/assessments/:examId/submit', '/assessments/:examId/submit'], requireLearner, async (req, res, next) => {
  try {
    const session = await CareerAssessmentSession.findOne({ examId: req.params.examId, user: req.session.user.id });
    if (!session) return res.status(404).json({ error: 'Không tìm thấy đề luyện tập.' });
    if (session.status !== 'in_progress') return res.status(409).json({ error: 'Đề này đã được nộp; hãy tạo một đề mới nếu muốn luyện lại.' });
    const incoming = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 40) : [];
    const answers = new Map(incoming.filter((item) => item && typeof item.questionId === 'string').map((item) => [item.questionId, String(item.answer ?? '').slice(0, 30000)]));
    const questions = session.questionsSnapshot || [];
    const objectiveQuestions = questions.filter(isAutoGraded);
    let correct = 0; let possible = 0; let manualReviewPending = 0;
    const feedback = questions.map((item) => {
      const answer = answers.get(item.questionId) || '';
      if (isAutoGraded(item)) {
        possible += Number(item.points || 1);
        const accepted = [item.correctAnswer, ...(item.acceptedAnswers || [])].map(normalizeAnswer).filter(Boolean);
        const isCorrect = accepted.includes(normalizeAnswer(answer));
        if (isCorrect) correct += Number(item.points || 1);
        return { questionId: item.questionId, type: item.type, isCorrect, message: isCorrect ? 'Đúng' : 'Chưa đúng', explanation: item.explanation || '' };
      }
      manualReviewPending += 1;
      return { questionId: item.questionId, type: item.type, isCorrect: null, message: answer.trim() ? 'Đang chờ giáo viên rà soát' : 'Chưa có câu trả lời; cần bổ sung trước khi chấm', rubric: item.rubric || [] };
    });
    const autoGradedScore = possible ? Math.round((correct / possible) * 100) : null;
    session.submittedAnswers = questions.map((item) => ({ questionId: item.questionId, answer: answers.get(item.questionId) || '' }));
    session.answerFeedback = feedback;
    session.autoGradedScore = autoGradedScore;
    session.autoEarnedPoints = correct;
    session.autoPossiblePoints = possible;
    session.score = manualReviewPending ? autoGradedScore : autoGradedScore;
    session.passed = manualReviewPending === 0 && autoGradedScore !== null && autoGradedScore >= session.passScore;
    session.manualReviewPending = manualReviewPending;
    session.status = manualReviewPending ? 'needs_review' : 'submitted';
    session.elapsedSeconds = Math.max(0, Math.min(86400, Number(req.body.elapsedSeconds) || 0));
    session.submittedAt = new Date();
    await session.save();
    await recordActivity(req, { action: 'career.assessment.submit', targetType: 'career-assessment', targetId: session.examId, targetName: session.title, description: 'Nộp bài luyện tập thuộc lộ trình Phát triển phần mềm.', metadata: { courseId: session.courseId, lessonId: session.lessonId, score: session.score, manualReviewPending, questionCount: questions.length } });
    res.json({ message: manualReviewPending ? 'Đã nộp. Các câu tự luận/mã nguồn đang chờ giáo viên chấm.' : 'Đã chấm tự động.', examId: session.examId, score: session.score, autoGradedScore, passed: session.passed, manualReviewPending, objectiveQuestions: objectiveQuestions.length, feedback });
  } catch (error) { next(error); }
});

router.post(['/software-development/courses/:courseId/enroll', '/courses/:courseId/enroll'], requireLearner, async (req, res, next) => {
  try {
    const targetCourse = catalog.getCourse(req.params.courseId);
    if (!targetCourse) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });
    let enrollment = await CareerEnrollment.findOne({ user: req.session.user.id, courseId: targetCourse.id });
    if (!enrollment) enrollment = await CareerEnrollment.create({ user: req.session.user.id, courseId: targetCourse.id, completedLessonIds: [], status: 'in_progress' });
    await recordActivity(req, { action: 'career.course.enroll', targetType: 'career-course', targetId: targetCourse.id, targetName: targetCourse.title, description: 'Đăng ký lộ trình ngành Phát triển phần mềm.' });
    res.status(201).json({ message: 'Đã thêm khóa học vào lộ trình của bạn.', courseId: targetCourse.id, progress: publicEnrollment(enrollment.toObject(), targetCourse) });
  } catch (error) { next(error); }
});

router.post(['/software-development/courses/:courseId/lessons/:lessonId/complete', '/courses/:courseId/lessons/:lessonId/complete'], requireLearner, async (req, res, next) => {
  try {
    const targetCourse = catalog.getCourse(req.params.courseId);
    if (!targetCourse) return res.status(404).json({ error: 'Không tìm thấy khóa học.' });
    const requestedLesson = targetCourse.lessons.find((item) => item.id === req.params.lessonId);
    if (!requestedLesson) return res.status(404).json({ error: 'Không tìm thấy bài học trong khóa này.' });
    const enrollment = await CareerEnrollment.findOne({ user: req.session.user.id, courseId: targetCourse.id });
    if (!enrollment) return res.status(409).json({ error: 'Hãy thêm khóa học vào lộ trình trước khi cập nhật tiến độ.' });
    const currentIndex = targetCourse.lessons.findIndex((item) => item.id === requestedLesson.id);
    const completed = new Set(enrollment.completedLessonIds);
    if (currentIndex > 0 && !completed.has(targetCourse.lessons[currentIndex - 1].id)) {
      return res.status(409).json({ error: 'Hãy hoàn thành bài học trước đó theo thứ tự lộ trình.' });
    }
    if (!completed.has(requestedLesson.id)) enrollment.completedLessonIds.push(requestedLesson.id);
    const allCompleted = targetCourse.lessons.every((item) => enrollment.completedLessonIds.includes(item.id));
    enrollment.status = allCompleted ? 'completed' : 'in_progress';
    enrollment.lastActivityAt = new Date();
    if (allCompleted && !enrollment.completedAt) enrollment.completedAt = new Date();
    await enrollment.save();
    await recordActivity(req, { action: 'career.lesson.complete', targetType: 'career-lesson', targetId: requestedLesson.id, targetName: requestedLesson.title, description: 'Cập nhật tiến độ bài học trong lộ trình nghề nghiệp.', metadata: { courseId: targetCourse.id, completedLessons: enrollment.completedLessonIds.length } });
    res.json({ message: 'Đã lưu tiến độ bài học.', progress: publicEnrollment(enrollment.toObject(), targetCourse), courseCompleted: allCompleted });
  } catch (error) { next(error); }
});

module.exports = router;
