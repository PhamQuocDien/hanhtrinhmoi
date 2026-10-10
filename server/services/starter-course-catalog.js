'use strict';

const { EXTRA_COURSES } = require('./catalog-v18-expansion.js');
const { ADDITIONAL_COURSES } = require('./catalog-v18-additional.js');
const { RICH_COURSES } = require('./catalog-v19-rich.js');
const { UNIVERSITY_V20_COURSES } = require('./catalog-v20-university.js');
const { UNIVERSITY_DOMAINS, getUniversityAcademicContext } = require('./university-taxonomy.js');
const { professionalRichLesson, buildMixedQuestions } = require('../modules/rich-learning-content-v20.js');

const SOURCE_REF = {
    sourceType: 'ORIGINAL_PRACTICE',
    documentName: 'Hành Trình Mới Starter Course Catalog',
    version: '20.0.0',
    verification: 'unverified',
    notes: 'Khóa học nền tảng do Hành Trình Mới biên soạn để làm catalog tham chiếu cho AI. Không phải chương trình/đề thi official.'
};

const IT_COURSES = [
    ['CNTT-FND-01','Tin học và hệ thống máy tính',['Phần cứng và phần mềm','Hệ điều hành và tệp','Mạng và Internet cơ bản','An toàn khi sử dụng máy tính'],['computer-literacy','computer-systems'],['CNTT','SE','CS','IS','DS','AI','SEC','NET']],
    ['CNTT-PROG-01','Lập trình căn bản',['Tư duy thuật toán','Biến và kiểu dữ liệu','Điều kiện và vòng lặp','Hàm và tổ chức chương trình'],['programming-basics','algorithmic-thinking'],['CNTT','SE','CS','IS','DS','AI','SEC','NET']],
    ['CNTT-OOP-01','Lập trình hướng đối tượng',['Lớp và đối tượng','Đóng gói','Kế thừa','Đa hình và trừu tượng'],['oop','class-object','inheritance','polymorphism'],['CNTT','SE','CS','IS','AI']],
    ['CNTT-DSA-01','Cấu trúc dữ liệu và giải thuật',['Độ phức tạp','Mảng và danh sách liên kết','Stack, Queue và Tree','Graph và Hash Table'],['dsa','complexity','tree','graph','hash-table'],['CNTT','SE','CS','AI','DS']],
    ['CNTT-DB-01','Cơ sở dữ liệu',['Mô hình dữ liệu','ERD và quan hệ','Chuẩn hóa','Transaction và Integrity'],['database','erd','normalization','transaction'],['CNTT','SE','CS','IS','DS']],
    ['CNTT-SQL-01','SQL thực hành',['SELECT và WHERE','JOIN và GROUP BY','Subquery và CTE','Index và tối ưu truy vấn'],['sql','query','join','index'],['CNTT','SE','CS','IS','DS']],
    ['CNTT-WEB-01','Phát triển Web cơ bản',['HTML semantic','CSS layout','Form và validation','HTTP và kiến trúc Web'],['html','css','http','web-foundation'],['CNTT','SE','CS','IS']],
    ['CNTT-JS-01','JavaScript và Web tương tác',['Biến, hàm và scope','DOM và event','Async và fetch','Module và tổ chức mã'],['javascript','dom','async','fetch'],['CNTT','SE','CS']],
    ['CNTT-BE-01','REST API và Backend',['HTTP request/response','REST resource','Authentication và authorization','Validation và error handling'],['rest-api','backend','authentication','api-testing'],['CNTT','SE','CS','IS']],
    ['CNTT-SE-01','Công nghệ phần mềm',['Yêu cầu phần mềm','UML và thiết kế','Quản lý phiên bản','Quy trình phát triển'],['software-engineering','requirements','uml','version-control'],['CNTT','SE','CS','IS']],
    ['CNTT-GIT-01','Git và GitHub thực hành',['Repository và commit','Branch và merge','Pull request','Workflow nhóm'],['git','github','collaboration'],['CNTT','SE','CS','IS','DS','AI']],
    ['CNTT-TEST-01','Kiểm thử phần mềm',['Test case và test plan','Unit test','Integration test','Regression và defect lifecycle'],['software-testing','unit-testing','integration-testing'],['CNTT','SE','CS','IS']],
    ['CNTT-NET-01','Mạng máy tính căn bản',['OSI và TCP/IP','IPv4 và subnet','TCP/UDP','DNS, HTTP và routing'],['computer-network','tcp-ip','dns','routing'],['CNTT','SE','CS','NET','SEC']],
    ['CNTT-OS-01','Hệ điều hành căn bản',['Process và thread','Memory management','File system','Scheduling và synchronization'],['operating-system','process','memory','filesystem'],['CNTT','SE','CS']],
    ['CNTT-SEC-01','An toàn thông tin cơ bản',['Mối đe dọa phổ biến','Mật khẩu và xác thực','Phishing và social engineering','Bảo vệ dữ liệu'],['cybersecurity','authentication','phishing','data-protection'],['CNTT','SE','CS','SEC','NET']],
    ['CNTT-UIUX-01','UI/UX nền tảng',['User research','Information architecture','Visual hierarchy','Prototype và usability testing'],['uiux','ux-research','wireframe','prototype'],['CNTT','SE','IS']],
    ['CNTT-DATA-01','Phân tích dữ liệu cơ bản',['Data cleaning','Descriptive statistics','Visualization','Insight và storytelling'],['data-analysis','statistics','visualization'],['CNTT','CS','IS','DS','AI']],
    ['CNTT-PY-01','Python cho phân tích dữ liệu',['Python syntax','List, dict và function','NumPy/Pandas concept','Data exploration'],['python','pandas','numpy','data-analysis'],['CNTT','CS','DS','AI','IS']],
    ['CNTT-STAT-01','Xác suất thống kê cho CNTT',['Random variable','Probability','Mean và variance','Inference cơ bản'],['probability','statistics','variance'],['CS','DS','AI','CNTT']],
    ['CNTT-AI-01','Trí tuệ nhân tạo nhập môn',['AI và machine learning','Dữ liệu và features','Training và evaluation','Ứng dụng AI có trách nhiệm'],['artificial-intelligence','machine-learning','evaluation'],['CNTT','CS','DS','AI']],
    ['CNTT-ML-01','Machine Learning nền tảng',['Supervised learning','Classification và regression','Overfitting','Model evaluation'],['machine-learning','classification','regression','overfitting'],['CS','DS','AI','CNTT']],
    ['CNTT-DEVOPS-01','Docker và CI/CD',['Container concept','Dockerfile','Image và registry','CI/CD pipeline'],['docker','devops','cicd','deployment'],['CNTT','SE','CS','IS']],
    ['CNTT-CLOUD-01','Cloud Computing fundamentals',['IaaS/PaaS/SaaS','Virtualization','Storage và database','Scalability và security'],['cloud','iaas','paas','saas'],['CNTT','SE','CS','IS','DS','AI']]
];

const TOEIC_COURSES = [
    ['TOEIC-FOUNDATION-450','TOEIC Foundation 450',['Core vocabulary','Basic grammar','Listening fundamentals','Reading fundamentals'],['TOEIC-FOUNDATION','A2-B1']],
    ['TOEIC-VOCAB-600','TOEIC Vocabulary 600',['Workplace vocabulary','Collocations','Context clues','Spaced review'],['TOEIC-VOCABULARY','600']],
    ['TOEIC-GRAMMAR-P5-P6','TOEIC Grammar Part 5–6',['Sentence completion','Tenses and agreement','Word forms','Text completion'],['TOEIC-GRAMMAR','P5-P6']],
    ['TOEIC-LISTENING-P1-P2','TOEIC Listening Part 1–2',['Photographs','Question-response patterns','Keyword listening','Distractor recognition'],['TOEIC-LISTENING','P1-P2']],
    ['TOEIC-LISTENING-P3-P4','TOEIC Listening Part 3–4',['Conversations','Talks','Prediction','Note-taking'],['TOEIC-LISTENING','P3-P4']],
    ['TOEIC-READING-P7','TOEIC Reading Part 7',['Single passages','Double passages','Triple passages','Inference and speed'],['TOEIC-READING','P7']],
    ['TOEIC-SPEED-650','TOEIC Speed & Strategy 650',['Time allocation','Fast scanning','Question prioritization','Error review'],['TOEIC-STRATEGY','650']],
    ['TOEIC-ADVANCED-750','TOEIC Advanced 750',['Advanced vocabulary','Complex grammar','Inference','High-difficulty listening'],['TOEIC-ADVANCED','750']],
    ['TOEIC-4SKILLS-PRACTICE','TOEIC 4 Skills Personalized Practice',['Listening','Reading','Speaking support','Writing support'],['TOEIC-4SKILLS','PERSONALIZED']],
    ['TOEIC-MOCK-FULL','TOEIC Full Mock & Analysis',['Full simulation','Score estimation','Skill diagnosis','Remediation plan'],['TOEIC-MOCK','SIMULATION']]
];

const IELTS_COURSES = [
    ['IELTS-FOUNDATION-5','IELTS Foundation Band 5.0',['Core grammar','General vocabulary','Four-skill basics','Task awareness'],['IELTS-FOUNDATION','5.0']],
    ['IELTS-VOCAB-ACADEMIC','IELTS Academic Vocabulary',['Academic word families','Collocations','Paraphrasing','Context use'],['IELTS-VOCABULARY','ACADEMIC']],
    ['IELTS-LISTENING','IELTS Listening Mastery',['Form completion','Multiple choice','Matching','Distractor handling'],['IELTS-LISTENING','ACADEMIC']],
    ['IELTS-READING','IELTS Reading Mastery',['Skimming and scanning','Matching headings','True/False/Not Given','Inference'],['IELTS-READING','ACADEMIC']],
    ['IELTS-WRITING-TASK1-ACADEMIC','IELTS Academic Writing Task 1',['Chart types','Overview','Comparisons','Language for trends'],['IELTS-WRITING','ACADEMIC-TASK1']],
    ['IELTS-WRITING-TASK2','IELTS Writing Task 2',['Essay structure','Thesis statement','Coherence and cohesion','Argument development'],['IELTS-WRITING','TASK2']],
    ['IELTS-SPEAKING','IELTS Speaking Parts 1–3',['Part 1 fluency','Part 2 long turn','Part 3 discussion','Pronunciation and vocabulary'],['IELTS-SPEAKING','PARTS-1-3']],
    ['IELTS-BAND65-ACADEMIC','IELTS Academic 6.5 Strategy',['Band descriptors','Time management','High-frequency errors','Targeted practice'],['IELTS-STRATEGY','6.5']],
    ['IELTS-GENERAL-TRAINING','IELTS General Training 4 Skills',['GT Reading','GT Writing Task 1','Listening','Speaking'],['IELTS-GENERAL','GENERAL_TRAINING']],
    ['IELTS-MOCK-4SKILLS','IELTS Full Mock & Analysis',['Full simulation','Band estimation','Skill diagnosis','Remediation plan'],['IELTS-MOCK','SIMULATION']]
];

const MOS_COURSES = [
    ['MOS-WORD-BASIC','MOS Word Cơ bản',['Interface and document setup','Formatting text and paragraphs','Tables and page layout','Basic styles'],['MOS','WORD','FOUNDATION']],
    ['MOS-WORD-ADVANCED','MOS Word Nâng cao',['Styles and themes','References','Advanced tables','Long-document workflow'],['MOS','WORD','ADVANCED']],
    ['MOS-EXCEL-BASIC','MOS Excel Cơ bản',['Workbook and worksheet','Formatting data','Basic formulas','Sort and filter'],['MOS','EXCEL','FOUNDATION']],
    ['MOS-EXCEL-FORMULAS','MOS Excel Công thức',['Relative and absolute reference','Common functions','Logical functions','Lookup concepts'],['MOS','EXCEL','FORMULAS']],
    ['MOS-EXCEL-DATA','MOS Excel Phân tích dữ liệu',['Tables','Charts','Conditional formatting','PivotTable fundamentals'],['MOS','EXCEL','DATA']],
    ['MOS-EXCEL-ADVANCED','MOS Excel Nâng cao',['Advanced formulas','Data analysis','What-if analysis','Dashboard basics'],['MOS','EXCEL','ADVANCED']],
    ['MOS-POWERPOINT-BASIC','MOS PowerPoint Cơ bản',['Slide creation','Text and images','Layouts and themes','Presentation delivery'],['MOS','POWERPOINT','FOUNDATION']],
    ['MOS-POWERPOINT-ADVANCED','MOS PowerPoint Nâng cao',['Master slides','Charts and SmartArt','Animation and transitions','Presentation polish'],['MOS','POWERPOINT','ADVANCED']],
    ['MOS-COMBINED-MOCK','MOS Word Excel PowerPoint Mock',['Word practice','Excel practice','PowerPoint practice','Timed simulation'],['MOS','COMBINED','SIMULATION']]
];

const IT_KNOWLEDGE = {
    'CNTT-FND-01': ['Hệ điều hành quản lý tài nguyên và cung cấp môi trường cho ứng dụng chạy.','Phishing là hình thức lừa người dùng cung cấp thông tin nhạy cảm.'],
    'CNTT-PROG-01': ['Biến dùng để lưu trữ một giá trị trong chương trình.','Vòng lặp dùng để thực hiện một khối lệnh nhiều lần theo điều kiện.'],
    'CNTT-OOP-01': ['Class là khuôn mẫu để tạo object.','Đa hình cho phép cùng một interface có nhiều cách triển khai.'],
    'CNTT-DSA-01': ['Big O mô tả tốc độ tăng chi phí của thuật toán khi kích thước đầu vào tăng.','Hash table thường hướng tới tra cứu trung bình gần O(1).'],
    'CNTT-DB-01': ['Primary key dùng để định danh duy nhất bản ghi.','Normalization giúp giảm dư thừa và bất nhất dữ liệu.'],
    'CNTT-SQL-01': ['SELECT dùng để truy vấn dữ liệu.','GROUP BY gom các dòng theo nhóm để tổng hợp.'],
    'CNTT-WEB-01': ['HTML mô tả cấu trúc nội dung trang.','HTTP là giao thức trao đổi request/response trên Web.'],
    'CNTT-JS-01': ['DOM đại diện cấu trúc tài liệu HTML để JavaScript thao tác.','fetch() dùng để thực hiện HTTP request từ JavaScript.'],
    'CNTT-BE-01': ['REST tổ chức tài nguyên qua endpoint và phương thức HTTP.','HTTP 404 thường biểu thị tài nguyên không được tìm thấy.'],
    'CNTT-SE-01': ['Requirement mô tả nhu cầu hoặc hành vi hệ thống cần đáp ứng.','Git giúp quản lý phiên bản mã nguồn.'],
    'CNTT-GIT-01': ['Commit ghi lại một trạng thái thay đổi của repository.','Pull request thường dùng để review trước khi merge.'],
    'CNTT-TEST-01': ['Unit test kiểm tra một đơn vị nhỏ của phần mềm.','Regression test giúp phát hiện lỗi cũ quay lại sau thay đổi.'],
    'CNTT-NET-01': ['TCP cung cấp truyền dữ liệu tin cậy theo kết nối.','DNS ánh xạ tên miền sang địa chỉ IP.'],
    'CNTT-OS-01': ['Process là một chương trình đang thực thi.','Thread là đơn vị thực thi nhỏ hơn trong process.'],
    'CNTT-SEC-01': ['Mật khẩu mạnh nên kết hợp nhiều loại ký tự và không tái sử dụng.','MFA bổ sung yếu tố xác thực ngoài mật khẩu.'],
    'CNTT-UIUX-01': ['UX tập trung vào trải nghiệm và nhu cầu người dùng.','Prototype dùng để mô phỏng sản phẩm trước khi phát triển hoàn chỉnh.'],
    'CNTT-DATA-01': ['Visualization giúp truyền đạt pattern trong dữ liệu.','Mean là giá trị trung bình cộng.'],
    'CNTT-PY-01': ['List trong Python là cấu trúc dữ liệu có thứ tự và có thể thay đổi.','Pandas thường dùng để thao tác dữ liệu dạng bảng.'],
    'CNTT-STAT-01': ['Probability đo mức độ khả năng xảy ra của một biến cố.','Variance mô tả độ phân tán quanh giá trị trung bình.'],
    'CNTT-AI-01': ['Machine learning học pattern từ dữ liệu thay vì lập trình cứng mọi quy tắc.','Evaluation đo chất lượng mô hình trên dữ liệu phù hợp.'],
    'CNTT-ML-01': ['Classification dự đoán nhãn rời rạc.','Overfitting xảy ra khi mô hình học quá sát dữ liệu huấn luyện và kém tổng quát.'],
    'CNTT-DEVOPS-01': ['Container đóng gói ứng dụng cùng môi trường cần thiết.','CI/CD tự động hóa kiểm thử và triển khai theo pipeline.'],
    'CNTT-CLOUD-01': ['IaaS cung cấp hạ tầng dạng dịch vụ.','Scalability là khả năng hệ thống tăng/giảm tài nguyên theo tải.']
};

const GENERIC_QUESTIONS = (course, facts) => {
    const skill = course.skills[0] || 'nội dung chính';
    const objective = course.objectives[0] || `Nắm vững ${skill}.`;
    const factA = facts?.[0] || `Hiểu nền tảng ${skill}.`;
    const factB = facts?.[1] || `Áp dụng ${skill} vào bài tập thực tế.`;
    return [
        { prompt: `Kiến thức nào là trọng tâm nền tảng của khóa ${course.name}?`, options: [factA, 'Chỉ học thuộc định nghĩa và không thực hành.', 'Bỏ qua khái niệm để làm đề khó ngay.', 'Không cần kiểm tra kết quả học tập.'], answer: factA, explanation: `Đây là nội dung nền tảng được gắn với skill ${skill}.`, difficulty: 'EASY', skill },
        { prompt: `Mục tiêu phù hợp nhất sau khi học khóa ${course.name} là gì?`, options: [objective, 'Chỉ xem video mà không làm bài.', 'Chỉ ghi nhớ tên công cụ.', 'Không cần áp dụng vào tình huống.'], answer: objective, explanation: `Mục tiêu này phù hợp với đầu ra của khóa học.`, difficulty: 'MEDIUM', skill },
        { prompt: `Cách học nào giúp củng cố tốt nhất nội dung ${skill}?`, options: [factB, 'Bỏ qua lỗi sai sau khi nộp bài.', 'Chỉ làm một câu duy nhất.', 'Không xem lại bài sau khi học.'], answer: factB, explanation: `Luyện tập có mục tiêu và phản hồi giúp AI có thêm dữ liệu để cá nhân hóa.`, difficulty: 'MEDIUM', skill }
    ];
};

function itCourse(code, name, lessonTitles, skills, majorTracks) {
    return { code, name, educationLevel: 'HIGHER_EDUCATION', subjectId: 'CNTT', category: 'MAJOR_FOUNDATION', description: `Khóa học nền tảng ${name} cho sinh viên CNTT và các ngành gần.`, skills, majorTracks, track: 'UNIVERSITY_IT', audience: 'Sinh viên CNTT và các ngành công nghệ liên quan', lessonTitles, targetExam: '', targetVariant: '', aliases: [name, code, 'Công nghệ thông tin', 'CNTT'], objectives: lessonTitles.map(title => `Hiểu và áp dụng ${title.toLowerCase()}.`), credits: 3, estimatedMinutes: 900, facts: IT_KNOWLEDGE[code] || [] };
}
function englishCourse(tuple, exam) {
    const [code,name,lessonTitles,meta] = tuple;
    const variant = meta[meta.length - 1];
    return { code, name, educationLevel: 'ENGLISH_CERTIFICATION', subjectId: exam, category: 'FOUNDATION', description: `${name} thuộc catalog nền tảng English để AI cá nhân hóa theo mục tiêu ${exam}.`, skills: meta.slice(0,-1), majorTracks: [], track: 'ENGLISH', audience: 'Người học tiếng Anh theo mục tiêu chứng chỉ', lessonTitles, targetExam: exam, targetVariant: variant, aliases: [name, code, exam, variant], objectives: lessonTitles.map(title => `Luyện và áp dụng ${title.toLowerCase()}.`), estimatedMinutes: 720 };
}
function mosCourse(tuple) {
    const [code,name,lessonTitles,meta] = tuple;
    return { code, name, educationLevel: 'HIGHER_EDUCATION', subjectId: 'MOS', category: 'FOUNDATION', description: `${name} là khóa học thực hành nền tảng MOS để AI có thể ghép và mở rộng theo Word, Excel, PowerPoint.`, skills: meta, majorTracks: [], track: 'MOS', audience: 'Học sinh, sinh viên và người đi làm', lessonTitles, targetExam: 'MOS', targetVariant: meta[1] || '', aliases: [name, code, 'MOS', ...meta], objectives: lessonTitles.map(title => `Thực hiện được ${title.toLowerCase()} trong môi trường Office.`), estimatedMinutes: 600 };
}

const BASE_STARTER_COURSES = [
    ...IT_COURSES.map(item => itCourse(...item)),
    ...TOEIC_COURSES.map(item => englishCourse(item, 'TOEIC')),
    ...IELTS_COURSES.map(item => englishCourse(item, 'IELTS')),
    ...MOS_COURSES.map(item => mosCourse(item)),
    ...EXTRA_COURSES,
    ...ADDITIONAL_COURSES
];
function lessonTemplate(course, index) {
    const text = `${course.name || ''} ${course.subjectId || ''} ${course.targetVariant || ''} ${course.track || ''}`.toLowerCase();
    const base = Array.isArray(course.lessonTitles) ? course.lessonTitles.map(item => String(item).trim()).filter(Boolean) : [];
    const domain = course.track === 'UNIVERSITY_IT' ? (
        /java/.test(text) ? ['Môi trường Java và cấu trúc chương trình','Kiểu dữ liệu, biến và toán tử','Điều kiện, vòng lặp và xử lý luồng','Phương thức, tham số và phạm vi','OOP: class, object và encapsulation','Inheritance, polymorphism và interface','Collections và generics','Exception, logging và debugging','Stream/Lambda và xử lý dữ liệu','Unit test và clean code','Build, package và triển khai','Mini project và tổng kết'] :
        /python/.test(text) ? ['Môi trường Python và module','Kiểu dữ liệu và thao tác dữ liệu','Điều kiện, vòng lặp và comprehension','Function, scope và lambda','List, dict, set và tuple','Exception và file handling','Package, virtual environment và dependency','OOP trong Python','Testing và debugging','Pandas/NumPy hoặc thư viện chuyên ngành','Ứng dụng thực tế và tối ưu','Mini project và tổng kết'] :
        /javascript|typescript|react|node|nestjs|web/.test(text) ? ['Cấu trúc chương trình và môi trường chạy','Biến, kiểu dữ liệu và biểu thức','Function, scope và module','DOM, event hoặc component','Bất đồng bộ, Promise và fetch','HTTP, REST và JSON','State, form và validation','Debugging và xử lý lỗi','Testing và tổ chức mã','Security cơ bản','Build, deploy và tối ưu','Project Web và tổng kết'] :
        /c\+\+|\bcpp\b|lập trình c\b|clean code c/.test(text) ? ['Compiler, IDE và cấu trúc chương trình','Biến, kiểu dữ liệu và toán tử','Điều kiện và vòng lặp','Function, reference và pointer','Array, string và memory','Class, object và encapsulation','STL: vector, map, set','Algorithm và iterator','Exception, debugging và sanitizer','Testing và Clean Code','CMake/build và tổ chức project','Mini project C/C++ và tổng kết'] :
        /sql|database|mongodb|redis/.test(text) ? ['Mô hình dữ liệu và thiết kế schema','DDL: CREATE, ALTER và constraints','DML: INSERT, UPDATE và DELETE','SELECT, WHERE, ORDER BY và GROUP BY','JOIN và truy vấn nhiều bảng','Subquery, CTE và window function','Index và tối ưu truy vấn','Transaction và concurrency','Backup, security và permissions','NoSQL hoặc dữ liệu bán cấu trúc','Data project thực tế','Ôn tập và tổng kết'] :
        /git|github/.test(text) ? ['Repository, clone và commit','Branch và merge','Conflict và cách xử lý','Remote, push và pull','Pull request và code review','Tag, release và versioning','Rebase, cherry-pick và reflog','Git workflow cho nhóm','CI cơ bản với GitHub','Bảo vệ branch và secrets','Xử lý sự cố repository','Mini workflow project và tổng kết'] :
        /docker|devops|kubernetes|cloud|aws/.test(text) ? ['Linux và command line nền tảng','Process, file và permission','Container và image','Dockerfile và build image','Network, volume và environment','Compose và multi-container','CI/CD pipeline','Registry và release','Monitoring và logging','Security và secrets','Deploy cloud','Project triển khai và tổng kết'] :
        /algorithm|data structure|dsa|competitive/.test(text) ? ['Độ phức tạp thời gian và bộ nhớ','Array và linked list','Stack và queue','Tree và traversal','Heap và priority queue','Hash table','Graph và traversal','Sorting và searching','Greedy và divide-and-conquer','Dynamic programming/backtracking','Tối ưu và phân tích lời giải','Bài toán tổng hợp và tổng kết'] :
        Array.isArray(course.lessonTitles) && course.lessonTitles.length ? course.lessonTitles :
        ['Khái niệm nền tảng và thuật ngữ','Cấu trúc và thành phần chính','Quy trình thực hiện','Ví dụ có hướng dẫn','Thực hành theo bước','Bài tập vận dụng','Kiểm thử và sửa lỗi','Case study thực tế','Tối ưu và mở rộng','Kỹ năng công cụ','Mini project','Ôn tập và tổng kết']
    ) : ['UNIVERSITY_ECONOMICS','UNIVERSITY_MECHATRONICS','UNIVERSITY_ENGINEERING'].includes(course.track) && base.length ? base : course.targetExam === 'TOEIC' ? (
        /p1/.test(text) ? ['Nhận diện người, vật và hành động','Vị trí và giới từ trong ảnh','Thì và trạng thái trong mô tả','Từ vựng đồ vật và môi trường','Distractor và cách loại đáp án','Nghe keyword và paraphrase','Tốc độ phản xạ Part 1','Luyện phát âm từ khóa','Timed practice','Bài tập theo ảnh mới','Mini Part 1 Test','Ôn lỗi và tổng kết'] :
        /p2/.test(text) ? ['Who/What/Where/When/Why/How','Yes-No questions','Indirect answers','Negative and unexpected responses','Keyword traps','Paraphrase trong câu trả lời','Intonation và question type','Distractor recognition','Timed practice','Mixed question drill','Mini Part 2 Test','Ôn lỗi và tổng kết'] :
        /p3/.test(text) ? ['Dự đoán bối cảnh hội thoại','Xác định mục đích người nói','Chi tiết số liệu và thời gian','Inference và hàm ý','Note-taking hiệu quả','Paraphrase và synonym','Speaker attitude','Distractor recognition','Timed conversation practice','Mixed conversation drill','Mini Part 3 Test','Ôn lỗi và tổng kết'] :
        /p4/.test(text) ? ['Announcement và thông báo','Advertisement và giới thiệu','Meeting và workplace talk','Prediction trước khi nghe','Chi tiết và con số','Inference từ ngữ cảnh','Paraphrase trong đáp án','Note-taking tốc độ cao','Timed talk practice','Mixed talk drill','Mini Part 4 Test','Ôn lỗi và tổng kết'] :
        /p5/.test(text) ? ['Parts of speech','Tenses và subject-verb agreement','Word form','Prepositions và conjunctions','Vocabulary in context','Collocations','Sentence structure','Distractor grammar','Timed Part 5 practice','Mixed grammar drill','Mini Part 5 Test','Ôn lỗi và tổng kết'] :
        /p6/.test(text) ? ['Đọc toàn đoạn trước khi chọn','Grammar trong ngữ cảnh','Vocabulary và collocation','Sentence insertion','Cohesion và reference','Context clue','Paraphrase','Distractor recognition','Timed passage practice','Mixed Part 6 drill','Mini Part 6 Test','Ôn lỗi và tổng kết'] :
        /p7/.test(text) ? ['Single passage structure','Scanning thông tin','Vocabulary in context','Inference','Double passages','Triple passages','Cross-text evidence','Paraphrase','Question prioritization','Timed reading','Mini Part 7 Test','Ôn lỗi và tổng kết'] :
        /vocab/.test(text) ? ['Từ vựng nơi làm việc','Travel và transportation','Finance và accounting','Sales và marketing','Human resources','Meetings và schedules','Technology vocabulary','Collocations','Word family','Context clues','Spaced review test','Ôn lỗi và tổng kết'] :
        /grammar/.test(text) ? ['Danh từ, đại từ và mạo từ','Tính từ và trạng từ','Verb forms và tenses','Subject-verb agreement','Prepositions','Conjunctions và clauses','Gerund/infinitive','Relative clauses','Conditional sentences','Error correction','Grammar mock','Ôn lỗi và tổng kết'] :
        /speaking/.test(text) ? ['Read aloud và pronunciation','Describe a picture','Respond to questions','Give information','Suggest solutions','Express opinion','Intonation và sentence stress','Fluency và pausing','Timed speaking','Self-correction','Speaking mock','Ôn lỗi và tổng kết'] :
        /writing/.test(text) ? ['Sentence structure','Email response cơ bản','Request and information','Suggestions','Apology and explanation','Opinion writing','Paraphrase','Vocabulary and grammar accuracy','Timed writing','Error correction','Writing mock','Ôn lỗi và tổng kết'] :
        ['TOEIC overview và mục tiêu điểm','Core vocabulary','Core grammar','Listening foundation','Reading foundation','Part 1–2 strategies','Part 3–4 strategies','Part 5–6 strategies','Part 7 strategies','Time management','Mini mock test','Ôn lỗi và tổng kết']
    ) : course.targetExam === 'IELTS' ? (
        /listening/.test(text) ? ['Prediction trước khi nghe','Form completion','Multiple choice','Maps và labeling','Matching information','Academic conversation','Lecture note completion','Distractor handling','Spelling và number accuracy','Timed section practice','Listening mini mock','Band improvement review'] :
        /reading/.test(text) ? ['Skimming và scanning','Matching headings','True/False/Not Given','Multiple choice','Sentence completion','Matching information','Reference words','Inference','Paraphrase recognition','Timed passage','Reading mini mock','Band improvement review'] :
        /writing/.test(text) && /task.?1|chart|data/.test(text) ? ['Phân tích line chart','Bar chart','Table','Pie chart','Process và diagram','Overview sentence','Comparisons','Trend vocabulary','Complex sentences','Error correction','Timed Task 1','Band improvement review'] :
        /writing/.test(text) ? ['Essay structure','Thesis statement','Opinion essay','Discussion essay','Advantages and disadvantages','Problem and solution','Examples và support','Coherence and cohesion','Lexical resource','Grammar range and accuracy','Timed Task 2','Band improvement review'] :
        /speaking/.test(text) && /p1/.test(text) ? ['Personal questions','Extended answers','Natural fillers','Pronunciation','Sentence stress','Intonation','Vocabulary expansion','Grammar accuracy','Timed Part 1','Self-correction','Speaking Part 1 mock','Band improvement review'] :
        /speaking/.test(text) && /p2/.test(text) ? ['Cue card analysis','Preparation notes','Story structure','Fluency','Lexical resource','Grammar range','Pronunciation','Intonation','Timed long turn','Self-correction','Speaking Part 2 mock','Band improvement review'] :
        /speaking/.test(text) ? ['Opinion questions','Compare and contrast','Abstract ideas','Examples and reasons','Discourse markers','Vocabulary precision','Grammar complexity','Pronunciation','Interaction and fluency','Timed Part 3','Speaking mock','Band improvement review'] :
        ['IELTS overview và band descriptors','Core grammar','Academic vocabulary','Listening foundation','Reading foundation','Writing foundation','Speaking foundation','Paraphrasing','Coherence and cohesion','Pronunciation and fluency','Four-skill mini mock','Band improvement review']
    ) : course.track === 'MOS' ? (
        /excel/.test(text) ? ['Workbook và worksheet','Nhập dữ liệu và định dạng','Cell references','SUM, AVERAGE, COUNT','IF và logic','Lookup và error handling','Sort, filter và table','Charts và visualization','Conditional formatting','PivotTable và data analysis','Timed Excel simulation','Ôn lỗi và tổng kết'] :
        /powerpoint|ppt/.test(text) ? ['Tạo presentation và layout','Text, image và shapes','Themes và typography','Slide Master','Charts và SmartArt','Tables và media','Animation','Transitions','Presenter tools','Design consistency','Timed PowerPoint simulation','Ôn lỗi và tổng kết'] :
        /word/.test(text) ? ['Tạo và lưu tài liệu','Formatting text and paragraphs','Styles và themes','Tables','Page layout và sections','Headers và footers','References và table of contents','Review và Track Changes','Images và shapes','Long-document workflow','Timed Word simulation','Ôn lỗi và tổng kết'] :
        ['Word workflow','Excel workflow','PowerPoint workflow','Formatting consistency','Tables and data','Charts and presentation','Linking content across Office','Shortcuts','Common productivity tasks','Error correction','Timed Office simulation','Ôn lỗi và tổng kết']
    ) : base;
    if (domain.length >= 12) return domain.slice(0,12);
    return [...domain, ...base, 'Thực hành tổng hợp', 'Mini project', 'Ôn tập và tổng kết'].filter((v,i,a)=>v && a.indexOf(v)===i).slice(0,12);
}
function expandLessonTitles(course) {
    return lessonTemplate(course, 0);
}
function enrichStarterDefinition(course) {
    let lessonTitles = expandLessonTitles(course);
    if (lessonTitles.length < 12) lessonTitles = [...lessonTitles, ...(course.lessonTitles || []), 'Thực hành theo tình huống', 'Bài tập tích hợp', 'Ôn tập và tổng kết'].filter((item, index, list) => item && list.indexOf(item) === index).slice(0, 12);
    while (lessonTitles.length < 12) lessonTitles.push(`Chuyên đề ${lessonTitles.length + 1}: Thực hành và vận dụng`);
    const academic = getUniversityAcademicContext({ track: course.track, subjectId: course.subjectId, majorTracks: course.majorTracks || [] });
    const syllabus = { ...(course.syllabus || {}), lessonCount: lessonTitles.length, assessmentStructure: { lessonTests: lessonTitles.length, chapterTests: Math.ceil(lessonTitles.length / 2), midterm: true, final: true, mock: true } };
    if (academic) syllabus.academic = academic;
    const pathDesign = course.targetExam === 'TOEIC' ? { model: 'EXAM_PREP', stages: ['Nền tảng', 'Luyện từng Part', 'Luyện có giới hạn thời gian', 'Mock test', 'Phân tích lỗi'], skills: /4SKILLS/i.test(`${course.track} ${course.name}`) ? ['Listening', 'Reading', 'Speaking', 'Writing'] : ['Listening', 'Reading'] } : course.targetExam === 'IELTS' ? { model: 'EXAM_PREP', stages: ['Nền tảng', 'Luyện từng kỹ năng', 'Luyện dạng câu hỏi', 'Timed practice', 'Mock test', 'Phân tích lỗi'], skills: ['Listening', 'Reading', 'Writing', 'Speaking'] } : course.track === 'MOS' ? { model: 'PRACTICAL_SKILL', stages: ['Hướng dẫn thao tác', 'Thực hành có hướng dẫn', 'Nhiệm vụ độc lập', 'Timed simulation', 'Review theo checklist'], skills: [' thao tác', 'độ chính xác', 'quy trình', 'kiểm tra đầu ra'] } : academic ? { model: 'UNIVERSITY_SKILL', stages: ['Khái niệm cốt lõi', 'Ví dụ có hướng dẫn', 'Bài tập ứng dụng', 'Lab/Case', 'Project', 'Review'], skills: course.skills || [] } : { model: 'SKILL_BASED', stages: ['Kiến thức nền', 'Ví dụ', 'Luyện tập', 'Bài kiểm tra', 'Vận dụng'], skills: course.skills || [] };
    return { ...course, ...(academic || {}), ...(academic ? { educationLevel: 'HIGHER_EDUCATION', educationLevelName: 'Đại học' } : {}), lessonTitles, pathDesign, syllabus: { ...syllabus, pathDesign } };
}
const STARTER_COURSES = [...RICH_COURSES, ...BASE_STARTER_COURSES, ...UNIVERSITY_V20_COURSES].map(enrichStarterDefinition).filter((course, index, list) => list.findIndex(item => item.code === course.code) === index);

function buildStarterQuestion(course, topic, index, difficulty = 'MEDIUM') {
    const skill = course.skills[index % Math.max(1, course.skills.length)] || topic;
    const text = `${course.name || ''} ${topic || ''} ${course.targetVariant || ''}`.toLowerCase();
    const templates = course.track === 'MOS' ? [
        `Trong ${topic}, thao tác nào giúp hoàn thành công việc đúng và dễ kiểm tra lại nhất?`,
        `Khi thực hiện ${topic.toLowerCase()} trong Microsoft Office, lựa chọn nào phù hợp nhất?`,
        `Tình huống nào thường dùng ${topic.toLowerCase()} để tăng độ chính xác hoặc năng suất?`
    ] : course.targetExam === 'TOEIC' ? [
        `Trong ${topic}, chiến lược nào giúp thí sinh vừa hiểu nội dung vừa kiểm soát thời gian?`,
        `Khi làm ${topic}, đâu là cách nhận diện distractor hoặc paraphrase hiệu quả?`,
        `Khi gặp ${topic.toLowerCase()}, kỹ năng nào cần ưu tiên để cải thiện độ chính xác?`
    ] : course.targetExam === 'IELTS' ? [
        `Trong ${topic}, lựa chọn nào phù hợp nhất với tiêu chí đánh giá IELTS?`,
        `Khi luyện ${topic.toLowerCase()}, đâu là cách giúp tăng độ chính xác và band score?`,
        `Chiến lược nào nên dùng khi thực hiện ${topic.toLowerCase()} trong thời gian giới hạn?`
    ] : [
        `Trong ${topic}, bước nào phù hợp nhất để xây dựng lời giải đúng và dễ kiểm thử?`,
        `Khi thực hiện ${topic.toLowerCase()}, lựa chọn nào giúp hạn chế lỗi và tăng khả năng bảo trì?`,
        `Tình huống nào nên áp dụng ${topic.toLowerCase()} để giải quyết một bài toán thực tế?`
    ];
    const facts = Array.isArray(course.facts) && course.facts.length ? course.facts : [`${topic} là một phần kiến thức cần nắm vững trước khi thực hành.`, `Việc thực hành ${topic.toLowerCase()} giúp chuyển kiến thức thành kỹ năng.`];
    const correct = index % 2 === 0 ? facts[index % facts.length] : `Áp dụng ${topic.toLowerCase()} theo đúng quy trình, kiểm tra kết quả và sửa lỗi dựa trên phản hồi.`;
    const distractors = [
        `Bỏ qua mục tiêu của bài và chỉ ghi nhớ thao tác.`,
        `Chọn cách làm ngẫu nhiên mà không kiểm tra kết quả.`,
        `Tăng độ khó ngay cả khi kiến thức nền chưa ổn định.`
    ];
    return { prompt: templates[index % templates.length], options: [correct, ...distractors], answer: correct, explanation: `${correct} Đây là nguyên tắc phù hợp để phát triển kỹ năng ${skill} trong ${course.name}.`, difficulty, skill, points: 1, type: 'single_choice' };
}
function buildLesson(course, topic, index) {
    const text = `${course.name || ''} ${topic || ''} ${course.targetVariant || ''}`.toLowerCase();
    const objective = `Hiểu và áp dụng ${topic.toLowerCase()} trong ngữ cảnh ${course.name}.`;
    const skills = course.skills.slice(0, 4);
    const difficulty = index < 1 ? 'EASY' : index < 3 ? 'MEDIUM' : 'HARD';
    const facts = Array.isArray(course.facts) && course.facts.length ? course.facts : [`${topic} là một kỹ năng nền tảng cần được hiểu trước khi thực hành.`, `Thực hành có phản hồi giúp biến ${topic.toLowerCase()} thành kỹ năng ổn định.`];
    const isToeic = course.targetExam === 'TOEIC';
    const isIelts = course.targetExam === 'IELTS';
    const isMos = course.track === 'MOS';
    const programming = ['UNIVERSITY_IT','UNIVERSITY_MECHATRONICS','UNIVERSITY_ENGINEERING'].includes(course.track) && /lập trình|program|java|c\+\+|c\/c\+\+|python|javascript|typescript|react|node|sql|database|algorithm|api|clean code|coding|docker|kubernetes|spring|graphql|linux|devops|flutter|android|embedded|plc|robot|iot/i.test(`${course.name} ${topic}`);
    const language = /python/i.test(`${course.name} ${topic}`) ? 'python' : /java(?!script)/i.test(`${course.name} ${topic}`) ? 'java' : /javascript|typescript|react|node|next|vue|nestjs/i.test(`${course.name} ${topic}`) ? 'javascript' : 'cpp';
    let sections;
    let examples;
    let activities;
    let practiceTasks;
    let commonMistakes;
    let lecture;
    if (isToeic) {
        const part = String(course.targetVariant || '').toUpperCase();
        sections = [
            { title: '1. Mục tiêu và dạng câu hỏi', content: `Bài ${index + 1} tập trung vào ${topic}. Người học cần xác định loại câu hỏi, thông tin cần tìm và chiến lược trả lời trước khi nghe hoặc đọc. Với TOEIC, mục tiêu không chỉ là chọn đúng mà còn là duy trì tốc độ ổn định và tránh distractor.` },
            { title: '2. Chiến lược làm bài', content: `Trước khi bắt đầu, đọc nhanh phần hướng dẫn và xác định keyword. Trong lúc làm, ưu tiên tín hiệu trực tiếp rồi kiểm tra paraphrase, từ đồng nghĩa và thông tin gây nhiễu. Nếu bỏ lỡ một câu, chuyển ngay sang câu kế tiếp để không mất thêm thời gian.` },
            { title: '3. Ví dụ có hướng dẫn', content: `Ví dụ ${topic}: xác định keyword chính, dự đoán loại đáp án và loại phương án không phù hợp. Sau khi chọn, giải thích vì sao đáp án đúng dựa trên evidence thay vì chỉ dựa vào từ trùng khớp. Cách làm này giúp giảm lỗi do nghe hoặc đọc theo keyword đơn lẻ.` },
            { title: '4. Ôn lỗi và tăng tốc', content: `Sau mỗi lượt luyện, ghi lại lỗi theo nhóm: vocabulary, grammar, distractor, inference, spelling hoặc time management. Lượt kế tiếp phải thay đổi đúng một yếu tố để đo được tiến bộ. Mục tiêu cuối bài là đạt ít nhất 70% và hoàn thành trong thời gian mục tiêu.` }
        ];
        examples = [
            `Ví dụ 1: với ${topic}, gạch chân keyword và dự đoán 2 loại đáp án có thể xuất hiện.`,
            `Ví dụ 2: so sánh một đáp án chứa từ nghe thấy trực tiếp với đáp án đúng dựa trên paraphrase.`,
            `Ví dụ 3: làm lại cùng dạng câu hỏi sau 24 giờ để kiểm tra khả năng ghi nhớ.`
        ];
        activities = [
            { type: 'guided_practice', title: 'Timed drill', instruction: `Hoàn thành 5 câu ${topic} trong thời gian giới hạn và đánh dấu câu bạn không chắc chắn.` },
            { type: 'error_review', title: 'Error tagging', instruction: 'Gắn nhãn từng lỗi theo vocabulary, grammar, distractor, inference hoặc timing rồi chọn một lỗi để sửa.' }
        ];
        practiceTasks = [
            `Làm 5 câu ${topic} ở mức dễ và ghi lại keyword.`,
            `Làm 5 câu cùng dạng ở mức trung bình nhưng giới hạn thời gian.`,
            'Chọn một câu sai, giải thích lại bằng paraphrase và làm lại sau 24 giờ.'
        ];
        commonMistakes = ['Chọn đáp án vì có từ khóa trùng với audio/passage mà không kiểm tra nghĩa.', 'Dừng quá lâu ở một câu và làm thiếu thời gian cho phần sau.', 'Không ghi lại dạng lỗi nên lỗi lặp lại ở lần test tiếp theo.', 'Học từ vựng rời rạc nhưng không đặt vào ngữ cảnh.'];
        lecture = { title: `Bài giảng: ${topic}`, keyPoints: [`Nhận diện dạng ${part || 'TOEIC'}.`, 'Dự đoán thông tin trước khi làm.', 'Loại distractor và kiểm soát thời gian.', 'Phân tích lỗi sau khi nộp.'], script: `Chào mừng bạn đến với bài ${index + 1} của ${course.name}. Hôm nay chúng ta học ${topic}. Trước tiên hãy xác định dạng câu hỏi và mục tiêu cần lấy thông tin. Tiếp theo, dự đoán keyword, loại distractor và kiểm soát thời gian. Sau khi làm xong, đừng chỉ xem điểm; hãy ghi lại loại lỗi và làm lại một câu tương tự để kiểm tra khả năng chuyển lỗi thành kỹ năng.` };
    } else if (isIelts) {
        sections = [
            { title: '1. Tiêu chí và mục tiêu band', content: `${topic} được học theo hướng nâng độ chính xác, độ rõ ràng và khả năng đáp ứng yêu cầu nhiệm vụ. Người học cần biết mình đang luyện comprehension, task response, coherence, lexical resource, grammar hay pronunciation để chọn đúng chiến lược.` },
            { title: '2. Quy trình thực hiện', content: `Bước 1: đọc/ nghe yêu cầu và xác định mục tiêu. Bước 2: tìm evidence hoặc xây ý. Bước 3: kiểm tra paraphrase, linking và grammar. Bước 4: tự chấm bằng checklist. Bước 5: sửa một nhóm lỗi trọng tâm trước khi làm bài tiếp theo.` },
            { title: '3. Ví dụ theo band', content: `Ví dụ với ${topic}: bài làm đạt mức cơ bản thường có ý đúng nhưng thiếu phát triển hoặc còn lỗi ngôn ngữ. Để tiến lên band cao hơn, cần tăng độ chính xác, paraphrase tự nhiên, lập luận có evidence và giảm lỗi lặp lại. Hãy so sánh phiên bản ban đầu với phiên bản đã sửa để nhìn thấy khác biệt.` },
            { title: '4. Review và self-correction', content: `Sau mỗi bài, tạo bảng lỗi gồm grammar, vocabulary, coherence, task response hoặc pronunciation. Chọn tối đa hai lỗi có tần suất cao nhất, luyện lại bằng một mini task mới rồi làm retest. Đây là vòng lặp giúp AI cập nhật mastery thay vì chỉ ghi nhận điểm.` }
        ];
        examples = [
            `Ví dụ 1: phân tích một câu/đoạn mẫu và đánh dấu keyword, paraphrase và linking words.`,
            `Ví dụ 2: sửa một đoạn có lỗi grammar/vocabulary và giải thích lý do thay đổi.`,
            `Ví dụ 3: làm lại cùng task với giới hạn thời gian rồi so sánh trước/sau.`
        ];
        activities = [
            { type: 'guided_practice', title: 'Band checklist', instruction: 'Tự chấm theo checklist trước khi xem feedback của AI.' },
            { type: 'shadowing_or_rewrite', title: 'Improve one answer', instruction: `Viết hoặc nói lại phần ${topic.toLowerCase()} với mục tiêu sửa đúng hai lỗi có tần suất cao nhất.` }
        ];
        practiceTasks = [
            `Hoàn thành một mini task về ${topic.toLowerCase()} và ghi evidence cho lựa chọn/ý tưởng.`,
            'Sửa một bài mẫu có ít nhất ba lỗi được cài sẵn và giải thích từng lỗi.',
            'Làm lại task sau 24 giờ mà không xem bài cũ, sau đó so sánh kết quả.'
        ];
        commonMistakes = ['Trả lời đúng ý nhưng không đáp ứng đủ task.', 'Dùng từ học thuật không tự nhiên hoặc lặp từ quá nhiều.', 'Thiếu linking giữa ý hoặc evidence.', 'Chỉ xem band score mà không biến feedback thành hành động cụ thể.'];
        lecture = { title: `Bài giảng: ${topic}`, keyPoints: ['Xác định tiêu chí đang được luyện.', 'Làm task theo quy trình.', 'Tự chấm trước khi xem feedback.', 'Retest sau khi sửa lỗi.'], script: `Chào mừng bạn đến với bài ${index + 1} của ${course.name}. Hôm nay chúng ta học ${topic}. Điều quan trọng nhất là bạn phải biết bài này đang đo kỹ năng nào. Hãy hoàn thành task, tự chấm bằng checklist, sau đó sửa nhóm lỗi nổi bật nhất. Cuối cùng, retest một task tương tự để kiểm tra xem lỗi đã thực sự biến mất chưa.` };
    } else if (isMos) {
        sections = [
            { title: '1. Mục tiêu thao tác', content: `${topic} được học theo mô hình làm thật trong Microsoft Office. Người học cần biết vị trí lệnh, hiểu khi nào dùng lệnh và tạo ra kết quả đúng định dạng, chứ không chỉ nhớ tên nút.` },
            { title: '2. Quy trình từng bước', content: `Quy trình đề xuất: mở tài liệu/bảng/slide mẫu → xác định yêu cầu → thực hiện thao tác → kiểm tra format và kết quả → lưu tệp đúng tên. Với bài thi thực hành, luôn kiểm tra cả nội dung và định dạng trước khi nộp.` },
            { title: '3. Ví dụ thực tế', content: `Ví dụ ${topic}: bắt đầu từ một tệp nhỏ, thực hiện đúng thao tác, sau đó thay đổi dữ liệu để đảm bảo công thức/định dạng vẫn hoạt động. Hãy chụp hoặc ghi lại trạng thái trước và sau để tự kiểm tra.` },
            { title: '4. Checklist MOS', content: `Trước khi kết thúc bài, kiểm tra: đúng file, đúng vị trí, đúng định dạng, đúng dữ liệu, không có lỗi #N/A/#VALUE! khi dùng Excel và không có đối tượng bị lệch trong Word/PowerPoint. Thực hành theo checklist này giúp giảm lỗi do thao tác vội.` }
        ];
        examples = [
            `Ví dụ 1: hoàn thành ${topic} trên một file thực hành nhỏ.`,
            `Ví dụ 2: cố tình tạo một lỗi định dạng rồi sửa bằng đúng công cụ của Office.`,
            `Ví dụ 3: hoàn thành lại thao tác trong thời gian ngắn hơn nhưng vẫn đạt checklist.`
        ];
        activities = [
            { type: 'guided_practice', title: 'Office hands-on', instruction: `Thực hiện ${topic.toLowerCase()} trên file thực hành và ghi lại từng lệnh đã dùng.` },
            { type: 'timed_task', title: 'Timed MOS task', instruction: 'Thực hiện lại cùng nhiệm vụ với thời gian giới hạn và tự kiểm tra bằng checklist.' }
        ];
        practiceTasks = [
            `Tạo một file thực hành và hoàn thành ${topic.toLowerCase()} theo hướng dẫn.`,
            'Thay đổi dữ liệu hoặc nội dung để kiểm tra kết quả vẫn đúng.',
            'Hoàn thành lại tác vụ mà không nhìn hướng dẫn, sau đó tự chấm theo checklist.'
        ];
        commonMistakes = ['Không kiểm tra định dạng sau khi thao tác.', 'Lưu sai tên hoặc sai vị trí file.', 'Dùng quá nhiều thao tác thủ công khi đã có công cụ phù hợp.', 'Không thử lại trên dữ liệu khác nên tưởng rằng thao tác luôn đúng.'];
        lecture = { title: `Bài giảng: ${topic}`, keyPoints: ['Biết mục tiêu của thao tác.', 'Biết đường dẫn lệnh trong Office.', 'Thực hành trên file thật.', 'Kiểm tra và lưu kết quả.'], script: `Trong bài ${index + 1}, chúng ta học ${topic}. Hãy bắt đầu bằng việc đọc yêu cầu, sau đó thực hiện từng bước trên file mẫu. Đừng chỉ quan sát; hãy tự thao tác. Cuối cùng, dùng checklist để kiểm tra nội dung, định dạng và tên file trước khi hoàn tất.` };
    } else {
        sections = [
            { title: '1. Khái niệm cốt lõi', content: `${topic} là một phần quan trọng trong ${course.name}. Hãy bắt đầu bằng định nghĩa, mục đích sử dụng và các thuật ngữ chính. ${facts[0] || ''}` },
            { title: '2. Cách hoạt động và quy trình', content: `Tiếp cận ${topic.toLowerCase()} theo trình tự: xác định đầu vào → chọn phương pháp → thực hiện → kiểm tra đầu ra → xử lý lỗi. Liên hệ nội dung với các kỹ năng ${skills.join(', ')} để tránh học rời rạc.` },
            { title: '3. Ví dụ và thực hành có hướng dẫn', content: `Bắt đầu từ tình huống nhỏ, giải thích từng bước và nêu rõ tại sao cách làm đó đúng. Sau đó thay đổi dữ liệu đầu vào để kiểm tra xem giải pháp có còn đúng hay không. ${facts[1] || ''}` },
            { title: '4. Tổng kết và kiểm tra hiểu biết', content: `Sau bài học, bạn phải giải thích được ${topic.toLowerCase()}, thực hiện một nhiệm vụ cơ bản, nhận diện lỗi phổ biến và biết khi nào nên nâng độ khó. Không chuyển sang bài mới nếu chưa đạt ngưỡng mastery của bài.` }
        ];
        examples = [
            `Ví dụ 1: giải quyết một tình huống cơ bản về ${topic.toLowerCase()} và xác định dữ liệu đầu vào.`,
            `Ví dụ 2: áp dụng ${topic.toLowerCase()} vào một nhiệm vụ thực tế rồi kiểm tra đầu ra.`,
            `Ví dụ 3: so sánh lời giải đúng và lời giải sai để tìm nguyên nhân lỗi.`
        ];
        activities = [
            { type: 'guided_practice', title: 'Luyện tập có hướng dẫn', instruction: `Thực hiện một nhiệm vụ ngắn về ${topic.toLowerCase()}, ghi lại từng bước và tự kiểm tra kết quả.` },
            { type: 'reflection', title: 'Tự phản hồi', instruction: `Viết một câu giải thích về điểm khó nhất của ${topic.toLowerCase()} và cách bạn sẽ sửa lỗi.` }
        ];
        practiceTasks = [
            `Bài tập 1: giải quyết một tình huống cơ bản về ${topic.toLowerCase()}.`,
            `Bài tập 2: thay đổi dữ liệu đầu vào và quan sát kết quả.`,
            `Bài tập 3: sửa một lỗi cố ý trong lời giải/thao tác.`
        ];
        commonMistakes = ['Học thuộc thao tác nhưng không xác định mục tiêu.', 'Không kiểm tra kết quả sau từng bước.', 'Bỏ qua phản hồi sau khi làm sai.', 'Chọn độ khó quá cao trước khi nắm vững nền tảng.'];
        lecture = { title: `Bài giảng: ${topic}`, keyPoints: [`Khái niệm và mục tiêu của ${topic}.`, `Quy trình thực hiện ${topic.toLowerCase()}.`, 'Cách kiểm tra kết quả và sửa lỗi.'], script: `Chào mừng bạn đến với bài ${index + 1} của khóa ${course.name}. Hôm nay chúng ta học ${topic}. Trước hết, hãy hiểu khái niệm và mục đích của nội dung này. Tiếp theo, chúng ta thực hành theo từng bước, kiểm tra kết quả và sửa lỗi. Cuối bài, bạn sẽ làm một bài test ngắn để kiểm tra mức độ nắm vững.` };
    }
    const factsForQuestions = facts;
    const questions = buildMixedQuestions({ course, topic, index, count: 12, source: 'ORIGINAL_PRACTICE' });
    let codeExample = '';
    let codingTasks = [];
    let testCases = [];
    if (programming) {
        if (language === 'python') codeExample = `def solve():\n    values = [4, 2, 7, 1]\n    values.sort()\n    print(values)\n\nif __name__ == "__main__":\n    solve()\n`;
        else if (language === 'java') codeExample = `import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        List<Integer> values = Arrays.asList(4,2,7,1);\n        values.stream().sorted().forEach(System.out::println);\n    }\n}\n`;
        else if (language === 'javascript') codeExample = `function solve(values) {\n    return [...values].sort((a, b) => a - b);\n}\nconsole.log(solve([4, 2, 7, 1]));\n`;
        else codeExample = `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\nint main() {\n    vector<int> values = {4, 2, 7, 1};\n    sort(values.begin(), values.end());\n    for (int x : values) cout << x << ' ';\n    return 0;\n}\n`;
        codingTasks = [`Viết chương trình áp dụng ${topic.toLowerCase()} và chạy ít nhất 3 bộ dữ liệu.`, 'Thêm ít nhất một trường hợp biên, giải thích kết quả và sửa chương trình nếu cần.', 'Tối ưu hoặc refactor lời giải rồi chạy lại test case để kiểm tra regression.'];
        testCases = [{ input: '', expectedOutput: '1 2 4 7 ' }, { input: '', expectedOutput: '1 3 5 9 ' }];
    }
    const lesson = {
        code: `${course.code}-L${index + 1}`, title: topic, description: objective, objectives: [objective, `Giải thích được các bước chính của ${topic.toLowerCase()}.`, `Vận dụng ${topic.toLowerCase()} vào ít nhất một tình huống thực tế.`], theorySections: sections,
        examples, lecture, activities, practiceTasks, commonMistakes, knowledge: [factsForQuestions[0], factsForQuestions[1]], skills, outcomes: [{ code: `${course.code}-OUT-${index + 1}`, description: objective }], estimatedMinutes: Math.max(25, Math.round(course.estimatedMinutes / Math.max(6, course.lessonTitles.length))), difficulty,
        audioScript: `${lecture.script} ${isToeic ? 'Hãy chú ý keyword, trọng âm và tốc độ.' : isIelts ? 'Hãy chú ý pronunciation, intonation và coherence.' : isMos ? 'Hãy thực hiện thao tác trực tiếp trên file thực hành.' : programming ? 'Hãy mở trình biên dịch và chạy code mẫu trước khi tự sửa.' : 'Hãy dừng lại ở các điểm kiểm tra và tự giải thích lại bằng lời của bạn.'}`,
        visualPrompt: isToeic ? `TOEIC educational image for ${topic}; realistic business/workplace context, clear labels, vocabulary cues, clean composition, no copyrighted exam content.` : isIelts ? `IELTS educational infographic for ${topic}; band-focused study diagram, academic examples, pronunciation or writing annotations where relevant, clean classroom style.` : isMos ? `MOS practical tutorial screenshot-style illustration for ${topic}; Microsoft Office workflow, clearly indicated steps, Vietnamese learner labels, no trademark logo recreation.` : programming ? `Programming lesson infographic for ${topic}; code editor, algorithm/data-flow diagram, example input/output, clear educational visual.` : `Educational infographic for ${topic} in ${course.name}; Vietnamese labels, learning diagram, examples and step-by-step flow.`,
        test: { title: `Kiểm tra bài: ${topic}`, passingScore: 70, durationSeconds: 12 * 60, questions }, aiExpansionHints: { deepenWith: ['examples','practice','mistakes','adaptive_questions','lecture','visuals','code','audio','images'], preserveSkills: skills }, programming, language, codeExample, codingTasks, testCases
    };
    const rich = professionalRichLesson({ course, topic, index, existing: lesson });
    lesson.theorySections = rich.theorySections || lesson.theorySections;
    lesson.theory = rich.theory || lesson.theorySections.map(item => item.content).join('\n\n');
    lesson.lecture = rich.lecture || lesson.lecture;
    lesson.examples = rich.examples || lesson.examples;
    lesson.activities = rich.activities || lesson.activities;
    lesson.practiceTasks = rich.practiceTasks || lesson.practiceTasks;
    lesson.commonMistakes = rich.commonMistakes || lesson.commonMistakes;
    lesson.quickChecks = rich.quickChecks || [];
    lesson.practical = rich.practical || rich.examTask || null;
    lesson.examTask = rich.examTask || null;
    lesson.contentWordCount = rich.contentWordCount || String(lesson.theory || '').trim().split(/\s+/).filter(Boolean).length;
    if (rich.programming) lesson.programming = rich.programming;
    lesson.test.questions = buildMixedQuestions({ course, topic, index, count: 12, source: 'ORIGINAL_PRACTICE' });
    if (lesson.practical && !lesson.test.questions.some(item => ['practical', 'coding', 'timed_simulation'].includes(item.type))) {
        const practicalQuestion = { id: `${course.code}-L${index + 1}-PRACTICAL`, type: 'practical', prompt: lesson.practical.task || `Hoàn thành nhiệm vụ thực hành về ${topic}.`, options: [], answer: undefined, rubric: lesson.practical.scoring || lesson.practical.rubric || {}, explanation: lesson.practical.scoringNote || 'Bài thực hành cần đánh giá theo rubric/checklist.', points: 10, difficulty: 'HARD', skill: skills[0] || topic, media: { kind: 'practical', ...lesson.practical } };
        lesson.test.questions = [...lesson.test.questions.slice(0, 11), practicalQuestion];
    }
    lesson.test.questions = lesson.test.questions.slice(0, 12);
    return lesson;
}
function buildStarterDraft(course, personalization = {}) {
    const lessonGroups = [];
    for (let i = 0; i < course.lessonTitles.length; i += 1) {
        const chapterIndex = Math.floor(i / 2);
        if (!lessonGroups[chapterIndex]) lessonGroups[chapterIndex] = { title: `Chương ${chapterIndex + 1}: ${course.lessonTitles[chapterIndex * 2] || 'Nền tảng'}`, description: `Chương ${chapterIndex + 1} tập trung vào nhóm kỹ năng liên quan của ${course.name}.`, lessons: [] };
        lessonGroups[chapterIndex].lessons.push(buildLesson(course, course.lessonTitles[i], i));
    }
    const chapters = lessonGroups.map((chapter, index) => {
        const chapterQuestions = chapter.lessons.flatMap(lesson => lesson.test.questions).slice(0, 24);
        return { ...chapter, test: { title: `Kiểm tra chương ${index + 1}: ${course.name}`, passingScore: 70, durationSeconds: 25 * 60, questions: chapterQuestions } };
    });
    const allQuestions = chapters.flatMap(chapter => chapter.lessons.flatMap(lesson => lesson.test.questions));
    const midtermQuestions = allQuestions.filter((_, index) => index % 2 === 0).slice(0, 50);
    const finalQuestions = allQuestions.slice(0, 80);
    const mockQuestions = allQuestions.filter((_, index) => index % 3 === 0).slice(0, 60);
    return {
        title: personalization.title || `${course.name} · Lộ trình cá nhân`, code: `${course.code}-AI`, description: `${course.description} Bản cá nhân hóa dùng catalog làm nền và bổ sung lý thuyết, bài giảng, thực hành, test bài, kiểm tra chương, giữa kỳ, cuối kỳ và mock test.`, audience: course.audience,
        educationLevel: personalization.educationLevel || course.educationLevel, grade: personalization.grade || null, subjectId: personalization.subjectId || course.subjectId, category: course.category, majorTracks: course.majorTracks, track: course.track, targetExam: course.targetExam, targetVariant: course.targetVariant, skills: course.skills, objectives: course.objectives, prerequisites: [], learningOutcomes: course.objectives.map(item => ({ description: item })), estimatedMinutes: course.estimatedMinutes, difficulty: 'ADAPTIVE',
        chapters, midtermAssessment: { title: `Kiểm tra giữa kỳ · ${course.name}`, passingScore: 70, durationSeconds: 45 * 60, questions: midtermQuestions }, finalAssessment: { title: `Kiểm tra cuối kỳ · ${course.name}`, passingScore: 70, durationSeconds: 60 * 60, questions: finalQuestions }, mockAssessment: { title: `Mock Test · ${course.name}`, passingScore: 70, durationSeconds: course.targetExam === 'IELTS' ? 60 * 60 : 45 * 60, questions: mockQuestions },
        personalization: { sourceStarterCode: course.code, goal: personalization.goal || '', major: personalization.major || '', specialization: personalization.specialization || '', skillGaps: personalization.skillGaps || [], generatedWithoutGemini: true }
    };
}
const MAJOR_ALIASES = {
    'công nghệ thông tin': ['CNTT'], 'kỹ thuật phần mềm': ['SE'], 'software engineering': ['SE'],
    'khoa học máy tính': ['CS'], 'computer science': ['CS'], 'hệ thống thông tin': ['IS'], 'information systems': ['IS'],
    'khoa học dữ liệu': ['DS'], 'data science': ['DS'], 'trí tuệ nhân tạo': ['AI'], 'artificial intelligence': ['AI'],
    'an toàn thông tin': ['SEC'], 'cybersecurity': ['SEC'], 'mạng máy tính': ['NET'], 'mạng máy tính và truyền thông dữ liệu': ['NET']
};
function findStarterCourse({ major = '', goal = '', targetExam = '', targetVariant = '', subjectId = '', prompt = '' } = {}) {
    const text = `${major} ${goal} ${targetExam} ${targetVariant} ${subjectId} ${prompt}`.toLowerCase();
    const majorText = String(major || '').toLowerCase();
    const majorCodes = new Set([...(MAJOR_ALIASES[majorText] || []), ...(majorText.match(/\b(CNTT|SE|CS|IS|DS|AI|SEC|NET)\b/gi) || []).map(item => item.toUpperCase())]);
    const targetExamText = String(targetExam || '').toUpperCase();
    const targetVariantText = String(targetVariant || '').toLowerCase();
    const requestedNumbers = text.match(/\b\d+(?:\.\d+)?\b/g) || [];
    let best = null; let bestScore = 0;
    for (const course of STARTER_COURSES) {
        let score = 0;
        const name = String(course.name || '').toLowerCase();
        const code = String(course.code || '').toLowerCase();
        const courseNumbers = `${name} ${code} ${String(course.targetVariant || '')}`.match(/\b\d+(?:\.\d+)?\b/g) || [];
        const signals = [course.skills, course.aliases, [course.name], [course.subjectId], [course.track]].flat().filter(Boolean);
        for (const signal of signals) {
            const normalized = String(signal).toLowerCase();
            if (normalized.length >= 4 && text.includes(normalized)) score += normalized.length >= 8 ? 2 : 1;
        }
        const majorTracks = Array.isArray(course.majorTracks) ? course.majorTracks.map(item => String(item).toUpperCase()) : [];
        if (majorCodes.size && majorTracks.some(track => majorCodes.has(track))) score += 8;
        if (majorText && name && similarityTokens(majorText, name) > 0) score += 2;
        if (course.targetExam && targetExamText && String(course.targetExam).toUpperCase() === targetExamText) score += 10;
        if (course.targetVariant && targetVariantText && String(course.targetVariant).toLowerCase().includes(targetVariantText)) score += 6;
        if (requestedNumbers.some(number => courseNumbers.includes(number))) score += 5;
        if (subjectId && String(course.subjectId || '').toLowerCase() === String(subjectId).toLowerCase()) score += 7;
        if (code && text.includes(code)) score += 5;
        if (score > bestScore) { bestScore = score; best = course; }
    }
    return best && bestScore > 0 ? { course: best, score: bestScore } : null;
}
function similarityTokens(a, b) {
    const left = new Set(String(a || '').split(/[^\p{L}\p{N}]+/u).filter(token => token.length > 2));
    const right = new Set(String(b || '').split(/[^\p{L}\p{N}]+/u).filter(token => token.length > 2));
    let overlap = 0;
    for (const token of left) if (right.has(token)) overlap += 1;
    return overlap / Math.max(1, left.size);
}
function buildStarterCourseDetail(course) {
    const draft = buildStarterDraft(course);
    const lessons = draft.chapters.flatMap((chapter, chapterIndex) => chapter.lessons.map((lesson, index) => {
        const number = chapterIndex * 2 + index + 1;
        const testId = `${course.code}-L${String(number).padStart(2, '0')}-TEST`;
        return { ...lesson, id: `${course.code}-L${number}`, _id: `${course.code}-L${number}`, lessonTestId: testId, assessmentIds: [testId], status: 'PUBLISHED', courseId: course.code, type: 'LESSON', payload: { chapterTitle: chapter.title, lecture: lesson.lecture, practiceTasks: lesson.practiceTasks, visualPrompt: lesson.visualPrompt } };
    }));
    const chapters = draft.chapters.map((chapter, index) => ({ order: index + 1, title: chapter.title, description: chapter.description, lessons: lessons.filter(lesson => lesson.payload?.chapterTitle === chapter.title), test: { id: `${course.code}-C${index + 1}-TEST`, code: `${course.code}-C${index + 1}-TEST`, assessmentType: 'CHAPTER_TEST', ...chapter.test } }));
    const lessonTests = lessons.map(lesson => ({ id: lesson.lessonTestId, code: lesson.lessonTestId, assessmentType: 'LESSON_TEST', lessonId: lesson.id, ...draft.chapters.flatMap(chapter => chapter.lessons).find(item => item.code === lesson.id)?.test || {} }));
    const assessments = lessonTests.concat(chapters.map(chapter => chapter.test), [{ id: `${course.code}-MIDTERM`, code: `${course.code}-MIDTERM`, assessmentType: 'MIDTERM', ...draft.midtermAssessment }, { id: `${course.code}-FINAL`, code: `${course.code}-FINAL`, assessmentType: 'FINAL', ...draft.finalAssessment }, { id: `${course.code}-MOCK`, code: `${course.code}-MOCK`, assessmentType: 'MOCK', ...draft.mockAssessment }]);
    return { course: { ...course, id: course.code, lessonCount: lessons.length, assessmentCount: assessments.length, questionCount: assessments.reduce((sum, item) => sum + (item.questions?.length || 0), 0), contentCompleteness: { lessons: lessons.length >= 12, assessments: assessments.length >= lessons.length + chapters.length + 3, complete: lessons.length >= 12 && assessments.length >= 21 }, syllabus: { ...course, lessonCount: lessons.length, questionCount: assessments.reduce((sum, item) => sum + (item.questions?.length || 0), 0), chapters: chapters.map(chapter => ({ order: chapter.order, title: chapter.title, description: chapter.description, testId: chapter.test.id })), midtermAssessmentId: `${course.code}-MIDTERM`, finalAssessmentId: `${course.code}-FINAL`, mockAssessmentId: `${course.code}-MOCK`, assessmentStructure: { lessonTests: lessons.length, chapterTests: chapters.length, midterm: true, final: true, mock: true } } }, lessons, chapters, assessments, finalAssessment: { id: `${course.code}-FINAL`, assessmentType: 'FINAL', ...draft.finalAssessment }, midtermAssessment: { id: `${course.code}-MIDTERM`, assessmentType: 'MIDTERM', ...draft.midtermAssessment }, mockAssessment: { id: `${course.code}-MOCK`, assessmentType: 'MOCK', ...draft.mockAssessment }, source: 'starter-catalog-v20-full-learning' };
}
async function seedStarterCatalog({ models } = {}) {
    const counts = { courses: 0, lessons: 0, questions: 0, assessments: 0, university: 0, majors: 0 };
    // Preserve the prior synthetic catalog record if it already exists, but stop naming the entire university stage as CNTT.
    const priorCatalog = await models.University.findOne({ code: 'HTM-UNIVERSITY-ACADEMIC-V20' }).lean()
        || await models.University.findOne({ code: 'HTM-UNIVERSITY-CATALOG' }).lean()
        || await models.University.findOne({ code: 'HTM-UNIVERSITY-IT' }).lean();
    const university = await models.University.findOneAndUpdate(priorCatalog ? { _id: priorCatalog._id } : { code: 'HTM-UNIVERSITY-ACADEMIC-V20' }, { $set: { code: 'HTM-UNIVERSITY-ACADEMIC-V20', name: 'Hành Trình Mới · Danh mục tham chiếu bậc Đại học', shortName: 'HTM-DAI-HOC', type: 'CATALOG', description: 'Danh mục học tập theo nhiều lĩnh vực/ngành ở bậc Đại học; không đại diện chương trình chính thức của một trường cụ thể.' }, $setOnInsert: { code: 'HTM-UNIVERSITY-ACADEMIC-V20' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    counts.university = 1;
    const majorMap = new Map();
    for (const domain of UNIVERSITY_DOMAINS) {
        const faculty = await models.Faculty.findOneAndUpdate({ universityId: university._id, code: domain.facultyCode }, { $set: { name: domain.facultyName, description: `Nhóm lĩnh vực ${domain.name} trong danh mục tham chiếu bậc Đại học; không phải thông tin chính thức của một trường cụ thể.`, status: 'ACTIVE' }, $setOnInsert: { universityId: university._id, code: domain.facultyCode } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        const field = await models.Field.findOneAndUpdate({ code: domain.fieldCode }, { $set: { name: domain.fieldName, description: `Lĩnh vực học tập ${domain.name}.`, status: 'ACTIVE' }, $setOnInsert: { code: domain.fieldCode } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        const discipline = await models.DisciplineGroup.findOneAndUpdate({ fieldId: field._id, code: domain.disciplineGroupCode }, { $set: { name: domain.disciplineGroupName, status: 'ACTIVE' }, $setOnInsert: { fieldId: field._id, code: domain.disciplineGroupCode } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        for (const [code, name] of domain.majors) {
            const major = await models.Major.findOneAndUpdate({ disciplineGroupId: discipline._id, code }, { $set: { name, degreeLevel: 'UNDERGRADUATE', duration: 4, status: 'ACTIVE' }, $setOnInsert: { disciplineGroupId: discipline._id, code } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
            majorMap.set(`${domain.code}:${code}`, major);
            if (!majorMap.has(code)) majorMap.set(code, major);
            counts.majors += 1;
        }
    }
    const defaultVersion = await models.CurriculumVersion.findOneAndUpdate({ code: 'AI-STARTER-CATALOG', version: '1' }, { $set: { status: 'ACTIVE', educationLevel: 'HIGHER_EDUCATION', grades: [], sourceRef: SOURCE_REF, objectives: ['Làm nền tảng cho AI recommendation và AI course generation.'], metadata: { track: 'UNIVERSITY_IT_ENGLISH_MOS', starterVersion: '19.2.0' } }, $setOnInsert: { code: 'AI-STARTER-CATALOG', version: '1' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(); 
    for (const definition of STARTER_COURSES) {
        const primaryMajorCode = definition.majorTracks?.[0] || null;
        const majorId = primaryMajorCode ? (majorMap.get(`${definition.academicDomainCode}:${primaryMajorCode}`) || majorMap.get(primaryMajorCode))?._id || null : null;
        const course = await models.Course.findOneAndUpdate({ code: definition.code }, { $set: { name: definition.name, educationLevel: definition.educationLevel, grade: null, subjectId: definition.subjectId, category: definition.category, description: definition.description, objectives: definition.objectives, learningOutcomes: definition.objectives.map(item => ({ description: item })), estimatedMinutes: definition.estimatedMinutes, difficulty: 'FOUNDATION_TO_ADVANCED', majorId, curriculumVersionId: defaultVersion._id, sourceRef: SOURCE_REF, syllabus: { starter: true, track: definition.track, academic: definition.academicDomainCode ? { educationStage: definition.educationStage, educationStageName: definition.educationStageName, degreeLevel: definition.degreeLevel, academicDomainCode: definition.academicDomainCode, academicDomainName: definition.academicDomainName, facultyCode: definition.facultyCode, facultyName: definition.facultyName, fieldCode: definition.fieldCode, fieldName: definition.fieldName, disciplineGroupCode: definition.disciplineGroupCode, disciplineGroupName: definition.disciplineGroupName, majorCodes: definition.majorCodes, isOfficialUniversityCurriculum: false, curriculumScope: 'GENERAL_SKILL_CATALOG' } : null, audience: definition.audience, skills: definition.skills, majorTracks: definition.majorTracks, targetExam: definition.targetExam, targetVariant: definition.targetVariant, aliases: definition.aliases, lessonTitles: definition.lessonTitles, pathDesign: definition.pathDesign, aiExpansionHints: { canExpandLessons: true, canGenerateQuestions: true, canGenerateTests: true, canPersonalize: true } }, kind: 'CANONICAL', ownerUsername: '', status: 'ACTIVE' }, $setOnInsert: { code: definition.code } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        counts.courses += 1;
        const questionPool = [];
        for (let i = 0; i < definition.lessonTitles.length; i += 1) {
            const topic = definition.lessonTitles[i];
            const lesson = await models.CurriculumContent.findOneAndUpdate({ curriculumVersionId: defaultVersion._id, code: `${definition.code}-L${i + 1}` }, { $set: { type: 'LESSON', courseId: course._id, title: topic, description: `Bài ${i + 1}: ${topic} trong ${definition.name}.`, educationLevel: definition.educationLevel, subjectId: definition.subjectId, objectives: [`Hiểu và áp dụng ${topic.toLowerCase()}.`], theorySections: [{ title: topic, content: `Nội dung starter của ${definition.name}. AI có thể mở rộng phần này bằng ví dụ, bài tập và tình huống cá nhân hóa.` }], examples: [{ title: 'Ví dụ thực hành', content: `Bài tập áp dụng ${topic.toLowerCase()} theo mục tiêu người học.` }], activities: [{ type: 'practice', title: 'Luyện tập', instruction: `Thực hiện một tác vụ về ${topic.toLowerCase()}.` }], skills: definition.skills.slice(0, 4), estimatedMinutes: Math.max(15, Math.round(definition.estimatedMinutes / 12)), difficulty: i < 1 ? 'EASY' : i < 3 ? 'MEDIUM' : 'HARD', status: 'PUBLISHED', sourceRef: SOURCE_REF, payload: { starterCourse: true, track: definition.track, aiExpansionHints: true } }, $setOnInsert: { curriculumVersionId: defaultVersion._id, code: `${definition.code}-L${i + 1}` } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
            counts.lessons += 1;
            const facts = definition.facts || [];
            const questions = GENERIC_QUESTIONS(definition, facts).slice(0, 3);
            const ids = [];
            for (let q = 0; q < questions.length; q += 1) {
                const question = questions[q];
                const doc = await models.Question.findOneAndUpdate({ code: `${definition.code}-L${i + 1}-Q${q + 1}` }, { $set: { curriculumVersionId: defaultVersion._id, courseId: course._id, lessonId: lesson._id, educationLevel: definition.educationLevel, grade: null, subjectId: definition.subjectId, type: 'single_choice', prompt: question.prompt, options: question.options.map(label => ({ label, value: label })), answer: question.answer, explanation: question.explanation, difficulty: question.difficulty, skills: [question.skill], status: 'PUBLISHED', source: SOURCE_REF }, $setOnInsert: { code: `${definition.code}-L${i + 1}-Q${q + 1}` } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
                ids.push(doc._id); questionPool.push(doc._id); counts.questions += 1;
            }
            await models.CurriculumContent.updateOne({ _id: lesson._id }, { $set: { assessmentIds: [], lessonTestId: null, payload: { starterQuestionIds: ids } } });
        }
        const assessmentCode = `${definition.code}-FINAL`;
        await models.Assessment.findOneAndUpdate({ code: assessmentCode }, { $set: { title: `Bài kiểm tra cuối khóa · ${definition.name}`, educationLevel: definition.educationLevel, grade: null, curriculumVersionId: defaultVersion._id, subjectId: definition.subjectId, courseId: course._id, questionIds: questionPool.slice(0, 12), questionPool: questionPool.slice(0, 12), durationSeconds: Math.min(3600, Math.max(900, Math.round(definition.estimatedMinutes / 8) * 60)), attemptLimit: 3, passingScore: 70, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'objective_percentage', maxScore: 100 }, reviewSettings: { showExplanationAfterSubmit: true }, publicationStatus: 'PUBLISHED', version: 'STARTER-1', sourceRef: SOURCE_REF }, $setOnInsert: { code: assessmentCode } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        counts.assessments += 1;
        await models.Course.updateOne({ _id: course._id }, { $set: { 'syllabus.finalAssessmentCode': assessmentCode, 'syllabus.questionCount': Math.min(12, questionPool.length), 'syllabus.lessonCount': definition.lessonTitles.length } });
    }
    return counts;
}

module.exports = { SOURCE_REF, STARTER_COURSES, EXTRA_COURSES, findStarterCourse, buildStarterDraft, buildStarterCourseDetail, seedStarterCatalog };
