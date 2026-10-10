'use strict';

/**
 * RBAC skeleton (Phase 2 — mục 36).
 * - Quyền kiểm ở BACKEND; localStorage.role chỉ dùng để hiển thị.
 * - Role cũ (child/parent/admin) vẫn hợp lệ 100% — behavior của requireAdmin
 *   được giữ nguyên khi ủy quyền qua permission map.
 */

const ROLES = ['child', 'parent', 'admin', 'teacher', 'content_editor', 'exam_manager', 'super_admin'];

const PERMISSIONS = [
    'learning.lesson.read', 'learning.lesson.create', 'learning.lesson.update', 'learning.lesson.publish',
    'learning.curriculum.manage', 'learning.path.manage', 'learning.ai.manage', 'learning.personalization.manage',
    'learning.question.read', 'learning.question.create', 'learning.question.update', 'learning.question.import',
    'learning.exam.create', 'learning.exam.publish',
    'learning.survey.manage', 'learning.placement.manage',
    'university.manage',
    'english.toeic.manage', 'english.ielts.manage',
    'user.manage', 'user.read',
    'gamification.manage', 'notification.manage',
    'system.manage', 'system.audit.read'
];

const LEARNER_TEACHING_PERMISSIONS = [
    'learning.lesson.read', 'learning.question.read'
];

const CONTENT_PERMISSIONS = [
    'learning.lesson.read', 'learning.lesson.create', 'learning.lesson.update', 'learning.lesson.publish',
    'learning.curriculum.manage', 'learning.path.manage', 'learning.ai.manage', 'learning.personalization.manage',
    'learning.question.read', 'learning.question.create', 'learning.question.update', 'learning.question.import',
    'learning.exam.create', 'learning.exam.publish',
    'learning.survey.manage', 'learning.placement.manage',
    'english.toeic.manage', 'english.ielts.manage'
];

const ROLE_PERMISSIONS = {
    child: [...LEARNER_TEACHING_PERMISSIONS],
    parent: [...LEARNER_TEACHING_PERMISSIONS, 'user.read'],
    teacher: [...CONTENT_PERMISSIONS, 'user.read', 'learning.placement.manage'],
    content_editor: [...CONTENT_PERMISSIONS],
    exam_manager: [...CONTENT_PERMISSIONS, 'learning.exam.publish'],
    admin: [
        ...CONTENT_PERMISSIONS,
        'user.manage', 'user.read', 'university.manage',
        'gamification.manage', 'notification.manage',
        'system.manage', 'system.audit.read'
    ],
    super_admin: [...PERMISSIONS]
};

function hasPermission(role, permission) {
    const granted = ROLE_PERMISSIONS[role];
    if (!Array.isArray(granted)) return false;
    if (granted.includes(permission)) return true;
    // super_admin được toàn quyền kể cả quyền lạ (forward-compatible)
    return role === 'super_admin';
}

/** Middleware factory: requirePermission('learning.lesson.publish') */
function requirePermission(permission) {
    return function permissionGuard(req, res, next) {
        if (!req.session?.user) {
            return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' });
        }
        if (!hasPermission(req.session.user.role, permission)) {
            return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' });
        }
        next();
    };
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, hasPermission, requirePermission };
