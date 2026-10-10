'use strict';

const VALID_QUESTION_TYPES = new Set([
    'single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'numerical',
    'ordering', 'matching', 'essay', 'reading_comprehension', 'listening', 'speaking',
    'image_based', 'coding', 'practical', 'timed_simulation'
]);

function optionValue(option, depth = 0) {
    if (depth > 6 || option === null || option === undefined) return '';
    if (['string', 'number', 'boolean'].includes(typeof option)) return option;
    if (Array.isArray(option)) return option.map(item => optionValue(item, depth + 1)).filter(value => String(value ?? '').trim()).join(' / ');
    if (typeof option === 'object') {
        for (const key of ['value', 'id', 'label', 'text', 'title', 'name', 'content', 'description']) {
            if (option[key] !== undefined && option[key] !== null) {
                const value = optionValue(option[key], depth + 1);
                if (String(value ?? '').trim()) return value;
            }
        }
    }
    return '';
}

function validateOptions(question, index, errors) {
    const type = String(question.type || 'single_choice').toLowerCase();
    const options = Array.isArray(question.options) ? question.options : [];
    const visibleOptions = options.map(optionValue).map(value => String(value ?? '').trim()).filter(Boolean);
    const uniqueOptions = new Set(visibleOptions.map(value => value.toLocaleLowerCase()));
    if (['single_choice', 'multiple_choice'].includes(type) && (visibleOptions.length < 2 || uniqueOptions.size < 2)) {
        errors.push(`Câu ${index + 1}: dạng ${type} cần ít nhất 2 lựa chọn khác nhau.`);
    }
    if (type === 'true_false' && (visibleOptions.length !== 2 || uniqueOptions.size !== 2)) {
        errors.push(`Câu ${index + 1}: dạng true_false chỉ được có 2 lựa chọn hợp lệ.`);
    }
    if (type === 'ordering' && (visibleOptions.length < 2 || uniqueOptions.size < 2)) {
        errors.push(`Câu ${index + 1}: dạng ordering cần ít nhất 2 mục khác nhau.`);
    }
    if (type === 'matching') {
        const pairs = Array.isArray(question.matchingPairs) ? question.matchingPairs : options;
        if (pairs.length < 2) errors.push(`Câu ${index + 1}: dạng matching cần ít nhất 2 cặp/mục.`);
    }
}

function validateSurvey(survey) {
    const errors = [];
    const questions = Array.isArray(survey?.questions) ? survey.questions : [];
    if (!String(survey?.title || '').trim()) errors.push('Thiếu tiêu đề survey.');
    if (!String(survey?.description || '').trim()) errors.push('Thiếu mô tả survey.');
    if (!String(survey?.version || '').trim()) errors.push('Thiếu version survey.');
    if (!questions.length) errors.push('Survey phải có ít nhất một câu hỏi.');
    if (questions.length && !questions.some(question => question?.required === true)) errors.push('Survey phải có ít nhất một câu hỏi bắt buộc.');
    const seen = new Set();
    questions.forEach((question, index) => {
        const code = String(question?.code || question?.id || question?._id || '').trim();
        const normalizedCode = code.toLocaleLowerCase();
        if (!String(question?.prompt || question?.title || '').trim()) errors.push(`Câu ${index + 1}: thiếu nội dung câu hỏi.`);
        if (!code) errors.push(`Câu ${index + 1}: thiếu question code/id.`);
        else if (seen.has(normalizedCode)) errors.push(`Câu ${index + 1}: question code '${code}' bị trùng.`);
        else seen.add(normalizedCode);
        const type = String(question?.type || 'single_choice').toLowerCase();
        if (!VALID_QUESTION_TYPES.has(type)) errors.push(`Câu ${index + 1}: question type '${type}' không hợp lệ.`);
        validateOptions(question || {}, index, errors);
    });
    return { valid: errors.length === 0, status: errors.length ? 'INVALID / NEEDS_REPAIR' : 'VALID', errors, questionCount: questions.length };
}

function validatePlacement(test) {
    const errors = [];
    const sections = Array.isArray(test?.skillSections) ? test.skillSections : [];
    const questions = sections.flatMap(section => Array.isArray(section.questions) ? section.questions : []);
    if (!String(test?.title || test?.name || '').trim()) errors.push('Thiếu tiêu đề placement.');
    if (!String(test?.version || '').trim()) errors.push('Thiếu version placement.');
    if (!sections.length || !questions.length) errors.push('Placement phải có ít nhất một section và một câu hỏi.');
    const seen = new Set();
    questions.forEach((question, index) => {
        const code = String(question?.code || question?.id || '').trim().toLowerCase();
        if (!String(question?.prompt || question?.title || '').trim()) errors.push(`Câu ${index + 1}: thiếu nội dung.`);
        if (!VALID_QUESTION_TYPES.has(String(question?.type || 'single_choice').toLowerCase())) errors.push(`Câu ${index + 1}: question type không hợp lệ.`);
        if (code && seen.has(code)) errors.push(`Câu ${index + 1}: question code/id bị trùng.`);
        if (code) seen.add(code);
        validateOptions(question || {}, index, errors);
    });
    return { valid: errors.length === 0, status: errors.length ? 'INVALID / NEEDS_REPAIR' : 'VALID', errors, questionCount: questions.length };
}

function validatePlacementSubmission(test, questionIds, answers = {}) {
    if (!Array.isArray(questionIds)) return { valid: true, errors: [], selectedQuestionIds: null };
    const sections = Array.isArray(test?.skillSections) ? test.skillSections : [];
    const allQuestions = sections.flatMap(section => (Array.isArray(section.questions) ? section.questions : []).map(question => ({
        ...question,
        _skill: String(section.skill || section.code || section.title || 'GENERAL'),
        _key: String(question.id || question.code || question._id || '')
    })));
    const errors = [];
    const availableIds = new Set(allQuestions.map(question => question._key));
    const submittedIds = questionIds.map(String);
    const uniqueIds = new Set(submittedIds);
    if (uniqueIds.size !== submittedIds.length) errors.push('Danh sách câu hỏi đã làm có mã bị trùng.');
    const unknownIds = submittedIds.filter(id => !availableIds.has(id));
    if (unknownIds.length) errors.push('Có câu hỏi không thuộc bộ placement đang làm.');
    const selected = allQuestions.filter(question => uniqueIds.has(question._key));
    for (const question of selected) {
        const answer = answers?.[question._key];
        const present = Array.isArray(answer) ? answer.length > 0 : answer && typeof answer === 'object' ? Object.values(answer).some(value => String(value ?? '').trim() !== '') : String(answer ?? '').trim() !== '';
        if (question.required !== false && !present) errors.push(`Bạn chưa trả lời câu hỏi ${question._key}.`);
    }
    const coverage = {};
    for (const section of sections) {
        const skill = String(section.skill || section.code || section.title || 'GENERAL');
        const sectionQuestions = (section.questions || []).map(question => String(question.id || question.code || question._id || ''));
        const required = Math.min(2, sectionQuestions.length);
        const answered = sectionQuestions.filter(id => uniqueIds.has(id)).length;
        coverage[skill] = { selected: answered, required };
        if (answered < required) errors.push(`Chưa đủ câu ở kỹ năng “${skill}” (${answered}/${required}). Hãy hoàn thành câu hỏi để kết quả đầu vào đáng tin cậy.`);
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)], selectedQuestionIds: [...uniqueIds].filter(id => availableIds.has(id)), coverage };
}

function questionIsVisible(question, answers = {}) {
    const condition = question?.conditions;
    if (!condition || !condition.field) return true;
    const raw = answers[condition.field];
    const values = (Array.isArray(raw) ? raw : raw === undefined || raw === null || raw === '' ? [] : [raw])
        .map(value => value && typeof value === 'object' ? value.value ?? value.id ?? value.label ?? value.text ?? '' : value)
        .map(value => String(value));
    const accepted = Array.isArray(condition.in) ? condition.in.map(String) : condition.equals !== undefined ? [String(condition.equals)] : [];
    return accepted.length > 0 && values.some(value => accepted.includes(value));
}

function visibleSurveyQuestions(survey, answers = {}) {
    const questions = Array.isArray(survey?.questions) ? survey.questions : [];
    return questions.filter(question => questionIsVisible(question, answers));
}

module.exports = { VALID_QUESTION_TYPES, validateSurvey, validatePlacement, validatePlacementSubmission, questionIsVisible, visibleSurveyQuestions };
