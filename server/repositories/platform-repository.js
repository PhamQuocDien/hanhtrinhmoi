'use strict';

class PlatformRepository {
    constructor(Model) {
        if (!Model) throw new Error('PlatformRepository cần một Mongoose model.');
        this.Model = Model;
    }

    list(filter = {}, { page = 1, limit = 25, sort = { createdAt: -1 }, projection = null } = {}, projectionOverride = null) {
        const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
        const query = this.Model.find(filter).sort(sort).skip((safePage - 1) * safeLimit).limit(safeLimit);
        if (projectionOverride || projection) query.select(projectionOverride || projection);
        return Promise.all([query.lean(), this.Model.countDocuments(filter)]).then(([items, total]) => ({
            items, page: safePage, limit: safeLimit, total, totalPages: Math.max(1, Math.ceil(total / safeLimit))
        }));
    }

    getById(id) { return this.Model.findById(id).lean(); }
    create(payload) { return this.Model.create(payload); }
    updateById(id, payload) { return this.Model.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean(); }
    archiveById(id, statusField = 'status') { return this.updateById(id, { $set: { [statusField]: 'ARCHIVED' } }); }
}

module.exports = { PlatformRepository };