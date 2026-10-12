'use strict';
const primary = require('../curriculum/primary/primary-curriculum');
const lower = require('./lower-secondary/question-bank');
const { buildExtendedQuestionTypes } = require('./extended-types');
const crypto = require('node:crypto');
function stableShuffle(values, seed) {
  const output = [...values];
  let state = crypto.createHash('sha256').update(String(seed)).digest().readUInt32BE(0);
  for (let i = output.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}
function primaryMathEntry(grade, lesson, index, offset = 0) {
  const i = index + offset + 1;
  const title = String(lesson.title || '').toLocaleLowerCase('vi-VN');
  let prompt = '', answer = 0, wrongs = [], explanation = 'Đọc kỹ dữ kiện, thực hiện theo quy tắc đã học và kiểm tra lại kết quả.';
  const decimal = (value) => (Number(value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')).replace('.', ',');
  if (/phần trăm|tỉ số phần trăm/.test(title)) {
    const rate = [5, 10, 20, 25, 40, 50, 75][(i - 1) % 7];
    const total = 100 + ((i * 13) % 15) * 20;
    answer = total * rate / 100;
    prompt = `Tính ${rate}% của ${total} = ?`;
    wrongs = [answer + rate, total / rate, answer - 5];
    explanation = 'Đổi tỉ lệ phần trăm thành phân số có mẫu số 100 rồi nhân với số đã cho.';
  } else if (/thập phân/.test(title)) {
    const a = ((i * 7) % 91 + 10) / 10;
    const b = ((i * 11) % 81 + 10) / 100;
    answer = Number((a + b).toFixed(2));
    prompt = `Tính ${decimal(a)} + ${decimal(b)} = ?`;
    wrongs = [Number((answer + 0.1).toFixed(2)), Number((answer - 0.2).toFixed(2)), Number((a * b).toFixed(2))];
    answer = decimal(answer); wrongs = wrongs.map(decimal);
    explanation = 'Đặt dấu phẩy thẳng cột theo hàng thập phân rồi cộng và kiểm tra lại.';
  } else if (/phân số/.test(title)) {
    const denominator = 4 + (i % 11) + Math.floor(i / 11) * 11;
    const a = 1 + (i % (denominator - 1));
    const b = 1 + ((i * 2) % (denominator - 1));
    answer = `${a + b}/${denominator}`;
    prompt = `Tính ${a}/${denominator} + ${b}/${denominator} = ?`;
    wrongs = [`${a + b}/${denominator * 2}`, `${a * b}/${denominator}`, `${a + b + 1}/${denominator}`];
    explanation = 'Với hai phân số cùng mẫu, cộng các tử số và giữ nguyên mẫu số; rút gọn nếu cần.';
  } else if (/diện tích|thể tích|chu vi|hình chữ nhật|hình tam giác|hình thang/.test(title)) {
    const length = i + 3, width = (i % 8) + 2, height = i + 2;
    if (/thể tích/.test(title)) { answer = length * width * height; prompt = `Hình hộp chữ nhật dài ${length} cm, rộng ${width} cm, cao ${height} cm. Thể tích bằng bao nhiêu cm³?`; wrongs = [length * width, 2 * (length + width + height), answer + length]; explanation = 'Thể tích hình hộp chữ nhật bằng chiều dài nhân chiều rộng nhân chiều cao.'; }
    else if (/chu vi/.test(title)) { answer = 2 * (length + width); prompt = `Hình chữ nhật dài ${length} cm, rộng ${width} cm. Chu vi bằng bao nhiêu cm?`; wrongs = [length * width, length + width, 2 * length + width]; explanation = 'Chu vi hình chữ nhật bằng hai lần tổng chiều dài và chiều rộng.'; }
    else if (/hình tam giác/.test(title)) { answer = length * width / 2; prompt = `Tam giác có đáy ${length} cm và chiều cao ${width} cm. Diện tích bằng bao nhiêu cm²?`; wrongs = [length * width, length + width, 2 * (length + width)]; explanation = 'Diện tích tam giác bằng một nửa tích độ dài đáy và chiều cao tương ứng.'; }
    else if (/hình thang/.test(title)) { const upper = width + 2; answer = (width + upper) * height / 2; prompt = `Hình thang có hai đáy ${width} cm, ${upper} cm và chiều cao ${height} cm. Diện tích bằng bao nhiêu cm²?`; wrongs = [(width + upper) * height, width * upper, width + upper + height]; explanation = 'Diện tích hình thang bằng tổng hai đáy nhân chiều cao rồi chia 2.'; }
    else { answer = length * width; prompt = `Hình chữ nhật dài ${length} cm, rộng ${width} cm. Diện tích bằng bao nhiêu cm²?`; wrongs = [2 * (length + width), length + width, answer + 2]; explanation = 'Diện tích hình chữ nhật bằng chiều dài nhân chiều rộng.'; }
  } else if (/góc|đường thẳng|hình học|hình phẳng/.test(title)) {
    const angle = 15 + ((i * 17) % 150);
    answer = angle < 90 ? 'nhọn' : angle === 90 ? 'vuông' : 'tù';
    prompt = `Một góc có số đo ${angle}°. Đó là góc gì?`;
    wrongs = ['nhọn', 'vuông', 'tù'].filter((value) => value !== answer);
    explanation = 'Góc nhọn nhỏ hơn 90°, góc vuông bằng 90°, góc tù lớn hơn 90° và nhỏ hơn 180°.';
  } else if (/nhân|chia|bảng nhân|bảng chia|tích|thương/.test(title)) {
    const a = 2 + i, b = 2 + ((i * 3) % 9);
    if (i % 2 === 0) { answer = a * b; prompt = `Tính ${a} × ${b} = ?`; wrongs = [a + b, answer + a, answer - b]; }
    else { answer = a; prompt = `Có ${a * b} đồ vật chia đều vào ${b} nhóm. Mỗi nhóm có bao nhiêu đồ vật?`; wrongs = [a + b, a * b, b]; }
    explanation = 'Chọn đúng phép tính, thực hiện cẩn thận và thử lại bằng phép tính ngược.';
  } else if (grade <= 2) {
    const a = 5 + (i % 15), b = 1 + ((i * 3) % 12);
    if (i % 2 === 0) { answer = a + b; prompt = `Tính ${a} + ${b} = ?`; wrongs = [a + b + 1, a - b, a * b]; }
    else { const larger = Math.max(a, b) + 6; const smaller = Math.min(a, b); answer = larger - smaller; prompt = `Tính ${larger} − ${smaller} = ?`; wrongs = [larger + smaller, larger - smaller + 1, smaller - larger]; }
    explanation = 'Có thể dùng que tính, hình vẽ hoặc tách số để kiểm tra kết quả.';
  } else {
    const a = i * 7 + 18, b = i * 3 + 9;
    if (i % 3 === 0) { answer = a * b; prompt = `Tính ${a} × ${b} = ?`; wrongs = [a + b, answer + a, answer - b]; }
    else if (i % 3 === 1) { answer = a + b; prompt = `Tính ${a} + ${b} = ?`; wrongs = [a * b, answer + 10, a - b]; }
    else { answer = a - b; prompt = `Tính ${a} − ${b} = ?`; wrongs = [a + b, b - a, answer + 1]; }
    explanation = 'Xác định phép tính, ghi các bước và kiểm tra bằng ước lượng hoặc phép tính ngược.';
  }
  const uniqueWrongs = [...new Set(wrongs.map(String).filter((value) => value !== String(answer)))];
  while (uniqueWrongs.length < 3) uniqueWrongs.push(String(Number(answer) + uniqueWrongs.length + 1));
  return { prompt, answer: String(answer), wrongs: uniqueWrongs.slice(0, 3), explanation };
}

function primaryPool({ programCode, grade, subjectCode, lesson }) {
  const prefix = `psq-${programCode}-g${grade}-${subjectCode}-${lesson.id.replace(/[^a-z0-9-]/gi, '-')}`;
  const topicTag = lesson.topicTag || lesson.id.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const unitId = lesson.id.replace(/-l\d+$/, '');
  const metadata = { programCode, grade, subjectCode, lessonId: lesson.id, unitId, topicTag, topicTitle: lesson.title, contentStatus: 'draft-teacher-review-required', source: 'curriculum-aligned-generated-draft', curriculumAlignmentId: lesson.alignment?.alignmentId || '', mappedStrand: lesson.alignment?.mappedStrand || '', competencyFocus: lesson.alignment?.competencyFocus || [], intendedOutcomes: lesson.alignment?.intendedOutcomes || [], assessmentBlueprint: lesson.alignment?.assessmentBlueprint || { remember: 25, understand: 35, apply: 25, analyzeCreate: 15 }, alignmentStatus: lesson.alignment?.status || 'draft-teacher-review-required' };
  const rawSeeds = [...(lesson.assessmentQuestions || []), ...(lesson.parts || []).flatMap((part) => part.checkpoint || [])].filter((item) => ['multiple_choice', 'fill_blank'].includes(item.type));
  const sourceSeeds = [];
  const seen = new Set();
  for (const item of rawSeeds) {
    const answer = String(item.correctAnswer || item.acceptedAnswers?.[0] || '').trim();
    const key = `${item.prompt}|${answer}`;
    if (answer && !seen.has(key)) { seen.add(key); sourceSeeds.push({ prompt: item.prompt, answer, options: (item.options || []).map((option) => typeof option === 'string' ? option : option.value), explanation: item.explanation || '' }); }
  }
  if (!sourceSeeds.length) sourceSeeds.push({ prompt: `Ý chính của bài “${lesson.title}” là gì?`, answer: lesson.title, options: [], explanation: 'Đối chiếu với mục tiêu bài học.' });
  const frame = (prompt, index) => {
    const frames = [
      (value, context) => `Đọc câu hỏi sau và chọn đáp án: ${value} Bối cảnh: ${context}.`,
      (value, context) => `Trong bài “${lesson.title}”, câu hỏi nào cần được trả lời? ${value} Bối cảnh: ${context}.`,
      (value, context) => `Khi ${context}, em hãy dùng kiến thức bài “${lesson.title}” để trả lời: ${value}`,
      (value, context) => `Hãy chọn đáp án có căn cứ cho bài “${lesson.title}”: ${value} Tình huống: ${context}.`,
      (value, context) => `Câu tự kiểm tra kiến thức “${lesson.title}”: ${value} Hoàn cảnh: ${context}.`,
      (value, context) => `Em đang giải thích cho bạn về “${lesson.title}”. Trả lời câu hỏi: ${value} Bối cảnh: ${context}.`,
      (value, context) => `Khi rà soát bài làm về “${lesson.title}”, em cần trả lời: ${value} Trường hợp: ${context}.`,
      (value, context) => `Câu hỏi nhận biết và hiểu bài “${lesson.title}”: ${value} Bối cảnh: ${context}.`,
      (value, context) => `Câu hỏi vận dụng kiến thức “${lesson.title}”: ${value} Tình huống: ${context}.`,
      (value, context) => `Để chứng minh em hiểu bài “${lesson.title}”, hãy trả lời: ${value} Trường hợp: ${context}.`,
      (value, context) => `Chọn phương án đúng sau khi xem lại bài “${lesson.title}”: ${value} Bối cảnh: ${context}.`,
      (value, context) => `Câu hỏi ôn tập cuối bài “${lesson.title}”: ${value} Hoàn cảnh: ${context}.`
    ];
    const contexts = ['làm bài cá nhân', 'trao đổi cùng bạn', 'ôn tập tại nhà', 'kiểm tra lại sản phẩm học tập'];
    return frames[index % frames.length](prompt, contexts[Math.floor(index / frames.length) % contexts.length]);
  };
  const results = [];
  const mcItems = [];
  for (let index = 0; index < 32; index += 1) {
    const item = subjectCode === 'math' ? primaryMathEntry(grade, lesson, index, 0) : (() => {
      const base = sourceSeeds[index % sourceSeeds.length];
      return { ...base, prompt: frame(base.prompt, index) };
    })();
    const answer = String(item.answer);
    const distractors = [...new Set([...(item.wrongs || []), ...sourceSeeds.map((seed) => seed.answer), ...sourceSeeds.flatMap((seed) => seed.options), 'Đáp án chưa có căn cứ trong bài học.'].map(String).filter((value) => value && value !== answer))].slice(0, 3);
    while (distractors.length < 3) distractors.push(`Phương án nhiễu ${distractors.length + 1}`);
    const options = stableShuffle([answer, ...distractors], `${prefix}:mc:${index}`).map((value) => ({ value, label: value }));
    const questionId = `${prefix}-mc-${String(index + 1).padStart(2, '0')}`;
    mcItems.push({ id: questionId, questionId, type: 'multiple_choice', prompt: item.prompt, options, correctAnswer: answer, acceptedAnswers: [answer], points: 1, explanation: item.explanation || 'Đối chiếu với nội dung và ví dụ đã học.', ...metadata, purpose: 'assessment' });
  }
  results.push(...mcItems);

  for (let index = 0; index < 16; index += 1) {
    let prompt, answer, explanation;
    if (subjectCode === 'math') {
      const item = primaryMathEntry(grade, lesson, index, 100);
      prompt = `Điền kết quả vào chỗ trống: ${item.prompt.replace(/= \?$/, '= _____')}`;
      answer = item.answer; explanation = item.explanation;
    } else {
      const base = sourceSeeds[index % sourceSeeds.length];
      const blanks = [
        [`Từ khóa hoặc kết quả chính của bài “${lesson.title}” là _____.`, base.answer],
        [`Hoàn thành yêu cầu sau: ${base.prompt} Kết quả em chọn là _____.`, base.answer],
        [`Sau khi đọc câu hỏi trong bài “${lesson.title}”, hãy điền đáp án: _____.`, base.answer],
        [`Viết lại đáp án có căn cứ cho câu hỏi: ${base.prompt} → _____.`, base.answer]
      ];
      [prompt, answer] = blanks[index % blanks.length]; prompt += ` (luyện tập ${index + 1})`; explanation = base.explanation;
    }
    const questionId = `${prefix}-fill-${String(index + 1).padStart(2, '0')}`;
    results.push({ id: questionId, questionId, type: 'fill_blank', prompt, options: [], correctAnswer: String(answer), acceptedAnswers: [String(answer)], points: 1, explanation: explanation || 'Đọc kỹ yêu cầu và tự kiểm tra câu trả lời.', ...metadata, purpose: 'assessment' });
  }
  const shortPrompts = [
    `Nêu ý chính của bài “${lesson.title}” bằng lời của em.`, `Tạo một ví dụ mới minh họa cho kiến thức vừa học và giải thích.`, `Trình bày các bước em dùng để giải quyết một nhiệm vụ của bài.`, `Nêu lỗi thường gặp và cách em kiểm tra để phát hiện lỗi đó.`,
    `Giải thích mối liên hệ giữa mục tiêu bài học và ví dụ đã học.`, `Đưa ra kết luận cho một tình huống thuộc bài và nêu căn cứ.`, `So sánh hai cách làm và chọn cách phù hợp hơn, giải thích lý do.`, `Viết một câu hỏi tự luyện liên quan đến bài và cho biết cách kiểm tra đáp án.`,
    `Xác định thông tin cần có trước khi thực hiện nhiệm vụ trong bài.`, `Phân biệt dữ kiện quan sát được với suy luận của em về chủ đề.`, `Mô tả cách kiểm tra tính hợp lý của kết quả bằng một cách khác.`, `Nêu một tình huống không phù hợp để áp dụng cách làm vừa học và giải thích.`,
    `Viết một hướng dẫn ngắn để bạn khác tự đánh giá xem đã đạt mục tiêu bài chưa.`, `Đề xuất một thay đổi nhỏ giúp lời giải hoặc sản phẩm rõ ràng hơn.`, `Ghi hai câu hỏi em còn thắc mắc về nội dung và cách tìm câu trả lời.`, `Tóm tắt một minh chứng cho thấy em đã vận dụng được kiến thức của bài.`
  ];
  shortPrompts.forEach((prompt, index) => { const id = `${prefix}-short-${index + 1}`; results.push({ id, questionId: id, type: 'short_answer', prompt, options: [], correctAnswer: '', acceptedAnswers: [], points: 1, rubric: ['Đúng nội dung bài học', 'Có lý giải hoặc ví dụ', 'Trình bày rõ ràng'], ...metadata, purpose: 'assessment' }); });
  const essayPrompts = [
    `Trình bày kiến thức chính của bài “${lesson.title}” và minh họa bằng một ví dụ.`, `Giải thích vì sao cách làm hoặc nhận định của em phù hợp với nội dung bài.`, `Xây dựng một tình huống liên quan đến bài học, giải quyết và kiểm tra kết quả.`, `So sánh hai cách tiếp cận trong bài và nêu ưu điểm của cách phù hợp hơn.`,
    `Phân tích một lỗi dễ gặp khi học bài và trình bày cách khắc phục.`, `Vận dụng kiến thức vào một tình huống mới, ghi các bước và kết luận.`, `Viết hướng dẫn để bạn học khác hiểu được ý chính và cách áp dụng bài học.`, `Tạo một nhiệm vụ thực hành gắn với bài và nêu tiêu chí đánh giá kết quả.`,
    `Lập bảng phân tích dữ kiện, cách giải và cách kiểm tra kết quả của một tình huống mới.`, `Đề xuất một cách kiểm chứng độc lập cho kết luận của em và giải thích giới hạn của nó.`, `Viết phản hồi có căn cứ cho một lời giải sai thường gặp trong bài.`, `Thiết kế một hoạt động nhóm để vận dụng kiến thức, phân vai và nêu sản phẩm cần nộp.`,
    `Phân tích hai phương án trả lời theo độ chính xác, bằng chứng và mức độ phù hợp yêu cầu.`, `Tạo bộ tiêu chí tự đánh giá có thể quan sát hoặc đo được cho bài học.`, `Liên hệ kiến thức với đời sống hoặc môn học khác bằng một ví dụ đã kiểm chứng.`, `Tổng kết bài thành kế hoạch ôn tập gồm mục tiêu, hoạt động và minh chứng hoàn thành.`
  ];
  essayPrompts.forEach((prompt, index) => { const id = `${prefix}-essay-${index + 1}`; results.push({ id, questionId: id, type: 'essay', prompt, options: [], correctAnswer: '', acceptedAnswers: [], points: 1, rubric: ['Bám sát yêu cầu', 'Kiến thức phù hợp lứa tuổi', 'Có ví dụ hoặc các bước giải', 'Trình bày mạch lạc'], ...metadata, purpose: 'assessment' }); });

  const extendedMetadata = { ...metadata, unitId, topicTag, topicTitle: lesson.title, purpose: 'assessment' };
  results.push(...buildExtendedQuestionTypes({ prefix, lesson, sourceQuestions: mcItems, metadata: extendedMetadata }));

  // The checkpoint bank is generated from a different numeric range or dedicated learning prompts.
  for (const [partIndex, part] of (lesson.parts || []).entries()) {
    for (let index = 0; index < 8; index += 1) {
      let prompt, answer, wrongs, explanation;
      if (subjectCode === 'math') {
        const item = primaryMathEntry(grade, lesson, index, 50 + partIndex * 12);
        prompt = `Phần “${part.title}”: ${item.prompt}`; answer = item.answer; wrongs = item.wrongs; explanation = item.explanation;
      } else {
        const seeds = (part.checkpoint || []).filter((item) => item.type === 'multiple_choice' || item.type === 'fill_blank');
        const base = seeds[index % Math.max(1, seeds.length)] || sourceSeeds[(index + partIndex) % sourceSeeds.length];
        answer = String(base.correctAnswer || base.acceptedAnswers?.[0] || sourceSeeds[0].answer);
        const variants = [
          `Phần “${part.title}”: hãy xác định đáp án cho câu hỏi sau: ${base.prompt}`,
          `Sau khi học phần “${part.title}”, em chọn câu trả lời nào? ${base.prompt}`,
          `Câu hỏi nhanh cuối phần “${part.title}”: ${base.prompt}`,
          `Áp dụng ngay kiến thức của phần “${part.title}”: ${base.prompt}`,
          `Tự kiểm tra mức hiểu phần “${part.title}”: ${base.prompt}`,
          `Đọc dữ kiện thuộc phần “${part.title}” rồi trả lời: ${base.prompt}`,
          `Củng cố kiến thức của phần “${part.title}”: ${base.prompt}`,
          `Thử vận dụng lại kiến thức phần “${part.title}”: ${base.prompt}`
        ];
        prompt = variants[index]; wrongs = (base.options || []).map((option) => typeof option === 'string' ? option : option.value).filter((value) => String(value) !== answer); explanation = base.explanation || 'Đối chiếu với nội dung phần học.';
      }
      const options = stableShuffle([String(answer), ...[...new Set((wrongs || []).map(String).filter((value) => value && value !== String(answer)))].slice(0, 3)], `${prefix}:checkpoint:${part.id}:${index}`).map((value) => ({ value, label: value }));
      while (options.length < 4) options.push({ value: `Nhiễu ${options.length + 1}`, label: `Nhiễu ${options.length + 1}` });
      const id = `${prefix}-checkpoint-${part.id}-${index + 1}`;
      results.push({ id, questionId: id, type: 'multiple_choice', prompt, options, correctAnswer: String(answer), acceptedAnswers: [String(answer)], points: 1, explanation, ...metadata, purpose: 'checkpoint', partId: part.id });
    }
  }
  const classify = (item) => {
    const match = String(item.questionId || item.id || '').match(/-(mc|fill|short|essay|checkpoint)-[a-z0-9-]*?(\d+)$/i);
    const index = match ? Number(match[2]) : 1;
    let taxonomy = item.taxonomy || 'understand';
    if (item.purpose === 'checkpoint') taxonomy = index <= 2 ? 'remember' : index <= 5 ? 'understand' : 'apply';
    else if (item.type === 'multiple_choice') taxonomy = index <= 12 ? 'remember' : index <= 30 ? 'understand' : index <= 41 ? 'apply' : 'analyze';
    else if (item.type === 'fill_blank') taxonomy = index <= 4 ? 'remember' : index <= 10 ? 'understand' : 'apply';
    else if (item.type === 'short_answer') taxonomy = index <= 4 ? 'understand' : index <= 12 ? 'apply' : 'analyze';
    else if (item.type === 'essay') taxonomy = index <= 4 ? 'apply' : index <= 12 ? 'analyze' : 'create';
    const difficulty = taxonomy === 'remember' ? 'easy' : ['analyze', 'create'].includes(taxonomy) ? 'hard' : 'medium';
    return { ...item, taxonomy, difficulty };
  };
  return results.map(classify);
}

function buildQuestionPool(context) {
  return Number(context.grade) >= 6 ? lower.buildQuestionPool(context) : primaryPool(context);
}
function buildBankRecords(course) {
  const records = [];
  for (const unit of course.units) for (const lesson of unit.lessons) {
    const questions = buildQuestionPool({ programCode: course.programCode, grade: course.grade, subjectCode: course.subjectCode, lesson });
    for (const question of questions.filter((item) => ['assessment', 'checkpoint'].includes(item.purpose))) {
      const { purpose, topicTitle, contentStatus, ...record } = question;
      records.push({ ...record, purpose, partId: question.partId || '', courseId: course.id, unitId: unit.id, topicTitle: topicTitle || lesson.title, contentStatus: contentStatus || 'draft-teacher-review-required', active: false, bankVersion: 'V6.1.1' });
    }
  }
  return records;
}
module.exports = { buildQuestionPool, buildBankRecords, pickRandom: lower.pickRandom };
