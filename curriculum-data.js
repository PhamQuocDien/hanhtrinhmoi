'use strict';

// Nội dung trong tệp này là nội dung nguyên bản, được tổ chức theo năng lực/yêu cầu cần đạt
// của Chương trình GDPT 2018 đang áp dụng. Không sao chép nguyên văn sách giáo khoa.
const PROGRAM_VERSION = 'CTGDPT-2018-2026-V14';
const { buildLessonTheoryV14 } = require('./server/modules/lesson-theory-v14.js');
const PASS_SCORE = 8;

// Khung phẩm chất và năng lực cốt lõi của CTGDPT 2018. Các chỉ báo trong web
// dùng để hỗ trợ học tập, không thay thế nhận xét/học bạ do giáo viên và nhà trường xác nhận.
const CORE_QUALITIES = [
  { id: 'yeu_nuoc', name: 'Yêu nước', icon: '🇻🇳' },
  { id: 'nhan_ai', name: 'Nhân ái', icon: '💗' },
  { id: 'cham_chi', name: 'Chăm chỉ', icon: '🌱' },
  { id: 'trung_thuc', name: 'Trung thực', icon: '🧭' },
  { id: 'trach_nhiem', name: 'Trách nhiệm', icon: '🤝' }
];
const GENERAL_COMPETENCIES = [
  { id: 'tu_chu_tu_hoc', name: 'Tự chủ và tự học', icon: '📘' },
  { id: 'giao_tiep_hop_tac', name: 'Giao tiếp và hợp tác', icon: '🗣️' },
  { id: 'giai_quyet_sang_tao', name: 'Giải quyết vấn đề và sáng tạo', icon: '💡' }
];
const SUBJECT_COMPETENCIES = {
  toan: ['Tư duy và lập luận toán học','Mô hình hóa toán học','Giải quyết vấn đề toán học','Giao tiếp toán học','Sử dụng công cụ học toán'],
  tieng_viet: ['Năng lực ngôn ngữ','Năng lực văn học'], ngu_van: ['Năng lực ngôn ngữ','Năng lực văn học'],
  tieng_anh: ['Năng lực giao tiếp ngoại ngữ qua nghe, nói, đọc, viết'],
  tnxh: ['Nhận thức khoa học','Tìm hiểu môi trường tự nhiên và xã hội','Vận dụng kiến thức vào đời sống'],
  khoa_hoc: ['Nhận thức khoa học tự nhiên','Tìm hiểu tự nhiên','Vận dụng kiến thức, kĩ năng'],
  khtn: ['Nhận thức khoa học tự nhiên','Tìm hiểu tự nhiên','Vận dụng kiến thức, kĩ năng'],
  vat_ly: ['Nhận thức vật lí','Tìm hiểu thế giới tự nhiên dưới góc độ vật lí','Vận dụng kiến thức vật lí'],
  hoa_hoc: ['Nhận thức hóa học','Tìm hiểu thế giới tự nhiên dưới góc độ hóa học','Vận dụng kiến thức hóa học'],
  sinh_hoc: ['Nhận thức sinh học','Tìm hiểu thế giới sống','Vận dụng kiến thức sinh học'],
  lich_su_dia_li: ['Nhận thức khoa học lịch sử và địa lí','Tìm hiểu lịch sử và địa lí','Vận dụng kiến thức, kĩ năng'],
  lich_su: ['Tìm hiểu lịch sử','Nhận thức và tư duy lịch sử','Vận dụng kiến thức, kĩ năng lịch sử'],
  dia_li: ['Nhận thức khoa học địa lí','Tìm hiểu địa lí','Vận dụng kiến thức, kĩ năng địa lí'],
  tin_hoc: ['Năng lực tin học','Ứng xử phù hợp trong môi trường số'],
  cong_nghe: ['Nhận thức công nghệ','Giao tiếp công nghệ','Sử dụng công nghệ','Đánh giá và thiết kế kĩ thuật'],
  tin_hoc_cong_nghe: ['Năng lực tin học và công nghệ','An toàn, trách nhiệm trong môi trường số'],
  dao_duc: ['Điều chỉnh hành vi','Phát triển bản thân','Tìm hiểu và tham gia hoạt động xã hội'],
  gdcd: ['Điều chỉnh hành vi','Phát triển bản thân','Tìm hiểu và tham gia hoạt động kinh tế – xã hội'],
  gdktepl: ['Điều chỉnh hành vi','Phát triển bản thân','Tìm hiểu và tham gia hoạt động kinh tế – xã hội'],
  nghe_thuat: ['Thể hiện và cảm thụ nghệ thuật','Sáng tạo và ứng dụng nghệ thuật'],
  am_nhac: ['Thể hiện âm nhạc','Cảm thụ và hiểu biết âm nhạc','Ứng dụng và sáng tạo âm nhạc'],
  mi_thuat: ['Quan sát và nhận thức thẩm mĩ','Sáng tạo và ứng dụng thẩm mĩ','Phân tích và đánh giá thẩm mĩ'],
  gdtc: ['Chăm sóc sức khỏe','Vận động cơ bản','Hoạt động thể dục thể thao'],
  hdtn: ['Thích ứng với cuộc sống','Thiết kế và tổ chức hoạt động','Định hướng nghề nghiệp'],
  hdtnhn: ['Thích ứng với cuộc sống','Thiết kế và tổ chức hoạt động','Định hướng nghề nghiệp'],
  gdqp: ['Nhận thức quốc phòng và an ninh','Vận dụng kiến thức, kĩ năng quân sự'],
  dia_phuong: ['Tìm hiểu địa phương','Vận dụng hiểu biết để tham gia cộng đồng']
};
function competencyProfile(subjectId) {
  return {
    general: GENERAL_COMPETENCIES.map(item => item.name),
    subjectSpecific: SUBJECT_COMPETENCIES[subjectId] || ['Năng lực đặc thù của môn học']
  };
}
function qualityProfile(subjectId, index) {
  const priority = ['cham_chi','trung_thuc','trach_nhiem'];
  if (['dao_duc','gdcd','gdktepl','hdtn','hdtnhn','dia_phuong'].includes(subjectId)) priority.unshift('nhan_ai');
  if (['lich_su','lich_su_dia_li','gdqp'].includes(subjectId)) priority.unshift('yeu_nuoc');
  const unique = [...new Set(priority)];
  return unique.slice(0, index % 3 === 0 ? 4 : 3).map(id => CORE_QUALITIES.find(item => item.id === id)?.name).filter(Boolean);
}


const SUBJECTS = {
  toan: ['Toán', '🔢'],
  tieng_viet: ['Tiếng Việt', '📖'],
  ngu_van: ['Ngữ văn', '✍️'],
  tieng_anh: ['Tiếng Anh', '🎧'],
  dao_duc: ['Đạo đức', '🤝'],
  gdcd: ['Giáo dục công dân', '⚖️'],
  gdktepl: ['Giáo dục kinh tế và pháp luật', '🏛️'],
  tnxh: ['Tự nhiên và Xã hội', '🌱'],
  khoa_hoc: ['Khoa học', '🔬'],
  khtn: ['Khoa học tự nhiên', '🧪'],
  vat_ly: ['Vật lí', '⚡'],
  hoa_hoc: ['Hóa học', '⚗️'],
  sinh_hoc: ['Sinh học', '🧬'],
  lich_su_dia_li: ['Lịch sử và Địa lí', '🌏'],
  lich_su: ['Lịch sử', '🏺'],
  dia_li: ['Địa lí', '🗺️'],
  tin_hoc: ['Tin học', '💻'],
  cong_nghe: ['Công nghệ', '🛠️'],
  tin_hoc_cong_nghe: ['Tin học và Công nghệ', '🧩'],
  nghe_thuat: ['Nghệ thuật', '🎨'],
  am_nhac: ['Âm nhạc', '🎵'],
  mi_thuat: ['Mĩ thuật', '🖼️'],
  gdtc: ['Giáo dục thể chất', '🏃'],
  hdtn: ['Hoạt động trải nghiệm', '🌟'],
  hdtnhn: ['Hoạt động trải nghiệm, hướng nghiệp', '🧭'],
  gdqp: ['Giáo dục quốc phòng và an ninh', '🛡️'],
  dia_phuong: ['Nội dung giáo dục địa phương', '🏡']
};

// Mỗi lớp có một hồ sơ môn học riêng. Những môn trùng tên giữa các lớp là do
// chương trình quốc gia quy định, nhưng tên hiển thị, trọng tâm và bài học đều khác.
const GRADE_SUBJECTS = {
  1: ['toan','tieng_viet','dao_duc','tnxh','nghe_thuat','gdtc','hdtn','tieng_anh'],
  2: ['toan','tieng_viet','dao_duc','tnxh','nghe_thuat','gdtc','hdtn','tieng_anh'],
  3: ['toan','tieng_viet','tieng_anh','dao_duc','tnxh','tin_hoc_cong_nghe','nghe_thuat','gdtc','hdtn'],
  4: ['toan','tieng_viet','tieng_anh','dao_duc','khoa_hoc','lich_su_dia_li','tin_hoc_cong_nghe','nghe_thuat','gdtc','hdtn'],
  5: ['toan','tieng_viet','tieng_anh','dao_duc','khoa_hoc','lich_su_dia_li','tin_hoc_cong_nghe','nghe_thuat','gdtc','hdtn'],
  6: ['toan','ngu_van','tieng_anh','gdcd','khtn','lich_su_dia_li','tin_hoc','cong_nghe','nghe_thuat','gdtc','hdtnhn','dia_phuong'],
  7: ['toan','ngu_van','tieng_anh','gdcd','khtn','lich_su_dia_li','tin_hoc','cong_nghe','nghe_thuat','gdtc','hdtnhn','dia_phuong'],
  8: ['toan','ngu_van','tieng_anh','gdcd','khtn','lich_su_dia_li','tin_hoc','cong_nghe','nghe_thuat','gdtc','hdtnhn','dia_phuong'],
  9: ['toan','ngu_van','tieng_anh','gdcd','khtn','lich_su_dia_li','tin_hoc','cong_nghe','nghe_thuat','gdtc','hdtnhn','dia_phuong'],
  10: ['toan','ngu_van','tieng_anh','lich_su','gdtc','gdqp','hdtnhn','dia_phuong','dia_li','gdktepl','vat_ly','hoa_hoc','sinh_hoc','tin_hoc','cong_nghe','am_nhac','mi_thuat'],
  11: ['toan','ngu_van','tieng_anh','lich_su','gdtc','gdqp','hdtnhn','dia_phuong','dia_li','gdktepl','vat_ly','hoa_hoc','sinh_hoc','tin_hoc','cong_nghe','am_nhac','mi_thuat'],
  12: ['toan','ngu_van','tieng_anh','lich_su','gdtc','gdqp','hdtnhn','dia_phuong','dia_li','gdktepl','vat_ly','hoa_hoc','sinh_hoc','tin_hoc','cong_nghe','am_nhac','mi_thuat']
};

const OPTIONAL_BY_GRADE = {
  1: new Set(['tieng_anh']),
  2: new Set(['tieng_anh']),
  10: new Set(['dia_li','gdktepl','vat_ly','hoa_hoc','sinh_hoc','tin_hoc','cong_nghe','am_nhac','mi_thuat']),
  11: new Set(['dia_li','gdktepl','vat_ly','hoa_hoc','sinh_hoc','tin_hoc','cong_nghe','am_nhac','mi_thuat']),
  12: new Set(['dia_li','gdktepl','vat_ly','hoa_hoc','sinh_hoc','tin_hoc','cong_nghe','am_nhac','mi_thuat'])
};

const GRADE_FOCUS = {
  1: 'làm quen trường học, đọc viết ban đầu và tư duy trực quan',
  2: 'củng cố nền tảng, tự phục vụ và giải quyết tình huống gần gũi',
  3: 'học độc lập bước đầu, sử dụng công cụ số an toàn',
  4: 'mở rộng kiến thức, giải thích hiện tượng và đọc thông tin',
  5: 'hoàn thiện năng lực tiểu học và chuẩn bị chuyển cấp',
  6: 'thích nghi THCS, hình thành phương pháp học theo môn',
  7: 'lập luận, thực hành và kết nối kiến thức với đời sống',
  8: 'phân tích, thiết kế giải pháp và làm việc theo dự án',
  9: 'hệ thống kiến thức THCS, định hướng lựa chọn sau THCS',
  10: 'xây nền THPT, lựa chọn môn học và định hướng nghề nghiệp',
  11: 'đào sâu chuyên đề, tăng năng lực tự học và nghiên cứu',
  12: 'tổng hợp, vận dụng cao và chuẩn bị tốt nghiệp'
};

const TOPICS = {
  toan: ['Số và phép tính','Hình học trực quan','Đo lường','Dữ liệu và xác suất','Biểu thức và quy tắc','Giải quyết vấn đề'],
  tieng_viet: ['Đọc hiểu','Từ và câu','Chính tả','Kể chuyện','Viết đoạn','Giao tiếp'],
  ngu_van: ['Đọc hiểu văn bản','Tiếng Việt','Viết','Nói và nghe','Nghị luận','Văn học Việt Nam'],
  tieng_anh: ['Greetings and introductions','School and friends','Family and home','Daily routines','Hobbies and health','Community and environment'],
  dao_duc: ['Tự chăm sóc','Yêu thương gia đình','Hợp tác với bạn bè','Trung thực','Trách nhiệm','Bảo vệ môi trường'],
  gdcd: ['Tự chủ','Tôn trọng','Quyền và nghĩa vụ','Pháp luật trong đời sống','Trách nhiệm cộng đồng','Ứng xử số'],
  gdktepl: ['Hoạt động kinh tế','Ngân sách cá nhân','Thị trường','Quyền công dân','Pháp luật','Khởi nghiệp có trách nhiệm'],
  tnxh: ['Gia đình','Trường học','Cộng đồng','Thực vật và động vật','Con người và sức khỏe','Trái Đất và bầu trời'],
  khoa_hoc: ['Chất và năng lượng','Thực vật và động vật','Con người và sức khỏe','Sinh vật và môi trường','Trái Đất','Thực hành khoa học'],
  khtn: ['Mở đầu khoa học tự nhiên','Chất và sự biến đổi','Vật sống','Năng lượng','Trái Đất và bầu trời','Thực hành an toàn'],
  vat_ly: ['Chuyển động','Lực','Năng lượng','Điện','Sóng','Vật lí nhiệt'],
  hoa_hoc: ['Cấu tạo chất','Bảng tuần hoàn','Liên kết hóa học','Phản ứng hóa học','Hóa học hữu cơ','Hóa học và đời sống'],
  sinh_hoc: ['Tế bào','Trao đổi chất','Di truyền','Tiến hóa','Sinh thái','Sinh học cơ thể'],
  lich_su_dia_li: ['Thời gian lịch sử','Cộng đồng cổ đại','Đất nước và con người Việt Nam','Bản đồ','Tự nhiên Việt Nam','Kinh tế và xã hội'],
  lich_su: ['Lịch sử thế giới','Lịch sử Việt Nam','Cách mạng và đổi mới','Quan hệ quốc tế','Di sản','Phương pháp sử học'],
  dia_li: ['Bản đồ và GIS','Địa lí tự nhiên','Dân cư','Các ngành kinh tế','Địa lí Việt Nam','Phát triển bền vững'],
  tin_hoc: ['Thông tin và dữ liệu','Mạng máy tính','Đạo đức số','Ứng dụng tin học','Thuật toán','Lập trình'],
  cong_nghe: ['Công nghệ trong đời sống','Thiết kế kĩ thuật','Nông nghiệp','Công nghiệp','An toàn lao động','Hướng nghiệp'],
  tin_hoc_cong_nghe: ['Thiết bị số quanh em','Thông tin và dữ liệu','Gõ phím và soạn thảo','Sản phẩm công nghệ','An toàn số','Thiết kế thủ công'],
  nghe_thuat: ['Nhịp điệu','Màu sắc','Hình khối','Biểu diễn','Sáng tạo','Cảm thụ nghệ thuật'],
  am_nhac: ['Hát','Nhạc cụ','Đọc nhạc','Thường thức âm nhạc','Sáng tạo âm nhạc','Biểu diễn'],
  mi_thuat: ['Yếu tố tạo hình','Thiết kế','Hội họa','Điêu khắc','Mĩ thuật ứng dụng','Di sản mĩ thuật'],
  gdtc: ['Đội hình đội ngũ','Vận động cơ bản','Thể thao tự chọn','Sức bền','An toàn vận động','Lối sống khỏe'],
  hdtn: ['Tự phục vụ','Quan hệ bạn bè','Gia đình','Nhà trường','Cộng đồng','Khám phá bản thân'],
  hdtnhn: ['Khám phá bản thân','Rèn luyện bản thân','Gia đình','Nhà trường','Cộng đồng','Hướng nghiệp'],
  gdqp: ['Quốc phòng toàn dân','An ninh quốc gia','Điều lệnh','Kĩ thuật chiến đấu','Phòng thủ dân sự','Trách nhiệm học sinh'],
  dia_phuong: ['Văn hóa địa phương','Lịch sử địa phương','Địa lí địa phương','Kinh tế địa phương','Môi trường','Cộng đồng']
};

// Chủ đề riêng của từng lớp cho các môn cốt lõi; các môn còn lại cũng được
// ghép với trọng tâm riêng của lớp để không tạo bài trùng nhau.
const GRADE_THEMES = {
  1: {
    toan: ['Số 0 đến 10','So sánh nhiều hơn và ít hơn','Cộng trong phạm vi 10','Trừ trong phạm vi 10','Số đến 20','Hình vuông, tròn và tam giác','Độ dài bằng đơn vị không chuẩn','Thời gian trong ngày','Số đến 100','Bài toán một phép tính'],
    tieng_viet: ['Âm và chữ cái','Ghép âm thành tiếng','Vần đơn giản','Đọc từ quen thuộc','Đọc câu ngắn','Chính tả nhìn viết','Từ chỉ sự vật','Nói lời chào hỏi','Viết câu về bản thân','Đọc truyện tranh ngắn'],
    tnxh: ['Cơ thể của em','Gia đình của em','Lớp học của em','Giữ an toàn ở trường','Cây quanh em','Con vật quanh em','Thời tiết hôm nay','Giữ vệ sinh cá nhân'],
    tieng_anh: ['Hello and goodbye','My name','Numbers one to ten','Colours around me','My classroom','My family','Toys I like','Simple classroom commands']
  },
  2: {
    toan: ['Số đến 1000','Cộng có nhớ trong phạm vi 100','Trừ có nhớ trong phạm vi 100','Bảng nhân 2 và 5','Bảng chia 2 và 5','Đường gấp khúc','Ki-lô-gam và lít','Ngày, giờ và lịch','Biểu đồ tranh','Bài toán nhiều hơn và ít hơn'],
    tieng_viet: ['Đọc truyện thiếu nhi','Từ chỉ hoạt động','Câu kể và câu hỏi','Chính tả nghe viết','Viết lời nhắn','Kể lại một việc','Đọc văn bản thông tin','Mở rộng vốn từ gia đình','Viết đoạn 4 đến 5 câu','Nói và đáp lời lịch sự'],
    tnxh: ['Các thế hệ trong gia đình','Nghề nghiệp quanh em','An toàn khi ở nhà','Hoạt động ở trường','Đường giao thông','Cơ quan vận động','Cây sống ở đâu','Bầu trời ban ngày và ban đêm'],
    tieng_anh: ['Greetings review','My school things','Days of the week','Rooms in my house','Food and drinks','Animals I know','Weather words','Short questions and answers']
  },
  3: {
    toan: ['Số đến 100 000','Cộng và trừ số có nhiều chữ số','Nhân số có hai chữ số','Chia có dư','Phân số bước đầu','Chu vi hình chữ nhật','Diện tích hình chữ nhật','Gam và ki-lô-gam','Tiền Việt Nam','Bảng số liệu đơn giản'],
    tieng_viet: ['Đọc truyện về mái trường','Từ đồng nghĩa gần gũi','Câu khiến và câu cảm','Chính tả âm vần khó','Viết thư ngắn','Kể việc em đã làm','Đọc văn bản khoa học nhỏ','Nói theo chủ đề','Viết đoạn nêu cảm xúc','Tra cứu mục lục và từ điển'],
    tnxh: ['Họ hàng và ngày kỉ niệm','Trường học an toàn','Hoạt động sản xuất','Di tích địa phương','Các bộ phận của thực vật','Vòng đời động vật','Cơ quan tiêu hóa','Trái Đất trong hệ Mặt Trời'],
    tin_hoc_cong_nghe: ['Máy tính và thiết bị thông minh','Tư thế dùng máy tính','Gõ hàng phím cơ sở','Tạo văn bản ngắn','Tìm thông tin an toàn','Sản phẩm công nghệ trong nhà','Lắp ghép mô hình đơn giản','Bảo vệ thông tin cá nhân'],
    tieng_anh: ['Introducing myself','School subjects','My daily timetable','Family members','My favourite food','Sports and games','Places in town','Listening for key words']
  },
  4: {
    toan: ['Số đến hàng triệu','Cộng trừ số tự nhiên','Nhân với số có hai chữ số','Chia cho số có hai chữ số','Phân số bằng nhau','Cộng trừ phân số','Góc nhọn, tù và bẹt','Diện tích hình bình hành','Trung bình cộng','Biểu đồ cột'],
    tieng_viet: ['Đọc truyện về lòng nhân ái','Biện pháp so sánh và nhân hóa','Danh từ, động từ, tính từ','Câu chủ đề trong đoạn','Viết bài kể chuyện','Viết thư điện tử an toàn','Đọc văn bản hướng dẫn','Trình bày ý kiến','Tóm tắt văn bản','Trao đổi trong nhóm'],
    khoa_hoc: ['Nước và sự chuyển thể','Không khí quanh ta','Âm thanh và ánh sáng','Nhiệt và vật dẫn nhiệt','Nhu cầu sống của thực vật','Chuỗi thức ăn đơn giản','Dinh dưỡng và sức khỏe','Phòng tránh tai nạn'],
    lich_su_dia_li: ['Làm quen bản đồ Việt Nam','Thiên nhiên vùng trung du','Đồng bằng Bắc Bộ','Duyên hải miền Trung','Tây Nguyên','Nam Bộ','Buổi đầu dựng nước','Các triều đại độc lập đầu tiên'],
    tin_hoc_cong_nghe: ['Tổ chức tệp và thư mục','Soạn thảo có hình ảnh','Trình chiếu đơn giản','Tìm kiếm có chọn lọc','Quy tắc ứng xử trên mạng','Thiết kế sản phẩm giấy','Trồng và chăm sóc cây','Sử dụng thiết bị tiết kiệm điện'],
    tieng_anh: ['My new friends','School activities','Healthy habits','My neighbourhood','Jobs in the community','Nature and seasons','Past events introduction','Speaking in short exchanges']
  },
  5: {
    toan: ['Ôn số tự nhiên và phân số','Số thập phân','Cộng trừ số thập phân','Nhân chia số thập phân','Tỉ số phần trăm','Hình tam giác và hình thang','Hình hộp chữ nhật','Thể tích','Chuyển động đều bước đầu','Biểu đồ hình quạt'],
    tieng_viet: ['Đọc văn bản về đất nước','Từ nhiều nghĩa','Liên kết câu','Câu ghép','Viết bài tả người','Viết báo cáo ngắn','Đọc và đánh giá thông tin','Thuyết trình có minh họa','Viết đoạn nêu quan điểm','Ôn tập chuyển cấp'],
    khoa_hoc: ['Hỗn hợp và dung dịch','Sự biến đổi của chất','Năng lượng điện','Năng lượng tái tạo','Sinh sản ở thực vật','Sinh sản ở động vật','Dậy thì và chăm sóc sức khỏe','Môi trường và tài nguyên'],
    lich_su_dia_li: ['Địa hình và khoáng sản Việt Nam','Khí hậu và sông ngòi','Dân cư Việt Nam','Nông nghiệp và công nghiệp','Các quốc gia láng giềng','Thời Lý và Trần','Thời Hậu Lê','Việt Nam thế kỉ XIX đến nay'],
    tin_hoc_cong_nghe: ['Mạng máy tính và Internet','Tạo bảng trong văn bản','Bài trình chiếu kể chuyện','Thuật toán bằng các bước','Lập trình trực quan','Thiết kế mô hình kĩ thuật','Sử dụng điện an toàn','Nghề công nghệ quanh em'],
    tieng_anh: ['Personal information','School memories','Travel and transport','Protecting the environment','Festivals in Viet Nam','Future plans','Reading short notices','Giving a short presentation']
  },
  6: {
    toan: ['Tập hợp và số tự nhiên','Tính chia hết','Số nguyên','Phân số','Số thập phân','Điểm, đường thẳng và tia','Đoạn thẳng và góc','Hình có trục đối xứng','Dữ liệu và biểu đồ','Xác suất thực nghiệm'],
    ngu_van: ['Truyện truyền thuyết và cổ tích','Thơ lục bát','Kí và du kí','Văn bản thông tin','Từ đơn và từ phức','Biện pháp tu từ cơ bản','Viết bài kể trải nghiệm','Viết đoạn ghi lại cảm xúc','Thảo luận nhóm','Tóm tắt văn bản'],
    khtn: ['Đo lường trong khoa học','Các thể của chất','Oxygen và không khí','Tế bào','Từ tế bào đến cơ thể','Đa dạng thế giới sống','Lực và chuyển động','Năng lượng','Trái Đất và bầu trời','Thực hành phòng thí nghiệm'],
    lich_su_dia_li: ['Vì sao cần học lịch sử','Xã hội nguyên thủy','Các quốc gia cổ đại','Đông Nam Á từ đầu Công nguyên','Bản đồ và phương hướng','Trái Đất trong hệ Mặt Trời','Cấu tạo Trái Đất','Khí hậu và biến đổi khí hậu','Nước trên Trái Đất','Dân số thế giới'],
    tieng_anh: ['My new school','My house','My friends','My neighbourhood','Natural wonders','Tet holiday','Television','Sports and games','Cities of the world','Our greener world']
  },
  7: {
    toan: ['Số hữu tỉ','Số thực','Góc và đường thẳng song song','Tam giác bằng nhau','Tỉ lệ thức','Đại lượng tỉ lệ','Biểu thức đại số','Đa thức một biến','Thu thập dữ liệu','Biến cố ngẫu nhiên'],
    ngu_van: ['Thơ bốn chữ và năm chữ','Truyện ngụ ngôn','Tùy bút và tản văn','Văn bản nghị luận xã hội','Tục ngữ','Liên kết và mạch lạc','Viết bài phân tích nhân vật','Viết văn biểu cảm','Giải thích một quy tắc','Tranh biện có căn cứ'],
    khtn: ['Nguyên tử và nguyên tố','Phân tử và liên kết','Trao đổi chất ở sinh vật','Cảm ứng ở sinh vật','Sinh trưởng và phát triển','Tốc độ chuyển động','Âm thanh','Ánh sáng','Từ trường','Thực hành đo và báo cáo'],
    lich_su_dia_li: ['Tây Âu từ thế kỉ V đến XVI','Trung Quốc thời phong kiến','Ấn Độ thời phong kiến','Đông Nam Á trung đại','Việt Nam từ thế kỉ X đến XV','Châu Âu','Châu Á','Châu Phi','Châu Mỹ','Châu Đại Dương và Nam Cực'],
    tieng_anh: ['Hobbies','Healthy living','Community service','Music and arts','Food and drink','A visit to a school','Traffic','Films','Festivals around the world','Energy sources']
  },
  8: {
    toan: ['Đơn thức và đa thức nhiều biến','Hằng đẳng thức đáng nhớ','Phân thức đại số','Phương trình bậc nhất','Hàm số bậc nhất','Tứ giác','Định lí Pythagore','Tam giác đồng dạng','Dữ liệu ghép nhóm','Xác suất cổ điển bước đầu'],
    ngu_van: ['Truyện lịch sử','Thơ Đường luật','Hài kịch','Văn bản nghị luận văn học','Văn bản giải thích hiện tượng','Từ Hán Việt','Viết bài phân tích tác phẩm','Viết bài nghị luận xã hội','Thuyết minh một quy trình','Nghe và phản hồi ý kiến'],
    khtn: ['Phản ứng hóa học','Mol và tỉ khối khí','Dung dịch và nồng độ','Cơ thể người','Môi trường trong cơ thể','Áp suất','Điện và mạch điện','Nhiệt năng','Sinh thái học bước đầu','Thiết kế thí nghiệm'],
    lich_su_dia_li: ['Cách mạng tư sản','Cách mạng công nghiệp','Đông Nam Á thế kỉ XVI đến XIX','Việt Nam thế kỉ XVI đến XVIII','Việt Nam nửa đầu thế kỉ XIX','Địa hình Việt Nam','Khí hậu Việt Nam','Thủy văn Việt Nam','Thổ nhưỡng và sinh vật','Biển đảo Việt Nam'],
    tieng_anh: ['Leisure time','Life in the countryside','Teenagers','Ethnic groups of Viet Nam','Our customs and traditions','Lifestyles','Environmental protection','Shopping','Natural disasters','Communication in the future']
  },
  9: {
    toan: ['Căn bậc hai và căn bậc ba','Hệ phương trình bậc nhất hai ẩn','Phương trình bậc hai','Hàm số y bằng ax bình phương','Hệ thức lượng trong tam giác vuông','Đường tròn','Góc với đường tròn','Hình trụ, nón và cầu','Thống kê mô tả','Xác suất của biến cố'],
    ngu_van: ['Truyện truyền kì và truyện thơ','Thơ hiện đại Việt Nam','Truyện ngắn hiện đại','Kịch và bi kịch','Nghị luận về vấn đề đời sống','Nghị luận phân tích tác phẩm','Viết bài thuyết minh','Viết bài nghị luận so sánh','Thuyết trình định hướng nghề','Ôn tập năng lực đọc viết THCS'],
    khtn: ['Kim loại và phi kim','Hóa học hữu cơ bước đầu','Di truyền và biến dị','Tiến hóa','Quang học','Điện từ học','Năng lượng với cuộc sống','Sinh thái và môi trường','Tài nguyên thiên nhiên','Dự án khoa học cuối cấp'],
    lich_su_dia_li: ['Thế giới từ 1918 đến 1945','Việt Nam từ 1918 đến 1945','Thế giới từ 1945 đến nay','Việt Nam từ 1945 đến nay','Dân cư và lao động Việt Nam','Nông lâm ngư nghiệp','Công nghiệp','Dịch vụ','Các vùng kinh tế','Phát triển biển đảo bền vững'],
    tieng_anh: ['Local community','City life','Healthy living for teens','Remembering the past','Our experiences','Viet Nam then and now','Natural wonders','Tourism','World Englishes','Career orientation']
  },
  10: {
    toan: ['Mệnh đề và tập hợp','Bất phương trình bậc nhất hai ẩn','Hàm số và đồ thị','Hệ thức lượng trong tam giác','Vectơ','Thống kê không ghép nhóm','Đại số tổ hợp','Xác suất cổ điển','Phương pháp tọa độ trong mặt phẳng','Mô hình hóa toán học'],
    ngu_van: ['Thần thoại và sử thi','Thơ trung đại','Truyện và tiểu thuyết','Văn bản nghị luận','Văn bản thông tin tổng hợp','Viết bài nghị luận xã hội','Viết báo cáo nghiên cứu','Phân tích đánh giá tác phẩm','Thuyết trình thuyết phục','Sân khấu hóa văn học'],
    tieng_anh: ['Family life','Humans and the environment','Music','For a better community','Inventions','Gender equality','Viet Nam and international organisations','New ways to learn','Protecting the environment','Ecotourism'],
    vat_ly: ['Mô tả chuyển động','Chuyển động biến đổi','Ba định luật Newton','Moment lực','Năng lượng và công','Động lượng','Chuyển động tròn','Biến dạng vật rắn','Khối lượng riêng và áp suất','Thực hành xử lí số liệu'],
    hoa_hoc: ['Cấu tạo nguyên tử','Bảng tuần hoàn','Liên kết hóa học','Phản ứng oxi hóa khử','Năng lượng hóa học','Tốc độ phản ứng','Nguyên tố nhóm halogen','Hóa học với môi trường','An toàn phòng thí nghiệm','Dự án hóa học đời sống'],
    sinh_hoc: ['Sinh học và phát triển bền vững','Các cấp tổ chức sống','Tế bào nhân sơ và nhân thực','Trao đổi chất qua màng','Chuyển hóa năng lượng','Chu kì tế bào','Vi sinh vật','Virus','Công nghệ tế bào','Thực hành quan sát'],
    lich_su: ['Lịch sử và sử học','Vai trò của sử học','Một số nền văn minh thế giới cổ trung đại','Các cuộc cách mạng công nghiệp','Văn minh Đông Nam Á','Văn minh trên đất nước Việt Nam','Cộng đồng các dân tộc Việt Nam','Bảo tồn di sản','Lịch sử địa phương','Chuyên đề trải nghiệm lịch sử']
  },
  11: {
    toan: ['Góc lượng giác và công thức lượng giác','Hàm số lượng giác','Phương trình lượng giác','Dãy số','Cấp số cộng và cấp số nhân','Giới hạn','Hàm số liên tục','Đường thẳng và mặt phẳng trong không gian','Quan hệ vuông góc trong không gian','Xác suất có điều kiện'],
    ngu_van: ['Truyện thơ dân gian và truyện thơ Nôm','Thơ trữ tình hiện đại','Truyện ngắn và tiểu thuyết hiện đại','Bi kịch','Tùy bút và tản văn','Viết văn bản nghị luận về tác phẩm','Viết báo cáo nghiên cứu văn học','So sánh hai văn bản','Tranh biện vấn đề xã hội','Dự án đọc mở rộng'],
    tieng_anh: ['A long and healthy life','The generation gap','Cities of the future','ASEAN and Viet Nam','Global warming','Preserving heritage','Education options for school-leavers','Becoming independent','Social issues','The ecosystem'],
    vat_ly: ['Dao động điều hòa','Sóng cơ','Điện trường','Dòng điện không đổi','Mạch điện và năng lượng điện','Từ trường','Cảm ứng điện từ','Sóng điện từ','Vật lí trong y học','Dự án đo lường'],
    hoa_hoc: ['Cân bằng hóa học','Nitrogen và sulfur','Đại cương hóa học hữu cơ','Hydrocarbon','Dẫn xuất halogen và alcohol','Hợp chất carbonyl','Carboxylic acid','Phân tích phổ cơ bản','Hóa học xanh','Thực hành nhận biết chất'],
    sinh_hoc: ['Trao đổi nước và khoáng ở thực vật','Quang hợp và hô hấp','Dinh dưỡng và tiêu hóa ở động vật','Tuần hoàn và miễn dịch','Bài tiết và cân bằng nội môi','Cảm ứng','Sinh trưởng và phát triển','Sinh sản','Cơ thể là một hệ thống','Dự án sức khỏe'],
    lich_su: ['Cách mạng tư sản và chủ nghĩa tư bản','Chủ nghĩa xã hội từ 1917 đến nay','Quá trình giành độc lập ở Đông Nam Á','Chiến tranh bảo vệ Tổ quốc Việt Nam','Làng xã Việt Nam','Cải cách trong lịch sử Việt Nam','Biển Đông trong lịch sử','Nhân vật lịch sử','Khai thác tư liệu','Chuyên đề lịch sử khu vực']
  },
  12: {
    toan: ['Tính đơn điệu và cực trị','Giá trị lớn nhất và nhỏ nhất','Đường tiệm cận','Khảo sát hàm số','Nguyên hàm','Tích phân và ứng dụng','Số phức','Phương pháp tọa độ trong không gian','Mặt cầu, mặt phẳng và đường thẳng','Xác suất và thống kê tổng hợp'],
    ngu_van: ['Văn học hiện đại sau 1945','Văn học đổi mới','Thơ hiện đại và hậu hiện đại','Truyện ngắn đương đại','Kí và phóng sự','Nghị luận so sánh đánh giá','Viết thư trao đổi học thuật','Báo cáo dự án nghiên cứu','Nói thuyết phục trước công chúng','Ôn tập đọc viết tốt nghiệp'],
    tieng_anh: ['Life stories we admire','A multicultural world','Green living','Urbanisation','The world of work','Artificial intelligence','The mass media','Wildlife conservation','Career applications','Exam communication strategies'],
    vat_ly: ['Vật lí nhiệt','Khí lí tưởng','Từ trường và lực từ','Cảm ứng điện từ','Vật lí hạt nhân','Phóng xạ','Năng lượng hạt nhân','Ứng dụng vật lí hiện đại','An toàn bức xạ','Ôn tập thực nghiệm'],
    hoa_hoc: ['Ester và lipid','Carbohydrate','Hợp chất chứa nitrogen','Polymer','Pin điện và điện phân','Đại cương kim loại','Kim loại nhóm IA và IIA','Kim loại chuyển tiếp','Hóa học và vấn đề môi trường','Ôn tập thực hành hóa học'],
    sinh_hoc: ['Di truyền phân tử','Quy luật di truyền','Di truyền quần thể','Ứng dụng di truyền học','Bằng chứng và cơ chế tiến hóa','Sự phát sinh loài người','Sinh thái học quần thể','Quần xã và hệ sinh thái','Bảo tồn đa dạng sinh học','Ôn tập nghiên cứu sinh học'],
    lich_su: ['Thế giới trong và sau Chiến tranh lạnh','Trật tự thế giới mới','ASEAN và tiến trình hội nhập','Cách mạng tháng Tám 1945','Kháng chiến bảo vệ độc lập','Công cuộc Đổi mới','Đối ngoại Việt Nam','Hồ Chí Minh trong lịch sử','Tổng hợp lịch sử Việt Nam','Ôn tập năng lực sử học']
  }
};

function subjectIdsForGrade(grade) {
  return [...(GRADE_SUBJECTS[Number(grade)] || GRADE_SUBJECTS[1])];
}

function hash(input) {
  let h = 2166136261;
  for (const ch of String(input)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pick(arr, seed) { return arr[seed % arr.length]; }
function shuffledQuestion(prompt, correct, distractors, seed, skill, explanation) {
  const options = [correct, ...distractors.filter(item => item !== correct)].slice(0, 4);
  while (options.length < 4) options.push(`Phương án ${options.length + 1}`);
  for (let i = options.length - 1; i > 0; i--) {
    const j = (seed + i * 17) % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { prompt, options, answer: options.indexOf(correct), skill, explanation };
}

function numberChoices(answer) {
  const a = Number(answer);
  return [String(a + 1), String(Math.max(0, a - 1)), String(a + 2)];
}

function buildMathQuestion(grade, topic, seed, qIndex) {
  const cap = grade <= 2 ? 20 : grade <= 5 ? 100 : grade <= 9 ? 300 : 800;
  const a = 2 + seed % Math.max(4, Math.floor(cap / 3));
  const b = 1 + (seed >>> 3) % Math.max(3, Math.floor(cap / 5));
  const templates = [
    () => { const ans = a + b; return shuffledQuestion(`${a} + ${b} bằng bao nhiêu?`, String(ans), numberChoices(ans), seed, 'tính toán', `Cộng ${a} với ${b} được ${ans}.`); },
    () => { const hi = Math.max(a,b), lo = Math.min(a,b), ans = hi-lo; return shuffledQuestion(`${hi} - ${lo} bằng bao nhiêu?`, String(ans), numberChoices(ans), seed, 'tính toán', `Lấy ${hi} trừ ${lo} được ${ans}.`); },
    () => { const x=2+seed%8, y=2+(seed>>>4)%7, ans=x*y; return shuffledQuestion(`Một nhóm có ${x} hàng, mỗi hàng ${y} vật. Có tất cả bao nhiêu vật?`, String(ans), numberChoices(ans), seed, 'vận dụng', `${x} × ${y} = ${ans}.`); },
    () => { const w=3+seed%9,h=2+(seed>>>5)%8,ans=2*(w+h); return shuffledQuestion(`Hình chữ nhật dài ${w} cm, rộng ${h} cm. Chu vi là bao nhiêu?`, `${ans} cm`, [`${w*h} cm`,`${w+h} cm`,`${ans+2} cm`], seed, 'hình học', `Chu vi = 2 × (${w} + ${h}) = ${ans} cm.`); },
    () => { const n=2+seed%7, start=seed%10, ans=start+n*3; return shuffledQuestion(`Dãy ${start}, ${start+n}, ${start+2*n}, ... có số tiếp theo là gì?`, String(ans), numberChoices(ans), seed, 'quy luật', `Mỗi số tăng thêm ${n}.`); },
    () => { const total=(2+seed%8)*10, part=total/2; return shuffledQuestion(`Một nửa của ${total} là bao nhiêu?`, String(part), [String(total*2),String(total-1),String(part+10)], seed, 'phân số', `${total} chia 2 bằng ${part}.`); },
    () => { const x=3+seed%20,c=2+(seed>>>4)%15,sum=x+c; return shuffledQuestion(`Tìm x: x + ${c} = ${sum}.`, String(x), numberChoices(x), seed, 'đại số', `Lấy ${sum} - ${c} = ${x}.`); },
    () => { const m=1+seed%5, cm=m*100; return shuffledQuestion(`${m} mét bằng bao nhiêu xăng-ti-mét?`, `${cm} cm`, [`${m*10} cm`,`${m*1000} cm`,`${cm+10} cm`], seed, 'đo lường', `1 mét bằng 100 cm.`); },
    () => { const p=10*((seed%7)+1), base=10*((seed>>>4)%8+2), ans=base*p/100; return shuffledQuestion(`${p}% của ${base} bằng bao nhiêu?`, String(ans), numberChoices(ans), seed, 'tỉ lệ', `${base} × ${p}/100 = ${ans}.`); },
    () => { const vals=[a%20+2,b%20+2,(a+b)%20+2], ans=Math.max(...vals); return shuffledQuestion(`Trong các số ${vals.join(', ')}, số lớn nhất là số nào?`, String(ans), vals.filter(v=>v!==ans).map(String).concat(String(ans-1)), seed, 'so sánh', `So sánh theo hàng giá trị để chọn ${ans}.`); },
    () => { const x=2+seed%8, ans=x*x; return shuffledQuestion(`Diện tích hình vuông cạnh ${x} cm là bao nhiêu?`, `${ans} cm²`, [`${x*4} cm²`,`${x*2} cm²`,`${ans+1} cm²`], seed, 'hình học', `Diện tích hình vuông = cạnh × cạnh.`); },
    () => shuffledQuestion(`Bước nào nên làm cuối cùng khi giải bài toán về ${topic.toLowerCase()}?`, 'Kiểm tra lại kết quả và đơn vị', ['Bỏ qua dữ kiện','Chọn ngẫu nhiên một đáp án','Chỉ chép phép tính'], seed, 'tự đánh giá', 'Kiểm tra lại giúp phát hiện sai phép tính và sai đơn vị.')
  ];
  // Nội dung nâng cao chỉ xuất hiện từ lớp phù hợp; lớp nhỏ dùng lại dạng số học cơ bản.
  if (grade <= 2 && [3,5,6,8,10].includes(qIndex)) return templates[qIndex % 3]();
  if (grade <= 4 && qIndex === 8) return templates[4]();
  return templates[qIndex % templates.length]();
}

function buildEnglishQuestion(grade, topic, seed, qIndex) {
  const topicText = topic.toLowerCase();
  const templates = [
    () => shuffledQuestion('Which sentence is a polite greeting?', 'Hello! Nice to meet you.', ['Close the door.','I have two books.','Yesterday was rainy.'], seed, 'vocabulary', '“Hello! Nice to meet you.” is a polite greeting.'),
    () => shuffledQuestion('Complete the sentence: I ___ a student.', 'am', ['is','are','be'], seed, 'grammar', 'The subject “I” goes with “am”.'),
    () => shuffledQuestion('Choose the correct plural form of “book”.', 'books', ['bookes','bookies','book'], seed, 'grammar', 'Most nouns add -s in the plural.'),
    () => shuffledQuestion('Which question matches the answer “I am fine, thank you”?', 'How are you?', ['What is your name?','Where do you live?','How old is the book?'], seed, 'communication', '“How are you?” asks about someone’s condition.'),
    () => shuffledQuestion(`Which sentence is about ${topicText}?`, `We are learning about ${topicText}.`, ['The window is closed.','My pencil is blue.','It is seven o’clock.'], seed, 'reading', 'The correct sentence directly states the lesson topic.'),
    () => shuffledQuestion('Choose the sentence with the correct word order.', 'She goes to school every day.', ['She every day goes school to.','Goes she school every day.','Every school she goes day.'], seed, 'grammar', 'English statements commonly follow Subject + Verb + complement.'),
    () => shuffledQuestion('Which word means “gia đình”?', 'family', ['school','weather','number'], seed, 'vocabulary', '“Family” means “gia đình”.'),
    () => shuffledQuestion('Complete: There ___ two pencils on the desk.', 'are', ['is','am','be'], seed, 'grammar', 'Use “are” with a plural noun.'),
    () => shuffledQuestion('Which sentence describes an action happening now?', 'They are reading a book.', ['They read yesterday.','They will read tomorrow.','They have a red book.'], seed, 'grammar', 'Present continuous describes an action happening now.'),
    () => shuffledQuestion('What should you listen for first in a short passage?', 'The main idea', ['Every unknown word','Only the final sound','The speaker’s clothes'], seed, 'listening', 'Finding the main idea gives a framework for details.'),
    () => shuffledQuestion('Which reply is appropriate after “Thank you”?', 'You’re welcome.', ['Good night yesterday.','I am a table.','What colour?'], seed, 'communication', '“You’re welcome” is a standard polite reply.'),
    () => shuffledQuestion('What helps improve speaking pronunciation?', 'Listen, repeat, record, and compare', ['Speak as fast as possible','Skip difficult sounds','Read silently only'], seed, 'speaking', 'Repeated listening and comparison support pronunciation practice.')
  ];
  return templates[qIndex % templates.length]();
}

function buildLanguageQuestion(grade, topic, seed, qIndex) {
  const name = pick(['Lan','Minh','An','Hà'], seed);
  const text = `${name} thấy một cây non bị nghiêng sau cơn mưa. Bạn nhẹ nhàng dựng cây và buộc vào cọc để cây tiếp tục lớn.`;
  const templates = [
    () => shuffledQuestion(`Đọc đoạn: “${text}” Ý chính là gì?`, `${name} chăm sóc cây non sau mưa.`, [`${name} đi mua một cây mới.`,`Cây non không cần chăm sóc.`,`${name} chơi dưới mưa.`], seed, 'đọc hiểu', 'Ý chính bao quát hành động và mục đích trong đoạn.'),
    () => shuffledQuestion(`Từ nào trong câu “${name} nhẹ nhàng dựng cây” chỉ cách thực hiện hành động?`, 'nhẹ nhàng', [name,'dựng','cây'], seed, 'từ và câu', '“Nhẹ nhàng” bổ sung cách thức cho hành động “dựng”.'),
    () => shuffledQuestion('Dấu câu nào thường dùng cuối câu hỏi?', 'Dấu chấm hỏi (?)', ['Dấu chấm (.)','Dấu phẩy (,)','Dấu hai chấm (:)'], seed, 'chính tả', 'Câu hỏi thường kết thúc bằng dấu chấm hỏi.'),
    () => shuffledQuestion(`Chi tiết nào là bằng chứng ${name} biết bảo vệ cây?`, 'Bạn dựng cây và buộc vào cọc.', ['Trời vừa mưa.','Cây tiếp tục lớn.','Có một cây non.'], seed, 'đọc hiểu', 'Hành động cụ thể là bằng chứng rõ nhất.'),
    () => shuffledQuestion('Câu nào diễn đạt rõ ràng và đủ ý?', 'Em đọc kĩ đề rồi mới viết câu trả lời.', ['Đọc đề câu trả lời.','Kĩ rồi em.','Viết vì đề.'], seed, 'diễn đạt', 'Câu đúng có chủ ngữ, vị ngữ và quan hệ ý rõ ràng.'),
    () => shuffledQuestion('Từ nào gần nghĩa nhất với “chăm chỉ”?', 'siêng năng', ['lười biếng','ồn ào','vội vàng'], seed, 'vốn từ', '“Siêng năng” gần nghĩa với “chăm chỉ”.'),
    () => shuffledQuestion('Khi viết đoạn văn, câu mở đoạn nên làm gì?', 'Giới thiệu ý chính của đoạn', ['Lặp nguyên câu cuối','Đưa chi tiết không liên quan','Bỏ trống chủ đề'], seed, 'viết', 'Câu mở đoạn giúp người đọc biết nội dung chính.'),
    () => shuffledQuestion('Cách dùng dẫn chứng nào thuyết phục hơn?', 'Dẫn chứng cụ thể và liên quan trực tiếp', ['Dẫn chứng không rõ nguồn','Kể càng nhiều càng tốt dù lạc đề','Chỉ nêu cảm xúc'], seed, 'lập luận', 'Dẫn chứng cần cụ thể và hỗ trợ luận điểm.'),
    () => shuffledQuestion(`Nhan đề phù hợp nhất cho đoạn về ${name} là gì?`, 'Chăm sóc cây non', ['Một ngày ở cửa hàng','Trò chơi dưới nước','Chiếc cặp mới'], seed, 'đọc hiểu', 'Nhan đề phải gắn với nội dung trung tâm.'),
    () => shuffledQuestion('Khi sửa bài viết, nên ưu tiên kiểm tra điều gì?', 'Ý, bố cục, câu chữ và chính tả', ['Chỉ số lượng dòng','Chỉ màu mực','Chỉ chữ đầu tiên'], seed, 'tự đánh giá', 'Sửa bài cần xem cả nội dung lẫn hình thức.'),
    () => shuffledQuestion(`Câu nào có nội dung gắn với chủ đề “${topic}”?`, `Em tìm dữ kiện để hiểu rõ ${topic.toLowerCase()}.`, ['Chiếc ghế ở gần cửa.','Hôm nay em dùng bút xanh.','Sân trường có ba cây.'], seed, 'vận dụng', 'Câu đúng nhắc trực tiếp tới chủ đề bài.'),
    () => shuffledQuestion('Trong phần nói và nghe, hành vi nào phù hợp?', 'Lắng nghe, chờ lượt và phản hồi vào ý chính', ['Ngắt lời liên tục','Chỉ nói mà không nghe','Chê bai người trình bày'], seed, 'nói và nghe', 'Giao tiếp hiệu quả cần tôn trọng và phản hồi đúng trọng tâm.')
  ];
  return templates[qIndex % templates.length]();
}

function buildScienceQuestion(subjectId, topic, seed, qIndex) {
  const templates = [
    () => shuffledQuestion(`Muốn tìm hiểu ${topic.toLowerCase()}, bước đầu phù hợp là gì?`, 'Đặt câu hỏi có thể quan sát hoặc kiểm tra', ['Kết luận trước khi quan sát','Bỏ qua an toàn','Chép kết quả của người khác'], seed, 'phương pháp khoa học', 'Một câu hỏi kiểm chứng được định hướng cho quan sát hoặc thí nghiệm.'),
    () => shuffledQuestion('Đâu là một quan sát?', 'Nước trong cốc không màu.', ['Nước chắc chắn tốt nhất.','Em thích cốc này.','Có lẽ ngày mai sẽ khác.'], seed, 'quan sát', 'Quan sát mô tả điều nhận biết được, không phải ý thích hay dự đoán.'),
    () => shuffledQuestion('Khi làm thí nghiệm, vì sao chỉ nên thay đổi một yếu tố?', 'Để biết yếu tố nào gây ra kết quả', ['Để thí nghiệm lâu hơn','Để có nhiều đồ dùng hơn','Để bỏ qua việc ghi chép'], seed, 'thực hành', 'Giữ các yếu tố khác ổn định giúp so sánh công bằng.'),
    () => shuffledQuestion('Quy tắc an toàn nào đúng?', 'Đọc hướng dẫn và dùng bảo hộ phù hợp', ['Nếm hóa chất lạ','Chạm thiết bị điện bằng tay ướt','Tự ý trộn mọi chất'], seed, 'an toàn', 'Thực hành khoa học luôn cần tuân thủ hướng dẫn an toàn.'),
    () => shuffledQuestion('Đặc điểm chung của sinh vật là gì?', 'Có trao đổi chất và phát triển', ['Luôn đứng yên','Không cần năng lượng','Không phản ứng với môi trường'], seed, 'nhận biết', 'Sinh vật sử dụng năng lượng, phát triển và phản ứng với môi trường.'),
    () => shuffledQuestion('Sự chuyển từ nước lỏng thành hơi gọi là gì?', 'Bay hơi', ['Ngưng tụ','Đông đặc','Nóng chảy'], seed, 'kiến thức', 'Bay hơi là quá trình chất lỏng chuyển thành khí.'),
    () => shuffledQuestion('Nguồn năng lượng nào có thể tái tạo?', 'Ánh sáng Mặt Trời', ['Than đá','Dầu mỏ','Khí tự nhiên'], seed, 'vận dụng', 'Năng lượng Mặt Trời được bổ sung tự nhiên liên tục.'),
    () => shuffledQuestion('Bảng số liệu dùng để làm gì?', 'Tổ chức kết quả để so sánh', ['Thay thế mọi quan sát','Che các kết quả khác nhau','Đoán đáp án'], seed, 'xử lí dữ liệu', 'Bảng giúp sắp xếp dữ liệu rõ ràng.'),
    () => shuffledQuestion('Kết luận khoa học tốt cần dựa trên gì?', 'Dữ liệu và bằng chứng thu được', ['Ý kiến đông người nhất','Kết quả mong muốn','Một dự đoán chưa kiểm tra'], seed, 'lập luận', 'Kết luận phải phù hợp với bằng chứng.'),
    () => shuffledQuestion('Hành động nào góp phần bảo vệ hệ sinh thái?', 'Giảm rác và bảo vệ nơi sống của sinh vật', ['Xả rác xuống sông','Bắt mọi động vật nhìn thấy','Đốt rừng để mở rộng đất'], seed, 'môi trường', 'Giảm ô nhiễm và bảo vệ sinh cảnh giúp duy trì đa dạng sinh học.'),
    () => shuffledQuestion('Trong mạch điện đơn giản, điều gì cần có để đèn sáng?', 'Mạch kín và nguồn điện phù hợp', ['Dây bị đứt','Không có nguồn điện','Chỉ có một bóng đèn rời'], seed, 'vận dụng', 'Dòng điện chỉ chạy khi mạch kín.'),
    () => shuffledQuestion('Sau khi thí nghiệm cho kết quả khác dự đoán, nên làm gì?', 'Kiểm tra quy trình, ghi nhận và thử lại', ['Xóa kết quả','Đổi số liệu cho đúng dự đoán','Kết luận ngay là dụng cụ hỏng'], seed, 'tự đánh giá', 'Kết quả khác dự đoán vẫn có giá trị và cần được kiểm tra trung thực.')
  ];
  return templates[qIndex % templates.length]();
}

function buildSocialQuestion(subjectId, topic, seed, qIndex) {
  const templates = [
    () => shuffledQuestion('Trên bản đồ, kí hiệu và chú giải giúp làm gì?', 'Hiểu đối tượng được biểu diễn', ['Biết tác giả thích màu nào','Thay thế hoàn toàn tỉ lệ','Xác định thời tiết tương lai'], seed, 'bản đồ', 'Chú giải giải thích ý nghĩa của các kí hiệu.'),
    () => shuffledQuestion('Muốn sắp xếp sự kiện lịch sử, cần dựa chủ yếu vào gì?', 'Mốc thời gian', ['Màu của hình minh họa','Độ dài tên sự kiện','Số người kể lại'], seed, 'thời gian lịch sử', 'Mốc thời gian giúp xác định trình tự trước–sau.'),
    () => shuffledQuestion('Nguồn nào đáng tin cậy hơn khi tìm hiểu một sự kiện?', 'Tài liệu có nguồn gốc rõ ràng và được đối chiếu', ['Tin nhắn không rõ người gửi','Một lời đồn','Ảnh đã cắt mất bối cảnh'], seed, 'đánh giá nguồn', 'Nguồn rõ xuất xứ và được đối chiếu giúp giảm sai lệch.'),
    () => shuffledQuestion('Hướng đối diện với hướng Đông là hướng nào?', 'Tây', ['Bắc','Nam','Đông Bắc'], seed, 'địa lí', 'Đông và Tây là hai hướng đối diện.'),
    () => shuffledQuestion('Hành vi nào thể hiện trách nhiệm với cộng đồng?', 'Giữ vệ sinh chung và tuân thủ quy định', ['Làm hỏng tài sản chung','Phát tán tin chưa kiểm chứng','Chen lấn nơi công cộng'], seed, 'công dân', 'Trách nhiệm cộng đồng thể hiện qua hành vi tôn trọng người khác và tài sản chung.'),
    () => shuffledQuestion('Khi có bất đồng, cách xử lí phù hợp là gì?', 'Bình tĩnh trao đổi và tìm giải pháp công bằng', ['Đe dọa người khác','Đăng thông tin riêng tư lên mạng','Từ chối nghe mọi ý kiến'], seed, 'giao tiếp', 'Đối thoại tôn trọng giúp giải quyết bất đồng.'),
    () => shuffledQuestion('Một quyền luôn đi cùng điều gì?', 'Trách nhiệm và giới hạn theo pháp luật', ['Quyền làm mọi điều','Không cần tôn trọng người khác','Không cần chịu hậu quả'], seed, 'pháp luật', 'Việc thực hiện quyền phải tôn trọng quyền của người khác và pháp luật.'),
    () => shuffledQuestion('Trước khi chia sẻ một tin trên mạng, nên làm gì?', 'Kiểm tra nguồn và độ chính xác', ['Chia sẻ ngay nếu tiêu đề hấp dẫn','Xóa tên tác giả','Thêm chi tiết chưa biết'], seed, 'ứng xử số', 'Kiểm chứng giúp hạn chế tin sai.'),
    () => shuffledQuestion('Tỉ lệ bản đồ cho biết điều gì?', 'Mức thu nhỏ khoảng cách thực tế', ['Tuổi của bản đồ','Số màu trên bản đồ','Độ cao của người đọc'], seed, 'bản đồ', 'Tỉ lệ liên hệ khoảng cách trên bản đồ với thực tế.'),
    () => shuffledQuestion(`Khi học chủ đề “${topic}”, nên so sánh các nguồn để làm gì?`, 'Nhận ra điểm giống, khác và độ tin cậy', ['Chọn nguồn dài nhất','Bỏ mọi dữ kiện trái ý','Chỉ nhớ hình ảnh'], seed, 'phân tích', 'So sánh nguồn giúp nhìn vấn đề đầy đủ hơn.'),
    () => shuffledQuestion('Lập ngân sách cá nhân giúp gì?', 'Cân đối thu, chi và mục tiêu tiết kiệm', ['Chi hết tiền nhanh hơn','Không cần theo dõi khoản mua','Đảm bảo mọi khoản đầu tư có lãi'], seed, 'kinh tế', 'Ngân sách giúp chủ động phân bổ nguồn tiền.'),
    () => shuffledQuestion('Cách bảo tồn di sản phù hợp là gì?', 'Tìm hiểu, giữ gìn và tuân thủ quy định bảo vệ', ['Khắc tên lên di tích','Tự ý mang hiện vật về','Lan truyền thông tin sai'], seed, 'di sản', 'Bảo tồn cần tôn trọng giá trị và quy định của di sản.')
  ];
  return templates[qIndex % templates.length]();
}

function buildDigitalQuestion(topic, seed, qIndex) {
  const templates = [
    () => shuffledQuestion('Mật khẩu nào an toàn hơn?', 'Một cụm dài, riêng biệt và khó đoán', ['12345678','ngày sinh của em','password'], seed, 'an toàn số', 'Mật khẩu dài và riêng biệt khó bị đoán hơn.'),
    () => shuffledQuestion('Thuật toán là gì?', 'Dãy bước rõ ràng để giải quyết nhiệm vụ', ['Một thiết bị điện','Một hình nền','Một tài khoản mạng'], seed, 'thuật toán', 'Thuật toán mô tả các bước theo trình tự.'),
    () => shuffledQuestion('Khi nhận đường link đáng ngờ, nên làm gì?', 'Không mở và báo người lớn/quản trị viên', ['Nhập mật khẩu để kiểm tra','Gửi tiếp cho bạn','Tắt cảnh báo trình duyệt'], seed, 'an toàn số', 'Không tương tác với liên kết đáng ngờ giúp tránh lừa đảo.'),
    () => shuffledQuestion('Dữ liệu nào không nên công khai?', 'Mật khẩu và mã xác thực', ['Tên môn học','Một bài toán công khai','Thời khóa biểu mẫu'], seed, 'quyền riêng tư', 'Thông tin xác thực phải được giữ bí mật.'),
    () => shuffledQuestion('Trong lập trình, vòng lặp dùng để làm gì?', 'Lặp lại một nhóm lệnh theo điều kiện', ['Đổi màu màn hình duy nhất','Tắt máy tính','Xóa mọi dữ liệu'], seed, 'lập trình', 'Vòng lặp giảm việc viết lại cùng thao tác.'),
    () => shuffledQuestion('Trước khi dùng ảnh của người khác, nên làm gì?', 'Kiểm tra quyền sử dụng và ghi nguồn khi cần', ['Xóa tên tác giả','Nhận là ảnh của mình','Dùng mọi ảnh vì ở trên mạng'], seed, 'đạo đức số', 'Nội dung trên mạng vẫn có quyền tác giả.'),
    () => shuffledQuestion('Sơ đồ khối giúp ích gì?', 'Biểu diễn luồng xử lí của thuật toán', ['Tăng tốc mạng tự động','Thay mật khẩu','Sửa phần cứng'], seed, 'thuật toán', 'Sơ đồ khối trực quan hóa thứ tự và nhánh xử lí.'),
    () => shuffledQuestion('Tệp sao lưu dùng để làm gì?', 'Khôi phục dữ liệu khi bản chính bị mất hoặc hỏng', ['Làm thiết bị nóng hơn','Thay thế mật khẩu','Chia sẻ dữ liệu công khai'], seed, 'dữ liệu', 'Sao lưu giảm rủi ro mất dữ liệu.'),
    () => shuffledQuestion('Khi chương trình cho kết quả sai, bước phù hợp là gì?', 'Kiểm tra từng bước và dữ liệu đầu vào', ['Viết thêm lệnh ngẫu nhiên','Xóa toàn bộ ngay','Đổi kết quả bằng tay'], seed, 'gỡ lỗi', 'Gỡ lỗi có hệ thống giúp tìm nguyên nhân.'),
    () => shuffledQuestion(`Một sản phẩm số về “${topic}” nên ưu tiên điều gì?`, 'Đúng mục đích, dễ dùng và an toàn', ['Nhiều hiệu ứng nhất','Thu thập mọi dữ liệu','Ẩn hướng dẫn'], seed, 'thiết kế', 'Sản phẩm tốt phục vụ nhu cầu người dùng và bảo vệ dữ liệu.'),
    () => shuffledQuestion('Thông tin nào là dữ liệu đầu vào của máy tính?', 'Văn bản người dùng nhập', ['Kết luận chưa được tính','Ý định không được nhập','Một đáp án chưa lưu'], seed, 'dữ liệu', 'Dữ liệu đầu vào được đưa vào hệ thống để xử lí.'),
    () => shuffledQuestion('Khi làm việc nhóm trực tuyến, nên làm gì?', 'Phân quyền rõ và không chia sẻ tài khoản', ['Dùng chung một mật khẩu','Xóa lịch sử thay đổi','Sửa bài mà không thông báo'], seed, 'hợp tác số', 'Phân quyền và lịch sử thay đổi giúp cộng tác an toàn.')
  ];
  return templates[qIndex % templates.length]();
}

function buildLifeSkillQuestion(topic, seed, qIndex) {
  const templates = [
    () => shuffledQuestion('Trước khi vận động, nên làm gì?', 'Khởi động phù hợp', ['Nhịn uống nước cả ngày','Tập động tác khó ngay','Mang giày không vừa'], seed, 'an toàn', 'Khởi động giúp cơ thể sẵn sàng vận động.'),
    () => shuffledQuestion('Khi cảm thấy đau bất thường lúc tập, nên làm gì?', 'Dừng lại và báo giáo viên/người lớn', ['Cố tập nhanh hơn','Giấu cơn đau','Tự dùng thuốc lạ'], seed, 'sức khỏe', 'Dừng tập giúp hạn chế chấn thương.'),
    () => shuffledQuestion('Trong hoạt động nhóm, cách hợp tác tốt là gì?', 'Phân công rõ và lắng nghe nhau', ['Một người làm hết','Không chia sẻ thông tin','Chê ý tưởng khác'], seed, 'hợp tác', 'Hợp tác cần vai trò rõ ràng và tôn trọng.'),
    () => shuffledQuestion('Khi sáng tạo nghệ thuật, bản phác thảo có tác dụng gì?', 'Thử bố cục và ý tưởng trước khi hoàn thiện', ['Bắt buộc mọi tác phẩm giống nhau','Thay thế hoàn toàn việc quan sát','Chỉ để trang trí bàn'], seed, 'sáng tạo', 'Phác thảo giúp thử nghiệm và điều chỉnh.'),
    () => shuffledQuestion('Nhịp trong âm nhạc giúp gì?', 'Tổ chức âm thanh theo thời gian', ['Thay đổi màu sắc','Đo chiều dài','Xác định hướng Bắc'], seed, 'cảm thụ', 'Nhịp tạo trật tự thời gian cho âm nhạc.'),
    () => shuffledQuestion('Khi dùng dụng cụ thủ công, cần ưu tiên điều gì?', 'Đúng cách và an toàn', ['Dùng càng nhanh càng tốt','Đưa đầu nhọn về phía bạn','Bỏ qua hướng dẫn'], seed, 'công nghệ', 'Dụng cụ cần được dùng đúng chức năng và quy tắc an toàn.'),
    () => shuffledQuestion('Mục tiêu cá nhân tốt nên như thế nào?', 'Cụ thể, vừa sức và có thời hạn', ['Mơ hồ và không cần theo dõi','Phụ thuộc hoàn toàn người khác','Thay đổi mỗi giờ'], seed, 'tự quản lí', 'Mục tiêu rõ giúp lập kế hoạch và kiểm tra tiến độ.'),
    () => shuffledQuestion('Khi chọn nghề, nên tìm hiểu điều gì?', 'Sở thích, năng lực và nhu cầu xã hội', ['Chỉ tên nghề nghe hay','Chỉ ý kiến một người','Bỏ qua điều kiện đào tạo'], seed, 'hướng nghiệp', 'Quyết định nghề nghiệp cần nhiều nguồn thông tin.'),
    () => shuffledQuestion('Hành động nào thể hiện tôn trọng sự khác biệt?', 'Lắng nghe và không chế giễu', ['Ép mọi người giống mình','Đăng ảnh người khác không xin phép','Gắn nhãn tiêu cực'], seed, 'phẩm chất', 'Tôn trọng bắt đầu từ cách lắng nghe và ứng xử.'),
    () => shuffledQuestion(`Muốn tiến bộ ở chủ đề “${topic}”, nên làm gì?`, 'Luyện tập đều, nhận góp ý và điều chỉnh', ['Chỉ làm một lần','Tránh mọi góp ý','So sánh để chê người khác'], seed, 'tự đánh giá', 'Phản hồi và luyện tập có mục tiêu giúp tiến bộ.'),
    () => shuffledQuestion('Sau hoạt động, bước phản tư phù hợp là gì?', 'Nêu điều làm tốt, điều cần sửa và kế hoạch tiếp theo', ['Chỉ xem điểm','Đổ lỗi cho bạn','Không ghi nhận gì'], seed, 'phản tư', 'Phản tư biến trải nghiệm thành bài học.'),
    () => shuffledQuestion('Trong hoạt động quốc phòng–an ninh, nguyên tắc nào quan trọng?', 'Tuân thủ kỷ luật, an toàn và hướng dẫn', ['Tự ý thao tác','Đùa nghịch với thiết bị','Bỏ vị trí không báo'], seed, 'kỷ luật', 'Kỷ luật và an toàn là yêu cầu nền tảng.')
  ];
  return templates[qIndex % templates.length]();
}

function buildSubjectQuestion(grade, subjectId, topic, seed, qIndex) {
  if (subjectId === 'toan') return buildMathQuestion(grade, topic, seed, qIndex);
  if (subjectId === 'tieng_anh') return buildEnglishQuestion(grade, topic, seed, qIndex);
  if (['tieng_viet','ngu_van'].includes(subjectId)) return buildLanguageQuestion(grade, topic, seed, qIndex);
  if (['tnxh','khoa_hoc','khtn','vat_ly','hoa_hoc','sinh_hoc'].includes(subjectId)) return buildScienceQuestion(subjectId, topic, seed, qIndex);
  if (['lich_su_dia_li','lich_su','dia_li','dao_duc','gdcd','gdktepl','dia_phuong'].includes(subjectId)) return buildSocialQuestion(subjectId, topic, seed, qIndex);
  if (['tin_hoc','cong_nghe','tin_hoc_cong_nghe'].includes(subjectId)) return buildDigitalQuestion(topic, seed, qIndex);
  return buildLifeSkillQuestion(topic, seed, qIndex);
}

function lessonThemesFor(grade, subjectId) {
  const explicit = GRADE_THEMES[grade]?.[subjectId];
  if (explicit?.length) return explicit;
  const focus = GRADE_FOCUS[grade] || GRADE_FOCUS[1];
  return (TOPICS[subjectId] || ['Kiến thức nền tảng']).map((topic, index) => `${topic} — ${focus}${index % 2 ? ' qua thực hành' : ''}`);
}

function lessonCountFor(grade, subjectId) {
  if (grade <= 2) return subjectId === 'tieng_anh' ? 12 : 18;
  if (grade <= 5) return ['gdtc','hdtn','nghe_thuat','dao_duc'].includes(subjectId) ? 16 : 20;
  if (grade <= 9) return ['gdtc','hdtnhn','dia_phuong','nghe_thuat'].includes(subjectId) ? 18 : 24;
  if (['gdtc','gdqp','hdtnhn','dia_phuong','am_nhac','mi_thuat'].includes(subjectId)) return 18;
  return 24;
}

function lessonPhase(index, themeCount) {
  const cycle = Math.floor(index / themeCount);
  return ['Khám phá','Hình thành kiến thức','Luyện tập','Vận dụng'][cycle % 4];
}

function makeLesson(grade, subjectId, index) {
  const [baseSubjectName] = SUBJECTS[subjectId];
  const themes = lessonThemesFor(grade, subjectId);
  const topic = themes[index % themes.length];
  const phase = lessonPhase(index, themes.length);
  const unit = Math.floor(index / 4) + 1;
  const lessonNo = index + 1;
  const isEnglish = subjectId === 'tieng_anh';
  const isLiterature = subjectId === 'ngu_van' || subjectId === 'tieng_viet';
  const isCheckpoint = lessonNo % 4 === 0;
  const unitTitle = themes[(unit - 1) % themes.length];
  const difficulty = grade <= 2
    ? (phase === 'Khám phá' ? 'Làm quen' : 'Cơ bản')
    : grade <= 5
      ? (phase === 'Vận dụng' ? 'Vận dụng' : 'Cơ bản')
      : grade <= 9
        ? (phase === 'Khám phá' ? 'Cơ bản' : phase === 'Vận dụng' ? 'Nâng cao' : 'Trung bình')
        : (phase === 'Vận dụng' ? 'Nâng cao' : 'Trung bình');
  const title = `${isCheckpoint ? 'Mốc kiểm tra' : `Bài ${lessonNo}`}: ${topic}${index >= themes.length ? ` — ${phase}` : ''}`;
  const seed = hash(`${PROGRAM_VERSION}-${grade}-${subjectId}-${index}-${topic}`);
  const levelText = grade <= 2 ? 'nhận biết bằng hình ảnh, thao tác và lời nói ngắn' : grade <= 5 ? 'hiểu, thực hành và giải thích bằng ví dụ gần gũi' : grade <= 9 ? 'lập luận, phân tích dữ kiện và vận dụng vào tình huống' : 'phân tích, đánh giá, mô hình hóa và vận dụng độc lập';
  const theoryPack = buildLessonTheoryV14({ grade, subjectId, topic, subjectName: baseSubjectName, lessonNo });
  const theory = theoryPack.theory;
  const objectives = [
    `Nhận biết và giải thích được nội dung chính của ${topic.toLowerCase()}.`,
    `Hoàn thành nhiệm vụ ở mức phù hợp với học sinh lớp ${grade}.`,
    `Vận dụng kiến thức vào một tình huống mới và tự kiểm tra kết quả.`
  ];
  const keyPoints = [
    `Bài học thuộc hồ sơ riêng của lớp ${grade}.`,
    `Đọc kĩ dữ kiện, từ khóa và yêu cầu trước khi trả lời.`,
    `Điểm phải trên ${PASS_SCORE}/10 mới mở bài tiếp theo; lỗi sai sẽ được đưa vào khu vực ôn tập.`
  ];
  const questions = Array.from({ length: 12 }, (_, qIndex) => ({
    id: `q${qIndex + 1}`,
    ...buildSubjectQuestion(grade, subjectId, topic, hash(`${seed}-${qIndex}`), qIndex)
  }));
  return {
    id: `lesson-${lessonNo}`,
    order: lessonNo,
    unit,
    unitTitle,
    phase,
    difficulty,
    isCheckpoint,
    checkpointLabel: isCheckpoint ? `Kiểm tra nhanh cuối chặng ${unit}` : null,
    title,
    topic,
    gradeFocus: GRADE_FOCUS[grade],
    estimatedMinutes: grade <= 2 ? 18 : grade <= 5 ? 24 : grade <= 9 ? 32 : 38,
    masteryTarget: 9,
    theory,
    theorySections: theoryPack.theorySections,
    glossary: theoryPack.glossary,
    commonMistakes: theoryPack.commonMistakes,
    quickChecks: theoryPack.quickChecks,
    theoryVersion: theoryPack.theoryVersion,
    objectives,
    keyPoints,
    learningOutcomes: objectives,
    competencies: competencyProfile(subjectId),
    qualities: qualityProfile(subjectId, index),
    assessment: {
      type: isCheckpoint ? 'formative-checkpoint' : 'regular',
      label: isCheckpoint ? `Đánh giá thường xuyên cuối chặng ${unit}` : 'Đánh giá thường xuyên trong bài',
      evidence: ['Quan sát quá trình học','Nhiệm vụ luyện tập','Bài kiểm tra trên máy'],
      rubricLevels: grade <= 5 ? ['Hoàn thành tốt','Hoàn thành','Chưa hoàn thành'] : ['Tốt','Khá','Đạt','Chưa đạt'],
      note: 'Kết quả trên web là minh chứng hỗ trợ, không thay thế điểm và nhận xét chính thức của nhà trường.'
    },
    studySteps: [
      'Khởi động bằng câu hỏi hoặc tình huống gần gũi.',
      'Đọc lý thuyết và tự nói lại ý chính bằng lời của em.',
      'Xem ví dụ, xác định dữ kiện và cách giải quyết.',
      'Làm nhiệm vụ luyện tập không tính điểm.',
      `Làm bài kiểm tra; cần trên ${PASS_SCORE}/10 để mở bài sau.`
    ],
    practiceTasks: [
      `Tóm tắt ${topic.toLowerCase()} bằng 3 ý chính.`,
      `Tự tạo một ví dụ mới phù hợp với học sinh lớp ${grade}.`,
      'Ghi một lỗi dễ mắc và cách tự kiểm tra để tránh lặp lại.'
    ],
    questions,
    listening: isEnglish ? {
      text: grade <= 2 ? `Hello. This is English for grade ${grade}. Today we learn ${topic.toLowerCase()}.` : grade <= 5 ? `Today, grade ${grade} students are learning about ${topic.toLowerCase()}. Listen carefully for the main idea.` : `In this grade ${grade} lesson, the speaker discusses ${topic.toLowerCase()} and gives one supporting detail.`,
      prompt: grade <= 5 ? 'What is the main topic?' : 'What is the main idea and one supporting detail?',
      expectedKeywords: topic.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5)
    } : null,
    speaking: isEnglish ? {
      prompt: grade <= 2 ? `Repeat the sentence about ${topic.toLowerCase()}.` : grade <= 5 ? `Say three sentences about ${topic.toLowerCase()}.` : `Speak for ${grade <= 9 ? '30–45' : '45–60'} seconds about ${topic.toLowerCase()} and include an example.`,
      reference: `I am a grade ${grade} student learning ${topic.toLowerCase()}. I can explain the main idea and give a clear example.`
    } : null,
    writing: isLiterature && index % 3 === 2 ? {
      prompt: grade <= 2 ? `Viết ${grade === 1 ? '2–3' : '3–5'} câu về ${topic.toLowerCase()}.` : grade <= 5 ? `Viết một đoạn ${grade + 3}–${grade + 6} câu về ${topic.toLowerCase()}.` : `Viết bài khoảng ${grade <= 9 ? '300–500' : '500–800'} chữ phân tích hoặc trình bày suy nghĩ về ${topic.toLowerCase()}.`,
      rubric: ['Đúng yêu cầu','Bố cục','Lập luận và dẫn chứng','Diễn đạt','Chính tả và sáng tạo']
    } : null
  };
}

function getSubject(grade, subjectId, { includeLessons = false } = {}) {
  const safeGrade = Math.min(12, Math.max(1, Number(grade) || 1));
  const valid = subjectIdsForGrade(safeGrade).includes(subjectId);
  if (!valid || !SUBJECTS[subjectId]) return null;
  const [baseName, icon] = SUBJECTS[subjectId];
  const lessonCount = lessonCountFor(safeGrade, subjectId);
  const lessons = Array.from({ length: lessonCount }, (_, index) => makeLesson(safeGrade, subjectId, index));
  const optional = OPTIONAL_BY_GRADE[safeGrade]?.has(subjectId) || false;
  return {
    id: subjectId,
    name: `${baseName} ${safeGrade}`,
    baseName,
    icon,
    compulsory: !optional,
    statusLabel: optional ? (safeGrade <= 2 ? 'Môn làm quen tự chọn' : 'Môn lựa chọn') : 'Môn bắt buộc',
    gradeFocus: GRADE_FOCUS[safeGrade],
    competencyProfile: competencyProfile(subjectId),
    lessonCount,
    units: Math.ceil(lessonCount / 4),
    unitMap: Array.from({ length: Math.ceil(lessonCount / 4) }, (_, index) => {
      const first = lessons[index * 4];
      const last = lessons[Math.min(lessons.length - 1, index * 4 + 3)];
      return {
        unit: index + 1,
        title: first?.unitTitle || `Chặng ${index + 1}`,
        fromLesson: first?.id,
        toLesson: last?.id,
        lessonCount: Math.min(4, lessonCount - index * 4)
      };
    }),
    lessons: includeLessons ? lessons : lessons.map(({ questions, theory, theorySections, glossary, commonMistakes, quickChecks, ...lesson }) => ({ ...lesson, questionCount: questions.length, hasTheory: true }))
  };
}

function getCatalog(grade) {
  const safeGrade = Math.min(12, Math.max(1, Number(grade) || 1));
  const subjects = subjectIdsForGrade(safeGrade).map(id => getSubject(safeGrade, id));
  return {
    programVersion: PROGRAM_VERSION,
    grade: safeGrade,
    gradeName: `Lớp ${safeGrade}`,
    gradeFocus: GRADE_FOCUS[safeGrade],
    passScore: PASS_SCORE,
    unlockRule: `Điểm phải trên ${PASS_SCORE}/10`,
    framework: { program: 'Chương trình GDPT 2018', orientation: 'Phát triển phẩm chất và năng lực', qualities: CORE_QUALITIES, generalCompetencies: GENERAL_COMPETENCIES },
    note: 'Mỗi lớp có hồ sơ môn và bài riêng. Nội dung nguyên bản bám yêu cầu cần đạt của CTGDPT 2018; nhà trường cấu hình theo kế hoạch giáo dục và bộ sách đang sử dụng.',
    subjectSignature: subjects.map(subject => `${subject.id}:${subject.lessonCount}`).join('|'),
    subjects
  };
}

function getLesson(grade, subjectId, lessonId) {
  const safeGrade = Math.min(12, Math.max(1, Number(grade) || 1));
  const subject = getSubject(safeGrade, subjectId, { includeLessons: true });
  if (!subject) return null;
  const lesson = subject.lessons.find(item => item.id === lessonId);
  if (!lesson) return null;
  return { programVersion: PROGRAM_VERSION, grade: safeGrade, gradeFocus: GRADE_FOCUS[safeGrade], subject: { id: subject.id, name: subject.name, baseName: subject.baseName, icon: subject.icon }, lesson };
}

function scoreLesson(lesson, answers = {}) {
  let correct = 0;
  const details = lesson.questions.map(question => {
    const chosen = Number(answers[question.id]);
    const isCorrect = chosen === question.answer;
    if (isCorrect) correct += 1;
    return {
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      chosen,
      answer: question.answer,
      correctAnswer: question.options[question.answer],
      chosenAnswer: Number.isInteger(chosen) ? question.options[chosen] : null,
      isCorrect,
      skill: question.skill,
      explanation: question.explanation
    };
  });
  const score = Number(((correct / lesson.questions.length) * 10).toFixed(1));
  return { correct, total: lesson.questions.length, score, passed: score > PASS_SCORE, details };
}

module.exports = { PROGRAM_VERSION, PASS_SCORE, GRADE_SUBJECTS, GRADE_FOCUS, CORE_QUALITIES, GENERAL_COMPETENCIES, SUBJECT_COMPETENCIES, getCatalog, getSubject, getLesson, scoreLesson };

