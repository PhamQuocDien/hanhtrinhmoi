'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../../apps/api/src/models/User');
const { removeLegacyUsernameIndexes } = require('../../apps/api/src/services/legacy-user-index-migration');

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<cluster-host>')) {
    throw new Error('MONGO_URI chưa được cấu hình; không thay đổi dữ liệu.');
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, autoIndex: false });
  console.log(`Database đích: ${mongoose.connection.name || '(không xác định)'} · Collection: ${User.collection.collectionName}`);
  const result = await removeLegacyUsernameIndexes(User, console);
  console.log(JSON.stringify({ ...result, collection: User.collection.collectionName, documentsDeleted: 0 }, null, 2));
}

run().catch((error) => {
  console.error(`Migration chỉ mục thất bại: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});
