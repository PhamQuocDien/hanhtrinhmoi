'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
function read(relativePath) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }
function checkSyntax(relativePath) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, relativePath)], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `${relativePath}: ${result.stderr || result.stdout}`);
}
function testAmbientFiles() {
    assert(fs.existsSync(path.join(root, 'assets/js/ai-autopilot.js')));
    assert(fs.existsSync(path.join(root, 'assets/css/ai-autopilot.css')));
    assert(fs.existsSync(path.join(root, 'server/services/ai-autopilot-service.js')));
    const script = read('assets/js/ai-autopilot.js');
    for (const snippet of ['AI đang tự phân tích hành trình của bạn', '/api/ai-learning/ambient/observe', 'installFetchObserver', 'PAGE_VIEW', 'API_SUCCESS']) assert(script.includes(snippet), `Ambient AI thiếu ${snippet}`);
}
function testModelAndRoutes() {
    const models = read('server/models/platform-models.js');
    assert(models.includes('const aiAmbientInsightSchema'), 'Thiếu AIAmbientInsight schema.');
    assert(models.includes("AIAmbientInsight: model('AIAmbientInsight', aiAmbientInsightSchema)"), 'Chưa export AIAmbientInsight.');
    const routes = read('server/routes/ai-learning-routes.js');
    for (const route of ["'/ambient/observe'", "'/ambient/auto-course'"]) assert(routes.includes(route), `Thiếu ambient route ${route}`);
    const service = read('server/services/ai-autopilot-service.js');
    for (const snippet of ['generateStructured', 'shouldCreateCourse', 'coursePrompt', 'GEMINI_AMBIENT_AI', 'RULE_BASED_AMBIENT_AI', 'fallbackUsed']) assert(service.includes(snippet), `Ambient service thiếu ${snippet}`);
}
function testAllPagesLoaded() {
    const pages = fs.readdirSync(root).filter(name => name.endsWith('.html'));
    assert(pages.length >= 45, 'Số trang HTML bất thường thấp.');
    for (const page of pages) {
        const html = read(page);
        assert(html.includes('ai-autopilot.js'), `${page} chưa nạp AI Autopilot.`);
        assert(html.includes('ai-autopilot.css'), `${page} chưa nạp CSS AI Autopilot.`);
    }
    const admin = read('admin/index.html');
    assert(admin.includes('/assets/js/ai-autopilot.js'));
    assert(admin.includes('/assets/css/ai-autopilot.css'));
}
function testAutoDirector() {
    const hub = read('assets/js/ai-learning-hub.js');
    assert(hub.includes('aiAmbientObserve'), 'Dashboard chưa chuyển sang ambient AI tự động.');
    assert(hub.includes('setTimeout(() => runDirector(), 500)'), 'AI Director chưa tự chạy.');
    assert(hub.includes('ai-director-actions') && hub.includes('ai-autopilot-hidden'), 'Nút phân tích AI cũ chưa chuyển sang tự động.');
    const api = read('assets/js/api.js');
    assert(api.includes('aiAmbientObserve') && api.includes('aiAmbientAutoCourse'));
}
for (const file of ['assets/js/ai-autopilot.js', 'assets/js/ai-learning-hub.js', 'assets/js/api.js', 'server/services/ai-autopilot-service.js', 'server/routes/ai-learning-routes.js', 'server/models/platform-models.js', 'server.js']) checkSyntax(file);
testAmbientFiles();
testModelAndRoutes();
testAllPagesLoaded();
testAutoDirector();
console.log('✅ Runtime V16: AI Autopilot tự phân tích mọi trang, tự quan sát API, AI Director tự chạy và auto-course surface đều đạt.');
