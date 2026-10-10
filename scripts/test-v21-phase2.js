'use strict';
const assert = require('node:assert/strict');
const { parseLearningDocument, parseQuestionBlocks, extractDocxText, normalizeSurveyResult, buildPersonalLearningPlan } = require('../server/services/platform-services');
const { EDUCATION_LEVELS } = require('../server/config/platform-constants');
const migration = require('./migrations/011-v21-survey-placement');

function run() {
    const markdown = `# Kiểm tra Python cơ bản\n\n## Mục tiêu\nNhận diện biến và kiểu dữ liệu.\n\n## Câu hỏi\nCâu 1: Kiểu dữ liệu của 12 là gì?\nA. string\nB. integer\nC. boolean\nD. list\nĐáp án: B\nGiải thích: 12 là số nguyên.\n\nCâu 2: Dòng lệnh nào xuất giá trị ra màn hình?\nA. input()\nB. print()\nC. len()\nD. type()\nĐáp án: B`;
    const parsed = parseLearningDocument({ text: markdown, filename: 'kiem-tra.md', targetType: 'ASSESSMENT' });
    assert.equal(parsed.targetType, 'ASSESSMENT');
    assert.equal(parsed.questions.length, 2, 'Phải nhận diện được 2 câu hỏi từ Markdown.');
    assert.equal(parsed.questions[0].answer, 'integer', 'Đáp án chữ cái phải ánh xạ đến giá trị lựa chọn.');
    assert.equal(parsed.sections.some(section => /Mục tiêu/.test(section.title)), true, 'Phải nhận diện heading thành section.');
    const oneQuestion = parseLearningDocument({ text: 'Câu 1: Hãy viết chương trình in Hello World.\nDạng: lập trình\nĐáp án: print(\"Hello World\")', filename: 'one-question.md', targetType: 'AUTO' });
    assert.equal(oneQuestion.targetType, 'QUESTION_BANK', 'Tài liệu chỉ có một câu hỏi vẫn phải được nhận diện là question bank.');
    assert.equal(oneQuestion.questions[0].type, 'coding', 'Nhận diện dạng câu hỏi bằng nhãn tiếng Việt.');
    const docxXml = '<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:pPr><w:pStyle w:val=\"Title\"/></w:pPr><w:r><w:t>Giáo trình Python</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>Chương 1: Biến</w:t></w:r></w:p><w:p><w:r><w:t>Nội dung khái niệm biến.</w:t></w:r></w:p></w:body></w:document>';
    const docxName = Buffer.from('word/document.xml');
    const docxContent = Buffer.from(docxXml);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); localHeader.writeUInt16LE(20, 4); localHeader.writeUInt16LE(0, 6); localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(docxContent.length, 18); localHeader.writeUInt32LE(docxContent.length, 22); localHeader.writeUInt16LE(docxName.length, 26); localHeader.writeUInt16LE(0, 28);
    const docx = Buffer.concat([localHeader, docxName, docxContent]);
    const extractedDocx = extractDocxText(docx);
    assert.match(extractedDocx, /^# Giáo trình Python/m, 'DOCX phải giữ heading Title.');
    assert.match(extractedDocx, /^# Chương 1: Biến/m, 'DOCX phải giữ heading style cấp 1.');
    assert.ok(EDUCATION_LEVELS.includes('SELF_STUDY'), 'Cấp tự học phải được schema chấp nhận.');

    const surveyQuestions = [
        { code: 'educationLevel', prompt: 'Cấp học', type: 'single_choice' },
        { code: 'educationStatus', prompt: 'Trạng thái học', type: 'single_choice' },
        { code: 'currentGrade', prompt: 'Lớp', type: 'numerical' },
        { code: 'major', prompt: 'Ngành học', type: 'short_answer' },
        { code: 'goals', prompt: 'Mục tiêu', type: 'multiple_choice' },
        { code: 'targetExam', prompt: 'Chứng chỉ', type: 'multiple_choice' },
        { code: 'strengths', prompt: 'Điểm mạnh', type: 'multiple_choice' },
        { code: 'weaknesses', prompt: 'Điểm yếu', type: 'multiple_choice' },
        { code: 'studyTime', prompt: 'Thời lượng', type: 'single_choice' },
        { code: 'learningFormats', prompt: 'Cách học', type: 'multiple_choice' }
    ];
    const profile = normalizeSurveyResult(surveyQuestions, {
        educationLevel: 'HIGHER_EDUCATION', educationStatus: 'Sinh viên cao đẳng/đại học', major: 'Cơ điện tử',
        goals: ['Học kiến thức chuyên ngành đại học', 'Chuẩn bị thực tập / việc làm'], targetExam: ['IELTS Academic', 'MOS Excel'],
        strengths: ['Tư duy logic'], weaknesses: ['Thực hành phần mềm'], studyTime: '60 phút', learningFormats: ['Làm nhiều bài tập', 'Dự án thực tế']
    });
    assert.equal(profile.educationStatus, 'university', 'Trạng thái tiếng Việt phải được chuẩn hóa sang giá trị có thể đồng bộ hồ sơ.');
    assert.equal(profile.major, 'Cơ điện tử');
    assert.deepEqual(profile.targetExams, ['IELTS Academic', 'MOS Excel']);
    assert.equal(profile.englishGoals.exam, 'IELTS ACADEMIC');
    assert.deepEqual(profile.preferences.learningFormats, ['Làm nhiều bài tập', 'Dự án thực tế']);

    const plan = buildPersonalLearningPlan({
        username: 'phase2-test', educationStage: 'HIGHER_EDUCATION', survey: { goals: ['Học CNTT'], favoriteSubjects: ['Lập trình'], weaknesses: ['Debug code'], major: 'Cơ điện tử', university: 'Trường thử', target: { date: '2027-06-30' } },
        placement: { scores: { 'Tư duy thuật toán': 35, 'Debug code': 48 } }, goals: ['Chuẩn bị thực tập'], version: 3
    });
    assert.equal(plan.version, 3);
    assert.equal(plan.status, 'ACTIVE');
    assert.ok(plan.subjects.some(item => item.subjectId === 'Tư duy thuật toán' && item.priority === 'CRITICAL'));
    assert.ok(plan.subjects.some(item => item.subjectId === 'Debug code' && item.currentScore === 48));
    assert.equal(plan.diagnostics.universityContext.major, 'Cơ điện tử');

    const seededSurvey = migration.surveyQuestions();
    const placements = migration.placementDefinitions();
    assert.ok(seededSurvey.length >= 25, `Survey V21 cần >=25 câu, thực tế ${seededSurvey.length}.`);
    assert.ok(seededSurvey.some(question => question.code === 'major'));
    assert.ok(seededSurvey.some(question => question.code === 'learningFormats' && question.required));
    assert.equal(placements.filter(test => /^HTM-PLACEMENT-K12-G\d+-V21$/.test(test.code)).length, 12, 'Phải có placement riêng cho từng lớp 1–12.');
    assert.ok(placements.some(test => test.target === 'UNIVERSITY_IT'));
    assert.ok(placements.some(test => test.target === 'TOEIC'));
    assert.ok(placements.some(test => test.target === 'IELTS'));
    assert.ok(placements.some(test => test.target === 'MOS'));
    assert.ok(placements.every(test => test.skillSections.length >= 3 && test.skillSections.every(section => section.questions.length >= 2)));
    assert.ok(parseQuestionBlocks('Câu 1: Ví dụ?\nA. Một\nB. Hai\nĐáp án: A').length === 1);
    console.log(JSON.stringify({ ok: true, surveyQuestions: seededSurvey.length, placementTests: placements.length, k12PlacementTests: placements.filter(test => /^HTM-PLACEMENT-K12-G\d+-V21$/.test(test.code)).length, detectedQuestionTypes: [...new Set(placements.flatMap(test => test.skillSections.flatMap(section => section.questions.map(question => question.type || 'single_choice'))))], parsedQuestions: parsed.questions.length, docxHeadingsPreserved: true, singleQuestionAutoDetected: oneQuestion.targetType, learningPlanSubjects: plan.subjects.length }, null, 2));
}

run();
