'use strict';

/** Queue an idempotent background job only once. Existing FAILED jobs are not silently
 * reset on every page visit; an operator must explicitly retry them after fixing quota/config. */
async function queueGenerationJob(models, data = {}) {
    if (!models?.AIGenerationJob || !data.idempotencyKey || !data.type) return null;
    const existing = await models.AIGenerationJob.findOne({ idempotencyKey: data.idempotencyKey }).select('status attempts nextRunAt error _id').lean();
    if (existing) return { ...existing, reused: true };
    try {
        const created = await models.AIGenerationJob.create({ status: 'QUEUED', priority: 10, progress: 0, currentStep: 'QUEUED', attempts: 0, nextRunAt: new Date(), error: {}, ...data });
        return { _id: created._id, status: created.status, attempts: created.attempts, nextRunAt: created.nextRunAt, reused: false };
    } catch (error) {
        if (error?.code !== 11000) throw error;
        const raced = await models.AIGenerationJob.findOne({ idempotencyKey: data.idempotencyKey }).select('status attempts nextRunAt error _id').lean();
        if (raced) return { ...raced, reused: true };
        throw error;
    }
}

module.exports = { queueGenerationJob };
