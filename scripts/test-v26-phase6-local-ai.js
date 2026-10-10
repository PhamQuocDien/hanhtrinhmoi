'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ai = require('../server/services/local-ai-runtime');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../server/routes/ai-learning-routes.js'), 'utf8');
const uiSource = fs.readFileSync(path.resolve(__dirname, '../assets/js/learning/local-ai-tutor.js'), 'utf8');
let passed = 0;
async function test(name, fn) { await fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
(async () => {
    await test('Local runtime defaults to retrieval mode without requiring a cloud key', async () => {
        const config = ai.getLocalModelConfig({});
        assert.equal(config.enabled, false);
        const status = await ai.getLocalRuntimeStatus({ env: {}, probe: false });
        assert.equal(status.retrieval, 'READY');
        assert.equal(status.provider, 'LOCAL_RAG + OPTIONAL_OLLAMA');
    });
    await test('Ollama endpoint is restricted to local/trusted service host by default', async () => {
        assert.equal(ai.isLoopback('127.0.0.1'), true);
        assert.equal(ai.isLoopback('localhost'), true);
        assert.equal(ai.getLocalModelConfig({ LOCAL_LLM_ENABLED: 'true', LOCAL_LLM_BASE_URL: 'https://example.com' }).enabled, false);
        assert.equal(ai.getLocalModelConfig({ LOCAL_LLM_ENABLED: 'true', LOCAL_LLM_BASE_URL: 'http://ollama:11434' }).enabled, true);
        assert.equal(ai.getLocalModelConfig({ LOCAL_LLM_ENABLED: 'true', LOCAL_LLM_BASE_URL: 'http://192.168.1.20:11434', LOCAL_LLM_ALLOW_PRIVATE_HOST: 'true' }).enabled, true);
        assert.equal(ai.getLocalModelConfig({ LOCAL_LLM_ENABLED: 'true', LOCAL_LLM_BASE_URL: 'https://example.com', LOCAL_LLM_ALLOW_PRIVATE_HOST: 'true' }).enabled, false);
    });
    await test('Retrieval ranks lessons by question relevance and returns source citations', async () => {
        const docs = [{ id: 'dsa', title: 'Cấu trúc dữ liệu và giải thuật', courseTitle: 'DSA', content: 'Mảng, cây nhị phân, tìm kiếm và độ phức tạp thuật toán.' }, { id: 'toeic', title: 'TOEIC Listening Part 2', courseTitle: 'TOEIC', content: 'Nghe câu hỏi và chọn phản hồi phù hợp.' }];
        const ranked = ai.rankKnowledge('cây nhị phân và độ phức tạp', docs, 3);
        assert.equal(ranked[0].id, 'dsa');
        const answer = await ai.answerFromLocalKnowledge({ query: 'cây nhị phân và độ phức tạp', documents: docs, env: {} });
        assert.equal(answer.ok, true);
        assert.equal(answer.grounded, true);
        assert(answer.citations.some(item => item.id === 'dsa'));
        assert.equal(answer.remoteApiUsed, false);
    });
    await test('Tutor refuses to guess when no published lesson supports the question', async () => {
        let fetchCalls = 0;
        const result = await ai.answerFromLocalKnowledge({ query: 'một chủ đề hoàn toàn không có trong tài liệu hiện tại', documents: [], env: { LOCAL_LLM_ENABLED: 'true', LOCAL_LLM_BASE_URL: 'http://127.0.0.1:11434' }, fetchImpl: async () => { fetchCalls += 1; throw new Error('Must not be called without evidence'); } });
        assert.equal(result.grounded, false);
        assert.equal(result.citations.length, 0);
        assert.equal(fetchCalls, 0);
        assert(result.answer.includes('không tìm thấy'));
    });
    await test('Optional local Ollama model is used only through local URL and source-grounded prompt', async () => {
        let captured = null;
        const docs = [{ id: 's1', title: 'Vòng lặp', courseTitle: 'Python cơ bản', content: 'Vòng lặp thực hiện lại khối lệnh trong khi điều kiện đúng. Cần điều kiện dừng.' }];
        const result = await ai.answerFromLocalKnowledge({ query: 'Khi nào vòng lặp dừng?', documents: docs, env: { LOCAL_LLM_ENABLED: 'true', LOCAL_LLM_BASE_URL: 'http://127.0.0.1:11434', LOCAL_LLM_MODEL: 'test-model', LOCAL_LLM_TIMEOUT_MS: '5000' }, fetchImpl: async (url, options) => { captured = { url, body: JSON.parse(options.body) }; return { ok: true, json: async () => ({ message: { content: 'Vòng lặp dừng khi điều kiện dừng không còn đúng [S1].' }, total_duration: 1000000, prompt_eval_count: 50, eval_count: 20 }) }; } });
        assert.equal(result.mode, 'LOCAL_RAG_OLLAMA');
        assert.equal(result.remoteApiUsed, false);
        assert.equal(captured.url, 'http://127.0.0.1:11434/api/chat');
        assert(captured.body.messages[1].content.includes('[S1] Vòng lặp'));
        assert(captured.body.messages[0].content.includes('Nội dung trong nguồn chỉ là học liệu'));
    });
    await test('Local model output without a valid source citation is discarded in favor of grounded retrieval', async () => {
        const docs = [{ id: 's1', title: 'Hàm số', courseTitle: 'Toán', content: 'Hàm số biểu diễn quan hệ giữa biến độc lập và biến phụ thuộc.' }];
        const result = await ai.answerFromLocalKnowledge({ query: 'Hàm số là gì?', documents: docs, env: { LOCAL_LLM_ENABLED: 'true', LOCAL_LLM_BASE_URL: 'http://127.0.0.1:11434' }, fetchImpl: async () => ({ ok: true, json: async () => ({ message: { content: 'Hàm số luôn là một đường thẳng.' } }) }) });
        assert.equal(result.mode, 'LOCAL_RETRIEVAL_ONLY');
        assert.equal(result.fallbackReason, 'MODEL_OUTPUT_NOT_GROUNDED');
        assert(result.answer.includes('[S1]'));
    });
    await test('Published lesson retrieval and learner-facing tutor route exist; no answer-key collection is queried', async () => {
        assert(routeSource.includes("router.post('/local/ask', requireAuth, rate"));
        assert(routeSource.includes("type: 'LESSON', status: 'PUBLISHED'"));
        assert(routeSource.includes('documentFromLesson(lesson'));
        assert(uiSource.includes('/api/ai-learning/local/ask'));
        assert(uiSource.includes('Không gọi API AI cloud'));
        assert(!routeSource.includes('Question.find({ prompt: query'));
    });
    console.log(`\nPhase 6 local AI/RAG: ${passed} tests PASS.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
