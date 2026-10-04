'use strict';

/**
 * Kiểm thử CHẤM ĐIỂM cho đủ 7 dạng câu hỏi.
 * Đây là phần quan trọng nhất: điểm phải luôn do máy chủ quyết định.
 */

const scoring = require('../server/services/scoring.service');
const normalizer = require('../server/utils/answer-normalizer');

const { suite, runCase } = require('./harness');

/** Đề hỗn hợp đủ 7 dạng — dùng lại cho nhiều phép kiểm thử. */
const QUESTIONS = [
    { questionId: 'q1', type: 'single_choice', correctAnswer: { value: 'B' }, options: [{ label: 'A' }, { label: 'B' }] },
    { questionId: 'q2', type: 'multiple_choice', correctAnswer: { value: ['A', 'C'] } },
    { questionId: 'q3', type: 'true_false', correctAnswer: { value: true } },
    { questionId: 'q4', type: 'fill_blank', blanks: [{ blankId: 'b1', correctAnswers: ['Hà Nội'] }] },
    { questionId: 'q5', type: 'short_answer', gradingMode: 'auto', acceptedAnswers: ['15'] },
    { questionId: 'q6', type: 'numeric', correctAnswer: { value: 15 } },
    { questionId: 'q7', type: 'essay', gradingMode: 'manual', points: 3 }
];

// Điểm mỗi câu: sáu câu trắc nghiệm 1 điểm, câu tự luận 3 điểm — tổng 9 điểm.
const EXAM_ITEMS = [
    { questionId: 'q1', points: 1, order: 1 },
    { questionId: 'q2', points: 1, order: 2 },
    { questionId: 'q3', points: 1, order: 3 },
    { questionId: 'q4', points: 1, order: 4 },
    { questionId: 'q5', points: 1, order: 5 },
    { questionId: 'q6', points: 1, order: 6 },
    { questionId: 'q7', points: 3, order: 7 }
];
const TOTAL_POINTS = 9;
const AUTO_MAX_POINTS = 6;

const ALL_CORRECT = {
    q1: 'B', q2: ['A', 'C'], q3: true, q4: { b1: 'Hà Nội' }, q5: '15', q6: 15,
    q7: 'Bài tự luận dài...'
};

function testSingleChoice() {
    suite('Chấm điểm — trắc nghiệm một đáp án');

    runCase('đúng ký hiệu -> đủ điểm', (t) => {
        const r = scoring.gradeSingleChoice({ type: 'single_choice', correctAnswer: { value: 'B' } }, 'B', 2);
        t.equal(r.awardedPoints, 2, 'Đúng phải đủ điểm');
        t.ok(r.isCorrect, 'Phải đánh dấu đúng');
        t.ok(!r.needsManualGrading, 'Không cần người chấm');
    });

    runCase('sai ký hiệu -> 0 điểm', (t) => {
        const r = scoring.gradeSingleChoice({ type: 'single_choice', correctAnswer: { value: 'B' } }, 'A', 2);
        t.equal(r.awardedPoints, 0, 'Sai không được điểm');
    });

    runCase('bỏ trống -> 0 điểm', (t) => {
        const r = scoring.gradeSingleChoice({ type: 'single_choice', correctAnswer: { value: 'B' } }, '', 2);
        t.equal(r.awardedPoints, 0, 'Bỏ trống không được điểm');
        t.equal(r.detail.reason, 'BỎ_TRỐNG', 'Phải ghi rõ lý do');
    });

    runCase('thừa khoảng trắng vẫn khớp', (t) => {
        const r = scoring.gradeSingleChoice({ type: 'single_choice', correctAnswer: { value: 'B' } }, ' b ', 1);
        t.ok(r.isCorrect, 'Khoảng trắng thừa không được làm sai');
    });

    runCase('chưa có đáp án đúng -> chờ người chấm', (t) => {
        const r = scoring.gradeSingleChoice({ type: 'single_choice', correctAnswer: null }, 'B', 1);
        t.ok(r.needsManualGrading, 'Không có đáp án thì tuyệt đối không bịa điểm');
        t.equal(r.awardedPoints, 0, 'Không cho điểm');
    });
}

function testMultipleChoice() {
    suite('Chấm điểm — trắc nghiệm nhiều đáp án');
    const q = {
        type: 'multiple_choice',
        correctAnswer: { value: ['A', 'C'] },
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }]
    };

    runCase('all_or_nothing: đúng và đủ -> đủ điểm', (t) => {
        t.equal(scoring.gradeMultipleChoice(q, ['A', 'C'], 2).awardedPoints, 2, 'Chọn đúng và đủ');
    });

    runCase('all_or_nothing: thừa một đáp án -> 0 điểm', (t) => {
        t.equal(scoring.gradeMultipleChoice(q, ['A', 'B', 'C'], 2).awardedPoints, 0, 'Chọn thừa mất hết điểm');
    });

    runCase('all_or_nothing: thiếu một đáp án -> 0 điểm', (t) => {
        t.equal(scoring.gradeMultipleChoice(q, ['A'], 2).awardedPoints, 0, 'Chọn thiếu mất hết điểm');
    });

    runCase('partial_credit: chọn đúng một nửa -> được nửa điểm', (t) => {
        const partial = { ...q, multipleChoiceMode: 'partial_credit' };
        t.closeTo(scoring.gradeMultipleChoice(partial, ['A'], 2).awardedPoints, 1, 0.001, '1/2 đáp án đúng');
    });

    runCase('partial_credit: đúng một + sai một -> bằng 0', (t) => {
        const partial = { ...q, multipleChoiceMode: 'partial_credit' };
        t.closeTo(scoring.gradeMultipleChoice(partial, ['A', 'B'], 2).awardedPoints, 0, 0.001, '1 đúng + 1 sai = 0');
    });

    runCase('partial_credit: không bao giờ xuống dưới 0', (t) => {
        const partial = { ...q, multipleChoiceMode: 'partial_credit' };
        t.ok(scoring.gradeMultipleChoice(partial, ['B', 'D'], 2).awardedPoints >= 0, 'Điểm không âm');
    });

    runCase('thứ tự chọn không ảnh hưởng kết quả', (t) => {
        t.ok(scoring.gradeMultipleChoice(q, ['C', 'A'], 2).isCorrect, 'C,A giống A,C');
    });
}

function testTrueFalse() {
    suite('Chấm điểm — Đúng/Sai');

    runCase('đơn: trả lời đúng', (t) => {
        const r = scoring.gradeTrueFalse({ type: 'true_false', correctAnswer: { value: true } }, true, 1);
        t.equal(r.awardedPoints, 1, 'Trả lời đúng phải đủ điểm');
    });

    runCase('đơn: chấp nhận chuỗi "Đúng"', (t) => {
        const r = scoring.gradeTrueFalse({ type: 'true_false', correctAnswer: { value: true } }, 'Đúng', 1);
        t.ok(r.isCorrect, 'Chuỗi "Đúng" phải được hiểu là true');
    });

    runCase('đơn: trả lời sai', (t) => {
        const r = scoring.gradeTrueFalse({ type: 'true_false', correctAnswer: { value: false } }, true, 1);
        t.equal(r.awardedPoints, 0, 'Sai không được điểm');
    });

    const multiStatement = {
        type: 'true_false',
        statements: [
            { statementId: 's1', text: 'ý 1', correctAnswer: true },
            { statementId: 's2', text: 'ý 2', correctAnswer: false }
        ]
    };

    runCase('nhiều ý: đúng cả hai -> đủ điểm', (t) => {
        const r = scoring.gradeTrueFalse(multiStatement, { s1: true, s2: false }, 2);
        t.equal(r.awardedPoints, 2, 'Đúng 2/2 ý được 2 điểm');
        t.equal(r.detail.mode, 'multi_statement', 'Phải nhận dạng dạng nhiều ý');
    });

    runCase('nhiều ý: đúng một ý -> nửa điểm', (t) => {
        const r = scoring.gradeTrueFalse(multiStatement, { s1: true, s2: true }, 2);
        t.closeTo(r.awardedPoints, 1, 0.001, 'Đúng 1/2 ý');
        t.ok(!r.isCorrect, 'Chưa đúng hết thì chưa đạt');
    });
}

function testFillBlank() {
    suite('Chấm điểm — điền khuyết');
    const q = {
        type: 'fill_blank',
        blanks: [{
            blankId: 'b1',
            correctAnswers: ['Hà Nội', 'Ha Noi'],
            normalization: { trimWhitespace: true, caseInsensitive: true }
        }]
    };

    runCase('đúng ô -> đủ điểm', (t) => {
        t.equal(scoring.gradeFillBlank(q, { b1: 'Hà Nội' }, 1).awardedPoints, 1, 'Điền đúng');
    });

    runCase('đáp án tương đương "ha noi" được chấp nhận', (t) => {
        t.equal(scoring.gradeFillBlank(q, { b1: 'ha noi' }, 1).awardedPoints, 1, 'caseInsensitive đã bật');
    });

    runCase('sai ô -> 0 điểm', (t) => {
        t.equal(scoring.gradeFillBlank(q, { b1: 'Sài Gòn' }, 1).awardedPoints, 0, 'Điền sai');
    });

    runCase('không bỏ dấu mặc định -> "Hà noi" vẫn sai', (t) => {
        const strict = { type: 'fill_blank', blanks: [{ blankId: 'b1', correctAnswers: ['Hà Nội'] }] };
        t.equal(scoring.gradeFillBlank(strict, { b1: 'Hà noi' }, 1).awardedPoints, 0, 'Phải đúng tuyệt đối');
    });

    const twoBlanks = {
        type: 'fill_blank',
        blanks: [
            { blankId: 'b1', correctAnswers: ['Đông'], points: 0.5 },
            { blankId: 'b2', correctAnswers: ['Tây'], points: 0.5 }
        ]
    };

    runCase('nhiều ô: chấm từng ô và cộng dồn', (t) => {
        const r = scoring.gradeFillBlank(twoBlanks, { b1: 'Đông', b2: 'Nam' }, 1);
        t.closeTo(r.awardedPoints, 0.5, 0.001, 'Đúng 1/2 ô');
        t.equal(r.detail.blanks.length, 2, 'Phải có kết quả từng ô');
    });

    runCase('nhiều ô: đúng cả hai -> đủ 1 điểm', (t) => {
        const r = scoring.gradeFillBlank(twoBlanks, { b1: 'Đông', b2: 'Tây' }, 1);
        t.closeTo(r.awardedPoints, 1, 0.001, 'Đúng cả hai ô');
        t.ok(r.isCorrect, 'Đúng hết phải đánh dấu đúng');
    });

    runCase('chấp nhận mảng theo thứ tự ô', (t) => {
        t.equal(scoring.gradeFillBlank(q, ['Hà Nội'], 1).awardedPoints, 1, 'UI gửi mảng cũng chấm được');
    });
}

function testShortAnswer() {
    suite('Chấm điểm — trả lời ngắn');

    runCase('auto: khớp một đáp án chấp nhận', (t) => {
        const q = {
            type: 'short_answer',
            gradingMode: 'auto',
            acceptedAnswers: ['2,3,5,7'],
            normalization: { collapseSeparators: true }
        };
        t.equal(scoring.gradeShortAnswer(q, '2; 3; 5; 7', 2).awardedPoints, 2, 'Các cách viết khác nhau');
    });

    runCase('auto: ngoài danh sách -> sai', (t) => {
        const q = { type: 'short_answer', gradingMode: 'auto', acceptedAnswers: ['2,3,5,7'] };
        t.equal(scoring.gradeShortAnswer(q, 'Hồ Chí Minh', 2).awardedPoints, 0, 'Không đoán đáp án');
    });

    runCase('manual: không bao giờ tự chấm', (t) => {
        const q = { type: 'short_answer', gradingMode: 'manual', acceptedAnswers: ['abc'] };
        const r = scoring.gradeShortAnswer(q, 'abc', 2);
        t.ok(r.needsManualGrading, 'Chế độ manual chờ người chấm');
        t.equal(r.awardedPoints, 0, 'Máy không được cho điểm');
    });

    runCase('hybrid: khớp -> đủ điểm, không cần người chấm', (t) => {
        const q = {
            type: 'short_answer',
            gradingMode: 'hybrid',
            acceptedAnswers: ['Nguyễn Trãi'],
            normalization: { caseInsensitive: true, stripDiacritics: true }
        };
        const r = scoring.gradeShortAnswer(q, 'nguyen trai', 2);
        t.equal(r.awardedPoints, 2, 'Hybrid khớp được điểm đầy đủ');
        t.ok(!r.needsManualGrading, 'Không chuyển người chấm');
    });

    runCase('hybrid: không khớp -> chờ người chấm', (t) => {
        const q = { type: 'short_answer', gradingMode: 'hybrid', acceptedAnswers: ['Nguyễn Trãi'] };
        const r = scoring.gradeShortAnswer(q, 'không liên quan', 2);
        t.ok(r.needsManualGrading, 'Phải chuyển người chấm');
        t.equal(r.awardedPoints, 0, 'Chưa chấm thì chưa kết luận sai');
    });
}

function testNumeric() {
    suite('Chấm điểm — câu số');

    runCase('đúng tuyệt đối', (t) => {
        t.ok(scoring.gradeNumeric({ type: 'numeric', correctAnswer: { value: 10 } }, 10, 1).isCorrect, 'Bằng nhau tuyệt đối');
    });

    runCase('chấp nhận dấu phẩy thập phân kiểu Việt Nam', (t) => {
        t.ok(scoring.gradeNumeric({ type: 'numeric', correctAnswer: { value: 3.14 } }, '3,14', 1).isCorrect, '"3,14" = 3.14');
    });

    runCase('nằm trong tolerance -> đúng', (t) => {
        const q = { type: 'numeric', correctAnswer: { value: 3.14 }, tolerance: 0.01 };
        t.ok(scoring.gradeNumeric(q, 3.141, 1).isCorrect, '3.141 trong ±0.01 của 3.14');
    });

    runCase('vượt tolerance -> sai', (t) => {
        const q = { type: 'numeric', correctAnswer: { value: 3.14 }, tolerance: 0.01 };
        t.ok(!scoring.gradeNumeric(q, 3.2, 1).isCorrect, '3.2 vượt xa tolerance');
    });

    runCase('tolerance = 0 thì phải chính xác tuyệt đối', (t) => {
        const q = { type: 'numeric', correctAnswer: { value: 3.14 } };
        t.ok(!scoring.gradeNumeric(q, 3.141, 1).isCorrect, 'Không có tolerance thì tuyệt đối');
    });

    runCase('nhập chữ -> sai, không phải lỗi hệ thống', (t) => {
        const r = scoring.gradeNumeric({ type: 'numeric', correctAnswer: { value: 10 } }, 'mười', 1);
        t.equal(r.awardedPoints, 0, 'Chữ không phải số');
        t.equal(r.detail.reason, 'KHÔNG_PHẢI_SỐ', 'Ghi rõ lý do');
    });

    runCase('số nghìn kiểu Việt Nam: "1.234,5"', (t) => {
        const r = scoring.gradeNumeric({ type: 'numeric', correctAnswer: { value: 1234.5 } }, '1.234,5', 1);
        t.ok(r.isCorrect, 'Dấu chấm là phân cách nghìn');
    });
}

function testEssay() {
    suite('Chấm điểm — tự luận');
    const q = {
        type: 'essay',
        gradingMode: 'manual',
        points: 5,
        minWords: 50,
        maxWords: 500,
        rubric: [
            { criterionId: 'c01', description: 'Ý 1', maxPoints: 2 },
            { criterionId: 'c02', description: 'Ý 2', maxPoints: 3 }
        ]
    };

    runCase('tự luận KHÔNG BAO GIỜ tự cho điểm', (t) => {
        const r = scoring.gradeEssay(q, 'Bài viết dài của học sinh...', 5);
        t.equal(r.awardedPoints, 0, 'Máy không được cho điểm tự luận');
        t.ok(r.needsManualGrading, 'Bắt buộc chấm tay');
    });

    runCase('đếm số từ và trả về rubric', (t) => {
        const r = scoring.gradeEssay(q, 'mot hai ba bon nam', 5);
        t.equal(r.detail.wordCount, 5, 'Phải đếm được số từ');
        t.equal(r.detail.rubric.length, 2, 'Phải trả rubric cho người chấm');
    });

    runCase('cảnh báo khi bài ngắn hơn tối thiểu', (t) => {
        const r = scoring.gradeEssay(q, 'ngắn quá', 5);
        t.ok(r.detail.warnings.some(w => w.includes('ngắn hơn tối thiểu')), 'Cảnh báo bài quá ngắn');
    });

    runCase('cảnh báo khi bài dài hơn tối đa', (t) => {
        const r = scoring.gradeEssay(q, new Array(600).fill('từ').join(' '), 5);
        t.ok(r.detail.warnings.some(w => w.includes('dài hơn tối đa')), 'Cảnh báo bài quá dài');
    });

    runCase('bỏ trống vẫn chuyển người chấm', (t) => {
        t.ok(scoring.gradeEssay(q, '', 5).needsManualGrading, 'Người chấm quyết định 0 điểm');
    });
}

function testNormalization() {
    suite('Chuẩn hoá câu trả lời');

    runCase('mặc định KHÔNG bỏ dấu', (t) => {
        t.equal(normalizer.normalize('Hà Nội'), 'Hà Nội', 'Mặc định giữ nguyên dấu');
    });

    runCase('bật caseInsensitive thì hạ chữ thường', (t) => {
        t.equal(normalizer.normalize('HÀ NỘI', { caseInsensitive: true }), 'hà nội', 'Đã bật tuỳ chọn');
    });

    runCase('bật stripDiacritics thì bỏ dấu', (t) => {
        t.equal(normalizer.normalize('Hà Nội', { stripDiacritics: true, caseInsensitive: true }), 'ha noi', 'Đã bỏ dấu');
    });

    runCase('không làm hai đáp án khác nghĩa trùng nhau', (t) => {
        t.notEqual(normalizer.normalize('x + 1'), normalizer.normalize('x - 1'), 'Dấu + và - khác nhau');
    });

    runCase('loại trùng khi chuẩn hoá danh sách', (t) => {
        t.deepEqual(normalizer.normalizeList(['b', 'a', 'b']), ['b', 'a'], 'Loại trùng, giữ thứ tự');
    });
}

function testMixedExam() {
    suite('Chấm cả đề hỗn hợp — 7 dạng trong một bài');

    runCase('6 câu auto + 1 câu chờ chấm', (t) => {
        const r = scoring.gradeExam(QUESTIONS, ALL_CORRECT, {}, EXAM_ITEMS);
        t.equal(r.autoScore, AUTO_MAX_POINTS, 'Sáu câu tự chấm đều đúng');
        t.equal(r.manualGradingQuestions, 1, 'Một câu tự luận chờ chấm');
        t.equal(r.gradingStatus, 'pending_manual_grading', 'Chưa xong thì chưa kết luận');
        t.equal(r.finalScoreStatus, 'pending', 'Điểm cuối chưa chốt');
        t.equal(r.autoScoredPercent, 100, 'Phần điểm máy chấm là 100%');
        t.equal(r.totalPoints, TOTAL_POINTS, 'Tổng điểm đề');
        t.equal(r.autoScoredPercent, 100, 'Sáu trên sáu điểm tự chấm');
        t.equal(r.autoScoredQuestions, 6, 'Sáu câu tự chấm');
    });

    runCase('sau khi chấm tay -> điểm cuối cùng', (t) => {
        const base = scoring.gradeExam(QUESTIONS, ALL_CORRECT, {}, EXAM_ITEMS);
        const final = scoring.finalizeScores(base, { q7: 2.5 });
        t.closeTo(final.manualScore, 2.5, 0.001, 'Điểm người chấm');
        t.closeTo(final.totalScore, 8.5, 0.001, 'Tổng = 6 + 2.5');
        t.equal(final.gradingStatus, 'graded', 'Đã chấm xong');
        t.equal(final.finalScoreStatus, 'final', 'Điểm cuối đã chốt');
        t.closeTo(final.scorePercent, 94.4, 0.1, 'Phần trăm tính trên tổng 9 điểm');
    });

    runCase('còn câu chưa chấm -> vẫn pending', (t) => {
        const base = scoring.gradeExam(QUESTIONS, {}, {}, EXAM_ITEMS);
        t.equal(scoring.finalizeScores(base, {}).gradingStatus, 'pending_manual_grading', 'Chưa chấm thì chưa xong');
    });

    runCase('điểm tổng không bao giờ vượt quá điểm đề', (t) => {
        const base = scoring.gradeExam(QUESTIONS, ALL_CORRECT, {}, EXAM_ITEMS);
        // Admin nhập 99 điểm cho câu tự luận chỉ được 3 điểm -> phải bị chặn trên.
        const final = scoring.finalizeScores(base, { q7: 99 });
        t.ok(final.totalScore <= final.totalPoints, 'Không vượt tổng điểm');
        t.closeTo(final.totalScore, TOTAL_POINTS, 0.001, 'Bị chặn đúng bằng tổng điểm');
    });

    runCase('sai câu thì không có điểm', (t) => {
        const r = scoring.gradeExam(QUESTIONS, { q1: 'A', q2: ['A'], q3: false, q6: 16 }, {}, EXAM_ITEMS);
        t.equal(r.autoScore, 0, 'Không câu nào đúng');
        t.equal(r.correctQuestions, 0, 'Số câu đúng bằng 0');
        t.equal(r.answeredQuestions, 4, 'Bốn câu có trả lời');
    });

    runCase('chấp nhận answers dạng mảng', (t) => {
        const r = scoring.gradeExam(QUESTIONS, [{ questionId: 'q1', answer: 'B' }], {}, EXAM_ITEMS);
        t.equal(r.correctQuestions, 1, 'Phải đọc được dạng mảng');
    });

    suite('Tra cứu nhanh');

    runCase('isAnswerCorrect dùng đúng bảng chấm', (t) => {
        t.ok(scoring.isAnswerCorrect({ type: 'single_choice', correctAnswer: { value: 'A' } }, 'A'), 'Đúng');
        t.ok(!scoring.isAnswerCorrect({ type: 'single_choice', correctAnswer: { value: 'A' } }, 'B'), 'Sai');
    });

    runCase('summarizeTypes đếm đủ 7 loại', (t) => {
        const summary = scoring.summarizeTypes(QUESTIONS);
        t.equal(Object.keys(summary).length, 7, 'Phải có đủ 7 khoá loại');
        t.equal(summary.essay, 1, 'Một câu tự luận');
    });

    runCase('loại câu lạ -> không cho điểm, chuyển người chấm', (t) => {
        const r = scoring.gradeByType({ type: 'khong_ton_tai' }, 'x', 1);
        t.ok(r.needsManualGrading, 'Loại lạ không chấm tự động');
        t.equal(r.awardedPoints, 0, 'Không cho điểm');
    });
}

function run() {
    testSingleChoice();
    testMultipleChoice();
    testTrueFalse();
    testFillBlank();
    testShortAnswer();
    testNumeric();
    testEssay();
    testNormalization();
    testMixedExam();
}

module.exports = { run };