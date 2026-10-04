# Di trú dữ liệu (Migration)

## 1. Nguyên tắc

Mọi script di trú trong dự án đều tuân theo ba quy tắc:

1. **An toàn** — không `DROP DATABASE`, không xoá bản ghi đang có.
2. **Lặp lại được (idempotent)** — chạy hai lần cho cùng kết quả.
3. **Có `--dry-run`** — xem trước thay đổi mà không ghi gì.

---

## 2. Di trú chương trình

### Chạy

```sh
npm run migrate:curriculum -- --dry-run    # chỉ báo cáo
npm run migrate:curriculum                # ghi lại 12 file
```

### Quy trình

```
curriculum-data.js (dữ liệu cũ)
   ↓ đọc
data/curriculum/curriculum-builder.js
   ↓ buildGradeCurriculum(grade)
   ↓ PHÂN LOẠI mỗi bản ghi
data/curriculum/grade-01.js … grade-12.js
   ↓ kiểm tra
scripts/validate-curriculum.js
```

### Phân loại dữ liệu sau khi di trú

| Trạng thái | Nghĩa |
|---|---|
| `NEEDS_VERIFICATION` | Toàn bộ dữ liệu hiện tại — chưa đối chiếu với bản in |
| `VERIFIED` | Chỉ đặt sau khi đã đối chiếu thật |
| `LEGACY` | Mang từ dữ liệu dự án cũ |
| `SAMPLE` | Dữ liệu mẫu |

**Không** có bản ghi nào được tự nâng lên `VERIFIED` trong quá trình di trú.

### Tính lặp lại được

`generatedAt` cố tình để `null` để đầu ra giống nhau giữa các lần chạy, và
script chỉ ghi file khi nội dung thực sự khác (`unchanged` / `created` / `updated`).

### Tệp sinh ra **không được sửa tay**

Mỗi `grade-NN.js` có ghi chú ở đầu file:

```
// TỰ ĐỘNG SINH BỞI scripts/migrate-curriculum.js — ĐỪNG SỬA TAY.
```

Muốn chỉnh dữ liệu, hãy sửa ở nguồn rồi chạy lại script.

---

## 3. Di trú ngân hàng câu hỏi

> **Trạng thái: chưa viết.** Xem [MIGRATION_REPORT.md](MIGRATION_REPORT.md).

Còn hai tệp dữ liệu cũ ở thư mục gốc:

| Tệp | Vai trò |
|---|---|
| `question-data.js` | Ngân hàng câu hỏi cũ, **không phải** nguồn của nền tảng |
| `question-bank-complete.js` | Bổ sung câu hỏi cho ngân hàng cũ |

`server.js` vẫn `require()` hai tệp này cho phần legacy, nên chưa thể gỡ ngay.

Khi thực hiện di trú, cần:

1. `scripts/migrate-questions.js` chuẩn hoá câu hỏi cũ sang lược đồ 7 dạng mới.
2. Chuẩn hoá `answer` → `correctAnswer` + `acceptedAnswers`.
3. Bổ sung `gradingMode` theo dạng câu.
4. Ghi `source` và `verificationStatus = 'LEGACY'`.
5. Có `--dry-run` và báo cáo số câu bị loại kèm lý do.

---

## 4. Di trú chương trình (nội dung bài học)

Bài học hiện chỉ có metadata, `contentStatus = "EMPTY"`. Quy trình bổ sung nội dung:

1. Đối chiếu tên bài với bản in sách giáo khoa.
2. Biên soạn hoặc nhập nội dung dạy học **có quyền sử dụng**.
3. Đặt `contentStatus` thành trạng thái có nội dung.
4. Cập nhật `verificationStatus = "VERIFIED"` và `verifiedAt`.

Chi tiết: [CURRICULUM_VERIFICATION.md](CURRICULUM_VERIFICATION.md).

---

## 5. Bảo vệ dữ liệu

- **Không** chạy lệnh xoá hàng loạt trên cơ sở dữ liệu thật.
- **Không** xoá bản ghi đang có.
- Chạy `--dry-run` trước mọi thao tác di trú.
- Script di trú chỉ **tạo hoặc cập nhật** bản ghi có khoá xác định, không xoá.