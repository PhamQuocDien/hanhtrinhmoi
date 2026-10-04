/**
 * LỚP GỌI API — điểm duy nhất gọi máy chủ.
 *
 * Nguyên tắc:
 *   - Mọi request đều kèm cookie phiên (`credentials: 'same-origin'`).
 *   - `apiFetch` KHÔNG BAO GIỜ gửi điểm hay đáp án đúng lên máy chủ.
 *   - Lỗi trả về dạng có cấu trúc để UI hiển thị đúng thông điệp tiếng Việt.
 */

const API_BASE = '/api';

/** Lỗi có mã, để UI biết cần xử lý hậu xử lý (401 -> đăng nhập lại). */
export class ApiError extends Error {
    constructor(message, { status = 0, code = 'UNKNOWN', details = null } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

/** Ghép query string từ object, bỏ qua giá trị rỗng. */
function buildQuery(filters = {}) {
    const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ).toString();
    return query ? `?${query}` : '';
}

/** Gọi API và trả về phần `data` của phản hồi. */
async function apiFetch(path, { method = 'GET', body, signal } = {}) {
    const options = {
        method,
        // Cookie phiên là bắt buộc với mọi endpoint có xác thực.
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal
    };

    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, options);
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new ApiError('Không kết nối được máy chủ. Vui lòng kiểm tra mạng.', {
            status: 0,
            code: 'NETWORK_ERROR'
        });
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
        throw new ApiError(payload?.message || 'Có lỗi xảy ra.', {
            status: response.status,
            code: payload?.code || 'REQUEST_FAILED',
            details: payload?.details || null
        });
    }

    return payload.data;
}

/** Tải tệp lên bằng multipart (dùng cho DOCX). */
async function apiUpload(path, formData) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        body: formData
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success === false) {
        throw new ApiError(payload?.message || 'Không tải lên được tệp.', {
            status: response.status,
            code: payload?.code || 'UPLOAD_FAILED',
            details: payload?.details || null
        });
    }
    return payload.data;
}

/** Nhóm API cho học sinh. */
export const studentApi = {
    // Chương trình
    getOverview: () => apiFetch('/student/curriculum/overview'),
    // Cấp học (tiểu học / THCS / THPT) kèm các lớp thuộc cấp.
    getEducationLevels: () => apiFetch('/student/curriculum/levels'),
    getGrades: () => apiFetch('/student/curriculum/grades'),
    getSubjects: (grade, withLessons = false) =>
        apiFetch(`/student/curriculum/grades/${grade}/subjects${withLessons ? '?withLessons=1' : ''}`),
    getSubject: (grade, subjectId) =>
        apiFetch(`/student/curriculum/grades/${grade}/subjects/${encodeURIComponent(subjectId)}`),

    // Bộ sách dùng cho một môn trong một lớp — nguồn cho bước "chọn bộ sách".
    // Danh sách lấy động từ máy chủ nên thêm bộ sách mới không phải sửa giao diện.
    getSeries: (grade, subjectId) =>
        apiFetch(`/student/curriculum/grades/${grade}/subjects/${encodeURIComponent(subjectId)}/series`),

    // Chương và bài theo bộ sách đã chọn.
    getChapters: (grade, subjectId, seriesId) =>
        apiFetch(`/student/curriculum/grades/${grade}/subjects/${encodeURIComponent(subjectId)}/chapters${buildQuery({ seriesId })}`),

    getLesson: lessonId => apiFetch(`/student/curriculum/lessons/${encodeURIComponent(lessonId)}`),

    // Luyện tập
    getPracticeQuestions: filters => apiFetch(`/student/questions/practice${buildQuery(filters)}`),

    // Đề thi
    getExams: filters => apiFetch(`/student/exams${buildQuery(filters)}`),
    getExam: examId => apiFetch(`/student/exams/${encodeURIComponent(examId)}`),
    startAttempt: examId => apiFetch(`/student/exams/${encodeURIComponent(examId)}/attempts`, { method: 'POST' }),

    // Lượt làm bài
    saveAnswers: (attemptId, answers) => apiFetch(
        `/student/attempts/${encodeURIComponent(attemptId)}/answers`,
        { method: 'PUT', body: { answers } }
    ),
    submitAttempt: (attemptId, answers) => apiFetch(
        `/student/attempts/${encodeURIComponent(attemptId)}/submit`,
        { method: 'POST', body: { answers } }
    ),
    getAttempt: attemptId => apiFetch(`/student/attempts/${encodeURIComponent(attemptId)}`),
    abandonAttempt: attemptId => apiFetch(
        `/student/attempts/${encodeURIComponent(attemptId)}`,
        { method: 'DELETE' }
    ),
    getHistory: (page = 1) => apiFetch(`/student/attempts/history?page=${page}`),

    // Tiến độ
    getProgress: grade => apiFetch(`/student/progress/${grade}`),
    markLessonCompleted: (lessonId, minutesSpent = 0) => apiFetch(
        '/student/progress/lessons/complete',
        { method: 'POST', body: { lessonId, minutesSpent } }
    )
};

/** Nhóm API xác thực. */
export const authApi = {
    login: (username, password) => apiFetch('/auth/login', { method: 'POST', body: { username, password } }),
    register: (username, password, grade) => apiFetch(
        '/auth/register',
        { method: 'POST', body: { username, password, grade } }
    ),
    logout: () => apiFetch('/auth/logout', { method: 'POST' }),
    me: () => apiFetch('/auth/me'),
    checkUsername: username => apiFetch(`/auth/check-username?username=${encodeURIComponent(username)}`),
    changePassword: (currentPassword, newPassword) => apiFetch(
        '/auth/change-password',
        { method: 'POST', body: { currentPassword, newPassword } }
    )
};

/** Nhóm API cho quản trị viên. */
export const adminApi = {
    getCatalog: () => apiFetch('/admin/catalog'),
    getCurriculumTree: () => apiFetch('/admin/curriculum/tree'),

    // Học sinh và nhật ký
    getStudents: filters => apiFetch(`/admin/students${buildQuery(filters)}`),
    getAuditLogs: filters => apiFetch(`/admin/audit-logs${buildQuery(filters)}`),

    // Ngân hàng câu hỏi
    getQuestions: filters => apiFetch(`/admin/questions${buildQuery(filters)}`),
    getQuestion: questionId => apiFetch(`/admin/questions/${encodeURIComponent(questionId)}`),
    createQuestion: question => apiFetch('/admin/questions', { method: 'POST', body: question }),
    updateQuestion: (questionId, question) => apiFetch(
        `/admin/questions/${encodeURIComponent(questionId)}`,
        { method: 'PUT', body: question }
    ),
    deleteQuestion: questionId => apiFetch(
        `/admin/questions/${encodeURIComponent(questionId)}`,
        { method: 'DELETE' }
    ),
    getQuestionStats: () => apiFetch('/admin/questions/stats'),

    // Đề thi
    getExams: filters => apiFetch(`/admin/exams${buildQuery(filters)}`),
    getExam: examId => apiFetch(`/admin/exams/${encodeURIComponent(examId)}`),
    createExam: exam => apiFetch('/admin/exams', { method: 'POST', body: exam }),
    updateExam: (examId, exam) => apiFetch(
        `/admin/exams/${encodeURIComponent(examId)}`,
        { method: 'PUT', body: exam }
    ),
    publishExam: examId => apiFetch(`/admin/exams/${encodeURIComponent(examId)}/publish`, { method: 'POST' }),
    setExamStatus: (examId, status) => apiFetch(
        `/admin/exams/${encodeURIComponent(examId)}/status`,
        { method: 'POST', body: { status } }
    ),
    getExamAttempts: examId => apiFetch(`/admin/exams/${encodeURIComponent(examId)}/attempts`),

    // Nhập DOCX
    uploadDocx: formData => apiUpload('/admin/imports/docx', formData),
    getImportJobs: () => apiFetch('/admin/imports'),
    getImportJob: jobId => apiFetch(`/admin/imports/${encodeURIComponent(jobId)}`),
    saveImportJob: (jobId, questions) => apiFetch(
        `/admin/imports/${encodeURIComponent(jobId)}`,
        { method: 'PUT', body: { questions } }
    ),
    publishImportJob: jobId => apiFetch(`/admin/imports/${encodeURIComponent(jobId)}/publish`, { method: 'POST' }),

    // Chấm tay
    getPendingGrading: filters => apiFetch(`/admin/grading/pending${buildQuery(filters)}`),
    getGradingStats: () => apiFetch('/admin/grading/stats'),
    getGradingSheet: attemptId => apiFetch(`/admin/grading/attempts/${encodeURIComponent(attemptId)}`),
    gradeQuestion: (attemptId, questionId, score, feedback) => apiFetch(
        `/admin/grading/attempts/${encodeURIComponent(attemptId)}/grade`,
        { method: 'POST', body: { questionId, score, feedback } }
    ),
    gradeBulk: (attemptId, grades) => apiFetch(
        `/admin/grading/attempts/${encodeURIComponent(attemptId)}/grade-bulk`,
        { method: 'POST', body: { grades } }
    )
};

export { apiFetch };

// ------------------------------------------------------------- ĐĂNG NHẬP

/** Đường dẫn đăng nhập/đăng ký — nằm ở public/auth/. */
export const AUTH_PATHS = Object.freeze({
    login: '/auth/login.html',
    register: '/auth/register.html'
});

/** Trang chủ theo vai trò. */
export function homePathFor(role) {
    return role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html';
}

/**
 * Đọc thông tin tài khoản đang đăng nhập.
 * Trả về null nếu chưa đăng nhập — mọi trang đều xử lý được trường hợp này.
 */
export async function currentUser() {
    try {
        return await apiFetch('/auth/me');
    } catch {
        return null;
    }
}

/**
 * Chặn trang khi chưa đăng nhập, đồng thời trả về thông tin tài khoản.
 *
 * Không đặt role vào localStorage: quyền luôn do máy chủ quyết định, client
 * chỉ dùng kết quả này để điều hướng, không để quyết định quyền.
 */
export async function requireUser({ role } = {}) {
    const user = await currentUser();
    if (!user) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `${AUTH_PATHS.login}?next=${next}`;
        return null;
    }
    if (role && user.role !== role) {
        window.location.href = homePathFor(user.role);
        return null;
    }
    return user;
}
