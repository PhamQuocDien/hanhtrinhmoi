'use strict';

function parseTrustProxyHops(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) throw new Error('TRUST_PROXY_HOPS phải là số nguyên từ 0 đến 5.');
  const hops = Number(raw);
  if (!Number.isSafeInteger(hops) || hops < 0 || hops > 5) {
    throw new Error('TRUST_PROXY_HOPS phải là số nguyên từ 0 đến 5.');
  }
  return hops === 0 ? false : hops;
}

function isRenderEnvironment(env = process.env) {
  return Boolean(env.RENDER_EXTERNAL_HOSTNAME || env.RENDER === 'true' || env.RENDER_SERVICE_NAME);
}

function isProductionEnvironment(env = process.env) {
  return env.NODE_ENV === 'production' || isRenderEnvironment(env);
}

function getTrustProxySetting(env = process.env) {
  const explicit = parseTrustProxyHops(env.TRUST_PROXY_HOPS);
  if (explicit !== null) return explicit;
  // Render serves web requests through its edge proxy. Use one hop there unless
  // explicitly overridden. NODE_ENV alone does not prove a reverse proxy exists.
  if (isRenderEnvironment(env)) return 1;
  return false;
}

module.exports = { parseTrustProxyHops, isRenderEnvironment, isProductionEnvironment, getTrustProxySetting };
