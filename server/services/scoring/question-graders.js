'use strict';

/**
 * Hàm chấm cho TỪNG LOẠI CÂU HỎI.
 *
 * Mỗi loại có đúng MỘT hàm `grade(question, givenAnswer, maxPoints)`.
 * Không gom vào một hàm if/else khổng lồ để có thể kiểm thử và sửa riêng từng dạng.
 *
 * Mọi hàm trả về cùng một cấu trúc:
 *   {
 *     isCorrect          : boolean  — học sinh có trả lời đúng không
 *     awardedPoints      : number   — điểm thực nhận (KHÔNG vượt quá maxPoints)
 *     maxPoints          : number
 *     needsManualGrading : boolean  — câu này có cần người chấm không
 *     manualScore        : number|null
 *     detail             : object   — thông tin phụ để hiển thị
 *   }
 */

const {
    QUESTION_TYPES,
    GRADING_MODES,
    MULTIPLE_CHOICE_MODES
} = require('../../config/constants');
const normalizer = require('../../utils/answer-normalizer');

/** Làm tròn điểm về 3 chữ số thập phân để cộng dồn không bị sai số. */
function roundPoints(value) {
    return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

/** Điểm tối đa hợp lệ. */
function toMaxPoints(points, fallback = 1) {
    const parsed = Number(points);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Học sinh có thực sự trả lời không (0 / false / "0" KHÔNG phải bỏ trống). */
function isBlank(givenAnswer) {
    if (givenAnswer === null || givenAnswer === undefined) return true;
    if (typeof givenAnswer === 'string') return givenAnswer.trim() === '';
    if (Array.isArray(givenAnswer)) return givenAnswer.length === 0;
    if (typeof givenAnswer === 'object') {
        return Object.values(givenAnswer).every(value => String(value ?? '').trim() === '');
    }
    return false;
}

/** Kết quả cho câu bị bỏ trống — dùng chung cho mọi loại. */
function blankResult(maxPoints) {
    return {
        isCorrect: false,
        awardedPoints: 0,
        maxPoints,
        needsManualGrading: false,
        manualScore: null,
        detail: { reason: 'BỎ_TRỐNG' }
    };
}

/** Câu chưa có đáp án đúng -> không bịa điểm, chuyển người chấm. */
function missingAnswerResult(maxPoints, reason) {
    return {
        isCorrect: false,
        awardedPoints: 0,
        maxPoints,
        needsManualGrading: true,
        manualScore: null,
        detail: { reason }
    };
}

// ---------------------------------------------------------------- TRẮC NGHIỆM 1 ĐÁP ÁN

/**
 * Chọn đúng MỘT ký hiệu: correctAnswer = "B".
 * Đúng hết điểm, sai hoặc bỏ trống = 0 điểm. Không có điểm âm.
 */
function gradeSingleChoice(question, givenAnswer, points) {
    const maxPoints = toMaxPoints(points);
    if (isBlank(givenAnswer)) return blankResult(maxPoints);

    const rules = { trimWhitespace: true, caseInsensitive: true };
    const raw = question.correctAnswer?.value ?? question.correctAnswer;
    const expected = normalizer.normalize(raw, rules);
    // Đề chưa có đáp án đúng -> KHÔNG bịa điểm, chuyển người chấm.
    if (!expected) return missingAnswerResult(maxPoints, 'THIẾU_ĐÁP_ÁN');

    const given = normalizer.normalize(givenAnswer, rules);
    const isCorrect = expected === given;
    return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        needsManualGrading: false,
        manualScore: null,
        detail: { given, expected }
    };
}

// ---------------------------------------------------------------- TRẮC NGHIỆM NHIỀU ĐÁP ÁN

/**
 * Chọn nhiều đáp án. CÓ HAI kiểu chấm, không hardcode một kiểu:
 *   - all_or_nothing : đúng và đủ mới được điểm.
 *   - partial_credit  : cộng điểm cho đáp án đúng đã chọn, TRỪ cho đáp án sai đã chọn,
 *                       KHÔNG trừ cho đáp án đúng bị bỏ trống.
 */
function gradeMultipleChoice(question, givenAnswer, points) {
    const maxPoints = toMaxPoints(points);
    if (isBlank(givenAnswer)) return blankResult(maxPoints);

    const rules = { trimWhitespace: true, caseInsensitive: true };
    // Sắp xếp cả hai về cùng thứ tự để thứ tự học sinh chọn không ảnh hưởng.
    const expected = normalizer.normalizeList(
        question.correctAnswer?.value ?? question.correctAnswers ?? question.correctAnswer,
        rules
    ).sort();
    const given = normalizer.normalizeList(givenAnswer, rules).sort();
    if (!expected.length) return missingAnswerResult(maxPoints, 'THIẾU_ĐÁP_ÁN');

    const mode = question.multipleChoiceMode
        || question.grading?.multipleChoiceMode
        || MULTIPLE_CHOICE_MODES.ALL_OR_NOTHING;

    const correctSet = new Set(expected);
    const wrongPicks = given.filter(label => !correctSet.has(label));

    if (mode === MULTIPLE_CHOICE_MODES.PARTIAL_CREDIT) {
        const perCorrect = maxPoints / expected.length;
        // Điểm phạt mỗi đáp án sai; mặc định bằng 1 điểm đúng (không chọt điểm).
        const configuredPenalty = Number(question.wrongAnswerPenalty);
        const penalty = Number.isFinite(configuredPenalty) && configuredPenalty >= 0
            ? configuredPenalty
            : perCorrect;
        const earned = (given.length - wrongPicks.length) * perCorrect - wrongPicks.length * penalty;
        const awarded = roundPoints(Math.max(0, Math.min(maxPoints, earned)));
        return {
            isCorrect: awarded >= maxPoints,
            awardedPoints: awarded,
            maxPoints,
            needsManualGrading: false,
            manualScore: null,
            detail: { mode, given, expected, wrongPicks, perCorrect, penalty }
        };
    }

    // all_or_nothing: đúng, đủ, không thừa.
    const isCorrect = given.length === expected.length
        && wrongPicks.length === 0
        && expected.every((label, index) => label === given[index]);
    return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        needsManualGrading: false,
        manualScore: null,
        detail: { mode, given, expected, wrongPicks }
    };
}

// ---------------------------------------------------------------- ĐÚNG / SAI

/** Đọc một giá trị thành boolean; trả null nếu không nhận dạng được. */
function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    const text = normalizer.normalize(value, { trimWhitespace: true, caseInsensitive: true });
    if (['đúng', 'true', 'dung', 'y', 'có', '1'].includes(text)) return true;
    if (['sai', 'false', 'khong', 'không', '0'].includes(text)) return false;
    return null;
}

/**
 * Đúng/Sai.
 *   - Dạng đơn: đáp án boolean true/false (hoặc "Đúng"/"Sai").
 *   - Dạng nhiều ý: `statements: [{ statementId, text, correctAnswer }]`,
 *     học sinh trả `{ "s1": true, "s2": false }`. Điểm chia đều từng ý.
 */
function gradeTrueFalse(question, givenAnswer, points) {
    const maxPoints = toMaxPoints(points);
    if (isBlank(givenAnswer)) return blankResult(maxPoints);

    const statements = Array.isArray(question.statements) ? question.statements : null;
    if (statements && statements.length) {
        const answerMap = (typeof givenAnswer === 'object' && !Array.isArray(givenAnswer))
            ? givenAnswer
            : null;
        if (!answerMap) return blankResult(maxPoints);

        const perStatement = maxPoints / statements.length;
        const results = statements.map((statement, index) => {
            const statementId = statement.statementId ?? statement.id ?? `s${index + 1}`;
            const given = parseBoolean(answerMap[statementId]);
            const expected = typeof statement.correctAnswer === 'boolean'
                ? statement.correctAnswer
                : parseBoolean(statement.correctAnswer);
            return {
                statementId,
                text: statement.text ?? '',
                given,
                expected,
                isCorrect: given !== null && expected !== null && given === expected
            };
        });

        const correctCount = results.filter(item => item.isCorrect).length;
        const awarded = roundPoints(results.reduce(
            (sum, item) => sum + (item.isCorrect ? perStatement : 0),
            0
        ));
        return {
            isCorrect: correctCount === results.length,
            awardedPoints: Math.min(maxPoints, awarded),
            maxPoints,
            needsManualGrading: false,
            manualScore: null,
            detail: { mode: 'multi_statement', statements: results, correctCount }
        };
    }

    const expected = typeof question.correctAnswer?.value === 'boolean'
        ? question.correctAnswer.value
        : parseBoolean(question.correctAnswer?.value ?? question.correctAnswer);
    if (expected === null) return missingAnswerResult(maxPoints, 'THIẾU_ĐÁP_ÁN');

    const given = parseBoolean(givenAnswer);
    const isCorrect = given !== null && given === expected;
    return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        needsManualGrading: false,
        manualScore: null,
        detail: { given, expected }
    };
}

// ---------------------------------------------------------------- ĐIỀN KHUYẾT

/**
 * Điền vào ô trống — MỘT hoặc NHIỀU ô.
 *
 *   questionText : "___ là thủ đô Việt Nam và ___ là thủ đô Pháp."
 *   blanks       : [{ blankId, position, correctAnswers, points, normalization }]
 *   studentAnswer: { "blank-1": "Hà Nội", "blank-2": "Paris" }
 *
 * Chấm TỪNG Ô rồi cộng dồn: một ô sai không làm mất điểm các ô khác.
 */
function gradeFillBlank(question, givenAnswer, points) {
    const maxPoints = toMaxPoints(points);
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];
    if (!blanks.length) return missingAnswerResult(maxPoints, 'THIẾU_Ô_TRỐNG');

    const answerMap = {};
    if (givenAnswer && typeof givenAnswer === 'object' && !Array.isArray(givenAnswer)) {
        Object.assign(answerMap, givenAnswer);
    } else if (Array.isArray(givenAnswer)) {
        blanks.forEach((blank, index) => {
            answerMap[blank.blankId ?? blank.id ?? `blank-${index + 1}`] = givenAnswer[index];
        });
    } else {
        answerMap[blanks[0].blankId ?? blanks[0].id ?? 'blank-1'] = givenAnswer;
    }

    // Điểm từng ô: dùng `blank.points` nếu khai báo, ngược lại chia đều điểm câu.
    const declaredTotal = blanks.reduce(
        (sum, blank) => sum + (Number.isFinite(Number(blank.points)) ? Number(blank.points) : 0),
        0
    );
    const useDeclared = declaredTotal > 0;

    const results = blanks.map((blank, index) => {
        const blankId = blank.blankId ?? blank.id ?? `blank-${index + 1}`;
        const blankPoints = useDeclared ? Number(blank.points) : roundPoints(maxPoints / blanks.length);
        const rules = blank.normalization || blank.normalizationRules || {};
        const accepted = Array.isArray(blank.correctAnswers)
            ? blank.correctAnswers
            : [blank.correctAnswers];
        const matched = normalizer.matchAccepted(answerMap[blankId], accepted, rules);
        return {
            blankId,
            position: blank.position ?? index + 1,
            points: blankPoints,
            isCorrect: matched !== null,
            matchedValue: matched
        };
    });

    const awarded = roundPoints(results.reduce(
        (sum, item) => sum + (item.isCorrect ? item.points : 0),
        0
    ));
    const cap = useDeclared ? roundPoints(declaredTotal) : maxPoints;

    return {
        isCorrect: results.every(item => item.isCorrect),
        awardedPoints: Math.min(cap, awarded),
        maxPoints: cap,
        needsManualGrading: false,
        manualScore: null,
        detail: { blanks: results, correctCount: results.filter(item => item.isCorrect).length }
    };
}

// ---------------------------------------------------------------- TRẢ LỜI NGẮN

/**
 * Trả lời ngắn.
 *   - auto   : so với `acceptedAnswers` đã chuẩn hoá, khớp là đúng.
 *   - manual : không bao giờ tự chấm.
 *   - hybrid : khớp -> điểm đầy đủ; không khớp -> chuyển người chấm (KHÔNG cho 0).
 *
 * Không tự động chấp nhận từ đồng nghĩa nếu chưa khai báo trong acceptedAnswers.
 */
function gradeShortAnswer(question, givenAnswer, points) {
    const maxPoints = toMaxPoints(points);
    const mode = question.gradingMode
        || question.grading?.mode
        || (question.acceptedAnswers?.length ? GRADING_MODES.AUTO : GRADING_MODES.MANUAL);

    if (mode === GRADING_MODES.MANUAL) {
        return {
            isCorrect: false,
            awardedPoints: 0,
            maxPoints,
            needsManualGrading: true,
            manualScore: null,
            detail: { mode }
        };
    }

    if (isBlank(givenAnswer)) {
        // Hybrid vẫn chuyển người chấm: học sinh có thể viết tắt ngoài dự kiến.
        return mode === GRADING_MODES.HYBRID
            ? {
                isCorrect: false,
                awardedPoints: 0,
                maxPoints,
                needsManualGrading: true,
                manualScore: null,
                detail: { mode, reason: 'BỎ_TRỐNG' }
            }
            : blankResult(maxPoints);
    }

    const rules = question.normalization || question.normalizationRules || {};
    const accepted = question.acceptedAnswers
        || (Array.isArray(question.correctAnswer?.value) ? question.correctAnswer.value : question.correctAnswer?.value);
    const matched = normalizer.matchAccepted(givenAnswer, accepted, rules);

    if (matched !== null) {
        return {
            isCorrect: true,
            awardedPoints: maxPoints,
            maxPoints,
            needsManualGrading: false,
            manualScore: null,
            detail: { mode, matched }
        };
    }

    if (mode === GRADING_MODES.HYBRID) {
        return {
            isCorrect: false,
            awardedPoints: 0,
            maxPoints,
            needsManualGrading: true,
            manualScore: null,
            detail: { mode, reason: 'KHÔNG_KHỚP_ĐÁP_ÁN' }
        };
    }

    return {
        isCorrect: false,
        awardedPoints: 0,
        maxPoints,
        needsManualGrading: false,
        manualScore: null,
        detail: { mode, matched: null }
    };
}

// ---------------------------------------------------------------- CÂU SỐ

/**
 * Trả lời bằng số.
 *   correctAnswer : 3.14
 *   tolerance     : 0.01    (sai số cho phép)
 *   unit          : "cm"    (gợi ý đơn vị, không bắt buộc)
 *
 * Chấp nhận "3,14" (phẩy thập phân kiểu Việt Nam) và "1.234,5".
 * Vượt tolerance -> sai. KHÔNG coi "gần đúng" là đúng.
 */
function gradeNumeric(question, givenAnswer, points) {
    const maxPoints = toMaxPoints(points);
    if (isBlank(givenAnswer)) return blankResult(maxPoints);

    const expected = normalizer.normalizeNumber(
        question.correctAnswer?.value ?? question.correctAnswer
    );
    const given = normalizer.normalizeNumber(givenAnswer);

    if (given === null) {
        return {
            isCorrect: false,
            awardedPoints: 0,
            maxPoints,
            needsManualGrading: false,
            manualScore: null,
            detail: { reason: 'KHÔNG_PHẢI_SỐ', given: String(givenAnswer).slice(0, 60) }
        };
    }
    if (expected === null) return missingAnswerResult(maxPoints, 'THIẾU_ĐÁP_ÁN');

    const configured = Number(question.tolerance ?? question.grading?.tolerance);
    const tolerance = Number.isFinite(configured) && configured >= 0 ? configured : 0;
    const isCorrect = Math.abs(given - expected) <= tolerance + Number.EPSILON;

    return {
        isCorrect,
        awardedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
        needsManualGrading: false,
        manualScore: null,
        detail: { given, expected, tolerance, difference: Math.abs(given - expected) }
    };
}

// ---------------------------------------------------------------- TỰ LUẬN

/** Đếm từ (xấp xỉ theo khoảng trắng — chỉ để cảnh báo, không quyết điểm). */
function countWords(text) {
    const trimmed = String(text ?? '').trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Tự luận. MÁY KHÔNG BAO GIỜ cho điểm tự luận.
 * Chỉ kiểm tra ràng buộc kỹ thuật để admin biết trước, kèm rubric cho người chấm.
 */
function gradeEssay(question, givenAnswer, points) {
    const maxPoints = toMaxPoints(points);
    const text = String(givenAnswer ?? '');
    const wordCount = countWords(text);

    const minWords = Number(question.minWords ?? question.grading?.minWords);
    const maxWords = Number(question.maxWords ?? question.grading?.maxWords);

    const warnings = [];
    if (wordCount === 0) warnings.push('Học sinh chưa trả lời câu này.');
    if (Number.isFinite(minWords) && minWords > 0 && wordCount > 0 && wordCount < minWords) {
        warnings.push(`Bài ngắn hơn tối thiểu (${wordCount}/${minWords} từ).`);
    }
    if (Number.isFinite(maxWords) && maxWords > 0 && wordCount > maxWords) {
        warnings.push(`Bài dài hơn tối đa (${wordCount}/${maxWords} từ).`);
    }

    return {
        isCorrect: false,
        awardedPoints: 0,
        maxPoints,
        needsManualGrading: true,
        manualScore: null,
        detail: {
            wordCount,
            characterCount: text.length,
            minWords: Number.isFinite(minWords) ? minWords : null,
            maxWords: Number.isFinite(maxWords) ? maxWords : null,
            rubric: Array.isArray(question.rubric) ? question.rubric : [],
            warnings
        }
    };
}

/** Bảng tra cứu hàm chấm theo loại câu hỏi. */
const GRADERS = Object.freeze({
    [QUESTION_TYPES.SINGLE_CHOICE]: gradeSingleChoice,
    [QUESTION_TYPES.MULTIPLE_CHOICE]: gradeMultipleChoice,
    [QUESTION_TYPES.TRUE_FALSE]: gradeTrueFalse,
    [QUESTION_TYPES.FILL_BLANK]: gradeFillBlank,
    [QUESTION_TYPES.SHORT_ANSWER]: gradeShortAnswer,
    [QUESTION_TYPES.NUMERIC]: gradeNumeric,
    [QUESTION_TYPES.ESSAY]: gradeEssay
});

/**
 * Chấm một câu bất kỳ bằng cách tra bảng, KHÔNG viết if/else dài.
 * Loại lạ -> không cho điểm, chuyển người chấm.
 */
function gradeByType(question, givenAnswer, maxPoints) {
    const grader = GRADERS[question?.type];
    if (!grader) {
        return {
            ...missingAnswerResult(toMaxPoints(maxPoints), 'LOẠI_CÂU_KHÔNG_HỖ_TRỢ'),
            detail: { reason: 'LOẠI_CÂU_KHÔNG_HỖ_TRỢ', type: question?.type ?? null }
        };
    }
    return grader(question, givenAnswer, maxPoints);
}

module.exports = {
    GRADERS,
    blankResult,
    countWords,
    gradeByType,
    gradeEssay,
    gradeFillBlank,
    gradeMultipleChoice,
    gradeNumeric,
    gradeShortAnswer,
    gradeSingleChoice,
    gradeTrueFalse,
    isBlank,
    missingAnswerResult,
    parseBoolean,
    roundPoints,
    toMaxPoints
};