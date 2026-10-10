'use strict';

const migrations = [
    require('./001-platform-collections.js'),
    require('./002-legacy-profile-adapter.js'),
    require('./003-legacy-notification-adapter.js'),
    require('./004-learning-content-migration.js'),
    require('./005-platform-catalog-completion.js'),
    require('./006-ai-starter-catalog.js'),
    require('./007-v18-course-engine.js'),
    require('./008-v18-academic-catalog.js'),
    require('./010-v20-full-learning-content.js'),
    require('./011-v21-survey-placement.js'),
    require('./012-v27-typed-learning-system.js'),
    require('./013-v27-1-expanded-dsa-practice.js')
];

async function run({ connection, logger = console, stopOnError = true } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('A ready MongoDB connection is required.');
    const results = [];
    for (const migration of migrations) {
        try {
            results.push({ id: migration.id, ok: true, result: await migration.up({ connection, logger }) });
        } catch (error) {
            results.push({ id: migration.id, ok: false, error: error?.message || String(error) });
            logger.error?.(`⚠️ Migration ${migration.id} thất bại${stopOnError ? '; đã dừng để tránh chạy migration phụ thuộc trên schema lỗi' : '; tiếp tục theo cấu hình phục hồi'}: ${error?.message || error}`);
            if (stopOnError) break;
        }
    }
    return results;
}

module.exports = { migrations, run };