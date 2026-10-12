'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseBalancedQuestions, dedupeQuestionPrompts, buildQuestionMix, quotasFor } = require('../src/services/career-assessment-generator');
function pool() {
  const types = ['multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'essay', 'code_challenge', 'debugging', 'design_task'];
  const rows = [];
  for (let typeIndex = 0; typeIndex < types.length; typeIndex += 1) {
    for (let index = 0; index < 8; index += 1) rows.push({ questionId: `${types[typeIndex]}-${index}`, type: types[typeIndex], difficulty: ['easy', 'medium', 'hard'][index % 3], taxonomy: ['remember', 'understand', 'apply', 'analyze', 'create'][index % 5] });
  }
  return rows;
}
test('question blueprint has an exact total quota and favors mixed types', () => {
  for (const count of [3, 8, 10, 12, 16, 20, 24, 30]) {
    const quotas = quotasFor(count);
    assert.equal([...quotas.values()].reduce((sum, value) => sum + value, 0), count);
  }
  const result = chooseBalancedQuestions(pool(), 10);
  assert.equal(result.questions.length, 10);
  assert.ok(Object.keys(result.questionMix.type).length >= 6);
  assert.ok(Object.keys(result.questionMix.difficulty).length >= 2);
  assert.equal(new Set(result.questions.map((item) => item.questionId)).size, 10);
});
test('question randomization excludes recently seen questions when enough unseen remain', () => {
  const questions = pool();
  const recent = questions.slice(0, 18).map((item) => item.questionId);
  const result = chooseBalancedQuestions(questions, 10, recent);
  assert.equal(result.questions.length, 10);
  assert.ok(result.questions.every((item) => !recent.includes(item.questionId)));
  assert.match(result.repeatAvoidance, /không chứa câu/);
});
test('question randomization only allows repeats when the unseen pool is too small', () => {
  const questions = pool().slice(0, 5);
  const recent = questions.slice(0, 4).map((item) => item.questionId);
  const result = chooseBalancedQuestions(questions, 5, recent);
  assert.equal(result.questions.length, 5);
  assert.match(result.repeatAvoidance, /câu lặp/);
  assert.equal(new Set(result.questions.map((item) => item.questionId)).size, 5);
});
test('duplicate question IDs are removed from a source pool before selection', () => {
  const duplicated = [...pool(), pool()[0]];
  const result = chooseBalancedQuestions(duplicated, 10);
  assert.equal(result.questions.length, 10);
  assert.equal(new Set(result.questions.map((item) => item.questionId)).size, 10);
  assert.deepEqual(buildQuestionMix(result.questions), result.questionMix);
});

test('assessment blueprint balances question type, difficulty, and taxonomy targets', () => {
  const questions = pool();
  const result = chooseBalancedQuestions(questions, 20, [], {
    difficultyWeights: { easy: 0.1, medium: 0.2, hard: 0.7 },
    taxonomyWeights: { remember: 0.1, understand: 0.1, apply: 0.2, analyze: 0.3, create: 0.3 }
  });
  assert.equal(result.questions.length, 20);
  assert.equal(result.blueprintTargets.difficulty.easy, 2);
  assert.equal(result.blueprintTargets.difficulty.medium, 4);
  assert.equal(result.blueprintTargets.difficulty.hard, 14);
  assert.ok(result.questionMix.difficulty.hard > result.questionMix.difficulty.easy);
  assert.ok(result.questionMix.taxonomy.analyze + result.questionMix.taxonomy.create >= 6);
});

test('when unseen pool is too small, selector takes unseen questions before repeating seen ones', () => {
  const questions = pool().slice(0, 5);
  const recentlySeen = questions.slice(0, 4).map((item) => item.questionId);
  const result = chooseBalancedQuestions(questions, 2, recentlySeen);
  assert.equal(result.questions.length, 2);
  assert.ok(result.questions.some((item) => !recentlySeen.includes(item.questionId)));
  assert.match(result.repeatAvoidance, /ưu tiên tất cả câu chưa gặp/);
});


test('question bank deduplicates identical prompts and prefers the newest reviewed bank version', () => {
  const oldItem = { questionId: 'old-id', prompt: '  What is an API? ', bankVersion: 'V5.1.2', updatedAt: '2026-01-01T00:00:00Z' };
  const newItem = { questionId: 'new-id', prompt: 'what is an api?', bankVersion: 'V6.1.1', updatedAt: '2026-01-02T00:00:00Z' };
  const rows = dedupeQuestionPrompts([oldItem, newItem, { questionId: 'unique', prompt: 'Define a database', bankVersion: 'V5.1.2' }]);
  assert.equal(rows.length, 2);
  assert.ok(rows.some((item) => item.questionId === 'new-id'));
  assert.ok(!rows.some((item) => item.questionId === 'old-id'));
});
