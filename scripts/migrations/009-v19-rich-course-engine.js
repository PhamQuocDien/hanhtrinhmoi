'use strict';

const mongoose = require('mongoose');
const models = require('../../server/models/platform-models.js');
const { STARTER_COURSES, SOURCE_REF, buildStarterDraft } = require('../../server/services/starter-course-catalog.js');

const VERSION = '19.2.0';
const VERSION_CODE = 'HTM-CATALOG-V19';
const VERSION_MARKER = 'v19.2-full-course-content';

function clean(value, max = 5000) { return String(value ?? '').trim().slice(0, max); }
function questionDoc(definition, lesson, question, questionIndex, lessonIndex) {
    return {
        type: question.type || 'single_choice',
        prompt: clean(question.prompt, 2000),
        options: Array.isArray(question.options) ? question.options.map(label => ({ label: clean(label, 500), value: clean(label, 500) })) : [],
        answer: question.answer,
        explanation: clean(question.explanation, 3000),
        points: Number(question.points || 1),
        difficulty: question.difficulty || (questionIndex < 2 ? 'EASY' : questionIndex < 6 ? 'MEDIUM' : 'HARD'),
        cognitiveLevel: questionIndex < 2 ? 'REMEMBER' : questionIndex < 6 ? 'APPLY' : 'ANALYZE',
        skill: clean(question.skill || definition.skills[questionIndex % Math.max(1, definition.skills.length)] || lesson.title, 240),
        tags: [definition.track, definition.subjectId, definition.targetExam, definition.targetVariant, `LESSON_${lessonIndex + 1}`].filter(Boolean).map(String),
        status: 'PUBLISHED'
    };
}

function assessmentUpdate({ code, title, assessmentType, definition, versionId, courseId, lessonId = null, questionIds, durationSeconds, attemptLimit, passingScore = 70 }) {
    return {
        updateOne: {
            filter: { code },
            update: {
                $set: {
                    title, assessmentType, educationLevel: definition.educationLevel, grade: definition.grade || null,
                    curriculumVersionId: versionId, subjectId: definition.subjectId, courseId, lessonId,
                    sections: [{ code: assessmentType, title, questionIds }], questionIds, questionPool: questionIds,
                    durationSeconds, attemptLimit, passingScore,
                    randomization: { enabled: true, mode: 'question', avoidImmediateRepeat: true },
                    scoring: { method: 'objective_percentage', maxScore: 100 },
                    reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true },
                    version: VERSION, publicationStatus: 'PUBLISHED', sourceRef: { ...SOURCE_REF, version: VERSION, notes: `${SOURCE_REF.notes} Nội dung catalog V19.` }
                },
                $setOnInsert: { code }
            },
            upsert: true
        }
    };
}

async function up({ connection = mongoose.connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before migration 009.');
    const previousVersion = await models.CurriculumVersion.findOne({ code: VERSION_CODE, version: '1' }, { metadata: 1 }).lean();
    const previousRevision = String(previousVersion?.metadata?.seedRevision || '');
    const version = await models.CurriculumVersion.findOneAndUpdate(
        { code: VERSION_CODE, version: '1' },
        { $set: {
            status: 'ACTIVE', educationLevel: 'HIGHER_EDUCATION', grades: [], sourceRef: { ...SOURCE_REF, version: VERSION },
            objectives: ['Catalog đầy đủ cho AI recommendation, AI course generation, lesson learning và assessment engine.'],
            metadata: { engineVersion: VERSION, seedRevision: VERSION_MARKER, tracks: ['UNIVERSITY_IT','UNIVERSITY_APPLIED_SCIENCES','UNIVERSITY_ECONOMICS','UNIVERSITY_MECHATRONICS','UNIVERSITY_ENGINEERING','TOEIC','IELTS','MOS'], lessonCountPerCourse: 12, assessmentStructure: ['LESSON_TEST','CHAPTER_TEST','MIDTERM','FINAL','MOCK'], generatedContent: ['theory','lecture','examples','practice','questions','tests','audioScript','visualPrompt','programmingLab'] }
        }, $setOnInsert: { code: VERSION_CODE, version: '1' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    if (previousRevision === VERSION_MARKER && version?.metadata?.seededAt) {
        const courseIds = await models.Course.find({ curriculumVersionId: version._id, status: 'ACTIVE' }, { _id: 1 }).lean();
        const existing = courseIds.length;
        const ids = courseIds.map(item => item._id);
        const lessonCount = ids.length ? await models.CurriculumContent.countDocuments({ curriculumVersionId: version._id, courseId: { $in: ids }, type: 'LESSON', status: 'PUBLISHED' }) : 0;
        const questionCount = ids.length ? await models.Question.countDocuments({ curriculumVersionId: version._id, courseId: { $in: ids }, status: 'PUBLISHED' }) : 0;
        const assessmentCount = ids.length ? await models.Assessment.countDocuments({ curriculumVersionId: version._id, courseId: { $in: ids }, publicationStatus: 'PUBLISHED' }) : 0;
        const expectedLessons = STARTER_COURSES.length * 12;
        const expectedQuestions = STARTER_COURSES.length * 96;
        const expectedAssessments = STARTER_COURSES.length * 21;
        const sampleLessons = ids.length ? await models.CurriculumContent.find({ curriculumVersionId: version._id, courseId: { $in: ids }, type: 'LESSON', status: 'PUBLISHED' }, { theorySections: 1, 'payload.lectureScript': 1, 'payload.practiceTasks': 1, examples: 1, 'payload.audioScript': 1, 'payload.visualPrompt': 1, lessonTestId: 1 }).limit(24).lean() : [];
        const sampleComplete = sampleLessons.length >= 12 && sampleLessons.every(item => Array.isArray(item.theorySections) && item.theorySections.length >= 4 && String(item.payload?.lectureScript || '').length >= 180 && Array.isArray(item.examples) && item.examples.length >= 3 && Array.isArray(item.payload?.practiceTasks) && item.payload.practiceTasks.length >= 3 && String(item.payload?.audioScript || '').length >= 120 && String(item.payload?.visualPrompt || '').length >= 80 && item.lessonTestId);
        if (existing >= STARTER_COURSES.length && lessonCount >= expectedLessons && questionCount >= expectedQuestions && assessmentCount >= expectedAssessments && sampleComplete) return { migration: '009-v19-rich-course-engine', skipped: true, reason: 'already-seeded-and-complete', catalogCourses: STARTER_COURSES.length, activeCourses: existing, lessons: lessonCount, questions: questionCount, assessments: assessmentCount, sampleComplete };
        logger.warn?.(`⚠️ Catalog V19 thiếu dữ liệu: courses=${existing}/${STARTER_COURSES.length}, lessons=${lessonCount}/${expectedLessons}, questions=${questionCount}/${expectedQuestions}, assessments=${assessmentCount}/${expectedAssessments}, richSample=${sampleComplete}. Sẽ chạy repair.`);
    }

    const majorCodes = new Set(['CNTT','SE','CS','IS','DS','AI','SEC','NET']);
    const majorMap = new Map();
    const existingUniversityRoot = await models.University.findOne({ code: 'HTM-UNIVERSITY-ACADEMIC-V20' }).lean()
        || await models.University.findOne({ code: 'HTM-UNIVERSITY-IT' }).lean()
        || await models.University.findOne({ code: 'HTM-UNIVERSITY-CATALOG' }).lean();
    const university = await models.University.findOneAndUpdate(
        existingUniversityRoot ? { _id: existingUniversityRoot._id } : { code: 'HTM-UNIVERSITY-ACADEMIC-V20' },
        { $set: { code: 'HTM-UNIVERSITY-ACADEMIC-V20', name: 'Hành Trình Mới · Danh mục tham chiếu bậc Đại học', shortName: 'HTM-DAI-HOC', type: 'CATALOG', description: 'Danh mục tham chiếu đa lĩnh vực cho kỹ năng và thực hành; không đại diện chương trình đào tạo chính thức của một trường cụ thể.', status: 'ACTIVE' }, $setOnInsert: { code: 'HTM-UNIVERSITY-ACADEMIC-V20' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const faculty = await models.Faculty.findOneAndUpdate(
        { universityId: university._id, code: 'HTM-FAC-CNTT' },
        { $set: { name: 'Khoa Công nghệ thông tin', description: 'Catalog CNTT của Hành Trình Mới.' }, $setOnInsert: { universityId: university._id, code: 'HTM-FAC-CNTT' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const field = await models.Field.findOneAndUpdate(
        { code: 'HTM-CNTT-FIELD' },
        { $set: { name: 'Công nghệ thông tin và máy tính', description: 'Lĩnh vực CNTT dùng cho cá nhân hóa.' }, $setOnInsert: { code: 'HTM-CNTT-FIELD' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const discipline = await models.DisciplineGroup.findOneAndUpdate(
        { fieldId: field._id, code: 'HTM-CNTT-GROUP' },
        { $set: { name: 'Công nghệ thông tin' }, $setOnInsert: { fieldId: field._id, code: 'HTM-CNTT-GROUP' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    for (const code of ['CNTT','SE','CS','IS','DS','AI','SEC','NET']) {
        const names = { CNTT: 'Công nghệ thông tin', SE: 'Kỹ thuật phần mềm', CS: 'Khoa học máy tính', IS: 'Hệ thống thông tin', DS: 'Khoa học dữ liệu', AI: 'Trí tuệ nhân tạo', SEC: 'An toàn thông tin', NET: 'Mạng máy tính và truyền thông dữ liệu' };
        const major = await models.Major.findOneAndUpdate(
            { disciplineGroupId: discipline._id, code },
            { $set: { name: names[code], degreeLevel: 'UNDERGRADUATE', duration: 4, status: 'ACTIVE' }, $setOnInsert: { disciplineGroupId: discipline._id, code } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        majorMap.set(code, major._id);
    }

    const counts = { courses: 0, lessons: 0, questions: 0, lessonTests: 0, chapterTests: 0, midterms: 0, finals: 0, mocks: 0 };
    for (const definition of STARTER_COURSES) {
        const linkedMajorIds = (definition.majorTracks || []).filter(code => majorCodes.has(String(code).toUpperCase())).map(code => majorMap.get(String(code).toUpperCase())).filter(Boolean);
        const course = await models.Course.findOneAndUpdate(
            { code: definition.code },
            { $set: {
                name: definition.name, educationLevel: definition.educationLevel, grade: definition.grade || null, subjectId: definition.subjectId,
                category: definition.category, description: definition.description, objectives: definition.objectives,
                learningOutcomes: definition.objectives.map(description => ({ description })), estimatedMinutes: definition.estimatedMinutes,
                difficulty: 'ADAPTIVE', facultyId: definition.track === 'UNIVERSITY_IT' ? faculty._id : null,
                majorId: linkedMajorIds.length === 1 ? linkedMajorIds[0] : null, curriculumVersionId: version._id,
                sourceRef: { ...SOURCE_REF, version: VERSION }, kind: 'CANONICAL', ownerUsername: '', status: 'ACTIVE', contentCompleteness: 100,
                syllabus: { track: definition.track, audience: definition.audience, skills: definition.skills, majorTracks: definition.majorTracks, targetExam: definition.targetExam || '', targetVariant: definition.targetVariant || '', aliases: definition.aliases, lessonTitles: definition.lessonTitles, lessonCount: 12, chapterCount: 6, questionCountPerLesson: 8, structure: { lessonTests: 'LESSON_TEST', chapters: 'CHAPTER_TEST', semester: 'MIDTERM', final: 'FINAL', mock: 'MOCK' }, assessmentStructure: { lessonTests: 12, chapterTests: 6, midterm: true, final: true, mock: true }, contentCompleteness: 100, aiGeneration: { starterSeed: definition.code, engineVersion: VERSION, canPersonalize: true, canExpand: true, persistsGeneratedContent: true }, },
                aiGeneration: { engineVersion: VERSION, mode: 'SMART_HYBRID', sourceStarterCode: definition.code, generatedContentPersisted: true }
            }, $setOnInsert: { code: definition.code } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        counts.courses += 1;

        const draft = buildStarterDraft(definition, { educationLevel: definition.educationLevel, grade: definition.grade, subjectId: definition.subjectId });
        const lessons = draft.chapters.flatMap((chapter, chapterIndex) => chapter.lessons.map((lesson, lessonIndex) => ({ lesson, chapterIndex, lessonIndex })));
        const lessonOps = lessons.map(({ lesson, chapterIndex }) => {
            const code = `${definition.code}-V19-L${String(lesson.code.split('-L').pop() || 0).padStart(2,'0')}`;
            return { updateOne: { filter: { curriculumVersionId: version._id, code }, update: { $set: {
                type: 'LESSON', courseId: course._id, title: lesson.title, description: clean(lesson.description, 3000), educationLevel: definition.educationLevel, grade: definition.grade || null, subjectId: definition.subjectId,
                objectives: lesson.objectives, theory: lesson.theorySections, theorySections: lesson.theorySections, examples: lesson.examples, activities: lesson.activities, knowledge: lesson.knowledge, skills: lesson.skills, outcomes: lesson.outcomes,
                media: [{ type: 'AI_IMAGE', prompt: lesson.visualPrompt, status: 'ON_DEMAND', altText: `Minh họa ${lesson.title}` }], estimatedMinutes: lesson.estimatedMinutes, difficulty: lesson.difficulty,
                generationMetadata: { source: 'V19-RICH-CATALOG', engineVersion: VERSION, contentPersisted: true }, status: 'PUBLISHED', sourceRef: { ...SOURCE_REF, version: VERSION },
                payload: { chapterTitle: `Chương ${chapterIndex + 1}: ${definition.lessonTitles[chapterIndex * 2] || 'Nội dung'}`, lecture: lesson.lecture, lectureScript: lesson.lecture?.script || '', audioScript: lesson.audioScript, visualPrompt: lesson.visualPrompt, commonMistakes: lesson.commonMistakes, practiceTasks: lesson.practiceTasks, practice: lesson.activities, programming: lesson.programming, language: lesson.language, codeExample: lesson.codeExample, codingTasks: lesson.codingTasks, testCases: lesson.testCases, contentMode: 'FULL_LESSON' }
            }, $setOnInsert: { curriculumVersionId: version._id, code } }, upsert: true } };
        });
        await models.CurriculumContent.bulkWrite(lessonOps, { ordered: false });
        const storedLessons = await models.CurriculumContent.find({ curriculumVersionId: version._id, courseId: course._id, type: 'LESSON', status: 'PUBLISHED', code: new RegExp(`^${definition.code}-V19-L`) }, { _id: 1, code: 1, title: 1 }).sort({ code: 1 }).lean();
        counts.lessons += storedLessons.length;
        const lessonByCode = new Map(storedLessons.map(item => [item.code, item]));

        const questionOps = [];
        for (const { lesson } of lessons) {
            const match = lesson.code.match(/-L(\d+)$/); const number = Number(match?.[1] || 0);
            const lessonDoc = lessonByCode.get(`${definition.code}-V19-L${String(number).padStart(2,'0')}`); if (!lessonDoc) continue;
            const qs = Array.isArray(lesson.test?.questions) ? lesson.test.questions.slice(0, 8) : [];
            qs.forEach((question, qIndex) => {
                const code = `${definition.code}-V19-L${String(number).padStart(2,'0')}-Q${qIndex + 1}`;
                const data = questionDoc(definition, lesson, question, qIndex, number - 1);
                questionOps.push({ updateOne: { filter: { code }, update: { $set: { ...data, curriculumVersionId: version._id, courseId: course._id, lessonId: lessonDoc._id, educationLevel: definition.educationLevel, grade: definition.grade || null, subjectId: definition.subjectId, source: { ...SOURCE_REF, version: VERSION } }, $setOnInsert: { code } }, upsert: true } });
            });
        }
        if (questionOps.length) await models.Question.bulkWrite(questionOps, { ordered: false });
        const storedQuestions = await models.Question.find({ curriculumVersionId: version._id, courseId: course._id, status: 'PUBLISHED', code: new RegExp(`^${definition.code}-V19-L`) }, { _id: 1, code: 1, lessonId: 1 }).sort({ code: 1 }).lean();
        counts.questions += storedQuestions.length;
        const qByLesson = new Map();
        for (const q of storedQuestions) { const key = String(q.lessonId); if (!qByLesson.has(key)) qByLesson.set(key, []); qByLesson.get(key).push(q._id); }

        const assessmentOps = [];
        for (const lesson of storedLessons) {
            const qIds = (qByLesson.get(String(lesson._id)) || []).slice(0, 8);
            const num = Number(String(lesson.code).match(/-V19-L(\d+)$/)?.[1] || 0);
            assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V19-L${String(num).padStart(2,'0')}-TEST`, title: `Kiểm tra bài ${num}: ${lesson.title}`, assessmentType: 'LESSON_TEST', definition, versionId: version._id, courseId: course._id, lessonId: lesson._id, questionIds: qIds, durationSeconds: 12 * 60, attemptLimit: 5 }));
        }
        const chapterGroups = [];
        for (let i = 0; i < storedLessons.length; i += 2) chapterGroups.push(storedLessons.slice(i, i + 2).flatMap(lesson => qByLesson.get(String(lesson._id)) || []).slice(0, 16));
        for (let ci = 0; ci < chapterGroups.length; ci += 1) {
            assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V19-C${ci + 1}-TEST`, title: `Kiểm tra chương ${ci + 1}: ${definition.name}`, assessmentType: 'CHAPTER_TEST', definition, versionId: version._id, courseId: course._id, questionIds: chapterGroups[ci], durationSeconds: 25 * 60, attemptLimit: 3 }));
        }
        const allQ = storedQuestions.map(q => q._id);
        const midtermIds = allQ.filter((_, i) => i % 2 === 0).slice(0, 30);
        const finalIds = allQ.slice(0, 50);
        assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V19-MIDTERM`, title: `Kiểm tra giữa kỳ · ${definition.name}`, assessmentType: 'MIDTERM', definition, versionId: version._id, courseId: course._id, questionIds: midtermIds, durationSeconds: 45 * 60, attemptLimit: 2 }));
        assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V19-FINAL`, title: `Kiểm tra cuối kỳ · ${definition.name}`, assessmentType: 'FINAL', definition, versionId: version._id, courseId: course._id, questionIds: finalIds, durationSeconds: 60 * 60, attemptLimit: 2 }));
        assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V19-MOCK`, title: `Mock Test · ${definition.name}`, assessmentType: 'MOCK', definition, versionId: version._id, courseId: course._id, questionIds: finalIds.slice(0, Math.min(40, finalIds.length)), durationSeconds: definition.targetExam === 'IELTS' ? 60 * 60 : 45 * 60, attemptLimit: 10 }));
        await models.Assessment.bulkWrite(assessmentOps, { ordered: false });
        const storedAssessments = await models.Assessment.find({ curriculumVersionId: version._id, courseId: course._id, publicationStatus: 'PUBLISHED', code: new RegExp(`^${definition.code}-V19-`) }, { _id: 1, code: 1, assessmentType: 1, lessonId: 1, questionIds: 1 }).lean();
        const lessonTestMap = new Map(storedAssessments.filter(a => a.assessmentType === 'LESSON_TEST').map(a => [String(a.lessonId), a]));
        const chapterTests = storedAssessments.filter(a => a.assessmentType === 'CHAPTER_TEST').sort((a,b) => a.code.localeCompare(b.code));
        const midterm = storedAssessments.find(a => a.assessmentType === 'MIDTERM');
        const finalAssessment = storedAssessments.find(a => a.assessmentType === 'FINAL');
        const mock = storedAssessments.find(a => a.assessmentType === 'MOCK');
        const updateLessons = storedLessons.map(lesson => ({ updateOne: { filter: { _id: lesson._id }, update: { $set: { lessonTestId: lessonTestMap.get(String(lesson._id))?._id || null, assessmentIds: lessonTestMap.get(String(lesson._id))?._id ? [lessonTestMap.get(String(lesson._id))._id] : [] } } } }));
        if (updateLessons.length) await models.CurriculumContent.bulkWrite(updateLessons, { ordered: false });
        await models.Course.updateOne({ _id: course._id }, { $set: {
            'syllabus.lessonCount': storedLessons.length, 'syllabus.chapterCount': chapterTests.length, 'syllabus.questionCount': storedQuestions.length,
            'syllabus.chapters': chapterTests.map((item, i) => ({ order: i + 1, title: `Chương ${i + 1}: ${definition.lessonTitles[i * 2] || 'Nội dung'}`, testId: item._id })),
            'syllabus.chapterAssessments': chapterTests.map((item, i) => ({ chapter: i + 1, assessmentId: item._id, title: item.code })),
            'syllabus.midtermAssessmentId': midterm?._id || null, 'syllabus.finalAssessmentId': finalAssessment?._id || null, 'syllabus.mockAssessmentId': mock?._id || null,
            'syllabus.assessmentStructure': { lessonTests: storedLessons.length, chapterTests: chapterTests.length, midterm: Boolean(midterm), final: Boolean(finalAssessment), mock: Boolean(mock) },
            contentCompleteness: storedLessons.length >= 12 && storedQuestions.length >= 96 && Boolean(midterm) && Boolean(finalAssessment) ? 100 : 90
        } });
        counts.lessonTests += storedAssessments.filter(a => a.assessmentType === 'LESSON_TEST').length;
        counts.chapterTests += chapterTests.length; counts.midterms += midterm ? 1 : 0; counts.finals += finalAssessment ? 1 : 0; counts.mocks += mock ? 1 : 0;
    }

    await models.CurriculumVersion.updateOne({ _id: version._id }, { $set: { 'metadata.seededAt': new Date(), 'metadata.seedRevision': VERSION_MARKER, 'metadata.catalogCourses': STARTER_COURSES.length } });
    const result = { migration: '009-v19-rich-course-engine', catalogCourses: STARTER_COURSES.length, ...counts, university: university.name, faculty: faculty.name };
    logger.log(JSON.stringify(result));
    return result;
}

module.exports = { id: '009-v19-rich-course-engine', up };
