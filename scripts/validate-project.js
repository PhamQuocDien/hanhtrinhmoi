'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const failures = [];
const files = [];
function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['.git', 'node_modules'].includes(entry.name)) continue;
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), relative);
        else files.push(relative);
    }
}
walk(root);
const htmlFiles = files.filter(file => file.endsWith('.html'));
const jsFiles = files.filter(file => file.endsWith('.js') && !file.endsWith('.bak'));

for (const file of jsFiles) {
    try { execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' }); }
    catch (error) { failures.push(`JavaScript không hợp lệ: ${file}: ${error.stderr?.toString() || error.message}`); }
}
for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    let scriptIndex = 0;
    for (const match of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        scriptIndex += 1;
        const attrs = match[1] || '';
        const source = match[2] || '';
        if (/\bsrc\s*=/.test(attrs) || !source.trim()) continue;
        const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
        if (type && !['text/javascript', 'application/javascript'].includes(type)) continue;
        try { new vm.Script(source, { filename: `${file}#script-${scriptIndex}` }); }
        catch (error) { failures.push(`Script nội tuyến không hợp lệ: ${file} khối ${scriptIndex}: ${error.message}`); }
    }
    for (const match of content.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
        const value = match[1];
        if (!value || value.includes('${') || /^(?:https?:|data:|mailto:|javascript:|#|\/socket\.io)/i.test(value)) continue;
        const target = value.split(/[?#]/)[0].replace(/^\//, '');
        if (target && !files.includes(target)) failures.push(`${file}: thiếu tệp ${target}`);
    }
}

const includes = (file, snippets, label) => {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) { failures.push(`Thiếu tệp ${file} (${label}).`); return; }
    const source = fs.readFileSync(filePath, 'utf8');
    for (const snippet of snippets) if (!source.includes(snippet)) failures.push(`${file}: thiếu ${label} — ${snippet}`);
};
includes('server/services/platform-services.js', ['extractDocxText', 'parseLearningDocument', 'normalizeSurveyResult', 'buildPersonalLearningPlan', 'selectAdaptivePlacementQuestion', 'buildAssessmentSkillEvidence', 'buildEnglishSkillProfile'], 'Phase 2 services');
includes('server/routes/platform-routes.js', ["router.get('/survey/surveys'", "router.post('/survey/:id/attempts'", "router.get('/placement/tests'", "router.post('/placement/:id/attempts'", "router.post('/placement/:id/adaptive/next'", "router.get('/learning-platform/plan'", "router.post('/admin/platform/word-imports/preview'", "router.patch('/admin/platform/word-imports/:id/preview'", "router.post('/admin/platform/word-imports/:id/commit'"], 'Phase 2 API');
includes('scripts/migrations/index.js', ['011-v21-survey-placement.js', '013-v27-1-expanded-dsa-practice.js'], 'survey/placement and expanded D&C practice migration registration');
includes('scripts/migrations/011-v21-survey-placement.js', ['Khảo sát mục tiêu học tập toàn diện · V21', 'HTM-PLACEMENT-K12-G${grade}-V21', 'HTM-PLACEMENT-TOEIC-V21', 'HTM-PLACEMENT-IELTS-V21', 'HTM-PLACEMENT-MOS-V21'], 'survey and placement seed');
includes('admin/index.html', ['admin-quick-create.css', 'admin-quick-create.js', 'data-view="import"'], 'Azota-like quick creator');
includes('assets/js/admin/admin-quick-create.js', ['.docx,.md,.markdown,.txt', '/api/admin/platform/word-imports/preview', '/commit', 'xem trước'], 'Word/Markdown authoring workflow');
includes('assets/platform/flow-pages.js', ['renderSurveyQuestions', 'renderPlacementQuestions', 'loadAdaptiveQuestion', 'submitSurvey', 'submitPlacement', 'normalizeOption', 'loadUniversitySelectors'], 'survey/placement/profile UI');
includes('assets/js/admin/admin-cms.js', ['INVALID / NEEDS_REPAIR', 'selected.validation.valid === false'], 'invalid diagnostics visibility');
includes('profile.html', ['universityName', 'facultyName', 'majorName', 'specializationName', 'trainingProgramName', 'learning-profile-summary'], 'extended learning profile');
includes('server/config/platform-constants.js', ["'SELF_STUDY'", "'coding'", "'practical'"], 'education/question types');
includes('server/services/local-ai-runtime.js', ['rankKnowledge', 'makeGroundedFallback', 'requestOllama', 'documentFromLesson', 'remoteApiUsed: false'], 'Phase 6 local AI/RAG');
includes('server/routes/ai-learning-routes.js', ["router.get('/local/status', requireAuth, rate", "router.post('/local/ask', requireAuth, rate", 'PUBLISHED', 'documentFromLesson(lesson'], 'local AI endpoints and published-source grounding');
includes('server/routes/platform-routes.js', ["router.get('/learning/lesson-progress', requireAuth", "router.put('/learning/lesson-progress/:lessonId', requireAuth", 'recalculateLessonProgress', 'completedSteps/progressPercent từ client bị bỏ qua'], 'V34 evidence-based lesson progress persistence');
includes('assets/js/learning/lesson-progress.js', ['renderSummary', 'evidenceSteps', 'không thể tự tích hoàn thành', 'api.get'], 'V34 server-verified lesson progress UX');
includes('assets/js/learning/local-ai-tutor.js', ['/api/ai-learning/local/ask', 'Không gọi API AI cloud'], 'Phase 6 local tutor UI');
includes('docs/PHASE4_5_6_RUNBOOK.md', ['Phase 4', 'Phase 5', 'Phase 6', 'CODE_RUNNER_ALLOW_UNSANDBOXED'], 'Phase 4-6 deploy runbook');
includes('server/models/platform-models.js', ['contentBlockSchema', 'practiceTaskSchema', 'learningPlanStepSchema', 'courseQualitySnapshotSchema'], 'typed learning records');
includes('server/services/learning-system-v27.js', ['buildAdaptiveRecommendations', 'buildAlgorithmTaskSeeds', 'auditCourseCatalog', 'ageFromDob', 'validatePublishableQuestion'], 'Phase 7-11 learning engine');
includes('server/routes/learning-system-v27-routes.js', ["router.get('/admin/overview'", "router.get('/admin/catalog-gaps'", "router.get('/admin/analytics'", "router.get('/practice/tasks'", "router.post('/practice/tasks/:id/submit'", "router.get('/plan/recommendations'"], 'Phase 7-11 API');
includes('scripts/migrations/012-v27-typed-learning-system.js', ['ContentBlock', 'PracticeTask', 'ensureDiagnostics', 'buildAlgorithmTaskSeeds'], 'typed content, practical tasks, survey and placement repair migration');
includes('scripts/migrations/013-v27-1-expanded-dsa-practice.js', ['DSA-DAC-MERGE-SORT-016', 'DSA-DAC-MAX-SUBARRAY-017', 'DSA-DAC-COUNT-INVERSIONS-018', 'validatePracticeTask'], 'versioned migration for expanded divide-and-conquer exercises');
includes('assets/js/admin/admin-learning-engine.js', ['contentBlocks', 'practiceTasks', 'questions', 'assessments', 'catalog-gaps', 'JSON'], 'visual CMS, question/assessment builder and quality dashboard');
includes('assets/js/learning/algorithm-practice.js', ['/api/learning-system/practice/tasks', 'samples', 'submit'], 'real coding practice UI');
includes('assets/js/learning/adaptive-evidence-plan.js', ['/api/learning-system/plan/recommendations', '/api/learning-system/plan/rebuild'], 'adaptive learning path UI');
includes('profile.html', ['birthDate', 'learning-profile-summary'], 'editable date of birth and profile');
includes('UPGRADE_V27_PHASE7_11.md', ['Phase 7', 'Phase 8', 'Phase 9', 'Phase 10', 'Phase 11'], 'Phase 7-11 release notes');
includes('docs/PHASE7_11_RUNBOOK.md', ['Migration', 'npm test', 'PracticeTask', 'ContentBlock'], 'Phase 7-11 runbook');

for (const test of ['scripts/test-v20-content.js', 'scripts/test-v21-phase2.js', 'scripts/test-v21-phase2-hardening.js', 'scripts/test-v22-learning-experience.js', 'scripts/test-v27-phase7-11.js']) {
    try { execFileSync(process.execPath, [path.join(root, test)], { stdio: 'pipe' }); }
    catch (error) { failures.push(`Test ${test} thất bại: ${(error.stdout?.toString() || '') + (error.stderr?.toString() || error.message)}`); }
}

if (failures.length) {
    console.error(`❌ Phase 2 validation phát hiện ${failures.length} lỗi:\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log(`✅ Project validation PASS: ${htmlFiles.length} HTML pages, ${jsFiles.length} JavaScript files checked, legacy routes/migrations, Phase 4-6 and Phase 7-11 typed learning/CMS/adaptive features present.`);
console.log('ℹ️ Bộ kiểm tra lịch sử được giữ riêng tại scripts/validate-legacy-project.js để đối chiếu các quy ước giao diện cũ.');
