'use strict';
const assert = require('assert');
const { processJob } = require('../server/services/ai-generation-worker');
function query(value) {
    const self = {
        select() { return self; },
        limit() { return self; },
        sort() { return self; },
        lean() { return Promise.resolve(value); }
    };
    return self;
}
function baseModels(job, overrides = {}) {
    const updates = [];
    return {
        updates,
        AIGenerationJob: {
            async findOneAndUpdate() { job.status = 'RUNNING'; job.attempts = (job.attempts || 0) + 1; return job; },
            async updateOne(filter, update) { updates.push(update); if (update.$set) Object.assign(job, update.$set); return { modifiedCount: 1 }; }
        },
        ...overrides
    };
}
(async () => {
    let fixedLesson = null;
    const lesson = { _id: 'lesson-1', type: 'LESSON', title: 'Vòng lặp', code: 'LOOPS', subjectId: 'Python', courseId: 'course-1', theory: 'Lý thuyết ngắn.', theorySections: [{ title: 'Cũ', content: 'Lý thuyết ngắn.' }], examples: [], activities: [], payload: {} };
    const lessonJob = { _id: 'job-lesson', type: 'COURSE', status: 'QUEUED', attempts: 0, payload: { localAction: 'CONTENT_REPAIR', targetType: 'LESSON', targetId: lesson._id } };
    const lessonModels = baseModels(lessonJob, {
        CurriculumContent: { findOne: () => query(lesson), async updateOne(filter, update) { fixedLesson = update.$set; return { modifiedCount: 1 }; } },
        Course: { findById: () => query({ _id: 'course-1', name: 'Python căn bản', subjectId: 'Python', educationLevel: 'HIGHER_EDUCATION' }) }
    });
    const lessonResult = await processJob(lessonModels);
    assert.strictEqual(lessonResult.status, 'COMPLETED');
    assert(fixedLesson.theorySections.length >= 2 && fixedLesson.activities.length > 0);
    assert.strictEqual(lessonJob.result.remoteApiUsed, false);
    process.stdout.write('PASS worker repairs only selected lesson and does not call remote API\n');

    let fixedQuestion = null;
    const questionJob = { _id: 'job-question', type: 'COURSE', status: 'QUEUED', attempts: 0, payload: { localAction: 'CONTENT_REPAIR', targetType: 'QUESTION', targetId: 'question-1' } };
    const questionModels = baseModels(questionJob, {
        Question: { findById: () => query({ _id: 'question-1', code: 'Q1', type: 'single_choice', prompt: '2+2=?', options: [{ text: '3' }, { label: '4', value: 'B' }] }), async updateOne(filter, update) { fixedQuestion = update.$set; return { modifiedCount: 1 }; } }
    });
    const questionResult = await processJob(questionModels);
    assert.strictEqual(questionResult.status, 'COMPLETED');
    assert.strictEqual(questionJob.result.outcome, 'NEEDS_ADMIN_REVIEW');
    assert.strictEqual(fixedQuestion.status, 'DRAFT');
    assert(!Object.prototype.hasOwnProperty.call(fixedQuestion, 'answer'));
    process.stdout.write('PASS worker normalizes one question but never invents its missing answer\n');

    let fixedAssessment = null;
    const assessmentJob = { _id: 'job-assessment', type: 'COURSE', status: 'QUEUED', attempts: 0, payload: { localAction: 'CONTENT_REPAIR', targetType: 'ASSESSMENT', targetId: 'assessment-1' } };
    const assessmentModels = baseModels(assessmentJob, {
        Assessment: { findById: () => query({ _id: 'assessment-1', title: 'Kiểm tra', courseId: 'course-1', subjectId: 'Python', questionIds: [], questionPool: [], sections: [], publicationStatus: 'PUBLISHED' }), async updateOne(filter, update) { fixedAssessment = update.$set; return { modifiedCount: 1 }; } },
        Question: { find: () => query([{ _id: 'q1', prompt: 'Câu 1', type: 'single_choice' }, { _id: 'q2', prompt: 'Câu 2', type: 'short_answer' }]) }
    });
    const assessmentResult = await processJob(assessmentModels);
    assert.strictEqual(assessmentResult.status, 'COMPLETED');
    assert.deepStrictEqual(fixedAssessment.questionIds, ['q1', 'q2']);
    assert.strictEqual(fixedAssessment.publicationStatus, 'DRAFT');
    process.stdout.write('PASS worker repairs one assessment with real questions and leaves it unpublished\n');
    process.stdout.write('\nV23 Phase 3 worker: 3 tests PASS.\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
