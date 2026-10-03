'use strict';

/**
 * Hằng số dùng chung cho toàn hệ thống.
 * Không được đặt danh sách lớp/môn/bộ sách ở đây — những danh sách đó thuộc
 * về data/ và phải có một nguồn duy nhất.
 */

/** Vai trò tài khoản. */
const ROLES = Object.freeze({
    STUDENT: 'student',
    TEACHER: 'teacher',
    ADMIN: 'admin',
    PARENT: 'parent'
});

/** Loại câu hỏi được hỗ trợ. */
const QUESTION_TYPES = Object.freeze({
    SINGLE_CHOICE: 'single_choice',
    MULTIPLE_CHOICE: 'multiple_choice',
    TRUE_FALSE: 'true_false',
    SHORT_ANSWER: 'short_answer',
    NUMERIC: 'numeric',
    ESSAY: 'essay'
});

/**
 * Loại câu hỏi nào máy chấm được.
 * `essay` và `short_answer` cần người chấm, hệ thống KHÔNG được bịa điểm.
 */
const AUTO_SCORABLE_TYPES = Object.freeze([
    QUESTION_TYPES.SINGLE_CHOICE,
    QUESTION_TYPES.MULTIPLE_CHOICE,
    QUESTION_TYPES.TRUE_FALSE,
    QUESTION_TYPES.NUMERIC
]);

/** Loại câu hỏi bắt buộc chấm tay. */
const MANUAL_GRADING_TYPES = Object.freeze([QUESTION_TYPES.ESSAY, QUESTION_TYPES.SHORT_ANSWER]);

/** Mức độ câu hỏi. */
const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

/** Trạng thái đề thi. */
const EXAM_STATUS = Object.freeze({
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived'
});

/** Trạng thái lượt làm bài. */
const ATTEMPT_STATUS = Object.freeze({
    IN_PROGRESS: 'in_progress',
    SUBMITTED: 'submitted',
    EXPIRED: 'expired',
    GRADED: 'graded'
});

/** Trạng thái tài liệu import DOCX. */
const IMPORT_STATUS = Object.freeze({
    UPLOADED: 'uploaded',
    PARSED: 'parsed',
    NEEDS_REVIEW: 'needs_review',
    DRAFT_SAVED: 'draft_saved',
    PUBLISHED: 'published',
    REJECTED: 'rejected'
});

/** Trạng thái xác minh dữ liệu chương trình. */
const VERIFICATION_STATUS = Object.freeze({
    VERIFIED: 'VERIFIED',
    NEEDS_VERIFICATION: 'NEEDS_VERIFICATION',
    LEGACY: 'LEGACY',
    SAMPLE: 'SAMPLE',
    REMOVED: 'REMOVED',
    REPLACED: 'REPLACED'
});

/** Mã lỗi chuẩn trả về cho client. */
const ERROR_CODES = Object.freeze({
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    RATE_LIMITED: 'RATE_LIMITED',
    DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
    DOCUMENT_INVALID: 'DOCUMENT_INVALID',
    PUBLISH_BLOCKED: 'PUBLISH_BLOCKED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
    DUPLICATE: 'DUPLICATE',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
});

/** Ký hiệu lựa chọn được dùng khi import DOCX. */
const OPTION_LABELS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);

module.exports = {
    ATTEMPT_STATUS,
    AUTO_SCORABLE_TYPES,
    DIFFICULTIES,
    ERROR_CODES,
    EXAM_STATUS,
    IMPORT_STATUS,
    MANUAL_GRADING_TYPES,
    OPTION_LABELS,
    ROLES,
    VERIFICATION_STATUS,
    QUESTION_TYPES
};