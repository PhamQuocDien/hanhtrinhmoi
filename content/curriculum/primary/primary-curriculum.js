'use strict';
const { createLessonQualityProfile } = require('../../quality/learning-quality');
const { buildSchoolTheory } = require('../../quality/theory-content');

const { OFFICIAL_REFERENCES, buildLessonAlignment } = require('../curriculum-alignment');

// Original, standards-aligned curriculum scaffold. This is not a transcription of any publisher's textbook.
const PROGRAMS = [
  { code: 'ctst', name: 'Chân trời sáng tạo', shortName: 'Chân trời sáng tạo', approach: 'Khám phá, kết nối trải nghiệm và vận dụng kiến thức' },
  { code: 'kntt', name: 'Kết nối tri thức với cuộc sống', shortName: 'Kết nối tri thức', approach: 'Kết nối kiến thức với tình huống gần gũi trong cuộc sống' },
  { code: 'canhdieu', name: 'Cánh Diều', shortName: 'Cánh Diều', approach: 'Học qua hoạt động, thực hành và vận dụng' }
];

const SUBJECTS = {
  math: { name: 'Toán', icon: '➗', color: 'blue', required: true, gradeBands: [1, 2, 3, 4, 5], strands: ['Số và phép tính', 'Hình học và đo lường', 'Thống kê, xác suất và giải quyết vấn đề'] },
  vietnamese: { name: 'Tiếng Việt', icon: '📖', color: 'rose', required: true, gradeBands: [1, 2, 3, 4, 5], strands: ['Đọc', 'Viết', 'Nói và nghe', 'Kiến thức tiếng Việt'] },
  ethics: { name: 'Đạo đức', icon: '💛', color: 'amber', required: true, gradeBands: [1, 2, 3, 4, 5], strands: ['Bản thân', 'Gia đình và nhà trường', 'Cộng đồng'] },
  nature: { name: 'Tự nhiên và Xã hội', icon: '🌿', color: 'green', required: true, gradeBands: [1, 2, 3], strands: ['Con người và sức khỏe', 'Gia đình, trường học và cộng đồng', 'Thực vật, động vật và môi trường'] },
  science: { name: 'Khoa học', icon: '🔬', color: 'green', required: true, gradeBands: [4, 5], strands: ['Chất và năng lượng', 'Thực vật và động vật', 'Con người và sức khỏe', 'Sinh vật và môi trường'] },
  history_geo: { name: 'Lịch sử và Địa lí', icon: '🗺️', color: 'orange', required: true, gradeBands: [4, 5], strands: ['Địa phương và bản đồ', 'Thiên nhiên', 'Dân cư và hoạt động sản xuất', 'Lịch sử Việt Nam'] },
  english: { name: 'Tiếng Anh', icon: '🔤', color: 'purple', required: false, gradeBands: [1, 2, 3, 4, 5], strands: ['Nghe và nói', 'Từ vựng theo chủ đề', 'Đọc hiểu', 'Giao tiếp'] },
  ict: { name: 'Tin học và Công nghệ', icon: '💻', color: 'cyan', required: true, gradeBands: [3, 4, 5], strands: ['Sử dụng thiết bị', 'Thông tin và giải quyết vấn đề', 'Thiết kế và kĩ thuật'] },
  music: { name: 'Âm nhạc', icon: '🎵', color: 'purple', required: true, gradeBands: [1, 2, 3, 4, 5], strands: ['Hát', 'Nghe nhạc', 'Nhạc cụ và vận động', 'Đọc nhạc'] },
  art: { name: 'Mĩ thuật', icon: '🎨', color: 'pink', required: true, gradeBands: [1, 2, 3, 4, 5], strands: ['Quan sát và nhận thức', 'Sáng tạo và ứng dụng', 'Phân tích và đánh giá'] },
  pe: { name: 'Giáo dục thể chất', icon: '🏃', color: 'lime', required: true, gradeBands: [1, 2, 3, 4, 5], strands: ['Vận động cơ bản', 'Rèn luyện sức khỏe', 'Trò chơi vận động', 'An toàn khi tập luyện'] },
  experience: { name: 'Hoạt động trải nghiệm', icon: '🌟', color: 'orange', required: true, gradeBands: [1, 2, 3, 4, 5], strands: ['Phát triển bản thân', 'Gia đình và cộng đồng', 'Thiên nhiên và môi trường', 'Hướng nghiệp phù hợp lứa tuổi'] }
};

const UNIT_SEEDS = {
  math: {
    1: [['Làm quen với số', ['Đếm, đọc và viết số trong phạm vi 10', 'So sánh số và sắp xếp theo thứ tự']], ['Phép cộng và phép trừ', ['Cộng bằng cách gộp nhóm đồ vật', 'Trừ bằng cách bớt đi trong tình huống']], ['Hình học và vị trí', ['Nhận biết hình phẳng và khối quen thuộc', 'Xác định vị trí và quy luật đơn giản']], ['Đo lường và giải quyết vấn đề', ['So sánh độ dài, khối lượng và dung tích', 'Giải bài toán bằng hình ảnh và lời nói']]],
    2: [['Số và cấu tạo số', ['Đọc, viết và phân tích số đến 100', 'So sánh và làm tròn trong tình huống phù hợp']], ['Phép tính', ['Cộng, trừ có nhớ theo hàng', 'Làm quen phép nhân và phép chia']], ['Hình học và đo lường', ['Nhận biết đường thẳng, đoạn thẳng và hình', 'Đo độ dài và xem giờ']], ['Bài toán thực tế', ['Tóm tắt dữ kiện bằng sơ đồ', 'Chọn phép tính và kiểm tra kết quả']]],
    3: [['Số trong phạm vi lớn hơn', ['Đọc, viết và phân tích số đến 10 000', 'So sánh số và xác định quy luật']], ['Nhân và chia', ['Bảng nhân, bảng chia và ý nghĩa phép tính', 'Giải bài toán có hai bước tính']], ['Hình học và đại lượng', ['Chu vi hình đơn giản', 'Đo độ dài, khối lượng và thời gian']], ['Phân số và dữ liệu', ['Làm quen với phân số qua hình ảnh', 'Đọc bảng số liệu và biểu đồ tranh']]],
    4: [['Số tự nhiên và phép tính', ['Cấu tạo số nhiều chữ số', 'Tính toán và ước lượng kết quả']], ['Phân số', ['Nhận biết, so sánh phân số', 'Cộng trừ phân số cùng mẫu số']], ['Hình học và đo lường', ['Góc, đường thẳng vuông góc và song song', 'Diện tích hình và đổi đơn vị']], ['Thống kê và vận dụng', ['Đọc biểu đồ cột', 'Giải bài toán nhiều bước']]],
    5: [['Số thập phân', ['Đọc, viết và so sánh số thập phân', 'Làm tròn và ước lượng số thập phân']], ['Tính toán và tỉ số', ['Cộng, trừ, nhân, chia số thập phân', 'Tỉ số phần trăm trong đời sống']], ['Hình học và đo lường', ['Diện tích tam giác và hình thang', 'Thể tích hình hộp chữ nhật']], ['Dữ liệu và giải quyết vấn đề', ['Đọc, phân tích bảng và biểu đồ', 'Lập kế hoạch giải bài toán thực tế']]]
  },
  vietnamese: {
    1: [['Làm quen chữ và âm', ['Nhận biết chữ cái, âm và tiếng', 'Ghép vần, đọc và viết tiếng quen thuộc']], ['Đọc hiểu ban đầu', ['Đọc câu ngắn và tìm thông tin trực tiếp', 'Kể lại sự việc theo tranh']], ['Nói và nghe', ['Lắng nghe và trả lời câu hỏi', 'Nói lời chào hỏi, cảm ơn và xin lỗi']], ['Viết và trình bày', ['Viết câu ngắn đúng nội dung', 'Nghe viết và tự kiểm tra bài']]],
    2: [['Đọc thành tiếng', ['Đọc trôi chảy đoạn ngắn', 'Nhận biết nhân vật và sự việc']], ['Từ và câu', ['Mở rộng vốn từ theo chủ điểm', 'Sắp xếp từ thành câu rõ nghĩa']], ['Đọc hiểu', ['Tìm ý chính và chi tiết trong bài', 'Nêu suy nghĩ về nhân vật hoặc sự việc']], ['Viết và giao tiếp', ['Viết đoạn ngắn theo gợi ý', 'Kể lại trải nghiệm theo trình tự']]],
    3: [['Đọc và hiểu văn bản', ['Xác định nội dung chính và chi tiết', 'Nhận biết đặc điểm nhân vật và hình ảnh']], ['Từ ngữ và ngữ pháp', ['Dùng từ theo nghĩa trong ngữ cảnh', 'Nhận biết câu và dấu câu thông dụng']], ['Viết đoạn văn', ['Lập ý cho đoạn văn', 'Viết và chỉnh sửa đoạn văn']], ['Nói và nghe', ['Trình bày ý kiến có lí do', 'Lắng nghe và phản hồi phù hợp']]],
    4: [['Đọc hiểu đa dạng văn bản', ['Tìm chủ đề và thông điệp của bài đọc', 'Phân biệt thông tin chính và chi tiết']], ['Từ, câu và biện pháp diễn đạt', ['Mở rộng vốn từ và sử dụng từ chính xác', 'Liên kết câu trong đoạn văn']], ['Viết bài theo mục đích', ['Lập dàn ý cho bài văn', 'Viết, rà soát và hoàn thiện bài']], ['Trao đổi và trình bày', ['Nêu ý kiến có dẫn chứng', 'Tóm tắt và trình bày thông tin']]],
    5: [['Đọc hiểu và cảm thụ', ['Phân tích chủ đề, hình ảnh và chi tiết', 'Đánh giá thông điệp bằng căn cứ trong văn bản']], ['Tiếng Việt trong ngữ cảnh', ['Sử dụng từ ngữ chính xác, giàu sắc thái', 'Liên kết đoạn và lựa chọn cách diễn đạt']], ['Viết bài hoàn chỉnh', ['Xây dựng dàn ý và phát triển luận điểm phù hợp lứa tuổi', 'Tự chỉnh sửa nội dung, chính tả và bố cục']], ['Giao tiếp và thuyết trình', ['Trình bày ý kiến có lí lẽ và ví dụ', 'Tóm tắt nguồn thông tin và phản hồi']]]
  },
  ethics: {
    all: [['Em và bản thân', ['Nhận biết cảm xúc và điểm mạnh của bản thân', 'Giữ lời hứa và hoàn thành nhiệm vụ']], ['Gia đình và nhà trường', ['Thể hiện sự quan tâm và biết ơn', 'Tôn trọng quy định chung']], ['Cộng đồng và ứng xử', ['Chia sẻ, hợp tác và tôn trọng khác biệt', 'Giải quyết bất đồng bằng cách phù hợp']], ['An toàn và trách nhiệm', ['Nhận biết tình huống không an toàn', 'Lựa chọn hành vi có trách nhiệm']]]
  },
  nature: { all: [['Gia đình và trường học', ['Những người thân và việc làm trong gia đình', 'Trường học, thầy cô và bạn bè']], ['Con người và sức khỏe', ['Các bộ phận cơ thể và giác quan', 'Thói quen vệ sinh và dinh dưỡng']], ['Thế giới sống', ['Nhu cầu sống của thực vật và động vật', 'Quan sát và mô tả sự thay đổi quanh em']], ['Cộng đồng và môi trường', ['Nơi em sống và hoạt động cộng đồng', 'Giữ vệ sinh, an toàn và bảo vệ môi trường']]] },
  science: { all: [['Chất và năng lượng', ['Đặc điểm, trạng thái và sự biến đổi của chất', 'Vai trò và sử dụng năng lượng an toàn']], ['Thực vật và động vật', ['Nhu cầu sống và vòng đời của sinh vật', 'Quan hệ giữa sinh vật với môi trường']], ['Con người và sức khỏe', ['Cơ quan và chức năng cơ bản của cơ thể', 'Dinh dưỡng, vận động và phòng tránh bệnh']], ['Sinh vật và môi trường', ['Chuỗi thức ăn và cân bằng tự nhiên', 'Bảo vệ tài nguyên và môi trường sống']]] },
  history_geo: { all: [['Không gian địa lí', ['Đọc lược đồ, bản đồ và chú giải', 'Xác định vị trí và đặc điểm địa phương']], ['Thiên nhiên và con người', ['Địa hình, khí hậu và tài nguyên', 'Dân cư, hoạt động sản xuất và sinh hoạt']], ['Lịch sử địa phương và đất nước', ['Tìm hiểu sự kiện qua tư liệu và mốc thời gian', 'Nhận biết nhân vật, di tích và truyền thống']], ['Kết nối vùng miền', ['So sánh đặc điểm các vùng', 'Trân trọng di sản và trách nhiệm công dân']]] },
  english: { all: [['Giao tiếp hằng ngày', ['Chào hỏi và giới thiệu bản thân', 'Hỏi đáp về gia đình và trường học']], ['Từ vựng theo chủ đề', ['Đồ vật, màu sắc và số đếm', 'Hoạt động, thức ăn và thời gian']], ['Nghe và đọc hiểu', ['Nghe tìm từ khóa trong lời nói ngắn', 'Đọc câu và đoạn rất ngắn']], ['Nói và viết', ['Nói theo mẫu giao tiếp', 'Viết câu ngắn theo gợi ý']]] },
  ict: { all: [['Thiết bị và an toàn số', ['Nhận biết thiết bị và chức năng cơ bản', 'Bảo vệ thông tin và sử dụng thiết bị an toàn']], ['Thông tin và dữ liệu', ['Tìm, phân loại và sắp xếp thông tin', 'Mô tả quy trình và thuật toán đơn giản']], ['Sáng tạo với công nghệ', ['Tạo sản phẩm số đơn giản', 'Thực hiện quy trình thiết kế và thử nghiệm']], ['Giải quyết vấn đề', ['Chia nhỏ nhiệm vụ và kiểm tra kết quả', 'Đánh giá sản phẩm theo tiêu chí']]] },
  music: { all: [['Lắng nghe và cảm nhận', ['Nhận biết âm thanh, nhịp điệu và sắc thái', 'Lắng nghe và mô tả cảm nhận']], ['Hát và thể hiện', ['Hát rõ lời, đúng giai điệu phù hợp lứa tuổi', 'Thể hiện bài hát cùng vận động']], ['Nhạc cụ và tiết tấu', ['Giữ nhịp bằng vận động hoặc nhạc cụ', 'Phối hợp theo nhóm']], ['Sáng tạo âm nhạc', ['Tạo mẫu tiết tấu đơn giản', 'Trình bày và nhận xét sản phẩm']]] },
  art: { all: [['Quan sát hình ảnh', ['Nhận biết đường nét, hình, màu và chất liệu', 'Quan sát đồ vật và cảnh vật quanh em']], ['Thử nghiệm tạo hình', ['Kết hợp hình và màu theo ý tưởng', 'Lựa chọn chất liệu và công cụ an toàn']], ['Sáng tạo sản phẩm', ['Tạo sản phẩm theo chủ đề', 'Điều chỉnh sản phẩm theo mục tiêu']], ['Chia sẻ và cảm nhận', ['Giới thiệu ý tưởng của sản phẩm', 'Nhận xét tác phẩm bằng ngôn ngữ tích cực']]] },
  pe: { all: [['Vận động cơ bản', ['Thực hiện tư thế và vận động phù hợp', 'Phối hợp động tác theo hiệu lệnh']], ['Rèn luyện thể lực', ['Luyện sức bền, nhanh nhẹn và khéo léo', 'Theo dõi cảm giác cơ thể khi tập']], ['Trò chơi vận động', ['Hiểu luật và phối hợp trong trò chơi', 'Tôn trọng bạn và tinh thần fair-play']], ['An toàn khi tập luyện', ['Khởi động và hồi tĩnh đúng cách', 'Nhận biết nguy cơ và thực hành an toàn']]] },
  experience: { all: [['Hiểu mình và tự phục vụ', ['Nhận biết sở thích, cảm xúc và khả năng', 'Lập kế hoạch việc cá nhân phù hợp']], ['Gia đình và cộng đồng', ['Chia sẻ việc nhà và trách nhiệm', 'Hợp tác và giao tiếp tích cực']], ['Thiên nhiên và môi trường', ['Quan sát môi trường xung quanh', 'Thực hiện hành động xanh phù hợp']], ['Tổng kết và định hướng', ['Nhìn lại trải nghiệm và điều đã học', 'Đặt mục tiêu nhỏ cho giai đoạn tiếp theo']]] }
};

const MATH_QUESTIONS = {
  1: [
    [{ prompt: 'Có 3 quả táo, thêm 2 quả. Có tất cả bao nhiêu quả?', options: ['4', '5', '6', '7'], correctAnswer: '5' }, { prompt: 'Điền số còn thiếu: 4 + __ = 6', accepted: ['2'], correctAnswer: '2' }],
    [{ prompt: 'Có 5 chiếc kẹo, ăn 2 chiếc. Còn lại bao nhiêu?', options: ['2', '3', '4', '7'], correctAnswer: '3' }, { prompt: 'Điền kết quả: 7 - 3 = __', accepted: ['4'], correctAnswer: '4' }],
    [{ prompt: 'Hình nào có 3 cạnh?', options: ['Hình tròn', 'Hình tam giác', 'Hình vuông', 'Hình chữ nhật'], correctAnswer: 'Hình tam giác' }, { prompt: 'Trong hai số 8 và 5, số lớn hơn là số nào?', options: ['5', '8'], correctAnswer: '8' }],
    [{ prompt: 'Bút chì dài hơn tẩy. Vật nào ngắn hơn?', options: ['Bút chì', 'Cục tẩy'], correctAnswer: 'Cục tẩy' }, { prompt: 'Điền số tiếp theo: 2, 4, 6, __', accepted: ['8'], correctAnswer: '8' }]
  ],
  2: [
    [{ prompt: 'Số gồm 4 chục và 7 đơn vị là số nào?', options: ['74', '47', '407', '40'], correctAnswer: '47' }, { prompt: 'Điền số còn thiếu: 35, 36, __, 38', accepted: ['37'], correctAnswer: '37' }],
    [{ prompt: 'Tính 28 + 17.', options: ['35', '45', '46', '55'], correctAnswer: '45' }, { prompt: 'Có 4 nhóm, mỗi nhóm 3 bông hoa. Có tất cả bao nhiêu bông?', accepted: ['12', 'mười hai'], correctAnswer: '12' }],
    [{ prompt: 'Một đoạn thẳng dài 8 cm, đoạn khác dài 5 cm. Tổng độ dài là bao nhiêu?', options: ['3 cm', '13 cm', '40 cm', '85 cm'], correctAnswer: '13 cm' }, { prompt: 'Kim phút chỉ số 12, kim giờ chỉ số 7. Đồng hồ chỉ mấy giờ?', accepted: ['7 giờ', '7'], correctAnswer: '7 giờ' }],
    [{ prompt: 'Lan có 24 nhãn vở, tặng bạn 9 nhãn. Lan còn bao nhiêu?', options: ['13', '14', '15', '16'], correctAnswer: '15' }, { prompt: 'Điền kết quả: 5 × 2 = __', accepted: ['10'], correctAnswer: '10' }]
  ],
  3: [
    [{ prompt: 'Trong số 3 572, chữ số 5 thuộc hàng nào?', options: ['Hàng đơn vị', 'Hàng chục', 'Hàng trăm', 'Hàng nghìn'], correctAnswer: 'Hàng trăm' }, { prompt: 'Điền số còn thiếu: 1 200, 1 300, __', accepted: ['1400', '1 400'], correctAnswer: '1 400' }],
    [{ prompt: 'Tính 7 × 8.', options: ['48', '54', '56', '64'], correctAnswer: '56' }, { prompt: 'Chia đều 36 chiếc bút cho 4 bạn. Mỗi bạn được mấy chiếc?', accepted: ['9'], correctAnswer: '9' }],
    [{ prompt: 'Hình chữ nhật dài 6 cm và rộng 3 cm. Chu vi là bao nhiêu?', options: ['9 cm', '18 cm', '18 cm²', '36 cm'], correctAnswer: '18 cm' }, { prompt: '1 m bằng bao nhiêu xăng-ti-mét?', accepted: ['100', '100 cm'], correctAnswer: '100 cm' }],
    [{ prompt: 'Một phần được tô màu trong 4 phần bằng nhau được viết là phân số nào?', options: ['1/2', '1/3', '1/4', '4/1'], correctAnswer: '1/4' }, { prompt: 'Bảng có các số 2, 5, 4. Số lớn nhất là bao nhiêu?', accepted: ['5'], correctAnswer: '5' }]
  ],
  4: [
    [{ prompt: 'Trong số 48 216, chữ số 8 có giá trị là bao nhiêu?', options: ['8', '80', '800', '8 000'], correctAnswer: '8 000' }, { prompt: 'Làm tròn 3 462 đến hàng trăm được số nào?', accepted: ['3500', '3 500'], correctAnswer: '3 500' }],
    [{ prompt: 'Phân số nào bằng 1/2?', options: ['2/3', '2/4', '3/5', '4/6'], correctAnswer: '2/4' }, { prompt: 'Tính 1/5 + 2/5 = __/5', accepted: ['3'], correctAnswer: '3' }],
    [{ prompt: 'Hai đường thẳng tạo góc vuông được gọi là gì?', options: ['Song song', 'Vuông góc', 'Trùng nhau', 'Cong'], correctAnswer: 'Vuông góc' }, { prompt: 'Hình chữ nhật dài 8 cm, rộng 4 cm. Diện tích là bao nhiêu?', accepted: ['32', '32 cm2', '32 cm²'], correctAnswer: '32 cm²' }],
    [{ prompt: 'Biểu đồ cột thường dùng để làm gì?', options: ['So sánh số liệu', 'Đo nhiệt độ trực tiếp', 'Thay cho mọi phép tính', 'Vẽ đường thẳng'], correctAnswer: 'So sánh số liệu' }, { prompt: 'Một lớp có 18 bạn nam và 17 bạn nữ. Lớp có tất cả bao nhiêu bạn?', accepted: ['35'], correctAnswer: '35' }]
  ],
  5: [
    [{ prompt: 'Chữ số 7 trong số 12,75 có giá trị là gì?', options: ['7 đơn vị', '7 phần mười', '7 phần trăm', '70'], correctAnswer: '7 phần mười' }, { prompt: 'Điền kết quả: 2,5 + 1,75 = __', accepted: ['4,25', '4.25'], correctAnswer: '4,25' }],
    [{ prompt: '25% của 200 là bao nhiêu?', options: ['25', '40', '50', '75'], correctAnswer: '50' }, { prompt: 'Tính 3,6 × 2 = __', accepted: ['7,2', '7.2'], correctAnswer: '7,2' }],
    [{ prompt: 'Diện tích hình tam giác có đáy 8 cm, chiều cao 5 cm là bao nhiêu?', options: ['13 cm²', '20 cm²', '40 cm²', '26 cm²'], correctAnswer: '20 cm²' }, { prompt: 'Hình hộp chữ nhật có chiều dài 4 cm, rộng 3 cm, cao 2 cm. Thể tích là bao nhiêu?', accepted: ['24', '24 cm3', '24 cm³'], correctAnswer: '24 cm³' }],
    [{ prompt: 'Một sản phẩm giá 200 000 đồng được giảm 10%. Số tiền giảm là bao nhiêu?', options: ['10 000 đồng', '20 000 đồng', '30 000 đồng', '40 000 đồng'], correctAnswer: '20 000 đồng' }, { prompt: 'Giá trị trung bình của 4, 6 và 8 là bao nhiêu?', accepted: ['6'], correctAnswer: '6' }]
  ]
};

function subjectsForGrade(grade) {
  const base = ['vietnamese', 'math', 'ethics'];
  if (grade <= 3) base.push('nature'); else base.push('science', 'history_geo');
  base.push('english');
  if (grade >= 3) base.push('ict');
  base.push('music', 'art', 'pe', 'experience');
  return base.map((code) => ({ code, ...SUBJECTS[code], optional: code === 'english' && grade < 3 }));
}

function seedsFor(subjectCode, grade) {
  const seeds = UNIT_SEEDS[subjectCode];
  if (!seeds) return [];
  return seeds[grade] || seeds.all || [];
}

function normalizeProgram(code) { return PROGRAMS.find((item) => item.code === code); }
function normalizeGrade(value) { const grade = Number(value); return Number.isInteger(grade) && grade >= 1 && grade <= 5 ? grade : null; }
function stableShuffle(values, seedValue) {
  const result = values.slice();
  let seed = Array.from(String(seedValue)).reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 7);
  for (let index = result.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const target = seed % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function makeObjectiveQuestion(grade, subjectCode, unitIndex, lessonIndex, offset = 0) {
  if (subjectCode === 'math') {
    const bank = MATH_QUESTIONS[grade]?.[unitIndex % 4] || MATH_QUESTIONS[1][0];
    const source = bank[(lessonIndex + offset) % bank.length];
    const type = source.options ? 'multiple_choice' : 'fill_blank';
    return {
      id: `q-${subjectCode}-${grade}-${unitIndex}-${lessonIndex}-${offset}`,
      type,
      prompt: source.prompt,
      options: source.options ? stableShuffle(source.options, `${grade}:${subjectCode}:${unitIndex}:${lessonIndex}:${offset}`).map((label) => ({ value: label, label })) : [],
      acceptedAnswers: source.accepted || [source.correctAnswer],
      correctAnswer: source.correctAnswer,
      points: 50,
      explanation: `Hãy đọc yêu cầu, xác định dữ kiện và kiểm tra lại phép tính. Đáp án: ${source.correctAnswer}.`
    };
  }
  const generic = {
    vietnamese: [
      { prompt: 'Khi đọc một văn bản, cách nào giúp tìm thông tin chính xác nhất?', options: ['Đọc yêu cầu và tìm chi tiết trong văn bản', 'Chỉ nhìn độ dài văn bản', 'Đoán mà không đọc', 'Bỏ qua câu hỏi'], correctAnswer: 'Đọc yêu cầu và tìm chi tiết trong văn bản' },
      { prompt: 'Khi viết xong một đoạn văn, em nên làm gì?', options: ['Đọc lại để sửa ý và lỗi chính tả', 'Nộp ngay mà không xem lại', 'Xóa hết dấu câu', 'Chỉ kiểm tra tiêu đề'], correctAnswer: 'Đọc lại để sửa ý và lỗi chính tả' },
      { prompt: 'Khi trình bày ý kiến, điều gì giúp người nghe hiểu rõ hơn?', options: ['Nêu ý kiến và lí do phù hợp', 'Nói thật nhanh', 'Ngắt lời người khác', 'Lặp lại không có giải thích'], correctAnswer: 'Nêu ý kiến và lí do phù hợp' },
      { prompt: 'Nếu chưa hiểu nghĩa của một từ trong bài, em nên làm gì trước?', options: ['Xem từ trong ngữ cảnh và hỏi khi cần', 'Bỏ cả đoạn', 'Chọn nghĩa bất kỳ', 'Ngừng đọc'], correctAnswer: 'Xem từ trong ngữ cảnh và hỏi khi cần' }
    ],
    ethics: [
      { prompt: 'Khi mắc lỗi, cách ứng xử phù hợp là gì?', options: ['Thừa nhận, xin lỗi và tìm cách sửa', 'Đổ lỗi cho bạn', 'Che giấu mọi việc', 'Trêu chọc người khác'], correctAnswer: 'Thừa nhận, xin lỗi và tìm cách sửa' },
      { prompt: 'Khi làm việc nhóm, em nên làm gì?', options: ['Lắng nghe và hoàn thành phần việc', 'Không cho ai phát biểu', 'Bỏ phần việc của mình', 'Chê bai mọi ý tưởng'], correctAnswer: 'Lắng nghe và hoàn thành phần việc' },
      { prompt: 'Nếu thấy một bạn gặp khó khăn, em nên làm gì?', options: ['Giúp đỡ phù hợp hoặc báo người lớn', 'Cười bạn', 'Bỏ đi dù có nguy hiểm', 'Đăng chuyện riêng của bạn'], correctAnswer: 'Giúp đỡ phù hợp hoặc báo người lớn' },
      { prompt: 'Khi không đồng ý với bạn, cách nào là tốt nhất?', options: ['Nói bình tĩnh và lắng nghe', 'La hét', 'Dùng lời xúc phạm', 'Không cho bạn giải thích'], correctAnswer: 'Nói bình tĩnh và lắng nghe' }
    ],
    nature: [
      { prompt: 'Việc nào giúp bảo vệ sức khỏe hằng ngày?', options: ['Ăn uống hợp vệ sinh và rửa tay', 'Không ngủ đủ', 'Dùng chung đồ cá nhân bẩn', 'Bỏ qua vệ sinh'], correctAnswer: 'Ăn uống hợp vệ sinh và rửa tay' },
      { prompt: 'Thực vật cần điều gì để sống và phát triển?', options: ['Nước, ánh sáng và không khí phù hợp', 'Chỉ cần đồ chơi', 'Không cần môi trường', 'Chỉ cần bóng tối'], correctAnswer: 'Nước, ánh sáng và không khí phù hợp' },
      { prompt: 'Khi qua đường, em nên làm gì?', options: ['Quan sát và đi cùng người lớn khi cần', 'Chạy bất ngờ', 'Nhìn điện thoại', 'Đùa nghịch dưới lòng đường'], correctAnswer: 'Quan sát và đi cùng người lớn khi cần' },
      { prompt: 'Hành động nào có lợi cho môi trường?', options: ['Bỏ rác đúng nơi và tiết kiệm nước', 'Vứt rác xuống kênh', 'Phá cây non', 'Lãng phí điện'], correctAnswer: 'Bỏ rác đúng nơi và tiết kiệm nước' }
    ],
    science: [
      { prompt: 'Khi làm thí nghiệm ở trường, em cần ưu tiên điều gì?', options: ['Tuân thủ hướng dẫn và quy tắc an toàn', 'Nếm thử hóa chất', 'Tự ý dùng thiết bị nóng', 'Đùa nghịch với dụng cụ'], correctAnswer: 'Tuân thủ hướng dẫn và quy tắc an toàn' },
      { prompt: 'Vì sao thực vật cần ánh sáng?', options: ['Ánh sáng hỗ trợ cây tạo chất dinh dưỡng', 'Ánh sáng thay hoàn toàn nước', 'Cây không cần ánh sáng', 'Ánh sáng làm cây không cần không khí'], correctAnswer: 'Ánh sáng hỗ trợ cây tạo chất dinh dưỡng' },
      { prompt: 'Cách nào góp phần bảo vệ hệ sinh thái?', options: ['Giữ môi trường sống và không săn bắt trái phép', 'Xả rác ra sông', 'Phá nơi ở của động vật', 'Lãng phí tài nguyên'], correctAnswer: 'Giữ môi trường sống và không săn bắt trái phép' },
      { prompt: 'Kết luận khoa học nên dựa trên điều gì?', options: ['Quan sát, dữ liệu và bằng chứng', 'Tin đồn', 'Phỏng đoán không kiểm tra', 'Ý thích cá nhân'], correctAnswer: 'Quan sát, dữ liệu và bằng chứng' }
    ],
    history_geo: [
      { prompt: 'Khi đọc bản đồ, yếu tố nào giúp hiểu ý nghĩa kí hiệu?', options: ['Bảng chú giải', 'Màu bìa sách', 'Số trang', 'Tên người in'], correctAnswer: 'Bảng chú giải' },
      { prompt: 'Khi tìm hiểu một sự kiện lịch sử, em nên làm gì?', options: ['Đối chiếu mốc thời gian và tư liệu', 'Chỉ dựa vào lời đồn', 'Thay đổi dữ kiện', 'Bỏ qua nguồn thông tin'], correctAnswer: 'Đối chiếu mốc thời gian và tư liệu' },
      { prompt: 'Đặc điểm tự nhiên ảnh hưởng đến điều gì?', options: ['Sinh hoạt và hoạt động sản xuất của con người', 'Chỉ ảnh hưởng tên địa danh', 'Không ảnh hưởng đời sống', 'Chỉ ảnh hưởng màu bản đồ'], correctAnswer: 'Sinh hoạt và hoạt động sản xuất của con người' },
      { prompt: 'Khi giới thiệu di sản địa phương, em nên làm gì?', options: ['Nêu thông tin có căn cứ và thể hiện sự tôn trọng', 'Bịa thêm chi tiết', 'Làm hư hại di tích', 'Phớt lờ quy định bảo vệ'], correctAnswer: 'Nêu thông tin có căn cứ và thể hiện sự tôn trọng' }
    ],
    english: [
      { prompt: 'Which is a polite way to greet someone?', options: ['Hello, how are you?', 'Give me that now!', 'Go away!', 'I no talk.'], correctAnswer: 'Hello, how are you?' },
      { prompt: 'What should you do when you do not understand an English word?', options: ['Ask politely or use context clues', 'Stop learning forever', 'Guess without checking', 'Ignore every sentence'], correctAnswer: 'Ask politely or use context clues' },
      { prompt: 'Choose the sentence about a daily routine.', options: ['I go to school every day.', 'Blue is under.', 'Yesterday tomorrow green.', 'Run pencil classroom.'], correctAnswer: 'I go to school every day.' },
      { prompt: 'Which activity helps listening practice?', options: ['Listen carefully and identify key words', 'Cover your ears', 'Read unrelated text only', 'Speak over the audio'], correctAnswer: 'Listen carefully and identify key words' }
    ],
    ict: [
      { prompt: 'Which action protects personal information online?', options: ['Keep passwords private and ask a trusted adult', 'Share passwords publicly', 'Open every unknown link', 'Post home address publicly'], correctAnswer: 'Keep passwords private and ask a trusted adult' },
      { prompt: 'What is a useful first step for solving a large task?', options: ['Break it into smaller steps', 'Ignore the goal', 'Do random actions', 'Avoid checking the result'], correctAnswer: 'Break it into smaller steps' },
      { prompt: 'Why should you save your work regularly?', options: ['To reduce the risk of losing changes', 'To make the screen brighter', 'To turn off safety rules', 'To hide mistakes forever'], correctAnswer: 'To reduce the risk of losing changes' },
      { prompt: 'What should you do if a device behaves unexpectedly?', options: ['Stop, check instructions, and ask for help', 'Force it open', 'Touch unsafe parts', 'Ignore all warnings'], correctAnswer: 'Stop, check instructions, and ask for help' }
    ],
    music: [
      { prompt: 'When singing with a group, what should you pay attention to?', options: ['Rhythm, melody and listening to others', 'Singing as loudly as possible', 'Ignoring the beat', 'Changing every word randomly'], correctAnswer: 'Rhythm, melody and listening to others' },
      { prompt: 'Which activity develops musical listening?', options: ['Notice rhythm and changes in sound', 'Ignore the music', 'Cover the speaker', 'Only look at the page number'], correctAnswer: 'Notice rhythm and changes in sound' },
      { prompt: 'Why is practice helpful when learning a song?', options: ['It improves confidence and accuracy', 'It removes the need to listen', 'It guarantees no mistakes instantly', 'It makes teamwork impossible'], correctAnswer: 'It improves confidence and accuracy' },
      { prompt: 'How should you respond to a classmate performing?', options: ['Listen respectfully and give kind feedback', 'Interrupt repeatedly', 'Mock mistakes', 'Refuse to listen'], correctAnswer: 'Listen respectfully and give kind feedback' }
    ],
    art: [
      { prompt: 'What is a helpful first step before making an artwork?', options: ['Observe the subject and plan an idea', 'Use materials without thinking', 'Ignore the task', 'Copy without understanding'], correctAnswer: 'Observe the subject and plan an idea' },
      { prompt: 'What can color and line help communicate?', options: ['An idea, feeling or visual emphasis', 'Only the page number', 'Nothing at all', 'The weight of the paper'], correctAnswer: 'An idea, feeling or visual emphasis' },
      { prompt: 'How should tools be used during art activities?', options: ['Use them safely and follow instructions', 'Wave them near others', 'Leave them on the floor', 'Use any tool in any way'], correctAnswer: 'Use them safely and follow instructions' },
      { prompt: 'What is useful when reviewing your own artwork?', options: ['Compare it with the goal and choose one improvement', 'Tear it up immediately', 'Never observe it again', 'Judge only by the price of materials'], correctAnswer: 'Compare it with the goal and choose one improvement' }
    ],
    pe: [
      { prompt: 'What should you do before a physical activity?', options: ['Warm up and check the practice area', 'Start at full speed without checking', 'Ignore pain', 'Push others'], correctAnswer: 'Warm up and check the practice area' },
      { prompt: 'During a team game, what shows fair play?', options: ['Follow the rules and respect everyone', 'Change rules secretly', 'Blame teammates', 'Break equipment'], correctAnswer: 'Follow the rules and respect everyone' },
      { prompt: 'What is a safe response if you feel unwell while exercising?', options: ['Stop and tell the teacher or trusted adult', 'Hide it and continue intensely', 'Race faster', 'Ignore the warning'], correctAnswer: 'Stop and tell the teacher or trusted adult' },
      { prompt: 'Why is regular movement beneficial?', options: ['It supports health and physical skills', 'It replaces every other need', 'It means sleep is unnecessary', 'It prevents the need for safety'], correctAnswer: 'It supports health and physical skills' }
    ],
    experience: [
      { prompt: 'What makes a personal goal easier to achieve?', options: ['A clear small step and a time to review it', 'An unclear wish with no action', 'Waiting without planning', 'Avoiding feedback'], correctAnswer: 'A clear small step and a time to review it' },
      { prompt: 'When working together on a community task, you should…', options: ['Share tasks and listen to others', 'Let one person do everything', 'Ignore agreed roles', 'Leave waste behind'], correctAnswer: 'Share tasks and listen to others' },
      { prompt: 'After an activity, what helps you learn from it?', options: ['Reflect on what worked and what to improve', 'Forget all details', 'Blame a classmate', 'Avoid discussing results'], correctAnswer: 'Reflect on what worked and what to improve' },
      { prompt: 'Which is a useful way to care for the environment?', options: ['Reduce waste and reuse suitable materials', 'Waste water', 'Damage plants', 'Throw rubbish into streams'], correctAnswer: 'Reduce waste and reuse suitable materials' }
    ]
  };
  const list = generic[subjectCode] || generic.experience;
  const source = list[(unitIndex + lessonIndex + offset) % list.length];
  return {
    id: `q-${subjectCode}-${grade}-${unitIndex}-${lessonIndex}-${offset}`,
    type: 'multiple_choice',
    prompt: source.prompt,
    options: stableShuffle(source.options, `${grade}:${subjectCode}:${unitIndex}:${lessonIndex}:${offset}`).map((label) => ({ value: label, label })),
    acceptedAnswers: [source.correctAnswer],
    correctAnswer: source.correctAnswer,
    points: 50,
    explanation: `Hãy liên hệ kiến thức với mục tiêu bài học và xem lại phần hướng dẫn. Đáp án: ${source.correctAnswer}.`
  };
}

function makeWrittenQuestion(grade, subjectCode, unitIndex, lessonIndex, index) {
  const subject = SUBJECTS[subjectCode];
  const prompts = {
    math: 'Hãy trình bày các bước em dùng để giải một bài toán thuộc nội dung vừa học. Ghi phép tính hoặc cách suy luận và kiểm tra kết quả.',
    vietnamese: 'Hãy viết 3–5 câu để trình bày điều em hiểu từ nội dung vừa học. Nêu ít nhất một chi tiết hoặc ví dụ làm căn cứ.',
    english: 'Write 1–3 simple English sentences related to today’s topic. Try to use the words you learned.',
    ethics: 'Hãy nêu một tình huống gần gũi liên quan bài học, cách em sẽ ứng xử và lí do lựa chọn.',
    nature: 'Hãy mô tả điều em quan sát được và giải thích bằng kiến thức của bài học.',
    science: 'Hãy trình bày một nhận xét khoa học, dữ kiện/quan sát hỗ trợ và kết luận của em.',
    history_geo: 'Hãy trình bày điều em hiểu, nêu một thông tin có căn cứ và giải thích vì sao thông tin đó quan trọng.',
    ict: 'Hãy mô tả các bước em thực hiện để hoàn thành nhiệm vụ và cách kiểm tra kết quả an toàn.',
    music: 'Hãy mô tả điều em lắng nghe/thực hành được và nêu một điều em muốn cải thiện.',
    art: 'Hãy giới thiệu ý tưởng, cách lựa chọn màu/hình/chất liệu và điều em muốn thể hiện trong sản phẩm.',
    pe: 'Hãy nêu các bước thực hiện an toàn của hoạt động vận động đã học và lợi ích của chúng.',
    experience: 'Hãy kể một trải nghiệm ngắn liên quan đến bài học, điều em học được và hành động tiếp theo.'
  };
  const prompt = prompts[subjectCode] || prompts.experience;
  return {
    id: `essay-${subjectCode}-${grade}-${unitIndex}-${lessonIndex}-${index}`,
    type: index === 0 ? 'short_answer' : 'essay',
    prompt,
    options: [],
    correctAnswer: '',
    acceptedAnswers: [],
    points: 20,
    rubric: ['Bám sát yêu cầu của câu hỏi', 'Nêu kiến thức hoặc ví dụ phù hợp', 'Giải thích rõ ràng, theo trình độ lớp', 'Trình bày dễ hiểu và tôn trọng yêu cầu an toàn'],
    keyConcepts: [subject.name.toLocaleLowerCase('vi-VN'), 'bài học', 'ví dụ', 'giải thích'],
    explanation: 'Bài tự luận được phản hồi theo rubric. AI có thể đưa ra điểm sơ bộ; giáo viên/người học nên xem nhận xét và yêu cầu chấm lại nếu thấy chưa phù hợp.'
  };
}

function makeLearningStrategyQuestion(grade, subjectCode, unitIndex, lessonIndex, partIndex, topic) {
  const questions = [
    { prompt: `Sau khi học “${topic}”, điều nào giúp em kiểm tra mình đã hiểu ý chính?`, options: ['Tự diễn đạt ý chính bằng lời của mình', 'Chỉ ghi nhớ tiêu đề', 'Bỏ qua ví dụ', 'Chọn đáp án ngẫu nhiên'], correctAnswer: 'Tự diễn đạt ý chính bằng lời của mình' },
    { prompt: `Khi theo dõi ví dụ mẫu về “${topic}”, em nên làm gì?`, options: ['Theo dõi từng bước và nêu lí do', 'Chỉ chép kết quả cuối cùng', 'Bỏ qua bước chưa hiểu', 'Không cần đối chiếu đề bài'], correctAnswer: 'Theo dõi từng bước và nêu lí do' },
    { prompt: `Trong phần luyện tập có hướng dẫn về “${topic}”, nếu kết quả chưa đúng thì em nên...?`, options: ['Xem lại bước sai, sửa rồi kiểm tra lại', 'Xóa hết và đoán kết quả', 'Bỏ qua lỗi', 'Chọn cách làm bất kỳ'], correctAnswer: 'Xem lại bước sai, sửa rồi kiểm tra lại' },
    { prompt: `Khi tự luyện nội dung “${topic}”, cách nào cho thấy em biết vận dụng?`, options: ['Tự làm trước rồi giải thích cách làm', 'Chỉ chép lời giải mẫu', 'Bỏ qua yêu cầu', 'Nộp khi chưa kiểm tra'], correctAnswer: 'Tự làm trước rồi giải thích cách làm' }
  ];
  const source = questions[partIndex % questions.length];
  return {
    id: `q-strategy-${subjectCode}-${grade}-${unitIndex}-${lessonIndex}-p${partIndex}`,
    type: 'multiple_choice',
    prompt: source.prompt,
    options: stableShuffle(source.options, `${grade}:${subjectCode}:${unitIndex}:${lessonIndex}:strategy:${partIndex}`).map((label) => ({ value: label, label })),
    acceptedAnswers: [source.correctAnswer],
    correctAnswer: source.correctAnswer,
    points: 50,
    explanation: 'Học theo từng bước, tự giải thích cách làm và kiểm tra lỗi giúp em nhận biết phần đã hiểu và phần cần ôn lại.'
  };
}

function makePartCheckpoint(grade, subjectCode, unitIndex, lessonIndex, partIndex, topic) {
  const first = makeObjectiveQuestion(grade, subjectCode, unitIndex, lessonIndex, partIndex);
  const second = makeLearningStrategyQuestion(grade, subjectCode, unitIndex, lessonIndex, partIndex, topic);
  return [
    { ...first, id: `${first.id}-p${partIndex}-a`, points: 50 },
    { ...second, id: `${second.id}-p${partIndex}-b`, points: 50 }
  ];
}

function makeLesson(grade, program, subject, unit, unitIndex, topic, lessonIndex) {
  const programName = program.shortName;
  const alignment = buildLessonAlignment({ grade, subjectCode: subject.code, title: topic, unitTitle: unit.title });
  const objective = `Sau bài “${topic}”, học sinh lớp ${grade} có thể ${alignment.intendedOutcomes[0].replace(/^Nhận biết và giải thích được /, 'nhận biết và giải thích ')} Đồng thời, học sinh thực hiện được nhiệm vụ thực hành và tự kiểm tra kết quả.`;
  const theory = buildSchoolTheory({ grade, subjectCode: subject.code, subjectName: subject.name, title: topic, unitTitle: unit.title, objective, educationLevel: grade <= 5 ? 'tiểu học' : grade <= 9 ? 'trung học cơ sở' : 'trung học phổ thông' });
  const baseExample = theory.sections.find((item) => item.id === 'worked-example')?.body || theory.summary;
  const parts = [
    { id: 'theory', title: '1. Lý thuyết trọng tâm', type: 'theory', durationMinutes: 5, content: theory.quickReview, checkpoint: makePartCheckpoint(grade, subject.code, unitIndex, lessonIndex, 0, topic) },
    { id: 'lecture', title: '2. Bài giảng và ví dụ mẫu', type: 'lecture', durationMinutes: 6, content: `**Ví dụ có hướng dẫn về ${topic}:**\n\n${baseExample}\n\n**Cách tự kiểm tra:** Em hãy nói lại quy tắc bằng lời của mình, chỉ ra dữ kiện đang dùng và giải thích vì sao cách làm phù hợp.`, checkpoint: makePartCheckpoint(grade, subject.code, unitIndex, lessonIndex, 1, topic) },
    { id: 'guided-practice', title: '3. Luyện tập có hướng dẫn', type: 'guided_practice', durationMinutes: 7, content: `**Làm cùng từng bước:**\n1. Đọc kỹ yêu cầu và xác định điều cần tìm.\n2. Chọn kiến thức hoặc quy tắc liên quan đến “${topic}”.\n3. Làm từng bước, có thể dùng hình vẽ, bảng hoặc lời giải thích.\n4. Đối chiếu kết quả với yêu cầu và sửa nếu cần.\n\n**Mẹo:** Nếu chưa đúng, hãy quay lại bước em chưa chắc thay vì làm lại một cách máy móc.`, checkpoint: makePartCheckpoint(grade, subject.code, unitIndex, lessonIndex, 2, topic) },
    { id: 'independent-practice', title: '4. Tự luyện và vận dụng', type: 'independent_practice', durationMinutes: 8, content: `**Nhiệm vụ:** Tự giải thích hoặc thực hiện một ví dụ tương tự với “${topic}”. Có thể viết nháp, vẽ minh họa hoặc kể lại một tình huống trong cuộc sống.\n\n**Tự kiểm tra:** Em đã trả lời đúng trọng tâm chưa? Có bước nào cần giải thích thêm không? Em có thể đưa ra ví dụ khác không?`, checkpoint: makePartCheckpoint(grade, subject.code, unitIndex, lessonIndex, 3, topic) }
  ];
  const lessonQuestions = [
    { ...makeObjectiveQuestion(grade, subject.code, unitIndex, lessonIndex, 0), points: 20 },
    { ...makeObjectiveQuestion(grade, subject.code, unitIndex, lessonIndex, 1), points: 20 },
    { id: `fill-${program.code}-${grade}-${subject.code}-${unitIndex}-${lessonIndex}`, type: 'fill_blank', prompt: `Điền từ hoặc kết quả phù hợp để hoàn thành nhận xét về bài “${topic}”: Em cần đọc kỹ yêu cầu, áp dụng kiến thức và ______ lại kết quả.`, options: [], acceptedAnswers: ['kiểm tra', 'kiểm tra lại', 'xem lại'], correctAnswer: 'kiểm tra', points: 20, explanation: 'Luôn kiểm tra lại kết quả trước khi hoàn thành.' },
    makeWrittenQuestion(grade, subject.code, unitIndex, lessonIndex, 0),
    makeWrittenQuestion(grade, subject.code, unitIndex, lessonIndex, 1)
  ];
  return {
    id: `${program.code}-g${grade}-${subject.code}-u${unitIndex + 1}-l${lessonIndex + 1}`,
    title: topic,
    theory,
    grade,
    programCode: program.code,
    programName: program.name,
    subjectCode: subject.code,
    subjectName: subject.name,
    unitId: `${program.code}-g${grade}-${subject.code}-u${unitIndex + 1}`,
    unitTitle: unit.title,
    sequence: unitIndex * 2 + lessonIndex + 1,
    estimatedMinutes: 26,
    objective,
    parts,
    assessmentQuestions: lessonQuestions,
    alignment,
    qualityProfile: createLessonQualityProfile({ level: 'school', grade, subjectCode: subject.code, lesson: { title: topic, objective, alignment, parts }, hasCodeLab: subject.code === 'ict' }),
    contentStatus: 'draft-ai-assisted-review-required',
    provenance: 'Original learning scaffold mapped to broad 2018 general education competency strands; verify lesson-level content with the current official curriculum and licensed textbook before production publication.'
  };
}

function buildCourse(grade, programCode, subjectCode) {
  const program = normalizeProgram(programCode);
  const subject = subjectsForGrade(grade).find((item) => item.code === subjectCode);
  if (!program || !subject) return null;
  const units = seedsFor(subjectCode, grade).map(([title, topics], unitIndex) => {
    const unitId = `${program.code}-g${grade}-${subject.code}-u${unitIndex + 1}`;
    const unit = { id: unitId, title, sequence: unitIndex + 1, lessons: topics.map((topic, lessonIndex) => makeLesson(grade, program, subject, { title, id: unitId }, unitIndex, topic, lessonIndex)) };
    return unit;
  });
  return {
    id: `${program.code}-g${grade}-${subject.code}`,
    grade,
    programCode: program.code,
    programName: program.name,
    approach: program.approach,
    subjectCode: subject.code,
    subjectName: subject.name,
    subjectIcon: subject.icon,
    optional: Boolean(subject.optional),
    required: subject.required,
    units,
    lessonCount: units.reduce((sum, unit) => sum + unit.lessons.length, 0),
    contentStatus: 'draft-ai-assisted-review-required',
    curriculumReferences: OFFICIAL_REFERENCES,
    alignmentStatus: 'draft-framework-mapped-teacher-validation-required'
  };
}

function buildCatalog(grade, programCode) {
  const safeGrade = normalizeGrade(grade);
  const program = normalizeProgram(programCode);
  if (!safeGrade || !program) return null;
  const courses = subjectsForGrade(safeGrade).map((subject) => buildCourse(safeGrade, program.code, subject.code)).filter(Boolean);
  return {
    grade: safeGrade,
    program,
    curriculumFramework: 'Chương trình Giáo dục phổ thông 2018 theo văn bản hợp nhất; khung chủ đề/năng lực, chưa phải phân phối SGK chính thức.',
    curriculumReferences: OFFICIAL_REFERENCES,
    courses,
    totals: { subjects: courses.length, units: courses.reduce((n, c) => n + c.units.length, 0), lessons: courses.reduce((n, c) => n + c.lessonCount, 0) }
  };
}

function findLesson({ grade, programCode, subjectCode, lessonId }) {
  const safeGrade = normalizeGrade(grade);
  const program = normalizeProgram(programCode);
  if (!safeGrade || !program) return null;
  const subjectCodes = subjectCode ? [subjectCode] : subjectsForGrade(safeGrade).map((subject) => subject.code);
  for (const code of subjectCodes) {
    const course = buildCourse(safeGrade, program.code, code);
    if (!course) continue;
    for (const unit of course.units) {
      const lesson = unit.lessons.find((item) => item.id === lessonId);
      if (lesson) return { course, unit, lesson };
    }
  }
  return null;
}

function publicQuestion(question) {
  const { correctAnswer, acceptedAnswers, explanation, rubric, keyConcepts, ...safe } = question;
  return safe;
}
function publicLesson(lesson) {
  return {
    ...lesson,
    parts: lesson.parts.map((part) => ({ ...part, checkpoint: part.checkpoint.map(publicQuestion) })),
    assessmentQuestions: lesson.assessmentQuestions.map(publicQuestion)
  };
}
function publicCourse(course) {
  return { ...course, units: course.units.map((unit) => ({ ...unit, lessons: unit.lessons.map(({ parts, assessmentQuestions, provenance, ...lesson }) => lesson) })) };
}

module.exports = { PROGRAMS, SUBJECTS, subjectsForGrade, buildCourse, buildCatalog, findLesson, publicQuestion, publicLesson, publicCourse, normalizeGrade, normalizeProgram, makeObjectiveQuestion, makeWrittenQuestion };
