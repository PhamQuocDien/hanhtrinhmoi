'use strict';

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const PORT = Math.max(1, Number(process.env.EXECUTOR_PORT || 8090));
const TOKEN = String(process.env.CODE_EXECUTOR_TOKEN || '');
const MAX_BODY = 600 * 1024;
const MAX_CODE = 512 * 1024;
const MAX_STDIN = 32 * 1024;
const MAX_OUTPUT = 64 * 1024;
const MAX_TIMEOUT = Math.max(1000, Math.min(15000, Number(process.env.EXECUTOR_MAX_TIMEOUT_MS || 10000)));
const DOCKER = process.env.DOCKER_BIN || 'docker';
const WORK_ROOT = path.resolve(process.env.EXECUTOR_WORK_ROOT || '/srv/runtime-work');
const HOST_WORK_ROOT_VALUE = String(process.env.EXECUTOR_HOST_WORK_ROOT || '').trim();
if (!HOST_WORK_ROOT_VALUE || !path.isAbsolute(HOST_WORK_ROOT_VALUE) || path.resolve(HOST_WORK_ROOT_VALUE) === path.parse(path.resolve(HOST_WORK_ROOT_VALUE)).root) {
  process.stderr.write('EXECUTOR_HOST_WORK_ROOT must be an absolute, non-root host path shared with this container.\n');
  process.exit(1);
}
const HOST_WORK_ROOT = path.resolve(HOST_WORK_ROOT_VALUE);
fs.mkdirSync(WORK_ROOT, { recursive: true, mode: 0o700 });
const LANGUAGES = Object.freeze({
  cpp: { file: 'main.cpp', image: process.env.EXECUTOR_IMAGE_CPP || 'gcc:14', compile: ['g++', ['-std=c++17', '-O2', '-pipe', 'main.cpp', '-o', 'main.bin']], run: ['./main.bin', []] },
  c: { file: 'main.c', image: process.env.EXECUTOR_IMAGE_C || 'gcc:14', compile: ['gcc', ['-std=c11', '-O2', '-pipe', 'main.c', '-o', 'main.bin']], run: ['./main.bin', []] },
  java: { file: 'Main.java', image: process.env.EXECUTOR_IMAGE_JAVA || 'eclipse-temurin:21-jdk', compile: ['javac', ['-encoding', 'UTF-8', 'Main.java']], run: ['java', ['-Dfile.encoding=UTF-8', 'Main']] },
  python: { file: 'main.py', image: process.env.EXECUTOR_IMAGE_PYTHON || 'python:3.12-alpine', run: ['python3', ['main.py']] },
  javascript: { file: 'main.js', image: process.env.EXECUTOR_IMAGE_JAVASCRIPT || 'node:20-alpine', run: ['node', ['main.js']] }
});

if (TOKEN.length < 32) {
  process.stderr.write('CODE_EXECUTOR_TOKEN is required and must be at least 32 characters.\n');
  process.exit(1);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function send(res, statusCode, body) {
  const text = JSON.stringify(body);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(text);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Request too large'), { statusCode: 413 })); req.destroy(); return; } chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (_) { reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 })); } });
    req.on('error', reject);
  });
}
function trim(value) { return String(value || '').slice(0, MAX_OUTPUT); }
function spawnDocker(args, { cwd, stdin = '', timeoutMs, outputLimit = MAX_OUTPUT, cidFile } = {}) {
  return new Promise(resolve => {
    const started = Date.now(); let stdout = '', stderr = '', done = false, timedOut = false; let timer;
    const finish = result => { if (done) return; done = true; clearTimeout(timer); resolve({ ...result, stdout: trim(stdout), stderr: trim(stderr), timedOut, runtimeMs: Date.now() - started }); };
    const child = spawn(DOCKER, args, { cwd, shell: false, windowsHide: true, env: { PATH: process.env.PATH || '', HOME: '/tmp', TMPDIR: '/tmp', LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
    const add = (key, chunk) => { if (key === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString(); if (stdout.length > outputLimit || stderr.length > outputLimit) { timedOut = false; try { child.kill('SIGKILL'); } catch (_) {} } };
    child.stdout.on('data', chunk => add('stdout', chunk)); child.stderr.on('data', chunk => add('stderr', chunk)); child.stdin.on('error', () => {});
    if (stdin) child.stdin.write(stdin); child.stdin.end();
    timer = setTimeout(() => {
      timedOut = true;
      try {
        if (cidFile && fs.existsSync(cidFile)) {
          const id = fs.readFileSync(cidFile, 'utf8').trim();
          if (/^[a-f0-9]{12,64}$/i.test(id)) { const killer = spawn(DOCKER, ['kill', id], { shell: false, stdio: 'ignore' }); killer.on('error', () => {}); }
        }
      } catch (_) {}
      try { child.kill('SIGKILL'); } catch (_) {}
    }, timeoutMs);
    child.on('error', error => finish({ exitCode: -1, stderr: `${stderr}\n${error.message}` }));
    child.on('close', code => finish({ exitCode: typeof code === 'number' ? code : -1 }));
  });
}
function dockerArgs({ directory, cidFile, image, command, args, interactive = true }) {
  const hostDirectory = path.join(HOST_WORK_ROOT, path.basename(directory));
  return ['run', '--rm', '--init', ...(interactive ? ['-i'] : []), '--cidfile', cidFile, '--network', 'none', '--memory=128m', '--memory-swap=128m', '--cpus=0.50', '--pids-limit=64', '--ulimit', 'nofile=128:128', '--ulimit', 'fsize=10485760:10485760', '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=16m', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=65534:65534', '--workdir=/workspace', '--mount', `type=bind,src=${hostDirectory},dst=/workspace,rw`, '--env', 'HOME=/tmp', '--env', 'TMPDIR=/tmp', '--env', 'LANG=C.UTF-8', image, command, ...args];
}
async function runPhase({ directory, spec, phase, stdin, timeoutMs }) {
  const cidFile = path.join(directory, `.cid-${crypto.randomBytes(6).toString('hex')}`);
  const [command, args] = phase;
  try { return await spawnDocker(dockerArgs({ directory, cidFile, image: spec.image, command, args, interactive: true }), { cwd: directory, stdin, timeoutMs, cidFile }); }
  finally { try { fs.rmSync(cidFile, { force: true }); } catch (_) {} }
}
async function execute(payload) {
  const language = String(payload.language || '').toLowerCase().trim();
  const code = String(payload.code || ''); const stdin = String(payload.stdin || ''); const spec = LANGUAGES[language];
  if (!spec) return { status: 'ERROR', message: `Language not allowed: ${language || '(empty)'}`, exitCode: -1, runtimeMs: 0 };
  if (!code.trim()) return { status: 'ERROR', message: 'Code is empty.', exitCode: -1, runtimeMs: 0 };
  if (Buffer.byteLength(code) > MAX_CODE || Buffer.byteLength(stdin) > MAX_STDIN) return { status: 'ERROR', message: 'Code or stdin exceeds size limit.', exitCode: -1, runtimeMs: 0 };
  const timeoutMs = Math.max(1000, Math.min(MAX_TIMEOUT, Number(payload.timeoutMs) || MAX_TIMEOUT));
  const directory = fs.mkdtempSync(path.join(WORK_ROOT, 'htm-exec-'));
  let runtimeMs = 0;
  try {
    fs.chmodSync(directory, 0o777);
    fs.writeFileSync(path.join(directory, spec.file), code, { mode: 0o644 });
    if (spec.compile) {
      const compile = await runPhase({ directory, spec, phase: spec.compile, stdin: '', timeoutMs }); runtimeMs += compile.runtimeMs;
      if (compile.timedOut) return { status: 'TIMEOUT', compileError: compile.stderr || 'Compilation timeout.', stdout: compile.stdout, stderr: compile.stderr, exitCode: compile.exitCode, timedOut: true, runtimeMs };
      if (compile.exitCode !== 0) return { status: 'COMPILE_ERROR', compileError: compile.stderr || compile.stdout || 'Compilation failed.', stdout: compile.stdout, stderr: compile.stderr, exitCode: compile.exitCode, runtimeMs };
    }
    const run = await runPhase({ directory, spec, phase: spec.run, stdin, timeoutMs }); runtimeMs += run.runtimeMs;
    if (run.timedOut) return { status: 'TIMEOUT', stdout: run.stdout, stderr: run.stderr, exitCode: run.exitCode, timedOut: true, runtimeMs };
    return { status: run.exitCode === 0 ? 'SUCCESS' : 'ERROR', stdout: run.stdout, stderr: run.stderr, exitCode: run.exitCode, runtimeMs };
  } catch (error) {
    return { status: 'EXECUTOR_ERROR', message: 'Executor could not launch isolated runtime.', stderr: trim(error.message), exitCode: -1, runtimeMs };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const docker = await spawnDocker(['info', '--format', '{{.ServerVersion}}'], { timeoutMs: 1200, outputLimit: 1024 });
    const dockerReady = docker.exitCode === 0 && Boolean(docker.stdout.trim());
    return send(res, dockerReady ? 200 : 503, { ok: dockerReady, service: 'hanhtrinhmoi-code-executor', isolated: dockerReady, dockerReady, ...(dockerReady ? { dockerVersion: docker.stdout.trim().slice(0, 80) } : { message: 'Docker Engine không phản hồi. Kiểm tra Docker daemon và quyền socket.' }) });
  }
  if (req.method !== 'POST' || req.url !== '/execute') return send(res, 404, { status: 'ERROR', message: 'Not found.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(token, TOKEN)) return send(res, 401, { status: 'ERROR', message: 'Unauthorized.' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return send(res, 415, { status: 'ERROR', message: 'application/json required.' });
  try { const payload = await readBody(req); const result = await execute(payload); return send(res, 200, result); }
  catch (error) { return send(res, error.statusCode || 500, { status: 'EXECUTOR_ERROR', message: error.statusCode === 413 ? 'Request too large.' : error.statusCode === 400 ? 'Invalid JSON.' : 'Executor request failed.' }); }
});
server.headersTimeout = 10000;
server.requestTimeout = 20000;
server.listen(PORT, '0.0.0.0', () => process.stdout.write(`Isolated code executor listening on ${PORT}\n`));
