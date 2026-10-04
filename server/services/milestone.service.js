'use strict';

/**
 * MỐC TIẾN ĐỘ VÀ ĐIỀU KIỆN LÀM BÀI — quyết định ở phía máy chủ.
 *
 * Nguyên tắc quan trọng: eligibility KHÔNG BAO GIỜ được tính ở frontend.
 * Học sinh nhìn thấy cảnh báo sớm là để lên kế hoạch, nhưng việc mở đề thật
 * sự vẫn do máy chủ quyết định.
 *
 * Nguồn của các ngưỡng là `assessment-policy-registry`. Khi policy có
 * `sourceKind: SCHOOL_SCHEDULE` thì lịch nhà trường được ưu tiên hơn quy tắc
 * đếm bài. Không có nguồn thì không được trình bày là "quy định của Bộ".
 */

const {
    ASSESSMENT_TYPE,
    SOURCE_KIND,
    resolvePolicy
} = require('../../data/curriculum/assessment-policy-registry');
const {
    academicYearOf,
    currentSemesterId
} = require('../../data/curriculum/academic-calendar');
const curriculum = require('../../data/curriculum/curriculum-registry');

/** Tỉ lệ phạm vi đã học, làm tròn về số nguyên. */
function percentOf(completed, total) {
    return total ? Math.round((completed / total) * 100) : 0;
}

/**
 * Phạm vi bài học của một môn trong một lớp.
 *
 * @param {object} params lớp và môn
 * @returns {Array<object>} danh sách bài kèm chương
 */
function lessonScope({ grade, subjectId }) {
    const lessons = curriculum.getLessonsForSubject(Number(grade), subjectId);
    return lessons.map(lesson => ({
        lessonId: lesson.lessonId,
        lessonNumber: lesson.lessonNumber,
        displayTitle: lesson.displayTitle,
        chapterId: lesson.chapterId,
        chapterTitle: lesson.chapterTitle
    }));
}

/**
 * Tính một mốc (checkpoint / midterm / final) cho một môn.
 *
 * @param {object} params đầu vào
 * @param {number} params.grade lớp
 * @param {string} params.subjectId môn
 * @param {string} [params.seriesId] bộ sách đang học
 * @param {Set<string>|string[]} params.completedLessonId các bài đã đạt yêu cầu
 * @param {number} [params.semester] học kỳ
 * @param {string} [params.academicYear] năm học
 * @returns {object} trạng thái ba mốc
 */
function evaluateMilestone({
    grade,
    subjectId,
    seriesId = null,
    completedLessonId = [],
    semester = currentSemesterId(),
    academicYear = academicYearOf().id
}) {
    const policy = resolvePolicy({ grade, subjectId, semester, academicYear });
    const scope = lessonScope({ grade, subjectId });

    const done = completedLessonId instanceof Set
        ? completedLessonId
        : new Set(completedLessonId);

    const completed = scope.filter(lesson => done.has(lesson.lessonId)).length;
    const total = scope.length;
    const coveragePercent = percentOf(completed, total);

    /** Đánh giá một mốc theo ngưỡng của policy. */
    const judge = (thresholds, type) => {
        const requiredLessons = thresholds.lessonsBefore ?? 0;
        const requiredPercent = thresholds.coveragePercent ?? 0;
        const enoughLessons = completed >= requiredLessons;
        const enoughCoverage = coveragePercent >= requiredPercent;

        return {
            assessmentType: type,
            // Không có phạm vi thì không mốc nào mở được — báo riêng để không
            // bị hiểu nhầm là "học chưa đủ".
            eligible: total > 0 && enoughLessons && enoughCoverage,
            requiredLessons,
            requiredCoveragePercent: requiredPercent,
            completedLessons: completed,
            totalLessons: total,
            remainingLessons: Math.max(0, requiredLessons - completed),
            coveragePercent,
            enoughLessons,
            enoughCoverage,
            hasScope: total > 0,
            // Căn cứ của ngưỡng, để giao diện nói rõ lấy từ đâu.
            policyId: policy.policyId,
            sourceKind: policy.sourceKind,
            source: policy.source,
            verificationStatus: policy.verificationStatus,
            isOfficialRegulation: policy.isOfficialRegulation
        };
    };

    return {
        grade: Number(grade),
        subjectId,
        seriesId,
        semester,
        academicYear,
        completedLessons: completed,
        totalLessons: total,
        coveragePercent,
        hasScope: total > 0,
        scopeLessonIds: scope.map(lesson => lesson.lessonId),
        checkpoint: judge({
            lessonsBefore: policy.lessonsBeforeCheckpoint,
            coveragePercent: policy.coveragePercentBeforeCheckpoint
        }, ASSESSMENT_TYPE.CHECKPOINT),
        midterm: judge(policy.midtermPolicy, ASSESSMENT_TYPE.MIDTERM),
        final: judge(policy.finalPolicy, ASSESSMENT_TYPE.FINAL)
    };
}
/**
 * Chính sách hoàn thành bài học áp dụng cho một lớp/môn.
 *
 * @param {object} params lớp, môn, học kỳ, năm học
 * @returns {object} policy hoàn thành bài kèm nguồn
 */
function lessonCompletionPolicy({ grade, subjectId, semester, academicYear }) {
    const policy = resolvePolicy({ grade, subjectId, semester, academicYear });
    return {
        ...policy.lessonCompletionPolicy,
        policyId: policy.policyId,
        sourceKind: policy.sourceKind,
        verificationStatus: policy.verificationStatus
    };
}

/**
 * Đánh giá một bài học đã đạt yêu cầu hoàn thành chưa.
 *
 * KHÔNG đánh dấu hoàn thành chỉ vì mở bài: policy mặc định yêu cầu làm mini
 * test và đạt ngưỡng. Học sinh luôn thấy lý do chưa đạt. Làm lại không làm mất
 * kết quả đã đạt, và làm sai không được tạo ra kết quả đạt giả.
 *
 * @param {object} params trạng thái bài học
 * @returns {object} kết luận kèm lý do
 */
function evaluateLessonCompletion({
    grade,
    subjectId,
    policy = null,
    readingDone = false,
    miniTestAttempted = false,
    miniTestBestPercent = 0,
    attemptsAllowed = null,
    attemptsUsed = 0
} = {}) {
    const requirement = policy || lessonCompletionPolicy({ grade, subjectId });
    const reasons = [];

    if (requirement.requireReading && !readingDone) {
        reasons.push('Chưa đánh dấu đã đọc nội dung bài học.');
    }

    if (requirement.requireMiniTest) {
        if (!miniTestAttempted) {
            reasons.push('Chưa làm bài kiểm tra cuối bài (mini test).');
        } else if (miniTestBestPercent < requirement.miniTestPassPercent) {
            reasons.push(
                `Mini test chưa đạt: cần ít nhất ${requirement.miniTestPassPercent}%, `
                + `kết quả tốt nhất hiện tại là ${miniTestBestPercent}%.`
            );
        }
    }

    // Hết lượt làm thì không thể đạt, nhưng không tự tạo kết quả đạt.
    if (requirement.requireMiniTest && !miniTestAttempted
        && attemptsAllowed !== null && attemptsUsed >= attemptsAllowed) {
        reasons.push(`Đã hết lượt làm mini test (tối đa ${attemptsAllowed} lần).`);
    }

    return {
        completed: reasons.length === 0,
        reasons,
        requirement,
        requiresMiniTest: Boolean(requirement.requireMiniTest),
        requiresReading: Boolean(requirement.requireReading),
        miniTestPassPercent: requirement.miniTestPassPercent,
        attemptsAllowed,
        attemptsUsed,
        remainingAttempts: attemptsAllowed === null
            ? null
            : Math.max(0, attemptsAllowed - attemptsUsed)
    };
}

/** Nhãn nguồn để giao diện không gọi nhầm là quy định của Bộ. */
function sourceLabel(sourceKind) {
    if (sourceKind === SOURCE_KIND.OFFICIAL_REGULATION) return 'Theo văn bản quy phạm pháp luật';
    if (sourceKind === SOURCE_KIND.SCHOOL_SCHEDULE) return 'Theo lịch nhà trường';
    return 'Mặc định của nền tảng';
}

module.exports = {
    ASSESSMENT_TYPE,
    evaluateLessonCompletion,
    evaluateMilestone,
    lessonCompletionPolicy,
    lessonScope,
    sourceLabel
};
