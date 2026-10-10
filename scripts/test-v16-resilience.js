'use strict';
const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const file of ['server/services/gemini-service.js', 'server/services/ai-learning-service.js', 'server/routes/ai-learning-routes.js', 'server.js', 'assets/js/ai-learning-hub.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
}
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'primary-model';
process.env.GEMINI_FALLBACK_MODELS = 'fallback-model';
process.env.GEMINI_RETRY_COUNT = '0';
process.env.GEMINI_SMART_MODEL = 'primary-model';
process.env.GEMINI_FAILURE_COOLDOWN_MS = '5000';
const gemini = require(path.join(root, 'server/services/gemini-service.js'));
const originalFetch = global.fetch;
let calls = 0;
global.fetch = async url => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } }), { status: 503, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};
(async () => {
    const result = await gemini.generateText({ prompt: 'Reply exactly OK', maxOutputTokens: 16 });
    assert.strictEqual(result.text, 'OK');
    assert.strictEqual(result.model, 'fallback-model', `Fallback model không được dùng: ${result.model}`);
    assert.strictEqual(result.fallbackUsed, true);
    assert(calls >= 2, 'Gemini chưa thử model dự phòng sau 503.');
    assert.strictEqual(gemini.getGeminiFallbackModels()[0], 'primary-model');
    const repaired = gemini.parseStructuredJson('{\n  "domain": "Giáo dục phổ thông",\n  "confidence": 0.5,');
    assert.strictEqual(repaired.confidence, 0.5);
    assert.strictEqual(repaired.domain, 'Giáo dục phổ thông');
    global.fetch = originalFetch;
    console.log('✅ Runtime V17.0.0: Gemini 503 được retry/fallback, không làm request AI sập.');
})().catch(error => { global.fetch = originalFetch; console.error(error); process.exit(1); });
