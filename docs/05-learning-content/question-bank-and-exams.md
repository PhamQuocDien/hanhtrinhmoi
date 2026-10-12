# Thiết kế ngân hàng câu hỏi và đề kiểm tra V5.1.2

## Phân tách dữ liệu

Danh mục bài học nằm trong `content/curriculum/`; ngân hàng câu hỏi nằm trong `content/question-banks/` và được nạp vào collection MongoDB `questionbankitems`. Một câu hỏi cần có `questionId`, `grade`, `programCode`, `subjectCode`, `lessonId`, `unitId`, `topicTag`, `type`, `prompt`, `options` (nếu có), `correctAnswer`/`acceptedAnswers` và trạng thái kiểm duyệt.

Một đề đã phát cho người học được lưu trong `assessmentsessions` với `examId`, IDs câu, snapshot và trạng thái. Kết quả được lưu trong `assessmentattempts`, gồm điểm, phản hồi, IDs câu hỏi và câu trả lời đã nộp. Vì vậy tải lại cùng `examId` không tạo đề khác hoặc làm mất đề cũ.

## Phạm vi chọn câu

- Kiểm tra bài: chỉ lấy câu có đúng `grade + programCode + subjectCode + lessonId + topicTag` với bài được chọn.
- Kiểm tra chủ điểm: cho phép nhiều `lessonId` nhưng chỉ từ các bài nằm trong chủ điểm đó, mỗi câu vẫn phải khớp topic tag của đúng bài nguồn.
- Giữa kỳ/cuối kỳ/luyện tập: chỉ mở rộng danh sách bài nguồn trong cùng khóa môn và scope được chọn; không trộn môn, lớp, bộ sách khác.
- Payload công khai phải đi qua `curriculum.publicQuestion` để loại bỏ `correctAnswer`, `acceptedAnswers`, `explanation`, rubric và trường chấm điểm nhạy cảm.

## Trộn đề và chống lặp

`assessment-generator.js` chọn số câu theo loại đề, giới hạn số lượng, trộn thứ tự câu và thứ tự lựa chọn. API dùng lịch sử câu hỏi đã phát và các lần làm cùng khóa môn để ưu tiên câu chưa gặp. Khi ngân hàng chưa đủ, thuật toán được phép quay lại câu trong đúng pool; không được mở rộng sang pool ngoài phạm vi.

| Loại đề | Số câu |
|---|---:|
| Bài học | 8 |
| Chủ điểm | 16 |
| Giữa kỳ | 20 |
| Cuối kỳ | 24 |
| Luyện tập | 12 |

Số câu có thể thấp hơn mức mục tiêu khi pool thực tế không đủ; UI phải hiển thị số câu trả về từ API chứ không giả định luôn đủ. Với THCS, pool draft hiện được sinh 64 câu đánh giá mỗi bài: 32 trắc nghiệm, 16 điền khuyết, 8 trả lời ngắn và 8 tự luận. Checkpoint là pool riêng trên từng phần học, không dùng thay bài kiểm tra cuối bài.

## Nạp và nâng cấp ngân hàng

```bash
npm run seed:question-bank
```

Script `upsert` bằng `questionId`, có thể chạy lại mà không xóa kết quả học. Khi thay đổi nội dung câu hỏi đã phát, nên tạo một `questionId` mới hoặc version mới; không âm thầm thay đáp án cho phiên đề đang làm.

## Chất lượng và kiểm duyệt

Mọi câu hỏi sinh sẵn mang `contentStatus: draft-teacher-review-required`. Trước khi bật nội dung chính thức, cần rà soát đáp án, distractor, phương pháp giải, ngữ cảnh, mức độ theo lớp, accessibility và tính phù hợp với chương trình/bộ sách được chọn. AI không được tự ý thay đổi phạm vi curriculum tag của câu hỏi.
