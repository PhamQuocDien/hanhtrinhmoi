'use strict';

function make(code, name, lessons, skills, majors = [], extra = {}) {
    return { code, name, educationLevel: extra.educationLevel || 'HIGHER_EDUCATION', subjectId: extra.subjectId || 'CNTT', category: extra.category || 'MAJOR_FOUNDATION', description: extra.description || `Khóa học ${name} với lộ trình có lý thuyết, bài giảng, ví dụ, thực hành và kiểm tra theo từng cấp độ.`, skills, majorTracks: majors, track: extra.track || 'UNIVERSITY_IT', audience: extra.audience || 'Sinh viên CNTT và người học công nghệ', lessonTitles: lessons, targetExam: extra.targetExam || '', targetVariant: extra.targetVariant || '', aliases: [name, code, ...(extra.aliases || [])], objectives: lessons.map(item => `Hiểu và áp dụng ${item.toLowerCase()}.`), estimatedMinutes: extra.estimatedMinutes || 1200 };
}

const IT_EXTRA = [
    make('CNTT-C-01','Lập trình C từ cơ bản đến thực hành',['Cú pháp và kiểu dữ liệu','Con trỏ và bộ nhớ','Struct và file','Project C thực hành'],['c','pointers','memory','file-io'],['CNTT','SE','CS','AI']),
    make('CNTT-CPP-01','C++ và STL thực chiến',['C++ hiện đại và RAII','STL container','Iterator và algorithm','Project C++'],['cpp','stl','raii','algorithms'],['CNTT','SE','CS','AI']),
    make('CNTT-JAVA-01','Java Core cho sinh viên CNTT',['Cú pháp Java','Collections và Generics','Exception và File I/O','Java project thực hành'],['java','collections','generics','exceptions'],['CNTT','SE','CS','IS','AI']),
    make('CNTT-JAVA-OOP-01','Java OOP và Design Patterns',['Class, object và encapsulation','Inheritance và polymorphism','Interface và abstraction','SOLID và pattern nền tảng'],['java-oop','solid','design-pattern'],['SE','CNTT','IS']),
    make('CNTT-PY-02','Python lập trình thực chiến',['Syntax và control flow','Function và module','OOP trong Python','Project automation'],['python','oop','automation'],['CNTT','CS','DS','AI']),
    make('CNTT-TS-01','TypeScript và ứng dụng Web',['Type system','Interface và generics','Async và module','Project TypeScript'],['typescript','types','generics','async'],['CNTT','SE','CS']),
    make('CNTT-REACT-01','React từ cơ bản đến project',['Component và JSX','State và props','Hooks và forms','API và project React'],['react','jsx','hooks','frontend'],['SE','CNTT','CS','IS']),
    make('CNTT-NODE-01','Node.js và Express Backend',['Node runtime','Express routing','Middleware và validation','REST API project'],['nodejs','express','backend','rest-api'],['SE','CNTT','IS','CS']),
    make('CNTT-MONGO-01','MongoDB thực hành',['Document model','CRUD và aggregation','Index và schema design','MongoDB project'],['mongodb','nosql','aggregation','index'],['CNTT','SE','IS','DS']),
    make('CNTT-MYSQL-01','MySQL và thiết kế cơ sở dữ liệu',['DDL và DML','JOIN và aggregation','Transaction','Index và optimization'],['mysql','sql','transaction','optimization'],['CNTT','SE','IS','DS']),
    make('CNTT-API-01','API Testing với Postman',['HTTP anatomy','Postman collections','Assertions và environments','API regression'],['api-testing','postman','http','testing'],['SE','CNTT','IS']),
    make('CNTT-MICRO-01','Microservices nền tảng',['Service decomposition','API gateway','Messaging và resilience','Distributed systems project'],['microservices','api-gateway','messaging','distributed-systems'],['SE','CNTT','IS']),
    make('CNTT-PATTERN-01','Design Patterns cho lập trình viên',['Creational patterns','Structural patterns','Behavioral patterns','Pattern trong project'],['design-pattern','factory','strategy','observer'],['SE','CS','CNTT']),
    make('CNTT-CLEAN-01','Clean Code và Refactoring',['Naming và function design','Duplication và complexity','Refactoring workflow','Code review checklist'],['clean-code','refactoring','code-review'],['SE','CNTT','CS']),
    make('CNTT-ALG-02','Giải thuật nâng cao',['Sorting và searching nâng cao','Greedy','Dynamic programming','Problem solving'],['algorithms','greedy','dynamic-programming'],['CS','SE','AI','DS']),
    make('CNTT-LINUX-01','Linux và dòng lệnh cho developer',['Filesystem và permissions','Shell command','Process và service','Developer workflow'],['linux','shell','process','devops'],['CNTT','SE','CS','SEC','NET']),
    make('CNTT-WEBSEC-01','Web Security cơ bản',['OWASP mindset','Authentication security','Input validation','Secure coding'],['web-security','owasp','secure-coding'],['SEC','SE','CNTT','NET']),
    make('CNTT-NETSEC-01','Bảo mật mạng nền tảng',['Network threats','Firewall','TLS','Monitoring'],['network-security','firewall','tls','monitoring'],['SEC','NET','CNTT']),
    make('CNTT-GIT-02','Git workflow cho nhóm phát triển',['Branching strategy','Rebase và conflict','Pull request review','Release workflow'],['git','branching','review','release'],['SE','CNTT','CS','IS']),
    make('CNTT-INTERVIEW-01','Data Structures & Algorithms Interview',['Array và string','Tree và graph','Hashing','Mock interview problem solving'],['interview','dsa','problem-solving'],['SE','CS','AI','DS']),
    make('CNTT-SYSTEM-01','System Design nền tảng',['Requirements và capacity','Caching và database scaling','Load balancing','Design a scalable service'],['system-design','scalability','caching'],['SE','CS','IS']),
    make('CNTT-CLOUD-02','AWS Cloud Foundation',['Compute','Storage','Database services','Security và architecture'],['aws','cloud','iaas','security'],['CNTT','SE','IS','DS']),
    make('CNTT-POWERBI-01','Power BI cho phân tích dữ liệu',['Data import','Transform và model','Dashboard','Insight presentation'],['powerbi','data-visualization','dashboard'],['DS','IS','CNTT']),
    make('CNTT-DATAENG-01','Data Engineering nền tảng',['ETL và ELT','Data warehouse','Pipeline orchestration','Data quality'],['data-engineering','etl','warehouse','pipeline'],['DS','AI','IS','CNTT']),
    make('CNTT-ML-02','Machine Learning với Python',['Feature engineering','Model training','Evaluation','Mini project ML'],['machine-learning','python','features','evaluation'],['AI','DS','CS','CNTT'])
];

const TOEIC_EXTRA = [
    make('TOEIC-450-01','TOEIC 450 Roadmap',['Grammar essentials','Vocabulary essentials','Listening essentials','Reading essentials'],['grammar','vocabulary','listening','reading'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'450'}),
    make('TOEIC-550-01','TOEIC 550 Roadmap',['Core grammar upgrade','Vocabulary in context','Listening patterns','Reading speed'],['grammar','vocabulary','listening','reading'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'550'}),
    make('TOEIC-650-01','TOEIC 650 Roadmap',['Advanced grammar','Collocations','Listening inference','Reading inference'],['grammar','collocations','listening','reading'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'650'}),
    make('TOEIC-700-01','TOEIC 700 Roadmap',['Complex sentences','Business vocabulary','Fast listening','Timed reading'],['grammar','business-vocabulary','listening','reading'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'700'}),
    make('TOEIC-800-01','TOEIC 800+ Mastery',['Advanced lexical sets','Inference grammar','High-speed listening','Difficult reading'],['advanced-vocabulary','grammar','listening','reading'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'800+'}),
    make('TOEIC-P1-01','TOEIC Listening Part 1 Mastery',['Scene vocabulary','Picture structure','Fast visual scan','Mock Part 1'],['toeic-p1','listening','visual-vocabulary'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'P1'}),
    make('TOEIC-P2-01','TOEIC Listening Part 2 Mastery',['Question words','Response patterns','Distractors','Mock Part 2'],['toeic-p2','listening','response-patterns'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'P2'}),
    make('TOEIC-P3P4-01','TOEIC Listening Part 3–4 Mastery',['Context prediction','Speaker intention','Note taking','Mock Part 3–4'],['toeic-p3-p4','listening','prediction'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'P3-P4'}),
    make('TOEIC-P5P6-01','TOEIC Reading Part 5–6 Mastery',['Grammar completion','Word forms','Connectors','Timed P5–P6'],['toeic-p5-p6','grammar','reading'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'P5-P6'}),
    make('TOEIC-P7-01','TOEIC Reading Part 7 Mastery',['Single passages','Double passages','Triple passages','Inference under time'],['toeic-p7','reading','inference'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'P7'}),
    make('TOEIC-SW-01','TOEIC Speaking & Writing Practice',['Read aloud','Describe and respond','Sentence writing','Opinion response'],['speaking','writing','pronunciation','fluency'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'SPEAKING-WRITING'}),
    make('TOEIC-MOCK-02','TOEIC Mock 10 đề cá nhân hóa',['Baseline mock','Error analysis','Targeted mock','Full adaptive simulation'],['mock','diagnostic','adaptive','strategy'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'TOEIC',track:'ENGLISH',targetExam:'TOEIC',targetVariant:'FULL-MOCK'})
];

const IELTS_EXTRA = [
    make('IELTS-BAND55-01','IELTS Band 5.5 Roadmap',['Core grammar','Topic vocabulary','Listening and reading basics','Speaking confidence'],['grammar','vocabulary','listening','reading','speaking'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'5.5'}),
    make('IELTS-BAND60-01','IELTS Band 6.0 Roadmap',['Grammar range','Paraphrasing','Reading inference','Speaking fluency'],['grammar','paraphrase','reading','speaking'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'6.0'}),
    make('IELTS-BAND65-01','IELTS Band 6.5 Roadmap',['Complex grammar','Academic vocabulary','Coherence','Speaking development'],['grammar','academic-vocabulary','coherence','speaking'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'6.5'}),
    make('IELTS-BAND70-01','IELTS Band 7.0 Roadmap',['Precision grammar','Lexical flexibility','Advanced coherence','High-band speaking'],['grammar','lexical-resource','coherence','speaking'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'7.0'}),
    make('IELTS-LISTENING-02','IELTS Listening Intensive',['Section 1–2','Section 3–4','Distractors','Full timed listening'],['listening','prediction','distractors'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'LISTENING'}),
    make('IELTS-READING-02','IELTS Reading Intensive',['Matching headings','T/F/NG','Matching information','Timed passage sets'],['reading','headings','tfng','timed-reading'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'READING'}),
    make('IELTS-W1-02','IELTS Academic Writing Task 1 Intensive',['Charts and graphs','Overview writing','Comparisons','Band-based correction'],['writing-task1','charts','overview','comparisons'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'ACADEMIC-TASK1'}),
    make('IELTS-W2-02','IELTS Writing Task 2 Intensive',['Essay planning','Thesis and position','Body paragraph development','Band-based correction'],['writing-task2','essay','argument','coherence'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'TASK2'}),
    make('IELTS-SPEAK-02','IELTS Speaking Intensive',['Part 1 natural answers','Part 2 long turn','Part 3 ideas','Pronunciation and intonation'],['speaking','fluency','pronunciation','intonation'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'SPEAKING'}),
    make('IELTS-GT-02','IELTS General Training Roadmap',['GT Reading','GT Writing Task 1','Listening','Speaking'],['gt-reading','gt-writing','listening','speaking'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'GENERAL-TRAINING'}),
    make('IELTS-PRON-01','IELTS Pronunciation & Intonation',['Word stress','Sentence stress','Chunking','Intonation and shadowing'],['pronunciation','stress','chunking','intonation'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'PRONUNCIATION'}),
    make('IELTS-MOCK-02','IELTS Full Mock 10 đề cá nhân hóa',['Baseline mock','4-skill diagnosis','Targeted mock','Full adaptive simulation'],['mock','diagnostic','adaptive','strategy'],[],{educationLevel:'ENGLISH_CERTIFICATION',subjectId:'IELTS',track:'ENGLISH',targetExam:'IELTS',targetVariant:'FULL-MOCK'})
];

const MOS_EXTRA = [
    make('MOS-WORD-03','MOS Word Expert thực hành',['Document styles','References and citations','Long documents','Timed practical task'],['MOS','WORD','styles','references']),
    make('MOS-WORD-04','MOS Word Project Lab',['Business document','Report layout','Forms and tables','Final Word project'],['MOS','WORD','project']),
    make('MOS-EXCEL-07','MOS Excel Functions Mastery',['Reference functions','Text and date functions','Logical functions','Error handling'],['MOS','EXCEL','functions','lookup']),
    make('MOS-EXCEL-08','MOS Excel Pivot & Dashboard',['Tables and source data','PivotTable','PivotChart','Dashboard project'],['MOS','EXCEL','pivot','dashboard']),
    make('MOS-EXCEL-09','MOS Excel Data Analysis Lab',['Data cleaning','Conditional formatting','What-if analysis','Business case project'],['MOS','EXCEL','analysis','what-if']),
    make('MOS-EXCEL-10','MOS Excel Advanced Exam Prep',['Advanced formulas','Data validation','Scenario analysis','Timed practical exam'],['MOS','EXCEL','advanced','exam']),
    make('MOS-POWERPOINT-03','MOS PowerPoint Design Mastery',['Visual hierarchy','Slide master','Charts and SmartArt','Animation storytelling'],['MOS','POWERPOINT','design','master']),
    make('MOS-POWERPOINT-04','MOS PowerPoint Presentation Lab',['Business deck','Data storytelling','Speaker notes','Final presentation'],['MOS','POWERPOINT','presentation','storytelling']),
    make('MOS-OFFICE-01','Microsoft Office Workplace Skills',['Word workflow','Excel workflow','PowerPoint workflow','Integrated office project'],['MOS','WORD','EXCEL','POWERPOINT','workflow']),
    make('MOS-EXAM-01','MOS Exam Strategy & Simulation',['Exam navigation','Time management','Word simulation','Excel and PowerPoint simulation'],['MOS','simulation','exam-strategy']),
    make('MOS-BEGINNER-01','Office Skills từ số 0',['Keyboard and file skills','Word basics','Excel basics','PowerPoint basics'],['MOS','office','beginner']),
    make('MOS-PROJECT-01','Office Portfolio Project',['Create a report','Build a spreadsheet','Build a presentation','Integrated final portfolio'],['MOS','portfolio','project'])
];

const EXTRA_COURSES = [...IT_EXTRA, ...TOEIC_EXTRA, ...IELTS_EXTRA, ...MOS_EXTRA];
module.exports = { EXTRA_COURSES };
