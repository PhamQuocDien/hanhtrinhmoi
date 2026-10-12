'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTrustProxyHops, getTrustProxySetting, isProductionEnvironment } = require('../src/config-trust-proxy');
const { isLegacyUniqueUsernameIndex, removeLegacyUsernameIndexes } = require('../src/services/legacy-user-index-migration');
const { getDuplicateKeyField } = require('../src/utils/mongo-errors');

test('Render deployment trusts a single edge proxy even when NODE_ENV is unset', () => {
  const env = { RENDER_EXTERNAL_HOSTNAME: 'example.onrender.com' };
  assert.equal(getTrustProxySetting(env), 1);
  assert.equal(isProductionEnvironment(env), true);
});

test('direct local development does not trust forwarded client IPs by default', () => {
  assert.equal(getTrustProxySetting({ NODE_ENV: 'development' }), false);
  assert.equal(isProductionEnvironment({ NODE_ENV: 'development' }), false);
});

test('production without known proxy does not trust forwarded headers implicitly', () => {
  assert.equal(getTrustProxySetting({ NODE_ENV: 'production' }), false);
  assert.equal(isProductionEnvironment({ NODE_ENV: 'production' }), true);
});

test('explicit proxy hops override detection and are bounded', () => {
  assert.equal(parseTrustProxyHops('0'), false);
  assert.equal(parseTrustProxyHops('1'), 1);
  assert.equal(parseTrustProxyHops('2'), 2);
  assert.equal(getTrustProxySetting({ RENDER_EXTERNAL_HOSTNAME: 'x.onrender.com', TRUST_PROXY_HOPS: '2' }), 2);
  assert.throws(() => parseTrustProxyHops('true'), /số nguyên từ 0 đến 5/);
  assert.throws(() => parseTrustProxyHops('6'), /số nguyên từ 0 đến 5/);
});

test('legacy index detector selects only unique single-field username indexes', () => {
  assert.equal(isLegacyUniqueUsernameIndex({ name: 'username_1', key: { username: 1 }, unique: true }), true);
  assert.equal(isLegacyUniqueUsernameIndex({ name: 'username_1', key: { username: 1 }, unique: false }), false);
  assert.equal(isLegacyUniqueUsernameIndex({ name: 'username_email', key: { username: 1, email: 1 }, unique: true }), false);
});

test('migration drops stale username index only and never deletes documents', async () => {
  const dropped = [];
  const messages = [];
  const fakeUserModel = {
    schema: { path: (name) => name === 'username' ? undefined : {} },
    collection: {
      collectionName: 'users',
      indexes: async () => [
        { name: '_id_', key: { _id: 1 } },
        { name: 'username_1', key: { username: 1 }, unique: true },
        { name: 'username_email', key: { username: 1, email: 1 }, unique: true }
      ],
      dropIndex: async (name) => { dropped.push(name); }
    }
  };
  const result = await removeLegacyUsernameIndexes(fakeUserModel, { warn: (message) => messages.push(message) });
  assert.deepEqual(dropped, ['username_1']);
  assert.deepEqual(result.droppedIndexes, ['username_1']);
  assert.equal(result.reason, 'obsolete-indexes-removed');
  assert.match(messages[0], /no user documents were deleted/);
});

test('migration leaves indexes alone if current schema declares username', async () => {
  let listed = false;
  const fakeUserModel = {
    schema: { path: (name) => name === 'username' ? { instance: 'String' } : undefined },
    collection: { indexes: async () => { listed = true; return []; }, dropIndex: async () => assert.fail('must not drop an index') }
  };
  const result = await removeLegacyUsernameIndexes(fakeUserModel, { warn() {} });
  assert.equal(result.reason, 'username-is-present-in-schema');
  assert.equal(listed, false);
});

test('missing users collection is a safe no-op', async () => {
  const fakeUserModel = {
    schema: { path: () => undefined },
    collection: { indexes: async () => { const error = new Error('ns missing'); error.code = 26; throw error; }, dropIndex: async () => assert.fail('must not drop') }
  };
  const result = await removeLegacyUsernameIndexes(fakeUserModel, { warn() {} });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'users-collection-does-not-exist-yet');
});

test('duplicate key diagnostics identify username index errors precisely', () => {
  assert.equal(getDuplicateKeyField({ code: 11000, keyPattern: { username: 1 } }), 'username');
  assert.equal(getDuplicateKeyField({ code: 11000, message: 'E11000 duplicate key error collection: test.users index: username_1 dup key: { username: null }' }), 'username');
  assert.equal(getDuplicateKeyField({ code: 11000, keyPattern: { email: 1 } }), 'email');
  assert.equal(getDuplicateKeyField({ code: 11000, message: 'other issue' }), '');
});
