'use strict';

const crypto = require('crypto');

function clean(value, max = 500) { return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max); }
function listValues(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean);
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data?.items)) return value.data.items;
    if (Array.isArray(value?.data)) return value.data;
    if (value && typeof value === 'object') return Object.values(value).filter(item => ['string', 'number'].includes(typeof item));
    return [];
}
function listText(value) { return listValues(value).map(item => item && typeof item === 'object' ? clean(item.label || item.title || item.name || item.code || item.value || '') : clean(item, 300)).filter(Boolean).join(' '); }
function normalize(value) {
    return clean(value, 1200).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').trim();
}
function slug(value, max = 56) { return normalize(value).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, max).toUpperCase() || 'COURSE'; }
function fingerprint(input = {}) {
    const base = [input.educationLevel || 'HIGHER_EDUCATION', input.grade || '', input.subjectId || input.subject || '', input.domainCode || '', input.track || '', input.targetExam || '', input.majorId || input.major || '', normalize(input.title || input.name || '')].join('|');
    return crypto.createHash('sha256').update(normalize(base)).digest('hex');
}
const DOMAIN_RULES = [
    { code: 'COMPUTING', labels: ['cntt', 'it', 'programming', 'lap trinh', 'python', 'java', 'javascript', 'sql', 'dsa', 'data structure', 'cybersecurity', 'an toan thong tin', 'software', 'phan mem', 'ai', 'machine learning'], category: 'MAJOR_FOUNDATION', track: 'UNIVERSITY_IT', skills: ['Phân tích bài toán', 'Tư duy thuật toán', 'Thực hành lập trình'], mode: 'code' },
    { code: 'ECONOMICS', labels: ['kinh te', 'economics', 'business', 'marketing', 'tai chinh', 'finance', 'ke toan', 'accounting', 'logistics', 'quan tri', 'management'], category: 'MAJOR_FOUNDATION', track: 'UNIVERSITY_ECONOMICS', skills: ['Phân tích dữ liệu', 'Ra quyết định', 'Giải quyết tình huống'], mode: 'case' },
    { code: 'MECHATRONICS', labels: ['co dien tu', 'mechatronics', 'robot', 'plc', 'tu dong hoa', 'automation', 'arduino', 'iot', 'dieu khien'], category: 'MAJOR_FOUNDATION', track: 'UNIVERSITY_MECHATRONICS', skills: ['Mô hình hóa hệ thống', 'Đọc sơ đồ', 'Thực hành mô phỏng'], mode: 'lab' },
    { code: 'ENGINEERING', labels: ['ky thuat', 'engineering', 'dien tu', 'co khi', 'xay dung', 'ket cau', 'vat lieu', 'dien cong nghiep', 'cad', 'manufacturing'], category: 'MAJOR_FOUNDATION', track: 'UNIVERSITY_ENGINEERING', skills: ['Phân tích kỹ thuật', 'Đọc bản vẽ/sơ đồ', 'Thực hành thiết kế'], mode: 'lab' },
    { code: 'APPLIED_SCIENCES', labels: ['khoa hoc ung dung', 'applied science', 'hoa hoc', 'vat ly', 'sinh hoc', 'environment', 'moi truong', 'food technology', 'cong nghe thuc pham'], category: 'MAJOR_FOUNDATION', track: 'UNIVERSITY_APPLIED_SCIENCES', skills: ['Đặt giả thuyết', 'Phân tích bằng chứng', 'Thực hành thí nghiệm'], mode: 'lab' },
    { code: 'ENGLISH', labels: ['toeic', 'ielts', 'english', 'tieng anh', 'listening', 'reading', 'speaking', 'writing'], category: 'FOUNDATION', track: 'ENGLISH', skills: ['Từ vựng', 'Ngữ pháp', 'Chiến lược làm bài'], mode: 'english' },
    { code: 'MOS', labels: ['mos', 'excel', 'word', 'powerpoint', 'microsoft office'], category: 'FOUNDATION', track: 'MOS', skills: ['Thao tác ứng dụng', 'Độ chính xác', 'Hoàn thành tác vụ'], mode: 'office' },
    { code: 'K12', labels: ['toan', 'ngu van', 'tieng viet', 'lich su', 'dia ly', 'khoa hoc', 'tin hoc', 'vat li', 'hoa hoc', 'sinh hoc', 'grade', 'lop'], category: 'GENERAL_EDUCATION', track: 'K12', skills: ['Nhận biết kiến thức', 'Giải thích', 'Vận dụng'], mode: 'school' }
];
const DOMAIN_CURRICULA = {
    COMPUTING: [
        ['Nền tảng và mô hình tư duy', ['Xác định đầu vào, xử lý và đầu ra', 'Biểu diễn dữ liệu và kiểu dữ liệu', 'Phân rã bài toán thành hàm']],
        ['Thuật toán và cấu trúc', ['Rẽ nhánh, lặp và điều kiện dừng', 'Mảng, chuỗi và xử lý dữ liệu', 'Tìm kiếm, sắp xếp và phân tích độ phức tạp']],
        ['Xây dựng và kiểm thử', ['Thiết kế hàm và module', 'Viết test case và gỡ lỗi', 'Đọc hiểu, refactor và tài liệu hóa']],
        ['Dự án thực hành', ['Phân tích yêu cầu và thiết kế giải pháp', 'Triển khai phiên bản nhỏ', 'Kiểm thử, đánh giá và trình bày sản phẩm']]
    ],
    ECONOMICS: [
        ['Nền tảng khái niệm', ['Vấn đề kinh tế và chi phí cơ hội', 'Cung, cầu và cân bằng thị trường', 'Đọc chỉ số và biểu đồ kinh tế']],
        ['Phân tích doanh nghiệp', ['Mô hình doanh thu và chi phí', 'Phân khúc khách hàng và giá trị', 'Phân tích đối thủ và lựa chọn chiến lược']],
        ['Dữ liệu và quyết định', ['Đọc bảng tính và dữ liệu kinh doanh', 'Tính chỉ số và so sánh phương án', 'Diễn giải kết quả có căn cứ']],
        ['Case study', ['Xác định vấn đề trong tình huống', 'Đề xuất phương án có số liệu', 'Viết khuyến nghị và trình bày kết quả']]
    ],
    MECHATRONICS: [
        ['Cơ sở hệ thống', ['Thành phần cơ khí, điện và điều khiển', 'Đọc sơ đồ khối và sơ đồ mạch', 'Đại lượng, cảm biến và tín hiệu']],
        ['Điều khiển và lập trình', ['Logic điều kiện trong hệ thống', 'Đầu vào/đầu ra và điều khiển tuần tự', 'Điều khiển phản hồi ở mức nhập môn']],
        ['Mô phỏng và đo kiểm', ['Xây dựng mô hình thử nghiệm', 'Đo, ghi và phân tích dữ liệu', 'Chẩn đoán lỗi theo triệu chứng']],
        ['Mini project', ['Thiết kế giải pháp và tiêu chí nghiệm thu', 'Mô phỏng hoặc lắp ráp nguyên mẫu', 'Kiểm thử an toàn và báo cáo kết quả']]
    ],
    ENGINEERING: [
        ['Nền tảng kỹ thuật', ['Đọc yêu cầu và thông số kỹ thuật', 'Đại lượng, đơn vị và sai số đo', 'An toàn và quy chuẩn làm việc']],
        ['Mô hình và thiết kế', ['Đọc bản vẽ/sơ đồ kỹ thuật', 'Chọn vật liệu và thành phần phù hợp', 'Đánh giá ràng buộc và dung sai']],
        ['Phân tích và kiểm chứng', ['Tính toán thông số cơ bản', 'Kiểm tra phương án bằng dữ liệu', 'Phân tích lỗi và nguyên nhân']],
        ['Bài tập ứng dụng', ['Giải quyết một tình huống kỹ thuật', 'Lập bản thiết kế hoặc mô phỏng', 'Viết báo cáo kiểm thử và nghiệm thu']]
    ],
    APPLIED_SCIENCES: [
        ['Câu hỏi và nguyên lý', ['Xác định hiện tượng và câu hỏi khoa học', 'Biến số, đơn vị và phép đo', 'Phân biệt quan sát và suy luận']],
        ['Phương pháp thực nghiệm', ['Đặt giả thuyết có thể kiểm tra', 'Thiết kế thử nghiệm có đối chứng', 'Ghi nhận dữ liệu và sai số']],
        ['Phân tích bằng chứng', ['Biểu diễn dữ liệu bằng bảng và đồ thị', 'Nhận diện quy luật và ngoại lệ', 'Đánh giá độ tin cậy của kết luận']],
        ['Ứng dụng thực tiễn', ['Phân tích một tình huống thực tế', 'Đề xuất giải pháp dựa trên bằng chứng', 'Viết báo cáo và thảo luận hạn chế']]
    ],
    ENGLISH: [
        ['Xác định trình độ và chiến lược', ['Nhận diện cấu trúc dạng bài', 'Quản lý thời gian và thứ tự làm bài', 'Phân tích lỗi sau mỗi lượt luyện']],
        ['Kiến thức ngôn ngữ', ['Từ vựng theo ngữ cảnh', 'Ngữ pháp và cấu trúc câu', 'Diễn đạt lại và liên kết ý']],
        ['Luyện kỹ năng', ['Luyện có hướng dẫn theo dạng câu', 'Luyện theo thời gian giới hạn', 'Tự đánh giá theo tiêu chí/rubric']],
        ['Mô phỏng và cải thiện', ['Làm bài mô phỏng từng phần', 'Đọc thống kê lỗi theo kỹ năng', 'Lập kế hoạch luyện tập tiếp theo']]
    ],
    MOS: [
        ['Làm quen môi trường làm việc', ['Nhận diện giao diện và lệnh thường dùng', 'Quản lý tệp và thiết lập tài liệu', 'Đọc yêu cầu tác vụ trước khi thao tác']],
        ['Thực hiện thao tác cốt lõi', ['Thực hành định dạng/biến đổi dữ liệu', 'Sử dụng công cụ theo yêu cầu', 'Kiểm tra kết quả và lỗi thường gặp']],
        ['Tác vụ tổng hợp', ['Hoàn thành chuỗi thao tác nhiều bước', 'Sửa một tài liệu/bảng/slide chưa đúng', 'Tối ưu tính chính xác và tốc độ']],
        ['Mô phỏng bài thi', ['Làm task theo thời gian', 'Rà soát điều kiện hoàn thành', 'Đánh giá kết quả theo checklist']]
    ],
    K12: [
        ['Khám phá kiến thức nền', ['Nhận biết khái niệm trọng tâm của bài', 'Giải thích bằng ví dụ gần gũi', 'Kết nối với kiến thức bài trước']],
        ['Hiểu và luyện tập', ['Thực hiện ví dụ mẫu có hướng dẫn', 'Luyện tập từng bước', 'Giải thích vì sao chọn cách làm']],
        ['Vận dụng', ['Giải quyết tình huống quen thuộc', 'Phát hiện lỗi và sửa lỗi', 'Trình bày lời giải hoặc bằng chứng']],
        ['Củng cố và tự kiểm tra', ['Tóm tắt điều cần nhớ', 'Làm bài kiểm tra ngắn', 'Ôn lại nội dung còn chưa chắc']]
    ]
};
const DOMAIN_COURSE_SEEDS = {
    K12: [
        ['Toán học theo lớp', 'Toán'], ['Tiếng Việt và Ngữ văn theo lớp', 'Ngữ văn'], ['Tiếng Anh theo lớp', 'Tiếng Anh'], ['Tin học theo lớp', 'Tin học'], ['Khoa học tự nhiên theo lớp', 'Khoa học'], ['Lịch sử và Địa lí theo lớp', 'Lịch sử và Địa lí'], ['Công nghệ theo lớp', 'Công nghệ'], ['Giáo dục công dân theo lớp', 'Giáo dục công dân'], ['Vật lí theo lớp', 'Vật lí'], ['Hóa học theo lớp', 'Hóa học'], ['Sinh học theo lớp', 'Sinh học'], ['Ôn tập và kiểm tra theo lớp', 'Ôn tập']
    ],
    COMPUTING: [
        ['Lập trình Python nền tảng', 'Python'], ['Lập trình C++ và tư duy giải thuật', 'C++'], ['Cấu trúc dữ liệu và giải thuật', 'DSA'], ['Cơ sở dữ liệu và SQL thực hành', 'SQL'], ['Phát triển giao diện web', 'Frontend'], ['Xây dựng API backend', 'Backend API'], ['Git và quy trình phát triển phần mềm', 'Git'], ['Nhập môn an toàn thông tin', 'Cybersecurity'], ['Phân tích dữ liệu với Python', 'Data Analysis']
    ],
    ECONOMICS: [
        ['Nguyên lý kinh tế học', 'Economics'], ['Quản trị kinh doanh căn bản', 'Business Management'], ['Marketing và hành vi khách hàng', 'Marketing'], ['Tài chính doanh nghiệp', 'Corporate Finance'], ['Kế toán tài chính thực hành', 'Accounting'], ['Logistics và quản trị chuỗi cung ứng', 'Logistics'], ['Phân tích dữ liệu kinh doanh bằng bảng tính', 'Business Analytics']
    ],
    MECHATRONICS: [
        ['Mạch điện và cảm biến nhập môn', 'Circuits and Sensors'], ['Lập trình vi điều khiển', 'Microcontrollers'], ['PLC và điều khiển tuần tự', 'PLC'], ['Robot học căn bản', 'Robotics'], ['Hệ thống điều khiển tự động', 'Control Systems'], ['IoT và thu thập dữ liệu cảm biến', 'IoT']
    ],
    ENGINEERING: [
        ['Đọc bản vẽ kỹ thuật', 'Technical Drawing'], ['Vật liệu kỹ thuật và chọn vật liệu', 'Engineering Materials'], ['Thiết kế CAD căn bản', 'CAD'], ['Đo lường và dung sai', 'Metrology'], ['Quy trình sản xuất và kiểm soát chất lượng', 'Manufacturing']
    ],
    APPLIED_SCIENCES: [
        ['Phương pháp nghiên cứu khoa học ứng dụng', 'Applied Research'], ['Thống kê cho khoa học ứng dụng', 'Applied Statistics'], ['Thiết kế và phân tích thí nghiệm', 'Experimental Design'], ['Khoa học môi trường và phân tích dữ liệu', 'Environmental Science'], ['Công nghệ thực phẩm căn bản', 'Food Technology']
    ],
    ENGLISH: [
        ['TOEIC Listening: luyện từng Part có bấm giờ', 'TOEIC Listening'], ['TOEIC Reading: chiến lược và đề luyện', 'TOEIC Reading'], ['IELTS Academic: nền tảng 4 kỹ năng', 'IELTS Academic'], ['IELTS Writing Task 1 và Task 2', 'IELTS Writing']
    ],
    MOS: [
        ['MOS Word: định dạng và tạo tài liệu', 'MOS Word'], ['MOS Excel: công thức, dữ liệu và biểu đồ', 'MOS Excel'], ['MOS PowerPoint: thiết kế và trình chiếu', 'MOS PowerPoint']
    ]
};

function identifyDomain(input = {}) {
    const text = normalize([input.domainCode, input.track, input.subjectId, input.subject, input.major, input.title, input.prompt, input.targetExam].filter(Boolean).join(' '));
    const explicit = String(input.domainCode || '').toUpperCase();
    const byCode = DOMAIN_RULES.find(domain => domain.code === explicit);
    if (byCode) return byCode;
    let best = null; let score = 0;
    for (const domain of DOMAIN_RULES) {
        const hits = domain.labels.reduce((sum, label) => sum + (text.includes(normalize(label)) ? Math.max(1, normalize(label).split(' ').length) : 0), 0);
        if (hits > score) { best = domain; score = hits; }
    }
    if (input.educationLevel && /PRIMARY|SECONDARY/.test(String(input.educationLevel).toUpperCase())) return DOMAIN_RULES.find(domain => domain.code === 'K12');
    return best || DOMAIN_RULES[0];
}
function makeQuestion(topic, index, domain, lessonTitle) {
    const base = `${lessonTitle}: ${topic}`;
    if (domain.mode === 'code') {
        return [
            { type: 'single_choice', prompt: `Trước khi triển khai “${topic}”, bước nào giúp xác định đúng bài toán?`, options: [{ label: 'Xác định input/output và ràng buộc', value: 'A' }, { label: 'Viết code ngay không cần kiểm tra', value: 'B' }, { label: 'Bỏ qua trường hợp biên', value: 'C' }, { label: 'Chỉ đặt tên biến', value: 'D' }], answer: 'A', explanation: 'Mô tả đầu vào, đầu ra và ràng buộc giúp chọn thuật toán đúng.', skill: topic },
            { type: 'short_answer', prompt: `Nêu một trường hợp biên cần kiểm thử cho “${topic}”.`, answer: '', acceptedAnswers: [], explanation: 'Câu trả lời cần thể hiện điều kiện biên có thể làm giải pháp thất bại.', skill: topic, reviewRequired: true },
            { type: 'coding', prompt: `Thực hành: viết một hàm nhỏ minh họa “${topic}”. Nêu rõ cách xử lý đầu vào rỗng và trường hợp biên.`, options: [], answer: '', explanation: 'Đánh giá qua test case, tính đúng, trường hợp biên và cách trình bày code.', skill: topic, media: { coding: { language: 'python', starterCode: '# Viết lời giải tại đây\ndef solve(data):\n    # TODO: implement\n    return None\n', statement: `Cài đặt hàm giải quyết bài toán liên quan đến ${topic}.`, inputFormat: 'Dữ liệu theo mô tả của đề.', outputFormat: 'Kết quả của hàm solve.', visibleTestCases: [{ input: '[]', output: 'None' }], hiddenTestCases: [], timeLimitMs: 2000 }, rubric: { criteria: [{ name: 'Tính đúng', weight: 60 }, { name: 'Trường hợp biên', weight: 20 }, { name: 'Độ rõ ràng', weight: 20 }] } } }
        ];
    }
    if (domain.mode === 'english') {
        return [
            { type: 'single_choice', prompt: `Trong bài luyện “${topic}”, thao tác nào giúp tránh lặp lại lỗi?`, options: [{ label: 'Ghi lại loại lỗi và luyện lại dạng tương tự', value: 'A' }, { label: 'Chỉ xem điểm tổng', value: 'B' }, { label: 'Bỏ qua lời giải', value: 'C' }, { label: 'Làm thật nhanh mà không rà soát', value: 'D' }], answer: 'A', explanation: 'Phân loại lỗi tạo cơ sở cho ôn tập có mục tiêu.', skill: topic },
            { type: 'fill_blank', prompt: `Hoàn thành câu: “I have worked here ___ 2022.”`, options: [], answer: 'since', acceptedAnswers: ['since'], explanation: 'Dùng since với mốc thời gian bắt đầu.', skill: 'Grammar' },
            { type: 'short_answer', prompt: `Viết 1–2 câu nêu chiến lược bạn sẽ dùng khi gặp dạng “${topic}”.`, answer: '', explanation: 'Dùng rubric ngắn: phù hợp dạng bài, rõ ràng và có thể thực hiện.', skill: topic, rubric: { criteria: [{ name: 'Chiến lược phù hợp', weight: 50 }, { name: 'Giải thích rõ', weight: 50 }] } }
        ];
    }
    if (domain.mode === 'office') {
        return [
            { type: 'single_choice', prompt: `Trước khi nộp sản phẩm thực hành “${topic}”, việc nào quan trọng nhất?`, options: [{ label: 'Kiểm tra lại từng yêu cầu và kết quả đầu ra', value: 'A' }, { label: 'Chỉ đổi màu giao diện', value: 'B' }, { label: 'Bỏ qua lưu tệp', value: 'C' }, { label: 'Không kiểm tra công thức/định dạng', value: 'D' }], answer: 'A', explanation: 'Bài thực hành được đánh giá theo yêu cầu và sản phẩm cuối.', skill: topic },
            { type: 'practical', prompt: `Tác vụ MOS: hoàn thành “${topic}” trong tệp mẫu, sau đó kiểm tra kết quả theo checklist.`, options: [], answer: '', explanation: 'Nộp sản phẩm hoặc đánh giá theo rubric/checklist.', skill: topic, rubric: { criteria: [{ name: 'Đúng yêu cầu', weight: 60 }, { name: 'Định dạng/chính xác', weight: 25 }, { name: 'Lưu và nộp đúng', weight: 15 }] } },
            { type: 'short_answer', prompt: `Ghi 3 bước kiểm tra chất lượng sau khi hoàn thành “${topic}”.`, answer: '', explanation: 'Có thể trả lời theo checklist thao tác.', skill: topic, rubric: { criteria: [{ name: 'Đủ bước', weight: 60 }, { name: 'Rõ ràng', weight: 40 }] } }
        ];
    }
    if (domain.mode === 'lab' || domain.mode === 'case') {
        return [
            { type: 'single_choice', prompt: `Khi phân tích tình huống “${topic}”, cách tiếp cận nào đáng tin cậy nhất?`, options: [{ label: 'Xác định dữ kiện, giả định và tiêu chí đánh giá', value: 'A' }, { label: 'Chọn kết luận trước khi xem dữ liệu', value: 'B' }, { label: 'Bỏ qua đơn vị/điều kiện', value: 'C' }, { label: 'Chỉ dựa vào cảm tính', value: 'D' }], answer: 'A', explanation: 'Tách dữ kiện và giả định giúp kiểm tra được kết luận.', skill: topic },
            { type: 'matching', prompt: `Ghép quy trình thực hành cho “${topic}”.`, options: [{ left: 'Bước 1', right: 'Xác định mục tiêu và biến số' }, { left: 'Bước 2', right: 'Thu thập/kiểm tra dữ liệu' }, { left: 'Bước 3', right: 'Đánh giá kết quả và giới hạn' }], answer: { 'Bước 1': 'Xác định mục tiêu và biến số', 'Bước 2': 'Thu thập/kiểm tra dữ liệu', 'Bước 3': 'Đánh giá kết quả và giới hạn' }, explanation: 'Quy trình phải xác định mục tiêu trước rồi mới đánh giá kết quả.', skill: topic },
            { type: 'practical', prompt: `Thực hành/case: áp dụng “${topic}” vào tình huống minh họa, ghi dữ kiện, các bước xử lý, kết quả và hạn chế.`, options: [], answer: '', explanation: 'Dùng rubric để chấm quy trình, tính hợp lý và kết luận.', skill: topic, rubric: { criteria: [{ name: 'Phương pháp', weight: 35 }, { name: 'Dữ liệu/lập luận', weight: 35 }, { name: 'Kết luận và giới hạn', weight: 30 }] } }
        ];
    }
    return [
        { type: 'single_choice', prompt: `Ý nào mô tả phù hợp nhất việc học “${topic}”?`, options: [{ label: 'Hiểu khái niệm, làm ví dụ và tự kiểm tra', value: 'A' }, { label: 'Học thuộc tiêu đề mà không vận dụng', value: 'B' }, { label: 'Bỏ qua bước giải thích', value: 'C' }, { label: 'Chỉ xem đáp án mẫu', value: 'D' }], answer: 'A', explanation: 'Kết hợp hiểu, thực hành và tự đánh giá giúp kiểm tra mức độ nắm kiến thức.', skill: topic },
        { type: 'true_false', prompt: `Có thể kiểm tra mức độ hiểu “${topic}” bằng cách tự giải một ví dụ mới.`, options: [{ label: 'Đúng', value: 'true' }, { label: 'Sai', value: 'false' }], answer: 'true', explanation: 'Ví dụ mới kiểm tra khả năng vận dụng chứ không chỉ ghi nhớ.', skill: topic },
        { type: 'short_answer', prompt: `Giải thích ngắn gọn “${topic}” bằng lời của bạn và nêu một ví dụ.`, answer: '', explanation: 'Cần có định nghĩa/ý chính và ví dụ phù hợp.', skill: topic, rubric: { criteria: [{ name: 'Đúng ý', weight: 60 }, { name: 'Ví dụ phù hợp', weight: 40 }] } }
    ];
}
function buildCourseBlueprint(input = {}) {
    const title = clean(input.title || input.name || input.prompt || input.subjectId || 'Khóa học kỹ năng nền tảng', 180);
    const domain = identifyDomain({ ...input, title });
    const educationLevel = clean(input.educationLevel || (domain.code === 'ENGLISH' || domain.code === 'MOS' ? 'ENGLISH_CERTIFICATION' : 'HIGHER_EDUCATION'), 40).toUpperCase();
    const gradeNum = Number(input.grade);
    const grade = gradeNum >= 1 && gradeNum <= 12 ? gradeNum : null;
    const subjectId = slug(input.subjectId || input.subject || domain.code, 40);
    const code = slug(input.code || `${domain.code}-${grade ? `G${grade}-` : ''}${title}`, 72);
    const curriculum = DOMAIN_CURRICULA[domain.code] || DOMAIN_CURRICULA.COMPUTING;
    const objectives = [
        `Giải thích được các khái niệm cốt lõi của ${title}.`,
        `Áp dụng kiến thức của ${title} vào ví dụ và tình huống thực tế.`,
        'Tự kiểm tra kết quả, phát hiện lỗi và xác định nội dung cần ôn tập.'
    ];
    const chapters = curriculum.map(([chapterName, topics], chapterIndex) => ({
        code: `${code}-CH${chapterIndex + 1}`,
        title: chapterName,
        overview: `Chương này giúp người học đi từ kiến thức nền đến thao tác có thể kiểm tra được trong lĩnh vực ${domain.code}.`,
        lessons: topics.map((topic, lessonIndex) => {
            const lessonTitle = topic;
            const theorySections = [
                { title: 'Mục tiêu', content: `Sau bài này, người học có thể mô tả và thực hiện: ${topic.toLowerCase()}.` },
                { title: 'Ý chính', content: `${topic} là một phần của ${title}. Bắt đầu bằng cách xác định khái niệm, dữ kiện đầu vào và kết quả cần đạt. Tách vấn đề thành các bước nhỏ; mỗi bước phải có mục đích rõ ràng và tiêu chí kiểm tra.` },
                { title: 'Quy trình thực hiện', content: `Bước 1: đọc yêu cầu và xác định điều kiện. Bước 2: chọn phương pháp phù hợp. Bước 3: thực hiện trên ví dụ nhỏ. Bước 4: so sánh kết quả với tiêu chí. Bước 5: sửa lỗi và ghi lại điều cần nhớ.` },
                { title: 'Ví dụ hướng dẫn', content: `Ví dụ: áp dụng “${topic}” vào một nhiệm vụ nhỏ. Viết ra dữ kiện đã biết, điều cần tìm, phương pháp được chọn, kết quả và lý do kết quả hợp lý. Nếu kết quả chưa đúng, kiểm tra lần lượt giả định, dữ liệu đầu vào, từng bước xử lý và kết quả cuối.` },
                { title: 'Lỗi thường gặp', content: `Các lỗi hay gặp gồm bỏ qua điều kiện đầu vào, làm theo máy móc mà không giải thích, không kiểm tra trường hợp biên và chỉ xem đáp án thay vì tự phân tích. Hãy dùng checklist trước khi kết thúc bài.` },
                { title: 'Tự kiểm tra', content: `Không nhìn ghi chú, hãy giải thích lại “${topic}” bằng lời của mình, tạo một ví dụ khác và nêu cách phát hiện khi làm sai.` }
            ];
            const examples = [
                { title: 'Ví dụ có hướng dẫn', content: `Xác định mục tiêu của “${topic}”, liệt kê dữ kiện, thực hiện từng bước, sau đó đối chiếu kết quả với yêu cầu.` },
                { title: 'Ví dụ biến thể', content: `Thay đổi một dữ kiện của ví dụ trước và dự đoán phần nào của quy trình phải thay đổi. Giải thích vì sao.` }
            ];
            const practical = domain.mode === 'code' ? { kind: 'coding', title: `Lab: ${topic}`, instructions: 'Viết lời giải, chạy bộ test công khai, tự bổ sung trường hợp biên và giải thích độ phức tạp.', deliverable: 'Mã nguồn, test case, ghi chú giải pháp.', starterCode: 'def solve(data):\n    # TODO: implement\n    return None\n', visibleTestCases: [{ input: '[]', output: 'None' }], hiddenTestCases: [] }
                : domain.mode === 'office' ? { kind: 'practical', title: `Bài thực hành: ${topic}`, instructions: 'Thực hiện các thao tác trong Word/Excel/PowerPoint theo từng yêu cầu; kiểm tra sản phẩm với checklist trước khi nộp.', deliverable: 'Tệp đầu ra đã hoàn thành và checklist.' }
                : domain.mode === 'english' ? { kind: 'timed_practice', title: `Timed practice: ${topic}`, instructions: 'Làm bài theo thời gian quy định, ghi lại câu sai theo nhóm kỹ năng và xem giải thích sau khi nộp.', deliverable: 'Bài làm, thời gian, danh sách lỗi và kế hoạch luyện lại.' }
                : { kind: domain.mode === 'lab' ? 'lab' : 'case_study', title: `Thực hành: ${topic}`, instructions: 'Áp dụng quy trình vào case nhỏ, ghi dữ kiện, các bước xử lý, kết quả, rủi ro và cách kiểm chứng.', deliverable: 'Báo cáo ngắn hoặc sản phẩm minh họa kèm tiêu chí đánh giá.' };
            return {
                code: `${code}-CH${chapterIndex + 1}-L${lessonIndex + 1}`, title: lessonTitle,
                objectives: [`Nắm được ${topic.toLowerCase()}.`, 'Thực hiện đúng quy trình và giải thích kết quả.', 'Kiểm tra được ít nhất một lỗi/ngoại lệ.'],
                theorySections,
                lectureScript: { opening: `Trong bài này, chúng ta sẽ học ${topic.toLowerCase()} theo từng bước ngắn.`, teachingSteps: theorySections.slice(1, 5).map(section => ({ heading: section.title, script: section.content })), checksForUnderstanding: [`Hãy tự giải thích ${topic.toLowerCase()} bằng lời của bạn.`, 'Nếu thay đổi dữ kiện, điều gì sẽ thay đổi trong cách làm?'], summary: `Ghi nhớ: xác định yêu cầu → chọn cách làm → thực hiện → kiểm tra → rút kinh nghiệm.` },
                examples, activities: [{ title: 'Làm cùng ví dụ', instructions: `Dừng sau mỗi bước của ${topic.toLowerCase()} và dự đoán bước tiếp theo.` }, { title: 'Tự làm', instructions: 'Làm một ví dụ mới không nhìn lời giải, sau đó tự chấm bằng checklist.' }],
                practice: [ { title: 'Bài cơ bản', instructions: `Giải thích hoặc thực hiện bước đầu tiên của ${topic.toLowerCase()}.` }, { title: 'Bài vận dụng', instructions: `Áp dụng ${topic.toLowerCase()} vào trường hợp có ít nhất một điều kiện khác ví dụ mẫu.` }, { title: 'Bài thử thách', instructions: 'Tạo một trường hợp biên và giải thích cách xác minh kết quả.' } ],
                practical, questions: makeQuestion(topic, lessonIndex, domain, lessonTitle).map((question, questionIndex) => ({ ...question, code: `${code}-CH${chapterIndex + 1}-L${lessonIndex + 1}-Q${questionIndex + 1}`, points: question.type === 'coding' || question.type === 'practical' ? 5 : 1, difficulty: questionIndex === 0 ? 'EASY' : questionIndex === 1 ? 'MEDIUM' : 'HARD', cognitiveLevel: questionIndex === 0 ? 'UNDERSTAND' : questionIndex === 1 ? 'APPLY' : 'CREATE', tags: [domain.code, topic], sourceType: 'AI_GENERATED' })),
                skills: [topic, ...domain.skills.slice(0, 1)], prerequisites: lessonIndex > 0 ? [`${chapterName}: ${topics[lessonIndex - 1]}`] : [], estimatedMinutes: domain.mode === 'code' || domain.mode === 'lab' || domain.mode === 'office' ? 45 : 25,
                difficulty: lessonIndex === 0 ? 'FOUNDATION' : lessonIndex === 1 ? 'INTERMEDIATE' : 'APPLIED', sourceType: 'AI_GENERATED'
            };
        })
    }));
    return {
        title, code, educationLevel, grade, subjectId, domainCode: domain.code, track: domain.track, category: domain.category,
        majorName: clean(input.major || input.majorName || '', 140), description: `Khóa học theo từng bước về ${title}, xây dựng bằng Local Education AI. Nội dung là bản nháp học liệu gốc, cần được quản trị viên rà soát trước khi công bố.`,
        objectives, estimatedMinutes: chapters.reduce((sum, chapter) => sum + chapter.lessons.reduce((n, lesson) => n + lesson.estimatedMinutes, 0), 0),
        chapters, sourceType: 'AI_GENERATED', courseKind: 'AI_DRAFT', official: false,
        metadata: { engine: 'LOCAL_EDUCATION_AI', engineVersion: '1.0.0', noExternalApi: true, fingerprint: fingerprint({ ...input, title, educationLevel, grade, subjectId, domainCode: domain.code }) }
    };
}
function wordCount(value) { return String(value || '').trim().split(/\s+/).filter(Boolean).length; }
function validateCourseBlueprint(blueprint) {
    const errors = []; const warnings = [];
    if (!clean(blueprint?.title, 180)) errors.push('Thiếu tên khóa học.');
    if (!clean(blueprint?.code, 80)) errors.push('Thiếu mã khóa học.');
    if (!Array.isArray(blueprint?.chapters) || !blueprint.chapters.length) errors.push('Khóa học phải có ít nhất một chương.');
    const allLessons = (blueprint?.chapters || []).flatMap(chapter => chapter.lessons || []);
    if (allLessons.length < 4) errors.push('Bản nháp phải có ít nhất 4 bài học.');
    const codes = new Set();
    for (const [index, lesson] of allLessons.entries()) {
        if (!lesson.code || codes.has(lesson.code)) errors.push(`Bài ${index + 1}: mã bài thiếu hoặc trùng.`);
        codes.add(lesson.code);
        if (!lesson.title) errors.push(`Bài ${index + 1}: thiếu tiêu đề.`);
        if (!Array.isArray(lesson.theorySections) || lesson.theorySections.length < 4) errors.push(`Bài ${index + 1}: cần chia lý thuyết thành ít nhất 4 phần ngắn.`);
        if (!Array.isArray(lesson.practice) || !lesson.practice.length) errors.push(`Bài ${index + 1}: chưa có luyện tập.`);
        if (!Array.isArray(lesson.questions) || lesson.questions.length < 2) errors.push(`Bài ${index + 1}: cần có câu hỏi kiểm tra.`);
        if (!lesson.practical) warnings.push(`Bài ${index + 1}: chưa có hoạt động thực hành rõ ràng.`);
        for (const question of lesson.questions || []) {
            if (!question.prompt || !question.type) errors.push(`Câu hỏi '${question.code || lesson.code}' thiếu nội dung hoặc dạng câu.`);
            if (['single_choice', 'multiple_choice', 'true_false'].includes(question.type) && (!Array.isArray(question.options) || question.options.length < 2)) errors.push(`Câu ${question.code}: thiếu phương án.`);
            if (question.type === 'coding' && !question.media?.coding?.starterCode) errors.push(`Câu ${question.code}: bài coding thiếu starter code.`);
        }
    }
    const totalWords = allLessons.reduce((sum, lesson) => sum + (lesson.theorySections || []).reduce((count, section) => count + wordCount(section.content), 0), 0);
    return { valid: errors.length === 0, status: errors.length ? 'INVALID / NEEDS_REPAIR' : 'VALIDATED_FOR_ADMIN_REVIEW', errors, warnings, chapterCount: (blueprint?.chapters || []).length, lessonCount: allLessons.length, questionCount: allLessons.reduce((sum, lesson) => sum + (lesson.questions || []).length, 0), theoryWordCount: totalWords, practicalLessonCount: allLessons.filter(lesson => lesson.practical).length, codingQuestionCount: allLessons.reduce((sum, lesson) => sum + (lesson.questions || []).filter(question => question.type === 'coding').length, 0), official: false };
}
function similarity(a, b) {
    const left = new Set(normalize(a).split(' ').filter(token => token.length > 2));
    const right = new Set(normalize(b).split(' ').filter(token => token.length > 2));
    if (!left.size || !right.size) return 0;
    let overlap = 0; for (const token of left) if (right.has(token)) overlap += 1;
    return overlap / Math.max(left.size, right.size);
}
function findDuplicateCourses(input = {}, courses = [], starterCourses = []) {
    const targetDomain = identifyDomain(input).code;
    const level = String(input.educationLevel || '').toUpperCase(); const grade = Number(input.grade) || null;
    const title = input.title || input.name || input.prompt || '';
    const candidates = [...courses.map(course => ({ ...course, existingSource: 'DATABASE' })), ...starterCourses.map(course => ({ ...course, existingSource: 'STARTER_CATALOG', name: course.name || course.title, title: course.name || course.title }))];
    return candidates.map(course => {
        const courseDomain = String(course.syllabus?.academicDomainCode || course.academicDomainCode || course.domainCode || course.track || '').toUpperCase();
        const sameDomain = !courseDomain || courseDomain.includes(targetDomain) || identifyDomain({ ...course, title: course.name || course.title, subjectId: course.subjectId }).code === targetDomain;
        const sameLevel = !level || !course.educationLevel || String(course.educationLevel).toUpperCase() === level;
        const sameGrade = !grade || !course.grade || Number(course.grade) === grade;
        const nameScore = similarity(title, course.name || course.title || course.code || '');
        const exactName = normalize(title) && normalize(title) === normalize(course.name || course.title || '');
        const score = exactName && sameDomain && sameLevel && sameGrade ? 1 : (sameDomain && sameLevel && sameGrade ? nameScore : 0);
        return { courseId: String(course._id || course.id || course.code || ''), code: course.code || '', title: course.name || course.title || course.code, score: Number(score.toFixed(3)), existingSource: course.existingSource, suggestedAction: score >= 0.8 ? 'REUSE_OR_ENRICH' : 'REVIEW_SIMILARITY' };
    }).filter(item => item.score >= 0.8).sort((a, b) => b.score - a.score).slice(0, 5);
}
function analyzeCatalogGaps({ goal = '', requestedSkills = [], courses = [], mastery = [], learningErrors = [], starterCourses = [] } = {}) {
    requestedSkills = listValues(requestedSkills);
    courses = listValues(courses).filter(item => item && typeof item === 'object');
    mastery = listValues(mastery).filter(item => item && typeof item === 'object');
    learningErrors = listValues(learningErrors).filter(item => item && typeof item === 'object');
    starterCourses = listValues(starterCourses).filter(item => item && typeof item === 'object');
    const weakSkills = mastery.filter(item => Number(item.accuracy ?? item.score ?? 100) < 65).map(item => ({ skill: clean(item.skill || item.code || '', 120), currentLevel: Number(item.accuracy ?? item.score ?? 0), reason: 'Skill Mastery dưới 65%.' }));
    const errorSkills = learningErrors.filter(item => !item.resolved).reduce((all, item) => { const skill = clean(item.skill || item.subjectId || '', 120); if (skill && !all.some(entry => normalize(entry.skill) === normalize(skill))) all.push({ skill, currentLevel: null, reason: 'Có lỗi học tập chưa xử lý.' }); return all; }, []);
    const skills = [...new Set([...requestedSkills, ...weakSkills.map(item => item.skill), ...errorSkills.map(item => item.skill)].map(value => clean(value, 120)).filter(Boolean))];
    const sourceCourses = [...courses, ...starterCourses];
    const matchFor = skill => sourceCourses.map(course => ({ course, score: Math.max(similarity(skill, `${course.name || course.title || ''} ${course.subjectId || ''} ${course.description || ''} ${listText(course.skills ?? course.syllabus?.skills)} ${listText(course.aliases ?? course.syllabus?.aliases)}`), normalize(skill) && normalize(`${course.name || course.title || ''} ${course.subjectId || ''}`) === normalize(skill) ? 1 : 0) })).sort((a, b) => b.score - a.score).slice(0, 3);
    const gaps = skills.map(skill => {
        const matches = matchFor(skill).filter(item => item.score >= 0.34);
        const evidence = weakSkills.find(item => normalize(item.skill) === normalize(skill)) || errorSkills.find(item => normalize(item.skill) === normalize(skill));
        return { skill, currentLevel: evidence?.currentLevel ?? null, reason: evidence?.reason || (goal ? `Liên quan mục tiêu: ${clean(goal, 180)}` : 'Kỹ năng được yêu cầu nhưng chưa có bằng chứng mastery.'), status: matches.length ? 'CATALOG_COVERED' : 'COURSE_GAP', recommendedCourses: matches.map(item => ({ code: item.course.code || '', title: item.course.name || item.course.title || item.course.code, score: Number(item.score.toFixed(2)), id: String(item.course._id || item.course.id || '') })) };
    });
    return { engine: 'LOCAL_EDUCATION_AI', remoteApiUsed: false, goal: clean(goal, 200), gaps, summary: { skillCount: skills.length, coveredCount: gaps.filter(gap => gap.status === 'CATALOG_COVERED').length, missingCount: gaps.filter(gap => gap.status === 'COURSE_GAP').length }, recommendedActions: gaps.filter(gap => gap.status === 'COURSE_GAP').map(gap => ({ type: 'COURSE_GAP', title: `Đề xuất khóa học: ${gap.skill}`, reason: gap.reason, skill: gap.skill, requiresAdminReview: true })) };
}
function buildLessonRepairPatch({ lesson = {}, course = {} } = {}) {
    const topic = clean(lesson.title || lesson.code || 'Kiến thức trọng tâm', 180);
    const courseTitle = clean(course.name || lesson.subjectId || 'môn học', 180);
    const domain = identifyDomain({ title: `${courseTitle} ${topic}`, subjectId: lesson.subjectId || course.subjectId, domainCode: course.syllabus?.domainCode, track: course.syllabus?.track });
    const wordCount = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;
    const oldSections = Array.isArray(lesson.theorySections) ? lesson.theorySections.filter(section => clean(section.content, 8000)) : [];
    const oldTheory = String(lesson.theory || oldSections.map(section => section.content).join('\n\n'));
    const oldWords = wordCount(oldTheory);
    const theorySections = oldWords >= 100 && oldSections.length >= 2 ? oldSections : [
        { title: 'Mục tiêu bài học', content: `Sau bài “${topic}”, người học cần giải thích được khái niệm chính, nhận biết khi nào nên áp dụng và hoàn thành một nhiệm vụ nhỏ liên quan đến ${courseTitle}. Trước khi bắt đầu, hãy xác định kiến thức nền cần dùng, dữ kiện được cung cấp và kết quả mong muốn. Cuối bài, người học phải tự trình bày lại cách làm bằng lời của mình và đưa ra một bằng chứng cho thấy kết quả là hợp lý.` },
        { title: 'Khái niệm cốt lõi', content: `Trong phạm vi “${topic}”, không nên học thuộc tên gọi riêng lẻ mà cần hiểu mối quan hệ giữa khái niệm, điều kiện áp dụng và kết quả. Hãy tách bài toán thành các yếu tố nhỏ, ghi rõ dữ kiện, quy tắc liên quan và giới hạn của cách làm. Nếu gặp một thuật ngữ mới, hãy viết một định nghĩa ngắn, nêu ví dụ đúng và so sánh với một trường hợp không phù hợp. Cách làm này giúp tránh nhầm lẫn khi bài tập đổi dữ kiện.` },
        { title: 'Quy trình thực hiện', content: `Bước 1: đọc yêu cầu và gạch chân dữ kiện quan trọng. Bước 2: xác định khái niệm hoặc phương pháp của bài “${topic}” có liên quan. Bước 3: lập kế hoạch xử lý trước khi tính toán, viết mã hoặc đưa ra kết luận. Bước 4: thực hiện từng bước và ghi lại kết quả trung gian. Bước 5: kiểm tra kết quả với điều kiện ban đầu, thử ít nhất một trường hợp khác và giải thích vì sao đáp án đáp ứng yêu cầu. Nếu kết quả không khớp, quay lại từng bước thay vì làm lại tùy ý.` },
        { title: 'Ví dụ có hướng dẫn', content: `Xét một tình huống nhỏ liên quan đến “${topic}” trong ${courseTitle}. Đầu tiên, xác định mục tiêu cần đạt và liệt kê dữ kiện đã biết. Tiếp theo, lựa chọn phương pháp phù hợp, nêu lý do lựa chọn và thực hiện theo thứ tự. Sau khi có kết quả, hãy thay đổi một dữ kiện để xem kết quả nào cần thay đổi, kết quả nào phải giữ nguyên. Cuối cùng, so sánh với tiêu chí đầu bài và diễn đạt bằng một câu kết luận hoàn chỉnh. Ví dụ này là mẫu quy trình; giáo viên cần bổ sung dữ kiện cụ thể cho đúng bài đang dạy.` },
        { title: 'Lỗi thường gặp và tự kiểm tra', content: `Các lỗi thường gặp là đọc thiếu điều kiện, nhầm dữ kiện với giả định, bỏ qua đơn vị hoặc trường hợp biên, chỉ nhìn kết quả cuối mà không kiểm tra bước trung gian. Với “${topic}”, hãy tự hỏi: mình đã dùng đúng khái niệm chưa, có dữ kiện nào bị bỏ qua không, kết quả có hợp lý không và có cách kiểm tra độc lập nào không? Trước khi kết thúc, viết lại ba ý cần nhớ, một lỗi cần tránh và một câu hỏi mới để tự luyện. Không dùng đoạn nội dung này thay cho việc đối chiếu với giáo trình hoặc tài liệu của môn học.` }
    ];
    const existingExamples = Array.isArray(lesson.examples) ? lesson.examples : [];
    const examples = existingExamples.length >= 2 ? existingExamples : [
        ...existingExamples,
        { title: `Ví dụ 1 · ${topic}`, content: `Xác định yêu cầu, dữ kiện và kết quả cần có cho một tình huống thuộc ${topic}. Thực hiện theo quy trình từng bước, rồi ghi cách kiểm tra kết quả.` },
        { title: `Ví dụ 2 · Biến thể`, content: `Thay đổi một dữ kiện đầu vào của ví dụ trước. Dự đoán điều gì sẽ thay đổi, thực hiện lại và giải thích vì sao kết quả vẫn đáp ứng hoặc không còn đáp ứng yêu cầu.` }
    ].slice(0, 6);
    const existingActivities = Array.isArray(lesson.activities) ? lesson.activities : [];
    const activities = existingActivities.length ? existingActivities : [{ title: `Thực hành · ${topic}`, kind: domain.mode === 'code' ? 'coding' : domain.mode === 'office' ? 'practical' : domain.mode === 'lab' ? 'lab' : domain.mode === 'case' ? 'case_study' : 'applied_problem', instructions: domain.mode === 'code' ? `Viết hoặc sửa một chương trình áp dụng ${topic}; chạy ít nhất ba test gồm dữ liệu thường, biên và không hợp lệ. Ghi input/output và giải thích một lỗi đã xử lý.` : domain.mode === 'office' ? `Hoàn thành tác vụ ${topic} trên tệp thực hành, lưu tệp đầu ra và tự đối chiếu từng tiêu chí trong checklist.` : domain.mode === 'lab' ? `Lập sơ đồ hoặc mô hình nhỏ cho ${topic}; nêu điều kiện, thu thập dữ liệu/mô phỏng, ghi sai số và kết luận về độ tin cậy.` : domain.mode === 'case' ? `Phân tích case về ${topic}; tách dữ kiện/giả định, so sánh ít nhất hai phương án bằng tiêu chí rõ ràng và nêu khuyến nghị có căn cứ.` : `Tạo một ví dụ mới về ${topic}, trình bày đủ bước giải quyết và tự kiểm tra kết quả bằng một cách thứ hai.` }];
    const oldPayload = lesson.payload && typeof lesson.payload === 'object' ? lesson.payload : {};
    const lectureScript = oldPayload.lectureScript || {
        opening: `Hôm nay chúng ta học “${topic}”. Trước hết, hãy xác định vấn đề cần giải quyết và kết quả cần đạt.`,
        teachingSteps: theorySections.slice(1, 4).map(section => ({ heading: section.title, script: section.content })),
        checksForUnderstanding: [`Em hãy giải thích ${topic} bằng lời của mình.`, 'Nếu thay đổi dữ kiện, em sẽ kiểm tra lại bước nào trước?'],
        summary: `Ghi nhớ quy trình: đọc yêu cầu → chọn phương pháp → thực hiện → kiểm chứng → rút kinh nghiệm.`
    };
    const currentPayloadPractical = oldPayload.practical && typeof oldPayload.practical === 'object' ? oldPayload.practical : {};
    const practical = currentPayloadPractical.instructions ? currentPayloadPractical : { ...currentPayloadPractical, kind: domain.mode, instructions: activities[0].instructions, deliverable: domain.mode === 'code' ? 'Mã nguồn, test case và ghi chú giải pháp.' : domain.mode === 'office' ? 'Tệp đầu ra đã hoàn thành và checklist.' : 'Báo cáo/nghiệm vụ, bằng chứng kết quả và phần tự đánh giá.' };
    const patch = {
        theorySections,
        theory: theorySections.map(section => section.content).join('\n\n'),
        examples,
        activities,
        payload: { ...oldPayload, lectureScript, practical, localRepair: { engine: 'LOCAL_EDUCATION_AI', repairedAt: new Date().toISOString(), note: 'Bổ sung cấu trúc thiếu theo quy tắc nội bộ; cần Admin rà soát tính đúng đắn theo tài liệu môn học.' } }
    };
    return { targetType: 'LESSON', repairable: true, status: 'REPAIRED_DRAFT', patch, changedFields: Object.keys(patch), wordCount: wordCount(patch.theory), note: 'Chỉ sửa một bài học, giữ lại các ví dụ/thực hành đã có; cần Admin rà soát trước khi công bố.' };
}
function buildQuestionRepairPatch({ question = {} } = {}) {
    const type = clean(question.type, 80).toLowerCase();
    const prompt = clean(question.prompt, 5000);
    if (!prompt) return { targetType: 'QUESTION', repairable: false, status: 'NEEDS_ADMIN_REVIEW', changedFields: [], note: 'Không tự bịa đề bài khi prompt đang trống. Hãy nhập lại nội dung câu hỏi.' };
    const options = (Array.isArray(question.options) ? question.options : []).map((option, index) => {
        if (!option || typeof option !== 'object') return { label: String(option ?? ''), value: option ?? String(index) };
        const label = option.label ?? option.text ?? option.title ?? option.value ?? option.id ?? '';
        const value = option.value ?? option.id ?? option.key ?? label;
        return { label: String(label), value };
    }).filter(option => option.label.trim());
    const objectiveTypes = ['single_choice','multiple_choice','true_false'];
    const answerPresent = question.answer !== undefined && question.answer !== null && question.answer !== '' || Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0;
    const errors = [];
    if (objectiveTypes.includes(type) && options.length < 2) errors.push('Thiếu ít nhất hai lựa chọn hợp lệ.');
    if (['single_choice','multiple_choice','true_false','fill_blank','numerical','ordering','matching'].includes(type) && !answerPresent) errors.push('Chưa có đáp án chuẩn/acceptedAnswers; không tự suy đoán đáp án.');
    if (type === 'coding' && (!question.media?.coding?.starterCode || !(question.media?.coding?.visibleTestCases || question.media?.coding?.publicTestCases || []).length)) errors.push('Bài coding thiếu starter code hoặc test công khai.');
    if (['essay','speaking','practical','coding'].includes(type) && !Object.keys(question.rubric || {}).length) errors.push('Cần rubric chấm cho dạng bài này.');
    const needsReview = errors.length > 0;
    const patch = { options, status: 'DRAFT', version: Math.max(1, Number(question.version) || 1) + 1 };
    if (!question.code) patch.code = slug(`${type}-${prompt.slice(0, 48)}`, 72);
    if (!question.explanation && answerPresent) patch.explanation = 'Đáp án cần được đối chiếu với lời giải/tiêu chí do giáo viên xác nhận trước khi công bố.';
    return { targetType: 'QUESTION', repairable: true, status: needsReview ? 'NEEDS_ADMIN_REVIEW' : 'REPAIRED_DRAFT', patch, changedFields: Object.keys(patch), errors, note: needsReview ? 'Đã chuẩn hóa cấu trúc an toàn và chuyển về nháp; không tự tạo đáp án hoặc test ẩn còn thiếu.' : 'Đã chuẩn hóa lựa chọn và chuyển về nháp để Admin rà soát.', requiresAdminReview: true };
}
function buildAssessmentRepairPatch({ assessment = {}, availableQuestions = [] } = {}) {
    const existingIds = Array.isArray(assessment.questionIds) ? assessment.questionIds : [];
    const foundIds = new Set(availableQuestions.map(question => String(question._id || question.id || '')));
    const validExisting = existingIds.filter(id => foundIds.has(String(id)));
    const selectedIds = validExisting.length ? validExisting : availableQuestions.filter(question => clean(question.prompt, 5000)).slice(0, 20).map(question => question._id || question.id).filter(Boolean);
    if (!selectedIds.length) return { targetType: 'ASSESSMENT', repairable: false, status: 'NEEDS_ADMIN_REVIEW', changedFields: [], note: 'Không tìm được câu hỏi hợp lệ để gắn vào đề. Hãy tạo/sửa câu hỏi trước.' };
    const title = clean(assessment.title || 'Bài kiểm tra', 180);
    const sections = Array.isArray(assessment.sections) && assessment.sections.length ? assessment.sections : [{ code: 'MAIN', title, questionIds: selectedIds }];
    if (!sections[0] || !sections[0].questionIds?.length) sections[0] = { ...(sections[0] && typeof sections[0] === 'object' ? sections[0] : {}), code: sections[0]?.code || 'MAIN', title: sections[0]?.title || title, questionIds: selectedIds };
    const patch = { questionIds: selectedIds, questionPool: Array.isArray(assessment.questionPool) && assessment.questionPool.length ? assessment.questionPool.filter(id => foundIds.has(String(id))) : selectedIds, sections, publicationStatus: 'DRAFT' };
    if (!patch.questionPool.length) patch.questionPool = selectedIds;
    return { targetType: 'ASSESSMENT', repairable: true, status: 'REPAIRED_DRAFT', patch, changedFields: Object.keys(patch), questionCount: selectedIds.length, note: 'Đã nối các câu hỏi có thật vào một bản nháp; không tự công bố đề.' };
}
function buildAdminGuide() {
    return {
        engine: 'LOCAL_EDUCATION_AI', title: 'Hướng dẫn quản trị nội dung', steps: [
            { title: '1. Thêm môn học / lĩnh vực', steps: ['Mở Admin → Trình tạo nội dung → Môn / chương.', 'Chọn loại Môn học hoặc Lĩnh vực / chủ đề, đặt tên và mã dễ nhận ra.', 'Chọn đúng bậc học; với K12 nhập lớp từ 1 đến 12.', 'Lưu bản nháp rồi xem lại trong danh sách.'] },
            { title: '2. Thêm chương trình đào tạo Đại học', steps: ['Mở Chương trình đào tạo.', 'Chọn trường/cơ sở đào tạo trước; chọn khoa, lĩnh vực, nhóm ngành, ngành và chuyên ngành nếu đã có.', 'Nhập tên chương trình, phiên bản, năm học, khóa tuyển sinh, tín chỉ và chuẩn đầu ra.', 'Chương trình mới luôn là bản nháp và cần đối chiếu với tài liệu của trường trước khi kích hoạt.'] },
            { title: '3. Thêm khóa học', steps: ['Mở Trình tạo nội dung → Tạo khóa học.', 'Nhập tên, mã (có thể để trống), bậc học, lớp, môn/kỹ năng và lĩnh vực.', 'Nếu là học phần đại học, liên kết chương trình đào tạo phù hợp.', 'Viết mô tả và mục tiêu; lưu bản nháp, sau đó thêm chương/bài và bài kiểm tra.'] },
            { title: '4. Thêm chương / chapter', steps: ['Mở Môn / chương / chủ đề và chọn Chương / đơn vị kiến thức.', 'Chọn khóa học đích trước khi lưu.', 'Nhập tiêu đề, mã, mục tiêu và mô tả ngắn.', 'Tránh tạo chương trùng tên/mã trong cùng phạm vi khóa học.'] },
            { title: '5. Thêm lesson / bài học', steps: ['Mở Bài học & bài giảng.', 'Chọn khóa học rồi chọn chương; danh sách chương sẽ lọc theo khóa học.', 'Nhập tiêu đề, mục tiêu, thời lượng, kỹ năng và độ khó.', 'Một bài nên tập trung một kỹ năng chính, không gộp cả chương vào một bài.'] },
            { title: '6. Viết lý thuyết dễ đọc', steps: ['Trong biểu mẫu bài học, nhập lý thuyết thành các mục riêng.', 'Mỗi mục chỉ giải thích một khái niệm hoặc một bước.', 'Dùng ví dụ ngắn sau mỗi khái niệm; không dồn tài liệu dài vào một đoạn.', 'Dùng dòng trống để tách các phần khi lưu.'] },
            { title: '7. Viết lecture / lời giảng', steps: ['Nhập lời dẫn nhập, cách giải thích, ví dụ, câu hỏi kiểm tra hiểu và phần tổng kết.', 'Lời giảng phải khác bản lý thuyết đọc thêm.', 'Ghi rõ lỗi thường gặp hoặc điểm cần nhấn mạnh.'] },
            { title: '8. Thêm examples / ví dụ', steps: ['Mỗi dòng một ví dụ; ghi cả dữ kiện và kết quả hoặc lời giải tóm tắt.', 'Ưu tiên ví dụ cơ bản → trung bình → vận dụng.', 'Với code, ví dụ nên có input/output hoặc đoạn code chạy được.'] },
            { title: '9. Thêm practice / hoạt động thực hành', steps: ['Mỗi dòng một nhiệm vụ luyện tập cụ thể.', 'Nêu rõ việc người học cần làm và kết quả mong đợi.', 'Với CNTT thêm lab/code; với Kinh tế thêm case/số liệu; với Cơ điện tử thêm sơ đồ, đo kiểm hoặc mô phỏng.'] },
            { title: '10. Tạo câu trắc nghiệm một đáp án', steps: ['Mở Ngân hàng câu hỏi và chọn Trắc nghiệm 1 đáp án.', 'Nhập các phương án theo dạng mã | nội dung.', 'Đáp án đúng là mã phương án, ví dụ A.', 'Thêm giải thích để người học hiểu vì sao chọn đáp án.'] },
            { title: '11. Tạo câu nhiều đáp án, đúng/sai, điền khuyết', steps: ['Chọn đúng loại câu hỏi trước khi nhập.', 'Với nhiều đáp án, nhập mã các phương án đúng, cách nhau bằng dấu phẩy.', 'Với đúng/sai dùng hai lựa chọn Đúng và Sai.', 'Với điền khuyết thêm các đáp án được chấp nhận để chấm linh hoạt.'] },
            { title: '12. Tạo câu ghép đôi / sắp xếp / số', steps: ['Ghép đôi: mỗi dòng là một cặp trái | phải.', 'Sắp xếp: nhập danh sách mục và đáp án theo đúng thứ tự.', 'Câu số: nhập giá trị chuẩn; có thể điền tolerance và đơn vị trong phần thông tin số.', 'Kiểm tra thử cách hiển thị trước khi thêm vào đề.'] },
            { title: '13. Tạo câu tự luận / nói / nghe / hình ảnh', steps: ['Chọn dạng câu rồi thêm media URL hoặc đoạn văn nếu cần.', 'Tự luận, speaking và practical phải có rubric hoặc được chuyển duyệt thủ công.', 'Không đánh dấu đã chấm tự động nếu còn cần giáo viên xem.', 'Chỉ dùng tệp có quyền sử dụng và kiểm tra URL trước khi công bố.'] },
            { title: '14. Tạo coding question', steps: ['Chọn Lập trình chạy test.', 'Nhập ngôn ngữ, đề bài, input/output, ràng buộc và starter code.', 'Mỗi test công khai viết theo dạng input => output; thêm test ẩn cho chấm server.', 'Nhập rubric: tính đúng, trường hợp biên, độ rõ ràng/độ phức tạp.', 'Không đưa đáp án test ẩn vào nội dung học sinh được xem.'] },
            { title: '15. Tạo bài kiểm tra / assessment', steps: ['Mở Bài kiểm tra / kỳ thi.', 'Chọn loại đề, khóa học, thời gian, điểm đạt và số lượt làm.', 'Tích câu hỏi trong ngân hàng; hệ thống không bắt nhập ID.', 'Bật đảo câu nếu phù hợp; chỉ hiện đáp án sau nộp khi chính sách cho phép.'] },
            { title: '16. Tạo đề luyện TOEIC', steps: ['Chia nội dung theo Listening/Reading và từng Part.', 'Dùng audio có thật cho Listening, câu hỏi có bấm giờ và lời giải chi tiết.', 'Theo dõi lỗi theo Part/grammar/vocabulary thay vì chỉ điểm tổng.', 'Ghi rõ đây là đề luyện/simulation nếu không phải đề chính thức có giấy phép.'] },
            { title: '17. Tạo đề luyện IELTS', steps: ['Tổ chức Listening, Reading, Writing Task 1/2, Speaking Part 1/2/3.', 'Writing/Speaking cần rubric, mục tiêu band và góp ý; không gọi là điểm chính thức.', 'Cần thời gian làm và nhận xét theo từng kỹ năng.'] },
            { title: '18. Tạo bài thực hành MOS', steps: ['Nêu file đầu vào, thao tác phải thực hiện và tiêu chí nghiệm thu.', 'Word: bố cục/styles/bảng; Excel: công thức/lọc/biểu đồ; PowerPoint: layout/master/trình chiếu.', 'Nếu chưa có công cụ mở/tự chấm tệp Office, ghi rõ cần giáo viên review thay vì giả lập đã chấm.'] },
            { title: '19. Publish, archive và nguồn', steps: ['Lưu bản nháp và xem Preview trước khi công bố.', 'Công bố chỉ được thực hiện sau khi quality gate qua: câu hỏi, đáp án, rubric, coding test, nội dung bài và đề kiểm tra.', 'Dùng Archive để ẩn nội dung không còn dùng; không xóa vật lý nếu còn lịch sử.', 'AI_GENERATED hoặc ADMIN_CREATED không được tự gắn OFFICIAL. Chỉ gắn sau khi đã xác minh nguồn.'] },
            { title: '20. Quality Dashboard và sửa lỗi', steps: ['Mở AI nội bộ & Course Factory để xem số khóa/bài/câu/test và các mục thiếu.', 'Ưu tiên sửa khóa chưa hoàn chỉnh, lý thuyết quá ngắn, bài thiếu kiểm tra, coding thiếu test hoặc bài chủ quan thiếu rubric.', 'Nếu job lỗi, đọc thông báo lỗi và thử lại có giới hạn; không tạo liên tiếp nhiều job giống nhau.', 'Xem Nhật ký quản trị để biết ai thay đổi nội dung.'] },
            { title: '21. Nhập Word / Markdown', steps: ['Mở Tạo nội dung / Nhập Word.', 'Tải .docx/.md/.txt hoặc dán nội dung.', 'Chọn loại đích rồi xem bản trích xuất và các cảnh báo.', 'Sửa heading, đáp án và nội dung nhận diện sai trước khi lưu bản nháp.'] },
            { title: '22. AI Autopilot và Course Factory', steps: ['Autopilot đọc mục tiêu, profile, kết quả placement, mastery, lỗi và catalog khi dữ liệu có sẵn.', 'Chế độ phân tích chỉ đưa khuyến nghị; bật tạo job sẽ chỉ tạo bản nháp.', 'Course Factory kiểm tra khóa trùng, tạo blueprint rồi kiểm định.', 'Admin phải xem trước và xác nhận thủ công; hệ thống không tự công bố khóa chuẩn.'] }
        ],
        questionTypes: [
            { type: 'single_choice', purpose: 'Một đáp án đúng', fields: 'Câu hỏi, 2–8 lựa chọn, mã đáp án, giải thích', scoring: 'Tự động' },
            { type: 'multiple_choice', purpose: 'Nhiều đáp án đúng', fields: 'Câu hỏi, lựa chọn, tập mã đáp án đúng', scoring: 'Tự động; partial score khi cấu hình' },
            { type: 'true_false', purpose: 'Đúng/Sai', fields: 'Mệnh đề, hai lựa chọn, đáp án', scoring: 'Tự động' },
            { type: 'fill_blank', purpose: 'Điền từ/khuyết', fields: 'Câu hỏi, đáp án và accepted answers', scoring: 'Tự động theo chuẩn hóa' },
            { type: 'numerical', purpose: 'Câu trả lời số', fields: 'Câu hỏi, giá trị, sai số, đơn vị', scoring: 'Tự động theo tolerance nếu scoring engine hỗ trợ' },
            { type: 'matching', purpose: 'Ghép đôi', fields: 'Các cặp trái/phải và mapping đúng', scoring: 'Theo mapping đáp án' },
            { type: 'ordering', purpose: 'Sắp xếp thứ tự', fields: 'Các mục và thứ tự chuẩn', scoring: 'Theo thứ tự đáp án' },
            { type: 'short_answer', purpose: 'Trả lời ngắn', fields: 'Câu hỏi, đáp án mẫu/accepted answers hoặc rubric', scoring: 'Tự động nếu có rule; còn lại review' },
            { type: 'essay', purpose: 'Tự luận', fields: 'Đề bài, rubric, yêu cầu bài nộp', scoring: 'Giáo viên/AI hỗ trợ review; không giả làm điểm chính thức' },
            { type: 'listening', purpose: 'Nghe hiểu', fields: 'Audio URL có thật, câu hỏi, đáp án', scoring: 'Theo dạng câu con' },
            { type: 'speaking', purpose: 'Nói', fields: 'Prompt/audio và tiêu chí fluency/grammar/vocabulary/pronunciation', scoring: 'Cần review/analysis' },
            { type: 'image_based', purpose: 'Câu hỏi có hình', fields: 'Câu hỏi, URL ảnh có thật, đáp án/tiêu chí', scoring: 'Theo dạng câu con' },
            { type: 'coding', purpose: 'Lập trình', fields: 'Đề, ngôn ngữ, starter, visible/hidden tests, giới hạn, rubric', scoring: 'Test runner hoặc review khi cần' },
            { type: 'practical', purpose: 'Thực hành / office / lab / case', fields: 'Tệp/tác vụ, checklist, đầu ra, rubric', scoring: 'Checklist/review; không giả vờ đã mở/chấm tệp ngoài' },
            { type: 'timed_simulation', purpose: 'Mô phỏng thi có thời gian', fields: 'Đề, thời gian, số lượt, chính sách feedback', scoring: 'Theo các câu con; báo rõ là simulation' }
        ]
    };
}
module.exports = { DOMAIN_RULES, DOMAIN_COURSE_SEEDS, identifyDomain, normalize, slug, fingerprint, buildCourseBlueprint, validateCourseBlueprint, findDuplicateCourses, analyzeCatalogGaps, buildLessonRepairPatch, buildQuestionRepairPatch, buildAssessmentRepairPatch, buildAdminGuide };
