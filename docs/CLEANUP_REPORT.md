# Kiểm tra kiến trúc sau đợt dọn dẹp

Tài liệu ghi lại kết quả rà soát phụ thuộc, những gì đã xử lý, và **những gì
còn tồn tại có chủ đích** kèm lý do.

Rà soát bằng CÔNG CỤ, không bằng đoán theo tên tệp: mỗi kết luận dưới đây đều
dựa trên việc thử gọi HTTP thật hoặc đếm số lần tham chiếu trong mã.

## 1. Nguyên tắc đã áp dụng

Chỉ xóa tệp khi **chứng minh được** không còn ai dùng:

| Bằng chứng kiểm tra | Cách kiểm tra |
|---|---|
| Còn được `require` / `import` | Đếm tham chiếu trong mọi tệp mã |
| Còn được phục vụ qua HTTP | Gửi GET thật và xem mã trạng thái |
| Còn được HTML trỏ tới | Quét `href` / `src` |
| Còn được CSS dùng | Quét `@import`, `url(...)` |
| Còn được npm script gọi | Đọc `package.json` |
| Còn được kiểm thử dùng | Quét tệp trong `tests/` |

## 2. Đã xử lý

### XÓA (không còn tham chiếu)

| Tệp | Lý do |
|---|---|
| `m[1])` | Tạo nhầm từ lệnh shell (0 byte, chưa từng được commit) |
| `audit.txt`, `cd.txt`, `fr.txt`, `rq.txt`, `un.txt` | Kết quả audit tạm trong phiên làm việc |
| `scripts/check-css-coverage.js` | Công cụ đo CSS một lần, không ai gọi |
| `tests/smoke-models.js` | Đã bị thay bằng bộ kiểm thử đầy đủ hơn |

### ARCHIVE (có giá trị lịch sử)

| Tệp | Đích | Lý do |
|---|---|---|
| `index.html` (gốc) | `archive/legacy-games/pages/index-legacy-home.html` | Trang chủ game cũ. **Cả 11 trang nó liên kết đều đã nằm trong `archive/legacy-games/`**, tức là trang chết 100%. Ngoài ra nó còn bị `public/index.html` che khuất khi phục vụ. |
| `UPGRADE_V4..V14.md`, `UPGRADE_NOTES.md` | `docs/archive/` | Nhật ký nâng cấp của các phiên bản cũ |
| `ARCHITECTURE_V10/V11/V13/V14.md` | `docs/archive/` | Mô tả kiến trúc của phiên bản cũ |
| `TEST_REPORT_V13.md`, `TEST_REPORT_V14.md` | `docs/archive/` | Báo cáo kiểm thử của phiên bản cũ |
| `DEPLOY_CHECKLIST_V13.md` | `docs/archive/` | Checklist triển khai phiên bản c��� |

## 3. Sửa lỗi kiến trúc phát hiện trong lúc rà soát

### Hằng số cứng `[9, 18, 27, 35]` cho mốc checkpoint

`server.js` từng ghi thẳng:

```js
checkpoint: [9, 18, 27, 35].includes(week)
```

Vấn đề: con số này là giả định riêng của dự án, **không phải quy định của Bộ**,
và lệch với hệ thống đánh giá mới đang dùng ngưỡng theo **số bài đã học**.

Đã tách thành `server/services/school-calendar.service.js` — một nơi duy nhất định
nghĩa số tuần học, mốc checkpoint và bài kỳ vọng. `server.js` chỉ gọi hàm.

### Bộ kiểm thử tự chạy nhóm kiểm tra hàng trăm lần

Trong quá trình sửa, một khối `suite(...)` bị chèn nhầm vào **giữa vòng lặp** ở
`tests/curriculum-browse.test.js`, khiến 10 nhóm kiểm tra chạy **154 lần** mà bộ
kiểm thử vẫn báo "đạt" — vì mỗi lần chạy đều đúng, chỉ là chạy quá nhiều.

Đã thêm `tests/structure.test.js` để bắt đúng loại lỗi này:
- không được có tên nhóm kiểm tra lặp lại trong một tệp;
- không được có lời gọi `suite()` nào nằm bên trong `for` / `while`.

Bộ này chạy **đầu tiên** trong `tests/run-all.js` để lỗi cấu trúc lộ ra sớm.

## 4. Còn tồn tại CÓ CHỦ ĐÍCH (không xóa)

### Hai nguồn dữ liệu chương trình

| Nguồn | Dùng cho | Ghi chú |
|---|---|---|
| `data/curriculum/curriculum-registry.js` | `/api/student/curriculum/*` (nền tảng học tập) | Nguồn chính của nền tảng |
| `curriculum-data.js` (gốc) | `/api/learning/*` (route legacy còn đăng ký) | **Xem mục 5** |

### `server.js` vẫn là tệp lớn (~5.150 dòng)

Kiểm tra bằng đếm tham chiếu: trong 55 biến được giải nén từ 9 lệnh `require`,
chỉ **2 biến không dùng**. Nghĩa là các mô-đun game và học tập cũ vẫn đang được
gọi thật, không phải rác.

Tách `server.js` là việc lớn và có rủi ro hồi quy; cần làm theo lô từng phần kèm
kiểm thử, không gộp vào đợt dọn dẹp này.

### Các trang gốc còn được phục vụ

`admin-panel.html`, `phu-huynh.html`, `thong-bao.html`, `login.html`,
`global-client.js`, `heartbeat.js`, `style.css`, `modern-ui.*`, `stockfish.wasm`

Tất cả **vẫn trả HTTP 200**. Chúng được giữ vì:
- `server.js` còn middleware chặn theo vai trò cho `/admin-panel.html`
  và `/phu-huynh.html`;
- nhiều route chuyển hướng tới `/login.html`.

Xem `docs/LEGACY_FEATURE_AUDIT.md` để biết trạng thái từng tính năng.

## 5. Nợ kỹ thuật đã ghi nhận

| Vấn đề | Mức độ | Ghi chú |
|---|---|---|
| Hai nguồn dữ liệu chương trình cùng tồn tại | Trung bình | `curriculum-data.js` phục vụ `/api/learning/*`; không frontend hiện tại nào gọi nhóm route này. Cần một đợt refactor riêng. |
| `server.js` gộp route legacy và nền tảng | Cao | Xem mục 4 |
| Mốc tuần học là quy ước nền tảng | Thấp | Đã tách ra `school-calendar.service.js` và ghi rõ nguồn |

## 6. Quy trình rà soát (để lặp lại được)

```bash
npm run check     # validate + test + syntax + frontend + module contract
npm run smoke     # kiểm tra các trang tĩnh trả 200
node tests/structure.test.js   # kiểm tra cấu trúc bộ kiểm thử
```

Khi cần xóa một tệp, chạy ba bước sau **trước khi** xóa:

1. Tìm tất cả tệp có chứa tên tệp đó.
2. Nếu là tệp tĩnh, gửi `GET` thật để xem máy chủ còn phục vụ không.
3. Chỉ xóa khi cả hai đều cho kết quả "không ai dùng".