'use strict';

/**
 * Điều phối việc đọc một tài liệu DOCX thành danh sách câu hỏi ĐẦY ĐỦ CÁC DẠNG.
 *
 * Quy trình:
 *   đọc văn bản -> tách câu hỏi -> lựa chọn -> loại câu -> ô trống -> ý Đúng/Sai
 *   -> đáp án -> giải thích -> rubric -> hình -> kiểm tra hợp lệ.
 *
 * NGUYÊN TẮC BẤT DI BẤT DỊCH:
 *   - KHÔNG ĐOÁN đáp án. Không xác định được thì để null + ghi cảnh báo.
 *   - Không đoán loại câu khi thiếu tín hiệu -> gán loại an toàn + needsReview.
 *   - Câu hỏi chỉ vào ngân hàng khi admin publish, không ghi thẳng lúc upload.
 */

const { QUESTION_TYPES, PARSER_VERSION } = require('../config/constants');
const { parseDocxBuffer } = require('../parsers/docx/docx-parser');
const { splitIntoQuestions, endIndexOfQuestion } = require('../parsers/docx/question-detector');
const { detectOptions } = require('../parsers/docx/option-detector');
const {
    detectAnswerInQuestion,
    detectAnswerKey,
    isMultiAnswer
} = require('../parsers/docx/answer-detector');
const { detectExplanation } = require('../parsers/docx/explanation-detector');
const { detectQuestionType, detectTrueFalse } = require('../parsers/docx/question-type-detector');
const { detectBlanks, detectSubStatements } = require('../parsers/docx/blank-detector');
const { detectRubric, detectRubricKey } = require('../parsers/docx/rubric-detector');
const { validateDocument } = require('../parsers/docx/docx-validator');

/** Điểm ghi trong nội dung: "Câu 1. (2 điểm)" hoặc dòng "Điểm: 2". */
const POINTS_IN_STEM = /\((\d+(?:[.,]\d+)?)\s*(?:điểm|đ)\)/i;
const POINTS_LINE = /^\s*(?:điểm|point)\s*[:\-–—]?\s*(\d+(?:[.,]\d+)?)\s*(?:điểm|đ)?\s*$/i;

/** Điểm mặc định khi tài liệu không ghi. */
const DEFAULT_POINTS = 1;

/** Gom nhiều đoạn thành một chuỗi để so khớp mẫu. */
function joinTexts(paragraphs = []) {
    return paragraphs.map(item => String(item?.text || '').trim()).filter(Boolean);
}

/** Đọc điểm của câu từ thân câu. */
function readPoints(stem, paragraphs) {
    const inStem = String(stem || '').match(POINTS_IN_STEM);
    if (inStem) return Number(inStem[1].replace(',', '.'));
    for (const paragraph of paragraphs) {
        const match = String(paragraph?.text || '').match(POINTS_LINE);
        if (match) return Number(match[1].replace(',', '.'));
    }
    return DEFAULT_POINTS;
}

/**
 * Chuyển buffer .docx thành kết quả parse đầy đủ các dạng câu hỏi.
 *
 * @param {Buffer} buffer   nội dung tệp .docx
 * @param {object} metadata { grade, subjectId, lessonId, title, durationMinutes }
 * @returns {object} kết quả parse đã qua kiểm tra
 */
function importDocx(buffer, metadata = {}) {
    const raw = parseDocxBuffer(buffer);
    const paragraphs = raw.paragraphs;
    const documentWarnings = [];

    const blocks = splitIntoQuestions(paragraphs);
    if (!blocks.length) {
        return validateDocument({
            questions: [],
            hasFormula: raw.hasFormula,
            media: raw.media,
            documentWarnings: ['Không tìm thấy câu hỏi nào theo các mẫu "Câu N.", "N.", "Bài N:".']
        });
    }

    // Bảng đáp án cuối tài liệu + bảng hướng dẫn chấm, đọc trước khi gán từng câu.
    const answerKey = detectAnswerKey(paragraphs);
    const rubricKey = detectRubricKey(paragraphs);

    const questions = blocks.map((block, position) => {
        const start = block.startIndex;
        const end = endIndexOfQuestion(blocks, position, paragraphs.length);
        const body = paragraphs.slice(start + 1, end);

        const { options } = detectOptions(body);
        const labels = options.map(option => option.label);
        // Truyền DANH SÁCH KÝ HIỆU THẬT (có thể rỗng). Khi rỗng, answer-detector
        // đọc đáp án tự do thay vì ép thành ký hiệu A-D.
        const inline = detectAnswerInQuestion(body, labels);

        // Ưu tiên đáp án trong câu; không có thì tra bảng đáp án cuối tài liệu.
        let answer = inline.answer;
        if (answer === null && answerKey.has(block.number)) answer = answerKey.get(block.number);
        if (answer === null && answerKey.size) {
            documentWarnings.push(`Bảng đáp án cuối tài liệu không có dòng cho câu ${block.number}.`);
        }

        const explanation = inline.explanation || detectExplanation(body);
        const points = readPoints(block.stem, body);
        const warnings = [];

        // ---- Loại câu + dữ liệu riêng theo loại ----
        const typeInfo = detectQuestionType({ text: block.stem, options, answer });
        let type = typeInfo.type;
        let blanks = [];
        let statements = [];
        let rubric = [];
        let questionText = block.stem;

        if (type === QUESTION_TYPES.FILL_BLANK) {
            const detected = detectBlanks(block.stem, {
                totalPoints: points,
                // Đáp án dạng danh sách "Đông; Tây" được chia theo thứ tự các ô.
                answers: Array.isArray(answer) ? answer : null
            });
            blanks = detected.blanks;
            questionText = detected.replacedText;
            warnings.push(...detected.warnings);
        } else if (!options.length) {
            // Câu Đúng/Sai nhiều ý: các dòng a) b) c) trong thân câu.
            // CHỈ xét khi câu KHÔNG có lựa chọn A-D, tránh nhầm lựa chọn thành ý.
            const subStatements = detectSubStatements(body);
            if (subStatements.length) {
                type = QUESTION_TYPES.TRUE_FALSE;
                statements = subStatements;
                warnings.push('Đáp án từng ý chưa đọc được — admin phải xác nhận Đúng/Sai cho từng ý.');
            } else {
                // Câu đơn có đáp án Đúng/Sai -> chuyển sang dạng true_false.
                const trueFalse = detectTrueFalse({ text: block.stem, answer });
                if (trueFalse.isTrueFalse && trueFalse.isStatement) type = QUESTION_TYPES.TRUE_FALSE;
                else if (trueFalse.isTrueFalse) warnings.push(trueFalse.reason);
            }
        }

        // ---- Rubric cho câu tự luận ----
        if (type === QUESTION_TYPES.ESSAY) {
            const detected = detectRubric(body);
            rubric = detected.rubric.length ? detected.rubric : (rubricKey.get(block.number) || []);
            warnings.push(...detected.warnings);
            if (!rubric.length && rubricKey.has(block.number)) {
                warnings.push('Bảng hướng dẫn chấm cuối tài liệu không đủ để dựng rubric.');
            }
        }

        // ---- Hình ảnh xuất hiện trong phần thân câu ----
        const media = [];
        for (let index = start; index < end; index += 1) {
            for (const relId of paragraphs[index]?.imageRelIds || []) {
                const mediaIndex = raw.mediaByRelId.get(relId);
                if (mediaIndex === undefined) continue;
                const item = raw.media[mediaIndex];
                media.push({ type: 'image', url: item.name, mimeType: item.mimeType, mediaIndex });
            }
        }

        const hasFormula = body.some(item => item.hasFormula) || /\[CÔNG THỨC\]/.test(block.stem);
        const needsReview = typeInfo.needsReview || hasFormula || answer === null;

        if (typeInfo.needsReview) warnings.push(typeInfo.reason);
        if (answer === null && type !== QUESTION_TYPES.ESSAY) {
            warnings.push('Chưa xác định được đáp án — KHÔNG đoán, admin phải nhập tay.');
        }
        if (media.length) warnings.push(`Câu hỏi có ${media.length} hình ảnh cần kiểm tra.`);

        return {
            id: `imp-q${String(position + 1).padStart(3, '0')}`,
            number: block.number,
            type,
            questionText,
            options,
            blanks,
            statements,
            rubric,
            correctAnswer: answer,
            answerDetected: answer !== null,
            explanation,
            media,
            hasFormula,
            needsReview,
            typeDetection: { reason: typeInfo.reason, confidence: typeInfo.confidence },
            lessonId: metadata.lessonId || null,
            difficulty: 'medium',
            points,
            warnings,
            parserVersion: PARSER_VERSION
        };
    });

    if (raw.hasFormula) {
        documentWarnings.push('Tài liệu có công thức (phân số, số mũ, ký hiệu). Cần đối chiếu thủ công trước khi publish.');
    }
    if (raw.media.length) {
        documentWarnings.push(`Tài liệu có ${raw.media.length} hình ảnh nhúng.`);
    }

    return validateDocument({
        questions,
        hasFormula: raw.hasFormula,
        media: raw.media,
        documentWarnings,
        parserVersion: PARSER_VERSION
    });
}

module.exports = { PARSER_VERSION, importDocx };