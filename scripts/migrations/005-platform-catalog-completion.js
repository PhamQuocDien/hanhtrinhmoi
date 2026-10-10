'use strict';

const models = require('../../server/models/platform-models.js');
const { getCatalog, getSubject, PROGRAM_VERSION } = require('../../curriculum-data.js');

const CURRICULUM_SOURCE = { sourceType: 'OFFICIAL_REFERENCE', organization: 'Bộ Giáo dục và Đào tạo', documentName: 'Chương trình giáo dục phổ thông và các văn bản sửa đổi/liên quan', documentNumber: '32/2018/TT-BGDĐT; 20/2021/TT-BGDĐT; 17/2025/TT-BGDĐT', version: 'framework-reference', verification: 'title_verified', notes: 'Nguồn tham chiếu khung. Tên bài cụ thể trong ứng dụng là nội dung học tập nguyên bản nếu chưa có mapping textbook/source chi tiết.' };
const CONTENT_SOURCE = { sourceType: 'ORIGINAL_PRACTICE', documentName: 'curriculum-data.js + question-data.js', version: PROGRAM_VERSION, verification: 'unverified', notes: 'Nội dung luyện tập nguyên bản của Hành Trình Mới; không phải nội dung official.' };
const LABELS = { toan: 'Toán', tieng_viet: 'Tiếng Việt', tieng_anh: 'Tiếng Anh', ngu_van: 'Ngữ văn', khtn: 'Khoa học tự nhiên', lich_su: 'Lịch sử', lich_su_dia_li: 'Lịch sử và Địa lí', dia_li: 'Địa lí', gdcd: 'Giáo dục công dân' };
function level(grade) { return grade <= 5 ? 'PRIMARY' : grade <= 9 ? 'SECONDARY_LOWER' : 'SECONDARY_UPPER'; }
function label(subjectId) { return LABELS[subjectId] || String(subjectId).replace(/[-_]/g, ' '); }
function upsertOp(filter, set, setOnInsert = {}) { return { updateOne: { filter, update: { $set: set, $setOnInsert: setOnInsert }, upsert: true } }; }
async function bulk(Model, operations) { for (let i = 0; i < operations.length; i += 500) if (operations.slice(i, i + 500).length) await Model.bulkWrite(operations.slice(i, i + 500), { ordered: false }); }

async function repairCourses(versionId) {
    const operations = [];
    for (let grade = 1; grade <= 12; grade += 1) for (const meta of getCatalog(grade).subjects || []) {
        const subject = getSubject(grade, meta.id, { includeLessons: true });
        if (!subject) continue;
        const code = `K12-G${grade}-${subject.id}`;
        operations.push({ updateOne: { filter: { code }, update: { $setOnInsert: { code, name: `${subject.baseName} lớp ${grade}`, description: `Khóa học ${subject.baseName} lớp ${grade} gồm ${subject.lessonCount} bài học luyện tập.`, educationLevel: level(grade), grade, subjectId: subject.id, curriculumVersionId: versionId, curriculumSourceRef: CURRICULUM_SOURCE, learningOutcomes: subject.competencyProfile || [], syllabus: { grade, subjectId: subject.id, lessonCount: subject.lessonCount }, sourceRef: CONTENT_SOURCE, required: subject.compulsory, optional: !subject.compulsory, category: 'GENERAL_EDUCATION', status: 'ACTIVE' } }, upsert: true } });
    }
    await bulk(models.Course, operations);
    return operations.length;
}

async function repairLessons(versionId) {
    const courses = await models.Course.find({ curriculumVersionId: versionId, educationLevel: { $in: ['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER'] } }, { _id: 1, grade: 1, subjectId: 1 }).lean();
    const courseByKey = new Map(courses.map(item => [`${item.grade}:${item.subjectId}`, item]));
    const operations = [];
    for (let grade = 1; grade <= 12; grade += 1) for (const meta of getCatalog(grade).subjects || []) {
        const subject = getSubject(grade, meta.id, { includeLessons: true });
        const course = courseByKey.get(`${grade}:${meta.id}`);
        if (!subject || !course) continue;
        for (const lesson of subject.lessons) {
            const code = `K12-G${grade}-${subject.id}-${lesson.id}`;
            operations.push({ updateOne: { filter: { code }, update: { $set: { courseId: course._id }, $setOnInsert: { curriculumVersionId: versionId, type: 'LESSON', code, title: lesson.title, description: lesson.topic, grade, educationLevel: level(grade), subjectId: subject.id, objectives: lesson.objectives || [], theory: lesson.theory || '', theorySections: lesson.theorySections || [], examples: lesson.keyPoints || [], activities: lesson.practiceTasks || [], knowledge: lesson.knowledge || [], skills: lesson.skills || [], outcomes: lesson.learningOutcomes || lesson.objectives || [], estimatedMinutes: lesson.estimatedMinutes || 20, difficulty: lesson.difficulty || 'Cơ bản', status: 'PUBLISHED', sourceRef: CONTENT_SOURCE, payload: { adapter: 'legacy-curriculum-data', courseId: course._id, legacyLessonId: lesson.id, theory: lesson.theory || '', theorySections: lesson.theorySections || [], examples: lesson.keyPoints || [], practiceTasks: lesson.practiceTasks || [] } } }, upsert: true } });
        }
    }
    await bulk(models.CurriculumContent, operations);
    return operations.length;
}

async function repairQuestions(versionId) {
    const courses = await models.Course.find({ curriculumVersionId: versionId }, { _id: 1, grade: 1, subjectId: 1 }).lean();
    const lessons = await models.CurriculumContent.find({ curriculumVersionId: versionId, type: 'LESSON' }, { _id: 1, code: 1, grade: 1, subjectId: 1, courseId: 1 }).lean();
    const courseByKey = new Map(courses.map(item => [`${item.grade}:${item.subjectId}`, item]));
    const lessonByKey = new Map(lessons.map(item => [`${item.grade}:${item.subjectId}:${item.code.match(/(lesson-\d+)$/)?.[1] || ''}`, item]));
    const operations = [];
    for (let grade = 1; grade <= 12; grade += 1) for (const meta of getCatalog(grade).subjects || []) {
        const subject = getSubject(grade, meta.id, { includeLessons: true });
        const course = courseByKey.get(`${grade}:${meta.id}`);
        if (!subject || !course) continue;
        for (const lesson of subject.lessons) {
            const dbLesson = lessonByKey.get(`${grade}:${subject.id}:${lesson.id}`);
            if (!dbLesson) continue;
            for (const question of lesson.questions || []) {
                const code = `K12-G${grade}-${subject.id}-${lesson.id}-${question.id}`;
                const options = Array.isArray(question.options) ? question.options.map(value => String(value)) : [];
                const answerIndex = Number(question.answer);
                const expected = Number.isInteger(answerIndex) && options.length ? options[answerIndex] : question.answer;
                operations.push(upsertOp({ code }, { source: CONTENT_SOURCE, curriculumVersionId: versionId, grade, educationLevel: level(grade), courseId: course._id, lessonId: dbLesson._id, subjectId: subject.id, type: options.length >= 2 ? 'single_choice' : 'short_answer', prompt: String(question.prompt || '').trim(), options, answer: expected, acceptedAnswers: expected === undefined ? [] : [expected], explanation: String(question.explanation || ''), points: 1, difficulty: lesson.difficulty || 'Cơ bản', skill: question.skill || subject.id, tags: ['curriculum-adapter', `grade-${grade}`, subject.id], status: 'PUBLISHED', version: 1 }, { code }));
            }
        }
    }
    await bulk(models.Question, operations);
    return operations.length;
}

async function repairPractices(versionId) {
    const lessons = await models.CurriculumContent.find({ curriculumVersionId: versionId, type: 'LESSON', status: 'PUBLISHED' }, { _id: 1, code: 1, title: 1, grade: 1, subjectId: 1, courseId: 1, educationLevel: 1, estimatedMinutes: 1 }).lean();
    const questions = await models.Question.find({ curriculumVersionId: versionId, status: 'PUBLISHED', lessonId: { $ne: null } }, { _id: 1, lessonId: 1 }).lean();
    const byLesson = new Map();
    for (const item of questions) { const key = String(item.lessonId); if (!byLesson.has(key)) byLesson.set(key, []); byLesson.get(key).push(item._id); }
    const operations = lessons.map(lesson => { const questionIds = (byLesson.get(String(lesson._id)) || []).slice(0, 20); return upsertOp({ code: `K12-${lesson.code}-PRACTICE` }, { title: `Luyện tập ${lesson.title}`, description: `Luyện tập theo bài ${lesson.title}.`, educationLevel: lesson.educationLevel, grade: lesson.grade, subjectId: lesson.subjectId, curriculumVersionId: versionId, courseId: lesson.courseId, lessonId: lesson._id, skill: lesson.subjectId, type: 'lesson-practice', questionIds, durationSeconds: Math.max(300, Number(lesson.estimatedMinutes || 20) * 60), attemptLimit: 5, scoring: { method: 'objective_percentage' }, sourceRef: CONTENT_SOURCE, status: questionIds.length ? 'PUBLISHED' : 'DRAFT' }, { code: `K12-${lesson.code}-PRACTICE` }); });
    await bulk(models.Practice, operations);
    const practices = await models.Practice.find({ curriculumVersionId: versionId, status: 'PUBLISHED' }, { _id: 1, lessonId: 1 }).lean();
    await bulk(models.CurriculumContent, practices.map(item => ({ updateOne: { filter: { _id: item.lessonId }, update: { $set: { practiceIds: [item._id] } } } })));
    return practices.length;
}

async function repairAssessments(versionId) {
    const courses = await models.Course.find({ curriculumVersionId: versionId, educationLevel: { $in: ['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER'] } }, { _id: 1, code: 1, grade: 1, subjectId: 1, educationLevel: 1 }).lean();
    const questions = await models.Question.find({ curriculumVersionId: versionId, status: 'PUBLISHED' }, { _id: 1, courseId: 1 }).lean();
    const byCourse = new Map(); for (const item of questions) { const key = String(item.courseId); if (!byCourse.has(key)) byCourse.set(key, []); byCourse.get(key).push(item._id); }
    const operations = courses.flatMap(course => { const questionIds = (byCourse.get(String(course._id)) || []).slice(0, 30); if (!questionIds.length) return []; const code = `${course.code}-CHECKPOINT`; return [upsertOp({ code }, { title: `Bài kiểm tra ${label(course.subjectId)} lớp ${course.grade}`, educationLevel: course.educationLevel, grade: course.grade, curriculumVersionId: versionId, subjectId: course.subjectId, courseId: course._id, questionIds, questionPool: questionIds, sections: [{ code: 'KNOWLEDGE', title: 'Kiến thức và vận dụng', questionIds }], durationSeconds: 1800, attemptLimit: 3, passingScore: 80, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'objective_percentage', maxScore: 100 }, reviewSettings: { showExplanationAfterSubmit: true }, publicationStatus: 'PUBLISHED', sourceRef: { ...CONTENT_SOURCE, sourceType: 'SIMULATION' } }, { code })]; });
    await bulk(models.Assessment, operations);
    return operations.length;
}

async function repairDiagnostics() {
    const questions = (getSubject(6, 'toan', { includeLessons: true })?.lessons?.[0]?.questions || []).slice(0, 12).map(item => ({ id: item.id, code: item.id, type: Array.isArray(item.options) && item.options.length > 1 ? 'single_choice' : 'short_answer', prompt: item.prompt, options: item.options }));
    await models.Survey.findOneAndUpdate({ title: 'Khảo sát mục tiêu học tập nền tảng' }, { $set: { description: 'Khảo sát đầu vào để hệ thống biết mục tiêu, trình độ và nhịp học.', targetLevel: 'K12_AND_ENGLISH', version: '1', questions: [{ code: 'educationStatus', type: 'single_choice', prompt: 'Hiện bạn đang ở trạng thái học tập nào?', options: ['Đang học tiểu học','Đang học THCS','Đang học THPT','Sinh viên','Người đi làm','Tự học'], required: true }, { code: 'currentLevel', type: 'single_choice', prompt: 'Cấp học hoặc trình độ hiện tại của bạn?', options: ['PRIMARY','SECONDARY_LOWER','SECONDARY_UPPER','HIGHER_EDUCATION','ENGLISH_CERTIFICATION'], required: true }, { code: 'currentGrade', type: 'numerical', prompt: 'Nếu đang học phổ thông, bạn đang ở lớp mấy?', required: false }, { code: 'goal', type: 'single_choice', prompt: 'Mục tiêu học tập chính của bạn?', options: ['Cải thiện điểm ở trường','Chuẩn bị kỳ thi','Tiếng Anh','Khám phá ngành nghề'], required: true }, { code: 'studyTime', type: 'single_choice', prompt: 'Bạn có thể học bao nhiêu phút mỗi ngày?', options: ['15–30','30–60','60–90','Trên 90'], required: true }, { code: 'favoriteSubjects', type: 'multiple_choice', prompt: 'Bạn muốn ưu tiên môn/kỹ năng nào?', options: ['Toán','Ngôn ngữ','Khoa học','Tiếng Anh'], required: true }, { code: 'strengths', type: 'short_answer', prompt: 'Điểm mạnh của bạn?', required: false }, { code: 'weaknesses', type: 'short_answer', prompt: 'Điểm bạn thấy khó nhất?', required: false }, { code: 'learningStyle', type: 'single_choice', prompt: 'Bạn học hiệu quả nhất theo cách nào?', options: ['Ví dụ trực quan','Luyện tập từng bước','Đọc và ghi chú','Thảo luận / giải thích'], required: false }, { code: 'confidence', type: 'single_choice', prompt: 'Mức tự tin hiện tại?', options: ['Cần bắt đầu từ nền tảng','Đã có nền tảng','Sẵn sàng thử thách'], required: false }, { code: 'englishGoal', type: 'single_choice', prompt: 'Mục tiêu tiếng Anh?', options: ['Giao tiếp','TOEIC','IELTS','Chưa xác định'], required: false }, { code: 'toeicGoal', type: 'short_answer', prompt: 'Mục tiêu TOEIC và thời hạn?', required: false }, { code: 'ieltsGoal', type: 'short_answer', prompt: 'Mục tiêu IELTS và thời hạn?', required: false }, { code: 'targetDate', type: 'short_answer', prompt: 'Bạn muốn đạt mục tiêu vào thời điểm nào?', required: false }], sourceRef: CONTENT_SOURCE, status: 'PUBLISHED' }, $setOnInsert: { title: 'Khảo sát mục tiêu học tập nền tảng' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await models.PlacementTest.findOneAndUpdate({ code: 'K12-PLACEMENT-FOUNDATION' }, { $set: { title: 'Kiểm tra đầu vào Toán nền tảng', target: 'K12', version: '1', skillSections: [{ code: 'MATH', skill: 'toan', title: 'Toán nền tảng', questions }], sourceRef: CONTENT_SOURCE, status: 'PUBLISHED' }, $setOnInsert: { code: 'K12-PLACEMENT-FOUNDATION' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return { surveys: 1, placementTests: 1 };
}

async function repairEnglish() {
    const configs = [{ code: 'TOEIC-PRACTICE-4SKILLS', exam: 'TOEIC', variant: 'PRACTICE', version: '1', skills: ['LISTENING','READING','SPEAKING','WRITING'], parts: [{ code:'LISTENING', title:'Listening', taskTypes:['picture','question_response','conversation'] },{ code:'READING', title:'Reading', taskTypes:['incomplete_sentence','text_completion','reading_comprehension'] },{ code:'SPEAKING', title:'Speaking', taskTypes:['read_aloud','describe_picture','respond'], mediaRecorder:true },{ code:'WRITING', title:'Writing', taskTypes:['sentence','email','opinion'], wordCount:true }], sourceRef: CONTENT_SOURCE, status:'ACTIVE' }, { code:'IELTS-ACADEMIC-PRACTICE-4SKILLS', exam:'IELTS', variant:'ACADEMIC', version:'1', skills:['LISTENING','READING','WRITING','SPEAKING'], parts:[{code:'LISTENING',title:'Listening',taskTypes:['multiple_choice','matching','completion','short_answer']},{code:'READING',title:'Reading',taskTypes:['multiple_choice','matching_headings','true_false_not_given','completion']},{code:'WRITING',title:'Writing Academic Task 1 / Task 2',taskTypes:['task_1','task_2'],wordCount:true},{code:'SPEAKING',title:'Speaking Parts 1–3',taskTypes:['part_1','part_2','part_3'],mediaRecorder:true}], sourceRef:CONTENT_SOURCE, status:'ACTIVE' }, { code:'IELTS-GENERAL_TRAINING-PRACTICE-4SKILLS', exam:'IELTS', variant:'GENERAL_TRAINING', version:'1', skills:['LISTENING','READING','WRITING','SPEAKING'], parts:[{code:'LISTENING',title:'Listening',taskTypes:['multiple_choice','matching','completion','short_answer']},{code:'READING',title:'Reading',taskTypes:['multiple_choice','matching_headings','true_false_not_given','completion']},{code:'WRITING',title:'Writing General Training Task 1 / Task 2',taskTypes:['task_1','task_2'],wordCount:true},{code:'SPEAKING',title:'Speaking Parts 1–3',taskTypes:['part_1','part_2','part_3'],mediaRecorder:true}], sourceRef:CONTENT_SOURCE, status:'ACTIVE' }];
    for (const config of configs) await models.EnglishTestConfig.findOneAndUpdate({ code: config.code, version: config.version }, { $set: config }, { upsert:true, new:true, setDefaultsOnInsert:true });
    return configs.length;
}

async function up({ connection = require('mongoose').connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before running a migration.');
    let version = await models.CurriculumVersion.findOne({ code: 'LEGACY-CURRICULUM-ADAPTER', version: '1' }).lean();
    if (!version) version = await models.CurriculumVersion.create({ code: 'LEGACY-CURRICULUM-ADAPTER', version: '1', status: 'ACTIVE', educationLevel: 'PRIMARY', grades: Array.from({ length: 12 }, (_, i) => i + 1), sourceRef: CONTENT_SOURCE });
    const courses = await repairCourses(version._id);
    const lessons = await repairLessons(version._id);
    const questions = await repairQuestions(version._id);
    const practices = await repairPractices(version._id);
    const assessments = await repairAssessments(version._id);
    const diagnostics = await repairDiagnostics();
    const englishConfigs = await repairEnglish();
    const result = { migration: '005-platform-catalog-completion', courses, lessons, questions, practices, assessments, ...diagnostics, englishConfigs };
    logger.log(JSON.stringify(result));
    return result;
}
module.exports = { id: '005-platform-catalog-completion', up };
