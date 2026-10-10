'use strict';

const mongoose = require('mongoose');

function isObjectId(value) {
    return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function safePatch(value, depth = 0) {
    if (depth > 6) return undefined;
    if (Array.isArray(value)) return value.slice(0, 200).map(item => safePatch(item, depth + 1)).filter(item => item !== undefined);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !key.startsWith('$') && !key.includes('.'))
        .slice(0, 200)
        .map(([key, item]) => [key, safePatch(item, depth + 1)]));
}

function registerPlatformCatalogRoutes({ router, models, repositories, guarded, audit, ok, fail, parsePage, cleanText }) {
    const resources = [
        ['Achievement', 'achievements', 'gamification.manage', 'status', 'ACTIVE'],
        ['Reward', 'rewards', 'gamification.manage', 'status', 'ACTIVE'],
        ['EnglishTestConfig', 'english-configs', 'english.toeic.manage', 'status', 'ACTIVE']
    ];

    for (const [modelName, pathName, permission, statusField, publishedStatus = 'PUBLISHED'] of resources) {
        const Model = models[modelName];
        const repository = repositories[modelName];
        if (!Model || !repository) continue;

        router.get(`/admin/platform/${pathName}`, guarded(permission), async (req, res, next) => {
            try {
                const filter = {};
                if (req.query.status) filter[statusField] = cleanText(req.query.status, 30);
                else filter[statusField] = { $ne: 'ARCHIVED' };
                if (req.query.search) {
                    const search = cleanText(req.query.search, 100);
                    filter.$or = [{ code: new RegExp(search, 'i') }, { name: new RegExp(search, 'i') }, { title: new RegExp(search, 'i') }];
                }
                return ok(res, await repository.list(filter, parsePage(req)));
            } catch (error) { return next(error); }
        });

        router.post(`/admin/platform/${pathName}`, guarded(permission), async (req, res, next) => {
            try {
                const body = safePatch(req.body || {});
                if (!body.code && !body.title && !body.name) return fail(res, 400, 'VALIDATION_ERROR', 'Dữ liệu cần code, title hoặc name.');
                const item = await repository.create(body);
                await audit(req, 'CREATE', modelName, item._id, null, item.toObject());
                return res.status(201).json({ success: true, data: item, message: `Đã tạo ${pathName}.` });
            } catch (error) { return next(error); }
        });

        router.patch(`/admin/platform/${pathName}/:id`, guarded(permission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu không hợp lệ.');
                const before = await Model.findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
                const changes = safePatch(req.body || {});
                delete changes._id; delete changes.createdAt; delete changes.updatedAt;
                const item = await repository.updateById(req.params.id, { $set: changes });
                await audit(req, 'UPDATE', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã cập nhật dữ liệu catalog.');
            } catch (error) { return next(error); }
        });

        router.post(`/admin/platform/${pathName}/:id/publish`, guarded(permission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu không hợp lệ.');
                const before = await Model.findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
                const item = await repository.updateById(req.params.id, { $set: { [statusField]: publishedStatus } });
                await audit(req, 'PUBLISH', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã publish dữ liệu catalog.');
            } catch (error) { return next(error); }
        });

        router.delete(`/admin/platform/${pathName}/:id`, guarded(permission), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã dữ liệu không hợp lệ.');
                const before = await Model.findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
                const item = await repository.updateById(req.params.id, { $set: { [statusField]: 'ARCHIVED' } });
                await audit(req, 'ARCHIVE', modelName, req.params.id, before, item);
                return ok(res, item, 'Đã archive dữ liệu catalog.');
            } catch (error) { return next(error); }
        });
    }

    const wordImportModel = models.WordImport;
    const wordImportRepository = repositories.WordImport;
    if (wordImportModel && wordImportRepository) {
        router.get('/admin/platform/word-imports', guarded('learning.question.import'), async (req, res, next) => {
            try { return ok(res, await wordImportRepository.list({}, parsePage(req))); } catch (error) { return next(error); }
        });
        router.patch('/admin/platform/word-imports/:id', guarded('learning.question.import'), async (req, res, next) => {
            try {
                if (!isObjectId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'Mã import không hợp lệ.');
                const before = await wordImportModel.findById(req.params.id).lean();
                if (!before) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy staging import.');
                const changes = safePatch(req.body || {});
                delete changes._id; delete changes.createdAt; delete changes.updatedAt; delete changes.committedEntityIds;
                const item = await wordImportRepository.updateById(req.params.id, { $set: changes });
                await audit(req, 'UPDATE', 'WordImport', req.params.id, before, item);
                return ok(res, item, 'Đã cập nhật staging import.');
            } catch (error) { return next(error); }
        });
    }
}

module.exports = { registerPlatformCatalogRoutes };