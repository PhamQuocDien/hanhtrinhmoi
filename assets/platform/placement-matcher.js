'use strict';
(function exposePlacementMatcher(root) {
    function normalize(value) {
        return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    function textList(value) {
        return (Array.isArray(value) ? value : value == null || value === '' ? [] : [value])
            .map(item => item && typeof item === 'object' ? item.value ?? item.label ?? item.text ?? item.name ?? '' : item)
            .map(item => String(item ?? '').trim()).filter(Boolean);
    }
    function getAge(education = {}, learning = {}, survey = {}) {
        const raw = learning?.profile?.dob ?? learning?.dob ?? education?.dob ?? survey?.dob ?? learning?.profile?.birthDate ?? education?.birthDate;
        if (Number.isFinite(Number(learning?.age))) return Number(learning.age);
        if (Number.isFinite(Number(education?.age))) return Number(education.age);
        let year, month, day;
        if (raw && typeof raw === 'object') { year = Number(raw.year); month = Number(raw.month); day = Number(raw.day); }
        else if (typeof raw === 'string') { const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (match) [, year, month, day] = match.map(Number); }
        if (![year, month, day].every(Number.isInteger)) return null;
        const birth = new Date(year, month - 1, day), now = new Date();
        if (year < 1901 || birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > now) return null;
        const age = now.getFullYear() - year - ((now.getMonth() + 1 < month) || (now.getMonth() + 1 === month && now.getDate() < day) ? 1 : 0);
        return age >= 0 && age <= 120 ? age : null;
    }
    function choosePreferredPlacement(tests = [], education = {}, learning = {}) {
        const survey = learning?.survey || {};
        const testList = Array.isArray(tests) ? tests : [];
        if (!testList.length) return null;
        const searchText = normalize([
            education.educationLevel, education.grade, education.fieldName, education.disciplineGroupName,
            education.majorName, education.specializationName, education.trainingProgramName,
            survey.educationLevel, survey.currentGrade, survey.field, survey.disciplineGroup,
            survey.major, survey.specialization, survey.trainingProgram,
            ...textList(survey.favoriteSubjects), ...textList(survey.subjectInterests),
            ...textList(survey.careerInterests), ...textList(survey.goals), ...textList(learning.goals)
        ].join(' '));
        const declaredExams = [
            ...textList(survey.targetExams), ...textList(survey.target?.exams),
            ...textList(survey.englishGoals?.exams), ...textList(survey.targetExam),
            ...textList(survey.englishGoals?.exam), ...textList(survey.target?.exam)
        ];
        const normalizedExams = [...new Set(declaredExams.map(normalize))];
        const targetMatch = expression => testList.find(test => expression.test(normalize(`${test.target || ''} ${test.code || ''} ${test.title || ''}`)));
        for (const exam of normalizedExams) {
            if (exam.includes('ielts')) { const match = targetMatch(/ielts/); if (match) return match; }
            if (exam.includes('toeic')) { const match = targetMatch(/toeic/); if (match) return match; }
            if (exam.includes('mos') || /\b(word|excel|powerpoint)\b/.test(exam)) { const match = targetMatch(/mos|word|excel|powerpoint/); if (match) return match; }
        }
        if (/\b(ielts)\b/.test(searchText)) { const match = targetMatch(/ielts/); if (match) return match; }
        if (/\b(toeic)\b/.test(searchText)) { const match = targetMatch(/toeic/); if (match) return match; }
        if (/\b(mos|excel|word|powerpoint)\b/.test(searchText)) { const match = targetMatch(/mos|word|excel|powerpoint/); if (match) return match; }
        const rawGrade = education.grade ?? survey.currentGrade;
        const grade = Number(rawGrade);
        if (Number.isInteger(grade) && grade >= 1 && grade <= 12) {
            const exact = testList.find(test => String(test.target || '').toUpperCase() === `K12_GRADE_${grade}` || new RegExp(`K12[-_]G${grade}(?:[-_]|$)`, 'i').test(String(test.code || '')));
            if (exact) return exact;
        }
        const educationLevel = normalize(education.educationLevel || survey.educationLevel || '');
        const isUniversity = /higher education|university|dai hoc|cao dang/.test(educationLevel) || /dai hoc|sinh vien|university/.test(normalize(survey.educationStatus));
        if (isUniversity) {
            const fieldContext = normalize([education.fieldName, education.disciplineGroupName, education.majorName, education.specializationName, education.trainingProgramName, survey.field, survey.disciplineGroup, survey.major, survey.specialization, survey.trainingProgram, ...textList(survey.favoriteSubjects), ...textList(survey.careerInterests)].join(' '));
            if (/kinh te|econom|finance|tai chinh|ke toan|accounting|marketing|logistics|quan tri|business/.test(fieldContext)) { const match = targetMatch(/university economics|economics|kinh te|business/); if (match) return match; }
            if (/co dien tu|mechatronic|tu dong hoa|robot|co khi|dien tu|mechanical/.test(fieldContext)) { const match = targetMatch(/university mechatronics|mechatronic|co dien tu|tu dong hoa|engineering/); if (match) return match; }
            if (/khoa hoc ung dung|applied science|hoa hoc|vat lieu|moi truong|cong nghe thuc pham/.test(fieldContext)) { const match = targetMatch(/university applied sciences|applied sciences|khoa hoc ung dung/); if (match) return match; }
            if (/cong nghe thong tin|lap trinh|programming|software|data science|khoa hoc may tinh|cybersecurity|an toan thong tin/.test(fieldContext)) { const match = targetMatch(/university it|cntt|programming|computer science/); if (match) return match; }
            return null;
        }
        const age = getAge(education, learning, survey);
        const indicatesSchool = /primary|elementary|secondary|high school|trung hoc|pho thong|tieu hoc|thcs|thpt|school/.test(educationLevel) || /school|student|hoc sinh/.test(normalize(survey.educationStatus));
        if ((indicatesSchool || !educationLevel) && age !== null && age >= 6 && age <= 18) {
            const ageGrade = Math.max(1, Math.min(12, age - 5));
            const ageMatch = testList.find(test => String(test.target || '').toUpperCase() === `K12_GRADE_${ageGrade}` || new RegExp(`K12[-_]G${ageGrade}(?:[-_]|$)`, 'i').test(String(test.code || '')));
            if (ageMatch) return ageMatch;
        }
        return targetMatch(/discovery|exploration|kham pha/) || null;
    }
    const api = Object.freeze({ choosePreferredPlacement, normalize, getAge });
    if (root) root.HtmPlacementMatcher = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
