'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { applyExpiredQuestPenalties, createQuestExpiryJob } = require('../server/modules/quest-maintenance-v14.js');
const curriculum = require('../curriculum-data.js');
const survival = require('../server/modules/survival-v14.js');

async function testQuestJob() {
    const user = { username: 'be1', score: 30, quests: [{ id: 'q1', taskType: 'Học', startTime: new Date(Date.now() - 120000), timeLimit: 30, penalty: 7 }], history: undefined };
    const result = applyExpiredQuestPenalties(user, Date.now());
    assert.strictEqual(result.changed, true);
    assert.strictEqual(user.quests.length, 0);
    assert.strictEqual(user.score, 23);
    assert(Array.isArray(user.history) && user.history.length === 1);

    const saved = [];
    const users = [
        { username: 'loi', score: 10, quests: [{ taskType: 'A', startTime: new Date(Date.now() - 60000), timeLimit: 1, penalty: 1 }], history: [], markModified() {}, async save() { throw new Error('save test'); } },
        { username: 'tot', score: 10, quests: [{ taskType: 'B', startTime: new Date(Date.now() - 60000), timeLimit: 1, penalty: 2 }], history: [], markModified() {}, async save() { saved.push(this.username); } }
    ];
    let selected = '';
    const User = { find() { return { select(value) { selected = value; return this; }, limit() { return Promise.resolve(users); } }; } };
    const logs = [];
    const job = createQuestExpiryJob({ User, io: { to() { return { emit() {} }; } }, onlineUsers: {}, logger: { error: (...args) => logs.push(args) } });
    const summary = await job(Date.now());
    assert(selected.includes('history'), 'Truy vấn nhiệm vụ phải lấy trường history.');
    assert(saved.includes('tot'), 'Lỗi một tài khoản không được chặn tài khoản tiếp theo.');
    assert(summary.failedUsers >= 1);
}

function testTheory() {
    let lessons = 0;
    const signatures = new Set();
    for (let grade = 1; grade <= 12; grade += 1) {
        const catalog = curriculum.getCatalog(grade);
        for (const subject of catalog.subjects) {
            const full = curriculum.getSubject(grade, subject.id, { includeLessons: true });
            for (const lesson of full.lessons) {
                lessons += 1;
                assert(Array.isArray(lesson.theory) && lesson.theory.length >= 2, `${subject.name} ${lesson.id} thiếu lý thuyết.`);
                assert(Array.isArray(lesson.theorySections) && lesson.theorySections.length >= 3, `${subject.name} ${lesson.id} thiếu mục lý thuyết.`);
                assert(lesson.theorySections.every(section => section.title && Array.isArray(section.bullets) && section.bullets.length >= 2));
                assert(Array.isArray(lesson.commonMistakes) && lesson.commonMistakes.length >= 3);
                assert(Array.isArray(lesson.quickChecks) && lesson.quickChecks.length >= 3);
                signatures.add(`${subject.id}:${lesson.theorySections[0].title}`);
            }
        }
    }
    assert(lessons >= 2900, 'Số bài lý thuyết quá ít.');
    assert(signatures.size >= 20, 'Lý thuyết giữa các môn chưa đủ khác biệt.');
}

function testCrafting() {
    const auto = survival.planCraft({ recipeId: 'wood_pickaxe', inventory: ['survival_log', 'survival_log'], autoCraft: true });
    assert.strictEqual(auto.ok, true, auto.message);
    assert(auto.inventory.includes('tool_wood_pickaxe'));
    assert(auto.operations.some(item => item.recipeId === 'planks'));
    assert(auto.operations.some(item => item.recipeId === 'sticks'));
    const manual = survival.planCraft({ recipeId: 'wood_pickaxe', inventory: ['survival_log', 'survival_log'], autoCraft: false });
    assert.strictEqual(manual.ok, false);
    const stone = survival.planCraft({ recipeId: 'stone_pickaxe', inventory: ['survival_log', 'survival_stone', 'survival_stone', 'survival_stone'], autoCraft: true });
    assert.strictEqual(stone.ok, true, stone.message);
    assert(stone.inventory.includes('tool_stone_pickaxe'));
}

function testBoardCss() {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'assets/css/games/board-ui.css'), 'utf8');
    assert(css.includes('.board .cell') && css.includes('min-height:var(--cell)!important'));
    assert(css.includes('#myBoard .clearfix-7da63'));
    for (const page of ['caro.html', 'co-vua.html', 'co-vay.html', 'co-ty-phu.html', 'othello.html']) {
        const html = fs.readFileSync(path.join(root, page), 'utf8');
        assert(html.includes('assets/css/games/board-ui.css') && html.includes('assets/js/games/board-ui.js'), `${page} chưa nạp sửa bàn cờ V14.`);
    }
}

(async () => {
    await testQuestJob();
    testTheory();
    testCrafting();
    testBoardCss();
    console.log('✅ Runtime V14: chống sập nhiệm vụ, lý thuyết theo môn, chế tạo tự động và bàn cờ responsive đều đạt.');
})().catch(error => { console.error(error); process.exit(1); });
