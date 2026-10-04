# Nhập đề thi từ tệp Word

## 1. Quy trình

```
Chọn lớp + môn (bắt buộc)
   ↓
Tải tệp .docx lên
   ↓
Kiểm tra an toàn tệp        (đuôi, MIME, chữ ký nhị phân, kích thước)
   ↓
Đọc và chuẩn hoá tài liệu
   ↓
Phát hiện câu hỏi           ← question-detector.js
   ↓
Phát hiện dạng câu          ← question-type-detector.js
   ↓
Phát hiện lựa chọn          ← option-detector.js
   ↓
Phát hiện ô điền khuyết     ← blank-detector.js
   ↓
Phát hiện đáp án            ← answer-detector.js
   ↓
Phát hiện giải thích        ← explanation-detector.js
   ↓
Phát hiện rubric            ← rubric-detector.js
   ↓
Kiểm tra hợp lệ             ← docx-validator.js
   ↓
XEM TRƯỚC → SỬA → LƯU NHÁP → CÔNG BỐ
```

## 2. Cấu trúc bộ dò

Mỗi bước là **một tệp riêng** trong `server/parsers/docx/`, không nhét tất cả vào
một tệp:

| Tệp | Trách nhiệm |
|---|---|
| `docx-parser.js` | Đọc tệp `.docx` (Office Open XML), trả về đoạn văn |
| `question-detector.js` | Tách tài liệu thành các câu hỏi |
| `question-type-detector.js` | Xác định 7 dạng câu hỏi |
| `option-detector.js` | Nhận dạng lựa chọn A. / A) / A: |
| `blank-detector.js` | Nhận dạng ô điền khuyết theo ngữ cảnh |
| `answer-detector.js` | Đọc khối đáp án cuối tài liệu |
| `explanation-detector.js` | Tách phần giải thích |
| `rubric-detector.js` | Chuyển hướng dẫn chấm thành rubric |
| `docx-validator.js` | Kiểm tra câu hỏi sau khi nhận dạng |

Điều phối: `server/services/docx-import.service.js`.

## 3. Nhận dạng dạng câu hỏi

Parser hỗ trợ **đủ 7 dạng**, không chỉ trắc nghiệm:

| Dạng | Dấu hiệu | Ghi chú |
|---|---|---|
| `single_choice` | Có lựa chọn A–F, đáp án **một** ký hiệu | |
| `multiple_choice` | Đáp án có nhiều ký hiệu (`A,C`) | |
| `true_false` | Đáp án là Đúng/Sai | Hỗ trợ dạng nhiều mệnh đề |
| `fill_blank` | Có ô trống **trong ngữ cảnh điền khuyết** | Không biến mọi dấu gạch thành blank |
| `short_answer` | "Nêu…", "Trình bày ngắn gọn…" + đáp án ngắn | Không chắc chắn thì đánh dấu cần duyệt |
| `numeric` | Đáp án là số | |
| `essay` | Không có lựa chọn + yêu cầu trình bày/phân tích | **Mặc định chấm tay** |

Quản tị viên có thể **đổi dạng** ngay trên màn hình xem trước — ví dụ đổi
`short_answer` thành `essay` khi câu yêu cầu trình bày dài.

## 4. Khối đáp án

Hỗ trợ mẫu đáp án ở cuối tài liệu:

```
ĐÁP ÁN
1. A
2. C
3. A,C
4. Đúng - Sai - Đúng - Sai
5. Hà Nội
6. 10
```

> **Không có đáp án thì KHÔNG đoán.** Câu thiếu đáp án bị đánh dấu lỗi và chặn
> công bố.

## 5. Hình và công thức

- Câu hỏi có hình được **giữ lại** trong trường `media`.
- Công thức phân số, chỉ số trên/dưới, căn bậc hai, công thức Vật lí / Hoá học
  được phát hiện và đánh dấu **cảnh báo + cần người duyệt**.
- Hệ thống **không tự sửa** hay tự đoán nội dung công thức.

## 6. An toàn tệp tải lên

| Kiểm tra | Giá trị |
|---|---|
| Phần mở rộng | Chỉ `.docx` |
| MIME cho phép | `…wordprocessingml.document`, `zip`, `octet-stream` |
| Chữ ký nhị phân | `50 4B 03 04` (ZIP/Office Open XML) |
| Kích thước tối đa | 8 MB (mặc định) |
| Số câu tối đa mỗi lần nhập | 300 (mặc định) |
| Tên tệp | Chặn path traversal và ký tự đường dẫn |

Middleware: `server/middleware/upload.middleware.js`. Tệp **không** lưu trên đĩa —
chỉ giữ `fileSha256` để đối chiếu.

## 7. Trạng thái tài liệu nhập

```
uploaded → parsing → parsed → needs_review → draft_saved → published
                                    └────────→ rejected
```

| Trường | Ý nghĩa |
|---|---|
| `jobId` | Mã lần nhập |
| `fileName`, `fileSizeBytes`, `fileSha256` | Đối chiếu tệp |
| `uploadedBy` | Người tải lên (lấy từ phiên) |
| `parserVersion` | Phiên bản bộ dò đã dùng |
| `questionCount`, `validCount`, `warningCount`, `errorCount` | Thống kê kết quả |
| `documentWarnings` | Cảnh báo toàn tài liệu |
| `parseSummary.typeSummary` | Số câu theo từng dạng |

## 8. Màn hình nhập

`public/admin/import-docx.html`:

1. Chọn lớp + môn + thời gian (bắt buộc — máy chủ chặn môn không thuộc lớp).
2. Tải tệp `.docx` lên.
3. Xem thống kê: tổng câu, hợp lệ, cảnh báo, lỗi; số câu theo từng dạng.
4. Xem lại từng câu: nội dung, lựa chọn, ô trống, cảnh báo, **ô đổi dạng**.
5. Lưu nháp câu hỏi, hoặc tạo đề và công bố.

## 9. Kiểm thử

`tests/docx.test.js` dựng tệp `.docx` thật (không phụ thuộc thư viện ngoài) rồi
kiểm tra parser đọc được các dạng câu hỏi, phát hiện đáp án, ô trống, giải thích
và cảnh báo. Fixture sinh bằng `tests/fixtures/make-sample-docx.js`.

```sh
npm test
```