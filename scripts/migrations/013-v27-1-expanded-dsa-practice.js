'use strict';

const { buildAlgorithmTaskSeeds, validatePracticeTask } = require('../../server/services/learning-system-v27.js');

const EXPANDED_CODES = new Set([
    'DSA-DAC-MERGE-SORT-016',
    'DSA-DAC-MAX-SUBARRAY-017',
    'DSA-DAC-COUNT-INVERSIONS-018'
]);

async function up({ connection, logger = console } = {}) {
    const models = require('../../server/models/platform-models.js');
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB must be connected before migration 013.');
    await models.PracticeTask.createCollection().catch(error => {
        if (error?.codeName !== 'NamespaceExists' && error?.code !== 48) throw error;
    });
    const candidates = buildAlgorithmTaskSeeds().filter(task => EXPANDED_CODES.has(task.code));
    if (candidates.length !== EXPANDED_CODES.size) throw new Error('Migration 013 does not define all expanded D&C practice tasks.');
    let added = 0;
    for (const candidate of candidates) {
        const checked = validatePracticeTask(candidate);
        if (!checked.valid) throw new Error(`${candidate.code} failed validation: ${checked.errors.join('; ')}`);
        const existing = await models.PracticeTask.findOne({ code: candidate.code });
        if (existing) continue;
        await models.PracticeTask.create(checked.task);
        added += 1;
    }
    logger.info?.(`Migration 013: expanded D&C practice tasks added=${added}.`);
    return { candidateCount: candidates.length, added, codes: candidates.map(task => task.code) };
}

module.exports = { id: '013-v27-1-expanded-dsa-practice', up, EXPANDED_CODES };
