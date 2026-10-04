# Báo cáo di trú dữ liệu

## 1. Kết quả chạy gần nhất

Lệnh: `node scripts/migrate-curriculum.js --dry-run`

```
🔍 CHẾ ĐỘ DRY-RUN: không ghi file nào.
  Lớp  1  unchanged   9 môn   36 bài   5 môn cần nhập
  Lớp  2  unchanged   9 môn   36 bài   5 môn cần nhập
  Lớp  3  unchanged   9 môn   44 bài   4 môn cần nhập
  Lớp  4  unchanged  10 môn   52 bài   4 môn cần nhập
  Lớp  5  unchanged  10 môn   52 bài   4 môn cần nhập
  Lớp  6  unchanged  14 môn   50 bài   9 môn cần nhập
  Lớp  7  unchanged  14 môn   50 bài   9 môn cần nhập
  Lớp  8  unchanged  14 môn   50 bài   9 môn cần nhập
  Lớp  9  unchanged  14 môn   50 bài   9 môn cần nhập
  Lớp 10  unchanged  17 môn   70 bài  10 môn cần nhập
  Lớp 11  unchanged  17 môn   70 bài  10 môn cần nhập
  Lớp 12  unchanged  17 môn   70 bài  10 môn cần nhập

Tổng: 12 lớp, 630 bài học có tên nguồn, 88 môn cần admin nhập tên bài.
```

## 2. Ý nghĩa

| Chỉ số | Giá trị |
|---|---|
| Số lớp | 12 (1–12) |
| Số môn (tính theo lớp) | 9 → 17 tùy cấp |
| Số bài học **có tên** | 630 |
| Số môn **chưa có** tên bài | 88 |
| Trạng thái mọi bản ghi | `NEEDS_VERIFICATION` |

`unchanged` ở cả 12 lớp chứng minh script **lặp lại được** — chạy lại không
làm thay đổi dữ liệu.

### Số môn tăng dần theo cấp

| Cấp | Số môn |
|---|---:|
| Lớp 1–3 | 9 |
| Lớp 4–5 | 10 |
| Lớp 6–9 | 14 |
| Lớp 10–12 | 17 |

Mỗi lớp có danh sách môn **riêng**, không dùng chung một danh sách cho mọi lớp.

## 3. Trạng thái từng phần

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Cấu trúc 12 lớp | **Đã xong** | Mỗi lớp một tệp, nạp lazy |
| Danh mục môn học | **Đã xong** | Phân biệt bắt buộc / lựa chọn / mạch nội dung |
| Danh mục bộ sách | **Đã xong** | Nhiều bộ, kèm nguồn và trạng thái |
| Danh mục đầu sách | **Đã xong** | Ở trạng thái chờ đối chiếu |
| Cấu trúc chương | **Đã xong** | 183 chương |
| Cấu trúc bài học | **Đã xong** | 630 bài có tên |
| Tên bài đã đối chiếu | **Chưa** | Toàn bộ `NEEDS_VERIFICATION` |
| Nội dung dạy học | **Chưa** | `contentStatus = "EMPTY"` |
| Di trú ngân hàng câu hỏi | **Chưa** | Xem [MIGRATION.md](MIGRATION.md) §3 |

## 4. Việc cần làm tiếp

1. **Đối chiếu tên bài/chương** với bản in sách giáo khoa → đổi sang `VERIFIED`.
2. **Nhập tên bài** cho 88 môn còn thiếu.
3. **Biên soạn nội dung dạy học** cho từng bài.
4. **Di trú câu hỏi** từ `question-data.js` sang lược đồ mới.

Chi tiết về cách đối chiếu: [CURRICULUM_VERIFICATION.md](CURRICULUM_VERIFICATION.md).