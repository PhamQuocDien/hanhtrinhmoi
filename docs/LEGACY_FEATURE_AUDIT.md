# ĐÁNH GIÁ TÍNH NĂNG CŨ (LEGACY FEATURE AUDIT)

Tài liệu này phân loại **từng** tính năng cũ của dự án theo bốn nhóm, nêu rõ căn cứ
và cách xử lý. Mục tiêu: không còn hai hệ thống cạnh tranh nhau, và không xoá mù
một tính năng còn giá trị.

Ngày rà soát: nhánh `cline/education-platform-refactor`.

---

## 1. Nguyên tắc phân loại

| Nhóm | Ý nghĩa | Xử lý |
|---|---|---|
| **KEEP + INTEGRATE** | Còn hữu ích cho nền tảng học tập | Giữ, đưa vào kiến trúc mới |
| **TRANSFORM + INTEGRATE** | Có thể chuyển thành hoạt động học tập | Giữ ở dạng giáo dục |
| **REMOVE** | Không còn giá trị cho nền tảng | Xoá sau khi kiểm tra phụ thuộc |
| **ARCHIVE** | Chưa chắc xoá được | Chuyển vào `archive/` |

Quy tắc bất di bất dịch: **không có hai hệ thống cùng làm một việc**. Mỗi trách
nhiệm chỉ có một nơi quản lý.

---

## 2. NGUỒN SỰ THẬT DUY NHẤT (SOURCE OF TRUTH)

Những tệp dưới đây **vẫn được giữ** vì máy chủ đang `require()` trực tiếp
(`server.js`). Chúng là dữ liệu/nghiệp vụ của phần legacy còn hoạt động, KHÔNG
phải nguồn dữ liệu của nền tảng học tập:

| Tệp | Vai trò | Còn dùng bởi |
|---|---|---|
| `server.js` | Entry point khởi động HTTP + Socket.IO | `npm start` |
| `curriculum-data.js` | Dữ liệu chương trình CŨ (đã migrate) | `server.js` |
| `question-data.js` | Ngân hàng câu hỏi CŨ | `server.js` |
| `question-bank-complete.js` | Bổ sung ngân hàng câu hỏi CŨ | `server.js` |
| `monopoly-data.js`, `monopoly-logic.js` | Trò chơi monopoly còn chạy qua Socket.IO | `server.js` |
| `server/modules/*.js` | Module legacy: learning, survival, quest | `server.js` |

> **Lưu ý quan trọng:** nền tảng học tập **không** đọc các tệp trên.
> Nguồn dữ liệu của nền tảng là `data/curriculum/`, `data/subjects/`,
> `data/textbooks/` (xem [CURRICULUM.md](CURRICULUM.md)).
> `question-data.js` / `question-bank-complete.js` là ngân hàng câu hỏi của phần
> legacy và **không** phải nguồn cho ngân hàng câu hỏi mới (MongoDB).

---

## 3. Nhóm KEEP + INTEGRATE

| Tính năng cũ | Nơi tích hợp | Ghi chú |
|---|---|---|
| Xác thực (đăng ký / đăng nhập / phiên) | `server/services/auth.service.js`, `server/middleware/auth.middleware.js` | Giữ bcrypt + session; bổ sung `regenerateSession` chống chiếm phiên |
| Hash mật khẩu | `server/utils/hash.js` | bcrypt, salt ngẫu nhiên, không bao giờ trả hash ra client |
| Ghi nhật ký thao tác | `server/models/audit-log.model.js` | Bổ sung lọc trường nhạy cảm (`redactChanges`) |
| Render câu hỏi 7 dạng | `public/assets/js/question/renderers.js` | Tái dùng cho trang làm bài |
| Đếm thời gian làm bài | `public/assets/js/exam/timer.js` | Mốc thời gian lấy từ máy chủ |
| Kiểm tra tệp tải lên | `server/middleware/upload.middleware.js` | Chỉ `.docx`, kiểm chữ ký nhị phân ZIP |
| Tiện ích DOM/định dạng | `public/assets/js/core/dom.js` | Mở rộng thêm shell, tiến độ, nhãn trạng thái |
| Cấu hình môi trường | `server/config/env.js` | Nguồn duy nhất cho cấu hình |
---

## 5. Nhóm REMOVE / ARCHIVE

57 tệp đã chuyển vào `archive/legacy-games/` bằng `git mv` (giữ lịch sử Git).
Xác minh trước khi chuyển: **không tệp nào trong danh sách được `server.js`
`require()`, và không tệp còn lại nào tham chiếu tới chúng.**

### 5.1. Trang game và trang học cũ (35 trang)

`bai-kiem-tra.html`, `bai-viet-1.html`, `bai-viet-2.html`, `caro.html`,
`cay-tre-tram-dot.html`, `choi-co.html`, `co-ty-phu.html`, `co-vay.html`,
`co-vua.html`, `con-cao-va-chum-nho.html`, `dau-truong-thu-thach.html`,
`doc-truyen.html`, `ghep-hinh-ghi-nho.html`, `giai-dau.html`, `giai-dieu-vui.html`,
`luyen-noi.html`, `luyen-noi-tieng-anh.html`, `lo-trinh-hoc-tap.html`,
`ngoi-nha-cua-be.html`, `nhiem-vu.html`, `o-chu.html`, `othello.html`,
`phong-trung-bay.html`, `rua-va-tho.html`, `sang-tac-truyen-vui.html`,
`tao-hinh-vui-nhon.html`, `thanh-pho-sang-tao.html`, `thu-vien-tri-thuc.html`,
`tim-diem-khac-biet.html`, `toan-hoc.html`, `trang-tri-phong.html`,
`vong-tuan-hoan-nuoc.html`, `xay-dung-uoc-mo.html`, `xuong-ve.html`

Lý do: mỗi trang là một màn hình trò chơi độc lập, không dùng chung dữ liệu với
nền tảng học tập, và đã bị thay thế bởi luồng học chuẩn
(lớp → môn → chương → bài → luyện tập → đề thi → kết quả).

### 5.2. Tệp chỉ phục vụ các trang trên (22 tệp)

- `board-ui-v14.css`, `board-ui-v14.js`, `board-ui-v8.css`, `board-ui-v8.js`
- `tournament-v9.css`, `tournament-v9.js`
- `stockfish.js`
- `assets/learning/*` (learning-v10 → v14, `practical-assessment.js`, `book-catalog.js`)
- `assets/room/*` (room-v10, survival-v11 → v14)

Lý do: sau khi 35 trang trên được chuyển đi, không còn trang nào tham chiếu tới
các tệp này. Đã cập nhật danh sách `publicFiles` trong `server.js` cho khớp.

### 5.3. Vì sao ARCHIVE chứ không REMOVE hẳn

`archive/` **không được phục vụ cho người dùng**: thư mục này không nằm trong
`publicStatic`, không có route nào trỏ tới, và không xuất hiện trong điều hướng.
Giữ lại để đối chiếu lịch sử khi cần; có thể xoá vĩnh viễn sau khi dự án ổn định.

---

## 6. Tệp ở gốc được GIỮ lại và lý do

| Tệp | Lý do giữ |
|---|---|
| `server.js` | Entry point của `npm start` |
| `curriculum-data.js`, `question-data.js`, `question-bank-complete.js` | `server.js` còn `require()` |
| `monopoly-data.js`, `monopoly-logic.js` | `server.js` còn `require()` |
| `index.html`, `login.html`, `status.html` | Còn trong `publicFiles` của `server.js` |
| `admin-panel.html`, `phu-huynh.html`, `thong-bao.html` | Còn route chuyển hướng / được phục vụ cho người dùng hiện hữu |
| `modern-ui.css`, `modern-ui.js`, `style.css` | Dùng chung cho các trang gốc còn lại |
| `global-client.js`, `heartbeat.js` | Được `server.js` phục vụ; `heartbeat.js` theo dõi phiên |
| `ads.txt` | Tệp cấu hình quảng cáo |
| `assets/ui/*` | Dùng chung cho các trang gốc còn lại |
| `render.yaml`, `package.json`, `README.md` | Cấu hình dự án |

> **Lưu ý về `index.html` ở gốc:** trang này là trang chủ cũ (trung tâm game).
> Nền tảng học tập phục vụ `public/` **trước**, nên `/` thực tế trả về
> `public/index.html`. Tệp gốc chỉ còn để tương thích.

---

## 7. Hệ quả với API

| API cũ | Trạng thái |
|---|---|
| `/api/game/*` | Giữ nguyên — chưa nằm trong phạm vi dọn dẹp lần này |
| `/api/house/*`, `/api/survival/*`, `/api/robux/*` | Giữ nguyên — phần legacy còn chạy |
| `/api/test`, `/api/submit-test` | Còn chạy cho phần legacy; **không** phải bài kiểm tra của nền tảng |
| `/api/auth/*` | **Nguồn duy nhất** của nền tảng (`server/routes/auth.routes.js`) |
| `/api/student/*` | **Nguồn duy nhất** cho học sinh |
| `/api/admin/*` | **Nguồn duy nhất** cho quản trị |

Không có hai endpoint nào của nền tảng cùng làm một việc.

---

## 8. Việc còn lại (không giấu)

- Phần API game legacy trong `server.js` (~4000 dòng) **chưa** được tách/loại bỏ.
  Việc này cần tách riêng vì `server.js` đang giữ nhiều trạng thái trong bộ nhớ và
  socket; xoá mà không tách sẽ làm hỏng các route đang chạy.
- `server/modules/learning-v11.js`, `survival-v11/v13/v14.js`,
  `quest-maintenance-v14.js` vẫn được `server.js` nạp. Tên file theo phiên bản,
  nhưng đổi tên cần đổi cả đường dẫn `require` — nên tách thành đợt riêng.
- `curriculum-data.js`, `question-data.js`, `question-bank-complete.js` chưa bị
  gỡ khỏi `server.js`. Xem [MIGRATION.md](MIGRATION.md).

---

## 4. Nhóm TRANSFORM + INTEGRATE

| Tính năng cũ | Bản chuyển đổi | Vị trí |
|---|---|---|
| Bài kiểm tra cũ (`bai-kiem-tra.html`) | Bài kiểm tra có đủ 7 dạng + chấm tay | `public/student/exams.html`, `public/student/exam.html` |
| Lộ trình học tập (`lo-trinh-hoc-tap.html`) | Lớp → môn → chương → bài theo chương trình | `public/student/curriculum.html` |
| Đánh giá thực hành (`practical-assessment.js`) | Ngân hàng câu hỏi + đề thi + chấm điểm | `public/student/practice.html`, `public/admin/exams.html` |
| Điểm tiến độ học tập | Tiến độ theo môn/bài, tính lại từ dữ liệu | `server/services/progress.service.js`, `public/student/progress.html` |
| Chuỗi đăng nhập (streak) | Giữ trong hồ sơ học sinh, hiển thị ở trang tài khoản | `public/student/profile.html` |
| Bảng xếp hạng (leaderboard) | Tiến độ học tập (không xếp hạng cạnh tranh) | `public/student/progress.html` |
| Danh sách môn cũ | Danh mục môn chuẩn 1–12 | `data/subjects/subject-registry.js`, `public/admin/subjects.html` |