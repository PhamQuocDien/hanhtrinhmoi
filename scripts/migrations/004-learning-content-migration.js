'use strict';

/**
 * Hydrate the platform catalog from the existing, legitimate learning data.
 * This migration is deliberately additive and idempotent:
 * - it never drops or resets a collection;
 * - stable codes make every upsert repeatable;
 * - legacy curriculum/questions remain the source of truth for this adapter;
 * - all generated catalog content is explicitly labelled ORIGINAL_PRACTICE.
 */
const models = require('../../server/models/platform-models.js');
const { getCatalog, getSubject, PROGRAM_VERSION } = require('../../curriculum-data.js');
const { tests } = require('../../question-data.js');
const { ensureCompleteQuestionBank } = require('../../question-bank-complete.js');

const SOURCE = {
    sourceType: 'ORIGINAL_PRACTICE',
    documentName: 'curriculum-data.js + question-data.js',
    version: PROGRAM_VERSION,
    verification: 'unverified',
    notes: 'Nội dung luyện tập nguyên bản của Hành Trình Mới; không phải đề/curriculum official.'
};

const SUBJECT_LABELS = {
    toan: 'Toán',
    'tieng-viet': 'Tiếng Việt',
    tieng_viet: 'Tiếng Việt',
    'tieng-anh': 'Tiếng Anh',
    tieng_anh: 'Tiếng Anh',
    'khoa-hoc': 'Khoa học',
    khoa_hoc: 'Khoa học',
    'lich-su': 'Lịch sử',
    lich_su: 'Lịch sử',
    'dia-ly': 'Địa lý',
    dia_ly: 'Địa lý'
};

const QUESTION_SUBJECT_ALIASES = {
    tieng_viet: 'tieng-viet',
    tieng_anh: 'tieng-anh',
    khoa_hoc: 'khoa-hoc',
    lich_su: 'lich-su',
    dia_ly: 'dia-ly'
};

function curriculumSubjectForQuestion(subject, grade) {
    if (subject === 'tieng-viet') return grade <= 5 ? 'tieng_viet' : 'ngu_van';
    if (subject === 'tieng-anh') return 'tieng_anh';
    if (subject === 'khoa-hoc') return grade <= 5 ? 'khoa_hoc' : 'khtn';
    if (subject === 'lich-su' || subject === 'dia-ly') {
        if (grade <= 5) return 'lich_su_dia_li';
        if (grade <= 9) return 'lich_su_dia_li';
        return subject === 'lich-su' ? 'lich_su' : 'dia_li';
    }
    return Object.entries(QUESTION_SUBJECT_ALIASES).find(([, value]) => value === subject)?.[0] || subject;
}

function educationLevelForGrade(grade) {
    if (grade <= 5) return 'PRIMARY';
    if (grade <= 9) return 'SECONDARY_LOWER';
    return 'SECONDARY_UPPER';
}

function subjectLabel(subjectId) {
    return SUBJECT_LABELS[subjectId] || String(subjectId).replace(/[-_]/g, ' ');
}

function questionType(question) {
    if (!Array.isArray(question?.a) || question.a.length < 2) return 'short_answer';
    return 'single_choice';
}

function questionOptions(question) {
    return Array.isArray(question?.a) ? question.a.map(value => String(value)) : [];
}

function curriculumSubjectIds(grade) {
    return (getCatalog(grade).subjects || []).map(subject => subject.id);
}

async function ensureCurriculumVersion() {
    return models.CurriculumVersion.findOneAndUpdate(
        { code: 'LEGACY-CURRICULUM-ADAPTER', version: '1' },
        {
            $setOnInsert: {
                code: 'LEGACY-CURRICULUM-ADAPTER',
                version: '1',
                status: 'ACTIVE',
                grades: Array.from({ length: 12 }, (_, index) => index + 1),
                sourceRef: SOURCE,
                metadata: { adapter: 'legacy-curriculum-data', sourceOfTruth: 'curriculum-data.js' }
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}

async function hydrateCurriculum(version) {
    const courseByKey = new Map();
    const contentByKey = new Map();
    let courses = 0;
    let contents = 0;

    for (let grade = 1; grade <= 12; grade += 1) {
        for (const subjectId of curriculumSubjectIds(grade)) {
            const subject = getSubject(grade, subjectId, { includeLessons: true });
            if (!subject) continue;
            const courseCode = `K12-G${grade}-${subjectId}`;
            const course = await models.Course.findOneAndUpdate(
                { programId: version._id, code: courseCode },
                {
                    $set: {
                        programId: version._id,
                        curriculumVersionId: version._id
                    },
                    $setOnInsert: {
                        code: courseCode,
                        name: `${subjectLabel(subjectId)} lớp ${grade}`,
                        description: `Khóa học ${subjectLabel(subjectId)} lớp ${grade}, gồm ${subject.lessons.length} bài học luyện tập nguyên bản.`,
                        educationLevel: educationLevelForGrade(grade),
                        grade,
                        subjectId,
                        category: 'GENERAL_EDUCATION',
                        learningOutcomes: subject.competencyProfile || [],
                        syllabus: { grade, subjectId, lessonCount: subject.lessons.length, sourceRef: SOURCE },
                        required: true,
                        optional: false,
                        status: 'ACTIVE'
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).lean();
            courseByKey.set(`${grade}:${subjectId}`, course);
            courses += 1;

            let parentId = null;
            for (const lesson of subject.lessons) {
                const lessonCode = `K12-G${grade}-${subjectId}-${lesson.id}`;
                const legacyAdapterCode = `legacy-g${grade}-${subjectId}-${lesson.id}`;
                const content = await models.CurriculumContent.findOneAndUpdate(
                    {
                        curriculumVersionId: version._id,
                        type: 'LESSON',
                        grade,
                        subjectId,
                        $or: [
                            { code: lessonCode },
                            { code: legacyAdapterCode },
                            { 'payload.legacyLessonId': lesson.id }
                        ]
                    },
                    {
                        $set: {
                            parentId,
                            courseId: course._id
                        },
                        $setOnInsert: {
                            curriculumVersionId: version._id,
                            type: 'LESSON',
                            code: lessonCode,
                            title: lesson.title,
                            grade,
                            educationLevel: educationLevelForGrade(grade),
                            subjectId,
                            objectives: lesson.objectives || [],
                            knowledge: lesson.knowledge || [],
                            skills: lesson.skills || [],
                            outcomes: lesson.learningOutcomes || lesson.objectives || [],
                            status: 'PUBLISHED',
                            sourceRef: SOURCE,
                            payload: {
                                adapter: 'legacy-curriculum-data',
                                courseId: course._id,
                                legacyLessonId: lesson.id,
                                theory: lesson.theory || '',
                                theorySections: lesson.theorySections || [],
                                examples: lesson.keyPoints || [],
                                practiceTasks: lesson.practiceTasks || [],
                                assessment: lesson.assessment || {},
                                estimatedMinutes: lesson.estimatedMinutes || 20,
                                difficulty: lesson.difficulty || 'FOUNDATION'
                            }
                        }
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                ).lean();
                contentByKey.set(`${grade}:${subjectId}:${lesson.id}`, content);
                contents += 1;
            }
        }
    }
    return { courseByKey, contentByKey, courses, contents };
}

async function hydrateQuestions(version, curriculum) {
    const summary = ensureCompleteQuestionBank(tests, { minQuestions: 100 });
    const questionIdsByCourse = new Map();
    let questions = 0;
    const operations = [];

    for (const subject of summary.subjects ? Object.keys(summary.stats) : Object.keys(tests)) {
        for (let grade = 1; grade <= 12; grade += 1) {
            const curriculumSubject = curriculumSubjectForQuestion(subject, grade);
            const course = curriculum.courseByKey.get(`${grade}:${curriculumSubject}`);
            if (!course) continue;
            const lessons = getSubject(grade, curriculumSubject, { includeLessons: true })?.lessons || [];
            for (const difficulty of ['easy', 'medium', 'hard']) {
                const items = tests[subject]?.[`grade${grade}`]?.[difficulty] || [];
                items.forEach((legacy, index) => {
                    const lesson = lessons[index % Math.max(1, lessons.length)];
                    const lessonContent = lesson ? curriculum.contentByKey.get(`${grade}:${curriculumSubject}:${lesson.id}`) : null;
                    const code = `LEGACY-${subject}-G${grade}-${difficulty}-${String(index + 1).padStart(4, '0')}`;
                    operations.push({
                        updateOne: {
                            filter: { code },
                            update: {
                                $set: {
                                    source: SOURCE,
                                    curriculumVersionId: version._id,
                                    grade,
                                    educationLevel: educationLevelForGrade(grade),
                                    courseId: course._id,
                                    lessonId: lessonContent?._id,
                                    subjectId: curriculumSubject,
                                    type: questionType(legacy),
                                    prompt: String(legacy.q || '').trim(),
                                    options: questionOptions(legacy),
                                    answer: legacy.correct,
                                    acceptedAnswers: [legacy.correct],
                                    explanation: String(legacy.explanation || `Đáp án đúng là ${legacy.correct}.`),
                                    points: 1,
                                    difficulty: difficulty.toUpperCase(),
                                    skill: `${curriculumSubject}:G${grade}`,
                                    tags: ['legacy-adapter', curriculumSubject, `grade-${grade}`, difficulty],
                                    status: 'PUBLISHED',
                                    version: 1
                                },
                                $setOnInsert: { code }
                            },
                            upsert: true
                        }
                    });
                    const key = `${course._id}`;
                    if (!questionIdsByCourse.has(key)) questionIdsByCourse.set(key, []);
                    questionIdsByCourse.get(key).push(code);
                });
            }
        }
    }

    for (let index = 0; index < operations.length; index += 500) {
        const result = await models.Question.bulkWrite(operations.slice(index, index + 500), { ordered: false });
        questions += (result.upsertedCount || 0) + (result.modifiedCount || 0);
    }
    return { questionIdsByCourse, questions, totalSourceQuestions: summary.totalQuestions };
}

async function resolveQuestionIds(codes) {
    if (!codes?.length) return [];
    const docs = await models.Question.find({ code: { $in: codes } }, { _id: 1, code: 1 }).lean();
    const byCode = new Map(docs.map(item => [item.code, item._id]));
    return codes.map(code => byCode.get(code)).filter(Boolean);
}

async function hydrateAssessments(curriculum, questionData) {
    let assessments = 0;
    for (const [courseKey, course] of curriculum.courseByKey.entries()) {
        const questionIds = await resolveQuestionIds(questionData.questionIdsByCourse.get(String(course._id))?.slice(0, 30));
        if (!questionIds.length) continue;
        const [grade, subjectId] = courseKey.split(':');
        const code = `K12-G${grade}-${subjectId}-CHECKPOINT`;
        await models.Assessment.findOneAndUpdate(
            { code },
            {
                $set: {
                    title: `Bài kiểm tra ${subjectLabel(subjectId)} lớp ${grade}`,
                    educationLevel: educationLevelForGrade(Number(grade)),
                    grade: Number(grade),
                    courseId: course._id,
                    questionIds,
                    sections: [{ code: 'KNOWLEDGE', title: 'Kiến thức và vận dụng', questionIds }],
                    durationSeconds: 30 * 60,
                    attemptLimit: 3,
                    passingScore: 80,
                    randomization: { enabled: true, mode: 'question' },
                    scoring: { method: 'objective_percentage', maxScore: 100 },
                    reviewSettings: { showExplanationAfterSubmit: true },
                    publicationStatus: 'PUBLISHED',
                    sourceRef: { ...SOURCE, sourceType: 'SIMULATION' }
                },
                $setOnInsert: { code }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        assessments += 1;
    }
    return assessments;
}

async function hydrateDiagnostics(questionData) {
    const diagnosticQuestions = await resolveQuestionIds([]);
    const sample = Object.values(tests.toan?.grade6?.easy || []).slice(0, 8).map((item, index) => ({
        id: `placement-toan-${index + 1}`,
        code: `placement-toan-${index + 1}`,
        type: questionType(item),
        prompt: item.q,
        options: questionOptions(item),
        answer: item.correct,
        explanation: item.explanation || ''
    }));
    const surveyQuestions = [
        { code: 'educationStatus', type: 'single_choice', prompt: 'Hiện bạn đang ở trạng thái học tập nào?', options: ['Đang học tiểu học', 'Đang học THCS', 'Đang học THPT', 'Sinh viên', 'Người đi làm', 'Tự học'], required: true },
        { code: 'currentLevel', type: 'single_choice', prompt: 'Cấp học hoặc trình độ hiện tại của bạn là gì?', options: ['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER', 'HIGHER_EDUCATION', 'ENGLISH_CERTIFICATION'], required: true },
        { code: 'currentGrade', type: 'numerical', prompt: 'Nếu đang học phổ thông, bạn đang ở lớp mấy?', options: [], required: false },
        { code: 'goal', type: 'single_choice', prompt: 'Mục tiêu học tập chính của bạn là gì?', options: ['Cải thiện điểm ở trường', 'Chuẩn bị kỳ thi', 'Tiếng Anh', 'Khám phá ngành nghề'], required: true },
        { code: 'studyTime', type: 'single_choice', prompt: 'Bạn có thể học bao nhiêu phút mỗi ngày?', options: ['15–30', '30–60', '60–90', 'Trên 90'], required: true },
        { code: 'favoriteSubjects', type: 'multiple_choice', prompt: 'Bạn muốn ưu tiên môn/kỹ năng nào?', options: ['Toán', 'Ngôn ngữ', 'Khoa học', 'Tiếng Anh'], required: true },
        { code: 'strengths', type: 'short_answer', prompt: 'Điểm mạnh hoặc kỹ năng bạn tự tin là gì?', options: [], required: false },
        { code: 'weaknesses', type: 'short_answer', prompt: 'Điều bạn thấy khó nhất hiện nay là gì?', options: [], required: false },
        { code: 'learningStyle', type: 'single_choice', prompt: 'Bạn học hiệu quả nhất theo cách nào?', options: ['Ví dụ trực quan', 'Luyện tập từng bước', 'Đọc và ghi chú', 'Thảo luận / giải thích'], required: false },
        { code: 'confidence', type: 'single_choice', prompt: 'Mức tự tin hiện tại của bạn?', options: ['Cần bắt đầu từ nền tảng', 'Đã có nền tảng', 'Sẵn sàng thử thách'], required: false },
        { code: 'englishGoal', type: 'single_choice', prompt: 'Mục tiêu tiếng Anh của bạn là gì?', options: ['Giao tiếp', 'TOEIC', 'IELTS', 'Chưa xác định'], required: false },
        { code: 'toeicGoal', type: 'short_answer', prompt: 'Nếu chọn TOEIC, mục tiêu điểm và thời hạn là gì?', options: [], required: false },
        { code: 'ieltsGoal', type: 'short_answer', prompt: 'Nếu chọn IELTS, mục tiêu band và thời hạn là gì?', options: [], required: false },
        { code: 'targetDate', type: 'short_answer', prompt: 'Bạn muốn đạt mục tiêu vào thời điểm nào?', options: [], required: false }
    ];
    await models.Survey.findOneAndUpdate(
        { title: 'Khảo sát mục tiêu học tập nền tảng' },
        { $set: { description: 'Khảo sát thực tế để đề xuất course, lesson và nhịp học phù hợp.', targetLevel: 'K12_AND_ENGLISH', version: '1', questions: surveyQuestions, status: 'PUBLISHED' }, $setOnInsert: { title: 'Khảo sát mục tiêu học tập nền tảng' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await models.PlacementTest.findOneAndUpdate(
        { code: 'K12-PLACEMENT-FOUNDATION' },
        { $set: { title: 'Placement Toán lớp 6 – nền tảng', target: 'K12', version: '1', skillSections: [{ code: 'MATH', skill: 'toan', title: 'Toán nền tảng', questions: sample }], sourceRef: SOURCE, status: 'PUBLISHED' }, $setOnInsert: { code: 'K12-PLACEMENT-FOUNDATION' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { surveys: 1, placementTests: 1, diagnosticQuestions: diagnosticQuestions.length };
}

async function hydrateEnglishAndExamCatalog() {
    const englishConfigs = [
        {
            code: 'TOEIC-ORIGINAL-4SKILLS', exam: 'TOEIC', variant: 'PRACTICE', version: '1',
            skills: ['LISTENING', 'READING', 'SPEAKING', 'WRITING'],
            parts: [
                { code: 'LISTENING', title: 'Listening practice', taskTypes: ['picture', 'question_response', 'conversation'] },
                { code: 'READING', title: 'Reading practice', taskTypes: ['incomplete_sentence', 'text_completion', 'reading_comprehension'] },
                { code: 'SPEAKING', title: 'Speaking simulation', taskTypes: ['read_aloud', 'describe_picture', 'respond'] },
                { code: 'WRITING', title: 'Writing simulation', taskTypes: ['sentence', 'email', 'opinion'] }
            ],
            durationSeconds: { LISTENING: 45 * 60, READING: 75 * 60, SPEAKING: 20 * 60, WRITING: 60 * 60 },
            scoring: { label: 'Practice diagnostic; không phải điểm TOEIC chính thức.' },
            sourceRef: { ...SOURCE, sourceType: 'ORIGINAL_PRACTICE' }, status: 'ACTIVE'
        },
        ...['ACADEMIC', 'GENERAL_TRAINING'].map(variant => ({
            code: `IELTS-${variant}-ORIGINAL-4SKILLS`, exam: 'IELTS', variant, version: '1',
            skills: ['LISTENING', 'READING', 'SPEAKING', 'WRITING'],
            parts: [
                { code: 'LISTENING', title: 'Listening practice', taskTypes: ['note_completion', 'matching', 'multiple_choice'] },
                { code: 'READING', title: 'Reading practice', taskTypes: ['matching_headings', 'true_false_not_given', 'reading_comprehension'] },
                { code: 'WRITING', title: variant === 'ACADEMIC' ? 'Academic Task 1 / Task 2' : 'General Training Task 1 / Task 2', taskTypes: ['task_1', 'task_2'] },
                { code: 'SPEAKING', title: 'Speaking Parts 1–3', taskTypes: ['part_1', 'part_2', 'part_3'] }
            ],
            durationSeconds: { LISTENING: 40 * 60, READING: 60 * 60, WRITING: 60 * 60, SPEAKING: 15 * 60 },
            scoring: { label: 'Estimated/Diagnostic Band; không phải chứng chỉ IELTS chính thức.' },
            sourceRef: { ...SOURCE, sourceType: 'ORIGINAL_PRACTICE' }, status: 'ACTIVE'
        }))
    ];
    for (const config of englishConfigs) {
        const { code, version, ...editable } = config;
        await models.EnglishTestConfig.findOneAndUpdate({ code, version }, { $set: editable, $setOnInsert: { code, version } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    await models.ExamBlueprint.findOneAndUpdate(
        { code: 'NATIONAL-EXAM-SIMULATION-GENERAL', version: '1' },
        { $set: { name: 'National Exam Simulation – blueprint luyện tập', year: 2026, subject: 'GENERAL', coverage: { grades: [12], mode: 'SIMULATION' }, questionTypes: ['single_choice', 'reading_comprehension', 'numerical'], sections: [{ code: 'CORE', title: 'Core simulation', durationSeconds: 90 * 60 }], durationSeconds: 90 * 60, scoring: { label: 'Simulation score; không phải đề thi official.' }, sourceType: 'SIMULATION', sourceRef: { ...SOURCE, sourceType: 'SIMULATION' }, status: 'PUBLISHED' }, $setOnInsert: { code: 'NATIONAL-EXAM-SIMULATION-GENERAL', version: '1' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return { englishConfigs: englishConfigs.length, examBlueprints: 1 };
}

async function hydrateUniversityCatalog() {
    const sourceRef = {
        sourceType: 'ADMIN_CREATED',
        documentName: 'Hành Trình Mới starter university catalog',
        version: '1',
        verification: 'unverified',
        notes: 'Hierarchy mẫu để admin tiếp tục cấu hình; không đại diện cho trường/chương trình đại học chính thức.'
    };
    const university = await models.University.findOneAndUpdate(
        { code: 'HTM-DEMO-UNIVERSITY' },
        { $set: { name: 'Hành Trình Mới – Catalog mẫu', shortName: 'HTM', type: 'ADMIN_CREATED', description: 'Catalog hierarchy mẫu cho thao tác khám phá ngành học.', status: 'ACTIVE' }, $setOnInsert: { code: 'HTM-DEMO-UNIVERSITY' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const faculty = await models.Faculty.findOneAndUpdate({ universityId: university._id, code: 'EDU-TECH' }, { $set: { name: 'Khoa Giáo dục và Công nghệ', description: 'Khoa mẫu do admin tạo.' }, $setOnInsert: { universityId: university._id, code: 'EDU-TECH' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const field = await models.Field.findOneAndUpdate({ code: 'EDUCATION-TECHNOLOGY' }, { $set: { name: 'Giáo dục và công nghệ', description: 'Lĩnh vực mẫu để cấu hình ngành.' }, $setOnInsert: { code: 'EDUCATION-TECHNOLOGY' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const group = await models.DisciplineGroup.findOneAndUpdate({ fieldId: field._id, code: 'EDTECH-GROUP' }, { $set: { name: 'Công nghệ giáo dục' }, $setOnInsert: { fieldId: field._id, code: 'EDTECH-GROUP' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const major = await models.Major.findOneAndUpdate({ disciplineGroupId: group._id, code: 'EDTECH' }, { $set: { name: 'Công nghệ giáo dục', degreeLevel: 'UNDERGRADUATE', duration: 4, status: 'ACTIVE' }, $setOnInsert: { disciplineGroupId: group._id, code: 'EDTECH' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const specialization = await models.Specialization.findOneAndUpdate({ majorId: major._id, code: 'LEARNING-PLATFORM' }, { $set: { name: 'Nền tảng học tập số', description: 'Chuyên ngành mẫu.' }, $setOnInsert: { majorId: major._id, code: 'LEARNING-PLATFORM' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const program = await models.TrainingProgram.findOneAndUpdate({ institutionId: university._id, programName: 'Công nghệ giáo dục – chương trình mẫu' }, { $set: { facultyId: faculty._id, majorId: major._id, specializationId: specialization._id, version: '1', academicYear: '2026–2027', totalCredits: 120, learningOutcomes: ['Thiết kế trải nghiệm học tập số', 'Phân tích dữ liệu học tập'], status: 'ACTIVE', educationStandard: { sourceRef } }, $setOnInsert: { institutionId: university._id, programName: 'Công nghệ giáo dục – chương trình mẫu' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    await models.Course.findOneAndUpdate({ programId: program._id, code: 'EDTECH-FOUNDATION' }, { $set: { name: 'Nhập môn công nghệ giáo dục', credits: 3, semester: 1, year: 1, required: true, optional: false, category: 'MAJOR_FOUNDATION', description: 'Học phần mẫu để admin tiếp tục biên tập.', learningOutcomes: ['Mô tả hệ sinh thái học tập số'], syllabus: { sourceRef }, status: 'ACTIVE' }, $setOnInsert: { programId: program._id, code: 'EDTECH-FOUNDATION' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return { universities: 1, faculties: 1, fields: 1, disciplineGroups: 1, majors: 1, specializations: 1, trainingPrograms: 1 };
}

async function up({ connection = require('mongoose').connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before running a migration.');
    const version = await ensureCurriculumVersion();
    const curriculum = await hydrateCurriculum(version);
    const questionData = await hydrateQuestions(version, curriculum);
    const assessments = await hydrateAssessments(curriculum, questionData);
    const diagnostics = await hydrateDiagnostics(questionData);
    const englishAndExam = await hydrateEnglishAndExamCatalog();
    const university = await hydrateUniversityCatalog();
    const result = { migration: '004-learning-content-migration', courses: curriculum.courses, lessons: curriculum.contents, questions: questionData.questions, sourceQuestions: questionData.totalSourceQuestions, assessments, ...diagnostics, ...englishAndExam, ...university };
    logger.log(JSON.stringify(result));
    return result;
}

module.exports = { id: '004-learning-content-migration', up };