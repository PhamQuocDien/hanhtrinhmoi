'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const CareerQuestionBankItem = require('../../apps/api/src/models/CareerQuestionBankItem');
const { buildCareerQuestionBank } = require('../../content/career-paths/software-development/question-bank');
const careerCatalog = require('../../content/career-paths/catalog');

async function run() {
  if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('<username>') || process.env.MONGO_URI.includes('<cluster-host>')) throw new Error('MONGO_URI chưa được cấu hình; không có câu hỏi nào được nạp.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const records = buildCareerQuestionBank();
  const duplicateIds = records.length - new Set(records.map((item) => item.questionId)).size;
  const duplicatePrompts = records.length - new Set(records.map((item) => `${item.courseId}|${item.lessonId}|${item.prompt}`)).size;
  if (duplicateIds || duplicatePrompts) throw new Error(`Ngân hàng sinh ra có ID trùng ${duplicateIds}, prompt trùng trong cùng bài ${duplicatePrompts}; hủy seed.`);
  const operations = records.map((record) => ({
    updateOne: {
      filter: { questionId: record.questionId },
      update: { $setOnInsert: { ...record, createdAt: new Date(), updatedAt: new Date() } },
      upsert: true
    }
  }));
  let inserted = 0;
  for (let start = 0; start < operations.length; start += 250) {
    const result = await CareerQuestionBankItem.bulkWrite(operations.slice(start, start + 250), { ordered: false });
    inserted += result.upsertedCount || 0;
  }
  const total = await CareerQuestionBankItem.countDocuments();
  const pending = await CareerQuestionBankItem.countDocuments({ active: false });
  console.log(JSON.stringify({ version: 'V8.0.0', groups: careerCatalog.listGroups().length, courses: careerCatalog.listCourses().length, lessons: careerCatalog.getAllCourses().reduce((sum, item) => sum + item.lessonCount, 0), generatedQuestions: records.length, inserted, alreadyPresent: records.length - inserted, totalDatabaseQuestions: total, inactivePendingReview: pending, note: 'Câu hỏi được tạo ở trạng thái inactive; cần giáo viên rà soát trước khi kích hoạt.' }, null, 2));
}
run().catch((error) => { console.error(`Nạp ngân hàng CNTT thất bại: ${error.message}`); process.exitCode = 1; }).finally(async () => { if (mongoose.connection.readyState !== 0) await mongoose.disconnect(); });
