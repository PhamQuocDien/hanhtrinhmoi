'use strict';

// Nội dung nguyên bản, tạo theo lớp – môn – chủ đề. Mục tiêu của mô-đun là
// bảo đảm mỗi bài có phần giảng giải thực sự, ví dụ, lỗi thường gặp và câu tự kiểm tra,
// thay vì ba câu giới thiệu chung giống nhau ở mọi môn.

const SUBJECT_GROUPS = Object.freeze({
    mathematics: new Set(['toan']),
    language: new Set(['tieng_viet', 'ngu_van']),
    english: new Set(['tieng_anh']),
    science: new Set(['tnxh', 'khoa_hoc', 'khtn', 'vat_ly', 'hoa_hoc', 'sinh_hoc']),
    social: new Set(['lich_su_dia_li', 'lich_su', 'dia_li', 'dao_duc', 'gdcd', 'gdktepl', 'dia_phuong']),
    digital: new Set(['tin_hoc', 'cong_nghe', 'tin_hoc_cong_nghe']),
    arts: new Set(['nghe_thuat', 'am_nhac', 'mi_thuat']),
    physical: new Set(['gdtc', 'gdqp']),
    experience: new Set(['hdtn', 'hdtnhn'])
});

function groupFor(subjectId) {
    for (const [group, ids] of Object.entries(SUBJECT_GROUPS)) if (ids.has(subjectId)) return group;
    return 'experience';
}

function gradeBand(grade) {
    if (grade <= 2) return 'early-primary';
    if (grade <= 5) return 'primary';
    if (grade <= 9) return 'lower-secondary';
    return 'upper-secondary';
}

function cleanTopic(topic) {
    return String(topic || 'nội dung bài học').replace(/\s+/g, ' ').replace(/\s+—\s+.*/, '').trim();
}

function mathPack({ grade, topic, lessonNo }) {
    const a = Math.max(2, grade + lessonNo % 7);
    const b = Math.max(1, (lessonNo * 2 + grade) % 9);
    const band = gradeBand(grade);
    const example = grade <= 5
        ? `Ví dụ: Có ${a} nhóm, mỗi nhóm ${b} đồ vật. Hãy xác định tổng số, viết phép tính, tính kết quả rồi kiểm tra bằng cách đếm hoặc phép tính ngược.`
        : grade <= 9
            ? `Ví dụ: Gọi đại lượng chưa biết là x. Từ dữ kiện của bài toán, lập quan hệ x + ${a} = ${a + b}; biến đổi từng bước và thay kết quả trở lại để kiểm tra.`
            : `Ví dụ: Mô hình hóa tình huống bằng hàm hoặc biểu thức thích hợp, xác định điều kiện, thực hiện biến đổi và đối chiếu kết quả với ý nghĩa thực tế.`;
    return {
        summary: [
            `${topic} là nội dung toán học cần được hiểu qua biểu diễn, quy tắc và cách kiểm tra kết quả. Học sinh lớp ${grade} không chỉ tính đúng mà còn cần giải thích vì sao cách làm hợp lí.`,
            band.includes('primary') ? 'Khi làm bài, hãy dùng đồ vật, hình vẽ, sơ đồ hoặc phép tính để biểu diễn cùng một ý tưởng.' : 'Khi giải, cần nêu giả thiết, đại lượng, điều kiện, lập luận và kết luận; không bỏ qua điều kiện xác định.'
        ],
        sections: [
            { title: 'Khái niệm trọng tâm', bullets: [`Nhận diện dữ kiện liên quan đến ${topic.toLowerCase()}.`, 'Phân biệt dữ kiện đã biết, đại lượng cần tìm và điều kiện ràng buộc.', 'Chọn biểu diễn phù hợp: lời, bảng, sơ đồ, biểu thức, hình hoặc đồ thị.'] },
            { title: 'Quy trình giải', bullets: ['Đọc chậm đề và gạch chân từ khóa.', 'Lập kế hoạch trước khi tính.', 'Thực hiện từng bước, ghi đơn vị khi cần.', 'Kiểm tra bằng ước lượng, phép tính ngược hoặc thay lại kết quả.'] },
            { title: 'Ví dụ có hướng dẫn', bullets: [example, 'Sau khi giải, hãy tự hỏi: kết quả có hợp lí về dấu, độ lớn và đơn vị không?'] }
        ],
        vocabulary: ['dữ kiện', 'đại lượng', 'biểu diễn', 'lập luận', 'kiểm tra kết quả'],
        mistakes: ['Tính ngay khi chưa hiểu yêu cầu.', 'Bỏ sót điều kiện hoặc đơn vị.', 'Chỉ ghi đáp số mà không trình bày cách suy luận.'],
        quickChecks: [`Em có thể nói lại ${topic.toLowerCase()} bằng một câu không?`, 'Em dùng cách nào để kiểm tra đáp án?', 'Có cách biểu diễn thứ hai cho cùng bài toán không?']
    };
}

function languagePack({ grade, topic }) {
    const isPrimary = grade <= 5;
    return {
        summary: [
            `Bài ${topic} giúp học sinh lớp ${grade} phát triển đồng thời đọc, viết, nói và nghe. Trọng tâm là hiểu nội dung, nhận ra cách dùng từ – câu và biết tạo sản phẩm ngôn ngữ của riêng mình.`,
            isPrimary ? 'Khi đọc, em cần xác định nhân vật, sự việc, từ ngữ nổi bật và điều em học được từ văn bản.' : 'Khi đọc, cần kết hợp nội dung, hình thức, ngữ cảnh, bằng chứng trong văn bản và quan điểm của người viết.'
        ],
        sections: [
            { title: 'Cách đọc hiểu', bullets: ['Đọc nhan đề và dự đoán nội dung.', 'Chia văn bản thành các phần nhỏ.', 'Gạch dưới chi tiết quan trọng và từ chưa hiểu.', 'Trả lời bằng bằng chứng từ văn bản, không đoán tùy ý.'] },
            { title: 'Kiến thức tiếng Việt – Ngữ văn', bullets: [isPrimary ? 'Nhận biết từ chỉ người, vật, hoạt động, đặc điểm và kiểu câu phù hợp.' : 'Nhận biết phương thức biểu đạt, cấu trúc, biện pháp tu từ và tác dụng.', 'Liên kết câu và đoạn bằng từ ngữ phù hợp.', 'Dùng từ đúng nghĩa, đúng sắc thái và đúng hoàn cảnh.'] },
            { title: 'Cách viết', bullets: ['Xác định người đọc và mục đích viết.', 'Lập dàn ý trước khi viết.', 'Mỗi đoạn tập trung một ý chính.', 'Đọc lại để sửa bố cục, diễn đạt, chính tả và dấu câu.'] }
        ],
        vocabulary: ['ý chính', 'chi tiết', 'bằng chứng', 'liên kết', 'diễn đạt'],
        mistakes: ['Kể lại toàn bộ thay vì trả lời đúng câu hỏi.', 'Nêu nhận xét nhưng không dẫn chi tiết làm bằng chứng.', 'Viết một đoạn quá dài, nhiều ý không liên kết.'],
        quickChecks: ['Ý chính của bài là gì?', 'Chi tiết nào chứng minh câu trả lời của em?', 'Em sẽ sửa câu nào để diễn đạt rõ hơn?']
    };
}

function englishPack({ grade, topic }) {
    const simple = grade <= 5;
    return {
        summary: [
            `This lesson develops English communication around “${topic}”. Students practise meaning, pronunciation, sentence patterns and a short real-life exchange.`,
            simple ? 'Listen first, point or act, repeat in short chunks, then use the pattern with your own information.' : 'Notice the situation, key words, grammar pattern and speaking purpose before producing a complete response.'
        ],
        sections: [
            { title: 'Từ vựng và phát âm', bullets: [`Học từ theo cụm gắn với chủ đề ${topic.toLowerCase()}, không học từng từ rời.`, 'Nghe trọng âm và âm cuối trước khi lặp lại.', 'Đọc chậm, rõ; sau đó tăng dần tốc độ nhưng không nuốt âm quan trọng.'] },
            { title: 'Mẫu câu giao tiếp', bullets: [simple ? 'Mẫu cơ bản: “This is … / I like … / Can you …?”' : 'Tổ chức câu trả lời theo ba phần: ý chính – lí do – ví dụ.', 'Thay từ khóa để tạo câu mới của riêng em.', 'Dùng câu hỏi tiếp nối để duy trì hội thoại.'] },
            { title: 'Nghe – nói – đọc – viết', bullets: ['Nghe lần một để hiểu ý chính.', 'Nghe lần hai để bắt từ khóa.', 'Nói và tự ghi âm để so sánh.', 'Viết câu ngắn rồi đọc lại thành tiếng.'] }
        ],
        vocabulary: ['main idea', 'key word', 'sentence pattern', 'pronunciation', 'example'],
        mistakes: ['Dịch từng từ nên bỏ lỡ ý chính.', 'Nói quá nhanh làm mất âm cuối.', 'Chỉ học thuộc mẫu mà không thay thông tin cá nhân.'],
        quickChecks: ['What is the main idea?', 'Which words carry the key meaning?', 'Can you give one personal example?']
    };
}

function sciencePack({ grade, topic, subjectName }) {
    return {
        summary: [
            `${topic} trong môn ${subjectName} lớp ${grade} được học qua quan sát, đặt câu hỏi, thu thập bằng chứng và giải thích. Kiến thức khoa học phải gắn với hiện tượng có thể kiểm tra.`,
            'Một kết luận tốt cần chỉ ra dữ kiện nào hỗ trợ kết luận và điều kiện nào có thể làm kết quả thay đổi.'
        ],
        sections: [
            { title: 'Hiện tượng và khái niệm', bullets: [`Mô tả hiện tượng liên quan đến ${topic.toLowerCase()} bằng từ ngữ chính xác.`, 'Phân biệt điều quan sát được với điều suy luận.', 'Xác định yếu tố thay đổi và yếu tố cần giữ ổn định.'] },
            { title: 'Quy trình tìm hiểu', bullets: ['Nêu câu hỏi có thể kiểm tra.', 'Dự đoán có lí do.', 'Quan sát hoặc đo và ghi dữ liệu.', 'So sánh kết quả với dự đoán.', 'Nêu kết luận cùng bằng chứng.'] },
            { title: 'An toàn và ứng dụng', bullets: ['Tuân thủ hướng dẫn, không tự nếm/ngửi/chạm vật lạ.', 'Dùng đơn vị đo phù hợp.', 'Liên hệ kiến thức với sức khỏe, môi trường, thiết bị hoặc sinh hoạt hằng ngày.'] }
        ],
        vocabulary: ['quan sát', 'dự đoán', 'bằng chứng', 'biến số', 'kết luận'],
        mistakes: ['Nêu kết luận trước khi xem dữ liệu.', 'Thay đổi nhiều yếu tố cùng lúc.', 'Nhầm giữa hiện tượng quan sát và nguyên nhân suy đoán.'],
        quickChecks: ['Bằng chứng nào hỗ trợ kết luận?', 'Yếu tố nào cần giữ nguyên?', 'Kiến thức này được dùng ở đâu trong đời sống?']
    };
}

function socialPack({ grade, topic, subjectName }) {
    return {
        summary: [
            `${topic} trong môn ${subjectName} lớp ${grade} cần được hiểu theo bối cảnh, mối quan hệ nguyên nhân – kết quả, không gian – thời gian và trách nhiệm của con người.`,
            'Học sinh cần phân biệt sự kiện/dữ kiện với ý kiến, biết xem nguồn thông tin và liên hệ với cộng đồng hiện nay.'
        ],
        sections: [
            { title: 'Bối cảnh', bullets: ['Xác định thời gian, địa điểm, nhân vật hoặc nhóm liên quan.', 'Tìm điều kiện tự nhiên, xã hội hoặc quy tắc ảnh hưởng đến sự việc.', 'Sắp xếp thông tin bằng dòng thời gian, bản đồ hoặc bảng so sánh.'] },
            { title: 'Phân tích', bullets: ['Nêu ít nhất một nguyên nhân và một hệ quả.', 'So sánh các góc nhìn khác nhau.', 'Dùng dữ kiện hoặc nguồn để bảo vệ nhận định.', 'Phân biệt quyền, nghĩa vụ và hành vi phù hợp khi có nội dung công dân/pháp luật.'] },
            { title: 'Liên hệ thực tế', bullets: ['Nêu một tình huống tương tự trong gia đình, trường học hoặc địa phương.', 'Đề xuất cách ứng xử có trách nhiệm.', 'Tôn trọng khác biệt và tránh kết luận khi chưa đủ thông tin.'] }
        ],
        vocabulary: ['bối cảnh', 'nguyên nhân', 'hệ quả', 'nguồn thông tin', 'trách nhiệm'],
        mistakes: ['Chỉ nhớ tên và mốc mà không hiểu quan hệ giữa các sự kiện.', 'Dùng ý kiến cá nhân thay cho dữ kiện.', 'Áp dụng một quy tắc mà không xét hoàn cảnh.'],
        quickChecks: ['Sự việc diễn ra trong bối cảnh nào?', 'Nguyên nhân và hệ quả chính là gì?', 'Em sẽ hành động thế nào trong tình huống gần giống?']
    };
}

function digitalPack({ grade, topic, subjectName }) {
    return {
        summary: [
            `${topic} trong môn ${subjectName} lớp ${grade} kết hợp hiểu nguyên lí với thao tác đúng quy trình. Sản phẩm phải hoạt động, an toàn và có thể giải thích được.`,
            'Trước khi thao tác, cần xác định đầu vào, kết quả mong muốn, từng bước xử lí và cách kiểm tra lỗi.'
        ],
        sections: [
            { title: 'Quy trình thực hiện', bullets: ['Xác định nhiệm vụ và tiêu chí hoàn thành.', 'Chia nhiệm vụ thành bước nhỏ.', 'Thực hiện từ đơn giản đến phức tạp.', 'Thử nghiệm, tìm lỗi, sửa và thử lại.'] },
            { title: 'Tư duy hệ thống', bullets: ['Nhận diện đầu vào – xử lí – đầu ra.', 'Dùng sơ đồ, thuật toán hoặc bản thiết kế.', 'Đánh giá hiệu quả, độ bền, chi phí hoặc tính dễ sử dụng tùy nhiệm vụ.'] },
            { title: 'An toàn và trách nhiệm', bullets: ['Bảo vệ dữ liệu cá nhân và mật khẩu.', 'Kiểm tra nguồn trước khi tải hoặc chia sẻ.', 'Sử dụng thiết bị đúng tư thế và đúng hướng dẫn.', 'Tôn trọng bản quyền và người dùng khác.'] }
        ],
        vocabulary: ['đầu vào', 'xử lí', 'đầu ra', 'thuật toán', 'kiểm thử'],
        mistakes: ['Làm nhiều bước cùng lúc nên khó tìm lỗi.', 'Không lưu phiên bản trước khi sửa.', 'Chia sẻ thông tin cá nhân hoặc dùng nguồn không kiểm chứng.'],
        quickChecks: ['Đầu vào và đầu ra của nhiệm vụ là gì?', 'Bước nào có thể gây lỗi?', 'Em kiểm tra sản phẩm bằng tiêu chí nào?']
    };
}

function artsPack({ grade, topic, subjectId }) {
    const music = subjectId === 'am_nhac' || (subjectId === 'nghe_thuat' && grade % 2 === 1);
    return music ? {
        summary: [
            `${topic} được học bằng nghe, cảm nhận, giữ nhịp và thực hành biểu diễn. Lý thuyết âm nhạc chỉ có ý nghĩa khi em nghe thấy và thực hiện được.`,
            'Khi hát hoặc gõ tiết tấu, hãy ưu tiên tư thế, hơi thở, nhịp ổn định và phát âm rõ trước khi cố hát to.'
        ],
        sections: [
            { title: 'Nghe và cảm nhận', bullets: ['Xác định nhanh/chậm, mạnh/nhẹ và sắc thái.', 'Gõ nhịp đều trước khi hát.', 'Nhận ra câu nhạc lặp lại hoặc thay đổi.'] },
            { title: 'Kĩ thuật thực hành', bullets: ['Đứng/ngồi thẳng, vai thả lỏng.', 'Lấy hơi yên, phát âm rõ phụ âm đầu và cuối.', 'Hát từng câu ngắn rồi ghép toàn bài.', 'Tự thu âm để nghe lại cao độ và nhịp.'] },
            { title: 'Sáng tạo', bullets: ['Thay đổi cách gõ đệm nhưng vẫn giữ phách.', 'Đề xuất sắc thái phù hợp nội dung.', 'Biểu diễn và nhận xét bằng tiêu chí cụ thể, không chê bai cá nhân.'] }
        ],
        vocabulary: ['phách', 'nhịp', 'cao độ', 'trường độ', 'sắc thái'],
        mistakes: ['Hát quá to làm mất kiểm soát hơi.', 'Vào câu trước hoặc sau phách.', 'Chỉ nhìn lời mà không nghe nhạc đệm.'],
        quickChecks: ['Nhịp của phần thực hành là gì?', 'Câu nào cần lấy hơi?', 'Em cần sửa cao độ, nhịp hay phát âm trước?']
    } : {
        summary: [
            `${topic} được học bằng quan sát, thử vật liệu, tạo hình và tự đánh giá sản phẩm. Mĩ thuật không chỉ là vẽ “đẹp” mà là truyền đạt ý tưởng bằng hình ảnh.`,
            'Trước khi vẽ, hãy xác định chủ thể chính, bố cục, hình dạng lớn, màu chủ đạo và điểm muốn người xem chú ý.'
        ],
        sections: [
            { title: 'Ngôn ngữ tạo hình', bullets: ['Đường nét tạo hướng và cảm xúc.', 'Hình, mảng và tỉ lệ tạo cấu trúc.', 'Màu sắc tạo tương phản, hòa sắc và điểm nhấn.', 'Không gian trước – sau giúp hình rõ chiều sâu.'] },
            { title: 'Quy trình sáng tạo', bullets: ['Quan sát hoặc tìm ý tưởng.', 'Phác hình lớn, chưa đi chi tiết sớm.', 'Chỉnh bố cục và tỉ lệ.', 'Thêm màu, chất liệu và chi tiết.', 'Đặt tên và giải thích ý tưởng.'] },
            { title: 'Tự đánh giá', bullets: ['Sản phẩm có đúng yêu cầu không?', 'Điểm nhìn chính có rõ không?', 'Màu và đường nét có hỗ trợ ý tưởng không?', 'Em sẽ sửa phần nào nếu làm lại?'] }
        ],
        vocabulary: ['bố cục', 'đường nét', 'hình mảng', 'hòa sắc', 'điểm nhấn'],
        mistakes: ['Vẽ chi tiết trước khi dựng hình lớn.', 'Dồn mọi vật vào một góc.', 'Dùng nhiều màu nhưng không có màu chủ đạo.'],
        quickChecks: ['Chủ thể chính nằm ở đâu?', 'Màu nào là màu chủ đạo?', 'Chi tiết nào làm rõ ý tưởng nhất?']
    };
}

function physicalPack({ grade, topic, subjectName }) {
    return {
        summary: [
            `${topic} trong môn ${subjectName} lớp ${grade} phải được học bằng động tác đúng, an toàn và tăng dần cường độ. Không cố thực hiện khi đau, chóng mặt hoặc không có không gian phù hợp.`,
            'Mục tiêu là biết chuẩn bị cơ thể, thực hiện kĩ thuật, theo dõi phản ứng và hồi phục sau vận động.'
        ],
        sections: [
            { title: 'Chuẩn bị', bullets: ['Kiểm tra sân tập, trang phục và vật cản.', 'Khởi động khớp và nhóm cơ liên quan.', 'Uống nước vừa đủ; không tập ngay sau bữa ăn lớn.'] },
            { title: 'Kĩ thuật', bullets: ['Thực hiện chậm để đúng tư thế.', 'Giữ thăng bằng và kiểm soát nhịp thở.', 'Tăng số lần hoặc tốc độ từng bước.', 'Dừng khi có dấu hiệu đau bất thường.'] },
            { title: 'Hồi phục và tự theo dõi', bullets: ['Thả lỏng và hít thở chậm.', 'Theo dõi mệt, nhịp tim tương đối và đau cơ.', 'Ghi lại mức hoàn thành thay vì so sánh cơ thể với người khác.'] }
        ],
        vocabulary: ['khởi động', 'tư thế', 'thăng bằng', 'cường độ', 'hồi phục'],
        mistakes: ['Bỏ qua khởi động.', 'Thực hiện nhanh khi chưa đúng kĩ thuật.', 'Tiếp tục tập dù đau hoặc chóng mặt.'],
        quickChecks: ['Nhóm cơ nào cần khởi động?', 'Dấu hiệu nào yêu cầu em dừng tập?', 'Em tăng độ khó theo cách an toàn nào?']
    };
}

function experiencePack({ grade, topic, subjectName }) {
    return {
        summary: [
            `${topic} trong môn ${subjectName} lớp ${grade} được học qua nhiệm vụ thật, hợp tác, phản hồi và điều chỉnh. Kết quả không chỉ là sản phẩm mà còn là cách em lập kế hoạch và chịu trách nhiệm.`,
            'Mỗi hoạt động nên có mục tiêu, vai trò, thời gian, nguồn lực, tiêu chí hoàn thành và bước rút kinh nghiệm.'
        ],
        sections: [
            { title: 'Lập kế hoạch', bullets: ['Nêu mục tiêu cụ thể và có thể kiểm tra.', 'Chia việc thành bước và xác định thời hạn.', 'Phân công theo khả năng và thống nhất cách hỗ trợ nhau.'] },
            { title: 'Thực hiện và hợp tác', bullets: ['Lắng nghe trước khi phản hồi.', 'Báo sớm khi gặp khó khăn.', 'Ghi minh chứng: ảnh, bảng theo dõi, nhật kí hoặc sản phẩm.', 'Điều chỉnh kế hoạch khi điều kiện thay đổi.'] },
            { title: 'Phản tư', bullets: ['Điều gì đã làm tốt?', 'Điều gì chưa đạt và nguyên nhân?', 'Lần sau sẽ thay đổi hành động nào?', 'Kĩ năng này liên quan nghề nghiệp hoặc đời sống ra sao?'] }
        ],
        vocabulary: ['mục tiêu', 'kế hoạch', 'vai trò', 'minh chứng', 'phản tư'],
        mistakes: ['Mục tiêu quá chung nên không biết khi nào hoàn thành.', 'Phân công nhưng không theo dõi tiến độ.', 'Chỉ nêu lỗi của người khác khi rút kinh nghiệm.'],
        quickChecks: ['Tiêu chí hoàn thành là gì?', 'Ai chịu trách nhiệm cho từng việc?', 'Em sẽ điều chỉnh gì sau hoạt động?']
    };
}

function buildLessonTheoryV14({ grade, subjectId, topic, subjectName, lessonNo }) {
    const input = { grade: Number(grade) || 1, subjectId, topic: cleanTopic(topic), subjectName, lessonNo: Number(lessonNo) || 1 };
    const group = groupFor(subjectId);
    const builders = {
        mathematics: mathPack,
        language: languagePack,
        english: englishPack,
        science: sciencePack,
        social: socialPack,
        digital: digitalPack,
        arts: artsPack,
        physical: physicalPack,
        experience: experiencePack
    };
    const pack = (builders[group] || experiencePack)(input);
    return {
        theory: pack.summary,
        theorySections: pack.sections,
        glossary: pack.vocabulary,
        commonMistakes: pack.mistakes,
        quickChecks: pack.quickChecks,
        theoryVersion: 'V14-subject-specific'
    };
}

module.exports = { buildLessonTheoryV14, groupFor, gradeBand };
