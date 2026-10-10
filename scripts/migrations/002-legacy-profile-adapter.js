'use strict';

/**
 * Explicit, idempotent adapter from the legacy users collection.
 * It only fills platform documents that do not exist yet. Existing platform
 * profile/education/learning documents are never overwritten.
 */
const models = require('../../server/models/platform-models.js');

function pick(source, keys) {
    return Object.fromEntries(keys.filter(key => source[key] !== undefined && source[key] !== null).map(key => [key, source[key]]));
}

async function up({ connection = require('mongoose').connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before running a migration.');
    const users = connection.db.collection('users');
    const before = await users.countDocuments();
    let profilesInserted = 0;
    let educationInserted = 0;
    let learningInserted = 0;
    const cursor = users.find({}, { projection: { username: 1, fullName: 1, dob: 1, parentCode: 1, educationStatus: 1, educationGrade: 1, children: 1, emailVerified: 1, phoneVerified: 1 } });
    for await (const user of cursor) {
        if (!user.username) continue;
        const username = String(user.username);
        const profile = await models.Profile.findOne({ username }).lean();
        if (!profile) {
            await models.Profile.create({ username, ...pick(user, ['fullName', 'dob']), guardianUsername: user.parentCode || '', consent: {} });
            profilesInserted += 1;
        }
        const education = await models.EducationProfile.findOne({ username }).lean();
        if (!education) {
            await models.EducationProfile.create({ username, educationLevel: user.educationStatus || '', grade: user.educationGrade ?? null, educationStatus: user.educationStatus || '' });
            educationInserted += 1;
        }
        const learning = await models.LearningProfile.findOne({ username }).lean();
        if (!learning) {
            await models.LearningProfile.create({ username, goals: [], skills: {}, survey: {}, diagnostics: {} });
            learningInserted += 1;
        }
    }
    const result = { migration: '002-legacy-profile-adapter', legacyUsers: before, profilesInserted, educationInserted, learningInserted };
    logger.log(JSON.stringify(result));
    return result;
}

module.exports = { id: '002-legacy-profile-adapter', up };