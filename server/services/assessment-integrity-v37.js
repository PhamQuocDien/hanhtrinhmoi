'use strict';

function idOf(value) { return String(value?._id || value?.id || value || ''); }
function normalizeText(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function uniquePrompts(questions = []) {
    const seen = new Set();
    return questions.filter(question => {
        const prompt = normalizeText(question?.prompt || question?.question || question?.text);
        if (!prompt || seen.has(prompt)) return false;
        seen.add(prompt); return true;
    });
}
function minimumQuestionCount(type) {
    return ({ LESSON_TEST: 6, CHAPTER_TEST: 6, MIDTERM: 10, FINAL: 15, MOCK: 20, PLACEMENT: 12, DIAGNOSTIC: 12 })[String(type || '').toUpperCase()] || 1;
}
function validateAssessmentScope({ course, lesson = null, assessmentType = 'FINAL', questions = [] } = {}) {
    const errors = [];
    const type = String(assessmentType || '').toUpperCase();
    const courseId = idOf(course);
    const lessonId = idOf(lesson);
    if (!courseId) errors.push('ASSESSMENT_COURSE_REQUIRED');
    if (type === 'LESSON_TEST' && !lessonId) errors.push('LESSON_TEST_LESSON_REQUIRED');
    if (type === 'LESSON_TEST' && lesson && idOf(lesson.courseId) && idOf(lesson.courseId) !== courseId) errors.push('LESSON_COURSE_MISMATCH');
    const rows = Array.isArray(questions) ? questions : [];
    if (rows.length < minimumQuestionCount(type)) errors.push('ASSESSMENT_QUESTION_COUNT_TOO_LOW');
    if (uniquePrompts(rows).length !== rows.length) errors.push('ASSESSMENT_DUPLICATE_QUESTIONS');
    for (const question of rows) {
        if (idOf(question.courseId) && idOf(question.courseId) !== courseId) errors.push('QUESTION_COURSE_MISMATCH');
        if (course?.subjectId && question.subjectId && normalizeText(course.subjectId) !== normalizeText(question.subjectId)) errors.push('QUESTION_SUBJECT_MISMATCH');
        if (course?.grade && question.grade && Number(course.grade) !== Number(question.grade)) errors.push('QUESTION_GRADE_MISMATCH');
        if (course?.educationLevel && question.educationLevel && normalizeText(course.educationLevel) !== normalizeText(question.educationLevel)) errors.push('QUESTION_EDUCATION_LEVEL_MISMATCH');
        if (type === 'LESSON_TEST' && lessonId && idOf(question.lessonId) !== lessonId) errors.push('QUESTION_LESSON_MISMATCH');
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)], questionCount: rows.length, uniqueQuestionCount: uniquePrompts(rows).length };
}
function prepareAdaptiveDiagnosticQuestions({ questions = [], fallbackQuestions = [], skills = [], limit = 30 } = {}) {
    const normalize = (question, index, fallback = false) => {
        const prompt = String(question?.prompt || question?.question || question?.text || '').trim();
        const skill = String(question?.skill || question?.tags?.[0] || skills[index % Math.max(1, skills.length)] || '').trim();
        return { ...question, prompt, skill: skill || 'Tổng hợp', difficulty: String(question?.difficulty || (index % 3 === 0 ? 'FOUNDATION' : index % 3 === 1 ? 'INTERMEDIATE' : 'ADVANCED')).toUpperCase(), _fallback: fallback };
    };
    const merged = [...questions.map((q, i) => normalize(q, i)), ...fallbackQuestions.map((q, i) => normalize(q, i, true))];
    const deduped = uniquePrompts(merged);
    const groups = new Map();
    for (const question of deduped) {
        const key = normalizeText(question.skill) || 'tong hop';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(question);
    }
    const orderedGroups = [...groups.values()].sort((a, b) => b.length - a.length);
    const selected = [];
    let cursor = 0;
    while (selected.length < Math.max(12, Math.min(60, Number(limit) || 30)) && orderedGroups.some(group => group.length)) {
        const group = orderedGroups[cursor % orderedGroups.length];
        if (group.length) selected.push(group.shift());
        cursor += 1;
        if (cursor > 10000) break;
    }
    const uniqueSkills = new Set(selected.map(q => normalizeText(q.skill)).filter(Boolean));
    const difficulties = new Set(selected.map(q => normalizeText(q.difficulty)).filter(Boolean));
    return { questions: selected.map(({ _fallback, ...question }) => question), skillCount: uniqueSkills.size, difficultyCount: difficulties.size, valid: selected.length >= 12 && uniqueSkills.size >= 3 && difficulties.size >= 2, diagnostics: { sourceQuestionCount: merged.length, uniqueQuestionCount: deduped.length, selectedQuestionCount: selected.length, skillCount: uniqueSkills.size, difficultyCount: difficulties.size } };
}
function auditLessonLearningContent({ lesson = {}, assessment = null, questions = [] } = {}) {
    const issues = [];
    const sections = Array.isArray(lesson.theorySections) ? lesson.theorySections : Array.isArray(lesson.theory) ? lesson.theory : [];
    const validSections = sections.filter(section => String(typeof section === 'string' ? section : section?.content || '').trim().length >= 80);
    const lecture = String(lesson.payload?.lectureScript || lesson.payload?.lecture?.script || lesson.lectureScript || lesson.lecture?.script || '').trim();
    const examples = Array.isArray(lesson.examples) ? lesson.examples : [];
    const tasks = Array.isArray(lesson.payload?.practiceTasks) ? lesson.payload.practiceTasks : Array.isArray(lesson.practiceTasks) ? lesson.practiceTasks : Array.isArray(lesson.activities) ? lesson.activities : [];
    const validExamples = examples.filter(item => String(typeof item === 'string' ? item : `${item?.text || item?.problem || ''} ${item?.solution || ''}`).trim().length >= 18);
    const validTasks = tasks.filter(item => String(typeof item === 'string' ? item : `${item?.title || ''} ${item?.task || item?.prompt || item?.instruction || item?.instructions || item?.description || ''}`).trim().length >= 12);
    if (validSections.length < 3) issues.push('LESSON_THEORY_INSUFFICIENT');
    if (lecture.length < 180) issues.push('LESSON_LECTURE_INSUFFICIENT');
    if (validExamples.length < 2) issues.push('LESSON_EXAMPLES_INSUFFICIENT');
    if (validTasks.length < 2) issues.push('LESSON_PRACTICE_INSUFFICIENT');
    if (!assessment || String(assessment.assessmentType) !== 'LESSON_TEST' || idOf(assessment.lessonId) !== idOf(lesson)) issues.push('LESSON_ASSESSMENT_MISMATCH');
    if (questions.some(question => idOf(question.lessonId) !== idOf(lesson))) issues.push('LESSON_QUESTION_SCOPE_MISMATCH');
    if (assessment?.courseId && questions.some(question => idOf(question.courseId) !== idOf(assessment.courseId))) issues.push('LESSON_QUESTION_COURSE_MISMATCH');
    if (uniquePrompts(questions).length < 6) issues.push('LESSON_QUESTION_BANK_INSUFFICIENT');
    const topicWords = normalizeText(lesson.title).split(/\s+/).filter(word => word.length >= 4);
    const prompts = questions.map(q => normalizeText(q.prompt));
    const topicHits = topicWords.length ? prompts.filter(prompt => topicWords.some(word => prompt.includes(word))).length : prompts.length;
    if (prompts.length >= 6 && topicWords.length && topicHits / prompts.length < 0.25) issues.push('LESSON_QUESTION_TOPIC_ALIGNMENT_LOW');
    return { valid: issues.length === 0, issues, metrics: { theorySections: validSections.length, lectureCharacters: lecture.length, examples: validExamples.length, practiceTasks: validTasks.length, uniqueQuestions: uniquePrompts(questions).length, topicAlignedQuestionRatio: prompts.length ? topicHits / prompts.length : 0 } };
}
module.exports = { idOf, normalizeText, uniquePrompts, minimumQuestionCount, validateAssessmentScope, prepareAdaptiveDiagnosticQuestions, auditLessonLearningContent };
