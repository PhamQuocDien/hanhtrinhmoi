# V6.1.1 — Khung chất lượng học liệu và đánh giá

## Nguyên tắc

V6.1.1 sử dụng các khung tham chiếu để tăng tính nhất quán của lộ trình và tiêu chí kiểm tra. Việc tham chiếu không đồng nghĩa với chứng nhận kiểm định, phê duyệt của Bộ GD&ĐT, ABET hoặc bất kỳ tổ chức nào.

## Nguồn tham chiếu

- Bộ GD&ĐT, Chương trình GDPT 2018 và văn bản hợp nhất các sửa đổi: https://moet.gov.vn/content/vanban/Lists/VBPQ/Attachments/1483/vbhn-ttu-322018-202021-132022-ttbgddt.pdf
- ACM/IEEE-CS/AAAI, Computer Science Curricula 2023: https://csed.acm.org/
- ABET, Criteria for Accrediting Computing Programs 2025–2026: https://www.abet.org/accreditation-criteria/criteria-for-accrediting-computing-programs-2025-2026/
- European Commission JRC, DigComp editions including DigComp 3.0 (2025): https://joint-research-centre.ec.europa.eu/scientific-activities/key-competences-lifelong-learning/digital-competence-framework-digcomp/all-editions-digcomp-and-related-jrc-publications_en
- UNESCO, AI Competency Framework for Students (2024): https://www.unesco.org/en/articles/ai-competency-framework-students

## Quy tắc căn chỉnh chương trình phổ thông

Mỗi bài phải gắn metadata lớp, chương trình/bộ sách, môn, chủ điểm, mục tiêu dự kiến và trạng thái thẩm định. Khung môn học và chủ đề chung chỉ giúp tổ chức nội dung; giáo viên vẫn phải đối chiếu yêu cầu cần đạt của đúng môn, lớp, bộ sách và phân phối chương trình hiện hành. Không sao chép nguyên văn nội dung SGK chưa được cấp quyền.

## Thiết kế bài học

1. Mục tiêu đo được và kiến thức tiên quyết.
2. Giải thích khái niệm, ví dụ đã giải và lỗi thường gặp.
3. Thực hành có hướng dẫn, sau đó là vận dụng độc lập.
4. Kiểm tra ngắn theo mục tiêu, phản hồi và hướng ôn tập.
5. Minh chứng hoàn thành; với CNTT cần mã chạy, test, debug hoặc thiết kế/sản phẩm khi phù hợp.
6. Nguồn/giấy phép và lần rà soát được lưu rõ.

## Ngân hàng đề V6.1.1

Ngân hàng phổ thông sinh 120 câu ứng viên đánh giá mỗi bài theo phân bố: 32 trắc nghiệm một đáp án, 16 đúng/sai, 16 điền khuyết, 8 chọn nhiều đáp án, 8 nối cặp, 8 sắp xếp thứ tự, 16 trả lời ngắn, 16 tự luận. Mỗi phần học vẫn có bộ checkpoint riêng. Ngân hàng đại học CNTT mở rộng bài code, debug, thiết kế và câu hỏi theo rubric.

Đây là mẫu đề/bản nháp tự động sinh. Trước khi đặt `active=true` hoặc xuất bản, cần kiểm tra tính đúng đắn, độ khó, độ phù hợp lớp/môn, độ rõ ngôn ngữ, các phương án nhiễu và đáp án/rubric.

## Đánh giá theo năng lực CNTT

Dùng đầu ra đo được cho phân tích vấn đề, thiết kế/triển khai giải pháp, kiểm thử, giao tiếp chuyên môn, trách nhiệm/đạo đức/bảo mật và làm việc nhóm. Bài lập trình cần mô tả đầu vào/đầu ra, starter code, bộ kiểm thử công khai phù hợp, test ẩn phía máy chủ khi triển khai, giới hạn tài nguyên và giải thích sau khi nộp. Bài dự án cần deliverable, rubric và phản hồi.

## Thể loại câu hỏi

- Trắc nghiệm một đáp án
- Đúng/sai
- Điền khuyết
- Chọn nhiều đáp án
- Nối cặp
- Sắp xếp thứ tự
- Trả lời ngắn
- Tự luận
- CNTT: code challenge, debugging, design task/project

Các câu trả lời khách quan được chấm theo đáp án chuẩn hóa. Câu tự luận/thiết kế cần rubric; AI chỉ đưa ra gợi ý/điểm có nêu rõ phương pháp và không thay thế phê duyệt của giáo viên.


## Lệnh kiểm toán trong dự án

- `npm run audit:quality`: xác minh hồ sơ chuẩn đầu ra trên toàn bộ bài học, đồng thời kiểm tra mẫu câu hỏi của từng khóa/môn và toàn bộ ngân hàng CNTT.
- `npm run audit:curriculum`: quét đầy đủ ngân hàng câu hỏi phổ thông để xác minh số lượng, metadata và trùng lặp.
- `npm run audit:it-curriculum`: xác minh danh mục 9 nhóm CNTT, 34 khóa, 414 bài và ngân hàng CNTT.

Các lệnh trên là kiểm toán tự động nội bộ, không phải chứng nhận bởi Bộ GD&ĐT, ABET hay tổ chức chuẩn hóa bên ngoài.
