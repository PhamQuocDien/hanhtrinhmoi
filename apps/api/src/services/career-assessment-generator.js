'use strict';
const crypto = require('node:crypto');

const TYPE_WEIGHTS = [
  ['multiple_choice', 0.30], ['true_false', 0.10], ['fill_blank', 0.10], ['short_answer', 0.20],
  ['essay', 0.10], ['code_challenge', 0.10], ['debugging', 0.05], ['design_task', 0.05]
];
const DEFAULT_DIFFICULTY_WEIGHTS = [['easy', 0.25], ['medium', 0.50], ['hard', 0.25]];
const DEFAULT_TAXONOMY_WEIGHTS = [['remember', 0.15], ['understand', 0.25], ['apply', 0.30], ['analyze', 0.20], ['create', 0.10]];
function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = crypto.randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
function quotasFor(count, weights = TYPE_WEIGHTS) {
  const rows = weights.map(([type, weight]) => ({ type, value: count * weight, quota: Math.floor(count * weight), remainder: count * weight - Math.floor(count * weight) }));
  let left = count - rows.reduce((sum, item) => sum + item.quota, 0);
  const ranked = rows.slice().sort((a, b) => b.remainder - a.remainder || weights.findIndex(([type]) => type === a.type) - weights.findIndex(([type]) => type === b.type));
  for (const row of ranked) {
    if (!left) break;
    row.quota += 1;
    left -= 1;
  }
  return new Map(rows.map((item) => [item.type, item.quota]));
}
function normalizeWeights(rawWeights, fallbackWeights) {
  if (!rawWeights) return fallbackWeights;
  const input = Array.isArray(rawWeights) ? rawWeights : Object.entries(rawWeights);
  const allowed = new Set(fallbackWeights.map(([key]) => key));
  const rows = input.filter((item) => Array.isArray(item) && allowed.has(item[0]) && Number.isFinite(Number(item[1])) && Number(item[1]) > 0).map(([key, value]) => [key, Number(value)]);
  const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
  return total > 0 ? rows.map(([key, weight]) => [key, weight / total]) : fallbackWeights;
}
function buildQuestionMix(questions) {
  const type = {};
  const difficulty = {};
  const taxonomy = {};
  for (const question of questions) {
    type[question.type] = (type[question.type] || 0) + 1;
    const level = question.difficulty || 'medium';
    difficulty[level] = (difficulty[level] || 0) + 1;
    const skill = question.taxonomy || 'understand';
    taxonomy[skill] = (taxonomy[skill] || 0) + 1;
  }
  return { type, difficulty, taxonomy };
}
function dedupeQuestionPrompts(bank) {
  const rows = (bank || []).slice().sort((left, right) => {
    const version = String(right.bankVersion || '').localeCompare(String(left.bankVersion || ''), 'en', { numeric: true });
    if (version) return version;
    const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() || 0 : 0;
    const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() || 0 : 0;
    return rightTime - leftTime;
  });
  const seenIds = new Set();
  const seenPrompts = new Set();
  const result = [];
  for (const row of rows) {
    if (!row?.questionId || seenIds.has(row.questionId)) continue;
    const prompt = String(row.prompt || '').normalize('NFKC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
    const promptKey = prompt || `__id:${row.questionId}`;
    if (seenPrompts.has(promptKey)) continue;
    seenIds.add(row.questionId);
    seenPrompts.add(promptKey);
    result.push(row);
  }
  return result;
}

function chooseBalancedQuestions(bank, count, recentlySeenIds = [], blueprint = {}) {
  const all = dedupeQuestionPrompts(bank);
  const targetCount = Math.min(Math.max(0, Number.parseInt(count, 10) || 0), all.length);
  if (!targetCount) return { questions: [], questionMix: { type: {}, difficulty: {}, taxonomy: {} }, repeatAvoidance: 'Không có câu hỏi trong ngân hàng đã lọc.', blueprintTargets: { type: {}, difficulty: {}, taxonomy: {} } };
  const seen = new Set(recentlySeenIds);
  const unseen = all.filter((item) => !seen.has(item.questionId));
  const canAvoidAllRecentRepeats = unseen.length >= targetCount;
  // If the unseen pool is too small, still choose all unseen questions before allowing repeats.
  const pool = shuffle(canAvoidAllRecentRepeats ? unseen : [...unseen, ...all.filter((item) => seen.has(item.questionId))]);
  const typeWeights = normalizeWeights(blueprint.typeWeights, TYPE_WEIGHTS);
  const difficultyWeights = normalizeWeights(blueprint.difficultyWeights, DEFAULT_DIFFICULTY_WEIGHTS);
  const taxonomyWeights = normalizeWeights(blueprint.taxonomyWeights, DEFAULT_TAXONOMY_WEIGHTS);
  const targets = {
    type: quotasFor(targetCount, typeWeights),
    difficulty: quotasFor(targetCount, difficultyWeights),
    taxonomy: quotasFor(targetCount, taxonomyWeights)
  };
  const counts = { type: new Map(), difficulty: new Map(), taxonomy: new Map() };
  const selected = [];
  const selectedIds = new Set();
  while (selected.length < targetCount) {
    let best = null;
    let bestScore = -Infinity;
    for (const item of pool) {
      if (selectedIds.has(item.questionId)) continue;
      const dimensions = {
        type: item.type,
        difficulty: item.difficulty || 'medium',
        taxonomy: item.taxonomy || 'understand'
      };
      const typeDeficit = (targets.type.get(dimensions.type) || 0) - (counts.type.get(dimensions.type) || 0);
      const difficultyDeficit = (targets.difficulty.get(dimensions.difficulty) || 0) - (counts.difficulty.get(dimensions.difficulty) || 0);
      const taxonomyDeficit = (targets.taxonomy.get(dimensions.taxonomy) || 0) - (counts.taxonomy.get(dimensions.taxonomy) || 0);
      const unseenBonus = seen.has(item.questionId) ? 0 : 1000;
      const score = unseenBonus + typeDeficit * 10 + difficultyDeficit * 4 + taxonomyDeficit * 2 + crypto.randomInt(1000) / 1000;
      if (score > bestScore) { best = item; bestScore = score; }
    }
    if (!best) break;
    selected.push(best);
    selectedIds.add(best.questionId);
    for (const dimension of ['type', 'difficulty', 'taxonomy']) {
      const key = dimension === 'type' ? best.type : (best[dimension] || (dimension === 'difficulty' ? 'medium' : 'understand'));
      counts[dimension].set(key, (counts[dimension].get(key) || 0) + 1);
    }
  }
  const questions = shuffle(selected);
  const questionMix = buildQuestionMix(questions);
  return {
    questions,
    questionMix,
    blueprintTargets: Object.fromEntries(Object.entries(targets).map(([dimension, values]) => [dimension, Object.fromEntries(values)])),
    repeatAvoidance: canAvoidAllRecentRepeats ? 'Đã ưu tiên đề hoàn toàn không chứa câu trong 12 đề gần đây.' : 'Đã ưu tiên tất cả câu chưa gặp trước khi dùng câu lặp; ngân hàng chưa đủ câu mới để tránh lặp hoàn toàn.'
  };
}
module.exports = { chooseBalancedQuestions, dedupeQuestionPrompts, buildQuestionMix, quotasFor, normalizeWeights, TYPE_WEIGHTS, DEFAULT_DIFFICULTY_WEIGHTS, DEFAULT_TAXONOMY_WEIGHTS };
