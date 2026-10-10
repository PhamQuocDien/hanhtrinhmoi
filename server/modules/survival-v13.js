'use strict';

// V13: mô phỏng sinh tồn có thẩm quyền phía máy chủ.
// Địa hình tự sinh cố định, khối đào/đặt được lưu, thể lực–đói–máu và độ bền công cụ
// không còn tin trực tiếp vào dữ liệu do trình duyệt gửi lên.
const WORLD = Object.freeze({ radius: 7, minY: -12, bedrockY: -13, version: 13, maxChangedBlocks: 12000 });

const BLOCKS = Object.freeze({
    grass: { drop: 'floor_grass', xp: 1, tier: 0, staminaCost: 1.5 },
    dirt: { drop: 'floor_dirt', xp: 1, tier: 0, staminaCost: 1.5 },
    stone: { drop: 'survival_stone', xp: 2, tier: 1, staminaCost: 2.5 },
    deepstone: { drop: 'survival_deepslate', xp: 3, tier: 1, staminaCost: 3 },
    foundation: { drop: 'survival_deepslate', xp: 5, tier: 2, staminaCost: 4 },
    coal: { drop: 'voxel_coal', xp: 3, tier: 1, staminaCost: 2.5 },
    iron: { drop: 'voxel_iron', xp: 5, tier: 1, staminaCost: 3 },
    copper: { drop: 'voxel_copper', xp: 4, tier: 1, staminaCost: 2.5 },
    gold: { drop: 'voxel_gold', xp: 8, tier: 2, staminaCost: 4 },
    emerald: { drop: 'voxel_emerald', xp: 12, tier: 2, staminaCost: 4.5 },
    diamond: { drop: 'voxel_diamond', xp: 18, tier: 3, staminaCost: 5 },
    amethyst: { drop: 'voxel_amethyst', xp: 14, tier: 2, staminaCost: 4.5 },
    log: { drop: 'survival_log', xp: 2, tier: 0, staminaCost: 2 },
    leaves: { drop: 'survival_berry', xp: 1, tier: 0, staminaCost: 1, chance: 0.35 }
});

const TOOLS = Object.freeze({
    '': { tier: 0, maxDurability: 0, wear: 0 },
    tool_wood_pickaxe: { tier: 1, maxDurability: 60, wear: 1 },
    tool_stone_pickaxe: { tier: 2, maxDurability: 132, wear: 1 },
    tool_iron_pickaxe: { tier: 3, maxDurability: 251, wear: 1 }
});

const PLACEABLE = Object.freeze({
    floor_grass: { blockType: 'grass' },
    floor_dirt: { blockType: 'dirt' },
    survival_stone: { blockType: 'stone' },
    survival_deepslate: { blockType: 'deepstone' },
    survival_log: { blockType: 'log' },
    survival_torch: { blockType: 'torch', noCollision: true }
});

const PLACED_BLOCKS = Object.freeze({
    grass: { drop: 'floor_grass', xp: 0, tier: 0, staminaCost: 1 },
    dirt: { drop: 'floor_dirt', xp: 0, tier: 0, staminaCost: 1 },
    stone: { drop: 'survival_stone', xp: 0, tier: 1, staminaCost: 2 },
    deepstone: { drop: 'survival_deepslate', xp: 0, tier: 1, staminaCost: 2.5 },
    log: { drop: 'survival_log', xp: 0, tier: 0, staminaCost: 1.5 },
    torch: { drop: 'survival_torch', xp: 0, tier: 0, staminaCost: 0.5 }
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
    return { gx, gy, gz, key: `${gx}:${gy}:${gz}` };
}

function normalizePlacedBlocks(items = []) {
    const seen = new Set();
    const output = [];
    for (const item of Array.isArray(items) ? items : []) {
        const position = parseBlockKey(item?.key);
        const type = String(item?.type || '');
        if (!position || !PLACED_BLOCKS[type] || seen.has(position.key)) continue;
        if (Math.max(Math.abs(position.gx), Math.abs(position.gz)) > WORLD.radius + 2) continue;
        if (position.gy <= WORLD.bedrockY || position.gy > 16) continue;
        seen.add(position.key);
        output.push({ key: position.key, type, placedAt: item?.placedAt || null });
        if (output.length >= WORLD.maxChangedBlocks) break;
    }
    return output;
}

function normalizeToolDurability(value = {}) {
    const output = {};
    for (const [toolId, config] of Object.entries(TOOLS)) {
        if (!toolId) continue;
        const number = Number(value?.[toolId]);
        output[toolId] = Number.isFinite(number) ? Math.max(0, Math.min(config.maxDurability, Math.round(number))) : config.maxDurability;
    }
    return output;
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
        removedBlocks: Array.isArray(source.removedBlocks) ? source.removedBlocks.slice(-WORLD.maxChangedBlocks) : [],
        placedBlocks: normalizePlacedBlocks(source.placedBlocks),
        toolDurability: normalizeToolDurability(source.toolDurability),
        lastUpdatedAt: source.lastUpdatedAt || null,
        lastResetAt: source.lastResetAt || null,
        worldVersion: WORLD.version
    };
}

function advanceState(source = {}, now = new Date()) {
    const state = safeState(source);
    const previous = new Date(state.lastUpdatedAt || now);
    const elapsedSeconds = Math.max(0, Math.min(3600, (now.getTime() - previous.getTime()) / 1000));
    // Ngoại tuyến tối đa một giờ được mô phỏng để tránh trẻ quay lại và mất sạch trạng thái.
    state.hunger = Math.max(0, state.hunger - elapsedSeconds * 0.0035);
    state.stamina = Math.min(100, state.stamina + elapsedSeconds * 0.8);
    if (state.hunger <= 0) state.health = Math.max(1, state.health - elapsedSeconds * 0.02);
    else if (state.hunger >= 72) state.health = Math.min(100, state.health + elapsedSeconds * 0.01);
    state.lastUpdatedAt = now;
    return state;
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

function naturalBlockPresent(position, removedSet = new Set()) {
    return !removedSet.has(position.key) && allowedBlockTypesAt(position.gx, position.gy, position.gz).size > 0;
}

function validateMineRequest({ blockType, blockKey, toolId, inventory = [], placedBlock = null }) {
    const position = parseBlockKey(blockKey);
    const block = placedBlock ? PLACED_BLOCKS[placedBlock.type] : BLOCKS[blockType];
    const effectiveType = placedBlock ? placedBlock.type : blockType;
    const tool = TOOLS[toolId];
    if (!position || !block || !tool) return { ok: false, message: 'Khối hoặc công cụ sinh tồn không hợp lệ.' };
    if (position.gy <= WORLD.bedrockY) return { ok: false, message: 'Đây là lớp đá nền cuối cùng, không thể phá.' };
    if (!placedBlock && !allowedBlockTypesAt(position.gx, position.gy, position.gz).has(blockType)) return { ok: false, message: 'Loại khối không khớp với địa hình máy chủ.' };
    if (placedBlock && placedBlock.key !== position.key) return { ok: false, message: 'Khối đã đặt không khớp vị trí.' };
    if (toolId && !inventory.includes(toolId)) return { ok: false, message: 'Bạn không sở hữu công cụ đang sử dụng.' };
    if (tool.tier < block.tier) return { ok: false, message: `Cần công cụ bậc ${block.tier} để khai thác khối này.` };
    return { ok: true, position, block, tool, effectiveType, placed: Boolean(placedBlock) };
}

function hasSupport(position, removedSet, placedMap) {
    const neighbors = [
        [position.gx, position.gy - 1, position.gz],
        [position.gx + 1, position.gy, position.gz],
        [position.gx - 1, position.gy, position.gz],
        [position.gx, position.gy, position.gz + 1],
        [position.gx, position.gy, position.gz - 1]
    ];
    return neighbors.some(([gx, gy, gz]) => {
        const key = `${gx}:${gy}:${gz}`;
        if (placedMap.has(key)) return true;
        if (gy === WORLD.bedrockY && columnExists(gx, gz)) return true;
        return naturalBlockPresent({ gx, gy, gz, key }, removedSet);
    });
}

function validatePlaceRequest({ itemId, blockKey, inventory = [], removedBlocks = [], placedBlocks = [] }) {
    const position = parseBlockKey(blockKey);
    const config = PLACEABLE[itemId];
    if (!position || !config) return { ok: false, message: 'Vật phẩm hoặc vị trí đặt không hợp lệ.' };
    if (!inventory.includes(itemId)) return { ok: false, message: 'Ba lô không còn vật phẩm này.' };
    if (position.gy <= WORLD.bedrockY || position.gy > 16) return { ok: false, message: 'Không thể đặt khối tại độ cao này.' };
    if (Math.max(Math.abs(position.gx), Math.abs(position.gz)) > WORLD.radius + 2) return { ok: false, message: 'Vị trí nằm ngoài khu sinh tồn.' };
    const removedSet = new Set(Array.isArray(removedBlocks) ? removedBlocks : []);
    const normalized = normalizePlacedBlocks(placedBlocks);
    const placedMap = new Map(normalized.map(item => [item.key, item]));
    if (placedMap.has(position.key)) return { ok: false, message: 'Vị trí này đã có khối do người chơi đặt.' };
    if (naturalBlockPresent(position, removedSet)) return { ok: false, message: 'Vị trí này vẫn có khối tự nhiên.' };
    if (!hasSupport(position, removedSet, placedMap)) return { ok: false, message: 'Khối cần được đặt sát nền hoặc một khối khác.' };
    return { ok: true, position, blockType: config.blockType, placedBlocks: normalized };
}

function applyToolWear({ inventory = [], durability = {}, toolId = '' }) {
    const nextInventory = [...inventory];
    const nextDurability = normalizeToolDurability(durability);
    const config = TOOLS[toolId];
    if (!toolId || !config || !nextInventory.includes(toolId)) return { inventory: nextInventory, durability: nextDurability, broken: false, remaining: 0 };
    const current = Number.isFinite(Number(nextDurability[toolId])) ? Number(nextDurability[toolId]) : config.maxDurability;
    let remaining = Math.max(0, current - config.wear);
    let broken = false;
    if (remaining <= 0) {
        broken = true;
        const index = nextInventory.indexOf(toolId);
        if (index >= 0) nextInventory.splice(index, 1);
        remaining = nextInventory.includes(toolId) ? config.maxDurability : 0;
    }
    nextDurability[toolId] = remaining;
    return { inventory: nextInventory, durability: nextDurability, broken, remaining };
}

module.exports = {
    WORLD,
    BLOCKS,
    PLACED_BLOCKS,
    PLACEABLE,
    TOOLS,
    RECIPES,
    hash,
    topLevel,
    isCaveAt,
    terrainTypeAt,
    allowedBlockTypesAt,
    parseBlockKey,
    normalizePlacedBlocks,
    normalizeToolDurability,
    safeState,
    advanceState,
    levelFromXp,
    countInventory,
    validateMineRequest,
    validatePlaceRequest,
    applyToolWear
};
