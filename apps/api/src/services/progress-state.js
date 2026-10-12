'use strict';

function recordPartPosition(progress, lessonId, partId, now = new Date()) {
  if (!progress.viewedParts) progress.viewedParts = [];
  const record = progress.viewedParts.find((item) => item.lessonId === lessonId && item.partId === partId);
  if (record) {
    record.views = Math.max(1, Number(record.views || 0)) + 1;
    record.lastViewedAt = now;
  } else {
    progress.viewedParts.push({ lessonId, partId, views: 1, lastViewedAt: now });
  }
  progress.currentLessonId = lessonId;
  progress.currentPartId = partId;
  progress.lastLessonId = lessonId;
  progress.lastPositionAt = now;
  progress.lastActivityAt = now;
  return progress;
}

function wasPartViewed(progress, lessonId, partId) {
  return Boolean((progress?.viewedParts || []).some((item) => item.lessonId === lessonId && item.partId === partId));
}

function lastViewedPart(progress, lessonId) {
  if (progress?.currentLessonId === lessonId && progress.currentPartId) return progress.currentPartId;
  const latest = (progress?.viewedParts || [])
    .filter((item) => item.lessonId === lessonId)
    .sort((a, b) => new Date(b.lastViewedAt || 0) - new Date(a.lastViewedAt || 0))[0];
  return latest?.partId || '';
}

function chooseResumePart(parts, states, persistedPartId = '', localPartId = '') {
  const list = Array.isArray(parts) ? parts : [];
  if (!list.length) return '';
  const progress = Array.isArray(states) ? states : [];
  const candidate = persistedPartId || localPartId;
  const index = list.findIndex((part) => part.id === candidate);
  if (index >= 0 && (index === 0 || progress.slice(0, index).every((state) => Boolean(state?.passed)))) return list[index].id;
  const next = list.findIndex((_part, itemIndex) => !progress[itemIndex]?.passed && (itemIndex === 0 || progress.slice(0, itemIndex).every((state) => Boolean(state?.passed))));
  if (next >= 0) return list[next].id;
  return list[list.length - 1].id;
}

module.exports = { recordPartPosition, wasPartViewed, lastViewedPart, chooseResumePart };
