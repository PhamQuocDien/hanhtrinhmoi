'use strict';

const models = require('../../server/models/platform-models.js');
const { seedStarterCatalog, STARTER_COURSES } = require('../../server/services/starter-course-catalog.js');

async function up({ connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before running a migration.');
    const counts = await seedStarterCatalog({ models });
    const result = { migration: '006-ai-starter-catalog', catalogVersion: '17.0.0', starterCourseDefinitions: STARTER_COURSES.length, ...counts };
    logger.log(JSON.stringify(result));
    return result;
}

module.exports = { id: '006-ai-starter-catalog', up };
