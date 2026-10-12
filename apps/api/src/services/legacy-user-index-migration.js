'use strict';

function isLegacyUniqueUsernameIndex(index) {
  const keys = index && index.key;
  return Boolean(index && index.unique === true && keys && Object.keys(keys).length === 1 && keys.username === 1);
}

function isMissingCollectionError(error) {
  return error?.code === 26 || error?.codeName === 'NamespaceNotFound';
}

async function removeLegacyUsernameIndexes(UserModel, logger = console) {
  if (!UserModel || !UserModel.collection || !UserModel.schema) {
    throw new TypeError('Cần truyền Mongoose User model hợp lệ.');
  }
  // Current account identity is email. Keep any username index if a future schema
  // explicitly adds username back; otherwise a unique { username: 1 } index is stale.
  if (typeof UserModel.schema.path === 'function' && UserModel.schema.path('username')) {
    return { skipped: true, reason: 'username-is-present-in-schema', droppedIndexes: [] };
  }

  let indexes;
  try {
    indexes = await UserModel.collection.indexes();
  } catch (error) {
    if (isMissingCollectionError(error)) {
      return { skipped: true, reason: 'users-collection-does-not-exist-yet', droppedIndexes: [] };
    }
    throw error;
  }

  const legacyIndexes = indexes.filter(isLegacyUniqueUsernameIndex);
  const droppedIndexes = [];
  for (const index of legacyIndexes) {
    try {
      await UserModel.collection.dropIndex(index.name);
      droppedIndexes.push(index.name);
      logger.warn(`[db-migration] Dropped obsolete unique index ${index.name} from ${UserModel.collection.collectionName}; no user documents were deleted.`);
    } catch (error) {
      // Tolerate a concurrent app instance completing this same index-only migration.
      if (error?.code === 27 || error?.codeName === 'IndexNotFound') continue;
      throw new Error(`Không thể gỡ chỉ mục username cũ (${index.name}). Cấp quyền dropIndex cho tài khoản MongoDB hoặc chạy npm run migrate:user-indexes trước khi đăng ký. Chi tiết: ${error.message}`, { cause: error });
    }
  }

  return { skipped: false, reason: legacyIndexes.length ? 'obsolete-indexes-removed' : 'no-obsolete-indexes', droppedIndexes };
}

module.exports = { isLegacyUniqueUsernameIndex, removeLegacyUsernameIndexes };
