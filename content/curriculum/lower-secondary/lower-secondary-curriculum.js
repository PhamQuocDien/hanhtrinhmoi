'use strict';

// Original curriculum scaffold mapped to broad competency strands in the 2018 GDPT framework.
// It is not a transcription of any publisher's textbook; teachers must review lesson-level scope.
const primary = require('../primary/primary-curriculum');
const { OFFICIAL_REFERENCES, buildLessonAlignment } = require('../curriculum-alignment');
const QUESTION_BANK = require('../../question-banks/lower-secondary/question-bank');
const { createLessonQualityProfile } = require('../../quality/learning-quality');
const { buildSchoolTheory } = require('../../quality/theory-content');

const SUBJECTS = {
  math: { name: 'Toán', icon: '➗', required: true, gradeBands: [6, 7, 8, 9] },
  vietnamese: { name: 'Ngữ văn', icon: '📚', required: true, gradeBands: [6, 7, 8, 9] },
  english: { name: 'Tiếng Anh', icon: '🔤', required: true, gradeBands: [6, 7, 8, 9] },
  civic: { name: 'Giáo dục công dân', icon: '🤝', required: true, gradeBands: [6, 7, 8, 9] },
  history_geo: { name: 'Lịch sử và Địa lí', icon: '🌏', required: true, gradeBands: [6, 7, 8, 9] },
  science: { name: 'Khoa học tự nhiên', icon: '🧪', required: true, gradeBands: [6, 7, 8, 9] },
  technology: { name: 'Công nghệ', icon: '⚙️', required: true, gradeBands: [6, 7, 8, 9] },
  ict: { name: 'Tin học', icon: '💻', required: true, gradeBands: [6, 7, 8, 9] },
  arts: { name: 'Nghệ thuật', icon: '🎨', required: true, gradeBands: [6, 7, 8, 9] },
  pe: { name: 'Giáo dục thể chất', icon: '🏃', required: true, gradeBands: [6, 7, 8, 9] },
  experience: { name: 'Hoạt động trải nghiệm, hướng nghiệp', icon: '🌱', required: true, gradeBands: [6, 7, 8, 9] },
  local_education: { name: 'Nội dung giáo dục địa phương', icon: '📍', required: true, gradeBands: [6, 7, 8, 9] }
};

// Four units per grade and three lessons per unit. The curriculum scaffolds cover key strands,
// while the actual order and naming must be reconciled with the school and selected textbook edition.
const PLANS = {
  math: {
    6: [
      ['Số tự nhiên và tính chia hết', [['Tập hợp và cách ghi số tự nhiên', 'natural-numbers'], ['Phép tính và lũy thừa số tự nhiên', 'natural-powers'], ['Ước, bội và dấu hiệu chia hết', 'divisibility']]],
      ['Số nguyên', [['Tập hợp số nguyên và biểu diễn trên trục số', 'integers'], ['So sánh và giá trị tuyệt đối', 'integer-compare'], ['Cộng, trừ, nhân và chia số nguyên', 'integer-operations']]],
      ['Phân số và số thập phân', [['Phân số bằng nhau và rút gọn', 'fractions'], ['So sánh và phép tính với phân số', 'fraction-operations'], ['Số thập phân và phép tính', 'decimals']]],
      ['Hình học trực quan và dữ liệu', [['Điểm, đường thẳng, đoạn thẳng và góc', 'geometry'], ['Chu vi, diện tích và hình có trục đối xứng', 'area-perimeter'], ['Thu thập, biểu diễn và đọc dữ liệu', 'statistics']]]
    ],
    7: [
      ['Số hữu tỉ và số thực', [['Số hữu tỉ và biểu diễn trên trục số', 'rational-numbers'], ['Cộng, trừ, nhân, chia số hữu tỉ', 'rational-operations'], ['Lũy thừa và thứ tự thực hiện phép tính', 'rational-powers']]],
      ['Tỉ lệ và đại lượng', [['Tỉ lệ thức và dãy tỉ số bằng nhau', 'ratios'], ['Đại lượng tỉ lệ thuận và tỉ lệ nghịch', 'proportions'], ['Bài toán thực tế về tỉ lệ', 'ratio-problems']]],
      ['Biểu thức đại số và hình học', [['Biểu thức đại số và giá trị biểu thức', 'algebra'], ['Góc, đường thẳng song song và tam giác', 'angles-triangles'], ['Quan hệ giữa các yếu tố trong tam giác', 'triangle']]],
      ['Dữ liệu và xác suất', [['Thu thập, phân loại và biểu diễn dữ liệu', 'statistics'], ['Số trung bình, trung vị và mốt', 'statistics-centre'], ['Làm quen với xác suất thực nghiệm', 'probability']]]
    ],
    8: [
      ['Đa thức và hằng đẳng thức', [['Đơn thức, đa thức và phép toán', 'polynomials'], ['Hằng đẳng thức đáng nhớ', 'identities'], ['Phân tích đa thức thành nhân tử', 'factorization']]],
      ['Phân thức và phương trình', [['Phân thức đại số và điều kiện xác định', 'rational-expressions'], ['Phương trình bậc nhất một ẩn', 'linear-equations'], ['Giải bài toán bằng cách lập phương trình', 'word-equations']]],
      ['Hàm số và hình học', [['Hàm số và đồ thị', 'functions'], ['Tứ giác và các hình đặc biệt', 'quadrilaterals'], ['Định lí Pythagore và ứng dụng', 'pythagorean']]],
      ['Đồng dạng, thống kê và xác suất', [['Tam giác đồng dạng và tỉ số đồng dạng', 'similarity'], ['Phân tích biểu đồ và bảng số liệu', 'statistics'], ['Xác suất của biến cố đơn giản', 'probability']]]
    ],
    9: [
      ['Căn thức và phương trình', [['Căn bậc hai và căn thức', 'square-roots'], ['Biến đổi biểu thức chứa căn', 'radicals'], ['Phương trình bậc hai một ẩn', 'quadratic-equations']]],
      ['Hàm số và hệ phương trình', [['Hàm số bậc hai và đồ thị parabol', 'quadratic-functions'], ['Hệ hai phương trình bậc nhất hai ẩn', 'systems'], ['Hệ thức Viète và ứng dụng', 'viete']]],
      ['Hệ thức lượng và đường tròn', [['Tỉ số lượng giác của góc nhọn', 'trigonometry'], ['Đường tròn, cung và dây', 'circles'], ['Góc nội tiếp và tiếp tuyến', 'circle-angles']]],
      ['Hình học và dữ liệu', [['Đường tròn ngoại tiếp, nội tiếp tam giác', 'triangle-circles'], ['Thống kê mô tả và phân tích dữ liệu', 'statistics'], ['Xác suất trong mô hình đơn giản', 'probability']]]
    ]
  },
  vietnamese: {
    6: [
      ['Đọc hiểu văn bản', [['Đọc hiểu truyền thuyết và truyện dân gian', 'narrative'], ['Đọc hiểu thơ và hình ảnh thơ', 'poetry'], ['Xác định đề tài, chủ đề và thông điệp', 'reading-comprehension']]],
      ['Tiếng Việt', [['Từ đơn, từ phức và nghĩa của từ', 'word-meaning'], ['Từ ghép, từ láy trong văn cảnh', 'word-formation'], ['Trạng ngữ và cấu tạo câu', 'sentence-structure']]],
      ['Viết', [['Viết bài văn kể lại trải nghiệm', 'narrative-writing'], ['Viết đoạn văn ghi lại cảm xúc về thơ', 'poetry-writing'], ['Tóm tắt văn bản bằng ý chính', 'summary']]],
      ['Nói và nghe', [['Kể lại câu chuyện rõ trình tự', 'speaking'], ['Trình bày ý kiến về một vấn đề gần gũi', 'argument'], ['Lắng nghe và phản hồi có căn cứ', 'discussion']]]
    ],
    7: [
      ['Đọc hiểu văn bản', [['Đọc truyện ngụ ngôn và truyện ngắn', 'narrative'], ['Đọc hiểu thơ bốn, năm chữ và thơ tự do', 'poetry'], ['Nhận biết chất trữ tình và chủ đề', 'reading-comprehension']]],
      ['Tiếng Việt', [['Từ Hán Việt và sắc thái nghĩa', 'word-meaning'], ['Biện pháp tu từ so sánh, nhân hóa, ẩn dụ', 'rhetorical-devices'], ['Thành phần chính và thành phần trạng ngữ', 'sentence-structure']]],
      ['Viết', [['Viết bài văn biểu cảm về con người, sự việc', 'expressive-writing'], ['Viết bài văn nghị luận về vấn đề đời sống', 'argument-writing'], ['Liên kết câu và đoạn trong văn bản', 'paragraph-writing']]],
      ['Nói và nghe', [['Thảo luận về một vấn đề trong đời sống', 'discussion'], ['Tóm tắt ý chính từ bài nói', 'summary'], ['Nêu lí lẽ và bằng chứng phù hợp', 'argument']]]
    ],
    8: [
      ['Đọc hiểu', [['Đọc hiểu truyện lịch sử và truyện hiện đại', 'narrative'], ['Đặc điểm thơ trào phúng và thơ tự do', 'poetry'], ['Phân tích chủ đề, nhân vật và chi tiết', 'reading-comprehension']]],
      ['Tiếng Việt', [['Sắc thái nghĩa của từ trong ngữ cảnh', 'word-meaning'], ['Nghĩa tường minh và hàm ý', 'implication'], ['Câu ghép và quan hệ giữa các vế câu', 'sentence-structure']]],
      ['Viết', [['Viết bài văn phân tích một tác phẩm văn học', 'literary-analysis'], ['Viết bài nghị luận về một vấn đề xã hội', 'argument-writing'], ['Viết văn bản thuyết minh có cấu trúc', 'expository-writing']]],
      ['Nói và nghe', [['Trình bày ý kiến có dẫn chứng', 'argument'], ['Nghe, tóm tắt và đánh giá thông tin', 'summary'], ['Trao đổi và điều chỉnh cách diễn đạt', 'discussion']]]
    ],
    9: [
      ['Đọc hiểu văn học', [['Đọc hiểu truyện và truyện truyền kì', 'narrative'], ['Đọc hiểu thơ và phân tích hình ảnh, giọng điệu', 'poetry'], ['Phân tích chủ đề và thông điệp của tác phẩm', 'literary-analysis']]],
      ['Tiếng Việt', [['Thành phần biệt lập và câu đặc biệt', 'sentence-structure'], ['Liên kết câu, liên kết đoạn và mạch lạc', 'paragraph-writing'], ['Cách dẫn trực tiếp và cách dẫn gián tiếp', 'reported-speech']]],
      ['Viết', [['Viết bài nghị luận về tác phẩm văn học', 'literary-analysis'], ['Viết bài nghị luận xã hội có luận điểm, lí lẽ', 'argument-writing'], ['Viết văn bản thông tin và thuyết minh', 'expository-writing']]],
      ['Nói và nghe', [['Trình bày quan điểm và bảo vệ luận điểm', 'argument'], ['Đánh giá độ tin cậy của thông tin', 'source-evaluation'], ['Phản hồi và thảo luận có văn hóa', 'discussion']]]
    ]
  },
  english: {
    6: [
      ['Personal information and school', [['Introduce yourself and your school', 'basic-communication'], ['Present simple for routines', 'present-simple'], ['Question words and short answers', 'question-forms']]],
      ['Home and community', [['There is / there are', 'there-be'], ['Prepositions of place', 'prepositions'], ['Countable and uncountable nouns', 'countable-nouns']]],
      ['Activities and time', [['Present continuous', 'present-continuous'], ['Adverbs of frequency', 'present-simple'], ['Everyday instructions and requests', 'modal-verbs']]],
      ['Reading and writing', [['Identify the main idea in a short text', 'reading'], ['Write a short paragraph about a routine', 'paragraph-writing'], ['Use and / but / because to connect ideas', 'connectors']]]
    ],
    7: [
      ['People and places', [['Comparative adjectives', 'comparatives'], ['Superlative adjectives', 'superlatives'], ['Describe places with suitable adjectives', 'vocabulary-context']]],
      ['Health and habits', [['Should and should not for advice', 'modal-verbs'], ['Simple past for finished actions', 'past-simple'], ['Time expressions in past events', 'past-simple']]],
      ['Nature and travel', [['Future plans with will and be going to', 'future-forms'], ['Prepositions of movement', 'prepositions'], ['Reading for specific details', 'reading']]],
      ['Communication', [['Write an informal email', 'email-writing'], ['Use connectors to explain reasons', 'connectors'], ['Ask for and give information politely', 'basic-communication']]]
    ],
    8: [
      ['Grammar for daily communication', [['Present perfect with ever and never', 'present-perfect'], ['Past continuous and past simple', 'past-continuous'], ['First conditional for possible results', 'conditionals']]],
      ['People and society', [['Relative clauses with who, which and that', 'relative-clauses'], ['Gerunds and infinitives after common verbs', 'gerunds-infinitives'], ['Vocabulary from context', 'vocabulary-context']]],
      ['Science and environment', [['Passive voice in present and past', 'passive-voice'], ['Reported statements', 'reported-speech'], ['Express opinions with reasons', 'opinion-writing']]],
      ['Reading and writing', [['Find claims and supporting details', 'reading'], ['Write a short opinion paragraph', 'paragraph-writing'], ['Review grammar in a connected text', 'grammar-review']]]
    ],
    9: [
      ['Tenses and clauses', [['Present perfect and past simple contrast', 'present-perfect'], ['Reported speech and tense changes', 'reported-speech'], ['Defining relative clauses', 'relative-clauses']]],
      ['Conditionals and passive voice', [['First and second conditional', 'conditionals'], ['Passive voice across common tenses', 'passive-voice'], ['Modal verbs for obligation and advice', 'modal-verbs']]],
      ['Communication and careers', [['Formal email and application language', 'email-writing'], ['Giving evidence for an opinion', 'opinion-writing'], ['Vocabulary in context for work and study', 'vocabulary-context']]],
      ['Exam skills', [['Skim and scan a reading passage', 'reading'], ['Recognize common grammar distractors', 'grammar-review'], ['Edit a paragraph for clarity', 'paragraph-writing']]]
    ]
  },
  science: {
    6: [
      ['Khoa học và phép đo', [['An toàn trong phòng thực hành', 'science-safety'], ['Đo chiều dài, thời gian và nhiệt độ', 'measurement'], ['Tế bào và kính hiển vi', 'cells']]],
      ['Chất quanh ta', [['Thể rắn, lỏng, khí và sự chuyển thể', 'states-of-matter'], ['Oxygen, không khí và sự cháy', 'air-oxygen'], ['Hỗn hợp và tách chất', 'mixtures']]],
      ['Sinh vật', [['Tế bào là đơn vị cơ bản của sự sống', 'cells'], ['Đa dạng thế giới sống', 'biodiversity'], ['Khóa lưỡng phân và phân loại sinh vật', 'classification']]],
      ['Lực, năng lượng và Trái Đất', [['Lực và tác dụng của lực', 'forces'], ['Năng lượng và sự truyền năng lượng', 'energy'], ['Mặt Trời, Mặt Trăng và hệ Mặt Trời', 'solar-system']]]
    ],
    7: [
      ['Nguyên tử và chất', [['Nguyên tử và nguyên tố hóa học', 'atoms'], ['Phân tử và liên kết trong chất', 'molecules'], ['Tốc độ và đo tốc độ', 'speed']]],
      ['Âm thanh và ánh sáng', [['Sự truyền âm và độ cao của âm', 'sound'], ['Phản xạ âm và ô nhiễm tiếng ồn', 'sound'], ['Ánh sáng, tia sáng và phản xạ ánh sáng', 'light']]],
      ['Trao đổi chất và sinh vật', [['Quang hợp ở thực vật', 'photosynthesis'], ['Hô hấp tế bào và trao đổi chất', 'cellular-respiration'], ['Trao đổi chất và chuyển hóa năng lượng', 'metabolism']]],
      ['Từ, lực và môi trường', [['Nam châm và từ trường', 'magnetism'], ['Vai trò của nước và chất dinh dưỡng', 'ecosystem'], ['Sinh trưởng, phát triển và môi trường', 'ecosystem']]]
    ],
    8: [
      ['Phản ứng và chất', [['Biến đổi vật lí và biến đổi hóa học', 'chemical-change'], ['Phản ứng hóa học và định luật bảo toàn', 'chemical-reaction'], ['Acid, base và thang pH', 'acids-bases']]],
      ['Cơ thể người', [['Hệ vận động và sức khỏe xương khớp', 'human-body'], ['Tiêu hóa, dinh dưỡng và vệ sinh', 'human-body'], ['Máu, tuần hoàn và hô hấp', 'human-body']]],
      ['Điện và nhiệt', [['Dòng điện và mạch điện đơn giản', 'electricity'], ['Tác dụng của dòng điện', 'electricity'], ['Truyền nhiệt và ứng dụng', 'heat']]],
      ['Sinh thái và môi trường', [['Quần thể, quần xã và hệ sinh thái', 'ecosystem'], ['Chuỗi thức ăn và lưới thức ăn', 'food-web'], ['Bảo vệ môi trường và tài nguyên', 'environment']]]
    ],
    9: [
      ['Nguyên tử và phản ứng hóa học', [['Bảng tuần hoàn các nguyên tố hóa học', 'periodic-table'], ['Liên kết hóa học cơ bản', 'chemical-bond'], ['Tốc độ phản ứng và chất xúc tác', 'reaction-rate']]],
      ['Kim loại và hợp chất', [['Tính chất chung của kim loại', 'metals'], ['Acid, base, oxide và muối', 'acids-bases'], ['Hợp chất hữu cơ và hydrocarbon', 'organic-chemistry']]],
      ['Vật lí trong đời sống', [['Công, công suất và cơ năng', 'work-energy'], ['Dòng điện, điện trở và định luật Ohm', 'electricity'], ['Thấu kính và tạo ảnh', 'optics']]],
      ['Di truyền và hệ sinh thái', [['DNA, gene và nhiễm sắc thể', 'genetics'], ['Di truyền và biến dị', 'genetics'], ['Dòng năng lượng trong hệ sinh thái', 'ecosystem']]]
    ]
  },
  history_geo: {
    6: [
      ['Lịch sử và tư liệu', [['Lịch sử và các nguồn tư liệu', 'historical-sources'], ['Xã hội nguyên thủy', 'prehistory'], ['Ai Cập và Lưỡng Hà cổ đại', 'ancient-civilizations']]],
      ['Thế giới cổ đại', [['Ấn Độ và Trung Quốc cổ đại', 'ancient-civilizations'], ['Hy Lạp và La Mã cổ đại', 'classical-civilizations'], ['Các thành tựu văn hóa cổ đại', 'historical-culture']]],
      ['Việt Nam thời dựng nước', [['Văn Lang và Âu Lạc', 'early-vietnam'], ['Đời sống cư dân Việt cổ', 'early-vietnam'], ['Đấu tranh chống Bắc thuộc thời đầu', 'early-vietnam']]],
      ['Địa lí cơ bản', [['Bản đồ và lược đồ', 'map-skills'], ['Trái Đất và chuyển động', 'earth'], ['Các thành phần tự nhiên của Trái Đất', 'physical-geography']]]
    ],
    7: [
      ['Thế giới trung đại', [['Tây Âu từ thế kỉ V đến thế kỉ XVI', 'medieval-world'], ['Phong kiến phương Đông', 'medieval-world'], ['Các cuộc phát kiến địa lí', 'world-exploration']]],
      ['Việt Nam thời phong kiến', [['Các triều đại đầu thời độc lập', 'medieval-vietnam'], ['Đại Việt thời Lý, Trần và kháng chiến', 'medieval-vietnam'], ['Văn hóa Đại Việt', 'medieval-vietnam']]],
      ['Địa lí châu Á', [['Vị trí và đặc điểm tự nhiên châu Á', 'asia-geography'], ['Dân cư và các khu vực châu Á', 'population'], ['Kinh tế và đô thị ở châu Á', 'economic-geography']]],
      ['Thiên nhiên và con người', [['Khí hậu và các đới thiên nhiên', 'climate'], ['Sông, hồ và tài nguyên nước', 'water-resources'], ['Tác động của con người tới môi trường', 'environment']]]
    ],
    8: [
      ['Thế giới từ thế kỉ XVI đến XIX', [['Phong trào Phục hưng và cải cách tôn giáo', 'early-modern-world'], ['Cách mạng tư sản và cách mạng công nghiệp', 'industrial-revolution'], ['Chủ nghĩa thực dân và biến đổi thế giới', 'colonialism']]],
      ['Việt Nam từ thế kỉ XVI đến XIX', [['Đàng Trong, Đàng Ngoài và chuyển biến xã hội', 'early-modern-vietnam'], ['Phong trào Tây Sơn', 'tay-son'], ['Nhà Nguyễn và biến đổi đầu thế kỉ XIX', 'nguyen-dynasty']]],
      ['Địa lí châu Á và châu Phi', [['Đặc điểm tự nhiên châu Phi', 'africa-geography'], ['Dân cư, đô thị và kinh tế châu Phi', 'population'], ['Tài nguyên và phát triển bền vững', 'resources']]],
      ['Châu Mỹ và châu Đại Dương', [['Tự nhiên và dân cư châu Mỹ', 'americas-geography'], ['Các khu vực kinh tế tiêu biểu', 'economic-geography'], ['Toàn cầu hóa và giao lưu khu vực', 'globalization']]]
    ],
    9: [
      ['Thế giới hiện đại', [['Chiến tranh thế giới thứ nhất và hệ quả', 'world-wars'], ['Cách mạng tháng Mười Nga và biến đổi xã hội', 'modern-world'], ['Chiến tranh thế giới thứ hai', 'world-wars']]],
      ['Việt Nam thế kỉ XX', [['Việt Nam đầu thế kỉ XX', 'modern-vietnam'], ['Cách mạng tháng Tám và sự ra đời của nước Việt Nam Dân chủ Cộng hòa', 'modern-vietnam'], ['Kháng chiến và xây dựng đất nước', 'modern-vietnam']]],
      ['Địa lí Việt Nam', [['Vị trí, lãnh thổ và địa hình Việt Nam', 'vietnam-geography'], ['Khí hậu, sông ngòi và tài nguyên', 'vietnam-geography'], ['Dân cư và phân bố dân cư', 'population']]],
      ['Vùng kinh tế và phát triển', [['Các vùng kinh tế và thế mạnh', 'economic-regions'], ['Đô thị hóa, công nghiệp và dịch vụ', 'economic-geography'], ['Phát triển bền vững và bảo vệ chủ quyền', 'sustainable-development']]]
    ]
  },
  civic: {
    6: [
      ['Tự chăm sóc và tự chủ', [['Tự hào về truyền thống gia đình, dòng họ', 'family-traditions'], ['Yêu thương con người', 'empathy'], ['Siêng năng, kiên trì', 'perseverance']]],
      ['Ứng xử và cộng đồng', [['Tôn trọng sự thật', 'honesty'], ['Tự lập trong học tập và sinh hoạt', 'independence'], ['Tôn trọng người khác', 'respect']]],
      ['Quyền và an toàn', [['Tự nhận thức bản thân', 'self-awareness'], ['Ứng phó với tình huống nguy hiểm', 'safety'], ['Tiết kiệm và sử dụng tài nguyên', 'saving']]],
      ['Công dân và môi trường', [['Công dân với cộng đồng', 'community'], ['Bảo vệ môi trường và tài nguyên thiên nhiên', 'environment'], ['Quyền, nghĩa vụ trong tình huống gần gũi', 'rights-responsibilities']]]
    ],
    7: [
      ['Đạo đức cá nhân', [['Tự hào về truyền thống quê hương', 'local-traditions'], ['Quan tâm, cảm thông và chia sẻ', 'empathy'], ['Học tập tự giác, tích cực', 'self-study']]],
      ['Quản lí bản thân', [['Giữ chữ tín', 'trustworthiness'], ['Bảo tồn di sản văn hóa', 'cultural-heritage'], ['Ứng phó với tâm lí căng thẳng', 'stress-management']]],
      ['Ứng xử xã hội', [['Phòng, chống bạo lực học đường', 'school-safety'], ['Quản lí tiền', 'financial-literacy'], ['Phòng chống tệ nạn xã hội', 'social-safety']]],
      ['Pháp luật và trách nhiệm', [['Quyền và nghĩa vụ của công dân', 'rights-responsibilities'], ['Bảo vệ môi trường', 'environment'], ['Ứng xử có trách nhiệm trong cộng đồng', 'community']]]
    ],
    8: [
      ['Tôn trọng và trách nhiệm', [['Tôn trọng sự đa dạng của các dân tộc', 'diversity'], ['Lao động cần cù, sáng tạo', 'work-ethic'], ['Bảo vệ lẽ phải', 'justice']]],
      ['Kinh tế và pháp luật', [['Lập kế hoạch chi tiêu', 'financial-literacy'], ['Phòng ngừa tai nạn, vũ khí và chất nguy hiểm', 'safety'], ['Phòng, chống bạo lực gia đình', 'family-safety']]],
      ['Văn hóa và xã hội', [['Xác định mục tiêu cá nhân', 'goal-setting'], ['Tôn trọng tài sản của người khác', 'property-rights'], ['Lập kế hoạch học tập và nghề nghiệp', 'career-planning']]],
      ['Công dân tích cực', [['Phòng ngừa rủi ro trong môi trường số', 'digital-citizenship'], ['Bảo vệ môi trường và tài nguyên', 'environment'], ['Tham gia hoạt động cộng đồng', 'community']]]
    ],
    9: [
      ['Đạo đức và lựa chọn', [['Sống có lí tưởng', 'life-purpose'], ['Khoan dung và tôn trọng khác biệt', 'diversity'], ['Tích cực tham gia hoạt động cộng đồng', 'community']]],
      ['Kinh tế cá nhân', [['Quản lí tài chính cá nhân', 'financial-literacy'], ['Tiêu dùng có trách nhiệm', 'responsible-consumption'], ['Khởi nghiệp và ý tưởng kinh doanh phù hợp', 'entrepreneurship']]],
      ['Pháp luật', [['Quyền tự do cơ bản và trách nhiệm pháp lí', 'legal-responsibility'], ['Quyền và nghĩa vụ trong gia đình', 'family-rights'], ['Thực hiện pháp luật trong đời sống', 'law-in-life']]],
      ['Công dân và tương lai', [['Bảo vệ hòa bình và hợp tác', 'peace'], ['Định hướng nghề nghiệp và trách nhiệm lao động', 'career-planning'], ['Bảo vệ môi trường và phát triển bền vững', 'environment']]]
    ]
  },
  ict: {
    6: [
      ['Máy tính và cộng đồng', [['Thông tin, dữ liệu và xử lí thông tin', 'data-information'], ['Thành phần cơ bản của máy tính', 'computer-basics'], ['Mạng máy tính và Internet', 'network-basics']]],
      ['Tìm kiếm và an toàn', [['Tìm kiếm thông tin trên web', 'web-search'], ['Đánh giá độ tin cậy của thông tin', 'source-evaluation'], ['An toàn và đạo đức số', 'digital-safety']]],
      ['Ứng dụng tin học', [['Sơ đồ tư duy và trình bày ý tưởng', 'mind-map'], ['Soạn thảo văn bản cơ bản', 'word-processing'], ['Định dạng và lưu trữ tệp', 'file-management']]],
      ['Giải quyết vấn đề', [['Thuật toán bằng mô tả từng bước', 'algorithms'], ['Sơ đồ khối và biểu diễn thuật toán', 'flowcharts'], ['Thực hành tạo sản phẩm số', 'digital-product']]]
    ],
    7: [
      ['Thiết bị và Internet', [['Thiết bị vào, ra và lưu trữ', 'computer-basics'], ['Mạng xã hội và giao tiếp trực tuyến', 'digital-citizenship'], ['Bảo vệ dữ liệu cá nhân', 'digital-safety']]],
      ['Phần mềm văn phòng', [['Bảng tính và địa chỉ ô', 'spreadsheets'], ['Công thức và hàm đơn giản', 'spreadsheet-formulas'], ['Sắp xếp và trình bày dữ liệu', 'data-organization']]],
      ['Thuật toán và lập trình', [['Biến và kiểu dữ liệu cơ bản', 'programming'], ['Cấu trúc tuần tự và rẽ nhánh', 'algorithms'], ['Lặp và kiểm thử chương trình', 'loops-testing']]],
      ['Dự án số', [['Tìm và kiểm chứng nguồn tin', 'source-evaluation'], ['Tạo bài trình chiếu có cấu trúc', 'presentations'], ['Hoàn thiện và đánh giá sản phẩm số', 'digital-product']]]
    ],
    8: [
      ['Dữ liệu và biểu diễn', [['Thông tin số và mã hóa dữ liệu', 'data-representation'], ['Bảng tính với công thức và hàm', 'spreadsheet-formulas'], ['Biểu đồ và đọc hiểu dữ liệu', 'data-visualization']]],
      ['Lập trình', [['Biến, biểu thức và kiểu dữ liệu', 'programming'], ['Rẽ nhánh và biểu thức logic', 'conditionals'], ['Vòng lặp và bài toán lặp', 'loops-testing']]],
      ['Mạng và an toàn số', [['Mạng máy tính và dịch vụ Internet', 'network-basics'], ['Dấu vết số và quyền riêng tư', 'digital-safety'], ['Tin giả, nguồn tin và kiểm chứng', 'source-evaluation']]],
      ['Sản phẩm công nghệ', [['Phân tích yêu cầu và thiết kế giải pháp', 'computational-thinking'], ['Tạo sản phẩm số theo tiêu chí', 'digital-product'], ['Kiểm thử và sửa lỗi', 'loops-testing']]]
    ],
    9: [
      ['Thông tin và dữ liệu', [['Đánh giá dữ liệu và nguồn tin', 'source-evaluation'], ['Phân tích dữ liệu bằng bảng tính', 'spreadsheet-formulas'], ['Biểu đồ và kết luận từ dữ liệu', 'data-visualization']]],
      ['Lập trình và thuật toán', [['Chia nhỏ bài toán và thiết kế thuật toán', 'computational-thinking'], ['Hàm, tham số và tái sử dụng mã', 'programming'], ['Kiểm thử, truy vết và gỡ lỗi', 'loops-testing']]],
      ['Mạng và công dân số', [['Dịch vụ mạng và nguyên tắc kết nối', 'network-basics'], ['An toàn thông tin và xác thực', 'digital-safety'], ['Bản quyền, quyền riêng tư và ứng xử số', 'digital-citizenship']]],
      ['Dự án tin học', [['Thiết kế cơ sở dữ liệu nhỏ hoặc bảng dữ liệu', 'data-organization'], ['Xây dựng sản phẩm số giải quyết vấn đề', 'digital-product'], ['Đánh giá, trình bày và cải tiến sản phẩm', 'digital-product']]]
    ]
  },
  technology: {
    6: [
      ['Nhà ở và đời sống', [['Nhà ở và vai trò của nhà ở', 'home-design'], ['Sử dụng năng lượng tiết kiệm', 'energy-saving'], ['An toàn trong gia đình', 'home-safety']]],
      ['Thực phẩm và sức khỏe', [['Bữa ăn hợp lí và dinh dưỡng', 'nutrition'], ['Bảo quản và chế biến thực phẩm', 'food-safety'], ['Lựa chọn đồ dùng gia đình', 'consumer-choice']]],
      ['Kĩ thuật cơ bản', [['Vật liệu thường dùng', 'materials'], ['Dụng cụ và quy trình thực hành', 'tools-safety'], ['Bản vẽ kĩ thuật đơn giản', 'technical-drawing']]],
      ['Thiết kế và môi trường', [['Quy trình thiết kế kĩ thuật', 'engineering-design'], ['Đánh giá sản phẩm theo tiêu chí', 'product-evaluation'], ['Giảm chất thải và tái sử dụng', 'sustainability']]]
    ],
    7: [
      ['Trồng trọt', [['Vai trò và phương thức trồng trọt', 'agriculture'], ['Đất trồng và dinh dưỡng cây trồng', 'plant-growing'], ['Gieo trồng, chăm sóc và thu hoạch', 'plant-growing']]],
      ['Chăn nuôi và thủy sản', [['Vai trò và vật nuôi phổ biến', 'animal-care'], ['Chăm sóc và phòng bệnh cho vật nuôi', 'animal-care'], ['Bảo vệ môi trường trong sản xuất', 'sustainability']]],
      ['Cơ khí và vật liệu', [['Vật liệu cơ khí và tính chất', 'materials'], ['Dụng cụ và an toàn lao động', 'tools-safety'], ['Đọc bản vẽ lắp và bản vẽ chi tiết', 'technical-drawing']]],
      ['Thiết kế công nghệ', [['Lựa chọn giải pháp kĩ thuật', 'engineering-design'], ['Thử nghiệm mô hình và điều chỉnh', 'product-evaluation'], ['Đánh giá tác động môi trường', 'sustainability']]]
    ],
    8: [
      ['An toàn điện', [['Vai trò và nguồn điện', 'electricity-safety'], ['Mạch điện và thiết bị bảo vệ', 'electrical-circuits'], ['Sử dụng điện an toàn, tiết kiệm', 'electricity-safety']]],
      ['Kĩ thuật điện và điện tử', [['Sơ đồ nguyên lí và sơ đồ lắp đặt', 'technical-drawing'], ['Thiết bị điện trong gia đình', 'electrical-circuits'], ['Đọc thông số kĩ thuật cơ bản', 'technical-specifications']]],
      ['Cơ cấu truyền động', [['Truyền và biến đổi chuyển động', 'mechanisms'], ['Cơ cấu truyền động trong máy đơn giản', 'mechanisms'], ['Bảo dưỡng và sử dụng thiết bị', 'tools-safety']]],
      ['Thiết kế sản phẩm', [['Xác định nhu cầu và tiêu chí', 'engineering-design'], ['Lập kế hoạch và tạo mẫu', 'engineering-design'], ['Thử nghiệm, đánh giá và cải tiến', 'product-evaluation']]]
    ],
    9: [
      ['Định hướng nghề nghiệp', [['Nghề nghiệp trong lĩnh vực kĩ thuật', 'career-awareness'], ['Năng lực và phẩm chất nghề nghiệp', 'career-awareness'], ['Lựa chọn hướng học tập phù hợp', 'career-planning']]],
      ['Điện và điện tử', [['Mạch điện điều khiển cơ bản', 'electrical-circuits'], ['Thiết bị điện và nguyên tắc bảo vệ', 'electricity-safety'], ['Lắp ráp và kiểm tra mô hình', 'engineering-design']]],
      ['Công nghệ và tự động hóa', [['Cảm biến và điều khiển trong đời sống', 'automation'], ['Hệ thống kĩ thuật và đầu vào, xử lí, đầu ra', 'automation'], ['Hiệu quả năng lượng và an toàn', 'energy-saving']]],
      ['Dự án thực hành', [['Phân tích vấn đề cần giải quyết', 'engineering-design'], ['Tạo và thử nghiệm sản phẩm', 'product-evaluation'], ['Trình bày hồ sơ thiết kế và kết quả', 'technical-documentation']]]
    ]
  }
};

// Additional cross-grade subjects required in the official lower-secondary plan. Their questions
// focus on practical application and are still kept in a topic-specific pool.
const SHARED_PLANS = {
  arts: [
    ['Quan sát và cảm thụ', [['Quan sát đường nét, hình khối và màu sắc', 'visual-elements'], ['Phân tích bố cục trong tác phẩm', 'composition'], ['Âm thanh, nhịp điệu và sắc thái', 'music-elements']]],
    ['Thực hành sáng tạo', [['Lập ý tưởng và phác thảo sản phẩm', 'creative-process'], ['Lựa chọn chất liệu và kĩ thuật', 'materials'], ['Thử nghiệm và điều chỉnh sản phẩm', 'creative-process']]],
    ['Trình bày tác phẩm', [['Giới thiệu ý tưởng nghệ thuật', 'art-reflection'], ['Nhận xét tác phẩm bằng căn cứ', 'art-reflection'], ['Tôn trọng bản quyền và sự khác biệt', 'art-ethics']]],
    ['Nghệ thuật trong đời sống', [['Nghệ thuật và bản sắc văn hóa', 'cultural-heritage'], ['Nghệ thuật nơi công cộng', 'public-art'], ['Đánh giá trải nghiệm nghệ thuật', 'art-reflection']]]
  ],
  pe: [
    ['Nền tảng vận động', [['Khởi động và nguyên tắc an toàn', 'warm-up'], ['Phối hợp vận động cơ bản', 'movement-skills'], ['Kiểm soát nhịp thở và cường độ', 'fitness']]],
    ['Thể lực và sức khỏe', [['Sức bền và phương pháp rèn luyện', 'fitness'], ['Sức mạnh, mềm dẻo và phối hợp', 'fitness'], ['Phục hồi sau vận động', 'recovery']]],
    ['Thể thao và hợp tác', [['Nguyên tắc và luật chơi cơ bản', 'sportsmanship'], ['Phối hợp đồng đội và chiến thuật', 'teamwork'], ['Tôn trọng đối thủ và trọng tài', 'sportsmanship']]],
    ['Tự luyện tập', [['Lập mục tiêu rèn luyện cá nhân', 'fitness-plan'], ['Theo dõi kết quả tập luyện', 'fitness-plan'], ['Phòng tránh chấn thương', 'injury-prevention']]]
  ],
  experience: [
    ['Phát triển bản thân', [['Nhận diện điểm mạnh và mục tiêu', 'self-awareness'], ['Quản lí thời gian học tập', 'time-management'], ['Ứng phó với căng thẳng', 'stress-management']]],
    ['Quan hệ và cộng đồng', [['Giao tiếp tích cực và lắng nghe', 'communication'], ['Hợp tác và giải quyết mâu thuẫn', 'teamwork'], ['Tham gia hoạt động vì cộng đồng', 'community-service']]],
    ['Hướng nghiệp', [['Tìm hiểu nghề nghiệp quanh em', 'career-awareness'], ['Nhận diện sở thích và năng lực', 'career-planning'], ['Tìm kiếm thông tin nghề đáng tin cậy', 'career-research']]],
    ['Sống xanh và trách nhiệm', [['Tiêu dùng có trách nhiệm', 'responsible-consumption'], ['Bảo vệ môi trường tại trường và nơi ở', 'environment'], ['Đánh giá kết quả hoạt động và cải tiến', 'reflection']]]
  ],
  local_education: [
    ['Địa phương và di sản', [['Tìm hiểu lịch sử và địa danh địa phương', 'local-history'], ['Di sản văn hóa và cách bảo tồn', 'cultural-heritage'], ['Nhân vật và sự kiện tiêu biểu', 'local-history']]],
    ['Thiên nhiên địa phương', [['Địa hình, thời tiết và tài nguyên tại địa phương', 'local-geography'], ['Đa dạng sinh học và môi trường', 'local-environment'], ['Rủi ro thiên tai và cách ứng phó', 'disaster-safety']]],
    ['Kinh tế và cộng đồng', [['Hoạt động sản xuất và nghề truyền thống', 'local-economy'], ['Dân cư, văn hóa và sinh hoạt', 'local-culture'], ['Dịch vụ và phát triển địa phương', 'local-economy']]],
    ['Dự án cộng đồng', [['Khảo sát một vấn đề tại địa phương', 'community-project'], ['Đề xuất giải pháp phù hợp', 'community-project'], ['Trình bày kết quả khảo sát có căn cứ', 'source-evaluation']]]
  ]
};

const GENERIC_OBJECTIVES = {
  math: 'Nêu được khái niệm hoặc quy tắc cốt lõi, vận dụng vào ví dụ phù hợp và kiểm tra lại kết quả bằng cách độc lập.',
  vietnamese: 'Đọc hoặc tạo lập văn bản đúng mục đích, xác định ý chính, sử dụng dẫn chứng và trình bày suy nghĩ rõ ràng.',
  english: 'Nhận biết cấu trúc ngôn ngữ trong ngữ cảnh, giải thích lựa chọn và vận dụng vào giao tiếp phù hợp.',
  science: 'Mô tả hiện tượng bằng khái niệm khoa học, phân biệt dữ kiện với suy đoán và giải thích bằng chứng.',
  history_geo: 'Sử dụng tư liệu, mốc thời gian, bản đồ hoặc dữ kiện địa lí để trình bày kết luận có căn cứ.',
  civic: 'Phân tích tình huống, nhận diện quyền, nghĩa vụ và lựa chọn hành vi an toàn, có trách nhiệm.',
  ict: 'Thực hiện quy trình số có mục đích, bảo vệ dữ liệu cá nhân và kiểm tra kết quả đầu ra.',
  technology: 'Phân tích nhu cầu, lựa chọn quy trình hoặc vật liệu phù hợp và đánh giá giải pháp theo tiêu chí.',
  arts: 'Quan sát, lựa chọn phương tiện thể hiện ý tưởng và đánh giá sản phẩm bằng tiêu chí cụ thể.',
  pe: 'Thực hiện vận động đúng kĩ thuật, tuân thủ an toàn và tự theo dõi mức độ phù hợp của hoạt động.',
  experience: 'Đặt mục tiêu, lựa chọn hành động, phối hợp với người khác và tự đánh giá trải nghiệm.',
  local_education: 'Thu thập thông tin địa phương từ nguồn phù hợp, phân tích dữ kiện và đề xuất hành động có trách nhiệm.'
};

function normalizeGrade(value) { const grade = Number(value); return Number.isInteger(grade) && grade >= 6 && grade <= 9 ? grade : null; }
function normalizeProgram(code) { return primary.normalizeProgram(code); }
function subjectsForGrade(grade) { return normalizeGrade(grade) ? Object.entries(SUBJECTS).map(([code, value]) => ({ code, ...value })) : []; }
function makeQuestionId(programCode, grade, subjectCode, lessonId, suffix) { return `lsq-${programCode}-g${grade}-${subjectCode}-${lessonId.split('-').slice(-2).join('-')}-${suffix}`; }
function buildLesson(grade, program, subject, unit, unitIndex, lessonSeed, lessonIndex) {
  const [title, conceptTag] = lessonSeed;
  const lessonId = `${program.code}-g${grade}-${subject.code}-u${unitIndex + 1}-l${lessonIndex + 1}`;
  const alignment = buildLessonAlignment({ grade, subjectCode: subject.code, title, unitTitle: unit.title });
  const objective = `${alignment.intendedOutcomes[0]} ${alignment.intendedOutcomes[1]}`;
  const partMeta = [{ id: 'theory', title: 'Lý thuyết cốt lõi' }, { id: 'lecture', title: 'Bài giảng và ví dụ mẫu' }, { id: 'guided-practice', title: 'Luyện tập có hướng dẫn' }, { id: 'independent-practice', title: 'Tự luyện và vận dụng' }];
  const lessonMeta = { id: lessonId, title, topicTag: conceptTag, grade, subjectCode: subject.code, subjectName: subject.name, unitTitle: unit.title, programCode: program.code, objective, parts: partMeta };
  const pool = QUESTION_BANK.buildQuestionPool({ programCode: program.code, grade, subjectCode: subject.code, lesson: lessonMeta });
  const checkpoints = pool.filter((item) => item.purpose === 'checkpoint');
  const checkpointFor = (partId) => checkpoints.filter((item) => item.partId === partId).slice(0, 2);
  const theory = buildSchoolTheory({ grade, subjectCode: subject.code, subjectName: subject.name, title, unitTitle: unit.title, objective, educationLevel: 'trung học cơ sở' });
  const workedExample = theory.sections.find((item) => item.id === 'worked-example')?.body || theory.summary;
  const parts = [
    { id: 'theory', title: 'Lý thuyết cốt lõi', kind: 'theory', durationMinutes: 7, content: theory.quickReview, checkpoint: checkpointFor('theory') },
    { id: 'lecture', title: 'Bài giảng và ví dụ mẫu', kind: 'lecture', durationMinutes: 6, content: `**Ví dụ về ${title}:**\n\n${workedExample}\n\nHãy xác định dữ kiện, quy tắc được dùng và lý do mỗi bước hợp lí trước khi tự làm bài tương tự.`, checkpoint: checkpointFor('lecture') },
    { id: 'guided-practice', title: 'Luyện tập có hướng dẫn', kind: 'guided-practice', durationMinutes: 7, content: `Luyện tập theo quy trình: đọc yêu cầu, xác định dữ kiện, chọn kiến thức phù hợp, thực hiện và kiểm tra. Khi mắc lỗi, hãy ghi lại nguyên nhân thay vì chỉ xem đáp án.`, checkpoint: checkpointFor('guided-practice') },
    { id: 'independent-practice', title: 'Tự luyện và vận dụng', kind: 'independent-practice', durationMinutes: 8, content: `Tự giải một nhiệm vụ mới liên quan “${title}”. Trình bày cách làm hoặc căn cứ lựa chọn. Hoàn thành bài kiểm tra phần học để ghi nhận tiến độ.`, checkpoint: checkpointFor('independent-practice') }
  ];
  const assessmentQuestions = pool.filter((item) => item.purpose === 'assessment').map((item) => ({ ...item, points: 100 / 8 }));
  return { id: lessonId, title, sequence: unitIndex * 3 + lessonIndex + 1, estimatedMinutes: 28, objective, topicTag: conceptTag, theory, parts, assessmentQuestions, alignment, qualityProfile: createLessonQualityProfile({ level: 'school', grade, subjectCode: subject.code, lesson: { id: lessonId, title, objective, alignment, parts }, hasCodeLab: subject.code === 'ict' }), contentStatus: 'draft-ai-assisted-review-required', provenance: 'Original learning scaffold mapped to broad strands of the 2018 GDPT framework; teacher review required.' };
}
function buildCourse(gradeValue, programCode, subjectCode) {
  const grade = normalizeGrade(gradeValue);
  const program = normalizeProgram(programCode);
  const subject = SUBJECTS[subjectCode] && SUBJECTS[subjectCode].gradeBands.includes(grade) ? { code: subjectCode, ...SUBJECTS[subjectCode] } : null;
  if (!grade || !program || !subject) return null;
  const plan = PLANS[subjectCode]?.[grade] || SHARED_PLANS[subjectCode];
  if (!plan) return null;
  const units = plan.map((entry, unitIndex) => {
    const unitTitle = entry[0];
    const unit = { id: `${program.code}-g${grade}-${subject.code}-u${unitIndex + 1}`, title: unitTitle, sequence: unitIndex + 1 };
    return { ...unit, lessons: entry[1].map((topic, lessonIndex) => buildLesson(grade, program, subject, unit, unitIndex, topic, lessonIndex)) };
  });
  return { id: `${program.code}-g${grade}-${subject.code}`, grade, programCode: program.code, programName: program.name, approach: program.approach, subjectCode: subject.code, subjectName: subject.name, subjectIcon: subject.icon, optional: false, required: subject.required, units, lessonCount: units.reduce((sum, unit) => sum + unit.lessons.length, 0), contentStatus: 'draft-ai-assisted-review-required', educationLevel: 'lower-secondary', curriculumReferences: OFFICIAL_REFERENCES, alignmentStatus: 'draft-framework-mapped-teacher-validation-required' };
}
function buildCatalog(gradeValue, programCode) {
  const grade = normalizeGrade(gradeValue);
  const program = normalizeProgram(programCode);
  if (!grade || !program) return null;
  const courses = subjectsForGrade(grade).map((subject) => buildCourse(grade, program.code, subject.code)).filter(Boolean);
  return { grade, program, educationLevel: 'lower-secondary', curriculumFramework: 'Chương trình Giáo dục phổ thông 2018 cấp THCS; bộ khung nội dung gốc, cần giáo viên đối chiếu yêu cầu cần đạt, phân phối chương trình và SGK đang sử dụng.', curriculumReferences: OFFICIAL_REFERENCES, alignmentStatus: 'draft-framework-mapped-teacher-validation-required', courses, totals: { subjects: courses.length, units: courses.reduce((n, course) => n + course.units.length, 0), lessons: courses.reduce((n, course) => n + course.lessonCount, 0) } };
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
module.exports = { SUBJECTS, subjectsForGrade, buildCourse, buildCatalog, findLesson, publicQuestion, publicLesson, publicCourse, normalizeGrade, normalizeProgram };
