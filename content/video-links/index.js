'use strict';
const fs = require('node:fs');
const path = require('node:path');
const FILE = path.resolve(__dirname, 'video-links.csv');
let cachedMtime = -1;
let cachedRows = new Map();
function parseCsvLine(line) {
  const values = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(value); value = ''; }
    else value += char;
  }
  values.push(value); return values;
}
function loadRows() {
  try {
    const stat = fs.statSync(FILE);
    if (stat.mtimeMs === cachedMtime) return cachedRows;
    const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/).filter(Boolean);
    const map = new Map();
    for (const line of lines.slice(1)) {
      const [programCode, grade, subjectCode, lessonId, videoUrl, videoTitle, status, notes] = parseCsvLine(line);
      if (!programCode || !grade || !subjectCode || !lessonId) continue;
      map.set(`${programCode}|${grade}|${subjectCode}|${lessonId}`, { videoUrl: videoUrl || '', videoTitle: videoTitle || 'Video bài học', status: status || 'placeholder', notes: notes || '' });
    }
    cachedMtime = stat.mtimeMs;
    cachedRows = map;
    return map;
  } catch (_error) { return new Map(); }
}
function getVideoLink({ programCode, grade, subjectCode, lessonId }) {
  return loadRows().get(`${programCode}|${grade}|${subjectCode}|${lessonId}`) || { videoUrl: '', videoTitle: 'Video bài học', status: 'not-configured', notes: 'Bổ sung URL trong content/video-links/video-links.csv.' };
}
function invalidateVideoCache() { cachedMtime = -1; }
module.exports = { getVideoLink, invalidateVideoCache, parseCsvLine };
