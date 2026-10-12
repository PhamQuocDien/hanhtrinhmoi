# Giải thích cấu trúc thư mục — V1

| Đường dẫn | Trách nhiệm hiện tại |
|---|---|
| `apps/web/` | Giao diện người học và quản trị bằng HTML/CSS/JavaScript. |
| `apps/api/server.js` | Bootstrap Express, cấu hình bảo vệ và phục vụ frontend tĩnh cùng origin. |
| `apps/api/src/routes/` | API xác thực, khảo sát và quản trị. |
| `apps/api/src/models/` | Schema Mongoose cho tài khoản và phản hồi khảo sát. |
| `apps/api/src/middleware/` | CSRF, xác thực session, kiểm tra quyền. |
| `apps/api/src/utils/` | Hàm validate dùng ở server. |
| `apps/api/test/` | Unit test không cần kết nối database cho validation và token. |
| `content/` | Đề cương / bản thảo nội dung sẽ soạn trong các phiên bản sau, chưa phải runtime content DB. |
| `services/code-runner/` | Vùng dành cho dịch vụ chạy/chấm code tách biệt. Chưa triển khai runner V1. |
| `database/` | Sơ đồ và tài liệu thiết kế. V1 hiện không chạy migrations SQL. |
| `docs/` | Tầm nhìn sản phẩm, kiến trúc, quyết định kỹ thuật, roadmap và vận hành. |
| `infra/` | Vùng chuẩn bị cấu hình triển khai và vận hành. |
| `scripts/` | Vùng dành cho script phát triển và kiểm tra chất lượng. |

## Quy ước

- Phía trình duyệt chỉ xử lý trình bày và gọi API; mọi xác thực quyền phải lặp lại ở server.
- Không lưu mật khẩu gốc; không nhúng secret trong JS/CSS/HTML hoặc Git.
- Không lưu dữ liệu người dùng/khảo sát bằng JSON file.
- Không chạy mã học viên trực tiếp trong API web; thiết kế code runner cách ly riêng trước khi tích hợp.
