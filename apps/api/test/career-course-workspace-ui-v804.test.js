const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const css = readFileSync(join(root, 'apps/web/src/css/career.css'), 'utf8');
const html = readFileSync(join(root, 'apps/web/career.html'), 'utf8');
const server = readFileSync(join(root, 'apps/api/server.js'), 'utf8');

test('IT course dialog fills the viewport instead of opening as a small modal', () => {
  const marker = css.lastIndexOf('V8.0.4: course learning opens as a real full-screen workspace');
  assert.ok(marker >= 0, 'V8.0.4 full-screen override must be present');
  const rules = css.slice(marker);
  assert.match(rules, /position:\s*fixed/);
  assert.match(rules, /inset:\s*0/);
  assert.match(rules, /width:\s*100vw/);
  assert.match(rules, /height:\s*100dvh/);
  assert.match(rules, /max-width:\s*none/);
  assert.match(rules, /max-height:\s*100dvh/);
  assert.match(rules, /transform:\s*none/);
});

test('career page cache-busts the UI assets so an old small-dialog stylesheet is not reused', () => {
  assert.match(html, /\/src\/css\/career\.css\?v=8\.0\.4/);
  assert.match(html, /\/src\/js\/career\.js\?v=8\.0\.4/);
  assert.match(html, /Hành Trình Mới V8\.0\.4/);
});

test('static HTML responses cannot keep an old career page for an hour', () => {
  assert.match(server, /setHeaders\(res, filePath\)/);
  assert.match(server, /no-cache, no-store, must-revalidate/);
});

test('health endpoint reports the UI fix release version', () => {
  assert.match(server, /version:\s*'8\.0\.4'/);
});
