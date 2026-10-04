'use strict';

/**
 * Kiểm thử VALIDATOR và BẢO MẬT đầu vào.
 *
 * Các kiểm thử này bảo vệ các nguyên tắc then chốt:
 *   - Không lộ đáp án đúng cho học sinh.
 *   - Không tin dữ liệu client gửi lên (điểm, đáp án, vai trò).
 *   - Chặn tệp tải lên không an toàn và path traversal.
 */

const Question = require('../server/models/question.model');
const questionValidator = require('../server/validators/question.validator');
const examValidator = require('../server/validators/exam.validator');
const sanitize = require('../server/utils/sanitize');
const hash = require('../server/utils/hash');
const authMiddleware = require('../server/middleware/auth.middleware');
const constants = require('../server/config/constants');

const { suite, runCase } = require('./harness');

const BASE = { grade: 8, subjectId: 'toan', points: 1, questionText: 'Câu hỏi?' };

function testQuestionValidator() {
    suite('Validator — câu hỏi');

    runCase('trắc nghiệm thiếu lựa chọn -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE, type: 'single_choice', correctAnswer: { value: 'A' }
        });
        t.ok(!r.valid, 'Phải không hợp lệ');
        t.includes(r.errors, 'lựa chọn', 'Nêu rõ thiếu lựa chọn');
    });

    runCase('một đáp án có 2 ký hiệu đúng -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            type: 'single_choice',
            options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }],
            correctAnswer: { value: ['A', 'B'] }
        });
        t.ok(!r.valid, 'Một đáp án không được có 2 ký hiệu');
    });

    runCase('đáp án trỏ tới lựa chọn không tồn tại -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            type: 'single_choice',
            options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }],
            correctAnswer: { value: 'Z' }
        });
        t.ok(!r.valid, 'Ký hiệu không tồn tại');
    });

    runCase('điền khuyết thiếu ô -> lỗi', (t) => {
        t.ok(!questionValidator.validateQuestionDocument({ ...BASE, type: 'fill_blank' }).valid, 'Phải có ô trống');
    });

    runCase('điền khuyết đủ ô và đáp án -> hợp lệ', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            type: 'fill_blank',
            blanks: [{ blankId: 'b1', correctAnswers: ['Hà Nội'] }],
            correctAnswer: { value: [] }
        });
        t.ok(r.valid, `Phải hợp lệ: ${r.errors}`);
    });

    runCase('tự luận thiếu rubric -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE, type: 'essay', gradingMode: 'manual', correctAnswer: { value: [] }
        });
        t.ok(!r.valid, 'Chưa có rubric thì chưa được publish');
    });

    runCase('tự luận có rubric khớp điểm -> hợp lệ', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            type: 'essay',
            gradingMode: 'manual',
            points: 5,
            rubric: [
                { criterionId: 'c1', description: 'Ý 1', maxPoints: 2 },
                { criterionId: 'c2', description: 'Ý 2', maxPoints: 3 }
            ],
            correctAnswer: { value: [] }
        });
        t.ok(r.valid, `Phải hợp lệ: ${r.errors}`);
    });

    runCase('tổng điểm rubric lệch với điểm câu -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            type: 'essay',
            gradingMode: 'manual',
            points: 5,
            rubric: [{ criterionId: 'c1', description: 'Ý 1', maxPoints: 1 }],
            correctAnswer: { value: [] }
        });
        t.ok(!r.valid, 'Tổng rubric phải khớp điểm câu');
    });

    runCase('tự luận đặt chấm tự động -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            type: 'essay',
            gradingMode: 'auto',
            points: 5,
            rubric: [{ criterionId: 'c1', description: 'Ý', maxPoints: 5 }],
            correctAnswer: { value: [] }
        });
        t.ok(!r.valid, 'Tự luận không được chấm tự động');
    });

    runCase('câu số có đáp án chữ -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE, type: 'numeric', correctAnswer: { value: 'mười' }
        });
        t.ok(!r.valid, 'Đáp án số phải là số');
    });

    runCase('trả lời ngắn chấm tự động mà không có đáp án -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE, type: 'short_answer', gradingMode: 'auto', correctAnswer: { value: [] }
        });
        t.ok(!r.valid, 'Chấm auto phải có danh sách đáp án');
    });

    runCase('môn không thuộc lớp -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            grade: 1,
            subjectId: 'ngu_van',
            type: 'essay',
            gradingMode: 'manual',
            points: 5,
            rubric: [{ criterionId: 'c1', description: 'Ý', maxPoints: 5 }],
            correctAnswer: { value: [] }
        });
        t.ok(!r.valid, 'Ngữ văn không có ở lớp 1');
    });

    runCase('bài học không tồn tại -> lỗi', (t) => {
        const r = questionValidator.validateQuestionDocument({
            ...BASE,
            type: 'essay',
            gradingMode: 'manual',
            points: 5,
            lessonId: 'les-khong-ton-tai',
            rubric: [{ criterionId: 'c1', description: 'Ý', maxPoints: 5 }],
            correctAnswer: { value: [] }
        });
        t.ok(!r.valid, 'Bài học không có trong danh mục');
    });
}

function testAnswerShape() {
    suite('Validator — hình dạng câu trả lời học sinh');

    runCase('single_choice nhận chuỗi', (t) => {
        t.ok(questionValidator.validateStudentAnswerShape('single_choice', 'B').valid, 'Chuỗi ký hiệu');
    });

    runCase('multiple_choice nhận mảng', (t) => {
        t.ok(questionValidator.validateStudentAnswerShape('multiple_choice', ['A', 'C']).valid, 'Mảng');
    });

    runCase('multiple_choice nhận chuỗi -> lỗi', (t) => {
        t.ok(!questionValidator.validateStudentAnswerShape('multiple_choice', 'A').valid, 'Phải là mảng');
    });

    runCase('true_false nhận boolean', (t) => {
        t.ok(questionValidator.validateStudentAnswerShape('true_false', true).valid, 'Boolean');
    });

    runCase('fill_blank nhận object', (t) => {
        t.ok(questionValidator.validateStudentAnswerShape('fill_blank', { b1: 'Hà Nội' }).valid, 'Object');
    });

    runCase('fill_blank nhận mảng -> lỗi', (t) => {
        t.ok(!questionValidator.validateStudentAnswerShape('fill_blank', ['Hà Nội']).valid, 'Phải là object');
    });

    runCase('bài tự luận quá dài -> lỗi', (t) => {
        t.ok(!questionValidator.validateStudentAnswerShape('essay', 'x'.repeat(20001)).valid, 'Chặn quá dài');
    });

    runCase('bỏ trống mọi dạng đều hợp lệ về hình dạng', (t) => {
        for (const type of Object.values(constants.QUESTION_TYPES)) {
            t.ok(questionValidator.validateStudentAnswerShape(type, null).valid, `${type} cho phép bỏ trống`);
        }
    });
}

function testExamValidator() {
    suite('Validator — đề thi');

    runCase('đề thiếu câu hỏi -> lỗi', async (t) => {
        const r = await examValidator.validateExamQuestions([]);
        t.ok(!r.valid, 'Đề phải có câu hỏi');
    });

    runCase('đề lặp câu -> lỗi', async (t) => {
        const r = await examValidator.validateExamQuestions([
            { questionId: 'q1', points: 1, order: 1 },
            { questionId: 'q1', points: 1, order: 2 }
        ]);
        t.ok(!r.valid, 'Không được lặp câu');
    });

    runCase('điểm câu <= 0 -> lỗi', async (t) => {
        const r = await examValidator.validateExamQuestions([{ questionId: 'q1', points: 0, order: 1 }]);
        t.ok(!r.valid, 'Điểm phải lớn hơn 0');
    });

    runCase('thiếu thứ tự -> lỗi', async (t) => {
        const r = await examValidator.validateExamQuestions([{ questionId: 'q1', points: 1 }]);
        t.ok(!r.valid, 'Phải có thứ tự');
    });

    runCase('trùng thứ tự -> lỗi', async (t) => {
        const r = await examValidator.validateExamQuestions([
            { questionId: 'q1', points: 1, order: 1 },
            { questionId: 'q2', points: 1, order: 1 }
        ]);
        t.ok(!r.valid, 'Không được trùng thứ tự');
    });

    runCase('đề hợp lệ -> không lỗi', async (t) => {
        const r = await examValidator.validateExamQuestions([
            { questionId: 'q1', points: 1, order: 1 },
            { questionId: 'q2', points: 2, order: 2 }
        ]);
        t.ok(r.valid, `Không được có lỗi: ${r.errors}`);
    });

    runCase('chuyển trạng thái đề hợp lệ', (t) => {
        t.ok(examValidator.canTransition({ status: 'draft' }, 'published').allowed, 'draft -> published');
        t.ok(examValidator.canTransition({ status: 'review' }, 'published').allowed, 'review -> published');
        t.ok(!examValidator.canTransition({ status: 'archived' }, 'published').allowed, 'archived -> published bị chặn');
    });
}

/** Response giả lập để kiểm thử middleware không cần chạy HTTP server. */
function createFakeResponse() {
    return {
        statusCode: null,
        payload: null,
        locals: { requestId: 'test' },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return this;
        }
    };
}

function testNoAnswerLeak() {
    suite('Bảo mật — không lộ đáp án đúng cho học sinh');

    const makeQuestion = type => new Question({
        questionId: `q-${type}`,
        type,
        questionText: 'Nội dung câu hỏi?',
        grade: 8,
        subjectId: 'toan',
        createdBy: 'admin',
        source: 'kiem thu',
        points: 2,
        options: type.includes('choice') ? [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }] : [],
        blanks: type === 'fill_blank' ? [{ blankId: 'b1', correctAnswers: ['Hà Nội'] }] : [],
        rubric: type === 'essay'
            ? [{ criterionId: 'c1', description: 'Ý 1', maxPoints: 2 }]
            : [],
        correctAnswer: { type, value: 'B' }
    });

    runCase('bản nhìn cho học sinh KHÔNG có correctAnswer', (t) => {
        for (const type of Object.values(constants.QUESTION_TYPES)) {
            t.equal(makeQuestion(type).toStudentView().correctAnswer, undefined, `${type} không được lộ đáp án`);
        }
    });

    runCase('bản nhìn cho học sinh KHÔNG có rubric tự luận', (t) => {
        t.equal(makeQuestion('essay').toStudentView().rubric, undefined, 'Không lộ rubric');
    });

    runCase('bản nhìn cho học sinh KHÔNG có acceptedAnswers', (t) => {
        t.equal(makeQuestion('short_answer').toStudentView().acceptedAnswers, undefined, 'Không lộ đáp án chấp nhận');
    });

    runCase('vẫn CÓ blanks để vẽ ô nhập, nhưng không lộ đáp án', (t) => {
        const view = makeQuestion('fill_blank').toStudentView();
        t.equal(view.blanks.length, 1, 'UI cần biết có bao nhiêu ô');
        t.equal(view.blanks[0].correctAnswers, undefined, 'Nhưng không được lộ đáp án');
    });

    runCase('chỉ màn hình kết quả mới thấy đáp án', (t) => {
        const view = makeQuestion('single_choice').toStudentView({ withExplanation: true, withAnswers: true });
        t.equal(view.correctAnswer, 'B', 'Sau khi nộp bài mới được thấy');
    });
}

function testInputValidation() {
    suite('Bảo mật — kiểm tra đầu vào');

    runCase('chỉ chấp nhận tệp .docx', (t) => {
        t.ok(sanitize.validateUploadFileName('de-thi.docx').valid, '.docx hợp lệ');
        t.ok(!sanitize.validateUploadFileName('de-thi.pdf').valid, '.pdf bị từ chối');
        t.ok(!sanitize.validateUploadFileName('virus.exe').valid, '.exe bị từ chối');
    });

    runCase('chặn path traversal trong tên tệp', (t) => {
        t.ok(!sanitize.validateUploadFileName('../../etc/passwd').valid, 'Chứa đường dẫn');
        t.ok(!sanitize.validateUploadFileName('..\\..\\windows\\system32').valid, 'Đường dẫn Windows');
    });

    runCase('chặn ký tự đường dẫn trong tên tệp', (t) => {
        t.ok(!sanitize.validateUploadFileName('a/b.docx').valid, 'Dấu gạch chéo');
    });

    runCase('kiểm tra chữ ký nhị phân .docx (ZIP)', (t) => {
        const magic = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
        t.ok(sanitize.hasDocxSignature(Buffer.concat([magic, Buffer.alloc(10)]), magic), 'ZIP hợp lệ');
        t.ok(!sanitize.hasDocxSignature(Buffer.from('<?php ?>'), magic), 'Không phải ZIP');
        t.ok(!sanitize.hasDocxSignature(null, magic), 'Dữ liệu rỗng');
    });

    runCase('tên đăng nhập: 3–24 ký tự', (t) => {
        t.ok(sanitize.isValidUsername('hocsinh01'), 'Hợp lệ');
        t.ok(!sanitize.isValidUsername('ab'), 'Quá ngắn');
        t.ok(!sanitize.isValidUsername('a'.repeat(25)), 'Quá dài');
        t.ok(!sanitize.isValidUsername('co<script>'), 'Chứa ký tự lạ');
    });

    runCase('mật khẩu: 6–72 ký tự', (t) => {
        t.ok(sanitize.isValidPassword('matkhau123'), 'Hợp lệ');
        t.ok(!sanitize.isValidPassword('12345'), 'Quá ngắn');
        t.ok(!sanitize.isValidPassword('x'.repeat(73)), 'Quá dài (bcrypt giới hạn 72 byte)');
    });

    runCase('làm sạch văn bản loại bỏ thẻ HTML', (t) => {
        t.ok(!sanitize.cleanText('<script>alert(1)</script>').includes('<'), 'Không còn thẻ');
    });

    runCase('làm sạch loại bỏ ký tự điều khiển', (t) => {
        t.equal(sanitize.cleanText('abc'), 'abc', 'Văn bản sạch giữ nguyên');
        t.ok(!sanitize.cleanText('a b').includes(' '), 'Ký tự điều khiển bị loại');
    });
}

async function testPasswordHashing() {
    suite('Bảo mật — mật khẩu');

    const hash1 = await hash.hashPassword('matkhau123');
    const hash2 = await hash.hashPassword('matkhau123');

    runCase('mật khẩu KHÔNG bao giờ lưu dạng rõ', (t) => {
        t.ok(hash1 && !hash1.includes('matkhau123'), 'Hash không chứa mật khẩu');
        t.includes(hash1, '$2', 'Định dạng bcrypt');
    });

    runCase('băm hai lần cho hai kết quả khác nhau (salt)', (t) => {
        t.notEqual(hash1, hash2, 'Salt phải khác nhau');
    });

    runCase('xác minh đúng mật khẩu -> true', async (t) => {
        t.ok(await hash.verifyPassword('matkhau123', hash1), 'Đúng mật khẩu');
    });

    runCase('xác minh sai mật khẩu -> false', async (t) => {
        t.ok(!(await hash.verifyPassword('sai', hash1)), 'Sai mật khẩu');
    });

    runCase('hash không hợp lệ -> false, không ném lỗi', async (t) => {
        t.ok(!(await hash.verifyPassword('x', 'khong-phai-hash')), 'Trả về false an toàn');
        t.ok(!(await hash.verifyPassword('x', '')), 'Hash rỗng');
    });
}

function testAuthorization() {
    suite('Bảo mật — phân quyền');

    runCase('không đăng nhập -> 401', (t) => {
        const res = createFakeResponse();
        let called = false;
        authMiddleware.requireAuth({ session: {} }, res, () => {
            called = true;
        });
        t.equal(res.statusCode, 401, 'Phải trả 401');
        t.ok(!called, 'Không được đi qua middleware');
    });

    runCase('học sinh gọi API quản trị -> 403', (t) => {
        const res = createFakeResponse();
        let called = false;
        authMiddleware.requireAdmin(
            { session: { user: { username: 'hs', role: constants.ROLES.STUDENT } } },
            res,
            () => {
                called = true;
            }
        );
        t.equal(res.statusCode, 403, 'Phải trả 403');
        t.ok(!called, 'Không được đi qua');
    });

    runCase('quản trị viên -> được phép', (t) => {
        const res = createFakeResponse();
        let called = false;
        authMiddleware.requireAdmin(
            { session: { user: { username: 'admin', role: constants.ROLES.ADMIN } } },
            res,
            () => {
                called = true;
            }
        );
        t.equal(res.statusCode, null, 'Không trả lỗi');
        t.ok(called, 'Được đi tiếp');
    });

    runCase('quyền lấy từ SESSION, không tin request body', (t) => {
        const res = createFakeResponse();
        let called = false;
        // Client tự gửi role: 'admin' trong body — phải bị bỏ qua.
        authMiddleware.requireAdmin(
            { session: { user: { username: 'hs', role: constants.ROLES.STUDENT } }, body: { role: 'admin' } },
            res,
            () => {
                called = true;
            }
        );
        t.equal(res.statusCode, 403, 'Body gửi role admin không có tác dụng');
        t.ok(!called, 'Vẫn bị chặn');
    });

    runCase('isAuthenticated đọc đúng session', (t) => {
        t.ok(!authMiddleware.isAuthenticated({ session: {} }), 'Chưa đăng nhập');
        t.ok(authMiddleware.isAuthenticated({ session: { user: { username: 'a' } } }), 'Đã đăng nhập');
    });
}

function testServerSideScoring() {
    suite('Bảo mật — điểm luôn do máy chủ tính');
    // eslint-disable-next-line global-require
    const scoring = require('../server/services/scoring.service');

    runCase('client gửi kèm điểm/sai cờ -> bị bỏ qua', (t) => {
        const questions = [{
            questionId: 'q1',
            type: 'single_choice',
            correctAnswer: { value: 'B' },
            points: 1
        }];
        const items = [{ questionId: 'q1', points: 1, order: 1 }];
        // Client cố gắng gửi sẵn điểm và kết quả.
        const malicious = { q1: { answer: 'A', awardedPoints: 10, isCorrect: true } };
        const r = scoring.gradeExam(questions, malicious, {}, items);
        t.equal(r.autoScore, 0, 'Điểm client gửi lên bị bỏ qua hoàn toàn');
        t.equal(r.correctQuestions, 0, 'Không tin cờ isCorrect từ client');
    });

    runCase('client thêm câu không có trong đề -> bị bỏ qua', (t) => {
        const questions = [{
            questionId: 'q1',
            type: 'single_choice',
            correctAnswer: { value: 'B' },
            points: 1
        }];
        const items = [
            { questionId: 'q1', points: 1, order: 1 },
            { questionId: 'q-khong-ton-tai', points: 1, order: 2 }
        ];
        t.equal(scoring.gradeExam(questions, {}, {}, items).totalQuestions, 1, 'Chỉ tính câu có thật');
    });
}

async function run() {
    testNoAnswerLeak();
    testAnswerShape();
    testExamValidator();
    testInputValidation();
    testAuthorization();
    testServerSideScoring();
    await testPasswordHashing();
}

module.exports = { run };