'use strict';
const crypto = require('node:crypto');

function deterministicShuffle(items, seed) {
  const output = [...items];
  const bytes = crypto.createHash('sha256').update(String(seed)).digest();
  let state = bytes.readUInt32BE(0) || 1;
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function buildExtendedQuestionTypes({ prefix, lesson, sourceQuestions = [], metadata = {} }) {
  const title = String(lesson.title || 'bài học');
  const sources = sourceQuestions.filter((item) => item && item.prompt && item.correctAnswer !== undefined);
  const records = [];
  const make = (suffix, type, prompt, correctAnswer, extra = {}) => {
    const questionId = `${prefix}-${suffix}`;
    records.push({ id: questionId, questionId, type, prompt, correctAnswer: String(correctAnswer), acceptedAnswers: [String(correctAnswer)], options: [], points: type === 'essay' ? 3 : 1, purpose: 'assessment', contentQualityVersion: 'V6.1.1', difficulty: 'medium', taxonomy: 'apply', ...metadata, ...extra });
  };

  const tfFrames = [
    'Đối chiếu phát biểu với dữ kiện của câu hỏi', 'Kiểm tra xem nhận định có giữ đúng điều kiện đã nêu',
    'Xác định phát biểu có suy ra trực tiếp từ đề bài', 'Kiểm tra một nhận định trước khi dùng làm kết luận',
    'Phân biệt dữ kiện được cho với suy đoán không có căn cứ', 'Kiểm tra tính phù hợp của câu trả lời với yêu cầu',
    'Xác định có bỏ qua điều kiện quan trọng hay không', 'Kiểm tra một nhận định có mâu thuẫn với dữ kiện',
    'Rà soát xem kết luận có đủ căn cứ', 'Kiểm tra việc dùng đúng thuật ngữ trong câu hỏi',
    'Đối chiếu câu trả lời với mục tiêu học tập', 'Kiểm tra tính hợp lý trước khi chấp nhận kết quả',
    'Xác định phát biểu có nhầm ví dụ với quy tắc chung', 'Kiểm tra phạm vi áp dụng của nhận định',
    'Rà soát xem cách giải thích có trả lời đúng trọng tâm', 'Kiểm tra một kết luận bằng dữ kiện đã cung cấp'
  ];
  for (let index = 0; index < 16; index += 1) {
    const source = sources[index % Math.max(sources.length, 1)] || { prompt: `Ý chính của bài “${title}” là gì?`, correctAnswer: title, options: [] };
    const correct = String(source.correctAnswer);
    const distractor = (source.options || []).map((option) => typeof option === 'object' ? option.value : option).find((value) => String(value) !== correct);
    const truth = index % 2 === 0;
    const claim = truth || distractor === undefined ? correct : String(distractor);
    const questionId = `${prefix}-tf-${String(index + 1).padStart(2, '0')}`;
    records.push({ id: questionId, questionId, type: 'true_false', prompt: `Đúng hay sai? ${tfFrames[index]} trong bài “${title}”. Câu hỏi gốc: “${source.prompt}”. Nhận định: “${claim}”.`, options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], correctAnswer: String(truth || distractor === undefined), acceptedAnswers: [String(truth || distractor === undefined)], explanation: source.explanation || 'Đọc lại dữ kiện của câu hỏi gốc và kiểm tra nhận định có khớp đáp án hay không.', purpose: 'assessment', points: 1, difficulty: index < 5 ? 'easy' : 'medium', taxonomy: index < 5 ? 'understand' : 'analyze', contentQualityVersion: 'V6.1.1', ...metadata });
  }

  const multiFrames = [
    'Chọn mọi cặp câu hỏi–đáp án đúng', 'Chọn tất cả kết luận được dữ kiện của bài hỗ trợ',
    'Chọn các đáp án có thể đối chiếu trực tiếp với câu hỏi gốc', 'Chọn mọi kết quả phù hợp với nội dung bài',
    'Chọn tất cả kết luận có căn cứ', 'Chọn các cặp yêu cầu và đáp án khớp nhau',
    'Chọn những lời giải có thể kiểm chứng', 'Chọn các phát biểu đúng theo kiến thức vừa học'
  ];
  const sourceFacts = [];
  const sourceKeys = new Set();
  for (const source of sources) {
    const answer = String(source.correctAnswer || '').trim();
    const prompt = String(source.prompt || '').trim();
    const key = `${prompt}|${answer}`;
    if (!prompt || !answer || sourceKeys.has(key)) continue;
    sourceKeys.add(key);
    const wrong = (source.options || []).map((option) => typeof option === 'object' ? option.value : option).map(String).find((value) => value !== answer && value.trim());
    if (wrong) sourceFacts.push({ prompt, answer, wrong });
    if (sourceFacts.length >= 8) break;
  }
  const multiOptions = [];
  if (sourceFacts.length >= 4) {
    for (let index = 0; index < 4; index += 1) {
      const fact = sourceFacts[index];
      const isCorrect = index < 2;
      const value = `fact-${index + 1}`;
      multiOptions.push({ value, label: `“${fact.prompt}” → ${isCorrect ? fact.answer : fact.wrong}` });
    }
  } else {
    multiOptions.push(
      { value: 'check-evidence', label: `Đối chiếu đáp án với dữ kiện của bài “${title}”` },
      { value: 'follow-objective', label: `Giải thích lựa chọn theo mục tiêu “${title}”` },
      { value: 'guess-without-reason', label: 'Chọn đáp án ngẫu nhiên mà không cần căn cứ' },
      { value: 'ignore-conditions', label: 'Bỏ qua điều kiện và không kiểm tra lại' }
    );
  }
  const multiCorrect = multiOptions.slice(0, 2).map((item) => item.value).sort().join('|');
  for (let index = 0; index < 8; index += 1) {
    const questionId = `${prefix}-multi-${String(index + 1).padStart(2, '0')}`;
    records.push({ id: questionId, questionId, type: 'multiple_select', prompt: `${multiFrames[index]} theo nội dung bài “${title}”. ${sourceFacts.length >= 4 ? 'Chọn đúng hai cặp; các lựa chọn còn lại có đáp án bị thay đổi.' : 'Có thể có nhiều đáp án đúng.'}`, options: deterministicShuffle(multiOptions, `${questionId}:options`), correctAnswer: multiCorrect, acceptedAnswers: [multiCorrect], explanation: 'Kiểm tra từng lựa chọn với câu hỏi gốc; đáp án đúng phải giữ nguyên ý nghĩa và dữ kiện.', purpose: 'assessment', points: 2, difficulty: index < 3 ? 'easy' : 'medium', taxonomy: index < 3 ? 'understand' : 'apply', contentQualityVersion: 'V6.1.1', ...metadata });
  }

  const matchingFrames = [
    'Nối từng câu hỏi với đáp án phù hợp', 'Ghép dữ kiện bài học với kết quả tương ứng',
    'Nối mỗi yêu cầu với lời giải đúng', 'Ghép câu hỏi trong nội dung với kết quả được hỗ trợ',
    'Nối nhiệm vụ với đáp án chính xác', 'Ghép từng vấn đề với kết luận phù hợp',
    'Nối câu hỏi với kết quả để kiểm tra hiểu bài', 'Ghép yêu cầu và lời giải đúng theo dữ kiện'
  ];
  let matchingItems;
  let matchingOptions;
  let matchingCorrect;
  if (sourceFacts.length >= 4) {
    const uniqueFacts = [];
    const answers = new Set();
    for (const fact of sourceFacts) {
      if (answers.has(fact.answer)) continue;
      answers.add(fact.answer);
      uniqueFacts.push(fact);
      if (uniqueFacts.length === 4) break;
    }
    if (uniqueFacts.length === 4) {
      matchingItems = uniqueFacts.map((fact, index) => ({ value: `q${index + 1}`, label: fact.prompt }));
      matchingOptions = uniqueFacts.map((fact, index) => ({ value: `a${index + 1}`, label: fact.answer }));
      matchingCorrect = uniqueFacts.map((fact, index) => `q${index + 1}=a${index + 1}`).join('|');
    }
  }
  if (!matchingItems) {
    matchingItems = [
      { value: 'concept', label: `Ý chính/khái niệm của bài “${title}”` },
      { value: 'example', label: 'Ví dụ minh họa' },
      { value: 'method', label: 'Cách thực hiện từng bước' },
      { value: 'verification', label: 'Bước kiểm tra kết quả' }
    ];
    matchingOptions = [
      { value: 'definition', label: 'Nêu nội dung cốt lõi cần hiểu' },
      { value: 'illustration', label: 'Cho thấy cách áp dụng vào trường hợp cụ thể' },
      { value: 'procedure', label: 'Mô tả trình tự thao tác hoặc lập luận' },
      { value: 'validation', label: 'Đối chiếu kết quả với yêu cầu/dữ kiện' }
    ];
    matchingCorrect = 'concept=definition|example=illustration|method=procedure|verification=validation';
  }
  for (let index = 0; index < 8; index += 1) {
    const questionId = `${prefix}-match-${String(index + 1).padStart(2, '0')}`;
    records.push({ id: questionId, questionId, type: 'matching', prompt: `${matchingFrames[index]} trong bài “${title}”.`, matchingItems, options: deterministicShuffle(matchingOptions, `${questionId}:options`), correctAnswer: matchingCorrect, acceptedAnswers: [matchingCorrect], explanation: 'Ghép theo nội dung đúng của câu hỏi và đối chiếu lại từng cặp trước khi nộp.', purpose: 'assessment', points: 3, difficulty: 'medium', taxonomy: 'apply', contentQualityVersion: 'V6.1.1', ...metadata });
  }

  const orderingFrames = [
    'Sắp xếp trình tự giải quyết nhiệm vụ theo thứ tự hợp lý', 'Sắp xếp các bước để tạo lời giải có thể kiểm chứng',
    'Đặt các hoạt động theo thứ tự từ đọc đề đến rà soát kết quả', 'Sắp xếp tiến trình vận dụng bài học',
    'Đặt quy trình làm bài theo đúng thứ tự', 'Sắp xếp các bước thực hiện nhiệm vụ “' + title + '”',
    'Sắp xếp thứ tự xử lý để tránh bỏ sót dữ kiện', 'Sắp xếp các bước hoàn tất và tự đánh giá bài làm'
  ];
  const canonicalSteps = [
    { value: 'read', label: 'Đọc yêu cầu và xác định nhiệm vụ' },
    { value: 'identify', label: 'Xác định dữ kiện/kiến thức liên quan' },
    { value: 'apply', label: 'Thực hiện cách giải hoặc nhiệm vụ' },
    { value: 'verify', label: 'Kiểm tra kết quả theo yêu cầu' }
  ];
  const correctSequence = canonicalSteps.map((item) => item.value).join('|');
  for (let index = 0; index < 8; index += 1) {
    const questionId = `${prefix}-order-${String(index + 1).padStart(2, '0')}`;
    records.push({ id: questionId, questionId, type: 'ordering', prompt: `${orderingFrames[index]}. Chọn một bước cho mỗi vị trí từ 1 đến 4.`, orderingItems: deterministicShuffle(canonicalSteps, `${questionId}:steps`), options: deterministicShuffle(canonicalSteps, `${questionId}:options`).map((item) => ({ value: item.value, label: item.label })), correctAnswer: correctSequence, acceptedAnswers: [correctSequence], explanation: 'Đọc yêu cầu trước, xác định dữ kiện, thực hiện rồi mới kiểm tra kết quả.', purpose: 'assessment', points: 3, difficulty: 'medium', taxonomy: 'apply', contentQualityVersion: 'V6.1.1', ...metadata });
  }
  return records;
}

module.exports = { buildExtendedQuestionTypes };
