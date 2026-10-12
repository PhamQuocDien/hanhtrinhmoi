'use strict';
const crypto = require('node:crypto');

const QUESTION_COUNTS = Object.freeze({ lesson: 8, chapter: 16, midterm: 20, final: 24, practice: 12 });
const QUESTION_TYPE_WEIGHTS = Object.freeze([
  ['multiple_choice', 0.26], ['true_false', 0.13], ['fill_blank', 0.13], ['multiple_select', 0.07],
  ['matching', 0.07], ['ordering', 0.07], ['short_answer', 0.13], ['essay', 0.14]
]);
function randomIndex(max, random = Math.random) { return Math.min(max - 1, Math.floor(random() * max)); }
function shuffled(items, random = Math.random) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1, random);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}
function getTypeQuota(count) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const quotas = new Map(QUESTION_TYPE_WEIGHTS.map(([type]) => [type, 0]));
  if (!safeCount) return Object.fromEntries(quotas);
  let remaining = safeCount;
  // A full 8-question lesson test represents all eight supported school question formats.
  if (safeCount >= QUESTION_TYPE_WEIGHTS.length) {
    for (const [type] of QUESTION_TYPE_WEIGHTS) quotas.set(type, 1);
    remaining -= QUESTION_TYPE_WEIGHTS.length;
  }
  if (!remaining) return Object.fromEntries(quotas);
  const totalWeight = QUESTION_TYPE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  const rows = QUESTION_TYPE_WEIGHTS.map(([type, weight], order) => {
    const exact = remaining * weight / totalWeight;
    const floor = Math.floor(exact);
    return { type, quota: floor, remainder: exact - floor, order };
  });
  let unallocated = remaining - rows.reduce((sum, row) => sum + row.quota, 0);
  for (const row of rows.slice().sort((a, b) => b.remainder - a.remainder || a.order - b.order)) {
    if (!unallocated) break;
    row.quota += 1;
    unallocated -= 1;
  }
  for (const row of rows) quotas.set(row.type, (quotas.get(row.type) || 0) + row.quota);
  return Object.fromEntries(quotas);
}
function expectedLessonTopicTag(lesson) {
  return lesson?.topicTag || String(lesson?.id || '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}
function filterQuestionPool(pool, scope) {
  const lessonsById = scope.lessonsById instanceof Map ? scope.lessonsById : new Map();
  return pool.filter((question) => {
    const lesson = lessonsById.get(question.lessonId);
    return Boolean(lesson)
      && Number(question.grade) === Number(scope.grade)
      && question.programCode === scope.programCode
      && question.subjectCode === scope.subjectCode
      && question.topicTag === expectedLessonTopicTag(lesson)
      && question.contentStatus !== 'retired';
  });
}
function selectQuestionPaper(pool, type, excludedQuestionIds = [], random = Math.random) {
  const requested = QUESTION_COUNTS[type] || QUESTION_COUNTS.practice;
  const dedupedPool = [...new Map((pool || []).map((item) => [item.questionId || item.id, item])).values()];
  const count = Math.min(requested, dedupedPool.length);
  if (!count) return [];
  const excluded = new Set(excludedQuestionIds);
  const quota = getTypeQuota(count);
  const selected = [];
  const selectedIds = new Set();
  for (const [questionType] of QUESTION_TYPE_WEIGHTS) {
    const need = quota[questionType] || 0;
    if (!need) continue;
    const all = dedupedPool.filter((item) => item.type === questionType && !selectedIds.has(item.questionId || item.id));
    const fresh = all.filter((item) => !excluded.has(item.questionId || item.id));
    const chosen = shuffled(fresh.length >= need ? fresh : all, random).slice(0, need);
    for (const item of chosen) {
      selected.push({ ...item });
      selectedIds.add(item.questionId || item.id);
    }
  }
  if (selected.length < count) {
    const all = dedupedPool.filter((item) => !selectedIds.has(item.questionId || item.id));
    const fresh = all.filter((item) => !excluded.has(item.questionId || item.id));
    for (const item of shuffled(fresh.length >= count - selected.length ? fresh : all, random).slice(0, count - selected.length)) {
      selected.push({ ...item });
      selectedIds.add(item.questionId || item.id);
    }
  }
  const targetLessons = [...new Set(dedupedPool.map((item) => item.lessonId).filter(Boolean))];
  for (const lessonId of targetLessons) {
    if (selected.some((item) => item.lessonId === lessonId)) continue;
    const replacementPool = dedupedPool.filter((item) => item.lessonId === lessonId && !selectedIds.has(item.questionId || item.id));
    const replacement = shuffled(replacementPool, random)[0];
    if (!replacement || !selected.length) continue;
    const slot = selected.findIndex((item) => selected.filter((current) => current.lessonId === item.lessonId).length > 1);
    if (slot < 0) continue;
    selectedIds.delete(selected[slot].questionId || selected[slot].id);
    selected[slot] = { ...replacement };
    selectedIds.add(replacement.questionId || replacement.id);
  }
  const examSeed = crypto.randomBytes(8).toString('hex');
  return shuffled(selected.slice(0, count), random).map((question, index) => {
    const { purpose, active, bankVersion, contentStatus, ...safeStored } = question;
    const options = question.options?.length ? shuffled(question.options, random) : [];
    const orderingItems = question.orderingItems?.length ? shuffled(question.orderingItems, random) : [];
    return { ...safeStored, options, orderingItems, points: Math.round((100 / count) * 100) / 100, examOrder: index + 1, examItemKey: `${examSeed}-${index + 1}` };
  });
}
module.exports = { QUESTION_COUNTS, QUESTION_TYPE_WEIGHTS, getTypeQuota, selectQuestionPaper, shuffled, filterQuestionPool, expectedLessonTopicTag };
