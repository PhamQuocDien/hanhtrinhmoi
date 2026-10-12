'use strict';

const QUALITY_VERSION = 'V8.0.3';
const PROJECT_RUBRIC = Object.freeze([
  { criterion: 'Đáp ứng yêu cầu', points: 30, descriptor: 'Luồng cốt lõi chạy đúng tiêu chí nghiệm thu và xử lý trường hợp thất bại.' },
  { criterion: 'Kiểm chứng', points: 25, descriptor: 'Có ca kiểm thử bình thường, biên và không hợp lệ; ghi rõ kết quả mong đợi/thực tế.' },
  { criterion: 'Thiết kế và chất lượng', points: 20, descriptor: 'Cấu trúc dễ hiểu, trách nhiệm rõ; cân nhắc bảo mật, khả năng tiếp cận hoặc tính nhất quán dữ liệu phù hợp với dự án.' },
  { criterion: 'Tài liệu và khả năng tái lập', points: 15, descriptor: 'README nêu yêu cầu môi trường, cách chạy, cấu hình mẫu, cách kiểm thử và giới hạn.' },
  { criterion: 'Giải thích và cải tiến', points: 10, descriptor: 'Trình bày được quyết định kỹ thuật, đánh đổi và ít nhất một cải tiến có căn cứ.' }
]);

function text(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function splitMinutes(total) {
  const duration = Math.max(15, Number.parseInt(total, 10) || 40);
  const portions = [0.1, 0.25, 0.2, 0.35];
  const steps = portions.map((portion) => Math.max(2, Math.round(duration * portion)));
  steps.push(Math.max(3, duration - steps.reduce((sum, value) => sum + value, 0)));
  steps[4] += duration - steps.reduce((sum, value) => sum + value, 0);
  return [
    { title: 'Ôn kiến thức nền', minutes: steps[0] },
    { title: 'Đọc và ghi chú lý thuyết', minutes: steps[1] },
    { title: 'Phân tích ví dụ', minutes: steps[2] },
    { title: 'Thực hành và kiểm thử', minutes: steps[3] },
    { title: 'Tự đánh giá', minutes: steps[4] }
  ];
}

function buildLessonLearningGuide({ course = {}, module = {}, lesson = {}, lessonIndex = 0 } = {}) {
  const courseLessons = Array.isArray(course.lessons) ? course.lessons : [];
  const position = courseLessons.findIndex((item) => item.id === lesson.id);
  const previous = position > 0 ? courseLessons[position - 1] : null;
  const previousInModule = previous && previous.moduleId === module.id;
  const prerequisites = Array.isArray(course.prerequisites) ? course.prerequisites : [];
  const objective = text(lesson.objective, `Hiểu và vận dụng nội dung ${lesson.title || 'bài học'}.`);
  const practice = text(lesson.practice, `Thực hành nội dung ${lesson.title || 'bài học'}.`);
  const deliverable = text(lesson.deliverable, `Minh chứng học tập của bài ${lesson.title || 'bài học'}.`);
  const practiceSteps = [
    `Viết lại mục tiêu thành điều kiện hoàn thành: ${objective}`,
    `Thực hiện nhiệm vụ chính: ${practice}`,
    'Tự kiểm tra một trường hợp thông thường, một trường hợp biên và một trường hợp không hợp lệ khi phù hợp với bài.',
    `Đối chiếu sản phẩm với tiêu chí: ${deliverable}`,
    'Ghi lại một lỗi hoặc giới hạn đã phát hiện, nguyên nhân và cách kiểm tra sau khi sửa.'
  ];
  const rubric = [
    { criterion: 'Đúng mục tiêu', points: 35, descriptor: `Sản phẩm đáp ứng mục tiêu “${objective}”.` },
    { criterion: 'Kiểm chứng', points: 25, descriptor: 'Có minh chứng hoặc kiểm thử và nêu được kết quả mong đợi so với kết quả thực tế.' },
    { criterion: 'Giải thích', points: 20, descriptor: 'Trình bày được cách làm, giả định chính và lý do chọn phương án.' },
    { criterion: 'Chất lượng', points: 20, descriptor: 'Nêu giới hạn và kiểm tra yếu tố phù hợp với bài như bảo mật, khả năng tiếp cận, dữ liệu hoặc khả năng bảo trì.' }
  ];
  return {
    version: QUALITY_VERSION,
    status: 'draft-teacher-review-required',
    position: position >= 0 ? position + 1 : lessonIndex + 1,
    totalLessons: courseLessons.length,
    estimatedMinutes: Number(lesson.minutes) || 40,
    prerequisite: previousInModule
      ? `Ôn lại bài “${previous.title}”.`
      : previous
        ? `Ôn lại chặng trước: “${previous.title}”.`
        : prerequisites.length
          ? `Kiến thức/công cụ nên có trước: ${prerequisites.join(', ')}.`
          : 'Chưa yêu cầu kiến thức tiên quyết bắt buộc; hãy đọc mục tiêu và kiểm tra các thuật ngữ mới.',
    learningOutcomes: [
      objective,
      `Tạo được minh chứng có thể kiểm tra: ${deliverable}`,
      'Giải thích được ít nhất một giả định, giới hạn hoặc quyết định kỹ thuật trong sản phẩm.'
    ],
    studyPlan: splitMinutes(lesson.minutes),
    guidedSteps: practiceSteps,
    practiceLevels: {
      support: `Bắt đầu bằng phiên bản nhỏ nhất của nhiệm vụ “${practice}”; làm từng bước và ghi lại đầu vào/đầu ra sau mỗi bước.`,
      core: practice,
      extension: `Thay đổi một điều kiện của “${practice}”, so sánh hai cách giải quyết và giải thích phương án phù hợp hơn cho mục tiêu “${objective}”.`
    },
    selfCheck: [
      `Hãy giải thích nguyên tắc chính của “${lesson.title || 'bài học'}” bằng lời của bạn, không chỉ lặp lại định nghĩa.`,
      `Bằng chứng nào cho thấy “${deliverable}” thực sự đáp ứng mục tiêu?`,
      'Trường hợp biên hoặc lỗi nào có thể làm giải pháp thất bại, và bạn sẽ kiểm tra nó ra sao?'
    ],
    rubric,
    masteryEvidence: [
      `Hoàn thành sản phẩm “${deliverable}”.`,
      'Có ít nhất một minh chứng kiểm chứng kết quả phù hợp với loại bài.',
      'Có thể giải thích quyết định và một giới hạn của cách làm.'
    ],
    teacherReview: { required: true, curriculumApproved: false, generatedQuestionsActive: false }
  };
}

function buildCourseQuality(course = {}) {
  const modules = (course.modules || []).map((module, index) => {
    const lessons = module.lessons || [];
    const finalLesson = lessons[lessons.length - 1];
    return {
      number: index + 1,
      id: module.id,
      title: module.title,
      focus: module.summary || '',
      lessonCount: lessons.length,
      evidence: finalLesson?.deliverable || 'Sản phẩm tổng hợp của chặng',
      lessons: lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, objective: lesson.objective }))
    };
  });
  return {
    version: QUALITY_VERSION,
    status: 'draft-teacher-review-required',
    approvedForOfficialSyllabus: false,
    learningOutcomes: (course.outcomes || course.skills || []).slice(0, 10),
    prerequisites: course.prerequisites || [],
    recommendedWorkflow: ['Học mục tiêu và lý thuyết', 'Phân tích ví dụ đã giải', 'Thực hành có hướng dẫn', 'Tự làm nhiệm vụ mở rộng', 'Kiểm tra minh chứng và phản tư'],
    moduleMilestones: modules,
    capstone: {
      title: course.project || `Đồ án tổng hợp: ${course.title || 'Khóa học CNTT'}`,
      description: `Kết hợp các đầu ra của ${modules.length} chặng theo thứ tự; ưu tiên hoàn thiện một luồng đầu-cuối có thể demo trước khi mở rộng phạm vi.`,
      milestoneEvidence: modules.map((module) => ({ module: module.title, evidence: module.evidence })),
      rubric: PROJECT_RUBRIC.map((item) => ({ ...item })),
      acceptance: [
        'Phạm vi, đối tượng sử dụng và điều kiện nghiệm thu được ghi rõ.',
        'Có demo chạy được hoặc bản mô phỏng trung thực nếu phụ thuộc phần cứng/dịch vụ ngoài.',
        'Có test case, README, giới hạn đã biết và hướng dẫn tái lập.',
        'Không chứa secret, dữ liệu cá nhân thật hoặc tuyên bố tính năng chưa được kiểm chứng.'
      ]
    },
    suggestedAssessmentBlueprint: {
      note: 'Ma trận gợi ý để giảng viên thiết lập; không tự kích hoạt câu hỏi đang ở trạng thái nháp.',
      scope: 'Bao phủ mục tiêu của tất cả các chặng và nhiệm vụ tổng hợp.',
      questionTypes: [
        { type: 'multiple_choice', label: 'Trắc nghiệm tình huống', percent: 25 },
        { type: 'short_answer', label: 'Giải thích ngắn', percent: 15 },
        { type: 'code_challenge', label: 'Thực hành/mã nguồn khi phù hợp', percent: 20 },
        { type: 'debugging', label: 'Phân tích và sửa lỗi', percent: 15 },
        { type: 'design_task', label: 'Thiết kế/đồ án nhỏ', percent: 15 },
        { type: 'essay', label: 'Giải thích trade-off và phản tư', percent: 10 }
      ],
      difficulty: [{ level: 'easy', percent: 25 }, { level: 'medium', percent: 50 }, { level: 'hard', percent: 25 }],
      taxonomy: [{ level: 'understand', percent: 20 }, { level: 'apply', percent: 35 }, { level: 'analyze', percent: 25 }, { level: 'create', percent: 15 }, { level: 'remember', percent: 5 }]
    }
  };
}

module.exports = { QUALITY_VERSION, PROJECT_RUBRIC, buildLessonLearningGuide, buildCourseQuality };
