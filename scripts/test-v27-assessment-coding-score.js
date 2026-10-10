'use strict';
const assert = require('node:assert/strict');
const { scoreAssessmentQuestions } = require('../server/services/platform-services');

async function run() {
    const question = {
        _id: 'coding-question-1', code: 'DSA-WEIGHT-1', type: 'coding', points: 20,
        prompt: 'Viết chương trình xử lý input.', skill: 'DSA',
        media: { coding: {
            language: 'javascript',
            publicTestCases: [
                { input: 'public-1', expectedOutput: 'A', weight: 2 },
                { input: 'public-2', expectedOutput: 'B', weight: 1 }
            ],
            hiddenTestCases: [
                { input: 'secret-input-1', expectedOutput: 'S', weight: 3 },
                { input: 'secret-input-2', expectedOutput: 'T', weight: 4 }
            ]
        } }
    };
    const result = await scoreAssessmentQuestions([question], { 'coding-question-1': { code: 'const x = 1;', language: 'javascript' } }, {
        executeCode: async ({ stdin }) => ({ status: 'SUCCESS', stdout: ({ 'public-1': 'A', 'public-2': 'wrong', 'secret-input-1': 'S', 'secret-input-2': 'wrong' })[stdin] || '', runtimeMs: 2 })
    });
    assert.equal(result.percentage, 50);
    assert.equal(result.earnedPoints, 10);
    assert.equal(result.maxPoints, 20);
    assert.equal(result.requiresReview, false);
    const coding = result.details[0].coding;
    assert.equal(coding.scoringModel, 'WEIGHTED_TEST_CASES');
    assert.equal(coding.scorePercent, 50);
    assert.equal(coding.visible.passed, 1);
    assert.equal(coding.visible.total, 2);
    assert.equal(coding.hiddenSummary.passed, 1);
    assert.equal(coding.hiddenSummary.total, 2);
    const response = JSON.stringify(result);
    assert(!response.includes('secret-input-1'));
    assert(!response.includes('secret-input-2'));
    assert(!response.includes('\"expectedOutput\":\"T\"'));
    assert(!response.includes('\"actualOutput\":\"wrong\"') || !response.includes('secret-input-2'));
    process.stdout.write('PASS assessment coding score uses weighted tests and returns visible-only detail plus hidden aggregate\n');

    const disabled = await scoreAssessmentQuestions([question], { 'coding-question-1': { code: 'x', language: 'javascript' } }, {
        executeCode: async () => ({ status: 'SANDBOX_REQUIRED', disabled: true, message: 'Need sandbox' })
    });
    assert.equal(disabled.requiresReview, true);
    assert.equal(disabled.details[0].gradingStatus, 'REVIEW_REQUIRED');
    assert.equal(disabled.details[0].coding.message, 'Need sandbox');
    assert.equal(disabled.details[0].coding.hiddenSummary.total, 0);
    process.stdout.write('PASS assessment coding avoids false score when safe runner is unavailable\n');

    const unconfigured = await scoreAssessmentQuestions([{ ...question, media: { coding: { publicTestCases: [], hiddenTestCases: [] } } }], { 'coding-question-1': { code: 'x' } }, { executeCode: async () => ({ status: 'SUCCESS', stdout: '' }) });
    assert.equal(unconfigured.requiresReview, true);
    assert.equal(unconfigured.details[0].gradingStatus, 'REVIEW_REQUIRED');
    process.stdout.write('PASS assessment coding refuses to invent score if question has no test cases\n');
    process.stdout.write('\nV27.1 coding assessment scoring: 3 tests PASS.\n');
}
run().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
