'use strict';

function idOf(value) { return String(value?._id || value?.id || value || ''); }
function isPassedAssessmentAttempt(attempt, assessment) {
    if (!attempt || attempt.status !== 'SUBMITTED' || attempt.result?.requiresReview === true) return false;
    const score = Number(attempt.result?.percentage ?? attempt.score);
    const threshold = Number.isFinite(Number(assessment?.passingScore)) ? Number(assessment.passingScore) : 70;
    return Number.isFinite(score) && score >= threshold;
}
function isPassedPracticeAttempt(attempt) {
    return attempt?.status === 'PASSED' && Number(attempt.score) >= 100;
}
function contentOutline(lesson = {}) {
    const payload = lesson.payload || {};
    const sections = Array.isArray(lesson.theorySections) ? lesson.theorySections : Array.isArray(payload.theorySections) ? payload.theorySections : [];
    const output = sections.filter(section => String(section?.content || '').trim()).map((section, index) => ({ id: `theory-${index}`, label: String(section.title || `Phần kiến thức ${index + 1}`), type: 'CONTENT' }));
    if (!output.length && String(lesson.theory || lesson.description || '').trim()) output.push({ id: 'theory', label: 'Lý thuyết chính', type: 'CONTENT' });
    if ((lesson.examples || payload.examples || []).length) output.push({ id: 'examples', label: 'Ví dụ có hướng dẫn', type: 'CONTENT' });
    if ((payload.practiceTasks || lesson.practiceTasks || lesson.activities || []).length) output.push({ id: 'practice', label: 'Bài luyện tập', type: 'CONTENT' });
    if (payload.practical || lesson.practical || lesson.programming || (lesson.codingTasks || []).length) output.push({ id: 'practical', label: 'Thực hành / lab', type: 'CONTENT' });
    if ((payload.quickChecks || lesson.quickChecks || []).length) output.push({ id: 'quick-check', label: 'Tự kiểm tra kiến thức', type: 'CONTENT' });
    if (lesson.lessonTestId || payload.lessonTestId || (lesson.assessmentIds || []).length) output.push({ id: 'assessment', label: 'Bài kiểm tra kiến thức', type: 'ASSESSMENT' });
    return output;
}
function deriveLessonProgress({ lesson, assessments = [], assessmentAttempts = [], practiceTasks = [], practiceAttempts = [], assignmentSubmissions = [], previousTimeSpentSeconds = 0, requestedTimeSpentSeconds = 0 } = {}) {
    const lessonId = idOf(lesson);
    const lessonAssessments = assessments.filter(item => item?.publicationStatus === 'PUBLISHED' && item?.assessmentType === 'LESSON_TEST' && (idOf(item.lessonId) === lessonId || idOf(lesson.lessonTestId || lesson.payload?.lessonTestId) === idOf(item)));
    const evidenceSteps = [];
    const configurationIssues = [];
    if (lessonAssessments.length) {
        const completed = lessonAssessments.some(assessment => assessmentAttempts.some(attempt => idOf(attempt.assessmentId) === idOf(assessment) && isPassedAssessmentAttempt(attempt, assessment)));
        evidenceSteps.push({ id: 'assessment', label: 'Bài kiểm tra kiến thức của bài học', type: 'ASSESSMENT', completed, evidence: completed ? 'PASSED_ASSESSMENT' : 'ASSESSMENT_NOT_PASSED' });
    } else {
        evidenceSteps.push({ id: 'assessment', label: 'Bài kiểm tra kiến thức của bài học', type: 'ASSESSMENT', completed: false, evidence: 'ASSESSMENT_NOT_CONFIGURED' });
        configurationIssues.push({ code: 'LESSON_TEST_NOT_CONFIGURED', message: 'Bài học chưa có bài kiểm tra riêng đã công bố; chưa thể xác nhận hoàn thành.' });
    }
    const taskRows = practiceTasks.filter(task => task?.status === 'PUBLISHED' && idOf(task.lessonId) === lessonId);
    const needsPracticalEvidence = Boolean(lesson?.programming || (lesson?.codingTasks || []).length || lesson?.payload?.programming || lesson?.payload?.practical || lesson?.practical);
    if (taskRows.length) {
        for (const task of taskRows) {
            const completed = practiceAttempts.some(attempt => idOf(attempt.taskId) === idOf(task) && isPassedPracticeAttempt(attempt));
            evidenceSteps.push({ id: `practice:${idOf(task)}`, label: `Thực hành đạt: ${String(task.title || task.code || 'Bài thực hành')}`, type: 'PRACTICE', completed, evidence: completed ? 'ALL_TESTS_PASSED' : 'PRACTICE_NOT_PASSED' });
        }
    } else if (needsPracticalEvidence) {
        const scoredSubmission = assignmentSubmissions.some(item => item?.status === 'GRADED' && Number(item.score) >= 70);
        const isCoding = Boolean(lesson?.programming || (lesson?.codingTasks || []).length || lesson?.payload?.programming || /coding|code|programming/i.test(String(lesson?.payload?.practical?.kind || lesson?.practical?.kind || '')));
        evidenceSteps.push({ id: 'practical', label: isCoding ? 'Bài lập trình phải có bộ test đã đạt' : 'Sản phẩm thực hành được chấm đạt', type: 'PRACTICE', completed: !isCoding && scoredSubmission, evidence: !isCoding && scoredSubmission ? 'GRADED_PRACTICAL_PASSED' : 'PRACTICAL_NOT_PASSED' });
        if (isCoding) configurationIssues.push({ code: 'CODE_PRACTICE_NOT_CONFIGURED', message: 'Bài có yêu cầu lập trình nhưng chưa gắn PracticeTask có bộ test công khai/ẩn; không thể xác nhận đạt chỉ từ việc chương trình chạy.' });
    }
    const completedSteps = evidenceSteps.filter(step => step.completed).map(step => step.id);
    const progressPercent = evidenceSteps.length ? Math.round(completedSteps.length / evidenceSteps.length * 100) : 0;
    const completed = evidenceSteps.length > 0 && completedSteps.length === evidenceSteps.length && configurationIssues.length === 0;
    return {
        contentSteps: contentOutline(lesson), evidenceSteps, completedSteps, progressPercent, completed,
        configurationIssues, timeSpentSeconds: Math.min(86400, Math.max(Number(previousTimeSpentSeconds) || 0, Number(requestedTimeSpentSeconds) || 0)),
        source: 'ASSESSMENT_EVIDENCE_V34'
    };
}
async function recalculateLessonProgress({ models, username, courseId, lessonId, requestedTimeSpentSeconds = 0 } = {}) {
    if (!models?.LessonProgress || !models?.CurriculumContent || !models?.Course || !models?.Assessment || !models?.AssessmentAttempt || !username || !courseId || !lessonId) return null;
    const [course, lesson, previous] = await Promise.all([
        models.Course.findOne({ _id: courseId, $or: [{ kind: 'CANONICAL', status: { $in: ['ACTIVE', 'PUBLISHED'] } }, { kind: 'PERSONAL_AI', ownerUsername: username, status: 'ACTIVE' }] }).select('_id code name').lean(),
        models.CurriculumContent.findOne({ _id: lessonId, courseId, type: 'LESSON', status: 'PUBLISHED' }).lean(),
        models.LessonProgress.findOne({ username, courseId, lessonId }).lean()
    ]);
    if (!course || !lesson) return null;
    const lessonTestIds = [lesson.lessonTestId, lesson.payload?.lessonTestId, ...(lesson.assessmentIds || [])].filter(Boolean).map(idOf).filter(value => /^[a-f0-9]{24}$/i.test(value));
    const [assessments, practiceTasks] = await Promise.all([
        models.Assessment.find({ publicationStatus: 'PUBLISHED', $or: [{ _id: { $in: lessonTestIds } }, { lessonId: lesson._id, courseId: course._id }] }).lean(),
        models.PracticeTask ? models.PracticeTask.find({ status: 'PUBLISHED', lessonId: lesson._id, $or: [{ courseId: course._id }, { courseId: null }] }).lean() : Promise.resolve([])
    ]);
    const lessonAssessmentIds = assessments.filter(item => item.assessmentType === 'LESSON_TEST' && (String(item.lessonId || '') === String(lesson._id) || lessonTestIds.includes(String(item._id)))).map(item => item._id);
    const practiceIds = practiceTasks.map(item => item._id);
    const [assessmentAttempts, practiceAttempts, assignmentSubmissions] = await Promise.all([
        lessonAssessmentIds.length ? models.AssessmentAttempt.find({ username, assessmentId: { $in: lessonAssessmentIds }, status: { $in: ['SUBMITTED', 'REVIEW_REQUIRED'] } }).select('assessmentId status score result submittedAt').lean() : Promise.resolve([]),
        practiceIds.length && models.PracticeAttempt ? models.PracticeAttempt.find({ username, taskId: { $in: practiceIds } }).select('taskId status score submittedAt').lean() : Promise.resolve([]),
        models.AssignmentSubmission ? models.AssignmentSubmission.find({ username, lessonId: { $in: [String(lesson._id), String(lesson.code || '')].filter(Boolean) }, status: 'GRADED' }).select('courseId courseCode lessonId status score gradedAt').lean() : Promise.resolve([])
    ]);
    const scopedSubmissions = assignmentSubmissions.filter(item => !item.courseId || String(item.courseId) === String(course._id) || (course.code && item.courseCode === course.code));
    const snapshot = deriveLessonProgress({ lesson, assessments, assessmentAttempts, practiceTasks, practiceAttempts, assignmentSubmissions: scopedSubmissions, previousTimeSpentSeconds: previous?.timeSpentSeconds, requestedTimeSpentSeconds });
    const now = new Date();
    const saved = await models.LessonProgress.findOneAndUpdate(
        { username, lessonId: lesson._id, courseId: course._id },
        { $set: { username, courseId: course._id, lessonId: lesson._id, completedSteps: snapshot.completedSteps, progressPercent: snapshot.progressPercent, completed: snapshot.completed, lastSeenAt: now, completedAt: snapshot.completed ? (previous?.completedAt || now) : null, timeSpentSeconds: snapshot.timeSpentSeconds, source: snapshot.source } },
        { upsert: true, new: true, runValidators: true }
    ).lean();
    return { ...snapshot, lessonId: String(lesson._id), courseId: String(course._id), completedAt: saved.completedAt, lastSeenAt: saved.lastSeenAt };
}
module.exports = { contentOutline, deriveLessonProgress, isPassedAssessmentAttempt, isPassedPracticeAttempt, recalculateLessonProgress };
