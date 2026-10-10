'use strict';

const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Set(values.filter(Boolean))];
const curriculumData = require('../../curriculum-data.js');
const { buildMixedQuestions, buildK12Questions } = require('../modules/rich-learning-content-v20.js');
const K12_TOPICS = {
 math: {
  1:['Đếm, đọc và viết số đến 100','So sánh và sắp xếp số','Phép cộng trong phạm vi 20','Phép trừ trong phạm vi 20','Hình vuông, hình tròn và hình tam giác','Đo độ dài và xem giờ'],
  2:['Số đến 1000 và giá trị hàng','Cộng trừ có nhớ trong phạm vi 1000','Bảng nhân và bảng chia cơ bản','Giải toán bằng một phép tính','Đo độ dài, khối lượng và thời gian','Hình học và chu vi hình đơn giản'],
  3:['Nhân và chia trong bảng','Số tự nhiên đến 10000','Cộng trừ nhân chia số có nhiều chữ số','Phân số và ý nghĩa phần bằng nhau','Chu vi và diện tích hình chữ nhật','Bài toán thực tế về tiền và thời gian'],
  4:['Đọc viết số lớn và cấu tạo thập phân','Nhân chia với số có nhiều chữ số','Phân số bằng nhau và rút gọn','Cộng trừ phân số cùng mẫu số','Đơn vị đo và đổi đơn vị','Chu vi, diện tích hình vuông và chữ nhật'],
  5:['Ôn số tự nhiên và phân số','Cộng trừ nhân chia số thập phân','Tỉ số phần trăm và bài toán phần trăm','Diện tích tam giác và hình thang','Thể tích hình hộp chữ nhật, hình lập phương','Bài toán chuyển động đều'],
  6:['Tập hợp số tự nhiên và tính chia hết','Số nguyên và trục số','Phân số và phép tính phân số','Số thập phân và làm tròn','Đoạn thẳng, góc và hình phẳng','Dữ liệu, bảng thống kê và biểu đồ'],
  7:['Số hữu tỉ và phép tính','Số thực và căn bậc hai số học','Tỉ lệ thức và đại lượng tỉ lệ','Biểu thức đại số và đa thức một biến','Góc, đường thẳng song song và tam giác','Thu thập dữ liệu và xác suất thực nghiệm'],
  8:['Đa thức và hằng đẳng thức','Phân tích đa thức thành nhân tử','Phân thức đại số','Phương trình bậc nhất một ẩn','Tứ giác và định lí Pythagore','Hàm số, biểu đồ và xác suất'],
  9:['Căn bậc hai và biểu thức căn','Hàm số bậc nhất và đồ thị','Hệ hai phương trình bậc nhất','Phương trình bậc hai và hệ thức Viète','Đường tròn, góc và dây cung','Hình trụ, hình nón và hình cầu'],
  10:['Mệnh đề, tập hợp và các phép toán','Hàm số, đồ thị và hàm bậc hai','Phương trình, bất phương trình','Hệ thức lượng trong tam giác','Vectơ và tọa độ trong mặt phẳng','Quy tắc đếm và xác suất'],
  11:['Hàm số lượng giác và phương trình lượng giác','Dãy số, cấp số cộng và cấp số nhân','Giới hạn và hàm số liên tục','Đạo hàm và ý nghĩa tốc độ biến thiên','Quan hệ song song và vuông góc trong không gian','Xác suất, biến cố và quy tắc cộng nhân'],
  12:['Tính đơn điệu và cực trị của hàm số','Giá trị lớn nhất, nhỏ nhất và tiệm cận','Hàm số mũ, hàm số logarit','Nguyên hàm và tích phân','Vectơ, tọa độ trong không gian','Xác suất có điều kiện và thống kê']
 },
 english: {1:['Chào hỏi và giới thiệu bản thân','Bảng chữ cái và âm đầu','Màu sắc và số đếm','Gia đình và đồ vật lớp học','Động từ hành động thường gặp','Nghe hiểu chỉ dẫn ngắn'],2:['Chủ đề gia đình và trường học','Danh từ số ít và số nhiều','Động từ hành động trong câu đơn','Hỏi đáp về thời gian và lịch sinh hoạt','Đọc đoạn ngắn có tranh','Viết câu đơn có dấu câu'],3:['Từ vựng theo chủ đề và collocations','Hiện tại đơn và trạng từ tần suất','Câu hỏi Wh- và câu trả lời','Đọc hiểu thông tin cụ thể','Nghe hội thoại ngắn','Viết đoạn 4–6 câu'],4:['So sánh và miêu tả người/vật','Hiện tại tiếp diễn và phân biệt hiện tại đơn','Giới từ chỉ vị trí và thời gian','Đọc hiểu đoạn văn theo ý chính','Nghe lịch trình và hoạt động','Viết email/đoạn văn ngắn'],5:['Thì cơ bản trong ngữ cảnh','So sánh hơn và so sánh nhất','Từ vựng trường học và đời sống','Đọc tìm ý chính và chi tiết','Nghe thông báo ngắn','Viết đoạn văn có mở–thân–kết'],6:['Từ loại và cấu tạo câu','Hiện tại đơn, tiếp diễn và quá khứ đơn','Danh từ đếm được/không đếm được','Đọc hiểu câu hỏi thông tin','Nghe bắt từ khóa','Viết đoạn miêu tả'],7:['Các thì và dấu hiệu nhận biết','Modal verbs và câu đề nghị','So sánh, lượng từ và giới từ','Đọc suy luận đơn giản','Nghe hội thoại nhiều lượt','Viết đoạn nêu ý kiến'],8:['Câu bị động và tường thuật','Mệnh đề quan hệ','Câu điều kiện và liên từ','Đọc hiểu quan điểm tác giả','Nghe chi tiết và thái độ','Viết đoạn lập luận ngắn'],9:['Ngữ pháp tổng hợp theo ngữ cảnh','Câu điều kiện và đảo ngữ cơ bản','Từ vựng học thuật nền tảng','Đọc câu hỏi suy luận','Nghe bài nói theo mục đích','Viết email và đoạn lập luận'],10:['Từ loại trong câu học thuật','Mệnh đề quan hệ và rút gọn','Câu bị động và tường thuật nâng cao','Đọc đối chiếu nhiều đoạn','Nghe ý chính và hàm ý','Viết bài có lập luận'],11:['Hệ thống thì và sự hòa hợp chủ-vị','Mệnh đề danh từ và liên từ','Word formation và collocations','Đọc câu hỏi inference/reference','Nghe note-taking','Viết essay theo luận điểm'],12:['Ngữ pháp trọng điểm thi tốt nghiệp','Đọc hiểu văn bản dài và paraphrase','Từ vựng theo collocation','Nghe chọn ý chính và suy luận','Viết phản hồi/email theo mục đích','Luyện đề theo thời gian và phân tích lỗi']
 },
};
function normalizeWords(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeSubject(value) { return normalizeWords(value).replace(/\s+/g, ''); }
function resolveK12Subject(subject, grade) {
    const raw = normalizeSubject(subject);
    const aliases = [
        { match: /^(toan|math|mathematics|algebra|geometry)$/, ids: ['toan'] },
        { match: /^(english|tienganh|anh|englishlanguage)$/, ids: ['tieng_anh'] },
        { match: /^(literature|nguvan|vanhoc|tiengviet|vietnamese)$/, ids: Number(grade) <= 5 ? ['tieng_viet'] : ['ngu_van'] },
        { match: /^(informatics|computer|computerscience|tinhoc|tinhoccongnghe|cntt)$/, ids: ['tin_hoc_cong_nghe', 'tin_hoc'] },
        { match: /^(physics|chemistry|biology|science|khtn|khoahoc|vatly|hoahoc|sinhhoc)$/, ids: Number(grade) <= 5 ? ['khoa_hoc', 'tnxh'] : ['khtn'] },
        { match: /^(history|geography|lichsu|dialy|lichsudialy)$/, ids: ['lich_su_dia_li'] },
        { match: /^(technology|congnghe)$/, ids: ['tin_hoc_cong_nghe', 'cong_nghe'] }
    ];
    const alias = aliases.find(item => item.match.test(raw));
    const requestedIds = alias?.ids || [String(subject || '').toLowerCase(), 'toan'];
    const catalog = curriculumData.getCatalog(Math.max(1, Math.min(12, Number(grade) || 5)));
    const subjects = catalog?.subjects || [];
    for (const id of requestedIds) {
        const match = subjects.find(item => String(item.id).toLowerCase() === id || normalizeSubject(item.id) === normalizeSubject(id));
        if (match) return match;
    }
    if (alias) {
        const match = subjects.find(item => requestedIds.some(id => normalizeSubject(item.id).includes(normalizeSubject(id))));
        if (match) return match;
    }
    return subjects.find(item => normalizeSubject(item.id) === 'toan') || subjects[0] || null;
}
function extractFocusTopic(value) {
    const text = String(value || '').trim();
    const match = text.match(/(?:về|chủ đề|nội dung|tập trung vào|luyện tập|ôn tập phần)\s+(.+?)(?:[,.!;]|$)/i);
    if (!match) return '';
    let focus = match[1].trim().replace(/^(?:môn\s+)?/i, '').replace(/\s+(?:cho người mới|cơ bản|nâng cao|dành cho học sinh).*$/i, '').trim();
    focus = focus.replace(/\b(?:lớp\s*(?:1[0-2]|[1-9])|lớp|khóa học|course)\b/gi, '').replace(/\s+/g, ' ').trim();
    return focus.length >= 3 && focus.length <= 90 ? focus : '';
}
function titleCase(value) { const text = String(value || '').trim(); return text ? text.charAt(0).toLocaleUpperCase('vi-VN') + text.slice(1) : ''; }
function resolveK12Lessons(subject, grade, focusText = '') {
    const record = resolveK12Subject(subject, grade);
    if (record?.lessons?.length) {
        const ignore = new Set(['tao','khoa','hoc','lop','mon','ve','on','tap','hay','cho','cua','va','theo','phu','thong','toan','math','tieng','anh','ngu','van']);
        const normalizedFocus = normalizeWords(focusText).replace(/\blop\s*(?:1[0-2]|[1-9])\b/g, ' ');
        const focusTokens = normalizedFocus.split(/\s+/).filter(token => token.length >= 3 && !ignore.has(token));
        const focusPhrase = focusTokens.join(' ').trim();
        const lessons = record.lessons.filter(lesson => !lesson.isCheckpoint);
        const score = lesson => { const text = normalizeWords(`${lesson.title || ''} ${lesson.topic || ''}`); const phraseBonus = focusPhrase && text.includes(focusPhrase) ? 1000 : 0; return phraseBonus + focusTokens.reduce((sum, token) => sum + (text.includes(token) ? token.length * 10 : 0), 0); };
        if (focusTokens.length) lessons.sort((a, b) => score(b) - score(a) || Number(a.order || 0) - Number(b.order || 0));
        const hasFocusedLesson = lessons.length && focusTokens.length && score(lessons[0]) > 0;
        if (focusTokens.length && !hasFocusedLesson) {
            const focus = extractFocusTopic(focusText) || focusPhrase;
            if (focus) lessons.unshift({ id: `focus-${normalizeSubject(focus)}`, order: 0, unit: 1, unitTitle: `Chủ đề trọng tâm: ${titleCase(focus)}`, title: titleCase(focus), topic: titleCase(focus), curriculumSubjectId: record.id, curriculumSubjectName: record.baseName || record.name, objectives: [`Giải thích được ${focus} theo đúng chương trình lớp ${grade}.`, `Làm bài luyện tập và tự kiểm tra về ${focus}.`], customFocus: true });
        }
        const uniqueLessons = [];
        const seenTopics = new Set();
        for (const lesson of lessons) {
            const topicKey = normalizeWords(lesson.topic || lesson.title || '').replace(/^bai\s+\d+\s*/, '').trim();
            if (!topicKey || seenTopics.has(topicKey)) continue;
            seenTopics.add(topicKey);
            uniqueLessons.push(lesson);
        }
        return uniqueLessons.slice(0, 12).map(lesson => ({ ...lesson, title: lesson.topic || String(lesson.title || '').replace(/^Bài\s+\d+\s*[:.\-]?\s*/i, ''), curriculumSubjectId: record.id, curriculumSubjectName: record.baseName || record.name }));
    }
    return k12TopicsFallback(subject, grade).map((title, index) => ({ id: `lesson-${index + 1}`, order: index + 1, title, topic: title, curriculumSubjectId: subject, curriculumSubjectName: subject }));
}
function k12TopicsFallback(subject, grade) { const text=String(subject||'').toLowerCase(); const key=/english|tieng anh|tiếng anh/.test(text)?'english':'math'; return K12_TOPICS[key][Math.max(1, Math.min(12, Number(grade) || 5))] || K12_TOPICS[key][5]; }
function normalizeK12Question(question) {
    const result = { ...question };
    if (Number.isInteger(result.answer) && Array.isArray(result.options)) result.answer = result.options[result.answer]?.value ?? result.options[result.answer]?.label ?? result.options[result.answer];
    if (result.acceptedAnswers === undefined && result.answer !== undefined) result.acceptedAnswers = [result.answer];
    result.options = Array.isArray(result.options) ? result.options : [];
    result.points = Number(result.points) || 1;
    result.tags = Array.isArray(result.tags) ? result.tags : [];
    return result;
}

const TRACKS = {
    IT: {
        label: 'Lập trình và CNTT', subjectId: 'computer_science', chapters: [
            { title: 'Tư duy giải quyết vấn đề', lessons: ['Phân tích đề bài và xác định đầu vào/đầu ra', 'Thiết kế thuật toán bằng ví dụ và giả mã'] },
            { title: 'Ngôn ngữ và dữ liệu', lessons: ['Biến, kiểu dữ liệu và nhập xuất', 'Biểu thức, toán tử và chuyển đổi kiểu'] },
            { title: 'Điều khiển chương trình', lessons: ['Rẽ nhánh và điều kiện biên', 'Vòng lặp và bài toán lặp'] },
            { title: 'Tổ chức chương trình', lessons: ['Hàm, tham số và giá trị trả về', 'Mảng, chuỗi và duyệt dữ liệu'] },
            { title: 'Kiểm thử và chất lượng', lessons: ['Test case, debug và xử lý lỗi', 'Độ phức tạp và lựa chọn giải pháp'] },
            { title: 'Dự án ứng dụng', lessons: ['Thiết kế chương trình theo yêu cầu thực tế', 'Hoàn thiện, kiểm thử và trình bày sản phẩm'] }
        ]
    },
    TOEIC: {
        label: 'TOEIC', subjectId: 'english_toeic', chapters: [
            { title: 'Nền tảng và chiến lược', lessons: ['Xác định trình độ và đặt mục tiêu điểm', 'Từ vựng công sở theo ngữ cảnh'] },
            { title: 'Listening Part 1–2', lessons: ['Mô tả tranh: người, hành động và vị trí', 'Câu hỏi – đáp: nhận diện ý định và câu trả lời tự nhiên'] },
            { title: 'Listening Part 3–4', lessons: ['Hội thoại: mục đích, vai trò và chi tiết', 'Bài nói ngắn: thông báo, lịch trình và suy luận'] },
            { title: 'Reading Part 5–6', lessons: ['Ngữ pháp trong câu: từ loại và cấu trúc', 'Hoàn thành đoạn văn: liên kết và mạch nghĩa'] },
            { title: 'Reading Part 7', lessons: ['Đọc email, thông báo và biểu mẫu', 'Đọc nhiều văn bản và đối chiếu thông tin'] },
            { title: 'Luyện đề theo mục tiêu', lessons: ['Chiến lược thời gian và sổ lỗi cá nhân', 'Mini mock test và phân tích kết quả'] }
        ]
    },
    MOS: {
        label: 'Microsoft Office Specialist', subjectId: 'mos', chapters: [
            { title: 'Làm quen quy trình thi', lessons: ['Đọc yêu cầu thao tác và kiểm tra tệp', 'Quản lý tệp, định dạng và lưu phiên bản'] },
            { title: 'Microsoft Word', lessons: ['Định dạng văn bản, đoạn và bố cục trang', 'Bảng, hình ảnh, đầu trang và chân trang'] },
            { title: 'Microsoft Excel', lessons: ['Ô, vùng dữ liệu, tham chiếu và định dạng', 'Hàm, điều kiện, sắp xếp và lọc dữ liệu'] },
            { title: 'Microsoft PowerPoint', lessons: ['Bố cục slide, chủ đề và căn chỉnh', 'Hình ảnh, biểu đồ, chuyển cảnh và trình chiếu'] },
            { title: 'Tác vụ tổng hợp', lessons: ['Hoàn thành tài liệu theo checklist', 'Kiểm tra lỗi định dạng và tính nhất quán'] },
            { title: 'Thực hành theo dự án', lessons: ['Tạo bộ hồ sơ công việc từ dữ liệu mẫu', 'Mô phỏng bài thi và tự kiểm tra sản phẩm'] }
        ]
    },
    K12: {
        label: 'Phổ thông 1–12', subjectId: 'mathematics', chapters: [
            { title: 'Ôn tập kiến thức nền', lessons: ['Nhận diện kiến thức đã biết và điều cần tìm', 'Biểu diễn dữ kiện bằng hình, bảng hoặc kí hiệu'] },
            { title: 'Khái niệm trọng tâm', lessons: ['Định nghĩa, kí hiệu và điều kiện áp dụng', 'Phân biệt ví dụ đúng và trường hợp dễ nhầm'] },
            { title: 'Phương pháp giải', lessons: ['Giải bài theo từng bước có giải thích', 'Kiểm tra kết quả bằng cách thứ hai'] },
            { title: 'Đọc hiểu và phân tích', lessons: ['Xác định dữ kiện, từ khóa và yêu cầu', 'Giải thích kết quả bằng bằng chứng'] },
            { title: 'Vận dụng thực tế', lessons: ['Giải quyết tình huống gần với đời sống', 'Phát hiện lỗi và sửa lời giải'] },
            { title: 'Củng cố và đánh giá', lessons: ['Luyện tập độc lập theo mức độ', 'Bài kiểm tra tổng hợp riêng cho chủ đề'] }
        ]
    },
    UNIVERSITY: {
        label: 'Đại học và kỹ năng nghề nghiệp', subjectId: 'university_skills', chapters: [
            { title: 'Bối cảnh và nền tảng', lessons: ['Xác định vấn đề, phạm vi và tiêu chí thành công', 'Ôn tập kiến thức tiên quyết'] },
            { title: 'Mô hình và phương pháp', lessons: ['Lựa chọn phương pháp phù hợp', 'Lập kế hoạch và phân rã nhiệm vụ'] },
            { title: 'Thực hành có hướng dẫn', lessons: ['Làm mẫu qua một tình huống thực tế', 'Phân tích một trường hợp và các phương án'] },
            { title: 'Công cụ và quy trình', lessons: ['Sử dụng công cụ để tạo đầu ra có kiểm chứng', 'Kiểm soát chất lượng và quản lý phiên bản'] },
            { title: 'Dự án ứng dụng', lessons: ['Xây dựng sản phẩm hoặc báo cáo', 'Thu thập bằng chứng và đánh giá kết quả'] },
            { title: 'Đánh giá năng lực', lessons: ['Bài kiểm tra kiến thức của học phần', 'Trình bày sản phẩm và kế hoạch cải tiến'] }
        ]
    }
};

function inferTrack(target = {}) {
    const text = `${target.prompt || ''} ${target.targetExam || ''} ${target.targetVariant || ''} ${target.domain || ''} ${target.subjectId || ''} ${target.major || ''}`.toLowerCase();
    if (/toeic|listening part|reading part|english test/.test(text)) return 'TOEIC';
    if (/mos|microsoft office|word|excel|powerpoint|office specialist/.test(text)) return 'MOS';
    const declaredGrade = Number(target.grade || target.education?.grade || target.educationContext?.grade || String(text).match(/lớp\s*(1[0-2]|[1-9])/i)?.[1]) || 0;
    const schoolCourse = (declaredGrade >= 1 && declaredGrade <= 12) || /k12|phổ thông|tiểu học|thcs|thpt/.test(text);
    if (schoolCourse) return 'K12';
    if (/program|lập trình|lap trinh|coding|code|c\+\+|python|javascript|java|data structure|tin học|computer science|cntt/.test(text)) return 'IT';
    return 'UNIVERSITY';
}

function question({ topic, prompt, answer, options, explanation, skill, type = 'single_choice', media = {} }) {
    return { type, prompt, options, answer, acceptedAnswers: [answer], explanation, points: 1, difficulty: 'FOUNDATION', skill: skill || topic, media, tags: [topic], cognitiveLevel: 'UNDERSTAND' };
}
function makeLessonQuestions({ topic, track, grade, index }) {
    const first = question({ topic, prompt: `Mục tiêu trực tiếp của bài “${topic}” là gì?`, options: [`Áp dụng ${topic.toLowerCase()} vào nhiệm vụ của bài`, 'Ghi nhớ tên bài mà không cần giải thích', 'Bỏ qua dữ kiện và làm theo cảm tính', 'Chỉ đọc đáp án mẫu'], answer: `Áp dụng ${topic.toLowerCase()} vào nhiệm vụ của bài`, explanation: 'Mục tiêu bài học phải gắn với kiến thức và đầu ra có thể kiểm tra.', skill: topic });
    const second = question({ topic, prompt: `Khi bắt đầu một nhiệm vụ về “${topic}”, thao tác nào nên làm trước?`, options: ['Đọc yêu cầu, xác định dữ kiện và kết quả cần tạo', 'Nộp bài trước khi làm', 'Chọn ngẫu nhiên một đáp án', 'Bỏ qua tiêu chí hoàn thành'], answer: 'Đọc yêu cầu, xác định dữ kiện và kết quả cần tạo', explanation: 'Phân tích yêu cầu giúp chọn đúng kiến thức và tránh làm sai nhiệm vụ.', skill: topic });
    const third = question({ topic, prompt: `Dấu hiệu nào cho thấy em hiểu “${topic}” thay vì chỉ học thuộc?`, options: ['Giải thích được vì sao và áp dụng vào ví dụ mới', 'Chỉ đọc lại tiêu đề', 'Nhớ một câu nhưng không biết dùng', 'Không cần kiểm tra kết quả'], answer: 'Giải thích được vì sao và áp dụng vào ví dụ mới', explanation: 'Hiểu bản chất thể hiện qua giải thích, vận dụng và kiểm tra.', skill: topic });
    const fourth = question({ topic, prompt: `Nếu kết quả bài làm về “${topic}” có vẻ không hợp lý, em nên làm gì?`, options: ['Kiểm tra dữ kiện, từng bước và thử cách xác minh khác', 'Xóa toàn bộ bài ngay', 'Đổi đáp án ngẫu nhiên', 'Bỏ qua vì đã làm xong'], answer: 'Kiểm tra dữ kiện, từng bước và thử cách xác minh khác', explanation: 'Kiểm chứng có hệ thống giúp tìm nguyên nhân sai và sửa đúng.', skill: topic });
    const fifth = question({ topic, prompt: `Bằng chứng nào hữu ích nhất khi tự đánh giá bài “${topic}”?`, options: ['Sản phẩm/lời giải đối chiếu với tiêu chí rõ ràng', 'Thời gian mở trang web', 'Số lần bấm nút', 'Tên tệp không có nội dung'], answer: 'Sản phẩm/lời giải đối chiếu với tiêu chí rõ ràng', explanation: 'Tự đánh giá cần dựa vào tiêu chí và kết quả thực tế.', skill: topic });
    const sixth = question({ topic, prompt: `Khi gặp bài khó về “${topic}”, chiến lược nào hiệu quả?`, options: ['Chia thành phần nhỏ, giải từng bước và ghi điểm chưa chắc', 'Bỏ qua mọi bước', 'Chép nguyên ví dụ mà không hiểu', 'Không đọc lại yêu cầu'], answer: 'Chia thành phần nhỏ, giải từng bước và ghi điểm chưa chắc', explanation: 'Phân rã nhiệm vụ giúp quản lý độ khó và phát hiện lỗ hổng kiến thức.', skill: topic });
    const seventh = question({ topic, prompt: `Sau khi hoàn thành một bài luyện về “${topic}”, việc tiếp theo tốt nhất là gì?`, options: ['Xem phản hồi, sửa lỗi và thử một biến thể mới', 'Xem điểm rồi đóng bài ngay', 'Bỏ qua mọi lỗi', 'Lặp lại y nguyên mà không xem phản hồi'], answer: 'Xem phản hồi, sửa lỗi và thử một biến thể mới', explanation: 'Học tập hiệu quả gồm thử, nhận phản hồi, sửa và vận dụng.', skill: topic });
    const questions = [first, second, third, fourth, fifth, sixth, seventh];
    if (track === 'IT') {
        const topicText = topic.toLowerCase();
        let task = { statement: 'Đọc hai số nguyên a và b, in tổng a + b.', inputFormat: 'Hai số nguyên a và b, cách nhau bởi khoảng trắng.', outputFormat: 'In a + b trên một dòng.', starterCode: '#include <iostream>\nusing namespace std;\nint main(){\n    long long a, b;\n    // TODO: đọc a, b và in tổng\n    return 0;\n}', publicTestCases: [{ input: '2 3\n', expectedOutput: '5', weight: 1 }, { input: '-4 9\n', expectedOutput: '5', weight: 1 }], hiddenTestCases: [{ input: '0 0\n', expectedOutput: '0', weight: 1 }, { input: '100 250\n', expectedOutput: '350', weight: 1 }] };
        if (/rẽ nhánh|điều kiện|if|condition|phân loại/.test(topicText)) task = { statement: 'Đọc số nguyên n. In POSITIVE nếu n > 0, NEGATIVE nếu n < 0, nếu không in ZERO.', inputFormat: 'Một số nguyên n.', outputFormat: 'Một trong ba từ POSITIVE, NEGATIVE hoặc ZERO.', starterCode: '#include <iostream>\nusing namespace std;\nint main(){\n    long long n; cin >> n;\n    // TODO: phân loại n\n    return 0;\n}', publicTestCases: [{ input: '8\n', expectedOutput: 'POSITIVE', weight: 1 }, { input: '-3\n', expectedOutput: 'NEGATIVE', weight: 1 }], hiddenTestCases: [{ input: '0\n', expectedOutput: 'ZERO', weight: 1 }, { input: '1\n', expectedOutput: 'POSITIVE', weight: 1 }] };
        else if (/vòng lặp|lặp|loop|sum 1|tổng từ/.test(topicText)) task = { statement: 'Đọc n (0 ≤ n ≤ 100000). Tính tổng các số nguyên từ 1 đến n.', inputFormat: 'Một số nguyên n.', outputFormat: 'Tổng 1 + 2 + … + n.', starterCode: '#include <iostream>\nusing namespace std;\nint main(){\n    long long n; cin >> n;\n    // TODO: tính tổng từ 1 đến n\n    return 0;\n}', publicTestCases: [{ input: '5\n', expectedOutput: '15', weight: 1 }, { input: '1\n', expectedOutput: '1', weight: 1 }], hiddenTestCases: [{ input: '0\n', expectedOutput: '0', weight: 1 }, { input: '100\n', expectedOutput: '5050', weight: 1 }] };
        else if (/hàm|tham số|giá trị trả về|factorial/.test(topicText)) task = { statement: 'Viết hàm tính n! và in kết quả với 0 ≤ n ≤ 20.', inputFormat: 'Một số nguyên n.', outputFormat: 'Giá trị giai thừa n!.', starterCode: '#include <iostream>\nusing namespace std;\nlong long factorial(int n){ /* TODO */ return 0; }\nint main(){ int n; cin >> n; cout << factorial(n) << \"\n\"; }', publicTestCases: [{ input: '5\n', expectedOutput: '120', weight: 1 }, { input: '0\n', expectedOutput: '1', weight: 1 }], hiddenTestCases: [{ input: '1\n', expectedOutput: '1', weight: 1 }, { input: '10\n', expectedOutput: '3628800', weight: 1 }] };
        else if (/mảng|array|chuỗi|duyệt dữ liệu/.test(topicText)) task = { statement: 'Đọc n rồi n số nguyên. In giá trị lớn nhất của mảng.', inputFormat: 'Dòng 1: n (1 ≤ n ≤ 100000). Dòng 2: n số nguyên.', outputFormat: 'Giá trị lớn nhất.', starterCode: '#include <iostream>\n#include <vector>\nusing namespace std;\nint main(){ int n; cin >> n; vector<long long>a(n); for(auto &x:a) cin >> x; // TODO\n}', publicTestCases: [{ input: '5\n1 7 2 9 4\n', expectedOutput: '9', weight: 1 }, { input: '3\n-8 -2 -5\n', expectedOutput: '-2', weight: 1 }], hiddenTestCases: [{ input: '1\n42\n', expectedOutput: '42', weight: 1 }, { input: '4\n0 0 0 0\n', expectedOutput: '0', weight: 1 }] };
        else if (/sắp xếp|sort|kiểm thử|debug|dự án|hoàn thiện/.test(topicText)) task = { statement: 'Đọc n và n số nguyên, in chúng theo thứ tự tăng dần, cách nhau bởi một dấu cách.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'Dãy tăng dần trên một dòng.', starterCode: '#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\nint main(){ int n; cin >> n; vector<long long>a(n); for(auto &x:a) cin >> x; // TODO sort và in\n}', publicTestCases: [{ input: '5\n4 1 3 2 5\n', expectedOutput: '1 2 3 4 5', weight: 1 }, { input: '3\n-1 -4 2\n', expectedOutput: '-4 -1 2', weight: 1 }], hiddenTestCases: [{ input: '1\n7\n', expectedOutput: '7', weight: 1 }, { input: '4\n2 2 1 1\n', expectedOutput: '1 1 2 2', weight: 1 }] };
        const programmingTask = { title: `Bài coding: ${topic}`, ...task, constraints: ['Dùng đúng định dạng input/output đã nêu.', 'Xử lý các trường hợp biên trong test.'], language: 'cpp', supportedLanguages: ['cpp', 'python', 'javascript'] };
        questions.push(question({ topic, type: 'coding', prompt: `Bài thực hành lập trình theo chủ đề: ${topic}. ${task.statement} Hoàn thành code và chạy test.`, answer: '', explanation: 'Bài được chấm bằng test input/output từ executor biệt lập; test ẩn được giữ ở máy chủ.', skill: topic, media: { coding: programmingTask } }));
    } else if (track === 'MOS') {
        questions.push(question({ topic, type: 'practical', prompt: `Thực hành: ${topic}`, answer: '', explanation: 'Đối chiếu sản phẩm theo checklist và rubric; cần nộp bằng chứng thực tế.', skill: topic, media: { task: `Tạo một sản phẩm áp dụng “${topic}” bằng ứng dụng phù hợp.`, deliverable: 'Tệp DOCX/XLSX/PPTX tương ứng hoặc đường dẫn sản phẩm và mô tả thao tác.', tools: 'Microsoft Word, Excel hoặc PowerPoint theo yêu cầu', steps: ['Đọc kỹ yêu cầu và lưu bản làm việc', 'Thực hiện đúng thao tác được yêu cầu', 'Kiểm tra bố cục, dữ liệu, lỗi và lưu lại', 'Nộp tệp sản phẩm cùng mô tả ngắn'], rubric: [{ criterion: 'Đúng yêu cầu', weight: 40 }, { criterion: 'Định dạng và tổ chức', weight: 25 }, { criterion: 'Kiểm tra chất lượng', weight: 20 }, { criterion: 'Giải thích thao tác', weight: 15 }] } }));
    } else {
        questions.push(question({ topic, prompt: `Trong tình huống thực tế, cách nào giúp kiểm tra lời giải về “${topic}”?`, options: ['Đối chiếu điều kiện ban đầu, đơn vị/ý nghĩa và một cách kiểm tra khác', 'Chỉ xem lời giải có dài hay không', 'Chọn kết quả lớn nhất', 'Không cần xem lại dữ kiện'], answer: 'Đối chiếu điều kiện ban đầu, đơn vị/ý nghĩa và một cách kiểm tra khác', explanation: 'Lời giải phải phù hợp dữ kiện và được kiểm tra bằng một cách độc lập.', skill: topic }));
    }
    return questions;
}

const DEBUG_TESTING_LESSONS = [
    { chapter: 'Nhận diện và tái hiện lỗi', title: 'Phân biệt lỗi cú pháp, lỗi lúc chạy và lỗi logic' },
    { chapter: 'Nhận diện và tái hiện lỗi', title: 'Tái hiện lỗi bằng đầu vào tối thiểu' },
    { chapter: 'Đọc lỗi và truy vết', title: 'Đọc stack trace và xác định vị trí cần kiểm tra' },
    { chapter: 'Thiết kế kiểm thử', title: 'Thiết kế test case theo phân vùng và giá trị biên' },
    { chapter: 'Thiết kế kiểm thử', title: 'Viết unit test với Arrange–Act–Assert' },
    { chapter: 'Gỡ lỗi có phương pháp', title: 'Dùng breakpoint và quan sát trạng thái chương trình' },
    { chapter: 'Gỡ lỗi có phương pháp', title: 'Viết regression test sau khi sửa lỗi' },
    { chapter: 'Hoàn thiện chất lượng', title: 'Báo cáo lỗi, tìm nguyên nhân gốc và xác minh bản sửa' }
];
function isDebugTestingTarget(value) {
    return /\bdebug(?:ging)?\b|kiểm thử|kiem thu|unit\s*test|testing|test\s*case|stack\s*trace|breakpoint|regression|hồi quy|sửa lỗi phần mềm|sua loi phan mem/i.test(String(value || ''));
}
function buildDebugTestingLesson(topic) {
    const title = String(topic || '').toLowerCase();
    const sections = [];
    let examples = [];
    let practiceTasks = [];
    let script = '';
    let mistakes = [];
    let checks = [];
    if (/phân biệt lỗi|loại lỗi|cú pháp/.test(title)) {
        sections.push(
            { title: 'Ba nhóm lỗi cần phân biệt', content: 'Lỗi cú pháp/biên dịch khiến chương trình không được tạo hoặc không được phân tích cú pháp. Lỗi lúc chạy xuất hiện khi chương trình đang thực thi, chẳng hạn chia cho 0 hoặc truy cập giá trị không hợp lệ. Lỗi logic vẫn cho chương trình chạy nhưng kết quả sai. Cách xử lý phải dựa trên dấu hiệu quan sát được, không đoán theo tên thông báo.' },
            { title: 'Quy trình phân loại', content: 'Ghi lại thông báo và bước gây lỗi; xác định chương trình có biên dịch được không; kiểm tra lỗi có xuất hiện trong lúc thực thi không; nếu chương trình chạy hoàn tất, so sánh kết quả thực tế với kết quả mong đợi. Tạo đầu vào nhỏ có thể lặp lại để phân biệt các giả thuyết.' },
            { title: 'Ví dụ có hướng dẫn', content: 'Thiếu dấu ngoặc đóng thường gây lỗi cú pháp. Truy cập phần tử ngoài phạm vi có thể gây lỗi lúc chạy hoặc hành vi không xác định tùy ngôn ngữ. Dùng điều kiện i <= n thay vì i < n có thể là lỗi logic/off-by-one nếu mảng có n phần tử đánh chỉ số từ 0 đến n−1.' }
        );
        examples = [
            { title: 'Chương trình không biên dịch', problem: 'Một câu lệnh C++ thiếu dấu chấm phẩy và compiler báo lỗi tại dòng kế tiếp.', solution: 'Kiểm tra dòng được báo và các dòng ngay trước đó; sửa cú pháp rồi biên dịch lại. Chưa nên thay đổi thuật toán vì lỗi đang nằm ở cú pháp.' },
            { title: 'Chương trình chạy nhưng sai', problem: 'Vòng lặp duyệt mảng n phần tử với i <= n và đọc a[n].', solution: 'Với mảng đánh chỉ số từ 0 đến n−1, đổi điều kiện thành i < n nếu mục đích là duyệt toàn bộ phần tử. Kiểm thử n=1 và n ở giới hạn để xác minh.' }
        ];
        script = 'Bài này giúp phân loại lỗi trước khi sửa: xác nhận có biên dịch thành công hay không, tái hiện lỗi lúc chạy, rồi đối chiếu kết quả để tìm lỗi logic. Mỗi sửa đổi phải có cách kiểm chứng.';
        mistakes = ['Xem mọi thông báo đỏ là lỗi logic.', 'Sửa nhiều chỗ cùng lúc khiến không xác định được thay đổi nào có tác dụng.', 'Chỉ kiểm tra bằng một đầu vào thông thường.'];
        checks = ['Tôi có phân biệt được lỗi biên dịch, lỗi lúc chạy và lỗi logic không?', 'Tôi có một đầu vào tái hiện lỗi không?', 'Tôi đã kiểm tra lại kết quả sau khi sửa chưa?'];
    } else if (/đầu vào tối thiểu|tái hiện/.test(title)) {
        sections.push(
            { title: 'Tái hiện trước khi sửa', content: 'Một lỗi chỉ có thể điều tra đáng tin cậy khi có các bước tái hiện rõ ràng. Ghi lại đầu vào, trạng thái trước khi chạy, các thao tác và kết quả thực tế. Chạy lại ít nhất hai lần để biết lỗi có ổn định hay phụ thuộc trạng thái.' },
            { title: 'Thu nhỏ ca lỗi', content: 'Loại bỏ dữ liệu và bước không cần thiết từng phần nhưng vẫn giữ lỗi xuất hiện. Với danh sách đầu vào, thử giảm số phần tử; với chuỗi, rút ngắn chuỗi; với nhiều bước, bỏ từng bước để xác định điều kiện tối thiểu. Không thay đổi nhiều biến cùng lúc.' },
            { title: 'Kết luận có thể kiểm chứng', content: 'Lưu ca lỗi tối thiểu cùng kết quả mong đợi và kết quả thực tế. Ca này dùng làm test hồi quy sau khi sửa. Nếu không thể tái hiện ổn định, ghi rõ điều kiện môi trường và dữ liệu còn thiếu, không tuyên bố đã tìm ra nguyên nhân.' }
        );
        examples = [
            { title: 'Rút gọn dữ liệu gây lỗi', problem: 'Một chương trình thất bại với tệp chứa 500 dòng.', solution: 'Tạo bản sao rồi giảm một nửa số dòng, chạy lại và giữ phần vẫn tái hiện lỗi. Lặp lại đến khi còn dữ liệu nhỏ nhất đủ làm lỗi xuất hiện; không sửa tệp nguồn ban đầu.' },
            { title: 'Lỗi phụ thuộc thứ tự', problem: 'Một lỗi chỉ xuất hiện sau khi người dùng mở rồi đóng hộp thoại.', solution: 'Ghi đúng chuỗi thao tác và trạng thái trước mỗi bước. Thử bỏ từng thao tác để tìm điều kiện cần cho lỗi; lưu chuỗi thao tác thành kịch bản tái hiện.' }
        ];
        script = 'Không bắt đầu bằng cách sửa đoán. Trước hết hãy tái hiện lỗi, rồi thu nhỏ dữ liệu hoặc các bước thao tác đến ca tối thiểu. Ca đó trở thành bằng chứng và test hồi quy.';
        mistakes = ['Thu nhỏ dữ liệu nhưng vô tình làm mất điều kiện gây lỗi.', 'Không ghi lại phiên bản hoặc bước thao tác.', 'Cho rằng lỗi đã hết chỉ vì một lần chạy không gặp lại.'];
        checks = ['Tôi có thể tái hiện lỗi lặp lại không?', 'Tôi có lưu đầu vào nhỏ nhất gây lỗi không?', 'Tôi có thể mô tả chính xác các bước tái hiện không?'];
    } else if (/stack trace|vị trí cần kiểm tra/.test(title)) {
        sections.push(
            { title: 'Đọc thông báo và call stack', content: 'Đọc loại exception/error, thông điệp, tệp và số dòng. Trong call stack, ưu tiên các frame thuộc mã của dự án và lần theo chuỗi lời gọi liên quan; vị trí đầu tiên hiển thị không phải lúc nào cũng là nguyên nhân gốc nếu lỗi phát sinh từ dữ liệu trước đó.' },
            { title: 'Khoanh vùng dữ liệu', content: 'Kiểm tra giá trị đầu vào và biến ngay trước dòng lỗi. So sánh với bất biến mà hàm yêu cầu, ví dụ mảng phải có phần tử hoặc đối tượng không được null. Tạm thêm log có cấu trúc hoặc breakpoint nhưng không ghi token, mật khẩu hay dữ liệu cá nhân.' },
            { title: 'Từ triệu chứng đến nguyên nhân', content: 'Lần theo dữ liệu từ nơi được tạo đến nơi lỗi xuất hiện. Xác định lần đầu tiên trạng thái không còn đúng, sau đó sửa tại nguồn hoặc bổ sung kiểm tra điều kiện phù hợp. Xác minh bằng ca lỗi nhỏ và bộ test liên quan.' }
        );
        examples = [
            { title: 'Lỗi truy cập thuộc tính null', problem: 'Stack trace chỉ đến lệnh user.profile.name, nhưng user được lấy từ API trước đó.', solution: 'Kiểm tra response tại ranh giới API và hợp đồng dữ liệu. Nếu user vắng mặt là trạng thái hợp lệ, xử lý trạng thái đó; nếu không, sửa nơi tạo dữ liệu. Không chỉ thêm optional chaining để che mất lỗi hợp đồng.' },
            { title: 'Lỗi ở hàm được gọi sâu', problem: 'Thông báo ném lỗi ở hàm C nhưng dữ liệu sai được truyền từ hàm A qua B.', solution: 'Lần theo call stack và kiểm tra tham số tại từng ranh giới. Tìm điểm đầu tiên giá trị vi phạm điều kiện; thêm assertion hoặc validation thích hợp tại ranh giới đó.' }
        ];
        script = 'Stack trace là bản đồ để lần theo luồng gọi, không phải lời giải tự động. Hãy kết hợp dòng lỗi với giá trị đầu vào, hợp đồng hàm và điểm đầu tiên dữ liệu sai.';
        mistakes = ['Sửa ngay dòng được báo mà không kiểm tra nguồn dữ liệu.', 'Đưa dữ liệu bí mật vào log để debug.', 'Bỏ qua frame thuộc mã ứng dụng vì thông báo nhắc tới thư viện.'];
        checks = ['Tôi đã xác định frame liên quan trong mã dự án chưa?', 'Tôi biết biến nào vi phạm điều kiện không?', 'Tôi đã lần ngược đến nơi tạo dữ liệu sai chưa?'];
    } else if (/giá trị biên|phân vùng|test case/.test(title)) {
        sections.push(
            { title: 'Phân vùng tương đương', content: 'Chia miền đầu vào thành các nhóm dự kiến được xử lý giống nhau, ví dụ hợp lệ, nhỏ hơn giới hạn và lớn hơn giới hạn. Chọn đại diện từ từng nhóm để giảm số test nhưng vẫn kiểm tra các nhánh quan trọng.' },
            { title: 'Kiểm tra giá trị biên', content: 'Lỗi thường tập trung tại giới hạn và quanh giới hạn. Với miền hợp lệ từ 1 đến 100, thử 0, 1, 2, 99, 100 và 101. Xác định rõ giới hạn có bao gồm hai đầu hay không; không chọn expected output bằng phỏng đoán.' },
            { title: 'Bộ test có thể giải thích', content: 'Mỗi test cần mô tả mục đích, đầu vào, kết quả mong đợi và quy tắc làm căn cứ. Kết hợp trường hợp thường gặp, biên, rỗng, một phần tử, dữ liệu lớn và dữ liệu không hợp lệ theo hợp đồng bài toán.' }
        );
        examples = [
            { title: 'Kiểm tra miền điểm', problem: 'Một hàm chấp nhận điểm nguyên từ 0 đến 10, kể cả hai đầu.', solution: 'Dùng -1, 0, 1, 9, 10 và 11. Các giá trị 0 và 10 phải được chấp nhận; -1 và 11 phải bị từ chối. Các giá trị giữa giúp kiểm tra miền hợp lệ.' },
            { title: 'Mảng có ít phần tử', problem: 'Hàm tìm giá trị lớn nhất của mảng không rỗng.', solution: 'Thử mảng một phần tử, hai phần tử tăng/giảm, số âm, các phần tử bằng nhau và kích thước lớn. Nếu mảng rỗng không thuộc hợp đồng, phải kiểm tra validation riêng thay vì gán đáp án giả.' }
        ];
        script = 'Hãy xác định miền hợp lệ trước khi viết test. Kiểm tra các giá trị ngay trước, đúng tại và ngay sau giới hạn, đồng thời ghi rõ căn cứ cho từng kết quả mong đợi.';
        mistakes = ['Chỉ dùng dữ liệu trung bình.', 'Không xác định rõ giới hạn có bao gồm đầu mút.', 'Đặt expected output theo kết quả chương trình thay vì theo đặc tả.'];
        checks = ['Tôi đã kiểm tra cả hai phía của ranh giới chưa?', 'Mỗi expected output có căn cứ từ đặc tả không?', 'Tôi có bao phủ đầu vào rỗng và kích thước nhỏ khi phù hợp không?'];
    } else if (/unit test|arrange|assertion/.test(title)) {
        sections.push(
            { title: 'Arrange – Act – Assert', content: 'Arrange chuẩn bị dữ liệu và phụ thuộc; Act gọi đúng hành vi đang kiểm thử; Assert so sánh kết quả thực tế với kết quả mong đợi. Mỗi test nên kiểm tra một hành vi chính để khi thất bại có thể xác định nguyên nhân.' },
            { title: 'Cô lập và tính lặp lại', content: 'Unit test nên tập trung vào đơn vị nhỏ, tránh phụ thuộc mạng hoặc database thật nếu không cần. Dùng dependency injection hoặc test double khi phù hợp. Test phải độc lập thứ tự chạy và không dùng thời gian/ngẫu nhiên không kiểm soát.' },
            { title: 'Kiểm tra cả trường hợp lỗi', content: 'Ngoài kết quả bình thường, kiểm tra dữ liệu biên và lỗi theo hợp đồng. Assertion phải cụ thể: giá trị, kiểu, trạng thái hoặc exception mong đợi. Test chỉ xác nhận hàm được gọi chưa đủ nếu không kiểm tra đầu ra.' }
        );
        examples = [
            { title: 'Unit test cho hàm cộng', problem: 'Hàm add(a,b) phải trả tổng của hai số.', solution: 'Arrange: a=2, b=3. Act: gọi add. Assert: kết quả bằng 5. Bổ sung test với số âm và 0; không để test phụ thuộc dữ liệu từ mạng.' },
            { title: 'Kiểm tra lỗi theo hợp đồng', problem: 'Hàm parseAge phải từ chối chuỗi không phải số.', solution: 'Tạo test với một chuỗi không hợp lệ và assert rằng hàm trả về kết quả validation hoặc ném loại lỗi đã được đặc tả. Không chấp nhận test pass chỉ vì chương trình không crash.' }
        ];
        script = 'Một unit test tốt có cấu trúc Arrange–Act–Assert, một mục tiêu rõ ràng và kết quả mong đợi cụ thể. Hãy kiểm tra cả đầu vào hợp lệ lẫn hành vi lỗi đã được đặc tả.';
        mistakes = ['Một test kiểm tra quá nhiều hành vi.', 'Test phụ thuộc thứ tự chạy hoặc dịch vụ bên ngoài.', 'Assertion quá rộng nên lỗi thật vẫn pass.'];
        checks = ['Test có một hành vi chính không?', 'Assertion có kiểm tra giá trị mong đợi không?', 'Test có chạy độc lập và lặp lại được không?'];
    } else if (/breakpoint|trạng thái chương trình|debug có phương pháp/.test(title)) {
        sections.push(
            { title: 'Chọn điểm dừng', content: 'Đặt breakpoint ngay trước nơi kết quả bắt đầu sai hoặc tại nhánh nghi ngờ. Quan sát giá trị đầu vào, trạng thái trước và sau lời gọi hàm, điều kiện nhánh và biến vòng lặp.' },
            { title: 'Đi qua lệnh có mục đích', content: 'Step over chạy qua lời gọi hiện tại; step into đi vào hàm được gọi; step out tiếp tục đến khi thoát hàm. Dùng watch hoặc conditional breakpoint khi lỗi chỉ xảy ra với một giá trị. Tên thao tác có thể khác đôi chút giữa các trình gỡ lỗi.' },
            { title: 'Xác định thay đổi đầu tiên sai', content: 'Theo dõi biến qua từng bước và xác định nơi trạng thái lệch khỏi kỳ vọng. So sánh giả thuyết với bằng chứng; sửa một nguyên nhân mỗi lần và giữ ca tái hiện để xác minh.' }
        );
        examples = [
            { title: 'Biến bị đổi ngoài dự kiến', problem: 'Hàm xử lý danh sách nhận đúng dữ liệu nhưng trả về danh sách bị thiếu phần tử.', solution: 'Đặt breakpoint trước vòng lặp và tại lệnh xóa phần tử. Theo dõi chỉ số, kích thước và điều kiện thoát; kiểm tra xem việc thay đổi collection có làm bỏ qua phần tử tiếp theo hay không.' },
            { title: 'Lỗi chỉ gặp với một mã người dùng', problem: 'Bug chỉ xuất hiện với một giá trị userId cụ thể.', solution: 'Dùng conditional breakpoint hoặc test cố định với userId đã được ẩn danh. Ghi lại điều kiện trạng thái gây lỗi và không đưa dữ liệu cá nhân thật vào log chia sẻ.' }
        ];
        script = 'Gỡ lỗi bằng cách quan sát trạng thái tại điểm phù hợp, đi từng bước có mục tiêu và xác định thay đổi đầu tiên sai. Không sửa dựa trên phỏng đoán khi chưa thấy bằng chứng.';
        mistakes = ['Đặt breakpoint quá xa nơi trạng thái sai đầu tiên xuất hiện.', 'Tiếp tục bước mà không biết đang kiểm tra giả thuyết gì.', 'Chia sẻ log có token hoặc dữ liệu cá nhân.'];
        checks = ['Tôi biết biến nào đang sai và sai từ bước nào không?', 'Tôi có thể tái hiện trạng thái bằng test cố định không?', 'Tôi đã kiểm tra giả thuyết bằng bằng chứng chưa?'];
    } else if (/regression|hồi quy/.test(title)) {
        sections.push(
            { title: 'Chuyển lỗi thành test', content: 'Sau khi tái hiện lỗi, viết một test thất bại trước khi sửa nếu có thể. Test phải thể hiện điều kiện lỗi và kết quả đúng theo yêu cầu, để việc sửa sau này không làm lỗi xuất hiện trở lại.' },
            { title: 'Chạy lại vùng ảnh hưởng', content: 'Sau khi sửa, chạy test hồi quy vừa tạo, test của module liên quan và các test gần ranh giới. Với thay đổi có phạm vi rộng, chạy toàn bộ suite CI. Một test xanh đơn lẻ không chứng minh không có tác dụng phụ.' },
            { title: 'Đánh giá thay đổi', content: 'So sánh hành vi trước/sau và xem lại các cảnh báo. Không xóa hoặc nới assertion chỉ để pipeline xanh; nếu yêu cầu thay đổi, cập nhật đặc tả và ghi lý do rõ ràng.' }
        );
        examples = [
            { title: 'Sửa lỗi chỉ số', problem: 'Vòng lặp bỏ qua phần tử cuối khi duyệt mảng.', solution: 'Tạo test với mảng một phần tử và nhiều phần tử trước khi sửa. Sau khi đổi điều kiện vòng lặp, chạy lại test này và các test mảng rỗng/giới hạn theo đặc tả.' },
            { title: 'Thay đổi hàm dùng chung', problem: 'Một hàm format được sửa để xử lý dấu âm.', solution: 'Chạy test mới cho số âm, test định dạng số dương hiện có và tất cả module gọi hàm đó. Kiểm tra output và side effect thay vì chỉ kiểm tra chương trình có chạy.' }
        ];
        script = 'Test hồi quy bảo vệ hệ thống khỏi lỗi đã từng xảy ra. Hãy viết test thể hiện lỗi, xác minh test thất bại trước sửa nếu có thể, sau đó chạy lại test mới và vùng chức năng bị ảnh hưởng.';
        mistakes = ['Chỉ chạy test vừa thêm mà bỏ test liên quan.', 'Xóa test cũ vì nó làm pipeline thất bại.', 'Bỏ qua việc xác minh test thực sự bắt được lỗi.'];
        checks = ['Test mới có tái hiện đúng lỗi cũ không?', 'Test có thất bại trước sửa và pass sau sửa không?', 'Tôi đã chạy test hồi quy ở vùng ảnh hưởng chưa?'];
    } else {
        sections.push(
            { title: 'Thông tin bắt buộc của bug report', content: 'Một báo cáo lỗi hữu ích có phiên bản ứng dụng, môi trường, điều kiện tiên quyết, các bước tái hiện, đầu vào, kết quả mong đợi và kết quả thực tế. Đính kèm log hoặc ảnh khi giúp thu hẹp nguyên nhân.' },
            { title: 'Tách triệu chứng khỏi nguyên nhân', content: 'Mô tả quan sát được bằng dữ kiện, không đưa phỏng đoán thành kết luận. Có thể thêm giả thuyết, nhưng ghi rõ đó là giả thuyết và bằng chứng cần thu thập. Một ca tái hiện nhỏ thường hữu ích hơn một mô tả dài nhưng thiếu bước.' },
            { title: 'Xác minh bản sửa', content: 'Sau khi sửa, chạy các bước tái hiện cũ và test hồi quy. Ghi lại phiên bản đã thử, kết quả thực tế và giới hạn còn lại. Xóa hoặc che API key, mật khẩu, token và thông tin cá nhân trước khi đính kèm dữ liệu.' }
        );
        examples = [
            { title: 'Báo cáo lỗi có thể tái hiện', problem: 'Trang tính điểm hiện NaN khi nhập ô trống.', solution: 'Ghi phiên bản, trình duyệt, dữ liệu tối thiểu, các bước nhập và bấm lưu, expected output và actual output. Đính kèm ảnh/log đã loại bỏ thông tin nhạy cảm.' },
            { title: 'Kiểm tra nguyên nhân gốc', problem: 'Một bản sửa thêm giá trị mặc định 0 nhưng chưa xác minh ô trống có nghĩa là 0 hay chưa nhập.', solution: 'Đối chiếu đặc tả dữ liệu và hành vi mong đợi. Phân biệt thiếu dữ liệu với giá trị số 0; viết test cho cả hai trường hợp trước khi kết luận bản sửa đúng.' }
        ];
        script = 'Báo cáo lỗi cần đủ dữ kiện để người khác tái hiện, nhưng không nên khẳng định nguyên nhân khi chưa có bằng chứng. Sau bản sửa, hãy chạy lại đúng các bước cũ và lưu kết quả xác minh.';
        mistakes = ['Chỉ viết “không chạy” mà không nêu bước tái hiện.', 'Lẫn lộn kết quả mong đợi và kết quả thực tế.', 'Đính kèm token, mật khẩu hoặc dữ liệu cá nhân.'];
        checks = ['Báo cáo có phiên bản, bước tái hiện và input không?', 'Expected và actual có tách biệt không?', 'Log đã được loại bỏ dữ liệu nhạy cảm chưa?'];
    }
    const questions = buildDebugTestingQuestions(topic);
    return { theorySections: sections, examples, practiceTasks: [
        { type: 'GUIDED', title: 'Bài có hướng dẫn', instruction: `Dùng ví dụ trong bài “${topic}”, ghi lại từng bước và giải thích bằng chứng dùng để chọn cách xử lý.`, hint: 'Trước khi sửa, hãy nêu giả thuyết và dữ liệu kiểm chứng.', deliverable: 'Ca kiểm thử hoặc ghi chú debug có thể lặp lại.' },
        { type: 'INDEPENDENT', title: 'Bài làm độc lập', instruction: `Tạo một tình huống mới liên quan đến “${topic}”, nêu đầu vào, kết quả mong đợi, thao tác kiểm tra và kết luận.`, hint: 'Chỉ kết luận nguyên nhân khi dữ liệu đủ để xác minh.', deliverable: 'Test case hoặc bug report có căn cứ.' },
        { type: 'REAL_WORLD', title: 'Vận dụng vào dự án', instruction: `Áp dụng quy trình “${topic}” cho một hàm hoặc chức năng nhỏ; lưu cách tái hiện và bằng chứng trước/sau khi sửa.`, deliverable: 'Test hồi quy và mô tả lý do sửa.' }
    ], lectureScript: `${script} Hãy ghi lại kết quả mong đợi, bằng chứng thực tế và chạy lại bài kiểm thử sau mỗi sửa đổi.`, commonMistakes: mistakes, quickChecks: checks, questions };
}
function buildDebugTestingQuestions(topic) {
    const title = String(topic || '').toLowerCase();
    const bank = /phân biệt lỗi|loại lỗi|cú pháp/.test(title) ? [
        ['Chương trình biên dịch thành công nhưng trả kết quả sai với n=0. Nhóm lỗi cần kiểm tra trước là gì?', ['Lỗi logic', 'Lỗi cú pháp', 'Lỗi cài đặt compiler', 'Lỗi mạng'], 'Lỗi logic', 'Chương trình chạy đến cuối nhưng không đáp ứng kết quả mong đợi nên cần kiểm tra thuật toán và điều kiện.'],
        ['Compiler chỉ ra thiếu dấu ngoặc đóng. Bước đầu phù hợp nhất là gì?', ['Kiểm tra cú pháp ở vị trí được báo và vùng lân cận', 'Đổi toàn bộ thuật toán', 'Tăng thời gian chạy', 'Bỏ qua vì output vẫn có thể đúng'], 'Kiểm tra cú pháp ở vị trí được báo và vùng lân cận', 'Lỗi cú pháp cần được xử lý trước khi đánh giá logic.'],
        ['Chương trình dừng do truy cập phần tử không tồn tại. Đây gần nhất là loại nào?', ['Lỗi lúc chạy', 'Lỗi trình bày tài liệu', 'Lỗi chính tả trong tên khóa học', 'Không thể là lỗi'], 'Lỗi lúc chạy', 'Lỗi xuất hiện trong quá trình thực thi được xếp vào nhóm runtime theo quan sát.'],
        ['Một nhánh if dùng > nhưng yêu cầu là “lớn hơn hoặc bằng”. Nên thêm test nào?', ['Giá trị đúng bằng ngưỡng', 'Chỉ một giá trị rất lớn', 'Chỉ chuỗi rỗng', 'Không cần test'], 'Giá trị đúng bằng ngưỡng', 'Sai lệch giữa > và >= chỉ lộ ra tại đúng giá trị ngưỡng.'],
        ['Vì sao “biên dịch thành công” chưa đủ để kết luận chương trình đúng?', ['Vì biên dịch không chứng minh kết quả đúng với mọi dữ liệu', 'Vì mọi chương trình đều phải có giao diện', 'Vì compiler luôn bỏ qua lỗi cú pháp', 'Vì test không có ích'], 'Vì biên dịch không chứng minh kết quả đúng với mọi dữ liệu', 'Compiler chủ yếu kiểm tra tính hợp lệ của chương trình, không xác nhận toàn bộ logic.'],
        ['Cách nào phân loại lỗi đáng tin cậy nhất?', ['Tái hiện và đối chiếu thông báo, trạng thái chạy và output', 'Đoán theo tên file', 'Sửa nhiều chỗ cùng lúc', 'Chỉ hỏi người dùng chương trình có chậm không'], 'Tái hiện và đối chiếu thông báo, trạng thái chạy và output', 'Phân loại phải dựa vào bằng chứng quan sát được.']
    ] : /đầu vào tối thiểu|tái hiện/.test(title) ? [
        ['Một lỗi xuất hiện với tệp 500 dòng. Làm gì để thu hẹp nguyên nhân?', ['Giảm dữ liệu từng phần nhưng giữ lỗi tái hiện', 'Xóa toàn bộ tệp ngay', 'Sửa ngẫu nhiên 10 dòng', 'Chỉ đổi tên tệp'], 'Giảm dữ liệu từng phần nhưng giữ lỗi tái hiện', 'Thu nhỏ đầu vào giúp tạo ca lỗi tối thiểu.'],
        ['Sau khi rút gọn dữ liệu, lỗi không còn xuất hiện. Kết luận phù hợp nhất?', ['Việc rút gọn đã loại mất một điều kiện gây lỗi; cần khôi phục và thử lại có kiểm soát', 'Lỗi chắc chắn đã được sửa', 'Không cần ghi nhận kết quả', 'Nên xóa test'], 'Việc rút gọn đã loại mất một điều kiện gây lỗi; cần khôi phục và thử lại có kiểm soát', 'Ca tối thiểu phải vẫn giữ điều kiện cần để tái hiện lỗi.'],
        ['Lỗi chỉ xảy ra khi thao tác theo một chuỗi cụ thể. Bằng chứng nào cần lưu?', ['Các bước và trạng thái theo đúng thứ tự tái hiện', 'Chỉ ảnh trang chủ', 'Chỉ thời gian mở máy', 'Tên người báo lỗi'], 'Các bước và trạng thái theo đúng thứ tự tái hiện', 'Thứ tự thao tác có thể là điều kiện quan trọng của lỗi.'],
        ['Một lỗi có yếu tố ngẫu nhiên. Cách nào giúp tái hiện ổn định hơn?', ['Ghi lại seed và dữ liệu đầu vào nếu ứng dụng hỗ trợ', 'Thay seed liên tục mà không ghi lại', 'Bỏ mọi log', 'Tăng số lần bấm ngẫu nhiên'], 'Ghi lại seed và dữ liệu đầu vào nếu ứng dụng hỗ trợ', 'Kiểm soát nguồn ngẫu nhiên giúp kết quả có thể lặp lại.'],
        ['Vì sao cần tạo ca lỗi tối thiểu?', ['Để giảm nhiễu và tập trung điều kiện làm lỗi xuất hiện', 'Để tăng kích thước dự án', 'Để tránh viết test', 'Để ẩn kết quả mong đợi'], 'Để giảm nhiễu và tập trung điều kiện làm lỗi xuất hiện', 'Ca nhỏ dễ phân tích và tái sử dụng làm test hồi quy.'],
        ['Khi chưa thể tái hiện lỗi, báo cáo nào trung thực nhất?', ['Ghi rõ điều kiện đã thử và dữ liệu còn thiếu', 'Khẳng định đã tìm ra nguyên nhân', 'Cho điểm 0 mặc định', 'Xóa yêu cầu'], 'Ghi rõ điều kiện đã thử và dữ liệu còn thiếu', 'Thiếu bằng chứng cần được ghi rõ thay vì suy diễn kết luận.']
    ] : /stack trace|vị trí cần kiểm tra/.test(title) ? [
        ['Stack trace chỉ tới một lệnh đọc thuộc tính. Bước nào giúp xác định nguyên nhân gốc?', ['Kiểm tra giá trị đối tượng và nơi dữ liệu được tạo/truyền vào', 'Chỉ đổi tên biến', 'Xóa stack trace', 'Tăng font chữ'], 'Kiểm tra giá trị đối tượng và nơi dữ liệu được tạo/truyền vào', 'Giá trị không hợp lệ có thể được tạo ở một hàm trước đó.'],
        ['Một stack trace có cả frame của thư viện và của ứng dụng. Nên làm gì?', ['Tìm frame liên quan trong mã ứng dụng và lần theo chuỗi gọi', 'Luôn sửa thư viện ngay', 'Bỏ qua mọi frame ứng dụng', 'Đóng chương trình mà không ghi nhận'], 'Tìm frame liên quan trong mã ứng dụng và lần theo chuỗi gọi', 'Call stack giúp xác định ngữ cảnh và nơi dữ liệu đi qua.'],
        ['Log debug nào không nên ghi?', ['Access token hoặc mật khẩu', 'Mã lỗi không nhạy cảm', 'Thời gian xử lý', 'Tên bước xử lý'], 'Access token hoặc mật khẩu', 'Thông tin xác thực không được đưa vào log.'],
        ['Để tìm thời điểm dữ liệu bắt đầu sai, nên kiểm tra gì?', ['Giá trị tại các ranh giới giữa những lời gọi hàm', 'Chỉ màu nền giao diện', 'Chỉ tên nhánh Git', 'Số lần tải trang'], 'Giá trị tại các ranh giới giữa những lời gọi hàm', 'So sánh trước/sau giúp khoanh vùng nơi trạng thái lệch kỳ vọng.'],
        ['Một lỗi không còn xuất hiện ở môi trường khác. Điều gì cần ghi lại?', ['Phiên bản, môi trường và điều kiện tái hiện', 'Chỉ câu “máy tôi chạy được”', 'Mật khẩu database', 'Không cần thông tin nào'], 'Phiên bản, môi trường và điều kiện tái hiện', 'Khác biệt môi trường là một phần bằng chứng cần kiểm tra.'],
        ['Sau khi sửa tại dòng exception, lỗi vẫn quay lại. Bước nào nên làm?', ['Lần ngược luồng dữ liệu và xác định nguồn vi phạm điều kiện', 'Tăng số lần retry vô hạn', 'Bỏ test', 'Ẩn thông báo lỗi'], 'Lần ngược luồng dữ liệu và xác định nguồn vi phạm điều kiện', 'Sửa triệu chứng mà không xử lý nguồn có thể làm lỗi tái diễn.']
    ] : /giá trị biên|phân vùng|test case/.test(title) ? [
        ['Miền hợp lệ là số nguyên từ 1 đến 100, bao gồm cả hai đầu. Bộ nào kiểm tra biên tốt nhất?', ['0, 1, 2, 99, 100, 101', '10, 20, 30', '50', '1000 và 2000'], '0, 1, 2, 99, 100, 101', 'Cần thử ngay ngoài, đúng tại và ngay trong mỗi đầu mút.'],
        ['Hàm được đặc tả chỉ nhận mảng không rỗng. Kiểm tra mảng rỗng nên được xử lý thế nào?', ['Kiểm tra validation theo hợp đồng đầu vào', 'Tự đặt giá trị lớn nhất là 0', 'Coi là pass', 'Xóa test'], 'Kiểm tra validation theo hợp đồng đầu vào', 'Mảng rỗng ngoài hợp đồng cần có hành vi từ chối/ báo lỗi được xác định rõ.'],
        ['Mục đích của phân vùng tương đương là gì?', ['Chọn đại diện cho nhóm đầu vào có hành vi dự kiến tương tự', 'Đảm bảo chỉ cần một test cho toàn ứng dụng', 'Thay thế đặc tả', 'Chọn dữ liệu ngẫu nhiên'], 'Chọn đại diện cho nhóm đầu vào có hành vi dự kiến tương tự', 'Phân vùng giảm số lượng test nhưng cần bao phủ các nhóm khác nhau.'],
        ['Vì sao expected output không được lấy từ chính chương trình đang kiểm thử?', ['Có thể lặp lại cùng lỗi của chương trình trong đáp án kỳ vọng', 'Vì output không bao giờ đúng', 'Vì test cần không có đáp án', 'Vì test chỉ dùng để đo tốc độ'], 'Có thể lặp lại cùng lỗi của chương trình trong đáp án kỳ vọng', 'Kết quả mong đợi cần dựa trên đặc tả hoặc tính toán độc lập.'],
        ['Với hàm kiểm tra tuổi đủ 18, giá trị nào đặc biệt quan trọng?', ['17, 18 và 19', 'Chỉ 40', 'Chỉ -1000', 'Không cần tuổi biên'], '17, 18 và 19', 'Các giá trị lân cận ngưỡng giúp phát hiện sai lệch điều kiện.'],
        ['Một bộ test có 100 câu nhưng tất cả cùng một dạng đầu vào. Vấn đề chính là gì?', ['Độ phủ tình huống yếu dù số lượng lớn', 'Test chắc chắn hoàn hảo', 'Không cần expected output', 'Chỉ cần đổi tên bộ test'], 'Độ phủ tình huống yếu dù số lượng lớn', 'Số lượng không thay thế được độ phủ và chất lượng của test.']
    ] : /unit test|arrange|assertion/.test(title) ? [
        ['Trong Arrange–Act–Assert, phần Act thực hiện việc gì?', ['Gọi hành vi đang kiểm thử', 'Chuẩn bị dữ liệu', 'So sánh kết quả', 'Thiết lập màu giao diện'], 'Gọi hành vi đang kiểm thử', 'Act là bước thực thi hành vi; Arrange chuẩn bị và Assert kiểm tra.'],
        ['Một unit test tốt nên kiểm tra gì?', ['Một hành vi chính với assertion cụ thể', 'Toàn bộ ứng dụng và mọi API cùng lúc', 'Chỉ thời gian tải trang', 'Chỉ số dòng code'], 'Một hành vi chính với assertion cụ thể', 'Test tập trung giúp kết quả lỗi dễ hiểu và dễ bảo trì.'],
        ['Test phụ thuộc gọi mạng thật thường gây khó khăn nào?', ['Kết quả chậm và không ổn định khi dịch vụ bên ngoài lỗi', 'Luôn chạy nhanh hơn', 'Bảo đảm không có lỗi', 'Không cần cấu hình'], 'Kết quả chậm và không ổn định khi dịch vụ bên ngoài lỗi', 'Cô lập phụ thuộc giúp unit test có tính lặp lại.'],
        ['Assertion chỉ kiểm tra hàm không ném lỗi nhưng không kiểm tra giá trị. Hạn chế là gì?', ['Đầu ra sai vẫn có thể khiến test pass', 'Assertion luôn thừa', 'Test tự động sửa lỗi', 'Không có hạn chế'], 'Đầu ra sai vẫn có thể khiến test pass', 'Cần xác nhận kết quả mong đợi thay vì chỉ xác nhận hàm đã chạy.'],
        ['Khi dữ liệu đầu vào không hợp lệ, test nên xác nhận gì?', ['Hành vi lỗi/validation được đặc tả', 'Mặc định luôn trả 0', 'Bất kỳ output nào', 'Không cần chạy'], 'Hành vi lỗi/validation được đặc tả', 'Test nên bám hợp đồng của hàm, không tự tạo hành vi mặc định.'],
        ['Điều gì giúp unit test không phụ thuộc thứ tự chạy?', ['Mỗi test tự chuẩn bị và dọn dữ liệu cần thiết', 'Dùng một biến global chia sẻ không kiểm soát', 'Dựa vào test trước tạo dữ liệu', 'Chạy lại cho đến khi pass'], 'Mỗi test tự chuẩn bị và dọn dữ liệu cần thiết', 'Tính độc lập giúp suite ổn định khi chạy riêng lẻ hoặc theo thứ tự khác.']
    ] : /breakpoint|trạng thái chương trình|debug có phương pháp/.test(title) ? [
        ['Biến đã có giá trị sai trước khi vào hàm đang lỗi. Nên làm gì?', ['Lần ngược các lời gọi để tìm nơi giá trị đổi sai lần đầu', 'Chỉ đổi tên biến', 'Bỏ qua tham số', 'Tăng thời gian timeout'], 'Lần ngược các lời gọi để tìm nơi giá trị đổi sai lần đầu', 'Nguyên nhân có thể nằm trước vị trí triệu chứng.'],
        ['Khi chỉ một userId tái hiện được lỗi, công cụ nào hữu ích?', ['Conditional breakpoint hoặc input cố định đã ẩn danh', 'Xóa log', 'Đổi theme', 'Tắt tất cả test'], 'Conditional breakpoint hoặc input cố định đã ẩn danh', 'Điều kiện dừng giúp tập trung đúng trạng thái gây lỗi.'],
        ['Khi nào step into hữu ích?', ['Khi cần quan sát bên trong hàm được gọi', 'Khi muốn bỏ qua hoàn toàn lời gọi', 'Khi chỉ thay màu nền', 'Khi không có breakpoint'], 'Khi cần quan sát bên trong hàm được gọi', 'Step into đi vào hàm để xem các bước thực thi bên trong.'],
        ['Sau khi quan sát thấy một giả thuyết có vẻ đúng, bước tiếp theo là gì?', ['Kiểm chứng giả thuyết bằng ca tái hiện và test', 'Sửa mọi dòng liên quan cùng lúc', 'Xóa dữ liệu test', 'Công bố ngay'], 'Kiểm chứng giả thuyết bằng ca tái hiện và test', 'Bằng chứng phải xác nhận giả thuyết trước khi kết luận.'],
        ['Vì sao không nên chia sẻ toàn bộ memory dump công khai?', ['Có thể chứa dữ liệu cá nhân hoặc thông tin xác thực', 'Vì không thể chứa biến', 'Vì luôn làm compiler lỗi', 'Vì không thể đọc'], 'Có thể chứa dữ liệu cá nhân hoặc thông tin xác thực', 'Artifact debug có thể chứa dữ liệu nhạy cảm cần được lọc.'],
        ['Điều gì nên được ghi nhận sau một phiên debug?', ['Giả thuyết, bằng chứng, nguyên nhân và ca xác minh', 'Chỉ số phút đã mở IDE', 'Chỉ tên máy tính', 'Không cần kết quả'], 'Giả thuyết, bằng chứng, nguyên nhân và ca xác minh', 'Ghi nhận giúp người khác lặp lại và kiểm tra kết luận.']
    ] : /regression|hồi quy/.test(title) ? [
        ['Một lỗi đã được sửa. Test hồi quy tốt nhất nên làm gì?', ['Tái hiện chính xác trường hợp trước đây thất bại', 'Chỉ kiểm tra màu sắc', 'Xóa test cũ', 'Chỉ chạy benchmark'], 'Tái hiện chính xác trường hợp trước đây thất bại', 'Test nên bảo vệ hành vi bị lỗi trước khi sửa.'],
        ['Sau khi sửa hàm dùng chung, nên chạy nhóm test nào?', ['Test mới và các test liên quan đến nơi sử dụng hàm', 'Chỉ test của một màn hình không liên quan', 'Không cần test', 'Chỉ lint'], 'Test mới và các test liên quan đến nơi sử dụng hàm', 'Thay đổi dùng chung có thể ảnh hưởng nhiều caller.'],
        ['Test mới pass ngay cả trước khi sửa lỗi. Điều này gợi ý gì?', ['Test có thể chưa tái hiện đúng lỗi hoặc expected chưa chính xác', 'Bản sửa chắc chắn hoàn hảo', 'Nên xóa toàn bộ suite', 'Không thể kiểm tra'], 'Test có thể chưa tái hiện đúng lỗi hoặc expected chưa chính xác', 'Test hồi quy cần chứng minh phát hiện lỗi trước sửa nếu khả thi.'],
        ['Một test cũ thất bại sau thay đổi. Hành động nào không phù hợp?', ['Xóa assertion chỉ để pipeline xanh mà không điều tra', 'Đọc khác biệt thực tế/mong đợi', 'Xác định phạm vi ảnh hưởng', 'Tái hiện lỗi'], 'Xóa assertion chỉ để pipeline xanh mà không điều tra', 'Cần hiểu thất bại trước khi thay đổi test hoặc code.'],
        ['Thay đổi nhỏ ở điều kiện vòng lặp có thể ảnh hưởng test nào?', ['Giá trị biên và kích thước nhỏ của collection', 'Chỉ giao diện đăng nhập', 'Không test nào', 'Chỉ audio'], 'Giá trị biên và kích thước nhỏ của collection', 'Điều kiện vòng lặp thường gây sai lệch ở đầu/cuối miền.'],
        ['Khi nào cần chạy cả bộ test rộng hơn?', ['Khi thay đổi có tác động nhiều module hoặc contract chung', 'Không bao giờ', 'Chỉ khi muốn tăng thời gian build', 'Chỉ khi không có code'], 'Khi thay đổi có tác động nhiều module hoặc contract chung', 'Phạm vi kiểm thử cần tương ứng với rủi ro thay đổi.']
    ] : [
        ['Một bug report tốt cần thông tin nào?', ['Các bước tái hiện, môi trường, expected và actual', 'Chỉ câu “không chạy”', 'Mật khẩu đăng nhập', 'Chỉ tên tác giả'], 'Các bước tái hiện, môi trường, expected và actual', 'Thông tin này giúp người khác tái hiện và phân tích lỗi.'],
        ['Nếu chưa xác minh nguyên nhân gốc, báo cáo nên làm gì?', ['Phân biệt rõ triệu chứng, giả thuyết và bằng chứng', 'Khẳng định nguyên nhân chắc chắn', 'Xóa log', 'Gán điểm mặc định'], 'Phân biệt rõ triệu chứng, giả thuyết và bằng chứng', 'Kết luận cần dựa trên bằng chứng; giả thuyết phải được đánh dấu rõ.'],
        ['Kết quả mong đợi của bug report nên dựa vào đâu?', ['Đặc tả hoặc yêu cầu có thể kiểm chứng', 'Output hiện tại của chương trình lỗi', 'Dự đoán ngẫu nhiên', 'Số dòng code'], 'Đặc tả hoặc yêu cầu có thể kiểm chứng', 'Expected result cần nguồn căn cứ độc lập với hành vi lỗi.'],
        ['Trước khi đính kèm log vào báo cáo công khai, cần làm gì?', ['Loại bỏ token, mật khẩu và thông tin cá nhân', 'Thêm API key cho dễ debug', 'Đưa mọi cookie vào', 'Không đọc lại log'], 'Loại bỏ token, mật khẩu và thông tin cá nhân', 'Log và ảnh chụp có thể vô tình tiết lộ thông tin nhạy cảm.'],
        ['Sau khi sửa lỗi, xác minh có ý nghĩa nhất là gì?', ['Chạy lại các bước tái hiện và test liên quan', 'Chỉ nhìn diff code', 'Đổi tên nhánh', 'Xóa test thất bại'], 'Chạy lại các bước tái hiện và test liên quan', 'Bản sửa phải được kiểm chứng bằng hành vi thực tế.'],
        ['Một báo cáo có nhiều giả thuyết nhưng không có dữ liệu. Cần bổ sung gì trước?', ['Input tối thiểu và các bước tái hiện quan sát được', 'Logo mới', 'Tên khóa học khác', 'Điểm số đoán'], 'Input tối thiểu và các bước tái hiện quan sát được', 'Ca tái hiện là nền tảng để kiểm tra giả thuyết.']
    ];
    return bank.map(([prompt, options, answer, explanation]) => question({ topic, prompt, options, answer, explanation, skill: topic }));
}

function makeTrackQuestions({ topic, trackKey, grade, index, target = {} }) {
    if (trackKey === 'IT' && isDebugTestingTarget(topic)) return buildDebugTestingQuestions(topic);
    if (['IT', 'TOEIC', 'MOS'].includes(trackKey)) {
        const promptContext = `${target.prompt || ''} ${target.domain || ''} ${target.major || ''}`.trim();
        const trackName = trackKey === 'IT' ? 'programming' : trackKey;
        const course = { name: `${promptContext} ${TRACKS[trackKey].label}`, code: `LOCAL-${trackKey}`, track: trackName, targetExam: trackKey === 'TOEIC' ? 'TOEIC' : (target.targetExam || ''), targetVariant: target.targetVariant || '', skills: [topic], subjectId: TRACKS[trackKey].subjectId };
        let questions = buildMixedQuestions({ course, topic, index, count: 12 });
        if (trackKey === 'TOEIC') {
            const normalizedTopic = normalizeWords(topic);
            const targetVariant = /part 1|mo ta tranh/.test(normalizedTopic) ? 'LISTENING_P1' : /part 2|cau hoi dap/.test(normalizedTopic) ? 'LISTENING_P2' : /part 3|part 4|hoi thoai|bai noi/.test(normalizedTopic) ? 'LISTENING_P3_P4' : /part 5|part 6|ngu phap|hoan thanh doan/.test(normalizedTopic) ? 'READING_P5_P6' : /part 7|doc email|doc nhieu/.test(normalizedTopic) ? 'READING_P7' : (target.targetVariant || 'TOEIC');
            questions = buildMixedQuestions({ course: { ...course, targetVariant }, topic, index, count: 12 });
        }
        return questions.map((item, questionIndex) => ({ ...item, id: item.id || `LOCAL-${trackKey}-L${index + 1}-Q${questionIndex + 1}`, points: Number(item.points) || 1, options: Array.isArray(item.options) ? item.options : [], skill: item.skill || topic, tags: Array.isArray(item.tags) ? item.tags : [topic] }));
    }
    return makeLessonQuestions({ topic, track: trackKey, grade, index });
}

function makeCourseDraft(target = {}) {
    const targetText = `${target.courseTitle || ''} ${target.prompt || ''} ${target.goal || ''} ${target.domain || ''} ${target.subjectId || ''}`;
    const focusedDebugTarget = isDebugTestingTarget(targetText);
    const trackKey = focusedDebugTarget ? 'IT' : inferTrack(target);
    const track = TRACKS[trackKey];
    const grade = Number(target.grade || target.education?.grade || target.educationContext?.grade || String(target.prompt || '').match(/lớp\s*(1[0-2]|[1-9])/i)?.[1]) || undefined;
    const subjectText = `${target.prompt || ''} ${target.domain || ''} ${target.major || ''}`.toLowerCase();
    const inferredSubject = /ngữ văn|văn học|đọc hiểu văn|literature/.test(subjectText) ? 'literature' : /tiếng anh|english/.test(subjectText) ? 'english' : /vật lý|vật lí|physics/.test(subjectText) ? 'physics' : /hóa học|hoá học|chemistry/.test(subjectText) ? 'chemistry' : /sinh học|biology/.test(subjectText) ? 'biology' : /lịch sử|history/.test(subjectText) ? 'history' : /địa lý|địa lí|geography/.test(subjectText) ? 'geography' : /tin học|tin học phổ thông|informatics/.test(subjectText) ? 'informatics' : /toán|mathematics|algebra|geometry/.test(subjectText) ? 'mathematics' : '';
    const subject = clean(target.subjectId || (trackKey === 'K12' ? inferredSubject || 'mathematics' : track.subjectId), 120);
    const goal = clean(target.prompt || target.goal || target.careerGoal || `Xây dựng năng lực ${track.label}`, 500);
    const promptHint = goal.match(/(?:khóa học|course|chương trình|học về|luyện thi|ôn tập)\s+([^,.!;]{3,70})/i)?.[1];
    const focus = clean(target.domain || target.major || (trackKey === 'TOEIC' ? `Luyện thi ${target.targetExam || 'TOEIC'} theo kỹ năng` : trackKey === 'MOS' ? (/excel/i.test(goal) ? 'Microsoft Excel thực hành' : /powerpoint|trình chiếu/i.test(goal) ? 'Microsoft PowerPoint thực hành' : /word|văn bản/i.test(goal) ? 'Microsoft Word thực hành' : 'MOS thực hành theo tác vụ' ) : trackKey === 'IT' ? (target.subjectId || promptHint || 'Tư duy thuật toán và lập trình') : promptHint || goal.slice(0, 90)), 250);
    const focusText = `${target.prompt || ''} ${target.goal || ''} ${target.domain || ''}`;
    const requestedFocus = trackKey === 'K12' ? extractFocusTopic(focusText) : '';
    const k12Subject = trackKey === 'K12' && grade ? resolveK12Subject(subject, grade) : null;
    const subjectLabel = k12Subject?.baseName || k12Subject?.name || (subject === 'mathematics' ? 'Toán' : subject === 'english' ? 'Tiếng Anh' : subject.replace(/[_-]/g, ' '));
    const title = trackKey === 'K12' && grade ? `${subjectLabel} lớp ${grade}${requestedFocus ? `: ${titleCase(requestedFocus)}` : `: ${focus}`}` : `${track.label}: ${focus}`;
    const k12Records = trackKey === 'K12' && grade ? resolveK12Lessons(subject, grade, focusText) : [];
    const explicitRange = String(target.lessonCountRange || '').trim();
    const range = explicitRange.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
    const number = explicitRange.match(/\b(\d{1,2})\b/);
    const defaultLessonCount = trackKey === 'K12' ? 12 : trackKey === 'TOEIC' ? 10 : trackKey === 'MOS' ? 6 : trackKey === 'IT' ? 8 : 8;
    const requestedLessonCount = Math.max(3, Math.min(24, range ? Math.round((Number(range[1]) + Number(range[2])) / 2) : number ? Number(number[1]) : defaultLessonCount));
    const k12Selected = k12Records.slice(0, Math.min(k12Records.length, requestedLessonCount));
    const k12Chapters = k12Selected.length ? Array.from({ length: Math.ceil(k12Selected.length / 2) }, (_, groupIndex) => {
        const records = k12Selected.slice(groupIndex * 2, groupIndex * 2 + 2);
        const first = records[0];
        return { key: groupIndex + 1, title: `Lớp ${grade} · ${first.curriculumSubjectName || subject} · Phần ${groupIndex + 1}: ${first.unitTitle || first.title || 'Kiến thức trọng tâm'}`, lessons: records.map(record => record.title || record.topic), lessonRecords: records };
    }) : [];
    const nonK12Chapters = track.chapters.map((chapter, index) => ({ ...chapter, _sourceIndex: index })).filter(chapter => Array.isArray(chapter.lessons) && chapter.lessons.length);
    const debugTestingTarget = trackKey === 'IT' && focusedDebugTarget;
    const debugTestingChapters = debugTestingTarget ? [...new Set(DEBUG_TESTING_LESSONS.map(item => item.chapter))].map(chapterTitle => ({ title: chapterTitle, lessons: DEBUG_TESTING_LESSONS.filter(item => item.chapter === chapterTitle).map(item => item.title) })) : [];
    const normalizedCourseFocus = normalizeWords(`${target.courseTitle || ''} ${target.prompt || ''} ${target.goal || ''} ${target.domain || ''} ${target.major || ''} ${target.targetVariant || ''}`);
    const focusedToeicPart = trackKey === 'TOEIC' ? (/part 1|listening p1|mo ta tranh|photograph/.test(normalizedCourseFocus) ? 1 : /part 2|listening p2|cau hoi dap|question response/.test(normalizedCourseFocus) ? 2 : /part 3|listening p3|hoi thoai/.test(normalizedCourseFocus) ? 3 : /part 4|listening p4|bai noi|short talk/.test(normalizedCourseFocus) ? 4 : /part 5|reading p5|ngu phap|grammar/.test(normalizedCourseFocus) ? 5 : /part 6|reading p6|hoan thanh doan/.test(normalizedCourseFocus) ? 6 : /part 7|reading p7|doc email|reading comprehension/.test(normalizedCourseFocus) ? 7 : 0) : 0;
    const focusedToeicTitles = {
        1: ['Part 1 · Người và hành động trong ảnh', 'Part 1 · Vị trí của người và đồ vật', 'Part 1 · Trạng thái và sự sắp đặt', 'Part 1 · Động từ mô tả hành động', 'Part 1 · Giới từ chỉ vị trí', 'Part 1 · Số ít, số nhiều và chi tiết nhìn thấy', 'Part 1 · Nhận diện distractor theo hành động', 'Part 1 · Paraphrase mô tả tranh', 'Part 1 · Tốc độ nghe và ghi nhận từ khóa', 'Part 1 · Mini set mô tả tranh và sổ lỗi'],
        2: ['Part 2 · Câu hỏi Who, What, Where', 'Part 2 · Câu hỏi When và Why', 'Part 2 · Câu hỏi How và How many', 'Part 2 · Lời mời và đề nghị lịch sự', 'Part 2 · Xác nhận và từ chối tự nhiên', 'Part 2 · Câu hỏi Yes/No', 'Part 2 · Distractor lặp từ khóa', 'Part 2 · Phản hồi gián tiếp', 'Part 2 · Ngữ điệu và từ để hỏi', 'Part 2 · Mini set hỏi đáp và sổ lỗi'],
        3: ['Part 3 · Xác định mục đích hội thoại', 'Part 3 · Vai trò và mối quan hệ người nói', 'Part 3 · Lịch hẹn và thay đổi kế hoạch', 'Part 3 · Mốc thời gian và địa điểm', 'Part 3 · Yêu cầu và hành động tiếp theo', 'Part 3 · Chi tiết số liệu trong hội thoại', 'Part 3 · Câu hỏi suy luận có bằng chứng', 'Part 3 · Câu hỏi về biểu đồ hoặc thông báo đi kèm', 'Part 3 · Ghi chú theo nhóm thông tin', 'Part 3 · Mini set hội thoại và sổ lỗi'],
        4: ['Part 4 · Mục đích thông báo ngắn', 'Part 4 · Thời gian và địa điểm', 'Part 4 · Hướng dẫn dành cho người nghe', 'Part 4 · Thông báo thay đổi dịch vụ', 'Part 4 · Quảng cáo và lời mời', 'Part 4 · Lịch trình và mốc số liệu', 'Part 4 · Hành động tiếp theo', 'Part 4 · Suy luận từ bài nói', 'Part 4 · Ghi chú thông tin trọng tâm', 'Part 4 · Mini set bài nói và sổ lỗi'],
        5: ['Part 5 · Hòa hợp chủ ngữ và động từ', 'Part 5 · Thì và dạng động từ', 'Part 5 · Từ loại trong câu', 'Part 5 · Giới từ trong ngữ cảnh công sở', 'Part 5 · Liên từ và từ nối', 'Part 5 · Câu bị động', 'Part 5 · To-infinitive và gerund', 'Part 5 · Mệnh đề quan hệ', 'Part 5 · Đại từ và lượng từ', 'Part 5 · Mini set ngữ pháp và sổ lỗi'],
        6: ['Part 6 · Từ vựng trong đoạn email', 'Part 6 · Liên từ và mạch văn', 'Part 6 · Hoàn thành câu trong đoạn', 'Part 6 · Chèn câu theo ngữ cảnh', 'Part 6 · Đại từ và tham chiếu', 'Part 6 · Thì động từ nhất quán', 'Part 6 · Văn phong email công việc', 'Part 6 · Cấu trúc đoạn thông báo', 'Part 6 · Kiểm tra cohesion và coherence', 'Part 6 · Mini set hoàn thành đoạn và sổ lỗi'],
        7: ['Part 7 · Email công việc và mục đích người gửi', 'Part 7 · Thông báo và hướng dẫn', 'Part 7 · Biểu mẫu và dữ liệu chi tiết', 'Part 7 · Tìm thông tin theo câu hỏi', 'Part 7 · Suy luận có dẫn chứng', 'Part 7 · Paraphrase trong văn bản', 'Part 7 · Đối chiếu hai email', 'Part 7 · Đọc nhiều văn bản và mốc thời gian', 'Part 7 · Quản lý thời gian đọc', 'Part 7 · Mini set đọc hiểu và sổ lỗi']
    };
    const focusedToeicChapters = focusedToeicPart ? [{ title: `TOEIC Part ${focusedToeicPart} · Lộ trình chuyên sâu`, lessons: focusedToeicTitles[focusedToeicPart] }] : null;
    const focusedMosApp = trackKey === 'MOS' ? (/excel/.test(normalizedCourseFocus) ? 'Excel' : /powerpoint|slide|trinh chieu/.test(normalizedCourseFocus) ? 'PowerPoint' : /\bword\b|van ban|document/.test(normalizedCourseFocus) ? 'Word' : '') : '';
    const focusedMosTitles = focusedMosApp === 'Excel' ? ['Excel · Workbook và cấu trúc trang tính', 'Excel · Nhập liệu và kiểu dữ liệu', 'Excel · Định dạng ô và vùng dữ liệu', 'Excel · Tham chiếu tương đối và tuyệt đối', 'Excel · SUM, AVERAGE, IF và xử lý lỗi', 'Excel · Sắp xếp, lọc và kiểm tra dữ liệu'] : focusedMosApp === 'Word' ? ['Word · Styles và cấu trúc tài liệu', 'Word · Định dạng đoạn và bố cục trang', 'Word · Bảng, hình ảnh và Wrap Text', 'Word · Header, Footer và số trang', 'Word · Mục lục và tham chiếu', 'Word · Rà soát và bàn giao tài liệu'] : focusedMosApp === 'PowerPoint' ? ['PowerPoint · Theme và Slide Master', 'PowerPoint · Layout và placeholder', 'PowerPoint · Căn chỉnh và bố cục slide', 'PowerPoint · Hình ảnh, biểu đồ và nhãn dữ liệu', 'PowerPoint · Transition và Animation', 'PowerPoint · Speaker Notes và trình chiếu thử'] : [];
    const focusedMosChapters = focusedMosTitles.length ? [{ title: `MOS ${focusedMosApp} · Thực hành theo kỹ năng`, lessons: focusedMosTitles }] : null;
    const focusedTrackChapters = focusedToeicChapters || focusedMosChapters;
    const sourceChapters = k12Chapters.length ? k12Chapters : debugTestingTarget ? debugTestingChapters : focusedTrackChapters || (() => {
        const candidates = nonK12Chapters.flatMap((chapter, chapterIndex) => chapter.lessons.map((lesson, lessonIndex) => ({ title: lesson, chapter, chapterIndex, lessonIndex, order: chapterIndex * 100 + lessonIndex })));
        const stopWords = new Set(['khoa','hoc','co','ban','nhap','mon','ve','va','cho','nguoi','moi','thuc','hanh','nang','cao','theo','muc','tieu','course','learn','learning','the','and','with']);
        const tokens = normalizeWords(`${goal} ${focus}`).split(/\s+/).filter(token => token.length >= 3 && !stopWords.has(token));
        const ranked = candidates.map(item => ({ ...item, score: tokens.reduce((sum, token) => sum + (normalizeWords(item.title).includes(token) ? token.length : 0), 0) }));
        const selected = [...ranked].sort((a,b) => b.score-a.score || a.order-b.order).slice(0, Math.min(requestedLessonCount, ranked.length)).sort((a,b)=>a.order-b.order);
        const grouped = new Map();
        for (const item of selected) {
            const key = item.chapterIndex;
            if (!grouped.has(key)) grouped.set(key, { ...item.chapter, lessons: [] });
            grouped.get(key).lessons.push(item.title);
        }
        return [...grouped.values()];
    })();
    const chapters = sourceChapters.map((chapter, ci) => ({
        title: chapter.title,
        description: `Chương ${ci + 1} của khóa ${title}. Mục tiêu: nắm kiến thức, luyện tập có phản hồi, vận dụng vào nhiệm vụ thực tế và kiểm tra bằng tiêu chí rõ ràng.`,
        lessons: chapter.lessons.map((lessonTitle, li) => {
            const curriculumLesson = chapter.lessonRecords?.[li] || null;
            const detailedLesson = trackKey === 'K12' && curriculumLesson ? curriculumData.getLesson(grade, curriculumLesson.curriculumSubjectId, curriculumLesson.id)?.lesson || curriculumLesson : null;
            const topic = `${lessonTitle}${trackKey === 'K12' ? ` · ${curriculumLesson?.curriculumSubjectName || subject.replace(/[_-]/g, ' ')}${grade ? ` lớp ${grade}` : ''}` : ''}`;
            const debugDetails = debugTestingTarget ? buildDebugTestingLesson(lessonTitle) : null;
            const theorySections = detailedLesson?.theorySections?.length ? detailedLesson.theorySections.map(section => ({ title: section.title || 'Kiến thức trọng tâm', content: (section.content ? [section.content] : (section.bullets || [])).map(String).filter(Boolean).join('\n\n') })) : debugDetails?.theorySections || [
                { title: '1. Mục tiêu và kiến thức nền', content: `Sau bài “${topic}”, người học có thể nêu mục tiêu, xác định dữ kiện và giải thích vì sao kiến thức này cần thiết. Hãy bắt đầu bằng một ví dụ quen thuộc, ghi điều đã biết và điều cần tìm. Đối chiếu kiến thức tiên quyết trước khi chuyển sang quy tắc mới.` },
                { title: '2. Khái niệm và quy tắc cốt lõi', content: `Khái niệm trọng tâm của “${lessonTitle}” được dùng để xử lý nhiệm vụ cụ thể, không chỉ để ghi nhớ. Xác định điều kiện áp dụng, các bước chính và trường hợp ngoại lệ. Viết lại quy tắc bằng lời của mình; sau đó tạo một ví dụ đúng và một trường hợp gần đúng nhưng không thỏa điều kiện.` },
                { title: '3. Ví dụ có hướng dẫn', content: `Ví dụ: giải quyết một nhiệm vụ nhỏ liên quan đến “${topic}”. Bước 1: đọc kỹ yêu cầu. Bước 2: xác định dữ kiện, công cụ và đầu ra. Bước 3: chọn phương pháp phù hợp. Bước 4: thực hiện từng bước, ghi kết quả trung gian. Bước 5: đối chiếu với tiêu chí và kiểm tra bằng cách khác. Bước 6: giải thích kết quả và nêu điều có thể thay đổi nếu dữ kiện khác.` },
                { title: '4. Lỗi thường gặp và tự kiểm tra', content: `Các lỗi phổ biến là bỏ sót điều kiện, nhảy bước, chọn công cụ không phù hợp hoặc không kiểm tra đầu ra. Khi phát hiện lỗi, xác định bước đầu tiên sai thay vì sửa đoán. Trước khi nộp, tự hỏi: kết quả có đáp ứng đủ yêu cầu không, có thể kiểm chứng bằng cách nào, và phần nào cần giải thích thêm?` }
            ];
            const exampleSection = detailedLesson?.theorySections?.find(section => /ví dụ/i.test(String(section.title || '')));
            const exampleBullets = (exampleSection?.bullets || []).filter(Boolean);
            const exampleSource = detailedLesson ? (exampleBullets.length ? exampleBullets : detailedLesson.theory || []).slice(0, 4) : [];
            const examples = debugDetails?.examples || exampleSource.map((value, exampleIndex) => ({ title: `Ví dụ ${exampleIndex + 1} · ${lessonTitle}`, problem: String(value), solution: `Cách làm: xác định yêu cầu trong ví dụ, gạch chân dữ kiện liên quan đến “${lessonTitle}”, áp dụng đúng quy tắc đã học, thực hiện từng bước, rồi kiểm tra kết quả bằng cách thay ngược/đối chiếu đáp án hoặc tiêu chí. Căn cứ: ${detailedLesson?.questions?.[0]?.explanation || 'đối chiếu dữ kiện và quy tắc trong phần lý thuyết trên.'}` }));
            while (examples.length < 2) examples.push(examples.length === 0
                ? { title: `Ví dụ có hướng dẫn · ${lessonTitle}`, problem: `Giải một nhiệm vụ cơ bản về ${lessonTitle}, nêu rõ dữ kiện và kết quả cần tìm.`, solution: `Bước 1: xác định yêu cầu. Bước 2: chọn quy tắc phù hợp của ${lessonTitle}. Bước 3: thực hiện từng bước. Bước 4: kiểm tra kết quả bằng dữ kiện hoặc cách làm thứ hai.` }
                : { title: `Ví dụ biến thể · ${lessonTitle}`, problem: `Thay đổi một dữ kiện của ví dụ về ${lessonTitle} và giải lại.`, solution: `Nêu điều kiện đã thay đổi, điều chỉnh cách làm, tính/diễn giải kết quả mới và giải thích vì sao kết quả thay đổi.` });
            const practiceTasks = debugDetails?.practiceTasks || (detailedLesson?.practiceTasks?.length ? detailedLesson.practiceTasks.map((instruction, taskIndex) => ({ type: taskIndex === 0 ? 'GUIDED' : taskIndex === 1 ? 'INDEPENDENT' : 'REAL_WORLD', title: taskIndex === 0 ? 'Luyện tập có hướng dẫn' : taskIndex === 1 ? 'Bài làm độc lập' : 'Vận dụng thực tế', instruction: String(instruction), hint: taskIndex === 0 ? 'Đọc từng mục lý thuyết, làm theo ví dụ và tự kiểm tra trước khi xem phản hồi.' : 'Nộp cách làm hoặc sản phẩm để hệ thống chấm theo đáp án/rubric.', deliverable: 'Lời giải hoặc sản phẩm có thể đối chiếu với rubric.' })) : [
                { type: 'GUIDED', title: 'Luyện tập có hướng dẫn', instruction: `Làm một bài mẫu về ${topic} theo 4 bước: đọc yêu cầu, chỉ ra dữ kiện, thực hiện, tự kiểm tra. Sau mỗi bước, ghi lý do chọn cách làm.`, hint: 'Nếu mắc kẹt, quay lại mục khái niệm và xem ví dụ mẫu; không chép đáp án ngay.' },
                { type: 'INDEPENDENT', title: 'Bài làm độc lập', instruction: `Giải nhiệm vụ mới về ${topic} không xem lời giải. Nộp toàn bộ các bước, kết quả và một cách kiểm tra độc lập.`, deliverable: 'Lời giải hoặc sản phẩm có thể đối chiếu với rubric.' },
                { type: 'REAL_WORLD', title: 'Vận dụng thực tế', instruction: `Chọn tình huống gần với học tập/công việc có liên quan đến ${topic}; mô tả dữ kiện, mục tiêu, phương án, kết quả và giới hạn của cách làm.`, deliverable: 'Bản giải thích hoặc sản phẩm ứng dụng ngắn.' }
            ]);
            const questions = debugTestingTarget ? buildDebugTestingQuestions(lessonTitle) : trackKey === 'K12' && detailedLesson ? buildK12Questions({ grade, subjectId: curriculumLesson.curriculumSubjectId, subjectName: curriculumLesson.curriculumSubjectName, topic: lessonTitle, index: Number(curriculumLesson.order || ci * 2 + li), count: 12 }).map(normalizeK12Question) : makeTrackQuestions({ topic: lessonTitle, trackKey, grade, index: ci * 2 + li, target });
            return {
                code: `L${String(ci * 2 + li + 1).padStart(2, '0')}`,
                title: lessonTitle,
                topic,
                order: ci * 2 + li + 1,
                unit: ci + 1,
                unitTitle: chapter.title,
                estimatedMinutes: trackKey === 'K12' && grade <= 5 ? 20 : 35,
                difficulty: 'FOUNDATION_TO_APPLIED',
                objectives: detailedLesson?.objectives?.length ? detailedLesson.objectives : [`Giải thích được khái niệm trong ${lessonTitle}.`, 'Thực hiện được nhiệm vụ theo tiêu chí.', 'Tự kiểm tra và giải thích kết quả.'],
                skills: [lessonTitle, track.label],
                theorySections,
                theory: theorySections.map(section => section.content),
                lecture: { title: `Bài giảng: ${lessonTitle}`, script: debugDetails?.lectureScript || `Hôm nay chúng ta học ${lessonTitle}. Trước hết hãy xác định mục tiêu và kiến thức nền. Tiếp theo, cùng tìm hiểu khái niệm cốt lõi, xem ví dụ có hướng dẫn rồi tự làm một nhiệm vụ tương tự. Khi hoàn thành, hãy kiểm tra kết quả theo tiêu chí, ghi lại lỗi và giải thích vì sao cách làm đúng. Cuối bài, vận dụng kiến thức vào tình huống mới để kiểm tra khả năng hiểu bản chất.` },
                examples,
                practiceTasks,
                activities: practiceTasks,
                studySteps: detailedLesson?.studySteps?.length ? detailedLesson.studySteps : ['Đọc mục tiêu và dự đoán câu trả lời', 'Học từng phần lý thuyết', 'Theo dõi ví dụ có hướng dẫn', 'Làm bài độc lập', 'Vận dụng thực tế', 'Làm bài kiểm tra và sửa lỗi'],
                commonMistakes: debugDetails?.commonMistakes || (detailedLesson?.commonMistakes?.length ? detailedLesson.commonMistakes : ['Bỏ sót yêu cầu hoặc điều kiện áp dụng', 'Chỉ ghi đáp án mà không trình bày căn cứ', 'Không kiểm tra đầu ra']),
                quickChecks: debugDetails?.quickChecks || (detailedLesson?.quickChecks?.length ? detailedLesson.quickChecks : ['Tôi có thể giải thích khái niệm bằng lời của mình không?', 'Tôi có thể làm một ví dụ mới không?', 'Tôi đã kiểm tra kết quả bằng một cách khác chưa?']),
                glossary: unique([lessonTitle, ...(detailedLesson?.glossary || []), track.label, 'dữ kiện', 'kiểm chứng']),
                audioScript: `Tóm tắt bài ${lessonTitle}. Xác định mục tiêu, nắm khái niệm cốt lõi, thực hiện từng bước, kiểm tra kết quả và vận dụng vào tình huống mới.`,
                test: { title: `Kiểm tra bài: ${lessonTitle}`, passingScore: 70, durationSeconds: 12 * 60, questions },
                codingTasks: trackKey === 'IT' ? [questions.find(q => q.type === 'coding')?.media?.coding].filter(Boolean) : [],
                generatedByAI: false,
                contentSource: 'LOCAL_EDUCATION_COMPOSER_V32'
            };
        }),
        test: { title: `Kiểm tra chương: ${chapter.title}`, passingScore: 70, durationSeconds: 25 * 60, questions: chapter.lessons.flatMap((title, li) => (trackKey === 'K12' ? buildK12Questions({ grade: grade || 5, subjectId: k12Subject?.id || subject, subjectName: k12Subject?.baseName || subjectLabel, topic: title, index: ci * 2 + li, count: 12 }).map(normalizeK12Question) : makeTrackQuestions({ topic: title, trackKey, grade, index: ci * 2 + li, target })).filter(q => q.type !== 'coding' && q.type !== 'practical')).slice(0, 14) }
    }));
    const allQuestions = chapters.flatMap(chapter => chapter.lessons.flatMap(lesson => lesson.test.questions));
    const objectiveQuestions = allQuestions.filter(q => !['coding', 'practical', 'speaking', 'essay'].includes(q.type));
    const midtermQuestions = objectiveQuestions.slice(0, 24);
    const finalQuestions = objectiveQuestions.slice(0, 48);
    const mockQuestions = objectiveQuestions.filter((_, i) => i % 2 === 0).slice(0, 30);
    const actualTitle = clean(target.courseTitle || title, 220);
    return {
        title: actualTitle,
        code: `LOCAL-${trackKey}-${BufferSafeCode(actualTitle)}`,
        description: `Khóa học được hệ thống tạo tự động cho mục tiêu: ${goal}. Gồm ${chapters.length} chương và ${chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0)} bài học được chọn theo phạm vi mục tiêu; mỗi bài có lý thuyết, bài giảng, ví dụ, luyện tập và đánh giá. Nội dung do bộ biên soạn nội bộ tạo, cần được kiểm duyệt nếu dùng làm giáo trình chính thức.`,
        audience: grade ? `Học sinh lớp ${grade}` : track.label,
        courseType: `LOCAL_${trackKey}_PERSONALIZED`,
        educationLevel: grade ? (grade <= 5 ? 'PRIMARY' : grade <= 9 ? 'SECONDARY_LOWER' : 'SECONDARY_UPPER') : 'UNIVERSITY',
        grade: grade || null,
        subjectId: subject,
        targetExam: trackKey === 'TOEIC' ? 'TOEIC' : clean(target.targetExam || '', 80),
        targetVariant: clean(target.targetVariant || '', 100),
        difficulty: 'ADAPTIVE',
        estimatedMinutes: chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0) * 35,
        objectives: [`Đạt mục tiêu học tập: ${goal}`, 'Nắm kiến thức theo từng phần', 'Luyện tập và tự kiểm tra', 'Tạo đầu ra có thể nộp hoặc đối chiếu'],
        prerequisites: ['Hoàn thành khảo sát đầu vào hoặc tự đánh giá nền tảng'],
        skills: unique([track.label, focus, ...chapters.map(ch => ch.title)]),
        learningOutcomes: ['Giải thích khái niệm', 'Làm bài độc lập', 'Vận dụng kiến thức vào tình huống', 'Tự đánh giá bằng tiêu chí'],
        chapters,
        midtermAssessment: { title: `Kiểm tra giữa kỳ · ${actualTitle}`, passingScore: 70, durationSeconds: 45 * 60, questions: midtermQuestions },
        finalAssessment: { title: `Kiểm tra cuối kỳ · ${actualTitle}`, passingScore: 70, durationSeconds: 60 * 60, questions: finalQuestions },
        mockAssessment: { title: `Bài thi thử · ${actualTitle}`, passingScore: 70, durationSeconds: 45 * 60, questions: mockQuestions },
        personalization: { mode: target.mode || 'PERSONAL', goal, target, generator: 'LOCAL_EDUCATION_COMPOSER_V34', generatedAt: new Date() }
    };
}
function BufferSafeCode(value) { return clean(value, 60).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'COURSE'; }

module.exports = { inferTrack, makeCourseDraft, makeTrackQuestions, resolveK12Lessons, extractFocusTopic, TRACKS };
