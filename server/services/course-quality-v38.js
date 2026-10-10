'use strict';

const crypto = require('crypto');
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const words = value => clean(value, 20000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().match(/[a-z0-9+#]+/g) || [];
const wordCount = value => clean(value, 20000).split(/\s+/).filter(Boolean).length;
const uniqueBy = (items, keyFn) => { const seen = new Set(); return (items || []).filter(item => { const key = keyFn(item); if (!key || seen.has(key)) return false; seen.add(key); return true; }); };
const fingerprint = value => crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');

function makeCourseGenerationPrompt(input = {}) {
    const track = clean(input.track || input.targetExam || input.educationLevel || 'GENERAL', 120);
    const target = clean(input.title || input.name || input.prompt || input.subject || input.major || 'Khóa học theo mục tiêu người học', 500);
    return `Thiết kế một khóa học mới, riêng biệt cho nhu cầu sau. Không sao chép một dàn ý cố định, không ép mọi khóa vào cùng số chương/bài hoặc cùng thứ tự mục. Hãy suy luận cấu trúc tối ưu dựa trên bản chất kiến thức, trình độ, mục tiêu đầu ra, điều kiện tiên quyết, kỹ năng cần đánh giá và thời lượng hợp lý.\n\nYÊU CẦU NGƯỜI DÙNG:\n${JSON.stringify({ ...input, title: target, track }, null, 2).slice(0, 12000)}\n\nNGUYÊN TẮC THIẾT KẾ:\n- Phân loại đúng: lớp 1-12, đại học/ngành/chuyên ngành, TOEIC, IELTS, MOS hoặc lĩnh vực khác; không trộn track, khối lớp, môn, chứng chỉ hay kỹ năng không liên quan. Với K12 phải đúng lớp/môn và kiến thức theo độ tuổi; với TOEIC/IELTS phải phân tách đúng kỹ năng/dạng bài, IELTS theo 4 kỹ năng khi mục tiêu tổng quát; MOS phải đúng ứng dụng/phiên bản nếu được chỉ định và đánh giá bằng tác vụ; đại học phải gắn với mục tiêu học phần/ngành và điều kiện tiên quyết.\n- Tự chọn số chương và bài dựa trên độ rộng mục tiêu; mỗi chương có mục tiêu rõ, các bài tiến triển logic, không lặp chủ đề chỉ để tăng số lượng. Không bịa rằng đây là giáo trình/đề thi chính thức.\n- Mỗi bài: mục tiêu đo lường được; 3-7 phần lý thuyết có nội dung giải thích cụ thể; bài giảng hướng dẫn từng bước; ví dụ có đề bài và lời giải giải thích; 2-5 hoạt động/bài luyện từ cơ bản tới vận dụng; lỗi thường gặp; điều kiện tiên quyết; 5-10 câu kiểm tra ĐÚNG nội dung bài, có đáp án và giải thích. Câu hỏi phải có đáp án xác định hoặc rubric cho tự luận/thực hành; không tạo câu hỏi chung chung kiểu “bước nào giúp học tốt”.\n- Mỗi chương có mục tiêu và đề kiểm tra chương bao phủ những bài trong chương; đề cuối khóa là bộ câu hỏi tổng hợp RIÊNG, không chỉ sao chép câu hỏi bài học. Câu hỏi kiểm tra phải khác nhau, không lặp nguyên văn, phân bổ kỹ năng và độ khó phù hợp. Với coding cần đề bài, định dạng input/output, ví dụ hợp lệ và test case có ý nghĩa; MOS cần thao tác cụ thể và tiêu chí kết quả; speaking/writing cần rubric chấm rõ; không giả vờ chấm tự động nếu cần người chấm.\n- Nội dung phải đúng chuyên môn, có chiều sâu phù hợp, không dùng đoạn văn khuôn mẫu thay cho giải thích chủ đề. Nếu không chắc thông tin có tính chính thức hoặc thay đổi theo phiên bản, nêu giới hạn trong phần ghi chú, không tự bịa nguồn.\n- Trả về JSON hợp lệ đúng schema; không markdown, không lời dẫn. Giữ mọi trường gắn với cùng courseId/subject/grade/track sau này.\n\nHãy tạo blueprint gồm: title, code, description, audience, courseType, educationLevel, grade (số nguyên chỉ cho K12; bỏ trường này ở track khác), subjectId, targetExam, targetVariant, difficulty, estimatedMinutes, objectives[], prerequisites[], skills[], learningOutcomes[], chapters[]. Mỗi chapter có title, description, lessons[]. Mỗi lesson có title, description, objectives[], skills[], prerequisites[], difficulty, estimatedMinutes, theorySections[{title,content}], lecture{title,script,keyPoints[]}, examples[{title,problem,solution}], activities[{type,title,instruction}], practiceTasks[], commonMistakes[], audioScript, visualPrompt, questions[]. Mỗi question có prompt,type,options[],answer,explanation,skill,difficulty,points,rubric (nếu câu trả lời mở). Thêm chapter assessment questions[] cho mỗi chương và finalAssessment.questions[] độc lập với câu hỏi từng bài. Các trường chapter assessment/finalAssessment cần có passingScore,durationSeconds,questions[].`;
}

const qSchema = { type: 'OBJECT', properties: {
    prompt: { type: 'STRING' }, type: { type: 'STRING' }, options: { type: 'ARRAY', items: { type: 'STRING' } }, answer: { type: 'STRING' }, explanation: { type: 'STRING' }, skill: { type: 'STRING' }, difficulty: { type: 'STRING' }, points: { type: 'NUMBER' }, rubric: { type: 'OBJECT', properties: { criteria: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, weight: { type: 'NUMBER' } }, required: ['name','weight'] } } }, media: { type: 'OBJECT', properties: { coding: { type: 'OBJECT', properties: { language: { type: 'STRING' }, starterCode: { type: 'STRING' }, statement: { type: 'STRING' }, inputFormat: { type: 'STRING' }, outputFormat: { type: 'STRING' }, visibleTestCases: { type: 'ARRAY', items: { type: 'OBJECT', properties: { input: { type: 'STRING' }, output: { type: 'STRING' } }, required: ['input','output'] } }, hiddenTestCases: { type: 'ARRAY', items: { type: 'OBJECT', properties: { input: { type: 'STRING' }, output: { type: 'STRING' } }, required: ['input','output'] } }, timeLimitMs: { type: 'INTEGER' } }, required: ['language','starterCode','statement','inputFormat','outputFormat','visibleTestCases'] } } } }
}, required: ['prompt','type','options','answer','explanation','skill','difficulty'] };
const textSection = { type: 'OBJECT', properties: { title: { type: 'STRING' }, content: { type: 'STRING' } }, required: ['title','content'] };
const exampleSchema = { type: 'OBJECT', properties: { title: { type: 'STRING' }, problem: { type: 'STRING' }, solution: { type: 'STRING' } }, required: ['title','problem','solution'] };
const lessonSchema = { type: 'OBJECT', properties: {
    title: { type: 'STRING' }, description: { type: 'STRING' }, objectives: { type: 'ARRAY', items: { type: 'STRING' } }, skills: { type: 'ARRAY', items: { type: 'STRING' } }, prerequisites: { type: 'ARRAY', items: { type: 'STRING' } }, difficulty: { type: 'STRING' }, estimatedMinutes: { type: 'INTEGER' }, theorySections: { type: 'ARRAY', items: textSection }, lecture: { type: 'OBJECT', properties: { title: { type: 'STRING' }, script: { type: 'STRING' }, keyPoints: { type: 'ARRAY', items: { type: 'STRING' } }, }, required: ['title','script','keyPoints'] }, examples: { type: 'ARRAY', items: exampleSchema }, activities: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: { type: 'STRING' }, title: { type: 'STRING' }, instruction: { type: 'STRING' } }, required: ['type','title','instruction'] } }, practiceTasks: { type: 'ARRAY', items: { type: 'STRING' } }, commonMistakes: { type: 'ARRAY', items: { type: 'STRING' } }, audioScript: { type: 'STRING' }, visualPrompt: { type: 'STRING' }, questions: { type: 'ARRAY', items: qSchema }
}, required: ['title','description','objectives','skills','theorySections','lecture','examples','activities','practiceTasks','commonMistakes','questions'] };
const assessmentSchema = { type: 'OBJECT', properties: { passingScore: { type: 'NUMBER' }, durationSeconds: { type: 'INTEGER' }, questions: { type: 'ARRAY', items: qSchema } }, required: ['questions'] };
const courseBlueprintSchemaV38 = { type: 'OBJECT', properties: {
    title: { type: 'STRING' }, code: { type: 'STRING' }, description: { type: 'STRING' }, audience: { type: 'STRING' }, courseType: { type: 'STRING' }, educationLevel: { type: 'STRING' }, grade: { type: 'INTEGER' }, subjectId: { type: 'STRING' }, targetExam: { type: 'STRING' }, targetVariant: { type: 'STRING' }, difficulty: { type: 'STRING' }, estimatedMinutes: { type: 'INTEGER' }, objectives: { type: 'ARRAY', items: { type: 'STRING' } }, prerequisites: { type: 'ARRAY', items: { type: 'STRING' } }, skills: { type: 'ARRAY', items: { type: 'STRING' } }, learningOutcomes: { type: 'ARRAY', items: { type: 'STRING' } }, chapters: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' }, lessons: { type: 'ARRAY', items: lessonSchema }, assessment: assessmentSchema }, required: ['title','description','lessons'] } }, finalAssessment: assessmentSchema
}, required: ['title','description','educationLevel','subjectId','objectives','skills','learningOutcomes','chapters','finalAssessment'] };

function normalizeGeneratedBlueprint(raw, input = {}, model = '') {
    const chapters = (Array.isArray(raw?.chapters) ? raw.chapters : []).map((chapter, ci) => ({
        code: clean(chapter.code || `${clean(raw.code || raw.title, 60)}-CH${ci + 1}`, 100), title: clean(chapter.title, 180), overview: clean(chapter.description || chapter.overview, 1200),
        assessment: chapter.assessment || { questions: [] },
        lessons: (Array.isArray(chapter.lessons) ? chapter.lessons : []).map((lesson, li) => ({
            code: clean(lesson.code || `CH${ci + 1}-L${li + 1}`, 100), title: clean(lesson.title, 180), description: clean(lesson.description, 1500), objectives: Array.isArray(lesson.objectives) ? lesson.objectives.slice(0, 12).map(v => clean(v, 400)) : [], skills: Array.isArray(lesson.skills) ? lesson.skills.slice(0, 20).map(v => clean(v, 160)) : [], prerequisites: Array.isArray(lesson.prerequisites) ? lesson.prerequisites.slice(0, 20).map(v => clean(v, 180)) : [], difficulty: clean(lesson.difficulty || 'INTERMEDIATE', 40).toUpperCase(), estimatedMinutes: Math.max(5, Math.min(600, Number(lesson.estimatedMinutes) || 30)), theorySections: Array.isArray(lesson.theorySections) ? lesson.theorySections.map(s => ({ title: clean(s.title, 180), content: clean(s.content, 8000) })) : [], lectureScript: lesson.lecture || { opening: '', teachingSteps: [], checksForUnderstanding: [], summary: '' }, examples: Array.isArray(lesson.examples) ? lesson.examples.map(e => typeof e === 'string' ? { title: 'Ví dụ', problem: e, solution: '' } : ({ title: clean(e.title, 180), problem: clean(e.problem, 3000), solution: clean(e.solution, 6000) })) : [], activities: Array.isArray(lesson.activities) ? lesson.activities.map(a => ({ title: clean(a.title, 180), type: clean(a.type, 80), instructions: clean(a.instruction || a.instructions, 3000) })) : [], practice: Array.isArray(lesson.practiceTasks) ? lesson.practiceTasks.map((task, i) => ({ title: `Luyện tập ${i + 1}`, instructions: clean(task, 3000) })) : [], practical: lesson.practical || null, commonMistakes: Array.isArray(lesson.commonMistakes) ? lesson.commonMistakes.map(v => clean(v, 600)) : [], audioScript: clean(lesson.audioScript, 12000), visualPrompt: clean(lesson.visualPrompt, 1000), questions: Array.isArray(lesson.questions) ? lesson.questions.map((q, qi) => ({ ...q, code: clean(q.code || `CH${ci + 1}-L${li + 1}-Q${qi + 1}`, 100), prompt: clean(q.prompt, 3000), type: clean(q.type, 60).toLowerCase(), options: Array.isArray(q.options) ? q.options.map(o => typeof o === 'string' ? o : clean(o.label || o.text || o.value, 500)) : [], answer: typeof q.answer === 'string' ? clean(q.answer, 3000) : JSON.stringify(q.answer ?? ''), explanation: clean(q.explanation, 4000), skill: clean(q.skill || lesson.skills?.[0] || lesson.title, 200), difficulty: clean(q.difficulty || 'INTERMEDIATE', 40).toUpperCase(), points: Math.max(1, Number(q.points) || 1), rubric: q.rubric || undefined })) : []
        }))
    }));
    const normalizeAssessment = value => ({ passingScore: Math.max(50, Math.min(100, Number(value?.passingScore) || 70)), durationSeconds: Math.max(300, Math.min(14400, Number(value?.durationSeconds) || 1800)), questions: (Array.isArray(value?.questions) ? value.questions : []).map((q, i) => ({ ...q, code: clean(q.code || `FINAL-Q${i + 1}`, 100), prompt: clean(q.prompt, 3000), type: clean(q.type, 60).toLowerCase(), options: Array.isArray(q.options) ? q.options.map(o => typeof o === 'string' ? o : clean(o.label || o.text || o.value, 500)) : [], answer: typeof q.answer === 'string' ? clean(q.answer, 3000) : JSON.stringify(q.answer ?? ''), explanation: clean(q.explanation, 4000), skill: clean(q.skill || 'Tổng hợp', 200), difficulty: clean(q.difficulty || 'INTERMEDIATE', 40).toUpperCase(), points: Math.max(1, Number(q.points) || 1), rubric: q.rubric || undefined })) });
    const allLessons = chapters.flatMap(ch => ch.lessons);
    const rawLevel = clean(raw.educationLevel || input.educationLevel || '', 60).toUpperCase();
    const gradeNum = Number(raw.grade ?? input.grade);
    const grade = Number.isInteger(gradeNum) && gradeNum >= 1 && gradeNum <= 12 ? gradeNum : null;
    const domain = clean(raw.domainCode || input.domainCode || input.track || '', 100).toUpperCase();
    return {
        ...raw, title: clean(raw.title || input.title || input.prompt, 180), code: clean(raw.code || raw.title || input.title, 80).replace(/[^a-zA-Z0-9_-]+/g, '-').toUpperCase(), description: clean(raw.description, 2500), educationLevel: rawLevel || (grade ? (grade <= 5 ? 'PRIMARY' : grade <= 9 ? 'LOWER_SECONDARY' : 'UPPER_SECONDARY') : 'HIGHER_EDUCATION'), grade, subjectId: clean(raw.subjectId || input.subjectId || input.subject || 'GENERAL', 100).toUpperCase(), domainCode: domain, track: clean(raw.track || input.track || input.targetExam || domain, 120), category: clean(raw.category || raw.courseType || 'OTHER', 80).toUpperCase(), majorName: clean(raw.majorName || input.major || input.majorName, 180), targetExam: clean(raw.targetExam || input.targetExam, 100), targetVariant: clean(raw.targetVariant || input.targetVariant, 100), objectives: Array.isArray(raw.objectives) ? raw.objectives.map(v => clean(v, 500)) : [], prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites.map(v => clean(v, 500)) : [], skills: Array.isArray(raw.skills) ? raw.skills.map(v => clean(v, 200)) : [], learningOutcomes: Array.isArray(raw.learningOutcomes) ? raw.learningOutcomes.map(v => clean(v, 500)) : [], estimatedMinutes: Math.max(30, Number(raw.estimatedMinutes) || allLessons.reduce((sum, l) => sum + l.estimatedMinutes, 0)), chapters, finalAssessment: normalizeAssessment(raw.finalAssessment), sourceType: 'AI_GENERATED', courseKind: 'AI_DRAFT', official: false, metadata: { engine: model || 'GEMINI_COURSE_GENERATION', engineVersion: '38.0.0', noExternalApi: false, fingerprint: fingerprint({ input, title: raw.title, chapters: chapters.map(c => ({ title: c.title, lessons: c.lessons.map(l => l.title) })) }), generatedBy: 'GEMINI', generatedAt: new Date().toISOString() }
    };
}


function validateRequestedCourseScope(blueprint = {}, input = {}) {
    const errors = [];
    const normalize = value => clean(value, 200).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '');
    const canonicalLevel = value => {
        const level = normalize(value);
        if (['primary','primaryschool','tieuhoc'].includes(level)) return 'PRIMARY';
        if (['lowersecondary','secondarylower','thcs','middleschool'].includes(level)) return 'LOWER_SECONDARY';
        if (['uppersecondary','secondaryupper','thpt','highschool'].includes(level)) return 'UPPER_SECONDARY';
        if (['highereducation','university','daihoc','college'].includes(level)) return 'HIGHER_EDUCATION';
        if (['englishcertification','english','languagecertification'].includes(level)) return 'ENGLISH_CERTIFICATION';
        return level.toUpperCase();
    };
    if (input.grade && Number(blueprint.grade) !== Number(input.grade)) errors.push(`Sai lớp: yêu cầu lớp ${input.grade}, AI trả về ${blueprint.grade || 'không xác định'}.`);
    if (input.subjectId && normalize(blueprint.subjectId) !== normalize(input.subjectId)) errors.push(`Sai môn: yêu cầu ${input.subjectId}, AI trả về ${blueprint.subjectId || 'không xác định'}.`);
    if (input.targetExam && !['other','general','university','k12'].includes(normalize(input.targetExam)) && !normalize(blueprint.targetExam || blueprint.track).includes(normalize(input.targetExam))) errors.push(`Sai chứng chỉ/track: yêu cầu ${input.targetExam}, AI trả về ${blueprint.targetExam || blueprint.track || 'không xác định'}.`);
    if (input.educationLevel && canonicalLevel(blueprint.educationLevel) !== canonicalLevel(input.educationLevel)) errors.push(`Sai cấp học: yêu cầu ${input.educationLevel}, AI trả về ${blueprint.educationLevel || 'không xác định'}.`);
    return { valid: errors.length === 0, errors };
}

function similarity(a, b) {
    const stop = new Set(['trong','chu','de','hay','va','cua','la','mot','cac','nhung','cho','theo','voi','duoc','phu','hop','nhat','so','bai','tinh','huong','thuc','te','du','kien','ket','qua','xac','dinh','phan','tich','chon','giai','thich','ap','dung','tai','sao','gi','nao','nguoi','hoc','hay','can','co','the','khong','den','tu','deu','neu','vi','du','khi','sau','truoc','moi','mot','cac','phan','noi','dung','phuong','an','tinh','huong','so','san','sanh','quy','trinh','nguyen','nhan','tham','so','dau','vao','ra']);
    const left = new Set(words(a).filter(token => !stop.has(token))); const right = new Set(words(b).filter(token => !stop.has(token))); if (!left.size || !right.size) return 0;
    let overlap = 0; for (const token of left) if (right.has(token)) overlap += 1;
    return overlap / new Set([...left, ...right]).size;
}
function auditCourseBlueprintV38(blueprint = {}, { requireIndependentFinal = true } = {}) {
    const errors = []; const warnings = []; const details = { chapterCount: 0, lessonCount: 0, questionCount: 0, theoryWordCount: 0, exampleCount: 0, practiceCount: 0, finalQuestionCount: 0, uniqueQuestionCount: 0, score: 100 };
    const chapters = Array.isArray(blueprint.chapters) ? blueprint.chapters : [];
    const lessons = chapters.flatMap(ch => Array.isArray(ch.lessons) ? ch.lessons : []);
    details.chapterCount = chapters.length; details.lessonCount = lessons.length;
    if (!clean(blueprint.title)) errors.push('Thiếu tên khóa học.');
    if (!clean(blueprint.educationLevel)) errors.push('Thiếu educationLevel; không xác định được track học.');
    if (!clean(blueprint.subjectId)) errors.push('Thiếu subjectId; không thể ràng buộc đúng môn.');
    if (!Array.isArray(blueprint.objectives) || blueprint.objectives.length < 2) errors.push('Khóa học cần ít nhất 2 mục tiêu đầu ra cụ thể.');
    if (chapters.length < 2) errors.push('Cần ít nhất 2 chương hoặc mô-đun có tiến trình học rõ ràng.');
    if (lessons.length < 6) errors.push('Khóa học cần ít nhất 6 bài học để hình thành một lộ trình có ý nghĩa; số bài vẫn do AI lựa chọn theo phạm vi, không dùng dàn ý cố định.');
    const lessonNames = new Set(); const questionTexts = []; const finalTexts = [];
    for (let ci = 0; ci < chapters.length; ci += 1) {
        const chapter = chapters[ci];
        if (!clean(chapter.title) || wordCount(chapter.overview || chapter.description) < 8) errors.push(`Chương ${ci + 1}: thiếu tên hoặc mô tả mục tiêu có ý nghĩa.`);
        if (!Array.isArray(chapter.lessons) || !chapter.lessons.length) errors.push(`Chương ${ci + 1}: chưa có bài học.`);
        for (let li = 0; li < (chapter.lessons || []).length; li += 1) {
            const lesson = chapter.lessons[li]; const label = `Chương ${ci + 1}, bài ${li + 1} (${lesson.title || 'không tên'})`;
            const nameKey = words(lesson.title).join(' ');
            if (!nameKey) errors.push(`${label}: thiếu tiêu đề.`);
            else if (lessonNames.has(nameKey)) errors.push(`${label}: tiêu đề trùng với bài khác; cần phân biệt mục tiêu và nội dung.`);
            lessonNames.add(nameKey);
            if (!Array.isArray(lesson.objectives) || lesson.objectives.length < 2) errors.push(`${label}: cần ít nhất 2 mục tiêu đo lường được.`);
            const sections = Array.isArray(lesson.theorySections) ? lesson.theorySections : [];
            const contentWords = sections.reduce((sum, s) => sum + wordCount(s.content), 0); details.theoryWordCount += contentWords;
            if (sections.length < 3) errors.push(`${label}: lý thuyết cần ít nhất 3 phần được giải thích.`);
            if (contentWords < 180) errors.push(`${label}: lý thuyết quá nông (${contentWords} từ; cần ít nhất 180 từ nội dung giải thích).`);
            if (sections.some(s => wordCount(s.content) < 20)) errors.push(`${label}: có phần lý thuyết quá ngắn hoặc chỉ là tiêu đề.`);
            const lecture = lesson.lectureScript || lesson.lecture || {};
            const lectureText = [lecture.script, lecture.opening, lecture.summary, ...(lecture.keyPoints || []), ...(lecture.teachingSteps || []).map(s => s.script || s.heading)].filter(Boolean).join(' ');
            if (wordCount(lectureText) < 80) errors.push(`${label}: bài giảng cần hướng dẫn diễn giải ít nhất 80 từ, không chỉ có tiêu đề.`);
            const examples = Array.isArray(lesson.examples) ? lesson.examples : []; details.exampleCount += examples.length;
            if (!examples.length || examples.some(e => wordCount(e.problem || e.content) < 8 || wordCount(e.solution || e.content) < 15)) errors.push(`${label}: thiếu ví dụ có đề bài và lời giải giải thích.`);
            const practices = [...(lesson.practice || []), ...(lesson.activities || [])]; details.practiceCount += practices.length;
            if (practices.length < 3) errors.push(`${label}: cần ít nhất 3 hoạt động/bài luyện có hướng dẫn cụ thể.`);
            if (!Array.isArray(lesson.commonMistakes) || lesson.commonMistakes.length < 2) warnings.push(`${label}: nên nêu ít nhất 2 lỗi thường gặp.`);
            const questions = Array.isArray(lesson.questions) ? lesson.questions : [];
            if (questions.length < 5) errors.push(`${label}: cần ít nhất 5 câu kiểm tra riêng cho bài học.`);
            const localSkills = new Set((lesson.skills || []).flatMap(words));
            for (const q of questions) {
                details.questionCount += 1;
                if (wordCount(q.prompt) < 7) errors.push(`${label}: câu hỏi quá ngắn hoặc không nêu nhiệm vụ rõ.`);
                if (wordCount(q.explanation) < 8) errors.push(`${label}: câu hỏi thiếu lời giải thích đáp án.`);
                if (!clean(q.answer) && !['essay','speaking','writing','practical','coding','short_answer','open_response'].includes(String(q.type).toLowerCase())) errors.push(`${label}: câu hỏi trắc nghiệm thiếu đáp án.`);
                if (['single_choice','multiple_choice','true_false'].includes(String(q.type).toLowerCase()) && (!Array.isArray(q.options) || q.options.length < 2)) errors.push(`${label}: câu trắc nghiệm thiếu phương án.`);
                if (String(q.type).toLowerCase() === 'coding' && (!q.media?.coding?.starterCode || !q.media?.coding?.statement || !Array.isArray(q.media?.coding?.visibleTestCases) || q.media.coding.visibleTestCases.length < 2)) errors.push(`${label}: câu coding cần đề bài, starter code, định dạng I/O và ít nhất 2 test case công khai.`);
                if (['essay','speaking','writing','practical','open_response'].includes(String(q.type).toLowerCase()) && (!Array.isArray(q.rubric?.criteria) || q.rubric.criteria.length < 2)) errors.push(`${label}: câu tự luận/thực hành cần rubric có ít nhất 2 tiêu chí.`);
                if (!clean(q.skill) || (localSkills.size && ![...localSkills].some(skill => words(q.skill).some(token => skill.includes(token))))) warnings.push(`${label}: câu hỏi có thể lệch kỹ năng đã nêu (${q.skill || 'chưa gắn kỹ năng'}).`);
                questionTexts.push({ text: q.prompt, scope: `${ci}:${li}` });
            }
        }
        const chapterQuestions = chapter.assessment?.questions || [];
        if (chapterQuestions.length < 5) errors.push(`Chương ${ci + 1}: bài kiểm tra chương cần ít nhất 5 câu bao quát nội dung chương.`);
        chapterQuestions.forEach(q => {
            if (wordCount(q.prompt) < 7 || wordCount(q.explanation) < 8) errors.push(`Chương ${ci + 1}: câu hỏi kiểm tra chương thiếu nhiệm vụ rõ hoặc giải thích đáp án.`);
            if (['single_choice','multiple_choice','true_false'].includes(String(q.type).toLowerCase()) && (!Array.isArray(q.options) || q.options.length < 2)) errors.push(`Chương ${ci + 1}: câu trắc nghiệm thiếu phương án.`);
            questionTexts.push({ text: q.prompt, scope: `chapter:${ci}` });
        });
    }
    const finalQuestions = blueprint.finalAssessment?.questions || []; details.finalQuestionCount = finalQuestions.length;
    if (requireIndependentFinal && finalQuestions.length < 10) errors.push('Bài kiểm tra cuối khóa cần ít nhất 10 câu tổng hợp riêng.');
    finalQuestions.forEach(q => { finalTexts.push(q.prompt); questionTexts.push({ text: q.prompt, scope: 'final' }); if (wordCount(q.explanation) < 8) errors.push('Câu hỏi cuối khóa thiếu lời giải thích.'); });
    const normalizedQuestions = uniqueBy(questionTexts, item => words(item.text).join(' ')); details.uniqueQuestionCount = normalizedQuestions.length;
    if (normalizedQuestions.length !== questionTexts.length) errors.push(`Phát hiện ${questionTexts.length - normalizedQuestions.length} câu hỏi trùng nguyên văn; cần loại bỏ và tạo câu hỏi khác phù hợp nội dung.`);
    for (let i = 0; i < questionTexts.length; i += 1) for (let j = i + 1; j < questionTexts.length; j += 1) {
        if (questionTexts[i].scope !== questionTexts[j].scope && similarity(questionTexts[i].text, questionTexts[j].text) >= 0.92) { errors.push(`Hai câu hỏi gần trùng nội dung giữa ${questionTexts[i].scope} và ${questionTexts[j].scope}; cần kiểm tra và viết lại.`); i = questionTexts.length; break; }
    }
    const level = String(blueprint.educationLevel || '').toUpperCase(); const grade = Number(blueprint.grade);
    if (/PRIMARY|LOWER_SECONDARY|UPPER_SECONDARY|K12/.test(level) && (!Number.isInteger(grade) || grade < 1 || grade > 12)) errors.push('Khóa K12 phải có grade nguyên từ 1 đến 12.');
    if (grade && (!Number.isInteger(grade) || grade < 1 || grade > 12)) errors.push('grade phải nằm trong khoảng lớp 1–12.');
    details.score = Math.max(0, Math.min(100, 100 - errors.length * 5 - warnings.length));
    return { valid: errors.length === 0, status: errors.length ? 'REJECTED_NEEDS_REPAIR' : 'VALIDATED_FOR_REVIEW', errors: [...new Set(errors)], warnings: [...new Set(warnings)], qualityScore: details.score, ...details, requiresAdminReview: true, official: false, version: '38.0.0' };
}


function auditStoredCourseV38({ course = {}, lessons = [], questions = [], assessments = [] } = {}) {
    const issues = [];
    const courseId = String(course._id || course.id || '');
    const courseQuestions = questions.filter(q => String(q.courseId || '') === courseId);
    const courseAssessments = assessments.filter(a => String(a.courseId || '') === courseId);
    const lessonIds = new Set(lessons.map(lesson => String(lesson._id || lesson.id || '')));
    const assessmentById = new Map(courseAssessments.map(item => [String(item._id || item.id), item]));
    const questionById = new Map(courseQuestions.map(item => [String(item._id || item.id), item]));
    const promptSet = new Set();
    for (const lesson of lessons) {
        const label = `Bài “${lesson.title || lesson.code || lesson._id}”`;
        const sections = Array.isArray(lesson.theorySections) ? lesson.theorySections : [];
        const theory = sections.length ? sections.map(section => section.content || '').join(' ') : String(lesson.theory || '');
        if (wordCount(theory) < 180) issues.push({ code: 'SHALLOW_THEORY', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: lý thuyết dưới 180 từ hoặc thiếu nội dung giải thích.` });
        const lecture = lesson.payload?.lectureScript || lesson.lectureScript || lesson.payload?.lecture?.script || '';
        if (wordCount(lecture) < 80) issues.push({ code: 'MISSING_LECTURE', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: thiếu bài giảng hướng dẫn có chiều sâu.` });
        if (!Array.isArray(lesson.objectives) || lesson.objectives.length < 2) issues.push({ code: 'MISSING_OBJECTIVES', severity: 'MEDIUM', lessonId: String(lesson._id), message: `${label}: thiếu mục tiêu học tập cụ thể.` });
        if (!Array.isArray(lesson.examples) || !lesson.examples.length) issues.push({ code: 'MISSING_EXAMPLES', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: thiếu ví dụ có hướng dẫn.` });
        const practice = [...(Array.isArray(lesson.activities) ? lesson.activities : []), ...(Array.isArray(lesson.payload?.practice) ? lesson.payload.practice : [])];
        if (practice.length < 3) issues.push({ code: 'INSUFFICIENT_PRACTICE', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: có ít hơn 3 hoạt động/luyện tập.` });
        const linkedAssessment = lesson.lessonTestId ? assessmentById.get(String(lesson.lessonTestId)) : null;
        if (!linkedAssessment) issues.push({ code: 'MISSING_LESSON_TEST', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: không có lessonTestId trỏ tới bài kiểm tra thuộc khóa.` });
        else {
            if (String(linkedAssessment.lessonId || '') !== String(lesson._id)) issues.push({ code: 'TEST_LESSON_MISMATCH', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: bài kiểm tra liên kết sai lessonId.` });
            if (String(linkedAssessment.courseId || '') !== courseId) issues.push({ code: 'TEST_COURSE_MISMATCH', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: bài kiểm tra liên kết sai courseId.` });
            if ((linkedAssessment.questionIds || []).length < 5) issues.push({ code: 'TEST_TOO_SHORT', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: bài kiểm tra có ít hơn 5 câu.` });
            for (const id of linkedAssessment.questionIds || []) {
                const question = questionById.get(String(id));
                if (!question) { issues.push({ code: 'QUESTION_NOT_IN_COURSE', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: bài kiểm tra tham chiếu câu hỏi không thuộc khóa.` }); continue; }
                if (String(question.lessonId || '') !== String(lesson._id)) issues.push({ code: 'QUESTION_LESSON_MISMATCH', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: câu hỏi gắn sai bài học.` });
                if (String(question.subjectId || '') !== String(course.subjectId || '')) issues.push({ code: 'QUESTION_SUBJECT_MISMATCH', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: câu hỏi sai môn học.` });
            }
        }
        for (const question of courseQuestions.filter(q => String(q.lessonId || '') === String(lesson._id))) {
            const key = words(question.prompt).join(' ');
            if (!key || promptSet.has(key)) issues.push({ code: 'DUPLICATE_OR_EMPTY_QUESTION', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: phát hiện câu hỏi rỗng hoặc trùng.` });
            promptSet.add(key);
        }
        if (String(lesson.courseId || '') !== courseId) issues.push({ code: 'LESSON_COURSE_MISMATCH', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: bài học không thuộc đúng khóa.` });
        if (String(lesson.subjectId || '') !== String(course.subjectId || '')) issues.push({ code: 'LESSON_SUBJECT_MISMATCH', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: bài học sai môn.` });
        if (course.grade && Number(lesson.grade) !== Number(course.grade)) issues.push({ code: 'LESSON_GRADE_MISMATCH', severity: 'HIGH', lessonId: String(lesson._id), message: `${label}: bài học sai khối lớp.` });
    }
    for (const assessment of courseAssessments) {
        if (!['LESSON_TEST','CHAPTER_TEST','FINAL','MIDTERM'].includes(String(assessment.assessmentType || '').toUpperCase())) continue;
        for (const id of assessment.questionIds || []) {
            const question = questionById.get(String(id));
            if (!question) issues.push({ code: 'ASSESSMENT_QUESTION_SCOPE', severity: 'HIGH', assessmentId: String(assessment._id), message: `Bài kiểm tra “${assessment.title}” tham chiếu câu hỏi ngoài khóa.` });
            else if (String(question.subjectId || '') !== String(course.subjectId || '')) issues.push({ code: 'ASSESSMENT_SUBJECT_SCOPE', severity: 'HIGH', assessmentId: String(assessment._id), message: `Bài kiểm tra “${assessment.title}” có câu hỏi sai môn.` });
        }
    }
    if (!courseAssessments.some(a => String(a.assessmentType || '').toUpperCase() === 'FINAL')) issues.push({ code: 'MISSING_FINAL_ASSESSMENT', severity: 'HIGH', message: 'Khóa học chưa có bài kiểm tra cuối khóa.' });
    const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + (issue.severity === 'HIGH' ? 8 : issue.severity === 'MEDIUM' ? 4 : 1), 0));
    return { courseId, courseCode: course.code || '', courseTitle: course.name || course.title || '', score, status: issues.some(issue => issue.severity === 'HIGH') ? 'NEEDS_REPAIR' : issues.length ? 'REVIEW' : 'HEALTHY', lessonCount: lessons.length, questionCount: courseQuestions.length, assessmentCount: courseAssessments.length, issueCount: issues.length, issues };
}

module.exports = { makeCourseGenerationPrompt, courseBlueprintSchemaV38, normalizeGeneratedBlueprint, auditCourseBlueprintV38, auditStoredCourseV38, validateRequestedCourseScope, wordCount, similarity, fingerprint };
