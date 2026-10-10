'use strict';

const zlib = require('zlib');
const { GRADES, ENGLISH_SKILLS } = require('../config/platform-constants');

function cleanText(value, max = 2000) { return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max); }

function readDocxDocumentXml(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ''), 'base64');
    if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) throw new Error('DOCX không hợp lệ hoặc chưa được giải mã base64.');
    let offset = 0;
    while (offset + 30 <= buffer.length) {
        const signature = buffer.readUInt32LE(offset);
        if (signature === 0x04034b50) {
            const method = buffer.readUInt16LE(offset + 8);
            const compressedSize = buffer.readUInt32LE(offset + 18);
            const nameLength = buffer.readUInt16LE(offset + 26);
            const extraLength = buffer.readUInt16LE(offset + 28);
            const name = buffer.slice(offset + 30, offset + 30 + nameLength).toString('utf8');
            const dataStart = offset + 30 + nameLength + extraLength;
            const data = buffer.slice(dataStart, dataStart + compressedSize);
            if (name === 'word/document.xml') {
                if (method === 0) return data.toString('utf8');
                if (method === 8) return zlib.inflateRawSync(data, { maxOutputLength: 8 * 1024 * 1024 }).toString('utf8');
                throw new Error('DOCX dùng compression method chưa được hỗ trợ.');
            }
            offset = dataStart + compressedSize;
        } else if (signature === 0x02014b50 || signature === 0x06054b50) {
            break;
        } else {
            throw new Error('DOCX zip entry bị hỏng.');
        }
    }
    throw new Error('DOCX không chứa word/document.xml.');
}

function parseDocxRows(input) {
    const xml = readDocxDocumentXml(input);
    const paragraphs = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)].map(match => match[1]);
    return paragraphs.map(paragraph => [...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)].map(match => match[1]).join('')).map(text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()).filter(Boolean).map((prompt, index) => ({ code: `DOCX-${index + 1}`, prompt, type: 'single_choice', options: [], answer: undefined }));
}

function xmlText(value) {
    return String(value || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function extractDocxText(input) {
    const xml = readDocxDocumentXml(input);
    return [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)]
        .map(match => {
            const paragraph = match[1];
            const line = xmlText([...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)].map(part => part[1]).join('')).trim();
            if (!line) return '';
            const style = paragraph.match(/<w:pStyle\b[^>]*w:val=["']([^"']+)["']/i)?.[1] || '';
            const heading = style.match(/^Heading([1-6])$/i);
            if (heading) return `${'#'.repeat(Number(heading[1]))} ${line}`;
            if (/^Title$/i.test(style)) return `# ${line}`;
            if (/^Subtitle$/i.test(style)) return `## ${line}`;
            return line;
        })
        .filter(Boolean).join('\n');
}

function parseQuestionBlocks(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const questions = [];
    let current = null;
    const finish = () => {
        if (!current) return;
        current.prompt = current.prompt.trim();
        current.explanation = String(current.explanation || '').trim();
        current.options = current.options.map(option => ({ label: option.label, value: option.value }));
        if (current.answer !== undefined && current.type === 'multiple_choice' && !Array.isArray(current.answer)) current.answer = String(current.answer).split(/[,;、]/).map(value => value.trim()).filter(Boolean);
        if (current.options.length && !['essay', 'short_answer', 'fill_blank', 'numerical', 'coding', 'practical', 'speaking'].includes(current.type)) {
            current.options = current.options.slice(0, 12);
        }
        if (current.prompt) questions.push(current);
        current = null;
    };
    for (const original of lines) {
        const line = original.trim();
        const questionMatch = line.match(/^(?:Câu|Question|Q)\s*(\d+)\s*[.:)\-]\s*(.+)$/i) || line.match(/^(\d{1,3})[.)]\s+(.{6,})$/);
        if (questionMatch) {
            finish();
            current = { code: `IMPORT-Q${questionMatch[1]}`, prompt: questionMatch[2], type: 'single_choice', options: [], points: 1, difficulty: 'MEDIUM' };
            continue;
        }
        if (!current || !line) continue;
        const optionMatch = line.match(/^([A-H])\s*[).:\-]\s*(.+)$/i) || line.match(/^\(([A-H])\)\s*(.+)$/i);
        if (optionMatch) { current.options.push({ label: optionMatch[1].toUpperCase(), value: optionMatch[2].trim() }); continue; }
        const typeMatch = line.match(/^(?:Dạng|Loại câu hỏi|Type)\s*:\s*(.+)$/i);
        if (typeMatch) {
            const rawType = typeMatch[1].toLowerCase().trim();
            const aliases = {
                'trắc nghiệm': 'single_choice', 'trắc nghiệm một đáp án': 'single_choice',
                'trắc nghiệm nhiều đáp án': 'multiple_choice', 'nhiều đáp án': 'multiple_choice',
                'đúng sai': 'true_false', 'đúng/sai': 'true_false', 'điền khuyết': 'fill_blank',
                'điền vào chỗ trống': 'fill_blank', 'trả lời ngắn': 'short_answer', 'tự luận': 'essay',
                'ghép đôi': 'matching', 'nối cột': 'matching', 'sắp xếp': 'ordering', 'đọc hiểu': 'reading_comprehension',
                'nghe': 'listening', 'nói': 'speaking', 'lập trình': 'coding', 'viết code': 'coding', 'thực hành': 'practical'
            };
            const value = aliases[rawType] || rawType.replace(/[\s-]+/g, '_');
            const allowed = ['single_choice','multiple_choice','true_false','fill_blank','short_answer','numerical','ordering','matching','essay','reading_comprehension','listening','speaking','image_based','coding','practical','timed_simulation'];
            if (allowed.includes(value)) current.type = value;
            continue;
        }
        const answerMatch = line.match(/^(?:Đáp án|Đáp án đúng|Answer|Correct answer)\s*[:：]\s*(.+)$/i);
        if (answerMatch) {
            let answer = answerMatch[1].trim();
            if (current.options.length) {
                const labels = answer.split(/[,;、]/).map(value => value.trim().replace(/[.)]$/, '').toUpperCase());
                const selected = current.options.filter(option => labels.includes(String(option.label).toUpperCase()));
                if (selected.length) answer = current.type === 'multiple_choice' ? selected.map(option => option.value) : selected[0].value;
            }
            if (/^(đúng|true)$/i.test(answer)) answer = true;
            else if (/^(sai|false)$/i.test(answer)) answer = false;
            current.answer = answer;
            continue;
        }
        const explanationMatch = line.match(/^(?:Giải thích|Explanation|Lời giải)\s*[:：]\s*(.+)$/i);
        if (explanationMatch) { current.explanation = explanationMatch[1]; continue; }
        if (current.prompt.length < 4500 && !/^(?:Hướng dẫn|Chương|Bài|Unit)\s*\d*/i.test(line)) current.prompt += `\n${line}`;
    }
    finish();
    return questions;
}

function parseLearningDocument({ text = '', filename = '', targetType = 'AUTO' } = {}) {
    const normalized = String(text || '').replace(/\r/g, '').replace(/\u0000/g, '').slice(0, 240000);
    const lines = normalized.split('\n');
    const headings = [];
    const sections = [];
    let active = { title: 'Nội dung', level: 0, lines: [] };
    const headingPattern = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;
    const lessonHeading = /^\s*(Chương\s+\d+|Bài\s+\d+|Unit\s+\d+|Part\s+\d+|Lý thuyết|Bài giảng|Ví dụ|Luyện tập|Thực hành|Câu hỏi|Đáp án|Giải thích|Tổng kết|Mục tiêu)\s*[:.\-]?\s*(.*)$/i;
    for (const line of lines) {
        const markdownHeading = line.match(headingPattern);
        const structuredHeading = !markdownHeading && line.match(lessonHeading);
        if (markdownHeading || structuredHeading) {
            if (active.lines.length || active.title !== 'Nội dung') sections.push({ title: active.title, level: active.level, content: active.lines.join('\n').trim() });
            const title = markdownHeading ? markdownHeading[2].trim() : `${structuredHeading[1]} ${structuredHeading[2] || ''}`.trim();
            active = { title, level: markdownHeading ? markdownHeading[1].length : 2, lines: [] };
            headings.push(title);
        } else active.lines.push(line);
    }
    if (active.lines.length || active.title !== 'Nội dung') sections.push({ title: active.title, level: active.level, content: active.lines.join('\n').trim() });
    const questions = parseQuestionBlocks(normalized);
    const autoType = questions.length > 0 ? 'QUESTION_BANK' : headings.some(title => /khóa học|course|đề cương/i.test(title)) ? 'COURSE' : 'LESSON';
    const resolvedType = ['COURSE','LESSON','LECTURE','QUESTION_BANK','ASSESSMENT'].includes(String(targetType).toUpperCase()) ? String(targetType).toUpperCase() : autoType;
    const titleHeading = lines.find(line => /^\s*#\s+/.test(line)) || lines.find(line => line.trim() && !/^(chương|bài|unit|part)\s+\d+/i.test(line.trim()));
    const title = String(titleHeading || filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') || 'Nội dung nhập mới').replace(/^\s*#+\s*/, '').trim().slice(0, 180);
    const words = normalized.trim() ? normalized.trim().split(/\s+/).length : 0;
    const warnings = [];
    if (!normalized.trim()) warnings.push('Tài liệu chưa có văn bản có thể nhận diện.');
    if (['QUESTION_BANK','ASSESSMENT'].includes(resolvedType) && !questions.length) warnings.push('Chưa nhận diện được câu hỏi. Hãy dùng định dạng “Câu 1: …”, các lựa chọn “A. …” và “Đáp án: A”.');
    if (['QUESTION_BANK','ASSESSMENT'].includes(resolvedType) && questions.some(question => question.options.length && question.answer === undefined)) warnings.push('Có câu trắc nghiệm thiếu đáp án; hãy bổ sung trước khi công bố.');
    if (words < 100 && ['COURSE','LESSON','LECTURE'].includes(resolvedType)) warnings.push('Nội dung khá ngắn; nên bổ sung lý thuyết, ví dụ và hoạt động luyện tập.');
    return { title, extractedText: normalized.trim(), sections: sections.filter(section => section.content || section.title).slice(0, 80), headings: headings.slice(0, 80), questions, wordCount: words, detectedType: autoType, targetType: resolvedType, warnings, parser: 'builtin-docx-markdown-v21' };
}

function calculateObjectiveScore({ correct = 0, total = 0, points = 0, maxPoints = 0 } = {}) {
    const denominator = Number(maxPoints) > 0 ? Number(maxPoints) : Number(total);
    const numerator = Number(maxPoints) > 0 ? Number(points) : Number(correct);
    if (!Number.isFinite(denominator) || denominator <= 0) return { raw: 0, percentage: 0 };
    const percentage = Math.max(0, Math.min(100, (numerator / denominator) * 100));
    return { raw: numerator, percentage: Number(percentage.toFixed(2)) };
}

function scoreObjectiveQuestions(questions = [], answers = {}) {
    let correct = 0;
    let earnedPoints = 0;
    let maxPoints = 0;
    const details = questions.map(question => {
        const points = Math.max(0, Number(question.points) || 1);
        maxPoints += points;
        const chosen = answers?.[String(question._id)] ?? answers?.[question.code];
        const evaluation = structuredQuestionScore(question, chosen);
        const isCorrect = !evaluation.requiresReview && evaluation.isCorrect;
        if (isCorrect) {
            correct += 1;
            earnedPoints += points;
        }
        return {
            questionId: question._id,
            code: question.code,
            prompt: question.prompt || '',
            options: Array.isArray(question.options) ? question.options.slice(0, 20) : [],
            correctAnswer: question.answer,
            chosenAnswer: chosen,
            isCorrect,
            points: isCorrect ? points : 0,
            maxPoints: points,
            requiresReview: evaluation.requiresReview,
            gradingStatus: evaluation.status,
            skill: question.skill || '',
            difficulty: question.difficulty || '',
            explanation: question.explanation || ''
        };
    });
    return {
        correct,
        total: questions.length,
        earnedPoints,
        maxPoints,
        percentage: calculateObjectiveScore({ points: earnedPoints, maxPoints }).percentage,
        details,
        requiresReview: details.some(item => item.requiresReview)
    };
}

function normalizeAnswerText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
function valuesEqual(left, right, depth = 0) {
    if (depth > 8) return false;
    if (left === right) return true;
    if (left === null || left === undefined || right === null || right === undefined) return false;
    if (typeof left !== typeof right) {
        const numericPair = (typeof left === 'number' && typeof right === 'string') || (typeof left === 'string' && typeof right === 'number');
        if (numericPair && String(typeof left === 'number' ? right : left).trim() !== '') return Number(left) === Number(right) && Number.isFinite(Number(left)) && Number.isFinite(Number(right));
        return false;
    }
    if (typeof left === 'string') return normalizeAnswerText(left) === normalizeAnswerText(right);
    if (typeof left !== 'object') return left === right;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => valuesEqual(value, right[index], depth + 1));
    }
    for (const key of ['value', 'id', 'code', 'key', 'label', 'text']) {
        if (Object.prototype.hasOwnProperty.call(left, key) && Object.prototype.hasOwnProperty.call(right, key)) return valuesEqual(left[key], right[key], depth + 1);
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && valuesEqual(left[key], right[key], depth + 1));
}
function answerMatchesOption(answer, chosen) {
    if (valuesEqual(answer, chosen)) return true;
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
        for (const key of ['value', 'id', 'code', 'key', 'label', 'text']) {
            if (answer[key] !== undefined && valuesEqual(answer[key], chosen)) return true;
        }
    }
    return false;
}
function answerIdentity(value, depth = 0) {
    if (depth > 8 || value === null || value === undefined) return '';
    if (['string', 'number', 'boolean'].includes(typeof value)) return String(value).trim();
    if (Array.isArray(value)) return value.map(item => answerIdentity(item, depth + 1)).join('|');
    if (typeof value === 'object') {
        for (const key of ['value', 'id', 'code', 'key', 'label', 'text']) {
            if (value[key] !== undefined && value[key] !== null) return answerIdentity(value[key], depth + 1);
        }
        return Object.keys(value).sort().map(key => `${key}:${answerIdentity(value[key], depth + 1)}`).join('|');
    }
    return String(value);
}
function normalizeAnswerArray(value) {
    return (Array.isArray(value) ? value : value == null ? [] : [value]).map(answerIdentity).map(item => item.trim()).sort();
}
function equalUnordered(a, b) {
    const left = normalizeAnswerArray(a);
    const right = normalizeAnswerArray(b);
    return left.length === right.length && left.every((item, index) => normalizeAnswerText(item) === normalizeAnswerText(right[index]));
}
function equalOrdered(a, b) {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    return left.length === right.length && left.every((item, index) => normalizeAnswerText(answerIdentity(item)) === normalizeAnswerText(answerIdentity(right[index])));
}
function localRubricEvaluation(question, chosen) {
    const submitted = chosen && typeof chosen === 'object' && !Array.isArray(chosen)
        ? [chosen.text, chosen.response, chosen.content, chosen.explanation, chosen.summary, chosen.submissionText, chosen.fileName, chosen.url].filter(Boolean).join(' ')
        : String(chosen ?? '');
    const text = submitted.trim();
    if (!text) return { isCorrect: false, scoreRatio: 0, requiresReview: false, status: 'LOCAL_RUBRIC_AUTO', feedback: 'Chưa có nội dung/sản phẩm để chấm; điểm tự động là 0.' };
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
    const normalized = normalize(text);
    const words = normalized.split(/[^a-z0-9+#.]+/).filter(Boolean);
    const promptWords = normalize([question.prompt, question.skill, ...(question.tags || [])].join(' ')).split(/[^a-z0-9+#.]+/).filter(word => word.length >= 4 && !['trong','cua','nhung','duoc','hay','em','mot','theo','khi','bai','task','thuc','hanh','giai','thich','trinh','bay'].includes(word));
    const uniquePromptWords = [...new Set(promptWords)];
    const overlap = uniquePromptWords.length ? uniquePromptWords.filter(word => normalized.includes(word)).length / uniquePromptWords.length : 0.45;
    const detailSignals = ['vi du','buoc','du lieu','ket qua','ly do','bang chung','kiem tra','vi sao','dieu kien','giai phap','conclusion','evidence','test case','output','input','formula','format'].filter(signal => normalized.includes(signal)).length;
    const lengthScore = Math.min(1, words.length / (String(question.type).toLowerCase() === 'essay' ? 90 : 45));
    const structureScore = Math.min(1, detailSignals / (String(question.type).toLowerCase() === 'essay' ? 4 : 3));
    const media = question.media && typeof question.media === 'object' ? question.media : {};
    const rubric = question.rubric && typeof question.rubric === 'object' ? question.rubric : media.rubric && typeof media.rubric === 'object' ? media.rubric : {};
    const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : Array.isArray(rubric) ? rubric : [];
    let criteriaScore = null;
    if (criteria.length) {
        const terms = criteria.map(item => normalize(typeof item === 'string' ? item : `${item.name || item.title || item.criterion || ''} ${item.description || item.expected || ''}`)).map(value => value.split(/[^a-z0-9+#.]+/).filter(word => word.length >= 4)).map(list => [...new Set(list)]).filter(list => list.length);
        if (terms.length) criteriaScore = terms.filter(list => list.some(word => normalized.includes(word))).length / terms.length;
    }
    const relevance = criteriaScore === null ? overlap : criteriaScore * 0.75 + overlap * 0.25;
    let scoreRatio = Math.max(0, Math.min(1, 0.15 + relevance * 0.4 + lengthScore * 0.2 + structureScore * 0.25));
    if (words.length < 8) scoreRatio = Math.min(scoreRatio, 0.25);
    return { isCorrect: scoreRatio >= 0.75, scoreRatio: Number(scoreRatio.toFixed(3)), requiresReview: false, status: 'LOCAL_RUBRIC_AUTO', feedback: scoreRatio >= 0.75 ? 'Bài đã đạt ngưỡng rubric nội bộ. Hãy đọc nhận xét để hoàn thiện hơn.' : scoreRatio >= 0.5 ? 'Bài có một phần nội dung phù hợp; bổ sung bằng chứng, các bước và cách kiểm tra.' : 'Cần trả lời sát yêu cầu hơn, có các bước thực hiện và bằng chứng/kết quả cụ thể.', scoringModel: 'LOCAL_HEURISTIC_RUBRIC_V32', evaluatedAutomatically: true };
}
function structuredQuestionScore(question, chosen) {
    const type = String(question?.type || 'single_choice').toLowerCase();
    const accepted = [question?.answer, ...(Array.isArray(question?.acceptedAnswers) ? question.acceptedAnswers : [])].filter(value => value !== undefined && value !== null);
    if (['essay', 'practical', 'timed_simulation'].includes(type)) return localRubricEvaluation(question, chosen);
    if (['speaking'].includes(type)) return { isCorrect: false, requiresReview: true, status: 'REVIEW_REQUIRED', feedback: 'Cần chuyển giọng nói thành văn bản hoặc chấm phát âm chuyên dụng trước khi tự động chấm.' };
    if (type === 'coding') return { isCorrect: false, requiresReview: true, status: 'EXECUTOR_REQUIRED' };
    if (!accepted.length) return { isCorrect: false, requiresReview: true, status: 'NEEDS_ANSWER_KEY' };
    if (type === 'multiple_choice') return { isCorrect: equalUnordered(chosen, accepted[0]) || accepted.some(value => equalUnordered(chosen, value)), requiresReview: false, status: 'AUTO_SCORED' };
    if (type === 'ordering') return { isCorrect: accepted.some(value => equalOrdered(chosen, value)), requiresReview: false, status: 'AUTO_SCORED' };
    if (type === 'matching') {
        const target = accepted[0];
        const left = chosen && typeof chosen === 'object' && !Array.isArray(chosen) ? chosen : {};
        const keys = Object.keys(target && typeof target === 'object' ? target : {});
        const isCorrect = keys.length === Object.keys(left).length && keys.every(key => valuesEqual(left[key], target[key]) || answerMatchesOption(target[key], left[key]));
        return { isCorrect, requiresReview: false, status: 'AUTO_SCORED' };
    }
    if (type === 'numerical') {
        const expected = Number(question.answer);
        const actual = Number(chosen);
        const tolerance = Number(question?.media?.tolerance ?? question?.tolerance ?? 0);
        return { isCorrect: Number.isFinite(expected) && Number.isFinite(actual) && Math.abs(expected - actual) <= Math.max(0, tolerance), requiresReview: false, status: 'AUTO_SCORED' };
    }
    if (type === 'fill_blank' || type === 'short_answer') {
        const acceptedText = accepted.map(normalizeAnswerText);
        return { isCorrect: acceptedText.includes(normalizeAnswerText(chosen)), requiresReview: false, status: 'AUTO_SCORED' };
    }
    if (type === 'true_false') {
        const actual = typeof chosen === 'boolean' ? chosen : normalizeAnswerText(chosen) === 'true' || normalizeAnswerText(chosen) === 'đúng';
        return { isCorrect: accepted.some(value => (typeof value === 'boolean' ? value : normalizeAnswerText(value) === 'true' || normalizeAnswerText(value) === 'đúng') === actual), requiresReview: false, status: 'AUTO_SCORED' };
    }
    const isCorrect = accepted.some(answer => answerMatchesOption(answer, chosen));
    return { isCorrect, requiresReview: false, status: 'AUTO_SCORED' };
}
async function scoreAssessmentQuestions(questions = [], answers = {}, options = {}) {
    let correct = 0;
    let earnedPoints = 0;
    let maxPoints = 0;
    let requiresReview = false;
    const details = [];
    for (const question of questions) {
        const points = Math.max(0, Number(question.points) || 1);
        maxPoints += points;
        const chosen = answers?.[String(question._id)] ?? answers?.[question.code];
        let evaluation = structuredQuestionScore(question, chosen);
        if (String(question.type || '').toLowerCase() === 'coding') {
            const coding = question?.media?.coding || question?.media || {};
            const publicTests = Array.isArray(coding.publicTestCases) ? coding.publicTestCases : Array.isArray(coding.visibleTestCases) ? coding.visibleTestCases : Array.isArray(coding.samples) ? coding.samples : [];
            const hiddenTests = Array.isArray(coding.hiddenTestCases) ? coding.hiddenTestCases : [];
            const selectedPublic = publicTests.slice(0, Math.min(6, publicTests.length));
            const selectedHidden = hiddenTests.slice(0, Math.min(6, 12 - selectedPublic.length));
            let remaining = Math.max(0, 12 - selectedPublic.length - selectedHidden.length);
            const extraPublic = publicTests.slice(selectedPublic.length, selectedPublic.length + remaining);
            remaining -= extraPublic.length;
            const extraHidden = hiddenTests.slice(selectedHidden.length, selectedHidden.length + remaining);
            const runCases = [...selectedPublic, ...extraPublic, ...selectedHidden, ...extraHidden];
            const publicCount = selectedPublic.length + extraPublic.length;
            const code = typeof chosen === 'object' ? chosen?.code : chosen;
            const language = typeof chosen === 'object' ? chosen?.language : coding.language || question?.media?.language || 'cpp';
            const weightOf = test => Math.max(0.0001, Math.min(100, Number(test?.weight) || 1));
            let earnedWeight = 0;
            let possibleWeight = 0;
            let visibleEarnedWeight = 0;
            let visiblePossibleWeight = 0;
            let hiddenEarnedWeight = 0;
            let hiddenPossibleWeight = 0;
            const visibleResults = [];
            const hiddenResults = [];
            let runnerUnavailable = false;
            let runnerMessage = '';
            let executeCode = options.executeCode;
            if (!executeCode) executeCode = require('./code-runner.js').executeCode;
            for (let index = 0; index < runCases.length; index += 1) {
                const test = runCases[index];
                const isVisible = index < publicCount;
                const weight = weightOf(test);
                possibleWeight += weight;
                if (isVisible) visiblePossibleWeight += weight;
                else hiddenPossibleWeight += weight;
                let run = { status: 'NOT_RUN', stdout: '', stderr: '', runtimeMs: 0 };
                if (String(code || '').trim()) {
                    run = await executeCode({ language, code, stdin: String(test.input || '') });
                    if (['DISABLED', 'SANDBOX_REQUIRED'].includes(run.status) || run.disabled) {
                        runnerUnavailable = true;
                        runnerMessage = run.message || 'Code Runner chưa được cấu hình an toàn.';
                        break;
                    }
                }
                const expectedOutput = String(test.expectedOutput ?? test.output ?? '').trim();
                const actualOutput = String(run.stdout || '').trim();
                const isPassed = String(code || '').trim() && run.status === 'SUCCESS' && normalizeAnswerText(actualOutput) === normalizeAnswerText(expectedOutput);
                if (isPassed) {
                    earnedWeight += weight;
                    if (isVisible) visibleEarnedWeight += weight;
                    else hiddenEarnedWeight += weight;
                }
                if (isVisible) visibleResults.push({ status: run.status, passed: Boolean(isPassed), weight, pointsEarned: isPassed ? weight : 0, expectedOutput, actualOutput, error: run.compileError || run.stderr || '' });
                else hiddenResults.push({ passed: Boolean(isPassed), weight });
            }
            const attempted = !runnerUnavailable && runCases.length > 0;
            const scoreRatio = attempted && possibleWeight > 0 ? earnedWeight / possibleWeight : 0;
            const questionEarnedPoints = points * scoreRatio;
            const allPassed = attempted && scoreRatio >= 1;
            if (attempted) {
                earnedPoints += questionEarnedPoints;
                if (allPassed) correct += 1;
            }
            const needsReview = runnerUnavailable || runCases.length === 0;
            requiresReview = requiresReview || needsReview;
            evaluation = { isCorrect: allPassed, requiresReview: needsReview, status: needsReview ? 'REVIEW_REQUIRED' : 'AUTO_SCORED' };
            details.push({ questionId: question._id, code: question.code, prompt: question.prompt || '', type: question.type, chosenAnswer: chosen, isCorrect: allPassed, points: Number(questionEarnedPoints.toFixed(2)), maxPoints: points, requiresReview: needsReview, gradingStatus: evaluation.status, coding: { status: evaluation.status, message: runnerMessage, scoringModel: 'WEIGHTED_TEST_CASES', scorePercent: Number((scoreRatio * 100).toFixed(2)), earnedPoints: Number(questionEarnedPoints.toFixed(2)), maxPoints: points, visible: { passed: visibleResults.filter(item => item.passed).length, total: visibleResults.length, earnedWeight: Number(visibleEarnedWeight.toFixed(3)), possibleWeight: Number(visiblePossibleWeight.toFixed(3)), results: visibleResults }, hiddenSummary: { passed: hiddenResults.filter(item => item.passed).length, total: hiddenResults.length, earnedWeight: Number(hiddenEarnedWeight.toFixed(3)), possibleWeight: Number(hiddenPossibleWeight.toFixed(3)) } }, skill: question.skill || '', difficulty: question.difficulty || '', explanation: question.explanation || '' });
            continue;
        }
        const scoreRatio = Number.isFinite(Number(evaluation.scoreRatio)) ? Math.max(0, Math.min(1, Number(evaluation.scoreRatio))) : evaluation.isCorrect ? 1 : 0;
        const earnedForQuestion = Number((points * scoreRatio).toFixed(2));
        if (evaluation.isCorrect) correct += 1;
        earnedPoints += earnedForQuestion;
        requiresReview = requiresReview || evaluation.requiresReview;
        details.push({ questionId: question._id, code: question.code, prompt: question.prompt || '', type: question.type, chosenAnswer: chosen, isCorrect: Boolean(evaluation.isCorrect), points: earnedForQuestion, maxPoints: points, scoreRatio, requiresReview: evaluation.requiresReview, gradingStatus: evaluation.status, feedback: evaluation.feedback || '', scoringModel: evaluation.scoringModel || (evaluation.status === 'AUTO_SCORED' ? 'ANSWER_KEY' : ''), evaluatedAutomatically: Boolean(evaluation.evaluatedAutomatically), skill: question.skill || '', difficulty: question.difficulty || '', explanation: question.explanation || '', rubric: evaluation.requiresReview ? question.rubric || {} : undefined });
    }
    return { correct, total: questions.length, earnedPoints, maxPoints, percentage: calculateObjectiveScore({ points: earnedPoints, maxPoints }).percentage, details, requiresReview };
}

function buildAssessmentSkillEvidence(details = [], fallbackSkill = 'GENERAL') {
    const buckets = new Map();
    for (const detail of Array.isArray(details) ? details : []) {
        if (!detail || detail.requiresReview || detail.gradingStatus === 'REVIEW_REQUIRED' || detail.gradingStatus === 'PARTIALLY_SCORED') continue;
        const maxPoints = Number(detail.maxPoints ?? 0);
        if (!(maxPoints > 0)) continue;
        const skill = cleanText(detail.skill || fallbackSkill || 'GENERAL', 120) || 'GENERAL';
        const bucket = buckets.get(skill) || { skill, totalQuestions: 0, scoredQuestions: 0, correct: 0, earnedPoints: 0, maxPoints: 0 };
        bucket.totalQuestions += 1;
        bucket.scoredQuestions += 1;
        bucket.correct += detail.isCorrect ? 1 : 0;
        bucket.earnedPoints += Math.max(0, Math.min(maxPoints, Number(detail.points) || 0));
        bucket.maxPoints += maxPoints;
        buckets.set(skill, bucket);
    }
    const evidence = {};
    const scores = {};
    for (const [skill, bucket] of buckets) {
        const percentage = Number((bucket.earnedPoints / Math.max(1, bucket.maxPoints) * 100).toFixed(2));
        evidence[skill] = { ...bucket, score: percentage };
        scores[skill] = percentage;
    }
    const weakSkills = Object.entries(scores).filter(([, score]) => score < 60).sort((a, b) => a[1] - b[1]).map(([skill]) => skill);
    const strongSkills = Object.entries(scores).filter(([, score]) => score >= 80).map(([skill]) => skill);
    return { scores, evidence, weakSkills, strongSkills };
}

function selectAdaptivePlacementQuestion(test, { answers = {}, askedQuestionIds = [], currentQuestionId = '' } = {}) {
    const sections = (Array.isArray(test?.skillSections) ? test.skillSections : []).map((section, sectionIndex) => ({
        ...section,
        _sectionIndex: sectionIndex,
        questions: (Array.isArray(section.questions) ? section.questions : []).map((question, questionIndex) => ({
            ...question,
            _sectionIndex: sectionIndex,
            _questionIndex: questionIndex,
            _skill: String(section.skill || section.code || section.title || `SKILL_${sectionIndex + 1}`),
            _sectionTitle: String(section.title || section.skill || section.code || `Kỹ năng ${sectionIndex + 1}`),
            _id: String(question.id || question.code || question._id || `${sectionIndex}-${questionIndex}`)
        }))
    }));
    const allQuestions = sections.flatMap(section => section.questions);
    const validQuestionIds = new Set(allQuestions.map(question => question._id));
    const asked = new Set((Array.isArray(askedQuestionIds) ? askedQuestionIds : []).map(String).filter(id => validQuestionIds.has(id)));
    const askedQuestions = allQuestions.filter(question => asked.has(question._id));
    const counts = new Map();
    for (const question of askedQuestions) counts.set(question._skill, (counts.get(question._skill) || 0) + 1);
    const sectionTotals = new Map(sections.map(section => [String(section.skill || section.code || section.title || `SKILL_${section._sectionIndex + 1}`), section.questions.length]));
    const minPerSkill = 2;
    const minimumCoverageComplete = [...sectionTotals].every(([skill, total]) => (counts.get(skill) || 0) >= Math.min(minPerSkill, total));
    const maxQuestions = Math.min(allQuestions.length, Math.max([...sectionTotals.values()].reduce((sum, total) => sum + Math.min(minPerSkill, total), 0), Math.ceil(allQuestions.length * 0.75)));
    const done = asked.size >= allQuestions.length || (minimumCoverageComplete && asked.size >= maxQuestions);
    const current = allQuestions.find(question => question._id === String(currentQuestionId));
    let targetDifficulty = 2;
    if (current) {
        const rawDifficulty = current.difficulty;
        const currentRank = typeof rawDifficulty === 'number' ? Math.max(1, Math.min(3, rawDifficulty)) : /easy|beginner|foundation|cơ bản/i.test(String(rawDifficulty || '')) ? 1 : /hard|advanced|khó|nâng cao/i.test(String(rawDifficulty || '')) ? 3 : current._questionIndex === 0 ? 1 : current._questionIndex === 1 ? 2 : 3;
        const expected = current.answer ?? current.correctAnswer;
        const actual = answers[current._id];
        const normalize = value => (Array.isArray(value) ? value.map(String).sort().join('|') : value && typeof value === 'object' ? Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}:${value}`).join('|') : String(value ?? '')).trim().toLowerCase().replace(/\s+/g, ' ');
        const correct = expected !== undefined && expected !== null && normalize(actual) === normalize(expected);
        targetDifficulty = Math.max(1, Math.min(3, currentRank + (correct ? 1 : -1)));
    }
    const stripPrivate = question => {
        const { answer, correctAnswer, rubric, hiddenTestCases, testCases, expectedOutput, ...safe } = question;
        delete safe._sectionIndex;
        delete safe._questionIndex;
        delete safe._skill;
        delete safe._sectionTitle;
        delete safe._id;
        return { ...safe, id: question._id, code: question._id, skill: question._skill, sectionTitle: question._sectionTitle };
    };
    if (done) return { done: true, nextQuestion: null, askedCount: asked.size, totalQuestions: allQuestions.length, coverage: Object.fromEntries([...sectionTotals].map(([skill,total]) => [skill, { answered: counts.get(skill) || 0, required: Math.min(minPerSkill,total) }])), targetDifficulty };
    const candidates = allQuestions.filter(question => !asked.has(question._id));
    const uncovered = candidates.filter(question => (counts.get(question._skill) || 0) < Math.min(minPerSkill, sectionTotals.get(question._skill) || 0));
    const pool = uncovered.length ? uncovered : candidates;
    const difficultyRank = question => {
        if (typeof question.difficulty === 'number') return Math.max(1, Math.min(3, question.difficulty));
        if (/easy|beginner|foundation|cơ bản/i.test(String(question.difficulty || ''))) return 1;
        if (/hard|advanced|khó|nâng cao/i.test(String(question.difficulty || ''))) return 3;
        return question._questionIndex === 0 ? 1 : question._questionIndex === 1 ? 2 : 3;
    };
    pool.sort((a,b) => {
        const countDiff = (counts.get(a._skill) || 0) - (counts.get(b._skill) || 0);
        if (uncovered.length && countDiff) return countDiff;
        const targetDiff = Math.abs(difficultyRank(a) - targetDifficulty) - Math.abs(difficultyRank(b) - targetDifficulty);
        return targetDiff || a._sectionIndex - b._sectionIndex || a._questionIndex - b._questionIndex;
    });
    return { done: false, nextQuestion: stripPrivate(pool[0]), askedCount: asked.size, totalQuestions: allQuestions.length, coverage: Object.fromEntries([...sectionTotals].map(([skill,total]) => [skill, { answered: counts.get(skill) || 0, required: Math.min(minPerSkill,total) }])), targetDifficulty };
}

function buildPlacementRecommendation({ scores = {}, target = '', deadline = null, availableMinutes = 30 } = {}) {
    const entries = Object.entries(scores).filter(([, value]) => Number.isFinite(Number(value)));
    const weakSkills = entries.filter(([, value]) => Number(value) < 60).sort((a, b) => Number(a[1]) - Number(b[1])).map(([skill]) => skill);
    const strongSkills = entries.filter(([, value]) => Number(value) >= 80).map(([skill]) => skill);
    return { target: cleanText(target, 120), weakSkills, strongSkills, startingPoint: weakSkills[0] || entries[0]?.[0] || 'FOUNDATION', deadline: deadline || null, availableMinutes: Math.max(5, Math.min(600, Number(availableMinutes) || 30)) };
}

function normalizeSurveyResult(questions = [], answers = {}) {
    const clean = value => {
        if (value && typeof value === 'object' && !Array.isArray(value)) return value.value ?? value.label ?? value.text ?? value.name ?? '';
        return value;
    };
    const normalizedCode = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const questionCodeMap = new Map();
    for (const question of questions || []) {
        const code = String(question.code || question.id || question._id || '');
        if (code) questionCodeMap.set(normalizedCode(code), code);
    }
    const rawValue = aliases => {
        const candidates = Array.isArray(aliases) ? aliases : [aliases];
        for (const alias of candidates) {
            const key = questionCodeMap.get(normalizedCode(alias)) || Object.keys(answers || {}).find(candidate => normalizedCode(candidate) === normalizedCode(alias));
            if (key && answers?.[key] !== undefined && answers[key] !== '') return answers[key];
        }
        for (const question of questions || []) {
            const code = normalizedCode(question.code || question.id);
            const prompt = normalizedCode(question.prompt || question.title);
            if (candidates.some(alias => code.includes(normalizedCode(alias)) || prompt.includes(normalizedCode(alias)))) {
                const key = String(question.code || question.id || question._id || '');
                if (key && answers?.[key] !== undefined && answers[key] !== '') return answers[key];
            }
        }
        return undefined;
    };
    const value = aliases => clean(rawValue(aliases));
    const displayValue = aliases => { const raw = rawValue(aliases); if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw.label ?? raw.text ?? raw.name ?? raw.title ?? raw.value ?? raw.id ?? ''; return raw; };
    const referenceId = aliases => { const raw = rawValue(aliases); const candidate = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw.id ?? raw._id ?? raw.value ?? '') : raw; const id = String(candidate ?? '').trim(); return /^[a-f0-9]{24}$/i.test(id) ? id : ''; };
    const values = aliases => {
        const supplied = rawValue(aliases);
        const result = Array.isArray(supplied) ? supplied.map(clean) : supplied === undefined || supplied === null || supplied === '' ? [] : [clean(supplied)];
        return [...new Set(result.map(item => String(item ?? '').trim()).filter(Boolean))];
    };
    const currentGradeValue = Number(value(['currentGrade','grade','gradeLevel','lopHienTai'])) || null;
    const educationLevelValue = String(value(['educationLevel','educationStage','currentLevel','current_level','capHoc','educationStatus','education_status']) || '').trim();
    const goalValues = values(['goals','goal','learningGoal','learningGoals','mucTieu','mucTieuHocTap']);
    const targetExamValues = values(['targetExam','englishGoal','examGoal','exam','kyThiMucTieu']).filter(item => !/không có mục tiêu/i.test(item));
    const targetExam = String(targetExamValues[0] || '').trim().toUpperCase();
    const studyTime = value(['studyTime','dailyStudyMinutes','availableMinutes','thoiGianHoc']) || '';
    const learningStyle = values(['learningStyle','learningFormats','preferredLearningStyle','phongCachHoc']);
    const major = displayValue(['majorName','major','majorId','nganhHoc']) || '';
    const specialization = displayValue(['specializationName','specialization','specializationId','chuyenNganh']) || '';
    const institution = displayValue(['institution','universityName','university','school','truongHoc']) || '';
    const university = displayValue(['universityName','university','universityId']) || institution;
    const faculty = displayValue(['facultyName','faculty','facultyId','khoa']) || '';
    const field = displayValue(['fieldName','field','fieldId','linhVuc']) || '';
    const disciplineGroup = displayValue(['disciplineGroupName','disciplineGroup','disciplineGroupId','nhomNganh']) || '';
    const trainingProgram = displayValue(['trainingProgramName','trainingProgram','trainingProgramId','chuongTrinhDaoTao']) || '';
    const currentGrade = currentGradeValue >= 1 && currentGradeValue <= 12 ? currentGradeValue : null;
    const rawEducationStatus = String(value(['educationStatus','education_status','studyStatus']) || '').trim();
    const statusText = rawEducationStatus.toLowerCase();
    const educationStatus = /sinh viên|cao đẳng|đại học/.test(statusText) ? 'university' : /đang học phổ thông|đang học/.test(statusText) ? 'studying' : /tốt nghiệp|đã tốt nghiệp/.test(statusText) ? 'graduated' : /đi làm|người đi làm/.test(statusText) ? 'working_adult' : /tự học|bổ sung|ôn thi/.test(statusText) ? 'retake_supplement' : rawEducationStatus;
    const result = {
        goals: goalValues,
        preferences: {
            studyTime, learningStyle,
            studyDaysPerWeek: Number(value(['studyDaysPerWeek','daysPerWeek'])) || null,
            preferredTimeOfDay: value(['preferredTimeOfDay','studyPeriod']) || '',
            learningFormats: values(['learningFormats','preferredFormats','learningStyle']),
            accessibilityNeeds: values(['accessibilityNeeds','learningSupportNeeds'])
        },
        educationStatus,
        educationLevel: educationLevelValue,
        currentLevel: educationLevelValue,
        currentGrade,
        institution: String(institution).trim(),
        university: String(university).trim(),
        faculty: String(faculty).trim(),
        field: String(field).trim(),
        disciplineGroup: String(disciplineGroup).trim(),
        major: String(major).trim(),
        specialization: String(specialization).trim(),
        trainingProgram: String(trainingProgram).trim(),
        universityId: referenceId(['universityId','university']),
        facultyId: referenceId(['facultyId','faculty']),
        fieldId: referenceId(['fieldId','field']),
        disciplineGroupId: referenceId(['disciplineGroupId','disciplineGroup']),
        majorId: referenceId(['majorId','major']),
        specializationId: referenceId(['specializationId','specialization']),
        trainingProgramId: referenceId(['trainingProgramId','trainingProgram']),
        cohort: String(value(['cohort','khoaHoc']) || '').trim(),
        academicYear: String(value(['academicYear','namHoc']) || '').trim(),
        semester: String(value(['semester','hocKy']) || '').trim(),
        strengths: values(['strengths','strongSubjects','strengthSkills','diemManh']),
        weaknesses: values(['weaknesses','weakSubjects','weakSkills','diemYeu','canCaiThien']),
        favoriteSubjects: values(['favoriteSubjects','subjects','favoriteSubject','monYeuThich']),
        subjectInterests: values(['subjectInterests','interestAreas','linhVucQuanTam']),
        careerInterests: values(['careerInterests','careers','careerGoal','ngheNghiepQuanTam']),
        skillGoals: values(['skillGoals','targetSkills','skillsToLearn','kyNangMucTieu']),
        englishGoals: {
            exam: targetExam,
            exams: targetExamValues,
            toeic: String(value(['toeicGoal','targetToeicScore','toeicScore']) || '').trim(),
            ielts: String(value(['ieltsGoal','targetIeltsBand','ieltsBand']) || '').trim(),
            targetScore: String(value(['targetScore','examTargetScore','diemMucTieu']) || '').trim(),
            deadline: String(value(['targetDate','deadline','examDate']) || '').trim()
        },
        target: {
            date: String(value(['targetDate','deadline','examDate']) || '').trim(),
            detail: String(value(['focus','targetDetail','target','mucTieuChiTiet']) || '').trim(),
            exam: targetExam,
            exams: targetExamValues,
            score: String(value(['targetScore','examTargetScore','diemMucTieu']) || '').trim()
        },
        studyTime,
        learningStyle: Array.isArray(learningStyle) ? learningStyle : [learningStyle].filter(Boolean),
        targetExams: targetExamValues,
        confidence: String(value(['confidence','selfConfidence','mucTuTin']) || '').trim(),
        raw: answers,
        provenance: { profile: 'USER_DECLARED', learningPreferences: 'USER_DECLARED', fields: Object.fromEntries(['educationLevel','educationStatus','currentGrade','institution','university','faculty','field','disciplineGroup','major','specialization','trainingProgram','cohort','academicYear','semester','goals','strengths','weaknesses','favoriteSubjects','careerInterests','targetExams','studyTime','learningStyle'].filter(key => { const item = ({ educationLevel: educationLevelValue, educationStatus, currentGrade, institution, university, faculty, field, disciplineGroup, major, specialization, trainingProgram, cohort: value(['cohort','khoaHoc']), academicYear: value(['academicYear','namHoc']), semester: value(['semester','hocKy']), goals: goalValues, strengths: values(['strengths','strongSubjects','strengthSkills','diemManh']), weaknesses: values(['weaknesses','weakSubjects','weakSkills','diemYeu','canCaiThien']), favoriteSubjects: values(['favoriteSubjects','subjects','favoriteSubject','monYeuThich']), careerInterests: values(['careerInterests','careers','careerGoal','ngheNghiepQuanTam']), targetExams: targetExamValues, studyTime, learningStyle })[key]; return Array.isArray(item) ? item.length > 0 : item !== undefined && item !== null && String(item).trim() !== ''; }).map(key => [key, 'USER_DECLARED'])), sourceTypes: ['USER_DECLARED', 'AI_INFERRED', 'SYSTEM_DERIVED'], derivedFields: { currentLevel: 'SYSTEM_DERIVED', targetExam: 'SYSTEM_DERIVED', englishGoals: 'SYSTEM_DERIVED' }, inferenceRequiresConfirmation: true }
    };
    return result;
}

function calculateAge(dob, now = new Date()) {
    const year = Number(dob?.year), month = Number(dob?.month), day = Number(dob?.day);
    if (!year || !month || !day) return null;
    const birth = new Date(year, month - 1, day);
    if (Number.isNaN(birth.getTime())) return null;
    let age = now.getFullYear() - year;
    if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age -= 1;
    return age >= 0 && age <= 120 ? age : null;
}

function possibleEducationStage(age) {
    if (!Number.isFinite(Number(age))) return '';
    if (age <= 10) return 'PRIMARY';
    if (age <= 15) return 'SECONDARY_LOWER';
    if (age <= 18) return 'SECONDARY_UPPER';
    return 'HIGHER_EDUCATION';
}

function buildPersonalLearningPlan({ username, educationStage = '', target = {}, survey = {}, placement = {}, goals = [], currentGrade = null, subjectStrengths = [], subjectWeaknesses = [], englishGoals = {}, targetDate = null, version = 1 } = {}) {
    const toList = value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean) : value && typeof value === 'object' ? (Array.isArray(value.items) ? value.items : Array.isArray(value.data) ? value.data : [value.label ?? value.name ?? value.title ?? value.value ?? value.text].filter(Boolean)) : [];
    const scores = placement.scores && typeof placement.scores === 'object' ? placement.scores : {};
    const scoreEntries = Object.entries(scores).map(([skill, raw]) => [String(skill), Math.max(0, Math.min(100, Number(raw) || 0))]);
    const weak = new Set([...toList(subjectWeaknesses), ...toList(placement.weakSkills), ...scoreEntries.filter(([, score]) => score < 60).map(([skill]) => skill)].map(item => String(item).trim()).filter(Boolean));
    const requestedSubjects = toList(survey.favoriteSubjects);
    const surveyGoals = toList(survey.goals);
    const targetExams = [...toList(survey.targetExams), ...toList(survey.englishGoals?.exams), survey.englishGoals?.exam || '', survey.target?.exam || ''];
    const domainGoals = surveyGoals.filter(item => /TOEIC|IELTS|MOS|lập trình|CNTT|chuyên ngành đại học|thực tập|việc làm|kinh tế|cơ điện tử|điện tử|marketing|tài chính|kế toán|logistics|thiết kế/i.test(String(item)) && !/nắm chắc kiến thức ở trường|cải thiện môn\/kỹ năng còn yếu|chuẩn bị thi giữa kỳ\/cuối kỳ|ôn thi chuyển cấp|định hướng nghề nghiệp/i.test(String(item)));
    const educationSubjects = [survey.major, survey.specialization, survey.trainingProgram, survey.field].filter(Boolean);
    const primaryTarget = target && typeof target === 'object' ? target : { name: String(target || '') };
    const candidateNames = [...new Set([...requestedSubjects, ...scoreEntries.map(([skill]) => skill), ...weak, ...toList(survey.skillGoals), ...toList(survey.subjectInterests), ...toList(survey.careerInterests), ...targetExams, ...domainGoals, ...educationSubjects].map(item => String(item || '').trim()).filter(item => item && !/^chưa xác định$/i.test(item)))];
    const subjects = candidateNames.slice(0, 30).map(subject => {
        const scoreEntry = scoreEntries.find(([skill]) => skill.toLowerCase() === subject.toLowerCase());
        const score = scoreEntry ? scoreEntry[1] : null;
        const isWeak = weak.has(subject) || (score !== null && score < 60);
        return {
            subjectId: subject,
            skill: scoreEntry ? subject : '',
            currentScore: score,
            currentLevel: score === null ? (isWeak ? 'FOUNDATION' : 'UNKNOWN') : score < 40 ? 'FOUNDATION' : score < 70 ? 'DEVELOPING' : 'PROFICIENT',
            targetLevel: 'TARGET',
            gap: score === null ? (isWeak ? 'HIGH' : 'UNKNOWN') : score < 40 ? 'CRITICAL' : score < 60 ? 'HIGH' : score < 80 ? 'MEDIUM' : 'LOW',
            priority: score !== null && score < 40 ? 'CRITICAL' : isWeak ? 'HIGH' : score !== null && score < 70 ? 'NORMAL' : 'LOW',
            estimatedMinutes: score !== null && score < 40 ? 240 : isWeak ? 180 : 90,
            mastery: score !== null && score >= 80 ? 'MASTERED' : 'NOT_STARTED',
            courseId: null,
            lessonId: null,
            courseGap: false
        };
    });
    if (!subjects.length && currentGrade && GRADES.includes(Number(currentGrade))) subjects.push({ subjectId: `grade-${currentGrade}-core`, currentLevel: 'FOUNDATION', targetLevel: 'TARGET', gap: 'UNKNOWN', priority: 'NORMAL', estimatedMinutes: 120, mastery: 'NOT_STARTED', courseId: null, lessonId: null, courseGap: true });
    const universityContext = {
        institution: survey.institution || survey.university || '', faculty: survey.faculty || '', field: survey.field || '',
        disciplineGroup: survey.disciplineGroup || '', major: survey.major || '', specialization: survey.specialization || '',
        trainingProgram: survey.trainingProgram || '', cohort: survey.cohort || '', academicYear: survey.academicYear || '', semester: survey.semester || ''
    };
    return {
        username, educationStage: cleanText(educationStage, 80), educationStatus: survey.educationStatus || '', currentGrade: currentGrade && GRADES.includes(Number(currentGrade)) ? Number(currentGrade) : null,
        target: { ...primaryTarget, goals: [...new Set([...toList(goals), ...surveyGoals].map(item => String(item ?? '').trim()).filter(Boolean))], englishGoals: englishGoals && Object.keys(englishGoals).length ? englishGoals : survey.englishGoals || {}, careerInterests: toList(survey.careerInterests) },
        generatedAt: new Date(), version: Number(version) || 1, status: 'ACTIVE', subjects,
        milestones: subjects.map((subject, index) => ({ order: index + 1, title: `Học ${subject.subjectId}`, subjectId: subject.subjectId, status: 'NOT_STARTED', priority: subject.priority, estimatedMinutes: subject.estimatedMinutes })),
        weeklyPlan: subjects.slice().sort((a, b) => ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[a.priority] ?? 4) - ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[b.priority] ?? 4)).slice(0, 7).map((subject, index) => ({ day: index + 1, subjectId: subject.subjectId, minutes: Math.min(120, subject.estimatedMinutes), reason: subject.currentScore === null ? 'Chưa có điểm chẩn đoán; cần đánh giá thêm.' : `Điểm chẩn đoán ${subject.currentScore}%.` })),
        diagnostics: { placement, strengths: subjectStrengths.length ? subjectStrengths : survey.strengths || [], weaknesses: [...weak], targetDate: targetDate || survey.target?.date || null, surveySource: survey.provenance || { profile: 'USER_DECLARED' }, universityContext },
        recommendations: subjects.filter(subject => ['CRITICAL','HIGH'].includes(subject.priority)).map(subject => ({ reason: subject.currentScore === null ? 'Ưu tiên do người học khai báo điểm yếu; cần diagnostic xác nhận.' : `Skill gap phát hiện từ điểm ${subject.currentScore}%.`, subjectId: subject.subjectId, skill: subject.skill || subject.subjectId, action: 'LEARN_PREREQUISITE', courseGap: true, needsPlacement: subject.currentScore === null }))
    };
}

function estimateIeltsBand({ listening = 0, reading = 0, writing = 0, speaking = 0, rubricVersion = 'UNVERIFIED' } = {}) {
    const scores = { listening, reading, writing, speaking };
    const normalized = Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Math.max(0, Math.min(9, Number(value) || 0))]));
    const overall = Number((Object.values(normalized).reduce((sum, value) => sum + value, 0) / 4).toFixed(1));
    return { skillBands: normalized, overallBand: overall, scoreEvidence: { method: 'practice_estimate', rubricVersion }, label: 'Estimated/Diagnostic Band' };
}

function normalizeEnglishSkillScores(scores = {}) {
    return Object.fromEntries(ENGLISH_SKILLS.map(skill => [skill, Math.max(0, Math.min(100, Number(scores[skill]) || 0))]));
}

function buildEnglishSkillProfile(exam, scores = {}, evidence = {}) {
    const normalizedExam = String(exam || '').toUpperCase() === 'IELTS' ? 'IELTS' : 'TOEIC';
    const buckets = new Map();
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const [skill, rawScore] of Object.entries(scores || {})) {
        const label = normalize(skill);
        let canonical = '';
        if (normalizedExam === 'IELTS') {
            if (/listening|nghe/.test(label)) canonical = 'LISTENING';
            else if (/reading|doc hieu/.test(label)) canonical = 'READING';
            else if (/writing|viet/.test(label)) canonical = 'WRITING';
            else if (/speaking|noi/.test(label)) canonical = 'SPEAKING';
        } else if (/part\s*[1-4]|listening|nghe/.test(label)) canonical = 'LISTENING';
        else if (/part\s*[5-7]|reading|grammar|vocabulary|tu vung|ngu phap/.test(label)) canonical = 'READING';
        if (!canonical || !Number.isFinite(Number(rawScore))) continue;
        const values = buckets.get(canonical) || [];
        values.push(Math.max(0, Math.min(100, Number(rawScore))));
        buckets.set(canonical, values);
    }
    const skillProfile = Object.fromEntries([...buckets].map(([skill, values]) => [skill, Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))]));
    const reviewRequiredSkills = Object.entries(evidence || {}).filter(([, value]) => value?.reviewRequired).map(([skill]) => skill);
    return {
        exam: normalizedExam,
        skillProfile,
        partScores: { ...(scores || {}) },
        weakSkills: Object.entries(skillProfile).filter(([, score]) => score < 60).sort((a, b) => a[1] - b[1]).map(([skill]) => skill),
        strongSkills: Object.entries(skillProfile).filter(([, score]) => score >= 80).map(([skill]) => skill),
        reviewRequiredSkills,
        sourceLabel: normalizedExam === 'IELTS' ? 'IELTS diagnostic practice; Writing/Speaking may require manual review' : 'TOEIC diagnostic practice, not an official score',
        scoreEvidence: { method: 'placement_diagnostic', officialScore: false, partialScoresPossible: reviewRequiredSkills.length > 0 }
    };
}

function buildEnglishPlan({ exam, variant = '', scores = {}, target = null } = {}) {
    const normalized = normalizeEnglishSkillScores(scores);
    const weakSkills = Object.entries(normalized).filter(([, score]) => score < 60).sort((a, b) => a[1] - b[1]).map(([skill]) => skill);
    return { exam, variant, target, skillProfile: normalized, weakSkills, strongSkills: Object.entries(normalized).filter(([, score]) => score >= 80).map(([skill]) => skill), sourceLabel: exam === 'IELTS' ? 'Diagnostic/Estimated Band' : 'Practice diagnostic', noOfficialClaim: true };
}

module.exports = { cleanText, readDocxDocumentXml, extractDocxText, parseDocxRows, parseQuestionBlocks, parseLearningDocument, calculateObjectiveScore, scoreObjectiveQuestions, scoreAssessmentQuestions, buildPlacementRecommendation, selectAdaptivePlacementQuestion, buildAssessmentSkillEvidence, normalizeSurveyResult, calculateAge, possibleEducationStage, buildPersonalLearningPlan, estimateIeltsBand, normalizeEnglishSkillScores, buildEnglishSkillProfile, buildEnglishPlan };