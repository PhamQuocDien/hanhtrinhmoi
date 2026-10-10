'use strict';

const { getCatalog, getSubject, getLesson, PROGRAM_VERSION } = require('../../curriculum-data.js');
const { k12RichLesson, buildK12Questions } = require('../modules/rich-learning-content-v20.js');

const K12_SOURCE_REF = Object.freeze({
    sourceType: 'ORIGINAL_PRACTICE',
    organization: 'Hành Trình Mới',
    documentName: 'curriculum-data.js',
    documentNumber: '',
    url: '',
    version: PROGRAM_VERSION,
    effectiveDate: '',
    verifiedAt: '',
    verification: 'unverified',
    notes: 'Nội dung nguyên bản của Hành Trình Mới bám theo định hướng/yêu cầu cần đạt; không phải bản sao sách giáo khoa hoặc dữ liệu chính thức do Bộ GDĐT phát hành.'
});

const LEVELS = Object.freeze({ PRIMARY: [1, 2, 3, 4, 5], SECONDARY_LOWER: [6, 7, 8, 9], SECONDARY_UPPER: [10, 11, 12] });

function educationLevelForGrade(grade) {
    if (grade <= 5) return 'PRIMARY';
    if (grade <= 9) return 'SECONDARY_LOWER';
    return 'SECONDARY_UPPER';
}

function parseK12CourseId(id) {
    const match = String(id || '').match(/^k12-g(1[0-2]|[1-9])-([a-z0-9_]+)$/i);
    if (!match) return null;
    return { grade: Number(match[1]), subjectId: match[2] };
}

function parseK12LessonId(id) {
    const match = String(id || '').match(/^k12-g(1[0-2]|[1-9])-([a-z0-9_]+)-lesson-(\d+)$/i);
    if (!match) return null;
    return { grade: Number(match[1]), subjectId: match[2], lessonNo: Number(match[3]) };
}

function courseId(grade, subjectId) {
    return `k12-g${grade}-${subjectId}`;
}

function lessonId(grade, subjectId, lessonNo) {
    return `k12-g${grade}-${subjectId}-lesson-${lessonNo}`;
}

function subjectRecord(grade, subjectId) {
    return getSubject(grade, subjectId, { includeLessons: true });
}

function specializeCalculusLesson(rich, lesson, grade, subjectId, subjectName) {
    const topic = String(lesson.topic || lesson.title || 'Tính đơn điệu và cực trị');
    const normalized = `${subjectId || ''} ${subjectName || ''} ${topic}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (Number(grade) < 10 || !/toan|math/.test(normalized) || !/don dieu|cuc tri|dao ham|bien thien ham so/.test(normalized)) return rich;
    const theorySections = [
        { title: '1. Mục tiêu và kiến thức tiên quyết', content: `Sau bài này, học sinh tính được đạo hàm của hàm đa thức đơn giản, giải f'(x)=0, lập bảng xét dấu và dùng dấu đạo hàm để kết luận khoảng đồng biến, nghịch biến cũng như cực trị. Nếu f'(x)>0 trên một khoảng thì f đồng biến trên khoảng đó; nếu f'(x)<0 thì f nghịch biến trên khoảng đó. Điều kiện và miền xác định luôn phải được xét trước khi kết luận.` },
        { title: '2. Quy trình xét tính đơn điệu', content: `Bước 1: xác định tập xác định. Bước 2: tính f'(x). Bước 3: giải phương trình f'(x)=0 và tìm các điểm f' không xác định nhưng thuộc miền xét. Bước 4: chia trục số theo các điểm đó, xét dấu f'(x) trên từng khoảng. Bước 5: kết luận chính xác các khoảng đồng biến/nghịch biến, không gộp qua điểm tới hạn.` },
        { title: '3. Quy trình tìm cực trị', content: `Tại điểm tới hạn x₀, việc f'(x₀)=0 chưa đủ để khẳng định có cực trị. Xét dấu đạo hàm hai phía: f' đổi dấu từ dương sang âm thì f có cực đại tại x₀; f' đổi dấu từ âm sang dương thì f có cực tiểu tại x₀. Nếu đạo hàm không đổi dấu khi qua điểm đó thì không kết luận có cực trị chỉ từ f'(x₀)=0.` },
        { title: '4. Ví dụ mẫu có lời giải từng bước', content: `Cho f(x)=x³−3x. Ta có f'(x)=3x²−3=3(x−1)(x+1). Giải f'(x)=0 được x=−1 và x=1. Xét dấu: f'(x)>0 khi x<−1 hoặc x>1; f'(x)<0 khi −1<x<1. Vì vậy f đồng biến trên (−∞,−1) và (1,+∞), nghịch biến trên (−1,1). Tại x=−1, đạo hàm đổi dấu + sang − nên có cực đại f(−1)=2. Tại x=1, đạo hàm đổi dấu − sang + nên có cực tiểu f(1)=−2.` },
        { title: '5. Kiểm tra lỗi thường gặp', content: `Không quên hệ số khi lấy đạo hàm; không chia khoảng thiếu điểm tới hạn; không dùng giá trị f'(x₀)=0 để kết luận cực trị khi chưa xét dấu; phân biệt hoành độ cực trị x₀ với giá trị cực trị f(x₀); và ghi khoảng đơn điệu bằng khoảng mở. Sau mỗi lời giải, thay ít nhất một hệ số rồi tính lại để kiểm tra xem mình hiểu quy trình hay chỉ nhớ đáp án mẫu.` }
    ];
    const theory = theorySections.map(section => `${section.title}\n${section.content}`).join('\n\n');
    return {
        ...rich,
        theorySections,
        theory,
        lecture: { title: `Bài giảng: ${topic}`, script: `Ta đi từ đạo hàm đến bảng dấu, rồi mới kết luận. Với f(x)=x³−3x, đạo hàm là 3x²−3=3(x−1)(x+1). Hai nghiệm −1 và 1 chia trục số thành ba khoảng. Chọn một giá trị thử trong mỗi khoảng để xác định dấu đạo hàm. Dấu +, −, + cho thấy hàm đồng biến, nghịch biến, rồi đồng biến. Đạo hàm đổi dấu + sang − tại −1 nên đây là điểm cực đại; đổi dấu − sang + tại 1 nên đây là điểm cực tiểu. Cuối cùng thế vào hàm số để tính giá trị cực trị.`, keyPoints: ['Tính đúng đạo hàm', `Giải f'(x)=0`, 'Lập bảng dấu trên từng khoảng', 'Kết luận đơn điệu từ dấu đạo hàm', 'Xét đổi dấu trước khi kết luận cực trị'] },
        examples: [
            { title: 'Ví dụ mẫu 1 — Tìm đơn điệu và cực trị', text: `Đề: f(x)=x³−3x. Lời giải: f'(x)=3x²−3=3(x−1)(x+1). Nghiệm f'(x)=0 là −1, 1. Dấu đạo hàm lần lượt là +, −, + trên ba khoảng. Kết luận: đồng biến (−∞,−1), (1,+∞); nghịch biến (−1,1); cực đại f(−1)=2; cực tiểu f(1)=−2.` },
            { title: 'Ví dụ mẫu 2 — Nhận biết điểm không phải cực trị', text: `Đề: g(x)=x³. Ta có g'(x)=3x²≥0 và g'(0)=0, nhưng dấu đạo hàm không đổi từ + sang − hoặc − sang + khi qua 0. Vì vậy x=0 không phải điểm cực đại hay cực tiểu; đây là ví dụ chứng minh f'(x₀)=0 chưa đủ để kết luận có cực trị.` },
            { title: 'Ví dụ mẫu 3 — Vận dụng mô hình', text: `Lợi nhuận P(x)=−x²+12x−20, với x≥0. Ta có P'(x)=−2x+12; P'(x)=0 khi x=6. Đạo hàm dương khi x<6 và âm khi x>6, nên P đạt cực đại tại x=6. Giá trị P(6)=−36+72−20=16. Theo mô hình, lợi nhuận lớn nhất là 16 đơn vị tiền khi sản lượng x=6; kết luận chỉ có ý nghĩa trong phạm vi giả định của mô hình.` }
        ],
        activities: [
            { type: 'guided_practice', title: 'Luyện tập có hướng dẫn', instruction: `Tính f'(x), tìm nghiệm đạo hàm, lập bảng dấu và viết kết luận cho f(x)=x³−6x²+9x.` },
            { type: 'independent', title: 'Bài làm độc lập', instruction: `Xét tính đơn điệu và cực trị của h(x)=x³−12x. Trình bày miền xác định, đạo hàm, nghiệm, bảng dấu, hoành độ và giá trị cực trị.` },
            { type: 'real_world', title: 'Vận dụng tình huống thực tế', instruction: `Một mô hình chi phí/lợi nhuận được cho bởi P(x)=−2x²+20x−32 với x trong khoảng [0,10]. Tìm mức x cho P lớn nhất, tính giá trị đó và nêu một giới hạn của việc dùng mô hình toán học cho quyết định thực tế.` }
        ],
        practiceTasks: [
            { title: '1. Luyện tập có hướng dẫn', task: `Với f(x)=x³−6x²+9x, hãy tính đạo hàm, tìm điểm tới hạn và lập bảng dấu. Gợi ý: phân tích f'(x)=3x²−12x+9 thành tích các nhân tử trước khi xét dấu.`, submissionType: 'TEXT', rubric: { criteria: [{ name: 'Đạo hàm và phân tích đúng', points: 3 }, { name: 'Nghiệm tới hạn và bảng dấu', points: 4 }, { name: 'Kết luận đơn điệu/cực trị', points: 3 }] } },
            { title: '2. Bài làm độc lập', task: `Xét tính đơn điệu và cực trị của h(x)=x³−12x. Không xem ví dụ mẫu; nộp đầy đủ đạo hàm, nghiệm, bảng dấu và giá trị cực trị.`, submissionType: 'TEXT', rubric: { criteria: [{ name: 'Đạo hàm và nghiệm', points: 3 }, { name: 'Bảng dấu và khoảng đơn điệu', points: 4 }, { name: 'Giá trị cực trị và trình bày', points: 3 }] } },
            { title: '3. Vận dụng thực tế', task: `Mô hình doanh thu P(x)=−2x²+20x−32, 0≤x≤10. Tìm x giúp doanh thu lớn nhất, tính giá trị lớn nhất và giải thích một giả định/giới hạn của mô hình.`, submissionType: 'TEXT', rubric: { criteria: [{ name: 'Thiết lập và tìm điểm tới hạn', points: 3 }, { name: 'Xác định giá trị lớn nhất trong miền cho trước', points: 4 }, { name: 'Giải thích bối cảnh và giới hạn mô hình', points: 3 }] } },
            { title: '4. Bài kiểm tra kiến thức của riêng bài này', task: `Trong 10 phút, xét đơn điệu và cực trị của q(x)=x³−3x²−9x+1. Tự làm, trình bày đạo hàm, nghiệm tới hạn, bảng dấu và kết luận trước khi nộp.`, submissionType: 'TEXT', rubric: { criteria: [{ name: 'Đạo hàm chính xác', points: 2 }, { name: 'Tìm nghiệm đạo hàm', points: 2 }, { name: 'Bảng dấu đúng', points: 3 }, { name: 'Kết luận đơn điệu/cực trị', points: 3 }] } }
        ],
        practical: { kind: 'applied_math', title: `Thực hành ứng dụng: ${topic}`, task: `Nộp một lời giải có thể kiểm tra được cho mô hình P(x)=−2x²+20x−32 trên miền [0,10], gồm công thức đạo hàm, bảng dấu, kết luận mức x tối ưu và giải thích ý nghĩa trong ngữ cảnh.`, checklist: ['Ghi giả thiết và miền xác định', 'Tính đạo hàm và tìm nghiệm', 'Xét dấu trong miền cho trước', 'Kiểm tra biên của miền', 'Kết luận và giải thích'], rubric: { criteria: [{ name: 'Phương pháp', points: 3 }, { name: 'Tính toán', points: 3 }, { name: 'Xét miền và kiểm tra biên', points: 2 }, { name: 'Giải thích thực tế', points: 2 }] }, submissionType: 'TEXT' },
        quickChecks: [`Dấu f'(x) xác định tính đồng biến/nghịch biến như thế nào?`, `Vì sao f'(x₀)=0 chưa đủ kết luận x₀ là cực trị?`, 'Phân biệt hoành độ cực trị và giá trị cực trị.', 'Một bảng dấu có ba khoảng cần kiểm tra những điểm nào?'],
        summary: { title: `Tóm tắt: ${topic}`, points: ['Tập xác định phải được xét trước.', 'Tính đạo hàm và tìm điểm tới hạn.', 'Dùng dấu đạo hàm để kết luận đơn điệu.', 'Chỉ kết luận cực trị sau khi xét đổi dấu.', 'Thế vào hàm số để tính giá trị cực trị.'] },
        contentWordCount: theory.split(/\s+/).filter(Boolean).length,
        estimatedMinutes: 50
    };
}

function normalizeStaticLesson(grade, subjectId, lesson) {
    if (!lesson) return null;
    const materialized = getLesson(grade, subjectId, lesson.id)?.lesson || lesson;
    lesson = materialized;
    const subject = subjectRecord(grade, subjectId);
    const subjectName = subject?.name || subject?.baseName || subjectId;
    const topic = lesson.topic || lesson.title;
    const rich = specializeCalculusLesson(k12RichLesson({ grade, subjectId, subjectName, topic, baseTheory: lesson, lessonNo: Number(lesson.order || 1) }), lesson, grade, subjectId, subjectName);
    const existingQuestions = Array.isArray(lesson.questions) ? lesson.questions : [];
    const normalizedTopic = String(topic || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isUpperMathCalculus = Number(grade) >= 10 && /toan|math/i.test(`${subjectId} ${subjectName}`) && /don dieu|cuc tri|dao ham|bien thien ham so/.test(normalizedTopic);
    const hasObviousLegacyMismatch = Number(grade) > 5 && existingQuestions.some(question => /187\s*\+\s*74|252\s*-\s*152|3 hàng, mỗi hàng/i.test(String(question?.prompt || '')));
    const isTooShortForLessonTest = existingQuestions.length < 8;
    const calculusQuestionsOffTopic = isUpperMathCalculus && existingQuestions.filter(question => /đạo hàm|đơn điệu|cực trị|f\(|cực đại|cực tiểu|nghịch biến/i.test(String(question?.prompt || ''))).length < Math.ceil(existingQuestions.length * 0.6);
    const questions = existingQuestions.length && !hasObviousLegacyMismatch && !isTooShortForLessonTest && !calculusQuestionsOffTopic ? existingQuestions : buildK12Questions({ grade, subjectId, subjectName, topic, index: Number(lesson.order || 1) - 1, count: 12 });
    return {
        id: lessonId(grade, subjectId, lesson.order),
        legacyId: lesson.id,
        courseId: courseId(grade, subjectId),
        curriculumVersion: PROGRAM_VERSION,
        educationLevel: educationLevelForGrade(grade),
        grade,
        subjectId,
        title: lesson.title,
        description: `${lesson.topic || lesson.title}. Học theo trình tự lý thuyết → ví dụ → thực hành → tự kiểm tra.`,
        unit: lesson.unit,
        unitTitle: lesson.unitTitle,
        phase: lesson.phase,
        difficulty: lesson.difficulty,
        estimatedMinutes: Math.max(Number(lesson.estimatedMinutes || 0), Number(rich.estimatedMinutes || 0)),
        topic: lesson.topic,
        objectives: lesson.objectives || [],
        learningOutcomes: lesson.learningOutcomes || lesson.objectives || [],
        competencies: lesson.competencies || {},
        qualities: lesson.qualities || [],
        theory: rich.theory || lesson.theory || [],
        theorySections: rich.theorySections || lesson.theorySections || [],
        glossary: rich.glossary || lesson.glossary || [],
        commonMistakes: rich.commonMistakes || lesson.commonMistakes || [],
        quickChecks: rich.quickChecks || lesson.quickChecks || [],
        studySteps: rich.studySteps || lesson.studySteps || [],
        examples: rich.examples || lesson.keyPoints || [],
        activities: rich.activities || [],
        lecture: rich.lecture || {},
        practiceTasks: rich.practiceTasks || lesson.practiceTasks || [],
        summary: rich.summary || {},
        practical: rich.practical || null,
        contentProfile: { subjectType: rich.subjectName || subject?.name || subjectId, gradeStyle: grade <= 5 ? 'PRIMARY_CONCRETE' : grade <= 9 ? 'SECONDARY_CONCEPTUAL' : 'UPPER_SECONDARY_APPLIED', format: 'TEXTBOOK_STYLE_ORIGINAL' },
        assessment: { ...(lesson.assessment || {}), questionCount: 12, assessmentCode: `k12-assessment-${grade}-${subjectId}-lesson-${lesson.order}` },
        questions: questions.map(({ answer, explanation, acceptedAnswers, rubric, ...question }) => ({ ...question, id: String(question.id) })),
        questionCount: questions.length,
        contentWordCount: rich.contentWordCount || 0,
        sourceRef: K12_SOURCE_REF,
        sourceLabel: 'Nội dung nguyên bản bám định hướng chương trình tham chiếu; được trình bày theo cấu trúc học tập tương tự giáo trình, không sao chép sách giáo khoa.'
    };
}

function buildK12Courses({ grade, educationLevel, subjectId, search } = {}) {
    const grades = grade ? [Number(grade)] : educationLevel && LEVELS[educationLevel] ? LEVELS[educationLevel] : Array.from({ length: 12 }, (_, i) => i + 1);
    const query = String(search || '').trim().toLowerCase();
    const result = [];
    for (const currentGrade of grades) {
        if (!Number.isInteger(currentGrade) || currentGrade < 1 || currentGrade > 12) continue;
        const catalog = getCatalog(currentGrade);
        for (const subject of catalog.subjects || []) {
            if (subjectId && subject.id !== subjectId) continue;
            const course = {
                id: courseId(currentGrade, subject.id),
                _id: null,
                code: `K12-G${currentGrade}-${subject.id}`,
                name: subject.name,
                title: subject.name,
                programCode: 'VN-GDPT-REFERENCE',
                programName: 'Chương trình giáo dục phổ thông tham chiếu',
                curriculumVersion: catalog.programVersion,
                educationLevel: educationLevelForGrade(currentGrade),
                educationLevelName: catalog.programVersion,
                grade: currentGrade,
                gradeName: `Lớp ${currentGrade}`,
                subjectId: subject.id,
                subjectName: subject.baseName || subject.name,
                icon: subject.icon,
                compulsory: Boolean(subject.compulsory),
                statusLabel: subject.statusLabel,
                gradeFocus: subject.gradeFocus,
                objectiveSummary: subject.competencyProfile,
                unitCount: Number(subject.units || subject.unitMap?.length || 0),
                lessonCount: Number(subject.lessonCount || subject.lessons?.length || 0),
                unitMap: subject.unitMap || [],
                description: `Khóa học ${subject.name} lớp ${currentGrade}, gồm ${Number(subject.lessonCount || subject.lessons?.length || 0)} bài học được chia theo chủ đề và chặng học.`,
                sourceRef: K12_SOURCE_REF,
                sourceLabel: 'Nội dung nguyên bản bám chương trình tham chiếu, không phải dữ liệu official.'
            };
            if (!query || JSON.stringify(course).toLowerCase().includes(query)) result.push(course);
        }
    }
    return result;
}

function buildK12CourseDetail(id) {
    const parsed = parseK12CourseId(id);
    if (!parsed) return null;
    const subject = subjectRecord(parsed.grade, parsed.subjectId);
    if (!subject) return null;
    const catalog = getCatalog(parsed.grade);
    const lessons = (subject.lessons || []).map(lesson => normalizeStaticLesson(parsed.grade, parsed.subjectId, lesson));
    const units = new Map();
    for (const lesson of lessons) {
        if (!units.has(lesson.unit)) units.set(lesson.unit, { unit: lesson.unit, title: lesson.unitTitle, lessons: [] });
        units.get(lesson.unit).lessons.push(lesson);
    }
    const course = buildK12Courses({ grade: parsed.grade, subjectId: parsed.subjectId }).find(item => item.id === id);
    const assessments = lessons.filter(lesson => lesson.assessment).map(lesson => ({ id: `k12-assessment-${parsed.grade}-${parsed.subjectId}-lesson-${lesson.legacyId}`, code: `k12-assessment-${parsed.grade}-${parsed.subjectId}-lesson-${lesson.legacyId}`, title: `Kiểm tra bài ${lesson.legacyId}: ${lesson.title}`, assessmentType: 'LESSON_TEST', lessonId: lesson.id, lessonNo: lesson.legacyId, questionCount: lesson.questionCount, durationSeconds: 20 * 60, passingScore: 70, sourceRef: K12_SOURCE_REF }));
    const chapters = [...units.values()].map((unit, index) => ({ order: index + 1, title: unit.title, description: `Chủ đề ${index + 1} gồm các bài học liên kết từ dễ đến khó.`, lessons: unit.lessons, test: { id: `k12-assessment-${parsed.grade}-${parsed.subjectId}-unit-${index + 1}`, code: `k12-assessment-${parsed.grade}-${parsed.subjectId}-unit-${index + 1}`, title: `Kiểm tra chủ đề ${index + 1}: ${unit.title}`, assessmentType: 'CHAPTER_TEST', questionCount: Math.min(24, unit.lessons.length * 12), durationSeconds: 30 * 60, passingScore: 70, sourceRef: K12_SOURCE_REF } }));
    return {
        course: { ...course, lessonCount: lessons.length, assessmentCount: assessments.length + chapters.length + 3, questionCount: lessons.reduce((sum, lesson) => sum + lesson.questionCount, 0), contentCompleteness: lessons.length ? 100 : 0 },
        program: { code: course.programCode, name: course.programName, curriculumVersion: course.curriculumVersion, sourceRef: K12_SOURCE_REF },
        units: [...units.values()],
        chapters,
        lessons,
        assessments,
        midtermAssessment: { id: `k12-assessment-${parsed.grade}-${parsed.subjectId}-midterm`, code: `k12-assessment-${parsed.grade}-${parsed.subjectId}-midterm`, title: `Kiểm tra giữa kỳ · ${subject.name}`, assessmentType: 'MIDTERM', questionCount: Math.min(60, lessons.length * 12), durationSeconds: 60 * 60, passingScore: 70, sourceRef: K12_SOURCE_REF },
        finalAssessment: { id: `k12-assessment-${parsed.grade}-${parsed.subjectId}-final`, code: `k12-assessment-${parsed.grade}-${parsed.subjectId}-final`, title: `Kiểm tra cuối khóa · ${subject.name}`, assessmentType: 'FINAL', questionCount: Math.min(100, lessons.length * 12), durationSeconds: 90 * 60, passingScore: 70, sourceRef: K12_SOURCE_REF },
        mockAssessment: { id: `k12-assessment-${parsed.grade}-${parsed.subjectId}-mock`, code: `k12-assessment-${parsed.grade}-${parsed.subjectId}-mock`, title: `Mock Test · ${subject.name}`, assessmentType: 'MOCK', questionCount: Math.min(80, lessons.length * 12), durationSeconds: 75 * 60, passingScore: 70, sourceRef: K12_SOURCE_REF },
        catalogMeta: { grade: parsed.grade, gradeName: `Lớp ${parsed.grade}`, gradeFocus: catalog.gradeFocus, subject: { id: subject.id, name: subject.name, icon: subject.icon, compulsory: subject.compulsory, statusLabel: subject.statusLabel }, sourceRef: K12_SOURCE_REF }
    };
}

function buildK12LessonDetail(id) {
    const parsed = parseK12LessonId(id);
    if (!parsed) return null;
    const subject = subjectRecord(parsed.grade, parsed.subjectId);
    const legacyLesson = subject?.lessons?.find(item => Number(item.order) === parsed.lessonNo);
    if (!legacyLesson) return null;
    const lesson = normalizeStaticLesson(parsed.grade, parsed.subjectId, legacyLesson);
    const previous = parsed.lessonNo > 1 ? lessonId(parsed.grade, parsed.subjectId, parsed.lessonNo - 1) : null;
    const next = legacyLesson.order < subject.lessons.length ? lessonId(parsed.grade, parsed.subjectId, parsed.lessonNo + 1) : null;
    return {
        lesson,
        navigation: { previousLessonId: previous, nextLessonId: next, totalLessons: subject.lessons.length },
        sourceRef: K12_SOURCE_REF
    };
}

module.exports = { K12_SOURCE_REF, educationLevelForGrade, buildK12Courses, buildK12CourseDetail, buildK12LessonDetail, parseK12CourseId, parseK12LessonId, courseId, lessonId };
