'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../../apps/api/src/models/User');
const { normalizeEmail, groupEmailCollisions } = require('../../apps/api/src/utils/email-identity');

async function run() {
  if (!process.env.MONGO_URI || process.env.MONGO_URI.includes('<username>') || process.env.MONGO_URI.includes('<cluster-host>')) {
    throw new Error('MONGO_URI chưa được cấu hình. Không có dữ liệu nào bị thay đổi.');
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const applyChanges = process.argv.includes('--apply');
  console.log(`Database đích: ${mongoose.connection.name || '(không xác định)'} · Chế độ: ${applyChanges ? 'APPLY' : 'DRY RUN'}`);
  const users = await User.find().select('_id email').lean();
  const collisions = groupEmailCollisions(users);
  if (collisions.length) {
    console.error('Dừng trước khi sửa: phát hiện các email trùng sau chuẩn hóa. Hãy xử lý thủ công các tài khoản này trước.');
    for (const group of collisions) console.error(JSON.stringify(group));
    process.exitCode = 2;
    return;
  }
  const operations = users.filter((user) => user.email !== normalizeEmail(user.email)).map((user) => ({
    updateOne: { filter: { _id: user._id }, update: { $set: { email: normalizeEmail(user.email) } } }
  }));
  if (operations.length && !applyChanges) console.log(`DRY RUN: ${operations.length} tài khoản sẽ được chuẩn hóa. Không có dữ liệu nào bị thay đổi. Sao lưu database rồi chạy npm run repair:emails -- --apply để áp dụng.`);
  else if (operations.length) {
    const result = await User.collection.bulkWrite(operations, { ordered: false });
    console.log(`Chuẩn hóa xong ${result.modifiedCount} tài khoản; tổng tài khoản quét: ${users.length}.`);
  } else console.log(`Email đã chuẩn hóa; tổng tài khoản quét: ${users.length}.`);
  const indexes = await User.collection.indexes();
  const uniqueEmailIndex = indexes.find((item) => item.key?.email === 1 && item.unique === true);
  if (!uniqueEmailIndex && applyChanges) {
    await User.collection.createIndex({ email: 1 }, { unique: true, name: 'email_1' });
    console.log('Đã tạo unique index trên email.');
  } else if (!uniqueEmailIndex) console.log('DRY RUN: chưa có unique index email; cần chạy --apply sau khi sao lưu để tạo index.');
  else console.log(`Đã xác nhận unique index email: ${uniqueEmailIndex.name}.`);
}

run().catch((error) => {
  console.error(`Chuẩn hóa email thất bại: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});
