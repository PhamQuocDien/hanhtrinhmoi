'use strict';

/**
 * Kiểm tra tính hợp lệ của một ĐỀ THI trước khi cho phép publish.
 *
 * Đề chỉ được publish khi:
 *   - có ít nhất một câu hỏi tồn tại trong ngân hàng và hợp lệ,
 *   - không có câu trùng lặp trong chính đề,
 *   - điểm mỗi câu > 0 và tổng điểm khớp,
 *   - metadata (lớp / môn / bài / chương) trỏ tới đúng thứ trong danh mục,
 *   - có thời lượng và ngưỡng đạt hợp lệ.
 *
 * Dùng chung cho API soạn đề của admin và cho bước publish sau khi import DOCX.
 */

const env = require('../config/env');
const { EXAM_STATUS, QUESTION_TYPES } = require('../config/constants');
const { validateQuestionDocument } = require('./question.validator');

/**
 * Kiểm tra danh sách câu hỏi của một đề.
 *
 * @param {Array}  questions mảng { questionId, points, order }
 * @param {object} [options] { strictCurriculum, questionStore }
 *        `questionStore` là hàm (questionId) => question|null; nếu không truyền
 *        thì chỉ kiểm được cấu trúc, không kiểm nội dung câu.
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[]}>}
 */
async function validateExamQuestions(questions = [], options = {}) {
    const { strictCurriculum = true, questionStore = null } = options;
    const errors = [];
    const warnings = [];

    if (!questions.length) {
        errors.push('Đề thi phải có ít nhất 1 câu hỏi.');
        return { valid: false, errors, warnings };
    }

    const seenIds = new Set();
    const seenOrders = new Set();

    for (const item of questions) {
        const questionId = String(item.questionId || '').trim();
        if (!questionId) {
            errors.push('Câu không có questionId.');
            continue;
        }
        if (seenIds.has(questionId)) {
            errors.push(`Câu "${questionId}" bị lặp trong đề.`);
            continue;
        }
        seenIds.add(questionId);

        const points = Number(item.points);
        if (!Number.isFinite(points) || points <= 0) {
            errors.push(`Câu "${questionId}" có điểm không hợp lệ (${item.points}).`);
        }

        const order = Number(item.order);
        if (!Number.isInteger(order) || order < 1) {
            errors.push(`Câu "${questionId}" thiếu thứ tự hợp lệ.`);
        } else if (seenOrders.has(order)) {
            errors.push(`Có hai câu cùng thứ tự ${order}.`);
        } else {
            seenOrders.add(order);
        }

        // Nạp câu hỏi gốc để kiểm nội dung — chỉ khi có questionStore.
        if (questionStore) {
            // eslint-disable-next-line no-await-in-loop
            const question = await questionStore(questionId);
            if (!question) {
                errors.push(`Câu "${questionId}" không tồn tại trong ngân hàng câu hỏi.`);
                continue;
            }
            const result = validateQuestionDocument(
                { ...question, points, questionText: question.questionText },
                { strictCurriculum, requireMetadata: true }
            );
            for (const error of result.errors) errors.push(`Câu "${questionId}": ${error}`);
            for (const warning of result.warnings) warnings.push(`Câu "${questionId}": ${warning}`);
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Kiểm tra metadata của đề (lớp / môn / chương / bài / thời lượng / ngưỡng đạt).
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateExamMetadata(exam, { strictCurriculum = true } = {}) {
    const errors = [];
    const warnings = [];

    if (!String(exam.title || '').trim()) errors.push('Đề thi phải có tên.');

    const grade = Number(exam.grade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) errors.push('Đề thi phải gắn với lớp 1-12.');

    if (!exam.subjectId) {
        errors.push('Đề thi phải gắn với một môn học.');
    } else if (strictCurriculum) {
        // eslint-disable-next-line global-require
        const { hasSubjectInGrade, getSubject } = require('../../data/subjects/subject-registry');
        if (!getSubject(exam.subjectId)) {
            errors.push(`Môn "${exam.subjectId}" không có trong danh mục môn học.`);
        } else if (Number.isInteger(grade) && !hasSubjectInGrade(exam.subjectId, grade)) {
            errors.push(`Môn "${exam.subjectId}" không thuộc lớp ${grade}.`);
        }
    }

    const duration = Number(exam.durationMinutes);
    if (!Number.isFinite(duration) || duration < 1 || duration > 300) {
        errors.push('Thời lượng làm bài phải từ 1 đến 300 phút.');
    }

    const passPercent = Number(exam.passScorePercent);
    if (!Number.isFinite(passPercent) || passPercent < 0 || passPercent > 100) {
        errors.push('Ngưỡng đạt phải từ 0 đến 100 (%).');
    }

    const questionCount = Array.isArray(exam.questions) ? exam.questions.length : 0;
    if (questionCount > env.SCORING.maxQuestionsPerExam) {
        errors.push(`Đề có ${questionCount} câu, vượt giới hạn ${env.SCORING.maxQuestionsPerExam} câu.`);
    } else if (strictCurriculum && questionCount < env.SCORING.minQuestionsPerExam) {
        warnings.push(`Đề chỉ có ${questionCount} câu, khuyến nghị tối thiểu ${env.SCORING.minQuestionsPerExam} câu.`);
    }

    if (strictCurriculum) {
        // eslint-disable-next-line global-require
        const curriculum = require('../../data/curriculum/curriculum-registry');
        if (exam.lessonId && !curriculum.getLesson(exam.lessonId)) {
            errors.push(`Bài học "${exam.lessonId}" không có trong danh mục chương trình.`);
        }
        if (exam.chapterId && !curriculum.getChapter(exam.chapterId)) {
            errors.push(`Chương "${exam.chapterId}" không có trong danh mục chương trình.`);
        }
    }

    if (exam.description && String(exam.description).length > 2000) {
        warnings.push('Mô tả đề quá dài, nên rút gọn.');
    }

    return { errors, warnings };
}

/**
 * Kiểm tra TOÀN BỘ đề trước khi publish.
 *
 * @param {object} exam      đề thi (mongoose document hoặc object thường)
 * @param {object} [options] { strictCurriculum, questionStore }
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[]}>}
 */
async function validateExamForPublish(exam, options = {}) {
    const errors = [];
    const warnings = [];

    if (!exam || typeof exam !== 'object') {
        return { valid: false, errors: ['Đề thi không hợp lệ.'], warnings };
    }

    const meta = validateExamMetadata(exam, options);
    errors.push(...meta.errors);
    warnings.push(...meta.warnings);

    const questions = Array.isArray(exam.questions)
        ? exam.questions.map(item => ({
            questionId: item.questionId,
            points: item.points,
            order: item.order
        }))
        : [];

    const result = await validateExamQuestions(questions, options);
    errors.push(...result.errors);
    warnings.push(...result.warnings);

    // Tổng điểm khai báo phải khớp tổng điểm tính từ câu hỏi.
    if (exam.totalPoints !== undefined && exam.totalPoints !== null && questions.length) {
        const computed = questions.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
        const declared = Number(exam.totalPoints);
        if (Number.isFinite(declared) && Math.abs(computed - declared) > 0.001) {
            warnings.push(`Tổng điểm khai báo (${declared}) khác tổng điểm tính từ câu hỏi (${computed}). Sẽ dùng giá trị tính.`);
        }
    }

    // Cảnh báo đề chỉ có một loại câu — dấu hiệu đề chưa đa dạng.
    if (questions.length && options.questionStore) {
        const types = new Set();
        for (const item of questions) {
            // eslint-disable-next-line no-await-in-loop
            const question = await options.questionStore(item.questionId);
            if (question?.type) types.add(question.type);
        }
        if (types.size === 1 && types.has(QUESTION_TYPES.SINGLE_CHOICE)) {
            warnings.push('Đề chỉ có trắc nghiệm một đáp án — cân nhắc thêm câu tự luận/điền khuyết.');
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

/**
 * Đề có được phép chuyển sang trạng thái đích không.
 * @returns {{allowed: boolean, reason: string|null}}
 */
function canTransition(exam, targetStatus) {
    const allowed = {
        [EXAM_STATUS.DRAFT]: [EXAM_STATUS.REVIEW, EXAM_STATUS.PUBLISHED, EXAM_STATUS.ARCHIVED],
        [EXAM_STATUS.REVIEW]: [EXAM_STATUS.DRAFT, EXAM_STATUS.PUBLISHED, EXAM_STATUS.ARCHIVED],
        [EXAM_STATUS.PUBLISHED]: [EXAM_STATUS.ARCHIVED, EXAM_STATUS.DRAFT],
        [EXAM_STATUS.ARCHIVED]: [EXAM_STATUS.DRAFT]
    };
    const allowedTargets = allowed[exam.status] || [];
    if (!allowedTargets.includes(targetStatus)) {
        return { allowed: false, reason: `Không thể chuyển đề từ "${exam.status}" sang "${targetStatus}".` };
    }
    return { allowed: true, reason: null };
}

module.exports = {
    canTransition,
    validateExamForPublish,
    validateExamMetadata,
    validateExamQuestions
};