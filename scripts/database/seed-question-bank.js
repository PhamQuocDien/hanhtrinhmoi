'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const curriculum = require('../../content/curriculum');
const questionBanks = require('../../content/question-banks');
const QuestionBankItem = require('../../apps/api/src/models/QuestionBankItem');

function parseOptions(args = process.argv.slice(2)) {
  const options = { grades: Array.from({ length: 12 }, (_, index) => index + 1), programs: curriculum.PROGRAMS.map((program) => program.code), subjectCode: '' };
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    const value = args[index + 1];
    if (!name.startsWith('--')) throw new Error(`Tham số không hợp lệ: ${name}`);
    if (!value || value.startsWith('--')) throw new Error(`Thiếu giá trị cho ${name}`);
    index += 1;
    if (name === '--grade') {
      const grade = Number(value);
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error('--grade phải nằm từ 1 đến 12.');
      options.grades = [grade];
    } else if (name === '--program') {
      if (!options.programs.includes(value)) throw new Error('--program chỉ nhận ctst, kntt hoặc canhdieu.');
      options.programs = [value];
    } else if (name === '--subject') {
      if (!/^[a-z_]{2,80}$/.test(value)) throw new Error('--subject phải là mã môn hợp lệ, ví dụ math hoặc history_geo.');
      options.subjectCode = value;
    } else {
      throw new Error(`Tùy chọn không hỗ trợ: ${name}`);
    }
  }
  return options;
}

async function seed() {
  const options = parseOptions();
  const uri = process.env.MONGO_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<cluster-host>')) throw new Error('MONGO_URI chưa được cấu hình. Hãy đặt URI MongoDB trong .env trước khi seed.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  let courseCount = 0;
  let questionCount = 0;
  let operations = [];
  const flush = async () => {
    if (!operations.length) return;
    await QuestionBankItem.bulkWrite(operations, { ordered: false });
    operations = [];
  };
  try {
    for (const grade of options.grades) {
      for (const programCode of options.programs) {
        const program = curriculum.PROGRAMS.find((item) => item.code === programCode);
        const catalog = curriculum.buildCatalog(grade, programCode);
        if (!catalog) throw new Error(`Không tạo được danh mục lớp ${grade}, bộ sách ${programCode}.`);
        const selectedCourses = catalog.courses.filter((course) => !options.subjectCode || course.subjectCode === options.subjectCode);
        if (options.subjectCode && !selectedCourses.length) throw new Error(`Không tìm thấy môn ${options.subjectCode} ở lớp ${grade}, bộ sách ${programCode}.`);
        for (const course of selectedCourses) {
          const records = questionBanks.buildBankRecords(course);
          for (const record of records) {
            const now = new Date();
            operations.push({ updateOne: { filter: { questionId: record.questionId }, update: { $set: { ...record, updatedAt: now }, $setOnInsert: { createdAt: now } }, upsert: true } });
            questionCount += 1;
            if (operations.length >= 500) await flush();
          }
          courseCount += 1;
          process.stdout.write(`Đã dựng ngân hàng: lớp ${grade} · ${program.shortName || program.name} · ${course.subjectName}\n`);
        }
      }
    }
    await flush();
    console.log(`Hoàn tất: ${courseCount} khóa môn, ${questionCount} bản ghi câu hỏi (upsert, không xóa lịch sử).`);
  } finally {
    await mongoose.disconnect();
  }
}
seed().catch((error) => { console.error('Seed ngân hàng câu hỏi thất bại:', error.message); process.exitCode = 1; });
