'use strict';

/**
 * NGUỒN DUY NHẤT QUẢN LÝ MÔN HỌC cho toàn hệ thống.
 *
 * Nguyên tắc:
 *  - Không dùng tên hiển thị làm khóa chính. Mọi tham chiếu dùng `subjectId`.
 *  - Không gán một danh sách môn giống nhau cho mọi lớp. Mỗi cấp học có danh
 *    sách môn riêng theo chương trình.
 *  - Tôn trọng tính tích hợp: ở THCS, Vật lí / Hoá học / Sinh học là các MẠCH
 *    (learning track) nằm trong môn "Khoa học tự nhiên", không phải môn độc lập.
 *  - Mọi bản ghi khai báo `source` + `verificationStatus`. Dữ liệu chưa được
 *    đối chiếu với văn bản chính thức tuyệt đối KHÔNG gắn nhãn VERIFIED.
 *
 * verificationStatus:
 *   VERIFIED           - đã đối chiếu văn bản chính thức của Bộ GDĐT
 *   NEEDS_VERIFICATION - theo chương trình nhưng chưa đối chiếu bản gốc
 *   LEGACY             - kế thừa từ dữ liệu cũ của dự án
 *   SAMPLE             - dữ liệu mẫu/minh hoạ, không dùng làm chuẩn
 */

const CURRICULUM_VERSION = 'CTGDPT-2018';
const CURRICULUM_SOURCE = 'Chương trình giáo dục phổ thông 2018 (Bộ GDĐT)';

/** Loại môn học theo vị trí trong chương trình. */
const SUBJECT_STATUS = Object.freeze({
    REQUIRED: 'required',
    ELECTIVE: 'elective',
    INTEGRATED: 'integrated',
    SUPPLEMENTARY: 'supplementary',
    LOCAL_CONTENT: 'local-content'
});

/**
 * Khai báo một môn. `grades` là các lớp môn xuất hiện trong chương trình,
 * `status` là bắt buộc / lựa chọn / tích hợp / bổ trợ / nội dung địa phương.
 * `integratedInto` trỏ tới môn chủ khi đây là một mạch nội dung.
 * `learningTracks` liệt kê các mạch nội dung thuộc về môn tích hợp này.
 */
function defineSubject(config) {
    return Object.freeze({
        icon: '',
        grades: [],
        status: SUBJECT_STATUS.REQUIRED,
        integratedSubject: false,
        integratedInto: null,
        learningTracks: [],
        curriculumVersion: CURRICULUM_VERSION,
        source: CURRICULUM_SOURCE,
        verificationStatus: 'NEEDS_VERIFICATION',
        ...config
    });
}

const SUBJECTS = [
    // ---------------------------------------------------------------- TIỂU HỌC
    defineSubject({ id: 'toan', officialName: 'Toán', displayName: 'Toán', icon: '🔢', grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }),
    defineSubject({ id: 'tieng_viet', officialName: 'Tiếng Việt', displayName: 'Tiếng Việt', icon: '📖', grades: [1, 2, 3, 4, 5] }),
    defineSubject({ id: 'ngu_van', officialName: 'Ngữ văn', displayName: 'Ngữ văn', icon: '✍️', grades: [6, 7, 8, 9, 10, 11, 12] }),
    defineSubject({
        id: 'tieng_anh',
        officialName: 'Ngoại ngữ',
        displayName: 'Tiếng Anh',
        icon: '🎧',
        grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        // Lớp 1–2 chưa phải môn bắt buộc của chương trình; nội dung được cung
        // cấp dưới dạng mở rộng hỗ trợ, không tự nhận là môn chính thức.
        supplementaryGrades: [1, 2]
    }),
    defineSubject({ id: 'dao_duc', officialName: 'Đạo đức', displayName: 'Đạo đức', icon: '🤝', grades: [1, 2, 3, 4, 5] }),
    defineSubject({ id: 'tnxh', officialName: 'Tự nhiên và Xã hội', displayName: 'Tự nhiên và Xã hội', icon: '🌱', grades: [1, 2, 3] }),
    defineSubject({ id: 'khoa_hoc', officialName: 'Khoa học', displayName: 'Khoa học', icon: '🔬', grades: [4, 5] }),
    defineSubject({
        id: 'lich_su_dia_li',
        officialName: 'Lịch sử và Địa lí',
        displayName: 'Lịch sử và Địa lí',
        icon: '🌏',
        grades: [4, 5, 6, 7, 8, 9],
        // Chương trình THCS đang được điều chỉnh về việc tách/tích hợp Lịch sử
        // và Địa lí. Cấu trúc này theo dữ liệu dự án và CẦN đối chiếu lại với
        // văn bản hiện hành trước khi phục vụ học sinh.
        source: `${CURRICULUM_SOURCE} — cần đối chiếu văn bản điều chỉnh THCS`
    }),
    defineSubject({
        id: 'tin_hoc_cong_nghe',
        officialName: 'Tin học và Công nghệ',
        displayName: 'Tin học và Công nghệ',
        icon: '💻',
        grades: [3, 4, 5],
        integratedSubject: true,
        learningTracks: ['tin_hoc', 'cong_nghe']
    }),

    // ------------------------------------------------------------------- THCS
    defineSubject({ id: 'gdcd', officialName: 'Giáo dục công dân', displayName: 'Giáo dục công dân', icon: '⚖️', grades: [6, 7, 8, 9] }),
    defineSubject({
        id: 'khtn',
        officialName: 'Khoa học tự nhiên',
        displayName: 'Khoa học tự nhiên',
        icon: '🧪',
        grades: [6, 7, 8, 9],
        // Khoa học tự nhiên là môn TÍCH HỢP. Vật lí / Hoá học / Sinh học chỉ là
        // các mạch nội dung, không phải môn học độc lập ở cấp THCS.
        integratedSubject: true,
        learningTracks: ['vat_ly', 'hoa_hoc', 'sinh_hoc']
    }),

    // ------------------------------------------------------------------- THPT
    defineSubject({ id: 'lich_su', officialName: 'Lịch sử', displayName: 'Lịch sử', icon: '📜', grades: [10, 11, 12] }),
    defineSubject({ id: 'dia_li', officialName: 'Địa lí', displayName: 'Địa lí', icon: '🗺️', grades: [10, 11, 12], status: SUBJECT_STATUS.ELECTIVE }),
    defineSubject({
        id: 'gdktepl',
        officialName: 'Giáo dục kinh tế và pháp luật',
        displayName: 'Giáo dục kinh tế và pháp luật',
        icon: '🏛️',
        grades: [10, 11, 12],
        status: SUBJECT_STATUS.ELECTIVE
    }),

    // ------------------------------------------------- MÔN DÙNG Ở NHIỀU CẤP
    defineSubject({
        id: 'gdtc',
        officialName: 'Giáo dục thể chất',
        displayName: 'Giáo dục thể chất',
        icon: '🏃',
        grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    }),
    defineSubject({ id: 'gdqp', officialName: 'Giáo dục quốc phòng và an ninh', displayName: 'GDQP&AN', icon: '🎖️', grades: [10, 11, 12] }),
    defineSubject({
        id: 'nghe_thuat',
        officialName: 'Nghệ thuật',
        displayName: 'Nghệ thuật',
        icon: '🎨',
        grades: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        integratedSubject: true,
        learningTracks: ['am_nhac', 'mi_thuat']
    }),
    defineSubject({
        id: 'tin_hoc',
        officialName: 'Tin học',
        displayName: 'Tin học',
        icon: '🖥️',
        grades: [6, 7, 8, 9, 10, 11, 12],
        // Cấp THCS: bắt buộc. Cấp THPT: môn lựa chọn.
        statusByGrade: { 10: SUBJECT_STATUS.ELECTIVE, 11: SUBJECT_STATUS.ELECTIVE, 12: SUBJECT_STATUS.ELECTIVE }
    }),
    defineSubject({
        id: 'cong_nghe',
        officialName: 'Công nghệ',
        displayName: 'Công nghệ',
        icon: '⚙️',
        grades: [6, 7, 8, 9, 10, 11, 12],
        statusByGrade: { 10: SUBJECT_STATUS.ELECTIVE, 11: SUBJECT_STATUS.ELECTIVE, 12: SUBJECT_STATUS.ELECTIVE }
    }),
    defineSubject({
        id: 'am_nhac',
        officialName: 'Âm nhạc',
        displayName: 'Âm nhạc',
        icon: '🎵',
        grades: [6, 7, 8, 9, 10, 11, 12],
        integratedInto: 'nghe_thuat',
        statusByGrade: { 10: SUBJECT_STATUS.ELECTIVE, 11: SUBJECT_STATUS.ELECTIVE, 12: SUBJECT_STATUS.ELECTIVE }
    }),
    defineSubject({
        id: 'mi_thuat',
        officialName: 'Mĩ thuật',
        displayName: 'Mĩ thuật',
        icon: '🖌️',
        grades: [6, 7, 8, 9, 10, 11, 12],
        integratedInto: 'nghe_thuat',
        statusByGrade: { 10: SUBJECT_STATUS.ELECTIVE, 11: SUBJECT_STATUS.ELECTIVE, 12: SUBJECT_STATUS.ELECTIVE }
    }),
    defineSubject({ id: 'hdtn', officialName: 'Hoạt động trải nghiệm', displayName: 'Hoạt động trải nghiệm', icon: '🌟', grades: [1, 2, 3, 4, 5] }),
    defineSubject({
        id: 'hdtnhn',
        officialName: 'Hoạt động trải nghiệm, hướng nghiệp',
        displayName: 'Hoạt động trải nghiệm, hướng nghiệp',
        icon: '🧭',
        grades: [6, 7, 8, 9, 10, 11, 12]
    }),
    defineSubject({
        id: 'dia_phuong',
        officialName: 'Nội dung giáo dục địa phương',
        displayName: 'Nội dung giáo dục địa phương',
        icon: '🏘️',
        grades: [6, 7, 8, 9, 10, 11, 12],
        status: SUBJECT_STATUS.LOCAL_CONTENT,
        source: 'Chương trình GDPT 2018 — nội dung do địa phương xây dựng'
    }),
    defineSubject({
        id: 'thong_tin_truyen_thong',
        officialName: 'Thông tin và truyền thông',
        displayName: 'Thông tin và truyền thông',
        icon: '📡',
        grades: [1, 2],
        // KHÔNG phải môn chính thức ở lớp 1–2: chỉ cung cấp như nội dung bổ
        // trợ kỹ năng số, tuyệt đối không trình bày như môn bắt buộc.
        status: SUBJECT_STATUS.SUPPLEMENTARY,
        integratedInto: 'tnxh'
    })
];

// Vật lí / Hoá học / Sinh học: ở THCS là mạch nội dung của khtn, ở THPT là môn
// lựa chọn. Khai báo riêng để `getParentSubject` tra được đúng theo cấp.
for (const track of [
    { id: 'vat_ly', officialName: 'Vật lí', displayName: 'Vật lí', icon: '⚡' },
    { id: 'hoa_hoc', officialName: 'Hoá học', displayName: 'Hoá học', icon: '⚗️' },
    { id: 'sinh_hoc', officialName: 'Sinh học', displayName: 'Sinh học', icon: '🧬' }
]) {
    SUBJECTS.push(defineSubject({
        ...track,
        grades: [10, 11, 12],
        status: SUBJECT_STATUS.ELECTIVE,
        integratedInto: 'khtn',
        source: `${CURRICULUM_SOURCE} — môn lựa chọn ở THPT, mạch nội dung ở THCS`
    }));
}

Object.freeze(SUBJECTS);

// ---------------------------------------------------------------- TRA CỨU

const SUBJECT_BY_ID = new Map(SUBJECTS.map(subject => [subject.id, subject]));
const SUBJECTS_BY_GRADE = new Map();
for (const subject of SUBJECTS) {
    for (const grade of subject.grades) {
        if (!SUBJECTS_BY_GRADE.has(grade)) SUBJECTS_BY_GRADE.set(grade, []);
        SUBJECTS_BY_GRADE.get(grade).push(subject.id);
    }
}

/** Lấy định nghĩa môn theo id (undefined nếu không tồn tại). */
function getSubject(subjectId) {
    return SUBJECT_BY_ID.get(String(subjectId || '').trim());
}

/** Danh sách môn của một lớp, đã sắp xếp ổn định. */
function getSubjectsForGrade(grade) {
    return (SUBJECTS_BY_GRADE.get(Number(grade)) || []).map(id => SUBJECT_BY_ID.get(id));
}

/** Môn có thuộc cấp học hay không. */
function hasSubjectInGrade(subjectId, grade) {
    const subject = getSubject(subjectId);
    return Boolean(subject) && subject.grades.includes(Number(grade));
}

/**
 * Trạng thái môn tại một lớp cụ thể (bắt buộc / lựa chọn / bổ trợ / ...).
 * Ưu tiên `statusByGrade`, sau đó tới `supplementaryGrades`, rồi tới `status`.
 */
function getSubjectStatusForGrade(subjectId, grade) {
    const subject = getSubject(subjectId);
    if (!subject) return null;
    const level = Number(grade);
    if (subject.statusByGrade && subject.statusByGrade[level]) return subject.statusByGrade[level];
    if (Array.isArray(subject.supplementaryGrades) && subject.supplementaryGrades.includes(level)) {
        return SUBJECT_STATUS.SUPPLEMENTARY;
    }
    return subject.status;
}

/** Các mạch nội dung thuộc về một môn tích hợp. */
function getLearningTracks(subjectId) {
    const subject = getSubject(subjectId);
    if (!subject || !subject.learningTracks.length) return [];
    return subject.learningTracks.map(getSubject).filter(Boolean);
}

/** Môn cha của một mạch nội dung (ví dụ 'vat_ly' -> 'khtn' khi ở cấp THCS). */
function getParentSubject(subjectId, grade) {
    const subject = getSubject(subjectId);
    if (!subject || !subject.integratedInto) return null;
    const parent = getSubject(subject.integratedInto);
    if (!parent) return null;
    if (Number(grade) && !parent.grades.includes(Number(grade))) return null;
    return parent;
}

module.exports = {
    CURRICULUM_VERSION,
    CURRICULUM_SOURCE,
    SUBJECT_STATUS,
    SUBJECTS,
    getSubject,
    getSubjectsForGrade,
    hasSubjectInGrade,
    getSubjectStatusForGrade,
    getLearningTracks,
    getParentSubject
};