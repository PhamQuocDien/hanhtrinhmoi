'use strict';

/**
 * MINI TEST — bài kiểm tra cuối mỗi bài học.
 *
 * Mini test KHÔNG phải điểm định kỳ: nó thuộc loại `mini_test`, không cộng vào
 * điểm giữa kỳ/cuối kỳ. Mục đích là xác nhận học sinh đã nắm bài trước khi bài
 * được đánh dấu hoàn thành.
 *
 * Nguyên tắc bảo mật — giữ đúng như hệ thống đề thi đang làm:
 *   - Chỉ lấy câu đã publish.
 *   - Chỉ lấy câu đúng phạm vi: cùng lớp, môn, bài học (và bộ sách nếu có).
 *   - Dùng `toStudentView()` để KHÔNG gửi đáp án đúng trước khi nộp bài.
 *   - Điểm luôn do máy chủ chấm qua `gradeExam`, không tin `score` từ client.
 */

const questionService = require('./question.service');
const scoring = require('./scoring/exam-grader');
const milestoneService = require('./milestone.service');
const Progress = require('../models/progress.model');
const { resolveMiniTestConfig } = require('../../data/curriculum/mini-test-policy');
const { ASSESSMENT_TYPE } = require('../../data/curriculum/assessment-policy-registry');

/**
 * Chuẩn bị mini test cho một bài học.
 *
 * Trả về câu hỏi đã cắt theo bản nhìn học sinh (không đáp án). Trả `null` khi
 * bài học chưa có câu hỏi nào — giao diện hiện trạng thái "chưa có dữ liệu" thay
 * vì bịa câu hỏi.
 *
 * @param {object} params lớp, môn, bài, bộ sách
 * @returns {Promise<object|null>}
 */
async function prepareMiniTest({ grade, subjectId, lessonId, seriesId = null }) {
    const config = resolveMiniTestConfig({ grade, subjectId });

    const pool = await questionService.findPublishedQuestions(questionService.buildFilter({
        grade: Number(grade),
        subjectId,
        lessonId,
        seriesId
    }));

    if (!pool.length) return null;

    const chosen = questionService.pickRandom(pool, Math.min(config.questionCount, pool.length));
    // `toStudentView` là phương thức trên document Mongoose — cắt đáp án ở đây.
    const views = chosen.map(question => ({
        ...question.toStudentView(),
        points: question.points ?? 1
    }));

    return {
        miniTestId: `${lessonId}-mini`,
        assessmentType: ASSESSMENT_TYPE.MINI_TEST,
        lessonId,
        grade: Number(grade),
        subjectId,
        seriesId,
        title: config.title,
        questions: views,
        questionCount: views.length,
        totalPoints: views.reduce((sum, item) => sum + (item.points || 0), 0),
        passPercent: config.passPercent,
        maxAttempts: config.maxAttempts,
        allowRetry: config.maxAttempts > 1,
        source: config.source,
        verificationStatus: config.verificationStatus,
        isOfficialRegulation: config.isOfficialRegulation
    };
}

/**
 * Nộp bài mini test: máy chủ tự chấm và cập nhật tiến độ bài học.
 *
 * Nguồn sự thật duy nhất cho kết quả mini test. Học sinh gửi đáp án; máy chủ tự
 * tải đáp án đúng. `gradeExam` đã bỏ qua mọi trường `score`/`isCorrect` client
 * gửi lên, nên không có đường gian lận điểm.
 *
 * @param {string} username học sinh
 * @param {object} params lớp, môn, bài, bộ sách và đáp án
 * @returns {Promise<object>} kết quả kèm trạng thái hoàn thành bài
 */
async function submitMiniTest(username, { grade, subjectId, lessonId, seriesId = null, answers = {} }) {
    const config = resolveMiniTestConfig({ grade, subjectId });

    const pool = await questionService.findPublishedQuestions(questionService.buildFilter({
        grade: Number(grade),
        subjectId,
        lessonId,
        seriesId
    }));

    if (!pool.length) {
        return {
            error: 'EMPTY_POOL',
            message: 'Bài học này chưa có câu hỏi để làm mini test.'
        };
    }

    const previous = await Progress.findOne({ username, lessonId }).lean();
    const attemptsUsed = previous?.miniTestAttempts || 0;

    // Hết lượt làm thì từ chối, KHÔNG tự tạo kết quả đạt.
    if (attemptsUsed >= config.maxAttempts) {
        return {
            error: 'NO_ATTEMPTS_LEFT',
            message: `Đã hết lượt làm mini test (tối đa ${config.maxAttempts} lần).`,
            attemptsUsed,
            maxAttempts: config.maxAttempts
        };
    }

    // Chỉ chấm câu thuộc đúng bài học này và đã publish.
    const allowed = new Map(pool.map(question => [question.questionId, question]));
    const items = Object.entries(answers || {})
        .filter(([questionId]) => allowed.has(questionId))
        .map(([questionId, answer]) => ({
            questionId,
            answer,
            points: allowed.get(questionId).points ?? 1
        }));

    if (!items.length) {
        return {
            error: 'NO_MATCHED_ANSWERS',
            message: 'Không có câu trả lời nào thuộc mini test này.'
        };
    }

    const questions = items.map(item => allowed.get(item.questionId));
    const graded = scoring.gradeExam(questions, answers, {}, items);
    const finalized = scoring.finalizeScores(graded, {});

    const totalPoints = finalized.totalPoints || graded.totalPoints || 0;
    const scorePercent = totalPoints > 0
        ? Math.round(((finalized.totalScore ?? graded.autoScore) / totalPoints) * 100)
        : 0;
    const passed = scorePercent >= config.passPercent;

    // `bestScore` chỉ tăng nên làm lại không làm mất kết quả tốt nhất.
    const progress = await Progress.findOneAndUpdate(
        { username, lessonId },
        {
            $set: {
                grade: Number(grade),
                subjectId,
                lessonId,
                lastScore: scorePercent,
                lastStudiedAt: new Date()
            },
            $inc: { miniTestAttempts: 1 },
            $max: { bestScore: scorePercent, miniTestBestPercent: scorePercent }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const bestPercent = progress.miniTestBestPercent ?? scorePercent;

    // Đánh giá lại điều kiện hoàn thành bài — máy chủ là nguồn quyết định.
    const completion = milestoneService.evaluateLessonCompletion({
        grade,
        subjectId,
        readingDone: Boolean(progress.readingDone),
        miniTestAttempted: true,
        miniTestBestPercent: bestPercent,
        attemptsAllowed: config.maxAttempts,
        attemptsUsed: progress.miniTestAttempts ?? 1
    });

    if (completion.completed && !progress.completed) {
        await Progress.updateOne(
            { username, lessonId },
            { $set: { completed: true, completedAt: new Date() } }
        );
    }

    return {
        assessmentType: ASSESSMENT_TYPE.MINI_TEST,
        lessonId,
        scorePercent,
        bestPercent,
        passed,
        passPercent: config.passPercent,
        totalPoints,
        result: finalized,
        completion,
        remainingAttempts: completion.remainingAttempts,
        maxAttempts: config.maxAttempts
    };
}

/**
 * Trạng thái mini test của một bài học với một học sinh.
 *
 * Giao diện dùng để biết bài đó còn lượt làm và đã đạt hay chưa.
 *
 * @param {string} username học sinh
 * @param {object} params lớp, môn, bài
 * @returns {Promise<object>}
 */
async function getMiniTestState(username, { grade, subjectId, lessonId }) {
    const config = resolveMiniTestConfig({ grade, subjectId });
    const progress = await Progress.findOne({ username, lessonId }).lean();

    const used = progress?.miniTestAttempts || 0;
    const bestPercent = progress?.miniTestBestPercent ?? progress?.bestScore ?? 0;

    return {
        lessonId,
        hasAttempted: used > 0,
        attemptsUsed: used,
        maxAttempts: config.maxAttempts,
        remainingAttempts: Math.max(0, config.maxAttempts - used),
        // Làm lại được nhưng không làm mất kết quả đã đạt.
        canRetry: used < config.maxAttempts,
        bestPercent,
        passed: used > 0 && bestPercent >= config.passPercent,
        passPercent: config.passPercent
    };
}

module.exports = {
    getMiniTestState,
    prepareMiniTest,
    submitMiniTest
};
