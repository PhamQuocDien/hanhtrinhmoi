'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const User = require('../models/User');
const { validateRegistration } = require('../utils/validation');
const { safeEqual } = require('../middleware/security');
const { recordActivity } = require('../services/activity-log');
const { isTeacherRegistrationAuthorized } = require('../services/teacher-registration-policy');
const { normalizeEmail, canonicalEmailFilter } = require('../utils/email-identity');
const { getDuplicateKeyField } = require('../utils/mongo-errors');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút.' } });

function publicUser(user) {
  return { id: String(user._id || user.id), fullName: user.fullName, email: user.email, role: user.role, school: user.school || '', grade: user.grade || '' };
}

router.get('/me', (req, res) => {
  if (!req.session?.user) return res.json({ authenticated: false, user: null });
  return res.json({ authenticated: true, user: req.session.user });
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const result = validateRegistration(req.body);
    if (!result.valid) return res.status(400).json({ error: 'Vui lòng kiểm tra lại thông tin.', fields: result.errors });
    const { fullName, email, password, role, school, grade } = result.value;
    if (!isTeacherRegistrationAuthorized(role, req.body.teacherRegistrationCode, process.env.TEACHER_REGISTRATION_CODE)) {
      return res.status(403).json({ error: 'Tạo tài khoản giáo viên cần mã mời hợp lệ do quản trị viên cấp.' });
    }
    // Match case/whitespace variants already present in older MongoDB records.
    const existing = await User.findOne(canonicalEmailFilter(email)).select('_id email').lean();
    if (existing) return res.status(409).json({ error: 'Email này đã được sử dụng. Hãy đăng nhập hoặc dùng email khác.', fields: { email: 'Email đã tồn tại.' } });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ fullName, email, passwordHash, role, school, grade });
    const sessionUser = publicUser(user);
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = sessionUser;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        recordActivity(req, { action: 'account.register', targetType: 'user', targetId: sessionUser.id, targetName: sessionUser.email, description: 'Tạo tài khoản thành công.', metadata: { role: sessionUser.role } });
        return res.status(201).json({ message: 'Tạo tài khoản thành công.', user: sessionUser, redirect: role === 'teacher' ? '/teacher.html' : '/survey.html' });
      });
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateField = getDuplicateKeyField(error);
      const mongoose = require('mongoose');
      if (duplicateField === 'username') {
        console.error('[auth.register] Obsolete username unique index remains after migration', { database: mongoose.connection.name || '', collection: User.collection.collectionName });
        return res.status(503).json({ error: 'MongoDB còn chỉ mục username_1 cũ gây xung đột với tài khoản không có username. Hãy kiểm tra log khởi động và chạy npm run migrate:user-indexes trên đúng database.' });
      }
      if (duplicateField === 'email' || /email/i.test(error.message || '')) {
        console.error('[auth.register] Duplicate email index conflict', { keyPattern: error.keyPattern || {}, keyValuePresent: Boolean(error.keyValue), database: mongoose.connection.name || '' });
        return res.status(409).json({ error: 'Email đang xung đột với dữ liệu hoặc chỉ mục trong MongoDB. Nếu tài khoản chưa xuất hiện trong danh sách, quản trị viên hãy chạy Kiểm tra Gmail và npm run repair:emails trên đúng môi trường triển khai.' });
      }
      console.error('[auth.register] Duplicate key conflict', { keyPattern: error.keyPattern || {}, database: mongoose.connection.name || '' });
      return res.status(409).json({ error: 'Dữ liệu đăng ký xung đột với chỉ mục duy nhất trong MongoDB. Hãy kiểm tra log máy chủ để biết trường bị trùng.' });
    }
    return next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password || password.length > 128) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu hợp lệ.' });
    const user = await User.findOne(canonicalEmailFilter(email)).select('+passwordHash');
    if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu chưa chính xác.' });
    }
    const sessionUser = publicUser(user);
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = sessionUser;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        recordActivity(req, { action: 'account.login', targetType: 'user', targetId: sessionUser.id, targetName: sessionUser.email, description: 'Đăng nhập thành công.', metadata: { role: sessionUser.role } });
        return res.json({ message: 'Đăng nhập thành công.', user: sessionUser, redirect: user.role === 'teacher' ? '/teacher.html' : '/dashboard.html' });
      });
    });
  } catch (error) { return next(error); }
});

router.post('/admin/login', authLimiter, (req, res, next) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!configuredPassword || configuredPassword === 'CHANGE_THIS_TO_A_NEW_LONG_RANDOM_PASSWORD') {
    return res.status(503).json({ error: 'Chưa cấu hình ADMIN_PASSWORD an toàn trong môi trường máy chủ.' });
  }
  if (username !== (process.env.ADMIN_USERNAME || 'admin') || !safeEqual(password, configuredPassword)) {
    return res.status(401).json({ error: 'Thông tin quản trị viên chưa chính xác.' });
  }
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = { id: 'env-admin', fullName: 'Quản trị viên', email: process.env.ADMIN_USERNAME || 'admin', role: 'admin' };
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      recordActivity(req, { action: 'admin.login', targetType: 'admin', targetId: 'env-admin', targetName: process.env.ADMIN_USERNAME || 'admin', description: 'Quản trị viên đăng nhập.' });
      return res.json({ message: 'Đăng nhập quản trị thành công.', user: req.session.user, redirect: '/admin.html' });
    });
  });
});

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.json({ message: 'Đã đăng xuất.' });
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.json({ message: 'Đã đăng xuất.' });
  });
});

module.exports = router;
