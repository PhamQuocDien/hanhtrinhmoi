'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const curriculum = require('../../../content/curriculum');
const questionBanks = require('../../../content/question-banks');
const lowerBank = require('../../../content/question-banks/lower-secondary/question-bank');
const { selectQuestionPaper, QUESTION_COUNTS, filterQuestionPool, expectedLessonTopicTag } = require('../src/services/assessment-generator');

const PROGRAMS = ['ctst', 'kntt', 'canhdieu'];
const GRADES = [6, 7, 8, 9];
const EXPECTED_SUBJECTS = ['math', 'vietnamese', 'english', 'civic', 'history_geo', 'science', 'technology', 'ict', 'arts', 'pe', 'experience', 'local_education'];

test('THCS lớp 6–9 có danh mục môn và khóa học cho cả ba chương trình sách', () => {
  for (const grade of GRADES) for (const programCode of PROGRAMS) {
    const catalog = curriculum.buildCatalog(grade, programCode);
    assert.ok(catalog, `Không có danh mục grade ${grade} program ${programCode}`);
    assert.equal(catalog.grade, grade);
    assert.equal(catalog.courses.length, EXPECTED_SUBJECTS.length);
    assert.deepEqual(catalog.courses.map((course) => course.subjectCode).sort(), [...EXPECTED_SUBJECTS].sort());
    for (const course of catalog.courses) {
      assert.equal(course.units.length, 4);
      assert.equal(course.lessonCount, 12);
      assert.ok(course.units.every((unit) => unit.lessons.length === 3));
      assert.ok(course.units.every((unit) => unit.lessons.every((lesson) => lesson.id.startsWith(`${programCode}-g${grade}-${course.subjectCode}-`))));
    }
  }
});

test('ngân hàng câu hỏi tách riêng 120 câu đánh giá theo đúng bài, lớp, chương trình và môn', () => {
  for (const grade of GRADES) {
    const course = curriculum.buildCourse(grade, 'kntt', 'math');
    assert.ok(course);
    for (const unit of course.units) for (const lesson of unit.lessons) {
      const pool = questionBanks.buildQuestionPool({ programCode: 'kntt', grade, subjectCode: 'math', lesson });
      const formal = pool.filter((question) => question.purpose === 'assessment');
      assert.equal(formal.length, 120, `${lesson.id} phải có 120 câu đánh giá`);
      assert.deepEqual(formal.reduce((counts, question) => { counts[question.type] = (counts[question.type] || 0) + 1; return counts; }, {}), { multiple_choice: 32, true_false: 16, fill_blank: 16, multiple_select: 8, matching: 8, ordering: 8, short_answer: 16, essay: 16 });
      assert.ok(formal.every((question) => question.grade === grade && question.programCode === 'kntt' && question.subjectCode === 'math' && question.lessonId === lesson.id && question.topicTag === lesson.topicTag && question.topicTitle === lesson.title));
      assert.equal(new Set(formal.map((question) => question.questionId)).size, formal.length, 'questionId phải duy nhất trong mỗi bài');
      const checkpoints = pool.filter((question) => question.purpose === 'checkpoint');
      assert.equal(checkpoints.length, 32);
      assert.equal(new Set(checkpoints.map((question) => question.questionId)).size, 32);
      for (const part of lesson.parts) {
        const partPool = checkpoints.filter((question) => question.partId === part.id);
        assert.equal(partPool.length, 8, `${lesson.id}/${part.id} phải có 8 câu checkpoint`);
        assert.equal(new Set(partPool.map((question) => question.prompt)).size, 8, 'Câu checkpoint trong cùng phần không được trùng nguyên văn');
      }
    }
  }
});


test('mọi chủ đề THCS không thuộc Toán đều ánh xạ tới một mô tả kiến thức chuyên biệt', () => {
  const missing = [];
  for (const grade of GRADES) for (const programCode of PROGRAMS) {
    const catalog = curriculum.buildCatalog(grade, programCode);
    for (const course of catalog.courses) for (const unit of course.units) for (const lesson of unit.lessons) {
      if (course.subjectCode === 'math') continue;
      const tag = lesson.topicTag || lesson.id;
      const candidates = [lowerBank.CONCEPT_FAMILY[course.subjectCode]?.[tag], lowerBank.ALIASES[course.subjectCode]?.[tag], tag];
      if (!candidates.some((candidate) => candidate && lowerBank.CONCEPTS[candidate])) missing.push(`${course.subjectCode}:${tag}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], `Chủ đề chưa có bộ kiến thức riêng: ${missing.join(', ')}`);
});

test('bộ lọc loại bỏ câu sai lớp, bộ sách, môn, bài hoặc nhãn chủ đề', () => {
  const course = curriculum.buildCourse(7, 'kntt', 'math');
  const lesson = course.units[0].lessons[1];
  const map = new Map([[lesson.id, lesson]]);
  const source = questionBanks.buildQuestionPool({ programCode: 'kntt', grade: 7, subjectCode: 'math', lesson }).filter((item) => item.purpose === 'assessment');
  const good = source[0];
  const badTopic = { ...good, questionId: `${good.questionId}-wrong-topic`, id: `${good.id}-wrong-topic`, topicTag: 'fractions' };
  const badGrade = { ...good, questionId: `${good.questionId}-wrong-grade`, id: `${good.id}-wrong-grade`, grade: 8 };
  const badProgram = { ...good, questionId: `${good.questionId}-wrong-program`, id: `${good.id}-wrong-program`, programCode: 'ctst' };
  const badLesson = { ...good, questionId: `${good.questionId}-wrong-lesson`, id: `${good.id}-wrong-lesson`, lessonId: 'kntt-g7-math-u2-l1' };
  const filtered = filterQuestionPool([...source, badTopic, badGrade, badProgram, badLesson], { grade: 7, programCode: 'kntt', subjectCode: 'math', lessonsById: map });
  assert.equal(filtered.length, source.length);
  assert.ok(filtered.every((item) => item.topicTag === expectedLessonTopicTag(lesson)));
  assert.ok(!filtered.some((item) => [badTopic, badGrade, badProgram, badLesson].some((bad) => bad.questionId === item.questionId)));
});

test('ngân hàng tiểu học có 120 câu đánh giá và 8 câu checkpoint độc lập cho mỗi phần học', () => {
  const course = curriculum.buildCourse(2, 'ctst', 'math');
  const lesson = course.units[0].lessons[0];
  const pool = questionBanks.buildQuestionPool({ programCode: 'ctst', grade: 2, subjectCode: 'math', lesson });
  assert.equal(pool.filter((item) => item.purpose === 'assessment').length, 120);
  const checkpoints = pool.filter((item) => item.purpose === 'checkpoint');
  assert.equal(checkpoints.length, 32);
  for (const part of lesson.parts) assert.equal(checkpoints.filter((item) => item.partId === part.id).length, 8);
});


test('checkpoint từng phần là ngân hàng riêng, không dùng lại ID câu của bài kiểm tra và không trùng prompt giữa các phần', () => {
  const course = curriculum.buildCourse(8, 'kntt', 'science');
  const lesson = course.units[0].lessons[0];
  const pool = questionBanks.buildQuestionPool({ programCode: 'kntt', grade: 8, subjectCode: 'science', lesson });
  const formal = pool.filter((item) => item.purpose === 'assessment');
  const checkpoint = pool.filter((item) => item.purpose === 'checkpoint');
  const formalIds = new Set(formal.map((item) => item.questionId));
  assert.equal(formal.length, 120);
  assert.equal(checkpoint.length, 32);
  assert.ok(checkpoint.every((item) => !formalIds.has(item.questionId)));
  for (const part of lesson.parts) {
    const prompts = checkpoint.filter((item) => item.partId === part.id).map((item) => item.prompt);
    assert.equal(new Set(prompts).size, 8);
  }
  for (let left = 0; left < lesson.parts.length; left += 1) for (let right = left + 1; right < lesson.parts.length; right += 1) {
    const a = checkpoint.filter((item) => item.partId === lesson.parts[left].id).map((item) => item.prompt);
    const b = new Set(checkpoint.filter((item) => item.partId === lesson.parts[right].id).map((item) => item.prompt));
    assert.ok(a.every((prompt) => !b.has(prompt)), 'Các phần không dùng chung câu hỏi nguyên văn');
  }
});

test('ngân hàng tiểu học cũng gắn topicTag riêng theo bài thay vì một nhãn dùng chung', () => {
  const course = curriculum.buildCourse(4, 'ctst', 'math');
  const lesson = course.units[0].lessons[0];
  const pool = questionBanks.buildQuestionPool({ programCode: 'ctst', grade: 4, subjectCode: 'math', lesson }).filter((item) => item.purpose === 'assessment');
  assert.ok(pool.length >= 20);
  assert.ok(pool.every((item) => item.topicTag === expectedLessonTopicTag(lesson)));
});

test('đề lấy ngẫu nhiên số câu cần thiết, đủ dạng, không lặp câu và ưu tiên câu chưa làm', () => {
  const course = curriculum.buildCourse(8, 'ctst', 'math');
  const lesson = course.units[0].lessons[1];
  const pool = questionBanks.buildQuestionPool({ programCode: 'ctst', grade: 8, subjectCode: 'math', lesson }).filter((question) => question.purpose === 'assessment');
  const first = selectQuestionPaper(pool, 'lesson', []);
  const second = selectQuestionPaper(pool, 'lesson', first.map((question) => question.questionId));
  assert.equal(first.length, QUESTION_COUNTS.lesson);
  assert.equal(second.length, QUESTION_COUNTS.lesson);
  assert.deepEqual(first.reduce((counts, question) => { counts[question.type] = (counts[question.type] || 0) + 1; return counts; }, {}), { multiple_choice: 1, true_false: 1, fill_blank: 1, multiple_select: 1, matching: 1, ordering: 1, short_answer: 1, essay: 1 });
  assert.equal(new Set(first.map((question) => question.questionId)).size, first.length);
  assert.ok(second.every((question) => !first.some((previous) => previous.questionId === question.questionId)), 'lần làm kế tiếp ưu tiên câu mới khi ngân hàng vẫn đủ câu');
  assert.ok(first.every((question) => question.lessonId === lesson.id && question.topicTag === lesson.topicTag));
});


test('năm đề bài học liên tiếp không lặp câu khi ngân hàng 120 câu vẫn đủ cho 40 vị trí', () => {
  const course = curriculum.buildCourse(6, 'ctst', 'math');
  const lesson = course.units[0].lessons[0];
  const pool = questionBanks.buildQuestionPool({ programCode: 'ctst', grade: 6, subjectCode: 'math', lesson }).filter((question) => question.purpose === 'assessment');
  const seen = new Set();
  const papers = [];
  for (let run = 0; run < 5; run += 1) {
    const paper = selectQuestionPaper(pool, 'lesson', [...seen]);
    assert.equal(paper.length, 8);
    for (const question of paper) {
      assert.ok(!seen.has(question.questionId), `Bị lặp câu ${question.questionId} ở đề ${run + 1}`);
      seen.add(question.questionId);
    }
    papers.push(paper);
  }
  assert.equal(seen.size, 40);
  assert.equal(papers.length, 5);
});

test('đề chương chỉ lấy câu từ các bài thuộc chương đó, không trộn lớp/môn/chủ đề khác', () => {
  const course = curriculum.buildCourse(7, 'canhdieu', 'science');
  const unit = course.units[2];
  const lessons = unit.lessons;
  const pool = lessons.flatMap((lesson) => questionBanks.buildQuestionPool({ programCode: course.programCode, grade: course.grade, subjectCode: course.subjectCode, lesson }).filter((question) => question.purpose === 'assessment'));
  const allowed = new Set(lessons.map((lesson) => lesson.id));
  const paper = selectQuestionPaper(pool, 'chapter', []);
  assert.equal(paper.length, QUESTION_COUNTS.chapter);
  assert.ok(paper.every((question) => allowed.has(question.lessonId)));
  assert.ok(paper.every((question) => question.grade === 7 && question.programCode === 'canhdieu' && question.subjectCode === 'science'));
  assert.ok(new Set(paper.map((question) => question.lessonId)).size >= 2, 'đề chương nên phủ nhiều bài trong chương');
});

test('bộ câu hỏi được tạo không chứa đáp án trong payload công khai', () => {
  const found = curriculum.findLesson({ grade: 6, programCode: 'ctst', subjectCode: 'math', lessonId: 'ctst-g6-math-u1-l2' });
  assert.ok(found);
  const bank = lowerBank.buildQuestionPool({ programCode: 'ctst', grade: 6, subjectCode: 'math', lesson: found.lesson }).find((question) => question.purpose === 'assessment');
  const publicQuestion = curriculum.publicQuestion(bank);
  assert.ok(publicQuestion.prompt);
  assert.equal('correctAnswer' in publicQuestion, false);
  assert.equal('acceptedAnswers' in publicQuestion, false);
  assert.equal('explanation' in publicQuestion, false);
});

test('chủ đề toán trọng tâm sinh dạng câu hỏi phù hợp', () => {
  const cases = [
    [6, 'natural-powers', 'Tính', 'ctst-g6-math-u1-l2'],
    [6, 'fractions', 'Rút gọn phân số', 'ctst-g6-math-u3-l1'],
    [8, 'identities', 'Khai triển', 'ctst-g8-math-u1-l2'],
    [8, 'pythagorean', 'tam giác vuông', 'ctst-g8-math-u3-l3'],
    [9, 'trigonometry', 'sin', 'ctst-g9-math-u3-l1'],
    [9, 'circle-angles', 'Góc ở tâm', 'ctst-g9-math-u3-l3']
  ];
  for (const [grade, topicTag, expected, lessonId] of cases) {
    const found = curriculum.findLesson({ grade, programCode: 'ctst', subjectCode: 'math', lessonId });
    assert.ok(found, `Không có bài ${lessonId}`);
    assert.equal(found.lesson.topicTag, topicTag);
    const pool = lowerBank.buildQuestionPool({ programCode: 'ctst', grade, subjectCode: 'math', lesson: found.lesson });
    assert.ok(pool.some((question) => question.prompt.toLocaleLowerCase('vi-VN').includes(expected.toLocaleLowerCase('vi-VN'))), `${topicTag} thiếu câu phù hợp: ${expected}`);
  }
});
