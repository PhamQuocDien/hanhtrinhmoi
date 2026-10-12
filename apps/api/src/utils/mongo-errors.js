'use strict';

function getDuplicateKeyField(error) {
  const keyPattern = error?.keyPattern;
  if (keyPattern && typeof keyPattern === 'object') {
    const field = Object.keys(keyPattern)[0];
    if (field) return field;
  }
  const message = String(error?.message || '');
  const match = /index:\s+([A-Za-z0-9.$-]+?)_1\s+dup key/i.exec(message);
  return match?.[1] || '';
}

module.exports = { getDuplicateKeyField };
