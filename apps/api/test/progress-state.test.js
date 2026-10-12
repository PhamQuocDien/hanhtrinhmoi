"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { recordPartPosition, wasPartViewed, lastViewedPart, chooseResumePart } = require('../src/services/progress-state');

test('current lesson and part position survives a database-style serialize/rehydrate cycle', () => {
  const progress = { viewedParts: [], completedParts: [], lessons: [] };
  recordPartPosition(progress, 'kntt-g6-math-u1-l1', 'lecture', new Date('2026-10-11T10:00:00Z'));
  recordPartPosition(progress, 'kntt-g6-math-u1-l1', 'guided-practice', new Date('2026-10-11T10:03:00Z'));
  const restored = JSON.parse(JSON.stringify(progress));
  assert.equal(restored.currentLessonId, 'kntt-g6-math-u1-l1');
  assert.equal(lastViewedPart(restored, 'kntt-g6-math-u1-l1'), 'guided-practice');
  assert.equal(wasPartViewed(restored, 'kntt-g6-math-u1-l1', 'lecture'), true);
  assert.equal(restored.viewedParts.find((part) => part.partId === 'lecture').views, 1);
});

test('revisiting a part increments views without erasing the latest course position', () => {
  const progress = { viewedParts: [], completedParts: [], lessons: [] };
  recordPartPosition(progress, 'ctst-g3-vietnamese-u1-l1', 'theory', new Date('2026-10-11T10:00:00Z'));
  recordPartPosition(progress, 'ctst-g3-vietnamese-u1-l1', 'theory', new Date('2026-10-11T10:02:00Z'));
  assert.equal(progress.viewedParts[0].views, 2);
  assert.equal(progress.currentPartId, 'theory');
});


test('resume chọn lại đúng phần đã lưu kể cả khi phần đó đã hoàn thành', () => {
  const parts = [{ id: 'theory' }, { id: 'lecture' }, { id: 'guided-practice' }, { id: 'independent-practice' }];
  const states = [{ passed: true }, { passed: true }, { passed: false }, { passed: false }];
  assert.equal(chooseResumePart(parts, states, 'lecture'), 'lecture');
  assert.equal(chooseResumePart(parts, states, '', 'lecture'), 'lecture');
});

test('resume bỏ qua phần đã lưu nếu phần trước chưa đạt và mở phần kế tiếp hợp lệ', () => {
  const parts = [{ id: 'theory' }, { id: 'lecture' }, { id: 'guided-practice' }, { id: 'independent-practice' }];
  const states = [{ passed: false }, { passed: false }, { passed: false }, { passed: false }];
  assert.equal(chooseResumePart(parts, states, 'independent-practice'), 'theory');
  assert.equal(chooseResumePart(parts, states, ''), 'theory');
});
