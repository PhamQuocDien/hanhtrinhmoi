'use strict';
const assert = require('assert');
const survival = require('../server/modules/survival-v13.js');

function findType(type) {
    for (let x = -survival.WORLD.radius; x <= survival.WORLD.radius; x += 1) {
        for (let z = -survival.WORLD.radius; z <= survival.WORLD.radius; z += 1) {
            for (let y = survival.WORLD.minY; y <= 2; y += 1) {
                if (survival.allowedBlockTypesAt(x, y, z).has(type)) return `${x}:${y}:${z}`;
            }
        }
    }
    return null;
}

const diamond = findType('diamond');
assert(diamond, 'Phải sinh được kim cương.');
assert.strictEqual(survival.validateMineRequest({ blockType: 'diamond', blockKey: diamond, toolId: '', inventory: [] }).ok, false);
assert.strictEqual(survival.validateMineRequest({ blockType: 'diamond', blockKey: diamond, toolId: 'tool_iron_pickaxe', inventory: ['tool_iron_pickaxe'] }).ok, true);
assert.strictEqual(survival.validateMineRequest({ blockType: 'stone', blockKey: `0:${survival.WORLD.bedrockY}:0`, toolId: 'tool_iron_pickaxe', inventory: ['tool_iron_pickaxe'] }).ok, false);

const hole = '0:0:0';
const placed = survival.validatePlaceRequest({ itemId: 'survival_stone', blockKey: hole, inventory: ['survival_stone'], removedBlocks: [hole], placedBlocks: [] });
assert.strictEqual(placed.ok, true, placed.message);
const duplicate = survival.validatePlaceRequest({ itemId: 'survival_stone', blockKey: hole, inventory: ['survival_stone'], removedBlocks: [hole], placedBlocks: [{ key: hole, type: 'stone' }] });
assert.strictEqual(duplicate.ok, false);
const floating = survival.validatePlaceRequest({ itemId: 'survival_stone', blockKey: '0:15:0', inventory: ['survival_stone'], removedBlocks: [], placedBlocks: [] });
assert.strictEqual(floating.ok, false);

const broken = survival.applyToolWear({ inventory: ['tool_wood_pickaxe'], durability: { tool_wood_pickaxe: 1 }, toolId: 'tool_wood_pickaxe' });
assert.strictEqual(broken.broken, true);
assert.strictEqual(broken.inventory.includes('tool_wood_pickaxe'), false);
const spare = survival.applyToolWear({ inventory: ['tool_wood_pickaxe', 'tool_wood_pickaxe'], durability: { tool_wood_pickaxe: 1 }, toolId: 'tool_wood_pickaxe' });
assert.strictEqual(spare.broken, true);
assert.strictEqual(spare.inventory.length, 1);
assert.strictEqual(spare.durability.tool_wood_pickaxe, survival.TOOLS.tool_wood_pickaxe.maxDurability);

const before = new Date(Date.now() - 60_000);
const advanced = survival.advanceState({ health: 100, hunger: 100, stamina: 0, lastUpdatedAt: before }, new Date());
assert(advanced.hunger < 100, 'Đói phải giảm theo thời gian.');
assert(advanced.stamina > 0, 'Thể lực phải hồi theo thời gian.');
assert.strictEqual(advanced.worldVersion, 13);

console.log('✅ Runtime V13: địa hình, đào móng, đặt khối, độ bền và mô phỏng sinh tồn đều đạt.');
