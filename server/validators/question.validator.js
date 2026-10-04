'use strict';

/**
 * Kiểm tra tính hợp lệ của một CÂU HỎI theo từng loại.
 *
 * Đây là ranh giới chặn publish. Một câu chỉ được đưa vào ngân hàng khi:
 *   - đủ dữ liệu bắt buộc theo loại câu,
 *   - đáp án thực sự tồn tại và so khớp được,
 *   - metadata gắn với chương trình không trỏ tới thứ không có trong danh mục.
 *
 * Dùng chung cho:
 *   - API soạn thảo của admin,
 *   - bước publish sau khi import DOCX,
 *   - bước publish đề thi.
 */

const {
    QUESTION_TYPES,
    GRADING_MODES,
    MULTIPLE_CHOICE_MODES,
    OPTION_LABELS
} = require('../config/constants');
const normalizer = require('../utils/answer-normalizer');

const TYPE_VALUES = Object.values(QUESTION_TYPES);

/** Loại câu nào không được dùng lựa chọn A-D. */
const TYPES_WITHOUT_OPTIONS = Object.freeze([
    QUESTION_TYPES.FILL_BLANK,
    QUESTION_TYPES.SHORT_ANSWER,
    QUESTION_TYPES.NUMERIC,
    QUESTION_TYPES.ESSAY
]);

/** Loại câu nào bắt buộc có đáp án máy đọc được. */
const TYPES_REQUIRING_ANSWER = Object.freeze([
    QUESTION_TYPES.SINGLE_CHOICE,
    QUESTION_TYPES.MULTIPLE_CHOICE,
    QUESTION_TYPES.TRUE_FALSE,
    QUESTION_TYPES.NUMERIC
]);

/** Loại câu nào chỉ được chấm tay. */
const TYPES_MANUAL_ONLY = Object.freeze([QUESTION_TYPES.ESSAY]);

/** Câu trả về giá trị đáp án từ nhiều nơi (doc dùng object, mongoose dùng subdoc). */
function answerValueOf(question) {
    return question?.correctAnswer?.value ?? question?.correctAnswer ?? null;
}

/** Lấy danh sách đáp án chấp nhận của câu trả lời ngắn. */
function acceptedAnswersOf(question) {
    if (Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length) return question.acceptedAnswers;
    const value = answerValueOf(question);
    return Array.isArray(value) ? value : [];
}

/**
 * Kiểm tra lựa chọn A-D.
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateOptions(question) {
    const errors = [];
    const warnings = [];
    const options = Array.isArray(question.options) ? question.options : [];

    if (TYPES_WITHOUT_OPTIONS.includes(question.type)) {
        if (options.length) warnings.push('Câu này không dùng lựa chọn A-D nhưng vẫn có dữ liệu lựa chọn.');
        return { errors, warnings };
    }

    if (options.length < 2) errors.push('Câu trắc nghiệm cần ít nhất 2 lựa chọn.');

    const labels = options.map(option => String(option.label || '').trim().toUpperCase());
    if (labels.some(label => !OPTION_LABELS.includes(label))) {
        errors.push(`Ký hiệu lựa chọn phải nằm trong ${OPTION_LABELS.join('/')}.`);
    }
    if (new Set(labels).size !== labels.length) errors.push('Có ký hiệu lựa chọn bị trùng.');

    const texts = options.map(option => String(option.text || '').trim());
    if (texts.some(text => !text)) errors.push('Có lựa chọn rỗng.');
    if (new Set(texts).size !== texts.length) warnings.push('Có hai lựa chọn trùng nội dung.');

    return { errors, warnings };
}

/**
 * Kiểm tra đáp án của câu trắc nghiệm.
 * @returns {{errors: string[], warnings: string[]}}
 */
function validateChoiceAnswer(question) {
    const errors = [];
    const warnings = [];
    const labels = (question.options || []).map(option => String(option.label || '').toUpperCase());
    const answer = answerValueOf(question);

    if (answer === null || answer === undefined || answer === '' || (Array.isArray(answer) && !answer.length)) {
        errors.push('Chưa có đáp án đúng — cần nhập trước khi publish.');
        return { errors, warnings };
    }

    const given = (Array.isArray(answer) ? answer : [answer])
        .map(value => String(value).trim().toUpperCase());

    const unknown = given.filter(label => !labels.includes(label));
    if (unknown.length) errors.push(`Đáp án "${unknown.join(', ')}" không khớp lựa chọn nào của câu.`);

    if (question.type === QUESTION_TYPES.SINGLE_CHOICE && Array.isArray(answer)) {
        errors.push('Câu một đáp án chỉ được có đúng MỘT ký hiệu đúng.');
    }
    if (question.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
        if (!Array.isArray(answer)) errors.push('Câu nhiều đáp án phải khai báo đáp án dạng mảng ký hiệu.');
        else if (answer.length < 1) errors.push('Câu nhiều đáp án cần ít nhất 1 đáp án đúng.');
        if (answer.length === labels.length && labels.length > 0) {
            warnings.push('Đáp án đúng gồm toàn bộ lựa chọn — câu này không có đáp án sai.');
        }
        const mode = question.multipleChoiceMode || MULTIPLE_CHOICE_MODES.ALL_OR_NOTHING;
        if (!Object.values(MULTIPLE_CHOICE_MODES).includes(mode)) {
            errors.push(`Kiểu chấm "${mode}" không hợp lệ.`);
        }
    }

    return { errors, warnings };
}

/** Kiểm tra câu Đúng/Sai (cả dạng đơn lẫn dạng nhiều ý). */
function validateTrueFalse(question) {
    const errors = [];
    const statements = Array.isArray(question.statements) ? question.statements : [];

    if (statements.length) {
        const ids = statements.map(statement => String(statement.statementId || '').trim());
        if (ids.some(id => !id)) errors.push('Mỗi ý Đúng/Sai phải có statementId.');
        if (new Set(ids).size !== ids.length) errors.push('Có statementId bị trùng.');
        const missingAnswer = statements.filter(statement => typeof statement.correctAnswer !== 'boolean');
        if (missingAnswer.length) errors.push(`${missingAnswer.length} ý chưa xác định đáp án Đúng/Sai.`);
        return { errors, warnings: [] };
    }

    const answer = answerValueOf(question);
    if (answer === null || answer === undefined || answer === '') {
        errors.push('Câu Đúng/Sai phải có đáp án.');
        return { errors, warnings: [] };
    }
    if (typeof answer !== 'boolean' && !['đúng', 'sai', 'true', 'false'].includes(String(answer).toLowerCase())) {
        errors.push('Đáp án Đúng/Sai phải là true/false hoặc "Đúng"/"Sai".');
    }
    return { errors, warnings: [] };
}

/**
 * Kiểm tra câu điền khuyết — BẮT BUỘC có ít nhất một ô trống với đáp án.
 */
function validateFillBlank(question) {
    const errors = [];
    const warnings = [];
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];

    if (!blanks.length) {
        errors.push('Câu điền khuyết phải có ít nhất 1 ô trống.');
        return { errors, warnings };
    }

    const ids = blanks.map((blank, index) => String(blank.blankId || '').trim() || `blank-${index + 1}`);
    if (new Set(ids).size !== ids.length) errors.push('Có blankId bị trùng.');

    let autoGraded = 0;
    blanks.forEach((blank, index) => {
        const correctAnswers = Array.isArray(blank.correctAnswers)
            ? blank.correctAnswers.filter(text => String(text || '').trim())
            : [];
        if (!correctAnswers.length) {
            errors.push(`Ô ${index + 1} chưa có đáp án đúng.`);
        } else {
            autoGraded += 1;
            // Chuẩn hoá quá mạnh có thể làm hai đáp án khác nghĩa trùng nhau.
            if (blank.normalization?.stripDiacritics) {
                const distinct = new Set(correctAnswers.map(text => normalizer.normalize(text, {
                    trimWhitespace: true,
                    caseInsensitive: true,
                    stripDiacritics: true
                }))).size;
                if (distinct < correctAnswers.length) {
                    warnings.push(`Ô ${index + 1}: bỏ dấu làm nhiều đáp án trùng nhau — cân nhắc bỏ tuỳ chọn này.`);
                }
            }
        }
        if (blank.points !== null && blank.points !== undefined && Number(blank.points) < 0) {
            errors.push(`Ô ${index + 1} có điểm âm.`);
        }
    });

    if (autoGraded < blanks.length) {
        warnings.push(`${blanks.length - autoGraded} ô không có đáp án sẽ phải chấm tay.`);
    }

    return { errors, warnings };
}

/** Kiểm tra câu trả lời ngắn. */
function validateShortAnswer(question) {
    const errors = [];
    const warnings = [];
    const mode = question.gradingMode || GRADING_MODES.MANUAL;
    const accepted = acceptedAnswersOf(question);

    if (mode === GRADING_MODES.AUTO && !accepted.length) {
        errors.push('Chấm tự động câu trả lời ngắn cần ít nhất 1 đáp án chấp nhận.');
    }
    if (mode === GRADING_MODES.HYBRID && !accepted.length) {
        warnings.push('Chế độ hybrid mà không có đáp án chấp nhận thì mọi câu trả lời đều chờ người chấm.');
    }
    if (mode === GRADING_MODES.MANUAL) warnings.push('Câu này sẽ luôn cần người chấm.');
    if (question.normalization?.stripDiacritics) {
        warnings.push('Bỏ dấu khi so khớp có thể chấp nhận nhầm đáp án khác nghĩa.');
    }

    return { errors, warnings };
}

/** Kiểm tra câu số. */
function validateNumeric(question) {
    const errors = [];
    const warnings = [];
    const answer = answerValueOf(question);

    if (answer === null || answer === undefined || answer === '') {
        errors.push('Câu số phải có đáp án.');
    } else if (normalizer.normalizeNumber(answer) === null) {
        errors.push('Đáp án câu số không phải là số hợp lệ.');
    }

    const tolerance = Number(question.tolerance);
    if (Number.isFinite(tolerance) && tolerance > 0) warnings.push(`Chấp nhận sai số ±${tolerance}.`);
    if (question.minWords || question.maxWords) warnings.push('Câu số không dùng minWords/maxWords.');

    return { errors, warnings };
}

/** Kiểm tra câu tự luận + rubric. */
function validateEssay(question) {
    const errors = [];
    const warnings = [];
    const rubric = Array.isArray(question.rubric) ? question.rubric : [];
    const points = Number(question.points) || 0;

    // Tự luận KHÔNG được chấm tự động: bắt buộc gradingMode = manual.
    const mode = question.gradingMode || GRADING_MODES.MANUAL;
    if (mode !== GRADING_MODES.MANUAL) {
        errors.push('Câu tự luận bắt buộc để chế độ chấm là "Chấm tay" — máy không chấm được tự luận.');
    }

    if (rubric.length) {
        const ids = rubric.map(item => String(item.criterionId || '').trim());
        if (ids.some(id => !id)) errors.push('Mỗi tiêu chí rubric phải có criterionId.');
        if (new Set(ids).size !== ids.length) errors.push('Có criterionId bị trùng.');
        if (rubric.some(item => !String(item.description || '').trim())) {
            errors.push('Mỗi tiêu chí rubric phải có mô tả.');
        }
        const rubricTotal = rubric.reduce((sum, item) => sum + (Number(item.maxPoints) || 0), 0);
        if (points > 0 && Math.abs(rubricTotal - points) > 0.001) {
            errors.push(`Tổng điểm rubric (${rubricTotal}) không khớp điểm câu (${points}).`);
        }
    } else {
        warnings.push('Câu tự luận chưa có rubric — người chấm sẽ không có tiêu chí thống nhất.');
    }

    const minWords = Number(question.minWords);
    const maxWords = Number(question.maxWords);
    if (Number.isFinite(minWords) && Number.isFinite(maxWords) && minWords > maxWords) {
        errors.push('minWords không được lớn hơn maxWords.');
    }

    return { errors, warnings };
}

/**
 * Kiểm tra metadata gắn với chương trình (lớp / môn / bài / nguồn).
 * Trỏ tới thứ không có trong danh mục là LỖI, không phải cảnh báo.
 */
function validateCurriculumMetadata(question, { strictCurriculum = true } = {}) {
    const errors = [];
    const warnings = [];

    const grade = Number(question.grade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
        errors.push('Câu hỏi phải thuộc lớp 1-12.');
    }
    if (!question.subjectId) errors.push('Câu hỏi phải gắn với một môn học.');
    if (!question.source) warnings.push('Chưa ghi nguồn của câu hỏi.');

    if (!strictCurriculum) return { errors, warnings };

    // eslint-disable-next-line global-require
    const { hasSubjectInGrade, getSubject } = require('../../data/subjects/subject-registry');
    // eslint-disable-next-line global-require
    const curriculum = require('../../data/curriculum/curriculum-registry');

    if (question.subjectId && !getSubject(question.subjectId)) {
        errors.push(`Môn "${question.subjectId}" không có trong danh mục môn học.`);
    } else if (Number.isInteger(grade) && question.subjectId && !hasSubjectInGrade(question.subjectId, grade)) {
        errors.push(`Môn "${question.subjectId}" không thuộc lớp ${grade}.`);
    }

    if (question.lessonId && !curriculum.getLesson(question.lessonId)) {
        errors.push(`Bài học "${question.lessonId}" không có trong danh mục chương trình.`);
    }
    if (question.chapterId && !curriculum.getChapter(question.chapterId)) {
        errors.push(`Chương "${question.chapterId}" không có trong danh mục chương trình.`);
    }
    if (question.lessonId && question.chapterId) {
        const lesson = curriculum.getLesson(question.lessonId);
        if (lesson && lesson.chapterId && lesson.chapterId !== question.chapterId) {
            errors.push('Bài học không thuộc chương đã khai báo.');
        }
    }

    return { errors, warnings };
}

/**
 * Kiểm tra TOÀN BỘ một câu hỏi (kể cả khi tới từ DOCX hay từ API admin).
 *
 * @param {object} question
 * @param {object} [options] { strictCurriculum, requireMetadata }
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateQuestionDocument(question, {
    strictCurriculum = true,
    requireMetadata = true
} = {}) {
    const errors = [];
    const warnings = [];

    if (!question || typeof question !== 'object') {
        return { valid: false, errors: ['Câu hỏi không hợp lệ.'], warnings };
    }

    if (!TYPE_VALUES.includes(question.type)) {
        errors.push(`Loại câu hỏi "${question.type}" không hợp lệ.`);
        return { valid: false, errors, warnings };
    }

    if (!String(question.questionText || '').trim()) errors.push('Thiếu nội dung câu hỏi.');

    const points = Number(question.points);
    if (!Number.isFinite(points) || points <= 0) errors.push('Điểm của câu phải lớn hơn 0.');

    // ---- Phần riêng theo loại ----
    const optionResult = validateOptions(question);
    errors.push(...optionResult.errors);
    warnings.push(...optionResult.warnings);

    if (question.type === QUESTION_TYPES.SINGLE_CHOICE || question.type === QUESTION_TYPES.MULTIPLE_CHOICE) {
        const answerResult = validateChoiceAnswer(question);
        errors.push(...answerResult.errors);
        warnings.push(...answerResult.warnings);
    }

    const byType = {
        [QUESTION_TYPES.TRUE_FALSE]: validateTrueFalse,
        [QUESTION_TYPES.FILL_BLANK]: validateFillBlank,
        [QUESTION_TYPES.SHORT_ANSWER]: validateShortAnswer,
        [QUESTION_TYPES.NUMERIC]: validateNumeric,
        [QUESTION_TYPES.ESSAY]: validateEssay
    };
    const typeValidator = byType[question.type];
    if (typeValidator) {
        const result = typeValidator(question);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
    }

    if (requireMetadata) {
        const meta = validateCurriculumMetadata(question, { strictCurriculum });
        errors.push(...meta.errors);
        warnings.push(...meta.warnings);
    }

    if (question.needsReview) warnings.push('Câu hỏi đang ở trạng thái cần duyệt.');

    return { valid: errors.length === 0, errors, warnings };
}

/** Kiểm tra một danh sách câu hỏi, trả về bản tóm tắt để admin xem. */
function validateQuestionList(questions = [], options = {}) {
    const results = questions.map((question, index) => ({
        index,
        questionId: question.questionId ?? null,
        ...validateQuestionDocument(question, options)
    }));
    return {
        results,
        validCount: results.filter(item => item.valid).length,
        errorCount: results.filter(item => !item.valid).length,
        allValid: results.every(item => item.valid)
    };
}

/**
 * Kiểm tra câu trả lời học sinh gửi lên có ĐÚNG HÌNH DẠNG không.
 * Chỉ kiểm hình dạng — KHÔNG kiểm đúng/sai, việc đó của scoring service.
 *
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateStudentAnswerShape(questionType, answer) {
    const errors = [];
    const isMissing = answer === null || answer === undefined || answer === '';

    switch (questionType) {
        case QUESTION_TYPES.SINGLE_CHOICE:
            if (!isMissing && typeof answer !== 'string') errors.push('Câu một đáp án nhận chuỗi ký hiệu.');
            break;
        case QUESTION_TYPES.MULTIPLE_CHOICE:
            if (!isMissing && !Array.isArray(answer)) errors.push('Câu nhiều đáp án nhận mảng ký hiệu.');
            if (Array.isArray(answer) && answer.some(item => typeof item !== 'string')) {
                errors.push('Mảng ký hiệu phải toàn chuỗi.');
            }
            break;
        case QUESTION_TYPES.TRUE_FALSE:
            if (!isMissing && typeof answer !== 'boolean'
                && !['đúng', 'sai', 'true', 'false'].includes(String(answer).toLowerCase())) {
                errors.push('Câu Đúng/Sai nhận true/false.');
            }
            break;
        case QUESTION_TYPES.FILL_BLANK:
            if (!isMissing && (typeof answer !== 'object' || Array.isArray(answer))) {
                errors.push('Câu điền khuyết nhận object { blankId: đáp án }.');
            }
            break;
        case QUESTION_TYPES.SHORT_ANSWER:
            if (!isMissing && typeof answer !== 'string') errors.push('Câu trả lời ngắn nhận chuỗi.');
            break;
        case QUESTION_TYPES.NUMERIC:
            if (!isMissing && typeof answer !== 'number' && typeof answer !== 'string') {
                errors.push('Câu số nhận số hoặc chuỗi số.');
            }
            break;
        case QUESTION_TYPES.ESSAY:
            if (!isMissing && typeof answer !== 'string') errors.push('Câu tự luận nhận chuỗi.');
            if (typeof answer === 'string' && answer.length > 20000) {
                errors.push('Bài tự luận vượt quá độ dài cho phép.');
            }
            break;
        default:
            errors.push(`Không hỗ trợ chấm loại câu "${questionType}".`);
    }

    return { valid: errors.length === 0, errors };
}

module.exports = {
    TYPES_MANUAL_ONLY,
    TYPES_REQUIRING_ANSWER,
    TYPES_WITHOUT_OPTIONS,
    acceptedAnswersOf,
    answerValueOf,
    validateChoiceAnswer,
    validateCurriculumMetadata,
    validateEssay,
    validateFillBlank,
    validateNumeric,
    validateOptions,
    validateQuestionDocument,
    validateQuestionList,
    validateShortAnswer,
    validateStudentAnswerShape,
    validateTrueFalse
};