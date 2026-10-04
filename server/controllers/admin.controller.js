'use strict';

/**
 * Controller quản trị: ngân hàng câu hỏi, đề thi, nhập DOCX, chấm tay.
 *
 * Bảo mật:
 *   - Toàn bộ route dưới /api/admin đã qua `requireAdmin` ở tầng route.
 *   - `graderId` / `createdBy` lấy từ SESSION, không bao giờ từ request body.
 *   - Endpoint publish chạy validator trước — không có đường vòng nào để publish
 *     đề chứa câu hỏi hỏng hoặc thiếu đáp án.
 */

const response = require('../utils/response');
const crypto = require('crypto');

const Question = require('../models/question.model');
const Exam = require('../models/exam.model');
const Attempt = require('../models/attempt.model');
const ImportJob = require('../models/import-job.model');
const User = require('../models/user.model');
const AuditLog = require('../models/audit-log.model');

const questionService = require('../services/question.service');
const gradingService = require('../services/grading.service');
const docxImportService = require('../services/docx-import.service');
const curriculumService = require('../services/curriculum.service');
const { escapeRegExp } = require('../services/auth.service');
const env = require('../config/env');
const logger = require('../utils/logger');

const {
    QUESTION_TYPES,
    QUESTION_TYPE_LABELS,
    GRADING_MODES,
    MULTIPLE_CHOICE_MODES,
    EXAM_STATUS,
    ROLES
} = require('../config/constants');
const { validateQuestionDocument } = require('../validators/question.validator');
const { validateExamForPublish, canTransition } = require('../validators/exam.validator');

/** Sinh mã phiên chạy tài liệu import. */
function buildJobId() {
    return `imp-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------- DANH MỤC

/** Danh mục đầy đủ cho màn hình soạn thảo: loại câu, chế độ chấm, nhãn tiếng Việt. */
function getCatalog(req, res) {
    return response.ok(res, {
        questionTypes: Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => ({
            type,
            label,
            // Câu nào bắt buộc chấm tay -> UI hiển thị cảnh báo khi admin chọn.
            requiresManualGrading: type === QUESTION_TYPES.ESSAY,
            hasOptions: type === QUESTION_TYPES.SINGLE_CHOICE || type === QUESTION_TYPES.MULTIPLE_CHOICE,
            multipleChoice: type === QUESTION_TYPES.MULTIPLE_CHOICE
        })),
        gradingModes: Object.values(GRADING_MODES).map(mode => ({
            mode,
            label: {
                auto: 'Máy chấm tự động',
                manual: 'Chấm tay',
                hybrid: 'Thử tự động, không khớp thì chấm tay'
            }[mode] || mode
        })),
        multipleChoiceModes: Object.values(MULTIPLE_CHOICE_MODES).map(mode => ({
            mode,
            label: {
                all_or_nothing: 'Đúng và đủ mới được điểm',
                partial_credit: 'Cho điểm từng đáp án, trừ điểm đáp án sai'
            }[mode] || mode
        })),
        examStatuses: Object.values(EXAM_STATUS),
        difficulties: ['easy', 'medium', 'hard'],
        subjects: curriculumService.listAllSubjects(),
        bookSeries: curriculumService.listBookSeries()
    });
}

/** Danh sách lớp và môn phục vụ bộ chọn trong trang quản trị. */
function getCurriculumTree(req, res) {
    return response.ok(res, {
        grades: curriculumService.listGrades(),
        subjects: curriculumService.listAllSubjects(),
        bookSeries: curriculumService.listBookSeries()
    });
}

/** Danh sách học sinh cho màn hình quản trị. */
async function listStudents(req, res) {
    const filter = { role: req.query.role || ROLES.STUDENT };
    if (req.query.grade) filter.grade = Number(req.query.grade);
    // Tìm theo tên đăng nhập: escape ký tự đặc biệt để không chèn được biểu thức.
    if (req.query.keyword) {
        const keyword = escapeRegExp(String(req.query.keyword).trim().slice(0, 24));
        if (keyword) filter.username = { $regex: new RegExp(keyword, 'i') };
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
        // `.select('-password -passwordHash')` là lớp bảo vệ cuối: dù controller
        // có sót, mật khẩu vẫn không bao giờ ra khỏi máy chủ.
        User.find(filter)
            .sort({ username: 1 })
            .skip(skip)
            .limit(pageSize)
            .select('-password -passwordHash')
            .lean(),
        User.countDocuments(filter)
    ]);

    return response.okList(res, {
        items: items.map(user => ({
            username: user.username,
            fullName: user.fullName || '',
            role: user.role,
            grade: user.grade ?? null,
            bookSeriesId: user.bookSeriesId || '',
            schoolName: user.schoolName || '',
            loginStreak: user.loginStreak || 0,
            isSuspended: Boolean(user.isSuspended),
            lastLoginAt: user.lastLoginAt || null,
            createdAt: user.createdAt
        })),
        total,
        page,
        pageSize
    });
}

/** Nhật ký thao tác quản trị, mới nhất trước. */
async function listAuditLogs(req, res) {
    const filter = {};
    if (req.query.actor) filter.actor = String(req.query.actor);
    if (req.query.action) filter.action = String(req.query.action);

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const [items, total] = await Promise.all([
        AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            // `changes` đã được lọc bỏ trường nhạy cảm lúc ghi (redactChanges).
            .select('-changes')
            .lean(),
        AuditLog.countDocuments(filter)
    ]);

    return response.okList(res, { items, total, page, pageSize });
}

// ---------------------------------------------------------------- NGÂN HÀNG CÂU HỎI

/** Danh sách câu hỏi cho màn hình quản trị (CÓ đáp án đúng để sửa). */
async function listQuestions(req, res) {
    const filter = {};
    if (req.query.grade) filter.grade = Number(req.query.grade);
    if (req.query.subjectId) filter.subjectId = String(req.query.subjectId);
    if (req.query.chapterId) filter.chapterId = String(req.query.chapterId);
    if (req.query.lessonId) filter.lessonId = String(req.query.lessonId);
    if (req.query.type) filter.type = String(req.query.type);
    if (req.query.difficulty) filter.difficulty = String(req.query.difficulty);
    if (req.query.needsReview === '1') filter.needsReview = true;

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
        Question.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
        Question.countDocuments(filter)
    ]);

    return response.okList(res, {
        items: items.map(question => questionService.toEditorView(question)),
        total,
        page,
        pageSize
    });
}

/** Chi tiết một câu hỏi cho màn hình sửa. */
async function getQuestion(req, res) {
    const question = await Question.findOne({ questionId: String(req.params.questionId) });
    if (!question) return response.notFound(res, 'Không tìm thấy câu hỏi.');
    return response.ok(res, {
        ...questionService.toEditorView(question),
        normalization: question.normalization,
        tolerance: question.tolerance,
        minWords: question.minWords,
        maxWords: question.maxWords,
        unit: question.unit
    });
}

/**
 * Tạo một câu hỏi.
 *
 * `createdBy` lấy từ session. Câu KHÔNG được publish ngay — admin xem lại rồi
 * gọi endpoint publish, để không có câu hỏi hỏng nào lọt vào ngân hàng.
 */
async function createQuestion(req, res) {
    const document = buildQuestionFromBody(req.body, req.session.user.username);
    const validation = validateQuestionDocument(document);
    if (!validation.valid) {
        return response.badRequest(res, 'Câu hỏi chưa hợp lệ.', { errors: validation.errors });
    }

    const question = await Question.create({
        ...document,
        questionId: questionService.buildQuestionId(),
        // Gán cờ cần duyệt nếu admin chưa xác nhận đáp án tự luận.
        needsReview: Boolean(document.needsReview),
        reviewNotes: validation.warnings,
        createdBy: req.session.user.username
    });

    return response.ok(res, questionService.toEditorView(question), 201);
}

/**
 * Cập nhật một câu hỏi.
 *
 * Chỉ nhận các trường đã biết, không nhận `correctAnswer` dạng rỗng — nếu muốn
 * xoá đáp án thì phải sửa trực tiếp để validator bắt lỗi, tránh vô tình làm
 * câu thành "không chấm được".
 */
async function updateQuestion(req, res) {
    const existing = await Question.findOne({ questionId: String(req.params.questionId) });
    if (!existing) return response.notFound(res, 'Không tìm thấy câu hỏi.');

    const merged = buildQuestionFromBody({ ...existing.toObject(), ...req.body }, existing.createdBy);
    const validation = validateQuestionDocument(merged);
    if (!validation.valid) {
        return response.badRequest(res, 'Câu hỏi chưa hợp lệ.', { errors: validation.errors });
    }

    const updated = await questionService.updateQuestion(
        req.params.questionId,
        {
            ...merged,
            // Admin đã sửa tay -> coi như đã duyệt, trừ khi còn cờ cần duyệt.
            needsReview: Boolean(merged.needsReview),
            reviewNotes: validation.warnings,
            publishedAt: req.body.publish === true ? new Date() : existing.publishedAt
        },
        req.session.user.username
    );
    if (!updated) return response.notFound(res, 'Không tìm thấy câu hỏi.');

    return response.ok(res, questionService.toEditorView(updated));
}

/** Xoá một câu hỏi. */
async function deleteQuestion(req, res) {
    const removed = await questionService.deleteQuestion(req.params.questionId);
    if (!removed) return response.notFound(res, 'Không tìm thấy câu hỏi.');
    return response.ok(res, { removed });
}

/** Thống kê ngân hàng câu hỏi. */
async function getQuestionStats(req, res) {
    const stats = await questionService.getStats({
        grade: req.query.grade ? Number(req.query.grade) : undefined,
        subjectId: req.query.subjectId
    });
    return response.ok(res, stats);
}

/**
 * Chuẩn hoá body của admin thành tài liệu câu hỏi đầy đủ.
 * Tách riêng để controller create và update dùng chung một quy tắc.
 */
function buildQuestionFromBody(body, createdBy) {
    const type = String(body.type || QUESTION_TYPES.SINGLE_CHOICE);
    const isManual = type === QUESTION_TYPES.ESSAY;
    const hasAnswers = Array.isArray(body.acceptedAnswers) && body.acceptedAnswers.length > 0;

    return {
        type,
        questionText: String(body.questionText || '').trim(),
        grade: Number(body.grade),
        subjectId: String(body.subjectId || '').trim() || null,
        seriesId: String(body.seriesId || '').trim() || null,
        textbookId: String(body.textbookId || '').trim() || null,
        chapterId: String(body.chapterId || '').trim() || null,
        lessonId: String(body.lessonId || '').trim() || null,

        options: Array.isArray(body.options)
            ? body.options.map(option => ({
                label: String(option.label || '').toUpperCase(),
                text: String(option.text || '').trim()
            }))
            : [],
        blanks: Array.isArray(body.blanks) ? body.blanks : [],
        statements: Array.isArray(body.statements) ? body.statements : [],
        rubric: Array.isArray(body.rubric) ? body.rubric : [],
        acceptedAnswers: hasAnswers ? body.acceptedAnswers.map(text => String(text).trim()) : [],
        unit: String(body.unit || '').trim(),

        // Tự luận KHÔNG có "đáp án đúng" máy đọc được -> value rỗng, cần người chấm.
        correctAnswer: {
            type,
            value: isManual ? [] : (body.correctAnswer ?? null),
            normalizedValue: '',
            manualGradingRequired: isManual
        },
        explanation: String(body.explanation || '').trim(),

        gradingMode: isManual ? GRADING_MODES.MANUAL : String(body.gradingMode || GRADING_MODES.AUTO),
        multipleChoiceMode: type === QUESTION_TYPES.MULTIPLE_CHOICE
            ? String(body.multipleChoiceMode || MULTIPLE_CHOICE_MODES.ALL_OR_NOTHING)
            : undefined,
        wrongAnswerPenalty: Number.isFinite(Number(body.wrongAnswerPenalty))
            ? Number(body.wrongAnswerPenalty)
            : null,
        tolerance: Number.isFinite(Number(body.tolerance)) ? Number(body.tolerance) : 0,
        minWords: Number.isFinite(Number(body.minWords)) ? Number(body.minWords) : null,
        maxWords: Number.isFinite(Number(body.maxWords)) ? Number(body.maxWords) : null,
        normalization: body.normalization || undefined,

        difficulty: String(body.difficulty || 'medium'),
        points: Number(body.points) > 0 ? Number(body.points) : 1,
        media: Array.isArray(body.media) ? body.media : [],
        source: String(body.source || '').trim(),
        needsReview: body.needsReview === true || Boolean(body.needsReview),
        createdBy
    };
}

// ---------------------------------------------------------------- ĐỀ THI

/** Danh sách đề cho quản trị (mọi trạng thái, không chỉ đã publish). */
async function listExams(req, res) {
    const filter = {};
    if (req.query.grade) filter.grade = Number(req.query.grade);
    if (req.query.subjectId) filter.subjectId = String(req.query.subjectId);
    if (req.query.status) filter.status = String(req.query.status);

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const [items, total] = await Promise.all([
        Exam.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
        Exam.countDocuments(filter)
    ]);

    return response.okList(res, {
        items: items.map(exam => ({
            ...exam.toStudentInfo(),
            status: exam.status,
            createdBy: exam.createdBy,
            attemptCount: exam.attemptCount,
            averageScorePercent: exam.averageScorePercent,
            updatedAt: exam.updatedAt
        })),
        total,
        page,
        pageSize
    });
}

/** Chi tiết đề cho màn hình soạn thảo, kèm kết quả kiểm tra publish. */
async function getExam(req, res) {
    const exam = await Exam.findOne({ examId: String(req.params.examId) });
    if (!exam) return response.notFound(res, 'Không tìm thấy đề thi.');

    const validation = await validateExamForPublish(exam, {
        questionStore: async questionId => Question.findOne({ questionId })
    });

    return response.ok(res, {
        examId: exam.examId,
        title: exam.title,
        description: exam.description,
        grade: exam.grade,
        subjectId: exam.subjectId,
        seriesId: exam.seriesId,
        textbookId: exam.textbookId,
        chapterId: exam.chapterId,
        lessonId: exam.lessonId,
        difficulty: exam.difficulty,
        durationMinutes: exam.durationMinutes,
        totalPoints: exam.totalPoints,
        passScorePercent: exam.passScorePercent,
        questions: exam.questions,
        status: exam.status,
        sourceType: exam.sourceType,
        sourceFileName: exam.sourceFileName,
        parserVersion: exam.parserVersion,
        createdBy: exam.createdBy,
        createdAt: exam.createdAt,
        publishedAt: exam.publishedAt,
        // Kết quả kiểm tra để admin biết còn thiếu gì trước khi publish.
        validation
    });
}

/** Tạo đề mới (rỗng hoặc sao chép từ đề có sẵn). */
async function createExam(req, res) {
    const exam = new Exam({
        examId: questionService.buildExamId('exam'),
        title: String(req.body.title || 'Đề thi mới'),
        description: String(req.body.description || ''),
        grade: Number(req.body.grade),
        subjectId: String(req.body.subjectId || ''),
        seriesId: req.body.seriesId || null,
        textbookId: req.body.textbookId || null,
        chapterId: req.body.chapterId || null,
        lessonId: req.body.lessonId || null,
        difficulty: String(req.body.difficulty || 'medium'),
        durationMinutes: Number(req.body.durationMinutes) || 45,
        passScorePercent: Number(req.body.passScorePercent) || 50,
        questions: [],
        status: EXAM_STATUS.DRAFT,
        createdBy: req.session.user.username,
        sourceType: String(req.body.sourceType || 'manual')
    });
    await exam.save();
    return response.ok(res, { examId: exam.examId, status: exam.status }, 201);
}

/** Cập nhật thông tin và danh sách câu hỏi của đề. */
async function updateExam(req, res) {
    const exam = await Exam.findOne({ examId: String(req.params.examId) });
    if (!exam) return response.notFound(res, 'Không tìm thấy đề thi.');

    // Đã publish thì phải chuyển về draft trước khi sửa nội dung, để không có
    // đề đang cho học sinh làm bị thay đổi ngoài ý muốn.
    if (exam.status === EXAM_STATUS.PUBLISHED && req.body.questions) {
        return response.conflict(
            res,
            'Đề đang cho học sinh làm. Hãy chuyển về nháp trước khi sửa câu hỏi.'
        );
    }

    const updatable = ['title', 'description', 'grade', 'subjectId', 'seriesId', 'textbookId',
        'chapterId', 'lessonId', 'difficulty', 'durationMinutes', 'passScorePercent'];

    for (const field of updatable) {
        if (req.body[field] !== undefined) exam[field] = req.body[field];
    }

    if (Array.isArray(req.body.questions)) {
        exam.questions = req.body.questions.map((item, index) => ({
            questionId: String(item.questionId),
            points: Number(item.points) > 0 ? Number(item.points) : 1,
            order: Number(item.order) > 0 ? Number(item.order) : index + 1
        }));
    }

    exam.recalculateTotal();
    exam.updatedBy = req.session.user.username;
    await exam.save();

    return response.ok(res, {
        examId: exam.examId,
        questionCount: exam.questions.length,
        totalPoints: exam.totalPoints
    });
}

/**
 * Publish đề — CHẶN nếu bất kỳ câu hỏi nào chưa hợp lệ.
 * Không có đường vòng nào để đưa đề hỏng ra cho học sinh.
 */
async function publishExam(req, res) {
    const exam = await Exam.findOne({ examId: String(req.params.examId) });
    if (!exam) return response.notFound(res, 'Không tìm thấy đề thi.');

    const transition = canTransition(exam, EXAM_STATUS.PUBLISHED);
    if (!transition.allowed) return response.conflict(res, transition.reason);

    const validation = await validateExamForPublish(exam, {
        questionStore: async questionId => Question.findOne({ questionId })
    });
    if (!validation.valid) {
        return response.fail(res, 422, 'PUBLISH_BLOCKED', 'Đề chưa đủ điều kiện để công bố.', {
            requestId: res.locals?.requestId,
            details: { errors: validation.errors }
        });
    }

    exam.status = EXAM_STATUS.PUBLISHED;
    exam.publishedAt = new Date();
    exam.publishedBy = req.session.user.username;
    exam.recalculateTotal();
    await exam.save();

    logger.info(`Đề ${exam.examId} đã được công bố bởi ${req.session.user.username}.`);

    return response.ok(res, {
        examId: exam.examId,
        status: exam.status,
        publishedAt: exam.publishedAt,
        warnings: validation.warnings
    });
}

/** Chuyển trạng thái đề (draft / review / archived). */
async function changeExamStatus(req, res) {
    const target = String(req.body.status || '');
    const exam = await Exam.findOne({ examId: String(req.params.examId) });
    if (!exam) return response.notFound(res, 'Không tìm thấy đề thi.');

    const transition = canTransition(exam, target);
    if (!transition.allowed) return response.conflict(res, transition.reason);

    exam.status = target;
    if (target === EXAM_STATUS.ARCHIVED) exam.publishedAt = null;
    await exam.save();
    return response.ok(res, { examId: exam.examId, status: exam.status });
}

/** Lịch sử làm bài của một đề — cho quản trị xem ai làm, điểm bao nhiêu. */
async function listExamAttempts(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    const [items, total] = await Promise.all([
        Attempt.find({ examId: String(req.params.examId), submittedAt: { $ne: null } })
            .sort({ submittedAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize),
        Attempt.countDocuments({ examId: String(req.params.examId), submittedAt: { $ne: null } })
    ]);

    return response.okList(res, {
        items: items.map(item => ({ ...item.toHistoryItem(), username: item.username })),
        total,
        page,
        pageSize
    });
}

// ---------------------------------------------------------------- NHẬP DOCX

/**
 * Nhận tệp .docx, đọc thành câu hỏi và lưu thành phiên nháp.
 *
 * Câu hỏi KHÔNG ghi vào ngân hàng lúc này — admin phải sửa, duyệt rồi publish.
 * Nhờ vậy lỗi parse không làm bẩn ngân hàng câu hỏi.
 */
async function importDocxFile(req, res) {
    if (!req.file) return response.badRequest(res, 'Không nhận được tệp .docx.');

    const metadata = {
        grade: Number(req.body.grade),
        subjectId: String(req.body.subjectId || ''),
        seriesId: req.body.seriesId || null,
        textbookId: req.body.textbookId || null,
        chapterId: req.body.chapterId || null,
        lessonId: req.body.lessonId || null,
        title: String(req.body.examTitle || req.file.originalName),
        durationMinutes: Number(req.body.durationMinutes) || 45
    };

    // Kiểm tra môn thuộc lớp trước khi đọc tệp — lỗi metadata rõ ràng hơn lỗi parse.
    const subjectCheck = curriculumService.validateSubjectInGrade(metadata.grade, metadata.subjectId);
    if (!subjectCheck.valid) {
        return response.badRequest(res, subjectCheck.reason);
    }

    let parsed;
    try {
        parsed = docxImportService.importDocx(req.file.buffer, metadata);
    } catch (error) {
        logger.error(`DOCX import thất bại: ${error.message}`);
        return response.badRequest(res, `Không đọc được tệp Word: ${error.message}`);
    }

    const job = await ImportJob.create({
        jobId: buildJobId(),
        title: metadata.title,
        description: String(req.body.description || ''),
        grade: metadata.grade,
        subjectId: metadata.subjectId,
        seriesId: metadata.seriesId,
        textbookId: metadata.textbookId,
        chapterId: metadata.chapterId,
        lessonId: metadata.lessonId,
        durationMinutes: metadata.durationMinutes,

        fileName: req.file.originalName,
        fileSizeBytes: req.file.size,
        // Tệp KHÔNG lưu trên đĩa; chỉ giữ hash để đối chiếu/giải quyết tranh chấp.
        fileSha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex'),

        status: parsed.errorCount > 0 ? 'needs_review' : 'parsed',
        questions: parsed.questions,
        questionCount: parsed.questionCount,
        validCount: parsed.validCount,
        warningCount: parsed.warningCount,
        errorCount: parsed.errorCount,
        documentWarnings: parsed.documentWarnings,
        needsReview: parsed.needsReview,
        parseSummary: {
            typeSummary: parsed.typeSummary,
            parserVersion: parsed.parserVersion
        },

        uploadedBy: req.session.user.username
    });

    return response.ok(res, {
        jobId: job.jobId,
        questionCount: job.questionCount,
        validCount: job.validCount,
        errorCount: job.errorCount,
        warningCount: job.warningCount,
        typeSummary: parsed.typeSummary,
        documentWarnings: job.documentWarnings,
        needsReview: job.needsReview,
        parserVersion: parsed.parserVersion
    }, 201);
}

/** Chi tiết phiên nhập để admin xem và sửa từng câu. */
async function getImportJob(req, res) {
    const job = await ImportJob.findOne({ jobId: String(req.params.jobId) }).lean();
    if (!job) return response.notFound(res, 'Không tìm thấy phiên nhập.');
    return response.ok(res, job);
}

/** Lưu bản nháp sau khi admin sửa câu hỏi trong phiên nhập. */
async function saveImportJob(req, res) {
    const job = await ImportJob.findOne({ jobId: String(req.params.jobId) });
    if (!job) return response.notFound(res, 'Không tìm thấy phiên nhập.');
    if (job.status === 'published') {
        return response.conflict(res, 'Phiên nhập đã công bố, không thể sửa.');
    }

    if (Array.isArray(req.body.questions)) {
        job.questions = req.body.questions;
        job.questionCount = job.questions.length;
        job.validCount = job.questions.filter(item => item.valid).length;
        job.errorCount = job.questions.filter(item => !item.valid).length;
        job.warningCount = job.questions.reduce((sum, item) => sum + (item.warnings?.length || 0), 0);
    }
    job.status = 'draft_saved';
    await job.save();

    return response.ok(res, {
        jobId: job.jobId,
        status: job.status,
        questionCount: job.questionCount,
        validCount: job.validCount,
        errorCount: job.errorCount
    });
}

/**
 * Công bố phiên nhập: ghi câu hỏi vào ngân hàng và tạo đề thi ở trạng thái draft.
 *
 * CHẶN khi còn câu hỏi chưa hợp lệ — câu thiếu đáp án không bao giờ được ghi.
 */
async function publishImportJob(req, res) {
    const job = await ImportJob.findOne({ jobId: String(req.params.jobId) });
    if (!job) return response.notFound(res, 'Không tìm thấy phiên nhập.');

    const gate = job.canPublish();
    if (!gate.canPublish) {
        return response.fail(res, 422, 'PUBLISH_BLOCKED', 'Phiên nhập chưa đủ điều kiện công bố.', {
            requestId: res.locals?.requestId,
            details: { reasons: gate.blockedReasons }
        });
    }

    // Chạy lại validator trên từng câu — không tin cờ `valid` do client gửi lên.
    const invalid = [];
    for (const item of job.questions) {
        const validation = validateQuestionDocument({
            ...item,
            grade: job.grade,
            subjectId: job.subjectId,
            lessonId: job.lessonId,
            chapterId: job.chapterId,
            source: job.fileName
        });
        if (!validation.valid) invalid.push({ number: item.number, errors: validation.errors });
    }
    if (invalid.length) {
        return response.fail(res, 422, 'PUBLISH_BLOCKED', 'Còn câu hỏi chưa hợp lệ.', {
            requestId: res.locals?.requestId,
            details: { invalid }
        });
    }

    // Ghi câu hỏi vào ngân hàng.
    const savedQuestions = [];
    for (const [index, item] of job.questions.entries()) {
        const document = questionService.buildQuestionDocument(item, {
            grade: job.grade,
            subjectId: job.subjectId,
            seriesId: job.seriesId,
            textbookId: job.textbookId,
            chapterId: job.chapterId,
            lessonId: job.lessonId,
            source: job.fileName,
            fileName: job.fileName,
            createdBy: req.session.user.username,
            importJobId: job._id,
            verificationStatus: 'NEEDS_VERIFICATION'
        });

        const question = await Question.create({
            ...document,
            questionId: questionService.buildQuestionId(),
            order: index + 1,
            // Chỉ publish câu nào admin đã xác nhận, không còn cờ cần duyệt.
            needsReview: Boolean(item.needsReview),
            publishedAt: item.needsReview ? null : new Date()
        });
        savedQuestions.push({ questionId: question.questionId, points: item.points || 1 });
    }

    // Tạo đề ở trạng thái draft — admin kiểm tra tổng thể rồi mới publish đề.
    const exam = new Exam({
        examId: questionService.buildExamId('exam'),
        title: job.title,
        description: job.description,
        grade: job.grade,
        subjectId: job.subjectId,
        seriesId: job.seriesId,
        textbookId: job.textbookId,
        chapterId: job.chapterId,
        lessonId: job.lessonId,
        difficulty: 'medium',
        durationMinutes: job.durationMinutes,
        passScorePercent: 50,
        questions: savedQuestions.map((item, index) => ({
            questionId: item.questionId,
            points: item.points,
            order: index + 1
        })),
        status: EXAM_STATUS.DRAFT,
        createdBy: req.session.user.username,
        importJobId: job._id,
        sourceType: 'docx_import',
        sourceFileName: job.fileName,
        parserVersion: job.parseSummary?.parserVersion || null
    });
    exam.recalculateTotal();
    await exam.save();

    job.status = 'published';
    job.publishedExamId = exam.examId;
    job.publishedAt = new Date();
    job.publishedBy = req.session.user.username;
    await job.save();

    logger.info(
        `Phiên nhập ${job.jobId}: đã tạo ${savedQuestions.length} câu hỏi và đề nháp ${exam.examId}.`
    );

    return response.ok(res, {
        jobId: job.jobId,
        examId: exam.examId,
        examStatus: exam.status,
        questionCount: savedQuestions.length,
        totalPoints: exam.totalPoints,
        nextStep: 'Kiểm tra đề rồi gọi POST /api/admin/exams/:examId/publish'
    });
}

/** Danh sách phiên nhập gần đây. */
async function listImportJobs(req, res) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));

    const [items, total] = await Promise.all([
        ImportJob.find({})
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .select('-questions')
            .lean(),
        ImportJob.countDocuments({})
    ]);

    return response.okList(res, { items, total, page, pageSize });
}

// ---------------------------------------------------------------- CHẤM TAY

/** Danh sách bài cần chấm. */
async function listPendingGrading(req, res) {
    const queue = await gradingService.listPendingGrading({
        grade: req.query.grade ? Number(req.query.grade) : undefined,
        subjectId: req.query.subjectId,
        examId: req.query.examId,
        username: req.query.username,
        page: Math.max(1, Number(req.query.page) || 1),
        pageSize: Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
    });
    return response.okList(res, queue);
}

/** Thống kê hàng đợi chấm. */
async function getGradingStats(req, res) {
    return response.ok(res, await gradingService.getQueueStats({
        grade: req.query.grade ? Number(req.query.grade) : undefined,
        subjectId: req.query.subjectId
    }));
}

/** Mở bài làm để chấm: câu hỏi + rubric + bài làm của học sinh. */
async function getGradingSheet(req, res) {
    const sheet = await gradingService.getGradingSheet({
        attemptId: req.params.attemptId,
        username: req.query.username || null
    });
    if (sheet.error) return response.notFound(res, sheet.message);
    return response.ok(res, sheet);
}

/** Chấm một câu tự luận. `graderId` lấy từ session, không lấy từ body. */
async function gradeQuestion(req, res) {
    const result = await gradingService.gradeQuestion({
        attemptId: req.params.attemptId,
        questionId: req.body.questionId,
        score: req.body.score,
        feedback: req.body.feedback,
        graderId: req.session.user.username
    });

    if (result.error) {
        const status = {
            NOT_FOUND: 404,
            NOT_SUBMITTED: 409,
            ALREADY_GRADED: 409,
            NOT_MANUAL: 409,
            INVALID_SCORE: 400,
            SCORE_TOO_HIGH: 400
        }[result.error] || 400;
        return response.fail(res, status, result.error, result.message, {
            requestId: res.locals?.requestId
        });
    }

    return response.ok(res, result);
}

/** Chấm nhiều câu một lúc. */
async function gradeBulk(req, res) {
    const result = await gradingService.gradeBulk({
        attemptId: req.params.attemptId,
        grades: Array.isArray(req.body.grades) ? req.body.grades : [],
        graderId: req.session.user.username
    });
    if (result.error) return response.notFound(res, result.message);
    return response.ok(res, result);
}

module.exports = {
    changeExamStatus,
    createExam,
    createQuestion,
    deleteQuestion,
    getCatalog,
    getCurriculumTree,
    getExam,
    getGradingSheet,
    getGradingStats,
    getImportJob,
    getQuestion,
    getQuestionStats,
    gradeBulk,
    gradeQuestion,
    importDocxFile,
    listAuditLogs,
    listExamAttempts,
    listExams,
    listImportJobs,
    listPendingGrading,
    listQuestions,
    listStudents,
    publishExam,
    publishImportJob,
    saveImportJob,
    updateExam,
    updateQuestion
};