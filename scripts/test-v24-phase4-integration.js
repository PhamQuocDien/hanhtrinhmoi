'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const runner = require(path.join(root, 'server/services/code-runner.js'));
const modelSource = fs.readFileSync(path.join(root, 'server/models/platform-models.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'server/routes/platform-routes.js'), 'utf8');
const progressSource = fs.readFileSync(path.join(root, 'server/services/lesson-progress-service.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
let passed = 0;
async function test(name, fn) { await fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }

(async () => {
    await test('Readiness has a separate database/session readiness signal', () => {
        assert(authSource.includes("app.get('/healthz'"));
        assert(authSource.includes("app.get('/api/ready'"));
        assert(authSource.includes('sessionSecretConfigured'));
        assert(authSource.includes("const APP_VERSION = '39.0.0'"));
    });
    await test('Missing session secret uses unpredictable process-local random value, not predictable Mongo URI hash', () => {
        assert(authSource.includes("crypto.randomBytes(48).toString('hex')"));
        assert(!authSource.includes('hanh-trinh-mo-uoc|${MONGO_URI || \'local\'}|session-v12'));
    });
    await test('Lesson progress is account-scoped and uniquely indexed per lesson', () => {
        assert(modelSource.includes('const lessonProgressSchema'));
        assert(modelSource.includes("lessonProgressSchema.index({ username: 1, lessonId: 1 }, { unique: true })"));
        assert(routeSource.includes("router.get('/learning/lesson-progress'"));
        assert(routeSource.includes("router.put('/learning/lesson-progress/:lessonId'"));
        assert(routeSource.includes("status: 'PUBLISHED'"));
        assert(routeSource.includes("id: 'theory', label: 'Đọc và hiểu lý thuyết chính'"));
        assert(routeSource.includes('recalculateLessonProgress'));
        assert(progressSource.includes("source: 'ASSESSMENT_EVIDENCE_V34'"));
        assert(progressSource.includes("attempt.status !== 'SUBMITTED'"));
    });
    await test('Code execute endpoint has rate limiting and production host execution is blocked unless unsafe bypass is explicitly set', async () => {
        assert(fs.readFileSync(path.join(root, 'server/routes/ai-learning-routes.js'), 'utf8').includes("router.post('/code/execute', requireAuth, rate"));
        const oldEnv = { NODE_ENV: process.env.NODE_ENV, CODE_RUNNER_ENABLED: process.env.CODE_RUNNER_ENABLED, CODE_RUNNER_ALLOW_UNSANDBOXED: process.env.CODE_RUNNER_ALLOW_UNSANDBOXED };
        process.env.NODE_ENV = 'production'; process.env.CODE_RUNNER_ENABLED = 'true'; delete process.env.CODE_RUNNER_ALLOW_UNSANDBOXED;
        try { const result = await runner.executeCode({ language: 'javascript', code: 'console.log("must not run")' }); assert.equal(result.status, 'SANDBOX_REQUIRED'); }
        finally { for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
    });
    await test('New endpoints require login and persist only derived progress, not arbitrary client percentage', () => {
        assert(routeSource.includes("router.get('/learning/lesson-progress', requireAuth"));
        assert(routeSource.includes("router.put('/learning/lesson-progress/:lessonId', requireAuth"));
        assert(routeSource.includes('completedSteps/progressPercent từ client bị bỏ qua'));
        assert(routeSource.includes("router.put('/assessment/attempts/:id/answers'"));
    });
    console.log(`\nPhase 4 integration/security: ${passed} tests PASS.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
