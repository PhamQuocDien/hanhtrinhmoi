// =================================================================
// --- SERVER TRUNG TÂM: HÀNH TINH MƠ ƯỚC (LUXURY SECURE EDITION) ---
// =================================================================
// 1. Kích hoạt chế độ bảo mật (ĐỌC FILE .env NGAY DÒNG ĐẦU TIÊN)
require('dotenv').config(); 

const express = require('express');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Server } = require("socket.io");
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const onlineUsers = {};
const monopolyGames = {};
const MongoStore = require('connect-mongo');

// 2. LẤY CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG (KHÔNG CÒN LỘ MẬT KHẨU)
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const APP_VERSION = '39.0.0';

function readEnvInt(name, fallback, min, max) {
    const parsed = Number.parseInt(process.env[name], 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

// Robux chỉ được xử lý dưới dạng yêu cầu đổi thưởng có kiểm duyệt.
// Máy chủ không thu thập mật khẩu/cookie Roblox và không tự ý đăng nhập tài khoản người chơi.
const ROBUX_REWARDS_ENABLED = String(process.env.ROBUX_REWARDS_ENABLED || 'false').toLowerCase() === 'true';
const ROBUX_POINTS_PER_ROBUX = readEnvInt('ROBUX_POINTS_PER_ROBUX', 100, 1, 1_000_000);
const ROBUX_MIN_REDEEM = readEnvInt('ROBUX_MIN_REDEEM', 10, 1, 100_000);
const ROBUX_MAX_DAILY = readEnvInt('ROBUX_MAX_DAILY', 100, ROBUX_MIN_REDEEM, 1_000_000);
const ROBUX_MAX_OPEN_REQUESTS = readEnvInt('ROBUX_MAX_OPEN_REQUESTS', 2, 1, 20);

// Giải cộng đồng chỉ dùng Điểm Đấu Trường không thể rút, đổi tiền hoặc Robux.
const COMMUNITY_TOURNAMENTS_ENABLED = String(process.env.COMMUNITY_TOURNAMENTS_ENABLED || 'true').toLowerCase() === 'true';
const ARENA_WELCOME_POINTS = readEnvInt('ARENA_WELCOME_POINTS', 300, 0, 10000);
const COMMUNITY_TOURNAMENT_MAX_ENTRY = readEnvInt('COMMUNITY_TOURNAMENT_MAX_ENTRY', 500, 10, 100000);
const COMMUNITY_TOURNAMENT_MAX_ACTIVE = readEnvInt('COMMUNITY_TOURNAMENT_MAX_ACTIVE', 2, 1, 10);
const COMMUNITY_TOURNAMENT_MAX_DAILY = readEnvInt('COMMUNITY_TOURNAMENT_MAX_DAILY', 5, 1, 30);
const COMMUNITY_TOURNAMENT_MAX_PLAYERS = readEnvInt('COMMUNITY_TOURNAMENT_MAX_PLAYERS', 32, 2, 64);

if (!MONGO_URI) {
    console.error('⚠️ Thiếu MONGO_URI/MONGODB_URI. Máy chủ sẽ chạy chế độ chẩn đoán; các API cần dữ liệu sẽ tạm thời không hoạt động.');
}

// --- 1. IMPORT DỮ LIỆU & LOGIC ---
const { tests, maths } = require('./question-data.js');
const { ensureCompleteQuestionBank } = require('./question-bank-complete.js');
const questionBankSummary = ensureCompleteQuestionBank(tests, { minQuestions: 100 });
console.log(`📚 Ngân hàng đề thi: ${questionBankSummary.totalQuestions.toLocaleString('vi-VN')} câu, đủ 6 môn × 12 lớp × 3 mức độ.`);
const { boardData } = require('./monopoly-data.js');
const MonopolyGame = require('./monopoly-logic.js');
const { PROGRAM_VERSION, PASS_SCORE, GRADE_FOCUS, CORE_QUALITIES, GENERAL_COMPETENCIES, getCatalog, getSubject, getLesson, scoreLesson } = require('./curriculum-data.js');
const { WORLD: SURVIVAL_WORLD, BLOCKS: SURVIVAL_BLOCKS, PLACEABLE: SURVIVAL_PLACEABLE, TOOLS: SURVIVAL_TOOLS, RECIPES: SURVIVAL_RECIPES, ITEM_LABELS: SURVIVAL_ITEM_LABELS, planCraft: planSurvivalCraft, safeState: safeSurvivalState, advanceState: advanceSurvivalState, levelFromXp: survivalLevelFromXp, countInventory: inventoryCounts, validateMineRequest: validateSurvivalMine, validatePlaceRequest: validateSurvivalPlace, applyToolWear: applySurvivalToolWear } = require('./server/modules/survival-v14.js');
const { BOOKS: APPROVED_BOOK_PROFILES, practicalType: practicalTypeForSubject, scorePractical } = require('./server/modules/learning-v11.js');
const { createQuestExpiryJob, scheduleQuestExpiryJob } = require('./server/modules/quest-maintenance-v14.js');
// --- PHASE 2: validators/OTP/RBAC (thuần, test được độc lập — scripts/test-auth-phase2.js) ---
const { validateRegistration, validateProfileUpdate, computeVerificationStatus } = require('./server/validators/auth-validators.js');
const { createOtpService } = require('./server/services/otp-service.js');
const { createEnvironmentOtpTransport } = require('./server/services/otp-transport.js');
const { hasPermission, requirePermission } = require('./server/middleware/permissions.js');
const platformModels = require('./server/models/platform-models.js');
const { createPlatformRouter } = require('./server/routes/platform-routes.js');
const { registerAiLearningRoutes } = require('./server/routes/ai-learning-routes.js');
const { createLearningIntelligenceRouter, recordLearningErrors } = require('./server/routes/learning-intelligence-routes.js');
const { createLearningSystemV27Router } = require('./server/routes/learning-system-v27-routes.js');
const { run: runPlatformMigrations } = require('./scripts/migrations/index.js');
const { startAIGenerationWorker, stopAIGenerationWorker } = require('./server/services/ai-generation-worker.js');
const { createApiRateLimiter } = require('./server/middleware/api-rate-limiter.js');
const { createRequestLogger } = require('./server/middleware/request-logger.js');

const app = express();
app.set('trust proxy', 1);
// Header an toàn và mã yêu cầu phải có trước static/session để trang chẩn đoán
// vẫn nhận được thông tin đầy đủ khi MongoDB hoặc kho phiên đang gián đoạn.
app.use((req, res, next) => {
    const requestId = String(req.get('X-Request-Id') || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`).slice(0, 80);
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
});
// Endpoint sống độc lập với Mongo/session dành riêng cho Render.
app.get('/healthz', (req, res) => res.status(200).json({ status: 'alive', version: APP_VERSION, uptimeSeconds: Math.floor(process.uptime()) }));
// Express 4 không tự chuyển lỗi từ async/await vào error middleware.
// Bọc toàn bộ route để một lỗi MongoDB không làm request treo hoặc đánh sập tiến trình.
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = app[method].bind(app);
    app[method] = (path, ...handlers) => {
        if (!handlers.length) return original(path);
        const wrapped = handlers.map(handler => {
            if (typeof handler !== 'function') return handler;
            return function safeAsyncRoute(req, res, next) {
                try {
                    const result = handler(req, res, next);
                    if (result && typeof result.then === 'function') result.catch(next);
                    return result;
                } catch (error) {
                    return next(error);
                }
            };
        });
        return original(path, ...wrapped);
    };
}

// Tài nguyên công khai phải tải được ngay cả khi kho phiên MongoDB đang kết nối lại.
// Điều này ngăn trang đăng nhập/status bị 503 chỉ vì session store tạm thời gián đoạn.
const refreshStaticAssets = (res, filePath) => {
    if (/\.(?:html|js|css)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache, must-revalidate');
};
const publicStaticOptions = { etag: true, maxAge: IS_PRODUCTION ? '1h' : 0, setHeaders: refreshStaticAssets };
app.use('/assets', (req, res, next) => {
    if (req.path === '/js/api.js' || req.path === '/js/ai-learning-hub.js') res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    next();
});
app.use('/assets', express.static(path.join(__dirname, 'assets'), publicStaticOptions));
const publicFiles = new Set([
    '/login.html', '/index.html', '/status.html', '/style.css', '/modern-ui.css', '/modern-ui.js',
    '/global-client.js', '/heartbeat.js', '/ads.txt',
    '/tournament-v9.css', '/tournament-v9.js'
]);
const publicStatic = express.static(__dirname, publicStaticOptions);
app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !publicFiles.has(req.path)) return next();
    return publicStatic(req, res, next);
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: IS_PRODUCTION ? false : true,
        credentials: true
    },
    maxHttpBufferSize: 1e6
});
// --- 2. KẾT NỐI MONGODB ---
// Schema User (Đầy đủ trường dữ liệu cũ)
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    parentCode: String,
    // --- PHASE 2: hồ sơ đăng ký & xác thực (toàn bộ optional để dữ liệu cũ không vỡ) ---
    fullName: { type: String, trim: true, maxlength: 100, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    dob: {
        day: { type: Number, min: 1, max: 31, default: null },
        month: { type: Number, min: 1, max: 12, default: null },
        year: { type: Number, min: 1900, max: 2100, default: null }
    },
    age: { type: Number, min: 0, max: 120, default: null },
    gameId: { type: String, trim: true, maxlength: 24, default: '' },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    // EMAIL_UNVERIFIED | PHONE_UNVERIFIED | PARTIALLY_VERIFIED | VERIFIED | SUSPENDED | LOCKED
    // (SUSPENDED/LOCKED do backend tính từ isSuspended — client không thể tự đặt)
    verificationStatus: { type: String, default: 'EMAIL_UNVERIFIED' },
    educationStatus: { type: String, default: '' },
    educationGrade: { type: Number, min: 1, max: 12, default: null },
    score: { type: Number, default: 0 },
    arenaPoints: { type: Number, default: 0, min: 0 },
    arenaWelcomeGranted: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    children: [String], 
    history: [{ activity: String, referenceId: { type: String, default: '' }, timestamp: { type: Date, default: Date.now } }], 
    quests: { type: Array, default: [] }, 
    playtimeLimitMinutes: { type: Number, default: 0 },
    playtimeUsedToday: { type: Number, default: 0 },
    playtimeDate: { type: String, default: '' },
    lastHeartbeatAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    loginStreak: { type: Number, default: 0 },
    lastLoginDate: { type: String, default: '' },
    inventory: { type: Array, default: [] }, // Danh sách ID đồ đã mua: ['bed_1', 'table_2']
    miningStats: {
        total: { type: Number, default: 0, min: 0 },
        byOre: { type: Object, default: {} },
        lastMinedAt: { type: Date, default: null }
    },
    houseData: { type: Array, default: [] },
    chestsData: { type: Object, default: {} },
    worldSettings: {
        type: Object,
        default: { theme: 'spring', weatherMode: 'auto', timeMode: 'auto' }
    },
    survivalState: {
        health: { type: Number, default: 100, min: 0, max: 100 },
        hunger: { type: Number, default: 100, min: 0, max: 100 },
        stamina: { type: Number, default: 100, min: 0, max: 100 },
        xp: { type: Number, default: 0, min: 0 },
        level: { type: Number, default: 1, min: 1, max: 999 },
        deaths: { type: Number, default: 0, min: 0 },
        equippedTool: { type: String, default: '' },
        removedBlocks: { type: [String], default: [] },
        placedBlocks: { type: Array, default: [] },
        toolDurability: { type: Object, default: {} },
        lastUpdatedAt: { type: Date, default: null },
        lastResetAt: { type: Date, default: null },
        worldVersion: { type: Number, default: 14 }
    },
    colors: { type: Object, default: { wall: '#b2bec3', floor: '#f5f6fa' } },
    // --- DANH SÁCH 14 CẤP ĐỘ GAME ---
    musicLevel: { type: Number, default: 1 }, // Thêm vào danh sách các cấp độ game
    paintingLevel: { type: Number, default: 1 },      // Xưởng vẽ
    memoryLevel: { type: Number, default: 1 },        // Ghép hình
    shapeLevel: { type: Number, default: 1 },         // Tạo hình vui nhộn
    galleryDrawings: { type: Array, default: [] },
    buildLevel: { type: Number, default: 1 },         // Xây dựng ước mơ
    crosswordLevel: { type: Number, default: 1 },     // Ô chữ
    detectiveLevel: { type: Number, default: 1 },     // Tìm điểm khác biệt
    storyLevel: { type: Number, default: 1 },         // Sáng tác truyện
    vietSpeechLevel: { type: Number, default: 1 },    // Luyện nói Tiếng Việt
    englishSpeechLevel: { type: Number, default: 1 }, // Luyện nói Tiếng Anh
    chessLevel: { type: Number, default: 1 },         // Cờ Vua
    caroLevel: { type: Number, default: 1 },          // Caro
    goLevel: { type: Number, default: 1 },            // Cờ Vây
    monopolyLevel: { type: Number, default: 1 },      // Cờ Tỷ Phú
    othelloLevel: { type: Number, default: 1 }        // Othello
});
// --- PHASE 2: unique index cho email/phone/gameId ---
// Partial index: chỉ áp dụng khi trường có giá trị khác rỗng → mọi user cũ
// (không có các trường này) không bị ảnh hưởng, không duplicate index.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string', $gt: '' } } });
userSchema.index({ gameId: 1 }, { unique: true, partialFilterExpression: { gameId: { $type: 'string', $gt: '' } } });
const tournamentSchema = new mongoose.Schema({
    title: { type: String, trim: true, maxlength: 80, default: 'Giải đấu chính thức' },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    organizerType: { type: String, enum: ['official', 'player'], default: 'official', index: true },
    creator: { type: String, default: 'admin', index: true },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    joinCode: { type: String, default: '', index: true },
    pointMode: { type: String, enum: ['official-score', 'arena-noncash'], default: 'official-score' },
    gameType: { type: String, enum: ['chess', 'caro', 'go', 'othello'], required: true },
    format: { type: String, enum: ['auto', 'knockout', 'group'], default: 'auto' },
    phase: { type: String, enum: ['registration', 'groups', 'knockout', 'completed'], default: 'registration' },
    round: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'playing', 'finished', 'cancelled'], default: 'open', index: true },
    matchDuration: { type: Number, default: 20, min: 5, max: 180 },
    registrationDeadline: { type: Date, required: true },
    dailyStartHour: { type: Number, default: 8, min: 0, max: 23 },
    dailyEndHour: { type: Number, default: 18, min: 1, max: 24 },
    durationDays: { type: Number, default: 7, min: 1, max: 30 },
    minParticipants: { type: Number, default: 2, min: 2, max: 64 },
    maxParticipants: { type: Number, default: 32, min: 2, max: 128 },
    entryFee: { type: Number, default: 0, min: 0 },
    escrowBalance: { type: Number, default: 0, min: 0 },
    participants: { type: [String], default: [] },
    paidParticipants: { type: [String], default: [] },
    refundedParticipants: { type: [String], default: [] },
    withdrawnParticipants: { type: [String], default: [] },
    feesRefunded: { type: Boolean, default: false },
    prizeBreakdown: { first: { type: Number, default: 0 }, second: { type: Number, default: 0 }, third: { type: Number, default: 0 } },
    brackets: { type: Array, default: [] },
    history: { type: Array, default: [] },
    winners: { top1: String, top2: String, top3: String },
    rewardsGranted: { type: Boolean, default: false },
    cancelReason: { type: String, default: '' },
    startedAt: Date,
    finishedAt: Date
}, { timestamps: true });

tournamentSchema.index({ status: 1, organizerType: 1, createdAt: -1 });
tournamentSchema.index({ creator: 1, status: 1, createdAt: -1 });

const learningRecordSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    subjectId: { type: String, required: true },
    lessonId: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    lastScore: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    skillStats: { type: Object, default: {} },
    lastDetails: { type: Array, default: [] },
    masteryLevel: { type: String, enum: ['new', 'practicing', 'passed', 'mastered'], default: 'new' },
    reviewAttempts: { type: Number, default: 0 },
    reviewBestScore: { type: Number, default: 0 },
    lastReviewedAt: Date,
    lastAttemptAt: Date,
    nextReviewAt: { type: Date, default: null, index: true },
    reviewIntervalDays: { type: Number, default: 0, min: 0, max: 365 },
    reviewStreak: { type: Number, default: 0, min: 0, max: 999 },
    completedAt: Date,
    submissionIds: { type: [String], default: [] }
}, { timestamps: true });
learningRecordSchema.index({ username: 1, grade: 1, subjectId: 1, lessonId: 1 }, { unique: true });

const learningSettingSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const learningProfileSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, index: true },
    dailyGoalMinutes: { type: Number, default: 30, min: 10, max: 180 },
    xp: { type: Number, default: 0, min: 0 },
    studyDays: { type: [String], default: [] },
    lastGrade: { type: Number, default: 1, min: 1, max: 12 },
    preferredSubjects: { type: [String], default: [] },
    weeklyGoalDays: { type: Number, default: 5, min: 1, max: 7 },
    totalStudyMinutes: { type: Number, default: 0, min: 0 },
    bookSelections: { type: Object, default: {} },
    accessibility: {
        type: Object,
        default: { largeText: false, reducedMotion: false, highContrast: false, readingGuide: false }
    },
    focusMinutes: { type: Number, default: 25, min: 10, max: 60 }
}, { timestamps: true });

const learningNoteSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    subjectId: { type: String, required: true },
    lessonId: { type: String, required: true },
    content: { type: String, default: '', maxlength: 4000 }
}, { timestamps: true });
learningNoteSchema.index({ username: 1, grade: 1, subjectId: 1, lessonId: 1 }, { unique: true });

const learningSelfAssessmentSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    schoolYear: { type: String, required: true },
    semester: { type: String, enum: ['semester-1','semester-2','year'], default: 'semester-1' },
    qualities: { type: Object, default: {} },
    competencies: { type: Object, default: {} },
    reflection: { type: String, default: '', maxlength: 2000 },
    nextGoal: { type: String, default: '', maxlength: 1000 }
}, { timestamps: true });
learningSelfAssessmentSchema.index({ username: 1, grade: 1, schoolYear: 1, semester: 1 }, { unique: true });

const learningPracticalSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    subjectId: { type: String, required: true },
    lessonId: { type: String, required: true },
    type: { type: String, enum: ['singing','drawing'], required: true },
    score: { type: Number, required: true, min: 0, max: 10 },
    metrics: { type: Object, default: {} },
    feedback: { type: String, default: '', maxlength: 1000 },
    evidenceId: { type: String, required: true, index: true }
}, { timestamps: true });
learningPracticalSchema.index({ username: 1, grade: 1, subjectId: 1, lessonId: 1, createdAt: -1 });

const learningActivitySchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    grade: { type: Number, required: true, min: 1, max: 12 },
    type: { type: String, enum: ['lesson','review','note','self-assessment','speaking','essay','practical'], required: true },
    subjectId: { type: String, default: '' },
    lessonId: { type: String, default: '' },
    score: { type: Number, default: null },
    minutes: { type: Number, default: 0, min: 0, max: 600 },
    metadata: { type: Object, default: {} }
}, { timestamps: true });
learningActivitySchema.index({ username: 1, grade: 1, createdAt: -1 });
learningActivitySchema.index({ username: 1, createdAt: -1 });

// ============================================================
// --- 3. NHÓM QUÀ LƯU NIỆM (MỞ RỘNG ĐA DẠNG SỰ KIỆN) ---
// ============================================================
const SEASONAL_SOUVENIRS = [
    // 🌸 TẾT NGUYÊN ĐÁN (Tet)
    { id: 'sov_tet_mai', name: 'Cây Mai Vàng', price: 1000, type: 'd', category: 'souvenir', event: 'Tet', icon: '🌼' },
    { id: 'sov_tet_dao', name: 'Cây Đào Phai', price: 1000, type: 'd', category: 'souvenir', event: 'Tet', icon: '🌸' },
    { id: 'sov_tet_lan', name: 'Đầu Lân Sư Rồng', price: 1500, type: 'd', category: 'souvenir', event: 'Tet', icon: '🐲' },
    { id: 'sov_tet_lixi', name: 'Bao Lì Xì Lớn', price: 200, type: 'd', category: 'souvenir', event: 'Tet', icon: '🧧' },
    { id: 'sov_tet_banhchung', name: 'Bánh Chưng Xanh', price: 400, type: 'd', category: 'souvenir', event: 'Tet', icon: '🟩' },
    { id: 'sov_tet_mamnguqua', name: 'Mâm Ngũ Quả', price: 600, type: 'd', category: 'souvenir', event: 'Tet', icon: '🍎' },
    { id: 'sov_tet_phao', name: 'Tràng Pháo Đỏ', price: 300, type: 'd', category: 'souvenir', event: 'Tet', icon: '🧨' },
    { id: 'sov_tet_caudoi', name: 'Câu Đối Đỏ', price: 500, type: 'd', category: 'souvenir', event: 'Tet', icon: '📜' },

    // 🎄 GIÁNG SINH (Noel)
    { id: 'sov_noel_tree', name: 'Thông Noel', price: 1200, type: 'd', category: 'souvenir', event: 'Noel', icon: '🎄' },
    { id: 'sov_noel_santa', name: 'Ông Già Noel', price: 1500, type: 'd', category: 'souvenir', event: 'Noel', icon: '🎅' },
    { id: 'sov_noel_snow', name: 'Người Tuyết', price: 800, type: 'd', category: 'souvenir', event: 'Noel', icon: '⛄' },
    { id: 'sov_noel_gift', name: 'Hộp Quà Khổng Lồ', price: 400, type: 'd', category: 'souvenir', event: 'Noel', icon: '🎁' },
    { id: 'sov_noel_bell', name: 'Chuông Vàng Ngân Nga', price: 300, type: 'd', category: 'souvenir', event: 'Noel', icon: '🔔' },
    { id: 'sov_noel_sock', name: 'Vớ Đựng Quà', price: 150, type: 'd', category: 'souvenir', event: 'Noel', icon: '🧦' },
    { id: 'sov_noel_reindeer', name: 'Tuần Lộc Nhỏ', price: 2000, type: 'd', category: 'souvenir', event: 'Noel', icon: '🦌' },
    { id: 'sov_noel_candy', name: 'Kẹo Gậy Giáng Sinh', price: 100, type: 'd', category: 'souvenir', event: 'Noel', icon: '🦯' },

    // 🎃 HALLOWEEN (Halloween)
    { id: 'sov_hal_pump', name: 'Bí Ngô Ma Quái', price: 600, type: 'd', category: 'souvenir', event: 'Halloween', icon: '🎃' },
    { id: 'sov_hal_ghost', name: 'Bóng Ma Cute', price: 700, type: 'd', category: 'souvenir', event: 'Halloween', icon: '👻' },
    { id: 'sov_hal_witch_hat', name: 'Mũ Phù Thủy', price: 400, type: 'd', category: 'souvenir', event: 'Halloween', icon: '🧙' },
    { id: 'sov_hal_bat', name: 'Dơi Treo Tường', price: 300, type: 'd', category: 'souvenir', event: 'Halloween', icon: '🦇' },
    { id: 'sov_hal_spider', name: 'Mạng Nhện Khổng Lồ', price: 250, type: 'd', category: 'souvenir', event: 'Halloween', icon: '🕸️' },
    { id: 'sov_hal_skul', name: 'Đầu Lâu Cổ Đại', price: 900, type: 'd', category: 'souvenir', event: 'Halloween', icon: '💀' },

    // 🏮 TRUNG THU (MidAutumn)
    { id: 'sov_mid_star', name: 'Đèn Ông Sao', price: 300, type: 'd', category: 'souvenir', event: 'MidAutumn', icon: '🌟' },
    { id: 'sov_mid_rabbit', name: 'Thỏ Ngọc', price: 2000, type: 'd', category: 'souvenir', event: 'MidAutumn', icon: '🐇' },
    { id: 'sov_mid_mooncake', name: 'Bánh Trung Thu Thập Cẩm', price: 400, type: 'd', category: 'souvenir', event: 'MidAutumn', icon: '🥮' },
    { id: 'sov_mid_lion', name: 'Đầu Lân Nhỏ', price: 1200, type: 'd', category: 'souvenir', event: 'MidAutumn', icon: '🎭' },
    { id: 'sov_mid_lamp', name: 'Lồng Đèn Cá Chép', price: 500, type: 'd', category: 'souvenir', event: 'MidAutumn', icon: '🐟' },
    { id: 'sov_mid_tree', name: 'Cây Đa Chú Cuội', price: 1500, type: 'd', category: 'souvenir', event: 'MidAutumn', icon: '🌳' },

    // ❤️ VALENTINE - LỄ TÌNH NHÂN (Valentine)
    { id: 'sov_val_heart', name: 'Trái Tim Pha Lê', price: 500, type: 'd', category: 'souvenir', event: 'Valentine', icon: '💎' },
    { id: 'sov_val_rose', name: 'Bó Hoa Hồng Thắm', price: 300, type: 'd', category: 'souvenir', event: 'Valentine', icon: '🌹' },
    { id: 'sov_val_choco', name: 'Hộp Socola Ngọt Ngào', price: 450, type: 'd', category: 'souvenir', event: 'Valentine', icon: '🍫' },
    { id: 'sov_val_bear', name: 'Gấu Bông Ôm Tim', price: 800, type: 'd', category: 'souvenir', event: 'Valentine', icon: '🧸' },
    { id: 'sov_val_cupid', name: 'Cung Tên Cupid', price: 2500, type: 'd', category: 'souvenir', event: 'Valentine', icon: '🏹' },

    // ⛱️ MÙA HÈ RỰC RỠ (Summer)
    { id: 'sov_sum_castle', name: 'Lâu Đài Cát', price: 600, type: 'd', category: 'souvenir', event: 'Summer', icon: '🏰' },
    { id: 'sov_sum_surf', name: 'Ván Lướt Sóng', price: 700, type: 'd', category: 'souvenir', event: 'Summer', icon: '🏄' },
    { id: 'sov_sum_duck', name: 'Phao Vịt Vàng Siêu Cấp', price: 1200, type: 'd', category: 'souvenir', event: 'Summer', icon: '🐥' },
    { id: 'sov_sum_coconut', name: 'Ly Nước Dừa Mát Lạnh', price: 150, type: 'd', category: 'souvenir', event: 'Summer', icon: '🥥' },
    { id: 'sov_sum_tree', name: 'Cây Dừa Kiểng', price: 900, type: 'd', category: 'souvenir', event: 'Summer', icon: '🌴' },

    // 🎂 TIỆC SINH NHẬT (Birthday)
    { id: 'sov_bd_cake', name: 'Bánh Kem 3 Tầng', price: 2000, type: 'd', category: 'souvenir', event: 'Birthday', icon: '🎂' },
    { id: 'sov_bd_balloon', name: 'Chùm Bóng Bay Cầu Vồng', price: 300, type: 'd', category: 'souvenir', event: 'Birthday', icon: '🎈' },
    { id: 'sov_bd_hat', name: 'Nón Chóp Tiệc Tùng', price: 100, type: 'd', category: 'souvenir', event: 'Birthday', icon: '🥳' },
    { id: 'sov_bd_confetti', name: 'Máy Bắn Pháo Giấy', price: 500, type: 'd', category: 'souvenir', event: 'Birthday', icon: '🎉' }
];
const HOME_FURNITURE = [
    // --- 1. NỘI THẤT CƠ BẢN (furniture) ---
    { id: 'bed_lux', name: 'Giường Hoàng Gia', price: 500, type: 'f', category: 'furniture', icon: '🛌' },
    { id: 'bed_bunk', name: 'Giường Tầng', price: 600, type: 'f', category: 'furniture', icon: '🛏️' },
    { id: 'sofa_pro', name: 'Sofa Cao Cấp', price: 400, type: 'f', category: 'furniture', icon: '🛋️' },
    { id: 'wardrobe_big', name: 'Tủ Quần Áo', price: 450, type: 'f', category: 'furniture', icon: '👗' },
    { id: 'bookshelf', name: 'Kệ Sách Lớn', price: 350, type: 'f', category: 'furniture', icon: '📚' },
    { id: 'desk_study', name: 'Bàn Học Tập', price: 300, type: 'f', category: 'furniture', icon: '📝' },
    { id: 'table_wood', name: 'Bàn Ăn Bằng Gỗ', price: 250, type: 'f', category: 'furniture', icon: '🪑' },
    { id: 'chair_wood', name: 'Ghế Tựa Gỗ', price: 100, type: 'f', category: 'furniture', icon: '🪑' },
    
    // --- 2. NHÀ TẮM & NHÀ BẾP (furniture) ---
    { id: 'kit_fridge_1', name: 'Tủ Lạnh', price: 450, type: 'f', category: 'furniture', icon: '🧊' },
    { id: 'kit_fridge_2', name: 'Tủ Lạnh 2 Cánh', price: 650, type: 'f', category: 'furniture', icon: '🧊' },
    { id: 'kit_stove', name: 'Bếp Nấu Ăn', price: 300, type: 'f', category: 'furniture', icon: '🍳' },
    { id: 'kit_pot', name: 'Nồi Súp Ngon', price: 50, type: 'f', category: 'furniture', icon: '🍲' },
    { id: 'bath_tub_1', name: 'Bồn Tắm', price: 550, type: 'f', category: 'furniture', icon: '🛁' },
    { id: 'bath_tub_2', name: 'Bồn Tắm Sục', price: 750, type: 'f', category: 'furniture', icon: '🛁' },
    { id: 'bath_toilet', name: 'Bồn Cầu Vàng', price: 250, type: 'f', category: 'furniture', icon: '🚽' },
    { id: 'bath_duck', name: 'Vịt Tắm', price: 20, type: 'f', category: 'furniture', icon: '🦆' },

    // --- 3. ĐIỆN TỬ & CÔNG NGHỆ (electronics) ---
    { id: 'tv_8k_1', name: 'Tivi 8K', price: 600, type: 'e', category: 'electronics', icon: '📺' },
    { id: 'tv_8k_slim', name: 'Tivi 8K Siêu Mỏng', price: 800, type: 'e', category: 'electronics', icon: '📺' },
    { id: 'pc_super_1', name: 'Siêu Máy Tính', price: 700, type: 'e', category: 'electronics', icon: '🖥️' },
    { id: 'pc_super_2', name: 'PC Gaming Pro', price: 900, type: 'e', category: 'electronics', icon: '🖥️' },
    { id: 'laptop_pro', name: 'Laptop Mỏng Nhẹ', price: 500, type: 'e', category: 'electronics', icon: '💻' },
    { id: 'speaker_hiend', name: 'Loa Âm Thanh Vòm', price: 300, type: 'e', category: 'electronics', icon: '🔊' },
    { id: 'robot_clean', name: 'Robot Hút Bụi', price: 200, type: 'e', category: 'electronics', icon: '🤖' },
    { id: 'camera_sec', name: 'Camera An Ninh', price: 150, type: 'e', category: 'electronics', icon: '📹' },
    { id: 'lamp_modern', name: 'Đèn Ngủ Cảm Ứng', price: 150, type: 'e', category: 'electronics', icon: '🏮' },
    { id: 'ac_unit', name: 'Điều Hòa Nhiệt Độ', price: 400, type: 'e', category: 'electronics', icon: '❄️' },
    { id: 'game_console', name: 'Máy Chơi Game PS5', price: 800, type: 'e', category: 'electronics', icon: '🎮' },
    { id: 'microwave', name: 'Lò Vi Sóng', price: 250, type: 'e', category: 'electronics', icon: '🍱' },

    // --- 4. TRANG TRÍ & SÂN VƯỜN (decor) ---
    { id: 'piano_grand', name: 'Đàn Piano Cơ', price: 1000, type: 'd', category: 'decor', icon: '🎹' },
    { id: 'guitar_elec', name: 'Đàn Guitar Điện', price: 450, type: 'd', category: 'decor', icon: '🎸' },
    { id: 'drum_set', name: 'Dàn Trống Xịn', price: 600, type: 'd', category: 'decor', icon: '🥁' },
    { id: 'aquarium_pro', name: 'Bể Cá Thủy Sinh', price: 550, type: 'd', category: 'decor', icon: '🐠' },
    { id: 'bonsai_tree', name: 'Cây Cảnh Nghệ Thuật', price: 180, type: 'd', category: 'decor', icon: '🪴' },
    { id: 'plant_cactus', name: 'Chậu Xương Rồng', price: 80, type: 'd', category: 'decor', icon: '🌵' },
    { id: 'xmas_tree', name: 'Cây Thông Noel', price: 300, type: 'd', category: 'decor', icon: '🎄' },
    { id: 'fountain', name: 'Đài Phun Nước', price: 800, type: 'd', category: 'decor', icon: '⛲' },
    { id: 'flower_sun', name: 'Hoa Hướng Dương', price: 50, type: 'd', category: 'decor', icon: '🌻' },
    { id: 'statue_moai', name: 'Tượng Moai', price: 400, type: 'd', category: 'decor', icon: '🗿' },
    { id: 'bear_huge', name: 'Gấu Bông Khổng Lồ', price: 120, type: 'd', category: 'decor', icon: '🧸' },
    { id: 'telescope_v2', name: 'Kính Thiên Văn', price: 400, type: 'd', category: 'decor', icon: '🔭' },
    { id: 'painting_art', name: 'Tranh Triển Lãm', price: 300, type: 'd', category: 'decor', icon: '🖼️' },
    { id: 'clock_gold', name: 'Đồng Hồ Quả Lắc', price: 220, type: 'd', category: 'decor', icon: '⏰' },
    { id: 'safe_box', name: 'Két Sắt', price: 600, type: 'd', category: 'decor', icon: '🔐' },
    { id: 'magic_ball', name: 'Quả Cầu Pha Lê', price: 500, type: 'd', category: 'decor', icon: '🔮' },
    { id: 'trophy_gold', name: 'Cúp Vô Địch', price: 900, type: 'd', category: 'decor', icon: '🏆' },

    // --- 5. CÔNG TRÌNH THẾ GIỚI (world) ---
    { id: 'world_gazebo', name: 'Chòi Nghỉ Công Viên', price: 850, type: 'w', category: 'world', icon: '🏛️' },
    { id: 'world_windmill', name: 'Cối Xay Gió', price: 1200, type: 'w', category: 'world', icon: '🌬️' },
    { id: 'world_market_stall', name: 'Quầy Chợ Làng', price: 500, type: 'w', category: 'world', icon: '🏪' },
    { id: 'world_street_lamp', name: 'Đèn Đường Phép Thuật', price: 260, type: 'w', category: 'world', icon: '💡' },
    { id: 'world_park_bench', name: 'Ghế Công Viên', price: 180, type: 'w', category: 'world', icon: '🪑' },
    { id: 'world_campfire', name: 'Lửa Trại', price: 220, type: 'w', category: 'world', icon: '🔥' },
    { id: 'world_picnic', name: 'Bàn Dã Ngoại', price: 320, type: 'w', category: 'world', icon: '🧺' },
    { id: 'world_swing', name: 'Xích Đu Sân Vườn', price: 380, type: 'w', category: 'world', icon: '🎠' },
    { id: 'world_cherry_tree', name: 'Cây Anh Đào', price: 450, type: 'w', category: 'world', icon: '🌸' },
    { id: 'world_crystal', name: 'Tinh Thể Phát Sáng', price: 700, type: 'w', category: 'world', icon: '💠' },
    { id: 'world_portal', name: 'Cổng Dịch Chuyển', price: 1500, type: 'w', category: 'world', icon: '🌀' },
    { id: 'world_sign', name: 'Biển Chỉ Dẫn', price: 90, type: 'w', category: 'world', icon: '🪧' },

    // --- 5. THÚ CƯNG ĐI DẠO (pet) - TỰ ĐỘNG CHẠY NHẢY TRONG GAME ---
    { id: 'pet_cat', name: 'Mèo Lười', price: 500, type: 'p', category: 'pet', icon: '🐱' },
    { id: 'pet_dog', name: 'Cún Corgi', price: 260, type: 'p', category: 'pet', icon: '🐶' },
    { id: 'pet_hamster', name: 'Hamster Chạy Bộ', price: 100, type: 'p', category: 'pet', icon: '🐹' },
    { id: 'pet_parrot', name: 'Vẹt Nhại Tiếng', price: 350, type: 'p', category: 'pet', icon: '🦜' },
    { id: 'pet_rabbit', name: 'Thỏ Trắng Nhảy', price: 300, type: 'p', category: 'pet', icon: '🐰' },
    { id: 'pet_piglet', name: 'Heo Con Bụ Bẫm', price: 200, type: 'p', category: 'pet', icon: '🐷' },
    { id: 'pet_monkey', name: 'Khỉ Quậy Phá', price: 400, type: 'p', category: 'pet', icon: '🐵' },
    { id: 'pet_turtle', name: 'Rùa Biển Cụ', price: 250, type: 'p', category: 'pet', icon: '🐢' },
    { id: 'pet_penguin', name: 'Chim Cánh Cụt', price: 450, type: 'p', category: 'pet', icon: '🐧' },
    { id: 'pet_unicorn', name: 'Kỳ Lân (Cực Hiếm)', price: 5000, type: 'p', category: 'pet', icon: '🦄' },
    { id: 'pet_dragon', name: 'Rồng Lửa (Huyền Thoại)', price: 9999, type: 'p', category: 'pet', icon: '🐉' },
];

const MATERIALS = [
    // =======================================================
    // --- 1. KHỐI XÂY DỰNG: TƯỜNG & GẠCH (20 LOẠI - 'paint') ---
    // =======================================================
    { id: 'wall_white', name: 'Tường Trắng Sứ', price: 50, category: 'paint', value: '#ffffff', icon: '🧱' },
    { id: 'wall_black', name: 'Tường Đen Nhám', price: 60, category: 'paint', value: '#2c3e50', icon: '⬛' },
    { id: 'wall_red_brick', name: 'Khối Gạch Đỏ', price: 60, category: 'paint', value: '#c0392b', icon: '🧱' },
    { id: 'wall_stone_brick', name: 'Khối Gạch Đá Xám', price: 70, category: 'paint', value: '#7f8c8d', icon: '🪨' },
    { id: 'wall_wood_plank', name: 'Ván Gỗ Sồi', price: 80, category: 'paint', value: '#e67e22', icon: '🪵' },
    { id: 'wall_pink', name: 'Sơn Hồng Nhạt', price: 50, category: 'paint', value: '#fd79a8', icon: '🎨' },
    { id: 'wall_blue', name: 'Sơn Xanh Nước Biển', price: 50, category: 'paint', value: '#0984e3', icon: '🎨' },
    { id: 'wall_yellow', name: 'Sơn Vàng Chanh', price: 50, category: 'paint', value: '#f1c40f', icon: '🎨' },
    { id: 'wall_green', name: 'Sơn Xanh Lá', price: 50, category: 'paint', value: '#2ecc71', icon: '🎨' },
    { id: 'wall_glass', name: 'Kính Trong Suốt', price: 100, category: 'paint', value: '#81ecec', icon: '🧊' },
    // --- MỚI BỔ SUNG ---
    { id: 'wall_diamond', name: 'Khối Kim Cương', price: 500, category: 'paint', value: '#00cec9', icon: '💎' },
    { id: 'wall_gold', name: 'Khối Vàng Ròng', price: 400, category: 'paint', value: '#f39c12', icon: '👑' },
    { id: 'wall_emerald', name: 'Khối Lục Bảo', price: 450, category: 'paint', value: '#00b894', icon: '❇️' },
    { id: 'wall_amethyst', name: 'Khối Thạch Anh Tím', price: 300, category: 'paint', value: '#a29bfe', icon: '🔮' },
    { id: 'wall_quartz', name: 'Khối Thạch Anh Trắng', price: 200, category: 'paint', value: '#f5f6fa', icon: '🏛️' },
    { id: 'wall_dark_oak', name: 'Ván Gỗ Sồi Sẫm', price: 90, category: 'paint', value: '#5c2c16', icon: '🪵' },
    { id: 'wall_birch', name: 'Ván Gỗ Bạch Dương', price: 90, category: 'paint', value: '#f5cd79', icon: '🪵' },
    { id: 'wall_magma', name: 'Khối Magma Phun Trào', price: 350, category: 'paint', value: '#e15f41', icon: '🌋' },
    { id: 'wall_ice', name: 'Khối Băng Giá', price: 150, category: 'paint', value: '#74b9ff', icon: '❄️' },
    { id: 'wall_prismarine', name: 'Gạch Lăng Kính Biển', price: 250, category: 'paint', value: '#00cec9', icon: '🧜‍♂️' },

    // ========================================================
    // --- 2. KHỐI XÂY DỰNG: SÀN NHÀ & ĐỊA HÌNH (20 LOẠI - 'floor') ---
    // ========================================================
    { id: 'floor_wood', name: 'Sàn Gỗ Cổ Điển', price: 100, category: 'floor', value: '#d35400', icon: '🪵' },
    { id: 'floor_grass', name: 'Khối Cỏ Xanh', price: 150, category: 'floor', value: '#27ae60', icon: '🌿' },
    { id: 'floor_dirt', name: 'Khối Đất Nâu', price: 80, category: 'floor', value: '#6e2c00', icon: '🟤' },
    { id: 'floor_stone', name: 'Đá Cuội', price: 120, category: 'floor', value: '#95a5a6', icon: '🪨' },
    { id: 'floor_sand', name: 'Cát Sa Mạc', price: 80, category: 'floor', value: '#f1c40f', icon: '🏜️' },
    { id: 'floor_water', name: 'Khối Nước Biển', price: 200, category: 'floor', value: '#3498db', icon: '🌊' },
    { id: 'floor_lava', name: 'Khối Dung Nham', price: 300, category: 'floor', value: '#e74c3c', icon: '🔥' },
    { id: 'floor_snow', name: 'Khối Tuyết', price: 120, category: 'floor', value: '#dfe6e9', icon: '❄️' },
    { id: 'floor_tile', name: 'Gạch Men Lát Sàn', price: 150, category: 'floor', value: '#ecf0f1', icon: '⬜' },
    { id: 'floor_obsidian', name: 'Hắc Diện Thạch', price: 500, category: 'floor', value: '#2f3640', icon: '⬛' },
    // --- MỚI BỔ SUNG ---
    { id: 'floor_red_sand', name: 'Cát Đỏ Khô Cằn', price: 90, category: 'floor', value: '#d35400', icon: '🏜️' },
    { id: 'floor_clay', name: 'Đất Sét Xám', price: 100, category: 'floor', value: '#d1d8e0', icon: '🧱' },
    { id: 'floor_packed_ice', name: 'Băng Trơn Trượt', price: 180, category: 'floor', value: '#81ecec', icon: '🧊' },
    { id: 'floor_red_carpet', name: 'Thảm Đỏ Trải Sàn', price: 130, category: 'floor', value: '#c0392b', icon: '🟥' },
    { id: 'floor_blue_carpet', name: 'Thảm Xanh Trải Sàn', price: 130, category: 'floor', value: '#0984e3', icon: '🟦' },
    { id: 'floor_warped_nylium', name: 'Thảm Nấm Xanh Lạ', price: 250, category: 'floor', value: '#008b8b', icon: '🦠' },
    { id: 'floor_crimson_nylium', name: 'Thảm Nấm Đỏ Lạ', price: 250, category: 'floor', value: '#8b0000', icon: '🍄' },
    { id: 'floor_gravel', name: 'Sỏi Rải Đường', price: 70, category: 'floor', value: '#a4b0be', icon: '⚪' },
    { id: 'floor_concrete_gray', name: 'Bê Tông Đổ Đường', price: 110, category: 'floor', value: '#7f8c8d', icon: '🛣️' },
    { id: 'floor_slime', name: 'Khối Nhầy Tưng Tưng', price: 400, category: 'floor', value: '#55efc4', icon: '🟩' },
    { id: 'build_door', name: 'Cửa Gỗ', price: 120, category: 'furniture', icon: '🚪' },
    { id: 'build_window', name: 'Cửa Sổ Kính', price: 200, category: 'paint', value: 'rgba(129, 236, 236, 0.4)', icon: '🪟' },
    { id: 'build_stair', name: 'Cầu Thang', price: 150, category: 'paint', value: '#95a5a6', icon: '🪜' },
    { id: 'build_fence', name: 'Hàng Rào', price: 80, category: 'paint', value: '#8b4513', icon: '🚧' },
    // Khối voxel mở rộng cho chế độ đào/đặt
    { id: 'voxel_coal', name: 'Quặng Than', price: 45, category: 'paint', value: '#3d3d3d', icon: '⚫' },
    { id: 'voxel_iron', name: 'Quặng Sắt', price: 65, category: 'paint', value: '#b2bec3', icon: '⛏️' },
    { id: 'voxel_copper', name: 'Quặng Đồng', price: 70, category: 'paint', value: '#c86b3c', icon: '🟠' },
    { id: 'voxel_gold', name: 'Quặng Vàng', price: 110, category: 'paint', value: '#f1c40f', icon: '🟡' },
    { id: 'voxel_redstone', name: 'Quặng Đá Đỏ', price: 95, category: 'paint', value: '#c0392b', icon: '🔴' },
    { id: 'voxel_emerald', name: 'Quặng Ngọc Lục Bảo', price: 150, category: 'paint', value: '#2ecc71', icon: '🟢' },
    { id: 'voxel_diamond', name: 'Quặng Kim Cương', price: 220, category: 'paint', value: '#5dade2', icon: '💎' },
    { id: 'voxel_amethyst', name: 'Thạch Anh Tím', price: 180, category: 'paint', value: '#9b59b6', icon: '🟣' },
    { id: 'voxel_moss', name: 'Đá Phủ Rêu', price: 55, category: 'paint', value: '#6ab04c', icon: '🌱' },
    { id: 'voxel_glow', name: 'Khối Phát Sáng', price: 120, category: 'paint', value: '#f9ca24', icon: '💡' },
    { id: 'voxel_bookshelf', name: 'Khối Kệ Sách', price: 95, category: 'paint', value: '#8e5b3a', icon: '📚' },
    { id: 'voxel_hay', name: 'Kiện Rơm', price: 35, category: 'floor', value: '#f6e58d', icon: '🌾' },
    { id: 'voxel_wool_white', name: 'Len Trắng', price: 40, category: 'floor', value: '#f5f6fa', icon: '🐑' },
    { id: 'voxel_wool_pink', name: 'Len Hồng', price: 45, category: 'floor', value: '#fd79a8', icon: '🩷' },
    { id: 'voxel_coral', name: 'San Hô', price: 85, category: 'floor', value: '#ff7675', icon: '🪸' },
    { id: 'voxel_mud', name: 'Bùn Đầm Lầy', price: 30, category: 'floor', value: '#6d4c41', icon: '🟫' },
    { id: 'voxel_cloud', name: 'Mây Xốp', price: 110, category: 'floor', value: '#ecf0f1', icon: '☁️' },
    { id: 'survival_stone', name: 'Đá Sinh Tồn', price: 999999, category: 'survival', value: '#747d8c', icon: '🪨', purchasable: false },
    { id: 'survival_deepslate', name: 'Đá Sâu / Móng Đá', price: 999999, category: 'survival', value: '#3f4852', icon: '🧱', purchasable: false },
    { id: 'survival_log', name: 'Gỗ Thô', price: 999999, category: 'survival', value: '#8b5a2b', icon: '🪵', purchasable: false },
    { id: 'survival_berry', name: 'Quả Rừng', price: 999999, category: 'survival', value: '#c0392b', icon: '🫐', purchasable: false },
    { id: 'survival_bread', name: 'Bánh Mì Sinh Tồn', price: 999999, category: 'survival', value: '#d8a24a', icon: '🍞', purchasable: false },
    { id: 'survival_torch', name: 'Đuốc', price: 999999, category: 'survival', value: '#f9ca24', icon: '🔥', purchasable: false },
    { id: 'tool_wood_pickaxe', name: 'Cuốc Gỗ', price: 999999, category: 'survival', value: '#9c6b30', icon: '⛏️', purchasable: false },
    { id: 'tool_stone_pickaxe', name: 'Cuốc Đá', price: 999999, category: 'survival', value: '#636e72', icon: '⛏️', purchasable: false },
    { id: 'tool_iron_pickaxe', name: 'Cuốc Sắt', price: 999999, category: 'survival', value: '#b2bec3', icon: '⚒️', purchasable: false }
];
const SHOP_ITEMS = [...HOME_FURNITURE, ...MATERIALS, ...SEASONAL_SOUVENIRS];
const MINEABLE_ORES = Object.freeze({
    voxel_coal: { weight: 30 },
    voxel_iron: { weight: 24 },
    voxel_copper: { weight: 20 },
    voxel_gold: { weight: 10 },
    voxel_redstone: { weight: 8 },
    voxel_emerald: { weight: 4 },
    voxel_diamond: { weight: 2 },
    voxel_amethyst: { weight: 2 }
});
const mineCooldowns = new Map();
const survivalLocks = new Map();
const survivalActionCooldowns = new Map();
const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 120 },
    content: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: ['info', 'event', 'warning'], default: 'info' },
    targetUsername: { type: String, default: null, index: true },
    date: { type: Date, default: Date.now, index: true }
});

const robuxRedemptionSchema = new mongoose.Schema({
    requestCode: { type: String, required: true, unique: true, index: true },
    gameUsername: { type: String, required: true, index: true },
    robloxUsername: { type: String, required: true, maxlength: 20 },
    robloxUserId: { type: String, default: '', maxlength: 24 },
    pointsSpent: { type: Number, required: true, min: 1 },
    robuxAmount: { type: Number, required: true, min: 1 },
    status: {
        type: String,
        enum: ['pending', 'approved', 'paid', 'rejected', 'cancelled'],
        default: 'pending',
        index: true
    },
    adminNote: { type: String, default: '', maxlength: 500 },
    processedBy: { type: String, default: '' },
    processedAt: { type: Date, default: null }
}, { timestamps: true });

robuxRedemptionSchema.index({ gameUsername: 1, createdAt: -1 });
robuxRedemptionSchema.index({ status: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
const RobuxRedemption = mongoose.model('RobuxRedemption', robuxRedemptionSchema);

// --- DANH SÁCH VẬT PHẨM NÂNG CẤP (FULL OPTION) ---
const Tournament = mongoose.model('Tournament', tournamentSchema);
const LearningRecord = mongoose.model('LearningRecord', learningRecordSchema);
const LearningSetting = mongoose.model('LearningSetting', learningSettingSchema);
const LearningProfile = mongoose.model('LearningProfile', learningProfileSchema);
const LearningNote = mongoose.model('LearningNote', learningNoteSchema);
const LearningSelfAssessment = mongoose.model('LearningSelfAssessment', learningSelfAssessmentSchema);
const LearningPractical = mongoose.model('LearningPractical', learningPracticalSchema);
const LearningActivity = mongoose.model('LearningActivity', learningActivitySchema);
const User = mongoose.model('User', userSchema);
async function syncAdminFromEnvironment() {
    const configuredPassword = process.env.ADMIN_PASSWORD || (!IS_PRODUCTION ? 'AdminDev123!' : '');
    if (!configuredPassword || configuredPassword.length < 10 || configuredPassword.length > 72) {
        throw new Error('ADMIN_PASSWORD phải dài từ 10 đến 72 ký tự.');
    }

    let admin = await User.findOne({ username: 'Admin' });
    if (!admin) {
        admin = new User({
            username: 'Admin',
            password: await bcrypt.hash(configuredPassword, 10),
            role: 'admin',
            chessLevel: 100, caroLevel: 100, memoryLevel: 100, crosswordLevel: 100,
            detectiveLevel: 100, goLevel: 100, othelloLevel: 100, storyLevel: 100,
            shapeLevel: 100, buildLevel: 100, paintingLevel: 100, monopolyLevel: 100,
            vietSpeechLevel: 100, englishSpeechLevel: 100,
            score: 9999
        });
        await admin.save();
        console.log('🚀 Đã tạo tài khoản Admin từ ADMIN_PASSWORD.');
        return;
    }

    const passwordMatches = await bcrypt.compare(configuredPassword, admin.password);
    let changed = false;
    if (!passwordMatches) {
        admin.password = await bcrypt.hash(configuredPassword, 10);
        changed = true;
    }
    if (admin.role !== 'admin') {
        admin.role = 'admin';
        changed = true;
    }
    if (changed) {
        await admin.save();
        console.log('🔐 Đã đồng bộ mật khẩu/quyền Admin theo Environment.');
    } else {
        console.log('✅ Mật khẩu Admin đã khớp với Environment.');
    }
}

let mongoConnectTimer = null;
let mongoLastError = '';
let platformMigrationState = 'NOT_RUN';
let platformMigrationFailures = [];
let platformMigrationUpdatedAt = null;
async function afterMongoConnected() {
    platformMigrationState = 'RUNNING';
    platformMigrationUpdatedAt = new Date().toISOString();
    platformMigrationFailures = [];
    try {
        const migrationResults = await runPlatformMigrations({ connection: mongoose.connection, logger: console });
        platformMigrationFailures = (migrationResults || []).filter(item => item && item.ok === false).map(item => ({ id: item.id, error: String(item.error || 'Migration thất bại').slice(0, 300) }));
        platformMigrationState = platformMigrationFailures.length ? 'FAILED' : 'READY';
        if (platformMigrationState === 'FAILED') console.error(`⚠️ Có ${platformMigrationFailures.length} migration lỗi. Readiness sẽ không đạt cho đến khi khắc phục.`);
    } catch (error) {
        platformMigrationState = 'FAILED';
        platformMigrationFailures = [{ id: 'MIGRATION_RUNNER', error: String(error?.message || error).slice(0, 300) }];
        console.error('⚠️ Không thể chạy learning catalog migrations:', error.message);
    }
    try {
        await syncAdminFromEnvironment();
    } catch (error) {
        // Không làm sập toàn bộ website chỉ vì ADMIN_PASSWORD cũ/thiếu.
        // Admin hiện có vẫn được giữ nguyên; quản trị viên sửa Environment rồi triển khai lại.
        console.error('⚠️ Bỏ qua đồng bộ Admin:', error.message);
    }
    try {
        await Tournament.updateMany(
            { organizerType: { $exists: false } },
            { $set: { organizerType: 'official', creator: 'admin', pointMode: 'official-score', minParticipants: 2, maxParticipants: 128, entryFee: 0, escrowBalance: 0 } }
        );
    } catch (error) {
        console.error('⚠️ Không thể nâng dữ liệu giải đấu:', error.message);
    }
}
async function connectMongoWithRetry() {
    if (!MONGO_URI || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
    try {
        await mongoose.connect(MONGO_URI, {
            maxPoolSize: readEnvInt('MONGO_MAX_POOL_SIZE', 10, 1, 100),
            minPoolSize: readEnvInt('MONGO_MIN_POOL_SIZE', 0, 0, 20),
            maxIdleTimeMS: readEnvInt('MONGO_MAX_IDLE_TIME_MS', 60000, 10000, 300000),
            waitQueueTimeoutMS: readEnvInt('MONGO_WAIT_QUEUE_TIMEOUT_MS', 10000, 1000, 60000),
            serverSelectionTimeoutMS: readEnvInt('MONGO_SERVER_SELECTION_TIMEOUT_MS', 12000, 3000, 60000),
            connectTimeoutMS: readEnvInt('MONGO_CONNECT_TIMEOUT_MS', 12000, 3000, 60000),
            socketTimeoutMS: readEnvInt('MONGO_SOCKET_TIMEOUT_MS', 45000, 5000, 180000)
        });
        mongoLastError = '';
        console.log('✅ Đã kết nối MongoDB thành công!');
        await afterMongoConnected();
    } catch (error) {
        mongoLastError = String(error?.message || error).slice(0, 300);
        console.error('❌ Lỗi kết nối MongoDB, sẽ tự thử lại:', mongoLastError);
        clearTimeout(mongoConnectTimer);
    clearInterval(questExpiryTimer);
    clearInterval(tournamentMaintenanceTimer);
    stopAIGenerationWorker();
        mongoConnectTimer = setTimeout(connectMongoWithRetry, 15000);
    }
}
connectMongoWithRetry();
mongoose.connection.on('disconnected', () => {
    platformMigrationState = 'DISCONNECTED';
    platformMigrationFailures = [];
    console.warn('⚠️ MongoDB mất kết nối. Đang lên lịch kết nối lại.');
    clearTimeout(mongoConnectTimer);
    clearInterval(questExpiryTimer);
    clearInterval(tournamentMaintenanceTimer);
    stopAIGenerationWorker();
    mongoConnectTimer = setTimeout(connectMongoWithRetry, 5000);
});
// API chẩn đoán công khai được đăng ký trước session store để vẫn phản hồi khi MongoDB gián đoạn.
app.get('/api/health', (req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;
    // Health check của Render phải phản ánh tiến trình Node còn sống, tránh vòng lặp 503
    // khi MongoDB chỉ mất kết nối tạm thời.
    res.status(200).json({
        status: mongoReady ? 'ok' : 'degraded',
        database: mongoReady ? 'connected' : 'disconnected',
        mongoState: mongoose.connection.readyState,
        lastDatabaseError: mongoReady ? '' : mongoLastError,
        uptimeSeconds: Math.floor(process.uptime()),
        version: APP_VERSION
    });
});
app.get('/api/ready', (req, res) => {
    const mongoReady = mongoose.connection.readyState === 1;
    const sessionConfigured = String(process.env.SESSION_SECRET || '').length >= 32;
    const migrationsReady = platformMigrationState === 'READY';
    const ready = mongoReady && migrationsReady && (!IS_PRODUCTION || sessionConfigured);
    res.status(ready ? 200 : 503).json({ ready, database: mongoReady ? 'connected' : 'disconnected', migrations: { state: platformMigrationState, failures: platformMigrationFailures, updatedAt: platformMigrationUpdatedAt }, sessionSecretConfigured: sessionConfigured, version: APP_VERSION });
});


// --- 3. CẤU HÌNH MIDDLEWARE ---
let sessionSecret = String(process.env.SESSION_SECRET || '');
if (sessionSecret.length < 32) {
    sessionSecret = crypto.randomBytes(48).toString('hex');
    console.warn('⚠️ SESSION_SECRET thiếu hoặc quá ngắn; đã dùng khóa ngẫu nhiên chỉ tồn tại trong tiến trình hiện tại. Hãy đặt SESSION_SECRET dài tối thiểu 32 ký tự trong môi trường triển khai để phiên đăng nhập không bị mất khi khởi động lại.');
}
const sessionOptions = {
    name: 'hanhtrinh.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
};
if (MONGO_URI) {
    try {
        const sessionStore = MongoStore.create({ mongoUrl: MONGO_URI, ttl: 24 * 60 * 60, autoRemove: 'native' });
        sessionStore.on('error', error => console.error('⚠️ Lỗi kho phiên đăng nhập:', error.message));
        sessionOptions.store = sessionStore;
    } catch (error) {
        console.error('⚠️ Không tạo được Mongo session store, tạm dùng MemoryStore:', error.message);
    }
} else {
    console.warn('⚠️ Đang dùng MemoryStore tạm thời vì thiếu Mongo URI.');
}
const sessionMiddleware = session(sessionOptions);
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const fetchSite = String(req.get('Sec-Fetch-Site') || '').toLowerCase();
    if (fetchSite === 'cross-site') return res.status(403).json({ message: 'Yêu cầu khác nguồn đã bị chặn.' });
    const origin = req.get('Origin');
    if (IS_PRODUCTION && origin) {
        try {
            if (new URL(origin).host !== req.get('host')) return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
        } catch {
            return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' });
        }
    }
    next();
});
app.use('/api', createApiRateLimiter());
app.use('/api', createRequestLogger());
app.use((req, res, next) => {
    if (req.path === '/admin-panel.html' || req.path === '/admin-panel') {
        if (!req.session?.user) return res.redirect('/login.html');
        if (!hasPermission(req.session.user.role, 'system.manage')) return res.status(403).send('Bạn không có quyền quản trị.');
        return res.redirect('/admin/');
    }
    if (req.path === '/admin' || req.path.startsWith('/admin/')) {
        if (!req.session?.user) return res.redirect('/login.html');
        if (!hasPermission(req.session.user.role, 'system.manage')) return res.status(403).send('Bạn không có quyền truy cập Admin Application.');
    }
    if (req.path === '/phu-huynh.html' && req.session?.user?.role !== 'parent') {
        return res.redirect('/login.html');
    }
    next();
});
// Never expose the repository root as a static directory: it contains server code,
// migrations, package metadata and deployment configuration. Only known browser assets
// and top-level HTML pages are eligible for delivery.
const disabledLegacyGamePages = new Set(['/caro.html', '/co-ty-phu.html', '/co-vay.html', '/othello.html', '/choi-co.html', '/dau-truong-thu-thach.html']);
const privateRootPaths = new Set(['/server.js', '/package.json', '/package-lock.json', '/.env', '/.env.example']);
const publicRootScripts = new Set(['/global-client.js', '/heartbeat.js', '/modern-ui.js', '/tournament-v9.js', '/stockfish.js']);
const publicRootBinaryAssets = new Set(['/stockfish.wasm']);
const publicRootStyles = new Set(['/style.css', '/modern-ui.css', '/tournament-v9.css']);
const publicRootHtml = new Set(fs.readdirSync(__dirname, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map(entry => `/${entry.name}`)
    .filter(file => !disabledLegacyGamePages.has(file)));
const rootStatic = express.static(__dirname, publicStaticOptions);
const adminStatic = express.static(path.join(__dirname, 'admin'), publicStaticOptions);
app.use('/admin', adminStatic);
app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch { return res.status(400).end(); }
    if (privateRootPaths.has(pathname) || disabledLegacyGamePages.has(pathname)) return res.status(404).end();
    if (publicRootHtml.has(pathname) || publicRootScripts.has(pathname) || publicRootBinaryAssets.has(pathname) || publicRootStyles.has(pathname)) return rootStatic(req, res, next);
    return next();
});

// --- 4. TRẠNG THÁI SERVER (IN-MEMORY) ---
const gameRooms = {};
const waitingPlayers = {};
const monopolyQueue = [];
let maintenanceMode = false;

function requireAuth(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' });
    }
    next();
}

function publicSessionUser(user) {
    if (!user) return null;
    return { username: user.username, role: user.role };
}

function requireAdmin(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' });
    }
    // RBAC (Phase 2): kiểm quyền qua permission map thay vì so role cứng.
    // admin → system.manage = true (giữ nguyên behavior cũ), child/parent → false.
    if (!hasPermission(req.session.user.role, 'system.manage')) {
        return res.status(403).json({ message: 'Bạn không có quyền quản trị.' });
    }
    next();
}

function requireParent(req, res, next) {
    if (!req.session?.user || req.session.user.role !== 'parent') {
        return res.status(403).json({ message: 'Chỉ tài khoản phụ huynh mới được truy cập.' });
    }
    next();
}

function clampInteger(value, min, max, fallback = min) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function normalizeUsername(value) {
    return String(value || '').trim();
}
function normalizeTournamentTitle(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function makeJoinCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

async function ensureArenaWallet(username) {
    await User.updateOne(
        { username, arenaWelcomeGranted: { $ne: true } },
        {
            $set: { arenaWelcomeGranted: true },
            $inc: { arenaPoints: ARENA_WELCOME_POINTS },
            $push: { history: { $each: [{ activity: `🎟️ Nhận ${ARENA_WELCOME_POINTS} Điểm Đấu Trường khởi đầu`, referenceId: `ARENA_WELCOME:${username}`, timestamp: new Date() }], $slice: -300 } }
        }
    );
    return User.findOne({ username }).select('username role arenaPoints arenaWelcomeGranted isSuspended');
}

async function creditArenaPoints(username, amount, referenceId, activity) {
    const points = Math.max(0, Math.floor(Number(amount) || 0));
    if (!username || !points || !referenceId) return false;
    const result = await User.updateOne(
        { username, 'history.referenceId': { $ne: referenceId } },
        { $inc: { arenaPoints: points }, $push: { history: { $each: [{ activity, referenceId, timestamp: new Date() }], $slice: -300 } } }
    );
    return Boolean(result.modifiedCount);
}

function isValidTournamentId(value) {
    return mongoose.isValidObjectId(String(value || ''));
}

function sanitizeTournament(tourney, viewer = '') {
    const value = typeof tourney?.toObject === 'function' ? tourney.toObject() : { ...(tourney || {}) };
    if (value.visibility === 'private' && value.creator !== viewer) delete value.joinCode;
    value.isCreator = Boolean(viewer && value.creator === viewer);
    value.isParticipant = Boolean(viewer && (value.participants || []).includes(viewer));
    value.availableSlots = Math.max(0, Number(value.maxParticipants || 0) - (value.participants || []).length);
    return value;
}

function getVietnamDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

function isPreviousDate(previousKey, currentKey) {
    if (!previousKey) return false;
    const previous = new Date(`${previousKey}T00:00:00+07:00`);
    const current = new Date(`${currentKey}T00:00:00+07:00`);
    return current - previous === 24 * 60 * 60 * 1000;
}

function isValidUsername(username) {
    return /^[A-Za-z0-9_À-ỹ]{3,24}$/u.test(username);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createRateLimiter({ windowMs, max, message, keyPrefix = 'global' }) {
    const buckets = new Map();
    let requestsSinceCleanup = 0;
    return (req, res, next) => {
        const now = Date.now();
        requestsSinceCleanup += 1;
        if (requestsSinceCleanup >= 500) {
            requestsSinceCleanup = 0;
            for (const [bucketKey, bucket] of buckets.entries()) if (now >= bucket.resetAt) buckets.delete(bucketKey);
        }
        const identity = req.session?.user?.username || req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${keyPrefix}:${identity}`;
        const entry = buckets.get(key);
        if (!entry || now >= entry.resetAt) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        entry.count += 1;
        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({ message });
        }
        next();
    };
}

const authRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyPrefix: 'auth',
    message: 'Bạn thao tác đăng nhập quá nhiều lần. Vui lòng thử lại sau.'
});
const aiRateLimit = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 20,
    keyPrefix: 'ai',
    message: 'Bạn đã gửi quá nhiều yêu cầu chấm AI. Hãy nghỉ vài phút rồi thử lại.'
});
const miningRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 240,
    keyPrefix: 'mine',
    message: 'Thao tác đào quá nhanh. Hãy tiếp tục với tốc độ bình thường.'
});
const tournamentRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: 40,
    keyPrefix: 'tournament',
    message: 'Bạn thao tác giải đấu quá nhanh. Hãy thử lại sau ít phút.'
});
const otpRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyPrefix: 'otp',
    message: 'Bạn yêu cầu mã xác thực quá nhiều lần. Vui lòng thử lại sau.'
});
// OTP chỉ lưu hash; transport gửi qua Resend (email) hoặc Twilio (SMS) khi biến môi trường đã cấu hình.
// Không log mã OTP hoặc nội dung yêu cầu gửi.
const otpService = createOtpService({ secret: `${sessionSecret}|otp-v1`, transport: createEnvironmentOtpTransport() });

// Trả lỗi có cấu trúc thay vì để request treo khi MongoDB đang khởi động.
app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/ready') return next();
    if (!MONGO_URI || mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Cơ sở dữ liệu đang kết nối lại. Vui lòng chờ khoảng 15 giây rồi thử lại.', code: 'DATABASE_RECONNECTING', requestId: req.requestId });
    }
    next();
});

// Bảo vệ toàn bộ API quản trị, tránh người chơi gọi trực tiếp từ trình duyệt.
app.use('/api/admin', requireAdmin);

// Education platform routes are mounted as a compatibility-preserving layer.
// Existing learning/game/admin endpoints remain below this point unchanged.
app.use('/api', createPlatformRouter({ models: platformModels, requireAuth, requirePermission, legacyUserModel: User, aiRateLimit }));
app.use('/api/ai-learning', registerAiLearningRoutes({ models: platformModels, requireAuth, requirePermission, aiRateLimit }));
app.use('/api/learning-intelligence', createLearningIntelligenceRouter({ models: platformModels, legacyModels: { LearningRecord, LearningProfile, LearningActivity }, requireAuth, aiRateLimit }));
app.use('/api/learning-system', createLearningSystemV27Router({ models: platformModels, requireAuth, requirePermission }));

// Backend session bootstrap: frontend chỉ dùng dữ liệu này để chọn application UI.
// Quyền thực tế vẫn được kiểm tra bởi middleware trên từng API và /admin/*.
app.get('/api/auth/session', requireAuth, async (req, res) => {
    const user = await User.findOne({ username: req.session.user.username }).select('username role fullName email verificationStatus isSuspended isLocked').lean();
    if (!user) return res.status(401).json({ success: false, code: 'SESSION_USER_NOT_FOUND', message: 'Phiên đăng nhập không còn hợp lệ.' });
    return res.json({ success: true, data: { user: publicSessionUser(user), profile: { fullName: user.fullName || '', email: user.email || '' }, account: { verificationStatus: user.verificationStatus || '', isSuspended: Boolean(user.isSuspended), isLocked: Boolean(user.isLocked) } } });
});

app.get('/api/admin/overview', requirePermission('system.manage'), async (req, res) => {
    const count = model => model?.countDocuments ? model.countDocuments({}) : Promise.resolve(0);
    const [users, activeUsers, courses, lessons, questions, assessments, surveys, placements, universities, english, blueprints, imports, notifications, audits] = await Promise.all([
        User.countDocuments({}), User.countDocuments({ isSuspended: { $ne: true }, isLocked: { $ne: true } }), count(platformModels.Course), count(platformModels.CurriculumContent), count(platformModels.Question), count(platformModels.Assessment), count(platformModels.Survey), count(platformModels.PlacementTest), count(platformModels.University), count(platformModels.EnglishTestConfig), count(platformModels.ExamBlueprint), count(platformModels.WordImport), count(platformModels.PlatformNotification), count(platformModels.AuditLog)
    ]);
    return res.json({ success: true, data: { users, activeUsers, content: { courses, lessons, questions, assessments, surveys, placements, universities, english, blueprints, imports, notifications, audits }, generatedAt: new Date().toISOString() } });
});

// --- 5. API HỆ THỐNG (AUTH) ---
app.post('/api/house/save-drawing', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
    const { level, image } = req.body;
    
    // 1. Tìm user trong cơ sở dữ liệu
    const user = await User.findOne({ username: req.session.user.username });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    // 2. Lưu bức tranh
    user.galleryDrawings.push({ level, image, date: new Date() });
    
    // 3. KÍCH HOẠT NHIỆM VỤ "Vẽ Tranh"
    updateQuestProgress(user, 'Vẽ Tranh', { timeTaken: 0, isWin: true });
    
    // 4. Lưu lại toàn bộ vào Database
    user.markModified('galleryDrawings');
    user.markModified('quests');
    await user.save();
    
    res.json({ message: "Bức tranh đã được đưa vào triển lãm và nhiệm vụ đã hoàn thành!" });
});

// 1. Kho nhiệm vụ đa dạng (Đã được căn chỉnh khớp 100% với tên API)
const QUEST_POOL = [
    // --- 1. Nhóm Tư Duy & Logic ---
    { taskType: 'Cờ Vua', levelKey: 'chessLevel', targetBase: 1, rewardBase: 50, penaltyBase: 20, timeLimitBase: 86400 },
    { taskType: 'Cờ Vây', levelKey: 'goLevel', targetBase: 1, rewardBase: 100, penaltyBase: 50, timeLimitBase: 86400 },
    { taskType: 'Phục Kích', levelKey: 'othelloLevel', targetBase: 1, rewardBase: 50, penaltyBase: 20, timeLimitBase: 86400 },
    { taskType: 'Cờ Caro', levelKey: 'caroLevel', targetBase: 2, rewardBase: 50, penaltyBase: 15, timeLimitBase: 86400 },

    // --- 2. Nhóm Sáng Tạo & Ngôn Ngữ ---
    { taskType: 'Sáng Tác', levelKey: 'storyLevel', targetBase: 1, rewardBase: 80, penaltyBase: 20, timeLimitBase: 86400 },
    { taskType: 'Tiếng Anh', levelKey: 'englishSpeechLevel', targetBase: 2, rewardBase: 40, penaltyBase: 15, timeLimitBase: 86400 },
    { taskType: 'Luyện Nói Việt', levelKey: 'vietSpeechLevel', targetBase: 2, rewardBase: 40, penaltyBase: 15, timeLimitBase: 86400 },

    // --- 3. Nhóm Giải Trí & Kỹ Năng ---
    { taskType: 'Âm Nhạc', levelKey: 'musicLevel', targetBase: 1, rewardBase: 40, penaltyBase: 10, timeLimitBase: 86400 },
    { taskType: 'Thám tử', levelKey: 'detectiveLevel', targetBase: 1, rewardBase: 60, penaltyBase: 25, timeLimitBase: 86400 },
    { taskType: 'Ghép Hình', levelKey: 'shapeLevel', targetBase: 2, rewardBase: 40, penaltyBase: 15, timeLimitBase: 86400 }, // shapeLevel -> Ghép Hình
    { taskType: 'Xây Dựng', levelKey: 'buildLevel', targetBase: 1, rewardBase: 50, penaltyBase: 20, timeLimitBase: 86400 },
    { taskType: 'Trí Nhớ', levelKey: 'memoryLevel', targetBase: 2, rewardBase: 30, penaltyBase: 10, timeLimitBase: 86400 }, // memoryLevel -> Trí Nhớ
    { taskType: 'Ô Chữ', levelKey: 'crosswordLevel', targetBase: 1, rewardBase: 40, penaltyBase: 15, timeLimitBase: 86400 },

    // --- 4. Các môn đặc biệt (Vẽ tranh, Bài kiểm tra) ---
    { taskType: 'Kiểm Tra', levelKey: 'testLevel', targetBase: 1, rewardBase: 100, penaltyBase: 30, timeLimitBase: 86400 },
    { taskType: 'Vẽ Tranh', levelKey: 'paintingLevel', targetBase: 1, rewardBase: 50, penaltyBase: 10, timeLimitBase: 86400 }
];
// 2. Hàm tự động cấp 4 nhiệm vụ "hợp trình độ" mỗi ngày
async function refreshDailyQuests(user) {
    const today = new Date().toDateString();
    const hasDailyToday = user.quests.some(q => q.isDaily && q.date === today);

    if (!hasDailyToday) {
        // Xóa nhiệm vụ cũ của ngày hôm trước
        user.quests = user.quests.filter(q => !q.isDaily);
        
        const shuffled = [...QUEST_POOL].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 4);

        selected.forEach(q => {
            const currentLvl = user[q.levelKey] || 1;
            const dynamicTarget = q.targetBase + Math.floor(currentLvl / 5); 
            const dynamicReward = q.rewardBase + (currentLvl * 5);

            user.quests.push({
                id: 'd-' + Math.random().toString(36).substr(2, 5),
                startTime: Date.now(), // <--- QUAN TRỌNG: Để đồng hồ ở nhiem-vu.html có thể chạy
                taskType: q.taskType,
                target: dynamicTarget,
                reward: dynamicReward,
                penalty: q.penaltyBase || 20,    // Nạp điểm phạt từ kho nhiệm vụ
                timeLimit: q.timeLimitBase || 0, // Nạp thời gian giới hạn từ kho nhiệm vụ
                progress: 0,
                isDaily: true,
                date: today
            });
        });
        
        user.markModified('quests');
        await user.save();
    }
}
// --- API LẤY BẢNG XẾP HẠNG (BXH) ---
app.get('/api/leaderboard', async (req, res) => {
    try {
        // Lấy top 10 người dùng có điểm cao nhất, chỉ lấy các tài khoản là 'child'
        const topPlayers = await User.find({ role: 'child' })
            .sort({ score: -1 }) // Sắp xếp điểm giảm dần
            .limit(10)           // Chỉ lấy 10 người đứng đầu
            .select('username score chessLevel'); // Chỉ lấy tên và điểm để bảo mật
        res.json(topPlayers);
    } catch (e) {
        res.status(500).json({ message: 'Lỗi khi tải bảng xếp hạng' });
    }
});
// --- API ĐĂNG KÝ / ĐĂNG NHẬP ---
app.post('/api/register', authRateLimit, async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!isValidUsername(username)) {
        return res.status(400).json({
            message: 'Tên đăng nhập phải dài 3–24 ký tự và chỉ gồm chữ, số hoặc dấu gạch dưới.',
            code: 'VALIDATION_ERROR',
            details: [{ field: 'username', message: 'Tên đăng nhập không hợp lệ.' }]
        });
    }
    if (username.toLowerCase() === 'admin') {
        return res.status(400).json({ message: 'Tên đăng nhập này đã được dành riêng.', code: 'VALIDATION_ERROR', details: [{ field: 'username', message: 'Tên đăng nhập này đã được dành riêng.' }] });
    }
    if (password.length < 6 || password.length > 72) {
        return res.status(400).json({ message: 'Mật khẩu phải dài từ 6 đến 72 ký tự.', code: 'VALIDATION_ERROR', details: [{ field: 'password', message: 'Mật khẩu phải dài từ 6 đến 72 ký tự.' }] });
    }
    // --- PHASE 2: đăng ký v2 bắt buộc hồ sơ (họ tên/email/SĐT/ngày sinh/game ID).
    // Backend validate chặt từng trường; KHÔNG đọc role/verified từ client.
    const registration = validateRegistration(req.body || {});
    if (!registration.ok) {
        const firstError = registration.errors[0];
        return res.status(400).json({
            message: firstError.message,
            code: 'VALIDATION_ERROR',
            details: registration.errors
        });
    }
    const { fullName, email, phone, dob, age, gameId } = registration.values;

    try {
        const existingUser = await User.findOne({
            username: { $regex: new RegExp(`^${escapeRegExp(username)}$`, 'i') }
        }).lean();

        if (existingUser) {
            return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại!', code: 'CONFLICT', details: [{ field: 'username', message: 'Tên đăng nhập đã tồn tại.' }] });
        }
        const [emailTaken, phoneTaken, gameIdTaken] = await Promise.all([
            User.findOne({ email }).lean(),
            User.findOne({ phone }).lean(),
            User.findOne({ gameId: { $regex: new RegExp(`^${escapeRegExp(gameId)}$`, 'i') } }).lean()
        ]);
        if (emailTaken) {
            return res.status(409).json({ message: 'Email đã được sử dụng cho tài khoản khác.', code: 'CONFLICT', details: [{ field: 'email', message: 'Email đã được sử dụng cho tài khoản khác.' }] });
        }
        if (phoneTaken) {
            return res.status(409).json({ message: 'Số điện thoại đã được sử dụng cho tài khoản khác.', code: 'CONFLICT', details: [{ field: 'phone', message: 'Số điện thoại đã được sử dụng cho tài khoản khác.' }] });
        }
        if (gameIdTaken) {
            return res.status(409).json({ message: 'ID trong game đã được sử dụng.', code: 'CONFLICT', details: [{ field: 'gameId', message: 'ID trong game đã được sử dụng.' }] });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            username,
            password: hashedPassword,
            role: 'child',
            parentCode: null,
            fullName,
            email,
            phone,
            dob,
            age,
            gameId,
            emailVerified: false,
            phoneVerified: false,
            verificationStatus: 'EMAIL_UNVERIFIED',
            educationStatus: '',
            educationGrade: null,
            lastActiveAt: new Date()
        });

        // Keep the newer learning profile in sync with the legacy account record.
        // Registration must still succeed if this secondary projection needs repair;
        // /api/education/profile also has a safe fallback to the account record.
        try {
            await platformModels.Profile.findOneAndUpdate(
                { username },
                { $set: { username, fullName, dob } },
                { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
            );
        } catch (profileSyncError) {
            console.warn('Không thể đồng bộ hồ sơ sau đăng ký; dữ liệu tài khoản vẫn được giữ:', profileSyncError.message);
        }

        res.status(201).json({
            message: 'Đăng ký thành công! Hãy đăng nhập để chơi nhé.',
            user: {
                username: newUser.username,
                role: newUser.role,
                verificationStatus: computeVerificationStatus(newUser)
            },
            // Ticket ngắn hạn (30 phút) để xác minh email/SĐT ngay, kể cả trước khi đăng nhập.
            verificationTicket: otpService.createTicket(newUser.username)
        });
    } catch (error) {
        if (error?.code === 11000) {
            const indexedField = Object.keys(error?.keyPattern || {})[0] || '';
            const duplicateMessage = indexedField === 'email'
                ? 'Email đã được sử dụng cho tài khoản khác.'
                : indexedField === 'phone'
                    ? 'Số điện thoại đã được sử dụng cho tài khoản khác.'
                    : indexedField === 'gameId'
                        ? 'ID trong game đã được sử dụng.'
                        : 'Tên đăng nhập đã tồn tại!';
            const duplicateField = ['email', 'phone', 'gameId'].includes(indexedField)
                ? indexedField
                : 'username';
            return res.status(409).json({ message: duplicateMessage, code: 'CONFLICT', details: [{ field: duplicateField, message: duplicateMessage }] });
        }
        console.error('Lỗi đăng ký:', error);
        res.status(500).json({ message: 'Không thể đăng ký lúc này. Vui lòng thử lại.' });
    }
});

app.post('/api/login', authRateLimit, async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!username || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
    }

    try {
        // Bảo đảm mật khẩu Admin luôn khớp với Environment ngay cả khi
        // người dùng đăng nhập trong lúc dịch vụ vừa khởi động lại.
        if (username.toLowerCase() === 'admin') await syncAdminFromEnvironment();

        const user = await User.findOne({
            username: { $regex: new RegExp(`^${escapeRegExp(username)}$`, 'i') }
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Sai tên đăng nhập hoặc mật khẩu!' });
        }
        if (user.isSuspended || user.isLocked) {
            return res.status(403).json({ message: user.isLocked ? 'Tài khoản đang bị khóa đăng nhập!' : 'Tài khoản đã bị khóa!' });
        }
        if (maintenanceMode && user.role !== 'admin') {
            return res.status(503).json({ message: 'Hệ thống đang bảo trì. Vui lòng quay lại sau.' });
        }

        const today = getVietnamDateKey();
        if (user.lastLoginDate !== today) {
            user.loginStreak = isPreviousDate(user.lastLoginDate, today)
                ? Math.max(1, user.loginStreak || 0) + 1
                : 1;
            user.lastLoginDate = today;
        }
        user.lastActiveAt = new Date();
        await user.save();

        await new Promise((resolve, reject) => {
            req.session.regenerate(error => {
                if (error) return reject(error);
                req.session.user = { username: user.username, role: user.role };
                req.session.save(saveError => saveError ? reject(saveError) : resolve());
            });
        });

        res.json({
            message: 'Đăng nhập thành công!',
            user: {
                username: user.username,
                role: user.role,
                parentCode: user.parentCode,
                children: user.children,
                loginStreak: user.loginStreak,
                // PHASE 2: backend là nguồn duy nhất của trạng thái xác thực.
                verificationStatus: computeVerificationStatus(user)
            }
        });
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ message: 'Lỗi đăng nhập. Vui lòng thử lại.' });
    }
});

app.post('/api/logout', (req, res) => {
    if (!req.session) return res.json({ message: 'Đăng xuất thành công' });
    req.session.destroy(error => {
        res.clearCookie('hanhtrinh.sid');
        if (error) {
            return res.status(500).json({ message: 'Không thể đăng xuất. Vui lòng thử lại.' });
        }
        res.json({ message: 'Đăng xuất thành công' });
    });
});

// --- PHASE 2: xác thực email/SĐT bằng OTP ---
// Chấp nhận session đăng nhập HOẶC verificationTicket (đăng ký trước, đăng nhập sau).
// Mã OTP chỉ lưu hash, không log plaintext; transport chưa cấu hình → trả sent:false trung thực.
async function resolveVerificationIdentity(req) {
    const sessionUsername = req.session?.user?.username;
    if (sessionUsername) {
        const user = await User.findOne({ username: sessionUsername });
        return { user, source: 'session' };
    }
    const ticket = String(req.body?.verificationTicket || req.query?.verificationTicket || '').trim();
    if (ticket) {
        const checked = otpService.verifyTicket(ticket);
        if (checked.ok) {
            const user = await User.findOne({ username: checked.username });
            return { user, source: 'ticket' };
        }
        return { error: { status: checked.reason === 'EXPIRED' ? 410 : 401, message: checked.reason === 'EXPIRED' ? 'Liên kết xác minh đã hết hạn. Hãy đăng nhập để yêu cầu mã mới.' : 'Liên kết xác minh không hợp lệ.' } };
    }
    return { error: { status: 401, message: 'Vui lòng đăng nhập hoặc dùng liên kết xác minh sau khi đăng ký.' } };
}

app.post('/api/auth/otp/request', otpRateLimit, async (req, res) => {
    const channel = String(req.body?.channel || '').trim();
    if (channel !== 'email' && channel !== 'phone') {
        return res.status(400).json({ success: false, code: 'CHANNEL_INVALID', message: 'Kênh xác thực phải là email hoặc phone.' });
    }
    try {
        const identity = await resolveVerificationIdentity(req);
        if (identity.error) return res.status(identity.error.status).json({ success: false, code: 'UNAUTHORIZED', message: identity.error.message });
        const targetUser = identity.user;
        if (!targetUser) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản.' });
        if (targetUser.isSuspended || targetUser.isLocked) return res.status(403).json({ success: false, code: targetUser.isLocked ? 'LOCKED' : 'SUSPENDED', message: targetUser.isLocked ? 'Tài khoản đang bị khóa.' : 'Tài khoản đã bị đình chỉ.' });

        const identifier = channel === 'email' ? (targetUser.email || '') : (targetUser.phone || '');
        if (!identifier) {
            return res.status(400).json({ success: false, code: 'CHANNEL_MISSING', message: channel === 'email' ? 'Tài khoản chưa có email. Hãy cập nhật hồ sơ.' : 'Tài khoản chưa có số điện thoại. Hãy cập nhật hồ sơ.' });
        }
        if (channel === 'email' && targetUser.emailVerified) {
            return res.status(409).json({ success: false, code: 'ALREADY_VERIFIED', message: 'Email đã được xác minh.' });
        }
        if (channel === 'phone' && targetUser.phoneVerified) {
            return res.status(409).json({ success: false, code: 'ALREADY_VERIFIED', message: 'Số điện thoại đã được xác minh.' });
        }

        const result = await otpService.issue({ purpose: 'registration', channel, identifier });
        if (!result.ok) {
            const status = result.reason === 'RATE_LIMITED' ? 429 : 400;
            return res.status(status).json({ success: false, code: result.reason, message: result.message });
        }
        if (!result.sent) {
            return res.status(202).json({
                success: false,
                code: 'TRANSPORT_NOT_CONFIGURED',
                message: 'Chưa cấu hình được nhà cung cấp gửi mã xác minh cho kênh này. Vui lòng báo quản trị viên kiểm tra biến môi trường OTP.',
                data: { expiresInMinutes: result.expiresInMinutes }
            });
        }
        return res.json({
            success: true,
            message: channel === 'email' ? 'Đã gửi mã xác minh tới email của bạn.' : 'Đã gửi mã xác minh tới số điện thoại của bạn.',
            data: { expiresInMinutes: result.expiresInMinutes }
        });
    } catch (error) {
        console.error('Lỗi yêu cầu OTP:', error.message);
        return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Không thể gửi mã lúc này. Vui lòng thử lại.' });
    }
});

app.post('/api/auth/otp/verify', otpRateLimit, async (req, res) => {
    const channel = String(req.body?.channel || '').trim();
    const code = String(req.body?.code || '').trim();
    if (channel !== 'email' && channel !== 'phone') {
        return res.status(400).json({ success: false, code: 'CHANNEL_INVALID', message: 'Kênh xác thực phải là email hoặc phone.' });
    }
    if (!code) {
        return res.status(400).json({ success: false, code: 'CODE_REQUIRED', message: 'Vui lòng nhập mã xác minh.' });
    }
    try {
        const identity = await resolveVerificationIdentity(req);
        if (identity.error) return res.status(identity.error.status).json({ success: false, code: 'UNAUTHORIZED', message: identity.error.message });
        const targetUser = identity.user;
        if (!targetUser) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản.' });
        if (targetUser.isSuspended || targetUser.isLocked) return res.status(403).json({ success: false, code: targetUser.isLocked ? 'LOCKED' : 'SUSPENDED', message: targetUser.isLocked ? 'Tài khoản đang bị khóa.' : 'Tài khoản đã bị đình chỉ.' });

        const identifier = channel === 'email' ? (targetUser.email || '') : (targetUser.phone || '');
        if (!identifier) {
            return res.status(400).json({ success: false, code: 'CHANNEL_MISSING', message: 'Tài khoản chưa có thông tin liên hệ trên kênh này.' });
        }
        const result = await otpService.verify({ purpose: 'registration', channel, identifier, code });
        if (!result.ok) {
            const status = result.reason === 'MAX_ATTEMPTS' || result.reason === 'EXPIRED' ? 410 : 400;
            return res.status(status).json({ success: false, code: result.reason, message: result.message });
        }
        if (channel === 'email') targetUser.emailVerified = true;
        else targetUser.phoneVerified = true;
        targetUser.verificationStatus = computeVerificationStatus(targetUser);
        await targetUser.save();
        return res.json({
            success: true,
            message: channel === 'email' ? 'Xác minh email thành công!' : 'Xác minh số điện thoại thành công!',
            data: { verificationStatus: computeVerificationStatus(targetUser) }
        });
    } catch (error) {
        console.error('Lỗi xác minh OTP:', error.message);
        return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Không thể xác minh lúc này. Vui lòng thử lại.' });
    }
});

// --- PHASE 2: hồ sơ cá nhân (nền tách Account / Profile / Education) ---
// email/phone/gameId/role/flag xác minh KHÔNG được phép đổi qua endpoint này.
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.user.username }).lean();
        if (!user) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ.' });
        const verificationStatus = user.isSuspended ? 'SUSPENDED' : computeVerificationStatus(user);
        return res.json({
            success: true,
            data: {
                account: {
                    username: user.username,
                    role: user.role,
                    email: user.email || '',
                    phone: user.phone || '',
                    gameId: user.gameId || '',
                    verificationStatus,
                    isSuspended: Boolean(user.isSuspended)
                },
                profile: {
                    fullName: user.fullName || '',
                    dob: user.dob && user.dob.year ? user.dob : null,
                    age: user.age ?? null
                },
                education: {
                    educationStatus: user.educationStatus || '',
                    educationGrade: user.educationGrade ?? null
                }
            }
        });
    } catch (error) {
        console.error('Lỗi đọc hồ sơ:', error.message);
        return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Không thể đọc hồ sơ lúc này. Vui lòng thử lại.' });
    }
});

app.put('/api/profile', requireAuth, async (req, res) => {
    const checked = validateProfileUpdate(req.body || {});
    if (!checked.ok) {
        const firstError = checked.errors[0];
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: firstError.message, details: checked.errors });
    }
    try {
        const user = await User.findOne({ username: req.session.user.username });
        if (!user) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Không tìm thấy hồ sơ.' });
        const values = checked.values;
        if (values.fullName !== undefined) user.fullName = values.fullName;
        if (values.dob !== undefined) { user.dob = values.dob; user.age = values.age; }
        if (values.educationStatus !== undefined) {
            user.educationStatus = values.educationStatus;
            user.educationGrade = values.educationGrade;
        }
        await user.save();
        return res.json({ success: true, message: 'Đã cập nhật hồ sơ.' });
    } catch (error) {
        console.error('Lỗi cập nhật hồ sơ:', error.message);
        return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Không thể cập nhật hồ sơ lúc này. Vui lòng thử lại.' });
    }
});

app.get('/api/user/progress', requireAuth, async (req, res) => {
    try {
        await ensureArenaWallet(req.session.user.username);
        const user = await User.findOne({ username: req.session.user.username }).select('-password');
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        if (user.role === 'admin') {
            const levels = ['chessLevel', 'caroLevel', 'memoryLevel', 'crosswordLevel', 'detectiveLevel', 'goLevel', 'othelloLevel', 'storyLevel', 'shapeLevel', 'buildLevel', 'paintingLevel', 'monopolyLevel', 'vietSpeechLevel', 'englishSpeechLevel'];
            levels.forEach(levelKey => {
                if ((user[levelKey] || 1) < 100) user[levelKey] = 100;
            });
        }
        user.lastActiveAt = new Date();
        await refreshDailyQuests(user);
        res.setHeader('Cache-Control', 'no-store');
        res.json(user);
    } catch (error) {
        console.error('Lỗi tải tiến trình:', error);
        res.status(500).json({ message: 'Không thể tải tiến trình người chơi.' });
    }
});

app.post('/api/user/heartbeat', requireAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.session.user.username });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
        if (user.isSuspended) {
            return res.status(403).json({ code: 'ACCOUNT_SUSPENDED', message: 'Tài khoản đã bị khóa.' });
        }
        if (maintenanceMode && user.role !== 'admin') {
            return res.status(503).json({ code: 'MAINTENANCE', message: 'Hệ thống đang bảo trì.' });
        }

        const now = new Date();
        const today = getVietnamDateKey(now);
        if (user.playtimeDate !== today) {
            user.playtimeDate = today;
            user.playtimeUsedToday = 0;
            user.lastHeartbeatAt = now;
        } else if (user.lastHeartbeatAt) {
            const elapsedMinutes = Math.max(
                0,
                Math.min(2, (now.getTime() - new Date(user.lastHeartbeatAt).getTime()) / 60000)
            );
            user.playtimeUsedToday = Number((Number(user.playtimeUsedToday || 0) + elapsedMinutes).toFixed(2));
            user.lastHeartbeatAt = now;
        } else {
            user.lastHeartbeatAt = now;
        }

        user.lastActiveAt = now;
        const limit = Math.max(0, user.playtimeLimitMinutes || 0);
        if (user.role !== 'admin' && limit > 0 && user.playtimeUsedToday >= limit) {
            await user.save();
            const socketId = onlineUsers[user.username];
            if (socketId) io.to(socketId).emit('playtimeLimitExceeded');
            return res.status(403).json({
                code: 'PLAYTIME_LIMIT_EXCEEDED',
                status: 'limit_exceeded',
                usedMinutes: Math.ceil(user.playtimeUsedToday),
                limitMinutes: limit
            });
        }

        await user.save();
        res.json({
            status: 'ok',
            usedMinutes: Math.ceil(user.playtimeUsedToday),
            limitMinutes: limit,
            remainingMinutes: limit > 0 ? Math.max(0, Math.ceil(limit - user.playtimeUsedToday)) : null
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ message: 'Không thể cập nhật thời gian chơi.' });
    }
});

app.get('/api/parent/dashboard', requireParent, async (req, res) => {
    try {
        const parent = await User.findOne({ username: req.session.user.username }).select('-password');
        if (!parent) return res.status(404).json({ message: 'Không tìm thấy tài khoản phụ huynh.' });

        const childQuery = {
            role: 'child',
            $or: [
                { username: { $in: parent.children || [] } },
                ...(parent.parentCode ? [{ parentCode: parent.parentCode }] : [])
            ]
        };
        const children = await User.find(childQuery)
            .select('username score history playtimeLimitMinutes playtimeUsedToday lastActiveAt')
            .lean();

        const calendar = await getLearningCalendar();
        const safeChildren = await Promise.all(children.map(async child => {
            const profile = await LearningProfile.findOne({ username: child.username }).lean();
            const grade = clampInteger(profile?.lastGrade, 1, 12, 1);
            const records = await LearningRecord.find({ username: child.username, grade }).lean();
            const semester = currentLearningSemester(calendar);
            const selfAssessment = await LearningSelfAssessment.findOne({ username: child.username, grade, schoolYear: calendar.schoolYear, semester }).lean();
            const education = buildEducationDashboard({
                grade,
                catalog: getCatalog(grade),
                records,
                profile: profile || { studyDays: [], xp: 0, totalStudyMinutes: 0 },
                calendar,
                selfAssessment
            });
            const analytics = buildLearningAnalytics(records, profile || { studyDays: [], xp: 0 });
            return {
                ...child,
                history: (child.history || []).slice(-30).reverse(),
                learning: {
                    grade,
                    schoolYear: education.schoolYear,
                    semester: education.semester,
                    stage: education.stage,
                    overall: education.overall,
                    disclaimer: education.disclaimer,
                    passedLessons: analytics.passedLessons,
                    masteredLessons: analytics.masteredLessons,
                    averageBestScore: analytics.averageBestScore,
                    streak: analytics.streak,
                    recommendation: analytics.recommendation,
                    subjectResults: education.subjectResults
                }
            };
        }));

        res.json({ parentCode: parent.parentCode, children: safeChildren });
    } catch (error) {
        console.error('Lỗi dashboard phụ huynh:', error);
        res.status(500).json({ message: 'Không thể tải bảng điều khiển phụ huynh.' });
    }
});

// --- 6. API ADMIN (ĐÃ KHÔI PHỤC ĐẦY ĐỦ) ---
// 1. Admin gửi thông báo chính thức (Lưu vào DB)
app.post('/api/admin/post-notification', async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const content = String(req.body.content || '').trim();
        const type = ['info', 'event', 'warning'].includes(req.body.type) ? req.body.type : 'info';

        if (!title || !content) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ tiêu đề và nội dung.' });
        }

        const newNotify = await Notification.create({ title, content, type });
        io.emit('adminNotification', { title: newNotify.title, message: newNotify.content, type });
        res.status(201).json({ message: 'Đã đăng thông báo thành công!' });
    } catch (error) {
        console.error('Lỗi đăng thông báo:', error);
        res.status(500).json({ message: 'Không thể đăng thông báo.' });
    }
});

app.get('/api/notifications', async (req, res) => {
    try {
        const username = req.session?.user?.username || null;
        const query = username
            ? { $or: [{ targetUsername: null }, { targetUsername: username }] }
            : { targetUsername: null };

        const list = await Notification.find(query)
            .sort({ date: -1 })
            .limit(20)
            .lean();

        res.setHeader('Cache-Control', 'no-store');
        res.json(list);
    } catch (error) {
        console.error('Lỗi tải thông báo:', error);
        res.status(500).json({ message: 'Không thể tải thông báo.' });
    }
});
function normalizeGameType(value) {
    const type = String(value || '').trim().toLowerCase();
    return type === 'chess' ? 'chess' : null;
}
function createTournamentMatchId(prefix = 'TOUR') {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
function shufflePlayers(players) {
    const output = [...players];
    for (let i = output.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
}
function scheduleTournamentMatches(count, tourney, dayOffset = 1) {
    const result = [];
    if (tourney.organizerType === 'player') {
        const base = Date.now() + Math.max(5, Number(dayOffset) * 5) * 60000;
        for (let index = 0; index < count; index++) result.push(new Date(base + (index % 4) * 60000));
        return result;
    }
    const days = Math.max(1, Number(tourney.durationDays) || 7);
    const startHour = Math.max(0, Number(tourney.dailyStartHour) || 8);
    const endHour = Math.max(startHour + 1, Number(tourney.dailyEndHour) || 18);
    const perDay = Math.max(1, Math.ceil(count / days));
    for (let index = 0; index < count; index++) {
        const day = Math.floor(index / perDay);
        const position = index % perDay;
        const slotsToday = Math.min(perDay, count - day * perDay);
        const available = (endHour - startHour) * 60;
        const minute = Math.round(((position + 1) * available) / (slotsToday + 1));
        const date = new Date();
        date.setDate(date.getDate() + dayOffset + day);
        date.setHours(startHour, minute, 0, 0);
        result.push(date);
    }
    return result;
}
function tournamentMatches(tourney) {
    if (!Array.isArray(tourney?.brackets)) return [];
    return tourney.brackets.flatMap(entry => Array.isArray(entry?.matches) ? entry.matches : [entry]).filter(Boolean);
}
function findTournamentMatch(tourney, matchId) {
    return tournamentMatches(tourney).find(match => match.matchId === matchId);
}
function makeMatch(p1, p2, startTime, round = 1, label = '') {
    return {
        matchId: createTournamentMatchId(), p1, p2: p2 || 'BYE', winner: p2 ? null : p1,
        loser: null, status: p2 ? 'scheduled' : 'finished', startTime, round, label,
        checkIns: {}, resultSource: p2 ? null : 'bye', finishedAt: p2 ? null : new Date()
    };
}
function calculateGroupStandings(group) {
    const rows = Object.fromEntries((group.members || []).map(name => [name, { player: name, played: 0, won: 0, lost: 0, points: 0 }]));
    for (const match of group.matches || []) {
        if (!match.winner || !rows[match.p1] || !rows[match.p2]) continue;
        rows[match.p1].played += 1; rows[match.p2].played += 1;
        if (rows[match.winner]) {
            rows[match.winner].won += 1; rows[match.winner].points += 3;
            const loser = match.winner === match.p1 ? match.p2 : match.p1;
            if (rows[loser]) rows[loser].lost += 1;
        }
    }
    return Object.values(rows).sort((a, b) => b.points - a.points || b.won - a.won || a.player.localeCompare(b.player, 'vi'));
}
function createGroupStage(players, tourney) {
    const groupCount = Math.ceil(players.length / 4);
    const groups = Array.from({ length: groupCount }, (_, index) => ({ groupName: `Bảng ${String.fromCharCode(65 + index)}`, members: [], matches: [] }));
    players.forEach((player, index) => groups[index % groupCount].members.push(player));
    const pairs = [];
    groups.forEach((group, groupIndex) => {
        for (let i = 0; i < group.members.length; i++) for (let j = i + 1; j < group.members.length; j++) pairs.push({ groupIndex, p1: group.members[i], p2: group.members[j] });
    });
    const schedule = scheduleTournamentMatches(pairs.length, tourney, 1);
    pairs.forEach((pair, index) => groups[pair.groupIndex].matches.push(makeMatch(pair.p1, pair.p2, schedule[index], 0, groups[pair.groupIndex].groupName)));
    return groups;
}
function createKnockoutRound(players, tourney, round, dayOffset = 1) {
    const schedule = scheduleTournamentMatches(Math.ceil(players.length / 2), tourney, dayOffset);
    const matches = [];
    for (let i = 0; i < players.length; i += 2) matches.push(makeMatch(players[i], players[i + 1], schedule[Math.floor(i / 2)], round, `Vòng ${round}`));
    return matches;
}
function createInitialKnockoutRound(players, tourney, round = 1, dayOffset = 1) {
    const uniquePlayers = [...new Set(players)].filter(Boolean);
    let bracketSize = 2;
    while (bracketSize < uniquePlayers.length) bracketSize *= 2;
    const matchCount = bracketSize / 2;
    const byeCount = bracketSize - uniquePlayers.length;
    const schedule = scheduleTournamentMatches(matchCount, tourney, dayOffset);
    const matches = [];
    let cursor = 0;
    for (let index = 0; index < byeCount; index++) matches.push(makeMatch(uniquePlayers[cursor++], null, schedule[matches.length], round, `Vòng ${round}`));
    while (cursor < uniquePlayers.length) matches.push(makeMatch(uniquePlayers[cursor++], uniquePlayers[cursor++], schedule[matches.length], round, `Vòng ${round}`));
    return matches;
}
async function startTournament(tourney) {
    if (!tourney || tourney.status !== 'open') throw new Error('Giải đấu không còn mở đăng ký.');
    if ((tourney.participants || []).length < Number(tourney.minParticipants || 2)) throw new Error(`Cần ít nhất ${tourney.minParticipants || 2} người tham gia.`);
    const players = shufflePlayers([...new Set(tourney.participants)]);
    const useGroups = tourney.format === 'group' || (tourney.format === 'auto' && players.length > 8);
    tourney.startedAt = new Date();
    tourney.status = 'playing';
    tourney.history = [];
    if (useGroups) {
        tourney.phase = 'groups'; tourney.round = 0; tourney.brackets = createGroupStage(players, tourney);
    } else {
        tourney.phase = 'knockout'; tourney.round = 1; tourney.brackets = createInitialKnockoutRound(players, tourney, 1);
    }
    tourney.markModified('brackets');
    await tourney.save();
    io.emit('tournamentUpdated');
    io.emit('adminNotification', { title: '📣 GIẢI ĐẤU BẮT ĐẦU', message: `Lịch ${tourney.gameType.toUpperCase()} đã được công bố.` });
    return tourney;
}
function calculateTournamentPrizes(tourney) {
    if (tourney.organizerType !== 'player') return { first: 500, second: 300, third: 100 };
    const pool = Math.max(0, Math.floor(Number(tourney.escrowBalance) || 0));
    const hasThird = Boolean(tourney.winners?.top3);
    if (!pool) return { first: 0, second: 0, third: 0 };
    const second = Math.floor(pool * (hasThird ? 0.20 : 0.20));
    const third = hasThird ? Math.floor(pool * 0.10) : 0;
    return { first: pool - second - third, second, third };
}
async function grantTournamentRewards(tourney) {
    if (!tourney || tourney.rewardsGranted) return;
    const prizes = calculateTournamentPrizes(tourney);
    const currency = tourney.organizerType === 'player' ? 'Điểm Đấu Trường' : 'điểm';
    const rewards = [[tourney.winners?.top1, prizes.first, 'Hạng nhất'], [tourney.winners?.top2, prizes.second, 'Hạng nhì'], [tourney.winners?.top3, prizes.third, 'Hạng ba']];
    for (const [name, points, label] of rewards) {
        if (!name || !points) continue;
        const ref = `TOUR_PRIZE:${tourney._id}:${name}:${label}`;
        if (tourney.organizerType === 'player') {
            await creditArenaPoints(name, points, ref, `🏆 ${label} ${tourney.title}: +${points} Điểm Đấu Trường`);
        } else {
            await User.updateOne(
                { username: name, 'history.referenceId': { $ne: ref } },
                { $inc: { score: points }, $push: { history: { $each: [{ activity: `🏆 ${label} ${tourney.title}: +${points}đ`, referenceId: ref, timestamp: new Date() }], $slice: -300 } } }
            );
        }
    }
    tourney.prizeBreakdown = prizes;
    if (tourney.organizerType === 'player') tourney.escrowBalance = 0;
    tourney.rewardsGranted = true;
    tourney.markModified('prizeBreakdown');
}

async function refundTournamentEntries(tourney, reason = 'Giải đấu bị hủy') {
    if (!tourney || tourney.organizerType !== 'player' || tourney.feesRefunded) return;
    const fee = Math.max(0, Math.floor(Number(tourney.entryFee) || 0));
    for (const username of [...new Set(tourney.paidParticipants || [])]) {
        if (!fee) continue;
        const ref = `TOUR_REFUND:${tourney._id}:${username}`;
        await creditArenaPoints(username, fee, ref, `↩️ Hoàn ${fee} Điểm Đấu Trường — ${reason}`);
        if (!tourney.refundedParticipants.includes(username)) tourney.refundedParticipants.push(username);
    }
    tourney.escrowBalance = 0;
    tourney.feesRefunded = true;
    tourney.markModified('refundedParticipants');
}
async function advanceTournament(tourney) {
    if (!tourney || tourney.status !== 'playing') return false;
    const allDone = tournamentMatches(tourney).every(match => Boolean(match.winner));
    if (!allDone) return false;
    if (tourney.phase === 'groups') {
        const qualified = tourney.brackets.flatMap(group => calculateGroupStandings(group).slice(0, 2).map(row => row.player));
        tourney.history.push({ phase: 'groups', brackets: tourney.brackets, completedAt: new Date() });
        tourney.phase = 'knockout'; tourney.round = 1;
        tourney.brackets = createInitialKnockoutRound(shufflePlayers(qualified), tourney, 1, 1);
    } else {
        const matches = tournamentMatches(tourney);
        const winners = matches.map(match => match.winner).filter(name => name && name !== 'BYE');
        const losers = matches.map(match => match.loser).filter(Boolean);
        tourney.history.push({ phase: 'knockout', round: tourney.round, brackets: tourney.brackets, completedAt: new Date() });
        const finalMatch = matches.find(match => match.label === 'Chung kết');
        const bronzeMatch = matches.find(match => match.label === 'Tranh hạng ba');
        if (finalMatch) {
            tourney.status = 'finished'; tourney.phase = 'completed'; tourney.finishedAt = new Date();
            tourney.winners = { top1: finalMatch.winner || '', top2: finalMatch.loser || '', top3: bronzeMatch?.winner || '' };
            await grantTournamentRewards(tourney);
            io.emit('adminNotification', { title: '🏁 GIẢI ĐẤU KẾT THÚC', message: `Quán quân: ${tourney.winners.top1 || 'Chưa xác định'}` });
        } else if (winners.length <= 1) {
            tourney.status = 'finished'; tourney.phase = 'completed'; tourney.finishedAt = new Date();
            tourney.winners = { top1: winners[0] || '', top2: losers[losers.length - 1] || '', top3: '' };
            await grantTournamentRewards(tourney);
            io.emit('adminNotification', { title: '🏁 GIẢI ĐẤU KẾT THÚC', message: `Quán quân: ${tourney.winners.top1 || 'Chưa xác định'}` });
        } else if (winners.length === 2 && losers.length >= 2) {
            tourney.round += 1;
            const schedule = scheduleTournamentMatches(2, tourney, 1);
            tourney.brackets = [
                makeMatch(winners[0], winners[1], schedule[0], tourney.round, 'Chung kết'),
                makeMatch(losers[0], losers[1], schedule[1], tourney.round, 'Tranh hạng ba')
            ];
        } else {
            tourney.round += 1;
            tourney.brackets = createKnockoutRound(winners, tourney, tourney.round, 1);
        }
    }
    tourney.markModified('brackets'); tourney.markModified('history');
    await tourney.save(); io.emit('tournamentUpdated');
    return true;
}

app.post('/api/admin/create-tournament', async (req, res) => {
    try {
        const gameType = normalizeGameType(req.body.gameType);
        if (!gameType) return res.status(400).json({ message: 'Môn thi không hợp lệ.' });
        const existing = await Tournament.findOne({ organizerType: 'official', gameType: 'chess', status: { $in: ['open', 'playing'] } });
        if (existing) return res.status(409).json({ message: 'Hãy kết thúc hoặc hủy giải hiện tại trước.' });
        const deadline = new Date(Date.now() + clampInteger(req.body.regDays, 1, 30, 3) * 86400000);
        const start = clampInteger(req.body.dailyStart ?? req.body.dailyStartHour, 0, 22, 8);
        const endHour = clampInteger(req.body.dailyEnd ?? req.body.dailyEndHour, start + 1, 24, 18);
        const tourney = await Tournament.create({
            title: normalizeTournamentTitle(req.body.title) || `Giải ${gameType.toUpperCase()} chính thức`,
            organizerType: 'official', creator: req.session.user.username, pointMode: 'official-score', maxParticipants: 128, minParticipants: 2,
            gameType, format: ['auto','knockout','group'].includes(req.body.format) ? req.body.format : 'auto',
            matchDuration: clampInteger(req.body.matchDuration, 5, 180, 20), registrationDeadline: deadline,
            dailyStartHour: start, dailyEndHour: endHour, durationDays: clampInteger(req.body.tourDays ?? req.body.durationDays, 1, 30, 7)
        });
        io.emit('tournamentUpdated');
        res.json({ message: 'Đã mở giải đấu.', tournament: tourney });
    } catch (error) { res.status(500).json({ message: error.message }); }
});
app.post('/api/admin/start-tournament', async (req, res) => {
    try {
        const tourney = await Tournament.findOne({ organizerType: 'official', gameType: 'chess', status: 'open' });
        await startTournament(tourney);
        res.json({ message: 'Đã chia lịch và bắt đầu giải đấu.' });
    } catch (error) { res.status(400).json({ message: error.message }); }
});
app.post('/api/admin/tournament-result', async (req, res) => {
    const matchId = String(req.body.matchId || '').trim();
    const winner = normalizeUsername(req.body.winner);
    const ok = await recordTournamentWinner(matchId, winner, { source: 'admin' });
    res.status(ok ? 200 : 400).json({ message: ok ? 'Đã ghi nhận kết quả.' : 'Không thể ghi nhận kết quả này.' });
});
app.post('/api/admin/advance-to-knockout', async (req, res) => {
    const tourney = await Tournament.findOne({ organizerType: 'official', gameType: 'chess', status: 'playing' });
    const advanced = await advanceTournament(tourney);
    res.status(advanced ? 200 : 400).json({ message: advanced ? 'Đã tạo vòng tiếp theo.' : 'Các trận hiện tại chưa hoàn tất.' });
});
app.post('/api/admin/finish-tournament', async (req, res) => {
    const tourney = await Tournament.findOne({ organizerType: 'official', gameType: 'chess', status: { $in: ['open','playing'] } });
    if (!tourney) return res.status(404).json({ message: 'Không tìm thấy giải đấu.' });
    tourney.status = 'finished'; tourney.phase = 'completed'; tourney.finishedAt = new Date();
    tourney.winners = { top1: normalizeUsername(req.body.top1), top2: normalizeUsername(req.body.top2), top3: normalizeUsername(req.body.top3) };
    await grantTournamentRewards(tourney); await tourney.save(); io.emit('tournamentUpdated');
    res.json({ message: 'Đã kết thúc và trao thưởng giải đấu.' });
});
app.post('/api/admin/cancel-tournament', async (req, res) => {
    const tourney = await Tournament.findOne({ organizerType: 'official', gameType: 'chess', status: { $in: ['open','playing'] } });
    if (!tourney) return res.status(404).json({ message: 'Không có giải đang hoạt động.' });
    tourney.status = 'cancelled'; tourney.finishedAt = new Date(); await tourney.save(); io.emit('tournamentUpdated');
    res.json({ message: 'Đã hủy giải đấu.' });
});
app.post('/api/admin/community-tournament/:id/cancel', async (req, res) => {
    if (!isValidTournamentId(req.params.id)) return res.status(400).json({ message: 'Mã giải đấu không hợp lệ.' });
    const tournament = await Tournament.findOne({ _id: req.params.id, organizerType: 'player', status: { $in: ['open','playing'] } });
    if (!tournament) return res.status(404).json({ message: 'Không tìm thấy giải cộng đồng đang hoạt động.' });
    tournament.status = 'cancelled'; tournament.phase = 'completed'; tournament.finishedAt = new Date();
    tournament.cancelReason = String(req.body.reason || 'Quản trị viên hủy do vi phạm hoặc sự cố').slice(0, 200);
    await refundTournamentEntries(tournament, tournament.cancelReason);
    await tournament.save();
    io.emit('tournamentUpdated', { tournamentId: String(tournament._id) });
    res.json({ message: 'Đã hủy giải cộng đồng và hoàn toàn bộ quỹ.' });
});

app.post('/api/admin/update-user', requireAdmin, async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const editableFields = [
        'score', 'arenaPoints', 'chessLevel', 'caroLevel', 'memoryLevel', 'crosswordLevel',
        'englishSpeechLevel', 'detectiveLevel', 'goLevel', 'othelloLevel',
        'storyLevel', 'shapeLevel', 'buildLevel', 'paintingLevel',
        'monopolyLevel', 'vietSpeechLevel', 'musicLevel', 'playtimeLimitMinutes'
    ];

    const updateData = {};
    for (const key of editableFields) {
        if (req.body[key] !== undefined) {
            const max = ['score','arenaPoints'].includes(key) ? 1_000_000_000 : key === 'playtimeLimitMinutes' ? 1440 : 1000;
            updateData[key] = clampInteger(req.body[key], 0, max, 0);
        }
    }

    try {
        const result = await User.updateOne({ username }, { $set: updateData });
        if (!result.matchedCount) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        res.json({ message: `Đã cập nhật dữ liệu cho ${username}.` });
    } catch (error) {
        console.error('Lỗi cập nhật user:', error);
        res.status(500).json({ message: 'Lỗi khi cập nhật dữ liệu.' });
    }
});
// Xem hồ sơ tổng hợp của một người dùng; tuyệt đối không trả password, OTP hoặc token.
app.get('/api/admin/user/:username', requireAdmin, async (req, res) => {
    const username = normalizeUsername(req.params.username);
    if (!username) return res.status(400).json({ message: 'Tên tài khoản không hợp lệ.' });
    try {
        const user = await User.findOne({ username }).select('-password -history -quests -inventory').lean();
        if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại.' });
        const safe = value => value || null;
        const [profile, education, learning, plan, surveys, placements, assessments, progress, legacyRecords] = await Promise.all([
            platformModels.Profile.findOne({ username }).lean(),
            platformModels.EducationProfile.findOne({ username }).lean(),
            platformModels.LearningProfile.findOne({ username }).lean(),
            platformModels.LearningPlan.findOne({ username }).sort({ version: -1, createdAt: -1 }).lean(),
            platformModels.SurveyAttempt.find({ username }).sort({ createdAt: -1 }).limit(5).lean(),
            platformModels.PlacementAttempt.find({ username }).sort({ createdAt: -1 }).limit(5).lean(),
            platformModels.AssessmentAttempt.find({ username }).select('assessmentId score status startedAt submittedAt result.percentage').sort({ createdAt: -1 }).limit(10).lean(),
            platformModels.LessonProgress.find({ username }).select('courseId lessonId progressPercent completed lastSeenAt completedAt timeSpentSeconds').sort({ updatedAt: -1 }).limit(20).lean(),
            LearningRecord.find({ username }).select('grade subjectId lessonId bestScore passed masteryLevel lastAttemptAt').sort({ updatedAt: -1 }).limit(30).lean()
        ]);
        const latest = items => items.map(item => ({ id: String(item._id), createdAt: item.createdAt || item.submittedAt || item.startedAt || null, status: item.status || '', score: item.score ?? item.result?.percentage ?? null, surveyId: item.surveyId ? String(item.surveyId) : undefined, placementTestId: item.placementTestId ? String(item.placementTestId) : undefined }));
        res.json({ success: true, data: { account: user, profile: safe(profile), education: safe(education), learning: safe(learning), learningPlan: plan ? { version: plan.version, status: plan.status, createdAt: plan.createdAt, updatedAt: plan.updatedAt, goalCount: (plan.goals || []).length, subjectCount: (plan.subjects || []).length, subjects: (plan.subjects || []).slice(0, 20).map(item => ({ subjectId: item.subjectId, skill: item.skill, courseName: item.courseName, courseGap: item.courseGap, currentScore: item.currentScore, reason: item.reason })) } : null, surveys: latest(surveys), placements: latest(placements), assessments: latest(assessments), lessonProgress: progress, legacyLearningRecords: legacyRecords } });
    } catch (error) {
        console.error('Lỗi đọc hồ sơ học sinh:', error);
        res.status(500).json({ message: 'Không thể tải hồ sơ người dùng.' });
    }
});

// Lấy danh sách user
app.get('/api/admin/all-users', requireAdmin, async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = String(req.query.search || '').trim();
    const filter = {};
    if (['admin', 'parent', 'child'].includes(String(req.query.role || ''))) filter.role = String(req.query.role);
    if (search) filter.$or = [
        { username: { $regex: escapeRegExp(search), $options: 'i' } },
        { fullName: { $regex: escapeRegExp(search), $options: 'i' } },
        { email: { $regex: escapeRegExp(search), $options: 'i' } },
        { phone: { $regex: escapeRegExp(search), $options: 'i' } }
    ];
    const projection = 'username role fullName email phone gameId verificationStatus educationStatus educationGrade score lastActiveAt isSuspended isLocked loginStreak';
    const [users, total] = await Promise.all([
        User.find(filter).select(projection).sort({ lastActiveAt: -1, username: 1 }).skip((page - 1) * limit).limit(limit).lean(),
        User.countDocuments(filter)
    ]);
    res.json({ success: true, data: { items: users, page, limit, total, pages: Math.ceil(total / limit) } });
});
// Tạo user nhanh
app.post('/api/admin/create-user', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');
    const role = ['parent', 'child'].includes(req.body.role) ? req.body.role : 'child';
    const requestedParentCode = String(req.body.parentCode || '').trim();

    if (!isValidUsername(username) || username.toLowerCase() === 'admin') {
        return res.status(400).json({ message: 'Tên tài khoản không hợp lệ hoặc đã được dành riêng.' });
    }
    if (password.length < 6 || password.length > 72) {
        return res.status(400).json({ message: 'Mật khẩu phải dài từ 6 đến 72 ký tự.' });
    }

    try {
        const exists = await User.findOne({
            username: { $regex: new RegExp(`^${escapeRegExp(username)}$`, 'i') }
        }).lean();
        if (exists) return res.status(409).json({ message: 'Tên tài khoản đã tồn tại.' });

        let parent = null;
        let parentCode = null;
        if (role === 'parent') {
            parentCode = `P-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        } else if (requestedParentCode) {
            parent = await User.findOne({ role: 'parent', parentCode: requestedParentCode });
            if (!parent) return res.status(400).json({ message: 'Mã phụ huynh không tồn tại.' });
            parentCode = parent.parentCode;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, password: hashedPassword, role, parentCode });

        if (parent) {
            await User.updateOne({ _id: parent._id }, { $addToSet: { children: newUser.username } });
        }

        res.status(201).json({
            message: role === 'parent'
                ? `Tạo phụ huynh thành công. Mã liên kết: ${parentCode}`
                : 'Tạo tài khoản trẻ em thành công.'
        });
    } catch (error) {
        console.error('Lỗi tạo user:', error);
        res.status(error?.code === 11000 ? 409 : 500).json({ message: 'Không thể tạo tài khoản.' });
    }
});

// Xóa tài khoản học sinh và dữ liệu cá nhân liên quan; không cho xóa Admin/phụ huynh qua luồng này.
app.post('/api/admin/delete-user', requireAdmin, async (req, res) => {
    const username = normalizeUsername(req.body.username);
    if (!username || username.toLowerCase() === 'admin' || username === req.session.user.username) return res.status(400).json({ message: 'Không thể xóa tài khoản quản trị đang dùng.' });
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'Người dùng không tồn tại.' });
        if (user.role !== 'child') return res.status(400).json({ message: 'Chỉ có thể xóa tài khoản học sinh tại màn hình này. Tài khoản phụ huynh và quản trị được bảo vệ.' });
        const deleted = {};
        const usernameModels = ['Profile','EducationProfile','LearningProfile','AssessmentAttempt','SurveyAttempt','PlacementAttempt','LearningPlan','SkillMastery','EnglishAssessment','LearningError','AdaptivePracticeSession','UserAudioAsset','EnglishSpeakingAttempt','CodeExecutionAttempt','LessonProgress','AIAmbientInsight','PracticeAttempt','AssignmentSubmission','AssignmentAttachment','LearningPlanStep','LearningEvent','PersonalCourseNeed','AIDecisionLog','UserAchievement','RewardGrant','GamificationEvent','AIGenerationJob'];
        for (const name of usernameModels) {
            const Model = platformModels[name];
            if (!Model) continue;
            const result = await Model.deleteMany({ username });
            if (result.deletedCount) deleted[name] = result.deletedCount;
        }
        if (platformModels.Course && platformModels.CurriculumContent) {
            const personalCourses = await platformModels.Course.find({ ownerUsername: username, kind: 'PERSONAL_AI' }).select('_id').lean();
            const courseIds = personalCourses.map(item => item._id);
            if (courseIds.length) {
                const lessons = await platformModels.CurriculumContent.find({ courseId: { $in: courseIds }, type: 'LESSON' }).select('_id').lean();
                const lessonIds = lessons.map(item => item._id);
                if (platformModels.ContentBlock && lessonIds.length) { const result = await platformModels.ContentBlock.deleteMany({ lessonId: { $in: lessonIds } }); if (result.deletedCount) deleted.ContentBlock = result.deletedCount; }
                if (platformModels.PracticeTask && lessonIds.length) { const result = await platformModels.PracticeTask.deleteMany({ lessonId: { $in: lessonIds } }); if (result.deletedCount) deleted.PracticeTask = result.deletedCount; }
                if (platformModels.Assessment) {
                    const assessments = await platformModels.Assessment.find({ courseId: { $in: courseIds } }).select('_id questionIds questionPool').lean();
                    const assessmentIds = assessments.map(item => item._id);
                    const questionIds = assessments.flatMap(item => [...(item.questionIds || []), ...(item.questionPool || [])]).filter(value => value && mongoose.isValidObjectId(value));
                    if (assessmentIds.length) { const result = await platformModels.Assessment.deleteMany({ _id: { $in: assessmentIds } }); if (result.deletedCount) deleted.Assessment = result.deletedCount; }
                    if (platformModels.Question) { const result = await platformModels.Question.deleteMany({ $or: [{ courseId: { $in: courseIds } }, { _id: { $in: questionIds } }] }); if (result.deletedCount) deleted.Question = result.deletedCount; }
                }
                const contentResult = await platformModels.CurriculumContent.deleteMany({ courseId: { $in: courseIds } }); if (contentResult.deletedCount) deleted.CurriculumContent = contentResult.deletedCount;
                const courseResult = await platformModels.Course.deleteMany({ _id: { $in: courseIds }, ownerUsername: username, kind: 'PERSONAL_AI' }); if (courseResult.deletedCount) deleted.PersonalCourse = courseResult.deletedCount;
            }
        }
        for (const name of ['LearningRecord','LearningNote','LearningSelfAssessment','LearningPractical','LearningActivity']) {
            const Model = ({ LearningRecord, LearningNote, LearningSelfAssessment, LearningPractical, LearningActivity })[name];
            const result = await Model.deleteMany({ username });
            if (result.deletedCount) deleted[name] = result.deletedCount;
        }
        for (const name of ['AIAudioAsset','AIImageAsset']) {
            const Model = platformModels[name];
            if (!Model) continue;
            const result = await Model.deleteMany({ ownerUsername: username });
            if (result.deletedCount) deleted[name] = result.deletedCount;
        }
        if (platformModels.AIContentDraft) {
            const result = await platformModels.AIContentDraft.deleteMany({ ownerUsername: username, mode: 'PERSONAL' });
            if (result.deletedCount) deleted.AIContentDraft = result.deletedCount;
        }
        if (platformModels.PlatformNotification) {
            const result = await platformModels.PlatformNotification.deleteMany({ recipient: username });
            if (result.deletedCount) deleted.PlatformNotification = result.deletedCount;
        }
        await User.updateMany({ children: username }, { $pull: { children: username } });
        if (platformModels.AuditLog) await platformModels.AuditLog.create({ actorUsername: req.session.user.username, action: 'DELETE_LEARNER_ACCOUNT', entityType: 'User', entityId: username, before: { username, role: user.role, fullName: user.fullName }, after: { deleted: true, relatedData: deleted }, ip: req.ip, userAgent: String(req.get('user-agent') || '').slice(0, 300) });
        await User.deleteOne({ _id: user._id });
        res.json({ success: true, message: 'Đã xóa tài khoản học sinh và dữ liệu học tập cá nhân liên quan.', data: { username, deleted } });
    } catch (error) {
        console.error('Lỗi xóa tài khoản học sinh:', error);
        res.status(500).json({ message: 'Không thể hoàn tất xóa tài khoản. Hãy kiểm tra log máy chủ trước khi thử lại.' });
    }
});

// Khóa/Mở khóa
app.post('/api/admin/toggle-suspend', async (req, res) => {
    const user = await User.findOne({ username: req.body.username });
    if(user) {
        user.isSuspended = !user.isSuspended;
        await user.save();
        // Nếu khóa, đá socket ra
        if(user.isSuspended) {
             const socketId = Object.keys(io.sockets.sockets).find(id => {
                const s = io.sockets.sockets[id];
                return s.request.session.user?.username === user.username;
            });
            if(socketId) io.to(socketId).emit('accountSuspended', { message: 'Tài khoản bạn đã bị khóa.' });
        }
        res.json({ message: user.isSuspended ? 'Đã khóa' : 'Đã mở khóa' });
    } else res.status(404).json({ message: 'User không tồn tại' });
});

// Reset mật khẩu người dùng. Mật khẩu Admin chỉ được đồng bộ từ ADMIN_PASSWORD.
app.post('/api/admin/reset-password', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    if (!username) return res.status(400).json({ message: 'Thiếu tên tài khoản.' });
    if (username.toLowerCase() === 'admin') {
        return res.status(400).json({
            message: 'Mật khẩu Admin được quản lý bằng ADMIN_PASSWORD trong Environment. Hãy đổi biến và redeploy.'
        });
    }
    const temporaryPassword = String(req.body.temporaryPassword || '123456').trim();
    if (temporaryPassword.length < 6 || temporaryPassword.length > 72) {
        return res.status(400).json({ message: 'Mật khẩu tạm phải dài từ 6 đến 72 ký tự.' });
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    user.password = await bcrypt.hash(temporaryPassword, 10);
    await user.save();
    res.json({ message: `Đã đặt mật khẩu tạm cho ${username}.` });
});

// Broadcast thông báo
app.post('/api/admin/broadcast', async (req, res) => {
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ message: 'Nội dung thông báo không được để trống.' });

    const notification = await Notification.create({
        title: 'Thông Báo Từ Admin',
        content: message,
        type: 'info'
    });
    io.emit('adminNotification', { title: notification.title, message: notification.content, type: notification.type });
    res.json({ message: 'Đã gửi broadcast.' });
});

app.post('/api/admin/send-notification', async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const message = String(req.body.message || '').trim();
    if (!username || !message) {
        return res.status(400).json({ message: 'Thiếu người nhận hoặc nội dung.' });
    }

    const user = await User.findOne({ username }).lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người nhận.' });

    const notification = await Notification.create({
        title: 'Thông báo riêng từ Admin',
        content: message,
        type: 'info',
        targetUsername: username
    });

    const socketId = onlineUsers[username];
    if (socketId) {
        io.to(socketId).emit('adminNotification', {
            title: notification.title,
            message: notification.content,
            type: notification.type
        });
    }
    res.json({ message: socketId ? 'Đã gửi thông báo trực tiếp.' : 'Đã lưu thông báo; người chơi sẽ thấy khi đăng nhập.' });
});

app.post('/api/admin/create-random-batch', async (req, res) => {
    const count = clampInteger(req.body.count, 1, 100, 1);
    const password = 'BotPassword123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const stamp = Date.now().toString(36).toUpperCase();
    const created = [];

    try {
        for (let index = 1; index <= count; index += 1) {
            const suffix = `${stamp}${String(index).padStart(3, '0')}`;
            const parentUsername = `ParentBot_${suffix}`;
            const childUsername = `ChildBot_${suffix}`;
            const parentCode = `P-${suffix}`;

            await User.create({
                username: parentUsername,
                password: hashedPassword,
                role: 'parent',
                parentCode,
                children: [childUsername]
            });
            await User.create({
                username: childUsername,
                password: hashedPassword,
                role: 'child',
                parentCode
            });
            created.push({ parentUsername, childUsername, parentCode });
        }

        res.status(201).json({
            message: `Đã tạo ${created.length} cặp bot. Mật khẩu chung: ${password}`,
            created
        });
    } catch (error) {
        console.error('Lỗi tạo bot hàng loạt:', error);
        res.status(500).json({
            message: `Đã tạo ${created.length}/${count} cặp trước khi gặp lỗi.`
        });
    }
});

app.post('/api/admin/transfer-child', async (req, res) => {
    const childUsername = normalizeUsername(req.body.childUsername);
    const newParentCode = String(req.body.newParentCode || '').trim();

    const [child, newParent] = await Promise.all([
        User.findOne({ username: childUsername, role: 'child' }),
        User.findOne({ parentCode: newParentCode, role: 'parent' })
    ]);

    if (!child) return res.status(404).json({ message: 'Không tìm thấy tài khoản trẻ em.' });
    if (!newParent) return res.status(404).json({ message: 'Không tìm thấy phụ huynh mới.' });

    if (child.parentCode) {
        await User.updateMany(
            { role: 'parent', parentCode: child.parentCode },
            { $pull: { children: child.username } }
        );
    }

    child.parentCode = newParent.parentCode;
    await child.save();
    await User.updateOne({ _id: newParent._id }, { $addToSet: { children: child.username } });

    res.json({ message: `Đã chuyển ${child.username} sang phụ huynh mới.` });
});

// Giao nhiệm vụ (Quest) - Đã khôi phục logic lưu vào DB
// Giao nhiệm vụ (Quest) - Đã sửa lỗi biến timeLimit
app.post('/api/admin/assign-quest', async (req, res) => {
    const { username, taskType, target, reward, penalty, timeLimit } = req.body;
    const user = await User.findOne({ username });

    if (user) {
        // Thêm nhiệm vụ mới vào mảng quests của người dùng
        user.quests.push({
            id: 'q' + Date.now(), 
            startTime: Date.now(),
            taskType, 
            target: parseInt(target), 
            reward: parseInt(reward), 
            penalty: parseInt(penalty || 0), 
            timeLimit: parseInt(timeLimit || 0), 
            progress: 0,
            // --- DÒNG QUAN TRỌNG NHẤT: Đánh dấu đây KHÔNG PHẢI nhiệm vụ hàng ngày ---
            isDaily: false 
        });

        // Báo cho Mongoose biết mảng đã thay đổi để nó thực hiện lưu
        user.markModified('quests');
        await user.save();

        res.json({ message: 'Giao nhiệm vụ thành công!' });
    } else {
        res.status(404).json({ message: 'Không tìm thấy người chơi!' });
    }
});
app.get('/api/admin/maintenance-status', (req, res) => res.json({ maintenanceMode }));
app.post('/api/admin/maintenance-toggle', (req, res) => {
    maintenanceMode = !maintenanceMode;
    if(maintenanceMode) {
        io.emit('maintenanceModeOn', { message: 'Server đang bảo trì!' });
    } else {
        io.emit('maintenanceModeOff', { message: 'Server đã mở lại!' });
    }
    res.json({ maintenanceMode });
});
// 1. Lấy thông tin giải đấu hiện tại
function defaultLearningCalendar() {
    const schoolYear = process.env.SCHOOL_YEAR || '2026-2027';
    return {
        schoolYear,
        note: 'Mốc mặc định để lập kế hoạch. Admin cần cập nhật theo kế hoạch của Sở GDĐT/nhà trường.',
        milestones: [
            { id: 'midterm-1', name: 'Giữa học kỳ I', from: process.env.MIDTERM_1_FROM || '2026-10-19', to: process.env.MIDTERM_1_TO || '2026-10-31' },
            { id: 'final-1', name: 'Cuối học kỳ I', from: process.env.FINAL_1_FROM || '2026-12-21', to: process.env.FINAL_1_TO || '2027-01-09' },
            { id: 'midterm-2', name: 'Giữa học kỳ II', from: process.env.MIDTERM_2_FROM || '2027-03-15', to: process.env.MIDTERM_2_TO || '2027-03-27' },
            { id: 'final-2', name: 'Cuối học kỳ II', from: process.env.FINAL_2_FROM || '2027-05-03', to: process.env.FINAL_2_TO || '2027-05-22' }
        ]
    };
}
async function getLearningCalendar() {
    const setting = await LearningSetting.findOne({ key: 'school-calendar' }).lean();
    return setting?.value || defaultLearningCalendar();
}
function lessonOrder(lessonId) { return Number(String(lessonId || '').replace(/\D/g, '')) || 0; }
async function isLessonUnlocked(username, grade, subjectId, lessonId) {
    const order = lessonOrder(lessonId);
    if (order <= 1) return true;
    const previous = await LearningRecord.findOne({ username, grade, subjectId, lessonId: `lesson-${order - 1}`, passed: true }).lean();
    return Boolean(previous);
}
function studyDayKey(date = new Date()) {
    const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return local.toISOString().slice(0, 10);
}
function calculateLearningStreak(studyDays = []) {
    const days = new Set(studyDays.filter(Boolean));
    let cursor = new Date(`${studyDayKey()}T00:00:00+07:00`);
    if (!days.has(studyDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (days.has(studyDayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    return streak;
}
function getMasteryLevel(record) {
    const best = Number(record?.bestScore) || 0;
    const attempts = Number(record?.attempts) || 0;
    if (!attempts) return 'new';
    if (best >= 9.5) return 'mastered';
    if (best > PASS_SCORE) return 'passed';
    return 'practicing';
}
function calculateReviewSchedule(score, previousIntervalDays = 0, previousStreak = 0, now = new Date()) {
    const numericScore = Math.max(0, Math.min(10, Number(score) || 0));
    let intervalDays;
    let reviewStreak;
    if (numericScore < 6) {
        intervalDays = 1;
        reviewStreak = 0;
    } else if (numericScore <= PASS_SCORE) {
        intervalDays = 2;
        reviewStreak = 0;
    } else {
        reviewStreak = Math.max(0, Number(previousStreak) || 0) + 1;
        const base = previousIntervalDays > 0 ? previousIntervalDays : (numericScore >= 9.5 ? 7 : 3);
        const multiplier = numericScore >= 9.5 ? 2.1 : 1.65;
        intervalDays = Math.min(60, Math.max(3, Math.round(base * (previousIntervalDays > 0 ? multiplier : 1))));
    }
    const nextReviewAt = new Date(now.getTime() + intervalDays * 86400000);
    return { intervalDays, reviewStreak, nextReviewAt };
}
async function logLearningActivity({ username, grade, type, subjectId = '', lessonId = '', score = null, minutes = 0, metadata = {} }) {
    try {
        await LearningActivity.create({
            username, grade, type, subjectId, lessonId,
            score: Number.isFinite(Number(score)) ? Number(score) : null,
            minutes: Math.max(0, Math.min(600, Math.round(Number(minutes) || 0))),
            metadata
        });
    } catch (error) {
        console.error('Không thể ghi nhật ký học tập:', error.message);
    }
}
function startOfVietnamWeek(now = new Date()) {
    const local = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const weekday = local.getDay() || 7;
    local.setHours(0, 0, 0, 0);
    local.setDate(local.getDate() - weekday + 1);
    return new Date(local.getTime() - 7 * 60 * 60 * 1000);
}
function buildLearningAnalytics(records, profile = null) {
    const stats = {};
    const subjectStats = {};
    let passedLessons = 0;
    let masteredLessons = 0;
    let totalAttempts = 0;
    let scoreSum = 0;
    for (const record of records) {
        totalAttempts += Number(record.attempts) || 0;
        scoreSum += Number(record.bestScore) || 0;
        if (record.passed) passedLessons += 1;
        if (getMasteryLevel(record) === 'mastered') masteredLessons += 1;
        subjectStats[record.subjectId] ||= { score: 0, lessons: 0, passed: 0 };
        subjectStats[record.subjectId].score += Number(record.bestScore) || 0;
        subjectStats[record.subjectId].lessons += 1;
        if (record.passed) subjectStats[record.subjectId].passed += 1;
        for (const [skill, data] of Object.entries(record.skillStats || {})) {
            stats[skill] ||= { correct: 0, total: 0 };
            stats[skill].correct += Number(data.correct) || 0;
            stats[skill].total += Number(data.total) || 0;
        }
    }
    const skills = Object.entries(stats).map(([skill, value]) => ({ skill, percent: value.total ? Math.round(value.correct / value.total * 100) : 0, total: value.total })).sort((a,b) => a.percent - b.percent);
    const subjects = Object.entries(subjectStats).map(([subjectId, value]) => ({ subjectId, average: value.lessons ? Number((value.score / value.lessons).toFixed(1)) : 0, passed: value.passed, attempted: value.lessons })).sort((a,b) => a.average - b.average);
    const streak = calculateLearningStreak(profile?.studyDays || []);
    const xp = Number(profile?.xp) || 0;
    const badges = [];
    if (passedLessons >= 1) badges.push({ id: 'first-step', icon: '🌱', name: 'Bước đầu tiên' });
    if (passedLessons >= 10) badges.push({ id: 'ten-lessons', icon: '📚', name: 'Chăm học' });
    if (passedLessons >= 50) badges.push({ id: 'fifty-lessons', icon: '🏅', name: 'Bền bỉ' });
    if (streak >= 3) badges.push({ id: 'streak-3', icon: '🔥', name: 'Chuỗi 3 ngày' });
    if (streak >= 7) badges.push({ id: 'streak-7', icon: '💎', name: 'Chuỗi 7 ngày' });
    if (records.some(record => Number(record.bestScore) === 10)) badges.push({ id: 'perfect', icon: '💯', name: 'Điểm tuyệt đối' });
    const weakest = skills[0];
    const weakSubject = subjects[0];
    let recommendation = 'Tiếp tục học bài kế tiếp và duy trì luyện tập đều.';
    if (weakest && weakest.percent < 80) recommendation = `Ưu tiên ôn kỹ năng ${weakest.skill} (${weakest.percent}%).`;
    else if (weakSubject && weakSubject.average <= PASS_SCORE) recommendation = `Ôn lại môn ${weakSubject.subjectId} trước khi học bài mới.`;
    return {
        weakSkills: skills.slice(0, 4),
        strongSkills: [...skills].reverse().slice(0, 4),
        subjectStats: subjects,
        recommendation,
        passedLessons,
        masteredLessons,
        totalAttempts,
        averageBestScore: records.length ? Number((scoreSum / records.length).toFixed(1)) : 0,
        streak,
        xp,
        badges
    };
}
async function getOrCreateLearningProfile(username, grade = 1) {
    return LearningProfile.findOneAndUpdate(
        { username },
        { $setOnInsert: { username, dailyGoalMinutes: 30, weeklyGoalDays: 5, xp: 0, studyDays: [], totalStudyMinutes: 0 }, $set: { lastGrade: grade } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}
function findNextLesson(subject, recordsByLesson) {
    for (const lesson of subject.lessons) {
        if (recordsByLesson[lesson.id]?.passed) continue;
        if (lesson.order === 1 || recordsByLesson[`lesson-${lesson.order - 1}`]?.passed) return lesson;
    }
    return null;
}

function currentLearningSemester(calendar, now = new Date()) {
    const date = studyDayKey(now);
    const finalOne = calendar?.milestones?.find(item => item.id === 'final-1');
    return finalOne?.to && date > finalOne.to ? 'semester-2' : 'semester-1';
}
function educationStage(grade) {
    if (grade <= 5) return { id: 'primary', name: 'Tiểu học', policy: 'Thông tư 27/2020/TT-BGDĐT' };
    if (grade <= 9) return { id: 'lower-secondary', name: 'Trung học cơ sở', policy: 'Thông tư 22/2021/TT-BGDĐT' };
    return { id: 'upper-secondary', name: 'Trung học phổ thông', policy: 'Thông tư 22/2021/TT-BGDĐT' };
}
function subjectSupportLevel(grade, average, attempted, passed, totalLessons) {
    const completion = totalLessons ? passed / totalLessons : 0;
    if (!attempted) return { level: 'Chưa có dữ liệu', tone: 'neutral', completion: 0 };
    if (grade <= 5) {
        if (average >= 9 && completion >= 0.75) return { level: 'Hoàn thành tốt', tone: 'excellent', completion };
        if (average > PASS_SCORE || completion >= 0.5) return { level: 'Hoàn thành', tone: 'good', completion };
        return { level: 'Chưa hoàn thành', tone: 'needs-work', completion };
    }
    if (average >= 8 && completion >= 0.7) return { level: 'Tốt', tone: 'excellent', completion };
    if (average >= 6.5 && completion >= 0.45) return { level: 'Khá', tone: 'good', completion };
    if (average >= 5 || completion >= 0.25) return { level: 'Đạt', tone: 'ok', completion };
    return { level: 'Chưa đạt', tone: 'needs-work', completion };
}
function buildEducationDashboard({ grade, catalog, records, profile, calendar, selfAssessment }) {
    const analytics = buildLearningAnalytics(records, profile);
    const stage = educationStage(grade);
    const subjectRows = catalog.subjects.map(subject => {
        const subjectRecords = records.filter(record => record.subjectId === subject.id);
        const attempted = subjectRecords.length;
        const passed = subjectRecords.filter(record => record.passed).length;
        const average = attempted ? Number((subjectRecords.reduce((sum, record) => sum + Number(record.bestScore || 0), 0) / attempted).toFixed(1)) : 0;
        return {
            subjectId: subject.id, name: subject.name, icon: subject.icon, compulsory: subject.compulsory,
            attempted, passed, totalLessons: subject.lessonCount, average,
            ...subjectSupportLevel(grade, average, attempted, passed, subject.lessonCount)
        };
    });
    const qualityEvidence = {
        yeu_nuoc: subjectRows.filter(row => /lịch sử|địa phương|quốc phòng/i.test(row.name)).reduce((sum,row)=>sum+row.passed,0),
        nhan_ai: subjectRows.filter(row => /đạo đức|công dân|trải nghiệm/i.test(row.name)).reduce((sum,row)=>sum+row.passed,0),
        cham_chi: analytics.passedLessons + analytics.streak,
        trung_thuc: records.filter(record => record.attempts > 0).length,
        trach_nhiem: Math.min(30, Number(profile?.studyDays?.length || 0))
    };
    const skillMap = Object.fromEntries((analytics.strongSkills || []).concat(analytics.weakSkills || []).map(item => [item.skill, item.percent]));
    const competencyEvidence = {
        tu_chu_tu_hoc: Math.min(100, Math.round((analytics.streak * 8) + (analytics.passedLessons * 1.5))),
        giao_tiep_hop_tac: Math.round(((skillMap.communication || skillMap['giao tiếp'] || 0) + (skillMap.reading || skillMap['đọc hiểu'] || 0)) / 2) || 0,
        giai_quyet_sang_tao: Math.round(((skillMap['vận dụng'] || 0) + (skillMap['lập luận'] || 0) + (skillMap['phân tích'] || 0)) / 3) || 0
    };
    const completedSubjects = subjectRows.filter(row => ['Hoàn thành tốt','Hoàn thành','Tốt','Khá','Đạt'].includes(row.level)).length;
    const overall = grade <= 5
        ? (completedSubjects === subjectRows.length && subjectRows.some(row => row.level === 'Hoàn thành tốt') ? 'Hoàn thành tốt' : completedSubjects >= Math.ceil(subjectRows.length * .7) ? 'Hoàn thành' : 'Cần hỗ trợ thêm')
        : (subjectRows.filter(row => row.level === 'Tốt').length >= Math.ceil(subjectRows.length * .5) ? 'Tốt' : subjectRows.filter(row => ['Tốt','Khá'].includes(row.level)).length >= Math.ceil(subjectRows.length * .5) ? 'Khá' : completedSubjects >= Math.ceil(subjectRows.length * .7) ? 'Đạt' : 'Chưa đạt');
    return {
        programVersion: PROGRAM_VERSION,
        schoolYear: calendar.schoolYear,
        semester: currentLearningSemester(calendar),
        stage,
        overall,
        disclaimer: 'Phân loại trên web là chỉ báo hỗ trợ theo dữ liệu luyện tập, không thay thế học bạ, điểm số hoặc nhận xét chính thức của cơ sở giáo dục.',
        principles: ['Đánh giá vì sự tiến bộ của học sinh','Kết hợp đánh giá thường xuyên và định kỳ','Đánh giá theo yêu cầu cần đạt, phẩm chất và năng lực','Kết hợp nhận xét, minh chứng và điểm số phù hợp cấp học'],
        assessmentStructure: grade <= 5
            ? { regular: 'Nhận xét trong quá trình học', periodic: 'Bài kiểm tra định kỳ kết hợp nhận xét', subjectLevels: ['Hoàn thành tốt','Hoàn thành','Chưa hoàn thành'], qualityLevels: ['Tốt','Đạt','Cần cố gắng'] }
            : { regular: 'Hỏi đáp, viết, thuyết trình, thực hành, sản phẩm học tập', periodic: 'Giữa kỳ và cuối kỳ', resultLevels: ['Tốt','Khá','Đạt','Chưa đạt'] },
        references: [
            { code: '32/2018/TT-BGDĐT', name: 'Chương trình giáo dục phổ thông 2018' },
            { code: grade <= 5 ? '27/2020/TT-BGDĐT' : '22/2021/TT-BGDĐT', name: grade <= 5 ? 'Quy định đánh giá học sinh tiểu học' : 'Quy định đánh giá học sinh THCS và THPT' },
            { code: '13/2022/TT-BGDĐT', name: 'Điều chỉnh một số nội dung Chương trình GDPT 2018' }
        ],
        subjectResults: subjectRows,
        qualities: CORE_QUALITIES.map(item => ({ ...item, evidence: qualityEvidence[item.id] || 0, selfLevel: selfAssessment?.qualities?.[item.id] || '' })),
        competencies: GENERAL_COMPETENCIES.map(item => ({ ...item, percent: competencyEvidence[item.id] || 0, selfLevel: selfAssessment?.competencies?.[item.id] || '' })),
        selfAssessment: selfAssessment || null,
        milestones: calendar.milestones || []
    };
}
app.get('/api/admin/learning-overview', async (req, res) => {
    const since = new Date(Date.now() - 7 * 86400000);
    const [totalLearners, activeLearners, recordStats, dueReviews, gradeDistribution] = await Promise.all([
        LearningProfile.countDocuments(),
        LearningActivity.distinct('username', { createdAt: { $gte: since } }),
        LearningRecord.aggregate([{ $group: { _id: null, attempts: { $sum: '$attempts' }, passed: { $sum: { $cond: ['$passed', 1, 0] } }, averageBest: { $avg: '$bestScore' } } }]),
        LearningRecord.countDocuments({ nextReviewAt: { $lte: new Date() } }),
        LearningProfile.aggregate([{ $group: { _id: '$lastGrade', learners: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    ]);
    const stats = recordStats[0] || {};
    res.json({
        totalLearners, activeLast7Days: activeLearners.length, dueReviews,
        lessonAttempts: stats.attempts || 0, passedLessons: stats.passed || 0,
        averageBestScore: Number((stats.averageBest || 0).toFixed(1)),
        gradeDistribution: gradeDistribution.map(item => ({ grade: item._id, learners: item.learners }))
    });
});

app.get('/api/learning/adaptive-dashboard', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const username = req.session.user.username;
    const now = new Date();
    const weekStart = startOfVietnamWeek(now);
    const [profile, records, activities] = await Promise.all([
        getOrCreateLearningProfile(username, grade),
        LearningRecord.find({ username, grade }).sort({ updatedAt: -1 }).lean(),
        LearningActivity.find({ username, grade, createdAt: { $gte: new Date(now.getTime() - 56 * 86400000) } }).sort({ createdAt: -1 }).limit(240).lean()
    ]);
    const catalog = getCatalog(grade);
    const subjectMap = Object.fromEntries(catalog.subjects.map(subject => [subject.id, subject]));
    const dueRecords = records.filter(record => record.nextReviewAt && new Date(record.nextReviewAt) <= now);
    const dueReviews = dueRecords.slice(0, 8).map(record => {
        const subject = subjectMap[record.subjectId];
        const lesson = subject?.lessons?.find(item => item.id === record.lessonId);
        return {
            subjectId: record.subjectId, subjectName: subject?.name || record.subjectId, icon: subject?.icon || '📘',
            lessonId: record.lessonId, lessonTitle: lesson?.title || record.lessonId,
            dueAt: record.nextReviewAt, intervalDays: record.reviewIntervalDays || 0, masteryLevel: getMasteryLevel(record)
        };
    });
    const weekActivities = activities.filter(item => new Date(item.createdAt) >= weekStart);
    const minutesThisWeek = weekActivities.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
    const activeDays = new Set(weekActivities.map(item => studyDayKey(new Date(item.createdAt))));
    const daily = [];
    for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date(weekStart.getTime() + offset * 86400000);
        const key = studyDayKey(date);
        const dayActivities = weekActivities.filter(item => studyDayKey(new Date(item.createdAt)) === key);
        daily.push({ date: key, minutes: dayActivities.reduce((sum, item) => sum + Number(item.minutes || 0), 0), activities: dayActivities.length });
    }
    const analytics = buildLearningAnalytics(records, profile);
    const achievements = [
        { id: 'first-lesson', name: 'Khởi động', icon: '🌱', target: 1, value: analytics.passedLessons },
        { id: 'ten-lessons', name: 'Bền bỉ', icon: '📚', target: 10, value: analytics.passedLessons },
        { id: 'master-five', name: 'Nắm chắc kiến thức', icon: '🌟', target: 5, value: analytics.masteredLessons },
        { id: 'streak-seven', name: 'Chuỗi 7 ngày', icon: '🔥', target: 7, value: analytics.streak },
        { id: 'minutes-300', name: '300 phút học', icon: '⏱️', target: 300, value: Number(profile.totalStudyMinutes || 0) }
    ].map(item => ({ ...item, unlocked: item.value >= item.target, progress: Math.min(100, Math.round(item.value / item.target * 100)) }));
    const recent = activities.slice(0, 12).map(item => ({
        type: item.type, subjectId: item.subjectId, subjectName: subjectMap[item.subjectId]?.name || item.subjectId || 'Học tập',
        lessonId: item.lessonId, score: item.score, minutes: item.minutes, createdAt: item.createdAt, metadata: item.metadata || {}
    }));
    res.json({
        grade, dueReviewCount: dueRecords.length, dueReviews, minutesThisWeek, activeDaysThisWeek: activeDays.size,
        weeklyGoalMinutes: Number(profile.dailyGoalMinutes || 30) * Number(profile.weeklyGoalDays || 5), daily, achievements, recent,
        mission: dueRecords.length ? 'Ôn một bài đến hạn trước khi học bài mới.' : analytics.weakSkills?.[0] ? `Luyện thêm kỹ năng ${analytics.weakSkills[0].skill}.` : 'Hoàn thành một bài mới hôm nay.'
    });
});

app.get('/api/learning/education-dashboard', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const username = req.session.user.username;
    const [records, profile, calendar] = await Promise.all([
        LearningRecord.find({ username, grade }).lean(),
        getOrCreateLearningProfile(username, grade),
        getLearningCalendar()
    ]);
    const semester = currentLearningSemester(calendar);
    const selfAssessment = await LearningSelfAssessment.findOne({ username, grade, schoolYear: calendar.schoolYear, semester }).lean();
    res.json(buildEducationDashboard({ grade, catalog: getCatalog(grade), records, profile, calendar, selfAssessment }));
});
app.post('/api/learning/self-assessment', requireAuth, async (req, res) => {
    const grade = clampInteger(req.body.grade, 1, 12, 1);
    const calendar = await getLearningCalendar();
    const semester = ['semester-1','semester-2','year'].includes(req.body.semester) ? req.body.semester : currentLearningSemester(calendar);
    const allowedLevels = new Set(['Tốt','Đạt','Cần cố gắng','Khá','Chưa đạt','Chưa hoàn thành']);
    const cleanRatings = (source, definitions) => Object.fromEntries(definitions.map(item => [item.id, allowedLevels.has(source?.[item.id]) ? source[item.id] : '']).filter(([,value]) => value));
    const record = await LearningSelfAssessment.findOneAndUpdate(
        { username: req.session.user.username, grade, schoolYear: calendar.schoolYear, semester },
        { $set: { qualities: cleanRatings(req.body.qualities, CORE_QUALITIES), competencies: cleanRatings(req.body.competencies, GENERAL_COMPETENCIES), reflection: String(req.body.reflection || '').trim().slice(0,2000), nextGoal: String(req.body.nextGoal || '').trim().slice(0,1000) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    await logLearningActivity({ username: req.session.user.username, grade, type: 'self-assessment', metadata: { semester, schoolYear: calendar.schoolYear } });
    res.json({ message: 'Đã lưu bản tự đánh giá học kỳ.', selfAssessment: record });
});

app.get('/api/learning/weekly-assignments', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const username = req.session.user.username;
    const catalog = getCatalog(grade);
    const records = await LearningRecord.find({ username, grade }).lean();
    const recordMap = new Map(records.map(record => [`${record.subjectId}:${record.lessonId}`, record]));
    const now = new Date();
    const monday = new Date(now);
    const day = (monday.getDay() + 6) % 7;
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - day);
    const dueAt = new Date(monday);
    dueAt.setDate(dueAt.getDate() + 6);
    dueAt.setHours(20, 0, 0, 0);
    const assignments = [];
    for (const subject of catalog.subjects) {
        const full = getSubject(grade, subject.id, { includeLessons: true });
        if (!full?.lessons?.length) continue;
        const target = full.lessons.find(lesson => !recordMap.get(`${subject.id}:${lesson.id}`)?.passed) || full.lessons.find(lesson => recordMap.get(`${subject.id}:${lesson.id}`)?.nextReviewAt && new Date(recordMap.get(`${subject.id}:${lesson.id}`).nextReviewAt) <= now);
        if (!target) continue;
        const record = recordMap.get(`${subject.id}:${target.id}`);
        assignments.push({
            id: `${grade}:${subject.id}:${target.id}:${monday.toISOString().slice(0, 10)}`,
            subjectId: subject.id,
            subjectName: subject.name,
            icon: subject.icon,
            lessonId: target.id,
            lessonTitle: target.title,
            isCheckpoint: Boolean(target.isCheckpoint),
            estimatedMinutes: Number(target.estimatedMinutes || 20),
            dueAt,
            status: record?.passed ? 'completed' : now > dueAt ? 'overdue' : 'assigned',
            bestScore: Number(record?.bestScore) || 0,
            attempts: Number(record?.attempts) || 0
        });
        if (assignments.length >= 8) break;
    }
    const completed = assignments.filter(item => item.status === 'completed').length;
    res.json({ grade, weekStart: monday, dueAt, completed, total: assignments.length, assignments, notice: 'Danh sách này là kế hoạch học tập tự động hỗ trợ, không thay bài tập chính thức do giáo viên giao.' });
});

app.get('/api/learning/catalog', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    res.json(getCatalog(grade));
});
app.get('/api/learning/calendar', requireAuth, async (req, res) => res.json(await getLearningCalendar()));
app.post('/api/admin/learning-calendar', async (req, res) => {
    const value = req.body && typeof req.body === 'object' ? req.body : {};
    await LearningSetting.findOneAndUpdate({ key: 'school-calendar' }, { $set: { value } }, { upsert: true });
    res.json({ message: 'Đã cập nhật lịch học và kiểm tra.' });
});
app.get('/api/learning/progress', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const username = req.session.user.username;
    const [records, profile] = await Promise.all([
        LearningRecord.find({ username, grade }).lean(),
        getOrCreateLearningProfile(username, grade)
    ]);
    const bySubject = {};
    for (const record of records) {
        bySubject[record.subjectId] ||= {};
        bySubject[record.subjectId][record.lessonId] = {
            bestScore: record.bestScore,
            lastScore: record.lastScore,
            attempts: record.attempts,
            passed: record.passed,
            masteryLevel: getMasteryLevel(record),
            reviewAttempts: record.reviewAttempts || 0,
            reviewBestScore: record.reviewBestScore || 0,
            completedAt: record.completedAt,
            updatedAt: record.updatedAt
        };
    }
    res.json({ grade, passScore: PASS_SCORE, records: bySubject, profile: { dailyGoalMinutes: profile.dailyGoalMinutes, weeklyGoalDays: profile.weeklyGoalDays || 5, totalStudyMinutes: profile.totalStudyMinutes || 0, xp: profile.xp, streak: calculateLearningStreak(profile.studyDays), studyDays: profile.studyDays.slice(-60) }, analytics: buildLearningAnalytics(records, profile) });
});
app.get('/api/learning/profile', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const profile = await getOrCreateLearningProfile(req.session.user.username, grade);
    res.json({ dailyGoalMinutes: profile.dailyGoalMinutes, weeklyGoalDays: profile.weeklyGoalDays || 5, totalStudyMinutes: profile.totalStudyMinutes || 0, xp: profile.xp, streak: calculateLearningStreak(profile.studyDays), studyDays: profile.studyDays.slice(-60), preferredSubjects: profile.preferredSubjects || [] });
});
app.post('/api/learning/profile', requireAuth, async (req, res) => {
    const dailyGoalMinutes = clampInteger(req.body.dailyGoalMinutes, 10, 180, 30);
    const weeklyGoalDays = clampInteger(req.body.weeklyGoalDays, 1, 7, 5);
    const preferredSubjects = Array.isArray(req.body.preferredSubjects) ? req.body.preferredSubjects.map(value => String(value).slice(0, 60)).slice(0, 8) : [];
    const profile = await LearningProfile.findOneAndUpdate(
        { username: req.session.user.username },
        { $set: { dailyGoalMinutes, weeklyGoalDays, preferredSubjects }, $setOnInsert: { username: req.session.user.username } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ message: 'Đã lưu mục tiêu học tập.', dailyGoalMinutes: profile.dailyGoalMinutes, weeklyGoalDays: profile.weeklyGoalDays, preferredSubjects: profile.preferredSubjects });
});
app.get('/api/learning/today', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const username = req.session.user.username;
    const [profile, records] = await Promise.all([
        getOrCreateLearningProfile(username, grade),
        LearningRecord.find({ username, grade }).lean()
    ]);
    const catalog = getCatalog(grade);
    const recordMap = {};
    for (const record of records) { recordMap[record.subjectId] ||= {}; recordMap[record.subjectId][record.lessonId] = record; }
    const candidates = catalog.subjects.map(subject => {
        const lesson = findNextLesson(subject, recordMap[subject.id] || {});
        const attempted = Object.values(recordMap[subject.id] || {});
        const average = attempted.length ? attempted.reduce((sum, item) => sum + Number(item.bestScore || 0), 0) / attempted.length : 10;
        const preferred = (profile.preferredSubjects || []).includes(subject.id) ? 2 : 0;
        return lesson ? { subjectId: subject.id, subjectName: subject.name, icon: subject.icon, lessonId: lesson.id, lessonTitle: lesson.title, estimatedMinutes: lesson.estimatedMinutes, priority: (10 - average) + preferred } : null;
    }).filter(Boolean).sort((a,b) => b.priority - a.priority || a.estimatedMinutes - b.estimatedMinutes);
    const plan = [];
    let minutes = 0;
    for (const item of candidates) {
        if (plan.length >= 4) break;
        if (plan.length && minutes + item.estimatedMinutes > profile.dailyGoalMinutes + 15) continue;
        plan.push(item); minutes += item.estimatedMinutes;
    }
    if (!plan.length && candidates[0]) plan.push(candidates[0]);
    res.json({ grade, gradeFocus: GRADE_FOCUS[grade], dailyGoalMinutes: profile.dailyGoalMinutes, plannedMinutes: plan.reduce((sum,item) => sum + item.estimatedMinutes, 0), plan });
});

app.get('/api/learning/week-plan', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const username = req.session.user.username;
    const [profile, records] = await Promise.all([
        getOrCreateLearningProfile(username, grade),
        LearningRecord.find({ username, grade }).lean()
    ]);
    const catalog = getCatalog(grade);
    const recordMap = {};
    for (const record of records) {
        recordMap[record.subjectId] ||= {};
        recordMap[record.subjectId][record.lessonId] = record;
    }
    const queues = catalog.subjects.map(subject => {
        const subjectRecords = recordMap[subject.id] || {};
        const firstIncomplete = subject.lessons.findIndex(lesson => !subjectRecords[lesson.id]?.passed);
        if (firstIncomplete < 0) return null;
        const attempted = Object.values(subjectRecords);
        const average = attempted.length
            ? attempted.reduce((sum, item) => sum + Number(item.bestScore || 0), 0) / attempted.length
            : 10;
        const preferred = (profile.preferredSubjects || []).includes(subject.id) ? 2 : 0;
        return {
            subject,
            priority: (10 - average) + preferred,
            lessons: subject.lessons.slice(firstIncomplete, firstIncomplete + 4)
        };
    }).filter(Boolean).sort((a, b) => b.priority - a.priority);

    const pool = [];
    for (let round = 0; round < 4; round += 1) {
        for (const queue of queues) {
            const lesson = queue.lessons[round];
            if (!lesson) continue;
            pool.push({
                subjectId: queue.subject.id,
                subjectName: queue.subject.name,
                icon: queue.subject.icon,
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                unit: lesson.unit,
                unitTitle: lesson.unitTitle,
                estimatedMinutes: lesson.estimatedMinutes,
                currentlyUnlocked: lesson.order === 1 || Boolean(recordMap[queue.subject.id]?.[`lesson-${lesson.order - 1}`]?.passed)
            });
        }
    }

    const weeklyGoalDays = Math.max(1, Math.min(7, Number(profile.weeklyGoalDays) || 5));
    const days = [];
    let cursor = 0;
    for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        const items = [];
        let minutes = 0;
        const activeDay = offset < weeklyGoalDays;
        while (activeDay && cursor < pool.length && items.length < 3) {
            const candidate = pool[cursor++];
            if (items.length && minutes + candidate.estimatedMinutes > profile.dailyGoalMinutes + 15) break;
            items.push(candidate);
            minutes += candidate.estimatedMinutes;
        }
        days.push({
            date: studyDayKey(date),
            label: offset === 0 ? 'Hôm nay' : offset === 1 ? 'Ngày mai' : date.toLocaleDateString('vi-VN', { weekday: 'long' }),
            activeDay,
            plannedMinutes: minutes,
            items
        });
    }
    res.json({
        grade,
        dailyGoalMinutes: profile.dailyGoalMinutes,
        weeklyGoalDays,
        totalPlannedMinutes: days.reduce((sum, day) => sum + day.plannedMinutes, 0),
        days
    });
});

app.get('/api/learning/review-quiz', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const limit = clampInteger(req.query.limit, 3, 12, 5);
    const records = await LearningRecord.find({
        username: req.session.user.username,
        grade,
        'lastDetails.isCorrect': false
    }).sort({ updatedAt: -1 }).lean();
    const questions = [];
    for (const record of records) {
        for (const detail of record.lastDetails || []) {
            if (detail.isCorrect !== false || !detail.prompt || !Array.isArray(detail.options)) continue;
            questions.push({
                key: `${record.subjectId}|${record.lessonId}|${detail.id}`,
                subjectId: record.subjectId,
                lessonId: record.lessonId,
                prompt: detail.prompt,
                options: detail.options,
                skill: detail.skill || 'Kiến thức'
            });
            if (questions.length >= limit) break;
        }
        if (questions.length >= limit) break;
    }
    res.json({ grade, count: questions.length, questions });
});

app.post('/api/learning/review-quiz/submit', requireAuth, async (req, res) => {
    const grade = clampInteger(req.body.grade, 1, 12, 1);
    const answers = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const records = await LearningRecord.find({
        username: req.session.user.username,
        grade,
        'lastDetails.isCorrect': false
    }).sort({ updatedAt: -1 }).lean();

    const answerMap = new Map();
    for (const record of records) {
        for (const detail of record.lastDetails || []) {
            const key = `${record.subjectId}|${record.lessonId}|${detail.id}`;
            if (Object.prototype.hasOwnProperty.call(answers, key)) {
                answerMap.set(key, { record, detail });
            }
        }
    }
    if (!answerMap.size) return res.status(400).json({ message: 'Không tìm thấy câu ôn hợp lệ.' });

    let correct = 0;
    const details = [];
    const touched = new Map();
    const perRecord = new Map();
    for (const [key, entry] of answerMap.entries()) {
        const chosen = Number(answers[key]);
        const isCorrect = chosen === Number(entry.detail.answer);
        if (isCorrect) correct += 1;
        details.push({
            key,
            prompt: entry.detail.prompt,
            chosenAnswer: Number.isInteger(chosen) ? entry.detail.options?.[chosen] : null,
            correctAnswer: entry.detail.correctAnswer,
            explanation: entry.detail.explanation,
            skill: entry.detail.skill,
            isCorrect
        });
        const recordKey = `${entry.record.subjectId}|${entry.record.lessonId}`;
        touched.set(recordKey, entry.record);
        const bucket = perRecord.get(recordKey) || { correct: 0, total: 0, answers: new Map() };
        bucket.total += 1;
        if (isCorrect) bucket.correct += 1;
        bucket.answers.set(String(entry.detail.id), isCorrect);
        perRecord.set(recordKey, bucket);
    }
    const score = Number((correct / details.length * 10).toFixed(1));
    const now = new Date();
    const bulk = [];
    for (const [recordKey, record] of touched.entries()) {
        const bucket = perRecord.get(recordKey);
        const recordScore = Number((bucket.correct / Math.max(1, bucket.total) * 10).toFixed(1));
        const schedule = calculateReviewSchedule(recordScore, record.reviewIntervalDays, record.reviewStreak, now);
        const updatedDetails = (record.lastDetails || []).map(detail => {
            const reviewedCorrectly = bucket.answers.get(String(detail.id));
            return reviewedCorrectly === true ? { ...detail, isCorrect: true, reviewedCorrectlyAt: now } : detail;
        });
        bulk.push({
            updateOne: {
                filter: { _id: record._id },
                update: {
                    $inc: { reviewAttempts: 1 },
                    $max: { reviewBestScore: recordScore },
                    $set: {
                        lastReviewedAt: now,
                        nextReviewAt: schedule.nextReviewAt,
                        reviewIntervalDays: schedule.intervalDays,
                        reviewStreak: schedule.reviewStreak,
                        lastDetails: updatedDetails
                    }
                }
            }
        });
    }
    if (bulk.length) await LearningRecord.bulkWrite(bulk);
    const profile = await LearningProfile.findOneAndUpdate(
        { username: req.session.user.username },
        { $setOnInsert: { username: req.session.user.username }, $addToSet: { studyDays: studyDayKey() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    await logLearningActivity({ username: req.session.user.username, grade, type: 'review', score, minutes: Math.max(3, details.length * 2), metadata: { correct, total: details.length } });
    res.json({
        score,
        correct,
        total: details.length,
        details,
        streak: calculateLearningStreak(profile.studyDays),
        message: score >= 8 ? 'Em đã ôn khá chắc các lỗi sai này.' : 'Hãy đọc lại giải thích và thử ôn thêm một lượt.'
    });
});

app.get('/api/learning/review', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const limit = clampInteger(req.query.limit, 1, 30, 12);
    const records = await LearningRecord.find({ username: req.session.user.username, grade, 'lastDetails.isCorrect': false }).sort({ updatedAt: -1 }).lean();
    const items = [];
    for (const record of records) {
        for (const detail of record.lastDetails || []) {
            if (detail.isCorrect !== false || !detail.prompt) continue;
            items.push({ subjectId: record.subjectId, lessonId: record.lessonId, prompt: detail.prompt, options: detail.options || [], correctAnswer: detail.correctAnswer, chosenAnswer: detail.chosenAnswer, explanation: detail.explanation, skill: detail.skill });
            if (items.length >= limit) break;
        }
        if (items.length >= limit) break;
    }
    res.json({ grade, count: items.length, items });
});
app.get('/api/learning/note/:grade/:subjectId/:lessonId', requireAuth, async (req, res) => {
    const grade = clampInteger(req.params.grade, 1, 12, 1);
    const note = await LearningNote.findOne({ username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId }).lean();
    res.json({ content: note?.content || '', updatedAt: note?.updatedAt || null });
});
app.post('/api/learning/note/:grade/:subjectId/:lessonId', requireAuth, async (req, res) => {
    const grade = clampInteger(req.params.grade, 1, 12, 1);
    const content = String(req.body.content || '').trim().slice(0, 4000);
    const note = await LearningNote.findOneAndUpdate(
        { username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId },
        { $set: { content } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    await logLearningActivity({ username: req.session.user.username, grade, type: 'note', subjectId: req.params.subjectId, lessonId: req.params.lessonId, metadata: { characters: content.length } });
    res.json({ message: 'Đã lưu ghi chú bài học.', content: note.content, updatedAt: note.updatedAt });
});

app.get('/api/learning/preferences', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const profile = await LearningProfile.findOneAndUpdate(
        { username: req.session.user.username },
        { $setOnInsert: { username: req.session.user.username }, $set: { lastGrade: grade } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ grade, bookId: profile.bookSelections?.[String(grade)] || 'national', books: APPROVED_BOOK_PROFILES, accessibility: profile.accessibility || {}, focusMinutes: profile.focusMinutes || 25 });
});
app.post('/api/learning/preferences', requireAuth, async (req, res) => {
    const grade = clampInteger(req.body.grade, 1, 12, 1);
    const bookId = APPROVED_BOOK_PROFILES[req.body.bookId] ? String(req.body.bookId) : 'national';
    const a = req.body.accessibility || {};
    const accessibility = { largeText: Boolean(a.largeText), reducedMotion: Boolean(a.reducedMotion), highContrast: Boolean(a.highContrast), readingGuide: Boolean(a.readingGuide) };
    const focusMinutes = clampInteger(req.body.focusMinutes, 10, 60, 25);
    const profile = await LearningProfile.findOneAndUpdate(
        { username: req.session.user.username },
        { $setOnInsert: { username: req.session.user.username }, $set: { [`bookSelections.${grade}`]: bookId, accessibility, focusMinutes, lastGrade: grade } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ message: 'Đã lưu cấu hình học tập.', grade, bookId, accessibility, focusMinutes, book: APPROVED_BOOK_PROFILES[bookId] });
});
app.get('/api/learning/roadmap', requireAuth, async (req, res) => {
    const grade = clampInteger(req.query.grade, 1, 12, 1);
    const catalog = getCatalog(grade);
    const records = await LearningRecord.find({ username: req.session.user.username, grade }).lean();
    const passed = records.filter(item => item.passed).length;
    const totalLessons = catalog.subjects.reduce((sum, subject) => sum + Number(subject.lessonCount || 0), 0);
    const calendar = await getLearningCalendar();
    const startDate = new Date(calendar.schoolStart || `${new Date().getFullYear()}-09-05`);
    const currentWeek = Math.max(1, Math.min(35, Math.floor((Date.now() - startDate.getTime()) / 604800000) + 1));
    const expected = Math.min(totalLessons, Math.round(totalLessons * currentWeek / 35));
    const weeks = Array.from({ length: 35 }, (_, index) => {
        const week = index + 1;
        const phase = week <= 8 ? 'Học kỳ I • Giai đoạn 1' : week <= 18 ? 'Học kỳ I • Củng cố' : week <= 27 ? 'Học kỳ II • Giai đoạn 1' : 'Học kỳ II • Tổng kết';
        return { week, phase, targetLessons: Math.max(1, Math.round(totalLessons / 35)), checkpoint: [9,18,27,35].includes(week) };
    });
    res.json({ grade, schoolYear: calendar.schoolYear, currentWeek, passed, totalLessons, expected, onTrack: passed >= Math.max(0, expected - 3), weeks });
});
app.post('/api/learning/practical/submit', requireAuth, async (req, res) => {
    const grade = clampInteger(req.body.grade, 1, 12, 1);
    const subjectId = String(req.body.subjectId || '');
    const lessonId = String(req.body.lessonId || '');
    const requiredType = practicalTypeForSubject(subjectId, lessonId);
    const type = String(req.body.type || '');
    if (!requiredType || type !== requiredType) return res.status(400).json({ message: 'Môn học hoặc loại thực hành không hợp lệ.' });
    if (!getLesson(grade, subjectId, lessonId)) return res.status(404).json({ message: 'Không tìm thấy bài học.' });
    const m = req.body.metrics || {};
    const { score, feedback } = scorePractical(type, m);
    const evidenceId = `PA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    await LearningPractical.create({ username: req.session.user.username, grade, subjectId, lessonId, type, score, metrics: m, feedback, evidenceId });
    await logLearningActivity({ username: req.session.user.username, grade, type: 'practical', subjectId, lessonId, score, minutes: type === 'singing' ? 5 : 15, metadata: { practicalType: type, evidenceId } });
    res.json({ score, passed: score > PASS_SCORE, passScore: PASS_SCORE, feedback, evidenceId });
});

app.get('/api/learning/preflight/:grade/:subjectId/:lessonId', requireAuth, async (req, res) => {
    const grade = clampInteger(req.params.grade, 1, 12, 1);
    const pack = getLesson(grade, req.params.subjectId, req.params.lessonId);
    if (!pack) return res.status(404).json({ ready: false, message: 'Không tìm thấy bài học.' });
    const unlocked = await isLessonUnlocked(req.session.user.username, grade, req.params.subjectId, req.params.lessonId);
    const practicalType = practicalTypeForSubject(req.params.subjectId, req.params.lessonId);
    let practical = { required: false, passed: true, type: null, latestScore: null };
    if (practicalType) {
        const latest = await LearningPractical.findOne({ username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId, type: practicalType }).sort({ createdAt: -1 }).lean();
        practical = { required: true, passed: Number(latest?.score) > PASS_SCORE, type: practicalType, latestScore: latest?.score ?? null };
    }
    res.json({
        ready: unlocked && practical.passed,
        unlocked,
        practical,
        passScore: PASS_SCORE,
        questionCount: pack.lesson.questions.length,
        serverTime: new Date().toISOString(),
        message: !unlocked ? 'Bài học đang bị khóa.' : !practical.passed ? 'Cần hoàn thành phần thực hành trước khi nộp bài.' : 'Bài học sẵn sàng để nộp.'
    });
});

app.get('/api/learning/lesson/:grade/:subjectId/:lessonId', requireAuth, async (req, res) => {
    const grade = clampInteger(req.params.grade, 1, 12, 1);
    const lessonPack = getLesson(grade, req.params.subjectId, req.params.lessonId);
    if (!lessonPack) return res.status(404).json({ message: 'Không tìm thấy bài học.' });
    const unlocked = await isLessonUnlocked(req.session.user.username, grade, req.params.subjectId, req.params.lessonId);
    if (!unlocked) return res.status(403).json({ message: `Cần đạt trên ${PASS_SCORE} điểm ở bài trước để mở khóa.` });
    const safe = JSON.parse(JSON.stringify(lessonPack));
    safe.lesson.questions = safe.lesson.questions.map(({ answer, explanation, ...question }) => question);
    const practicalType = practicalTypeForSubject(req.params.subjectId, req.params.lessonId);
    let practical = null;
    if (practicalType) {
        const latest = await LearningPractical.findOne({ username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId }).sort({ createdAt: -1 }).lean();
        practical = { required: true, type: practicalType, passScore: PASS_SCORE, latestScore: latest?.score ?? null, passed: Number(latest?.score) > PASS_SCORE, evidenceId: latest?.evidenceId || null };
    }
    res.json({ ...safe, passScore: PASS_SCORE, unlocked: true, practical });
});
app.post('/api/learning/lesson/:grade/:subjectId/:lessonId/submit', requireAuth, async (req, res) => {
    const grade = clampInteger(req.params.grade, 1, 12, 1);
    const pack = getLesson(grade, req.params.subjectId, req.params.lessonId);
    if (!pack) return res.status(404).json({ message: 'Không tìm thấy bài học.' });
    const submissionId = String(req.body.submissionId || '').trim().slice(0, 100);
    if (submissionId && !/^[A-Za-z0-9_-]{8,100}$/.test(submissionId)) return res.status(400).json({ message: 'Mã lần nộp bài không hợp lệ.' });
    const suppliedAnswers = req.body.answers && typeof req.body.answers === 'object' && !Array.isArray(req.body.answers) ? req.body.answers : {};
    const expectedQuestionIds = pack.lesson.questions.map(question => String(question.id));
    const missingAnswers = expectedQuestionIds.filter(id => !Object.prototype.hasOwnProperty.call(suppliedAnswers, id));
    if (missingAnswers.length) return res.status(400).json({ message: `Còn ${missingAnswers.length} câu chưa chọn đáp án.`, missingAnswers });
    if (submissionId) {
        const duplicated = await LearningRecord.findOne({ username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId, submissionIds: submissionId }).lean();
        if (duplicated) {
            const details = Array.isArray(duplicated.lastDetails) ? duplicated.lastDetails : [];
            const correct = details.filter(item => item.isCorrect).length;
            return res.json({
                score: Number(duplicated.lastScore) || 0,
                bestScore: Number(duplicated.bestScore) || 0,
                correct,
                total: details.length || pack.lesson.questions.length,
                details,
                passed: Boolean(duplicated.passed),
                attempts: Number(duplicated.attempts) || 1,
                masteryLevel: duplicated.masteryLevel || 'practicing',
                nextLessonUnlocked: Boolean(duplicated.passed),
                xpEarned: 0,
                duplicate: true,
                receiptId: submissionId,
                message: 'Bài nộp trước đã được máy chủ ghi nhận; không cộng thêm lượt hoặc XP.'
            });
        }
    }
    if (!await isLessonUnlocked(req.session.user.username, grade, req.params.subjectId, req.params.lessonId)) return res.status(403).json({ message: 'Bài học đang bị khóa.' });
    const practicalType = practicalTypeForSubject(req.params.subjectId, req.params.lessonId);
    if (practicalType) {
        const practical = await LearningPractical.findOne({ username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId, type: practicalType, score: { $gt: PASS_SCORE } }).sort({ createdAt: -1 }).lean();
        if (!practical) return res.status(403).json({ message: `Cần hoàn thành phần ${practicalType === 'singing' ? 'hát' : 'vẽ'} và đạt trên ${PASS_SCORE}/10 trước khi nộp bài kiểm tra.` });
    }
    const result = scoreLesson(pack.lesson, suppliedAnswers);
    const skillStats = {};
    for (const detail of result.details) { skillStats[detail.skill] ||= { correct: 0, total: 0 }; skillStats[detail.skill].total += 1; if (detail.isCorrect) skillStats[detail.skill].correct += 1; }
    const existing = await LearningRecord.findOne({ username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId });
    const previousBest = Number(existing?.bestScore) || 0;
    const wasPassed = Boolean(existing?.passed);
    const bestScore = Math.max(previousBest, result.score);
    const masteryLevel = bestScore >= 9.5 ? 'mastered' : bestScore > PASS_SCORE ? 'passed' : 'practicing';
    const reviewSchedule = calculateReviewSchedule(result.score, existing?.reviewIntervalDays, existing?.reviewStreak);
    const record = await LearningRecord.findOneAndUpdate(
        { username: req.session.user.username, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId },
        {
            $set: {
                bestScore,
                lastScore: result.score,
                passed: bestScore > PASS_SCORE,
                masteryLevel,
                skillStats,
                lastDetails: result.details,
                lastAttemptAt: new Date(),
                nextReviewAt: reviewSchedule.nextReviewAt,
                reviewIntervalDays: reviewSchedule.intervalDays,
                reviewStreak: reviewSchedule.reviewStreak,
                ...(bestScore > PASS_SCORE && !existing?.completedAt ? { completedAt: new Date() } : {})
            },
            $inc: { attempts: 1 },
            ...(submissionId ? { $addToSet: { submissionIds: submissionId } } : {})
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const today = studyDayKey();
    const improved = result.score > previousBest;
    const xpEarned = !wasPassed && result.passed ? 30 : improved ? 10 : Math.max(2, Math.min(5, result.correct));
    const studyMinutes = Math.max(5, Math.round(Number(pack.lesson.estimatedMinutes || 20) * 0.35));
    const profile = await LearningProfile.findOneAndUpdate(
        { username: req.session.user.username },
        {
            $setOnInsert: { username: req.session.user.username },
            $set: { lastGrade: grade },
            $addToSet: { studyDays: today },
            $inc: { xp: xpEarned, totalStudyMinutes: studyMinutes }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    await logLearningActivity({ username: req.session.user.username, grade, type: 'lesson', subjectId: req.params.subjectId, lessonId: req.params.lessonId, score: result.score, minutes: studyMinutes, metadata: { passed: result.passed, masteryLevel, attempts: record.attempts } });
    await recordLearningErrors({ models: platformModels, username: req.session.user.username, sourceType: 'LESSON', sourceId: `${grade}:${req.params.subjectId}:${req.params.lessonId}`, grade, subjectId: req.params.subjectId, lessonId: req.params.lessonId, details: result.details });
    const message = masteryLevel === 'mastered'
        ? 'Đã thành thạo bài học và mở bài tiếp theo.'
        : record.passed
            ? 'Đã đạt yêu cầu và mở bài tiếp theo.'
            : `Cần đạt trên ${PASS_SCORE} điểm. Hãy xem giải thích và thử lại.`;
    res.json({ ...result, receiptId: submissionId || `LS-${record._id}-${record.attempts}`, bestScore: record.bestScore, attempts: record.attempts, masteryLevel, nextLessonUnlocked: record.passed, xpEarned, totalXp: profile.xp, streak: calculateLearningStreak(profile.studyDays), nextReviewAt: reviewSchedule.nextReviewAt, reviewIntervalDays: reviewSchedule.intervalDays, message });
});
function normalizeSpeech(text) { return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
app.post('/api/learning/english/speaking', requireAuth, aiRateLimit, async (req, res) => {
    const reference = normalizeSpeech(req.body.reference); const transcript = normalizeSpeech(req.body.transcript);
    if (!reference || !transcript) return res.status(400).json({ message: 'Thiếu câu mẫu hoặc bản ghi lời nói.' });
    const refWords = new Set(reference.split(' ')); const spoken = transcript.split(' ');
    const matched = spoken.filter(word => refWords.has(word)).length;
    const accuracy = Math.min(100, Math.round((matched / Math.max(refWords.size, spoken.length)) * 130));
    const confidence = Math.round(Math.max(0, Math.min(1, Number(req.body.confidence) || .6)) * 100);
    const score = Number(((accuracy * .75 + confidence * .25) / 10).toFixed(1));
    await logLearningActivity({ username: req.session.user.username, grade: clampInteger(req.body.grade, 1, 12, 1), type: 'speaking', score, metadata: { accuracy, confidence } });
    res.json({ score, accuracy, confidence, transcript: req.body.transcript, feedback: score >= 8 ? 'Phát âm và độ trôi chảy tốt.' : 'Hãy nghe lại câu mẫu, nói chậm hơn và nhấn rõ từ khóa.' });
});
const essayGradeSchema = { type: 'object', additionalProperties: false, properties: { score: { type: 'number' }, criteria: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, score: { type: 'number' }, comment: { type: 'string' } }, required: ['name','score','comment'] } }, strengths: { type: 'array', items: { type: 'string' } }, improvements: { type: 'array', items: { type: 'string' } }, revisedExample: { type: 'string' } }, required: ['score','criteria','strengths','improvements','revisedExample'] };
async function gradeEssayWithGemini({ grade, subjectName, prompt, essay }) {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) return null;
    const { generateStructured } = require('./server/services/gemini-service.js');
    const result = await generateStructured({ profile: 'assessment', schema: essayGradeSchema, temperature: 0.15, maxOutputTokens: 3000, systemInstruction: 'Bạn là giáo viên Việt Nam, chấm bài viết theo thang 10 phù hợp lứa tuổi. Chấm dựa trên đề bài, tính đúng trọng tâm, lập luận, dẫn chứng, cấu trúc và diễn đạt. Không tự bịa yêu cầu. Chỉ trả JSON đúng schema.', prompt: `Lớp ${grade}; môn ${subjectName}; đề bài: ${prompt || '(người học chưa cung cấp đề bài)'}\nBài làm:\n${essay}` });
    return result?.data || result?.structured || result?.value || result;
}
async function gradeEssayWithOpenAI({ grade, subjectName, prompt, essay }) {
    if (!process.env.OPENAI_API_KEY) return null;
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5-mini', store: false, input: [{ role: 'system', content: 'Bạn là giáo viên Việt Nam. Chấm bài viết theo thang 10 phù hợp lứa tuổi, dựa trên đề bài, trọng tâm, lập luận, dẫn chứng, cấu trúc và diễn đạt. Chỉ trả JSON theo schema.' }, { role: 'user', content: `Lớp ${grade}; môn ${subjectName}; đề: ${prompt || '(chưa cung cấp)'}\nBài làm:\n${essay}` }], text: { format: { type: 'json_schema', name: 'essay_grade', strict: true, schema: essayGradeSchema } } }) });
    if (!response.ok) throw new Error(`OpenAI API ${response.status}`);
    const data = await response.json();
    const text = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    return JSON.parse(text);
}
function localEssayGrade(essay, prompt = '') {
    const words = String(essay).trim().split(/\s+/).filter(Boolean); const sentences = String(essay).split(/[.!?]+/).filter(v => v.trim());
    const uniqueRatio = words.length ? new Set(words.map(word => word.toLowerCase())).size / words.length : 0;
    const promptTerms = String(prompt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(word => word.length >= 4);
    const essayText = String(essay).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const relevance = promptTerms.length ? Math.min(1, promptTerms.filter(word => essayText.includes(word)).length / Math.min(5, promptTerms.length)) : 0.5;
    const score = Math.max(1, Math.min(7.5, Number((2.5 + Math.min(2, words.length / 100) + Math.min(1.2, sentences.length / 10) + uniqueRatio * 1.1 + relevance * 0.7 + (words.length >= 80 ? 0.5 : 0)).toFixed(1))));
    return { score, criteria: [{ name: 'Mức độ hoàn thành', score: Math.min(10, score + relevance), comment: 'Ước lượng nội bộ theo độ dài, cấu trúc và mức độ liên quan từ khóa; không thay thế đánh giá ngữ nghĩa của giáo viên.' }, { name: 'Cấu trúc và diễn đạt', score: Math.min(10, 2 + Math.min(5, sentences.length / 2) + uniqueRatio * 2), comment: 'Đánh giá sơ bộ dựa trên cấu trúc câu và độ đa dạng từ.' }], strengths: ['Đã lưu bài viết để có thể xem lại.'], improvements: ['Đối chiếu từng ý với yêu cầu đề bài.', 'Bổ sung luận điểm, dẫn chứng cụ thể và rà soát chính tả.'], revisedExample: '' };
}
app.get('/api/learning/literature/essay/history', requireAuth, async (req, res) => {
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit || '20', 10) || 20));
    const items = await platformModels.EssayGradingAttempt.find({ username: req.session.user.username }).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, data: items });
});
app.post('/api/learning/literature/essay', requireAuth, aiRateLimit, async (req, res) => {
    const username = req.session.user.username;
    const grade = clampInteger(req.body.grade, 1, 12, 1); const essay = String(req.body.essay || '').trim().slice(0, 12000); const prompt = String(req.body.prompt || '').trim().slice(0, 1000);
    if (essay.length < 80) return res.status(400).json({ message: 'Bài viết cần ít nhất 80 ký tự.' });
    const subjectName = grade <= 5 ? 'Tiếng Việt' : 'Ngữ văn';
    let result = null; let source = 'local'; let aiErrors = [];
    try { result = await gradeEssayWithGemini({ grade, subjectName, prompt, essay }); if (result) source = 'gemini'; } catch (error) { aiErrors.push(`Gemini: ${error.code || error.message}`); }
    if (!result) try { result = await gradeEssayWithOpenAI({ grade, subjectName, prompt, essay }); if (result) source = 'openai'; } catch (error) { aiErrors.push(`OpenAI: ${error.message}`); }
    if (!result || !Number.isFinite(Number(result.score))) { result = localEssayGrade(essay, prompt); source = aiErrors.length ? 'local-fallback' : 'local'; }
    result.score = Math.max(0, Math.min(10, Number(result.score)));
    result.criteria = Array.isArray(result.criteria) ? result.criteria.slice(0, 12) : [];
    result.strengths = Array.isArray(result.strengths) ? result.strengths.slice(0, 12) : [];
    result.improvements = Array.isArray(result.improvements) ? result.improvements.slice(0, 12) : [];
    result.revisedExample = String(result.revisedExample || '').slice(0, 8000);
    const attempt = await platformModels.EssayGradingAttempt.create({ username, grade, subjectName, prompt, essay, score: result.score, criteria: result.criteria, strengths: result.strengths, improvements: result.improvements, revisedExample: result.revisedExample, source, feedback: { aiErrors } });
    await logLearningActivity({ username, grade, type: 'essay', score: result.score, minutes: Math.max(5, Math.min(60, Math.round(essay.length / 35))), metadata: { source, characters: essay.length, attemptId: String(attempt._id) } });
    res.json({ ...result, attemptId: String(attempt._id), source, notice: source === 'gemini' || source === 'openai' ? 'AI hỗ trợ chấm; bài quan trọng nên được giáo viên/phụ huynh xem lại.' : 'AI không khả dụng hoặc chưa cấu hình; hệ thống đã lưu kết quả ước lượng nội bộ. Điểm nội bộ chỉ mang tính tham khảo.', historyUrl: '/api/learning/literature/essay/history' });
});

app.get('/api/tournament/status', async (req, res) => {
    const viewer = req.session?.user?.username || '';
    const tourney = await Tournament.findOne({ organizerType: 'official', gameType: 'chess', status: { $in: ['open','playing','finished'] } }).sort({ createdAt: -1 }).lean();
    if (!tourney) return res.json({ status: 'none' });
    if (tourney.phase === 'groups') tourney.standings = Object.fromEntries((tourney.brackets || []).map(group => [group.groupName, calculateGroupStandings(group)]));
    res.setHeader('Cache-Control', 'no-store');
    res.json(sanitizeTournament(tourney, viewer));
});
app.post('/api/tournament/join', requireAuth, tournamentRateLimit, async (req, res) => {
    req.body.tournamentId ||= null;
    const tournament = req.body.tournamentId
        ? await Tournament.findById(req.body.tournamentId)
        : await Tournament.findOne({ organizerType: 'official', gameType: 'chess', status: 'open' });
    if (!tournament) return res.status(404).json({ message: 'Hiện không có giải phù hợp để đăng ký.' });
    return joinTournamentRequest(req, res, tournament);
});

async function joinTournamentRequest(req, res, tournament) {
    if (tournament?.gameType !== 'chess') return res.status(410).json({ message: 'Trò chơi của giải đấu này đã ngừng hỗ trợ.' });
    const username = req.session.user.username;
    const now = new Date();
    if (!tournament || tournament.status !== 'open') return res.status(400).json({ message: 'Giải không còn mở đăng ký.' });
    if (new Date(tournament.registrationDeadline) <= now) return res.status(400).json({ message: 'Đã hết hạn đăng ký.' });
    if ((tournament.participants || []).includes(username)) return res.json({ message: 'Bạn đã đăng ký giải này rồi.', tournament: sanitizeTournament(tournament, username) });
    if ((tournament.withdrawnParticipants || []).includes(username)) return res.status(400).json({ message: 'Bạn đã rời giải này nên không thể đăng ký lại.' });
    if ((tournament.participants || []).length >= Number(tournament.maxParticipants || 32)) return res.status(409).json({ message: 'Giải đã đủ người.' });
    if (tournament.organizerType === 'player') {
        const wallet = await ensureArenaWallet(username);
        if (!wallet || wallet.isSuspended) return res.status(403).json({ message: 'Tài khoản không thể tham gia giải.' });
        const fee = Math.max(0, Math.floor(Number(tournament.entryFee) || 0));
        if (fee > 0) {
            const debit = await User.updateOne(
                { username, arenaPoints: { $gte: fee } },
                { $inc: { arenaPoints: -fee }, $push: { history: { $each: [{ activity: `🎟️ Phí tham gia ${tournament.title}: -${fee} Điểm Đấu Trường`, referenceId: `TOUR_ENTRY:${tournament._id}:${username}`, timestamp: new Date() }], $slice: -300 } } }
            );
            if (!debit.modifiedCount) return res.status(400).json({ message: `Bạn cần ít nhất ${fee} Điểm Đấu Trường.` });
        }
        const updated = await Tournament.findOneAndUpdate(
            { _id: tournament._id, status: 'open', registrationDeadline: { $gt: now }, participants: { $ne: username }, withdrawnParticipants: { $ne: username }, $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] } },
            { $addToSet: { participants: username, ...(fee > 0 ? { paidParticipants: username } : {}) }, $inc: { escrowBalance: fee } },
            { new: true }
        );
        if (!updated) {
            if (fee > 0) await creditArenaPoints(username, fee, `TOUR_JOIN_ROLLBACK:${tournament._id}:${username}`, `↩️ Hoàn phí do đăng ký giải không thành công: +${fee}`);
            return res.status(409).json({ message: 'Không thể đăng ký; giải có thể vừa đủ người hoặc đã đóng.' });
        }
        io.emit('tournamentUpdated', { tournamentId: String(updated._id) });
        if ((updated.participants || []).length >= Number(updated.maxParticipants || 32)) {
            try { await startTournament(updated); } catch (error) { console.error('Không thể tự bắt đầu giải đã đủ người:', error.message); }
        }
        return res.json({ message: `Đăng ký thành công. ${fee ? `Đã góp ${fee} Điểm Đấu Trường vào quỹ thưởng.` : ''}`, tournament: sanitizeTournament(updated, username) });
    }
    tournament.participants.addToSet(username);
    await tournament.save();
    io.emit('tournamentUpdated', { tournamentId: String(tournament._id) });
    return res.json({ message: 'Đăng ký thành công.', tournament: sanitizeTournament(tournament, username) });
}

app.get('/api/tournaments', async (req, res) => {
    const viewer = req.session?.user?.username || '';
    const scope = String(req.query.scope || 'active');
    const chessOnly = { gameType: 'chess' };
    const query = scope === 'history'
        ? { ...chessOnly, status: { $in: ['finished','cancelled'] } }
        : scope === 'mine' && viewer
            ? { ...chessOnly, $or: [{ creator: viewer }, { participants: viewer }] }
            : { ...chessOnly, status: { $in: ['open','playing'] }, $or: [{ visibility: 'public' }, { creator: viewer }, { participants: viewer }] };
    const tournaments = await Tournament.find(query).sort({ organizerType: 1, createdAt: -1 }).limit(scope === 'history' ? 30 : 60).lean();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        enabled: COMMUNITY_TOURNAMENTS_ENABLED,
        nonCashNotice: 'Điểm Đấu Trường chỉ dùng trong game, không rút hoặc đổi tiền/Robux.',
        tournaments: tournaments.map(item => sanitizeTournament(item, viewer))
    });
});

app.get('/api/tournaments/:id', async (req, res) => {
    if (!isValidTournamentId(req.params.id)) return res.status(400).json({ message: 'Mã giải đấu không hợp lệ.' });
    const viewer = req.session?.user?.username || '';
    const tournament = await Tournament.findById(req.params.id).lean();
    if (!tournament) return res.status(404).json({ message: 'Không tìm thấy giải đấu.' });
    if (tournament.gameType !== 'chess') return res.status(410).json({ message: 'Giải đấu thuộc trò chơi đã ngừng hỗ trợ.' });
    if (tournament.visibility === 'private' && tournament.creator !== viewer && !(tournament.participants || []).includes(viewer)) return res.status(403).json({ message: 'Đây là giải riêng tư. Hãy dùng mã mời để tham gia.' });
    if (tournament.phase === 'groups') tournament.standings = Object.fromEntries((tournament.brackets || []).map(group => [group.groupName, calculateGroupStandings(group)]));
    res.json(sanitizeTournament(tournament, viewer));
});

app.post('/api/tournaments', requireAuth, tournamentRateLimit, async (req, res) => {
    if (!COMMUNITY_TOURNAMENTS_ENABLED) return res.status(503).json({ message: 'Giải cộng đồng đang tạm tắt.' });
    if (req.session.user.role === 'parent') return res.status(403).json({ message: 'Tài khoản phụ huynh không thể tạo giải đấu.' });
    const username = req.session.user.username;
    const wallet = await ensureArenaWallet(username);
    if (!wallet || wallet.isSuspended) return res.status(403).json({ message: 'Tài khoản không thể tạo giải.' });
    const activeCount = await Tournament.countDocuments({ organizerType: 'player', creator: username, status: { $in: ['open','playing'] } });
    if (activeCount >= COMMUNITY_TOURNAMENT_MAX_ACTIVE) return res.status(409).json({ message: `Bạn chỉ được có tối đa ${COMMUNITY_TOURNAMENT_MAX_ACTIVE} giải đang hoạt động.` });
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const createdToday = await Tournament.countDocuments({ organizerType: 'player', creator: username, createdAt: { $gte: dayStart } });
    if (createdToday >= COMMUNITY_TOURNAMENT_MAX_DAILY) return res.status(429).json({ message: `Bạn chỉ được tạo tối đa ${COMMUNITY_TOURNAMENT_MAX_DAILY} giải mỗi ngày.` });
    const title = normalizeTournamentTitle(req.body.title);
    if (title.length < 4) return res.status(400).json({ message: 'Tên giải cần ít nhất 4 ký tự.' });
    const gameType = normalizeGameType(req.body.gameType);
    if (!gameType) return res.status(400).json({ message: 'Môn thi không hợp lệ.' });
    const entryFee = clampInteger(req.body.entryFee, 10, COMMUNITY_TOURNAMENT_MAX_ENTRY, 10);
    const maxParticipants = clampInteger(req.body.maxParticipants, 2, COMMUNITY_TOURNAMENT_MAX_PLAYERS, 8);
    const minParticipants = clampInteger(req.body.minParticipants, 2, maxParticipants, Math.min(4, maxParticipants));
    const regMinutes = clampInteger(req.body.registrationMinutes, 10, 7 * 24 * 60, 60);
    const visibility = req.body.visibility === 'private' ? 'private' : 'public';
    if (Number(wallet.arenaPoints || 0) < entryFee) return res.status(400).json({ message: `Bạn cần ít nhất ${entryFee} Điểm Đấu Trường để tạo và tham gia giải.` });
    const debit = await User.updateOne(
        { username, arenaPoints: { $gte: entryFee } },
        { $inc: { arenaPoints: -entryFee }, $push: { history: { $each: [{ activity: `🎟️ Tạo giải ${title}: -${entryFee} Điểm Đấu Trường`, referenceId: `TOUR_CREATE:${Date.now()}:${username}`, timestamp: new Date() }], $slice: -300 } } }
    );
    if (!debit.modifiedCount) return res.status(400).json({ message: 'Số dư Điểm Đấu Trường không đủ.' });
    try {
        let joinCode = '';
        if (visibility === 'private') {
            do joinCode = makeJoinCode(); while (await Tournament.exists({ joinCode, status: { $in: ['open','playing'] } }));
        }
        const tournament = await Tournament.create({
            title, description: String(req.body.description || '').trim().slice(0, 500), organizerType: 'player', creator: username,
            visibility, joinCode, pointMode: 'arena-noncash', gameType,
            format: ['auto','knockout','group'].includes(req.body.format) ? req.body.format : 'auto',
            matchDuration: clampInteger(req.body.matchDuration, 5, 60, 15),
            registrationDeadline: new Date(Date.now() + regMinutes * 60000),
            dailyStartHour: clampInteger(req.body.dailyStartHour, 0, 22, 8),
            dailyEndHour: clampInteger(req.body.dailyEndHour, 1, 24, 22),
            durationDays: clampInteger(req.body.durationDays, 1, 7, 2),
            minParticipants, maxParticipants, entryFee, escrowBalance: entryFee,
            participants: [username], paidParticipants: [username]
        });
        io.emit('tournamentUpdated', { tournamentId: String(tournament._id) });
        res.status(201).json({ message: 'Đã tạo giải và giữ phí tham gia trong quỹ thưởng.', tournament: sanitizeTournament(tournament, username) });
    } catch (error) {
        await creditArenaPoints(username, entryFee, `TOUR_CREATE_ROLLBACK:${username}:${Date.now()}`, `↩️ Hoàn phí tạo giải không thành công: +${entryFee}`);
        console.error('Lỗi tạo giải cộng đồng:', error);
        return res.status(500).json({ message: 'Không thể tạo giải lúc này. Phí đã được hoàn.' });
    }
});

app.post('/api/tournaments/join-code', requireAuth, tournamentRateLimit, async (req, res) => {
    const code = String(req.body.joinCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const tournament = await Tournament.findOne({ joinCode: code, gameType: 'chess', visibility: 'private', status: 'open' });
    if (!tournament) return res.status(404).json({ message: 'Mã giải không đúng hoặc giải đã đóng.' });
    return joinTournamentRequest(req, res, tournament);
});

app.post('/api/tournaments/:id/join', requireAuth, tournamentRateLimit, async (req, res) => {
    if (!isValidTournamentId(req.params.id)) return res.status(400).json({ message: 'Mã giải đấu không hợp lệ.' });
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Không tìm thấy giải đấu.' });
    if (tournament.gameType !== 'chess') return res.status(410).json({ message: 'Trò chơi của giải đấu này đã ngừng hỗ trợ.' });
    if (tournament.visibility === 'private' && tournament.joinCode !== String(req.body.joinCode || '').trim().toUpperCase() && tournament.creator !== req.session.user.username) return res.status(403).json({ message: 'Cần mã mời hợp lệ.' });
    return joinTournamentRequest(req, res, tournament);
});

app.post('/api/tournaments/:id/leave', requireAuth, tournamentRateLimit, async (req, res) => {
    if (!isValidTournamentId(req.params.id)) return res.status(400).json({ message: 'Mã giải đấu không hợp lệ.' });
    const username = req.session.user.username;
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament || tournament.status !== 'open') return res.status(400).json({ message: 'Chỉ có thể rời giải khi còn mở đăng ký.' });
    if (tournament.creator === username) return res.status(400).json({ message: 'Chủ giải phải hủy giải thay vì rời giải.' });
    if (!(tournament.participants || []).includes(username)) return res.status(400).json({ message: 'Bạn chưa tham gia giải này.' });
    tournament.participants = tournament.participants.filter(name => name !== username);
    tournament.withdrawnParticipants.addToSet(username);
    const fee = tournament.paidParticipants.includes(username) ? Math.max(0, Number(tournament.entryFee) || 0) : 0;
    tournament.paidParticipants = tournament.paidParticipants.filter(name => name !== username);
    tournament.escrowBalance = Math.max(0, Number(tournament.escrowBalance || 0) - fee);
    await tournament.save();
    if (fee) await creditArenaPoints(username, fee, `TOUR_LEAVE_REFUND:${tournament._id}:${username}`, `↩️ Rời giải ${tournament.title}: hoàn ${fee} Điểm Đấu Trường`);
    io.emit('tournamentUpdated', { tournamentId: String(tournament._id) });
    res.json({ message: 'Đã rời giải và hoàn phí tham gia.' });
});

app.post('/api/tournaments/:id/start', requireAuth, tournamentRateLimit, async (req, res) => {
    if (!isValidTournamentId(req.params.id)) return res.status(400).json({ message: 'Mã giải đấu không hợp lệ.' });
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Không tìm thấy giải đấu.' });
    if (tournament.creator !== req.session.user.username && req.session.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ chủ giải mới được bắt đầu.' });
    if ((tournament.participants || []).length < Number(tournament.minParticipants || 2)) return res.status(400).json({ message: `Cần ít nhất ${tournament.minParticipants} người tham gia.` });
    try { await startTournament(tournament); res.json({ message: 'Đã khóa đăng ký, chia cặp và bắt đầu giải.' }); }
    catch (error) { res.status(400).json({ message: error.message }); }
});

app.post('/api/tournaments/:id/cancel', requireAuth, tournamentRateLimit, async (req, res) => {
    if (!isValidTournamentId(req.params.id)) return res.status(400).json({ message: 'Mã giải đấu không hợp lệ.' });
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Không tìm thấy giải đấu.' });
    if (tournament.creator !== req.session.user.username && req.session.user.role !== 'admin') return res.status(403).json({ message: 'Chỉ chủ giải hoặc quản trị viên được hủy.' });
    if (tournament.status !== 'open') return res.status(400).json({ message: 'Không thể hủy sau khi giải đã bắt đầu. Hãy liên hệ quản trị viên nếu có sự cố.' });
    tournament.status = 'cancelled'; tournament.phase = 'completed'; tournament.finishedAt = new Date(); tournament.cancelReason = String(req.body.reason || 'Chủ giải hủy').slice(0, 200);
    await refundTournamentEntries(tournament, tournament.cancelReason);
    await tournament.save();
    io.emit('tournamentUpdated', { tournamentId: String(tournament._id) });
    res.json({ message: 'Đã hủy giải và hoàn toàn bộ Điểm Đấu Trường.' });
});
// --- LOGIC NHIỆM VỤ (Đã sửa để khớp với Database) ---

// --- 7. API GAME WIN (LƯU ĐIỂM VÀO DB) ---
function ensureUserRuntimeArrays(user) {
    if (!user) return user;
    user.quests = Array.isArray(user.quests) ? user.quests : [];
    user.history = Array.isArray(user.history) ? user.history : [];
    user.inventory = Array.isArray(user.inventory) ? user.inventory : [];
    return user;
}
function updateQuestProgress(user, taskType, performance = { timeTaken: 0, isWin: true }) {
    ensureUserRuntimeArrays(user);
    if (!user.quests || user.quests.length === 0) return;

    // Duyệt ngược mảng từ cuối lên đầu để xóa phần tử an toàn
    for (let i = user.quests.length - 1; i >= 0; i--) {
        let q = user.quests[i];

        // So khớp tên nhiệm vụ (Ví dụ: "Kiểm Tra" hoặc "Cờ Vua")
        if (q.taskType === taskType || taskType.includes(q.taskType)) {
            
            // 1. XỬ LÝ PHẠT ĐIỂM (Nếu nhiệm vụ có giới hạn thời gian và bé làm quá giờ)
            if (q.timeLimit > 0 && performance.timeTaken > q.timeLimit) {
                const p = parseInt(q.penalty || 20);
                
                // Trừ điểm nhưng đảm bảo không bao giờ bị âm dưới 0
                user.score = Math.max(0, user.score - p); 
                
                user.history.push({ 
                    activity: `⚠️ Thất bại NV ${q.taskType}: Làm quá giờ quy định (-${p}đ)`,
                    timestamp: new Date()
                });

                // Xóa nhiệm vụ này đi vì bé đã thất bại (phải giao lại nhiệm vụ mới)
                user.quests.splice(i, 1);
                continue; // Chuyển sang nhiệm vụ tiếp theo
            }

            // 2. XỬ LÝ CỘNG TIẾN ĐỘ (Nếu bé đạt điều kiện thắng/qua bài)
            if (performance.isWin) {
                q.progress += 1;

                // Kiểm tra xem bé đã làm đủ số lần mục tiêu chưa (Ví dụ: cần làm 1 lần)
                if (q.progress >= q.target) {
                    const r = parseInt(q.reward || 0);
                    
                    // Cộng điểm thưởng hoàn thành nhiệm vụ
                    user.score += r;
                    
                    user.history.push({ 
                        activity: `🎉 Hoàn thành xuất sắc NV ${q.taskType}: Thưởng +${r}đ`,
                        timestamp: new Date() 
                    });

                    // Hoàn thành xong thì xóa nhiệm vụ khỏi danh sách cho sạch ba lô
                    user.quests.splice(i, 1);
                }
            }
        }
    }
}
async function handleWin(req, res, gameKey, points = 10, taskName = '') {
    if (!req.session.user) return res.status(401).json({ message: 'Chưa đăng nhập.' });

    try {
        const user = await User.findOne({ username: req.session.user.username });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người chơi.' });
        if (user.isSuspended) return res.status(403).json({ message: 'Tài khoản đã bị khóa.' });
        ensureUserRuntimeArrays(user);

        const finishedLevel = clampInteger(req.body.level, 1, 1000, 1);
        const currentMaxLevel = Math.max(1, user[gameKey] || 1);

        if (finishedLevel > currentMaxLevel) {
            return res.status(400).json({
                message: `Tiến trình không hợp lệ. Hãy hoàn thành cấp ${currentMaxLevel} trước.`
            });
        }

        let addedScore = 0;
        let addedArenaPoints = 0;
        let isNewLevel = false;

        if (finishedLevel === currentMaxLevel) {
            user.score = Math.max(0, user.score || 0) + points;
            addedArenaPoints = Math.max(2, Math.min(50, Math.floor(points / 5)));
            user.arenaPoints = Math.max(0, Number(user.arenaPoints) || 0) + addedArenaPoints;
            user.arenaWelcomeGranted = true;
            user[gameKey] = currentMaxLevel + 1;
            addedScore = points;
            isNewLevel = true;
            user.history.push({
                activity: `🎮 Hoàn thành ${taskName || gameKey} cấp ${finishedLevel}: +${points}đ, +${addedArenaPoints} Điểm Đấu Trường`,
                timestamp: new Date()
            });
        }

        updateQuestProgress(user, taskName, {
            timeTaken: clampInteger(req.body.timeTaken, 0, 24 * 60 * 60, 0),
            isWin: true
        });

        if (user.history.length > 300) {
            user.history = user.history.slice(-300);
        }

        user.lastActiveAt = new Date();
        user.markModified('quests');
        await user.save();

        res.json({
            message: isNewLevel ? `Chúc mừng! +${points}💎` : 'Bạn đã hoàn thành cấp này trước đó rồi!',
            newScore: user.score,
            addedPoints: addedScore,
            addedArenaPoints,
            arenaPoints: user.arenaPoints,
            newLevel: user[gameKey]
        });
    } catch (error) {
        console.error(`Lỗi lưu chiến thắng ${gameKey}:`, error);
        res.status(500).json({ message: 'Không thể lưu kết quả trận đấu.' });
    }
}
// --- HÀM TÍNH ĐIỂM THÔNG MINH (CÀNG KHÓ CÀNG NHIỀU QUÀ) ---
// basePoints: Điểm cơ bản của game đó (ví dụ Cờ Vua là 50, Caro là 20)
function getDynamicScore(level, basePoints) {
    if (level <= 20) return basePoints;             // Cấp 1-20: Giữ nguyên
    if (level <= 50) return Math.floor(basePoints * 1.5); // Cấp 21-50: Tăng 50%
    if (level <= 80) return basePoints * 2;   
    if (level <= 100) return basePoints * 3; 
    if (level <= 150) return basePoints * 4;
    if (level <= 200) return basePoints * 5;
    if (level <= 300) return basePoints * 6;
    if (level <= 400) return basePoints * 7;
    if (level <= 500) return basePoints * 8; 
    if (level <= 600) return basePoints * 9;
    return basePoints *10 ;                          // Cấp 81-100: Nhân ba
}

// Hàm xử lý chung để code gọn gàng
const handleGameWin = (req, res, gameKey, basePoints, taskName) => {
    const level = parseInt(req.body.level) || 1;
    const finalScore = getDynamicScore(level, basePoints);
    handleWin(req, res, gameKey, finalScore, taskName);
};
// Cập nhật các dòng gọi API để truyền thêm Tên Nhiệm Vụ (Tham số thứ 3)
// --- DANH SÁCH API GAME (ĐÃ ÁP DỤNG TĂNG ĐIỂM THEO CẤP) ---

// 1. Nhóm Tư Duy & Logic
app.post('/api/game/chess-win-level', (req, res) => handleGameWin(req, res, 'chessLevel', 50, 'Cờ Vua'));     // 50 -> 150đ
const retiredBoardGameRoute = (req, res) => res.status(410).json({ message: 'Trò chơi này đã ngừng hỗ trợ. Hiện chỉ còn Cờ Vua trong khu vực Giải trí.' });
app.post('/api/game/go-win', retiredBoardGameRoute);
app.post('/api/game/othello-win', retiredBoardGameRoute);
app.post('/api/game/caro-win', retiredBoardGameRoute);

// 2. Nhóm Sáng Tạo & Ngôn Ngữ
app.post('/api/game/story-win', (req, res) => handleGameWin(req, res, 'storyLevel', 30, 'Sáng Tác'));        // 30 -> 90đ
app.post('/api/game/english-speech-win', (req, res) => handleGameWin(req, res, 'englishSpeechLevel', 15, 'Tiếng Anh')); 
app.post('/api/game/viet-speech-win', (req, res) => handleGameWin(req, res, 'vietSpeechLevel', 15, 'Luyện Nói Việt'));

// 3. Nhóm Giải Trí & Kỹ Năng
app.post('/api/game/music-win', (req, res) => handleGameWin(req, res, 'musicLevel', 20, 'Âm Nhạc'));
app.post('/api/game/detective-win', (req, res) => handleGameWin(req, res, 'detectiveLevel', 20, 'Thám tử'));
app.post('/api/game/shape-win', (req, res) => handleGameWin(req, res, 'shapeLevel', 20, 'Ghép Hình'));
app.post('/api/game/build-win', (req, res) => handleGameWin(req, res, 'buildLevel', 30, 'Xây Dựng'));
app.post('/api/game/memory-win', (req, res) => handleGameWin(req, res, 'memoryLevel', 15, 'Trí Nhớ'));
app.post('/api/game/crossword-win', (req, res) => handleGameWin(req, res, 'crosswordLevel', 15, 'Ô Chữ'));
// --- HỆ THỐNG BÀI KIỂM TRA TỔNG HỢP ---
const TEST_SUBJECT_LABELS = {
    toan: 'Toán học',
    'tieng-viet': 'Tiếng Việt',
    'tieng-anh': 'Tiếng Anh',
    'khoa-hoc': 'Khoa học',
    'lich-su': 'Lịch sử',
    'dia-ly': 'Địa lý'
};

function shuffleQuestions(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

app.get('/api/test/catalog', (req, res) => {
    const catalog = Object.entries(TEST_SUBJECT_LABELS).map(([subject, label]) => ({
        subject,
        label,
        grades: Array.from({ length: 12 }, (_, index) => {
            const grade = index + 1;
            const gradeKey = `grade${grade}`;
            return {
                grade,
                difficulties: {
                    easy: tests[subject]?.[gradeKey]?.easy?.length || 0,
                    medium: tests[subject]?.[gradeKey]?.medium?.length || 0,
                    hard: tests[subject]?.[gradeKey]?.hard?.length || 0
                }
            };
        })
    }));
    res.json({
        catalog,
        maxQuestionsPerTest: 30,
        totalQuestions: questionBankSummary.totalQuestions,
        updatedVersion: '5.0.0'
    });
});

// Lấy đề ngẫu nhiên và chỉ lưu đáp án ở phía máy chủ.
app.get('/api/test', (req, res) => {
    const subject = String(req.query.subject || '');
    const grade = Number.parseInt(req.query.grade, 10);
    const difficulty = String(req.query.difficulty || 'easy');
    const limit = Math.min(30, Math.max(10, Number.parseInt(req.query.limit, 10) || 10));

    if (!TEST_SUBJECT_LABELS[subject]) return res.status(404).json({ message: 'Môn học không hợp lệ.' });
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) return res.status(400).json({ message: 'Lớp học phải từ 1 đến 12.' });
    if (!['easy', 'medium', 'hard'].includes(difficulty)) return res.status(400).json({ message: 'Mức độ không hợp lệ.' });

    const gradeKey = `grade${grade}`;
    const allQuestions = tests[subject]?.[gradeKey]?.[difficulty] || [];
    if (allQuestions.length < limit) {
        return res.status(404).json({ message: 'Ngân hàng câu hỏi chưa đủ cho lựa chọn này.' });
    }

    const selected = shuffleQuestions(allQuestions).slice(0, limit);
    const answerKey = {};
    selected.forEach(question => {
        answerKey[question.id] = {
            answer: question.correct,
            explanation: question.explanation || `Đáp án đúng là ${question.correct}.`
        };
    });

    req.session.currentTestAnswers = answerKey;
    req.session.currentTestMeta = { subject, grade, difficulty, limit };
    req.session.testStartTime = Date.now();
    req.session.save(error => {
        if (error) return res.status(500).json({ message: 'Không thể tạo phiên bài kiểm tra.' });
        res.json(selected.map(question => ({ id: question.id, q: question.q, a: question.a })));
    });
});

app.post('/api/submit-test', async (req, res) => {
    const startTime = req.session.testStartTime;
    const now = Date.now();
    const answerKey = req.session.currentTestAnswers;
    const meta = req.session.currentTestMeta || {};

    if (!startTime || !answerKey) {
        return res.status(400).json({ score: 0, total: 0, message: 'Phiên làm bài đã hết hạn. Hãy tạo đề mới.' });
    }

    const maxDurationMs = Math.max(20, (meta.limit || 10) * 2) * 60 * 1000;
    if ((now - startTime) > maxDurationMs) {
        delete req.session.testStartTime;
        delete req.session.currentTestAnswers;
        delete req.session.currentTestMeta;
        req.session.save();
        return res.status(400).json({ score: 0, total: Object.keys(answerKey).length, message: 'Bài thi đã quá thời gian quy định.' });
    }

    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    let score = 0;
    const details = {};

    for (const [questionId, key] of Object.entries(answerKey)) {
        const userAnswer = String(answers[questionId] ?? '');
        const correctAnswer = typeof key === 'string' ? key : key.answer;
        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect) score += 1;
        details[questionId] = {
            correct: correctAnswer,
            userChosen: userAnswer || null,
            isCorrect,
            explanation: typeof key === 'string' ? `Đáp án đúng là ${correctAnswer}.` : key.explanation
        };
    }

    const total = Object.keys(answerKey).length;
    const timeTaken = Math.max(1, Math.floor((now - startTime) / 1000));
    if (req.session.user) {
        try {
            const user = await User.findOne({ username: req.session.user.username });
            if (user) {
                ensureUserRuntimeArrays(user);
                user.score += score * 10;
                updateQuestProgress(user, 'Kiểm Tra', { timeTaken, isWin: score >= total / 2 });
                user.history.push({
                    activity: `Thi ${TEST_SUBJECT_LABELS[meta.subject] || 'tổng hợp'} lớp ${meta.grade || '?'}: ${score}/${total} (${timeTaken}s)`,
                    timestamp: new Date()
                });
                user.markModified('quests');
                await user.save();
            }
        } catch (dbError) {
            console.error('Lỗi cập nhật kết quả bài thi:', dbError);
        }
    }

    delete req.session.testStartTime;
    delete req.session.currentTestAnswers;
    delete req.session.currentTestMeta;
    req.session.save();

    const percent = total ? Math.round(score / total * 100) : 0;
    const message = percent === 100 ? 'Xuất sắc! Bạn đã trả lời đúng toàn bộ.'
        : percent >= 80 ? 'Rất tốt! Bạn nắm kiến thức khá chắc.'
        : percent >= 50 ? 'Đã hoàn thành. Hãy xem kỹ phần giải thích để tiến bộ.'
        : 'Hãy ôn lại phần giải thích và thử một đề mới nhé.';

    res.json({ score, total, percent, timeTaken, message, details });
});
// --- API MỚI: RESET TOÀN BỘ LEVEL ---
app.post('/api/admin/reset-all-levels', async (req, res) => {
    // 1. Chặn nếu không phải admin
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Không có quyền truy cập!' });
    }

    try {
        // 2. Cập nhật tất cả user có vai trò là 'child'
        await User.updateMany({ role: 'child' }, { 
            $set: {
                chessLevel: 1, caroLevel: 1, goLevel: 1, othelloLevel: 1, monopolyLevel: 1,
                memoryLevel: 1, crosswordLevel: 1, detectiveLevel: 1, shapeLevel: 1,
                buildLevel: 1, storyLevel: 1, paintingLevel: 1,
                vietSpeechLevel: 1, englishSpeechLevel: 1
            }
        });
        res.json({ message: '✅ Đã reset cấp độ của tất cả các bé về 1!' });
    } catch (e) {
        res.status(500).json({ message: 'Lỗi hệ thống: ' + e.message });
    }
});
// --- HỆ THỐNG ĐỔI ĐIỂM SANG ROBUX (YÊU CẦU CÓ KIỂM DUYỆT) ---
function getRobuxRewardConfig() {
    return {
        enabled: ROBUX_REWARDS_ENABLED,
        pointsPerRobux: ROBUX_POINTS_PER_ROBUX,
        minRobux: ROBUX_MIN_REDEEM,
        maxDailyRobux: ROBUX_MAX_DAILY,
        maxOpenRequests: ROBUX_MAX_OPEN_REQUESTS,
        payoutMode: 'manual-group-payout',
        notice: 'Hệ thống chỉ tạo yêu cầu. Admin phải chi trả bằng phương thức chính thức của Roblox. Không bao giờ nhập mật khẩu hoặc cookie Roblox.'
    };
}

function normalizeRobloxUsername(value) {
    return String(value || '').trim();
}

function isValidRobloxUsername(value) {
    return /^[A-Za-z0-9_]{3,20}$/.test(value) && !value.startsWith('_') && !value.endsWith('_');
}

function createRobuxRequestCode() {
    return `RBX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

app.get('/api/robux/config', requireAuth, async (req, res) => {
    const user = await User.findOne({ username: req.session.user.username }).select('score');
    res.json({
        ...getRobuxRewardConfig(),
        score: user?.score || 0
    });
});

app.get('/api/robux/my-requests', requireAuth, async (req, res) => {
    const requests = await RobuxRedemption.find({ gameUsername: req.session.user.username })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
    res.json({ requests });
});

app.post('/api/robux/redeem', requireAuth, async (req, res) => {
    if (!ROBUX_REWARDS_ENABLED) {
        return res.status(503).json({ message: 'Hệ thống đổi Robux đang tạm khóa.' });
    }

    const robloxUsername = normalizeRobloxUsername(req.body.robloxUsername);
    const robloxUserId = String(req.body.robloxUserId || '').trim();
    const robuxAmount = Number.parseInt(req.body.robuxAmount, 10);

    if (!isValidRobloxUsername(robloxUsername)) {
        return res.status(400).json({ message: 'Tên Roblox phải dài 3–20 ký tự và chỉ gồm chữ, số hoặc dấu gạch dưới.' });
    }
    if (robloxUserId && !/^\d{1,24}$/.test(robloxUserId)) {
        return res.status(400).json({ message: 'Roblox User ID chỉ được chứa chữ số.' });
    }
    if (!Number.isInteger(robuxAmount) || robuxAmount < ROBUX_MIN_REDEEM || robuxAmount > ROBUX_MAX_DAILY) {
        return res.status(400).json({ message: `Mỗi yêu cầu phải từ ${ROBUX_MIN_REDEEM} đến ${ROBUX_MAX_DAILY} Robux.` });
    }

    const username = req.session.user.username;
    const openStatuses = ['pending', 'approved'];
    const openCount = await RobuxRedemption.countDocuments({
        gameUsername: username,
        status: { $in: openStatuses }
    });
    if (openCount >= ROBUX_MAX_OPEN_REQUESTS) {
        return res.status(429).json({ message: `Bạn đang có ${openCount} yêu cầu chưa hoàn tất. Hãy chờ admin xử lý.` });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dailyRows = await RobuxRedemption.aggregate([
        {
            $match: {
                gameUsername: username,
                createdAt: { $gte: startOfDay },
                status: { $in: ['pending', 'approved', 'paid'] }
            }
        },
        { $group: { _id: null, total: { $sum: '$robuxAmount' } } }
    ]);
    const dailyUsed = dailyRows[0]?.total || 0;
    if (dailyUsed + robuxAmount > ROBUX_MAX_DAILY) {
        return res.status(400).json({
            message: `Giới hạn hôm nay là ${ROBUX_MAX_DAILY} Robux. Bạn đã dùng ${dailyUsed} Robux.`
        });
    }

    const pointsSpent = robuxAmount * ROBUX_POINTS_PER_ROBUX;
    const activity = `🎁 Giữ ${pointsSpent} điểm cho yêu cầu đổi ${robuxAmount} Robux`;
    const updatedUser = await User.findOneAndUpdate(
        {
            username,
            isSuspended: { $ne: true },
            score: { $gte: pointsSpent }
        },
        {
            $inc: { score: -pointsSpent },
            $push: { history: { activity, timestamp: new Date() } }
        },
        { new: true }
    ).select('score');

    if (!updatedUser) {
        return res.status(400).json({ message: `Không đủ điểm. Cần ${pointsSpent.toLocaleString('vi-VN')} điểm.` });
    }

    try {
        const request = await RobuxRedemption.create({
            requestCode: createRobuxRequestCode(),
            gameUsername: username,
            robloxUsername,
            robloxUserId,
            pointsSpent,
            robuxAmount,
            status: 'pending'
        });

        return res.status(201).json({
            message: `Đã gửi yêu cầu ${robuxAmount} Robux. ${pointsSpent.toLocaleString('vi-VN')} điểm đang được giữ để tránh đổi trùng.`,
            newScore: updatedUser.score,
            request
        });
    } catch (error) {
        await User.updateOne(
            { username },
            {
                $inc: { score: pointsSpent },
                $push: { history: { activity: `Hoàn ${pointsSpent} điểm vì tạo yêu cầu Robux thất bại`, timestamp: new Date() } }
            }
        );
        console.error('Lỗi tạo yêu cầu Robux:', error);
        return res.status(500).json({ message: 'Không thể tạo yêu cầu. Điểm đã được hoàn lại.' });
    }
});

app.post('/api/robux/cancel/:requestId', requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.requestId)) {
        return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ.' });
    }

    const request = await RobuxRedemption.findOneAndUpdate(
        {
            _id: req.params.requestId,
            gameUsername: req.session.user.username,
            status: 'pending'
        },
        {
            $set: {
                status: 'cancelled',
                processedAt: new Date(),
                adminNote: 'Người chơi tự hủy yêu cầu'
            }
        },
        { new: true }
    );

    if (!request) {
        return res.status(400).json({ message: 'Chỉ có thể hủy yêu cầu đang chờ duyệt.' });
    }

    const user = await User.findOneAndUpdate(
        { username: req.session.user.username },
        {
            $inc: { score: request.pointsSpent },
            $push: {
                history: {
                    activity: `↩️ Hoàn ${request.pointsSpent} điểm do hủy yêu cầu ${request.requestCode}`,
                    timestamp: new Date()
                }
            }
        },
        { new: true }
    ).select('score');

    res.json({
        message: `Đã hủy yêu cầu và hoàn ${request.pointsSpent.toLocaleString('vi-VN')} điểm.`,
        newScore: user?.score || 0,
        request
    });
});

app.get('/api/admin/robux-redemptions', requireAdmin, async (req, res) => {
    const allowedStatuses = ['all', 'pending', 'approved', 'paid', 'rejected', 'cancelled'];
    const requestedStatus = allowedStatuses.includes(req.query.status) ? req.query.status : 'pending';
    const filter = requestedStatus === 'all' ? {} : { status: requestedStatus };
    const requests = await RobuxRedemption.find(filter).sort({ createdAt: -1 }).limit(200).lean();

    const summaryRows = await RobuxRedemption.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, robux: { $sum: '$robuxAmount' } } }
    ]);
    const summary = Object.fromEntries(summaryRows.map(row => [row._id, { count: row.count, robux: row.robux }]));

    res.json({ config: getRobuxRewardConfig(), requests, summary });
});

app.post('/api/admin/robux-redemptions/:requestId/action', requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.requestId)) {
        return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ.' });
    }

    const action = String(req.body.action || '').trim();
    const adminNote = String(req.body.adminNote || '').trim().slice(0, 500);
    const adminUsername = req.session.user.username;
    let fromStatuses;
    let nextStatus;

    if (action === 'approve') {
        fromStatuses = ['pending'];
        nextStatus = 'approved';
    } else if (action === 'mark-paid') {
        fromStatuses = ['approved'];
        nextStatus = 'paid';
    } else if (action === 'reject') {
        fromStatuses = ['pending', 'approved'];
        nextStatus = 'rejected';
    } else {
        return res.status(400).json({ message: 'Hành động không hợp lệ.' });
    }

    const request = await RobuxRedemption.findOneAndUpdate(
        { _id: req.params.requestId, status: { $in: fromStatuses } },
        {
            $set: {
                status: nextStatus,
                adminNote,
                processedBy: adminUsername,
                processedAt: new Date()
            }
        },
        { new: true }
    );

    if (!request) {
        return res.status(409).json({ message: 'Yêu cầu đã được xử lý hoặc không còn ở trạng thái phù hợp.' });
    }

    if (nextStatus === 'rejected') {
        await User.updateOne(
            { username: request.gameUsername },
            {
                $inc: { score: request.pointsSpent },
                $push: {
                    history: {
                        activity: `↩️ Hoàn ${request.pointsSpent} điểm vì yêu cầu ${request.requestCode} bị từ chối`,
                        timestamp: new Date()
                    }
                }
            }
        );
    } else if (nextStatus === 'paid') {
        await User.updateOne(
            { username: request.gameUsername },
            {
                $push: {
                    history: {
                        activity: `✅ Yêu cầu ${request.requestCode}: admin xác nhận đã chi ${request.robuxAmount} Robux`,
                        timestamp: new Date()
                    }
                }
            }
        );
    }

    res.json({
        message: nextStatus === 'approved'
            ? 'Đã duyệt yêu cầu. Hãy thanh toán bằng phương thức chính thức của Roblox rồi đánh dấu đã trả.'
            : nextStatus === 'paid'
                ? 'Đã đánh dấu yêu cầu là đã trả Robux.'
                : `Đã từ chối và hoàn ${request.pointsSpent.toLocaleString('vi-VN')} điểm.`,
        request
    });
});

// --- API NGÔI NHÀ CỦA BÉ ---
// --- API MỚI: TẢI NHÀ CỦA BẠN BÈ ĐỂ ĐI THĂM ---
app.get('/api/house/visit/:friendUsername', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
    try {
        const friend = await User.findOne({ username: req.params.friendUsername });
        if (!friend) return res.status(404).json({ message: 'Không tìm thấy người bạn này!' });

        res.json({ 
            friendName: friend.username,
            houseData: friend.houseData || [],
            worldSettings: friend.worldSettings || { theme: 'spring', weatherMode: 'auto', timeMode: 'auto' },
            survivalState: friend.survivalState || {}
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});
// 1. Lấy thông tin nhà và Shop
app.get('/api/house/info', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
    
    try {
        const user = await User.findOne({ username: req.session.user.username });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

        res.json({ 
            // Bổ sung || để đảm bảo luôn có dữ liệu trả về, không bị undefined
            username: user.username,
            score: user.score || 0,
            inventory: user.inventory || [],
            miningStats: user.miningStats || { total: 0, byOre: {}, lastMinedAt: null },
            houseData: user.houseData || [],
            chestsData: user.chestsData || {},
            worldSettings: user.worldSettings || { theme: 'spring', weatherMode: 'auto', timeMode: 'auto' },
            survivalState: user.survivalState || {},
            shopItems: SHOP_ITEMS // Đảm bảo biến SHOP_ITEMS đã được khai báo ở trên
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server: ' + error.message });
    }
});
// 2. Mua đồ
app.post('/api/house/buy', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Chưa đăng nhập' });

    const itemId = String(req.body.itemId || '');
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return res.status(400).json({ message: 'Vật phẩm không tồn tại' });
    if (item.purchasable === false) return res.status(400).json({ message: 'Vật phẩm sinh tồn chỉ nhận bằng khai thác hoặc chế tạo.' });

    // Sơn và sàn được bán theo gói 10 ô; các vật phẩm khác nhận 1 món.
    const quantity = ['paint', 'floor'].includes(item.category) ? 10 : 1;
    const inventoryItems = Array.from({ length: quantity }, () => itemId);
    const user = await User.findOneAndUpdate(
        {
            username: req.session.user.username,
            isSuspended: { $ne: true },
            score: { $gte: item.price }
        },
        {
            $inc: { score: -item.price },
            $push: {
                inventory: { $each: inventoryItems },
                history: {
                    activity: `🛍️ Mua ${quantity} x ${item.name}: -${item.price} điểm`,
                    timestamp: new Date()
                }
            }
        },
        { new: true }
    ).select('score');

    if (!user) {
        return res.status(400).json({ message: 'Không đủ điểm hoặc tài khoản đang bị tạm khóa.' });
    }

    res.json({
        message: `Đã mua ${quantity} x ${item.name}!`,
        newScore: user.score,
        quantity
    });
});


// 2B. Mỏ vô tận: không giới hạn số quặng theo ngày, chỉ chống nhấp trùng trong vài mili giây.
app.post('/api/house/mine', requireAuth, miningRateLimit, async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
    const username = req.session.user.username;
    const oreId = String(req.body.oreId || '');
    if (!MINEABLE_ORES[oreId]) return res.status(400).json({ message: 'Loại quặng không hợp lệ.' });

    const now = Date.now();
    const previous = mineCooldowns.get(username) || 0;
    if (now - previous < 160) return res.status(429).json({ message: 'Bạn đang đào quá nhanh, hãy giữ nhịp một chút.' });
    mineCooldowns.set(username, now);

    const bonus = Math.random() < 0.12 ? 1 : 0;
    const quantity = 1 + bonus;
    const inventoryItems = Array.from({ length: quantity }, () => oreId);
    const update = {
        $push: { inventory: { $each: inventoryItems } },
        $inc: {
            'miningStats.total': quantity,
            [`miningStats.byOre.${oreId}`]: quantity
        },
        $set: { 'miningStats.lastMinedAt': new Date() }
    };
    const user = await User.findOneAndUpdate(
        { username, isSuspended: { $ne: true } },
        update,
        { new: true }
    ).select('miningStats');
    if (!user) return res.status(403).json({ message: 'Tài khoản đang bị tạm khóa.' });
    const item = SHOP_ITEMS.find(entry => entry.id === oreId);
    res.json({
        oreId,
        quantity,
        bonus: Boolean(bonus),
        name: item?.name || oreId,
        icon: item?.icon || '⛏️',
        totalMined: Number(user.miningStats?.total) || 0,
        message: bonus ? `May mắn! Nhận ${quantity} ${item?.name || 'quặng'}.` : `Đã đào 1 ${item?.name || 'quặng'}.`
    });
});


// 2C. Sinh tồn V13: trạng thái có thẩm quyền phía máy chủ, đặt khối, độ bền công cụ và mô phỏng theo thời gian.
async function withSurvivalLock(username, task) {
    const previous = survivalLocks.get(username) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const chain = previous.then(() => gate);
    survivalLocks.set(username, chain);
    await previous;
    try { return await task(); } finally { release(); if (survivalLocks.get(username) === chain) survivalLocks.delete(username); }
}
function setSurvivalState(user, nextState) {
    const safe = safeSurvivalState(nextState);
    user.set('survivalState', safe);
    user.markModified('survivalState');
    return safe;
}
function removeOne(items, itemId) {
    const index = items.indexOf(itemId);
    if (index < 0) return false;
    items.splice(index, 1);
    return true;
}
app.get('/api/survival/state', requireAuth, async (req, res) => {
    const result = await withSurvivalLock(req.session.user.username, async () => {
        const user = await User.findOne({ username: req.session.user.username, isSuspended: { $ne: true } }).select('survivalState inventory');
        if (!user) return { status: 404, body: { message: 'Không tìm thấy người chơi.' } };
        const state = setSurvivalState(user, advanceSurvivalState(user.survivalState));
        await user.save();
        return { status: 200, body: { state, inventory: inventoryCounts(user.inventory || []), recipes: SURVIVAL_RECIPES, placeable: SURVIVAL_PLACEABLE, world: SURVIVAL_WORLD } };
    });
    res.status(result.status).json(result.body);
});
app.post('/api/survival/sync', requireAuth, async (req, res) => {
    const result = await withSurvivalLock(req.session.user.username, async () => {
        const user = await User.findOne({ username: req.session.user.username, isSuspended: { $ne: true } }).select('survivalState inventory');
        if (!user) return { status: 403, body: { message: 'Tài khoản không thể đồng bộ sinh tồn.' } };
        const state = advanceSurvivalState(user.survivalState);
        const requestedTool = String(req.body.equippedTool || '').slice(0, 50);
        state.equippedTool = requestedTool && (user.inventory || []).includes(requestedTool) && SURVIVAL_TOOLS[requestedTool] ? requestedTool : '';
        if (req.body.died === true && state.health <= 5) {
            state.deaths += 1;
            state.health = 100;
            state.hunger = 70;
            state.stamina = 100;
        }
        const safe = setSurvivalState(user, state);
        await user.save();
        return { status: 200, body: { state: safe, inventory: inventoryCounts(user.inventory || []) } };
    });
    res.status(result.status).json(result.body);
});
app.post('/api/survival/mine', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const now = Date.now();
    const last = survivalActionCooldowns.get(username) || 0;
    if (now - last < 100) return res.status(429).json({ message: 'Thao tác quá nhanh.' });
    survivalActionCooldowns.set(username, now);
    const blockType = String(req.body.blockType || '');
    const blockKey = String(req.body.blockKey || '');
    const toolId = String(req.body.toolId || '').slice(0, 50);
    const result = await withSurvivalLock(username, async () => {
        const user = await User.findOne({ username, isSuspended: { $ne: true } }).select('inventory survivalState');
        if (!user) return { status: 403, body: { message: 'Tài khoản không thể khai thác.' } };
        const state = advanceSurvivalState(user.survivalState);
        const placedIndex = state.placedBlocks.findIndex(item => item.key === blockKey);
        const placedBlock = placedIndex >= 0 ? state.placedBlocks[placedIndex] : null;
        if (!placedBlock && state.removedBlocks.includes(blockKey)) return { status: 409, body: { message: 'Khối này đã được khai thác.' } };
        const validation = validateSurvivalMine({ blockType, blockKey, toolId, inventory: user.inventory || [], placedBlock });
        if (!validation.ok) return { status: 400, body: { message: validation.message } };
        if (state.stamina < validation.block.staminaCost) return { status: 409, body: { message: 'Không đủ thể lực. Hãy nghỉ một lát hoặc ăn để hồi phục.' } };
        if (!placedBlock && state.removedBlocks.length >= SURVIVAL_WORLD.maxChangedBlocks) return { status: 409, body: { message: 'Thế giới đã đạt giới hạn khối thay đổi. Hãy tạo lại đảo hoặc lấp bớt hố.' } };

        if (placedBlock) state.placedBlocks.splice(placedIndex, 1);
        else state.removedBlocks.push(blockKey);
        state.stamina = Math.max(0, state.stamina - validation.block.staminaCost);
        state.hunger = Math.max(0, state.hunger - 0.12);
        state.xp += Number(validation.block.xp) || 0;
        state.level = survivalLevelFromXp(state.xp);

        const worn = applySurvivalToolWear({ inventory: user.inventory || [], durability: state.toolDurability, toolId });
        user.inventory = worn.inventory;
        state.toolDurability = worn.durability;
        if (worn.broken && state.equippedTool === toolId && !user.inventory.includes(toolId)) state.equippedTool = '';

        const dropGranted = validation.block.chance === undefined || Math.random() < validation.block.chance;
        if (dropGranted) user.inventory.push(validation.block.drop);
        const safe = setSurvivalState(user, state);
        user.markModified('inventory');
        await user.save();
        return {
            status: 200,
            body: {
                blockKey,
                blockType: validation.effectiveType,
                placed: validation.placed,
                dropId: dropGranted ? validation.block.drop : null,
                quantity: dropGranted ? 1 : 0,
                tool: toolId ? { id: toolId, durability: worn.remaining, maxDurability: SURVIVAL_TOOLS[toolId]?.maxDurability || 0, broken: worn.broken } : null,
                state: safe,
                inventory: inventoryCounts(user.inventory || []),
                message: worn.broken ? 'Đã khai thác nhưng công cụ đã hết độ bền và bị hỏng.' : dropGranted ? 'Đã khai thác và cất vật phẩm vào ba lô.' : 'Khối lá không rơi vật phẩm lần này.'
            }
        };
    });
    res.status(result.status).json(result.body);
});
app.post('/api/survival/place', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const now = Date.now();
    const last = survivalActionCooldowns.get(username) || 0;
    if (now - last < 100) return res.status(429).json({ message: 'Thao tác quá nhanh.' });
    survivalActionCooldowns.set(username, now);
    const itemId = String(req.body.itemId || '').slice(0, 80);
    const blockKey = String(req.body.blockKey || '').slice(0, 50);
    const result = await withSurvivalLock(username, async () => {
        const user = await User.findOne({ username, isSuspended: { $ne: true } }).select('inventory survivalState');
        if (!user) return { status: 403, body: { message: 'Tài khoản không thể đặt khối.' } };
        const state = advanceSurvivalState(user.survivalState);
        if (state.placedBlocks.length >= SURVIVAL_WORLD.maxChangedBlocks) return { status: 409, body: { message: 'Đã đạt giới hạn khối do người chơi đặt.' } };
        const validation = validateSurvivalPlace({ itemId, blockKey, inventory: user.inventory || [], removedBlocks: state.removedBlocks, placedBlocks: state.placedBlocks });
        if (!validation.ok) return { status: 400, body: { message: validation.message } };
        const inventory = [...(user.inventory || [])];
        if (!removeOne(inventory, itemId)) return { status: 409, body: { message: 'Vật phẩm đã được sử dụng ở thao tác khác.' } };
        state.placedBlocks.push({ key: validation.position.key, type: validation.blockType, placedAt: new Date() });
        state.stamina = Math.max(0, state.stamina - 0.5);
        user.inventory = inventory;
        user.markModified('inventory');
        const safe = setSurvivalState(user, state);
        await user.save();
        return { status: 200, body: { message: 'Đã đặt khối và lưu vào thế giới.', blockKey: validation.position.key, blockType: validation.blockType, state: safe, inventory: inventoryCounts(inventory) } };
    });
    res.status(result.status).json(result.body);
});
app.post('/api/survival/craft', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const recipeId = String(req.body.recipeId || '');
    const autoCraft = req.body.autoCraft !== false;
    const recipe = SURVIVAL_RECIPES[recipeId];
    if (!recipe) return res.status(400).json({ message: 'Công thức không hợp lệ.' });
    const result = await withSurvivalLock(username, async () => {
        const user = await User.findOne({ username, isSuspended: { $ne: true } }).select('inventory survivalState');
        if (!user) return { status: 403, body: { message: 'Tài khoản không thể chế tạo.' } };
        const state = advanceSurvivalState(user.survivalState);
        const plan = planSurvivalCraft({ recipeId, inventory: user.inventory || [], autoCraft });
        if (!plan.ok) return { status: 400, body: { message: plan.message, missing: plan.missing || [], recipes: SURVIVAL_RECIPES, inventory: inventoryCounts(user.inventory || []) } };
        state.xp += 5;
        state.level = survivalLevelFromXp(state.xp);
        if (SURVIVAL_TOOLS[recipe.output]) state.toolDurability[recipe.output] = SURVIVAL_TOOLS[recipe.output].maxDurability;
        user.inventory = plan.inventory;
        user.markModified('inventory');
        const safe = setSurvivalState(user, state);
        await user.save();
        const autoSteps = Math.max(0, (plan.operations || []).length - 1);
        return { status: 200, body: {
            message: autoSteps ? `Chế tạo thành công; hệ thống đã tự làm ${autoSteps} nguyên liệu trung gian.` : 'Chế tạo thành công.',
            output: recipe.output,
            outputLabel: SURVIVAL_ITEM_LABELS[recipe.output] || recipe.name || recipe.output,
            quantity: recipe.quantity,
            operations: plan.operations,
            inventory: inventoryCounts(plan.inventory),
            inventoryItems: plan.inventory,
            state: safe
        } };
    });
    res.status(result.status).json(result.body);
});
app.post('/api/survival/eat', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const itemId = String(req.body.itemId || '');
    const food = { survival_berry: 12, survival_bread: 35 }[itemId];
    if (!food) return res.status(400).json({ message: 'Vật phẩm này không ăn được.' });
    const result = await withSurvivalLock(username, async () => {
        const user = await User.findOne({ username, isSuspended: { $ne: true } }).select('inventory survivalState');
        if (!user) return { status: 403, body: { message: 'Tài khoản không thể sử dụng thức ăn.' } };
        const inventory = [...(user.inventory || [])];
        if (!removeOne(inventory, itemId)) return { status: 400, body: { message: 'Không còn thức ăn này.' } };
        const state = advanceSurvivalState(user.survivalState);
        state.hunger = Math.min(100, state.hunger + food);
        state.health = Math.min(100, state.health + (itemId === 'survival_bread' ? 8 : 2));
        user.inventory = inventory;
        user.markModified('inventory');
        const safe = setSurvivalState(user, state);
        await user.save();
        return { status: 200, body: { message: 'Đã ăn và hồi phục.', state: safe, inventory: inventoryCounts(inventory) } };
    });
    res.status(result.status).json(result.body);
});
app.post('/api/survival/reset', requireAuth, async (req, res) => {
    const username = req.session.user.username;
    const result = await withSurvivalLock(username, async () => {
        const user = await User.findOne({ username, isSuspended: { $ne: true } }).select('survivalState inventory');
        if (!user) return { status: 403, body: { message: 'Tài khoản không thể tạo lại đảo.' } };
        const current = safeSurvivalState(user.survivalState);
        const lastReset = current.lastResetAt ? new Date(current.lastResetAt).getTime() : 0;
        const waitMs = 10 * 60 * 1000 - (Date.now() - lastReset);
        if (waitMs > 0) return { status: 429, body: { message: `Có thể tạo lại đảo sau ${Math.ceil(waitMs / 60000)} phút.` } };
        const next = { health: 100, hunger: 100, stamina: 100, xp: current.xp, level: current.level, deaths: current.deaths, equippedTool: current.equippedTool, removedBlocks: [], placedBlocks: [], toolDurability: current.toolDurability, lastUpdatedAt: new Date(), lastResetAt: new Date(), worldVersion: SURVIVAL_WORLD.version };
        const safe = setSurvivalState(user, next);
        await user.save();
        return { status: 200, body: { message: 'Đã tạo lại địa hình. Cấp, XP, công cụ và vật phẩm được giữ nguyên.', state: safe } };
    });
    res.status(result.status).json(result.body);
});


// 3. Lưu vị trí đồ đạc (ĐÃ FIX LỖI CƯỚP NHÀ)
app.post('/api/house/save', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Chưa đăng nhập' });
    const { username, hostUsername, items, inventory, chestsData, worldSettings } = req.body;    
    
    // BẢO MẬT: Chặn không cho lưu nếu tên chủ nhà (gửi từ frontend) khác với tên người đang đăng nhập
    if ((username && username !== req.session.user.username) || (hostUsername && hostUsername !== req.session.user.username)) {
        return res.status(403).json({ message: "Bạn chỉ có thể lưu khi ở thế giới của chính mình!" });
    }

    await User.updateOne(
        { username: req.session.user.username }, 
        { $set: {
            houseData: Array.isArray(items) ? items : [],
            inventory: Array.isArray(inventory) ? inventory : [],
            chestsData: chestsData || {},
            worldSettings: {
                theme: ['spring', 'sunset', 'winter', 'fantasy'].includes(worldSettings?.theme) ? worldSettings.theme : 'spring',
                weatherMode: ['auto', 'clear', 'rain', 'snow', 'fog'].includes(worldSettings?.weatherMode) ? worldSettings.weatherMode : 'auto',
                timeMode: ['auto', 'day', 'sunset', 'night'].includes(worldSettings?.timeMode) ? worldSettings.timeMode : 'auto'
            }
        } } 
    );
    res.json({ message: "Đã lưu ngôi nhà và kho đồ!" });
});
// =================================================================
// --- 8. SOCKET.IO (KHÔI PHỤC LOGIC CARO/CHESS CHI TIẾT) ---
// =================================================================

function normalizeRoomId(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
}
async function ensureTournamentSocketRoom(roomId, gameType, username) {
    if (!roomId.startsWith('TOUR-')) return gameRooms[roomId] || null;
    const tourney = await Tournament.findOne({ status: 'playing', gameType, $or: [{ 'brackets.matchId': roomId }, { 'brackets.matches.matchId': roomId }] });
    if (!tourney) return null;
    const match = findTournamentMatch(tourney, roomId);
    if (!match || match.winner || ![match.p1, match.p2].includes(username)) return null;
    const start = new Date(match.startTime || Date.now());
    const earliest = start.getTime() - 30 * 60 * 1000;
    const latest = start.getTime() + (Number(tourney.matchDuration) + 90) * 60 * 1000;
    if (Date.now() < earliest || Date.now() > latest) return null;
    match.checkIns ||= {};
    match.checkIns[username] = new Date();
    if (match.status === 'scheduled') match.status = 'checking-in';
    tourney.markModified('brackets'); await tourney.save();
    if (!gameRooms[roomId]) {
        gameRooms[roomId] = {
            createdAt: Date.now(), lastActivityAt: Date.now(),
            gameType, players: [], playerNames: {}, turn: null, tournament: true,
            expectedPlayers: [match.p1, match.p2], matchId: roomId,
            matchDuration: tourney.matchDuration, size: gameType === 'caro' ? 20 : 13,
            board: gameType === 'caro' ? Array.from({ length: 20 }, () => Array(20).fill(null)) : null
        };
    }
    return gameRooms[roomId];
}
async function joinTwoPlayerRoom({ socket, rawRoomId, gameType, username, roles, createdEvent = 'matchFound' }) {
    const roomId = normalizeRoomId(rawRoomId);
    let room = gameRooms[roomId];
    if (!room && roomId.startsWith('TOUR-')) room = await ensureTournamentSocketRoom(roomId, gameType, username);
    if (!room || room.gameType !== gameType) {
        socket.emit('notification', '❌ Phòng không tồn tại, sai môn thi hoặc chưa đến giờ vào trận.');
        return null;
    }
    const duplicateId = Object.keys(room.playerNames || {}).find(id => room.playerNames[id] === username && id !== socket.id);
    if (duplicateId) {
        const oldSocket = io.sockets.sockets.get(duplicateId);
        if (oldSocket?.connected) { socket.emit('notification', '❌ Tài khoản đang ở trong phòng trên thiết bị khác.'); return null; }
        room.players = room.players.filter(id => id !== duplicateId); delete room.playerNames[duplicateId];
    }
    if (room.expectedPlayers && !room.expectedPlayers.includes(username)) {
        socket.emit('notification', '❌ Bạn không nằm trong cặp đấu này.'); return null;
    }
    if (!room.players.includes(socket.id)) {
        if (room.players.length >= 2) { socket.emit('notification', '❌ Phòng đã đủ hai người.'); return null; }
        room.players.push(socket.id); room.playerNames[socket.id] = username; socket.join(roomId);
    }
    if (room.players.length < 2) {
        socket.emit('waiting', { message: 'Đã vào phòng. Đang chờ đối thủ...', room: roomId });
        return room;
    }
    if (room.expectedPlayers) {
        room.players.sort((a, b) => room.expectedPlayers.indexOf(room.playerNames[a]) - room.expectedPlayers.indexOf(room.playerNames[b]));
    }
    const [firstId, secondId] = room.players;
    room.turn = firstId;
    if (gameType === 'caro' && !room.board) room.board = Array.from({ length: 20 }, () => Array(20).fill(null));
    if (gameType === 'othello' && !room.board) room.board = createOthelloBoard();
    const payloadBase = {
        room: roomId,
        isTournament: Boolean(room.tournament),
        matchDuration: room.matchDuration || 20,
        size: room.size,
        ...(gameType === 'othello' ? { board: room.board, turnRole: 1 } : {})
    };
    io.to(firstId).emit(createdEvent, { ...payloadBase, role: roles[0], opponent: room.playerNames[secondId], yourTurn: true });
    io.to(secondId).emit(createdEvent, { ...payloadBase, role: roles[1], opponent: room.playerNames[firstId], yourTurn: false });
    if (room.tournament) {
        const tourney = await Tournament.findOne({ status: 'playing', gameType, $or: [{ 'brackets.matchId': roomId }, { 'brackets.matches.matchId': roomId }] });
        const match = tourney && findTournamentMatch(tourney, roomId);
        if (match) { match.status = 'live'; match.actualStartTime ||= new Date(); tourney.markModified('brackets'); await tourney.save(); io.emit('tournamentUpdated'); }
    }
    return room;
}
function hasCaroFive(board, row, col, symbol) {
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    return dirs.some(([dr,dc]) => {
        let count = 1;
        for (const sign of [-1, 1]) for (let step = 1; step < 6; step++) {
            const r = row + dr * step * sign, c = col + dc * step * sign;
            if (r < 0 || c < 0 || r >= board.length || c >= board.length || board[r][c] !== symbol) break;
            count += 1;
        }
        return count >= 5;
    });
}

function createOthelloBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[3][3] = 2; board[4][4] = 2; board[3][4] = 1; board[4][3] = 1;
    return board;
}
function getOthelloFlips(board, row, col, color) {
    if (!Array.isArray(board) || board[row]?.[col] !== 0) return [];
    const opponent = color === 1 ? 2 : 1;
    const directions = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    const flips = [];
    for (const [dr, dc] of directions) {
        const line = [];
        let r = row + dr, c = col + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opponent) {
            line.push([r, c]); r += dr; c += dc;
        }
        if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === color) flips.push(...line);
    }
    return flips;
}
function hasOthelloMove(board, color) {
    for (let r = 0; r < 8; r += 1) for (let c = 0; c < 8; c += 1) {
        if (getOthelloFlips(board, r, c, color).length) return true;
    }
    return false;
}
function countOthello(board) {
    let black = 0, white = 0;
    for (const row of board || []) for (const cell of row || []) {
        if (cell === 1) black += 1;
        if (cell === 2) white += 1;
    }
    return { black, white };
}

io.on('connection', (socket) => {
    const sessionUser = socket.request.session.user;
    if (sessionUser) {
        onlineUsers[sessionUser.username] = socket.id; // Lưu lại socketId của bé
    }

    socket.on('disconnect', () => {
        if (sessionUser) delete onlineUsers[sessionUser.username]; // Xóa khi bé thoát
    });
    const username = sessionUser ? sessionUser.username : `Khách-${socket.id.substr(0,4)}`;

    // Kiểm tra bảo trì khi vừa connect
    if (maintenanceMode && (!sessionUser || sessionUser.role !== 'admin')) {
        socket.emit('maintenanceModeOn', { message: 'Server đang bảo trì' });
        socket.disconnect();
        return;
    }
socket.on('join3DHouse', (hostUsername) => {
        // Rời phòng cũ nếu có
        if (socket.houseRoom) {
            socket.leave(socket.houseRoom);
            socket.to(socket.houseRoom).emit('playerLeftHouse', socket.id);
        }
        
        const roomId = `house-${hostUsername}`;
        socket.join(roomId);
        socket.houseRoom = roomId;

        // Báo cho những người trong phòng biết có người mới vào
        socket.to(roomId).emit('playerJoinedHouse', { 
            id: socket.id, 
            username: sessionUser?.username || 'Khách' 
        });
    });

    // 2. Đồng bộ vị trí di chuyển
    socket.on('move3DPlayer', (posData) => {
        if(socket.houseRoom) {
            socket.to(socket.houseRoom).emit('updatePlayerPos', { id: socket.id, pos: posData });
        }
    });

    // 3. Đồng bộ Đặt gạch (Xây)
    socket.on('build3DBlock', (data) => {
        if(socket.houseRoom) socket.to(socket.houseRoom).emit('syncBuild', data);
    });

    // 4. Đồng bộ Đập gạch (Phá)
    socket.on('break3DBlock', (uniqueId) => {
        if(socket.houseRoom) socket.to(socket.houseRoom).emit('syncBreak', uniqueId);
    });
// 5. Đồng bộ Đóng/Mở cửa
    socket.on('toggle3DDoor', (data) => {
        if(socket.houseRoom) {
            socket.to(socket.houseRoom).emit('syncDoor', data);
        }
    });
    // --- GAME TÌM TRẬN ---
// --- GAME TÌM TRẬN (SỬA LỖI ĐI TRƯỚC/SAU) ---
socket.on('findMatch', (rawGameType) => {
    const gameType = normalizeGameType(rawGameType);
    if (!gameType) return socket.emit('notification', '❌ Trò chơi không hợp lệ.');
    const queued = waitingPlayers[gameType];
    if (queued && queued.connected && queued.id !== socket.id) {
        delete waitingPlayers[gameType];
        const opponentName = queued.request.session?.user?.username || `Khách-${queued.id.slice(0,4)}`;
        const roomId = normalizeRoomId(`ROOM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`);
        gameRooms[roomId] = { createdAt: Date.now(), lastActivityAt: Date.now(), gameType, players: [queued.id, socket.id], playerNames: { [queued.id]: opponentName, [socket.id]: username }, turn: queued.id, size: gameType === 'caro' ? 20 : 13, board: gameType === 'caro' ? Array.from({ length: 20 }, () => Array(20).fill(null)) : null };
        queued.join(roomId); socket.join(roomId);
        const roles = gameType === 'caro' ? ['X','O'] : ['b','w'];
        queued.emit('matchFound', { room: roomId, role: roles[0], opponent: username, yourTurn: true, size: gameRooms[roomId].size });
        socket.emit('matchFound', { room: roomId, role: roles[1], opponent: opponentName, yourTurn: false, size: gameRooms[roomId].size });
    } else {
        waitingPlayers[gameType] = socket;
        socket.emit('waiting', { message: 'Đang tìm đối thủ...' });
    }
});
// --- LOGIC ĐẤU TOÁN PVP ---
const mathWaitingPlayers = {}; // Lưu danh sách chờ theo khối lớp { 1: socket, 2: socket }

socket.on('findMathMatch', async (data = {}) => {
    if (!sessionUser) {
        return socket.emit('statusUpdate', { message: '❌ Vui lòng đăng nhập trước khi tìm trận.' });
    }

    const grade = clampInteger(data.grade, 1, 12, 1);
    const gradeKey = `grade${grade}`;
    if (!tests.toan?.[gradeKey]?.easy?.length) {
        return socket.emit('statusUpdate', { message: `❌ Chưa có bộ câu hỏi Toán lớp ${grade}.` });
    }

    try {
        const user = await User.findOne({ username: sessionUser.username }).select('score isSuspended');
        if (!user || user.isSuspended) {
            return socket.emit('statusUpdate', { message: '❌ Tài khoản không thể tham gia lúc này.' });
        }
        if (user.score < 100) {
            return socket.emit('statusUpdate', { message: '❌ Bạn không đủ 100 điểm để tham gia cược!' });
        }

        const queuedOpponent = mathWaitingPlayers[grade];
        const opponentSession = queuedOpponent?.request?.session?.user;
        if (queuedOpponent && queuedOpponent.connected && opponentSession && queuedOpponent.id !== socket.id) {
            delete mathWaitingPlayers[grade];

            const opponentUser = await User.findOne({
                username: opponentSession.username,
                score: { $gte: 100 },
                isSuspended: false
            }).select('score');

            if (!opponentUser) {
                queuedOpponent.emit('statusUpdate', { message: '❌ Không còn đủ điểm để tham gia trận.' });
                mathWaitingPlayers[grade] = socket;
                return socket.emit('statusUpdate', { message: `🔍 Đang tìm đối thủ lớp ${grade}...` });
            }

            const debitCurrent = await User.updateOne(
                { username: sessionUser.username, score: { $gte: 100 } },
                {
                    $inc: { score: -100 },
                    $push: { history: { activity: `Cược 100đ tham gia Đấu Toán lớp ${grade}`, timestamp: new Date() } }
                }
            );
            if (!debitCurrent.modifiedCount) {
                return socket.emit('statusUpdate', { message: '❌ Số điểm vừa thay đổi, vui lòng thử lại.' });
            }

            const debitOpponent = await User.updateOne(
                { username: opponentSession.username, score: { $gte: 100 } },
                {
                    $inc: { score: -100 },
                    $push: { history: { activity: `Cược 100đ tham gia Đấu Toán lớp ${grade}`, timestamp: new Date() } }
                }
            );
            if (!debitOpponent.modifiedCount) {
                await User.updateOne(
                    { username: sessionUser.username },
                    { $inc: { score: 100 }, $push: { history: { activity: 'Hoàn lại 100đ do đối thủ không đủ điều kiện', timestamp: new Date() } } }
                );
                mathWaitingPlayers[grade] = socket;
                return socket.emit('statusUpdate', { message: `🔍 Đối thủ rời hàng chờ, đang tìm người khác...` });
            }

            const roomId = `math-${queuedOpponent.id}-${socket.id}`;
            socket.join(roomId);
            queuedOpponent.join(roomId);

            gameRooms[roomId] = {
                gameType: 'math',
                players: {
                    [queuedOpponent.id]: { username: opponentSession.username, score: 0, answers: [] },
                    [socket.id]: { username: sessionUser.username, score: 0, answers: [] }
                },
                round: 1,
                maxRounds: 10,
                grade,
                roundResolved: false
            };

            io.to(roomId).emit('matchFound', {
                room: roomId,
                players: gameRooms[roomId].players,
                stake: 100
            });
            sendNextQuestion(roomId);
        } else {
            mathWaitingPlayers[grade] = socket;
            socket.emit('statusUpdate', { message: `🔍 Đang tìm đối thủ lớp ${grade}...` });
        }
    } catch (error) {
        console.error('Lỗi tìm trận Toán:', error);
        socket.emit('statusUpdate', { message: '❌ Không thể tìm trận lúc này.' });
    }
});

function sendNextQuestion(roomId) {
    const room = gameRooms[roomId];
    if (!room || room.gameType !== 'math') return;

    const gradeKey = `grade${room.grade}`;
    const questions = tests.toan?.[gradeKey]?.easy || [];
    if (!questions.length) {
        io.to(roomId).emit('gameError', { message: 'Không có câu hỏi phù hợp.' });
        return handleMathGameOver(roomId, 'question_error');
    }

    const qData = questions[Math.floor(Math.random() * questions.length)];
    room.currentCorrectAnswer = qData.correct;
    room.roundResolved = false;

    io.to(roomId).emit('newQuestion', {
        question: qData.q,
        options: qData.a,
        round: room.round,
        totalRounds: room.maxRounds
    });
}

socket.on('submitAnswer', async (data = {}) => {
    const room = gameRooms[data.room];
    if (!room || room.gameType !== 'math' || room.roundResolved) return;

    const player = room.players[socket.id];
    if (!player) return;

    const alreadyAnswered = player.answers.some(answer => answer.round === room.round);
    if (alreadyAnswered) return;

    const isCorrect = data.answer === room.currentCorrectAnswer;
    player.answers.push({ round: room.round, answer: data.answer, isCorrect });
    if (isCorrect) player.score += 10;

    const allAnswered = Object.values(room.players).every(p =>
        p.answers.some(answer => answer.round === room.round)
    );

    io.to(data.room).emit('answerProgress', {
        answered: Object.values(room.players).filter(p =>
            p.answers.some(answer => answer.round === room.round)
        ).length,
        total: Object.keys(room.players).length
    });

    if (!allAnswered) return;

    room.roundResolved = true;
    io.to(data.room).emit('roundResult', {
        round: room.round,
        correctAnswer: room.currentCorrectAnswer,
        players: room.players
    });

    setTimeout(() => {
        const latestRoom = gameRooms[data.room];
        if (!latestRoom) return;
        if (latestRoom.round < latestRoom.maxRounds) {
            latestRoom.round += 1;
            sendNextQuestion(data.room);
        } else {
            handleMathGameOver(data.room);
        }
    }, 800);
});

async function handleMathGameOver(roomId, reason = 'completed') {
    const room = gameRooms[roomId];
    if (!room || room.gameType !== 'math') return;

    const playerIds = Object.keys(room.players);
    if (playerIds.length < 2) {
        for (const player of Object.values(room.players)) {
            await User.updateOne(
                { username: player.username },
                { $inc: { score: 100 }, $push: { history: { activity: 'Hoàn lại 100đ do trận Toán bị hủy', timestamp: new Date() } } }
            );
        }
        io.to(roomId).emit('gameOver', { players: room.players, reason });
        delete gameRooms[roomId];
        return;
    }

    const p1 = room.players[playerIds[0]];
    const p2 = room.players[playerIds[1]];

    if (p1.score > p2.score) {
        await User.updateOne(
            { username: p1.username },
            { $inc: { score: 200 }, $push: { history: { activity: '🏆 Thắng Đấu Toán: nhận 200đ', timestamp: new Date() } } }
        );
    } else if (p2.score > p1.score) {
        await User.updateOne(
            { username: p2.username },
            { $inc: { score: 200 }, $push: { history: { activity: '🏆 Thắng Đấu Toán: nhận 200đ', timestamp: new Date() } } }
        );
    } else {
        await User.updateMany(
            { username: { $in: [p1.username, p2.username] } },
            { $inc: { score: 50 }, $push: { history: { activity: '🤝 Hòa Đấu Toán: nhận lại 50đ', timestamp: new Date() } } }
        );
    }

    io.to(roomId).emit('gameOver', { players: room.players, reason });
    delete gameRooms[roomId];
}
socket.on('timeoutLoss', async ({ room, loserUsername }) => {
    const roomData = gameRooms[room];
    if (!roomData || !Array.isArray(roomData.players)) return;

    const winnerId = roomData.players.find(id => id !== socket.id);
    const winnerUsername = roomData.playerNames?.[winnerId];
    if (!winnerUsername) return;

    if (room.startsWith('TOUR-')) {
        await recordTournamentWinner(room, winnerUsername);
    }

    io.to(room).emit('gameOver', {
        winner: winnerUsername,
        reason: 'timeout',
        loser: loserUsername
    });
    await User.updateOne(
        { username: winnerUsername },
        {
            $inc: { score: 20 },
            $push: { history: { activity: '🏆 Thắng do đối thủ hết giờ: +20đ', timestamp: new Date() } }
        }
    );
    delete gameRooms[room];
});
    // --- PHÒNG CỜ VUA VÀ CARO: PHÒNG HỢP LỆ + SERVER XÁC THỰC ---
    socket.on('createChessRoom', () => {
        const roomId = Math.random().toString(36).slice(2, 7).toUpperCase();
        gameRooms[roomId] = { createdAt: Date.now(), lastActivityAt: Date.now(), gameType: 'chess', players: [socket.id], playerNames: { [socket.id]: username }, turn: null };
        socket.join(roomId); socket.emit('roomCreated', roomId);
    });
    socket.on('joinChessRoom', async roomId => { await joinTwoPlayerRoom({ socket, rawRoomId: roomId, gameType: 'chess', username, roles: ['w','b'] }); });

    socket.on('createCaroRoom', () => {
        const roomId = Math.random().toString(36).slice(2, 7).toUpperCase();
        gameRooms[roomId] = { createdAt: Date.now(), lastActivityAt: Date.now(), gameType: 'caro', players: [socket.id], playerNames: { [socket.id]: username }, turn: null, size: 20, board: Array.from({ length: 20 }, () => Array(20).fill(null)) };
        socket.join(roomId); socket.emit('roomCreated', roomId);
    });
    socket.on('joinCaroRoom', async roomId => { await joinTwoPlayerRoom({ socket, rawRoomId: roomId, gameType: 'caro', username, roles: ['X','O'] }); });
    socket.on('caroMove', async payload => {
        const roomId = normalizeRoomId(payload?.room);
        const room = gameRooms[roomId];
        const r = Number(payload?.r), c = Number(payload?.c);
        if (!room || room.gameType !== 'caro' || !room.players.includes(socket.id)) return;
        if (room.turn !== socket.id) return socket.emit('notification', '⏳ Chưa đến lượt của bạn.');
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= 20 || c >= 20 || room.board[r][c]) return socket.emit('notification', '❌ Nước đi không hợp lệ.');
        const playerIndex = room.players.indexOf(socket.id); const symbol = playerIndex === 0 ? 'X' : 'O';
        room.board[r][c] = symbol;
        io.to(roomId).emit('caroMoveAccepted', { r, c, symbol, playerId: socket.id });
        if (hasCaroFive(room.board, r, c, symbol)) {
            const winnerName = room.playerNames[socket.id];
            if (room.tournament) await recordTournamentWinner(room.matchId || roomId, winnerName, { source: 'caro-server' });
            await User.updateOne({ username: winnerName }, { $inc: { score: 20 }, $push: { history: { activity: '🏆 Thắng Caro online: +20đ', timestamp: new Date() } } });
            io.to(roomId).emit('caroGameOver', { winnerId: socket.id, winnerName, reason: 'five-in-row' }); delete gameRooms[roomId]; return;
        }
        if (room.board.every(row => row.every(Boolean))) { io.to(roomId).emit('caroGameOver', { winnerId: null, winnerName: null, reason: 'draw' }); delete gameRooms[roomId]; return; }
        room.turn = room.players[playerIndex === 0 ? 1 : 0];
        io.to(roomId).emit('turnUpdate', { nextTurnId: room.turn });
    });
    socket.on('caroWinCustom', () => socket.emit('notification', 'Kết quả Caro được máy chủ tự xác thực.'));
    socket.on('move', data => {
        const roomId = normalizeRoomId(data?.room); const room = gameRooms[roomId];
        if (!room || !room.players.includes(socket.id) || !data?.move) return;
        socket.to(roomId).emit('move', data.move);
    });
    // =========================================================
    // --- LOGIC CỜ VÂY (GO) - MỚI ---
    // =========================================================

    // 1. Tạo phòng Cờ Vây (Lưu kích thước bàn)
    socket.on('createGoRoom', ({ size }) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        gameRooms[roomId] = {
            gameType: 'go',
            players: [socket.id],
            playerNames: { [socket.id]: username },
            turn: null,
            size: parseInt(size) || 13 // Lưu kích thước bàn
        };
        socket.join(roomId);
        socket.emit('goRoomCreated', roomId);
    });

    // 2. Vào phòng Cờ Vây
    socket.on('joinGoRoom', async roomId => { await joinTwoPlayerRoom({ socket, rawRoomId: roomId, gameType: 'go', username, roles: ['b','w'] }); });

    // 3. Xử lý bỏ lượt (Pass)
    socket.on('goPass', ({ room }) => {
        socket.to(room).emit('opponentPassed');
    });

    // (Giữ nguyên logic move cũ)
    socket.on('goMove', (data) => socket.to(data.room).emit('opponentGoMove', data.move));
    // =========================================================
    // --- LOGIC MONOPOLY (CỜ TỶ PHÚ) - HỖ TRỢ 2-8 NGƯỜI ---
    // =========================================================

    // Hàm phụ trợ: Thêm người chơi vào phòng
    // Đưa mảng màu ra ngoài để dùng chung cho toàn server
const MONOPOLY_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];

function addPlayerToMonopolyRoom(roomId, socket, username) {
    const room = monopolyGames[roomId];
    if (!room) return;
    if (room.players.some(player => player.id === socket.id)) {
        socket.emit('errorMsg', 'Bé đã ở trong phòng này rồi!');
        return;
    }
    if (room.players.some(player => player.username.toLowerCase() === String(username).toLowerCase())) {
        socket.emit('errorMsg', 'Tài khoản này đã tham gia phòng ở một thiết bị khác.');
        return;
    }

    // Lấy màu dựa trên số thứ tự người vào (0 đến 7)
    const colorIndex = room.players.length;
    const assignedColor = MONOPOLY_COLORS[colorIndex] || '#ffffff';

    const player = {
        id: socket.id,
        username: username,
        color: assignedColor,
        money: 1500, // Số tiền chuẩn của cờ tỷ phú thường là 1500
        position: 0,
        isHost: socket.id === room.hostId,
        inJail: false
    };

    room.players.push(player);
    socket.join(roomId);

    // Gửi thông tin sảnh chờ về cho cả phòng
    io.to(roomId).emit('lobbyUpdate', {
        roomId: roomId,
        players: room.players,
        hostId: room.hostId
    });
}
    // 1. Tạo phòng riêng
    socket.on('createMonopolyRoom', () => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        monopolyGames[roomId] = {
            id: roomId,
            hostId: socket.id,
            players: [],
            state: 'waiting', // Trạng thái: đang đợi
            gameLogic: null
        };
        addPlayerToMonopolyRoom(roomId, socket, username);
        socket.emit('roomCreated', roomId);
    });

    // 2. Vào phòng bằng mã
    socket.on('joinMonopolyRoom', (rawRoomId) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        const room = monopolyGames[roomId];
        if (room && room.state === 'waiting') {
            if (room.players.length >= 8) {
                socket.emit('errorMsg', '❌ Phòng đã đầy (Tối đa 8 người)!');
            } else {
                addPlayerToMonopolyRoom(roomId, socket, username);
            }
        } else {
            socket.emit('errorMsg', '❌ Phòng không tồn tại hoặc đang chơi!');
        }
    });

    // 3. Ghép ngẫu nhiên (Tìm phòng đang chờ còn trống)
    socket.on('findMonopolyMatch', () => {
        let foundRoom = null;
        for (const [id, room] of Object.entries(monopolyGames)) {
            if (room.state === 'waiting' && room.players.length < 8) {
                foundRoom = id;
                break;
            }
        }

        if (foundRoom) {
            addPlayerToMonopolyRoom(foundRoom, socket, username);
        } else {
            // Không có phòng nào, tạo phòng mới
            const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
            monopolyGames[roomId] = {
                id: roomId,
                hostId: socket.id,
                players: [],
                state: 'waiting',
                gameLogic: null
            };
            addPlayerToMonopolyRoom(roomId, socket, username);
            socket.emit('statusMsg', 'Đã tạo phòng mới, đang đợi người chơi...');
        }
    });

    async function finishMonopolyGame(roomId, requestedWinnerId = null) {
        const room = monopolyGames[roomId];
        if (!room || room.finishing || room.state !== 'playing' || !room.gameLogic) return false;

        const activePlayers = typeof room.gameLogic.getActivePlayers === 'function'
            ? room.gameLogic.getActivePlayers()
            : room.gameLogic.players.filter(player => !player.isBankrupt && player.money > 0);

        if (activePlayers.length !== 1) return false;
        const winner = activePlayers[0];
        if (requestedWinnerId && winner.id !== requestedWinnerId) return false;

        room.finishing = true;
        room.state = 'finished';
        if (room.auctionInterval) clearInterval(room.auctionInterval);

        let newScore = null;
        let newLevel = null;
        try {
            const user = await User.findOne({
                username: { $regex: `^${escapeRegExp(winner.username)}$`, $options: 'i' }
            });
            if (user) {
                ensureUserRuntimeArrays(user);
                user.score = Math.max(0, Number(user.score) || 0) + 200;
                user.monopolyLevel = Math.max(1, Number(user.monopolyLevel) || 1) + 1;
                user.history.push({
                    activity: `Vô địch Cờ Tỷ Phú - Cấp ${user.monopolyLevel}`,
                    timestamp: new Date()
                });
                if (user.history.length > 200) user.history = user.history.slice(-200);
                await user.save();
                newScore = user.score;
                newLevel = user.monopolyLevel;
            }
        } catch (error) {
            console.error('Không thể lưu thưởng Cờ Tỷ Phú:', error);
        }

        io.to(roomId).emit('monopolyGameOver', {
            winner: winner.username,
            reward: newScore === null ? 0 : 200,
            newScore,
            newLevel
        });
        delete monopolyGames[roomId];
        return true;
    }

    // 4. Chủ phòng BẮT ĐẦU GAME
    socket.on('startMonopoly', (roomId) => {
        const room = monopolyGames[String(roomId || '').trim().toUpperCase()];
        if (!room || room.hostId !== socket.id || room.state !== 'waiting') return;
        if (room.players.length < 2) {
            socket.emit('errorMsg', 'Cần ít nhất 2 người để chơi!');
            return;
        }

        room.state = 'playing';
        room.hasRolled = false;
        room.awaitingDecision = null;
        room.gameLogic = new MonopolyGame(room.id);
        room.gameLogic.players = room.players.map(player => ({
            ...player,
            properties: Array.isArray(player.properties) ? player.properties : [],
            isJailed: Boolean(player.isJailed || player.inJail),
            jailTurns: Number(player.jailTurns) || 0,
            isBankrupt: false
        }));
        room.players = room.gameLogic.players;
        room.gameLogic.state = 'playing';

        io.to(room.id).emit('monopolyUpdate', {
            gameState: 'playing',
            players: room.players,
            turnIndex: 0,
            propertyHouses: {},
            logs: ['🏁 Trận đấu bắt đầu!']
        });
        io.to(room.id).emit('turnChanged', { turn: room.players[0].id });
    });

    // 5. Tung xúc xắc: máy chủ kiểm tra đúng lượt và chỉ cho tung một lần.
    socket.on('rollDice', async (rawRoomId) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        const room = monopolyGames[roomId];
        if (!room || room.state !== 'playing' || !room.gameLogic) return;

        const game = room.gameLogic;
        const player = game.getCurrentPlayer();
        if (!player || player.id !== socket.id) {
            socket.emit('errorMsg', 'Chưa đến lượt của bé!');
            return;
        }
        if (player.isBankrupt) {
            socket.emit('errorMsg', 'Bé đã phá sản trong ván này.');
            return;
        }
        if (room.hasRolled || room.awaitingDecision || room.auction) {
            socket.emit('errorMsg', 'Bé đã tung xúc xắc hoặc đang xử lý một hành động khác.');
            return;
        }

        room.hasRolled = true;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        io.to(roomId).emit('diceRolled', { d1, d2 });

        const moveRes = game.movePlayer(d1 + d2);
        room.players = game.players;
        io.to(roomId).emit('monopolyUpdate', {
            players: game.players,
            turnIndex: game.turnIndex,
            propertyHouses: game.propertyHouses,
            logs: [moveRes.message]
        });

        if (await finishMonopolyGame(roomId)) return;

        if (moveRes.action === 'buy') {
            room.awaitingDecision = { type: 'buy', playerId: socket.id, tileId: moveRes.player.position };
            socket.emit('askBuyProperty', moveRes.player.position);
        } else {
            io.to(roomId).emit('enableEndTurn');
        }
    });

    // 6. Xử lý mua đất
    socket.on('buyProperty', ({ roomId: rawRoomId, choice }) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        const room = monopolyGames[roomId];
        if (!room || room.state !== 'playing' || !room.gameLogic) return;

        const game = room.gameLogic;
        const player = game.getCurrentPlayer();
        const decision = room.awaitingDecision;
        if (!player || player.id !== socket.id || !room.hasRolled || decision?.type !== 'buy' || decision.playerId !== socket.id) {
            socket.emit('errorMsg', 'Yêu cầu mua đất không hợp lệ.');
            return;
        }

        if (choice === true) {
            const bought = game.buyProperty(decision.tileId);
            if (!bought) {
                socket.emit('errorMsg', 'Không thể mua ô đất này.');
            } else {
                io.to(roomId).emit('monopolyUpdate', {
                    players: game.players,
                    propertyHouses: game.propertyHouses,
                    logs: [`💰 ${player.username} đã mua ${boardData[decision.tileId].name}!`]
                });
            }
        }
        room.awaitingDecision = null;
        socket.emit('enableEndTurn');
    });

    // 7. Kết thúc lượt
    socket.on('endTurn', (rawRoomId) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        const room = monopolyGames[roomId];
        if (!room || room.state !== 'playing' || !room.gameLogic) return;

        const game = room.gameLogic;
        const currentPlayer = game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== socket.id) {
            socket.emit('errorMsg', 'Chưa đến lượt của bé!');
            return;
        }
        if (!room.hasRolled || room.awaitingDecision || room.auction) {
            socket.emit('errorMsg', 'Bé cần hoàn tất hành động hiện tại trước khi kết thúc lượt.');
            return;
        }

        const nextPlayer = game.nextTurn();
        if (!nextPlayer) return;
        room.hasRolled = false;
        room.awaitingDecision = null;
        io.to(roomId).emit('monopolyUpdate', {
            turnIndex: game.turnIndex,
            players: game.players,
            gameState: 'playing',
            logs: [`👉 Lượt của ${nextPlayer.username}`]
        });
        io.to(roomId).emit('turnChanged', { turn: nextPlayer.id });
    });

    // 8. Client chỉ được yêu cầu xác nhận; máy chủ tự kiểm tra người thắng thật.
    socket.on('monopolyWin', async ({ roomId: rawRoomId, winnerId }) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        if (winnerId !== socket.id || !(await finishMonopolyGame(roomId, socket.id))) {
            socket.emit('errorMsg', 'Chưa đủ điều kiện kết thúc ván đấu.');
        }
    });

    socket.on('buildHouse', ({ roomId: rawRoomId, tileId }) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        const room = monopolyGames[roomId];
        if (!room || room.state !== 'playing' || !room.gameLogic || room.auction) return;

        const game = room.gameLogic;
        const player = game.getCurrentPlayer();
        const safeTileId = clampInteger(tileId, 0, boardData.length - 1, -1);
        if (!player || player.id !== socket.id || safeTileId < 0) {
            socket.emit('errorMsg', 'Yêu cầu xây nhà không hợp lệ.');
            return;
        }

        if (game.buildHouse(safeTileId)) {
            io.to(roomId).emit('monopolyUpdate', {
                players: game.players,
                propertyHouses: game.propertyHouses,
                logs: [`🏗️ ${player.username} đã xây nhà tại ${boardData[safeTileId].name}`]
            });
            socket.emit('buildSuccess', 'Xây nhà thành công!');
        } else {
            socket.emit('errorMsg', 'Bé chưa đủ điều kiện xây nhà ở đây!');
        }
    });

    // --- BỘ MÁY ĐẤU GIÁ ---
    socket.on('startAuction', ({ roomId: rawRoomId, tileId }) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        const room = monopolyGames[roomId];
        if (!room || room.state !== 'playing' || !room.gameLogic || room.auction) return;

        const game = room.gameLogic;
        const player = game.getCurrentPlayer();
        const safeTileId = clampInteger(tileId, 0, boardData.length - 1, -1);
        const tile = boardData[safeTileId];
        const decision = room.awaitingDecision;
        if (!player || player.id !== socket.id || !tile || !['property', 'railroad', 'utility'].includes(tile.type)
            || game.boardState[safeTileId] || decision?.type !== 'buy' || decision.tileId !== safeTileId) {
            socket.emit('errorMsg', 'Không thể mở đấu giá cho ô này.');
            return;
        }

        room.awaitingDecision = null;
        room.auction = {
            tileId: safeTileId,
            highestBid: 10,
            highestBidderId: null,
            highestBidder: null,
            timer: 10
        };
        io.to(roomId).emit('auctionStarted', { tile, auction: room.auction });

        room.auctionInterval = setInterval(() => {
            const liveRoom = monopolyGames[roomId];
            if (!liveRoom?.auction) {
                clearInterval(room.auctionInterval);
                return;
            }
            liveRoom.auction.timer -= 1;
            io.to(roomId).emit('auctionTimer', liveRoom.auction.timer);
            if (liveRoom.auction.timer <= 0) {
                clearInterval(liveRoom.auctionInterval);
                liveRoom.auctionInterval = null;
                endAuction(roomId).catch(error => console.error('Lỗi kết thúc đấu giá:', error));
            }
        }, 1000);
    });

    socket.on('placeBid', ({ roomId: rawRoomId, bidAmount }) => {
        const roomId = String(rawRoomId || '').trim().toUpperCase();
        const room = monopolyGames[roomId];
        if (!room?.auction || room.state !== 'playing' || !room.gameLogic) return;

        const bidder = room.gameLogic.players.find(player => player.id === socket.id && !player.isBankrupt);
        const safeBid = clampInteger(bidAmount, 11, 1000000, 0);
        if (!bidder || safeBid <= room.auction.highestBid || bidder.money < safeBid) {
            socket.emit('errorMsg', 'Mức trả giá không hợp lệ hoặc bé không đủ tiền.');
            return;
        }

        room.auction.highestBid = safeBid;
        room.auction.highestBidderId = bidder.id;
        room.auction.highestBidder = bidder.username;
        room.auction.timer = 6;
        io.to(roomId).emit('auctionUpdate', room.auction);
    });

    async function endAuction(roomId) {
        const room = monopolyGames[roomId];
        if (!room?.auction || !room.gameLogic) return;

        const { tileId, highestBid, highestBidderId, highestBidder } = room.auction;
        const game = room.gameLogic;
        const winner = game.players.find(player => player.id === highestBidderId && !player.isBankrupt);
        const tile = boardData[tileId];

        if (winner && tile && !game.boardState[tileId] && winner.money >= highestBid) {
            winner.money -= highestBid;
            game.boardState[tileId] = winner.id;
            winner.properties = Array.isArray(winner.properties) ? winner.properties : [];
            winner.properties.push(tileId);
            game.log(`🔨 Đấu giá: ${highestBidder} đã mua ${tile.name} với giá $${highestBid}`);
            io.to(roomId).emit('monopolyUpdate', {
                players: game.players,
                propertyHouses: game.propertyHouses,
                logs: game.logs.slice(-3)
            });
        }

        io.to(roomId).emit('auctionEnded');
        delete room.auction;
        room.awaitingDecision = null;
        io.to(roomId).emit('enableEndTurn');
        await finishMonopolyGame(roomId);
    }
    // --- DISCONNECT ---
    socket.on('disconnecting', async () => {
        // Xóa khỏi hàng chờ
        Object.keys(waitingPlayers).forEach(key => {
            if (waitingPlayers[key] === socket) delete waitingPlayers[key];
        });
        Object.keys(mathWaitingPlayers).forEach(key => {
            if (mathWaitingPlayers[key] === socket) delete mathWaitingPlayers[key];
        });
        const idx = monopolyQueue.indexOf(socket.id);
        if(socket.houseRoom) socket.to(socket.houseRoom).emit('playerLeftHouse', socket.id);
        if (idx > -1) monopolyQueue.splice(idx, 1);

        // Xóa khỏi phòng chơi 1vs1 (Caro, Chess...)
        for (const roomId of socket.rooms) {
            if (roomId !== socket.id) {
                const room = gameRooms[roomId];
                if (room) {
                    if (room.gameType === 'math') {
                        const usernames = Object.values(room.players || {}).map(player => player.username);
                        if (usernames.length) {
                            await User.updateMany(
                                { username: { $in: usernames } },
                                {
                                    $inc: { score: 100 },
                                    $push: { history: { activity: 'Hoàn lại 100đ do đối thủ rời trận Đấu Toán', timestamp: new Date() } }
                                }
                            );
                        }
                        io.to(roomId).emit('gameOver', { players: room.players, reason: 'disconnect_refund' });
                    } else if (room.gameType === 'caro') {
                        io.to(roomId).emit('playerLeft', { name: room.playerNames[socket.id] });
                    } else {
                        io.to(roomId).emit('opponentLeft');
                    }
                    delete gameRooms[roomId];
                }
            }
        }

        // Cờ Tỷ Phú: không hủy toàn bộ ván ngay khi một người rời phòng.
        for (const [roomId, room] of Object.entries(monopolyGames)) {
            const pIdx = room.players.findIndex(player => player.id === socket.id);
            if (pIdx === -1) continue;
            if (room.state === 'waiting') {
                room.players.splice(pIdx, 1);
                if (!room.players.length) { delete monopolyGames[roomId]; continue; }
                if (room.hostId === socket.id) room.hostId = room.players[0].id;
                room.players.forEach(player => { player.isHost = player.id === room.hostId; });
                io.to(roomId).emit('lobbyUpdate', { roomId, players: room.players, hostId: room.hostId });
                continue;
            }
            if (room.state === 'playing' && room.gameLogic) {
                const player = room.gameLogic.players.find(item => item.id === socket.id);
                if (player) { player.isBankrupt = true; player.money = 0; room.gameLogic.log(`🚪 ${player.username} đã rời ván và được tính là phá sản.`); }
                if (room.auctionInterval) { clearInterval(room.auctionInterval); room.auctionInterval = null; delete room.auction; }
                room.awaitingDecision = null;
                const current = room.gameLogic.getCurrentPlayer();
                if (current?.id === socket.id) room.gameLogic.nextTurn();
                room.players = room.gameLogic.players;
                io.to(roomId).emit('monopolyUpdate', { players: room.players, turnIndex: room.gameLogic.turnIndex, propertyHouses: room.gameLogic.propertyHouses, logs: room.gameLogic.logs.slice(-3) });
                const next = room.gameLogic.getCurrentPlayer(); if (next) io.to(roomId).emit('turnChanged', { turn: next.id });
                await finishMonopolyGame(roomId);
            }
        }
    });
// =========================================================
    // --- LOGIC OTHELLO (PHỤC KÍCH) - MỚI ---
    // =========================================================

    // 1. Tạo phòng Othello
    socket.on('createOthelloRoom', () => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        gameRooms[roomId] = {
            createdAt: Date.now(), lastActivityAt: Date.now(),
            gameType: 'othello',
            players: [socket.id],
            playerNames: { [socket.id]: username },
            turn: null,
            board: createOthelloBoard()
        };
        socket.join(roomId);
        socket.emit('othelloRoomCreated', roomId);
    });

    // 2. Vào phòng Othello
    socket.on('joinOthelloRoom', async roomId => { await joinTwoPlayerRoom({ socket, rawRoomId: roomId, gameType: 'othello', username, roles: ['b','w'] }); });

    // 3. Máy chủ xác thực nước đi Othello, đổi lượt, bỏ lượt và kết quả.
    socket.on('othelloMove', async payload => {
        const roomId = normalizeRoomId(payload?.room);
        const room = gameRooms[roomId];
        const row = Number(payload?.r), col = Number(payload?.c);
        if (!room || room.gameType !== 'othello' || !room.players.includes(socket.id)) return;
        if (room.players.length !== 2 || room.turn !== socket.id) return socket.emit('notification', '⏳ Chưa đến lượt của bạn.');
        if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) return socket.emit('notification', '❌ Nước đi không hợp lệ.');
        const playerIndex = room.players.indexOf(socket.id);
        const color = playerIndex === 0 ? 1 : 2;
        const flips = getOthelloFlips(room.board, row, col, color);
        if (!flips.length) return socket.emit('notification', '❌ Ô này không tạo được nước lật quân.');
        room.board[row][col] = color;
        for (const [r, c] of flips) room.board[r][c] = color;

        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponentColor = color === 1 ? 2 : 1;
        const opponentHasMove = hasOthelloMove(room.board, opponentColor);
        const currentHasMove = hasOthelloMove(room.board, color);
        if (!opponentHasMove && !currentHasMove) {
            const { black, white } = countOthello(room.board);
            const winnerRole = black === white ? null : (black > white ? 1 : 2);
            const winnerId = winnerRole ? room.players[winnerRole - 1] : null;
            const winnerName = winnerId ? room.playerNames[winnerId] : null;
            if (winnerName && room.tournament) await recordTournamentWinner(room.matchId || roomId, winnerName, { source: 'othello-server' });
            if (winnerName) await User.updateOne(
                { username: winnerName },
                { $inc: { score: 20 }, $push: { history: { activity: '🏆 Thắng Othello online: +20đ', timestamp: new Date() } } }
            );
            io.to(roomId).emit('othelloState', { board: room.board, turnRole: 0, lastMove: { row, col, color } });
            io.to(roomId).emit('othelloGameOver', { winnerRole, winnerName, black, white, draw: !winnerRole });
            delete gameRooms[roomId];
            return;
        }
        if (opponentHasMove) {
            room.turn = room.players[opponentIndex];
            io.to(roomId).emit('othelloState', { board: room.board, turnRole: opponentColor, lastMove: { row, col, color } });
        } else {
            room.turn = socket.id;
            io.to(roomId).emit('othelloState', { board: room.board, turnRole: color, passedRole: opponentColor, lastMove: { row, col, color } });
        }
    });

    socket.on('othelloPass', payload => {
        const roomId = normalizeRoomId(payload?.room);
        const room = gameRooms[roomId];
        if (!room || room.gameType !== 'othello' || room.turn !== socket.id) return;
        const playerIndex = room.players.indexOf(socket.id);
        if (playerIndex < 0) return;
        const color = playerIndex === 0 ? 1 : 2;
        if (hasOthelloMove(room.board, color)) return socket.emit('notification', '❌ Bạn vẫn còn nước đi hợp lệ.');
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        room.turn = room.players[opponentIndex];
        io.to(roomId).emit('othelloState', { board: room.board, turnRole: color === 1 ? 2 : 1, passedRole: color });
    });

    socket.on('reportGameResult', async ({ roomId: rawRoomId, winner }) => {
        const roomId = normalizeRoomId(rawRoomId); const room = gameRooms[roomId];
        if (!room || !room.players.includes(socket.id) || !room.tournament || room.gameType !== 'chess') return;
        const reporter = room.playerNames[socket.id];
        const claimed = normalizeUsername(winner);
        const playerNames = room.expectedPlayers || Object.values(room.playerNames || {});
        if (!reporter || !playerNames.includes(claimed)) return socket.emit('notification', '❌ Kết quả không hợp lệ.');
        room.resultClaims ||= {};
        room.resultClaims[reporter] = claimed;
        room.lastActivityAt = Date.now();
        const claims = playerNames.map(name => room.resultClaims[name]).filter(Boolean);
        if (claims.length < playerNames.length || !claims.every(name => name === claimed)) {
            io.to(roomId).emit('resultPending', { reporter, claimed, confirmations: claims.length, required: playerNames.length });
            return;
        }
        const saved = await recordTournamentWinner(room.matchId || roomId, claimed, { source: `${room.gameType}-consensus` });
        if (!saved) return io.to(roomId).emit('notification', '⚠ Kết quả chưa thể ghi nhận. Quản trị viên sẽ kiểm tra.');
        io.to(roomId).emit('gameOver', { winner: claimed, reason: 'consensus' }); delete gameRooms[roomId];
    });

    // Deactivate retired board games at the socket boundary as well as at the page/router layer.
    for (const eventName of ['createCaroRoom', 'joinCaroRoom', 'caroMove', 'caroWinCustom', 'createGoRoom', 'joinGoRoom', 'goPass', 'goMove', 'createMonopolyRoom', 'joinMonopolyRoom', 'findMonopolyMatch', 'startMonopoly', 'rollDice', 'buyProperty', 'endTurn', 'monopolyWin', 'buildHouse', 'startAuction', 'placeBid', 'createOthelloRoom', 'joinOthelloRoom', 'othelloMove', 'othelloPass']) socket.removeAllListeners(eventName);


});
// Dọn phòng game bị bỏ quên sau khi mất kết nối hoặc dịch vụ chạy lâu.
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of Object.entries(gameRooms)) {
        const lastActivity = Number(room.lastActivityAt || room.createdAt || 0);
        if (lastActivity && now - lastActivity > 6 * 60 * 60 * 1000) delete gameRooms[roomId];
    }
    for (const [gameType, queued] of Object.entries(waitingPlayers)) {
        if (queued?.queuedAt && now - Number(queued.queuedAt) > 10 * 60 * 1000) delete waitingPlayers[gameType];
    }
}, 10 * 60 * 1000);

const tournamentResultLocks = new Set();
// --- CỖ MÁY GIẢI ĐẤU THỐNG NHẤT ---
async function recordTournamentWinner(matchId, winnerUsername, options = {}) {
    if (!matchId || !winnerUsername || tournamentResultLocks.has(matchId)) return false;
    tournamentResultLocks.add(matchId);
    try {
        const tourney = await Tournament.findOne({ gameType: 'chess', status: 'playing', $or: [{ 'brackets.matchId': matchId }, { 'brackets.matches.matchId': matchId }] });
        if (!tourney) return false;
        const match = findTournamentMatch(tourney, matchId);
        if (!match || match.winner || ![match.p1, match.p2].includes(winnerUsername)) return false;
        match.winner = winnerUsername;
        match.loser = winnerUsername === match.p1 ? match.p2 : match.p1;
        match.status = 'finished'; match.finishedAt = new Date(); match.resultSource = options.source || 'game';
        tourney.markModified('brackets'); await tourney.save();
        await advanceTournament(tourney); io.emit('tournamentUpdated');
        return true;
    } finally {
        tournamentResultLocks.delete(matchId);
    }
}
async function tournamentMaintenance() {
    try {
        const now = new Date();
        const openTournaments = await Tournament.find({ gameType: 'chess', status: 'open', registrationDeadline: { $lte: now } }).limit(50);
        for (const open of openTournaments) {
            if ((open.participants || []).length < Number(open.minParticipants || 2)) {
                open.status = 'cancelled'; open.phase = 'completed'; open.finishedAt = now; open.cancelReason = 'Không đủ người tham gia trước hạn';
                await refundTournamentEntries(open, open.cancelReason);
                await open.save();
                io.emit('tournamentUpdated', { tournamentId: String(open._id) });
            } else {
                await startTournament(open);
            }
        }
        const playingTournaments = await Tournament.find({ gameType: 'chess', status: 'playing' }).limit(50);
        for (const tourney of playingTournaments) {
            let changed = false;
            for (const match of tournamentMatches(tourney)) {
                if (match.winner || !match.startTime) continue;
                const start = new Date(match.startTime);
                const elapsed = (now - start) / 60000;
                const checkIns = match.checkIns || {};
                if (elapsed >= -5 && elapsed < 1 && !match.reminderSent) {
                    for (const player of [match.p1, match.p2]) {
                        const id = onlineUsers[player]; if (id) io.to(id).emit('matchNotice', { title: '🔔 Sắp thi đấu', message: `Trận bắt đầu lúc ${start.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}. Mã phòng: ${match.matchId}`, type: 'warning' });
                    }
                    match.reminderSent = true; changed = true;
                }
                if (elapsed > Number(tourney.matchDuration || 20) + 10) {
                    const p1In = Boolean(checkIns[match.p1]), p2In = Boolean(checkIns[match.p2]);
                    if (p1In !== p2In) { match.winner = p1In ? match.p1 : match.p2; match.loser = p1In ? match.p2 : match.p1; match.resultSource = 'forfeit'; }
                    else { match.status = 'review'; match.resultSource = 'timeout-review'; }
                    match.finishedAt = now; if (match.winner) match.status = 'finished'; changed = true;
                }
            }
            if (changed) {
                tourney.markModified('brackets'); await tourney.save();
                if (tournamentMatches(tourney).every(match => match.winner)) await advanceTournament(tourney);
                io.emit('tournamentUpdated', { tournamentId: String(tourney._id) });
            }
        }
    } catch (error) { console.error('Lỗi bảo trì giải đấu:', error); }
}
const tournamentMaintenanceTimer = setInterval(tournamentMaintenance, 60000);
tournamentMaintenanceTimer.unref?.();

// --- BỘ QUÉT NHIỆM VỤ QUÁ HẠN V14 ---
// Truy vấn luôn lấy history, chuẩn hóa dữ liệu cũ, không chạy chồng phiên và
// cô lập lỗi theo từng tài khoản để một bản ghi hỏng không thể làm sập Node.js.
const runQuestExpiryJob = createQuestExpiryJob({ User, io, onlineUsers, logger: console, limit: 250 });
const questExpiryTimer = scheduleQuestExpiryJob(runQuestExpiryJob, 60_000);

app.use('/api', (req, res) => res.status(404).json({ message: 'API không tồn tại.', requestId: req.requestId }));
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const code = String(error?.code || '');
    const aiCodes = ['GEMINI_TIMEOUT', 'GEMINI_NETWORK_ERROR', 'GEMINI_COOLDOWN', 'GEMINI_EMPTY_RESPONSE', 'GEMINI_EMPTY_JSON', 'GEMINI_INVALID_JSON'];
    const aiHttp = /^GEMINI_HTTP_(408|429|500|502|503|504)$/.test(code);
    if (aiHttp || aiCodes.includes(code) || error?.name === 'GeminiServiceError') {
        console.warn(`⚠️ AI service degraded [${req.requestId || 'không-mã'}] ${code}:`, error?.message || 'Gemini unavailable');
        return res.status(503).json({ success: false, code: 'AI_TEMPORARILY_UNAVAILABLE', message: 'AI đang tạm quá tải hoặc kết nối chưa ổn định. Hành Trình Mới vẫn tiếp tục bằng phân tích catalog/rule-based và sẽ tự thử lại khi khả dụng.', retryAfterSeconds: Math.max(30, Math.ceil(Number(error?.retryAfterMs || 60000) / 1000)), requestId: req.requestId });
    }
    console.error(`Lỗi hệ thống [${req.requestId || 'không-mã'}]:`, error?.message || error);
    res.status(500).json({ success: false, message: 'Hệ thống gặp lỗi ngoài dự kiến. Vui lòng thử lại.', requestId: req.requestId });
});

process.on('unhandledRejection', error => {
    console.error('⚠️ Promise bị từ chối chưa xử lý:', error);
});
let shuttingDown = false;
async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`🛑 Nhận ${signal}. Đang đóng kết nối an toàn...`);
    clearTimeout(mongoConnectTimer);
    clearInterval(questExpiryTimer);
    clearInterval(tournamentMaintenanceTimer);
    stopAIGenerationWorker();
    const forceTimer = setTimeout(() => process.exit(1), 12000);
    forceTimer.unref?.();
    server.close(async () => {
        try { await mongoose.disconnect(); } catch (error) { console.error('⚠️ Lỗi đóng MongoDB:', error.message); }
        clearTimeout(forceTimer);
        process.exit(0);
    });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const HOST = '0.0.0.0'; 
startAIGenerationWorker({ models: platformModels });
server.listen(PORT, HOST, () => {
    console.log(`🚀 Server đang chạy!`);
    console.log(`🏠 Local: http://localhost:3000`);
    console.log(`🌐 Render: Cổng ${PORT}`);
});
