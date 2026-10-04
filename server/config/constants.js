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

/** Loại câu hỏi được hỗ trợ — ĐỦ 7 DẠNG, không chỉ trắc nghiệm. */
const QUESTION_TYPES = Object.freeze({
    SINGLE_CHOICE: 'single_choice',
    MULTIPLE_CHOICE: 'multiple_choice',
    TRUE_FALSE: 'true_false',
    FILL_BLANK: 'fill_blank',
    SHORT_ANSWER: 'short_answer',
    NUMERIC: 'numeric',
    ESSAY: 'essay'
});

/**
 * Cách chấm một câu. Không suy diễn — luôn đọc từ dữ liệu đã lưu.
 *  - AUTO   : máy tự chấm, không cần người.
 *  - MANUAL : bắt buộc người chấm (tự luận, hoặc câu tự do không chấm được tin cậy).
 *  - HYBRID : thử chấm tự động; nếu không khớp thì chuyển sang người chấm.
 */
const GRADING_MODES = Object.freeze({
    AUTO: 'auto',
    MANUAL: 'manual',
    HYBRID: 'hybrid'
});

/**
 * Cách chấm câu trắc nghiệm nhiều đáp án.
 *  - ALL_OR_NOTHING : đúng và đủ mới được điểm.
 *  - PARTIAL_CREDIT  : trừ điểm cho đáp án chọn sai, không trừ cho đáp án bỏ trống.
 */
const MULTIPLE_CHOICE_MODES = Object.freeze({
    ALL_OR_NOTHING: 'all_or_nothing',
    PARTIAL_CREDIT: 'partial_credit'
});

/**
 * Loại câu hỏi nào máy chấm được hoàn toàn.
 * `fill_blank` và `numeric` có thể chấm tự động vì đáp án chuẩn hoá được.
 * `short_answer` chỉ chấm tự động khi câu khai báo đủ danh sách đáp án chấp nhận.
 */
const AUTO_SCORABLE_TYPES = Object.freeze([
    QUESTION_TYPES.SINGLE_CHOICE,
    QUESTION_TYPES.MULTIPLE_CHOICE,
    QUESTION_TYPES.TRUE_FALSE,
    QUESTION_TYPES.FILL_BLANK,
    QUESTION_TYPES.NUMERIC
]);

/** Loại câu hỏi mặc định bắt buộc chấm tay (không bao giờ tự cho điểm). */
const MANUAL_GRADING_TYPES = Object.freeze([QUESTION_TYPES.ESSAY]);

/** Loại câu hỏi có thể chấm tay khi cấu hình yêu cầu (hybrid/short answer mở). */
const MAY_BE_MANUAL_TYPES = Object.freeze([
    QUESTION_TYPES.SHORT_ANSWER,
    QUESTION_TYPES.ESSAY
]);

/** Trạng thái chấm điểm của một lượt làm bài. */
const GRADING_STATUS = Object.freeze({
    PENDING: 'pending',
    PENDING_MANUAL_GRADING: 'pending_manual_grading',
    GRADED: 'graded'
});

/** Loại nguồn sinh ra đề (để admin biết đề đến từ đâu). */
const SOURCE_TYPE = Object.freeze({
    DOCX_IMPORT: 'docx_import',
    MANUAL: 'manual',
    AUTO_GENERATED: 'auto_generated'
});

/** Phiên bản bộ dò DOCX — ghi vào đề để truy vết kết quả đọc. */
const PARSER_VERSION = 'docx-parser-v2';

/** Mức độ câu hỏi. */
const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

/** Trạng thái đề thi. */
const EXAM_STATUS = Object.freeze({
    DRAFT: 'draft',
    REVIEW: 'review',
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

/** Nhãn hiển thị cho từng loại câu hỏi (tiếng Việt, dùng chung client/server). */
const QUESTION_TYPE_LABELS = Object.freeze({
    single_choice: 'Trắc nghiệm một đáp án',
    multiple_choice: 'Trắc nghiệm nhiều đáp án',
    true_false: 'Đúng / Sai',
    fill_blank: 'Điền khuyết',
    short_answer: 'Trả lời ngắn',
    numeric: 'Câu số',
    essay: 'Tự luận'
});

module.exports = {
    ATTEMPT_STATUS,
    AUTO_SCORABLE_TYPES,
    DIFFICULTIES,
    ERROR_CODES,
    EXAM_STATUS,
    GRADING_MODES,
    GRADING_STATUS,
    IMPORT_STATUS,
    MANUAL_GRADING_TYPES,
    MAY_BE_MANUAL_TYPES,
    MULTIPLE_CHOICE_MODES,
    OPTION_LABELS,
    PARSER_VERSION,
    QUESTION_TYPE_LABELS,
    ROLES,
    SOURCE_TYPE,
    VERIFICATION_STATUS,
    QUESTION_TYPES
};