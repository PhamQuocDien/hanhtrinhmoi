'use strict';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : '';
}

function canonicalEmailFilter(value) {
  const email = normalizeEmail(value);
  return {
    $expr: {
      $eq: [
        { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
        email
      ]
    }
  };
}

function groupEmailCollisions(users = []) {
  const groups = new Map();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) continue;
    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push({ id: String(user._id || user.id || ''), email: user.email });
  }
  return [...groups.entries()].filter(([, rows]) => rows.length > 1).map(([normalizedEmail, rows]) => ({ normalizedEmail, rows }));
}

module.exports = { normalizeEmail, canonicalEmailFilter, groupEmailCollisions };
