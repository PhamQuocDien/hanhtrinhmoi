'use strict';

const mongoose = require('mongoose');
const models = require('../../server/models/platform-models.js');
const { STARTER_COURSES, buildStarterDraft } = require('../../server/services/starter-course-catalog.js');
const { UNIVERSITY_V20_GROUPS } = require('../../server/services/catalog-v20-university.js');

const VERSION = '20.0.0';
const VERSION_CODE = 'HTM-CATALOG-V20';
const VERSION_MARKER = 'v20.0-full-learning-content';
const SOURCE_REF = {
    sourceType: 'ORIGINAL_PRACTICE',
    organization: 'Hành Trình Mới',
    documentName: 'Hành Trình Mới Full Learning Content Catalog',
    documentNumber: '',
    url: '',
    version: VERSION,
    verification: 'unverified',
    notes: 'Nội dung nguyên bản phục vụ học tập và mô phỏng; không phải bản sao sách giáo khoa, đề thi hoặc tài liệu official.'
};

function clean(value, max = 12000) { return String(value ?? '').trim().slice(0, max); }
function normalizeOption(option) {
    if (option && typeof option === 'object') {
        const label = option.label ?? option.text ?? option.value ?? option.id ?? '';
        const value = option.value ?? option.id ?? option.label ?? option.text ?? label;
        return { label: clean(label, 700), value };
    }
    return { label: clean(option, 700), value: option };
}
function questionDoc(definition, lesson, question, questionIndex, lessonIndex) {
    return {
        type: question.type || 'single_choice',
        prompt: clean(question.prompt, 3500),
        options: Array.isArray(question.options) ? question.options.map(normalizeOption) : [],
        answer: question.answer,
        acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [],
        rubric: question.rubric || {},
        media: question.media || {},
        explanation: clean(question.explanation, 5000),
        points: Number(question.points || 1),
        difficulty: question.difficulty || (questionIndex < 3 ? 'EASY' : questionIndex < 8 ? 'MEDIUM' : 'HARD'),
        cognitiveLevel: question.cognitiveLevel || (questionIndex < 3 ? 'REMEMBER' : questionIndex < 8 ? 'APPLY' : 'ANALYZE'),
        skill: clean(question.skill || definition.skills[questionIndex % Math.max(1, definition.skills.length)] || lesson.title, 300),
        tags: [...new Set([definition.track, definition.subjectId, definition.targetExam, definition.targetVariant, `LESSON_${lessonIndex + 1}`, question.type].filter(Boolean).map(String))],
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
                    scoring: { method: 'mixed_percentage', maxScore: 100, manualReviewTypes: ['essay','speaking','practical','timed_simulation'] },
                    reviewSettings: { showExplanationAfterSubmit: true, showCorrectAnswerAfterSubmit: true },
                    version: VERSION, publicationStatus: 'PUBLISHED', sourceRef: SOURCE_REF
                },
                $setOnInsert: { code }
            },
            upsert: true
        }
    };
}

async function ensureAcademicCatalog() {
    const rootCodes = ['HTM-UNIVERSITY-ACADEMIC-V20', 'HTM-UNIVERSITY-CATALOG', 'HTM-UNIVERSITY-IT'];
    let existingRoot = null;
    for (const code of rootCodes) {
        existingRoot = await models.University.findOne({ code }).lean();
        if (existingRoot) break;
    }
    const university = await models.University.findOneAndUpdate(
        existingRoot ? { _id: existingRoot._id } : { code: 'HTM-UNIVERSITY-ACADEMIC-V20' },
        { $set: { code: 'HTM-UNIVERSITY-ACADEMIC-V20', name: 'Hành Trình Mới · Danh mục tham chiếu bậc Đại học', shortName: 'HTM-DAI-HOC', type: 'CATALOG', description: 'Danh mục tham chiếu đa lĩnh vực cho kỹ năng và thực hành; không đại diện chương trình đào tạo chính thức của một trường cụ thể.', status: 'ACTIVE' }, $setOnInsert: { code: 'HTM-UNIVERSITY-ACADEMIC-V20' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    // Disable duplicate synthetic roots left by earlier releases without deleting referenced records.
    await models.University.updateMany({ code: { $in: rootCodes.filter(code => code !== 'HTM-UNIVERSITY-ACADEMIC-V20') } }, { $set: { status: 'ARCHIVED', description: 'Danh mục cũ được thay thế bởi HTM-UNIVERSITY-ACADEMIC-V20; giữ lại để bảo toàn tham chiếu lịch sử.' } });
    const facultyMap = new Map();
    const majorMap = new Map();
    const majorDomainMap = new Map();
    let majorCount = 0;
    for (const group of Object.values(UNIVERSITY_V20_GROUPS)) {
        const faculty = await models.Faculty.findOneAndUpdate(
            { universityId: university._id, code: group.facultyCode },
            { $set: { name: group.facultyName, description: `Catalog ${group.facultyName} của Hành Trình Mới.`, status: 'ACTIVE' }, $setOnInsert: { universityId: university._id, code: group.facultyCode } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        facultyMap.set(group.facultyCode, faculty._id);
        const field = await models.Field.findOneAndUpdate(
            { code: group.fieldCode },
            { $set: { name: group.fieldName, description: `Lĩnh vực ${group.fieldName}.`, status: 'ACTIVE' }, $setOnInsert: { code: group.fieldCode } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        const discipline = await models.DisciplineGroup.findOneAndUpdate(
            { fieldId: field._id, code: group.disciplineCode },
            { $set: { name: group.disciplineName }, $setOnInsert: { fieldId: field._id, code: group.disciplineCode } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        for (const [code, name] of group.majors) {
            const major = await models.Major.findOneAndUpdate(
                { disciplineGroupId: discipline._id, code },
                { $set: { name, degreeLevel: 'UNDERGRADUATE', duration: 4, status: 'ACTIVE' }, $setOnInsert: { disciplineGroupId: discipline._id, code } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            ).lean();
            majorMap.set(code, major._id);
            majorDomainMap.set(`${group.disciplineCode}:${code}`, major._id);
            majorCount += 1;
        }
    }
    return { university, facultyMap, majorMap, majorDomainMap, majorCount };
}

function facultyCodeForDefinition(definition) {
    if (definition.facultyCode) return definition.facultyCode;
    if (definition.track === 'UNIVERSITY_IT') return UNIVERSITY_V20_GROUPS.IT.facultyCode;
    if (definition.track === 'UNIVERSITY_ECONOMICS') return UNIVERSITY_V20_GROUPS.ECONOMICS.facultyCode;
    if (definition.track === 'UNIVERSITY_MECHATRONICS') return UNIVERSITY_V20_GROUPS.MECHATRONICS.facultyCode;
    if (definition.track === 'UNIVERSITY_APPLIED_SCIENCES') return UNIVERSITY_V20_GROUPS.APPLIED_SCIENCES.facultyCode;
    return UNIVERSITY_V20_GROUPS.ENGINEERING.facultyCode;
}

async function up({ connection = mongoose.connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before migration 010.');
    const previous = await models.CurriculumVersion.findOne({ code: VERSION_CODE, version: '1' }, { metadata: 1 }).lean();
    const previousRevision = String(previous?.metadata?.seedRevision || '');
    const version = await models.CurriculumVersion.findOneAndUpdate(
        { code: VERSION_CODE, version: '1' },
        { $set: {
            status: 'ACTIVE', educationLevel: 'HIGHER_EDUCATION', grades: [1,2,3,4,5,6,7,8,9,10,11,12], sourceRef: SOURCE_REF,
            objectives: ['Học thật: lý thuyết sâu, bài giảng, ví dụ, thực hành và assessment đa dạng cho K12, chứng chỉ English, Office và đại học.'],
            metadata: { engineVersion: VERSION, seedRevision: VERSION_MARKER, tracks: ['K12','UNIVERSITY_IT','UNIVERSITY_ECONOMICS','UNIVERSITY_MECHATRONICS','UNIVERSITY_ENGINEERING','UNIVERSITY_APPLIED_SCIENCES','TOEIC','IELTS','MOS'], lessonCountPerCourse: 12, questionCountPerLesson: 12, assessmentStructure: ['LESSON_TEST','CHAPTER_TEST','MIDTERM','FINAL','MOCK'], generatedContent: ['longTheory','lecture','examples','practice','practical','mixedAssessment','coding','caseStudy','lab'] }
        }, $setOnInsert: { code: VERSION_CODE, version: '1' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const academic = await ensureAcademicCatalog();
    const counts = { courses: 0, lessons: 0, questions: 0, lessonTests: 0, chapterTests: 0, midterms: 0, finals: 0, mocks: 0, universities: 1, faculties: 0, majors: academic.majorCount };
    counts.faculties = academic.facultyMap.size;

    if (previousRevision === VERSION_MARKER) {
        const activeCourseCount = await models.Course.countDocuments({ curriculumVersionId: version._id, status: 'ACTIVE' });
        const lessonCount = await models.CurriculumContent.countDocuments({ curriculumVersionId: version._id, type: 'LESSON', status: 'PUBLISHED' });
        const questionCount = await models.Question.countDocuments({ curriculumVersionId: version._id, status: 'PUBLISHED' });
        const expectedLessons = STARTER_COURSES.length * 12;
        const expectedQuestions = expectedLessons * 12;
        if (activeCourseCount >= STARTER_COURSES.length && lessonCount >= expectedLessons && questionCount >= expectedQuestions) {
            await models.CurriculumVersion.updateOne({ _id: version._id }, { $set: { 'metadata.seededAt': new Date() } });
            return { migration: '010-v20-full-learning-content', skipped: true, catalogCourses: STARTER_COURSES.length, activeCourses: activeCourseCount, lessons: lessonCount, questions: questionCount, universities: counts.universities, faculties: counts.faculties, majors: counts.majors };
        }
        logger.warn?.(`⚠️ Catalog V20 thiếu dữ liệu, sẽ repair: courses=${activeCourseCount}/${STARTER_COURSES.length}, lessons=${lessonCount}/${expectedLessons}, questions=${questionCount}/${expectedQuestions}.`);
    }

    for (const definition of STARTER_COURSES) {
        const domainGroupCode = String(definition.disciplineGroupCode || '');
        const linkedMajorIds = (definition.majorTracks || []).map(code => academic.majorDomainMap.get(`${domainGroupCode}:${String(code).toUpperCase()}`) || academic.majorMap.get(String(code).toUpperCase())).filter(Boolean);
        const facultyId = academic.facultyMap.get(facultyCodeForDefinition(definition)) || null;
        const majorId = linkedMajorIds.length === 1 ? linkedMajorIds[0] : null;
        const course = await models.Course.findOneAndUpdate(
            { code: definition.code },
            { $set: {
                name: definition.name, educationLevel: definition.educationLevel, grade: definition.grade || null, subjectId: definition.subjectId,
                category: definition.category, description: definition.description, objectives: definition.objectives,
                learningOutcomes: definition.objectives.map(description => ({ description })), estimatedMinutes: definition.estimatedMinutes,
                facultyId, majorId, curriculumVersionId: version._id, sourceRef: SOURCE_REF,
                syllabus: { ...(definition.syllabus || {}), starter: true, track: definition.track, audience: definition.audience, skills: definition.skills, majorTracks: definition.majorTracks, targetExam: definition.targetExam, targetVariant: definition.targetVariant, aliases: definition.aliases, lessonTitles: definition.lessonTitles, lessonCount: 12, assessmentStructure: { lessonTests: 12, chapterTests: 6, midterm: true, final: true, mock: true }, practicalMode: ['UNIVERSITY_IT','UNIVERSITY_ENGINEERING','UNIVERSITY_MECHATRONICS','UNIVERSITY_ECONOMICS','UNIVERSITY_APPLIED_SCIENCES','MOS','TOEIC','IELTS'].includes(definition.track) ? 'ENABLED' : 'OPTIONAL', aiExpansionHints: { canExpandLessons: true, canGenerateQuestions: true, canGenerateTests: true, canPersonalize: true } },
                kind: 'CANONICAL', ownerUsername: '', status: 'ACTIVE', contentCompleteness: 100,
                aiGeneration: { engineVersion: VERSION, materialized: true, source: SOURCE_REF.sourceType }
            }, $setOnInsert: { code: definition.code } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        counts.courses += 1;
        const draft = buildStarterDraft(definition, { educationLevel: definition.educationLevel, grade: definition.grade, subjectId: definition.subjectId });
        const lessonEntries = draft.chapters.flatMap((chapter, chapterIndex) => chapter.lessons.map(lesson => ({ lesson, chapterIndex })));
        const lessonOps = lessonEntries.map(({ lesson, chapterIndex }) => {
            const number = Number(String(lesson.code).match(/-L(\d+)$/)?.[1] || 0);
            const code = `${definition.code}-V20-L${String(number).padStart(2, '0')}`;
            return { updateOne: { filter: { curriculumVersionId: version._id, code }, update: { $set: {
                type: 'LESSON', courseId: course._id, title: lesson.title, description: clean(lesson.description, 5000), educationLevel: definition.educationLevel, grade: definition.grade || null, subjectId: definition.subjectId,
                objectives: lesson.objectives || [], theory: lesson.theory || lesson.theorySections || [], theorySections: lesson.theorySections || [], examples: lesson.examples || [], activities: lesson.activities || [], knowledge: lesson.knowledge || [], skills: lesson.skills || definition.skills.slice(0,4), outcomes: lesson.outcomes || [],
                media: [{ type: 'AI_IMAGE', prompt: lesson.visualPrompt || '', status: 'ON_DEMAND', altText: `Minh họa ${lesson.title}` }], estimatedMinutes: Number(lesson.estimatedMinutes || 45), difficulty: lesson.difficulty || 'MEDIUM',
                generationMetadata: { source: SOURCE_REF.sourceType, engineVersion: VERSION, contentPersisted: true, contentWordCount: Number(lesson.contentWordCount || 0), lessonModel: 'RICH_RULE_BASED_SEED' }, status: 'PUBLISHED', sourceRef: SOURCE_REF,
                payload: { chapterTitle: `Chương ${chapterIndex + 1}: ${definition.lessonTitles[chapterIndex * 2] || 'Nội dung'}`, lecture: lesson.lecture, lectureScript: lesson.lecture?.script || '', audioScript: lesson.audioScript, visualPrompt: lesson.visualPrompt, commonMistakes: lesson.commonMistakes, quickChecks: lesson.quickChecks, studySteps: lesson.studySteps, summary: lesson.summary, glossary: lesson.glossary, practiceTasks: lesson.practiceTasks, practice: lesson.activities, practical: lesson.practical, examTask: lesson.examTask, programming: lesson.programming, language: lesson.language, codeExample: lesson.codeExample, codingTasks: lesson.codingTasks, testCases: lesson.testCases, contentWordCount: lesson.contentWordCount || 0, contentMode: 'FULL_LESSON_V20' }
            }, $setOnInsert: { curriculumVersionId: version._id, code } }, upsert: true } };
        });
        await models.CurriculumContent.bulkWrite(lessonOps, { ordered: false });
        const storedLessons = await models.CurriculumContent.find({ curriculumVersionId: version._id, courseId: course._id, type: 'LESSON', status: 'PUBLISHED', code: new RegExp(`^${definition.code}-V20-L`) }, { _id: 1, code: 1, title: 1 }).sort({ code: 1 }).lean();
        counts.lessons += storedLessons.length;
        const lessonByNumber = new Map(storedLessons.map(item => [Number(String(item.code).match(/-V20-L(\d+)$/)?.[1] || 0), item]));
        const questionOps = [];
        for (const { lesson } of lessonEntries) {
            const number = Number(String(lesson.code).match(/-L(\d+)$/)?.[1] || 0);
            const lessonDoc = lessonByNumber.get(number);
            if (!lessonDoc) continue;
            const questions = Array.isArray(lesson.test?.questions) ? lesson.test.questions.slice(0, 12) : [];
            questions.forEach((question, qIndex) => {
                const code = `${definition.code}-V20-L${String(number).padStart(2, '0')}-Q${qIndex + 1}`;
                const data = questionDoc(definition, lesson, question, qIndex, number - 1);
                questionOps.push({ updateOne: { filter: { code }, update: { $set: { ...data, curriculumVersionId: version._id, courseId: course._id, lessonId: lessonDoc._id, educationLevel: definition.educationLevel, grade: definition.grade || null, subjectId: definition.subjectId, source: SOURCE_REF }, $setOnInsert: { code } }, upsert: true } });
            });
        }
        if (questionOps.length) await models.Question.bulkWrite(questionOps, { ordered: false });
        const storedQuestions = await models.Question.find({ curriculumVersionId: version._id, courseId: course._id, status: 'PUBLISHED', code: new RegExp(`^${definition.code}-V20-L`) }, { _id: 1, code: 1, lessonId: 1 }).sort({ code: 1 }).lean();
        counts.questions += storedQuestions.length;
        const qByLesson = new Map();
        for (const q of storedQuestions) { const key = String(q.lessonId); if (!qByLesson.has(key)) qByLesson.set(key, []); qByLesson.get(key).push(q._id); }
        const assessmentOps = [];
        for (const lesson of storedLessons) {
            const qIds = (qByLesson.get(String(lesson._id)) || []).slice(0, 12);
            const number = Number(String(lesson.code).match(/-V20-L(\d+)$/)?.[1] || 0);
            assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V20-L${String(number).padStart(2,'0')}-TEST`, title: `Kiểm tra bài ${number}: ${lesson.title}`, assessmentType: 'LESSON_TEST', definition, versionId: version._id, courseId: course._id, lessonId: lesson._id, questionIds: qIds, durationSeconds: 20 * 60, attemptLimit: 5 }));
        }
        const chapterGroups = [];
        for (let i = 0; i < storedLessons.length; i += 2) chapterGroups.push(storedLessons.slice(i, i + 2).flatMap(lesson => qByLesson.get(String(lesson._id)) || []).slice(0, 24));
        for (let ci = 0; ci < chapterGroups.length; ci += 1) assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V20-C${ci + 1}-TEST`, title: `Kiểm tra chương ${ci + 1}: ${definition.name}`, assessmentType: 'CHAPTER_TEST', definition, versionId: version._id, courseId: course._id, questionIds: chapterGroups[ci], durationSeconds: 35 * 60, attemptLimit: 3 }));
        const allQ = storedQuestions.map(q => q._id);
        const midtermIds = allQ.filter((_, i) => i % 2 === 0).slice(0, 60);
        const finalIds = allQ.slice(0, 100);
        const mockIds = allQ.filter((_, i) => i % 3 === 0).slice(0, 80);
        assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V20-MIDTERM`, title: `Kiểm tra giữa kỳ · ${definition.name}`, assessmentType: 'MIDTERM', definition, versionId: version._id, courseId: course._id, questionIds: midtermIds, durationSeconds: 60 * 60, attemptLimit: 2 }));
        assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V20-FINAL`, title: `Kiểm tra cuối kỳ · ${definition.name}`, assessmentType: 'FINAL', definition, versionId: version._id, courseId: course._id, questionIds: finalIds, durationSeconds: 90 * 60, attemptLimit: 2 }));
        assessmentOps.push(assessmentUpdate({ code: `${definition.code}-V20-MOCK`, title: `Mock Test · ${definition.name}`, assessmentType: 'MOCK', definition, versionId: version._id, courseId: course._id, questionIds: mockIds, durationSeconds: definition.targetExam === 'IELTS' ? 150 * 60 : definition.targetExam === 'TOEIC' ? 120 * 60 : 90 * 60, attemptLimit: 10 }));
        await models.Assessment.bulkWrite(assessmentOps, { ordered: false });
        const storedAssessments = await models.Assessment.find({ curriculumVersionId: version._id, courseId: course._id, publicationStatus: 'PUBLISHED', code: new RegExp(`^${definition.code}-V20-`) }, { _id: 1, code: 1, assessmentType: 1, lessonId: 1, questionIds: 1 }).lean();
        const lessonTestMap = new Map(storedAssessments.filter(a => a.assessmentType === 'LESSON_TEST').map(a => [String(a.lessonId), a]));
        const chapterTests = storedAssessments.filter(a => a.assessmentType === 'CHAPTER_TEST').sort((a,b) => a.code.localeCompare(b.code));
        const midterm = storedAssessments.find(a => a.assessmentType === 'MIDTERM');
        const finalAssessment = storedAssessments.find(a => a.assessmentType === 'FINAL');
        const mock = storedAssessments.find(a => a.assessmentType === 'MOCK');
        await models.CurriculumContent.bulkWrite(storedLessons.map(lesson => ({ updateOne: { filter: { _id: lesson._id }, update: { $set: { lessonTestId: lessonTestMap.get(String(lesson._id))?._id || null, assessmentIds: lessonTestMap.get(String(lesson._id))?._id ? [lessonTestMap.get(String(lesson._id))._id] : [] } } } })), { ordered: false });
        await models.Course.updateOne({ _id: course._id }, { $set: {
            'syllabus.lessonCount': storedLessons.length, 'syllabus.chapterCount': chapterTests.length, 'syllabus.questionCount': storedQuestions.length,
            'syllabus.chapters': chapterTests.map((item, i) => ({ order: i + 1, title: `Chương ${i + 1}: ${definition.lessonTitles[i * 2] || 'Nội dung'}`, testId: item._id })),
            'syllabus.chapterAssessments': chapterTests.map((item, i) => ({ chapter: i + 1, assessmentId: item._id, title: item.code })),
            'syllabus.midtermAssessmentId': midterm?._id || null, 'syllabus.finalAssessmentId': finalAssessment?._id || null, 'syllabus.mockAssessmentId': mock?._id || null,
            'syllabus.assessmentStructure': { lessonTests: storedLessons.length, chapterTests: chapterTests.length, midterm: Boolean(midterm), final: Boolean(finalAssessment), mock: Boolean(mock) },
            contentCompleteness: storedLessons.length >= 12 && storedQuestions.length >= 144 && Boolean(midterm) && Boolean(finalAssessment) ? 100 : 90
        } });
        counts.lessonTests += storedAssessments.filter(a => a.assessmentType === 'LESSON_TEST').length;
        counts.chapterTests += chapterTests.length;
        counts.midterms += midterm ? 1 : 0;
        counts.finals += finalAssessment ? 1 : 0;
        counts.mocks += mock ? 1 : 0;
    }
    await models.CurriculumVersion.updateOne({ _id: version._id }, { $set: { 'metadata.seededAt': new Date(), 'metadata.seedRevision': VERSION_MARKER, 'metadata.catalogCourses': STARTER_COURSES.length, 'metadata.expectedLessons': STARTER_COURSES.length * 12, 'metadata.expectedQuestions': STARTER_COURSES.length * 144 } });
    const result = { migration: '010-v20-full-learning-content', catalogCourses: STARTER_COURSES.length, ...counts, university: academic.university.name };
    logger.log(JSON.stringify(result));
    return result;
}

module.exports = { id: '010-v20-full-learning-content', up };
