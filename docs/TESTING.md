# Kiểm thử

## 1. Chạy

```sh
npm test          # toàn bộ kiểm thử
npm run check     # dữ liệu chương trình + kiểm thử + cú pháp
npm run check:syntax
```

**Không cần MongoDB.** Bộ kiểm thử chạy trên dữ liệu tĩnh và hàm thuần, nên
chạy được trên máy mới cài, trên CI và trong container.

> Lệnh dùng cờ `--experimental-vm-modules` vì `tests/frontend.test.js` phân tích
> cú pháp ES module của frontend bằng `vm.SourceTextModule`. Cờ này đã được đặt
> sẵn trong `package.json`.

## 2. Các bộ kiểm thử

| Tệp | Phạm vi |
|---|---|
| `tests/harness.js` | Bộ assertion tối giản, không thư viện ngoài |
| `tests/run-all.js` | Điểm khởi chạy |
| `tests/curriculum.test.js` | Cấu trúc chương trình 1–12, danh mục môn, đầu sách |
| `tests/scoring.test.js` | Chấm điểm 7 dạng + đề hỗn hợp |
| `tests/docx.test.js` | Đọc tệp Word, nhận dạng dạng câu, đáp án, ô trống |
| `tests/security.test.js` | Không lộ đáp án, phân quyền, tệp tải lên, mật khẩu |
| `tests/api-contract.test.js` | Route client gọi có tồn tại ở backend không |
| `tests/frontend.test.js` | Trang, đường dẫn, import, cú pháp, CSS, an toàn |

## 3. Những gì được kiểm tra

### Chương trình
- Có đủ 12 lớp, mỗi lớp có môn học.
- `lessonId` là khoá ổn định, **không** phải tên hiển thị.
- Mỗi bài có số thứ tự và trạng thái xác minh.
- Dữ liệu chưa đối chiếu **không** được gắn nhãn `VERIFIED`.
- Môn chưa có tên bài được đánh dấu, **không** tự đặt.
- Toán có ở cả 12 lớp; Tiếng Việt lớp 1–5, Ngữ văn từ lớp 6.
- Ngoại ngữ lớp 1–2 là nội dung **bổ trợ**.
- Khoa học tự nhiên có mạch Vật lí/Hoá/Sinh ở THCS.

### Chấm điểm (7 dạng)
- Trắc nghiệm một đáp án: đúng / sai / bỏ trống / thừa khoảng trắng.
- Trắc nghiệm nhiều đáp án: `all_or_nothing` và `partial_credit`, không âm, bất biến thứ tự.
- Đúng/Sai: dạng đơn và nhiều mệnh đề.
- Điền khuyết: một ô, nhiều ô, chấp nhận đáp án tương đương khi bật tuỳ chọn.
- Trả lời ngắn: `auto` / `manual` / `hybrid`.
- Câu số: chính xác tuyệt đối, sai số cho phép, dấu phẩy kiểu Việt Nam.
- Tự luận: **không** tự cho điểm, có cảnh báo độ dài.
- **Đề hỗn hợp 7 dạng**: chấm xong → còn câu chờ chấm → sau khi chấm tay mới chốt điểm.

### DOCX
- Tệp `.docx` thật được parse thành câu hỏi.
- Nhận dạng loại câu, lựa chọn, ô điền khuyết, đáp án.
- Đề có công thức được đánh dấu cần duyệt.
- Đề có hình nhúng vẫn đọc được.
- Tệp không phải DOCX báo lỗi rõ ràng.

### Bảo mật
- Bản nhìn cho học sinh **không** có `correctAnswer`, `rubric`, `acceptedAnswers`.
- Không đăng nhập → 401; học sinh gọi API quản trị → 403.
- Quyền lấy từ session, không tin request body.
- Chỉ nhận `.docx`, chặn path traversal, kiểm tra chữ ký nhị phân.
- Mật khẩu băm bcrypt, xác minh sai trả `false` chứ không ném lỗi.

### Hợp đồng API
- Dựng ứng dụng Express thành công.
- **Mọi** đường dẫn client gọi đều tồn tại ở backend.
- Đủ các nhóm route: `auth`, `student`, `admin`, `health`.
- Mọi route quản trị được bảo vệ ở tầng ứng dụng.

### Giao diện
- Đủ các trang bắt buộc của học sinh và quản trị.
- Mọi `script src`, `href` và đường dẫn nội bộ tồn tại.
- Mọi câu lệnh `import` trỏ tới tệp có thật.
- Mọi tệp JS có cú pháp ES module hợp lệ.
- Mọi tệp CSS cân bằng ngoặc.
- Không còn "Coming soon".
- Không dùng `eval()`, `innerHTML=` hay giữ đáp án đúng ở trình duyệt.

## 4. Kiểm tra dữ liệu chương trình

```sh
npm run validate:curriculum
```

Phát hiện: trùng khoá, thiếu lớp/môn/sách/chương/bài, môn không thuộc lớp,
thiếu trường `source`, tiêu đề đáng ngờ (chứa "test", "demo", "sample", "TODO").

## 5. Thêm kiểm thử mới

1. Thêm tệp `tests/<tên>.test.js` trả về `{ run }`.
2. Dùng `suite()` và `runCase()` từ `tests/harness.js`.
3. Đăng ký trong `SUITES` trong `tests/run-all.js`.

Kiểm thử phải chạy được **không cần MongoDB**.