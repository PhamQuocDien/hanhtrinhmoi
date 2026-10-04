# Chấm tay câu tự luận

## 1. Vì sao cần chấm tay

Câu tự luận (`essay`) đánh giá diễn giải, không có một đáp án đúng duy nhất nên máy
**không bao giờ** tự cho điểm. Câu `short_answer` mở chế độ `manual` hoặc `hybrid`
cũng chuyển sang đây khi học sinh trả lời lệch.

## 2. Vòng đời

```
Học sinh nộp bài
      ↓
Máy chấm phần tự động
      ↓
attempt.gradingStatus = 'pending_manual_grading'
attempt.requiresManualGrading = true
      ↓
Câu xuất hiện trong hàng đợi chấm của quản trị viên
      ↓
Quản trị viên nhập điểm + nhận xét theo rubric
      ↓
gradingService.gradeBulk() / gradeQuestion()
      ↓
Còn câu chờ chấm?  → vẫn 'pending_manual_grading'
Chấm đủ?          → gradingStatus = 'graded', chốt điểm cuối
```

## 3. Giao diện quản trị

Trang `public/admin/grading.html`:

1. **Hàng đợi chấm** — danh sách câu đang chờ, lọc theo lớp và học sinh.
   Mỗi dòng cho biết học sinh, đề, số câu, dạng câu, trích bài làm và số từ.
2. **Bảng chấm** — mở một bài làm để xem:
   - nội dung câu hỏi và dạng câu;
   - **bài làm của học sinh**;
   - **rubric** kèm điểm tối đa của từng tiêu chí;
   - số từ và cảnh báo độ dài;
   - ô nhập điểm (có `min`/`max` theo `maxPoints` của câu) và ô nhận xét.
3. **Lưu điểm** — gửi tất cả câu đã nhập trong một lần.

## 4. Quy tắc

- Chỉ quản trị viên chấm. `graderId` lấy từ **phiên đăng nhập**, không lấy từ
  request body — không thể giả danh người chấm.
- Điểm bị chặn trên theo `maxPoints` của câu. Nhập vượt sẽ bị từ chối.
- Điểm làm tròn tối đa 2 chữ số thập phân.
- Chấm một câu **không** đụng tới kết quả máy đã chấm cho các câu khác.
- Câu đã chấm rồi không chấm lại được (trả về `ALREADY_GRADED`) — tránh ghi đè
  điểm của người khác.
- Nhật ký ghi lại thao tác `exam.grade` (không ghi nội dung bài làm).

## 5. Trạng thái hiển thị với học sinh

| Trạng thái | Trang kết quả hiển thị |
|---|---|
| Còn câu chờ chấm | Điểm máy chấm + thông báo "đang chờ giáo viên chấm" |
| Đã chấm xong | Điểm cuối cùng + điểm máy + nhận xét từng câu |

**Không** hiển thị một điểm tổng giả khi bài chưa chấm xong. Điểm 0 và "chưa
chấm" là hai trạng thái khác nhau, không được nhập làm một.

## 6. API

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| `GET` | `/api/admin/grading/pending` | Hàng đợi câu chờ chấm (lọc + phân trang) |
| `GET` | `/api/admin/grading/stats` | Tổng số câu chờ, theo lớp/môn/dạng |
| `GET` | `/api/admin/grading/attempts/:attemptId` | Mở bài làm để chấm |
| `POST` | `/api/admin/grading/attempts/:attemptId/grade` | Chấm một câu |
| `POST` | `/api/admin/grading/attempts/:attemptId/grade-bulk` | Chấm nhiều câu một lần |

Xem [API.md](API.md) và [SCORING.md](SCORING.md).