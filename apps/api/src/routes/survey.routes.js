'use strict';
const express = require('express');
const crypto = require('node:crypto');
const SurveyResponse = require('../models/SurveyResponse');
const PlacementAssessment = require('../models/PlacementAssessment');
const User = require('../models/User');
const { requireLearner } = require('../middleware/security');
const { validateSurvey } = require('../utils/validation');
const curriculum = require('../../../../content/curriculum');
const questionBank = require('../../../../content/question-banks');
const { recordActivity } = require('../services/activity-log');

const router = express.Router();
const QUESTIONS = [
  { key: 'educationLevel', title: 'Bạn đang học ở cấp nào?', type: 'single', options: [
    { value: 'primary', label: 'Tiểu học', hint: 'Lớp 1–5' }, { value: 'middle_school', label: 'THCS', hint: 'Lớp 6–9' }, { value: 'high_school', label: 'THPT', hint: 'Lớp 10–12' }, { value: 'university', label: 'Đại học / Cao đẳng', hint: 'Sinh viên' }, { value: 'other', label: 'Khác', hint: 'Tự học hoặc chuyển ngành' }
  ] },
  { key: 'goal', title: 'Mục tiêu quan trọng nhất của bạn?', type: 'single', options: [
    { value: 'school_support', label: 'Học tốt ở trường' }, { value: 'entrance_exam', label: 'Ôn thi chuyển cấp' }, { value: 'university', label: 'Học đại học / chuyên ngành' }, { value: 'career', label: 'Chuẩn bị nghề nghiệp' }, { value: 'programming', label: 'Học lập trình' }, { value: 'english', label: 'Nâng trình tiếng Anh' }, { value: 'mos', label: 'Chứng chỉ MOS' }, { value: 'explore', label: 'Khám phá lĩnh vực mới' }
  ] },
  { key: 'topics', title: 'Bạn muốn học những lĩnh vực nào?', type: 'multiple', options: [
    { value: 'cpp', label: 'C++ và thuật toán' }, { value: 'javascript', label: 'JavaScript / Web' }, { value: 'css_html', label: 'HTML và CSS' }, { value: 'java', label: 'Java' }, { value: 'csharp', label: 'C# / .NET' }, { value: 'python', label: 'Python / AI / Dữ liệu' }, { value: 'math', label: 'Toán học' }, { value: 'english', label: 'Tiếng Anh' }, { value: 'toeic', label: 'TOEIC' }, { value: 'mos', label: 'MOS / Tin học văn phòng' }, { value: 'soft_skills', label: 'Kỹ năng mềm' }, { value: 'school_subjects', label: 'Môn học phổ thông' }
  ] },
  { key: 'currentLevel', title: 'Bạn tự đánh giá trình độ hiện tại?', type: 'single', options: [
    { value: 'beginner', label: 'Mới bắt đầu' }, { value: 'basic', label: 'Biết cơ bản' }, { value: 'intermediate', label: 'Đã thực hành được' }, { value: 'advanced', label: 'Khá vững, muốn nâng cao' }
  ] },
  { key: 'weeklyHours', title: 'Bạn có thể dành bao nhiêu thời gian mỗi tuần?', type: 'single', options: [
    { value: '1-2', label: '1–2 giờ' }, { value: '3-5', label: '3–5 giờ' }, { value: '6-9', label: '6–9 giờ' }, { value: '10+', label: 'Từ 10 giờ trở lên' }
  ] },
  { key: 'learningStyle', title: 'Cách học nào giúp bạn tiến bộ nhất?', type: 'single', options: [
    { value: 'reading', label: 'Đọc lý thuyết và ghi chú' }, { value: 'video', label: 'Xem bài giảng video' }, { value: 'practice', label: 'Luyện tập từng bài' }, { value: 'project', label: 'Làm dự án thực tế' }, { value: 'mixed', label: 'Kết hợp nhiều cách' }
  ] }
];

router.use(requireLearner);
router.get('/questions', (_req, res) => res.json({ questions: QUESTIONS }));
router.get('/me', async (req, res, next) => {
  try {
    const response = await SurveyResponse.findOne({ user: req.session.user.id }).lean();
    if (response) {
      delete response.user;
      if (response.birthDate) response.birthDateText = new Date(response.birthDate).toISOString().slice(0, 10);
    }
    res.json({ completed: Boolean(response), response });
  } catch (error) { next(error); }
});
router.post('/submit', async (req, res, next) => {
  try {
    const result = validateSurvey(req.body);
    if (!result.valid) return res.status(400).json({ error: 'Vui lòng kiểm tra lại thông tin khảo sát.', fields: result.errors });
    if (process.env.SURVEY_ALLOW_UPDATE === 'false') {
      const existingResponse = await SurveyResponse.exists({ user: req.session.user.id });
      if (existingResponse) return res.status(409).json({ error: 'Khảo sát đã được hoàn thành và hiện không cho phép cập nhật.' });
    }
    const value = result.value;
    const update = {
      ...value,
      birthDate: value.birthDate,
      completedAt: new Date()
    };
    delete update.birthDateText;
    const response = await SurveyResponse.findOneAndUpdate(
      { user: req.session.user.id },
      { $set: update, $setOnInsert: { user: req.session.user.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    delete response.user;
    response.birthDateText = value.birthDateText;
    if (Number.isInteger(value.currentSchoolGrade)) {
      await User.updateOne({ _id: req.session.user.id }, { $set: { grade: `Lớp ${value.currentSchoolGrade}` } });
      req.session.user.grade = `Lớp ${value.currentSchoolGrade}`;
    }
    await recordActivity(req, { action: 'survey.submit', targetType: 'survey', targetId: String(req.session.user.id), targetName: req.session.user.email || '', description: 'Lưu/cập nhật khảo sát đầu vào.', metadata: { educationLevel: value.educationLevel, currentSchoolGrade: value.currentSchoolGrade, age: value.age, topicCount: value.topics.length } });
    const recommendation = buildRecommendation(value);
    res.json({ message: 'Đã lưu khảo sát đầu vào.', completed: true, response, recommendation, placementAvailable: ['primary', 'middle_school', 'high_school'].includes(value.educationLevel) });
  } catch (error) { next(error); }
});

router.post('/placement-test', async (req, res, next) => {
  try {
    const profile = await SurveyResponse.findOne({ user: req.session.user.id }).lean();
    if (!profile) return res.status(409).json({ error: 'Hãy lưu khảo sát đầu vào trước khi bắt đầu kiểm tra kiến thức.' });
    const grade = Number(profile.currentSchoolGrade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12 || !['primary', 'middle_school', 'high_school'].includes(profile.educationLevel)) {
      return res.status(400).json({ error: 'Bài kiểm tra kiến thức phổ thông cần hồ sơ có lớp hiện tại từ 1 đến 12. Với lộ trình nghề nghiệp/đại học, hãy chọn bài đánh giá chuyên ngành khi mô-đun đó được mở.' });
    }
    if (profile.gradeAgeMismatch && req.body.confirmGradeMismatch !== true) {
      return res.status(409).json({ error: `Ngày sinh gợi ý lớp ${profile.expectedGrade}, trong khi hồ sơ chọn lớp ${grade}. Hãy xác nhận lớp đang học trước khi tạo đề.`, requiresGradeConfirmation: true, expectedGrade: profile.expectedGrade, currentGrade: grade });
    }
    const subjectCodes = subjectsForProfile(profile, grade);
    const pool = [];
    const seen = new Set();
    for (const subjectCode of subjectCodes) {
      const course = curriculum.buildCourse(grade, profile.programCode || 'ctst', subjectCode);
      if (!course) continue;
      const allLessons = course.units.flatMap((unit) => unit.lessons);
      const randomizedLessons = shuffle(allLessons).slice(0, Math.min(4, allLessons.length));
      let subjectPool = [];
      for (const lesson of randomizedLessons) {
        subjectPool.push(...questionBank.buildQuestionPool({ programCode: profile.programCode || 'ctst', grade, subjectCode, lesson }).filter((question) => question.purpose === 'assessment' && ['multiple_choice', 'fill_blank'].includes(question.type)));
      }
      subjectPool = shuffle(subjectPool).filter((question) => {
        const id = question.questionId || question.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      pool.push(...subjectPool.slice(0, 4).map((question) => ({ ...question, subjectCode, subjectTitle: course.subjectName })));
    }
    const questions = shuffle(pool).slice(0, 12).map((question, index) => ({
      ...question,
      id: question.questionId || question.id,
      questionId: question.questionId || question.id,
      points: 100 / Math.min(12, pool.length),
      order: index + 1
    }));
    if (questions.length < 6) return res.status(503).json({ error: 'Chưa đủ câu hỏi theo đúng lớp và môn bạn chọn. Quản trị viên cần nạp ngân hàng hoặc rà soát nội dung chương trình.' });
    const placementId = `place-${crypto.randomUUID()}`;
    await PlacementAssessment.create({
      placementId, user: req.session.user.id, grade, ageAtStart: profile.age,
      programCode: profile.programCode || 'ctst', subjects: [...new Set(questions.map((item) => item.subjectCode))], topics: profile.topics,
      questionIds: questions.map((item) => item.id), questionsSnapshot: questions,
      status: 'in_progress', createdAt: new Date()
    });
    await recordActivity(req, { action: 'placement.start', targetType: 'placement-assessment', targetId: placementId, targetName: `Kiểm tra đầu vào lớp ${grade}`, description: 'Tạo đề kiểm tra đầu vào theo tuổi, lớp và lĩnh vực quan tâm.', metadata: { grade, age: profile.age, subjects: [...new Set(questions.map((item) => item.subjectCode))], questionCount: questions.length } });
    return res.status(201).json({
      placementId, grade, age: profile.age, expectedGrade: profile.expectedGrade,
      gradeAgeMismatch: profile.gradeAgeMismatch,
      programCode: profile.programCode,
      subjects: [...new Set(questions.map((item) => ({ code: item.subjectCode, title: item.subjectTitle })))].filter((item, index, all) => all.findIndex((candidate) => candidate.code === item.code) === index),
      questionCount: questions.length,
      message: `Bài kiểm tra được tạo cho lớp ${grade}, từ các môn phù hợp với lựa chọn của bạn. Kết quả chỉ đề xuất điều chỉnh tối đa một lớp; lớp hiện tại không tự đổi.`,
      questions: questions.map(publicPlacementQuestion)
    });
  } catch (error) { next(error); }
});

router.post('/placement-test/:placementId/submit', async (req, res, next) => {
  try {
    const attempt = await PlacementAssessment.findOne({ placementId: req.params.placementId, user: req.session.user.id });
    if (!attempt) return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra của tài khoản này.' });
    if (attempt.status !== 'in_progress') return res.status(409).json({ error: 'Bài kiểm tra này đã được nộp. Hãy tạo lần kiểm tra mới để làm lại.' });
    const incoming = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 30) : [];
    const allowedIds = new Set(attempt.questionsSnapshot.map((question) => String(question.id || question.questionId)));
    const answers = new Map(incoming.filter((item) => item && allowedIds.has(String(item.questionId))).map((item) => [String(item.questionId), String(item.answer ?? '').trim().slice(0, 1000)]));
    let possible = 0;
    let earned = 0;
    const feedback = [];
    for (const question of attempt.questionsSnapshot) {
      const questionId = String(question.id || question.questionId);
      const answer = answers.get(questionId) || '';
      const weight = Number(question.points || 1);
      possible += weight;
      const expected = normalizeAnswer(question.correctAnswer || (question.acceptedAnswers || [])[0] || '');
      const accepted = (question.acceptedAnswers || [question.correctAnswer]).map(normalizeAnswer);
      const correct = question.type === 'multiple_choice' ? normalizeAnswer(answer) === expected : accepted.includes(normalizeAnswer(answer));
      if (correct) earned += weight;
      feedback.push({ questionId, correct, correctAnswer: question.correctAnswer || (question.acceptedAnswers || [])[0] || '', explanation: question.explanation || '' });
    }
    const score = possible ? Math.round(earned / possible * 100) : 0;
    const suggestedGrade = Math.min(12, Math.max(1, attempt.grade + (score >= 85 ? 1 : score < 45 ? -1 : 0)));
    attempt.submittedAnswers = attempt.questionsSnapshot.map((question) => ({ questionId: String(question.id || question.questionId), answer: answers.get(String(question.id || question.questionId)) || '' }));
    attempt.score = score;
    attempt.suggestedGrade = suggestedGrade;
    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    await attempt.save();
    await SurveyResponse.updateOne({ user: req.session.user.id }, { $set: { placementScore: score, recommendedGrade: suggestedGrade, placementCompletedAt: new Date() } });
    await recordActivity(req, { action: 'placement.submit', targetType: 'placement-assessment', targetId: attempt.placementId, targetName: `Kiểm tra đầu vào lớp ${attempt.grade}`, description: 'Nộp bài kiểm tra kiến thức đầu vào.', metadata: { grade: attempt.grade, score, suggestedGrade, questionCount: attempt.questionsSnapshot.length } });
    res.json({ message: score >= 85 ? 'Nền tảng tốt; bạn có thể thử nội dung nâng cao hơn một lớp.' : score < 45 ? 'Nên ôn một số kiến thức nền ở mức thấp hơn một lớp, sau đó kiểm tra lại.' : 'Nền tảng phù hợp với lớp hiện tại; hãy bắt đầu từ các bài theo lộ trình.', score, suggestedGrade, currentGrade: attempt.grade, passed: score >= 70, feedback });
  } catch (error) { next(error); }
});

function subjectsForProfile(profile, grade) {
  const available = new Set(curriculum.subjectsForGrade(grade).map((subject) => subject.code));
  const selected = [];
  const topics = new Set(profile.topics || []);
  const add = (code) => { if (available.has(code) && !selected.includes(code)) selected.push(code); };
  if (topics.has('math')) add('math');
  if (topics.has('english') || topics.has('toeic')) add('english');
  if (topics.has('school_subjects')) {
    add('math'); add(grade <= 5 ? 'vietnamese' : 'literature');
    add('literature'); add('english');
    if (grade >= 6) add(grade >= 10 ? 'history' : 'science');
  }
  if (['cpp', 'javascript', 'css_html', 'java', 'csharp', 'python', 'mos'].some((topic) => topics.has(topic))) {
    add('ict');
    if (!selected.includes('ict')) add('technology');
  }
  if (!selected.length) {
    add('math'); add(available.has('vietnamese') ? 'vietnamese' : 'literature'); add('english');
  }
  return selected.slice(0, 3);
}
function publicPlacementQuestion(question) {
  return { id: String(question.id || question.questionId), type: question.type, prompt: question.prompt, options: (question.options || []).map((option) => typeof option === 'string' ? { value: option, label: option } : { value: String(option.value ?? option.label ?? ''), label: String(option.label ?? option.value ?? '') }), points: question.points, lessonTitle: question.topicTitle || question.lessonTitle || '', subjectTitle: question.subjectTitle || '' };
}
function shuffle(values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = crypto.randomInt(index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}
function normalizeAnswer(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim(); }
function buildRecommendation(value) {
  const parts = [];
  if (value.gradeAgeMismatch) parts.push(`Bạn chọn lớp ${value.currentSchoolGrade}, trong khi tuổi/ngày sinh gợi ý khoảng lớp ${value.expectedGrade}. Bài kiểm tra vẫn theo lớp bạn đang học; hãy xác nhận với phụ huynh/giáo viên nếu thông tin này chưa đúng. Hệ thống không tự chuyển về lớp 1.`);
  else if (Number.isInteger(value.currentSchoolGrade)) parts.push(`Bài kiểm tra đầu vào sẽ bắt đầu ở lớp ${value.currentSchoolGrade}, theo lớp hiện tại bạn đã khai báo; ngày sinh được dùng để kiểm tra tính hợp lý, không tự hạ lớp.`);
  if (value.currentLevel === 'beginner') parts.push('Bắt đầu bằng lộ trình nền tảng, học từng khái niệm nhỏ và làm bài tập ngắn.');
  else if (value.currentLevel === 'basic') parts.push('Ôn nhanh kiến thức cơ bản rồi chuyển dần sang bài tập tổng hợp.');
  else parts.push('Ưu tiên bài tập ứng dụng và dự án tăng dần độ khó.');
  if (value.weeklyHours === '1-2') parts.push('Chia lịch thành các buổi ngắn 20–30 phút để giữ nhịp học đều.');
  else if (value.weeklyHours === '10+') parts.push('Kết hợp học kiến thức, luyện tập và một sản phẩm nhỏ mỗi tuần.');
  if (value.goal === 'career' || value.goal === 'programming') parts.push('Khi danh mục khóa học nghề được mở, ưu tiên lộ trình có dự án và sản phẩm portfolio.');
  return parts;
}
module.exports = router;
