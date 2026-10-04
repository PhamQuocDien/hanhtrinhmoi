# 🎓 Hành Tinh Mơ Ước — Nền tảng học tập cho học sinh lớp 1–12

Nền tảng học tập trực tuyến theo chương trình: chọn lớp → môn → bộ sách → chương →
bài học → luyện tập → bài kiểm tra → kết quả → tiến độ.

Hệ thống hỗ trợ **đủ 7 dạng câu hỏi** (không chỉ trắc nghiệm), chấm điểm tự động
cho dạng khách quan, **chấm tay** cho câu tự luận, và nhập đề thi từ tệp Word.

---

## 1. Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js 20+, Express 4, CommonJS |
| Cơ sở dữ liệu | MongoDB + Mongoose 8 |
| Phiên đăng nhập | `express-session` + `connect-mongo` (bcrypt cho mật khẩu) |
| Frontend | HTML + CSS + JavaScript (ES modules), **không** framework, **không** build step |
| Kiểm thử | Bộ kiểm thử riêng (`node tests/run-all.js`), không cần MongoDB |
| Triển khai | Render (`render.yaml`) |

> Dự án này **không** phải Java/Maven/IntelliJ. Nếu bạn thấy hướng dẫn như vậy
> ở đâu đó, đó là tài liệu cũ của một dự án khác.

---

## 2. Chạy dự án

```sh
npm install
npm start
```

Mở <http://localhost:3000>.

### Biến môi trường

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `MONGO_URI` | Nên có | — | Chuỗi kết nối MongoDB. Thiếu thì phần cần CSDL sẽ trả 503. |
| `SESSION_SECRET` | Nên có | *(sinh từ chuỗi phái sinh)* | Khoá ký phiên. Nên đặt ≥ 32 ký tự. |
| `ADMIN_USERNAME` | Không | `admin` | Tên đăng nhập quản trị viên. |
| `ADMIN_PASSWORD` | Có | — | ≥ 8 ký tự. **Không có biến này thì không tạo tài khoản admin.** |
| `PORT` | Không | `3000` | Cổng lắng nghe. |
| `BCRYPT_ROUNDS` | Không | `10` | Số vòng băm mật khẩu. |
| `UPLOAD_MAX_BYTES` | Không | `8388608` | Kích thước tối đa tệp Word (8 MB). |

Tài khoản admin **chỉ** được tạo từ biến môi trường — không có cách nào đăng ký
admin qua giao diện, và không có mật khẩu mặc định.

---

## 3. Kiểm tra toàn bộ

```sh
npm run check
```

Lệnh này chạy ba bước:

1. `npm run validate:curriculum` — kiểm tra dữ liệu chương trình lớp 1–12.
2. `npm test` — toàn bộ kiểm thử (không cần MongoDB).
3. `npm run check:syntax` — kiểm tra cú pháp mọi tệp JavaScript.

Bộ kiểm thử bao gồm: chương trình 1–12, chấm điểm 7 dạng, nhập DOCX, bảo mật,
hợp đồng API, và kiểm tra giao diện.

---

## 4. Cấu trúc dự án

```
server.js               # Entry point: khởi động HTTP + Socket.IO (legacy)
server/
  app.js                # Ứng dụng Express của nền tảng học tập
  config/               # env, database, constants
  middleware/           # auth, admin, upload, validation, error
  models/               # user, question, exam, attempt, progress, import-job, audit-log
  routes/               # auth, student, admin
  controllers/          # student.controller, admin.controller
  services/             # auth, curriculum, question, exam, scoring/, progress, grading, docx-import
  parsers/docx/         # docx-parser + các detector theo từng phần
  validators/           # question.validator, exam.validator
  utils/                # response, logger, hash, sanitize, answer-normalizer
public/
  index.html            # Trang chủ (chọn lớp 1–12)
  auth/                 # login.html, register.html
  student/              # dashboard, subjects, curriculum, lesson, practice,
                        # exams, exam, result, history, progress, profile
  admin/                # dashboard, students, curriculum, subjects, books,
                        # chapters, lessons, question-bank, exams,
                        # exam-editor, import-docx, grading, audit-log
  assets/css/           # education.css
  assets/js/            # core/ (api, dom), question/ (renderers), exam/ (page, timer),
                        # student/, admin/, auth/, ui/
data/
  curriculum/           # curriculum-registry.js + grade-01.js … grade-12.js
  subjects/             # subject-registry.js  (nguồn danh mục môn học)
  textbooks/            # book-series-registry.js, textbook-registry.js
tests/                  # harness, run-all, curriculum, scoring, docx,
                        # security, api-contract, frontend
scripts/                # validate-curriculum, migrate-curriculum, check-syntax
docs/                   # Kiến trúc, dữ liệu, API, bảo mật, kiểm thử…
archive/legacy-games/   # Tính năng cũ đã lưu trữ (không còn phục vụ)
```

---
---

## 6. 7 dạng câu hỏi

| Dạng | Giao diện | Cách chấm |
|---|---|---|
| `single_choice` | Radio | Tự động |
| `multiple_choice` | Checkbox | Tự động (đúng và đủ / cho điểm từng đáp án) |
| `true_false` | Nút Đúng/Sai (đơn hoặc nhiều mệnh đề) | Tự động |
| `fill_blank` | Ô nhập cho từng chỗ trống | Tự động (chuẩn hoá câu trả lời) |
| `short_answer` | Ô nhập ngắn / textarea | Tự động, chấm tay, hoặc kết hợp |
| `numeric` | Ô nhập số | Tự động, hỗ trợ sai số cho phép |
| `essay` | Textarea lớn + đếm số từ | **Chấm tay** theo rubric |

Chi tiết: [docs/QUESTION_TYPES.md](docs/QUESTION_TYPES.md).

---

## 7. Nguyên tắc an toàn

- **Điểm luôn do máy chủ tính.** Trình duyệt chỉ gửi câu trả lời, không gửi điểm.
- **Không lộ đáp án.** Trước khi nộp bài, API học sinh không trả đáp án đúng.
- **Quyền do máy chủ quyết định.** Không tin `role` từ body hoặc `localStorage`.
- **Mật khẩu băm bcrypt**, không bao giờ lưu dạng rõ.
- **Chỉ nhận tệp `.docx`**, có kiểm tra chữ ký nhị phân và kích thước.
- **Nội dung do người dùng nhập không bao giờ được chèn bằng `innerHTML`.**

Chi tiết: [docs/SECURITY.md](docs/SECURITY.md).

---

## 8. Dữ liệu chương trình

Dữ liệu chương trình lớp 1–12 **đang ở trạng thái chờ đối chiếu**
(`NEEDS_VERIFICATION`). Tên chương và tên bài học được migrate từ dữ liệu dự án,
chưa lấy từ bản in sách giáo khoa; nội dung dạy học chưa được biên soạn.

Dự án **không** tự nhận là "chuẩn Bộ Giáo dục và Đào tạo" và **không** tuyên bố
chỉ có một bộ sách duy nhất. Chi tiết: [docs/CURRICULUM_VERIFICATION.md](docs/CURRICULUM_VERIFICATION.md).

---

## 9. Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc tổng thể |
| [CURRICULUM.md](docs/CURRICULUM.md) | Cấu trúc chương trình 1–12 |
| [SUBJECTS.md](docs/SUBJECTS.md) | Danh mục môn học |
| [TEXTBOOKS.md](docs/TEXTBOOKS.md) | Bộ sách và đầu sách |
| [CHAPTERS.md](docs/CHAPTERS.md) | Cấu trúc chương |
| [LESSONS.md](docs/LESSONS.md) | Cấu trúc bài học |
| [QUESTION_TYPES.md](docs/QUESTION_TYPES.md) | 7 dạng câu hỏi |
| [EXAMS.md](docs/EXAMS.md) | Đề thi và vòng đời đề |
| [SCORING.md](docs/SCORING.md) | Quy tắc chấm điểm |
| [MANUAL_GRADING.md](docs/MANUAL_GRADING.md) | Chấm tay câu tự luận |
| [DOCX_IMPORT.md](docs/DOCX_IMPORT.md) | Nhập đề từ Word |
| [API.md](docs/API.md) | Danh sách endpoint |
| [DATABASE.md](docs/DATABASE.md) | Lược đồ CSDL |
| [SECURITY.md](docs/SECURITY.md) | Bảo mật |
| [TESTING.md](docs/TESTING.md) | Kiểm thử |
| [MIGRATION.md](docs/MIGRATION.md) | Di trú dữ liệu |
| [LEGACY_FEATURE_AUDIT.md](docs/LEGACY_FEATURE_AUDIT.md) | Phân loại tính năng cũ |

---

## 10. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| API trả 503 `DATABASE_UNAVAILABLE` | Chưa kết nối được MongoDB. Kiểm tra `MONGO_URI` rồi đợi khoảng 15 giây. |
| Không đăng nhập được bằng tài khoản admin | Chưa đặt `ADMIN_PASSWORD` (≥ 8 ký tự). Tài khoản admin chỉ tạo từ biến môi trường. |
| API trả 404 | Kiểm tra đường dẫn. Xem `docs/API.md`. |
| Tệp Word không nhận | Chỉ nhận `.docx` thật, tối đa 8 MB. Kiểm tra lại định dạng. |
| Phiên mất sau khi khởi động lại máy chủ | Đặt `SESSION_SECRET` cố định và cấu hình `MONGO_URI`. |
| Đề không công bố được | Xem kết quả kiểm tra trong trang soạn đề — thường là câu thiếu đáp án hoặc trùng lặp. |
| Chạy kiểm thử báo lỗi cú pháp JS | Chạy `npm run check:syntax` để biết đúng tệp nào lỗi. |

## 5. Tính năng chính

### Học sinh
- Xem chương trình theo lớp 1–12, môn, chương, bài học.
- Luyện tập và xem ngân hàng câu hỏi đã công bố.
- Làm bài kiểm tra có bộ đếm thời gian và tự lưu nháp.
- Xem kết quả, lịch sử làm bài và tiến độ theo môn.

### Quản trị
- Quản lý học sinh, chương trình, môn học, bộ sách, chương, bài học.
- Ngân hàng câu hỏi đủ 7 dạng, có bộ lọc và trình soạn thảo riêng theo từng dạng.
- Nhập đề thi từ tệp Word: tự nhận dạng câu hỏi, dạng câu, lựa chọn, ô điền
  khuyết, đáp án, giải thích và rubric → xem lại → sửa → lưu nháp → công bố.
- Soạn đề, kiểm tra điều kiện công bố, công bố đề.
- Chấm tay câu tự luận theo rubric.
---

## 6. 7 dạng câu hỏi

| Dạng | Giao diện | Cách chấm |
|---|---|---|
| `single_choice` | Radio | Tự động |
| `multiple_choice` | Checkbox | Tự động (đúng và đủ / cho điểm từng đáp án) |
| `true_false` | Nút Đúng/Sai (đơn hoặc nhiều mệnh đề) | Tự động |
| `fill_blank` | Ô nhập cho từng chỗ trống | Tự động (chuẩn hoá câu trả lời) |
| `short_answer` | Ô nhập ngắn / textarea | Tự động, chấm tay, hoặc kết hợp |
| `numeric` | Ô nhập số | Tự động, hỗ trợ sai số cho phép |
| `essay` | Textarea lớn + đếm số từ | **Chấm tay** theo rubric |

Chi tiết: [docs/QUESTION_TYPES.md](docs/QUESTION_TYPES.md).

---

## 7. Nguyên tắc an toàn

- **Điểm luôn do máy chủ tính.** Trình duyệt chỉ gửi câu trả lời, không gửi điểm.
- **Không lộ đáp án.** Trước khi nộp bài, API học sinh không trả đáp án đúng.
- **Quyền do máy chủ quyết định.** Không tin `role` từ body hoặc `localStorage`.
- **Mật khẩu băm bcrypt**, không bao giờ lưu dạng rõ.
- **Chỉ nhận tệp `.docx`**, có kiểm tra chữ ký nhị phân và kích thước.
- **Nội dung do người dùng nhập không bao giờ được chèn bằng `innerHTML`.**

Chi tiết: [docs/SECURITY.md](docs/SECURITY.md).

---

## 8. Dữ liệu chương trình

Dữ liệu chương trình lớp 1–12 **đang ở trạng thái chờ đối chiếu**
(`NEEDS_VERIFICATION`). Tên chương và tên bài học được migrate từ dữ liệu dự án,
chưa lấy từ bản in sách giáo khoa; nội dung dạy học chưa được biên soạn.

Dự án **không** tự nhận là "chuẩn Bộ Giáo dục và Đào tạo" và **không** tuyên bố
chỉ có một bộ sách duy nhất. Chi tiết: [docs/CURRICULUM_VERIFICATION.md](docs/CURRICULUM_VERIFICATION.md).

---

## 9. Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc tổng thể |
| [CURRICULUM.md](docs/CURRICULUM.md) | Cấu trúc chương trình 1–12 |
| [SUBJECTS.md](docs/SUBJECTS.md) | Danh mục môn học |
| [TEXTBOOKS.md](docs/TEXTBOOKS.md) | Bộ sách và đầu sách |
| [CHAPTERS.md](docs/CHAPTERS.md) | Cấu trúc chương |
| [LESSONS.md](docs/LESSONS.md) | Cấu trúc bài học |
| [QUESTION_TYPES.md](docs/QUESTION_TYPES.md) | 7 dạng câu hỏi |
| [EXAMS.md](docs/EXAMS.md) | Đề thi và vòng đời đề |
| [SCORING.md](docs/SCORING.md) | Quy tắc chấm điểm |
| [MANUAL_GRADING.md](docs/MANUAL_GRADING.md) | Chấm tay câu tự luận |
| [DOCX_IMPORT.md](docs/DOCX_IMPORT.md) | Nhập đề từ Word |
| [API.md](docs/API.md) | Danh sách endpoint |
| [DATABASE.md](docs/DATABASE.md) | Lược đồ CSDL |
| [SECURITY.md](docs/SECURITY.md) | Bảo mật |
| [TESTING.md](docs/TESTING.md) | Kiểm thử |
| [MIGRATION.md](docs/MIGRATION.md) | Di trú dữ liệu |
| [LEGACY_FEATURE_AUDIT.md](docs/LEGACY_FEATURE_AUDIT.md) | Phân loại tính năng cũ |

---

## 10. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| API trả 503 `DATABASE_UNAVAILABLE` | Chưa kết nối được MongoDB. Kiểm tra `MONGO_URI` rồi đợi khoảng 15 giây. |
| Không đăng nhập được bằng tài khoản admin | Chưa đặt `ADMIN_PASSWORD` (≥ 8 ký tự). Tài khoản admin chỉ tạo từ biến môi trường. |
| API trả 404 | Kiểm tra đường dẫn. Xem `docs/API.md`. |
| Tệp Word không nhận | Chỉ nhận `.docx` thật, tối đa 8 MB. Kiểm tra lại định dạng. |
| Phiên mất sau khi khởi động lại máy chủ | Đặt `SESSION_SECRET` cố định và cấu hình `MONGO_URI`. |
| Đề không công bố được | Xem kết quả kiểm tra trong trang soạn đề — thường là câu thiếu đáp án hoặc trùng lặp. |
| Chạy kiểm thử báo lỗi cú pháp JS | Chạy `npm run check:syntax` để biết đúng tệp nào lỗi. |
- Nhật ký thao tác quản trị.
