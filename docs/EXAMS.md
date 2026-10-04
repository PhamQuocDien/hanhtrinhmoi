# Đề thi

## 1. Vòng đời đề

```
draft ──(kiểm tra hợp lệ)──> review ──> published ──> archived
  ↑                                                 │
  └────────────(gỡ công bố)──────────────────────────┘
```

- Chỉ đề `published` mới hiện với học sinh và được phép làm.
- `sourceType` cho biết đề đến từ đâu: `docx_import`, `manual`, `auto_generated`.
- `parserVersion` ghi phiên bản bộ dò đã dùng, để truy vết khi parser đổi hành vi.

## 2. Mô hình

| Trường | Ý nghĩa |
|---|---|
| `examId` | Khoá ổn định |
| `title`, `description` | Tên và mô tả đề |
| `grade`, `subjectId` | Lớp và môn |
| `seriesId`, `textbookId`, `chapterId`, `lessonId` | Vị trí trong chương trình |
| `durationMinutes` | Thời gian cho phép |
| `totalPoints` | Tổng điểm, **tính lại** từ danh sách câu |
| `passScorePercent` | Điểm phần trăm để đạt |
| `questions[]` | Snapshot `{ questionId, order, points }` |
| `status` | `draft` / `review` / `published` / `archived` |
| `attemptCount`, `averageScorePercent` | Thống kê, cập nhật bằng `$inc` |

### Vì sao lưu snapshot danh sách câu

`Exam.questions` chỉ lưu **tham chiếu + thứ tự + điểm**, không sao chép nội dung
câu hỏi. Nhờ vậy sửa câu hỏi gốc **không** làm đổi đề đã tạo — đề giữ nguyên
đúng như lúc soạn.

## 3. Đề hỗn hợp

Một đề có thể chứa **đủ 7 dạng câu hỏi** cùng lúc:

| Câu | Dạng |
|---:|---|
| 1 | `single_choice` |
| 2 | `multiple_choice` |
| 3 | `true_false` |
| 4–5 | `fill_blank` |
| 6 | `short_answer` |
| 7 | `numeric` |
| 8–9 | `essay` |

Mỗi dạng có **giao diện riêng** (xem [QUESTION_TYPES.md](QUESTION_TYPES.md)).
Câu `essay` luôn kéo theo trạng thái chờ chấm tay
(xem [MANUAL_GRADING.md](MANUAL_GRADING.md)).

## 4. Điều kiện công bố

Đề **không** được công bố nếu bất kỳ điều kiện nào sau đây không thỏa:

- câu hỏi không hợp lệ;
- thiếu đáp án đúng;
- lựa chọn không hợp lệ (thiếu ký hiệu, trùng ký hiệu);
- ô điền khuyết không hợp lệ;
- thiếu metadata (lớp, môn);
- câu trùng lặp trong cùng đề;
- môn/lớp/bài học không tồn tại;
- lỗi nghiêm trọng của parser.

Validator: `server/validators/exam.validator.js`. Trang soạn thảo hiển thị kết quả
kiểm tra để quản trị viên biết còn thiếu gì trước khi công bố.

## 5. Vòng đời một lượt làm bài

```
POST /api/student/exams/:examId/attempts   (bắt đầu — máy chủ ghi thời điểm bắt đầu)
PUT  /api/student/attempts/:id/answers      (lưu nháp)
POST /api/student/attempts/:id/submit       (nộp — máy chấm)
GET  /api/student/attempts/:id              (xem kết quả, kèm đáp án)
GET  /api/student/attempts/history          (lịch sử)
```

- Đồng hồ trình duyệt **chỉ hiển thị**; máy chủ tự tính thời gian từ
  `startedAt`. Sửa đồng hồ máy không giúp gianh.
- Hết giờ: máy chủ xử lý theo chính sách, không tin trạng thái từ client.
- Nộp hai lần trả về `ALREADY_SUBMITTED`.
- Câu gửi lên không có trong đề bị **bỏ qua**.

## 6. Giao diện học sinh

| Trang | Vai trò |
|---|---|
| `public/student/exams.html` | Danh sách đề theo lớp/môn/bài |
| `public/student/exam.html` | Làm bài: đếm ngược, tự lưu nháp, nộp |
| `public/student/result.html` | Kết quả + xem lại + giải thích |
| `public/student/history.html` | Lịch sử làm bài, phân trang |

## 7. Giao diện quản trị

- `public/admin/exams.html` — danh sách đề, lọc theo trạng thái, nút công bố.
- `public/admin/exam-editor.html` — mở đề để kiểm tra điều kiện công bố và sửa câu hỏi.

## 8. API

Xem danh sách đầy đủ trong [API.md](API.md).