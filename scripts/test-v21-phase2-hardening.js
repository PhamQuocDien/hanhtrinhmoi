'use strict';

const assert = require('node:assert/strict');
const { validateSurvey, validatePlacement, visibleSurveyQuestions } = require('../server/services/diagnostic-validation');
const { selectAdaptivePlacementQuestion, buildAssessmentSkillEvidence, normalizeSurveyResult, buildEnglishSkillProfile, buildPersonalLearningPlan } = require('../server/services/platform-services');
const migration = require('./migrations/011-v21-survey-placement');

function run() {
    const questions = migration.surveyQuestions();
    const survey = { title: 'Survey test', description: 'Mô tả kiểm tra', version: '1', status: 'PUBLISHED', questions };
    assert.equal(validateSurvey(survey).valid, true, 'Survey seed phải hợp lệ trước khi công bố.');
    assert.equal(validateSurvey({ ...survey, questions: [] }).status, 'INVALID / NEEDS_REPAIR');
    assert.equal(validateSurvey({ ...survey, questions: questions.map((question, index) => index ? question : { ...question, code: '' }) }).valid, false);
    assert.equal(validateSurvey({ ...survey, questions: questions.map((question, index) => index ? question : { ...question, required: false }).map((question, index) => index ? question : { ...question, type: 'single_choice', options: [] }) }).valid, false);
    const duplicate = { ...survey, questions: [{ code: 'same', prompt: 'A?', type: 'single_choice', required: true, options: ['A', 'B'] }, { code: 'SAME', prompt: 'B?', type: 'single_choice', options: ['A', 'B'] }] };
    assert.equal(validateSurvey(duplicate).valid, false, 'Question code trùng phải bị chặn.');
    assert.equal(validateSurvey({ ...survey, version: '' }).valid, false, 'Survey thiếu version không được công bố.');
    assert.equal(validateSurvey({ ...survey, questions: [{ code: 'bool', prompt: 'Đúng?', type: 'true_false', required: true, options: [] }] }).valid, false, 'Câu đúng/sai phải có đúng hai lựa chọn hợp lệ.');

    const visible = visibleSurveyQuestions(survey, { educationLevel: 'PRIMARY' });
    assert.ok(visible.some(question => question.code === 'currentGrade'));
    assert.ok(!visible.some(question => question.code === 'major'), 'Câu đại học phải được ẩn khi người học chọn K12.');
    assert.ok(visibleSurveyQuestions(survey, { educationLevel: 'HIGHER_EDUCATION' }).some(question => question.code === 'major'));

    const placements = migration.placementDefinitions();
    assert.ok(placements.every(test => validatePlacement(test).valid), 'Toàn bộ placement seed phải qua validator.');
    const test = {
        skillSections: ['syntax', 'functions', 'OOP'].map(skill => ({ skill, title: skill, questions: [1, 2, 3].map((index) => ({ id: `${skill}-${index}`, code: `${skill}-${index}`, prompt: `${skill} Q${index}`, type: 'single_choice', difficulty: index, options: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }], answer: index === 2 ? 'B' : 'A' })) }))
    };
    const first = selectAdaptivePlacementQuestion(test, {});
    assert.ok(first.nextQuestion, 'Adaptive placement phải trả câu đầu tiên.');
    assert.equal(first.done, false);
    assert.equal('answer' in first.nextQuestion, false, 'Không được gửi đáp án chuẩn tới trình duyệt.');
    assert.equal('hiddenTestCases' in first.nextQuestion, false, 'Không được gửi hidden test case tới trình duyệt.');
    const selected = first.nextQuestion.id;
    const next = selectAdaptivePlacementQuestion(test, { askedQuestionIds: [selected], currentQuestionId: selected, answers: { [selected]: first.nextQuestion.answer || 'A' } });
    assert.ok(next.nextQuestion, 'Phải chọn câu tiếp theo sau câu trả lời.');
    assert.notEqual(next.nextQuestion.id, selected, 'Không lặp câu hỏi đã được hỏi.');
    let asked = [];
    let answers = {};
    let current = selectAdaptivePlacementQuestion(test, {});
    while (!current.done) {
        const q = current.nextQuestion;
        const id = q.id;
        if (!asked.includes(id)) asked.push(id);
        answers[id] = 'A';
        current = selectAdaptivePlacementQuestion(test, { answers, askedQuestionIds: asked, currentQuestionId: id });
        assert.ok(asked.length <= 9, 'Adaptive placement không được hỏi quá số câu trong question pool.');
    }
    assert.ok(asked.length >= 6 && asked.length <= 9, 'Bài adaptive phải giữ độ phủ tối thiểu cho cả ba kỹ năng.');
    assert.equal(current.done, true);

    const evidence = buildAssessmentSkillEvidence([
        { skill: 'loops', maxPoints: 2, points: 2, isCorrect: true, requiresReview: false, gradingStatus: 'AUTO_SCORED' },
        { skill: 'loops', maxPoints: 2, points: 0, isCorrect: false, requiresReview: false, gradingStatus: 'AUTO_SCORED' },
        { skill: 'essay', maxPoints: 5, points: 0, isCorrect: false, requiresReview: true, gradingStatus: 'REVIEW_REQUIRED' }
    ]);
    assert.equal(evidence.scores.loops, 50);
    assert.equal(Object.hasOwn(evidence.scores, 'essay'), false, 'Tự luận chờ review không được tính là bằng chứng auto-score.');

    const normalized = normalizeSurveyResult([
        { code: 'educationLevel', prompt: 'Cấp học', type: 'single_choice' },
        { code: 'major', prompt: 'Ngành', type: 'short_answer' },
        { code: 'goals', prompt: 'Mục tiêu', type: 'multiple_choice' }
    ], { educationLevel: 'HIGHER_EDUCATION', major: 'Cơ điện tử', goals: ['Học chuyên ngành'] });
    assert.equal(normalized.major, 'Cơ điện tử');
    assert.equal(normalized.provenance.fields.major, 'USER_DECLARED');
    assert.equal(normalized.provenance.inferenceRequiresConfirmation, true);
    assert.ok(['USER_DECLARED', 'AI_INFERRED', 'SYSTEM_DERIVED'].every(source => normalized.provenance.sourceTypes.includes(source)));

    const ieltsProfile = buildEnglishSkillProfile('IELTS', { Listening: 75, Reading: 80, Writing: 60, Speaking: 50 }, { Writing: { reviewRequired: true }, Speaking: { reviewRequired: true } });
    assert.deepEqual(Object.keys(ieltsProfile.skillProfile).sort(), ['LISTENING', 'READING', 'SPEAKING', 'WRITING']);
    assert.ok(ieltsProfile.reviewRequiredSkills.includes('Writing') && ieltsProfile.reviewRequiredSkills.includes('Speaking'));
    assert.equal(ieltsProfile.scoreEvidence.officialScore, false, 'IELTS practice không được gắn nhãn điểm chính thức.');
    const toeicProfile = buildEnglishSkillProfile('TOEIC', { 'Part 1': 70, 'Part 2': 80, 'Part 5': 45, 'Part 7': 55 });
    assert.equal(toeicProfile.skillProfile.LISTENING, 75);
    assert.equal(toeicProfile.skillProfile.READING, 50);
    const plan = buildPersonalLearningPlan({ username: 'phase2-test', survey: { goals: ['Luyện TOEIC', 'Học chuyên ngành đại học'], targetExams: ['TOEIC'], major: 'Cơ điện tử' }, goals: ['Luyện TOEIC'], version: 1 });
    assert.ok(plan.subjects.some(item => /TOEIC/i.test(item.subjectId)), 'Lộ trình phải nhận diện mục tiêu TOEIC.');
    assert.ok(plan.subjects.some(item => /Cơ điện tử/.test(item.subjectId)), 'Lộ trình phải đưa ngành học do người dùng khai báo vào candidates.');

    console.log(JSON.stringify({
        ok: true,
        surveyQuestionsValidated: questions.length,
        placementTestsValidated: placements.length,
        invalidPublishedSurveyBlocked: true,
        conditionalSurveyQuestions: true,
        adaptivePlacementQuestionsAsked: asked.length,
        adaptiveCoverageSkills: Object.keys(current.coverage).length,
        hiddenAnswersProtected: true,
        assessmentSkillEvidence: evidence.scores,
        provenance: normalized.provenance.fields,
        englishProfiles: { toeic: toeicProfile.skillProfile, ielts: ieltsProfile.skillProfile },
        courseRecommendationsIncludeDeclaredGoals: true
    }, null, 2));
}

run();
