'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const entries = fs.readdirSync(root, { withFileTypes: true });
const files = new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name));
const htmlFiles = [...files].filter(file => file.endsWith('.html'));
function walk(dir, prefix = '') {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
        else out.push(rel);
    }
    return out;
}
const allFiles = new Set(walk(root));
const jsFiles = [...allFiles].filter(file => file.endsWith('.js') && !file.endsWith('.bak'));
const failures = [];

for (const file of jsFiles) {
    try {
        execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    } catch (error) {
        failures.push(`JavaScript không hợp lệ: ${file}\n${error.stderr?.toString() || error.message}`);
    }
}

// Biên dịch script nội tuyến để bắt lỗi JavaScript nằm trong HTML.
for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(path.join(root, htmlFile), 'utf8');
    let scriptIndex = 0;
    for (const match of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        scriptIndex += 1;
        const attrs = match[1] || '';
        const source = match[2] || '';
        if (/\bsrc\s*=/.test(attrs) || !source.trim()) continue;
        const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
        if (type && !['text/javascript', 'application/javascript'].includes(type)) continue;
        try {
            new vm.Script(source, { filename: `${htmlFile}#script-${scriptIndex}` });
        } catch (error) {
            failures.push(`Script nội tuyến không hợp lệ: ${htmlFile} khối ${scriptIndex}: ${error.message}`);
        }
    }
}

const localRefPattern = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(path.join(root, htmlFile), 'utf8');
    for (const match of content.matchAll(localRefPattern)) {
        const value = match[1];
        if (!value || value.includes('${') || /^(?:https?:|data:|mailto:|javascript:|#|\/socket\.io)/i.test(value)) continue;
        const target = value.split(/[?#]/)[0].replace(/^\//, '');
        if (target && !allFiles.has(target)) failures.push(`${htmlFile}: thiếu tệp ${target}`);
    }
}

for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(path.join(root, htmlFile), 'utf8');
    if (!content.includes('modern-ui.css')) failures.push(`${htmlFile}: chưa nạp modern-ui.css`);
    if (!content.includes('modern-ui.js')) failures.push(`${htmlFile}: chưa nạp modern-ui.js`);
}

for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(path.join(root, htmlFile), 'utf8');
    if (!content.includes('assets/ui/ui-v11.css') || !content.includes('assets/ui/ui-v11.js')) failures.push(`${htmlFile}: chưa nạp lớp sửa giao diện V11.`);
    if (!content.includes('assets/ui/connection-v13.js')) failures.push(`${htmlFile}: chưa nạp giám sát kết nối V13.`);
    if (htmlFile !== 'status.html' && (!content.includes('assets/ui/ux-v13.css') || !content.includes('assets/ui/ux-v13.js'))) failures.push(`${htmlFile}: chưa nạp lớp trải nghiệm người dùng V13.`);
    const adsenseScripts = [...content.matchAll(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-2735044868175045/g)].length;
    if (adsenseScripts !== 1) failures.push(`${htmlFile}: cần đúng một mã AdSense ca-pub-2735044868175045, hiện có ${adsenseScripts}.`);
    const ids = [...content.matchAll(/\sid=["']([^"']+)["']/gi)].map(match => match[1]);
    const seen = new Set();
    for (const id of ids) { if (seen.has(id)) failures.push(`${htmlFile}: ID giao diện bị trùng ${id}`); seen.add(id); }
}

try {
    const { tests } = require(path.join(root, 'question-data.js'));
    const { SUBJECTS, DIFFICULTIES, ensureCompleteQuestionBank } = require(path.join(root, 'question-bank-complete.js'));
    const summary = ensureCompleteQuestionBank(tests, { minQuestions: 100 });
    const ids = new Set();
    for (const subject of SUBJECTS) {
        for (let grade = 1; grade <= 12; grade += 1) {
            for (const difficulty of DIFFICULTIES) {
                const questions = tests[subject]?.[`grade${grade}`]?.[difficulty];
                if (!Array.isArray(questions) || questions.length < 100) {
                    failures.push(`Thiếu câu hỏi: ${subject} lớp ${grade} ${difficulty}`);
                    continue;
                }
                for (const question of questions) {
                    if (!question.id || ids.has(question.id)) failures.push(`ID câu hỏi trùng/thiếu: ${question.id || '(trống)'}`);
                    ids.add(question.id);
                    if (!question.q || !Array.isArray(question.a) || question.a.length < 4 || !question.a.includes(question.correct)) failures.push(`Câu hỏi không hợp lệ: ${question.id}`);
                }
            }
        }
    }
    if (summary.totalQuestions < 21600) failures.push(`Ngân hàng chỉ có ${summary.totalQuestions} câu, yêu cầu tối thiểu 21600.`);
} catch (error) {
    failures.push(`Không kiểm tra được ngân hàng câu hỏi: ${error.message}`);
}

let curriculumSummary = { grades: 0, subjects: 0, lessons: 0, lessonQuestions: 0 };
try {
    const curriculum = require(path.join(root, 'curriculum-data.js'));
    const firstLessonBySubject = new Map();
    for (let grade = 1; grade <= 12; grade += 1) {
        const catalog = curriculum.getCatalog(grade);
        curriculumSummary.grades += 1;
        if (catalog.grade !== grade || !catalog.gradeFocus) failures.push(`Hồ sơ lớp ${grade} thiếu trọng tâm riêng.`);
        if (!catalog.framework?.qualities?.length || !catalog.framework?.generalCompetencies?.length) failures.push(`Hồ sơ lớp ${grade} thiếu khung phẩm chất và năng lực V8.`);
        if (!Array.isArray(catalog.subjects) || catalog.subjects.length < 8) failures.push(`Lớp ${grade} có quá ít môn học.`);
        const subjectNames = new Set();
        for (const subject of catalog.subjects) {
            curriculumSummary.subjects += 1;
            if (!subject.name.includes(String(grade))) failures.push(`${subject.id} lớp ${grade}: tên môn chưa thể hiện lớp riêng.`);
            if (subjectNames.has(subject.name)) failures.push(`Lớp ${grade}: tên môn trùng ${subject.name}`);
            subjectNames.add(subject.name);
            const fullSubject = curriculum.getSubject(grade, subject.id, { includeLessons: true });
            if (!fullSubject || fullSubject.lessons.length !== subject.lessonCount) failures.push(`${subject.name}: số bài không khớp.`);
            if (!fullSubject?.competencyProfile?.general?.length || !fullSubject?.competencyProfile?.subjectSpecific?.length) failures.push(`${subject.name}: thiếu hồ sơ năng lực môn học.`);
            const lessonTitles = new Set();
            for (const lesson of fullSubject?.lessons || []) {
                curriculumSummary.lessons += 1;
                curriculumSummary.lessonQuestions += lesson.questions.length;
                if (lessonTitles.has(lesson.title)) failures.push(`${subject.name}: bài bị trùng tên ${lesson.title}`);
                lessonTitles.add(lesson.title);
                if (!lesson.gradeFocus || !lesson.title || lesson.questions.length !== 12) failures.push(`${subject.name}/${lesson.id}: gói bài học chưa đầy đủ.`);
                if (!lesson.unitTitle || !lesson.difficulty || !Array.isArray(lesson.studySteps) || lesson.studySteps.length !== 5 || !Array.isArray(lesson.practiceTasks) || lesson.practiceTasks.length !== 3) failures.push(`${subject.name}/${lesson.id}: thiếu chặng, độ khó hoặc tiến trình học V7.`);
                if (!Array.isArray(lesson.learningOutcomes) || lesson.learningOutcomes.length < 2 || !lesson.competencies?.general?.length || !lesson.competencies?.subjectSpecific?.length || !Array.isArray(lesson.qualities) || !lesson.qualities.length || !lesson.assessment?.rubricLevels?.length) failures.push(`${subject.name}/${lesson.id}: thiếu yêu cầu cần đạt, phẩm chất, năng lực hoặc minh chứng đánh giá V8.`);
                if (!Array.isArray(lesson.theory) || lesson.theory.length < 2 || !Array.isArray(lesson.theorySections) || lesson.theorySections.length < 3 || !lesson.theorySections.every(section => section.title && Array.isArray(section.bullets) && section.bullets.length >= 2) || !Array.isArray(lesson.commonMistakes) || lesson.commonMistakes.length < 3 || !Array.isArray(lesson.quickChecks) || lesson.quickChecks.length < 3) failures.push(`${subject.name}/${lesson.id}: thiếu lý thuyết theo môn V14.`);
                if (lesson.order % 4 === 0 && !lesson.isCheckpoint) failures.push(`${subject.name}/${lesson.id}: bài cuối chặng chưa được đánh dấu mốc kiểm tra.`);
                for (const question of lesson.questions) {
                    if (!question.prompt || !Array.isArray(question.options) || question.options.length !== 4 || !Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) failures.push(`${subject.name}/${lesson.id}/${question.id}: câu hỏi lộ trình không hợp lệ.`);
                }
            }
            const firstTitle = fullSubject?.lessons?.[0]?.title;
            if (firstTitle) {
                const previous = firstLessonBySubject.get(subject.id);
                if (previous?.has(firstTitle)) failures.push(`${subject.id}: lớp ${grade} dùng lại bài mở đầu ${firstTitle}`);
                if (!previous) firstLessonBySubject.set(subject.id, new Set([firstTitle])); else previous.add(firstTitle);
            }
        }
    }
    const grade1English = curriculum.getSubject(1, 'tieng_anh');
    const grade3English = curriculum.getSubject(3, 'tieng_anh');
    if (!grade1English || grade1English.compulsory) failures.push('Tiếng Anh lớp 1 phải là chương trình làm quen tự chọn.');
    if (!grade3English || !grade3English.compulsory) failures.push('Tiếng Anh lớp 3 phải là môn bắt buộc.');
    for (const grade of [3,4,5]) if (!curriculum.getSubject(grade, 'tin_hoc_cong_nghe')) failures.push(`Lớp ${grade} thiếu môn Tin học và Công nghệ.`);
    const sample = curriculum.getLesson(6, 'toan', 'lesson-1').lesson;
    const tenCorrect = Object.fromEntries(sample.questions.map((q, index) => [q.id, index < 10 ? q.answer : (q.answer + 1) % 4]));
    const nineCorrect = Object.fromEntries(sample.questions.map((q, index) => [q.id, index < 9 ? q.answer : (q.answer + 1) % 4]));
    if (!curriculum.scoreLesson(sample, tenCorrect).passed || curriculum.scoreLesson(sample, nineCorrect).passed) failures.push('Ngưỡng mở khóa trên 8/10 hoạt động sai.');
} catch (error) {
    failures.push(`Không kiểm tra được lộ trình lớp 1–12: ${error.message}`);
}

const roomSource = fs.readFileSync(path.join(root, 'trang-tri-phong.html'), 'utf8');
for (const requiredSnippet of ['generateInfiniteMine()', 'isMineable', '/api/house/mine', 'voxel_diamond', 'Mỏ Pha Lê Vô Tận']) {
    if (!roomSource.includes(requiredSnippet)) failures.push(`Trang trí phòng thiếu tính năng mỏ V7: ${requiredSnippet}`);
}

const renderSource = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
if (!renderSource.includes('healthCheckPath: /healthz')) failures.push('Render chưa dùng health check độc lập /healthz.');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const headerMiddlewareIndex = serverSource.indexOf("res.setHeader('X-Request-Id'");
const publicStaticIndex = serverSource.indexOf("app.use('/assets', express.static");
const sessionIndex = serverSource.indexOf('app.use(sessionMiddleware)');
if (headerMiddlewareIndex < 0 || publicStaticIndex < 0 || headerMiddlewareIndex > publicStaticIndex) failures.push('Header bảo mật/mã yêu cầu phải chạy trước tài nguyên công khai.');
if (publicStaticIndex < 0 || sessionIndex < 0 || publicStaticIndex > sessionIndex) failures.push('Trang đăng nhập/status chưa được phục vụ trước session store.');
if (!serverSource.includes("'/status.html'")) failures.push('Máy chủ chưa công khai trang chẩn đoán status.html.');
const serverRoutes = new Set([...serverSource.matchAll(/app\.(?:get|post|put|delete)\(\s*['"]([^'"]+)['"]/g)].map(match => match[1]));
for (const route of ['/api/learning/week-plan', '/api/learning/review-quiz', '/api/learning/review-quiz/submit', '/api/house/mine']) {
    if (!serverRoutes.has(route)) failures.push(`Thiếu API V7: ${route}`);
}
for (const route of ['/api/learning/education-dashboard', '/api/learning/self-assessment']) {
    if (!serverRoutes.has(route)) failures.push(`Thiếu API giáo dục V8: ${route}`);
}
for (const route of ['/api/tournaments', '/api/tournaments/:id', '/api/tournaments/:id/join', '/api/tournaments/:id/leave', '/api/tournaments/:id/start', '/api/tournaments/:id/cancel', '/api/tournaments/join-code']) {
    if (!serverRoutes.has(route)) failures.push(`Thiếu API giải cộng đồng V9: ${route}`);
}
for (const snippet of ['arenaPoints', 'arena-noncash', 'refundTournamentEntries', 'creditArenaPoints', 'COMMUNITY_TOURNAMENT_MAX_ENTRY']) {
    if (!serverSource.includes(snippet)) failures.push(`Máy chủ thiếu bảo vệ quỹ giải V9: ${snippet}`);
}

for (const route of ['/api/health', '/api/ready', '/api/survival/state', '/api/survival/sync', '/api/survival/mine', '/api/survival/place', '/api/survival/craft', '/api/survival/eat', '/api/survival/reset', '/api/learning/preferences', '/api/learning/roadmap', '/api/learning/practical/submit', '/api/learning/preflight/:grade/:subjectId/:lessonId', '/api/learning/weekly-assignments']) {
    if (!serverRoutes.has(route)) failures.push(`Thiếu API V11: ${route}`);
}
for (const snippet of ['survivalState', 'removedBlocks', 'SURVIVAL_RECIPES', 'validateSurvivalMine', 'LearningPractical', 'practicalTypeForSubject']) {
    if (!serverSource.includes(snippet)) failures.push(`Máy chủ thiếu nâng cấp V11: ${snippet}`);
}
try {
    const survivalModule = require(path.join(root, 'server/modules/survival-v13.js'));
    const types = Object.keys(survivalModule.BLOCKS || {});
    if (types.length < 12 || Object.keys(survivalModule.RECIPES || {}).length < 5) failures.push('Mô-đun sinh tồn V11 thiếu khối hoặc công thức.');
    const diamonds = [];
    for (let x = -survivalModule.WORLD.radius; x <= survivalModule.WORLD.radius; x += 1) {
        for (let z = -survivalModule.WORLD.radius; z <= survivalModule.WORLD.radius; z += 1) {
            for (let y = survivalModule.WORLD.minY; y <= -3; y += 1) {
                if (survivalModule.allowedBlockTypesAt(x, y, z).has('diamond')) diamonds.push(`${x}:${y}:${z}`);
            }
        }
    }
    if (!diamonds.length) failures.push('Đảo sinh tồn không sinh được kim cương.');
    if (survivalModule.validateMineRequest({ blockType: 'diamond', blockKey: '0:0:0', toolId: 'tool_iron_pickaxe', inventory: ['tool_iron_pickaxe'] }).ok) failures.push('Máy chủ cho phép giả mạo kim cương ở sai tọa độ.');
    if (diamonds.length && survivalModule.validateMineRequest({ blockType: 'diamond', blockKey: diamonds[0], toolId: '', inventory: [] }).ok) failures.push('Máy chủ cho phép đào kim cương bằng tay không.');
    if (diamonds.length && !survivalModule.validateMineRequest({ blockType: 'diamond', blockKey: diamonds[0], toolId: 'tool_iron_pickaxe', inventory: ['tool_iron_pickaxe'] }).ok) failures.push('Cuốc sắt hợp lệ không đào được kim cương.');
    if (survivalModule.validateMineRequest({ blockType: 'stone', blockKey: `0:${survivalModule.WORLD.bedrockY}:0`, toolId: 'tool_wood_pickaxe', inventory: ['tool_wood_pickaxe'] }).ok) failures.push('Lớp đá nền cuối cùng đang bị phá được.');
    const foundationPositions = [];
    for (let x = -survivalModule.WORLD.radius; x <= survivalModule.WORLD.radius; x += 1) {
        for (let z = -survivalModule.WORLD.radius; z <= survivalModule.WORLD.radius; z += 1) {
            for (let y = survivalModule.WORLD.minY; y < survivalModule.WORLD.minY + 2; y += 1) {
                if (survivalModule.allowedBlockTypesAt(x, y, z).has('foundation')) foundationPositions.push(`${x}:${y}:${z}`);
            }
        }
    }
    if (!foundationPositions.length) failures.push('Thế giới V12 không sinh lớp móng đào được.');
    if (foundationPositions.length && !survivalModule.validateMineRequest({ blockType: 'foundation', blockKey: foundationPositions[0], toolId: 'tool_stone_pickaxe', inventory: ['tool_stone_pickaxe'] }).ok) failures.push('Cuốc đá không đào được lớp móng V13.');
    const placeKey = '0:0:0';
    const placeResult = survivalModule.validatePlaceRequest({ itemId: 'survival_stone', blockKey: placeKey, inventory: ['survival_stone'], removedBlocks: [placeKey], placedBlocks: [] });
    if (!placeResult.ok) failures.push(`Không đặt lại được khối vào hố đã đào: ${placeResult.message}`);
    const floating = survivalModule.validatePlaceRequest({ itemId: 'survival_stone', blockKey: '0:15:0', inventory: ['survival_stone'], removedBlocks: [], placedBlocks: [] });
    if (floating.ok) failures.push('Máy chủ cho phép đặt khối lơ lửng không có điểm tựa.');
    const worn = survivalModule.applyToolWear({ inventory: ['tool_wood_pickaxe'], durability: { tool_wood_pickaxe: 1 }, toolId: 'tool_wood_pickaxe' });
    if (!worn.broken || worn.inventory.includes('tool_wood_pickaxe')) failures.push('Độ bền công cụ V13 không làm hỏng công cụ đúng lúc.');
    const advanced = survivalModule.advanceState({ hunger: 100, stamina: 0, health: 100, lastUpdatedAt: new Date(Date.now() - 60000) }, new Date());
    if (!(advanced.hunger < 100 && advanced.stamina > 0)) failures.push('Mô phỏng đói/thể lực phía máy chủ không hoạt động.');

} catch (error) {
    failures.push(`Không kiểm tra được mô-đun sinh tồn V13: ${error.message}`);
}


for (const snippet of ['safeAsyncRoute', 'connectMongoWithRetry', 'DATABASE_RECONNECTING', "app.get('/api/ready'", 'submissionIds']) {
    if (!serverSource.includes(snippet)) failures.push(`Máy chủ V12 thiếu cơ chế ổn định: ${snippet}`);
}
if (serverSource.includes("if (IS_PRODUCTION) process.exit(1)")) failures.push('Máy chủ vẫn có nhánh process.exit khi lỗi cấu hình tạm thời.');

for (const snippet of ['survivalLocks = new Map()', 'survivalActionCooldowns = new Map()', 'advanceSurvivalState', 'validateSurvivalPlace', 'applySurvivalToolWear', 'gracefulShutdown', 'publicFiles']) {
    if (!serverSource.includes(snippet)) failures.push(`Máy chủ V13 thiếu cơ chế ổn định/sinh tồn: ${snippet}`);
}
const learningReliabilitySource = fs.readFileSync(path.join(root, 'assets/learning/learning-v13.js'), 'utf8');
for (const snippet of ['learning-submission-outbox-v13', 'learning:outbox-sent', 'submissionId']) if (!learningReliabilitySource.includes(snippet)) failures.push(`Học tập V13 thiếu hàng chờ nộp bài: ${snippet}`);
const learningPageSource = fs.readFileSync(path.join(root, 'lo-trinh-hoc-tap.html'), 'utf8');
for (const snippet of ['/api/learning/preflight/', 'hanhtrinh:learning-synced', 'clearTestDraft']) if (!learningPageSource.includes(snippet)) failures.push(`Trang lộ trình chưa hoàn tất luồng nộp bài V13: ${snippet}`);

const survivalSource = ['trang-tri-phong.html','assets/room/survival-v13.js','assets/room/survival-v13.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
for (const snippet of ['Sinh tồn', 'survivalBlock', 'survivalBedrock', '/api/survival/mine', 'Bàn chế tạo', 'handleAction']) {
    if (!survivalSource.includes(snippet)) failures.push(`Thế giới sinh tồn V13 thiếu: ${snippet}`);
}
const learningV11Source = ['lo-trinh-hoc-tap.html','assets/learning/learning-v11.js','assets/learning/practical-assessment.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
for (const snippet of ['Kế hoạch cá nhân hóa', 'learning-draft-v12', 'test-submit-status', '/api/learning/preferences', '/api/learning/roadmap', '/api/learning/practical/submit', 'dataset.practicalGate']) {
    if (!learningV11Source.includes(snippet)) failures.push(`Học tập V11 thiếu: ${snippet}`);
}

const boardPages = ['caro.html', 'co-ty-phu.html', 'co-vua.html', 'co-vay.html', 'othello.html'];
for (const boardPage of boardPages) {
    const content = fs.readFileSync(path.join(root, boardPage), 'utf8');
    if (!content.includes('assets/css/games/board-ui.css') || !content.includes('assets/js/games/board-ui.js')) failures.push(`${boardPage}: chưa nạp giao diện bàn cờ responsive V8.`);
}
const boardHubSource = fs.readFileSync(path.join(root, 'choi-co.html'), 'utf8');
for (const href of boardPages) {
    if (!boardHubSource.includes(`href="${href}"`) && !boardHubSource.includes(`href='${href}'`)) failures.push(`Đấu trường cờ thiếu liên kết ${href}`);
}
const tournamentSource = ['giai-dau.html','tournament-v9.css','tournament-v9.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
for (const snippet of ['Trung tâm Giải đấu', 'bracket-scroll', 'Lịch thi đấu cá nhân', 'Vòng bảng', 'Bảng vinh danh']) {
    if (!tournamentSource.includes(snippet)) failures.push(`Giải đấu thiếu giao diện rõ nét: ${snippet}`);
}
for (const snippet of ['Điểm Đấu Trường', '/api/tournaments', 'join-code', 'Tạo giải cộng đồng']) {
    if (!tournamentSource.includes(snippet)) failures.push(`Giải cộng đồng V9 thiếu: ${snippet}`);
}
for (const eventName of ['othelloMove', 'othelloState', 'othelloGameOver']) {
    if (!serverSource.includes(eventName)) failures.push(`Máy chủ thiếu xác thực Othello V8: ${eventName}`);
}


// V14: lỗi tác vụ nền, lý thuyết, chế tạo và bàn cờ.
for (const snippet of ["require('./server/modules/quest-maintenance-v14.js')", 'createQuestExpiryJob', 'scheduleQuestExpiryJob']) {
    if (!serverSource.includes(snippet)) failures.push(`Máy chủ thiếu chống sập nhiệm vụ V14: ${snippet}`);
}
if (serverSource.includes(".select('username score quests');")) failures.push('Bộ quét nhiệm vụ vẫn bỏ sót trường history.');
const questJobSource = fs.readFileSync(path.join(root, 'server/modules/quest-maintenance-v14.js'), 'utf8');
for (const snippet of ["select('username score quests history')", 'Array.isArray(user?.history)', 'finally', 'failedUsers']) if (!questJobSource.includes(snippet)) failures.push(`Tác vụ nhiệm vụ V14 thiếu bảo vệ: ${snippet}`);
const lessonTheorySource = fs.readFileSync(path.join(root, 'server/modules/lesson-theory-v14.js'), 'utf8');
for (const snippet of ['mathematics', 'language', 'english', 'science', 'social', 'digital', 'arts', 'physical']) if (!lessonTheorySource.includes(snippet)) failures.push(`Lý thuyết V14 thiếu nhóm môn: ${snippet}`);
const learningV14Page = fs.readFileSync(path.join(root, 'lo-trinh-hoc-tap.html'), 'utf8');
for (const snippet of ['renderTheoryPack', 'theorySections', 'commonMistakes', 'quickChecks', 'learning-v14.css']) if (!learningV14Page.includes(snippet)) failures.push(`Giao diện lý thuyết V14 thiếu: ${snippet}`);
const survivalV14 = require(path.join(root, 'server/modules/survival-v14.js'));
const easyPickaxe = survivalV14.planCraft({ recipeId: 'wood_pickaxe', inventory: ['survival_log', 'survival_log'], autoCraft: true });
if (!easyPickaxe.ok || !easyPickaxe.inventory.includes('tool_wood_pickaxe')) failures.push('Chế tạo nhanh V14 không tự làm ván/gậy từ gỗ.');
if (survivalV14.planCraft({ recipeId: 'wood_pickaxe', inventory: ['survival_log'], autoCraft: true }).ok) failures.push('Chế tạo V14 cho phép tạo cuốc khi thiếu nguyên liệu.');
const roomV14 = ['trang-tri-phong.html','assets/room/survival-v14.js','assets/room/survival-v14.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
for (const snippet of ['Tự chế tạo nguyên liệu trung gian', 'craft-inventory-v14', 'survival-v14.js', 'survival-v14.css']) if (!roomV14.includes(snippet)) failures.push(`Giao diện chế tạo V14 thiếu: ${snippet}`);
for (const boardPage of boardPages) {
    const content = fs.readFileSync(path.join(root, boardPage), 'utf8');
    if (!content.includes('assets/css/games/board-ui.css') || !content.includes('assets/js/games/board-ui.js')) failures.push(`${boardPage}: chưa nạp bản sửa bàn cờ V14.`);
}
const boardV14Css = fs.readFileSync(path.join(root, 'assets/css/games/board-ui.css'), 'utf8');
for (const snippet of ['#myBoard .clearfix-7da63', '.board .cell', 'min-height:var(--cell)!important', ':has(#main-board)']) if (!boardV14Css.includes(snippet)) failures.push(`CSS bàn cờ V14 thiếu: ${snippet}`);

for (const sourceFile of [...htmlFiles, ...jsFiles.filter(file => file !== 'server.js')]) {
    const content = fs.readFileSync(path.join(root, sourceFile), 'utf8');
    for (const match of content.matchAll(/fetch\(\s*[`'"]([^`'"]+)/g)) {
        const raw = match[1];
        if (!raw.startsWith('/api/') || raw.includes('${')) continue;
        const route = raw.split('?')[0];
        if (!serverRoutes.has(route)) failures.push(`${sourceFile}: API chưa tồn tại ${route}`);
    }
}

if (failures.length) {
    console.error(`❌ Phát hiện ${failures.length} lỗi:\n- ${failures.join('\n- ')}`);
    process.exit(1);
}

console.log(`✅ Kiểm tra V14 thành công: ${htmlFiles.length} trang HTML, ${jsFiles.length} tệp JavaScript, ${serverRoutes.size} API, ${curriculumSummary.grades} lớp, ${curriculumSummary.subjects} lộ trình môn, ${curriculumSummary.lessons} bài học, ${curriculumSummary.lessonQuestions} câu hỏi lộ trình và 21.600+ câu hỏi ngân hàng.`);
