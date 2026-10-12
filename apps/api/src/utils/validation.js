'use strict';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set(['student', 'university_student', 'teacher']);
const EDUCATION_LEVELS = new Set(['primary', 'middle_school', 'high_school', 'university', 'other']);
const GOALS = new Set(['school_support', 'entrance_exam', 'university', 'career', 'programming', 'english', 'mos', 'explore']);
const HOURS = new Set(['1-2', '3-5', '6-9', '10+']);
const LEARNING_STYLES = new Set(['reading', 'video', 'practice', 'project', 'mixed']);
const TOPICS = new Set(['cpp', 'javascript', 'css_html', 'java', 'csharp', 'python', 'math', 'english', 'toeic', 'mos', 'soft_skills', 'school_subjects']);
const GENDERS = new Set(['female', 'male', 'other', 'prefer_not_to_say']);
const PROGRAMS = new Set(['ctst', 'kntt', 'canhdieu']);

function cleanString(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateRegistration(body = {}) {
  const fullName = cleanString(body.fullName, 100);
  const email = cleanString(body.email, 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const role = cleanString(body.role, 40);
  const school = cleanString(body.school, 120);
  const grade = cleanString(body.grade, 30);
  const errors = {};
  if (fullName.length < 2) errors.fullName = 'Vui lòng nhập họ và tên (ít nhất 2 ký tự).';
  if (!EMAIL_PATTERN.test(email)) errors.email = 'Email chưa đúng định dạng.';
  if (password.length < 10 || password.length > 128) errors.password = 'Mật khẩu phải từ 10 đến 128 ký tự.';
  if (!ALLOWED_ROLES.has(role)) errors.role = 'Vui lòng chọn đúng nhóm tài khoản.';
  if (school.length > 120 || grade.length > 30) errors.profile = 'Thông tin trường/lớp quá dài.';
  return { valid: Object.keys(errors).length === 0, errors, value: { fullName, email, password, role, school, grade } };
}

function parseBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function calculateAge(birthDate, referenceDate = new Date()) {
  const born = typeof birthDate === 'string' ? parseBirthDate(birthDate) : birthDate;
  if (!born || Number.isNaN(new Date(referenceDate).getTime())) return null;
  const ref = new Date(referenceDate);
  let age = ref.getUTCFullYear() - born.getUTCFullYear();
  if (ref.getUTCMonth() < born.getUTCMonth() || (ref.getUTCMonth() === born.getUTCMonth() && ref.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

function expectedGradeFromBirthDate(birthDate, schoolYear = process.env.SCHOOL_YEAR || `${new Date().getUTCFullYear()}-${new Date().getUTCFullYear() + 1}`) {
  const startYear = Number(String(schoolYear).match(/^(\d{4})/)?.[1]);
  if (!Number.isInteger(startYear)) return null;
  const schoolYearStart = new Date(Date.UTC(startYear, 8, 1));
  const ageAtSchoolStart = calculateAge(birthDate, schoolYearStart);
  if (ageAtSchoolStart === null || ageAtSchoolStart < 4 || ageAtSchoolStart > 100) return null;
  return Math.min(12, Math.max(1, ageAtSchoolStart - 5));
}

function gradeMatchesEducationLevel(educationLevel, grade) {
  if (educationLevel === 'primary') return grade >= 1 && grade <= 5;
  if (educationLevel === 'middle_school') return grade >= 6 && grade <= 9;
  if (educationLevel === 'high_school') return grade >= 10 && grade <= 12;
  return educationLevel === 'university' || educationLevel === 'other';
}

function validateSurvey(body = {}) {
  const educationLevel = cleanString(body.educationLevel, 40);
  const goal = cleanString(body.goal, 40);
  const topics = Array.isArray(body.topics) ? [...new Set(body.topics.filter((item) => typeof item === 'string'))] : [];
  const weeklyHours = cleanString(body.weeklyHours, 10);
  const learningStyle = cleanString(body.learningStyle, 40);
  const currentLevel = cleanString(body.currentLevel, 40);
  const challenges = cleanString(body.challenges, 1000);
  const target = cleanString(body.target, 300);
  const birthDate = cleanString(body.birthDate, 10);
  const gender = cleanString(body.gender, 30);
  const currentSchoolGrade = body.currentSchoolGrade === '' || body.currentSchoolGrade === null || body.currentSchoolGrade === undefined ? null : Number(body.currentSchoolGrade);
  const programCode = cleanString(body.programCode || 'ctst', 20);
  const errors = {};
  const parsedBirthDate = parseBirthDate(birthDate);
  const age = parsedBirthDate ? calculateAge(parsedBirthDate) : null;
  const expectedGrade = parsedBirthDate ? expectedGradeFromBirthDate(birthDate) : null;
  if (!EDUCATION_LEVELS.has(educationLevel)) errors.educationLevel = 'Hãy chọn cấp học hiện tại.';
  if (!GOALS.has(goal)) errors.goal = 'Hãy chọn mục tiêu học tập.';
  if (!topics.length || topics.some((topic) => !TOPICS.has(topic))) errors.topics = 'Hãy chọn ít nhất một lĩnh vực hợp lệ.';
  if (!HOURS.has(weeklyHours)) errors.weeklyHours = 'Hãy chọn thời lượng học mỗi tuần.';
  if (!LEARNING_STYLES.has(learningStyle)) errors.learningStyle = 'Hãy chọn cách học phù hợp.';
  if (!currentLevel || currentLevel.length > 40) errors.currentLevel = 'Hãy chọn trình độ hiện tại.';
  if (!parsedBirthDate || age < 4 || age > 100 || birthDate > new Date().toISOString().slice(0, 10)) errors.birthDate = 'Ngày sinh không hợp lệ hoặc nằm trong tương lai. Vui lòng nhập ngày sinh chính xác.';
  if (!GENDERS.has(gender)) errors.gender = 'Hãy chọn giới tính hoặc chọn “Không muốn trả lời”.';
  if (!PROGRAMS.has(programCode)) errors.programCode = 'Hãy chọn chương trình học hợp lệ.';
  if (['primary', 'middle_school', 'high_school'].includes(educationLevel)) {
    if (!Number.isInteger(currentSchoolGrade) || currentSchoolGrade < 1 || currentSchoolGrade > 12) errors.currentSchoolGrade = 'Hãy chọn lớp hiện tại từ 1 đến 12.';
    else if (!gradeMatchesEducationLevel(educationLevel, currentSchoolGrade)) errors.currentSchoolGrade = 'Lớp hiện tại không khớp cấp học đã chọn. Tiểu học là lớp 1–5, THCS là lớp 6–9, THPT là lớp 10–12.';
  } else if (currentSchoolGrade !== null && (!Number.isInteger(currentSchoolGrade) || currentSchoolGrade < 1 || currentSchoolGrade > 12)) {
    errors.currentSchoolGrade = 'Lớp học không hợp lệ.';
  }
  const gradeAgeMismatch = Number.isInteger(currentSchoolGrade) && expectedGrade !== null && Math.abs(currentSchoolGrade - expectedGrade) > 1;
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      educationLevel, goal, topics, weeklyHours, learningStyle, currentLevel, challenges, target,
      birthDate: parsedBirthDate || null, birthDateText: birthDate, age, gender,
      currentSchoolGrade, programCode, expectedGrade, gradeAgeMismatch
    }
  };
}

module.exports = { ALLOWED_ROLES, validateRegistration, validateSurvey, cleanString, parseBirthDate, calculateAge, expectedGradeFromBirthDate, gradeMatchesEducationLevel, GENDERS, PROGRAMS };
