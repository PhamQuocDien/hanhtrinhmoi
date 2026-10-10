'use strict';
const assert = require('assert');
const curriculum = require('../curriculum-data.js');
const rich = require('../server/modules/rich-learning-content-v20.js');
const starter = require('../server/services/starter-course-catalog.js');
const { scoreAssessmentQuestions } = require('../server/services/platform-services.js');
async function main() {
    assert.strictEqual(starter.STARTER_COURSES.length >= 278, true, 'Catalog V20 phải có ít nhất 278 course canonical/starter.');
    const trackCounts = {};
    for (const course of starter.STARTER_COURSES) trackCounts[course.track] = (trackCounts[course.track] || 0) + 1;
    for (const track of ['UNIVERSITY_IT','ENGLISH','MOS','UNIVERSITY_ECONOMICS','UNIVERSITY_MECHATRONICS','UNIVERSITY_ENGINEERING']) assert(trackCounts[track] > 0, `Thiếu track ${track}.`);
    let k12Lessons = 0;
    let k12MinWords = Infinity;
    let k12MaxWords = 0;
    const k12TypeSet = new Set();
    for (let grade = 1; grade <= 12; grade += 1) {
        const catalog = curriculum.getCatalog(grade);
        for (const subject of catalog.subjects || []) {
            for (const lesson of subject.lessons || []) {
                k12Lessons += 1;
                const material = rich.k12RichLesson({ grade, subjectId: subject.id, subjectName: subject.name, topic: lesson.topic || lesson.title, baseTheory: lesson, lessonNo: lesson.order });
                k12MinWords = Math.min(k12MinWords, material.contentWordCount);
                k12MaxWords = Math.max(k12MaxWords, material.contentWordCount);
                assert(material.theorySections.length >= 8, `K12 lesson ${grade}/${subject.id}/${lesson.order} thiếu section.`);
                assert(material.contentWordCount >= 1100, `K12 lesson ${grade}/${subject.id}/${lesson.order} quá ngắn (${material.contentWordCount} từ).`);
                const questions = rich.buildK12Questions({ grade, subjectId: subject.id, subjectName: subject.name, topic: lesson.topic || lesson.title, index: lesson.order - 1, count: 12 });
                assert.strictEqual(questions.length, 12);
                for (const question of questions) k12TypeSet.add(question.type);
            }
        }
    }
    assert(k12Lessons > 2900, 'Catalog K12 phải bao phủ toàn bộ lesson hiện có 1–12.');
    assert(k12TypeSet.size >= 8, `K12 assessment mới chỉ có ${k12TypeSet.size} dạng câu hỏi.`);
    const sampleCodes = ['CNTT-C-01','CNTT-JAVA-01','TOEIC-P1-02','TOEIC-FOUNDATION-450','IELTS-READING-TFNG','IELTS-WRITING-T2-02','MOS-EXCEL-02','MOS-MOCK-02','ECON-FND-01','MECH-PLC-01','ENG-AUTO-01'];
    for (const code of sampleCodes) {
        const course = starter.STARTER_COURSES.find(item => item.code === code);
        assert(course, `Thiếu sample course ${code}`);
        assert.strictEqual(course.lessonTitles.length, 12, `${code} phải có 12 lesson.`);
        const lesson = rich.professionalRichLesson({ course, topic: course.lessonTitles[0], index: 0, existing: {} });
        assert(lesson.contentWordCount >= 1200, `${code} theory quá ngắn: ${lesson.contentWordCount}`);
        assert(lesson.practical, `${code} thiếu practical profile.`);
        const questions = rich.buildMixedQuestions({ course, topic: course.lessonTitles[0], index: 0, count: 12 });
        assert.strictEqual(questions.length, 12);
        const types = new Set(questions.map(q => q.type));
        assert(types.size >= 8, `${code} thiếu diversity: ${[...types].join(',')}`);
        if (course.targetExam === 'TOEIC' || course.targetExam === 'IELTS') assert(questions.some(q => q.type === 'timed_simulation'), `${code} thiếu timed simulation.`);
        if (course.track === 'MOS') assert(questions.some(q => q.type === 'practical'), `${code} thiếu MOS practical.`);
        if (course.track === 'UNIVERSITY_IT') assert(questions.some(q => q.type === 'coding'), `${code} thiếu coding practical.`);
        if (course.track === 'UNIVERSITY_ECONOMICS' || course.track === 'UNIVERSITY_MECHATRONICS' || course.track === 'UNIVERSITY_ENGINEERING') assert(questions.some(q => q.type === 'practical'), `${code} thiếu practical.`);
    }
    const objectiveQuestions = [
        { _id: '1', type: 'single_choice', points: 1, options: [{ label: 'A', value: 'A' }], answer: 'A' },
        { _id: '2', type: 'multiple_choice', points: 2, options: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }], answer: ['A','B'] },
        { _id: '3', type: 'true_false', points: 1, options: [{ label: 'Đúng', value: true }, { label: 'Sai', value: false }], answer: false },
        { _id: '4', type: 'fill_blank', points: 1, answer: 'kiểm tra', acceptedAnswers: ['kiểm tra','review'] },
        { _id: '5', type: 'numerical', points: 1, answer: 20, acceptedAnswers: [20, '20'] },
        { _id: '6', type: 'ordering', points: 1, options: [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }], answer: ['A','B'] },
        { _id: '7', type: 'matching', points: 1, options: [{ label: 'A', value: 'A' }], answer: { A: 'X' } },
        { _id: '8', type: 'essay', points: 3, rubric: { criteria: [] } }
    ];
    const scored = await scoreAssessmentQuestions(objectiveQuestions, { 1: 'A', 2: ['A','B'], 3: false, 4: 'Review', 5: '20', 6: ['A','B'], 7: { A: 'X' }, 8: 'bài viết' });
    assert.strictEqual(scored.total, 8);
    assert.strictEqual(scored.correct, 7);
    assert.strictEqual(scored.requiresReview, false, 'Bài tự luận dùng rubric nội bộ phải được chấm tự động thay vì chờ Admin.');
    assert.strictEqual(scored.details.find(item => item.type === 'essay').gradingStatus, 'LOCAL_RUBRIC_AUTO');
    const intelligenceSource = require('fs').readFileSync(require('path').join(__dirname, '../server/routes/learning-intelligence-routes.js'), 'utf8');
    assert(!/\$setOnInsert\s*:\s*\{[^}]*occurrenceCount/.test(intelligenceSource), 'Không được còn $setOnInsert occurrenceCount gây conflict với $inc.');
    assert(/occurrenceCount:\s*data\.correct\s*\?\s*0\s*:\s*1/.test(intelligenceSource), 'Logic create occurrenceCount chưa đúng.');
    assert(/\$inc\s*=\s*\{\s*occurrenceCount:\s*1\s*\}/.test(intelligenceSource), 'Logic increment occurrenceCount chưa đúng.');
    const assessmentHtml = require('fs').readFileSync(require('path').join(__dirname, '../assessment.html'), 'utf8');
    for (const type of ['single_choice','multiple_choice','true_false','fill_blank','numerical','short_answer','ordering','matching','essay','reading_comprehension','listening','speaking','coding','practical','timed_simulation']) assert(assessmentHtml.includes(type), `assessment.html thiếu renderer ${type}.`);
    console.log(JSON.stringify({ ok: true, catalogCourses: starter.STARTER_COURSES.length, trackCounts, k12Lessons, k12MinWords, k12MaxWords, k12QuestionTypes: [...k12TypeSet], sampleCourses: sampleCodes.length, scoringCorrect: scored.correct, scoringTotal: scored.total }, null, 2));
}
main().catch(error => { console.error(error.stack || error.message || String(error)); process.exit(1); });
