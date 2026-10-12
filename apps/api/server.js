'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const User = require('./src/models/User');
const { recordActivity } = require('./src/services/activity-log');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const authRoutes = require('./src/routes/auth.routes');
const surveyRoutes = require('./src/routes/survey.routes');
const adminRoutes = require('./src/routes/admin.routes');
const learningRoutes = require('./src/routes/learning.routes');
const careerRoutes = require('./src/routes/career.routes');
const teacherRoutes = require('./src/routes/teacher.routes');
const assignmentRoutes = require('./src/routes/assignments.routes');
const { createCsrfToken, csrfProtection } = require('./src/middleware/security');
const { getTrustProxySetting, isProductionEnvironment } = require('./src/config-trust-proxy');
const { removeLegacyUsernameIndexes } = require('./src/services/legacy-user-index-migration');

const app = express();
const PORT = Number.parseInt(process.env.PORT, 10) || 10000;
const WEB_ROOT = path.resolve(__dirname, '../web');
const isProduction = isProductionEnvironment(process.env);
const trustProxySetting = getTrustProxySetting(process.env);
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && (!sessionSecret || sessionSecret.length < 32 || sessionSecret.startsWith('replace-'))) {
  throw new Error('SESSION_SECRET must be a strong random value of at least 32 characters in production.');
}
if (isProduction && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.startsWith('CHANGE_THIS'))) {
  throw new Error('Set a new ADMIN_PASSWORD in the deployment environment before production startup.');
}

app.disable('x-powered-by');
// Correct client IP attribution behind Render's edge proxy. Never trust every proxy.
app.set('trust proxy', trustProxySetting);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      styleSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
      mediaSrc: ["'self'", 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', req.path.startsWith('/api') ? 'no-store' : 'no-cache');
  next();
});

const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' } });
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '8.0.4', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', courses: 'grades-1-to-12-and-it-career-groups-1-to-9', aiMode: process.env.AI_MODE || 'SMART' }));
app.get('/api/csrf', (req, res) => {
  const token = createCsrfToken();
  res.cookie('csrfToken', token, { httpOnly: false, secure: isProduction, sameSite: 'lax', path: '/', maxAge: 2 * 60 * 60 * 1000 });
  res.json({ csrfToken: token });
});

async function start() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri || mongoUri.includes('<username>') || mongoUri.includes('<cluster-host>')) {
    throw new Error('MONGO_URI is not configured. Copy .env.example to .env and set your MongoDB connection URI.');
  }
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000, autoIndex: true });
  // Remove only obsolete unique username indexes from earlier schemas. This changes
  // an index, not account records; current accounts are identified by email.
  const indexMigration = await removeLegacyUsernameIndexes(User, console);
  if (indexMigration.droppedIndexes.length) {
    console.warn(`[startup-migration] Removed obsolete user index(es): ${indexMigration.droppedIndexes.join(', ')}; no account documents were deleted.`);
  }
  console.log(`Connected to MongoDB database '${mongoose.connection.name || '(unknown)'}'.`);

  app.use(session({
    name: 'connect.sid',
    secret: sessionSecret || crypto.randomBytes(48).toString('hex'),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({ mongoUrl: mongoUri, collectionName: 'sessions', ttl: Math.floor((Number(process.env.SESSION_MAX_AGE_MS) || 604800000) / 1000), touchAfter: 24 * 3600 }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: Number(process.env.SESSION_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000
    }
  }));

  // A suspended account is blocked on the next API request, including existing sessions.
  app.use('/api', async (req, res, next) => {
    const identity = req.session?.user;
    if (!identity || identity.role === 'admin' || identity.id === 'env-admin' || !mongoose.isValidObjectId(identity.id)) return next();
    try {
      const user = await User.findById(identity.id).select('status').lean();
      if (!user || user.status !== 'active') {
        return req.session.destroy(() => { res.clearCookie('connect.sid'); res.status(403).json({ error: 'Tài khoản đã bị khóa hoặc không còn tồn tại. Vui lòng liên hệ quản trị viên.' }); });
      }
      return next();
    } catch (error) { return next(error); }
  });
  app.use('/api', csrfProtection);
  app.use('/api', (req, res, next) => {
    const watch = req.path === '/auth/login' || req.path === '/auth/register' || req.path === '/auth/logout' || /^\/learning\/(?:assessments(?:\/submit)?|parts\/.+\/checkpoint|lesson\/.+|tutor|study-plan)$/.test(req.path);
    if (!watch) return next();
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const identity = req.session?.user || {};
      recordActivity(req, { action: `${req.method.toLowerCase()}${req.path.replace(/\W+/g, '.')}`, targetType: 'api', targetId: req.path, targetName: req.path, description: `${req.method} ${req.path}`, metadata: { statusCode: res.statusCode } });
    });
    next();
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/survey', surveyRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/learning', learningRoutes);
  app.use('/api/career', careerRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use(express.static(WEB_ROOT, { extensions: ['html'], maxAge: isProduction ? '1h' : 0, setHeaders(res, filePath) { if (path.extname(filePath).toLowerCase() === '.html') res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); } }));

  app.get('/api/*', (_req, res) => res.status(404).json({ error: 'Không tìm thấy API này.' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(WEB_ROOT, 'index.html'), (error) => { if (error) next(error); });
  });
  app.use((error, req, res, _next) => {
    if (res.headersSent) return;
    if (error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Dữ liệu hoặc file tải lên vượt giới hạn cho phép.' });
    if (/Chỉ hỗ trợ file Word/.test(error?.message || '')) return res.status(400).json({ error: error.message });
    if (error?.name === 'ValidationError') return res.status(400).json({ error: 'Dữ liệu chưa hợp lệ.' });
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}: ${error?.message || 'unknown error'}`);
    res.status(500).json({ error: 'Hệ thống gặp lỗi. Vui lòng thử lại sau.' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => console.log(`Hanh Trinh Moi V8.0.4 is listening on port ${PORT} (trust proxy: ${String(app.get('trust proxy'))}, production: ${isProduction}).`));
  const shutdown = async () => {
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(async (error) => {
  console.error(`Startup failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
