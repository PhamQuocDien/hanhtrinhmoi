'use strict';

// Local alignment metadata for original learning resources. These are internal
// mapping IDs, not official standards codes and not publisher-specific lesson IDs.
const OFFICIAL_REFERENCES = Object.freeze([
  {
    id: 'GDPT-2018-TT32-CONSOLIDATED',
    title: 'Chương trình giáo dục phổ thông ban hành theo Thông tư 32/2018/TT-BGDĐT, được sửa đổi/bổ sung bởi Thông tư 20/2021/TT-BGDĐT và 13/2022/TT-BGDĐT',
    url: 'https://moet.gov.vn/content/vanban/Lists/VBPQ/Attachments/1483/vbhn-ttu-322018-202021-132022-ttbgddt.pdf',
    authority: 'Bộ Giáo dục và Đào tạo',
    use: 'Khung chương trình, phẩm chất/năng lực và yêu cầu cần đạt theo môn học/cấp học'
  },
  {
    id: 'GDPT-2018-OVERVIEW',
    title: 'Chương trình giáo dục phổ thông – Chương trình tổng thể',
    url: 'https://moet.gov.vn/content/tintuc/Lists/News/Attachments/8421/chuong-trinh-tong-the-ctgdpt-2018.pdf',
    authority: 'Bộ Giáo dục và Đào tạo',
    use: 'Năng lực chung, kế hoạch giáo dục và định hướng đánh giá'
  }
]);

const OUTCOMES = {
  math: {
    strands: ['Số và đại số', 'Hình học và đo lường', 'Thống kê và xác suất', 'Mô hình hóa và giải quyết vấn đề'],
    competencies: ['Lập luận toán học', 'Mô hình hóa toán học', 'Giải quyết vấn đề toán học', 'Giao tiếp toán học', 'Sử dụng công cụ và phương tiện toán học'],
    evidence: ['Lời giải có trình tự', 'Kết quả được kiểm tra bằng cách phù hợp', 'Giải thích được lựa chọn phép tính/công thức']
  },
  vietnamese: {
    strands: ['Đọc hiểu', 'Viết', 'Nói và nghe', 'Kiến thức tiếng Việt'],
    competencies: ['Đọc hiểu văn bản', 'Tạo lập văn bản', 'Giao tiếp tiếng Việt', 'Sử dụng ngôn ngữ theo ngữ cảnh'],
    evidence: ['Dẫn chứng hoặc chi tiết làm căn cứ', 'Bố cục và diễn đạt phù hợp', 'Tự rà soát nội dung và quy tắc ngôn ngữ']
  },
  literature: {
    strands: ['Đọc hiểu văn bản', 'Tiếng Việt', 'Viết', 'Nói và nghe'],
    competencies: ['Đọc hiểu và phản hồi văn bản', 'Phân tích nội dung/nghệ thuật', 'Lập luận và tạo lập văn bản', 'Trao đổi có căn cứ'],
    evidence: ['Luận điểm gắn với dẫn chứng', 'Phân tích thay vì chỉ kể lại', 'Văn bản có bố cục và tự chỉnh sửa']
  },
  english: {
    strands: ['Nghe', 'Nói', 'Đọc', 'Viết', 'Kiến thức ngôn ngữ và giao tiếp'],
    competencies: ['Hiểu ngôn ngữ theo ngữ cảnh', 'Giao tiếp phù hợp tình huống', 'Đọc/ nghe tìm thông tin', 'Tạo lập thông điệp'],
    evidence: ['Từ/cấu trúc đúng ngữ cảnh', 'Thông điệp đáp ứng mục đích', 'Có bằng chứng từ văn bản/đoạn nghe khi được yêu cầu']
  },
  ethics: {
    strands: ['Nhận thức chuẩn mực hành vi', 'Tự điều chỉnh hành vi', 'Phát triển quan hệ và trách nhiệm'],
    competencies: ['Nhận biết giá trị và chuẩn mực', 'Đánh giá lựa chọn hành vi', 'Ra quyết định có trách nhiệm'],
    evidence: ['Lựa chọn an toàn/tôn trọng', 'Nêu được lí do và hậu quả', 'Biết tìm hỗ trợ khi vượt quá khả năng']
  },
  civic: {
    strands: ['Giáo dục đạo đức', 'Giáo dục kĩ năng sống', 'Giáo dục kinh tế và pháp luật'],
    competencies: ['Nhận diện vấn đề công dân', 'Đánh giá hành vi theo căn cứ', 'Thực hiện quyền/nghĩa vụ phù hợp'],
    evidence: ['Phân tích tình huống', 'Dẫn căn cứ phù hợp cấp học', 'Lựa chọn có trách nhiệm']
  },
  nature: {
    strands: ['Con người và sức khỏe', 'Gia đình, trường học và cộng đồng', 'Thực vật, động vật và môi trường'],
    competencies: ['Quan sát môi trường gần gũi', 'Đặt câu hỏi và mô tả', 'Vận dụng kiến thức chăm sóc sức khỏe/môi trường'],
    evidence: ['Quan sát cụ thể', 'Phân biệt điều nhìn thấy và điều suy luận', 'Đề xuất hành động an toàn']
  },
  science: {
    strands: ['Chất và sự biến đổi', 'Năng lượng và sự biến đổi', 'Vật sống', 'Trái Đất và bầu trời', 'Thực hành tìm hiểu tự nhiên'],
    competencies: ['Nhận thức khoa học tự nhiên', 'Tìm hiểu tự nhiên', 'Vận dụng kiến thức/kĩ năng'],
    evidence: ['Nêu dự đoán có căn cứ', 'Mô tả dữ liệu/quan sát', 'Rút kết luận phù hợp bằng chứng']
  },
  physics: {
    strands: ['Đại lượng và phép đo', 'Chuyển động và tương tác', 'Năng lượng', 'Thực nghiệm và mô hình hóa'],
    competencies: ['Mô hình hóa hiện tượng', 'Xử lí số liệu', 'Thiết kế/đánh giá phép đo', 'Vận dụng quy luật vật lí'],
    evidence: ['Có đại lượng và đơn vị', 'Lập luận/công thức phù hợp', 'Đối chiếu với đơn vị và độ hợp lí của kết quả']
  },
  chemistry: {
    strands: ['Cấu tạo chất', 'Phản ứng hóa học', 'Tính chất và chuyển hóa chất', 'Hóa học trong đời sống'],
    competencies: ['Mô tả chất và biến đổi', 'Biểu diễn/lập luận về phản ứng', 'Thực hành an toàn', 'Giải thích ứng dụng'],
    evidence: ['Phân biệt quan sát với suy luận', 'Dùng kí hiệu/phương trình đúng khi phù hợp', 'Tuân thủ quy tắc an toàn']
  },
  biology: {
    strands: ['Tổ chức thế giới sống', 'Sinh học tế bào và cơ thể', 'Di truyền và tiến hóa', 'Sinh thái học'],
    competencies: ['Giải thích cấu trúc/chức năng', 'Diễn giải dữ liệu sinh học', 'Giải thích quan hệ sinh vật-môi trường'],
    evidence: ['Dùng thuật ngữ chính xác', 'Nối cấu trúc với chức năng', 'Kết luận dựa trên dữ liệu/bằng chứng']
  },
  history_geo: {
    strands: ['Nhận thức lịch sử', 'Tìm hiểu lịch sử', 'Địa lí tự nhiên', 'Địa lí dân cư và kinh tế', 'Vận dụng kiến thức lịch sử/địa lí'],
    competencies: ['Sử dụng tư liệu/bản đồ', 'Nhận diện thời gian và không gian', 'Giải thích quan hệ nguyên nhân-kết quả', 'So sánh các khu vực/sự kiện'],
    evidence: ['Xác định nguồn và phạm vi dữ liệu', 'Trình bày theo trình tự hợp lý', 'Phân biệt dữ kiện và nhận định']
  },
  history: {
    strands: ['Hiện thực và nhận thức lịch sử', 'Tư liệu lịch sử', 'Lịch sử thế giới', 'Lịch sử Việt Nam', 'Chuyên đề lịch sử'],
    competencies: ['Khai thác sử liệu', 'Nhận diện bối cảnh thời gian', 'Giải thích nguyên nhân/hệ quả', 'Đánh giá bằng chứng lịch sử'],
    evidence: ['Có nguồn hoặc dữ kiện lịch sử', 'Phân biệt bằng chứng với suy luận', 'Tránh khẳng định quá mức từ một nguồn']
  },
  geography: {
    strands: ['Địa lí tự nhiên', 'Dân cư và xã hội', 'Địa lí kinh tế', 'Môi trường và phát triển bền vững'],
    competencies: ['Đọc bản đồ/bảng số liệu', 'Phân tích phân bố và tương quan', 'Giải thích đặc điểm không gian'],
    evidence: ['Nêu rõ đơn vị và phạm vi dữ liệu', 'Dùng số liệu/bản đồ làm căn cứ', 'Liên hệ tự nhiên với hoạt động con người']
  },
  economics_law: {
    strands: ['Kinh tế và lựa chọn', 'Thị trường và hoạt động kinh tế', 'Pháp luật và quyền công dân', 'Ra quyết định có trách nhiệm'],
    competencies: ['Phân tích lựa chọn và hệ quả', 'Đọc tình huống pháp luật', 'Đánh giá hành vi theo quy định/căn cứ'],
    evidence: ['Nêu được giả định và lợi-hại', 'Phân biệt quan điểm cá nhân với quy định', 'Đưa ra lựa chọn có lí do']
  },
  ict: {
    strands: ['Thông tin và dữ liệu', 'Thuật toán và lập trình', 'Ứng dụng số', 'Mạng và an toàn số', 'Thiết kế sản phẩm số'],
    competencies: ['Tư duy tin học', 'Giải quyết vấn đề bằng công cụ số', 'Sáng tạo sản phẩm số', 'Đạo đức và an toàn số'],
    evidence: ['Quy trình có đầu vào/đầu ra', 'Sản phẩm chạy/hoạt động theo tiêu chí', 'Có kiểm thử và sử dụng an toàn']
  },
  technology: {
    strands: ['Nhận thức công nghệ', 'Sử dụng công nghệ', 'Thiết kế kĩ thuật', 'Đánh giá sản phẩm'],
    competencies: ['Xác định nhu cầu', 'Thiết kế và thử nghiệm giải pháp', 'Đánh giá theo tiêu chí', 'Thực hành an toàn'],
    evidence: ['Có tiêu chí thiết kế', 'Ghi lại kết quả thử nghiệm', 'Nêu một cải tiến dựa trên bằng chứng']
  },
  pe: {
    strands: ['Vận động cơ bản', 'Thể lực', 'Thể thao và hợp tác', 'An toàn và tự rèn luyện'],
    competencies: ['Thực hiện kĩ thuật vận động', 'Tự theo dõi thể lực', 'Hợp tác và chơi công bằng', 'Nhận biết nguy cơ'],
    evidence: ['Thực hiện theo hướng dẫn', 'Tuân thủ an toàn', 'Biết dừng và báo người phụ trách khi có dấu hiệu bất thường']
  },
  experience: {
    strands: ['Phát triển bản thân', 'Quan hệ và cộng đồng', 'Môi trường', 'Hướng nghiệp'],
    competencies: ['Tự nhận thức và quản lí bản thân', 'Hợp tác', 'Lập kế hoạch hành động', 'Phản tư sau trải nghiệm'],
    evidence: ['Mục tiêu có bước thực hiện', 'Nêu được điều học được từ trải nghiệm', 'Đề xuất hành động tiếp theo']
  },
  local_education: {
    strands: ['Văn hóa và lịch sử địa phương', 'Địa lí và môi trường', 'Kinh tế và xã hội địa phương', 'Dự án cộng đồng'],
    competencies: ['Tìm kiếm thông tin địa phương', 'Đối chiếu nguồn', 'Đề xuất hành động có trách nhiệm'],
    evidence: ['Ghi rõ địa điểm/nguồn', 'Tôn trọng sự đa dạng địa phương', 'Có sản phẩm hoặc đề xuất cụ thể']
  },
  music: {
    strands: ['Nghe và cảm thụ', 'Hát/biểu diễn', 'Nhạc cụ và tiết tấu', 'Sáng tạo âm nhạc'],
    competencies: ['Cảm thụ âm thanh', 'Thực hành/biểu diễn', 'Phối hợp nhóm', 'Sáng tạo và phản hồi'],
    evidence: ['Mô tả yếu tố âm nhạc cụ thể', 'Thực hiện đúng hướng dẫn', 'Phản hồi tôn trọng, có gợi ý cải thiện']
  },
  art: {
    strands: ['Quan sát và nhận thức', 'Sáng tạo và ứng dụng', 'Phân tích và đánh giá', 'Mĩ thuật và đời sống'],
    competencies: ['Quan sát yếu tố thị giác', 'Thử chất liệu/kĩ thuật', 'Trình bày ý tưởng', 'Phản hồi và cải tiến sản phẩm'],
    evidence: ['Có ý tưởng và lựa chọn tạo hình', 'Giải thích lựa chọn màu/hình/chất liệu', 'Tự đánh giá theo tiêu chí']
  },
  national_defense: {
    strands: ['Kiến thức quốc phòng và an ninh', 'Pháp luật và trách nhiệm', 'Kĩ năng và an toàn'],
    competencies: ['Nhận thức trách nhiệm công dân', 'Vận dụng quy định/hướng dẫn', 'Hành động an toàn'],
    evidence: ['Nêu được quy tắc liên quan', 'Xử lý tình huống theo hướng dẫn', 'Không tự thực hiện hành vi nguy hiểm']
  },
  generic: {
    strands: ['Kiến thức cốt lõi', 'Thực hành', 'Vận dụng và phản tư'],
    competencies: ['Hiểu kiến thức', 'Thực hiện quy trình', 'Vận dụng và tự đánh giá'],
    evidence: ['Giải thích được lựa chọn', 'Có minh chứng thực hiện', 'Nêu được bước cải thiện']
  }
};

function normalizeSubjectCode(code) {
  const value = String(code || '').toLowerCase();
  if (['ethics', 'civic'].includes(value)) return value;
  if (value === 'literature') return 'literature';
  if (['vietnamese'].includes(value)) return value;
  if (['nature', 'science', 'physics', 'chemistry', 'biology'].includes(value)) return value;
  if (['history_geo', 'history', 'geography'].includes(value)) return value;
  if (['arts', 'art'].includes(value)) return 'art';
  if (['economics_law'].includes(value)) return value;
  return OUTCOMES[value] ? value : 'generic';
}
function chooseStrand(subject, title, unitTitle = '', grade = 1) {
  const text = `${title} ${unitTitle}`.toLocaleLowerCase('vi-VN');
  const key = normalizeSubjectCode(subject);
  const outcomes = OUTCOMES[key] || OUTCOMES.generic;
  const keywordBuckets = {
    math: [/số|phép tính|phân số|tỉ số|đại số|phương trình|hàm số|mệnh đề|tập hợp|đạo hàm|tích phân|xác suất/, /hình|góc|đường tròn|diện tích|chu vi|vectơ|lượng giác/, /thống kê|xác suất|dữ liệu/, /bài toán|mô hình|vận dụng/],
    vietnamese: [/đọc|truyện|thơ|văn bản|ý chính/, /viết|đoạn văn|chính tả|nghị luận/, /nói|nghe|thuyết trình|trao đổi/, /từ|câu|dấu câu|ngữ pháp/],
    literature: [/đọc|truyện|thơ|văn bản|nhân vật/, /viết|nghị luận|lập luận|dẫn chứng/, /nói|nghe|thuyết trình|trao đổi/, /tiếng việt|ngôn ngữ|biện pháp tu từ/],
    english: [/nghe|listening/, /nói|speaking|giao tiếp/, /đọc|reading/, /viết|writing|từ vựng|ngữ pháp|grammar/],
    history: [/tư liệu|sử liệu|phương pháp|nguồn/, /việt nam/, /thế giới|văn minh|chiến tranh|cách mạng/, /chuyên đề/],
    history_geo: [/tư liệu|lịch sử|sự kiện|triều đại/, /bản đồ|địa lí|khí hậu|dân cư/, /kinh tế|vùng|tài nguyên/, /môi trường|vận dụng/],
    geography: [/tự nhiên|khí hậu|địa hình|đất/, /dân cư|xã hội/, /kinh tế|đô thị|phân bố/, /môi trường|bền vững/],
    ict: [/dữ liệu|thông tin|tìm kiếm/, /thuật toán|lập trình|mã lệnh/, /mạng|an toàn|bảo mật/, /sản phẩm|thiết kế|ứng dụng/],
    chemistry: [/nguyên tử|phân tử|cấu tạo|liên kết/, /phản ứng|tốc độ|cân bằng/, /chất|dung dịch|nồng độ/, /thực hành|an toàn|ứng dụng/],
    physics: [/đo|đại lượng|sai số/, /lực|chuyển động|cơ học/, /điện|ánh sáng|năng lượng/, /thí nghiệm|mô hình|vận dụng/],
    biology: [/tế bào|cơ thể|cấu trúc/, /di truyền|gen|tiến hóa/, /sinh thái|môi trường/, /sinh vật|hệ cơ quan|vận dụng/],
    economics_law: [/kinh tế|thị trường|chi phí|thu nhập/, /pháp luật|quyền|nghĩa vụ/, /tiêu dùng|tài chính|ngân sách/, /tình huống|trách nhiệm|vận dụng/],
    technology: [/nhận thức|công nghệ|vật liệu/, /thiết kế|kĩ thuật|quy trình/, /sử dụng|vận hành|an toàn/, /sản phẩm|đánh giá|cải tiến/],
    science: [/chất|biến đổi|vật liệu/, /năng lượng|lực|chuyển động/, /vật sống|sinh vật|môi trường/, /thực hành|thí nghiệm|trái đất/],
    nature: [/con người|sức khỏe|cơ thể/, /gia đình|trường học|cộng đồng/, /thực vật|động vật|môi trường/],
    ethics: [/chuẩn mực|đạo đức|tôn trọng/, /cảm xúc|tự điều chỉnh|bản thân/, /gia đình|cộng đồng|trách nhiệm/],
    civic: [/đạo đức|ứng xử|trách nhiệm/, /kĩ năng sống|tình huống/, /kinh tế|pháp luật|quyền/],
    experience: [/bản thân|cảm xúc|mục tiêu/, /cộng đồng|hợp tác|môi trường/, /nghề nghiệp|hướng nghiệp|kế hoạch/],
    local_education: [/văn hóa|lịch sử|di tích/, /địa lí|môi trường|địa phương/, /kinh tế|xã hội|cộng đồng/],
    music: [/nghe|cảm thụ|âm thanh/, /hát|biểu diễn|nhạc cụ/, /nhịp|giai điệu|sáng tạo/],
    art: [/quan sát|màu sắc|hình khối/, /sáng tạo|chất liệu|tạo hình/, /phân tích|đánh giá|đời sống/],
    pe: [/vận động|kĩ thuật|thể thao/, /thể lực|rèn luyện|sức khỏe/, /an toàn|hợp tác|thi đấu/],
    national_defense: [/quốc phòng|an ninh|chủ quyền/, /pháp luật|trách nhiệm|công dân/, /kĩ năng|an toàn|phòng tránh/]
  };
  const buckets = keywordBuckets[key] || [];
  let strandIndex = buckets.findIndex((regex) => regex.test(text));
  if (strandIndex < 0) {
    let hash = 0;
    for (const char of text) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    strandIndex = hash % outcomes.strands.length;
  }
  strandIndex %= outcomes.strands.length;
  const gradeBand = grade <= 5 ? 'tiểu học' : grade <= 9 ? 'trung học cơ sở' : 'trung học phổ thông';
  return { key, outcomes, strand: outcomes.strands[strandIndex], gradeBand };
}
const LEARNING_OUTCOME_TEMPLATES = {
  math: [
    ({ grade, title, strand }) => `Giải quyết nhiệm vụ Toán học lớp ${grade} thuộc mạch “${strand}” trong bài “${title}”, nêu đủ dữ kiện và các bước lập luận.`,
    ({ title }) => `Chọn và giải thích cách dùng khái niệm, phép tính hoặc công thức phù hợp với yêu cầu của bài “${title}”.`,
    ({ title }) => `Kiểm tra lời giải của bài “${title}” bằng phép thử, ước lượng, cách biểu diễn hoặc lập luận độc lập phù hợp.`
  ],
  vietnamese: [
    ({ grade, title, strand }) => `Thực hiện nhiệm vụ Tiếng Việt lớp ${grade} thuộc mạch “${strand}” gắn với bài “${title}”, sử dụng ngôn ngữ phù hợp mục đích.`,
    ({ title }) => `Nêu ý chính hoặc tạo lập thông điệp về “${title}” có căn cứ, bố cục và diễn đạt phù hợp yêu cầu.`,
    ({ title }) => `Tự rà soát nội dung “${title}” theo tiêu chí về ý nghĩa, dẫn chứng, chính tả/ngữ pháp và tính mạch lạc khi phù hợp.`
  ],
  literature: [
    ({ grade, title, strand }) => `Đọc, phân tích hoặc tạo lập văn bản lớp ${grade} theo mạch “${strand}” trong bài “${title}”, phù hợp thể loại và yêu cầu.`,
    ({ title }) => `Nêu nhận xét về “${title}” bằng chi tiết, dẫn chứng hoặc lí lẽ liên quan thay vì chỉ nêu cảm nhận chung.`,
    ({ title }) => `Hoàn thiện phần trình bày về “${title}” sau khi tự kiểm tra luận điểm, dẫn chứng, diễn đạt và bố cục.`
  ],
  english: [
    ({ grade, title, strand }) => `Thực hiện nhiệm vụ tiếng Anh lớp ${grade} thuộc mạch “${strand}” của bài “${title}”, phù hợp mức độ và tình huống giao tiếp.`,
    ({ title }) => `Sử dụng từ vựng/cấu trúc liên quan “${title}” để hiểu hoặc truyền đạt thông tin có nghĩa trong ngữ cảnh.`,
    ({ title }) => `Kiểm tra câu trả lời về “${title}” bằng ngữ cảnh, dấu hiệu ngôn ngữ và yêu cầu nghe/nói/đọc/viết tương ứng.`
  ],
  nature: [
    ({ grade, title, strand }) => `Quan sát, mô tả hoặc giải thích hiện tượng gần gũi lớp ${grade} thuộc mạch “${strand}” trong bài “${title}”.`,
    ({ title }) => `Phân biệt thông tin quan sát được, dự đoán và kết luận khi tìm hiểu “${title}”.`,
    ({ title }) => `Đề xuất cách vận dụng kiến thức “${title}” để chăm sóc sức khỏe hoặc môi trường một cách an toàn, phù hợp lứa tuổi.`
  ],
  science: [
    ({ grade, title, strand }) => `Giải thích hiện tượng khoa học tự nhiên lớp ${grade} thuộc mạch “${strand}” gắn với bài “${title}”.`,
    ({ title }) => `Đề xuất dự đoán hoặc cách kiểm tra về “${title}”, nêu biến/dữ kiện cần quan sát và điều kiện an toàn.`,
    ({ title }) => `Rút ra kết luận về “${title}” từ dữ kiện, thí nghiệm hoặc mô hình và nêu giới hạn của kết luận.`
  ],
  physics: [
    ({ grade, title, strand }) => `Mô tả hoặc giải quyết vấn đề Vật lí lớp ${grade} thuộc mạch “${strand}” trong bài “${title}”, ghi rõ đại lượng và đơn vị khi phù hợp.`,
    ({ title }) => `Chọn mô hình, công thức hoặc phép đo phù hợp để phân tích tình huống “${title}” và giải thích giả định sử dụng.`,
    ({ title }) => `Kiểm tra kết quả “${title}” bằng đơn vị, ước lượng, dữ liệu hoặc đối chiếu với hiện tượng vật lí.`
  ],
  chemistry: [
    ({ grade, title, strand }) => `Mô tả hoặc giải thích chất và sự biến đổi ở mức lớp ${grade}, thuộc mạch “${strand}” trong bài “${title}”.`,
    ({ title }) => `Sử dụng kí hiệu, phương trình, mô hình hoặc bằng chứng phù hợp khi giải thích “${title}”.`,
    ({ title }) => `Nêu cách thực hành an toàn và kiểm tra kết luận về “${title}” dựa trên dữ kiện hóa học thích hợp.`
  ],
  biology: [
    ({ grade, title, strand }) => `Giải thích cấu trúc, chức năng hoặc quan hệ sinh học lớp ${grade} thuộc mạch “${strand}” trong bài “${title}”.`,
    ({ title }) => `Diễn giải sơ đồ, dữ liệu hoặc ví dụ liên quan “${title}” bằng thuật ngữ sinh học phù hợp.`,
    ({ title }) => `Rút ra kết luận về “${title}” có căn cứ, phân biệt bằng chứng với suy đoán và xét điều kiện áp dụng.`
  ],
  history: [
    ({ grade, title, strand }) => `Khai thác sự kiện/tư liệu lịch sử lớp ${grade} thuộc mạch “${strand}” trong bài “${title}”.`,
    ({ title }) => `Mô tả bối cảnh thời gian, địa điểm và nguyên nhân/hệ quả liên quan “${title}” dựa trên tư liệu được cung cấp.`,
    ({ title }) => `Phân biệt dữ kiện lịch sử với diễn giải và đưa ra kết luận về “${title}” dựa trên bằng chứng.`
  ],
  history_geo: [
    ({ grade, title, strand }) => `Sử dụng tư liệu hoặc bản đồ lớp ${grade} thuộc mạch “${strand}” để tìm hiểu bài “${title}”.`,
    ({ title }) => `Giải thích một quan hệ thời gian, không gian hoặc nguyên nhân–kết quả liên quan “${title}” bằng dữ kiện.`,
    ({ title }) => `Đối chiếu nguồn, phạm vi dữ liệu và kết luận khi vận dụng kiến thức lịch sử/địa lí của bài “${title}”.`
  ],
  geography: [
    ({ grade, title, strand }) => `Đọc bản đồ, bảng số liệu hoặc giải thích đặc điểm không gian lớp ${grade} thuộc mạch “${strand}” của bài “${title}”.`,
    ({ title }) => `Sử dụng số liệu có đơn vị và phạm vi rõ để giải thích một đặc điểm địa lí trong “${title}”.`,
    ({ title }) => `Liên hệ yếu tố tự nhiên, dân cư, kinh tế hoặc môi trường trong bài “${title}” mà không vượt quá bằng chứng.`
  ],
  ict: [
    ({ grade, title, strand }) => `Thực hiện nhiệm vụ Tin học lớp ${grade} thuộc mạch “${strand}” của bài “${title}”, bảo đảm thao tác số an toàn.`,
    ({ title }) => `Mô tả đầu vào, các bước xử lí và đầu ra của nhiệm vụ “${title}”; kiểm thử với ít nhất một trường hợp phù hợp.`,
    ({ title }) => `Đánh giá sản phẩm liên quan “${title}” theo yêu cầu, khả năng sử dụng, an toàn và cách sửa lỗi.`
  ],
  technology: [
    ({ grade, title, strand }) => `Nhận biết, sử dụng hoặc thiết kế giải pháp công nghệ lớp ${grade} thuộc mạch “${strand}” của bài “${title}”.`,
    ({ title }) => `Thực hiện quy trình hoặc lựa chọn công cụ cho “${title}”, tuân thủ hướng dẫn an toàn.`,
    ({ title }) => `Đánh giá sản phẩm “${title}” theo tiêu chí, kết quả thử nghiệm và đề xuất cải tiến có căn cứ.`
  ],
  civic: [
    ({ grade, title, strand }) => `Phân tích tình huống Giáo dục công dân lớp ${grade} thuộc mạch “${strand}” trong bài “${title}”.`,
    ({ title }) => `Phân biệt hành vi, quyền, nghĩa vụ hoặc lựa chọn liên quan “${title}” theo căn cứ phù hợp cấp học.`,
    ({ title }) => `Đề xuất cách ứng xử có trách nhiệm trong tình huống “${title}”, nêu hệ quả và khi nào cần tìm hỗ trợ.`
  ],
  economics_law: [
    ({ grade, title, strand }) => `Phân tích lựa chọn kinh tế/pháp luật lớp ${grade} thuộc mạch “${strand}” của bài “${title}”.`,
    ({ title }) => `Nêu dữ kiện, quyền/nghĩa vụ, chi phí-lợi ích hoặc rủi ro liên quan “${title}” theo tình huống.`,
    ({ title }) => `Đưa ra lựa chọn về “${title}” có lí do, phân biệt dữ kiện, giả định và ý kiến cá nhân.`
  ]
};

function buildIntendedOutcomes(key, grade, title, strand) {
  const templates = LEARNING_OUTCOME_TEMPLATES[key] || [
    ({ grade, title, strand }) => `Nhận biết và giải thích nội dung trọng tâm lớp ${grade} thuộc mạch “${strand}” trong bài “${title}”.`,
    ({ title }) => `Thực hiện nhiệm vụ học tập về “${title}”, ghi rõ các bước/căn cứ và tạo minh chứng phù hợp.`,
    ({ title }) => `Vận dụng kiến thức của bài “${title}” vào tình huống mới và tự kiểm tra kết quả theo tiêu chí.`
  ];
  const context = { grade, title, strand };
  return templates.map((template) => template(context));
}

function buildLessonAlignment({ grade, subjectCode, title, unitTitle }) {
  const { key, outcomes, strand, gradeBand } = chooseStrand(subjectCode, title, unitTitle, grade);
  const id = `GDPT2018-${String(grade).padStart(2, '0')}-${key.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${String(title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 22)}`;
  return {
    alignmentId: id,
    framework: 'Chương trình Giáo dục phổ thông 2018',
    frameworkReferenceIds: OFFICIAL_REFERENCES.map((item) => item.id),
    grade,
    gradeBand,
    subjectCode,
    mappedStrand: strand,
    competencyFocus: outcomes.competencies.slice(0, 4),
    intendedOutcomes: buildIntendedOutcomes(key, grade, title, strand),
    alignmentVersion: 'V6.1.1', 
    evidenceOfLearning: outcomes.evidence,
    assessmentBlueprint: { remember: 25, understand: 35, apply: 25, analyzeCreate: 15 },
    textbookSeries: 'Mã chương trình sách dùng để phân phối học liệu; không hàm ý nội dung là trích nguyên văn hoặc đã khớp trang/bài với nhà xuất bản.',
    status: 'draft-framework-mapped-teacher-validation-required',
    disclaimer: 'Mã alignment là mã nội bộ của nền tảng, không phải mã chuẩn chính thức do Bộ GD&ĐT ban hành. Giáo viên cần rà soát yêu cầu cần đạt theo chương trình môn học và phân phối chương trình của nhà trường.'
  };
}
module.exports = { OFFICIAL_REFERENCES, OUTCOMES, normalizeSubjectCode, buildLessonAlignment };
