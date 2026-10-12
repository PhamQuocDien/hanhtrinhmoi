'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runnerConfig, decodeResult, runCode, DEFAULT_LANGUAGE_IDS } = require('../src/services/code-runner.service');

test('runner config keeps sandbox limits within bounded ranges', () => {
  const config = runnerConfig({ CODE_RUNNER_ENABLED: 'true', CODE_RUNNER_EXECUTOR: 'judge0', CODE_JUDGE0_URL: 'https://ce.judge0.com/', CODE_RUNNER_TIMEOUT_MS: '999999', CODE_RUNNER_CPU_SECONDS: '90', CODE_RUNNER_MEMORY_KB: '999999' });
  assert.equal(config.judge0Url, 'https://ce.judge0.com');
  assert.equal(config.timeoutMs, 15000);
  assert.equal(config.cpuTimeSeconds, 3);
  assert.equal(config.memoryKb, 256000);
  assert.equal(config.enabled, true);
});

test('supported console languages have fallback mappings', () => {
  for (const language of ['cpp','java','csharp','javascript','python','sql']) assert.ok(DEFAULT_LANGUAGE_IDS[language] > 0);
});

test('execution output base64 is decoded into plain text', () => {
  const row = decodeResult({ stdout: Buffer.from('hello\n', 'utf8').toString('base64'), stderr: '', compile_output: Buffer.from('warning', 'utf8').toString('base64'), status: { id: 3, description: 'Accepted' }, time: '0.01', memory: 1000 });
  assert.equal(row.stdout, 'hello\n');
  assert.equal(row.compileOutput, 'warning');
  assert.equal(row.status, 'Accepted');
  assert.equal(row.statusId, 3);
});

test('code runner rejects unsupported languages and oversized data before contacting a remote executor', async () => {
  await assert.rejects(runCode({ language: 'bash', sourceCode: 'echo hi' }, { CODE_RUNNER_ENABLED: 'true' }), /không hợp lệ/i);
  await assert.rejects(runCode({ language: 'python', sourceCode: 'x'.repeat(19000) }, { CODE_RUNNER_ENABLED: 'true' }), /quá lớn/i);
  await assert.rejects(runCode({ language: 'python', sourceCode: 'print(1)' }, { CODE_RUNNER_ENABLED: 'false' }), /đang tắt/i);
});
