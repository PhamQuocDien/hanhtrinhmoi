'use strict';

/**
 * Kiểm thử pipeline DOCX: đọc tệp -> nhận diện câu -> nhận diện loại -> ô trống
 * -> đáp án -> rubric -> kiểm tra hợp lệ.
 *
 * Dùng tệp .docx thật dựng bằng ZIP chuẩn, nên chính parser phải đọc được
 * chứ không mock kết quả.
 */

const { importDocx } = require('../server/services/docx-import.service');
const { buildSampleFiles } = require('./fixtures/make-sample-docx');
const { detectBlanks, detectSubStatements, findBlankMarkers } = require('../server/parsers/docx/blank-detector');
const { parseCriteria, totalRubricPoints } = require('../server/parsers/docx/rubric-detector');
const { detectQuestionType, looksNumeric, countBlanks } = require('../server/parsers/docx/question-type-detector');

const { suite, runCase } = require('./harness');

const SAMPLE = buildSampleFiles();

function testQuestionTypes() {
    suite('DOCX — nhận diện loại câu hỏi');

    runCase('có lựa chọn + đáp án một ký hiệu -> single_choice', (t) => {
        const r = detectQuestionType({
            text: 'Tính 2 + 2 bằng:',
            options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
            answer: 'B'
        });
        t.equal(r.type, 'single_choice', 'Loại câu');
        t.ok(!r.needsReview, 'Không cần admin xác nhận');
    });

    runCase('có lựa chọn + đáp án nhiều ký hiệu -> multiple_choice', (t) => {
        const r = detectQuestionType({
            text: 'Chọn các số chia hết cho 3.',
            options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
            answer: ['A', 'C']
        });
        t.equal(r.type, 'multiple_choice', 'Loại câu');
    });

    runCase('có dấu ô trống -> fill_blank', (t) => {
        t.equal(detectQuestionType({ text: 'Thủ đô là ______.' }).type, 'fill_blank', 'Loại câu');
    });

    runCase('câu yêu cầu phân tích -> essay', (t) => {
        const r = detectQuestionType({ text: 'Hãy phân tích nguyên nhân của hiện tượng này.' });
        t.equal(r.type, 'essay', 'Loại câu');
        t.ok(!r.needsReview, 'Tín hiệu rõ');
    });

    runCase('đáp án là số -> numeric', (t) => {
        t.equal(detectQuestionType({ text: 'Tính 3 x 5.', answer: '15' }).type, 'numeric', 'Loại câu');
    });

    runCase('không lựa chọn + có đáp án ngắn -> short_answer', (t) => {
        const r = detectQuestionType({ text: 'Hãy nêu tên thủ đô Việt Nam.', answer: 'Hà Nội' });
        t.equal(r.type, 'short_answer', 'Loại câu');
        t.ok(!r.needsReview, 'Có cụm "hãy nêu" nên rõ');
    });

    runCase('không tín hiệu nào -> essay + cần duyệt (KHÔNG ĐOÁN)', (t) => {
        const r = detectQuestionType({ text: 'Một câu hỏi không rõ loại.' });
        t.equal(r.type, 'essay', 'Gán loại an toàn');
        t.ok(r.needsReview, 'Bắt buộc admin xác nhận');
        t.equal(r.confidence, 'low', 'Độ tin cậy thấp');
    });

    runCase('nhận dạng số: 15, 3.14, 50%, 2/3', (t) => {
        t.ok(looksNumeric('15'), 'Số nguyên');
        t.ok(looksNumeric('3.14'), 'Số thập phân');
        t.ok(looksNumeric('50%'), 'Phần trăm');
        t.ok(looksNumeric('2/3'), 'Phân số');
        t.ok(!looksNumeric('Hà Nội'), 'Chữ không phải số');
    });
}

function testBlankDetection() {
    suite('DOCX — nhận diện ô trống');

    runCase('ba dạng dấu ô trống đều nhận dạng được', (t) => {
        t.equal(countBlanks('là ______.').count, 1, 'Gạch dưới');
        t.equal(countBlanks('là ............').count, 1, 'Chấm lửng');
        t.equal(countBlanks('là _____').count, 1, 'Gạch ngắn');
    });

    runCase('KHÔNG nhận nhầm phép trừ', (t) => {
        t.equal(countBlanks('Tính 5 - 3 bằng mấy?').count, 0, 'Dấu gạch toán không phải ô trống');
    });

    runCase('KHÔNG nhận nhầm gạch nối từ', (t) => {
        t.equal(countBlanks('Thủ đô Hà-Nội nằm ở miền Bắc.').count, 0, 'Gạch nối không phải ô trống');
    });

    runCase('hai ô trống trong một câu', (t) => {
        t.equal(countBlanks('mọc ở ______ và lặn ở ______.').count, 2, 'Hai ô');
    });

    runCase('dựng được danh sách ô với điểm chia đều', (t) => {
        const r = detectBlanks('___ là thủ đô Việt Nam và ___ là thủ đô Pháp.', { totalPoints: 1 });
        t.equal(r.blanks.length, 2, 'Hai ô');
        t.closeTo(r.blanks[0].points, 0.5, 0.001, 'Chia đều điểm');
        t.equal(r.blanks[0].blankId, 'blank-1', 'Khoá ô ổn định');
        t.includes(r.replacedText, '[[blank-1]]', 'Thay bằng placeholder cho UI');
    });

    runCase('ô không có đáp án -> cảnh báo, KHÔNG đoán', (t) => {
        const r = detectBlanks('Thủ đô là ______.');
        t.equal(r.blanks[0].correctAnswers.length, 0, 'Để trống, không bịa');
        t.ok(r.warnings.some(w => w.includes('không đoán')), 'Phải cảnh báo admin');
    });

    runCase('ô có đáp án thì lấy vào', (t) => {
        const r = detectBlanks('Thủ đô là ______.', { answers: { 'blank-1': 'Hà Nội' } });
        t.deepEqual(r.blanks[0].correctAnswers, ['Hà Nội'], 'Đáp án được giữ');
    });

    runCase('không có dấu ô trống -> mảng rỗng kèm cảnh báo', (t) => {
        const r = detectBlanks('Câu không có ô trống.');
        t.equal(r.blanks.length, 0, 'Không tự tạo ô trống');
        t.ok(r.warnings.length > 0, 'Phải cảnh báo');
    });

    runCase('mặc định KHÔNG bật caseInsensitive cho ô', (t) => {
        t.equal(detectBlanks('là ______.').blanks[0].normalization.caseInsensitive, false, 'Mặc định nghiêm ngặt');
    });
}

function testRubricDetection() {
    suite('DOCX — nhận diện rubric tự luận');

    runCase('đọc được tiêu chí "Ý 1: 2 điểm"', (t) => {
        const r = parseCriteria(['- Ý 1: 2 điểm', '- Ý 2: 3 điểm']);
        t.equal(r.length, 2, 'Hai tiêu chí');
        t.equal(r[0].description, 'Ý 1', 'Mô tả');
        t.equal(r[0].maxPoints, 2, 'Điểm');
        t.equal(totalRubricPoints(r), 5, 'Tổng 5 điểm');
    });

    runCase('đọc được dạng ngoặc "Lập luận (2 điểm)"', (t) => {
        const r = parseCriteria(['- Lập luận (2 điểm)']);
        t.equal(r[0].description, 'Lập luận', 'Mô tả');
        t.equal(r[0].maxPoints, 2, 'Điểm');
    });

    runCase('đọc được dạng gộp nhiều tiêu chí trên một dòng', (t) => {
        const r = parseCriteria(['Ý 1 (2đ), Lập luận (1đ), Trình bày (1,5đ)']);
        t.equal(r.length, 3, 'Ba tiêu chí');
        t.closeTo(totalRubricPoints(r), 4.5, 0.001, 'Tổng 4.5 điểm');
    });

    runCase('không có rubric -> mảng rỗng, KHÔNG bịa', (t) => {
        t.equal(parseCriteria([]).length, 0, 'Không tự tạo tiêu chí');
    });
}

function testFullPipeline() {
    suite('DOCX — đọc tệp thật đủ 7 dạng câu hỏi');

    let result = null;

    runCase('đọc được đủ 10 câu từ tệp .docx', (t) => {
        result = importDocx(SAMPLE.mixedExam, { grade: 8, subjectId: 'toan' });
        t.equal(result.questionCount, 10, 'Đọc đủ 10 câu');
        t.ok(result.questionCount >= 10, 'Không bỏ sót câu');
    });

    runCase('phân loại đúng: 2 trắc nghiệm 1 đáp án', (t) => {
        t.equal(result.questions[0].type, 'single_choice', 'Câu 1');
        t.equal(result.questions[1].type, 'single_choice', 'Câu 2');
    });

    runCase('phân loại đúng: 1 trắc nghiệm nhiều đáp án', (t) => {
        t.equal(result.questions[2].type, 'multiple_choice', 'Câu 3');
        t.deepEqual(result.questions[2].correctAnswer, ['A', 'C'], 'Đáp án nhiều ký hiệu');
    });

    runCase('phân loại đúng: 1 câu điền khuyết nhiều ô', (t) => {
        const q = result.questions[3];
        t.equal(q.type, 'fill_blank', 'Câu 4 là điền khuyết');
        t.equal(q.blanks.length, 2, 'Nhận dạng được 2 ô trống');
    });

    runCase('phân loại đúng: 1 câu điền khuyết một ô', (t) => {
        const q = result.questions[4];
        t.equal(q.type, 'fill_blank', 'Câu 5');
        t.equal(q.blanks.length, 1, 'Một ô trống');
    });

    runCase('phân loại đúng: câu Đúng/Sai', (t) => {
        const q = result.questions[6];
        t.equal(q.type, 'true_false', 'Câu 7 là Đúng/Sai');
        t.ok(q.correctAnswer === true || q.correctAnswer === false, 'Đáp án phải là boolean');
    });

    runCase('phân loại đúng: câu số', (t) => {
        const q = result.questions[7];
        t.equal(q.type, 'numeric', 'Câu 8 là câu số');
        t.equal(String(q.correctAnswer), '11', 'Đáp án 11');
    });

    runCase('phân loại đúng: 2 câu tự luận có rubric', (t) => {
        t.equal(result.questions[8].type, 'essay', 'Câu 9');
        t.ok(result.questions[8].rubric.length >= 2, 'Có rubric');
        t.equal(result.questions[9].type, 'essay', 'Câu 10');
        t.ok(result.questions[9].rubric.length >= 2, 'Có rubric');
    });

    runCase('tổng hợp số câu theo loại trả về đủ 7 khoá', (t) => {
        t.equal(Object.keys(result.typeSummary).length, 7, 'Phải có đủ 7 loại');
        t.equal(result.typeSummary.single_choice, 2, '2 trắc nghiệm 1 đáp án');
        t.equal(result.typeSummary.multiple_choice, 1, '1 trắc nghiệm nhiều đáp án');
        t.equal(result.typeSummary.fill_blank, 2, '2 điền khuyết');
        t.equal(result.typeSummary.essay, 2, '2 tự luận');
    });

    runCase('lựa chọn được đọc đủ nội dung', (t) => {
        const options = result.questions[0].options;
        t.equal(options.length, 4, 'Câu 1 có 4 lựa chọn');
        t.equal(options[1].text, '4', 'Lựa chọn B là 4');
    });

    runCase('có phiên bản parser để truy vết', (t) => {
        t.ok(result.parserVersion, 'Phải ghi phiên bản parser');
    });

    runCase('câu thiếu đáp án bị đánh dấu lỗi, KHÔNG đoán', (t) => {
        const withErrors = result.questions.filter(q => q.errorList.length > 0);
        t.ok(Array.isArray(withErrors), 'Danh sách lỗi phải là mảng');
        // Câu điền khuyết không có đáp án trong tài liệu -> phải chặn publish.
        const fillBlanks = result.questions.filter(q => q.type === 'fill_blank');
        t.ok(fillBlanks.length > 0, 'Có câu điền khuyết để kiểm tra');
        t.ok(fillBlanks.every(q => q.needsReview), 'Câu thiếu đáp án phải chờ admin xác nhận');
    });

    suite('DOCX — đề trắc nghiệm cũ vẫn đọc được');

    runCase('đề 3 câu trắc nghiệm thuần vẫn parse được', (t) => {
        const legacy = importDocx(SAMPLE.exam, { grade: 8, subjectId: 'toan' });
        t.equal(legacy.questionCount, 3, 'Đọc đủ 3 câu');
        t.equal(legacy.typeSummary.single_choice, 3, 'Cả 3 đều là trắc nghiệm');
    });

    runCase('đề có công thức được đánh dấu cần duyệt', (t) => {
        const withFormula = importDocx(SAMPLE.formula, { grade: 8, subjectId: 'toan' });
        t.ok(withFormula.needsReview, 'Công thức phải cần admin duyệt');
    });

    runCase('đề có hình nhúng vẫn đọc được', (t) => {
        const withImage = importDocx(SAMPLE.image, { grade: 8, subjectId: 'toan' });
        t.ok(withImage.questionCount >= 1, 'Đọc được câu hỏi');
        t.ok(withImage.needsReview, 'Có hình thì cần duyệt');
    });

    runCase('tệp không phải DOCX -> báo lỗi rõ ràng', (t) => {
        let threw = false;
        try {
            importDocx(Buffer.from('đây không phải file docx'), { grade: 8 });
        } catch {
            threw = true;
        }
        t.ok(threw, 'Phải ném lỗi khi tệp không hợp lệ');
    });
}

function run() {
    testQuestionTypes();
    testBlankDetection();
    testRubricDetection();
    testFullPipeline();
}

module.exports = { run };