# Kiến trúc

## 1. Tổng quan

Dự án gồm hai lớp chạy trên cùng một tiến trình Node.js:

1. **Nền tảng học tập** — kiến trúc mới, tách tầng rõ ràng.
2. **Phần legacy** — `server.js` cũ (game, đấu trường, sinh tốc, Robux…).

Cả hai dùng chung một tiến trình HTTP và cùng cơ chế phiên.

---

## 2. Luồng phụ thuộc

```
server.js  (entry point — khởi động HTTP + Socket.IO)
   │
   └── server/routes/mount-education-routes.js   ← gắn route của nền tảng
            │
            ├── routes/auth.routes.js     → controllers → services → models
            ├── routes/student.routes.js  → controllers/student.controller.js
            └── routes/admin.routes.js    → controllers/admin.controller.js
```

Ngoài ra `server/app.js` dựng **một ứng dụng Express riêng** cho nền tảng học
tập. Tách vậy giúp kiểm thử được toàn bộ route mà không cần mở cổng:

```js
const { createApp } = require('./server/app');
const app = createApp({});   // dùng trong tests/api-contract.test.js
```

---

## 3. Tầng và trách nhiệm

| Tầng | Thư mục | Trách nhiệm | KHÔNG được làm |
|---|---|---|---|
| Route | `server/routes/` | Định nghĩa đường dẫn, gắn middleware | Không chứa nghiệp vụ |
| Controller | `server/controllers/` | Đọc request, gọi service, đóng gói phản hồi | Không chấm điểm, không truy vấn Mongoose trực tiếp |
| Service | `server/services/` | Nghiệp vụ, truy vấn dữ liệu | Không biết về HTTP (`req`/`res`) |
| Model | `server/models/` | Lược đồ và phương thức Mongoose | Không chứa nghiệp vụ |
| Validator | `server/validators/` | Kiểm tra hình dạng dữ liệu | Không truy vấn CSDL |
| Parser | `server/parsers/` | Đọc và chuẩn hoá định dạng ngoài (DOCX) | Không ghi CSDL |
| Util | `server/utils/` | Hàm thuần dùng chung | Không phụ thuộc request |
| Config | `server/config/` | Nguồn duy nhất cho cấu hình | Không chứa nghiệp vụ |

---

## 4. Danh sách service

| Tệp | Trách nhiệm |
|---|---|
| `auth.service.js` | Đăng ký, đăng nhập, đăng xuất, đồng bộ tài khoản admin |
| `curriculum.service.js` | Đọc registry chương trình, trả dữ liệu cho giao diện |
| `question.service.js` | Truy vấn ngân hàng câu hỏi, tách bản nhìn học sinh / quản trị |
| `exam.service.js` | Bắt đầu lượt làm bài, lưu nháp, nộp bài, lịch sử |
| `scoring.service.js` | **Facade** của `scoring/` — chấm 7 dạng câu hỏi |
| `scoring/question-graders.js` | Một hàm chấm cho **từng** loại câu hỏi |
| `scoring/exam-grader.js` | Gom kết quả cả đề và chấm tay |
| `progress.service.js` | Tiến độ học tập, tính lại từ bản ghi |
| `grading.service.js` | Hàng đợi chấm tay, chốt điểm cuối |
| `docx-import.service.js` | Điều phối việc đọc tệp Word và lưu phiên nhập |

---

## 5. Dòng dữ liệu chính

### Học sinh làm bài

```
Trang exam.html
  → POST /api/student/exams/:id/attempts
      → exam.service.startAttempt()
          → nạp câu hỏi KÈM đáp án ở máy chủ
          → toStudentView() cắt phần đáp án
          → trả cho client
Trang exam.html gửi câu trả lời
  → POST /api/student/attempts/:id/submit
      → exam.service.submitAttempt()
          → nạp lại đáp án ở máy chủ
          → scoring.gradeExam()        (điểm LUÔN do máy chủ tính)
          → lưu Attempt
          → cập nhật Progress
          → trả kết quả (chưa chốt nếu còn câu chờ chấm)
```

### Quản trị chấm tay

```
Trang grading.html
  → GET  /api/admin/grading/attempts/:attemptId   (mở bài để chấm)
  → POST /api/admin/grading/attempts/:attemptId/grade-bulk
      → grading.service.gradeBulk()
          → ghi manualScore cho từng câu
          → finalizeAttempt()
              → chấm lại tổng
              → gradingStatus = 'graded' khi đã chấm đủ
```

---

## 6. Frontend

Không có bước build. Trình duyệt tải ES module trực tiếp.

```
public/assets/js/
  core/api.js        # điểm duy nhất gọi máy chủ (studentApi, authApi, adminApi)
  core/dom.js        # tạo phần tử an toàn (textContent, KHÔNG innerHTML)
  question/renderers.js  # giao diện riêng cho từng loại câu hỏi
  exam/timer.js      # đếm thời gian + tự lưu nháp
  student/*.js       # một tệp cho mỗi trang học sinh
  admin/*.js         # một tệp cho mỗi trang quản trị
```

Nguyên tắc bắt buộc:

- Mọi nội dung do người dùng nhập đi qua `textContent`, **không** `innerHTML`.
- Không có `eval()`.
- Client **không** tự tính điểm và **không** giữ đáp án đúng.

---

## 7. Quy tắc phụ thuộc

- `server/config/constants.js` chỉ chứa hằng số kỹ thuật. Danh sách lớp, môn, bộ
  sách thuộc về `data/` và phải có một nguồn duy nhất.
- `data/` không được `require()` từ `public/` — frontend chỉ gọi API.
- Mỗi tệp trong `data/curriculum/` được nạp **lazy** (khi cần), không nạp cả 12 lớp
  lúc khởi động.