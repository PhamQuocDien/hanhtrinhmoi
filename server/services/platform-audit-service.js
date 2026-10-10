'use strict';

function createAuditEntry({ req, actor, action, entityType, entityId, before = null, after = null }) {
    return { actorId: actor?._id || null, actorUsername: actor?.username || req?.session?.user?.username || '', action, entityType, entityId: entityId ? String(entityId) : '', before, after, ip: req?.ip || '', userAgent: String(req?.get?.('user-agent') || '').slice(0, 500) };
}

async function writeAudit(AuditLog, entry) { if (!AuditLog) return null; return AuditLog.create(entry); }

module.exports = { createAuditEntry, writeAudit };