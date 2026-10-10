'use strict';
const BOOKS = Object.freeze({
    national: { name: 'Chương trình chung quốc gia' },
    ketnoi: { name: 'Kết nối tri thức với cuộc sống' },
    chantrai: { name: 'Chân trời sáng tạo' },
    canhdieu: { name: 'Cánh Diều' }
});
function lessonNumber(lessonId) { return Number(String(lessonId || '').replace(/\D/g, '')) || 0; }
function practicalType(subjectId, lessonId = '') {
    const id = String(subjectId || '').toLowerCase();
    if (/am_nhac|âm_nhạc|amnhac|music/.test(id)) return 'singing';
    if (/mi_thuat|my_thuat|art/.test(id)) return 'drawing';
    if (/nghe_thuat/.test(id)) return lessonNumber(lessonId) % 2 === 1 ? 'singing' : 'drawing';
    return null;
}
function scorePractical(type, metrics = {}) {
    if (type === 'singing') {
        const voicedRatio = Math.max(0, Math.min(1, Number(metrics.voicedRatio) || 0));
        const signal = Math.max(0, Math.min(1, Number(metrics.signal) || 0));
        const pitchStability = Math.max(0, Math.min(1, Number(metrics.pitchStability) || 0));
        const duration = Math.max(0, Math.min(60, Number(metrics.durationSeconds) || 0));
        const score = Math.max(1, Math.min(10, Number((voicedRatio * 3.5 + signal * 2 + pitchStability * 3.5 + Math.min(1, duration / 12)).toFixed(1))));
        return { score, feedback: score > 8 ? 'Đã đạt phần thực hành hát. Giọng có thời lượng, tín hiệu và độ ổn định phù hợp.' : 'Cần hát đủ thời lượng, rõ tiếng, đều hơi và giữ cao độ ổn định hơn.' };
    }
    const coverage = Math.max(0, Math.min(1, Number(metrics.coverage) || 0));
    const strokes = Math.max(0, Math.min(5000, Number(metrics.strokes) || 0));
    const colors = Math.max(0, Math.min(64, Number(metrics.colors) || 0));
    const points = Math.max(0, Math.min(200000, Number(metrics.points) || 0));
    const score = Math.max(1, Math.min(10, Number((Math.min(1, coverage / .18) * 4 + Math.min(1, strokes / 18) * 2 + Math.min(1, colors / 4) * 2 + Math.min(1, points / 220) * 2).toFixed(1))));
    return { score, feedback: score > 8 ? 'Đã đạt phần thực hành vẽ. Bài có bố cục, chi tiết và màu sắc phù hợp.' : 'Cần bổ sung bố cục, nét vẽ, màu sắc và chi tiết để đạt trên 8 điểm.' };
}
module.exports = { BOOKS, practicalType, scorePractical };
