'use strict';

const crypto = require('crypto');
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const SMART_MODEL = process.env.GEMINI_SMART_MODEL || 'gemini-3.1-pro-preview';
const DEFAULT_FALLBACK_MODELS = ['gemini-3.1-pro-preview','gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite'];
const ROUTINE_FALLBACK_MODELS = ['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-flash-lite'];
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TRANSIENT_STATUSES = new Set([408,425,500,502,503,504]);
const MAX_RETRIES_PER_MODEL = Math.max(0, Math.min(2, Number(process.env.GEMINI_RETRY_COUNT || 1)));
const RETRY_BASE_MS = Math.max(1000, Math.min(15000, Number(process.env.GEMINI_RETRY_BASE_MS || 6000)));
const REQUEST_TIMEOUT_MS = Math.max(30000, Math.min(900000, Number(process.env.GEMINI_TIMEOUT_MS || 420000)));
const FAILURE_COOLDOWN_MS = Math.max(30000, Math.min(1200000, Number(process.env.GEMINI_FAILURE_COOLDOWN_MS || 180000)));
const QUOTA_COOLDOWN_MS = Math.max(60000, Math.min(7200000, Number(process.env.GEMINI_QUOTA_COOLDOWN_MS || 600000)));
const DAILY_QUOTA_COOLDOWN_MS = Math.max(3600000, Math.min(86400000, Number(process.env.GEMINI_DAILY_QUOTA_COOLDOWN_MS || 86400000)));
const MAX_FALLBACK_MODELS = Math.max(2, Math.min(10, Number(process.env.GEMINI_MAX_FALLBACK_MODELS || 8)));
const PROFILE_RETRY_LIMITS = Object.freeze({ course: Math.min(2, Math.max(0, Number(process.env.GEMINI_COURSE_RETRY_COUNT || 2))), smart: Math.min(2, Math.max(0, Number(process.env.GEMINI_SMART_RETRY_COUNT || 2))), assessment: Math.min(2, Math.max(0, Number(process.env.GEMINI_ASSESSMENT_RETRY_COUNT || 2))), audio: Math.min(2, Math.max(0, Number(process.env.GEMINI_AUDIO_RETRY_COUNT || 1))), routine: Math.min(1, Math.max(0, Number(process.env.GEMINI_ROUTINE_RETRY_COUNT || 0))) });
const PROFILE_TIMEOUTS = Object.freeze({ course: Math.max(60000, Math.min(900000, Number(process.env.GEMINI_COURSE_TIMEOUT_MS || 600000))), smart: Math.max(60000, Math.min(900000, Number(process.env.GEMINI_SMART_TIMEOUT_MS || 600000))), assessment: Math.max(60000, Math.min(900000, Number(process.env.GEMINI_ASSESSMENT_TIMEOUT_MS || 480000))), audio: Math.max(60000, Math.min(900000, Number(process.env.GEMINI_AUDIO_TIMEOUT_MS || 300000))), routine: Math.max(30000, Math.min(300000, Number(process.env.GEMINI_ROUTINE_TIMEOUT_MS || 120000))) });
const MODEL_COOLDOWN = new Map();
const INFLIGHT = new Map();
let requestTail = Promise.resolve();
let lastFallbackLogAt = 0;
let lastRequestFinishedAt = 0;
const MIN_REQUEST_GAP_MS = Math.max(1000, Math.min(60000, Number(process.env.GEMINI_MIN_REQUEST_GAP_MS || 4000)));

function getGeminiApiKey() { return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim(); }
function getAiMode() { const mode = String(process.env.AI_MODE || 'SMART').trim().toUpperCase(); return new Set(['SMART','HYBRID','REMOTE','OFF']).has(mode) ? mode : 'SMART'; }
function isRemoteAiAllowed() { const mode = getAiMode(); return mode === 'HYBRID' || mode === 'REMOTE'; }
function getGeminiModel() { return String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL; }
function getGeminiFallbackModels(profile = 'routine') {
    const configured = String(process.env.GEMINI_FALLBACK_MODELS || '').split(',').map(item => item.trim()).filter(Boolean);
    const premium = profile === 'smart' || profile === 'course' || profile === 'assessment';
    const defaultList = premium ? [SMART_MODEL, ...DEFAULT_FALLBACK_MODELS] : [getGeminiModel(), ...ROUTINE_FALLBACK_MODELS];
    const primary = premium ? SMART_MODEL : getGeminiModel();
    return [...new Set([primary, ...configured, ...defaultList, getGeminiModel()])].slice(0, MAX_FALLBACK_MODELS);
}
function isGeminiConfigured() { return Boolean(getGeminiApiKey()); }
function hashText(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function runExclusive(task) {
    const previous = requestTail;
    let release;
    requestTail = new Promise(resolve => { release = resolve; });
    return previous.then(async () => {
        const wait = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastRequestFinishedAt));
        if (wait) await sleep(wait);
        try { return await task(); } finally { lastRequestFinishedAt = Date.now(); }
    }).finally(() => release());
}
function profileList(profile, primary) {
    const configured = getGeminiFallbackModels(profile);
    if (primary) return [...new Set([primary, ...configured])].slice(0, MAX_FALLBACK_MODELS);
    return configured;
}
function errorReason(payload) {
    const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
    return String(payload?.error?.status || details.map(item => item?.reason || item?.status || '').find(Boolean) || '').toUpperCase();
}
function quotaMessage(status, payload) { return `${errorReason(payload)} ${String(payload?.error?.message || '')}`; }
function isDailyQuotaError(status, payload) {
    const message = quotaMessage(status, payload);
    return (Number(status) === 429 || /RESOURCE_EXHAUSTED|QUOTA_EXCEEDED|FREE_TIER|CURRENT_QUOTA/i.test(message)) && /(per day|daily|requests?\s*\/\s*day|limit:\s*0|free tier.*0|quota.*exhausted|per_day|daily_limit)/i.test(message);
}
function isQuotaError(status, payload) {
    const message = quotaMessage(status, payload);
    return Number(status) === 429 || /RESOURCE_EXHAUSTED|QUOTA_EXCEEDED|RATE_LIMIT|FREE_TIER|CURRENT_QUOTA/i.test(message);
}
function isRetryableStatus(status, payload) {
    if (isQuotaError(status, payload)) return true;
    if (TRANSIENT_STATUSES.has(Number(status))) return true;
    if (Number(status) === 429) return true;
    return false;
}
function parseRetryAfterMessage(payload) {
    const message = String(payload?.error?.message || '');
    const seconds = message.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
    return seconds ? Math.min(3600000, Math.ceil(Number(seconds[1]) * 1000)) : 0;
}
function retryAfterMs(response, payload) {
    const header = Number(response?.headers?.get?.('retry-after'));
    if (Number.isFinite(header) && header >= 0) return Math.min(3600000, header * 1000);
    return parseRetryAfterMessage(payload);
}
function apiError(response, payload) {
    const message = payload?.error?.message || `Gemini API trả HTTP ${response.status}.`;
    const error = new Error(message);
    error.code = `GEMINI_HTTP_${response.status}`;
    error.status = response.status;
    error.reason = errorReason(payload);
    error.quota = isQuotaError(response.status, payload);
    error.dailyQuota = isDailyQuotaError(response.status, payload);
    error.retryable = isRetryableStatus(response.status, payload);
    error.retryAfterMs = retryAfterMs(response, payload);
    return error;
}
function retryDelay(attempt, retryAfter = 0) {
    if (retryAfter > 0) return retryAfter;
    const exponential = RETRY_BASE_MS * (2 ** attempt);
    const jitter = Math.round(Math.random() * Math.min(1200, RETRY_BASE_MS));
    return Math.min(45000, exponential + jitter);
}
function modelCooldownMs(error) {
    if (error?.dailyQuota) return DAILY_QUOTA_COOLDOWN_MS;
    if (error?.retryAfterMs) return Math.max(Number(error.retryAfterMs), error?.quota ? QUOTA_COOLDOWN_MS : FAILURE_COOLDOWN_MS);
    return error?.quota ? QUOTA_COOLDOWN_MS : FAILURE_COOLDOWN_MS;
}
function noteModelCooldown(model, error) {
    if (!model || !error) return;
    MODEL_COOLDOWN.set(model, Date.now() + modelCooldownMs(error));
}
function isModelCooling(model) {
    const until = MODEL_COOLDOWN.get(model) || 0;
    if (until <= Date.now()) { MODEL_COOLDOWN.delete(model); return false; }
    return true;
}
function fallbackLog(primary, actual, error) {
    if (primary === actual || Date.now() - lastFallbackLogAt < 10000) return;
    lastFallbackLogAt = Date.now();
    console.warn(`⚠️ Gemini fallback: ${primary} → ${actual}. ${error?.message || 'Mô hình trước đó không khả dụng.'}`);
}
function cooldownError(models) {
    const waits = models.map(model => MODEL_COOLDOWN.get(model) || 0).filter(Boolean);
    const retryAfterMs = waits.length ? Math.max(1000, Math.min(...waits) - Date.now()) : QUOTA_COOLDOWN_MS;
    const error = new Error('Gemini đang bận hoặc hết quota. Hành Trình Mới đã chuyển sang mô hình dự phòng và sẽ tự thử lại.');
    error.code = 'GEMINI_COOLDOWN'; error.status = 503; error.retryable = true; error.retryAfterMs = retryAfterMs; error.fallbackAttempted = models;
    return error;
}
async function fetchJsonOnce(url, body, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getGeminiApiKey() }, body: JSON.stringify(body), signal: controller.signal });
    } catch (error) {
        const timeoutError = error?.name === 'AbortError' ? new Error(`Gemini request timeout sau ${Math.round(timeoutMs / 1000)} giây.`) : error;
        timeoutError.code = error?.name === 'AbortError' ? 'GEMINI_TIMEOUT' : 'GEMINI_NETWORK_ERROR';
        timeoutError.status = 503; timeoutError.retryable = true;
        throw timeoutError;
    } finally { clearTimeout(timer); }
}
async function requestJson(model, body, operation = 'generateContent', options = {}) {
    const key = getGeminiApiKey();
    if (!key) { const error = new Error('GEMINI_API_KEY is not configured.'); error.code = 'AI_NOT_CONFIGURED'; throw error; }
    const profile = options.profile || 'routine';
    const excludedModels = new Set(Array.isArray(options.excludeModels) ? options.excludeModels : []);
    const models = profileList(profile, model).filter(candidate => !excludedModels.has(candidate));
    const inflightKey = options.dedupeKey || hashText(`${operation}:${JSON.stringify(body).slice(0, 30000)}:${models.join(',')}`);
    if (INFLIGHT.has(inflightKey)) return INFLIGHT.get(inflightKey);
    const task = runExclusive(async () => {
        const available = models.filter(candidate => !isModelCooling(candidate));
        const candidates = available.length ? available : models;
        if (!available.length && models.length) throw cooldownError(models);
        let lastError = null; const attemptedModels = []; const retryLimit = Math.min(MAX_RETRIES_PER_MODEL, Math.max(0, Number(PROFILE_RETRY_LIMITS[profile] ?? MAX_RETRIES_PER_MODEL)));
        for (const candidate of candidates) {
            attemptedModels.push(candidate);
            for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
                try {
                    const response = await fetchJsonOnce(`${API_BASE}/models/${encodeURIComponent(candidate)}:${operation}`, body, Number(options.timeoutMs || PROFILE_TIMEOUTS[profile] || REQUEST_TIMEOUT_MS));
                    const payload = await response.json().catch(() => ({}));
                    if (response.ok) {
                        MODEL_COOLDOWN.delete(candidate);
                        const fallbackUsed = candidate !== models[0];
                        if (fallbackUsed) fallbackLog(models[0], candidate, lastError);
                        return { payload, model: candidate, fallbackUsed, attemptedModels: attemptedModels.slice() };
                    }
                    const error = apiError(response, payload); lastError = error;
                    if (error.quota) noteModelCooldown(candidate, error);
                    if (error.quota || !error.retryable || attempt >= retryLimit) break;
                    const delay = retryDelay(attempt, error.retryAfterMs);
                    await sleep(delay);
                } catch (error) {
                    lastError = error;
                    if (error?.quota) break;
                    if (error?.retryable && attempt < retryLimit) await sleep(retryDelay(attempt, error.retryAfterMs));
                    else break;
                }
            }
            if (lastError?.dailyQuota) break;
            if (lastError?.quota) continue;
            if (lastError?.status === 503 || lastError?.status === 502 || lastError?.status === 500 || lastError?.code === 'GEMINI_TIMEOUT' || lastError?.code === 'GEMINI_NETWORK_ERROR') {
                noteModelCooldown(candidate, lastError);
                continue;
            }
        }
        if (lastError) { lastError.fallbackAttempted = attemptedModels; throw lastError; }
        throw new Error('Gemini request thất bại.');
    });
    INFLIGHT.set(inflightKey, task);
    try { return await task; } finally { INFLIGHT.delete(inflightKey); }
}
function extractText(payload) { return (payload?.candidates?.[0]?.content?.parts || []).map(part => String(part?.text || '')).join('\n').trim(); }
async function generateText({ prompt, model = '', systemInstruction = '', maxOutputTokens = 5000, temperature = 0.4, profile = 'routine', timeoutMs = REQUEST_TIMEOUT_MS, dedupeKey = '' } = {}) {
    const result = await requestJson(model || undefined, { systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined, contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }], generationConfig: { maxOutputTokens, temperature } }, 'generateContent', { profile, timeoutMs, dedupeKey });
    const text = extractText(result.payload);
    if (!text) { const error = new Error('Gemini không trả về nội dung.'); error.code = 'GEMINI_EMPTY_RESPONSE'; throw error; }
    return { model: result.model, text, raw: result.payload, fallbackUsed: result.fallbackUsed, attemptedModels: result.attemptedModels };
}
function repairStructuredJson(text) {
    let value = String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    const startObject = value.indexOf('{'); const startArray = value.indexOf('[');
    const start = startObject < 0 ? startArray : startArray < 0 ? startObject : Math.min(startObject, startArray);
    if (start > 0) value = value.slice(start);
    let inString = false; let escaped = false; let objectDepth = 0; let arrayDepth = 0;
    for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue; }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{') objectDepth += 1; else if (ch === '}') objectDepth -= 1; else if (ch === '[') arrayDepth += 1; else if (ch === ']') arrayDepth -= 1;
    }
    if (inString) value += '"';
    value = value.replace(/,\s*([}\]])/g, '$1');
    while (arrayDepth > 0) { value += ']'; arrayDepth -= 1; }
    while (objectDepth > 0) { value += '}'; objectDepth -= 1; }
    return value;
}
function parseStructuredJson(text) {
    const repaired = repairStructuredJson(text);
    try { return JSON.parse(repaired); } catch (_) {
        const loose = repaired.replace(/\u0000/g, '').replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(loose);
    }
}
async function generateStructured({ prompt, schema, model = '', systemInstruction = '', maxOutputTokens = 8000, temperature = 0.25, profile = 'smart', timeoutMs = REQUEST_TIMEOUT_MS, dedupeKey = '' } = {}) {
    const body = { systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined, contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }], generationConfig: { maxOutputTokens, temperature, responseMimeType: 'application/json' } };
    if (schema) body.generationConfig.responseSchema = schema;
    let request;
    try {
        request = await requestJson(model || undefined, body, 'generateContent', { profile, timeoutMs, dedupeKey });
    } catch (error) { throw error; }
    const text = extractText(request.payload);
    if (!text) { const error = new Error('Gemini không trả về JSON.'); error.code = 'GEMINI_EMPTY_JSON'; throw error; }
    let data;
    try {
        data = parseStructuredJson(text);
    } catch (error) {
        const allowRemoteRepair = String(process.env.GEMINI_JSON_REPAIR_REMOTE || 'false').toLowerCase() === 'true';
        if (allowRemoteRepair) {
            const repairBody = { ...body, contents: [{ role: 'user', parts: [{ text: `${String(prompt || '').slice(0, 28000)}\nIMPORTANT: Return one COMPLETE valid JSON object matching the schema. Do not truncate, do not use markdown, and do not add commentary.` }] }] };
            try {
                const repairRequest = await requestJson(request.model, repairBody, 'generateContent', { profile, timeoutMs, dedupeKey: `${dedupeKey || hashText(String(prompt || ''))}:json-repair`, excludeModels: [request.model] });
                const repairedText = extractText(repairRequest.payload);
                data = parseStructuredJson(repairedText);
                return { model: repairRequest.model, data, raw: repairRequest.payload, fallbackUsed: true, attemptedModels: [...(request.attemptedModels || []), repairRequest.model] };
            } catch (repairError) {
                const parseError = new Error('Gemini trả về JSON không hợp lệ sau khi đã thử phục hồi và chuyển mô hình.');
                parseError.code = 'GEMINI_INVALID_JSON'; parseError.cause = repairError || error; parseError.rawText = text.slice(0, 8000); throw parseError;
            }
        }
        const parseError = new Error('Gemini trả về JSON không hợp lệ; hệ thống sẽ dùng nội dung SMART đã lưu để không gọi thêm AI.');
        parseError.code = 'GEMINI_INVALID_JSON'; parseError.cause = error; parseError.rawText = text.slice(0, 8000); throw parseError;
    }
    return { model: request.model, data, raw: request.payload, fallbackUsed: request.fallbackUsed, attemptedModels: request.attemptedModels };
}
async function generateMultimodalStructured({ prompt, schema, audioBase64 = '', mimeType = 'audio/webm', model = '', maxOutputTokens = 5000, temperature = 0.2, profile = 'audio', timeoutMs = REQUEST_TIMEOUT_MS, dedupeKey = '' } = {}) {
    if (!audioBase64) throw new Error('Thiếu dữ liệu audio.');
    const body = { contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: String(audioBase64) } }, { text: String(prompt || '') }] }], generationConfig: { maxOutputTokens, temperature, responseMimeType: 'application/json', responseSchema: schema } };
    const request = await requestJson(model || undefined, body, 'generateContent', { profile, timeoutMs, dedupeKey });
    const text = extractText(request.payload);
    if (!text) { const error = new Error('Gemini không trả về phân tích audio.'); error.code = 'GEMINI_EMPTY_AUDIO_ANALYSIS'; throw error; }
    let data;
    try { data = parseStructuredJson(text); } catch (error) { const parseError = new Error('Gemini trả về JSON phân tích audio không hợp lệ.'); parseError.code = 'GEMINI_INVALID_AUDIO_JSON'; parseError.cause = error; throw parseError; }
    return { model: request.model, data, raw: request.payload, fallbackUsed: request.fallbackUsed, attemptedModels: request.attemptedModels };
}
async function generateImage({ prompt, model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image', fallbackModels = String(process.env.GEMINI_IMAGE_FALLBACK_MODELS || 'gemini-3.1-flash-image').split(',').map(item => item.trim()).filter(Boolean), imageSize = '1K', aspectRatio = '16:9', timeoutMs = Math.min(300000, Math.max(60000, Number(process.env.GEMINI_IMAGE_TIMEOUT_MS || 240000))), dedupeKey = '' } = {}) {
    const key = getGeminiApiKey();
    if (!key) { const error = new Error('GEMINI_API_KEY is not configured.'); error.code = 'AI_NOT_CONFIGURED'; throw error; }
    const models = [...new Set([model, ...fallbackModels])].filter(Boolean);
    const inflightKey = dedupeKey || `image:${hashText(`${prompt}:${imageSize}:${aspectRatio}`)}:${models.join(',')}`;
    if (INFLIGHT.has(inflightKey)) return INFLIGHT.get(inflightKey);
    const task = runExclusive(async () => {
        let lastError = null;
        for (const candidate of models) {
            if (isModelCooling(candidate)) continue;
            for (let attempt = 0; attempt <= Math.min(MAX_RETRIES_PER_MODEL, 1); attempt += 1) {
                try {
                    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
                    let response;
                    try {
                        response = await fetch(`${API_BASE}/interactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: controller.signal, body: JSON.stringify({ model: candidate, input: [{ type: 'text', text: String(prompt || '').slice(0, 24000) }], response_format: { type: 'image', image_size: imageSize, aspect_ratio: aspectRatio } }) });
                    } catch (error) {
                        lastError = error?.name === 'AbortError' ? Object.assign(new Error(`Gemini image timeout sau ${Math.round(timeoutMs / 1000)} giây.`), { code: 'GEMINI_TIMEOUT', status: 503, retryable: true }) : Object.assign(error, { code: 'GEMINI_NETWORK_ERROR', status: 503, retryable: true });
                        if (attempt < 1) { await sleep(retryDelay(attempt)); continue; }
                        break;
                    } finally { clearTimeout(timer); }
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) { const error = apiError(response, payload); lastError = error; if (error.quota) noteModelCooldown(candidate, error); if (error.quota) break; if (error.retryable && attempt < 1) { await sleep(retryDelay(attempt, error.retryAfterMs)); continue; } break; }
                    let base64 = payload?.output_image?.data || '';
                    if (!base64) for (const step of payload?.steps || []) for (const item of step?.content || []) if (item?.type === 'image' && item?.data) base64 = item.data;
                    if (!base64) { lastError = Object.assign(new Error('Gemini không trả về ảnh.'), { code: 'GEMINI_EMPTY_IMAGE', status: 502 }); break; }
                    if (candidate !== models[0]) fallbackLog(models[0], candidate, lastError);
                    return { model: candidate, mimeType: payload?.output_image?.mime_type || 'image/png', buffer: Buffer.from(base64, 'base64'), width: null, height: null, fallbackUsed: candidate !== models[0], raw: payload };
                } catch (error) {
                    lastError = error;
                    if (attempt >= 1) break;
                    await sleep(retryDelay(attempt, error.retryAfterMs));
                }
            }
            if (lastError?.quota || lastError?.status === 503 || lastError?.status === 429 || lastError?.code === 'GEMINI_TIMEOUT') noteModelCooldown(candidate, lastError);
        }
        throw lastError || cooldownError(models);
    });
    INFLIGHT.set(inflightKey, task);
    try { return await task; } finally { INFLIGHT.delete(inflightKey); }
}
async function generateSpeech({ text, model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts', voice = 'Kore', style = 'clear, warm, educational, medium pace', timeoutMs = Math.max(60000, REQUEST_TIMEOUT_MS), dedupeKey = '' } = {}) {
    const key = getGeminiApiKey();
    if (!key) { const error = new Error('GEMINI_API_KEY is not configured.'); error.code = 'AI_NOT_CONFIGURED'; throw error; }
    const models = [...new Set([model, ...String(process.env.GEMINI_TTS_FALLBACK_MODELS || 'gemini-3.8-flash-lite-tts').split(',').map(item => item.trim()).filter(Boolean)])];
    const inflightKey = dedupeKey || `tts:${hashText(text)}:${models.join(',')}:${voice}`;
    if (INFLIGHT.has(inflightKey)) return INFLIGHT.get(inflightKey);
    const task = runExclusive(async () => {
        let lastError = null;
        for (const candidate of models) {
            if (isModelCooling(candidate)) continue;
            for (let attempt = 0; attempt <= Math.min(MAX_RETRIES_PER_MODEL, 1); attempt += 1) {
                try {
                    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
                    let response;
                    try {
                        response = await fetch(`${API_BASE}/interactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: controller.signal, body: JSON.stringify({ model: candidate, input: [{ type: 'user_input', content: [{ type: 'text', text: String(text || '').slice(0, 20000), annotations: [{ type: 'speech_metadata', style }] }] }], response_format: { type: 'audio', mime_type: 'audio/wav' }, generation_config: { speech_config: [{ voice }] } }) });
                    } catch (error) {
                        const timeoutError = error?.name === 'AbortError' ? Object.assign(new Error(`Gemini TTS timeout sau ${Math.round(timeoutMs / 1000)} giây.`), { code: 'GEMINI_TIMEOUT', status: 503, retryable: true }) : Object.assign(error, { code: 'GEMINI_NETWORK_ERROR', status: 503, retryable: true });
                        lastError = timeoutError; if (attempt < 1) { await sleep(retryDelay(attempt)); continue; } break;
                    } finally { clearTimeout(timer); }
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) { const error = apiError(response, payload); lastError = error; if (error.quota) noteModelCooldown(candidate, error); if (error.quota || attempt >= 1 || !error.retryable) break; await sleep(retryDelay(attempt, error.retryAfterMs)); continue; }
                    let base64 = payload?.output_audio?.data || ''; for (const step of payload?.steps || []) for (const content of step?.content || []) if (content?.type === 'audio' && content?.data) base64 = content.data;
                    if (!base64) { lastError = Object.assign(new Error('Gemini TTS không trả về audio.'), { code: 'GEMINI_EMPTY_AUDIO' }); break; }
                    if (candidate !== models[0]) fallbackLog(models[0], candidate, lastError);
                    return { model: candidate, voice, mimeType: 'audio/wav', buffer: Buffer.from(base64, 'base64'), hash: hashText(text), fallbackUsed: candidate !== models[0] };
                } catch (error) { lastError = error; if (attempt >= 1) break; await sleep(retryDelay(attempt, error.retryAfterMs)); }
            }
            if (lastError?.quota || lastError?.status === 503 || lastError?.status === 429 || lastError?.code === 'GEMINI_TIMEOUT') noteModelCooldown(candidate, lastError);
        }
        throw lastError || new Error('Gemini TTS request thất bại.');
    });
    INFLIGHT.set(inflightKey, task);
    try { return await task; } finally { INFLIGHT.delete(inflightKey); }
}
function compactLessonContent(content) {
    if (!content) return {};
    const safe = typeof content === 'object' ? content : {};
    return { title: String(safe.title || '').slice(0, 300), topic: String(safe.topic || '').slice(0, 300), objectives: Array.isArray(safe.objectives) ? safe.objectives.slice(0, 8).map(String) : [], theory: safe.theory, theorySections: Array.isArray(safe.theorySections) ? safe.theorySections.slice(0, 8) : [], examples: Array.isArray(safe.examples) ? safe.examples.slice(0, 8) : [], glossary: Array.isArray(safe.glossary) ? safe.glossary.slice(0, 20).map(String) : [], commonMistakes: Array.isArray(safe.commonMistakes) ? safe.commonMistakes.slice(0, 10).map(String) : [] };
}
async function generateLessonHelp({ grade, subject, topic, question, lessonContent }) {
    const content = compactLessonContent(lessonContent);
    const result = await generateText({ prompt: [`Người học: lớp ${grade || 'chưa xác định'}.`,`Môn: ${subject || 'chưa xác định'}.`,`Chủ đề: ${topic || content.topic || 'chưa xác định'}.`,question ? `Câu hỏi: ${question}` : 'Không có câu hỏi cụ thể; giải thích bài học.',`Context: ${JSON.stringify(content).slice(0, 16000)}`].join('\n'), systemInstruction: 'Bạn là trợ giảng của Hành Trình Mới. Giải thích rõ ràng, phù hợp trình độ. Không bịa nguồn chính thức. Nếu context thiếu, nói rõ. Không tự nhận nội dung là đề thi thật hoặc chương trình chính thức.', profile: 'routine' });
    return { model: result.model, text: result.text, generated: true, sourceType: 'AI_ASSISTED_EXPLANATION', note: 'AI hỗ trợ giải thích từ context bài học.' };
}
module.exports = { generateText, generateStructured, generateMultimodalStructured, generateImage, generateSpeech, generateLessonHelp, compactLessonContent, repairStructuredJson, parseStructuredJson, isGeminiConfigured, getGeminiModel, getGeminiFallbackModels, getGeminiApiKey, getAiMode, isRemoteAiAllowed, hashText, isRetryableStatus, isQuotaError, isDailyQuotaError, modelCooldownMs, DAILY_QUOTA_COOLDOWN_MS };
