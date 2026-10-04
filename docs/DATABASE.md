# Cơ sở dữ liệu

MongoDB, truy cập qua Mongoose. Dữ liệu chương trình (lớp, môn, sách, chương,
bài học) **không** nằm trong CSDL mà nằm trong thư mục `data/` và được nạp bởi
`data/curriculum/curriculum-registry.js`.

## Bảng

| Mô hình | Collection |
|---|---|
| `user.model.js` | `users` |
| `question.model.js` | `questions` |
| `exam.model.js` | `exams` |
| `attempt.model.js` | `attempts` |
| `progress.model.js` | `progress` |
| `import-job.model.js` | `import_jobs` |
| `audit-log.model.js` | `audit_logs` |
| `connect-mongo` | `sessions` |

Mọi mô hình nằm trong `server/models/`.

## Quan hệ chính

```
Exam  --< ExamQuestion (snapshot: questionId, order, points)
Exam  --< Attempt --< questionResults (kết quả từng câu + điểm chấm tay)
ImportJob.questions  ->  Question  (câu hỏi đọc từ tệp Word)
User   --< Progress    (tiến độ theo bài học)
User   --< AuditLog    (nhật ký thao tác quản trị)
```

## Quy tắc quan trọng

- `Attempt.username` lấy từ **phiên**, không lấy từ request body.
- `Exam.questions` lưu bản chụp tham chiếu + điểm, để sửa câu hỏi gốc không
  làm đổi đề đã tạo.
- `Question.correctAnswer` không bao giờ được trả cho học sinh trước khi nộp bài.
- `AuditLog` chỉ ghi thêm (append-only) và lọc bỏ trường nhạy cảm.
- `passwordHash` và `password` có `select: false`, nên không vô tình bị trả ra.
- Các trường nhận dạng dùng chuỗi ổn định (`examId`, `questionId`, `lessonId`)
  thay vì phụ thuộc vào `ObjectId`.
