# Mô hình học tập thích ứng V4.1

V4.1 chưa huấn luyện một mô hình ngôn ngữ riêng. Nó kết hợp Gemini API (nếu được cấu hình), quy tắc học thích ứng có thể kiểm tra và tiến độ lưu trong MongoDB. Quyền mở bài, phạm vi đề kiểm tra và điểm đạt do backend quyết định.

## Vòng học tập

1. Người học chọn lớp 1–12, bộ sách và môn học.
2. Hệ thống tìm bài học đúng chương trình, lớp, môn và chủ điểm.
3. Bài học chia thành bốn phần; học sinh thực hiện checkpoint của phần hiện tại trước khi đi tiếp.
4. Khi mọi phần đạt ngưỡng, người học làm bài kiểm tra bài học.
5. Đạt ngưỡng `LEARNING_UNLOCK_SCORE` thì mở bài tiếp theo.
6. Điểm và lần làm được lưu để gợi ý bước học kế tiếp và giảm lặp câu hỏi.

## AI

- Gemini trả lời câu hỏi theo ngữ cảnh bài và hỗ trợ chấm tự luận theo rubric khi cấu hình hợp lệ.
- Fallback theo quy tắc được đánh dấu rõ là sơ bộ, không giả danh AI.
- AI không được thay đổi `grade`, `programCode`, `subjectCode`, `lessonId` hoặc `topicTag` của câu hỏi.

## Phạm vi nội dung

Khung lớp 1–5 và 6–9 được biên soạn mới theo các mạch năng lực của Chương trình GDPT 2018. Nội dung chưa phải bản mục lục hay nội dung nguyên văn của các nhà xuất bản; cần thẩm định theo SGK và kế hoạch giáo dục thật trước khi công bố.

## Bảo vệ người học

- Câu hỏi gửi ra trình duyệt không bao gồm đáp án, accepted answers, rubric hoặc giải thích chấm.
- Bản đề và IDs câu được lưu vào `AssessmentSession` để làm mới trang không làm thay đổi đề.
- `AssessmentAttempt` lưu đáp án nộp và kết quả để phục vụ lịch sử và chính sách chống lặp.
- Cần thực hiện đầy đủ chính sách bảo vệ dữ liệu trẻ em, quyền của phụ huynh và thời hạn lưu dữ liệu trước khi phát hành rộng.
