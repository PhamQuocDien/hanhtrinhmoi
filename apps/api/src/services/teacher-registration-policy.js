'use strict';
const { safeEqual } = require('../middleware/security');
const PLACEHOLDER_PREFIXES = ['replace-', 'change_this', '<'];
function isTeacherRegistrationAuthorized(role, suppliedCode, configuredCode) {
  if (role !== 'teacher') return true;
  if (typeof configuredCode !== 'string' || configuredCode.length < 24) return false;
  const normalized = configuredCode.trim().toLowerCase();
  if (PLACEHOLDER_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return safeEqual(suppliedCode, configuredCode);
}
module.exports = { isTeacherRegistrationAuthorized };
