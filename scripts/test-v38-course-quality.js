'use strict';
const assert = require('assert');
const { makeCourseGenerationPrompt, courseBlueprintSchemaV38, normalizeGeneratedBlueprint, auditCourseBlueprintV38, auditStoredCourseV38, validateRequestedCourseScope } = require('../server/services/course-quality-v38');
const { generateCourseDraft, validateAdaptiveAICourseDraftV38 } = require('../server/services/ai-learning-service');

function makeQuestion(scope, i) {
    const prompts = [`Với ${scope}, hãy xác định nguyên nhân của trường hợp thực tế ${i} dựa trên dữ kiện đã cho.`, `Tính kết quả định lượng của bài toán ${scope} mã ${i} khi thay đổi tham số đầu vào.`, `Chọn quy trình phù hợp nhất để xử lý tình huống ngoại lệ ${scope} số ${i}.`, `Phát hiện giả định sai trong lập luận ${scope} ở ví dụ thực hành ${i}.`, `So sánh hai phương án ứng dụng ${scope} trong bối cảnh khác nhau ${i}.`];
    return { prompt: prompts[i % prompts.length], type: 'single_choice', options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'], answer: 'Phương án A', explanation: `Lời giải cho tình huống ${scope} số ${i} dựa trên quy tắc và dữ kiện đã nêu trong câu hỏi.`, skill: scope, difficulty: i < 2 ? 'FOUNDATION' : i < 4 ? 'INTERMEDIATE' : 'ADVANCED', points: 1 };
}
function makeLesson(chapter, index) {
    const lessonTopics = ['Xây dựng mô hình phân tích và xác định biến số', 'Đánh giá chất lượng dữ liệu và phát hiện sai lệch', 'Diễn giải kết quả và giới hạn của suy luận'];
    const title = `${chapter} - ${lessonTopics[index]}`;
    const theorySections = [0,1,2].map(i => ({ title: `Phần kiến thức ${i + 1}`, content: (`Trong bài ${title}, khái niệm này được giải thích từ nguyên lý, điều kiện áp dụng, các bước suy luận và cách xác minh kết quả. Người học cần phân biệt trường hợp đúng với ngoại lệ, hiểu vì sao phương pháp có hiệu lực và biết khi nào không nên áp dụng. `).repeat(3) }));
    const lecture = { title: `Bài giảng ${title}`, script: (`Bài giảng phân tích ${title} theo từng bước. Trước hết xác định dữ kiện và mục tiêu. Tiếp theo chọn phương pháp phù hợp, giải thích vì sao chọn phương pháp đó, áp dụng vào ví dụ, so sánh kết quả với điều kiện ban đầu và tự kiểm tra bằng một trường hợp biến đổi. `).repeat(3), keyPoints: ['Xác định dữ kiện', 'Chọn phương pháp', 'Kiểm tra kết quả'] };
    return { title, description: `Mục tiêu và phạm vi bài ${title} gồm khái niệm, quy trình, ứng dụng và đánh giá.`, objectives: ['Giải thích nguyên lý và điều kiện áp dụng', 'Vận dụng phương pháp để giải quyết tình huống'], skills: [title], difficulty: 'INTERMEDIATE', estimatedMinutes: 35, theorySections, lecture, examples: [{ title: 'Ví dụ có lời giải', problem: `Phân tích một tình huống mới trong ${title} với dữ kiện cụ thể.`, solution: (`Xác định dữ kiện, nêu nguyên tắc, áp dụng từng bước, tính/đối chiếu kết quả rồi giải thích vì sao đáp án thỏa mãn yêu cầu của tình huống ${title}. `).repeat(2) }], activities: [{ type: 'guided', title: 'Làm cùng', instruction: `Thực hiện từng bước của ${title} và giải thích lựa chọn.` }, { type: 'practice', title: 'Tự luyện', instruction: `Giải tình huống khác về ${title} không xem lời giải.` }], practiceTasks: [`Bài cơ bản: áp dụng nguyên tắc của ${title} vào dữ kiện mới.`, `Bài vận dụng: so sánh hai phương án trong ${title}.`], commonMistakes: ['Bỏ qua điều kiện áp dụng', 'Không kiểm tra kết quả'], questions: Array.from({ length: 5 }, (_, i) => makeQuestion(title, i)) };
}
function makeBlueprint() {
    const chapters = ['Nền tảng phân tích', 'Vận dụng và kiểm chứng'].map((name, ci) => ({ title: name, description: `Chương ${name} xây dựng các nguyên lý cần thiết rồi chuyển sang tình huống vận dụng, phân tích dữ kiện và kiểm tra kết quả.`, lessons: Array.from({ length: 3 }, (_, i) => makeLesson(name, i)), assessment: { passingScore: 70, durationSeconds: 1200, questions: Array.from({ length: 5 }, (_, i) => makeQuestion(`Bài kiểm tra chương ${ci + 1}`, i)) } }));
    return normalizeGeneratedBlueprint({ title: 'Phân tích dữ liệu ứng dụng', code: 'DATA-ANALYSIS-APP', description: 'Khóa học về phân tích dữ liệu theo tình huống ứng dụng.', educationLevel: 'HIGHER_EDUCATION', subjectId: 'DATA_ANALYSIS', objectives: ['Phân tích dữ liệu theo mục tiêu', 'Giải thích kết quả và giới hạn'], skills: ['Phân tích dữ liệu'], learningOutcomes: ['Tạo được kết luận có căn cứ'], chapters, finalAssessment: { passingScore: 75, durationSeconds: 3600, questions: Array.from({ length: 10 }, (_, i) => makeQuestion('Đề cuối khóa', i)) } }, { title: 'Phân tích dữ liệu ứng dụng', educationLevel: 'HIGHER_EDUCATION', subjectId: 'DATA_ANALYSIS' }, 'test-model');
}

const prompt = makeCourseGenerationPrompt({ title: 'IELTS Academic Writing Task 2', targetExam: 'IELTS', track: 'IELTS_WRITING', educationLevel: 'ENGLISH_CERTIFICATION' });
assert.match(prompt, /Không sao chép một dàn ý cố định/);
assert.match(prompt, /finalAssessment/);
assert.match(prompt, /IELTS/);
assert.equal(courseBlueprintSchemaV38.type, 'OBJECT');
assert.ok(courseBlueprintSchemaV38.properties.chapters);
assert.ok(courseBlueprintSchemaV38.properties.finalAssessment);
assert.equal(validateRequestedCourseScope({ educationLevel: 'LOWER_SECONDARY', grade: 8, subjectId: 'TOAN', targetExam: '' }, { educationLevel: 'SECONDARY_LOWER', grade: 8, subjectId: 'toan' }).valid, true, 'Normalizes equivalent school-level aliases and validates requested scope');
assert.equal(validateRequestedCourseScope({ educationLevel: 'ENGLISH_CERTIFICATION', subjectId: 'IELTS', targetExam: 'TOEIC' }, { educationLevel: 'ENGLISH_CERTIFICATION', subjectId: 'IELTS', targetExam: 'IELTS' }).valid, false, 'Rejects mismatched requested certification');
const blueprint = makeBlueprint();
const audit = auditCourseBlueprintV38(blueprint);
assert.equal(audit.valid, true, `Expected valid course; errors: ${audit.errors.join(' | ')}`);
assert.equal(audit.chapterCount, 2);
assert.equal(audit.lessonCount, 6);
assert.equal(audit.finalQuestionCount, 10);
assert.ok(audit.qualityScore >= 90);
const broken = structuredClone(blueprint);
broken.finalAssessment.questions = broken.finalAssessment.questions.slice(0, 2);
assert.equal(auditCourseBlueprintV38(broken).valid, false, 'Rejects final assessment with too few questions');
const wrongGrade = structuredClone(blueprint);
wrongGrade.educationLevel = 'PRIMARY';
wrongGrade.grade = 15;
assert.equal(auditCourseBlueprintV38(wrongGrade).valid, false, 'Rejects invalid K12 grade');
const duplicate = structuredClone(blueprint);
duplicate.chapters[0].lessons[1].questions[0].prompt = duplicate.chapters[0].lessons[0].questions[0].prompt;
assert.equal(auditCourseBlueprintV38(duplicate).valid, false, 'Rejects duplicate question prompts');
const shallow = structuredClone(blueprint);
shallow.chapters[0].lessons[0].theorySections = [{ title: 'Chủ đề', content: 'Đây là phần nội dung quá ngắn.' }];
assert.equal(auditCourseBlueprintV38(shallow).valid, false, 'Rejects shallow theory');
const missingSubject = structuredClone(blueprint);
missingSubject.subjectId = '';
assert.equal(auditCourseBlueprintV38(missingSubject).valid, false, 'Rejects course without subject binding');
const course = { _id: 'course-1', code: 'C1', name: 'Khóa kiểm tra', subjectId: 'DATA', grade: null };
const storedLesson = { _id: 'lesson-1', title: 'Bài kiểm tra', courseId: 'course-1', subjectId: 'DATA', objectives: ['Mục tiêu 1', 'Mục tiêu 2'], theorySections: [{ content: ('Giải thích nguyên lý, điều kiện, ví dụ và các bước áp dụng để người học có thể kiểm chứng kết quả. ').repeat(30) }], examples: [{ problem: 'Phân tích tình huống dữ liệu cụ thể.', solution: 'Áp dụng từng bước, giải thích kết quả và đối chiếu với điều kiện.' }], activities: [{ title: 'Thực hành 1' }, { title: 'Thực hành 2' }, { title: 'Thực hành 3' }], lessonTestId: 'test-1', payload: { lectureScript: ('Bài giảng giải thích nguyên lý, từng bước thực hiện và cách tự kiểm tra kết quả trong tình huống thực tế. ').repeat(20) } };
const storedQuestions = Array.from({ length: 5 }, (_, i) => ({ _id: `q-${i}`, courseId: 'course-1', lessonId: 'lesson-1', subjectId: 'DATA', prompt: `Câu hỏi riêng biệt về kỹ thuật phân tích dữ liệu số ${i}` }));
const storedAssessment = { _id: 'test-1', courseId: 'course-1', lessonId: 'lesson-1', subjectId: 'DATA', assessmentType: 'LESSON_TEST', questionIds: storedQuestions.map(q => q._id) };
const storedReport = auditStoredCourseV38({ course, lessons: [storedLesson], questions: storedQuestions, assessments: [storedAssessment, { _id: 'final-1', courseId: 'course-1', assessmentType: 'FINAL', questionIds: [] }] });
assert.equal(storedReport.status, 'HEALTHY', `Expected healthy stored course: ${JSON.stringify(storedReport.issues)}`);
const wrongScope = auditStoredCourseV38({ course, lessons: [{ ...storedLesson, subjectId: 'IELTS' }], questions: storedQuestions, assessments: [storedAssessment, { _id: 'final-1', courseId: 'course-1', assessmentType: 'FINAL', questionIds: [] }] });
assert.equal(wrongScope.status, 'NEEDS_REPAIR', 'Detects mismatched lesson subject in stored catalog');
Promise.resolve().then(async () => {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) await assert.rejects(() => generateCourseDraft({ request: { prompt: 'Khóa học mới không theo mẫu', forceCreate: true }, context: { education: {}, mastery: [], learning: { goals: [] } } }), error => error.code === 'COURSE_AI_REQUIRED');
    const wrongTrack = validateAdaptiveAICourseDraftV38({ title: 'IELTS', subjectId: 'IELTS_WRITING', educationLevel: 'ENGLISH_CERTIFICATION', targetExam: 'TOEIC', chapters: [], midtermAssessment: { questions: [] }, finalAssessment: { questions: [] }, mockAssessment: { questions: [] } }, { targetExam: 'IELTS' });
    assert.equal(wrongTrack.valid, false, 'Rejects course generated for the wrong certification track');
    console.log('V38 course quality tests: 22 assertions PASS');
}).catch(error => { console.error(error); process.exitCode = 1; });
