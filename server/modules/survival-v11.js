'use strict';

// V12: thế giới sinh tồn nhiều tầng. Mọi lớp từ cỏ tới móng sâu đều đào được;
// chỉ lớp đá nền cuối cùng không thể phá để giữ người chơi trong thế giới.
const WORLD = Object.freeze({ radius: 7, minY: -12, bedrockY: -13, version: 12 });

const BLOCKS = Object.freeze({
    grass: { drop: 'floor_grass', xp: 1, tier: 0 },
    dirt: { drop: 'floor_dirt', xp: 1, tier: 0 },
    stone: { drop: 'survival_stone', xp: 2, tier: 1 },
    deepstone: { drop: 'survival_deepslate', xp: 3, tier: 1 },
    foundation: { drop: 'survival_deepslate', xp: 5, tier: 2 },
    coal: { drop: 'voxel_coal', xp: 3, tier: 1 },
    iron: { drop: 'voxel_iron', xp: 5, tier: 1 },
    copper: { drop: 'voxel_copper', xp: 4, tier: 1 },
    gold: { drop: 'voxel_gold', xp: 8, tier: 2 },
    emerald: { drop: 'voxel_emerald', xp: 12, tier: 2 },
    diamond: { drop: 'voxel_diamond', xp: 18, tier: 3 },
    amethyst: { drop: 'voxel_amethyst', xp: 14, tier: 2 },
    log: { drop: 'survival_log', xp: 2, tier: 0 },
    leaves: { drop: 'survival_berry', xp: 1, tier: 0, chance: 0.35 }
});

const TOOLS = Object.freeze({
    '': { tier: 0 },
    tool_wood_pickaxe: { tier: 1 },
    tool_stone_pickaxe: { tier: 2 },
    tool_iron_pickaxe: { tier: 3 }
});

const RECIPES = Object.freeze({
    wood_pickaxe: { output: 'tool_wood_pickaxe', quantity: 1, ingredients: { survival_log: 3 } },
    stone_pickaxe: { output: 'tool_stone_pickaxe', quantity: 1, ingredients: { survival_log: 2, survival_stone: 3 } },
    iron_pickaxe: { output: 'tool_iron_pickaxe', quantity: 1, ingredients: { survival_log: 2, voxel_iron: 3 } },
    torch: { output: 'survival_torch', quantity: 4, ingredients: { survival_log: 1, voxel_coal: 1 } },
    bread: { output: 'survival_bread', quantity: 1, ingredients: { survival_berry: 3 } }
});

function hash(x, y, z) {
    let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967295;
}

function columnExists(gx, gz) {
    if (!Number.isInteger(gx) || !Number.isInteger(gz)) return false;
    const edge = Math.max(Math.abs(gx), Math.abs(gz));
    if (edge > WORLD.radius) return false;
    return !(edge === WORLD.radius && hash(gx, 3, gz) > 0.62);
}

function topLevel(gx, gz) {
    const n = hash(gx, 19, gz);
    return n > 0.82 ? 2 : n > 0.48 ? 1 : 0;
}

function isCaveAt(gx, gy, gz) {
    if (gy > -2 || gy <= WORLD.minY + 1) return false;
    const primary = hash(gx * 3 + gy, gy * 5 - gz, gz * 3 - gx);
    const secondary = hash(gx + 91, gy - 37, gz + 53);
    return primary > 0.89 && secondary > 0.34;
}

function terrainTypeAt(gx, gy, gz) {
    if (!columnExists(gx, gz)) return null;
    const top = topLevel(gx, gz);
    if (gy < WORLD.minY || gy > top) return null;
    if (gy === top) return 'grass';
    if (gy >= top - 2) return 'dirt';
    if (isCaveAt(gx, gy, gz)) return null;
    const r = hash(gx, gy, gz);
    if (gy <= -8 && r > 0.985) return 'diamond';
    if (gy <= -6 && r > 0.971) return 'emerald';
    if (gy <= -5 && r > 0.948) return 'amethyst';
    if (gy <= -4 && r > 0.91) return 'gold';
    if (gy <= -3 && r > 0.84) return 'iron';
    if (gy <= -2 && r > 0.76) return 'copper';
    if (r > 0.64) return 'coal';
    if (gy <= WORLD.minY + 1) return 'foundation';
    if (gy <= -7) return 'deepstone';
    return 'stone';
}

function treeAt(cx, cz) {
    if (!columnExists(cx, cz)) return null;
    const edge = Math.max(Math.abs(cx), Math.abs(cz));
    if (edge >= WORLD.radius - 2 || (Math.abs(cx) < 2 && Math.abs(cz) < 2)) return null;
    const base = topLevel(cx, cz);
    if (base < 0 || hash(cx, 41, cz) <= 0.92 || hash(cx, 77, cz) < 0.72) return null;
    return { base, height: 3 + (hash(cx, 78, cz) > 0.65 ? 1 : 0) };
}

function treeTypesAt(gx, gy, gz) {
    const types = new Set();
    for (let cx = gx - 1; cx <= gx + 1; cx += 1) {
        for (let cz = gz - 1; cz <= gz + 1; cz += 1) {
            const tree = treeAt(cx, cz);
            if (!tree) continue;
            if (gx === cx && gz === cz && gy >= tree.base + 1 && gy <= tree.base + tree.height) types.add('log');
            const dx = gx - cx;
            const dz = gz - cz;
            for (let dy = tree.height - 1; dy <= tree.height + 1; dy += 1) {
                if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - tree.height) > 3) continue;
                if (gy === tree.base + dy + 1) types.add('leaves');
            }
        }
    }
    return types;
}

function allowedBlockTypesAt(gx, gy, gz) {
    const types = new Set();
    const terrain = terrainTypeAt(gx, gy, gz);
    if (terrain) types.add(terrain);
    for (const type of treeTypesAt(gx, gy, gz)) types.add(type);
    return types;
}

function parseBlockKey(value) {
    const text = String(value || '');
    if (!/^-?\d+:-?\d+:-?\d+$/.test(text) || text.length > 50) return null;
    const [gx, gy, gz] = text.split(':').map(Number);
    if (![gx, gy, gz].every(Number.isSafeInteger)) return null;
    return { gx, gy, gz };
}

function validateMineRequest({ blockType, blockKey, toolId, inventory = [] }) {
    const position = parseBlockKey(blockKey);
    const block = BLOCKS[blockType];
    const tool = TOOLS[toolId];
    if (!position || !block || !tool) return { ok: false, message: 'Khối hoặc công cụ sinh tồn không hợp lệ.' };
    if (position.gy <= WORLD.bedrockY) return { ok: false, message: 'Đây là lớp đá nền cuối cùng, không thể phá.' };
    if (!allowedBlockTypesAt(position.gx, position.gy, position.gz).has(blockType)) return { ok: false, message: 'Loại khối không khớp với địa hình máy chủ.' };
    if (toolId && !inventory.includes(toolId)) return { ok: false, message: 'Bạn không sở hữu công cụ đang sử dụng.' };
    if (tool.tier < block.tier) return { ok: false, message: `Cần công cụ bậc ${block.tier} để khai thác khối này.` };
    return { ok: true, position, block, tool };
}

function safeState(source = {}) {
    return {
        health: Math.max(0, Math.min(100, Number(source.health ?? 100))),
        hunger: Math.max(0, Math.min(100, Number(source.hunger ?? 100))),
        stamina: Math.max(0, Math.min(100, Number(source.stamina ?? 100))),
        xp: Math.max(0, Number(source.xp) || 0),
        level: Math.max(1, Number(source.level) || 1),
        deaths: Math.max(0, Number(source.deaths) || 0),
        equippedTool: String(source.equippedTool || '').slice(0, 50),
        removedBlocks: Array.isArray(source.removedBlocks) ? source.removedBlocks.slice(-12000) : [],
        lastUpdatedAt: source.lastUpdatedAt || null,
        worldVersion: WORLD.version
    };
}

function levelFromXp(xp) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 25)) + 1);
}

function countInventory(items = []) {
    return items.reduce((out, id) => {
        out[id] = (out[id] || 0) + 1;
        return out;
    }, {});
}

module.exports = {
    WORLD,
    BLOCKS,
    TOOLS,
    RECIPES,
    hash,
    topLevel,
    isCaveAt,
    terrainTypeAt,
    allowedBlockTypesAt,
    parseBlockKey,
    validateMineRequest,
    safeState,
    levelFromXp,
    countInventory
};
