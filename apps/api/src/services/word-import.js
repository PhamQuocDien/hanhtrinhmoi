'use strict';
const crypto = require('node:crypto');

function classifyDocument(text = '') {
  const value = text.toLocaleLowerCase('vi-VN');
  if (/(đề\s*(kiểm tra|thi|luyện thi|ôn tập)|kiểm tra\s*(giữa|cuối)\s*kỳ|đề\s*số\s*\d|thời gian làm bài|mã đề)/i.test(value)) {
    const assessmentType = /giữa\s*kỳ/i.test(value) ? 'midterm' : /cuối\s*kỳ/i.test(value) ? 'final' : /ôn tập|luyện thi/i.test(value) ? 'practice' : 'lesson';
    return { contentType: 'assessment', assessmentType, confidence: 'medium', reason: 'Phát hiện cụm từ thường gặp trong đề kiểm tra/đề thi.' };
  }
  if (/(bài giảng|mục tiêu bài học|lý thuyết|kiến thức cần nhớ|sau bài học|hoạt động khởi động)/i.test(value)) {
    return { contentType: 'lesson', assessmentType: '', confidence: 'medium', reason: 'Phát hiện cấu trúc lý thuyết hoặc bài giảng.' };
  }
  if (/(chương trình học|danh mục khóa học|đề cương môn học|kế hoạch giáo dục|chủ đề học tập)/i.test(value)) {
    return { contentType: 'course', assessmentType: '', confidence: 'low', reason: 'Phát hiện nội dung có thể là đề cương hoặc chương trình học.' };
  }
  return { contentType: 'lesson', assessmentType: '', confidence: 'low', reason: 'Chưa đủ dấu hiệu; hãy xác nhận loại nội dung trước khi lưu.' };
}

function parseQuestions(text = '') {
  const lines = String(text).replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^(?:Câu\s*\d+\s*[.:)]?|Question\s*\d+\s*[.:)]?|Bài\s*\d+\s*[.:)]?|\d+[.)])\s*(.*)$/i);
    if (heading) {
      if (current) blocks.push(current);
      current = { prompt: heading[1].trim(), lines: [line] };
    } else if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks.filter((block) => block.lines.join(' ').length > 8).slice(0, 300).map((block, index) => {
    const full = block.lines.join('\n');
    const optionPattern = /^\s*([A-H])[.)]\s*(.+)$/i;
    const options = block.lines.map((line) => {
      const match = line.match(optionPattern);
      return match ? { value: match[1].toUpperCase(), label: `${match[1].toUpperCase()}. ${match[2].trim()}` } : null;
    }).filter(Boolean);
    const answerMatch = full.match(/(?:đáp\s*án|answer\s*key|đáp án đúng)\s*[:：\-]\s*([A-H]|[^\n]+)/i);
    const blank = /_{3,}|\.\.\.|điền\s+(?:vào|từ|chỗ)/i.test(full);
    const type = options.length >= 2 ? 'multiple_choice' : blank ? 'fill_blank' : 'essay';
    let prompt = block.lines[0].replace(/^(?:Câu\s*\d+\s*[.:)]?|Question\s*\d+\s*[.:)]?|Bài\s*\d+\s*[.:)]?|\d+[.)])\s*/i, '').trim();
    if (!prompt) prompt = block.lines.find((line) => !optionPattern.test(line) && !/(đáp\s*án|answer\s*key)/i.test(line)) || `Câu ${index + 1}`;
    const answerValue = answerMatch ? answerMatch[1].trim().replace(/[.]$/, '') : '';
    const correctAnswer = type === 'multiple_choice' && answerValue ? answerValue.match(/^[A-H]$/i) ? answerValue.toUpperCase() : '' : answerValue;
    return {
      questionId: `word-${crypto.randomUUID()}`,
      order: index + 1,
      prompt: prompt.slice(0, 5000),
      type,
      options,
      correctAnswer,
      acceptedAnswers: answerValue && type !== 'multiple_choice' ? [answerValue] : [],
      points: 1,
      explanation: '',
      rubric: type === 'essay' ? ['Đúng chủ đề', 'Kiến thức chính xác', 'Lập luận và trình bày rõ ràng'] : [],
      reviewRequired: true,
      sourceExcerpt: full.slice(0, 10000)
    };
  });
}

function validateWordContext(body) {
  const grade = Number(body.grade);
  const programCode = String(body.programCode || 'ctst');
  const subjectCode = String(body.subjectCode || '');
  const contentType = String(body.contentType || 'lesson');
  const allowedPrograms = ['ctst', 'kntt', 'canhdieu'];
  const allowedTypes = ['course', 'lesson', 'assessment'];
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { valid: false, error: 'Hãy chọn lớp từ 1 đến 12.' };
  if (!allowedPrograms.includes(programCode)) return { valid: false, error: 'Bộ sách không hợp lệ.' };
  if (!/^[a-z_]{2,80}$/.test(subjectCode)) return { valid: false, error: 'Hãy chọn môn học hợp lệ.' };
  if (!allowedTypes.includes(contentType)) return { valid: false, error: 'Loại nội dung không hợp lệ.' };
  return { valid: true, value: { grade, programCode, subjectCode, contentType } };
}
module.exports = { classifyDocument, parseQuestions, validateWordContext };
