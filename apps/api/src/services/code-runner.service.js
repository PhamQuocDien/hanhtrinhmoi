'use strict';

const LANGUAGE_MATCHERS = {
  cpp: [/^C\+\+ \(GCC 14/i, /^C\+\+ \(Clang 19/i, /^C\+\+ \(/i],
  java: [/^Java \(JDK 17/i, /^Java \(OpenJDK/i, /^Java \(/i],
  csharp: [/^C# \(/i],
  javascript: [/^JavaScript \(Node\.js 22/i, /^JavaScript \(Node\.js 20/i, /^JavaScript \(/i],
  python: [/^Python \(3\.14/i, /^Python \(3\.13/i, /^Python \(3\.12/i, /^Python \(3\.11/i, /^Python \(3\./i],
  sql: [/^SQL \(SQLite/i]
};
const DEFAULT_LANGUAGE_IDS = { cpp: 105, java: 91, csharp: 51, javascript: 102, python: 113, sql: 82 };
let languageCache = { at: 0, items: [] };

function runnerConfig(env = process.env) {
  return {
    enabled: String(env.CODE_RUNNER_ENABLED ?? 'true').toLowerCase() === 'true',
    executor: String(env.CODE_RUNNER_EXECUTOR || 'judge0').toLowerCase(),
    judge0Url: String(env.CODE_JUDGE0_URL || 'https://ce.judge0.com').replace(/\/+$/, ''),
    executorUrl: String(env.CODE_EXECUTOR_URL || '').replace(/\/+$/, ''),
    token: String(env.CODE_EXECUTOR_TOKEN || ''),
    timeoutMs: Math.max(1500, Math.min(15000, Number.parseInt(env.CODE_RUNNER_TIMEOUT_MS, 10) || 10000)),
    cpuTimeSeconds: Math.max(1, Math.min(3, Number.parseInt(env.CODE_RUNNER_CPU_SECONDS, 10) || 2)),
    memoryKb: Math.max(32768, Math.min(256000, Number.parseInt(env.CODE_RUNNER_MEMORY_KB, 10) || 128000))
  };
}
function clampText(value, max) { return String(value ?? '').slice(0, max); }
function decodeMaybeBase64(value) {
  if (!value) return '';
  try { return Buffer.from(value, 'base64').toString('utf8'); } catch (_error) { return String(value); }
}
async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : {}; } catch (_error) { body = { message: text.slice(0, 2000) }; }
    if (!response.ok) {
      const error = new Error(`Trình chạy code trả HTTP ${response.status}.`);
      error.status = response.status;
      error.upstream = body;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Trình chạy code vượt thời gian chờ. Hãy thử lại với code ngắn hơn.');
    throw error;
  } finally { clearTimeout(timer); }
}
async function languageList(config) {
  const now = Date.now();
  if (languageCache.items.length && now - languageCache.at < 5 * 60 * 1000) return languageCache.items;
  const items = await fetchJson(`${config.judge0Url}/languages`, {}, Math.min(config.timeoutMs, 7000));
  if (!Array.isArray(items)) throw new Error('Trình chạy không trả về danh sách ngôn ngữ hợp lệ.');
  languageCache = { at: now, items };
  return items;
}
async function getLanguageId(alias, config) {
  const patterns = LANGUAGE_MATCHERS[alias];
  if (!patterns) throw new Error('Ngôn ngữ chưa được hỗ trợ bởi trình chạy.');
  try {
    const list = await languageList(config);
    for (const pattern of patterns) {
      const found = list.find((item) => pattern.test(String(item.name || '')));
      if (found) return Number(found.id);
    }
  } catch (error) {
    if (!DEFAULT_LANGUAGE_IDS[alias]) throw error;
  }
  return DEFAULT_LANGUAGE_IDS[alias];
}
function decodeResult(result) {
  return {
    status: result?.status?.description || 'Không rõ trạng thái',
    statusId: Number(result?.status?.id || 0),
    stdout: decodeMaybeBase64(result?.stdout),
    stderr: decodeMaybeBase64(result?.stderr),
    compileOutput: decodeMaybeBase64(result?.compile_output),
    message: decodeMaybeBase64(result?.message),
    exitCode: result?.exit_code ?? null,
    time: result?.time ?? null,
    memoryKb: result?.memory ?? null
  };
}
async function runOnJudge0({ language, sourceCode, stdin = '' }, config = runnerConfig()) {
  if (!config.enabled) throw new Error('Trình chạy code đang tắt theo cấu hình.');
  if (config.executor !== 'judge0') throw new Error('CODE_RUNNER_EXECUTOR hiện chỉ hỗ trợ judge0 trong bộ tích hợp này.');
  const languageId = await getLanguageId(language, config);
  const headers = { 'Content-Type': 'application/json' };
  if (config.token && !config.token.startsWith('replace-with-')) headers['X-Auth-Token'] = config.token;
  const submitted = await fetchJson(`${config.judge0Url}/submissions?base64_encoded=true&wait=false`, {
    method: 'POST', headers,
    body: JSON.stringify({
      language_id: languageId,
      source_code: Buffer.from(sourceCode, 'utf8').toString('base64'),
      stdin: Buffer.from(stdin, 'utf8').toString('base64'),
      cpu_time_limit: config.cpuTimeSeconds,
      cpu_extra_time: 0.5,
      wall_time_limit: Math.min(10, Math.max(config.timeoutMs / 1000, config.cpuTimeSeconds + 2)),
      memory_limit: config.memoryKb,
      stack_limit: 64000,
      max_processes_and_or_threads: 20,
      enable_per_process_and_thread_time_limit: true,
      enable_per_process_and_thread_memory_limit: true,
      max_file_size: 1024,
      enable_network: false
    })
  }, Math.min(config.timeoutMs, 8000));
  if (!submitted.token) throw new Error('Trình chạy không tạo được phiên thực thi.');
  const deadline = Date.now() + config.timeoutMs;
  let latest = null;
  const pollHeaders = config.token && !config.token.startsWith('replace-with-') ? { 'X-Auth-Token': config.token } : {};
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    latest = await fetchJson(`${config.judge0Url}/submissions/${encodeURIComponent(submitted.token)}?base64_encoded=true&fields=stdout,stderr,compile_output,message,status,exit_code,time,memory`, { headers: pollHeaders }, Math.min(config.timeoutMs, 5000));
    const statusId = Number(latest?.status?.id || 0);
    if (![1, 2].includes(statusId)) return { ...decodeResult(latest), language, engine: 'Judge0 CE', runId: submitted.token };
  }
  return { status: 'Chưa hoàn tất trong thời gian chờ', statusId: 2, stdout: '', stderr: '', compileOutput: '', message: 'Bài vẫn đang xếp hàng hoặc chạy quá lâu. Hãy chạy lại với code ngắn hơn.', exitCode: null, time: null, memoryKb: null, language, engine: 'Judge0 CE', runId: submitted.token };
}
async function runCode(input, env = process.env) {
  const config = runnerConfig(env);
  if (!config.enabled) throw new Error('Trình chạy code đang tắt theo cấu hình.');
  const language = String(input.language || '').toLowerCase();
  if (!LANGUAGE_MATCHERS[language]) throw new Error('Ngôn ngữ chạy không hợp lệ.');
  const sourceCode = clampText(input.sourceCode, 20000);
  const stdin = clampText(input.stdin, 8000);
  if (!sourceCode.trim()) throw new Error('Hãy nhập mã nguồn trước khi chạy.');
  if (Buffer.byteLength(sourceCode, 'utf8') > 18000) throw new Error('Mã nguồn quá lớn; giới hạn là 18 KB.');
  if (Buffer.byteLength(stdin, 'utf8') > 7000) throw new Error('Dữ liệu đầu vào quá lớn; giới hạn là 7 KB.');
  return runOnJudge0({ language, sourceCode, stdin }, config);
}
function resetLanguageCacheForTests() { languageCache = { at: 0, items: [] }; }
module.exports = { runCode, runOnJudge0, runnerConfig, LANGUAGE_MATCHERS, DEFAULT_LANGUAGE_IDS, resetLanguageCacheForTests, decodeResult };
