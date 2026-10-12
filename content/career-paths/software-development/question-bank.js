'use strict';
const catalog = require('../catalog');

function unique(values, exclude = '') {
  const result = [];
  const seen = new Set([String(exclude).trim()]);
  for (const raw of values) {
    const value = String(raw || '').trim();
    if (value && !seen.has(value)) { seen.add(value); result.push(value); }
  }
  return result;
}
function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}
function shuffle(values, seed) {
  const output = values.slice();
  let state = hash(seed) || 1;
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const other = state % (index + 1);
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}
function makeOptions(answer, candidates, seed) {
  const distractors = unique(candidates, answer).slice(0, 3);
  while (distractors.length < 3) distractors.push(`Phương án chưa phù hợp ${distractors.length + 1}`);
  return shuffle([answer, ...distractors], seed).map((value, index) => ({ value, label: `${String.fromCharCode(65 + index)}. ${value}` }));
}
function concise(value, max = 190) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}
function question(course, module, lesson, suffix, type, prompt, answer, extras = {}) {
  return {
    questionId: `career-v6111-${course.id}-${lesson.id}-${suffix}`,
    courseId: course.id, moduleId: module.id, lessonId: lesson.id,
    type, prompt, options: extras.options || [], correctAnswer: String(answer ?? ''),
    acceptedAnswers: extras.acceptedAnswers || (answer ? [String(answer)] : []),
    explanation: extras.explanation || `Đối chiếu với mục tiêu, phần kiến thức và sản phẩm thực hành của bài “${lesson.title}”.`,
    rubric: extras.rubric || [], points: extras.points || 1,
    difficulty: extras.difficulty || 'medium', taxonomy: extras.taxonomy || 'understand',
    topicTags: [course.id, module.id, lesson.id], source: 'curriculum-derived-template',
    contentStatus: 'draft-teacher-review-required', active: false, bankVersion: 'V6.1.1'
  };
}

function buildLessonQuestionBank(course, module, lesson, courseLessons) {
  const others = courseLessons.filter((item) => item.id !== lesson.id);
  const objectives = others.map((item) => item.objective);
  const practices = others.map((item) => item.practice);
  const deliverables = others.map((item) => item.deliverable);
  const objective = concise(lesson.objective);
  const material = concise(lesson.material);
  const practice = concise(lesson.practice);
  const deliverable = concise(lesson.deliverable);
  const materialPrinciple = concise(material.split(/[.!?;]/)[0], 190);
  const hasCodeEditor = Boolean(lesson.codeExercise?.enabled);
  const practicalQuestionType = hasCodeEditor ? 'code_challenge' : 'design_task';
  const practicalQuestionVerb = hasCodeEditor ? 'Hoàn thành và chạy thử' : 'Thực hiện và ghi lại minh chứng';
  const result = [];
  const makeMc = (suffix, prompt, answer, distractors, taxonomy = 'understand') => result.push(question(course, module, lesson, suffix, 'multiple_choice', prompt, answer, {
    options: makeOptions(answer, distractors, `${course.id}:${lesson.id}:${suffix}`), taxonomy,
    explanation: `Đáp án bám sát bài “${lesson.title}”: ${concise(answer, 140)}`
  }));
  makeMc('mc-goal', `Mục tiêu trọng tâm của bài “${lesson.title}” là gì?`, objective, objectives, 'remember');
  makeMc('mc-practice', `Nhiệm vụ thực hành nào phù hợp nhất với bài “${lesson.title}”?`, practice, practices, 'apply');
  makeMc('mc-output', `Minh chứng nào phù hợp nhất để đánh giá bài “${lesson.title}”?`, deliverable, deliverables, 'apply');
  makeMc('mc-principle', `Nhận định nào tóm tắt đúng phần kiến thức cốt lõi của “${lesson.title}”?`, materialPrinciple, others.map((item) => concise(item.material.split(/[.!?;]/)[0], 190)), 'understand');
  makeMc('mc-first-step', `Khi bắt đầu bài “${lesson.title}”, việc nào cần được thực hiện để luyện đúng mục tiêu?`, practice, unique([...practices, ...objectives]), 'apply');
  makeMc('mc-quality', `Sản phẩm nào nên được kiểm tra khi đánh giá mức hoàn thành bài “${lesson.title}”?`, deliverable, unique([...deliverables, ...practices]), 'analyze');

  result.push(question(course, module, lesson, 'tf-goal', 'true_false', `Đúng hay sai: Mục tiêu của bài “${lesson.title}” là “${objective}”.`, 'true', {
    options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], taxonomy: 'remember',
    explanation: `Mục tiêu của bài là: ${objective}`
  }));
  result.push(question(course, module, lesson, 'tf-skip-tests', 'true_false', `Đúng hay sai: Có thể kết luận đã thành thạo bài “${lesson.title}” mà không cần làm nhiệm vụ thực hành hoặc xem lại minh chứng.`, 'false', {
    options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], taxonomy: 'understand',
    explanation: 'Cần có thao tác thực hành và minh chứng để đánh giá việc đạt mục tiêu.'
  }));
  result.push(question(course, module, lesson, 'fill-title', 'fill_blank', `Điền tiêu đề chính xác của bài đang học: “_____”.`, lesson.title, {
    acceptedAnswers: [lesson.title, lesson.title.toLocaleLowerCase('vi-VN')], taxonomy: 'remember',
    explanation: 'Tên bài giúp liên kết câu hỏi với đúng nội dung trong lộ trình.'
  }));
  result.push(question(course, module, lesson, 'fill-deliverable', 'fill_blank', `Điền sản phẩm/minh chứng cần bàn giao ở bài “${lesson.title}”: _____`, deliverable, {
    acceptedAnswers: [lesson.deliverable], taxonomy: 'remember',
    explanation: `Minh chứng được yêu cầu: ${deliverable}`
  }));
  result.push(question(course, module, lesson, 'short-explain', 'short_answer', `Diễn đạt lại mục tiêu “${lesson.title}” bằng lời của bạn và nêu vì sao mục tiêu đó hữu ích.`, '', {
    rubric: ['Diễn đạt đúng mục tiêu', 'Có lý do hoặc ví dụ liên quan', 'Không chỉ chép lại tiêu đề'], points: 3, taxonomy: 'understand', difficulty: 'easy'
  }));
  result.push(question(course, module, lesson, 'short-steps', 'short_answer', `Trình bày các bước bạn sẽ làm để hoàn thành nhiệm vụ: ${practice}`, '', {
    rubric: ['Bước thực hiện có trình tự', 'Bám sát nhiệm vụ', 'Có cách kiểm tra kết quả'], points: 4, taxonomy: 'apply'
  }));
  result.push(question(course, module, lesson, 'short-edge', 'short_answer', `Nêu ít nhất hai trường hợp biên hoặc lỗi có thể gặp khi thực hiện bài “${lesson.title}” và cách kiểm tra chúng.`, '', {
    rubric: ['Nêu được hai trường hợp cụ thể', 'Có cách tái hiện hoặc kiểm tra', 'Có hướng xử lý hợp lý'], points: 4, taxonomy: 'analyze'
  }));
  result.push(question(course, module, lesson, 'short-tradeoff', 'short_answer', `Nêu một phương án khác để xử lý nhiệm vụ của bài “${lesson.title}”. So sánh ưu/nhược điểm của hai phương án.`, '', {
    rubric: ['Có phương án khác khả thi', 'Nêu được ít nhất một ưu điểm và nhược điểm', 'Kết luận có căn cứ'], points: 4, taxonomy: 'analyze'
  }));
  result.push(question(course, module, lesson, 'essay-apply', 'essay', `Bài vận dụng: Hãy áp dụng kiến thức “${lesson.title}” vào một tình huống mới không trùng ví dụ đã học. Trình bày giả định, các bước làm, cách kiểm tra và kết quả mong đợi.`, '', {
    rubric: ['Xác định đúng vấn đề', 'Áp dụng kiến thức bài học', 'Giải pháp có thể kiểm chứng', 'Nêu giới hạn hoặc trường hợp biên'], points: 10, taxonomy: 'create', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'essay-review', 'essay', `Viết một bài giải thích ngắn để hướng dẫn bạn khác học “${lesson.title}”. Bao gồm khái niệm, ví dụ, lỗi thường gặp và checklist tự đánh giá.`, '', {
    rubric: ['Giải thích chính xác', 'Ví dụ minh họa phù hợp', 'Nêu lỗi và cách tránh', 'Checklist đánh giá được'], points: 10, taxonomy: 'create', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'code-task', practicalQuestionType, `${hasCodeEditor ? 'Bài lập trình/thực hành' : 'Bài lab ứng dụng'}: ${practicalQuestionVerb} nhiệm vụ dựa trên nội dung “${lesson.title}”: ${practice} ${hasCodeEditor ? 'Gửi mã nguồn, ví dụ đầu vào/đầu ra và cách chạy.' : 'Gửi các bước thực hiện, minh chứng, tiêu chí kiểm tra và kết quả mong đợi.'}`, '', {
    rubric: ['Giải pháp đáp ứng yêu cầu', 'Xử lý đầu vào và lỗi hợp lý', 'Có ví dụ kiểm thử', 'Mã/diễn giải dễ đọc'], points: 10, taxonomy: 'apply', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'code-tests', practicalQuestionType, `${hasCodeEditor ? 'Bổ sung ít nhất 5 test case' : 'Lập checklist ít nhất 5 trường hợp kiểm tra'} cho sản phẩm “${deliverable}”: gồm ca bình thường, biên và dữ liệu không hợp lệ. Ghi rõ kết quả mong đợi.`, '', {
    rubric: ['Có ít nhất 5 test case', 'Bao gồm trường hợp biên', 'Có kết quả mong đợi', 'Test liên quan đến mục tiêu bài'], points: 8, taxonomy: 'analyze', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'debug-default', 'debugging', `Tình huống debug: giải pháp cho bài “${lesson.title}” chạy được với ví dụ đơn giản nhưng thất bại với một dữ liệu khác. Hãy nêu ba giả thuyết, cách kiểm tra từng giả thuyết và bản sửa đề xuất.`, '', {
    rubric: ['Giả thuyết cụ thể', 'Bước tái hiện/quan sát', 'Bản sửa có lập luận', 'Test hồi quy'], points: 8, taxonomy: 'analyze', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'debug-regression', 'debugging', `Sau khi thay đổi để hoàn thành “${lesson.title}”, một chức năng cũ có thể bị hỏng. Thiết kế cách tái hiện lỗi, xác định nguyên nhân và chứng minh bản sửa không làm hỏng chức năng khác.`, '', {
    rubric: ['Nêu được đường đi tái hiện', 'Phân biệt nguyên nhân và triệu chứng', 'Có test hồi quy', 'Giải thích phạm vi ảnh hưởng'], points: 8, taxonomy: 'analyze', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'design-task', 'design_task', `Thiết kế mini-project thể hiện năng lực “${lesson.title}”. Nêu người dùng, đầu vào/đầu ra, các thành phần chính, tiêu chí chấp nhận và kế hoạch kiểm thử. Sản phẩm mục tiêu: ${deliverable}`, '', {
    rubric: ['Phạm vi vừa sức và rõ', 'Đầu vào/đầu ra cụ thể', 'Thành phần có trách nhiệm rõ', 'Tiêu chí chấp nhận kiểm chứng được', 'Có kế hoạch kiểm thử'], points: 12, taxonomy: 'create', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'case-study', 'essay', `Phân tích một tình huống gần thực tế liên quan đến “${lesson.title}”. Giải thích lựa chọn kỹ thuật, rủi ro, cách xác minh và điều bạn sẽ cải thiện sau khi nhận phản hồi.`, '', {
    rubric: ['Tình huống thực tế rõ ràng', 'Lựa chọn kỹ thuật có lý do', 'Nhận diện rủi ro', 'Đưa ra kế hoạch cải thiện'], points: 10, taxonomy: 'create', difficulty: 'hard'
  }));
  const lessonIndex = courseLessons.findIndex((item) => item.id === lesson.id);
  const previousLesson = lessonIndex > 0 ? courseLessons[lessonIndex - 1] : null;
  const prerequisite = previousLesson ? `Ôn lại bài “${previousLesson.title}” và xác định yêu cầu đầu vào trước khi bắt đầu.` : 'Đọc mục tiêu, xác định đầu vào/đầu ra và điều kiện hoàn thành trước khi thực hành.';
  makeMc('mc-prerequisite', `Trước khi triển khai nhiệm vụ của bài “${lesson.title}”, hành động chuẩn bị nào phù hợp nhất?`, prerequisite, others.map((item) => `Bỏ qua yêu cầu và làm ngay toàn bộ bài “${item.title}”`), 'apply');
  makeMc('mc-evidence', `Bộ minh chứng nào giúp đánh giá có căn cứ việc hoàn thành bài “${lesson.title}”?`, `${deliverable}; kèm cách chạy hoặc kiểm tra và ít nhất một trường hợp biên`, others.map((item) => `${concise(item.deliverable)} mà không liên hệ mục tiêu hiện tại`), 'analyze');
  result.push(question(course, module, lesson, 'tf-single-happy-path', 'true_false', `Đúng hay sai: Chỉ thử một ví dụ thuận lợi là đủ chứng minh sản phẩm “${deliverable}” hoạt động đáng tin cậy.`, 'false', {
    options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], explanation: 'Cần kiểm tra thêm dữ liệu biên, dữ liệu không hợp lệ và điều kiện lỗi phù hợp với bài.', taxonomy: 'analyze', difficulty: 'medium'
  }));
  result.push(question(course, module, lesson, 'fill-verifiable', 'fill_blank', `Một tiêu chí chấp nhận tốt cho nhiệm vụ “${practice}” phải có thể _____ bằng đầu vào và kết quả mong đợi.`, 'kiểm chứng', {
    acceptedAnswers: ['kiểm chứng', 'xác minh', 'kiểm tra'], explanation: 'Tiêu chí chấp nhận cần đủ rõ để người khác có thể xác minh bằng kết quả quan sát được.', taxonomy: 'understand'
  }));
  result.push(question(course, module, lesson, 'short-assumptions', 'short_answer', `Nêu hai giả định bạn đang đặt ra khi thực hiện “${practice}”. Với mỗi giả định, trình bày cách xác minh trước khi hoàn thiện “${deliverable}”.`, '', {
    rubric: ['Nêu hai giả định cụ thể, không trùng nhau', 'Có cách kiểm tra từng giả định', 'Giải thích ảnh hưởng nếu giả định sai'], points: 5, taxonomy: 'analyze', difficulty: 'medium'
  }));
  result.push(question(course, module, lesson, 'short-success-metrics', 'short_answer', `Đề xuất ba tiêu chí đo được để đánh giá chất lượng sản phẩm “${deliverable}”. Nêu cách đo và ngưỡng chấp nhận cho từng tiêu chí.`, '', {
    rubric: ['Có ba tiêu chí liên quan mục tiêu bài', 'Mỗi tiêu chí có cách đo', 'Có ngưỡng/kết quả chấp nhận rõ'], points: 5, taxonomy: 'create', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'essay-tradeoffs', 'essay', `Hai phương án khác nhau có thể giải quyết nhiệm vụ “${practice}”. Hãy so sánh chúng về độ phức tạp, khả năng kiểm thử, bảo trì và rủi ro; chọn một phương án cho bối cảnh cụ thể và giải thích lý do.`, '', {
    rubric: ['Mô tả hai phương án khả thi', 'So sánh tối thiểu ba tiêu chí', 'Nêu giả định/bối cảnh', 'Lựa chọn có căn cứ và rủi ro'], points: 12, taxonomy: 'analyze', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'code-acceptance-tests', practicalQuestionType, `${hasCodeEditor ? 'Viết bộ kiểm thử' : 'Thiết kế checklist xác minh'} cho “${deliverable}”. Phải có ca thành công, giá trị biên, dữ liệu không hợp lệ và kết quả mong đợi cho từng ca.`, '', {
    rubric: ['Bao phủ ít nhất bốn nhóm trường hợp', 'Đầu vào và kết quả mong đợi cụ thể', 'Có cách chạy/tái hiện', 'Các test bám vào mục tiêu bài'], points: 9, taxonomy: 'apply', difficulty: 'hard'
  }));
  result.push(question(course, module, lesson, 'design-test-matrix', 'design_task', `Lập ma trận kiểm thử cho “${deliverable}” gắn với mục tiêu “${objective}”. Với mỗi hàng, ghi loại tình huống, dữ liệu đầu vào, kết quả mong đợi, mức độ ưu tiên và lý do.`, '', {
    rubric: ['Ma trận có ít nhất năm tình huống', 'Bao gồm happy path, biên và lỗi', 'Kết quả mong đợi kiểm chứng được', 'Ưu tiên và lý do hợp lý'], points: 12, taxonomy: 'create', difficulty: 'hard'
  }));
  // V6.1.1 expands the same lesson-scoped question blueprint across all nine IT career groups.
  makeMc('v512-mc-validation', `Với nhiệm vụ “${practice}”, bước nào giúp ngăn dữ liệu không hợp lệ làm hỏng luồng xử lý?`, 'Xác thực đầu vào, báo lỗi rõ ràng và kiểm tra cả trường hợp biên', ['Chỉ kiểm tra một giá trị mẫu thuận lợi', 'Bỏ qua dữ liệu người dùng nhập', 'Ẩn lỗi và coi thao tác luôn thành công'], 'apply');
  makeMc('v512-mc-testability', `Minh chứng nào thuyết phục nhất cho bài “${lesson.title}”?`, 'Có tiêu chí chấp nhận, ca kiểm thử và kết quả mong đợi có thể lặp lại', ['Ảnh chụp màn hình không kèm thao tác', 'Chỉ mô tả rằng “đã chạy được”', 'Không lưu bước tái hiện lỗi'], 'analyze');
  makeMc('v512-mc-maintainability', `Khi mở rộng “${deliverable}”, cách nào giảm chi phí bảo trì về sau?`, 'Tách trách nhiệm, đặt tên rõ và giữ hợp đồng giao tiếp ổn định', ['Gộp mọi chức năng vào một hàm lớn', 'Sao chép logic xử lý vào nhiều nơi', 'Xóa test cũ trước khi thay đổi'], 'analyze');
  makeMc('v512-mc-observability', `Nếu thao tác trong bài “${lesson.title}” thất bại ở máy người dùng, thông tin nào hữu ích nhất để chẩn đoán?`, 'Thông báo lỗi an toàn, mã tương quan và ngữ cảnh kỹ thuật không chứa bí mật', ['Mật khẩu và token của người dùng', 'Một thông báo chung không có mã lỗi', 'Không ghi nhận gì để tránh có log'], 'analyze');
  makeMc('v512-mc-security', `Lựa chọn nào phù hợp khi “${practice}” tiếp nhận dữ liệu từ bên ngoài?`, 'Kiểm tra kiểu, miền giá trị, quyền và giới hạn kích thước trước khi xử lý', ['Tin tưởng mọi dữ liệu gửi lên', 'Chỉ kiểm tra ở giao diện và bỏ qua backend', 'Ghi toàn bộ bí mật vào log khi lỗi'], 'apply');
  makeMc('v512-mc-review', `Một thay đổi làm xong chức năng mới của “${deliverable}”. Cách nào giảm nguy cơ làm hỏng phần cũ?`, 'Chạy test hồi quy và kiểm tra các luồng phụ thuộc', ['Chỉ chạy lại đúng một ví dụ mới', 'Xóa kiểm thử thất bại', 'Phát hành ngay mà không xem diff'], 'analyze');
  result.push(question(course, module, lesson, 'v512-tf-secrets', 'true_false', 'Đúng hay sai: Có thể commit khóa API và mật khẩu triển khai vào repository riêng tư để tiện chạy dự án.', 'false', { options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], explanation: 'Bí mật cần ở biến môi trường hoặc secret store; repository riêng tư không thay thế quản lý bí mật.', taxonomy: 'understand' }));
  result.push(question(course, module, lesson, 'v512-tf-coverage', 'true_false', 'Đúng hay sai: Độ bao phủ kiểm thử cao tự nó chứng minh phần mềm không còn lỗi.', 'false', { options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], explanation: 'Coverage cho biết mã được chạy nhưng không đảm bảo assertion đúng, yêu cầu đủ hay mọi lỗi đã được phát hiện.', taxonomy: 'analyze' }));
  result.push(question(course, module, lesson, 'v512-fill-regression', 'fill_blank', `Kiểm thử chạy lại các luồng cũ sau khi thay đổi mã được gọi là kiểm thử _____.`, 'hồi quy', { acceptedAnswers: ['hồi quy', 'regression'], taxonomy: 'remember' }));
  result.push(question(course, module, lesson, 'v512-fill-acceptance', 'fill_blank', `Các điều kiện có thể kiểm chứng để quyết định nhiệm vụ “${practice}” đã hoàn thành được gọi là tiêu chí _____.`, 'chấp nhận', { acceptedAnswers: ['chấp nhận', 'acceptance'], taxonomy: 'remember' }));
  result.push(question(course, module, lesson, 'v512-short-contract', 'short_answer', 'Mô tả hợp đồng đầu vào/đầu ra cho một hàm hoặc API liên quan đến bài hiện tại. Nêu ít nhất hai điều kiện hợp lệ và hai trường hợp lỗi.', '', { rubric: ['Nêu được đầu vào/đầu ra', 'Có điều kiện hợp lệ cụ thể', 'Có trường hợp lỗi và phản hồi dự kiến', 'Phù hợp nhiệm vụ bài học'], points: 5, taxonomy: 'apply' }));
  result.push(question(course, module, lesson, 'v512-short-risk', 'short_answer', `Nêu ba rủi ro kỹ thuật khi triển khai “${deliverable}” và xếp thứ tự xử lý dựa trên xác suất/tác động.`, '', { rubric: ['Rủi ro gắn với sản phẩm', 'Đánh giá xác suất/tác động có căn cứ', 'Thứ tự ưu tiên hợp lý', 'Có biện pháp giảm thiểu'], points: 6, taxonomy: 'analyze' }));
  result.push(question(course, module, lesson, 'v512-short-test-data', 'short_answer', `Thiết kế tối thiểu sáu bộ dữ liệu kiểm thử cho “${practice}”: dữ liệu bình thường, biên, rỗng, sai kiểu, không hợp lệ và trường hợp đặc biệt.`, '', { rubric: ['Đủ sáu nhóm dữ liệu', 'Nêu kết quả mong đợi', 'Liên hệ yêu cầu bài', 'Có thể tái hiện'], points: 6, taxonomy: 'create' }));
  result.push(question(course, module, lesson, 'v512-essay-design-review', 'essay', `Hãy viết một bản review thiết kế cho “${deliverable}”: phạm vi, hợp đồng thành phần, lỗi có thể xảy ra, bảo mật, khả năng kiểm thử và đánh đổi đã chọn.`, '', { rubric: ['Phạm vi và thành phần rõ', 'Rủi ro/biên được nhận diện', 'Lập luận các đánh đổi', 'Đề xuất kiểm thử/bảo vệ', 'Có tiêu chí chấp nhận'], points: 12, taxonomy: 'analyze', difficulty: 'hard' }));
  result.push(question(course, module, lesson, 'v512-essay-retrospective', 'essay', `Sau một lần thử nghiệm thất bại với nhiệm vụ “${practice}”, hãy viết phân tích nguyên nhân gốc: triệu chứng, dữ kiện, giả thuyết, thử nghiệm xác minh, bản sửa và test hồi quy.`, '', { rubric: ['Phân biệt triệu chứng/nguyên nhân', 'Dữ kiện hoặc log hỗ trợ', 'Giả thuyết được kiểm chứng', 'Bản sửa hợp lý', 'Có test hồi quy'], points: 12, taxonomy: 'analyze', difficulty: 'hard' }));
  result.push(question(course, module, lesson, 'v512-code-integration-test', practicalQuestionType, `${hasCodeEditor ? 'Viết test tích hợp' : 'Lập quy trình kiểm tra đầu-cuối'} cho “${deliverable}”: xác định dependency, dữ liệu khởi tạo, thao tác chính, lỗi dự kiến và bước dọn dữ liệu sau test.`, '', { rubric: ['Nêu dependency và setup', 'Bao phủ luồng chính và lỗi', 'Assertion kiểm chứng được', 'Dọn dữ liệu/tài nguyên', 'Có thể chạy lặp lại'], points: 12, taxonomy: 'apply', difficulty: 'hard' }));
  result.push(question(course, module, lesson, 'v512-design-pipeline', 'design_task', `Thiết kế pipeline CI tối thiểu cho “${deliverable}” gồm lint, test, kiểm tra dependency/secret và điều kiện cho phép phát hành.`, '', { rubric: ['Thứ tự bước hợp lý', 'Test chặn khi thất bại', 'Secret không được in ra log', 'Điều kiện phát hành rõ', 'Có bước lưu báo cáo'], points: 12, taxonomy: 'create', difficulty: 'hard' }));
  // V6.1.1 adds questions emphasizing measurable outcomes, evidence, secure delivery and regression tests.
  makeMc('v611-mc-contract', `Với đầu ra “${deliverable}”, tiêu chí nào giúp xác nhận yêu cầu đã được đáp ứng?`, 'Tiêu chí chấp nhận có kết quả quan sát được và có thể kiểm thử lặp lại', ['Chỉ dựa vào cảm giác rằng sản phẩm đã xong', 'Không cần liên kết tiêu chí với mục tiêu', 'Chỉ kiểm tra giao diện một lần'], 'analyze');
  makeMc('v611-mc-boundary', `Khi vận dụng “${lesson.title}”, cách nào kiểm tra trường hợp biên?`, 'Xác định dữ liệu nhỏ nhất/lớn nhất, rỗng hoặc không hợp lệ rồi ghi kết quả mong đợi', ['Chỉ kiểm thử dữ liệu đẹp nhất', 'Bỏ qua đầu vào bất thường', 'Chỉ chạy lại cùng một dữ liệu'], 'apply');
  makeMc('v611-mc-source', `Nếu “${materialPrinciple}” được dùng làm căn cứ kỹ thuật, điều gì cần làm trước khi đưa vào sản phẩm?`, 'Xác minh giả định, nguồn, phạm vi áp dụng và kiểm tra bằng ví dụ phù hợp', ['Dùng ngay mà không xác minh', 'Ẩn giả định để giảm thời gian', 'Coi mọi ví dụ là quy tắc tuyệt đối'], 'analyze');
  makeMc('v611-mc-change', `Sau khi chỉnh sửa “${deliverable}”, bằng chứng nào cho thấy thay đổi không phá hỏng chức năng cũ?`, 'Chạy bộ kiểm thử hồi quy và lưu lại kết quả có thể tái hiện', ['Chỉ xem diff mà không chạy thử', 'Xóa các test cũ', 'Chỉ hỏi người viết có chắc hay không'], 'apply');
  result.push(question(course, module, lesson, 'v611-tf-security', 'true_false', `Đúng hay sai: Khi triển khai “${deliverable}”, có thể ghi khóa API hoặc thông tin đăng nhập vào log để dễ gỡ lỗi.`, 'false', { options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], explanation: 'Log cần hỗ trợ chẩn đoán nhưng phải loại bỏ bí mật, token và dữ liệu nhạy cảm.', taxonomy: 'understand' }));
  result.push(question(course, module, lesson, 'v611-tf-evidence', 'true_false', `Đúng hay sai: Chỉ đánh dấu đã đọc phần lý thuyết là đủ để chứng minh đã làm chủ nhiệm vụ “${practice}”.`, 'false', { options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], explanation: 'Cần minh chứng vận dụng, kiểm thử hoặc sản phẩm phù hợp mục tiêu.', taxonomy: 'understand' }));
  result.push(question(course, module, lesson, 'v611-tf-accessibility', 'true_false', `Đúng hay sai: Khi hoàn thiện “${deliverable}”, khả năng tiếp cận và người dùng có nhu cầu khác nhau không cần được cân nhắc.`, 'false', { options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }], explanation: 'Khả năng tiếp cận là một tiêu chí chất lượng cần cân nhắc ngay từ thiết kế.', taxonomy: 'understand' }));
  result.push(question(course, module, lesson, 'v611-fill-acceptance', 'fill_blank', `Điều kiện có thể kiểm chứng dùng để quyết định “${deliverable}” đạt yêu cầu được gọi là tiêu chí _____.`, 'chấp nhận', { acceptedAnswers: ['chấp nhận', 'acceptance'], taxonomy: 'remember' }));
  result.push(question(course, module, lesson, 'v611-fill-regression', 'fill_blank', `Kiểm thử được chạy lại sau thay đổi để phát hiện chức năng cũ bị hỏng gọi là kiểm thử _____.`, 'hồi quy', { acceptedAnswers: ['hồi quy', 'regression'], taxonomy: 'remember' }));
  result.push(question(course, module, lesson, 'v611-fill-boundary', 'fill_blank', `Giá trị ở ranh giới miền hợp lệ hoặc sát ngoài miền hợp lệ gọi là trường hợp _____.`, 'biên', { acceptedAnswers: ['biên', 'boundary'], taxonomy: 'remember' }));
  result.push(question(course, module, lesson, 'v611-short-outcome', 'short_answer', `Viết lại mục tiêu “${objective}” thành hai tiêu chí có thể quan sát/đo được. Nêu minh chứng sẽ thu thập để xác nhận từng tiêu chí.`, '', { rubric: ['Hai tiêu chí có thể kiểm chứng', 'Minh chứng phù hợp từng tiêu chí', 'Liên hệ đúng mục tiêu bài'], points: 6, taxonomy: 'apply' }));
  result.push(question(course, module, lesson, 'v611-short-threat-model', 'short_answer', `Với “${deliverable}”, xác định một tài sản cần bảo vệ, một tình huống lạm dụng và hai biện pháp giảm thiểu rủi ro.`, '', { rubric: ['Tài sản cụ thể', 'Tình huống lạm dụng hợp lý', 'Hai biện pháp có thể thực hiện', 'Nêu cách kiểm chứng'], points: 6, taxonomy: 'analyze' }));
  result.push(question(course, module, lesson, 'v611-essay-accessibility', 'essay', `Đánh giá “${deliverable}” theo mục tiêu, tính dễ dùng/tiếp cận, bảo mật và khả năng bảo trì. Nêu ít nhất ba cải tiến, ưu tiên theo tác động và giải thích bằng chứng cần có.`, '', { rubric: ['Tiêu chí gắn với đầu ra', 'Nhận diện tối thiểu ba vấn đề/cải tiến', 'Ưu tiên có căn cứ', 'Nêu minh chứng kiểm chứng'], points: 12, taxonomy: 'analyze', difficulty: 'hard' }));
  result.push(question(course, module, lesson, 'v611-essay-reflection', 'essay', `Viết retrospective sau khi hoàn thành “${practice}”: điều gì đạt mục tiêu, bằng chứng nào hỗ trợ kết luận, điểm nào chưa chắc chắn và kế hoạch cải tiến tiếp theo là gì?`, '', { rubric: ['Dẫn chứng cụ thể', 'Tự đánh giá có cân bằng', 'Nhận diện giới hạn', 'Kế hoạch cải tiến có thể hành động'], points: 12, taxonomy: 'create', difficulty: 'hard' }));
  result.push(question(course, module, lesson, 'v611-practical-observability', practicalQuestionType, `${hasCodeEditor ? 'Triển khai' : 'Thiết kế'} ghi nhận trạng thái cho “${deliverable}”: phân biệt thành công/thất bại, cung cấp thông báo an toàn và không ghi bí mật. Đính kèm minh chứng hoặc mã nguồn cùng ca kiểm thử.`, '', { rubric: ['Trạng thái được phân biệt rõ', 'Thông báo hữu ích nhưng an toàn', 'Không lộ dữ liệu bí mật', 'Có test thành công và thất bại'], points: 10, taxonomy: 'apply', difficulty: 'hard' }));
  result.push(question(course, module, lesson, 'v611-debug-regression', 'debugging', `Sau khi thay đổi để cải thiện “${deliverable}”, một luồng trước đó bắt đầu thất bại. Hãy đề xuất bước tái hiện, dữ kiện cần thu thập, giả thuyết nguyên nhân, cách sửa và test hồi quy.`, '', { rubric: ['Tái hiện lỗi rõ', 'Phân biệt triệu chứng và nguyên nhân', 'Đề xuất cách xác minh giả thuyết', 'Có bản sửa và test hồi quy'], points: 10, taxonomy: 'analyze', difficulty: 'hard' }));
  return result;
}

function buildCareerQuestionBank() {
  const records = [];
  for (const course of catalog.getAllCourses()) {
    for (const module of course.modules) {
      for (const lesson of module.lessons) records.push(...buildLessonQuestionBank(course, module, lesson, course.lessons));
    }
  }
  return records;
}
module.exports = { buildCareerQuestionBank, buildLessonQuestionBank };
