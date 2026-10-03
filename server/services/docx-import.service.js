'use strict';

/**
 * Điều phối việc đọc một tài liệu DOCX thành danh sách câu hỏi.
 *
 * Quy trình: đọc văn bản -> tách câu hỏi -> lấy lựa chọn -> tìm đáp án
 * -> tìm giải thích -> gắn hình -> kiểm tra hợp lệ.
 *
 * NGUYÊN TẮC: nếu không chắc chắn thì đáp án là null và câu hỏi bị đánh dấu
 * lỗi để admin xử lý. TUYỆT ĐỐI KHÔNG đoán đáp án.
 */

const { QUESTION_TYPES } = require('../config/constants');
const { parseDocxBuffer } = require('../parsers/docx/docx-parser');
const { splitIntoQuestions, endIndexOfQuestion } = require('../parsers/docx/question-detector');
const { detectOptions } = require('../parsers/docx/option-detector');
const { detectAnswerInQuestion, detectAnswerKey, isMultiAnswer } = require('../parsers/docx/answer-detector');
const { detectExplanation } = require('../parsers/docx/explanation-detector');
const { validateDocument } = require('../parsers/docx/docx-validator');

/**
 * Chuyển buffer .docx thành kết quả parse hoàn chỉnh.
 *
 * @param {Buffer} buffer nội dung tệp .docx
 * @param {object} metadata { grade, subjectId, lessonId, title, durationMinutes }
 * @returns {object} kết quả parse đã qua kiểm tra
 */
function importDocx(buffer, metadata = {}) {
    const raw = parseDocxBuffer(buffer);
    const paragraphs = raw.paragraphs;

    const blocks = splitIntoQuestions(paragraphs);
    const documentWarnings = [];

    if (!blocks.length) {
        return validateDocument({
            questions: [],
            hasFormula: raw.hasFormula,
            media: raw.media,
            documentWarnings: ['Không tìm thấy câu hỏi nào theo các mẫu "Câu N.", "N.", "Bài N:".']
        });
    }

    // Bảng đáp án ở cuối tài liệu: thử đọc trước khi gán đáp án cho từng câu.
    const answerKey = detectAnswerKey(paragraphs);

    const questions = blocks.map((block, position) => {
        const start = block.startIndex;
        const end = endIndexOfQuestion(blocks, position, paragraphs.length);
        const body = paragraphs.slice(start + 1, end);

        const { options } = detectOptions(body);
        const labels = options.map(option => option.label);
        const inline = detectAnswerInQuestion(body, labels.length ? labels : ['A', 'B', 'C', 'D']);

        // Ưu tiên đáp án nằm trong câu; nếu không có thì tra bảng đáp án cuối tài liệu.
        let answer = inline.answer;
        if (answer === null && answerKey.has(block.number)) answer = answerKey.get(block.number);
        if (answer === null && answerKey.size) {
            documentWarnings.push(`Bảng đáp án cuối tài liệu không có dòng cho câu ${block.number}.`);
        }

        const explanation = inline.explanation || detectExplanation(body);

        // Gắn hình ảnh xuất hiện trong phần thân câu (sau dòng câu hỏi, trước câu kế tiếp).
        // Dùng mediaByRelId của parser nên hình luôn khớp đúng vị trí trong đề.
        const media = [];
        for (let index = start; index < end; index += 1) {
            for (const relId of paragraphs[index]?.imageRelIds || []) {
                const mediaIndex = raw.mediaByRelId.get(relId);
                if (mediaIndex === undefined) continue;
                const item = raw.media[mediaIndex];
                media.push({
                    type: 'image',
                    url: item.name,
                    mimeType: item.mimeType,
                    // Chỉ số để service import ghi file hình ra uploads/.
                    mediaIndex
                });
            }
        }

        const hasFormula = body.some(item => item.hasFormula) || /\[CÔNG THỨC\]/.test(block.stem);
        const isEssay = !options.length;

        return {
            id: `imp-q${String(position + 1).padStart(3, '0')}`,
            number: block.number,
            type: isEssay
                ? QUESTION_TYPES.ESSAY
                : (isMultiAnswer(answer) ? QUESTION_TYPES.MULTIPLE_CHOICE : QUESTION_TYPES.SINGLE_CHOICE),
            questionText: block.stem,
            options,
            correctAnswer: answer,
            answerDetected: answer !== null,
            explanation,
            media,
            hasFormula,
            lessonId: metadata.lessonId || null,
            difficulty: 'medium',
            points: 1,
            warnings: [
                ...(isEssay ? ['Không nhận dạng được lựa chọn — đánh dấu là câu tự luận, cần người chấm.'] : []),
                ...(media.length ? [`Câu hỏi có ${media.length} hình ảnh cần kiểm tra.`] : [])
            ]
        };
    });

    // Cảnh báo cấp tài liệu khi có công thức hoặc hình.
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
        documentWarnings
    });
}

module.exports = { importDocx };