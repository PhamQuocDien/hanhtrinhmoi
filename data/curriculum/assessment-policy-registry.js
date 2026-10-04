'use strict';

/**
 * CHÍNH SÁCH ĐÁNH GIÁ (assessment policy).
 *
 * CHÍNH SÁCH NÀY LÀ CẤU HÌNH CỦA NỀN TẢNG, KHÔNG PHẢI QUY ĐỊNH CỦA BỘ GDĐT.
 *
 * Rất quan trọng: hiện chưa có văn bản nào của Bộ quy định cụ thể "học N bài
 * thì làm bài kiểm tra giữa chừng" cho từng môn theo cách nền tảng này dùng.
 * Vì vậy mọi con số ở đây:
 *   - mang `verificationStatus: NEEDS_VERIFICATION`,
 *   - mang `sourceKind: PLATFORM_DEFAULT` để phân biệt với quy định chính thức,
 *   - KHÔNG bao giờ được hiển thị cho người dùng như "quy định của Bộ".
 *
 * Khi nhà trường cung cấp lịch chính thức, quản trị viên nhập
 * `sourceKind: SCHOOL_SCHEDULE` kèm `source` cụ thể; lúc đó lịch được ưu tiên
 * hơn quy tắc đếm bài. Nhờ vậy không có con số nào bị gắn nhầm nguồn.
 *
 * Mô hình áp dụng:
 *   (educationLevel) -> policy mặc định cho cấp học
 *   + (grade, subjectId, semester, academicYear) -> policy ghi đè khi có
 */

const { levelOfGrade } = require('./education-levels');

/** Các loại nguồn quy định. */
const SOURCE_KIND = Object.freeze({
    /** Quy tắc mặc định do nền tảng đặt ra để hoạt động được. */
    PLATFORM_DEFAULT: 'PLATFORM_DEFAULT',
    /** Lịch do nhà trường cung cấp — được ưu tiên. */
    SCHOOL_SCHEDULE: 'SCHOOL_SCHEDULE',
    /** Có căn cứ trong văn bản quy phạm pháp luật. */
    OFFICIAL_REGULATION: 'OFFICIAL_REGULATION'
});

/** Trạng thái xác minh của một bản ghi dữ liệu giáo dục. */
const VERIFICATION_STATUS = Object.freeze({
    VERIFIED: 'VERIFIED',
    NEEDS_VERIFICATION: 'NEEDS_VERIFICATION',
    DRAFT: 'DRAFT',
    /** Dữ liệu chỉ để minh hoạ, KHÔNG được hiển thị như dữ liệu chính thức. */
    SAMPLE: 'SAMPLE',
    /** Dữ liệu của phiên bản cũ, vẫn giữ để tra cứu. */
    LEGACY: 'LEGACY'
});

/** Danh mục các loại đánh giá trong luồng học. */
const ASSESSMENT_TYPE = Object.freeze({
    /** Luyện tập tự do, không tính điểm định kỳ. */
    PRACTICE: 'practice',
    /** Bài kiểm tra cuối bài, không phải điểm định kỳ. */
    MINI_TEST: 'mini_test',
    /** Kiểm tra định kỳ giữa chương/bài theo phạm vi đã học. */
    CHECKPOINT: 'checkpoint',
    /** Thi giữa kỳ. */
    MIDTERM: 'midterm',
    /** Thi cuối kỳ. */
    FINAL: 'final'
});

/** Policy hoàn thành bài: mặc định yêu cầu làm mini test. */
const DEFAULT_LESSON_COMPLETION = Object.freeze({
    requireReading: true,
    requireMiniTest: true,
    miniTestPassPercent: 60,
    masteryThreshold: 60
});

/**
 * Policy mặc định cho một cấp học.
 *
 * Các ngưỡng dưới đây là quy ước vận hành để nền tảng có thể chạy được; chúng
 * KHÔNG phải quy định của Bộ và đều ở trạng thái cần xác minh.
 *
 * @param {object} config cấu hình theo cấp học
 * @returns {object} policy đóng băng
 */
function buildPolicy(config) {
    return Object.freeze({
        policyId: config.policyId,
        educationLevel: config.educationLevel,
        gradeRange: Object.freeze(config.gradeRange),
        // Số bài cần hoàn thành trước checkpoint.
        lessonsBeforeCheckpoint: config.lessonsBeforeCheckpoint,
        // Tỉ lệ phạm vi đã học trước checkpoint (0-100).
        coveragePercentBeforeCheckpoint: config.coveragePercentBeforeCheckpoint,
        // Điều kiện thi giữa kỳ và cuối kỳ.
        midtermPolicy: Object.freeze(config.midtermPolicy),
        finalPolicy: Object.freeze(config.finalPolicy),
        // Chính sách hoàn thành một bài học.
        lessonCompletionPolicy: Object.freeze(config.lessonCompletionPolicy),
        sourceKind: SOURCE_KIND.PLATFORM_DEFAULT,
        source: 'Mặc định vận hành của nền tảng Hành Tinh Mơ Ước',
        sourceDocument: null,
        verificationStatus: VERIFICATION_STATUS.NEEDS_VERIFICATION,
        // Bộ GDĐT có quy định cụ thể các ngưỡng này không.
        isOfficialRegulation: false,
        notes: 'Ngưỡng mặc định của nền tảng, chưa phải quy định của Bộ GDĐT. '
            + 'Quản trị viên có thể cấu hình lại theo lịch nhà trường.'
    });
}

/**
 * Policy mặc định theo cấp học.
 *
 * Chia theo cấp vì tiểu học học theo chương nhỏ, THCS/THPT học theo phạm vi bài
 * lớn hơn — nhưng đây vẫn là quy ước nền tảng, không phải quy định Bộ.
 */
const DEFAULT_POLICIES = Object.freeze([
    buildPolicy({
        policyId: 'policy-primary',
        educationLevel: 'primary',
        gradeRange: [1, 5],
        // Tiểu học học theo chương, kiểm tra thường bám theo chương đã học.
        lessonsBeforeCheckpoint: 4,
        coveragePercentBeforeCheckpoint: 60,
        midtermPolicy: { lessonsBefore: 40, coveragePercent: 60 },
        finalPolicy: { lessonsBefore: 80, coveragePercent: 60 },
        lessonCompletionPolicy: DEFAULT_LESSON_COMPLETION
    }),
    buildPolicy({
        policyId: 'policy-middle',
        educationLevel: 'middle',
        gradeRange: [6, 9],
        lessonsBeforeCheckpoint: 8,
        coveragePercentBeforeCheckpoint: 70,
        midtermPolicy: { lessonsBefore: 45, coveragePercent: 70 },
        finalPolicy: { lessonsBefore: 90, coveragePercent: 70 },
        lessonCompletionPolicy: DEFAULT_LESSON_COMPLETION
    }),
    buildPolicy({
        policyId: 'policy-high',
        educationLevel: 'high',
        gradeRange: [10, 12],
        lessonsBeforeCheckpoint: 10,
        coveragePercentBeforeCheckpoint: 75,
        midtermPolicy: { lessonsBefore: 50, coveragePercent: 75 },
        finalPolicy: { lessonsBefore: 100, coveragePercent: 75 },
        lessonCompletionPolicy: DEFAULT_LESSON_COMPLETION
    })
]);

/** Policy ghi đè theo (lớp, môn, học kỳ) — lấp đầy khi quản trị viên cấu hình. */
const OVERRIDES = new Map();

/** Khoá ghi đè, từ cụ thể nhất đến rộng nhất. */
function overrideKey({ grade, subjectId = '*', semester = '*', academicYear = '*' }) {
    return [Number(grade), subjectId, semester, academicYear].join('|');
}

/**
 * Thêm hoặc cập nhật policy ghi đè.
 *
 * Dùng khi nhà trường có lịch riêng cho một môn hoặc một học kỳ. Lịch nhà
 * trường luôn được ưu tiên hơn quy tắc đếm bài mặc định.
 *
 * @param {object} input cấu hình ghi đè
 * @returns {object} policy đã lưu
 */
function upsertOverride(input) {
    const key = overrideKey(input);
    const base = resolvePolicyForGrade(input.grade);
    const policy = {
        ...base,
        policyId: `override-${key}`,
        grade: Number(input.grade),
        subjectId: input.subjectId === '*' ? null : input.subjectId,
        semester: input.semester === '*' ? null : input.semester,
        academicYear: input.academicYear === '*' ? null : input.academicYear,
        lessonsBeforeCheckpoint: input.lessonsBeforeCheckpoint ?? base.lessonsBeforeCheckpoint,
        coveragePercentBeforeCheckpoint:
            input.coveragePercentBeforeCheckpoint ?? base.coveragePercentBeforeCheckpoint,
        midtermPolicy: { ...base.midtermPolicy, ...(input.midtermPolicy || {}) },
        finalPolicy: { ...base.finalPolicy, ...(input.finalPolicy || {}) },
        lessonCompletionPolicy: {
            ...base.lessonCompletionPolicy,
            ...(input.lessonCompletionPolicy || {})
        },
        sourceKind: input.sourceKind || SOURCE_KIND.SCHOOL_SCHEDULE,
        source: input.source || base.source,
        sourceDocument: input.sourceDocument || null,
        verificationStatus: input.verificationStatus || VERIFICATION_STATUS.NEEDS_VERIFICATION,
        isOfficialRegulation: input.sourceKind === SOURCE_KIND.OFFICIAL_REGULATION
    };
    OVERRIDES.set(key, Object.freeze(policy));
    return policy;
}

/** Xoá toàn bộ policy ghi đè (dùng cho kiểm thử và khi quản trị viên reset). */
function clearOverrides() {
    OVERRIDES.clear();
}

/** Tất cả policy ghi đè đang có. */
function listOverrides() {
    return [...OVERRIDES.values()];
}

/** Policy mặc định của một lớp, theo cấp học. */
function resolvePolicyForGrade(grade) {
    const level = levelOfGrade(grade);
    return DEFAULT_POLICIES.find(policy => policy.educationLevel === level.id)
        || DEFAULT_POLICIES[0];
}

/**
 * Policy áp dụng cho một lớp + môn + học kỳ + năm học.
 *
 * Thứ tự ưu tiên (từ cụ thể đến rộng):
 *   (lớp, môn, học kỳ, năm) > (lớp, môn, học kỳ) > (lớp, môn) > (lớp)
 *   > policy mặc định theo cấp học
 *
 * @param {object} scope lớp, môn, học kỳ, năm học
 * @returns {object} policy
 */
function resolvePolicy({ grade, subjectId = '*', semester = '*', academicYear = '*' } = {}) {
    const candidates = [
        overrideKey({ grade, subjectId, semester, academicYear }),
        overrideKey({ grade, subjectId, semester }),
        overrideKey({ grade, subjectId }),
        overrideKey({ grade })
    ];
    for (const key of candidates) {
        const found = OVERRIDES.get(key);
        if (found) return found;
    }
    return resolvePolicyForGrade(grade);
}

/** Danh sách policy mặc định, dùng cho trang cấu hình của quản trị viên. */
function listDefaultPolicies() {
    return DEFAULT_POLICIES.map(policy => ({ ...policy }));
}

module.exports = {
    ASSESSMENT_TYPE,
    DEFAULT_POLICIES,
    DEFAULT_LESSON_COMPLETION,
    SOURCE_KIND,
    VERIFICATION_STATUS,
    clearOverrides,
    listDefaultPolicies,
    listOverrides,
    resolvePolicy,
    resolvePolicyForGrade,
    upsertOverride
};