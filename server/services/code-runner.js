'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { promisify } = require('util');
const mkdtemp = promisify(fs.mkdtemp);
const rm = promisify(fs.rm);
const chmod = promisify(fs.chmod);

const LIMITS = Object.freeze({ code: 512 * 1024, stdin: 32 * 1024, output: 64 * 1024, timeout: Math.max(1000, Math.min(30000, Number(process.env.CODE_RUNNER_TIMEOUT_MS || 10000))) });
const LANGUAGES = Object.freeze({
    javascript: { file: 'main.js', image: process.env.CODE_EXECUTOR_IMAGE_JAVASCRIPT || 'node:20-alpine', compile: null, run: file => ['node', [file]] },
    python: { file: 'main.py', image: process.env.CODE_EXECUTOR_IMAGE_PYTHON || 'python:3.12-alpine', compile: null, run: file => ['python3', [file]] },
    c: { file: 'main.c', image: process.env.CODE_EXECUTOR_IMAGE_C || 'gcc:14', compile: ['gcc', ['-std=c11', '-O2', '-pipe', 'main.c', '-o', 'main.bin']], run: () => ['./main.bin', []] },
    cpp: { file: 'main.cpp', image: process.env.CODE_EXECUTOR_IMAGE_CPP || 'gcc:14', compile: ['g++', ['-std=c++17', '-O2', '-pipe', 'main.cpp', '-o', 'main.bin']], run: () => ['./main.bin', []] },
    java: { file: 'Main.java', image: process.env.CODE_EXECUTOR_IMAGE_JAVA || 'eclipse-temurin:21-jdk', compile: ['javac', ['-encoding', 'UTF-8', 'Main.java']], run: () => ['java', ['-Dfile.encoding=UTF-8', 'Main']] }
});

function executorMode() { return String(process.env.CODE_RUNNER_EXECUTOR || '').trim().toLowerCase(); }
function enabled() { return String(process.env.CODE_RUNNER_ENABLED || 'false').toLowerCase() === 'true' && ['docker', 'remote', 'judge0'].includes(executorMode()); }
function executorStatus() {
    if (String(process.env.CODE_RUNNER_ENABLED || 'false').toLowerCase() !== 'true') return { enabled: false, executor: executorMode() || 'none', reason: 'CODE_RUNNER_ENABLED=false' };
    if (!['docker', 'remote', 'judge0'].includes(executorMode())) return { enabled: false, executor: 'none', reason: 'Hãy đặt CODE_RUNNER_EXECUTOR=judge0, remote hoặc docker.' };
    if (executorMode() === 'remote' && !/^https?:\/\//i.test(String(process.env.CODE_EXECUTOR_URL || ''))) return { enabled: false, executor: 'remote', reason: 'Thiếu CODE_EXECUTOR_URL của dịch vụ chạy code biệt lập.' };
    if (executorMode() === 'judge0' && !/^https:\/\//i.test(String(process.env.CODE_JUDGE0_URL || 'https://ce.judge0.com'))) return { enabled: false, executor: 'judge0', reason: 'Judge0 endpoint phải dùng HTTPS.' };
    if (executorMode() === 'remote' && String(process.env.CODE_EXECUTOR_TOKEN || '').length < 32) return { enabled: false, executor: 'remote', reason: 'Thiếu CODE_EXECUTOR_TOKEN dài tối thiểu 32 ký tự; executor từ chối request không xác thực.' };
    if (executorMode() === 'docker' && process.platform === 'win32') return { enabled: false, executor: 'docker', reason: 'Docker executor cần máy chủ Linux có Docker Engine; môi trường Windows này không bật trực tiếp.' };
    return { enabled: true, executor: executorMode(), reason: '' };
}
function trimOutput(value, limit = LIMITS.output) { return String(value || '').slice(0, limit); }
function killProcess(child) { try { child.kill('SIGKILL'); } catch (_) {} }
function runCommand(command, args, cwd, stdin, timeoutMs) {
    return new Promise(resolve => {
        const started = Date.now();
        const child = spawn(command, args, { cwd, shell: false, windowsHide: true, env: { PATH: process.env.PATH || '', HOME: '/tmp', TMPDIR: '/tmp', TEMP: '/tmp', TMP: '/tmp', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', timedOut = false, settled = false;
        const finish = result => { if (settled) return; settled = true; resolve({ ...result, stdout: trimOutput(stdout), stderr: trimOutput(stderr), timedOut, runtimeMs: Date.now() - started }); };
        child.stdout.on('data', chunk => { stdout += chunk.toString(); if (stdout.length > LIMITS.output * 2) killProcess(child); });
        child.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > LIMITS.output * 2) killProcess(child); });
        child.stdin.on('error', () => {});
        if (stdin) child.stdin.write(stdin);
        child.stdin.end();
        const timer = setTimeout(() => { timedOut = true; killProcess(child); }, timeoutMs);
        child.on('error', error => { clearTimeout(timer); stderr += error.message; finish({ exitCode: -1 }); });
        child.on('close', code => { clearTimeout(timer); finish({ exitCode: typeof code === 'number' ? code : -1 }); });
    });
}
function dockerArgs(root, image, command, args, stdin) {
    const mount = `type=bind,src=${root},dst=/workspace`;
    const argsOut = ['run', '--rm', '--init', '-i', '--network', 'none', '--memory=128m', '--memory-swap=128m', '--cpus=0.50', '--pids-limit=64', '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=16m', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=65534:65534', '--workdir=/workspace', '--mount', mount, '--env', 'HOME=/tmp', '--env', 'TMPDIR=/tmp', '--env', 'LANG=C.UTF-8', image, command, ...args];
    return { args: argsOut, stdin };
}
async function runDocker(root, spec, command, args, stdin) {
    const prepared = dockerArgs(root, spec.image, command, args, stdin);
    return runCommand(process.env.DOCKER_BIN || 'docker', prepared.args, root, prepared.stdin, LIMITS.timeout);
}
async function runRemote({ language, code, stdin }) {
    const endpoint = String(process.env.CODE_EXECUTOR_URL || '').trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIMITS.timeout + 3000);
    try {
        const headers = { 'content-type': 'application/json', accept: 'application/json' };
        if (process.env.CODE_EXECUTOR_TOKEN) headers.authorization = `Bearer ${process.env.CODE_EXECUTOR_TOKEN}`;
        const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ language, code, stdin, timeoutMs: LIMITS.timeout, limits: { outputBytes: LIMITS.output, memoryMb: 128, cpu: 0.5, network: false } }), signal: controller.signal });
        const raw = await response.text();
        if (Buffer.byteLength(raw, 'utf8') > 256 * 1024) return { status: 'ERROR', message: 'Executor trả response vượt giới hạn.', exitCode: -1, runtimeMs: 0 };
        let data;
        try { data = JSON.parse(raw); } catch (_) { return { status: 'EXECUTOR_ERROR', message: 'Executor trả response không phải JSON hợp lệ.', stderr: trimOutput(raw), exitCode: -1, runtimeMs: 0 }; }
        if (!response.ok) return { status: 'EXECUTOR_ERROR', message: `Executor HTTP ${response.status}.`, stderr: trimOutput(data.stderr || data.message || ''), exitCode: -1, runtimeMs: Number(data.runtimeMs) || 0 };
        const status = ['SUCCESS', 'ERROR', 'TIMEOUT', 'COMPILE_ERROR'].includes(String(data.status || '').toUpperCase()) ? String(data.status).toUpperCase() : 'EXECUTOR_ERROR';
        return { status: status === 'COMPILE_ERROR' ? 'ERROR' : status, stdout: trimOutput(data.stdout), stderr: trimOutput(data.stderr), compileError: trimOutput(data.compileError), exitCode: Number.isFinite(Number(data.exitCode)) ? Number(data.exitCode) : (status === 'SUCCESS' ? 0 : -1), timedOut: Boolean(data.timedOut || status === 'TIMEOUT'), runtimeMs: Math.max(0, Math.min(LIMITS.timeout, Number(data.runtimeMs) || 0)), executor: 'remote' };
    } catch (error) {
        return { status: error.name === 'AbortError' ? 'TIMEOUT' : 'EXECUTOR_UNAVAILABLE', message: error.name === 'AbortError' ? 'Executor hết thời gian chờ.' : `Không kết nối được executor biệt lập: ${error.message}`, exitCode: -1, timedOut: error.name === 'AbortError', runtimeMs: LIMITS.timeout };
    } finally { clearTimeout(timer); }
}

const JUDGE0_LANGUAGE_IDS = Object.freeze({ c: 50, cpp: 54, java: 62, javascript: 63, python: 71 });
function judge0StatusDescription(data) { return String(data?.status?.description || '').toLowerCase(); }
async function runJudge0({ language, code, stdin }) {
    const base = String(process.env.CODE_JUDGE0_URL || 'https://ce.judge0.com').trim().replace(/\/+$/, '');
    const languageId = JUDGE0_LANGUAGE_IDS[language];
    if (!languageId) return { status: 'ERROR', message: 'Ngôn ngữ chưa được ánh xạ sang Judge0.', exitCode: -1, runtimeMs: 0 };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIMITS.timeout + 2500);
    const started = Date.now();
    try {
        const created = await fetch(`${base}/submissions?base64_encoded=false&wait=false`, {
            method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ language_id: languageId, source_code: code, stdin, cpu_time_limit: Math.min(2, LIMITS.timeout / 1000), cpu_extra_time: 0.5, wall_time_limit: Math.min(5, LIMITS.timeout / 1000 + 1), memory_limit: 128000, max_processes_and_or_threads: 30 }), signal: controller.signal
        });
        const createdText = await created.text();
        if (Buffer.byteLength(createdText, 'utf8') > 128 * 1024) return { status: 'EXECUTOR_ERROR', message: 'Judge0 trả phản hồi vượt giới hạn.', exitCode: -1, runtimeMs: Date.now() - started };
        let submission;
        try { submission = JSON.parse(createdText); } catch (_) { return { status: 'EXECUTOR_ERROR', message: `Judge0 trả phản hồi không hợp lệ (HTTP ${created.status}).`, stderr: trimOutput(createdText), exitCode: -1, runtimeMs: Date.now() - started }; }
        if (!created.ok || !submission.token) return { status: 'EXECUTOR_ERROR', message: `Judge0 không nhận bài (HTTP ${created.status}).`, stderr: trimOutput(submission.error || submission.message || ''), exitCode: -1, runtimeMs: Date.now() - started };
        const deadline = Date.now() + LIMITS.timeout;
        let result = null;
        while (Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 400));
            const response = await fetch(`${base}/submissions/${encodeURIComponent(submission.token)}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory,exit_code`, { headers: { accept: 'application/json' }, signal: controller.signal });
            const raw = await response.text();
            if (Buffer.byteLength(raw, 'utf8') > 128 * 1024) return { status: 'EXECUTOR_ERROR', message: 'Judge0 trả kết quả vượt giới hạn.', exitCode: -1, runtimeMs: Date.now() - started };
            try { result = JSON.parse(raw); } catch (_) { return { status: 'EXECUTOR_ERROR', message: `Judge0 trả kết quả không hợp lệ (HTTP ${response.status}).`, exitCode: -1, runtimeMs: Date.now() - started }; }
            if (!response.ok) return { status: 'EXECUTOR_ERROR', message: `Judge0 HTTP ${response.status}.`, stderr: trimOutput(result.error || result.message || ''), exitCode: -1, runtimeMs: Date.now() - started };
            const statusId = Number(result.status?.id);
            if (statusId >= 3) break;
        }
        if (!result || [1, 2].includes(Number(result.status?.id))) return { status: 'TIMEOUT', message: 'Judge0 chưa hoàn tất trong thời gian cho phép. Hãy thử lại sau.', exitCode: -1, timedOut: true, runtimeMs: Date.now() - started, executor: 'judge0' };
        const statusId = Number(result.status?.id);
        const description = judge0StatusDescription(result);
        const timedOut = statusId === 5;
        const compileError = statusId === 6 ? trimOutput(result.compile_output || result.stderr || result.message || 'Biên dịch thất bại.') : '';
        return { status: statusId === 3 ? 'SUCCESS' : timedOut ? 'TIMEOUT' : 'ERROR', stdout: trimOutput(result.stdout), stderr: trimOutput(result.stderr), compileError, message: description, exitCode: Number.isFinite(Number(result.exit_code)) ? Number(result.exit_code) : (statusId === 3 ? 0 : -1), timedOut, runtimeMs: Math.min(LIMITS.timeout, Date.now() - started), executor: 'judge0' };
    } catch (error) {
        return { status: error.name === 'AbortError' ? 'TIMEOUT' : 'EXECUTOR_UNAVAILABLE', message: error.name === 'AbortError' ? 'Hết thời gian chờ Judge0.' : `Không kết nối được Judge0: ${error.message}`, exitCode: -1, timedOut: error.name === 'AbortError', runtimeMs: Date.now() - started, executor: 'judge0' };
    } finally { clearTimeout(timer); }
}

async function executeDocker({ normalized, spec, source, input }) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'htm-code-'));
    try {
        await chmod(root, 0o777);
        fs.writeFileSync(path.join(root, spec.file), source, { encoding: 'utf8', mode: 0o644 });
        let compile = null;
        if (spec.compile) {
            compile = await runDocker(root, spec, spec.compile[0], spec.compile[1], '');
            if (compile.timedOut || compile.exitCode !== 0) return { status: compile.timedOut ? 'TIMEOUT' : 'ERROR', stdout: compile.stdout, stderr: compile.stderr, compileError: compile.stderr || 'Biên dịch thất bại.', exitCode: compile.exitCode, timedOut: compile.timedOut, runtimeMs: compile.runtimeMs, executor: 'docker' };
        }
        const [command, args] = spec.run(path.join('/workspace', spec.file));
        const run = await runDocker(root, spec, command, args || [], input);
        return { status: run.timedOut ? 'TIMEOUT' : run.exitCode === 0 ? 'SUCCESS' : 'ERROR', stdout: run.stdout, stderr: run.stderr, compileError: '', exitCode: run.exitCode, timedOut: run.timedOut, runtimeMs: (compile?.runtimeMs || 0) + run.runtimeMs, executor: 'docker' };
    } finally { await rm(root, { recursive: true, force: true }).catch(() => {}); }
}
async function executeCode({ language, code, stdin = '' } = {}) {
    const normalized = String(language || '').trim().toLowerCase();
    const spec = LANGUAGES[normalized];
    if (!spec) return { status: 'ERROR', error: `Ngôn ngữ chưa được hỗ trợ: ${normalized}.`, exitCode: -1, runtimeMs: 0 };
    const source = String(code || ''); const input = String(stdin || '');
    if (!source.trim()) return { status: 'ERROR', error: 'Code không được để trống.', exitCode: -1, runtimeMs: 0 };
    if (Buffer.byteLength(source, 'utf8') > LIMITS.code) return { status: 'ERROR', error: 'Code vượt quá giới hạn 512 KB.', exitCode: -1, runtimeMs: 0 };
    if (Buffer.byteLength(input, 'utf8') > LIMITS.stdin) return { status: 'ERROR', error: 'Input vượt quá giới hạn 32 KB.', exitCode: -1, runtimeMs: 0 };
    const config = executorStatus();
    if (!config.enabled) return { status: process.env.CODE_RUNNER_ENABLED === 'true' ? 'SANDBOX_REQUIRED' : 'DISABLED', disabled: true, message: `Code Runner chưa sẵn sàng: ${config.reason} Chọn CODE_RUNNER_EXECUTOR=remote với CODE_EXECUTOR_URL của dịch vụ biệt lập, hoặc docker trên máy chủ Linux có Docker Engine.` };
    if (executorMode() === 'remote') return runRemote({ language: normalized, code: source, stdin: input });
    if (executorMode() === 'judge0') return runJudge0({ language: normalized, code: source, stdin: input });
    if (executorMode() === 'docker') {
        if (process.platform === 'win32') return { status: 'SANDBOX_REQUIRED', disabled: true, message: 'Docker executor không chạy trên môi trường Windows host này. Dùng executor remote biệt lập hoặc triển khai Docker trên Linux.' };
        return executeDocker({ normalized, spec, source, input });
    }
    return { status: 'SANDBOX_REQUIRED', disabled: true, message: 'Không có executor biệt lập khả dụng.' };
}
function executionId({ username, language, code, stdin }) { return crypto.createHash('sha256').update(`${username}:${language}:${code}:${stdin}`).digest('hex'); }
module.exports = { executeCode, enabled, executorStatus, executorMode, executionId, LANGUAGES, LIMITS, JUDGE0_LANGUAGE_IDS, runJudge0 };
