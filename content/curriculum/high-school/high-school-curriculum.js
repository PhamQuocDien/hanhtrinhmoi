'use strict';

// Curriculum scaffold for grades 10-12. It maps broad competencies from the
// 2018 GDPT framework; it is not a copy of any publisher's textbook and needs
// teacher review before being published to learners.
const primary = require('../primary/primary-curriculum');
const { OFFICIAL_REFERENCES, buildLessonAlignment } = require('../curriculum-alignment');
const questionBank = require('../../question-banks/lower-secondary/question-bank');
const { createLessonQualityProfile } = require('../../quality/learning-quality');
const { buildSchoolTheory } = require('../../quality/theory-content');
const PROGRAMS = primary.PROGRAMS;

const SUBJECTS = {
  math: { name: 'Toán', icon: '➗', color: 'blue', required: true, strands: ['Đại số và hàm số', 'Hình học và đo lường', 'Thống kê và xác suất'] },
  literature: { name: 'Ngữ văn', icon: '📚', color: 'rose', required: true, strands: ['Đọc hiểu văn bản', 'Tiếng Việt và thực hành tiếng Việt', 'Viết và nói nghe'] },
  english: { name: 'Ngoại ngữ 1 (Tiếng Anh)', icon: '🔤', color: 'purple', required: true, strands: ['Giao tiếp và từ vựng', 'Ngữ pháp trong ngữ cảnh', 'Đọc, viết và trình bày'] },
  history: { name: 'Lịch sử', icon: '🏛️', color: 'orange', required: true, strands: ['Lịch sử thế giới', 'Lịch sử khu vực', 'Lịch sử Việt Nam và chuyên đề'] },
  pe: { name: 'Giáo dục thể chất', icon: '🏃', color: 'lime', required: true, strands: ['Thể lực và vận động', 'Kĩ thuật vận động', 'An toàn và tự rèn luyện'] },
  national_defense: { name: 'Giáo dục quốc phòng và an ninh', icon: '🛡️', color: 'slate', required: true, strands: ['Kiến thức quốc phòng', 'An ninh và pháp luật', 'Kĩ năng, trách nhiệm công dân'] },
  experience: { name: 'Hoạt động trải nghiệm, hướng nghiệp', icon: '🧭', color: 'orange', required: true, strands: ['Phát triển bản thân', 'Cộng đồng và môi trường', 'Định hướng nghề nghiệp'] },
  local_education: { name: 'Nội dung giáo dục của địa phương', icon: '📍', color: 'green', required: true, strands: ['Văn hóa và lịch sử địa phương', 'Địa lí, kinh tế và xã hội', 'Dự án cộng đồng'] },
  geography: { name: 'Địa lí', icon: '🌏', color: 'green', required: false, strands: ['Địa lí tự nhiên', 'Địa lí dân cư và kinh tế', 'Phát triển bền vững'] },
  economics_law: { name: 'Giáo dục kinh tế và pháp luật', icon: '⚖️', color: 'blue', required: false, strands: ['Kinh tế và lựa chọn', 'Pháp luật và quyền công dân', 'Ứng dụng trong đời sống'] },
  physics: { name: 'Vật lí', icon: '⚛️', color: 'cyan', required: false, strands: ['Mô hình và đại lượng vật lí', 'Năng lượng và tương tác', 'Thực nghiệm và vận dụng'] },
  chemistry: { name: 'Hóa học', icon: '🧪', color: 'purple', required: false, strands: ['Cấu tạo chất', 'Phản ứng và biến đổi hóa học', 'Hóa học trong đời sống'] },
  biology: { name: 'Sinh học', icon: '🧬', color: 'green', required: false, strands: ['Tổ chức thế giới sống', 'Di truyền và tiến hóa', 'Sinh thái và ứng dụng'] },
  technology: { name: 'Công nghệ', icon: '⚙️', color: 'slate', required: false, strands: ['Thiết kế và hệ thống kĩ thuật', 'Công nghệ trong sản xuất', 'Đánh giá giải pháp công nghệ'] },
  ict: { name: 'Tin học', icon: '💻', color: 'cyan', required: false, strands: ['Dữ liệu và hệ thống số', 'Thuật toán và lập trình', 'Mạng, an toàn và ứng dụng'] },
  music: { name: 'Âm nhạc', icon: '🎵', color: 'purple', required: false, strands: ['Nghe và cảm thụ', 'Thực hành âm nhạc', 'Sáng tạo và trình bày'] },
  art: { name: 'Mĩ thuật', icon: '🎨', color: 'pink', required: false, strands: ['Ngôn ngữ tạo hình', 'Sáng tạo sản phẩm', 'Phân tích và ứng dụng'] }
};

const TOPICS = {
  math: {
    10: [['Mệnh đề và tập hợp', 'Mệnh đề toán học và phủ định', 'Tập hợp và các phép toán'], ['Hàm số', 'Hàm số và đồ thị', 'Hàm số bậc hai'], ['Phương trình và bất phương trình', 'Phương trình quy về bậc hai', 'Dấu của tam thức bậc hai'], ['Hình học và dữ liệu', 'Hệ thức lượng trong tam giác', 'Vectơ, thống kê và xác suất']],
    11: [['Hàm số lượng giác', 'Góc lượng giác và giá trị lượng giác', 'Đồ thị hàm số lượng giác'], ['Dãy số', 'Dãy số và quy luật', 'Cấp số cộng và cấp số nhân'], ['Giới hạn và đạo hàm', 'Giới hạn của dãy số và hàm số', 'Đạo hàm và ý nghĩa'], ['Hình học không gian và xác suất', 'Quan hệ song song, vuông góc', 'Xác suất và biến cố']],
    12: [['Ứng dụng đạo hàm', 'Tính đơn điệu và cực trị', 'Tiệm cận và khảo sát hàm số'], ['Mũ và logarit', 'Lũy thừa và hàm số mũ', 'Logarit và phương trình mũ logarit'], ['Nguyên hàm và tích phân', 'Nguyên hàm và tích phân', 'Ứng dụng tích phân'], ['Hình học và xác suất', 'Vectơ và tọa độ trong không gian', 'Xác suất có điều kiện và ôn tập tổng hợp']]
  },
  literature: {
    10: [['Đọc hiểu văn bản', 'Đọc hiểu truyện và kí', 'Đọc hiểu thơ và văn bản nghị luận'], ['Tiếng Việt', 'Ngôn ngữ nói và ngôn ngữ viết', 'Biện pháp tu từ và tác dụng'], ['Viết', 'Viết bài nghị luận xã hội', 'Viết bài phân tích tác phẩm'], ['Nói, nghe và dự án', 'Thuyết trình một vấn đề', 'Đọc mở rộng và phản hồi văn bản']],
    11: [['Văn bản và thể loại', 'Đặc trưng truyện và thơ', 'Văn bản thông tin và nghị luận'], ['Thực hành tiếng Việt', 'Đặc điểm ngôn ngữ và ngữ cảnh', 'Liên kết, mạch lạc và lập luận'], ['Viết nghị luận', 'Phân tích tác phẩm văn học', 'Nghị luận về vấn đề xã hội'], ['Trình bày và nghiên cứu', 'Trình bày kết quả đọc', 'Dự án tìm hiểu tác giả, tác phẩm']],
    12: [['Đọc hiểu chuyên sâu', 'Giá trị nội dung và nghệ thuật', 'Quan điểm, giọng điệu và cấu trúc'], ['Tiếng Việt và lập luận', 'Phong cách ngôn ngữ và hiệu quả biểu đạt', 'Lập luận và bằng chứng'], ['Tạo lập văn bản', 'Nghị luận về văn học', 'Nghị luận về vấn đề thực tiễn'], ['Tổng hợp và định hướng', 'Đọc hiểu văn bản mới', 'Thực hành viết và tự đánh giá']]
  },
  english: {
    10: [['Identity and community', 'Personal identity and relationships', 'Community and volunteering'], ['Learning and technology', 'Study habits and digital learning', 'Technology in daily life'], ['Environment and society', 'Protecting the environment', 'Responsible tourism and culture'], ['Communication skills', 'Grammar in context', 'Reading, writing and presentation']],
    11: [['Global issues', 'Healthy lifestyles', 'Generations and relationships'], ['Future and innovation', 'Education and career choices', 'Science and technology'], ['Culture and environment', 'Preserving cultural heritage', 'Climate and sustainable living'], ['Academic communication', 'Reading for evidence', 'Writing and giving presentations']],
    12: [['Life choices', 'Lifelong learning and career', 'Global citizenship'], ['Social challenges', 'Urbanisation and social change', 'The world of work'], ['Science and sustainability', 'Artificial intelligence and society', 'Environmental responsibility'], ['Exam skills', 'Reading inference and evidence', 'Writing and speaking practice']]
  },
  history: {
    10: [['Lịch sử và sử học', 'Hiện thực lịch sử và nhận thức lịch sử', 'Sử liệu và phương pháp nghiên cứu'], ['Văn minh thế giới', 'Một số nền văn minh phương Đông', 'Văn minh phương Tây'], ['Các cuộc cách mạng', 'Cách mạng công nghiệp', 'Biến đổi kinh tế và xã hội'], ['Khu vực và Việt Nam', 'Đông Nam Á trong lịch sử', 'Truyền thống và lịch sử Việt Nam']],
    11: [['Thế giới cận đại', 'Các cuộc cách mạng tư sản', 'Chủ nghĩa tư bản và phong trào công nhân'], ['Châu Á và khu vực', 'Cải cách và chuyển biến ở châu Á', 'Đông Nam Á thời cận đại'], ['Việt Nam', 'Việt Nam từ thế kỉ XIX', 'Phong trào đấu tranh và chuyển biến xã hội'], ['Lịch sử hiện đại', 'Chiến tranh và trật tự thế giới', 'Nguồn sử liệu và tư duy lịch sử']],
    12: [['Thế giới thế kỉ XX', 'Trật tự thế giới hiện đại', 'Hợp tác và xung đột quốc tế'], ['Việt Nam hiện đại', 'Cách mạng và kháng chiến', 'Xây dựng và phát triển đất nước'], ['Đổi mới và hội nhập', 'Đổi mới kinh tế xã hội', 'Việt Nam trong hội nhập quốc tế'], ['Chuyên đề lịch sử', 'Phân tích tư liệu lịch sử', 'Dự án lịch sử địa phương']]
  }
};

const GENERIC_BY_SUBJECT = {
  pe: ['Nền tảng vận động và thể lực', 'Kĩ thuật và chiến thuật vận động', 'Sức khỏe, an toàn và phục hồi', 'Kế hoạch rèn luyện cá nhân'],
  national_defense: ['Nhận thức quốc phòng và an ninh', 'Pháp luật và trách nhiệm công dân', 'Kĩ năng bảo đảm an toàn', 'Vận dụng kiến thức vào tình huống'],
  experience: ['Nhận diện bản thân và mục tiêu', 'Kĩ năng học tập và giao tiếp', 'Cộng đồng và trách nhiệm', 'Khám phá nghề nghiệp và kế hoạch tương lai'],
  local_education: ['Lịch sử và văn hóa địa phương', 'Địa lí và môi trường địa phương', 'Kinh tế và xã hội địa phương', 'Dự án tìm hiểu địa phương'],
  geography: ['Địa lí tự nhiên và môi trường', 'Dân cư và các hoạt động kinh tế', 'Không gian khu vực và toàn cầu', 'Tài nguyên và phát triển bền vững'],
  economics_law: ['Kinh tế và lựa chọn', 'Thị trường và hoạt động kinh tế', 'Pháp luật và quyền công dân', 'Ra quyết định có trách nhiệm'],
  physics: ['Đại lượng và phép đo', 'Chuyển động và tương tác', 'Năng lượng và các quá trình vật lí', 'Thực nghiệm và mô hình hóa'],
  chemistry: ['Cấu tạo nguyên tử và liên kết', 'Phản ứng và tốc độ phản ứng', 'Chất và chuyển hóa hóa học', 'Hóa học với sức khỏe và môi trường'],
  biology: ['Tổ chức và chức năng của sự sống', 'Sinh học tế bào và cơ thể', 'Di truyền và tiến hóa', 'Sinh thái và ứng dụng sinh học'],
  technology: ['Thiết kế kĩ thuật và tiêu chí', 'Hệ thống và quy trình công nghệ', 'Đánh giá sản phẩm công nghệ', 'Công nghệ và phát triển bền vững'],
  ict: ['Tư duy tin học và dữ liệu', 'Thuật toán và mô hình hóa', 'Lập trình và kiểm thử', 'Mạng, bảo mật và sản phẩm số'],
  music: ['Nghe và phân tích âm nhạc', 'Kĩ thuật thực hành âm nhạc', 'Phong cách và bối cảnh âm nhạc', 'Sáng tạo, biểu diễn và phản hồi'],
  art: ['Ngôn ngữ thị giác và bố cục', 'Chất liệu, kĩ thuật và thực hành', 'Mĩ thuật trong văn hóa và đời sống', 'Dự án sáng tạo và đánh giá']
};

const LESSON_SUFFIXES = {
  math: ['Khái niệm và biểu diễn', 'Quy tắc, tính chất và ví dụ', 'Bài toán vận dụng'],
  literature: ['Nhận diện và đọc hiểu', 'Phân tích bằng dẫn chứng', 'Thực hành tạo lập văn bản'],
  english: ['Vocabulary and context', 'Grammar and communication', 'Integrated practice'],
  history: ['Bối cảnh và khái niệm', 'Nguồn tư liệu và diễn biến', 'Phân tích và đánh giá'],
  physics: ['Khái niệm và đại lượng', 'Mô hình, công thức và thí nghiệm', 'Bài tập vận dụng'],
  chemistry: ['Khái niệm và bản chất', 'Phương trình và quy luật', 'Bài tập và ứng dụng'],
  biology: ['Khái niệm và cấu trúc', 'Cơ chế và bằng chứng', 'Vận dụng và liên hệ'],
  ict: ['Khái niệm và công cụ', 'Quy trình thực hiện', 'Thực hành và kiểm thử']
};

function topicTagFor(subjectCode, title, unitTitle = '') {
  const text = `${title} ${unitTitle}`.toLocaleLowerCase('vi-VN');
  if (subjectCode === 'math') {
    if (/mệnh đề|tập hợp/.test(text)) return 'sets';
    if (/đạo hàm|đơn điệu|cực trị|tiệm cận|khảo sát hàm/.test(text)) return 'derivative';
    if (/nguyên hàm|tích phân/.test(text)) return 'integral';
    if (/mũ|logarit|lũy thừa/.test(text)) return 'exponential-logarithm';
    if (/dãy số|cấp số/.test(text)) return 'sequences';
    if (/giới hạn/.test(text)) return 'limits';
    if (/vectơ|tọa độ/.test(text)) return 'vectors';
    if (/lượng giác/.test(text)) return 'trigonometry';
    if (/xác suất/.test(text)) return 'probability';
    if (/thống kê/.test(text)) return 'statistics';
    if (/bậc hai|parabol/.test(text)) return 'quadratic-functions';
    if (/phương trình|bất phương trình|tam thức/.test(text)) return 'quadratic';
    if (/hàm số/.test(text)) return 'functions';
    if (/hình học|tam giác|đường tròn/.test(text)) return 'triangle';
    return 'algebra';
  }
  if (['literature'].includes(subjectCode)) {
    if (/thơ/.test(text)) return 'poetry';
    if (/nghị luận|lập luận|bằng chứng/.test(text)) return 'argument';
    if (/viết|tạo lập/.test(text)) return 'writing';
    if (/nói|nghe|thuyết trình/.test(text)) return 'speaking';
    if (/tiếng việt|ngôn ngữ|tu từ/.test(text)) return 'language';
    if (/truyện|kí/.test(text)) return 'narrative';
    return 'literary-analysis';
  }
  if (subjectCode === 'english') {
    if (/grammar|ngữ pháp|cấu trúc|condition/.test(text)) return 'grammar';
    if (/career|từ vựng|vocabulary|identity|community/.test(text)) return 'vocabulary';
    if (/reading|đọc hiểu|inference/.test(text)) return 'reading';
    if (/writing|viết/.test(text)) return 'writing';
    if (/speaking|presentation|nói|giao tiếp/.test(text)) return 'speaking';
    return 'communication';
  }
  if (subjectCode === 'history') return /nguồn|sử liệu|phương pháp|tư liệu/.test(text) ? 'historical-sources' : /chiến tranh|thế giới|xung đột/.test(text) ? 'world-wars' : /việt nam|đổi mới|cách mạng|kháng chiến/.test(text) ? 'medieval-vietnam' : 'medieval-world';
  if (subjectCode === 'geography') return /bản đồ|vị trí|lãnh thổ/.test(text) ? 'map-skills' : /môi trường|tài nguyên|bền vững/.test(text) ? 'environment' : 'vietnam-geography';
  if (subjectCode === 'economics_law') return /pháp luật|quyền|nghĩa vụ|công dân/.test(text) ? 'rights' : /môi trường|bền vững/.test(text) ? 'environment' : 'financial-literacy';
  if (subjectCode === 'physics') return /điện|mạch|dòng điện/.test(text) ? 'electricity' : /ánh sáng|quang/.test(text) ? 'optics' : /đo|đại lượng|sai số/.test(text) ? 'measurement' : 'energy';
  if (subjectCode === 'chemistry') return /nguyên tử|liên kết|cấu tạo/.test(text) ? 'atomic-structure' : /tốc độ|cân bằng|động học/.test(text) ? 'reaction-rate' : /phản ứng|chuyển hóa/.test(text) ? 'chemical-reaction' : 'matter';
  if (subjectCode === 'biology') return /di truyền|gen|nhiễm sắc thể/.test(text) ? 'genetics' : /sinh thái|môi trường/.test(text) ? 'ecosystem' : /tế bào/.test(text) ? 'cells' : 'biology-systems';
  if (subjectCode === 'ict') return /mạng|bảo mật|an toàn/.test(text) ? 'digital-safety' : /thuật toán|mô hình/.test(text) ? 'algorithms' : /lập trình|kiểm thử/.test(text) ? 'programming' : 'spreadsheets';
  if (subjectCode === 'technology') return /thiết kế|hệ thống|kĩ thuật/.test(text) ? 'engineering-design' : 'materials';
  if (subjectCode === 'pe') return 'fitness';
  if (subjectCode === 'experience') return 'career-planning';
  if (subjectCode === 'national_defense') return 'digital-safety';
  if (subjectCode === 'music') return 'music-analysis';
  if (subjectCode === 'art') return 'visual-art';
  if (subjectCode === 'local_education') return 'historical-sources';
  return 'reading';
}

function normalizeGrade(value) { const grade = Number(value); return Number.isInteger(grade) && grade >= 10 && grade <= 12 ? grade : null; }
function normalizeProgram(code) { return primary.normalizeProgram(code); }
function subjectsForGrade(grade) { return normalizeGrade(grade) ? Object.entries(SUBJECTS).map(([code, value]) => ({ code, ...value, gradeBands: [10, 11, 12] })) : []; }
function makeLesson(grade, program, subject, unit, unitIndex, title, topicIndex) {
  const lessonIndex = unitIndex * 3 + topicIndex + 1;
  const id = `${program.code}-g${grade}-${subject.code}-u${unitIndex + 1}-l${topicIndex + 1}`;
  const alignment = buildLessonAlignment({ grade, subjectCode: subject.code, title, unitTitle: unit.title });
  const resolvedTopicTag = topicTagFor(subject.code, title, unit.title);
  const objective = `${alignment.intendedOutcomes[0]} ${alignment.intendedOutcomes[1]}`;
  const partMeta = [{ id: 'theory', title: 'Lý thuyết cốt lõi' }, { id: 'lecture', title: 'Bài giảng và ví dụ mẫu' }, { id: 'guided-practice', title: 'Luyện tập có hướng dẫn' }, { id: 'independent-practice', title: 'Tự luyện và vận dụng' }];
  const meta = { id, title, topicTag: resolvedTopicTag, grade, subjectCode: subject.code, subjectName: subject.name, unitTitle: unit.title, programCode: program.code, objective, alignment, parts: partMeta };
  const pool = questionBank.buildQuestionPool({ programCode: program.code, grade, subjectCode: subject.code, lesson: meta });
  const checkpoints = pool.filter((item) => item.purpose === 'checkpoint');
  const checkpointFor = (partId) => checkpoints.filter((item) => item.partId === partId).slice(0, 2);
  const theory = buildSchoolTheory({ grade, subjectCode: subject.code, subjectName: subject.name, title, unitTitle: unit.title, objective, educationLevel: 'trung học phổ thông' });
  const workedExample = theory.sections.find((item) => item.id === 'worked-example')?.body || theory.summary;
  const parts = [
    { id: 'theory', title: 'Lý thuyết cốt lõi', kind: 'theory', durationMinutes: 10, content: theory.quickReview, checkpoint: checkpointFor('theory') },
    { id: 'lecture', title: 'Bài giảng và ví dụ mẫu', kind: 'lecture', durationMinutes: 10, content: `**Ví dụ có hướng dẫn: ${title}.**\n\n${workedExample}\n\nHãy chỉ ra giả định, điều kiện áp dụng và kiểm tra xem kết luận có theo đúng dữ kiện hay không.`, checkpoint: checkpointFor('lecture') },
    { id: 'guided-practice', title: 'Luyện tập có hướng dẫn', kind: 'guided-practice', durationMinutes: 10, content: `Thực hành có hướng dẫn về “${title}”: phân tích dữ kiện, chọn phương pháp, trình bày bước giải hoặc dẫn chứng, đối chiếu đáp án và giải thích vì sao cách làm phù hợp.`, checkpoint: checkpointFor('guided-practice') },
    { id: 'independent-practice', title: 'Tự luyện và vận dụng', kind: 'independent-practice', durationMinutes: 15, content: `Tự giải nhiệm vụ gắn với “${title}”. Học sinh cần nêu lập luận, dẫn chứng hoặc các bước thực hiện; sau đó tự đánh giá theo tiêu chí và hoàn thành kiểm tra nhanh để lưu tiến độ.`, checkpoint: checkpointFor('independent-practice') }
  ];
  return { id, title, sequence: lessonIndex, estimatedMinutes: 45, objective, topicTag: resolvedTopicTag, theory, parts, alignment, qualityProfile: createLessonQualityProfile({ level: 'school', grade, subjectCode: subject.code, lesson: { id, title, objective, alignment, parts }, hasCodeLab: subject.code === 'ict' }), assessmentQuestions: pool.filter((item) => item.purpose === 'assessment').map((item) => ({ ...item, points: 100 / 8 })), contentStatus: 'draft-teacher-review-required', provenance: 'Khung học tập tham chiếu Chương trình GDPT 2018 cấp THPT; giáo viên cần rà soát yêu cầu cần đạt, tổ hợp môn, chuyên đề và sách giáo khoa hiện hành.' };
}
function buildCourse(gradeValue, programCode, subjectCode) {
  const grade = normalizeGrade(gradeValue);
  const program = normalizeProgram(programCode);
  const meta = SUBJECTS[subjectCode];
  if (!grade || !program || !meta) return null;
  const subject = { code: subjectCode, ...meta, gradeBands: [10, 11, 12] };
  const gradeTopics = TOPICS[subjectCode]?.[grade];
  const unitTopics = gradeTopics || GENERIC_BY_SUBJECT[subjectCode].map((title) => [title, `${title}: kiến thức nền tảng`, `${title}: phân tích ví dụ và bằng chứng`, `${title}: thực hành và vận dụng`]);
  const units = unitTopics.map((entry, unitIndex) => {
    const unitTitle = entry[0];
    const titles = entry.slice(1).flat().filter((title) => typeof title === 'string');
    while (titles.length < 3) {
      const next = titles.length + 1;
      titles.push(`${unitTitle}: thực hành, vận dụng và tự đánh giá (${next})`);
    }
    const unit = { id: `${program.code}-g${grade}-${subject.code}-u${unitIndex + 1}`, title: unitTitle, sequence: unitIndex + 1 };
    return { ...unit, lessons: titles.slice(0, 3).map((title, lessonIndex) => makeLesson(grade, program, subject, unit, unitIndex, title, lessonIndex)) };
  });
  return { id: `${program.code}-g${grade}-${subject.code}`, grade, programCode: program.code, programName: program.name, approach: program.approach, subjectCode: subject.code, subjectName: subject.name, subjectIcon: subject.icon, optional: !subject.required, required: subject.required, units, lessonCount: units.reduce((n, unit) => n + unit.lessons.length, 0), contentStatus: 'draft-teacher-review-required', educationLevel: 'high-school', curriculumReferences: OFFICIAL_REFERENCES, alignmentStatus: 'draft-framework-mapped-teacher-validation-required' };
}
function buildCatalog(gradeValue, programCode) {
  const grade = normalizeGrade(gradeValue);
  const program = normalizeProgram(programCode);
  if (!grade || !program) return null;
  const courses = subjectsForGrade(grade).map((subject) => buildCourse(grade, program.code, subject.code)).filter(Boolean);
  return { grade, program, educationLevel: 'high-school', curriculumFramework: 'Chương trình Giáo dục phổ thông 2018 cấp THPT (văn bản hợp nhất); môn lựa chọn cần đối chiếu tổ hợp môn/kế hoạch giáo dục của trường.', curriculumReferences: OFFICIAL_REFERENCES, alignmentStatus: 'draft-framework-mapped-teacher-validation-required', courses, totals: { subjects: courses.length, units: courses.reduce((n, course) => n + course.units.length, 0), lessons: courses.reduce((n, course) => n + course.lessonCount, 0) } };
}
function findLesson({ grade, programCode, subjectCode, lessonId }) {
  const safeGrade = normalizeGrade(grade);
  const program = normalizeProgram(programCode);
  if (!safeGrade || !program) return null;
  const codes = subjectCode ? [subjectCode] : subjectsForGrade(safeGrade).map((item) => item.code);
  for (const code of codes) {
    const course = buildCourse(safeGrade, program.code, code);
    if (!course) continue;
    for (const unit of course.units) {
      const lesson = unit.lessons.find((item) => item.id === lessonId);
      if (lesson) return { course, unit, lesson };
    }
  }
  return null;
}
function publicQuestion(question) { return primary.publicQuestion(question); }
function publicLesson(lesson) { return primary.publicLesson(lesson); }
function publicCourse(course) { return primary.publicCourse(course); }
module.exports = { SUBJECTS, PROGRAMS, subjectsForGrade, buildCourse, buildCatalog, findLesson, publicQuestion, publicLesson, publicCourse, normalizeGrade, normalizeProgram, topicTagFor };
