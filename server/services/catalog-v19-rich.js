'use strict';

function it(code, name, lessons, skills, majorTracks = ['CNTT','SE','CS','IS','DS','AI']) {
    return { code, name, educationLevel: 'HIGHER_EDUCATION', subjectId: 'CNTT', category: 'MAJOR_REQUIRED', description: `${name} là khóa học CNTT thực hành, có lộ trình bài học, bài tập, kiểm tra và nội dung mở rộng để AI cá nhân hóa.`, skills, majorTracks, track: 'UNIVERSITY_IT', audience: 'Sinh viên CNTT và người học lập trình', lessonTitles: lessons, aliases: [name, code, 'CNTT'], objectives: lessons.map(title => `Nắm vững và thực hành ${title.toLowerCase()}.`), estimatedMinutes: 1440 };
}
function english(code, name, lessons, skills, exam, variant) {
    return { code, name, educationLevel: 'ENGLISH_CERTIFICATION', subjectId: exam, category: 'FOUNDATION', description: `${name} là khóa học ${exam} có bài học, luyện tập, test và mô phỏng theo mục tiêu ${variant}.`, skills, majorTracks: [], track: 'ENGLISH', audience: 'Người học tiếng Anh theo mục tiêu chứng chỉ', lessonTitles: lessons, targetExam: exam, targetVariant: variant, aliases: [name, code, exam, variant], objectives: lessons.map(title => `Luyện và áp dụng ${title.toLowerCase()}.`), estimatedMinutes: 1200 };
}
function mos(code, name, app, lessons, skills, level = 'FOUNDATION') {
    return { code, name, educationLevel: 'HIGHER_EDUCATION', subjectId: 'MOS', category: level === 'ADVANCED' ? 'SPECIALIZATION' : 'FOUNDATION', description: `${name} tập trung thao tác thực hành ${app} và chuẩn bị cho bài test, bài kiểm tra và mô phỏng MOS.`, skills, majorTracks: [], track: 'MOS', audience: 'Học sinh, sinh viên và người đi làm', lessonTitles: lessons, targetExam: 'MOS', targetVariant: app, aliases: [name, code, 'MOS', app], objectives: lessons.map(title => `Thực hiện được ${title.toLowerCase()} trong ${app}.`), estimatedMinutes: 900 };
}

const RICH_IT_COURSES = [
    it('CNTT-C-01','Lập trình C từ cơ bản đến thực hành',['Môi trường C và cú pháp','Biến, kiểu dữ liệu và toán tử','Điều kiện và vòng lặp','Hàm và tổ chức chương trình','Mảng, chuỗi và con trỏ','File và mini project'],['c','syntax','pointer','algorithm'],['CNTT','SE','CS','SEC','NET']),
    it('CNTT-CPP-01','C++ căn bản và STL',['C++ syntax và I/O','Hàm, tham chiếu và vector','String, pair và struct','STL containers','STL algorithms','Mini project C++'],['cpp','stl','vector','algorithm'],['CNTT','SE','CS','AI','DS']),
    it('CNTT-CPP-02','C++ nâng cao',['Smart pointer','RAII','Template','Lambda','Move semantics','Project C++ hiện đại'],['cpp-advanced','smart-pointer','template','raii'],['CNTT','SE','CS','AI']),
    it('CNTT-CPP-03','Clean Code với C++',['Tên biến và hàm','Hàm nhỏ và trách nhiệm đơn','Code smell','Refactoring','Error handling','Clean Code project'],['clean-code','refactoring','cpp'],['SE','CS','CNTT']),
    it('CNTT-JAVA-01','Java Core thực chiến',['Java syntax','Class và Object','Exception và package','Collections','Generics','Mini project Java'],['java','oop','collections','generics'],['CNTT','SE','CS','IS']),
    it('CNTT-JAVA-02','Java Collections và Generics',['List và Set','Map','Iterator và Stream concept','Comparator','Generics nâng cao','Bài tập xử lý dữ liệu Java'],['java','collections','generics','stream'],['SE','CS','IS','DS']),
    it('CNTT-JAVA-03','Java nâng cao và Concurrency',['Thread','Executor','Synchronization','Concurrent collections','CompletableFuture','Project concurrent Java'],['java','concurrency','thread','executor'],['SE','CS','IS']),
    it('CNTT-JAVA-04','Spring Boot Backend',['Spring Boot structure','REST Controller','Service và Repository','Validation','Security','Backend project'],['spring-boot','rest','validation','security'],['SE','IS','CNTT']),
    it('CNTT-JAVA-05','JUnit và Java Testing',['Unit test','JUnit assertions','Mocking concept','Integration test','Test coverage','Testing project'],['java-testing','junit','unit-test','integration-test'],['SE','CS','IS']),
    it('CNTT-PY-02','Python lập trình ứng dụng',['Python environment','Function và module','OOP Python','File và exception','API và JSON','Project Python'],['python','oop','api','json'],['CNTT','SE','CS','DS','AI']),
    it('CNTT-PY-03','Python Web với FastAPI',['HTTP và API','FastAPI routes','Pydantic validation','Database integration','Authentication','FastAPI project'],['python','fastapi','rest','backend'],['SE','IS','CNTT']),
    it('CNTT-JS-02','JavaScript nâng cao',['Scope và closure','Prototype và class','Promise và async/await','Fetch và error handling','Modules và bundling concept','Frontend project'],['javascript','async','promise','module'],['SE','CNTT','IS']),
    it('CNTT-TS-01','TypeScript thực hành',['Types','Interfaces và generics','Narrowing','Classes','API typing','TypeScript project'],['typescript','types','generics','api'],['SE','CS','IS']),
    it('CNTT-REACT-01','React căn bản',['Component và JSX','Props và state','Hooks','Form','Fetch API','React mini app'],['react','jsx','hooks','frontend'],['SE','CNTT','IS']),
    it('CNTT-REACT-02','React nâng cao',['State architecture','Context','Custom hooks','Performance','Routing','React application'],['react','context','hooks','performance'],['SE','CNTT','IS']),
    it('CNTT-NODE-01','Node.js Backend',['Node runtime','Express routes','Middleware','REST API','Authentication','Node backend project'],['nodejs','express','rest','authentication'],['SE','CNTT','IS']),
    it('CNTT-NEST-01','NestJS Backend',['Modules và Controllers','Providers','DTO validation','Database','Guards','NestJS project'],['nestjs','typescript','backend','rest'],['SE','CNTT','IS']),
    it('CNTT-SQL-02','SQL nâng cao',['Window functions','CTE','Views','Transactions','Query plan','SQL optimization project'],['sql','window-function','cte','optimization'],['CNTT','SE','CS','IS','DS']),
    it('CNTT-DB-02','Database Design thực chiến',['Requirement to ERD','Keys và constraints','Normalization','Index design','Transaction design','Database project'],['database-design','erd','normalization','index','transaction'],['CNTT','SE','IS','DS']),
    it('CNTT-MONGO-01','MongoDB thực hành',['Document model','CRUD','Indexes','Aggregation','Transactions','MongoDB project'],['mongodb','nosql','aggregation','index'],['SE','IS','DS','CNTT']),
    it('CNTT-REDIS-01','Redis và Caching',['Key value model','TTL','Cache patterns','Pub/Sub','Rate limiting','Caching project'],['redis','cache','pubsub','backend'],['SE','IS','CNTT']),
    it('CNTT-KAFKA-01','Kafka và Event Streaming',['Event concept','Topics và partitions','Producer','Consumer','Consumer groups','Streaming project'],['kafka','event-driven','streaming','backend'],['SE','CS','DS','IS']),
    it('CNTT-LINUX-01','Linux cho lập trình viên',['Filesystem','Permissions','Process','Shell commands','Bash scripts','Linux practice project'],['linux','shell','bash','system'],['CNTT','SE','CS','NET','SEC']),
    it('CNTT-NET-02','TCP/IP thực hành',['IPv4 fundamentals','Subnetting','TCP và UDP','DNS','HTTP','Network troubleshooting'],['tcpip','subnet','dns','http'],['NET','SEC','CNTT','SE']),
    it('CNTT-SEC-02','Web Security và OWASP',['Threat modeling','Authentication issues','Injection','XSS','CSRF','Secure web project'],['owasp','web-security','xss','csrf'],['SEC','SE','CNTT','NET']),
    it('CNTT-SEC-03','Secure Coding',['Input validation','Secrets','Access control','Logging','Dependency security','Secure coding project'],['secure-coding','validation','access-control','security'],['SEC','SE','CNTT']),
    it('CNTT-GIT-02','Git nâng cao',['Rebase','Cherry-pick','Bisect','Tags và release','Branch strategy','Team workflow project'],['git','rebase','release','workflow'],['SE','CS','CNTT','IS']),
    it('CNTT-DEVOPS-02','CI/CD thực hành',['Pipeline concept','Build automation','Test automation','Artifact','Deployment','CI/CD project'],['cicd','devops','automation','deployment'],['SE','CNTT','IS']),
    it('CNTT-DOCKER-01','Docker thực chiến',['Images','Containers','Volumes','Networks','Docker Compose','Deploy a service'],['docker','container','compose','deployment'],['SE','CNTT','IS']),
    it('CNTT-K8S-01','Kubernetes căn bản',['Cluster concepts','Pods','Deployments','Services','Config and secrets','Kubernetes practice'],['kubernetes','container','deployment','devops'],['SE','CNTT','NET']),
    it('CNTT-CLOUD-02','Cloud AWS nền tảng',['Cloud concepts','Compute','Storage','Database','IAM','Cloud mini project'],['aws','cloud','iam','deployment'],['CNTT','SE','CS','IS','DS']),
    it('CNTT-SYSTEM-01','System Design nền tảng',['Requirements','Scalability','Caching','Database scaling','Queues','System design case study'],['system-design','scalability','caching','architecture'],['SE','CS','IS']),
    it('CNTT-MICRO-01','Microservices thực hành',['Service boundaries','API gateway','Communication','Data ownership','Observability','Microservices project'],['microservices','architecture','api','distributed-system'],['SE','CS','IS']),
    it('CNTT-TEST-02','Automation Testing Web',['Test strategy','Selectors','UI automation','API automation','Reports','Automation test project'],['automation-testing','web-testing','api-testing','qa'],['SE','IS','CNTT']),
    it('CNTT-DSA-02','Giải thuật nâng cao',['Divide and conquer','Greedy','Dynamic programming','Backtracking','Shortest path','Algorithm project'],['algorithms','dynamic-programming','greedy','graph'],['CS','DS','AI','SE']),
    it('CNTT-DSA-03','Competitive Programming căn bản',['Fast input','Sorting','Two pointers','Binary search','Prefix and graph basics','Contest project'],['competitive-programming','algorithm','binary-search','graph'],['CS','DS','SE','CNTT']),
    it('CNTT-DATA-02','Data Engineering nền tảng',['Data pipeline','Batch processing','ETL','Data quality','Warehouse concepts','Data engineering project'],['data-engineering','etl','pipeline','data-quality'],['DS','AI','IS','CS']),
    it('CNTT-AI-02','Machine Learning thực hành',['Data preparation','Features','Regression','Classification','Evaluation','ML mini project'],['machine-learning','regression','classification','evaluation'],['AI','DS','CS','CNTT']),
    it('CNTT-AI-03','Generative AI ứng dụng',['LLM concepts','Prompt engineering','Structured output','RAG basics','AI evaluation','AI application project'],['generative-ai','llm','prompt','rag'],['AI','DS','SE','CNTT']),
    it('CNTT-UX-02','Figma và Design System',['Auto layout','Components','Variants','Typography','Design tokens','Prototype project'],['figma','design-system','uiux','prototype'],['CNTT','SE','IS']),
    it('CNTT-MOBILE-01','Android Kotlin căn bản',['Kotlin syntax','Activities','UI layout','State','Networking','Android mini app'],['android','kotlin','mobile','api'],['SE','CNTT']),
    it('CNTT-FLUTTER-01','Flutter căn bản',['Dart essentials','Widgets','Layout','State','Navigation','Flutter app'],['flutter','dart','mobile','ui'],['SE','CNTT']),
    it('CNTT-API-02','API Testing với Postman',['HTTP methods','Collections','Variables','Assertions','Test scripts','API test project'],['api-testing','postman','rest','testing'],['SE','IS','CNTT'])
];

const RICH_TOEIC_COURSES = [
    english('TOEIC-P1-02','TOEIC Part 1 Picture Mastery',['Nhãn ảnh và hành động','Vị trí và giới từ','Thì và trạng thái','Distractors','Tốc độ nghe','Part 1 mock'],['LISTENING','PICTURE','VOCABULARY'],'TOEIC','P1'),
    english('TOEIC-P2-02','TOEIC Part 2 Question Response',['Who/What/When/Where','Yes-No questions','Wh-questions','Indirect answers','Distractors','Part 2 mock'],['LISTENING','QUESTION_RESPONSE','GRAMMAR'],'TOEIC','P2'),
    english('TOEIC-P3-02','TOEIC Part 3 Conversations',['Context prediction','Speaker purpose','Details','Inference','Note-taking','Part 3 mock'],['LISTENING','CONVERSATION','INFERENCE'],'TOEIC','P3'),
    english('TOEIC-P4-02','TOEIC Part 4 Talks',['Announcement','Advertisement','Meeting talk','Prediction','Details','Part 4 mock'],['LISTENING','TALK','DETAIL'],'TOEIC','P4'),
    english('TOEIC-P5-02','TOEIC Part 5 Sentence Completion',['Parts of speech','Tenses','Agreement','Prepositions','Word choice','Part 5 mock'],['READING','GRAMMAR','VOCABULARY'],'TOEIC','P5'),
    english('TOEIC-P6-02','TOEIC Part 6 Text Completion',['Context','Sentence insertion','Vocabulary','Grammar','Cohesion','Part 6 mock'],['READING','TEXT_COMPLETION','GRAMMAR'],'TOEIC','P6'),
    english('TOEIC-P7-02','TOEIC Part 7 Reading Speed',['Single passages','Double passages','Triple passages','Scanning','Inference','Part 7 mock'],['READING','SCANNING','INFERENCE'],'TOEIC','P7'),
    english('TOEIC-VOCAB-01','TOEIC 1000 Từ vựng theo chủ đề',['Office','Travel','Finance','Sales','Human resources','Review test'],['VOCABULARY','COLLOCATION','SPACED_REPETITION'],'TOEIC','VOCABULARY'),
    english('TOEIC-GRAMMAR-01','TOEIC Grammar Mastery',['Nouns and adjectives','Verbs and tenses','Clauses','Conjunctions','Prepositions','Grammar mock'],['GRAMMAR','TENSES','SENTENCE_STRUCTURE'],'TOEIC','GRAMMAR'),
    english('TOEIC-LISTENING-SHADOW','TOEIC Listening Shadowing',['Chunking','Connected speech','Intonation','Stress','Shadowing','Listening speaking transfer'],['LISTENING','SPEAKING','PRONUNCIATION'],'TOEIC','LISTENING'),
    english('TOEIC-SPEAKING-01','TOEIC Speaking Foundation',['Read aloud','Describe a picture','Respond to questions','Propose solutions','Express opinion','Speaking mock'],['SPEAKING','PRONUNCIATION','FLUENCY'],'TOEIC','SPEAKING'),
    english('TOEIC-WRITING-01','TOEIC Writing Foundation',['Sentence writing','Email response','Information request','Suggestions','Opinion writing','Writing mock'],['WRITING','GRAMMAR','VOCABULARY'],'TOEIC','WRITING')
];

const RICH_IELTS_COURSES = [
    english('IELTS-LISTENING-01','IELTS Listening Section 1–2',['Form completion','Numbers and spelling','Multiple choice','Maps','Distractors','Section 1–2 mock'],['LISTENING','SPELLING','FORM_COMPLETION'],'IELTS','LISTENING'),
    english('IELTS-LISTENING-02','IELTS Listening Section 3–4',['Academic conversation','Matching','Multiple choice','Lecture notes','Inference','Section 3–4 mock'],['LISTENING','ACADEMIC','NOTE_TAKING'],'IELTS','LISTENING'),
    english('IELTS-READING-TFNG','IELTS Reading True False Not Given',['Statement analysis','Keyword traps','False vs Not Given','Paraphrase','Speed practice','TFNG mock'],['READING','TFNG','PARAPHRASING'],'IELTS','READING'),
    english('IELTS-READING-HEADINGS','IELTS Reading Matching Headings',['Main idea','Heading keywords','Distractors','Paragraph mapping','Time management','Headings mock'],['READING','HEADINGS','MAIN_IDEA'],'IELTS','READING'),
    english('IELTS-READING-MCQ','IELTS Reading Multiple Choice',['Question stems','Evidence','Distractors','Inference','Speed','MCQ mock'],['READING','MCQ','INFERENCE'],'IELTS','READING'),
    english('IELTS-WRITING-T1-02','IELTS Academic Task 1 Charts',['Line charts','Bar charts','Tables','Pie charts','Comparisons','Task 1 mock'],['WRITING','TASK1','DATA_DESCRIPTION'],'IELTS','WRITING-TASK1'),
    english('IELTS-WRITING-T2-02','IELTS Task 2 Essay Mastery',['Opinion essay','Discussion essay','Problem solution','Advantages disadvantages','Examples and cohesion','Task 2 mock'],['WRITING','TASK2','ESSAY'],'IELTS','WRITING-TASK2'),
    english('IELTS-SPEAKING-P1','IELTS Speaking Part 1 Fluency',['Personal questions','Extended answers','Natural fillers','Pronunciation','Intonation','Part 1 mock'],['SPEAKING','FLUENCY','PRONUNCIATION'],'IELTS','SPEAKING-P1'),
    english('IELTS-SPEAKING-P2','IELTS Speaking Part 2 Long Turn',['Preparation','Story structure','Lexical resource','Fluency','Intonation','Part 2 mock'],['SPEAKING','FLUENCY','VOCABULARY'],'IELTS','SPEAKING-P2'),
    english('IELTS-SPEAKING-P3','IELTS Speaking Part 3 Discussion',['Opinion','Compare and contrast','Abstract ideas','Examples','Interaction','Part 3 mock'],['SPEAKING','DISCUSSION','FLUENCY'],'IELTS','SPEAKING-P3')
];

const RICH_MOS_COURSES = [
    mos('MOS-WORD-02','MOS Word Soạn thảo tài liệu','Word',['Document setup','Paragraph formatting','Styles','Tables','Page layout','Practical Word project'],['WORD','FORMATTING','STYLES','TABLES']),
    mos('MOS-WORD-03','MOS Word Tài liệu dài','Word',['Sections','Headers and footers','Table of contents','References','Track changes','Long document project'],['WORD','LONG_DOCUMENT','REFERENCES','REVIEW'],'ADVANCED'),
    mos('MOS-EXCEL-02','MOS Excel Công thức cơ bản','Excel',['Cell references','SUM and AVERAGE','COUNT functions','IF','Sort and filter','Formula project'],['EXCEL','FORMULA','IF','FILTER']),
    mos('MOS-EXCEL-03','MOS Excel Lookup và Logic','Excel',['IF and nested IF','XLOOKUP concept','VLOOKUP concept','INDEX MATCH concept','Error handling','Lookup project'],['EXCEL','LOOKUP','LOGIC','FORMULA'],'ADVANCED'),
    mos('MOS-EXCEL-04','MOS Excel Pivot và Dashboard','Excel',['Tables','PivotTable','PivotChart','Slicers','Dashboard layout','Dashboard project'],['EXCEL','PIVOT','DASHBOARD','CHART'],'ADVANCED'),
    mos('MOS-EXCEL-05','MOS Excel Phân tích dữ liệu','Excel',['Data cleaning','Conditional formatting','What-if analysis','Data validation','Charts','Analysis project'],['EXCEL','DATA_ANALYSIS','CHART','VALIDATION'],'ADVANCED'),
    mos('MOS-PPT-02','MOS PowerPoint Thiết kế slide','PowerPoint',['Layout','Themes','Typography','Images','Shapes','Slide project'],['POWERPOINT','DESIGN','LAYOUT','THEME']),
    mos('MOS-PPT-03','MOS PowerPoint Trình bày nâng cao','PowerPoint',['Master slides','Charts','SmartArt','Animation','Transitions','Presentation project'],['POWERPOINT','MASTER','ANIMATION','PRESENTATION'],'ADVANCED'),
    mos('MOS-OFFICE-01','MOS Office Workflow','Word/Excel/PowerPoint',['Word document','Excel data','PowerPoint report','Copy and link data','Integrated workflow','Office project'],['MOS','WORKFLOW','WORD','EXCEL','POWERPOINT']),
    mos('MOS-MOCK-02','MOS Full Skills Simulation','Office',['Word simulation','Excel simulation','PowerPoint simulation','Timed tasks','Error review','Full MOS mock'],['MOS','SIMULATION','PRACTICAL'])
];

const RICH_COURSES = [...RICH_IT_COURSES, ...RICH_TOEIC_COURSES, ...RICH_IELTS_COURSES, ...RICH_MOS_COURSES];
module.exports = { RICH_IT_COURSES, RICH_TOEIC_COURSES, RICH_IELTS_COURSES, RICH_MOS_COURSES, RICH_COURSES };
