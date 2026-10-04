'use strict';

/**
 * Nghiệp vụ ngân hàng câu hỏi.
 *
 * Bảo mật trọng tâm: mọi hàm trả về cho HỌC SINH đều đi qua `toStudentView`
 * nên KHÔNG BAO GIỜ có correctAnswer. Chỉ hàm dành cho admin mới lấy đáp án.
 */

const Question = require('../models/question.model');
const {
    DIFFICULTIES,
    QUESTION_TYPES,
    MANUAL_GRADING_TYPES,
    GRADING_MODES
} = require('../config/constants');

/** Bộ lọc chuẩn cho truy vấn ngân hàng câu hỏi. */
function buildFilter({ grade, subjectId, lessonId, chapterId, difficulty, types } = {}) {
    const filter = {};
    if (grade) filter.grade = Number(grade);
    if (subjectId) filter.subjectId = String(subjectId);
    if (lessonId) filter.lessonId = String(lessonId);
    if (chapterId) filter.chapterId = String(chapterId);
    if (difficulty && DIFFICULTIES.includes(difficulty)) filter.difficulty = difficulty;
    if (Array.isArray(types) && types.length) filter.type = { $in: types };
    return filter;
}

/**
 * Lấy câu hỏi đã publish cho học sinh.
 * Luôn bỏ qua câu đang chờ duyệt (`needsReview`) và câu chưa publish.
 */
async function findPublishedQuestions(options = {}) {
    const filter = { ...buildFilter(options), publishedAt: { $ne: null }, needsReview: false };
    const limit = Math.min(Number(options.limit) || 200, 500);
    return Question.find(filter).limit(limit);
}

/**
 * Lấy câu hỏi kèm đáp án đúng — CHỈ dùng ở máy chủ để chấm điểm.
 * Không bao giờ gọi hàm này rồi trả thẳng cho client.
 */
async function findQuestionsWithAnswers(questionIds) {
    if (!questionIds?.length) return [];
    return Question.find({ questionId: { $in: questionIds } });
}

/** Lấy ngẫu nhiên N câu để tạo đề. */
async function pickRandom(questions, count) {
    const pool = [...questions];
    for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

/** Sinh một examId ổn định. */
function buildExamId(prefix = 'exam') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Sinh một questionId ổn định. */
function buildQuestionId(prefix = 'q') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Tạo bản ghi câu hỏi từ một câu đã parse từ DOCX.
 *
 * Giữ nguyên mọi trường theo loại (options / blanks / statements / rubric) để
 * câu đọc từ Word không mất thông tin so với câu soạn tay trong trình quản trị.
 *
 * `correctAnswer.manualGradingRequired` được đặt cho câu tự luận, để hệ thống
 * không bao giờ tự cho điểm những câu không thể chấm bằng máy.
 */
function buildQuestionDocument(parsed, metadata = {}) {
    const type = parsed.type || QUESTION_TYPES.SINGLE_CHOICE;
    // Câu tự luận không có "đáp án đúng" máy đọc được.
    const needsManualGrading = MANUAL_GRADING_TYPES.includes(type);

    return {
        questionId: parsed.questionId || parsed.id || buildQuestionId(),
        type,
        questionText: parsed.questionText,
        grade: Number(metadata.grade),
        subjectId: metadata.subjectId,
        seriesId: metadata.seriesId || null,
        textbookId: metadata.textbookId || null,
        chapterId: metadata.chapterId || null,
        lessonId: parsed.lessonId || metadata.lessonId || null,

        options: parsed.options || [],
        blanks: parsed.blanks || [],
        statements: parsed.statements || [],
        rubric: parsed.rubric || [],
        acceptedAnswers: parsed.acceptedAnswers || [],
        unit: parsed.unit || '',

        correctAnswer: {
            type,
            value: needsManualGrading ? [] : parsed.correctAnswer,
            normalizedValue: needsManualGrading ? '' : String(parsed.correctAnswer ?? ''),
            manualGradingRequired: needsManualGrading
        },
        // Câu không có đáp án đúng vẫn nên chấm tay thay vì chấm sai.
        gradingMode: needsManualGrading
            ? GRADING_MODES.MANUAL
            : (parsed.gradingMode || GRADING_MODES.AUTO),

        explanation: parsed.explanation || '',
        difficulty: parsed.difficulty || 'medium',
        points: Number(parsed.points) || 1,

        // Parser không chắc thì bắt buộc admin duyệt: có công thức, thiếu đáp án,
        // hoặc loại câu chỉ nhận dạng được ở mức độ thấp.
        needsReview: Boolean(parsed.needsReview)
            || Boolean(parsed.hasFormula)
            || !parsed.answerDetected
            || parsed.typeDetection?.confidence === 'low',
        reviewNotes: parsed.warnings || [],
        media: (parsed.media || []).map(item => ({
            type: item.type || 'image',
            url: item.url,
            caption: item.caption || ''
        })),

        source: metadata.source || '',
        sourceDocument: metadata.fileName || '',
        verificationStatus: metadata.verificationStatus || 'NEEDS_VERIFICATION',
        createdBy: metadata.createdBy,
        importJobId: metadata.importJobId || null
    };
}

/** Thống kê ngân hàng câu hỏi cho trang quản trị. */
async function getStats({ grade, subjectId } = {}) {
    const match = buildFilter({ grade, subjectId });
    const [total, published, pending, byDifficulty, byType] = await Promise.all([
        Question.countDocuments(match),
        Question.countDocuments({ ...match, publishedAt: { $ne: null } }),
        Question.countDocuments({ ...match, needsReview: true }),
        Question.aggregate([{ $match: match }, { $group: { _id: '$difficulty', count: { $sum: 1 } } }]),
        Question.aggregate([{ $match: match }, { $group: { _id: '$type', count: { $sum: 1 } } }])
    ]);

    return {
        total,
        published,
        pendingReview: pending,
        draft: total - published,
        byDifficulty: Object.fromEntries(byDifficulty.map(row => [row._id, row.count])),
        byType: Object.fromEntries(byType.map(row => [row._id, row.count]))
    };
}

/** Cập nhật một câu hỏi. */
async function updateQuestion(questionId, changes, editor) {
    return Question.findOneAndUpdate(
        { questionId },
        { $set: { ...changes, updatedBy: editor } },
        { new: true, runValidators: true }
    );
}

/** Xoá một câu hỏi. Trả về số bản ghi đã xoá. */
async function deleteQuestion(questionId) {
    const result = await Question.deleteOne({ questionId });
    return result.deletedCount || 0;
}

/** Bản nhìn đầy đủ cho màn hình soạn thảo của admin (có đáp án đúng và rubric). */
function toEditorView(question) {
    return {
        questionId: question.questionId,
        type: question.type,
        questionText: question.questionText,

        grade: question.grade,
        subjectId: question.subjectId,
        seriesId: question.seriesId,
        textbookId: question.textbookId,
        chapterId: question.chapterId,
        lessonId: question.lessonId,

        options: question.options,
        blanks: question.blanks,
        statements: question.statements,
        rubric: question.rubric,
        acceptedAnswers: question.acceptedAnswers,
        unit: question.unit,

        correctAnswer: question.correctAnswer,
        explanation: question.explanation,

        // Cấu hình chấm — admin cần thấy hết để sửa cho đúng.
        gradingMode: question.gradingMode,
        multipleChoiceMode: question.multipleChoiceMode,
        wrongAnswerPenalty: question.wrongAnswerPenalty,
        tolerance: question.tolerance,
        minWords: question.minWords,
        maxWords: question.maxWords,
        normalization: question.normalization,

        difficulty: question.difficulty,
        points: question.points,
        needsReview: question.needsReview,
        reviewNotes: question.reviewNotes,
        media: question.media,
        source: question.source,
        sourceDocument: question.sourceDocument,
        verificationStatus: question.verificationStatus,
        publishedAt: question.publishedAt,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt
    };
}

module.exports = {
    buildExamId,
    buildFilter,
    buildQuestionDocument,
    buildQuestionId,
    deleteQuestion,
    findPublishedQuestions,
    findQuestionsWithAnswers,
    getStats,
    pickRandom,
    toEditorView,
    updateQuestion
};