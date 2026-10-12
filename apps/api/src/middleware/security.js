'use strict';
const crypto = require('node:crypto');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.csrfToken;
  const headerToken = req.get('x-csrf-token');
  if (!safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'Phiên bảo vệ biểu mẫu đã hết hạn. Vui lòng tải lại trang và thử lại.' });
  }
  return next();
}

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
  return next();
}

function requireLearner(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
  if (!['student', 'university_student'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Khảo sát đầu vào dành cho học sinh và sinh viên.' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== 'admin') return res.status(403).json({ error: 'Bạn không có quyền truy cập.' });
  return next();
}

function requireTeacher(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
  if (req.session.user.role !== 'teacher') return res.status(403).json({ error: 'Chức năng này chỉ dành cho giáo viên.' });
  return next();
}

module.exports = { safeEqual, createCsrfToken, csrfProtection, requireAuth, requireLearner, requireAdmin, requireTeacher };
