'use strict';
const assert = require('node:assert/strict');
const runner = require('../server/services/code-runner');
let passed = 0;
function test(name, fn) { fn(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
(async () => {
    test('Judge0 mode requires explicit enable flag and HTTPS endpoint', () => {
        const old = { enabled: process.env.CODE_RUNNER_ENABLED, executor: process.env.CODE_RUNNER_EXECUTOR, url: process.env.CODE_JUDGE0_URL };
        process.env.CODE_RUNNER_ENABLED = 'true'; process.env.CODE_RUNNER_EXECUTOR = 'judge0'; process.env.CODE_JUDGE0_URL = 'https://ce.judge0.com';
        assert.equal(runner.executorStatus().enabled, true);
        process.env.CODE_JUDGE0_URL = 'http://ce.judge0.com';
        assert.equal(runner.executorStatus().enabled, false);
        for (const [key, value] of Object.entries({ CODE_RUNNER_ENABLED: old.enabled, CODE_RUNNER_EXECUTOR: old.executor, CODE_JUDGE0_URL: old.url })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    });
    test('Supported languages map to Judge0 CE IDs', () => {
        assert.deepEqual(runner.JUDGE0_LANGUAGE_IDS, { c: 50, cpp: 54, java: 62, javascript: 63, python: 71 });
    });
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
        if (String(url).includes('/submissions?')) return new Response(JSON.stringify({ token: 'mock-token' }), { status: 201, headers: { 'content-type': 'application/json' } });
        return new Response(JSON.stringify({ status: { id: 3, description: 'Accepted' }, stdout: '5\n', stderr: null, exit_code: 0, time: '0.01' }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
        const result = await runner.runJudge0({ language: 'cpp', code: '#include <iostream>\nint main(){std::cout << 5;}', stdin: '' });
        assert.equal(result.status, 'SUCCESS');
        assert.equal(result.stdout, '5\n');
        assert.equal(calls.length, 2);
        assert.match(calls[0].url, /^https:\/\/ce\.judge0\.com\/submissions\?/);
        assert.match(calls[1].url, /mock-token/);
        passed += 1; process.stdout.write('PASS Judge0 submission polling returns sandboxed execution result\n');
    } finally { global.fetch = originalFetch; }
    console.log(`\nV33 free Judge0 integration: ${passed} tests PASS.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
