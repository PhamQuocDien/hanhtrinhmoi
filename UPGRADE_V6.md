# Hành Tinh Mơ Ước 6.0 — Lộ trình học riêng từng lớp

## Thay đổi chính

### 1. Mỗi lớp có hồ sơ môn học riêng

Hệ thống không còn dùng một danh sách chủ đề chung cho cả cấp. Mỗi lớp từ 1 đến 12 có:

- Tên môn hiển thị theo lớp, ví dụ `Toán 6`, `Toán 7`.
- Trọng tâm năng lực riêng.
- Danh sách bài và chủ đề khác nhau.
- Câu hỏi được tạo theo lớp, môn, bài và kỹ năng.

Một số môn vẫn xuất hiện ở nhiều lớp vì Chương trình GDPT quốc gia quy định học liên tục, nhưng nội dung và độ khó không trùng nhau.

### 2. Cấu trúc môn tiểu học được sửa

- Lớp 1–2: Tiếng Anh là chương trình làm quen tự chọn.
- Từ lớp 3: Tiếng Anh là môn bắt buộc.
- Lớp 3–5: dùng môn tích hợp `Tin học và Công nghệ`.
- Lớp 4–5: có `Khoa học` và `Lịch sử và Địa lí`.

### 3. Học tập cá nhân hóa

- Đặt mục tiêu 10–180 phút mỗi ngày.
- Tự đề xuất tối đa 4 bài trong kế hoạch hôm nay.
- Ưu tiên môn có điểm trung bình thấp và môn học sinh chọn quan tâm.
- XP, chuỗi ngày học và huy hiệu.
- Phân tích kỹ năng yếu/mạnh.
- Ôn lại lỗi sai gần nhất kèm đáp án và giải thích.
- Ghi chú riêng cho từng bài, lưu trong MongoDB.

### 4. Chấm bài và mở khóa

- 12 câu mỗi bài.
- Điểm phải **lớn hơn 8/10** mới mở bài sau.
- Sau khi nộp, học sinh xem từng câu đúng/sai, đáp án đúng, lời giải, XP và chuỗi ngày học.

### 5. API mới

- `GET /api/learning/profile`
- `POST /api/learning/profile`
- `GET /api/learning/today`
- `GET /api/learning/review`
- `GET /api/learning/note/:grade/:subjectId/:lessonId`
- `POST /api/learning/note/:grade/:subjectId/:lessonId`

### 6. Kiểm thử

`npm test` kiểm tra thêm:

- Đủ 12 hồ sơ lớp.
- Tên môn có lớp riêng.
- Không trùng tên bài trong một môn.
- Bài mở đầu của cùng môn không bị dùng lại giữa các lớp.
- Mỗi bài có 12 câu hợp lệ.
- Ngưỡng mở khóa trên 8/10 hoạt động đúng.

## Biến môi trường

Giữ khóa OpenAI chỉ ở Render Environment:

```env
OPENAI_API_KEY=TAO_KHOA_MOI_VA_DAT_O_RENDER
OPENAI_MODEL=gpt-5-mini
SCHOOL_YEAR=2026-2027
```

Không đưa khóa thật vào GitHub, HTML, JavaScript hoặc `.env.example`.
