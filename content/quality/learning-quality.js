'use strict';

const FRAMEWORKS = Object.freeze([
  { id: 'MOET-GDPT-2018', title: 'Chương trình Giáo dục phổ thông 2018', url: 'https://moet.gov.vn/content/vanban/Lists/VBPQ/Attachments/1483/vbhn-ttu-322018-202021-132022-ttbgddt.pdf', use: 'Đối chiếu yêu cầu cần đạt, phẩm chất và năng lực phổ thông; không thay thế chương trình môn học và sách giáo khoa cụ thể.' },
  { id: 'ACM-IEEE-CS2023', title: 'Computer Science Curricula 2023', url: 'https://csed.acm.org/', use: 'Tham chiếu cấu trúc học phần CNTT, nền tảng khoa học máy tính, thực hành và năng lực nghề.' },
  { id: 'ABET-CAC-2025-2026', title: 'ABET Computing Accreditation Criteria 2025–2026', url: 'https://www.abet.org/accreditation-criteria/criteria-for-accrediting-computing-programs-2025-2026/', use: 'Tham chiếu cách xác định đầu ra, đánh giá dựa trên minh chứng và cải tiến liên tục; không phải chứng nhận ABET.' },
  { id: 'DIGCOMP-3.0', title: 'European Digital Competence Framework 3.0', url: 'https://joint-research-centre.ec.europa.eu/scientific-activities/key-competences-lifelong-learning/digital-competence-framework-digcomp/all-editions-digcomp-and-related-jrc-publications_en', use: 'Tham chiếu năng lực thông tin/dữ liệu, giao tiếp, tạo nội dung số, an toàn và giải quyết vấn đề.' },
  { id: 'UNESCO-AI-STUDENTS-2024', title: 'UNESCO AI Competency Framework for Students', url: 'https://www.unesco.org/en/articles/ai-competency-framework-students', use: 'Tham chiếu tư duy lấy con người làm trung tâm, đạo đức AI, kỹ thuật/ứng dụng AI và thiết kế hệ thống AI.' }
]);

const ASSESSMENT_TYPES = Object.freeze([
  { type: 'multiple_choice', label: 'Trắc nghiệm một đáp án', marking: 'automatic' },
  { type: 'true_false', label: 'Đúng/Sai', marking: 'automatic' },
  { type: 'fill_blank', label: 'Điền khuyết', marking: 'automatic-normalized-text' },
  { type: 'multiple_select', label: 'Chọn nhiều đáp án', marking: 'automatic-exact-set' },
  { type: 'matching', label: 'Nối cặp', marking: 'automatic-exact-mapping' },
  { type: 'ordering', label: 'Sắp xếp thứ tự', marking: 'automatic-exact-sequence' },
  { type: 'short_answer', label: 'Trả lời ngắn', marking: 'rubric-assisted' },
  { type: 'essay', label: 'Tự luận', marking: 'rubric-assisted' },
  { type: 'code_challenge', label: 'Bài lập trình', marking: 'sandbox-tests-when-configured' },
  { type: 'debugging', label: 'Tìm và sửa lỗi', marking: 'rubric-or-test-assisted' },
  { type: 'design_task', label: 'Thiết kế/đồ án', marking: 'rubric-and-teacher-review' }
]);

const COURSE_QUALITY_GATES = Object.freeze([
  'Mục tiêu học tập dùng động từ có thể quan sát hoặc kiểm chứng.',
  'Kiến thức tiên quyết và vị trí trong lộ trình được ghi rõ.',
  'Lý thuyết được nối với ví dụ đã giải, luyện tập có hướng dẫn và bài vận dụng độc lập.',
  'Có minh chứng học tập và tiêu chí đạt; không chỉ đánh dấu đã mở trang.',
  'Câu hỏi gắn đúng lớp/ngành, môn/khóa, bài, chủ đề và mục tiêu.',
  'Có phản hồi giải thích và gợi ý ôn lại; AI không tự nhận chắc chắn khi thiếu căn cứ.',
  'Có chú thích nguồn, giấy phép khi dùng tài liệu bên ngoài và ngày rà soát.',
  'Có kiểm tra khả năng tiếp cận: ngôn ngữ rõ, cấu trúc heading, bàn phím và phương án thay thế cho media.',
  'Có thực hành hoặc sản phẩm thực tế phù hợp với mục tiêu, kèm rubric và tiêu chí nghiệm thu.',
  'Trạng thái duyệt tách biệt với trạng thái kỹ thuật của bản ghi; bản nháp chưa được quảng bá là chính thức.'
]);

function createLessonQualityProfile({ level = 'school', grade = null, subjectCode = '', lesson = {}, hasCodeLab = false } = {}) {
  const suppliedOutcomes = (lesson.alignment?.intendedOutcomes || lesson.intendedOutcomes || []).filter(Boolean).slice(0, 8);
  const intendedOutcomes = suppliedOutcomes.length ? suppliedOutcomes : level === 'university' ? [String(lesson.objective || `Thực hiện mục tiêu của bài ${lesson.title || 'học phần'}.`), `Tạo minh chứng hoặc sản phẩm phù hợp với nhiệm vụ “${lesson.deliverable || lesson.practice || lesson.title || 'bài học'}”.`, 'Kiểm thử kết quả với dữ liệu bình thường, trường hợp biên và đầu vào không hợp lệ.', 'Giải thích lựa chọn kỹ thuật, giới hạn và một phương án cải tiến.'] : [String(lesson.objective || `Hiểu và vận dụng nội dung ${lesson.title || 'bài học'} trong một tình huống phù hợp.`)];
  const partTypes = (lesson.parts || lesson.sections || []).map((part) => part.type || part.kind || '').filter(Boolean);
  const hasTheory = partTypes.some((type) => /theory|lecture|concept/i.test(type));
  const hasPractice = partTypes.some((type) => /practice|exercise|lab|project|deliverable/i.test(type));
  const canRunCode = Boolean(hasCodeLab || lesson.codeExercise?.enabled);
  const references = level === 'university'
    ? ['ACM-IEEE-CS2023', 'ABET-CAC-2025-2026', 'DIGCOMP-3.0', ...(String(subjectCode).toLowerCase().includes('ai') ? ['UNESCO-AI-STUDENTS-2024'] : [])]
    : ['MOET-GDPT-2018', 'DIGCOMP-3.0'];
  return {
    profileVersion: 'V8.0.0',
    status: 'draft-teacher-validation-required',
    standardsAlignment: { references, claim: 'framework-referenced-not-accredited', reviewedAgainstOfficialSyllabus: false },
    learningOutcomes: intendedOutcomes.length ? intendedOutcomes : [String(lesson.objective || `Hiểu và vận dụng nội dung ${lesson.title || 'bài học'} trong một tình huống phù hợp.`)],
    prerequisite: lesson.prerequisite || 'Ôn lại bài liền trước hoặc làm kiểm tra đầu vào ngắn nếu chưa chắc kiến thức nền.',
    learningSequence: ['theory', 'worked-example', 'guided-practice', 'independent-practice', ...(canRunCode ? ['code-lab'] : []), 'reflection-and-exit-check'],
    evidenceOfLearning: [hasTheory ? 'Giải thích ý chính bằng lời của người học' : 'Tóm tắt kiến thức trọng tâm', hasPractice ? 'Hoàn thành nhiệm vụ thực hành' : 'Giải quyết một tình huống áp dụng', ...(canRunCode ? ['Chạy mã với ca kiểm thử, gồm ca bình thường và biên'] : []), 'Đạt checkpoint và lưu kết quả đánh giá'],
    assessmentTypes: ASSESSMENT_TYPES.filter((item) => !['code_challenge', 'debugging'].includes(item.type) || canRunCode).map((item) => item.type),
    differentiation: { support: 'Ví dụ từng bước, gợi ý nhỏ và cơ hội thử lại.', core: 'Bài vận dụng đúng mục tiêu bài học.', extension: 'Tình huống mới, giải thích lựa chọn và đánh giá giới hạn.' },
    qualityChecks: { hasMeasurableOutcome: intendedOutcomes.length > 0 || Boolean(lesson.objective), hasTheory, hasPractice, hasEvidence: true, hasRubric: Boolean(lesson.rubric || lesson.deliverable || lesson.codeExercise), accessibilityReviewRequired: true, teacherReviewRequired: true },
    computingOutcomes: level === 'university' ? ['Phân tích vấn đề và xác định yêu cầu', 'Thiết kế, triển khai và đánh giá giải pháp tính toán', 'Kiểm thử, phân tích lỗi và cải tiến chất lượng', 'Giao tiếp kỹ thuật, phối hợp và quản lý công việc', 'Bảo mật, quyền riêng tư, đạo đức và tác động xã hội'] : [],
    accessibilityAndInclusion: { languageLevel: level === 'school' ? 'age-appropriate' : 'discipline-appropriate', alternativesForMedia: 'required-review', keyboardNavigation: 'required-review' },
    assessmentPolicy: { objectiveItems: 'auto-graded-with-key', writtenItems: 'rubric-and-teacher-review', generatedContent: 'inactive-until-reviewed', requiresEvidence: true },
    context: { level, grade, subjectCode }
  };
}

module.exports = { FRAMEWORKS, ASSESSMENT_TYPES, COURSE_QUALITY_GATES, createLessonQualityProfile };
